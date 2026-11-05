/*
 * play/cores/gnw/core.mjs -- the classic Game & Watch units for the one play host
 * (Core API 1.0). Started 2026-10-14 in the Game & Watch migration
 * (the build plan, Phase 5).
 *
 * WHAT IT WRAPS, UNCHANGED. The site's own Game & Watch engine: play/gnw/gwc-core.js
 * (the clean-room SM5A / SM510 / SM511 / SM512 core, window.GWC_CORE) and
 * play/gnw/gnw-host.js (the GAMES registry, GnwEmulator's frame step with every
 * per-title input rule, the clock set, the demo entry, GnwDisplay's segment charge
 * model and GnwSpeaker's band-limited speaker). Neither file is edited. Both are
 * classic scripts wrapped in one closure, so they are read as text and run here in a
 * SANDBOX: a private window and document that absorb everything (no DOM is touched,
 * no banner is drawn, no network fetch starts), and the four things that make a
 * machine impure are replaced by the host's virtual time:
 *     performance.now()   emulated milliseconds since load (advances 1000/60 per frame)
 *     new Date()          the host's virtual clock (env.now()), for the clock set
 *     setTimeout()        emulated-time timers (the 5 s minimum hold on Game A / B / Time),
 *                         so a pause, a rewind or 4x speed never desynchronises them
 *     requestAnimationFrame  absent: the host's loop is the only thing that runs a frame
 * The one line added at run time is an export of names the closure already holds
 * (GAMES, GnwEmulator, GnwDisplay, GnwSpeaker, KEY_TO_BUTTON, _serializeCpu,
 * _restoreCpu); if the file's shape ever changes so the anchor is not found, create()
 * fails loudly with the reason.
 *
 * THE GAME FILE. A device needs a program (and, on SM511 / SM512, a melody table), not
 * one cartridge file, so the site's one relay (play/host/site-relay.js, 'gnw') answers
 * with a small container: UTF-8 JSON {format:'cw-gnw/1', key, program, melody} built from
 * the same {key: {program, melody}} map the old window uses (content pack, built files,
 * then the game server's zips by model number, cws.js gnwPrograms). A raw program file
 * named after its key (ball.bin) also loads, for a file opened by hand.
 *
 * VIDEO is 'segments' (the Core API, section 3.4.2): one level (0 or 255) per
 * segment address "A.B.C" (the SVG <title> convention), painted by GnwDisplay's own
 * hysteresis, unchanged. The artwork (play/cores/gnw/art.mjs) binds each address to its
 * element in the device's SVG; the core never sees the SVG.
 *
 * AUDIO is the old window's: the R-pin edges of each frame through GnwSpeaker (Kaiser
 * band-limited step, 20 Hz DC blocker, the chosen output gain), mono f32 at the rate the
 * host's sound card wants. filtered: true (it is already DC-free).
 *
 * STATE is the old window's save shape (gnwSaveState: the CPU's own fields, the
 * machine's JSON included), as UTF-8 JSON, plus this module's frame counter.
 * deterministic: false, said plainly: the segment charges and the pending minimum-hold
 * releases are not in it (after a load every segment shows its driven state at once).
 */
import { CoreError } from '../../host/core-api.mjs';

const BASE = new URL('../../gnw/', import.meta.url);
const HOST_JS = new URL('gnw-host.js', BASE);
const CORE_JS = new URL('gwc-core.js', BASE);
const STAMP = new URL('CORE-VERSION.json', BASE);
const FPS = 60;                       // the old window's virtual frame (1000 / 60 ms)
const FRAME_MS = 1000 / FPS;
const FORMAT = 'cw-gnw/1';

/* ------------------------------------------------------------------ the sandbox */
/* The clock the sandbox sees. One running machine per page, so one clock object; the
   core that is running sets it. */
const T = { ms: 0, wall: () => Date.now(), timers: [], seq: 0 };
function vSetTimeout(fn, ms, ...a) { const id = ++T.seq; T.timers.push({ id, due: T.ms + (+ms || 0), fn, a }); return id; }
function vClearTimeout(id) { T.timers = T.timers.filter(t => t.id !== id); }
function runTimers() {
  for (let guard = 0; guard < 256; guard++) {
    let k = -1;
    for (let i = 0; i < T.timers.length; i++) if (T.timers[i].due <= T.ms && (k < 0 || T.timers[i].due < T.timers[k].due)) k = i;
    if (k < 0) return;
    const t = T.timers.splice(k, 1)[0];
    try { typeof t.fn === 'function' && t.fn(...t.a); } catch (_) {}
  }
}
const vPerformance = { now: () => T.ms };
class VDate extends Date {
  constructor(...a) { if (a.length) super(...a); else super(T.wall()); }
  static now() { return T.wall(); }
}
/* A window that keeps what is written to it and answers undefined for anything else; a
   document whose every method is a no-op (the closure's top level only adds listeners). */
function fakeWindow(seed) {
  const o = Object.assign(Object.create(null), seed);
  return new Proxy(o, { get: (t, k) => (k in t ? t[k] : undefined), set: (t, k, v) => { t[k] = v; return true; }, has: () => true });
}
const noop = () => undefined;
const fakeDocument = new Proxy(Object.create(null), {
  get: (t, k) => (k === 'currentScript' || k === 'body' || k === 'head' || k === 'documentElement' ? null : k === 'readyState' ? 'complete' : noop),
});
const SANDBOX_ARGS = ['window', 'document', 'globalThis', 'self', 'fetch', 'addEventListener', 'removeEventListener',
  'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'requestAnimationFrame', 'cancelAnimationFrame',
  'performance', 'Date', 'localStorage', 'sessionStorage', 'location', 'navigator', '__cwExport'];
function runSandboxed(src, win, exp, name) {
  const never = () => new Promise(() => {});
  const fn = new Function(...SANDBOX_ARGS, src + '\n//# sourceURL=' + name);
  fn(win, fakeDocument, win, win, never, noop, noop, vSetTimeout, vClearTimeout, () => 0, noop, () => 0, noop,
    vPerformance, VDate, undefined, undefined, undefined, undefined, exp);
}
const EXPORTS = ['GAMES', 'GAMES_HW_TWINS', 'GnwEmulator', 'GnwDisplay', 'GnwSpeaker', 'KEY_TO_BUTTON', '_serializeCpu', '_restoreCpu', 'KEYS_OVERRIDE'];   // KEYS_OVERRIDE: the art's Keys diagram (art.mjs keysDiagram)
async function text(u) {
  const r = await fetch(u, { cache: 'no-cache' });
  if (!r.ok) throw new CoreError('unsupported', `the Game & Watch engine did not load (${u.pathname.split('/').pop()}: HTTP ${r.status})`);
  return r.text();
}
let engineP = null;
/** The wrapped engine, loaded once per page: { GAMES, GnwEmulator, ..., GWC_CORE, stamp }. */
export function engine() {
  if (engineP) return engineP;
  engineP = (async () => {
    const [coreSrc, hostSrc, stamp] = await Promise.all([text(CORE_JS), text(HOST_JS), fetch(STAMP, { cache: 'no-cache' }).then(r => (r.ok ? r.json() : null)).catch(() => null)]);
    const win = fakeWindow({});
    runSandboxed(coreSrc, win, noop, 'gwc-core.sandbox.js');
    const GWC_CORE = win.GWC_CORE;
    if (!GWC_CORE || typeof GWC_CORE.cpuFor !== 'function') throw new CoreError('unsupported', 'play/gnw/gwc-core.js did not define GWC_CORE');
    const at = hostSrc.lastIndexOf('})();');
    if (at < 0) throw new CoreError('unsupported', 'play/gnw/gnw-host.js no longer ends in its closure; this module needs updating');
    let got = null;
    const hook = `;__cwExport({ ${EXPORTS.map(n => `${n}: typeof ${n} === 'undefined' ? undefined : ${n}`).join(', ')} });\n`;
    const hwin = fakeWindow({ GWC_CORE });
    runSandboxed(hostSrc.slice(0, at) + hook + hostSrc.slice(at), hwin, o => { got = o; }, 'gnw-host.sandbox.js');
    const missing = EXPORTS.filter(n => !got || got[n] === undefined);
    if (missing.length) throw new CoreError('unsupported', 'play/gnw/gnw-host.js no longer holds ' + missing.join(', '));
    return Object.assign({ GWC_CORE, stamp }, got);
  })();
  engineP.catch(() => { engineP = null; });
  return engineP;
}

/* ------------------------------------------------------------------ controls */
/* The old window's key table (KEY_TO_BUTTON, merged with a title's own keyMap) is keyed
   by KeyboardEvent.key; the host maps KeyboardEvent.code. */
function codeOf(k) {
  if (k === ' ') return 'Space';
  if (/^[0-9]$/.test(k)) return 'Digit' + k;
  if (/^[a-zA-Z]$/.test(k)) return 'Key' + k.toUpperCase();
  if (k === 'Control') return null;    // a Ctrl chord is never game input in the host (host.mjs window keys)
  return k;                            // ArrowLeft ...
}
const LABEL = {
  left: 'Left', right: 'Right', up: 'Up', down: 'Down', btn1: 'Button 1', btn2: 'Button 2', btn3: 'Button 3', btn4: 'Button 4',
  hit: 'Hit', open: 'Open', jump: 'Jump', fire: 'Fire', gameA: 'Game A', gameB: 'Game B', time: 'Time', alarm: 'Alarm',
  p2up: 'Up', p2down: 'Down', p2left: 'Left', p2right: 'Right', p2fire: 'Fire',
};
const MODE = ['gameA', 'gameB', 'time', 'alarm'];
const ORDER = ['up', 'down', 'left', 'right', 'btn1', 'btn2', 'btn3', 'btn4', 'hit', 'open', 'jump', 'fire'];
/* The site's pad table for this console (play-pad.js 'gnw') presses by these key codes;
   a control whose first key is one of them answers the pad with no table of its own. */
const PAD_FIRST = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'Digit1', 'Digit2', 'Digit3', 'Digit4'];
const PAD_FIRST_P2 = ['KeyW', 'KeyS', 'KeyA', 'KeyD', 'KeyF'];
const PAD_DEFAULT = { up: ['Up'], down: ['Down'], left: ['Left'], right: ['Right'], gameA: ['Start'], gameB: ['Select'], time: ['LB'], alarm: ['RB'] };

/** Every button name this title's machine actually reads (rows + the two hammer pins). */
function namesOf(game) {
  const s = new Set();
  for (const row of game.inputRows || []) for (const n of Object.keys(row)) s.add(n);
  if (game.hotspots && game.hotspots.left) s.add('left');
  if (game.hotspots && game.hotspots.right) s.add('right');
  return s;
}
function controlsFor(X, game) {
  const names = namesOf(game);
  const map = game.keyMap ? Object.assign({}, X.KEY_TO_BUTTON, game.keyMap) : X.KEY_TO_BUTTON;
  const keys = n => {
    const out = [];
    for (const k of Object.keys(map)) if (map[k].includes(n)) { const c = codeOf(k); if (c && !out.includes(c)) out.push(c); }
    const first = /^p2/.test(n) ? PAD_FIRST_P2 : PAD_FIRST;
    out.sort((a, b) => (first.includes(b) ? 1 : 0) - (first.includes(a) ? 1 : 0));
    /* Micro Vs.: player 1 fires with Right Ctrl in the old window, which the host keeps for
       its own chords; Space and Enter fire instead (the pad's A is Space). */
    if (n === 'fire' && !out.length) out.push('Space', 'Enter');
    return out;
  };
  const def = n => {
    let label = LABEL[n] || n;
    if (n === 'jump' && game.jumpLabel) label = game.jumpLabel;
    if (n === 'fire' && game.fireLabel) label = game.fireLabel;
    if (n === 'p2fire' && game.fireLabel) label = game.fireLabel;
    return { id: n, label, type: 'button', defaults: { key: keys(n), pad: PAD_DEFAULT[n] || [], alias: ['gnw:' + n, n] } };
  };
  const p1 = ORDER.filter(n => names.has(n)).map(def);
  for (const n of names) if (!ORDER.includes(n) && !MODE.includes(n) && !/^p2/.test(n)) p1.push(def(n));
  const p2 = ['p2up', 'p2down', 'p2left', 'p2right', 'p2fire'].filter(n => names.has(n)).map(def);
  const mode = MODE.filter(n => names.has(n)).map(n => Object.assign(def(n), { icon: 'keys' }));
  const ports = [{ port: 0, kind: 'player', device: 'gnw-buttons', label: p2.length ? 'Player 1' : '', controls: p1 }];
  if (p2.length) ports.push({ port: 1, kind: 'player', device: 'gnw-buttons', label: 'Player 2', controls: p2 });
  ports.push({ port: ports.length, kind: 'console', device: 'gnw-mode', label: 'Mode buttons', controls: mode });
  return ports;
}

/* ------------------------------------------------------------------ the game file */
const td = new TextDecoder(), te = new TextEncoder();
const b64of = u => { let s = ''; for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000)); return btoa(s); };
function readGameFile(bytes, name, GAMES) {
  if (bytes && bytes.length && bytes[0] === 0x7B) {          // '{': the relay's container
    let o = null;
    try { o = JSON.parse(td.decode(bytes)); } catch (_) { o = null; }
    if (!o || o.format !== FORMAT || !o.key || !o.program) throw new CoreError('damaged', 'This Game & Watch file is not one this player reads.');
    if (!GAMES[o.key]) throw new CoreError('unsupported', `"${o.key}" is not a Game & Watch unit this player knows.`);
    return { key: o.key, program: o.program, melody: o.melody || null };
  }
  const k = String(name || '').replace(/\.[^.]+$/, '');
  if (GAMES[k] && bytes && bytes.length >= 1024 && bytes.length <= 4096) return { key: k, program: b64of(bytes), melody: null };
  throw new CoreError('damaged', 'Open a Game & Watch unit from the site (its program and melody come from your content pack or game server), or a program file named after its unit, such as ball.bin.');
}

/* ------------------------------------------------------------------ the module */
export const manifest = {
  api: '1.0',
  id: 'gnw',
  label: 'Game & Watch',
  form: 'handheld',
  build: 'play/gnw/gwc-core.js + play/gnw/gnw-host.js',
  thread: 'main',
  files: { game: { exts: ['.json', '.bin'], maxBytes: 64 * 1024 } },
  video: { kind: 'segments', maxWidth: 1600, maxHeight: 1600, screens: 2 },
  audio: { channels: 1, format: 'f32', filtered: true },
  state: { supported: true, deterministic: false, approxBytes: 12000 },
  extensions: ['clock', 'attract', 'debug'],
  modelLabel: m => m || 'Game & Watch',
  /* The old in-page window's slots (gnw-host.js _saveKeyFor: localStorage gnw.saves.<unit>, 12
     slots of { ts, comment, thumb, state: gnwSaveState() }): its state is this module's own
     shape without the format line, which check() accepts. Read in place, never written. */
  legacy: {
    slotsLocal: {
      key: (game, model) => 'gnw.saves.' + model,
      decode: e => ({ ts: e.ts, state: new TextEncoder().encode(JSON.stringify(Object.assign({ format: FORMAT + '-state' }, e.state))), thumb: e.thumb || null }),
    },
  },
};

export async function create(env) {
  const X = await engine();
  const stamp = X.stamp || {};
  let emu = null, key = null, game = null, ids = [], levels = null, ports = [], prevHeld = [];
  /* CHEATS (2026-10-26): the factory test contacts (codes 'gnw-switch': port B, BA or IN.n,
     the bit and its On level). The reference driver numbers the input rows by its own strobe order;
     this player's rows (GAMES inputRows) follow the program's. CHEAT_ROW maps one to the other where
     they differ. 28 Oct 2026: settled by play against the reference with the same schedule
     (switch on after Game A, the same moves): Octopus and Popeye read their switch on row 2 (row 0 does
     not give the reference's result); Lion's mode and button rows are swapped, its switch stays on row 0.
     Parachute's switch is not offered (no effect on the reference; rows 0 and 1 stop the game here). */
  const CHEAT_ROW = { lion: { 1: 2, 2: 1 }, octopus: { 0: 2 }, popeye: { 0: 2 } };
  /* 28 Oct 2026: the same for the two pins. On Manhole (Gold, SM5A) the reference's B contact
     gives what our BA pin gives and its BA contact what our B pin gives, both ways, by play with the same
     schedule; every other unit takes the pins as named. */
  const CHEAT_PIN = { manhole: { B: 'BA', BA: 'B' } };
  let cheatSw = null;
  /* 28 Oct 2026: our own memory cheats (code kind 'gnw-ram': a: RAM nibble 0-127, v: 0-15),
     found by watching the unit's RAM in play. Held at the START of every frame, so the program sees
     the value and the miss or lives counter it would have changed is put back before it runs again. */
  let cheatRam = [];
  let rate = 48000, frames = 0, clockOffset = 0, vinfo = null;
  /* A GAME HAS STARTED (4 Nov 2026: "no auto save unless Game A or Game B started a game, else it
     saves the demo"): false from power-on and Reset until Game A or Game B is pressed; true for a
     loaded save (that is the player's game). The host reads it (core.started) for the Continue row. */
  let started = false;
  const audioBuf = { data: new Float32Array(4096), frames: 0 };
  let pending = [];

  /* The host's clocks, inside the sandbox: emulated ms for the machine, the host's
     virtual wall clock (plus any ext.clock.set offset) for the clock set. */
  const bindClock = () => { T.wall = () => env.now() + clockOffset; };

  /* The fake audio sink GnwEmulator._renderAudioFrame() writes into: the speaker is the
     old window's GnwSpeaker; the samples are collected for the host. */
  function makeAudio() {
    return {
      ctx: true, sampleRate: rate, speaker: new X.GnwSpeaker(rate),
      playSamples(out) { pending.push(out); },
      init() {}, destroy() {},
    };
  }
  /* GnwDisplay, unchanged, over stand-in elements: one per possible address, so the
     charge model runs exactly as in the old window and only its painted state is read. */
  function makeDisplay(cpu) {
    const cBits = game.lcdCBits || 1, mask = (1 << cBits) - 1, bits = (cpu.lcd.BYTES_PER_ELEMENT || 1) * 8;
    ids = [];
    for (let i = 0; i < cpu.lcd.length; i++) for (let b = 0; b < bits; b++) ids.push(`${i >> cBits}.${b}.${i & mask}`);
    const els = ids.map(id => ({ style: {}, querySelector: () => ({ textContent: id }) }));
    levels = new Uint8Array(ids.length);
    return new X.GnwDisplay({ querySelectorAll: () => els }, game.lcdCBits);
  }
  function readLevels() {
    const st = emu.disp.state;
    for (let i = 0; i < ids.length; i++) levels[i] = st.get(ids[i]) ? 255 : 0;
  }
  /* After a load: no charge history, so each segment shows what the plane drives now. */
  function settleDisplay() {
    const d = emu.disp, cpu = emu.cpu, cBits = d.cBits;
    emu.cpu.updateLcd();
    d.map.forEach((el, id) => {
      const [A, B, C] = id.split('.').map(Number);
      const on = !!((cpu.lcd[(A << cBits) | C] >> B) & 1);
      const row1 = C === 1 && cBits === 1;
      d.charge.set(id, on ? (row1 ? d.capMsRow1 : d.capMs) : 0);
      d.state.set(id, on);
    });
    readLevels();
  }
  function videoInfo() {
    // The screen box(es) on the art, in art pixels: the presenter's canvas has this shape.
    const [aw, ah] = String(game.unitAspect || '2227 / 1500').split('/').map(parseFloat);
    const boxes = [game.screen, game.screen2].filter(Boolean);
    const l = Math.min(...boxes.map(b => b.left)), t = Math.min(...boxes.map(b => b.top));
    const r = Math.max(...boxes.map(b => b.left + b.width)), btm = Math.max(...boxes.map(b => b.top + b.height));
    const scale = 1600 / Math.max(aw * (r - l) / 100, ah * (btm - t) / 100);
    return { width: Math.max(16, Math.round(aw * (r - l) / 100 * scale)), height: Math.max(16, Math.round(ah * (btm - t) / 100 * scale)),
      format: 'segments', pixelAspect: 1, rotation: 0, segments: { ids, screens: boxes.length } };
  }

  /* A press and a release, exactly as the old window's on-screen buttons make them
     (window.gnwPress / gnwRelease): the first real press ends the demo; Game A / B and
     Time take the reset-with-button-held path; a release keeps the title's minimum hold. */
  function press(n) {
    emu.stopAttract();
    emu._kButtons[n] = true;
    emu._bumpReleaseToken(n);
    if (n === 'gameA' || n === 'gameB') started = true;
    if (n === 'gameA' || n === 'gameB' || n === 'time') emu._resetWithButtonHeld();
  }
  function release(n) {
    const e = emu;
    e._delayedRelease(n, e._needsMinHold(n), () => { delete e._kButtons[n]; });
  }
  function boot(attract) {
    T.timers = []; T.ms = 0; bindClock();
    if (emu) { try { emu.stop(); } catch (_) {} }
    emu = new X.GnwEmulator(key, { audio: false });
    emu.audio = makeAudio();
    emu._sharedLoop = true;              // never schedules a frame of its own
    emu.disp = makeDisplay(emu.cpu);
    emu.start();                          // the clock set: 300 boot cycles, then the time poked in
    emu._running = true;
    if (attract !== false) emu.startAttract();
    started = false;
    prevHeld = ports.map(() => 0);
    readLevels();
  }

  const core = {
    info: { build: (stamp.sha256 ? 'gwc-core ' + String(stamp.sha256).slice(0, 12) : 'gwc-core') + ' + gnw-host' },

    load(req) {
      const f = readGameFile(req.game.bytes, req.game.name, X.GAMES);
      key = f.key; game = X.GAMES[key];
      game.programB64 = f.program;
      if (f.melody) game.melodyB64 = f.melody; else delete game.melodyB64;
      rate = Math.round((env.audioRate && env.audioRate()) || 48000);
      ports = controlsFor(X, game);
      clockOffset = 0;
      try { boot(true); }
      catch (e) { throw new CoreError('unsupported', String(e && e.message || e)); }
      frames = 0;
      vinfo = videoInfo();
      return {
        fps: FPS,
        video: vinfo,
        audio: { rate },
        ports,
        battery: [],
        options: [],
        extensions: { clock: true, attract: true, debug: true },
        attract: true,
        model: key,
        note: '',
      };
    },
    /* The Control Bar's Reset is the unit's ACL: a power-on with the clock set again
       (GnwEmulator.resetGame, the old window's Reset), then the demo, as on opening. */
    reset() {
      if (!emu) return;
      bindClock();
      emu.resetGame();
      emu.startAttract();
      started = false;
    },
    setInput(port, s) {
      const p = ports.findIndex(x => x.port === port);
      if (p < 0 || !emu) return;
      const was = prevHeld[p] || 0, now = s.buttons | 0;
      if (was === now) return;
      ports[p].controls.forEach((c, bit) => {
        const m = 1 << bit;
        if ((now & m) && !(was & m)) press(c.id);
        else if (!(now & m) && (was & m)) release(c.id);
      });
      prevHeld[p] = now;
    },
    runFrame() {
      if (!emu) { audioBuf.frames = 0; return; }
      if (emu.cheatSwitches !== cheatSw) emu.cheatSwitches = cheatSw;   // a new unit or a fresh boot keeps the switches
      bindClock();
      T.ms += FRAME_MS;
      runTimers();
      emu.raf = null;
      for (const w of cheatRam) emu.cpu.ram[w.a] = w.v;                 // our memory cheats (empty: nothing happens)
      emu._frame(T.ms);
      frames++;
      readLevels();
      // The samples this frame made, gathered into one block.
      let n = 0; for (const p of pending) n += p.length;
      if (audioBuf.data.length < n) audioBuf.data = new Float32Array(n * 2);
      let o = 0; for (const p of pending) { audioBuf.data.set(p, o); o += p.length; }
      audioBuf.frames = n; pending = [];
    },
    video() { return { format: 'segments', width: vinfo.width, height: vinfo.height, stride: vinfo.width, data: levels, levels }; },
    audio() { return audioBuf; },

    serialize() {
      if (!emu) throw new CoreError('unsupported', 'nothing is running');
      const st = { format: FORMAT + '-state', key, ts: Math.round(env.now()), cpu: X._serializeCpu(emu.cpu), lcd: Array.from(emu.cpu.lcd), frames };
      return te.encode(JSON.stringify(st));
    },
    check(b) {
      if (!emu) throw new CoreError('unsupported', 'nothing is running');
      let o = null;
      try { o = JSON.parse(td.decode(b)); } catch (_) { o = null; }
      if (!o || !o.cpu) throw new CoreError('wrong-core', 'This is not a Game & Watch save from this player.');
      if (o.key && o.key !== key) throw new CoreError('wrong-game', 'This save belongs to another Game & Watch unit.');
      return o;
    },
    unserialize(b) {
      const o = core.check(b);
      // A loaded game is the player's: the demo stops, no hold of ours survives it.
      emu.stopAttract();
      started = true;
      emu._flushPendingReleases();
      T.timers = [];
      emu._kButtons = Object.create(null);
      emu.keys = Object.create(null);
      X._restoreCpu(emu.cpu, o.cpu);
      emu._prevInRows = null;
      emu._commitAssistActive = false;
      if (typeof o.frames === 'number') frames = o.frames;
      prevHeld = ports.map(() => 0);
      settleDisplay();
    },
    ext: {
      /* Cheats: the factory test contacts, held for as long as they are on. */
      cheats: {
        kinds: () => ['gnw-switch', 'gnw-ram'],
        apply(codes) {
          const sw = { rows: {} }, ram = [];
          let any = false;
          for (const c of codes || []) {
            if (c && c.k === 'gnw-ram') { ram.push({ a: (c.a | 0) & 0x7f, v: (c.v | 0) & 0x0f }); continue; }
            if (!c || c.k !== 'gnw-switch') return { ok: false, why: 'This code type does not run on this console.' };
            const m = c.mask & 0x0f, v = c.v & 0x0f;
            if (c.port === 'B' || c.port === 'BA') { sw[(CHEAT_PIN[key] && CHEAT_PIN[key][c.port]) || c.port] = v & 1; any = true; continue; }
            const r = /^IN\.(\d)$/.exec(String(c.port || ''));
            if (!r) return { ok: false, why: 'Unknown switch.' };
            const i = (CHEAT_ROW[key] && CHEAT_ROW[key][r[1]] != null) ? CHEAT_ROW[key][r[1]] : +r[1];
            const was = sw.rows[i] || { m: 0, v: 0 };
            sw.rows[i] = { m: was.m | m, v: (was.v & ~m) | (v & m) }; any = true;
          }
          cheatSw = any ? sw : null;
          cheatRam = ram;
          if (emu) emu.cheatSwitches = cheatSw;
          return { ok: true, patches: 0, writes: ram.length, max: 0 };
        },
      },
      /* The clock set: the old window copies the browser's time into the title's own
         clock RAM cells at boot (GnwEmulator._syncClockToNow). This moves that time. */
      clock: { set(ms) { clockOffset = ms - env.now(); bindClock(); if (emu) emu._pokeClockRam(); } },
      /* The demo the old window runs on opening (GnwEmulator.startAttract), from a fresh boot. */
      attract: { start() { if (key) boot(true); } },
      /* Console diagnostics (window.gnwPeekRam in the old window). */
      debug: { peek: a => (emu ? emu.cpu.ram[a & 0x7f] & 0xf : null), pc: () => (emu ? emu.cpu.pc : null), trace() {} },
    },
    /** The button names held right now, as the machine sees them (the art's press glow). */
    pressed() {
      if (!emu) return [];
      const out = [], cpu = emu.cpu, swap = !!game.swapHammers;
      for (const n of namesOf(game)) {
        const pins = emu._hammerArt || cpu;   // the player's press, not a held test contact
        // (1 Nov 2026): Left / Right that are input-row buttons (Balloon Fight, Micro Vs., the Table
        // Tops...) are not the hammer pins: read them as held, as every other row button is.
        const pin = (n === 'left' || n === 'right') && !(game.inputRows || []).some(r => n in r);
        const on = !pin ? emu._held(n) : n === 'left' ? (swap ? pins.inBA === 0 : pins.inB === 0) : (swap ? pins.inB === 0 : pins.inBA === 0);
        if (on) out.push(n);
      }
      return out;
    },
    get model() { return key; },
    get game() { return game; },
    get frames() { return frames; },
    get demo() { return !!(emu && emu._attractActive); },
    get started() { return started; },
    details() {
      return `Game & Watch: ${game.title} (${game.subtitle}), ${game.cpuType || 'sm5a'}, ${ids.length} segment addresses, `
        + `core ${stamp.sha256 ? String(stamp.sha256).slice(0, 12) : 'unstamped'} (${(stamp.routedCleanCount || '?')} of ${(stamp.of || '?')} routed clean), speaker ${rate} Hz`;
    },
    destroy() { if (emu) { try { emu.stop(); } catch (_) {} } emu = null; key = null; T.timers = []; },
  };
  return core;
}
