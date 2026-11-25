/*
 * play/host/runner-worker.mjs -- the Core API's worker runner, page side (2026-10-14).
 * the Core API, section 4.2. A core whose manifest says thread: 'worker' runs in
 * play/host/core-worker.js; this object stands in for it on the page with the same Core calls,
 * so the host's loop, rewind, saves, Continue and the bar are unchanged.
 *
 * HOW THE SYNCHRONOUS CALLS ARE MET
 *   runFrame()      sends one frame request (with the input changes and the virtual clock) and
 *                   returns at once; false when two are already in flight, and the host does
 *                   not count that frame (the worker sets the pace when it is the slower one).
 *   video()         the newest frame the worker has sent (a copy the page owns).
 *   audio()         the samples that have arrived since the last call.
 *   serialize()     a copy of the newest state the worker has sent, and asks for a fresh one
 *                   with the next frame: rewind captures arrive one capture late, which the
 *                   ring does not notice. serializeAsync() is exact (slots use it).
 *   unserialize(s)  sends the state; the picture follows when the worker has it (onFrame).
 *                   unserializeAsync(s) waits and throws the core's own refusal.
 *   load(req)       loadAsync(req) only: the host awaits it.
 *   battery         mirrored: the worker sends a dirty region's bytes with the frame.
 *   ext             clock, bootGate, media, rotation and crosshair: read from a mirror each
 *                   frame brings; a change goes to the worker (2026-10-15).
 * LOGS carry no data payloads.
 */
import { CoreError } from './core-api.mjs';

/* everyPicture (22 Nov 2026, the N64): the worker composes the picture of EVERY frame, not only of the frame
   asked after a paint. With two frames in flight a picture asked at a paint comes two frames later, so a core
   whose frames take most of a screen refresh showed a new picture only every second or third paint (the N64 at
   48 frames a second: 15 pictures a second). Off for every other system: their frames are short and the
   picture costs them more than it gives. */
export async function createWorkerCore(url, env, { channels = 1, maxInFlight = 2, everyPicture = false, createMs = 0 } = {}) {
  const w = new Worker(new URL('./core-worker.js?v=2.3.0-prepush1', import.meta.url), { type: 'module' });
  const t0 = performance.now(); let lastSign = 'none';
  let seq = 0, inFlight = 0, video = null, wantState = false, wantVideo = true, latest = null, latestVideo = null, inputs = [], mirror = { frames: 0, model: null, ready: true, bdirty: null };
  let audioQ = [], audioFrames = 0, options = null, details = null, dead = null, ports = [];
  const waits = new Map();
  const keepPic = new Set();          // unserialize answers whose picture is not taken (the caller showed its own)
  const battery = new Map();
  const ask = (m, tr) => new Promise((res, rej) => { const id = ++seq; waits.set(id, { res, rej }); w.postMessage(Object.assign({ id }, m), tr || []); });
  const errOf = d => new CoreError(d.code || 'damaged', d.message || 'the core refused');
  const take = mr => {
    if (!mr) return;
    mirror = mr;
    if (mr.bdirty) for (const id of Object.keys(mr.bdirty)) battery.set(id, mr.bdirty[id]);
  };
  let createdRes = null, createdRej = null, loadedRes = null, loadedRej = null;
  w.onmessage = ev => {
    const d = ev.data || {};
    if (d.t === 'frame') {
      inFlight = Math.max(0, inFlight - 1);
      if (typeof d.ms === 'number') { proxy.cost.n++; proxy.cost.ms += d.ms; if (d.ms > proxy.cost.max) proxy.cost.max = d.ms; }
      if (d.video) video = d.video;
      // Sound is handed on the moment it arrives (onAudio), not on the page's next tick.
      if (d.audio && d.audio.frames) { if (proxy.onAudio) proxy.onAudio(d.audio.data, d.audio.frames); else { audioQ.push(d.audio.data); audioFrames += d.audio.frames; } }
      if (d.state) { latest = d.state; latestVideo = d.video || null; }   // the picture of the same frame as the state (rewind)
      take(d.mirror);
      if (d.video && proxy.onFrame) proxy.onFrame();
    } else if (d.t === 'emit') { if (d.ev === 'ports' && Array.isArray(d.data)) ports = d.data; env.emit(d.ev, d.data); }
    else if (d.t === 'log') env.log(d.lv, d.m);
    else if (d.t === 'alive') { lastSign = d.stage; env.log('info', `worker start: ${d.stage === 'worker' ? 'the worker runs' : 'the console’s program arrived'} (${Math.round(performance.now() - t0)} ms)`); if (createArm) createArm(); }
    else if (d.t === 'created') { options = d.options; createdRes && createdRes(d); }
    else if (d.t === 'loaded') { details = d.details; options = d.options || options; if (d.ports) ports = d.ports; take(d.mirror); loadedRes && loadedRes(d.result); }
    else if (d.t === 'state' || d.t === 'done') {
      if (d.video && !keepPic.delete(d.id)) { video = d.video; if (proxy.onFrame) proxy.onFrame(); }
      if (d.state) { latest = d.state.slice(); latestVideo = null; }
      if (d.options) options = d.options;
      if (d.ports) ports = d.ports;
      take(d.mirror);
      const wt = waits.get(d.id); if (wt) { waits.delete(d.id); wt.res(d); }
    } else if (d.t === 'fail') {
      const e = errOf(d);
      if (d.op === 'create') { createdRej && createdRej(e); return; }
      if (d.op === 'load') { loadedRej && loadedRej(e); return; }
      if (d.op === 'run') { inFlight = Math.max(0, inFlight - 1); dead = e; env.emit('error', { message: e.message }); return; }
      const wt = waits.get(d.id); if (wt) { waits.delete(d.id); wt.rej(e); } else env.log('warn', `${d.op} refused: ${e.message}`);
    }
  };
  w.onerror = e => { const err = new CoreError('unsupported', 'the core worker stopped: ' + (e && e.message || 'error')); dead = err; createdRej && createdRej(err); loadedRej && loadedRej(err); };
  /* createMs (23 Nov 2026): a worker whose program, or the core's own files, never arrive (a stalled
     request) would leave its start waiting for ever; past the limit the worker is stopped and the start refused,
     so the host can say why or run the core on the page instead. 0: no limit. */
  /* The limit counts from the worker's last sign of life (core-worker.js 'alive'): a worker slowed by a busy
     machine that is still moving gets the time again at each step (twice over for the program's own start, which
     compiles its machine and may start workers of its own); one that never moves is stopped. */
  let createTimer = 0, createArm = null;
  const WHERE = { none: 'the worker did not start', worker: 'the console’s program did not arrive in the worker', imported: 'the console’s program did not finish starting' };
  const created = await new Promise((res, rej) => {
    createdRes = res; createdRej = rej;
    if (createMs > 0) {
      createArm = () => { clearTimeout(createTimer); const ms = lastSign === 'imported' ? createMs * 2 : createMs; createTimer = setTimeout(() => { try { w.terminate(); } catch (_) {} rej(new CoreError('unsupported', `${WHERE[lastSign] || WHERE.none} within ${Math.round(ms / 1000)} seconds`)); }, ms); };
      createArm();
    }
    w.postMessage({ t: 'create', url, audioRate: env.audioRate ? env.audioRate() : 48000 });
  }).finally(() => { clearTimeout(createTimer); createArm = null; });
  env.log('info', `worker start: ready (${Math.round(performance.now() - t0)} ms)`);
  const has = created.has || {};

  const proxy = {
    worker: true,
    cost: { n: 0, ms: 0, max: 0 },                     // the worker's own time per frame (diagnostics)
    info: created.info || {},
    onFrame: null,
    onAudio: null,
    loadAsync(req) {
      return new Promise((res, rej) => { loadedRes = res; loadedRej = rej; w.postMessage({ t: 'load', req, now: env.now() }); });
    },
    load() { throw new CoreError('unsupported', 'a worker core loads with loadAsync'); },
    setInput(port, st) { inputs.push([port, st]); },
    runFrame() {
      if (dead) return false;
      // Two in flight, not three (29 Oct 2026): one frame runs while one waits, which is all the
      // worker needs to never idle; a third only sat in the queue, holding every press and every sound
      // block back by a frame (17 ms) and making the sound arrive in bigger bursts.
      // A core that asks for it may keep THREE (22 Nov 2026, the Nintendo 64 only): on a screen whose
      // animation frames come at 30 Hz, a slow core waited up to a frame for the next ask, every other frame.
      // A third in flight is taken only while the core is behind; the light cores keep two.
      if (inFlight >= maxInFlight) return false;
      inFlight++;
      // The picture is composed in the worker only for a frame the page will paint: the main
      // thread's core composes on paint too, not every frame (a catch-up tick runs several).
      // The host's sound rate on every frame (20 Nov 2026): a core that reports rate 0 makes its
      // sound at env.audioRate(), and the servo is in that rate. Sent only at create, a worker core
      // kept the first reading (+0.5 %, an empty queue) and its queue was cleared twice a minute.
      const m = { t: 'run', now: env.now(), audioRate: env.audioRate ? env.audioRate() : 0, inputs, wantState, wantVideo, channels };
      inputs = []; wantState = false; wantVideo = everyPicture;
      w.postMessage(m);
      return true;
    },
    video() { wantVideo = true; return video; },                         // null until the first frame arrives (present() skips it)
    audio() {
      if (!audioFrames) return { data: new Float32Array(0), frames: 0 };
      const n = audioQ.reduce((s, a) => s + a.length, 0), data = new Float32Array(n);
      let o = 0; for (const a of audioQ) { data.set(a, o); o += a.length; }
      const r = { data, frames: audioFrames };
      audioQ = []; audioFrames = 0;
      return r;
    },
    serialize() {
      wantState = true; wantVideo = true;                               // the state's frame comes with its picture
      if (inFlight === 0) ask({ t: 'serialize' }).catch(() => {});     // paused: refresh it now
      return latest ? latest.slice() : null;
    },
    /* The picture of the frame serialize() last returned (21 Nov 2026): the rewind ring keeps it
       with the state, so a step back shows that moment and not the newest frame (the newest frame
       is up to one capture later, and a core whose state holds no picture answers an unserialize
       with the picture it had before). Null when the state came without one. */
    stateVideo() { return latestVideo; },
    async serializeAsync() { const d = await ask({ t: 'serialize' }); return d.state ? d.state.slice() : null; },
    /* o.picture (21 Nov 2026, the rewind ring): the picture of that state, already shown by the host.
       It becomes the newest frame, and the worker's answer does not replace it: a core whose state
       holds no picture answers with the one it had before the step. */
    unserialize(st, o) {
      audioQ = []; audioFrames = 0;
      const copy = st instanceof Uint8Array ? st.slice() : new Uint8Array(st);
      latest = copy.slice(); latestVideo = null;
      if (o && o.picture) { video = o.picture; latestVideo = o.picture; keepPic.add(seq + 1); }
      ask({ t: 'unserialize', state: copy, now: env.now() }, [copy.buffer]).catch(e => env.log('warn', 'state refused: ' + e.message));
    },
    async unserializeAsync(st) {
      audioQ = []; audioFrames = 0;
      const copy = st instanceof Uint8Array ? st.slice() : new Uint8Array(st);
      const keep = copy.slice();
      await ask({ t: 'unserialize', state: copy, now: env.now() }, [copy.buffer]);
      latest = keep; latestVideo = null;
    },
    reset() { audioQ = []; audioFrames = 0; latest = null; latestVideo = null; ask({ t: 'reset' }).catch(e => env.log('warn', 'reset refused: ' + e.message)); },
    get frames() { return mirror.frames; },
    get timedInput() { return !!mirror.timed; },      // input changes carry their place in the frame (2026-10-22)
    get model() { return mirror.model; },
    get rumble() { return mirror.rumble | 0; },
    get fps() { return typeof mirror.fps === 'number' ? mirror.fps : null; },   // the N64's fields a second, live (core-worker.js mirror)
    get engine() { return mirror.engine || null; },                            // the N64's engine running: 'accurate' or 'fast'
    destroy() { try { w.terminate(); } catch (_) {} },
  };
  if (has.details) proxy.details = () => details || '';
  if (has.options) {
    proxy.options = () => options || [];
    proxy.setOption = (k, v) => { ask({ t: 'setOption', k, v }).catch(() => {}); return 'unknown'; };
    /* The core's own answer ('reload', 'ports', 'art'), for a host that can wait for it
       (2026-10-22: the Ataris' region, firmware, controllers and the Lynx's turn). */
    proxy.setOptionAsync = async (k, v) => { const d = await ask({ t: 'setOption', k, v }); return d.how || 'unknown'; };
  }
  if (has.battery) proxy.battery = {
    dirty: () => Array.from(battery.keys()),
    read: id => battery.get(id) || null,
    clean: id => { battery.delete(id); w.postMessage({ t: 'battery', op: 'clean', bid: id }); },
    write: (id, bytes) => { w.postMessage({ t: 'battery', op: 'write', bid: id, bytes: bytes.slice() }); return true; },
  };
  proxy.ext = {};
  if (has.clock) proxy.ext.clock = { set: ms => w.postMessage({ t: 'clock', ms }) };
  /* media, rotation, crosshair (2026-10-15): read from the mirror each frame brings; a change
     goes to the worker and the next frame's mirror carries the result. */
  const callExt = (name, fn, args) => ask({ t: 'ext', name, fn, args }).catch(e => env.log('warn', `${name}.${fn} refused: ${e.message}`));
  if (has.media) proxy.ext.media = {
    list: () => (mirror.media && mirror.media.list) || [],
    current: () => (mirror.media ? mirror.media.current : null),
    label: () => (mirror.media && mirror.media.label) || 'Media',
    insert: id => { callExt('media', 'insert', [id]).then(() => env.emit('media')); if (mirror.media) mirror.media.current = id; return true; },
    eject: () => { callExt('media', 'eject', []).then(() => env.emit('media')); if (mirror.media) mirror.media.current = null; },
  };
  if (has.rotation) proxy.ext.rotation = { option: has.rotation.option, next: () => mirror.rotNext };
  if (has.crosshair) proxy.ext.crosshair = () => mirror.crosshair || null;
  if (has.bootGate) proxy.ext.bootGate = { ready: () => !!mirror.ready };
  if (has.ports) proxy.ports = () => ports;
  /* Cheats (2026-10-26): both calls answer through the worker, so the host awaits them. */
  if (has.cheats) proxy.ext.cheats = {
    kinds: () => ask({ t: 'ext', name: 'cheats', fn: 'kinds', args: [] }).then(d => (d && Array.isArray(d.value) ? d.value : []), () => []),
    apply: codes => ask({ t: 'ext', name: 'cheats', fn: 'apply', args: [codes] }).then(d => (d && d.value) || { ok: false, why: 'no answer' }, e => ({ ok: false, why: e.message })),
  };
  /* The 5200 trackball (2026-10-22): each call goes to the worker, no answer. */
  if (has.trackball) proxy.ext.trackball = Object.fromEntries(['lock', 'move', 'button'].map(fn => [fn, (...args) => w.postMessage({ t: 'ext', name: 'trackball', fn, args })]));
  return proxy;
}
