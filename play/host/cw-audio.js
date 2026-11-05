/*
 * play/host/cw-audio.js -- the one audio engine for every play window (2026-10-14).
 * the Core API, section 4.4 and the build plan, section 3.
 *
 * WHERE IT RUNS. A classic script that defines window.CwPlayAudio in whichever window
 * loads it. The site loads it (play/shared/host-bridge.js) so the ONE AudioContext lives
 * in the site's page; the play host (play/host/index.html) uses parent.CwPlayAudio when
 * it is framed by the site, and loads its own copy only when opened on its own.
 *
 * SOUND STARTS FROM THE PRESS THAT LAUNCHED THE GAME (2026-10-14). While the
 * host is switched on, armGestures() puts capture-phase listeners on the site's window:
 * every press (keydown, pointerdown, pointerup, touchend, click) creates the context if
 * there is none and calls resume() synchronously, inside the press, before the tile's
 * own handler, any await, navigation or frame load. That is the press's own user
 * activation, so it works on every browser. A press that launched nothing lets the
 * context go back to sleep after IDLE_MS.
 *
 * THE GRAPH LIVES HERE TOO. lend() hands a play window a Sink; every node (worklet or
 * ScriptProcessor fallback, DC block, gain) is created in THIS window's realm, and the
 * play window only pushes sample blocks. A frame that goes away cannot leave a node
 * behind, and sound stops when its lease ends.
 *
 * SOUND RULE: tiles and drawers never get a Sink. Only a play window calls lend().
 */
(function () {
  'use strict';
  if (window.CwPlayAudio) return;

  const BUILD = '20261102-host6-fix6a';
  const IDLE_MS = 4000;
  const FADE_TC = 0.004;                     // setTargetAtTime constant: ~12 ms to silence
  const SCRIPT_URL = (document.currentScript && document.currentScript.src) || '';
  const base = SCRIPT_URL ? SCRIPT_URL.replace(/[^/]*$/, '') : '';

  let ctx = null, idleTimer = 0, reserveUntil = 0, lease = null, armed = null;
  let workletReady = null;                   // Promise<boolean> once addModule has been asked
  const stats = { created: 0, gestureWakes: 0, gestures: 0, leases: 0, resumedInGesture: 0, suspendsIdle: 0, transport: null };

  function AC() { return window.AudioContext || window.webkitAudioContext || null; }

  function ensure() {
    if (ctx && ctx.state !== 'closed') return ctx;
    const C = AC();
    if (!C) return null;
    try { ctx = new C({ latencyHint: 'interactive' }); } catch (_) { try { ctx = new C(); } catch (e) { ctx = null; return null; } }
    stats.created++;
    if (ctx.audioWorklet && typeof ctx.audioWorklet.addModule === 'function') {
      workletReady = ctx.audioWorklet.addModule(base + 'cw-audio-worklet.js?v=' + BUILD).then(() => true, () => false);
    } else workletReady = Promise.resolve(false);
    return ctx;
  }

  /* A press: wake the context inside it. */
  function wake(inGesture) {
    const c = ensure();
    if (!c) return null;
    if (c.state !== 'running') {
      try { const p = c.resume(); if (p && p.catch) p.catch(() => {}); } catch (_) {}
      if (inGesture) stats.resumedInGesture++;
    }
    if (inGesture) stats.gestureWakes++;
    scheduleIdle();
    return c;
  }
  function scheduleIdle() {
    clearTimeout(idleTimer);
    if (lease) return;
    const wait = Math.max(IDLE_MS, reserveUntil - Date.now());
    idleTimer = setTimeout(() => {
      if (lease || !ctx || ctx.state !== 'running') return;
      if (Date.now() < reserveUntil) { scheduleIdle(); return; }
      try { ctx.suspend(); stats.suspendsIdle++; } catch (_) {}
    }, wait);
  }
  /* A play window is on its way (the site's launch handler said so): keep the context
     awake for it, however long the frame takes to load (the TV is slow). */
  function reserve(ms) { reserveUntil = Date.now() + (ms || 20000); scheduleIdle(); }

  const GESTURES = ['keydown', 'pointerdown', 'pointerup', 'touchend', 'click'];
  /* A key that only moves around the page launches nothing, so it does not wake the engine
     (28 Oct; found in a profile: every held arrow on the wall woke the context and
     kept its audio thread busy, 4.6 s of a 12 s run, with only the wall open). A held key's
     repeats are left out for the same reason. Enter, OK, Space, A and every pointer press still
     wake it inside the press, as before. */
  const NAV_KEYS = { ArrowUp: 1, ArrowDown: 1, ArrowLeft: 1, ArrowRight: 1, PageUp: 1, PageDown: 1, Home: 1, End: 1,
                     Tab: 1, Shift: 1, Control: 1, Alt: 1, Meta: 1, CapsLock: 1 };
  function onGesture(e) {
    if (!e.isTrusted) return;
    if (e.type === 'keydown' && (e.repeat || NAV_KEYS[e.key])) return;
    stats.gestures++;
    try { if (armed && !armed(e)) return; } catch (_) { return; }
    wake(true);
  }
  /* `when(e)` says whether this press may wake the engine (the host flag is on). */
  function armGestures(when) {
    const first = !armed;
    armed = typeof when === 'function' ? when : () => true;
    if (first) for (const t of GESTURES) window.addEventListener(t, onGesture, { capture: true, passive: true });
  }

  /* ------------------------------------------------------------------ the sink */
  function lend(opts = {}) {
    if (lease) lease.release();
    const c = ensure();
    if (!c) return null;
    const s = new Sink(c, opts);
    lease = s;
    stats.leases++;
    clearTimeout(idleTimer);
    if (opts.owner) { try { opts.owner.__cwLease = s.token; } catch (_) {} }
    return s;
  }

  let tokens = 0;
  function Sink(c, opts) {
    this.ctx = c;
    this.token = ++tokens;
    this.owner = opts.owner || null;
    this.filtered = !!opts.filtered;
    this.targetMs = opts.latencyMs || (window.isSecureContext ? 60 : 100);
    this.maxMs = Math.max(150, this.targetMs * 2.2);
    this.muted = !!opts.muted;
    this.volume = opts.volume == null ? 1 : +opts.volume;
    this.held = false;
    this.seq = 0; this.pending = [];          // [seq, frames] posted, not yet acknowledged
    this.reported = 0; this.under = 0; this.dropped = 0; this.pushedFrames = 0; this.lostBeforeReady = 0;
    this.servo = 1;
    this.clearedAt = 0;
    this.rs = { pos: 0, l: 0, r: 0 };         // resampler state
    this.alive = true;
    this.node = null; this.sp = null; this.ring = null;
    this.gain = c.createGain();
    this.gain.gain.value = 0;
    this.out = this.gain;
    this.hp = null;
    if (!this.filtered) {
      this.hp = c.createBiquadFilter();
      this.hp.type = 'highpass'; this.hp.frequency.value = 20; this.hp.Q.value = 0.7071;
      this.hp.connect(this.gain);
    }
    this.gain.connect(c.destination);
    this.ready = (workletReady || Promise.resolve(false)).then(ok => {
      if (!this.alive) return false;
      const into = this.hp || this.gain;
      if (ok) {
        this.node = new AudioWorkletNode(c, 'cw-audio', { numberOfInputs: 0, numberOfOutputs: 1, outputChannelCount: [2] });
        this.node.port.onmessage = e => this.onReport(e.data);
        this.node.connect(into);
        this.transport = 'worklet';
      } else if (typeof c.createScriptProcessor === 'function') {
        this.ring = new JsRing(Math.ceil(c.sampleRate * 2));
        const size = window.isSecureContext ? 1024 : 2048;
        this.sp = c.createScriptProcessor(size, 0, 2);
        this.sp.onaudioprocess = ev => this.ring.render(ev.outputBuffer);
        this.sp.connect(into);
        this.transport = 'script-processor';
      } else { this.transport = 'none'; return false; }
      stats.transport = this.transport;
      this.applyGain(true);
      return true;
    });
    this.watch = setInterval(() => {
      // The window that borrowed this sink went away or navigated: give it back.
      let gone = false;
      try { gone = !!this.owner && (this.owner.closed || this.owner.__cwLease !== this.token); } catch (_) { gone = true; }
      if (gone) this.release();
    }, 1500);
  }
  Sink.prototype = {
    get rate() { return this.ctx.sampleRate; },
    state() { return this.ctx.state; },
    /* Inside a press in the play window: the activation reaches this context too. */
    resume() { try { const p = this.ctx.resume(); if (p && p.catch) p.catch(() => {}); } catch (_) {} return this.ctx.state; },
    onReport(m) {
      if (m.t !== 'q') return;
      while (this.pending.length && this.pending[0][0] <= m.seq) this.pending.shift();
      this.reported = m.n; this.under = m.under; this.dropped = m.dropped;
      // (2 Nov 2026) The adaptive target of 29 Oct and 1 Nov (a sink that raised its own
      // queue at underruns and near misses, 50 or 80 ms up to 150 or 250, for the colour units alone)
      // is gone: the play windows run at 60 pictures a second and accept a missed frame on a slow
      // machine; every console now has the one standard queue (host.mjs WORKER_AUDIO_MS for a worker
      // core). Measured at a steady 60 the colour units' queue never underran at 70 to 100 ms.
    },
    queuedFrames() {
      if (this.ring) return this.ring.n;
      let n = this.reported; for (const p of this.pending) n += p[1]; return n;
    },
    queuedMs() { return this.queuedFrames() * 1000 / this.ctx.sampleRate; },
    /* The rate a self-resampling core should produce now: the device's, nudged by at
       most 0.5 % towards the target queue (the Atari / NES / twin worklets' method). */
    rateHint() { this.updateServo(); return this.ctx.sampleRate * this.servo; },
    updateServo() {
      const q = this.queuedMs(), t = this.targetMs;
      // Reaches its full 0.5 % at half the target's distance (28 Oct 2026; it was 0.5 % only at
      // an empty or doubled queue, so a worker core's bursts left the queue 20-40 ms above the target).
      const k = Math.max(-0.005, Math.min(0.005, (t - q) / t * 0.01));
      this.servo = 1 + k;
    },
    /* data: Int16Array or Float32Array, interleaved when channels = 2, at srcRate. */
    push(data, frames, channels, srcRate) {
      if (!this.alive || this.held) return 0;
      if (!this.node && !this.ring) { this.lostBeforeReady += frames; return 0; }
      if (this.queuedMs() > this.maxMs) { this.trim(); }
      const outRate = this.ctx.sampleRate;
      // By element size, not instanceof: the block comes from the play frame's realm.
      const scale = data.BYTES_PER_ELEMENT === 2 ? 1 / 32768 : 1;
      // The drift servo is read here on every block (28 Oct 2026). Before, only rateHint()
      // updated it, which a core that does not resample itself (the colour units, 48,004 Hz) never calls
      // after its creation: the servo stayed at the +0.5 % it got with an empty queue, every block was
      // stretched by 0.5 %, the queue climbed 5-15 ms a second past its target and was emptied by trim()
      // every 20 s (a 220 ms gap), and a sound effect sat 150-230 ms in the queue instead of the target.
      if (srcRate && Math.abs(srcRate - outRate) > 1) this.updateServo();
      const step = (srcRate || outRate) / (outRate * (srcRate && Math.abs(srcRate - outRate) > 1 ? this.servo : 1));
      let out;
      if (Math.abs(step - 1) < 1e-9) {
        out = new Float32Array(frames * 2);
        for (let i = 0; i < frames; i++) {
          const l = data[i * channels] * scale, r = channels > 1 ? data[i * channels + 1] * scale : l;
          out[i * 2] = l; out[i * 2 + 1] = r;
        }
      } else {
        // Linear resampling with a carried phase (no seam between blocks).
        const rs = this.rs, n = Math.max(0, Math.floor((frames - rs.pos) / step) + 1);
        out = new Float32Array(n * 2);
        let k = 0, pos = rs.pos;
        while (pos < frames && k < n) {
          const i = Math.floor(pos), f = pos - i;
          const l0 = i === 0 ? rs.l : data[(i - 1) * channels] * scale;
          const r0 = i === 0 ? rs.r : (channels > 1 ? data[(i - 1) * channels + 1] * scale : l0);
          const l1 = data[i * channels] * scale, r1 = channels > 1 ? data[i * channels + 1] * scale : l1;
          out[k * 2] = l0 + (l1 - l0) * f; out[k * 2 + 1] = r0 + (r1 - r0) * f;
          k++; pos += step;
        }
        rs.pos = pos - frames;
        rs.l = data[(frames - 1) * channels] * scale; rs.r = channels > 1 ? data[(frames - 1) * channels + 1] * scale : rs.l;
        if (k < n) out = out.subarray(0, k * 2);
      }
      const nf = out.length >> 1;
      if (!nf) return 0;
      this.pushedFrames += nf;
      if (this.ring) this.ring.write(out);
      else { const seq = ++this.seq; this.pending.push([seq, nf]); this.node.port.postMessage({ t: 'push', d: out, seq }, [out.buffer]); }
      return nf;
    },
    trim() {
      // Over the bound: start again from silence rather than play a backlog (the
      // audio-queue.js HIGH / LOW rule, made universal).
      this.clear();
    },
    clear() {
      if (this.ring) this.ring.clear();
      if (this.node) { this.node.port.postMessage({ t: 'clear' }); this.pending.length = 0; this.reported = 0; }
      this.rs.pos = 0;
      this.clearedAt = performance.now();
    },
    /* A hold: the player's pause, a panel, rewind, a hidden tab, close. Fade, then drop
       what is queued so the resume starts clean (the Game Boy's applyGain rule). */
    hold(on) {
      on = !!on;
      if (on === this.held) return;
      this.held = on;
      this.applyGain();
      if (on) setTimeout(() => { if (this.held) this.clear(); }, 20);
      else this.clear();
    },
    /* A deeper queue for a source whose blocks arrive unevenly (a core on a worker thread,
       R4, 2026-10-15): the target and the refill after a gap both become `ms`, so the queue
       has headroom when a frame is late, and a gap, when it happens, is one gap, not a train. */
    setBuffer(ms) {
      ms = Math.max(30, Math.min(250, +ms || 60));
      this.targetMs = ms; this.maxMs = Math.max(150, ms * 2.2);
      const frames = Math.ceil(this.ctx.sampleRate * ms / 1000);
      this.ready.then(ok => {
        if (!ok || !this.alive) return;
        if (this.node) this.node.port.postMessage({ t: 'prefill', frames });
        if (this.ring) this.ring.prefill = frames;
      });
      return ms;
    },
    setMuted(m) { this.muted = !!m; this.applyGain(); },
    setVolume(v) { this.volume = Math.max(0, Math.min(1, +v)); this.applyGain(); },
    applyGain(now) {
      const want = (this.muted || this.held) ? 0 : this.volume;
      const g = this.gain.gain, t = this.ctx.currentTime;
      try { g.cancelScheduledValues(t); if (now) g.setValueAtTime(want, t); else g.setTargetAtTime(want, t, FADE_TC); } catch (_) { g.value = want; }
    },
    info() {
      return { transport: this.transport || null, rate: this.ctx.sampleRate, state: this.ctx.state, queuedMs: Math.round(this.queuedMs()), targetMs: this.targetMs,
        underruns: this.ring ? this.ring.under : this.under, dropped: this.ring ? this.ring.dropped : this.dropped,
        pushedFrames: this.pushedFrames, lostBeforeReady: this.lostBeforeReady, servo: +this.servo.toFixed(5), muted: this.muted, held: this.held };
    },
    release() {
      if (!this.alive) return;
      this.alive = false;
      clearInterval(this.watch);
      try { this.gain.gain.setTargetAtTime(0, this.ctx.currentTime, FADE_TC); } catch (_) {}
      const nodes = [this.node, this.sp, this.hp, this.gain];
      setTimeout(() => { for (const n of nodes) { try { n && n.disconnect(); } catch (_) {} } if (this.sp) this.sp.onaudioprocess = null; }, 40);
      if (lease === this) { lease = null; reserveUntil = 0; setTimeout(scheduleIdle, 60); }
    },
  };

  /* The ScriptProcessor fallback's ring (plain HTTP by LAN address: the TV). */
  function JsRing(cap) { this.cap = cap; this.b = new Float32Array(cap * 2); this.r = 0; this.w = 0; this.n = 0; this.primed = false; this.prefill = 1024; this.under = 0; this.dropped = 0; this.l = 0; this.rr = 0; }
  JsRing.prototype.clear = function () { this.r = this.w = this.n = 0; this.primed = false; };
  JsRing.prototype.write = function (d) {
    const f = d.length >> 1;
    for (let i = 0; i < f; i++) {
      if (this.n >= this.cap) { this.r = (this.r + 1) % this.cap; this.n--; this.dropped++; }
      this.b[this.w * 2] = d[i * 2]; this.b[this.w * 2 + 1] = d[i * 2 + 1]; this.w = (this.w + 1) % this.cap; this.n++;
    }
  };
  JsRing.prototype.render = function (ob) {
    const L = ob.getChannelData(0), R = ob.numberOfChannels > 1 ? ob.getChannelData(1) : null, len = L.length;
    if (!this.primed && this.n >= this.prefill) this.primed = true;
    for (let i = 0; i < len; i++) {
      if (this.primed && this.n > 0) { this.l = this.b[this.r * 2]; this.rr = this.b[this.r * 2 + 1]; this.r = (this.r + 1) % this.cap; this.n--; }
      else { if (this.primed) { this.under++; this.primed = false; } this.l *= 0.995; this.rr *= 0.995; }
      L[i] = this.l; if (R) R[i] = this.rr;
    }
  };

  window.CwPlayAudio = {
    BUILD, stats,
    get ctx() { return ctx; },
    get leased() { return !!lease; },
    ensure, wake, reserve, armGestures, lend,
    state: () => (ctx ? ctx.state : 'none'),
  };
})();
