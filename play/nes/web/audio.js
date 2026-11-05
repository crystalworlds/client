/* audio.js — the main thread's end of the audio path.
 *
 * Owns the AudioContext, the consumer node and the ring, and resamples the
 * core's output rate to the device rate.
 *
 * There are TWO consumer transports and the ring is the same ring for both.
 * An AudioWorkletNode when the browser grants one, and a ScriptProcessorNode
 * when it does not — see THE TWO TRANSPORTS below, which is where the reason
 * is written down, because the reason is not a preference.
 *
 * WHY RESAMPLE AT ALL.  The APU emits one sample every `mix_div` CPU cycles.
 * At the NTSC CPU rate of 1789773 Hz, a divider of 40 gives 44744 Hz — close
 * to 44100 but not equal, and never equal to a device running at 48000.  Left
 * alone the ring drifts: it fills and the emulator stalls, or it empties and
 * the consumer holds samples.  A fixed divider cannot fix this because the
 * error depends on the DEVICE rate, which is not known until the AudioContext
 * exists.
 *
 * THE SERVO.  Rather than pick a divider and hope, the ring's fill level
 * drives a small correction to the resampling ratio: fuller than target means
 * consume slightly faster, emptier means slightly slower.  The correction is
 * capped at 0.5%, which is inaudible as pitch and is far more than the worst
 * clock error.  This is the same shape as the Game Boy core's servo and for
 * the same reason.  It reads the ring through the same atomic indices on both
 * transports, so it is one servo and not two.
 */

/* Bumped whenever audio-worklet.js OR this module changes, so a cached worklet
 * cannot outlive the module that talks to it. */
export const WORKLET_VERSION = '20260930-nes2';

export const RING_LEN = 1 << 15;
export const TARGET_FILL = 0.5;
const MAX_TRIM = 0.005;
/* Above this fill the servo is abandoned for the frame and input is dropped. */
const HIGH_WATER = 0.70;

/* ---------------------------------------------------------------------------
 *  THE TWO TRANSPORTS
 *
 *  The worklet path has two requirements, and a page only gets both when it is
 *  BOTH a secure context AND cross-origin isolated:
 *
 *    - BaseAudioContext.audioWorklet is [SecureContext]. Over plain HTTP to
 *      anything but localhost it is `undefined`, so
 *      `await this.ctx.audioWorklet.addModule(...)` throws
 *      "Cannot read properties of undefined (reading 'addModule')" — and it
 *      threw BEFORE the SharedArrayBuffer check below could reach a decision,
 *      which is why that check never got the chance to report anything. The
 *      order of those two steps is therefore part of the fix, not tidying.
 *    - SharedArrayBuffer needs COOP/COEP. Without it the ring can only be a
 *      plain ArrayBuffer, which reaches a worklet through processorOptions as
 *      a structured-clone COPY: the worklet would drain a ring nobody writes
 *      and play its prefilled silence forever.
 *
 *  tools/serve.py sends COOP/COEP and localhost is a secure context, so the
 *  bench and the desktop have both and never leave the worklet path. The same
 *  server opened by IP over plain HTTP — 192.168.1.50:8080 on a TV or a phone —
 *  has neither. That is the whole of "plays perfectly, makes no sound on the
 *  TV": not an APU defect, not a ring defect, a transport that was not there.
 *
 *  A ScriptProcessorNode is deprecated but not absent, and two properties make
 *  it the right fallback rather than merely an available one. It exists in an
 *  insecure context; and its callback runs on the MAIN thread — the same thread
 *  as the producer — so a plain ArrayBuffer ring is not a copy across a
 *  boundary, it is the very same object. One fallback answers both failures.
 *
 *  The body below is a port of audio-worklet.js's process(): the same read, the
 *  same hold-the-last-sample underrun policy, the same underrun counter in the
 *  same index slot. `fill` and `underruns` therefore report the same numbers on
 *  both paths and the readout cannot tell which transport produced it.
 * ------------------------------------------------------------------------- */
const SP_BLOCK = 2048;          /* ~43 ms at 48 kHz. The largest legal size
                                 * deliberately: this callback shares the main
                                 * thread with the emulator, so latency is the
                                 * cheaper thing to spend than dropouts. */

function createRingScriptProcessor(ctx, ring, idx, pump) {
  /* One INPUT channel is requested although nothing is ever connected to it.
   * Zero-input ScriptProcessorNodes are legal and work in Chrome, but have
   * historically not fired at all in some WebKit builds, and this fallback
   * exists precisely for the browsers nobody here can test. */
  const node = ctx.createScriptProcessor(SP_BLOCK, 1, 2);
  let last = 0;
  node.onaudioprocess = e => {
    const out = e.outputBuffer;
    const n = out.length;
    /* PUMP THE PRODUCER FIRST, which the worklet path cannot do and does not
     * need to: over there the producer is another thread and the ring absorbs
     * the phase difference. Here the producer is THIS thread, so running it
     * immediately before draining removes a whole block of latency — up to
     * 43 ms — and removes the underruns that a producer interval arriving late
     * would otherwise book. It cannot make the emulator run fast: the shell's
     * step is driven by a wall-clock accumulator, so a call with no elapsed
     * time runs no frames and writes nothing. */
    if (pump) pump();
    const o0 = out.getChannelData(0);
    const w = Atomics.load(idx, 0);
    let r = Atomics.load(idx, 1);
    let under = 0;
    for (let i = 0; i < n; i++) {
      if (r < w) { last = ring[r & (RING_LEN - 1)]; r++; }
      else under++;
      o0[i] = last;
    }
    Atomics.store(idx, 1, r);
    if (under) Atomics.add(idx, 2, under);
    /* The NES is mono; duplicating into the second channel is correct and
     * cheaper than a channel merger node, exactly as the worklet does it. */
    const o1 = out.numberOfChannels > 1 ? out.getChannelData(1) : null;
    if (o1) o1.set(o0);
  };
  return node;
}

/* ---------------------------------------------------------------------------
 *  THE PRODUCER, ON ITS OWN
 *
 *  Everything that WRITES the ring lives in this class and nothing else does.
 *  It exists as a separate object for one reason: web/worker.js runs the
 *  emulator on another thread and has to fill the same ring, and the
 *  alternative was a second resampler over there.
 *
 *  A SECOND COPY WOULD BE A SECOND THING TO MEASURE AND A SECOND THING TO GET
 *  WRONG — the same argument that kept one producer across the two consumer
 *  transports, applied to the two producer threads. The servo, the constants,
 *  the high-water drop and the interpolation are shared by construction rather
 *  than by both files being kept in step by hand.
 *
 *  It touches no AudioContext and no DOM, so it runs unchanged on the main
 *  thread and in a worker. Atomics.load/store/add are defined on a non-shared
 *  ArrayBuffer as well as a shared one — only Atomics.wait needs shared memory,
 *  and this path never waits.
 * ------------------------------------------------------------------------- */
export class RingProducer {
  constructor(ring, idx, ratio = 1) {
    this.ring = ring; this.idx = idx;
    this.ratio = ratio; this.phase = 0; this.prev = 0;
    this.drops = 0;
  }
  /** Attach to a ring that arrived over postMessage. */
  static attach({ ring, idx }, ratio = 1) {
    return new RingProducer(new Float32Array(ring), new Int32Array(idx), ratio);
  }
  get fill() { return (Atomics.load(this.idx, 0) - Atomics.load(this.idx, 1)) / RING_LEN; }
  get underruns() { return Atomics.load(this.idx, 2); }
  /** Drop everything the consumer has not taken. Used on a cartridge switch:
   * the ring can be carrying ~170 ms of the title that was playing before. */
  clear() { Atomics.store(this.idx, 0, Atomics.load(this.idx, 1)); this.phase = 0; this.prev = 0; }

  push(src) {
    if (!src || !src.length) return;
    const fill = this.fill;
    if (fill > HIGH_WATER) {
      /* Keep only the newest tail — the ring already holds more than enough
       * to cover the next callbacks. */
      const keep = Math.max(1, Math.floor(src.length * 0.25));
      src = src.subarray(src.length - keep);
      this.drops++;
    }
    const trim = 1 + Math.max(-MAX_TRIM, Math.min(MAX_TRIM, (fill - TARGET_FILL) * 0.1));
    const step = this.ratio * trim;
    let w = Atomics.load(this.idx, 0);
    const r = Atomics.load(this.idx, 1);
    let p = this.phase;
    let i = 0;
    while (i < src.length) {
      /* Drop if the ring is genuinely full — better one lost sample than an
       * index that laps the reader and plays old audio as new. */
      if (w - r >= RING_LEN) break;
      const a = i === 0 ? this.prev : src[i - 1];
      const b = src[i];
      this.ring[w & (RING_LEN - 1)] = ((a + (b - a) * p) / 32768);
      w++;
      p += step;
      while (p >= 1 && i < src.length) { p -= 1; i++; }
    }
    this.prev = src[src.length - 1];
    this.phase = p;
    Atomics.store(this.idx, 0, w);
  }
}

export class NesAudio {
  constructor() {
    this.ctx = null; this.node = null;
    this.ring = null; this.idx = null;
    this.producer = null;
    this.coreRate = 0;
    this.enabled = false;
    /* Which consumer is actually running: 'AudioWorklet' or 'ScriptProcessor'.
     * Null until start() has decided. */
    this.transport = null;
    /* One sentence naming the fallback and why it was taken, for the shell to
     * say out loud. A fallback nobody was told about gets blamed for something
     * else later — a muffled title, a pacing complaint — so it is never taken
     * silently. Null on the worklet path. */
    this.notice = null;
    /* Set only when audio cannot work at all. The shell's sound button treats
     * it as final, so a working fallback must never set it. */
    this.unsupported = null;
    /* The shell's producer, called at the top of every ScriptProcessor
     * callback. See PUMP THE PRODUCER FIRST above. Unused on the worklet
     * path, where the producer is on the other side of a thread boundary. */
    this.pump = null;
  }

  /* Must be called from a user gesture — browsers will not start an
   * AudioContext otherwise, and a silent emulator with no error is the single
   * most common "it's broken" report. */
  /* The core has been running since power-on and its APU FIFO holds every
   * sample produced since. Handing that backlog to a fresh ring is what put
   * 620ms of latency on the first measured run. The caller drains the core
   * before the first push; primeFrom() is the hook that makes that explicit. */
  primeFrom(core) { while (core.audioAvailable() > 0) core.readAudio(4096); }

  async start(coreRate) {
    if (this.ctx) return;
    this.coreRate = coreRate;
    this.ctx = new (window.AudioContext || window.webkitAudioContext)();

    /* DECIDE THE TRANSPORT BEFORE TOUCHING EITHER HALF OF IT. Both tests are
     * cheap property reads that cannot throw; addModule() can, and did. */
    const haveWorklet = !!this.ctx.audioWorklet;
    const haveShared = typeof SharedArrayBuffer !== 'undefined' && !!self.crossOriginIsolated;
    let useWorklet = haveWorklet && haveShared;

    /* A SharedArrayBuffer is only needed to cross a thread boundary. The
     * ScriptProcessor does not cross one, so a plain ArrayBuffer is not a
     * degraded ring there — it is the same memory the producer writes. */
    const Buf = useWorklet ? SharedArrayBuffer : ArrayBuffer;
    this.ring = new Float32Array(new Buf(RING_LEN * 4));
    this.idx = new Int32Array(new Buf(16));

    if (useWorklet) {
      try {
        /* RESOLVE THE WORKLET AGAINST THIS MODULE, NOT THE DOCUMENT.
         *
         * addModule() takes a URL resolved against the *document* base, not
         * against this file. In the development bench that is invisible, because the
         * bench page and this module sit in the same directory. Vendored into
         * the website the page is play/nes/index.html and this module is
         * play/nes/web/audio.js, so './audio-worklet.js' asked for
         * play/nes/audio-worklet.js and got a 404 — audio silently unavailable
         * on the site while working perfectly in the development tree. import.meta.url is
         * correct in both trees and in any tree. */
        const workletUrl = new URL('./audio-worklet.js?v=' + WORKLET_VERSION, import.meta.url);
        await this.ctx.audioWorklet.addModule(workletUrl);
        this.node = new AudioWorkletNode(this.ctx, 'nes-audio', {
          numberOfInputs: 0, outputChannelCount: [2],
          processorOptions: { ring: this.ring.buffer, idx: this.idx.buffer },
        });
      } catch (e) {
        /* The context is cross-origin isolated and secure, so this is a real
         * defect — a missing file, a wrong MIME type — and not the LAN case.
         * Falling back still makes sound, and carrying the message through
         * means the defect is reported rather than swallowed by working audio. */
        useWorklet = false;
        this.node = null;
        this.notice = `the AudioWorklet module would not load (${e && e.message || e}); ` +
                      `using the ScriptProcessor fallback instead.`;
      }
    }

    if (!useWorklet) {
      if (typeof this.ctx.createScriptProcessor !== 'function') {
        /* No worklet and no ScriptProcessor is the only genuinely mute case,
         * and it is the only one that sets `unsupported`. */
        this.unsupported = 'this browser offers neither AudioWorklet nor ScriptProcessor — audio disabled';
        return;
      }
      if (!this.notice) {
        this.notice = `no AudioWorklet transport here (${haveWorklet
          ? 'no SharedArrayBuffer — the worklet would hold a COPY of the ring'
          : 'insecure context — audioWorklet is undefined'}); using the ` +
          `ScriptProcessor fallback. This page is ` +
          `${self.isSecureContext ? '' : 'not '}a secure context and is ` +
          `${self.crossOriginIsolated ? '' : 'not '}cross-origin isolated.`;
      }
      this.node = createRingScriptProcessor(this.ctx, this.ring, this.idx,
                                            () => { if (this.pump) this.pump(); });
      /* PREFILL ONE BLOCK OF SILENCE, on this path only. The worklet's render
       * quantum is 128 samples, which is shorter than the producer's interval,
       * so a cold start there books a handful of underruns at most. A 2048
       * sample block is longer than the interval: the first callback would
       * drain an all but empty ring and book about 1800 underruns before the
       * producer had run twice — a start-up artefact sitting in the very
       * counter built to catch real dropouts. The ring is already zeroed, so
       * publishing the write index is the whole prefill; it costs exactly one
       * callback period of latency, which pumping the producer first gives
       * back. */
      Atomics.store(this.idx, 0, SP_BLOCK);
    }

    this.transport = useWorklet ? 'AudioWorklet' : 'ScriptProcessor';
    this.node.connect(this.ctx.destination);
    this.producer = new RingProducer(this.ring, this.idx, this.coreRate / this.ctx.sampleRate);
    this.enabled = true;
    await this.ctx.resume();
  }

  /* HAND THE RING TO A WORKER, and the ring only. The page owns the
   * AudioContext — it needs a user gesture and cannot be transferred — so what
   * crosses the boundary is the buffer the producer writes and the consumer
   * drains, which is all a producer needs.
   *
   * WORKER AUDIO REQUIRES SHARED MEMORY AND THIS SAYS SO RATHER THAN DEGRADING
   * QUIETLY. On the ScriptProcessor path the ring is a plain ArrayBuffer,
   * which reaches a worker as a structured-clone COPY: the worker would fill a
   * ring nobody drains and the page would play its prefilled silence for ever.
   * That is the same failure the worklet path has without COOP/COEP, and it is
   * refused here for the same reason. */
  transferable() {
    if (!this.ring) throw new Error('audio has not started');
    if (!(this.ring.buffer instanceof (globalThis.SharedArrayBuffer || function () {})))
      throw new Error('the ring is not shared (ScriptProcessor transport): a worker would ' +
                      'receive a copy and fill a ring nobody drains. Run the emulator on the ' +
                      'main thread on this transport.');
    return { ring: this.ring.buffer, idx: this.idx.buffer, rate: this.ctx.sampleRate };
  }

  /* THE CORE'S RATE CHANGES WITH THE CARTRIDGE'S REGION: a page
   * that started sound on an NTSC cartridge and then mounts a PAL one must
   * re-rate the resampler, or the PAL machine's samples are played as NTSC
   * ones.  Before start() it only records the rate start() will use. */
  setCoreRate(coreRate) {
    this.coreRate = coreRate;
    if (this.producer && this.ctx) this.producer.ratio = coreRate / this.ctx.sampleRate;
  }

  get ratio() { return this.producer ? this.producer.ratio : 1; }
  get drops() { return this.producer ? this.producer.drops : 0; }
  get fill() {
    if (!this.idx) return 0;
    return (Atomics.load(this.idx, 0) - Atomics.load(this.idx, 1)) / RING_LEN;
  }
  get underruns() { return this.idx ? Atomics.load(this.idx, 2) : 0; }

  /* Push one frame's worth of core samples through the resampler into the
   * ring. `src` is Int16Array straight from nes_audio_read().
   *
   * ONE PRODUCER FOR BOTH TRANSPORTS. Nothing below branches on which consumer
   * is running, and nothing needs to: Atomics.load/store/add are defined on a
   * non-shared ArrayBuffer as well as a shared one — only Atomics.wait requires
   * shared memory, and this path never waits. So the servo and the catch-up
   * below are the same code, with the same constants, on the LAN as on the
   * desk. A second copy tuned for the fallback would be a second thing to
   * measure and a second thing to get wrong.
   *
   * LATENCY, not just underruns, is the thing to hold.  The ring is 32768
   * samples; at 48kHz a ring sitting 91% full is 620ms of audio behind the
   * picture, which is unplayable even though the underrun count is a
   * blameless zero.  Measured: exactly that, 0.913 fill and 0 underruns, on
   * the first run after the pacing fix, because enabling audio dumped the
   * core's whole accumulated backlog into an empty ring in one push.
   *
   * Two mechanisms, because one is not enough:
   *   - the SERVO trims the resample ratio by at most 0.5%, which is
   *     inaudible and corrects slow clock drift.  It cannot correct 40% of a
   *     ring, and should not try: a 40% ratio change is a pitch bend.
   *   - the CATCH-UP drops input samples outright above HIGH_WATER.  A drop
   *     is a click, which is why it is never used for drift, and why it is
   *     the right answer for a backlog: one click now against permanent lag. */
  /* THE BODY MOVED TO RingProducer AND NOTHING ELSE CHANGED. It is one object
   * up so that web/worker.js can fill the same ring with the same code rather
   * than with a copy of it; every constant, the servo, the high-water drop and
   * the interpolation are where they were. */
  push(src) { if (this.enabled && this.producer) this.producer.push(src); }

  /* Tear both transports down through the same call. The ScriptProcessor has
   * no port, and its callback holds a reference to the shell's producer, so
   * clearing the handler is not tidying: a node left with a live
   * onaudioprocess goes on stepping the emulator after audio has stopped. */
  async stop() {
    if (this.node) {
      if (this.node.port) this.node.port.postMessage('stop');
      else this.node.onaudioprocess = null;
      this.node.disconnect();
      this.node = null;
    }
    if (this.ctx) await this.ctx.close();
    this.ctx = null; this.enabled = false; this.transport = null; this.producer = null;
  }
}
