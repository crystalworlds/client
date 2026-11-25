/*
 * play/cores/atari/core.mjs?sys=<a2600|a5200|a7800|alynx> -- the four Atari consoles for the
 * one play host (Core API 1.0; the build plan, Phase 3).
 *
 * ONE SHARED MODULE for the 2600, 5200, 7800 and Lynx. The console is named in the import
 * URL's query (the host imports '../cores/atari/core.mjs?sys=a2600'), so each console gets its
 * own module instance and its own `manifest`, and everything the four share (pacing, the
 * state ABI, input latching, the console switches, the frame views) is written once here.
 *
 * WHAT IT WRAPS, UNCHANGED: each console's site-owned wrapper (play/<atari...>/web/core.js) and
 * its vendored palette. Nothing in those directories is edited;
 * this is host migration only. No DOM, no storage, no timers, no Date.now(), no key events.
 *
 * PACING. An Atari frame is "whatever the program makes it" (the core interface "Timing"): the
 * old pages paced by CPU cycles, master clocks or system ticks against wall time. The host
 * calls runFrame() at a nominal rate (LoadResult.fps); here one runFrame() is one nominal
 * frame of EMULATED TIME: the clock it owes is added and whole core frames run until it is
 * paid, with the overshoot kept as debt (the 2026-10-10 audio-latency fix of the old pages).
 * A standard title runs exactly one core frame per call.
 *
 * STATES are the core's own raw state ABI (<prefix>_state_save / _load), byte-identical to
 * the old pages' Continue and Saves records, so a state moves either way between the old
 * window and the host for the same core build. A state of another size is refused.
 *
 * CONTROLLERS (2026-10-14, the migration): the old pages drove the joystick only. Here
 * each port's device is declared per title: the 2600's two ports take a joystick, paddles, a
 * driving controller, a keypad or a SaveKey on the right (Settings, per game); the 7800 follows its
 * cartridge header (ProLine, paddles, driving, keypad, SaveKey) and can be overridden; the 5200 has its analogue stick
 * (edges from keys, proportional from a pad's axes when the host passes them), two fire
 * buttons and the twelve-key keypad; the Lynx has its pad, A, B, Option 1, Option 2, Pause
 * and the turn (R). Paddles and wheels are turned by held keys (or a pad's d-pad).
 */
import { CoreError } from '../../host/core-api.mjs';
import { cheatEngine } from '../cheats-core.mjs?v=2.3.0';
import { HEADERLESS_REGION_7800 } from '../../atari7800/web/region7800.js?v=2.3.0';

export const SYS = new URL(import.meta.url).searchParams.get('sys') || 'a2600';
/* The wrapper's own version tag (its URL is built here, so the page's tags never reach it). */
const WRAP_V = '20261030-ui1-scheme';

/* ------------------------------------------------------------------ per console */
const DIR = { a2600: 'atari2600', a5200: 'atari5200', a7800: 'atari7800', alynx: 'atarilynx' };
const WASM = { a2600: 'build/atari2600.wasm', a5200: 'build/atari5200.wasm', a7800: 'build/atari7800.wasm', alynx: 'build/lynx.wasm' };
const PREFIX = { a2600: 'atari', a5200: 'a5200', a7800: 'a7800', alynx: 'lynx' };
const LABEL = { a2600: 'Atari 2600', a5200: 'Atari 5200', a7800: 'Atari 7800', alynx: 'Atari Lynx' };
/* Approximate state sizes (CORE-VERSION.json contextBytes, 2026-10-12 release): the host sizes
   its rewind ring from them. The real size is read from the core at load. */
const STATE_BYTES = { a2600: 938688, a5200: 644120, a7800: 2454760, alynx: 2756384 };
/* The 7800 XM module's high-score memory (the HSC's battery RAM), the core interface a7800_hsc_ram. */
const HSC_BYTES = 2048;
/* THE SAVEKEY (2600 and 7800; 2026-10-24). The SaveKey (and the AtariVox,
   which carries the same chip) is a 32 KB serial EEPROM that plugs into the right joystick port;
   homebrew games keep high scores and progress in it. Both cores emulate the chip
   (the core interface atari_eeprom, the core interface a7800_eeprom, a new one reads FF) and
   leave its contents to the host. When it is plugged in, "As the game wants" on the right port:
   - 7800: the .a78 header's byte 58 D1 (save device: SaveKey or AtariVox) with a joystick or
     nothing named for the right port (byte 56 0 or 1), or byte 56 naming the SaveKey (code 10).
     Every library file that asks for it does so by byte 58 alone (26 files, 24 Oct).
   - 2600 (no header): the cartridge carries one of the four I2C start sequences of the SaveKey
     driver code the 2600 reference emulator looks for (right port only). CONVERGENCE with it.
   The viewer can choose the joystick instead (a second player; the real SaveKey takes the
   port). The SaveKey's memory is kept as this game's battery save: put back after load before
   the first frame, written within a second of a change and when the page is hidden. Kept per
   game, not one memory for every game as the real one is (each game uses its own area of it);
   a game then sees only its own entries. FITTED to the host's per-game saves. */
const SK_BYTES = 32768;
const SK_SIGS_2600 = [
  [0xa9, 0x08, 0x8d, 0x80, 0x02, 0xa9, 0x0c, 0x8d, 0x81],   // I2C_START (i2c.inc)
  [0xa9, 0x18, 0x8d, 0x80, 0x02, 0x4a, 0x8d, 0x81, 0x02],   // I2C_START (i2c v2.1 to 3)
  [0xa2, 0x08, 0x8e, 0x80, 0x02, 0xa2, 0x0c, 0x8e, 0x81],   // I2C_START (Strat-O-Gems)
  [0xa9, 0x08, 0x8d, 0x80, 0x02, 0xea, 0xa9, 0x0c, 0x8d]];  // I2C_START (AStar, Fall Down, Go Fish!)
function hasSaveKeyCode(b) {
  if (!b) return false;
  for (const g of SK_SIGS_2600) {
    for (let i = b.indexOf(g[0]); i >= 0 && i <= b.length - g.length; i = b.indexOf(g[0], i + 1)) {
      let k = 1; while (k < g.length && b[i + k] === g[k]) k++;
      if (k === g.length) return true;
    }
  }
  return false;
}
/* TWO-PLAYER SAVEKEY GAMES (2026-10-24; decided: start two-player
   games with the joystick). A game that asks for a SaveKey but also has a two-player mode that
   plays player 2 from the right joystick starts with that joystick on "As the game wants", and
   the play window tells the player once how to plug the SaveKey in instead (SK_TWO_PLAYER_NOTE).
   Neither of the two sources named for this decides it: the .a78 header's right-port byte (56)
   names a joystick in 22 of the 27 library files that ask for a SaveKey, one-player games such as
   Sick Pickles, TiME Salvo and E.X.O. among them (the authoring tool's default, not a claim of
   a second player), and the site's game database has no player count for any of the 27.
   So the list is by hash, MEASURED from each game's own output (title screens of the 26 files
   whose right port is a joystick or nothing, 1,800 frames each, then a two-player run for each
   game whose screen offers players): Dragon's Cache's menu offers "2 PLAYERS", and in its Score
   mode the right joystick moves player 2's board (probe run, pictures differ from frame
   900 on). On the 7800 only a header that names a joystick for the right port (byte 56 = 1)
   qualifies; a viewer's own choice of SaveKey always wins. No 2600 file is listed: no known
   2600 file carries the SaveKey code. This would be wrong if a listed game's two-player mode did
   not read the right joystick, or an unlisted SaveKey game did. */
const SK_TWO_PLAYER = { '349163654144': "Dragon's Cache (2021)" };
const SK_TWO_PLAYER_NOTE = 'This game can save high scores on a SaveKey. To use one, choose Settings, Right controller, SaveKey. Player 2 then has no joystick.';
/* An .a78 header that wants the XM (byte 63 D0, before the core's corrections by hash). */
const xmHeader = b => !!b && b.length >= 128 && String.fromCharCode.apply(null, b.subarray(1, 10)) === 'ATARI7800' && (b[63] & 1) === 1;

/* THE KID VID'S NARRATION (2600; 2026-10-19). Coleco's Kid Vid played a cassette:
   a data track the cartridge reads, and the spoken story. The core plays the data track by
   itself; the story is the player's own copies of Coleco's recordings, seven WAV files with the
   names and byte positions Stella uses (8-bit mono, 262 bytes a frame). Given them at load, the
   core times the tape by the recordings, as the real one, and after each frame says which bytes
   of which file that frame played (atari_kidvid_speech); they are mixed in here, one byte to
   each scanline (two of the TIA's samples). Without them the game plays as before, silent where
   the story would be. They come like the other consoles' optional files: the site's relay (a
   game server's atari2600 bios folder, by file name) or a file chosen on this device. The
   cartridges are known by the core's own image hash (src/cart.c cart_kidvid_game). */
const KV_IDS = ['kvshared', 'kvs1', 'kvs2', 'kvs3', 'kvb1', 'kvb2', 'kvb3'];
const KV_NAMES = ['KVSHARED.WAV', 'KVS1.WAV', 'KVS2.WAV', 'KVS3.WAV', 'KVB1.WAV', 'KVB2.WAV', 'KVB3.WAV'];
const KV_FOR = { 1: [0, 1, 2, 3], 2: [0, 4, 5, 6] };   // Smurfs Save the Day, Berenstain Bears
const KV_GAIN = 0.5 / 128;   // the story's level against the TIA's 0..1 (FITTED: chosen by ear, not measured)
let kvCapable = null;        // the served core has the narration path (set when the first instance is made; null: no
                             // instance on this side, as on the page when the core runs on the worker: ask, the worker decides)
function kvGame(bytes) {
  if (!bytes || bytes.length !== 8192) return 0;
  let h = 0xcbf29ce484222325n;
  for (let i = 0; i < bytes.length; i++) h = ((h ^ BigInt(bytes[i])) * 0x100000001b3n) & 0xffffffffffffffffn;
  return h === 0x533edd3ab42a6e47n ? 1 : h === 0x70c3cb8fe6da319cn ? 2 : 0;
}
/* A WAV file's audio data (after the header, where the positions count), if it is 8-bit mono
   PCM; null otherwise. */
function wavData(b) {
  if (!b || b.length < 12) return null;
  const s = (o, t) => b[o] === t.charCodeAt(0) && b[o + 1] === t.charCodeAt(1) && b[o + 2] === t.charCodeAt(2) && b[o + 3] === t.charCodeAt(3);
  if (!s(0, 'RIFF') || !s(8, 'WAVE')) return null;
  let at = 12, fmt = false;
  while (at + 8 <= b.length) {
    const n = (b[at + 4] | b[at + 5] << 8 | b[at + 6] << 16 | b[at + 7] << 24) >>> 0;
    if (s(at, 'fmt ')) fmt = n >= 16 && at + 24 <= b.length && b[at + 8] === 1 && b[at + 10] === 1 && b[at + 22] === 8;
    if (s(at, 'data')) return fmt ? b.subarray(at + 8, Math.min(b.length, at + 8 + n)) : null;
    at += 8 + n + (n & 1);
  }
  return null;
}

/* THE SUPERCHARGER'S TAPE (2600; 2026-10-22). A Supercharger game loads from its file
   as before: the core makes the tape's signal from it and its own loader reads it. When the
   viewer chooses a recording of the tape (Settings, Cassettes: the matching .wav on the cassette
   shelf, or one from this device; never the default), the player's own Supercharger firmware from
   the 2600's boot programs (NTSC or PAL, as the Television setting) reads the recording instead,
   as the real one reads a tape: every load on it in turn (atari_set_supercharger_tape). Without
   the recording, the firmware or a core that reads recordings, the game loads from its file. */
const AR_IDS = ['arfw', 'arfwpal', 'artape'];
const arImage = b => !!b && (b.length === 6144 || (b.length >= 8448 && b.length % 8448 === 0 && b.length <= 512 * 1024));
let arCapable = null;        // the served core reads tape recordings (as kvCapable)
function isWav(b) {
  return !!b && b.length > 44 && b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x41 && b[10] === 0x56 && b[11] === 0x45;
}

/* THE TWO-PORT 5200 (2026-10-23; the firmware rule: the game asks the game server
   for the firmware it needs, never a prompt, "firmware required" when there is none). Three
   cartridges were made for the later two-port console, whose firmware revision keeps its
   interrupt vectors at FEAB (the four-port one at FE95): they show nothing or crash on the
   four-port firmware and on ours, and play on the two-port one (Atari development tree
   our test records). Known by identity (CRC32 and size, FITTED by hash): thetris
   (2-port), thetris digital controls (2-port), rolltris (2-port). Such a game always starts on
   the two-port firmware, whatever the Machine setting, and is refused without it. The firmware
   is known by identity too: the upper half of a 5200_alt.bin (CRC32 c2ba2613). */
const TWO_PORT_5200 = new Set(['32768:18a6e6d3', '32768:b84809ac', '32768:b069fed6']);
const TWO_PORT_FW = new Set(['2048:c2ba2613']);
/* THE PAL 7800 BIOS (23 Oct; the firmware rule, as for the two-port 5200): a PAL
   cartridge started on the player's own BIOS gets the PAL console's BIOS or nothing, and an NTSC one never
   gets it. Known by identity: Atari 7800 BIOS (198x)(Atari)(PAL), 16,384 bytes. */
const PAL_7800_FW = new Set(['16384:d5b61170']);
/* THE 7800'S TV SYSTEM, DECIDED ONCE (19 Nov 2026): as the core decides it (pilot src/7800/cart7800.c):
   a .a78 header gives it in byte 57 (bit 0); without one, the core's per-hash table of known files
   (web/region7800.js, generated from the core's own tables) by the file's SHA-256; else NTSC. The same
   answer sets the BIOS role (the PAL console's BIOS for PAL) and is handed to the core before the
   load, and each load checks the core reached it, so the BIOS and the timing cannot disagree. */
function sha256hex(b) {
  const K = [0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2];
  const H = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19];
  const n = b.length, total = ((n + 9 + 63) >> 6) << 6, m = new Uint8Array(total);
  m.set(b); m[n] = 0x80;
  const bits = n * 8, dv = new DataView(m.buffer);
  dv.setUint32(total - 8, Math.floor(bits / 0x100000000)); dv.setUint32(total - 4, bits >>> 0);
  const w = new Uint32Array(64), r = (x, k) => (x >>> k) | (x << (32 - k));
  for (let o = 0; o < total; o += 64) {
    for (let i = 0; i < 16; i++) w[i] = dv.getUint32(o + 4 * i);
    for (let i = 16; i < 64; i++) w[i] = (w[i - 16] + (r(w[i - 15], 7) ^ r(w[i - 15], 18) ^ (w[i - 15] >>> 3)) + w[i - 7] + (r(w[i - 2], 17) ^ r(w[i - 2], 19) ^ (w[i - 2] >>> 10))) >>> 0;
    let [a, bb, c, d, e, f, g, h] = H;
    for (let i = 0; i < 64; i++) {
      const t1 = (h + (r(e, 6) ^ r(e, 11) ^ r(e, 25)) + ((e & f) ^ (~e & g)) + K[i] + w[i]) >>> 0;
      const t2 = ((r(a, 2) ^ r(a, 13) ^ r(a, 22)) + ((a & bb) ^ (a & c) ^ (bb & c))) >>> 0;
      h = g; g = f; f = e; e = (d + t1) >>> 0; d = c; c = bb; bb = a; a = (t1 + t2) >>> 0;
    }
    H[0] = (H[0] + a) >>> 0; H[1] = (H[1] + bb) >>> 0; H[2] = (H[2] + c) >>> 0; H[3] = (H[3] + d) >>> 0;
    H[4] = (H[4] + e) >>> 0; H[5] = (H[5] + f) >>> 0; H[6] = (H[6] + g) >>> 0; H[7] = (H[7] + h) >>> 0;
  }
  return H.map(x => x.toString(16).padStart(8, '0')).join('');
}
const hasHeader7800 = b => !!b && b.length >= 128 && String.fromCharCode.apply(null, b.subarray(1, 10)) === 'ATARI7800';
function region7800(b) {
  if (!b) return 0;
  if (hasHeader7800(b)) return b[57] & 1;
  const row = HEADERLESS_REGION_7800[sha256hex(b)];
  return row === 1 ? 1 : 0;
}
/* THE CONSOLE'S OWN FIRMWARE FIRST (1 Nov 2026; "We should always use the
   commercial BIOS first if it's available"). The 5200, 7800 and Lynx start on the player's own
   console firmware whenever the site, a content pack or a game server has it, and on this site's
   own only when none is there. A choice made by hand in Settings, Machine, is kept (the host
   stores an option only when it is changed). Three lists by SHA-256 of the game file, measured on
   the served cores (Atari_Capture pass 1, the same files with and without the firmware):
   - NEEDS_ORIGINAL_5200: plays with Atari's firmware and not with ours (it copies or calls
     Atari's code; 5200 Doom was traced to the byte). It always starts on the player's
     firmware, whatever the setting, and without one stops with the needs-firmware message
     instead of a black screen (runs run-atari5200-41698c7f-va294bb09-bios-seatA5X and -seatA5Xown; on 18 Nov 2026
     our firmware gained the start-up screen routine those programs copy, and 27 of the 32 left the list:
     run-atari5200-d2721a32-v362f2c3f-seatATARIFWown).
   - KEEP_OURS_5200: plays with ours and not with Atari's: always ours (the same two runs).
   - KEEP_NONE_7800: plays started directly and not through the NTSC BIOS: always started
     directly (runs run-atari7800-41698c7f-vf89c1ab4-bios-seatATSWEEPbios and -seatATSWEEP). */
const NEEDS_ORIGINAL_5200 = new Set([
  '06a6cbc575182f119cd5a5846de2b438202f1907fd54c2ae1f73bf8557f419d1',   // Benchmark Test A8 XL XE 5200 Rev2 doppel
  '84851ed8fb378498b44db38b9a1e3c94cf63e5a55845cfbbd081567428c17619',   // Yellow Submarine Demo
  '8dbac556f89a96cdf9132dce2b8f8d586bb0f21a09a48bab542a91b4ae287d8c',   // Boogie Demo
  '8eea898b3b293c74ef867c186d93c1efbb1b0511de0c0945263fa7474f0c9ad1',   // Space Race
  '99f0e374a80edd1301e514f153d95a350248409bb402d01ba2e83e2acdc2a731',   // Acid5200 1.2 - full suite
]);
const KEEP_OURS_5200 = new Set([
  '2b136a71eb8bce3eccd6b8ff45da41ada7cd083020b46dc25b543133ede59226',   // Gauntlet
  '4ee302e847dcfc82dfae60f34a7460779f25a80070aa7f5adbbd2dd8dbe7b317',   // Testapp A8
  '94d4d22b592548c392b369206dd0b4fe43c3672d046ddabfa2b4a405063fe479',   // Gauntlet Pre Order And Playable Demo
]);
const KEEP_NONE_7800 = new Set([
  '07829cddb6bc240f0ea6c4dcdc955dba2c322621c1b0839e4f1be67cc20d0dc9',   // Graphics Demo 1
  '2f6cc581a0a835640d1a15cb5bd4862760374a6865499162ef2d2c31803d0e41',   // Santa Simon
  '4153f074b2410a468e42022527fdb820a6ca11ed37b166239d99a0ea997fe1cb',   // Galaxians
  '9ebd09b078933ff5bb32a95ddd7345ffd1731dfbda48fbb725e06864d5a60bcf',   // Shuriken
  'b9d79699923659e452c9e27dbeab73fd2f2f3bb3e86388f6465900d55ba73ac4',   // Color Demo 1
  'c9cc4954027f20c19c869bb92e5bf9ef1722c19ee348f074552e1fed214e88a1',   // Stinger
  'd84dba6a975eb6fa11fa6901000eaaf99f317569ee60ce6c1e090203602ed825',   // Clean Sweep
  /* the other versions (run run-atari7800-41698c7f-vf89c1ab4-bios-seatBIOSPREF-m against -seatATSWEEP-m, 170 files) */
  '59cb118c3b4420c1c68f89f35c199c151c46ac70481c0772901051a4915b0dd4',   // Crystal Worlds 7800 test - audio_pokey450 (a version)
  'a9637dceb71b634d8037e36b6f4851a2d8a8266f17bcf90948404dd1c5f03ecd',   // Crystal Worlds 7800 test - audio_pokey450 (a version)
]);
/* (1 Nov 2026: a game that does not boot must not just sit there): plays through the 7800
   BIOS and not when started directly (blank, hung or a still screen). It always starts through the player's
   BIOS, whatever the setting, and without one stops with the needs-firmware message, like NEEDS_ORIGINAL_5200.
   183 files, all NTSC: runs run-atari7800-41698c7f-vf89c1ab4-bios-seatATSWEEPbios against -seatATSWEEP (40) and
   run-atari7800-41698c7f-vf89c1ab4-bios-seatBIOSPREF-m against -seatATSWEEP-m (143, the other versions). */
const NEEDS_BIOS_7800 = new Set([
  '00bb369b64c4d3f174ec1dd5f8ac306c914d0da480ea9cbaa7e7450dcb899c44',   // Mario Bros test programs
  '0284ee137e1327137b658124d3940bcc9bd7688025bab3e0df727a4cb9e92448',   // Mario Bros test programs
  '039274d8f3de87509e887000cac12d1daa53615404306cfea22eb5554cafa948',   // Kung-Fu Master sound tests
  '0878ca590b3d79ab760add46e619b2dc6e6f1284b6a5bd5f7444906fc7288d94',   // Galaxian sound tests
  '0badb825b984829e5f7d8a86d9afa635a5164a343d94e41ba338ab15335e4d3c',   // Crystal Worlds 7800 test - audio_pokey450
  '0e7ede978958088f26cd3dfeab29952332a925a5cb039fa8e67beb5938a51031',   // Stranger Things Main Theme Music
  '0f090143dcadcb983cd7deb40d2c7774aeacc491ab143d56b16a18df020ad4ae',   // Galaxian sound tests
  '10516cec206290f1cf0d1dd2feb5b9e9210fd8af38e1e1b76e142a560b65402d',   // Galaxian sound tests
  '134c61a1261deca6991cec1fa43b0a13158d437699593264e98d3659ef97c775',   // Allura
  '141bfa1093ab9b3f5bd84ddced79958a41de859bcac5d838ef0ec7f72dab368b',   // Mappy - Death
  '151b3720c8b754a9fbd3de231a4ce74aa92686f4a006c7471dcb67ffb37f3c2b',   // Crystal Worlds 7800 test - audio_pokey450
  '15cef14754c8dcf1272c359864f193c221f765ea1ae48cd4f2708f6d900d792b',   // Allura
  '16915349a8246b60e7813efe6984b638605b850d5c85e3678d03375d5d0a3661',   // Galaxian sound tests
  '16b2bf32d61822f2a2670d7c0023a89a86690f5819b62dfa10157f2f06d7fdc4',   // Crystal Worlds 7800 test - audio_pokey450
  '17d893020d4b7f596394c0e71d9c6f216f0a62ca5caf7a68fa5bd3aac29ebba8',   // Mappy - Death
  '1972f413dd88b81e4829e441b8f1e6b80603f11d18d79d9c79080a2fbcfa2f95',   // Galaxian sound tests
  '1a190a8ad7ae868721ba35921de9a5410a0d50f5ba8f59f3d9da4b791dfee501',   // Pac-Land Break Time Tune
  '1acdf1776c43926c0648b69b1fd2838df52e84d9b1211ac4e5660fb509a1049c',   // Mario Bros test programs
  '1b2474238a80b94c72b22c67e988bd178b199eee1e999245e045df1237764585',   // Mario Bros test programs
  '1d9ec5d17adcc4541e9bafa6fbd5356585327c8f6fdacaac5df8d0909ecaecf7',   // Galaxian sound tests
  '1de4de2d6d73bea29360aa84b778c098bba3073ffb9d2a4ecfa110449dc66d3d',   // Pac-Land Break Time Tune
  '1e73229b0fa142006378baa485aca9ea6c269b358b09fdd09565e3c560a62ec8',   // Allura
  '1ef6cea56167551a8205b5643b0088f009b758076b3ffe29f6f52ab034a9e6ed',   // Top Gun - Danger Zone Demo
  '24f115e231347f28c6166fe6597be4881d347822e9362a111d2ca2cae3276eb7',   // Mario Bros test programs
  '27677a033131226cbb3aafa78b851f41daab87c895fa17b7c36ec2eca270c997',   // Prince Of Persia Title Music
  '28c6aa28105c62ba9470dc854f022ac54c8f6db88bf5aa21383b6a97b1f37434',   // Super Mario World Opening Melody
  '2cec16bb3dd4f6e08cc60ffbd65905d415519fa9b9529fe928c2ddcb66739908',   // Galaxian sound tests
  '2ecd63ba36778816f63be0ab7483b5b5545a17079d0e6ca40854aec412539f02',   // AtariAge Jingle
  '2fb1b876b98e4401923271a6a3cbcba83f3e13e581b1630177f95b76887c6667',   // Stickerbrush Symphony Music Demo
  '2fc7d04829b2cfd3b3fff44f3b8ebea83e9b617f4ac6c3280bb8b86b7b9cf7bb',   // Galaxian sound tests
  '3316dbf12e79cfb16d873ae2831d0859488b612e953667ffd5c589f884dea15f',   // Kung-Fu Master sound tests
  '34f08a9f890a6613fdb061364f6d8ab033b85b556021e5ca35e7172f496d1ab6',   // Prince Of Persia Title Music
  '37ac4f397cf4b3f0c8494fdd7de1fb3907aeb0e6cfcbb7e3758eec78bf18fdc2',   // Galaxian sound tests
  '38a966eff44be205796e1eefab9d5ef4d815bec5181eed3d31e4ad8d978f6d9e',   // Deep Purple - Smoke On The Water
  '38faeb90bd3a7362beafe47b8abba73bccc395c83d1c3737791823534308c4d2',   // Pac-Land Break Time Tune
  '3ae97e0f9ba5a66975f0277035bb749d8c68c54a38963ecffde92adbd84046dd',   // Stickerbrush Symphony Music Demo
  '3d5f7890fa3beedee35b06cdedd80b9d8cd961e460fddfb15bef609682271449',   // Galaxian sound tests
  '3dc64c51d22efb84f2593a7a842c7af192580a3b0f2ce4fb461cde3092d41fb1',   // Metroid Brinstar Theme
  '3e3e861075eb0b73e654ab0945b11518e60da8e036428ca4f2f0b8ab1a708b86',   // 3D Worldrunner Theme Melody
  '46de33f7a0da85efa10efeb519cde2a69f60f7c06f7616786f0e3e43574a9efd',   // Mario Bros test programs
  '474dcad08043a511742263dafc1b544af4f37a767a0c83170377234ef5f62b95',   // Mappy - Death
  '47fb63cc308cab6e456c11bc7ec9e48118e3736707812f64dd5ce7002577398b',   // Arkanoid
  '499244b61c2d4e52922f0b3df7a7c601aba20230081141a12f1440aab21b6798',   // Crystal Worlds 7800 test - audio_pokey450
  '4b7c771f393112be0fd38a4d66f7aca423be8239ea92120fb5befe8ec7927ef7',   // Allura
  '4bcdd7d252916e0bcdb62e5e825a0342c4c0e2e19ad1fd93a23c213544da31a5',   // Pac-Land Break Time Tune
  '4c9a8eabbf0d45641752c0b51bae8868066e9db4f13404c21155d4ea6617e6ce',   // Arkanoid music tests
  '4cd80f793cfcafdefb6ca1b3865aef5c9f8d2802a6ba4a82ff6b7b70f9f1ae84',   // Mario Bros test programs
  '4f8e206063406437d2483182be325b4913ae22570f47930540d13e9949e6cca4',   // Shadow Of The Beast - Title Sceen Demo
  '508662b56430f85081fff4a60e2a087d0aa4f7d16615a81067ab989ba2f338b4',   // Crystal Worlds 7800 test - audio_pokey450
  '51240ac39270c3e1933dfb623a7f1001eb65b5f618bb47f5b42ea4ee362305d6',   // Pac-Land Break Time Tune
  '5265b8e0c355363114906bdf2deba066762deeade3c8808446b038faf906e265',   // Crystal Worlds 7800 test - audio_pokey450
  '530ffff3595c3c1ff57917da4b7e06923fcc987acdf01ad708d60e830d886cba',   // Galaxian sound tests
  '53229d50e0ef13369c07abb6b62953257f1582cd3dabad4d494921df317fa49c',   // Mario Bros test programs
  '53863182ae4c176b3fad66b3ce380ec8fbf544af864c48b5e1b4b8aa097fe4de',   // Galaxian sound tests
  '55e7f8ecd1939730035b19538d91bc03a7efa917965ae0d20ea5a4fe9984d022',   // GODS Title Demo
  '5616519be44127f1612dedf96db96960028a650fb7eaab4b4a862d3fa6b68924',   // Zanac Area 1 and 2 Demo Music
  '578e94826e94272a7ddeb2cc095c080b5dc86727599f6b6bab261a283b79498a',   // Mario Bros test programs
  '58ee912b03e7b141f7183df164817d242d5ed632be527107f73dd52eb13b66b6',   // Galaxian sound tests
  '599d80af9b55aca1e94f10acef655ae91a4b59052d4b4e25f6bc787d25dae8f0',   // Crystal Worlds 7800 test - audio_pokey450
  '59ff2f90d4b3c1b7d96645a82c6e8a9a483c709b5aae5c430b8ddcd590059039',   // Top Gun - Danger Zone Demo
  '5a6480cab1bdc23bf65b24deda5f2ad501aed77820d217e7fa2ccae1fc2d203c',   // Galaxian sound tests
  '5bb3b55e71ab14d89c499d88da61a9e50c9665257160ed4463c698e833cf5942',   // Crystal Worlds 7800 test - audio_pokey450
  '5d1f45b4f22568e8df15eb94550e1797e70325139462b339af3cb8c3eab58373',   // Dragonfly
  '60fb3e578681719ed895c1a8b49ca2f070d0b27cf1cdd66b4085820ac8dd7c1b',   // Mario Bros test programs
  '615b5a802782a795ea7a47fff7cdb977596b4d894f4a1089fa52dc020d3d8434',   // Kung-Fu Master sound tests
  '6392f8d20dc23a7f3d4eb881053374ed0623f037890833dcc5d9ee451435651d',   // Mario Bros test programs
  '63ceb431f5fe87ac3b0dddb090c13fa8bfe3f07547ac6c33751abc40b7b1aa62',   // Galaxian sound tests
  '67b5c8e73849266d635947f6d63c911396f878cc5394756afcd531ab8b0f676f',   // Mario Bros test programs
  '68337997e8bd440e1d9d4ed522c8fc4d13c32365d7b218c457276b458d5948b6',   // Crystal Worlds 7800 test - audio_pokey450
  '68d3f620073c8d0ed0d9d01cb3edbeff3431f0a358c3aa158224d586136899cc',   // Mario Bros test programs
  '6bbd3bfacb4485159bbf5b9deec212f97f22c0aa65c866909a3e597303503b89',   // Mario Bros test programs
  '6c89d4411acb96d93c09dac0e97408827fc2c1651cd6136fa177c6c7fa7a5f76',   // Maria Bug
  '6d3dfac7594cd03c7d6a59b7d15ad1cea8cb4fceb4e2a8cddffd19c40b57664f',   // Pac-Land Break Time Tune
  '6f7111d2225715ce666efd5915fd01250a5ccbc4026a34c7ead9da0c3c55a6e1',   // Zanac Area 1 and 2 Demo Music
  '709d27bcc9f8f1fcfe27ba025db3647813a9216b78e73407ee1efbf88ef15a7b',   // Metroid Brinstar Theme
  '711961cb728ed7b72c0deeea4e7b1f306f04b855ee045ea87849593927d8fa99',   // Galaxian sound tests
  '71e829a9b71b25a939f5a1308141d75adb978a93f367d7def5b481a30da11c3c',   // Super Mario World Opening Melody
  '748ba85a934e51551a750d305d98914433205b693d4c799129a9db137e5ec872',   // Galaxian sound tests
  '76338271c4fb18575e3f037119456325f3fa9c44c71b1048c9d5a986b4820a23',   // Call Of Duty Black Ops - Cold War
  '77bb8283a0a25af18089f184683324c84e76fdeb73bde8538dbf9ffe1bfeeb56',   // Bubble Bobble Theme
  '7877bb00ec84e1d20c6c275af554a80734efe494729639a175232c0fe053af18',   // Pac-Land Break Time Tune
  '78fb632b522d938a0d355d7b8acc2c385468f80795a1e81f489c2d23f2c6a57a',   // Stranger Things Main Theme Music
  '7bdf08632d773426361e3be221500bd0b3068c42be8ade4956f87e3dec284a44',   // Super IRG Flipping Images Demo
  '7f010e1ce168ebfa0ea095f63e34e467e57d9fd424ec835c4122fd92e9d8f5a0',   // Slots
  '82ac2f5aca3ab4b106dadb5333903890ac5ff25e2c4354ccba3cef5f4877db7a',   // Pac-Man
  '82f68658fd5296ee1569b36625be1b0f040b87a026d064af1a60bfa9a6a87264',   // Mario Bros test programs
  '82fcaaf08ec97a5d41d234095d8860295b9b61329143c073143591fe379531bd',   // Deep Purple - Smoke On The Water
  '85cbfe2eab8778a4f116b0f31d099a647f76e0c745b2979cafe38bb0e470b7f8',   // Metroid Brinstar Theme
  '8a3fbbdb563077b0ab9b9a8586eb0901b4542716c0ada82a78a646d08bc97e43',   // Galaxian sound tests
  '8a6e63a7d6e5160e56e884249bcc1294b0f1e267251c39ee78c3f3848107337c',   // Crystal Worlds 7800 test - audio_pokey450
  '8a9f1d6049eb3a3115ab3ffeedc3dc0259e7004a9f2eca033f79e88d3d3da13c',   // Arkanoid music tests
  '8ab203f34186694fdb68b47b5b2c2cfdb818ebb0407c474e0998f1a94a888811',   // Galaxian sound tests
  '8af0376cee80893a64459d6ab89c7f8b635a0168e5355d7092b96691b333483c',   // Mario Bros test programs
  '8af80ceb4f8cbcf3b34de20733d08edb832aaadfad784fec8860a9f5eb6247cc',   // Zanac Area 1 and 2 Demo Music
  '8b4992150b86d8e036da6f8510286f180f39bd354bdc903784916eb75958420a',   // Mario Bros test programs
  '8ba0be287b3246418d42fa81b31a1b4fe81ea3202ad1e117ec52ff5429df36a6',   // Galaxian sound tests
  '8c87ea0313b066d7da3b3196549a567c569410d16981ba556d063aac82d04043',   // Mario Bros test programs
  '909fc423397d5c35268295bd3c41939cce303f2effc7865dcd44808abeadee80',   // Arkanoid
  '91cf32e946dca65ed876c1697ba428e4f04a04dd8d8a2448f20f50ac171cd188',   // Metroid Brinstar Theme
  '969de2548cea99e04f6edb5f8442bd216c18e80d1fb20a074141f984777d2e0f',   // Allura
  '97acf8829ed6c3bb7dd6f94fb4673ab39871a830a8b70170ca9e34d1ee9792f3',   // Cybernoid II
  '983c98c11dba3f6765cb8dcf1b89ed4edab50f748d8970d9ef00151f3b4243de',   // Galaxian sound tests
  '98501b2f8a73459c2b95d82549e635ea0df7b0bdc55c76d34c268abb603e8e76',   // Super Mario World Opening Melody
  '9b98eb16ca5240b0c206cb7f6dac72321bda8f15cc1d37071975aaab8d1ffe5d',   // Allura
  '9cd0283e32085c667ed34678f0a91c0fbfb38f0df9014b6618d27fea0bf2e563',   // Galaxian sound tests
  '9d505ee074b5c8e42b6d7c48e9f1b23da36d328d268c5607cdede83229238d50',   // 3D Worldrunner Theme Melody
  'a048a43cf5d0df8541f4f33a101ca2d5895426daba456c58b9ed27c66aa8e15f',   // Kung-Fu Master sound tests
  'a0c16b07a1821b2aec1c82b9ab63f425961a5b5aa41e2a37793e53710eb50cc5',   // Galaxian sound tests
  'a188b49586b2772839c324398f342404a411f07ec3bc84b6ca46382eae0bf340',   // Kung-Fu Master sound tests
  'a2326977066c15054c2ec54b21331b6889383a9547f2ce22cac0eb5758bba0fc',   // Galaxian sound tests
  'a2b1d688cc7e55355c3a777a0e5e8c76223043da6215ca13230d71f51dcdc017',   // Mario Bros test programs
  'a463f11633cf4bf4e6dbc808b1a53b1e80a9b389e693edb680b3985ebb3fe286',   // Kung-Fu Master sound tests
  'a46c908413315d347f666905866778b77e3e866e9a6310a6351553394322edd8',   // Arkanoid music tests
  'a4d37c7ddc9c692372f574fd14e523f9a71ae5c831cc2ec771dcf2827051f711',   // Zanac Area 1 and 2 Demo Music
  'a59f8bdcf5af1d2ed6faa5d8b4026e87ce1dfb2b8ce53f7601064e840ef41dbd',   // Crystal Worlds 7800 test - audio_pokey450
  'a5cbd30066764cb2c5da35c64d7a1e81f341b943def477ac6b659378e7c3da86',   // Millipede
  'a6996a985c5ac8269c310c15ffbd0ac04424312e931cc400bd0b48fc9d8f3ebe',   // Kung-Fu Master sound tests
  'a6d0970355de7f5ddcadd25731f4fc234d539291291c112913f3c306e999dd74',   // Crystal Worlds 7800 test - audio_pokey450
  'a725b955afd726bd03ba3fb0aa952ce4287ab50b22ac3fe6b527b4a6784768d6',   // Crystal Worlds 7800 test - audio_pokey450
  'aa245e827f6d62b9e9906ad7b2c9ac4698954c72d5677bf3e3b0fcaaf22af9ed',   // Galaxian sound tests
  'aa68e46e66ac365a38e50d7231852fd0074690cb87c90be5d7e9027e19ea0f25',   // Bubble Bobble Theme
  'ab220a3e8222fb4ebb9b7c58877d06e893efa15f7ac89054eb98e54c61a34137',   // Mario Bros test programs
  'aba7f418d4ca03d2643ffd1df63d9f761226b6c9b7102436b4b1b78c8918169c',   // Bubble Bobble Theme
  'ac8bf9a7b319c913bf6763b193b634cf18c0c9819b3f50bd54da272d57b95a8e',   // Stranger Things Main Theme Music
  'b044b55da4ee0a5ef3a876d62de4f73a73c5ddc28e78986466d0f4d8da28ec9a',   // One Zak And His Kracken
  'b181b29ea978d6360baa0a0c9cb4f4726676a00cb8699cdb5e272a7bcfd0a52a',   // Rolling Thunder
  'b2795211e9d7f04c77d536bf89f1f39d3df650f82a012aff44c19246ae006b1b',   // Galaxian sound tests
  'b351bfa05aaca65083f502650184e395511b7686de56174c3c991fd4fdd1f7d2',   // Mario Bros test programs
  'b4717554cf3937d2e025330a273cbc9a9f36b175adcff7482d3d723a40dabdc7',   // One Zak And His Kracken
  'b5d975af5f8718c7e4334fd863e46c3e97dd37a96d2498dd82de4e29da63699a',   // Kung-Fu Master sound tests
  'ba8bcf4b07c1c228a66379f7dbf4fa1d56629264f940bfefa540950555ea9545',   // Pac-Land Break Time Tune
  'bc6b4121d856a6a519bd42fa94e2f444c22f17de93177a3b9507a703c7fd10b1',   // Pac-Land Break Time Tune
  'bc86b0f7c30cb60ab21c2f011cb5a8487b0b99e6b828d0749213bd3ceb07bebd',   // Kung-Fu Master sound tests
  'bd11e9145eff7815a6dd9c6b2e17674859a25d7048cc897a5ff123021804a752',   // Mario Bros test programs
  'bdad8116418f2b9a160b127486f38f7f6e64f40b102ff9f6b8e972cb3e6b2a5f',   // Galaxian sound tests
  'be1b3faa4af23602c1a4b750c132286c3f2ff4122278fa2204e6019373f9dfa2',   // Ghosts'n Goblins
  'be1cd60d99a849a027ec3390f3b213d79677aa809fc3eaf449b43522d086dc4d',   // Galaxian sound tests
  'c0a34b2c729aabf2ef8656cbba05973ee5805bc9c8917ab28bffdfd5b5111271',   // Metroid Brinstar Theme
  'c1347a52e6d09237dfd6a0a9bd1ac276f9b58da79c190bf507f115d7a4050a3f',   // Stranger Things Main Theme Music
  'c1ea58572b375229e75047fe1053541dbfce210cbc1cccb0c652de40a56c2c14',   // Pac-Land Break Time Tune
  'c2dec5408283a6f93cad074490a216a5c2ece75895ed188160e3db3689f84c6c',   // Kung-Fu Master sound tests
  'c5945c2548dea77c0d0c522dd92f54427af26cb3b1bab4ae50c8907f8deb397b',   // Mario Bros test programs
  'c5bb07a40c0e6d6d2ed9b4186f59a6de57a1efa34dd963013144b45418d6d311',   // Mario Bros test programs
  'c6f1786e540649fdd87809f0a08a789caf32a2d7de4cd491a742fc3c5b16a9f1',   // Mega Man 2
  'c87927c16fb17078d9ddbd9076c582efb956fbc6f8531f930138b883cd49584c',   // Crystal Worlds 7800 test - audio_pokey450
  'c9d6996971236af748bc8aa0bfcfd61e8837e120758fa39d0ed64b425080eb97',   // Crystal Worlds 7800 test - audio_pokey450
  'ca92c57b5e9599a1631ec0ec2fa584eb943f10f793ab8df00d44a33867546b69',   // A Warm Welcome
  'cf2307b698ad6bfdaf562d659887e2a8b4b0f01d058dc24478eacb973829766d',   // Mario Bros test programs
  'd11efcbff63a7ebf55742e220420cbf1c04eb04b313cfd9a1c134ddf5307a2a0',   // Allura
  'd2c6f052bf27c1430b288341ecbe5bf317ca80df6afbeadf525d00e7b1f89887',   // Metroid Brinstar Theme
  'd3107da3a4b126f45b16ddff58d253b329afd082fd66cd7fb41c38a0858f6477',   // Galaxian sound tests
  'd82cb8ffe119d303e9fb0cf3a859af8fa40a0b07bee9142b2a71b86b4bc17a8e',   // Mega Man 2
  'd83e073a20b6ac5ed2e6e94a6b5f986dad8e230f3056c31c448037c26b6787a6',   // Crystal Worlds 7800 test - audio_pokey450
  'd97ed80476c6966d9ea5dafd20501dcdf8cdbb4e1f41b5fe40f1b38da4a3d658',   // Ikari Warriors Title Demo
  'db6ebf9414e76574e1c46118325b91d9230d1a3201d312f6d3fa76549b3bfcb6',   // Galaxian sound tests
  'e0f48e6d9f370d8eee3ea8bce5028d13f9f2e10061b7a893476a08b620a5996f',   // Galaxian sound tests
  'e0f746ef5a7ae8562138497a0e5d5520241b829ea6c28a965120097f59c186b3',   // Mario Bros test programs
  'e11ca32be3a560cc889db8c1d0944e80fd38125e6f78f105bb4ed577e4323f09',   // Mario Bros test programs
  'e60304b8ed0d42fd9f7d8f21738027ed9cbcd1c69d5862b281d950375ce2a2dc',   // Pac-Land Break Time Tune
  'e7727ed55ebc8a8e7af3827f25bef73c8b1ed507ae3f6396d7e9662f0c813405',   // AtariAge Jingle
  'e87fdaa693e1b414a6702ec1ba690fd9f0f2f0922e41865d19cfd7b00ac0487c',   // Crystal Worlds 7800 test - audio_pokey450
  'e8c60e170e333f0e0070286ebdb933acd55764afc61bfda6aa926fae919269d0',   // Cybernoid II
  'e9d60ca100c5d13ce744f0f4571b561ef9b780e9062fe99e0ca5da002fc28889',   // Galaxian sound tests
  'ee679448fe215f9c879aa24a18a188ec59e7227745b883952f0e51bd73ebbeca',   // Allura
  'ee6e36163c00456563106b93c20c776904c865b254f1e6967b310d1272b7e21f',   // Mario Bros test programs
  'efd34dce667ce8bdb6857798cd1587a6bcfc4514dabfd3b9f4b6c686a2eebce8',   // Mario Bros test programs
  'f22d6acf30e0f4d68af3417c0097e61c7e2afd5e4d7a20dd445e3af5bca93f6f',   // Kid Icarus
  'f31dc310fc4428e3dc1b4f74fae6c270320972a8a549b9d321d1196fc9468103',   // Zanac Area 1 and 2 Demo Music
  'f5a685fa8e8f4b7702683f2f2e0d7c0c7d96b8bb67de5c24e92d565d28f7473e',   // Mario Bros test programs
  'f6303539dd41573491812d9f9ce2e4410a914b4ce0abe3206ae178bf1373e665',   // Allura
  'f6ad2ea270156fe91af88c21aaddb893bbde55ba6c69c315eaa36e2b506a3400',   // Arkanoid music tests
  'f6cfe93b050f02703e11f02450b66032f3b465eba30ddf374f4ca07352a6b94d',   // Galaxian sound tests
  'f7ccabe4c97bbdbb85eb02a80c61518892bdf35048c6f0fd4820c72ab2fb0550',   // Hallo
  'f8ef43dbe4f943f1b9bb74cd9d6fa4456b3cd26dc9a1fa462ad57b122441d042',   // Galaxian sound tests
  'fa52dfda99c9f2e717f7408f1c3adbadad6efd6b909833b28ad0e568445ad505',   // Zanac Area 1 and 2 Demo Music
  'fa5979c2c9896d2c16965f5384436772cf168ded9f648809b095db5bd7dbc4b9',   // Galaxian sound tests
  'fb08490c676fab3a34b3aec711001b03b14071ad824ff206f47d3e2af6e4dca4',   // Super Mario World Opening Melody
  'fb995e843b93e8a7489980415373ef06f17561e1fe69ceb3bb5c0940e8fd5fdb',   // Toki
  'fbd34cf9b1ae01b8960334a8251905fd65306a15cb60d7584be31321ae76a633',   // Dark Tower
  'fdc58a2632cd6a0b3a2de74f2f379afcb3458afef25dc1031e0650e0b8e641a2',   // Mario Bros test programs
  'fe5824bda1b3b621e56ce42400faf83b48fdf07b7ebad5b02597f4f0d20e5446',   // Crystal Worlds 7800 test - audio_pokey450
  'feb189054a71e4fd731ea6a7c6c899f25550ec89fc6f074c8fe7028bf688e6bb',   // Ghosts'n Goblins
  'ff4ac4c5c0215ed743edef8be531e0c3a6920c92cbd5a4f69f24350a89831237',   // Pac-Land Break Time Tune
]);

/* The Lynx (19 Nov 2026, ATARI-D98): every file follows the start-up firmware order, the player's own
   boot program first. The five files once kept on this site's (they played only because its old boot
   program left the machine otherwise than the console's) follow the original like every other file. */

const shaOf = r => String((r && r.game && r.game.sha256) || '').toLowerCase();
let crcTable = null;
function crc32(b) {
  if (!crcTable) {
    crcTable = new Uint32Array(256);
    for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; crcTable[n] = c >>> 0; }
  }
  let c = 0xffffffff;
  for (let i = 0; i < b.length; i++) c = crcTable[(c ^ b[i]) & 0xff] ^ (c >>> 8);
  return ((c ^ 0xffffffff) >>> 0).toString(16).padStart(8, '0');
}
const idOf = b => b.length + ':' + crc32(b);
const twoPort5200 = b => !!b && b.length === 32768 && TWO_PORT_5200.has(idOf(b));

export const manifest = {
  api: '1.0',
  id: SYS,
  label: LABEL[SYS],
  form: SYS === 'alynx' ? 'handheld' : 'console',
  build: `play/${DIR[SYS]}/CORE-VERSION.json`,
  thread: 'worker',          // 2026-10-22: off the page's main thread (Lynx phone-class 48 -> 58 fps); ?thread=main for the A/B
  files: {
    game: {
      exts: { a2600: ['.a26', '.bin'], a5200: ['.a52', '.bin', '.car'], a7800: ['.a78', '.bin'], alynx: ['.lnx', '.lyx', '.o'] }[SYS],
      maxBytes: { a2600: 512 * 1024, a5200: 512 * 1024 + 16, a7800: 1024 * 1024 + 128, alynx: 2 * 1024 * 1024 + 64 }[SYS],
    },
    /* Console firmware is optional on every Atari: our own ships in each core. The player's own
       is used whenever it is there, unless the viewer turns it off (Settings, Machine; THE
       CONSOLE'S OWN FIRMWARE FIRST above), and it is chosen by
       identity upstream: the site hands its images in its own order (the content pack, the
       built set, then the game server's DEFAULT first, cws.js L18) and the first of the right
       size is taken, as play/atari5200/app.js does. */
    firmware: {
      a5200: [{ id: 'bios', label: 'Atari 5200 BIOS', bytes: 2048, required: 'never' }],
      a7800: [{ id: 'bios', label: 'Atari 7800 BIOS', bytes: 4096, required: 'never' },
        /* The High Score Cartridge's program, which the XM module carries (THE XM MODULE'S HIGH-SCORE
           MEMORY below): the player's own, from a game server (role highscore), asked for only by a game
           whose header wants the XM. */
        { id: 'hsc', label: 'High Score Cartridge program', bytes: 4096, required: 'never' }],
      /* The Lynx's own 512-byte boot program (game server role boot; 1 Nov 2026). */
      alynx: [{ id: 'bios', label: 'Atari Lynx boot program', bytes: 512, required: 'never' }],
      a2600: KV_IDS.map((id, i) => ({ id, label: `Kid Vid tape audio (${KV_NAMES[i]})`, required: 'never', cassette: true })).concat([   // the Cassettes row (host.mjs cassetteRows)
        /* THE SUPERCHARGER'S TAPE: the firmware follows the tape's choice; the tape is chosen per game
           and is off unless chosen (perGame, defaultChoice; host.mjs fwPer, fwChoiceOf). */
        { id: 'arfw', label: 'Supercharger firmware (NTSC)', bytes: 2048, required: 'never', cassette: true, follows: 'artape' },
        { id: 'arfwpal', label: 'Supercharger firmware (PAL)', bytes: 2048, required: 'never', cassette: true, follows: 'artape' },
        { id: 'artape', label: 'Supercharger tape', required: 'never', cassette: true, perGame: true, defaultChoice: 'none',
          rowLabels: { title: 'Supercharger tape', auto: 'The tape on the cassette shelf', none: 'The game file (as usual)',
            user: 'Your tape from this device', file: 'Choose a tape recording (.wav) from this device…' } },
      ]),
    }[SYS] || [],
  },
  /* The 2600 asks for the Kid Vid's tape audio only for the two Kid Vid cartridges, and only
     from a core that plays it (see THE KID VID'S NARRATION below); no other game asks for any. */
  firmwareFor: SYS === 'a2600' ? (bytes => {
    const out = [];
    const g = kvCapable === false ? 0 : kvGame(bytes);
    if (g) KV_FOR[g].forEach(i => out.push(KV_IDS[i]));
    if (arCapable !== false && arImage(bytes)) out.push(...AR_IDS);   // the Supercharger's tape, offered (never the default)
    return out;
  }) : SYS === 'a7800' ? (bytes => (xmHeader(bytes) ? ['bios', 'hsc'] : ['bios'])) : undefined,
  /* FW1 (2026-10-22): the role of console firmware this game needs from the game server.
     A PAL 7800 cartridge (its A78 header's TV byte, as the core reads it: cart7800.c data[57] & 1)
     asks for the PAL BIOS; every other game for the usual one. A 5200 game made for the two-port
     console (TWO_PORT_5200 below) asks for that console's firmware. */
  firmwareRole: SYS === 'a7800' ? ((bytes, id) => id === 'hsc' ? 'highscore' : (id === 'bios' && bytes && region7800(bytes) === 1) ? 'boot-pal' : 'boot')
    : SYS === 'a5200' ? ((bytes, id) => (id === 'bios' && twoPort5200(bytes)) ? 'boot-2port' : 'boot') : undefined,
  video: {
    kind: 'raster',
    maxWidth: { a2600: 320, a5200: 336, a7800: 320, alynx: 160 * 2 + 16 }[SYS],   // the Lynx: two linked screens (LYNX_GAP)
    maxHeight: { a2600: 274, a5200: 240, a7800: 293, alynx: 160 }[SYS],
    screens: 1,
  },
  audio: { channels: SYS === 'alynx' ? 2 : 1, format: 'f32', filtered: false },
  state: { supported: true, deterministic: true, approxBytes: STATE_BYTES[SYS] },
  extensions: SYS === 'alynx' ? ['options', 'rotation'] : ['options'],
  /* Rewind: the host's (play/host/rewind-ring.mjs takes these big states; moved there from
     this folder on 2026-10-14 by the host, the three-part rule). */
  /* Where the old pages kept things, read in place (decision P5). The Control Bar adapter's
     slots: IndexedDB 'atari-saves' / 'slots', key '<sys>:<slot id>', each state gzipped. */
  legacy: {
    db: 'atari-saves', version: 1, store: 'slots',
    slotsKey: game => `${SYS}:${game}`,
    decodeSlot: rec => gunzipRec(rec),
    /* The Lynx's cartridge EEPROM, which its old page kept in localStorage per cartridge. */
    batteryLocal: SYS === 'alynx' ? { key: (game, hash12) => (hash12 ? 'atarilynx:eeprom:' + hash12 : null) } : null,
  },
  modelLabel: md => (md === 'alynx-link' ? 'two Atari Lynx consoles on one cable' : LABEL[SYS]),
};

async function gunzipRec(s) {
  if (!s) return null;
  if (s instanceof Uint8Array || s instanceof ArrayBuffer) return new Uint8Array(s);
  if (s.raw) return new Uint8Array(s.raw);
  if (!s.gz || typeof DecompressionStream !== 'function') return null;
  const st = new Blob([s.gz]).stream().pipeThrough(new DecompressionStream('gzip'));
  return new Uint8Array(await new Response(st).arrayBuffer());
}

/* ------------------------------------------------------------------ controls */
const btn = (id, label, keys, pad) => ({ id, label, type: 'button', defaults: { key: keys || [], pad: pad || [] } });
const P1 = { up: ['ArrowUp'], down: ['ArrowDown'], left: ['ArrowLeft'], right: ['ArrowRight'] };
const P2 = { up: ['KeyW'], down: ['KeyS'], left: ['KeyA'], right: ['KeyD'] };
const LYNX_GAP = 16;           // the two linked Lynx screens, side by side, this far apart
const LYNX_LINK_MAGIC = 0x324B4E4C;   // 'LNK2': a save state of two linked Lynx consoles
const LYNX_LINK_NOTE = "Two Lynxes on one cable. Player 2 uses a second controller, or I J K L with G (A), F (B), T (Pause), 7 (Option 1) and 8 (Option 2). Pick the game's link or multi-player mode on both consoles, as its instructions say.";
const LYNX_P2 = { up: ['KeyI'], down: ['KeyK'], left: ['KeyJ'], right: ['KeyL'] };   // the second Lynx (TWO LYNXES ON ONE CABLE)
const dirs = (K, pad) => [btn('up', 'Up', K.up, pad && ['Up']), btn('down', 'Down', K.down, pad && ['Down']),
  btn('left', 'Left', K.left, pad && ['Left']), btn('right', 'Right', K.right, pad && ['Right'])];
const KEYPAD_LABELS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '*', '0', '#'];
const KEYPAD_DIGITS = ['Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5', 'Digit6', 'Digit7', 'Digit8', 'Digit9', 'Minus', 'Digit0', 'Equal'];
const KEYPAD_NUMPAD = ['Numpad1', 'Numpad2', 'Numpad3', 'Numpad4', 'Numpad5', 'Numpad6', 'Numpad7', 'Numpad8', 'Numpad9', 'NumpadMultiply', 'Numpad0', 'NumpadAdd'];
function keypadControls(prefix, keysets) {
  return KEYPAD_LABELS.map((l, i) => btn(prefix + i, 'Keypad ' + l, keysets.map(s => s[i]).filter(Boolean)));
}
/* Fire keys per player, as the old pages read them. */
const FIRE_2600 = [['Space', 'Enter', 'KeyZ'], ['KeyQ']];

/* The device a port carries, by the controls it exposes. `who` 0 = player 1's keys, 1 = player 2's. */
function portDevice(kind, who, opts = {}) {
  const K = who ? P2 : P1, fire = opts.fire || FIRE_2600[who], pad = !who || opts.pad2;
  switch (kind) {
    case 'paddles': {
      // Two paddles on one port: the first turned by this player's Left / Right, the
      // second by player 2's (only when the other port is not using those keys).
      const c = [btn('pa-ccw', 'Paddle A left', K.left, ['Left']), btn('pa-cw', 'Paddle A right', K.right, ['Right']),
        btn('pa-fire', 'Paddle A button', fire, ['A', 'B'])];
      // The left port's first paddle also follows the mouse or a finger across the picture
      // (the host's pointer device): left edge fully anticlockwise, right edge clockwise.
      if (!who) c.push({ id: 'pa-pointer', label: 'Paddle A (mouse or touch)', type: 'pointer', defaults: {} });
      if (opts.second) c.push(btn('pb-ccw', 'Paddle B left', opts.second.left), btn('pb-cw', 'Paddle B right', opts.second.right),
        btn('pb-fire', 'Paddle B button', opts.second.fire));
      return c;
    }
    case 'driving':
      return [btn('left', 'Turn left', K.left, pad && ['Left']), btn('right', 'Turn right', K.right, pad && ['Right']), btn('fire', 'Fire', fire, pad && ['A', 'B'])];
    case 'keypad':
      return keypadControls('k', opts.keysets || [KEYPAD_DIGITS, KEYPAD_NUMPAD]);
    default:
      return dirs(K, pad).concat(opts.buttons || [btn('fire', 'Fire', fire, pad && ['A', 'B', 'X', 'Y'])]);
  }
}
/* THE LIGHT GUN (2600 and 7800). Aimed like the NES Zapper: the mouse or a finger over the picture
   (a press aims and pulls the trigger), or the aim keys and a trigger key. `who` 0 = the left
   port's keys (the arrows, X), 1 = the right port's (W A S D, F). */
function gunControls(who) {
  const K = who ? P2 : P1;
  return [btn('trigger', 'Trigger', who ? ['KeyF'] : ['KeyX', 'Space'], ['A', 'B']),
    btn('aim-up', 'Aim up', K.up, ['Up']), btn('aim-down', 'Aim down', K.down, ['Down']),
    btn('aim-left', 'Aim left', K.left, ['Left']), btn('aim-right', 'Aim right', K.right, ['Right']),
    { id: 'aim', label: 'Aim and fire (point at the picture)', type: 'pointer', defaults: {} }];
}
/* THE 7800'S SUPER NES PAD through the SNES2Atari adaptor (a7800_set_snes; the cartridge header's
   controller code 11, or Settings). The pad's twelve buttons in the core's bit order: 1 B, 2 Y,
   4 Select, 8 Start, 16 up, 32 down, 64 left, 128 right, 256 A, 512 X, 1024 L, 2048 R. A gamepad's
   printed A and B reach the pad's B and A by position (bottom and right, as on a Super NES pad), and
   its Start and Select reach the pad's own (alias: the 7800's Reset and Select stay on F1 and F2). */
const SNES_BITS = [['up', 16], ['down', 32], ['left', 64], ['right', 128], ['snes-b', 1], ['snes-a', 256], ['snes-y', 2], ['snes-x', 512],
  ['snes-l', 1024], ['snes-r', 2048], ['select', 4], ['start', 8]];
function snesControls(who) {
  const K = who ? P2 : P1, k = who ? ['KeyF', 'KeyG', 'KeyR', 'KeyT', 'KeyH', 'KeyJ', 'KeyN', 'KeyM'] : ['KeyZ', 'KeyX', 'KeyC', 'KeyV', 'KeyQ', 'KeyE', 'ShiftRight', 'Space'];
  const c = dirs(K, true).concat([btn('snes-b', 'B', [k[0]], ['A']), btn('snes-a', 'A', [k[1]], ['B']), btn('snes-y', 'Y', [k[2]], ['X']), btn('snes-x', 'X', [k[3]], ['Y']),
    btn('snes-l', 'L', [k[4]], ['LB']), btn('snes-r', 'R', [k[5]], ['RB']), btn('select', 'Select', [k[6]], ['Select']), btn('start', 'Start', [k[7]], ['Start'])]);
  if (!who) { c[c.length - 2].defaults.alias = ['F2']; c[c.length - 1].defaults.alias = ['Enter']; }
  return c;
}
/* THE 2600'S OTHER CONTROLLERS (atari_set_controller types; the joystick's bits 32 and 64 are the
   buttons on pins 5 and 9). */
const T2600 = { joystick: 0, paddles: 1, driving: 2, keypad: 3, booster: 5, genesis: 6, joy2b: 7, trakball: 8, stmouse: 9,
  amigamouse: 10, savekey: 11, lightgun: 13, mindlink: 14, quadtari: 15 };
const POINTING_2600 = new Set(['trakball', 'stmouse', 'amigamouse']);
const POINTING_OPTS_2600 = [{ v: 'trakball', label: 'Trak-Ball' }, { v: 'stmouse', label: 'Atari mouse' }, { v: 'amigamouse', label: 'Amiga mouse' }];
const EXTRA_KINDS_2600 = [
  { v: 'genesis', label: 'Sega Genesis pad', needs: 'atari_set_controller' },
  { v: 'booster', label: 'CBS Booster Grip', needs: 'atari_set_controller' },
  { v: 'joy2b', label: 'Joy 2B+', needs: 'atari_set_controller' },
  { v: 'trakball', label: 'Trak-Ball', needs: 'atari_move_pointer' },
  { v: 'stmouse', label: 'Atari mouse', needs: 'atari_move_pointer' },
  { v: 'amigamouse', label: 'Amiga mouse', needs: 'atari_move_pointer' },
  { v: 'lightgun', label: 'Light gun', needs: 'atari_set_lightgun' },
  { v: 'mindlink', label: 'MindLink', needs: 'atari_set_mindlink' },   // shown again 19 Nov (ATARI-D95: the core equals Stella; each game now gets it on the port it reads)
  { v: 'quadtari', label: 'QuadTari (two joysticks)', needs: 'atari_set_controller' }];
/* The 2600 has no header to name its controller: these games are known by identity (the first 12
   hex digits of the file's SHA-256), the library's files whose own instructions name the device.
   "As the game wants" plugs it in; the viewer can choose another. */
const GAME_CTRL_2600 = {
  'b8c649ec20e9': ['lightgun'],     // Sentinel
  '7ba010fded9d': ['lightgun'],     // Shooting Arcade (prototype)
  '75f33d6ce81d': ['lightgun'],     // Shooting Arcade (prototype, PAL)
  '9ea4361fac5c': ['lightgun'],     // Shooting Arcade (an earlier prototype), and the prototypes' other screens:
  'c47b31ee0337': ['lightgun'], '5366523c5234': ['lightgun'], '96bcbfa41b1e': ['lightgun'], 'f132d47a658f': ['lightgun'], 'e063087c6787': ['lightgun'],
  'bff49aa4c6b4': ['lightgun'], 'ceefa35ca872': ['lightgun'], 'c185dd85dab5': ['lightgun'], 'b85bd0103a0d': ['lightgun'], 'e1c7e691972b': ['lightgun'],
  '03421b617b27': ['booster'],      // Omega Race (Booster Grip)
  '56e312df61ac': ['booster'],      // Omega Race (prototype)
  /* The MindLink on the port each game reads (ATARI-D95, 19 Nov 2026, each checked against Stella): Bionic
     Breakthrough the left, its 06-22-1984 prototype the right; Telepathy the right, with a joystick on the left
     whose fire starts it. Mind Maze reads a joystick, not the MindLink, so it is not listed. */
  'cc2761a74d6a': ['mindlink'],                 // Bionic Breakthrough
  '01720a56ff5a': ['joystick', 'mindlink'],     // Bionic Breakthrough (an earlier prototype, 06-22-1984)
  'afcca1af5b8c': ['joystick', 'mindlink'],     // Telepathy
};
function extraButtons2600(kind, who) {
  const fire = FIRE_2600[who];
  if (kind === 'genesis') return [btn('fire', 'Button B (fire)', fire, ['A', 'X']), btn('b5', 'Button C', who ? ['KeyE'] : ['KeyX'], ['B', 'Y'])];
  if (kind === 'booster') return [btn('fire', 'Fire (stick button)', fire, ['A']), btn('b9', 'Trigger', who ? ['KeyE'] : ['KeyX'], ['B']),
    btn('b5', 'Booster', who ? ['KeyR'] : ['KeyC'], ['X', 'Y'])];
  if (kind === 'joy2b') return [btn('fire', 'Button 1', fire, ['A']), btn('b5', 'Button 2', who ? ['KeyE'] : ['KeyX'], ['B']),
    btn('b9', 'Button 3', who ? ['KeyR'] : ['KeyC'], ['X', 'Y'])];
  return null;
}
const bitOf = (port, id) => port.controls.findIndex(c => c.id === id);
const held = (port, s, id) => { const i = bitOf(port, id); return i >= 0 && !!(s.buttons & (1 << i)); };

/* ------------------------------------------------------------------ palettes */
const abgr = c => (0xFF000000 | ((c & 0xFF) << 16) | (c & 0xFF00) | ((c >> 16) & 0xFF)) >>> 0;
const palOf = arr => { const p = new Uint32Array(256); for (let i = 0; i < 256; i++) p[i] = abgr(arr[i] | 0); return p; };
let lynxPal = null;
function lynxPalette() {
  if (lynxPal) return lynxPal;
  lynxPal = new Uint32Array(4096);
  for (let c = 0; c < 4096; c++) {
    const r = (c & 15) * 17, g = ((c >> 8) & 15) * 17, b = ((c >> 4) & 15) * 17;
    lynxPal[c] = (0xFF000000 | (b << 16) | (g << 8) | r) >>> 0;
  }
  return lynxPal;
}

/* ------------------------------------------------------------------ the factory */
export async function create(env) {
  const base = new URL(`../../${DIR[SYS]}/`, import.meta.url);
  const W = await import(new URL('web/core.js', base).href + '?v=' + WRAP_V);
  let stamp = null;
  try { const s = await fetch(new URL('CORE-VERSION.json', base), { cache: 'no-store' }); if (s.ok) stamp = await s.json(); } catch (_) {}
  const wasmUrl = new URL(WASM[SYS], base).href + '?v=' + (stamp && stamp.sha256 ? stamp.sha256.slice(0, 12) : 'dev');
  const ball = { on: false, dx: 0, dy: 0, b: 0, lb: 0 };   // the 5200 Trak-ball (ext.trackball)
  const P = { a2600: null, a7800: null, a5200: null };
  if (SYS === 'a2600') P.a2600 = await import(new URL('web/palette.js?v=2.3.0', base).href);
  if (SYS === 'a7800') { P.a7800 = await import(new URL('web/palette7800.js?v=2.3.0', base).href); P.a2600 = await import(new URL('../atari2600/web/palette.js?v=2.3.0', base).href); }
  if (SYS === 'a5200') P.a5200 = await import(new URL('web/palette5200.js', base).href);   // the 5200's own colours (18 Nov 2026)

  /* A fresh instance per cartridge, as the old pages: atari_create() grows wasm memory and
     never gives it back. One spare is made ahead, so load() (synchronous) never waits. */
  const instantiate = () => W.instantiate(wasmUrl);
  let spare = await instantiate();
  if (SYS === 'a2600') kvCapable = typeof spare.X.atari_kidvid_set_tapes === 'function' && typeof spare.X.atari_kidvid_speech === 'function';
  if (SYS === 'a2600') arCapable = typeof spare.X.atari_set_supercharger_tape === 'function';
  let spareP = null;
  function takeInstance() {
    const c = spare; spare = null;
    if (!spareP) spareP = instantiate().then(x => { spare = x; spareP = null; }, () => { spareP = null; });
    return c;
  }

  const X = () => m.X;
  let m = null;                // the wrapper's Core for the cartridge loaded
  /* CHEATS (2026-10-26): memory codes only (no Atari data needs read patches), on a build
     with this console's write call. The native memory codes' addresses are read per console by
     CHEAT_RA (cheats-core.mjs raAddr). A fresh machine instance per cartridge or Reset gets them. */
  const CHEAT_POKE = { a2600: 'atari_poke_ram', a5200: 'a5200_poke', a7800: 'a7800_poke', alynx: 'lynx_poke' }[SYS];
  const CHEAT_PEEK = { a2600: 'atari_peek_ram', a5200: 'a5200_peek', a7800: 'a7800_peek', alynx: 'lynx_peek' }[SYS];
  const CHEAT_RA = { a2600: a => a, a5200: a => a, a7800: a => a, alynx: a => a }[SYS];
  let cheat = null;
  const cheatEng = () => {
    if (cheat || !m || !m.X || typeof m.X[CHEAT_POKE] !== 'function' || typeof m.X[CHEAT_PEEK] !== 'function') return cheat;
    cheat = cheatEngine({
      kinds: ['ra-mem'], token: () => m, slots: 0, setSlot() {}, clear() {},
      poke: (a, v) => m.X[CHEAT_POKE](m.ctx, a, v) === 0,
      peek: a => m.X[CHEAT_PEEK](m.ctx, a) & 0xff,
      raAddr: CHEAT_RA,
    });
    return cheat;
  };
  let req = null, region = 0, owed = 0, opts = {}, ports = [], inputs = [];
  let stateBuf = 0, stateSize = 0, jammed = false;
  let frame = null, frameDirty = true, frameW = 0, frameH = 0, framePal = null, frameFmt = 'index8';
  const audioParts = [];
  const sw = { bits: 0, lastConsole: 0 };
  const paddle = [32768, 32768, 32768, 32768];
  const wheel = [0, 0], wheelTick = [0, 0];
  const keypadSent = [0, 0];
  const snesSent = [0, 0];       // the 7800's Super NES pad: the buttons last handed the core (diag)
  let turn = 0;                // Lynx: 0 upright, 1 turned left, 2 turned right
  /* TWO LYNXES ON ONE CABLE (ComLynx; Settings, Machine, ComLynx cable). The second console is a second
     context in the same core instance (the wrapper's Core over the same exports, so the two share one
     memory, as lynx_link needs), with the same cartridge and boot program and its own cartridge EEPROM
     (battery 'eeprom2'). The core runs the pair in lockstep (lynx_link_run_frame); the sound is both
     consoles', mixed; a save state holds both (LYNX_LINK_MAGIC). Untouched with one console. */
  let m2 = null, eepromSeen2 = 0, p2Wait = 0;
  let firmwareUsed = null;
  let kv = null;               // the Kid Vid's tape audio for this cartridge: { files: [audio data by file] }
  let arTape = null;           // the Supercharger tape recording in, { bytes } (THE SUPERCHARGER'S TAPE)

  /* ---------------------------------------------------------------- option lists */
  function optionDefs() {
    const o = [];
    const toggle = (id, label, bit, states, def, help) => o.push({ id, label, help, type: 'enum', values: [{ v: '0', label: states[0] }, { v: '1', label: states[1] }],
      default: def, scope: 'console', live: true, group: 'machine', strip: bit });
    const ctl = (id, label, values, def) => o.push({ id, label, type: 'enum', values, default: def, scope: 'game', live: true, group: 'machine' });
    if (SYS === 'a2600') {
      /* The Atari 5200's VCS Cartridge Adapter is an Atari 2600 in a box (its own TIA, RIOT
         and 6507) that plugs into the 5200. It has no TV type switch, so the picture is always
         in colour, and the 5200 is an NTSC console (25 Oct 2026). */
      o.push({ id: 'console', label: 'Console', help: 'Applies when the game restarts. The VCS Cartridge Adapter has no TV type switch: the picture is always in colour, on NTSC.', type: 'enum',
        values: [{ v: '2600', label: 'Atari 2600' }, { v: '5200vcs', label: 'Atari 5200 with the VCS Cartridge Adapter' }],
        default: '2600', scope: 'console', live: false, group: 'machine' });
      toggle('diffL', 'Left difficulty', 64, ['B', 'A'], '0');
      toggle('diffR', 'Right difficulty', 128, ['B', 'A'], '0');
      if (opts.console !== '5200vcs') toggle('colour', 'TV type', 8, ['B&W', 'Colour'], '1');   // the adapter has no TV type switch
      const kinds = [{ v: 'joystick', label: 'Joystick' }, { v: 'paddles', label: 'Paddles' }, { v: 'driving', label: 'Driving controller' }, { v: 'keypad', label: 'Keypad' }]
        .concat(EXTRA_KINDS_2600.filter(k => !k.hidden && (!m || typeof m.X[k.needs] === 'function')));
      const auto = [{ v: 'auto', label: 'As the game wants' }];
      ctl('ctrlL', 'Left controller', auto.concat(kinds), 'auto');
      ctl('ctrlR', 'Right controller', auto.concat(kinds, [{ v: 'savekey', label: 'SaveKey' }]), 'auto');
      o.push({ id: 'region', label: 'Television', help: 'Applies when the game restarts.', type: 'enum',
        values: [{ v: '0', label: 'NTSC (60 Hz)' }, { v: '1', label: 'PAL (50 Hz)' }, { v: '2', label: 'SECAM' }],
        default: '0', scope: 'game', live: false, group: 'machine' });
    } else if (SYS === 'a7800') {
      toggle('diffL', 'Left difficulty', 64, ['B', 'A'], '0');
      toggle('diffR', 'Right difficulty', 128, ['B', 'A'], '0');
      const kinds = [{ v: 'auto', label: 'As the cartridge says' }, { v: 'proline', label: 'ProLine joystick' }, { v: 'paddles', label: 'Paddles' },
        { v: 'driving', label: 'Driving controller' }, { v: 'keypad', label: 'Keypad' }]
        .concat(!m || typeof m.X.a7800_set_lightgun === 'function' ? [{ v: 'lightgun', label: 'Light gun (XG-1)' }] : [])
        .concat(!m || typeof m.X.a7800_set_snes === 'function' ? [{ v: 'snes', label: 'Super NES pad (SNES2Atari)' }] : []);
      ctl('ctrlL', 'Left controller', kinds, 'auto');
      ctl('ctrlR', 'Right controller', kinds.concat([{ v: 'savekey', label: 'SaveKey' }]), 'auto');
      o.push({ id: 'bios', label: 'Console BIOS', help: 'Applies when the game restarts. Your own BIOS is used when a game server or content pack has it; without it the cartridge starts directly.', type: 'enum',
        values: [{ v: '0', label: 'None (starts the cartridge directly)' }, { v: '1', label: 'Your own BIOS, when you have it' }], default: '1',
        scope: 'console', live: false, group: 'machine', key: 'atari7800:useOwnerBios' });
    } else if (SYS === 'a5200') {
      o.push({ id: 'bios', label: 'Console firmware', help: "Applies when the game restarts. Your own firmware is used when a game server or content pack has it; without it, this site's.", type: 'enum',
        values: [{ v: '0', label: "This site's" }, { v: '1', label: 'Your own, when you have it' }], default: '1',
        scope: 'console', live: false, group: 'machine', key: 'atari5200:useOwnerFirmware' });
    } else if (SYS === 'alynx') {
      o.push({ id: 'bios', label: 'Console boot program', help: "Applies when the game restarts. Your own boot program is used when a game server or content pack has it; without it, this site's.", type: 'enum',
        values: [{ v: '0', label: "This site's" }, { v: '1', label: 'Your own, when you have it' }], default: '1',
        scope: 'console', live: false, group: 'machine', key: 'atarilynx:useOwnerBoot' });
      o.push({ id: 'turn', label: 'Screen turn', type: 'enum',
        values: [{ v: 'auto', label: 'As the cartridge says' }, { v: '0', label: 'Upright' }, { v: '1', label: 'Turned left' }, { v: '2', label: 'Turned right' }],
        default: 'auto', scope: 'game', live: true, group: 'display', key: 'atarilynx:turn:{hash12}' });
      if (!m || lynxLinkable(m)) o.push({ id: 'link', label: 'ComLynx cable', type: 'enum',
        help: 'Applies when the game restarts. Two Lynxes play side by side on one cable, for the games made for two or more players. Player 2 uses a second controller, or the keys shown in Keys.',
        values: [{ v: '1', label: 'One Lynx' }, { v: '2', label: 'Two Lynxes on one cable' }], default: '1', scope: 'game', live: false, group: 'machine' });
    }
    return o;
  }
  const defOf = id => optionDefs().find(d => d.id === id);

  /* ---------------------------------------------------------------- ports per title */
  /* A SaveKey game with a listed two-player mode (TWO-PLAYER SAVEKEY GAMES above). */
  const skTwoPlayer = () => !!(req && req.game && req.game.sha256 && SK_TWO_PLAYER[String(req.game.sha256).slice(0, 12)]);
  function kindOf2600(v, port) {
    if (port === 1 && (v === 'savekey' || ((v || 'auto') === 'auto' && sk2600 && !skTwoPlayer()))) return typeof m.X.atari_eeprom === 'function' ? 'savekey' : 'joystick';
    if ((v || 'auto') === 'auto') {
      const g = GAME_CTRL_2600[String((req && req.game && req.game.sha256) || '').slice(0, 12)];
      v = g ? g[port] : 'joystick';
    }
    const x = EXTRA_KINDS_2600.find(k => k.v === v);
    if (x) return !x.hidden && typeof m.X[x.needs] === 'function' ? v : 'joystick';
    return ['joystick', 'paddles', 'driving', 'keypad'].includes(v) ? v : 'joystick';
  }
  const CTRL7800 = () => W.CTRL || {};
  /* The 7800's right port: a SaveKey (THE SAVEKEY above) when the viewer chose it, or on "As the
     cartridge says" when the header asks for one. */
  function sk7800Wanted(v) {
    if (typeof m.X.a7800_eeprom !== 'function') return false;
    if (v === 'savekey') return true;
    if (v !== 'auto' || (m.inTwoSixHundredMode && m.inTwoSixHundredMode())) return false;
    const b56 = m.headerByte(56), b58 = m.headerByte(58);
    if (b56 === 1 && skTwoPlayer()) return false;   // a two-player game: player 2's joystick
    return b56 === 10 || (b58 >= 0 && (b58 & 2) === 2 && (b56 === 0 || b56 === 1));
  }
  /* True when the right port holds the joystick only because of the two-player rule: the game
     would otherwise get the SaveKey, and the viewer has not chosen. The play window's one-time
     notice then says how to plug the SaveKey in. */
  function skTwoPlayerApplied() {
    if (!m || !skTwoPlayer() || ((opts.ctrlR || 'auto') !== 'auto') || !ports[1] || ports[1].kindName === 'savekey') return false;
    if (SYS === 'a2600') return sk2600 && typeof m.X.atari_eeprom === 'function';
    if (SYS !== 'a7800' || typeof m.X.a7800_eeprom !== 'function' || (m.inTwoSixHundredMode && m.inTwoSixHundredMode())) return false;
    const b58 = m.headerByte(58);
    return m.headerByte(56) === 1 && b58 >= 0 && (b58 & 2) === 2;
  }
  function kind7800(port, chosen) {
    const v = chosen !== undefined ? chosen : opts['ctrl' + (port ? 'R' : 'L')];
    if (port === 1 && sk7800Wanted(v || 'auto')) return 'savekey';
    const gunOk = typeof m.X.a7800_set_lightgun === 'function', snesOk = typeof m.X.a7800_set_snes === 'function';
    if (v === 'lightgun') return gunOk ? 'lightgun' : 'proline';
    if (v === 'snes') return snesOk ? 'snes' : 'proline';
    if (v && v !== 'auto' && v !== 'savekey') return v;
    const t = m.headerController(port), C = CTRL7800();
    if (m.inTwoSixHundredMode && m.inTwoSixHundredMode()) return 'proline';
    if (t === C.LIGHTGUN && gunOk) return 'lightgun';
    if (t === C.SNES && snesOk) return 'snes';   // header code 11: the SNES2Atari adaptor
    if (t === C.PADDLES) return 'paddles';
    if (t === C.DRIVING) return 'driving';
    if (t === C.KEYPAD) return 'keypad';
    return 'proline';
  }
  function buildPorts() {
    const out = [];
    if (SYS === 'a2600' || SYS === 'a7800') {
      const kL = SYS === 'a2600' ? kindOf2600(opts.ctrlL, 0) : kind7800(0);
      const kR = SYS === 'a2600' ? kindOf2600(opts.ctrlR, 1) : kind7800(1);
      const joyButtons7800 = who => who
        ? [btn('b1', 'Button B (left)', ['KeyF'], ['A', 'X']), btn('b2', 'Button A (right)', ['KeyG'], ['B', 'Y'])]
        : [btn('b1', 'Button B (left)', ['KeyZ'], ['A', 'X']), btn('b2', 'Button A (right)', ['KeyX'], ['B', 'Y']), btn('both', 'Both buttons', ['Space'])];
      const dev = (k, who) => {
        if (k === 'savekey') return { device: SYS + '-savekey', controls: [] };   // a memory: nothing to press
        if (k === 'proline' || k === 'joystick') {
          return { device: SYS + '-joystick', controls: SYS === 'a7800' ? dirs(who ? P2 : P1, true).concat(joyButtons7800(who)) : portDevice('joystick', who) };
        }
        if (k === 'paddles') {
          const second = who === 0 && kR !== 'joystick' && kR !== 'proline' && kR !== 'savekey' ? null : (who === 0 ? { left: P2.left, right: P2.right, fire: FIRE_2600[1] } : null);
          return { device: SYS + '-paddles', controls: portDevice('paddles', who, { second }) };
        }
        if (k === 'keypad') {
          const sets = who === 0 ? [KEYPAD_DIGITS, kR === 'keypad' ? null : KEYPAD_NUMPAD].filter(Boolean) : (kL === 'keypad' ? [KEYPAD_NUMPAD] : [KEYPAD_DIGITS, KEYPAD_NUMPAD]);
          return { device: SYS + '-keypad', controls: portDevice('keypad', who, { keysets: sets }) };
        }
        if (k === 'lightgun') return { device: SYS + '-lightgun', label: 'Light gun', controls: gunControls(who) };
        if (k === 'snes') return { device: SYS + '-snes', label: 'Super NES pad', controls: snesControls(who) };
        const extra = SYS === 'a2600' ? extraButtons2600(k, who) : null;
        if (extra) return { device: SYS + '-' + k, controls: dirs(who ? P2 : P1, true).concat(extra) };
        if (SYS === 'a2600' && POINTING_2600.has(k)) {
          // Moved by the mouse or a finger over the picture (its motion, not where it is), or by the
          // direction keys; the button is the fire button (a press on the picture presses it too).
          return { device: SYS + '-' + k, controls: dirs(who ? P2 : P1, true).concat([btn('fire', 'Button', FIRE_2600[who], ['A', 'B']),
            { id: 'move', label: 'Move (the mouse or a finger over the picture)', type: 'pointer', defaults: {} }]) };
        }
        if (k === 'mindlink') {
          // The headband's position: turned by held keys or the left stick, or set by the mouse or a
          // finger across the picture (left edge to right edge), as the paddles.
          return { device: SYS + '-mindlink', controls: [btn('ml-less', 'Lower', (who ? P2 : P1).left, ['Left']), btn('ml-more', 'Higher', (who ? P2 : P1).right, ['Right']),
            btn('ml-button', 'Start (the headband’s button)', FIRE_2600[who], ['A', 'B']),
            { id: 'ml-pointer', label: 'Position (the mouse or a finger across the picture)', type: 'pointer', defaults: {} }] };
        }
        if (k === 'quadtari') return { device: SYS + '-quadtari', label: 'QuadTari, first joystick', controls: portDevice('joystick', who) };
        return { device: SYS + '-driving', controls: portDevice('driving', who) };
      };
      const L = dev(kL, 0), R = dev(kR, 1);
      // One port takes the pointer: a pointer device on the right keeps it from left paddles.
      if (kL === 'paddles' && R.controls.some(c => c.type === 'pointer')) L.controls = L.controls.filter(c => c.type !== 'pointer');
      // Left paddles take player 2's Left / Right for their second paddle: the right port's
      // device then gets no keys of its own (a paddle title does not use it).
      if (kL === 'paddles' && (kR === 'joystick' || kR === 'proline')) R.controls = R.controls.map(c => Object.assign({}, c, { defaults: { key: [], pad: [] } }));
      // Paddles and the driving controller are analogue: the pad's left stick turns them in proportion
      // (its x axis, read by the host as for the 5200), never as D-pad presses (2026-10-17).
      const an = k => (k === 'paddles' || k === 'driving' || k === 'mindlink') ? { axes: [0] } : {};
      out.push(Object.assign({ port: 0, kind: 'player', device: L.device, kindName: kL, controls: L.controls }, an(kL)));
      out.push(Object.assign({ port: 1, kind: 'player', device: R.device, kindName: kR, controls: R.controls }, an(kR)));
      if (L.label) out[0].label = L.label;
      if (R.label) out[1].label = R.label;
      /* A Trak-Ball or mouse asks the host to hold the pointer (a double click on the picture; Escape gives it back). */
      if (SYS === 'a2600') [kL, kR].forEach((k, side) => { const o = POINTING_OPTS_2600.find(x => x.v === k); if (o) out[side].pointerLock = o.label; });
      /* A QuadTari's second joysticks (the core's ports 2 and 3), next after the two ports so that a
         third and fourth pad reach them; no keys of their own, like a Four Score's players 3 and 4. */
      [kL, kR].forEach((k, side) => {
        if (k !== 'quadtari') return;
        const c = portDevice('joystick', 0).map(x => Object.assign({}, x, { defaults: { key: [], pad: x.defaults.pad } }));
        out.push({ port: out.length, kind: 'player', device: SYS + '-quadtari', kindName: 'quad-b', quad: side + 2,
          label: 'QuadTari, second joystick (' + (side ? 'right' : 'left') + ' port)', controls: c });
      });
      out.push({ port: out.length, kind: 'console', device: SYS + '-switches', controls: SYS === 'a2600'
        ? [Object.assign(btn('reset', 'Game Reset', ['F1'], ['Start']), { short: 'Reset' }), Object.assign(btn('select', 'Game Select', ['F2'], ['Select']), { short: 'Select' })]   // short: the bar's name when it is short of room
        : [btn('reset', 'Reset', ['Enter', 'F1'], ['Start']), btn('select', 'Select', ['F2'], ['Select']), btn('pause', 'Pause', ['F3'], ['RB']),
           Object.assign(btn('diffLToggle', 'Left difficulty (switch)', ['F4']), { type: 'toggle' })] });
    } else if (SYS === 'a5200') {
      const stick = who => dirs(who ? P2 : P1, true).concat([
        btn('lower', 'Lower fire', who ? ['KeyG'] : ['KeyZ', 'Space'], ['A', 'X']),
        btn('upper', 'Upper fire', who ? ['KeyH'] : ['KeyX'], ['B', 'Y'])]);
      out.push({ port: 0, kind: 'player', device: 'a5200-controller', controls: stick(0).concat(keypadControls('k', [KEYPAD_DIGITS, KEYPAD_NUMPAD])), axes: [0, 1] });
      out.push({ port: 1, kind: 'player', device: 'a5200-controller', controls: stick(1), axes: [0, 1] });
      out.push({ port: 2, kind: 'console', device: 'a5200-keys', controls: [btn('start', 'Start', ['Enter', 'NumpadEnter'], ['Start']),
        btn('pause', 'Pause', ['F3'], ['Select']), btn('reset', 'Reset', ['F1'], ['LB'])] });
    } else {
      out.push(Object.assign({ port: 0, kind: 'player', device: 'lynx-pad', controls: dirs(P1, true).concat([
        btn('a', 'A', ['KeyX', 'Space'], ['A', 'X']), btn('b', 'B', ['KeyZ'], ['B', 'Y'])   /* printed A = the Lynx's A (decided 2026-10-16; play-pad.js alynx) */]) }, m2 ? { label: 'Player 1' } : {}));
      /* TWO LYNXES ON ONE CABLE: player 2's console, next after player 1's so that a second pad
         reaches it (input.mjs padFeed, by the controls' names); the other half of the keyboard. */
      if (m2) out.push({ port: 1, kind: 'player', device: 'lynx-pad', label: 'Player 2 (second Lynx)', controls: dirs(LYNX_P2, true).concat([
        btn('a', 'A', ['KeyG'], ['A', 'X']), btn('b', 'B', ['KeyF'], ['B', 'Y']), btn('opt1', 'Option 1', ['Digit7'], ['LB']),
        btn('pause', 'Pause', ['KeyT'], ['Start']), btn('opt2', 'Option 2', ['Digit8'], ['RB'])]) });
      out.push({ port: out.length, kind: 'console', device: 'lynx-keys', controls: [Object.assign(btn('opt1', 'Option 1', ['Digit1'], ['LB']), { short: 'Opt 1' }),
        btn('pause', 'Pause', ['Enter', 'KeyP'], ['Start']), Object.assign(btn('opt2', 'Option 2', ['Digit2'], ['RB']), { short: 'Opt 2' }), Object.assign(btn('turn', 'Turn the screen', ['KeyR']), { type: 'toggle' })] });
    }
    return out;
  }

  /* ---------------------------------------------------------------- input to the core */
  function applyInputs(midFrame) {
    const s = i => inputs[i] || { buttons: 0 };
    if (SYS === 'a2600') {
      for (let p = 0; p < ports.length; p++) {
        const port = ports[p], st = s(p), k = port.kindName;
        if (port.kind !== 'player') continue;
        if (k === 'joystick' || k === 'quadtari' || k === 'quad-b' || k === 'genesis' || k === 'booster' || k === 'joy2b') {
          let b = 0; ['up', 'down', 'left', 'right', 'fire', 'b5', 'b9'].forEach((id, i) => { if (held(port, st, id)) b |= 1 << i; });
          m.setJoystick(k === 'quad-b' ? port.quad : p, b);
        } else if (midFrame) continue;                    // paddles, wheels, keypads, guns and mice once a frame
        else if (k === 'paddles') turnPaddles(port, st, p * 2);
        else if (k === 'driving') turnWheel(port, st, p);
        else if (k === 'keypad') keypad(port, st, p);
        else if (k === 'lightgun') gunStep(port, st, p);
        else if (POINTING_2600.has(k)) pointerStep(port, st, p);
        else if (k === 'mindlink') mindStep(port, st, p);
      }
      const ci = ports.findIndex(x => x.kind === 'console'), c = s(ci), cp = ports[ci];
      let bits = sw.bits & ~3;
      if (held(cp, c, 'reset')) bits |= 1;
      if (held(cp, c, 'select')) bits |= 2;
      m.setSwitches(bits);
    } else if (SYS === 'a7800') {
      const C = CTRL7800();
      for (let p = 0; p < 2; p++) {
        const port = ports[p], st = s(p), k = port.kindName;
        if (k === 'proline' || k === 'joystick') {
          let b = 0; ['up', 'down', 'left', 'right'].forEach((id, i) => { if (held(port, st, id)) b |= 1 << i; });
          if (held(port, st, 'b1')) b |= 16; if (held(port, st, 'b2')) b |= 32; if (held(port, st, 'both')) b |= 48;
          m.setJoystick(p, b);
          if (m.ctrlType && m.ctrlType[p] === C.MEGA7800 && m.setMega7800) m.setMega7800(p, b);
        } else if (k === 'snes') {
          let b = 0; SNES_BITS.forEach(([id, bit]) => { if (held(port, st, id)) b |= bit; });
          m.X.a7800_set_snes(m.ctx, p, b); snesSent[p] = b;
        } else if (midFrame) continue;                    // paddles, wheels, keypads, guns turn once a frame
        else if (k === 'paddles') turnPaddles(port, st, p * 2);
        else if (k === 'driving') turnWheel(port, st, p);
        else if (k === 'keypad') keypad(port, st, p);
        else if (k === 'lightgun') gunStep(port, st, p);
      }
      const c = s(2), cp = ports[2];
      let bits = sw.bits & ~(1 | 2 | 8);
      if (held(cp, c, 'reset')) bits |= 1;
      if (held(cp, c, 'select')) bits |= 2;
      if (held(cp, c, 'pause')) bits |= 8;
      // F4 flips the left difficulty, as on the old page (on the press, not while held).
      const t = held(cp, c, 'diffLToggle');
      if (t && !(sw.lastConsole & 1)) env.emit('option', { id: 'diffL', v: (sw.bits & 64) ? '0' : '1' });
      sw.lastConsole = t ? 1 : 0;
      m.setSwitches(bits);
    } else if (SYS === 'a5200') {
      for (let p = 0; p < 2; p++) {
        const port = ports[p], st = s(p);
        const kx = (held(port, st, 'right') ? 1 : 0) - (held(port, st, 'left') ? 1 : 0);
        const ky = (held(port, st, 'down') ? 1 : 0) - (held(port, st, 'up') ? 1 : 0);
        let x = 127 * kx, y = 127 * ky;
        const ax = st.axes || null;
        if (!kx && !ky && ax && (Math.abs(ax[0] || 0) > 0.12 || Math.abs(ax[1] || 0) > 0.12)) {
          x = Math.max(-127, Math.min(127, Math.round((ax[0] || 0) * 127)));
          y = Math.max(-127, Math.min(127, Math.round((ax[1] || 0) * 127)));
        }
        /* The Trak-ball (play/atari5200/app.js wireTrakball, retired 2026-10-15): while the
           host holds the pointer, player one's controller is the mouse's motion since the
           last frame, left button lower fire, right button upper fire. */
        const tb = p === 0 && ball.on;
        if (tb) { m.setTrackball(0, Math.round(ball.dx), Math.round(ball.dy)); ball.dx = 0; ball.dy = 0; } else m.setStick(p, x, y);
        m.setTrigger(p, held(port, st, 'lower') || (tb && !!((ball.b | ball.lb) & 1)));
        m.setTopButton(p, held(port, st, 'upper') || (tb && !!((ball.b | ball.lb) & 2)));
        if (tb) ball.lb = 0;
        let key = W.KEY.NONE;
        if (p === 0) {
          const cp = ports[2], c = s(2);
          if (held(cp, c, 'start')) key = W.KEY.START; else if (held(cp, c, 'pause')) key = W.KEY.PAUSE; else if (held(cp, c, 'reset')) key = W.KEY.RESET;
          else for (let i = 0; i < 12; i++) if (held(port, st, 'k' + i)) { key = [1, 2, 3, 4, 5, 6, 7, 8, 9, W.KEY.STAR, 0, W.KEY.HASH][i]; break; }
        }
        m.setKeypad(p, key);
      }
    } else {
      const B = W.B, port = ports[0], st = s(0), ci = ports.findIndex(x => x.kind === 'console'), cp = ports[ci], c = s(ci);
      const TURN = { 0: { up: 'UP', down: 'DOWN', left: 'LEFT', right: 'RIGHT' }, 1: { up: 'RIGHT', right: 'DOWN', down: 'LEFT', left: 'UP' }, 2: { up: 'LEFT', left: 'DOWN', down: 'RIGHT', right: 'UP' } }[turn];
      let b = 0;
      for (const d of ['up', 'down', 'left', 'right']) if (held(port, st, d)) b |= B[TURN[d]];
      if (held(port, st, 'a')) b |= B.A;
      if (held(port, st, 'b')) b |= B.B;
      if (held(cp, c, 'opt1')) b |= B.OPT1;
      if (held(cp, c, 'opt2')) b |= B.OPT2;
      if (held(cp, c, 'pause')) b |= B.PAUSE;
      const t = held(cp, c, 'turn');
      if (t && !(sw.lastConsole & 1)) env.emit('option', { id: 'turn', v: String((turn + 1) % 3) });
      sw.lastConsole = t ? 1 : 0;
      m.setButtons(b);
      if (m2 && ports[1] && ports[1].kind === 'player') {
        const q = ports[1], t2 = s(1);
        let b2 = 0;
        for (const d of ['up', 'down', 'left', 'right']) if (held(q, t2, d)) b2 |= B[TURN[d]];
        if (held(q, t2, 'a')) b2 |= B.A;
        if (held(q, t2, 'b')) b2 |= B.B;
        if (held(q, t2, 'opt1')) b2 |= B.OPT1;
        if (held(q, t2, 'opt2')) b2 |= B.OPT2;
        if (held(q, t2, 'pause')) b2 |= B.PAUSE;
        m2.setButtons(b2);
      }
    }
  }
  /* Paddles: Left turns anticlockwise (towards 65535), Right clockwise (towards 0), at a
     full sweep in about 1.1 s with a short ramp, so a tap moves a few pixels. */
  const paddleHeld = [0, 0, 0, 0], lastPointerX = [null, null];
  function turnPaddles(port, st, n0) {
    const X = m.X;
    const pt = st.pointer, pp = n0 >> 1;
    if (pt && bitOf(port, 'pa-pointer') >= 0 && (pt.inside || pt.buttons) && pt.x !== lastPointerX[pp]) {
      lastPointerX[pp] = pt.x;
      paddle[n0] = Math.max(0, Math.min(65535, Math.round((1 - Math.max(0, Math.min(1, pt.x))) * 65535)));
    }
    [['pa-ccw', 'pa-cw', 'pa-fire'], ['pb-ccw', 'pb-cw', 'pb-fire']].forEach(([ccw, cw, fire], j) => {
      const n = n0 + j;
      const dir = (held(port, st, ccw) ? 1 : 0) - (held(port, st, cw) ? 1 : 0);
      paddleHeld[n] = dir ? Math.min(paddleHeld[n] + 1, 12) : 0;
      if (dir) paddle[n] = Math.max(0, Math.min(65535, paddle[n] + dir * (300 + 80 * paddleHeld[n])));
      // The left stick turns this player's first paddle at a speed in proportion to how far it is
      // pushed (full push = the keys' top speed); left anticlockwise, as Left.
      const sx = !dir && j === 0 && st.axes ? +st.axes[0] || 0 : 0;
      if (Math.abs(sx) > 0.15) paddle[n] = Math.max(0, Math.min(65535, Math.round(paddle[n] - sx * 1260)));
      const f = held(port, st, fire) || (j === 0 && !!(pt && pt.buttons && bitOf(port, 'pa-pointer') >= 0));
      if (SYS === 'a2600') { X.atari_set_paddle(m.ctx, n, paddle[n]); X.atari_set_paddle_fire(m.ctx, n, f ? 1 : 0); }
      else X.a7800_set_paddle(m.ctx, n, paddle[n], f ? 1 : 0);
    });
  }
  /* THE LIGHT GUN (gunControls above). The aim is kept as a place on the picture (0..1 each way); the
     core is handed the raster pixel (0..159) and raster row under it, plus GUN_ADJ (the site's own
     correction, none so far). Off the picture the gun aims at no line, so it sees nothing. A pull
     shorter than a frame is held for GUN_HOLD frames, so a quick click always reaches the game. */
  const GUN_HOLD = 4, GUN_ADJ = { a2600: { x: -2, y: -7 }, a7800: { x: 4, y: -8 } }[SYS] || { x: 0, y: 0 };
  const gun = [0, 1].map(() => ({ x: -1, y: -1, down: false, hold: 0, sig: '' }));
  const clamp01 = v => Math.max(0, Math.min(0.9999, v));
  function gunWindow() {
    if (SYS === 'a2600') return W.WINDOW[region] || W.WINDOW[0];
    return ((m.inTwoSixHundredMode() ? W.WIN2600 : W.WIN7800)[m.region()]) || W.WIN7800[0];
  }
  function gunStep(port, st, p) {
    const g = gun[p], pt = st.pointer, win = gunWindow();
    if (pt) {
      const sig = `${pt.x},${pt.y},${pt.inside ? 1 : 0}`;
      if (sig !== g.sig) { g.sig = sig; if (pt.inside) { g.x = clamp01(pt.x); g.y = clamp01(pt.y); } else g.x = g.y = -1; }
    }
    const ax = (held(port, st, 'aim-right') ? 1 : 0) - (held(port, st, 'aim-left') ? 1 : 0);
    const ay = (held(port, st, 'aim-down') ? 1 : 0) - (held(port, st, 'aim-up') ? 1 : 0);
    const down = held(port, st, 'trigger') || !!(pt && pt.buttons & 1);
    if ((ax || ay || down) && g.x < 0) { g.x = 0.5; g.y = 0.5; }
    if (ax) g.x = clamp01(g.x + ax * 2 / 160);
    if (ay) g.y = clamp01(g.y + ay * 3 / win.h);
    g.hold = down ? GUN_HOLD : Math.max(0, g.hold - 1);
    g.down = down;
    const trig = down || g.hold > 0 ? 1 : 0;
    const on = g.x >= 0;
    const x = on ? Math.floor(g.x * 160) + GUN_ADJ.x : 0, y = on ? win.y + Math.floor(g.y * win.h) + GUN_ADJ.y : 4000;
    if (SYS === 'a2600') m.X.atari_set_lightgun(m.ctx, p, x, y, trig); else m.X.a7800_set_lightgun(m.ctx, p, x, y, trig);
  }
  /* Where the light gun is aimed (0..1 of the picture), for the host's crosshair; null when no gun is aimed. */
  function crosshair() {
    if (!m || !ports) return null;
    for (let p = 0; p < 2; p++) if (ports[p] && ports[p].kindName === 'lightgun' && gun[p].x >= 0) {
      const win = gunWindow();
      return { x: (Math.floor(gun[p].x * 160) + 0.5) / 160, y: (Math.floor(gun[p].y * win.h) + 0.5) / win.h };
    }
    return null;
  }
  /* THE 2600'S TRAK-BALL AND MICE. The mouse's (or a finger's) motion over the picture since the last
     frame, in the device's steps: the picture's width is POINTER_STEPS.x steps, its height
     POINTER_STEPS.y. The direction keys move it POINTER_KEY steps a frame. The core repeats a frame's
     motion until it is given another, so a frame without motion gives it none. */
  const POINTER_STEPS = { x: 160, y: 160 }, POINTER_KEY = 2;
  const ptr = [0, 1].map(() => ({ x: null, y: null, fx: 0, fy: 0 }));
  /* Held by the host (pointer lock): the mouse's own motion, POINTER_LOCK steps a pixel, on the first
     port that asked for it; the left button is the device's button. */
  const POINTER_LOCK = 0.25, held2600 = { on: false, dx: 0, dy: 0, b: 0, lb: 0 };
  function pointerStep(port, st, p) {
    const q = ptr[p], lockedHere = held2600.on && ports.findIndex(x => x.pointerLock) === p, pt = lockedHere ? null : st.pointer;
    let dx = 0, dy = 0;
    if (lockedHere) { q.fx += held2600.dx * POINTER_LOCK; q.fy += held2600.dy * POINTER_LOCK; held2600.dx = held2600.dy = 0; }
    if (pt && pt.inside) {
      if (q.x !== null) { q.fx += (pt.x - q.x) * POINTER_STEPS.x; q.fy += (pt.y - q.y) * POINTER_STEPS.y; }
      q.x = pt.x; q.y = pt.y;
    } else q.x = q.y = null;
    q.fx += ((held(port, st, 'right') ? 1 : 0) - (held(port, st, 'left') ? 1 : 0)) * POINTER_KEY;
    q.fy += ((held(port, st, 'down') ? 1 : 0) - (held(port, st, 'up') ? 1 : 0)) * POINTER_KEY;
    dx = Math.trunc(q.fx); dy = Math.trunc(q.fy); q.fx -= dx; q.fy -= dy;
    m.X.atari_move_pointer(m.ctx, p, dx, dy);
    const lockFire = lockedHere && !!((held2600.b | held2600.lb) & 1); if (lockedHere) held2600.lb = 0;
    m.setJoystick(p, held(port, st, 'fire') || !!(pt && pt.buttons & 1) || lockFire ? 16 : 0);
  }
  /* THE MINDLINK. The headband's position on its own scale (MIND_MIN..MIND_MAX), kept per port. */
  const MIND_MIN = 0x0B00, MIND_MAX = 0x6500, MIND_BUTTON = 0x8000, mind = [(MIND_MIN + MIND_MAX) >> 1, (MIND_MIN + MIND_MAX) >> 1], mindHeld = [0, 0], mindPtr = [null, null];
  function mindStep(port, st, p) {
    const pt = st.pointer;
    if (pt && (pt.inside || pt.buttons) && pt.x !== mindPtr[p]) { mindPtr[p] = pt.x; mind[p] = Math.round(MIND_MIN + clamp01(pt.x) * (MIND_MAX - MIND_MIN)); }
    const dir = (held(port, st, 'ml-more') ? 1 : 0) - (held(port, st, 'ml-less') ? 1 : 0);
    mindHeld[p] = dir ? Math.min(mindHeld[p] + 1, 12) : 0;
    if (dir) mind[p] += dir * (60 + 20 * mindHeld[p]);
    const sx = !dir && st.axes ? +st.axes[0] || 0 : 0;
    if (Math.abs(sx) > 0.15) mind[p] += Math.round(sx * 300);
    mind[p] = Math.max(MIND_MIN, Math.min(MIND_MAX, mind[p]));
    m.X.atari_set_mindlink(m.ctx, p, mind[p] | (held(port, st, 'ml-button') || (pt && pt.buttons & 1) ? MIND_BUTTON : 0));
  }
  /* Driving controller: one step of the wheel every third frame while Left or Right is held. */
  function turnWheel(port, st, p) {
    let dir = (held(port, st, 'right') ? 1 : 0) - (held(port, st, 'left') ? 1 : 0), every = 3;
    // The left stick turns the wheel faster the further it is pushed (a step every 3 frames at a light
    // push, every frame at a full one).
    const sx = !dir && st.axes ? +st.axes[0] || 0 : 0;
    if (Math.abs(sx) > 0.25) { dir = sx > 0 ? 1 : -1; every = Math.max(1, Math.round(4 - 3 * Math.abs(sx))); }
    if (dir) { if (++wheelTick[p] >= every) { wheelTick[p] = 0; wheel[p] = (wheel[p] + dir) | 0; } } else wheelTick[p] = 2;
    const f = held(port, st, 'fire') ? 1 : 0;
    if (SYS === 'a2600') m.X.atari_set_driving(m.ctx, p, wheel[p], f); else m.X.a7800_set_driving(m.ctx, p, wheel[p], f);
  }
  function keypad(port, st, p) {
    let mask = 0; for (let i = 0; i < 12; i++) if (held(port, st, 'k' + i)) mask |= 1 << i;
    keypadSent[p] = mask;
    if (SYS === 'a2600') m.X.atari_set_keypad(m.ctx, p, mask); else m.X.a7800_set_keypad(m.ctx, p, mask);
  }
  function setControllers() {
    if (SYS === 'a2600') {
      // The joystick is the core's default, and a cartridge may choose its own device at load
      // (a CompuMate selects its keyboard): the port is set only when the viewer plugged
      // something else, or plugs the joystick back after it.
      m._plugged = m._plugged || [false, false];
      for (let p = 0; p < 2; p++) {
        const t = T2600[ports[p].kindName] || 0;
        if (t || m._plugged[p]) { m.setController(p, t); m._plugged[p] = !!t; }
      }
    } else if (SYS === 'a7800') {
      const C = CTRL7800();
      m.ctrlType = [];
      for (let p = 0; p < 2; p++) {
        const k = ports[p].kindName, hdr = m.headerController(p);
        // Paddles, wheel and keypad by the port's device; otherwise what the header names
        // (the old page's rule), unless the viewer chose the ProLine.
        const t = k === 'savekey' ? C.SAVEKEY : k === 'lightgun' ? C.LIGHTGUN : k === 'snes' ? C.SNES : k === 'paddles' ? C.PADDLES : k === 'driving' ? C.DRIVING : k === 'keypad' ? C.KEYPAD
          : (opts['ctrl' + (p ? 'R' : 'L')] || 'auto') === 'auto' && hdr !== C.SNES ? hdr : C.PROLINE;   // a SNES header without the pad's export: a ProLine
        m.ctrlType[p] = t;
        m.setController(p, t);
      }
    }
  }

  /* TWO LYNXES ON ONE CABLE: what the served core needs for it; the two consoles' sound, mixed. */
  const lynxLinkable = mm => SYS === 'alynx' && !!mm && ['lynx_link', 'lynx_link_run_frame', 'lynx_unlink', 'lynx_linked'].every(k => typeof mm.X[k] === 'function');
  function mixLink(a, b) {
    if (!b || !b.length) return a;
    if (!a || !a.length) return b;
    const n = Math.min(a.length, b.length);
    for (let i = 0; i < n; i++) { const v = a[i] + b[i]; a[i] = v > 1 ? 1 : v < -1 ? -1 : v; }
    return a;
  }

  /* Two consoles switched on at the same instant run the same program in step: each sends the same
     bytes at the same moment, hears them as its own on the shared wire, and decides it is alone. So
     player 2's console is switched on LYNX_P2_DELAY frames after player 1's, as two people would (and
     as the core project's own link check does: its second console starts later). Then the cable. */
  const LYNX_P2_DELAY = 30;
  function runLynx() {
    if (!m2) { m.runFrame(); return; }
    if (p2Wait > 0) {
      m.runFrame();
      if (--p2Wait === 0) { m2.powerOn(); if (m.X.lynx_link(m.ctx, m2.ctx) !== 0) env.log('warn', 'the second Lynx could not be linked'); }
      return;
    }
    m.X.lynx_link_run_frame(m.ctx);
  }

  /* ---------------------------------------------------------------- clocks and frames */
  let clockOf = null, perFrame = 0, fps = 60, guardMax = 4;
  function pace() {
    if (SYS === 'a2600') {
      clockOf = () => m.cpuCycles();
      const hz = W.CPU_HZ[region]; fps = hz / (76 * (region ? 312 : 262)); perFrame = hz / fps;
    } else if (SYS === 'a5200') {
      clockOf = null; fps = W.CPU_HZ / W.FRAME_CYCLES; perFrame = W.FRAME_CYCLES;
    } else if (SYS === 'a7800') {
      clockOf = () => m.masterClocks();
      const r = m.region(), hz = W.MCLK_HZ[r]; fps = hz / (454 * (r ? 313 : 263)); perFrame = hz / fps;
    } else {
      clockOf = () => m.ticks(); fps = 60; perFrame = W.TICK_HZ / 60; guardMax = 6;
    }
  }
  /* TIMED INPUT (2026-10-21; Stella #858 class). The host says when in the frame
     each button change happened (`at`, 0..1, play/host/input.mjs); the 2600 runs the frame in
     parts (atari_run_part) and sets each change at its CPU cycle, so a program that reads a
     button twice in one frame (California Games' BMX) sees the change between its reads.
     Changes past the frame's end land at the next frame's start. */
  /* The 7800's 2600 mode (2026-10-22) runs the same way on the 2600 core inside
     its context (a7800_vcs): the 7800's input setters reach that core at once in 2600 mode,
     and a 2600-mode frame is atari_run_frame's frame. 7800 mode (2026-10-22) runs
     the same way on a7800_run_part, counting master clocks; a core without it keeps
     once-a-frame input there. */
  let timedQ = [];
  const in2600 = () => m.X.a7800_in_2600_mode(m.ctx) === 1;
  const timedOk = () => !!(m && m.X && typeof m.X.atari_run_part === 'function') && (SYS === 'a2600'
    || (SYS === 'a7800' && (in2600() ? typeof m.X.a7800_vcs === 'function' : typeof m.X.a7800_run_part === 'function')));
  function runTimed() {
    if (!timedOk()) {                                      // the mode changed since: as untimed
      for (const [port, st] of timedQ) inputs[port] = st;
      timedQ = []; applyInputs(); m.runFrame(); return;
    }
    const X = m.X, mode7800 = SYS === 'a7800' && !in2600();
    const q = timedQ, ctx = SYS === 'a7800' && !mode7800 ? X.a7800_vcs(m.ctx) : m.ctx;
    const part = mode7800 ? X.a7800_run_part : X.atari_run_part;
    const cyc = mode7800 ? () => Number(X.a7800_master_clocks(ctx)) : () => Number(X.atari_cpu_cycles(ctx));
    const cpf = SYS === 'a7800' && !mode7800 ? perFrame / 6 : perFrame;
    const start = cyc();
    timedQ = [];
    let begin = 1, done = 0;
    for (const [port, st] of q) {
      if (!done) {
        const left = start + Math.floor(st.at * cpf) - cyc();
        done = part(ctx, Math.max(0, left), begin);
        begin = 0;
      }
      inputs[port] = st;
      applyInputs(true);
    }
    if (!done) part(ctx, 0xFFFFFFFF, begin);
  }
  /* THE TIME BOX (2026-10-21). A slice that runs past 250 ms of wall
     time stops there and falls behind instead of holding the page; when slices keep doing
     that for about five seconds the game is stopped with a plain message, so a runaway
     program never freezes the window (the Lynx's own cut is in the core, machine.h). */
  let slowSlices = 0, timedOut = false;
  function runSlice() {
    if (timedOut) return;
    const t0 = performance.now();
    owed += perFrame;
    let guard = 0;
    while (owed > 0 && guard++ < guardMax) {
      if (guard > 1 && performance.now() - t0 > 250) { owed = 0; break; }
      applyInputs();
      if (timedQ.length) { const before = clockOf(); runTimed(); owed -= clockOf() - before; }
      else if (clockOf) { const before = clockOf(); runLynx(); owed -= clockOf() - before; }
      else { m.runFrame(); owed -= perFrame; }
      let a = m.drainAudio();
      if (m2) a = mixLink(a, m2.drainAudio());
      if (kv && a) kvMix(a);
      if (a && a.length) audioParts.push(a);
    }
    if (owed > 0 && guard > guardMax) owed = 0;           // a stall: fall behind, do not race
    slowSlices = performance.now() - t0 > 250 ? slowSlices + 1 : 0;
    if (slowSlices >= 20) {
      timedOut = true;
      env.emit('error', { message: 'This game stopped responding: it asks the console for more than it can do.' });
    }
    frameDirty = true;                                     // built on demand by video()
    if (!jammed) {
      const j = SYS === 'a5200' ? m.jammed() : (SYS === 'a7800' && typeof m.X.a7800_cpu_jammed === 'function' ? m.X.a7800_cpu_jammed(m.ctx) === 1 : false);
      if (j) { jammed = true; env.emit('jam', { message: firmwareUsed ? "The console stopped (a CPU jam). Try the project's firmware." : 'The console stopped (a CPU jam).' }); }
    }
  }

  /* ---------------------------------------------------------------- the picture */
  let pal2600 = null, pal5200 = null, pal7800 = {};
  function buildFrame() {
    if (SYS === 'a2600') {
      const win = W.WINDOW[region], src = m.raster();
      const w = 320, h = win.h;
      if (!frame || frame.length !== w * h) frame = new Uint8Array(w * h);
      for (let y = 0; y < h; y++) {
        const s = (win.y + y) * 160, d = y * 320;
        for (let x = 0; x < 160; x++) { const v = src[s + x]; frame[d + 2 * x] = v; frame[d + 2 * x + 1] = v; }
      }
      frameW = w; frameH = h; frameFmt = 'index8';
      framePal = pal2600 || (pal2600 = palOf(P.a2600[['NTSC', 'PAL', 'SECAM'][region]] || P.a2600.NTSC));
    } else if (SYS === 'a5200') {
      const src = m.raster(), w = W.DRAWN_W, h = W.RASTER_H;
      if (!frame || frame.length !== w * h) frame = new Uint8Array(w * h);
      for (let y = 0; y < h; y++) frame.set(src.subarray(y * W.RASTER_W + W.DRAWN_X, y * W.RASTER_W + W.DRAWN_X + w), y * w);
      frameW = w; frameH = h; frameFmt = 'index8';
      framePal = pal5200 || (pal5200 = palOf(P.a5200.NTSC));
    } else if (SYS === 'a7800') {
      const in26 = m.inTwoSixHundredMode(), r = m.region();
      const win = (in26 ? W.WIN2600 : W.WIN7800)[r] || W.WIN7800[0];
      const rw = m.rasterWidth(), lines = m.rasterLines();
      const src = m.raster(Math.max(lines, win.y + win.h));
      const h = win.h;
      if (!frame || frame.length !== 320 * h) frame = new Uint8Array(320 * h);
      for (let y = 0; y < h; y++) {
        const live = (win.y + y) < lines, s = (win.y + y) * rw, d = y * 320;
        if (!live) { frame.fill(0, d, d + 320); continue; }
        if (rw >= 320) frame.set(src.subarray(s, s + 320), d);
        else for (let x = 0; x < rw; x++) { const v = src[s + x]; frame[d + 2 * x] = v; frame[d + 2 * x + 1] = v; }
      }
      frameW = 320; frameH = h; frameFmt = 'index8';
      const key = (in26 ? '26' : '78') + r;
      framePal = pal7800[key] || (pal7800[key] = palOf((in26 ? P.a2600 : P.a7800)[r ? 'PAL' : 'NTSC']));
    } else {
      /* One screen, turned as the console is held; two linked consoles side by side, LYNX_GAP apart. */
      const Wd = W.W, Hd = W.H, sw1 = turn ? Hd : Wd, sh = turn ? Wd : Hd, n = m2 ? 2 : 1, fw = sw1 * n + (n - 1) * LYNX_GAP;
      if (!frame || frame.length !== fw * sh) frame = new Uint16Array(fw * sh);
      const put = (src, x0) => {
        if (turn === 0) { for (let y = 0; y < Hd; y++) frame.set(src.subarray(y * Wd, y * Wd + Wd), y * fw + x0); }
        else if (turn === 1) {         // turned left: the picture rotated a quarter anticlockwise
          for (let y = 0; y < Wd; y++) for (let x = 0; x < Hd; x++) frame[y * fw + x0 + x] = src[x * Wd + (Wd - 1 - y)];
        } else {                       // turned right: a quarter clockwise
          for (let y = 0; y < Wd; y++) for (let x = 0; x < Hd; x++) frame[y * fw + x0 + x] = src[(Hd - 1 - x) * Wd + y];
        }
      };
      put(m.raster(), 0);
      if (m2) { put(m2.raster(), sw1 + LYNX_GAP); for (let y = 0; y < sh; y++) frame.fill(0, y * fw + sw1, y * fw + sw1 + LYNX_GAP); }
      frameW = fw; frameH = sh;
      frameFmt = 'index16'; framePal = lynxPalette();
    }
  }
  function videoInfo() {
    if (frameDirty || !frame) { buildFrame(); frameDirty = false; }
    return Object.assign({ width: frameW, height: frameH, format: frameFmt, pixelAspect: 1, rotation: SYS === 'alynx' ? [0, 270, 90][turn] : 0, palette: framePal },
      m2 ? { fill: true } : {});   // two linked screens wear no console photograph: the plain screen fills the stage
  }

  /* ---------------------------------------------------------------- battery */
  let eepromSeen = 0, nvClean = null, hscClean = null, hscLast = null, hscFw = false, sk2600 = false, skClean = null, skLast = null;
  function batteryList() {
    if (SYS === 'alynx' && m.eepromSize && m.eepromSize() > 0) return [{ id: 'eeprom', kind: 'eeprom', bytes: m.eepromRead().length, ext: '.eep' }]
      .concat(m2 && m2.eepromSize() > 0 ? [{ id: 'eeprom2', kind: 'eeprom', bytes: m2.eepromRead().length, ext: '.p2.eep' }] : []);
    const out = [];
    if (SYS === 'a2600' && nvOn()) out.push({ id: 'nvram', kind: 'flash', bytes: m.X.atari_nvram_size(m.ctx), ext: '.nv' });
    if (SYS === 'a7800' && hscOn()) out.push({ id: 'hsc', kind: 'sram', bytes: HSC_BYTES, ext: '.hsc' });
    if (skOn()) out.push({ id: 'savekey', kind: 'eeprom', bytes: SK_BYTES, ext: '.eep' });
    return out;
  }
  function nvOn() { return typeof m.X.atari_nvram_size === 'function' && m.X.atari_nvram_size(m.ctx) > 0; }
  /* The SaveKey's memory (THE SAVEKEY above): kept while one is plugged into the right port. */
  function skOn() { return !!(m && (SYS === 'a2600' || SYS === 'a7800') && ports && ports[1] && ports[1].kindName === 'savekey'); }
  function skMem() { return m.u8(SYS === 'a2600' ? m.X.atari_eeprom(m.ctx) : m.X.a7800_eeprom(m.ctx), SK_BYTES); }
  function nvRead() { const n = m.X.atari_nvram_size(m.ctx); return n ? m.u8(m.X.atari_nvram(m.ctx), n).slice() : null; }
  /* THE XM MODULE'S HIGH-SCORE MEMORY (7800; 2026-10-24). The module carries the High
     Score Cartridge's 2 KB of battery RAM at 1000-17FF (the 7800 expansions chapter: "The
     battery RAM belongs to the host"; a7800_hsc_ram, a new one reads FF). It is kept as this game's
     battery save, like the other consoles' cartridge saves: read back before the first frame,
     written within a second of a change and when the page is hidden. Kept per game, not one
     module for every game as the real one is (the host keeps saves per game); a game then sees
     only its own entries. Only while the XM is plugged in (the site never plugs in the HSC alone). */
  function hscOn() { return !!(m && m.xm && typeof m.X.a7800_hsc_ram === 'function'); }
  function hscRead() { return m.u8(m.X.a7800_hsc_ram(m.ctx), HSC_BYTES).slice(); }

  /* ---------------------------------------------------------------- state */
  function stateFns() {
    const X = m.X, p = PREFIX[SYS];
    if (typeof X[p + '_state_save'] !== 'function') return null;
    stateSize = Number(X[p + '_state_size']());
    if (!m._contBuf) m._contBuf = m.memory.grow(Math.ceil(stateSize / 65536)) * 65536;
    stateBuf = m._contBuf;
    return true;
  }

  /* The Kid Vid's tape audio (THE KID VID'S NARRATION above): all of the cartridge's four
     files, whole and of the right kind, or none (the game then plays as without them). */
  function kvSetup() {
    kv = null;
    if (!kvCapable || typeof m.X.atari_kidvid_game !== 'function') return;
    const g = m.X.atari_kidvid_game(m.ctx);
    if (!KV_FOR[g]) return;
    const files = [];
    for (const i of KV_FOR[g]) {
      const d = wavData((req.firmware || {})[KV_IDS[i]]);
      if (!d || d.length < m.X.atari_kidvid_file_min_size(i)) return;
      files[i] = d;
    }
    kv = { files, out: m.audioBuf + 4096 };   // two words for atari_kidvid_speech, past what drainAudio uses
    m.X.atari_kidvid_set_tapes(m.ctx, 1);
  }
  /* One frame's story into that frame's TIA samples: one byte a scanline, two of the TIA's
     samples, from the frame's start. */
  function kvMix(a) {
    const f = m.X.atari_kidvid_speech(m.ctx, kv.out, kv.out + 4);
    const d = f >= 0 ? kv.files[f] : null;
    if (!d) return;
    const w = new Uint32Array(m.memory.buffer, kv.out, 2), off = w[0], n = w[1];
    for (let i = 0; i < a.length; i++) {
      const j = i >> 1;
      if (j >= n || off + j >= d.length) break;
      const v = a[i] + (d[off + j] - 128) * KV_GAIN;
      a[i] = v > 1 ? 1 : v < -1 ? -1 : v;
    }
  }

  /* The Supercharger's tape (THE SUPERCHARGER'S TAPE above): before the cartridge, the player's own
     firmware for this Television setting, then the recording, kept in the core's memory for the
     session (the core reads it in place). Either missing or refused: the file path, as before. */
  function arSetup(bytes) {
    arTape = null;
    const f = req.firmware || {}, wav = f.artape, fw = region ? f.arfwpal : f.arfw;
    if (!arCapable || !arImage(bytes) || !isWav(wav) || !fw || fw.length !== 2048) return;
    const X = m.X;
    m.u8(m.scratch, 2048).set(fw);
    if (X.atari_set_supercharger_firmware(m.ctx, m.scratch, 2048) !== 0) return;
    const at = m.memory.grow(Math.ceil(wav.length / 65536)) * 65536;
    m.u8(at, wav.length).set(wav);
    if (X.atari_set_supercharger_tape(m.ctx, at, wav.length) !== 0) { X.atari_set_supercharger_firmware(m.ctx, 0, 0); return; }
    arTape = { bytes: wav.length };
    firmwareUsed = 'user';
  }

  /* ---------------------------------------------------------------- load */
  function pickFirmware(want, bytesList) {
    const fw = (req.firmware || {}).bios;
    if (!want || !fw) return null;
    return bytesList.includes(fw.length) ? fw : null;
  }
  function build(r) {
    req = r;
    timedQ = []; slowSlices = 0; timedOut = false;
    const bytes = r.game.bytes;
    if (!bytes || !bytes.length) throw new CoreError('damaged', 'This file is empty.');
    if (bytes.length > manifest.files.game.maxBytes) throw new CoreError('unsupported', `This file is ${bytes.length} bytes; the ${LABEL[SYS]} core accepts at most ${manifest.files.game.maxBytes}.`);
    opts = Object.assign({}, r.options || {});
    m = takeInstance() || m;
    if (!m) throw new CoreError('unsupported', `The ${LABEL[SYS]} core did not load.`);
    firmwareUsed = null; jammed = false; owed = 0; frame = null; frameDirty = true; audioParts.length = 0;
    paddle.fill(32768); wheel.fill(0); sw.lastConsole = 0;
    for (const g of gun) { g.x = g.y = -1; g.hold = 0; g.sig = ''; }
    for (const q of ptr) { q.x = q.y = null; q.fx = q.fy = 0; }
    try {
      if (SYS === 'a2600') {
        region = opts.console === '5200vcs' ? 0 : Math.max(0, Math.min(2, (+opts.region) | 0));
        m.setRegion(region);
        arSetup(bytes);
        m.loadCartridge(bytes);
        m.powerOn();
        kvSetup();
      } else if (SYS === 'a5200') {
        if (twoPort5200(bytes)) {
          /* THE TWO-PORT 5200: its own firmware or nothing (the game server is asked for role boot-2port) */
          const fw = (req.firmware || {}).bios;
          if (!fw || !TWO_PORT_FW.has(idOf(fw)) || !m.setFirmware(fw)) throw new CoreError('needs-firmware',
            'This game was made for the later two-port 5200 console and needs that console\'s firmware. None of your game servers has it. Add it to a game server, then open the game again.');
          firmwareUsed = 'user';
        } else if (NEEDS_ORIGINAL_5200.has(shaOf(r))) {
          /* THE CONSOLE'S OWN FIRMWARE FIRST: a game that needs Atari's own firmware gets it whatever
             the setting, or stops with the reason (never a black screen). */
          const fw = pickFirmware(true, [2048]);
          if (!fw || !m.setFirmware(fw)) throw new CoreError('needs-firmware',
            'This game needs the Atari 5200\'s own console firmware: it uses Atari\'s code, which this site\'s firmware does not have. None of your game servers has it. Add it to a game server, then open the game again.');
          firmwareUsed = 'user';
        } else {
          const fw = KEEP_OURS_5200.has(shaOf(r)) ? null : pickFirmware(opts.bios !== '0', [2048]);
          if (fw && m.setFirmware(fw)) firmwareUsed = 'user';
          else if (typeof m.X.a5200_set_firmware === 'function') m.X.a5200_set_firmware(m.ctx, 0, 0);   // this site's, also in a machine used before
        }
        m.loadCartridge(bytes);
      } else if (SYS === 'a7800') {
        /* The BIOS for the cartridge's TV system (manifest.firmwareRole), never the other one.
           THE CONSOLE'S OWN FIRMWARE FIRST (1 Nov 2026): a PAL game without the PAL BIOS starts
           directly, as it did before the player's BIOS became the default (it was refused). */
        const want = region7800(bytes), pal = want === 1;   // THE 7800'S TV SYSTEM, DECIDED ONCE
        const needs = NEEDS_BIOS_7800.has(shaOf(r));
        let fw = KEEP_NONE_7800.has(shaOf(r)) ? null : pickFirmware(needs || opts.bios !== '0', [4096, 16384]);
        if (fw && PAL_7800_FW.has(idOf(fw)) !== pal) fw = null;
        if (needs && (!fw || typeof m.X.a7800_set_bios !== 'function')) throw new CoreError('needs-firmware',
          'This game needs the Atari 7800 BIOS: started without it, it shows nothing or stops. None of your game servers has it. Add it to a game server, then open the game again.');
        if (typeof m.X.a7800_set_bios === 'function') {
          if (fw) { m.u8(m.scratch, fw.length).set(fw); if (m.X.a7800_set_bios(m.ctx, m.scratch, fw.length) === 0) firmwareUsed = 'user'; }
          else m.X.a7800_set_bios(m.ctx, 0, 0);   // started directly, also in a machine used before
        }
        /* The High Score Cartridge's program for the XM (the player's own, 4 KB), or none: an instance
           used before may still hold one. The core maps it only while the XM is plugged in. */
        if (typeof m.X.a7800_set_hsc_firmware === 'function') {
          const hfw = (req.firmware || {}).hsc;
          if (hfw && hfw.length === 4096) { m.u8(m.scratch, 4096).set(hfw); hscFw = m.X.a7800_set_hsc_firmware(m.ctx, m.scratch, 4096) === 0; }
          else { m.X.a7800_set_hsc_firmware(m.ctx, 0, 0); hscFw = false; }
        }
        if (typeof m.X.a7800_set_region === 'function') m.X.a7800_set_region(m.ctx, want);
        m.loadCartridge(bytes);
        region = m.region();
        /* the core must reach the same TV system (else the BIOS and the timing would disagree): if it
           ever does not, the cartridge starts again without the BIOS, at the core's own timing */
        if (region !== want && firmwareUsed && !m.inTwoSixHundredMode()) {
          console.warn('[atari 7800] the core chose ' + (region ? 'PAL' : 'NTSC') + ' where the site decided ' + (want ? 'PAL' : 'NTSC') + ': started without the BIOS');
          m.X.a7800_set_bios(m.ctx, 0, 0); firmwareUsed = null;
          m.loadCartridge(bytes); region = m.region();
        }
      } else {
        /* The Lynx: the player's own boot program when it is there (THE CONSOLE'S OWN FIRMWARE
           FIRST), else this site's, which the core has built in. Set before the load (its power on
           runs it); size 0 takes it out of a machine used before. */
        if (typeof m.X.lynx_set_firmware === 'function') {
          const fw = pickFirmware(opts.bios !== '0', [512]);
          if (fw) { m.u8(m.scratch, fw.length).set(fw); if (m.X.lynx_set_firmware(m.ctx, m.scratch, fw.length) === 0) firmwareUsed = 'user'; }
          else m.X.lynx_set_firmware(m.ctx, 0, 0);
        }
        m.loadCartridge(bytes);
        /* TWO LYNXES ON ONE CABLE: the second console, made once in this machine instance, the same
           cartridge and boot program, then the cable. */
        m2 = null;
        if (lynxLinkable(m) && opts.link === '2') {
          if (!m._m2) m._m2 = new W.Core({ exports: m.X });
          m2 = m._m2;
          if (typeof m.X.lynx_set_firmware === 'function') {
            const fw = firmwareUsed ? pickFirmware(true, [512]) : null;
            if (fw) { m2.u8(m2.scratch, fw.length).set(fw); m.X.lynx_set_firmware(m2.ctx, m2.scratch, fw.length); }
            else m.X.lynx_set_firmware(m2.ctx, 0, 0);
          }
          m2.loadCartridge(bytes);
          if (m.X.lynx_linked(m.ctx)) m.X.lynx_unlink(m.ctx);
          p2Wait = LYNX_P2_DELAY;          // switched on a moment after player 1's (runLynx)
        } else if (m._m2 && lynxLinkable(m) && m.X.lynx_linked(m.ctx)) m.X.lynx_unlink(m.ctx);
      }
    } catch (e) {
      if (e instanceof CoreError) throw e;
      const msg = String(e && e.message || e);
      /* A later part of a Supercharger game on its own: the core's own words, as a sentence
         (2026-10-22; the project's firmware does not start it). */
      const later = /refused this cartridge: (this is a later part of a Supercharger game.*)$/.exec(msg);
      if (later) throw new CoreError('unsupported', later[1].charAt(0).toUpperCase() + later[1].slice(1) + '.');
      throw new CoreError('damaged', msg);
    }
    stateFns();
    sk2600 = SYS === 'a2600' && hasSaveKeyCode(bytes);
    ports = buildPorts();
    inputs = ports.map(() => ({ buttons: 0 }));
    setControllers();
    sw.bits = switchBits();
    if (SYS === 'alynx') { turn = turnFor(); eepromSeen = m.eepromChanges(); eepromSeen2 = m2 ? m2.eepromChanges() : 0; }
    if (SYS === 'a2600') nvClean = nvOn() ? nvRead() : null;
    if (SYS === 'a7800') { hscClean = hscOn() ? hscRead() : null; hscLast = null; }
    skClean = skOn() ? skMem().slice() : null; skLast = null;
    pace();
  }
  function switchBits() {
    if (SYS === 'a2600') return (opts.colour === '0' && opts.console !== '5200vcs' ? 0 : 8) | (opts.diffL === '1' ? 64 : 0) | (opts.diffR === '1' ? 128 : 0);
    if (SYS === 'a7800') return (opts.diffL === '1' ? 64 : 0) | (opts.diffR === '1' ? 128 : 0);
    return 0;
  }
  /* The Lynx turn: the viewer's own choice for this cartridge; a header known to be wrong,
     corrected by hash; the site's list (play/atarilynx/turned.js), which is measured BY PICTURE
     and so goes before the header's rotation byte (the byte disagreed with the picture in 23 of 25
     headered files; reported 2026-10-17: "flappyv002 on lynx is upside down", its header says 1, the
     list's picture says 2, and the tile already turned by the list); the header; upright.
     The list is read from this page or, in the play window, from the site that holds it (the host
     page never loaded turned.js, so only the two-entry fallback below ever reached it). */
  function turnFor() {
    const v = opts.turn;
    if (v === '0' || v === '1' || v === '2') return +v;
    const k = (req.game.sha256 || '').slice(0, 12);
    const G = (typeof globalThis !== 'undefined' && globalThis) || {};
    let S = null; try { S = G.parent && G.parent !== G && G.parent.LYNX_TURNED ? G.parent : null; } catch (_) { S = null; }
    const L = req.lynx || {};   // the list as the host hands it (a core on a worker thread has no page; 2026-10-24)
    const wrong = G.LYNX_HEADER_WRONG || (S && S.LYNX_HEADER_WRONG) || L.wrong || {};
    const turned = G.LYNX_TURNED || (S && S.LYNX_TURNED) || L.turned || { '3bcadd8ef0f1': 2, '35fa4af0100f': 2 };
    if (k && wrong[k]) return wrong[k];
    if (k && turned[k]) return turned[k];
    const h = m.headerRotation();
    if (h === 1 || h === 2) return h;
    return 0;
  }
  function loadResult() {
    return {
      fps,
      video: videoInfo(),
      audio: { rate: SYS === 'alynx' ? 44100 : (SYS === 'a5200' ? W.AUDIO_HZ : W.AUDIO_HZ[region]) },
      ports,
      battery: batteryList(),
      options: optionDefs(),
      extensions: SYS === 'alynx' ? { options: true, rotation: true } : { options: true },
      model: SYS === 'alynx' && m2 ? 'alynx-link' : SYS,
      usedFirmware: firmwareUsed,
      /* No visitor note (2026-10-21): the board, region and header reasoning
         read as developer notes. It goes to the developer log instead (details() below, which
         the host writes to its log and the browser console once per load). */
      note: '',
      /* A player's instruction, not a developer note: shown once per game on this device, in
         the play window (host.mjs noticeOnce). TWO-PLAYER SAVEKEY GAMES above. */
      notice: skTwoPlayerApplied() ? { id: 'savekey-2p', text: SK_TWO_PLAYER_NOTE } : m2 ? { id: 'lynx-link', text: LYNX_LINK_NOTE } : null,
    };
  }
  function loadDetails() {
    if (!m) return '';
    const sk = skOn() ? ", a SaveKey on the right port (its memory kept as this game's save)"
      : skTwoPlayerApplied() ? ', the joystick on the right port for player 2 (a two-player game that can also use a SaveKey)' : '';
    if (SYS === 'a2600') return `${m.schemeName(m.scheme)}${arTape ? `, loading from the tape recording (${arTape.bytes} bytes) through your own Supercharger firmware` : ''}${sk}: ${m.schemeReason}`;
    if (SYS === 'a5200') return `${m.boardName(m.board)}, ${firmwareUsed ? 'your own firmware' : "this site's firmware"}: ${m.reason}`;
    if (SYS === 'a7800') {
      const x = m.extras(), parts = [m.boardName(m.board)];
      if (x & (1 | 2 | 4 | 32)) parts.push('POKEY'); if (x & 64) parts.push('YM2151');
      if (m.xm) parts.push(`the XM module (header byte 63; ${hscFw ? 'your own High Score Cartridge program' : 'no High Score Cartridge program'}, its high-score memory kept as this game's save)`);
      return `${parts.join(' + ')}, ${m.region() ? 'PAL' : 'NTSC'}${firmwareUsed ? ', your own BIOS' : ''}${sk}: ${m.reason}`;
    }
    return `${m.reason}, through ${m.bootFirmware()}${m2 ? '; a second Lynx on the ComLynx cable' : ''}`;
  }

  const audioOut = { data: new Float32Array(0), frames: 0 };
  const ch = manifest.audio.channels;

  const core = {
    info: { build: stamp && stamp.sha256 ? stamp.sha256 : null, contextBytes: stamp ? stamp.contextBytes : null },
    load(r) { build(r); return loadResult(); },
    /* The Control Bar's Reset is a power cycle (A3). The cartridge's own memory (the Lynx
       EEPROM, flash) is the cartridge's and survives it. */
    reset() {
      if (!m) return;
      m.powerOn();
      if (m2) { m2.powerOn(); if (m.X.lynx_linked(m.ctx)) m.X.lynx_unlink(m.ctx); p2Wait = LYNX_P2_DELAY; }
      if (kv) m.X.atari_kidvid_set_tapes(m.ctx, 1);   // given again after each power on (atari.h)
      owed = 0; frameDirty = true; audioParts.length = 0; jammed = false;
      timedQ = []; slowSlices = 0; timedOut = false;
    },
    get timedInput() { return timedOk(); },
    setInput(port, s) {
      if (!(port >= 0 && port < inputs.length)) return;
      if (s && s.at > 0 && timedOk()) { timedQ.push([port, s]); return; }
      timedQ = timedQ.filter(e => e[0] !== port);         // an untimed state replaces the port's queue
      inputs[port] = s || { buttons: 0 };
    },
    runFrame() { if (m) { runSlice(); if (cheat) cheat.frame(); } },
    video() {
      if (!m) return null;
      const v = videoInfo();
      return { format: v.format, width: v.width, height: v.height, stride: v.width, data: frame, palette: v.palette, rotation: v.rotation, fill: !!v.fill };
    },
    audio() {
      if (!audioParts.length) { audioOut.frames = 0; return audioOut; }
      let n = 0; for (const a of audioParts) n += a.length;
      const d = audioParts.length === 1 ? audioParts[0] : new Float32Array(n);
      if (audioParts.length > 1) { let o = 0; for (const a of audioParts) { d.set(a, o); o += a.length; } }
      audioParts.length = 0;
      audioOut.data = d; audioOut.frames = n / ch;
      return audioOut;
    },
    serialize() {
      if (!m || !stateBuf) throw new CoreError('unsupported', 'nothing is running');
      m.X[PREFIX[SYS] + '_state_save'](m.ctx, stateBuf);
      if (!m2) return m.u8(stateBuf, stateSize).slice();
      const out = new Uint8Array(8 + 2 * stateSize), dv = new DataView(out.buffer);
      dv.setUint32(0, LYNX_LINK_MAGIC, true); dv.setUint32(4, stateSize, true);
      out.set(m.u8(stateBuf, stateSize), 8);
      m.X.lynx_state_save(m2.ctx, stateBuf);
      out.set(m.u8(stateBuf, stateSize), 8 + stateSize);
      return out;
    },
    check(b) {
      if (!m || !stateBuf) throw new CoreError('unsupported', 'nothing is running');
      const two = !!b && b.length === 8 + 2 * stateSize && new DataView(b.buffer, b.byteOffset, 8).getUint32(0, true) === LYNX_LINK_MAGIC;
      if (SYS === 'alynx' && two && !m2) throw new CoreError('wrong-core', 'This save holds two linked Lynx consoles. Choose Two Lynxes on one cable in Settings, Machine, ComLynx cable to load it.');
      if (SYS === 'alynx' && m2 && b && b.length === stateSize) throw new CoreError('wrong-core', 'This save holds one Lynx. Choose One Lynx in Settings, Machine, ComLynx cable to load it.');
      if (!b || (b.length !== stateSize && !(two && m2))) throw new CoreError('wrong-core', `This save was made by another build of the ${LABEL[SYS]} core (${b ? b.length : 0} bytes, this core's states are ${stateSize}).`);
      return true;
    },
    unserialize(b) {
      core.check(b);
      if (m2) {
        m.u8(stateBuf, stateSize).set(b.subarray(8, 8 + stateSize));
        if (m.X.lynx_state_load(m.ctx, stateBuf) !== 0) throw new CoreError('damaged', 'The core refused this save.');
        m.u8(stateBuf, stateSize).set(b.subarray(8 + stateSize, 8 + 2 * stateSize));
        if (m.X.lynx_state_load(m2.ctx, stateBuf) !== 0) throw new CoreError('damaged', 'The core refused this save.');
        eepromSeen2 = -1;
        if (p2Wait > 0 || !m.X.lynx_linked(m.ctx)) { p2Wait = 0; m.X.lynx_link(m.ctx, m2.ctx); }   // a saved pair plays on linked
      } else {
        m.u8(stateBuf, stateSize).set(b);
        if (m.X[PREFIX[SYS] + '_state_load'](m.ctx, stateBuf) !== 0) throw new CoreError('damaged', 'The core refused this save.');
      }
      owed = 0; frameDirty = true; audioParts.length = 0;
      // The host sends what is held now; nothing is assumed held by the restored machine.
      inputs = ports.map(() => ({ buttons: 0 }));
      if (SYS === 'alynx') eepromSeen = -1;     // the EEPROM in the state may differ from the stored one
    },
    battery: {
      read(id) {
        if (!m) return null;
        if (id === 'eeprom' && SYS === 'alynx') return m.eepromRead();
        if (id === 'eeprom2' && SYS === 'alynx') return m2 ? m2.eepromRead() : null;
        if (id === 'nvram' && SYS === 'a2600') return nvRead();
        if (id === 'hsc' && SYS === 'a7800' && hscOn()) return (hscLast = hscRead());
        if (id === 'savekey' && skOn()) return (skLast = skMem().slice());
        return null;
      },
      write(id, b) {
        if (!m || !b) return false;
        if (id === 'eeprom' && SYS === 'alynx') { m.eepromWrite(b); eepromSeen = m.eepromChanges(); return true; }
        if (id === 'eeprom2' && SYS === 'alynx') { if (!m2) return false; m2.eepromWrite(b); eepromSeen2 = m2.eepromChanges(); return true; }
        if (id === 'nvram' && SYS === 'a2600') {
          const n = m.X.atari_nvram_size(m.ctx); if (b.length !== n) return false;
          m.u8(m.scratch, n).set(b);
          if (m.X.atari_nvram_load(m.ctx, m.scratch, n) !== 0) return false;
          nvClean = new Uint8Array(b); return true;
        }
        if (id === 'hsc' && SYS === 'a7800' && hscOn()) {
          if (b.length !== HSC_BYTES) return false;
          m.u8(m.X.a7800_hsc_ram(m.ctx), HSC_BYTES).set(b);
          hscClean = new Uint8Array(b); return true;
        }
        if (id === 'savekey' && skOn()) {
          if (b.length !== SK_BYTES) return false;
          skMem().set(b);
          skClean = new Uint8Array(b); return true;
        }
        return false;
      },
      dirty() {
        if (!m) return [];
        if (SYS === 'alynx' && m.eepromSize() > 0) return (m.eepromChanges() !== eepromSeen ? ['eeprom'] : [])
          .concat(m2 && m2.eepromSize() > 0 && m2.eepromChanges() !== eepromSeen2 ? ['eeprom2'] : []);
        const out = [];
        if (SYS === 'a2600' && nvClean) {
          const c = nvRead();
          if (c) for (let i = 0; i < c.length; i++) if (c[i] !== nvClean[i]) { out.push('nvram'); break; }
        }
        if (SYS === 'a7800' && hscClean && hscOn()) {
          const c = m.u8(m.X.a7800_hsc_ram(m.ctx), HSC_BYTES);
          for (let i = 0; i < HSC_BYTES; i++) if (c[i] !== hscClean[i]) { out.push('hsc'); break; }
        }
        if (skClean && skOn()) {
          const c = skMem();
          for (let i = 0; i < SK_BYTES; i++) if (c[i] !== skClean[i]) { out.push('savekey'); break; }
        }
        return out;
      },
      clean(id) {
        if (!m) return;
        if (id === 'eeprom' && SYS === 'alynx') eepromSeen = m.eepromChanges();
        if (id === 'eeprom2' && SYS === 'alynx' && m2) eepromSeen2 = m2.eepromChanges();
        if (id === 'nvram' && SYS === 'a2600') nvClean = nvRead();
        /* What was last read (and so saved) becomes the clean copy, not the memory now: a write
           between the read and this call then still shows as a change. */
        if (id === 'hsc' && SYS === 'a7800' && hscOn()) hscClean = hscLast || hscRead();
        if (id === 'savekey' && skOn()) skClean = skLast || skMem().slice();
      },
    },
    /* Options: the switches change at once; a controller change re-plugs the port (the
       host takes the new port list); the region and the firmware apply at the next start. */
    setOption(id, v) {
      opts[id] = v;
      if (req) req.options[id] = v;
      if (/^(diffL|diffR|colour)$/.test(id)) { sw.bits = switchBits(); return 'live'; }
      if (id === 'ctrlL' || id === 'ctrlR') {
        if (!m) return 'live';
        /* Plugging the SaveKey in or out changes the game's saves: the game restarts (the host
           writes the memory first and puts it back after the load). */
        if (id === 'ctrlR' && (SYS === 'a2600' || SYS === 'a7800') && ports[1] && (ports[1].kindName === 'savekey') !== ((SYS === 'a2600' ? kindOf2600(v, 1) : kind7800(1, v)) === 'savekey')) return 'reload';
        ports = buildPorts(); inputs = ports.map(() => ({ buttons: 0 })); setControllers();
        env.emit('ports', ports);
        return 'ports';
      }
      if (id === 'turn') { if (m) { turn = turnFor(); frameDirty = true; env.emit('video', { art: true }); } return 'art'; }
      if (id === 'region' || id === 'bios' || id === 'console' || id === 'link') return 'reload';
      return 'unknown';
    },
    options: optionDefs,
    ports: () => ports,
    ext: Object.assign({
      /* Cheats: the kinds this build runs ([] before the cheat build is installed) and the codes switched on. */
      cheats: {
        kinds: () => { const e = cheatEng(); return e ? e.kinds() : []; },
        apply: codes => { const e = cheatEng(); return e ? e.apply(codes) : { ok: false, why: 'This player has no cheat support yet.' }; },
      },
    }, SYS === 'alynx' ? {
      rotation: { current: () => turn, next: () => String((turn + 1) % 3), option: 'turn' },
    } : SYS === 'a2600' ? {
      crosshair,
      /* The host holds the pointer for a port that says pointerLock (a Trak-Ball or a mouse) and hands over its motion. */
      trackball: {
        lock(on) { held2600.on = !!on; held2600.dx = held2600.dy = 0; held2600.b = held2600.lb = 0; },
        move(dx, dy) { if (held2600.on) { held2600.dx += dx; held2600.dy += dy; } },
        button(bit, down) { if (!held2600.on) return; if (down) { held2600.b |= bit; held2600.lb |= bit; } else held2600.b &= ~bit; },
      },
    } : SYS === 'a7800' ? {
      crosshair,
    } : SYS === 'a5200' ? {
      /* The host locks the pointer (a double click on the picture) and hands over its motion. */
      trackball: {
        lock(on) { ball.on = !!on; ball.dx = ball.dy = 0; ball.b = ball.lb = 0; },
        move(dx, dy) { if (ball.on) { ball.dx += dx; ball.dy += dy; } },
        button(bit, down) { if (!ball.on) return; if (down) { ball.b |= bit; ball.lb |= bit; } else ball.b &= ~bit; },
      },
    } : {}),
    get model() { return SYS === 'alynx' && m2 ? 'alynx-link' : SYS; },
    details() { try { return 'cartridge: ' + loadDetails(); } catch (_) { return ''; } },
    get note() { return ''; },
    noteGroup: 'machine',
    get frames() { try { return m ? Number(m.X[PREFIX[SYS] + '_frame_count'](m.ctx)) : 0; } catch (_) { return 0; } },
    get turn() { return turn; },
    get machine() { return m; },
    /* For tests and diagnosis: what the controllers last handed the core (read only). */
    get diag() { return { paddle: paddle.slice(), wheel: wheel.slice(), keypad: keypadSent.slice(), switches: sw.bits, turn, owed: Math.round(owed),
      gun: gun.map(g => ({ x: g.x, y: g.y, down: g.down })), mindlink: mind.slice(), snes: snesSent.slice() }; },
    destroy() { m = null; spare = null; },
  };
  return core;
}
