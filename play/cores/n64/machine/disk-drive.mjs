// The 64DD disk drive from the host's side: attaching it, giving it the user's boot program for the drive,
// putting a disk in, the clock, and the disk's save. It imports no part of Node: whoever holds the files
// reads them and hands the bytes here. core/dd.c is the drive itself; docs/parts/DD.md its chapter.
//
// A disk image is private, and so is the drive's boot program. Both are read into the core's memory and
// nowhere else: nothing here prints, returns for printing or saves a byte of them. The image the user gave
// is never written: the drive gets a working copy, and what it writes there comes back to the host as the
// disk's save, a file of its own (takeDiskSave), which is given back over a fresh copy at the next start.

import { sha256 } from "./sha256.mjs?v=5ca4ef310af2";

export const DISK_IMAGE_BYTES = 0x3DEC800;          // every block of the disk in LBA order (the .ndd form)
export const DISK_BLOCKS = 4316;
export const IPL_BYTES = 0x400000;
export const ASIC_ID = { japan: 3 };                // what the drive's identity register reads: the Japanese retail drive
const SAVE_MAGIC = [0x44, 0x44, 0x36, 0x34, 0x53, 0x41, 0x56, 0x45];    // "DD64SAVE"
const hexOf = (b) => [...b].map((v) => v.toString(16).padStart(2, "0")).join("");

// What a disk says of itself in its system area: its type, the read-only and RAM areas, and where its boot code
// goes. Numbers only. `sha`: the image's SHA-256 when the host has it already (64 MB to hash again otherwise).
export function diskFacts(image, sha = null) {
  if (image.length !== DISK_IMAGE_BYTES) return { usable: false, why: `a disk image in LBA order is ${DISK_IMAGE_BYTES} bytes; this one is ${image.length}` };
  if ((image[5] & 0xF0) !== 0x10 || (image[5] & 0x0F) > 6) return { usable: false, why: "its system area names no disk type the drive knows" };
  const word = (at) => (image[at] << 8) | image[at + 1];
  const retail = (image[0] | image[1] | image[2] | image[3]) !== 0;
  return { usable: true, type: image[5] & 0x0F, retail, romEndLba: word(0xE0) + 24, ramStartLba: word(0xE2) + 24, ramEndLba: word(0xE4) + 24,
    bootBlocks: word(0x06), sha256: sha ?? sha256(image) };
}

// Seconds from the first second of 1996, as the drive's clock counts, for a date (UTC fields are used).
export function clockSeconds(date) {
  const ms = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), date.getUTCHours(), date.getUTCMinutes(), date.getUTCSeconds()) - Date.UTC(1996, 0, 1);
  return BigInt(Math.max(0, Math.floor(ms / 1000)));
}

export function diskDrive(core) {
  const x = core.x, m = core.machine;
  if (!x.n64_dd_attach) throw new Error(`the build ${core.build.file} has no disk drive: build the core again`);
  const room = { ipl: 0, disk: 0, written: 0 };
  const drive = {
    facts: null, imageSha256: null,
    // Attaches the drive; said before the start, which puts the drive to its power-on state.
    attach(asicId = ASIC_ID.japan) { x.n64_dd_attach(m, asicId); },
    detach() { x.n64_dd_attach(m, 0); },
    // The user's boot program for the drive: 4 MiB in the bus's own byte order.
    setIpl(bytes) {
      if (bytes.length !== IPL_BYTES || bytes[0] !== 0x80) throw new Error("the drive's boot program is 4 MiB, in the bus's own byte order");
      if (!room.ipl) room.ipl = core.alloc(IPL_BYTES);
      core.u8().set(bytes, room.ipl);
      x.n64_dd_set_ipl(m, room.ipl, IPL_BYTES);
    },
    // Puts a disk in: a working copy of the image, and the disk's save over it when one is given.
    insert(image, save = null, sha = null) {
      const facts = diskFacts(image, sha);
      if (!facts.usable) throw new Error(facts.why);
      if (!room.disk) { room.disk = core.alloc(DISK_IMAGE_BYTES); room.written = core.alloc(DISK_BLOCKS); }
      core.u8().set(image, room.disk);
      core.u8().fill(0, room.written, room.written + DISK_BLOCKS);
      drive.facts = facts; drive.imageSha256 = facts.sha256;
      const r = x.n64_dd_insert(m, room.disk, DISK_IMAGE_BYTES, room.written);
      if (r !== 0) throw new Error(r === 1 ? "the image is not of the drive's size" : "the image names no disk type the drive knows");
      if (save) drive.giveSave(save);
      return facts;
    },
    eject() { x.n64_dd_insert(m, 0, 0, 0); drive.facts = null; },
    setClock(date) { x.n64_dd_set_clock(m, clockSeconds(date)); },
    clock() { return new Date(Date.UTC(1996, 0, 1) + Number(x.n64_dd_clock(m)) * 1000); },
    // The blocks the drive has written since the disk went in (and those a save given back brought).
    written() { const w = core.u8().subarray(room.written, room.written + DISK_BLOCKS), out = []; for (let i = 0; i < DISK_BLOCKS; i++) if (w[i]) out.push(i); return out; },
    // The disk's save: "DD64SAVE", a version word, the SHA-256 of the image it belongs to, a count, then each
    // written block as its LBA (16 bits), its length (32 bits) and its bytes. Null when nothing was written.
    takeSave() {
      const lbas = drive.written();
      if (!lbas.length) return null;
      const parts = lbas.map((lba) => { const at = x.n64_dd_block(m, lba); return { lba, offset: Number(at & 0xFFFFFFFFn), length: Number(at >> 32n) }; });
      const out = new Uint8Array(48 + parts.reduce((a, p) => a + 6 + p.length, 0));
      const view = new DataView(out.buffer);
      out.set(SAVE_MAGIC, 0); view.setUint32(8, 1);
      out.set(drive.imageSha256.match(/../g).map((h) => parseInt(h, 16)), 12);
      view.setUint32(44, parts.length);
      let at = 48;
      const u8 = core.u8();
      for (const p of parts) { view.setUint16(at, p.lba); view.setUint32(at + 2, p.length); out.set(u8.subarray(room.disk + p.offset, room.disk + p.offset + p.length), at + 6); at += 6 + p.length; }
      return out;
    },
    // Gives a save back over the working copy. It must belong to this image.
    giveSave(save) {
      const view = new DataView(save.buffer, save.byteOffset, save.byteLength);
      if (save.length < 48 || SAVE_MAGIC.some((v, i) => save[i] !== v) || view.getUint32(8) !== 1) throw new Error("this is not a disk save");
      if (hexOf(save.subarray(12, 44)) !== drive.imageSha256) throw new Error("this save belongs to another disk image");
      const n = view.getUint32(44), u8 = core.u8();
      let at = 48;
      for (let i = 0; i < n; i++) {
        const lba = view.getUint16(at), length = view.getUint32(at + 2), place = x.n64_dd_block(m, lba);
        if (Number(place >> 32n) !== length || at + 6 + length > save.length) throw new Error("the save does not fit this disk");
        u8.set(save.subarray(at + 6, at + 6 + length), room.disk + Number(place & 0xFFFFFFFFn));
        u8[room.written + lba] = 1;
        at += 6 + length;
      }
      return n;
    },
    counts() {
      const c = (i) => x.n64_dd_count(m, i) >>> 0;
      return { commands: c(0), interrupts: c(1), sectorsRead: c(2), sectorsWritten: c(3), errors: c(4), status: c(5), track: c(6), bufferManager: c(7) };
    },
  };
  return drive;
}
