// play/cores/n64/disk.mjs: the 64DD disk drive in the site's module. A disk image (.ndd, every block in LBA order)
// is opened as a game: the console starts from the drive's own boot program, a file of the player's (the slot
// "dd-ipl", chosen as the console's boot firmware is), with the drive under it and the disk in. A disk made to
// expand a cartridge says so by its own code, and asks for that cartridge by the cartridge's code (the slot
// "dd-cart", one file per disk): given it, the cartridge starts with the drive attached, as a console with both
// starts; not given, the disk starts alone and its own screen says what it needs. What the drive writes on the disk
// is the disk's save (the battery "disk"), kept by the host apart from the image and given back before power-on.
// The drive itself is the pilot's (machine/disk-drive.mjs over the core's drive).
//
// The disk, the drive's boot program and the cartridge are the player's and private: they are in this worker's
// memory only, named in the Log by size, kind and the first digits of their hashes.

import { coreFromModule, sextAddress } from "./machine/core-host.mjs?v=6aeda4313354";
import { siHost } from "./machine/si-host.mjs?v=47f9e207851d";
import { diskDrive, DISK_IMAGE_BYTES, IPL_BYTES, ASIC_ID } from "./machine/disk-drive.mjs?v=dc1be0c6937e";
import { BOOT_CODES, FIELD_TICKS } from "./machine/open-game.mjs?v=23a81c63a549";
import { normalise } from "./machine/byte-order.mjs?v=44ab6b171d43";
import { sha256 } from "./machine/sha256.mjs?v=5ca4ef310af2";

// The slots of the drive's files. A cartridge never asks for either (firmwareFor below).
export const SLOTS = [
  { id: "dd-ipl", label: "64DD disk drive boot program", required: "media:ndd" },
  { id: "dd-cart", label: "The cartridge this 64DD disk expands", required: "never", perGame: true },
];
export const SAVE_ID = "disk";
// The disk's own code: the first four characters of the disk's ID block (LBA 14, the fifteenth block of the first
// zone, whose blocks are 85 sectors of 232 bytes). TABLE-READ. A first letter "E" marks a disk that expands a
// cartridge; that cartridge's header code (bytes 0x3B to 0x3E) is "C" and the same three letters (measured on the
// library: both such disks have that cartridge there, counts only).
const CODE_AT = 14 * 85 * 232;

export const isDisk = (b) => !!b && b.length === DISK_IMAGE_BYTES && (b[5] & 0xF0) === 0x10 && (b[5] & 0x0F) <= 6;
export function diskCode(b) {
  if (!isDisk(b)) return null;
  const s = String.fromCharCode(...b.subarray(CODE_AT, CODE_AT + 4));
  return /^[0-9A-Z]{4}$/.test(s) ? s : null;
}
export const cartCodeFor = (b) => { const c = diskCode(b); return c && c[0] === "E" ? "C" + c.slice(1) : null; };
export function cartCodeOf(bytes) {
  try { const h = normalise(bytes).bytes; return String.fromCharCode(...h.subarray(0x3B, 0x3F)); } catch { return null; }
}

// The drive's boot program in the bus's own byte order, whatever order the file is in: its first byte on the bus is
// 0x80 (the first bus timing word), so a file whose second byte is 0x80 has its pairs swapped and one whose fourth
// is has its words reversed. MECHANISM.
export function iplInBusOrder(b) {
  if (!b || b.length !== IPL_BYTES) return null;
  if (b[0] === 0x80) return b;
  const out = new Uint8Array(b.length);
  if (b[1] === 0x80) { for (let i = 0; i < b.length; i += 2) { out[i] = b[i + 1]; out[i + 1] = b[i]; } return out; }
  if (b[3] === 0x80) { for (let i = 0; i < b.length; i += 4) { out[i] = b[i + 3]; out[i + 1] = b[i + 2]; out[i + 2] = b[i + 1]; out[i + 3] = b[i]; } return out; }
  return null;
}

// The drive's clock reads in the player's own time of day: the host's time in ms (the computer's own when the host's
// is no calendar time), its local fields set as the clock's.
const localDate = (ms) => { const t = ms > 1e12 ? ms : Date.now(); return new Date(t - new Date(t).getTimezoneOffset() * 60000); };
const short = (b) => sha256(b).slice(0, 12);

// What the manifest says of a file (the module's manifest is the same for every created module, so a fault made on
// purpose here is the last one a created module was given: a check's only).
let manifestFault = 0;
// The firmware a disk asks for: the drive's boot program, the console's NTSC boot firmware (a disk is NTSC), and the
// cartridge it expands when its code says it expands one. A cartridge asks for none of the drive's.
export const firmwareFor = (b) => (isDisk(b) ? ["dd-ipl", "pif-ntsc", ...(cartCodeFor(b) && manifestFault !== 1955 ? ["dd-cart"] : [])] : manifestFault === 1952 ? ["dd-ipl"] : []);   // 1952, wrong on purpose: a cartridge asks for the drive's boot program; 1955: a disk that expands a cartridge does not ask for it
// The cartridge is asked for by its code alone ("cart:CXXX"); no game is named.
export const roleFor = (b, id) => (id === "dd-cart" && isDisk(b) && cartCodeFor(b) ? `cart:${cartCodeFor(b)}` : "");
export const preloadFor = (b) => (isDisk(b) ? [SAVE_ID] : []);

// The disk side of one created module. open(bytes, firmware, prep) is the module's own opening of a cartridge,
// prep(core) being said on every core it tries before the start; CoreError its error class.
export function diskSide({ compiled, compiledNow = null, open, CoreError, hostMs, fault = 0 }) {
  manifestFault = fault;
  let drive = null, held = null, info = null, writtenAtClean = 0;

  // The drive under a core about to start: attached, its boot program, its clock and the disk with its save. A save
  // that belongs to another image (or does not fit this one) is left out, and the Log says so.
  function prepare(core, o) {
    const d = diskDrive(core);
    d.attach(ASIC_ID.japan);
    d.setIpl(o.ipl);
    d.setClock(fault === 1956 ? new Date(Date.UTC(2026, 0, 1)) : localDate(o.clockMs));   // 1956, wrong on purpose: the clock is not the player's time
    o.clockSet = d.clock().toISOString().slice(0, 19).replace("T", " ");
    const save = fault === 1950 ? null : o.save;                                            // 1950, wrong on purpose: the save given before power-on is not put in
    try { d.insert(o.image, save, o.sha); const n = d.written().length; o.saveWas = save ? `${n} block${n === 1 ? "" : "s"} given back` : "none kept yet"; }
    catch (e) { if (!save) throw e; d.insert(o.image, null, o.sha); o.saveWas = `the save kept for this disk was not used: ${e.message}`; }
    return d;
  }

  // The disk alone: the console with no cartridge, started from the drive's boot program through the player's NTSC
  // boot firmware when it hands over, else through this core's stand-in (as tools/disk-run.mjs starts it). The
  // drive's lockout chip is the one its boot program's boot code belongs to (the table of boot codes), else the
  // Japanese drive's.
  function startAlone(o) {
    const lockout = BOOT_CODES[sha256(o.ipl.subarray(0x40, 0x1000))] ?? "8303";
    const paks = o.pak === "none" ? {} : { 0: o.pak };
    // (compiledNow: the build of the engine in force, which the player may change while the module lives)
    const make = () => { const core = coreFromModule(compiledNow ? compiledNow() : compiled); return { core, si: siHost(core), drive: prepare(core, o) }; };
    let g = null, way = null, firmware = "none: this core stands in for it";
    if (o.pif) {
      const t = make();
      t.core.coldStart(o.memory * 0x100000);
      t.core.setCart(new Uint8Array(0));
      t.si.setBoot({ lockout, disk: true });
      t.si.setFirmware(o.pif);
      t.si.setBootLimit(true, 5);
      t.si.plug(0, true);
      if (o.pak !== "none") t.si.insertPak(0, o.pak);
      t.core.run(60_000_000, sextAddress(0xA4000040));
      if (t.core.stopReason() === "reached the stop address" && Number(t.core.gpr(20)) === 1) {
        g = t; way = "the player's own boot firmware, run from the reset address, handing over to the drive's boot program";
        firmware = `yours (${o.pif.length} bytes, sha256 ${short(o.pif)})`;
      } else firmware = `yours (${o.pif.length} bytes, sha256 ${short(o.pif)}) did not hand over as an NTSC console: this core stands in for it`;
    }
    if (!g) {
      g = make();
      g.si.handOver(new Uint8Array(0), { rdram: o.memory * 0x100000, tv: 1, lockout, disk: true, controllers: [0], paks, bootLimit: true });
      way = "this core's stand-in for the console's boot firmware, handing over to the drive's boot program";
    }
    g.core.x.n64_set_tv(g.core.machine, 1);
    if (o.pak === "controller") g.si.formatPak(0);
    info = { ...o.said, lockout, way, firmware, cartridge: o.cartSaid };
    return { core: g.core, si: g.si, drive: g.drive, television: 1, fieldTicks: FIELD_TICKS[1], memoryMiB: o.memory,
      facts: { title: `a 64DD disk${o.said.code ? ` (${o.said.code})` : ""}`, save: { fitted: "none" }, consoleTelevisionType: "NTSC", startWay: way, bootFirmware: firmware } };
  }

  // A disk opened: the player's files checked, then the cartridge it expands when it asks for one and it was given,
  // else the disk alone. Returns { game, note }.
  function start(req, options) {
    const image = req.bytes, ipl = iplInBusOrder(req.firmware?.["dd-ipl"] ? new Uint8Array(req.firmware["dd-ipl"]) : null);
    if (!ipl) {
      const why = req.firmware?.["dd-ipl"] ? `the file given as the drive's boot program is not one: it is ${IPL_BYTES} bytes (4 MiB), and its first word begins 0x80` : "This is a 64DD disk. It needs the 64DD disk drive's own boot program (a 4 MiB file), which this site does not have. Choose the drive's boot program below.";
      throw new CoreError(fault === 1954 ? "damaged" : "needs-firmware", why);   // 1954, wrong on purpose: a disk with no drive boot program is said to be damaged
    }
    const code = diskCode(image), wants = cartCodeFor(image);
    const sys = { type: image[5] & 0x0F, retail: (image[0] | image[1] | image[2] | image[3]) !== 0 };
    const pif = req.firmware?.["pif-ntsc"]?.length ? new Uint8Array(req.firmware["pif-ntsc"]) : null;
    const said = { code, type: sys.type, retail: sys.retail, diskSha: (req.sha ?? "").slice(0, 12), ipl: `${ipl.length} bytes, sha256 ${short(ipl)}` };
    const o = { image, ipl, pif, sha: /^[0-9a-f]{64}$/.test(req.sha ?? "") ? req.sha : null, save: req.save ?? null, clockMs: hostMs(), memory: options.memory, pak: options.pak, said, saveWas: "", cartSaid: "none" };
    let note = null, game = null;
    if (wants) {
      const cart = req.firmware?.["dd-cart"]?.length ? new Uint8Array(req.firmware["dd-cart"]) : null;
      const theirs = cart ? cartCodeOf(cart) : null;
      if (cart && (theirs === wants || fault === 1958) && fault !== 1957) {        // 1957, wrong on purpose: the cartridge given is not used; 1958: a cartridge of another code is taken
        const drives = new Map();
        game = open(cart, req.firmware, (core) => drives.set(core, prepare(core, o)));
        if (game) {
          game.drive = drives.get(game.core);
          info = { ...said, lockout: game.facts.lockoutChip, way: `from the cartridge (${theirs}, ${cart.length} bytes, sha256 ${short(cart)}) with the drive attached: ${game.facts.startWay}`, firmware: game.facts.bootFirmware, cartridge: `${theirs}, ${cart.length} bytes, sha256 ${short(cart)}` };
        }
      } else note = cart ? `This disk works with the cartridge whose code is ${wants}; the file given for it is ${theirs ? `the cartridge ${theirs}` : "no cartridge"}, so the disk starts alone.` : `This disk works with a cartridge (its code is ${wants}). Choose that cartridge in Settings, Boot programs, then open the disk again; until then the disk starts alone.`;
      o.cartSaid = cart && !game ? `${theirs ?? "not a cartridge"}, not the one asked for (${wants})` : `none given (${wants} asked for)`;
    }
    game ??= startAlone(o);
    drive = game.drive; held = game.core;
    info.saveWas = o.saveWas; info.clockSet = o.clockSet;
    writtenAtClean = drive.counts().sectorsWritten;
    return { game, note };
  }

  // The disk's save as the site's battery calls see it: listed for a disk, of any length (the drive's DD64SAVE form:
  // the blocks written, with the hash of the image they belong to), reported when the drive has written a sector since
  // the host last kept it.
  const battery = {
    ids: () => (drive ? [{ id: SAVE_ID, kind: "disk", bytes: 0, ext: ".ddsave" }] : []),
    read: () => (drive ? drive.takeSave() : null),
    write: (bytes) => { if (!drive) return false; try { drive.giveSave(bytes); writtenAtClean = drive.counts().sectorsWritten; return true; } catch { return false; } },
    dirty: () => (drive && fault !== 1951 && drive.counts().sectorsWritten !== writtenAtClean ? [SAVE_ID] : []),   // 1951, wrong on purpose: the disk's save is never reported
    clean: () => { if (drive) writtenAtClean = drive.counts().sectorsWritten; },
  };

  // One line for the Log: the drive, its boot program, the console's boot firmware, the disk, the way it started.
  const details = () => {
    if (!drive || !info) return null;
    if (fault === 1953) return `N64 64DD disk drive (Japanese retail drive, ID ${ASIC_ID.japan}); boot program ${info.ipl}`;   // 1953, wrong on purpose: the Log leaves the disk out
    return `N64 64DD disk drive (Japanese retail drive, ID ${ASIC_ID.japan}, lockout chip ${info.lockout}); its boot program: yours (${info.ipl}); console boot firmware: ${info.firmware}; disk: ${info.code ?? "no code"}, type ${info.type}, ${info.retail ? "retail" : "development"}${info.diskSha ? `, sha256 ${info.diskSha}` : ""}; its clock set to ${info.clockSet} (your time of day); its save: ${info.saveWas}; cartridge: ${info.cartridge}; started ${info.way}`;
  };
  // For a test host: what the drive says now.
  const look = () => (drive ? { idRegister: held.x.n64_bus_peek(held.machine, 0x05000540) >>> 0, clock: drive.clock().toISOString(), counts: drive.counts(), written: drive.written().length, code: info?.code ?? null, way: info?.way ?? null, cartridge: info?.cartridge ?? null, saveWas: info?.saveWas ?? null } : null);
  const stop = () => { drive = null; held = null; info = null; };
  return { start, battery, details, look, stop, has: () => !!drive };
}
