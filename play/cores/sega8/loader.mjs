/* host/loader.mjs: the one loading rule, shared by the page, the native
 * tools and the library sweep (brief section 7).
 *
 *   key      SHA-256 of the game data, a 512-byte copier header removed
 *            first when the size modulo 1024 is 512 (REG-0142).
 *   row      the per-hash table's row for that key (data/per-hash-table.tsv).
 *   board    the table's mapper value; where the table has none, the guess
 *            below, labelled "guessed" (REG-0141). The loader sweep checks
 *            every guess against what the program does.
 *
 * Works in Node and in the browser (WebCrypto). Never logs game bytes.
 */

export const BOARDS = ["plain", "sega", "sega-shift", "codemasters", "korean", "msx", "nemesis",
  "janggun", "sg-ram", "taiwan-a", "taiwan-b", "eeprom", "terebi", "multicart", "display-unit", "msx-16k",
  /* the multi-game boards (S8DEV4, 22 Nov 2026), named by their register places */
  "kr-ffff-hicom", "pak4", "kr-2000-xor-1f", "kr-msx-8kb-0300", "kr-fffe", "kr-bffc", "kr-md-fff5", "kr-md-fff0", "kr-sms-32kb-2000", "kr-fff3-fffc", "kr-msx-sms-8000", "kr-0000-xor-ff", "kr-msx-32kb-2000"];
export const BOARD_ID = Object.fromEntries(BOARDS.map((n, i) => [n, i]));
/* Boards whose mapping this core builds now; the rest are known and named,
 * and are built in a later stage (the loader still names them). */
export const BOARD_BUILT = new Set(["plain", "sega", "sega-shift", "codemasters", "korean", "msx",
  "nemesis", "janggun", "sg-ram", "taiwan-a", "taiwan-b", "eeprom", "msx-16k", "terebi",
  "kr-ffff-hicom", "pak4", "kr-2000-xor-1f", "kr-msx-8kb-0300", "kr-fffe", "kr-bffc", "kr-md-fff5", "kr-md-fff0", "kr-sms-32kb-2000", "kr-fff3-fffc", "kr-msx-sms-8000", "kr-0000-xor-ff", "kr-msx-32kb-2000"]);
export const BOARD_STAGE = {
  multicart: "a multi-game board no table names", "display-unit": "not built (store display unit)" };

/* The table's mapper words, as build_table.py writes them. */
const TABLE_BOARD = { sega: "sega", "sega-x": "sega", codemasters: "codemasters", korean: "korean",
  msx: "msx", nemesis: "nemesis", janggun: "janggun", multicart: "multicart", eeprom: "eeprom",
  "sg-ram": "sg-ram", "taiwan-a": "taiwan-a", "taiwan-b": "taiwan-b", terebi: "terebi", none: "plain",
  "display-unit": "display-unit", "msx-16k": "msx-16k",
  ...Object.fromEntries(["kr-ffff-hicom", "pak4", "kr-2000-xor-1f", "kr-msx-8kb-0300", "kr-fffe", "kr-bffc", "kr-md-fff5", "kr-md-fff0", "kr-sms-32kb-2000", "kr-fff3-fffc", "kr-msx-sms-8000", "kr-0000-xor-ff", "kr-msx-32kb-2000"].map(n => [n, n])) };

export function stripCopierHeader(bytes) {
  return bytes.length % 1024 === 512 ? { data: bytes.subarray(512), stripped: true } : { data: bytes, stripped: false };
}

export async function sha256Hex(bytes) {
  const c = globalThis.crypto?.subtle ? globalThis.crypto : (await import("node:crypto")).webcrypto;
  const d = await c.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(d)].map(b => b.toString(16).padStart(2, "0")).join("");
}

/* Parse data/per-hash-table.tsv into a Map keyed by sha256. */
export function parseTable(tsvText) {
  const lines = tsvText.split(/\r?\n/).filter(Boolean);
  const head = lines[0].split("\t");
  const map = new Map();
  for (const l of lines.slice(1)) {
    const f = l.split("\t");
    const r = {};
    head.forEach((h, i) => { r[h] = f[i] ?? ""; });
    map.set(r.sha256, r);
  }
  return map;
}

/* The Codemasters header at $7FE0: bank count, build date, a checksum and
 * its complement (they add to $10000), REG-0025. All three must agree. */
export function codemastersHeader(d) {
  if (d.length < 0x8000) return false;
  const banks = d[0x7FE0];
  const sum = d[0x7FE6] | (d[0x7FE7] << 8);
  const inv = d[0x7FE8] | (d[0x7FE9] << 8);
  if (((sum + inv) & 0xFFFF) !== 0 || sum === 0) return false;
  return banks === Math.ceil(d.length / 16384);
}

/* The board guess, used only where the table has no mapper value. */
export function guessBoard(device, d) {
  if (device === "sg1000") return { board: "plain", why: "SG-1000 cartridge: no mapper (guessed)" };
  if (codemastersHeader(d)) return { board: "codemasters", why: "Codemasters header at $7FE0 (guessed)" };
  return { board: "sega", why: d.length > 49152 ? "larger than 48 KB: Sega mapper (guessed)"
    : "48 KB or less: Sega mapper, harmless when unused (guessed)" };
}

/* The table's model words to the core's Machine ids (every Master System-family record; the Game
 * Gear and SG-1000 words join with their stages). */
const MODEL_OF = { "Master System (NTSC)": "sms1-ntsc", "Master System (PAL)": "sms1-pal",
  "Master System II (NTSC)": "sms2-ntsc", "Master System II (PAL)": "sms2-pal",
  "Japanese Master System": "smsj", "Mark III": "mark3", "Mark III with the FM Sound Unit": "mark3-fm",
  "Game Gear": "gg", "Game Gear (Master System mode)": "gg",
  "Japanese Game Gear": "gg-jp", "Japanese Game Gear (Master System mode)": "gg-jp",
  "SG-1000": "sg1000", "SG-1000 II": "sg1000-2", "SG-1000 II (later one-chip board)": "sg1000-2b",
  "SG-1000 II (PAL)": "sg1000-2-pal", "Othello Multivision": "omv" };

/* One file to a load decision. device: the wall device from the folder
 * (sg1000, sms, gg). Returns every value with where it came from. */
/* data/board-settled.tsv: boards settled by a run on every candidate board,
 * used only where the table's cell is DISPUTED (never over a table value). */
export function parseSettled(tsvText) { return parseTable(tsvText); }

export async function decide(fileBytes, device, table, settled = null) {
  const { data, stripped } = stripCopierHeader(fileBytes);
  return decideKey(await sha256Hex(data), data, stripped, device, table, settled);
}
/* The same decision when the key is already known (the site's play host hashes the file before
 * the core loads it, and a core loads without waiting). data: the file with any copier header removed. */
export const FW_PREFS = new Set(["none", "ours", "sms1", "sms2", "smsj", "gg", "smsk"]);
export function decideKey(key, data, stripped, device, table, settled = null) {
  const row = table.get(key) || null;
  const out = { key, stripped, size: data.length, device, row: !!row, name: row?.name ?? null };
  let tb = row && row.mapper && !row.mapper.startsWith("DISPUTED") ? TABLE_BOARD[row.mapper] : null;
  if (row?.mapper?.startsWith("DISPUTED")) out.disputed_mapper = row.mapper;
  /* A settled board (data/board-settled.tsv) is used where the table's cell is disputed, and also
   * over a table value when it was settled against exactly that value (a contradicted one-source
   * cell, S8-M007): the row's table_cell names the cell it answers. */
  const st0 = settled ? settled.get(key) : null;
  if (tb && st0 && row && st0.table_cell === row.mapper) { out.table_board = tb; tb = null; }
  const st = !tb ? st0 : null;
  if (tb) { out.board = tb; out.board_src = "table"; }
  else if (st) { out.board = st.board; out.board_src = "settled"; out.board_why = st.label; }
  else {
    const g = guessBoard(device, data);
    out.board = g.board; out.board_src = "guessed"; out.board_why = g.why;
  }
  out.board_built = BOARD_BUILT.has(out.board);
  if (!out.board_built) out.board_stage = BOARD_STAGE[out.board];
  /* Cartridge RAM and battery (REG-0137): the table's values; where it is
   * silent, 32 KB of RAM is fitted, labelled guessed, and no battery is
   * assumed until the sweep shows the program maps the RAM. */
  const sram = row?.sram ? Number(row.sram) : 0;
  const noRam = row?.sram === "0";     /* the table says: no cartridge RAM (measured, data/measured-claims.tsv) */
  out.cart_ram = sram || (out.board === "sg-ram" ? 8192 : out.board === "taiwan-a" ? 8192 : 0);
  out.cart_ram_src = sram || noRam ? "table" : out.cart_ram ? "board" : "none";
  if (!noRam && !out.cart_ram && (out.board === "sega" || out.board === "codemasters")) { out.cart_ram = 32768; out.cart_ram_src = "guessed"; }
  /* Battery: the table's value. Where the table is silent on a board that
   * can carry battery RAM (Sega, Codemasters), a battery is assumed (FITTED, labelled guessed): the
   * host writes a file only if the game itself writes cartridge RAM, and
   * losing a player's save is the worse error. The files this touches are
   * listed by the loader sweep (cart RAM mapped, battery guessed) to be
   * settled from board photographs or SMS Power's lists. */
  if (row?.battery === "yes" || row?.battery === "no") { out.battery = row.battery === "yes"; out.battery_src = "table"; }
  else if (out.cart_ram && (out.board === "sega" || out.board === "codemasters")) { out.battery = true; out.battery_src = "guessed"; }
  else { out.battery = false; out.battery_src = "none"; }
  out.medium = row?.medium === "card" ? "card" : "cartridge";
  out.model_default = row?.model_default ?? null;
  /* The Game Gear's Master System pin (REG-0072): the table's gg_mode column
   * ("SMS" for the 24 Game Gear files that are Master System programs).
   * Only meaningful on the gg device; nothing in the file says it. */
  out.gg_sms = device === "gg" && (row?.gg_mode === "SMS" || /Master System mode/.test(row?.model_default || ""));
  out.gg_sms_src = device === "gg" && row?.gg_mode ? "table" : "none";
  if (out.board === "eeprom") { out.cart_ram = 128; out.cart_ram_src = "board"; out.battery = true; out.battery_src = "board"; }
  out.model = MODEL_OF[row?.model_default] ?? null;
  out.dump = row?.dump ?? null;
  /* Controllers follow the cartridge (REG-0114): the table's accessory columns, "requires" kept
   * apart from "supports"; accessory_unsplit is a tag that does not say which (read as supports). */
  const list = v => String(v || "").split(",").map(x => x.trim()).filter(Boolean);
  out.requires = list(row?.requires);
  /* The preferred start-up firmware (20 Nov 2026): the table's fw_pref, from a measured or
   * documented claim only: "none", "ours" or a firmware role (sms1, sms2, smsj, gg, and smsk, Samsung's Korean one). null: the default
   * machine's own firmware. Never set to get past a real console's refusal. */
  out.fw_pref = FW_PREFS.has(row?.fw_pref) ? row.fw_pref : null;
  out.supports = list(row?.supports).concat(list(row?.accessory_unsplit));
  return out;
}
