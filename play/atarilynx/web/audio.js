/* play/atarilynx/web/audio.js — the Lynx's stereo output to the device.
 *
 * SITE-OWNED and thin. The resampling is web/lynx-audio-worklet.js's, vendored
 * byte-identical from the core's own project (processor 'lynx-audio'): a stereo ring fed with
 * the core's 44,100 Hz pairs, linearly resampled to the device rate with the
 * rate nudged to hold the buffer near its target. The graph is the core project's: two
 * output channels, a 20 Hz high-pass, a gain.
 *
 * AUTOPLAY: resume() is attempted on every gesture, not only the first — the
 * note play/atari2600/web/audio.js carries.
 */
import { AudioQueue } from '../../shared/audio-queue.js?v=2.0.0';

export class Audio {
  constructor() {
    this.ctx = null;
    this.node = null;
    this.failed = null;
    this.queue = null;   /* ../../shared/audio-queue.js: bounds the delay */
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
      await this.ctx.audioWorklet.addModule(new URL('./lynx-audio-worklet.js', import.meta.url));
      this.node = new AudioWorkletNode(this.ctx, 'lynx-audio', { outputChannelCount: [2] });
      const hp = this.ctx.createBiquadFilter();
      hp.type = 'highpass';
      hp.frequency.value = 20;
      const gain = this.ctx.createGain();
      gain.gain.value = 0.8;
      this.node.connect(hp).connect(gain).connect(this.ctx.destination);
      this.queue = new AudioQueue(this.ctx, this.node, 44100);   /* the worklet's inRate */
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
    /* Interleaved L/R, so a frame is two samples. Dropped while the context is
     * not playing or the queue is over its bound: see ../../shared/audio-queue.js. */
    if (this.queue && !this.queue.admit(samples.length >> 1)) return;
    this.node.port.postMessage({ samples }, [samples.buffer]);
  }

  async suspend() { try { await this.ctx?.suspend(); } catch (e) {} }
}
