/*
 * play/cores/tft/core.mjs -- the two 35th-anniversary colour units, Super Mario Bros.
 * (HXA-001) and The Legend of Zelda (HXB-001), for the one play host (Core API 1.0).
 * Started 2026-10-14 in the Tetris Jr. and colour-unit migration (unified UI, phase 5).
 *
 * WRAPS, UNCHANGED: play/twin.js, the ARM digital twin (an STM32H7B0 / Cortex-M7 model with
 * its WASM Thumb-2 hot loop), built from WASM_Source/twin-emulator-js. The boot recipe is
 * the old worker's (play/twin-worker.js setupCommon / bootRetail), step for step.
 *
 * FILES (Core API LoadRequest): the unit's two flash images, which only the player supplies
 * (a content pack, or the HXA-001 / HXB-001 device zip on a game server; cws.js gnwTft):
 *   game                 the external (OSPI) flash: 1 MiB on Mario, 4 MiB on Zelda; the
 *                        size says which unit it is, so a renamed file still boots right;
 *   firmware '<unit>:internal'  the MCU's own 128 KiB flash.
 * The host checks both against the not-supported list before they reach here.
 *
 * A PURE MACHINE. twin.js is loaded as text and run with its own globals (no page, no
 * worker, no timers). Time is cycles: one host frame is 1/60 s of the unit's own clock
 * (coreClockHz / ipc cycles per firmware-second, the basis its LTDC and audio already
 * use), and the real-time clock reads the host's virtual clock (env.now()) through the
 * twin's own RTC anchor (rtcBaseMs + cycles / rtcCPS), so it stops while paused and comes
 * back with a state. The WASM core is compiled ahead (WebAssembly.compile), because a
 * page's main thread may not compile a module that size synchronously; twin.js is handed
 * the compiled module, and falls back to its JS block-JIT exactly as before if that fails.
 *
 * THE SCREEN until the clock is built: black, as the old window's cover did (twin-worker.js
 * _READY_CYCLES: 15 M cycles, Zelda 115 M after its scripted TIME press), so the firmware's
 * boot and Zelda's "PRESS TIME BUTTON" are never shown. Declared as ext.bootGate as well.
 *
 * SOUND (2026-10-28): the firmware's own SAI stream at the rate the firmware programs,
 * 48,004 Hz on both units, derived by the twin from the RCC/SAI registers when the firmware arms
 * its audio DMA (load() pre-rolls the machine to that moment, 0.2 s of its time, so the rate is
 * known when it is reported). Until this date the twin paced the stream at an assumed 22,050 Hz
 * and the page played it at 22,050: every note 13.5 semitones low, the lead buried, "static-like".
 * The play chain (makeChain) runs at that rate, one sample in, one out: a 50 Hz DC blocker, a gain
 * per unit (measured on long gameplay passages, headroom kept), a band limit at 10 kHz (two
 * biquads; a listening test preferred the stream band-limited there to the raw one, and the unit's own
 * speaker passes little above 8 kHz) and a hard clamp. No transducer model: the real amplifier and
 * speaker are clean, and the old model was built to explain a symptom that was the 22,050 cadence.
 * The faithful path is the core's (Core API 3.1 principle 5), so the host adds no DC block of its own.
 *
 * THE PACE (2026-11-01): the twin's cycles-per-instruction constant (cpu.ipc, play/twin.js)
 * is 1.2, not 1.44. At 1.44 the Zelda unit's firmware fell short of 60 frames a second in its NES
 * emulation and starved its own sound ring: its DMA handler then plays a 240-sample silence buffer,
 * a 5 ms hole about five times a second on Zelda I's title and fifteen on Zelda II's (the
 * "helicopter"). The constant is the twin's; this module only reasserts it on a loaded state, since
 * a state carries the constant it was saved with (unserialize).
 *
 * THE FRAME LOCK (2026-11-02): the twin's LTDC reload now completes at the next vblank of
 * its 60 Hz grid (twin.js, the LTDC_SRCR handler), so the firmware's frame loop waits for the panel as
 * on the unit. Until then it free-ran at whatever the pace allowed: 1.44 gave Mario about 61 game
 * frames a second and Zelda 57 (the silence buffers above), and 1.2 gave both 20 percent too many, the
 * surplus sound thrown away one sample at the end of most 240-sample buffers (a 200 Hz comb, "an
 * undertone of crackle"). Locked, the game runs 60 frames a second, the tempo is the panel's, the
 * stream is the same at every pace with headroom (1.3 and 1.2 byte-identical), and the pace is only
 * headroom. A state saved before 2 Nov loads onto the locked grid (unserialize re-arms it anyway).
 *
 * THE CLOCK after a state is loaded (Continue, a slot, a rewind step) goes to the real time,
 * as the real unit's clock keeps running while it is off (decided
 * 2026-10-14; the Pokemon mini does the same): the RTC anchor is moved to env.now() as the
 * next frame starts.
 */
import { CoreError } from '../../host/core-api.mjs';
import { makeComposer } from './compose.mjs?v=2.1.0';
import { makeJit } from './jit.mjs?v=2.1.0';

const UNITS = {
  mario: { label: 'Super Mario Bros. (HXA-001)', external: 1048576, readyCycles: 15000000 },
  zelda: { label: 'The Legend of Zelda (HXB-001)', external: 4194304, readyCycles: 115000000 },
};
const INTERNAL = 131072;
const FPS = 60;
const SLICE = 200000;                       // the old worker's cpu.run() slice
const W = 320, H = 240;

function unitOf(name, bytes) {
  const n = String(name || '').toLowerCase();
  for (const u of Object.keys(UNITS)) if (bytes && bytes.length === UNITS[u].external) return u;
  if (/zelda|hxb/.test(n)) return 'zelda';
  if (/mario|hxa/.test(n)) return 'mario';
  return null;
}

export const manifest = {
  api: '1.0',
  id: 'tft',
  label: 'Game & Watch colour unit',
  form: 'handheld',
  build: 'play/twin.js',
  thread: 'worker',                         // 2026-10-15: back on the worker after the sliced translation builds: gate T 19/19, 60 fps both threads, 0 drops, 0 gaps; ?thread=main for the A/B
  files: {
    game: { exts: ['.bin'], maxBytes: 4194304 },
    firmware: [
      { id: 'mario:internal', label: 'Super Mario Bros. colour unit, internal flash', bytes: INTERNAL, required: 'always' },
      { id: 'zelda:internal', label: 'The Legend of Zelda colour unit, internal flash', bytes: INTERNAL, required: 'always' },
    ],
  },
  /* Only the unit's own internal flash is asked for (the host's firmwareFor hook). */
  firmwareFor: bytes => { const u = unitOf('', bytes); return u ? [u + ':internal'] : []; },
  video: { kind: 'raster', maxWidth: W, maxHeight: H, screens: 1 },
  audio: { channels: 1, format: 'f32', filtered: true },     // the chain's own DC blocker; the standard worker queue (host.mjs WORKER_AUDIO_MS), as every other console (2 Nov 2026: the adaptive queue of 29 Oct / 1 Nov is gone)
  state: { supported: true, deterministic: true, approxBytes: 2700000 },
  extensions: ['clock', 'bootGate'],
  modelLabel: m => (UNITS[m] ? UNITS[m].label : 'Game & Watch colour unit'),
  /* The old window's slots (IndexedDB twin-saves / saves, one record per slot keyed
     '<unit>:<slot>', 4 slots: { unit, slot, snap: the twin's own snapshot, thumb: { w, h, rgba },
     time }): wrapped as this module's state; the clock goes to the real time on load, as for any
     state here. Read in place, never written. */
  legacy: {
    db: 'twin-saves', version: 1, store: 'saves',
    slotsEach: {
      count: 4,
      key: (game, model, i) => `${model}:${i}`,
      decode: r => (r && r.snap ? { ts: r.time, thumbRgba: r.thumb || null, state: pack({ core: 'tft', unit: r.unit, frames: 0, debt: 0, ready: true, held: [0, 0], snap: r.snap }) } : null),
    },
  },
};

/* Bit order = control order. Keys are the old window's KEYMAP (twin-harness.js), whose Q / E
   and [ / ] aliases are kept as second keys; pad defaults follow play-pad.js MAPS.twin. */
const PAD = [
  { id: 'up', label: 'Up', type: 'button', defaults: { key: ['ArrowUp'], pad: ['Up'] } },
  { id: 'down', label: 'Down', type: 'button', defaults: { key: ['ArrowDown'], pad: ['Down'] } },
  { id: 'left', label: 'Left', type: 'button', defaults: { key: ['ArrowLeft'], pad: ['Left'] } },
  { id: 'right', label: 'Right', type: 'button', defaults: { key: ['ArrowRight'], pad: ['Right'] } },
  { id: 'a', label: 'A', type: 'button', defaults: { key: ['KeyX', 'KeyE'], pad: ['A', 'X'] } },
  { id: 'b', label: 'B', type: 'button', defaults: { key: ['KeyZ', 'KeyQ'], pad: ['B', 'Y'] } },
];
/* Zelda's shell has Select and Start; Mario's has neither (its firmware ignores the pins). */
const ZELDA_EXTRA = [
  { id: 'select', label: 'Select', type: 'button', defaults: { key: ['ShiftRight', 'BracketLeft'], pad: ['Select'] } },
  { id: 'start', label: 'Start', type: 'button', defaults: { key: ['Enter', 'NumpadEnter', 'BracketRight'], pad: ['Start'] } },
];
const CONSOLE = [
  { id: 'game', label: 'Game', type: 'button', defaults: { key: ['Digit1'], pad: ['LB'] } },
  { id: 'time', label: 'Time', type: 'button', defaults: { key: ['Digit3'], pad: ['RB'] } },
  { id: 'pause', label: 'Pause', type: 'button', defaults: { key: ['Digit2'], pad: ['LT'] } },
  { id: 'power', label: 'Power', type: 'button', icon: 'power', defaults: { key: ['KeyP'] } },
];

/* ---------------------------------------------------------------- the engine, once per page */
let engine = null;
async function loadEngine() {
  if (engine) return engine;
  const r = await fetch(new URL('../../twin.js?v=2.1.0', import.meta.url));
  if (!r.ok) throw new CoreError('unsupported', `the colour-unit engine did not load (HTTP ${r.status})`);
  const src = await r.text();
  // The WASM CPU core twin.js carries (its own build, not firmware), compiled off the main
  // thread's synchronous path.
  let module = null;
  try {
    const m = /var __WASM_B64="([A-Za-z0-9+/=]+)"/.exec(src);
    if (m) { const s = atob(m[1]), u = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i); module = await WebAssembly.compile(u); }
  } catch (_) { module = null; }
  engine = { src, module };
  return engine;
}

/* The play chain (2026-10-28), at the twin's own rate, one sample in, one out:
   DC blocker (one pole, 50 Hz) -> gain -> band limit (two biquads, a 4th-order Butterworth low-pass
   at 10 kHz) -> soft knee above 0.8 -> hard clamp. The input is the firmware's raw 16-bit sample.
   GAIN is per unit, from the firmware's own output level (Mario's firmware boots at its quiet
   volume setting, 10/128 of full scale; Zelda's output is 3.7 times larger), set so 30 s of
   gameplay peaks near 0.8 and sits near -15 dBFS (the loudness chosen by ear): Mario 21/32768,
   Zelda 4.5/32768, measured in the final site WAV captures. The knee (static, no attack or release,
   so nothing pumps) only touches the few things that would pass full scale, such as the Mario
   clock tick (a 2,800-count jump, 1.35 at this gain); gameplay stays below it. */
const GAIN = { mario: 21 / 32768, zelda: 4.5 / 32768 };
const LP_HZ = 10000, DC_HZ = 50, KNEE = 0.8;
function makeChain(rate, gain) {
  const bq = (q) => { const w0 = 2 * Math.PI * LP_HZ / rate, c = Math.cos(w0), s = Math.sin(w0), al = s / (2 * q), a0 = 1 + al; return { b0: (1 - c) / 2 / a0, b1: (1 - c) / a0, b2: (1 - c) / 2 / a0, a1: -2 * c / a0, a2: (1 - al) / a0, x1: 0, x2: 0, y1: 0, y2: 0 }; };
  const R = 1 - 2 * Math.PI * DC_HZ / rate;
  const st = { x1: 0, y1: 0, init: false, s1: bq(0.5412), s2: bq(1.3066) };
  let out = new Float32Array(4096);
  const run1 = (s, y) => { const z = s.b0 * y + s.b1 * s.x1 + s.b2 * s.x2 - s.a1 * s.y1 - s.a2 * s.y2; s.x2 = s.x1; s.x1 = y; s.y2 = s.y1; s.y1 = z; return z; };
  return {
    rate, gain,
    run(input, n) {
      if (out.length < n) out = new Float32Array(n * 2);
      let x1 = st.x1, y1 = st.y1; const s1 = st.s1, s2 = st.s2;
      for (let i = 0; i < n; i++) {
        const x = input[i];
        if (!st.init) { st.init = true; x1 = x; }
        const y = x - x1 + R * y1; x1 = x; y1 = y;
        let w = run1(s2, run1(s1, y * gain));
        const aw = w < 0 ? -w : w;
        if (aw > KNEE) { const k = KNEE + (1 - KNEE) * Math.tanh((aw - KNEE) / (1 - KNEE)); w = w < 0 ? -k : k; }
        out[i] = w > 1 ? 1 : (w < -1 ? -1 : w);
      }
      st.x1 = x1; st.y1 = y1;
      return out;
    },
    /* The chain's own state, so a loaded state sounds the same sample for sample as the moment it
       was taken. */
    save() { return { x1: st.x1, y1: st.y1, init: st.init, s1: [st.s1.x1, st.s1.x2, st.s1.y1, st.s1.y2], s2: [st.s2.x1, st.s2.x2, st.s2.y1, st.s2.y2] }; },
    load(o) {
      if (!o || !Array.isArray(o.s1) || !Array.isArray(o.s2)) return;        // a state from the old chain: start clean
      st.x1 = +o.x1 || 0; st.y1 = +o.y1 || 0; st.init = !!o.init;
      [st.s1.x1, st.s1.x2, st.s1.y1, st.s1.y2] = o.s1; [st.s2.x1, st.s2.x2, st.s2.y1, st.s2.y2] = o.s2;
    },
  };
}

/* WHAT THE TWIN'S OWN snapshot() LEAVES OUT (found 2026-10-15: a loaded state did not replay
   the same frames, 545 of 600 on Mario, nor the same sound): every plain field of the
   peripherals, the CPU and the battery (the LTDC shadow registers the picture is scanned
   from, the DMA2D colour tables, the audio stream's schedule anchors, the standby flag, the
   pending-event cycles ...), and which of the CPU's scheduled events were armed (its
   restore() arms all three, so an LTDC vblank that was not due fires). Saved beside the
   twin's snapshot and put back after its restore(); the twin is not changed. Fields that are
   only caches of the interpreter are left alone, as restore() rebuilds them. */
/* (2026-10-18) The interpreter's region caches (_fetchR, _cr, _tr, _dr, _dw, _itcm) are
   left out too: restore() sets them to null, so a state saved right after a load carried
   "_fetchR": null where the running machine has a region object (not saved), and the state's
   JSON grew by a few bytes, moving every memory block after it (a read-back measured as 391,188
   of 2,920,448 bytes differing while no byte of memory differed). */
const CPU_CACHES = new Set(['_jitReady', '_hasItcmBlocks', '_nvicDirty', 'stopReason', '_fetchR', '_cr', '_tr', '_dr', '_dw', '_itcm']);
const plain = v => typeof v === 'number' || typeof v === 'boolean' || typeof v === 'string' || v === null;
function saveExtra(cpu, periph) {
  const P = {}, C = {}, B = {};
  for (const k of Object.keys(periph)) {
    const v = periph[k];
    if (k === 'store' || k === '_timers' || k === 'log' || k === 'pages') continue;      // the twin's own, or diagnostics
    if (k === '_ltdcAnchor' && v == null) continue;   // null means not anchored, as absent does (the twin's snapshot keeps it)
    if (plain(v)) P[k] = v;
    else if (v instanceof Map) P[k] = { __map: Array.from(v) };
    else if (Array.isArray(v) && v.every(x => typeof x === 'number')) P[k] = { __arr: v.slice() };
    else if (k === 'input' || k === '_otfdecEnabled' || k === '_cryp') P[k] = { __obj: v == null ? null : JSON.parse(JSON.stringify(v)) };
  }
  for (const k of Object.keys(cpu)) { const v = cpu[k]; if (plain(v) && !CPU_CACHES.has(k)) C[k] = v; }
  const bt = periph.battery; if (bt) for (const k of Object.keys(bt)) if (plain(bt[k])) B[k] = bt[k];
  const armed = { rtc: !!cpu.rtcCallback, ltdc: !!cpu.ltdcCallback, dma: !!cpu.dmaCallback };
  return { P, C, B, armed };
}
function loadExtra(cpu, periph, x, snapPeriph) {
  if (!x) return;
  for (const k of Object.keys(x.P)) {
    const v = x.P[k];
    if (v && typeof v === 'object') {
      if (v.__map) periph[k] = new Map(v.__map);
      else if (v.__arr) { if (Array.isArray(periph[k])) { periph[k].length = 0; periph[k].push(...v.__arr); } else periph[k] = v.__arr.slice(); }
      else if ('__obj' in v) periph[k] = v.__obj;
    } else periph[k] = v;
  }
  const keepCb = { rtc: cpu.rtcCallback, ltdc: cpu.ltdcCallback, dma: cpu.dmaCallback };
  for (const k of Object.keys(x.C)) cpu[k] = x.C[k];
  if (periph.battery) for (const k of Object.keys(x.B)) periph.battery[k] = x.B[k];
  // The scheduled events: armed exactly as they were (restore() armed all three).
  if (!x.armed.rtc) cpu.rtcCallback = null; else if (!keepCb.rtc) periph._armRtcWakeup();
  if (!x.armed.ltdc) cpu.ltdcCallback = null; else if (!keepCb.ltdc) periph._scheduleLtdcVblank();
  if (!x.armed.dma) cpu.dmaCallback = null; else if (!keepCb.dma) periph._armDmaStream6();
  // The armings above may have moved a due cycle: the saved ones stand.
  cpu.rtcDueCycle = x.C.rtcDueCycle; cpu.ltdcDueCycle = x.C.ltdcDueCycle; cpu.dmaDueCycle = x.C.dmaDueCycle;
  // (2026-10-18) And the vblank grid's anchor: restore() re-anchors it at the loaded cycle
  // (the retail engine never anchors it while running, so it was null when saved); the saved value stands.
  if (snapPeriph && 'ltdcAnchor' in snapPeriph) periph._ltdcAnchor = snapPeriph.ltdcAnchor;
}

/* A state as bytes: 'CWTF', version, JSON length, the JSON (typed arrays replaced by
   references), then every typed array's bytes in order. */
const MAGIC = 0x46545743, SVER = 1;
const TA = { Uint8Array, Int8Array, Uint16Array, Int16Array, Uint32Array, Int32Array, Float32Array, Float64Array, Uint8ClampedArray };
/* `size`: the whole state is padded to this many bytes when it fits, so every state of a
   machine is one length (the host's rewind ring codes each against the last by XOR, and
   starts its history again whenever the length changes; play/host/rewind-worker.js). */
function pack(obj, size = 0) {
  const bins = [];
  const json = JSON.stringify(obj, (k, v) => {
    if (ArrayBuffer.isView(v)) { bins.push(new Uint8Array(v.buffer, v.byteOffset, v.byteLength)); return { __bin: bins.length - 1, t: v.constructor.name }; }
    if (v instanceof ArrayBuffer) { bins.push(new Uint8Array(v)); return { __bin: bins.length - 1, t: 'ArrayBuffer' }; }
    return v;
  });
  const jb = new TextEncoder().encode(json);
  const lens = bins.map(b => b.length);
  const head = 16 + lens.length * 4;
  let total = head + jb.length; for (const n of lens) total += n;
  if (size > total) total = size;
  const out = new Uint8Array(total), dv = new DataView(out.buffer);
  dv.setUint32(0, MAGIC, true); dv.setUint32(4, SVER, true); dv.setUint32(8, jb.length, true); dv.setUint32(12, lens.length, true);
  lens.forEach((n, i) => dv.setUint32(16 + i * 4, n, true));
  out.set(jb, head);
  let o = head + jb.length; for (const b of bins) { out.set(b, o); o += b.length; }
  return out;
}
function unpack(b) {
  if (!b || b.length < 16) throw new CoreError('damaged', 'This is not a colour-unit save state.');
  const dv = new DataView(b.buffer, b.byteOffset, b.byteLength);
  if (dv.getUint32(0, true) !== MAGIC) throw new CoreError('damaged', 'This is not a colour-unit save state.');
  if (dv.getUint32(4, true) !== SVER) throw new CoreError('wrong-core', `This save is format ${dv.getUint32(4, true)}; this player reads format ${SVER}.`);
  const jl = dv.getUint32(8, true), nb = dv.getUint32(12, true), head = 16 + nb * 4;
  if (b.length < head + jl) throw new CoreError('damaged', 'This save is cut short.');
  const lens = []; for (let i = 0; i < nb; i++) lens.push(dv.getUint32(16 + i * 4, true));
  const offs = []; let o = head + jl; for (const n of lens) { offs.push(o); o += n; }
  if (o > b.length) throw new CoreError('damaged', 'This save is cut short.');
  const json = new TextDecoder().decode(b.subarray(head, head + jl));
  return JSON.parse(json, (k, v) => {
    if (v && typeof v === 'object' && typeof v.__bin === 'number') {
      const raw = b.slice(offs[v.__bin], offs[v.__bin] + lens[v.__bin]);
      if (v.t === 'ArrayBuffer') return raw.buffer;
      const C = TA[v.t] || Uint8Array;
      return new C(raw.buffer, 0, raw.byteLength / C.BYTES_PER_ELEMENT);
    }
    return v;
  });
}

export async function create(env) {
  const E = await loadEngine();
  /* twin.js, run with its own window and a WebAssembly whose Module and Instance hand over
     what was compiled and instantiated ahead. A spare instance is made after each use. */
  let spare = null, spareBusy = null;
  const makeSpare = () => { if (!E.module || spare || spareBusy) return; spareBusy = WebAssembly.instantiate(E.module, {}).then(i => { spare = i; spareBusy = null; }, () => { spareBusy = null; }); };
  makeSpare();
  if (spareBusy) await spareBusy;
  const RealWasm = WebAssembly;
  const Wasm = {
    instantiate: RealWasm.instantiate, compile: RealWasm.compile, Memory: RealWasm.Memory,
    Module: function () { if (!E.module) throw new Error('no compiled core'); return E.module; },
    Instance: function () { if (!spare) throw new Error('no instance ready'); const i = spare; spare = null; makeSpare(); return i; },
  };
  const scope = {};
  // eslint-disable-next-line no-new-func
  new Function('window', 'WebAssembly', E.src)(scope, Wasm);
  const AT = scope.ArmTwin;
  if (!AT || typeof AT.loadUnit !== 'function') throw new CoreError('unsupported', 'the colour-unit engine did not define ArmTwin');

  let machine = null, cpu = null, bus = null, periph = null, unit = null, req = null;
  let cps = 61111111, perFrame = 0, debt = 0, frames = 0, composedAt = -1, ready = false;
  const rgba = new Uint8Array(W * H * 4), black = new Uint8Array(W * H * 4);
  for (let i = 3; i < black.length; i += 4) black[i] = 255;
  let audioQ = new Float32Array(4096), audioN = 0;
  const audioOut = { data: new Float32Array(4096), frames: 0 };
  let held = [0, 0], ports = [], stateSize = 0, clockDue = false, jit = null, jitWasLive = false;
  /* A game has started (4 Nov 2026): false from power-on (the clock) until the unit's own Game
     button is pressed, true for a loaded save. The host reads core.started so the Continue row
     never keeps the clock screen as a game. */
  let started = false;
  let chain = null;                            // the play chain, made in boot() once the rate is known
  let pace = 0;                                // the twin's cycles-per-instruction constant (cpu.ipc) of a fresh machine
  const composer = makeComposer(AT);           // the twin's scan-out, faster, same bytes (compose.mjs)

  function realHz() { return (periph && periph.coreClockHz && cpu && cpu.ipc) ? periph.coreClockHz / cpu.ipc : 61.1e6; }
  function onAudio(samples, count) {
    if (audioN + count > audioQ.length) { const q = new Float32Array(Math.max(audioQ.length * 2, audioN + count)); q.set(audioQ.subarray(0, audioN)); audioQ = q; }
    for (let i = 0; i < count; i++) audioQ[audioN + i] = samples[i];       // the raw 16-bit samples; the chain scales them
    audioN += count;
  }
  function boot(r) {
    const bytes = r.game.bytes;
    unit = unitOf(r.game.name, bytes);
    if (!unit) throw new CoreError('wrong-game', 'This is not the external flash of a Super Mario Bros. (1 MiB) or Zelda (4 MiB) colour unit.');
    if (bytes.length !== UNITS[unit].external) throw new CoreError('damaged', `The external flash for this unit is ${UNITS[unit].external} bytes; this file is ${bytes.length}.`);
    const internal = r.firmware && r.firmware[unit + ':internal'];
    if (!internal) throw new CoreError('needs-firmware', `The ${UNITS[unit].label} needs its internal flash as well. Add the unit's device zip on your game server, or open a content pack that holds it.`);
    if (internal.length !== INTERNAL) throw new CoreError('damaged', `The internal flash is ${INTERNAL} bytes; this file is ${internal.length}.`);
    // Copies: the twin patches the internal image and decrypts the external one in place.
    const fw = { internal: new Uint8Array(internal), external: new Uint8Array(bytes) };
    machine = AT.loadUnit(fw, { axiSramMB: 2, unit });
    cpu = machine.cpu; bus = machine.bus; periph = machine.periph;
    pace = cpu.ipc;
    // twin-worker.js setupCommon, with the host's clock for the wall clock.
    cps = realHz();
    periph.rtcBaseMs = env.now();
    periph.rtcCPS = cps;
    periph.wakeStandby = true;
    periph.pressPower = true; periph.pwrPressStart = 2000000; periph.pwrPressEnd = 4000000;
    periph.input = { power: false, time: false, game: false, a: false, b: false, up: false, down: false, left: false, right: false, pause: false, select: false, start: false };
    periph.logging = false;
    periph.onAudioSample = onAudio;
    // Zelda cold-boots to "PRESS TIME BUTTON" and waits for a fresh TIME edge (bootRetail).
    if (unit === 'zelda') { periph.pressTime = true; periph.timePressStart = 52000000; periph.timePressEnd = 60000000; }
    cpu.reset();
    /* Block translation of the ITCM code (jit.mjs): the interpreter stays the fallback. Off
       with { jit: false } in the load options (tests, and a way back). */
    jit = (r.options && r.options.jit === false) ? null : makeJit({ cpu, bus, machine, periph, opts: { sync: !!(r.options && r.options.jitSync) } });
    if (jit) cpu._wasmRun = jit.run;
    // One state length per machine: the writable regions plus room for the registers.
    stateSize = 262144; for (const rg of bus.regions) if (!rg.readonly) stateSize += rg.size;
    perFrame = cps / FPS; debt = 0; frames = 0; composedAt = -1; ready = false; audioN = 0;
    held = [0, 0]; started = false;
    ports = [
      { port: 0, kind: 'player', device: 'twin-pad', controls: unit === 'zelda' ? PAD.concat(ZELDA_EXTRA) : PAD.slice() },
      { port: 1, kind: 'console', device: 'twin-console', controls: CONSOLE },
    ];
    // Pre-roll to the moment the firmware arms its audio DMA (Mario about 12.4 M cycles in, 0.2 s of
    // its own time; Zelda after its scripted TIME press, about 60 M), never past the unit's
    // readyCycles, where the picture is first shown anyway: the twin derives the SAI rate there,
    // and load() reports it. The host builds its sink from that rate.
    const limit = UNITS[unit].readyCycles;
    while (!cpu.halted && periph._s6Anchor == null && cpu.cycles < limit) { const c0 = cpu.cycles; cpu.run(Math.min(limit, cpu.cycles + SLICE)); if (cpu.cycles === c0) break; }
    chain = makeChain(periph.audioSampleRate || 48004, GAIN[unit] || GAIN.mario);
  }
  /* One frame of the unit's time, in the old worker's slices, ending at a clean boundary: a
     Chrom-ART (DMA2D) completion still due is run to, so every state can be taken here (its
     closure cannot be saved). The extra cycles are owed by the next frame. */
  function step() {
    // Whole cycles only: a fractional target is a zero-advance spin (index.html's tile pump says so).
    const target = cpu.cycles + Math.max(0, Math.round(perFrame - debt));
    while (!cpu.halted && cpu.cycles < target) { const c0 = cpu.cycles; cpu.run(Math.min(target, cpu.cycles + SLICE)); if (cpu.cycles === c0) break; }
    let extra = 0;
    while (!cpu.halted && cpu.dma2dDueCycle !== 0 && extra < 4000000) { const c0 = cpu.cycles; cpu.run(cpu.cycles + 2000); if (cpu.cycles === c0) break; extra += cpu.cycles - c0; }
    debt = Math.max(0, cpu.cycles - target);
  }

  const core = {
    info: { build: null },
    load(r) {
      req = r;
      boot(r);
      return {
        fps: FPS,
        video: { width: W, height: H, format: 'rgba8888', pixelAspect: 1, rotation: 0 },
        audio: { rate: chain.rate },             // the firmware's own SAI rate (48,004 Hz on both units)
        ports,
        battery: [],
        options: [],
        extensions: { clock: true, bootGate: true },
        model: unit,
        overlayVariant: unit === 'zelda' ? 'zelda' : null,
      };
    },
    reset() { boot(req); },
    setInput(port, s) {
      const p = ports[port]; if (!p || !periph) return;
      const m = s.buttons | 0, was = held[port] | 0;
      if (m === was) return;
      held[port] = m;
      if (p.kind === 'console' && (m & ~was & (1 << p.controls.findIndex(c => c.id === 'game')))) started = true;
      p.controls.forEach((c, bit) => { const on = !!(m & (1 << bit)); if (c.id in periph.input && periph.input[c.id] !== on) periph.input[c.id] = on; });
      periph.markInputDirty();
    },
    runFrame() {
      if (!cpu || cpu.halted) return;
      if (clockDue) { clockDue = false; core.ext.clock.set(env.now()); }
      if (jit) { jit.frame(); if (jit.live !== jitWasLive) { jitWasLive = jit.live; env.log('info', jit.live ? `block translation live (${jit.stats.spans} spans)` : 'block translation dropped (code memory changed); the interpreter runs until it is made again'); } }
      step();
      frames++;
      if (!ready && cpu.cycles >= UNITS[unit].readyCycles) { ready = true; env.emit('ready'); }
    },
    video() {
      if (!ready) return { format: 'rgba8888', width: W, height: H, stride: W, data: black };
      if (composedAt !== frames) { composer.compose(bus, periph, { w: W, h: H, rgba }); composedAt = frames; }
      return { format: 'rgba8888', width: W, height: H, stride: W, data: rgba };
    },
    audio() {
      if (audioOut.data.length < audioN) audioOut.data = new Float32Array(audioN * 2);
      audioOut.data.set(chain.run(audioQ, audioN).subarray(0, audioN));
      audioOut.frames = audioN; audioN = 0;
      return audioOut;
    },
    serialize() {
      if (!machine) throw new CoreError('unsupported', 'nothing is running');
      const audioLeft = audioN ? audioQ.slice(0, audioN) : null;
      return pack({ core: 'tft', unit, frames, debt, ready, held, snap: AT.snapshot(machine), extra: saveExtra(cpu, periph),
        speaker: chain.save(), audioLeft }, stateSize);
    },
    check(b) {
      const st = unpack(b);
      if (!st || st.core !== 'tft' || !st.snap) throw new CoreError('wrong-core', 'This save was not made by a colour unit.');
      if (st.unit !== unit) throw new CoreError('wrong-game', `This save belongs to the ${UNITS[st.unit] ? UNITS[st.unit].label : 'other unit'}.`);
      return st;
    },
    unserialize(b) {
      const st = core.check(b);
      if (!AT.restore(machine, st.snap)) throw new CoreError('damaged', 'The twin refused this save.');
      loadExtra(cpu, periph, st.extra, st.snap && st.snap.periph);
      // A state from before 2026-10-28 carries the old 22,050 cadence (audioSampleRate, _s6Period):
      // re-derive the rate from the registers the state holds and re-anchor the stream here.
      if (periph._saiFsFromRegs && periph._s6Anchor != null) {
        const d = Math.round(periph._saiFsFromRegs() || 0);
        if (d && d !== periph.audioSampleRate) { periph.audioSampleRate = d; periph._s6Anchor = null; periph._armDmaStream6(); }
      }
      // A state from before 2026-11-01 carries the old pace (cpu.ipc 1.44, and the SysTick and DMA
      // intervals derived from it): the twin's own constant stands, and the intervals follow it.
      if (pace && cpu.ipc !== pace) {
        cpu.ipc = pace; cpu.recomputeSystick();
        if (periph._s6Anchor != null) { periph._s6Anchor = null; periph._armDmaStream6(); }
        cps = realHz(); perFrame = cps / FPS; periph.rtcCPS = cps;
      }
      if (jit) jit.drop();                     // the code memory was written back: translate again
      chain.load(st.speaker);
      frames = st.frames | 0; debt = +st.debt || 0; ready = !!st.ready; composedAt = -1; audioN = 0;
      if (st.audioLeft && st.audioLeft.length) { if (audioQ.length < st.audioLeft.length) audioQ = new Float32Array(st.audioLeft.length * 2); audioQ.set(st.audioLeft); audioN = st.audioLeft.length; }
      held = Array.isArray(st.held) ? [st.held[0] | 0, st.held[1] | 0] : [0, 0];
      clockDue = true;                         // the real unit's clock kept running: real time at the next frame
      started = true;
      return st;
    },
    ext: {
      /* The RTC anchor moved so the clock reads `ms` now (the twin keeps its own cycles). */
      clock: { set(ms) { if (periph) periph.rtcBaseMs = ms - (cpu.cycles / periph.rtcCPS) * 1000; } },
      bootGate: { ready: () => ready },
    },
    details() { return `ARM twin (play/twin.js) · ${UNITS[unit] ? UNITS[unit].label : '?'} · ${cpu && cpu._wasmRun ? 'WASM core' : 'JS block-JIT'} · sound ${chain ? chain.rate + ' Hz from the firmware\'s own clock setting' : 'not started'} · ${(cps / 1e6).toFixed(2)} M cycles per second · ${FPS} Hz virtual`; },
    get frames() { return frames; },
    get model() { return unit; },
    get started() { return started; },
    get cycles() { return cpu ? cpu.cycles : 0; },
    get twin() { return { AT, bus, periph, cpu, composer, jit }; },   // diagnostics and the equality checks
    get rtcMs() { return periph ? periph.rtcBaseMs + (cpu.cycles / periph.rtcCPS) * 1000 : 0; },   // diagnostics: the unit's clock now
    destroy() { machine = cpu = bus = periph = null; },
  };
  return core;
}
