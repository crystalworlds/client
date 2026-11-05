/*
 * play/cores/nes/accessories.mjs -- the Famicom expansion-port accessories
 * (2026-10-24; the core's half is src/nes_input.inc). Page-free: no DOM.
 * play/cores/nes/core.mjs makes one Accessory for the controller in force (the game's own, from the
 * cartridge header or the input table, or the player's Controller choice) and calls it once a frame.
 *
 * Every accessory works with what a visitor has:
 *   - player 1's controller (keyboard, gamepad, on-screen pad, TV remote) presses the accessory's
 *     natural buttons, so a game that needs it can be played with the pad alone;
 *   - its own keys, listed in the Keys panel;
 *   - a touch panel of big buttons (the host's panel, shown from the bar), for phones and tablets;
 *   - the mouse or a finger on the picture, for the pointing devices (a light gun, the tablet, a dial).
 * help(dev) is the one short sentence the window shows when the accessory is plugged in.
 */
export const ACCESSORIES = [               /* NES 2.0 default-expansion-device numbers */
  [0x0A, 'Bandai Hyper Shot (light gun)'], [0x12, 'Konami Hyper Shot (run and jump buttons)'],
  [0x16, 'Party Tap (six quiz buzzers)'], [0x13, 'Pachinko controller (dial)'],
  [0x14, 'Exciting Boxing punching bag'], [0x15, 'Jissen Mahjong controller'],
  [0x17, 'Oeka Kids drawing tablet'], [0x18, 'Barcode World reader'],
  [0x1A, 'Pokkun Moguraa mat (whack-a-mole)'], [0x1B, 'Top Rider bike'],
  [0x1C, 'Two pads held by one player'], [0x26, 'Subor keyboard'], [0x27, 'Subor keyboard and mouse'],
  [0x11, 'Two Arkanoid paddles'], [0x19, 'Miracle Piano keyboard'], [0x21, 'Turbo File (save box)'], [0x22, 'Battle Box (save box)'],
];
const HELP = {
  0x0A: 'Bandai Hyper Shot: point at the picture and press to shoot (or aim with the arrows and fire with X). Your controller is the gun’s own pad: B throws a grenade.',
  0x12: 'Konami Hyper Shot: press A (X key) quickly again and again to run, B (Z key) to jump. Player 2 uses G and F.',
  0x16: 'Party Tap: buzzers 1 to 6 are keys 1 to 6, the buzzer panel, or A on controllers 1 to 4.',
  0x13: 'Pachinko dial: hold C (or press and hold on the picture, further right is harder) to turn the dial; let go to stop. Your controller is its pad.',
  0x14: 'Punching bag: A right jab, B left jab, A and B together a straight, Up with A or B a hook, Down with A or B to the body, Left and Right to step. Or use the punch panel.',
  0x15: 'Mahjong controller: tiles A to N are the letter keys; Kan, Pon, Chii, Riichi and Ron are 1 to 5. With a controller, Left and Right choose on the panel and A presses.',
  0x17: 'Drawing tablet: draw on the picture with the mouse or a finger. With keys or a controller, the arrows move the pen and X (A) draws.',
  0x18: 'Barcode World: swipe a card from the Barcode reader item in the bar (type the 13 digits or take a random card).',
  0x1A: 'Mole mat: use the mat panel (from the bar), or keys 1 2 3 4 / Q W E R / A S D F; the twelve pads are in three rows of four.',
  0x1B: 'Top Rider bike: A (X key) accelerates, B (Z key) brakes, Left and Right steer, Up shifts gear, Down pulls a wheelie.',
  0x1C: 'Two pads, one player: the arrows (or the left stick) are the left hand, I J K L (or the right stick) the right hand.',
  0x26: 'Subor keyboard: type on your keyboard. Scroll Lock switches your keys between typing and the controller.',
  0x27: 'Subor keyboard and mouse: type on your keyboard (Scroll Lock switches typing and the controller); move the mouse over the picture, or drag with a finger, to move the pointer, and click or tap to click.',
  0x11: 'Two Arkanoid paddles: player 1 turns with the mouse or the arrows and fires with X; player 2 turns with J and L and fires with G (or controller 2).',
  0x19: 'Miracle Piano: play on the keys Q to ] (black keys on the number row), the piano panel, or a MIDI keyboard (turn it on in Settings). Page Up and Page Down change the octave. Your controller is controller 2.',
  0x21: 'Turbo File plugged in: the game can save to it. What it keeps stays in this browser.',
  0x22: 'Battle Box plugged in: the game can save to it. What it keeps stays in this browser.',
};
export const help = dev => HELP[dev] || '';
export const isAccessory = dev => ACCESSORIES.some(a => a[0] === dev);
/* Programs whose input-table row says the Subor keyboard ($26) but that need its mouse too ($27): measured, the
   pointer moves only with the mouse. By the file's SHA-256. */
const SUBOR_MOUSE_FILES = new Set(['6f212c5796c367652d9a3420df42d59dad4a6b42d5ed8b53dead5bbddba6794a']);   // Educational Computer 2000 (R) [U][!]
export const deviceFor = (detected, sha) => (detected === 0x26 && SUBOR_MOUSE_FILES.has(sha) ? 0x27 : detected);

const A = 1, B = 2, SEL = 4, ST = 8, UP = 16, DOWN = 32, LEFT = 64, RIGHT = 128;
const btn = (id, label, key, short) => ({ id, label, short, type: 'button', defaults: { key: key ? [].concat(key) : [] } });

/* The Subor keyboard's 13 x 8 matrix (reference M's SuborKeyboard table): [row, half, key] per PC key.
   Escape and Backspace stay the site's Back keys (as for the Family BASIC keyboard). */
const SUBOR_ROWS = [
  ['Digit4', 'KeyG', 'KeyF', 'KeyC', 'F2', 'KeyE', 'Digit5', 'KeyV'],
  ['Digit2', 'KeyD', 'KeyS', 'End', 'F1', 'KeyW', 'Digit3', 'KeyX'],
  ['Insert', '', 'PageDown', 'ArrowRight', 'F8', 'PageUp', 'Delete', 'Home'],
  ['Digit9', 'KeyI', 'KeyL', 'Comma', 'F5', 'KeyO', 'Digit0', 'Period'],
  ['BracketRight', 'Enter', 'ArrowUp', 'ArrowLeft', 'F7', 'BracketLeft', 'Backslash', 'ArrowDown'],
  ['KeyQ', 'CapsLock', 'KeyZ', 'Tab', '', 'KeyA', 'Digit1', 'ControlLeft'],
  ['Digit7', 'KeyY', 'KeyK', 'KeyM', 'F4', 'KeyU', 'Digit8', 'KeyJ'],
  ['Minus', 'Semicolon', 'Quote', 'Slash', 'F6', 'KeyP', 'Equal', 'ShiftLeft'],
  ['KeyT', 'KeyH', 'KeyN', 'Space', 'F3', 'KeyR', 'Digit6', 'KeyB'],
  ['Numpad6', 'NumpadEnter', 'Numpad4', 'Numpad8', '', '', '', ''],
  ['AltLeft', '', 'Numpad7', 'F11', 'F12', 'Numpad1', 'Numpad2', ''],
  ['NumpadSubtract', 'NumpadAdd', 'NumpadMultiply', 'Numpad9', 'F10', 'Numpad5', 'NumpadDivide', 'NumLock'],
  ['Backquote', '', 'Pause', '', 'F9', 'Numpad3', 'NumpadDecimal', 'Numpad0'],
];
const SUBOR_MAP = {};
SUBOR_ROWS.forEach((r, row) => r.forEach((code, i) => { if (code && !SUBOR_MAP[code]) SUBOR_MAP[code] = [row, i >> 2, i & 3]; }));
Object.assign(SUBOR_MAP, { ShiftRight: SUBOR_MAP.ShiftLeft, ControlRight: SUBOR_MAP.ControlLeft, AltRight: SUBOR_MAP.AltLeft });

const MAHJONG_KEYS = 'ABCDEFGHIJKLMN'.split('');
const MAHJONG_CALLS = [['select', 'Select', 'ShiftRight'], ['start', 'Start', 'Enter'], ['kan', 'Kan', 'Digit1'], ['pon', 'Pon', 'Digit2'], ['chii', 'Chii', 'Digit3'], ['riichi', 'Riichi', 'Digit4'], ['ron', 'Ron', 'Digit5']];
const MAT_KEYS = ['Digit1', 'Digit2', 'Digit3', 'Digit4', 'KeyQ', 'KeyW', 'KeyE', 'KeyR', 'KeyA', 'KeyS', 'KeyD', 'KeyF'];

/* Pokkun Moguraa: where each hole is on the picture (0..1) and which mat pad it is.
   MEASURED on the title (tools/nesc pokkun runs): each pad was pressed alone and the hole
   whose mole it hit was read off the picture. */
export const POKKUN_HOLES = [];

/* The Miracle Piano's keys on a computer keyboard: the Q row is white keys from C, the number row
   the black keys above them, as on most music programs; 20 notes from the octave in force. */
const PIANO_KEYS = [['KeyQ', 0], ['Digit2', 1], ['KeyW', 2], ['Digit3', 3], ['KeyE', 4], ['KeyR', 5], ['Digit5', 6], ['KeyT', 7], ['Digit6', 8], ['KeyY', 9],
  ['Digit7', 10], ['KeyU', 11], ['KeyI', 12], ['Digit9', 13], ['KeyO', 14], ['Digit0', 15], ['KeyP', 16], ['BracketLeft', 17], ['Equal', 18], ['BracketRight', 19]];
const NOTE = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const noteName = semi => NOTE[semi % 12] + (semi >= 12 ? '\u2032' : '');

/* THE MIRACLE KEYBOARD'S SOUND. The real keyboard is a synthesizer: the cartridge sends it MIDI (the
   lesson's music, the notes it plays back) and it sounds the keys pressed on it. This is a small
   synthesizer of our own (CONVENIENCE, not a model of the Miracle's voices): each note a decaying
   tone with a few harmonics, the program number choosing one of four tone colours. Its samples are
   added to the console's own audio, so the window's volume, mute and pause apply to it. */
class MiniSynth {
  constructor() { this.voices = []; this.prog = new Uint8Array(16); this.run = 0; this.args = []; this.sysex = false; this.vol = 0.22; }
  byte(b) {
    if (b === 0xF0) { this.sysex = true; return; }
    if (this.sysex) { if (b === 0xF7) this.sysex = false; return; }
    if (b >= 0xF8) { if (b === 0xFF) this.allOff(); return; }   // real-time bytes; $FF a reset
    if (b & 0x80) { this.run = b; this.args = []; return; }
    if (!this.run) return;
    this.args.push(b);
    const st = this.run & 0xF0, ch = this.run & 15, need = (st === 0xC0 || st === 0xD0) ? 1 : 2;
    if (this.args.length < need) return;
    const [a, v] = this.args; this.args = [];
    if (st === 0x90 && v) this.on(ch, a, v); else if (st === 0x80 || st === 0x90) this.off(ch, a);
    else if (st === 0xC0) this.prog[ch] = a;
    else if (st === 0xB0 && (a === 123 || a === 120)) this.allOff();
  }
  on(ch, note, vel) {
    this.off(ch, note);
    if (this.voices.length >= 16) this.voices.shift();
    this.voices.push({ ch, note, f: 440 * 2 ** ((note - 69) / 12), ph: 0, amp: vel / 127, env: 0, rel: false, t: 0, colour: this.prog[ch] & 3 });
  }
  off(ch, note) { for (const v of this.voices) if (v.ch === ch && v.note === note) v.rel = true; }
  allOff() { this.voices = []; }
  /* Add n samples at `rate` into the Int16Array `buf` from `at`. */
  mix(buf, at, n, rate) {
    if (!this.voices.length || !n) return;
    const dt = 1 / rate, TAU = 2 * Math.PI;
    for (const v of this.voices) {
      const w = TAU * v.f * dt, hs = v.colour === 0 ? [1, 0.5, 0.25, 0.12] : v.colour === 1 ? [1, 0.15, 0.4, 0.05] : v.colour === 2 ? [1, 0.7, 0.5, 0.35] : [1, 0, 0.3, 0];
      for (let i = 0; i < n; i++) {
        v.env = v.rel ? v.env * 0.9992 : Math.min(1, v.env + 0.02) * (v.t > 0.05 ? 0.99997 : 1);
        v.t += dt; v.ph += w;
        const s = Math.sin(v.ph) * hs[0] + Math.sin(2 * v.ph) * hs[1] + Math.sin(3 * v.ph) * hs[2] + Math.sin(4 * v.ph) * hs[3];
        const k = at + i, y = buf[k] + s * v.env * v.amp * this.vol * 9000;
        buf[k] = y > 32767 ? 32767 : y < -32768 ? -32768 : y;
      }
      if (v.ph > 1e6) v.ph %= TAU;
    }
    this.voices = this.voices.filter(v => !(v.rel && v.env < 0.001));
  }
}

export class Accessory {
  constructor(dev, nes, { fps = 60 } = {}) {
    this.dev = dev; this.nes = nes; this.x = nes.x; this.c = nes.ctx; this.fps = fps;
    this.prev = 0; this.dial = 0; this.cursor = 0; this.held = new Map();
    this.tr = { steer: 0, accel: 0, brake: 0 };
    this.pen = { x: 128, y: 120 }; this.kb = new Map();
    this.vaus2 = 0xA4;
    this.synth = dev === 0x19 ? new MiniSynth() : null; this.octave = 60; this.notes = new Map(); this.prevPiano = 0; this.midi = null;
  }
  has(n) { return typeof this.x[n] === 'function'; }
  get usesPointer() { return this.dev === 0x0A || this.dev === 0x17 || this.dev === 0x13 || this.dev === 0x1A; }
  get keyboard() { return this.dev === 0x26 || this.dev === 0x27; }

  /* The accessory's ports for the host (port numbers 4 and 7, which core.mjs leaves free for it). */
  ports() {
    const d = this.dev, out = [];
    /* $0A, the Bandai Hyper Shot: its gun is core.mjs's light-gun port (isZapper); its pad is player 1's (step). */
    if (d === 0x12) out.push({ port: 4, kind: 'accessory', device: 'hypershot', label: 'Hyper Shot', panel: { cols: 2, title: 'Hyper Shot' }, controls: [
      btn('run1', 'Player 1 run', 'KeyX', 'RUN 1'), btn('jump1', 'Player 1 jump', 'KeyZ', 'JUMP 1'),
      btn('run2', 'Player 2 run', 'KeyG', 'RUN 2'), btn('jump2', 'Player 2 jump', 'KeyF', 'JUMP 2')] });
    if (d === 0x16) out.push({ port: 4, kind: 'accessory', device: 'partytap', label: 'Party Tap', panel: { cols: 6, title: 'Party Tap' }, controls:
      [1, 2, 3, 4, 5, 6].map(i => btn('buzz' + i, 'Buzzer ' + i, 'Digit' + i, String(i))) });
    if (d === 0x13) out.push({ port: 4, kind: 'accessory', device: 'dial', label: 'Pachinko dial', controls: [
      btn('turn', 'Turn the dial (hold)', 'KeyC'),
      { id: 'dial', label: 'Turn (press on the picture; further right is harder)', type: 'pointer', defaults: {} }] });
    if (d === 0x14) out.push({ port: 4, kind: 'accessory', device: 'bag', label: 'Punching bag', panel: { cols: 4, title: 'Punching bag' }, controls: [
      btn('lhook', 'Left hook', 'KeyQ', 'L HOOK'), btn('straight', 'Straight', 'KeyW', 'STRAIGHT'), btn('body', 'Body', 'KeyS', 'BODY'), btn('rhook', 'Right hook', 'KeyE', 'R HOOK'),
      btn('ljab', 'Left jab', 'KeyA', 'L JAB'), btn('mleft', 'Step left', 'KeyZ', '← STEP'), btn('mright', 'Step right', 'KeyC', 'STEP →'), btn('rjab', 'Right jab', 'KeyD', 'R JAB')] });
    if (d === 0x15) out.push({ port: 4, kind: 'accessory', device: 'mahjong', label: 'Mahjong controller', panel: { cols: 7, title: 'Mahjong controller', cursor: true }, controls:
      MAHJONG_KEYS.map(k => btn('t' + k, 'Tile ' + k, 'Key' + k, k)).concat(MAHJONG_CALLS.map(([id, l, k]) => btn(id, l, k, l.toUpperCase()))) });
    if (d === 0x17) out.push({ port: 4, kind: 'accessory', device: 'tablet', label: 'Drawing tablet', controls: [
      btn('draw', 'Pen down', 'KeyX'), btn('pen-up', 'Pen up', 'ArrowUp'), btn('pen-down', 'Pen down the picture', 'ArrowDown'),
      btn('pen-left', 'Pen left', 'ArrowLeft'), btn('pen-right', 'Pen right', 'ArrowRight'),
      { id: 'pen', label: 'Draw (on the picture)', type: 'pointer', defaults: {} }] });
    if (d === 0x1A) out.push({ port: 4, kind: 'accessory', device: 'mat', label: 'Mole mat', panel: { cols: 4, title: 'Mole mat' }, controls:
      MAT_KEYS.map((k, i) => btn('mat' + (i + 1), String(i + 1), k, String(i + 1))) });
    if (d === 0x1B) out.push({ port: 4, kind: 'accessory', device: 'bike', label: 'Top Rider', controls: [
      btn('accel', 'Accelerate', 'KeyX'), btn('brake', 'Brake', 'KeyZ'), btn('left', 'Steer left', 'ArrowLeft'), btn('right', 'Steer right', 'ArrowRight'),
      btn('gear', 'Shift gear', 'ArrowUp'), btn('rear', 'Wheelie', 'ArrowDown')] });
    if (d === 0x1C) out.push({ port: 4, kind: 'accessory', device: 'righthand', label: 'Right hand', panel: { cols: 3, title: 'Right hand', dpad: true }, controls: [
      btn('rup', 'Right hand up', 'KeyI', '↑'), btn('rdown', 'Right hand down', 'KeyK', '↓'), btn('rleft', 'Right hand left', 'KeyJ', '←'), btn('rright', 'Right hand right', 'KeyL', '→')] });
    if (d === 0x11) out.push({ port: 4, kind: 'accessory', device: 'paddle', label: 'Arkanoid paddle', controls: [
      btn('fire', 'Fire', ['KeyX', 'KeyZ']), btn('knob-left', 'Turn left', 'ArrowLeft'), btn('knob-right', 'Turn right', 'ArrowRight'),
      { id: 'knob', label: 'Turn (move over the picture)', type: 'pointer', defaults: {} }] },
      { port: 7, kind: 'accessory', device: 'paddle2', label: 'Arkanoid paddle 2', controls: [
      btn('fire2', 'Player 2 fire', 'KeyG'), btn('knob2-left', 'Player 2 turn left', 'KeyJ'), btn('knob2-right', 'Player 2 turn right', 'KeyL')] });
    if (d === 0x19) out.push({ port: 7, kind: 'accessory', device: 'piano', label: 'Miracle Piano', panel: { cols: 10, title: 'Miracle Piano', piano: true }, controls:
      PIANO_KEYS.map(([code, semi]) => btn('n' + semi, 'Note ' + noteName(semi), code, noteName(semi))).concat([btn('oct-down', 'Octave down', 'PageDown', 'OCT \u2212'), btn('oct-up', 'Octave up', 'PageUp', 'OCT +')]) });
    if (d === 0x27) out.push({ port: 4, kind: 'accessory', device: 'mouse', label: 'Subor mouse', controls: [
      { id: 'mouse', label: 'Move and click (over the picture; a finger drags, a tap clicks)', type: 'pointer', defaults: {} }] });
    if (d === 0x26 || d === 0x27) out.push({ port: 7, kind: 'accessory', device: 'subor-keyboard', label: 'Subor keyboard', controls: [
      { id: 'keyboard', label: 'Keyboard (Scroll Lock: typing or controller)', type: 'keyboard', codes: Object.keys(SUBOR_MAP), toggle: 'ScrollLock', defaults: {} }] });
    return out;
  }

  /* Save boxes: their memory as a battery region (kept per game in this browser). */
  battery() {
    if (!this.has('nes_exp_storage')) return [];
    if (this.dev === 0x21) return [{ id: 'turbofile', kind: 'sram', bytes: 8192, ext: '.turbofile' }];
    if (this.dev === 0x22) return [{ id: 'battlebox', kind: 'sram', bytes: 512, ext: '.battlebox' }];
    return [];
  }
  storeId(id) { return id === 'turbofile' && this.dev === 0x21 ? 0 : id === 'battlebox' && this.dev === 0x22 ? 1 : -1; }
  storage(id) { const w = this.storeId(id); if (w < 0) return null; const p = this.x.nes_exp_storage(this.c, w), n = this.x.nes_exp_storage_size(this.c, w); return p && n ? this.nes.u8.subarray(p, p + n) : null; }
  read(id) { const m = this.storage(id); return m ? new Uint8Array(m) : null; }
  write(id, b) { const m = this.storage(id); if (!m || b.length !== m.length) return false; m.set(b); this.x.nes_exp_storage_clean(this.c, this.storeId(id)); return true; }
  dirty() { return this.battery().filter(b => this.x.nes_exp_storage_dirty(this.c, this.storeId(b.id))).map(b => b.id); }
  clean(id) { const w = this.storeId(id); if (w >= 0) this.x.nes_exp_storage_clean(this.c, w); }

  /* Barcode World: a card of 13 digits (the host's Barcode reader item). */
  get hasBarcode() { return this.dev === 0x18 && this.has('nes_barcodew_scan'); }
  barcodeBusy() { return this.hasBarcode && !!this.x.nes_barcodew_busy(this.c); }
  barcodeScan(digits) {
    const s = String(digits).replace(/\D/g, '');
    if (!this.hasBarcode || s.length !== 13) return false;
    let a = 0, b = 0;
    for (let i = 0; i < 13; i++) { const v = s.charCodeAt(i) - 48; if (i < 8) a += v * 2 ** (4 * i); else b += v * 2 ** (4 * (i - 8)); }
    return !!this.x.nes_barcodew_scan(this.c, a >>> 0, b >>> 0, 13);
  }

  /* Where the light gun or the pen is (0..1), for the host's crosshair. */
  crosshair() {
    if (this.dev === 0x17 && this.pen.on) return { x: (this.pen.x + 0.5) / 256, y: (this.pen.y + 0.5) / 240 };
    return null;
  }

  rightStick() {
    try { for (const p of (navigator.getGamepads ? navigator.getGamepads() : [])) if (p && p.connected && p.axes.length >= 4) return [p.axes[2] || 0, p.axes[3] || 0]; } catch (_) {}
    return [0, 0];
  }

  /* Once a frame, before the core runs. ins: port -> InputState (core.mjs's map). Returns the extra
     buttons to OR into controller 2 (the double-fisted right hand), else 0. */
  step(ins) {
    const x = this.x, c = this.c, d = this.dev;
    const p1 = (ins.get(0) || { buttons: 0 }).buttons, p2 = (ins.get(1) || { buttons: 0 }).buttons;
    const acc = ins.get(4) || { buttons: 0 }, acc7 = ins.get(7) || { buttons: 0 };
    const fresh = p1 & ~this.prev; this.prev = p1;
    if (d === 0x12 && this.has('nes_set_hypershot')) {
      const b = acc.buttons, m = ((b & 1) || (p1 & A) ? 1 : 0) | ((b & 2) || (p1 & B) ? 2 : 0) | ((b & 4) || (p2 & A) ? 4 : 0) | ((b & 8) || (p2 & B) ? 8 : 0);
      x.nes_set_hypershot(c, m);
    }
    if (d === 0x16 && this.has('nes_set_partytap')) {
      let m = acc.buttons & 0x3F;
      if (p1 & A) m |= 1; if (p2 & A) m |= 2;
      for (const [port, bit] of [[2, 4], [3, 8]]) if (((ins.get(port) || { buttons: 0 }).buttons) & A) m |= bit;
      x.nes_set_partytap(c, m);
    }
    if (d === 0x0A && this.has('nes_set_xpad')) x.nes_set_xpad(c, p1 & ~A);   // the gun's own pad; its A is never pressed (wiki)
    if (d === 0x13 && this.has('nes_set_pachinko')) {
      x.nes_set_xpad(c, p1);
      const pt = acc.pointer, st = this.rightStick();
      let want = 0;
      if (acc.buttons & 1) want = Math.min(0x63, this.dial + 3);        // held: turns further
      if (pt && pt.inside && (pt.buttons & 1)) want = Math.max(want, Math.round(Math.max(0, Math.min(1, pt.x)) * 0x63));
      const s = Math.max(Math.abs(st[0]), Math.abs(st[1])); if (s > 0.15) want = Math.max(want, Math.round(s * 0x63));
      this.dial = want;
      x.nes_set_pachinko(c, this.dial);
    }
    if (d === 0x14 && this.has('nes_set_boxing')) {
      const b = acc.buttons;
      /* sensors: 0 left hook, 1 step right, 2 step left, 3 right hook, 4 left jab, 5 body, 6 right jab, 7 straight */
      let m = 0;
      if (b & 1) m |= 1; if (b & 2) m |= 0x80; if (b & 4) m |= 0x20; if (b & 8) m |= 8;
      if (b & 16) m |= 0x10; if (b & 32) m |= 4; if (b & 64) m |= 2; if (b & 128) m |= 0x40;
      if (p1 & LEFT) m |= 4; if (p1 & RIGHT) m |= 2;
      const a = p1 & A, bb = p1 & B;
      if (a && bb) m |= 0x80;
      else if (p1 & UP) { if (a) m |= 8; if (bb) m |= 1; }
      else if (p1 & DOWN) { if (a || bb) m |= 0x20; }
      else { if (a) m |= 0x40; if (bb) m |= 0x10; }
      x.nes_set_boxing(c, m);
    }
    if (d === 0x15 && this.has('nes_set_mahjong')) {
      let m = acc.buttons & 0x1FFFFF;
      /* controller: Left / Right choose a key on the panel (the host shows the highlight), A presses it */
      if (fresh & LEFT) this.cursor = (this.cursor + 20) % 21;
      if (fresh & RIGHT) this.cursor = (this.cursor + 1) % 21;
      if (fresh & UP) this.cursor = (this.cursor + 14) % 21;
      if (fresh & DOWN) this.cursor = (this.cursor + 7) % 21;
      if (p1 & A) m |= 1 << this.cursor;
      if (p1 & ST) m |= 1 << 15; if (p1 & SEL) m |= 1 << 14;
      x.nes_set_mahjong(c, m);
    }
    if (d === 0x17 && this.has('nes_set_oeka')) {
      const pt = acc.pointer, b = acc.buttons | ((p1 & A) ? 1 : 0) | ((p1 & UP) ? 2 : 0) | ((p1 & DOWN) ? 4 : 0) | ((p1 & LEFT) ? 8 : 0) | ((p1 & RIGHT) ? 16 : 0);
      let click = !!(b & 1);
      if (pt && pt.inside) { this.pen.x = Math.floor(pt.x * 256); this.pen.y = Math.floor(pt.y * 240); this.pen.on = true; if (pt.buttons & 1) click = true; }
      if (b & 2) this.pen.y = Math.max(0, this.pen.y - 2);
      if (b & 4) this.pen.y = Math.min(239, this.pen.y + 2);
      if (b & 8) this.pen.x = Math.max(0, this.pen.x - 2);
      if (b & 16) this.pen.x = Math.min(255, this.pen.x + 2);
      if (b & 30) this.pen.on = true;
      x.nes_set_oeka(c, this.pen.on ? this.pen.x : -1, this.pen.on ? this.pen.y : -1, this.pen.on ? 1 : 0, click ? 1 : 0);
    }
    if (d === 0x1A && this.has('nes_set_mat')) {
      let m = acc.buttons & 0xFFF;
      const pt = acc.pointer;
      if (pt && pt.inside && (pt.buttons & 1) && POKKUN_HOLES.length) {
        let best = null, bd = 1e9;
        for (const h of POKKUN_HOLES) { const dd = (h.x - pt.x) ** 2 + ((h.y - pt.y) * 0.9375) ** 2; if (dd < bd) { bd = dd; best = h; } }
        if (best && bd < 0.012) m |= 1 << best.pad;
      }
      x.nes_set_mat(c, m);
    }
    if (d === 0x1B && this.has('nes_set_toprider')) {
      const b = acc.buttons, t = this.tr;
      const accel = (b & 1) || (p1 & A), brake = (b & 2) || (p1 & B), left = (b & 4) || (p1 & LEFT), right = (b & 8) || (p1 & RIGHT);
      const st = this.rightStick();
      t.accel = accel ? Math.min(20, t.accel + 1) : Math.max(0, t.accel - 1);
      t.brake = brake ? Math.min(20, t.brake + 1) : Math.max(0, t.brake - 1);
      if (left && !right) t.steer = Math.max(-20, t.steer - 1); else if (right && !left) t.steer = Math.min(20, t.steer + 1);
      else t.steer += t.steer > 0 ? -1 : t.steer < 0 ? 1 : 0;
      if (Math.abs(st[0]) > 0.15) t.steer = Math.round(st[0] * 20);
      const buttons = ((b & 16) || (p1 & UP) ? 0x10 : 0) | ((b & 32) || (p1 & DOWN) ? 0x20 : 0) | (p1 & SEL ? 4 : 0) | (p1 & ST ? 8 : 0);
      x.nes_set_toprider(c, t.steer, t.accel, t.brake, buttons);
    }
    if (d === 0x11 && this.has('nes_set_vaus2')) {
      const b = acc7.buttons;
      if ((b & 2) || (p2 & LEFT)) this.vaus2 = Math.max(0x54, this.vaus2 - 3);
      if ((b & 4) || (p2 & RIGHT)) this.vaus2 = Math.min(0xF4, this.vaus2 + 3);
      x.nes_set_vaus2(c, this.vaus2 & 0xff, (b & 1) || (p2 & (A | B)) ? 1 : 0);
    }
    if (d === 0x27 && this.has('nes_subor_mouse')) {
      /* The mouse: movement from the pointer's travel over the picture (256 x 240 steps), a click from a press that
         did not travel (so a finger's drag moves without clicking), held while the press lasts. */
      const pt = acc.pointer, m = this.mouse || (this.mouse = { x: null, y: null, down: false, moved: 0, click: 0 });
      let dx = 0, dy = 0, btn = 0;
      if (pt && pt.inside) {
        const px = pt.x * 256, py = pt.y * 240;
        if (m.x !== null && (pt.buttons & 1 || !m.down)) { dx = Math.round(px - m.x); dy = Math.round(py - m.y); }
        m.x = px; m.y = py;
      } else m.x = m.y = null;
      const down = !!(pt && pt.buttons & 1);
      if (down && !m.down) m.moved = 0;
      if (down) m.moved += Math.abs(dx) + Math.abs(dy);
      if (!down && m.down && m.moved < 4) m.click = 6;            // a tap: one click
      m.down = down;
      if (down && m.moved < 4) btn = 1;                            // a press that has not travelled: held
      if (m.click > 0) { btn = 1; m.click--; }
      x.nes_subor_mouse(c, dx, dy, btn);
    }
    if ((d === 0x26 || d === 0x27) && this.has('nes_sub_key')) {
      const want = new Set(acc7.keys || []);
      for (const [code, p] of this.kb) if (!want.has(code)) { this.kb.delete(code); if (![...this.kb.values()].includes(p)) x.nes_sub_key(c, p[0], p[1], p[2], 0); }
      for (const code of want) if (!this.kb.has(code) && SUBOR_MAP[code]) { const p = SUBOR_MAP[code]; this.kb.set(code, p); x.nes_sub_key(c, p[0], p[1], p[2], 1); }
    }
    if (d === 0x19 && this.has('nes_miracle_out')) {
      /* The cable: what the cartridge sent goes to the synthesizer; the keys go back as MIDI note on / off
         (channel 1, velocity 80; the lesson software reads the note numbers). */
      for (let b; (b = x.nes_miracle_out(c)) !== 0x100;) this.synth.byte(b);
      const b = acc7.buttons, now = b & 0xFFFFF, ch = now ^ (this.prevPiano & 0xFFFFF);
      if ((b & (1 << 20)) && !(this.prevPiano & (1 << 20))) this.octave = Math.max(36, this.octave - 12);
      if ((b & (1 << 21)) && !(this.prevPiano & (1 << 21))) this.octave = Math.min(84, this.octave + 12);
      for (let i = 0; i < 20; i++) if (ch & (1 << i)) this.key(now & (1 << i) ? this.octave + PIANO_KEYS[i][1] : -1, 'k' + i);
      this.prevPiano = b;
      return 0x10000 | (p1 & 0xff);              // controller 2 is the player's controller (the cable is in port 1)
    }
    if (d === 0x1C) {
      /* The right hand: I J K L, the right-hand panel, or a gamepad's right stick, on controller 2's d-pad. */
      const b = acc.buttons, st = this.rightStick();
      let m = ((b & 1) ? UP : 0) | ((b & 2) ? DOWN : 0) | ((b & 4) ? LEFT : 0) | ((b & 8) ? RIGHT : 0);
      if (st[1] < -0.4) m |= UP; if (st[1] > 0.4) m |= DOWN; if (st[0] < -0.4) m |= LEFT; if (st[0] > 0.4) m |= RIGHT;
      return m;
    }
    return 0;
  }
  /* One key of the piano (from the keys, the panel or a MIDI keyboard): note >= 0 presses, -1 lets go. */
  key(note, id) {
    const x = this.x, c = this.c;
    if (note >= 0) {
      if (this.notes.has(id)) this.key(-1, id);
      this.notes.set(id, note); x.nes_miracle_in(c, 0x90); x.nes_miracle_in(c, note & 0x7F); x.nes_miracle_in(c, 80); this.synth.on(15, note, 80);
    } else {
      const n = this.notes.get(id); if (n === undefined) return;
      this.notes.delete(id); x.nes_miracle_in(c, 0x90); x.nes_miracle_in(c, n & 0x7F); x.nes_miracle_in(c, 0); this.synth.off(15, n);
    }
  }
  /* A MIDI keyboard through the browser (Web MIDI), when the player turns it on in Settings. */
  async midiOn(on) {
    if (this.dev !== 0x19) return false;
    if (!on) { if (this.midi) for (const i of this.midi.inputs.values()) i.onmidimessage = null; this.midi = null; return true; }
    if (!navigator.requestMIDIAccess) return false;
    try {
      this.midi = await navigator.requestMIDIAccess({ sysex: false });
      const hook = () => { for (const i of this.midi.inputs.values()) i.onmidimessage = e => { const [st, a, v] = e.data; const t = st & 0xF0; if (t === 0x90 && v) this.key(a, 'm' + a); else if (t === 0x80 || t === 0x90) this.key(-1, 'm' + a); }; };
      hook(); this.midi.onstatechange = hook;
      return true;
    } catch (_) { this.midi = null; return false; }
  }
  /* The synthesizer's samples, added to the console's (core.mjs drainAudio). */
  mix(buf, at, n, rate) { if (this.synth) this.synth.mix(buf, at, n, rate); }
  /* For the host's panel highlight (the mahjong controller's chosen key). */
  panelCursor() { return this.dev === 0x15 ? this.cursor : -1; }
  debug() { return { dev: this.dev, dial: this.dial, cursor: this.cursor, tr: Object.assign({}, this.tr), pen: Object.assign({}, this.pen), vaus2: this.vaus2, keys: this.kb.size }; }
}
