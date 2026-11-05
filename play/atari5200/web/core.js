/* play/atari5200/web/core.js: the Atari 5200 core, wrapped at its documented ABI.
 *
 * SITE-OWNED, for the reason play/atari2600/web/core.js's header gives at length
 * (the core project's web/shell5200.js is a test PAGE with its own DOM, not a module
 * to vendor). The contract is the 7800's:
 *
 *   * IT TOUCHES THE CORE ONLY THROUGH the core interface in the
 *     Atari development tree. No reading of core memory except through an
 *     address the ABI returned, or a5200_peek.
 *   * A CORE DEFECT IS FIXED IN THE CORE and arrives here as a new artifact.
 *   * REQUIRED IS ASSERTED AT LOAD. instantiate() throws NAMING every missing
 *     export, so a swapped core that renamed one fails at the swap, loudly,
 *     instead of as a black screen. OPTIONAL is a separate list on purpose.
 *
 * FIRMWARE. The core carries the project's own console firmware and starts every
 * cartridge on it; the player's own 2048-byte image may be set before a load
 * (a5200_set_firmware) and is then kept across the power on the load makes.
 * the core interface "Firmware": "the core never needs it".
 *
 * MEMORY. a5200_create() grows memory for one context and returns its address.
 * This file grows ONCE more, up front, for its own scratch (a cartridge or a
 * save state, whichever is larger, plus the audio drain), and re-takes
 * memory.buffer on every access: a view held across a grow reads zeroes.
 */

/* The CPU clock and the frame, the core interface "Running": 262 lines of
 * 114 machine cycles, 29,868 a frame, 59.92 frames a second. */
export const CPU_HZ = 1789773;
export const FRAME_CYCLES = 114 * 262;

/* Two samples a scanline, the core interface "Sound": 1,789,773 x 2 / 114,
 * about 31,400 a second. */
export const AUDIO_HZ = CPU_HZ * 2 / 114;

/* The raster, the core interface "Picture": 384 x 240 half-clock pixels
 * (scanlines 8-247); columns 24-359 are drawn, 0-23 and 360-383 stay 0. */
export const RASTER_W = 384, RASTER_H = 240, DRAWN_X = 24, DRAWN_W = 336;

/* The keypad codes a5200_set_keypad_port takes (enum a5200_key). */
export const KEY = { NONE: -1, STAR: 10, HASH: 11, START: 12, PAUSE: 13, RESET: 14 };

/* EVERY EXPORT THIS PAGE CALLS. Asserted at load: see the header. */
const REQUIRED = [
  'memory',
  'a5200_create', 'a5200_sizeof_context',
  'a5200_load_cartridge', 'a5200_load_reason', 'a5200_board', 'a5200_board_name',
  'a5200_power_on', 'a5200_run_frame', 'a5200_frame_count',
  'a5200_raster',
  'a5200_audio_available', 'a5200_audio_read',
  'a5200_set_stick', 'a5200_set_trigger', 'a5200_set_top_button_port', 'a5200_set_keypad_port',
];
/* Used when present, done without when absent. */
const OPTIONAL = [
  'a5200_set_firmware', 'a5200_has_firmware', 'a5200_own_firmware', 'a5200_peek',
  'a5200_set_trackball', 'a5200_set_pots',
  'a5200_state_size', 'a5200_state_save', 'a5200_state_load',
  'a5200_cpu_jammed',
];

/* Scratch, taken once: the larger of a save state and the largest cartridge
 * the core accepts (512 KB plus a 16-byte CART header, the core's bound), then
 * an 8,192-sample int16 audio drain. Rounded to whole 64 KB pages. */
export const CART_MAX = 512 * 1024 + 16;
const AUDIO_SAMPLES = 8192;
const FIRMWARE_BYTES = 2048;

export class Core {
  constructor(instance) {
    const X = instance.exports;
    this.X = X;
    this.memory = X.memory;
    this.ctx = X.a5200_create();
    if (!this.ctx) throw new Error('a5200_create() returned 0: the core could not allocate a machine context');
    const stateBytes = typeof X.a5200_state_size === 'function' ? Number(X.a5200_state_size()) : 0;
    const scratch = Math.max(stateBytes, CART_MAX) + AUDIO_SAMPLES * 2;
    const pages = Math.ceil(scratch / 65536);
    const old = this.memory.grow(pages);
    this.scratch = old * 65536;
    this.audioBuf = this.scratch + pages * 65536 - AUDIO_SAMPLES * 2;
    this.board = 0;
    this.reason = '';
  }

  u8(ptr, n) { return new Uint8Array(this.memory.buffer, ptr, n); }

  cstr(ptr) {
    const b = new Uint8Array(this.memory.buffer, ptr, 256);
    let n = 0;
    while (n < 256 && b[n]) n++;
    return new TextDecoder().decode(b.subarray(0, n));
  }

  /* The player's own console firmware, before a load (the load's power on keeps it).
   * Returns true when the core took it (it must be 2048 bytes). */
  setFirmware(data) {
    if (typeof this.X.a5200_set_firmware !== 'function') return false;
    if (!(data instanceof Uint8Array) || data.length !== FIRMWARE_BYTES) return false;
    this.u8(this.scratch, data.length).set(data);
    return this.X.a5200_set_firmware(this.ctx, this.scratch, data.length) >= 0;
  }
  hasOwnerFirmware() {
    return typeof this.X.a5200_has_firmware === 'function' && this.X.a5200_has_firmware(this.ctx) === 1;
  }
  /* A short SHA-256 (16 hex digits) of what the CPU sees at F800-FFFF, read back
   * through a5200_peek, so the status line names the firmware that RAN rather
   * than the one the page meant to set. Never the bytes themselves. */
  async firmwareHash() {
    if (typeof this.X.a5200_peek !== 'function') return null;
    const fw = new Uint8Array(FIRMWARE_BYTES);
    for (let i = 0; i < FIRMWARE_BYTES; i++) fw[i] = this.X.a5200_peek(this.ctx, 0xF800 + i);
    return shortSha(fw);
  }
  async ownFirmwareHash() {
    if (typeof this.X.a5200_own_firmware !== 'function') return null;
    return shortSha(this.u8(this.X.a5200_own_firmware(), FIRMWARE_BYTES).slice());
  }

  /* Board 0: the core decides (or takes a CART header's type). The load powers
   * on. Returns the board number, or throws with the core's reason. */
  loadCartridge(data) {
    if (!(data instanceof Uint8Array)) throw new TypeError('loadCartridge wants a Uint8Array');
    if (data.length > CART_MAX) throw new Error(`cartridge is ${data.length} bytes; the core accepts at most ${CART_MAX}`);
    this.u8(this.scratch, data.length).set(data);
    const got = this.X.a5200_load_cartridge(this.ctx, this.scratch, data.length, 0);
    this.reason = this.cstr(this.X.a5200_load_reason(this.ctx));
    if (got < 0) throw new Error(`the core refused this cartridge: ${this.reason || 'no reason given'}`);
    this.board = got;
    return got;
  }

  boardName(n) { return this.cstr(this.X.a5200_board_name(n)); }
  powerOn() { this.X.a5200_power_on(this.ctx); }
  runFrame() { this.X.a5200_run_frame(this.ctx); }
  frameCount() { return Number(this.X.a5200_frame_count(this.ctx)); }
  jammed() { return typeof this.X.a5200_cpu_jammed === 'function' && this.X.a5200_cpu_jammed(this.ctx) === 1; }
  /* A view onto wasm memory, the whole raster. Not retained. */
  raster() { return this.u8(this.X.a5200_raster(this.ctx), RASTER_W * RASTER_H); }

  setStick(port, dx, dy) { this.X.a5200_set_stick(this.ctx, port, dx | 0, dy | 0); }
  setTrackball(port, dx, dy) { if (this.X.a5200_set_trackball) this.X.a5200_set_trackball(this.ctx, port, dx | 0, dy | 0); }
  setTrigger(port, on) { this.X.a5200_set_trigger(this.ctx, port, on ? 1 : 0); }
  setTopButton(port, on) { this.X.a5200_set_top_button_port(this.ctx, port, on ? 1 : 0); }
  setKeypad(port, key) { this.X.a5200_set_keypad_port(this.ctx, port, key); }

  /* Signed 16-bit mono samples (POKEY's level over each half line) to a fresh
   * Float32Array (it is transferred to the worklet, so it cannot be reused). */
  drainAudio() {
    const n = this.X.a5200_audio_available(this.ctx);
    if (!n) return null;
    const got = this.X.a5200_audio_read(this.ctx, this.audioBuf, Math.min(n, AUDIO_SAMPLES));
    if (!got) return null;
    const s = new Int16Array(this.memory.buffer, this.audioBuf, got);
    const f = new Float32Array(got);
    for (let i = 0; i < got; i++) f[i] = s[i] / 32768;
    return f;
  }
}

async function shortSha(u8) {
  /* crypto.subtle exists only on a secure origin; the TV reads the site over
   * plain HTTP (port 8080), so the site's own digest (firmware/site/sha.js,
   * loaded by index.html) is used when it is there. 2026-10-11. */
  const h = (typeof window !== 'undefined' && window.cwsDigest)
    ? await window.cwsDigest('SHA-256', u8)
    : await crypto.subtle.digest('SHA-256', u8);
  return [...new Uint8Array(h)].slice(0, 8).map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function instantiate(url) {
  let instance;
  try {
    ({ instance } = await WebAssembly.instantiateStreaming(fetch(url), {}));
  } catch (e) {
    const buf = await (await fetch(url)).arrayBuffer();
    ({ instance } = await WebAssembly.instantiate(buf, {}));
  }
  return check(instance, url);
}

/* Split out so a headless harness can hand in an instance it built itself. */
export function check(instance, url) {
  const X = instance.exports;
  const missing = REQUIRED.filter(k => !(k in X));
  if (missing.length) {
    throw new Error(
      `This Atari 5200 core is missing ${missing.length} export(s) this page calls: ` +
      missing.join(', ') +
      '. The artifact at ' + url + ' does not match the core interface. ' +
      'Re-stamp with tools/stamp.mjs and check CORE-VERSION.json.exports.'
    );
  }
  const core = new Core(instance);
  core.absent = OPTIONAL.filter(k => !(k in X));
  return core;
}
