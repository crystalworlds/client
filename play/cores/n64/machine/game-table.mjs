// Looks a game up in the table of what its cartridge holds: the save memory, and the accessories the
// game uses. One rule, shared by everything that loads a game (tables/README.md states it in full):
//
//   1. the SHA-256 of the whole file, taken after its byte order is made big-endian;
//   2. the game id with its destination and revision, then with its destination;
//   3. the header a home-made program uses to say what it needs;
//   4. the game id alone, which is marked as not certain, because one id can hold different chips;
//   5. not in the table: no save chip, and the answer says so, so the page can tell the player.

// It imports no part of Node: the tables come to it as text (tools/game-table.mjs reads them from the disk).

export const SAVES = ["none", "eeprom-4k", "eeprom-16k", "sram-256k", "sram-768k", "sram-1m", "flash-1m"];
export const LEVELS = ["file hash", "id, destination and revision", "id and destination", "home-made header", "id alone", "not in the table"];

const readTsv = (text) => {
  const lines = String(text).split(/\r?\n/).filter((l) => l.length);
  const head = lines[0].split("\t");
  return lines.slice(1).map((l) => Object.fromEntries(l.split("\t").map((v, i) => [head[i], v])));
};
const yes = (v) => v === "yes";
const facts = (r) => ({ save: r.save, flashChip: r.flash_chip === "-" ? null : r.flash_chip, controllerPak: yes(r.controller_pak), rumblePak: yes(r.rumble_pak), transferPak: yes(r.transfer_pak), clock: yes(r.clock) });

// The three tables' files, by the names they have in tables/.
export const TABLE_FILES = { byId: "save-types.tsv", byHash: "save-by-hash.tsv", chipsSeen: "flash-chips-seen.tsv" };
// The tables from their files' text: texts is { "save-types.tsv": text, ... }. A file not given is said by name.
export function tablesFromText(texts) {
  const out = {};
  for (const [key, name] of Object.entries(TABLE_FILES)) {
    if (typeof texts?.[name] !== "string") throw Object.assign(new Error(`the game table's file ${name} was not given`), { code: "ENOENT", table: name });
    out[key] = readTsv(texts[name]);
  }
  return out;
}

// The same tables as rows already read, for a host that is given them as JSON (the site's server gives no .tsv):
// rows is { "save-types.json": [ {column: value} ], "save-by-hash.json": [...], "flash-chips-seen.json": [...] },
// each made from its .tsv of tables/, which stays the source (tools/site-lib.mjs makes them and checks they agree).
export const TABLE_JSON = { byId: "save-types.json", byHash: "save-by-hash.json", chipsSeen: "flash-chips-seen.json" };
export function tablesFromRows(rows) {
  const out = {};
  for (const [key, name] of Object.entries(TABLE_JSON)) {
    if (!Array.isArray(rows?.[name])) throw Object.assign(new Error(`the game table's file ${name} was not given`), { code: "ENOENT", table: name });
    out[key] = rows[name];
  }
  return out;
}

// Which FlashRAM chips a public list of markings reports for a game's cartridges (tables/README.md): the
// chips of every row of the game's id that speaks of the key's destination, or null where the list is
// silent. One game was made with more than one chip, so this names what was seen, not what a file holds.
export function chipsSeen(tables, key) {
  const rows = (tables.chipsSeen ?? []).filter((r) => r.id === key.id && (r.destinations === "*" || r.destinations.includes(key.destination)));
  return rows.length ? [...new Set(rows.flatMap((r) => r.chips_seen.split(" ")))].join(" ") : null;
}

// The four bytes of the header that name a game: the kind of cartridge and the game's two letters (the
// id), where it was sold (the destination), and its revision. The file must be in big-endian order.
export function gameKey(file) {
  if (file.length < 0x40) throw new Error("a game file has at least a 64-byte header");
  return { id: String.fromCharCode(file[0x3b], file[0x3c], file[0x3d]), destination: String.fromCharCode(file[0x3e]), revision: file[0x3f] };
}

const inRange = (spec, rev) => { if (spec === "*") return false; const [lo, hi] = spec.split("-").map(Number); return rev >= lo && rev <= hi; };
// What a home-made program's header says, by the convention its makers agreed on: the id ends in "ED",
// the top four bits of the revision byte name the save memory, bit 0 asks for the clock, bit 1 says the
// program runs on a console of any region.
const HOME_MADE = [null, "eeprom-4k", "eeprom-16k", "sram-256k", "sram-768k", "flash-1m", "sram-1m"];

export function lookUp(tables, key, sha256 = null) {
  const answer = (level, f, more = {}) => ({ ...f, flashChipsSeen: f.save === "flash-1m" ? chipsSeen(tables, key) : null, level, certain: level !== "id alone" && level !== "not in the table" && (more.agree ?? "both") === "both", ...more });
  if (sha256) {
    const h = tables.byHash.find((r) => r.sha256 === sha256.toLowerCase());
    if (h) return answer("file hash", facts(h), { agree: "both", basis: h.basis });
  }
  const mine = tables.byId.filter((r) => r.id === key.id);
  const exact = mine.find((r) => r.destination === key.destination && inRange(r.revision, key.revision));
  if (exact) return answer("id, destination and revision", facts(exact), { agree: exact.agree, title: exact.title });
  const there = mine.find((r) => r.destination === key.destination && r.revision === "*");
  if (there) return answer("id and destination", facts(there), { agree: there.agree, title: there.title });
  if (key.id[1] === "E" && key.id[2] === "D") {
    const kind = HOME_MADE[key.revision >> 4];
    return answer("home-made header", { save: kind ?? "none", flashChip: null, controllerPak: false, rumblePak: false, transferPak: false, clock: (key.revision & 1) === 1 },
      { agree: "both", anyRegion: (key.revision & 2) === 2, unknownKind: kind === undefined });
  }
  const any = mine.find((r) => r.destination === "*");
  if (any) return answer("id alone", facts(any), { agree: any.agree, title: any.title });
  return answer("not in the table", { save: "none", flashChip: null, controllerPak: false, rumblePak: false, transferPak: false, clock: false });
}

// What is in the first controller's slot when a game starts, by the owner's ruling for the site: a Controller Pak,
// unless the game is known to misbehave with one (PAK_NONE, by the file's SHA-256: none so far, for the third library
// survey ran every title with and without a Controller Pak and saw no game stop or tear with one that did not without);
// a Rumble Pak instead only where the game table says the game supports it and does not use the Controller Pak (its
// columns controller_pak and rumble_pak, from the public lists tables/README.md names). A game that uses both keeps the
// Controller Pak, where its saves go; a row that does not say keeps the Controller Pak.
export const PAK_NONE = new Set([]);
export const defaultPak = (row, sha256 = null) => (sha256 && PAK_NONE.has(sha256) ? "none" : row && row.rumblePak && !row.controllerPak ? "rumble" : "controller");
