/*
 * play/cores/nes/core.mjs -- NES / Famicom / Famicom Disk System / VS. System for the one
 * play host (Core API 1.0; the build plan, phase 4).
 *
 * Wraps the vendored NES core (play/nes/web/core.js NesCore, build/nes.wasm) WITHOUT
 * editing it: every call here is one the old page (play/nes/app.js) already makes, in the
 * same order, so a state, a battery image or a disk save made by either window is the
 * other's. Anything found here that is the core's is fixed in the core, never in this file.
 *
 * What the old page did per console and this module now does for the host:
 *   - the cartridge's own region (REGION.AUTO), its frame rate and the APU's rate (CPU / 40);
 *   - the Disk System: the player's own 8 KB firmware, power on empty, insert side A after 8
 *     frames, a swap is eject + 60 frames + insert (FITTED in the core's FdsDrive, A3/A4);
 *     disk saves kept per side, written when the motor stops;
 *   - the peripherals the core detects (NES 2.0 header, else the input table): Zapper,
 *     Arkanoid paddle, Power Pad / Family Trainer, Four Score, the Famicom microphone, the
 *     Family BASIC keyboard; the player may plug another (the Controller option);
 *   - the VS. System: its own RGB palette, coins, service, DIP switches (picture-unit bits
 *     locked, as the old page did).
 */
import { NesCore, NES_W, NES_H, REGION, FDS_SIDE_BYTES, sha256, hex } from '../../nes/web/core.js';
import { LUT } from '../../nes/web/render.js';
import { CoreError } from '../../host/core-api.mjs';
/* The Study Box tape deck's feeder (mapper 186), the old NES page's own module: page-free (a tape
   source is any { name, size, read(offset, length) }), so the core runs it (2026-10-15). */
import { TapeFeeder } from '../../nes/studybox-deck.js?v=2.1.0';
/* Games on more than one disk, linked by hash, and the automatic
   disk change (the core's web/fds_sets.js and web/fds_autoswap.js, copied with the core). */
import { fdsSetOf } from '../../nes/web/fds_sets.js';
import { FdsAutoSwap } from '../../nes/web/fds_autoswap.js';
/* The Famicom Data Recorder's file side (WAV in, WAV out), the core's
   web/data-recorder.js, copied with the core. The deck itself is the core's (nes_dr_*). */
import { decodeTape, encodeWav } from '../../nes/web/data-recorder.js';
/* R.O.B. (2026-10-21): the robot watches the picture for its flash commands; Gyromite's
   gyro trays hold controller two's A and B. Page-free; the 3D robot is the host's (rob-panel.mjs). */
/* The Famicom expansion accessories: Hyper Shots, Party Tap, pachinko
   dial, punching bag, mahjong keypad, drawing tablet, Barcode World, mole mat, Top Rider, Subor keyboard,
   a second Arkanoid knob, two pads for one player, and the Turbo File / Battle Box save boxes. */
import { ACCESSORIES, Accessory, isAccessory, deviceFor, help as accHelp } from './accessories.mjs?v=2.1.0';
import { Rob, robKindOf } from './rob.mjs?v=2.1.0';
import { cheatEngine } from '../cheats-core.mjs?v=2.1.0';

const FDS_BIOS_BYTES = 8192, FDS_SWAP_GAP_FRAMES = 60, FDS_FIRST_INSERT_FRAMES = 8;
const ZAP_HOLD_FRAMES = 6, VAUS_MIN = 0x54, VAUS_MAX = 0xF4;
const REGION_TIMING = [
  { fps: 60.0988, cpu: 1789773 },        /* 0 NTSC */
  { fps: 50.0070, cpu: 1662607 },        /* 1 PAL */
  { fps: 50.0070, cpu: 1773448 },        /* 2 Dendy */
];
export const DEVICES = [                 /* NES 2.0 default-expansion-device numbers (play/nes/app.js DEVICES) */
  [1, 'Standard pads'], [0x08, 'Zapper'], [0x0F, 'Arkanoid paddle (NES)'], [0x10, 'Arkanoid paddle (Famicom)'],
  [0x0B, 'Power Pad side A'], [0x0C, 'Power Pad side B'], [0x0D, 'Family Trainer side A'], [0x0E, 'Family Trainer side B'],
  [0x02, 'Four Score'], [0x03, 'Famicom 4-player adapter'],
  [0x1F, 'R.O.B. with gyros (Gyromite)'], [0x2E, 'R.O.B. with blocks (Stack-Up)'],   // theinput table's numbers
].concat(ACCESSORIES);   // expansion accessories
const DEVICE_FAMILY_KEYBOARD = 0x23;
/* NES 2.0 device $2A is "multicart": a category, not a peripheral; its games use standard pads
   (150-in-1, 260-in-1 on mapper 235, 2026-10-22). */
const DEVICE_MULTICART = 0x2A;
/* NES 2.0 device $20 is the Famicom Data Recorder (the tape deck alone, keyboard not emulated): not
   a controller, its games keep standard pads (Excitebike, Lode Runner; 75 input-table rows). The deck
   itself is offered by the tape routine below (drTitle), 2026-10-23. */
const DEVICE_DATA_RECORDER = 0x20;

/* THE DATA RECORDER'S TITLES (2026-10-18). Family BASIC and Playbox BASIC are known by the
   input table (device $23: the keyboard is plugged in at power-on, so the deck is there). The games
   that save to tape through the keyboard are known by their own program: after each LDA $4016 /
   AND #$02 (the tape input, $4016 D1) a 24-byte window is hashed (FNV-1a 32) and looked up here,
   one window per title. Measured on a local library on 2026-10-18 (16,695 files): Lode Runner
   (J) and (U) 16 of 16 files, Excitebike 28 of 28, Mach Rider 9 of 9, Wrecking Crew 8 of 8, Castle
   Excellent 11 of 11, and no other title except hacks, translations and multicarts carrying one of
   those programs, and Castlequest (Castle Excellent's US release). Arkanoid II, which reads $4016
   D1 for its paddle, does not match. Only hashes are kept here, never a cartridge byte. */
const TAPE_SIGS = new Set([0x20fcec30, 0x0e3ca9ae, 0x1e9dec1a, 0x8b154284, 0x08a863ca]);
function tapeTitle(b) {
  for (let i = 0; i + 24 <= b.length; i++) {
    if (b[i] !== 0xAD || b[i + 1] !== 0x16 || b[i + 2] !== 0x40 || b[i + 3] !== 0x29 || b[i + 4] !== 0x02) continue;
    let h = 0x811c9dc5;
    for (let k = i; k < i + 24; k++) { h ^= b[k]; h = Math.imul(h, 0x01000193) >>> 0; }
    if (TAPE_SIGS.has(h)) return true;
  }
  return false;
}
const DR_BLANK_SECONDS = 300, DR_MAX_SAMPLES = 32000000;   // a blank tape is 5 minutes (data-recorder.js Deck); a tape at most ~16 min at 32 kHz

export function isDiskImage(b) {
  if (!b || b.length < 16) return false;
  if (b[0] === 0x4e && b[1] === 0x45 && b[2] === 0x53 && b[3] === 0x1a) return false;
  if (b[0] === 0x55 && b[1] === 0x4e && b[2] === 0x49 && b[3] === 0x46) return false;
  if (b[0] === 0x46 && b[1] === 0x44 && b[2] === 0x53 && b[3] === 0x1a) return true;
  if (b.length % FDS_SIDE_BYTES !== 0 || b[0] !== 0x01) return false;
  const sig = '*NINTENDO-HVC*';
  for (let i = 0; i < sig.length; i++) if (b[1 + i] !== sig.charCodeAt(i)) return false;
  return true;
}
const headerless = b => (b.length >= 16 && b[0] === 0x46 && b[1] === 0x44 && b[2] === 0x53 && b[3] === 0x1a) ? b.subarray(16) : b;
const sideName = i => `Disk ${(i >> 1) + 1} side ${'AB'[i & 1]}`;
/* The set a disk file belongs to (by the sha256 of the file as given), or null. */
const setOfBytes = b => (isDiskImage(b) ? fdsSetOf(hex(sha256(b))) : null);

/* The Family BASIC keyboard's matrix, play/nes/app.js FAMILY_KEYMAP (itself the core's
   web/shell.js map minus Escape and Backspace, the site's Back keys). */
const FB = (r, h, k) => [r, h, k];
const FAMILY_KEYMAP = {
  F8: FB(0, 0, 0), Enter: FB(0, 0, 1), NumpadEnter: FB(0, 0, 1), BracketLeft: FB(0, 0, 2), BracketRight: FB(0, 0, 3),
  KanaMode: FB(0, 1, 0), ContextMenu: FB(0, 1, 0), ShiftRight: FB(0, 1, 1), Backslash: FB(0, 1, 2), IntlYen: FB(0, 1, 2),
  End: FB(0, 1, 3), Pause: FB(0, 1, 3),
  F7: FB(1, 0, 0), Backquote: FB(1, 0, 1), Quote: FB(1, 0, 2), Semicolon: FB(1, 0, 3),
  IntlRo: FB(1, 1, 0), Slash: FB(1, 1, 1), Minus: FB(1, 1, 2), Equal: FB(1, 1, 3),
  F6: FB(2, 0, 0), KeyO: FB(2, 0, 1), KeyL: FB(2, 0, 2), KeyK: FB(2, 0, 3),
  Period: FB(2, 1, 0), Comma: FB(2, 1, 1), KeyP: FB(2, 1, 2), Digit0: FB(2, 1, 3),
  F5: FB(3, 0, 0), KeyI: FB(3, 0, 1), KeyU: FB(3, 0, 2), KeyJ: FB(3, 0, 3),
  KeyM: FB(3, 1, 0), KeyN: FB(3, 1, 1), Digit9: FB(3, 1, 2), Digit8: FB(3, 1, 3),
  F4: FB(4, 0, 0), KeyY: FB(4, 0, 1), KeyG: FB(4, 0, 2), KeyH: FB(4, 0, 3),
  KeyB: FB(4, 1, 0), KeyV: FB(4, 1, 1), Digit7: FB(4, 1, 2), Digit6: FB(4, 1, 3),
  F3: FB(5, 0, 0), KeyT: FB(5, 0, 1), KeyR: FB(5, 0, 2), KeyD: FB(5, 0, 3),
  KeyF: FB(5, 1, 0), KeyC: FB(5, 1, 1), Digit5: FB(5, 1, 2), Digit4: FB(5, 1, 3),
  F2: FB(6, 0, 0), KeyW: FB(6, 0, 1), KeyS: FB(6, 0, 2), KeyA: FB(6, 0, 3),
  KeyX: FB(6, 1, 0), KeyZ: FB(6, 1, 1), KeyE: FB(6, 1, 2), Digit3: FB(6, 1, 3),
  F1: FB(7, 0, 0), Tab: FB(7, 0, 1), KeyQ: FB(7, 0, 2), ControlLeft: FB(7, 0, 3), ControlRight: FB(7, 0, 3),
  ShiftLeft: FB(7, 1, 0), AltLeft: FB(7, 1, 1), Digit1: FB(7, 1, 2), Digit2: FB(7, 1, 3),
  Home: FB(8, 0, 0), ArrowUp: FB(8, 0, 1), ArrowRight: FB(8, 0, 2), ArrowLeft: FB(8, 0, 3),
  ArrowDown: FB(8, 1, 0), Space: FB(8, 1, 1), Delete: FB(8, 1, 2), Insert: FB(8, 1, 3),
};

/* Pads: control order is the core's shift-register order (BTN A 0x01 ... RIGHT 0x80), so
   the host's mask is the core's mask. Player 1's keys are the Game Boy's (the site's one
   hand position); player 2's are play/nes/app.js KEYMAP[1]. Pad buttons follow
   play-pad.js's table: by printed letter, the printed A is the console's A (2026-10-16). */
const pad = (keys, padBtns) => [
  { id: 'a', label: 'A', type: 'button', defaults: { key: keys.a, pad: padBtns ? ['A', 'X'] : [] } },
  { id: 'b', label: 'B', type: 'button', defaults: { key: keys.b, pad: padBtns ? ['B', 'Y'] : [] } },
  { id: 'select', label: 'Select', type: 'button', defaults: { key: keys.select, pad: padBtns ? ['Select'] : [] } },
  { id: 'start', label: 'Start', type: 'button', defaults: { key: keys.start, pad: padBtns ? ['Start'] : [] } },
  { id: 'up', label: 'Up', type: 'button', defaults: { key: keys.up, pad: padBtns ? ['Up'] : [] } },
  { id: 'down', label: 'Down', type: 'button', defaults: { key: keys.down, pad: padBtns ? ['Down'] : [] } },
  { id: 'left', label: 'Left', type: 'button', defaults: { key: keys.left, pad: padBtns ? ['Left'] : [] } },
  { id: 'right', label: 'Right', type: 'button', defaults: { key: keys.right, pad: padBtns ? ['Right'] : [] } },
];
const P1 = { a: ['KeyX'], b: ['KeyZ'], select: ['ShiftRight'], start: ['Enter', 'NumpadEnter'], up: ['ArrowUp'], down: ['ArrowDown'], left: ['ArrowLeft'], right: ['ArrowRight'] };
const P2 = { a: ['KeyG'], b: ['KeyF'], select: ['KeyR'], start: ['KeyT'], up: ['KeyI'], down: ['KeyK'], left: ['KeyJ'], right: ['KeyL'] };
const NOKEYS = { a: [], b: [], select: [], start: [], up: [], down: [], left: [], right: [] };
const MAT_KEYS = ['Digit1', 'Digit2', 'Digit3', 'Digit4', 'KeyQ', 'KeyW', 'KeyE', 'KeyR', 'KeyA', 'KeyS', 'KeyD', 'KeyF'];

export const manifest = {
  api: '1.0', id: 'nes', label: 'NES', form: 'console', build: 'play/nes/CORE-VERSION.json', thread: 'main',
  files: {
    game: { exts: ['.nes', '.unf', '.unif', '.fds'], maxBytes: 16 * 1024 * 1024 },
    firmware: [{ id: 'fds', label: 'Famicom Disk System boot firmware', bytes: FDS_BIOS_BYTES, required: 'media:fds' }],
  },
  /* Only a disk needs the drive's firmware; a cartridge never asks for it. */
  firmwareFor: bytes => (isDiskImage(bytes) ? ['fds'] : []),
  /* A disk's save is put in place before the drive powers on (the old page mounted the
     saved image itself, so its state identity is the saved image's: kept identical). */
  preloadBatteryFor: bytes => (isDiskImage(bytes) ? ['disk'] : []),
  /* A disk of a game that shipped on several: the other disks, asked for by hash before the
     load (host.mjs), and passed as req.companions { sha256: bytes }. */
  companionsFor: bytes => { const s = setOfBytes(bytes); if (!s) return []; const own = hex(sha256(bytes));
    return s.members.filter(h => h !== own).map(h => ({ id: 'x' + h.slice(0, 12), sha256: h })); },
  video: { kind: 'raster', maxWidth: NES_W, maxHeight: NES_H, screens: 1 },
  audio: { channels: 1, format: 's16', filtered: false },
  state: { supported: true, deterministic: true, approxBytes: 320000 },
  extensions: ['options', 'media', 'accessory', 'cabinet', 'microphone', 'tape', 'recorder'],
  modelLabel: () => 'NES',
  /* The old page's stores (play/nes/app.js), read in place; battery and disk saves are
     also written there, in its own record shapes, so switching back loses nothing. */
  legacy: {
    db: 'nes-play', version: 1, store: 'carts',
    batteryKey: (game, bytes, id) => { if (id !== 'disk') return 'sram:' + hex(sha256(bytes)); const s = setOfBytes(bytes);
      return s ? 'fds-set-save:' + s.id : 'fds-save:' + hex(sha256(new Uint8Array(headerless(bytes)))); },
    batteryJournal: (key, id) => (id === 'sram' ? 'nes-sram-journal:' + key.slice(5) : null),
    journalEncode: (id, bytes) => JSON.stringify({ format: 'nes-sram-1', savedAt: new Date().toISOString(), size: bytes.length, b64: toB64(bytes) }),
    journalDecode: (id, text) => { try { const j = JSON.parse(text); return j.format === 'nes-sram-1' && typeof j.b64 === 'string' ? fromB64(j.b64) : null; } catch (_) { return null; } },
    batteryWrap(id, bytes, gameBytes) {
      if (id === 'sram') return { format: 'nes-sram-1', sha: hex(sha256(gameBytes)), size: bytes.length, mapper: null, label: '', savedAt: new Date().toISOString(), bytes };
      const set = setOfBytes(gameBytes);
      if (set) return { format: 'nes-fds-set-save-1', set: set.id, size: bytes.length, savedAt: new Date().toISOString(), bytes };
      const orig = headerless(gameBytes);
      if (bytes.length !== orig.length) return null;
      const sides = [];
      for (let k = 0; k * FDS_SIDE_BYTES < bytes.length; k++) {
        const a = k * FDS_SIDE_BYTES, b = a + FDS_SIDE_BYTES;
        for (let i = a; i < b; i++) if (bytes[i] !== orig[i]) { sides.push({ side: k, bytes: bytes.slice(a, b) }); break; }
      }
      return { format: 'nes-fds-save-1', sha: hex(sha256(new Uint8Array(orig))), label: '', savedAt: new Date().toISOString(), sides };
    },
    batteryUnwrap(id, rec, gameBytes) {
      if (id === 'sram') return rec && rec.format === 'nes-sram-1' && rec.bytes ? new Uint8Array(rec.bytes) : null;
      if (rec && rec.format === 'nes-fds-set-save-1') { const b = rec.bytes instanceof Uint8Array ? rec.bytes : new Uint8Array(rec.bytes || []); return b.length === rec.size ? b : null; }
      if (!rec || rec.format !== 'nes-fds-save-1' || !Array.isArray(rec.sides)) return null;
      const img = new Uint8Array(headerless(gameBytes));
      for (const sd of rec.sides) {
        const b = sd.bytes instanceof Uint8Array ? sd.bytes : new Uint8Array(sd.bytes || []);
        if (b.length !== FDS_SIDE_BYTES || (sd.side + 1) * FDS_SIDE_BYTES > img.length) return null;
        img.set(b, sd.side * FDS_SIDE_BYTES);
      }
      return img;
    },
    firmware: { fds: { key: 'bios:fds', from: 'user' } },   // a file the person chose on the old page
  },
};
const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
function toB64(b) { let o = ''; for (let i = 0; i < b.length; i += 3) { const n = (b[i] << 16) | ((b[i + 1] ?? 0) << 8) | (b[i + 2] ?? 0);
  o += B64[(n >> 18) & 63] + B64[(n >> 12) & 63] + (i + 1 < b.length ? B64[(n >> 6) & 63] : '=') + (i + 2 < b.length ? B64[n & 63] : '='); } return o; }
function fromB64(t) { const c = t.replace(/[^A-Za-z0-9+/]/g, ''), out = new Uint8Array(Math.floor(c.length * 3 / 4)); let o = 0, acc = 0, bits = 0;
  for (let i = 0; i < c.length; i++) { acc = (acc << 6) | B64.indexOf(c[i]); bits += 6; if (bits >= 8) { bits -= 8; out[o++] = (acc >> bits) & 0xFF; } } return out.subarray(0, o); }

export async function create(env) {
  const base = new URL('../../nes/', import.meta.url);
  const r = await fetch(new URL('build/nes.wasm', base), { cache: 'no-store' });
  if (!r.ok) throw new CoreError('unsupported', `the NES core did not load (HTTP ${r.status})`);
  const wasm = new Uint8Array(await r.arrayBuffer());
  /* Compiled once, instantiated ahead: Chrome refuses a synchronous compile or instance
     of a module this size on the main thread, and load() is synchronous. A fresh
     instance per cartridge, as the old page made (its bump allocator never frees). */
  const mod = await WebAssembly.compile(wasm);
  const fresh = async () => { const inst = await WebAssembly.instantiate(mod, {}); const c = new NesCore(inst); c._coreBytes = wasm; return c; };
  let spare = await fresh();
  const refill = () => { fresh().then(c => { spare = c; }, () => {}); };
  let stamp = null;
  try { const s = await fetch(new URL('CORE-VERSION.json', base), { cache: 'no-store' }); if (s.ok) stamp = await s.json(); } catch (_) {}

  let nes = null, req = null, cart = null, disk = false, region = 0, timing = REGION_TIMING[0];
  /* CHEATS (2026-10-26): only on a build with the cheat calls (nes_cheat_slots); the
     table is pushed again after a power-cycle Reset builds a new machine (cheats-core.mjs). */
  let cheat = null;
  const cheatEng = () => {
    if (cheat || !nes || !has('nes_cheat_slots')) return cheat;
    cheat = cheatEngine({
      kinds: ['nes-gg', 'nes-raw', 'nes-par', 'ra-mem'],
      token: () => nes,
      slots: nes.x.nes_cheat_slots(nes.ctx) | 0,
      setSlot: (i, a, v, c) => nes.x.nes_cheat_set(nes.ctx, i, a, v, c),
      clear: () => nes.x.nes_cheat_clear(nes.ctx),
      poke: (a, v) => { if (a < 0 || a >= 0x8000) return false; nes.x.nes_poke_cpu(nes.ctx, a, v); return true; },
      peek: a => nes.x.nes_peek(nes.ctx, a & 0xffff),
    });
    return cheat;
  };
  let dev = 0, detected = 0, devSource = 'none', vs = null, vsLut = null, fdsPending = null, diskSaved = null;
  let mic = false, kbAttached = false, note = '', tape = null, karaoke = false;
  /* The Data Recorder: drTitle = this cartridge uses it; drBuiltIn = Family BASIC (the
     keyboard is always plugged in); drLive = the tape in the deck, kept across a power cycle as a
     real cassette stays in its deck; drRec = the blank tape lent for RECORD. */
  const DR_EMPTY = { pcm: null, rate: 0, name: '' };
  let drTitle = false, drBuiltIn = false, drLive = DR_EMPTY, drRec = null;
  let auto = null, autoOn = true, diskSet = null;       // the automatic disk change, the mounted set
  const ins = new Map();                    // port -> latest InputState
  const zap = { x: -1, y: -1, down: false, relFrame: -1e9, lastPtr: '' };
  const vaus = { knob: 0xA4 };
  const kbHeld = new Map();                 // code -> matrix place
  let coinPrev = 0, lastMat = 0, coinsIn = 0, sramTouched = false, flipPrev = false, accPad2 = 0;
  let audioBuf = new Int16Array(8192), audioN = 0;
  let rob = null;                           // R.O.B. when the controller in force is one of his
  let acc = null;                           // theexpansion accessory in force (accessories.mjs)
  const theAccessory = () => acc;           // for periphStep, whose own `acc` is port 4's input
  /* The accessory follows the controller in force, like R.O.B.; a new one each time it changes. */
  function accSync() {
    const want = !disk && nes && isAccessory(dev) && has('nes_set_expansion_device') ? dev : 0;
    if (!want) { acc = null; return; }
    if (!acc || acc.dev !== want || acc.nes !== nes) acc = new Accessory(want, nes, { fps: timing.fps });
    if (/does not have yet/.test(note) || !note) note = accHelp(want);
  }
  /* R.O.B. follows the controller in force (the input table's $1F Gyromite, $2E Stack-Up, or the
     player's Controller choice); kept across a reset, as the toy stays where it stood. */
  function robSync() {
    const kind = disk ? null : robKindOf(dev);
    if (!kind) { rob = null; return; }
    if (!rob || rob.kind !== kind) rob = new Rob(kind, timing.fps);
    if (/does not have yet/.test(note)) note = '';
  }
  const has = n => !!(nes && nes.x && typeof nes.x[n] === 'function');

  function applyDevice(d) {
    dev = d;
    if (has('nes_set_expansion_device') && !disk) nes.setExpansionDevice(d);
    accSync();                               // expansion accessories
  }
  const isZapper = () => (dev === 0x08 || dev === 0x09 || dev === 0x0A) && has('nes_set_zapper');   // $0A: the Bandai Hyper Shot's gun
  const isVaus = () => (dev === 0x0F || dev === 0x10 || dev === 0x11) && has('nes_set_vaus');
  const isMat = () => dev >= 0x0B && dev <= 0x0E && has('nes_set_mat');
  const matSideA = () => dev === 0x0B || dev === 0x0D;
  const isFour = () => (dev === 0x02 || dev === 0x03) && has('nes_set_buttons34');
  const vsGun = () => !!(vs && vs.gun);

  let conIds = [];
  function ports() {
    const out = [
      { port: 0, kind: 'player', device: 'nes-pad', label: 'Player 1', controls: pad(P1, true) },
      { port: 1, kind: 'player', device: 'nes-pad', label: 'Player 2', controls: pad(P2, false) },
    ];
    if (isFour()) {
      out.push({ port: 2, kind: 'player', device: 'nes-pad', label: 'Player 3', controls: pad(NOKEYS, false) });
      out.push({ port: 3, kind: 'player', device: 'nes-pad', label: 'Player 4', controls: pad(NOKEYS, false) });
    }
    if (isZapper() || vsGun()) out.push({ port: 4, kind: 'accessory', device: 'zapper', label: 'Zapper', controls: [
      { id: 'trigger', label: 'Trigger', type: 'button', defaults: { key: ['KeyX'] } },
      { id: 'aim-up', label: 'Aim up', type: 'button', defaults: { key: ['ArrowUp'] } },
      { id: 'aim-down', label: 'Aim down', type: 'button', defaults: { key: ['ArrowDown'] } },
      { id: 'aim-left', label: 'Aim left', type: 'button', defaults: { key: ['ArrowLeft'] } },
      { id: 'aim-right', label: 'Aim right', type: 'button', defaults: { key: ['ArrowRight'] } },
      { id: 'aim', label: 'Aim and fire (point at the picture)', type: 'pointer', defaults: {} },
    ] });
    if (isVaus()) out.push({ port: 4, kind: 'accessory', device: 'paddle', label: 'Arkanoid paddle', controls: [
      { id: 'fire', label: 'Fire', type: 'button', defaults: { key: ['KeyX', 'KeyZ'] } },
      { id: 'knob-left', label: 'Turn left', type: 'button', defaults: { key: ['ArrowLeft'] } },
      { id: 'knob-right', label: 'Turn right', type: 'button', defaults: { key: ['ArrowRight'] } },
      { id: 'knob', label: 'Turn (move over the picture)', type: 'pointer', defaults: {} },
    ] });
    if (isMat()) out.push({ port: 4, kind: 'accessory', device: 'mat', label: 'Power Pad', controls:
      MAT_KEYS.map((k, i) => ({ id: 'mat' + (i + 1), label: String(i + 1), type: 'button', defaults: { key: [k] } })) });
    const con = [];
    if (mic) con.push({ id: 'voice', label: 'Microphone (voice)', type: 'hold', defaults: { key: ['KeyM'] } });
    // The Karaoke Studio microphone's own A and B buttons (mapper 188, nes_set_mic); player 1's A / B press them too.
    if (karaoke) { con.push({ id: 'mic-a', label: 'Microphone A button', type: 'hold', defaults: { key: ['KeyV'] } }); con.push({ id: 'mic-b', label: 'Microphone B button', type: 'hold', defaults: { key: ['KeyC'] } }); }
    // The old NES page's one-press Flip (key D): the disk turned over, side A to B and back (2026-10-15).
    if (disk) con.push({ id: 'flip', label: 'Flip disk', type: 'button', defaults: { key: ['KeyD'] } });
    if (vs) {
      con.push({ id: 'coin1', label: 'Coin 1', type: 'button', defaults: { key: isMat() ? [] : ['Digit5'] } });
      con.push({ id: 'coin2', label: 'Coin 2', type: 'button', defaults: { key: isMat() ? [] : ['Digit6'] } });
      con.push({ id: 'service', label: 'Service', type: 'hold', defaults: { key: ['Digit9'] } });
    }
    if (acc) out.push(...acc.ports());        // expansion accessories
    if (con.length) out.push({ port: 5, kind: 'console', device: 'nes-console', label: 'Console', controls: con });
    conIds = con.map(k => k.id);
    if (kbAttached) out.push({ port: 6, kind: 'accessory', device: 'family-keyboard', label: 'Family BASIC keyboard', controls: [
      { id: 'keyboard', label: 'Keyboard (Scroll Lock: typing or controller)', type: 'keyboard', codes: Object.keys(FAMILY_KEYMAP), toggle: 'ScrollLock', defaults: {} },
    ] });
    return out;
  }

  function optionDefs() {
    const o = [];
    if (!disk && has('nes_set_expansion_device')) {
      o.push({ id: 'device', label: 'Controller', type: 'enum', group: 'machine', scope: 'game', live: true, default: 'auto',
        values: [{ v: 'auto', label: `As the game asks (${detected === DEVICE_FAMILY_KEYBOARD && kbAttached ? 'Family BASIC keyboard' : (DEVICES.find(d => d[0] === detected) || [0, 'standard pads'])[1]})` }]
          .concat(DEVICES.map(([d, l]) => ({ v: String(d), label: l }))) });
    }
    if (drTitle && !drBuiltIn) o.push({ id: 'keyboard', label: 'Family BASIC keyboard and Data Recorder', type: 'bool', group: 'machine', scope: 'game', live: true, default: false });
    if (disk) o.push({ id: 'fdsAutoSwap', label: 'Change disks automatically', type: 'bool', group: 'machine', scope: 'global', live: true, default: true });
    if (acc && acc.dev === 0x19) o.push({ id: 'midiIn', label: 'Play the Miracle Piano from a MIDI keyboard (the browser may ask once)', type: 'bool', group: 'machine', scope: 'global', live: true, default: false });   // expansion accessories
    if (vs && has('nes_vs_set_dip')) {
      // The old NES page's two cabinet presets (2026-10-15): the factory DIPs (free play where the
      // cabinet has it) or the coin-play setting; the switches below then show what was set.
      o.push({ id: 'dipPreset', label: 'Cabinet setting', type: 'enum', group: 'cabinet', scope: 'game', live: true, default: 'custom',
        values: [{ v: 'custom', label: 'As the switches below' }, { v: 'factory', label: vs.free ? 'Factory (free play)' : 'Factory' }, { v: 'coin', label: 'Coin play' }] });
      for (let b = 0; b < 8; b++) if (!(vs.dipLocked & (1 << b)))
        o.push({ id: 'dip' + (b + 1), label: `DIP switch ${b + 1}`, type: 'bool', group: 'cabinet', scope: 'game', live: true, default: !!(vs.dipDefault & (1 << b)) });
    }
    return o;
  }

  function vsSetup() {
    const x = nes.x, c = nes.ctx;
    const info = k => (has('nes_vs_info') ? x.nes_vs_info(c, k) : 0);
    vs = { how: info(0), dual: info(10) === 1, gun: info(3) === 7 && has('nes_vs_set_gun'), dipDefault: info(4), dipCoin: info(5), free: info(6), dipLocked: info(13) & 0xff, dip: 0, service: false };
    vs.dip = vs.dipDefault;
    if (has('nes_vs_rgb')) {
      vsLut = new Uint32Array(512);
      for (let v = 0; v < 512; v++) { const rgb = x.nes_vs_rgb(c, v); vsLut[v] = (0xff000000 | ((rgb & 0xff) << 16) | (rgb & 0xff00) | ((rgb >>> 16) & 0xff)) >>> 0; }
    }
    if (vs.dual) note = 'This file is one half of a two-screen VS. DualSystem cabinet, which this emulator does not run.';
    else if (vs.how === 3) note = 'VS. System title with no table entry: the colours may be wrong.';
    else if (!vs.free) note = 'VS. System: this title has no free play. Insert a coin (key 5, or Coin 1 in the bar) to start.';
  }
  function vsSetDip(byte) {
    if (!vs || !has('nes_vs_set_dip')) return;
    vs.dip = ((byte & ~vs.dipLocked) | (vs.dipDefault & vs.dipLocked)) & 0xff;
    nes.x.nes_vs_set_dip(nes.ctx, vs.dip);
  }

  function build(r) {
    const bytes = r.game.bytes;
    disk = isDiskImage(bytes);
    // The spare instance if one is ready, else the current one again (loading twice on one
    // instance is safe: play/nes/web/core.js loadCartridge).
    const n = spare || nes;
    spare = null; refill();
    nes = null;
    ins.clear(); kbHeld.clear(); fdsPending = null; vs = null; vsLut = null; note = ''; coinPrev = 0; audioN = 0;
    zap.x = zap.y = -1; zap.down = false; zap.relFrame = -1e9; vaus.knob = 0xA4;
    try {
      if (disk) {
        const bios = r.firmware && r.firmware.fds;
        if (!bios) throw new CoreError('needs-firmware', 'This is a Famicom Disk System disk. It needs the Disk System’s boot firmware (an 8 KB file), which this site does not have. Add yours with a content pack or a game server in Settings, then open the disk again.');
        if (bios.length !== FDS_BIOS_BYTES) throw new CoreError('needs-firmware', `The Disk System firmware given is ${bios.length} bytes; it must be ${FDS_BIOS_BYTES}.`);
        const saved = r.battery && r.battery.disk;
        /* A game on several disks (web/fds_sets.js, by hash): every disk's sides back to back,
           disk 1 first, so the drive holds the whole set and disk 1 side A boots, as on the
           machine. A disk the site could not find leaves this one in the drive alone. */
        const own = headerless(bytes), set = setOfBytes(bytes), ownSha = set ? hex(sha256(bytes)) : null;
        let orig = own; diskSet = null;
        if (set) {
          const parts = set.members.map(h => (h === ownSha ? own : (r.companions && r.companions[h] ? headerless(r.companions[h]) : null)));
          if (parts.every(Boolean)) {
            orig = new Uint8Array(parts.reduce((a, p) => a + p.length, 0));
            let at = 0; for (const p of parts) { orig.set(p, at); at += p.length; }
            diskSet = set;
          } else note = `This disk is one of ${set.members.length} for ${set.title}, and the others were not found, so it is in the drive alone. Add the other disks to the library to play it.`;
        }
        const mountBytes = saved && saved.length === orig.length ? saved : orig;
        cart = n.loadDiskSystem(bios, mountBytes, REGION.NTSC);
        diskSaved = new Uint8Array(mountBytes);
        n.fdsEject();
        fdsPending = { frame: n.frame + FDS_FIRST_INSERT_FRAMES, side: 0 };
        autoOn = !(r.options && r.options.fdsAutoSwap === false);
        auto = typeof n.x.nes_fds_reads === 'function' ? new FdsAutoSwap(n.x, n.ctx, { disks: diskSet ? diskSet.sides : [n.fdsSides], enabled: autoOn,
          log: m => env.log('info', 'disk: ' + m) }) : null;
      } else {
        cart = n.loadCartridge(bytes, REGION.AUTO);
        diskSaved = null; auto = null; diskSet = null;
      }
    } catch (e) {
      if (e instanceof CoreError) throw e;
      if (e && e.plain) env.log('info', 'refused: ' + String(e.message || e));   // the detail for the log; the player sees the plain sentence
      throw new CoreError('unsupported', (e && e.plain) || String(e && e.message || e));
    }
    nes = n;
    ports();                                   // the console controls' order, for periphStep
    region = nes.region | 0;
    timing = REGION_TIMING[region] || REGION_TIMING[0];
    detected = !disk && has('nes_expansion_device') ? nes.inputDevice : 0;
    devSource = nes.inputSource || (detected ? 'header' : 'none');
    if (!disk && detected === 0x26) { const d2 = deviceFor(detected, hex(sha256(bytes))); if (d2 !== detected) { detected = d2; devSource = 'title'; } }   // expansion accessories
    dev = detected;
    if (!disk && has('nes_set_expansion_device') && dev !== nes.inputDevice) nes.setExpansionDevice(dev);   // expansion accessories
    const want = r.options && r.options.device;
    if (!disk && want && want !== 'auto' && DEVICES.some(d => String(d[0]) === String(want))) applyDevice(+want);
    if (has('nes_vs_active') && nes.x.nes_vs_active(nes.ctx)) {
      vsSetup();
      for (let b = 0; b < 8; b++) { const v = r.options && r.options['dip' + (b + 1)]; if (typeof v === 'boolean') vs.dip = v ? (vs.dip | (1 << b)) : (vs.dip & ~(1 << b)); }
      vsSetDip(vs.dip);
    }
    const con = r.system || 'nes';
    mic = has('nes_set_famicom_mic') && (con === 'famicom' || con === 'fds' || disk);
    // The Study Box (mapper 186): its tape deck, fed a few seconds ahead of the head.
    tape = null;
    if (!disk && cart && cart.mapper === 186 && TapeFeeder.supported(nes)) tape = new TapeFeeder(nes);   // nes.mapper is its own getter (186)
    kbAttached = !!nes.kbAttached;
    if (kbAttached) note = 'Family BASIC keyboard plugged in: type on your keyboard. Scroll Lock switches between typing and the controller.';
    /* The Family BASIC keyboard ($23) is not in the core's port map (nes_input_supported says 0 for
       it): it is its own path (nes_kb_attach), plugged in at power-on, with the pads left in their
       ports as on the Famicom. So $23 with the keyboard attached is supported, not "missing"
       (2026-10-19: Family BASIC's note said standard pads were plugged in instead). */
    const kbDevice = dev === DEVICE_FAMILY_KEYBOARD && kbAttached;
    if (has('nes_input_supported') && dev && !kbDevice && dev !== DEVICE_MULTICART && dev !== DEVICE_DATA_RECORDER && nes.x.nes_input_supported(dev) === 0) note = 'This title wants a controller this emulator does not have yet; standard pads are plugged in instead.';
    // The Data Recorder: Family BASIC, or a game whose program carries a tape routine.
    drBuiltIn = kbAttached && detected === DEVICE_FAMILY_KEYBOARD;
    drTitle = !disk && has('nes_dr_insert') && has('nes_kb_attach') && !!nes.hasDataRecorder && (drBuiltIn || tapeTitle(bytes));
    drRec = null;
    if (drTitle) {
      if (!kbAttached && r.options && r.options.keyboard === true) {
        nes.kbAttach(true); kbAttached = true;
        note = 'Family BASIC keyboard and Data Recorder plugged in. Scroll Lock switches your keys between typing and the controller.';
      }
      if (drLive.pcm && nes.drInsert(drLive.pcm, drLive.rate)) drLive = DR_EMPTY;
    } else drLive = DR_EMPTY;
    robSync();                                 // R.O.B.
    karaoke = !disk && cart && cart.mapper === 188 && has('nes_set_mic');   // expansion accessories
    accSync();                                 // expansion accessories
    if (acc && acc.dev === 0x19 && r.options && r.options.midiIn === true) acc.midiOn(true);
  }

  /* After a state load: the keyboard is the one plugged in now (the player's choice, kept
     per game), not the one the state was saved with. The deck's buffers are kept by the core itself
     since core d90068b59d19, which replaced this module's earlier pointer correction. */
  function drAfterLoad() { if (drTitle && nes) nes.kbAttach(kbAttached); }
  const drSeconds = (n, rate) => (rate ? n / rate : 0);
  function drStatus() {
    if (!drTitle || !nes) return null;
    const s = nes.drState, rate = s.rate || drLive.rate || 32000;
    return { keyboard: kbAttached, builtIn: drBuiltIn, tape: drLive.pcm ? drLive.name || 'Tape' : null, mode: s.mode,
      head: drSeconds(s.head, rate), length: drSeconds(drLive.pcm ? drLive.pcm.length : 0, rate), recorded: drSeconds(s.recorded, rate),
      ended: s.ended, full: s.overflow > 0, blank: DR_BLANK_SECONDS };
  }

  /* Once per frame, beside the pads: the peripherals (play/nes/app.js periphStep). */
  function periphStep() {
    const x = nes.x, c = nes.ctx;
    const acc = ins.get(4) || { buttons: 0 };
    if (isZapper() || vsGun()) {
      const p = acc.pointer;
      const sig = p ? `${p.x},${p.y}` : '';
      if (p && sig !== zap.lastPtr) { zap.lastPtr = sig; if (p.inside) { zap.x = Math.floor(p.x * 256); zap.y = Math.floor(p.y * 240); } else { zap.x = zap.y = -1; } }
      const aim = acc.buttons >> 1;                         // up 1, down 2, left 4, right 8
      if (aim) {
        if (zap.x < 0) { zap.x = 128; zap.y = 120; }
        if (aim & 1) zap.y = Math.max(0, zap.y - 3);
        if (aim & 2) zap.y = Math.min(239, zap.y + 3);
        if (aim & 4) zap.x = Math.max(0, zap.x - 3);
        if (aim & 8) zap.x = Math.min(255, zap.x + 3);
      }
      const down = !!(acc.buttons & 1) || !!(p && p.buttons & 1) || (dev === 0x0A && !!((ins.get(0) || { buttons: 0 }).buttons & 1));   // expansion accessories
      if (down && zap.x < 0) { zap.x = 128; zap.y = 120; }
      if (zap.down && !down) zap.relFrame = nes.frame;
      zap.down = down;
      const trig = zap.down || (nes.frame - zap.relFrame) < ZAP_HOLD_FRAMES ? 1 : 0;
      if (isZapper()) x.nes_set_zapper(c, 1, zap.x | 0, zap.y | 0, trig);   // the Zapper on port two: what $08 means
      if (vsGun()) x.nes_vs_set_gun(c, zap.x | 0, zap.y | 0, trig);
    }
    if (isVaus()) {
      const p = acc.pointer;
      if (p && p.inside) vaus.knob = Math.round(VAUS_MIN + Math.max(0, Math.min(1, p.x)) * (VAUS_MAX - VAUS_MIN));
      if (acc.buttons & 2) vaus.knob = Math.max(VAUS_MIN, vaus.knob - 3);
      if (acc.buttons & 4) vaus.knob = Math.min(VAUS_MAX, vaus.knob + 3);
      x.nes_set_vaus(c, vaus.knob & 0xff, ((acc.buttons & 1) || (p && p.buttons & 1)) ? 1 : 0);
    }
    if (isMat()) {
      let m = 0;
      for (let cell = 0; cell < 12; cell++) if (acc.buttons & (1 << cell)) { const row = (cell / 4) | 0, col = cell % 4; m |= 1 << (row * 4 + (matSideA() ? 3 - col : col)); }
      x.nes_set_mat(c, m & 0xfff);
      lastMat = m & 0xfff;
    }
    const con = ins.get(5) || { buttons: 0 };
    const bit = id => { const i = conIds.indexOf(id); return i >= 0 && !!(con.buttons & (1 << i)); };
    if (mic) x.nes_set_famicom_mic(c, bit('voice') ? 1 : 0);
    if (karaoke) { const p1 = (ins.get(0) || { buttons: 0 }).buttons; x.nes_set_mic(c, 3 & ~((bit('mic-a') || (p1 & 1) ? 1 : 0) | (bit('mic-b') || (p1 & 2) ? 2 : 0))); }   // idle 3, a pressed button reads 0
    { const a = theAccessory(); accPad2 = a ? a.step(ins) : 0; }   // (here `acc` is the accessory port's input)
    if (disk) {
      const f = bit('flip');
      if (f && !flipPrev && !fdsPending && nes.fdsSides > 1) {
        const cur = nes.fdsInserted ? nes.fdsSide : 0, next = Math.min(nes.fdsSides - 1, cur ^ 1);
        nes.fdsEject(); fdsPending = { frame: nes.frame + FDS_SWAP_GAP_FRAMES, side: next }; if (auto) auto.reset(); env.emit('media');
      }
      flipPrev = f;
    }
    if (vs) {
      const coins = (bit('coin1') ? 1 : 0) | (bit('coin2') ? 2 : 0);
      if (has('nes_vs_coin')) { if ((coins & 1) && !(coinPrev & 1)) { x.nes_vs_coin(c, 0); coinsIn++; } if ((coins & 2) && !(coinPrev & 2)) { x.nes_vs_coin(c, 1); coinsIn++; } }
      coinPrev = coins;
      if (has('nes_vs_set_service')) x.nes_vs_set_service(c, bit('service') ? 1 : 0);
    }
    if (kbAttached) {
      const want = new Set(((ins.get(6) || {}).keys) || []);
      for (const [code, p] of kbHeld) if (!want.has(code)) { kbHeld.delete(code); if (![...kbHeld.values()].includes(p)) nes.kbKey(p[0], p[1], p[2], 0); }
      for (const code of want) if (!kbHeld.has(code) && FAMILY_KEYMAP[code]) { const p = FAMILY_KEYMAP[code]; kbHeld.set(code, p); nes.kbKey(p[0], p[1], p[2], 1); }
    }
  }

  function drainAudio() {
    const from = audioN;                     // theMiracle Piano's synthesizer adds to what the console made
    for (let k = 0; k < 4; k++) {
      const s = nes.readAudio(4096);
      if (!s.length) break;
      if (audioN + s.length > audioBuf.length) { const nb = new Int16Array(Math.max(audioBuf.length * 2, audioN + s.length)); nb.set(audioBuf.subarray(0, audioN)); audioBuf = nb; }
      audioBuf.set(s, audioN); audioN += s.length;
    }
    if (acc && acc.synth) acc.mix(audioBuf, from, audioN - from, timing.cpu / 40);
  }
  function fdsImage() {
    if (!disk || !nes) return null;
    const p = has('nes_fds_image') ? nes.x.nes_fds_image(nes.ctx) : nes.pDisk;
    const n = has('nes_fds_image_size') ? nes.x.nes_fds_image_size(nes.ctx) : nes.diskBytes;
    return p && n ? nes.u8.subarray(p, p + n) : null;
  }
  /* Mid-write: the motor on and the head writing (not in read mode) -- play/nes/app.js
     fdsMidWrite. A disk save is taken at any other moment, as the old page took it. */
  const fdsMidWrite = () => { if (!has('nes_fds_state')) return false; const st = nes.x.nes_fds_state(nes.ctx); return !!((st & 1) && !(st & 4)); };

  const audioView = { data: audioBuf, frames: 0 };
  const core = {
    info: { build: stamp && stamp.sha256 ? stamp.sha256 : null, abi: stamp && stamp.abiVersion },
    load(r) {
      req = r;
      drLive = DR_EMPTY;                      // a new cartridge: the deck is empty
      rob = null;                             // and R.O.B. starts at rest
      build(r);
      const bat = [];
      if (!disk && nes.batterySize) bat.push({ id: 'sram', kind: 'sram', bytes: nes.batterySize, ext: '.sav' });
      if (disk && has('nes_fds_dirty')) bat.push({ id: 'disk', kind: 'disk', bytes: nes.diskBytes || headerless(r.game.bytes).length, ext: '.fds' });
      if (acc) bat.push(...acc.battery());     // theTurbo File / Battle Box
      return {
        fps: timing.fps,
        video: { width: NES_W, height: NES_H, format: 'index16', pixelAspect: 8 / 7, rotation: 0, palette: vsLut || LUT },
        audio: { rate: timing.cpu / 40 },
        ports: ports(), battery: bat, options: optionDefs(),
        extensions: { options: true, media: disk, accessory: !disk && has('nes_set_expansion_device'), cabinet: !!vs, microphone: !!mic, tape: !!tape, recorder: drTitle, rob: rob ? rob.kind : null, barcode: !disk && (!!(nes && nes.hasBarcode) || !!(acc && acc.hasBarcode)) },   // microphone: the controller II mic ('voice'), host's Microphone item
        model: 'nes', note,
        system: disk ? 'fds' : (r.system || 'nes'),
        usedFirmware: disk ? 'fds' : null,
        facts: { mapper: cart.mapper, nes2: !!cart.nes2, region: ['NTSC', 'PAL', 'Dendy'][region], device: dev, deviceSource: devSource, vs: !!vs, disk, sides: disk ? nes.fdsSides : 0, diskSet: diskSet ? diskSet.id : null },
      };
    },
    reset(kind) {
      if (kind === 'soft' && nes) { nes.reset(); return; }
      const keepSram = nes && !disk && nes.batterySize ? nes.batterySave() : null;
      const keepDisk = disk ? new Uint8Array(fdsImage()) : null;
      build(Object.assign({}, req, { battery: Object.assign({}, req.battery || {}, keepDisk ? { disk: keepDisk } : {}) }));
      if (keepSram) nes.batteryLoad(keepSram);
    },
    setInput(port, s) { ins.set(port, s); },
    runFrame() {
      if (!nes || !nes.ctx) return;
      nes.setButtons(0, (ins.get(0) || { buttons: 0 }).buttons & 0xff);
      nes.setButtons(1, ((ins.get(1) || { buttons: 0 }).buttons | (rob ? rob.pad2() : 0)) & 0xff);   // thegyro trays press controller two
      if (has('nes_set_buttons34')) { nes.setButtons34(0, isFour() ? (ins.get(2) || { buttons: 0 }).buttons & 0xff : 0); nes.setButtons34(1, isFour() ? (ins.get(3) || { buttons: 0 }).buttons & 0xff : 0); }
      periphStep();
      if (accPad2) nes.setButtons(1, ((ins.get(1) || { buttons: 0 }).buttons | accPad2 | (rob ? rob.pad2() : 0)) & 0xff);   // two pads, one player
      if (tape) tape.tick();
      nes.runFrame();
      if (cheat) cheat.frame();
      if (rob) rob.step(nes.framebuffer(), vsLut || LUT);   // R.O.B.'s eye on the picture
      if (fdsPending && nes.frame >= fdsPending.frame) { nes.fdsInsert(fdsPending.side); fdsPending = null; env.emit('media'); }
      else if (auto && !fdsPending) {
        const side = auto.step(nes.framebuffer());
        if (side !== null) { nes.fdsEject(); fdsPending = { frame: nes.frame + FDS_SWAP_GAP_FRAMES, side }; env.emit('media'); }
      }
      drainAudio();
      if (nes.jammed && !this._jamTold) { this._jamTold = true; env.log('warn', 'the CPU jammed (a KIL opcode); a fault for the core if it is the core\'s'); }
    },
    video() { return { format: 'index16', width: NES_W, height: NES_H, stride: NES_W, data: nes.framebuffer(), palette: vsLut || LUT }; },
    audio() { audioView.data = audioBuf; audioView.frames = audioN; audioN = 0; return audioView; },
    serialize() { return nes.saveState(); },
    unserialize(b) {
      try { nes.loadState(b instanceof Uint8Array ? b : new Uint8Array(b)); }
      catch (e) {
        const m = String(e && e.message || e);
        throw new CoreError(/medium|cartridge|game|disk/i.test(m) ? 'wrong-game' : /core|artefact|build|version/i.test(m) ? 'wrong-core' : 'damaged', m);
      }
      fdsPending = null;
      if (auto) auto.resync();
      drAfterLoad();
    },
    check(b) {
      const keep = nes.saveState();
      core.unserialize(b);
      nes.loadState(keep);
      drAfterLoad();
    },
    /* The old page's Continue history: whole states of this board, equal-sized. */
    legacyHistory(h) {
      if (!h || !h.data || !nes || h.size !== nes.stateSize) return null;
      const out = [];
      for (let i = 0; i < h.n; i++) out.push(h.data.slice(i * h.size, (i + 1) * h.size));
      return out;
    },
    battery: {
      read(id) {
        if (id === 'sram') return nes && nes.batterySize ? nes.batterySave() : null;
        if (id === 'disk') { const img = fdsImage(); return img ? new Uint8Array(img) : null; }
        if (acc && acc.storeId(id) >= 0) return acc.read(id);   // expansion accessories
        return null;
      },
      write(id, b, o) {
        // asGame (a test writing as the game would): the core's own dirty mark is not set by a
        // load, so the module remembers it until the host has saved it (clean()).
        if (id === 'sram') { const ok = nes.batteryLoad(b); if (ok) { if (o && o.asGame) sramTouched = true; else nes.batteryClean(); } return ok; }
        if (id === 'disk') { const img = fdsImage(); if (!img || img.length !== b.length) return false; img.set(b); if (!(o && o.asGame)) diskSaved = new Uint8Array(b); return true; }
        if (acc && acc.storeId(id) >= 0) return acc.write(id, b);   // expansion accessories
        return false;
      },
      dirty() {
        const out = [];
        if (nes && !disk && nes.batterySize && (nes.batteryDirty || sramTouched)) out.push('sram');
        if (acc) out.push(...acc.dirty());      // expansion accessories
        if (disk && diskSaved && !fdsMidWrite()) {
          const img = fdsImage();
          if (img && img.length === diskSaved.length) { for (let i = 0; i < img.length; i++) if (img[i] !== diskSaved[i]) { out.push('disk'); break; } }
        }
        return out;
      },
      clean(id) {
        if (id === 'sram' && nes) { nes.batteryClean(); sramTouched = false; }
        if (acc) acc.clean(id);                 // expansion accessories
        if (id === 'disk') { const img = fdsImage(); if (img) diskSaved = new Uint8Array(img); }
      },
    },
    setOption(id, v) {
      if (id === 'device') {
        const wasRob = rob ? rob.kind : null;   // R.O.B.
        const wasBox = !!(acc && acc.battery().length);   // expansion accessories
        applyDevice(v === 'auto' ? detected : +v);
        if (req) req.options.device = v;
        if ((robKindOf(dev) || null) !== wasRob) return 'reload';
        if (wasBox !== !!(acc && acc.battery().length)) return 'reload';   // a save box plugged in or out   // R.O.B. plugged in or out: the window gains or loses him
        return 'ports';
      }
      if (id === 'keyboard' && drTitle && !drBuiltIn) {
        const on = !!v;
        if (!on && nes.drState.mode !== 'stop') nes.drStop();
        nes.kbAttach(on); kbAttached = on; kbHeld.clear();
        if (req) req.options.keyboard = on;
        return 'ports';
      }
      if (id === 'midiIn') { if (acc) acc.midiOn(!!v); if (req) req.options.midiIn = !!v; return 'live'; }   // expansion accessories
      if (id === 'fdsAutoSwap') { autoOn = !!v; if (auto) { auto.enabled = autoOn; auto.reset(); } if (req) req.options.fdsAutoSwap = autoOn; return 'live'; }
      if (id === 'dipPreset' && vs) {
        if (v === 'factory' || v === 'coin') {
          vsSetDip(v === 'factory' ? vs.dipDefault : vs.dipCoin);
          for (let b = 0; b < 8; b++) if (!(vs.dipLocked & (1 << b))) env.emit('option', { id: 'dip' + (b + 1), v: !!(vs.dip & (1 << b)) });
          env.emit('options');
        }
        return 'live';
      }
      const m = /^dip(\d)$/.exec(id);
      if (m && vs) { const b = +m[1] - 1; vsSetDip(v ? (vs.dip | (1 << b)) : (vs.dip & ~(1 << b))); if (req) req.options[id] = !!v; return 'live'; }
      return 'unknown';
    },
    options: optionDefs,
    ports,
    details() { if (!nes || !cart) return ''; return `NES core abi ${nes.abi} · ${disk ? 'Disk System, ' + nes.fdsSides + ' sides' + (diskSet ? ' (' + diskSet.members.length + ' disks)' : '') : 'mapper ' + cart.mapper + (cart.nes2 ? ' (NES 2.0)' : '')} · ${['NTSC', 'PAL', 'Dendy'][region] || region} ${timing.fps.toFixed(4)} Hz · context ${(nes.x.nes_sizeof_context() / 1024).toFixed(0)} KiB · controller ${dev} (${devSource}) · artifact ${stamp && stamp.sha256 ? stamp.sha256.slice(0, 12) : 'unstamped'}`; },
    get model() { return 'nes'; },
    get note() { return note; },
    get frames() { return nes ? nes.frame : 0; },
    ext: {
      /* Cheats: the kinds this build runs ([] before the cheat build is installed) and the codes switched on. */
      cheats: {
        kinds: () => { const e = cheatEng(); return e ? e.kinds() : []; },
        apply: codes => { const e = cheatEng(); return e ? e.apply(codes) : { ok: false, why: 'This player has no cheat support yet.' }; },
      },
      /* The Datach barcode reader (extension 'barcode'): the host's Barcode reader item. */
      barcode: { busy: () => (acc && acc.hasBarcode ? acc.barcodeBusy() : !!(nes && nes.datachBusy)), scan: d => (acc && acc.hasBarcode ? acc.barcodeScan(d) : !!(nes && nes.datachScan(d))) },   // Barcode World too
      /* The Study Box tape (extension 'tape'): the host's Tape item lists, inserts and ejects. */
      tape: {
        status: () => (tape ? tape.status() : null),
        insert: src => (tape ? tape.insert(src) : Promise.reject(new Error('This cartridge has no tape deck.'))),
        eject: () => { if (tape) tape.eject(); },
      },
      media: {
        list: () => (disk && nes ? Array.from({ length: nes.fdsSides }, (_, i) => ({ id: String(i), label: sideName(i), kind: 'disk-side' })) : []),
        current: () => (disk && nes ? (fdsPending ? null : (nes.fdsInserted ? String(nes.fdsSide) : null)) : null),
        pending: () => (fdsPending ? String(fdsPending.side) : null),
        label: () => (!disk || !nes ? '' : fdsPending ? 'Changing disk' : nes.fdsInserted ? sideName(nes.fdsSide) : 'No disk'),
        insert(id) {
          const side = +id;
          if (!disk || !nes || fdsPending || !(side >= 0 && side < nes.fdsSides)) return false;
          nes.fdsEject();
          fdsPending = { frame: nes.frame + FDS_SWAP_GAP_FRAMES, side };
          if (auto) auto.reset();
          env.emit('media');
          return true;
        },
        eject() { if (disk && nes && !fdsPending) { nes.fdsEject(); env.emit('media'); } },
      },
      /* The Famicom Data Recorder (extension 'recorder'): the host's Data Recorder item. */
      recorder: {
        status: drStatus,
        load(bytes, name) {
          if (!drTitle || !nes) throw new Error('This cartridge has no Data Recorder.');
          const t = decodeTape(bytes);
          return this.loadPcm(t.pcm, t.rate, name);
        },
        loadPcm(pcm, rate, name) {
          if (!drTitle || !nes) throw new Error('This cartridge has no Data Recorder.');
          if (!pcm || !pcm.length) throw new Error('This tape is empty.');
          if (pcm.length > DR_MAX_SAMPLES) throw new Error('This tape is longer than the deck takes.');
          if (nes.drState.mode === 'record') nes.drStop();
          if (nes.drInsert(pcm, rate)) throw new Error('The deck refused this tape.');
          drLive = { pcm, rate, name: String(name || '') };
          return { seconds: pcm.length / rate };
        },
        play: () => (drTitle && nes && drLive.pcm ? nes.drPlay() === 1 : false),
        stop: () => { if (drTitle && nes) nes.drStop(); },
        rewind: () => { if (drTitle && nes) { nes.drStop(); nes.drSeek(0); } },
        eject: () => { if (drTitle && nes) { nes.drEject(); drLive = DR_EMPTY; } },
        /* RECORD onto a new blank tape: the inserted tape is never written over. */
        record() {
          if (!drTitle || !nes || !kbAttached) return false;
          const rate = drLive.pcm ? drLive.rate : 32000;
          if (nes.drBlank(DR_BLANK_SECONDS, rate)) throw new Error('The deck could not make a blank tape.');
          drRec = { cap: Math.max(1, Math.round(DR_BLANK_SECONDS * rate)), rate };
          return nes.drRecord() === 2;
        },
        /* What RECORD made, copied out ({ pcm, rate }), or null. */
        recording() { if (!drTitle || !nes || !drRec) return null; const pcm = nes.drRecording(); return pcm.length ? { pcm, rate: drRec.rate } : null; },
        wav: (pcm, rate) => encodeWav(pcm, rate),
      },
      /* R.O.B.: his state for the host's 3D view and the bar; the commands as they start
         (onCommand), a hand on controller two's A or B for a stuck game, the gyros put back. */
      rob: {
        status: () => (rob ? rob.status() : null),
        onCommand: fn => { if (rob) rob.onCommand = fn; },
        hold: (bits, on) => { if (rob) rob.override = on ? (rob.override | bits) : (rob.override & ~bits); },
        resetGyros: () => { if (rob) rob.resetGyros(); },
        trays: bits => { if (rob) rob.trays = bits & 3; },   // the3D gyro trays' A / B (blue / red cap)
      },
      /* Read-only diagnostics for the gate (the build plan, Phase 4). */
      debug: { periph: () => ({ device: dev, detected, zapper: isZapper(), zap: { x: zap.x, y: zap.y, down: zap.down }, vaus: isVaus() ? vaus.knob : null,
        mat: isMat() ? lastMat : null, four: isFour(), vs: vs ? { dip: vs.dip, locked: vs.dipLocked, coinsIn } : null, mic, keyboard: kbAttached,
        recorder: drTitle ? nes.drState : null,
        fdsPending: fdsPending ? Object.assign({}, fdsPending) : null, acc: acc ? acc.debug() : null, karaoke }) },
      /* Where the light gun is aimed (0..1), for the host's crosshair; null when none. */
      /* The button a controller has chosen on an accessory's panel (the mahjong keypad), for the host. */
      panelCursor: () => (acc ? acc.panelCursor() : -1),
      crosshair: () => ((isZapper() || vsGun()) && zap.x >= 0 ? { x: (zap.x + 0.5) / 256, y: (zap.y + 0.5) / 240 } : (acc ? acc.crosshair() : null)),
    },
    get raw() { return nes; },
    destroy() { nes = null; },
  };
  return core;
}
