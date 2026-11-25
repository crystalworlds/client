/*
 * web/play/core.mjs -- the Sega 8-bit consoles (SG-1000, Mark III, Master System, Game Gear) for
 * the one play host (Core API 1.0). Served at play/cores/sega8/core.mjs, the path a site core
 * has, so it moves into the site with no change but its file list.
 *
 * WHAT IT WRAPS: build/s8play.wasm (the core, src/, plus the host and play entry points) through
 * host/core.mjs's Machine (served beside this file as machine.mjs) and host/loader.mjs's board
 * guess (loader.mjs). No DOM, no storage, no timers, no Date.now(), no key events.
 *
 * ONE CORE, MODEL RECORDS (brief section 4): the model is a data record chosen by the per-hash
 * table, with the Machine choice on top. The request may carry the loader's decision for this file
 * (req.cart: board, cart_ram, battery, medium, model, from host/loader.mjs decide()); without one,
 * the board is guessed here the same way and labelled guessed.
 *
 * SOUND: rate 0. The core band-limits its own output and makes it at env.audioRate(), the host's
 * rate with the drift servo in it, read every frame (docs/emulation/sound-output.md). The host
 * copies the blocks at step 1 (cw-audio.js push(..., paced)); its linear resampler never sees them.
 * Stereo float pairs; the core's own 20 Hz AC coupling, so the host adds no high-pass (filtered).
 *
 * PICTURE: the core's whole frame, 256 wide and 192, 224 or 240 lines, with its pixel shape by TV
 * standard (8:7 NTSC, about 1.386 PAL; REG-0150). The Game Gear shows the core's own screen
 * (s8_view, docs/emulation/gamegear.md): the 160x144 LCD window in Game Gear mode (REG-0071), and in
 * Master System mode the console's squeeze onto the LCD with its colour fringes, or the full frame
 * as an option (decision 6), at 6:5 (FITTED until a photograph settles it, REG-0149). The view is
 * made from the frame: the core's frame, its hashes and its states never change.
 *
 * INPUT (REG-0100, REG-0103, REG-0019, REG-0020): two pads with buttons 1 and 2 in the pad's order;
 * opposite directions held together are both let go, as the host masks them; Pause on every model
 * but the Game Gear (the VDP samples it once a frame; a press raises the NMI); Start on the Game Gear
 * (port $00 bit 7); Reset only on models that have the button (a polled input on port $DD).
 *
 * STATES are the whole machine. A battery cartridge's RAM is never replaced by a state
 * (S8_LOAD_KEEP_CART_RAM); battery RAM is offered to the host 30 frames after the game last wrote it.
 *
 * THE GEAR-TO-GEAR LINK (24 Nov 2026; docs/emulation/gamegear.md section 13): on a Game Gear game in
 * Game Gear mode, the "Gear-to-Gear cable" choice adds a second Game Gear in this same core instance:
 * both screens side by side in one picture, player 2 on port 1 with its own Start, both machines'
 * sound mixed, and a pair's state (player 1's state with a 'GGL1' trailer).
 */
import { CoreError } from '../../host/core-api.mjs';
import { Machine } from './machine.mjs';
import { guessBoard, stripCopierHeader, decideKey } from './loader.mjs';
import { cheatEngine } from '../cheats-core.mjs?v=2.3.0';
/* The handhelds' slow screen (the site's shared model, play/cores/gb/lcd.mjs): the picture only, never the frame. */
import { slowScreen } from '../gb/lcd.mjs?v=2.3.0';

/* Fetched with no-store, as the NES core does: a new core or table always reaches the player (20 Nov 2026). */
const WASM_URL = new URL('./s8play.wasm', import.meta.url);
/* The per-hash table as the site reads it (tools/site/site-table.mjs), beside this file. Optional:
   without it (the test bench, which passes the loader's decision itself) the board is guessed. */
const TABLE_URL = new URL('./site-table.json', import.meta.url);
/* Which wall device this module serves: the site loads it as core.mjs?sys=sg1000|sms|gg. */
const SYS_OF_URL = new URL(import.meta.url).searchParams.get('sys');

/* The Machine choices (index = the core's model enum, src/s8.h). */
export const MODELS = [
  { id: 'sms1-ntsc', label: 'Master System (NTSC)', fw: 'sms1' },
  { id: 'sms1-pal', label: 'Master System (PAL)', fw: 'sms1' },
  { id: 'sms2-ntsc', label: 'Master System II (NTSC)', fw: 'sms2' },
  { id: 'sms2-pal', label: 'Master System II (PAL)', fw: 'sms2' },
  { id: 'mark3', label: 'Mark III', fw: null },
  { id: 'smsj', label: 'Japanese Master System', fw: 'smsj' },
  { id: 'mark3-fm', label: 'Mark III with the FM Sound Unit', fw: null },
  { id: 'gg', label: 'Game Gear (two-chip board, VA1)', fw: 'gg' },
  { id: 'sg1000', label: 'SG-1000', fw: null },
  { id: 'gg-1asic', label: 'Game Gear (one-chip board)', fw: 'gg' },
  { id: 'gg-va0', label: 'Game Gear VA0 (no start-up firmware)', fw: null },
  /* Japanese Game Gear: region Japan and no start-up firmware (the launch board had none, and the
     units sold with Nazo Puyo ran no check; gamegear.md 1.1), otherwise the gg record. */
  { id: 'gg-jp', label: 'Japanese Game Gear', fw: null },
  /* The SG-1000 II: the SG-1000's chips with detachable pads (sg1000.md). */
  { id: 'sg1000-2', label: 'SG-1000 II', fw: null },
  /* The SG-1000 II's later one-chip board (the 315-5066: its own colours, Sega's PSG, 2 KB of RAM;
     sg1000.md section 7), as later units and the Korean and Taiwanese clone boards were built. */
  { id: 'sg1000-2b', label: 'SG-1000 II (later one-chip board)', fw: null },
  /* The PAL SG-1000 II (24 Nov 2026; sg1000.md section 10): the TMS9929A's 313-line, 50 Hz frame, the
     same chips otherwise. The per-hash table starts the SG-1000 builds made for PAL on it. */
  { id: 'sg1000-2-pal', label: 'SG-1000 II (PAL)', fw: null },
  /* Tsukuda's Othello Multivision (24 Nov 2026; sg1000.md section 11): a licensed SG-1000 compatible
     with a keypad and its own Othello, which runs when the slot is empty (BUILT_IN below). */
  { id: 'omv', label: 'Othello Multivision', fw: null },
];
const MODEL_INDEX = Object.fromEntries(MODELS.map((m, i) => [m.id, i]));
/* Which models may run a device's cartridges (the Machine rows), the first the device's default. */
export const DEVICE_MODELS = {
  /* The Master System II first: the default for a cartridge the per-hash table does not place
     (the console the project owns and tests on; docs/emulation/models.md). */
  sms: ['sms2-ntsc', 'sms2-pal', 'sms1-ntsc', 'sms1-pal', 'mark3', 'smsj', 'mark3-fm'],
  gg: ['gg', 'gg-1asic', 'gg-va0', 'gg-jp'],
  /* The SG-1000's two models, then the Mark III, which takes SG-1000 cartridges in its own slot
     (the Japanese connector) and shows them in its fixed TMS colours (REG-0037, REG-0143; sg1000.md
     section 6). An export Master System has another connector, and the Japanese Master System's
     running of SG-1000 software is unsourced (REG-0130), so neither is offered. */
  sg1000: ['sg1000', 'sg1000-2', 'sg1000-2b', 'sg1000-2-pal', 'omv', 'mark3'],
};
/* The start-up firmware slots each device's models use (MODELS fw). */
const DEVICE_FW = { sms: ['sms2', 'sms1', 'smsj'], gg: ['gg'], sg1000: [] };
/* Firmware a cartridge may name as its preferred one (the table's fw_pref) beyond the device's own
   slots: smsk, Samsung's Korean Master System II firmware (Gam*Boy II / Aladdin Boy II), which checks
   no header (SMS Power, BIOSes). Never in DEVICE_FW: it is not Sega's, so it never stands in for the
   console's own (step 2); only a Korean cartridge's record asks for it (20 Nov 2026). */
const PREF_FW = { sms: ['smsk'], gg: [], sg1000: [] };
/* THE FIRMWARE'S BUILT-IN GAMES (brief decision 11; 21 Nov 2026). A Master System whose
   start-up firmware holds a game plays it when the console is switched on with no cartridge. The site
   hands such a firmware image over as the "game" (its tile is the image, from the player's own game
   server), and this table, by the image's SHA-256, says it is one: the console then starts with that
   image as its firmware and an empty cartridge slot, as the real one does. Measured in this core
   (docs/emulation/boot.md, built-in games): each runs from power-on with no cartridge.
     models: the Machine rows that can hold this image (its firmware slot), the first the default;
     hold: buttons the player holds at power-on (Snail Maze, in the v1.3 and v2.0 images: Up, 1 and 2,
       read by the firmware once its logo ends, about frame 351 to 360 on NTSC and 331 to 340 on PAL;
       held here from power-on for HOLD_FRAMES);
     requires / supports: the controllers the game takes, as the per-hash table names them. */
const BUILT_IN = {
  'e9eb04ec80ded8658f765c4eca75cdbe23cbc7d8fed73f9c3db7a868dbf649ff': { title: 'Hang On & Safari Hunt', fw: 'sms1', models: ['sms1-ntsc', 'sms1-pal'], supports: ['phaser'] },
  '1a73bc6e1a9973b98432774a1480b3ac1259027a97590d5e67d52745159abbbc': { title: 'Hang On', fw: 'sms1', models: ['sms1-ntsc', 'sms1-pal'] },
  '13c0639cc037167f53e6151dbdea013758c3d09a76b064a894bf15c39c0a3897': { title: 'Missile Defense 3-D', fw: 'sms1', models: ['sms1-ntsc', 'sms1-pal'], requires: ['phaser', 'glasses3d'] },
  '0c08e17b0ecc3967e1094f12841fdc97fdcbbf986e3bf9a06b35b69e7d95e4cd': { title: 'Alex Kidd in Miracle World', fw: 'sms2', models: ['sms2-ntsc', 'sms2-pal'] },
  'c51ec80b7a609c5ee3d203ceee2b602ae4dfb4479caf15dc1d030c40c0364e93': { title: 'Sonic The Hedgehog', fw: 'sms2', models: ['sms2-pal', 'sms2-ntsc'] },
  '57abf3c00c82a8e042ebeb2bfe412adac9ba005e9009845236390de3ee645248': { title: 'Alex Kidd in Miracle World', fw: 'smsk', models: ['sms2-ntsc'] },
  '477617917a12a30f9f43844909dc2de6e6a617430f5c9a36306c86414a670d50': { title: 'Snail Maze', fw: 'sms1', models: ['sms1-ntsc', 'sms1-pal'], hold: ['up', 'b1', 'b2'] },
  '1eb16fc06ceaf05651d7cfd69d1713e6ddccc4349a511f6fd17e037d71f9d85b': { title: 'Snail Maze', fw: 'sms1', models: ['sms1-pal', 'sms1-ntsc'], hold: ['up', 'b1', 'b2'] },
  /* The Othello Multivision's own program (24 Nov 2026; sg1000.md section 11): Othello, built in. It is no
     start-up firmware: it answers the slot area only while the slot is empty, as a cartridge would, so it
     runs as the cartridge (asCart: the image in the slot, the plain board) on the Othello Multivision.
     Its keypad picks the square (A to H, 1 to 8); S-1 and S-2 are the pad's buttons 1 and 2. */
  'ab259b6b9be3a422aed5424af388f41f546cb9485210bdeea697a71916ce3d14': { title: 'Othello', device: 'sg1000', fw: 'omv', models: ['omv'], asCart: true },
};
const HOLD_FRAMES = 420;
export function builtInGame(sha) { return BUILT_IN[String(sha || '').toLowerCase()] || null; }
const DEVICE_OF_EXT = { '.sms': 'sms', '.gg': 'gg', '.sg': 'sg1000', '.sc': 'sg1000', '.mv': 'sg1000' };
export function deviceOfName(name) {
  const m = /\.[a-z0-9]+$/i.exec(String(name || ''));
  return (m && DEVICE_OF_EXT[m[0].toLowerCase()]) || 'sms';
}
/* The per-hash table's model words (host/loader.mjs MODEL_OF) for the default. */
const FW_LABEL = { sms1: 'Master System start-up firmware', sms2: 'Master System II start-up firmware',
  smsj: 'Japanese Master System start-up firmware', gg: 'Game Gear start-up firmware',
  smsk: 'Korean Master System II (Samsung) start-up firmware' };
const SETTLE = 30;               /* frames a battery's RAM must stay still before it is offered */
const PAL_ASPECT = 14750000 / 10640684.8;   /* PAL square-pixel rate over the VDP's dot rate x 2 */
const GG_ASPECT = 6 / 5;          /* FITTED, REG-0149 */
/* The border a television shows around the picture (20 Nov 2026): 13 columns before the picture and 15
   after it (vdp.md section 1: the picture at hpos 8-263, the border to 278, and the left border's
   other 5 columns at the end of the line before); lines below the picture by mode, and the rest of
   the total above it: NTSC 192 lines 27 above and 24 below, 224 lines 11 and 8; PAL 192 lines 54
   and 48, 224 lines 38 and 32, 240 lines 30 and 24 (Charles MacDonald's VDP document, the border
   line counts). The totals, 243 and 294 lines, make a 4:3 picture at each standard's pixel shape. */
const TV_LEFT = 13, TV_W = 256 + 13 + 15;
const TV_BORDER = { ntsc: { total: 243, bottom: { 192: 24, 224: 8, 240: 0 } }, pal: { total: 294, bottom: { 192: 48, 224: 32, 240: 24 } } };
/* THE GAME GEAR'S SLOW SCREEN (decision 4: on by default). Its passive-matrix colour LCD takes several
   frames to change, so a sprite drawn on alternate frames shows steady and half-clear on the console, and
   moving things trail. Each emulated frame every pixel moves this share of the way to the mean of this
   frame and the last (lcd.mjs). FITTED by eye: no published measurement of the panel was found; slower
   than the Game Boy Color's panel (0.8), about the first Game Boy's (0.55). Off: every frame sharp. */
const GG_FOLLOW = 0.6;
/* THE GAME GEAR'S FULLER LCD LOOK (decision 4: a choice, off by default; 21 Nov 2026). On top of the
   slow screen, the panel as it looks up close: each pixel drawn 3 by 3 as its three colour stripes (blue, green,
   red from the left, as the Game Gear's panel orders them, REG-0070), a darker line between pixel rows, the
   faint vertical bleed of a passive-matrix panel (each column takes a share of its own average colour) and the
   panel's washed-out colour (black lifted, contrast and saturation lower). Every amount is FITTED by eye: no
   measurement of the panel was found. The picture layer only: never the frame, its hashes, its states, the
   tile clips or a saved picture. */
const LCD = { other: 0.55, gap: 0.72, bleed: 0.10, lift: 22, gain: 0.80, sat: 0.82 };
const px = (r, g, b) => 0xFF000000 | (Math.min(255, b) << 16) | (Math.min(255, g) << 8) | Math.min(255, r);

/* Pad bits as the console reads them (all active low). */
const DC = { p1: { up: 0, down: 1, left: 2, right: 3, b1: 4, b2: 5 }, p2: { up: 6, down: 7 } };
const DD = { p2: { left: 0, right: 1, b1: 2, b2: 3 }, reset: 4, ggStart: 7 };

/* Keyboard defaults, the site's habits: arrows and Z X for player 1 (1 on the left, as on the pad),
   I J K L with F G for player 2, Enter for Pause or Start, the right Shift for Reset. */
const P1 = { up: ['ArrowUp'], down: ['ArrowDown'], left: ['ArrowLeft'], right: ['ArrowRight'], b1: ['KeyZ'], b2: ['KeyX'] };
const P2 = { up: ['KeyI'], down: ['KeyK'], left: ['KeyJ'], right: ['KeyL'], b1: ['KeyF'], b2: ['KeyG'] };
/* The Gear-to-Gear link's second Game Gear: player 2's keys, with T for its Start (as the Game Boy link's). */
const P2_GG = Object.assign({}, P2, { start: ['KeyT'] });
/* THE GEAR-TO-GEAR LINK (A7-SEGA, 24 Nov 2026; docs/emulation/gamegear.md section 13). Two Game Gears joined by
   the cable, in this one core instance, the second machine made beside the first (machine.mjs sibling): one
   wide picture, the two screens side by side with a dark gap (as the Game Boy link's), the second player on
   port 1, both machines' sound mixed. A pair's state is player 1's ordinary state with a trailer: the tag
   'GGL1', its length, player 2's state and the cable's block of both (the core's p_link_save). */
const LINK_GAP = 16, LINK_TAG = 0x314C4747;   /* 'GGL1' read as a little-endian u32 */
/* The Othello Multivision: its keypad's A to H take the letter keys, so controller 2's buttons move to N and M. */
const P2_OMV = Object.assign({}, P2, { b1: ['KeyN'], b2: ['KeyM'] });
/* Its keys in the core's bit order (s8.h s8_set_keypad): 1-9, 0, then A-H. */
const OMV_KEYS = [['1', ['Digit1', 'Numpad1']], ['2', ['Digit2', 'Numpad2']], ['3', ['Digit3', 'Numpad3']], ['4', ['Digit4', 'Numpad4']],
  ['5', ['Digit5', 'Numpad5']], ['6', ['Digit6', 'Numpad6']], ['7', ['Digit7', 'Numpad7']], ['8', ['Digit8', 'Numpad8']],
  ['9', ['Digit9', 'Numpad9']], ['0', ['Digit0', 'Numpad0']], ['A', ['KeyA']], ['B', ['KeyB']], ['C', ['KeyC']], ['D', ['KeyD']],
  ['E', ['KeyE']], ['F', ['KeyF']], ['G', ['KeyG']], ['H', ['KeyH']]];
function padControls(k) {
  return [
    { id: 'up', label: 'Up', type: 'button', defaults: { key: k.up, pad: ['up'] } },
    { id: 'down', label: 'Down', type: 'button', defaults: { key: k.down, pad: ['down'] } },
    { id: 'left', label: 'Left', type: 'button', defaults: { key: k.left, pad: ['left'] } },
    { id: 'right', label: 'Right', type: 'button', defaults: { key: k.right, pad: ['right'] } },
    { id: 'b1', label: '1', type: 'button', defaults: { key: k.b1, pad: ['A', 'X'] } },
    { id: 'b2', label: '2', type: 'button', defaults: { key: k.b2, pad: ['B', 'Y'] } },
  ];
}

export const manifest = {
  api: '1.0', id: 'sega8', label: 'Sega 8-bit', form: 'console', build: null, thread: 'worker',
  files: {
    game: { exts: ['.sms', '.gg', '.sg', '.sc', '.mv', '.bin'], maxBytes: 4 * 1024 * 1024 },
    firmware: Object.keys(FW_LABEL).map(id => ({ id, label: FW_LABEL[id], required: false })),
  },
  /* Never required: without the console's own, ours runs, or none (the start-up firmware order). The
     host fetches the player's own for the device's models, so a Machine change finds it in hand.
     A preferred firmware (PREF_FW, the Korean one) only for a file whose record names it (the table's
     fw_pref, by the hash the host made of the file: its second argument), so Settings shows its row
     only where it can apply. The table is asked for here, in the page, on the first call (never as the
     module loads: a module-level fetch stalled the core's worker start on the site, S8F7-2); until it
     has arrived, or with no hash, every slot is offered, so a Korean cartridge never misses its own. */
  firmwareFor: (bytes, sha) => {
    if (builtInGame(sha)) return [];           /* a firmware's built-in game: the image itself is the firmware */
    const own = DEVICE_FW[SYS_OF_URL] || [], extra = PREF_FW[SYS_OF_URL] || [];
    if (!extra.length) return own;
    if (!tableNow && typeof fetch === 'function') siteTable();
    if (!tableNow || !/^[0-9a-f]{64}$/.test(String(sha || ''))) return own.concat(extra);
    const row = tableNow.table.get(String(sha));
    const pref = row && row.fw_pref;
    return extra.includes(pref) ? own.concat([pref]) : own;
  },
  video: { kind: 'raster', maxWidth: 512, maxHeight: 294, screens: 1 },   /* 512: the 3-D glasses' side-by-side view; 294: a PAL television's picture with its border */
  audio: { channels: 2, format: 'f32', filtered: true },
  state: { supported: true, deterministic: true, approxBytes: 64 * 1024 },
  extensions: ['options'],
  modelLabel: id => (MODELS[MODEL_INDEX[id]] || {}).label || 'Sega 8-bit',
};

let modPromise = null;
function wasmModule() {
  if (!modPromise) modPromise = fetch(WASM_URL, { cache: 'no-store' }).then(r => { if (!r.ok) throw new Error('the core file is missing (' + r.status + ')'); return r.arrayBuffer(); })
    .then(b => WebAssembly.compile(b));
  return modPromise;
}

let tablePromise = null, tableNow = null;
function siteTable() {
  if (!tablePromise) tablePromise = fetch(TABLE_URL, { cache: 'no-store' }).then(r => (r.ok ? r.json() : null)).catch(() => null).then(j => {
    if (!j || j.format !== 's8-site-table/1') return null;
    const toMap = (rows, cols) => new Map(Object.entries(rows || {}).map(([k, v]) => [k, Object.fromEntries(cols.map((c, i) => [c, v[i] ?? '']))]));
    return (tableNow = { table: toMap(j.rows, j.cols), settled: toMap(j.settled, j.settledCols) });
  });
  return tablePromise;
}

export async function create(env) {
  const m = await Machine.create(await wasmModule());
  const X = m.x;
  const T = await siteTable();
  let req = null, cart = null, device = 'sms', model = 0, fwUsed = 'none', fwRoleUsed = null, decision = null, builtIn = null;
  let ins = new Map(), frames = 0;
  let bat = { on: false, flushed: 0, lastSeen: 0, still: 0, dirty: false };
  let speaker = 0, ggSms = false, ggFull = false, dims = 0;
  let ggScreen = 'real', crop = 'full', lcdBuf = null;
  const lcdCol = new Float32Array(256 * 3);
  const screen = slowScreen(), cropBuf = new Uint32Array(240 * 240), tvBuf = new Uint32Array(TV_W * 294);
  const acc = accessories(X, m);
  /* The Gear-to-Gear link: the second Game Gear (made on first use, kept), its slow screen, its battery,
     the wide picture and the sound it adds (a queue, so neither machine's samples are dropped or doubled
     when the two give a sample more or fewer in a frame). */
  let m2 = null, linkOn = false, linkPic = null, linkBuf = 0, link2Q = new Float32Array(0), link2N = 0, mixBuf = new Float32Array(0);
  const screen2 = slowScreen();
  const bat2 = { on: false, flushed: 0, lastSeen: 0, still: 0, dirty: false };
  const HAS_LINK = typeof X.p_link_frame === 'function';
  /* CHEATS: memory codes on the work RAM (the shared cheats engine, kind ra-mem: work RAM from 0,
     as $C000 on the console). Written after every frame, as the cartridge devices did. */
  const cheat = typeof X.p_ram_poke === 'function' ? cheatEngine({
    kinds: ['ra-mem'], token: () => m, slots: 0, setSlot() {}, clear() {},
    poke: (a, v) => X.p_ram_poke(m.ctx, a, v) === 1,
    peek: a => X.p_ram_peek(m.ctx, a),
    raAddr: a => (a < 0x2000 ? 0xC000 + a : a),
  }) : null;
  const audioView = { data: new Float32Array(0), frames: 0 };

  function info(i) {
    return { lines: X.p_model_field(i, 0), hz: X.p_model_field(i, 1), pal: !!X.p_model_field(i, 2), reset: !!X.p_model_field(i, 3),
      fwSlot: !!X.p_model_field(i, 4), pads: X.p_model_field(i, 5), gg: !!X.p_model_field(i, 6), fm: !!X.p_model_field(i, 7) };
  }
  const fpsOf = i => { const f = info(i); return f.hz / (3420 * f.lines); };

  /* The Machine rows: the device's models, or for a built-in game the models whose firmware slot holds that image. */
  const modelList = () => (builtIn ? builtIn.models : DEVICE_MODELS[device] || DEVICE_MODELS.sms);
  function chooseModel(r) {
    const o = r.options || {};
    const list = modelList();
    if (o.machine && o.machine !== 'auto' && list.includes(o.machine)) return MODEL_INDEX[o.machine];
    if (decision && decision.model && list.includes(decision.model)) return MODEL_INDEX[decision.model];
    return MODEL_INDEX[list[0]];
  }

  function build(r) {
    req = r;
    const raw = r.game && r.game.bytes;
    if (!raw || raw.length < 1024) throw new CoreError('damaged', 'This file is too short to be a Sega cartridge.');
    /* The largest file this player takes (manifest files.game.maxBytes, with room for a copier's
       512-byte header): the host does not check it, and a larger file is no Sega 8-bit cartridge
       (the largest in the library is 4 MB). The bad-file test, tools/badfile. */
    if (raw.length > manifest.files.game.maxBytes + 512) throw new CoreError('damaged', 'This file is larger than any Sega cartridge.');
    /* A firmware's built-in game (BUILT_IN): the image is the console's firmware and the slot is empty. */
    builtIn = builtInGame(r.game.sha256);
    const { data, stripped } = builtIn && !builtIn.asCart ? { data: new Uint8Array(0), stripped: false } : stripCopierHeader(raw instanceof Uint8Array ? raw : new Uint8Array(raw));
    cart = data;
    device = builtIn ? (builtIn.device || 'sms') : (r.cart && r.cart.device) || (DEVICE_MODELS[r.system] ? r.system : null) || (DEVICE_MODELS[SYS_OF_URL] ? SYS_OF_URL : null) || deviceOfName(r.game.name);
    decision = builtIn ? { board: builtIn.asCart ? 'plain' : 'sega', board_src: builtIn.asCart ? 'built into the console' : 'no cartridge', cart_ram: 0, battery: false, model: builtIn.models[0],
      requires: builtIn.requires || [], supports: builtIn.supports || [] } : (r.cart || null);
    /* The site: the per-hash table's decision for this file, by the hash the host already made of it
       (the same as the table's key unless a copier header was removed, when the board is guessed). */
    if (!decision && T && r.game.sha256 && !stripped) decision = decideKey(String(r.game.sha256), cart, false, device, T.table, T.settled);
    model = chooseModel(r);
    const mi = MODELS[model], f = info(model);
    const o = r.options || {};
    let board = decision && decision.board, cartRam = decision ? decision.cart_ram : undefined, battery = decision ? !!decision.battery : false;
    if (!board) {
      const g = guessBoard(device, cart);
      board = g.board; decision = Object.assign({}, decision || {}, { board, board_src: 'guessed', board_why: g.why });
      cartRam = board === 'sega' || board === 'codemasters' ? 32768 : board === 'sg-ram' || board === 'taiwan-a' ? 8192 : 0;
      battery = board === 'sega' || board === 'codemasters';
    }
    /* The start-up firmware order (standing rule): the original, then ours, then none. */
    const want = String(o.firmware || 'original');
    const fwBytes = mi.fw && r.firmware ? r.firmware[mi.fw] : null;
    let fw = 'none', fwRole = mi.fw, fwPick = fwBytes;
    /* A built-in game always starts its own image: it is the game (never ours, never none). */
    if (builtIn && f.fwSlot) { fw = 'original'; fwRole = builtIn.fw; fwPick = raw instanceof Uint8Array ? raw : new Uint8Array(raw); }
    else if (f.fwSlot) {
      /* The start-up firmware order (20 Nov 2026), while the player leaves the choice on the
         console's own. 0) When the cartridge's record names a preferred firmware (the table's fw_pref):
         "none" starts with none, "ours" with ours, a named image with that image if the player has it,
         otherwise ours (never down to the console's own). With no preferred value, the standing list:
         1) the console's own; 2) any other Sega firmware of this device the player has; 3) ours.
         No refusal ever moves a cartridge down this list. */
      const pref = want === 'original' && decision && decision.fw_pref;
      const roles = !pref && want === 'original' ? [...new Set([mi.fw, ...(DEVICE_FW[device] || [])].filter(Boolean))] : [];
      const role = roles.find(x => r.firmware && r.firmware[x]);
      if (pref === 'none') fw = 'none';
      else if (pref === 'ours') fw = 'ours';
      else if (pref) { if (r.firmware && r.firmware[pref]) { fwRole = pref; fwPick = r.firmware[pref]; fw = 'original'; } else fw = 'ours'; }
      else if (role) { fwRole = role; fwPick = r.firmware[role]; fw = 'original'; }
      else if (want !== 'none') fw = 'ours';
    }
    fwUsed = fw === 'original' ? 'original' : fw; fwRoleUsed = fwRole;
    ggSms = !!(f.gg && decision && decision.gg_sms);
    ggFull = o.ggSmsPicture === 'full';
    ggScreen = o.ggScreen === 'sharp' ? 'sharp' : o.ggScreen === 'lcd' ? 'lcd' : 'real';
    crop = o.crop === 'balanced' ? 'balanced' : 'full';
    screen.reset();
    const initOpts = { model, board, battery, cartRam: cartRam || 0, medium: decision && decision.medium === 'card' ? 'card' : 'cartridge',
      fw, fwBytes: fw === 'original' ? fwPick : null, seed: (o.seed >>> 0) || 0, ggSms };
    m.init(cart, initOpts);
    if (r.battery && r.battery.cart && m.hasBattery()) m.loadCartRam(r.battery.cart);
    /* The Gear-to-Gear cable: on the Game Gear in Game Gear mode only (the EXT port does nothing in Master
       System mode). The second Game Gear: the same cartridge, Machine, firmware and options, its own battery. */
    linkOn = HAS_LINK && f.gg && !ggSms && !builtIn && o.link === 'gg';
    if (linkOn) {
      if (!m2) m2 = m.sibling();
      m2.init(cart, initOpts);
      if (r.battery && r.battery.cart2 && m2.hasBattery()) m2.loadCartRam(r.battery.cart2);
      X.p_link(m.ctx, m2.ctx);
      screen2.reset(); link2N = 0;
    } else X.p_link(m.ctx, 0);
    acc.plug(decision, o, f, model);
    batReset();
    frames = 0;
    speaker = o.ggSpeaker === 'speaker' ? 1 : 0;
    X.p_gg_speaker(m.ctx, speaker);
    X.p_audio_rate(m.ctx, Math.round(env.audioRate ? env.audioRate() : 48000));
    if (linkOn) { X.p_gg_speaker(m2.ctx, speaker); X.p_audio_rate(m2.ctx, Math.round(env.audioRate ? env.audioRate() : 48000)); }
  }
  function batReset() {
    bat.on = m.hasBattery();
    bat.flushed = bat.lastSeen = m.cartRamWrites(); bat.still = 0; bat.dirty = false;
    bat2.on = linkOn && m2.hasBattery();
    bat2.flushed = bat2.lastSeen = bat2.on ? m2.cartRamWrites() : 0; bat2.still = 0; bat2.dirty = false;
  }
  function batTick() {
    for (const [b, mm] of [[bat, m], [bat2, m2]]) {
      if (!b.on) continue;
      const w = mm.cartRamWrites();
      if (w !== b.lastSeen) { b.lastSeen = w; b.still = 0; continue; }
      if (w !== b.flushed && ++b.still >= SETTLE) b.dirty = true;
    }
  }

  function ports() {
    const f = info(model);
    const out = [{ port: 0, kind: 'player', device: 'sega-pad', label: f.gg ? 'Game Gear' : 'Controller 1', controls: padControls(P1) }];
    const omv = MODELS[model].id === 'omv';
    if (f.pads > 1) out.push({ port: 1, kind: 'player', device: 'sega-pad', label: 'Controller 2', controls: padControls(omv ? P2_OMV : P2) });
    const con = [];
    if (f.gg) con.push({ id: 'start', label: 'Start', type: 'button', defaults: { key: ['Enter', 'NumpadEnter'], pad: ['start'] } });
    else if (!omv) con.push({ id: 'pause', label: 'Pause', type: 'button', defaults: { key: ['Enter', 'NumpadEnter'], pad: ['start'] } });   /* the Othello Multivision has no Hold button */
    if (f.reset) con.push({ id: 'reset', label: 'Reset', type: 'button', defaults: { key: ['ShiftRight'], pad: ['select'] } });
    if (con.length) out.push({ port: 2, kind: 'console', device: 'sega-console', label: 'Console', controls: con });
    /* The Othello Multivision's keypad (s8_set_keypad): 1 to 9, 0 on the digits, A to H on the letters. */
    if (omv) out.push({ port: 3, kind: 'player', device: 'omv-keypad', label: 'Othello Multivision keypad',
      controls: OMV_KEYS.map(([l, k]) => ({ id: 'key-' + l, label: 'Keypad ' + l, type: 'button', defaults: { key: k } })) });
    /* The Gear-to-Gear link: player 2's Game Gear, its pad and its own Start (the site gives the second pad to port 1). */
    if (linkOn) out.push({ port: 1, kind: 'player', device: 'sega-pad', label: 'Player 2 (second Game Gear)',
      controls: padControls(P2_GG).concat([{ id: 'start', label: 'Start', type: 'button', defaults: { key: P2_GG.start, pad: ['start'] } }]) });
    return acc.ports(out);                     /* a Light Phaser, paddle or Sports Pad takes its port's place */
  }
  let portList = [];
  const bitOf = (pi, id) => { const p = portList.find(x => x.port === pi); return p ? p.controls.findIndex(c => c.id === id) : -1; };
  const held = (pi, id) => { const s = ins.get(pi); const b = bitOf(pi, id); return !!(s && b >= 0 && (s.buttons >> b) & 1); };

  function applyInput() {
    let dc = 0xFF, dd = 0xFF;
    const pad = (pi, map, mapLow) => {
      let u = held(pi, 'up'), d = held(pi, 'down'), l = held(pi, 'left'), r = held(pi, 'right');
      if (u && d) u = d = false;                 /* REG-0100: the host masks opposite directions */
      if (l && r) l = r = false;
      const press = { up: u, down: d, left: l, right: r, b1: held(pi, 'b1'), b2: held(pi, 'b2') };
      for (const k of Object.keys(press)) if (press[k]) { if (map[k] !== undefined) dc &= ~(1 << map[k]); else if (mapLow && mapLow[k] !== undefined) dd &= ~(1 << mapLow[k]); }
    };
    if (!acc.on(0)) pad(0, DC.p1, null);
    /* A built-in game started by a hold at power-on (Snail Maze): the buttons are held for the player
       until the firmware has read them (HOLD_FRAMES), as the documented way to start it. */
    if (builtIn && builtIn.hold && frames < HOLD_FRAMES) for (const k of builtIn.hold) dc &= ~(1 << DC.p1[k]);
    if (linkOn) {
      /* player 2's Game Gear: its pad as player 1's, and its own Start */
      const p1 = [dc, dd]; dc = 0xFF; dd = 0xFF;
      pad(1, DC.p1, null);
      if (held(1, 'start')) dd &= ~(1 << DD.ggStart);
      m2.pad(dc, dd);
      [dc, dd] = p1;
    } else if (!acc.on(1)) pad(1, DC.p2, DD.p2);
    if (held(2, 'reset')) dd &= ~(1 << DD.reset);
    if (held(2, 'start')) dd &= ~(1 << DD.ggStart);
    m.pad(dc, dd);
    X.p_pause(m.ctx, held(2, 'pause') ? 1 : 0);
    if (X.p_keypad) { let k = 0; if (MODELS[model].id === 'omv') OMV_KEYS.forEach(([l], i) => { if (held(3, 'key-' + l)) k |= 1 << i; }); X.p_keypad(m.ctx, k); }
    acc.step(ins, held, frames);
  }

  function frameView() {
    const h = X.p_frame_h(m.ctx), p = X.p_frame(m.ctx);
    const full = new Uint32Array(m.mem.buffer, p, 256 * h);
    const f = info(model);
    if (!f.gg) {
      const v3 = acc.view3d(full, h);          /* the 3-D glasses' view (decision 8), made from the frame */
      const pa = f.pal ? PAL_ASPECT : 8 / 7;
      if (v3.width !== 256) { m.tvGeom = null; return { format: 'rgba8888', width: v3.width, height: h, stride: v3.width, data: v3.data, pixelAspect: pa, rotation: 0 }; }
      /* THE TELEVISION'S PICTURE. A television shows the console's picture with its border round it:
         13 columns before the picture and 15 after, and the border lines above and below (TV_BORDER),
         in the backdrop colour the VDP draws there (p_border: each line's colour; the top border takes
         the first picture line's). That whole picture (284 columns, NTSC 243 lines, PAL 294) is 4:3,
         but a television never shows all of it: its overscan puts the edges behind the bezel.
         THE SET'S OVERSCAN (21 Nov 2026, the hand test: "You made it just a box. It needs to be curved like
         Mario on NES is and fit the TV image"): the play window shows what a television shows, the
         way the NES window does (the NES's 256 columns, at the same dot clock, fill the set's glass
         from side to side): the game's 256 columns fill the glass, and the lines with them at the
         console's own pixel shape, the same share of the height as of the width (256 of 284, about
         10% overscan each way: NTSC 219 of 243 lines, PAL 265 of 294), centred on the tube. So a
         192-line game shows 15 border lines above and 12 below on NTSC, as a set shows them, and no
         border at the sides. A game taller than that window (224 lines on NTSC) keeps every line: the
         window grows to its height and, 4:3, takes in a few border columns each side. The game's
         corners stay in view (20 Nov 2026, HT-2: "cut off at the corners"): the glass's rounded
         corners (about 17 lines down and 15 columns in at this window) take under a pixel off them.
         THE BALANCED CROP (an option; REG-0047): the 8-pixel column a game blanks at the left for its
         scrolling is shown as border too, and the same 8 at the right, so the picture is centred.
         The frame itself is unchanged. */
      const bd = new Uint32Array(m.mem.buffer, X.p_border(m.ctx), h + 64);
      const B = TV_BORDER[f.pal ? 'pal' : 'ntsc'], bot = Math.max(0, B.bottom[h] ?? 0), tot = B.total, top = Math.max(0, tot - h - bot);
      const cut = crop === 'balanced' ? 8 : 0;
      let wh = Math.round(tot * 256 / TV_W), ww = 256;
      if (h > wh) { wh = Math.min(tot, h); ww = Math.min(TV_W, 2 * Math.round(wh * TV_W / tot / 2)); }
      const x0 = TV_LEFT - (ww - 256) / 2;                                       /* the window's first column of the television's picture */
      const y0 = Math.max(top + h - wh, Math.min(top, Math.round((tot - wh) / 2)));   /* centred on the tube, never across the game */
      const px = TV_LEFT - x0;                                                   /* the game's first column in the window */
      for (let y = 0; y < wh; y++) {
        const row = tvBuf.subarray(y * ww, (y + 1) * ww), fy = y0 + y - top;
        if (fy >= 0 && fy < h) {
          const c = bd[fy];
          row.fill(c, 0, px + cut);
          row.set(v3.data.subarray(fy * 256 + cut, fy * 256 + 256 - cut), px + cut);
          row.fill(c, px + 256 - cut);
        } else row.fill(fy < 0 ? bd[0] : bd[Math.min(fy, h + 63)]);
      }
      /* CRAM dots in the border (REG-0054): a colour written while the beam is on a border pixel
         shows there for that frame (the core keeps them; dots in the picture are in the frame);
         a dot in the part the set's overscan hides is not shown. */
      const dn = X.p_dot_n ? X.p_dot_n(m.ctx) : 0;
      if (dn) {
        const dp = X.p_dots(m.ctx), d16 = new Int16Array(m.mem.buffer, dp, dn * 4), d32 = new Uint32Array(m.mem.buffer, dp, dn * 2);
        for (let i = 0; i < dn; i++) {
          const ty = top + d16[i * 4 + 1] - y0, tx = TV_LEFT + d16[i * 4] - x0;
          if (ty >= 0 && ty < wh && tx >= 0 && tx < ww) tvBuf[ty * ww + tx] = d32[i * 2 + 1];
        }
      }
      m.tvGeom = { l: px, t: top - y0, W: ww, H: wh };   /* where the frame sits in the picture: the accessories' pointer */
      return { format: 'rgba8888', width: ww, height: wh, stride: ww, data: tvBuf.subarray(0, ww * wh), pixelAspect: pa, rotation: 0 };
    }
    m.tvGeom = null;
    const v = ggView();
    const shown = ghostOn() && screen.picture && screen.picture.length === v.width * v.height ? screen.picture : v.data;
    const pa = v.width === 160 ? GG_ASPECT : 8 / 7;
    if (linkOn) return linkView(v, shown, pa);
    if (ggScreen === 'lcd') return { format: 'rgba8888', width: v.width * 3, height: v.height * 3, stride: v.width * 3, data: lcdLook(shown, v.width, v.height), pixelAspect: pa, rotation: 0 };
    return { format: 'rgba8888', width: v.width, height: v.height, stride: v.width, data: shown, pixelAspect: pa, rotation: 0 };
  }
  /* The fuller LCD look (LCD above): the shown picture, w x h, drawn 3 by 3. */
  function lcdLook(src, w, h) {
    const W = w * 3, n = W * h * 3;
    if (!lcdBuf || lcdBuf.length < n) lcdBuf = new Uint32Array(n);
    lcdCol.fill(0);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const c = src[y * w + x]; lcdCol[x * 3] += c & 255; lcdCol[x * 3 + 1] += (c >>> 8) & 255; lcdCol[x * 3 + 2] += (c >>> 16) & 255; }
    for (let i = 0; i < w * 3; i++) lcdCol[i] /= h;
    const o = LCD.other, keep = 1 - LCD.bleed;
    for (let y = 0; y < h; y++) {
      const r0 = y * 3 * W;
      for (let x = 0; x < w; x++) {
        const c = src[y * w + x];
        let r = (c & 255) * keep + lcdCol[x * 3] * LCD.bleed, g = ((c >>> 8) & 255) * keep + lcdCol[x * 3 + 1] * LCD.bleed, b = ((c >>> 16) & 255) * keep + lcdCol[x * 3 + 2] * LCD.bleed;
        const l = 0.299 * r + 0.587 * g + 0.114 * b;
        r = LCD.lift + LCD.gain * (l + (r - l) * LCD.sat); g = LCD.lift + LCD.gain * (l + (g - l) * LCD.sat); b = LCD.lift + LCD.gain * (l + (b - l) * LCD.sat);
        /* the three stripes, blue, green, red: each its own colour in full and the others dimmed */
        const s0 = px(r * o, g * o, b), s1 = px(r * o, g, b * o), s2 = px(r, g * o, b * o);
        const d = LCD.gap, s0g = px(r * o * d, g * o * d, b * d), s1g = px(r * o * d, g * d, b * o * d), s2g = px(r * d, g * o * d, b * o * d);
        const i = r0 + x * 3;
        lcdBuf[i] = s0; lcdBuf[i + 1] = s1; lcdBuf[i + 2] = s2;
        lcdBuf[i + W] = s0; lcdBuf[i + W + 1] = s1; lcdBuf[i + W + 2] = s2;
        lcdBuf[i + 2 * W] = s0g; lcdBuf[i + 2 * W + 1] = s1g; lcdBuf[i + 2 * W + 2] = s2g;
      }
    }
    return lcdBuf.subarray(0, n);
  }
  /* The Game Gear: the core's own screen (s8_view): the LCD window in Game Gear mode; in Master
   * System mode the console's squeeze with its colour fringes, or the full frame (decision 6). */
  function ggView() {
    if (!dims) dims = m.alloc(8);
    const vp = X.p_view(m.ctx, ggSms && ggFull ? 1 : 0, dims);
    const d = new Int32Array(m.mem.buffer, dims, 2), w = d[0], vh = d[1];
    return { width: w, height: vh, data: new Uint32Array(m.mem.buffer, vp, w * vh) };
  }
  const ghostOn = () => ggScreen !== 'sharp' && info(model).gg;
  /* The Gear-to-Gear link's picture: the two screens side by side, LINK_GAP dark columns between (the
     fuller LCD look is not drawn here: the picture would be 1,008 wide; each screen keeps its slow screen). */
  function ggView2() {
    if (!dims) dims = m.alloc(8);
    const vp = X.p_view(m2.ctx, 0, dims);
    const d = new Int32Array(m.mem.buffer, dims, 2);
    return { width: d[0], height: d[1], data: new Uint32Array(m.mem.buffer, vp, d[0] * d[1]) };
  }
  function linkView(v, shown, pa) {
    const v2 = ggView2();
    const shown2 = ghostOn() && screen2.picture && screen2.picture.length === v2.width * v2.height ? screen2.picture : v2.data;
    const W = v.width * 2 + LINK_GAP, H = Math.max(v.height, v2.height);
    if (!linkPic || linkPic.length !== W * H) linkPic = new Uint32Array(W * H);
    linkPic.fill(0xFF101010);
    for (let y = 0; y < v.height; y++) linkPic.set(shown.subarray(y * v.width, (y + 1) * v.width), y * W);
    for (let y = 0; y < v2.height; y++) linkPic.set(shown2.subarray(y * v2.width, (y + 1) * v2.width), y * W + v.width + LINK_GAP);
    return { format: 'rgba8888', width: W, height: H, stride: W, data: linkPic, pixelAspect: pa, rotation: 0 };
  }

  function optionDefs() {
    const list = modelList();
    const dflt = decision && decision.model && list.includes(decision.model) ? decision.model : list[0];
    const defs = [
      { id: 'machine', label: 'Machine', type: 'enum', group: 'machine', scope: 'game', live: false, bar: true, default: 'auto',
        notice: 'Changing this restarts the game.',
        help: 'The console the game runs on. Saves and save states are kept for each machine.',
        values: [{ v: 'auto', label: `${builtIn ? 'The console this firmware came in' : 'As the cartridge wants'} (${MODELS[MODEL_INDEX[dflt]].label})` }].concat(list.map(id => ({ v: id, label: MODELS[MODEL_INDEX[id]].label }))) },
      { id: 'firmware', label: 'Start-up firmware', type: 'enum', group: 'machine', scope: 'console', live: false, default: 'original',
        notice: 'Changing this restarts the game.', hidden: !info(model).fwSlot || !!builtIn,   /* a built-in game is its firmware */
        help: 'The console’s own start-up program if you have added it, otherwise ours, which leaves the console as the original does',
        values: [{ v: 'original', label: 'The console’s own, if added' }, { v: 'ours', label: 'Ours' }, { v: 'none', label: 'None' }] },
    ];
    if (info(model).gg && decision && decision.gg_sms) defs.push({ id: 'ggSmsPicture', label: 'Master System picture', type: 'enum', group: 'video', scope: 'game', live: false, default: 'lcd',
      notice: 'Changing this restarts the game.',
      help: 'This cartridge puts the Game Gear in Master System mode. The console squeezes the whole picture onto its small screen, with coloured edges; the full picture is an option.',
      values: [{ v: 'lcd', label: 'As the Game Gear shows it' }, { v: 'full', label: 'The full Master System picture' }] });
    if (info(model).gg) defs.push({ id: 'ggScreen', label: 'Screen', type: 'enum', group: 'video', scope: 'console', live: true, default: 'real',
      help: 'The Game Gear’s colour screen is slow to change: things that flicker on the console look steady and half-clear, and moving things leave a short trail. The LCD look adds what the screen looks like up close: its colour stripes, the lines between pixel rows, a faint vertical bleed and its paler colours (matched by eye). Sharp shows every frame as it is made.',
      values: [{ v: 'real', label: 'As the Game Gear’s screen' }, { v: 'lcd', label: 'LCD look (stripes and paler colour, matched by eye)' }, { v: 'sharp', label: 'Sharp, every frame' }] });
    else defs.push({ id: 'crop', label: 'Picture edges', type: 'enum', group: 'video', scope: 'console', live: false, default: 'full',
      notice: 'Changing this restarts the game.',
      help: 'Many games blank a column 8 pixels wide at the left of the picture while they scroll. Balanced takes 8 pixels from each side so the picture is centred.',
      values: [{ v: 'full', label: 'As the console draws it' }, { v: 'balanced', label: 'Balanced (8 pixels off each side)' }] });
    /* The Gear-to-Gear cable: Game Gear mode only (the EXT port does nothing in Master System mode). */
    if (HAS_LINK && info(model).gg && !(decision && decision.gg_sms) && !builtIn) defs.push({ id: 'link', label: 'Gear-to-Gear cable', type: 'enum', group: 'machine', scope: 'game', live: false, default: 'none',
      notice: 'Changing this restarts the game.',
      help: 'Joins a second Game Gear with the Gear-to-Gear cable, side by side, for games that play two players over it: puzzle games such as Columns, racing, fighting and sports games. Player 2 uses I J K L, F and G, with T for Start, or the second pad. The LCD look is not drawn with two screens.',
      values: [{ v: 'none', label: 'No cable' }, { v: 'gg', label: 'A second Game Gear: two players side by side' }] });
    if (info(model).gg) defs.push({ id: 'ggSpeaker', label: 'Game Gear sound', type: 'enum', group: 'machine', scope: 'console', live: true, default: 'headphones',
      values: [{ v: 'headphones', label: 'Headphones (stereo)' }, { v: 'speaker', label: 'Built-in speaker (mono)' }] });
    return defs.concat(acc.optionDefs().filter(d => !(info(model).gg && d.id === 'controller')));   /* the Game Gear has no controller ports */
  }

  const core = {
    info: { build: null },
    get frames() { return frames; },
    get model() { return MODELS[model].id; },
    load(r) {
      build(r);
      portList = ports();
      const f = info(model);
      return {
        fps: fpsOf(model),
        video: (() => { const v = frameView(); return { width: v.width, height: v.height, format: v.format, pixelAspect: v.pixelAspect, rotation: 0 }; })(),
        audio: { rate: 0 },
        ports: portList,
        battery: (bat.on ? [{ id: 'cart', kind: 'sram', bytes: m.cartRam().length, ext: '.sav' }] : [])
          .concat(bat2.on ? [{ id: 'cart2', kind: 'sram', bytes: m2.cartRam().length, ext: '.p2.sav' }] : []),
        options: optionDefs(),
        model: MODELS[model].id,
        system: device,
        usedFirmware: fwUsed === 'original' ? fwRoleUsed : null,
        facts: { device, model: MODELS[model].id, tv: f.pal ? 'PAL' : 'NTSC', board: decision.board, boardSource: decision.board_src || 'table', ggMasterSystemMode: ggSms,
          cartRam: m.cartRam().length, battery: bat.on, firmware: fwUsed, stateBytes: X.h_state_size(), controllers: acc.facts(),
          builtInGame: builtIn ? builtIn.title : null, gearToGear: linkOn },
      };
    },
    reset(kind) {
      /* Power off and on again with the same cartridge; the battery's RAM is the cartridge's and stays. */
      const keep = Object.assign({}, req.battery || {});
      if (bat.on) keep.cart = m.cartRam();
      if (bat2.on) keep.cart2 = m2.cartRam();
      build(Object.assign({}, req, { battery: keep }));
    },
    setInput(port, s) { ins.set(port, s); },
    runFrame() {
      applyInput();
      const rate = Math.round(env.audioRate ? env.audioRate() : 48000);
      X.p_audio_rate(m.ctx, rate);
      if (linkOn) { X.p_audio_rate(m2.ctx, rate); X.p_link_frame(m.ctx, m2.ctx); }
      else X.p_frame_one(m.ctx);
      frames++;
      acc.afterFrame();
      if (cheat) cheat.frame();
      if (ghostOn()) { const v = ggView(); screen.set(GG_FOLLOW); screen.push(v.data, v.width * v.height); }
      if (linkOn) {
        if (ghostOn()) { const v2 = ggView2(); screen2.set(GG_FOLLOW); screen2.push(v2.data, v2.width * v2.height); }
        /* player 2's sound joins the queue the mix takes from */
        const n2 = X.p_audio_count(m2.ctx);
        if (link2Q.length < (link2N + n2) * 2) { const q = new Float32Array((link2N + n2) * 2 + 4096); q.set(link2Q.subarray(0, link2N * 2)); link2Q = q; }
        if (n2) link2Q.set(new Float32Array(m.mem.buffer, X.p_audio(m2.ctx), n2 * 2), link2N * 2);
        link2N += n2;
      }
      batTick();
    },
    video() { return frameView(); },
    audio() {
      const n = X.p_audio_count(m.ctx);
      audioView.data = n ? new Float32Array(m.mem.buffer, X.p_audio(m.ctx), n * 2) : new Float32Array(0);
      audioView.frames = n;
      if (linkOn && n) {
        /* both Game Gears mixed, held within full scale (as the Game Boy link mixes its two) */
        if (mixBuf.length < n * 2) mixBuf = new Float32Array(n * 2 + 1024);
        const take = Math.min(n, link2N), a = audioView.data;
        for (let i = 0; i < n * 2; i++) { const s = a[i] + (i < take * 2 ? link2Q[i] : 0); mixBuf[i] = s > 1 ? 1 : s < -1 ? -1 : s; }
        link2Q.copyWithin(0, take * 2, link2N * 2); link2N -= take;
        if (link2N > 4096) link2N = 0;          /* never: the two machines give the same number of samples within one a frame */
        audioView.data = mixBuf.subarray(0, n * 2);
      }
      return audioView;
    },
    serialize() {
      const a = m.saveState();
      if (!linkOn) return a;
      /* a pair: player 1's state, then 'GGL1', the length, player 2's state and the cable's block */
      const ls = X.p_link_size(), b = m2.saveState();
      if (!linkBuf) linkBuf = m.alloc(ls);
      X.p_link_save(m.ctx, m2.ctx, linkBuf);
      const out = new Uint8Array(a.length + 8 + b.length + ls), dv = new DataView(out.buffer);
      out.set(a, 0); dv.setUint32(a.length, LINK_TAG, true); dv.setUint32(a.length + 4, b.length + ls, true);
      out.set(b, a.length + 8); out.set(new Uint8Array(m.mem.buffer, linkBuf, ls), a.length + 8 + b.length);
      return out;
    },
    unserialize(b) {
      const bytes = b instanceof Uint8Array ? b : new Uint8Array(b);
      const size = X.h_state_size();
      /* one machine's state, or a pair's (player 1's state with the 'GGL1' trailer) */
      let pair = null;
      if (bytes.length >= size + 8) {
        const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
        const ls = HAS_LINK ? X.p_link_size() : 0;
        if (dv.getUint32(size, true) === LINK_TAG && dv.getUint32(size + 4, true) === size + ls && bytes.length === size + 8 + size + ls)
          pair = { b: bytes.subarray(size + 8, size + 8 + size), link: bytes.subarray(size + 8 + size) };
      }
      if (bytes.length !== size && !pair) throw new CoreError('wrong-core', `this save state is from another build of the core (${bytes.length} bytes, this core's are ${size})`);
      const r = m.loadState(bytes.subarray(0, size), bat.on ? 1 : 0);
      if (r) throw new CoreError('wrong-game', 'this save state is from another cartridge or another machine');
      bat.lastSeen = m.cartRamWrites(); bat.still = 0;
      screen.reset();                          /* a loaded state or a rewind step starts the slow screen afresh */
      if (linkOn) {
        /* With the cable in: a pair's state loads player 2 and the cable as saved. A one-machine state
           leaves player 2 as it is and joins the two again (the cable's block cleared, player 2 half a
           frame behind from here). A pair's state with the cable out loads player 1 alone. */
        const r2 = pair ? m2.loadState(pair.b, bat2.on ? 1 : 0) : 1;
        if (!r2) {
          if (!linkBuf) linkBuf = m.alloc(X.p_link_size());
          m.u8().set(pair.link, linkBuf);
          X.p_link_load(m.ctx, m2.ctx, linkBuf, pair.link.length);
          bat2.lastSeen = m2.cartRamWrites(); bat2.still = 0;
        } else X.p_link(m.ctx, m2.ctx);
        screen2.reset(); link2N = 0;
      }
    },
    options: optionDefs,
    setOption(k, v) {
      if (k === 'ggSpeaker') { speaker = v === 'speaker' ? 1 : 0; X.p_gg_speaker(m.ctx, speaker); if (linkOn) X.p_gg_speaker(m2.ctx, speaker); return 'live'; }
      if (k === 'view3d') return acc.setView(v);
      if (k === 'ggScreen') { ggScreen = v === 'sharp' ? 'sharp' : v === 'lcd' ? 'lcd' : 'real'; screen.reset(); screen2.reset(); return 'live'; }
      return 'reload';
    },
    ports: () => portList,
    details() {
      const f = info(model);
      if (builtIn) return `${MODELS[model].label}, ${f.pal ? 'PAL' : 'NTSC'}; no cartridge: ${builtIn.title}, built into this start-up firmware`;
      return `${MODELS[model].label}, ${f.pal ? 'PAL' : 'NTSC'}; board ${decision.board} (${decision.board_src || 'table'}); cartridge RAM ${m.cartRam().length} bytes${bat.on ? ' with a battery' : ''}; start-up firmware: ${fwUsed}${linkOn ? '; joined by the Gear-to-Gear cable to a second Game Gear' : ''}`;
    },
    /* cart: player 1's cartridge RAM; cart2: player 2's (the Gear-to-Gear link's second Game Gear) */
    battery: {
      dirty: () => (bat.dirty ? ['cart'] : []).concat(bat2.dirty ? ['cart2'] : []),
      read: id => (id === 'cart' && bat.on ? m.cartRam() : id === 'cart2' && bat2.on ? m2.cartRam() : null),
      clean: id => { const b = id === 'cart' ? bat : id === 'cart2' ? bat2 : null; if (b) { b.flushed = b.lastSeen; b.dirty = false; b.still = 0; } },
      write: (id, bytes) => {
        const b = id === 'cart' ? bat : id === 'cart2' ? bat2 : null, mm = id === 'cart' ? m : m2;
        if (!b || !b.on || !bytes) return false;
        const ok = mm.loadCartRam(bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes)) === 0;
        b.flushed = b.lastSeen = mm.cartRamWrites(); b.still = 0; b.dirty = false;
        return ok;
      },
    },
    /* For the test bench and the machine checks: hashes of the core's own frame, memory and sound. */
    ext: Object.assign({ hashes: () => Object.assign({ frame: m.hash(1), memory: m.hash(0), audio: m.hash(2), state: m.hash(3), frames },
        linkOn ? { player2: { frame: m2.hash(1), memory: m2.hash(0), audio: m2.hash(2), state: m2.hash(3) } } : {}),
      /* What each controller port holds and the 3-D glasses' last eye, for the bench and the machine checks. */
      accessories: () => acc.debug(),
      /* Cheats: the kinds this build runs and the codes switched on (play/host/cheats.mjs). */
      cheats: {
        kinds: () => (cheat ? cheat.kinds() : []),
        apply: codes => (cheat ? cheat.apply(codes) : { ok: false, why: 'This player has no cheat support yet.' }),
      } }, acc.ext()),
    destroy() {},
  };
  return core;
}

/* ------------------------------------------------------------------ the accessories (stage 9)
 * docs/emulation/accessories.md. Controllers follow the cartridge: the per-hash table's accessory
 * columns (the loader's decision: requires, supports), with the Controller option on top (REG-0114).
 *   Light Phaser (REG-0105): the NES Zapper's port shape: a trigger, aim keys, and "Aim and fire
 *     (point at the picture)": a tap or click aims there and pulls the trigger; the mouse aims as it
 *     moves. The core models the gun as a disc of light on the picture; one behaviour for every game.
 *   Paddle (REG-0109): "Turn (move over the picture)": the pointer's place across the picture is the
 *     knob; keys turn it. Both ports hold one (Galactic Protector takes two).
 *   Sports Pad (REG-0110): a double click holds the mouse (Pointer Lock) and its motion rolls the
 *     ball; a finger dragged on the picture rolls it too; keys roll it at a steady speed.
 *   3-D glasses (REG-0111, decision 8): the core says which eye each frame is for; the picture shows
 *     one eye, steady, by default; both eyes (as a TV without glasses), red/cyan and side by side are
 *     choices, the last two labelled enhancements. Never in the core's frame, its hashes or its states.
 */
const ACC = { pad: 0, phaser: 1, paddle: 2, sportspad: 3 };
const ACC_LABEL = { pad: 'Control Pads', phaser: 'Light Phaser', paddle: 'Paddle Control', sportspad: 'Sports Pad', tablet: 'Terebi Oekaki drawing board',
  graphic: 'Sega Graphic Board' };
/* Sega Graphic Board (24 Nov 2026; accessories.md 8.3): a drawing board on controller port 1, made for
   one program, so it is plugged in only when the cartridge requires it (never a Controller choice). The core
   number is S8_ACC_GRAPHIC. The board lies beside the TV, so the program alone ties board to screen: it draws
   its cursor's centre 3.5 pixels right of and 35.5 above the pen's place (measured at four places), so a point
   of the picture is read as the board place that puts the cursor's centre on it. */
const ACC_GRAPHIC = 4, GRAPHIC_DX = -3, GRAPHIC_DY = 36;
/* A pen put down somewhere new: the PEN button waits this many frames, so the program reads the new place
   before it draws (it draws a line from the last place it read). The program reads the board once a frame. */
const GRAPHIC_SETTLE_FRAMES = 2;
/* TWO GUNS (decision 9; 21 Nov 2026): a Light Phaser in each port, for two players (Gangster Town).
   The core takes a gun on either port (REG-0108); on a phone each finger is one gun (the play host hands
   each port its own pointer: the first finger on the picture is player 1's gun, a second finger while the
   first is down is player 2's), and the mouse is player 1's. A Controller choice, never automatic. */
const CHOICES = Object.keys(ACC).concat(['phaser2']);
const CHOICE_LABEL = Object.assign({ phaser2: 'Two Light Phasers (two players)' }, ACC_LABEL);
/* Terebi Oekaki: the board's place for a point of the picture. The board lies beside the TV, so the
   program alone ties the two: it draws its cursor's centre 3 pixels right of and 28 above the pen's
   reading (measured, accessories.md 8), so a finger is read as the place that puts the cursor under it. */
const TABLET_DX = -3, TABLET_DY = 28;
const GUN_HOLD_FRAMES = 6;       /* a tap's trigger is held this long, as the NES Zapper's (play/cores/nes) */
/* The pointer over the television's picture (20 Nov 2026: the picture has its border round it) as a place
   on the console's frame: x and y from 0 to 1 across the frame, inside only over the frame itself. */
function frameOf(m, pt, h) {
  const g = m.tvGeom;
  if (!pt || !g) return pt;
  const x = (pt.x * g.W - g.l) / 256, y = (pt.y * g.H - g.t) / h;
  return Object.assign({}, pt, { x, y, inside: !!pt.inside && x >= 0 && x < 1 && y >= 0 && y < 1 });
}
const KNOB_STEP = 4, BALL_KEY = 12, BALL_SCALE = 1;   /* knob per frame on keys; ball counts a frame on keys; per pointer pixel */
const VIEWS = ['one', 'both', 'anaglyph', 'side'];
function accessories(X, m) {
  let kind = ['pad', 'pad'], auto = 'pad', glasses = false, glassesOk = false, view = 'one', h = 192, tablet = false, graphic = false;
  const gpen = { settle: 0, was: false, x: -1, y: -1 };
  const newGun = () => ({ x: -1, y: -1, down: false, rel: -99, sig: '' });
  let guns = [newGun(), newGun()], knob = [128, 128];
  const ball = { on: false, dx: 0, dy: 0, b: 0, lb: 0 }, drag = { x: null, y: null };
  const eyes = { L: new Uint32Array(256 * 240), R: new Uint32Array(256 * 240), hasL: false, hasR: false, last: -1,
    out: new Uint32Array(512 * 240) };
  return {
    plug(decision, o, f, model) {
      const req = (decision && decision.requires) || [], sup = (decision && decision.supports) || [];
      auto = req.includes('phaser') ? 'phaser' : req.includes('paddle') ? 'paddle' : req.includes('sportspad') ? 'sportspad' : 'pad';
      const choice = f.gg ? 'pad' : (o.controller && o.controller !== 'auto' && CHOICES.includes(o.controller) ? o.controller : auto);
      kind = choice === 'phaser' ? ['phaser', 'pad'] : choice === 'phaser2' ? ['phaser', 'phaser'] : choice === 'pad' ? ['pad', 'pad'] : [choice, choice];
      /* the drawing board comes with its own cartridge board (the per-hash table's mapper column) */
      tablet = !!(decision && decision.board === 'terebi');
      if (tablet) kind[0] = 'tablet';
      /* the Sega Graphic Board: on port 1 when the cartridge requires it, whatever the Controller choice */
      graphic = !f.gg && req.includes('graphicboard');
      if (graphic) { auto = 'graphic'; kind = ['graphic', 'pad']; }
      gpen.settle = 0; gpen.was = false;
      const id = k => (k === 'graphic' ? ACC_GRAPHIC : ACC[k] || 0);
      X.p_accessory(m.ctx, 0, id(kind[0])); X.p_accessory(m.ctx, 1, id(kind[1]));
      glassesOk = !!X.p_glasses_ok(model);
      glasses = req.includes('glasses3d') || sup.includes('glasses3d');
      view = VIEWS.includes(o.view3d) ? o.view3d : 'one';
      guns = [newGun(), newGun()]; knob = [128, 128];
      drag.x = drag.y = null;
      eyes.hasL = eyes.hasR = false; eyes.last = -1;
    },
    on: p => kind[p] !== 'pad',
    facts: () => ({ portA: ACC_LABEL[kind[0]], portB: ACC_LABEL[kind[1]], asTheCartridgeWants: ACC_LABEL[auto], glasses3d: glasses && glassesOk }),
    debug: () => ({ kind: kind.slice(), auto, gun: { x: guns[0].x, y: guns[0].y, down: guns[0].down }, gun2: { x: guns[1].x, y: guns[1].y, down: guns[1].down }, knob: knob.slice(), eye: eyes.last, view, glasses, glassesOk }),
    ports(out) {
      const P = [{ u: ['ArrowUp'], d: ['ArrowDown'], l: ['ArrowLeft'], r: ['ArrowRight'], b1: ['KeyZ'], b2: ['KeyX'] },
        { u: ['KeyI'], d: ['KeyK'], l: ['KeyJ'], r: ['KeyL'], b1: ['KeyF'], b2: ['KeyG'] }];
      for (const p of [0, 1]) {
        const i = out.findIndex(x => x.port === p);
        if (i < 0 || kind[p] === 'pad') continue;
        const k = P[p], n = p + 1;
        if (kind[p] === 'graphic') out[i] = { port: p, kind: 'accessory', device: 'sega-graphic-board', label: 'Sega Graphic Board', controls: [
          { id: 'pen-button', label: 'PEN (draw, pick a colour)', type: 'button', defaults: { key: ['KeyZ'], pad: ['A'] } },
          { id: 'do', label: 'DO (choose)', type: 'button', defaults: { key: ['KeyX'], pad: ['B'] } },
          { id: 'menu', label: 'MENU', type: 'button', defaults: { key: ['KeyC'], pad: ['X'] } },
          { id: 'pen', label: 'Pen (over the picture it is on the board; a mouse button or a finger is PEN)', type: 'pointer', defaults: {} }] };
        if (kind[p] === 'tablet') out[i] = { port: p, kind: 'accessory', device: 'terebi-oekaki', label: 'Terebi Oekaki', controls: [
          { id: 'press', label: 'Press (draw)', type: 'button', defaults: { key: ['KeyZ', 'KeyX'], pad: ['A', 'X'] } },
          { id: 'pen', label: 'Pen (touch or click the picture; the mouse moves the pen)', type: 'pointer', defaults: {} }] };
        if (kind[p] === 'phaser') out[i] = { port: p, kind: 'accessory', device: 'light-phaser', label: kind[0] === 'phaser' && kind[1] === 'phaser' ? `Light Phaser ${n}` : 'Light Phaser', controls: [
          { id: 'trigger', label: 'Trigger', type: 'button', defaults: { key: k.b1.concat(k.b2), pad: ['A', 'X'] } },
          { id: 'aim-up', label: 'Aim up', type: 'button', defaults: { key: k.u, pad: ['up'] } },
          { id: 'aim-down', label: 'Aim down', type: 'button', defaults: { key: k.d, pad: ['down'] } },
          { id: 'aim-left', label: 'Aim left', type: 'button', defaults: { key: k.l, pad: ['left'] } },
          { id: 'aim-right', label: 'Aim right', type: 'button', defaults: { key: k.r, pad: ['right'] } },
          { id: 'aim', label: 'Aim and fire (point at the picture)', type: 'pointer', defaults: {} }] };
        if (kind[p] === 'paddle') out[i] = { port: p, kind: 'accessory', device: 'paddle', label: `Paddle Control ${n}`, controls: [
          { id: 'fire', label: 'Button', type: 'button', defaults: { key: k.b1.concat(k.b2), pad: ['A', 'B', 'X', 'Y'] } },
          { id: 'knob-left', label: 'Turn left', type: 'button', defaults: { key: k.l, pad: ['left'] } },
          { id: 'knob-right', label: 'Turn right', type: 'button', defaults: { key: k.r, pad: ['right'] } }]
          .concat(p === 0 ? [{ id: 'knob', label: 'Turn (move over the picture)', type: 'pointer', defaults: {} }] : []) };
        if (kind[p] === 'sportspad') out[i] = Object.assign({ port: p, kind: 'accessory', device: 'sports-pad', label: `Sports Pad ${n}`, controls: [
          { id: 'b1', label: '1', type: 'button', defaults: { key: k.b1, pad: ['A', 'X'] } },
          { id: 'b2', label: '2', type: 'button', defaults: { key: k.b2, pad: ['B', 'Y'] } },
          { id: 'up', label: 'Roll up', type: 'button', defaults: { key: k.u, pad: ['up'] } },
          { id: 'down', label: 'Roll down', type: 'button', defaults: { key: k.d, pad: ['down'] } },
          { id: 'left', label: 'Roll left', type: 'button', defaults: { key: k.l, pad: ['left'] } },
          { id: 'right', label: 'Roll right', type: 'button', defaults: { key: k.r, pad: ['right'] } }]
          .concat(p === 0 ? [{ id: 'roll', label: 'Roll (drag on the picture)', type: 'pointer', defaults: {} }] : []) },
          p === 0 ? { pointerLock: 'Sports Pad' } : {});
      }
      return out;
    },
    /* Once a frame, before it runs: the accessories' inputs. held(port, id) reads a control. */
    step(ins, held, frame) {
      h = X.p_frame_h(m.ctx) || 192;
      for (const p of [0, 1]) {
        const st = ins.get(p) || { buttons: 0 }, pt = frameOf(m, st.pointer || null, h);
        if (kind[p] === 'graphic') {
          /* the pen presses on the board while the pointer is over the picture (the program shows its cursor
             there); a mouse button, a finger or Z is the board's PEN button, which draws and picks colours */
          const on = !!(pt && pt.inside);
          if (on) { gpen.x = Math.floor(pt.x * 256) + GRAPHIC_DX; gpen.y = Math.floor(pt.y * h) + GRAPHIC_DY; }
          if (on && !gpen.was) gpen.settle = GRAPHIC_SETTLE_FRAMES;
          gpen.was = on;
          let pen = held(p, 'pen-button') || !!(on && pt.buttons & 1);
          if (gpen.settle > 0) { gpen.settle--; pen = false; }
          X.p_graphicboard(m.ctx, p, on ? gpen.x : 0, on ? gpen.y : 0, on ? 1 : 0,
            (held(p, 'menu') ? 1 : 0) | (held(p, 'do') ? 2 : 0) | (pen ? 4 : 0));
        } else if (kind[p] === 'tablet') {
          /* the pen is on the board while the pointer is over the picture; pressing (a finger down, a
             mouse button, Z) is the board's button, which the program draws with */
          const on = !!(pt && pt.inside);
          X.p_tablet(m.ctx, on ? Math.floor(pt.x * 256) + TABLET_DX : 0, on ? Math.floor(pt.y * h) + TABLET_DY : 0, on ? 1 : 0,
            held(p, 'press') || !!(pt && pt.inside && pt.buttons & 1) ? 1 : 0);
        } else if (kind[p] === 'phaser') {
          const gun = guns[p];
          const sig = pt ? `${pt.x},${pt.y},${pt.inside}` : '';
          if (pt && sig !== gun.sig) {
            gun.sig = sig;
            if (pt.inside) { gun.x = Math.min(255, Math.max(0, Math.floor(pt.x * 256))); gun.y = Math.min(h - 1, Math.max(0, Math.floor(pt.y * h))); }
            else gun.x = gun.y = -1;
          }
          const aimKeys = ['aim-up', 'aim-down', 'aim-left', 'aim-right'].map(id => held(p, id));
          if (aimKeys.some(Boolean)) {
            if (gun.x < 0) { gun.x = 128; gun.y = h >> 1; }
            if (aimKeys[0]) gun.y = Math.max(0, gun.y - 3);
            if (aimKeys[1]) gun.y = Math.min(h - 1, gun.y + 3);
            if (aimKeys[2]) gun.x = Math.max(0, gun.x - 3);
            if (aimKeys[3]) gun.x = Math.min(255, gun.x + 3);
          }
          const down = held(p, 'trigger') || !!(pt && pt.buttons & 1);
          if (down && gun.x < 0) { gun.x = 128; gun.y = h >> 1; }
          if (gun.down && !down) gun.rel = frame;
          gun.down = down;
          X.p_phaser(m.ctx, p, gun.x, gun.y, down || frame - gun.rel < GUN_HOLD_FRAMES ? 1 : 0);
        } else if (kind[p] === 'paddle') {
          if (pt && pt.inside) knob[p] = Math.round(Math.max(0, Math.min(1, pt.x)) * 255);
          if (held(p, 'knob-left')) knob[p] = Math.max(0, knob[p] - KNOB_STEP);
          if (held(p, 'knob-right')) knob[p] = Math.min(255, knob[p] + KNOB_STEP);
          X.p_paddle(m.ctx, p, knob[p], held(p, 'fire') ? 1 : 0);
        } else if (kind[p] === 'sportspad') {
          let dx = 0, dy = 0, b = (held(p, 'b1') ? 1 : 0) | (held(p, 'b2') ? 2 : 0);
          if (held(p, 'left')) dx -= BALL_KEY;
          if (held(p, 'right')) dx += BALL_KEY;
          if (held(p, 'up')) dy -= BALL_KEY;
          if (held(p, 'down')) dy += BALL_KEY;
          if (p === 0) {
            if (pt && pt.buttons & 1 && pt.inside) {        /* a finger, or a held mouse button, dragged on the picture */
              if (drag.x !== null) { dx += Math.round((pt.x - drag.x) * 256 * BALL_SCALE); dy += Math.round((pt.y - drag.y) * h * BALL_SCALE); }
              drag.x = pt.x; drag.y = pt.y;
            } else drag.x = drag.y = null;
            if (ball.on) { dx += Math.round(ball.dx * BALL_SCALE); dy += Math.round(ball.dy * BALL_SCALE); ball.dx = ball.dy = 0; b |= ball.b | ball.lb; ball.lb = 0; }
          }
          X.p_sportspad(m.ctx, p, Math.max(-128, Math.min(127, dx)), Math.max(-128, Math.min(127, dy)), b);
        }
      }
    },
    /* After each frame: which eye it was for, and a copy of it for the 3-D views. */
    afterFrame() {
      const e = X.p_eye(m.ctx);
      eyes.last = e;
      if (e < 0 || view === 'both' || !glassesOk) return;
      const hh = X.p_frame_h(m.ctx), src = new Uint32Array(m.mem.buffer, X.p_frame(m.ctx), 256 * hh);
      if (e === 1) { eyes.L.set(src); eyes.hasL = true; } else { eyes.R.set(src); eyes.hasR = true; }
    },
    /* The picture for the chosen 3-D view: the frame itself unless the game drives the glasses. */
    view3d(full, hh) {
      if (!glasses || !glassesOk || view === 'both') return { width: 256, data: full };
      const n = 256 * hh, live = eyes.last >= 0;
      const L = live && eyes.hasL ? eyes.L : full, R = live && eyes.hasR ? eyes.R : full, out = eyes.out;
      if (view === 'one') return { width: 256, data: L === full ? full : L.subarray(0, n) };
      if (view === 'anaglyph') {                 /* red from the left eye, green and blue from the right */
        if (L === full || R === full) return { width: 256, data: full };
        for (let i = 0; i < n; i++) out[i] = (L[i] & 0x000000FF) | (R[i] & 0x00FFFF00) | 0xFF000000;
        return { width: 256, data: out.subarray(0, n) };
      }
      /* side by side: always 512 wide, so the picture keeps its size; the frame itself on both
         sides while the game is not driving the glasses (its title screens) */
      for (let y = 0; y < hh; y++) { out.set(L.subarray(y * 256, y * 256 + 256), y * 512); out.set(R.subarray(y * 256, y * 256 + 256), y * 512 + 256); }
      return { width: 512, data: out.subarray(0, 512 * hh) };
    },
    width: () => (glasses && glassesOk && view === 'side' ? 512 : 256),
    setView(v) { const was = view; view = VIEWS.includes(v) ? v : 'one'; return (was === 'side') !== (view === 'side') ? 'reload' : 'live'; },
    optionDefs() {
      const d = [{ id: 'controller', label: 'Controller', type: 'enum', group: 'machine', scope: 'game', live: false, default: 'auto',
        notice: 'Changing this restarts the game.',
        help: 'What is plugged into the controller ports. The cartridge decides unless you choose.',
        values: [{ v: 'auto', label: `As the cartridge wants (${ACC_LABEL[auto]})` }].concat(CHOICES.map(k => ({ v: k, label: CHOICE_LABEL[k] }))) }];
      if (tablet || graphic) d.shift();    /* a drawing board's program: nothing else to plug in */
      if (glasses && glassesOk) d.push({ id: 'view3d', label: '3-D glasses picture', type: 'enum', group: 'video', scope: 'game', live: true, default: 'one',
        help: 'This game draws a picture for each eye in turn, for the 3-D glasses. Without glasses, one eye is the steadiest picture. Red and cyan, and side by side, are enhancements: the console never made them.',
        values: [{ v: 'one', label: 'One eye, steady' }, { v: 'both', label: 'Both eyes in turn, as a TV shows it' },
          { v: 'anaglyph', label: 'Red and cyan glasses (enhancement)' }, { v: 'side', label: 'Side by side, for a phone headset (enhancement)' }] });
      return d;
    },
    ext() {
      return {
        /* Where the Light Phaser points (0..1), for the host's crosshair; null when no gun. */
        crosshair: (p = 0) => { const gun = guns[p] || guns[0]; return kind[p] === 'phaser' && gun.x >= 0 ? (g => g ? { x: (g.l + gun.x + 0.5) / g.W, y: (g.t + gun.y + 0.5) / g.H } : { x: (gun.x + 0.5) / 256, y: (gun.y + 0.5) / h })(m.tvGeom) : null; },
        /* The host holds the pointer for the port that says pointerLock (the Sports Pad) and hands over its motion. */
        trackball: {
          lock(on) { ball.on = !!on && kind[0] === 'sportspad'; ball.dx = ball.dy = 0; ball.b = ball.lb = 0; },
          move(dx, dy) { if (ball.on) { ball.dx += dx; ball.dy += dy; } },
          button(bit, down) { if (!ball.on) return; if (down) { ball.b |= bit; ball.lb |= bit; } else ball.b &= ~bit; },
        },
      };
    },
  };
}
