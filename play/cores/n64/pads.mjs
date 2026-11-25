// The Nintendo 64 controller for the site's play host: the controls of one port in the order of the bits of the
// host's mask, the keys and pad buttons that press each by default, and the two pad layouts. It imports only the
// controller's own file of the machine (the stick's gate and counts, shared with the play page and the tools).
//
// THE STICK. A controller's stick counts steps from where it stood at power-on; its gate is an eight-sided hole,
// so it reaches furthest straight up, down, left and right, and less far on each axis in the corners. This core
// takes 85 steps straight (TABLE-READ: the open library's header says a stick in good condition reaches roughly
// 85 each way, a worn one as few as 60) and 69 on each axis in a corner (CONVERGENCE: the reference emulator's
// gate). No console's own stick has been measured by this campaign: the pad film probe rolled round the gate on a
// console would settle both. A host pad's stick is let go inside a dead zone of 15% of its travel (the host's own
// choice: it is about the pad, not the console), and from the dead zone's edge it grows without a jump until a
// stick pushed all the way stands on the gate in whatever direction it was pushed.
//
// THE C BUTTONS come from the right stick (a pad's axes 2 and 3, pushed past half way) as well as from buttons,
// so the port declares the pad's axes to the host: the site's pad feed names the left stick's directions only.

import { CONTROLS as MACHINE_CONTROLS, STICK, DEAD_ZONE, controllerState, stickCounts } from "./machine/controller.mjs?v=34783f38ad7a";

export { STICK, DEAD_ZONE, controllerState, stickCounts };
// The pad's axes the port asks for: the left stick across and down, the right stick across and down.
export const AXES = [0, 1, 2, 3];
export const C_FROM_RIGHT_STICK = { "c-up": [3, -1], "c-down": [3, 1], "c-left": [2, -1], "c-right": [2, 1] };
export const C_AT = 0.5;

// The pad buttons by the names the site's pad feed gives them (gamepad.js: the standard layout's positions, A at
// the bottom, B on the right, X on the left, Y at the top, then LB RB LT RT Select Start L3 R3 and the D-pad).
// Two layouts: an Xbox pad as it is; the maker's own wireless controller as a browser reports it through a USB
// adapter (the adapter shows it as a standard pad, its buttons at the positions of an Xbox pad's). That second
// table is a reasoned guess from where the buttons sit on that controller, NOT ESTABLISHED: the stand-in page's
// pad panel shows what a browser reports for each press, which settles it.
export const LAYOUTS = {
  xbox: {
    label: "Xbox pad",
    a: ["A"], b: ["B", "X"], z: ["LT", "RT"], start: ["Start"], l: ["LB"], r: ["RB"],
    "c-up": ["Y"], "c-down": [], "c-left": [], "c-right": [],
    "d-up": ["Up"], "d-down": ["Down"], "d-left": ["Left"], "d-right": ["Right"],
  },
  maker: {
    label: "the maker's own controller through a USB adapter (not yet tried)",
    a: ["A"], b: ["B", "X"], z: ["LT"], start: ["Start"], l: ["LB"], r: ["RB"],
    "c-up": [], "c-down": [], "c-left": [], "c-right": [],
    "d-up": ["Up"], "d-down": ["Down"], "d-left": ["Left"], "d-right": ["Right"],
  },
};
// Which layout a pad is, by what the browser says of it: the adapter's maker's vendor number, or a name that says
// the console's own controller. Every other pad is taken as an Xbox pad.
export const layoutOf = (padId) => (/2dc8|8bitdo|\bn64\b|nintendo 64/i.test(String(padId ?? "")) ? "maker" : "xbox");

// The controls, in the order of the bits of the host's mask. The keys are the family's: the arrows the stick, X
// the console's A, Z its B, Enter START, Space the Z trigger, Q and E the shoulders, I J K L the C buttons,
// W A S D the D-pad, Left Shift a half tilt with a direction.
export const CONTROLS = MACHINE_CONTROLS.map((c) => ({ id: c.id, label: c.label, type: "button", defaults: { key: c.keys, pad: LAYOUTS.xbox[c.id] ?? [] } }));

// The port's controller state from the host's input: the buttons as a mask, and the pad's axes when it has them.
export function stateOf(mask, axes, bits, { deadZone = DEAD_ZONE, cFromRightStick = true } = {}) {
  let m = mask >>> 0;
  if (Array.isArray(axes) && cFromRightStick) for (const [id, [axis, sign]] of Object.entries(C_FROM_RIGHT_STICK)) {
    const v = Number(axes[axis]) || 0, bit = MACHINE_CONTROLS.findIndex((c) => c.id === id);
    if (bit >= 0 && v * sign > C_AT) m |= 1 << bit;
  }
  return controllerState(m >>> 0, Array.isArray(axes) ? [axes[0], axes[1]] : null, bits, { deadZone });
}
