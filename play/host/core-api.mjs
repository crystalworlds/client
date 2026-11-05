/*
 * play/host/core-api.mjs -- the Core API, version 1 (the Core API, section 3).
 *
 * Every console module (play/cores/<id>/core.mjs) exports
 *     export const manifest = { ... };            // CoreManifest
 *     export function create(env) -> Core | Promise<Core>
 * and the one play host (play/host/host.mjs) drives it through seven required calls:
 *     load(req) -> LoadResult, reset(kind), setInput(port, state), runFrame(),
 *     video() -> FrameView, audio() -> AudioView, destroy()
 * plus what the manifest declares (serialize / unserialize, battery, setOption, ext).
 *
 * A core is a pure machine: no DOM, no AudioContext, no timers, no storage, no
 * Date.now(), no key events. The host runs it; nothing else can.
 *
 * 1.0 notes made while building Phase 1 (each is an addition a 1.0 host accepts):
 *   - create() may return a Promise (a WASM core has to be fetched and compiled).
 *   - env.audioRate() is the rate the host's sound card wants right now, including the
 *     engine's drift servo. A core that resamples itself (the Game Boy) asks for it;
 *     a core that reports its own rate is resampled by the host.
 *   - LoadResult.model names the machine actually built ('dmg' / 'cgb', 'ntsc' / 'pal')
 *     so the art module and the save store can key on it.
 */

export const API = '1.0';
export const HOST_API = { min: '1.0', max: '1.x' };

export class CoreError extends Error {
  /** @param {'wrong-core'|'wrong-game'|'damaged'|'needs-firmware'|'unsupported'} code */
  constructor(code, message) { super(message); this.name = 'CoreError'; this.code = code; }
}

const REQUIRED = ['load', 'reset', 'setInput', 'runFrame', 'video', 'audio', 'destroy'];
const FORMS = new Set(['handheld', 'console']);
const THREADS = new Set(['main', 'worker', 'either']);
const VIDEO_KINDS = new Set(['raster', 'segments']);
export const EXTENSIONS = new Set(['options', 'media', 'accessory', 'cabinet', 'clock', 'rotation', 'attract', 'bootGate', 'debug', 'tilt', 'camera', 'microphone', 'tape', 'trackball', 'recorder']);   // tilt, camera, microphone: cartridge and console peripherals (2026-10-15); recorder: the Famicom Data Recorder (2026-10-18)

/** Can this host run a core that says it speaks `api`? */
export function apiAccepted(api) {
  const m = /^(\d+)\.(\d+)$/.exec(String(api || ''));
  return !!m && m[1] === '1';
}

/** Every problem with a manifest, as a list of sentences (empty = valid). */
export function manifestProblems(m) {
  const out = [];
  if (!m || typeof m !== 'object') return ['the module exports no manifest'];
  if (!apiAccepted(m.api)) out.push(`it speaks Core API ${m.api}; this host runs ${HOST_API.min} to ${HOST_API.max}`);
  if (!m.id || typeof m.id !== 'string') out.push('it has no id');
  if (!m.label) out.push('it has no label');
  if (!FORMS.has(m.form)) out.push(`form "${m.form}" is not handheld or console`);
  if (!THREADS.has(m.thread)) out.push(`thread "${m.thread}" is not main, worker or either`);
  if (!m.files || !m.files.game || !Array.isArray(m.files.game.exts)) out.push('files.game.exts is missing');
  if (!m.video || !VIDEO_KINDS.has(m.video.kind)) out.push('video.kind is not raster or segments');
  if (!m.audio || ![1, 2].includes(m.audio.channels)) out.push('audio.channels is not 1 or 2');
  if (!m.state || typeof m.state.supported !== 'boolean') out.push('state.supported is not declared');
  for (const x of m.extensions || []) if (!EXTENSIONS.has(x)) out.push(`unknown extension "${x}"`);
  return out;
}

/** Every required call a created core is missing. */
export function coreProblems(core, manifest) {
  const out = [];
  for (const n of REQUIRED) if (typeof (core && core[n]) !== 'function') out.push(`it has no ${n}()`);
  if (manifest && manifest.state && manifest.state.supported) {
    if (typeof core.serialize !== 'function') out.push('it declares state but has no serialize()');
    if (typeof core.unserialize !== 'function') out.push('it declares state but has no unserialize()');
  }
  return out;
}

/** The virtual clock (section 3.7): starts at the real time at load, advances by
 *  1000 / fps per runFrame, stops while paused, and is saved beside every state. */
export class VirtualClock {
  constructor(startMs = Date.now()) { this.ms = startMs; this.fps = 60; }
  advance(frames = 1) { this.ms += frames * 1000 / this.fps; }
  now() { return Math.floor(this.ms); }
}

/** Bit mask from the ids of the controls held, in the port's declared order. */
export function maskOf(port, heldIds) {
  let m = 0;
  port.controls.forEach((c, i) => { if (heldIds.has(c.id)) m |= (1 << i); });
  return m;
}
