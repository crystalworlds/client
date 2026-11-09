/*
 * play/cores/gb/lcd.mjs -- the screen's slow response (ghosting), for the Game Boy family (8 Nov 2026).
 * The core's frame is never changed: this works on the picture made from it, once per emulated frame.
 *
 * WHY. The handhelds' liquid crystal takes longer than one frame (1/60 s) to change. A game that draws
 * something on one frame and not the next (Chikyuu Kaihou Gun ZAS, and many games that share sprites
 * between frames) therefore shows a steady, half-transparent picture on the real screen, never a blink.
 * A modern screen follows every frame, so without this the same game blinks 30 times a second.
 *
 * WHAT. Each emulated frame, every pixel of the picture moves part of the way toward its new value, as
 * the crystal does, in linear light (light mixes on the panel, not in the numbers a file stores):
 *   1. the target is the mean of this frame and the one before: a panel slower than one frame cannot
 *      follow a change made every other frame, so such a change settles at its middle with no beat;
 *   2. the shown value moves toward that target by a share per frame (FOLLOW below): a smaller share is
 *      a slower panel and a longer trail behind moving things.
 * Run per emulated frame, never per painted picture, so a browser that paints 30 pictures a second shows
 * the same settled picture as one that paints 60: the panel saw every frame either way.
 *
 * THE NUMBERS ARE FITTED, NOT MEASURED. No published measurement of these panels' response was found.
 * The shares are chosen by eye on moving games against what each panel is known for: the original
 * Game Boy's screen smears clearly, the Pocket's and Light's improved screen less, the Color's less again.
 * SameBoy (read for understanding, nothing taken) blends each frame with the one before, by thirds in
 * alternating rows; this is our own model. The Super Game Boy draws on a television, whose glow fades
 * within a few thousandths of a second, so it has no ghosting unless asked for.
 */
export const PANELS = {
  dmg: { name: 'Game Boy', follow: 0.55 },
  pocket: { name: 'Game Boy Pocket and Light', follow: 0.7 },
  cgb: { name: 'Game Boy Color', follow: 0.8 },
  tv: { name: 'Television (Super Game Boy)', follow: 1 },
};

const GAMMA = 2.2;
const TO_LIN = new Uint16Array(256);            // byte -> linear light, 0..65535
const FROM_LIN = new Uint8Array(4096);          // linear light >> 4 -> byte
for (let i = 0; i < 256; i++) TO_LIN[i] = Math.round(Math.pow(i / 255, GAMMA) * 65535);
for (let i = 0; i < 4096; i++) FROM_LIN[i] = Math.round(Math.pow((i + 0.5) / 4096, 1 / GAMMA) * 255);

/** A screen of `n` pixels. push(abgr) takes one emulated frame (ABGR, n pixels) and returns the picture shown. */
export function slowScreen() {
  let n = 0, prev = null, lit = null, out = null, last = null, done = null, fresh = true, share = 256;
  return {
    /** follow: 0..1, the share of the way a pixel moves each frame (1 = no trail, only the two-frame mean). */
    set(follow) { share = Math.max(1, Math.min(256, Math.round(follow * 256))); },
    /** The next frame starts again from the picture itself (a load, a reset, a rewind, a new size). */
    reset() { fresh = true; },
    get picture() { return out; },
    push(src, count) {
      if (count !== n) { n = count; prev = new Uint16Array(n * 3); lit = new Int32Array(n * 3); out = new Uint32Array(n); last = new Uint32Array(n); done = new Uint8Array(n); fresh = true; }
      const s = share;
      if (fresh) {
        fresh = false;
        for (let i = 0, j = 0; i < n; i++, j += 3) {
          const p = src[i];
          const r = TO_LIN[p & 255], g = TO_LIN[(p >> 8) & 255], b = TO_LIN[(p >> 16) & 255];
          prev[j] = r; prev[j + 1] = g; prev[j + 2] = b; lit[j] = r; lit[j + 1] = g; lit[j + 2] = b;
          out[i] = p | 0xFF000000; last[i] = p; done[i] = 1;
        }
        return out;
      }
      for (let i = 0, j = 0; i < n; i++, j += 3) {
        const p = src[i];
        if (done[i] && p === last[i]) continue;          // a settled pixel the game did not change: nothing to do
        last[i] = p;
        const r = TO_LIN[p & 255], g = TO_LIN[(p >> 8) & 255], b = TO_LIN[(p >> 16) & 255];
        let a = lit[j], c = lit[j + 1], d = lit[j + 2];
        const ta = (r + prev[j]) >> 1, tc = (g + prev[j + 1]) >> 1, td = (b + prev[j + 2]) >> 1;
        a += (ta - a) * s >> 8; c += (tc - c) * s >> 8; d += (td - d) * s >> 8;
        // the last little way at once, so a still picture ends exactly as the game drew it
        if (a - ta < 4 && ta - a < 4) a = ta;
        if (c - tc < 4 && tc - c < 4) c = tc;
        if (d - td < 4 && td - d < 4) d = td;
        prev[j] = r; prev[j + 1] = g; prev[j + 2] = b;
        lit[j] = a; lit[j + 1] = c; lit[j + 2] = d;
        done[i] = ta === r && tc === g && td === b && a === r && c === g && d === b ? 1 : 0;
        out[i] = (a === r && c === g && d === b) ? (p | 0xFF000000) >>> 0
          : (0xFF000000 | ((d === b ? (p >> 16) & 255 : FROM_LIN[d >> 4]) << 16) | ((c === g ? (p >> 8) & 255 : FROM_LIN[c >> 4]) << 8) | (a === r ? p & 255 : FROM_LIN[a >> 4])) >>> 0;
      }
      return out;
    },
  };
}
