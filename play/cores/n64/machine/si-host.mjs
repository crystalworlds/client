// The host's side of the SI, the PIF and the joybus devices: which controllers are plugged in and
// what their buttons and sticks are, the paks and the EEPROM with their bytes, which cartridge the
// PIF finds in the slot, and the settings a result must name. Every test tool of this part drives
// the core through this one object.
//
//   const core = await loadCore();  const si = siHost(core);
//   si.handOver(programBytes, { controllers: [0] });      a start, then the machine is ready to run
//
// Nothing here knows a game: a save is bytes the host gives and takes back. It imports no part of Node, so the
// play page and the site's core module run it as the tools do; tools/si-host.mjs adds what reads a disk.

import { LOCKOUT } from "./core-host.mjs?v=6aeda4313354";
import { sha256 } from "./sha256.mjs?v=5ca4ef310af2";
import { copyOut } from "./bytes.mjs?v=9a33ecdacdc2";

export const BUTTON = { A: 0x8000, B: 0x4000, Z: 0x2000, START: 0x1000, UP: 0x0800, DOWN: 0x0400, LEFT: 0x0200, RIGHT: 0x0100, L: 0x0020, R: 0x0010, C_UP: 0x0008, C_DOWN: 0x0004, C_LEFT: 0x0002, C_RIGHT: 0x0001 };
export const PAK = { none: 0, controller: 1, rumble: 2, transfer: 3 };
// The bank chips of a Game Boy cartridge that the Transfer Pak's side of the core knows (docs/parts/TRANSFER-PAK.md).
export const CART_CHIP = { 0: "no header", 1: "no bank chip", 2: "MBC1", 3: "MBC3", 5: "MBC5", 255: "a bank chip that is not built" };
export const PAK_BYTES = 32768;
// The lockout chip types, as the core numbers them (shared/core-host.mjs), with the seed each gives.
export { LOCKOUT };
export const SEED = [0x3F, 0x3F, 0x3F, 0x78, 0x91, 0x85, 0xDD, 0xDE];
export const PIF_WAITS = ["the command that locks the firmware away", "the checksum", "the command to compare the checksum", "the end of the boot", "nothing: it is running"];
export const PIF_HELD = ["not held", "held: the boot code's checksum is not the lockout chip's", "held: the program did not end the boot in time"];
export const TICKS_PER_SECOND = 187_500_000;
export const TICKS_PER_RCP_CYCLE = 3;
// Why the console stands still, in the words of shared/core-host.mjs.
export const freezeReason = (core) => core.freezeReason();

export function siHost(core) {
  const x = core.x, m = core.machine;
  const bytesAt = (at, n) => copyOut(core.u8().subarray(at, at + n));
  // A PAL console's PIF does not set the mark (two consoles) and an NTSC console's does; the setting is for an MPAL console's.
  const MARK = ["not set in a PAL console, set in an NTSC and in an MPAL one", "not set in a PAL or an MPAL console, set in an NTSC one"];
  const settings = { timeModel: "the console bench's times", overlap: "a transfer asked for during another is not done", eepromBusyMs: 6, bootLimit: "off", bootLimitSeconds: 5, pifVersionMark: MARK[0] };
  const si = {
    carts: {},
    // ---- controllers
    plug(port, on = true) { x.n64_pad_plug(m, port, on ? 1 : 0); },
    set(port, buttons = 0, stickX = 0, stickY = 0) { x.n64_pad_set(m, port, buttons, stickX, stickY); },
    polls(port) { return x.n64_pad_polls(m, port) >>> 0; },
    // ---- paks
    // A pak put in before the machine has run, or into a controller that is not plugged in, is there when the
    // controller gets its power: it is reported as simply in. Put into a plugged-in controller of a running
    // machine it is new: reported so once, and not read until the identity is asked (docs/parts/SI-PIF.md, 5.1).
    insertPak(port, kind) { x.n64_pak_insert(m, port, PAK[kind] ?? 0); },
    formatPak(port, serial = 0x0123456789ABCDEFn) { x.n64_pak_format(m, port, BigInt.asIntN(64, BigInt(serial))); },
    givePak(port, bytes) { if (bytes.length !== PAK_BYTES) throw new Error("a Controller Pak is 32,768 bytes"); core.u8().set(bytes, x.n64_pak_bytes(m, port)); },
    pakBytes(port) { return bytesAt(x.n64_pak_bytes(m, port), PAK_BYTES); },
    pakChanges(port) { return x.n64_pak_changes(m, port) >>> 0; },
    pakTaken(port) { x.n64_pak_taken(m, port); },
    motor(port) { return (x.n64_pak_motor(m, port) & 1) === 1; },
    motorChanges(port) { return x.n64_pak_motor_changes(m, port) >>> 0; },
    // ---- the Game Boy cartridge in a port's Transfer Pak (insertPak(port, "transfer") puts the Pak itself in)
    // What a cartridge file's header says: its bank chip, whether it has a clock, and the size of its own memory,
    // which is the size of its save. Nothing is put anywhere.
    cartFacts(prog) {
      const at = core.alloc(0x150), head = prog.subarray(0, 0x150);
      core.u8().set(head, at);
      const h = x.n64_tpak_header(at, head.length) >>> 0;
      return { chip: CART_CHIP[h & 255] ?? "unknown", built: [1, 2, 3, 5].includes(h & 255), clock: (h & 0x100) !== 0, saveBytes: x.n64_tpak_header_ram(at, head.length) >>> 0 };
    },
    // Puts a cartridge into the port's Transfer Pak: its program chip's bytes, and its save (null: memory that
    // was never written, every bit set). Both are copied into the core's memory. A cartridge with a clock
    // takes `clock`: { running: five bytes, held: five bytes, secondsSince: how long ago they were right }.
    giveCart(port, prog, save = null, clock = null) {
      const facts = si.cartFacts(prog);
      if (facts.chip === "no header") throw new Error("the file is too short to be a Game Boy cartridge");
      const at = core.alloc(prog.length), ramAt = facts.saveBytes ? core.alloc(facts.saveBytes) : 0;
      core.u8().set(prog, at);
      if (ramAt) { core.u8().fill(0xFF, ramAt, ramAt + facts.saveBytes); if (save) core.u8().set(save.subarray(0, facts.saveBytes), ramAt); }
      si.carts[port] = { at, bytes: prog.length, ramAt, ...facts };
      x.n64_tpak_cart(m, port, at, prog.length, ramAt, facts.saveBytes);
      if (facts.clock && clock) si.setCartClock(port, clock);
      return facts;
    },
    // A hand takes the cartridge out of the Pak, and puts the same one back.
    takeCartOut(port) { x.n64_tpak_cart(m, port, 0, 0, 0, 0); },
    putCartBack(port) { const c = si.carts[port]; if (c) x.n64_tpak_cart(m, port, c.at, c.bytes, c.ramAt, c.saveBytes); },
    // The save put back into the cartridge that is in the Pak (the bytes of its own memory, no more).
    giveCartSave(port, bytes) { const c = si.carts[port]; if (!c || bytes.length !== c.saveBytes) throw new Error("the bytes are not the size of this cartridge's memory"); core.u8().set(bytes, c.ramAt); },
    cartSave(port) { const c = si.carts[port]; return c && c.saveBytes ? bytesAt(c.ramAt, c.saveBytes) : new Uint8Array(0); },
    cartChanges(port) { return x.n64_tpak_ram_changes(m, port) >>> 0; },
    cartTaken(port) { x.n64_tpak_ram_taken(m, port); },
    cartClock(port) { return { running: bytesAt(x.n64_tpak_clock(m, port), 5), held: bytesAt(x.n64_tpak_clock_held(m, port), 5) }; },
    setCartClock(port, { running, held = running, secondsSince = 0 }) {
      core.u8().set(running.subarray ? running.subarray(0, 5) : running.slice(0, 5), x.n64_tpak_clock(m, port));
      core.u8().set(held.subarray ? held.subarray(0, 5) : held.slice(0, 5), x.n64_tpak_clock_held(m, port));
      x.n64_tpak_clock_given(m, port, BigInt(Math.max(0, Math.floor(secondsSince))));
    },
    // What the Pak is doing, and how many 32-byte blocks a program has read and written through it.
    tpakState(port) { const v = x.n64_tpak_state(m, port) >>> 0; return { on: (v & 1) !== 0, cartridgePower: (v & 2) !== 0, window: (v >>> 4) & 3, chip: CART_CHIP[(v >>> 8) & 255] ?? "unknown", cartridgeIn: ((v >>> 8) & 255) !== 0, memoryOpen: (v & 0x10000) !== 0 }; },
    tpakCounts(port) { const n = (i) => x.n64_tpak_counts(m, port, i) >>> 0; return { registerReads: n(0), registerWrites: n(1), programReads: n(2), programWrites: n(3), memoryReads: n(4), memoryWrites: n(5) }; },
    // ---- the cartridge's real-time clock (core/rtc.c): fitted or not; its time set from plain numbers or from a time in
    // ms, read in the host's own time zone (a Date's local fields), as a clock on a shelf shows the time where it is
    fitClock(on = true) { x.n64_rtc_fit(m, on ? 1 : 0); },
    clockFitted() { return x.n64_rtc_fitted ? x.n64_rtc_fitted(m) === 1 : false; },
    setClock(t) {
      const d = typeof t === "number" ? (() => { const v = new Date(t); return { year: v.getFullYear(), month: v.getMonth() + 1, day: v.getDate(), weekday: v.getDay(), hour: v.getHours(), minute: v.getMinutes(), second: v.getSeconds() }; })() : t;
      x.n64_rtc_set(m, d.year, d.month, d.day, d.weekday, d.hour, d.minute, d.second);
      return d;
    },
    // Its 24 bytes as the machine has counted them now: block 0 (control), block 1 (its memory), block 2 (the time)
    clockBytes() { return bytesAt(x.n64_rtc_bytes(m), 24); },
    clockSeconds() { return x.n64_rtc_seconds(m) >>> 0; },
    // ---- the cartridge's EEPROM: 0 none, 4 or 16 kilobits
    fitEeprom(kilobits) { x.n64_eeprom_fit(m, kilobits === 4 ? 1 : kilobits === 16 ? 2 : 0); si.eepromKilobits = kilobits === 4 || kilobits === 16 ? kilobits : 0; },
    eepromSize() { return si.eepromKilobits === 16 ? 2048 : si.eepromKilobits === 4 ? 512 : 0; },
    giveEeprom(bytes) { if (bytes.length !== si.eepromSize()) throw new Error("the bytes are not the fitted chip's size"); core.u8().set(bytes, x.n64_eeprom_bytes(m)); },
    eepromBytes() { return bytesAt(x.n64_eeprom_bytes(m), si.eepromSize()); },
    eepromChanges() { return x.n64_eeprom_changes(m) >>> 0; },
    eepromTaken() { x.n64_eeprom_taken(m); },
    eepromBusy() { return x.n64_eeprom_is_busy(m) !== 0; },
    setEepromBusy(milliseconds) { settings.eepromBusyMs = milliseconds; x.n64_eeprom_set_busy(m, BigInt(Math.round(milliseconds * TICKS_PER_SECOND / 1000))); },
    // ---- the PIF's side of a start
    setBoot({ lockout = "6102", warm = false, disk = false } = {}) { if (!(lockout in LOCKOUT)) throw new Error("no such lockout chip type: " + lockout); si.lockout = lockout; x.n64_pif_set_boot(m, LOCKOUT[lockout], warm ? 1 : 0, disk ? 1 : 0); },
    // Whether an MPAL console's PIF sets the boot word's version mark (docs/parts/SI-PIF.md, section 4.1). The
    // PIF goes back to the start of a boot, with the word as the rule makes it for the machine's television type.
    setMarkRule(onNtscOnly) { settings.pifVersionMark = MARK[onNtscOnly ? 1 : 0]; x.n64_pif_set_mark_rule(m, onNtscOnly ? 1 : 0); },
    // The user's own boot firmware. The buffer is copied into the core's memory once and stays the host's.
    setFirmware(bytes) {
      if (!bytes) { x.n64_pif_set_firmware(m, 0, 0); si.firmware = null; return; }
      const at = core.alloc(bytes.length);
      core.u8().set(bytes, at);
      x.n64_pif_set_firmware(m, at, bytes.length);
      si.firmware = { bytes: bytes.length, sha256: sha256(bytes) };
    },
    setBootLimit(on, seconds = 5) { settings.bootLimit = on ? "on" : "off"; settings.bootLimitSeconds = seconds; x.n64_pif_set_boot_limit(m, on ? 1 : 0, BigInt(Math.round(seconds * TICKS_PER_SECOND))); },
    pifState() { const v = x.n64_pif_state(m) >>> 0; return { waitsFor: PIF_WAITS[v & 255], state: v & 255, held: PIF_HELD[(v >>> 8) & 255], isHeld: ((v >>> 8) & 255) !== 0, firmwareLocked: ((v >>> 16) & 1) === 1, resetButtonEnabled: ((v >>> 17) & 1) === 1, firmwarePresent: ((v >>> 18) & 1) === 1 }; },
    bootWord() { return x.n64_pif_boot_word(m) >>> 0; },
    sumType() { const t = x.n64_pif_sum_type(m) >>> 0; return t === 255 ? null : Object.keys(LOCKOUT).filter((k) => LOCKOUT[k] === t).join(" or "); },
    pifRam() { return bytesAt(x.n64_pif_ram(m), 64); },
    // ---- the SI's settings and counters
    setTimeModel(model, fixedTicks = 0) { settings.timeModel = model === 1 ? `every packet takes ${fixedTicks} ticks` : "the console bench's times"; x.n64_si_set_time_model(m, model, BigInt(fixedTicks)); },
    setOverlapWaits(on) { settings.overlap = on ? "a transfer asked for during another is kept and run after it" : "a transfer asked for during another is not done"; x.n64_si_set_overlap_waits(m, on ? 1 : 0); },
    busyLeft() { return Number(x.n64_si_busy_left(m)); },
    pifBusyLeft() { return Number(x.n64_pif_busy_left(m)); },
    counts() { return { packets: x.n64_si_count(m, 0) >>> 0, framesRead: x.n64_si_count(m, 1) >>> 0, framesRun: x.n64_si_count(m, 2) >>> 0, exchanges: x.n64_si_count(m, 3) >>> 0 }; },
    // Lets time pass until the SI's transfer has ended; gives back the ticks that took.
    finish() { const left = x.n64_si_busy_left(m); if (left > 0n) x.n64_wait(m, left); return Number(left); },
    // What a result must name about this part.
    settings() { return { ...settings, consoleTelevisionType: core.tv(), lockoutChip: si.lockout ?? "6102", eeprom: si.eepromKilobits ? `${si.eepromKilobits} kilobits` : "none", bootFirmware: si.firmware ? `the user's (${si.firmware.bytes} bytes, sha256 ${si.firmware.sha256.slice(0, 16)})` : "none: this core stands in for it" }; },

    // A start through the program's own boot code, with this part's side of it: the cartridge's
    // lockout chip, the devices, and the rule about ending the boot.
    //   controllers: ports with a controller; paks: { port: "controller" | "rumble" | "transfer" }; eeprom: 0, 4 or 16
    // The hand-over itself is the core's (tools/core.mjs): the memory chips are not set up, and the
    // program's boot code sets them up, sizes memory and writes the size where the program looks
    // for it, as on a console.
    handOver(bytes, { rdram = 0x400000, tv = 1, lockout = "6102", warm = false, disk = false, markOnNtscOnly = false, controllers = [], paks = {}, eeprom = 0, bootLimit = false, bootLimitSeconds = 5, leavings = null, ownLoader = false, memoryUp = false } = {}) {
      core.handOver(bytes, { rdram, tv, lockout, warm, disk, markOnNtscOnly, leavings, ownLoader, memoryUp });
      si.lockout = lockout;
      settings.pifVersionMark = MARK[markOnNtscOnly ? 1 : 0];
      si.setBootLimit(bootLimit, bootLimitSeconds);
      for (const port of controllers) si.plug(port, true);
      for (const [port, kind] of Object.entries(paks)) si.insertPak(Number(port), kind);
      si.fitEeprom(eeprom);
      si.start = warm ? "handed over to the program's own boot code as after the reset button: main memory still set up" : "handed over to the program's own boot code with the memory chips not set up: the boot code sets main memory up itself";
    },
  };
  return si;
}
