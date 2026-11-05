/*
 * play/cores/nes/rob.mjs -- R.O.B. (Robotic Operating Buddy) for the NES core (2026-10-21;
 * accessories 2026-10-24).
 *
 * No core change: R.O.B. watches the picture the core already makes, as the toy's eye watches the
 * television. Page-free (no DOM): play/cores/nes/core.mjs feeds it each frame and asks it for the
 * controller-two buttons the gyro trays hold down.
 *
 * THE FLASH COMMANDS (the rebuild plan, section 1.3, the toy's firmware): thirteen bits, one per
 * frame, `00010` then `1w1x1y1z`; a bright frame is a 1, a dark frame a 0. Measured on our core,
 * 2026-10-21 (Gyromite, Direct mode): a 1 is the whole screen in one bright colour (mean luma
 * 147 to 149, one colour over 98.9 % of the picture), a 0 is black (luma 0 to 1.6). Gyromite's TEST
 * screen is a steady flash stream instead (black, then a green panel, every other frame): the
 * toy's LED blinks to it.
 *
 * THE GYROS AND BLOCKS (24 Oct 2026): the accessories are real 3D objects the user sets
 * up by hand in the host's R.O.B. view (play/rob/rob-accessories.mjs; research in
 * the accessories notes). That world decides what R.O.B. holds, what stands where, which gyro
 * spins and which tray cap it presses; the host sends the result here as the two controller-two bits
 * (`trays`: A for the blue cap, B for the red cap, as the manual says: "placing a gyro onto the blue
 * tray lowers the blue gate"), and the host keeps the manual override (`override`) for a stuck game.
 * The frame-counted gyro model that lived here until 24 Oct is gone with it.
 *
 * STACK-UP (24 Oct 2026): the console cannot see the blocks, but Direct and Memory draw two pictures
 * at the top of the screen: the arrangement the game believes you have (left) and the goal (right),
 * each as 8 x 8 tiles standing on five numbered trays (measured on our core, the accessories notes
 * 10.8: tray-number digits in pink (228,84,236), five tiles 8 px apart, rows 8 px apart above them,
 * tile colours red (152,34,32), white (236,238,236), blue (8,16,144), yellow (160,170,0), green
 * (8,124,0)). readStackUp() finds the digit rows and reads both pictures; the host compares them with
 * the blocks the user and R.O.B. actually stacked. Pressing Start to score stays the player's act.
 */

export const ROB_GYRO = 0x1F, ROB_BLOCK = 0x2E;   // the input table's numbers (Gyromite, Stack-Up)
export const robKindOf = dev => (dev === ROB_GYRO ? 'gyro' : dev === ROB_BLOCK ? 'block' : null);

/* The test page's names (rob-test/index.html COMMANDS) for the four bits wxyz. */
export const CODES = { 0b0101: 'UP', 0b1101: 'DOWN', 0b1100: 'UP1', 0b0010: 'DOWN1', 0b0100: 'LEFT', 0b1000: 'RIGHT',
  0b1010: 'OPEN', 0b0110: 'CLOSE', 0b1001: 'TEST', 0b0001: 'RESET' };

const BRIGHT = 100, DARK = 12, UNIFORM = 0.95, TEST_EDGES = 8, TEST_HOLD = 12;

/* One frame's light, as the eye sees it: 'B' bright and even, 'D' dark, 'M' anything else, plus
   the mean luma for the TEST stream. Sampled every other pixel and row (a quarter of the picture). */
export function frameLight(fb, lut) {
  let sum = 0, n = 0, same = 0; const first = fb[120 * 256 + 128];   // the centre: the edges may be overscan
  for (let y = 0; y < 240; y += 2) for (let x = 0; x < 256; x += 2) {
    const v = fb[y * 256 + x], c = lut[v];
    sum += 0.299 * (c & 255) + 0.587 * ((c >> 8) & 255) + 0.114 * ((c >> 16) & 255);
    if (v === first) same++;
    n++;
  }
  const luma = sum / n, even = same / n >= UNIFORM;
  return { luma, cls: luma <= DARK ? 'D' : (luma >= BRIGHT && even ? 'B' : 'M') };
}

export class FlashDecoder {
  constructor() { this.bits = ''; this.lumas = []; this.testUntil = -1; this.frame = 0; }
  /* One frame; returns a command name or null. */
  push(fb, lut) {
    const f = frameLight(fb, lut);
    this.frame++;
    this.bits = (this.bits + f.cls).slice(-13);
    this.lumas.push(f.luma); if (this.lumas.length > TEST_EDGES + 1) this.lumas.shift();
    // The TEST stream: dark and lit frames alternating (each lit one at least 15 above its dark neighbours).
    if (this.lumas.length > TEST_EDGES) {
      let alt = true;
      for (let i = 1; i < this.lumas.length; i++) { const a = this.lumas[i - 1], b = this.lumas[i]; if (Math.abs(a - b) < 15 || Math.min(a, b) > DARK) { alt = false; break; } }
      if (alt) this.testUntil = this.frame + TEST_HOLD;
    }
    const s = this.bits;
    if (s.length === 13 && s.startsWith('DDDBDB') && s[7] === 'B' && s[9] === 'B' && s[11] === 'B') {
      const w = s[6], x = s[8], y = s[10], z = s[12];
      if ([w, x, y, z].every(c => c === 'B' || c === 'D')) {
        const code = (w === 'B' ? 8 : 0) | (x === 'B' ? 4 : 0) | (y === 'B' ? 2 : 0) | (z === 'B' ? 1 : 0);
        this.bits = '';
        return CODES[code] || null;
      }
    }
    return null;
  }
  get testing() { return this.frame <= this.testUntil; }
}

/* ---------------------------------------------------------------- Stack-Up's pictures */
const TILE = { red: [152, 34, 32], white: [236, 238, 236], blue: [8, 16, 144], yellow: [160, 170, 0], green: [8, 124, 0] };
const PINK = [228, 84, 236];
const near = (c, t, d) => Math.abs((c & 255) - t[0]) + Math.abs(((c >> 8) & 255) - t[1]) + Math.abs(((c >> 16) & 255) - t[2]) < d;
const tileOf = c => { for (const k in TILE) if (near(c, TILE[k], 40)) return k; return null; };

/* The tray-number rows: five pink digit runs whose centres step 7 to 9 px. [{x0, y}], left to right, top to bottom. */
function digitRows(fb, lut) {
  const out = [];
  for (let y = 16; y < 232; y++) {
    const runs = []; let start = -1;
    for (let x = 0; x <= 256; x++) {
      const p = x < 256 && near(lut[fb[y * 256 + x]], PINK, 60);
      if (p && start < 0) start = x; else if (!p && start >= 0) { runs.push([start, x - 1]); start = -1; }
    }
    for (let i = 0; i + 4 < runs.length; i++) {
      const cs = runs.slice(i, i + 5).map(r => (r[0] + r[1]) / 2);
      let ok = true; for (let k = 1; k < 5; k++) if (cs[k] - cs[k - 1] < 7 || cs[k] - cs[k - 1] > 9) ok = false;
      if (ok) { const x0 = Math.round(cs[0]) - 4; if (!out.some(b => Math.abs(b.y - y) < 3 && Math.abs(b.x0 - x0) < 6)) out.push({ x0, y }); }
    }
  }
  return out.sort((a, b) => a.y - b.y || a.x0 - b.x0);
}
/* One picture: five trays, each a list of colours from the bottom up (the tile's middle pixel per row). */
function readPicture(fb, lut, x0, yDigits) {
  const trays = [];
  for (let k = 0; k < 5; k++) {
    const col = [];
    for (let r = 0; r < 5; r++) {
      const y = yDigits - 6 - 8 * r, x = x0 + 8 * k + 4;
      if (y < 0) break;
      const c = tileOf(lut[fb[y * 256 + x]]);
      if (!c) break;
      col.push(c);
    }
    trays.push(col);
  }
  return trays;
}
/* { goal, believed } (each five trays, bottom up) or null when no picture is on screen (menus, Test, the scoring screen). */
export function readStackUp(fb, lut) {
  const rows = digitRows(fb, lut);
  if (!rows.length) return null;
  const top = rows.filter(b => Math.abs(b.y - rows[0].y) < 3).sort((a, b) => a.x0 - b.x0);
  const goal = readPicture(fb, lut, top[top.length - 1].x0, top[top.length - 1].y);
  const believed = top.length > 1 ? readPicture(fb, lut, top[0].x0, top[0].y) : null;
  return { goal, believed };
}

/* The toy's clock: the commands as the decoder sees them, run one at a time at the page's timings,
   counted in emulated frames (rob-test's: lift 0.9 s a stop, turn 1.4 s a stop, arms 1.4 s, settle 0.1 s).
   The 3D view is told when each starts; what it does to the gyros and blocks is the view's world's business. */
const T = { lift: 0.9, turn: 1.4, arms: 1.4, settle: 0.1, pause: 0.5 };
const STOPS_TURN = 5, STOPS_LIFT = 6, CENTRE = 2;
const STACKUP_EVERY = 20;

export class Rob {
  constructor(kind, fps) {
    this.kind = kind; this.fps = fps || 60.0988;
    this.dec = new FlashDecoder();
    this.log = [];                                     // { frame, cmd } decoded, the newest last (max 64)
    this.override = 0;                                 // controller-two bits held by hand (the panel's buttons)
    this.trays = 0;                                    // controller-two bits the gyro trays press (from the 3D world)
    this.onCommand = null;                             // the 3D view: told when a command STARTS
    this.stackup = null;                               // Stack-Up's pictures, read every STACKUP_EVERY frames
    this.reset();
  }
  reset() {
    this.turn = CENTRE; this.lift = 0; this.open = true; this.led = true;
    this.busyUntil = 0; this.queue = []; this.frame = 0; this.running = null;
  }
  resetGyros() { /* the gyros live in the 3D world now (play/rob/rob-accessories.mjs reset / standGyros) */ }
  dur(cmd) {
    const s = x => Math.round((x + T.settle) * this.fps);
    switch (cmd) {
      case 'UP': case 'DOWN': return s(T.lift * 2);
      case 'UP1': case 'DOWN1': return s(T.lift);
      case 'LEFT': case 'RIGHT': return s(T.turn);
      case 'OPEN': case 'CLOSE': return s(T.arms);
      case 'RESET': return s(Math.max(T.arms, T.lift * this.lift, T.turn * this.turn) + T.pause + T.turn * CENTRE);
      default: return 1;
    }
  }
  /* One emulated frame: the picture just made, then the toy's clock. */
  step(fb, lut) {
    this.frame++;
    const cmd = fb ? this.dec.push(fb, lut) : null;
    if (cmd) { this.log.push({ frame: this.frame, cmd }); if (this.log.length > 64) this.log.shift(); if (this.queue.length < 4) this.queue.push(cmd); }
    if (this.running && this.frame >= this.busyUntil) { this.finish(this.running); this.running = null; }
    if (!this.running && this.queue.length) {
      const c = this.queue.shift();
      this.running = c; this.busyUntil = this.frame + this.dur(c);
      if (c === 'TEST') this.led = true;
      if (this.onCommand) try { this.onCommand(c); } catch (_) {}
    }
    if (this.kind === 'block' && fb && this.frame % STACKUP_EVERY === 0) { try { this.stackup = readStackUp(fb, lut); } catch (_) { this.stackup = null; } }
  }
  /* A command's effect on his pose once the motion has ended (the readout's stop numbers). */
  finish(c) {
    if (c === 'UP') this.lift = Math.max(0, this.lift - 2);
    else if (c === 'DOWN') this.lift = Math.min(STOPS_LIFT - 1, this.lift + 2);
    else if (c === 'UP1') this.lift = Math.max(0, this.lift - 1);
    else if (c === 'DOWN1') this.lift = Math.min(STOPS_LIFT - 1, this.lift + 1);
    else if (c === 'LEFT') this.turn = Math.min(STOPS_TURN - 1, this.turn + 1);
    else if (c === 'RIGHT') this.turn = Math.max(0, this.turn - 1);
    else if (c === 'CLOSE') this.open = false;
    else if (c === 'OPEN') this.open = true;
    else if (c === 'RESET') { this.open = true; this.lift = 0; this.turn = CENTRE; }
  }
  /* Controller two's buttons the trays hold down (Gyromite: A blue, B red) plus the hand-held override, or 0. */
  pad2() { return (this.override | (this.kind === 'gyro' ? this.trays : 0)) & 3; }
  status() {
    return { kind: this.kind, turn: this.turn, lift: this.lift, open: this.open, running: this.running, queued: this.queue.length,
      testing: this.dec.testing, led: this.led, pad2: this.pad2(), override: this.override, trays: this.trays,
      last: this.log.length ? this.log[this.log.length - 1] : null, decoded: this.log.length, stackup: this.stackup };
  }
}
