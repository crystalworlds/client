/* matrix.js — "Matrix Mode": the visible pixel grid of a real Game Boy LCD.
 *
 * ---------------------------------------------------------------------------
 * WHAT IT IS
 * ---------------------------------------------------------------------------
 * A real DMG/CGB panel does not paint 160x144 edge-to-edge squares. Every cell
 * has a thin unlit border on its RIGHT and BOTTOM edge, so a lit screen reads
 * as a grid of pixels rather than as a picture. Matrix Mode reproduces that.
 *
 * ---------------------------------------------------------------------------
 * WHY IT IS A SEPARATE CANVAS, AND WHY THAT IS NOT A SHORTCUT
 * ---------------------------------------------------------------------------
 * This is PRESENTATION AND NOTHING ELSE. It must not be able to move a frame
 * hash, a save state, a tile video or anything a test scores, and "must not"
 * is worth more than an assurance: the grid is drawn on a SECOND canvas that
 * sits over the emulator's, and the emulator's framebuffer, its ImageData and
 * its putImageData are not touched at all. There is no code path from here
 * into the core. A frame hash taken with Matrix Mode on is bit-identical to
 * one taken with it off because the bytes it hashes were never shown this
 * file.
 *
 * It also settles the worker/in-page split for free. In worker mode the LCD
 * canvas's control has been TRANSFERRED to the worker and the page may never
 * draw on it again (web/session.js); an overlay is a different element, so
 * both modes get the identical grid from the identical code, and web/ stays
 * byte-identical to the core's own project (play/gameboy/UPDATING.md).
 *
 * ---------------------------------------------------------------------------
 * THE FIXED 4x INTERNAL SCALE
 * ---------------------------------------------------------------------------
 * The grid is drawn ONCE into a fixed 640x576 buffer — exactly 4 device pixels
 * per Game Boy pixel, with the gap the 4th — and the browser scales that
 * buffer to whatever size the screen is on the page, WITH smoothing
 * (image-rendering:auto). That is the whole reason for the fixed scale: the
 * play window's screen is not always an integer multiple (with a console
 * around it, placeBezel() sizes the canvas to the artwork's aperture), and a
 * grid drawn directly at a fractional size puts its lines on whole device
 * pixels — some 1px, some 2px, some missing. Drawn at 4x and resampled, every
 * line gets the same fractional coverage, so the grid is EVEN at any size.
 *
 * The frame underneath keeps image-rendering:pixelated and is untouched: the
 * Game Boy pixels stay crisp, and only the part that would go uneven is
 * resampled.
 *
 * Cost per frame: zero. The grid depends only on the strength, not on the
 * picture, so it is redrawn when that changes and at no other time. Nothing
 * here runs in the frame loop.
 *
 * ---------------------------------------------------------------------------
 * THE COLOUR, AND WHY IT IS BLACK AND NOT THE PALETTE'S LIGHTEST SHADE
 * ---------------------------------------------------------------------------
 * This began as the physically faithful choice: on a real panel the gap is
 * UNLIT LCD, the pale background the whole screen sits on, so the gap was the
 * palette's lightest shade and it followed the skin. That reasoning is right
 * about the hardware and wrong about what the eye sees, and the arithmetic
 * says so. Blending a LIGHT colour over a pixel gives a gap/pixel luminance
 * ratio that depends on the pixel. Measured on `dmggreen` at 25%:
 *
 *     shade 0 (lightest)  1.00   <- gap IS the pixel. The grid is not faint,
 *     shade 1             1.09      it is arithmetically absent — and shade 0
 *     shade 2             1.41      is most of a typical Game Boy screen.
 *     shade 3 (darkest)   3.58   <- a 3.6x BRIGHT line across sprites and text.
 *
 * So it vanished over the bulk of the picture and glared on the detail. No
 * strength value fixes that: at any alpha, shade 0 stays at ratio 1.00.
 *
 * A MULTIPLY has no such property. Blending BLACK at alpha a is exactly
 * pixel*(1-a) — a constant ratio at every brightness — so the grid reads with
 * one weight across the whole picture, which is what makes a dot-matrix screen
 * look like one. Measured after the change: 0.90 at all four shades.
 *
 * (Another emulator's grid shader arrives at the same arithmetic from the other
 * direction. Its source was read and described, never copied; this file's
 * geometry, compositing, fixed-scale buffer and corner path were all written
 * before that comparison. Recorded as an observation, not a derivation.)
 *
 * The cost, recorded rather than glossed: the grid is now PALETTE-INDEPENDENT.
 * It no longer follows the skin, because black is black in every skin.
 *
 * Strength (0..100%) is the alpha the gap is blended at, and so exactly the
 * fraction of brightness the gap loses: 10% (the default) is a 0.90 ratio,
 * 100% is a hard black grid. 0% is indistinguishable from off.
 * ------------------------------------------------------------------------- */

import { DEFAULT_PALETTE } from "./web/shell.js";
import { SCREEN_W, SCREEN_H } from "./web/core.js";

/** Device pixels per Game Boy pixel in the grid buffer. Fixed, on purpose. */
export const MATRIX_SCALE = 4;
export const MATRIX_W = SCREEN_W * MATRIX_SCALE;   /* 640 */
export const MATRIX_H = SCREEN_H * MATRIX_SCALE;   /* 576 */

/* The stored choice, remembered the SAME WAY the skin is (localStorage, read
   once at start-up, written on every change) — app.js's "gb.palette". Not a
   second mechanism: same store, same shape, same "a stored choice always wins,
   a fresh visitor gets the default" rule. The default is OFF. */
const KEY_ON       = "gb.matrix";
const KEY_STRENGTH = "gb.matrixStrength";
export const MATRIX_DEFAULT_ON = false;
export const MATRIX_DEFAULT_STRENGTH = 10;

export function storedMatrixOn() {
  try { const v = localStorage.getItem(KEY_ON); return v === null ? MATRIX_DEFAULT_ON : v === "1"; }
  catch { return MATRIX_DEFAULT_ON; }
}
export function storeMatrixOn(on) {
  try { localStorage.setItem(KEY_ON, on ? "1" : "0"); } catch { /* private mode */ }
}
export function storedMatrixStrength() {
  try {
    const n = parseInt(localStorage.getItem(KEY_STRENGTH), 10);
    return Number.isFinite(n) ? clampStrength(n) : MATRIX_DEFAULT_STRENGTH;
  } catch { return MATRIX_DEFAULT_STRENGTH; }
}
export function storeMatrixStrength(pct) {
  try { localStorage.setItem(KEY_STRENGTH, String(clampStrength(pct))); } catch { /* private mode */ }
}
export function clampStrength(pct) {
  const n = Math.round(Number(pct));
  return !Number.isFinite(n) ? MATRIX_DEFAULT_STRENGTH : Math.min(100, Math.max(0, n));
}

/**
 * The gap colour: BLACK, in every skin.
 *
 * It used to be the skin's LIGHTEST shade — shade 0 of the four DMG skins, and
 * the panel's white for the site's "Game Boy Color" skin, which is not four
 * shades at all (the frame arrives as BGR555 straight from the console's own
 * palette RAM and the LUT is never consulted — app.js). That is the physically
 * faithful answer and the wrong one to look at; see "THE COLOUR" at the top of
 * this file for the measurement that replaced it.
 */
export function gapRGB(paletteKey) {
  /* BLACK, IN EVERY SKIN — see "THE COLOUR" at the top of this file for the
     measurement that decided it. The palette key is still taken, and is
     deliberately unused: that keeps the light-gap behaviour one `return` away
     instead of dissolving the choice into the call sites. */
  void paletteKey;
  return [0, 0, 0];
}

/** The 4x4 repeating cell: the L-shaped gap on the right and bottom edge.
 *  ONE path, two rects, so the corner is filled once — two overlapping
 *  fillRect calls would composite the corner twice and leave a darker dot at
 *  every intersection, which is visible as a dot grid at low strength. */
function gapTile(rgb, alpha) {
  const t = document.createElement("canvas");
  t.width = MATRIX_SCALE; t.height = MATRIX_SCALE;
  const c = t.getContext("2d");
  c.fillStyle = `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${alpha})`;
  c.beginPath();
  c.rect(MATRIX_SCALE - 1, 0, 1, MATRIX_SCALE - 1);   /* right edge, above the corner */
  c.rect(0, MATRIX_SCALE - 1, MATRIX_SCALE, 1);       /* bottom edge, including it   */
  c.fill();
  return t;
}

/**
 * A grid laid over one emulator canvas.
 *
 * It owns nothing but its own element. `sync()` copies the target canvas's
 * geometry, so the grid tracks the screen through a resize, a bezel placement
 * and a device swap without knowing anything about any of them.
 */
export class MatrixOverlay {
  /**
   * @param {HTMLCanvasElement} target the emulator's canvas — read for its
   *        geometry, never drawn on.
   * @param {HTMLElement} parent a POSITIONED ancestor to place the grid in
   *        (defaults to the target's own offset parent).
   */
  constructor(target, parent, opts = {}) {
    this.target = target;
    this.on = !!opts.on;
    this.strength = clampStrength(opts.strength === undefined ? MATRIX_DEFAULT_STRENGTH : opts.strength);
    this.paletteKey = opts.palette || DEFAULT_PALETTE;

    const el = document.createElement("canvas");
    el.id = opts.id || "matrixGrid";
    el.width = MATRIX_W; el.height = MATRIX_H;
    el.setAttribute("aria-hidden", "true");
    /* image-rendering:auto is the smoothing the fixed 4x scale exists for.
       pointer-events:none so the grid can never eat a click meant for the
       device, and no background at all so what is not a gap is the frame. */
    el.style.cssText =
      "position:absolute;left:0;top:0;pointer-events:none;image-rendering:auto;" +
      "display:none;z-index:1";
    (parent || target.parentElement || document.body).appendChild(el);
    this.el = el;
    this.ctx = el.getContext("2d");

    this.redraw();
    this.sync();
  }

  /** Cover the target canvas exactly, whatever placed it. */
  sync() {
    const t = this.target, el = this.el;
    if (!t || !el) return;
    el.style.left   = t.offsetLeft + "px";
    el.style.top    = t.offsetTop + "px";
    el.style.width  = t.offsetWidth + "px";
    el.style.height = t.offsetHeight + "px";
    /* The screen's own rounding follows it: without a console the canvas has a
       3px radius, with one it does not. Read rather than assumed. */
    const cs = getComputedStyle(t);
    el.style.borderRadius = cs.borderRadius;
  }

  setOn(on)            { this.on = !!on; this.redraw(); }
  setStrength(pct)     { this.strength = clampStrength(pct); this.redraw(); }
  setPalette(key)      { this.paletteKey = key; this.redraw(); }

  /** The only drawing this class ever does. Called on a setting, never on a frame. */
  redraw() {
    const ctx = this.ctx, el = this.el;
    if (!ctx || !el) return;
    ctx.clearRect(0, 0, MATRIX_W, MATRIX_H);
    if (!this.on || this.strength <= 0) { el.style.display = "none"; return; }
    const pat = ctx.createPattern(gapTile(gapRGB(this.paletteKey), this.strength / 100), "repeat");
    ctx.fillStyle = pat;
    ctx.fillRect(0, 0, MATRIX_W, MATRIX_H);
    el.style.display = "block";
    this.sync();
  }

  /** Follow the target element if the page swapped it (the worker fallback
   *  replaces the canvas — see app.js boot()). */
  setTarget(target) { this.target = target; this.sync(); }

  destroy() { if (this.el) this.el.remove(); this.el = this.ctx = this.target = null; }
}
