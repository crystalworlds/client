/* play/atarilynx/web/core.js — the Atari Lynx core, wrapped at its documented ABI.
 *
 * SITE-OWNED, for the reason play/atari2600/web/core.js's header gives: the
 * core's project has no module layer to vendor (web/shelllynx.js is a test PAGE). The
 * contract kept instead:
 *
 *   * IT TOUCHES THE CORE ONLY THROUGH the core interface in the Atari
 *     development tree.
 *   * A CORE DEFECT IS FIXED IN THE CORE and arrives here as a new artifact.
 *   * REQUIRED IS ASSERTED AT LOAD and throws naming what is missing; OPTIONAL
 *     degrades a feature and still loads.
 *
 * BOOT FIRMWARE: NONE IS SUPPLIED, AND NONE IS NEEDED. the core interface:
 * "the core never needs it, because without it the core runs the project's own
 * boot firmware, which performs the documented boot (it decrypts the
 * cartridge's loader and runs it)". This page never calls lynx_set_firmware, so
 * every cartridge starts through the project's own 512 bytes, and
 * `bootFirmware()` says so rather than leaving it to be inferred.
 *
 * MEMORY. lynx_create() grows memory for one context; this file grows once more
 * for its scratch and never caches a view across a grow.
 */

export const W = 160, H = 102;

/* 16,000,000 system ticks a second (the core interface "Timing"). A frame
 * is not a fixed length — the cartridge programs the display timers — so the
 * page paces by ticks, not by frames. */
export const TICK_HZ = 16000000;

/* lynx_set_buttons bits. Directions are the CONSOLE'S OWN, unrotated, which is
 * why app.js turns the arrow keys with the picture. */
export const B = { A: 1, B: 2, OPT2: 4, OPT1: 8, RIGHT: 16, LEFT: 32, DOWN: 64, UP: 128, PAUSE: 256 };

const REQUIRED = [
  'memory',
  'lynx_create', 'lynx_sizeof_context',
  'lynx_load_cartridge', 'lynx_load_reason', 'lynx_has_firmware',
  'lynx_rotation', 'lynx_power_on', 'lynx_run_frame', 'lynx_ticks',
  'lynx_raster', 'lynx_set_buttons',
  'lynx_audio_read',
];
const OPTIONAL = [
  'lynx_cart_name', 'lynx_cart_format', 'lynx_model',
  'lynx_eeprom_size', 'lynx_eeprom_read', 'lynx_eeprom_write', 'lynx_eeprom_changes',
  'lynx_state_size', 'lynx_state_save', 'lynx_state_load', 'lynx_frame_count',
];

/* Scratch: the largest cartridge (2 MB plus the 64-byte header), the audio
 * drain (8,192 stereo int16 pairs — the core's own buffer size) and room for an
 * EEPROM image. */
const CART_MAX = 2 * 1024 * 1024 + 64;
const AUDIO_PAIRS = 8192;
const EEPROM_MAX = 4096;
const SCRATCH = CART_MAX + AUDIO_PAIRS * 4 + EEPROM_MAX;

export class Core {
  constructor(instance) {
    const X = instance.exports;
    this.X = X;
    this.memory = X.memory;
    this.ctx = X.lynx_create();
    if (!this.ctx) throw new Error('lynx_create() returned 0: the core could not allocate a machine context');
    const pages = Math.ceil(SCRATCH / 65536);
    const old = this.memory.grow(pages);
    this.scratch = old * 65536;
    this.audioBuf = this.scratch + CART_MAX;
    this.eepromBuf = this.audioBuf + AUDIO_PAIRS * 4;
    this.reason = '';
  }

  u8(ptr, n) { return new Uint8Array(this.memory.buffer, ptr, n); }
  cstr(ptr) {
    const b = new Uint8Array(this.memory.buffer, ptr, 256);
    let n = 0;
    while (n < 256 && b[n]) n++;
    return new TextDecoder().decode(b.subarray(0, n));
  }

  /* Powers on. A .lnx header, an LNX2 header, a raw image, a BLL program and a
   * headerless Epyx image are all decided by the core; it says which in
   * lynx_load_reason. Throws with that reason on refusal. */
  loadCartridge(data) {
    if (!(data instanceof Uint8Array)) throw new TypeError('loadCartridge wants a Uint8Array');
    if (data.length > CART_MAX) throw new Error(`cartridge is ${data.length} bytes; the core accepts at most ${CART_MAX}`);
    this.u8(this.scratch, data.length).set(data);
    const got = this.X.lynx_load_cartridge(this.ctx, this.scratch, data.length);
    this.reason = this.cstr(this.X.lynx_load_reason(this.ctx));
    if (got < 0) throw new Error(`the core refused this cartridge: ${this.reason || 'no reason given'}`);
    return got;
  }

  /* 0 none, 1 left, 2 right — the header's. A raw dump has none. */
  headerRotation() { return this.X.lynx_rotation(this.ctx); }
  /* 1 only while the user's own firmware is in use; this page never supplies it. */
  bootFirmware() { return this.X.lynx_has_firmware(this.ctx) ? "your own boot firmware" : "the project's own boot firmware"; }
  cartName() { return 'lynx_cart_name' in this.X ? this.cstr(this.X.lynx_cart_name(this.ctx)) : ''; }

  powerOn() { this.X.lynx_power_on(this.ctx); }
  runFrame() { return this.X.lynx_run_frame(this.ctx); }
  ticks() { return Number(this.X.lynx_ticks(this.ctx)); }
  setButtons(bits) { this.X.lynx_set_buttons(this.ctx, bits); }
  /* 160 x 102 uint16, green 11-8, blue 7-4, red 3-0, unrotated. Not retained. */
  raster() { return new Uint16Array(this.memory.buffer, this.X.lynx_raster(this.ctx), W * H); }

  /* Stereo pairs at 44,100 a second, interleaved, to a fresh Float32Array (it
   * is transferred to the worklet). */
  drainAudio() {
    const got = this.X.lynx_audio_read(this.ctx, this.audioBuf, AUDIO_PAIRS);
    if (!got) return null;
    const s = new Int16Array(this.memory.buffer, this.audioBuf, 2 * got);
    const f = new Float32Array(2 * got);
    for (let i = 0; i < 2 * got; i++) f[i] = s[i] / 32768;
    return f;
  }

  /* The cartridge EEPROM, when it has one: read out to keep, written back
   * after loading and before running (the core interface). */
  eepromSize() { return 'lynx_eeprom_size' in this.X ? this.X.lynx_eeprom_size(this.ctx) : 0; }
  eepromChanges() { return 'lynx_eeprom_changes' in this.X ? Number(this.X.lynx_eeprom_changes(this.ctx)) : 0; }
  eepromRead() {
    const n = this.X.lynx_eeprom_read(this.ctx, this.eepromBuf, EEPROM_MAX);
    return this.u8(this.eepromBuf, n).slice();
  }
  eepromWrite(bytes) {
    const n = Math.min(bytes.length, EEPROM_MAX);
    this.u8(this.eepromBuf, n).set(bytes.subarray(0, n));
    return this.X.lynx_eeprom_write(this.ctx, this.eepromBuf, n);
  }
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

export function check(instance, url) {
  const X = instance.exports;
  const missing = REQUIRED.filter(k => !(k in X));
  if (missing.length) {
    throw new Error(
      `This Atari Lynx core is missing ${missing.length} export(s) this page calls: ` +
      missing.join(', ') +
      '. The artifact at ' + url + ' does not match the core interface. ' +
      'Re-stamp with tools/stamp.mjs and check CORE-VERSION.json.exports.'
    );
  }
  const core = new Core(instance);
  core.absent = OPTIONAL.filter(k => !(k in X));
  return core;
}
