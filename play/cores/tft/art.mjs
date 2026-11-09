/*
 * play/cores/tft/art.mjs -- the colour units' device art for the one play host.
 * Started 2026-10-14 in the Tetris Jr. and colour-unit migration (unified UI, phase 5).
 *
 * The old windows' own photographs (play/mario/device.jpg 1500 x 898, play/zelda/device.png
 * 619 x 370) and their screen rectangle (both pages: left 29.1 %, top 23.25 %, width 41.9 %,
 * height 54.28 % of the device), which the overlay's art buttons (play/shared/overlays/
 * twin.json) are measured against. The whole device shows; the 320 x 240 panel sits in the
 * rectangle in front of the photograph, as on the old page.
 */
import { loadEngine, engineDiagram } from '../keys-engine.mjs?v=2.1.0';
const ART = {
  mario: { file: '../../mario/device.jpg', w: 1500, h: 898 },
  zelda: { file: '../../zelda/device.png', w: 619, h: 370 },
};
const SCREEN = { l: 0.291, t: 0.2325, w: 0.419, h: 0.5428 };

export async function describe({ model }) {
  loadEngine();                                            // ready for the Keys panel
  const a = ART[model];
  if (!a) return null;
  return {
    kind: model, src: new URL(a.file, import.meta.url).href,
    ar: a.w / a.h, l: SCREEN.l, t: SCREEN.t, w: SCREEN.w, h: SCREEN.h,
    band: { above: SCREEN.t / SCREEN.h, below: (1 - SCREEN.t - SCREEN.h) / SCREEN.h },
    opaque: true, measureGlass: false, headroom: true,   // R3: fitted below the Control Bar (its top edge shows)
  };
}

/* The Keys panel's diagram: the old twin page's TWIN_KEYS_GAME (play/twin-harness.js), drawn
   by the site's engine; Zelda adds Select and Start over B and A, as there (keys-engine.mjs). */
const TFT_GAME = {
  screen: { left: 29.1, top: 23.25, width: 41.9, height: 54.28 },
  hotspots: {
    btn2: { left: 9, top: 58, width: 9, height: 9 }, btn4: { left: 9, top: 76, width: 9, height: 9 },
    btn3: { left: 2, top: 67, width: 9, height: 9 }, btn1: { left: 16, top: 67, width: 9, height: 9 },
    hit: { left: 74, top: 63, width: 12, height: 12 }, jump: { left: 87, top: 63, width: 12, height: 12 },
    gameA: { left: 78, top: 8, width: 12, height: 7 }, time: { left: 78, top: 20, width: 12, height: 7 }, gameB: { left: 78, top: 32, width: 12, height: 7 },
  },
};
const TFT_SLOTS = { btn1: { id: 'right' }, btn2: { id: 'up' }, btn3: { id: 'left' }, btn4: { id: 'down' }, hit: { id: 'b', label: 'B' }, jump: { id: 'a', label: 'A' }, gameA: { id: 'game', label: 'Game' }, gameB: { id: 'pause', label: 'Pause' }, time: { id: 'time', label: 'Time' } };
export function keysDiagram(table, keyLabel) {
  const ids = new Set([].concat(...table).map(c => c.id));
  const zelda = ids.has('select') && ids.has('start');
  const game = zelda ? { screen: TFT_GAME.screen, hotspots: Object.assign({}, TFT_GAME.hotspots, { open: { left: 74, top: 50, width: 12, height: 7 }, fire: { left: 87, top: 50, width: 12, height: 7 } }) } : TFT_GAME;
  const slots = zelda ? Object.assign({}, TFT_SLOTS, { open: { id: 'select', label: 'Select' }, fire: { id: 'start', label: 'Start' } }) : TFT_SLOTS;
  return engineDiagram({ game, gameKey: zelda ? 'zelda' : 'mario', slots, extra: ids.has('power') ? '<span><b>P</b> Power</span>' : '' }, table, keyLabel);
}
