// The Transfer Pak for the site's play host: the Game Boy cartridge file a player gives for a port's Pak, and
// that cartridge's save.
//
// THE CARTRIDGE FILE is the player's own, chosen from the player's own device and kept in the player's own
// browser by the host, as the host keeps a boot program a player chose: each port's Pak has a file slot of its
// own among the manifest's files (gbcart1 to gbcart4), needed by no game, and off until the player picks a
// file. Nothing here fetches a Game Boy game, keeps one, or sends a byte of it anywhere.
//
// THE SAVE is the cartridge's own memory, kept by the host's battery calls under gbsave1 to gbsave4. A cartridge
// with a clock has its clock after the memory, in the layout Game Boy emulators commonly write: ten words of
// four bytes, lowest byte first (the running seconds, minutes, hours, days and the day's upper byte, then the
// same five as last latched), and a time in seconds since 1970 in eight bytes. A save of the memory alone is
// taken as well; the clock then starts from zero.

export const PORTS = 4;
export const CLOCK_BYTES = 48;
export const cartSlot = (port) => "gbcart" + (port + 1);
export const saveId = (port) => "gbsave" + (port + 1);
// The port a save id names (0 to 3), or -1.
export const portOfSave = (id) => { const hit = /^gbsave([1-4])$/.exec(String(id)); return hit ? Number(hit[1]) - 1 : -1; };
// The file slots, as the manifest lists them beside the boot programs.
export const SLOTS = [0, 1, 2, 3].map((port) => ({ id: cartSlot(port), label: `Game Boy cartridge in controller ${port + 1}'s Transfer Pak`, required: "never", defaultChoice: "none" }));
// The largest cartridge the Pak's side of the core takes (an MBC5's 8 MiB).
export const MAX_CART_BYTES = 8 * 1024 * 1024;

// The save as it is kept: the memory, and the clock after it when the cartridge has one.
export function packSave(memory, clock, seconds) {
  if (!clock) return new Uint8Array(memory);
  const out = new Uint8Array(memory.length + CLOCK_BYTES), v = new DataView(out.buffer, memory.length);
  out.set(memory);
  for (let i = 0; i < 5; i++) { v.setUint32(i * 4, clock.running[i], true); v.setUint32(20 + i * 4, clock.held[i], true); }
  v.setBigUint64(40, BigInt(Math.max(0, Math.floor(seconds))), true);
  return out;
}
// A kept save taken apart: null when its size is not this cartridge's.
export function unpackSave(bytes, memoryBytes, hasClock) {
  if (bytes.length !== memoryBytes && !(hasClock && bytes.length === memoryBytes + CLOCK_BYTES)) return null;
  const memory = bytes.subarray(0, memoryBytes);
  if (bytes.length === memoryBytes) return { memory, clock: null };
  const v = new DataView(bytes.buffer, bytes.byteOffset + memoryBytes, CLOCK_BYTES), five = (at) => Uint8Array.from({ length: 5 }, (_, i) => v.getUint32(at + i * 4, true) & 255);
  return { memory, clock: { running: five(0), held: five(20), at: Number(v.getBigUint64(40, true)) } };
}
