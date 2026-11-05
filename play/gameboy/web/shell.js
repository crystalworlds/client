/* shell.js — the shell's pure parts: no DOM, no core, no I/O.
 *
 * Everything here is a function of its arguments, which is what lets
 * test/ui_net.py check the scaling rule, the pacing rule, the key map and the
 * script driver headlessly instead of by looking at the page and believing it.
 */

import { BTN, BTN_NAMES, SCREEN_W, SCREEN_H } from "./core.js";

/* ---------------------------------------------------------------------------
 *  Palettes. Shade index 0..3 -> RGB.
 *
 *  "reference" is byte-identical to SHADE_RGB in test/frame_tools.py, so a
 *  canvas grab and a net PNG are the same picture. "dmg" is the panel's own
 *  olive-green, a display choice over the same indices -- it changes no pixel
 *  identity and nothing derived from it is ever a reference.
 * ------------------------------------------------------------------------- */
export const PALETTES = {
  dmggreen:  { name: "DMG green", rgb: [[0xDF, 0xF8, 0xD0], [0x87, 0xC0, 0x6F], [0x3B, 0x65, 0x5B], [0x08, 0x18, 0x20]] },
  dmg:       { name: "DMG panel", rgb: [[0x9B, 0xBC, 0x0F], [0x8B, 0xAC, 0x0F], [0x30, 0x62, 0x30], [0x0F, 0x38, 0x0F]] },
  reference: { name: "Reference grey", rgb: [[0xFF, 0xFF, 0xFF], [0xAA, 0xAA, 0xAA], [0x55, 0x55, 0x55], [0x00, 0x00, 0x00]] },
  pocket:    { name: "Pocket grey-green", rgb: [[0xC4, 0xCF, 0xA1], [0x8B, 0x95, 0x6D], [0x4D, 0x53, 0x3C], [0x1F, 0x1F, 0x1F]] },
};

/* "dmggreen" was sampled from a reference screenshot rather than chosen: the
 * four shades are the mean of the solid interior pixels of each shade inside
 * the game screen, with JPEG edge ringing excluded by requiring a uniform 3x3
 * neighbourhood. Shades 0, 1 and 3 converge to the same value as the
 * neighbourhood is widened to 5x5 and 7x7; shade 2 appears only in thin
 * features, so it is measured at 3x3 where it holds #3B655B stably from
 * tolerance 8 down to 4 (n=898). Its value is NOT the #346856 of the palette
 * this one otherwise resembles -- that is a real difference in the source, not
 * compression error, which is why it is recorded as measured.
 *
 * THE DEFAULT IS A DISPLAY CHOICE AND NOTHING ELSE. It changes no pixel
 * identity: the core emits shade indices and every reference in test/ is
 * scored against "reference" grey, so moving the default cannot move a board
 * figure. A stored choice always wins over it -- see app.js. */
export const DEFAULT_PALETTE = "dmggreen";

/** Expand a palette to a flat Uint32 LUT for the blit (little-endian ABGR). */
export function paletteLUT(key) {
  const p = (PALETTES[key] || PALETTES[DEFAULT_PALETTE]).rgb;
  const lut = new Uint32Array(4);
  for (let i = 0; i < 4; i++) lut[i] = (0xFF << 24) | (p[i][2] << 16) | (p[i][1] << 8) | p[i][0];
  return lut;
}

/**
 * Fill a 32-bit ABGR image buffer from a framebuffer of either format.
 *
 * One place that knows about pixel formats, so the page, the embed device and
 * anything else blit the same way. When the core widens for CGB
 * (the colour study), only this function changes.
 *
 * 15-bit colour is 0bBBBBBGGGGGRRRRR — 5 bits a channel, expanded to 8 by
 * replicating the top 3 bits, which is the standard expansion and maps 31 to
 * 255 exactly rather than to 248.
 */
export function blitInto(out32, frame, format, lut) {
  if (format === "rgb555") {
    for (let i = 0; i < frame.length; i++) {
      const c = frame[i];
      const r5 = c & 31, g5 = (c >> 5) & 31, b5 = (c >> 10) & 31;
      const r = (r5 << 3) | (r5 >> 2), g = (g5 << 3) | (g5 >> 2), b = (b5 << 3) | (b5 >> 2);
      out32[i] = (0xFF << 24) | (b << 16) | (g << 8) | r;
    }
  } else {
    for (let i = 0; i < frame.length; i++) out32[i] = lut[frame[i] & 3];
  }
}

/* ---------------------------------------------------------------------------
 *  Integer nearest-neighbour scaling.
 *
 *  A Game Boy pixel is a square. A resampled one is a different picture, so the
 *  scale is an integer and never 3.4x. The single exception is recorded in
 *  the UI design, section 7: below 1x there IS no integer scale, and a
 *  aspect-locked fit beats showing nothing.
 * ------------------------------------------------------------------------- */
export function integerScale(availW, availH, w = SCREEN_W, h = SCREEN_H) {
  const s = Math.floor(Math.min(availW / w, availH / h));
  return { scale: Math.max(1, s), fits: s >= 1 };
}

/* ---------------------------------------------------------------------------
 *  Keyboard map, keyed by e.code so it survives non-QWERTY layouts.
 *  Z = B and X = A is the family order (web/pm-embed.js in the Pokemon mini
 *  shell chose the same, for the same reason: B is the left button).
 * ------------------------------------------------------------------------- */
export const KEYMAP = {
  ArrowUp: BTN.UP, ArrowDown: BTN.DOWN, ArrowLeft: BTN.LEFT, ArrowRight: BTN.RIGHT,
  KeyZ: BTN.B, KeyX: BTN.A,
  Enter: BTN.START, NumpadEnter: BTN.START,
  ShiftRight: BTN.SELECT,   // Backspace is Back everywhere (decided 2026-10-04), so no longer Select
};

/* ---------------------------------------------------------------------------
 *  FNV-1a over a byte range. The same hash test/play_main.c uses on frames, so
 *  a browser probe and a native probe are talking about the same number.
 * ------------------------------------------------------------------------- */
export function fnv1a(bytes) {
  let h = 0x811c9dc5;
  for (let i = 0; i < bytes.length; i++) {
    h ^= bytes[i];
    h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
  }
  return h >>> 0;
}

/* ---------------------------------------------------------------------------
 *  The ladder.
 *
 *  Slugs are the eight names in test/scripts/*.txt, which is read-only to the
 *  UI. Rung and title are copied from those files' header comments and
 *  from our test record's scoreboard rather than parsed at runtime: the
 *  headers are prose, not a schema, and "Dr. Mario. title -> 1P" defeats every
 *  naive split on the first sentence. Small, explicit, and commented with its
 *  source beats a fragile trick.
 *
 *  No cartridge is named by filename and none is bundled. Each slot is empty
 *  until the user supplies firmware for it.
 * ------------------------------------------------------------------------- */
export const LADDER = [
  { slug: "tetris",      rung: 0, title: "Tetris" },
  { slug: "drmario",     rung: 1, title: "Dr. Mario" },
  { slug: "marioland",   rung: 1, title: "Super Mario Land" },
  { slug: "sml2",        rung: 2, title: "Super Mario Land 2" },
  { slug: "zelda",       rung: 2, title: "Link's Awakening" },
  { slug: "prehistorik", rung: 3, title: "Prehistorik Man" },
  { slug: "pinball",     rung: 3, title: "Pinball Deluxe" },
  { slug: "disneyland",  rung: 4, title: "Tokyo Disneyland" },
];

/* ---------------------------------------------------------------------------
 *  The ladder script grammar, as test/play_main.c implements it:
 *      wait N              N frames, nothing held
 *      press KEYS N        hold KEYS for N frames, then one released frame
 *      snap NAME           marker only in the browser (see below)
 *      probe NAME N        N frames, watching for motion
 *      # ...               comment
 *
 *  `snap` writes a framebuffer to disk in the native harness. IN THE BROWSER IT
 *  WRITES NOTHING. Rendered frames are derived content under the same policy as
 *  the cartridges, so the browser bench counts the marker and moves on -- it
 *  never encodes an image, never offers a download, and never renders a frame
 *  anywhere but the live canvas.
 * ------------------------------------------------------------------------- */
export const SCRIPT_BTN = {
  a: BTN.A, b: BTN.B, select: BTN.SELECT, start: BTN.START,
  right: BTN.RIGHT, left: BTN.LEFT, up: BTN.UP, down: BTN.DOWN,
};

/* Shared by `press` and `reach`, so the two cannot drift on which names are
 * buttons or on how an unknown one is rejected. Throws, loudly and with the
 * line number: silently ignoring a command the native side acts on is how two
 * ladders come to run two different experiments while both printing a
 * fraction. */
function scriptMask(spec, lineNo) {
  let mask = 0;
  for (const k of spec.split(",")) {
    if (!(k in SCRIPT_BTN)) throw new Error(`line ${lineNo}: unknown button '${k}'`);
    mask |= 1 << SCRIPT_BTN[k];
  }
  return mask;
}

export function parseScript(text) {
  const out = [];
  let lineNo = 0;
  for (const raw of text.split(/\r?\n/)) {
    lineNo++;
    const line = raw.replace(/#.*$/, "").trim();
    if (!line) continue;
    const t = line.split(/\s+/);
    switch (t[0]) {
      case "wait":  out.push({ op: "wait", frames: +t[1] }); break;
      /* `settle N` -- advance until the picture has been unchanged for N
       * consecutive frames, capped. Added by the PPU role when the frame
       * boundary was corrected: a fixed `wait` count made the script depend on
       * OUR frame boundary, and correcting gb_run_frame moved Pinball's
       * canonical seed onto the single failing alignment. Settling puts the
       * frame count in the game's hands rather than in a constant we chose. */
      case "settle": out.push({ op: "settle", frames: +t[1] }); break;
      case "snap":  out.push({ op: "snap", name: t[1] }); break;
      case "probe": out.push({ op: "probe", name: t[1], frames: +t[2] }); break;
      case "press": {
        out.push({ op: "press", mask: scriptMask(t[1], lineNo), frames: +t[2] });
        break;
      }
      /* `reach BTN WINDOW MAXTAPS` -- watch WINDOW frames; if the picture is
       * moving, stop; otherwise tap BTN and watch again, up to MAXTAPS times.
       * Added 2026-08-29 with test/play_main.c, which implements the identical
       * loop. It replaces counting presses, which was measured to be
       * SEED-FRAGILE: the number of screens between reset and gameplay depends
       * on the leading idle, so no constant is right in both the plain and the
       * seeded run. See web/ladder.js and the PPU design, section 69. */
      case "reach": {
        out.push({ op: "reach", mask: scriptMask(t[1], lineNo), btn: t[1],
                   frames: +t[2], taps: +t[3] });
        break;
      }
      default: throw new Error(`line ${lineNo}: bad script line '${line}'`);
    }
  }
  return out;
}

/* The script DRIVER lives in web/ladder.js, not here. There is exactly one,
 * and it is the one that mirrors test/play_main.c: two drivers would be two
 * things to keep in step, which is the objection §13 raised against porting
 * the sibling's demo-scripts.json, and it applies to this role too. */

/* ---------------------------------------------------------------------------
 *  A synthetic cartridge, hand-assembled here.
 *
 *  Clean-room and entirely mine: it contains no Nintendo logo (so it MUST be
 *  run without a BIOS -- the boot program's logo check would reject it), no
 *  copyrighted bytes, and nothing derived from anybody's firmware. Its purpose
 *  is that the shell can be proved to run, and the switch path proved to be
 *  hammerable, on a machine with no user firmware at all.
 *
 *  Program: select one joypad group, mirror LY into BGP so the panel shows a
 *  stable striped raster (visible proof frames are being rendered), and spin
 *  until a line in the selected group goes low. Then jump to $0200 + n*8, where
 *  n is the pressed nibble, and self-loop there -- so gb_reg_pc() alone reports
 *  exactly which JOYP line the pressed button drove, with no debug export.
 *
 *      0100  00           NOP
 *      0101  C3 50 01     JP   $0150
 *      0150  F3           DI
 *      0151  3E ss        LD   A,sel          ; $20 = directions, $10 = actions
 *      0153  E0 00        LDH  ($00),A
 *      0155  F0 44   L:   LDH  A,($44)        ; LY
 *      0157  E0 47        LDH  ($47),A        ; BGP -- a per-line raster write
 *      0159  F0 00        LDH  A,($00)
 *      015B  2F           CPL                 ; JOYP lines are active low
 *      015C  E6 0F        AND  $0F
 *      015E  28 F5        JR   Z,L
 *      0160  87 87 87     ADD  A,A x3         ; n*8
 *      0163  26 02        LD   H,$02
 *      0165  6F           LD   L,A
 *      0166  E9           JP   (HL)
 *      0200+8n  18 FE     JR   .              ; sixteen landing pads
 * ------------------------------------------------------------------------- */
export const PROBE_SELECT_DIRECTIONS = 0x20;   /* P15 high, P14 low  -> directions */
export const PROBE_SELECT_ACTIONS    = 0x10;   /* P14 high, P15 low  -> A/B/Sel/Start */
export const PROBE_PAD_BASE = 0x0200;

export function makeProbeCart(select = PROBE_SELECT_DIRECTIONS, sizeKiB = 32, opts = {}) {
  const cart = new Uint8Array(sizeKiB * 1024);
  cart.set([0x00, 0xC3, 0x50, 0x01], 0x0100);
  cart.set([
    0xF3,                     /* DI            */
    0x3E, select & 0xFF,      /* LD A,sel      */
    0xE0, 0x00,               /* LDH ($00),A   */
    0xF0, 0x44,               /* LDH A,($44)   */
    0xE0, 0x47,               /* LDH ($47),A   */
    0xF0, 0x00,               /* LDH A,($00)   */
    0x2F,                     /* CPL           */
    0xE6, 0x0F,               /* AND $0F       */
    0x28, 0xF5,               /* JR Z,-11      */
    0x87, 0x87, 0x87,         /* ADD A,A x3    */
    0x26, 0x02,               /* LD H,$02      */
    0x6F,                     /* LD L,A        */
    0xE9,                     /* JP (HL)       */
  ], 0x0150);
  for (let n = 0; n < 16; n++) cart.set([0x18, 0xFE], PROBE_PAD_BASE + n * 8);
  /* Header: cartridge type 00 (no mapper), 32 KiB, no RAM. Cartridge type / size bytes only -- no
   * logo, no title, no checksum, because nothing here needs to satisfy a boot
   * program and inventing one would be inventing somebody else's bytes. */
  /* opts.battery gives it MBC1 + RAM + BATTERY and an 8 KiB RAM bank, so the
   * battery-RAM path has something to persist without needing a commercial
   * cartridge. Still no logo, no title, no checksum: nothing here has to
   * satisfy a boot program, and inventing one would be inventing somebody
   * else's bytes. */
  cart[0x0147] = opts.battery ? 0x03 : 0x00;
  cart[0x0148] = Math.max(0, Math.log2(sizeKiB / 32) | 0);
  cart[0x0149] = opts.battery ? 0x02 : 0x00;
  return cart;
}

/**
 * A second synthetic cartridge: one that puts a CHANGING PICTURE on the screen.
 *
 * The joypad probe cart above is deliberately static, which makes it useless
 * for the cross-build check — two builds trivially agree that nothing moved.
 * This one turns the LCD off, writes a tile pattern into VRAM unblocked, turns
 * the LCD back on, and then scrolls it by writing DIV into SCX every loop. The
 * result is a framebuffer that changes constantly and deterministically, so
 * "frames changed" and "distinct frames" become numbers with content.
 *
 * Clean-room and hand-assembled, like the other one: no logo, so it must run
 * without a BIOS, and no byte of it comes from anybody's firmware.
 *
 *     0150  F3           DI
 *     0151  3E 00        LD   A,$00
 *     0153  E0 40        LDH  ($40),A     ; LCDC = 0 — LCD off, VRAM free
 *     0155  21 00 80     LD   HL,$8000
 *     0158  06 10        LD   B,$10
 *     015A  3E AA        LD   A,$AA
 *     015C  22      L1:  LD   (HL+),A     ; 16 bytes: AA,55,AA,55...
 *     015D  EE FF        XOR  $FF
 *     015F  05           DEC  B
 *     0160  20 FA        JR   NZ,L1
 *     0162  3E E4        LD   A,$E4
 *     0164  E0 47        LDH  ($47),A     ; BGP = E4
 *     0166  3E 91        LD   A,$91
 *     0168  E0 40        LDH  ($40),A     ; LCD on, BG on, $8000 tile data
 *     016A  F0 04   M:   LDH  A,($04)     ; DIV
 *     016C  E0 43        LDH  ($43),A     ; SCX — scrolls every loop
 *     016E  18 FA        JR   M
 */
export function makeScrollCart(sizeKiB = 32) {
  const cart = new Uint8Array(sizeKiB * 1024);
  cart.set([0x00, 0xC3, 0x50, 0x01], 0x0100);
  cart.set([
    0xF3,
    0x3E, 0x00, 0xE0, 0x40,
    0x21, 0x00, 0x80,
    0x06, 0x10,
    0x3E, 0xAA,
    0x22, 0xEE, 0xFF, 0x05, 0x20, 0xFA,
    0x3E, 0xE4, 0xE0, 0x47,
    0x3E, 0x91, 0xE0, 0x40,
    0xF0, 0x04, 0xE0, 0x43, 0x18, 0xFA,
  ], 0x0150);
  cart[0x0147] = 0x00;
  cart[0x0148] = Math.max(0, Math.log2(sizeKiB / 32) | 0);
  cart[0x0149] = 0x00;
  return cart;
}

/**
 * A frame-marker cartridge: every COMPLETE frame is one uniform shade.
 *
 * This is the acceptance criterion for the PPU role's frame-boundary fix, and
 * it lives here rather than in a message because an acceptance criterion that
 * depends on somebody remembering what was agreed is not a criterion.
 *
 * Every VBlank it bumps a counter and writes it to BGP. All VRAM is zero, so
 * every pixel takes colour index 0 and the whole screen is BGP bits 1:0 — one
 * uniform shade per frame, changing once per frame. A framebuffer sampled
 * MID-frame therefore shows two horizontal bands, and the row where they meet
 * is where the sample landed. That row is the diagnostic: it is what identified
 * the accumulating-overshoot mechanism, and a bare pass/fail would have hidden
 * it.
 *
 * Clean-room and hand-assembled, like the other two: no logo, so it must run
 * without a BIOS, and no byte of it comes from anybody's firmware.
 *
 *     0150  F3        DI
 *     0151  AF        XOR A
 *     0152  4F        LD  C,A
 *     0153  F0 44  W1 LDH A,($44)     ; LY
 *     0155  FE 90     CP  $90         ; 144 = first VBlank line
 *     0157  20 FA     JR  NZ,W1
 *     0159  0C        INC C
 *     015A  79        LD  A,C
 *     015B  E0 47     LDH ($47),A     ; BGP = counter, written during VBlank
 *     015D  F0 44  W2 LDH A,($44)
 *     015F  FE 90     CP  $90
 *     0161  28 FA     JR  Z,W2
 *     0163  18 EE     JR  W1
 */
export function makeFrameMarkerCart(sizeKiB = 32) {
  const cart = new Uint8Array(sizeKiB * 1024);
  cart.set([0x00, 0xC3, 0x50, 0x01], 0x0100);
  cart.set([
    0xF3, 0xAF, 0x4F,
    0xF0, 0x44, 0xFE, 0x90, 0x20, 0xFA,
    0x0C, 0x79, 0xE0, 0x47,
    0xF0, 0x44, 0xFE, 0x90, 0x28, 0xFA,
    0x18, 0xEE,
  ], 0x0150);
  cart[0x0147] = 0x00;
  cart[0x0148] = Math.max(0, Math.log2(sizeKiB / 32) | 0);
  cart[0x0149] = 0x00;
  return cart;
}

/**
 * Score a framebuffer against the frame-marker cartridge.
 * @returns {{uniform:boolean, seamRow:number, shade:number}} seamRow is -1 when
 *          the frame is whole, which is the only acceptable answer.
 */
export function frameMarkerSeam(fb, w = SCREEN_W, h = SCREEN_H) {
  const shade0 = fb[0] & 3;
  let seamRow = -1;
  let prev = shade0;
  for (let y = 0; y < h; y++) {
    const s = fb[y * w] & 3;
    if (y > 0 && s !== prev && seamRow < 0) seamRow = y;
    prev = s;
  }
  return { uniform: seamRow < 0, seamRow, shade: shade0 };
}

/** Decode a landing-pad PC back to the JOYP nibble it reports, or -1. */
export function probeNibbleFromPC(pc) {
  const off = pc - PROBE_PAD_BASE;
  if (off < 0 || off >= 16 * 8 || (off % 8) !== 0) return -1;
  return off / 8;
}

/* ---------------------------------------------------------------------------
 *  Persistence — battery RAM and save states.  the UI design, section 12.
 *
 *  POLICY, and it is why these functions take and return bytes rather than
 *  writing anywhere themselves: a battery-RAM image is the cartridge's own
 *  memory and a save state is the whole machine, VRAM and framebuffer
 *  included. Both embed the title's graphics, so both are DERIVED CONTENT
 *  under exactly the rule that governs a rendered frame — gitignored, never
 *  committed, never printed, never pasted into a report. Nothing here logs a
 *  payload and nothing here has a network sink.
 * ------------------------------------------------------------------------- */

/** Identify a cartridge without storing one byte of it. */
export function cartFingerprint(bytes) {
  return (fnv1a(bytes) ^ (bytes.length >>> 0)) >>> 0;
}

export const STATE_MAGIC = 0x54534247;      /* "GBST", little-endian */
export const STATE_VERSION = 1;
export const STATE_HEADER = 32;
export const STATE_FLAG_BIOS = 1;

export class StateMismatch extends Error {
  constructor(msg) { super(msg); this.name = "StateMismatch"; }
}

/**
 * Snapshot a machine: header, then the raw context.
 * @param {object} machine a live GBMachine
 * @param {Uint8Array} cartBytes the cartridge it is running, for the fingerprint
 */
export function saveState(machine, cartBytes) {
  if (!machine || !machine.alive) throw new StateMismatch("no live machine to save");
  const ctxBytes = machine.context;
  const out = new Uint8Array(STATE_HEADER + ctxBytes.length);
  const dv = new DataView(out.buffer);
  dv.setUint32(0, STATE_MAGIC, true);
  dv.setUint32(4, STATE_VERSION, true);
  dv.setUint32(8, machine.host.coreVersion, true);
  dv.setUint32(12, ctxBytes.length, true);
  dv.setUint32(16, cartFingerprint(cartBytes), true);
  dv.setUint32(20, cartBytes.length, true);
  dv.setUint32(24, machine.frames >>> 0, true);
  dv.setUint32(28, machine.usedBios ? STATE_FLAG_BIOS : 0, true);
  out.set(ctxBytes, STATE_HEADER);
  return out;
}

/** Read a state's header without touching a machine. */
export function stateHeader(state) {
  if (!state || state.length < STATE_HEADER) throw new StateMismatch("not a save state (too short)");
  const dv = new DataView(state.buffer, state.byteOffset, state.byteLength);
  if (dv.getUint32(0, true) !== STATE_MAGIC) throw new StateMismatch("not a save state (bad magic)");
  return {
    version: dv.getUint32(4, true),
    coreVersion: dv.getUint32(8, true),
    contextLen: dv.getUint32(12, true),
    fingerprint: dv.getUint32(16, true),
    cartLen: dv.getUint32(20, true),
    frames: dv.getUint32(24, true),
    usedBios: !!(dv.getUint32(28, true) & STATE_FLAG_BIOS),
  };
}

/**
 * Restore a state into a machine ALREADY MOUNTED on the same cartridge.
 *
 * The context is not position-independent: struct GB holds live pointers into
 * wasm linear memory (boot firmware, cartridge). So once the bytes are back, gb_set_cart and
 * gb_set_bios are called again — they rewrite precisely those pointers, using
 * published ABI only. This depends on no struct offset, so the PPU role can
 * move every field in that struct and nothing here notices.
 *
 * Every mismatch REFUSES rather than coercing. A silently-wrong restore looks
 * exactly like an emulator bug and would cost somebody an afternoon.
 */
export function restoreState(machine, state, cartBytes) {
  if (!machine || !machine.alive) throw new StateMismatch("no live machine to restore into");
  const h = stateHeader(state);
  const host = machine.host;
  if (h.version !== STATE_VERSION)
    throw new StateMismatch("save state is format v" + h.version + ", this shell writes v" + STATE_VERSION);
  if (h.coreVersion !== host.coreVersion)
    throw new StateMismatch("save state is from core v" + h.coreVersion + ", this core is v" + host.coreVersion);
  if (h.contextLen !== host.contextBytes)
    throw new StateMismatch("save state holds a " + h.contextLen + " B context, this core's is " + host.contextBytes + " B");
  if (state.length < STATE_HEADER + h.contextLen)
    throw new StateMismatch("save state is truncated");
  if (h.fingerprint !== cartFingerprint(cartBytes))
    throw new StateMismatch("save state belongs to a different cartridge");
  if (h.usedBios !== machine.usedBios)
    throw new StateMismatch(h.usedBios
      ? "save state was made with a boot program; this machine started without one"
      : "save state was made without a boot program; this machine started with one");

  machine.context.set(state.subarray(STATE_HEADER, STATE_HEADER + h.contextLen));

  /* Re-point the two live pointers. Both must happen; order does not matter. */
  host.exports.gb_set_cart(machine.ctx, machine.cartPtr, machine.cartLen);
  host.exports.gb_set_bios(machine.ctx, machine.usedBios ? host.biosPtr : 0,
                           machine.usedBios && host.biosBytes ? host.biosBytes.length : 0);

  /* A button held when the state was taken must not be held now. */
  machine.buttons = 0;
  host.exports.gb_set_buttons(machine.ctx, 0);
  machine.frames = h.frames;
  return h;
}

/** Battery RAM out of / into a machine. Null when the cartridge has none. */
export function cramSnapshot(machine) {
  const c = machine && machine.alive ? machine.cram : null;
  return c ? new Uint8Array(c) : null;
}
export function cramRestore(machine, bytes) {
  const c = machine && machine.alive ? machine.cram : null;
  if (!c || !bytes || bytes.length !== c.length) return false;
  c.set(bytes);
  return true;
}

/* ---------------------------------------------------------------------------
 *  Export bundles.
 *
 *  The live store is IndexedDB and never leaves the machine; a bundle is how a
 *  user carries their OWN saves between their OWN browsers. Base64 is written
 *  by hand rather than via btoa/Buffer so the same code runs in the page and
 *  under Node — which is what lets test/ui_net.py check the round trip.
 *
 *  The conventional filenames are web/gb-saves.json and web/gb-states.json,
 *  which .gitignore already blocks: belt and braces, so a bundle dropped into
 *  the tree can never be committed.
 * ------------------------------------------------------------------------- */
const B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

export function toBase64(bytes) {
  let out = "";
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i], b = bytes[i + 1], c = bytes[i + 2];
    const n = (a << 16) | ((b === undefined ? 0 : b) << 8) | (c === undefined ? 0 : c);
    out += B64[(n >> 18) & 63] + B64[(n >> 12) & 63]
        + (b === undefined ? "=" : B64[(n >> 6) & 63])
        + (c === undefined ? "=" : B64[n & 63]);
  }
  return out;
}

export function fromBase64(str) {
  /* Padding is stripped by the filter, so the output length follows from the
   * count of DATA characters alone -- subtracting the pad as well is the
   * off-by-one that makes a one-byte payload decode to length -1. */
  const clean = str.replace(/[^A-Za-z0-9+/]/g, "");
  const out = new Uint8Array(Math.floor(clean.length * 3 / 4));
  let o = 0, acc = 0, bits = 0;
  for (let i = 0; i < clean.length; i++) {
    acc = (acc << 6) | B64.indexOf(clean[i]);
    bits += 6;
    if (bits >= 8) { bits -= 8; if (o < out.length) out[o++] = (acc >> bits) & 0xFF; }
  }
  return out;
}

/**
 * @param {string} kind "saves" or "states"
 * @param {Array<{key:string,label:string,bytes:Uint8Array}>} entries
 */
export function encodeBundle(kind, entries) {
  return JSON.stringify({
    format: "gameboy-" + kind,
    version: 1,
    note: "Derived content: this file embeds cartridge memory. Local only — never commit it.",
    entries: entries.map(e => ({ key: e.key, label: e.label || "", bytes: toBase64(e.bytes) })),
  }, null, 1);
}

export function decodeBundle(kind, text) {
  const j = JSON.parse(text);
  if (j.format !== "gameboy-" + kind)
    throw new StateMismatch("that is a \"" + j.format + "\" bundle, not gameboy-" + kind);
  if (j.version !== 1) throw new StateMismatch("bundle format v" + j.version + " is not supported");
  return j.entries.map(e => ({ key: e.key, label: e.label || "", bytes: fromBase64(e.bytes) }));
}

/**
 * A hash of the machine's whole context that is COMPARABLE ACROSS ARENA
 * LAYOUTS.
 *
 * Why this exists, recorded because the naive version looked right and was not:
 * hashing the raw context includes `struct GB`'s live pointers, so the same
 * emulated state saved and restored at a different cartridge address hashes
 * differently — for a reason that has nothing to do with emulation. Measured:
 * after a save/restore across a deliberately-moved arena, exactly ONE 32-bit
 * word out of 171,456 bytes differed, and it held the cartridge pointer.
 *
 * So the words holding a pointer are normalised out. This does NOT depend on
 * the struct's layout: the pointer VALUES come from published ABI
 * (machine.cartPtr, host.biosPtr) and the words are found by matching those
 * values, never by a hardcoded offset. The PPU role can move every field in
 * that struct and this still works.
 *
 * `normalised` is returned so a caller can assert it found something. A test
 * that compares two portable hashes without checking that any pointer was
 * actually normalised is not testing portability at all.
 */
export function contextHashPortable(machine) {
  const ctx = new Uint8Array(machine.context);          /* a copy; never the live view */
  const dv = new DataView(ctx.buffer);
  const ptrs = [machine.cartPtr, machine.host.biosPtr].filter(p => p > 0);
  let normalised = 0;
  for (let off = 0; off + 4 <= ctx.length; off += 4) {
    const w = dv.getUint32(off, true);
    if (ptrs.includes(w)) { dv.setUint32(off, 0, true); normalised++; }
  }
  return { hash: fnv1a(ctx), normalised };
}

/* ---------------------------------------------------------------------------
 *  Input remapping.  the UI design, section 16.
 *
 *  A key map is PREFERENCES: eight small integers and a handful of
 *  KeyboardEvent.code strings. It embeds no cartridge, no machine state and no
 *  graphics, so unlike a save state it is ordinary metadata — the same line the
 *  sibling draws between its tracked demo-scripts.json and its gitignored
 *  pm-states.json. It may be exported, shared or committed without thought;
 *  that is exactly what a save state may not be.
 *
 *  Pure and DOM-free so test/ui_net.py can check the invariants that matter:
 *  every button reachable, and no key driving two buttons at once.
 * ------------------------------------------------------------------------- */

export const KEYMAP_PREFS_VERSION = 1;

/** Structural check. Returns what is wrong, not just whether. */
export function validateKeymap(map) {
  const problems = [];
  const covered = new Set();
  for (const [code, bit] of Object.entries(map || {})) {
    if (typeof code !== "string" || !code.length) problems.push(`bad key name ${JSON.stringify(code)}`);
    if (!Number.isInteger(bit) || bit < 0 || bit > 7) problems.push(`${code} maps to ${bit}, not a button 0-7`);
    else covered.add(bit);
  }
  const missing = [];
  for (let b = 0; b < 8; b++) if (!covered.has(b)) missing.push(BTN_NAMES[b]);
  if (missing.length) problems.push(`unreachable: ${missing.join(", ")}`);
  return { ok: problems.length === 0, problems, missing };
}

/**
 * Bind `code` to `bit`, removing it from whatever it drove before.
 *
 * One key must never drive two buttons: the mask is built by OR-ing every
 * matching entry, so a duplicate would silently press two buttons at once and
 * present as an emulator input bug. Returns a NEW map; refuses (returns null)
 * if the rebind would leave some button unreachable.
 */
export function rebind(map, code, bit) {
  const next = {};
  for (const [k, v] of Object.entries(map)) if (k !== code) next[k] = v;
  next[code] = bit;
  return validateKeymap(next).ok ? next : null;
}

/** Remove a binding, unless it is the last key reaching its button. */
export function unbind(map, code) {
  const next = {};
  for (const [k, v] of Object.entries(map)) if (k !== code) next[k] = v;
  return validateKeymap(next).ok ? next : null;
}

/** Which keys currently reach a given button. */
export function keysFor(map, bit) {
  return Object.keys(map).filter(k => map[k] === bit);
}

export function keymapToPrefs(map) {
  return JSON.stringify({ format: "gameboy-keymap", version: KEYMAP_PREFS_VERSION, map });
}

/** Parse, validate, and fall back to the default rather than to a broken map. */
export function keymapFromPrefs(text, fallback = KEYMAP) {
  try {
    const j = JSON.parse(text);
    if (j.format !== "gameboy-keymap") return { map: fallback, why: "not a key-map file" };
    if (j.version !== KEYMAP_PREFS_VERSION) return { map: fallback, why: `unknown version ${j.version}` };
    const v = validateKeymap(j.map);
    if (!v.ok) return { map: fallback, why: v.problems.join("; ") };
    return { map: j.map, why: null };
  } catch (e) {
    return { map: fallback, why: e.message };
  }
}
