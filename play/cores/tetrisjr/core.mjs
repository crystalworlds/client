/*
 * play/cores/tetrisjr/core.mjs -- Tetris Jr. (TR-66) for the one play host (Core API 1.0).
 * Started 2026-10-14 in the Tetris Jr. and colour-unit migration (unified UI, phase 5).
 *
 * WRAPS, UNCHANGED: play/tetrisjr/engine.js, the clean-room rules engine (TetrisJr). It is
 * not an emulator and needs no game file and no firmware: this is the site's one built-in
 * game, and it runs with no content pack and no game server.
 *
 * A PURE MACHINE (Core API 3.1). The engine is loaded as text and run with its own globals:
 *   - `Date` is the host's virtual clock (env.now() plus the offset ext.clock sets), so the
 *     clock screen shows the host's time, stops while paused, and comes back with a state;
 *   - the random generator is a seeded one held here and saved in every state (the API's
 *     "the random generator moves into the state"), so a rewind replays the same pieces.
 * No DOM, no storage, no timers.
 *
 * VIDEO: 'segments' (Core API 3.4.2). The old page bound the engine's view calls to the site's
 * two sprite sheets in the DOM (play/tetrisjr/index.html makeDisplay). The same binding is
 * kept here as data: one level per segment id, in the order of SEGMENT_IDS below, and the
 * host's segment presenter maps a level to the element's opacity. Levels:
 *   0    hidden (the old page's display:none)
 *   33   an unlit grid cell, the etched ghost (the old page's fill rgba(18,26,10,.13):
 *        13 % of the lit ink, so 0.13 x 255 = 33)
 *   255  shown / lit
 *
 * SOUND: the old page played each cue on its own OscillatorNode (index.html Beep). Here the
 * same nine cues (frequency, length, wave, the 0.06 gain and its exponential fall to 0.0001)
 * are synthesised into samples at the host's rate, so the sound goes through the host's one
 * engine and starts from the launching press like every other console. The demo stays
 * silent, as the engine itself decides (_sfx).
 */
import { CoreError } from '../../host/core-api.mjs';

/* MEASURED 2026-10-14 (a local tj-measure.mjs): every segment group in the two
   sheets, top sheet then bottom, minus the empty 'sprites' group. 85 are on the top screen. */
export const SEGMENT_IDS = ['digit00', 'digit01', 'digit02', 'digit03', 'digit04', 'digit05', 'digit06', 'digit10', 'digit11', 'digit12', 'digit13', 'digit14', 'digit15', 'digit16', 'digit:0', 'digit20', 'digit21', 'digit22', 'digit23', 'digit24', 'digit25', 'digit26', 'digit30', 'digit31', 'digit32', 'digit33', 'digit34', 'digit35', 'digit36', 'AM', 'PM', 'alarm1', 'alarm2', 'alarm3', 'cell55', 'cell56', 'cell57', 'cell58', 'cell45', 'cell46', 'cell47', 'cell48', 'cell35', 'cell36', 'cell37', 'cell38', 'cell25', 'cell26', 'cell27', 'cell28', 'cell15', 'cell16', 'cell17', 'cell18', 'cell05', 'cell06', 'cell07', 'cell08', 'dealer1', 'dealer2', 'dealer3', 'dealer11', 'dealer12', 'dealer13', 'dealer14', 'dealer21', 'dealer22', 'dealer23', 'dealer24', 'clapper1', 'clapper2', 'clapper3', 'textPoint', 'textTime', 'T5', 'swinger1', 'swinger2', 'swinger3', 'swinger4', 'swinger5', 'swingerHitHead', 'swinger6', 'swinger7', 'swinger8', 'swinger9', 'GameA', 'GameB', 'miss1', 'miss2', 'miss3', 'cellG1', 'cellG2', 'cellG3', 'cellG4', 'cellG5', 'cellG6', 'cellG7', 'cellG8', 'cellG9', 'cellGA', 'cellGB', 'cellGC', 'cellF1', 'cellF2', 'cellF3', 'cellF4', 'cellF5', 'cellF6', 'cellF7', 'cellF8', 'cellF9', 'cellFA', 'cellFB', 'cellFC', 'cellE1', 'cellE2', 'cellE3', 'cellE4', 'cellE5', 'cellE6', 'cellE7', 'cellE8', 'cellE9', 'cellEA', 'cellEB', 'cellEC', 'cellD1', 'cellD2', 'cellD3', 'cellD4', 'cellD5', 'cellD6', 'cellD7', 'cellD8', 'cellD9', 'cellDA', 'cellDB', 'cellDC', 'cellC1', 'cellC2', 'cellC3', 'cellC4', 'cellC5', 'cellC6', 'cellC7', 'cellC8', 'cellC9', 'cellCA', 'cellCB', 'cellCC', 'cellB1', 'cellB2', 'cellB3', 'cellB4', 'cellB5', 'cellB6', 'cellB7', 'cellB8', 'cellB9', 'cellBA', 'cellBB', 'cellBC', 'cellA1', 'cellA2', 'cellA3', 'cellA4', 'cellA5', 'cellA6', 'cellA7', 'cellA8', 'cellA9', 'cellAA', 'cellAB', 'cellAC', 'cell95', 'cell96', 'cell97', 'cell98', 'cell85', 'cell86', 'cell87', 'cell88', 'cell75', 'cell76', 'cell77', 'cell78', 'B6', 'cell65', 'cell66', 'cell67', 'cell68', 'cellA0', 'cellB0', 'cellC0', 'cellD0', 'cellE0', 'cellF0', 'cellG0', 'hitter1', 'hitter2', 'hitter3', 'blocks1', 'blocks2', 'blocks3'];
export const TOP_COUNT = 85;
/* MEASURED the same way: the old page's classifyDigits rule (seven segments per digit sorted
   into a..g by their boxes, digits left to right) run on the sheets' own path points. */
const DIGIT_MAP = [
  { a: 'digit30', g: 'digit32', d: 'digit34', f: 'digit36', b: 'digit31', e: 'digit35', c: 'digit33' },
  { a: 'digit20', g: 'digit22', d: 'digit24', f: 'digit26', b: 'digit21', e: 'digit25', c: 'digit23' },
  { a: 'digit10', g: 'digit12', d: 'digit14', f: 'digit16', b: 'digit11', e: 'digit15', c: 'digit13' },
  { a: 'digit00', g: 'digit02', d: 'digit04', f: 'digit06', b: 'digit01', e: 'digit05', c: 'digit03' },
];
const NUM = { 0: 'abcdef', 1: 'bc', 2: 'abged', 3: 'abgcd', 4: 'fgbc', 5: 'afgcd', 6: 'afgecd', 7: 'abc', 8: 'abcdefg', 9: 'abcdfg' };
const SWING_BODY = [6, 7];
const GHOST = 33, ON = 255;
const FPS = 60;
/* The raster the host keeps of the two windows (screenshots, slot pictures): the screen box
   of art.mjs (both windows, 0.4473 x 0.7049 of the 1100 x 1369 art) at the art's own scale. */
const SHOT_W = 492, SHOT_H = 965;

/* The old page's blip bank (index.html Beep), as data: [Hz, seconds, wave]. */
const TONES = {
  step: [180, 0.03, 'square'], shift: [240, 0.03, 'square'],
  rotate: [420, 0.05, 'square'], drop: [140, 0.04, 'sawtooth'],
  land: [110, 0.07, 'triangle'], deal: [520, 0.05, 'square'],
  points1: [660, 0.10, 'square'], points2: [880, 0.16, 'square'],
  miss: [90, 0.30, 'sawtooth'],
};
const GAIN = 0.06, FLOOR = 0.0001;

export const manifest = {
  api: '1.0',
  id: 'tetrisjr',
  label: 'Tetris Jr.',
  form: 'handheld',
  build: 'play/tetrisjr/engine.js',
  thread: 'main',
  files: {
    // The one built-in game: no file is asked for (host diff H3, scratch tft-tj).
    game: { exts: [], maxBytes: 0, builtIn: true },
    firmware: [],
  },
  video: { kind: 'segments', maxWidth: 1100, maxHeight: 1369, screens: 2 },
  audio: { channels: 1, format: 'f32', filtered: true },     // synthesised, DC-free already
  state: { supported: true, deterministic: true, approxBytes: 8 * 1024 },
  extensions: ['clock', 'attract'],
  modelLabel: () => 'Tetris Jr.',
  /* The old page's slots (localStorage tetrisjr.saves.tr66, 12 of { ts, thumb, state: the
     engine's own serialize() }): wrapped as this module's state; the display repaints from the
     engine on its next beat. Read in place, never written. */
  legacy: {
    slotsLocal: {
      key: () => 'tetrisjr.saves.tr66',
      decode: e => ({ ts: e.ts, thumb: e.thumb || null, state: new TextEncoder().encode(JSON.stringify({ core: 'tetrisjr', v: 1, engine: e.state, rng: (e.ts | 0) || 1, clockOffset: 0, held: [0, 0] })) }),
    },
  },
};

/* Bit order = the order of each port's controls. Keys are the old page's (and play-pad.js
   FN.tj, which Settings remaps): arrows or Q / E shift, Up or Space rotate, Down drops,
   1 / 2 / 3 = Game A / Game B / Time. */
const PLAYER = [
  { id: 'left', label: 'Left', type: 'button', defaults: { key: ['ArrowLeft', 'KeyQ'], pad: ['Left'] } },
  { id: 'right', label: 'Right', type: 'button', defaults: { key: ['ArrowRight', 'KeyE'], pad: ['Right'] } },
  { id: 'rotate', label: 'Rotate', type: 'button', defaults: { key: ['ArrowUp'], pad: ['Up'] } },
  { id: 'drop', label: 'Drop', type: 'button', defaults: { key: ['ArrowDown'], pad: ['Down'] } },
  { id: 'action', label: 'Rotate (round button)', type: 'button', defaults: { key: ['Space'], pad: ['A', 'B', 'X', 'Y'] } },
];
const CONSOLE = [
  { id: 'game-a', label: 'Game A', type: 'button', defaults: { key: ['Digit1'], pad: ['Start'] } },
  { id: 'game-b', label: 'Game B', type: 'button', defaults: { key: ['Digit2'], pad: ['Select'] } },
  { id: 'time', label: 'Time', type: 'button', defaults: { key: ['Digit3'], pad: ['LB'] } },
];

let engineSrc = null;
async function engineSource() {
  if (engineSrc) return engineSrc;
  const r = await fetch(new URL('../../tetrisjr/engine.js', import.meta.url));
  if (!r.ok) throw new CoreError('unsupported', `the Tetris Jr. engine did not load (HTTP ${r.status})`);
  return (engineSrc = await r.text());
}

/* mulberry32: a small seeded generator whose whole state is one 32-bit number. */
function makeRng(seed) {
  const g = { s: seed >>> 0 };
  g.next = () => { let t = (g.s = (g.s + 0x6D2B79F5) >>> 0); t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  return g;
}

export async function create(env) {
  const src = await engineSource();
  let clockOffset = 0;                                   // ext.clock: the set time minus the host's clock
  const RealDate = Date;
  const nowMs = () => env.now() + clockOffset;
  /* The engine's own Date: `new Date()` is the host's clock; anything else is the real class. */
  function VDate(...a) { return a.length ? new RealDate(...a) : new RealDate(nowMs()); }
  VDate.now = nowMs; VDate.UTC = RealDate.UTC; VDate.parse = RealDate.parse; VDate.prototype = RealDate.prototype;
  const scope = {};
  // eslint-disable-next-line no-new-func
  new Function('globalThis', 'module', 'Date', src)(scope, undefined, VDate);
  const TetrisJr = scope.TetrisJr;
  if (typeof TetrisJr !== 'function') throw new CoreError('unsupported', 'the Tetris Jr. engine did not define TetrisJr');

  /* ---------------------------------------------------------------- the display, as levels */
  const N = SEGMENT_IDS.length;
  const index = new Map(SEGMENT_IDS.map((id, i) => [id, i]));
  const isCell = SEGMENT_IDS.map(id => id.indexOf('cell') === 0);
  const shown = new Uint8Array(N), lit = new Uint8Array(N), levels = new Uint8Array(N);
  const level = i => (shown[i] ? (isCell[i] ? (lit[i] ? ON : GHOST) : ON) : 0);
  const show = (id, on) => { const i = index.get(id); if (i === undefined) return; shown[i] = on ? 1 : 0; levels[i] = level(i); };
  const setLit = (id, on) => { const i = index.get(id); if (i === undefined) return; lit[i] = on ? 1 : 0; levels[i] = level(i); };
  const toHex = n => (n < 10 ? String(n) : String.fromCharCode(55 + n));
  function setDigit(pos, ch) {
    const map = DIGIT_MAP[pos]; if (!map) return;
    const on = (ch === ' ' || ch == null) ? '' : (NUM[ch] || '');
    for (const name of 'abcdefg') if (map[name]) show(map[name], on.includes(name));
  }
  function showNumber(value) {
    const chars = String(Math.max(0, value | 0)).slice(-4).padStart(4, ' ');
    for (let i = 0; i < 4; i++) setDigit(i, chars[i] === ' ' ? ' ' : +chars[i]);
  }
  function resetAll() {
    for (let i = 0; i < N; i++) { if (isCell[i]) lit[i] = 0; else shown[i] = 0; }
    for (const R of 'ABCDEFG') { const i = index.get('cell' + R + '0'); if (i !== undefined) shown[i] = 0; }
    for (let i = 0; i < N; i++) levels[i] = level(i);
  }
  const poseOne = (p, count, active) => { for (let i = 1; i <= count; i++) show(p + i, i === active); };
  const poseMany = (p, count, idxs) => { for (let i = 1; i <= count; i++) show(p + i, idxs.includes(i)); };
  // Power-on state: every segment drawn (the sheet as it loads), then the old page's resetAll.
  shown.fill(1); resetAll();

  /* The engine's view, the old page's makeDisplay call for call (index.html, 2026-10-14). */
  const view = {
    reset() { resetAll(); },
    allSegments() { shown.fill(1); for (let i = 0; i < N; i++) { if (isCell[i]) lit[i] = 1; levels[i] = level(i); } },
    setCell(kind, r, c, on) {
      const id = kind === 'ch' ? 'cell' + toHex(r) + (c + 5) : 'cell' + toHex(r + 10) + toHex(c + 1);
      setLit(id, on);
    },
    setPreview(shape, rows) {
      for (let r = 0; r < 2; r++) for (let c = 0; c < 4; c++) show('dealer' + (r + 1) + (c + 1), !!(rows[r] && rows[r][c] === 'x'));
    },
    setScore(n) { showNumber(n); },
    setTime(sec) { showNumber(sec); },
    setClock(h, m, colonOn, pm) {
      const hh = String(h);
      setDigit(0, hh.length === 2 ? +hh[0] : ' ');
      setDigit(1, +hh[hh.length - 1]);
      const mm = String(m).padStart(2, '0');
      setDigit(2, +mm[0]);
      setDigit(3, +mm[1]);
      show('digit:0', colonOn);
      show('AM', !pm);
      show('PM', pm);
    },
    setLabel(w) { show('textPoint', w === 'point'); show('textTime', w === 'time'); },
    setMode(m) { show('GameA', m === 'A'); show('GameB', m === 'B'); },
    setMisses(n) { for (let i = 1; i <= 3; i++) show('miss' + i, i <= n); },
    setBlocks(ids) { for (let i = 1; i <= 3; i++) show('blocks' + i, ids.includes(i)); },
    dealer(p) {
      poseOne('dealer', 3, p === 'deal' ? 1 : p === 'idle' ? 2 : 3);
      if (p !== 'idle') this.setPreview(null, [[], []]);
    },
    clapper(p) { poseMany('clapper', 3, p === 'off' ? [] : p === 'clap' ? [1, 3] : [1, 2]); },
    hitter(p) { poseMany('hitter', 3, p === 'off' ? [] : p === 'hit' ? [1, 3] : [1, 2]); },
    swinger(p) {
      for (let i = 0; i <= 9; i++) show('swinger' + i, false);
      show('swingerHitHead', false);
      if (p === 'off') return;
      if (p === 'push') { for (const k of [5, 6, 8]) show('swinger' + k, true); show('swingerHitHead', true); return; }
      if (p === 'fall') { for (const k of [5, 6, 9]) show('swinger' + k, true); return; }
      for (const k of SWING_BODY) show('swinger' + k, true);
      show('swinger' + p, true);
      if (p === 4) show('swinger8', true);
    },
    pendulum(p) {
      for (let i = 0; i <= 9; i++) show('swinger' + i, false);
      show('swingerHitHead', false);
      if (p === 'off') return;
      show('swinger' + p, true);
      if (p === 4) show('swinger8', true);
    },
    sound(name) { beep(name); },
    gameOver() { /* a real LCD unit just holds the final frame */ },
  };

  /* ---------------------------------------------------------------- sound */
  const voices = [];
  const audioBuf = { data: new Float32Array(2048), frames: 0 };
  let audioAcc = 0;
  const rate = () => Math.round((env.audioRate && env.audioRate()) || 48000);
  function beep(name) {
    const t = TONES[name]; if (!t) return;
    voices.push({ f: t[0], d: t[1], wave: t[2], age: 0, phase: 0 });
    if (voices.length > 8) voices.shift();
  }
  /* Band-limited edges (polyBLEP) for the square and the saw, as an oscillator's are. */
  const blep = (t, dt) => { if (t < dt) { t /= dt; return t + t - t * t - 1; } if (t > 1 - dt) { t = (t - 1) / dt; return t * t + t + t + 1; } return 0; };
  function synth(n, sr) {
    if (audioBuf.data.length < n) audioBuf.data = new Float32Array(n * 2);
    const out = audioBuf.data;
    out.fill(0, 0, n);
    for (let v = voices.length - 1; v >= 0; v--) {
      const o = voices[v], dt = o.f / sr, len = Math.round(o.d * sr), k = Math.log(FLOOR / GAIN) / len;
      for (let i = 0; i < n && o.age < len; i++, o.age++) {
        const p = o.phase;
        let s;
        if (o.wave === 'square') s = (p < 0.5 ? 1 : -1) + blep(p, dt) - blep((p + 0.5) % 1, dt);
        else if (o.wave === 'sawtooth') s = (2 * p - 1) - blep(p, dt);
        else s = 1 - 4 * Math.abs(p - 0.5);                       // triangle
        out[i] += s * GAIN * Math.exp(k * o.age);
        o.phase = p + dt; if (o.phase >= 1) o.phase -= 1;
      }
      if (o.age >= len) voices.splice(v, 1);
    }
    audioBuf.frames = n;
  }

  /* ---------------------------------------------------------------- the machine */
  let rng = makeRng((env.now() ^ 0x9E3779B9) >>> 0);
  let game = null, held = [0, 0], frames = 0;
  /* A game has started (4 Nov 2026): false while the clock and demo show, true from Game A or
     Game B, or a loaded save. The host reads core.started so the Continue row never keeps a demo. */
  let started = false;
  function powerOn() {
    game = new TetrisJr(view, { rng: () => rng.next() });
    voices.length = 0;
    game.startDemo();                        // a real unit on a shelf: the clock with the demo playing
    started = false;
  }

  const core = {
    info: { build: null },
    load(req) {
      void req;
      powerOn();
      return {
        fps: FPS,
        video: { width: SHOT_W, height: SHOT_H, format: 'segments', pixelAspect: 1, rotation: 0, segments: { ids: SEGMENT_IDS, top: TOP_COUNT } },
        audio: { rate: 0 },                   // 0 = synthesised at env.audioRate()
        ports: [
          { port: 0, kind: 'player', device: 'tj-pad', controls: PLAYER },
          { port: 1, kind: 'console', device: 'tj-console', controls: CONSOLE },
        ],
        battery: [],
        options: [],
        extensions: { clock: true, attract: true },
        attract: true,
        model: 'tr66',
      };
    },
    reset() { held = [0, 0]; shown.fill(1); resetAll(); powerOn(); },
    setInput(port, s) {
      const m = s.buttons | 0, was = held[port] | 0, rose = m & ~was;
      held[port] = m;
      if (!game) return;
      if (port === 0) {
        const L = m & 1, R = m & 2;
        game.setShiftHeld(L && !R ? -1 : R && !L ? 1 : 0);
        if (rose & (4 | 16)) game.input('rotate', true);
        if ((m ^ was) & 8) game.input('drop', !!(m & 8));
      } else if (port === 1) {
        if (rose & 1) { game.start('A'); started = true; }
        else if (rose & 2) { game.start('B'); started = true; }
        else if (rose & 4) { game.startDemo(); started = false; }
      }
    },
    runFrame() {
      if (!game) return;
      game.update(1 / FPS); frames++;
      const sr = rate();
      audioAcc += sr / FPS;
      const n = Math.floor(audioAcc); audioAcc -= n;
      synth(n, sr);
    },
    video() { return { format: 'segments', width: SHOT_W, height: SHOT_H, stride: N, data: levels, levels }; },
    audio() { return audioBuf; },
    serialize() {
      if (!game) throw new CoreError('unsupported', 'nothing is running');
      const st = { core: 'tetrisjr', v: 1, rng: rng.s, clockOffset, held, shown: Array.from(shown), lit: Array.from(lit), engine: game.serialize() };
      return new TextEncoder().encode(JSON.stringify(st));
    },
    check(b) {
      let st;
      try { st = JSON.parse(new TextDecoder().decode(b)); } catch (_) { throw new CoreError('damaged', 'This is not a Tetris Jr. save state.'); }
      if (!st || st.core !== 'tetrisjr') throw new CoreError('wrong-core', 'This save was not made by Tetris Jr.');
      if (st.v !== 1 || !st.engine) throw new CoreError('wrong-core', `This save is format ${st.v}; this player reads format 1.`);
      return st;
    },
    unserialize(b) {
      const st = core.check(b);
      if (!game) powerOn();
      if (!game.deserialize(st.engine)) throw new CoreError('damaged', 'The engine refused this save.');
      rng = makeRng(st.rng); clockOffset = +st.clockOffset || 0;
      // The display exactly as it was (the engine's repaint re-syncs fine detail only on its next beat).
      // An old page's save has no display arrays: the engine's repaint fills them on its next beat.
      for (let i = 0; i < N; i++) { shown[i] = st.shown && st.shown[i] ? 1 : 0; lit[i] = st.lit && st.lit[i] ? 1 : 0; levels[i] = level(i); }
      // The buttons as the engine last saw them (its held shift and drop are in its state); the
      // host then re-sends what is held NOW, and the difference is pressed or let go.
      held = Array.isArray(st.held) ? [st.held[0] | 0, st.held[1] | 0] : [0, 0];
      voices.length = 0;
      started = true;
      return st;
    },
    ext: {
      clock: { set(ms) { clockOffset = ms - env.now(); } },
      attract: { start() { if (game) { game.startDemo(); started = false; } } },
    },
    details() { return `Tetris Jr. clean-room rules engine (play/tetrisjr/engine.js) · ${N} segments · ${FPS} Hz virtual · sound synthesised at ${rate()} Hz`; },
    get frames() { return frames; },
    get game() { return game; },
    get started() { return started; },
    destroy() { if (game) { try { game.stop(); } catch (_) {} } game = null; voices.length = 0; },
  };
  return core;
}
