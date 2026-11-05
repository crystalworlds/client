/*
 * web/sgb.js -- THE SUPER GAME BOY'S SNES SIDE: borders, colours, the screen mask.
 * (2026-10-24; design and sources: the extra-hardware notes, section 1)
 *
 * The core is the Game Boy inside the Super Game Boy (a DMG with the ICD packet
 * receiver: gb_set_sgb). Every complete 16-byte command packet it receives is
 * queued (gb_sgb_packets); this class is what the SNES did with them, and what
 * the SNES put on the television: a 256 x 224 picture with the Game Boy's 160 x 144
 * screen at (48, 40), coloured by four four-colour palettes chosen per 8 x 8 cell,
 * inside a border.
 *
 * SOURCES, read first (memory read-competitor-source-first):
 *   - Pan Docs, "Super Game Boy" (command packets, every command's layout, the VRAM
 *     transfer, the border format, MASK_EN, MLT_REQ): MECHANISM for every command.
 *   - SameBoy Core/sgb.c (MIT): the order of effects inside each command, ATTR_BLK's
 *     inside/outside rule when only one of the two is chosen, the transfer reading
 *     the screen three frames after the command, the border's fade-out/fade-in
 *     (64 frames, swapped at the half-way point), the 32 built-in palettes and the
 *     per-title palette table of the SNES program (used only by the "every game"
 *     choice). Those copied values are labelled CONVERGENCE.
 * NOT DONE (said in the report): the SNES-side sound (SOUND, SOU_TRN), SNES program
 * uploads (DATA_SND, DATA_TRN, JUMP), the SNES program's own boot animation and its
 * default border (Nintendo's artwork: the border stays plain until the game sends one).
 *
 * The screen the transfers read is the core's frame: shade indices AFTER the Game
 * Boy's own palette (BGP), which is what the SNES receives from the ICD chip.
 */

export const SGB_W = 256, SGB_H = 224, SGB_X = 48, SGB_Y = 40;

/* SNES BGR555 -> canvas ABGR (little-endian RGBA bytes), 5 bits to 8 by repeating the top 3. */
export function snesColour(c) {
  const r = c & 31, g = (c >> 5) & 31, b = (c >> 10) & 31;
  return ((0xFF << 24) | (((b << 3) | (b >> 2)) << 16) | (((g << 3) | (g >> 2)) << 8) | ((r << 3) | (r >> 2))) >>> 0;
}

/* CONVERGENCE: the SNES program's 32 built-in palettes (SameBoy sgb.c built_in_palettes). */
export const BUILT_IN = [
  0x67BF, 0x265B, 0x10B5, 0x2866, 0x637B, 0x3AD9, 0x0956, 0x0000, 0x7F1F, 0x2A7D, 0x30F3, 0x4CE7, 0x57FF, 0x2618, 0x001F, 0x006A,
  0x5B7F, 0x3F0F, 0x222D, 0x10EB, 0x7FBB, 0x2A3C, 0x0015, 0x0900, 0x2800, 0x7680, 0x01EF, 0x2FFF, 0x73BF, 0x46FF, 0x0110, 0x0066,
  0x533E, 0x2638, 0x01E5, 0x0000, 0x7FFF, 0x2BBF, 0x00DF, 0x2C0A, 0x7F1F, 0x463D, 0x74CF, 0x4CA5, 0x53FF, 0x03E0, 0x00DF, 0x2800,
  0x433F, 0x72D2, 0x3045, 0x0822, 0x7FFA, 0x2A5F, 0x0014, 0x0003, 0x1EED, 0x215C, 0x42FC, 0x0060, 0x7FFF, 0x5EF7, 0x39CE, 0x0000,
  0x4F5F, 0x630E, 0x159F, 0x3126, 0x637B, 0x121C, 0x0140, 0x0840, 0x66BC, 0x3FFF, 0x7EE0, 0x2C84, 0x5FFE, 0x3EBC, 0x0321, 0x0000,
  0x63FF, 0x36DC, 0x11F6, 0x392A, 0x65EF, 0x7DBF, 0x035F, 0x2108, 0x2B6C, 0x7FFF, 0x1CD9, 0x0007, 0x53FC, 0x1F2F, 0x0E29, 0x0061,
  0x36BE, 0x7EAF, 0x681A, 0x3C00, 0x7BBE, 0x329D, 0x1DE8, 0x0423, 0x739F, 0x6A9B, 0x7293, 0x0001, 0x5FFF, 0x6732, 0x3DA9, 0x2481,
  0x577F, 0x3EBC, 0x456F, 0x1880, 0x6B57, 0x6E1B, 0x5010, 0x0007, 0x0F96, 0x2C97, 0x0045, 0x3200, 0x67FF, 0x2F17, 0x2230, 0x1548,
];
/* CONVERGENCE: the SNES program's per-title choice for games that send no colours
   (SameBoy sgb.c palette_assignments; header title at $134, 16 bytes). 1-based palette. */
const TITLE_PALETTES = {
  'ZELDA': 5, 'SUPER MARIOLAND': 6, 'MARIOLAND2': 0x14, 'SUPERMARIOLAND3': 2, 'KIRBY DREAM LAND': 0xB,
  'HOSHINOKA-BI': 0xB, "KIRBY'S PINBALL": 3, 'YOSSY NO TAMAGO': 0xC, 'MARIO & YOSHI': 0xC, 'YOSSY NO COOKIE': 4,
  "YOSHI'S COOKIE": 4, 'DR.MARIO': 0x12, 'TETRIS': 0x11, 'YAKUMAN': 0x13, 'METROID2': 0x1F, 'KAERUNOTAMENI': 9,
  'GOLF': 0x18, 'ALLEY WAY': 0x16, 'BASEBALL': 0xF, 'TENNIS': 0x17, 'F1RACE': 0x1E, 'KID ICARUS': 0xE, 'QIX': 0x19,
  'SOLARSTRIKER': 7, 'X': 0x1C, 'GBWARS': 0x15,
};

/* Pan Docs: the cartridge unlocks the SGB functions with $146 = $03 and $14B = $33. */
export function sgbEnhanced(bytes) { return !!(bytes && bytes.length > 0x14B && bytes[0x146] === 0x03 && bytes[0x14B] === 0x33); }

const T_LOW = 0, T_HIGH = 1, T_BORDER = 2, T_PAL = 3, T_ATTR = 4;

export class SuperGameBoy {
  constructor(cart) {
    this.tiles = new Uint8Array(256 * 32);        // border tiles, SNES 4 bits per pixel
    this.pendTiles = new Uint8Array(256 * 32);
    this.map = new Uint16Array(32 * 32);          // border map (32 x 28 used) ...
    this.bpal = new Uint16Array(64);              // ... and its four 16-colour palettes (SNES palettes 4-7)
    this.pendMap = new Uint16Array(32 * 32); this.pendPal = new Uint16Array(64);
    this.hasBorder = false; this.anim = 0;
    this.pal = new Uint16Array(16);               // the four screen palettes in force
    this.ram = new Uint16Array(512 * 4);          // the 512 system palettes (PAL_TRN)
    this.attr = new Uint8Array(20 * 18);          // palette per 8 x 8 cell
    this.files = new Uint8Array(45 * 90);         // the attribute files (ATTR_TRN)
    this.mask = 0;                                // 0 off, 1 freeze, 2 black, 3 colour 0
    this.players = 1;
    this.countdown = 0; this.dest = 0;
    this.cmd = null; this.need = 0; this.parts = [];
    this.frozen = new Uint8Array(160 * 144); this.live = new Uint8Array(160 * 144);
    this.out = new Uint32Array(SGB_W * SGB_H);
    this.stats = { packets: 0, commands: 0, transfers: 0, unknown: 0, last: '' };
    for (let i = 0; i < 4; i++) this.pal[i] = BUILT_IN[i];      // 1-A, the SNES program's own first choice
    for (let p = 1; p < 4; p++) for (let i = 0; i < 4; i++) this.pal[p * 4 + i] = BUILT_IN[i];
    this.titlePalette(cart);
  }
  /* The "every game" choice: a game that never sends colours wears what the SNES program
     gave its title (CONVERGENCE), else 1-A. An enhanced game replaces it at once. */
  titlePalette(cart) {
    if (!cart || cart.length < 0x144) return;
    let t = ''; for (let i = 0x134; i < 0x144; i++) { const c = cart[i]; if (!c) break; t += String.fromCharCode(c); }
    const n = TITLE_PALETTES[t];
    if (!n) return;
    for (let p = 0; p < 4; p++) for (let i = 0; i < 4; i++) this.pal[p * 4 + i] = BUILT_IN[(n - 1) * 4 + i];
  }

  /* One 16-byte packet from the core. A command's first byte is (command << 3) | packets. */
  packet(p) {
    this.stats.packets++;
    if (!this.cmd) {
      const len = p[0] & 7;
      if ((p[0] & 0xF1) === 0xF1) return;        // the boot program's header packets: for the SNES program only
      if (!len) return;                           // malformed (Pan Docs: 1 to 7 packets)
      this.cmd = p[0] >> 3; this.need = len; this.parts = [];
    }
    this.parts.push(p.slice(0, 16));
    if (this.parts.length < this.need) return;
    const data = new Uint8Array(this.need * 16);
    this.parts.forEach((q, i) => data.set(q, i * 16));
    const c = this.cmd; this.cmd = null; this.parts = [];
    this.command(c, data);
  }

  palCmd(d, a, b) {
    const w = i => d[i] | (d[i + 1] << 8);
    const c0 = w(1);
    this.pal[0] = this.pal[4] = this.pal[8] = this.pal[12] = c0;
    for (let i = 0; i < 3; i++) this.pal[a * 4 + 1 + i] = w(3 + i * 2);
    for (let i = 0; i < 3; i++) this.pal[b * 4 + 1 + i] = w(9 + i * 2);
  }
  attrFile(n) {
    if (n > 0x2C) return;
    for (let i = 0; i < 90; i++) { let byte = this.files[n * 90 + i]; for (let j = 0; j < 4; j++) { this.attr[i * 4 + j] = (byte >> 6) & 3; byte <<= 2; } }
  }

  command(c, d) {
    this.stats.commands++; this.stats.last = c.toString(16);
    switch (c) {
      case 0x00: this.palCmd(d, 0, 1); break;            // PAL01
      case 0x01: this.palCmd(d, 2, 3); break;            // PAL23
      case 0x02: this.palCmd(d, 0, 3); break;            // PAL03
      case 0x03: this.palCmd(d, 1, 2); break;            // PAL12
      case 0x04: {                                       // ATTR_BLK
        const n = d[1]; if (n > 0x12) return;
        for (let k = 0; k < n; k++) {
          const o = 2 + k * 6, ctl = d[o], pals = d[o + 1];
          let inside = ctl & 1, middle = ctl & 2, outside = ctl & 4;
          const pin = pals & 3, pout = (pals >> 4) & 3; let pmid = (pals >> 2) & 3;
          if (inside && !middle && !outside) { middle = 1; pmid = pin; }
          else if (outside && !middle && !inside) { middle = 1; pmid = pout; }
          const L = d[o + 2] & 31, T = d[o + 3] & 31, R = d[o + 4] & 31, B = d[o + 5] & 31;
          for (let y = 0; y < 18; y++) for (let x = 0; x < 20; x++) {
            if (x < L || x > R || y < T || y > B) { if (outside) this.attr[y * 20 + x] = pout; }
            else if (x > L && x < R && y > T && y < B) { if (inside) this.attr[y * 20 + x] = pin; }
            else if (middle) this.attr[y * 20 + x] = pmid;
          }
        }
        break;
      }
      case 0x05: {                                       // ATTR_LIN
        const n = d[1]; if (n > d.length - 2) return;
        for (let k = 0; k < n; k++) {
          const v = d[2 + k], pal = (v >> 5) & 3, line = v & 31;
          if (v & 0x80) { if (line < 18) for (let x = 0; x < 20; x++) this.attr[line * 20 + x] = pal; }
          else if (line < 20) for (let y = 0; y < 18; y++) this.attr[y * 20 + line] = pal;
        }
        break;
      }
      case 0x06: {                                       // ATTR_DIV
        const hi = d[1] & 3, lo = (d[1] >> 2) & 3, mid = (d[1] >> 4) & 3, horiz = d[1] & 0x40, line = d[2] & 31;
        for (let y = 0; y < 18; y++) for (let x = 0; x < 20; x++) {
          const v = horiz ? y : x;
          this.attr[y * 20 + x] = v < line ? lo : v === line ? mid : hi;
        }
        break;
      }
      case 0x07: {                                       // ATTR_CHR
        let x = d[1], y = d[2]; const count = d[3] | (d[4] << 8), dir = d[5];
        if (x >= 20 || y >= 18) break;
        for (let i = 0; i < count && 6 + (i >> 2) < d.length; i++) {
          this.attr[y * 20 + x] = (d[6 + (i >> 2)] >> (((~i) & 3) << 1)) & 3;
          if (dir) { if (++y === 18) { y = 0; if (++x === 20) break; } }
          else if (++x === 20) { x = 0; if (++y === 18) break; }
        }
        break;
      }
      case 0x0A: {                                       // PAL_SET
        const idx = k => d[1 + k * 2] | ((d[2 + k * 2] & 1) << 8);
        for (let p = 0; p < 4; p++) for (let i = 0; i < 4; i++) this.pal[p * 4 + i] = this.ram[idx(p) * 4 + i];
        this.pal[4] = this.pal[8] = this.pal[12] = this.pal[0];
        if (d[9] & 0x80) this.attrFile(d[9] & 0x3F);
        if (d[9] & 0x40) this.mask = 0;
        break;
      }
      case 0x0B: this.countdown = 3; this.dest = T_PAL; break;                   // PAL_TRN
      case 0x11: { const m = d[1] & 3; this.players = m === 0 ? 1 : m === 1 ? 2 : 4; break; }   // MLT_REQ (the core counts)
      case 0x13: this.countdown = 3; this.dest = (d[1] & 1) ? T_HIGH : T_LOW; break;   // CHR_TRN
      case 0x14: this.countdown = 3; this.dest = T_BORDER; break;                // PCT_TRN
      case 0x15: this.countdown = 3; this.dest = T_ATTR; break;                  // ATTR_TRN
      case 0x16: this.attrFile(d[1] & 0x3F); if (d[1] & 0x40) this.mask = 0; break;   // ATTR_SET
      case 0x17: this.mask = d[1] & 3; break;                                    // MASK_EN
      case 0x08: case 0x09: case 0x0C: case 0x0D: case 0x0E: case 0x0F: case 0x10: case 0x12: case 0x18: case 0x19: break;   // sound, SNES program, icons, OBJ: not done
      default: this.stats.unknown++;
    }
  }

  /* 4 KiB from the screen as the SNES reads it: the first 256 8 x 8 cells, 20 to a row,
     each as Game Boy tile bytes (plane 0, plane 1 per row). */
  grab(screen, into, bytes) {
    for (let t = 0, o = 0; t < 256 && o < bytes; t++) {
      const tx = (t % 20) * 8, ty = ((t / 20) | 0) * 8;
      for (let y = 0; y < 8 && o < bytes; y++) {
        let b0 = 0, b1 = 0; const row = (ty + y) * 160 + tx;
        for (let x = 0; x < 8; x++) { const s = screen[row + x] & 3; b0 |= (s & 1) << (7 - x); b1 |= ((s >> 1) & 1) << (7 - x); }
        into[o++] = b0; if (o < bytes) into[o++] = b1;
      }
    }
  }
  transfer(screen) {
    this.stats.transfers++;
    const buf = new Uint8Array(4096);
    this.grab(screen, buf, 4096);
    const u16 = i => buf[i] | (buf[i + 1] << 8);
    switch (this.dest) {
      case T_LOW: this.pendTiles.set(buf.subarray(0, 4096), 0); break;
      case T_HIGH: this.pendTiles.set(buf.subarray(0, 4096), 4096); break;
      case T_PAL: for (let i = 0; i < 2048; i++) this.ram[i] = u16(i * 2); break;
      case T_ATTR: this.files.set(buf.subarray(0, this.files.length)); break;
      case T_BORDER:
        for (let i = 0; i < 1024; i++) this.pendMap[i] = u16(i * 2);
        for (let i = 0; i < 64; i++) this.pendPal[i] = u16(0x800 + i * 2);
        // CONVERGENCE (SameBoy): the old border fades out, the new one in, swapped half way.
        this.anim = this.hasBorder ? 105 : 33;
        break;
    }
  }

  /* After each Game Boy frame: transfers, the mask, then the television picture. */
  frame(screen) {
    for (let i = 0; i < 23040; i++) this.live[i] = screen[i] & 3;
    if (this.countdown && --this.countdown === 0) this.transfer(this.live);
    if (this.mask !== 1) this.frozen.set(this.live);
    let fade = 0;
    if (this.anim) {
      this.anim--;
      if (this.anim === 32) { this.tiles.set(this.pendTiles); this.map.set(this.pendMap); this.bpal.set(this.pendPal); this.hasBorder = true; }
      fade = this.anim > 64 ? 0 : this.anim > 32 ? 64 - this.anim : this.anim;
    }
    this.draw(fade);
    return this.out;
  }

  draw(fade) {
    const out = this.out, col = new Uint32Array(16);
    for (let i = 0; i < 16; i++) col[i] = snesColour(this.pal[i]);
    const back = col[0];
    // the screen
    const src = this.frozen;
    for (let y = 0; y < 144; y++) {
      const o = (SGB_Y + y) * SGB_W + SGB_X, ar = ((y >> 3) * 20);
      if (this.mask === 2) { out.fill(0xFF000000, o, o + 160); continue; }
      if (this.mask === 3) { out.fill(back, o, o + 160); continue; }
      for (let x = 0; x < 160; x++) out[o + x] = col[this.attr[ar + (x >> 3)] * 4 + src[y * 160 + x]];
    }
    // the border: 32 x 28 tiles; colour 0 is the screen's colour 0 (and see-through over the screen)
    const bcol = new Uint32Array(64);
    for (let i = 0; i < 64; i++) { let c = this.bpal[i]; if (fade) c = fadeColour(c, fade); bcol[i] = snesColour(c); }
    for (let ty = 0; ty < 28; ty++) for (let tx = 0; tx < 32; tx++) {
      const inGb = tx >= 6 && tx < 26 && ty >= 5 && ty < 23;
      const e = this.hasBorder ? this.map[ty * 32 + tx] : 0x300;
      if (e & 0x300) {                                  // no tile: the backdrop
        if (!inGb) for (let y = 0; y < 8; y++) out.fill(this.hasBorder ? back : 0xFF000000, (ty * 8 + y) * SGB_W + tx * 8, (ty * 8 + y) * SGB_W + tx * 8 + 8);
        continue;
      }
      const tile = e & 0xFF, pal = (e >> 10) & 3, fx = (e & 0x4000) ? 0 : 7, fy = (e & 0x8000) ? 7 : 0;
      for (let y = 0; y < 8; y++) {
        const base = tile * 32 + (y ^ fy) * 2;
        const p0 = this.tiles[base], p1 = this.tiles[base + 1], p2 = this.tiles[base + 16], p3 = this.tiles[base + 17];
        const o = (ty * 8 + y) * SGB_W + tx * 8;
        for (let x = 0; x < 8; x++) {
          const bit = 1 << (x ^ fx);
          const c = ((p0 & bit) ? 1 : 0) | ((p1 & bit) ? 2 : 0) | ((p2 & bit) ? 4 : 0) | ((p3 & bit) ? 8 : 0);
          if (c === 0) { if (!inGb) out[o + x] = back; }
          else out[o + x] = bcol[pal * 16 + c];
        }
      }
    }
  }

  /* Everything above, for a save state: the SNES side is not in the core's context. */
  save() {
    const parts = [this.tiles, new Uint8Array(this.map.buffer), new Uint8Array(this.bpal.buffer), new Uint8Array(this.pal.buffer),
      new Uint8Array(this.ram.buffer), this.attr, this.files, Uint8Array.of(this.mask, this.players, this.hasBorder ? 1 : 0)];
    const n = parts.reduce((a, p) => a + p.length, 0), out = new Uint8Array(n);
    let o = 0; for (const p of parts) { out.set(p, o); o += p.length; }
    return out;
  }
  load(b) {
    const parts = [this.tiles, new Uint8Array(this.map.buffer), new Uint8Array(this.bpal.buffer), new Uint8Array(this.pal.buffer),
      new Uint8Array(this.ram.buffer), this.attr, this.files];
    const n = parts.reduce((a, p) => a + p.length, 0) + 3;
    if (!b || b.length !== n) return false;
    let o = 0; for (const p of parts) { p.set(b.subarray(o, o + p.length)); o += p.length; }
    this.mask = b[o]; this.players = b[o + 1]; this.hasBorder = !!b[o + 2];
    this.pendTiles.set(this.tiles); this.pendMap.set(this.map); this.pendPal.set(this.bpal);
    this.anim = 0; this.countdown = 0; this.cmd = null; this.parts = [];
    return true;
  }
}
export function sgbStateBytes() { return 256 * 32 + 2048 + 128 + 32 + 4096 + 360 + 4050 + 3; }

/* CONVERGENCE (SameBoy convert_rgb15_with_fade): each channel minus the fade, floored at 0. */
function fadeColour(c, f) {
  let r = (c & 31) - f, g = ((c >> 5) & 31) - f, b = ((c >> 10) & 31) - f;
  if (r < 0) r = 0; if (g < 0) g = 0; if (b < 0) b = 0;
  return r | (g << 5) | (b << 10);
}
