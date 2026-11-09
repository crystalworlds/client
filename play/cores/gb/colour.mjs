/*
 * play/cores/gb/colour.mjs -- two things about the picture that are not the core's business.
 * The core's frame is never changed: both are applied where its frame turns into pixels.
 *
 * TEAL, the Game Boy Light's panel. Four colours, as SameBoy 1.0.5 lists them (Core/display.c,
 * GB_PALETTE_GBL), put lightest first as web/shell.js PALETTES keeps every other palette. It lives
 * here and not in that list because web/ is copied byte for byte from the development tree.
 *
 * COLOUR CORRECTION. A Game Boy Color's screen is not a modern screen: the raw colours of a game
 * look too saturated on one. SameBoy's GB_convert_rgb15 (Core/display.c) was read to see what such
 * a correction consists of; this is our own, built as a table once at start-up:
 *   1. every channel goes through an S-shaped panel response, not a straight line. Ours is a smooth
 *      formula with the same kind of S as SameBoy's measured curve, set lower than that curve, which on
 *      its own brightens a beach scene (108.6 to 113.8) and calms its colour only a little (0.68 to 0.65);
 *   2. the panel's green carries some blue. The two mix as light, so through a gamma of 2.2;
 *   3. each channel takes a little of the other two, as the panel's pigments do.
 * White stays white and black stays black. The numbers below were chosen by eye and by measuring real
 * frames (a beach scene: saturation 0.68 down to 0.59, brightness about the same), not by photographing a
 * panel, so this is a pleasant approximation and is labelled so on the Game Boy Color's Emulation page.
 */
export const TEAL = { name: 'Teal (Game Boy Light)', rgb: [[0x7F, 0xE2, 0xC3], [0x56, 0xB4, 0x95], [0x35, 0x78, 0x62], [0x0A, 0x1C, 0x15]] };

const RESPONSE = 0.95;       // bends the S: the middle of the range comes out a little above half
const GAMMA = 2.2;
const GREEN_TAKES_BLUE = 1 / 4;
const CROSSTALK = 1 / 8;     // what a channel gives up, shared equally between the other two

/** BGR555 word -> ABGR pixel, for every word. */
export function colourCorrectionTable() {
  const out = new Uint32Array(32768), curve = new Float64Array(32);
  for (let x = 0; x < 32; x++) { const s = Math.pow(x / 31, RESPONSE); curve[x] = s * s * (3 - 2 * s); }
  const byte = v => Math.max(0, Math.min(255, Math.round(v * 255)));
  for (let c = 0; c < 32768; c++) {
    const r0 = curve[c & 31], g1 = curve[(c >> 5) & 31], b0 = curve[(c >> 10) & 31];
    const g0 = Math.pow(Math.pow(g1, GAMMA) * (1 - GREEN_TAKES_BLUE) + Math.pow(b0, GAMMA) * GREEN_TAKES_BLUE, 1 / GAMMA);
    const keep = 1 - CROSSTALK, give = CROSSTALK / 2;
    const r = byte(r0 * keep + (g0 + b0) * give), g = byte(g0 * keep + (r0 + b0) * give), b = byte(b0 * keep + (r0 + g0) * give);
    out[c] = ((0xFF << 24) | (b << 16) | (g << 8) | r) >>> 0;
  }
  return out;
}
