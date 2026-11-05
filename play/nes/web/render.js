/* render.js — 2C02 palette index + emphasis  ->  RGBA for a canvas.
 *
 * This module has NO Game Boy counterpart and is the first place the NES stops
 * being a port.  The Game Boy core hands the shell a greyscale or CGB-RGB555
 * pixel and the shell is done.  The NES hands out a PALETTE INDEX, and the
 * index means nothing without a table that the hardware does not contain: the
 * 2C02 generates colour as an analogue NTSC signal, so every "NES palette" in
 * existence is somebody's measurement or somebody's taste.
 *
 * WHAT THIS TABLE IS.  It is a widely-used emulator palette convention.  It
 * is a CONVENTION, not a measurement taken by this project, and it is
 * labelled as such so no one later reads it as a scored result.  Choosing a
 * different table changes every pixel on screen and changes no board row.
 * For a different look, this file is the single place to change
 * and nothing else needs to know.
 *
 * EMPHASIS.  Bits 6-8 of each framebuffer word are PPUMASK's red/green/blue
 * emphasis bits as they stood at that pixel.  Real hardware attenuates the two
 * channels that are NOT emphasised by roughly 25%; setting all three darkens
 * everything.  Implemented as an 8-way multiplier table rather than a second
 * 512-entry palette because the former is legible and costs one multiply.
 */

/* 64 entries, RGB triplets. */
const BASE = new Uint8Array([
  0x54,0x54,0x54, 0x00,0x1E,0x74, 0x08,0x10,0x90, 0x30,0x00,0x88,
  0x44,0x00,0x64, 0x5C,0x00,0x30, 0x54,0x04,0x00, 0x3C,0x18,0x00,
  0x20,0x2A,0x00, 0x08,0x3A,0x00, 0x00,0x40,0x00, 0x00,0x3C,0x00,
  0x00,0x32,0x3C, 0x00,0x00,0x00, 0x00,0x00,0x00, 0x00,0x00,0x00,
  0x98,0x96,0x98, 0x08,0x4C,0xC4, 0x30,0x32,0xEC, 0x5C,0x1E,0xE4,
  0x88,0x14,0xB0, 0xA0,0x14,0x64, 0x98,0x22,0x20, 0x78,0x3C,0x00,
  0x54,0x5A,0x00, 0x28,0x72,0x00, 0x08,0x7C,0x00, 0x00,0x76,0x28,
  0x00,0x66,0x78, 0x00,0x00,0x00, 0x00,0x00,0x00, 0x00,0x00,0x00,
  0xEC,0xEE,0xEC, 0x4C,0x9A,0xEC, 0x78,0x7C,0xEC, 0xB0,0x62,0xEC,
  0xE4,0x54,0xEC, 0xE4,0x58,0xA0, 0xE4,0x68,0x58, 0xD4,0x88,0x58,
  0xA0,0xAA,0x00, 0x74,0xC4,0x00, 0x4C,0xD0,0x20, 0x38,0xCC,0x6C,
  0x38,0xB4,0xCC, 0x3C,0x3C,0x3C, 0x00,0x00,0x00, 0x00,0x00,0x00,
  0xEC,0xEE,0xEC, 0xA8,0xCC,0xEC, 0xBC,0xBC,0xEC, 0xD4,0xB2,0xEC,
  0xEC,0xAE,0xEC, 0xEC,0xAE,0xD4, 0xEC,0xB4,0xB0, 0xE4,0xC4,0x90,
  0xCC,0xD2,0x78, 0xB4,0xDE,0x78, 0xA8,0xE2,0x90, 0x98,0xE2,0xB4,
  0xA0,0xD6,0xE4, 0xA0,0xA2,0xA0, 0x00,0x00,0x00, 0x00,0x00,0x00,
]);

export const PALETTE_NAME = 'common emulator palette (convention, not a measurement)';

const ATTEN = 0.746;

/* 512 entries: 8 emphasis states x 64 colours, pre-multiplied into packed
 * little-endian RGBA (what Uint32Array over ImageData wants on LE hosts).
 * Building it once at module load costs ~0.1ms and removes all per-pixel
 * branching from the hot loop. */
function buildLUT() {
  const lut = new Uint32Array(512);
  for (let e = 0; e < 8; e++) {
    const er = !!(e & 1), eg = !!(e & 2), eb = !!(e & 4);
    /* THE RULE, stated once: setting an emphasis bit attenuates the two
     * channels it does not name.  Nothing is ever boosted.  All three set
     * therefore attenuates all three — each channel is dimmed by the other two
     * being set — which is why "all emphasis on" darkens the picture rather
     * than leaving it alone, and why no special case for it is needed. */
    const mr = (eg || eb) ? ATTEN : 1;
    const mg = (er || eb) ? ATTEN : 1;
    const mb = (er || eg) ? ATTEN : 1;
    for (let c = 0; c < 64; c++) {
      const r = Math.round(Math.min(255, BASE[c * 3]     * mr));
      const g = Math.round(Math.min(255, BASE[c * 3 + 1] * mg));
      const b = Math.round(Math.min(255, BASE[c * 3 + 2] * mb));
      lut[e * 64 + c] = (0xff << 24) | (b << 16) | (g << 8) | r;
    }
  }
  return lut;
}

export const LUT = buildLUT();

/* Convert one 256x240 uint16 framebuffer into `out`, a Uint32Array view over
 * an ImageData's data buffer.  Hot loop: one mask, one shift, one table read
 * per pixel. */
export function blit(fb, out) {
  for (let i = 0; i < fb.length; i++) {
    const v = fb[i];
    out[i] = LUT[((v >> 6) & 7) * 64 + (v & 0x3f)];
  }
}

/* Same, but writing RGB bytes — used by the headless Node bench to produce a
 * PNG without an ImageData. */
export function blitRGB(fb, out) {
  for (let i = 0; i < fb.length; i++) {
    const p = LUT[((fb[i] >> 6) & 7) * 64 + (fb[i] & 0x3f)];
    out[i * 3] = p & 0xff; out[i * 3 + 1] = (p >> 8) & 0xff; out[i * 3 + 2] = (p >> 16) & 0xff;
  }
}
