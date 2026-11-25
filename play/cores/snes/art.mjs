/*
 * play/cores/snes/art.mjs -- the Super Nintendo's television for the one play host (23 Nov 2026).
 *
 * The site's own, beside the core's installed files (WASM_Source/snes/install.mjs never writes it).
 * play/cores/n64-art.mjs's arrangement: the picture is one file under images/art/ (found through
 * ../artfile.mjs, which puts its hash in the address), and every number below is snes-screen.css's
 * MEASURED screen box and television body (WASM_Source/snes-artwork/manifest.txt; re-measure if the
 * picture is replaced, never by eye). The game goes behind the glass.
 *
 * Without the picture (the art archive did not answer), describe() answers null and the play window shows
 * the plain screen.
 */
import { artFileUrl } from '../artfile.mjs';
/* [picture key, picture W, H, screen x, y, w, h, body x, y, w, h] in pixels of the picture (snes-screen.css: the
   tile picture SnesConsole, 640x768, the Trinitron set of the photograph in the NES tile's proportions (24 Nov 2026); its
   glass 395x294 at (123,67), the tube's dark ring kept as on the N64's set; the television 483x481 at (79,18)). */
const GEOM = ['SnesConsole.png', 640, 768, 123, 67, 395, 294, 79, 18, 483, 481];
const RADIUS = '2.3% / 3.1%';   /* 9 px of the glass, measured */

function loadImage(src) { return new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = rej; im.src = src; }); }

let cached = null;
async function build() {
  if (!GEOM) return null;
  const url = await artFileUrl(GEOM[0]);
  if (!url) return null;
  const im = await loadImage(url);
  const [, IW, IH, ax, ay, aw, ah, bx, by, bw, bh] = GEOM;
  const sx = im.naturalWidth / IW, sy = im.naturalHeight / IH;
  const cw = Math.round(bw * sx), chh = Math.round(bh * sy);
  const c = document.createElement('canvas');
  c.width = cw; c.height = chh;
  const g = c.getContext('2d');
  g.imageSmoothingEnabled = true;
  g.drawImage(im, bx * sx, by * sy, cw, chh, 0, 0, cw, chh);
  const l = (ax - bx) / bw, t = (ay - by) / bh, w = aw / bw, h = ah / bh;
  let src;
  try { src = c.toDataURL('image/png'); } catch (_) { return null; }
  const head = 0.12;
  return { kind: 'snes-tv', src, ar: c.width / c.height, l, t, w, h, opaque: false,
    band: { above: t / h + head, below: (1 - t - h) / h }, measureGlass: false, tvHead: head, headroom: false,
    overlayView: { cut: [bx / IW, by / IH, bw / IW, bh / IH], turn: 0 },
    crop: { l: 0, t: 0, w: 1, h: 1 }, radius: RADIUS, glass: '#434444' };
}

/** The art description the presenter draws, or null (no picture: the plain screen). */
export async function describe() {
  if (!cached) cached = build().catch(() => null);
  return cached;
}
