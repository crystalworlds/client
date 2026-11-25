// The byte order of a game file (no part of Node is imported here: the tools reach it through
// tools/cart-byte-order.mjs, a page and the site's core module straight). Files come in three orders: as the cartridge holds them
// (big-endian), with every pair of bytes swapped, and with every four bytes reversed. This module
// finds which one a file is in, turns it into the cartridge's own order, and computes the keys
// everything else is filed under, which are always taken from the normalised file. The rule is the
// one written in docs/PER-HASH-TABLE.md, sections 2 and 3.
//
// How the order is found:
// 1. By the boot code. The boot code (bytes 0x40 to 0xFFF) is tried in each of the three orders,
//    and a judge says whether a lockout chip knows it. Only one order can give a boot code a
//    lockout chip knows. The judge is whoever runs the boot firmware's checksum over the boot
//    code; it is handed in as `knownBootCode`, a function that takes the 4,032 bytes and returns
//    what it found, or nothing.
// 2. Failing that (no judge, or a boot code no lockout chip knows), by the first four bytes: they
//    are bus timings, and in the cartridge's own order the first of them is 0x80 on every usual
//    cartridge and the second has its two top bits clear. The file is taken as big-endian if they
//    read as such; otherwise the order in which they do is used.
// 3. Failing that too, the file is taken as big-endian, and the result says nothing decided it.
//
// The first four bytes are never used when the boot code decides: homebrew may set them to other
// values, and such a file must still load.

import { sha256 } from "./sha256.mjs?v=5ca4ef310af2";

export const ORDERS = ["big-endian", "pairs swapped", "fours reversed"];
const BOOT_FROM = 0x40, BOOT_TO = 0x1000, BOOT_KEY_BYTES = 0x101000;

// Turns a file in the given order into the cartridge's own order, or back: both are the same move.
export function reorder(bytes, order) {
  if (order === "big-endian") return Uint8Array.from(bytes);
  const group = order === "pairs swapped" ? 2 : order === "fours reversed" ? 4 : 0;
  if (!group) throw new Error(`no byte order is called ${order}`);
  if (bytes.length % group) throw new Error(`a file of ${bytes.length} bytes cannot be in the order "${order}": it is not a whole number of groups of ${group}`);
  const out = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i += group) for (let k = 0; k < group; k++) out[i + k] = bytes[i + group - 1 - k];
  return out;
}
export const toBigEndian = reorder;

const timingsPlausible = (b) => b[0] === 0x80 && (b[1] & 0xC0) === 0;

// Finds the order a file is in. Returns { order, by, lockout }: `by` says which of the three steps
// answered, `lockout` is whatever the judge returned.
export function findByteOrder(bytes, { knownBootCode = null } = {}) {
  if (bytes.length < BOOT_TO) throw new Error(`a game file holds at least ${BOOT_TO} bytes (a header and a boot code); this one holds ${bytes.length}`);
  const head = bytes.subarray(0, BOOT_TO);
  if (knownBootCode) {
    const hits = [];
    for (const order of ORDERS) { const found = knownBootCode(reorder(head, order).subarray(BOOT_FROM, BOOT_TO)); if (found) hits.push({ order, found }); }
    if (hits.length === 1) return { order: hits[0].order, by: "the boot code: a lockout chip knows it in this order", lockout: hits[0].found };
    if (hits.length > 1) throw new Error("the boot code is known in more than one byte order, which cannot be");
  }
  const plausible = ORDERS.filter((order) => timingsPlausible(reorder(head.subarray(0, 4), order)));
  if (plausible.includes("big-endian")) return { order: "big-endian", by: "the first four bytes: plausible bus timings as they stand", lockout: null };
  if (plausible.length === 1) return { order: plausible[0], by: "the first four bytes: plausible bus timings in this order only", lockout: null };
  return { order: "big-endian", by: "nothing: taken as big-endian", lockout: null };
}


// Finds the order, normalises, and computes the keys. The file given is not changed.
export function normalise(bytes, options = {}) {
  const found = findByteOrder(bytes, options);
  const file = reorder(bytes, found.order);
  const code = [...file.subarray(0x3B, 0x3F)].map((c) => (c >= 0x20 && c < 0x7F ? String.fromCharCode(c) : `\\x${c.toString(16).padStart(2, "0")}`)).join("");
  return { ...found, bytes: file,
    fileKey: sha256(file),
    bootKey: sha256(file.subarray(0, Math.min(file.length, BOOT_KEY_BYTES))),
    headerKey: `${code} revision ${file[0x3F]}` };
}
