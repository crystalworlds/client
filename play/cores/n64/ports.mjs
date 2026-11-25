// The console's four controller ports for the site's play host: what is plugged into each, the player's setting
// for the second, third and fourth, and the input the host gives each port.
//
// THE HOST'S SIDE. The site's play host gives every port this module lists its own input: the keyboard presses the
// controls that carry keys (the first port's only), and the browser's pads go to the ports in order, the first
// pad to the first port, the second to the second, each by the control's name. So the ports here carry the same
// controls under the same names, and only the first carries keys. A port that declares the pad's axes gets its
// pad's axes; the host leaves the axes out when no pad is there for it, which is how a pad is seen here.
//
// THE SETTING, one for each of ports 2 to 4, kept by the host for the console (every game):
//   auto        a controller is in the port when a pad is there for it: from the start when the pad was seen before
//               the start, else plugged in the moment the pad is first seen, as a hand plugs one into a running
//               console. In its slot a Rumble Pak when the first controller has one, else nothing.
//   controller  a controller with nothing in its slot
//   pak         a controller with a Controller Pak (kept as its own save, cpak2 to cpak4)
//   rumble      a controller with a Rumble Pak
//   transfer    a controller with a Transfer Pak (its Game Boy cartridge is the port's own file: tpak.mjs)
//   none        nothing plugged in: the port says nothing, as an empty port of a console does
// The first port always has its controller; what is in its slot is the module's own "pak" option.
//
// A controller that is in at a start is in from power-on: its pak is put in before the controller is plugged in, so
// its first identity reply says a pak that was simply there. One plugged in later has its pak in it already too.

import { CONTROLS, AXES } from "./pads.mjs?v=29e40393f9c9";

export const PORTS = 4;
export const SETTINGS = ["auto", "controller", "pak", "rumble", "transfer", "none"];
export const DEFAULT = "auto";
const LABELS = {
  auto: "A controller when a pad is there for it",
  controller: "A controller, nothing in its slot",
  pak: "A controller with a Controller Pak",
  rumble: "A controller with a Rumble Pak",
  transfer: "A controller with a Transfer Pak",
  none: "Nothing plugged in",
};
export const optionId = (port) => "port" + (port + 1);
// The port an option id names (1 to 3 for ports 2 to 4), or -1.
export const portOfOption = (id) => { const hit = /^port([2-4])$/.exec(String(id)); return hit ? Number(hit[1]) - 1 : -1; };
export const pakId = (port) => "cpak" + (port + 1);
// The port a save id names (0 to 3), or -1.
export const portOfPak = (id) => { const hit = /^cpak([1-4])$/.exec(String(id)); return hit ? Number(hit[1]) - 1 : -1; };
const SERIAL = 0x0123456789ABCDEFn;

// The controls of a port after the first: the same names, so that a pad's presses land on its own port, and no keys.
const PAD_ONLY = CONTROLS.map((c) => ({ ...c, defaults: { key: [], pad: c.defaults?.pad ?? [] } }));

// env.fault, for tests only: 1510 the input of ports 2 to 4 is dropped; 1511 the player's setting is not taken;
// 1512 a pad seen in a port set to auto does not plug its controller in; 1672 a port set to a Transfer Pak gets
// a controller with nothing in its slot.
export function makePorts({ fault = 0 } = {}) {
  const said = [null, DEFAULT, DEFAULT, DEFAULT];
  const seen = [false, false, false, false];
  const inputs = [0, 1, 2, 3].map(() => ({ mask: 0, axes: null }));
  let now = [0, 1, 2, 3].map((p) => ({ controller: p === 0, pak: "none" }));

  // What the setting puts in a port, with the first port's pak known.
  const wanted = (port, pak1) => {
    if (port === 0) return { controller: true, pak: pak1 };
    const s = fault === 1511 ? "none" : said[port];
    if (s === "auto") return { controller: seen[port] && fault !== 1512, pak: pak1 === "rumble" ? "rumble" : "none" };
    return { controller: s !== "none", pak: s === "pak" ? "controller" : s === "rumble" ? "rumble" : s === "transfer" && fault !== 1672 ? "transfer" : "none" };
  };
  const plugIn = (si, port, pak) => {
    if (pak !== "none") si.insertPak(port, pak);
    if (pak === "controller") si.formatPak(port, SERIAL + BigInt(port));
    si.set(port, 0, 0, 0);
    si.plug(port, true);
    now[port] = { controller: true, pak };
  };

  const ports = {
    setting: (port) => said[port],
    set(port, v) { if (port >= 1 && port < PORTS) said[port] = SETTINGS.includes(v) ? v : DEFAULT; },
    // The host's words at a load ({ port2, port3, port4 }): each one given is taken.
    take(opts) { for (let p = 1; p < PORTS; p++) if (opts?.[optionId(p)] !== undefined) ports.set(p, String(opts[optionId(p)])); },
    // At a start, after the game is opened with the first port's controller in and before the machine runs on.
    start(si, pak1) {
      now = [0, 1, 2, 3].map((p) => ({ controller: p === 0, pak: p === 0 ? pak1 : "none" }));
      for (let p = 1; p < PORTS; p++) { const w = wanted(p, pak1); if (w.controller) plugIn(si, p, w.pak); }
    },
    // The host's input for a port. Gives back whether the port is one of the four.
    input(port, s) {
      if (!(port >= 0 && port < PORTS) || (fault === 1510 && port > 0)) return false;
      inputs[port] = { mask: (s?.buttons ?? 0) >>> 0, axes: Array.isArray(s?.axes) ? s.axes : null };
      if (inputs[port].axes) seen[port] = true;
      return true;
    },
    // A pad first seen while the game runs, in a port set to auto: its controller is plugged in now.
    late(si, pak1) {
      for (let p = 1; p < PORTS; p++) { const w = wanted(p, pak1); if (said[p] === "auto" && w.controller && !now[p].controller) plugIn(si, p, w.pak); }
    },
    held: (port) => inputs[port],
    in: (port) => now[port],
    // The ports that hold a Controller Pak now.
    paks: () => [0, 1, 2, 3].filter((p) => now[p].controller && now[p].pak === "controller"),
    // The ports that hold a Transfer Pak now.
    tpaks: () => [0, 1, 2, 3].filter((p) => now[p].controller && now[p].pak === "transfer"),
    hasPak: (port) => port >= 0 && port < PORTS && now[port].controller && now[port].pak === "controller",
    // The ports as the host lists them: every port that can have a controller. One set to "none" is left out.
    list: () => [0, 1, 2, 3].filter((p) => p === 0 || said[p] !== "none").map((p) => ({ port: p, kind: "player", device: "n64-controller", label: "Controller " + (p + 1), controls: p === 0 ? CONTROLS : PAD_ONLY, axes: AXES })),
    // The settings as the host shows and keeps them.
    options: () => [1, 2, 3].map((p) => ({ id: optionId(p), label: `Controller port ${p + 1}`, type: "enum", group: "machine", scope: "console", live: false, default: DEFAULT,
      values: SETTINGS.map((v) => ({ v, label: LABELS[v] })), help: "The second, third and fourth players. A game looks at its ports when it starts: plug the pads in first, or choose a controller here" })),
  };
  return ports;
}
