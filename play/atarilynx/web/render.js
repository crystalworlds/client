/* play/atarilynx/web/render.js — the Lynx's 160 x 102 LCD onto a canvas.
 *
 * SITE-OWNED. The raster is the core interface's: 160 x 102 uint16, each a
 * 12-bit colour (green 11-8, blue 7-4, red 3-0), UNROTATED. The Lynx carries its
 * palette in hardware, so there is no palette file — each 4-bit level becomes
 * level x 17, the core's own expansion.
 *
 * ROTATION IS NOT DONE HERE IN THE PLAY VIEW, ON PURPOSE. A title played with
 * the console on its side (Klax, Gauntlet: The Third Encounter) is played by
 * TURNING THE HANDHELD, so the play page draws the raster unrotated into the
 * measured aperture and turns the whole photograph-plus-screen with CSS
 * (index.html, #stage.turn-1 / .turn-2). The glare, the bezel and the picture
 * then turn together, exactly as the real thing does, and the aperture needs no
 * second measurement.
 *
 * THE TILE IS THE EXCEPTION. There the HOST draws the handheld, flat and
 * landscape, and this document is only what is behind its glass — it cannot
 * turn the host's photograph. So in tile mode a turned title is rotated HERE
 * and pillarboxed in black inside the landscape aperture: upright and
 * undistorted, which a sideways or stretched preview would not be.
 *
 * UNLESS THE HOST HAS TURNED ITS PHOTOGRAPH (2026-10-07, `hostTurned`, from
 * ?art=turned). A turned title now gets a one-column tile showing the handheld
 * on its side, whose glass is PORTRAIT. The surface is then portrait as well and
 * the turned picture FILLS it — the same picture the play page shows through
 * its turned handheld, with nothing to pillarbox. A visitor who has set such a
 * title upright with R still gets an upright picture, letterboxed this time.
 */
import { W, H } from './core.js';

export class Renderer {
  constructor(canvas, tileMode, hostTurned) {
    this.canvas = canvas;
    this.tile = !!tileMode;
    this.portrait = this.tile && !!hostTurned;   // the host's glass is portrait
    this.ctx = canvas.getContext('2d', { alpha: false });
    this.off = document.createElement('canvas');
    this.off.width = W;
    this.off.height = H;
    this.offCtx = this.off.getContext('2d', { alpha: false });
    this.img = this.offCtx.createImageData(W, H);
    this.px = new Uint32Array(this.img.data.buffer);
    this.rotation = -1;
    this.setRotation(0);
  }

  /* 0 upright, 1 turned left, 2 turned right (lynx_rotation's numbering). */
  setRotation(r) {
    r = r | 0;
    if (r === this.rotation) return;
    this.rotation = r;
    /* Play view: always the raster's own shape — the CSS turns the device.
     * Tile, turned: a landscape surface (the aperture's) four times the raster,
     * so the rotated picture can sit in it at an integer-ish scale. */
    if (this.portrait) { this.canvas.width = H * 4; this.canvas.height = W * 4; }
    else if (this.tile && r) { this.canvas.width = W * 4; this.canvas.height = H * 4; }
    else { this.canvas.width = W; this.canvas.height = H; }
    this.ctx.imageSmoothingEnabled = false;
    this.ctx.fillStyle = '#000';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
  }

  draw(core) {
    const raster = core.raster();
    const px = this.px;
    for (let i = 0; i < W * H; i++) {
      const c = raster[i];
      const r = (c & 15) * 17, g = ((c >> 8) & 15) * 17, b = ((c >> 4) & 15) * 17;
      px[i] = 0xFF000000 | (b << 16) | (g << 8) | r;
    }
    this.offCtx.putImageData(this.img, 0, 0);
    const cx = this.ctx;
    cx.imageSmoothingEnabled = false;
    if (this.portrait && !this.rotation) {
      /* Portrait glass, upright picture: fit its width, centre, black above
       * and below. */
      const cw = this.canvas.width, ch = this.canvas.height, dh = H * (cw / W);
      cx.drawImage(this.off, 0, (ch - dh) / 2, cw, dh);
      return;
    }
    if (!(this.tile && this.rotation)) {
      cx.drawImage(this.off, 0, 0);
      return;
    }
    /* Tile, turned: the picture is H wide and W tall once turned; fit its
     * height to the surface and centre it, black either side. On a portrait
     * surface (H*4 x W*4) that fit is exact and there are no sides. */
    const cw = this.canvas.width, ch = this.canvas.height;
    const s = ch / W;                         // turned height is the raster's width
    const dw = H * s, dh = W * s;
    cx.save();
    cx.translate(cw / 2, ch / 2);
    cx.rotate(this.rotation === 1 ? -Math.PI / 2 : Math.PI / 2);
    cx.drawImage(this.off, -dh / 2, -dw / 2, dh, dw);
    cx.restore();
  }
}
