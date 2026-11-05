// TIA audio output: a ring buffer fed by the page at the TIA's own rate
// (two samples per scanline, about 31.4 kHz NTSC), resampled to the device
// rate with a windowed-sinc interpolator. The TIA's output is a staircase;
// the filter band-limits it at the lower of the two Nyquist frequencies so
// the steps do not alias.
const TAPS = 32;        // filter length in input samples
const PHASES = 256;     // fractional positions tabulated

class TiaAudio extends AudioWorkletProcessor {
  constructor(options) {
    super();
    this.inRate = options.processorOptions.inRate;
    this.ring = new Float32Array(1 << 16);
    this.ringR = new Float32Array(1 << 16);   // the right channel (stereo); null samples: mono
    this.stereo = false;
    this.mask = this.ring.length - 1;
    this.write = 0;
    this.read = 0;          // integer part of the read position
    this.frac = 0;          // fractional part
    this.step = this.inRate / sampleRate;
    this.buildFilter();
    this.port.onmessage = (e) => {
      if (e.data.samples) {
        const s = e.data.samples, r = e.data.right;
        this.stereo = !!r;
        for (let i = 0; i < s.length; i++) {
          this.ring[this.write & this.mask] = s[i];
          if (r) this.ringR[this.write & this.mask] = r[i];
          this.write++;
        }
      }
      if (e.data.inRate) { this.inRate = e.data.inRate; this.step = this.inRate / sampleRate; this.buildFilter(); }
      if (e.data.reset) { this.write = this.read = 0; this.frac = 0; this.ring.fill(0); this.ringR.fill(0); }
    };
  }

  buildFilter() {
    // cutoff at the lower Nyquist frequency, as a fraction of the input rate
    const cutoff = Math.min(1, sampleRate / this.inRate) * 0.5 * 0.92;
    this.table = new Float32Array(PHASES * TAPS);
    for (let p = 0; p < PHASES; p++) {
      const f = p / PHASES;
      let sum = 0;
      for (let k = 0; k < TAPS; k++) {
        const x = k - TAPS / 2 + 1 - f;              // distance from the output point
        const sinc = x === 0 ? 2 * cutoff : Math.sin(2 * Math.PI * cutoff * x) / (Math.PI * x);
        const w = 0.42 + 0.5 * Math.cos(Math.PI * x / (TAPS / 2)) + 0.08 * Math.cos(2 * Math.PI * x / (TAPS / 2));
        const v = sinc * (Math.abs(x) < TAPS / 2 ? w : 0);
        this.table[p * TAPS + k] = v;
        sum += v;
      }
      for (let k = 0; k < TAPS; k++) this.table[p * TAPS + k] /= sum;
    }
  }

  process(inputs, outputs) {
    const out = outputs[0][0];
    const outR = outputs[0].length > 1 && this.stereo ? outputs[0][1] : null;
    const avail = this.write - this.read;
    // Keep the buffer near its target: nudge the rate a little rather than
    // dropping samples (the page's clock and the device clock drift apart).
    const target = this.inRate * 0.06;
    const adjust = 1 + Math.max(-0.005, Math.min(0.005, (avail - target) / (target * 20)));
    for (let i = 0; i < out.length; i++) {
      if (this.write - this.read < TAPS) { out[i] = 0; if (outR) outR[i] = 0; continue; }
      const p = Math.min(PHASES - 1, (this.frac * PHASES) | 0);
      let acc = 0, accR = 0;
      const base = this.read - TAPS / 2 + 1;
      for (let k = 0; k < TAPS; k++) acc += this.ring[(base + k) & this.mask] * this.table[p * TAPS + k];
      if (outR) for (let k = 0; k < TAPS; k++) accR += this.ringR[(base + k) & this.mask] * this.table[p * TAPS + k];
      out[i] = acc;
      if (outR) outR[i] = accR;
      this.frac += this.step * adjust;
      const whole = this.frac | 0;
      this.read += whole;
      this.frac -= whole;
    }
    for (let c = outR ? 2 : 1; c < outputs[0].length; c++) outputs[0][c].set(out);
    this.port.postMessage({ fill: this.write - this.read });
    return true;
  }
}

registerProcessor('tia-audio', TiaAudio);
