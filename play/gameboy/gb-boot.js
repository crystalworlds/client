/* gb-boot.js: our own Game Boy start-up programs, with the CrystalWorlds logo.
 *
 * WHAT THEY ARE FOR. A Game Boy runs a small start-up program before the cartridge: it shows a logo, plays
 * a chime and leaves the machine in a known state for the game. When a visitor has not added the console's
 * own program, the site runs these instead (the order: the console's own, any manufacturer one, ours, none).
 *
 * THE RULE. At the hand-over each program leaves the machine as the console's own leaves it, on the same
 * cycle: processor registers, every I/O register including the sound unit's inner state, the divider and
 * the timer, the picture unit's place in the frame, interrupt flags, work RAM and high RAM. The numbers
 * they aim at (the cycle of each moment that leaves a trace, and the values left behind) were measured on
 * the console's own programs in this site's core; no part of those programs is used here. Every byte below
 * is emitted by the assembler in this file.
 *
 * WHAT DIFFERS, ON PURPOSE. Video memory holds our letters instead of the console's logo; there is no
 * cartridge logo check (every cartridge starts). The Color's work RAM bank 2 does not hold the console's
 * copy of its own palette table. The noise channel keeps a stored value it never reads before a game
 * starts the channel. The tests in tools/gb_boot_equiv.mjs list every difference, model by model.
 *
 * THE ORIGINAL GAME BOY'S PROGRAM IS 256 BYTES, too few for the letters' shapes and the exact hand-over
 * together, so the site places the letter pictures in video memory before the program starts (`vram`
 * below) and the program does everything else: the scroll, the chime, the sparkles, the fade.
 *
 * THE FIRST PROGRAMS. The original Game Boy's first program (DMG 0) and the Color's first (Color 0) hand over at
 * other moments and leave a few other values, so each has a kind of its own ('dmg0', 'cgb0'), with the same look
 * and sound, measured the same way.
 *
 * NO DOM, NO CORE, NO I/O: functions from a cartridge and a model to bytes.
 */
import { cgbAssignmentFor, hexToRgb } from "./cgb-assign.js";
import { CGB_MANUAL } from "./cgb-palettes.js";
/* a combination's name ("A + Down") as the core's button bits: A 0, B 1, Select 2, Start 3, Right 4, Left 5, Up 6, Down 7 */
const comboMask = (name) => name.split("+").map((x) => x.trim()).reduce((m, b) => m | { A: 1, B: 2, Right: 0x10, Left: 0x20, Up: 0x40, Down: 0x80 }[b], 0);


/* ---------------------------------------------------------------- assembler */
export function assemble(build, size) {
  let pass, out, labels = {}, prev = {};
  const A = {
    get pc() { return out.length; },
    get final() { return pass === 3; },
    label(n) { labels[n] = out.length; },
    L(n) { const v = prev[n]; if (pass === 3 && v == null) throw new Error("gb-boot: no label " + n); return v ?? 0; },
    db(...b) { for (const v of b.flat()) out.push(v & 0xff); },
    dw(v) { out.push(v & 0xff, (v >> 8) & 0xff); },
    rel(n) { const d = A.L(n) - (out.length + 1); if (pass === 3 && (d < -128 || d > 127)) throw new Error("gb-boot: jump too far to " + n); out.push(d & 0xff); },
    at(addr) { if (out.length > addr) { if (pass === 3) throw new Error(`gb-boot: program reaches $${out.length.toString(16)}, past $${addr.toString(16)}`); return; } while (out.length < addr) out.push(0); },
  };
  /* three passes: labels settle once every block knows the size of the ones after it */
  for (pass = 1; pass <= 3; pass++) { out = []; labels = {}; build(A); prev = labels; }
  if (out.length > size) throw new Error(`gb-boot: ${out.length} bytes, room for ${size}`);
  return { bytes: Uint8Array.from(out), labels };
}

/* The few instructions the programs use, by name. */
export function ops(A) {
  const O = {
    ldSP: (n) => A.db(0x31, n & 255, n >> 8), ldHL: (n) => A.db(0x21, n & 255, n >> 8),
    ldDE: (n) => A.db(0x11, n & 255, n >> 8), ldBC: (n) => A.db(0x01, n & 255, n >> 8),
    ldA: (n) => A.db(0x3e, n), ldB: (n) => A.db(0x06, n), ldC: (n) => A.db(0x0e, n), ldD: (n) => A.db(0x16, n),
    ldE: (n) => A.db(0x1e, n), ldH: (n) => A.db(0x26, n), ldL: (n) => A.db(0x2e, n),
    ldhW: (r) => A.db(0xe0, r), ldhR: (r) => A.db(0xf0, r), put: (r, v) => { A.db(0x3e, v, 0xe0, r); },
    ldHLn: (n) => A.db(0x36, n), call: (l) => { A.db(0xcd); A.dw(A.L(l)); }, ret: () => A.db(0xc9),
    jr: (l) => { A.db(0x18); A.rel(l); }, jrnz: (l) => { A.db(0x20); A.rel(l); }, jrz: (l) => { A.db(0x28); A.rel(l); },
    jrnc: (l) => { A.db(0x30); A.rel(l); }, jrc: (l) => { A.db(0x38); A.rel(l); },
  };
  return O;
}

/* ------------------------------------------------------------------ the logo */
/* 5 x 7 capitals, drawn at double size: CRYSTAL over WORLDS. */
export const GLYPHS = {
  C: [".###.", "#...#", "#....", "#....", "#....", "#...#", ".###."], R: ["####.", "#...#", "#...#", "####.", "#.#..", "#..#.", "#...#"],
  Y: ["#...#", "#...#", ".#.#.", "..#..", "..#..", "..#..", "..#.."], S: [".####", "#....", "#....", ".###.", "....#", "....#", "####."],
  T: ["#####", "..#..", "..#..", "..#..", "..#..", "..#..", "..#.."], A: [".###.", "#...#", "#...#", "#####", "#...#", "#...#", "#...#"],
  L: ["#....", "#....", "#....", "#....", "#....", "#....", "#####"], W: ["#...#", "#...#", "#...#", "#.#.#", "#.#.#", "##.##", "#...#"],
  O: [".###.", "#...#", "#...#", "#...#", "#...#", "#...#", ".###."], D: ["####.", "#...#", "#...#", "#...#", "#...#", "#...#", "####."],
};
const SCALE = 2;
/* Where each letter sits on the 160 x 144 screen, and the four sparkle points. */
export function logoLayout() {
  const a = "CRYSTAL", b = "WORLDS", S = SCALE, H = 144, W = 160, out = [];
  const wa = (a.length * 6 - 1) * S, wb = (b.length * 6 - 1) * S, hh = 7 * S * 2 + 4;
  const ya = Math.floor((H - hh) / 2), yb = ya + 7 * S + 4;
  /* One pixel right of centre: even columns keep each double-size pixel inside one tile byte. */
  const xa = Math.floor((W - wa) / 2) + 1, xb = Math.floor((W - wb) / 2) + 1;
  for (let i = 0; i < a.length; i++) out.push({ ch: a[i], x: xa + i * 6 * S, y: ya, line: 0, i });
  for (let j = 0; j < b.length; j++) out.push({ ch: b[j], x: xb + j * 6 * S, y: yb, line: 1, i: a.length + j });
  return { letters: out, box: { x: xa, y: ya, w: wa, h: hh },
    sparks: [[xa - 3, ya - 3], [xa + wa + 2, ya + 12], [xb - 4, ya + hh + 2], [xb + wb + 3, ya + hh - 4]] };
}

/* A 160 x 144 picture of palette indices: the letters (index per line) and the sparkles. */
function logoPicture(idx) {
  const L = logoLayout(), pic = new Uint8Array(160 * 144);
  for (const l of L.letters) {
    const g = GLYPHS[l.ch];
    for (let r = 0; r < 7; r++) for (let c = 0; c < 5; c++) if (g[r][c] === "#")
      for (let dy = 0; dy < SCALE; dy++) for (let dx = 0; dx < SCALE; dx++) pic[(l.y + r * SCALE + dy) * 160 + l.x + c * SCALE + dx] = idx[l.line];
  }
  if (idx.spark) for (const [x, y] of L.sparks) for (let d = -2; d <= 2; d++) { pic[y * 160 + x + d] = idx.spark; pic[(y + d) * 160 + x] = idx.spark; }
  return pic;
}

/* The picture as tiles and a map: only the tiles that hold something, numbered from 1. */
function toTiles(pic) {
  const tiles = [new Uint8Array(16)], map = new Uint8Array(32 * 18), key = new Map([["0".repeat(32), 0]]);
  for (let ty = 0; ty < 18; ty++) for (let tx = 0; tx < 20; tx++) {
    const t = new Uint8Array(16);
    for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
      const v = pic[(ty * 8 + r) * 160 + tx * 8 + c];
      if (v & 1) t[r * 2] |= 0x80 >> c;
      if (v & 2) t[r * 2 + 1] |= 0x80 >> c;
    }
    const k = Array.from(t, (b) => b.toString(16).padStart(2, "0")).join("");
    if (!key.has(k)) { key.set(k, tiles.length); tiles.push(t); }
    map[ty * 32 + tx] = key.get(k);
  }
  if (tiles.length > 256) throw new Error("gb-boot: logo needs too many tiles");
  const data = new Uint8Array(tiles.length * 16); tiles.forEach((t, i) => data.set(t, i * 16));
  return { data, map };
}

/* ------------------------------------------------------- the original Game Boy */
/* Measured on the console's own start-up program in this core (numbers, not code): the cycle of each
   moment that leaves a trace in the machine, and the registers at hand-over. Cycles count from power-on. */
export const DMG_PROFILES = {
  dmg: { lcdOn: 266468, apuOn: 229436, ding1: 17467324, ding2: 17818480, handover: 23440324,
         a: 0x01, bc: 0x0013, de: 0x00d8, hl: 0x014d, flags: "dmg", stack: [0x2e, 0x00, 0x39, 0x01] },
  /* the first program (DMG 0): the screen on later, a longer logo, every flag clear whatever the cartridge, and no
     registered mark beside the logo. Measured on the core's original Game Boy, as the core has no first-board model. */
  dmg0: { lcdOn: 269944, apuOn: 229436, ding1: 18523904, ding2: 18875268, handover: 24844328,
         a: 0x01, bc: 0xff13, de: 0x00c1, hl: 0x8403, flags: "clear", stack: [0x73, 0x00, 0x39, 0x01], noMark: true },
};

/* The waits that put our program's moments on those cycles (in cycles, and in frames for the long holds).
   tools/gb_boot_equiv.mjs checks them against the console's own program. */
const DMG_CAL = { l: 266208, p: 138928, t1: 1804, t2: 351120, h: 872, waitP: 27, waitF: 65 };
const DMG0_CAL = { l: 269684, p: 130668, t1: 9808, t2: 351328, h: 67164, waitP: 42, waitF: 69 };


/* The 16-cycle delay loop at $10 (dec c; jr nz / dec b; jr nz; ret): the b, c and the number of
   one-step pauses k before `rst $10` that make `ld bc,nn` through the return take exactly v cycles. */
export function delayFor(v, callT = 16) {
  for (let b0 = 1; b0 <= 256; b0++) for (let k = 0; k <= 3; k++) {
    const rest = v - 12 - 4 * k - callT - 16 - (4108 * b0 - 4100);
    if (rest % 16 === 0 && rest / 16 >= 1 && rest / 16 <= 256) { const c0 = rest / 16; return { bc: ((b0 & 255) << 8) | (c0 & 255), k }; }
  }
  throw new Error("gb-boot: no delay of " + v + " cycles");
}

/**
 * The start-up program for the Game Boy family.
 * @returns {{ bios: Uint8Array, vram: Array<[number, Uint8Array]> }}  the 256-byte program, and the
 *   pictures the site places in video memory before the program starts.
 */
export function dmgBoot(model = "dmg", cal = DMG_CAL, cart = null) {
  const P = DMG_PROFILES[model === "mgb" ? "dmg" : model] || DMG_PROFILES.dmg;
  const regA = model === "mgb" ? 0xff : P.a;
  const prog = assemble((A) => {
    const O = ops(A);
    const RST = { waitn: 0xcf, dly: 0xd7, note: 0xdf };        // rst $08, $10, $18
    const wait = (n) => { O.ldB(n); A.db(RST.waitn); };
    /* a wait of exactly v cycles from the start of `ld bc` to the return (v a multiple of 4) */
    const pad = (v) => { const d = delayFor(v); O.ldBC(d.bc); for (let i = 0; i < d.k; i++) A.db(0x00); A.db(RST.dly); };
    O.ldSP(0xfffe); O.jr("main");
    /* ---- routines, on the restart addresses so each call is one byte ---- */
    A.at(0x08); A.db(0xaf); O.ldhW(0x0f); A.db(0x76, 0x05); A.db(0x20, 0xf9); O.ret();     // clear IF, halt until the blank, b times
    A.at(0x10); A.label("dly"); A.db(0x0d); O.jrnz("dly"); A.db(0x05); O.jrnz("dly"); A.label("ret"); O.ret();   // dec c / dec b
    A.at(0x18); O.ldHLn(0x7f); A.db(0x2c, 0x72, 0x2c, 0x73, 0x2c); O.ldHLn(0x87); O.ret();     // a note: duty, envelope d, frequency e, start
    A.label("apu"); O.ldHL(0xff26); O.ldHLn(0x00); O.call("ret"); A.db(0x00);
    O.ldHLn(0x80); A.db(0x2d, 0x72, 0x2d); O.ldHLn(0x77); O.ret();   // sound off, a pause, on; NR51 = d; NR50
    /* the main part ends exactly where the hand-over instruction starts, so no filler runs */
    A.at(0xfe - (A.L("fin") - A.L("main")));
    A.label("main");
    O.ldD(0xf3); O.call("apu");                         // sound on, both pulse channels to both sides
    O.put(0x42, 88);                                    // the letters start above the screen
    O.put(0x47, 0xe0);                                  // letters dark, sparkles hidden
    O.put(0xff, 0x01);                                  // the blank wakes the processor from its wait
    pad(cal.l);                                         // the screen comes on when Nintendo's does
    O.put(0x40, 0x99);                                  // our letters in the second map; the first holds what is left for the game
    A.label("scroll"); wait(2); O.ldhR(0x42); A.db(0x3d); O.ldhW(0x42); O.jrnz("scroll");
    /* the bell with a fifth: 1760 Hz now, 2637 Hz a moment later */
    O.ldHL(0xff11); O.ldDE(0xf4b6); A.db(RST.note);
    wait(4);
    O.ldL(0x16); O.ldDE(0x94ce); A.db(RST.note);
    /* sparkles: index 1 steps through its shades, three times */
    O.ldD(12);
    A.label("spk"); A.db(0x15, 0x7a, 0x87, 0x87, 0xe6, 0x0c, 0xf6, 0xe0); O.ldhW(0x47);   // dec d; ld a,d; add a,a; add a,a; and $0C; or $E0
    wait(3); A.db(0x7a, 0xa7); O.jrnz("spk");                                            // ld a,d; and a
    O.ldHLn(0x40);                                      // channel 2's length runs out (HL still points at NR24)
    wait(cal.waitP);
    /* the sound unit, restarted so it ends where Nintendo's leaves it; the mixer keeps channel 1 quiet */
    pad(cal.p); O.ldD(0xe2); O.call("apu");
    O.ldL(0x11); O.ldHLn(0x80); A.db(0x2c); O.ldHLn(0xf3);
    pad(cal.t1); A.db(0x2c); O.ldHLn(0x83); A.db(0x2c, 0x00); O.ldHLn(0x87);   // NR13, NR14 twenty cycles later
    pad(cal.t2); A.db(0x2d); O.ldHLn(0xc1); A.db(0x2c, 0x00); O.ldHLn(0x87);
    wait(cal.waitF);
    /* fade: both shades down a step at a time */
    O.ldE(0xe0);
    A.label("fade"); A.db(0x7b, 0xd6, 0x50, 0x30, 0x01, 0xaf, 0x5f); O.ldhW(0x47);   // ld a,e; sub $50; jr nc,+1; xor a; ld e,a
    O.ldB(5); A.db(0x20, 0x02); O.ldB(3); A.db(0xcf); A.db(0x7b, 0xa7); O.jrnz("fade");   // white: 3 frames here, 2 more below, as before
    /* our letters out of video memory over three blanks (the part in work RAM, below), then that part wiped */
    A.db(0xcd); A.dw(WRAM_PART); A.db(0xaf); O.ldhW(0xff); O.ldHL(WRAM_PART); O.ldB(WRAM_LEN);
    A.label("clr"); A.db(0x22, 0x05); O.jrnz("clr");
    O.put(0x47, 0xfc); O.put(0x25, 0xf3);
    pad(cal.h);
    /* the stack as Nintendo's leaves it */
    O.ldBC(P.stack[0] | (P.stack[1] << 8)); A.db(0xc5); O.ldBC(P.stack[2] | (P.stack[3] << 8)); A.db(0xc5, 0xc1, 0xc1);
    if (P.flags === "clear") { O.ldA(regA); A.db(0xb7); O.ldBC(P.bc); O.ldDE(P.de); O.ldHL(P.hl); }   // or a: every flag clear
    else {
    /* flags as the header check leaves them: the checksum byte added to its own negative (zero set; carry unless
       it is zero; half-carry unless its low four bits are zero) */
    O.ldHL(P.hl); A.db(0x7e, 0x2f, 0x3c, 0x86);
    O.ldA(regA); O.ldBC(P.bc); O.ldDE(P.de); }
    A.label("fin"); A.at(0xfe); O.ldhW(0x50);
  }, 0x100);
  const L = logoLayout();
  const t = toTiles(logoPicture({ 0: 3, 1: 2, spark: 1 }));
  /* our tiles from $8800 (numbers $80 on, tile 0 stays the blank one) and our map in the second map at $9C00 */
  const map = t.map.map((k) => (k ? 0x7f + k : 0)), tiles = t.data.slice(16);
  if (tiles.length !== DMG_TILE_BYTES) throw new Error("gb-boot: the letters' tiles changed size");
  return { bios: prog.bytes, labels: prog.labels,
    vram: [[0x8800, tiles], [0x9c00, map], ...cartLogoVram(cart, { mark: !P.noMark }), [WRAM_PART, dmgWramPart()]], layout: L };
}
/* The part of the original Game Boy program that runs from work RAM (placed there with the pictures, as the
   256 bytes are full): our tiles and map cleared, a quarter of the work per pass of four bytes, over three
   blanks, the first map shown again first. It returns to the program, which wipes it. */
const WRAM_PART = 0xc000, DMG_TILE_BYTES = 37 * 16, DMG_MAP_ROWS = [6, 11];
function dmgWramPart() {
  const n = DMG_TILE_BYTES / 8, m = ((DMG_MAP_ROWS[1] - DMG_MAP_ROWS[0] + 1) * 32) / 4, mapAt = 0x9c00 + DMG_MAP_ROWS[0] * 32;
  const loop = [0x22, 0x22, 0x22, 0x22, 0x0d, 0x20, 0xf9];                          // ld (hl+),a x4; dec c; jr nz
  return Uint8Array.from([0x3e, 0x91, 0xe0, 0x40, 0xaf, 0x21, 0x00, 0x88, 0x0e, n, ...loop,   // the first map again (the screen is white); xor a; ld hl,$8800; ld c,n
    0x04, 0xcf, 0x0e, n, ...loop,                                                    // inc b; rst $08 (the next blank)
    0x04, 0xcf, 0x21, mapAt & 255, mapAt >> 8, 0x0e, m, ...loop,
    0xc9]);
}
const WRAM_LEN = dmgWramPart().length;

/* ------------------------------------------------------------ the Super Game Boy */
/* No picture here: on a real Super Game Boy the logo is the SNES program's. The Game Boy inside sends
   the cartridge header to the SNES in six packets, as every Super Game Boy start-up does, and hands over. */
export const SGB_PROFILES = {
  sgb: { apuOn: 229456, lcdOn: 270848, nr13: 1955852, handover: 1955904,
         a: 0x01, bc: 0x0014, de: 0x0000, hl: 0xc060, stack: [0xb2, 0x00, 0x39, 0x01] },
};
/* the Super Game Boy program's waits, as above */
const SGB_CAL = { a: 222600, l: 41280, n: 4000, w: 23 };

/* a wait of exactly v cycles through a delay loop reached by `call`, split when one loop cannot hold it */
function padTo(A, O, v) {
  const one = (w) => { const d = delayFor(w, 24); O.ldBC(d.bc); for (let i = 0; i < d.k; i++) A.db(0x00); O.call("dly"); };
  while (v > 1000000) { one(500000); v -= 500000; }
  one(v);
}

/* The console's own sender takes longer the fewer one bits the packets hold, and then waits for the
   screen in a 32-cycle loop, so its hand-over moves by up to 28 cycles with the header. Measured on 197
   cartridges, every one fitted by: */
export function sgbShift(cart) {
  let ones = 0;
  for (let k = 0; k < 6; k++) { let sum = 0; const d = [];
    for (let j = 0; j < 14; j++) { const a = 0x104 + 14 * k + j, v = cart && a < 0x150 ? cart[a] : 0; d.push(v); sum = (sum + v) & 255; }
    for (const v of [0xf1 + 2 * k, sum, ...d]) for (let b = v; b; b >>= 1) ones += b & 1; }
  const S = -4 * ones; return S + 32 * Math.ceil((16 - S) / 32) - 20;
}
export function sgbBoot(model = "sgb", cal = SGB_CAL, cart = null) {
  const P = SGB_PROFILES.sgb, regA = model === "sgb2" ? 0xff : P.a;
  cal = { ...cal, n: cal.n + (cart ? sgbShift(cart) : 0) };
  const prog = assemble((A) => {
    const O = ops(A), pad = (v) => padTo(A, O, v);
    O.ldSP(0xfffe);
    /* the six header packets, built in work RAM: command, sum, fourteen bytes of the header from $0104 */
    O.ldHL(0xc000); O.ldDE(0x0104);
    A.label("pk"); A.db(0x7d, 0x0f, 0x0f, 0x0f, 0xc6, 0xf1, 0x22, 0x2c); O.ldBC(0x0e00);   // command F1, F3 ... FB; skip the sum
    A.label("cp"); A.db(0x7b, 0xfe, 0x50, 0x1a); O.jrc("keep"); A.db(0xaf);                // past $014F the packet holds zero
    A.label("keep"); A.db(0x13, 0x22, 0x81, 0x4f, 0x05); O.jrnz("cp");                      // inc de; ld (hl+),a; add a,c; ld c,a
    A.db(0xe5, 0x7d, 0xd6, 0x0f, 0x6f, 0x71, 0xe1);                                         // the sum into the packet's second byte
    A.db(0x7d, 0xfe, 0x60); O.jrnz("pk");
    /* sound and palette as the start-up leaves them, each on its own cycle */
    O.ldHL(0xff11); O.ldDE(0xff25);
    pad(cal.a);
    O.ldBC(0xff24);
    O.ldA(0x80); O.ldhW(0x26); A.db(0x77);                   // NR52 on; NR11 eight cycles later
    O.ldA(0xf3); A.db(0x2c, 0x77, 0x12);                     // NR12; NR51
    O.ldA(0x77); A.db(0x02);                                 // NR50
    O.put(0x47, 0xfc);
    O.put(0xff, 0x01);                                        // the blank wakes the processor
    pad(cal.l); O.put(0x40, 0x91);
    /* send them: a reset pulse, 128 bits low bit first (P15 low for 1, P14 low for 0), a stop bit */
    O.ldHL(0xc000);
    A.label("snd"); A.db(0xaf); O.ldhW(0x00); O.put(0x00, 0x30); O.ldD(16);
    A.label("byte"); A.db(0x2a, 0x5f); O.ldC(8);
    A.label("bit"); A.db(0xaf, 0xcb, 0x1b, 0x17, 0xcb, 0x37, 0x47); O.ldA(0x20); A.db(0x90);   // a = $20 - bit * $10, the same time for either
    O.ldhW(0x00); O.put(0x00, 0x30); A.db(0x0d); O.jrnz("bit"); A.db(0x15); O.jrnz("byte");
    O.put(0x00, 0x20); O.put(0x00, 0x30);
    A.db(0x7d, 0xfe, 0x60); O.jrnz("snd");
    O.jr("part2");
    /* the last call returns to $00B2, as Nintendo's last call does, so the stack is left as its is */
    A.label("dly"); A.db(0x0d); O.jrnz("dly"); A.db(0x05); O.jrnz("dly"); O.ret();
    { const d = delayFor(cal.n, 24); A.at(0xaf - 3 - d.k); A.label("fblock");
      O.ldBC(d.bc); for (let i = 0; i < d.k; i++) A.db(0x00); A.at(0xaf); O.call("dly"); O.jr("tail"); }
    A.label("waitn"); A.db(0xaf); O.ldhW(0x0f); A.db(0x76, 0x05); O.jrnz("waitn"); O.ret();       // clear IF, halt until the blank, b times
    /* As Nintendo's on a Super Game Boy: the logo is simply there, centred, from the moment the screen comes on,
       and it stays in the map for the game to clear. We wait for the blank before the hand-over. */
    A.label("part2");
    O.ldB(cal.w); O.call("waitn"); A.db(0xaf); O.ldhW(0xff);
    O.ldBC(P.stack[2] | (P.stack[3] << 8)); A.db(0xc5, 0xc5, 0xc1, 0xc1);                         // FFFA-FFFB as Nintendo's
    O.ldDE(P.de); O.ldHL(P.hl); O.jr("fblock");
    A.at(0xfe - 16); A.label("tail");
    O.ldBC(P.bc); O.put(0x13, 0xc1); O.put(0x14, 0x07);
    O.ldA(regA); A.db(0xb7);                                 // or a: every flag clear
    A.label("fin"); A.at(0xfe); O.ldhW(0x50);
  }, 0x100);
  return { bios: prog.bytes, labels: prog.labels, vram: cartLogoVram(cart) };
}

/* What every start-up leaves in video memory for the game: the cartridge's own logo (its header bytes $0104-$0133),
   each bit doubled across and down into tiles 1-24, tile 25, and the map cells that show them (rows 8 and 9, from column 4).
   Games that do not clear video memory show it, so ours leaves it too. On the Super Game Boy the Game Boy's screen
   is not seen during the start-up (the intro is on the SNES side), so it is simply there from power-on. */
export function cartLogoVram(cart, { mark: withMark = true } = {}) {
  const tiles = new Uint8Array(24 * 16), dbl = (n) => { let r = 0; for (let b = 0; b < 4; b++) if (n & (8 >> b)) r |= 3 << (6 - 2 * b); return r; };
  for (let t = 0; t < 24; t++) {
    const b0 = cart ? cart[0x104 + 2 * t] : 0, b1 = cart ? cart[0x104 + 2 * t + 1] : 0, rows = [b0 >> 4, b0 & 15, b1 >> 4, b1 & 15];
    for (let r = 0; r < 4; r++) { tiles[t * 16 + 4 * r] = dbl(rows[r]); tiles[t * 16 + 4 * r + 2] = dbl(rows[r]); }
  }
  const mark = Uint8Array.of(0x3c, 0x00, 0x42, 0x00, 0xb9, 0x00, 0xa5, 0x00, 0xb9, 0x00, 0xa5, 0x00, 0x42, 0x00, 0x3c, 0x00);   // tile 25: these bytes match the hand-over state
  const row1 = Uint8Array.from({ length: 13 }, (_, i) => (i < 12 ? i + 1 : 0x19)), row2 = Uint8Array.from({ length: 12 }, (_, i) => i + 13);
  if (!withMark) return [[0x8010, tiles], [0x9904, row1.slice(0, 12)], [0x9924, row2]];   // the first program: no mark, no cell for it
  return [[0x8010, tiles], [0x8190, mark], [0x9904, row1], [0x9924, row2]];
}
/** The picture that leaves on screen, as shades (160 x 144, palette $FC): for the play window to tell it from the game's. */
export function cartLogoScreen(cart) {
  const v = new Map(); for (const [a, b] of cartLogoVram(cart)) for (let i = 0; i < b.length; i++) v.set(a + i, b[i]);
  const pic = new Uint8Array(160 * 144), shade = [0, 3, 3, 3];
  for (let y = 0; y < 144; y++) for (let x = 0; x < 160; x++) {
    const t = v.get(0x9800 + (y >> 3) * 32 + (x >> 3)) || 0, lo = v.get(0x8000 + t * 16 + (y & 7) * 2) || 0, hi = v.get(0x8000 + t * 16 + (y & 7) * 2 + 1) || 0;
    pic[y * 160 + x] = shade[((lo >> (7 - (x & 7))) & 1) | (((hi >> (7 - (x & 7))) & 1) << 1)];
  }
  return pic;
}

/* ---------------------------------------------------------------- the Game Boy Color: colours */
const to5 = (v) => Math.round((Math.max(0, Math.min(255, v)) * 31) / 255);
const bgr = ([r, g, b]) => (to5(b) << 10) | (to5(g) << 5) | to5(r);
const WHITE = [255, 255, 255];
const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
const HUES = [352, 22, 45, 140, 190, 215, 268, 300, 200, 168, 130, 32, 240];
function letterRGB(i) {
  const h = HUES[i] / 360, s = 0.78, l = 0.47, a = s * Math.min(l, 1 - l);
  const f = (n) => { const k = (n + h * 12) % 12; return 255 * (l - a * Math.max(-1, Math.min(k - 3, Math.min(9 - k, 1)))); };
  return [f(0), f(8), f(4)];
}
const GOLD_ARM = [239, 198, 66];

/* ---------------------------------------------------------------- layout */
const TEXT = "CRYSTALWORLDS";
const X = [40, 52, 64, 76, 88, 100, 112, 46, 58, 70, 82, 94, 106];
const Y = [56, 56, 56, 56, 56, 56, 56, 74, 74, 74, 74, 74, 74];
/* The letters are drawn into background tiles, a column of eight tiles for each of columns 5 to 15. A tile
   column's palette holds every letter that passes through it, so each letter keeps one colour slot: */
const SLOT = [1, 2, 1, 3, 1, 2, 1, 3, 3, 2, 2, 3, 3];
const COLPAL = [0, 0, 1, 2, 3, 4, 5, 6, 7, 7, 1];          // palette of tile columns 5..15
const SPARK_PAL = 4, SPARK_SLOT = 1;                          // a slot no letter uses in that palette
const SPARK_CELLS = [[4, 6], [16, 8], [4, 11], [16, 10]];
const C0 = 5, R0 = 3, NC = 11, NR = 8;                        // the drawing area: tile columns 5..15, rows 3..10
/* the drop: pixels above the resting place, one value a frame, ending with a small hop */
const DROP = (() => {
  const ease = (t) => 1 - Math.pow(1 - Math.max(0, Math.min(1, t)), 3), out = [];
  for (let j = 0; j < 12; j++) { const k = j / 12; out.push(Math.min(0, Math.round(-26 * (1 - ease(k / 0.7)) + (k > 0.7 ? -2.6 * Math.sin((k - 0.7) / 0.3 * Math.PI) : 0)))); }
  return out;
})();
export const CGB_FRAMES = { spacing: 3, drop: 12, note: 8, bell: 48, bell2: 52, sparkFrom: 48, sparkTo: 96, fade: [160, 164, 168], mapGone: 170, wipe: 171, attrGone: 172, finalPal: 173, tilesLeft: 174 };
const PENTA = [440, 493.9, 587.3, 659.3, 784, 880, 987.8, 1174.7, 1318.5, 1568, 1760, 1975.5, 2349.3];
const freqReg = (f) => Math.round(2048 - 131072 / f);

/* each palette's letters by slot, worked out from the columns */
function palLetters() {
  const P = Array.from({ length: 8 }, () => [null, null, null, null]);
  for (let i = 0; i < 13; i++) for (let c = X[i] >> 3; c <= (X[i] + 9) >> 3; c++) {
    const p = COLPAL[c - C0], s = SLOT[i];
    if (P[p][s] !== null && P[p][s] !== i) throw new Error("cgb logo: palette " + p + " slot " + s + " is taken");
    P[p][s] = i;
  }
  if (P[SPARK_PAL][SPARK_SLOT] !== null) throw new Error("cgb logo: the sparkle slot is taken");
  return P;
}
function fontColumns() {
  const o = [];
  for (let i = 0; i < 13; i++) { const g = GLYPHS[TEXT[i]]; for (let c = 0; c < 5; c++) { let b = 0; for (let r = 0; r < 7; r++) if (g[r][c] === "#") b |= 1 << r; o.push(b); } }
  return o;
}
function sparkTile(big) {
  const t = new Uint8Array(16), px = [[2, 2], [1, 2], [3, 2], [2, 1], [2, 3]].concat(big ? [[0, 2], [4, 2], [2, 0], [2, 4]] : []);
  for (const [x, y] of px) t[(y + 1) * 2] |= 0x80 >> (x + 1);       // slot 1: the low plane
  return t;
}

/* ---------------------------------------------------------------- the frame script */
/* A list of commands the program follows at each frame's blank. A command writes bytes:
     n (1..127), address, n bytes          to consecutive addresses
     $80 | n, address, n bytes              all to the one address (a palette data port)
   $FF f marks the frame they belong to; $FE k runs block k; $FF $FF ends. */
function palBytes(cols) { const o = []; for (const c of cols) { const v = bgr(c); o.push(v & 255, v >> 8); } return o; }
function bgPals(fadeT, spark) {
  const P = palLetters(), o = [];
  for (let p = 0; p < 8; p++) { const cols = [WHITE, WHITE, WHITE, WHITE];
    for (let s = 1; s < 4; s++) if (P[p][s] !== null) cols[s] = mix(letterRGB(P[p][s]), WHITE, fadeT);
    if (p === SPARK_PAL && spark) cols[SPARK_SLOT] = GOLD_ARM;
    o.push(...palBytes(cols)); }
  return o;
}
export function cgbScript(fin) {
  const F = CGB_FRAMES, ev = new Map(), pokes = new Map();
  const at = (f, ...cmds) => { if (!ev.has(f)) ev.set(f, []); ev.get(f).push(...cmds); };
  const poke = (f, addr, v) => { if (!pokes.has(f)) pokes.set(f, new Map()); pokes.get(f).set(addr, v); };
  const seq = (addr, bytes) => { const o = []; for (let i = 0; i < bytes.length; i += 127) { const b = bytes.slice(i, i + 127); o.push(b.length, (addr + i) & 255, (addr + i) >> 8, ...b); } return o; };
  const same = (addr, bytes) => { const o = []; for (let i = 0; i < bytes.length; i += 127) { const b = bytes.slice(i, i + 127); o.push(0x80 | b.length, addr & 255, addr >> 8, ...b); } return o; };
  /* before the screen comes on: palettes, each tile column's palette, the map of the drawing area, the sparkle tiles */
  const setup = [...seq(0xff68, [0x80]), ...same(0xff69, bgPals(0, true)), 0xfe, 7, ...seq(0xff4f, [1])];
  for (const [c, r] of SPARK_CELLS) setup.push(...seq(0x9800 + r * 32 + c, [SPARK_PAL]));
  setup.push(...seq(0xff4f, [0]));
  setup.push(...seq(0x8010 + 88 * 16, [...sparkTile(false), ...sparkTile(true)]));
  /* a note as each letter lands: up the scale, the two pulse channels in turn, a little louder as they go */
  for (let i = 0; i < 13; i++) { const x = freqReg(PENTA[i]), vol = 9 + Math.min(4, Math.floor(i / 3));
    at(i * F.spacing + F.note, ...seq(i % 2 ? 0xff16 : 0xff11, [i % 2 ? 0x80 : 0x40, (vol << 4) | 1, x & 255, 0x80 | (x >> 8)])); }
  /* the bell with a fifth */
  const b1 = freqReg(1760), b2 = freqReg(2637);
  at(F.bell, ...seq(0xff11, [0x40, 0xf2, b1 & 255, 0x80 | (b1 >> 8)]));
  at(F.bell2, ...seq(0xff16, [0x40, 0x92, b2 & 255, 0x80 | (b2 >> 8)]));
  /* sparkles at the corners: small, large, small, gone, three times */
  const st = (p) => (p < 0.2 ? 1 : p < 0.55 ? 2 : p < 0.75 ? 1 : 0);
  for (let f = F.sparkFrom; f <= F.sparkTo; f++) {
    const s = f === F.sparkTo ? 0 : st(((f - F.sparkFrom) % 16) / 16), was = f === F.sparkFrom ? -1 : st(((f - 1 - F.sparkFrom) % 16) / 16);
    if (s === was) continue;
    at(f, 0xfe, s === 1 ? 9 : s === 2 ? 10 : 11);
  }
  /* fade to white */
  F.fade.forEach((f, k) => at(f, ...seq(0xff68, [0x80]), ...(k === F.fade.length - 1 ? [0xfe, 5] : [0xfe, 14 + k])));
  /* the drawing area leaves the map before the palettes take the game's colours; our work RAM is wiped */
  at(F.mapGone, 0xfe, 4); at(F.wipe, 0xfe, 6); at(F.attrGone, 0xfe, 8);
  at(F.tilesLeft, 0xfe, 13);                            // no map cell shows them now: our tiles become what is left for the game
  for (const [f, m] of pokes) { const addrs = [...m.keys()].sort((x, y) => x - y);
    for (let i = 0; i < addrs.length;) { let j = i; while (j + 1 < addrs.length && addrs[j + 1] === addrs[j] + 1) j++;
      at(f, ...seq(addrs[i], addrs.slice(i, j + 1).map((a) => m.get(a)))); i = j + 1; } }
  at(F.finalPal, ...fin.palettes, ...seq(0xff25, [0xf3]), ...seq(0xff24, [0x77]), ...seq(0xff47, [0xfc]));
  /* a frame that holds an exact moment does nothing else: its other writes move to the next frame */
  for (const [f] of fin.exact) { if (ev.has(f)) { const moved = ev.get(f); ev.delete(f); at(f + 1, ...moved); } }
  for (const [f, k] of fin.exact) at(f, 0xfe, k);
  const out = [...setup, 0xff, 0];
  for (const f of [...ev.keys()].sort((a, b) => a - b)) { if (f === 0) out.push(...ev.get(f)); else out.push(0xff, f, ...ev.get(f)); }
  out.push(0xff, 0xff);
  return out;
}

/* ---------------------------------------------------------------- the program */
/* p: the per-cartridge numbers (see cgbPlan): when the screen comes on, the moments to hit, the hand-over state. */
/* where the Colour program's tables arrive (video memory, the unused second map) and where they live: bank 2's
   $D900 area. An original cartridge's tables: the combinations' buttons (12), the configurations (13 x 5) and the
   palettes (13 x 8); then the picture of high RAM at the hand-over (127). */
const TBL_SRC = 0x9c00, TBL = 0xd900, IMG = TBL + 12 + 65 + 128, LOGO_BUF = 0xda50, FADE1 = LOGO_BUF + 400, MAP_BUF = 0xdc70;   // then the logo tiles left for the game (400 bytes), the fade's two steps (64 each)
/* the Color's own numbering of the combinations ($D005): Up, Left, Down, Right, each alone, with A, with B */
const COMBO_ORDER = [0x40, 0x41, 0x42, 0x20, 0x21, 0x22, 0x80, 0x81, 0x82, 0x10, 0x11, 0x12];
export function cgbBoot(p) {
  const fin = { palettes: p.palettes, exact: [[p.fP, 0], [p.fT1, 1], [p.fT2, 2], [p.fG, 3]] };
  const script = cgbScript(fin);
  const prog = assemble((A) => {
    const O = ops(A);
    const pad = (v) => { const d = delayFor(v, 24); O.ldBC(d.bc); O.call("dly" + d.k); };
    const st16 = (addr) => A.db(0xea, addr & 255, addr >> 8);          // ld (nn),a
    const ld16 = (addr) => A.db(0xfa, addr & 255, addr >> 8);          // ld a,(nn)
    const V = { f: 0xc000, sp: 0xc001, x: 0xc003, y2: 0xc004, font: 0xc007, combo: 0xc00a, any: 0xc00b, flag: 0xc00c, dirty: 0xc020 };
    const TH = () => A.L("tab") >> 8;
    O.ldSP(0xfffe); A.db(0xc3); A.dw(A.L("main"));
    A.at(0x0d); A.label("dly3"); A.db(0x00); A.label("dly2"); A.db(0x00); A.label("dly1"); A.db(0x00);
    A.label("dly0"); A.label("dly"); A.db(0x0d); O.jrnz("dly"); A.db(0x05); O.jrnz("dly"); A.label("ret"); O.ret();
    /* ---- data, in the first page: drop +$20, column palettes +$30, Y +$40, slot +$50, X +$60, masks +$70, font +$80 ---- */
    A.at(0x20); A.label("tab"); A.db(DROP); A.at(0x30); A.db(COLPAL); A.at(0x40); A.db(Y); A.at(0x50); A.db(SLOT); A.at(0x60); A.db(X);
    A.at(0x70); A.db(0xc0, 0x30, 0x0c, 0x03);
    A.at(0x80); A.db(fontColumns());
    /* ---- the hand-over, at the end of the first page ---- */
    A.at(0xfe - (A.L("fin") - A.L("tail"))); A.label("tail");
    if (p.joy) {
      /* the extra cycles a press costs, before compatibility mode as on Nintendo's (d): 0 none; 1 other buttons, 12
         more; 2 a combination, its buttons exactly at the last read, 4 more; 3 a combination, anything else at the last read, 8 less */
      A.db(0xcb, 0x4a); O.jrz("t01"); A.db(0xcb, 0x42); O.jrnz("t3"); A.db(0x00, 0x00); O.jr("jdone");
      A.label("t01"); A.db(0xcb, 0x42); O.jrnz("t1"); O.jr("jdone"); A.label("t1"); A.db(0x00, 0x00, 0x00, 0x00); A.label("t3"); A.db(0x00);
      A.label("jdone");
    }
    O.put(0x4c, p.key0);                                                // compatibility mode, on Nintendo's cycle
    if (p.lateBg) { A.db(0xc3); A.dw(A.L("palw")); A.label("palb"); }  // object priority, then the game's background colours, now the last picture is drawn (a jump: a call would mark the stack)
    else if (p.opri) O.put(0x6c, 0x01);
    if (p.joy) {
      /* the palette entry chosen at run time (e) walked at 32 cycles each as Nintendo's walks it */
      A.db(0x4b, 0x0c); O.jr("entd"); A.label("ent"); A.db(0x00, 0x00, 0x00, 0x00); A.label("entd"); A.db(0x0d); O.jrnz("ent");
    } else if (p.entry) { O.ldC(p.entry); A.label("ent"); A.db(0x00, 0x00, 0x00, 0x00, 0x0d); O.jrnz("ent"); }   // 32 cycles a palette entry
    if (p.tailLoop) { O.ldB(p.tailLoop); A.label("tl"); A.db(0x05); O.jrnz("tl"); }
    for (let i = 0; i < (p.tailNops || 0); i++) A.db(0x00);
    A.db(0xaf); O.ldA(0x11); O.ldBC(p.regs.bc); O.ldDE(p.regs.de); O.ldHL(p.regs.hl);
    if (p.agb) A.db(0x04);                                              // inc b: the Advance's own mark
    A.label("fin"); A.at(0xfe); O.ldhW(0x50);
    /* ---- page 2 on: the program ---- */
    A.at(0x200); A.label("main");
    /* work RAM bank 2 from the start; the tables and the high RAM picture come in through video memory (screen
       off), are moved to bank 2's $D900 area, the place the Color's own keeps its palette table, and wiped */
    O.put(0x26, 0x80); O.put(0x25, 0x33); O.put(0x24, 0x77);            // sound on for the letters' notes, first, on its own cycle
    O.put(0x70, 0x02); O.ldHL(TBL_SRC); O.ldDE(TBL); O.ldBC(p.tblLen);
    A.label("tcp"); A.db(0x7e, 0x36, 0x00, 0x23, 0x12, 0x13, 0x0b, 0x78, 0xb1); O.jrnz("tcp");
    O.ldHL(A.L("script")); A.db(0x7d); st16(V.sp); A.db(0x7c); st16(V.sp + 1);
    A.db(0xaf); st16(V.f); O.call("run");                              // palettes, map and sparkle tiles
    O.put(0xff, 0x01);
    pad(p.padL); O.put(0x40, 0x91);                                     // the screen comes on when Nintendo's does
    A.label("loop"); A.db(0xaf); O.ldhW(0x0f); A.db(0x76);              // wait for the blank
    O.ldHL(V.f); A.db(0x34);                                            // inc (hl): the frame
    O.call("show"); O.call("run"); if (p.joy) O.call("joy"); O.call("render"); O.jr("loop");
    /* the Color's button combinations, read each frame while the logo is up, as the Color's own program reads
       them: the last combination seen wins, and any other press is remembered */
    if (p.joy) {
      A.label("joy"); ld16(V.f); A.db(0xfe, p.joyTo, 0xd0, 0xcb, 0x47, 0xc8);                  // cp; ret nc; every other frame, as the Color's own
      /* the buttons are read when the Color's own reads them: line 148 of the blank, then a moment (if the frame's
         work has already run past the blank, at once) */
      A.label("wl"); O.ldhR(0x44); A.db(0xfe, 148); O.jrnc("wg"); A.db(0xfe, 144); O.jrnc("wl");
      A.label("wg"); O.ldB(p.joyWait); A.label("ww"); A.db(0x05); O.jrnz("ww");
      O.put(0x00, 0x20); O.ldhR(0x00); A.db(0x2f, 0xe6, 0x0f, 0xcb, 0x37, 0x47);  // directions, high nibble
      O.put(0x00, 0x10); O.ldhR(0x00); A.db(0x2f, 0xe6, 0x0f, 0xb0, 0xf6, p.joyHeld, 0x47);   // buttons, low nibble, and the setting's as if held: b = the pad
      O.put(0x00, 0x30);
      O.ldHL(0xd003); A.db(0x7e, 0x2f, 0xa0, 0x2c, 0x77, 0x2d, 0x70);   // as the Color's own: $D004 the buttons new at this read, $D003 the pad
      ld16(V.any); A.db(0xb0); st16(V.any);
      ld16(V.combo); A.db(0x4f); ld16(V.f); A.db(0xfe, p.comboTo); O.jrnc("jn");                  // combinations only while they need no longer start-up
      O.ldHL(TBL); O.ldDE(0x010c);
      A.label("jl"); A.db(0x2a, 0xb8); O.jrnz("js"); A.db(0x4a); A.label("js"); A.db(0x14, 0x1d); O.jrnz("jl");
      ld16(V.combo); A.db(0xb9); O.jrz("jn");
      /* a new choice: $D007 the entry it replaces, $D005 its number, and the marks the Color's own leaves in high RAM */
      A.db(0x5f, 0x87, 0x87, 0x83, 0xc6, (TBL + 15) & 255, 0x6f); O.ldH(TBL >> 8); A.db(0x7e); st16(0xd007); A.db(0x2c, 0x7e); st16(0xd00a);
      A.db(0x79, 0x3d); st16(0xd005); A.db(0x79); st16(V.combo);
      A.db(0x87, 0x87, 0x81, 0xc6, (TBL + 16) & 255, 0x6f, 0x7e);                                  // a = its table
      O.ldHL(IMG + 0x6c); A.db(0x36, 0x75, 0x2c, 0x36, 0x05, 0x2c, 0x36, 0x01, 0x2c, 0x77, 0x2c, 0x36, 0x3f, 0x2c, 0x36, 0x05);
      A.label("jn"); ld16(V.combo);
      /* the extra cycles' case (see the tail): 2 a combination still held alone, 3 not, 1 another press, 0 none */
      A.db(0xa7); O.jrz("jo"); A.db(0x3d, 0x6f); O.ldH(TBL >> 8); ld16(0xd003); A.db(0xbe); O.ldA(2); O.jrz("jf"); A.db(0x3c); O.jr("jf");   // its own buttons exactly, or not
      A.label("jo"); ld16(V.any); A.db(0xa7); O.ldA(1); O.jrnz("jf"); A.db(0xaf);
      A.label("jf"); st16(V.flag); O.ret();
    }
    /* in the blank: the drawing area to video memory */
    A.label("show"); ld16(V.f); A.db(0xfe, 52, 0xd0);                   // cp 52; ret nc
    O.put(0x51, 0xc2); A.db(0xaf); O.ldhW(0x52); O.put(0x53, 0x80); O.put(0x54, 0x10); O.put(0x55, NC * NR - 1); O.ret();
    /* while the frame is drawn: the drawing area for the next one. The columns a falling letter touched last
       frame are put back from the resting picture, then each letter in the air is drawn at its new height. */
    A.label("render"); ld16(V.f); A.db(0xfe, 51, 0xd0);
    O.ldHL(V.dirty); O.ldE(0);
    A.label("rc"); A.db(0x7e, 0xa7); O.jrz("rcn"); A.db(0x36, 0x00, 0xe5);
    A.db(0x7b, 0xcb, 0x3f, 0xc6, 0xc8, 0x67, 0x7b, 0xe6, 0x01, 0x0f, 0x6f, 0xc6, 0x00);        // hl = $C800 + col * 128
    A.db(0x7c, 0xd6, 0x06, 0x57, 0x7d, 0x5f);                                                   // de = $C200 + col * 128 (d = h - 6, e = l)
    O.ldC(16); A.label("cpb"); for (let i = 0; i < 8; i++) A.db(0x2a, 0x12, 0x1c); A.db(0x0d); O.jrnz("cpb");
    A.db(0xe1, 0x7d, 0xd6, V.dirty & 255, 0x5f);                                                // e = col again
    A.label("rcn"); A.db(0x2c, 0x1c, 0x7b, 0xfe, NC); O.jrnz("rc");
    O.ldD(0);
    A.label("lt"); ld16(V.f); A.db(0x47, 0x7a, 0x87, 0x82, 0x4f, 0x78, 0x91); O.jrc("lnext");       // k = frame - 3i
    A.db(0xfe, 12); O.jrz("land"); O.jrnc("lnext");
    A.db(0xf6, 0x20, 0x6f); O.ldH(0); A.db(0x46, 0x7a, 0xf6, 0x40, 0x6f, 0x7e, 0x80, 0x4f);   // c = Y[i] + DROP[k]
    O.ldE(0xc2); O.call("draw"); O.jr("lnext");
    A.label("land"); O.ldH(0); A.db(0x7a, 0xf6, 0x40, 0x6f, 0x4e);                              // c = Y[i]
    A.db(0xc5); O.ldE(0xc8); O.call("draw"); A.db(0xc1); O.ldE(0xc2); O.call("draw");
    A.label("lnext"); A.db(0x14, 0x7a, 0xfe, 13); O.jrnz("lt"); O.ret();
    /* one letter: d = which, c = top, e = page of the drawing area */
    A.label("draw"); A.db(0xd5); O.ldH(0);
    A.db(0x7a, 0xf6, 0x60, 0x6f, 0x7e); st16(V.x);                                              // x
    A.db(0x7a, 0x87, 0x87, 0x82, 0xf6, 0x80); st16(V.font);                                     // its font columns
    A.db(0x79, 0xd6, 24, 0x87); st16(V.y2);                                                     // (y - 24) * 2
    A.db(0x7a, 0xf6, 0x50, 0x6f, 0x56);                                                         // d = slot
    ld16(V.x); A.db(0x0f, 0x0f, 0x0f, 0xe6, 0x1f, 0xd6, C0, 0x4f);                             // c = first tile column
    A.db(0xc6, V.dirty & 255, 0x6f); O.ldH(V.dirty >> 8); A.db(0x36, 0x01, 0x2c, 0x36, 0x01);   // its two columns change
    A.db(0x79, 0xcb, 0x3f, 0x83, 0x67, 0x79, 0xe6, 0x01, 0x0f, 0x6f); ld16(V.y2); A.db(0xb5, 0x6f);   // hl = page + col/2, (col & 1) * 128 + (y - 24) * 2
    A.db(0xe5); ld16(V.x); A.db(0xe6, 0x06, 0x0f, 0xf6, 0x70, 0x6f, 0x26, 0x00, 0x4e, 0xe1);         // c = mask
    O.ldE(5);
    A.label("dcol"); A.db(0xe5); ld16(V.font); A.db(0x6f, 0x26, 0x00, 0x46, 0x3c); st16(V.font); A.db(0xe1, 0xe5);   // b = this column's rows
    A.label("drow"); A.db(0xcb, 0x38); O.jrnc("dskip");                                         // srl b
    A.db(0xcb, 0x42); O.jrz("dhi");                                                             // bit 0,d
    A.db(0x7e, 0xb1, 0x77, 0x2c, 0x2c, 0x7e, 0xb1, 0x77, 0x2d, 0x2d);
    A.label("dhi"); A.db(0xcb, 0x4a); O.jrz("dskip");                                          // bit 1,d
    A.db(0x2c, 0x7e, 0xb1, 0x77, 0x2c, 0x2c, 0x7e, 0xb1, 0x77, 0x2d, 0x2d, 0x2d);
    A.label("dskip"); A.db(0x2c, 0x2c, 0x2c, 0x2c, 0x78, 0xa7); O.jrnz("drow");
    A.db(0xe1, 0xcb, 0x09, 0xcb, 0x09); O.jrnc("dsame");                                       // pop hl; rrc c twice: past the tile?
    A.db(0x7d, 0xee, 0x80, 0x6f, 0xcb, 0x7f); O.jrnz("dsame"); A.db(0x24);                   // next tile column
    A.label("dsame"); A.db(0x1d); O.jrnz("dcol");
    A.db(0xd1); O.ret();
    /* the script player */
    A.label("run"); ld16(V.sp); A.db(0x6f); ld16(V.sp + 1); A.db(0x67);
    A.label("r1"); A.db(0x2a, 0xfe, 0xff); O.jrnz("r2");
    ld16(V.f); A.db(0x47, 0x7e, 0xb8); O.jrz("r1n"); A.db(0x2b); O.jr("save");          // a frame mark ahead: stop before it
    A.label("r1n"); A.db(0x23); O.jr("r1");
    A.label("r2"); A.db(0xfe, 0xfe); O.jrnz("r3");
    A.db(0x2a, 0xf5, 0x7d); st16(V.sp); A.db(0x7c); st16(V.sp + 1); A.db(0xf1);
    A.db(0x87, 0x5f, 0x16, 0x00); O.ldHL(A.L("extab")); A.db(0x19, 0x2a, 0x66, 0x6f, 0xe9);  // jp (hl) into block k
    A.label("r3"); A.db(0x4f, 0xe6, 0x7f, 0x47, 0x5e, 0x23, 0x56, 0x23, 0xcb, 0x79); O.jrnz("rs");
    A.label("rq"); A.db(0x2a, 0x12, 0x13, 0x05); O.jrnz("rq"); O.jr("r1");
    A.label("rs"); A.db(0x2a, 0x12, 0x05); O.jrnz("rs"); O.jr("r1");
    A.label("save"); A.db(0x7d); st16(V.sp); A.db(0x7c); st16(V.sp + 1); O.ret();
    /* ---- the moments that must land on Nintendo's cycle ---- */
    A.label("ex0"); pad(p.padP); O.ldHL(0xff26); O.ldDE(0xff11); O.ldA(0x80); O.ldHLn(0x00);
    for (let i = 0; i < (p.gapCalls || 0); i++) O.call("ret");
    for (let i = 0; i < (p.gapNops || 0); i++) A.db(0x00);
    A.db(0x77, 0x00, 0x12);                                             // sound on; NR11 twelve cycles later
    O.ldA(0xf3); A.db(0x1c, 0x12);                                      // NR12 twenty after that, as Nintendo's
    if (!p.cgb0) { O.ldHL(0xff30); for (let i = 0; i < 16; i++) { O.ldHLn(i & 1 ? 0xff : 0x00); if (i < 15) A.db(0x2c); } }   // the first Color leaves wave memory as it starts
    A.db(0xc3); A.dw(A.L("run"));
    /* at the second note, by the case so far (d as in the tail): none 60, other buttons 72, a combination 64, let go 52 */
    if (p.joy) { A.label("pflag"); ld16(V.flag); A.db(0x57);
      A.db(0xcb, 0x4a); O.jrz("p01"); A.db(0xcb, 0x42); O.jrnz("p3"); A.db(0x00, 0x00, 0x00, 0x00, 0xc9);
      A.label("p01"); A.db(0xcb, 0x42); O.jrnz("p1"); A.db(0x00, 0x00, 0xc9); A.label("p1"); A.db(0x00, 0x00, 0x00, 0x00); A.label("p3"); A.db(0xc9); }
    A.label("ex1"); pad(p.padT1); O.put(0x13, 0x83); O.put(0x14, 0x87); A.db(0xc3); A.dw(A.L("run"));
    A.label("ex2"); pad(p.padT2); if (p.joy) O.call("pflag"); O.put(0x13, 0xc1); for (let i = 0; i < (p.t2Nops || 0); i++) A.db(0x00); O.put(0x14, 0x87); A.db(0xc3); A.dw(A.L("run"));
    A.label("ex3"); O.ldSP(0xd000); A.db(0xaf); O.ldhW(0xff);           // no more waits for the blank; our calls now leave their marks in work RAM, wiped below
    pad(p.padG); O.put(0x51, 0xd3); A.db(0xaf); O.ldhW(0x52); O.put(0x53, 0x98); O.put(0x54, 0xa0);
    O.put(0x55, 0x12);                                                  // the transfer Nintendo's makes, from the same place to the same place
    O.put(0x70, 0x02);                                                  // work RAM bank 2 as Nintendo's leaves it
    for (const [a, v] of p.wram) { O.ldA(v); st16(a); }
    if (p.joy) { O.ldDE(TBL + 15); O.call("cfgp");   // hl = the chosen configuration's entry
      A.db(0x2a); st16(0xd008); A.db(0x7e); st16(0xd00b); }
    O.ldHL(0xd840); O.ldB(32); A.label("wh"); A.db(0x36, 0xff, 0x23, 0x36, 0x7f, 0x23, 0x05); O.jrnz("wh");
    O.ldHL(0xff80); O.ldDE(IMG); O.ldB(127); A.label("hc"); A.db(0x1a, 0x13, 0x22, 0x05); O.jrnz("hc");   // high RAM as Nintendo's leaves it
    if (!p.joy) { O.ldHL(0xc000); O.ldB(16); A.label("vc"); A.db(0x22, 0x05); O.jrnz("vc"); }   // our variables

    if (p.logo) { O.ldHL(0xff80); O.ldDE(0x0104); O.ldB(48); A.label("lg"); A.db(0x1a, 0x13, 0x22, 0x05); O.jrnz("lg"); }   // the cartridge's own logo bytes
    pad(p.padK);
    if (p.joy) {   /* e = the entry, d = the extra cycles' case; then our variables go */
      O.ldDE(TBL + 15); O.call("cfgp"); A.db(0x5e);
      /* c = where the chosen background palette sits in bank 2 (a is still five times the configuration) */
      if (p.lateBg) A.db(0xc6, (TBL + 12) & 255, 0x6f), O.ldH(TBL >> 8), A.db(0x7e, 0x87, 0x87, 0x87, 0xc6, (TBL + 77) & 255, 0x4f);
      ld16(V.flag); A.db(0x57); O.ldHL(0xc000); O.ldB(16); A.db(0xaf); A.label("vc"); A.db(0x22, 0x05); O.jrnz("vc");
    }
    if (p.lateBg) A.db(0xaf);                                           // bank 2 stays until the tail has read the palette
    else { A.db(0xaf); O.ldhW(0x70); }
    st16(0xcffe); st16(0xcfff); O.ldSP(0xfffe);   // bank 0 again, as Nintendo's leaves it
    A.db(0xc3); A.dw(A.L("tail"));
    /* small blocks the script calls */
    A.label("ex4"); O.ldHL(0x9800 + R0 * 32 + C0); O.ldDE(32 - NC); O.ldC(NR); A.db(0xaf);       // the drawing area's map cells to blank
    A.label("m1"); O.ldB(NC); A.label("m2"); A.db(0x22, 0x05); O.jrnz("m2"); A.db(0x19, 0x0d); O.jrnz("m1"); A.db(0xc3); A.dw(A.L("run"));
    A.label("ex5"); O.ldB(32); A.label("w5"); O.put(0x69, 0xff); O.put(0x69, 0x7f); A.db(0x05); O.jrnz("w5"); A.db(0xc3); A.dw(A.L("run"));   // a whole set of palettes white
    A.label("ex6"); O.ldHL(0xc010); O.ldBC(0x02ae); A.db(0xaf);                                  // our work RAM, C010-CD7F, back to zero, eight at a time
    A.label("z1"); for (let i = 0; i < 8; i++) A.db(0x22); A.db(0x0d); O.jrnz("z1"); A.db(0x05); O.jrnz("z1"); A.db(0xc3); A.dw(A.L("run"));
    /* the drawing area's map: each column of eight tiles numbered down, and each column's palette in the second bank */
    A.label("ex7"); O.ldHL(0x9800 + R0 * 32 + C0); O.ldC(1);
    A.label("k1"); O.ldB(NC); A.db(0x79);                                                         // a = first tile of the row
    A.label("k2"); A.db(0x22, 0xc6, NR, 0x05); O.jrnz("k2"); A.db(0x11); A.dw(32 - NC); A.db(0x19, 0x0c, 0x79, 0xfe, NR + 1); O.jrnz("k1");
    O.put(0x4f, 1); O.ldHL(0x9800 + R0 * 32 + C0); O.ldC(NR);
    A.label("k3"); O.ldDE(0x30); O.ldB(NC); A.label("k4"); A.db(0x1a, 0x13, 0x22, 0x05); O.jrnz("k4");
    A.db(0x11); A.dw(32 - NC); A.db(0x19, 0x0d); O.jrnz("k3"); A.db(0xaf); O.ldhW(0x4f); A.db(0xc3); A.dw(A.L("run"));
    /* the palette numbers ours wrote in the map's second bank, back to zero: the drawing area and the sparkle cells */
    A.label("ex8"); O.put(0x4f, 1); O.ldHL(0x9800 + R0 * 32 + C0); O.ldDE(32 - NC); O.ldC(NR); A.db(0xaf);
    A.label("a1"); O.ldB(NC); A.label("a2"); A.db(0x22, 0x05); O.jrnz("a2"); A.db(0x19, 0x0d); O.jrnz("a1");
    for (const [c, r] of SPARK_CELLS) { O.ldHL(0x9800 + r * 32 + c); A.db(0x77); }
    A.db(0xaf); O.ldhW(0x4f); A.db(0xc3); A.dw(A.L("run"));
    /* the sparkles: small, large, gone */
    A.label("ex9"); O.ldA(89); O.jr("spw"); A.label("ex10"); O.ldA(90); O.jr("spw"); A.label("ex11"); A.db(0xaf);
    A.label("spw"); for (const [c, r] of SPARK_CELLS) { const a = 0x9800 + r * 32 + c; A.db(0xea, a & 255, a >> 8); } A.db(0xc3); A.dw(A.L("run"));
    /* an original cartridge's three palettes, from the configuration chosen (0: the cartridge's or the setting's; 1-12: a combination) */
    A.label("ex12");
    if (p.joy) { O.ldDE(TBL + 12); O.call("cfgp");   // hl = the configuration
      if (p.lateBg) A.db(0x23);                                         // the background palette waits for the tail (palw)
      else { O.put(0x68, 0x80); O.ldC(0x69); O.call("pal8"); }
      O.put(0x6a, 0x80); O.ldC(0x6b); O.call("pal8"); O.call("pal8"); A.db(0xc3); A.dw(A.L("run"));
      /* in the tail, after the last picture: the background palette (bank 2, low byte in c), then bank 0 */
      if (p.lateBg) { A.label("palw"); if (p.opri) O.put(0x6c, 0x01); A.db(0x69); O.ldH(TBL >> 8); O.put(0x68, 0x80); O.ldC(0x69);
        for (let i = 0; i < 8; i++) A.db(0x2a, 0xe2);
        if (p.mapKeep) { A.db(0xc3); A.dw(MAP_BUF); A.label("mapb"); }   // a jump there and back: a call would mark the stack                                // those few titles: the logo's map cells, by the part in bank 2
        A.db(0xaf); O.ldhW(0x70); A.db(0x00, 0x00, 0xc3); A.dw(A.L("palb")); }   // two pauses: the tail's own wait then needs no more filler than before
      A.label("pal8"); A.db(0x2a, 0xe5, 0x87, 0x87, 0x87, 0x6f); O.ldH(0); A.db(0x11); A.dw(TBL + 77); A.db(0x19); O.ldB(8);   // hl = pals + 8 * index
      A.label("p8"); A.db(0x2a, 0xe2, 0x05); O.jrnz("p8"); A.db(0xe1); O.ret();
      A.label("cfgp"); ld16(V.combo); A.db(0x4f, 0x87, 0x87, 0x81, 0x6f); O.ldH(0); A.db(0x19); O.ret();   // hl = de + 5 * the chosen configuration
    } else A.db(0xc3), A.dw(A.L("run"));
    /* in the blank, the screen white: the cartridge's logo tiles over our drawing area and sparkle tiles, the rest zero */
    A.label("ex13"); O.put(0x51, LOGO_BUF >> 8); O.put(0x52, LOGO_BUF & 255); O.put(0x53, 0x80); O.put(0x54, 0x10); O.put(0x55, 24);   // tiles 1-25
    O.put(0x51, 0xc2); O.put(0x52, 0x00); O.put(0x53, 0x81); O.put(0x54, 0xa0); O.put(0x55, 64); A.db(0xc3); A.dw(A.L("run"));         // the rest from our wiped work RAM
    /* the fade's steps before white, from the table */
    A.label("ex15"); O.ldHL(FADE1 + 64); O.jr("f14b");
    A.label("ex14"); O.ldHL(FADE1); A.label("f14b"); O.ldB(64); A.label("f14"); A.db(0x2a); O.ldhW(0x69); A.db(0x05); O.jrnz("f14"); A.db(0xc3); A.dw(A.L("run"));
    A.label("extab"); for (const k of ["ex0", "ex1", "ex2", "ex3", "ex4", "ex5", "ex6", "ex7", "ex8", "ex9", "ex10", "ex11", "ex12", "ex13", "ex14", "ex15"]) A.dw(A.L(k));
    A.label("script"); A.db(script); A.at(0x900);
  }, 0x900);
  let tbl = p.tbl;
  if (p.mapKeep) { tbl = tbl.slice(); const end = MAP_BUF - TBL + mapPart(p.mapNops).length - 3; tbl[end + 1] = prog.labels.mapb & 255; tbl[end + 2] = prog.labels.mapb >> 8; }   // the part's way back
  return { bios: prog.bytes, labels: prog.labels, vram: [[TBL_SRC, tbl]] };
}

/* ---------------------------------------------------------------- the Game Boy Color: per cartridge */
/* When the Color's own start-up turns the screen on, measured on the console's program in this core for every title
   sum and licence (cycles from power-on): the hand-over follows from it. */
const TIMING = {"base":695072,"miss":3760,"unlicensed":-600,"newLicence":32,"hash":{"0":0,"1":4440,"12":3744,"16":3480,"20":1776,"21":2832,"22":1536,"23":3432,"25":912,"29":768,"41":4152,"52":1296,"53":2400,"54":1944,"57":1728,"60":1056,"61":480,"62":3192,"63":3024,"67":2016,"73":3720,"75":1536,"78":3768,"82":4392,"88":2016,"89":2616,"92":2328,"93":4680,"103":4416,"104":3864,"105":3384,"107":4872,"109":4728,"111":2784,"112":2520,"113":4176,"117":2592,"134":4296,"136":1488,"139":3960,"140":1104,"144":1584,"146":1872,"149":3720,"151":1488,"153":2688,"154":2544,"156":3504,"157":4488,"162":3672,"168":2808,"170":1824,"183":3888,"189":2832,"201":2424,"206":4056,"209":1992,"219":1680,"224":4632,"232":3840,"240":4008,"242":2808,"246":3624,"247":3576,"255":2880},"tie":{"13":{"69":3860,"82":6288,"other":3912},"24":{"73":3668,"75":5376,"other":3720},"39":{"66":5280,"78":5372,"other":3624},"40":{"65":4820,"70":3288,"other":3432},"70":{"69":3240,"82":5132,"other":3384},"97":{"65":5420,"69":4248,"other":3672},"102":{"69":3624,"76":3716,"other":3768},"106":{"73":3764,"75":5472,"other":3816},"165":{"65":4776,"82":3428,"other":3480},"179":{"66":4992,"82":5896,"85":3284,"other":3428},"191":{"32":3720,"67":5612,"other":3864},"198":{"32":3476,"65":5184,"other":3528},"211":{"73":5324,"82":4152,"other":3576},"244":{"32":3908,"45":5616,"other":3960}}};
const to5h = (v) => Math.round((v * 31) / 255);
const c555 = (hex) => { const [r, g, b] = hexToRgb(hex); const v = (to5h(b) << 10) | (to5h(g) << 5) | to5h(r); return [v & 255, v >> 8]; };
const run = (addr, bytes, same) => { const o = []; for (let i = 0; i < bytes.length; i += 127) { const b = bytes.slice(i, i + 127); o.push((same ? 0x80 : 0) | b.length, (addr + (same ? 0 : i)) & 255, (addr + (same ? 0 : i)) >> 8, ...b); } return o; };
/* Nintendo's moments, measured: relative to the screen coming on (L), except the sound unit's start */
export const CGB_N = { apuOn: 112, t1: 5756616, t2: 6037520, gdma: 12288268, key0dmg: 12354964, key0cgb: 12354940, hDmg: 1176, hCgb: 84 };
/* The first Color's program (Color 0) turns the screen on this many cycles later for every header measured (all title
   sums, licences, Color flags and tie-break letters), and every later moment follows it. It also leaves the cartridge's
   own entry and table a second time, at $D006 and $D009 of bank 2 (a held combination does not change these two). */
export const CGB0_LATER = 524;
export function cgbScreenOn(cart) {
  const old = cart[0x14b], licensed = old === 0x01 || (old === 0x33 && cart[0x144] === 0x30 && cart[0x145] === 0x31);
  if (!licensed) return TIMING.base + TIMING.unlicensed - (old === 0x33 ? 4 : 0);   /* a licensee looked up in the new code: four cycles less */
  let h = 0; for (let i = 0x134; i < 0x144; i++) h = (h + cart[i]) & 255;
  const t = TIMING.tie[h], off = t ? (t[cart[0x137]] ?? t.other) : (TIMING.hash[h] ?? TIMING.miss);
  return TIMING.base + off + (old === 0x33 ? TIMING.newLicence : 0);
}
/* Two recognised title sums for which the Colour's own program, at its very end, also writes the logo's 25 map cells
   (as the original Game Boy's leaves them): the extra cycles that takes. Measured on every recognised title sum and tie
   letter (108 headers); no other title takes that path, and an unrecognised title never does. */
const CGB_LOGO_MAP = { 67: 1440, 88: 1400 };
/* the part (called from palw, run from bank 2): rows 8 and 9 of the map as the original Game Boy's start-up leaves them;
   its cost in cycles, the call and the return included, before its pauses */
const MAP_COST = 832;
const mapPart = (nops) => [...new Array(nops).fill(0x00), 0x21, 0x04, 0x99, 0x3e, 0x01, 0x22, 0x3c, 0xfe, 13, 0x20, 0xfa,   // ld hl,$9904; ld a,1; ld (hl+),a; inc a; cp 13; jr nz
  0x36, 0x19, 0x2e, 0x24, 0x22, 0x3c, 0xfe, 25, 0x20, 0xfa, 0xc3, 0x00, 0x00];                                         // ld (hl),$19; ld l,$24; the same to 24; jp back (filled in by cgbBoot)
export function cgbPlan(cart, L, cal, opts = {}) {
  if (L == null) L = cgbScreenOn(cart);
  const flag = cart[0x143], isCgb = !!(flag & 0x80), a = cgbAssignmentFor(cart);
  const old = cart[0x14b], licensed = old === 0x01 || (old === 0x33 && cart[0x144] === 0x30 && cart[0x145] === 0x31);
  let h = 0; for (let i = 0x134; i < 0x144; i++) h = (h + cart[i]) & 255;
  /* a palette chosen for an unrecognised cartridge is as if its button combination were held, which takes
     four cycles more; the console's own default is no combination */
  const combo = !!opts.config && !a.assigned && !(opts.config.t === 0x03 && opts.config.e === 0x1c), cfg = opts.config && !a.assigned ? opts.config : a.config;
  const entry = cfg.e, table = cfg.t;
  const targetP = (() => { const t1 = L + CGB_N.t1 - 3000; return CGB_N.apuOn + 65536 * Math.floor((t1 - CGB_N.apuOn) / 65536); })();
  const third = old === 0x33 && !licensed;              /* a licensee looked up in the new code takes four cycles less */
  const key0 = L + (isCgb ? CGB_N.key0cgb : CGB_N.key0dmg);
  const mapKeep = !isCgb && licensed && a.assigned && CGB_LOGO_MAP[h] != null, mapLate = mapKeep ? CGB_LOGO_MAP[h] : 0;
  const mapNops = mapKeep ? ((mapLate - MAP_COST) % 16) / 4 : 0;    // pauses in the part, so the tail's own wait stays in whole loops
  const T = { L, P: targetP, T1: L + CGB_N.t1, T2: L + CGB_N.t2, G: L + CGB_N.gdma, K: key0, H: key0 + (isCgb ? CGB_N.hCgb : CGB_N.hDmg + 32 * entry + (combo ? 4 : 0)) + mapLate };
  const pal = [...run(0xff68, [0x80]), 0xfe, 5];
  if (isCgb) pal.push(...run(0xff6a, [0x81]));
  else pal.push(0xfe, 12);                               // the chosen configuration's palettes (ex12)
  /* an original cartridge: the configuration table, 0 the cartridge's own, 1-12 the button combinations in the
     order the Color's own numbers them, each as three palette numbers, the entry and the table. A palette chosen
     in the setting is read as its combination held from power-on. */
  const joy = !isCgb, pals = [], palIdx = (cols) => { const b = cols.flatMap(c555), k = b.join(); let i = pals.findIndex((x) => x.join() === k); if (i < 0) { i = pals.length; pals.push(b); } return i; };
  const cfgs = [], joyMasks = [];
  const manual = [...CGB_MANUAL].sort((x, y) => COMBO_ORDER.indexOf(comboMask(x.combo)) - COMBO_ORDER.indexOf(comboMask(y.combo)));
  for (const c of [a.config, ...manual]) cfgs.push(palIdx(c.bg), palIdx(c.obj0), palIdx(c.obj1), c.e, c.t);
  for (const c of manual) joyMasks.push(comboMask(c.combo));
  const joyHeld = combo ? comboMask(opts.config.combo || "") : 0;
  const hram = [0x71, 0x02, 0x4d, 0x01, isCgb ? 0xc1 : 0x00, 0xff, 0x0d, 0x00, isCgb ? 0xd3 : mapKeep ? 0x03 : 0xf5, mapKeep ? 0x06 : 0x05, opts.agb ? 0xf8 : 0xf9].map((v, i) => [0xfff2 + i, v]).filter(([, v]) => v);
  const wram = [[0xd000, licensed ? h : 0], [0xd008, isCgb && !licensed ? 0x1c : (isCgb ? (a.config.e) : entry)], [0xd00b, isCgb ? a.config.t : table]];
  if (opts.cgb0) wram.push([0xd006, isCgb ? wram[1][1] : a.config.e], [0xd009, isCgb ? wram[2][1] : a.config.t]);   // the cartridge's own, whatever combination is held
  const regs = isCgb ? { bc: 0x0000, de: 0xff56, hl: 0x000d } : { bc: (licensed ? h : 0) << 8, de: 0x0008, hl: mapKeep ? 0x991a : 0x007c };
  /* the frame whose blank comes before moment x, leaving room for the work done first in that blank */
  const c = cal, fr = (x) => Math.floor((x - L - c.w - 200) / 70224) + 1, base = (f) => L + 70224 * (f - 1) + c.w;
  const fP = fr(T.P), fT1 = fr(T.T1), fT2 = fr(T.T2), fG = fr(T.G);
  const tailFixed = isCgb ? 0 : c.h - c.pl + (mapKeep ? mapLate - MAP_COST - 4 * mapNops : 0);                 // an original cartridge's tail also writes its background palette (palw)
  /* the tables, by way of video memory: buttons, configurations, palettes (room for 16), the high RAM picture */
  const img = new Array(127).fill(0); for (const [ad, v] of hram) img[ad - 0xff80] = v;
  const pal16 = pals.flat(); if (pal16.length > 128) throw new Error("gb-boot: more than 16 palettes");
  const tbl0 = joy ? [...joyMasks, ...cfgs, ...pal16, ...new Array(128 - pal16.length).fill(0), ...img] : [...new Array(205).fill(0), ...img];
  const lv = new Map(cartLogoVram(cart)), logo = [...lv.get(0x8010), ...lv.get(0x8190)];   // what the Colour's own also leaves in tiles 1-25
  const tbl = [...tbl0, ...new Array(LOGO_BUF - TBL - tbl0.length).fill(0), ...logo, ...bgPals(1 / CGB_FRAMES.fade.length, false), ...bgPals(2 / CGB_FRAMES.fade.length, false), 0];   // a zero last: the copy's last video-memory read is left as before
  if (mapKeep) tbl.push(...new Array(MAP_BUF - TBL - tbl.length).fill(0), ...mapPart(mapNops), 0);   // the part that writes the logo's map cells, run from bank 2
  if (tbl.length > 1024) throw new Error("gb-boot: the tables do not fit the second map");
  return { T, palettes: pal, hram, wram, regs, key0: isCgb ? flag : 0x04, opri: !isCgb, entry: isCgb ? 0 : entry, agb: !!opts.agb, cgb0: !!opts.cgb0,
    fP, fT1, fT2, fG,
    padL: T.L - c.l - (52 + 72 * tbl.length), padP: T.P - base(fP) - c.p, padT1: T.T1 - base(fT1) - c.t1, padT2: T.T2 - base(fT2) - c.t2 - (isCgb ? 0 : 104), padG: T.G - base(fG) - c.g,
    padK: T.K - T.G - (isCgb ? c.kc : c.k) - (opts.cgb0 ? c.k0 : 0) - (joy ? c.kl : 0), tailLoop: tailFixed ? Math.floor(tailFixed / 16) : 0, tailNops: tailFixed ? (tailFixed % 16) / 4 : (c.hc || 0),
    gapNops: c.gapNops || 0, gapCalls: c.gapCalls || 0, t2Nops: (c.t2Nops || 0) - (isCgb ? 2 : 0), logo: true,
    joy, lateBg: joy, mapKeep, mapNops, joyTo: 136, comboTo: 76, joyWait: 1, joyHeld, tbl, tblLen: tbl.length };
}

/* the Color program's calibration: how long its own work takes before each moment it must hit */
const CGB_CAL = { l: 12688, w: 66000, p: 240, t1: 128, t2: 128, g: 212, k: 10400, kc: 10064, h: 1060, gapCalls: 2, gapNops: 5, t2Nops: 5, hc: 6, kl: 40, pl: 224 };   // kl, pl: the cost of finding and writing an original cartridge's background palette late (palw)
/* Color 0: the same, with the cost of its two extra bytes before the last wait */
const CGB0_CAL = { ...CGB_CAL, k0: 48 };

/**
 * Our start-up program for one machine and cartridge.
 * @param {'dmg'|'dmg0'|'mgb'|'sgb'|'sgb2'|'cgb'|'cgb0'|'agb'} kind  the machine (dmg0 and cgb0: the first programs of the original and the Color)
 * @param {Uint8Array} cart  the cartridge (the Color program depends on its header)
 * @param {{config?: object}} opts  on the Color, the palettes for an original cartridge the console
 *        does not recognise (the site's palette setting, as if its button combination were held)
 * @returns {{bios: Uint8Array, vram: Array<[number, Uint8Array]>, key: string, frames: number}}
 *        the program, the pictures to place in video memory before it starts, a cache key, and the
 *        number of frames until the game starts
 */
export function gbStartup(kind, cart, opts = {}) {
  if (kind === "dmg" || kind === "mgb") { const r = dmgBoot(kind, DMG_CAL, cart); return { bios: r.bios, vram: r.vram, key: "ours:" + kind, frames: Math.ceil(DMG_PROFILES.dmg.handover / 70224) }; }
  if (kind === "dmg0") { const r = dmgBoot(kind, DMG0_CAL, cart); return { bios: r.bios, vram: r.vram, key: "ours:" + kind, frames: Math.ceil(DMG_PROFILES.dmg0.handover / 70224) }; }
  if (kind === "sgb" || kind === "sgb2") { const r = sgbBoot(kind, SGB_CAL, cart); return { bios: r.bios, vram: r.vram, key: "ours:" + kind + ":" + sgbShift(cart), frames: Math.ceil(SGB_PROFILES.sgb.handover / 70224) }; }
  if (kind === "cgb" || kind === "agb" || kind === "cgb0") {
    const c0 = kind === "cgb0", plan = cgbPlan(cart, c0 ? cgbScreenOn(cart) + CGB0_LATER : null, c0 ? CGB0_CAL : CGB_CAL, { config: opts.config, agb: kind === "agb", cgb0: c0 });
    const r = cgbBoot(plan);
    let h = 0; for (let i = 0; i < r.bios.length; i++) h = (h * 31 + r.bios[i]) >>> 0;
    return { bios: r.bios, vram: r.vram, key: "ours:" + kind + ":" + h.toString(16), frames: Math.ceil(plan.T.H / 70224) };
  }
  throw new Error("gb-boot: no start-up program for " + kind);
}
