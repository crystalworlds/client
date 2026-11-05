/* play/shared/audio-queue.js: keeps the Atari players' sound in step with the picture.
 *
 * THE DEFECT (2026-10-10, reported: "River Raid audio is about a second behind").
 * The emulation is paced by wall time and pushes its samples into an
 * AudioWorklet ring (play/atari2600/web/audio-worklet.js, shared by the 7800;
 * play/atarilynx/web/lynx-audio-worklet.js). Both worklets aim for 60 ms queued
 * and correct any excess by playing at most 0.5 % fast, so a backlog drains at
 * 5 ms a second: one second of it takes over three minutes to go away. A
 * backlog appears whenever samples are posted while the AudioContext is not
 * playing them: before the first key or tap (autoplay holds the context
 * suspended while the game already runs), after a pause or a hidden tab (the
 * page suspends the context; the game resumes on its own). The ring holds 64k
 * samples, about two seconds at the TIA's rate, and its counters are not
 * clamped, so a longer backlog wraps and the delay lands anywhere from 0 to 2 s,
 * then stays.
 *
 * THE FIX, on the page side (the worklets are vendored from the core build and are
 * not edited here):
 *   1. Nothing is posted while the context is not running, and the ring is
 *      emptied when it starts running again, so a suspension leaves no backlog.
 *   2. The queue is bounded: once it passes HIGH, incoming chunks are dropped
 *      until it is back to LOW. A stall therefore costs one splice, never a
 *      lasting delay.
 * The queue depth comes from the worklet's own `fill` report where it sends one
 * (the TIA worklet does) and otherwise from a model of the worklet's consumption
 * driven by the audio clock (the Lynx worklet sends none).
 */
const HIGH = 0.15;      // seconds queued before chunks are dropped
const LOW = 0.07;       // seconds queued at which pushing resumes (worklet target is 0.06)
const TARGET = 0.06;    // the worklets' own target, for the model's rate nudge

export class AudioQueue {
  /* node: the AudioWorkletNode; inRate: input frames per second. */
  constructor(ctx, node, inRate) {
    this.ctx = ctx;
    this.node = node;
    this.inRate = inRate;
    this.est = 0;           // estimated frames queued in the ring
    this.reported = false;  // true once the worklet has sent a fill report
    this.lastT = ctx.currentTime;
    this.dropping = false;
    this.dropped = 0;       // frames dropped, for a devtools check
    node.port.addEventListener('message', e => {
      const f = e.data && e.data.fill;
      if (typeof f === 'number') { this.reported = true; this.est = f; }
    });
    node.port.start();
    ctx.addEventListener('statechange', () => { if (ctx.state === 'running') this.clear(); });
  }

  setRate(inRate) { this.inRate = inRate; }

  /* Empty the ring, e.g. when the context starts playing again. */
  clear() {
    try { this.node.port.postMessage({ reset: true }); } catch (e) { /* node gone */ }
    this.est = 0; this.dropping = false; this.lastT = this.ctx.currentTime;
  }

  /* Model the worklet's consumption since the last call (used only when the
   * worklet sends no fill report): it reads inRate frames a second, nudged up
   * to 0.5 % faster when above its target, and stops at an empty ring. */
  advance() {
    const t = this.ctx.currentTime, dt = t - this.lastT;
    this.lastT = t;
    if (this.reported || dt <= 0) return;
    const target = this.inRate * TARGET;
    const nudge = 1 + Math.max(-0.005, Math.min(0.005, (this.est - target) / (target * 20)));
    this.est = Math.max(0, this.est - dt * this.inRate * nudge);
  }

  /* Call before posting `frames` input frames. True: post them. False: drop them. */
  admit(frames) {
    if (this.ctx.state !== 'running') return false;
    this.advance();
    if (this.dropping) {
      if (this.est > this.inRate * LOW) { this.dropped += frames; return false; }
      this.dropping = false;
    } else if (this.est > this.inRate * HIGH) {
      this.dropping = true; this.dropped += frames; return false;
    }
    this.est += frames;
    return true;
  }

  /* Queued delay in seconds, for a devtools check. */
  get latency() { this.advance(); return this.est / this.inRate; }
}
