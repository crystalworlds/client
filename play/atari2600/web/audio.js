/* play/atari2600/web/audio.js — the TIA's two channels to the device.
 *
 * SITE-OWNED, and thin on purpose: the resampling is web/audio-worklet.js's,
 * which IS vendored byte-identical from the core's own project. This file only owns the
 * AudioContext, the autoplay dance and the graph.
 *
 * THE RATE IS NOT 44100 AND NOT THE DEVICE RATE. the core interface "Audio":
 * two samples per scanline, about 31,400 a second on NTSC and 31,100 on PAL.
 * The worklet is told the input rate and resamples to whatever the device is
 * running at. Measured here under Node over 180 frames: 95,547 samples, i.e.
 * 31,849/s against a 31,399/s nominal — the difference being that a title's
 * frame length is whatever it makes it, which is the same reason core.js paces
 * by CPU cycles rather than by a frame rate.
 *
 * AUTOPLAY. An AudioContext constructed before any user gesture starts
 * `suspended`, and it can be suspended again later (a background tab, an OS
 * audio change). So resume() is attempted on EVERY gesture, not only the
 * first — the core project's shell.js carries the same note and it is the bug that
 * otherwise presents as "sound works sometimes".
 */
import { AUDIO_HZ } from './core.js';
import { AudioQueue } from '../../shared/audio-queue.js?v=2.1.1';

export class Audio {
  constructor() {
    this.ctx = null;
    this.node = null;
    this.region = 0;
    this.failed = null;
    this.queue = null;   /* ../../shared/audio-queue.js: bounds the delay */
  }

  /* Call from a user gesture. Safe to call repeatedly. */
  async start(region) {
    this.region = region | 0;
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
        processorOptions: { inRate: AUDIO_HZ[this.region] },
      });
      /* The TIA reaches the television through a coupling capacitor, so the
       * signal a set receives has no DC level. A 20 Hz high-pass is that
       * capacitor. Without it the mix sits at a positive offset and clips
       * early on loud titles. The core project's graph, kept. */
      const hp = this.ctx.createBiquadFilter();
      hp.type = 'highpass';
      hp.frequency.value = 20;
      const gain = this.ctx.createGain();
      gain.gain.value = 0.5;
      this.node.connect(hp).connect(gain).connect(this.ctx.destination);
      this.queue = new AudioQueue(this.ctx, this.node, AUDIO_HZ[this.region]);
      if (this.ctx.state !== 'running') await this.ctx.resume();
      return true;
    } catch (e) {
      /* NOT swallowed. A page that silently has no sound is a page nobody can
       * diagnose; app.js shows this in the status line. */
      this.failed = (e && e.message) || String(e);
      return false;
    }
  }

  /* `samples` is the Float32Array core.drainAudio() returns, or null. The
   * buffer is TRANSFERRED, so it must not be touched after this call — which
   * is why core.drainAudio() allocates a fresh one each time rather than
   * reusing a scratch array. */
  push(samples) {
    if (!samples || !this.node) return;
    /* Dropped while the context is not playing or the queue is over its bound:
     * see ../../shared/audio-queue.js (River Raid ran a second behind). */
    if (this.queue && !this.queue.admit(samples.length)) return;
    this.node.port.postMessage({ samples }, [samples.buffer]);
  }

  async suspend() { try { await this.ctx?.suspend(); } catch (e) {} }
}
