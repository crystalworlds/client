/*
 * play/cores/n64-art.mjs -- the Nintendo 64's television for the one play host (22 Nov 2026).
 *
 * The site's own, beside the N64 core's folder (play/cores/n64/ is placed whole from the core's own folder
 * and is never edited here). play/cores/sega8/art.mjs's arrangement, unchanged: the picture is one file under
 * images/art/ (found through ./artfile.mjs, which puts its hash in the address), and every number below is
 * n64-screen.css's MEASURED screen box and television body (WASM_Source/n64-artwork/manifest.txt; re-measure
 * if a picture is replaced, never by eye). The glass is a translucent glare layer: the game goes BEHIND it.
 *
 * THE CROP. The tile picture (the television with a controller drawn below) is cut to the television's body
 * once, on a canvas, and the screen box is restated in the cut's coordinates. A Pokemon game wears the
 * Pikachu console's picture (its title says Pokemon, the rule the site's tiles use), whose glass is a pixel
 * wider.
 */
import { artFileUrl } from './artfile.mjs';
import { rumbleEffect } from './n64/rumble.mjs?v=2.3.0-n64phone16';   // 25 Nov 2026: the Rumble Pak on a pad (HOST-RUMBLE-PATCH-2)
export const effects = [rumbleEffect];
/* [picture key, picture W, H, screen x, y, w, h, body x, y, w, h] in pixels of the picture. */
const GEOM = {
  /* 22 Nov 2026: the glass as photographed, the tube's dark ring kept as on the NES picture (it was widened 6 px
     to 441x335 at (99,60), which squared the screen). */
  /* 25 Nov 2026: both tiles are the COLORFUL kit's television, 730x876 (n64-screen.css); were 640x768,
     glass (105,66,429|430,323), body (27,22,586,452), radius 2.1% / 2.8% and 2.6% / 3.4%, tone #555555. */
  standard: ['N64Console.png', 730, 876, 119, 75, 491, 370, 31, 26, 667, 503],
  pikachu: ['N64PikachuConsole.png', 730, 876, 119, 75, 491, 370, 31, 26, 667, 503],
};
const RADIUS = { standard: '4.3% / 5.7%', pikachu: '4.3% / 5.7%' };   // 21 px of the glass (28 is the largest leaving none uncovered)
const isPokemon = t => /pokemon/.test(String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase());

const cached = {};
function loadImage(src) { return new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = rej; im.src = src; }); }

async function build(which) {
  const G = GEOM[which];
  const url = await artFileUrl(G[0]);
  if (!url) return null;
  const im = await loadImage(url);   // same site, so the canvas below may read it back
  const [, IW, IH, ax, ay, aw, ah, bx, by, bw, bh] = G;
  const sx = im.naturalWidth / IW, sy = im.naturalHeight / IH;      // the file's own scale, if ever re-encoded
  const cw = Math.round(bw * sx), chh = Math.round(bh * sy);
  const c = document.createElement('canvas');
  c.width = cw; c.height = chh;
  const g = c.getContext('2d');
  g.imageSmoothingEnabled = true;
  g.drawImage(im, bx * sx, by * sy, cw, chh, 0, 0, cw, chh);
  /* The screen box in fractions of the cut. */
  const l = (ax - bx) / bw, t = (ay - by) / bh, w = aw / bw, h = ah / bh;
  let src;
  try { src = c.toDataURL('image/png'); } catch (_) { return null; }
  const head = 0.12;   // headroom above the set, so the host's bar does not sit on its top rows (the Sega sets')
  return { kind: 'n64-' + which, src, ar: c.width / c.height, l, t, w, h, opaque: false,
    band: { above: t / h + head, below: (1 - t - h) / h }, measureGlass: false, tvHead: head, headroom: false,
    overlayView: { cut: [bx / IW, by / IH, bw / IW, bh / IH], turn: 0 },
    /* The television drawn as the NES's and the Sega sets' are: the presenter's crop layout, the screen with
       the glass's corner radius and its tone. */
    crop: { l: 0, t: 0, w: 1, h: 1 }, radius: RADIUS[which], glass: '#000000' };   // the kit set's unlit screen (was #555555)
}

/** The art description the presenter draws, or null (no picture: the plain screen). */
export async function describe(ctx) {
  const which = isPokemon(ctx && ctx.title) ? 'pikachu' : 'standard';
  if (!cached[which]) cached[which] = build(which).catch(() => null);
  return cached[which];
}
