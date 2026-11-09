/*
 * play/cores/tetrisjr/art.mjs -- Tetris Jr.'s device art for the one play host.
 * Started 2026-10-14 in the Tetris Jr. and colour-unit migration (unified UI, phase 5).
 *
 * The clamshell (PrototypeTetrisJrArt.webp, 1100 x 1369) with its two LCD windows, each
 * drawn as the old page drew it (play/tetrisjr/index.html .lcd): the printed scenery
 * (top-window.png / bottom-window.png), the site's segment sheet multiplied over it like ink,
 * and the polariser film (rgb(157,180,170), multiplied) on top. The window rectangles are
 * the old page's, measured there from the artwork (% of its natural size), including its
 * 2 px overscan on the right. The whole device shows, as on the old page.
 *
 * The black rotate button: the source art has it red, the real TR-66's is black, so the
 * old page painted a black dome over it (#rotate-cap). Here it is an image layer over the
 * case, at the old page's measured box.
 *
 * The description is for the host's shared segment presenter (play/host/segments.mjs, the
 * Game & Watch migration's proposal). Tetris Jr. asks three things of it that the G&W units do
 * not use: elements bound by id (its sheets carry ids, not titles), a level shown as
 * opacity (the etched ghost of an unlit grid cell is level 33), and the canvas kept out of
 * sight (it would black out the hinge between the two windows).
 */
import { loadEngine, engineDiagram } from '../keys-engine.mjs?v=2.1.0';
const ART_W = 1100, ART_H = 1369;
const OVERSCAN = 2 / ART_W;
/* The two windows, in fractions of the art (index.html #topLCD / #botLCD). */
const TOP = { l: 0.2764, t: 0.1417, w: 0.4455 + OVERSCAN, h: 0.2301 };
const BOT = { l: 0.2764, t: 0.6158, w: 0.4455 + OVERSCAN, h: 0.2308 };
/* The screen box: both windows (the presenter's canvas sits here; its raster is the shot). */
const BOX = { l: TOP.l, t: TOP.t, w: TOP.w, h: BOT.t + BOT.h - TOP.t };
export const SCREEN_PX = { w: Math.round(BOX.w * ART_W), h: Math.round(BOX.h * ART_H) };
const CAP = { l: 0.8335, t: 0.8165, w: 0.071, h: 0.0575 };
const TINT = 'rgb(157,180,170)', INK = '#12180d';

const base = new URL('../../tetrisjr/', import.meta.url);
let sheets = null;
async function sheet(file) {
  const r = await fetch(new URL(file, base));
  if (!r.ok) throw new Error(file + ' did not load');
  let s = await r.text();
  // The sheet's own style draws light segments in a dark theme; the LCD's ink is fixed.
  s = s.replace(/<style>[\s\S]*?<\/style>/, `<style>.seg path{fill:${INK};stroke:none}</style>`);
  s = s.replace(/<svg\b/, '<svg preserveAspectRatio="none"');
  return s;
}
const tintSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1" preserveAspectRatio="none"><rect width="1" height="1" fill="${TINT}"/></svg>`;
const capSvg = 'data:image/svg+xml;utf8,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><defs><radialGradient id="g" cx="37%" cy="30%" r="75%"><stop offset="0" stop-color="#5c5c5e"/><stop offset=".26" stop-color="#343436"/><stop offset=".6" stop-color="#161617"/><stop offset="1" stop-color="#060607"/></radialGradient><radialGradient id="h" cx="39%" cy="30%" r="18%"><stop offset="0" stop-color="#fff" stop-opacity=".4"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient></defs><circle cx="50" cy="50" r="49" fill="url(#g)"/><ellipse cx="39" cy="30" rx="18" ry="15" fill="url(#h)"/></svg>`);

export async function describe() {
  loadEngine();                                            // ready for the Keys panel
  sheets = sheets || await Promise.all([sheet('sprites-top.svg'), sheet('sprites-bottom.svg')]).catch(() => null);
  if (!sheets) return null;
  const lcd = {
    bindBy: 'id', levels: 'opacity', hideCanvas: true,
    layers: [
      { kind: 'img', src: new URL('top-window.png', base).href, box: TOP },
      { kind: 'svg', svg: sheets[0], box: TOP, blend: 'multiply' },
      { kind: 'svg', svg: tintSvg, box: TOP, blend: 'multiply' },
      { kind: 'img', src: new URL('bottom-window.png', base).href, box: BOT },
      { kind: 'svg', svg: sheets[1], box: BOT, blend: 'multiply' },
      { kind: 'svg', svg: tintSvg, box: BOT, blend: 'multiply' },
      { kind: 'img', src: capSvg, box: CAP, over: true },
    ],
  };
  return {
    kind: 'tr66', src: new URL('PrototypeTetrisJrArt.webp', base).href,
    ar: ART_W / ART_H, l: BOX.l, t: BOX.t, w: BOX.w, h: BOX.h,
    // The whole clamshell: as many screen-box heights above and below as the art has.
    band: { above: BOX.t / BOX.h, below: (1 - BOX.t - BOX.h) / BOX.h },
    opaque: true, measureGlass: false, headroom: true, lcd,   // R3: the title on the lid stays clear of the Control Bar
  };
}

/* The Keys panel's diagram: the old page's TJ_KEYS_GAME (DK-52's arrangement), drawn by the
   site's engine; the host names each control by its own key mapping (keys-engine.mjs). */
const TJ_KEYS = {
  gameKey: 'tetrisjr',
  game: { hotspots: {
    /* 3 Nov: one tight row (pad, round button, then Game A / Game B / Time), the unit's order
       left to right without the empty space of its screens, so the picture can be drawn larger. */
    gameA: { left: 62, top: 13, width: 16, height: 7 }, gameB: { left: 62, top: 22, width: 16, height: 7 }, time: { left: 62, top: 31, width: 16, height: 7 },
    btn2: { left: 16, top: 14, width: 8, height: 8 }, btn4: { left: 16, top: 34, width: 8, height: 8 },
    btn3: { left: 6, top: 24, width: 8, height: 8 }, btn1: { left: 26, top: 24, width: 8, height: 8 },
    jump: { left: 42, top: 21, width: 14, height: 14 },
  } },
  slots: { gameA: { id: 'game-a' }, gameB: { id: 'game-b' }, time: { id: 'time' }, btn1: { id: 'right' }, btn2: { id: 'rotate' }, btn3: { id: 'left' }, btn4: { id: 'drop' }, jump: { id: 'action', label: 'Rotate' } },
};
export function keysDiagram(table, keyLabel) { return engineDiagram(TJ_KEYS, table, keyLabel); }
