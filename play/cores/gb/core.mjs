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
import { cgbBootStub, cgbBootKey } from '../../gameboy/cgb-boot.js';
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
import { biosBorder, builtinBorders } from './sgb-border.mjs?v=2.1.1';
import { cheatEngine } from '../cheats-core.mjs?v=2.1.1';
import { TEAL, colourCorrectionTable } from './colour.mjs?v=2.1.1';
import { PANELS, slowScreen } from './lcd.mjs?v=2.1.1';
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
/* The Machine choices. Adding a model here (Advance, SP, Micro) is the whole of offering it: `device` is
   the core's device, and which cartridges have the choice is decided in one place, machineRows(). */
const MACHINES = { gb: { label: 'Game Boy', device: 'dmg' }, gbc: { label: 'Game Boy Color', device: 'cgb' } };
const machineValues = () => Object.entries(MACHINES).map(([v, m]) => ({ v, label: m.label }));
const onColor = v => !!(MACHINES[v] && MACHINES[v].device === 'cgb');

export const manifest = {
  api: '1.0',
  id: 'gb',
  label: 'Game Boy',
  form: 'handheld',
  build: 'play/gameboy/CORE-VERSION.json',
  thread: 'main',
  files: {
    game: { exts: ['.gb', '.gbc', '.sgb'], maxBytes: 8 * 1024 * 1024 },
    firmware: [
      { id: 'dmg', label: 'Game Boy boot program', bytes: 256, required: 'never' },
      { id: 'cgb', label: 'Game Boy Color boot program', bytes: 2304, required: 'cartridge:cgb-only' },
      /* The Super Game Boy's SNES program (SGB1 256 KB or SGB2 512 KB, so no fixed size),
         asked for only when the game will play as on a Super Game Boy (firmwareFor). */
      { id: 'sgb', label: 'Super Game Boy SNES program', required: 'never' },
    ],
  },
  firmwareFor: bytes => (ON_SGB_SHELF || sgbEnhanced(bytes)) ? ['dmg', 'cgb', 'sgb'] : ['dmg', 'cgb'],
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
  let cartFlag = '', hasCgbFw = false, onStub = false;      // onStub: an original cartridge on the Color (our own boot stub)
  let correct = false;                                      // Colour correction: the picture only, never the frame
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
    if (HAS_LINK || HAS_BCB) more.push({ id: 'link', label: 'Link cable', type: 'enum', group: 'machine', scope: 'game', live: true, default: 'auto',
      values: [{ v: 'auto', label: bt ? 'As the game asks (Barcode Boy)' : 'As the game asks (the printer when it prints)' },
        { v: 'none', label: 'Nothing (the printer when it prints)' }]
        .concat(HAS_LINK ? [{ v: 'gb', label: 'A second Game Boy: two players side by side' }] : [])
        .concat(HAS_BCB ? [{ v: 'barcode', label: 'Barcode Boy card reader' }] : []) });
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
      { id: 'cgbCombo', label: 'Color palette', type: 'enum', hidden: !showCombo,
        values: CGB_MANUAL.map(m => ({ v: m.combo, label: cgbConfigName(m) })), default: cgbDefaultManual().combo,
        scope: 'console', live: false, group: 'display', key: 'gb.cgbCombo' },
    ];
  }
  /* The Machine row, for a cartridge that can run on both. Two stored choices, one row at a time, because the
     two kinds start from different machines: an original cartridge from the Game Boy, a Color-enhanced one
     from the Color. Going to the Color for Tetris and back must not move Link's Awakening DX. A Color-enhanced
     cartridge needs the Color boot program to run as a Color, so without one it has no choice to offer. */
  function machineRows() {
    const row = (id, key, dflt, shown) => ({ id, label: 'Game Boy', type: 'enum', group: 'machine', scope: 'console', live: false, key,
      values: machineValues(), default: dflt, hidden: !shown || ON_SGB_SHELF, notice: 'Changing this restarts the game.' });
    const orig = row('machine', 'gb.machine', 'gb', cartFlag === 'dmg');
    /* The old "Game Boy Color" skin was this choice: its stored value moves here (host readOption). */
    orig.movedFrom = { key: 'gb.palette', value: 'gbc', to: 'gbc' };
    return [orig, row('machineDual', 'gb.machineDual', 'gbc', cartFlag === 'cgb-enhanced' && hasCgbFw)];
  }
  function note() {
    if (onStub && cgbInfo) { try { return cgbExplain(cgbInfo); } catch (_) { return ''; } }
    /* plain help for what is plugged in. */
    if (m2) return 'Two Game Boys are linked by cable. Player 2 uses a second controller, or I J K L with F, G, R and T on the keyboard.';
    if (bcb) return 'The Barcode Boy is plugged in. Swipe a card from the Barcode reader menu in the bar.';
    if (cart && typeof X.gb_sonar === 'function' && machine && X.gb_sonar(machine.ctx)) return 'Pocket Sonar: there is no water here, so the sonar shows a simulated lake.';
    return '';
  }

  function cgbManual() { return CGB_MANUAL.find(m => m.combo === combo) || cgbDefaultManual(); }

  function build(r) {
    const bytes = r.game.bytes;
    if (!bytes || bytes.length < 0x150) throw new CoreError('damaged', 'This file is too short to be a Game Boy cartridge.');
    mono = String(r.options.skin || DEFAULT_PALETTE);
    if (!MONO_PALETTES[mono]) mono = DEFAULT_PALETTE;
    combo = String(r.options.cgbCombo || '');
    correct = r.options.colourCorrection === 'on';
    response = r.options.screenResponse === 'off' ? 'off' : 'real';
    const fw = r.firmware || {};
    const flag = cartFlag = cgbFlagOf(bytes);
    hasCgbFw = !!fw.cgb;
    cgbInfo = cgbAppliesTo(bytes) ? cgbAssignmentFor(bytes) : null;
    const stubWanted = onColor(r.options.machine) && !!cgbInfo;
    const dualOnGb = flag === 'cgb-enhanced' && r.options.machineDual != null && !onColor(r.options.machineDual);
    /* (26 Oct): a real Super Game Boy never reads $0143; it reads the header's Super Game Boy
       flag ($0146 = $03 with licensee $33). A cartridge marked Color-only that also asks for the Super
       Game Boy's functions (In the Dark, homebrew: $C0 with $03/$33) runs on the Game Boy inside it,
       sends its own border and palettes, and plays, so the shelf plays it so. A Color-only cartridge
       without that flag (Hugo Black Diamond Fever, Wetrix GB) still plays as a Color game. */
    const sgbAsks = ON_SGB_SHELF && HAS_SGB && flag === 'cgb-only' && sgbEnhanced(bytes);
    if (flag === 'cgb-only' && !fw.cgb && !sgbAsks) {
      throw new CoreError('needs-firmware', 'This is a Game Boy Color only cartridge, and it needs the Game Boy Color boot program. ' +
        'Add yours in Settings, Content, or on your game server.');
    }
    /* The Super Game Boy shelf plays every cartridge a Super Game Boy can run (all but Color-only) on its DMG. */
    const forceSgb = ON_SGB_SHELF && (flag !== 'cgb-only' || sgbAsks) && HAS_SGB;
    const cgb = !forceSgb && (stubWanted || (flag !== 'dmg' && !dualOnGb && !!fw.cgb));
    onStub = cgb && stubWanted;
    host.setBios(fw.dmg || null, 'dmg');
    host.setBios(fw.cgb || null, 'cgb');
    let biosKey = cgb ? 'cgb' : 'dmg';
    if (stubWanted) {
      const cfg = cgbInfo.assigned ? cgbInfo.config : cgbManual();
      const key = cgbBootKey(cfg);
      host.setBios(cgbBootStub(cfg), key);
      biosKey = key;
    }
    const useBios = (stubWanted && !forceSgb) ? true : (cgb ? !!fw.cgb : !!fw.dmg);
    if (m2) { try { host.free(m2); } catch (_) {} m2 = null; fb2 = 0; }
    machine = host.switchTo(machine, bytes, { label: game || 'cartridge', useBios, device: cgb ? 'cgb' : 'dmg', bios: biosKey });
    cart = bytes;
    /* what is plugged in. The link cable: a second Game Boy (the viewer's choice), the Barcode
       Boy (its games, or the viewer's choice), else the printer listening as before. */
    sgbChoice = String(r.options.sgb || 'auto');
    linkChoice = String(r.options.link || 'auto');
    const bt = barcodeTitle(bytes);
    link = linkChoice === 'gb' && HAS_LINK ? 'gb' : (linkChoice === 'barcode' || (linkChoice === 'auto' && bt)) && HAS_BCB ? 'barcode' : 'none';
    sgb = null; objAt = objCol = null;
    sgbDefault = false; sgbOwn = false; fanart = ''; fanartFor = '';
    if (HAS_SGB && !cgb && link !== 'gb' && (forceSgb || sgbChoice === 'all' || (sgbChoice === 'auto' && sgbEnhanced(bytes)))) {
      X.gb_set_sgb(machine.ctx, 1);
      X.gb_reset(machine.ctx);                // the Game Boy inside a Super Game Boy, from power-on
      sgb = new SuperGameBoy(bytes);
      /* SGB: the SNES program's default border, shown until the game sends its own. */
      sgbFw = fw.sgb || null; sgbFrames = sgbFw ? builtinBorders(sgbFw) : [];
      sgbDefaultName = sgbFw ? ((biosBorder(sgbFw) || {}).which || '') : '';
      frameChoice = String(r.options.sgbFrame || 'default');
      const bb = sgbFw ? (biosBorder(sgbFw, frameChoice) || biosBorder(sgbFw)) : null;
      if (bb) { setBorder(bb); sgbDefault = true; }
      if (!bb) loadFanart(bytes);             // no firmware: the game's fan art, until it sends a border
    }
    if (link === 'gb') {
      m2 = host.create(bytes, { label: (game || 'cartridge') + ' (player 2)', useBios, device: cgb ? 'cgb' : 'dmg', bios: biosKey });
      fb2 = host._alloc(SCREEN_W * SCREEN_H * 2, 'link-fb', m2);
      new Uint16Array(X.memory.buffer, fb2, SCREEN_W * SCREEN_H).fill(cgb ? 0x7FFF : 0);
    }
    bcb = link === 'barcode' ? { title: bt ? bt.t : '' } : null;
    if (bcb) X.gb_barcode_attach(machine.ctx, 1);
    wide = sgb ? new Uint32Array(SGB_W * SGB_H) : m2 ? new Uint32Array((SCREEN_W * 2 + LINK_GAP) * SCREEN_H) : null;
    GB_MODE.wide = !!wide; GB_MODE.sgb = !!sgb; GB_MODE.link = !!m2;
    P2.fill(0); rumbleLevel = 0; toneSeen = typeof X.gb_huc3_tones === 'function' ? (X.gb_huc3_tones(machine.ctx) & 0xFFFF) : 0; toneLeft = 0;
    model = cgb ? 'cgb' : 'dmg';
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
  }
  const flashView = () => new Uint8Array(X.memory.buffer, flash.ptr, FLASH_BYTES);

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
  const lutCorrected = colourCorrectionTable();
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
    wide.set(sgb.frame(machine.frame));
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
      toPanel(true);
      return {
        fps: FRAME_HZ,
        video: videoInfo(),
        audio: { rate: 0 },                         // 0 = it resamples itself to env.audioRate()
        ports: portsOf(),
        battery: battery(),
        options: optionDefs(),
        extensions: extensionsOf(),
        model,
        note: note(),
        usedFirmware: machine.usedBios ? (onStub ? 'stub' : model) : null,
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
      if (port === 0) { machine.setButtons(s.buttons & 0xFF); return; }
      if (port < 1 || port > 3) return;
      P2[port] = s.buttons & 0xFF;
      if (m2 && port === 1) m2.setButtons(P2[1]);
      else if (sgb) X.gb_set_buttons_player(machine.ctx, port, P2[port]);
    },
    runFrame() {
      if (!machine || locked) return;
      if (m2) { X.gb_link_run_frame(machine.ctx, m2.ctx, fb2); machine.frames++; m2.frames++; composeLink(); }
      else machine.runFrame();
      if (cheat) cheat.frame();
      if (sgb) sgbFrame();
      if (caps & 0x10) { const r = X.gb_rumble_take(machine.ctx) | 0; rumbleLevel = r > 0 ? r : 0; }
      toPanel(false);
      tonePoll();
      if (machine.locked) { locked = true; env.emit('error', { message: `The game stopped: the core hit an illegal instruction (PC ${machine.pc.toString(16)}).` }); }
    },
    video() {
      const v = videoInfo();
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
      return audioBuf;
    },
    serialize() {
      if (!machine || !machine.alive) throw new CoreError('unsupported', 'nothing is running');
      const base = saveState(machine, cart);
      /* trailers. The Super Game Boy's SNES side (border, colours) and the second linked
         console are not in the first machine's context, so they follow it, each tagged. */
      const tails = [];
      if (sgb) tails.push([SGB_TAG, sgb.save()]);
      if (m2) { const c2 = new Uint8Array(m2.context), f = new Uint8Array(X.memory.buffer, fb2, SCREEN_W * SCREEN_H * 2); const t = new Uint8Array(c2.length + f.length); t.set(c2); t.set(f, c2.length); tails.push([LINK_TAG, t]); }
      if (!tails.length) return base;
      const n = tails.reduce((a, [, b]) => a + 8 + b.length, base.length), out = new Uint8Array(n), dv = new DataView(out.buffer);
      out.set(base); let o = base.length;
      for (const [tag, b] of tails) { dv.setUint32(o, tag, true); dv.setUint32(o + 4, b.length, true); out.set(b, o + 8); o += 8 + b.length; }
      return out;
    },
    /* Every reason a state is refused, without touching the machine. */
    check(b) {
      if (!machine || !machine.alive) throw new CoreError('unsupported', 'nothing is running');
      let h;
      try { h = stateHeader(b); } catch (e) { throw new CoreError('damaged', 'This is not a Game Boy save state.'); }
      if (h.version !== STATE_VERSION) throw new CoreError('wrong-core', `This save is format ${h.version}; this player reads format ${STATE_VERSION}.`);
      if (h.coreVersion !== host.coreVersion || h.contextLen !== host.contextBytes) throw new CoreError('wrong-core', 'This save was made by another build of the Game Boy core.');
      if (b.length < STATE_HEADER + h.contextLen) throw new CoreError('damaged', 'This save is cut short.');
      if (h.fingerprint !== cartFingerprint(cart) || h.cartLen !== cart.length) throw new CoreError('wrong-game', 'This save belongs to another cartridge.');
      if (h.usedBios !== machine.usedBios) throw new CoreError('wrong-core', h.usedBios
        ? 'This save was made with a boot program; this machine started without one.'
        : 'This save was made without a boot program; this machine started with one.');
      return h;
    },
    unserialize(b) {
      const h = core.check(b);
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
      if (id === 'machine' || id === 'machineDual') {
        if (req) req.options[id] = String(v);
        return (id === 'machine' ? cartFlag === 'dmg' : cartFlag === 'cgb-enhanced') ? 'reload' : 'live';
      }
      if (id === 'sgbFrame') {
        frameChoice = String(v); if (req) req.options.sgbFrame = frameChoice;
        /* The game's own border always wins; the choice replaces only the firmware's default. */
        if (sgb && sgbFw && sgbDefault && !sgbOwn) { const bb = biosBorder(sgbFw, frameChoice) || biosBorder(sgbFw); if (bb) { setBorder(bb); env.emit('video'); } }
        return 'live';
      }
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
    /* the rumble motor's share of the last frame, 0..1000 (the art's Rumble effect reads it). */
    get rumble() { return rumbleLevel; },
    get extras() { return { sgb: !!sgb, link, players: sgb ? sgb.players : m2 ? 2 : 1, sgbStats: sgb ? Object.assign({}, sgb.stats) : null,
      sgbShelf: ON_SGB_SHELF, sgbBorder: sgb ? (fanartOn() ? 'fan art' : sgbOwn ? 'own' : sgbDefault ? 'default' : 'none') : null }; },
    get note() { return note(); },
    get frames() { return machine ? machine.frames : 0; },
    destroy() {
      if (m2) { try { host.free(m2); } catch (_) {} m2 = null; }
      if (machine) { try { host.free(machine); } catch (_) {} machine = null; }
      GB_MODE.wide = GB_MODE.sgb = GB_MODE.link = false;
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
