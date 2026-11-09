/*
 * play/cores/keys-engine.mjs -- the site's Controls-diagram engine (keys-diagram.js,
 * window.KeysDiagram) for device units that draw a schematic rather than their own pad.
 * Added 2026-10-15 by the unified UI lead (small ports): Tetris Jr. and the colour units
 * had this diagram on their old pages (play/tetrisjr/index.html TJ_KEYS_GAME,
 * play/twin-harness.js TWIN_KEYS_GAME); the one host shows it on its Keys panel.
 *
 * The same method as cores/gnw/art.mjs keysDiagram: the engine draws from a "game" of
 * hotspots, each control's keys are the host's own mapping (so a rebind shows), and every
 * drawn control is named [data-btn=<control id>] by the keys it shows, which is what the
 * host lights while the control is held.
 */
const SITE = new URL('../../', import.meta.url);
let kdP = null;
/** Load keys-diagram.js into this document once; resolves to window.KeysDiagram or null. */
export function loadEngine() {
  if (window.KeysDiagram) return Promise.resolve(window.KeysDiagram);
  if (!kdP) kdP = new Promise(res => {
    const sc = document.createElement('script');
    sc.src = new URL('keys-diagram.js?v=2.1.1', SITE).href;
    sc.onload = () => res(window.KeysDiagram || null); sc.onerror = () => { kdP = null; res(null); };
    document.head.appendChild(sc);
  });
  return kdP;
}
const CSS = `.cwk{width:100%;display:flex;justify-content:center;--muted:#8a94a6;--text:#e7ecf2;--line:#2a3242;--accent:#ee1515}
.cwk .keys-wrap{width:min(100%,560px)}
.cwk .keys-diagram{width:100%}
.cwk .keys-btn.down,.cwk .keys-rocker.down{border-color:var(--accent);background:rgba(238,21,21,.24);box-shadow:0 0 0 3px rgba(238,21,21,.3)}
.cwk .keys-btn.down .kk,.cwk .keys-btn.down .kl{color:var(--text)}
.cwk .dk.down,.cwk .st-arrow.down{color:var(--accent);text-shadow:0 0 8px rgba(238,21,21,.7)}
.cwk .keys-btn:hover,.cwk .keys-dpad:hover{transform:none}`;
const KCODE = { Space: ' ', Enter: 'enter', NumpadEnter: 'enter', ControlRight: 'control', ControlLeft: 'control', ShiftRight: 'shift', ShiftLeft: 'shift' };
const kOf = code => KCODE[code] || (/^Key[A-Z]$/.test(code) ? code.slice(3).toLowerCase() : /^Digit\d$/.test(code) ? code.slice(5) : String(code).toLowerCase());
const GLYPH = { Space: 'Space', Enter: 'Enter', ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→', ControlRight: 'R Ctrl', ShiftRight: 'R Shift' };

/**
 * The diagram element, or null while the engine is not loaded.
 * spec = { game, gameKey, slots: { <hotspot name>: { id: <control id>, label } }, extra }
 */
export function engineDiagram(spec, table, keyLabel) {
  const K = window.KeysDiagram;
  if (!K) return null;
  if (!document.getElementById('cwk-css')) { const st = document.createElement('style'); st.id = 'cwk-css'; st.textContent = CSS; document.head.appendChild(st); }
  K.ensureCss(document);
  const all = [].concat(...table);
  const byId = new Map(all.map(c => [c.id, c]));
  const meta = {};
  for (const [slot, s] of Object.entries(spec.slots || {})) {
    const c = byId.get(s.id);
    meta[slot] = { label: s.label || (c && c.label) || '', keys: c ? c.keys.slice(0, 2).map(k => GLYPH[k] || keyLabel(k)) : [] };
  }
  const el = document.createElement('div');
  el.className = 'cwk';
  el.innerHTML = K.buildHTML({ game: spec.game, gameKey: spec.gameKey, ar: 1, override: {}, meta, extra: spec.extra || '', tight: true });   // tight: the Keys panel's close layout (4 Nov)
  const dia = el.querySelector('.keys-diagram');
  if (dia) dia.style.aspectRatio = String(parseFloat(dia.dataset.aspect) || 1);
  const keysOf = new Map(all.map(ctl => [ctl.id, new Set(ctl.keys.map(kOf))]));
  for (const e of el.querySelectorAll('[data-k]')) {
    const ks = e.getAttribute('data-k').split(',').filter(Boolean);
    if (ks.length > 2) continue;                           // a whole pad: its arms are named one by one
    let best = null, n = 0;
    for (const [id, set] of keysOf) { const m = ks.filter(k => set.has(k)).length; if (m > n) { n = m; best = id; } }
    if (best) e.dataset.btn = best;
  }
  return el;
}
