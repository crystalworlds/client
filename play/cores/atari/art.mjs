/*
 * play/cores/atari/art.mjs?sys=<a2600|a5200|a7800|alynx> -- the Atari device art for the one
 * play host. 2026-10-14, the Atari migration.
 *
 * The photographs are the old pages' (one file each under images/art/ since 2026-10-24, found
 * through ../artfile.mjs, which puts the picture's hash in its address), and every number below is
 * atari-screen.css's MEASURED aperture and television body, carried over unchanged
 * (WASM_Source/atari-artwork/aperture.py; re-measure if a photograph is replaced, never by eye).
 *
 * THE CROP. The old pages showed the television body only (.atari-tv-crop), not the joysticks
 * and cartridge boxes around it. The host's presenter shows the art's full width, so the body
 * is cut out here once, on a canvas, and the aperture is restated in the cut's coordinates.
 * The glass is a translucent glare layer: the game goes BEHIND it (opaque: false).
 *
 * THE LYNX TURN. A title played with the console on its side (play/atarilynx/app.js decideTurn)
 * wears the photograph turned the same way, drawn here from the upright one, so the two can
 * never disagree about where the screen is. The host passes the picture's current rotation.
 */
const SYS = new URL(import.meta.url).searchParams.get('sys') || 'a2600';
import { artFileUrl } from '../artfile.mjs';   // single picture files since 24 Oct
/* [image key, image W, H, aperture x, y, w, h, body x, y, w, h] in pixels of the photograph. */
const GEOM = {
  /* 2026-10-22: the TILE pictures (the set with its controller below it), re-measured by
     atari-artwork/aperture.py. An earlier change swapped the pictures under these keys without moving these
     numbers; the full photographs' were 2600 734x539 (144,55,309,228) (105,19,477,301), 5200 859x564
     (240,70,325,245) (208,21,477,322), 7800 761x584 (148,61,338,253) (112,21,505,330). */
  a2600: ['Atari2600Console.png', 520, 624, 58, 65, 309, 228, 20, 29, 476, 301],   // body 301 tall since the rebuilt tile of 22 Oct
  a5200: ['Atari5200Console.png', 520, 624, 54, 70, 325, 245, 22, 21, 477, 322],
  a7800: ['Atari7800Console.png', 550, 660, 59, 57, 338, 253, 23, 18, 505, 329],
  alynx: ['AtariLynxConsole.png', 1009, 540, 363, 149, 292, 183, 21, 12, 968, 517],
}[SYS];

const cache = new Map();
function loadImage(src) { return new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = rej; im.src = src; }); }

/* turn: 0 upright, 1 turned left (a quarter anticlockwise), 2 turned right (clockwise). */
async function build(turn) {
  const url = await artFileUrl(GEOM[0]);
  if (!url) return null;
  const im = await loadImage(url);   // same site, so the canvas below may read it back (WebP since 24 Oct)
  const [, IW, IH, ax, ay, aw, ah, bx, by, bw, bh] = GEOM;
  const sx = im.naturalWidth / IW, sy = im.naturalHeight / IH;      // the archive's own scale, if ever re-encoded
  const cw = Math.round(bw * sx), chh = Math.round(bh * sy);
  const c = document.createElement('canvas');
  const turned = turn === 1 || turn === 2;
  c.width = turned ? chh : cw; c.height = turned ? cw : chh;
  const g = c.getContext('2d');
  g.imageSmoothingEnabled = true;
  if (turned) {
    g.translate(c.width / 2, c.height / 2);
    g.rotate(turn === 1 ? -Math.PI / 2 : Math.PI / 2);
    g.drawImage(im, bx * sx, by * sy, cw, chh, -cw / 2, -chh / 2, cw, chh);
  } else g.drawImage(im, bx * sx, by * sy, cw, chh, 0, 0, cw, chh);
  // The aperture in fractions of the cut, then turned with it.
  let l = (ax - bx) / bw, t = (ay - by) / bh, w = aw / bw, h = ah / bh;
  if (turn === 2) [l, t, w, h] = [1 - t - h, l, h, w];
  else if (turn === 1) [l, t, w, h] = [t, 1 - l - w, h, w];
  const ar = c.width / c.height;
  let src;
  try { src = c.toDataURL('image/png'); } catch (_) { return null; }
  // The whole cut shows: as many screen heights above and below as the body has, plus a
  // little headroom above a television (the host's bar floats over the top of the stage; on a
  // phone held sideways a TV cut tight to its body put the bar on the picture's top rows).
  const head = SYS === 'alynx' ? 0 : 0.12;
  return { kind: SYS + (turn ? '-turn' + turn : ''), src, ar, l, t, w, h, opaque: false,
    band: { above: t / h + head, below: (1 - t - h) / h }, measureGlass: false,
    /* A television (not the Lynx): the play window drops the headroom and puts the set at the top
       of the stage (2026-10-22; play/host/present.mjs tvTop). */
    tvHead: SYS === 'alynx' ? null : head,
    /* The Lynx's own top keys (B and A, and a turned console's Option keys) must not sit under the
       Control Bar: on a phone held sideways they did, and a press there went to the bar (measured
       2026-10-17). The presenter fits the art below the bar when it would reach under it. */
    headroom: SYS === 'alynx',
    /* The on-screen art buttons (play/shared/overlays/<sys>.json) are measured on the WHOLE
       photograph: say which part this art is and how it is turned, from the same numbers, so the
       buttons and the picture can never disagree (2026-10-17: the Lynx's presses missed
       their keys, upright by the body cut's offset, turned by the whole quarter turn). */
    overlayView: { cut: [bx / IW, by / IH, bw / IW, bh / IH], turn } };
}

/** The art description the presenter draws, or null (no archive: the plain screen). */
export async function describe(ctx = {}) {
  let turn = 0;
  if (SYS === 'alynx') {
    const r = ctx.rotation != null ? ctx.rotation : (ctx.video && ctx.video.rotation);
    turn = r === 270 ? 1 : r === 90 ? 2 : 0;
  }
  if (!cache.has(turn)) cache.set(turn, build(turn).catch(() => null));
  return cache.get(turn);
}
