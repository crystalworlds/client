// Opening a game: what every host shares, from the game file's bytes to a machine ready to run. The tools
// (tools/game-lib.mjs, which reads the files from the disk), the play page and the site's core module all
// open a game through startGame here, so the byte order, the game table, the lockout chip, the save memory,
// the start and the counts are one piece of code in each. It imports no part of Node: the host gives the
// built core, the file's bytes, the tables and the user's firmware images.
//
// A game file is private. It is read into the core's memory and nowhere else: nothing here prints,
// returns for printing or saves a byte of it. A game is named by its title in the game table, the
// header fields that table uses (id, destination, revision) and hashes.

import { TV, sextAddress } from "./core-host.mjs?v=6aeda4313354";
import { siHost, BUTTON } from "./si-host.mjs?v=47f9e207851d";
import { normalise } from "./byte-order.mjs?v=44ab6b171d43";
import { gameKey, lookUp } from "./game-table.mjs?v=8f85dd5af7bf";
import { fitSave, saveChanged } from "./save-memory.mjs?v=c6ee6fefce5c";
import { fieldNow } from "./vi-field.mjs?v=2c5559918536";
import { commandName, commandWords } from "./rdp-list.mjs?v=e23ffc6534cb";
import { sha256 } from "./sha256.mjs?v=5ca4ef310af2";
import { copyOut } from "./bytes.mjs?v=9a33ecdacdc2";

export { sha256 };
export const hex = (v, digits = 8) => "0x" + BigInt.asUintN(digits * 4, BigInt(v)).toString(16).padStart(digits, "0");

// Which lockout chip type a boot code belongs with, by the SHA-256 of the boot code (bytes 0x40 to
// 0xFFF of the file in the cartridge's own byte order). Each line was measured: the user's own boot
// firmware was run on this core over a cartridge carrying that boot code, once with each seed, and
// the PIF was asked which chip type the firmware's checksum belongs to (INSTRUMENT-MEASURED on this
// core by tools/game-boot-code.mjs, the disk drive's two over its boot programs as the cartridge; the checksums
// themselves are TABLE-READ, docs/BOUNDARY.md section 4.2). A boot code that is not here is started as a 6102 cartridge, and the result says so.
// The 7102 is the one chip that has no partner in the other television system: its boot code is
// carried by the PAL releases of one game alone, and by no game of the test set. Named as a 6102
// cartridge it starts the same through the stand-in (the seed is the same, and nothing there
// compares a checksum), and is stopped by the PIF through the user's firmware.
export const BOOT_CODES = {
  "b99f06c4802c2377e31e388435955ef3e99c618a6d55d24699d828eb1075f1eb": "6101",
  "61e88238552c356c23d19409fe5570ee6910419586bc6fc740f638f761adc46e": "6102",
  "1d639e5721a5819c25fb44edc33fdd1e9e87ee3aa4916d2cf413c506a473f6e4": "6102",       // an open boot code made to give the same checksum
  "16e062ba8f190c7a712a6bdb34620207299d9be676174cd81d764403df661ad0": "7102",
  "bf3620d30817007091ebe9bddd1b88c23b8a0052170b3309cde5b6b4238e45e7": "6103",
  "04b7bc6717a9f0eb724cf927e74ad3876c381cbb280d841736fc5e55580b756b": "6105",
  "36adc40148af56f0d78cd505eb6a90117d1fd6f11c6309e52ed36bc4c6ba340e": "6106",
  "47a2557ea0e1bfd23999eb6db728d8910e7a51d329f7655d1c02a3017152d826": "8303",       // the disk drive's Japanese boot program
  "9109d6acbfcf5bef497871077de70d44d94b25ec1d3c452688ad461cf46d1fb6": "DDUS",       // the disk drive's American prototype boot program
};

// Boot codes that no lockout chip answers for, measured the same way: with each of the six chip types said
// to be in the cartridge the firmware's checksum belongs to none, and the PIF holds the console at its
// comparison. No cartridge can carry such a boot code. It is met in home-made programs, which a console
// runs from a flash cartridge alone (docs/parts/GAMES.md, section 1.2).
export const NO_CHIP_CODES = {
  "0527b1fe88c2328e96fe4403d954ffb0c167c1e3e95eb8a84b5edde77186b78b": "a maker's boot code changed so that it leaves the sum of the cartridge out: it starts files of any length",
};

// The three ways a game is started, in the order a host takes them (docs/parts/GAMES.md, section 1).
export const WAYS = {
  firmware: "the user's own boot firmware, run from the reset address",
  loader: "no firmware: this core's stand-in, with its own loader for the boot code of the 6105 pair",
  standIn: "no firmware: this core's stand-in as it is",
  timed: "no firmware: this core's stand-in, given the time the firmware takes with this boot code",
  block: "the firmware is not run: this core's stand-in, given by the host the bytes the user's firmware leaves in the RSP's instruction memory",
  menu: "the firmware is not run: this core's stand-in, as a flash cartridge's menu hands a program over, the boot already ended (no lockout chip answers for this boot code)",
};
// Every boot code of the makers sums the cartridge from 0x1000 for one MiB before it starts the program, and
// stops for good where the sum is not the header's. No cartridge's memory ends inside that span, so a file
// that does is not a whole cartridge: what followed it is taken to be zeros, which is how the sums in the
// headers of the short files met were made (docs/parts/GAMES.md, section 1.2).
export const SUM_SPAN = 0x101000;
// A console of which television type a cartridge is made for, by the destination letter of its header:
// the letters of the regions that use PAL, one for Brazil's MPAL, every other NTSC.
const PAL_LETTERS = "DFHILPSUWXYZ";
export const televisionOf = (destination) => (PAL_LETTERS.includes(destination) ? 0 : destination === "B" ? 2 : 1);
// One field of machine time, in ticks: 1001/60000 s on an NTSC or an MPAL console, 1/50 s on a PAL one.
export const FIELD_TICKS = [3_750_000n, 3_128_125n, 3_128_125n];

const RCP_LINES = ["SP", "SI", "AI", "VI", "PI", "DP"];
const CAUSES = { 0: "interrupt", 1: "TLB modification", 2: "TLB miss on a load or fetch", 3: "TLB miss on a store", 4: "address error on a load or fetch", 5: "address error on a store", 6: "bus error on a fetch", 7: "bus error on data",
  8: "system call", 9: "breakpoint", 10: "reserved instruction", 11: "coprocessor unusable", 12: "overflow", 13: "trap", 15: "floating point", 23: "watch" };
const CPU_LINES = ["software 0", "software 1", "the RCP", "the cartridge", "the reset button", "line 5", "line 6", "the timer"];
const TASK_TYPES = ["no type the maker's library names", "graphics", "sound", "video", "type 4", "type 5", "type 6", "type 7"];
const RDP_STOPS = ["not stopped", "a fill into a 4-bit image", "a copy into a 32-bit image", "a load from a 4-bit image", "a palette load of more than one line", "a block load from a 4-bit image (the RDP hangs at the next primitive or load)"];
const WATCH_ENDS = ["instruction limit", "the tick asked for", "the machine stopped", "a full sync", "the capture ended"];

// Controller input by field: "120:START,126:-,300:A+B@40;-20" presses START from field 120, lets go at
// 126, and from field 300 holds A and B with the stick at (40, -20). Each entry holds until the next.
export function readInput(text) {
  return (text ?? "").split(",").map((s) => s.trim()).filter(Boolean).map((entry) => {
    const m = /^(\d+):([A-Za-z_+\-]*)(?:@(-?\d+);(-?\d+))?$/.exec(entry);
    if (!m) throw new Error(`an input entry reads field:BUTTONS or field:BUTTONS@x;y, not "${entry}"`);
    const names = m[2].split("+").filter((n) => n && n !== "-");
    for (const n of names) if (!(n.toUpperCase() in BUTTON)) throw new Error(`no button is called ${n} (there are ${Object.keys(BUTTON).join(", ")})`);
    return { field: Number(m[1]), buttons: names.reduce((a, n) => a | BUTTON[n.toUpperCase()], 0), names, x: Number(m[3] ?? 0), y: Number(m[4] ?? 0) };
  }).sort((a, b) => a.field - b.field);
}

// Opens a game on a loaded core (shared/core-host.mjs), ready to run.
//   fileBytes: the game file, in any of the three byte orders; tables: the game table (shared/game-table.mjs)
//   firmwareImages: the user's own boot firmware images, or null for none. With them the machine starts at the reset
//   address and the image that hands over as a console of the television type wanted runs its two stages before the
//   game's boot code, as in a console; without them this core stands in for the firmware (docs/BOUNDARY.md, section
//   4.3). No byte of the firmware is kept or shown: an image is named by its size and hash.
//   firmwareTimes: tables/firmware-time.json's rows by boot code (the time the firmware takes), or null.
//   memory: MiB of main memory fitted (4, or 8 with the Expansion Pak); tv: the console's type, or null for
//   the type the cartridge's destination letter is sold for; pak: what is in the first controller's slot
//   leavings: what the firmware leaves that the stand-in cannot make itself, for a start through the stand-in
//   (shared/core-host.mjs says what it holds); `leavings.from` says in words where the caller took it from.
//   ownLoader: with no firmware and a cartridge that carries the 6105 pair's boot code, the stand-in puts its
//   own loader in the RSP's instruction memory (core/boot.c) and lets the time pass that the table gives for
//   the firmware. On unless told otherwise.
//   firmwareTimeOn: with no firmware, the stand-in lets the time pass that the firmware takes with this boot
//   code and counts its instructions, where the table (tables/firmware-time.json) has a row for the boot
//   code: the start then equals a start through the firmware in every part of the machine at the game's
//   first instruction (tools/check-start-time.mjs). On unless told otherwise. `timeTable` gives another
//   table's rows (by boot code hash), for the check.
//   menuStart: a boot code that no lockout chip answers for is handed over as a flash cartridge's menu hands
//   a program over: by the stand-in, firmware given or not, with the PIF's boot already ended (section 1.2 of
//   the games chapter); and for a file the game table does not know or one shorter than the span a boot code
//   sums, whatever its boot code, the PIF's rule about ending the boot is not kept. On unless told otherwise; off, a boot code no chip answers for is
//   started as a 6102 cartridge and the rule is kept as `bootLimit` says. `noChipCodes` gives another table of
//   such boot codes, for the check.
//   shortFileZeros: a file that ends inside the span its boot code sums is followed by zeros to the end of
//   that span. On unless told otherwise; off, nothing answers past the file's end.
//   asChip: the lockout chip type the cartridge is said to carry, in place of the one the table of boot codes
//   names: for the tool that measures which chip a boot code belongs to. The facts then say both.
// The way the start was made is said in the game's facts, which every result carries.
// The time a cartridge's clock is set to when the host gives none: a Saturday, the first of 2000, at midnight.
export const CLOCK_START = { year: 2000, month: 1, day: 1, weekday: 6, hour: 0, minute: 0, second: 0 };
export function startGame(core, fileBytes, { tables, firmwareImages = null, firmwareTimes = null, memory = 8, tv = null, pak = "none", bootLimit = true, leavings = null, ownLoader = true, asChip = null, firmwareTimeOn = true, timeTable = null, menuStart = true, shortFileZeros = true, noChipCodes = NO_CHIP_CODES, clockMs = null } = {}) {
  const x = core.x, m = core.machine;
  if (!x.n64_run_watched) throw new Error(`the build ${core.build.file} has no run watch: build the core again`);
  const found = normalise(fileBytes);
  const fileLength = found.bytes.length, zerosAdded = shortFileZeros && fileLength < SUM_SPAN ? SUM_SPAN - fileLength : 0;
  let bytes = found.bytes;
  if (zerosAdded) { bytes = new Uint8Array(SUM_SPAN); bytes.set(found.bytes); }
  const key = gameKey(bytes), fileKey = found.fileKey;
  const table = lookUp(tables, key, fileKey);
  const bootCode = sha256(bytes.subarray(0x40, 0x1000)), named = BOOT_CODES[bootCode] ?? null, chip = asChip ?? named;
  // No chip answers for the boot code: no cartridge can carry it, and a console runs such a program from a
  // flash cartridge alone, whose menu has passed the PIF's comparison and ended the boot before it hands over.
  const byMenu = menuStart && chip === null && bootCode in noChipCodes;
  const firmwareGiven = Array.isArray(firmwareImages) && !byMenu;
  // A file the game table does not know is no cartridge that was sold, and neither is one that ends inside
  // the span a boot code sums, whatever its header says: a console runs it from a flash cartridge, whose menu
  // has ended the boot. The PIF's rule about ending the boot is then not kept.
  const unsold = table.level === "not in the table" || table.level === "home-made header" || fileLength < SUM_SPAN;
  const limitWas = bootLimit;
  if (byMenu || (menuStart && unsold)) bootLimit = false;
  const limitWhy = bootLimit ? "on: the PIF holds the console when the boot is not ended in five seconds" : !limitWas ? "off" : byMenu ? "off: a flash cartridge's menu has ended the boot" : "off: this file is no sold cartridge (the game table does not know it, or it is shorter than a cartridge's memory), and a flash cartridge's menu, from which a console runs such a program, has ended the boot";
  const television = tv ?? televisionOf(key.destination);
  const si = siHost(core);
  const save = { asTheTableSays: table.save, tableLevel: table.level, tableCertain: table.certain };
  const eeprom = table.save === "eeprom-4k" ? 4 : table.save === "eeprom-16k" ? 16 : 0;
  let firmware = "none: this core stands in for it", firmwareImage = null, way = WAYS.standIn;
  if (firmwareGiven) {
    // The user's firmware: every image given is tried, and the one that hands over as a console of the television
    // type wanted is taken (the firmware says its type in register s4).
    const images = firmwareImages;
    let taken = null;
    for (const image of images) {
      core.coldStart(memory * 0x100000);
      core.setCart(bytes);
      si.setBoot({ lockout: chip ?? "6102" });
      si.setFirmware(image);
      si.setBootLimit(bootLimit, 5);
      si.plug(0, true);
      if (pak !== "none") si.insertPak(0, pak);
      si.fitEeprom(eeprom);
      core.run(60_000_000, sextAddress(0xA4000040));
      if (core.stopReason() === "reached the stop address" && Number(core.gpr(20)) === television) { taken = image; break; }
    }
    if (!taken) throw new Error(`no boot firmware image given hands over as a ${TV[television]} console with this cartridge (${images.length} images tried)`);
    x.n64_set_tv(m, television);
    firmwareImage = taken;
    firmware = `the user's own (${taken.length} bytes, sha256 ${sha256(taken).slice(0, 16)})`;
    way = WAYS.firmware;
    si.start = "started at the reset address with the user's own boot firmware, which ran its two stages and handed over to the game's boot code; the boot code sets main memory up itself";
  } else {
    // The loader is for the true boot code of the pair only, which the hash of the boot code says; bytes
    // given by the caller for instruction memory come first.
    const useLoader = ownLoader && chip === "6105" && !(leavings && leavings.block?.length);
    let timed = false;
    if (firmwareTimeOn && !leavings) { const t = (timeTable ?? firmwareTimes)?.[bootCode]?.[TV[television]] ?? null; if (t) { timed = true; leavings = { ticks: BigInt(t.ticks), instructions: BigInt(t.instructions), from: "the table's figures for the time and the instructions of the firmware, measured on this core" }; } }
    si.handOver(bytes, { rdram: memory * 0x100000, tv: television, lockout: chip ?? "6102", controllers: [0], paks: pak === "none" ? {} : { 0: pak }, eeprom, bootLimit, leavings, ownLoader: useLoader });
    if (leavings && leavings.block?.length) way = WAYS.block;
    if (timed) way = WAYS.timed;
    if (byMenu) way = WAYS.menu;
    if (useLoader) { way = WAYS.loader; si.start = `${si.start}; the stand-in's own loader for this boot code was put in the RSP's instruction memory`; }
    if (leavings) { firmware = `none: this core stands in for it, given ${leavings.from ?? "what the caller says the firmware leaves"}`; si.start = `${si.start}; given by the host: ${[leavings.block?.length ? `${leavings.block.length} bytes of the RSP's instruction memory from ${hex(leavings.at ?? 0, 3)}` : null, leavings.ticks ? `${leavings.ticks} ticks for the firmware's own time` : null, leavings.instructions ? `${leavings.instructions} instructions for the firmware's own run` : null].filter(Boolean).join(", ") || "nothing"}`; }
  }
  if (pak === "controller") si.formatPak(0);
  // The cartridge's clock, for a game the table says has one (its clock column; a home-made header asks with bit 0 of its
  // revision byte): fitted after the start, as save memory is, and set from the host's time in ms (clockMs) or, when none
  // is given, from a fixed time (CLOCK_START), so that a tool's run is the same every time.
  let clock = null;
  if (table.clock && x.n64_rtc_fit) { si.fitClock(true); clock = si.setClock(clockMs ?? CLOCK_START); }
  // Save memory on the cartridge bus is fitted after the start: a start wipes it.
  if (table.save === "sram-256k") save.fitted = fitSave(core, "sram-256k").name;
  else if (table.save === "sram-768k") save.fitted = fitSave(core, "sram-768k-banked").name;
  else if (table.save === "flash-1m") {
    save.fitted = fitSave(core, "flash-mx29l1100").name;
    if (table.flashChip !== "MX29L1100") save.note = "the table does not name this cartridge's FlashRAM chip: the MX29L1100 is taken";
  } else if (table.save.startsWith("eeprom")) save.fitted = `${table.save}, behind the PIF`;
  else if (table.save === "none") save.fitted = "none";
  else { save.fitted = "none"; save.note = `this core has no save memory of the kind ${table.save}`; }

  // Room in the core's memory for the watch's counts and for the RDP's command words.
  const watchBytes = x.n64_run_watch_size(), watchAt = core.alloc(watchBytes);
  core.u8().fill(0, watchAt, watchAt + watchBytes);
  const CAP = 1 << 22, wordsAt = core.alloc(CAP * 4);
  let ramAt = 0, afterAt = 0;
  const fieldTicks = FIELD_TICKS[television];
  const rdp = { byNumber: new Map(), commands: 0, wordsLost: 0 };
  const count = (words) => {
    for (let at = 0; at < words.length; ) { const id = (words[at] >>> 24) & 0x3F; rdp.byNumber.set(id, (rdp.byNumber.get(id) ?? 0) + 1); rdp.commands++; at += commandWords(words[at]); }
  };
  // Takes the command words run since the last call, counts them, and starts taking again.
  const drain = (keep = false) => {
    const len = x.n64_rdp_capture_len(m), words = new Uint32Array(x.memory.buffer, wordsAt, len);
    rdp.wordsLost += x.n64_rdp_capture_lost(m);
    count(words);
    const kept = keep ? words.slice() : null;
    x.n64_rdp_capture(m, wordsAt, CAP, 0, 0, 0, 0);
    return kept;
  };
  x.n64_rdp_capture(m, wordsAt, CAP, 0, 0, 0, 0);
  const watch = () => new BigUint64Array(x.memory.buffer, watchAt, watchBytes / 8);
  const ALL = 0xFFFFFFFFFFFFFFFFn;
  const game = {
    core, si, file: null, television, fieldTicks, memoryMiB: memory,
    // The user's firmware image the start went through, or null: for a tool that has to ask where bytes came
    // from. It is the user's and private, and stays in this process's memory.
    bootFirmwareImage: firmwareImage,
    facts: {
      title: table.title ?? "(the game table has no title for it)", id: key.id, destination: key.destination, revision: key.revision,
      fileSha256: fileKey, fileBytes: fileLength, zerosAfterTheFile: zerosAdded ? `${zerosAdded} bytes: the file ends inside the span its boot code sums` : "none", byteOrderOfTheFile: found.order,
      bootCodeSha256: bootCode, lockoutChip: asChip ? `${asChip}, as the caller says (the table of boot codes names ${named ?? "none"})` : chip === "7102" ? "7102, which has no pair" : chip ? `${chip}'s pair` : byMenu ? "none answers for its boot code: handed over as a flash cartridge's menu does, with the 6102's seed" : "not known by its boot code: started as a 6102 cartridge",
      save, pak, ...(clock ? { clock: { setTo: clock, from: clockMs === null ? "a fixed time (no host time given)" : "the host's time at the start" } } : {}), consoleTelevisionType: TV[television], televisionTypeFrom: tv === null ? "the cartridge's destination letter" : "what the run was told",
      mainMemoryMiB: memory, startWay: way, start: si.start, bootFirmware: firmware, pifBootLimit: limitWhy,
    },
    field: 0, instructions: 0, frozen: false,
    // Runs to the end of field `to` of machine time. Returns false when the machine froze on the way.
    runTo(to, step = 4) {
      while (game.field < to && !game.frozen) {
        const until = BigInt(game.field + 1) * fieldTicks;
        game.instructions += Number(x.n64_run_watched(m, watchAt, 4_000_000_000n, until, step, 0));
        const why = Number(watch()[64]);
        if (why === 2) { game.frozen = true; break; }
        if (why === 1) { game.field++; drain(); }
      }
      return !game.frozen;
    },
    // Records one whole frame's list: waits for a full sync, then takes main memory as it stands before
    // the next command and every command word up to the next full sync, and main memory after it. Gives
    // up after `patience` fields. The scene holds game data: the caller keeps it out of the repository.
    recordFrame(patience = 30, step = 4) {
      if (!ramAt) { ramAt = core.alloc(memory * 0x100000); afterAt = core.alloc(memory * 0x100000); }
      const lastField = game.field + patience;
      const runUntil = (stopOn, wanted) => {
        while (game.field < lastField && !game.frozen) {
          const until = BigInt(game.field + 1) * fieldTicks;
          game.instructions += Number(x.n64_run_watched(m, watchAt, 4_000_000_000n, until, step, stopOn));
          const why = Number(watch()[64]);
          if (why === wanted) return true;
          if (why === 2) game.frozen = true;
          else if (why === 1) { game.field++; if (stopOn === 1) drain(); }
        }
        return false;
      };
      if (!runUntil(1, 3)) return { recorded: false, why: game.frozen ? "the machine froze" : `no full sync in ${patience} fields` };
      drain();
      const from = { field: game.field, instructions: game.instructions };
      x.n64_rdp_capture(m, wordsAt, CAP, ramAt, afterAt, 1, 0);
      const ended = runUntil(2, 4);
      const lost = x.n64_rdp_capture_lost(m);
      if (!ended) { drain(); return { recorded: false, why: game.frozen ? "the machine froze" : `the frame did not end in ${patience} fields` }; }
      const bytesOfRam = x.n64_rdram_size(m);            // what answers now: the boot code has set memory up long before a frame is drawn
      const ram = copyOut(core.u8().subarray(ramAt, ramAt + bytesOfRam)), ramAfter = copyOut(core.u8().subarray(afterAt, afterAt + bytesOfRam));
      const words = drain(true);
      if (lost) return { recorded: false, why: "the frame's list is longer than the recorder's room" };
      return { recorded: true, ram, ramAfter, words, afterField: from.field, endedInField: game.field, instructionsAtItsStart: from.instructions };
    },
    setInput(buttons, stickX = 0, stickY = 0) { si.set(0, buttons, stickX, stickY); },
    // One field as the VI would send it now: the usual window of this television type, 640 pixels by half the lines.
    picture() {
      const win = { x0: x.n64_vi_usual_window(m, 0), width: x.n64_vi_usual_window(m, 1), top: x.n64_vi_usual_window(m, 2), rows: x.n64_vi_usual_window(m, 3) };
      const f = fieldNow(core, win, 0);
      if (!f.made) return { made: false };
      let lit = 0;
      for (let i = 0; i < f.pixels.length; i += 4) if (f.pixels[i] | f.pixels[i + 1] | f.pixels[i + 2]) lit++;
      return { made: true, width: f.width, height: f.height, pixels: f.pixels, sha256: sha256(f.pixels), pixelsNotBlack: lit, linesOfPicture: f.lines };
    },
    // Where the CPU is, and what it last took: addresses and register values, no memory.
    where() {
      return { pc: hex(core.pc(), 16), ra: hex(core.gpr(31), 16), sp: hex(core.gpr(29), 16), status: hex(x.n64_get_status(m)), cause: hex(x.n64_get_cause(m)), epc: hex(x.n64_get_epc(m), 16), badVaddr: hex(x.n64_get_bad_vaddr(m), 16) };
    },
    // What the game has asked of each part since the start.
    asked() {
      const w = watch(), n = (i) => Number(w[i]);
      const named = (from, names) => Object.fromEntries(names.map((name, i) => [name, n(from + i)]).filter(([, v]) => v > 0));
      const causes = {};
      for (let c = 0; c < 32; c++) if (n(7 + c)) causes[CAUSES[c] ?? `cause code ${c}`] = n(7 + c);
      const byNumber = Object.fromEntries([...rdp.byNumber.entries()].sort((a, b) => a[0] - b[0]).map(([id, c]) => [`${hex(id, 2)} ${commandName(id << 24)}`, c]));
      return {
        looks: n(0),
        rsp: { startsByTaskType: named(54, TASK_TYPES), starts: TASK_TYPES.reduce((a, _, i) => a + n(54 + i), 0), instructions: Number(x.n64_rsp_instructions(m)) },
        rdp: { commands: rdp.commands, commandsRunByTheCoresOwnCount: Number(x.n64_rdp_commands_run(m)), byNumber, fullSyncs: Number(x.n64_rdp_full_syncs(m)), pixelsWritten: Number(x.n64_rdp_pixels_written(m)),
          stopped: RDP_STOPS[x.n64_rdp_stopped(m)] ?? `reason ${x.n64_rdp_stopped(m)}`, wordsTheCounterHadNoRoomFor: rdp.wordsLost },
        pi: { dmasIntoMemory: n(62), dmasOutOfMemory: n(63), saveMemoryWritten: saveChanged(core) },
        si: { ...si.counts(), controllerPolls: si.polls(0), eepromChanges: si.eepromChanges() },
        ai: { registerWrites: x.n64_ai_writes(m) >>> 0, interrupts: Number(x.n64_ai_interrupts(m)), framesPlayed: Number(x.n64_ai_frames_played(m)) },
        vi: { on: x.n64_vi_state(m, 0) !== 0, fieldsBegun: x.n64_vi_state(m, 2) >>> 0, hazards: x.n64_vi_hazards(m) >>> 0 },
        interruptLinesRaised: named(1, RCP_LINES), exceptionsByCause: causes, exceptionsWhoseCauseWasNotSeen: n(39), exceptionsByTheCoresOwnCount: Number(x.n64_exceptions(m)),
        interruptsTakenByCpuLine: named(40, CPU_LINES), rcpInterruptsTakenByLine: named(48, RCP_LINES),
      };
    },
    // How the run stands: whether the machine is frozen and why, in the core's own words.
    state() {
      const pif = si.pifState();
      return { field: game.field, instructions: game.instructions, ticks: String(x.n64_now(m)), frozen: game.frozen, freeze: game.frozen ? core.freezeReason() : "not frozen", pif: pif.isHeld ? pif.held : pif.waitsFor === "nothing: it is running" ? "the boot was ended" : `waits for ${pif.waitsFor}`,
        mainMemoryAnswering: x.n64_rdram_size(m) >>> 0, debugTextBytesNotShown: x.n64_debug_text_len(m) >>> 0, ...game.where() };
    },
    // What the CPU is doing now, for a run that stands still: the machine is run on for `steps` instructions,
    // one at a time, and what comes back is where it ran (how many different addresses, and the lowest
    // and highest) and which addresses its loads and stores went to, by kind. The instructions are read
    // here to find those addresses and are never returned: this is no listing of the game's code.
    loopReport(steps = 4000) {
      const LOADS = { 0x20: 1, 0x21: 2, 0x22: 4, 0x23: 4, 0x24: 1, 0x25: 2, 0x26: 4, 0x27: 4, 0x37: 8, 0x31: 4, 0x35: 8, 0x1A: 8, 0x1B: 8 };
      const STORES = { 0x28: 1, 0x29: 2, 0x2A: 4, 0x2B: 4, 0x2E: 4, 0x3F: 8, 0x39: 4, 0x3D: 8, 0x2C: 8, 0x2D: 8 };
      const pcs = new Set(), touched = new Map();
      let low = 0xFFFFFFFF, high = 0, unread = 0;
      const before = Number(x.n64_exceptions(m));
      for (let i = 0; i < steps && !game.frozen; i++) {
        const pc = Number(BigInt.asUintN(32, core.pc()));
        pcs.add(pc); if (pc < low) low = pc; if (pc > high) high = pc;
        let word = null;
        if (pc >= 0x80000000 && pc < 0xC0000000) {
          const p = pc & 0x1FFFFFFF;
          if (p + 4 <= x.n64_rdram_size(m)) { const b = core.seen(p, 4); word = ((b[0] << 24) | (b[1] << 16) | (b[2] << 8) | b[3]) >>> 0; }
          else if (p >= 0x04000000 && p < 0x04002000) { const at = (p < 0x04001000 ? x.n64_dmem(m) : x.n64_imem(m)) + (p & 0xFFF), u = core.u8(); word = ((u[at] << 24) | (u[at + 1] << 16) | (u[at + 2] << 8) | u[at + 3]) >>> 0; }
        }
        if (word === null) unread++;
        else {
          const op = word >>> 26, size = LOADS[op] ?? STORES[op];
          if (size) {
            const address = Number(BigInt.asUintN(32, core.gpr((word >>> 21) & 31) + BigInt.asIntN(16, BigInt(word & 0xFFFF))));
            const physical = address >= 0x80000000 && address < 0xC0000000 ? address & 0x1FFFFFFF : null;
            const key = physical !== null && physical < 0x03F00000 ? `${op in LOADS ? "reads" : "writes"} of main memory` : `${op in LOADS ? "read" : "write"} of ${size} bytes at ${hex(address)}`;
            touched.set(key, (touched.get(key) ?? 0) + 1);
          }
        }
        game.instructions += core.run(1);
        if (core.stopReason() === "frozen") game.frozen = true;
      }
      return { instructions: steps, differentAddressesRun: pcs.size, lowest: hex(low), highest: hex(high), instructionsThisToolCouldNotRead: unread, exceptionsMeanwhile: Number(x.n64_exceptions(m)) - before,
        accesses: Object.fromEntries([...touched.entries()].sort((p, q) => q[1] - p[1]).slice(0, 24)),
        rsp: { halted: x.n64_rsp_halted(m) !== 0, pc: hex(x.n64_rsp_pc(m), 3), status: hex(x.n64_bus_look(m, 0x04040010)) },
        mi: { lines: hex(x.n64_bus_look(m, 0x04300008), 2), mask: hex(x.n64_bus_look(m, 0x0430000C), 2) }, piStatus: hex(x.n64_bus_look(m, 0x04600010), 2), siStatus: hex(x.n64_bus_look(m, 0x04800018)) };
    },
    watchEnds: WATCH_ENDS,
  };
  return game;
}
