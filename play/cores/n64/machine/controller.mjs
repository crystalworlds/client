// The Nintendo 64 controller as the page knows it: which controls there are, which keys and pad
// buttons press each by default, and how a host's stick becomes the controller's stick. Nothing here
// touches a page or a machine, so the page, the worker and a test under Node all use this one file.
//
// The hand position is the family's: the arrows are the direction (here the stick), X is the
// console's A and Z its B, Enter is START. A pad's buttons go by their printed letters: the printed
// A is the console's A. Pad buttons are named as the Gamepad API's standard layout numbers them.

// The stick's reach. A controller's stick counts steps from where it stood at power-on and its gate
// is an eight-sided hole, so it reaches furthest straight up, down, left and right, and less far on
// each axis in the corners. docs/DEMO-PAGE.md, section 4, says where each figure is from.
export const STICK = { cardinal: 85, diagonal: 69 };
// How far a host pad's stick may sit from its middle and still count as let go, as a part of its
// full travel. This is about the host's pad, not about the console: the page's own choice.
export const DEAD_ZONE = 0.15;

// In the order of the bits of the mask the page sends: bit i is CONTROLS[i].
//   n64: the controller's own button; stick: a direction of the stick; half: halves the stick's tilt
export const CONTROLS = [
  { id: "a", label: "A", n64: "A", keys: ["KeyX"], pad: ["A"] },
  { id: "b", label: "B", n64: "B", keys: ["KeyZ"], pad: ["B", "X"] },
  { id: "z", label: "Z (the trigger underneath)", n64: "Z", keys: ["Space"], pad: ["LT", "RT"] },
  { id: "start", label: "START", n64: "START", keys: ["Enter", "NumpadEnter"], pad: ["Start"] },
  { id: "l", label: "L", n64: "L", keys: ["KeyQ"], pad: ["LB"] },
  { id: "r", label: "R", n64: "R", keys: ["KeyE"], pad: ["RB"] },
  { id: "c-up", label: "C up", n64: "C_UP", keys: ["KeyI"], pad: ["RSUp"] },
  { id: "c-down", label: "C down", n64: "C_DOWN", keys: ["KeyK"], pad: ["RSDown"] },
  { id: "c-left", label: "C left", n64: "C_LEFT", keys: ["KeyJ"], pad: ["RSLeft"] },
  { id: "c-right", label: "C right", n64: "C_RIGHT", keys: ["KeyL"], pad: ["RSRight"] },
  { id: "d-up", label: "D-pad up", n64: "UP", keys: ["KeyW"], pad: ["Up"] },
  { id: "d-down", label: "D-pad down", n64: "DOWN", keys: ["KeyS"], pad: ["Down"] },
  { id: "d-left", label: "D-pad left", n64: "LEFT", keys: ["KeyA"], pad: ["Left"] },
  { id: "d-right", label: "D-pad right", n64: "RIGHT", keys: ["KeyD"], pad: ["Right"] },
  { id: "stick-up", label: "Stick up", stick: [0, 1], keys: ["ArrowUp"], pad: [] },
  { id: "stick-down", label: "Stick down", stick: [0, -1], keys: ["ArrowDown"], pad: [] },
  { id: "stick-left", label: "Stick left", stick: [-1, 0], keys: ["ArrowLeft"], pad: [] },
  { id: "stick-right", label: "Stick right", stick: [1, 0], keys: ["ArrowRight"], pad: [] },
  { id: "stick-half", label: "Stick tilted half way (held with a direction)", half: true, keys: ["ShiftLeft"], pad: [] },
];
// The pad's axes that are the controller's stick: across, then down (the Gamepad API counts down as positive).
export const STICK_AXES = [0, 1];

// The Gamepad API's standard layout: its button numbers by the names used above, and the right
// stick's four directions as buttons (pressed when the stick is more than half way over).
export const PAD_BUTTONS = { A: 0, B: 1, X: 2, Y: 3, LB: 4, RB: 5, LT: 6, RT: 7, Select: 8, Start: 9, L3: 10, R3: 11, Up: 12, Down: 13, Left: 14, Right: 15 };
export const PAD_STICK_BUTTONS = { RSUp: [3, -1], RSDown: [3, 1], RSLeft: [2, -1], RSRight: [2, 1] };
export const PAD_STICK_BUTTON_AT = 0.5;

// How far the gate lets the stick go in a direction, in the stick's own counts: the distance from
// the middle to the edge of the eight-sided gate along that direction.
export function gateReach(angle, gate = STICK) {
  let a = Math.abs(angle) % (Math.PI / 2);
  if (a > Math.PI / 4) a = Math.PI / 2 - a;
  // The edge between the corner on an axis (cardinal, 0) and the corner on a diagonal (diagonal, diagonal),
  // met by the line through the middle at this angle.
  const t = Math.tan(a), along = gate.cardinal * t / (gate.diagonal + (gate.cardinal - gate.diagonal) * t);
  return Math.hypot(gate.cardinal - (gate.cardinal - gate.diagonal) * along, gate.diagonal * along);
}

// A host's stick (across to the right and up, each from -1 to 1) as the controller's two counts.
// Inside the dead zone the stick is in its middle; from the dead zone's edge the counts grow from
// zero, with no jump, until a stick pushed all the way stands on the gate in whatever direction it
// was pushed. A host stick that goes further than 1 from its middle (a square gate's corners) stands
// on the gate too.
export function stickCounts(across, up, { deadZone = DEAD_ZONE, gate = STICK } = {}) {
  const far = Math.hypot(across, up);
  if (!(far > deadZone)) return { x: 0, y: 0 };
  const tilt = Math.min(1, (far - deadZone) / (1 - deadZone)), angle = Math.atan2(up, across), reach = gateReach(angle, gate) * tilt;
  return { x: Math.round(reach * Math.cos(angle)) + 0, y: Math.round(reach * Math.sin(angle)) + 0 };
}

const bitOf = Object.fromEntries(CONTROLS.map((c, i) => [c.id, i]));
export const maskOf = (ids) => ids.reduce((m, id) => m | (1 << bitOf[id]), 0);

// What the controller reports for a mask of held controls and a pad's stick: its button word (the
// bits are the caller's table, by the controller's own button names) and the stick's two counts.
// A pad's stick out of its dead zone is the stick; otherwise the four direction controls are, each
// a full push (two together a full push into that corner of the gate), halved by the half control.
export function controllerState(mask, axes, bits, { deadZone = DEAD_ZONE, gate = STICK } = {}) {
  const held = (id) => (mask >>> bitOf[id]) & 1;
  let buttons = 0;
  CONTROLS.forEach((c, i) => { if (c.n64 && (mask >>> i) & 1) buttons |= bits[c.n64]; });
  let stick = axes ? stickCounts(Number(axes[0]) || 0, -(Number(axes[1]) || 0), { deadZone, gate }) : { x: 0, y: 0 };
  if (stick.x === 0 && stick.y === 0) {
    const across = held("stick-right") - held("stick-left"), up = held("stick-up") - held("stick-down");
    if (across || up) { const far = Math.hypot(across, up), part = held("stick-half") ? 0.5 : 1; stick = stickCounts(across / far * part, up / far * part, { deadZone: 0, gate }); }
  }
  return { buttons, x: stick.x, y: stick.y };
}

// A key's or a pad button's name as a person reads it.
export function keyName(code) {
  if (/^Key[A-Z]$/.test(code)) return code.slice(3);
  if (/^Digit\d$/.test(code)) return code.slice(5);
  return { ArrowUp: "Up arrow", ArrowDown: "Down arrow", ArrowLeft: "Left arrow", ArrowRight: "Right arrow", ShiftLeft: "Left Shift", ShiftRight: "Right Shift", Enter: "Enter", NumpadEnter: "Enter on the number pad", Space: "Space" }[code] ?? code;
}
export function padName(name) {
  return { LB: "Left bumper", RB: "Right bumper", LT: "Left trigger", RT: "Right trigger", Up: "D-pad up", Down: "D-pad down", Left: "D-pad left", Right: "D-pad right",
    RSUp: "Right stick up", RSDown: "Right stick down", RSLeft: "Right stick left", RSRight: "Right stick right", Start: "Start" }[name] ?? name;
}
