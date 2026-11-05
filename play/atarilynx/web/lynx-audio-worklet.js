// Lynx audio output: a stereo ring buffer fed by the page with the core's
// 44100 Hz sample pairs (the core already averages each sample over its
// ticks), resampled to the device rate by linear interpolation, with the
// rate nudged to keep the buffer near its target as the clocks drift.
class LynxAudio extends AudioWorkletProcessor {
  constructor() {
    super();
    this.inRate = 44100;
    this.l = new Float32Array(1 << 16);
    this.r = new Float32Array(1 << 16);
    this.mask = this.l.length - 1;
    this.write = 0; this.read = 0; this.frac = 0;
    this.port.onmessage = (e) => {
      const s = e.data.samples;
      if (s) for (let i = 0; i + 1 < s.length; i += 2) {
        this.l[this.write & this.mask] = s[i];
        this.r[this.write & this.mask] = s[i + 1];
        this.write++;
      }
      if (e.data.reset) { this.write = this.read = 0; this.frac = 0; this.l.fill(0); this.r.fill(0); }
    };
  }
  process(inputs, outputs) {
    const out = outputs[0];
    const L = out[0], R = out[1] || out[0];
    const target = this.inRate * 0.06;
    const avail = this.write - this.read;
    const step = (this.inRate / sampleRate) * (1 + Math.max(-0.005, Math.min(0.005, (avail - target) / (target * 20))));
    for (let i = 0; i < L.length; i++) {
      if (this.write - this.read < 2) { L[i] = 0; if (R !== L) R[i] = 0; continue; }
      const a = this.read & this.mask, b = (this.read + 1) & this.mask, f = this.frac;
      L[i] = this.l[a] + (this.l[b] - this.l[a]) * f;
      if (R !== L) R[i] = this.r[a] + (this.r[b] - this.r[a]) * f;
      this.frac += step;
      const whole = this.frac | 0;
      this.read += whole; this.frac -= whole;
    }
    return true;
  }
}
registerProcessor('lynx-audio', LynxAudio);
