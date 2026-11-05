/*
 * play/host/cw-audio-worklet.js -- the one play-window audio worklet (the Core API, section 4.4).
 *
 * A stereo ring at the device rate. The engine (cw-audio.js) resamples, converts and
 * posts blocks; this only plays them. Starts from silence after every clear and waits
 * for a small prefill so a resume never begins with an underrun click. Reports how
 * much is queued (and the last block it has taken) so the engine can servo its rate.
 *
 * SOUND RULE: this node exists only while a play window holds the engine's lease.
 */
class CwAudioProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.cap = Math.ceil(sampleRate * 2);          // frames, 2 s
    this.buf = new Float32Array(this.cap * 2);
    this.r = 0; this.w = 0; this.n = 0;
    this.prefill = Math.ceil(sampleRate * 0.03);   // 30 ms before the first sample after a clear
    this.primed = false;
    this.seq = 0; this.under = 0; this.dropped = 0; this.q = 0;
    this.last = [0, 0];
    this.port.onmessage = (e) => {
      const m = e.data;
      if (m.t === 'push') this.push(m.d, m.seq);
      else if (m.t === 'clear') { this.r = this.w = this.n = 0; this.primed = false; }
      else if (m.t === 'prefill') this.prefill = Math.max(0, m.frames | 0);
    };
  }
  push(d, seq) {
    const frames = d.length >> 1;
    for (let i = 0; i < frames; i++) {
      if (this.n >= this.cap) { this.r = (this.r + 1) % this.cap; this.n--; this.dropped++; }
      this.buf[this.w * 2] = d[i * 2]; this.buf[this.w * 2 + 1] = d[i * 2 + 1];
      this.w = (this.w + 1) % this.cap; this.n++;
    }
    this.seq = seq;
  }
  process(_in, outputs) {
    const out = outputs[0], L = out[0], R = out[1] || out[0], len = L.length;
    if (!this.primed && this.n >= this.prefill) this.primed = true;
    for (let i = 0; i < len; i++) {
      if (this.primed && this.n > 0) {
        this.last[0] = this.buf[this.r * 2]; this.last[1] = this.buf[this.r * 2 + 1];
        this.r = (this.r + 1) % this.cap; this.n--;
      } else {
        if (this.primed) { this.under++; this.primed = false; }
        // Underrun: decay the last sample to zero rather than step to it (no click).
        this.last[0] *= 0.995; this.last[1] *= 0.995;
      }
      L[i] = this.last[0]; if (R !== L) R[i] = this.last[1];
    }
    if (++this.q >= 4) { this.q = 0; this.port.postMessage({ t: 'q', n: this.n, seq: this.seq, under: this.under, dropped: this.dropped }); }
    return true;
  }
}
registerProcessor('cw-audio', CwAudioProcessor);
