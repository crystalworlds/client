/*
 * play/cores/gb/art.mjs -- the Game Boy's device art for the one play host.
 *
 * Per console, the host keeps only two things: the device art and the play screen.
 * This is the Game Boy's art: which console photograph a title wears, where its
 * screen aperture is, which side of the glass the game goes on, and the Matrix Mode
 * grid. The numbers are play/gameboy/app.js's BEZEL table and band rule, carried over
 * unchanged (MEASURED there against the same images), so the two windows match.
 *
 * GBC SHELLS: the site picks one release colour per page load and passes it as
 * ?shell=<key>&for=<slot> (openGbPlay in index.html). The host never picks: it wears
 * what the tile wore, and the Dandelion photograph when no key names this slot.
 */
import { MatrixOverlay, storedMatrixOn, storedMatrixStrength, clampStrength } from '../../gameboy/matrix.js';
import { artFileUrl } from '../artfile.mjs';
import { GB_MODE } from './mode.mjs';

export const BEZEL = {
  dmg: { key: 'GameBoyConsole.png', ar: 496 / 843, l: 0.2621, t: 0.1459, w: 0.4819, h: 0.2598 },
  cgb: { key: 'GameBoyColorConsole.png', ar: 505 / 852, l: 0.2535, t: 0.1056, w: 0.4931, h: 0.2688 },
  cgbPokemon: { key: 'GameBoyColorPokemonConsole.svg', ar: 722 / 1250, l: 0.2188, t: 0.1024, w: 0.5568, h: 0.2896, opaque: true },
  /* Atomic Purple (2026-11-04): a see-through shell, so its OWN photograph rather than a
     recolour of the Dandelion one; framed to the same 505x852 by WASM_Source/gbc-shells/
     photo.py, which measured its LCD at 258x229 from 124,97 and widened the window by the
     panel's 3 px bevel: 264x235 from 121,94. The same numbers are in index.html's
     [data-art="cgb-atomic"] block. */
  cgbAtomic: { key: 'GameBoyColorConsoleAtomicPurple.webp', ar: 505 / 852, l: 0.2396, t: 0.1103, w: 0.5228, h: 0.2758 },
};
export const BAND = { above: 0.30, below: 0.38 };
/* Keep in step with index.html GBC_SHELLS and WASM_Source/gbc-shells/manifest.txt. */
export const GBC_SHELLS = ['GameBoyColorConsole.png', 'GameBoyColorConsoleBerry.webp', 'GameBoyColorConsoleGrape.webp',
  'GameBoyColorConsoleKiwi.webp', 'GameBoyColorConsoleTeal.webp', 'GameBoyColorConsoleAtomicPurple.webp'];
const POKEMON_SLOTS = new Set(['crystal']);
/* The pictures are single files since 24 Oct: ../artfile.mjs gives each key's address
   from images/art/art-index.json, hash included, so no version stamp has to be kept in step here. */


/** Which art a title wears: { kind, shellKey }. */
export function artKindFor({ model, game, title, params }) {
  if (model !== 'cgb') return { kind: 'dmg', shellKey: null };
  const name = String(title || game || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  if (POKEMON_SLOTS.has(String(game).toLowerCase()) || /pokemon/.test(name)) return { kind: 'cgbPokemon', shellKey: null };
  const k = params && params.get('shell');
  const shellKey = (k && GBC_SHELLS.indexOf(k) >= 0 && params.get('for') === String(game)) ? k : GBC_SHELLS[0];
  /* The recoloured shells share the Dandelion photograph's aperture; Atomic Purple has its own. */
  return { kind: shellKey === BEZEL.cgbAtomic.key ? 'cgbAtomic' : 'cgb', shellKey };
}

/** The art description the presenter draws, or null (no archive: the plain screen). */
export async function describe(ctx) {
  /* 2026-10-24: the Super Game Boy's television picture and two linked consoles are
     wider than the console's glass: they are shown as the plain screen. */
  if (GB_MODE.wide) return null;
  const { kind, shellKey } = artKindFor(ctx);
  const g = BEZEL[kind];
  let src = null;
  if (shellKey && shellKey !== BEZEL.cgb.key) src = await artFileUrl(shellKey);
  if (!src) src = await artFileUrl(g.key);
  if (!src) return null;
  return { kind, src, ar: g.ar, l: g.l, t: g.t, w: g.w, h: g.h, opaque: !!g.opaque, band: BAND, measureGlass: true,
    /* The whole console, top to bottom: the presenter shows it instead of the screen band on a tall,
       narrow screen (a phone held upright, a Fold's cover screen; 2026-10-17). */
    tall: { above: g.t / g.h, below: (1 - g.t - g.h) / g.h },
    /* Which of the overlay's measured art button sets this console wears (play/shared/overlays/gb.json
       art.variants); the buttons press only while the whole console is shown. */
    overlayView: { variant: kind } };
}

/* Matrix Mode: the LCD's unlit gap on each pixel, an overlay canvas (never the frame, so no
   frame hash or state can move). A DISPLAY EFFECT of the artwork: it declares its options
   and the shared host draws their Settings rows (the per-console contract, 2026-10-14). The
   storage keys are matrix.js's own, so the old page and the host share the choice. */
export const effects = [{
  id: 'matrix',
  options: [
    { id: 'matrix', label: 'Matrix Mode', type: 'bool', default: false, key: 'gb.matrix', group: 'display', scope: 'console' },
    { id: 'matrixStrength', label: 'Matrix Mode strength', type: 'range', min: 0, max: 100, step: 1, unit: '%', default: 10, key: 'gb.matrixStrength', group: 'display', scope: 'console' },
  ],
  attach({ presenter }) {
    const m = new MatrixOverlay(presenter.canvas, presenter.wrap, { on: storedMatrixOn(), strength: storedMatrixStrength() });
    return {
      setOption(id, v) { if (id === 'matrix') m.setOn(!!v); if (id === 'matrixStrength') m.setStrength(clampStrength(v)); },
      sync() { m.sync(); },
    };
  },
}, {
  /* RUMBLE (2026-10-24): a Rumble cartridge's motor (core.rumble, 0..1000 of the last
     frame) vibrates the player's controller where the browser can (the Gamepad API's
     vibrationActuator, 'dual-rumble'), and the phone itself where it can (navigator.vibrate), as
     the Pokemon mini does; the console on screen shakes with it. One Settings switch. */
  id: 'rumble',
  options: [{ id: 'gbRumble', label: 'Rumble', help: 'Vibrate the controller (or the phone) when a Rumble cartridge rumbles', type: 'bool', default: true, key: 'gb.rumble', group: 'display', scope: 'console' }],
  attach({ presenter, core, live }) {
    if (!document.getElementById('gb-rumble-css')) {
      const st = document.createElement('style'); st.id = 'gb-rumble-css';
      st.textContent = '.gb-rumble{animation:gb-rumble .07s linear infinite}@keyframes gb-rumble{0%{transform:translate(0,0)}25%{transform:translate(-1.5px,1px)}50%{transform:translate(1.5px,-1px)}75%{transform:translate(-1px,-1px)}100%{transform:translate(0,0)}}@media (prefers-reduced-motion: reduce){.gb-rumble{animation:none}}';
      document.head.appendChild(st);
    }
    let on = true, buzzing = false, lastKick = 0;
    const stats = { on, starts: 0, pads: 0, phone: 0 };
    const pads = () => { try { return Array.from(navigator.getGamepads ? navigator.getGamepads() : []).filter(g => g && g.connected && g.vibrationActuator); } catch (_) { return []; } };
    const kick = level => {
      const ps = pads();
      for (const g of ps) { try { g.vibrationActuator.playEffect('dual-rumble', { duration: 120, strongMagnitude: level, weakMagnitude: level }); stats.pads++; } catch (_) {} }
      if (!ps.length) { try { if (navigator.vibrate && matchMedia('(pointer: coarse)').matches) { navigator.vibrate(110); stats.phone++; } } catch (_) {} }
    };
    const stop = () => {
      presenter.wrap.classList.remove('gb-rumble');
      if (buzzing) { for (const g of pads()) { try { g.vibrationActuator.reset(); } catch (_) {} } try { if (navigator.vibrate) navigator.vibrate(0); } catch (_) {} }
      buzzing = false;
    };
    return {
      stats,
      setOption(id, v) { if (id === 'gbRumble') { on = stats.on = !!v; if (!on) stop(); } },
      frame() {
        const c = core();
        const r = live() && c ? (c.rumble | 0) : 0;
        if (!on || r <= 0) { if (buzzing) stop(); return; }
        const now = performance.now();
        if (!buzzing) { stats.starts++; presenter.wrap.classList.add('gb-rumble'); buzzing = true; lastKick = 0; }
        if (now - lastKick > 90) { lastKick = now; kick(Math.max(0.25, Math.min(1, r / 1000))); }
      },
    };
  },
}];


/* The Keys panel's contents for this device (the panel is the shared frame;
   2026-10-07): the Game Boy's own diagram, the old page's .gbk-* layout carried over,
   with the keys that press each button NOW (the viewer's remaps included), lit while
   held. `table` is the host's input table: [[{ id, label, keys: [code] }]]. */
const GBK_CSS = `
.gbk-diagram{position:relative;width:min(100%,540px);aspect-ratio:1.75;--gb-slant:-16deg;margin:0 auto 10px}
.gbk-diagram [data-btn]{position:absolute;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;border:2px solid #9aa1ad;background:rgba(255,255,255,.02);color:#e6e8ec;user-select:none;-webkit-user-select:none}
.gbk-diagram [data-btn].down{border-color:#9bbc0f;background:rgba(155,188,15,.26)}
.gbk-diagram .kk{font-weight:800;font-size:clamp(11px,2.2vw,18px);line-height:1}
.gbk-diagram .kl{font-size:clamp(7px,1.3vw,10px);color:#9aa1ad;letter-spacing:.06em}
.gbk-dpad{position:absolute;left:2%;top:12%;width:33%;height:70%;color:#9aa1ad}
.gbk-dpad svg{position:absolute;inset:0;width:100%;height:100%;display:block}
.gbk-dpad [data-btn]{border:0;background:transparent;border-radius:7px}
.gbk-dpad [data-btn].down{background:rgba(155,188,15,.30);border:0}
.gbk-dpad .u{left:34%;top:3%;width:32%;height:32%}.gbk-dpad .d{left:34%;top:65%;width:32%;height:32%}
.gbk-dpad .l{left:3%;top:34%;width:32%;height:32%}.gbk-dpad .r{left:65%;top:34%;width:32%;height:32%}
.gbk-face{position:absolute;left:55%;top:20%;width:43%;height:50%;display:flex;align-items:center;justify-content:center;gap:8%;transform:rotate(var(--gb-slant))}
.gbk-face [data-btn]{position:relative;width:40%;aspect-ratio:1;border-radius:50%}
.gbk-face [data-btn]>*{transform:rotate(calc(-1 * var(--gb-slant)))}
.gbk-se{position:absolute;left:26%;top:70%;width:52%;height:24%;display:flex;align-items:center;justify-content:center;gap:7%;transform:rotate(var(--gb-slant))}
.gbk-se [data-btn]{position:relative;width:44%;height:56%;border-radius:999px;flex-direction:row;gap:6px}
.gbk-se .kk{font-size:clamp(9px,1.6vw,13px)}.gbk-se .kl{font-size:clamp(7px,1.1vw,9px)}`;
export function keysDiagram(table, keyLabel) {
  if (!document.getElementById('gbk-css')) { const st = document.createElement('style'); st.id = 'gbk-css'; st.textContent = GBK_CSS; document.head.appendChild(st); }
  const k = id => { const c = (table[0] || []).find(x => x.id === id); return c && c.keys.length ? keyLabel(c.keys[0]) : ''; };
  const el = document.createElement('div');
  el.className = 'gbk-diagram';
  el.innerHTML = `<div class="gbk-dpad"><svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><path d="M34 3 H66 V34 H97 V66 H66 V97 H34 V66 H3 V34 H34 Z" fill="none" stroke="currentColor" stroke-width="3" stroke-linejoin="round"/></svg>
    <div class="u" data-btn="up" aria-label="Up"><span class="kk">${k('up')}</span></div><div class="l" data-btn="left" aria-label="Left"><span class="kk">${k('left')}</span></div>
    <div class="r" data-btn="right" aria-label="Right"><span class="kk">${k('right')}</span></div><div class="d" data-btn="down" aria-label="Down"><span class="kk">${k('down')}</span></div></div>
    <div class="gbk-face"><div data-btn="b" aria-label="B"><span class="kk">${k('b')}</span><span class="kl">B</span></div><div data-btn="a" aria-label="A"><span class="kk">${k('a')}</span><span class="kl">A</span></div></div>
    <div class="gbk-se"><div data-btn="select" aria-label="Select"><span class="kk">${k('select')}</span><span class="kl">SELECT</span></div><div data-btn="start" aria-label="Start"><span class="kk">${k('start')}</span><span class="kl">START</span></div></div>`;
  return el;
}
