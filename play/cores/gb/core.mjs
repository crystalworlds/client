/*
 * play/cores/gb/core.mjs -- Game Boy / Game Boy Color for the one play host (Core API 1.0).
 *
 * Wraps the vendored development-tree files in play/gameboy/web/ (GBHost, GBMachine, the GBST
 * state container, the audio pull) and the site's Color modules beside them
 * (cgb-assign.js, cgb-boot.js, cgb-palettes.js). Nothing there is edited: this module
 * only calls what they publish. No DOM, no storage, no timers, no Date.now().
 *
 * WHICH MACHINE, from the cartridge (header $0143) and the Machine choice:
 *   - a Color-only cartridge needs the player's own Color boot program (CoreError
 *     'needs-firmware' otherwise, never a DMG that shows its own refusal screen);
 *   - a Color-enhanced cartridge runs as a Color when that program is present, unless the
 *     player chose the Game Boy for those games;
 *   - an original cartridge runs on the Game Boy, unless the player chose the Color: then a
 *     Color machine booted by our own stub (cgb-boot.js), which writes the console's palette
 *     assignment into palette RAM: no Nintendo program needed.
 * The model ('dmg' / 'cgb') is reported in LoadResult.model, and the host keys saves
 * by it: a Game Boy and a Game Boy Color are two consoles (decided 2026-10-03).
 */
import { GBHost, FRAME_HZ, SCREEN_W, SCREEN_H, BTN } from '../../gameboy/web/core.js';
import { CoreAudioSource, coreHasAudio, discardCoreAudio } from '../../gameboy/web/audio.js';
import { PALETTES, DEFAULT_PALETTE, saveState, stateHeader, cartFingerprint,
         STATE_HEADER, STATE_MAGIC, STATE_VERSION, STATE_FLAG_BIOS } from '../../gameboy/web/shell.js';
import { cgbAssignmentFor, cgbAppliesTo, cgbConfigName, cgbExplain, cgbDefaultManual } from '../../gameboy/cgb-assign.js';
import { cgbStartup } from '../../gameboy/cgb-boot.js?v=2.3.0';
import { logoLayout, GLYPHS, cartLogoScreen } from '../../gameboy/gb-boot.js?v=2.3.0';
import { CGB_MANUAL } from '../../gameboy/cgb-palettes.js';
import { CoreError } from '../../host/core-api.mjs';
/* 2026-10-24: the extra hardware around the console. The Super Game Boy's SNES side
   (web/sgb.js, vendored from the development tree like the files above), and the shared mode the art reads
   (a wide picture, the Super Game Boy's television or two linked consoles, wears no shell photo). */
import { SuperGameBoy, sgbEnhanced, sgbStateBytes, SGB_W, SGB_H } from '../../gameboy/web/sgb.js';
import { GB_MODE } from './mode.mjs';
/* 25 Oct: the Super Game Boy shelf. Opened with ?console=sgb, the game always plays as on
   a Super Game Boy; the border is the game's own, else Nintendo's default read from the player's own SNES
   program (firmware 'sgb', from the game server; sgb-border.mjs), else plain black; or fan art. */
import { biosBorder, builtinBorders } from './sgb-border.mjs?v=2.3.0';
import { ourSgbBorder } from '../../gameboy/sgb-border-ours.js?v=2.3.0';
import { cheatEngine } from '../cheats-core.mjs?v=2.3.0';
import { TEAL, colourCorrectionTable } from './colour.mjs?v=2.3.0';
import { PANELS, slowScreen } from './lcd.mjs?v=2.3.0';
const ON_SGB_SHELF = (() => { try { return new URLSearchParams(globalThis.location.search).get('console') === 'sgb'; } catch (_) { return false; } })();
const SGB_FANART = 'https://pub-5656d877345d49ae96626afa8d6ebd56.r2.dev';   // sgb-borders: <SHA-1 of the cartridge>.jpg, 1920x1080

/* The Barcode Boy's games (Namcot, 1992; Dan Docs "Barcode Boy"): header title and licensee.
   The two marked `needs` cannot be played without it; the others use it for extras. */
const BARCODE_TITLES = [
  { t: 'BATTLE SPACE', lic: 0xAF, needs: true }, { t: 'MONSTER MAKER', lic: 0xAF, needs: true },
  { t: 'KATTOBI ROAD', lic: 0xAF }, { t: 'FAMILY JOCKEY2', lic: 0x82 }, { t: 'FAMISTA3', lic: 0xAF },
];
/* Every card Dan Docs lists for those games (EAN-13), named as printed, for the card picker. */
const BARCODE_CARDS = {
  'BATTLE SPACE': [['Berserker', '4907981000301'], ['Valkyrie', '4908052808369'], ['Grizzly Bear', '4916911302309'], ['Magic Soldier', '4902776809367'], ['Knight', '4905672306367'], ['Wraith', '4912713004366'], ['Shaman', '4913508504399'], ['Thief', '4918156001351'], ['Sorcerer', '4911826551347'], ['Warrior', '4909062206350']],
  'MONSTER MAKER': [['Archer Lorian', '9998017308336'], ['Archer Elysice', '9447410810323'], ['Knight Lauren', '9052091324955'], ['Dragon Knight Haagun', '9322158686716'], ['Warrior Diane', '9752412234900'], ['Warrior Tamron', '9362462085911']],
  'KATTOBI ROAD': [['Truck', '4902105002063'], ['Sedan', '4901121110004'], ['Racecar', '4903301160625'], ['Street car', '4902888119101'], ['4x4', '4901780161157'], ['F1-style racecar', '4987084410924']],
  'FAMILY JOCKEY2': [['A1', '5893713522816'], ['A2', '2378649896765'], ['A4', '9845554422318'], ['B1', '1509843019075'], ['B2', '4232978865152'], ['B4', '3572821107673'], ['C3', '7164625542390'], ['C5', '6319537443513']],
  'FAMISTA3': [['Home-run batter', '8357933639923'], ['Senior batter', '7814374127798'], ['Swift batter', '9880692151263'], ['Pitcher', '1414213562177']],
};
function headerTitle(bytes) { let t = ''; for (let i = 0x134; i < 0x144; i++) { const c = bytes[i]; if (!c) break; t += String.fromCharCode(c); } return t.trim(); }
export function barcodeTitle(bytes) {
  if (!bytes || bytes.length < 0x150) return null;
  const t = headerTitle(bytes);
  return BARCODE_TITLES.find(b => b.t === t && b.lic === bytes[0x14B]) || null;
}
/* THE WORKBOY (a keyboard that plugs into the link port; never released, its cartridge survives as a
   prototype). Its key codes, as the cartridge's own tables give them (SameBoy's list, which the core's
   workboy.c follows): +64 = the key needs the keyboard's shift, +128 = it needs the shift released. */
const WB_SHIFT_DOWN = 39, WB_SHIFT_UP = 50, WB_NONE = 255;
const WB_CHARS = {
  q: 17, w: 18, e: 19, r: 20, t: 21, y: 22, u: 23, i: 24, o: 25, p: 26, a: 28, s: 29, d: 30, f: 31, g: 32, h: 33, j: 34,
  k: 35, l: 36, z: 40, x: 41, c: 42, v: 43, b: 44, n: 45, m: 46,
  '1': 17 | 64, '2': 18 | 64, '3': 19 | 64, '4': 28 | 64, '5': 29 | 64, '6': 30 | 64, '7': 40 | 64, '8': 41 | 64, '9': 42 | 64, '0': 51 | 64,
  '!': 24 | 64, '~': 25 | 64, '*': 26 | 64, $: 27 | 128, '#': 27 | 64, '+': 31 | 64, '-': 32 | 64, '(': 35 | 64, ')': 36 | 64,
  ';': 37 | 128, ':': 37, '%': 44 | 64, '=': 45 | 64, ',': 47 | 128, '<': 47 | 64, '.': 48 | 128, '>': 48 | 64, '/': 49 | 128,
  '?': 49 | 64, '`': 51, ' ': 52, "'": 53 | 128, '@': 53 | 64,
};
/* the keys that are not characters: F1 to F9 the nine program keys (Clock, Temperature, Money, Calculator,
   Date, Conversion, Record, World, Phone), F10 the key nobody has identified */
const WB_KEYS = { F1: 1, F2: 2, F3: 3, F4: 4, F5: 5, F6: 6, F7: 7, F8: 8, F9: 9, F10: 12, Escape: 10, Backspace: 11, Enter: 38, NumpadEnter: 38,
  ArrowLeft: 13, ArrowUp: 54, ArrowDown: 55, ArrowRight: 56, NumpadDecimal: 43 | 64, NumpadMultiply: 33, NumpadDivide: 34 };
/* a US keyboard: the character a key code types, without and with shift */
const US_KEYS = (() => {
  const m = {};
  for (const ch of 'abcdefghijklmnopqrstuvwxyz') m['Key' + ch.toUpperCase()] = [ch, ch];
  ')!@#$%^&*('.split('').forEach((sh, d) => { m['Digit' + d] = [String(d), sh]; });
  Object.assign(m, { Space: [' ', ' '], Minus: ['-', '_'], Equal: ['=', '+'], BracketLeft: ['[', '{'], BracketRight: [']', '}'], Backslash: ['\\', '|'],
    Semicolon: [';', ':'], Quote: ["'", '"'], Backquote: ['`', '~'], Comma: [',', '<'], Period: ['.', '>'], Slash: ['/', '?'],
    NumpadAdd: ['+', '+'], NumpadSubtract: ['-', '-'] });
  for (let d = 0; d < 10; d++) m['Numpad' + d] = [String(d), String(d)];
  return m;
})();
/* the codes the Workboy takes while it types (Escape stays the play window's own Back key; the on-screen keys have Esc) */
const WB_CODES = Object.keys(US_KEYS).concat(Object.keys(WB_KEYS).filter(k => k !== 'Escape'), ['ShiftLeft', 'ShiftRight']);
/* the on-screen Workboy keys, row by row: [label, key code or character] */
const WB_PANEL = [
  [['Clock', 'F1'], ['Temp', 'F2'], ['Money', 'F3'], ['Calc', 'F4'], ['Date', 'F5'], ['Conv', 'F6'], ['Record', 'F7'], ['World', 'F8'], ['Phone', 'F9'], ['Esc', 'Escape']],
  '1234567890'.split('').map(c => [c, c]),
  'qwertyuiop'.split('').map(c => [c.toUpperCase(), c]),
  'asdfghjkl'.split('').map(c => [c.toUpperCase(), c]).concat([['\u232B', 'Backspace']]),
  'zxcvbnm'.split('').map(c => [c.toUpperCase(), c]).concat([['.', '.'], ['Enter', 'Enter']]),
  [['+', '+'], ['-', '-'], ['*', '*'], ['/', '/'], ['=', '='], ['Space', ' '], ['\u2190', 'ArrowLeft'], ['\u2191', 'ArrowUp'], ['\u2193', 'ArrowDown'], ['\u2192', 'ArrowRight']],
];
function wbCode(k) { return Object.prototype.hasOwnProperty.call(WB_KEYS, k) ? WB_KEYS[k] : Object.prototype.hasOwnProperty.call(WB_CHARS, k) ? WB_CHARS[k] : -1; }
const isWorkboy = bytes => !!bytes && bytes.length >= 0x150 && headerTitle(bytes) === 'WORKBOY';
/* GBS music files (the "GBS" header, version 1) */
const isGbs = b => !!b && b.length > 0x70 && b[0] === 0x47 && b[1] === 0x42 && b[2] === 0x53 && b[3] === 1;
const gbsText = (b, at) => { let t = ''; for (let i = at; i < at + 32 && b[i]; i++) t += String.fromCharCode(b[i]); return t.trim(); };

/* Player 2's keys when a second controller is plugged in on the same keyboard (the NES's
   right-hand half: I J K L, F and G, R and T). Players 3 and 4: controllers only. */
const P2_KEYS = { a: ['KeyG'], b: ['KeyF'], select: ['KeyR'], start: ['KeyT'], right: ['KeyL'], left: ['KeyJ'], up: ['KeyI'], down: ['KeyK'] };
const LINK_GAP = 16;                    // the two linked screens, side by side, this far apart

/* The Mono Palette choices: the four-colour palettes only. A palette changes the picture, never the machine. */
const MONO_PALETTES = Object.assign({}, PALETTES, { teal: TEAL });
function monoLUT(key) {
  const p = (MONO_PALETTES[key] || MONO_PALETTES[DEFAULT_PALETTE]).rgb, l = new Uint32Array(4);
  for (let i = 0; i < 4; i++) l[i] = (0xFF << 24) | (p[i][2] << 16) | (p[i][1] << 8) | p[i][0];
  return l;
}
/* THE MACHINE CHOICES: every model the core builds (gb_set_model). `model` is the core's model number,
   `device` the core's device ('dmg' or 'cgb'), `boot` which of our start-up programs suits it (gb-boot.js).
   Which cartridges are offered which models is decided in one place, machineRows(). */
const MACHINES = {
  gb:     { model: 0,  device: 'dmg', boot: 'dmg', label: 'Game Boy: the original grey Game Boy of 1989' },
  dmg0:   { model: 13, device: 'dmg', boot: 'dmg0', label: 'Game Boy, first model (1989, Japan)' },
  mgb:    { model: 1,  device: 'dmg', boot: 'mgb', label: 'Game Boy Pocket or Light: the smaller 1996 and 1998 models' },
  cgb0:   { model: 3,  device: 'cgb', boot: 'cgb0', label: 'Game Boy Color, first model (1998, Japan)' },
  cgba:   { model: 4,  device: 'cgb', boot: 'cgb', label: 'Game Boy Color, revision A' },
  cgbb:   { model: 5,  device: 'cgb', boot: 'cgb', label: 'Game Boy Color, revision B' },
  cgbc:   { model: 6,  device: 'cgb', boot: 'cgb', label: 'Game Boy Color, revision C' },
  cgbd:   { model: 7,  device: 'cgb', boot: 'cgb', label: 'Game Boy Color, revision D' },
  gbc:    { model: 8,  device: 'cgb', boot: 'cgb', label: 'Game Boy Color, last model' },
  agb:    { model: 9,  device: 'cgb', boot: 'agb', label: 'Game Boy Advance' },
  ags:    { model: 10, device: 'cgb', boot: 'agb', label: 'Game Boy Advance SP or Game Boy Player' },
  sgb:    { model: 2,  device: 'dmg', boot: 'sgb', label: 'Super Game Boy: the 1994 cartridge on an NTSC Super NES' },
  sgbpal: { model: 12, device: 'dmg', boot: 'sgb', label: 'Super Game Boy on a PAL Super NES' },
  sgb2:   { model: 11, device: 'dmg', boot: 'sgb2', label: 'Super Game Boy 2: the 1998 Japanese one, at the handheld’s own speed' },
};
/* the lists, by the kind of cartridge (the first is the default) */
const LIST_ORIG = ['gb', 'dmg0', 'mgb', 'gbc', 'agb', 'ags'];
const LIST_DUAL = ['gbc', 'cgb0', 'cgba', 'cgbb', 'cgbc', 'cgbd', 'agb', 'ags', 'gb', 'dmg0', 'mgb'];
const LIST_COLOUR = ['gbc', 'cgb0', 'cgba', 'cgbb', 'cgbc', 'cgbd', 'agb', 'ags'];
const LIST_SGB = ['sgb', 'sgbpal', 'sgb2'];
/* an original cartridge on the Color or the Advance: what it looks like there */
const ORIG_LABEL = { gbc: 'Game Boy Color: the game in colour, as a Color shows an original cartridge',
  agb: 'Game Boy Advance: as on the Color, with the Advance’s sound' };
const machineValues = (list, dflt, over) => list.map(v => ({ v, label: ((over && over[v]) || MACHINES[v].label) + (v === dflt ? ' (default)' : '') }));
const onColor = v => !!(MACHINES[v] && MACHINES[v].device === 'cgb');
/* (14 Nov) THE MACHINE PLAN, before the game is built: which model will run, the same rules as build() (keep
   the two in step). read(o) is the stored value of option o ({ id, key, scope }, as the host stores it); the host
   asks before the game starts, so each slot can ask for the program of the model that will run (firmwareRole). */
function machinePlan(bytes, read, has) {
  const H = consoleHeader(bytes);   // (20 Nov) the header as the console reads it (a Sachen cartridge's through its chip)
  const r = o => { try { const v = read ? read(o) : null; return v == null || v === '' ? null : String(v); } catch (_) { return null; } };
  const pick = (v, list, d) => (v != null && list.includes(v) ? v : d);
  const flag = cgbFlagOf(H), HAS_SGB = !has || has.sgb !== false, HAS_LINK = !has || has.link !== false;
  const choice = flag === 'dmg' ? pick(r({ id: 'machine', key: 'gb.machine' }), LIST_ORIG, 'gb') : flag === 'cgb-only' ? pick(r({ id: 'machineColour', key: 'gb.machineColour' }), LIST_COLOUR, 'gbc')
    : pick(r({ id: 'machineDual', key: 'gb.machineDual' }), LIST_DUAL, 'gbc');
  const stubWanted = flag === 'dmg' && onColor(choice) && cgbAppliesTo(H);
  const dualOnGb = flag === 'cgb-enhanced' && !onColor(choice);
  const sgbAsks = ON_SGB_SHELF && HAS_SGB && flag === 'cgb-only' && sgbEnhanced(H);
  const forceSgb = ON_SGB_SHELF && (flag !== 'cgb-only' || sgbAsks) && HAS_SGB;
  const cgb = !forceSgb && (stubWanted || (flag !== 'dmg' && !dualOnGb));
  const sgbOpt = r({ id: 'sgb', scope: 'console' }) || 'auto', linkOpt = r({ id: 'link', scope: 'game' }) || 'auto';
  const sgbWill = HAS_SGB && !cgb && !(linkOpt === 'gb' && HAS_LINK) && (forceSgb || sgbOpt === 'all' || (sgbOpt === 'auto' && sgbEnhanced(H)));
  const machKey = sgbWill ? pick(r({ id: 'machineSgb', key: 'gb.machineSgb' }), LIST_SGB, 'sgb') : cgb ? (onColor(choice) ? choice : 'gbc') : (onColor(choice) ? 'gb' : choice);
  return { cgb, sgbWill, machKey, boot: MACHINES[machKey].boot };
}
/* the role each slot asks the game server for: the model's own program (the server's gb, gbc and sgb roles,
   play/host/site-relay.js); '' is the slot's usual one (the original Game Boy's, the Color's) */
const SLOT_ROLE = { dmg: { dmg0: 'dmg0', mgb: 'mgb', sgb: 'sgb', sgb2: 'sgb2' }, cgb: { agb: 'agb' } };
function firmwareRoleOf(bytes, id, read) {
  if (!bytes || bytes.length < 0x150 || !SLOT_ROLE[id]) return '';
  const p = machinePlan(bytes, read);
  if ((id === 'cgb') !== p.cgb) return '';
  return SLOT_ROLE[id][p.boot] || '';
}

export const manifest = {
  api: '1.0',
  id: 'gb',
  label: 'Game Boy',
  form: 'handheld',
  build: 'play/gameboy/CORE-VERSION.json',
  thread: 'main',
  files: {
    game: { exts: ['.gb', '.gbc', '.sgb', '.gbs'], maxBytes: 8 * 1024 * 1024 },
    firmware: [
      { id: 'dmg', label: 'Game Boy boot program', bytes: 256, required: 'never', ours: 'CrystalWorlds' },   // ours: Game Boy, Pocket, Super Game Boy (1 and 2)
      { id: 'cgb', label: 'Game Boy Color boot program', bytes: 2304, required: 'never', ours: 'CrystalWorlds' },   // ours: Color 0 to E, Advance (gb-boot.js)
      /* The Super Game Boy's SNES program (SGB1 256 KB or SGB2 512 KB, so no fixed size),
         asked for only when the game will play as on a Super Game Boy (firmwareFor). */
      { id: 'sgb', label: 'Super Game Boy SNES program', required: 'never' },
    ],
  },
  firmwareFor: bytes => (ON_SGB_SHELF || sgbEnhanced(consoleHeader(bytes))) ? ['dmg', 'cgb', 'sgb'] : ['dmg', 'cgb'],
  /* (14 Nov) each slot asks for the program of the model that will run: the Pocket's, the Super Game Boy's, the SGB2's, the Advance's */
  firmwareRole: firmwareRoleOf,
  video: { kind: 'raster', maxWidth: SCREEN_W * 2 + LINK_GAP, maxHeight: 224, screens: 1 },   // the SGB television, two linked screens
  audio: { channels: 2, format: 's16', filtered: false },
  state: { supported: true, deterministic: true, approxBytes: 203200 },
  extensions: ['options'],
  /* Where the old Game Boy page kept things, read in place (decision P5) and, for the
     cartridge's own battery save, also written so switching back loses nothing. */
  legacy: {
    db: 'gameboy', version: 1, store: 'blobs',             // play/gameboy/web/store.js
    slotsKey: (game, model) => `states:${game}:${model}`,
    // The old page kept only the cartridge RAM; any other region (MBC6 flash) is the host's own key.
    // ...and, since 2026-10-15, the MBC3 clock record (28 bytes) under rtc:<same suffix>.
    batteryKey: (game, bytes, id) => (id && id !== 'cram' && id !== 'rtc') ? null : (!game || game === 'picked' || game === 'dropped')
      ? `${id === 'rtc' ? 'rtc' : 'cram'}:file-${cartFingerprint(bytes).toString(16)}-${bytes.length}` : `${id === 'rtc' ? 'rtc' : 'cram'}:${game}`,
    batteryJournal: key => (String(key).startsWith('rtc:') ? `gb.rtc-journal:${key}` : `gb.cram-journal:${key}`),
    firmware: { dmg: { key: 'bios', fromKey: 'biosFrom' }, cgb: { key: 'biosCgb' } },
  },
  modelLabel: m => (m === 'cgb' ? 'Game Boy Color' : 'Game Boy'),
};

/* Control order is the core's gb_set_buttons bit order (web/core.js BTN), so the
   host's mask IS the core's mask. Defaults are the old page's keys (shell.js KEYMAP)
   and play-pad.js's table: pad buttons by printed letter, the printed A is the console's A (2026-10-16). */
const CONTROLS = [
  { id: 'a',      label: 'A',      type: 'button', defaults: { key: ['KeyX'], pad: ['A', 'X'] } },
  { id: 'b',      label: 'B',      type: 'button', defaults: { key: ['KeyZ'], pad: ['B', 'Y'] } },
  { id: 'select', label: 'Select', type: 'button', defaults: { key: ['ShiftRight'], pad: ['Select'] } },
  { id: 'start',  label: 'Start',  type: 'button', defaults: { key: ['Enter', 'NumpadEnter'], pad: ['Start'] } },
  { id: 'right',  label: 'Right',  type: 'button', defaults: { key: ['ArrowRight'], pad: ['Right'] } },
  { id: 'left',   label: 'Left',   type: 'button', defaults: { key: ['ArrowLeft'], pad: ['Left'] } },
  { id: 'up',     label: 'Up',     type: 'button', defaults: { key: ['ArrowUp'], pad: ['Up'] } },
  { id: 'down',   label: 'Down',   type: 'button', defaults: { key: ['ArrowDown'], pad: ['Down'] } },
];
if (BTN.A !== 0 || BTN.B !== 1 || BTN.SELECT !== 2 || BTN.START !== 3 || BTN.RIGHT !== 4 || BTN.LEFT !== 5 || BTN.UP !== 6 || BTN.DOWN !== 7) {
  throw new Error('gb core module: web/core.js BTN order changed; the control table must follow it');
}

/* (20 Nov) THE HEADER AS THE CONSOLE READS IT. Sachen's two boards (MMC1 for the Game Boy, MMC2 for
   the Color) store the header area 0100-01FF with address lines swapped (A0 with A6, A1 with A4), and the chip
   swaps them back on every read, so the bytes at 0143 and 0146 in the file are not the flags a console reads there.
   Recognised as the emulator does (pilot src/gb.c, the Sachen boards in cart_parse): the 48 logo bytes read through
   the swap at 0104 (MMC1) or 0184 (MMC2) have the CRC-32 46195417 (the logo block every licensed header carries)
   while the file's own 0104 does not. For such a cartridge the header rules read 0100-01FF through the swap, which
   is what the start-up program reads once the chip has opened; every other cartridge is read as it is. The game
   itself is always given the file unchanged. */
const LOGO_CRC = 0x46195417;
const sachenSwap = a => (a & ~0x53) | ((a >> 6) & 1) | ((a >> 3) & 2) | ((a << 3) & 0x10) | ((a << 6) & 0x40);
function crc32of(get, n) {
  let c = ~0;
  for (let i = 0; i < n; i++) { c ^= get(i); for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xEDB88320 & -(c & 1)); }
  return (~c) >>> 0;
}
/* 1 = Sachen MMC1, 2 = Sachen MMC2, 0 = any other cartridge */
function sachenKind(bytes) {
  if (!bytes || bytes.length < 0x8000) return 0;
  if (crc32of(i => bytes[0x104 + i], 0x30) === LOGO_CRC) return 0;
  const at = base => crc32of(i => bytes[sachenSwap(base + i)], 0x30);
  return at(0x104) === LOGO_CRC ? 1 : at(0x184) === LOGO_CRC ? 2 : 0;
}
function consoleHeader(bytes) {
  if (!sachenKind(bytes)) return bytes;
  const v = bytes.slice(0, 0x8000);
  for (let a = 0x100; a < 0x200; a++) v[a] = bytes[sachenSwap(a)];
  return v;
}
/* For our own start-up program (gb-boot.js), which builds the logo it leaves in video memory and the Color's
   settings from the header it is given: the header as the console reads it, with 0104-0133 holding what Nintendo's
   program reads on its drawing pass. On MMC1, and on MMC2 on a Color (its program touches work memory first), the
   chip holds A7 high there, so the drawing pass reads 0184-01B3; on MMC2 on a Game Boy it reads 0104-0133 straight.
   That is Sachen's logo in every case but MMC2 on a Color, where it is the Nintendo logo. */
function startupHeader(bytes, cgb) {
  const k = sachenKind(bytes);
  if (!k) return bytes;
  const v = consoleHeader(bytes), from = (k === 1 || cgb) ? 0x184 : 0x104;
  for (let i = 0; i < 0x30; i++) v[0x104 + i] = bytes[sachenSwap(from + i)];
  return v;
}

function cgbFlagOf(bytes) {
  const f = (bytes && bytes.length > 0x143) ? bytes[0x143] : 0;
  if (f === 0xC0) return 'cgb-only';
  if (f & 0x80) return 'cgb-enhanced';
  return 'dmg';
}

export async function create(env) {
  const base = new URL('../../gameboy/', import.meta.url);
  const r = await fetch(new URL('build/gb.wasm', base), { cache: 'no-store' });
  if (!r.ok) throw new CoreError('unsupported', `the Game Boy core did not load (HTTP ${r.status})`);
  const wasm = await r.arrayBuffer();
  let stamp = null;
  try { const s = await fetch(new URL('CORE-VERSION.json', base), { cache: 'no-store' }); if (s.ok) stamp = await s.json(); } catch (_) {}
  const host = await GBHost.instantiate(wasm);
  const hasAudio = coreHasAudio(host);

  let machine = null, cart = null, game = '', req = null, audioSrc = null;
  /* CHEATS (2026-10-26): only on a build with the cheat calls (gb_cheat_slots, gb_poke,
     gb_poke_bank, gb_peek). A Reset builds the machine again; the table follows it (cheats-core.mjs). */
  let cheat = null;
  const cheatEng = () => {
    const X = host.exports;
    if (cheat || !machine || !['gb_cheat_slots', 'gb_cheat_set', 'gb_cheat_clear', 'gb_poke', 'gb_poke_bank', 'gb_peek'].every(n => typeof X[n] === 'function')) return cheat;
    cheat = cheatEngine({
      kinds: ['gb-gg', 'gb-gs'],
      token: () => machine,
      slots: X.gb_cheat_slots(machine.ctx) | 0,
      setSlot: (i, a, v, c) => X.gb_cheat_set(machine.ctx, i, a, v, c),
      clear: () => X.gb_cheat_clear(machine.ctx),
      poke: (a, v) => X.gb_poke(machine.ctx, a, v) === 0,
      pokeBank: (b, a, v) => X.gb_poke_bank(machine.ctx, b, a, v) === 0,
      peek: a => X.gb_peek(machine.ctx, a),
    });
    return cheat;
  };
  let model = 'dmg', lut = monoLUT(DEFAULT_PALETTE), mono = DEFAULT_PALETTE, combo = '';
  let cgbInfo = null, cleanCram = null, cleanCram2 = null, locked = false;
  let cartFlag = '', hasCgbFw = false, onStub = false;      // onStub: an original cartridge on the Color (our own start-up program)
  let ours = null;                                          // our start-up program, when the visitor has not added the console's own
  /* (14 Nov) our Super Game Boy intro: the Super Game Boy side holds the Game Boy in reset while it shows our
     border with CRYSTAL over WORLDS coming down, then lets it start; our start-up then shows the same letters
     centred. Picture only: the Game Boy itself starts from power-on as it always does. */
  const INTRO_FRAMES = 200, INTRO_SCROLL = 64, INTRO_FADE = 32;   // 200 frames: land at 64, hold, fade over the last 32
  let intro = 0, bridge = 0, introPic = null, guard = 0, lettersPic = null;
  /* the picture the start-up leaves on the Game Boy's screen: the cartridge's own logo, as on the console */
  function sameAsLetters(f) {
    if (!lettersPic) { lettersPic = cartLogoScreen(startupHeader(cart, false)); }
    for (let i = 0; i < lettersPic.length; i++) if ((f[i] & 3) !== lettersPic[i]) return false;
    return true;
  }
  /* the intro's chime B on the Super Game Boy side (the Game Boy's own sound unit is held in reset): the bell
     with a fifth, 1760 Hz then 2637 Hz a moment later, two 25% pulses with stepped decays, as our Game Boy
     start-up plays it. `chime` counts output samples from the landing; -1 = silent. */
  let chime = -1, justReleased = false;   // the frame the Game Boy starts gives no sound of its own yet
  const CHIME_LAND = 64, CHIME_S = 1.1;
  function chimeMix(buf, from, n, r) {
    const tone = (f, at, vol0, step, t) => { const u = t - at; if (u < 0) return 0; const v = vol0 - Math.floor(u / step); if (v <= 0) return 0;
      return ((u * f) % 1 < 0.25 ? 1 : -1) * v / 15; };
    for (let i = 0; i < n; i++) { const t = (chime + i) / r; if (t > CHIME_S) { chime = -1; return; }
      const a = (tone(1760, 0, 15, 0.0625, t) + tone(2637, 0.067, 9, 0.0625, t)) * 2600;
      for (let c = 0; c < 2; c++) { const k = (from + i) * 2 + c, v = buf[k] + a; buf[k] = v > 32767 ? 32767 : v < -32768 ? -32768 : v; } }
    chime += n;
  }
  /* the fade: the letters' pixels leave in a 4 x 4 ordered pattern (the Game Boy's four shades here are the
     Super Game Boy's colours, so stepping the shade would change colour rather than fade) */
  const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
  function introScreen(dy, keep = 16) {
    if (!introPic) introPic = new Uint16Array(SCREEN_W * SCREEN_H);
    introPic.fill(0);
    for (const l of logoLayout().letters) { const g = GLYPHS[l.ch];
      for (let r = 0; r < 14; r++) { const y = l.y + r + dy; if (y < 0 || y >= SCREEN_H) continue;
        for (let c = 0; c < 10; c++) if (g[r >> 1][c >> 1] === '#' && BAYER[(y & 3) * 4 + ((l.x + c) & 3)] < keep) introPic[y * SCREEN_W + l.x + c] = 3; } }
    return introPic;
  }
  let correct = false;                                      // Colour correction: the picture only, never the frame
  let machKey = 'gb', advance = false, fps = FRAME_HZ, sgbSound = false;
  /* the Workboy: plugged in (link 'workboy'), the keys held on the keyboard and on the screen, and the joypad */
  let wbHeld = new Set(), wbPanel = new Set(), wbKb = [], wbShift = false, wbPad = 0, padNow = 0, wbClockAt = 0;
  /* GBS music mode: the file, its place in the arena, the track, paused, and the picture */
  let gbs = null;
  /* Screen response (lcd.mjs): the panel's slow change, once per emulated frame, on the picture only. */
  let response = 'real';
  const screen = slowScreen();
  let flat = null;                                          // this frame as ABGR, the panel's input
  let rtcCleanAt = 0;
  /* HuC3 / TAMA5 (2026-10-17): their clocks live in battery RAM and count emulated
     time only. A 'clock' region keeps the wall time of the save; on load (after cram, which
     battery() lists first) the core is advanced by the whole seconds since (gb_clock_advance). */
  let clockCleanAt = 0;
  const hasRamClock = () => !!(machine && (caps & 0x08) && !(machine.rtc && machine.rtc.length === 20)
    && typeof X.gb_clock_advance === 'function' && machine.hasBattery);   /* the MBC3 clock record was last saved (or loaded) at this wall time */
  /* Licensed chips (2026-10-15), only on a core
     that exports them: gb_cart_caps bits 0x01 tilt (MBC7), 0x02 camera (Pocket Camera); MBC6
     flash through gb_set_flash. The host shows a control only for a capability declared here. */
  const X = host.exports;
  /* TIMED BUTTONS: the host gives each change its place in the frame ({ at } from 0 to 1), and the core
     applies it when the frame reaches that dot (gb_set_buttons_at, 70,224 dots a frame), so a press lands on
     any line as on the console (the Telling LYs test). A core without the export, or a change with no
     place, acts at once as before. */
  const TIMED = typeof X.gb_set_buttons_at === 'function';
  const timedSet = (mc, mask, at) => {
    mask &= 0xFF;
    if (!TIMED || !(at > 0)) return mc.setButtons(mask);
    if (mask === mc.buttons) return false;
    X.gb_set_buttons_at(mc.ctx, mask, Math.min(70223, Math.floor(at * 70224)));
    mc.buttons = mask;
    return true;
  };
  const HAS_CHIPS = typeof X.gb_cart_caps === 'function';
  let caps = 0, flash = null, cleanFlash = null, tilt = [0, 0];
  const FLASH_BYTES = 1 << 20, CAM_W = 128, CAM_H = 112;
  /* THE GAME BOY PRINTER (2026-10-21; the core's gb.c "THE GAME BOY PRINTER"): a device on
     the link port, only on a core that exports it. Every cartridge gets one in mode 1, "listening":
     it answers only once the game sends a printer packet, so a game that looks for another Game Boy
     on the cable still finds nothing. The paper comes out as dot lines of 162 bytes (160 darkness
     values 0..3, flags, exposure), which the host's Printer draws (play/host/peripherals.mjs). */
  const HAS_PRN = typeof X.gb_printer_attach === 'function';
  const PRN_REC = 162;
  const audioBuf = { data: new Int16Array(0), frames: 0 };
  /* (2026-10-24): the extra hardware. All off unless this cartridge or the
     viewer's choice brings it in, so an ordinary game runs exactly as before. */
  const HAS_SGB = typeof X.gb_set_sgb === 'function' && typeof X.gb_sgb_packets === 'function';
  const HAS_LINK = typeof X.gb_link_run_frame === 'function';
  const HAS_BCB = typeof X.gb_barcode_attach === 'function';
  const HAS_WB = typeof X.gb_workboy_attach === 'function';
  const HAS_BESS = typeof X.gb_bess_write === 'function' && typeof X.gb_bess_read === 'function';
  const HAS_GBS = typeof X.gb_gbs_build === 'function';
  let sgb = null, sgbChoice = 'auto', linkChoice = 'auto', link = 'none', m2 = null, fb2 = 0, bcb = null;
  let rumbleLevel = 0, toneSeen = 0, toneLeft = 0, toneSel = 0, tonePhase = 0;
  let wide = null;                      // the composed picture (SGB television or two screens), ABGR
  /* SGB: the border, automatic, no setting (25 Oct): the game's own border when it sends one;
     else Nintendo's default border from the SNES program when that firmware is loaded; else, with no
     firmware, the game's fan art (sgb-borders) filling the play area behind the Game Boy screen (presenter
     backdrop); plain black only with neither. */
  let sgbDefault = false, sgbOwn = false, fanart = '', fanartFor = '', small = null;
  /* which of the SNES program's built-in borders stands as its default (the player's pick in
     the Super Game Boy's own menu on real hardware; here the play window's Display settings). */
  let frameChoice = 'default', sgbFw = null, sgbFrames = [], sgbDefaultName = '';
  let objAt = null, objCol = null;      // a built-in border's sprite layer (Windows and clouds): pixel indexes and colours
  const fanartOn = () => !!(sgb && fanart && !sgbDefault && !sgbOwn);
  const P2 = new Uint8Array(4);         // players 2-4's buttons (link: player 2 is the second console)

  const rate = () => Math.round((env.audioRate && env.audioRate()) || 48000);

  function setBorder(bb) {
    sgb.tiles.set(bb.tiles); sgb.pendTiles.set(bb.tiles); sgb.map.set(bb.map); sgb.pendMap.set(bb.map);
    sgb.bpal.set(bb.pal); sgb.pendPal.set(bb.pal); sgb.hasBorder = true;
    objAt = objCol = null;
    if (bb.obj) { const at = []; for (let i = 0; i < bb.obj.length; i++) if (bb.obj[i]) at.push(i); objAt = Int32Array.from(at); objCol = Uint32Array.from(at, i => bb.obj[i]); }
  }
  function optionDefs() {
    const palettes = Object.entries(MONO_PALETTES).map(([v, p]) => ({ v, label: p.name }));
    const showCombo = onStub && cgbInfo && !cgbInfo.assigned;
    const bt = cart ? barcodeTitle(cart) : null;
    const more = machineRows();
    /* the Super Game Boy (on by itself for the games made for it,
       one choice to switch off). Not offered on the Color. */
    if (HAS_SGB && !ON_SGB_SHELF) more.push({ id: 'sgb', label: 'Super Game Boy', type: 'enum', group: 'machine', scope: 'console', live: true, default: 'auto', hidden: model === 'cgb',
      help: 'The Super Game Boy’s colours and border, and up to four players, for the games made for it',
      values: [{ v: 'auto', label: 'On for the games made for it' }, { v: 'all', label: 'On for every Game Boy game' }, { v: 'off', label: 'Off' }] });
    /* the SNES program's built-in borders, offered when that firmware is loaded and recognised. */
    if (sgb && sgbFw && sgbFrames.length) more.push({ id: 'sgbFrame', label: 'Super Game Boy border', type: 'enum', group: 'display', scope: 'console', live: true, default: 'default', key: 'gb.sgbFrame',
      help: 'The Super Game Boy’s own border for games that have none of their own, as chosen from its menu on the real machine',
      values: [{ v: 'default', label: sgbDefaultName ? sgbDefaultName + ' (default)' : 'Default' }].concat(sgbFrames.map(f => ({ v: f.id, label: f.label }))) });
    const wbAuto = HAS_WB && isWorkboy(cart);
    if ((HAS_LINK || HAS_BCB || HAS_WB) && !gbs) more.push({ id: 'link', label: 'Link cable', type: 'enum', group: 'machine', scope: 'game', live: true, default: 'auto',
      values: [{ v: 'auto', label: bt ? 'As the game asks (Barcode Boy)' : wbAuto ? 'As the game asks (Workboy keyboard)' : 'As the game asks (the printer when it prints)' },
        { v: 'none', label: 'Nothing (the printer when it prints)' }]
        .concat(HAS_LINK ? [{ v: 'gb', label: 'A second Game Boy: two players side by side' }] : [])
        .concat(HAS_BCB ? [{ v: 'barcode', label: 'Barcode Boy card reader' }] : [])
        .concat(HAS_WB ? [{ v: 'workboy', label: 'Workboy keyboard' }] : []) });
    return [
      { id: 'skin', label: 'Mono Palette', type: 'enum', values: palettes, default: DEFAULT_PALETTE, scope: 'console', live: true,
        group: 'display', key: 'gb.palette', hidden: model === 'cgb' },
      { id: 'colourCorrection', label: 'Colour correction', type: 'enum', values: [{ v: 'off', label: 'Off' }, { v: 'on', label: 'On' }], default: 'off',
        scope: 'console', live: true, group: 'display', key: 'gb.colourCorrection', hidden: model !== 'cgb' },
      { id: 'screenResponse', label: 'Screen response', type: 'enum', default: 'real', scope: 'console', live: true, group: 'display', key: 'gb.screenResponse',
        hidden: !!sgb && !m2,
        help: 'The real screen changes slowly: something shown every other frame looks see-through, as the game intends, and moving things leave a faint trail',
        values: [{ v: 'real', label: 'As the real screen' }, { v: 'off', label: 'Off (every frame sharp)' }] },
      ...more,
      /* the faint hum a real console's screen and processor add (off by default; SameBoy's levels, by ear) */
      { id: 'buzz', label: 'Console buzz', type: 'enum', group: 'machine', scope: 'console', live: true, key: 'gb.buzz', default: '0',
        hidden: typeof X.gb_set_interference !== 'function' || !!gbs,
        help: 'The faint hum a real Game Boy’s screen and processor add under the sound',
        values: [{ v: '0', label: 'Off' }, { v: '50', label: 'Soft' }, { v: '100', label: 'As a real console' }] },
      { id: 'startupLogo', label: 'Show start-up logo', type: 'enum', group: 'machine', scope: 'console', live: false, key: 'gb.startupLogo',
        values: [{ v: 'on', label: 'On' }, { v: 'off', label: 'Off' }], default: 'on', hidden: !ours, notice: 'Changing this restarts the game.',
        help: 'The CrystalWorlds start-up, used when you have not added the console’s own. Off: it still runs, unseen and unheard, so the game starts the same' },
      { id: 'cgbCombo', label: 'Color palette', type: 'enum', hidden: !showCombo,
        values: CGB_MANUAL.map(m => ({ v: m.combo, label: cgbConfigName(m) })), default: cgbDefaultManual().combo,
        scope: 'console', live: false, group: 'display', key: 'gb.cgbCombo' },
    ];
  }
  /* The Machine row, for a cartridge that can run on both. Two stored choices, one row at a time, because the
     two kinds start from different machines: an original cartridge from the Game Boy, a Color-enhanced one
     from the Color. Going to the Color for Tetris and back must not move Link's Awakening DX. A Color-enhanced
     cartridge needs the Color boot program to run as a Color, so without one it has no choice to offer. */
  /* One list at a time, by the cartridge: an original one, a Color-enhanced one, a Color-only one, or any of
     them while it plays on a Super Game Boy (the Super Game Boy row above switches that off). Each list is
     kept for its kind of cartridge (console scope), so moving Tetris to the Color does not move Link's
     Awakening DX. `bar`: the same list is also the bar's Machine item. */
  function machineRows() {
    const help = 'Nintendo changed the Color\u2019s chip six times. A few games and many test cartridges behave differently on each. The last model is the default. A saved game state returns to the machine it was saved on.';
    const row = (id, key, list, dflt, shown, over) => ({ id, label: 'Machine', type: 'enum', group: 'machine', scope: 'console', live: false, key,
      values: machineValues(list, dflt, over), default: dflt, hidden: !shown, notice: 'Changing this restarts the game.', bar: true });
    const onSgb = !!sgb;
    const orig = row('machine', 'gb.machine', LIST_ORIG, 'gb', cartFlag === 'dmg' && !onSgb, ORIG_LABEL);
    /* The old "Game Boy Color" skin was this choice: its stored value moves here (host readOption). */
    orig.movedFrom = { key: 'gb.palette', value: 'gbc', to: 'gbc' };
    const dual = row('machineDual', 'gb.machineDual', LIST_DUAL, 'gbc', cartFlag === 'cgb-enhanced' && !onSgb);
    const colour = row('machineColour', 'gb.machineColour', LIST_COLOUR, 'gbc', cartFlag === 'cgb-only' && !onSgb);
    dual.help = colour.help = help;
    return [orig, dual, colour, row('machineSgb', 'gb.machineSgb', LIST_SGB, 'sgb', onSgb)];
  }
  function note() {
    if (onStub && cgbInfo) { try { return cgbExplain(cgbInfo); } catch (_) { return ''; } }
    /* plain help for what is plugged in. */
    /* two Colours side by side also face each other's infrared port (the core joins them; the Advance has none) */
    if (m2 && model === 'cgb' && !/^ag/.test(GB_MODE.machine || '')) return 'Two Game Boy Colors are linked by cable, with their infrared ports facing each other. Player 2 uses a second controller, or I J K L with F, G, R and T on the keyboard.';
    if (m2) return 'Two Game Boys are linked by cable. Player 2 uses a second controller, or I J K L with F, G, R and T on the keyboard.';
    if (bcb) return 'The Barcode Boy is plugged in. Swipe a card from the Barcode reader menu in the bar.';
    if (link === 'workboy') return 'The Workboy keyboard is plugged in. Type on your keyboard; F1 to F9 are the Workboy\u2019s program keys. Scroll Lock switches your keyboard between the Workboy and the controller. The bar\u2019s Workboy keys item shows them on the screen.';
    if (gbs) return 'A GBS music file. Left and Right change the track, A plays or pauses, B starts the track again.';
    if (cart && typeof X.gb_sonar === 'function' && machine && X.gb_sonar(machine.ctx)) return 'Pocket Sonar: there is no water here, so the sonar shows a simulated lake.';
    return '';
  }

  function cgbManual() { return CGB_MANUAL.find(m => m.combo === combo) || cgbDefaultManual(); }

  function build(r) {
    const bytes = r.game.bytes;
    gbs = null;
    if (isGbs(bytes)) return buildGbs(r);
    if (!bytes || bytes.length < 0x150) throw new CoreError('damaged', 'This file is too short to be a Game Boy cartridge.');
    mono = String(r.options.skin || DEFAULT_PALETTE);
    if (!MONO_PALETTES[mono]) mono = DEFAULT_PALETTE;
    combo = String(r.options.cgbCombo || '');
    correct = r.options.colourCorrection === 'on';
    response = r.options.screenResponse === 'off' ? 'off' : 'real';
    const fw = r.firmware || {};
    const H = consoleHeader(bytes);                        // (20 Nov) the header as the console reads it
    const flag = cartFlag = cgbFlagOf(H);
    hasCgbFw = true;                                        // the Color program: the visitor's own, or ours (gb-boot.js)
    cgbInfo = cgbAppliesTo(H) ? cgbAssignmentFor(H) : null;
    /* the Machine choice for this kind of cartridge (machineRows), a value outside its list read as the default */
    const pick = (v, list, d) => (list.includes(String(v)) ? String(v) : d);
    const choice = flag === 'dmg' ? pick(r.options.machine, LIST_ORIG, 'gb') : flag === 'cgb-only' ? pick(r.options.machineColour, LIST_COLOUR, 'gbc')
      : pick(r.options.machineDual, LIST_DUAL, 'gbc');
    const stubWanted = flag === 'dmg' && onColor(choice) && !!cgbInfo;
    const dualOnGb = flag === 'cgb-enhanced' && !onColor(choice);
    /* (26 Oct): a real Super Game Boy never reads $0143; it reads the header's Super Game Boy
       flag ($0146 = $03 with licensee $33). A cartridge marked Color-only that also asks for the Super
       Game Boy's functions (In the Dark, homebrew: $C0 with $03/$33) runs on the Game Boy inside it,
       sends its own border and palettes, and plays, so the shelf plays it so. A Color-only cartridge
       without that flag (Hugo Black Diamond Fever, Wetrix GB) still plays as a Color game. */
    const sgbAsks = ON_SGB_SHELF && HAS_SGB && flag === 'cgb-only' && sgbEnhanced(H);
    /* The Super Game Boy shelf plays every cartridge a Super Game Boy can run (all but Color-only) on its DMG. */
    const forceSgb = ON_SGB_SHELF && (flag !== 'cgb-only' || sgbAsks) && HAS_SGB;
    const cgb = !forceSgb && (stubWanted || (flag !== 'dmg' && !dualOnGb));
    /* (13 Nov) The start-up program, in the standing order: the visitor's own, then ours. Ours leaves the
       machine exactly as the console's own does, so the game starts the same either way. */
    const linkWill = String(r.options.link || 'auto') === 'gb' && HAS_LINK ? 'gb' : 'other';
    const sgbWill = HAS_SGB && !cgb && linkWill !== 'gb' && (forceSgb || String(r.options.sgb || 'auto') === 'all'
      || (String(r.options.sgb || 'auto') === 'auto' && sgbEnhanced(H)));
    /* the model that runs: the Super Game Boy's, else the choice on its own device */
    machKey = sgbWill ? pick(r.options.machineSgb, LIST_SGB, 'sgb') : cgb ? (onColor(choice) ? choice : 'gbc') : (onColor(choice) ? 'gb' : choice);
    const M = MACHINES[machKey], HAS_MODELS = typeof X.gb_set_model === 'function';
    /* the visitor's own unless CrystalWorlds is picked in the Boot program list (the host then sends ours:<slot>) */
    const own = cgb ? (fw['ours:cgb'] ? null : fw.cgb) : (fw['ours:dmg'] ? null : fw.dmg);
    /* an explicit None in the Boot program list starts without any start-up program, as it says */
    const none = cgb ? !!fw['none:cgb'] : !!fw['none:dmg'];
    ours = own || none ? null : cgbStartup(cgb && stubWanted && !cgbInfo.assigned ? cgbManual() : undefined, startupHeader(bytes, cgb), M.boot);
    onStub = cgb && !!ours && !!cgbInfo;
    host.setBios(fw.dmg || null, 'dmg');
    host.setBios(fw.cgb || null, 'cgb');
    let biosKey = cgb ? 'cgb' : 'dmg';
    if (ours) { host.setBios(ours.bios, ours.key); biosKey = ours.key; }
    const useBios = !none;
    if (m2) { try { host.free(m2); } catch (_) {} m2 = null; fb2 = 0; }
    machine = host.switchTo(machine, bytes, { label: game || 'cartridge', useBios, device: cgb ? 'cgb' : 'dmg', bios: biosKey });
    /* another model than the device's own default: set it, then power on again (the Super Game Boy's below) */
    const setModel = mm => { if (HAS_MODELS && X.gb_get_model(mm.ctx) !== M.model) { X.gb_set_model(mm.ctx, M.model); X.gb_reset(mm.ctx); } };
    if (!sgbWill) setModel(machine);
    cart = bytes;
    /* what is plugged in. The link cable: a second Game Boy (the viewer's choice), the Barcode
       Boy (its games, or the viewer's choice), else the printer listening as before. */
    sgbChoice = String(r.options.sgb || 'auto');
    linkChoice = String(r.options.link || 'auto');
    const bt = barcodeTitle(bytes);
    link = linkChoice === 'gb' && HAS_LINK ? 'gb' : (linkChoice === 'barcode' || (linkChoice === 'auto' && bt)) && HAS_BCB ? 'barcode'
      : (linkChoice === 'workboy' || (linkChoice === 'auto' && isWorkboy(bytes))) && HAS_WB ? 'workboy' : 'none';
    sgb = null; objAt = objCol = null; intro = 0; bridge = 0; sgbSound = false; lettersPic = null;
    sgbDefault = false; sgbOwn = false; fanart = ''; fanartFor = '';
    if (HAS_SGB && !cgb && link !== 'gb' && (forceSgb || sgbChoice === 'all' || (sgbChoice === 'auto' && sgbEnhanced(H)))) {
      X.gb_set_sgb(machine.ctx, 1);
      if (HAS_MODELS) X.gb_set_model(machine.ctx, M.model);   // the Super Game Boy, on PAL, or the Super Game Boy 2
      X.gb_reset(machine.ctx);                // the Game Boy inside a Super Game Boy, from power-on
      sgb = new SuperGameBoy(bytes);
      /* SGB: the SNES program's default border, shown until the game sends its own. */
      sgbFw = fw.sgb || null; sgbFrames = sgbFw ? builtinBorders(sgbFw) : [];
      /* the Super Game Boy's own sounds (the SOUND command), made by its SNES sound unit from the SNES program;
         only in the play window (a tile is silent anyway) */
      if (sgbFw && sgbFw.length >= 0x40000 && typeof X.gb_sgb_sound === 'function' && !env.preview) {
        const p = host._alloc(sgbFw.length, 'sgb-snes', machine);
        new Uint8Array(X.memory.buffer, p, sgbFw.length).set(sgbFw);
        sgbSound = X.gb_sgb_sound(machine.ctx, p, sgbFw.length) === 1;
      }
      sgbDefaultName = sgbFw ? ((biosBorder(sgbFw) || {}).which || '') : '';
      frameChoice = String(r.options.sgbFrame || 'default');
      /* (14 Nov) our start-up running: our own border (sgb-border-ours.js) in the Super Game Boy's own place */
      if (ours) { sgbFrames = []; sgbDefaultName = ''; }
      const bb = ours ? ourSgbBorder() : sgbFw ? (biosBorder(sgbFw, frameChoice) || biosBorder(sgbFw)) : null;
      if (bb) { setBorder(bb); sgbDefault = true; }
      if (!bb) loadFanart(bytes);             // no firmware: the game's fan art, until it sends a border
      intro = ours && r.options.startupLogo !== 'off' ? INTRO_FRAMES : 0; bridge = intro ? ours.frames : 0; guard = intro ? 120 : 0; chime = -1;
    }
    if (link === 'gb') {
      m2 = host.create(bytes, { label: (game || 'cartridge') + ' (player 2)', useBios, device: cgb ? 'cgb' : 'dmg', bios: biosKey });
      setModel(m2);
      fb2 = host._alloc(SCREEN_W * SCREEN_H * 2, 'link-fb', m2);
      new Uint16Array(X.memory.buffer, fb2, SCREEN_W * SCREEN_H).fill(cgb ? 0x7FFF : 0);
    }
    /* our program's pictures go into video memory before it starts (gb-boot.js says why) */
    if (ours) for (const mm of m2 ? [machine, m2] : [machine]) for (const [a, b] of ours.vram) for (let i = 0; i < b.length; i++) X.gb_poke(mm.ctx, a + i, b[i]);
    bcb = link === 'barcode' ? { title: bt ? bt.t : '' } : null;
    if (bcb) X.gb_barcode_attach(machine.ctx, 1);
    wbHeld = new Set(); wbPanel = new Set(); wbKb = []; wbShift = false; wbPad = 0; wbClockAt = 0;
    if (link === 'workboy') { X.gb_workboy_attach(machine.ctx, 1); wbClock(); }
    wide = sgb ? new Uint32Array(SGB_W * SGB_H) : m2 ? new Uint32Array((SCREEN_W * 2 + LINK_GAP) * SCREEN_H) : null;
    GB_MODE.wide = !!wide; GB_MODE.sgb = !!sgb; GB_MODE.link = !!m2; GB_MODE.machine = machKey;
    P2.fill(0); rumbleLevel = 0; toneSeen = typeof X.gb_huc3_tones === 'function' ? (X.gb_huc3_tones(machine.ctx) & 0xFFFF) : 0; toneLeft = 0;
    model = cgb ? 'cgb' : 'dmg';
    if (typeof X.gb_set_interference === 'function') X.gb_set_interference(machine.ctx, env.preview ? 0 : (+r.options.buzz || 0));
    advance = machKey === 'agb';
    lutCorrected = advance ? lutAdvance : lutColour;
    /* frames a second from the machine's own clock: a Super Game Boy runs from the Super NES's (61.17 on NTSC, 60.61 on PAL) */
    fps = typeof X.gb_clock_hz === 'function' ? X.gb_clock_hz(machine.ctx) / 70224 : FRAME_HZ;
    lut = monoLUT(mono);
    locked = false;
    // The pull buffer lives in the arena, which a switch may have reclaimed: stage it
    // again, arm the APU (its first pull only sets the rate) and drop anything banked.
    audioSrc = null;
    if (hasAudio) {
      audioSrc = new CoreAudioSource(host);
      audioSrc.stage();
      audioSrc.prime(machine, rate());
      discardCoreAudio(audioSrc, machine, rate());
      if (m2) { audioSrc.prime(m2, rate()); discardCoreAudio(audioSrc, m2, rate()); }
    }
    cleanCram = machine.hasBattery && machine.cram ? new Uint8Array(machine.cram) : null;
    if (HAS_PRN) X.gb_printer_attach(machine.ctx, link === 'none' ? 1 : 0);   // one device on the cable at a time
    caps = HAS_CHIPS ? (X.gb_cart_caps(machine.ctx) >>> 0) : 0;
    tilt = [0, 0];
    // MBC6 (cartridge type $20): a host-owned 1 MiB flash, $FF when blank, saved like battery RAM.
    flash = null; cleanFlash = null;
    if (typeof X.gb_set_flash === 'function' && bytes[0x147] === 0x20) {
      const ptr = host._alloc(FLASH_BYTES, 'flash', machine);
      flash = { ptr };
      flashView().fill(0xFF);
      X.gb_set_flash(machine.ctx, ptr, FLASH_BYTES);
      cleanFlash = new Uint8Array(flashView());
    }
    /* "Show start-up logo" off: our start-up runs in full, unseen and unheard, before the first frame is shown,
       so the machine the game meets is the same. */
    if (ours && r.options.startupLogo === 'off') {
      for (let n = 0; n < ours.frames; n++) {
        if (m2) { X.gb_link_run_frame(machine.ctx, m2.ctx, fb2); machine.frames++; m2.frames++; } else machine.runFrame();
        if (sgb) sgbFrame();
      }
      if (audioSrc) { discardCoreAudio(audioSrc, machine, rate()); if (m2) discardCoreAudio(audioSrc, m2, rate()); }
    }
  }
  const flashView = () => new Uint8Array(X.memory.buffer, flash.ptr, FLASH_BYTES);

  /* ---- the Workboy ---- */
  const WB_OFFSET_KEY = 'gb.workboyOffset';   // seconds between the Workboy's clock and this device's
  function wbOffset() { try { return +(globalThis.localStorage.getItem(WB_OFFSET_KEY) || 0) || 0; } catch (_) { return 0; } }
  /* the Workboy's clock: this device's local time plus the offset a time set on the Workboy left */
  function wbClock() {
    if (!machine || link !== 'workboy') return;
    const d = new Date(Date.now() + wbOffset() * 1000);
    X.gb_workboy_time(machine.ctx, d.getSeconds(), d.getMinutes(), d.getHours(), d.getDate(), d.getMonth() + 1, d.getDay(), d.getFullYear() - 1900);
  }
  function wbTick() {
    if (++wbClockAt >= 60) { wbClockAt = 0; wbClock(); }
    if (X.gb_workboy_set(machine.ctx)) {        // the program set its clock: keep the difference, as the keyboard's own clock would
      const b = new Uint8Array(X.memory.buffer, X.gb_workboy_set_ptr(machine.ctx), 6);
      const t = new Date(b[5] + 1900, b[4] - 1, b[3], b[2], b[1], b[0]).getTime();
      if (isFinite(t)) { try { globalThis.localStorage.setItem(WB_OFFSET_KEY, String(Math.round((t - Date.now()) / 1000))); } catch (_) {} }
    }
  }
  /* the keys held (key codes from the keyboard, plus the on-screen keys): new presses and releases go to the
     Workboy once its program talks to it; until then they are the controller (the same keys as the pad's) */
  const PAD_OF = { KeyX: 1, KeyZ: 2, ShiftRight: 4, Enter: 8, NumpadEnter: 8, ArrowRight: 16, ArrowLeft: 32, ArrowUp: 64, ArrowDown: 128 };
  function wbKeys(list) {
    const now = new Set(list);
    for (const k of wbPanel) now.add(k);
    const active = !!X.gb_workboy_active(machine.ctx);
    if (!active) {
      let m = 0; for (const k of now) m |= PAD_OF[k] || 0;
      wbPad = m; machine.setButtons((padNow | wbPad) & 0xFF); wbHeld = now; return;
    }
    if (wbPad) { wbPad = 0; machine.setButtons(padNow & 0xFF); }
    const shift = now.has('ShiftLeft') || now.has('ShiftRight');
    if (shift !== wbShift) { wbShift = shift; X.gb_workboy_key(machine.ctx, shift ? WB_SHIFT_DOWN : WB_SHIFT_UP); }
    for (const k of now) {
      if (wbHeld.has(k) || k === 'ShiftLeft' || k === 'ShiftRight') continue;
      const us = US_KEYS[k], ch = us ? us[shift ? 1 : 0] : k;
      const c = wbCode(ch);
      if (c >= 0) X.gb_workboy_key(machine.ctx, c);
    }
    let anyUp = false; for (const k of wbHeld) if (!now.has(k) && k !== 'ShiftLeft' && k !== 'ShiftRight') anyUp = true;
    const others = [...now].some(k => k !== 'ShiftLeft' && k !== 'ShiftRight');
    if (anyUp && !others) X.gb_workboy_key(machine.ctx, WB_NONE);
    wbHeld = now;
  }

  /* ---- GBS music mode ---- */
  /* A GBS file is built into a cartridge (MBC3, no RAM) and played track by track, on the Color when the file
     asks for it. The screen shows a panel of our own: title, author, copyright, the track and the controls. */
  function buildGbs(r) {
    if (!HAS_GBS) throw new CoreError('unsupported', 'This player cannot play GBS music files.');
    const f = r.game.bytes, n = f.length;
    const tmp = host._alloc(n, 'gbs-file', null);
    new Uint8Array(X.memory.buffer, tmp, n).set(f);
    const size = X.gb_gbs_rom_size(tmp, n) >>> 0;
    if (!size) { host._free(tmp); throw new CoreError('damaged', 'This GBS music file is damaged.'); }
    const rp = host._alloc(size, 'gbs-program', null);
    const ok = X.gb_gbs_build(tmp, n, rp, size);
    const gbsProg = new Uint8Array(new Uint8Array(X.memory.buffer, rp, size));
    const tracks = X.gb_gbs_tracks(tmp, n) | 0, first = X.gb_gbs_first(tmp, n) | 0, colour = !!X.gb_gbs_wants_color(tmp, n);
    host._free(rp); host._free(tmp);
    if (!ok || !tracks) throw new CoreError('damaged', 'This GBS music file is damaged.');
    if (m2) { try { host.free(m2); } catch (_) {} m2 = null; fb2 = 0; }
    sgb = null; link = 'none'; bcb = null; ours = null; onStub = false; cgbInfo = null; flash = null; cleanFlash = null; caps = 0;
    machine = host.switchTo(machine, gbsProg, { label: game || 'music', useBios: false, device: colour ? 'cgb' : 'dmg' });
    cart = gbsProg; cartFlag = 'gbs'; model = colour ? 'cgb' : 'dmg'; machKey = colour ? 'gbc' : 'gb'; advance = false; lutCorrected = lutColour;
    const fp = host._alloc(n, 'gbs', machine);
    new Uint8Array(X.memory.buffer, fp, n).set(f);
    gbs = { file: f, ptr: fp, n, tracks, track: Math.max(0, Math.min(tracks - 1, first - 1)), paused: false, pad: 0, level: 0,
      title: gbsText(f, 0x10) || game || 'GBS music', author: gbsText(f, 0x30), copy: gbsText(f, 0x50), pic: null, drawn: '' };
    if (HAS_PRN) X.gb_printer_attach(machine.ctx, 0);
    wide = new Uint32Array(SGB_W * SGB_H);
    GB_MODE.wide = true; GB_MODE.sgb = false; GB_MODE.link = false; GB_MODE.machine = machKey;
    fps = FRAME_HZ; locked = false; cleanCram = null;
    audioSrc = null;
    if (hasAudio) { audioSrc = new CoreAudioSource(host); audioSrc.stage(); audioSrc.prime(machine, rate()); }
    gbsTrack(gbs.track);
  }
  function gbsTrack(t) {
    if (!gbs) return;
    gbs.track = ((t % gbs.tracks) + gbs.tracks) % gbs.tracks;   // Previous and Next go round, as other players do
    X.gb_gbs_track(machine.ctx, gbs.ptr, gbs.n, gbs.track);
    if (audioSrc) discardCoreAudio(audioSrc, machine, rate());
    gbs.drawn = '';
    env.emit('options');
  }
  function gbsPress(m) {
    const down = m & ~gbs.pad; gbs.pad = m;
    if (down & 16) gbsTrack(gbs.track + 1);
    if (down & 32) gbsTrack(gbs.track - 1);
    if (down & 1) { gbs.paused = !gbs.paused; gbs.drawn = ''; }
    if (down & 2) gbsTrack(gbs.track);
  }
  /* the panel, drawn when something on it changes (the level bar every frame) */
  function gbsDraw() {
    const W = SGB_W, H = SGB_H;
    let cv = gbs.pic;
    if (!cv) {
      try { cv = gbs.pic = new OffscreenCanvas(W, H); } catch (_) { cv = null; }
      if (!cv) { wide.fill(0xFF101418); return; }
    }
    const g = cv.getContext('2d');
    const lv = Math.min(1, gbs.level), key = gbs.track + '|' + gbs.paused + '|' + Math.round(lv * 40);
    if (key === gbs.drawn) return;
    gbs.drawn = key;
    g.fillStyle = '#101418'; g.fillRect(0, 0, W, H);
    const line = (t, y, px, col, bold) => {
      g.font = `${bold ? '700 ' : ''}${px}px system-ui, sans-serif`; g.fillStyle = col; g.textAlign = 'center';
      let s = t; while (s.length > 3 && g.measureText(s).width > W - 16) s = s.slice(0, -2);
      if (s !== t) s = s.slice(0, -1) + '\u2026';
      g.fillText(s, W / 2, y);
    };
    line(gbs.title, 44, 18, '#f2f4f6', true);
    if (gbs.author) line(gbs.author, 70, 12, '#b8c0c8');
    if (gbs.copy) line(gbs.copy, 88, 11, '#8a949e');
    line(`Track ${gbs.track + 1} of ${gbs.tracks}`, 126, 15, '#f2f4f6', true);
    line(gbs.paused ? 'Paused' : 'Playing', 146, 11, gbs.paused ? '#e0b050' : '#9be15d');
    line('\u23EE Previous    \u23EF Play / Pause    \u23ED Next', 176, 11, '#b8c0c8');
    g.fillStyle = '#26303a'; g.fillRect(48, 194, W - 96, 6);
    g.fillStyle = '#9be15d'; g.fillRect(48, 194, Math.round((W - 96) * lv), 6);
    const px = g.getImageData(0, 0, W, H).data;
    wide.set(new Uint32Array(px.buffer, px.byteOffset, W * H));
  }
  function gbsLevel(buf, n) {
    let pk = 0; for (let i = 0; i < n * 2; i += 8) { const v = Math.abs(buf[i]); if (v > pk) pk = v; }
    gbs.level = gbs.level * 0.8 + Math.min(1, pk / 12000) * 0.2;
  }

  /* ---- BESS (the save state format other Game Boy emulators read; SameBoy's specification) ---- */
  const BESS_NAME = new TextEncoder().encode('CrystalWorlds Game Boy');
  const BESS_FAIL = { '-1': 'This is not a Game Boy save state.', '-2': 'This save state is damaged.', '-3': 'This save state was made by a newer emulator than this player reads.', '-5': 'This save state is damaged.' };
  const endsBess = b => b && b.length >= 8 && b[b.length - 4] === 0x42 && b[b.length - 3] === 0x45 && b[b.length - 2] === 0x53 && b[b.length - 1] === 0x53;
  function withTemp(bytes, fn) {
    const p = host._alloc(bytes.length, 'bess-tmp', null);
    try { new Uint8Array(X.memory.buffer, p, bytes.length).set(bytes); return fn(p); } finally { host._free(p); }
  }
  /* the Super Game Boy's border and colours for the BESS 'SGB ' block: the data, then the block (sizes and offsets) */
  function sgbBessData() {
    const parts = [sgb.tiles, new Uint8Array(sgb.map.buffer, sgb.map.byteOffset, 0x800), new Uint8Array(sgb.bpal.buffer, sgb.bpal.byteOffset, 0x80),
      new Uint8Array(sgb.pal.buffer, sgb.pal.byteOffset, 0x20), new Uint8Array(sgb.ram.buffer, sgb.ram.byteOffset, 0x1000), sgb.attr, sgb.files];
    const data = new Uint8Array(parts.reduce((a, x) => a + x.length, 0)); let o = 0; const at = [];
    for (const x of parts) { at.push([x.length, o]); data.set(x, o); o += x.length; }
    return { data, at };
  }
  function bessPart(fileLen) {
    if (!HAS_BESS || !machine || gbs) return null;
    let pre = null, sgbAt = null;
    if (sgb) { const d = sgbBessData(); pre = d.data; sgbAt = d.at; }
    const BSG = 0x31475342;                         // 'BSG1': the Super Game Boy data, a trailer our own reader steps over
    const base = fileLen + (pre ? 8 + pre.length : 0);
    const need = X.gb_bess_size(machine.ctx, 0, BESS_NAME.length) >>> 0;
    const op = host._alloc(need + BESS_NAME.length, 'bess-out', null);
    let blocks;
    try {
      const np = op + need;
      new Uint8Array(X.memory.buffer, np, BESS_NAME.length).set(BESS_NAME);
      const w = X.gb_bess_write(machine.ctx, op, need, base, STATE_HEADER, Math.floor(Date.now() / 1000) >>> 0, np, BESS_NAME.length);
      if (w <= 0) return null;
      blocks = new Uint8Array(new Uint8Array(X.memory.buffer, op, w));
    } finally { host._free(op); }
    if (!pre) return blocks;
    /* the 'SGB ' block goes just before END (the last 16 bytes are END and the footer) */
    const blk = new Uint8Array(8 + 0x39), dv = new DataView(blk.buffer);
    blk.set([0x53, 0x47, 0x42, 0x20]); dv.setUint32(4, 0x39, true);
    sgbAt.forEach(([len, off], i) => { dv.setUint32(8 + i * 8, len, true); dv.setUint32(12 + i * 8, fileLen + 8 + off, true); });
    blk[8 + 0x38] = ((sgb.players || 1) << 4);
    const out = new Uint8Array(8 + pre.length + blocks.length + blk.length), ov = new DataView(out.buffer);
    ov.setUint32(0, BSG, true); ov.setUint32(4, pre.length, true); out.set(pre, 8);
    let o = 8 + pre.length;
    out.set(blocks.subarray(0, blocks.length - 16), o); o += blocks.length - 16;
    out.set(blk, o); o += blk.length;
    out.set(blocks.subarray(blocks.length - 16), o);
    return out;
  }
  /* A state from another emulator (or from an earlier build of this one, if it carries BESS): checked, words for every refusal */
  function bessCheck(b) {
    if (!HAS_BESS || !endsBess(b)) return null;
    const r = withTemp(b, p => X.gb_bess_check(machine.ctx, p, b.length));
    if (r === -4) {
      const fam = String.fromCharCode(X.gb_bess_family() & 0xFF);
      throw new CoreError('wrong-core', fam === 'C' ? 'This save was made on a Game Boy Color: choose a Color in the Machine list, then import it again.'
        : 'This save was made on a Game Boy: choose the Game Boy in the Machine list, then import it again.');
    }
    if (r < 0) throw new CoreError('damaged', BESS_FAIL[String(r)] || 'This save state could not be read.');
    const w = X.gb_bess_warnings() >>> 0;
    return { foreign: true, warning: (w & 1) ? 'This save was made with another game.' : (w & 2) ? 'This save was made with another version of this game.' : '' };
  }
  function bessLoad(b, h) {
    const e = X;
    const r = withTemp(b, p => e.gb_bess_read(machine.ctx, p, b.length));
    if (r < 0) throw new CoreError('damaged', BESS_FAIL[String(r)] || 'This save state could not be read.');
    e.gb_set_cart(machine.ctx, machine.cartPtr, machine.cartLen);
    const bios = machine.usedBios ? host._stageBios(machine.biosKind) : null;
    e.gb_set_bios(machine.ctx, bios ? bios.ptr : 0, bios ? bios.bytes.length : 0);
    if (flash) e.gb_set_flash(machine.ctx, flash.ptr, FLASH_BYTES);
    /* the Super Game Boy's border and colours, when the file has them */
    const so = X.gb_bess_sgb_block() >>> 0;
    if (sgb && so && so + 0x39 <= b.length) {
      const dv = new DataView(b.buffer, b.byteOffset, b.byteLength);
      const into = (i, dst) => { const len = dv.getUint32(so + i * 8, true), off = dv.getUint32(so + 4 + i * 8, true); if (len && off + len <= b.length) new Uint8Array(dst.buffer, dst.byteOffset, dst.byteLength).set(b.subarray(off, off + Math.min(len, dst.byteLength))); };
      into(0, sgb.tiles); into(1, sgb.map); into(2, sgb.bpal); into(3, sgb.pal); into(4, sgb.ram); into(5, sgb.attr); into(6, sgb.files);
      sgb.pendTiles.set(sgb.tiles); sgb.pendMap.set(sgb.map); sgb.pendPal.set(sgb.bpal); sgb.hasBorder = true; sgbOwn = true;
      const pl = b[so + 0x38] >> 4; if (pl === 1 || pl === 2 || pl === 4) sgb.players = pl;
    }
    /* a cartridge clock: on by the time since the save, as for a battery save */
    const st = X.gb_bess_stamp() >>> 0, secs = st && st !== 0xFFFFFFFF ? Math.floor(Date.now() / 1000) - st : 0;
    if (secs > 0 && typeof X.gb_clock_advance === 'function') X.gb_clock_advance(machine.ctx, Math.min(secs, 0x7FFFFFFF));
    if (caps & 0x01) e.gb_set_tilt(machine.ctx, tilt[0], tilt[1]);
    machine.buttons = 0; e.gb_set_buttons(machine.ctx, 0);
    locked = !!machine.locked;
    toPanel(true);
    return Object.assign({ frames: machine.frames }, h);
  }

  /* SGB: the fan art for this cartridge, by its SHA-1 (a 404 or no digest: none). */
  function loadFanart(bytes) {
    const want = (fanartFor = Math.random().toString(36));
    const dg = (globalThis.crypto && crypto.subtle) ? crypto.subtle.digest('SHA-1', bytes) : null;
    if (!dg || typeof Image === 'undefined') return;
    dg.then(buf => {
      const h = Array.from(new Uint8Array(buf), b => b.toString(16).padStart(2, '0')).join('').toUpperCase();
      const im = new Image();
      im.onload = () => { if (fanartFor !== want) return; fanart = SGB_FANART + '/' + h + '.jpg'; env.emit('video'); };
      im.src = SGB_FANART + '/' + h + '.jpg';
    }).catch(() => {});
  }
  function videoInfo() {
    if (gbs) return { width: SGB_W, height: SGB_H, format: 'rgba8888', pixelAspect: 1, rotation: 0, fill: true, backdrop: '' };
    if (fanartOn()) return { width: SCREEN_W, height: SCREEN_H, format: 'rgba8888', pixelAspect: 1, rotation: 0, fill: true, backdrop: fanart };
    /* 2026-10-25 ("enlarge the display area to fit the space in the window"): the
       wide pictures wear no console photo, so they ask the presenter to fill the stage (fill). */
    if (sgb) return { width: SGB_W, height: SGB_H, format: 'rgba8888', pixelAspect: 1, rotation: 0, fill: true, backdrop: '' };
    if (m2) return { width: SCREEN_W * 2 + LINK_GAP, height: SCREEN_H, format: 'rgba8888', pixelAspect: 1, rotation: 0, fill: true };
    const fmt = machine.frameFormat === 'rgb555' ? 'bgr555' : 'shade8';
    return { width: SCREEN_W, height: SCREEN_H, format: fmt, pixelAspect: 1, rotation: 0, palette: fmt === 'shade8' ? lut : undefined };
  }
  function battery() {
    const out = machine.hasBattery && machine.cram ? [{ id: 'cram', kind: 'sram', bytes: machine.cram.length, ext: '.sav' }] : [];
    if (machine.rtc && machine.rtc.length === 20) out.push({ id: 'rtc', kind: 'rtc', bytes: 28, ext: '.rtc' });
    if (flash) out.push({ id: 'flash', kind: 'flash', bytes: FLASH_BYTES, ext: '.flash' });
    if (hasRamClock()) out.push({ id: 'clock', kind: 'rtc', bytes: 8, ext: '.clk' });
    /* player 2's own cartridge save when two Game Boys are linked (two copies, two saves). */
    if (m2 && m2.hasBattery && m2.cram) out.push({ id: 'cram2', kind: 'sram', bytes: m2.cram.length, ext: '.p2.sav' });
    return out;
  }
  function extensionsOf() {
    return { options: true, tilt: !!(caps & 0x01), camera: !!(caps & 0x02), printer: HAS_PRN && link === 'none', barcode: !!bcb, rumble: !!(caps & 0x10) };
  }
  /* the ports. Player 1 always; player 2 on the second linked console; players 2-4 on the
     Super Game Boy (a game asks for them with MLT_REQ; unasked, their buttons are never read). */
  function portsOf() {
    const out = [{ port: 0, kind: 'player', device: 'gb-pad', label: 'Player 1', controls: CONTROLS }];
    if (link === 'workboy') out.push({ port: 4, kind: 'accessory', device: 'workboy-keyboard', label: 'Workboy keyboard', controls: [
      { id: 'keyboard', label: 'Keyboard (Scroll Lock: typing or controller)', type: 'keyboard', codes: WB_CODES, toggle: 'ScrollLock', defaults: {} }] });
    const pad = keys => CONTROLS.map(c => ({ id: c.id, label: c.label, type: 'button', defaults: { key: keys ? keys[c.id] : [], pad: c.defaults.pad } }));
    if (m2) out.push({ port: 1, kind: 'player', device: 'gb-pad', label: 'Player 2 (second Game Boy)', controls: pad(P2_KEYS) });
    else if (sgb) {
      out.push({ port: 1, kind: 'player', device: 'gb-pad', label: 'Player 2', controls: pad(P2_KEYS) });
      out.push({ port: 2, kind: 'player', device: 'gb-pad', label: 'Player 3', controls: pad(null) });
      out.push({ port: 3, kind: 'player', device: 'gb-pad', label: 'Player 4', controls: pad(null) });
    }
    return out;
  }
  /* The two linked screens side by side, each in its own colours (ABGR). */
  const lutAbgr = new Uint32Array(32768);
  for (let c = 0; c < 32768; c++) { const r5 = c & 31, g5 = (c >> 5) & 31, b5 = (c >> 10) & 31; lutAbgr[c] = ((0xFF << 24) | (((b5 << 3) | (b5 >> 2)) << 16) | (((g5 << 3) | (g5 >> 2)) << 8) | ((r5 << 3) | (r5 >> 2))) >>> 0; }
  const lutColour = colourCorrectionTable();
  /* the Advance's screen is darker: its colours are the Color's x 3/4 + $08 (Pan Docs); the SP and the Game Boy Player use the Color's */
  const lutAdvance = new Uint32Array(32768);
  for (let c = 0; c < 32768; c++) { const v = lutColour[c], ch = k => Math.min(255, (((v >>> k) & 0xFF) * 3 >> 2) + 8);
    lutAdvance[c] = ((0xFF << 24) | (ch(16) << 16) | (ch(8) << 8) | ch(0)) >>> 0; }
  let lutCorrected = lutColour;
  function blit(src, cgbFmt, ox) {
    const W = SCREEN_W * 2 + LINK_GAP;
    for (let y = 0; y < SCREEN_H; y++) {
      const o = y * W + ox, s = y * SCREEN_W;
      if (cgbFmt) { const t = correct ? lutCorrected : lutAbgr; for (let x = 0; x < SCREEN_W; x++) wide[o + x] = t[src[s + x] & 0x7FFF]; }
      else for (let x = 0; x < SCREEN_W; x++) wide[o + x] = lut[src[s + x] & 3] >>> 0;
    }
  }
  function composeLink() {
    const W = SCREEN_W * 2 + LINK_GAP;
    for (let y = 0; y < SCREEN_H; y++) wide.fill(0xFF101010, y * W + SCREEN_W, y * W + SCREEN_W + LINK_GAP);
    const c = machine.frameFormat === 'rgb555';
    blit(machine.frame, c, 0);
    blit(new Uint16Array(X.memory.buffer, fb2, SCREEN_W * SCREEN_H), c, SCREEN_W + LINK_GAP);
  }
  /* The Super Game Boy's packets, then its television picture. */
  function sgbFrame() {
    const n = X.gb_sgb_npackets(machine.ctx) | 0;
    if (n > 0) {
      const pk = new Uint8Array(X.memory.buffer, X.gb_sgb_packets(machine.ctx), n * 16).slice();
      X.gb_sgb_consume(machine.ctx);
      for (let i = 0; i < n; i++) sgb.packet(pk.subarray(i * 16, i * 16 + 16));
    }
    const was = fanartOn();
    /* while our start-up runs after the intro (until its hand-over): the intro's last picture, faded, so the letters do not come back */
    if (bridge > 0) { bridge--; wide.set(sgb.frame(introScreen(0, 0))); }
    else if (guard > 0 && sameAsLetters(machine.frame)) { guard--; wide.set(sgb.frame(introScreen(0, 0))); }   // our letters left on screen, nothing of the game's yet
    else { guard = 0; wide.set(sgb.frame(machine.frame)); }
    /* a built-in border's sprites, over the border while it stands (never over the game's own border). */
    if (objAt && sgbDefault && !sgbOwn && !sgb.anim) for (let i = 0; i < objAt.length; i++) wide[objAt[i]] = objCol[i];
    /* A border transfer starts the swap animation: from here on the game has a border of its own. */
    if (!sgbOwn && (sgb.anim > 0 || (sgb.hasBorder && !sgbDefault))) { sgbOwn = true; if (was !== fanartOn()) env.emit('video'); }
    if (fanartOn()) {
      if (!small) small = new Uint32Array(SCREEN_W * SCREEN_H);
      for (let y = 0; y < SCREEN_H; y++) small.set(wide.subarray((40 + y) * SGB_W + 48, (40 + y) * SGB_W + 48 + SCREEN_W), y * SCREEN_W);
    }
  }
  /* THE HuC3 TONE (Robopon's alarm, Pocket Family). The trigger is the chip's (Pan Docs); the
     SOUND is not documented anywhere, so this beep is FITTED and said so: an alarm-clock pattern
     (0.1 s on, 0.1 s off) at one of four pitches for the four tone numbers, for as long as the
     game keeps the tone enabled, at most 10 seconds. Sound only in the play window. */
  const TONE_HZ = [1046.5, 1318.5, 1568.0, 2093.0];
  function tonePoll() {
    if (typeof X.gb_huc3_tones !== 'function' || !(caps & 0x40)) return;
    const t = X.gb_huc3_tones(machine.ctx) >>> 0, n = t & 0xFFFF;
    if (n !== toneSeen) { toneSeen = n; toneSel = (t >> 16) & 3; toneLeft = Math.round(10 * FRAME_HZ); tonePhase = 0; }
    if (toneLeft && !((t >> 18) & 1)) toneLeft = 0;      // the game switched it off
  }
  function toneMix(buf, frames, r) {
    if (!toneLeft) return;
    toneLeft--;
    const hz = TONE_HZ[toneSel], per = r / hz;
    for (let i = 0; i < frames; i++) {
      const on = (Math.floor(tonePhase / (r * 0.1)) & 1) === 0;
      const v = on ? ((tonePhase % per) < per / 2 ? 5000 : -5000) : 0;
      tonePhase++;
      let a = buf[i * 2] + v, b = buf[i * 2 + 1] + v;
      buf[i * 2] = a > 32767 ? 32767 : a < -32768 ? -32768 : a;
      buf[i * 2 + 1] = b > 32767 ? 32767 : b < -32768 ? -32768 : b;
    }
  }
  /* SCREEN RESPONSE. Which panel this is: the Color's, the Pocket's and Light's (their palettes), or the
     original's. The Super Game Boy's television has none; two linked consoles each keep their own panel. */
  function panel() { return sgb && !m2 ? PANELS.tv : model === 'cgb' ? PANELS.cgb : (mono === 'pocket' || mono === 'teal') ? PANELS.pocket : PANELS.dmg; }
  const ghostOn = () => response === 'real' && !!machine && panel().follow < 1;
  /* one emulated frame onto the panel (runFrame); again = the same frame shown at once, nothing kept from before */
  function toPanel(again) {
    if (!ghostOn()) return;
    if (again) screen.reset();
    screen.set(panel().follow);
    if (m2) { if (wide) screen.push(wide, wide.length); return; }
    if (wide) return;
    const n = SCREEN_W * SCREEN_H, src = machine.frame;
    if (!flat) flat = new Uint32Array(n);
    if (machine.frameFormat === 'rgb555') { const t = correct ? lutCorrected : lutAbgr; for (let i = 0; i < n; i++) flat[i] = t[src[i] & 0x7FFF]; }
    else for (let i = 0; i < n; i++) flat[i] = lut[src[i] & 3];
    screen.push(flat, n);
  }
  const SGB_TAG = 0x31424753, LINK_TAG = 0x314B4E4C;     // 'SGB1', 'LNK1' trailers after the state

  const core = {
    info: { build: stamp && stamp.sha256 ? stamp.sha256 : null, coreVersion: host.coreVersion, contextBytes: host.contextBytes },

    load(r) {
      req = r;
      game = String(r.game.name || '');
      build(r);
      if (gbs) return { fps, video: videoInfo(), audio: { rate: 0 }, ports: portsOf(), battery: [], options: optionDefs(),
        extensions: { options: true }, model, note: note(), usedFirmware: null };
      toPanel(true);
      return {
        fps,
        video: videoInfo(),
        audio: { rate: 0 },                         // 0 = it resamples itself to env.audioRate()
        ports: portsOf(),
        battery: battery(),
        options: optionDefs(),
        extensions: extensionsOf(),
        model,
        note: note(),
        usedFirmware: machine.usedBios ? (ours ? 'ours' : model) : null,
      };
    },
    reset() {
      // The Control Bar's Reset is a power cycle (A3): the same machine built again.
      // The battery RAM is the cartridge's and survives it, as on hardware.
      const keep = machine && machine.hasBattery && machine.cram ? new Uint8Array(machine.cram) : null;
      const keepRtc = machine && machine.rtc ? new Uint8Array(machine.rtc) : null;   // the clock keeps counting through a power cycle
      const keepFlash = flash ? new Uint8Array(flashView()) : null;
      const keep2 = m2 && m2.hasBattery && m2.cram ? new Uint8Array(m2.cram) : null;   // player 2's save too
      build(req);
      toPanel(true);
      if (keep2 && m2 && m2.cram && m2.cram.length === keep2.length) m2.cram.set(keep2);
      if (keep && machine.cram && machine.cram.length === keep.length) machine.cram.set(keep);
      if (keepRtc && machine.rtc && machine.rtc.length === keepRtc.length) machine.rtc.set(keepRtc);
      if (keepFlash && flash) { flashView().set(keepFlash); cleanFlash = keepFlash; }
    },
    setInput(port, s) {
      if (!machine) return;
      if (gbs) { if (port === 0) gbsPress(s.buttons & 0xFF); return; }
      if (port === 4) { if (link === 'workboy') { wbKb = s.keys || []; wbKeys(wbKb); } return; }
      if (port === 0) { padNow = s.buttons & 0xFF; timedSet(machine, (padNow | wbPad) & 0xFF, s.at); return; }
      if (port < 1 || port > 3) return;
      P2[port] = s.buttons & 0xFF;
      if (m2 && port === 1) timedSet(m2, P2[1], s.at);
      else if (sgb) X.gb_set_buttons_player(machine.ctx, port, P2[port]);
    },
    runFrame() {
      if (!machine || locked) return;
      if (gbs) { if (!gbs.paused) machine.runFrame(); gbsDraw(); return; }
      if (sgb && intro > 0) {                 // our intro on the Super Game Boy side; the Game Boy waits in reset
        const k = INTRO_FRAMES - intro--, dy = Math.min(0, Math.round(-88 * (1 - k / INTRO_SCROLL)));
        const keep = Math.max(0, Math.min(16, Math.ceil(16 * (INTRO_FRAMES - 1 - k) / INTRO_FADE)));   // the letters fade over the last 32 frames
        if (k === CHIME_LAND && !env.preview) chime = 0;   // the letters land: the bell (sound only in the play window)
        if (intro === 0) justReleased = true;
        wide.set(sgb.frame(introScreen(dy, keep))); toPanel(false); return;
      }
      if (m2) { X.gb_link_run_frame(machine.ctx, m2.ctx, fb2); machine.frames++; m2.frames++; composeLink(); }
      else machine.runFrame();
      if (cheat) cheat.frame();
      if (sgb) sgbFrame();
      if (caps & 0x10) { const r = X.gb_rumble_take(machine.ctx) | 0; rumbleLevel = r > 0 ? r : 0; }
      if (link === 'workboy') wbTick();
      toPanel(false);
      tonePoll();
      if (machine.locked) { locked = true; env.emit('error', { message: `The game stopped: the core hit an illegal instruction (PC ${machine.pc.toString(16)}).` }); }
    },
    video() {
      const v = videoInfo();
      if (gbs) return { format: 'rgba8888', width: SGB_W, height: SGB_H, stride: SGB_W, data: wide, fill: true, backdrop: '' };
      if (sgb && fanartOn() && small) return { format: 'rgba8888', width: SCREEN_W, height: SCREEN_H, stride: SCREEN_W, data: small, fill: true, backdrop: fanart };
      /* Screen response: the panel's picture, made from the frame, which stays the core's as ever. */
      const shown = ghostOn() && screen.picture;
      if (wide) return { format: 'rgba8888', width: v.width, height: v.height, stride: v.width, data: m2 && shown && shown.length === wide.length ? shown : wide, fill: true, backdrop: '' };
      if (shown && shown.length === SCREEN_W * SCREEN_H) return { format: 'rgba8888', width: SCREEN_W, height: SCREEN_H, stride: SCREEN_W, data: shown, palette: undefined };
      /* Colour correction: the same frame, read through another table (index16 is the presenter's own format
         for a frame of palette indexes). The frame itself, which every test reads, is the core's as ever. */
      if (correct && v.format === 'bgr555') return { format: 'index16', width: SCREEN_W, height: SCREEN_H, stride: SCREEN_W, data: machine.frame, palette: lutCorrected };
      return { format: v.format, width: SCREEN_W, height: SCREEN_H, stride: SCREEN_W, data: machine.frame, palette: v.palette };
    },
    audio() {
      if (!audioSrc || !audioSrc.ptr || !machine) { audioBuf.frames = 0; return audioBuf; }
      /* our Super Game Boy intro: the Game Boy is held, so its sound unit is silent; the frame's samples are made here */
      if (sgb && (intro > 0 || (chime >= 0 && justReleased))) {
        justReleased = false;
        const n = Math.round(rate() / FRAME_HZ);
        if (audioBuf.data.length < n * 2) audioBuf.data = new Int16Array(n * 2);
        audioBuf.data.fill(0, 0, n * 2); audioBuf.frames = n;
        if (chime >= 0) chimeMix(audioBuf.data, 0, n, rate());
        return audioBuf;
      }
      if (gbs && gbs.paused) { audioBuf.frames = 0; gbs.level *= 0.8; return audioBuf; }
      const got = host.exports.gb_audio_pull(machine.ctx, audioSrc.ptr, audioSrc.frames, rate());
      if (got <= 0) { audioBuf.frames = 0; return audioBuf; }
      if (audioBuf.data.length < got * 2) audioBuf.data = new Int16Array(audioSrc.frames * 2);
      audioBuf.data.set(new Int16Array(host.exports.memory.buffer, audioSrc.ptr, got * 2));
      audioBuf.frames = got;
      /* the second linked console's sound, mixed in (each at its own level, clipped). */
      if (m2) {
        const g2 = host.exports.gb_audio_pull(m2.ctx, audioSrc.ptr, got, rate());
        if (g2 > 0) {
          const s2 = new Int16Array(host.exports.memory.buffer, audioSrc.ptr, g2 * 2), d = audioBuf.data;
          for (let i = 0; i < g2 * 2; i++) { const v = d[i] + s2[i]; d[i] = v > 32767 ? 32767 : v < -32768 ? -32768 : v; }
        }
      }
      toneMix(audioBuf.data, got, rate());
      if (gbs) gbsLevel(audioBuf.data, got);
      if (chime >= 0) chimeMix(audioBuf.data, 0, got, rate());     // the intro's bell rings on into the start-up
      return audioBuf;
    },
    serialize() {
      if (!machine || !machine.alive) throw new CoreError('unsupported', 'nothing is running');
      if (gbs) throw new CoreError('unsupported', 'A music file has no saves.');
      const base = saveState(machine, cart);
      /* trailers. The Super Game Boy's SNES side (border, colours) and the second linked
         console are not in the first machine's context, so they follow it, each tagged. */
      const tails = [];
      if (sgb) tails.push([SGB_TAG, sgb.save()]);
      if (m2) { const c2 = new Uint8Array(m2.context), f = new Uint8Array(X.memory.buffer, fb2, SCREEN_W * SCREEN_H * 2); const t = new Uint8Array(c2.length + f.length); t.set(c2); t.set(f, c2.length); tails.push([LINK_TAG, t]); }
      const n = tails.reduce((a, [, b]) => a + 8 + b.length, base.length);
      /* then the BESS part, so other emulators can load this state too (its memories point into our own context) */
      const bess = bessPart(n);
      const out = new Uint8Array(n + (bess ? bess.length : 0)), dv = new DataView(out.buffer);
      out.set(base); let o = base.length;
      for (const [tag, b] of tails) { dv.setUint32(o, tag, true); dv.setUint32(o + 4, b.length, true); out.set(b, o + 8); o += 8 + b.length; }
      if (bess) out.set(bess, o);
      return out;
    },
    /* Every reason a state is refused, without touching the machine. */
    check(b) {
      if (!machine || !machine.alive) throw new CoreError('unsupported', 'nothing is running');
      if (gbs) throw new CoreError('unsupported', 'A music file has no saves.');
      let h;
      /* not our own state, or made by another build of this core: a BESS part is loaded the way another emulator's is */
      try { h = stateHeader(b); } catch (e) { const f = bessCheck(b); if (f) return f; throw new CoreError('damaged', 'This is not a Game Boy save state.'); }
      if (h.version !== STATE_VERSION) { const f = bessCheck(b); if (f) return f; throw new CoreError('wrong-core', `This save is format ${h.version}; this player reads format ${STATE_VERSION}.`); }
      if (h.coreVersion !== host.coreVersion || h.contextLen !== host.contextBytes) { const f = bessCheck(b); if (f) return f; throw new CoreError('wrong-core', 'This save was made by another build of the Game Boy core.'); }
      if (b.length < STATE_HEADER + h.contextLen) throw new CoreError('damaged', 'This save is cut short.');
      if (h.fingerprint !== cartFingerprint(cart) || h.cartLen !== cart.length) throw new CoreError('wrong-game', 'This save belongs to another cartridge.');
      if (h.usedBios !== machine.usedBios) throw new CoreError('wrong-core', h.usedBios
        ? 'This save was made with a boot program; this machine started without one.'
        : 'This save was made without a boot program; this machine started with one.');
      return h;
    },
    unserialize(b) {
      const h = core.check(b);
      if (h.foreign) return bessLoad(b, h);
      machine.context.set(b.subarray(STATE_HEADER, STATE_HEADER + h.contextLen));
      // The context holds live pointers (cartridge, boot program): put them back,
      // through the published calls only, for the program this machine really uses.
      const e = host.exports;
      e.gb_set_cart(machine.ctx, machine.cartPtr, machine.cartLen);
      const bios = machine.usedBios ? host._stageBios(machine.biosKind) : null;
      e.gb_set_bios(machine.ctx, bios ? bios.ptr : 0, bios ? bios.bytes.length : 0);
      if (flash) e.gb_set_flash(machine.ctx, flash.ptr, FLASH_BYTES);   // the flash is the host's, outside the state
      /* the trailers (see serialize). A state without them leaves the SNES side and player 2 as they are. */
      let o = STATE_HEADER + h.contextLen;
      const dv = new DataView(b.buffer, b.byteOffset, b.byteLength);
      while (o + 8 <= b.length) {
        const tag = dv.getUint32(o, true), len = dv.getUint32(o + 4, true), body = b.subarray(o + 8, o + 8 + len);
        if (body.length !== len) break;
        if (tag === SGB_TAG && sgb) sgb.load(body);
        if (tag === LINK_TAG && m2 && len === host.contextBytes + SCREEN_W * SCREEN_H * 2) {
          m2.context.set(body.subarray(0, host.contextBytes));
          e.gb_set_cart(m2.ctx, m2.cartPtr, m2.cartLen);
          const b2 = m2.usedBios ? host._stageBios(m2.biosKind) : null;
          e.gb_set_bios(m2.ctx, b2 ? b2.ptr : 0, b2 ? b2.bytes.length : 0);
          new Uint8Array(X.memory.buffer, fb2, SCREEN_W * SCREEN_H * 2).set(body.subarray(host.contextBytes));
          m2.buttons = 0; e.gb_set_buttons(m2.ctx, 0);
        }
        o += 8 + len;
      }
      if (caps & 0x01) e.gb_set_tilt(machine.ctx, tilt[0], tilt[1]);
      machine.buttons = 0; e.gb_set_buttons(machine.ctx, 0);   // the host re-sends what is held now
      machine.frames = h.frames;
      locked = !!machine.locked;
      toPanel(true);                      // a saved moment: the panel starts from its picture
      return h;
    },
    /* The old page's Continue history: raw contexts of contextBytes each, with its own
       meta. Wrapped as GBST states for this machine, or null when it does not fit. */
    legacyHistory(h) {
      const m = h && h.meta;
      if (!m || !h.data || h.size !== host.contextBytes || m.coreVersion !== host.coreVersion) return null;
      if (m.fingerprint !== cartFingerprint(cart) || !!m.usedBios !== !!machine.usedBios || (m.device && m.device !== model)) return null;
      const out = [];
      for (let i = 0; i < h.n; i++) {
        const st = new Uint8Array(STATE_HEADER + h.size), dv = new DataView(st.buffer);
        dv.setUint32(0, STATE_MAGIC, true); dv.setUint32(4, STATE_VERSION, true); dv.setUint32(8, host.coreVersion, true);
        dv.setUint32(12, h.size, true); dv.setUint32(16, cartFingerprint(cart), true); dv.setUint32(20, cart.length, true);
        dv.setUint32(24, (m.frames && m.frames[i]) >>> 0, true); dv.setUint32(28, machine.usedBios ? STATE_FLAG_BIOS : 0, true);
        st.set(h.data.subarray(i * h.size, (i + 1) * h.size), STATE_HEADER);
        out.push(st);
      }
      return out;
    },
    battery: {
      read(id) {
        if (id === 'flash') return flash ? new Uint8Array(flashView()) : null;
        if (id === 'cram2') return m2 && m2.cram ? new Uint8Array(m2.cram) : null;
        if (id === 'clock') { if (!hasRamClock()) return null; const o = new Uint8Array(8); new DataView(o.buffer).setFloat64(0, Date.now(), true); return o; }
        if (id === 'rtc') return machine && machine.rtc && machine.rtc.length === 20 ? rtcPack(machine.rtc) : null;
        return id === 'cram' && machine && machine.cram ? new Uint8Array(machine.cram) : null;
      },
      /* A write is the stored image going back in, so it is clean; { asGame: true } is a
         test writing as the game would, which leaves it dirty for the host to save. */
      write(id, b, o) {
        if (id === 'rtc') {
          const r = machine && machine.rtc && machine.rtc.length === 20 ? rtcUnpackAdvanced(b) : null;
          if (!r) return false;
          machine.rtc.set(r); if (!(o && o.asGame)) rtcCleanAt = Date.now(); return true;
        }
        if (id === 'clock') {
          if (!hasRamClock() || !b || b.length !== 8) return false;
          const ts = new DataView(b.buffer, b.byteOffset, 8).getFloat64(0, true);
          const secs = Math.floor((Date.now() - ts) / 1000);
          if (secs > 0 && isFinite(secs)) X.gb_clock_advance(machine.ctx, Math.min(secs, 0x7FFFFFFF));
          if (!(o && o.asGame)) clockCleanAt = Date.now();
          return true;
        }
        if (id === 'flash') { if (!flash || !b || b.length !== FLASH_BYTES) return false; flashView().set(b); if (!(o && o.asGame)) cleanFlash = new Uint8Array(b); return true; }
        if (id === 'cram2') { if (!m2 || !m2.cram || !b || b.length !== m2.cram.length) return false; m2.cram.set(b); if (!(o && o.asGame)) cleanCram2 = new Uint8Array(b); return true; }
        if (id === 'cram' && machine && machine.cram && b && b.length === machine.cram.length) { machine.cram.set(b); if (!(o && o.asGame)) cleanCram = new Uint8Array(b); return true; } return false;
      },
      dirty() {
        const out = [];
        const c = machine && machine.hasBattery ? machine.cram : null;
        if (c) {
          if (!cleanCram || cleanCram.length !== c.length) out.push('cram');
          else for (let i = 0; i < c.length; i++) if (c[i] !== cleanCram[i]) { out.push('cram'); break; }
        }
        if (flash && cleanFlash) { const f = flashView(); for (let i = 0; i < FLASH_BYTES; i++) if (f[i] !== cleanFlash[i]) { out.push('flash'); break; } }
        if (m2 && m2.hasBattery && m2.cram) { const c2 = m2.cram; if (!cleanCram2 || cleanCram2.length !== c2.length) out.push('cram2'); else for (let i = 0; i < c2.length; i++) if (c2[i] !== cleanCram2[i]) { out.push('cram2'); break; } }
        // The clock moves every second, so "changed" is always true: keep it at most every 10 s.
        if (machine && machine.rtc && machine.rtc.length === 20 && Date.now() - rtcCleanAt >= 10000) out.push('rtc');
        if (hasRamClock() && Date.now() - clockCleanAt >= 10000) out.push('clock');
        return out;
      },
      clean(id) {
        if (id === 'flash' && flash) cleanFlash = new Uint8Array(flashView());
        if (id === 'cram' && machine && machine.cram) cleanCram = new Uint8Array(machine.cram);
        if (id === 'cram2' && m2 && m2.cram) cleanCram2 = new Uint8Array(m2.cram);
        if (id === 'rtc') rtcCleanAt = Date.now();
        if (id === 'clock') clockCleanAt = Date.now();
      },
    },
    /* Options: Mono Palette and Colour correction change only the picture; the Machine and
       the Color palette change which machine runs, so they ask the host to load again. */
    setOption(id, v) {
      if (id === 'skin') {
        mono = MONO_PALETTES[v] ? String(v) : DEFAULT_PALETTE;
        if (req) req.options.skin = mono;
        lut = monoLUT(mono);
        if (m2) composeLink();
        toPanel(true);
        env.emit('options');
        return 'live';
      }
      if (id === 'colourCorrection') {
        correct = v === 'on';
        if (req) req.options.colourCorrection = correct ? 'on' : 'off';
        if (m2) composeLink();
        toPanel(true);
        return 'live';
      }
      if (id === 'screenResponse') {
        response = v === 'off' ? 'off' : 'real';
        if (req) req.options.screenResponse = response;
        toPanel(true);
        return 'live';
      }
      if (id === 'machine' || id === 'machineDual' || id === 'machineColour' || id === 'machineSgb') {
        if (req) req.options[id] = String(v);
        const mine = id === 'machineSgb' ? !!sgb : !sgb && (id === 'machine' ? cartFlag === 'dmg' : id === 'machineDual' ? cartFlag === 'cgb-enhanced' : cartFlag === 'cgb-only');
        return mine ? 'reload' : 'live';
      }
      if (id === 'sgbFrame') {
        frameChoice = String(v); if (req) req.options.sgbFrame = frameChoice;
        /* The game's own border always wins; the choice replaces only the firmware's default. */
        if (sgb && sgbFw && sgbDefault && !sgbOwn) { const bb = biosBorder(sgbFw, frameChoice) || biosBorder(sgbFw); if (bb) { setBorder(bb); env.emit('video'); } }
        return 'live';
      }
      if (id === 'buzz') { if (req) req.options.buzz = String(v); if (typeof X.gb_set_interference === 'function') X.gb_set_interference(machine ? machine.ctx : 0, +v || 0); return 'live'; }
      if (id === 'sgb') { sgbChoice = String(v); if (req) req.options.sgb = sgbChoice; return 'reload'; }
      if (id === 'link') { linkChoice = String(v); if (req) req.options.link = linkChoice; return 'reload'; }
      if (id === 'cgbCombo') {
        combo = String(v);
        if (req) req.options.cgbCombo = combo;
        return (onStub && cgbInfo && !cgbInfo.assigned) ? 'reload' : 'live';
      }
      return 'unknown';
    },
    options: optionDefs,
    /* Licensed-chip inputs, present only on a core that has them; the host uses them
       only when load() declared the matching extension for this cartridge. */
    ext: Object.assign({
      /* bar menus of the core's own (the host makes each one a bar item): the music player in GBS mode */
      menus() {
        if (!gbs) return [];
        return [{ id: 'music', icon: 'play', label: () => `Track ${gbs.track + 1} of ${gbs.tracks}`,
          menu: () => [{ id: 'now', label: gbs.title + (gbs.paused ? ' (paused)' : ''), info: true },
            { id: 'prev', label: '\u23EE Previous track' }, { id: 'play', label: gbs.paused ? '\u23EF Play' : '\u23EF Pause' }, { id: 'next', label: '\u23ED Next track' },
            { id: 'again', label: 'Start this track again' }],
          choose: id => { if (id === 'prev') gbsTrack(gbs.track - 1); else if (id === 'next') gbsTrack(gbs.track + 1); else if (id === 'again') gbsTrack(gbs.track);
            else if (id === 'play') { gbs.paused = !gbs.paused; gbs.drawn = ''; } } }];
      },
      /* the Workboy's keys on the screen (the host draws the panel; a press is a key held) */
      keyPanel() {
        if (link !== 'workboy') return null;
        return { id: 'workboy', title: 'Workboy keys', rows: WB_PANEL,
          press: (k, down) => { if (!machine || link !== 'workboy') return; if (down) wbPanel.add(k); else wbPanel.delete(k); wbKeys(wbKb); } };
      },
      /* states for other emulators (BESS): which files the Import button takes, and whether a save can be exported */
      foreignStates: HAS_BESS ? { label: 'BESS', ext: '.bess', accept: ['.bess', '.state', '.s0', '.s1', '.s2', '.s3', '.s4', '.s5', '.s6', '.s7', '.s8', '.s9'],
        exportable: b => endsBess(b), note: 'Loaded from another emulator. The game carries on from here; music and screen effects settle within a moment.' } : null,
      /* Cheats: the kinds this build runs ([] before the cheat build is installed) and the codes switched on. */
      cheats: {
        kinds: () => { const e = cheatEng(); return e ? e.kinds() : []; },
        apply: codes => { const e = cheatEng(); return e ? e.apply(codes) : { ok: false, why: 'This player has no cheat support yet.' }; },
      },
    }, (HAS_CHIPS || HAS_PRN || HAS_BCB) ? {
      /* the Barcode Boy (extension 'barcode', the host's Barcode reader item, as the Datach). */
      barcode: HAS_BCB ? {
        busy: () => !!(machine && bcb && X.gb_barcode_busy(machine.ctx)),
        scan(d) {
          const s = String(d || '');
          if (!machine || !bcb || !/^\d{13}$/.test(s)) return false;
          const p = host._alloc(16, 'barcode', machine);
          new Uint8Array(X.memory.buffer, p, 13).set(Array.from(s, ch => ch.charCodeAt(0)));
          return !!X.gb_barcode_scan(machine.ctx, p);
        },
        /* The cards printed for this game (name, digits), for the reader's menu. */
        cards: () => (bcb && BARCODE_CARDS[bcb.title]) || [],
        name: 'Barcode Boy',
      } : undefined,
      printer: HAS_PRN ? {
        /* The dot lines the head made since the last call (a copy), or null. */
        poll() {
          if (!machine) return null;
          const n = X.gb_printer_poll(machine.ctx) | 0;
          if (n <= 0) return null;
          const out = new Uint8Array(X.memory.buffer, X.gb_printer_lines(machine.ctx), n * PRN_REC).slice();
          X.gb_printer_consume(machine.ctx, n);
          return out;
        },
        /* bits 0-7 status, 8 plugged in, 9 attached, 10 busy, 11 image data held, 16-31 packets */
        info() { return machine ? (X.gb_printer_info(machine.ctx) >>> 0) : 0; },
        /* The Mono Palette's four colours, lightest first, as the screen draws shades 0-3 (the same object
           while the choice stays); null for an original cartridge on the Color, which has no four-shade palette. */
        palette() { return onStub ? null : MONO_PALETTES[mono].rgb; },
        record: PRN_REC,
      } : undefined,
      tilt: {
        /* milli-g: x > 0 tilted left, y > 0 toward the top; 0, 0 level. */
        set(x, y) { if (!machine || !(caps & 0x01)) return; tilt = [x | 0, y | 0]; X.gb_set_tilt(machine.ctx, tilt[0], tilt[1]); },
      },
      camera: {
        size: { width: CAM_W, height: CAM_H },
        /* Captures started since the last picture (the core's frame pull). */
        wants() { return machine && (caps & 0x02) ? X.gb_camera_wants_frame(machine.ctx) | 0 : 0; },
        /* One 128 x 112 grey picture (255 bright) for the sensor. Never logged, never kept. */
        frame(grey) {
          if (!machine || !(caps & 0x02) || !grey || grey.length !== CAM_W * CAM_H) return false;
          new Uint8Array(X.memory.buffer, X.gb_camera_buffer(machine.ctx), CAM_W * CAM_H).set(grey);
          X.gb_camera_commit(machine.ctx, 1);
          return true;
        },
        /* Back to the core's own test card. */
        off() { if (machine && (caps & 0x02)) X.gb_camera_commit(machine.ctx, 0); },
      },
    } : {}),
    /* The static facts the old page's footer carried (and cut off): written to the log at mount. */
    details() { const t = host.stats(); return `core v${host.coreVersion} · ${machine ? machine.frameFormat : '…'} · context ${(host.contextBytes / 1024).toFixed(0)} KiB · ${FRAME_HZ.toFixed(4)} Hz · arena ${(t.held / 1024).toFixed(0)} KiB of ${(t.arenaBytes / 1048576).toFixed(0)} MiB · artifact ${stamp && stamp.sha256 ? stamp.sha256.slice(0, 12) : 'unstamped'}`; },
    get model() { return model; },
    /* true when the core places button changes within the frame (the host then sends { at }) */
    get timedInput() { return TIMED; },
    /* the rumble motor's share of the last frame, 0..1000 (the art's Rumble effect reads it). */
    get rumble() { return rumbleLevel; },
    get extras() { return { sgb: !!sgb, link, players: sgb ? sgb.players : m2 ? 2 : 1, sgbStats: sgb ? Object.assign({}, sgb.stats) : null,
      sgbShelf: ON_SGB_SHELF, sgbBorder: sgb ? (fanartOn() ? 'fan art' : sgbOwn ? 'own' : sgbDefault ? 'default' : 'none') : null,
      machine: machKey, coreModel: machine && typeof X.gb_get_model === 'function' ? X.gb_get_model(machine.ctx) : null, fps, advance, sgbSound,
      sgbSoundStats: sgbSound && machine ? [0, 1, 2, 3, 6, 7].map(i => X.gb_sgb_sound_stats(machine.ctx, i)) : null,
      workboy: link === 'workboy' ? { active: !!X.gb_workboy_active(machine.ctx) } : null,
      gbs: gbs ? { title: gbs.title, track: gbs.track, tracks: gbs.tracks, paused: gbs.paused, level: gbs.level } : null }; },
    get note() { return note(); },
    get frames() { return machine ? machine.frames : 0; },
    destroy() {
      if (m2) { try { host.free(m2); } catch (_) {} m2 = null; }
      if (machine) { try { host.free(machine); } catch (_) {} machine = null; }
      GB_MODE.wide = GB_MODE.sgb = GB_MODE.link = false; GB_MODE.machine = '';
    },
  };
  return core;
}

/* ---- MBC3 clock persistence (2026-10-15, gb integrator) -------------------
 * Same record as the old page (play/gameboy/app.js, rtcPack): the core's 20-byte
 * clock block (web/core.js rtc) then the wall-clock time of the save as a
 * little-endian float64 of ms. On load the live S M H DL DH advance by the real
 * seconds since (a halted clock does not; past 511 days the carry sets). */
function rtcPack(regs) {
  const out = new Uint8Array(28);
  out.set(regs.subarray(0, 20), 0);
  new DataView(out.buffer).setFloat64(20, Date.now(), true);
  return out;
}
function rtcUnpackAdvanced(rec, now = Date.now()) {
  if (!rec || rec.length !== 28) return null;
  const r = new Uint8Array(rec.subarray(0, 20));
  const ts = new DataView(rec.buffer, rec.byteOffset, rec.byteLength).getFloat64(20, true);
  const secs = Math.floor((now - ts) / 1000);
  if (!(secs > 0) || !isFinite(secs)) return r;
  const L = 5, dh = r[L + 4];
  if (dh & 0x40) return r;
  const s0 = r[L] & 0x3F, m0 = r[L + 1] & 0x3F, h0 = r[L + 2] & 0x1F;
  if (s0 > 59 || m0 > 59 || h0 > 23) return r;
  let days = r[L + 3] | ((dh & 1) << 8);
  let t = s0 + m0 * 60 + h0 * 3600 + secs;
  days += Math.floor(t / 86400); t %= 86400;
  let carry = dh & 0x80;
  if (days > 511) { carry = 0x80; days %= 512; }
  r[L] = t % 60; r[L + 1] = Math.floor(t / 60) % 60; r[L + 2] = Math.floor(t / 3600);
  r[L + 3] = days & 0xFF;
  r[L + 4] = (dh & 0x40) | carry | ((days >> 8) & 1);
  return r;
}
