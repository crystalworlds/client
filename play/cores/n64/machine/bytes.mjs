// Small byte helpers for the modules that run both under Node and in a browser. It imports nothing.
//
// A copy taken out of the core's memory is a Node Buffer where Node is (the tools call Buffer's own
// methods on such copies, and their results stay as they were), and a plain Uint8Array where it is not.
// Both hold the same bytes; a module of this folder uses only what a Uint8Array has.

export const copyOut = (view) => (typeof globalThis.Buffer === "function" ? globalThis.Buffer.from(view) : view.slice());

// Bytes as text, one character for each byte (what Node calls latin1).
export function latin1(bytes) {
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, Math.min(bytes.length, i + 0x8000)));
  return s;
}

// A 32-bit word of a byte array in the cartridge's own order (big-endian).
export const word32 = (bytes, at) => ((bytes[at] << 24) | (bytes[at + 1] << 16) | (bytes[at + 2] << 8) | bytes[at + 3]) >>> 0;
