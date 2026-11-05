/* audio.js — the audio transport. the UI design, section 19.
 *
 * DOM-free and APU-free on purpose. The hard part of browser audio is not the
 * emulator's sample format but the two clocks either side of it: the device's
 * AudioContext runs at a rate we do not choose and cannot change, and the APU
 * will produce samples at a divisor of 4194304 Hz. Those rates are unrelated
 * and drift against each other forever, so a ring and a resampler are required
 * whatever the Audio role answers for A1-A3.
 *
 * Everything here is therefore buildable and testable before the APU exists,
 * and test/ui_net.py drives all of it under Node with no AudioContext at all.
 */

/* ---------------------------------------------------------------------------
 *  AudioRing — single-producer / single-consumer, lock-free.
 *
 *  Cursors are MONOTONIC frame counts, not wrapped offsets, so occupancy is a
 *  subtraction and the empty and full cases cannot be confused (the classic
 *  wrapped-index bug where head == tail means both). They are int32 and will
 *  wrap after about twelve hours at 48 kHz; the subtraction stays correct
 *  through the wrap because both wrap identically, which is why occupancy is
 *  computed as (w - r) | 0 and never as a comparison.
 * ------------------------------------------------------------------------- */
export class AudioRing {
  /**
   * @param {number} frames capacity in frames (per channel)
   * @param {number} channels
   * @param {boolean} shared use a SharedArrayBuffer when available
   */
  constructor(frames, channels = 2, shared = true) {
    this.frames = frames;
    this.channels = channels;
    const Buf = (shared && typeof SharedArrayBuffer !== "undefined")
      ? SharedArrayBuffer : ArrayBuffer;
    this.shared = Buf !== ArrayBuffer;
    this.ctrl = new Int32Array(new Buf(8));         /* [0]=read, [1]=write */
    this.data = new Float32Array(new Buf(frames * channels * 4));
  }

  /** Rebuild a view over buffers received across a postMessage/worklet boundary. */
  static attach({ ctrl, data, frames, channels }) {
    const r = Object.create(AudioRing.prototype);
    r.frames = frames; r.channels = channels;
    r.ctrl = new Int32Array(ctrl);
    r.data = new Float32Array(data);
    r.shared = typeof SharedArrayBuffer !== "undefined" && ctrl instanceof SharedArrayBuffer;
    return r;
  }
  transferable() {
    return { ctrl: this.ctrl.buffer, data: this.data.buffer,
             frames: this.frames, channels: this.channels };
  }

  get _r() { return Atomics.load(this.ctrl, 0); }
  get _w() { return Atomics.load(this.ctrl, 1); }
  /** Frames available to read. */
  get available() { return (this._w - this._r) | 0; }
  /** Frames of room to write. */
  get space() { return this.frames - this.available; }
  get occupancy() { return this.available / this.frames; }

  /**
   * Write interleaved frames. Returns frames actually written — a short write
   * is an OVERRUN and the caller must notice it, so nothing is silently
   * dropped here.
   */
  write(src, nFrames) {
    const n = Math.min(nFrames, this.space);
    if (n <= 0) return 0;
    const ch = this.channels;
    let w = this._w;
    for (let i = 0; i < n; i++) {
      const slot = (((w + i) % this.frames) + this.frames) % this.frames;
      for (let c = 0; c < ch; c++) this.data[slot * ch + c] = src[i * ch + c];
    }
    /* The data write must be visible before the cursor that publishes it. */
    Atomics.store(this.ctrl, 1, (w + n) | 0);
    return n;
  }

  /** Read interleaved frames into dst. Returns frames actually read. */
  read(dst, nFrames) {
    const n = Math.min(nFrames, this.available);
    if (n <= 0) return 0;
    const ch = this.channels;
    let r = this._r;
    for (let i = 0; i < n; i++) {
      const slot = (((r + i) % this.frames) + this.frames) % this.frames;
      for (let c = 0; c < ch; c++) dst[i * ch + c] = this.data[slot * ch + c];
    }
    Atomics.store(this.ctrl, 0, (r + n) | 0);
    return n;
  }

  clear() { Atomics.store(this.ctrl, 0, 0); Atomics.store(this.ctrl, 1, 0); }
}

/* ---------------------------------------------------------------------------
 *  Resampler — linear interpolation on a fractional accumulator.
 *
 *  The same shape as the frame pacer, and correct for the same reason: the
 *  residue is KEPT between calls, so there is no systematic bias. Dropping it
 *  each block would lose a fraction of a sample every block, which at 48 kHz
 *  and 128-frame blocks is a drift of several seconds an hour.
 * ------------------------------------------------------------------------- */
export class Resampler {
  constructor(channels, inRate, outRate) {
    this.channels = channels;
    this.setRates(inRate, outRate);
    this.pos = 0;                                   /* fractional input position */
    this.last = new Float32Array(channels);         /* previous input frame */
    this.primed = false;
  }
  setRates(inRate, outRate) {
    this.inRate = inRate; this.outRate = outRate;
    this.step = inRate / outRate;                   /* input frames per output frame */
  }
  reset() { this.pos = 0; this.primed = false; this.last.fill(0); }

  /** How many output frames a block of nIn input frames will yield. */
  outputFor(nIn) {
    return Math.max(0, Math.ceil((nIn - this.pos) / this.step));
  }

  /**
   * @param {Float32Array} input interleaved
   * @param {number} nIn frames
   * @param {Float32Array} out interleaved, at least outputFor(nIn) frames
   * @returns {number} output frames produced
   */
  process(input, nIn, out) {
    const ch = this.channels;
    let produced = 0;
    if (!this.primed && nIn > 0) {
      for (let c = 0; c < ch; c++) this.last[c] = input[c];
      this.primed = true;
    }
    while (this.pos < nIn) {
      const i = Math.floor(this.pos);
      const frac = this.pos - i;
      for (let c = 0; c < ch; c++) {
        const a = i === 0 ? this.last[c] : input[(i - 1) * ch + c];
        const b = input[i * ch + c];
        out[produced * ch + c] = a + (b - a) * frac;
      }
      produced++;
      this.pos += this.step;
    }
    this.pos -= nIn;                                /* keep the residue */
    if (nIn > 0) for (let c = 0; c < ch; c++) this.last[c] = input[(nIn - 1) * ch + c];
    return produced;
  }
}

/* ---------------------------------------------------------------------------
 *  ToneSource — a synthetic producer.
 *
 *  This is what makes the whole audio path testable with no APU at all, and
 *  more importantly it is what lets the underrun and drift instruments be
 *  calibrated against a KNOWN signal before they are ever pointed at the
 *  emulator. An instrument first used on the thing it is meant to measure has
 *  never been checked.
 * ------------------------------------------------------------------------- */
export class ToneSource {
  constructor(rate, freq = 440, channels = 2, amp = 0.2) {
    this.rate = rate; this.freq = freq; this.channels = channels; this.amp = amp;
    this.phase = 0;
  }
  /** Fill nFrames of interleaved output. Deterministic given the same phase. */
  render(out, nFrames) {
    const ch = this.channels, k = 2 * Math.PI * this.freq / this.rate;
    for (let i = 0; i < nFrames; i++) {
      const v = Math.sin(this.phase) * this.amp;
      this.phase += k;
      if (this.phase > 2 * Math.PI) this.phase -= 2 * Math.PI;
      for (let c = 0; c < ch; c++) out[i * ch + c] = v;
    }
    return nFrames;
  }
}

/** A deterministic ramp, for checking the ring loses and duplicates nothing. */
export class RampSource {
  constructor(channels = 2) { this.channels = channels; this.n = 0; }
  render(out, nFrames) {
    const ch = this.channels;
    for (let i = 0; i < nFrames; i++)
      for (let c = 0; c < ch; c++) out[i * ch + c] = this.n + i;
    this.n += nFrames;
    return nFrames;
  }
}

/**
 * Where this machine's silence actually sits.
 *
 * A DMG idles with its three powered DACs at digital zero, which through the
 * mixer is 3 x 15 x 8 / 480 = 0.75 of full scale, negative. Tetris sits exactly
 * here. It is NOT zero, and assuming it was is what produced the restore click:
 * the old underrun policy ramped to zero, which is 0.75 FS away from where the
 * machine was, and the restore stepped back across that gap.
 *
 * Named because it survived only as prose, and prose does not get imported. The
 * underrun target is DERIVED from it rather than restated: holding means the
 * target is whatever the last frame was, and this constant is what "silence"
 * means when a test or a future DC-blocking stage needs to say so.
 */
export const APU_IDLE_LEVEL = -(3 * 15 * 8) / 480;      /* = -0.75 FS */

/** The step the superseded ramp-to-zero policy left, in LSB, for reference. */
export const APU_IDLE_LSB = Math.round(Math.abs(APU_IDLE_LEVEL) * 32768);

/* ---------------------------------------------------------------------------
 *  UnderrunPolicy — HOLD the last frame, counted.
 *
 *  §19.4 as REVISED, and the original was wrong for a measured reason. It
 *  ramped to zero and latched zero, assuming silence is zero. It is not: a DMG
 *  idles with three powered DACs at digital zero, which is -0.75 of full scale
 *  on this core, and Tetris sits exactly there. Ramping to zero therefore moved
 *  0.75 FS AWAY from where the machine was, and the restore arrived back at
 *  -0.75 against a latched 0 -- a 24576 LSB step (APU_IDLE_LSB), louder than the music itself.
 *
 *  Holding is correct because a held DC level is INAUDIBLE (a speaker cannot
 *  reproduce DC) and it is the transition that clicks. Holding removes the edge
 *  at both ends, where a longer ramp would only have spread one out.
 *
 *  The COUNTER is untouched and still matters more than the sound: a policy
 *  good enough to hide underruns from the listener hides them from the
 *  developer too.
 * ------------------------------------------------------------------------- */
export function fillUnderrun(out, fromFrame, toFrame, channels, lastFrame) {
  for (let i = fromFrame; i < toFrame; i++)
    for (let c = 0; c < channels; c++) out[i * channels + c] = lastFrame[c];
}

/* ---------------------------------------------------------------------------
 *  Audio state. the UI design, section 20.3.
 *
 *  A pure function, deliberately, so every branch is checkable headlessly and
 *  the page cannot end up in a silence it has no words for. This exists because
 *  a shell with a working audio panel, a live ring readout and no sound is
 *  indistinguishable from a broken shell -- which is how "no sound" reached a
 *  play session. our method notes 9a: a path that reports nothing when it is not
 *  running is a check that cannot fail.
 *
 *  TOTAL by construction: every input combination returns a named state with a
 *  remedy, and the fallthrough is an explicit "unknown" rather than undefined.
 * ------------------------------------------------------------------------- */
export const AUDIO_STATES = [
  "no-abi", "not-started", "suspended", "muted", "starving", "running",
  "failed", "unknown",
];

/**
 * The one word to read back.
 *
 * Every state's name is a single hyphenated token deliberately: the fastest
 * useful thing a person can send from another room is a word, and "which of its
 * silences is it in" is answerable in one. The sentence is for the screen; this
 * is for the message.
 */
export function audioWord(st) {
  return (st && st.state ? st.state : "unknown").toUpperCase();
}

/**
 * @param {{hasAbi:boolean, ctxState:string|null, muted:boolean,
 *          underruns:number, level:number}} s
 */
export function audioState(s) {
  if (!s.hasAbi) {
    return { state: "no-abi", silent: true,
             label: "no audio output in this core build",
             detail: "the core exports no gb_audio_pull; nothing to play",
             remedy: null };
  }
  if (!s.ctxState) {
    return { state: "not-started", silent: true,
             label: "Press to enable sound.",
             detail: "browsers refuse audio until you interact with the page",
             remedy: "enable" };
  }
  if (s.ctxState === "suspended" || s.ctxState === "interrupted") {
    return { state: "suspended", silent: true,
             label: "Sound paused. Press to resume.",
             detail: `the browser suspended the audio context (${s.ctxState})`,
             remedy: "resume" };
  }
  if (s.muted) {
    return { state: "muted", silent: true,
             label: "muted",
             detail: "output is muted in this page",
             remedy: "unmute" };
  }
  if (s.ctxState === "running") {
    if (s.underruns > 0 && s.level <= 0) {
      return { state: "starving", silent: true,
               label: `running, but no samples arriving (underruns: ${s.underruns})`,
               detail: "the context is running and the ring is empty — the producer is not delivering",
               remedy: null };
    }
    return { state: "running", silent: false,
             label: s.underruns > 0 ? `playing (underruns: ${s.underruns})` : "playing",
             detail: `level ${(s.level * 100).toFixed(0)}%`,
             remedy: null };
  }
  /* Explicit rather than undefined: an unnamed state is the bug this file
   * exists to prevent. */
  return { state: "unknown", silent: true,
           label: `audio in an unrecognised state (${s.ctxState})`,
           detail: "report this — the state machine should be total",
           remedy: "enable" };
}

/* ---------------------------------------------------------------------------
 *  The core-side producer. Reads samples out of the emulator and into the ring.
 *
 *  Written against the export named in §20.4 BEFORE it exists, behind a
 *  capability check, so the day it lands nothing here changes:
 *
 *      int gb_audio_pull(struct GB *gb, short *dst, int frames, int rate)
 *
 *  Interleaved stereo s16; returns frames actually written; rate passed every
 *  call. The destination lives in the cart arena and is re-staged after a
 *  reclaim exactly as the BIOS is, so no second export is needed.
 * ------------------------------------------------------------------------- */
export const AUDIO_EXPORT = "gb_audio_pull";
export const AUDIO_FRAMES_MAX = 4096;

/* The core's own ring is APU_RING = 2048 frames, and apu_out drops the OLDEST
 * frame when it overflows. At 48 kHz that is 2047 frames = ~42.6 ms of audio,
 * which is a hard ceiling on how long the shell may go between pulls. Measured,
 * not read off a header: every pull after a long gap returns exactly 2047.
 *
 * Neither number is guessed by the shell -- this constant exists only so the
 * pull cadence can be checked against it and the page can say when it has been
 * exceeded. */
export const CORE_RING_FRAMES = 2047;

export function coreHasAudio(host) {
  return !!(host && host.exports && typeof host.exports[AUDIO_EXPORT] === "function");
}

export class CoreAudioSource {
  constructor(host) {
    this.host = host;
    this.ptr = 0;
    this.frames = AUDIO_FRAMES_MAX;
    this.peak = 0;
    this.primed = false;
    this.lastGot = 0;
    this.maxGot = 0;        /* how close a pull came to the core's ring ceiling */
  }
  /** Stage the pull buffer in the arena. Call after every arena reclaim. */
  stage() {
    if (!coreHasAudio(this.host)) return false;
    this.ptr = this.host.stageAudioBuffer(this.frames * 2 * 2);   /* stereo s16 */
    this.primed = false;
    return this.ptr !== 0;
  }

  /**
   * PRIME the core's audio. Required, and it is the one thing a stub of this
   * export could never have taught: apu_out begins with
   *
   *     if (!a->out_step) return;
   *
   * and out_step is set only by a pull that carries a rate. So a freshly
   * created or reset machine emits NOTHING until it has been pulled once, and
   * that first pull necessarily returns 0 -- it arms the APU rather than
   * fetching from it. Measured: without priming, the first pull after 120
   * emulated frames returns 0 and the audio for those frames never existed.
   *
   * Called at mount and after any reset, so the silent window is nil rather
   * than one pull interval.
   */
  prime(machine, rate) {
    if (!machine || !machine.alive || !this.ptr || !coreHasAudio(this.host)) return false;
    this.host.exports[AUDIO_EXPORT](machine.ctx, this.ptr, this.frames, rate);
    this.primed = true;
    return true;
  }
  /**
   * Pull up to nFrames from the machine, convert s16 -> float, write to ring.
   * @returns {number} frames delivered
   */
  pump(machine, ring, rate, nFrames) {
    if (!machine || !machine.alive || !this.ptr) return 0;
    const want = Math.min(nFrames, this.frames, ring.space);
    if (want <= 0) return 0;
    const got = this.host.exports[AUDIO_EXPORT](machine.ctx, this.ptr, want, rate);
    this.lastGot = got;
    if (got > this.maxGot) this.maxGot = got;
    /* Zero and short reads are both NORMAL, not errors: the core returns what
     * it has, which is whatever the emulator has generated since the last
     * pull. Only a pull that comes back at the ring ceiling means audio was
     * dropped before we asked for it. */
    if (got <= 0) { this.peak = 0; return 0; }
    const src = new Int16Array(this.host.exports.memory.buffer, this.ptr, got * 2);
    const buf = new Float32Array(got * 2);
    let peak = 0;
    for (let i = 0; i < got * 2; i++) {
      const v = src[i] / 32768;
      buf[i] = v;
      const a = v < 0 ? -v : v;
      if (a > peak) peak = a;
    }
    this.peak = peak;
    return ring.write(buf, got);
  }
}

/**
 * Drain whatever the core has banked, and throw it away.
 *
 * A machine's APU ring is per instance and holds up to 2047 frames — 43 ms at
 * 48 kHz — so audio generated before a switch can otherwise arrive after it, as
 * a fragment of the previous title.
 *
 * Done in the SHELL rather than by a core export, deliberately: the core cannot
 * know a switch happened, and a "discard" export would be the core guessing at
 * shell policy. The shell knows exactly when it switched, so the shell discards.
 */
export function discardCoreAudio(source, machine, rate, maxRounds = 8) {
  if (!source || !source.ptr || !machine || !machine.alive) return 0;
  if (!coreHasAudio(source.host)) return 0;
  let dropped = 0;
  for (let i = 0; i < maxRounds; i++) {
    const got = source.host.exports[AUDIO_EXPORT](machine.ctx, source.ptr, source.frames, rate);
    if (got <= 0) break;
    dropped += got;
  }
  source.peak = 0;
  source.lastGot = 0;
  return dropped;
}
