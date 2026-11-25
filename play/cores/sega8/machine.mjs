/* host/core.mjs: a small wrapper over build/s8host.wasm for Node and the
 * browser. One Machine owns one WebAssembly instance (its own memory), so
 * two machines never share state. */
import { BOARD_ID } from "./loader.mjs";

export const MODELS = ["sms1-ntsc", "sms1-pal", "sms2-ntsc", "sms2-pal", "mark3", "smsj", "mark3-fm",
  "gg", "sg1000", "gg-1asic", "gg-va0", "gg-jp", "sg1000-2", "sg1000-2b", "sg1000-2-pal", "omv"];
export const FW = { none: 0, original: 1, ours: 2 };
export const LOAD_KEEP_CART_RAM = 1;
export const CENSUS_FIELDS = ["sega_fffc", "sega_fffd", "sega_fffe", "sega_ffff",
  "w0000", "w2000", "w4000", "w6000", "w8000", "wA000", "msx_reg", "cm_0000", "cm_4000", "cm_8000",
  "kr_a000", "jg_reg", "cram_mapped", "cram_reads", "cram_writes", "port3e_writes", "wram_win"];

export async function loadModule(wasmBytes) {
  return WebAssembly.compile(wasmBytes);
}

export class Machine {
  static async create(module) {
    const inst = await WebAssembly.instantiate(module, {});
    return new Machine(inst);
  }
  constructor(inst) {
    this.x = inst.exports;
    this.mem = this.x.memory;
    let p = (this.x.__heap_base.value + 15) & ~15;
    this.ctx = p; p += (this.x.h_ctx_size() + 15) & ~15;
    this.stateBuf = p; p += (this.x.h_state_size() + 15) & ~15;
    this.free = p;
  }
  /* A second machine in this same instance and memory (the Gear-to-Gear link: the core joins two
     machines only inside one instance, docs/emulation/gamegear.md section 13). Its own context, state
     buffer and kept buffers; the allocator is this machine's. */
  sibling() {
    const s = Object.create(Machine.prototype);
    s.x = this.x; s.mem = this.mem;
    s.alloc = n => this.alloc(n);
    s.ctx = this.alloc(this.x.h_ctx_size());
    s.stateBuf = this.alloc(this.x.h_state_size());
    return s;
  }
  alloc(n) {
    const p = this.free;
    this.free = (p + n + 15) & ~15;
    const need = this.free - this.mem.buffer.byteLength;
    if (need > 0) this.mem.grow(Math.ceil(need / 65536));
    return p;
  }
  /* A buffer kept for one use (the cartridge, the firmware image, a battery file): the allocator
     never frees, so each use keeps its own buffer and reuses it while it is big enough. Until
     21 Nov 2026 every load and Reset took a new firmware buffer and every battery write a new
     one, so a play window's memory grew with each (the bad-file test, tools/badfile). */
  buffer(key, n) {
    const b = (this.bufs ||= {})[key];
    if (b && b.cap >= n) return b.ptr;
    const ptr = this.alloc(Math.max(n, 1));
    this.bufs[key] = { ptr, cap: n };
    return ptr;
  }
  u8() { return new Uint8Array(this.mem.buffer); }
  /* opts: model, board (name), medium, battery, fw ("none"|"ours"|"original"), fwBytes, cartRam, seed */
  init(cart, opts = {}) {
    const cp = this.buffer("cart", cart.length);
    this.u8().set(cart, cp);
    let fp = 0, fn = 0;
    if (opts.fwBytes) { fn = opts.fwBytes.length; fp = this.buffer("fw", fn); this.u8().set(opts.fwBytes, fp); }
    const model = typeof opts.model === "number" ? opts.model : Math.max(0, MODELS.indexOf(opts.model ?? "sms1-ntsc"));
    /* No cartridge (a length of 0): the slot is empty, so the core is given no cartridge at all and
     * its slots read as the console reads an empty one (the firmware's built-in games, 21 Nov 2026). */
    const args = [this.ctx, model, cart.length ? cp : 0, cart.length, BOARD_ID[opts.board ?? "sega"] ?? 1,
      opts.medium === "card" ? 1 : 0, opts.battery ? 1 : 0, FW[opts.fw ?? "none"] ?? 0,
      opts.cartRam ?? 0, fp, fn, (opts.seed ?? 0) >>> 0];
    /* opts.ggSms: the Game Gear cartridge holds the Master System pin (REG-0072) */
    const r = this.x.h_init_x ? this.x.h_init_x(...args, opts.ggSms ? 1 : 0) : this.x.h_init(...args);
    if (r) throw new Error(`init refused (${r})`);
    return this;
  }
  run(n) { this.x.h_run(this.ctx, n); }
  pad(dc, dd = 0xFF) { this.x.h_pad(this.ctx, dc, dd); }
  pc() { return this.x.h_pc(this.ctx); }
  census() {
    const o = {};
    CENSUS_FIELDS.forEach((k, i) => { o[k] = this.x.h_census(this.ctx, i); });
    o.port3e_last = this.x.h_census(this.ctx, CENSUS_FIELDS.length) & 0xFF;
    return o;
  }
  cartRam() {
    const n = this.x.h_cram_size(this.ctx);
    return n ? this.u8().slice(this.x.h_cram(this.ctx), this.x.h_cram(this.ctx) + n) : new Uint8Array(0);
  }
  cartRamWrites() { return this.x.h_cram_writes(this.ctx) >>> 0; }
  hasBattery() { return !!this.x.h_cram_battery(this.ctx); }
  loadCartRam(bytes) {
    const p = this.buffer("cram", bytes.length);
    this.u8().set(bytes, p);
    return this.x.h_cram_load(this.ctx, p, bytes.length);
  }
  saveState() {
    const n = this.x.h_state_size();
    if (this.x.h_save(this.ctx, this.stateBuf) !== n) throw new Error("state save failed");
    return this.u8().slice(this.stateBuf, this.stateBuf + n);
  }
  loadState(bytes, flags = 0) {
    this.u8().set(bytes, this.stateBuf);
    return this.x.h_load(this.ctx, this.stateBuf, flags);
  }
  ram(a) { return this.x.h_ram(this.ctx, a); }
  vdpReg(i) { return this.x.h_vdp_reg(this.ctx, i); }
  tile(r, c) { return this.x.h_tile(this.ctx, r, c); }
  hash(which) { return (BigInt(this.x.h_hash(this.ctx, which, 1) >>> 0) << 32n | BigInt(this.x.h_hash(this.ctx, which, 0) >>> 0)).toString(16).padStart(16, "0"); }
}
