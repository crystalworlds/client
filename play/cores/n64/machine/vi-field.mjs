// What the VI's picture calls need of the core, with no part of Node: the registers, a field as the core would
// send it now, and the plane of hidden bits. tools/vi-lib.mjs gives the tools these and the judge, PNG and the rest.

export const VI = 0x04400000;
export const REG_NAMES = ["CTRL", "ORIGIN", "WIDTH", "V_INTR", "V_CURRENT", "BURST", "V_TOTAL", "H_TOTAL", "LEAP", "H_VIDEO", "V_VIDEO", "V_BURST", "X_SCALE", "Y_SCALE"];
export const viRegisters = (core) => Array.from({ length: 14 }, (_, i) => core.x.n64_vi_reg(core.machine, i) >>> 0);
export function setViRegisters(core, reg) { for (let i = 0; i < 14; i++) if (i !== 4) core.x.n64_bus_poke(core.machine, VI + i * 4, reg[i] >>> 0); }

// One field as the core would send it now. `odd` picks the field whose line counter is odd.
export function fieldNow(core, win, odd, flags = 0) {
  const bytes = win.width * (win.rows >> 1) * 4;
  if (!core.viRoom || core.viRoomBytes < bytes) { core.viRoom = core.alloc(bytes); core.viRoomBytes = bytes; core.viInfo = core.alloc(16); }
  const made = core.x.n64_vi_field_now(core.machine, core.viRoom, win.x0, win.width, win.top, win.rows, odd ? 1 : 0, flags, core.viInfo);
  if (!made) return { made: false };
  const info = new Uint32Array(core.x.memory.buffer, core.viInfo, 4);
  return { made: true, lines: info[0], lower: info[1], width: info[2], height: info[3], pixels: core.u8().slice(core.viRoom, core.viRoom + bytes) };
}

// The same field, made by the drawing thread of a build that has one, while the machine runs on: nothing is
// waited for here. Null where no drawing thread is switched in (the caller then takes fieldNow). Otherwise
// made() says when the picture is whole, and take() gives it as fieldNow does; two rooms take turns, so a
// picture must be taken before the one after the next is asked for.
export function fieldLater(core, win, odd, flags = 0) {
  const x = core.x;
  if (!x.n64_vi_field_later) return null;
  const bytes = win.width * (win.rows >> 1) * 4;
  if (!core.viLater || core.viLater.bytes < bytes) core.viLater = { bytes, turn: 0, rooms: [0, 1].map(() => ({ room: core.alloc(bytes), info: core.alloc(16) })) };
  const r = core.viLater.rooms[core.viLater.turn ^= 1];
  const number = x.n64_vi_field_later(core.machine, r.room, win.x0, win.width, win.top, win.rows, odd ? 1 : 0, flags, r.info);
  if (!number) return null;
  return {
    made: () => x.n64_vi_field_made(number) !== 0,
    take() {
      const info = new Uint32Array(x.memory.buffer, r.info, 4);
      if (!info[2]) return { made: false };
      return { made: true, lines: info[0], lower: info[1], width: info[2], height: info[3], pixels: core.u8().slice(r.room, r.room + bytes) };
    },
  };
}

// The machine's plane of hidden bits as it stands: one byte for each 16-bit word of memory, two bits used.
export function hiddenOf(core) {
  const bytes = core.x.n64_rdram_size(core.machine) / 2;
  if (!core.hiddenOut || core.hiddenOutBytes < bytes) { core.hiddenOut = core.alloc(bytes); core.hiddenOutBytes = bytes; }
  core.x.n64_rdp_hidden_bits(core.machine, core.hiddenOut);
  return core.u8().slice(core.hiddenOut, core.hiddenOut + bytes);
}

// Sets the machine's plane of hidden bits: one byte for each 16-bit word of memory. Null: every word's two
// bits follow its lowest bit.
export function setHidden(core, plane) {
  if (!plane) { core.x.n64_vi_set_hidden(core.machine, 0); return; }
  if (!core.viHidden || core.viHiddenBytes < plane.length) { core.viHidden = core.alloc(plane.length); core.viHiddenBytes = plane.length; }
  core.u8().set(plane, core.viHidden);
  core.x.n64_vi_set_hidden(core.machine, core.viHidden);
}
