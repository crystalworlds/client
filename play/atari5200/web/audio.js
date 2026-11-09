/* play/atari5200/web/audio.js: POKEY's output to the device.
 *
 * SITE-OWNED and thin, the 7800's (play/atari7800/web/audio.js) with the
 * 5200's rate. The resampling is the core project's TIA worklet, which its own
 * 5200 page uses unchanged (shell5200.js: addModule('audio-worklet.js'),
 * processor 'tia-audio'); the 5200 has its own vendored copy in this directory
 * (web/audio-worklet.js), which tools/stamp.mjs checks against the core's own project.
 *
 * THE RATE. the core interface "Sound": signed 16-bit mono, two samples per
 * scanline, 1,789,773 x 2 / 114, about 31,400 a second. NTSC only: the 5200
 * was never sold in a PAL version.
 *
 * THE QUEUE is ../../shared/audio-queue.js (the audio-latency fix of
 * 2026-10-10): nothing is posted while the context is not playing, and the
 * queued delay is held under 150 ms.
 *
 * AUTOPLAY: resume() is attempted on every gesture, not only the first, the
 * note play/atari2600/web/audio.js carries.
 */
import { AUDIO_HZ } from './core.js';
import { AudioQueue } from '../../shared/audio-queue.js?v=2.1.1';

export class Audio {
  constructor() {
    this.ctx = null;
    this.node = null;
    this.failed = null;
    this.queue = null;
  }

  async start() {
    try {
      if (this.ctx) {
        if (this.ctx.state !== 'running') await this.ctx.resume();
        return true;
      }
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) { this.failed = 'this browser has no Web Audio'; return false; }
      this.ctx = new AC();
      await this.ctx.audioWorklet.addModule(new URL('./audio-worklet.js', import.meta.url));
      this.node = new AudioWorkletNode(this.ctx, 'tia-audio', {
        processorOptions: { inRate: AUDIO_HZ },
      });
      /* The core project's graph: a 20 Hz high-pass (the output coupling capacitor)
       * and a gain. */
      const hp = this.ctx.createBiquadFilter();
      hp.type = 'highpass';
      hp.frequency.value = 20;
      const gain = this.ctx.createGain();
      gain.gain.value = 0.7;
      this.node.connect(hp).connect(gain).connect(this.ctx.destination);
      this.queue = new AudioQueue(this.ctx, this.node, AUDIO_HZ);
      if (this.ctx.state !== 'running') await this.ctx.resume();
      return true;
    } catch (e) {
      this.failed = (e && e.message) || String(e);
      return false;
    }
  }

  reset() { if (this.queue) this.queue.clear(); else if (this.node) this.node.port.postMessage({ reset: true }); }

  push(samples) {
    if (!samples || !this.node) return;
    /* Dropped while the context is not playing or the queue is over its bound:
     * see ../../shared/audio-queue.js. */
    if (this.queue && !this.queue.admit(samples.length)) return;
    this.node.port.postMessage({ samples }, [samples.buffer]);
  }

  async suspend() { try { await this.ctx?.suspend(); } catch (e) {} }
}
