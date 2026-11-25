// A built core, made ready to drive from the bytes of its WebAssembly file: the one small object every
// tool, the play page and the site's core module drive the machine with. The machine lives in the
// module's own memory; this file makes room for it and for the buffers the host owns (the game file,
// the trace). It imports no part of Node: whoever holds the file reads it (tools/core.mjs from the disk,
// a page or a worker from its server) and hands the bytes here.

import { sha256 } from "./sha256.mjs?v=5ca4ef310af2";
import { latin1 } from "./bytes.mjs?v=9a33ecdacdc2";

export const STOP = ["instruction limit", "reached the stop address", "frozen", "trace buffer full"];
export const FREEZE = ["not frozen", "a read from an area nothing answers", "a 64-bit read from register space", "a cached access outside main memory", "the PIF holds the CPU"];
export const TV = ["PAL", "NTSC", "MPAL"];
// The lockout chip a cartridge with the open boot code carries for a console of this television
// type: the PAL chip of the 6102 pair in a PAL console, the other in an NTSC or an MPAL one. On this
// core the two are one type (the PIF's check of the chip's region is not built), so the name is all
// that differs; a result names the chip the console would need.
export const openBootCodeChip = (tv) => (tv === 0 ? "7101" : "6102");
// The lockout chip types of cartridges, as the core numbers them (docs/BOUNDARY.md, section 4.2), and the disk drive's\n// own two (docs/parts/DD.md): the Japanese drive's 8303 and the American prototype drive's.
export const LOCKOUT = { "6101": 0, "6102": 1, "7101": 1, "7102": 2, "6103": 3, "7103": 3, "6105": 4, "7105": 4, "6106": 5, "7106": 5, "8303": 6, "DDUS": 7 };
export const sextAddress = (a32) => BigInt.asUintN(64, BigInt.asIntN(32, BigInt(a32 >>> 0)));

// bytes: the WebAssembly file; file: its name, which results carry.
export async function coreFromBytes(bytes, file = "n64core.wasm") {
  return coreFromModule(await compileCore(bytes, file));
}
// The file compiled once, for a host that makes machines from it again and again, or must make one without waiting
// (the site's worker runner calls load() and does not wait for it): coreFromModule then makes one at once.
export async function compileCore(bytes, file = "n64core.wasm") {
  const module = await WebAssembly.compile(bytes);
  // (A build that draws the RDP's lines on a thread of its own asks its host for a shared memory: how large is
  // read from the file here, where the bytes are at hand. No other build asks for anything.)
  const wanted = WebAssembly.Module.imports(module).find((i) => i.kind === "memory") ?? null;
  return { module, build: { file, sha256: sha256(bytes) }, memoryAskedFor: wanted ? { ...wanted, ...importedMemoryLimits(bytes) } : null };
}
// The least and the most pages of the memory a module asks its host for, read from its import section.
function importedMemoryLimits(b) {
  let p = 8;
  const leb = () => { let r = 0, s = 0, v; do { v = b[p++]; r += (v & 127) * 2 ** s; s += 7; } while (v & 128); return r; };
  while (p < b.length) {
    const id = b[p++], size = leb(), end = p + size;
    if (id === 2) {
      for (let n = leb(); n > 0; n--) {
        const moduleName = leb(); p += moduleName;
        const name = leb(); p += name;
        const kind = b[p++];
        if (kind === 0) leb();
        else if (kind === 1) { p++; const f = leb(); leb(); if (f & 1) leb(); }
        else if (kind === 2) { const f = leb(), initial = leb(); return { initial, maximum: f & 1 ? leb() : initial }; }
        else if (kind === 3) p += 2;
        else { p++; leb(); }
      }
    }
    p = end;
  }
  throw new Error("the module asks for no memory");
}
export function coreFromModule(compiled) {
  // The memory such a build asks for is made here, shared; who holds the core may start the drawing thread on a
  // second instance of the module over it (core.sharedWith; tools/core.mjs does under Node). With no thread
  // started the same build draws where every build draws.
  const asked = compiled.memoryAskedFor ?? null;
  const given = asked ? new WebAssembly.Memory({ initial: asked.initial, maximum: asked.maximum, shared: true }) : null;
  // A build with a recompiler (bits 524288 and 1048576 of the faster roads) asks its host for one call: the bytes
  // of a module the core has written are compiled here, as they are, and the module's one function is put in the
  // core's own table of functions, at the place the core names or at a new one; the place is given back, or 0
  // when it could not be done, and the core then keeps to its interpreter. The made module is given the core's
  // memory and that table and nothing else.
  const gives = asked ? { [asked.module]: { [asked.name]: given } } : {};
  let made = null;
  if (WebAssembly.Module.imports(compiled.module).some((i) => i.module === "env" && i.name === "n64_wasm_host")) {
    (gives.env ??= {}).n64_wasm_host = (at, size, slot) => (made ? made(at, size, slot) : 0);
  }
  // (A tool's build of the drawing thread's road asks its host the time, in millionths of a second, for its counts alone:
  // N64_THREAD_CLOCK in core/rdp_thread.c. No other build asks.)
  if (WebAssembly.Module.imports(compiled.module).some((i) => i.module === "env" && i.name === "n64_clock")) (gives.env ??= {}).n64_clock = () => performance.now() * 1000;
  const x = new WebAssembly.Instance(compiled.module, gives).exports;
  if (x.__indirect_function_table) made = (at, size, slot) => {
    try {
      const table = x.__indirect_function_table;
      const f = new WebAssembly.Instance(new WebAssembly.Module(new Uint8Array(x.memory.buffer).slice(at, at + size)), { e: { m: x.memory, t: table } }).exports.f;
      if (slot === 0) slot = table.grow(1);
      table.set(slot, f);
      return slot;
    } catch { return 0; }
  };
  const PAGE = 65536;
  let top = (Number(x.__heap_base.value) + 15) & ~15;
  // (With a shared memory the machine begins 128 bytes or more behind the core's own words, some of which the
  // drawing thread writes all the time, so that the machine's clock shares no line of the host's cache with them.)
  if (given) top = (top + 255) & ~127;
  const alloc = (n) => {
    const at = top;
    top = (top + n + 15) & ~15;
    const need = Math.ceil(top / PAGE) - x.memory.buffer.byteLength / PAGE;
    if (need > 0) x.memory.grow(need);
    return at;
  };
  const machine = alloc(x.n64_sizeof());
  const u8 = () => new Uint8Array(x.memory.buffer);
  const text = (at) => { if (!at) return null; const m = u8(); let end = at; while (m[end]) end++; return latin1(m.subarray(at, end)); };
  const core = {
    x, machine, alloc, u8,
    sharedWith: given ? { module: compiled.module, memory: given } : null, thread: null,
    // The machine and everything the host keeps beside it, as they stand, to be put back later: all of the
    // memory above the core's own. What lies below is no state of a machine (the core's tables, its stack
    // and, in a build that draws on a thread of its own, the queue between the two threads, which must not
    // be set back under the thread).
    keep() { core.settle(); return u8().slice(Number(x.__heap_base.value)); },
    putBack(kept) { core.settle(); u8().set(kept, Number(x.__heap_base.value)); },
    // In a build with a thread of its own: everything queued for the drawing thread is drawn and the drawing state
    // is the machine's again, and a task the RSP's thread holds is taken home as it stands at the machine's time.
    // A host that has said that the threads may keep their work from one run to the next (across) calls this before
    // it looks at the machine's bytes by itself or puts a kept machine back (keep and putBack do it themselves).
    settle() { if (x.n64_rdp_thread_settle) x.n64_rdp_thread_settle(machine); if (x.n64_rcp_thread_settle) x.n64_rcp_thread_settle(machine); },
    across(on = true) { if (x.n64_rdp_thread_across) x.n64_rdp_thread_across(machine, on ? 1 : 0); if (x.n64_rcp_thread_across) x.n64_rcp_thread_across(machine, on ? 1 : 0); },
    // The threads such a build asks its host for, each to be started on a worker of its own before the machine is
    // run: post the worker { module, memory } (core.sharedWith) and the stack; it instantiates the module over
    // that memory, sets __stack_pointer to the stack and calls the entry, which does not return. A thread is there
    // when its ready() reads true; a build whose thread is not started runs that part on the machine's thread.
    //   drawing: the RDP's lines (bit 2048; tools/rdp-thread-worker.mjs)
    //   rsp: the RSP's tasks (bit 262144; tools/rcp-thread-worker.mjs)
    threads: given ? [
      ...(x.n64_rdp_thread_main ? [{ name: "drawing", entry: "n64_rdp_thread_main", stack: () => x.n64_rdp_thread_stack(), ready: () => x.n64_rdp_thread_state() === 2 }] : []),
      // (the picture drawn in bands, bit 4194304: a band's thread beside the first, started as the drawing thread is and after it; its entry takes the band's number, `arg`)
      ...(x.n64_rdp_band_main ? [1, 2, 3].map((b) => ({ name: `band ${b}`, entry: "n64_rdp_band_main", arg: b, stack: () => x.n64_rdp_band_stack(b), ready: () => x.n64_rdp_bands() > b })) : []),
      ...(x.n64_rcp_thread_main ? [{ name: "rsp", entry: "n64_rcp_thread_main", stack: () => x.n64_rcp_thread_stack(), ready: () => x.n64_rcp_thread_state() === 0 }] : []),
    ] : [],
    build: { ...compiled.build, broken: x.n64_broken() },
    // The direct start of the test build, for a program entered with no boot code run: power-on, and
    // then the state the maker's boot code leaves (the memory chips set up, the RI's registers, the
    // words it writes low in memory). docs/BOUNDARY.md, section 4.3.
    start(rdramSize = 0x400000) { x.n64_start(machine, rdramSize); },
    // Power-on alone, as the boot firmware finds the machine: no memory chip answers yet.
    coldStart(rdramSize = 0x400000) { x.n64_cold_start(machine, rdramSize); },
    rdram() { return new Uint8Array(x.memory.buffer, x.n64_rdram(machine), x.n64_rdram_size(machine)); },
    // Main memory as the program itself sees it: what its last stores left in the data cache counts,
    // although memory has not been given it yet. rdram() is what the video chip or a DMA would read.
    seen(paddr, len) {
      if (!core.seenRoom || len > core.seenRoom) { core.seenAt = alloc(len); core.seenRoom = len; }
      x.n64_seen(machine, paddr, len, core.seenAt);
      return u8().slice(core.seenAt, core.seenAt + len);
    },
    // The game file is the host's: one buffer, made larger only when a larger file comes.
    setCart(bytes) {
      if (!core.cartRoom || bytes.length > core.cartRoom) { core.cartAt = alloc(bytes.length); core.cartRoom = bytes.length; }
      u8().set(bytes, core.cartAt);
      x.n64_set_cart(machine, core.cartAt, bytes.length);
      return core.cartAt;
    },
    // Starts the machine as the boot firmware hands it to the cartridge's own boot code
    // (docs/BOUNDARY.md, section 3.3; the work is done in core/boot.c). Main memory is not set up:
    // the boot code has to reset the memory chips, set them up and size memory itself, as on a
    // console.
    //   tv: the console's television type (0 PAL, 1 NTSC, 2 MPAL); lockout: the cartridge's chip type
    //   warm: a start by the reset button, which finds memory still set up
    //   disk: the lockout chip is a disk drive's
    //   memoryUp: main memory is given as a boot code leaves it. Only for a program whose own boot
    //   code does not set memory up (one written for emulators, which no console could start from
    //   power-on); a result from such a start must say so.
    //   markOnNtscOnly: an MPAL console's PIF does not set the boot word's version mark, which
    //   ends up in register s7, so that an NTSC console's alone does. A PAL console's never sets
    //   it (two consoles) and an NTSC console's always; for an MPAL console the sources disagree
    //   (docs/parts/SI-PIF.md, section 4.1), and without this it is set there.
    //   leavings: what the boot firmware leaves that the stand-in cannot make itself, given by the
    //   host: { block, at } bytes for the RSP's instruction memory from offset `at`, { ticks } how long
    //   the firmware's two stages take, { instructions } how many instructions they run. Any may be
    //   left out. Where they come from is the caller's to say in its result.
    //   ownLoader: for a cartridge of the 6105 chip pair, when no bytes for instruction memory are
    //   given, the stand-in puts its own loader there (core/boot.c). Off unless asked for.
    handOver(bytes, { rdram = 0x400000, tv = 1, lockout = "6102", warm = false, disk = false, memoryUp = false, markOnNtscOnly = false, leavings = null, ownLoader = false } = {}) {
      if (!(lockout in LOCKOUT)) throw new Error(`no lockout chip type is called ${lockout}`);
      core.setCart(bytes);
      const flags = (warm ? 1 : 0) | (disk ? 2 : 0) | (memoryUp ? 4 : 0) | (markOnNtscOnly ? 8 : 0) | (ownLoader ? 16 : 0);
      if (!leavings) { x.n64_hand_over(machine, rdram, tv, LOCKOUT[lockout], flags); return; }
      if (!x.n64_hand_over_given) throw new Error("this build of the core takes nothing from the host at the hand-over: build the core again");
      const block = leavings.block ?? new Uint8Array(0), at = block.length ? alloc(block.length) : 0;
      if (block.length) u8().set(block, at);
      x.n64_hand_over_given(machine, rdram, tv, LOCKOUT[lockout], flags, at, leavings.at ?? 0, block.length, BigInt(leavings.ticks ?? 0), BigInt(leavings.instructions ?? 0));
      if (block.length) u8().fill(0, at, at + block.length);            // the host's copy is not left lying in the core's memory
    },
    gpr(i) { return BigInt.asUintN(64, x.n64_get_gpr(machine, i)); },
    setGpr(i, v) { x.n64_set_gpr(machine, i, BigInt.asIntN(64, BigInt(v))); },
    pc() { return BigInt.asUintN(64, x.n64_get_pc(machine)); },
    setPc(v) { x.n64_set_pc(machine, BigInt.asIntN(64, BigInt(v))); },
    run(maxInstructions, stopPc = 0xFFFFFFFFFFFFFFFFn) { return Number(x.n64_run(machine, BigInt(maxInstructions), BigInt.asIntN(64, BigInt(stopPc)))); },
    stopReason() { return STOP[x.n64_stop_reason(machine)]; },
    freezeReason() { return FREEZE[x.n64_halt_reason(machine)]; },
    debugText() { const at = x.n64_debug_text(machine), n = x.n64_debug_text_len(machine); return latin1(u8().subarray(at, at + n)); },
    // Takes what the program has printed since the last call, so a long run never fills the window's store.
    takeDebugText() { const t = core.debugText(); x.n64_debug_text_taken(machine); return t; },
    // Which implementation runs each part, as the core itself names them once it has been started.
    implementations() { const name = (i) => text(x.n64_impl(machine, i)) ?? "not started"; return { cpu: name(0), rsp: name(1), rdp: name(2) }; },
    tv() { return TV[x.n64_tv(machine)] ?? "not started"; },
  };
  return core;
}
