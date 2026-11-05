/*
 * play/cores/pm/core.mjs -- Pokemon mini for the one play host (Core API 1.0).
 * Started 2026-10-14 in the Pokemon mini migration (the build plan, Phase 2).
 *
 * Wraps play/pokemini/pokemini.wasm (our own clean-room core, unchanged) through its pm_*
 * exports, the way play/pokemini/pm-embed.js drives it in the old window, minus every
 * piece of DOM, audio, timer and storage: the host owns those now. No Date.now(): the
 * console's clock is set from env.now(), the host's virtual clock.
 *
 * WHAT CARRIES OVER FROM THE OLD WINDOW, AND WHERE IT CAME FROM
 *   - Pacing: one host frame = 55,640 master cycles, the console's undivided LCD frame
 *     (4,000,000 / 55,640 = 71.89 Hz; the measured figure in index.html's PM specs).
 *     The game's own PRC divider then shows every 2nd or 3rd of them, as on hardware.
 *   - The screen: the old window's green LCD ramp (pm-embed.js _blit), as a 256-entry
 *     palette, so the five persistence levels the core renders keep their exact colours.
 *   - Boot: the live BIOS slot-in animation, then at PRC frame 66 a snap to the title's
 *     main screen from play/pokemini/pm-states.json (index.html _pmSnapToMainScreen,
 *     PM_SLOTIN_FRAMES), the clock set to now and the player's own EEPROM put back over
 *     the captured one (BOOT_STATES.md "EEPROM rule"). No shipped state: the game simply
 *     keeps booting, as on the console (attract alone may capture from demo-scripts.json).
 *   - Power (bit 7 of the key mask, a key the games poll, not a switch) and Shake (the
 *     shock sensor: one edge per press, pm_shake).
 *   - Rumble: pm_rumble_state, read every frame and offered as core.rumble.
 *
 * SAVE STATES: our container 'PMHS' = the core's compact state (pm_boot_state_save, the
 * same ~14 KB the old window's slots hold: RAM, I/O, CPU, EEPROM, timers, LCD controller;
 * no cartridge or BIOS bytes) plus the picture of that moment, because the compact state
 * leaves the frame buffer out and a paused load would otherwise show the old picture.
 * unserialize also reads, by their own shape: an old slot (a bare compact state) and an
 * old Continue card (the full ~3 MB machine image, pm_state_ptr). After every load the
 * console's clock is set to now, as the old window did after a slot load.
 * deterministic: false, said plainly: the compact state leaves out the LCD persistence
 * history and the audio phase, so the first ~4 frames' blending and the sound's phase
 * after a load differ from an uninterrupted run (the CPU's path does not).
 *
 * TWO PLAYERS (2026-10-24): for the five games with an infrared mode (link.mjs
 * linkable: Party mini, Zany Cards, Pokemon Tetris, Race mini, Pichu Bros. mini) Settings,
 * Machine, Players offers "Two players". The window then runs a second Pokemon mini (a second
 * instance of the same core, its own BIOS copy, cartridge copy and EEPROM 'eeprom2') beside the
 * first, linked by infrared through link.mjs with the console's own timing; player 2 has a port
 * of their own (the second controller, or I J K L and G F H). The picture is both screens side
 * by side (rgba8888, link.mjs LINK_W), the sound both speakers, a save state both units (container
 * 'PMHL'), and the model 'pm-link', so one-unit and two-unit saves never mix. One player is
 * exactly as before: nothing in that path changed.
 */
import { CoreError } from '../../host/core-api.mjs';
import { Link, linkable, LINK_GAP, LINK_W, LINK_H } from './link.mjs?v=2.0.0';
import { cheatEngine } from '../cheats-core.mjs?v=2.0.0';

const BASE = new URL('../../pokemini/', import.meta.url);
const WASM = new URL('pokemini.wasm?v=2.0.0', BASE);     // index.html _pmLaunchCart's tag
const STATES = new URL('pm-states.json', BASE);
const SCRIPTS = new URL('demo-scripts.json', BASE);

const W = 96, H = 64, FB = W * H;
const CYCLES_PER_FRAME = 55640;
export const FPS = 4000000 / CYCLES_PER_FRAME;                   // 71.8907
const SLOTIN_FRAMES = 66;                                        // index.html PM_SLOTIN_FRAMES
const MAGIC = 0x53484D50;                                        // 'PMHS'
const VERSION = 1;
const HEAD = 32;

/* index.html PM_DEMO_SCRIPT_KEY: our device ids -> the boot-state and demo-script table ids. */
export const BOOT_KEY = {
  'pm-pichu-bros-mini': 'pichu-bros',
  'pm-pokemon-breeder-mini': 'pokemon-breeder',
  'pm-pokemon-party-mini': 'pokemon-party',
  'pm-pokemon-pinball-mini': 'pokemon-pinball',
  'pm-pokemon-puzzle-collection': 'pokemon-puzzle',
  'pm-pokemon-puzzle-collection-vol-2': 'pokemon-puzzle-2',
  'pm-pokemon-race-mini': 'pokemon-race',
  'pm-pokemon-shock-tetris': 'pokemon-tetris',
  'pm-pokemon-zany-cards': 'pokemon-zany-cards',
  'pm-togepis-great-adventure': 'togepi',
};

/* The old window's slot key carries an FNV-1a of the whole cartridge (pm-controlbar.js
   fnv), so a save from one language's file never loads into another's. Kept here for
   manifest.legacy.slotsKey, which is asked with (game, model) only. */
let curFnv = 'nohash';
function fnv(u8) { let h = 0x811c9dc5; for (let i = 0; i < u8.length; i++) { h ^= u8[i]; h = Math.imul(h, 16777619); } return (h >>> 0).toString(16).padStart(8, '0'); }

export const manifest = {
  api: '1.0',
  id: 'pm',
  label: 'Pokémon mini',
  form: 'handheld',
  build: 'play/pokemini/pokemini.wasm',
  thread: 'main',
  files: {
    game: { exts: ['.min'], maxBytes: 2 * 1024 * 1024 },
    firmware: [{ id: 'bios', label: 'Pokémon mini BIOS', bytes: 4096, required: 'always' }],
  },
  video: { kind: 'raster', maxWidth: W, maxHeight: H, screens: 1 },
  audio: { channels: 1, format: 'f32', filtered: true },          // already centred on zero (pm-embed.js: "no DC block")
  state: { supported: true, deterministic: false, approxBytes: 21000 },
  extensions: ['clock', 'attract'],
  /* The old window's database, read in place (decision P5): pm-embed.js "pokemini" /
     "blobs". Its EEPROM key is the device id (index.html _pmLaunchCart saveKey: d.id), and
     the in-game save is also written there, so switching back loses nothing. */
  legacy: {
    db: 'pokemini', version: 1, store: 'blobs',
    slotsKey: (game) => `states:${game}:${curFnv}`,
    batteryKey: (game) => `eeprom:${game}`,
    batteryJournal: key => `pm.eeprom-journal:${key}`,
    firmware: { bios: { key: 'bios' } },
    /* The old window tagged its saves with the same wasm's tag alone (pm-embed.js core field);
       info.build adds the file name. Same build: its slots and Continue cards load. */
    builds: ['20261003-pmr8'],
  },
  modelLabel: m => (m === 'pm-link' ? 'two linked Pokémon mini' : 'Pokémon mini'),
};
const MAGIC_LINK = 0x4C484D50;                                   // 'PMHL': two units
/* Settings, Machine, Players (shown only for a game with an infrared mode). Kept per game. */
const PLAYERS_OPTION = { id: 'players', label: 'Players', type: 'enum', default: '1', group: 'machine', scope: 'game',
  values: [{ v: '1', label: 'One player' }, { v: '2', label: 'Two players, linked by infrared' }] };
const LINK_NOTE = 'Two players: two Pokémon mini side by side, linked by infrared. Player 2 plays on the second controller, or with I J K L (the pad), G (A), F (B), H (C) and U (Shake). Pick the game\'s link mode on both units, as its instructions say.';

/* Control order is the core's key mask (pm-embed.js BUTTONS: a0 b1 c2 up3 down4 left5
   right6; power7 comes from the console port below), so the host's mask IS pm_set_keys's. Keys are the old window's one
   key table (pm-embed.js KEYS), plus Enter for A: a TV remote's OK has no X to press, and
   the mini has no Start for Enter to mean (new in the host, 2026-10-14). `alias` names the same function as the site's named
   presses do: play-pad.js's Pokemon mini pad table ('a', 'up', 'shake', '@menu' for
   Start) and overlay.js's on-screen buttons ('pm:a'), so both reach it unchanged. The
   pad defaults below are only used without the site's table: by printed letter, the
   printed A is the console's A, as play-pad.js says (2026-10-16). */
const CONTROLS = [
  { id: 'a',     label: 'A',     type: 'button', defaults: { key: ['KeyX', 'Enter', 'NumpadEnter'], pad: ['A', 'X'], alias: ['a', 'pm:a'] } },
  { id: 'b',     label: 'B',     type: 'button', defaults: { key: ['KeyZ'], pad: ['B', 'Y'], alias: ['b', 'pm:b'] } },
  { id: 'c',     label: 'C',     type: 'button', defaults: { key: ['KeyC'], pad: ['LB', 'RB'], alias: ['c', 'pm:c'] } },
  { id: 'up',    label: 'Up',    type: 'button', defaults: { key: ['ArrowUp'], pad: ['Up'], alias: ['up', 'pm:up'] } },
  { id: 'down',  label: 'Down',  type: 'button', defaults: { key: ['ArrowDown'], pad: ['Down'], alias: ['down', 'pm:down'] } },
  { id: 'left',  label: 'Left',  type: 'button', defaults: { key: ['ArrowLeft'], pad: ['Left'], alias: ['left', 'pm:left'] } },
  { id: 'right', label: 'Right', type: 'button', defaults: { key: ['ArrowRight'], pad: ['Right'], alias: ['right', 'pm:right'] } },
];
/* Player 2 (Two players only): the same controls in the same order, so the second controller's
   pad presses land here (input.mjs padFeed: a second pad on the second listed player port). Keys:
   the other half of the keyboard, as the NES's player 2 (I J K L, G and F), H for C and U to
   shake player 2's unit (the shock sensor; the second controller's Shake button does it too). */
const CONTROLS2 = [
  { id: 'a',     label: 'A',     type: 'button', defaults: { key: ['KeyG'] } },
  { id: 'b',     label: 'B',     type: 'button', defaults: { key: ['KeyF'] } },
  { id: 'c',     label: 'C',     type: 'button', defaults: { key: ['KeyH'] } },
  { id: 'up',    label: 'Up',    type: 'button', defaults: { key: ['KeyI'] } },
  { id: 'down',  label: 'Down',  type: 'button', defaults: { key: ['KeyK'] } },
  { id: 'left',  label: 'Left',  type: 'button', defaults: { key: ['KeyJ'] } },
  { id: 'right', label: 'Right', type: 'button', defaults: { key: ['KeyL'] } },
  { id: 'shake', label: 'Shake', type: 'button', icon: 'shake', defaults: { key: ['KeyU'] } },   // Pichu Bros. mini's Cubone game throws by shaking
];
/* The console's own keys, a port of their own so the bar lists them (host.mjs consoleKeysOf):
   Power is bit 7 of the same key mask (a key the games poll, not a switch), Shake the shock sensor. */
const CONSOLE = [
  { id: 'power', label: 'Power', type: 'button', icon: 'power', defaults: { key: ['KeyP'], alias: ['power', 'pm:power'] } },
  { id: 'shake', label: 'Shake', type: 'button', icon: 'shake', defaults: { key: ['KeyS'], pad: ['RT'], alias: ['shake', 'pm:shake'] } },
];
/* The bar's console keys (control-bar.js caps.consoleKeys), as the old window listed them. */
const CONSOLE_KEYS = [{ id: 'power', label: 'Power', icon: 'power', key: 'P' }, { id: 'shake', label: 'Shake', icon: 'shake', key: 'S' }];

/* pm-embed.js _blit's green panel: off (0xb0,0xc0,0x50) to on (0x10,0x20,0x10) by the
   level 0..255, as ABGR for the presenter. */
const MONO = (() => {
  const p = new Uint32Array(256);
  for (let v = 0; v < 256; v++) {
    const on = v / 255;
    const r = Math.round(0xb0 * (1 - on) + 0x10 * on), g = Math.round(0xc0 * (1 - on) + 0x20 * on), b = Math.round(0x50 * (1 - on) + 0x10 * on);
    p[v] = (0xFF << 24 | b << 16 | g << 8 | r) >>> 0;
  }
  return p;
})();

const b64u8 = s => { const t = atob(s), u = new Uint8Array(t.length); for (let i = 0; i < t.length; i++) u[i] = t.charCodeAt(i); return u; };
async function fetchJson(u) { try { const r = await fetch(u, { cache: 'no-store' }); return r.ok ? await r.json() : {}; } catch (_) { return {}; } }

export async function create(env) {
  const r = await fetch(WASM, { cache: 'no-store' });
  if (!r.ok) throw new CoreError('unsupported', `the Pokémon mini core did not load (HTTP ${r.status})`);
  const bytes = await r.arrayBuffer();
  const [inst, states, scripts] = await Promise.all([WebAssembly.instantiate(bytes, { env: {} }), fetchJson(STATES), fetchJson(SCRIPTS)]);
  const X = inst.instance.exports;
  X.pm_init();
  const STATE_SIZE = X.pm_state_size();
  const pristine = new Uint8Array(new Uint8Array(X.memory.buffer, X.pm_state_ptr(), STATE_SIZE));   // a clean machine, for every load
  const mem = () => new Uint8Array(X.memory.buffer);
  const frames = () => Number(X.pm_prc_frame_count());          // u64: a BigInt from the export

  let game = '', cart = null, bios = null, rate = 48000;
  let carry = 0, hostFrames = 0, locked = false;
  let snapAt = -1, bootBlob = null, demoScript = null, demoMode = false;
  let playerEeprom = null, keys = 0, pad = 0, power = 0, shakeHeld = false, rumble = 0, clockDue = false, asGameDirty = false;
  const audioBuf = { data: new Float32Array(4096), frames: 0 };
  // The last picture handed out by unserialize, until the core draws its own again.
  let heldFrame = null, heldPal = null;
  /* Two players: the second unit (XB, its own instance of the same core, made on first use),
     the link, and the second unit's own state. Untouched with one player. */
  let canLink = false, wantLink = false, linked = false, XB = null, link = null;
  let snapAtB = -1, padB = 0, shakeHeldB = false, playerEeprom2 = null, asGameDirty2 = false, heldFrameB = null, heldPalB = null;
  const audioB = { data: new Float32Array(4096) };
  const linkPic = new Uint32Array(LINK_W * LINK_H);
  const framesB = () => Number(XB.pm_prc_frame_count());
  /* CHEATS (28 Oct 2026): our own memory cheats (code kind 'ra-mem': CPU addresses in the
     console's RAM, $1000-$1FFF), written after every frame through the core's own bus calls pm_write8
     and pm_read8, which the served build already has (no core change). Player 1's unit only. With no
     cheat on nothing is written, so the machine runs exactly as before. */
  let cheat = null;
  const pmRam = a => a >= 0x1000 && a < 0x2000;
  const cheatEng = () => cheat || (cheat = cheatEngine({
    kinds: ['ra-mem'], token: () => X, slots: 0, setSlot() {}, clear() {},
    poke: (a, v) => { if (!pmRam(a)) return false; X.pm_write8(a, v); return true; },
    peek: a => (pmRam(a) ? X.pm_read8(a) & 0xff : -1),
  }));

  const setClock = () => { try { X.pm_set_datetime(Math.floor(env.now() / 1000) >>> 0); } catch (_) {} };

  function eepromNow() { return new Uint8Array(new Uint8Array(X.memory.buffer, X.pm_eeprom_ptr(), X.pm_eeprom_size())); }
  function putEeprom(b) {
    const n = Math.min(b.length, X.pm_eeprom_size());
    new Uint8Array(X.memory.buffer, X.pm_eeprom_ptr(), n).set(b.subarray(0, n));
    X.pm_eeprom_clear_dirty();
  }

  /* Power on: a clean machine, the BIOS and the cartridge in, the reset vector, the clock,
     and the snap to the main screen armed for PRC frame 66 (attract: the same, with the
     captured EEPROM kept). */
  function powerOn() {
    mem().set(pristine, X.pm_state_ptr());
    X.pm_init();
    new Uint8Array(X.memory.buffer, X.pm_bios_ptr(), Math.min(bios.length, X.pm_bios_size())).set(bios.subarray(0, X.pm_bios_size()));
    new Uint8Array(X.memory.buffer, X.pm_cart_ptr(), cart.length).set(cart);
    if (X.pm_load(cart.length) !== 0) throw new CoreError('damaged', 'This file is too large to be a Pokémon mini cartridge.');
    X.pm_reset();
    X.pm_set_sample_rate(rate | 0);
    if (playerEeprom && !demoMode) putEeprom(playerEeprom);
    setClock();
    carry = 0; keys = 0; pad = 0; power = 0; shakeHeld = false; locked = false; heldFrame = null; heldPal = null; clockDue = false;
    X.pm_set_keys(0);
    /* A game with no shipped state boots as the console does. The demo script is for attract only:
       it was timed on one dump, and on another the capture can land on a blank screen for good. */
    snapAt = (bootBlob || (demoMode && demoScript)) ? SLOTIN_FRAMES : -1;
    if (linked) { powerOnB(); link.rebase(); }
  }
  /* The second unit's power on: the same steps, its own EEPROM, the same snap to the main screen. */
  function powerOnB() {
    new Uint8Array(XB.memory.buffer).set(pristine, XB.pm_state_ptr());
    XB.pm_init();
    new Uint8Array(XB.memory.buffer, XB.pm_bios_ptr(), Math.min(bios.length, XB.pm_bios_size())).set(bios.subarray(0, XB.pm_bios_size()));
    new Uint8Array(XB.memory.buffer, XB.pm_cart_ptr(), cart.length).set(cart);
    XB.pm_load(cart.length);
    XB.pm_reset();
    XB.pm_set_sample_rate(rate | 0);
    if (playerEeprom2) putEepromB(playerEeprom2);
    try { XB.pm_set_datetime(Math.floor(env.now() / 1000) >>> 0); } catch (_) {}
    padB = 0; shakeHeldB = false; heldFrameB = null; heldPalB = null;
    XB.pm_set_keys(0);
    snapAtB = bootBlob ? SLOTIN_FRAMES : -1;
  }
  function snapB() {
    snapAtB = -1;
    if (!bootBlob || bootBlob.length > XB.pm_boot_state_max()) return;
    new Uint8Array(XB.memory.buffer, XB.pm_boot_state_ptr(), bootBlob.length).set(bootBlob);
    XB.pm_boot_state_load(bootBlob.length);
    if (playerEeprom2) putEepromB(playerEeprom2);
    try { XB.pm_set_datetime(Math.floor(env.now() / 1000) >>> 0); } catch (_) {}
    XB.pm_set_keys(padB);
  }
  function eepromNowB() { return new Uint8Array(new Uint8Array(XB.memory.buffer, XB.pm_eeprom_ptr(), XB.pm_eeprom_size())); }
  function putEepromB(b) {
    const n = Math.min(b.length, XB.pm_eeprom_size());
    new Uint8Array(XB.memory.buffer, XB.pm_eeprom_ptr(), n).set(b.subarray(0, n));
    XB.pm_eeprom_clear_dirty();
  }

  /* index.html _pmSnapToMainScreen / pm-embed.js loadBootState: the captured main screen,
     the clock to now, the player's own EEPROM over the captured one. */
  function snap() {
    snapAt = -1;
    let blob = bootBlob;
    if (!blob && demoMode && demoScript) blob = captureMainScreen();
    if (!blob) return;
    if (blob.length > X.pm_boot_state_max()) return;
    new Uint8Array(X.memory.buffer, X.pm_boot_state_ptr(), blob.length).set(blob);
    X.pm_boot_state_load(blob.length);
    if (playerEeprom && !demoMode) putEeprom(playerEeprom);
    setClock();
    X.pm_set_keys(keys);
    env.log('info', 'boot: snapped to the main screen');
  }
  /* pm-embed.js captureBootState: fast-run the demo script from power-on to the main
     screen with no pacing, then take the compact state. Used only with no shipped state. */
  function captureMainScreen() {
    try {
      X.pm_reset(); setClock();
      const last = demoScript.reduce((m, s) => Math.max(m, s.frame + (s.hold || 6)), 0);
      let guard = 0;
      while (frames() < last + 400 && guard < 80000000 && !X.pm_cpu_trapped()) {
        let mask = 0; const f = frames();
        for (const s of demoScript) if (f >= s.frame && f < s.frame + (s.hold || 6)) mask |= s.keys;
        X.pm_set_keys(mask); X.pm_run_cycles(4000); guard++;
      }
      X.pm_set_keys(0);
      const n = X.pm_boot_state_save();
      return new Uint8Array(new Uint8Array(X.memory.buffer, X.pm_boot_state_ptr(), n));
    } catch (_) { return null; }
  }

  function palOf(Y) {
    if (!Y.pm_color_enabled()) return MONO;
    return new Uint32Array(new Uint32Array(Y.memory.buffer, Y.pm_color_palette_ptr(), 256));   // a copy: rewind keeps its own
  }
  function fbOf(Y) {
    return Y.pm_color_enabled() ? new Uint8Array(Y.memory.buffer, Y.pm_color_fb_ptr(), FB) : new Uint8Array(Y.memory.buffer, Y.pm_fb_ptr(), FB);
  }
  const pal = () => palOf(X), fbView = () => fbOf(X);

  /* ---- states ---- */
  /* One unit's container ('PMHS'); with two players the save is 'PMHL' = both units' containers. */
  function containerOf(Y, hf, hp) {
    const n = Y.pm_boot_state_save();
    const colour = !!Y.pm_color_enabled();
    const out = new Uint8Array(HEAD + n + FB + (colour ? 1024 : 0));
    const dv = new DataView(out.buffer);
    dv.setUint32(0, MAGIC, true); dv.setUint32(4, VERSION, true); dv.setUint32(8, n, true);
    dv.setUint32(12, colour ? 1 : 0, true); dv.setUint32(16, parseInt(curFnv, 16) >>> 0, true); dv.setUint32(20, cart.length, true);
    dv.setUint32(24, hostFrames >>> 0, true); dv.setUint32(28, STATE_SIZE, true);
    out.set(new Uint8Array(Y.memory.buffer, Y.pm_boot_state_ptr(), n), HEAD);
    out.set(hf || fbOf(Y), HEAD + n);
    if (colour) out.set(new Uint8Array((hp || palOf(Y)).buffer.slice(0)), HEAD + n + FB);
    return out;
  }
  function serialize() {
    if (!cart) throw new CoreError('unsupported', 'nothing is running');
    if (!linked) return containerOf(X, heldFrame, heldPal);
    const a = containerOf(X, heldFrame, heldPal), b = containerOf(XB, heldFrameB, heldPalB);
    const out = new Uint8Array(16 + a.length + b.length), dv = new DataView(out.buffer);
    dv.setUint32(0, MAGIC_LINK, true); dv.setUint32(4, VERSION, true); dv.setUint32(8, a.length, true); dv.setUint32(12, b.length, true);
    out.set(a, 16); out.set(b, 16 + a.length);
    return out;
  }
  /* What a state is, by its own shape, or why it is refused. Touches nothing. */
  function checkOne(Y, b) {
    if (!b || !b.length) throw new CoreError('damaged', 'This save is empty.');
    const dv = new DataView(b.buffer, b.byteOffset, b.byteLength);
    if (b.length >= HEAD && dv.getUint32(0, true) === MAGIC) {
      const v = dv.getUint32(4, true), n = dv.getUint32(8, true), colour = dv.getUint32(12, true) === 1;
      if (v !== VERSION) throw new CoreError('wrong-core', `This save is format ${v}; this player reads format ${VERSION}.`);
      if (n > Y.pm_boot_state_max() || b.length < HEAD + n + FB + (colour ? 1024 : 0)) throw new CoreError('damaged', 'This save is cut short.');
      if (dv.getUint32(16, true) !== (parseInt(curFnv, 16) >>> 0) || dv.getUint32(20, true) !== cart.length) throw new CoreError('wrong-game', 'This save belongs to another cartridge.');
      return { kind: 'container', n, colour };
    }
    if (b.length === STATE_SIZE) return { kind: 'full' };           // an old Continue card
    if (b.length <= Y.pm_boot_state_max() && b.length >= 1024) return { kind: 'compact' };   // an old slot
    throw new CoreError('wrong-core', 'This is not a Pokémon mini save from this player.');
  }
  function check(b) {
    if (!cart) throw new CoreError('unsupported', 'nothing is running');
    const two = b && b.length >= 16 && new DataView(b.buffer, b.byteOffset, b.byteLength).getUint32(0, true) === MAGIC_LINK;
    if (!two) {
      if (linked) throw new CoreError('wrong-core', 'This save holds one Pokémon mini. Pick One player in Settings, Machine, Players to load it.');
      return checkOne(X, b);
    }
    if (!linked) throw new CoreError('wrong-core', 'This save holds two linked Pokémon mini. Pick Two players in Settings, Machine, Players to load it.');
    const dv = new DataView(b.buffer, b.byteOffset, b.byteLength), la = dv.getUint32(8, true), lb = dv.getUint32(12, true);
    if (b.length < 16 + la + lb) throw new CoreError('damaged', 'This save is cut short.');
    const pa = b.subarray(16, 16 + la), pb = b.subarray(16 + la, 16 + la + lb);
    const ha = checkOne(X, pa), hb = checkOne(XB, pb);
    if (ha.kind !== 'container' || hb.kind !== 'container') throw new CoreError('damaged', 'This save is damaged.');
    return { kind: 'link', pa, pb, ha, hb };
  }
  /* One unit's state put back; returns the picture of that moment. */
  function loadOne(Y, b, h) {
    if (h.kind === 'full') {
      // The whole machine, cartridge buffer included, exactly as the old window put it back.
      new Uint8Array(Y.memory.buffer, Y.pm_state_ptr(), STATE_SIZE).set(b);
      return { hf: null, hp: null };
    }
    const st = h.kind === 'container' ? b.subarray(HEAD, HEAD + h.n) : b;
    new Uint8Array(Y.memory.buffer, Y.pm_boot_state_ptr(), st.length).set(st);
    Y.pm_boot_state_load(st.length);
    if (h.kind !== 'container') return { hf: null, hp: null };
    return { frames: new DataView(b.buffer, b.byteOffset, b.byteLength).getUint32(24, true), hf: b.slice(HEAD + h.n, HEAD + h.n + FB),
      hp: h.colour ? new Uint32Array(b.slice(HEAD + h.n + FB, HEAD + h.n + FB + 1024).buffer) : null };
  }
  function unserialize(b) {
    const h = check(b);
    snapAt = -1;                                                  // a loaded game is past its boot
    const r = loadOne(X, h.kind === 'link' ? h.pa : b, h.kind === 'link' ? h.ha : h);
    if (r.frames != null) hostFrames = r.frames;
    heldFrame = r.hf; heldPal = r.hp;
    if (h.kind === 'link') {
      const r2 = loadOne(XB, h.pb, h.hb);
      heldFrameB = r2.hf; heldPalB = r2.hp; snapAtB = -1;
      padB = 0; shakeHeldB = false; XB.pm_set_keys(0);
      link.rebase();
    }
    // The host re-sends what is held now. The console's clock goes to the real time (the old
    // window did so after a slot load) as the next frame starts, so a state read straight
    // back after a load is the one that went in (continuerow.js checks exactly that).
    keys = 0; pad = 0; power = 0; X.pm_set_keys(0); shakeHeld = false;
    clockDue = true;
    carry = 0;
    locked = !!X.pm_cpu_trapped();
    return h;
  }

  /* A unit's samples since the last frame, into buf.data; returns how many. */
  function drain(Y, buf) {
    const avail = Y.pm_audio_count();
    if (!(avail > 0)) return 0;
    const sz = Y.pm_audio_ring_size(), rd = Y.pm_audio_rd();
    const ring = new Float32Array(Y.memory.buffer, Y.pm_audio_ptr(), sz);
    if (buf.data.length < avail) buf.data = new Float32Array(avail * 2);
    const first = Math.min(avail, sz - rd);
    buf.data.set(ring.subarray(rd, rd + first), 0);
    if (first < avail) buf.data.set(ring.subarray(0, avail - first), first);
    Y.pm_audio_advance(avail);
    return avail;
  }
  /* Two players: both screens, side by side, with the shells' gap between (art.mjs covers it). */
  function linkVideo() {
    const out = linkPic, gap = 0xFF332D2A;                       // ABGR: the bar's dark bezel (#2a2d33)
    out.fill(gap);
    const put = (src, p, x0) => {
      const m = (p.length & (p.length - 1)) === 0 ? p.length - 1 : 0xFFFF;
      for (let y = 0; y < H; y++) { const o = y * LINK_W + x0, s = y * W; for (let x = 0; x < W; x++) out[o + x] = p[src[s + x] & m] | 0xFF000000; }
    };
    put(heldFrame || fbView(), heldFrame ? (heldPal || MONO) : pal(), 0);
    put(heldFrameB || fbOf(XB), heldFrameB ? (heldPalB || MONO) : palOf(XB), W + LINK_GAP);
    return { format: 'rgba8888', width: LINK_W, height: LINK_H, stride: LINK_W, data: out };
  }

  const core = {
    info: { build: 'pokemini.wasm 20261026-pmf', abi: X.pm_abi_version(), stateBytes: STATE_SIZE },

    /* Two players needs the second unit's own instance of the core, made once, before load. */
    async loadAsync(req) {
      if (req && req.options && String(req.options.players) === '2' && !XB) {
        try { XB = (await WebAssembly.instantiate(bytes, { env: {} })).instance.exports; XB.pm_init(); }
        catch (e) { XB = null; env.log('warn', 'the second Pokémon mini did not start: ' + (e && e.message)); }
      }
      return core.load(req);
    },
    load(req) {
      const fw = req.firmware || {};
      if (!fw.bios) throw new CoreError('needs-firmware', 'The Pokémon mini needs its BIOS. Add it with a content pack in Settings, Content, or on your game server.');
      const g = req.game.bytes;
      if (!g || g.length < 0x2100) throw new CoreError('damaged', 'This file is too short to be a Pokémon mini cartridge.');
      if (g.length > X.pm_cart_capacity()) throw new CoreError('damaged', 'This file is too large to be a Pokémon mini cartridge.');
      game = String(req.game.name || '');
      cart = new Uint8Array(g); bios = new Uint8Array(fw.bios);
      curFnv = fnv(cart);
      rate = Math.round((env.audioRate && env.audioRate()) || 48000);
      const k = BOOT_KEY[game];
      const st = k && states && states[k] && states[k].state;
      bootBlob = st ? b64u8(st) : null;
      const sc = k && scripts && scripts[k] && scripts[k].script;
      demoScript = sc && sc.length ? sc : null;
      demoMode = false; playerEeprom = null;
      canLink = linkable(cart);
      wantLink = !!(req.options && String(req.options.players) === '2');
      linked = canLink && wantLink && !!XB;
      playerEeprom2 = null; asGameDirty2 = false;
      if (linked && !link) link = new Link(X, XB);
      powerOn();
      hostFrames = 0;
      const ports = linked ? [
        { port: 0, kind: 'player', device: 'pm-pad', label: 'Player 1', controls: CONTROLS },
        { port: 2, kind: 'player', device: 'pm-pad', label: 'Player 2', controls: CONTROLS2 },
        { port: 1, kind: 'console', device: 'pm-console', label: 'Console', controls: CONSOLE },
      ] : [
        { port: 0, kind: 'player', device: 'pm-pad', controls: CONTROLS },
        { port: 1, kind: 'console', device: 'pm-console', controls: CONSOLE },
      ];
      const battery = [{ id: 'eeprom', kind: 'eeprom', bytes: X.pm_eeprom_size(), ext: '.eep' }];
      if (linked) battery.push({ id: 'eeprom2', kind: 'eeprom', bytes: XB.pm_eeprom_size(), ext: '.eep' });
      return {
        fps: FPS,
        video: linked ? { width: LINK_W, height: LINK_H, format: 'rgba8888', pixelAspect: 1, rotation: 0 }
          : { width: W, height: H, format: 'index8', pixelAspect: 1, rotation: 0, palette: MONO },
        audio: { rate },
        ports,
        battery,
        options: canLink ? [PLAYERS_OPTION] : [],
        extensions: { clock: true, attract: true },
        consoleKeys: CONSOLE_KEYS,
        attract: !!(bootBlob || demoScript),
        model: linked ? 'pm-link' : 'pm',
        note: linked ? LINK_NOTE : '',
        usedFirmware: 'bios',
      };
    },
    /* The Players choice: the game starts again with one unit or two (the host reloads it). */
    options() { return [Object.assign({ when: () => canLink }, PLAYERS_OPTION)]; },
    setOption(id) { return id === 'players' ? 'reload' : 'unknown'; },
    /* The Control Bar's Reset is a power cycle (A3); the EEPROM is the cartridge's own and
       survives it, and the slot-in and the snap run again, as the old window's Reset did. */
    reset() {
      if (!cart) return;
      playerEeprom = eepromNow();
      if (linked) playerEeprom2 = eepromNowB();
      powerOn();
    },
    setInput(port, s) {
      if (port === 0) pad = s.buttons & 0x7F;
      else if (port === 1) {
        power = s.buttons & 1 ? 0x80 : 0;
        const on = !!(s.buttons & 2);
        if (on && !shakeHeld) X.pm_shake(4);                      // one knock per press
        shakeHeld = on;
      } else if (port === 2 && linked) {
        padB = s.buttons & 0x7F; XB.pm_set_keys(padB);
        const on = !!(s.buttons & 0x80);
        if (on && !shakeHeldB) XB.pm_shake(4);                    // one knock per press, as player 1's
        shakeHeldB = on;
        return;
      }
      else return;
      keys = pad | power; X.pm_set_keys(keys);
    },
    runFrame() {
      if (!cart || locked) { audioBuf.frames = 0; return; }
      if (clockDue) { clockDue = false; setClock(); if (linked) { try { XB.pm_set_datetime(Math.floor(env.now() / 1000) >>> 0); } catch (_) {} } }
      if (linked) { link.run(CYCLES_PER_FRAME); carry = 0; }
      else {
        const want = CYCLES_PER_FRAME - carry;
        const ran = want > 0 ? X.pm_run_cycles(want) : 0;
        carry = Math.max(0, ran - want);
      }
      hostFrames++;
      heldFrame = null; heldPal = null;
      if (snapAt >= 0 && frames() >= snapAt) { snap(); if (linked) link.rebase(); }
      if (cheat) cheat.frame();                                  // our memory cheats (none on: nothing written)
      rumble = X.pm_rumble_state() | 0;
      if (X.pm_cpu_trapped()) { locked = true; env.emit('error', { message: `The game stopped: the core met an instruction it does not know (${X.pm_cpu_trap_op()}).` }); }
      if (linked) {
        heldFrameB = null; heldPalB = null;
        if (snapAtB >= 0 && framesB() >= snapAtB) { snapB(); link.rebase(); }
        rumble |= XB.pm_rumble_state() | 0;
        if (XB.pm_cpu_trapped() && !locked) { locked = true; env.emit('error', { message: `Player 2's game stopped: the core met an instruction it does not know (${XB.pm_cpu_trap_op()}).` }); }
      }
      // The samples this frame made (two players: both speakers, as two consoles side by side sound).
      const n = drain(X, audioBuf);
      audioBuf.frames = n;
      if (linked) {
        const n2 = drain(XB, audioB), m = Math.max(n, n2);
        if (audioBuf.data.length < m) { const d = new Float32Array(m * 2); d.set(audioBuf.data.subarray(0, n)); audioBuf.data = d; }
        const a = audioBuf.data, b = audioB.data;
        for (let i = n; i < m; i++) a[i] = 0;
        for (let i = 0; i < n2; i++) { const v = a[i] + b[i]; a[i] = v > 1 ? 1 : v < -1 ? -1 : v; }
        audioBuf.frames = m;
      }
    },
    video() {
      if (linked) return linkVideo();
      const p = heldFrame ? (heldPal || MONO) : pal();
      return { format: 'index8', width: W, height: H, stride: W, data: heldFrame || fbView(), palette: p };
    },
    audio() { return audioBuf; },
    serialize,
    check,
    unserialize,
    /* The old window's Continue history: its own ring of full machine images, oldest
       first. Each one loads as it is (unserialize reads the full image by its size). */
    legacyHistory(h) {
      if (!h || !h.data || h.size !== STATE_SIZE || !h.n) return null;
      const out = [];
      for (let i = 0; i < h.n; i++) out.push(h.data.slice(i * h.size, (i + 1) * h.size));
      return out;
    },
    battery: {
      read(id) { return id === 'eeprom' && cart ? eepromNow() : id === 'eeprom2' && cart && linked ? eepromNowB() : null; },
      /* The stored image going in (clean). Kept as the player's own, so the snap to the
         main screen puts it back over the captured one. { asGame } leaves it dirty.
         'eeprom2' is player 2's unit (two players only), kept apart from player 1's. */
      write(id, b, o) {
        if (id === 'eeprom2') {
          if (!linked || !cart || !b || b.length !== XB.pm_eeprom_size()) return false;
          playerEeprom2 = new Uint8Array(b);
          new Uint8Array(XB.memory.buffer, XB.pm_eeprom_ptr(), b.length).set(b);
          if (!(o && o.asGame)) XB.pm_eeprom_clear_dirty(); else asGameDirty2 = true;
          return true;
        }
        if (id !== 'eeprom' || !cart || !b || b.length !== X.pm_eeprom_size()) return false;
        playerEeprom = new Uint8Array(b);
        if (!demoMode) {
          new Uint8Array(X.memory.buffer, X.pm_eeprom_ptr(), b.length).set(b);
          if (!(o && o.asGame)) X.pm_eeprom_clear_dirty(); else asGameDirty = true;
        }
        return true;
      },
      dirty() {
        const out = cart && !demoMode && (X.pm_eeprom_dirty() || asGameDirty) ? ['eeprom'] : [];
        if (linked && cart && !demoMode && (XB.pm_eeprom_dirty() || asGameDirty2)) out.push('eeprom2');
        return out;
      },
      clean(id) {
        if (id === 'eeprom' && cart) { X.pm_eeprom_clear_dirty(); asGameDirty = false; }
        if (id === 'eeprom2' && cart && linked) { XB.pm_eeprom_clear_dirty(); asGameDirty2 = false; }
      },
    },
    ext: {
      clock: { set(ms) { try { X.pm_set_datetime(Math.floor(ms / 1000) >>> 0); if (linked) XB.pm_set_datetime(Math.floor(ms / 1000) >>> 0); } catch (_) {} } },
      /* A preview: the same boot and snap, keeping the captured EEPROM (no player save). */
      attract: { start() { if (!cart) return; demoMode = true; powerOn(); } },
      /* Cheats: our own memory codes for player 1's unit. */
      cheats: {
        kinds: () => cheatEng().kinds(),
        apply: codes => cheatEng().apply(codes),
      },
    },
    get model() { return linked ? 'pm-link' : 'pm'; },
    get note() { return linked ? LINK_NOTE : ''; },
    get noteGroup() { return 'machine'; },
    get linked() { return linked; },
    get link() { return link && linked ? { slices: link.stats.slices, edges: link.stats.edges.slice(), late: link.stats.late } : null; },
    get frames() { return hostFrames; },
    get prcFrames() { return frames(); },
    get rumble() { return rumble; },
    get rtc() { return X.pm_rtc_seconds() >>> 0; },
    get shock() { return X.pm_shock_active() | 0; },
    get booting() { return snapAt >= 0 || (linked && snapAtB >= 0); },
    destroy() { cart = null; },
  };
  return core;
}
