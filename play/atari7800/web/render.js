/* play/atari7800/web/render.js — MARIA's raster (or the TIA's, in 2600 mode) onto a canvas.
 *
 * SITE-OWNED. See web/core.js's header for why this layer is not vendored.
 *
 * TWO RASTERS, ONE CANVAS. the core interface "Video": in 7800 mode the
 * raster is 320 bytes a row, each MARIA's colour (hue 7..4, luminance 3..0),
 * turned into RGB by web/palette7800.js — vendored byte-identical from the
 * core's own project. In 2600 mode it is the 2600 core's raster: 160 bytes a row, TIA colour
 * values, the 2600 PALETTE. That palette is NOT copied into this directory: it
 * is imported from ../../atari2600/web/palette.js, which is already the core project's
 * file vendored byte-identical and checked by WASM_Source/atari/verify.sh §3.
 * A second copy here would be a second thing for that check to miss.
 *
 * THE WINDOWS are core.js's WIN7800 / WIN2600 — rows 16 to 258
 * shown on NTSC — so blanking never reaches the aperture as a black band, which would
 * read as the artwork being misaligned.
 *
 * THE CANVAS IS 320 x window height in both modes. In 7800 mode that is the
 * raster's own square pixels (320x243 = 1.317, and the measured aperture is
 * 1.336); in 2600 mode the 160 columns are drawn twice as wide, the 2:1 the
 * hardware put on glass. Either way the aperture stretches the remainder, for
 * the reason atari-screen.css gives at .atari-screen.
 */
import { WIN7800, WIN2600 } from './core.js';
import * as PAL7800 from './palette7800.js';
import * as PAL2600 from '../../atari2600/web/palette.js';

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false });
    this.off = document.createElement('canvas');
    this.off.width = 320;
    this.off.height = 313;
    this.offCtx = this.off.getContext('2d', { alpha: false });
    this.img = this.offCtx.createImageData(320, 313);
    this.px = new Uint32Array(this.img.data.buffer);
    this.key = '';
  }

  /* Resize only when the mode or the region changes: assigning canvas.height
   * clears the canvas and reallocates its backing store, so doing it every
   * frame is a flash and an allocation per frame. */
  shape(in2600, region) {
    const key = (in2600 ? '26' : '78') + ':' + region;
    if (key === this.key) return;
    this.key = key;
    const win = (in2600 ? WIN2600 : WIN7800)[region] || WIN7800[0];
    this.canvas.width = 320;
    this.canvas.height = win.h;
    this.ctx.imageSmoothingEnabled = false;
  }

  /* `core` is web/core.js's Core. Its raster view is read and dropped here. */
  draw(core) {
    const in2600 = core.inTwoSixHundredMode();
    const region = core.region();
    this.shape(in2600, region);
    const win = (in2600 ? WIN2600 : WIN7800)[region] || WIN7800[0];
    const pal = (in2600 ? PAL2600 : PAL7800)[region ? 'PAL' : 'NTSC'];
    const w = core.rasterWidth();
    const lines = core.rasterLines();
    const raster = core.raster(Math.max(lines, win.y + win.h));
    const px = this.px;
    for (let y = 0; y < win.h; y++) {
      const src = (win.y + y) * w, dst = y * 320, live = (win.y + y) < lines;
      for (let x = 0; x < w; x++) {
        const c = live ? pal[raster[src + x]] : 0;
        /* 0xRRGGBB -> 0xFFBBGGRR, the little-endian view of RGBA bytes. */
        px[dst + x] = 0xFF000000 | ((c & 0xFF) << 16) | (c & 0xFF00) | ((c >> 16) & 0xFF);
      }
    }
    this.offCtx.putImageData(this.img, 0, 0, 0, 0, w, win.h);
    this.ctx.imageSmoothingEnabled = false;
    this.ctx.drawImage(this.off, 0, 0, w, win.h, 0, 0, this.canvas.width, this.canvas.height);
  }
}
