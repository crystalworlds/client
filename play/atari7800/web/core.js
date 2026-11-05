/* play/atari7800/web/core.js — the Atari 7800 core, wrapped at its documented ABI.
 *
 * SITE-OWNED, for the reason play/atari2600/web/core.js's header gives at length:
 * the Atari project has no module layer to vendor (its web/shell7800.js is a test
 * PAGE with its own DOM), so this file exists and keeps a narrower contract:
 *
 *   * IT TOUCHES THE CORE ONLY THROUGH the core interface in the
 *     Atari development tree. No reading of core memory except
 *     through an address the ABI returned.
 *   * A CORE DEFECT IS FIXED IN THE CORE and arrives here as a new artifact.
 *   * REQUIRED IS ASSERTED AT LOAD. instantiate() throws NAMING every missing
 *     export, so a swapped core that renamed one fails at the swap, loudly,
 *     instead of as a black screen. OPTIONAL is a separate list on purpose.
 *
 * THE 7800 IS TWO MACHINES IN ONE CONTEXT. A cartridge that fails the BIOS's
 * test runs in 2600 MODE — the whole 2600 core inside the 7800 context, the TIA
 * raster (160 wide, the 2600 palette) instead of MARIA's (320 wide, the 7800
 * palette). the core interface "Video". So `inTwoSixHundredMode()` and
 * `rasterWidth()` are asked every frame, never cached, and render.js picks the
 * palette and the window from them.
 *
 * NO BIOS IS NEEDED. "The BIOS is the console's own boot firmware: the user may
 * supply it; the core never needs it." This page never supplies one, so a
 * cartridge starts directly — which is also what the core notes state.
 *
 * MEMORY. a7800_create() grows memory for one context and returns its address.
 * This file grows ONCE more, up front, for its own scratch, and re-takes
 * memory.buffer on every access — a view held across a grow reads zeroes.
 */

/* The display windows over the raster, from the core interface "Video": rows
 * 16 to 258 are shown on NTSC and 16 to 308 on PAL. In 2600 mode, the 2600's
 * own windows (the core interface). Keyed by the region a7800_region returns. */
export const WIN7800 = { 0: { y: 16, h: 243 }, 1: { y: 16, h: 293 } };
export const WIN2600 = { 0: { y: 23, h: 228 }, 1: { y: 32, h: 274 } };

/* Master clocks a second, the core interface "Timing": NTSC 7,159,088, PAL
 * 7,093,788 — four times the CPU's colour-carrier division. In 2600 mode
 * a7800_master_clocks still reports clocks at about that rate (six per 2600 CPU
 * cycle), so one pacing rule covers both modes. */
export const MCLK_HZ = { 0: 1789772 * 4, 1: 1773447 * 4 };

/* One audio sample each time the TIA makes one: twice per 228 colour clocks.
 * Master clocks / 228 is that rate, which is how the core computes it. */
export const AUDIO_HZ = { 0: MCLK_HZ[0] / 228, 1: MCLK_HZ[1] / 228 };

/* Board names, in a7800_board's numbering (the core interface "Boards"). */
export const BOARDS = ['AUTO', 'flat', 'SuperGame', 'SuperGame + RAM', 'SuperGame 9',
  'flat + mirror RAM', 'Absolute', 'Activision', 'bankset', 'bankset SuperGame',
  '2600', 'VersaBoard', 'SOUPER'];

/* Controller types (a7800_set_controller), and the .a78 header's codes (bytes
 * 55, 56) mapped onto them, the core's table: 0 ("none") is read as a ProLine
 * because older headers leave it 0. Header code 12 is the Mega7800 adaptor
 * (a Sega pad), controller type 13 since 2026-10-10; a core without a7800_set_mega7800 still gets a ProLine there (see
 * headerController). */
export const CTRL = { PROLINE: 0, LIGHTGUN: 1, NONE: 2, JOY2600: 3, PADDLES: 4, DRIVING: 5,
  KEYPAD: 6, TRAKBALL: 7, STMOUSE: 8, AMIGAMOUSE: 9, SAVEKEY: 10, ATARIVOX: 11, SNES: 12, MEGA7800: 13 };
export const CTRL_FROM_HEADER = [0, 0, 1, 4, 7, 3, 5, 6, 8, 9, 10, 12, 13];

/* EVERY EXPORT THIS PAGE CALLS. Asserted at load — see the header. */
const REQUIRED = [
  'memory',
  'a7800_create', 'a7800_sizeof_context',
  'a7800_load_cartridge', 'a7800_load_reason', 'a7800_board', 'a7800_extras',
  'a7800_region', 'a7800_header_byte',
  'a7800_power_on', 'a7800_run_frame',
  'a7800_raster', 'a7800_raster_width', 'a7800_raster_lines',
  'a7800_in_2600_mode', 'a7800_master_clocks',
  'a7800_set_joystick', 'a7800_set_switches', 'a7800_set_controller',
  'a7800_audio_available', 'a7800_audio_read',
];
/* Used when present, done without when absent. */
const OPTIONAL = [
  'a7800_set_bios', 'a7800_has_bios', 'a7800_board_name',
  'a7800_set_paddle', 'a7800_set_lightgun',
  'a7800_state_size', 'a7800_state_save', 'a7800_state_load',
  'a7800_cpu_jammed', 'a7800_frame_count',
  'a7800_set_mega7800',
  'a7800_set_expansion',
];

/* THE XM MODULE. The .a78 header's byte 63 D0 says the program wants the XM (the homebrew
 * expansion module: 128 KB of RAM, a POKEY at 0450, a YM2151 at 0460, the HSC's RAM); the
 * core's header-correction table (src/7800/header_fix.h) sets it for files whose header
 * leaves it out (Battlezone NTSC and PAL, which use the module's RAM). The host plugs it in
 * (the 7800 expansions chapter: "the host decides"), as the core project's own page does.
 * One exception: a header that also puts the cartridge's own POKEY at 0450. The module
 * answers all of 0400-047F and its POKEY there stays off until the program turns it on, so
 * with the module plugged in such a cartridge's chip goes quiet. Measured
 * (2026-10-24, 1,800 frames each way): 39 of the 55 such files fall silent with it, ours and
 * the reference alike; the other 16 run the same either way. Whether the
 * real module passes writes on to a cartridge chip at 0450 is NOT ESTABLISHED, so those
 * cartridges run as their header's board, without the module. */
export const EXP_XM = 2;
const EXTRA_POKEY_450 = 2;

/* Scratch, taken once: the largest cartridge the core accepts (1 MB plus the
 * 128-byte .a78 header — the core's own bound) and an 8,192-sample int16 audio
 * drain. Rounded to whole 64 KB pages. */
const CART_MAX = 1024 * 1024 + 128;
const AUDIO_SAMPLES = 8192;
const SCRATCH = CART_MAX + AUDIO_SAMPLES * 2;

export class Core {
  constructor(instance) {
    const X = instance.exports;
    this.X = X;
    this.memory = X.memory;
    this.ctx = X.a7800_create();
    if (!this.ctx) throw new Error('a7800_create() returned 0: the core could not allocate a machine context');
    const pages = Math.ceil(SCRATCH / 65536);
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

  /* Board 0: the core reads the .a78 header, or — for a file without one —
   * decides as the console's BIOS decides (a 7800 board, else 2600 mode). The
   * load powers on. Returns the board number, or throws with the core's reason. */
  loadCartridge(data) {
    if (!(data instanceof Uint8Array)) throw new TypeError('loadCartridge wants a Uint8Array');
    if (data.length > CART_MAX) throw new Error(`cartridge is ${data.length} bytes; the core accepts at most ${CART_MAX}`);
    this.u8(this.scratch, data.length).set(data);
    const exp = typeof this.X.a7800_set_expansion === 'function';
    if (exp) this.X.a7800_set_expansion(this.ctx, 0);   /* nothing plugged in until the header asks */
    const got = this.X.a7800_load_cartridge(this.ctx, this.scratch, data.length, 0, 0);
    this.reason = this.cstr(this.X.a7800_load_reason(this.ctx));
    if (got < 0) throw new Error(`the core refused this cartridge: ${this.reason || 'no reason given'}`);
    this.board = got;
    /* THE XM MODULE (above): plugged in, then a power on, as an expansion takes effect then */
    this.xm = exp && this.wantsXM();
    if (this.xm) { this.X.a7800_set_expansion(this.ctx, EXP_XM); this.X.a7800_power_on(this.ctx); }
    return got;
  }

  /* Header byte 63 D0 (after the core's corrections), unless the cartridge's own POKEY sits at 0450. */
  wantsXM() {
    const h = this.headerByte(63);
    return h > 0 && (h & 1) === 1 && (this.extras() & EXTRA_POKEY_450) === 0;
  }

  boardName(n) { return BOARDS[n] || String(n); }
  extras() { return this.X.a7800_extras(this.ctx); }
  region() { return this.X.a7800_region(this.ctx); }
  headerByte(i) { return this.X.a7800_header_byte(this.ctx, i); }
  powerOn() { this.X.a7800_power_on(this.ctx); }
  runFrame() { return this.X.a7800_run_frame(this.ctx); }
  masterClocks() { return Number(this.X.a7800_master_clocks(this.ctx)); }
  inTwoSixHundredMode() { return this.X.a7800_in_2600_mode(this.ctx) === 1; }
  rasterWidth() { return this.X.a7800_raster_width(this.ctx); }
  rasterLines() { return this.X.a7800_raster_lines(this.ctx); }
  /* A view onto wasm memory, `rows` rows of the current width. Not retained. */
  raster(rows) { return this.u8(this.X.a7800_raster(this.ctx), this.rasterWidth() * rows); }

  setJoystick(port, bits) { this.X.a7800_set_joystick(this.ctx, port, bits); }
  setSwitches(bits) { this.X.a7800_set_switches(this.ctx, bits); }
  setController(port, type) { this.X.a7800_set_controller(this.ctx, port, type); }

  /* The controller each port should carry: what the cartridge's header names
   * (bytes 55 and 56), else a ProLine. */
  headerController(port) {
    const h = this.headerByte(55 + port);
    const t = (h >= 0 && h < CTRL_FROM_HEADER.length) ? CTRL_FROM_HEADER[h] : CTRL.PROLINE;
    /* A core without the Mega7800 export cannot be fed one: a ProLine, as before. */
    if (t === CTRL.MEGA7800 && typeof this.X.a7800_set_mega7800 !== 'function') return CTRL.PROLINE;
    return t;
  }

  /* The Sega pad through the Mega7800 (the core interface
   * a7800_set_mega7800: 1 up, 2 down, 4 left, 8 right, 16 A, 32 B, 64 C ...),
   * fed from the ProLine bits this page already keeps: the directions as they
   * are, button B (16) as the pad's B, button A (32) as its C, the core project's
   * shell7800.js megaFromInputs() without its SNES-layout extras. */
  setMega7800(port, joyBits) {
    const j = joyBits | 0;
    this.X.a7800_set_mega7800(this.ctx, port, (j & 15) | (j & 16 ? 32 : 0) | (j & 32 ? 64 : 0));
  }

  /* Signed 16-bit samples, every chip already mixed by the core
   * (the core interface "Audio"), to a fresh Float32Array (it is
   * transferred to the worklet, so it cannot be reused). */
  drainAudio() {
    const n = this.X.a7800_audio_available(this.ctx);
    if (!n) return null;
    const got = this.X.a7800_audio_read(this.ctx, this.audioBuf, Math.min(n, AUDIO_SAMPLES));
    if (!got) return null;
    const s = new Int16Array(this.memory.buffer, this.audioBuf, got);
    const f = new Float32Array(got);
    for (let i = 0; i < got; i++) f[i] = s[i] / 32768;
    return f;
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

/* Split out so a headless harness can hand in an instance it built itself. */
export function check(instance, url) {
  const X = instance.exports;
  const missing = REQUIRED.filter(k => !(k in X));
  if (missing.length) {
    throw new Error(
      `This Atari 7800 core is missing ${missing.length} export(s) this page calls: ` +
      missing.join(', ') +
      '. The artifact at ' + url + ' does not match the core interface. ' +
      'Re-stamp with tools/stamp.mjs and check CORE-VERSION.json.exports.'
    );
  }
  const core = new Core(instance);
  core.absent = OPTIONAL.filter(k => !(k in X));
  return core;
}
