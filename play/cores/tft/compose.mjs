/*
 * play/cores/tft/compose.mjs -- a faster LTDC scan-out for the colour units, giving the SAME
 * bytes as the twin's own composeFrame (play/twin.js, module 'ltdc'). Started 2026-10-15 in
 * the Tetris Jr. and colour-unit work (twin speed-up).
 *
 * WHY: the twin's composeFrame decodes every pixel through bus.read8/16/32 (a region lookup
 * per byte) into a fresh [r, g, b, a] array: about a fifth of a frame's cost (profile,
 * scratch tft-tj/prof). This reads the same registers through the same calls, in the same
 * order, then reads each layer's pixels straight from the memory region that holds the whole
 * layer window, and writes each output pixel as one 32-bit word.
 *
 * SAME BYTES, BY CONSTRUCTION AND BY TEST: the blend is the twin's expression, operation for
 * operation (doubles, in its order, truncated with & 0xff at the end); the only shortcut is
 * a layer factor of exactly 1, where the twin's px * 1 + r * 0 is exactly px. Anything this
 * does not cover (a layer window not inside one region, which the twin would read through
 * the peripheral trap) goes to the twin's own composeFrame for the whole frame. Proved equal
 * frame for frame against the twin's function on both units (scratch tft-tj/compose-check.mjs).
 */
const LTDC_BASE = 0x50001000;
const BPP = [4, 3, 2, 2, 2, 1, 1, 2];
const x17 = n => ((n << 4) | n) & 0xff;
const DAC1_DHR12R1 = 0x40007408;

function regionFor(bus, addr) {
  const rs = bus.regions;
  for (let i = 0; i < rs.length; i++) { const r = rs[i]; if (addr >= r.base && addr < r.end) return r; }
  return null;
}

export function makeComposer(AT) {
  let u32 = null, u32of = null;
  const stats = { fast: 0, fallback: 0 };
  function compose(bus, periph, opts) {
    // Registers: exactly the twin's reads, in its order (makeReg / readLayer / composeFrame).
    const sh = periph && periph.ltdcShadow;
    const reg = sh ? (abs => (sh.get(abs >>> 0) || 0) >>> 0) : (abs => bus.read32(abs >>> 0) >>> 0);
    const rd = off => reg((LTDC_BASE + off) >>> 0);
    const bpcr = rd(0x0c), awcr = rd(0x10);
    const ahbp = (bpcr >> 16) & 0xfff, avbp = bpcr & 0x7ff;
    const aaw = (awcr >> 16) & 0xfff, aah = awcr & 0x7ff;
    let W = aaw - ahbp, H = aah - avbp;
    if (!(W > 0 && W <= 1024 && H > 0 && H <= 1024)) { W = opts.w || 320; H = opts.h || 240; }
    const ox = ahbp + 1, oy = avbp + 1;
    const bccr = rd(0x2c) & 0xffffff;
    const cluts = (periph && periph.clut) || [null, null];
    const layers = [];
    for (let li = 0; li < 2; li++) {
      const lb = LTDC_BASE + (li === 0 ? 0x84 : 0x104);
      const lr = off => reg((lb + off) >>> 0);
      const cr = lr(0x00);
      if (!(cr & 1)) continue;
      const whp = lr(0x04), wvp = lr(0x08), bfcr = lr(0x1c), cfblr = lr(0x2c);
      const L = {
        pf: lr(0x10) & 7, constAlpha: lr(0x14) & 0xff, bf1: (bfcr >> 8) & 7, bf2: bfcr & 7,
        cfbar: lr(0x28) >>> 0, pitch: (cfblr >> 16) & 0x1fff, lines: lr(0x30) & 0x7ff,
        hStart: whp & 0xfff, hStop: (whp >> 16) & 0xfff, vStart: wvp & 0x7ff, vStop: (wvp >> 16) & 0x7ff,
        clut: cluts[li], keyEnable: (cr & 2) !== 0, colorKey: lr(0x0c) & 0xffffff,
      };
      L.wx0 = L.hStart - ox; L.wx1 = L.hStop - ox; L.wy0 = L.vStart - oy; L.wy1 = L.vStop - oy;
      L.bppv = BPP[L.pf];
      layers.push(L);
    }
    const rgba = opts.rgba;
    if (!rgba || rgba.length < W * H * 4) { stats.fallback++; return AT.composeFrame(bus, periph, opts); }
    // The backlight (the twin's backlightDim): a store read, no bus access.
    let dim = 1;
    const st = periph && periph.store;
    if (st && st.has(DAC1_DHR12R1)) { const duty = st.get(DAC1_DHR12R1) >>> 0; if (duty > 0) { const d = duty / 4095; dim = d >= 1 ? 1 : d; } }
    // Every layer's drawn window must sit inside one region (no trap reads), else the twin's own.
    for (const L of layers) {
      const x0 = Math.max(0, L.wx0), x1 = Math.min(W - 1, L.wx1), y0 = Math.max(0, L.wy0), y1 = Math.min(H - 1, L.wy1);
      L.skip = !(x0 <= x1 && y0 <= y1);
      if (L.skip) continue;
      const lo = L.cfbar + (y0 - L.wy0) * L.pitch + (x0 - L.wx0) * L.bppv;
      const hi = L.cfbar + (y1 - L.wy0) * L.pitch + (x1 - L.wx0) * L.bppv + L.bppv - 1;
      const r = lo >= 0 && hi <= 0xffffffff ? regionFor(bus, lo) : null;
      if (!r || hi >= r.end) { stats.fallback++; return AT.composeFrame(bus, periph, opts); }
      L.buf = r.buf; L.base = r.base;
      // The twin's factor for each pixel alpha, the same expression (cached per alpha value).
      L.ea = new Float64Array(256);
      for (let a = 0; a < 256; a++) L.ea[a] = (L.bf1 === 4 ? L.constAlpha : (a * L.constAlpha) / 255) / 255;
    }
    if (u32of !== rgba) { u32 = new Uint32Array(rgba.buffer, rgba.byteOffset, rgba.length >> 2); u32of = rgba; }
    const br = (bccr >> 16) & 0xff, bg = (bccr >> 8) & 0xff, bb = bccr & 0xff;
    const nL = layers.length;
    /* THE UNITS' OWN SETUP (both, every frame of play, measured: scratch tft-tj/layers.mjs): an
       RGB565 layer and an AL44 layer over it (Zelda's windows sit one pixel off
       the panel's edge, so each layer keeps its window test). The same arithmetic as below, with
       the format switch taken out and the addresses stepped along each row. */
    if (nL === 2 && layers[0].pf === 2 && layers[1].pf === 6 && !layers[0].skip && !layers[1].skip && layers[1].clut) {
      const A = layers[0], Bl = layers[1], ma = A.buf, mb = Bl.buf, eaA = A.ea, eaB = Bl.ea, clut = Bl.clut;
      // The AL44 colour for each byte (index replicated to 8 bits through the CLUT) and its alpha.
      const cr8 = new Uint8Array(256), cg8 = new Uint8Array(256), cb8 = new Uint8Array(256), al = new Uint8Array(256);
      for (let by = 0; by < 256; by++) { const c = clut[x17(by & 0xf)] >>> 0; cr8[by] = (c >> 16) & 0xff; cg8[by] = (c >> 8) & 0xff; cb8[by] = c & 0xff; al[by] = x17((by >> 4) & 0xf); }
      const e1 = eaA[255];
      for (let y = 0; y < H; y++) {
        const inA = y >= A.wy0 && y <= A.wy1, inB = y >= Bl.wy0 && y <= Bl.wy1;
        const rowA = A.cfbar + (y - A.wy0) * A.pitch, rowB = Bl.cfbar + (y - Bl.wy0) * Bl.pitch;
        let i = y * W;
        for (let x = 0; x < W; x++, i++) {
          let r = br, g = bg, b = bb;
          if (inA && x >= A.wx0 && x <= A.wx1 && e1 > 0) {
            const oa = ((rowA + (x - A.wx0) * 2) >>> 0) - A.base;
            const v = ma[oa] | (ma[oa + 1] << 8);
            const r5 = (v >> 11) & 0x1f, g6 = (v >> 5) & 0x3f, b5 = v & 0x1f;
            const ar = (r5 << 3) | (r5 >> 2), ag = (g6 << 2) | (g6 >> 4), ab = (b5 << 3) | (b5 >> 2);
            if (e1 === 1) { r = ar; g = ag; b = ab; } else { r = ar * e1 + r * (1 - e1); g = ag * e1 + g * (1 - e1); b = ab * e1 + b * (1 - e1); }
          }
          if (!(inB && x >= Bl.wx0 && x <= Bl.wx1)) { if (dim < 1) { r *= dim; g *= dim; b *= dim; } u32[i] = ((r & 0xff) | ((g & 0xff) << 8) | ((b & 0xff) << 16) | 0xff000000) >>> 0; continue; }
          const by = mb[((rowB + (x - Bl.wx0)) >>> 0) - Bl.base], e2 = eaB[al[by]];
          if (e2 > 0) {
            if (e2 === 1) { r = cr8[by]; g = cg8[by]; b = cb8[by]; }
            else { r = cr8[by] * e2 + r * (1 - e2); g = cg8[by] * e2 + g * (1 - e2); b = cb8[by] * e2 + b * (1 - e2); }
          }
          if (dim < 1) { r *= dim; g *= dim; b *= dim; }
          u32[i] = ((r & 0xff) | ((g & 0xff) << 8) | ((b & 0xff) << 16) | 0xff000000) >>> 0;
        }
      }
      stats.fast++; stats.special = (stats.special || 0) + 1;
      return { rgba, w: W, h: H };
    }
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        let r = br, g = bg, b = bb;
        for (let k = 0; k < nL; k++) {
          const L = layers[k];
          if (L.skip || x < L.wx0 || x > L.wx1 || y < L.wy0 || y > L.wy1) continue;
          const o = ((L.cfbar + (y - L.wy0) * L.pitch + (x - L.wx0) * L.bppv) >>> 0) - L.base, m = L.buf;
          let pr, pg, pb, pa;
          switch (L.pf) {
            case 0: pb = m[o]; pg = m[o + 1]; pr = m[o + 2]; pa = m[o + 3]; break;
            case 1: pb = m[o]; pg = m[o + 1]; pr = m[o + 2]; pa = 255; break;
            case 2: { const v = m[o] | (m[o + 1] << 8); const r5 = (v >> 11) & 0x1f, g6 = (v >> 5) & 0x3f, b5 = v & 0x1f;
              pr = (r5 << 3) | (r5 >> 2); pg = (g6 << 2) | (g6 >> 4); pb = (b5 << 3) | (b5 >> 2); pa = 255; break; }
            case 3: { const v = m[o] | (m[o + 1] << 8); const r5 = (v >> 10) & 0x1f, g5 = (v >> 5) & 0x1f, b5 = v & 0x1f;
              pr = (r5 << 3) | (r5 >> 2); pg = (g5 << 3) | (g5 >> 2); pb = (b5 << 3) | (b5 >> 2); pa = (v >> 15) & 1 ? 255 : 0; break; }
            case 4: { const v = m[o] | (m[o + 1] << 8); pr = x17((v >> 8) & 0xf); pg = x17((v >> 4) & 0xf); pb = x17(v & 0xf); pa = x17((v >> 12) & 0xf); break; }
            case 5: { const c = L.clut[m[o]] >>> 0; pr = (c >> 16) & 0xff; pg = (c >> 8) & 0xff; pb = c & 0xff; pa = 255; break; }
            case 6: { const by = m[o]; const c = L.clut[x17(by & 0xf)] >>> 0; pr = (c >> 16) & 0xff; pg = (c >> 8) & 0xff; pb = c & 0xff; pa = x17((by >> 4) & 0xf); break; }
            default: { const c = L.clut[m[o]] >>> 0; pr = (c >> 16) & 0xff; pg = (c >> 8) & 0xff; pb = c & 0xff; pa = m[o + 1]; break; }
          }
          const ea = L.ea[pa];
          if (ea <= 0) continue;
          if (ea === 1) { r = pr; g = pg; b = pb; continue; }     // px*1 + r*0 is exactly px
          r = pr * ea + r * (1 - ea);
          g = pg * ea + g * (1 - ea);
          b = pb * ea + b * (1 - ea);
        }
        if (dim < 1) { r *= dim; g *= dim; b *= dim; }
        u32[y * W + x] = ((r & 0xff) | ((g & 0xff) << 8) | ((b & 0xff) << 16) | 0xff000000) >>> 0;
      }
    }
    stats.fast++;
    return { rgba, w: W, h: H };
  }
  return { compose, stats };
}
