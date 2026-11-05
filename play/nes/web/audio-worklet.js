/* audio-worklet.js — the audio thread's end of the ring buffer.
 *
 * Runs on the audio rendering thread, which must never allocate, never take a
 * lock and never touch the main thread.  It therefore does ONE thing: copy
 * float samples out of a SharedArrayBuffer ring and hand them to the output.
 *
 * WHY A RING AND NOT postMessage: postMessage into an AudioWorklet is queued
 * on the control thread and delivered between render quanta, so a late message
 * is a dropout.  A shared ring with atomic indices has no such coupling — the
 * emulator can run a frame late and the audio thread simply repeats its last
 * sample instead of clicking.
 *
 * UNDERRUN POLICY: hold the last sample rather than emit silence.  Silence is
 * a click; a held sample is a very short flat note, which is much less
 * audible.  The underrun COUNT is published back so the shell can show it —
 * an emulator that quietly hides its dropouts cannot be tuned.
 */
const RING_LEN = 1 << 15;   /* 32768 float32 samples, ~0.68s at 48k */

class NesAudio extends AudioWorkletProcessor {
  constructor(opts) {
    super();
    const o = opts.processorOptions || {};
    this.ring = o.ring ? new Float32Array(o.ring) : new Float32Array(RING_LEN);
    /* [0] = write index, [1] = read index, [2] = underrun count */
    this.idx = o.idx ? new Int32Array(o.idx) : new Int32Array(4);
    this.last = 0;
    this.running = true;
    this.port.onmessage = (e) => { if (e.data === 'stop') this.running = false; };
  }

  process(_inputs, outputs) {
    const out = outputs[0][0];
    if (!out) return this.running;
    const w = Atomics.load(this.idx, 0);
    let r = Atomics.load(this.idx, 1);
    let under = 0;
    for (let i = 0; i < out.length; i++) {
      if (r < w) { this.last = this.ring[r & (RING_LEN - 1)]; r++; }
      else under++;
      out[i] = this.last;
    }
    Atomics.store(this.idx, 1, r);
    if (under) Atomics.add(this.idx, 2, under);
    /* Mirror to the second channel if the graph asked for stereo. The NES is
     * mono; duplicating is correct and cheaper than a channel merger node. */
    const out2 = outputs[0][1];
    if (out2) out2.set(out);
    return this.running;
  }
}
registerProcessor('nes-audio', NesAudio);
