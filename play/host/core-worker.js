/*
 * play/host/core-worker.js -- the Core API's worker runner, worker side (2026-10-14).
 * the Core API, section 4.2: "runner-main.mjs, runner-worker.mjs: where the core runs; same
 * Core calls, the worker one proxied". A module worker that imports a console's core.mjs and
 * runs its frames off the page's main thread; play/host/runner-worker.mjs is the page's side.
 * First user: the colour units (play/cores/tft), whose ARM twin measured 53 to 59 fps with
 * sound gaps on the main thread.
 *
 * Nothing here is console-specific. The core is the same module the main thread would run; its
 * env is the same shape: now() is the host's virtual clock, sent with every frame request.
 *
 *   page -> worker  {t:'create', url, audioRate}            -> {t:'created', info, has}
 *                   {t:'load', req}                         -> {t:'loaded', result, details} | {t:'fail', ...}
 *                   {t:'run', now, inputs, wantState}       -> {t:'frame', video, audio, state?, mirror}
 *                   {t:'serialize', id}                     -> {t:'state', id, state}
 *                   {t:'unserialize', id, state, now}       -> {t:'done', id, video, mirror} | {t:'fail', id, ...}
 *                   {t:'reset', id} {t:'setOption', id, k, v} {t:'clock', ms}
 *                   {t:'battery', op:'write'|'clean', bid, bytes}
 *   worker -> page  {t:'emit', ev, data} {t:'log', lv, m}
 *
 * SOUND: none here; samples go to the page, which plays them through the site's context.
 * LOGS carry no data payloads: an error is sent as its code and message only.
 */
let core = null, nowMs = 0, audioRate = 48000;
const post = (m, tr) => { try { self.postMessage(m, tr || []); } catch (_) {} };
const env = {
  now: () => nowMs,
  emit: (ev, data) => post({ t: 'emit', ev, data: plain(data) }),
  log: (lv, m) => post({ t: 'log', lv, m: String(m) }),
  preview: false,
  audioRate: () => audioRate,
};
function plain(d) { try { return d == null ? d : JSON.parse(JSON.stringify(d)); } catch (_) { return null; } }
function failOf(e) { return { code: (e && e.code) || 'damaged', message: String((e && e.message) || e) }; }

/* A copy of the frame view the page can own (the core reuses its buffers). */
function frameOut(tr) {
  let v = null;
  try { v = core.video(); } catch (_) { v = null; }
  if (!v || !v.data) return null;
  const out = { format: v.format, width: v.width, height: v.height, stride: v.stride, pixelAspect: v.pixelAspect, rotation: v.rotation };
  if (v.palette) out.palette = v.palette.slice ? v.palette.slice() : v.palette;
  out.data = v.data.slice(); tr.push(out.data.buffer);
  if (v.levels && v.levels !== v.data) { out.levels = v.levels.slice(); tr.push(out.levels.buffer); }
  else if (v.levels) out.levels = out.data;
  return out;
}
function mirror() {
  const m = { frames: 0, model: null, ready: true, bdirty: null };
  // The extensions the page reads synchronously, mirrored with each frame (2026-10-15).
  const x = core.ext || {};
  try { if (x.media) m.media = { list: plain(x.media.list()), current: x.media.current(), label: x.media.label ? x.media.label() : null }; } catch (_) {}
  try { if (x.rotation) m.rotNext = x.rotation.next(); } catch (_) {}
  try { if (x.crosshair) m.crosshair = plain(x.crosshair()); } catch (_) {}
  try { m.frames = core.frames | 0; } catch (_) {}
  try { m.model = core.model || null; } catch (_) {}
  try { m.timed = !!core.timedInput; } catch (_) {}
  try { if (core.ext && core.ext.bootGate) m.ready = !!core.ext.bootGate.ready(); } catch (_) {}
  try {
    if (core.battery && core.battery.dirty) {
      const ids = core.battery.dirty();
      if (ids && ids.length) { m.bdirty = {}; for (const id of ids) { const b = core.battery.read(id); if (b) m.bdirty[id] = b.slice(); } }
    }
  } catch (_) {}
  return m;
}
function stateOf() { const s = core.serialize(); return s instanceof Uint8Array ? s : new Uint8Array(s); }

self.onmessage = async ev => {
  const m = ev.data || {};
  try {
    if (m.t === 'create') {
      audioRate = m.audioRate || audioRate;
      const mod = await import(m.url);
      core = await mod.create(env);
      const xx = core.ext || {};
      const has = { media: !!xx.media, rotation: xx.rotation ? { option: xx.rotation.option } : null, crosshair: typeof xx.crosshair === 'function', battery: !!core.battery, options: typeof core.options === 'function', setOption: typeof core.setOption === 'function',
        ports: typeof core.ports === 'function', trackball: !!xx.trackball, details: typeof core.details === 'function', clock: !!(core.ext && core.ext.clock), bootGate: !!(core.ext && core.ext.bootGate), cheats: !!xx.cheats };
      post({ t: 'created', info: plain(core.info) || {}, has, options: has.options ? plain(core.options()) : null });
      return;
    }
    if (!core) return;
    if (m.t === 'load') {
      nowMs = m.now || nowMs;
      const result = core.load(m.req);
      let details = null; try { details = core.details ? core.details() : null; } catch (_) {}
      post({ t: 'loaded', result: plain(result), details, mirror: mirror(), options: core.options ? plain(core.options()) : null, ports: core.ports ? plain(core.ports()) : null });
    } else if (m.t === 'run') {
      nowMs = m.now;
      const t0 = performance.now();
      for (const [port, st] of m.inputs || []) core.setInput(port, st);
      core.runFrame();
      const tr = [];
      const video = m.wantVideo === false ? null : frameOut(tr);   // composed only when the page will paint it
      let audio = null;
      const a = core.audio();
      if (a && a.frames) { const n = a.frames * (m.channels || 1); audio = { frames: a.frames, data: a.data.slice(0, n) }; tr.push(audio.data.buffer); }
      let state = null;
      if (m.wantState) { try { state = stateOf(); if (state.byteOffset || state.byteLength !== state.buffer.byteLength) state = state.slice(); tr.push(state.buffer); } catch (_) { state = null; } }
      post({ t: 'frame', video, audio, state, mirror: mirror(), ms: performance.now() - t0 }, tr);
    } else if (m.t === 'serialize') {
      let state = null; try { state = stateOf().slice(); } catch (e) { post({ t: 'fail', id: m.id, ...failOf(e) }); return; }
      post({ t: 'state', id: m.id, state }, [state.buffer]);
    } else if (m.t === 'unserialize') {
      nowMs = m.now || nowMs;
      core.unserialize(m.state);
      try { core.audio(); } catch (_) {}            // what the old timeline had queued is not played
      const tr = [];
      post({ t: 'done', id: m.id, video: frameOut(tr), mirror: mirror() }, tr);
    } else if (m.t === 'reset') {
      core.reset();
      const tr = [];
      post({ t: 'done', id: m.id, video: frameOut(tr), mirror: mirror() }, tr);
    } else if (m.t === 'setOption') {
      const how = core.setOption ? core.setOption(m.k, m.v) : 'unknown';
      const tr = [];   // a changed picture (the Lynx's turn: 'art') goes with the answer
      post({ t: 'done', id: m.id, how, options: core.options ? plain(core.options()) : null, ports: core.ports ? plain(core.ports()) : null,
        video: how === 'art' ? frameOut(tr) : undefined, mirror: mirror() }, tr);
    } else if (m.t === 'ext') {
      const x = core.ext && core.ext[m.name];
      const r = x && typeof x[m.fn] === 'function' ? x[m.fn](...(m.args || [])) : undefined;
      if (m.id) post({ t: 'done', id: m.id, value: plain(r), mirror: mirror() });   // no id: a call that wants no answer (the trackball)
    } else if (m.t === 'clock') {
      if (core.ext && core.ext.clock) core.ext.clock.set(m.ms);
    } else if (m.t === 'battery') {
      if (!core.battery) return;
      if (m.op === 'write') post({ t: 'done', id: m.id, ok: !!core.battery.write(m.bid, m.bytes) });
      else if (m.op === 'clean') core.battery.clean(m.bid);
    }
  } catch (e) {
    post({ t: 'fail', id: m.id || 0, op: m.t, ...failOf(e) });
  }
};
