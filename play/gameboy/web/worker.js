/* worker.js — the play path: emulator, audio producer and blit, off the main
 * thread.  the UI design, section 23.
 *
 * The family filename. Its content is decided by one constraint from §22: the
 * core's audio ring is a DEADLINE, not a buffer — 2048 frames, oldest dropped,
 * 42.6 ms at 48 kHz — so not pulling loses audio rather than postponing it. The
 * fix on the main thread was to pull immediately after the frames that produced
 * the samples, and that adjacency is the property this file exists to preserve.
 *
 * So: frames and pull are in ONE loop, with nothing between them. A worker that
 * drove frames on one schedule and pulled on another would reintroduce exactly
 * the defect the move was made to remove.
 *
 * The clock is the audio ring's drain rate, read through Atomics on the shared
 * control block. That is what a worker has instead of requestAnimationFrame,
 * and it is the correct clock anyway: a dropped paint is invisible, a dropped
 * sample is audible.
 *
 * FIRMWARE: bytes arrive by postMessage from the page, which read them from the
 * user's own disk. Nothing here fetches a cartridge or a BIOS.
 */

import { GBHost, FRAME_HZ, SCREEN_W, SCREEN_H } from "./core.js";
import { paletteLUT, blitInto, DEFAULT_PALETTE } from "./shell.js";
import { AudioRing, CoreAudioSource, coreHasAudio, CORE_RING_FRAMES,
         discardCoreAudio } from "./audio.js";

let host = null;
let machine = null;
let ring = null;
let audio = null;                 /* CoreAudioSource */
let rate = 48000;
let canvas = null, ctx2d = null, img = null, img32 = null;
let lut = paletteLUT(DEFAULT_PALETTE);
let running = false;
let timer = 0;

let cartBytes = null, cartLabel = "", usedBios = false;
let buttons = 0;
let level = 0;
let framesRun = 0;
let pullsAtCeiling = 0;
let lastGot = 0;
let starvedTicks = 0;

/* Hold the ring around half full: deep enough to ride out a scheduling hiccup,
 * shallow enough that latency stays low. The servo runs frames until occupancy
 * reaches the target, so the EMULATOR's rate is set by how fast the worklet is
 * draining — which is the hardware audio clock. */
const TARGET = 0.5;
const MAX_FRAMES_PER_TICK = 24;   /* a ceiling on catch-up, as the pacer had */

function post(type, data) { self.postMessage({ type, ...data }); }

function blit() {
  if (!ctx2d || !machine || !machine.alive) return;
  /* Per machine, not host-wide -- see GBMachine#frameFormat. */
  blitInto(img32, machine.frame, machine.frameFormat, lut);
  ctx2d.putImageData(img, 0, 0);
}

/**
 * One servo tick: run frames until the ring is topped up, pulling audio
 * immediately after each frame.
 *
 * The pull is INSIDE the frame loop, not after it. One emulated frame is about
 * 800 samples at 48 kHz, so the gap between pulls can never approach the core's
 * 2047-frame ceiling — by construction rather than by timing luck.
 */
function tick() {
  if (!running || !machine || !machine.alive) return;
  if (machine.locked) {
    running = false;
    post("locked", { pc: machine.pc });
    return;
  }

  let ran = 0;
  if (ring && audio) {
    /* Audio-clocked: run while the ring is below target. */
    while (ran < MAX_FRAMES_PER_TICK && ring.available < ring.frames * TARGET) {
      machine.runFrame(); ran++; framesRun++;
      const room = Math.min(audio.frames, ring.space);
      if (room > 0) {
        const got = audio.pump(machine, ring, rate, room);
        lastGot = audio.lastGot;
        if (got > 0) level = audio.peak;
        if (got >= CORE_RING_FRAMES) pullsAtCeiling++;
      }
    }
    if (ran === 0) starvedTicks = 0;
  } else {
    /* No audio yet: fall back to wall-clock pacing so video still runs. */
    const now = performance.now();
    if (!tick._last) tick._last = now;
    let due = Math.floor((now - tick._last) * FRAME_HZ / 1000);
    if (due > MAX_FRAMES_PER_TICK) due = MAX_FRAMES_PER_TICK;
    if (due > 0) { tick._last = now; for (let i = 0; i < due; i++) { machine.runFrame(); ran++; framesRun++; } }
  }
  if (ran > 0) blit();
}

function stats() {
  return {
    frames: framesRun,
    machineFrames: machine && machine.alive ? machine.frames : 0,
    pc: machine && machine.alive ? machine.pc : 0,
    locked: machine && machine.alive ? machine.locked : false,
    level,
    lastGot,
    maxGot: audio ? audio.maxGot : 0,
    pullsAtCeiling,
    primed: audio ? audio.primed : false,
    hasAbi: host ? coreHasAudio(host) : false,
    ringAvailable: ring ? ring.available : 0,
    ringFrames: ring ? ring.frames : 0,
    arena: host ? host.stats() : null,
    running,
  };
}

/**
 * Bring a title up. Goes through the host's one switch path, so the worker
 * mounts exactly the way the page does.
 *
 * PRIMING, §22.1: a fresh machine emits nothing until pulled once, and that
 * first pull returns zero. It is done here, at mount, so the first note of a
 * title is audible rather than the second.
 */
function mount(bytes, opts) {
  cartBytes = bytes;
  cartLabel = opts.label || "cartridge";
  buttons = 0;
  try {
    machine = host.switchTo(machine, bytes, { label: cartLabel, useBios: opts.useBios !== false });
  } catch (e) {
    machine = null; running = false;
    post("error", { where: "mount", name: e.name, message: e.message });
    return false;
  }
  usedBios = machine.usedBios;
  if (audio) {
    audio.stage();
    audio.prime(machine, rate);
    /* Pull-and-discard: the core's ring is per instance and holds up to 43 ms,
     * so without this a switch can be followed by a fragment of the title that
     * was playing before it. The shell does this rather than the core, because
     * the core cannot know a switch happened. */
    const dropped = discardCoreAudio(audio, machine, rate);
    /* And drop what the SHELL still holds, for the same reason: our own ring
     * can be carrying ~170 ms of the previous title. */
    if (ring) ring.clear();
    if (dropped) post("discarded", { frames: dropped });
  }
  framesRun = 0; pullsAtCeiling = 0; level = 0;
  running = true;
  tick._last = 0;
  blit();
  post("mounted", { label: cartLabel, usedBios, hasBattery: machine.hasBattery, stats: stats() });
  return true;
}

self.onmessage = async (e) => {
  const m = e.data;
  try {
    switch (m.type) {
      case "init": {
        host = await GBHost.instantiate(m.wasm);
        if (m.canvas) {
          canvas = m.canvas;
          ctx2d = canvas.getContext("2d", { alpha: false });
          ctx2d.imageSmoothingEnabled = false;
          img = ctx2d.createImageData(SCREEN_W, SCREEN_H);
          img32 = new Uint32Array(img.data.buffer);
        }
        /* 4 ms: fine-grained enough that the servo never has to catch up in a
         * burst, cheap enough to be free. The worker is not throttled the way a
         * background tab's timers are, which is half the reason for being here. */
        timer = setInterval(tick, 4);
        post("ready", {
          coreVersion: host.coreVersion, contextBytes: host.contextBytes,
          frameFormat: host.frameFormat, hasAbi: coreHasAudio(host),
        });
        break;
      }
      case "audio": {
        /* The page owns the AudioContext and cannot hand it over; it hands over
         * the RING instead, which is all the producer needs. */
        ring = AudioRing.attach(m.ring);
        rate = m.rate || 48000;
        audio = new CoreAudioSource(host);
        audio.stage();
        if (machine && machine.alive) audio.prime(machine, rate);
        post("audioReady", { rate, shared: ring.shared });
        break;
      }
      case "bios":    host.setBios(m.bytes); break;
      case "mount":   mount(m.bytes, m); break;
      case "buttons":
        buttons = m.mask;
        if (machine && machine.alive) machine.setButtons(buttons);
        break;
      case "run":     running = !!m.on; tick._last = 0; break;
      case "palette": lut = paletteLUT(m.key); blit(); break;
      case "stats":   post("stats", { stats: stats() }); break;
      case "cram": {
        const c = machine && machine.alive ? machine.cram : null;
        const r = machine && machine.alive ? machine.rtc : null;
        post("cram", { id: m.id, bytes: c ? new Uint8Array(c) : null, rtc: r ? new Uint8Array(r) : null });
        break;
      }
      case "cramSet":
        if (machine && machine.alive && machine.cram && m.bytes &&
            m.bytes.length === machine.cram.length) machine.cram.set(m.bytes);
        break;
      case "rtcSet": {                     /* the MBC3 clock block (core.js rtc) */
        const r = machine && machine.alive ? machine.rtc : null;
        if (r && m.bytes && m.bytes.length === r.length) r.set(m.bytes);
        break;
      }
      case "context": {
        const c = machine && machine.alive ? new Uint8Array(machine.context) : null;
        post("context", { id: m.id, bytes: c, frames: machine ? machine.frames : 0,
                          usedBios, cartLen: cartBytes ? cartBytes.length : 0 });
        break;
      }
      case "restore": {
        /* The context is not position-independent, so the pointers are re-set
         * exactly as web/shell.js does it -- published ABI only. */
        if (!machine || !machine.alive) { post("restored", { id: m.id, ok: false, why: "no machine" }); break; }
        machine.context.set(m.bytes);
        host.exports.gb_set_cart(machine.ctx, machine.cartPtr, machine.cartLen);
        host.exports.gb_set_bios(machine.ctx, machine.usedBios ? host.biosPtr : 0,
                                 machine.usedBios && host.biosBytes ? host.biosBytes.length : 0);
        machine.buttons = 0;
        host.exports.gb_set_buttons(machine.ctx, 0);
        machine.frames = m.frames >>> 0;
        if (audio) audio.prime(machine, rate);     /* a reset disarms the APU */
        post("restored", { id: m.id, ok: true });
        break;
      }
      case "stop":
        running = false;
        if (timer) { clearInterval(timer); timer = 0; }
        if (machine) host.free(machine);
        machine = null;
        break;
      default:
        post("error", { where: "message", name: "Unknown", message: `unknown message ${m.type}` });
    }
  } catch (err) {
    /* Never die silently: a worker that throws and stops looks exactly like an
     * emulator that hung, which is the confusion this project keeps paying for. */
    post("error", { where: m && m.type, name: err.name, message: err.message });
  }
};
