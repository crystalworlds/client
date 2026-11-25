/*
 * play/cores/sega8/art.mjs?sys=<sg1000|sms|gg> -- the Sega 8-bit device art for the one play host.
 *
 * play/cores/atari/art.mjs's arrangement, unchanged: the picture is one file under images/art/
 * (found through ../artfile.mjs, which puts its hash in the address), and every number below is
 * sega8-screen.css's MEASURED screen box and device body (WASM_Source/sega8-artwork/aperture.py;
 * re-measure if a picture is replaced, never by eye). The glass is a translucent glare layer:
 * the game goes BEHIND it (opaque: false).
 *
 * THE CROP. The SG-1000 and the Master System show the television only: the tile picture (the TV
 * with its controller drawn below) is cut to the television's body here once, on a canvas, and the
 * screen box is restated in the cut's coordinates. The SG-1000's body is measured to the foot of
 * its wooden stand, so the whole stand shows. The Game Gear is the handheld itself, cut to its own
 * body as the Lynx is.
 */
const SYS = new URL(import.meta.url).searchParams.get('sys') || 'sms';
import { artFileUrl } from '../artfile.mjs';
/* [picture key, picture W, H, screen x, y, w, h, body x, y, w, h] in pixels of the picture. */
const GEOM = {
  sg1000: ['Sg1000Console.png', 780, 936, 88, 87, 463, 341, 32, 33, 716, 483],   // 2026-11-25: the COLORFUL kit picture
  sms: ['MasterSystemConsole.png', 825, 990, 88, 86, 506, 381, 34, 27, 757, 508],   // 2026-11-25: the COLORFUL kit picture
  gg: ['GameGearConsole.png', 1295, 750, 466, 71, 374, 268, 76, 4, 1153, 594],   // 2026-11-25: the COLORFUL kit picture
}[SYS];
const HANDHELD = SYS === 'gg';

let cached = null;
function loadImage(src) { return new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = rej; im.src = src; }); }

async function build() {
  if (!GEOM) return null;
  const url = await artFileUrl(GEOM[0]);
  if (!url) return null;
  const im = await loadImage(url);   // same site, so the canvas below may read it back
  const [, IW, IH, ax, ay, aw, ah, bx, by, bw, bh] = GEOM;
  const sx = im.naturalWidth / IW, sy = im.naturalHeight / IH;      // the file's own scale, if ever re-encoded
  const cw = Math.round(bw * sx), chh = Math.round(bh * sy);
  const c = document.createElement('canvas');
  c.width = cw; c.height = chh;
  const g = c.getContext('2d');
  g.imageSmoothingEnabled = true;
  g.drawImage(im, bx * sx, by * sy, cw, chh, 0, 0, cw, chh);
  /* THE WHOLE TUBE FACE (21 Nov 2026, the hand test: "Even Alex Kidd shows that it is not the full tv
     screen"). The pictures themselves now carry it: WASM_Source/sega8-artwork/maketiles.py widens each
     set's glass over the tube's unlit black ring, so the tile and this window share one picture and one
     measured box (the numbers above, sega8-screen.css's). */
  /* The screen box in fractions of the cut. */
  const l = (ax - bx) / bw, t = (ay - by) / bh, w = aw / bw, h = ah / bh;
  let src;
  try { src = c.toDataURL('image/png'); } catch (_) { return null; }
  /* A little headroom above a television, so the host's bar does not sit on the set's top rows
     on a phone held sideways (the Atari televisions' 0.12); none on the handheld. */
  const head = HANDHELD ? 0 : 0.12;
  const d = { kind: 'sega8-' + SYS, src, ar: c.width / c.height, l, t, w, h, opaque: false,
    band: { above: t / h + head, below: (1 - t - h) / h }, measureGlass: false,
    tvHead: HANDHELD ? null : head,
    headroom: HANDHELD,
    overlayView: { cut: [bx / IW, by / IH, bw / IW, bh / IH], turn: 0 } };
  /* THE TELEVISIONS AS THE NES'S (21 Nov 2026, the hand test: "It needs to be curved like Mario on NES
     is and fit the TV image"). play/cores/nes/art.mjs draws its set with the presenter's CROP layout:
     the set fills the stage, and the screen carries the glass's measured corner radius and its tone
     (sega8-screen.css --sms-scr-radius, --sg1000-scr-radius, --*-scr-bg). The same elements here: the
     crop is the whole cut (the set's body), so the set is drawn at the NES's size, not a band. */
  if (!HANDHELD) Object.assign(d, { crop: { l: 0, t: 0, w: 1, h: 1 },
    radius: SYS === 'sg1000' ? '7.3% / 10.0%' : '6.5% / 8.7%', glass: SYS === 'sg1000' ? '#000000' : '#000000' });   // 2026-11-25: the kit sets' (were 7.4% / 10.0%, 6.3% / 8.2%, #a7a9ab, #4d4f4f)
  return d;
}

/** The art description the presenter draws, or null (no picture: the plain screen). */
export async function describe() {
  if (!cached) cached = build().catch(() => null);
  return cached;
}
