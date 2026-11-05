/*
 * play/cores/gb/sgb-border.mjs -- Nintendo's own default border, read at run time from the
 * player's own Super Game Boy SNES program (25 Oct 2026).
 *
 * Decided 25 Oct: the Super Game Boy shows what the real one shows: the game's own border when it
 * sends one, else the Super Game Boy's built-in border. That border is Nintendo's artwork inside the
 * SNES cartridge program (SGB1.sfc / SGB2.sfc), so it is never shipped: the game server serves the
 * player's own file (firmware slot 'sgb:snes') and this reads the border out of it. No file, no border:
 * plain black, as before.
 *
 * WHERE THE BORDER IS (MECHANISM: Nintendo's data, read in place; the layout was learned from
 * Gearboy src/SGB.cpp, GPL-3.0, read for the format only, no code taken; Gearboy reports its result
 * pixel-identical to what the real program leaves in video memory after boot, checked in Mesen-S):
 *   SGB1 (256 KB, CRC32 8a4a174f and the two other known revisions 2e35edbb, 27a03c98), LoROM:
 *     tiles   $03:D868, packed;  map  $04:EE6F, packed (2048 bytes);  colours $04:EFF1 + $80
 *   SGB2 (512 KB, CRC32 cb176e45): stored plain
 *     tiles   $0B:C2C0 (4096 bytes); map $0A:9800 (2048 bytes);       colours $0B:8000 + $80
 *   Colours: 64 SNES BGR555 words, the border's four palettes (SNES palettes 4 to 7).
 *   The map's palette field: the program's boot animation ends by moving the logo from palette 7 to
 *   palette 4, so palette 7 entries are shown as palette 4.
 * THE PACKING (SGB1, the program's routine at $01:83CA): word 0 is a marker, word 1 the packed
 * length less 8, word 3 the first output word; from byte 8, a word equal to the marker is followed
 * by a 16-bit offset into the output and a count byte (copy count words from that offset; count 0
 * means the marker word itself, as data), any other word is output as it is.
 * Checked on two local files: both draw the expected frame (the grey Game Boy
 * with "Nintendo Super GAME BOY" for SGB1; the Game Boy Pocket shape for SGB2).
 */

const LAYOUTS = [
  { crc: 0x8A4A174F, size: 0x40000, tiles: 0x03D868, map: 0x04EE6F, pal: 0x04EFF1, packed: true },
  { crc: 0x2E35EDBB, size: 0x40000, tiles: 0x03D868, map: 0x04EE6F, pal: 0x04EFF1, packed: true },
  { crc: 0x27A03C98, size: 0x40000, tiles: 0x03D868, map: 0x04EE6F, pal: 0x04EFF1, packed: true },
  { crc: 0xCB176E45, size: 0x80000, tiles: 0x0BC2C0, map: 0x0A9800, pal: 0x0B8000, packed: false },
];

let CRC_T = null;
function crc32(b) {
  if (!CRC_T) {
    CRC_T = new Uint32Array(256);
    for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1); CRC_T[n] = c >>> 0; }
  }
  let c = 0xFFFFFFFF;
  for (let i = 0; i < b.length; i++) c = CRC_T[(c ^ b[i]) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}
const lorom = a => ((a >>> 16) & 0x7F) * 0x8000 + ((a & 0xFFFF) - 0x8000);
const u16 = (b, o) => b[o] | (b[o + 1] << 8);

/* The SGB1 program's word packing, into at most `max` bytes; null if it does not read cleanly. */
function unpack(prog, off, max) {
  if (off < 0 || off + 8 > prog.length) return null;
  const marker = u16(prog, off), end = u16(prog, off + 2) + 8;
  if (off + end + 5 > prog.length) return null;
  const out = new Uint8Array(max);
  out[0] = prog[off + 6]; out[1] = prog[off + 7];
  let n = 2;
  for (let i = 8; i < end;) {
    const w = u16(prog, off + i);
    const count = w === marker ? prog[off + i + 4] : 0;
    if (w !== marker || count === 0) {
      if (n + 2 > max) return null;
      out[n] = prog[off + i]; out[n + 1] = prog[off + i + 1]; n += 2;
      i += w === marker ? 5 : 2;
      continue;
    }
    const from = u16(prog, off + i + 2);
    if (from + 2 > n || n + count * 2 > max) return null;
    for (let c = 0; c < count * 2; c++) out[n + c] = out[from + c];
    n += count * 2; i += 5;
  }
  return out.subarray(0, n);
}

/** The default border in `bytes` (an SGB1 or SGB2 SNES program), as the SuperGameBoy class keeps
 *  one: { tiles: Uint8Array(8192), map: Uint16Array(1024), pal: Uint16Array(64), which }, or null
 *  for any other file or one that does not read cleanly. */
export function biosBorder(bytes, frame) {
  if (!bytes || !bytes.length) return null;
  const L = LAYOUTS.find(l => l.size === bytes.length && l.crc === crc32(bytes));
  if (!L) return null;
  if (frame && frame !== 'default') return builtinBorder(bytes, L.crc, frame);
  const tiles = new Uint8Array(256 * 32), mapB = new Uint8Array(2048);
  const t = lorom(L.tiles), m = lorom(L.map), p = lorom(L.pal) + 0x80;
  if (L.packed) {
    const tt = unpack(bytes, t, tiles.length), mm = unpack(bytes, m, mapB.length);
    if (!tt || !mm || mm.length !== mapB.length) return null;
    tiles.set(tt); mapB.set(mm);
  } else {
    if (t + 0x1000 > bytes.length || m + 2048 > bytes.length) return null;
    tiles.set(bytes.subarray(t, t + 0x1000)); mapB.set(bytes.subarray(m, m + 2048));
  }
  if (p + 128 > bytes.length) return null;
  const map = new Uint16Array(1024);
  for (let i = 0; i < 1024; i++) {
    let hi = mapB[i * 2 + 1];
    if ((hi & 0x1C) === 0x1C) hi = (hi & ~0x1C) | 0x10;       // palette 7 -> palette 4 (the logo, after the boot animation)
    map[i] = mapB[i * 2] | (hi << 8);
  }
  const pal = new Uint16Array(64);
  for (let i = 0; i < 64; i++) pal[i] = u16(bytes, p + i * 2);
  return { tiles, map, pal, which: L.size === 0x80000 ? 'Super Game Boy 2' : 'Super Game Boy' };
}

/* ============================================================================================
 * THE OTHER BUILT-IN BORDERS (26 Oct 2026). On a real Super Game Boy the player picks a
 * border from the SNES program's own menu (L and R together, then the picture-frame icon): the
 * default, a black one, and seven pictures. Each is placed by its own routine in the program (a
 * table of loaders at SGB1 $01:8071, indexed by the border number at $0C03; SGB2 patches them in
 * bank $08), so neither the layout nor the colours can be read from one fixed place.
 *
 * HOW THESE STEPS WERE FOUND (MECHANISM: the program's own steps, observed; no Nintendo data is in
 * this file, only addresses): the SGB1 and SGB2 programs were run offline on a small 65816
 * interpreter written for this, driven through the program's own menu to each border, recording
 * every step the program took: its unpacking routine ($01:D6C8: packed data at $C0-$C2 into work
 * memory at $C3-$C5, the same packing as the default border above), every transfer into the
 * border's video memory (tiles at words $0000-$0FFF, map at $3C00, by $01:D65C or the SGB2
 * patches' own transfers), and the palette pointer its fade-in reads ($C9-$CB; the border's four
 * palettes 4-7 are the 64 colours at pointer + $80, as for the default). The steps below replay
 * exactly those, in the program's order, from the firmware the player supplies.
 * Checked: for every border of both programs, the picture built here is pixel-identical to the one
 * the program itself left on screen in that run (tiles, map and the colours after its fade-in), and
 * every border is static (no animation: 40 samples over 60 s identical). One SGB1 border (Windows and
 * clouds) draws its clouds as sprites copied from a table; they are replayed as a layer over the
 * border with the console's priority rule (see obj below). Two SGB1 borders change
 * when the menu closes (the windows open, the audience settles): their steps include the program's
 * own menu-closing steps, so the border is the one seen while playing. Only these two program
 * revisions were run; the other two SGB1 revisions keep the default border only.
 * The Gears border (SGB2) uses 384 tile places; the picture uses at most 256 different tiles, so
 * they are renumbered into the 256 places the Super Game Boy border keeps (the same picture).
 *   ['u', src, dst]           unpack the packed block at SNES address src into work memory at dst
 *   ['d', src, vaddr, bytes]  copy bytes from src (work memory $7E/$7F, else the program) to video word vaddr
 */
const BUILTIN = {
  0x8A4A174F: [   // SGB1
    { id: 'black', label: 'Black', ops: [['d', 0x028E50, 0x0000, 64], ['d', 0x028E90, 0x3C00, 2048]], pal: 0x028250 },
    { id: 'f3', label: 'Windows and clouds', ops: [['u', 0x038000, 0x7ECCF8], ['d', 0x7ECCF8, 0x0000, 2048], ['d', 0x7ED4F8, 0x0400, 2048],
      /* the clouds are sprites: */ ['u', 0x039A4B, 0x7ECCF8], ['d', 0x7ECCF8, 0x5000, 2048], ['d', 0x7ED4F8, 0x5400, 2048], ['d', 0x7EDCF8, 0x5800, 2048], ['d', 0x7EE4F8, 0x5C00, 2048],
      ['u', 0x03AEA5, 0x7ECCF8], ['d', 0x7ECCF8, 0x3C00, 2048],
      /* menu closed: */ ['u', 0x03AEA5, 0x7ECCF8], ['d', 0x7ED4F8, 0x3C00, 2048]], pal: 0x03B474,
      /* sprites 96-127 copied from $02:D2AD ($01:9C9F), all large ($AA size bits, $01:9CAC); OBJ colours: 8 palettes from
         $03:B574 to CGRAM 128 ($01:D62A, on menu close); OBJ settings $2101 = $02 (8/16 pixels, names at word $4000, second table $5000) */
      obj: { oam: 0x02D2AD, first: 96, count: 32, hi: 0xAA, cg: 0x03B574, cgBytes: 256, obsel: 0x02 } },
    { id: 'f4', label: 'Cork board', ops: [['u', 0x04D335, 0x7ECCF8], ['d', 0x7ECCF8, 0x0000, 4096], ['u', 0x04DF12, 0x7ECCF8], ['d', 0x7ECCF8, 0x3C00, 2048]], pal: 0x04E09C },
    { id: 'f5', label: 'Sign in a forest', ops: [['u', 0x03B674, 0x7ECCF8], ['d', 0x7ECCF8, 0x0000, 2048], ['d', 0x7ED4F8, 0x0400, 2048], ['d', 0x7EDCF8, 0x0800, 2048], ['d', 0x7EE4F8, 0x0C00, 2048], ['u', 0x03C660, 0x7ECCF8], ['d', 0x7ECCF8, 0x3C00, 2048]], pal: 0x03D568 },
    /* f6, the Theatre, is NOT offered: its audience are sprites placed and moved by the program's own
       code ($01:D0F8-$01:D107, run thousands of times per minute), not copied from a table, so they
       cannot be replayed from addresses. Its picture without the audience
       read cleanly: load ['u', 0x05C6C8, 0x7ECCF8], ['d', 0x7ECCF8, 0x0000, 4096], ['u', 0x05DC3C,
       0x7ECCF8], ['d', 0x7ECCF8, 0x3C00, 2048]; menu closed ['d', 0x7ED478, 0x3F00, 128]; colours $05:D83C. */
    { id: 'f7', label: 'Cats', ops: [['u', 0x03F716, 0x7ECCF8], ['d', 0x7ECCF8, 0x0000, 2048], ['u', 0x048B27, 0x7E2000], ['d', 0x7E2000, 0x3C00, 2048]], pal: 0x048D73 },
    { id: 'f8', label: 'Desk', ops: [['u', 0x058000, 0x7ECCF8], ['d', 0x7ECCF8, 0x0000, 4096], ['d', 0x7EDCF8, 0x0800, 4096], ['u', 0x05997A, 0x7E2000], ['d', 0x7E2000, 0x3C00, 2048]], pal: 0x059BA1 },
    { id: 'f9', label: 'Stairs', ops: [['u', 0x03E90A, 0x7ECCF8], ['d', 0x7ECCF8, 0x0000, 4096], ['u', 0x03E3CD, 0x7EECF8], ['d', 0x7EECF8, 0x3C00, 2048]], pal: 0x03E70A },
  ],
  0xCB176E45: [   // SGB2
    { id: 'black', label: 'Black', ops: [['d', 0x028E50, 0x0000, 64], ['d', 0x028E90, 0x3C00, 2048]], pal: 0x028250 },
    { id: 'f3', label: 'Circuit board', ops: [['d', 0x0B9100, 0x0000, 4096], ['d', 0x0BA100, 0x0800, 4096], ['d', 0x0AA000, 0x3C00, 2048]], pal: 0x0AF000 },
    { id: 'f4', label: 'Palm trees', ops: [['d', 0x0CB000, 0x0000, 4096], ['d', 0x0CC000, 0x0800, 4096], ['d', 0x0CF000, 0x3C00, 2048]], pal: 0x0CF800 },
    { id: 'f5', label: 'Tiled wall', ops: [['d', 0x09E000, 0x0000, 4096], ['d', 0x09F000, 0x0800, 4096], ['d', 0x0AA800, 0x3C00, 2048]], pal: 0x0AF400 },
    { id: 'f6', label: 'Gears', ops: [['d', 0x0D8000, 0x0000, 4096], ['d', 0x0D9000, 0x0800, 4096], ['d', 0x0DA000, 0x1000, 4096], ['d', 0x0DD800, 0x1800, 2048], ['d', 0x0DD000, 0x3C00, 2048]], pal: 0x0CFA00 },
    { id: 'f7', label: 'Swamp', ops: [['d', 0x098000, 0x0000, 4096], ['d', 0x099000, 0x0800, 4096], ['d', 0x0AB000, 0x3C00, 2048]], pal: 0x0AFA00 },
    { id: 'f8', label: 'Dolphins', ops: [['d', 0x0BCCC0, 0x0000, 4096], ['d', 0x0BDCC0, 0x0800, 2048], ['d', 0x0AB800, 0x3C00, 2048]], pal: 0x0AFC00 },
    { id: 'f9', label: 'Temple', ops: [['d', 0x0A8000, 0x0000, 4096], ['d', 0x0A9000, 0x0800, 2048], ['d', 0x0AC800, 0x3C00, 2048]], pal: 0x0AF800 },
  ],
};

/** The built-in borders this SNES program offers besides its default, as [{ id, label }] (empty for
 *  any other file). The play window lists them in its Display settings. */
export function builtinBorders(bytes) {
  if (!bytes || !bytes.length) return [];
  const crc = crc32(bytes);
  const L = LAYOUTS.find(l => l.size === bytes.length && l.crc === crc);
  return L && BUILTIN[crc] ? BUILTIN[crc].map(b => ({ id: b.id, label: b.label })) : [];
}

/* Replay one border's steps; null if the file does not read cleanly. */
function builtinBorder(bytes, crc, frame) {
  const B = (BUILTIN[crc] || []).find(b => b.id === frame);
  if (!B) return null;
  const wram = new Uint8Array(0x20000), vram = new Uint8Array(0x10000);
  for (const op of B.ops) {
    if (op[0] === 'u') {
      const out = unpack(bytes, lorom(op[1]), 0x10000), at = op[2] - 0x7E0000;
      if (!out || at < 0 || at + out.length > wram.length) return null;
      wram.set(out, at);
    } else {
      const [, src, vaddr, n] = op, bank = src >>> 16;
      let from;
      if (bank === 0x7E || bank === 0x7F) { const at = src - 0x7E0000; from = wram.subarray(at, at + n); }
      else { const at = lorom(src); if (at < 0 || at + n > bytes.length || (src & 0xFFFF) + n > 0x10000) return null; from = bytes.subarray(at, at + n); }
      if (from.length !== n) return null;
      vram.set(from, vaddr * 2);
    }
  }
  const p = lorom(B.pal) + 0x80;
  if (p < 0 || p + 128 > bytes.length) return null;
  /* The map's tile numbers are 10 bits; the border kept by the play window has 256 tile places, so
     the tiles the visible 32 x 28 map uses are renumbered in order of first use. */
  const tiles = new Uint8Array(256 * 32), map = new Uint16Array(1024), pal = new Uint16Array(64), seen = new Map();
  for (let i = 0; i < 1024; i++) {
    const e = vram[0x7800 + i * 2] | (vram[0x7800 + i * 2 + 1] << 8), t = e & 0x3FF;
    if (i >= 32 * 28) { map[i] = 0; continue; }
    let k = seen.get(t);
    if (k === undefined) { k = seen.size; if (k >= 256) return null; seen.set(t, k); tiles.set(vram.subarray(t * 32, t * 32 + 32), k * 32); }
    map[i] = (e & 0xFC00) | k;
  }
  for (let i = 0; i < 64; i++) pal[i] = u16(bytes, p + i * 2);
  const obj = B.obj ? objLayer(bytes, B.obj, vram, map, tiles, pal) : null;
  if (B.obj && !obj) return null;
  return { tiles, map, pal, obj, which: B.label };
}

/* The sprite layer of a built-in border, 256 x 224 (0 = no sprite pixel there), as the console draws it:
   16 x 16 large sprites (OBJ settings $02), the name-table bit choosing the second table; a sprite's
   first line is the line after its Y (the console draws sprites one line lower); priority as in
   mode 1: a sprite of priority 2 or 3 shows over border tiles without the priority bit, priority 3 over
   all of them; lower priorities only where the border is see-through. The OAM layout (4 bytes per
   sprite, two size/position bits each in the high table) is the console's. */
const abgr = c => { const r = c & 31, g = (c >> 5) & 31, b = (c >> 10) & 31; return ((0xFF << 24) | (((b << 3) | (b >> 2)) << 16) | (((g << 3) | (g >> 2)) << 8) | ((r << 3) | (r >> 2))) >>> 0; };
function objLayer(bytes, O, vram, map, tiles, pal) {
  const oam = lorom(O.oam), cg = lorom(O.cg);
  if (oam < 0 || oam + O.count * 4 > bytes.length || cg < 0 || cg + O.cgBytes > bytes.length) return null;
  const W = 256, H = 224, out = new Uint32Array(W * H);
  const small = [8, 8, 8, 16, 16, 32, 16, 16][O.obsel >> 5], large = [16, 32, 64, 32, 64, 64, 32, 32][O.obsel >> 5];
  const base = (O.obsel & 7) << 13, second = (((O.obsel >> 3) & 3) + 1) << 12;
  const vw = a => vram[(a & 0x7FFF) * 2] | (vram[(a & 0x7FFF) * 2 + 1] << 8);
  /* the border's own pixel and its priority bit, to apply the console's layer order */
  const bgAt = (x, y) => { const e = map[(y >> 3) * 32 + (x >> 3)]; let px = x & 7, py = y & 7; if (e & 0x4000) px = 7 - px; if (e & 0x8000) py = 7 - py;
    const t = (e & 0xFF) * 32 + py * 2, sh = 7 - px; const v = ((tiles[t] >> sh) & 1) | (((tiles[t + 1] >> sh) & 1) << 1) | (((tiles[t + 16] >> sh) & 1) << 2) | (((tiles[t + 17] >> sh) & 1) << 3);
    return { v, prio: (e >> 13) & 1 }; };
  for (let k = O.count - 1; k >= 0; k--) {          // lower sprite numbers are drawn over higher ones
    const i = O.first + k, o = oam + k * 4, hiBits = (O.hi >> ((i & 3) * 2)) & 3;
    const x0 = bytes[o] | ((hiBits & 1) << 8), y0 = bytes[o + 1], at = bytes[o + 3], size = hiBits & 2 ? large : small;
    const t0 = bytes[o + 2], table = at & 1 ? base + second : base, cpal = (at >> 1) & 7, prio = (at >> 4) & 3;
    for (let yy = 0; yy < size; yy++) for (let xx = 0; xx < size; xx++) {
      const x = (x0 + xx) & 511, y = (y0 + 1 + yy) & 255;
      if (x >= W || y >= H) continue;
      const sx = at & 0x40 ? size - 1 - xx : xx, sy = at & 0x80 ? size - 1 - yy : yy;
      const tile = ((t0 & 0xF0) + (((t0 & 0x0F) + (sx >> 3)) & 0x0F) + ((sy >> 3) << 4)) & 0xFF;
      const ta = table + tile * 16, px = sx & 7, py = sy & 7;
      const w0 = vw(ta + py), w1 = vw(ta + 8 + py), sh = 7 - px;
      const v = ((w0 >> sh) & 1) | (((w0 >> (sh + 8)) & 1) << 1) | (((w1 >> sh) & 1) << 2) | (((w1 >> (sh + 8)) & 1) << 3);
      if (!v) continue;
      const bg = bgAt(x, y);
      if (bg.v && !(prio === 3 || (prio === 2 && !bg.prio))) continue;
      out[y * W + x] = abgr(u16(bytes, cg + (cpal * 16 + v) * 2));
    }
  }
  return out;
}
