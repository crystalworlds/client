/*
 * play/host/rewind-ring.mjs -- the host's rewind ring for big states, backed by
 * ./rewind-worker.js (XOR delta + deflate on a helper thread, the step before decoded ahead).
 * Written 2026-10-14 for the Atari migration (the build plan, Phase 3); moved
 * into the host the same day (rewind is shared: the three-part rule).
 *
 * The host uses it, in place of its in-memory ring of raw states, for any core whose states
 * are half a megabyte or more (host.mjs BIG_STATE). The shape is the host's ring, made asynchronous
 * where it has to be:
 *
 *   ring.push(state)        a fresh Uint8Array from core.serialize(); its buffer is handed to
 *                           the worker (transferred), so the caller must not use it afterwards
 *   ring.length             moments held (the newest counts as one)
 *   ring.step() -> Promise<Uint8Array|null>
 *                           drop the newest moment and give the one before it (null if none)
 *   ring.busy               a step is in flight (a held Rewind skips a tick rather than queue)
 *   ring.clear()            a new timeline (a load, a reset)
 *   ring.exportHistory()    null: a history of multi-megabyte states is not carried in the
 *                           Continue card (the old Atari pages carried none either)
 *   ring.importHistory()    0
 *   ring.stats()            the worker's counters, for the gate
 *
 * If the worker cannot start (no Worker, a CSP), it falls back to raw states in memory,
 * capped like the host's own ring, so rewind still works, only shorter.
 */
export class Ring {
  constructor({ max = 100, capBytes = 48 * 1024 * 1024, approxBytes = 0 } = {}) {
    this.max = max; this.capBytes = capBytes; this.n = 0; this.busy = false;
    this.pending = new Map(); this.seq = 0; this.last = {};
    try {
      this.w = new Worker(new URL('./rewind-worker.js', import.meta.url));
      this.w.onmessage = e => this.onMsg(e.data);
      this.w.onerror = () => this.fallback();
      this.w.postMessage({ t: 'config', max, capBytes });
      this.kind = 'worker';
    } catch (_) { this.fallback(); }
    this.approxBytes = approxBytes;
  }
  fallback() {
    if (this.kind === 'memory') return;
    try { if (this.w) this.w.terminate(); } catch (_) {}
    this.w = null; this.kind = 'memory'; this.mem = []; this.n = 0;
    for (const [, r] of this.pending) r(null);
    this.pending.clear();
    this.memMax = Math.max(10, Math.min(this.max, Math.floor(this.capBytes / Math.max(1, this.approxBytes || 1))));
  }
  onMsg(m) {
    if (m.t === 'state') {
      const r = this.pending.get(m.id); this.pending.delete(m.id);
      this.n = m.n;
      if (r) r(m.b ? new Uint8Array(m.b) : null);
    } else if (m.t === 'stats') { this.last = m; const r = this.statsWait; this.statsWait = null; if (r) r(m); }
  }
  get length() { return this.n; }
  push(state) {
    if (!state || !state.length) return;
    if (this.kind === 'memory') { this.mem.push(state); if (this.mem.length > this.memMax) this.mem.shift(); this.n = this.mem.length; return; }
    const b = state.byteOffset === 0 && state.byteLength === state.buffer.byteLength ? state.buffer : state.slice().buffer;
    // A state of another length starts the worker's history again
    // (rewind-worker.js push), so the count does too.
    if (this.lastLen && b.byteLength !== this.lastLen) this.n = 0;
    this.lastLen = b.byteLength;
    this.w.postMessage({ t: 'push', b }, [b]);
    this.n = Math.min(this.max, this.n + 1);
  }
  step() {
    if (this.n < 2) return Promise.resolve(null);
    if (this.kind === 'memory') { this.mem.pop(); this.n = this.mem.length; return Promise.resolve(this.mem.length ? this.mem[this.mem.length - 1] : null); }
    const id = ++this.seq;
    this.busy = true;
    const p = new Promise(res => this.pending.set(id, res)).then(v => { this.busy = false; return v; });
    this.w.postMessage({ t: 'step', id });
    return p;
  }
  clear() {
    this.n = 0;
    if (this.kind === 'memory') { this.mem = []; return; }
    this.w.postMessage({ t: 'clear' });
  }
  exportHistory() { return null; }
  importHistory() { return 0; }
  stats() {
    if (this.kind === 'memory') return Promise.resolve({ kind: 'memory', n: this.n });
    return new Promise(res => { this.statsWait = res; this.w.postMessage({ t: 'stats' }); }).then(s => Object.assign({ kind: 'worker' }, s));
  }
  destroy() { try { if (this.w) this.w.terminate(); } catch (_) {} this.w = null; }
}
