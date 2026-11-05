/* audio-worklet.js — the AudioWorkletProcessor that drains the ring.
 *
 * Family filename (the Pokemon mini shell has the same one). This file runs on
 * the audio thread, so it must never allocate in process() and never block.
 *
 * It is deliberately dumb: it drains frames and reports what it saw. All policy
 * — how fast the emulator runs, what to do about drift — lives on the main
 * thread or, once the audio clock exists, in the worker. A worklet that makes
 * decisions is a worklet you cannot test.
 *
 * AudioWorkletProcessor outputs are always Float32, which is why the whole
 * transport is Float32 regardless of what the APU turns out to emit; A2's
 * format affects the producer adapter only.
 */

class GBAudioProcessor extends AudioWorkletProcessor {
  constructor(options) {
    super();
    const o = options.processorOptions || {};
    this.channels = o.channels || 2;
    this.frames = o.frames || 8192;
    this.ctrl = new Int32Array(o.ctrl);
    this.data = new Float32Array(o.data);

    /* Preallocated: process() runs on the audio thread and must not allocate. */
    this.scratch = new Float32Array(1024 * this.channels);
    this.lastFrame = new Float32Array(this.channels);

    this.underruns = 0;
    this.framesOut = 0;
    this.framesShort = 0;
    this.running = true;
    this._report = 0;

    this.port.onmessage = e => {
      if (e.data === "stop") this.running = false;
      else if (e.data === "reset") { this.underruns = 0; this.framesOut = 0; this.framesShort = 0; }
    };
  }

  _available() {
    return (Atomics.load(this.ctrl, 1) - Atomics.load(this.ctrl, 0)) | 0;
  }

  _read(dst, nFrames) {
    const avail = this._available();
    const n = Math.min(nFrames, avail);
    if (n <= 0) return 0;
    const ch = this.channels, r = Atomics.load(this.ctrl, 0);
    for (let i = 0; i < n; i++) {
      const slot = (((r + i) % this.frames) + this.frames) % this.frames;
      for (let c = 0; c < ch; c++) dst[i * ch + c] = this.data[slot * ch + c];
    }
    Atomics.store(this.ctrl, 0, (r + n) | 0);
    return n;
  }

  process(inputs, outputs) {
    const out = outputs[0];
    if (!out || out.length === 0) return this.running;
    const ch = Math.min(this.channels, out.length);
    const n = out[0].length;

    const got = this._read(this.scratch, n);

    for (let i = 0; i < got; i++)
      for (let c = 0; c < ch; c++) out[c][i] = this.scratch[i * this.channels + c];
    if (got > 0)
      for (let c = 0; c < this.channels; c++)
        this.lastFrame[c] = this.scratch[(got - 1) * this.channels + c];

    if (got < n) {
      /* HOLD the last frame. Do not ramp to zero, and do not latch zero.
       *
       * WITHDRAWN, and the reason is measured rather than argued: this used to
       * ramp to zero over 64 frames and then latch zero, on the assumption that
       * silence is zero. It is not. A DMG idles with its powered DACs at digital
       * zero, which on this core is -0.75 of full scale -- Tetris sits exactly
       * there. So the old policy ramped 0.75 FS AWAY from where the machine
       * actually was, and on restore the samples arrived back at -0.75 against a
       * latched 0: a 24576 LSB step (0.75 x 32768 exactly, and measured by the
       * A-4 control rather than computed; an earlier 24574 was never
       * derivable), 3.1x the music's own amplitude.
       *
       * Lengthening the ramp would only have smeared that excursion over more
       * time. Holding removes both edges at once, because a held DC level is
       * inaudible -- a speaker cannot reproduce DC -- and it is the TRANSITION
       * that clicks.
       *
       * lastFrame is deliberately NOT cleared: latching zero is what made the
       * pair re-arm on every restore, which is why it could be toggled
       * repeatedly.
       *
       * The counters are untouched, for the reason below. */
      this.underruns++;
      this.framesShort += (n - got);
      for (let i = got; i < n; i++)
        for (let c = 0; c < ch; c++) out[c][i] = this.lastFrame[c];
    }

    this.framesOut += n;

    /* Telemetry roughly every 100 ms, off the hot path's allocation budget. */
    if ((this._report += n) >= sampleRate / 10) {
      this._report = 0;
      this.port.postMessage({
        framesOut: this.framesOut, underruns: this.underruns,
        framesShort: this.framesShort, available: this._available(),
        capacity: this.frames, sampleRate,
      });
    }
    return this.running;
  }
}

registerProcessor("gb-audio", GBAudioProcessor);
