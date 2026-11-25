/*
 * web/play/core.mjs (served on the site as play/cores/snes/core.mjs) -- the Super Nintendo (Super Famicom) for the one play host (Core API 1.0),
 * 23 Nov 2026.
 *
 * WHAT IT WRAPS: snesplay.wasm, the SNES pilot's core (C, freestanding WebAssembly) with its two entry-point
 * files: host/wasm_api.c (the loading rule, the owner's chip images, the controller ports and the battery-save
 * rules) and host/site_api.c (the console model, the picture in canvas order, save states, the Reset button).
 * The file list and every file's SHA-256 are in CORE-VERSION.json beside this file (WASM_Source/snes/install.mjs
 * puts them here and checks them). No DOM, no storage, no timers, no Date.now(), no key events.
 *
 * THE CARTRIDGE: one loading rule for the page and the pilot's tools (cartridges chapter C-LOAD): the copier
 * header, the per-hash board table (or the header guesser, labelled guessed), overdumps and interleaved copier
 * files put back. A board whose chip is not built yet is refused by name; the SA-1, the Super FX, the S-DD1,
 * the SPC7110, the clock chips, the NEC DSPs (DSP-1 to DSP-4, ST010, ST011) and the ST018 (these from the owner's
 * program images) run.
 * A Sufami Turbo cartridge (.st, 24 Nov 2026) plays in the base cartridge's two slots (cartridges chapter C-ST; ST_LINKS below).
 *
 * THE CONSOLE: the default is the NTSC 3-chip console (S-CPU version 2, PPU1 version 1, PPU2 version 3); a
 * PAL cartridge (by its board) gets the PAL console, at 50 frames a second, never sped up. The Machine choice
 * offers the other models; saves and save states are kept per machine (the host keys them on the model).
 *
 * SOUND: the S-DSP's own output, stereo always, at the APU's rate (32,040 a second by default: apu.md), handed to
 * the host as 16-bit pairs; the host's sound engine resamples it with its drift servo. Mute and volume never fold
 * the two channels.
 *
 * PICTURE: the frame as the core draws it, 256 or 512 wide (a frame with a hi-res line is 512 and its other lines
 * are drawn twice as wide), 224 or 239 lines (448 or 478 interlaced), in the stated linear colour mapping. Its
 * shape: a television's 4:3 by default; 8:7 pixels as a choice (the NES window's setting).
 *
 * CONTROLLERS follow the cartridge (the table's page fields): a pad in each port by default; the mouse, the
 * multitap, the Super Scope and the Justifier where the cartridge's record says so, with a Controller choice on
 * top. Opposite directions held together are both let go. Keys: arrows, B = Z, A = X, Y = A, X = S, L = Q, R = W,
 * Start = Enter, Select = the right Shift; player 2 on I J K L with F G R T, Y and U; players 3 to 5 (a multitap
 * in either port, 24 Nov 2026) on the numeric keypad, the block above the arrows, and O P [ ; (KEYS below). The
 * Justifier gives two guns: the second on a second finger, or on player 2's keys. Over the picture the mouse's
 * right button is the Super Scope's cursor and its middle button pause, when the host gives the mouse's buttons.
 *
 * BATTERY SAVES (cartridges chapter C-SAVE): written once the cartridge RAM has been quiet for 60 frames. A
 * loaded state never writes the battery save; the game's next write after one first keeps the save that was
 * there as a copy (the battery region 'kept'), then writes.
 *
 * CARTRIDGE CLOCKS (24 Nov 2026; cartridges chapter C-SAVE-4, chapter rtc.md): the S-RTC (Daikaijuu Monogatari II)
 * and the SPC7110's Epson RTC-4513 (Tengai Makyou Zero) run from emulated time. The host's local time goes in
 * twice: at power-on (a cartridge with no save starts at that time) and after the battery save is read in (the
 * save's clock is carried forward by the time that passed since it was written). The time is the host's virtual
 * clock (env.now(), so it stops while paused and is kept with states) less the time zone's offset. The clock's
 * record (16 bytes) follows the RAM in the 'cart' battery region; a save written before clocks were kept (the RAM
 * alone) is still read, and the clock then starts from the host's time.
 */
import { CoreError } from '../../host/core-api.mjs';
import { cheatEngine } from '../cheats-core.mjs?v=2.3.0';

const WASM_URL = new URL('./snesplay.wasm', import.meta.url);

/* The Machine choices. region 0 NTSC, 1 PAL; cpu / ppu1 / ppu2 the chip versions; oneChip the later board. */
export const MODELS = [
  { id: 'ntsc', label: 'Super Nintendo / Super Famicom (NTSC)', region: 0, cpu: 2, ppu1: 1, ppu2: 3, oneChip: 0 },
  { id: 'pal', label: 'Super Nintendo (PAL)', region: 1, cpu: 2, ppu1: 1, ppu2: 3, oneChip: 0 },
  { id: 'ntsc-1chip', label: 'Super Nintendo, one-chip board (NTSC)', region: 0, cpu: 2, ppu1: 1, ppu2: 3, oneChip: 1 },
  { id: 'pal-1chip', label: 'Super Nintendo, one-chip board (PAL)', region: 1, cpu: 2, ppu1: 1, ppu2: 3, oneChip: 1 },
  { id: 'ntsc-early', label: 'Early Super Famicom (S-CPU version 1, PPU2 version 1)', region: 0, cpu: 1, ppu1: 1, ppu2: 1, oneChip: 0 },
];
const MODEL_INDEX = Object.fromEntries(MODELS.map((m, i) => [m.id, i]));
/* Frames a second: the master clock over a frame's clocks (s-cpu.md): NTSC 236,250,000 / 11 Hz over 357,366 clocks
   (262 lines of 1,364, one line 4 short every other frame); PAL 21,281,370 Hz over 425,568 (312 lines of 1,364). */
const FPS = [236250000 / 11 / 357366, 21281370 / 425568];

/* The owner's chip program images (the game server's roles from snes\bios, by hash; never another emulator's).
   The loading rule picks the one a game needs: the table key with its image (C-LOAD-3); for a game the table
   does not know, a Cx4 game takes the 'cx4' image (C-LOAD-6a), and a DSP or Seta chip the program its board
   carried (C-GUESS-5) found among the images by hash (C-LOAD-9). The Cx4, DSP-n, ST010, ST011 and ST018 run; a
   chip not built yet is refused by its name. */
const FW_LABEL = { dsp1: 'DSP-1 program', dsp1b: 'DSP-1B program', dsp2: 'DSP-2 program', dsp3: 'DSP-3 program',
  dsp4: 'DSP-4 program', cx4: 'Cx4 data', st010: 'ST010 program', st011: 'ST011 program', st018: 'ST018 program' };
/* The header's chipset byte names a DSP or a custom chip (C-GUESS-2; low digit 3 to 6, a chip with or without RAM
   and battery): only then are the images asked for. */
function wantsChipImage(bytes) {
  if (!bytes || bytes.length < 0x8000) return false;
  const off = (bytes.length & 0x3ff) === 0x200 ? 0x200 : 0;
  for (const base of [0x7fc0, 0xffc0]) {
    const at = off + base;
    if (at + 0x20 > bytes.length) continue;
    const t = bytes[at + 0x16], hi = t >> 4, lo = t & 15;
    if (lo >= 3 && lo <= 6 && (hi === 0 || hi === 0xf)) return true;
  }
  return false;
}

/* The chips this core runs from a program image (cart.h snes_chip: DSP-1 to DSP-4, ST010, ST011, ST018): refused
   only when the image is missing. */
const NEC_CHIPS = new Set([3, 4, 5, 6, 7, 11, 12, 13]);

/* THE SUFAMI TURBO (24 Nov 2026; cartridges chapter C-ST). A mini-cartridge (.st) plays in Bandai's base cartridge,
   whose program is the owner's firmware (role 'sufami'), in slot A; slot B holds a second mini-cartridge that a linked
   game reads. The cartridges that link (fullsnes): the two SD Ultra Battle games with each other, the six SD Gundam
   Generation parts with each other, Poi Poi Ninja World with a second copy of itself. They are known by the header's
   game id and index in the series (bytes $30-$33), and found on the site by hash (the companions). */
const ST_LINKS = {
  '030001:1': ['2bb55214fb668ca603d7b944b14f105dfb10b987a8902d420fe4ae1cb69c1d4a', 'SD Ultra Battle: Ultraman Densetsu', 'ub'],
  '030001:2': ['2fec5f2bc7dee010af10569a3d2bc18715a79a126940800c3eade5abbd625e3f', 'SD Ultra Battle: Seven Densetsu', 'ub'],
  '010001:1': ['3e82215bed08274874b30d461fc4a965c6bca932229da5d46d56e36f484d65eb', 'SD Gundam Generation: Ichinen Sensouki', 'gg'],
  '010001:2': ['8547a08ed11fe408eac282a90ac46654bd2e5f49bda3aec8e5edf166a0a4b9af', 'SD Gundam Generation: Gryps Senki', 'gg'],
  '010001:3': ['2a9d7c9a61318861028a73ca03e32a48cff162d76cba36fbaab8690b212efe9b', 'SD Gundam Generation: Axis Senki', 'gg'],
  '010001:4': ['60ac017c18f534e8cf24ca7f38e22ce92db95ea6c30b2d59d76f13c4f1c8a6e4', 'SD Gundam Generation: Babylonia Kenkoku Senki', 'gg'],
  '010001:5': ['5951a58a91d8e397d0a237ccc2b1248e17c7312cb9cc11cbc350200a97b4e021', 'SD Gundam Generation: Zanscare Senki', 'gg'],
  '010001:6': ['e639b5d5d722432b6809ccc6801dc584e1a3016379f34b335ed2dfa73b1ebf69', 'SD Gundam Generation: Colony Kakutouki', 'gg'],
  '020001:1': ['602b20b788640f5743487108a10f3f77bca5ce2d24208b25b1ca498a96eb0d69', 'Poi Poi Ninja World', 'self'],
};
const ST_ID = 'BANDAI SFC-ADX', ST_BASE = 'ADD-ON BASE CASSETE';
const latin = (b, at, n) => { let s = ''; for (let i = 0; i < n && at + i < b.length; i++) s += String.fromCharCode(b[at + i]); return s; };
/* 0 another cartridge, 1 a mini-cartridge, 2 the base cartridge's program itself (the core's rule decides in the end) */
function stKind(bytes) {
  if (!bytes || bytes.length < 0x8000) return 0;
  const off = (bytes.length & 0x3ff) === 0x200 ? 0x200 : 0;
  if (latin(bytes, off, 14) !== ST_ID) return 0;
  return latin(bytes, off + 0x7fc0, 19) === ST_BASE ? 2 : 1;
}
/* the cartridge's place in ST_LINKS ('id:index'), or null */
function stKey(bytes) {
  if (stKind(bytes) !== 1) return null;
  const off = (bytes.length & 0x3ff) === 0x200 ? 0x200 : 0, h = x => x.toString(16).padStart(2, '0');
  const k = h(bytes[off + 0x30]) + h(bytes[off + 0x31]) + h(bytes[off + 0x32]) + ':' + bytes[off + 0x33];
  return ST_LINKS[k] ? k : null;
}
/* the cartridges that link with this one: { sha, label, self } */
function stPartners(key) {
  const me = ST_LINKS[key];
  if (!me) return [];
  if (me[2] === 'self') return [{ sha: me[0], label: `A second ${me[1]} cartridge`, self: true }];
  return Object.entries(ST_LINKS).filter(([k, v]) => k !== key && v[2] === me[2]).map(([, v]) => ({ sha: v[0], label: v[1], self: false }));
}
const ST_ALL = Object.values(ST_LINKS).map(v => ({ sha: v[0], label: v[1] }));

/* Pad bits in shift order (snes.h): B Y Select Start Up Down Left Right A X L R. */
const BIT = { b: 0x8000, y: 0x4000, select: 0x2000, start: 0x1000, up: 0x0800, down: 0x0400, left: 0x0200, right: 0x0100,
  a: 0x0080, x: 0x0040, l: 0x0020, r: 0x0010 };
/* Players 3 to 5 (24 Nov 2026, the multitap's players): the numeric keypad for player 3; the block above the
   arrows for player 4 (Home, End, Delete and Page Down as the d-pad, Insert B, Page Up A, the backslash Start);
   O, P, [ and ; for player 5 (left, up, right, down) with the keys below them. Players 6 to 8 (two multitaps)
   play on game controllers only. */
const KEYS = [
  { up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight', b: 'KeyZ', a: 'KeyX', y: 'KeyA', x: 'KeyS', l: 'KeyQ', r: 'KeyW', start: 'Enter', select: 'ShiftRight' },
  { up: 'KeyI', down: 'KeyK', left: 'KeyJ', right: 'KeyL', b: 'KeyF', a: 'KeyG', y: 'KeyR', x: 'KeyT', l: 'KeyY', r: 'KeyU', start: 'KeyH', select: 'KeyN' },
  { up: 'Numpad8', down: 'Numpad5', left: 'Numpad4', right: 'Numpad6', b: 'Numpad1', a: 'Numpad3', y: 'Numpad7', x: 'Numpad9', l: 'Numpad0', r: 'NumpadDecimal', start: 'NumpadEnter', select: 'NumpadAdd' },
  { up: 'Home', down: 'End', left: 'Delete', right: 'PageDown', b: 'Insert', a: 'PageUp', start: 'Backslash' },
  { up: 'KeyP', down: 'Semicolon', left: 'KeyO', right: 'BracketLeft', b: 'Period', a: 'Slash', y: 'Comma', x: 'KeyM', l: 'Digit9', r: 'Digit0', start: 'Equal', select: 'Minus' },
];
const PADN = { up: 'up', down: 'down', left: 'left', right: 'right', b: 'B', a: 'A', y: 'Y', x: 'X', l: 'LB', r: 'RB', start: 'Start', select: 'Select' };
const LABEL = { up: 'Up', down: 'Down', left: 'Left', right: 'Right', b: 'B', a: 'A', y: 'Y', x: 'X', l: 'L', r: 'R', start: 'Start', select: 'Select' };
const ORDER = ['up', 'down', 'left', 'right', 'b', 'a', 'y', 'x', 'l', 'r', 'start', 'select'];
function padControls(p) {
  const k = KEYS[p] || {};
  return ORDER.map(id => ({ id, label: LABEL[id], type: 'button', defaults: { key: k[id] ? [k[id]] : [], pad: [PADN[id]] } }));
}

/* Devices (ports.h): 0 none, 1 pad, 2 multitap, 3 mouse, 4 Super Scope, 5 Justifier. */
const DEV = { none: 0, pad: 1, multitap: 2, mouse: 3, scope: 4, justifier: 5 };
const DEV_LABEL = { none: 'Nothing', pad: 'Controller', multitap: 'Multitap', mouse: 'Mouse', scope: 'Super Scope', justifier: 'Justifier' };
const DEV_NAME = ['none', 'pad', 'multitap', 'mouse', 'scope', 'justifier'];
const SCOPE = { fire: 1, cursor: 2, turbo: 4, pause: 8 }, JUST = { trigger: 1, start: 2 }, MOUSE = { left: 1, right: 2 };
const GUN_HOLD = 6;     /* a tap's trigger is held this many frames (the Zapper's rule on the NES window) */
const GUN2_STEP = 3;    /* the second Justifier, aimed by keys or a game controller's d-pad: dots a frame */
/* The mouse buttons over the picture: the host's raw mouse buttons ('mouse': 1 left, 2 right, 4 middle) when it
   gives them; otherwise any press (a finger, a pen, or a host that gives only 'buttons') is the left button. */
const ptButtons = pt => (!pt ? 0 : typeof pt.mouse === 'number' ? pt.mouse & 7 : (pt.buttons & 1));

export const manifest = {
  api: '1.0', id: 'snes', label: 'Super Nintendo', form: 'console', build: null, thread: 'worker',
  files: {
    game: { exts: ['.sfc', '.smc', '.swc', '.fig', '.bin', '.st'], maxBytes: 16 * 1024 * 1024 },
    firmware: Object.keys(FW_LABEL).map(id => ({ id, label: FW_LABEL[id], required: false }))
      .concat([{ id: 'sufami', label: 'Sufami Turbo base cartridge program', required: false }]),
  },
  firmwareFor: bytes => (stKind(bytes) === 1 ? ['sufami'] : wantsChipImage(bytes) ? Object.keys(FW_LABEL) : []),
  /* A Sufami Turbo cartridge that links: the cartridges it links with, asked for by hash before the load (host.mjs
     companions) so the Slot B choice can put one in; one not found leaves slot B empty. */
  companionsFor: bytes => stPartners(stKey(bytes)).filter(p => !p.self).map(p => ({ id: 'sufami-x' + p.sha.slice(0, 12), sha256: p.sha })),
  video: { kind: 'raster', maxWidth: 512, maxHeight: 478, screens: 1 },
  audio: { channels: 2, format: 's16', filtered: true },
  state: { supported: true, deterministic: true, approxBytes: 640 * 1024 },
  extensions: ['options'],
  modelLabel: id => (MODELS[MODEL_INDEX[id]] || {}).label || 'Super Nintendo',
};

let modPromise = null;
function wasmModule() {
  if (!modPromise) modPromise = fetch(WASM_URL, { cache: 'no-store' })
    .then(r => { if (!r.ok) throw new Error('the core file is missing (' + r.status + ')'); return r.arrayBuffer(); })
    .then(b => WebAssembly.compile(b));
  return modPromise;
}
const hex = b => Array.from(b, x => x.toString(16).padStart(2, '0')).join('');
const cstr = (u8, p, n) => { let s = ''; for (let i = 0; i < n && u8[p + i]; i++) s += String.fromCharCode(u8[p + i]); return s; };

export async function create(env) {
  const inst = await WebAssembly.instantiate(await wasmModule(), {});
  const X = inst.exports, mem = X.memory;
  const u8 = () => new Uint8Array(mem.buffer);
  function room(end) { const need = end - mem.buffer.byteLength; if (need > 0) mem.grow(Math.ceil(need / 65536)); }
  const STATE = X.sp_state_bytes();

  let req = null, model = 0, fileSize = 0, fields = 0, source = 0, refusal = null, board = '', chipName = '';
  let frames = 0, pic = 0, snd = 0, st = 0, probe = 0, dev = [1, 1];
  let ins = new Map(), portList = [];
  let kept = null, keptDirty = false, batDirty = new Set(), lastSave = null, lastSeed = 0;
  let sufami = null;   /* the Sufami Turbo's parts while one is in: { base, a, b, aKey, bInfo, note, total } */
  const guns = [{ x: -1, y: -1, down: false, rel: -99, sig: '' }, { x: -1, y: -1, down: false, rel: -99, sig: '' }];
  const ball = { on: false, dx: 0, dy: 0, b: 0, lb: 0 };
  const audioView = { data: new Int16Array(0), frames: 0 };
  let video = null, shape = 'tv', heldPic = null;   /* heldPic: the picture of a state just loaded, until the next frame */
  const cheat = cheatEngine({
    kinds: ['ra-mem'], token: () => req, slots: 0, setSlot() {}, clear() {},
    poke: (a, v) => { if (a < 0 || a >= 0x20000) return false; u8()[X.sp_wram() + a] = v & 255; return true; },
    peek: a => (a >= 0 && a < 0x20000 ? u8()[X.sp_wram() + a] : -1),
    raAddr: a => a,                            /* RetroAchievements' SNES memory: work RAM from 0 */
  });

  /* The host's local time for a cartridge clock: seconds since 1970 read as a local wall clock, as two 32-bit
     halves (cartridges chapter C-SAVE-4). Date is used only for the time zone of that moment. A caller with no
     clock of its own (env.now absent: a recorder, a test) keeps the core's fixed default time, so its runs repeat. */
  function setTime() {
    if (typeof X.snes_api_set_time !== 'function' || !env || typeof env.now !== 'function') return;
    const ms = env.now();
    const local = Math.floor(ms / 1000) - new Date(ms).getTimezoneOffset() * 60;
    X.snes_api_set_time(local >>> 0, Math.floor(local / 4294967296) | 0);
  }
  const clockBytes = () => (typeof X.snes_api_clock_bytes === 'function' ? X.snes_api_clock_bytes() : 0);
  /* a battery save the core takes: the RAM and the clock's record, or the RAM alone (a save from before clocks) */
  const saveFits = (len, n) => !!n && (len === n || (clockBytes() > 0 && len === n - clockBytes()));

  /* A Sufami Turbo (C-ST): a mini-cartridge goes in slot A of the base cartridge, whose program is the owner's
     firmware; the base program opened by itself starts with both slots empty. Slot B: the Slot B choice, one of the
     cartridges that link with slot A's (from the companions the host fetched by hash, or a second copy of the same
     cartridge). Null for any other cartridge. */
  function stOpen(r, bytes, o) {
    const k = stKind(bytes);
    if (!k) return null;
    const fw = r.firmware && r.firmware.sufami;
    const base = k === 2 ? bytes : fw ? (fw instanceof Uint8Array ? fw : new Uint8Array(fw)) : null;
    if (!base) throw new CoreError('needs-firmware', 'A Sufami Turbo cartridge plays in Bandai’s base cartridge, whose start-up program is needed (Sufami Turbo base cartridge program, from your own base cartridge).');
    const a = k === 1 ? bytes : null, aKey = a ? stKey(a) : null;
    const want = aKey && o.slotB && o.slotB !== 'empty' ? stPartners(aKey).find(p => p.sha.slice(0, 12) === o.slotB) : null;
    let b = null, note = '';
    if (want) {
      const c = want.self ? bytes : r.companions && r.companions[want.sha];
      if (c) b = c instanceof Uint8Array ? c : new Uint8Array(c);
      else note = `${want.label} is not on this machine or a linked game server, so slot B is empty.`;
    }
    return { base, a, b, aKey, bInfo: b ? want : null, note, total: base.length + (a ? a.length : 0) + (b ? b.length : 0) };
  }
  /* The battery regions: the cartridge RAM as one save ('cart'), or for a Sufami Turbo slot A's save ('cart', that
     mini-cartridge's own) and slot B's ('slotb'). Slot B's names the cartridge whose save it is ('of'): a host that
     knows 'of' keeps it as that cartridge's own save, so linking reads what the player saved on it; a host that does
     not keeps it beside slot A's save. A second copy of the same cartridge has a save of its own. */
  function regions() {
    if (!sufami) { const n = X.snes_api_sram_bytes(); return n ? [{ id: 'cart', off: 0, bytes: n, ext: '.srm' }] : []; }
    const out = [], ra = X.sufami_api_ram_bytes(0), rb = X.sufami_api_ram_bytes(1);
    if (ra) out.push({ id: 'cart', off: X.sufami_api_ram_offset(0), bytes: ra, ext: '.srm' });
    if (rb) out.push(Object.assign({ id: 'slotb', off: X.sufami_api_ram_offset(1), bytes: rb, ext: '.slotb.srm' },
      sufami.bInfo && !sufami.bInfo.self ? { of: { game: 'sufami-x' + sufami.bInfo.sha.slice(0, 12), sha256: sufami.bInfo.sha, region: 'cart' } } : {}));
    return out;
  }
  const regionOf = id => regions().find(g => g.id === id);
  const fits = (g, len) => (sufami ? len === g.bytes : saveFits(len, g.bytes));

  /* Buffers after the loading rule's work space (file at snes_api_buffer, work space after it). */
  function layout(size) {
    const buf = X.snes_api_buffer();
    const work = (buf + size + 15) & ~15;
    pic = (work + size + 64 + 15) & ~15;
    snd = pic + 512 * 478 * 4;
    st = snd + 8192 * 4;
    probe = st + ((STATE + 15) & ~15);
    room(probe + 128);
    return buf;
  }

  function chooseModel(o, boardRegion) {
    if (o.machine && o.machine !== 'auto' && MODEL_INDEX[o.machine] !== undefined) return MODEL_INDEX[o.machine];
    return boardRegion ? MODEL_INDEX.pal : MODEL_INDEX.ntsc;
  }

  function build(r) {
    req = r;
    const raw = r.game && r.game.bytes;
    if (!raw || raw.length < 0x8000) throw new CoreError('damaged', 'This file is too short to be a Super Nintendo cartridge.');
    if (raw.length > manifest.files.game.maxBytes + 512) throw new CoreError('damaged', 'This file is larger than any Super Nintendo cartridge.');
    const bytes = raw instanceof Uint8Array ? raw : new Uint8Array(raw);
    const o = r.options || {};
    fileSize = bytes.length;
    sufami = stOpen(r, bytes, o);
    const buf = layout(sufami ? sufami.total : fileSize);
    /* The owner's chip images, by role. */
    X.snes_api_clear_images();
    let slot = 0;
    for (const id of sufami ? [] : Object.keys(FW_LABEL)) {
      const im = r.firmware && r.firmware[id];
      if (!im || !im.length || slot >= 16) continue;
      u8().set(im instanceof Uint8Array ? im : new Uint8Array(im), X.snes_api_image_slot(slot));
      if (X.snes_api_add_image(slot, im.length) === 0) slot++;
    }
    /* A console's power-on contents (work RAM and the other memories) differ from one power-on to
       the next (boundary B-PWR-2), so each power-on draws a new seed unless the caller names one.
       The seed is kept in every saved state. */
    const seed = o.seed !== undefined && o.seed !== null ? (o.seed >>> 0)
      : (globalThis.crypto && crypto.getRandomValues ? crypto.getRandomValues(new Uint32Array(1))[0] : (Math.random() * 4294967296) >>> 0);
    lastSeed = seed;
    const loadAs = mi => {
      const M = MODELS[mi];
      X.sp_init_model(M.region, M.cpu, M.ppu1, M.ppu2, M.oneChip, seed, 0);
      setTime();                               /* a cartridge clock with no save starts at the host's time */
      if (sufami) {                            /* the base program, slot A, slot B, one after another (C-ST) */
        let at = buf;
        for (const part of [sufami.base, sufami.a, sufami.b]) if (part) { u8().set(part, at); at += part.length; }
        return X.sufami_api_load(sufami.base.length, sufami.a ? sufami.a.length : 0, sufami.b ? sufami.b.length : 0);
      }
      u8().set(bytes, buf);
      return X.snes_api_load(fileSize);
    };
    /* The console the cartridge wants: build the NTSC one (or the chosen one), read the board's region, and
       build again on the other standard when the board is PAL and the choice is the cartridge's. */
    model = chooseModel(o, 0);
    let rc = loadAs(model);
    if (rc === 0 && (!o.machine || o.machine === 'auto') && X.sp_board_region() !== MODELS[model].region) {
      model = chooseModel(o, X.sp_board_region());
      u8().set(bytes, buf);
      rc = loadAs(model);
    }
    if (sufami) {
      chipName = ''; board = 'Sufami Turbo base cartridge';
      if (rc === -2) throw new CoreError('needs-firmware', 'The Sufami Turbo base cartridge program given is not the base cartridge’s program.');
      if (rc === -3) throw new CoreError('damaged', 'This file is not a Sufami Turbo cartridge.');
      if (rc === -4) { sufami.b = null; sufami.bInfo = null; sufami.note = 'The cartridge for slot B could not be read, so slot B is empty.'; rc = loadAs(model); }
      if (rc !== 0) throw new CoreError('damaged', 'This Sufami Turbo cartridge could not be started.');
    } else {
    /* The record's names (the loading rule again, without loading). */
    u8().set(bytes, buf);
    const chip = X.sp_probe(fileSize, probe);
    chipName = chip > 0 ? cstr(u8(), probe, 48) : '';
    board = cstr(u8(), probe + 48, 32);
    if (rc === -2) throw new CoreError('damaged', 'This file holds no Super Nintendo game.');
    if (rc === -1 && NEC_CHIPS.has(chip)) {
      refusal = chipName;
      throw new CoreError('unsupported', `This cartridge's ${chipName} chip runs a program that is not among the start-up files.`);
    }
    if (rc === -1) {
      refusal = chipName || 'a chip';
      throw new CoreError('unsupported', `This cartridge needs the ${refusal} chip, which this emulator does not run yet.`);
    }
    if (rc !== 0) throw new CoreError('damaged', 'This cartridge could not be started.');
    /* The game data was read from the file in place: put it back (the probe ran over the same buffer). */
    u8().set(bytes, buf);
    }
    source = X.snes_api_source();
    fields = X.snes_api_fields() >>> 0;
    plugPorts(o);
    /* The battery save, before the first frame: one region per save (a Sufami Turbo's slot A and slot B apart). */
    const n = X.snes_api_sram_bytes();
    for (const g of regions()) {
      const got = r.battery && r.battery[g.id];
      if (got && fits(g, got.length)) u8().set(got instanceof Uint8Array ? got : new Uint8Array(got), X.snes_api_sram() + g.off);
    }
    if (r.battery && r.battery.kept) kept = new Uint8Array(r.battery.kept);
    setTime();                                 /* the save's clock is carried forward to now */
    X.snes_api_battery_loaded();
    lastSave = n ? u8().slice(X.snes_api_sram(), X.snes_api_sram() + n) : null;
    batDirty = new Set(); keptDirty = false;
    frames = 0;
    shape = o.shape === '87' ? '87' : 'tv';
    video = null;
  }

  /* The controller ports: the cartridge's record (fields) with the Controller choices on top. */
  function plugPorts(o) {
    const f1 = fields & 15, f2 = (fields >> 4) & 15;
    const want1 = o.port1 && o.port1 !== 'auto' ? DEV[o.port1] : (f1 || DEV.pad);
    const want2 = o.port2 && o.port2 !== 'auto' ? DEV[o.port2] : (f2 || DEV.pad);
    dev = [want1 === DEV.mouse || want1 === DEV.multitap ? want1 : DEV.pad, want2 ?? DEV.pad];
    X.snes_api_set_port(0, dev[0]);
    X.snes_api_set_port(1, dev[1]);
  }

  /* The host's ports, in the console's port order: port 1's devices, then port 2's, then the console. Each entry's
     'port' is its place in the list. A pad is a player: players count up from port 1 (a multitap holds four), and
     port 2's first player is player 2 at the least, so a pad behind a mouse in port 1 keeps player 2's keys. The
     list's places of each console port's pads and device are kept in 'role' for applyInput. */
  let role = { pads: [[], []], dev: [-1, -1], gun2: -1 };
  function ports() {
    const out = [], r = { pads: [[], []], dev: [-1, -1], gun2: -1 };
    const add = e => { e.port = out.length; out.push(e); return e.port; };
    let n = 0;
    for (const p of [0, 1]) {
      const d = dev[p];
      if (p === 1 && n < 1) n = 1;
      const pad = tap => { n++; r.pads[p].push(add({ kind: 'player', device: 'snes-pad', label: tap ? `Controller ${n} (multitap in port ${p + 1})` : `Controller ${n}`, controls: padControls(n - 1) })); };
      if (d === DEV.pad) pad(false);
      else if (d === DEV.multitap) for (let s = 0; s < 4; s++) pad(true);   /* the tap's four sockets */
      else if (d === DEV.mouse) r.dev[p] = add(mousePort());
      else if (d === DEV.scope) r.dev[p] = add({ kind: 'accessory', device: 'super-scope', label: 'Super Scope', controls: [
        { id: 'fire', label: 'Fire', type: 'button', defaults: { key: ['KeyZ', 'KeyF'], pad: ['B'] } },
        { id: 'cursor', label: 'Cursor', type: 'button', defaults: { key: ['KeyX', 'KeyG'], pad: ['A'] } },
        { id: 'turbo', label: 'Turbo switch', type: 'button', defaults: { key: ['KeyA'], pad: ['Y'] } },
        { id: 'pause', label: 'Pause', type: 'button', defaults: { key: ['Enter'], pad: ['Start'] } },
        { id: 'aim', label: 'Aim (point at the picture): left button fires, right button is the cursor, middle button pauses', type: 'pointer', defaults: {} }] });
      else if (d === DEV.justifier) {
        /* Two guns (D-JUST): the first (blue) on the pointer and player 1's keys; the second (pink) on a second
           finger, or aimed by player 2's direction keys and second game controller, with player 2's B or A to fire. */
        r.dev[p] = add({ kind: 'accessory', device: 'justifier', label: 'Justifier 1', controls: [
          { id: 'trigger', label: 'Trigger', type: 'button', defaults: { key: ['KeyZ', 'KeyX'], pad: ['B'] } },
          { id: 'start', label: 'Start', type: 'button', defaults: { key: ['Enter'], pad: ['Start'] } },
          { id: 'aim', label: 'Aim (point at the picture): left button fires, right button is Start', type: 'pointer', defaults: {} }] });
        r.gun2 = add({ kind: 'accessory', device: 'justifier', label: 'Justifier 2', controls: [
          { id: 'trigger', label: 'Trigger', type: 'button', defaults: { key: ['KeyF', 'KeyG'], pad: ['B'] } },
          { id: 'start', label: 'Start', type: 'button', defaults: { key: ['KeyH'], pad: ['Start'] } },
          { id: 'up', label: 'Aim up', type: 'button', defaults: { key: ['KeyI'], pad: ['up'] } },
          { id: 'down', label: 'Aim down', type: 'button', defaults: { key: ['KeyK'], pad: ['down'] } },
          { id: 'left', label: 'Aim left', type: 'button', defaults: { key: ['KeyJ'], pad: ['left'] } },
          { id: 'right', label: 'Aim right', type: 'button', defaults: { key: ['KeyL'], pad: ['right'] } },
          { id: 'aim', label: 'Aim and fire (a second finger on the picture)', type: 'pointer', defaults: {} }] });
      }
    }
    add({ kind: 'console', device: 'snes-console', label: 'Console', controls: [
      { id: 'reset', label: 'Reset', type: 'button', defaults: { key: ['F1'], pad: [] } }] });
    role = r;
    return out;
  }
  function mousePort() {
    return Object.assign({ kind: 'accessory', device: 'snes-mouse', label: 'Mouse', controls: [
      { id: 'left', label: 'Left button', type: 'button', defaults: { key: ['KeyZ'], pad: ['A'] } },
      { id: 'right', label: 'Right button', type: 'button', defaults: { key: ['KeyX'], pad: ['B'] } },
      { id: 'move', label: 'Move (drag on the picture; a double click holds the mouse)', type: 'pointer', defaults: {} }] },
      { pointerLock: 'Mouse' });
  }
  const P = pi => portList.find(x => x.port === pi);
  const held = (pi, id) => { const p = P(pi); if (!p) return false; const s = ins.get(pi); const b = p.controls.findIndex(c => c.id === id); return !!(s && b >= 0 && (s.buttons >> b) & 1); };
  function padBits(pi) {
    let b = 0;
    for (const id of ORDER) if (held(pi, id)) b |= BIT[id];
    if ((b & BIT.up) && (b & BIT.down)) b &= ~(BIT.up | BIT.down);       /* REG-0339: the host masks opposite directions */
    if ((b & BIT.left) && (b & BIT.right)) b &= ~(BIT.left | BIT.right);
    return b;
  }
  const drag = { x: null, y: null };
  function applyInput() {
    const H = video ? video.height : 224, W = video ? video.width : 256;
    const lines = H >= 448 ? H / 2 : H;
    for (const p of [0, 1]) {
      const d = dev[p], pads = role.pads[p], q = role.dev[p];
      if (d === DEV.pad) X.snes_api_buttons(p, padBits(pads[0]));
      else if (d === DEV.multitap) {
        X.snes_api_buttons(p, padBits(pads[0]));
        for (let s = 0; s < 4; s++) X.snes_api_tap_pad(p, s, padBits(pads[s]), 1);   /* the tap's sockets 0 to 3, each its own player */
      } else if (d === DEV.mouse) {
        const st0 = ins.get(q) || {}, pt = st0.pointer || null;
        let dx = 0, dy = 0, b = (held(q, 'left') ? MOUSE.left : 0) | (held(q, 'right') ? MOUSE.right : 0);
        if (pt && pt.buttons & 1 && pt.inside) {
          if (drag.x !== null) { dx = Math.round((pt.x - drag.x) * 256); dy = Math.round((pt.y - drag.y) * lines); }
          drag.x = pt.x; drag.y = pt.y;
        } else drag.x = drag.y = null;
        if (ball.on) { dx += Math.round(ball.dx); dy += Math.round(ball.dy); ball.dx = ball.dy = 0; b |= ball.b | ball.lb; ball.lb = 0; }
        X.snes_api_mouse(p, dx, dy, b);
      } else if (d === DEV.scope || d === DEV.justifier) {
        const g0 = gunInput(0, q, lines, d === DEV.scope ? 'fire' : 'trigger');
        const b = d === DEV.scope
          ? (g0.pull ? SCOPE.fire : 0) | (held(q, 'cursor') || g0.pb & 2 ? SCOPE.cursor : 0) | (held(q, 'turbo') ? SCOPE.turbo : 0) | (held(q, 'pause') || g0.pb & 4 ? SCOPE.pause : 0)
          : (g0.pull ? JUST.trigger : 0) | (held(q, 'start') || g0.pb & 2 ? JUST.start : 0);
        X.snes_api_gun(p, 0, guns[0].x, guns[0].y, b);
        if (d === DEV.justifier && role.gun2 >= 0) {
          const g1 = gunInput(1, role.gun2, lines, 'trigger');
          X.snes_api_gun(p, 1, guns[1].x, guns[1].y, (g1.pull ? JUST.trigger : 0) | (held(role.gun2, 'start') || g1.pb & 2 ? JUST.start : 0));
        }
      }
    }
    void W;
  }
  /* A light gun's aim and trigger for this frame: the pointer on its list port (absolute, when it moves), the second
     Justifier's direction keys (GUN2_STEP dots a frame, from the middle of the picture), the trigger key or the
     pointer's left button, with a quick tap held GUN_HOLD frames. Returns { pull, pb } (pb: the pointer's buttons). */
  function gunInput(i, q, lines, trig) {
    const gun = guns[i], st0 = ins.get(q) || {}, pt = st0.pointer || null;
    const sig = pt ? `${pt.x},${pt.y},${pt.inside}` : '';
    if (pt && sig !== gun.sig) {
      gun.sig = sig;
      if (pt.inside) { gun.x = Math.min(255, Math.max(0, Math.floor(pt.x * 256))); gun.y = Math.min(lines - 1, Math.max(0, Math.floor(pt.y * lines))); }
      else gun.x = gun.y = -1;
    }
    if (i === 1) {
      const mx = (held(q, 'right') ? 1 : 0) - (held(q, 'left') ? 1 : 0), my = (held(q, 'down') ? 1 : 0) - (held(q, 'up') ? 1 : 0);
      if (mx || my) {
        if (gun.x < 0 || gun.y < 0) { gun.x = 128; gun.y = lines >> 1; }
        gun.x = Math.min(255, Math.max(0, gun.x + mx * GUN2_STEP));
        gun.y = Math.min(lines - 1, Math.max(0, gun.y + my * GUN2_STEP));
      }
    }
    const pb = ptButtons(pt);
    const down = held(q, trig) || !!(pb & 1);
    if (gun.down && !down) gun.rel = frames;
    gun.down = down;
    return { pull: down || frames - gun.rel < GUN_HOLD, pb };
  }

  function frameView() {
    const wh = X.sp_picture(pic);
    const W = wh & 0xffff, H = wh >>> 16;
    if (!W || !H) return video;
    const lines = H >= 448 ? H / 2 : H;
    const pal = MODELS[model].region === 1;
    /* The shape: a television's 4:3 over the frame's lines, or 8:7 pixels (NTSC) and the PAL pixel's 1.386. */
    const pa = shape === '87' ? (pal ? 7375000 / 5320342.5 : 8 / 7) * (256 / W) * (H / lines) : (4 / 3) * H / W;
    video = { format: 'rgba8888', width: W, height: H, stride: W, data: new Uint32Array(mem.buffer, pic, W * H), pixelAspect: pa, rotation: 0 };
    return video;
  }

  function optionDefs() {
    const dflt = (fields >> 4) & 15, d1 = fields & 15, sup = (fields >> 8) & 255;
    const auto = (MODELS[X.sp_board_region() ? MODEL_INDEX.pal : MODEL_INDEX.ntsc] || MODELS[0]).label;
    const p2 = ['pad', 'multitap', 'mouse', 'scope', 'justifier', 'none'];
    return [
      { id: 'machine', label: 'Machine', type: 'enum', group: 'machine', scope: 'game', live: false, bar: true, default: 'auto',
        notice: 'Changing this restarts the game.',
        help: 'The console the game runs on. A PAL cartridge runs on the PAL console at 50 frames a second. Saves and save states are kept for each machine.',
        values: [{ v: 'auto', label: `As the cartridge wants (${auto})` }].concat(MODELS.map(m => ({ v: m.id, label: m.label }))) },
      { id: 'shape', label: 'Picture shape', type: 'enum', group: 'video', scope: 'console', live: true, default: 'tv',
        help: 'A television showed the picture 4:3. 8:7 shows each pixel at the shape the console draws it, a little narrower.',
        values: [{ v: 'tv', label: 'Television (4:3)' }, { v: '87', label: 'Pixel shape (8:7)' }] },
      { id: 'port1', label: 'Controller port 1', type: 'enum', group: 'machine', scope: 'game', live: false, default: 'auto',
        notice: 'Changing this restarts the game.', help: 'What is plugged into port 1. The cartridge decides unless you choose. With a multitap here, players 1 to 4 play on it and port 2 has the next player.',
        values: [{ v: 'auto', label: `As the cartridge wants (${DEV_LABEL[DEV_NAME[d1 || 1]]})` }, { v: 'pad', label: DEV_LABEL.pad },
          { v: 'multitap', label: 'Multitap (players 1 to 4)' }, { v: 'mouse', label: DEV_LABEL.mouse }] },
      { id: 'port2', label: 'Controller port 2', type: 'enum', group: 'machine', scope: 'game', live: false, default: 'auto',
        notice: 'Changing this restarts the game.',
        help: 'What is plugged into port 2. The cartridge decides unless you choose' + (sup ? '; this game also takes ' + ['mouse', 'multitap', 'scope', 'justifier'].filter((k, i) => sup & (1 << i)).map(k => DEV_LABEL[k].replace(/ \(.*\)/, '')).join(', ') : '') + '.',
        values: [{ v: 'auto', label: `As the cartridge wants (${DEV_LABEL[DEV_NAME[dflt || 1]]})` }]
          .concat(p2.map(k => ({ v: k, label: k === 'multitap' ? 'Multitap (the next four players)' : k === 'justifier' ? 'Justifier (two guns)' : DEV_LABEL[k] }))) },
      stSlotB(),
    ];
  }
  /* The Sufami Turbo's slot B (C-ST): shown for a cartridge that links, listing the cartridges it links with. Before a
     game is in (the host reads the stored choices then) every linking cartridge is a valid value, so a stored choice
     is kept; the row is hidden for every other cartridge. */
  function stSlotB() {
    const key = sufami && sufami.aKey, list = key ? stPartners(key) : ST_ALL;
    return { id: 'slotB', label: 'Sufami Turbo slot B', type: 'enum', group: 'machine', scope: 'game', live: false, bar: !!key, hidden: !key,
      default: 'empty', notice: 'Changing this restarts the game.',
      help: 'The second slot of the Sufami Turbo base cartridge. A game in slot A that links reads the cartridge in slot B and its save: '
        + 'SD Ultra Battle brings in the other game’s heroes, the SD Gundam Generation parts share their units, Poi Poi Ninja World plays with a second cartridge. '
        + 'A cartridge links best once it has been played on its own first, so its save is made.',
      values: [{ v: 'empty', label: 'Empty' }].concat(list.map(p => ({ v: p.sha.slice(0, 12), label: p.label }))) };
  }

  function stateTaken() { X.sp_save_state(st); return u8().slice(st, st + STATE); }

  const core = {
    info: { build: null },
    get frames() { return frames; },
    get model() { return MODELS[model].id; },
    load(r) {
      build(r);
      portList = ports();
      const v = frameView() || { width: 256, height: 224, pixelAspect: 4 * 224 / (3 * 256) };
      const n = X.snes_api_sram_bytes();
      return {
        fps: FPS[MODELS[model].region],
        video: { width: v.width, height: v.height, format: 'rgba8888', pixelAspect: v.pixelAspect, rotation: 0 },
        audio: { rate: X.sp_sample_rate_x100() / 100 },
        ports: portList,
        battery: n ? regions().map(g => Object.assign({ id: g.id, kind: 'sram', bytes: g.bytes, ext: g.ext }, g.of ? { of: g.of } : {}))
          .concat([{ id: 'kept', kind: 'sram', bytes: n, ext: '.kept.srm' }]) : [],
        options: optionDefs(),
        model: MODELS[model].id,
        system: 'snes',
        usedFirmware: null,
        facts: { model: MODELS[model].id, tv: MODELS[model].region ? 'PAL' : 'NTSC', board,
          boardSource: source === 1 ? 'table' : source === 3 ? 'Sufami Turbo base' : 'guessed',
          chip: chipName || null, cartRam: n, battery: !!n, stateBytes: STATE, seed: lastSeed,
          controllers: { port1: DEV_LABEL[DEV_NAME[dev[0]]], port2: DEV_LABEL[DEV_NAME[dev[1]]] },
          ...(sufami ? { slotA: sufami.a ? (ST_LINKS[sufami.aKey] || [0, 'a mini-cartridge'])[1] : 'empty', slotB: sufami.bInfo ? sufami.bInfo.label : 'empty', slotNote: sufami.note || null } : {}) },
      };
    },
    reset(kind) {
      if (kind === 'soft') { X.sp_reset(); return; }
      /* Power off and on with the same cartridge; the cartridge's battery RAM stays. */
      const keep = {};
      for (const g of regions()) keep[g.id] = u8().slice(X.snes_api_sram() + g.off, X.snes_api_sram() + g.off + g.bytes);
      build(Object.assign({}, req, { battery: Object.keys(keep).length ? Object.assign(keep, { kept }) : (req.battery || {}) }));
    },
    setInput(port, s) {
      ins.set(port, s);
      const con = portList.find(p => p.kind === 'console');
      if (con && port === con.port) {
        const was = core._resetHeld, now = !!(s && s.buttons & 1);
        core._resetHeld = now;
        if (now && !was) X.sp_reset();
      }
    },
    _resetHeld: false,
    runFrame() {
      heldPic = null;
      applyInput();
      X.snes_api_run_frame();
      frames++;
      cheat.frame();
      const b = X.snes_api_battery_frame();
      if (b === 2 && lastSave) { kept = lastSave; keptDirty = true; }
      if (b) for (const g of regions()) batDirty.add(g.id);
    },
    video() { return heldPic || frameView(); },
    audio() {
      const n = X.snes_api_take_samples(snd, 4096);
      audioView.data = n ? new Int16Array(mem.buffer, snd, n * 2) : new Int16Array(0);
      audioView.frames = n;
      return audioView;
    },
    serialize() { return stateTaken(); },
    unserialize(b) {
      const bytes = b instanceof Uint8Array ? b : new Uint8Array(b);
      if (bytes.length !== STATE) throw new CoreError('wrong-core', `this save state is from another build of the core (${bytes.length} bytes, this core's are ${STATE})`);
      u8().set(bytes, st);
      if (X.sp_load_state(st, STATE)) throw new CoreError('wrong-game', 'this save state is from another cartridge or another machine');
      /* THE PICTURE OF THAT MOMENT (23 Nov 2026: "Rewind works on SNES but it doesn't show the rewinding by frame").
         The state holds the machine, not the finished picture, so after a load the frame buffer still shows the
         newest frame. The host's rewind steps back through states alone (its ring for large states keeps no
         pictures), so each step would show the same picture. Here the loaded machine runs one frame to draw its
         picture, the picture is kept, and the same state is loaded again: the machine is exactly the state, the
         picture is that moment's, its sound is dropped, and no battery rule runs (a state never writes the save). */
      X.snes_api_run_frame();
      X.snes_api_take_samples(snd, 8192);
      heldPic = null; video = null;
      const v = frameView();
      if (v) heldPic = Object.assign({}, v, { data: v.data.slice() });
      u8().set(bytes, st);
      X.sp_load_state(st, STATE);
      X.snes_api_take_samples(snd, 8192);
      X.snes_api_state_loaded();               /* C-SAVE-3: a state never writes the battery save */
      video = heldPic;
    },
    options: optionDefs,
    setOption(k, v) {
      if (k === 'shape') { shape = v === '87' ? '87' : 'tv'; return 'live'; }
      return 'reload';
    },
    ports: () => portList,
    details() {
      if (sufami) return `${MODELS[model].label}; Sufami Turbo base cartridge; slot A ${sufami.a ? (ST_LINKS[sufami.aKey] || [0, 'a mini-cartridge'])[1] : 'empty'}; slot B ${sufami.bInfo ? sufami.bInfo.label : 'empty'}${sufami.note ? ' (' + sufami.note + ')' : ''}; save RAM ${X.sufami_api_ram_bytes(0)} + ${X.sufami_api_ram_bytes(1)} bytes`;
      return `${MODELS[model].label}; board ${board || 'unknown'} (${source === 1 ? 'from the table' : 'guessed'})${chipName ? '; chip ' + chipName : ''}; cartridge RAM ${X.snes_api_sram_bytes()} bytes with a battery`.replace(/ 0 bytes with a battery/, ' none');
    },
    battery: {
      dirty: () => (keptDirty ? ['kept'] : []).concat([...batDirty]),
      read: id => {
        if (id === 'kept') return kept;
        const g = regionOf(id);
        return g ? u8().slice(X.snes_api_sram() + g.off, X.snes_api_sram() + g.off + g.bytes) : null;
      },
      clean: id => {
        if (id === 'kept') { keptDirty = false; return; }
        if (!batDirty.delete(id) || batDirty.size) return;      /* every region written: the save is clean */
        X.snes_api_battery_written();
        const n = X.snes_api_sram_bytes(); lastSave = n ? u8().slice(X.snes_api_sram(), X.snes_api_sram() + n) : null;
      },
      write: (id, bytes) => {
        if (!bytes) return false;
        if (id === 'kept') { kept = new Uint8Array(bytes); return true; }
        const g = regionOf(id);
        if (!g || !fits(g, bytes.length)) return false;
        u8().set(bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes), X.snes_api_sram() + g.off);
        setTime();
        X.snes_api_battery_loaded();
        const n = X.snes_api_sram_bytes(); lastSave = n ? u8().slice(X.snes_api_sram(), X.snes_api_sram() + n) : null;
        batDirty = new Set();
        return true;
      },
    },
    ext: {
      hashes: () => ({ frames, sha: null }),
      cheats: { kinds: () => cheat.kinds(), apply: codes => cheat.apply(codes) },
      /* The first gun's crosshair; with two Justifiers the second's is in 'more' (a host that knows 'more' draws it;
         the second gun is aimed by keys on a computer, so its crosshair is how its player sees the aim). */
      crosshair: () => {
        if ((dev[1] !== DEV.scope && dev[1] !== DEV.justifier) || !video) return null;
        const lines = video.height >= 448 ? video.height / 2 : video.height;
        const at = g => (g.x >= 0 && g.y >= 0 ? { x: (g.x + 0.5) / 256, y: (g.y + 0.5) / lines } : null);
        const a = at(guns[0]), b = dev[1] === DEV.justifier ? at(guns[1]) : null;
        if (!b) return a;
        return Object.assign(a || { x: -1, y: -1 }, { more: [b] });
      },
      trackball: {
        lock(on) { ball.on = !!on && dev.includes(DEV.mouse); ball.dx = ball.dy = 0; ball.b = ball.lb = 0; },
        move(dx, dy) { if (ball.on) { ball.dx += dx; ball.dy += dy; } },
        button(bit, down) { if (!ball.on) return; if (down) { ball.b |= bit; ball.lb |= bit; } else ball.b &= ~bit; },
      },
    },
    destroy() {},
  };
  return core;
}

export { hex };
