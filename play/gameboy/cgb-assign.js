/* cgb-assign.js — the Game Boy Color boot firmware's palette assignment, as it
 * really works.
 *
 * WHAT THE HARDWARE DOES, AND WHAT THIS REPRODUCES.
 *
 * Put an ORIGINAL Game Boy cartridge into a Game Boy Color and it comes up in
 * colour. Nothing in the cartridge asked for that: the cartridge is a DMG
 * cartridge and emits four shades. The colour is added by the CONSOLE, in its
 * 2,304-byte boot firmware, before the cartridge ever runs:
 *
 *   1. Sum the SIXTEEN bytes of the cartridge's internal title field
 *      ($0134..$0143) modulo $100. That byte is the title hash.
 *   2. If the cartridge is Nintendo-licensed, look the hash up in a 79-entry
 *      table. Where two games collide on the hash, the FOURTH byte of the
 *      internal title ($0137) decides between them.
 *   3. A hit assigns three four-colour palettes — background, OBJ0 and OBJ1 —
 *      loaded into the Color's palette RAM. Sprites and background are coloured
 *      INDEPENDENTLY; that separation is most of what makes the result look
 *      like a coloured game rather than a tinted one.
 *   4. A miss (unknown game, or not a Nintendo licensee) gets the dummy entry,
 *      and the player may override it by holding one of twelve button
 *      combinations while the Color logo is on screen.
 *
 * So the assignment is a HASH FUNCTION over the header, not a list of game
 * names. Any cartridge whose header hashes into the table gets its colours —
 * including a prototype, a revision or a hack that nobody has ever tabulated,
 * as long as its title field sums the same way. That is why this file computes
 * the hash from the bytes rather than matching a filename.
 *
 * The tables themselves are generated into ./cgb-palettes.js — see
 * tools/build_cgb_palettes.mjs.
 *
 * NO DOM, NO CORE, NO I/O. Everything here is a function of its arguments, so
 * it can be checked against real cartridge headers outside a browser. That is
 * what tools/cgb_assign_test.mjs does.
 */

import { CGB_ASSIGNED, CGB_MANUAL } from "./cgb-palettes.js";

/* Header offsets. The title field is SIXTEEN bytes from $0134 and the boot firmware
 * sums all sixteen — including $0143, which later cartridges reuse as the CGB
 * flag, and $013F..$0142, which later cartridges reuse as a manufacturer code.
 * Summing "the title" as a trimmed string instead of as sixteen bytes is the
 * classic way to get a hash that is right for old cartridges and wrong for new
 * ones, so the range is fixed and the string is only ever for display. */
export const TITLE_OFF = 0x0134;
export const TITLE_LEN = 0x10;
export const DIS_OFF = 0x0137;        // fourth title byte: the collision tiebreak
export const NEW_LIC_OFF = 0x0144;    // two ASCII digits
export const OLD_LIC_OFF = 0x014b;    // one byte; $33 means "see the new code"
export const HEADER_MIN = 0x0150;     // a cartridge image shorter than this has no header

/* The boot firmware's dummy entry: table $03, entry $1C. The ReadMe for the table
 * extract names it explicitly — "all games without a Nintendo licensee id
 * (either old or new) or which cannot be found in the table get assigned this
 * entry". It is ALSO reachable by holding A + Right, which is why it appears in
 * the manual list rather than the assigned one.
 *   This is the reason an unrecognised original cartridge on a Game Boy Color
 * comes up green-and-red rather than grey. Defaulting the manual picker to
 * anything else would be a prettier lie. */
export const CGB_DEFAULT_TABLE = 0x03;
export const CGB_DEFAULT_ENTRY = 0x1c;

/** The manual configuration the boot firmware falls back to when nothing matches. */
export function cgbDefaultManual() {
  return (
    CGB_MANUAL.find((m) => m.t === CGB_DEFAULT_TABLE && m.e === CGB_DEFAULT_ENTRY) ||
    CGB_MANUAL[0]
  );
}

/* --------------------------------------------------------------------------
 *  The hash
 * ------------------------------------------------------------------------ */

/**
 * The CGB boot firmware's title hash: the sixteen title bytes summed mod $100.
 *
 * @param {Uint8Array} cart  the cartridge image, from byte 0
 * @returns {number} 0..255
 */
export function cgbTitleHash(cart) {
  requireHeader(cart);
  let sum = 0;
  for (let i = 0; i < TITLE_LEN; i++) sum = (sum + cart[TITLE_OFF + i]) & 0xff;
  return sum;
}

/** The fourth byte of the internal title — the collision tiebreak. */
export function cgbDisambiguation(cart) {
  requireHeader(cart);
  return cart[DIS_OFF];
}

/**
 * Is this a Nintendo-licensed cartridge? The boot firmware only colours those.
 *
 * $014B is the old one-byte licensee code. $01 IS Nintendo. The value $33 means
 * "the real code is the two ASCII digits at $0144", where "01" is Nintendo.
 * Anything else — Hudson's $18, Konami's $A4 — is a third-party cartridge and
 * the boot firmware does not look it up at all, however well its title might hash.
 */
export function cgbIsNintendo(cart) {
  requireHeader(cart);
  const old = cart[OLD_LIC_OFF];
  if (old === 0x01) return true;
  if (old !== 0x33) return false;
  return cart[NEW_LIC_OFF] === 0x30 && cart[NEW_LIC_OFF + 1] === 0x31;   // "01"
}

/** The internal title as text, for display only. Never used for the hash. */
export function cgbTitleText(cart) {
  requireHeader(cart);
  let s = "";
  for (let i = 0; i < TITLE_LEN; i++) {
    const b = cart[TITLE_OFF + i];
    if (b === 0) break;
    s += b >= 0x20 && b < 0x7f ? String.fromCharCode(b) : " ";
  }
  return s.replace(/\s+$/, "");
}

function requireHeader(cart) {
  if (!cart || typeof cart.length !== "number" || cart.length < HEADER_MIN)
    throw new Error(
      `cgb-assign: need at least ${HEADER_MIN} bytes of cartridge to read a header, got ` +
      (cart && cart.length ? cart.length : 0)
    );
}

/* --------------------------------------------------------------------------
 *  The lookup
 * ------------------------------------------------------------------------ */

/**
 * Look a hash up the way the boot firmware does.
 *
 * The exact-key-then-plain-key order matters and is not a micro-optimisation:
 * where a hash is shared, EVERY sharer carries a disambiguation byte (the
 * generator asserts this), so a shared hash is only ever reachable through the
 * "hash:byte" key. An unshared hash is only ever reachable through the plain
 * one. Trying the exact key first therefore resolves collisions correctly and
 * never shadows a unique entry.
 *
 * @returns the assigned configuration, or null for no match.
 */
export function cgbLookup(hash, dis) {
  const h = "0x" + (hash & 0xff).toString(16).toUpperCase().padStart(2, "0");
  const d = "0x" + (dis & 0xff).toString(16).toUpperCase().padStart(2, "0");
  return CGB_ASSIGNED[h + ":" + d] || CGB_ASSIGNED[h] || null;
}

/**
 * The whole decision for one cartridge.
 *
 * ***THIS FUNCTION IS TOTAL. IT NEVER THROWS.***
 *
 * The library this serves is whatever a visitor drops on the page: homebrew,
 * translation patches, aftermarket cartridges, multicarts, trimmed dumps,
 * overdumps and files that are not cartridges at all. Every one of those still
 * has to end up somewhere sensible, and "somewhere sensible" is always
 * available — the manual palettes exist precisely for cartridges the console
 * does not recognise, and an unrecognised cartridge is the COMMON case in a
 * general library, not an error in it.
 *
 * So a malformed header is not an exception here. It is an answer: unassigned,
 * with the boot firmware's own default configuration and a reason the UI can show.
 * A throw would take the play page down for a bad dump.
 *
 * @param {Uint8Array} cart
 * @returns {{
 *   assigned: boolean,       // true -> the console chose; false -> the player chooses
 *   config: object,          // the three palettes to apply, either way
 *   hash: number, dis: number, title: string,
 *   nintendo: boolean,
 *   reason: 'assigned'|'not-in-table'|'not-nintendo'|'no-header',
 *   games: string[]          // the titles that share this configuration, if assigned
 * }}
 *
 * `config` is ALWAYS populated — with the assigned entry on a hit and with the
 * boot firmware's dummy entry on a miss — so a caller never has to decide what to
 * show while it works out what happened. `assigned` is what the UI must surface:
 * "your cartridge is one of the 94 the console knows" is a real fact about the
 * cartridge, and showing a manual picker for one of those would read as a bug.
 */
export function cgbAssignmentFor(cart) {
  const manual = (reason, extra) => ({
    assigned: false, config: cgbDefaultManual(), hash: 0, dis: 0, title: "",
    nintendo: false, reason, games: [], ...extra,
  });

  /* Not enough bytes to hold a header. A 32 KiB minimum is the smallest real
     cartridge, but nothing here needs that much — only $0150 — so the test is
     "can the header be read", which is the question actually being asked. */
  if (!cart || typeof cart.length !== "number" || cart.length < HEADER_MIN)
    return manual("no-header");

  let hash, dis, title, nintendo;
  try {
    hash = cgbTitleHash(cart);
    dis = cgbDisambiguation(cart);
    title = cgbTitleText(cart);
    nintendo = cgbIsNintendo(cart);
  } catch {
    /* Belt and braces: the length check above already covers every throw these
       can produce today. If a future reader adds one, a general library is the
       worst place to discover it. */
    return manual("no-header");
  }

  if (!nintendo)
    return manual("not-nintendo", { hash, dis, title });

  const hit = cgbLookup(hash, dis);
  if (!hit)
    return manual("not-in-table", { hash, dis, title, nintendo: true });

  /* ***THE HASH $00 ROW IS THE DUMMY, NOT AN ASSIGNMENT.***
   *
   * The table carries one row with no game names, and the source ReadMe says
   * what it is: "Entry 0x03/0x1C with hash 0x00 is actually a dummy entry. All
   * games without a Nintendo licensee id ... or which cannot be found in the
   * table get assigned this entry."  It is the fall-through, sitting in the
   * table so the boot firmware's search always terminates somewhere.
   *
   * A blank sixteen-byte title sums to $00 and reaches it — and homebrew with
   * an empty header is exactly the cartridge a general library will produce.
   * Announcing "assigned by the console" for one would be announcing a match
   * that did not happen, and would hide the manual picker the player then has
   * no way to reach. So a hit with no names is a MISS with the right colours.
   *
   * Matched on the absence of names rather than on table 0x03/0x1C: hash $3F is
   * a REAL assignment that happens to share that same entry, and a test on the
   * entry number would wrongly demote it. */
  if (hit.games.length === 0)
    return manual("not-in-table", { hash, dis, title, nintendo: true, config: hit });

  return { assigned: true, config: hit, hash, dis, title,
           nintendo: true, reason: "assigned", games: hit.games.slice() };
}

/* --------------------------------------------------------------------------
 *  Colours
 * ------------------------------------------------------------------------ */

/** "#RRGGBB" -> [r, g, b]. */
export function hexToRgb(hex) {
  const n = parseInt(String(hex).replace(/^#/, ""), 16);
  return [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff];
}

/** One four-colour palette -> the flat little-endian ABGR LUT the blit wants.
 *  Byte order matches paletteLUT() in web/shell.js exactly: a CGB palette and a
 *  panel palette must be interchangeable at the blit or one of them is wrong. */
export function cgbLUT(palette) {
  const lut = new Uint32Array(4);
  for (let i = 0; i < 4; i++) {
    const [r, g, b] = hexToRgb(palette[i]);
    lut[i] = (0xff << 24) | (b << 16) | (g << 8) | r;
  }
  return lut;
}

/** All three LUTs of a configuration. */
export function cgbLUTs(config) {
  return { bg: cgbLUT(config.bg), obj0: cgbLUT(config.obj0), obj1: cgbLUT(config.obj1) };
}

/** A configuration's display name, for the picker. Manual entries are named by
 *  the button combination that summons them on real hardware — which is both
 *  the truthful label and the more interesting one. */
export function cgbConfigName(config) {
  return config.combo
    ? config.combo
    : "Table " + hx(config.t) + " entry " + hx(config.e);
}
const hx = (n) => "0x" + (n & 0xff).toString(16).toUpperCase().padStart(2, "0");

/* --------------------------------------------------------------------------
 *  Driving the real mechanism
 * ------------------------------------------------------------------------ */

/* Bit positions, matching BTN in web/core.js. Duplicated rather than imported
 * because this module is deliberately free of core imports so it can be checked
 * outside a browser — and because these eight numbers are the Game Boy's joypad
 * wiring, not a choice either file made. A drift here would show up instantly
 * as the wrong palette, which is the cheapest possible detector. */
const BIT = { A: 0, B: 1, SELECT: 2, START: 3, RIGHT: 4, LEFT: 5, UP: 6, DOWN: 7 };

/**
 * The button mask for a manual configuration's combination.
 *
 * THIS IS HOW THE MANUAL PALETTE IS REALLY SELECTED. On hardware you hold, say,
 * B + Left while the Color logo drops, and the boot program reads the joypad
 * and picks that entry. Given a CGB boot program, the emulator can do exactly
 * that — hold the mask from reset through the logo — and the palette arrives
 * because the boot firmware chose it, not because anything here painted it on.
 *
 * @param {string} combo  e.g. "B + Left", "Up"
 * @returns {number} a gb_set_buttons mask
 */
export function cgbComboMask(combo) {
  let mask = 0;
  for (const part of String(combo || "").split("+")) {
    const bit = BIT[part.trim().toUpperCase()];
    if (bit === undefined) throw new Error(`cgb-assign: unknown button "${part.trim()}" in "${combo}"`);
    mask |= 1 << bit;
  }
  return mask;
}

/** How long to hold the combination, in frames.
 *  The Color's logo animation runs for roughly three and a half seconds before
 *  handover; the boot program samples the joypad during it. Holding for four
 *  seconds covers the sample with margin and is released well before any title
 *  screen can read the pad, so nothing downstream sees a phantom press. */
export const CGB_COMBO_HOLD_FRAMES = 240;

/**
 * Is the Game Boy Color palette meaningful for this cartridge?
 *
 * Only for an ORIGINAL cartridge. A Game Boy Color cartridge ($0143 bit 7 set)
 * carries its own palettes and colours itself; offering to assign it one would
 * be offering to overwrite an artist's work with a lookup table.
 *
 * Total, like cgbAssignmentFor: something unreadable is not a Color cartridge,
 * so the palettes are offered and the manual path takes it from there.
 */
export function cgbAppliesTo(cart) {
  if (!cart || typeof cart.length !== "number" || cart.length < HEADER_MIN) return true;
  return (cart[0x0143] & 0x80) === 0;
}

/** The hover text behind the status line. Same audience, same rule: this is
 *  read by somebody playing a game, so it says what happened and stops. The
 *  title hash, the lookup table and the licensee byte are how the answer is
 *  REACHED and are not offered here -- the emulation documentation is where a
 *  curious reader should find them, not a tooltip in the play window. */
export function cgbExplain(a) {
  if (a.assigned)
    return "A Game Boy Color recognises this cartridge and colours it without being " +
           "asked. These are those colours.";
  /* Unlisted and unlicensed are one sentence on purpose: the distinction is
     real inside the boot firmware and invisible to the player, whose twelve choices
     are the same either way. */
  return "A Game Boy Color has no colours of its own for this cartridge, so it " +
         "offers twelve to choose between.";
}
