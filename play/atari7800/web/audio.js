/* play/atari7800/web/audio.js — the 7800's mixed output to the device.
 *
 * SITE-OWNED and thin: the resampling is the TIA worklet's, the core project's
 * web/audio-worklet.js, which its own 7800 page uses unchanged
 * (shell7800.js: `addModule('audio-worklet.js')`, processor 'tia-audio'). It is
 * imported from ../../atari2600/web/, where it is already vendored
 * byte-identical and checked by WASM_Source/atari/verify.sh §3 — one copy, one
 * check, rather than a second copy here that nothing verifies.
 *
 * THE RATE. the core interface "Audio": one sample each time the TIA makes
 * one, twice per 228 colour clocks — master clocks / 228, about 31,400/s NTSC
 * and 31,100 PAL. Every other chip the cartridge carries (POKEY, YM2151, COVOX)
 * is already mixed in by the core. The rate is told to the worklet at start and
 * again whenever a cartridge changes the region.
 *
 * AUTOPLAY: resume() is attempted on every gesture, not only the first — the
 * note play/atari2600/web/audio.js carries.
 */
import { AUDIO_HZ } from './core.js';
import { AudioQueue } from '../../shared/audio-queue.js?v=2.0.0';

export class Audio {
  constructor() {
    this.ctx = null;
    this.node = null;
    this.region = 0;
    this.failed = null;
    this.queue = null;   /* ../../shared/audio-queue.js: bounds the delay */
  }

  async start(region) {
    this.setRegion(region);
    try {
      if (this.ctx) {
        if (this.ctx.state !== 'running') await this.ctx.resume();
        return true;
      }
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) { this.failed = 'this browser has no Web Audio'; return false; }
      this.ctx = new AC();
      await this.ctx.audioWorklet.addModule(new URL('../../atari2600/web/audio-worklet.js', import.meta.url));
      this.node = new AudioWorkletNode(this.ctx, 'tia-audio', {
        processorOptions: { inRate: AUDIO_HZ[this.region] },
      });
      /* The core project's graph: a 20 Hz high-pass (the output coupling capacitor)
       * and a gain. */
      const hp = this.ctx.createBiquadFilter();
      hp.type = 'highpass';
      hp.frequency.value = 20;
      const gain = this.ctx.createGain();
      gain.gain.value = 0.7;
      this.node.connect(hp).connect(gain).connect(this.ctx.destination);
      this.queue = new AudioQueue(this.ctx, this.node, AUDIO_HZ[this.region]);
      if (this.ctx.state !== 'running') await this.ctx.resume();
      return true;
    } catch (e) {
      this.failed = (e && e.message) || String(e);
      return false;
    }
  }

  /* A cartridge's header can change the region; the worklet needs the new rate
   * and an emptied ring, or the first second plays at the old pitch. */
  setRegion(region) {
    const r = region | 0;
    if (r === this.region && this.node) return;
    this.region = r;
    if (this.node) this.node.port.postMessage({ inRate: AUDIO_HZ[r], reset: true });
    if (this.queue) { this.queue.setRate(AUDIO_HZ[r]); this.queue.clear(); }
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
