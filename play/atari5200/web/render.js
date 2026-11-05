/* play/atari5200/web/render.js: ANTIC and GTIA's raster onto a canvas.
 *
 * SITE-OWNED. See web/core.js's header for why this layer is not vendored.
 *
 * THE RASTER is 384 x 240 bytes (the core interface "Picture"), each GTIA's
 * colour byte: hue in bits 7-4, luminance in 3-0, the same layout as MARIA's,
 * so the core project's 5200 page maps it through palette7800.js's NTSC table and so
 * does this one (web/palette7800.js, vendored byte-identical from the core's own project).
 * Only columns 24-359 are drawn; the 24 blank columns either side are cropped
 * here, so blanking never reaches the aperture as a black band, which would read
 * as the artwork being misaligned.
 *
 * THE CANVAS IS 336 x 240, the drawn area in half-colour-clock pixels. Shown at
 * 4:3 (the aperture, or the bare canvas rule in index.html), it is stretched
 * the way a television stretched it; atari-screen.css's .atari-screen gives the
 * reason for letting the aperture do the stretch.
 */
import { RASTER_W, RASTER_H, DRAWN_X, DRAWN_W } from './core.js';
import { NTSC } from './palette7800.js';

/* 0xRRGGBB -> 0xFFBBGGRR, the little-endian view of RGBA bytes, once. */
const LUT = new Uint32Array(256);
for (let i = 0; i < 256; i++) {
  const c = NTSC[i];
  LUT[i] = 0xFF000000 | ((c & 0xFF) << 16) | (c & 0xFF00) | ((c >> 16) & 0xFF);
}

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.canvas.width = DRAWN_W;
    this.canvas.height = RASTER_H;
    this.ctx = canvas.getContext('2d', { alpha: false });
    this.img = this.ctx.createImageData(DRAWN_W, RASTER_H);
    this.px = new Uint32Array(this.img.data.buffer);
  }

  /* `core` is web/core.js's Core. Its raster view is read and dropped here. */
  draw(core) {
    const raster = core.raster();
    const px = this.px;
    for (let y = 0; y < RASTER_H; y++) {
      const src = y * RASTER_W + DRAWN_X, dst = y * DRAWN_W;
      for (let x = 0; x < DRAWN_W; x++) px[dst + x] = LUT[raster[src + x]];
    }
    this.ctx.putImageData(this.img, 0, 0);
  }
}
