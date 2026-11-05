/*
 * play/cores/gnw/art.mjs -- the Game & Watch device art for the one play host.
 * Started 2026-10-14 in the Game & Watch migration (the build plan, Phase 5).
 *
 * Per console the host keeps three things apart: the core, the artwork and the overlay.
 * This is the artwork. Everything here is read from the GAMES registry in
 * play/gnw/gnw-host.js (through the core module's sandbox, never copied), which in turn
 * was measured from the community .lay layouts (the artists are credited on the About
 * page; settled 2026-09-23, licenses/THIRD-PARTY-NOTICES section 2):
 *   - the unit photograph (artwork/<unit>/Unit.png) and its aspect;
 *   - the screen box, and the second one on a Multi Screen unit;
 *   - the LCD stack in the old window's paint order (play/gnw/gnw-host.js
 *     _applyGameArtwork, _applyPanelLayers; index.html #play-emu-root): the backing
 *     (Background.png, or Background-Top / -Bottom on two screens), the segment SVG
 *     multiplied into it (plain paint on an inverted panel), Ball's hiding lines, the
 *     Crystal / Micro Vs. backing drawn again over the segments, then the case, then the
 *     glass reflections over the case. A Table Top cabinet has no window in its case, so
 *     its LCD goes in front (opaque).
 * The segment SVG comes from firmware/output/artwork.json.gz through the site's own
 * gateway (window.GnwArt.resolve: the archive, then a content pack), or the archive
 * fetched directly when the player is opened on its own.
 *
 * DISPLAY EFFECT: the button-press art (each unit's Animation/*.png, shown while the
 * machine sees the button held), the old window's _updateButtonArt.
 * TOUCH GEOMETRY for the shared overlay (play/shared/overlays/gnw.json, artFrom 'gnwDef')
 * is published the way overlay.js reads it: one .play-hotspot box per button, at the
 * registry's own percentages of the unit.
 *
 * Added 2026-10-14 with the host:
 * CLOSE-UP VIEW (display setting 'Close-up view', Table Top cabinets only): the old window's
 *   Zoom button (gnw-host.js gnwSetZoom), as an artwork setting: the unit's Zoom art
 *   (game.zoom.unit) with the LCD stack moved to its screen rect. As in the old window, the
 *   buttons on the art are cropped out: play is from the keys, a pad or the overlay's pad.
 * KEYS DIAGRAM: the old window's Controls diagram, drawn by the site's own engine
 *   (keys-diagram.js, window.KeysDiagram) from the unit's hotspots and its KEYS_OVERRIDE
 *   entry, with the keys the host really maps (not the engine's built-in list).
 */
/* The core module with this module's own cache tag (the host tags both alike, host.mjs CORE_V),
   so the art and the host share one engine instead of loading it twice. */
const engine = () => import('./core.mjs' + new URL(import.meta.url).search).then(m => m.engine());

const SITE = new URL('../../../', import.meta.url);
const ART_ARCHIVE = new URL('firmware/output/artwork.json.gz', SITE);
const art = (g, file) => new URL(g.artPath + file, SITE).href;

let archiveP = null;
function fromArchive(path) {
  if (!archiveP) archiveP = fetch(ART_ARCHIVE).then(r => { if (!r.ok) throw new Error('artwork archive HTTP ' + r.status); return r.body; })
    .then(b => new Response(b.pipeThrough(new DecompressionStream('gzip'))).json()).catch(e => { archiveP = null; throw e; });
  return archiveP.then(m => { if (m[path] == null) throw new Error('not in the artwork archive: ' + path); return m[path]; });
}
/** The site's gateway first, through the host (describe ctx.artFile: the one relay; it shares
    the page's cache and falls back to a content pack), else the archive directly. */
function svgText(path, artFile) {
  if (typeof artFile !== 'function') return fromArchive(path);
  return Promise.resolve(artFile(path)).then(t => (typeof t === 'string' && t ? t : fromArchive(path)), () => fromArchive(path));
}
/* gnw-host.js _parseGnwSvg, as text: no intrinsic size, stretched to its box, and the
   artist's white backing layer (inkscape:label "white") hidden. */
function prepareSvg(txt) {
  const doc = new DOMParser().parseFromString(txt, 'image/svg+xml');
  const svg = doc.documentElement;
  if (!svg || svg.nodeName.toLowerCase() !== 'svg') throw new Error('not an SVG');
  svg.removeAttribute('width'); svg.removeAttribute('height');
  svg.setAttribute('preserveAspectRatio', 'none');
  for (const g of Array.from(svg.getElementsByTagName('g'))) if (g.getAttribute('inkscape:label') === 'white') g.setAttribute('style', 'display:none');
  return new XMLSerializer().serializeToString(svg);
}
/* The site's Controls-diagram engine (keys-diagram.js), loaded into this document once. */
let kdP = null;
function keysEngine() {
  if (window.KeysDiagram) return Promise.resolve(window.KeysDiagram);
  if (!kdP) kdP = new Promise(res => {
    const sc = document.createElement('script');
    sc.src = new URL('keys-diagram.js?v=2.0.0', SITE).href;
    sc.onload = () => res(window.KeysDiagram || null); sc.onerror = () => { kdP = null; res(null); };
    document.head.appendChild(sc);
  });
  return kdP;
}
/* The unit now described: the Keys diagram and the close-up option read it. */
let cur = null;
/* A box in the unit's coordinates, moved into the close-up art's (the screen maps onto its screen). */
const toZoom = (b, s, z) => b && { l: z.l + (b.l - s.l) / s.w * z.w, t: z.t + (b.t - s.t) / s.h * z.h, w: b.w / s.w * z.w, h: b.h / s.h * z.h };
function naturalSize(src) {
  return new Promise(res => { const im = new Image(); im.onload = () => res({ w: im.naturalWidth, h: im.naturalHeight }); im.onerror = () => res(null); im.src = src; });
}
const box = r => (r ? { l: r.left / 100, t: r.top / 100, w: r.width / 100, h: r.height / 100 } : null);

/** The art description the presenter draws: the unit, the screen box(es) and the LCD stack. */
export async function describe({ model, options, artFile }) {
  const X = await engine();
  const g = X.GAMES[model];
  if (!g) return null;
  cur = { X, g, model };
  await keysEngine();                                      // ready for the Keys panel
  const zoomed = !!(g.zoom && !g.screen2 && options && options.gnwZoom);
  const unit = art(g, 'Unit.png');
  const nat = await naturalSize(unit);
  if (!nat) return null;                                   // no artwork installed: the plain screen
  const ar = nat.w / nat.h;
  const s1 = box(g.screen), s2 = box(g.screen2);
  const all = [s1, s2].filter(Boolean);
  const l = Math.min(...all.map(b => b.l)), t = Math.min(...all.map(b => b.t));
  const w = Math.max(...all.map(b => b.l + b.w)) - l, h = Math.max(...all.map(b => b.t + b.h)) - t;
  const [svg1, svg2] = await Promise.all([svgText(g.svgPath, artFile).then(prepareSvg), g.svgPath2 ? svgText(g.svgPath2, artFile).then(prepareSvg) : Promise.resolve(null)]);
  const blend = g.lcdInverted ? 'normal' : 'multiply';
  const p = g.panel || null;
  const layers = [];
  if (s2) {
    layers.push({ kind: 'img', src: art(g, g.bgFile || 'Background-Top.png'), box: s1 });
    layers.push({ kind: 'svg', svg: svg1, box: s1, blend });
    layers.push({ kind: 'img', src: art(g, g.bgFile2 || 'Background-Bottom.png'), box: s2 });
    layers.push({ kind: 'svg', svg: svg2, box: s2, blend });
  } else {
    layers.push({ kind: 'img', src: art(g, 'Background.png'), box: (p && box(p.bg)) || s1 });
    layers.push({ kind: 'svg', svg: svg1, box: s1, blend });
  }
  if (g.hideLines) layers.push({ kind: 'img', src: art(g, 'Background2.png'), box: s1 });
  if (p && p.bg && p.bgOverlayAlpha > 0) layers.push({ kind: 'img', src: art(g, 'Background.png'), box: box(p.bg), opacity: p.bgOverlayAlpha });
  const files = (p && p.gradientFiles) || ['Gradient.png', 'Gradient2.png'];
  if (p && p.gradient && p.gradientAlpha > 0) layers.push({ kind: 'img', src: art(g, files[0]), box: box(p.gradient), opacity: p.gradientAlpha, over: true });
  if (p && p.gradient && p.gradient2Alpha > 0) layers.push({ kind: 'img', src: art(g, files[1]), box: box(p.gradient2 || p.gradient), opacity: p.gradient2Alpha, over: true });
  cur.ar = ar;
  if (zoomed) {
    // The close-up: the Zoom art, the LCD stack on its (larger) screen; every layer keeps its
    // place relative to the screen. Its aspect is the registry's ('1920 / 1080').
    const [aw, ah] = String(g.zoom.aspect || '16 / 9').split('/').map(parseFloat);
    const z = box(g.zoom.screen), s = { l, t, w, h };
    for (const L of layers) L.box = toZoom(L.box || s, s, z);
    return {
      kind: 'gnw', src: art(g, g.zoom.unit), ar: aw / ah, l: z.l, t: z.t, w: z.w, h: z.h,
      band: { above: z.t / z.h, below: (1 - z.t - z.h) / z.h },
      opaque: !!g.unitBehindScreen, zoomed: true, headroom: true,
      lcd: { layers },
    };
  }
  return {
    kind: 'gnw', src: unit, ar, l, t, w, h,
    band: { above: t / h, below: (1 - t - h) / h },        // the whole unit shows: its buttons are on it
    opaque: !!g.unitBehindScreen, headroom: true,          // the whole unit stays clear of the Control Bar (R3)
    lcd: { layers },
  };
}

/* ------------------------------------------------------------------ the Keys diagram */
const KD_CSS = `.gnwk{width:100%;display:flex;justify-content:center;--muted:#8a94a6;--text:#e7ecf2;--line:#2a3242;--accent:#ee1515}
.gnwk .keys-wrap{width:min(100%,640px)}
.gnwk .keys-diagram{width:100%}
.gnwk .keys-btn.down,.gnwk .keys-rocker.down{border-color:var(--accent);background:rgba(238,21,21,.24);box-shadow:0 0 0 3px rgba(238,21,21,.3)}
.gnwk .keys-btn.down .kk,.gnwk .keys-btn.down .kl{color:var(--text)}
.gnwk .dk.down,.gnwk .st-arrow.down{color:var(--accent);text-shadow:0 0 8px rgba(238,21,21,.7)}
.gnwk .keys-btn:hover,.gnwk .keys-dpad:hover{transform:none}`;
/* The key a code types, as the engine's data-k names it (keys-diagram.js _glyphKey). */
const KCODE = { Space: ' ', Enter: 'enter', ControlRight: 'control', ControlLeft: 'control', ShiftRight: 'shift', ShiftLeft: 'shift' };
const kOf = code => KCODE[code] || (/^Key[A-Z]$/.test(code) ? code.slice(3).toLowerCase() : /^Digit\d$/.test(code) ? code.slice(5) : String(code).toLowerCase());
const GLYPH = { Space: 'Space', Enter: 'Enter', ArrowUp: '\u2191', ArrowDown: '\u2193', ArrowLeft: '\u2190', ArrowRight: '\u2192', ControlRight: 'R Ctrl', ShiftRight: 'R Shift' };

/** The unit's own Controls diagram (the host lights [data-btn] while held). */
export function keysDiagram(table, keyLabel) {
  const K = window.KeysDiagram, c = cur;
  if (!K || !c || !c.g || !c.g.hotspots) return null;
  if (!document.getElementById('gnwk-css')) { const st = document.createElement('style'); st.id = 'gnwk-css'; st.textContent = KD_CSS; document.head.appendChild(st); }
  K.ensureCss(document);
  const ov = (c.X.KEYS_OVERRIDE && c.X.KEYS_OVERRIDE[c.model]) || {};
  const all = [].concat(...table);
  // The keys the host maps for each button, in the engine's glyphs; its labels kept.
  const base = {};
  try { for (const b of K.buttons({ game: c.g, override: ov, meta: ov.meta })) base[b.name] = b; } catch (_) {}
  const meta = Object.assign({}, ov.meta || {});
  for (const ctl of all) {
    const keys = ctl.keys.slice(0, 2).map(k => GLYPH[k] || keyLabel(k));
    meta[ctl.id] = Object.assign({}, meta[ctl.id] || {}, { label: (meta[ctl.id] && meta[ctl.id].label) || (base[ctl.id] && base[ctl.id].label) || '', keys });
  }
  const el = document.createElement('div');
  el.className = 'gnwk';
  el.innerHTML = K.buildHTML({ game: c.g, gameKey: c.model, ar: c.ar || 1, override: ov, meta, games: c.X.GAMES, overrides: c.X.KEYS_OVERRIDE, tight: true });   // tight: the Keys panel's close layout (4 Nov)
  const dia = el.querySelector('.keys-diagram');
  if (dia) dia.style.aspectRatio = String(parseFloat(dia.dataset.aspect) || 1);
  // Name each drawn control by the button it is: the one whose mapped keys it shows.
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

/* ------------------------------------------------------------------ display effect + touch boxes */
/* gnw-host.js BUTTON_DEFS: the button's pressed-state file, and the hotspot class overlay.js reads. */
const BUTTONS = {
  left: ['hammer-left', 'Animation/Left-Flat.png'], right: ['hammer-right', 'Animation/Right-Flat.png'],
  btn1: ['quad-btn1', 'Animation/1-Flat.png'], btn2: ['quad-btn2', 'Animation/2-Flat.png'], btn3: ['quad-btn3', 'Animation/3-Flat.png'], btn4: ['quad-btn4', 'Animation/4-Flat.png'],
  gameA: ['round-a', 'Animation/Grey-Flat-1.png'], gameB: ['round-b', 'Animation/Grey-Flat-2.png'], time: ['round-time', 'Animation/Grey-Flat-3.png'],
  hit: ['updown-hit', 'Animation/Hit-Flat.png'], up: ['updown-up', 'Animation/Up-Flat.png'], down: ['updown-down', 'Animation/Down-Flat.png'],
  open: ['hammer-open', 'Animation/Jump-Flat.png'], jump: ['hammer-jump', 'Animation/Jump-Flat.png'], alarm: ['round-alarm', 'Animation/Grey-Flat-1.png'],
};
const TITLES = { left: 'Left', right: 'Right', btn1: '1', btn2: '2', btn3: '3', btn4: '4', gameA: 'Game A', gameB: 'Game B', time: 'Time', hit: 'Hit', up: 'Up', down: 'Down', open: 'Open', jump: 'Jump', alarm: 'Alarm' };

/* ------------------------------------------------------------------ the unit's own on-screen pad */
/* (1 Nov 2026: "For DK Jr CJ-71 the unit has a joystick on the left and one button on the
   right. When zoomed in the overlay only shows two buttons for left and right"). The shared overlay
   (play/shared/overlays/gnw.json) had one float pad for every unit: Left, Right, Game A, Game B,
   Time. It is the pad on a touch screen whenever the unit's art buttons are not there to press
   (the Table Top close-up, Full screen), so a unit with a stick, a cross pad, Up / Down or two
   buttons on one side could not be played from it. Each unit's pad is now built from the same
   registry the art buttons come from (gnw-host.js GAMES: hotspots, inputRows, jump / fire labels;
   KEYS_OVERRIDE hideButtons), so nothing is guessed per unit:
     - the buttons the machine reads (its input rows, plus the two hammer pins), on the side of the
       unit they are on (left of centre: bottom left; else bottom right), in a row or a column as
       they sit on the case;
     - Up / Down / Left / Right together, or four numbered buttons drawn as a cross on the case
       (DK Jr.'s stick, the Multi Screen cross pads), are one 8-way pad pressing those inputs;
     - a unit with no art for its player controls (Micro Vs.: the pads are on cables) gets its
       player 1 pad on the left and its button on the right;
     - the mode buttons the unit has (Game A, Game B, Time, Alarm) in a row at the bottom centre,
       in the case's order.
   Every press is the unit's own named input ('gnw:btn2'), the same the keys and a gamepad press. */
const MODE_IDS = ['gameA', 'gameB', 'time', 'alarm'];
const MODE_LABEL = { gameA: 'GAME A', gameB: 'GAME B', time: 'TIME', alarm: 'ALARM' };
function padOf(g, ko, ar) {
  const hs = g.hotspots || {};
  ar = ar > 0 ? ar : 1.5;
  const names = new Set();
  for (const row of g.inputRows || []) for (const n of Object.keys(row)) names.add(n);
  if (hs.left) names.add('left');
  if (hs.right) names.add('right');
  const at = n => (hs[n] ? { x: (hs[n].left + hs[n].width / 2) / 100, y: (hs[n].top + hs[n].height / 2) / 100 } : null);
  const player = [...names].filter(n => !MODE_IDS.includes(n) && !/^p2/.test(n));
  const items = [], used = new Set();
  const mean = ps => ({ x: ps.reduce((a, p) => a + p.x, 0) / ps.length, y: ps.reduce((a, p) => a + p.y, 0) / ps.length });
  const dirsN = ['up', 'down', 'left', 'right'];
  /* Four buttons drawn as a cross on the case: the top one is Up, the bottom Down, and so on
     (Crab Grab's Left / Right and Up / Down sit on opposite sides: no cross, four buttons). */
  const cross = ns => {
    if (!ns.every(n => player.includes(n) && at(n))) return false;
    const P = ns.map(n => Object.assign({ n }, at(n)));
    const by = f => P.slice().sort((a, b) => f(a) - f(b));
    const top = by(p => p.y)[0], bottom = by(p => -p.y)[0], left = by(p => p.x)[0], right = by(p => -p.x)[0];
    const spanX = (right.x - left.x) * ar, spanY = bottom.y - top.y;
    if (new Set([top, bottom, left, right]).size !== 4 || !(spanX > 0) || !(spanY > 0)) return false;
    if (Math.abs(top.x - bottom.x) * ar >= spanX * 0.25 || Math.abs(left.y - right.y) >= spanY * 0.25) return false;
    items.push(Object.assign({ kind: 'pad', dirs: { up: 'gnw:' + top.n, down: 'gnw:' + bottom.n, left: 'gnw:' + left.n, right: 'gnw:' + right.n } }, mean(P)));
    ns.forEach(n => used.add(n));
    return true;
  };
  if (dirsN.every(n => player.includes(n) && !at(n))) {
    // No art for them (Micro Vs.: player 1's pad is on a cable): one pad.
    items.push({ kind: 'pad', dirs: { up: 'gnw:up', down: 'gnw:down', left: 'gnw:left', right: 'gnw:right' }, x: null, y: null });
    dirsN.forEach(n => used.add(n));
  } else if (!cross(dirsN)) cross(['btn1', 'btn2', 'btn3', 'btn4']);
  const ORDER = ['left', 'right', 'up', 'down', 'btn1', 'btn2', 'btn3', 'btn4', 'hit', 'open', 'jump', 'fire'];
  for (const n of player.sort((a, b) => (ORDER.indexOf(a) + 99) % 99 - (ORDER.indexOf(b) + 99) % 99)) {
    if (used.has(n)) continue;
    const p = at(n) || { x: null, y: null };
    items.push({ kind: 'btn', id: n, x: p.x, y: p.y });
  }
  // No art for a control (Micro Vs.): directions on the left, the rest on the right.
  const sideOf = it => (it.x != null ? (it.x < 0.5 ? 'l' : 'r') : (it.kind === 'pad' || dirsN.includes(it.id) ? 'l' : 'r'));
  const meta = (ko && ko.meta) || {};
  const labelOf = (it, siblings, horiz) => {
    const n = it.id;
    if (n === 'jump') return String(g.jumpLabel || 'Jump').toUpperCase();
    if (n === 'fire') return String(g.fireLabel || 'Fire').toUpperCase();
    if (meta[n] && meta[n].label) { const s = String(meta[n].label).split('/').pop().trim().split(/\s+/)[0]; if (s) return s.toUpperCase(); }
    if (/^btn\d$/.test(n)) {
      // A numbered button: an arrow for where it sits in its pair, as on the case.
      if (siblings.length === 2) { const first = siblings[0] === it; return horiz ? (first ? '◀' : '▶') : (first ? '▲' : '▼'); }
      return n.slice(3);
    }
    return String(TITLES[n] || n).toUpperCase();
  };
  const groups = [];
  for (const side of ['l', 'r']) {
    const list = items.filter(it => sideOf(it) === side);
    if (!list.length) continue;
    const xs = list.map(it => (it.x != null ? it.x : 0.5)), ys = list.map(it => (it.y != null ? it.y : 0.5));
    const horiz = list.length < 2 || (Math.max(...xs) - Math.min(...xs)) * ar >= (Math.max(...ys) - Math.min(...ys));
    const order = list.slice().sort((a, b) => (horiz ? (a.x || 0) - (b.x || 0) : (a.y || 0) - (b.y || 0)));
    const hasPad = order.some(it => it.kind === 'pad');
    const len = it => (it.kind === 'pad' ? 1 : order.length === 1 ? 1 : 0.8);     // along the row / column, in pad units
    const across = hasPad ? 1 : horiz ? 0.62 : 1;
    const total = order.reduce((a, it) => a + len(it), 0);
    const gw = horiz ? total : across, gh = horiz ? across : total;
    let pos = 0;
    const controls = order.map(it => {
      const L = len(it), c = pos + L / 2; pos += L;
      let cx = horiz ? c / gw : 0.5, cy = horiz ? 0.5 : c / gh;
      if (order.length === 1 && it.kind !== 'pad') cx = side === 'l' ? 0.4 : 0.6;   // a lone button sits where it always did
      if (it.kind === 'pad') return { id: 'pad', label: 'Stick', shape: 'dpad', dirs: it.dirs, x: cx, y: cy, w: 1 / gw, sq: true };
      const btns = order.filter(o => o.kind === 'btn');
      return { id: it.id, label: labelOf(it, btns, horiz), input: 'gnw:' + it.id, shape: 'circle', x: cx, y: cy, w: 0.58 / gw, sq: true };
    });
    // Upright on a phone the mode row sits under the corners: the corners stand above it.
    groups.push({ id: side === 'l' ? 'left' : 'right', dock: side === 'l' ? 'bl' : 'br', w: gw, h: gh, portrait: { raise: 0.3 }, controls });
  }
  const hide = (ko && ko.hideButtons) || [];
  const modes = MODE_IDS.filter(n => hs[n] && names.has(n) && !hide.includes(n)).map(n => Object.assign({ n }, at(n)));
  if (modes.length) {
    const mx = modes.map(m => m.x), my = modes.map(m => m.y);
    const horiz = (Math.max(...mx) - Math.min(...mx)) * ar >= (Math.max(...my) - Math.min(...my));
    modes.sort((a, b) => (horiz ? a.x - b.x : a.y - b.y));
    groups.push({ id: 'modes', dock: 'bc', row: { gap: 8 }, controls: modes.map(m => ({ id: m.n, label: MODE_LABEL[m.n], input: 'gnw:' + m.n, shape: 'pill', w: [56, 14, 78], h: [21, 5, 27] })) });
  }
  return groups;
}

export const effects = [{
  id: 'buttons',
  options: [],
  perGame: true,                                           // its boxes are this unit's: re-attached for another unit
  attach({ presenter, core }) {
    const c0 = core(), g = c0 && c0.game;
    const wrap = presenter.wrap, imgs = {}, boxes = [];
    if (g) {
      for (const n of Object.keys(BUTTONS)) {
        const hs = g.hotspots && g.hotspots[n];
        if (!hs) continue;
        const [cls, file0] = BUTTONS[n];
        // The touch box overlay.js reads back (gnwDef): inline percentages of the unit.
        const d = document.createElement('div');
        d.className = 'play-hotspot ' + cls; d.title = (n === 'jump' && g.jumpLabel) || TITLES[n] || n;
        d.style.cssText = `position:absolute;left:${hs.left}%;top:${hs.top}%;width:${hs.width}%;height:${hs.height}%;border-radius:50%;pointer-events:none;z-index:3`;
        wrap.appendChild(d); boxes.push(d);
        // The pressed-state art, the unit's own size, over the case.
        const file = g.pressedArt && n in g.pressedArt ? g.pressedArt[n] : file0;
        if (!file || g.noPressedArt || g.pressHighlight || (g.highlightButtons && g.highlightButtons.includes(n))) continue;
        const im = document.createElement('img');
        im.alt = ''; im.src = art(g, file); im.dataset.btn = n;
        im.style.cssText = 'position:absolute;z-index:2;pointer-events:none;display:none;user-select:none';
        wrap.appendChild(im); imgs[n] = im;
      }
    }
    const sync = () => {
      // Exactly over the unit photograph, wherever the presenter put it.
      const a = presenter.img;
      for (const im of Object.values(imgs)) { im.style.left = a.style.left; im.style.top = a.style.top; im.style.width = a.style.width; im.style.height = a.style.height; }
      const off = presenter.full || !presenter.art || !!presenter.art.zoomed;
      for (const d of boxes) d.style.display = off ? 'none' : '';
      for (const im of Object.values(imgs)) if (off) im.style.display = 'none';
      // The close-up crops the unit's buttons out (as the old window did): the overlay's
      // buttons on the art go with them; its pad and strip stay.
      const ovArt = wrap.querySelector('.cwov-art');
      if (ovArt) ovArt.style.visibility = presenter.art && presenter.art.zoomed ? 'hidden' : '';
      tell();
    };
    /* This unit's own on-screen pad (padOf above), handed to the shared overlay once it is up, and
       again when the close-up or Full screen comes or goes (the art buttons stand down and the pad
       takes over: neither shows the unit's buttons). */
    const ko = (cur && cur.g === g && cur.X && cur.X.KEYS_OVERRIDE && cur.X.KEYS_OVERRIDE[cur.model]) || null;
    const ar0 = cur && cur.g === g && cur.ar ? cur.ar : (g ? String(g.unitAspect || '2227 / 1500').split('/').map(parseFloat).reduce((a, b) => a / b) : 1.5);
    let groups = null; try { groups = g ? padOf(g, ko, ar0) : null; } catch (e) { console.warn('[gnw art] on-screen pad:', e); }
    let toldOv = null, toldOff = null;
    function tell() {
      const ov = window.CwOverlay && window.CwOverlay.instance ? window.CwOverlay.instance('gnw') : null;
      if (!ov || !ov.root || typeof ov.setUnit !== 'function') return;
      const off = !!(presenter.full || (presenter.art && presenter.art.zoomed));   // Full screen shows no unit either
      if (ov === toldOv && off === toldOff) return;
      toldOv = ov; toldOff = off;
      try { ov.setUnit({ groups, artOff: off }); } catch (e) { console.warn('[gnw art] on-screen pad:', e); }
    }
    let last = '';
    return {
      setOption() {},
      detach() { for (const d of boxes) d.remove(); for (const im of Object.values(imgs)) im.remove(); },
      sync,
      frame() {
        tell();
        const c = core();
        if (!c || !c.pressed || presenter.full) return;
        const held = c.pressed(), sig = held.join(',');
        if (sig === last) return;
        last = sig;
        for (const [n, im] of Object.entries(imgs)) im.style.display = held.includes(n) ? 'block' : 'none';
      },
    };
  },
}, {
  /* The close-up view (Table Top cabinets): an artwork setting; the host describes the art
     again when it changes (redescribe). Off by default, as the old window opened. */
  id: 'zoom',
  options: [{ id: 'gnwZoom', label: 'Close-up view', type: 'bool', default: false, group: 'display', redescribe: true,
    help: 'The cabinet\u2019s screen up close. Its buttons are cropped out: play with the keys, a pad or the on-screen pad.',
    when: () => !!(cur && cur.g && cur.g.zoom && !cur.g.screen2) }],
  attach() { return { setOption() {} }; },
}];
