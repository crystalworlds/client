// Save memory on the cartridge bus, from the host's side: the kinds there are, how to fit one in
// a machine, how to give a kept save back and take it out again, and the two byte orders save
// files come in. It imports no part of Node (tools/save-memory.mjs gives the tools the same calls).
//
// A cartridge does not say which save memory it has: the host tells the core, after every start
// of the machine (a start wipes it). The bytes are kept as they sit on the cartridge's bus, which
// is the order a flash cartridge stores them in. Other emulators' SRAM and FlashRAM files hold
// each 32-bit word the other way round; swapWords turns one order into the other, both ways.

const FLASH = 3;
export const SAVE = {
  "none": { kind: 0, bytes: 0, what: "no save memory on the cartridge bus" },
  "sram-256k": { kind: 1, bytes: 0x8000, what: "battery-backed SRAM, 256 kilobits" },
  "sram-768k-banked": { kind: 2, bytes: 0x18000, what: "battery-backed SRAM, three banks of 256 kilobits" },
  "flash-mx29l1100": { kind: FLASH, id: 0x00C2001E, bytes: 0x20000, what: "FlashRAM, Macronix MX29L1100: addresses count 16-bit words" },
  "flash-mx29l0000": { kind: FLASH, id: 0x00C20000, bytes: 0x20000, what: "FlashRAM, Macronix MX29L0000: addresses count 16-bit words" },
  "flash-mx29l0001": { kind: FLASH, id: 0x00C20001, bytes: 0x20000, what: "FlashRAM, Macronix MX29L0001: addresses count 16-bit words" },
  "flash-mx29l1101": { kind: FLASH, id: 0x00C2001D, bytes: 0x20000, what: "FlashRAM, Macronix MX29L1101: addresses count bytes" },
  "flash-mx29l1101-b": { kind: FLASH, id: 0x00C20084, bytes: 0x20000, what: "FlashRAM, Macronix MX29L1101, second device number: addresses count bytes" },
  "flash-mx29l1101-c": { kind: FLASH, id: 0x00C2008E, bytes: 0x20000, what: "FlashRAM, Macronix MX29L1101, third device number: addresses count bytes" },
  "flash-mn63f8mpn": { kind: FLASH, id: 0x003200F1, bytes: 0x20000, what: "FlashRAM, Matsushita MN63F8MPN: addresses count bytes" },
};
export const SAVE_KINDS = Object.keys(SAVE);

// Fits save memory of the named kind in a machine that has just been started, blank (every byte
// 0xFF) or holding the bytes of a kept save.
export function fitSave(core, name, kept = null) {
  const s = SAVE[name];
  if (!s) throw new Error(`no save memory is called ${name}`);
  core.x.n64_save_fit(core.machine, s.kind, s.id ?? 0);
  if (kept && s.bytes) {
    if (kept.length !== s.bytes) throw new Error(`a kept save of ${kept.length} bytes does not fit ${name} (${s.bytes} bytes)`);
    core.u8().set(kept, core.x.n64_save_bytes(core.machine));
  }
  core.x.n64_save_changed(core.machine, 1);
  return { name, bytes: s.bytes };
}

// A copy of the save memory's bytes as they are now, or null when the cartridge has none.
export function takeSave(core) {
  const n = core.x.n64_save_size(core.machine);
  if (!n) return null;
  const at = core.x.n64_save_bytes(core.machine);
  return core.u8().slice(at, at + n);
}

// Whether the save memory was written since this was last asked with `forget`.
export const saveChanged = (core, forget = false) => core.x.n64_save_changed(core.machine, forget ? 1 : 0) !== 0;

// The other byte order: every 32-bit word turned round. Doing it twice gives the bytes back.
export function swapWords(bytes) {
  if (bytes.length % 4) throw new Error("a save's length is a whole number of 32-bit words");
  const out = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i += 4) { out[i] = bytes[i + 3]; out[i + 1] = bytes[i + 2]; out[i + 2] = bytes[i + 1]; out[i + 3] = bytes[i]; }
  return out;
}
