/*
 * play/host/host.mjs -- THE ONE PLAY HOST (the Core API, section 4,
 * the build plan, Phase 1). Started 2026-10-14.
 *
 * One page for every console: play/host/index.html?sys=<id>#<game>. It owns the frame
 * loop, pause and holds, rewind, save slots, Continue, the cartridge's battery save,
 * input, the audio sink, screenshots and the Control Bar. A console is a core module
 * (play/cores/<id>/core.mjs, Core API 1.0) plus its art module; the host drives every
 * one through the same calls, and nothing else can run a core.
 *
 * WHAT IT BORROWS FROM THE SITE, UNCHANGED: the Control Bar (play/shared/control-bar.js:
 * this file implements its core contract ONCE, from the Core API), the on-screen
 * buttons (play/shared/overlay.js), the Back / help keys and the pause-menu hooks
 * (play/play-keys.js), and the audio engine that lives in the site's page
 * (play/host/cw-audio.js, section 3 of the build plan).
 *
 * SOUND: only through the Sink lent by CwPlayAudio, only while this window is open.
 */
import { manifestProblems, coreProblems, VirtualClock, CoreError } from './core-api.mjs';
import { Presenter } from './present.mjs?v=2.1.0';   // HOST MODULES: bump this tag (and present.mjs's own) when one changes
import { Input, keyLabel } from './input.mjs?v=2.1.0';
import * as S from './saves.mjs?v=2.1.0';
import * as E from './save-envelope.mjs?v=2.1.0';
import { Cheats } from './cheats.mjs?v=2.1.0';
import { API as CORE_API } from './core-api.mjs';

const BUILD = '20261014-host1';
const params = new URLSearchParams(location.search);
const SYS = params.get('sys') || 'gb';
const embedded = window.parent && window.parent !== window;
/* PREVIEW (2026-10-15, Phase 6): the tiles' and the drawer's live pictures, in this same host
   instead of the old play pages (?tile=1, ?demo=1). No sound (no sink is ever borrowed: the
   sound rule), no input, no bar, no saves written, the screen alone filling
   the frame (or, with &art=1, the device art: Tetris Jr.'s tile), the game's own attract mode.
   Options can be given for the picture alone as o.<id>=<value> (the Lynx turned on its side). */
const PREVIEW = new URLSearchParams(location.search).get('preview') === '1';
if (PREVIEW) document.documentElement.classList.add('cw-preview');
const $ = id => document.getElementById(id);

/* Each console: its module, its art, and (until the one cwNeed relay lands in the site)
   the relay its old page used, which the site already answers. */
const REGISTRY = {
  gb: {
    core: '../cores/gb/core.mjs', art: '../cores/gb/art.mjs?v=2.1.0',
    relay: { ask: 'gbNeedCart', answer: 'gbCart', game: g => 'gb-' + g, firmware: { dmg: 'bios', cgb: 'biosCgb' } },
    deviceId: g => 'gb-' + g, padSys: 'gb', slots: 20,
  },
  nes: {
    core: '../cores/nes/core.mjs', art: '../cores/nes/art.mjs',
    relay: { ask: 'nesNeedCart', answer: 'nesCart', game: g => 'nes-' + g, firmware: {} },
    deviceId: g => 'nes-' + g, padSys: 'nes', slots: 20,
  },
  /* P1 (Pokemon mini, Phase 2, 2026-10-14). */
  pm: {
    core: '../cores/pm/core.mjs', art: '../cores/pm/art.mjs',
    relay: null,                                   // the one relay only (play/host/site-relay.js 'pm')
    deviceId: g => g, padSys: 'pm', slots: 20,
  },
  /* Game & Watch (Phase 5, the G&W migration, 2026-10-14): the classic units. The game is
     the site's device id (silver-ball); the one relay answers with its program and melody. */
  gnw: {
    core: '../cores/gnw/core.mjs?v=2.1.0', art: '../cores/gnw/art.mjs?v=2.1.0',
    relay: null,
    deviceId: g => g, padSys: 'gnw', slots: 20,
  },
  /* H1 (Tetris Jr. and the colour units, Phase 5, 2026-10-14). Tetris Jr. is the one
     built-in game: no file is asked for (manifest.files.game.builtIn, H2). */
  tetrisjr: {
    core: '../cores/tetrisjr/core.mjs?v=2.1.0', art: '../cores/tetrisjr/art.mjs?v=2.1.0',
    relay: null, deviceId: g => g, padSys: 'tj', slots: 20,
  },
  /* The two colour units: the game is the unit ('mario' / 'zelda'); its external flash comes
     as the game and its internal flash as firmware '<unit>:internal', through the one relay. */
  tft: {
    core: '../cores/tft/core.mjs?v=2.1.0', art: '../cores/tft/art.mjs?v=2.1.0',
    relay: null, deviceId: g => ({ mario: 'reissue-super-mario-bros', zelda: 'reissue-zelda' })[g] || g, padSys: 'twin', slots: 20,
  },
};
/* The four Atari consoles: ONE shared module for all four (play/cores/atari/, Phase 3, the
   Atari migration). The old relay is the fallback for the game; firmware comes only
   through the one relay (site-relay.js SOURCES). */
function atariReg(sys) {
  return { core: `../cores/atari/core.mjs?sys=${sys}`, art: `../cores/atari/art.mjs?sys=${sys}`,
    relay: { ask: 'atariNeedCart', answer: 'atariCart', game: g => g }, deviceId: g => g, padSys: sys, slots: 20 };
}
for (const s of ['a2600', 'a5200', 'a7800', 'alynx']) REGISTRY[s] = atariReg(s);
/* CORE MODULE TAGS (2026-10-15): the one place a console's core and art modules get their cache
   tag, so a browser never keeps an old core. Bump a console's tag whenever a file in its
   play/cores/<id>/ folder changes (its own sub-imports, e.g. the colour units' compose.mjs,
   carry their own tags inside core.mjs). The Ataris share one module, so one tag. */
const CORE_V = {
  gb: '2.1.0-gbupdate', nes: '2.1.0-nesinstall', pm: '20261029-pm10-srcrev1', gnw: '20261101-gnw13-gwpad2',
  tetrisjr: '20261029-tj5-srcrev1', tft: '20261102-tft15-fix6a', atari: '20261101-atari35-biospref4',
};
const tagged = (p, v) => p + (p.includes('?') ? '&' : '?') + 'v=' + v;
for (const [s, r] of Object.entries(REGISTRY)) {
  const v = CORE_V[/^a(2600|5200|7800|lynx)$/.test(s) ? 'atari' : s];
  if (v) { r.core = tagged(r.core, v); if (r.art) r.art = tagged(r.art, v); }
}
const REG = REGISTRY[SYS];

/* ------------------------------------------------------------------ diagnostics */
const H = window.__cwHost = {
  BUILD, sys: SYS, embedded, state: 'booting', game: null, model: null, error: null,
  stats: { frames: 0, presented: 0, dropped: 0, rewindSteps: 0, rewindCaptures: 0, startScreens: 0, batteryWrites: 0, holds: {} },
  audio: null, source: {}, log: [],
};
/* A standing rule (2026-10-14): a log never carries a data payload. Every line, and
   every message shown, goes through clean(): an error's text can quote its input (a JSON parse
   error quotes the text it choked on, which for a game container is the game itself), so long
   runs that look like encoded data, and long quoted snippets, are cut out, and a line is capped. */
function clean(s) {
  return String(s == null ? '' : s)
    .replace(/"[^"]{40,}"/g, '"[data not shown]"')
    .replace(/[A-Za-z0-9+/=_-]{48,}/g, '[data not shown]')
    .replace(/(?:\b[0-9a-fA-F]{2}[ ,]){16,}/g, '[data not shown] ')
    .slice(0, 400);
}
function log(s) { s = clean(s); H.log.push(s); if (H.log.length > 300) H.log.shift(); console.log('[host]', s); }

/* ------------------------------------------------------------------ audio */
const WORKER_AUDIO_MS = +(params.get('wbuf') || 100);    // the worker core's audio queue (?wbuf= for an A/B)
function engine() {
  try { if (embedded && window.parent.CwPlayAudio) return { E: window.parent.CwPlayAudio, where: 'site' }; } catch (_) {}
  return { E: window.CwPlayAudio || null, where: 'frame' };
}
let sink = null, audioWhere = null;
let muted = false;
try { const m = localStorage.getItem('cw.play.muted'); muted = m == null ? localStorage.getItem('gb.muted') === '1' : m === '1'; } catch (_) {}
function takeSink(filtered) {
  if (sink) return sink;
  const { E, where } = engine();
  if (!E) { log('no audio engine in reach'); return null; }
  sink = E.lend({ owner: window, filtered, muted });
  audioWhere = where;
  H.audio = () => Object.assign({ where: audioWhere, build: E.BUILD, engine: E.stats }, sink ? sink.info() : {});
  log(`audio: ${where === 'site' ? "the site's context (started by the launching press)" : "this window's own context"}, state ${sink && sink.state()}`);
  return sink;
}
/* Before anything else: borrow the context the launching press woke. */
if (!PREVIEW) takeSink(false);

/* ------------------------------------------------------------------ the session */
let manifest = null, coreMod = null, artMod = null, core = null, result = null;
let presenter = null, input = null, clock = null;
let game = '', gameBytes = null, gameTitle = '', gameHash = null, firmware = {};
let cheats = null;   // play/host/cheats.mjs: this game's cheats (2026-10-26)
let model = null, ready = false, framesRun = 0, firstFrameAt = 0;
const holds = new Set();
let changeFns = [];
const optionValues = {};

function changed() { for (const f of changeFns) { try { f(); } catch (_) {} } }
function holding() { return holds.size > 0; }
function setHold(why, on) {
  const had = holding();
  if (on) holds.add(why); else holds.delete(why);
  H.stats.holds = Array.from(holds);
  const now = holding();
  if (sink) sink.hold(now);
  document.body.classList.toggle('paused', holds.has('player'));
  if (!had && now && why !== 'rewind' && input) input.suppress(core);
  if (!now) { lastT = 0; owed = 0; }
  changed();
}

/* ------------------------------------------------------------------ the loop */
let raf = 0, lastT = 0, owed = 0, capN = 0, capEvery = 9, lastTickAt = 0;
/* Fast-forward (decision P4): the loop runs `speed` times as many frames. At 2x the
   sound plays pitched up (each block is handed over as if recorded at twice the rate);
   above 2x it is silent. Rewind still captures by emulated time. */
const SPEEDS = [1, 2, 4];
let speed = 1;
let speedHudT = 0;
function setSpeed(x, why) {
  x = SPEEDS.includes(+x) ? +x : 1;
  if (x === speed) return;
  speed = x; owed = 0; lastT = 0;
  if (sink) { sink.clear(); sink.setMuted(muted || speed > 2); }
  H.speed = speed;
  log(`speed ${speed}x${why ? ' (' + why + ')' : ''}`);
  // The current speed, briefly, on the screen (a small pill like the rewind readout).
  const h = $('speedHud');
  if (h) {
    h.textContent = speed === 1 ? 'Normal speed' : speed > 2 ? `▶▶ ${speed}×  sound off` : `▶▶ ${speed}×`;
    h.classList.add('show');
    clearTimeout(speedHudT); speedHudT = setTimeout(() => h.classList.remove('show'), 1400);
  }
  changed();
}
/* THE LOOP (the Core API, section 4.3): frames are owed by the WALL CLOCK on a 4 ms
   tick, and the picture is painted on animation frames. rAF is not a clock: it follows the
   display, the compositor and throttling (measured 30 Hz in headless Chrome; the NES page
   recorded 29.9 Hz in a visible tab, which ran its machine at half speed). */
let dirtyPicture = false;
function tick() {
  const t = performance.now();
  lastTickAt = t;
  if (!ready || holding()) { lastT = t; return; }
  if (!lastT) { lastT = t; return; }
  const dt = Math.min(250, t - lastT); lastT = t;
  owed += dt * result.fps * speed / 1000;
  const cap = 4 * speed;
  let n = Math.floor(owed);
  if (n > cap) { H.stats.dropped += n - cap; n = cap; owed = 0; } else owed -= n;
  let ran = 0;
  // A busy worker runner (three frames in flight) defers the rest to the next tick rather than
  // losing them: the catch-up cap above still bounds how far behind it may fall (2026-10-15).
  for (let i = 0; i < n; i++) { if (runOne() === false) { owed += n - i; break; } ran++; }
  if (ran && !core.worker) dirtyPicture = true;       // a worker core marks the picture when its frame arrives
}
function paintLoop() {
  raf = requestAnimationFrame(paintLoop);
  /* A finger coming down makes the browser hold page timers for about 100 ms while it waits to see
     whether the touch is a scroll. Animation frames still run, so the loop's tick runs here when the
     timer is late; each lost tick was 3 to 4 frames of game and a gap in the sound (5 Nov 2026). */
  if (performance.now() - lastTickAt > 12) tick();
  if (dirtyPicture && ready) { dirtyPicture = false; present(); }
  for (const e of effects) { try { e.inst.frame && e.inst.frame(); } catch (_) {} }
  if (overlay && overlay.refreshLit) overlay.refreshLit();   // the console's own on-screen buttons light for any press
}
function runOne() {
  input.apply(core);
  if (devices.tilt) devices.tilt.frame();
  if (core.runFrame() === false) return false;        // the worker runner is still busy: not run
  if (devices.camera) devices.camera.frame();         // a fresh picture only when the core asked for one
  if (devices.mic) devices.mic.frame();
  if (devices.recorder) devices.recorder.frame();     // the Data Recorder's clock in the bar
  if (devices.rob) devices.rob.frame();               // R.O.B.'s LED and readout
  if (devices.mat) devices.mat.frame();               // the panel's chosen button (mahjong keypad)
  if (printer) printer.frame();                       // the paper the printer's head made this frame
  clock.advance(1);
  framesRun++; H.stats.frames++;
  const a = core.audio();
  if (a && a.frames && sink && speed <= 2) sink.push(a.data, a.frames, manifest.audio.channels, (result.audio.rate || sink.rate) * speed);
  if (++capN >= capEvery) { capN = 0; capture(); }
}
/* THE STATUS LINE (2026-10-14): what the old Game Boy page's footer said, for every
   console. Painted on its own timer, not rAF (a hidden tab freezes rAF). */
let fpsMark = { t: performance.now(), f: 0 };
function paintFooter() {
  const now = performance.now(), dt = (now - fpsMark.t) / 1000;
  if (dt >= 0.5) { $('fFps').textContent = ((framesRun - fpsMark.f) / dt).toFixed(1) + ' fps'; fpsMark = { t: now, f: framesRun }; }
  $('fMode').textContent = `host${rewinding ? ' · rewinding' : holds.has('player') ? ' · paused' : ''}`;
  $('fSpeed').textContent = speed === 1 ? 'normal speed' : `${speed}× speed`;
  const a = sink ? sink.info() : null;
  const fa = $('fAudio');
  if (!a) { fa.textContent = 'audio: none'; fa.className = 'chip silent'; }
  else {
    const live = a.state === 'running' && !a.muted && !a.held;
    fa.textContent = `audio: ${a.muted ? 'muted' : a.held ? 'held' : a.state} · ${a.transport || '…'} · ${a.queuedMs} ms · ${a.underruns} under · ${audioWhere === 'site' ? 'site context' : 'own context'}`;
    fa.className = 'chip ' + (live ? 'live' : 'silent');
  }
  $('fRing').textContent = `history ${(ringLen() * REW_CAPTURE_MS / 1000).toFixed(1)} s`;   // R1 (Tetris Jr.): the helper ring too (Ataris, colour units)
  $('fCarts').textContent = H.source.game === 'built in' ? 'game: built in' : H.source.game ? `cartridge: from ${H.source.game}` : 'cartridge: …';
  fitFooter();
  const L = $('hostLog');
  if (!L.hidden) {
    // The status itself first: on a small screen the status line is hidden, and this is where it is.
    const status = ['fMode', 'fSpeed', 'fAudio', 'fCarts', 'fFps', 'fRing'].map(id => $(id) ? $(id).textContent : '').filter(Boolean).join('  ·  ');
    const txt = 'STATUS  ' + status + '\n\n' + H.log.join('\n');
    if (L.textContent !== txt) { const end = L.scrollTop + L.clientHeight >= L.scrollHeight - 4; L.textContent = txt; if (end) L.scrollTop = L.scrollHeight; }
  }
}
/* Never cut text: when the line does not fit, the lowest-priority item is dropped whole. */
function fitFooter() {
  const f = $('hostFooter'); if (!f) return;
  const items = Array.from(f.children).sort((a, b) => (+a.dataset.pri) - (+b.dataset.pri));
  for (const el of items) el.removeAttribute('data-off');
  for (const el of items) { if (f.scrollWidth <= f.clientWidth + 1) break; if (+el.dataset.pri < 9) el.setAttribute('data-off', ''); }
}
setInterval(paintFooter, 250);
function toggleLog(force) {
  const L = $('hostLog'), on = force === true ? true : force === false ? false : L.hidden;
  L.hidden = !on; $('btnLog').setAttribute('aria-expanded', on ? 'true' : 'false');
  paintFooter();
}
$('btnLog').addEventListener('click', () => toggleLog());
// The log closes with Back like a panel would (play-keys asks the bar first; this is after it).
/* While paused, a key that is one of the console's own keys (a port of kind 'console': Power,
   Reset, Select, Game A, Time...) resumes the game first, in the capture phase, so the press
   itself then reaches the console (2026-10-15). The pad's and the bar's console keys do
   the same through consoleKey. */
addEventListener('keydown', e => {
  if (!ready || !holds.has('player') || holds.size !== 1 || e.repeat || e.ctrlKey || e.metaKey || e.altKey || !input || !result) return;
  const fs = input.keyMap.get(e.code); if (!fs) return;
  if (fs.some(f => { const p = result.ports[f[0]]; return p && p.kind === 'console'; })) setPaused(false);
}, true);

/* A press on the game (its screen, its art, its on-screen buttons) gives the keyboard back to the
   game: a bar item still holding focus would otherwise take Space and Enter as its own press
   (found by gate W, 2026-10-14: Micro Vs. fire on Space after closing the Keys panel). */
addEventListener('pointerdown', e => {
  const a = document.activeElement, t = e.target;
  if (!a || !a.closest || !a.closest('.cb-bar')) return;
  if (t && t.closest && (t.closest('.cb-bar') || t.closest('.cb-menu') || t.closest('.cb-panel'))) return;
  try { a.blur(); } catch (_) {}
}, true);
addEventListener('keydown', e => { if ((e.key === 'Escape' || e.key === 'Backspace') && !$('hostLog').hidden && !(window.ControlBar && window.ControlBar.state && (window.ControlBar.state.menu || window.ControlBar.state.panel))) { toggleLog(false); } }, true);

let artRotation = 0, artPlacing = false;   // the turn the device art was drawn for (placeArt)
function present() {
  const v = core.video();
  presenter.present(v);
  /* The picture turned (a Lynx's Screen turn, or a worker core's first frame after the load): the
     device art is drawn again for the new turn, so the game always sits in the photograph's screen. */
  if (v && presenter.art && !artPlacing && ((v.rotation || 0) !== artRotation)) { artPlacing = true; placeArt().catch(() => {}).finally(() => { artPlacing = false; }); }
  if (core.ext && core.ext.crosshair) presenter.crosshair(core.ext.crosshair());
  H.stats.presented = presenter.presented;
  if (!firstFrameAt) { firstFrameAt = performance.now(); setTimeout(checkSound, 300); }
}

/* ------------------------------------------------------------------ rewind
   One ring for every console: a state every 150 ms of emulated time, with a copy of
   the picture of that moment, stepped back every 60 ms while held (the Game Boy's
   figures). The machine is held for the whole rewind, so nothing plays forward
   between steps; scan bands and the REW readout show while it runs. */
const REW_CAPTURE_MS = 150, REW_STEP_MS = 60, REW_SECONDS = 15, REW_CAP_BYTES = 48 * 1024 * 1024;
const BIG_STATE = 512 * 1024;
let ring = [], ringMax = 100, rewinding = false, rewTimer = 0;
/* A core with multi-megabyte states names a ring of its own (manifest.rewindRing): the same
   cadence, its states delta-coded and deflated on a helper thread, stepped back asynchronously. */
let big = null;
const ringLen = () => (big ? big.length : ring.length);
function rewindReset() { ring = []; if (big) big.clear(); }
function capture() {
  if (rewinding || !manifest.state.supported) return;
  try {
    const st = core.serialize();
    if (!st) return;                                   // a worker core's first state is still on its way
    if (big) { big.push(st); H.stats.rewindCaptures++; return; }
    ring.push({ state: st instanceof Uint8Array ? st : new Uint8Array(st), frame: Presenter.copyFrame(core.video()), at: clock.now() });
    if (ring.length > ringMax) ring.shift();
    H.stats.rewindCaptures++;
  } catch (_) { /* a missed capture costs 150 ms of history */ }
}
function hud() { $('rewindHud').textContent = `◄◄ REW  ${(ringLen() * REW_CAPTURE_MS / 1000).toFixed(1)}s`; }
function bigStep() {
  if (big.busy || big.length < 2) return;
  big.step().then(st => {
    if (!st || !rewinding) return;
    try { core.unserialize(st); input.resync(); present(); H.stats.rewindSteps++; hud(); }
    catch (e) { log('rewind stopped: ' + e.message); stopRewind(); }
  });
}
function rewindStep() {
  if (big) return bigStep();
  if (ring.length < 2) return;
  ring.pop();
  const top = ring[ring.length - 1];
  try {
    core.unserialize(top.state);
    input.resync();
    if (top.frame) presenter.present(top.frame); else present();
    H.stats.rewindSteps++;
    hud();
  } catch (e) { log('rewind stopped: ' + e.message); stopRewind(); }
}
function startRewind() {
  if (rewinding || !ready || ringLen() < 2) return;
  rewinding = true;
  setHold('rewind', true);
  document.body.classList.add('rewinding');
  hud();
  rewindStep();
  rewTimer = setInterval(rewindStep, REW_STEP_MS);
  changed();
}
function stopRewind() {
  if (!rewinding) return;
  rewinding = false;
  clearInterval(rewTimer); rewTimer = 0;
  document.body.classList.remove('rewinding');
  setHold('rewind', false);
  capN = 0;
  // 2026-10-14: when a rewind ends the speed ALWAYS returns to Normal.
  if (speed !== 1) setSpeed(1, 'rewind ended');
}
addEventListener('pointerup', stopRewind);
addEventListener('pointercancel', stopRewind);
document.addEventListener('visibilitychange', () => { if (document.hidden) stopRewind(); setHold('hidden', document.hidden); });
/* THE WINDOW KEYS (2026-10-14), in the capture phase, for every console:
     Ctrl+Left   hold to rewind, at any speed (the old Game Boy page's shortcut, and the Ataris')
     Ctrl+Right  fast-forward: Normal, 2x, 4x, Normal
   While Ctrl is held no key reaches the game (a Ctrl chord is never game input), and a
   key-up is never stopped, so a release always reaches whoever saw the press. The Control
   Bar's own Ctrl shortcuts (P, S, L, [, ], /, M, Shift+F) run before this and stop there. */
let ctrlRewind = false;
addEventListener('keydown', e => {
  if (!e.ctrlKey || e.altKey || e.metaKey) return;
  if (e.code === 'ArrowLeft') {
    e.preventDefault(); e.stopImmediatePropagation();
    if (!e.repeat && !rewinding && ready) { ctrlRewind = true; startRewind(); }
    return;
  }
  if (e.code === 'ArrowRight') {
    e.preventDefault(); e.stopImmediatePropagation();
    if (!e.repeat && ready) setSpeed(SPEEDS[(SPEEDS.indexOf(speed) + 1) % SPEEDS.length], 'Ctrl+Right');
    return;
  }
  if (/^Control/.test(e.code)) return;
  e.stopImmediatePropagation();
}, true);
addEventListener('keyup', e => {
  if (ctrlRewind && (e.code === 'ArrowLeft' || e.key === 'Control')) { ctrlRewind = false; stopRewind(); }
}, true);
addEventListener('blur', () => { if (ctrlRewind) { ctrlRewind = false; stopRewind(); } });

/* The history in the shape continuerow.js keeps (equal-sized states, oldest first). */
function exportHistory() {
  if (big) return big.exportHistory();
  if (!ring.length) return null;
  const size = ring[ring.length - 1].state.length;
  const keep = ring.filter(r => r.state.length === size);
  const data = new Uint8Array(keep.length * size);
  keep.forEach((r, k) => data.set(r.state, k * size));
  /* The common save format's identity and checksum ride with the history (2026-10-18): its layout
     must stay n x size for the Continue row's packing, so the envelope's header goes in meta. */
  return { n: keep.length, size, data, meta: { api: '1.0', core: manifest.id, model, build: core.info && core.info.build, cadenceMs: REW_CAPTURE_MS,
    envelope: { v: E.ENVELOPE_VERSION, game: { sha256: gameHash || null, id: REG.deviceId(game) }, crc32: E.crc32(data) } } };
}
function importHistory(h, state) {
  if (big) return big.importHistory(h, state);
  if (!h || !h.data || !h.n) return 0;
  let list = null;
  const m = h.meta || {};
  if (m.api) {
    if (m.core !== manifest.id || m.model !== model || !sameBuild(m.build)) return 0;
    if (m.envelope) {
      if (E.judge({ core: { id: m.core }, game: m.envelope.game }, hereId())) { log('rewind history: another game, not used'); return 0; }
      if (E.crc32(h.data) !== m.envelope.crc32) { log('rewind history: damaged, not used'); return 0; }
    }
    list = [];
    for (let i = 0; i < h.n; i++) list.push(h.data.slice(i * h.size, (i + 1) * h.size));
  } else if (core.legacyHistory) list = core.legacyHistory(h);
  if (!list || !list.length) return 0;
  rewindReset();
  for (const st of list.slice(-(ringMax - 1))) ring.push({ state: st, frame: null });
  ring.push({ state, frame: Presenter.copyFrame(core.video()) });
  return ring.length;
}

/* ------------------------------------------------------------------ battery */
let batteryKeys = {}, batteryTimer = 0, batteryBusy = false, batteryLatest = {};
let preloaded = new Set();
async function batteryLoad() {
  batteryKeys = {};
  for (const b of result.battery || []) {
    const keys = sealBattery(S.batteryKeys(manifest, game, gameBytes, b.id, gameHash));
    batteryKeys[b.id] = keys;
    if (preloaded.has(b.id)) continue;
    const got = await S.batteryLoad(manifest, keys).catch(() => null);
    if (got && got.refused) { log(`battery save not used: ${got.refused.message}`); toast(got.refused.message); continue; }
    if (got && got.bytes.length === b.bytes && core.battery.write(b.id, got.bytes)) { log(`battery save restored (${got.bytes.length} bytes, from the ${got.from})`); H.source.battery = got.from; }
    else log(got ? `battery save stored for this game does not fit (${got.bytes.length} of ${b.bytes} bytes); not used` : 'battery save: nothing stored yet');
  }
}
async function batteryFlush(why) {
  if (PREVIEW || !core || !core.battery || batteryBusy) return false;
  const ids = core.battery.dirty();
  if (!ids.length) return false;
  batteryBusy = true;
  try {
    for (const id of ids) {
      const keys = batteryKeys[id]; if (!keys) continue;
      const b = core.battery.read(id); if (!b) continue;
      batteryLatest[id] = b;
      await S.batterySave(manifest, keys, b);
      core.battery.clean(id);
      H.stats.batteryWrites++;
    }
    return true;
  } catch (e) { log('battery save not written: ' + e.message); return false; }
  finally { batteryBusy = false; }
}
function batteryUrgent() {
  if (!core || !core.battery) return;
  for (const id of core.battery.dirty()) { const keys = batteryKeys[id], b = core.battery.read(id); if (keys && b && b.length <= 65536) S.batteryJournal(manifest, keys, b); }   // a 1 MiB flash is too big for the quick journal; the 1 s save covers it
  batteryFlush('hidden');
}
document.addEventListener('visibilitychange', () => { if (document.hidden) batteryUrgent(); });
addEventListener('pagehide', batteryUrgent);

/* ------------------------------------------------------------------ files from the site */
/* THE ONE RELAY (play/host/site-relay.js in the site): { cwNeed, sys, id } -> { cwFile, b64,
   source }. Used whenever the site has it for this console; the console's old relay
   (REG.relay) is the fallback while an older site page is open. */
let relayN = 0;
function siteRelay() { try { const R = embedded && window.parent.CwSiteRelay; return R && R.systems().includes(SYS) ? R : null; } catch (_) { return null; } }
function askFile(kind, id, ms = 90000, extra = null) {
  if (siteRelay()) {
    return new Promise(resolve => {
      const n = ++relayN; let done = false;
      const finish = (v, src) => { if (done) return; done = true; removeEventListener('message', onMsg); resolve(v ? { bytes: v, source: src } : null); };
      const onMsg = ev => {
        if (ev.source !== window.parent) return;
        const d = ev.data; if (!d || d.cwFile !== n) return;
        if (!d.b64) return finish(null);
        try { const s = atob(d.b64), u = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i); finish(u, d.source || 'site'); } catch (_) { finish(null); }
      };
      addEventListener('message', onMsg);
      try { window.parent.postMessage(Object.assign({ cwNeed: kind, sys: SYS, id, n }, extra || {}), '*'); } catch (_) { finish(null); }
      setTimeout(() => finish(null), ms);
    });
  }
  if (extra && extra.pick) return Promise.resolve(null);      // a chosen boot program comes only through the one relay
  if (!REG.relay) return Promise.resolve(null);
  const what = kind === 'game' ? REG.relay.game(id) : (REG.relay.firmware || {})[id];
  return what ? askSite(what, ms).then(b => (b ? { bytes: b, source: 'site (old relay)' } : null)) : Promise.resolve(null);
}
/* An art file the site resolves for this console (relay cwNeed 'art'): text, or null. The art
   module gets it as describe(ctx).artFile and never reaches into the site itself. */
function askArt(path, ms = 30000) {
  if (!siteRelay()) return Promise.resolve(null);
  return new Promise(resolve => {
    const n = ++relayN; let done = false;
    const finish = v => { if (done) return; done = true; removeEventListener('message', onMsg); resolve(v); };
    const onMsg = ev => { if (ev.source !== window.parent) return; const d = ev.data; if (d && d.cwFile === n) finish(typeof d.text === 'string' ? d.text : null); };
    addEventListener('message', onMsg);
    try { window.parent.postMessage({ cwNeed: 'art', sys: SYS, id: path, n }, '*'); } catch (_) { finish(null); }
    setTimeout(() => finish(null), ms);
  });
}
function askSite(what, ms = 90000) {
  if (!embedded || !REG.relay) return Promise.resolve(null);
  const R = REG.relay;
  return new Promise(resolve => {
    let done = false;
    const finish = v => { if (done) return; done = true; removeEventListener('message', onMsg); resolve(v); };
    const onMsg = ev => {
      if (ev.source !== window.parent) return;
      const d = ev.data;
      if (!d || d[R.answer] !== what) return;
      if (!d.b64) return finish(null);
      try { const s = atob(d.b64), u = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i); finish(u); } catch (_) { finish(null); }
    };
    addEventListener('message', onMsg);
    try { window.parent.postMessage({ [R.ask]: what }, '*'); } catch (_) { finish(null); }
    setTimeout(() => finish(null), ms);
  });
}
async function unsupported(bytes) {
  try { return window.CWSUnsupported && bytes ? await window.CWSUnsupported.check(bytes) : null; } catch (_) { return null; }
}
/* For firmware, an entry listed as a cartridge does not count (2026-10-23): the 5200 list holds
   the console's BIOS as a cartridge, to keep a copy in a games folder off the game shelf. */
async function unsupportedFw(bytes) { const e = await unsupported(bytes); return e && e.kind !== 'cartridge' ? e : null; }
/* Boot programs, chosen by identity upstream (the site, its game server): the site is
   asked on every load and its answer replaces any cached copy; a program the person
   picked themselves is theirs and is kept (play/gameboy/app.js, 2026-10-14). */
/* THE BOOT PROGRAM CHOICE (2026-10-19; the unified UI leftover "a firmware picker for any
   console"). Settings, Boot program: for each program this game uses, Automatic (the rule above:
   the site, then the game server's own choice by hash), any program the joined game servers hold
   for it (site-relay.js 'firmware-choices', fetched by its hash and checked against it), a file
   from this device, and None where the console starts without one (our own start-up). The choice
   is kept per console on this device (localStorage cw.fw.<console>|<id>: 'auto', 'none', 'user',
   'sha:<sha256>'); none stored = Automatic, with a file the person chose on an old page kept, as
   before. A file from this device is kept apart (firmware '<id>:yours'), so the site's copy never
   writes over it. A chosen program that is not reachable falls back to Automatic and says so. */
/* A slot that says perGame (the Supercharger's tape, 2026-10-22: the tape is the game)
   keeps its choice and its file from this device per game, by the game file's hash. */
const fwPer = id => { const f = (manifest.files.firmware || []).find(s => s.id === id); return f && f.perGame && gameHash ? id + '@' + gameHash.slice(0, 12) : id; };
const fwKey = id => `cw.fw.${manifest.id}|${fwPer(id)}`;
/* The choice in force: the viewer's, else the slot's own default ('' is automatic); a slot that
   follows another (the Supercharger's firmware follows its tape) is fetched only when that one
   is not 'none'. */
function fwChoiceOf(f) {
  if (f.follows) { const t = (manifest.files.firmware || []).find(s => s.id === f.follows); return t && fwChoiceOf(t) === 'none' ? 'none' : 'auto'; }
  return fwChoice(f.id) || f.defaultChoice || '';
}
function fwChoice(id) { try { return localStorage.getItem(fwKey(id)) || ''; } catch (_) { return ''; } }
function fwSetChoice(id, v) { try { if (v) localStorage.setItem(fwKey(id), v); else localStorage.removeItem(fwKey(id)); } catch (_) {} }
const fwSlots = () => (manifest.files.firmware || []).filter(f => !/:internal$/.test(f.id));   // a colour unit's own flash is not a boot program (its custom firmware is parked, 2026-10-15)
let fwChoices = {};
/* FW1 (2026-10-22: "the client should request either generic or specific firmware
   as it needs it"). A firmware ask is 'generic' (the normal file for the slot; a core may say this
   game needs another role, e.g. the PAL 7800 BIOS, manifest.firmwareRole) or 'specific' (pick: one
   file by its hash, chosen in Settings). The server's list was kept when the site connected; the
   file itself is asked for only now. A file kept for another role is never used for this one. */
const fwRole = (id, bytes) => { try { return manifest.firmwareRole ? String(manifest.firmwareRole(bytes || gameBytes, id) || '') : ''; } catch (_) { return ''; } };
const fwCacheId = (id, role) => (role && role !== 'boot' ? id + '@' + role : id);
function askFwChoices(id, ms = 8000) {
  if (!siteRelay()) return Promise.resolve([]);
  return new Promise(resolve => {
    const n = ++relayN; let done = false;
    const finish = v => { if (done) return; done = true; removeEventListener('message', onMsg); resolve(Array.isArray(v) ? v : []); };
    const onMsg = ev => { if (ev.source !== window.parent) return; const d = ev.data; if (d && d.cwFile === n) finish(d.list); };
    addEventListener('message', onMsg);
    try { window.parent.postMessage({ cwNeed: 'firmware-choices', sys: SYS, id, n, game, role: fwRole(id) }, '*'); } catch (_) { finish([]); }   // game: for a perGame slot; role: FW1
    setTimeout(() => finish([]), ms);
  });
}
async function loadFwChoices() {
  const want = manifest.firmwareFor && gameBytes ? new Set(manifest.firmwareFor(gameBytes)) : null;
  const next = {};
  for (const f of fwSlots()) if (!want || want.has(f.id)) next[f.id] = await askFwChoices(f.id).catch(() => []);
  fwChoices = next;
  refreshSettings();
}
let fwNote = null;
async function loadFirmware(bytes) {
  const out = {};
  fwNote = null;
  const want = manifest.firmwareFor ? new Set(manifest.firmwareFor(bytes)) : null;
  for (const f of (manifest.files.firmware || [])) {
    if (want && !want.has(f.id)) continue;            // a cartridge never asks for the disk drive's firmware
    const choice = fwChoiceOf(f), role = fwRole(f.id, bytes);
    if (choice === 'none' && f.required === 'never') { H.source['firmware:' + f.id] = 'none, your choice'; log(`${f.label}: none, by your choice`); continue; }
    if (choice === 'user') {
      const mine = await S.firmwareCached(manifest, fwPer(f.id) + ':yours').catch(() => null);
      if (mine && mine.bytes) { out[f.id] = mine.bytes; H.source['firmware:' + f.id] = 'yours, from this device'; log(`${f.label}: your file from this device`); continue; }
    }
    if (/^sha:[0-9a-f]{64}$/.test(choice)) {
      const sha = choice.slice(4);
      const r = await askFile('firmware', f.id, 90000, { pick: sha, want: 'specific' });
      if (r && r.bytes && (await digest(r.bytes)) === sha && !(await unsupportedFw(r.bytes))) {
        out[f.id] = r.bytes; H.source['firmware:' + f.id] = 'your choice, ' + r.source;
        log(`${f.label}: your choice (${sha.slice(0, 12)}), from ${r.source}`); continue;
      }
      log(`${f.label}: your choice (${sha.slice(0, 12)}) is not reachable now; the automatic one is used`);
      fwNote = `The ${f.label} you chose is not reachable now, so the usual one is used.`;
      toast(fwNote);
    }
    const cached = f.perGame ? null : await S.firmwareCached(manifest, fwCacheId(f.id, role)).catch(() => null);   // a perGame file is never another game's
    if (cached && cached.from === 'user' && choice !== 'auto') { out[f.id] = cached.bytes; H.source['firmware:' + f.id] = 'yours'; continue; }
    const r = await askFile('firmware', f.id, 90000, Object.assign({ want: 'generic' }, role ? { role } : {}, f.perGame ? { game } : {}));
    const got = r && r.bytes;
    if (got) {
      const bad = await unsupportedFw(got);
      if (bad) { log(`the site's ${f.label} is on the not-supported list; not used`); continue; }
      out[f.id] = got; H.source['firmware:' + f.id] = r.source;
      if (!f.perGame) S.firmwareKeep(manifest, fwCacheId(f.id, role), got, 'site');
    } else if (cached && !(choice === 'auto' && cached.from === 'user')) { out[f.id] = cached.bytes; H.source['firmware:' + f.id] = cached.legacy ? 'old page cache' : 'cache'; }
  }
  return out;
}
/* The Boot program rows of Settings: one select per program this game uses. */
function firmwareRows() {
  const rows = [];
  if (!gameBytes) return rows;
  const want = manifest.firmwareFor ? new Set(manifest.firmwareFor(gameBytes)) : null;
  for (const f of fwSlots()) {
    if (want && !want.has(f.id)) continue;
    if (f.cassette) continue;                         // the Cassettes row (cassetteRows) has these
    const r = document.createElement('div'); r.className = 'cb-row';
    const id = 'fw-' + f.id;
    r.innerHTML = `<label class="cb-lab" for="${id}"></label>`;
    r.querySelector('label').textContent = f.label;
    const sel = document.createElement('select'); sel.id = id;
    const add = (v, label) => { const o = document.createElement('option'); o.value = v; o.textContent = label; sel.appendChild(o); };
    const src = H.source['firmware:' + f.id];
    const choice = fwChoice(f.id), list = fwChoices[f.id] || [];
    add('auto', 'Automatic' + (src && !/your choice|from this device|^none/.test(src) ? ` (${src === 'yours' ? 'your file' : src})` : ''));
    for (const c of list) add('sha:' + c.sha256, c.name + (c.roleName && list.some(x => x.roleName && x.roleName !== c.roleName) ? ` (${c.roleName})` : '') + (c.auto ? ', the game server’s usual one' : ''));   // FW1: role names when the list mixes roles
    if (choice === 'user') add('user', 'Your file from this device');
    if (f.required === 'never') add('none', 'None (start without it)');
    add('file', 'Choose a file from this device…');
    sel.lastChild.dataset.padSkip = '1';
    sel.value = choice === 'none' && f.required === 'never' ? 'none' : choice === 'user' ? 'user' : (/^sha:/.test(choice) && list.some(c => 'sha:' + c.sha256 === choice)) ? choice : 'auto';
    const was = sel.value;
    sel.addEventListener('change', async () => {
      const v = sel.value;
      if (v === 'file') { sel.value = was; return pickFirmware(f); }
      fwSetChoice(f.id, v);
      await rebootFirmware(f);
    });
    r.appendChild(sel);
    rows.push(r);
  }
  return rows;
}
/* THE CASSETTES ROW (2026-10-22: one cassette shelf any system pulls from,
   offered automatically for the game that needs it). It replaces one Boot program row per tape
   (the Kid Vid's seven) with one row: the tapes come from the cassette shelf on the game
   servers (play/host/site-relay.js kidVidTape: the shelf first, then the older bios folder),
   or none, or one tape at a time from a file on this device. A slot says cassette: true. */
function cassetteRows() {
  if (!gameBytes) return [];
  const want = manifest.firmwareFor ? new Set(manifest.firmwareFor(gameBytes)) : null;
  const slots = fwSlots().filter(f => f.cassette && (!want || want.has(f.id)));
  if (!slots.length) return [];
  const r = document.createElement('div'); r.className = 'cb-row';
  r.innerHTML = '<label class="cb-lab" for="fw-cassettes"></label>';
  /* 2026-10-22: a slot may follow another (fetched with it, not a tape of its own), name
     the row's words (rowLabels), start off (defaultChoice) and be matched to the game (perGame: the
     shelf is offered only when it holds this game's tape, fwChoices from the relay). */
  const tapes = slots.filter(f => !f.follows);
  const L = (slots.find(f => f.rowLabels) || {}).rowLabels || {};
  const inNow = tapes.filter(f => { const s = H.source['firmware:' + f.id]; return s && !/^none/.test(s); }).length;
  r.querySelector('label').textContent = L.title || `Tapes (${inNow} of ${tapes.length} in)`;
  const sel = document.createElement('select'); sel.id = 'fw-cassettes';
  const add = (v, label, skip) => { const o = document.createElement('option'); o.value = v; o.textContent = label; if (skip) o.dataset.padSkip = '1'; sel.appendChild(o); };
  const onShelf = tapes.every(f => !f.perGame || (fwChoices[f.id] || []).length > 0);
  const mine = !!L.user && tapes.some(f => fwChoice(f.id) === 'user');
  if (L.none) add('none', L.none);
  if (onShelf) add('auto', L.auto || 'Automatic (the cassette shelf)');
  if (!L.none) add('none', 'None (play without the tapes)');
  if (mine) add('user', L.user);
  for (const f of tapes) add('file:' + f.id, L.file || `Choose ${f.label} from this device…`, true);
  sel.value = tapes.every(f => fwChoiceOf(f) === 'none') ? 'none' : mine ? 'user' : onShelf ? 'auto' : 'none';
  const was = sel.value;
  sel.addEventListener('change', async () => {
    const v = sel.value;
    if (v.startsWith('file:')) { sel.value = was; const f = slots.find(s => 'file:' + s.id === v); return f && pickFirmware(f); }
    for (const f of slots) fwSetChoice(f.id, v);
    await rebootFirmware({ label: 'Tapes', id: slots[0].id });
  });
  r.appendChild(sel);
  return [r];
}
function pickFirmware(f) {
  const inp = document.createElement('input'); inp.type = 'file';
  inp.addEventListener('change', async () => {
    const file = inp.files && inp.files[0]; if (!file) return;
    let bytes = null; try { bytes = new Uint8Array(await file.arrayBuffer()); } catch (_) { toast('That file could not be read.'); return; }
    if (f.bytes && bytes.length !== f.bytes) { toast(`A ${f.label} is ${f.bytes.toLocaleString('en-AU')} bytes; that file is ${bytes.length.toLocaleString('en-AU')} bytes, so it was not used.`); return; }
    const bad = await unsupportedFw(bytes);
    if (bad) { toast('That boot program is on the not-supported list, so it was not used.'); return; }
    await S.firmwareKeep(manifest, fwPer(f.id) + ':yours', bytes, 'user');
    fwSetChoice(f.id, 'user');
    log(`${f.label}: a file from this device is kept on this device (${bytes.length} bytes)`);
    await rebootFirmware(f);
  });
  inp.click();
}
async function rebootFirmware(f) {
  if (!gameBytes) return;
  await batteryFlush('firmware');
  firmware = await loadFirmware(gameBytes);
  await mount();
  toast(fwNote || `${f.label}: ${H.source['firmware:' + f.id] || 'none'}. The game started again.`);
  refreshSettings();
}

/* ------------------------------------------------------------------ messages on the stage */
function say(title, body, opts = {}) {
  const m = $('msg');
  $('msgTitle').textContent = title; $('msgBody').textContent = clean(body || '');   // rule 19
  $('msgOpen').hidden = !opts.open;
  paintRecent();
  m.hidden = false;
  if ($('bootLoader')) $('bootLoader').hidden = true;      // a message is the answer: no loader behind it
}
function unsay() { $('msg').hidden = true; }

/* ------------------------------------------------------------------ boot */
async function boot() {
  if (!REG) { say('This console is not on the new player yet.', `"${SYS}" has no core module here.`); return; }
  try {
    coreMod = await import(REG.core);
    artMod = REG.art ? await import(REG.art).catch(() => null) : null;
  } catch (e) { say('The player could not start.', e.message); log('module load failed: ' + e.message); return; }
  manifest = coreMod.manifest;
  const mp = manifestProblems(manifest);
  if (mp.length) { say('This console module is not valid.', mp.join('; ')); return; }
  document.body.dataset.form = manifest.form;
  if (sink) sink.filtered = !!manifest.audio.filtered;
  clock = new VirtualClock();
  const env = {
    now: () => clock.now(),
    emit: (ev, data) => onCoreEvent(ev, data),
    log: (lv, m) => log(`core ${lv}: ${m}`),
    preview: PREVIEW,
    audioRate: () => (sink ? sink.rateHint() : 48000),
  };
  /* WHERE THE CORE RUNS (Core API 4.2, 2026-10-14): a manifest that says thread 'worker' runs in
     the worker runner (play/host/runner-worker.mjs), off this page's main thread; ?thread=main
     keeps it here (a comparison, or a browser without module workers). */
  let threadAsk = params.get('thread');
  if (!threadAsk && embedded) { try { threadAsk = new URLSearchParams(window.parent.location.search).get('thread'); } catch (_) { threadAsk = null; } }   // ?thread=main on the site's URL too (an A/B)
  // 'worker' runs there unless ?thread=main; 'either' runs here unless ?thread=worker (an A/B).
  const wantWorker = typeof Worker === 'function' && ((manifest.thread === 'worker' && threadAsk !== 'main') || threadAsk === 'worker')   /* ?thread=worker: any core (the Core API's cores are page-free), for an A/B */;
  if (wantWorker) {
    try {
      const { createWorkerCore } = await import('./runner-worker.mjs?v=2.1.0');
      core = await createWorkerCore(new URL(REG.core, import.meta.url).href, env, { channels: manifest.audio.channels || 1 });
      core.onFrame = () => { dirtyPicture = true; };
      /* R4 audio (2026-10-15): the worker's sound goes to the sink as it arrives, into a deeper
         queue (the sink's setBuffer), since a worker's frames arrive less evenly than the page's. */
      core.onAudio = (data, frames) => {
        if (!sink || speed > 2 || rewinding || holding()) return;
        sink.push(data, frames, manifest.audio.channels, ((result && result.audio && result.audio.rate) || sink.rate) * speed);
      };
      /* The core may declare its own queue (manifest.audio.latencyMs); ?wbuf= still wins for an A/B.
         (2 Nov 2026: the adaptive queue of 29 Oct / 1 Nov is gone; every console has the one
         standard queue.) */
      if (sink && typeof sink.setBuffer === 'function') {
        const want = params.get('wbuf') ? WORKER_AUDIO_MS : ((manifest.audio && manifest.audio.latencyMs) || WORKER_AUDIO_MS);
        log(`audio queue ${sink.setBuffer(want)} ms (worker core)`);
      }
      H.thread = 'worker';
      log('the core runs on a worker thread');
    } catch (e) { core = null; log('worker runner not available, main thread: ' + e.message); }
  }
  if (!core) {
    try { core = await coreMod.create(env); H.thread = 'main'; } catch (e) { say('The player could not start.', e.message); return; }
  }
  const cp = coreProblems(core, manifest);
  if (cp.length) { say('This console module is not valid.', cp.join('; ')); return; }
  ringMax = Math.max(10, Math.min(Math.round(REW_SECONDS * 1000 / REW_CAPTURE_MS), Math.floor(REW_CAP_BYTES / Math.max(1, manifest.state.approxBytes))));
  /* REWIND IS THE HOST'S, for every console (the three-part rule, 2026-10-14). Big states
     (half a megabyte or more: the Ataris' 0.6 to 2.8 MB) go to the shared helper ring,
     play/host/rewind-ring.mjs (XOR delta + deflate on a worker, first written for the Atari core);
     the host decides from the manifest's state size, never the core. */
  if (manifest.state.supported && manifest.state.approxBytes >= BIG_STATE) {
    try { const R = (await import('./rewind-ring.mjs?v=2.1.0')).Ring; big = new R({ max: Math.round(REW_SECONDS * 1000 / REW_CAPTURE_MS), capBytes: REW_CAP_BYTES, approxBytes: manifest.state.approxBytes }); }
    catch (e) { big = null; log('rewind helper not available, raw states: ' + e.message); }
  }

  presenter = new Presenter({ box: $('screenBox'), wrap: $('lcdWrap'), img: $('art'), canvas: $('screen'), scan: $('rewindScan') });
  presenter.onArtView = () => syncOverlayArt();
  // The on-screen strip's room at the foot of the stage (an Atari's switches), for arts fitted clear of it.
  presenter.footRoom = () => {
    const s = document.querySelector('.cwov-strip');
    if (!s || s.hidden || presenter.full || !s.getClientRects().length) return 0;
    const r = s.getBoundingClientRect(), st = $('stage').getBoundingClientRect();
    return r.height ? Math.max(0, st.bottom - r.top) + 6 : 0;
  };
  /* TV AT THE TOP (2026-10-22): televisions sit at the top of the play window, and the room
     the messages need at the bottom (a toast above any switch strip) is kept clear of them. */
  presenter.tvTop = !PREVIEW;
  presenter.msgRoom = () => {
    if (presenter.full) return 0;
    const ov = parseFloat(getComputedStyle($('stage')).getPropertyValue('--cw-ov-bottom')) || 0;
    return Math.ceil(16 + ov + 34 + 6);     // the toast's bottom offset (control-bar.js .cb-toast), its height, a gap
  };
  input = new Input({ sys: REG.padSys || SYS, onMenu: back, onHelp: help, log });
  if (PREVIEW) input.enabled = false; else installPad();
  input.onNote = msg => toast(msg);         // the Family BASIC keyboard's Scroll Lock: typing or the controller
  setInterval(tick, 4);
  raf = requestAnimationFrame(paintLoop);
  H.state = 'idle';
  applyHash();
  addEventListener('hashchange', applyHash);
}

function applyHash() {
  const g = decodeURIComponent((location.hash || '').replace(/^#/, ''));
  if (!g) { if (!embedded) say('No game chosen.', 'Open this player from a game on the site, or choose a cartridge file on this machine. Nothing is uploaded.', { open: true }); return; }
  start(g);
}

async function start(g, bytesIn) {
  const pickName = localPick; localPick = null;     // a file opened on this device: kept once it is known good
  ready = false; setHold('loading', true);
  document.body.classList.add('cw-booting');      // hidden until the device is ready to show whole
  if ($('bootLoader')) $('bootLoader').hidden = false;
  stopRewind(); rewindReset();
  if (core && model) { await batteryFlush('switch'); }
  game = g; H.game = g; firstFrameAt = 0; framesRun = 0;
  gameTitle = titleOf(g);
  unsay();
  let bytes = bytesIn || null;
  // H2: a built-in game (Tetris Jr.) has no file to ask for, check or hash beyond nothing.
  const builtIn = !!(manifest.files.game && manifest.files.game.builtIn);
  if (builtIn && !bytes) { bytes = new Uint8Array(0); H.source.game = 'built in'; }
  if (!bytes) { const r = await askFile('game', g); bytes = r ? r.bytes : null; H.source.game = r ? r.source : null; }
  if (!bytes) {
    if (embedded) say('This cartridge isn’t on this machine.', `Nothing here holds “${gameTitle}”: not the content pack, not the built-in collection and not a linked game server. Open a content pack that has it in Settings, Content, then try again, or choose the cartridge file on this device. Nothing is uploaded.`, { open: true });
    else say('No cartridge for this game.', 'Choose the cartridge file on this machine. Nothing is uploaded.', { open: true });
    return;
  }
  const bad = builtIn ? null : await unsupported(bytes);
  if (bad) {
    say('Not supported yet', window.CWSUnsupported.message(bad));
    if (!PREVIEW) { try { window.CWSUnsupported.refuse(bad, { closeHost: embedded }); } catch (_) {} }   // a preview just stays dark
    return;
  }
  gameBytes = bytes;
  gameHash = await digest(bytes);
  H.sha256 = builtIn ? null : gameHash;      // the site's record of play (continuerow.js); a built-in game has no file
  rememberPick(bytes, pickName);
  firmware = await loadFirmware(bytes);
  await mount();
  if (!PREVIEW) loadFwChoices();
}

async function mount() {
  // Option values: the site's stored choices (existing keys kept), else the defaults.
  const opts = {};
  const defs0 = core.options ? core.options() : [];
  for (const d of defs0) opts[d.id] = readOption(d);
  Object.assign(optionValues, opts);
  try {
    // Battery regions the core needs before power-on (a Disk System disk's own save).
    const pre = {};
    preloaded = new Set();
    for (const id of (manifest.preloadBatteryFor ? manifest.preloadBatteryFor(gameBytes) : [])) {
      const got = await S.batteryLoad(manifest, sealBattery(S.batteryKeys(manifest, game, gameBytes, id, gameHash))).catch(() => null);
      if (got && got.refused) log(`${id} save not used: ${got.refused.message}`);
      else if (got) { pre[id] = got.bytes; preloaded.add(id); H.source.battery = got.from; log(`${id} save put in place before power-on (${got.bytes.length} bytes, from the ${got.from})`); }
    }
    /* A game on several disks (NES, Disk System): its other disks, asked for by hash
       through the one relay and checked by hash; one not found leaves the game to start alone. */
    const companions = {};
    for (const c of (manifest.companionsFor ? manifest.companionsFor(gameBytes) : [])) {
      const got = await askFile('game', c.id).catch(() => null);
      if (got && got.bytes && (await digest(got.bytes)) === c.sha256) companions[c.sha256] = got.bytes;
      else log(`the other disk ${c.id} was not found; starting with the disks there are`);
    }
    const req = { game: { bytes: gameBytes, name: game, sha256: gameHash }, firmware, options: Object.assign({}, opts),
      battery: pre, companions, system: params.get('console') || undefined, lynx: lynxLists() };
    result = core.loadAsync ? await core.loadAsync(req) : core.load(req);
  } catch (e) {
    const err = e instanceof CoreError || (e && e.code) ? e : new CoreError('damaged', String(e && e.message || e));
    H.error = err.code + ': ' + err.message;
    say(err.code === 'needs-firmware' ? 'This game needs a boot program.' : 'This game could not start.', err.message);
    log('load refused: ' + H.error);
    return;
  }
  model = result.model || 'default'; H.model = model;
  /* Options the core can only name once the cartridge is in (the NES Controller choice, the Data
     Recorder's keyboard): their stored choice is put in now, before the first frame. Before this
     (found 2026-10-18) such a choice was stored but never read back after a reload. */
  for (const d of (result.options || [])) {
    if (Object.prototype.hasOwnProperty.call(opts, d.id) || !d.live || !core.setOption) continue;
    const v = readOption(d); optionValues[d.id] = v;
    if (v === d.default) continue;
    let how = 'unknown'; try { how = core.setOptionAsync ? await core.setOptionAsync(d.id, v) : core.setOption(d.id, v); } catch (_) {}
    log(`option ${d.id} = ${v} (stored, ${how})`);
    if (how === 'ports' && core.ports) result.ports = core.ports();
  }
  clock.fps = result.fps;
  capEvery = Math.max(1, Math.round(REW_CAPTURE_MS * result.fps / 1000));
  input.setPorts(result.ports);
  bindPointer();
  presenter.configure(result.video);
  await batteryLoad();
  await placeArt();
  present();
  await setupDevices();                     // before the bar is built: its Tilt, Camera and Microphone items come from these
  if (!barReady && !PREVIEW) await registerBar();
  if (!PREVIEW) startCheats();
  refreshSettings();
  await reveal();                           // the device appears whole; only then does the core run
  ready = true;
  H.state = 'running';
  input.latchOut();                          // the press that launched the game does nothing in it
  if (params.get('cont') === '1' && !resumeDone) {
    // P3: a Continue card's relaunch (&cont=1) is held until its save is in, so no frame of a
    // fresh boot shows first (every console; found on the Pokemon mini, 2026-10-14).
    resumeDone = true;
    setHold('resume', true);
    clearTimeout(resumeTimer); resumeTimer = setTimeout(() => setHold('resume', false), 6000);
  }
  setHold('loading', false);
  if (sink && sink.state() !== 'running') sink.resume();   // the reference path: sticky activation
  continueReady = game;
  clearInterval(batteryTimer); if (!PREVIEW) batteryTimer = setInterval(() => batteryFlush('poll'), 1000);   // a preview never writes a save
  log(`mounted ${game} on ${manifest.modelLabel ? manifest.modelLabel(model) : model} (${H.source.game || 'file'})`);
  // The static facts, once, in the log (2026-10-14: off the one-line status bar).
  try { if (core.details) log(core.details()); } catch (_) {}
  if (result.note) setTimeout(() => toast(result.note), 600);
  noticeOnce(result.notice);
}

/* SEAMLESS START (2026-10-15): the artwork decoded (img.decode, with a safety timeout so a
   slow or missing picture never holds the game), the layout at its final size, one painted frame
   behind it, then the device is shown. A hidden tab has no animation frames: a timer stands in. */
const nextPaint = () => new Promise(r => { let done = false; const go = () => { if (!done) { done = true; r(); } }; requestAnimationFrame(() => requestAnimationFrame(go)); setTimeout(go, 80); });
/* THE ONE WINDOW RULE (2026-10-15), the same for every console: the play window takes the
   device's own shape at the frame's height (the art's band, or the screen alone), and is never
   narrower than the whole Control Bar needs; the site caps it to the screen. The art is then
   fitted and centred inside by the presenter, the bar sits at the window's top centre. The
   window's height is the site's one rule (min(90vh, 700px)); only its width follows the device. */
function windowWidthWanted() {
  const box = $('screenBox'), cs = getComputedStyle(box);
  const bh = box.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
  const g = presenter.art;
  let artW;
  if (g && g.crop) artW = bh * (g.crop.w * g.ar) / g.crop.h;
  else if (g) artW = bh * g.ar / (g.h * (1 + g.band.above + g.band.below));
  else artW = bh * (presenter.w * (presenter.pixelAspect || 1)) / presenter.h + 28;
  /* R.O.B. beside the game (22 Oct: it "cuts off the TV on a PC"): the device has only
     the screen box's share of the width (58%, rob-panel.mjs), so the window asks for the whole of it. */
  if (document.body.classList.contains('has-rob') && box.parentElement && getComputedStyle(box.parentElement).flexDirection === 'row') {
    const share = box.getBoundingClientRect().width / Math.max(1, box.parentElement.getBoundingClientRect().width);
    if (share > 0.2 && share < 0.95) artW = artW / share;
  }
  const barMin = window.ControlBar && typeof window.ControlBar.minWidth === 'function' ? window.ControlBar.minWidth() : 0;
  // 920: past the small-screen line (900), so a desktop window always has its status line.
  return Math.ceil(Math.max(artW, barMin, 920));
}
let sizedFor = 0;
async function sizeWindow() {
  if (!embedded || PREVIEW || !presenter) return;
  const w = windowWidthWanted();
  if (!w || Math.abs(w - sizedFor) < 2) return;
  sizedFor = w;
  try { window.parent.postMessage({ cwHostSize: { width: w } }, '*'); } catch (_) { return; }
  await new Promise(r => setTimeout(r, 60));          // the site resizes the frame; this page then lays out again
}
async function reveal() {
  await sizeWindow();
  const img = $('art');
  if (img && img.getAttribute('src')) {
    const dec = typeof img.decode === 'function' ? img.decode().catch(() => {}) : Promise.resolve();
    await Promise.race([dec, new Promise(r => setTimeout(r, 1500))]);
  }
  presenter.layout();
  present();
  await nextPaint();
  document.body.classList.remove('cw-booting');
  H.revealedAt = performance.now();
}

/* A cartridge's peripherals (play/host/peripherals.mjs, 2026-10-15): only those the core declared
   for this cartridge (result.extensions.tilt / .camera) and gave calls for (core.ext). */
const devices = {};
H.devices = devices;
/* THE GAME BOY PRINTER (2026-10-21): not a bar menu like the devices above but a window
   of its own, the Control Bar's Print panel. Shown from the start for a title on the printer list
   (play/cores/gb/printer-titles.mjs), and for any other game once it talks to the printer; the
   window opens by itself when a page starts printing. */
let printer = null;
let printOpenTimer = 0;   // the 2-second wait before the Print window opens
H.printer = () => printer;
async function setupDevices() {
  for (const k of Object.keys(devices)) { try { devices[k].destroy(); } catch (_) {} delete devices[k]; }
  if (printer) { try { printer.destroy(); } catch (_) {} printer = null; }
  const ex = (result && result.extensions) || {};
  if (ex.printer && core.ext && core.ext.printer && !PREVIEW) {
    const P = await import('./peripherals.mjs?v=2.1.0');
    let listed = false;
    try { const T = await import('../cores/gb/printer-titles.mjs?v=2.1.0'); listed = !!(gameHash && T.PRINTER_TITLES.has(gameHash.slice(0, 16))); } catch (_) {}
    printer = new P.Printer({ core: () => core, listed, log, onShow: () => changed(),
      /* 2026-10-22: the window opens 2 seconds after a print is detected, not at once.
         The paper still collects meanwhile; Back before then (a thrown-away print) keeps it shut. */
      onPage: () => {
        const me = printer; clearTimeout(printOpenTimer);
        printOpenTimer = setTimeout(() => { try { const B = window.ControlBar; if (printer === me && !me.hush && (me.active || me.rows) && B && B.active && !B.state.panel && !B.state.menu) B.open('print'); } catch (_) {} }, 2000);
      } });
    if (listed) log('printer: this title can print; the Print item is in the bar');
  }
  /* R.O.B. (2026-10-21): beside the game, always (play/host/rob-panel.mjs). */
  if (ex.rob && core.ext && core.ext.rob && !PREVIEW) {
    const R = await import('./rob-panel.mjs?v=2.1.0');
    devices.rob = new R.RobPanel({ core: () => core, kind: ex.rob, stage: $('stage'), layout: () => presenter.layout(), log, toast });   // toast: the Test note (25 Oct)
    log(`r.o.b.: plugged in (${ex.rob === 'gyro' ? 'Gyromite: gyro trays on controller two' : 'Stack-Up'}); he watches the screen for commands`);
  }
  const matPort = result && result.ports ? result.ports.find(p => p.device === 'mat' || p.panel) : null;   // any accessory with a button panel
  trackballBound = null;
  if (core.ext && core.ext.trackball && !PREVIEW) bindTrackball(core.ext.trackball);
  if (!(ex.tilt || ex.camera || ex.microphone || ex.tape || ex.recorder || ex.barcode || matPort)) return;
  const P = await import('./peripherals.mjs?v=2.1.0');
  const x = core.ext || {};
  if (ex.tilt && x.tilt) { devices.tilt = new P.Tilt({ core: () => core, screen: $('screen'), log }); log('tilt sensor: keys I J K L, the right stick, or drag on the screen'); }
  if (ex.camera && x.camera) {
    // Off at the start; the bar's crossed-out Camera item says so (2026-10-15: no hint text).
    devices.camera = new P.Camera({ core: () => core, log, toast, changed: () => { try { if (window.ControlBar && window.ControlBar.sync) window.ControlBar.sync(); } catch (_) {} } }); log('camera: the cartridge has one; off until chosen in the bar');
  }
  // The console's microphone control ('voice', a console-port hold), worked by the real microphone
  // when the player turns it on; off at the start (a crossed-out item, like Mute and Camera).
  // The Power Pad / Family Trainer: its twelve pads on the screen (the old NES page's touch panel).
  if (matPort) devices.mat = new P.MatPanel({ input, port: matPort, stage: $('stage'), log, cursor: () => (core && core.ext && core.ext.panelCursor ? core.ext.panelCursor() : -1) });
  // The Study Box's tape deck (the old NES page's Tape control).
  if (ex.tape && x.tape) {
    devices.tape = new P.Tape({ core: () => core, log, toast, sys: manifest.id, changed });
    // A tape chosen with the Open picker (or dropped) before the cartridge was in goes in now.
    if (pendingTape && !PREVIEW) { const f = pendingTape; pendingTape = null; devices.tape.addFile(f); }
  }
  // The Famicom Data Recorder (2026-10-18): Family BASIC and the games that save to tape.
  if (ex.recorder && x.recorder && !PREVIEW) {
    devices.recorder = new P.DataRecorder({ core: () => core, log, toast, shelf: tapeShelf(), changed, title: () => gameTitle,
      plug: async on => { const d = optDef('keyboard'); if (d) await setOption(d, !!on); } });
    log('data recorder: this title uses it; its menu is in the bar');
  }
  // The Datach barcode reader: swipe a card from the bar.
  if (ex.barcode && x.barcode && !PREVIEW) { devices.barcode = new P.Barcode({ core: () => core, log, toast, changed }); log('barcode reader: a Datach cartridge; its menu is in the bar'); }
  if (ex.microphone) { devices.mic = new P.Microphone({ press: on => input.consoleKey('voice', on), log, toast }); log('microphone: the console has one; off until chosen in the bar (or hold M)'); }
  // A title known to use it (index.html NesConsole.usesMicrophone, the old page's ?mic=1) asks for it at once.
  if (devices.mic && !PREVIEW) { let uses = false; try { const N = window.parent.NesConsole; uses = !!(N && N.usesMicrophone && N.usesMicrophone(gameTitle)); } catch (_) {} if (uses) { log('microphone: this title uses it, asking for it'); devices.mic.start(); } }
}
const DEVICE_ITEMS = { tilt: { icon: 'tilt', label: 'Tilt' }, camera: { icon: 'camera', label: 'Camera off' }, mic: { icon: 'mic', label: 'Microphone off' }, mat: { icon: 'mat', label: 'Power Pad' }, tape: { icon: 'tape', label: 'No tape' }, recorder: { icon: 'tape', label: 'Data Recorder' }, rob: { icon: 'keys', label: 'R.O.B.' }, barcode: { icon: 'keys', label: 'Barcode reader' } };
/* TAPES KEPT ON THIS DEVICE (the Data Recorder, 2026-10-18), in the common save format: each
   tape is an envelope of kind 'tape' (payload: the 8-bit PCM; extra: name, rate) in cw-play's battery
   store under '<console>|~tape|<id>', and the list is an envelope of kind 'tape-shelf' (payload:
   UTF-8 JSON [{ id, name, seconds, ts }]) under '<console>|~tapes'. A tape is the console's, not one
   game's (a Family BASIC V3 tape loads in V2.1A), so it is read back with its checksums verified
   but not judged against the game. Users' files stay on this device. */
function tapeShelf() {
  const idx = () => `${manifest.id}|~tapes`, key = id => `${manifest.id}|~tape|${id}`;
  const list = async () => {
    const v = await S.get('battery', idx()); if (!v || !E.isEnvelope(v)) return [];
    try { const { header, payload } = E.open(v); if (header.kind !== 'tape-shelf') return []; const l = JSON.parse(new TextDecoder().decode(payload)); return Array.isArray(l) ? l : []; } catch (_) { return []; }
  };
  const putList = l => S.put('battery', idx(), seal('tape-shelf', new TextEncoder().encode(JSON.stringify(l)), null, null, null));
  return {
    list,
    async put(name, pcm, rate) {
      const id = Date.now().toString(36) + Math.floor(Math.random() * 1296).toString(36);
      await S.put('battery', key(id), seal('tape', pcm, null, { name, rate }));
      const l = await list(); l.unshift({ id, name, seconds: pcm.length / rate, ts: Date.now() }); await putList(l);
      return id;
    },
    async get(id) {
      const v = await S.get('battery', key(id));
      const { header, payload } = E.open(v);
      if (header.kind !== 'tape' || !header.extra || !(header.extra.rate > 0)) throw new E.SaveError('damaged');
      if (header.core && header.core.id && header.core.id !== manifest.id) throw new E.SaveError('other-console');
      return { pcm: payload, rate: header.extra.rate, name: header.extra.name || '' };
    },
    async del(id) { await S.del('battery', key(id)); await putList((await list()).filter(t => t.id !== id)); },
  };
}

/* Where an option is kept: its existing key if it has one (gb.palette), else per console,
   or per game for scope 'game' (an NES title's controller, a VS. cabinet's DIP switches). */
const optKey = d => d.key ? d.key.replace('{hash12}', (gameHash || 'unknown').slice(0, 12)).replace('{game}', game) : (d.scope === 'game' ? `cw.opt.${manifest.id}.${game}.${d.id}` : `cw.opt.${manifest.id}.${d.id}`);
/* A port list that changes while playing (the player plugged another controller). */
function portsChanged() {
  if (!core.ports) return;
  result.ports = core.ports();
  input.setPorts(result.ports);
  input.latchOut();
  bindPointer();
  paintKeys();
  log('controllers now: ' + result.ports.map(p => p.label || p.device).join(', '));
  changed();
}
/* The Atari 5200 Trak-ball (play/atari5200/app.js wireTrakball, retired 2026-10-15). With a
   mouse, a DOUBLE click on the picture locks the pointer and player one's controller becomes
   the trak-ball (left button lower fire, right button upper fire); Escape gives it back. A
   double click so the first click, which only starts the sound, never captures the mouse.
   Nothing is offered without a fine pointer (a desktop Chrome can read as a TV). */
let trackballBound = null;
function bindTrackball(tb) {
  let fine = false; try { fine = matchMedia('(pointer: fine)').matches; } catch (_) {}
  trackballBound = tb;
  if (!fine || bindTrackball.done) return;
  bindTrackball.done = true;
  const box = $('screenBox');
  const locked = () => document.pointerLockElement === box;
  box.addEventListener('dblclick', () => {
    if (!trackballBound || locked() || !box.requestPointerLock) return;
    try { const r = box.requestPointerLock(); if (r && r.catch) r.catch(() => {}); } catch (_) {}
  });
  document.addEventListener('pointerlockchange', () => {
    const on = locked();
    if (trackballBound) trackballBound.lock(on);
    log('trak-ball: ' + (on ? 'on' : 'off'));
    if (on) toast('Trak-ball: the mouse is player 1\u2019s controller. Escape gives it back.');
  });
  document.addEventListener('mousemove', e => { if (locked() && trackballBound) trackballBound.move(e.movementX, e.movementY); });
  const bit = e => (e.button === 0 ? 1 : e.button === 2 ? 2 : 0);
  document.addEventListener('mousedown', e => { if (locked() && trackballBound) trackballBound.button(bit(e), true); });
  document.addEventListener('mouseup', e => { if (trackballBound) trackballBound.button(bit(e), false); });
  box.addEventListener('contextmenu', e => { if (locked()) e.preventDefault(); });
}
/* Pointer devices (a light gun, a paddle): the picture's own pointer events, mapped to
   0..1 of the picture. No hover needed: a press aims and fires (a desktop Chrome can read as a TV). */
let pointerBound = false;
function bindPointer() {
  const pi = input.pointerPort();
  document.body.classList.toggle('host-pointer', pi >= 0);
  if (pi < 0 || pointerBound) return;
  pointerBound = true;
  const cv = $('screen'), box = $('screenBox');
  const send = (e, buttons) => {
    const q = input.pointerPort(); if (q < 0) return;
    const pt = presenter.pointOf(e.clientX, e.clientY);
    input.pointer(q, { x: pt.x, y: pt.y, inside: pt.inside, buttons });
  };
  box.addEventListener('pointerdown', e => { if (input.pointerPort() < 0) return; e.preventDefault(); try { box.setPointerCapture(e.pointerId); } catch (_) {} send(e, 1); });
  box.addEventListener('pointermove', e => { if (input.pointerPort() < 0) return; if (e.pointerType === 'mouse' || e.buttons) send(e, e.buttons ? 1 : 0); });
  const up = e => { if (input.pointerPort() >= 0) send(e, 0); };
  box.addEventListener('pointerup', up); box.addEventListener('pointercancel', up);
  box.addEventListener('contextmenu', e => { if (input.pointerPort() >= 0) e.preventDefault(); });
  void cv;
}
function consoleKeysOf() {
  const out = [];
  for (const p of (result ? result.ports : [])) if (p.kind === 'console') for (const c of p.controls)
    if (c.type === 'button' || c.type === 'hold') out.push({ id: c.id, label: c.label, short: c.short, icon: c.icon || (/coin/.test(c.id) ? 'switch' : 'keys'), key: c.defaults && c.defaults.key && c.defaults.key[0] ? keyLabel(c.defaults.key[0]) : undefined });
  return out;
}
const optDef = id => (core && core.options ? core.options() : []).find(d => d.id === id);
function readOption(d) {
  /* A choice stored under another option's value moves to this one, once (the Game Boy's old
     "Game Boy Color" skin is now its Machine choice). */
  if (d.movedFrom) { try { if (localStorage.getItem(d.movedFrom.key) === d.movedFrom.value) { localStorage.setItem(optKey(d), d.movedFrom.to); localStorage.removeItem(d.movedFrom.key); } } catch (_) {} }
  let v = null;
  if (PREVIEW && params.has('o.' + d.id)) v = params.get('o.' + d.id);   // the picture's own options, never stored
  else
  try { v = localStorage.getItem(optKey(d)); } catch (_) {}
  if (v == null || v === '') return d.default;
  if (d.type === 'enum' && d.values && !d.values.some(x => x.v === v)) return d.default;
  return d.type === 'bool' ? v === '1' : d.type === 'range' ? +v : v;
}
function writeOption(d, v) {
  try { localStorage.setItem(optKey(d), d.type === 'bool' ? (v ? '1' : '0') : String(v)); } catch (_) {}
}

/* DISPLAY EFFECTS of the artwork (Game Boy Matrix Mode, Pokemon mini rumble): each declares
   its options; the host draws the Settings rows, stores the values and tells the effect. */
let effects = [], effectsFor = null;
/* An artwork's display options, by id, for its describe() (an option marked redescribe
   changes the art itself: the G&W Table Top close-up, 2026-10-14). */
function artOptions() {
  const o = {};
  for (const def of (artMod && artMod.effects) || []) for (const d of def.options || []) o[d.id] = readOption(d);
  return o;
}
const attachEffect = def => {
  const e = { def, inst: def.attach({ presenter, core: () => core, live: () => !!(ready && !holding()) }) };
  for (const d of def.options || []) { d.__effect = e.inst; try { e.inst.setOption && e.inst.setOption(d.id, readOption(d)); } catch (_) {} }
  return e;
};
async function placeArt() {
  if (!artMod || (PREVIEW && params.get('art') !== '1')) { await presenter.setArt(null); if (PREVIEW) presenter.setFull(true); return; }
  /* A worker core has no frame until its first one arrives: the load result's picture says the turn
     then (2026-10-24: a turned Lynx wore the upright photograph). */
  let rotation = 0; try { const v = core.video() || (result && result.video); rotation = (v && v.rotation) || 0; } catch (_) {}
  artRotation = rotation;
  const desc = await artMod.describe({ model, game, title: gameTitle, params, rotation, options: artOptions(), artFile: askArt }).catch(() => null);
  await presenter.setArt(desc);
  if (!effects.length && artMod.effects) {
    effects = artMod.effects.map(attachEffect);
    presenter.onLayout = () => { for (const e of effects) { try { e.inst.sync && e.inst.sync(); } catch (_) {} } };
  } else if (effectsFor !== null && effectsFor !== model + '|' + game) {
    // Another game in the same window: an effect drawn for one game (perGame: the G&W
    // unit's buttons) is taken down and drawn again for this one.
    effects = effects.map(e => {
      if (!e.def.perGame) return e;
      try { e.inst.detach && e.inst.detach(); } catch (_) {}
      return attachEffect(e.def);
    });
  }
  effectsFor = model + '|' + game;
  presenter.layout();
}

function onCoreEvent(ev, data) {
  if (ev === 'error') { H.error = data && data.message; say('The game stopped.', H.error || ''); setHold('error', true); }
  else if (ev === 'options') refreshSettings();
  else if (ev === 'media') changed();
  else if (ev === 'video' && result) presenter.configure(core.video());
  else if (ev === 'option' && data) { const d = optDef(data.id); if (d) setOption(d, data.v); }
  else if (ev === 'jam') { H.jam = data && data.message; log('core: ' + H.jam); }
}

async function digest(bytes) {
  // firmware/site/sha.js: crypto.subtle where it exists, its own SHA-256 over plain HTTP (the TV).
  try {
    const h = window.cwsDigest ? await window.cwsDigest('SHA-256', bytes) : await crypto.subtle.digest('SHA-256', bytes);
    return Array.from(new Uint8Array(h), b => b.toString(16).padStart(2, '0')).join('');
  } catch (_) { return null; }
}
function titleOf(g) {
  try { const B = window.parent.CwUnifiedHost; const d = B && B.deviceInfo && B.deviceInfo(REG.deviceId(g)); if (d && d.name) return d.name; } catch (_) {}
  return g;
}

/* ------------------------------------------------------------------ sound start check
   The launching press woke the site's context (cw-audio.js). If, 300 ms after the
   first frame, it is still not running, the browser genuinely refused: show the one
   shared start screen, count it, and let the next press anywhere start sound. */
function checkSound() {
  if (!sink || muted) return;
  if (sink.state() === 'running') { H.soundAtFirstFrame = true; return; }
  H.soundAtFirstFrame = false;
  const el = $('startScreen');
  $('startLabel').textContent = manifest.form === 'console' ? 'Plug in Console' : 'Insert Batteries';
  el.hidden = false;
  H.stats.startScreens++;
  try {
    const k = 'cw.host.startscreen', o = JSON.parse(localStorage.getItem(k) || '{"n":0}');
    o.n = (o.n | 0) + 1; o.last = { sys: SYS, game, at: new Date().toISOString(), where: audioWhere, state: sink.state() };
    localStorage.setItem(k, JSON.stringify(o));
  } catch (_) {}
  log('start screen shown: the browser kept the sound off after the launch');
  setHold('startscreen', true);
}
/* A CONTROLLER IS NEVER STUCK ON THE START SCREEN (found 2026-10-17). A pad press is not a
   user activation, so it cannot start the sound, and the screen answered only real presses: a
   controller player could neither play nor reach the menu. Now, while it is up, a pad's Home or B
   takes it down and opens the menu (as Back does in a game), and any other pad button takes it down
   and the game runs silent; the sound then starts on the next real tap, click or key (soundPending),
   by the same path as before. The buttons that took it down do nothing in the game until let go. */
let soundPending = false, ssPrev = new Set(), ssHeld = new Set();
function startScreenPad(players) {
  const held = new Set([].concat(...(players || []).map(p => p || [])));
  const fresh = Array.from(held).filter(n => !ssPrev.has(n));
  ssPrev = held;
  if (!fresh.length) return;
  const el = $('startScreen');
  el.hidden = true; soundPending = true; ssHeld = held; ssPrev = new Set();
  setHold('startscreen', false);
  log('start screen: taken down by the controller; sound waits for a tap, click or key');
  if (fresh.includes('Home') || fresh.includes('B') || (held.has('Select') && held.has('Start'))) { back(); return; }
  toast('Sound starts with your next tap or key press.');
}
/* The pad's buttons, less those still held from taking the start screen down. */
function padPlayers(players) {
  if (!ssHeld.size) return players;
  const all = new Set([].concat(...(players || []).map(p => p || [])));
  for (const n of Array.from(ssHeld)) if (!all.has(n)) ssHeld.delete(n);
  return (players || []).map(p => (p || []).filter(n => !ssHeld.has(n)));
}
function startScreenPress(e) {
  const el = $('startScreen');
  if (!e.isTrusted || !sink) return;
  if (el.hidden && !soundPending) return;
  soundPending = false;
  sink.resume();
  setTimeout(() => {
    if (sink.state() !== 'running' && audioWhere === 'site' && window.CwPlayAudio) {
      // The site's context still refused this press: this window's own, inside it.
      try { sink.release(); } catch (_) {}
      sink = null; audioWhere = null;
      const s = window.CwPlayAudio.lend({ owner: window, filtered: manifest.audio.filtered, muted });
      window.CwPlayAudio.wake(true);
      sink = s; audioWhere = 'frame';
    }
  }, 150);
  el.hidden = true;
  setHold('startscreen', false);
}
for (const t of ['pointerup', 'touchend', 'click', 'keydown']) addEventListener(t, startScreenPress, true);

/* ------------------------------------------------------------------ Back, help, the pad */
function back() {
  try { const B = window.ControlBar; if (B && B.active && B.back()) return; } catch (_) {}
  if (embedded) { try { window.parent.postMessage({ gnwBack: 1, key: 'GamepadHome' }, '*'); } catch (_) {} }
}
function help() { try { if (window.gnwPlayKeys && window.gnwPlayKeys.help) window.gnwPlayKeys.help(); } catch (_) {} }
function sitePad() { try { return embedded ? window.parent.gnwPlayPad || null : null; } catch (_) { return null; } }
/* The site's Lynx turn list (play/atarilynx/turned.js, loaded by the site page), handed to the core
   with the game: a core on a worker thread cannot reach the page that holds it, and turned only the
   two titles of its own fallback (2026-10-24). */
function lynxLists() {
  if (SYS !== 'alynx') return undefined;
  let w = null; try { w = window.LYNX_TURNED ? window : embedded && window.parent.LYNX_TURNED ? window.parent : null; } catch (_) { w = null; }
  return w ? { turned: Object.assign({}, w.LYNX_TURNED), wrong: Object.assign({}, w.LYNX_HEADER_WRONG || {}) } : undefined;
}
let homePrev = false;   // the Guide button held at the last feed (2026-10-29: the Guide while paused)
/* SWAP A/B, THE CONTROL BAR'S BUTTON (7 Nov 2026). A controller's A and B, and X and Y, change places
   in the GAME ONLY: applied here, as the last thing before the game's pad path, so the names are
   already the printed letters (gamepad.js, with the layout and Reverse buttons, comes first and is
   never changed by this), and the bar, its menus and panels, the start screen and the whole site, which
   read the buttons earlier or elsewhere, keep the controller's normal layout. It works by button name,
   before the console's pad table: a table with the viewer's changes stays as saved, and the two named
   buttons trade what the table gives them. Keys and touch never come through here. Remembered in this
   browser, the same for every game and console. */
const PAD_SWAP_STORE = 'cw.pad.swap.v1', PAD_SWAP = { A: 'B', B: 'A', X: 'Y', Y: 'X' };
let padSwap = false, padSeen = false;
try { padSwap = localStorage.getItem(PAD_SWAP_STORE) === '1'; } catch (_) {}
function setPadSwap(on) {
  padSwap = !!on;
  try { if (padSwap) localStorage.setItem(PAD_SWAP_STORE, '1'); else localStorage.removeItem(PAD_SWAP_STORE); } catch (_) {}
}
const padSwapped = players => padSwap ? (players || []).map(p => (p || []).map(n => PAD_SWAP[n] || n)) : players;
/* Would it change anything here? Not where A and B, and X and Y, reach one control (the 2600's Fire, the Game & Watch's Action). */
function padSwapDoes() {
  let m = null; try { const M = window.gnwPlayPad && window.gnwPlayPad.mapsFor(REG.padSys || SYS); m = M && M[0]; } catch (_) { m = null; }
  if (!m || !input) return false;
  const to = n => { const f = m[n] && input.fnMap.get(m[n]); return f ? f[0] + ':' + f[1] : ''; };
  return to('A') !== to('B') || to('X') !== to('Y');
}
function installPad() {
  const own = () => {
    // Without the site's table: each control's first pad button.
    const m = {};
    for (const p of (result ? result.ports : [])) for (const c of p.controls) for (const b of ((c.defaults && c.defaults.pad) || [])) if (!m[b]) m[b] = c.defaults.key[0];
    return [m];
  };
  window.gnwPlayPad = {
    BUILD: 'host-' + BUILD,
    get MAPS() { const P = sitePad(); return P ? P.MAPS : null; },
    feed(players, ctx) {
      if (!padSeen) { padSeen = true; try { if (window.ControlBar && window.ControlBar.sync) window.ControlBar.sync(); } catch (_) {} }   // shows Swap A/B on a touch screen once a controller is in use
      /* SELECT+START IS THE GUIDE BUTTON, WHEREVER THE FOCUS IS (2026-10-17, reported: "I cannot seem to
         press Start + Select to get the Guide menu up when I am on the Control bar, but I can when I
         am in game play ... The Guide button seems to work everywhere"). The chord was read only by
         the game's own pad path, which the bar's focus bypasses. Now it is turned into Home before
         any routing, for the bar, its menus and panels, the start screen and the game alike, and
         Select and Start do nothing more until both are let go. */
      players = chordAsHome(players);
      if (ctx && ctx.uiPlayers) ctx = Object.assign({}, ctx, { uiPlayers: chordAsHome(ctx.uiPlayers, true) });
      startChords(players);
      shoulders(players, own);
      players = startFilter(players);
      if (ctx && ctx.uiPlayers) ctx = Object.assign({}, ctx, { uiPlayers: startFilter(ctx.uiPlayers) });
      // The Control Bar, its menus (the Variant menu and its submenus, "Show 50 more") and its
      // panels are driven by the pad when they have the focus: D-pad moves, A selects, B goes
      // back (2026-10-14). ctx.uiPlayers names the buttons as the site's menus do.
      // A held bar item let go while the focus moved off the bar still ends (Rewind stops).
      if (padHoldEl && ![].concat(...((ctx && ctx.uiPlayers) || players || []).map(p => p || [])).includes('A')) padHoldEnd();
      const trig = barTrigger((ctx && ctx.uiPlayers) || players, own);
      overlayStick((ctx && ctx.uiPlayers) || players, own);
      if (uiFocused()) { input.releasePad(); navFeed((ctx && ctx.uiPlayers) || players); uiWas = true; return null; }
      navPrev = new Set();
      if (trig && focusBarBy(trig)) { input.releasePad(); navPrev = new Set([].concat(...((ctx && ctx.uiPlayers) || players || []).map(p => p || []))); uiWas = true; return null; }
      /* Back from the bar to the game (B, a trigger's Back): what is still held (the B that closed it)
         stays out of the game until it is let go, as play-pad.js does for its screens. */
      if (uiWas) { uiWas = false; uiBlock = (players || []).map(p => new Set(p || [])); }
      if (uiBlock) {
        let any = false;
        players = (players || []).map((p, i) => { const b = uiBlock[i]; if (!b) return p; for (const n of Array.from(b)) if (!(p || []).includes(n)) b.delete(n); if (b.size) any = true; return (p || []).filter(n => !b.has(n)); });
        if (!any) uiBlock = null;
      }
      if (!$('startScreen').hidden) { input.releasePad(); startScreenPad((ctx && ctx.uiPlayers) || players); return null; }
      // The left stick is the console's D-pad only on consoles without a stick (play-pad.js stickAsDpad, 2026-10-17).
      // A game with an analogue device (Atari paddles or driving controller: ports that read the pad's
      // axes) keeps the stick for that device; it is then no player's D-pad.
      { const P = sitePad(), sys = REG.padSys || SYS, analogue = !!(result && result.ports.some(p => Array.isArray(p.axes)));
        try { players = P && P.stickAsDpad ? P.stickAsDpad(analogue ? 'a5200' : sys, players)
          : players.map(p => (p || []).map(n => ({ LSUp: 'Up', LSDown: 'Down', LSLeft: 'Left', LSRight: 'Right' })[n] || n)); } catch (_) {} }
      players = padPlayers(players);
      /* THE GUIDE BUTTON WHILE PAUSED (2026-10-29, reported: "The Guide button doesn't bring up the
         emulator menu in game when the game is paused. It works when not paused, and when the
         control bar has focus"). While the game is held (the bar's Pause, a panel, the start of a
         rewind) every press was dropped here before input.padFeed, which is where Home (and
         Select+Start, already turned into Home above) asks for the menu. Its press edge is read
         here first, so the Guide menu opens in every state; the game still gets nothing. */
      { const home = (players || []).some(p => (p || []).includes('Home'));
        const fresh = home && !homePrev; homePrev = home;
        if (!ready || holding()) { input.releasePad(); if (fresh) { back(); return 'menu'; } return null; } }
      const P = sitePad();
      let maps = null; try { maps = P && P.mapsFor ? P.mapsFor(REG.padSys || SYS) : null; } catch (_) { maps = null; }
      return input.padFeed(padSwapped(players), maps || own());
    },
    release() { input.releasePad(); },
    players() { return result ? result.ports.filter(p => p.kind === 'player').length : 1; },
    table(s) { const P = sitePad(); try { return P && P.table ? P.table(s || REG.padSys || SYS) : null; } catch (_) { return null; } },
    mapsFor(s) { const P = sitePad(); try { return P && P.mapsFor ? P.mapsFor(s) : own(); } catch (_) { return own(); } },
    info() { return { build: BUILD, system: SYS, host: true, stats: input.stats }; },
  };
}

/* ------------------------------------------------------------------ the bar by pad, and back to the Guide menu */
/* TRIGGERS TO THE CONTROL BAR (2026-10-18, requested: "Can we make the triggers on a controller set the
   focus to the controller bar in game ... Then the user can move around with the triggers or the
   d-pad"). LT or RT pressed (gamepad.js reads standard buttons 6 / 7 as held past half way; this is
   the press edge) moves the focus onto the bar: the item last used there, else the first item (RT)
   or the last (LT). While the bar has it, uiFocused() routes the pad to navFeed: LT / RT step left /
   right along the bar (wrapping), the D-pad moves, A presses, B goes back to the game, Home is the
   Guide menu; the game gets nothing (input.releasePad).
   CONFLICTS: a trigger the console's pad table uses (play-pad.js MAPS with the viewer's remaps from
   Settings, else the core's own defaults) stays the game's: the colour units' LT is Pause, Pokemon
   mini's RT is Shake, so there the other trigger goes to the bar. Once on the bar both triggers
   step, since the game gets nothing then. */
let trigPrev = new Set(), uiWas = false, uiBlock = null, barLast = null;
function barTrigger(list, own) {
  const held = new Set([].concat(...(list || []).map(p => p || [])));
  const fresh = ['LT', 'RT'].filter(n => held.has(n) && !trigPrev.has(n));
  trigPrev = new Set(['LT', 'RT'].filter(n => held.has(n)));
  if (!fresh.length) return null;
  try { const B = window.ControlBar; if (!B || !B.active) return null; } catch (_) { return null; }
  let m = null;
  try { const P = sitePad(), maps = P && P.mapsFor ? P.mapsFor(REG.padSys || SYS) : null; m = maps && maps[0] ? maps[0] : null; } catch (_) { m = null; }
  if (!m && own) { try { m = own()[0] || null; } catch (_) { m = null; } }
  return fresh.find(n => !(m && m[n])) || null;
}
/* L3 (THE LEFT STICK PRESSED) TURNS THE ON-SCREEN BUTTONS ON OR OFF (2026-10-22: there was no
   way to turn the overlay off "using a controller alone"). Wherever the focus is, on the press edge,
   unless the console's pad table (with the viewer's remaps) gives L3 a function: then it stays the
   game's, as the triggers do. The Control Bar does the switching (ControlBar.overlayToggle, also Ctrl+O). */
let l3Prev = false;
function overlayStick(list, own) {
  const held = [].concat(...(list || []).map(p => p || [])).includes('L3');
  const fresh = held && !l3Prev; l3Prev = held;
  if (!fresh) return false;
  let m = null;
  try { const P = sitePad(), maps = P && P.mapsFor ? P.mapsFor(REG.padSys || SYS) : null; m = maps && maps[0] ? maps[0] : null; } catch (_) { m = null; }
  if (!m && own) { try { m = own()[0] || null; } catch (_) { m = null; } }
  if (m && m.L3) return false;
  try { const B = window.ControlBar; return !!(B && B.active && B.overlayToggle && B.overlayToggle()); } catch (_) { return false; }
}
addEventListener('focusin', e => { const t = e.target; if (t && t.closest && t.closest('.cb-bar .pill-controls')) barLast = t; });
function barItems() {
  const c = document.querySelector('.cb-bar .pill-controls');
  return c ? Array.from(c.querySelectorAll('button, select, input, [tabindex]:not([tabindex="-1"])')).filter(el => !el.disabled && el.getClientRects().length && !el.closest('[hidden]')) : [];
}
function focusBarBy(n) {
  const list = barItems(); if (!list.length) return false;
  guideReturn = null;                                  // Back from here is the game, not the Guide menu
  const el = barLast && list.includes(barLast) ? barLast : n === 'LT' ? list[list.length - 1] : list[0];
  try { window.focus(); } catch (_) {}
  try { el.focus({ focusVisible: true }); } catch (_) { try { el.focus(); } catch (__) {} }
  return document.activeElement === el;
}
function uiFocused() {
  try {
    const B = window.ControlBar; if (!B || !B.active) return false;
    const st = B.state, a = document.activeElement;
    return !!(st.menu || st.panel || (a && a.closest && (a.closest('.cb-bar') || a.closest('.cb-menu') || a.closest('.cb-panel') || a.closest('.cb-toast') || a.closest('.rob-side'))));   // .cb-toast: a note's button; .rob-side: R.O.B.'s view while his parts are set up
  } catch (_) { return false; }
}
let navPrev = new Set(), navRep = 0, navRepKey = null;
function navKey(code, key) {
  const t = document.activeElement && document.activeElement !== document.body ? document.activeElement : document;
  for (const type of ['keydown', 'keyup']) {
    const ev = new KeyboardEvent(type, { key, code, bubbles: true, cancelable: true, composed: true });
    try { Object.defineProperty(ev, '__gnwPad', { value: true }); } catch (_) {}
    t.dispatchEvent(ev);
  }
}
function guideFromBar() {
  const B = window.ControlBar;
  try { for (let i = 0; i < 4 && B && B.state && (B.state.menu || B.state.panel); i++) B.back(); } catch (_) {}
  try { const a = document.activeElement; if (a && a.closest && a.closest('.cb-bar')) a.blur(); } catch (_) {}
  if (embedded) { try { window.parent.postMessage({ gnwBack: 1, key: 'GamepadHome' }, '*'); } catch (_) {} }
}
/* START + LEFT REWINDS, START + RIGHT SPEEDS UP, both while held (2026-10-17, requested: "Could we have
   Start + Left for rewind as well? Also Start + Right for speed up?"). Start is a DEFERRED modifier
   on player 1's pad, read here before any routing, so it works wherever the focus is:
     - Start goes down: held back from the game (pending);
     - Left or Right while Start is held: a chord. The game never sees that Start or that direction;
       Left rewinds and Right runs at 2x (the bar's first fast speed, sound on) until either is let go;
     - Start let go alone: the game gets a Start press of START_TAP_MS at once;
     - Start held alone past START_WAIT_MS: it goes to the game as held (a game that wants Start held).
   So a plain Start reaches the game late by the time it was held, at most START_WAIT_MS; a held Start
   by exactly START_WAIT_MS. Select+Start (the Guide menu) is read before this and is untouched. */
const START_WAIT_MS = 250, START_TAP_MS = 100;
let stPhase = 'idle', stAt = 0, stTapUntil = 0, stDir = null, stPrevSpeed = 1, stSeen = new Set();
function startChordEnd() {
  if (stDir === 'Left') stopRewind();
  else if (stDir === 'Right' && speed !== stPrevSpeed) setSpeed(stPrevSpeed, 'Start + Right let go');
  stDir = null;
}
function startChords(list) {
  const p1 = new Set((list && list[0]) || []), now = performance.now();
  const start = p1.has('Start');
  if (chordOn) { if (stPhase !== 'idle') { startChordEnd(); stPhase = 'idle'; } stSeen = p1; return; }
  if (stPhase === 'idle' && start && !stSeen.has('Start')) { stPhase = 'pending'; stAt = now; }
  if (stPhase === 'pending' || stPhase === 'chord') {
    if (!start) {
      if (stPhase === 'pending') stTapUntil = now + START_TAP_MS;   // let go alone: the game's Start, now
      startChordEnd(); stPhase = 'idle';
    } else {
      const dir = p1.has('Left') && !stSeen.has('Left') ? 'Left' : p1.has('Right') && !stSeen.has('Right') ? 'Right' : null;
      if (dir && !stDir) {
        stPhase = 'chord'; stDir = dir;
        if (dir === 'Left') startRewind();
        else { stPrevSpeed = speed; if (speed < 2) setSpeed(2, 'Start + Right'); }
      } else if (stDir && !p1.has(stDir)) startChordEnd();
      else if (stPhase === 'pending' && now - stAt >= START_WAIT_MS) stPhase = 'game';
    }
  } else if (stPhase === 'game' && !start) stPhase = 'idle';
  stSeen = p1;
}
/* THE SHOULDERS REWIND AND SPEED UP, both while held (2026-10-23): LB rewinds, RB runs at 2x,
   on player 1's pad, wherever the focus is. A shoulder the console's pad table uses (play-pad.js MAPS
   with the viewer's remaps, else the core's own defaults) stays the game's, as the triggers do: the
   7800's RB is Pause, the 5200's LB is Reset, the Lynx's LB and RB are Option 1 and 2. */
let shSeen = new Set(), shDir = null, shPrevSpeed = 1;
function shoulderFree(n, own) {
  let m = null;
  try { const P = sitePad(), maps = P && P.mapsFor ? P.mapsFor(REG.padSys || SYS) : null; m = maps && maps[0] ? maps[0] : null; } catch (_) { m = null; }
  if (!m && own) { try { m = own()[0] || null; } catch (_) { m = null; } }
  return !(m && m[n]);
}
function shoulders(list, own) {
  const p1 = new Set((list && list[0]) || []);
  if (shDir && !p1.has(shDir)) {
    if (shDir === 'LB') stopRewind(); else if (speed !== shPrevSpeed) setSpeed(shPrevSpeed, 'RB let go');
    shDir = null;
  }
  if (!shDir && !stDir && ready) {
    const n = p1.has('LB') && !shSeen.has('LB') ? 'LB' : p1.has('RB') && !shSeen.has('RB') ? 'RB' : null;
    if (n && shoulderFree(n, own)) {
      if (n === 'LB' && manifest.state.supported) { shDir = 'LB'; startRewind(); }
      else if (n === 'RB') { shDir = 'RB'; shPrevSpeed = speed; if (speed < 2) setSpeed(2, 'RB held'); }
    }
  }
  shSeen = p1;
}
/* What the game and the bar see of player 1's Start and the chord's direction. */
function startFilter(list) {
  if (!list || !list.length) return list;
  const now = performance.now();
  return list.map((p, i) => {
    if (i !== 0) return p;
    let q = (p || []).slice();
    if (stPhase === 'pending' || stPhase === 'chord') q = q.filter(n => n !== 'Start');
    if (stPhase === 'chord') q = q.filter(n => n !== 'Left' && n !== 'Right');
    if (stTapUntil > now && q.indexOf('Start') < 0) q.push('Start');
    return q;
  });
}
let chordOn = false;
function chordAsHome(list, again) {
  list = list || [];
  if (!again) {
    const all = new Set([].concat(...list.map(p => p || [])));
    if (all.has('Select') && all.has('Start')) chordOn = true;
    else if (!all.has('Select') && !all.has('Start')) chordOn = false;
  }
  if (!chordOn) return list;
  return list.map((p, i) => { const q = (p || []).filter(n => n !== 'Select' && n !== 'Start'); if (i === 0 && q.indexOf('Home') < 0) q.push('Home'); return q; });
}
let padHoldEl = null;
function holdKeyTo(t, type) {
  const ev = new KeyboardEvent(type, { key: 'Enter', code: 'Enter', bubbles: true, cancelable: true, composed: true });
  try { Object.defineProperty(ev, '__gnwPad', { value: true }); } catch (_) {}
  t.dispatchEvent(ev);
}
function padHoldEnd() { const t = padHoldEl; padHoldEl = null; if (t) holdKeyTo(t.isConnected ? t : document, 'keyup'); }
const NAV = { Up: ['ArrowUp', 'ArrowUp'], Down: ['ArrowDown', 'ArrowDown'], Left: ['ArrowLeft', 'ArrowLeft'], Right: ['ArrowRight', 'ArrowRight'],
  LT: ['ArrowLeft', 'ArrowLeft'], RT: ['ArrowRight', 'ArrowRight'] };   // the triggers step along the bar (2026-10-18)
function navFeed(players) {
  const held = new Set([].concat(...(players || []).map(p => p || [])));
  const fresh = n => held.has(n) && !navPrev.has(n);
  const now = performance.now();
  for (const n of Object.keys(NAV)) {
    if (fresh(n)) { navKey(NAV[n][0], NAV[n][1]); navRepKey = n; navRep = now + 400; }
    else if (held.has(n) && navRepKey === n && now >= navRep) { navKey(NAV[n][0], NAV[n][1]); navRep = now + 140; }
  }
  /* A on a HOLD item (Rewind, a console key) is held, not clicked: Enter down while A is down, Enter
     up when it is let go (2026-10-17: the pad's A on Rewind only showed the hold tip). */
  if (fresh('A')) {
    const a = document.activeElement;
    if (a && a.closest && a.closest('.cb-bar [data-cb="rewind"], .cb-bar [data-cb^="ck:"]')) { padHoldEl = a; holdKeyTo(a, 'keydown'); }
    else if (a && a !== document.body && typeof a.click === 'function') a.click(); else navKey('Enter', 'Enter');
  }
  if (padHoldEl && !held.has('A')) padHoldEnd();
  /* Home (and Select+Start, which arrives here as Home) opens the Guide menu from the bar, its menus
     and its panels too, as it does in the game (2026-10-17): the bar's menu or panel closes, the
     bar lets go of the focus, and the site's Guide menu opens. B still steps back one level. */
  if (fresh('Home')) { guideFromBar(); navPrev = held; return; }
  if (fresh('B')) navKey('Escape', 'Escape');      // play-keys.js: the bar steps back first
  navPrev = held;
}
/* Where the Guide menu sent us: "Control bar" (focus on the bar) or "Change variant" (the
   Variant menu). Back out of either returns to the Guide menu; Back there resumes. */
let guideReturn = null;
function backToGuide() { if (embedded) { try { window.parent.postMessage({ gnwBack: 1, key: 'GuideReturn' }, '*'); } catch (_) {} } }
addEventListener('message', ev => { const d = ev.data; if (ev.source === window.parent && d && d.cwUi === 'openVariant') guideReturn = 'menu'; });
function wrapGuideHooks() {
  const K = window.gnwPlayKeys;
  if (K && K.focusBar && !K.focusBar.__host) {
    const f = K.focusBar; K.focusBar = function () { guideReturn = 'bar'; return f.apply(this, arguments); }; K.focusBar.__host = true;
  }
}

/* ------------------------------------------------------------------ pause */
function setPaused(on) { setHold('player', !!on); }
/* A ONE-TIME NOTICE (2026-10-24): a core's short instruction to the player for this
   game (result.notice {id, text}; the first, the Atari SaveKey games with a two-player mode).
   Shown in the toast once per game on this device (localStorage cw.notice.<id>.<sha256-12>),
   never in a preview, and only once the game is running: no hold (start screen, pause, loading)
   for a second and a half and frames advancing, so it is not lost behind the start screen or in a
   hidden tab. It fades by itself after 10 s; its OK button takes it down sooner. No sound. */
function noticeOnce(n) {
  if (PREVIEW || !n || !n.id || !n.text) return;
  const k = `cw.notice.${n.id}.${String(gameHash || game).slice(0, 12)}`;
  try { if (localStorage.getItem(k)) return; } catch (_) {}
  const g = game; let calm = 0, tries = 0, seen = framesRun;
  const t = setInterval(() => {
    if (game !== g || ++tries > 600) { clearInterval(t); return; }
    calm = !holding() && framesRun > seen ? calm + 1 : 0; seen = framesRun;
    if (calm < 3) return;
    clearInterval(t);
    try { localStorage.setItem(k, '1'); } catch (_) {}
    try { if (window.ControlBar && window.ControlBar.toast) window.ControlBar.toast(n.text, false, { label: 'OK', fn() {}, ms: 10000 }); } catch (_) {}
    log('note (once for this game): ' + n.text);
  }, 500);
}
function toast(msg) { try { if (window.ControlBar && window.ControlBar.toast) window.ControlBar.toast(msg); } catch (_) {} log('note: ' + msg); }
function paused() { return holds.has('player'); }

/* ------------------------------------------------------------------ Continue (continuerow.js) */
let continueReady = null, resumeDone = false, resumeTimer = 0;
window.__continue = {
  ready: () => !!(ready && continueReady === game && (framesRun > 0 || holds.has('resume')) && !(core && core.started === false)),
  /* A GAME HAS STARTED (4 Nov 2026): a core that knows (Game & Watch, Tetris Jr., the colour units:
     core.started) is false while only its clock or demo has run; the Continue row neither counts
     that time as play nor keeps it as a save. A core that does not say is always started. */
  started: () => !(core && core.started === false),
  canSave: () => !!(ready && core && manifest.state.supported),
  flush: () => batteryFlush('close'),
  quiesce() { setHold('closing', true); },
  save() {
    if (!ready || !manifest.state.supported) return null;
    let rewind = null; try { rewind = exportHistory(); } catch (_) {}
    const state = core.serialize();
    const thumb = presenter.shot('image/png');
    // The Continue row keeps the envelope (2026-10-18); its rewind history carries the same identity and a checksum.
    const env = seal('state', state, thumb);
    return { state: env, device: model, thumb, rewind, core: (core.info && core.info.build) || undefined, env: 1, playSeconds: playedOf(env) };
  },
  restore(rec) { return restoreRec(rec); },
};
async function restoreRec(rec) {
  if (!ready) throw new Error('the game is not running yet');
  const st = unseal(rec.state);
  const state = st.payload;
  await loadState(state, st.build);
  if (st.cheated) markCheated('a save made with cheats was loaded');
  input.resync();
  rewindReset();
  present();
  let n = 0; try { n = importHistory(rec.rewind, state); } catch (_) { rewindReset(); n = 0; }
  log(`restored a Continue save${n ? ` with ${n} moments of rewind history` : ''}`);
  if (holds.has('resume')) { clearTimeout(resumeTimer); setHold('resume', false); }
  return { ok: true, rewind: n };
}
const label = m => (manifest.modelLabel ? manifest.modelLabel(m) : String(m));
/* A save's build tag against this core's: the same, or one the module names as the same build
   under the old window's own tag (manifest.legacy.builds; found by gate G2, 2026-10-15). */
function sameBuild(b) {
  const cur = core && core.info && core.info.build;
  if (!b || !cur || b === cur) return true;
  return !!(manifest.legacy && Array.isArray(manifest.legacy.builds) && manifest.legacy.builds.includes(b));
}

/* ------------------------------------------------------------------ THE COMMON SAVE FORMAT (2026-10-18)
   Every save this host writes is sealed in the one envelope (play/host/save-envelope.mjs) around
   the core's own bytes: slots and quick save, the Continue row's state, the battery save in the
   host's own store. On load: a damaged envelope is refused; another game or console is refused;
   another model is refused (as before); a save from ANOTHER CORE BUILD is now TRIED: the machine's
   state is kept first, and if the core rejects the save it is put back and the player is told
   "This save was made by an older version and cannot be loaded." Decided 2026-10-18 (saves were test data:
   "Feel free to delete all previous saves you find. They are only for testing."): a save without the
   envelope is not read at all (it is refused as older); play/host/save-purge.js deleted every such
   save once, from every store the site used. */
const hereId = () => ({ coreId: manifest.id, sha256: gameHash || null, gameId: REG.deviceId(game) });
function seal(kind, payload, thumb, extra, metaSection) {
  return E.wrap({ kind, core: { id: manifest.id, build: (core && core.info && core.info.build) || null, api: CORE_API },
    game: { sha256: gameHash || null, id: REG.deviceId(game) }, model: model || null, thumb: thumb || null, extra }, payload,
    metaSection === undefined ? playMeta() : metaSection);
}
/* THE METADATA SECTION, filled from day one with the play time (2026-10-18, requested: "Playtime should
   be added to it as default so we can always show how it's written"). The source of truth is the
   site's own play-time tracking (index.html playSecondsFor, playLastPlayedAt); nothing here counts.
   { v: 1, playtime: { totalSeconds, lastPlayed } }: totalSeconds is this game's whole play time on
   this device at the moment of the save, lastPlayed the time of the save. Informational only. */
/* CHEATS (2026-10-26; play/host/cheats.mjs). Every game starts with them all off. The first
   one switched on marks the session as cheated for good: the site stops counting play time for it
   (host-bridge.js 'cheated'), and every save made after it carries the mark in its metadata, so
   loading such a save marks the session again (a cheated run never counts, saved or not). */
function startCheats() {
  const was = cheats; cheats = null; H.cheats = 0;
  if (was && was.onCount()) { try { was.allOff(); } catch (_) {} }
  if (!core || !core.ext || !core.ext.cheats) return;
  const c = new Cheats({ core, log, onChange: () => changed(), onCheated: () => markCheated('a cheat was switched on') });
  const id = REG.deviceId(game);
  c.load(SYS, gameBytes, { system: result && result.system, model, deviceId: id }).then(has => {
    if (game && REG.deviceId(game) !== id) return;              // another game started meanwhile
    cheats = has ? c : null; H.cheats = has ? c.count() : 0;
    changed();
  }).catch(e => log('cheats: ' + ((e && e.message) || e)));
}
function markCheated(why) {
  if (H.cheated) return;
  H.cheated = true;
  log('cheats: this session is marked as cheated (' + why + '); it does not count towards play time');
  try { if (embedded) window.parent.postMessage({ cwUi: 'cheated' }, location.origin); } catch (_) {}
  try { const CBX = window.ControlBar; if (CBX && CBX.toast) CBX.toast('Cheats are on: this game no longer counts towards play time.'); } catch (_) {}
}
function playMeta() {
  try {
    const P = embedded ? window.parent : window, id = REG.deviceId(game);
    if (!P || typeof P.playSecondsFor !== 'function') return null;
    const t = Math.max(0, Math.floor(+P.playSecondsFor(id) || 0));
    return Object.assign({ playtime: { totalSeconds: t, lastPlayed: Date.now() } }, H.cheated ? { cheats: { cheated: true, on: cheats ? cheats.activeIds() : [] } } : {});
  } catch (_) { return null; }
}
/* Seconds played, from a save's metadata, or null (none, malformed): never an error. */
/* A SAVE'S NOTE (2026-10-19; the old Game & Watch window's note on each save, now for every
   console): the metadata section's 'notes', one line of plain text (at most NOTE_MAX characters),
   outside both checksums, so writing it never touches the save itself. Saving again into the same
   slot keeps its note, as the old window did. */
const NOTE_MAX = 200;
function noteOf(env) { const m = E.readMeta(env), t = m && m.notes; return typeof t === 'string' ? t.slice(0, NOTE_MAX) : ''; }
function withNote(env, text) {
  const m = Object.assign({ v: 1 }, E.readMeta(env) || {});
  const t = String(text || '').replace(/[\u0000-\u001f\u007f]+/g, ' ').trim().slice(0, NOTE_MAX);
  if (t) m.notes = t; else delete m.notes;
  return E.withMeta(env, m);
}
function playedOf(env) {
  const m = E.readMeta(env), p = m && m.playtime, t = p && +p.totalSeconds;
  return Number.isFinite(t) && t >= 0 ? Math.floor(t) : null;
}
/** A stored state (an envelope) as { payload, build, header }, or a thrown plain refusal. */
function unseal(bytes) {
  if (E.isEnvelope(bytes)) {
    const { header, payload } = E.open(bytes);
    const why = E.judge(header, hereId()); if (why) throw why;
    if (header.kind !== 'state') throw new E.SaveError('damaged');
    if (header.model && model && header.model !== model) throw new Error(`This save was made on a ${label(header.model)}; this is a ${label(model)}.`);
    let cheated = false; try { const m = E.readMeta(bytes); cheated = !!(m && m.cheats && m.cheats.cheated); } catch (_) {}
    return { payload, build: header.core && header.core.build, header, cheated };
  }
  throw new E.SaveError('older');                    // made before the common save format
}
/** Put a state into the machine. Another build's state is tried with the running state kept, and
 *  put back if the core rejects it, so a refused save never leaves the game half loaded. */
async function loadState(payload, build) {
  const same = sameBuild(build);
  let back = null;
  if (!same) { try { back = core.serializeAsync ? await core.serializeAsync() : core.serialize(); } catch (_) { back = null; } }
  try {
    if (!same && core.check) core.check(payload);
    if (core.unserializeAsync) await core.unserializeAsync(payload); else core.unserialize(payload);
  } catch (e) {
    if (back) { try { if (core.unserializeAsync) await core.unserializeAsync(back); else core.unserialize(back); } catch (_) {} }
    log(`state refused by the core: ${(e && e.message) || e}${same ? '' : ' (made by build ' + build + ')'}`);
    throw new E.SaveError(same ? 'damaged' : 'older');
  }
  if (!same) log(`a state from build ${build} was accepted by this build`);
}
/* A battery region's keys, sealed: stored in the envelope, judged on the way back. */
function sealBattery(keys) {
  keys.seal = b => seal('battery', b, null, { region: keys.id });
  keys.check = h => E.judge(h, hereId()) || (h.kind !== 'battery' ? new E.SaveError('damaged') : null);
  return keys;
}
/* A slot as the Saves panel shows it, one path for every console: the envelope's header gives
   the date, the picture and the model, its metadata the play time; a damaged one is listed as damaged. */
const TWO_MACHINES = new Set(['gb', 'pm']);   // Game Boy or Game Boy Color; one Pokemon mini or two linked
async function slotView(r, i) {
  if (!r) return null;
  if (r.env && E.isEnvelope(r.state)) {
    try { const h = E.verify(r.state); return { ts: h.created, state: r.state, thumb: h.thumb || null, thumbWhy: h.thumb ? '' : 'no picture', model: h.model || model, core: h.core && h.core.build, env: h, playSeconds: playedOf(r.state), note: noteOf(r.state),
      /* The save table (8 Nov 2026): the machine where a console has more than one, and a save an older build made. */
      machine: TWO_MACHINES.has(SYS) ? label(h.model || model) : null, older: !sameBuild(h.core && h.core.build) }; }
    catch (e) { return { ts: r.ts || 0, state: r.state, thumb: null, thumbWhy: E.MESSAGES.damaged, model, damaged: true, env: null }; }
  }
  return { ts: r.ts || 0, state: r.state, thumb: null, thumbWhy: E.MESSAGES.damaged, model, damaged: true, env: null };
}

/* ------------------------------------------------------------------ the Control Bar */
let barReady = false, overlay = null;
const keysBox = document.createElement('div');
keysBox.className = 'host-keys';
let keysLit = 0;
/* KEYS > KEYBOARD FITS THE WINDOW (3 Nov): a drawn diagram (keys-diagram.js: Game & Watch, the
   colour units, Tetris Jr.) is sized by the panel's width, so a tall one ran below the window and
   the tab scrolled. When the panel overflows, the diagram gets narrower (its height follows) by
   just the overflow, never under 160 px tall. Measured again whenever the tab shows or resizes. */
let keysFitRO = null;
function fitKeysDiagram() {
  const wrap = keysBox.querySelector('.keys-wrap'), dia = keysBox.querySelector('.keys-diagram');
  const panel = keysBox.closest('.cb-panel');
  if (!wrap || !dia || !panel) return;
  wrap.style.maxWidth = '';
  if (!panel.clientHeight || !dia.offsetHeight) return;
  const over = panel.scrollHeight - panel.clientHeight;
  if (over <= 0) return;
  const h = dia.offsetHeight, ar = dia.offsetWidth / h, nh = Math.max(160, h - over - 2);
  if (nh < h) wrap.style.maxWidth = Math.floor(nh * ar) + 'px';
}
function watchKeysFit() {
  if (keysFitRO || typeof ResizeObserver !== 'function') return;
  keysFitRO = new ResizeObserver(() => fitKeysDiagram());
  keysFitRO.observe(keysBox);
  addEventListener('resize', fitKeysDiagram);
}
function paintKeys() {
  const rows = input ? input.table() : [];
  keysBox.textContent = '';
  watchKeysFit();
  const d = artMod && artMod.keysDiagram && rows.length ? artMod.keysDiagram(rows, keyLabel) : null;
  // A tall drawn picture goes beside the key list on a wide window (play/host/index.html, 4 Nov).
  const dia = d && d.querySelector && d.querySelector('.keys-diagram');
  keysBox.classList.toggle('host-keys-side', !!dia && (parseFloat(dia.dataset.aspect) || 1) < 1.4);
  if (d) {
    // The device's own diagram, lit while a control is held (any source).
    keysBox.appendChild(d);
    cancelAnimationFrame(keysLit);
    const light = () => {
      if (!d.isConnected) return;
      const held = input.litSet ? input.litSet() : input.heldSet();
      const done = new Set();   // a control id is the first port's that has it (player 2's Up does not light player 1's)
      result.ports.forEach((p, pi) => p.controls.forEach((c, bit) => { if (done.has(c.id)) return; done.add(c.id); const e = d.querySelector(`[data-btn="${c.id}"]`); if (e) e.classList.toggle('down', held.has(pi + ':' + bit)); }));
      keysLit = requestAnimationFrame(light);
    };
    keysLit = requestAnimationFrame(light);
  }
  const list = document.createElement('div');
  keysBox.appendChild(list);
  const plabels = (result ? result.ports : []).map(p => p.label || '');
  list.className = 'host-keylist';
  const tiltRow = devices.tilt ? `<div class="host-portlabel">Tilt sensor</div><div class="host-keygrid"><div class="host-key"><span class="host-key-l">Tilt</span>${['I', 'J', 'K', 'L'].map(k => `<span class="cb-kbd">${k}</span>`).join(' ')} <span class="host-note">, the right stick, or drag on the screen</span></div></div>` : '';
  list.innerHTML = tiltRow + rows.map((port, i) => (rows.length > 1 && plabels[i] ? `<div class="host-portlabel">${plabels[i]}</div>` : '') + `<div class="host-keygrid">${port.map(c =>
    `<div class="host-key"><span class="host-key-l">${c.label}</span>${c.keys.map(k => `<span class="cb-kbd">${keyLabel(k)}</span>`).join(' ')}</div>`).join('')}</div>`).join('')
    /* The controller's window shortcuts (2026-10-17), the same on every console. */
    + `<div class="host-portlabel">Controller shortcuts</div><div class="host-keygrid">`
    + `<div class="host-key"><span class="host-key-l">Rewind, held</span><span class="cb-kbd">Start</span> + <span class="cb-kbd">←</span></div>`
    + `<div class="host-key"><span class="host-key-l">Speed up, held</span><span class="cb-kbd">Start</span> + <span class="cb-kbd">→</span></div>`
    + `<div class="host-key"><span class="host-key-l">Menu</span><span class="cb-kbd">Select</span> + <span class="cb-kbd">Start</span> <span class="host-note">or Home</span></div></div>`;
}
const GROUP_TITLE = { display: 'Display', machine: 'Machine', cabinet: 'Cabinet (DIP switches)', sound: 'Sound', firmware: 'Boot program', cassettes: 'Cassettes' };
function settingsGroups() {
  const by = { display: [], machine: [], cabinet: [], sound: [] };
  const effOpts = [].concat(...effects.map(e => e.def.options || []));
  for (const d of (core.options ? core.options() : []).concat(effOpts)) {
    if (d.hidden) continue;
    if (typeof d.when === 'function') { let on = false; try { on = !!d.when(); } catch (_) {} if (!on) continue; }
    const r = document.createElement('div'); r.className = 'cb-row';
    const id = 'opt-' + d.id;
    r.innerHTML = `<label class="cb-lab" for="${id}">${d.label}</label>`;
    const cur = optionValues[d.id] != null ? optionValues[d.id] : d.default;
    if (d.type === 'enum') {
      const sel = document.createElement('select'); sel.id = id;
      for (const v of d.values) { const o = document.createElement('option'); o.value = v.v; o.textContent = v.label; sel.appendChild(o); }
      sel.value = String(cur);
      sel.addEventListener('change', () => setOption(d, sel.value));
      r.appendChild(sel);
      if (d.notice) { const h = document.createElement('span'); h.className = 'host-note'; h.textContent = d.notice; r.appendChild(h); }
    } else if (d.type === 'bool') {
      const c = document.createElement('input'); c.type = 'checkbox'; c.id = id; c.checked = !!cur;
      c.addEventListener('change', () => setOption(d, c.checked));
      r.appendChild(c);
      if (d.help) { const h = document.createElement('span'); h.className = 'host-note'; h.textContent = d.help; r.appendChild(h); }
    } else if (d.type === 'range') {
      const rg = document.createElement('input'); rg.type = 'range'; rg.id = id; rg.min = d.min; rg.max = d.max; rg.step = d.step || 1; rg.value = String(cur);
      const out = document.createElement('span'); out.textContent = cur + (d.unit || '');
      rg.addEventListener('input', () => { out.textContent = rg.value + (d.unit || ''); setOption(d, +rg.value); });
      r.appendChild(rg); r.appendChild(out);
    }
    (by[d.group] || by.machine).push(r);
  }
  if (core.note) { const n = document.createElement('div'); n.className = 'cb-row host-note'; n.textContent = core.note; (by[core.noteGroup] || by.display).push(n); }
  by.firmware = firmwareRows();
  by.cassettes = cassetteRows();
  return Object.keys(by).filter(k => by[k].length).map(k => ({ section: GROUP_TITLE[k], nodes: by[k] }));
}
async function setOption(d, v) {
  optionValues[d.id] = v;
  writeOption(d, v);
  if (d.__effect) {
    try { d.__effect.setOption(d.id, v); } catch (_) {}
    if (d.redescribe) { log(`option ${d.id} = ${v} (art)`); await placeArt(); present(); }
    return;
  }
  const how = core.setOptionAsync ? await core.setOptionAsync(d.id, v).catch(() => 'unknown') : core.setOption ? core.setOption(d.id, v) : 'unknown';   // a worker core answers when it has it (2026-10-22)
  log(`option ${d.id} = ${v} (${how})`);
  if (how === 'reload') { await batteryFlush('option'); stopRewind(); rewindReset(); await mount(); }   // a restart: the history before it belongs to the machine that was
  else if (how === 'ports') portsChanged();
  else if (how === 'art') { presenter.configure(core.video()); await placeArt(); present(); }
  else present();
  try { if (overlay && overlay._paintToggles) overlay._paintToggles(); } catch (_) {}
  try { if (overlay && overlay.refresh) overlay.refresh(); } catch (_) {}   // a switch can come or go with the console
  refreshSettings();
}
function refreshSettings() {
  const p = document.getElementById('cb-panel-settings');
  if (!p || !barReady) return;
  const host = p.querySelector('.cb-set'); if (!host) return;
  // The control that had the focus keeps it across the rebuild (a controller or keyboard user's
  // place in the panel; 2026-10-19).
  const had = document.activeElement && p.contains(document.activeElement) && document.activeElement.id ? document.activeElement.id : null;
  // Rebuild the Display section from the current option list (a row can appear or go).
  host.querySelectorAll('section[data-host]').forEach(s => s.remove());
  const first = host.firstChild;
  for (const g of settingsGroups()) {
    const sec = document.createElement('section'); sec.dataset.host = '1';
    sec.innerHTML = `<h4>${g.section}</h4>`;
    for (const n of g.nodes) sec.appendChild(n);
    host.insertBefore(sec, first);
  }
  const ours = new Set(Object.values(GROUP_TITLE));
  host.querySelectorAll('section:not([data-host])').forEach(sec => { const h = sec.querySelector('h4'); if (h && ours.has(h.textContent)) sec.remove(); });
  if (had && document.activeElement !== document.getElementById(had)) { const e = document.getElementById(had); if (e && p.contains(e)) try { e.focus({ preventScroll: true }); } catch (_) {} }
}

/* The strip's toggles (an Atari's difficulty and colour switches) call `switch` with their
   bit; the core declares each switch as an option with `strip: <bit>`. */
/* The on-screen art buttons follow the art as it is drawn now (2026-10-17): the part of the
   photograph it is (an Atari body cut), its turn (a turned Lynx), which console (the Game Boy's
   three), and the part the frame shows (the Game Boy's screen band, or the whole console on a tall
   screen). Only an art that describes this (overlayView) is told; the others keep their numbers. */
function syncOverlayArt() {
  if (!overlay || typeof overlay.setArtView !== 'function' || !presenter || presenter.full) return;
  const g = presenter.art;
  overlay.setArtView(g && g.overlayView ? Object.assign({}, g.overlayView, { show: presenter.shownRect }) : null);
}
function overlayCalls() {
  const def = a => (core.options ? core.options() : []).find(d => d.strip === +a);
  return { switch: {
    has: a => !!def(a),   // the machine has this switch now (none for TV type on the 5200's VCS adapter)
    get: a => { const d = def(a); return !!d && String(optionValues[d.id] != null ? optionValues[d.id] : d.default) === '1'; },
    set: (a, on) => { const d = def(a); if (d) setOption(d, on ? '1' : '0'); },
  } };
}
async function registerBar() {
  const CB = window.ControlBar;
  if (!CB) { log('no Control Bar on this page'); return; }
  barReady = true;
  paintKeys();
  // The on-screen buttons first, so the bar mounts them and puts their row in Settings.
  if (window.CwOverlay) {
    try {
      const d = await window.CwOverlay.load(REG.padSys || SYS);
      if (d) {
        overlay = window.CwOverlay.create({ sys: REG.padSys || SYS, def: d, variant: result.overlayVariant || undefined, frame: $('lcdWrap'), stage: $('stage'), screen: $('screen'),
          send: (inp, down) => input.touchSend(inp, down), calls: overlayCalls() });
        input.overlay = overlay;
        syncOverlayArt();
        /* What the game has held now, from every input (keys with remaps, a pad, touch), named by the
           functions' default key codes, which are what the overlay's buttons press (2026-10-17). */
        if (overlay.setLitSource) overlay.setLitSource(() => {
          const h = input.litSet ? input.litSet() : input.heldSet(), out = [];
          for (const [code, f] of input.fnMap) if (h.has(f[0] + ':' + f[1])) out.push(code);
          return out;
        }, () => {
          const out = [];
          if (input.pad.size) for (const [code, f] of input.fnMap) if (input.pad.has(f[0] + ':' + f[1])) out.push(code);
          return out;
        });
      }
    } catch (e) { log('on-screen buttons not available: ' + e.message); }
  }
  const states = {
    async list() { const raw = await S.listSlots(manifest, game, model, REG.slots || 20); const out = []; for (let i = 0; i < raw.length; i++) out.push(await slotView(raw[i], i)); return out; },
    async save(i) {
      const state = core.serializeAsync ? await core.serializeAsync() : core.serialize();
      let env = seal('state', state, presenter.shot('image/png'));
      const before = (await S.listSlots(manifest, game, model, REG.slots || 20).catch(() => []))[i];
      const kept = before && before.env && E.isEnvelope(before.state) ? noteOf(before.state) : '';
      if (kept) env = withNote(env, kept);
      await S.putSlot(manifest, game, model, i, { env: 1, ts: Date.now(), state: env });
      log(`saved slot ${i + 1}`);
      return slotView({ env: 1, state: env }, i);
    },
    async load(i) {
      const rec = (await states.list())[i];
      if (!rec) throw new Error(`slot ${i + 1} is empty`);
      if (rec.damaged) throw new E.SaveError('damaged');
      const st = unseal(rec.state);
      await loadState(st.payload, st.build);
      if (st.cheated) markCheated('a save made with cheats was loaded');
      input.resync(); rewindReset(); present();
      log(`loaded slot ${i + 1}`);
    },
    async remove(i) { const rec = (await states.list())[i]; await S.putSlot(manifest, game, model, i, S.TOMB); return rec; },
    async setNote(i, text) {
      const raw = (await S.listSlots(manifest, game, model, REG.slots || 20))[i];
      if (!raw || !raw.env || !E.isEnvelope(raw.state)) throw new Error(`slot ${i + 1} is empty`);
      E.verify(raw.state);                               // a damaged save gets no note
      await S.putSlot(manifest, game, model, i, Object.assign({}, raw, { state: withNote(raw.state, text) }));
      log(`slot ${i + 1}: note ${String(text || '').trim() ? 'kept' : 'removed'}`);
    },
    async put(i, rec) { await S.putSlot(manifest, game, model, i, rec ? (E.isEnvelope(rec.state) ? { env: 1, ts: rec.ts || Date.now(), state: rec.state } : rec) : null); },
    async exportOf(i) {
      const rec = (await states.list())[i];
      if (!rec) throw new Error(`slot ${i + 1} is empty`);
      if (rec.damaged) throw new E.SaveError('damaged');
      return { bytes: new Uint8Array(rec.state), meta: { device: rec.model || model, ts: rec.ts, thumb: rec.thumb || null, envelope: E.ENVELOPE_VERSION } };
    },
    async importInto(i, bytes, meta) {
      unseal(bytes);                                     // damaged, older, another game or another model: refused now
      await S.putSlot(manifest, game, model, i, { env: 1, ts: Date.now(), state: new Uint8Array(bytes) });
    },
  };
  const bar = {
    sys: SYS, label: manifest.label, padSys: REG.padSys || SYS,
    stage: $('stage'),
    overlay: null,
    caps: () => ({
      pause: true, reset: true, rewind: !!manifest.state.supported,
      saves: manifest.state.supported ? { slots: REG.slots || 20, cols: 4, shot: `${result.video.width}/${result.video.height}` } : false,
      transfer: !!manifest.state.supported, lastClosed: embedded, screenshot: true, mute: true, keys: true, help: embedded,
      fullscreen: true, settings: true, variant: embedded, overlay: !!overlay, speed: SPEEDS, statusLog: true,
      media: !!(core.ext && core.ext.media && result.extensions && result.extensions.media),
      devices: Object.keys(devices).map(id => Object.assign({ id }, DEVICE_ITEMS[id])),
      consoleKeys: consoleKeysOf(), rotate: !!(core.ext && core.ext.rotation),
      printer: !!printer,
      cheats: !!(core.ext && core.ext.cheats) && !PREVIEW,
      padSwap: !PREVIEW,
    }),
    padSwap: { on: () => padSwap, set: setPadSwap, does: padSwapDoes, seen: () => padSeen },
    title: () => gameTitle,
    paused,
    pause(on) { const was = paused(); setPaused(on); return was !== paused(); },
    hold(on) { setHold('panel', !!on); if (!on) requestAnimationFrame(() => presenter.layout()); },
    reset() {
      if (!ready) throw new Error('nothing is running');
      core.reset(); input.resync(); rewindReset(); present();
      // Reset (a power cycle) while paused also takes the game out of pause (2026-10-15).
      if (holds.has('player')) setPaused(false);
    },
    rewind: { start: startRewind, stop: stopRewind, active: () => rewinding },
    speed: () => speed,
    setSpeed,
    // A console key (Power, Reset, Select, Game A...) pressed while paused acts and resumes (2026-10-15).
    consoleKey(id, down) { if (down && holds.has('player')) setPaused(false); input.consoleKey(id, !!down); },
    onExit(what) {
      // Back left the bar, or closed a menu opened from the Guide menu: back to the Guide menu.
      if (guideReturn && (what === 'bar' || (what === 'menu' && guideReturn === 'menu'))) { guideReturn = null; backToGuide(); }
    },
    statusLog() { toggleLog(); },   // the bar item toggles: it used to only open, so the log could not be closed from it (bug, 2026-10-15)
    /* Disk sides, tapes (Core API extension 'media'): the bar's Media item and its menu. */
    device: id => devices[id] || null,
    /* The Print window: the bar's Print item, its panel, and the Back / Save / Print it shows. */
    printer: {
      visible: () => !!(printer && printer.visible),
      content: () => (printer ? printer.el : null),
      png: scale => (printer ? printer.png(scale) : null),
      print: scale => (printer ? printer.print(scale) : false),
      discard: () => { if (printer) printer.discard(); },
      rows: () => (printer ? printer.rows : 0),
      layout: () => { if (printer) { printer.laid = false; printer.layout(); printer.paint(); } },
    },
    media: {
      list: () => (core.ext && core.ext.media ? core.ext.media.list() : []),
      current: () => (core.ext && core.ext.media ? core.ext.media.current() : null),
      label: () => (core.ext && core.ext.media && core.ext.media.label ? core.ext.media.label() : 'Media'),
      insert: id => { const ok = core.ext.media.insert(id); changed(); return ok; },
      eject: () => { core.ext.media.eject(); changed(); },
    },
    /* The Cheats menu: empty until this game's cheats file has been read. */
    cheats: {
      count: () => (cheats ? cheats.count() : 0),
      onCount: () => (cheats ? cheats.onCount() : 0),
      providers: () => (cheats ? cheats.providers() : []),
      credit: () => (cheats ? cheats.credit() : ''),
      set: (id, on) => (cheats ? cheats.set(id, on) : Promise.resolve({ ok: false, why: 'No cheats for this game.' })),
      allOff: () => (cheats ? cheats.allOff() : Promise.resolve()),
    },
    muted: () => muted,
    setMuted(on) {
      muted = !!on;
      try { localStorage.setItem('cw.play.muted', muted ? '1' : '0'); } catch (_) {}
      if (sink) { sink.setMuted(muted || speed > 2); if (!muted && sink.state() !== 'running') sink.resume(); }
      changed();
    },
    states,
    identity: () => ({ sys: SYS, game, title: gameTitle, device: model, gameHash: gameHash ? gameHash.slice(0, 16) : null, core: core.info && core.info.build }),
    continueRestore: rec => restoreRec(rec),
    screenshot: async () => presenter.shot('image/png'),
    keysContent: () => { paintKeys(); return keysBox; },
    settings: () => settingsGroups(),
    refreshSettings,
    fullscreen(on) { presenter.setFull(on); document.body.classList.toggle('cb-full', !!on); },
    rotate() { const R = core.ext && core.ext.rotation, d = R && optDef(R.option); if (d) setOption(d, R.next()); },
    onChange(fn) { changeFns.push(fn); },
    focusGame() { try { const a = document.activeElement; if (a && a !== document.body && a.blur) a.blur(); window.focus(); } catch (_) {} },
  };
  Object.defineProperty(bar, 'overlay', { get: () => overlay });
  CB.register(bar);
  wrapGuideHooks();
  // The presenter keeps the picture clear of the bar (A9: the bar never covers the picture).
  presenter.barBottom = () => { const b = document.querySelector('.cb-bar'); if (!b || presenter.full) return 0; return b.getBoundingClientRect().bottom - $('stage').getBoundingClientRect().top + 6; };
  requestAnimationFrame(() => presenter.layout());
  H.bar = true;
  H.barCore = bar;
}

/* ------------------------------------------------------------------ a file of your own */
/* THE OPEN PICKER (2026-10-19, the unified UI leftovers):
   - A STUDY BOX TAPE (.study / .studybox, 150 to 180 MB, nearly all audio) is never read whole: it
     goes to the deck (the Tape item's own path, which reads a few seconds ahead), or, before the
     Study Box cartridge is in, waits for it (the old NES page sent it to the deck the same way).
   - A GAME FILE opened here is kept on this device (play/host/local-files.mjs: IndexedDB 'cw-local',
     never uploaded) and listed under the picker next time, newest first, with "Forget this list". */
let pendingTape = null, localPick = null;
const TAPE_FILE = /\.(study|studybox)$/i;
const hasTapes = () => !!(manifest && (manifest.extensions || []).includes('tape'));
const LFmod = () => import('./local-files.mjs?v=2.1.0');
async function openLocal(f) {
  if (!f) return;
  if (TAPE_FILE.test(f.name)) {
    if (!hasTapes()) { say('This is a Study Box tape.', 'Only the Study Box cartridge on the NES player takes a tape.', { open: true }); return; }
    if (devices.tape) { unsay(); devices.tape.addFile(f); return; }
    pendingTape = f;
    say('Tape ready.', `“${f.name.replace(TAPE_FILE, '')}” goes into the deck as soon as the Study Box cartridge is in. Choose the Study Box cartridge file now.`, { open: true });
    return;
  }
  let bytes = null;
  try { bytes = new Uint8Array(await f.arrayBuffer()); }
  catch (_) { say('That file could not be read.', 'It may have been moved or renamed. Choose it again.', { open: true }); return; }
  localPick = f.name;
  start(f.name.replace(/\.[^.]+$/, ''), bytes);
}
function pickFile() {
  const inp = document.createElement('input'); inp.type = 'file';
  const exts = (manifest && manifest.files.game.exts) || [];
  inp.accept = exts.concat(hasTapes() ? ['.study', '.studybox'] : []).join(',');
  inp.addEventListener('change', () => openLocal(inp.files && inp.files[0]));
  inp.click();
}
/* The games opened from this device before (under the picker; keyboard and touch reach them). */
async function paintRecent() {
  const box = $('msgRecent'); if (!box) return;
  const show = !$('msgOpen').hidden;
  let list = [];
  if (show) { try { list = await (await LFmod()).recentGames(SYS); } catch (_) {} }
  const ul = box.querySelector('ul'); ul.textContent = '';
  for (const e of list) {
    const li = document.createElement('li'), b = document.createElement('button');
    b.type = 'button'; b.textContent = e.name.replace(/\.[^.]+$/, '');
    b.setAttribute('aria-label', 'Play ' + b.textContent);
    b.addEventListener('click', () => { localPick = e.name; start(e.name.replace(/\.[^.]+$/, ''), new Uint8Array(e.bytes)); });
    li.appendChild(b); ul.appendChild(li);
  }
  box.hidden = !show || !list.length;
}
async function rememberPick(bytes, name) {
  if (!name || PREVIEW) return;
  try { const ok = await (await LFmod()).rememberGame(SYS, name, bytes, gameHash); log(ok ? 'the file is kept on this device for next time (never uploaded)' : 'the file is too big to keep on this device'); } catch (_) {}
}
$('msgOpen').addEventListener('click', pickFile);
$('msgForget').addEventListener('click', async () => {
  try { await (await LFmod()).forgetGames(SYS); } catch (_) {}
  log('the list of files opened on this device is forgotten');
  paintRecent(); $('msgOpen').focus();
});
$('screenBox').addEventListener('dragover', e => { e.preventDefault(); });
$('screenBox').addEventListener('drop', async e => {
  e.preventDefault();
  const f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
  if (f) openLocal(f);
});
addEventListener('pagehide', () => { try { if (sink) sink.release(); } catch (_) {} });

/* For tests and diagnosis: live handles, never a snapshot. */
Object.defineProperties(H, Object.getOwnPropertyDescriptors({
  get core() { return core; }, get result() { return result; }, get input() { return input; }, get presenter() { return presenter; },
  get holds() { return Array.from(holds); }, get effects() { return Object.fromEntries(effects.map(e => [e.def.id, e.inst.stats || {}])); }, get ring() { return ringLen(); }, get bigRing() { return big; }, get sink() { return sink; },
  get frames() { return framesRun; }, get ready() { return ready; }, get muted() { return muted; },
  pause: setPaused, startRewind, stopRewind, exportHistory, restoreRec, batteryFlush, setSpeed,
}));

/* A preview's parking (index.html _bgFrameHold asks gnwPlayKeys.pause while a tile is off screen). */
if (PREVIEW) window.gnwPlayKeys = { pause(on) { try { setPaused(!!on); } catch (_) {} return true; } };
boot().catch(e => { say('The player could not start.', e && e.message); log('boot failed: ' + (e && e.stack || e)); });
