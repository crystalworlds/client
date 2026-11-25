// Which start a game takes, by the site's rule for a game's preferred firmware. It imports nothing and touches no
// machine: the site's core module (site/play/cores/n64/core.mjs) and the play page's worker ask it, and tell it which
// images they were given and whether each hands over.
//
// THE SITE'S NAMES ARE KEPT HERE AND NOWHERE ELSE. The site keeps a game's preferred firmware as the column fw_pref
// of a per-hash site table (one row a game file, by its SHA-256, under a list of column names), its values "none",
// "ours" or a named image. The N64's table is written in the same manner under the format named below, with the
// fewest columns the core needs from its host: fw_pref, and pak (what is in the controller's slot when the game starts:
// "controller" or "rumble", by defaultPak of shared/game-table.mjs; "none" when the player takes it out), which the host
// gives the core as its pak option.
// The save memory and the television type are not columns: the core finds both itself, by the file's hash and header.
// The layout beyond fw_pref is to be confirmed against the site's tables. Change a name here, once, and
// everything of this folder that writes or reads it follows (core.mjs, the lists, the checks).
export const PREFERRED_FIELD = "fw_pref";
export const SITE_TABLE_FORMAT = "n64-site-table/1";
export const SITE_TABLE_COLS = ["pak", PREFERRED_FIELD];
// The values the field takes, in the site's three kinds: no preference, this core's own start, or a named image
// (a firmware slot's id below).
export const NONE = "none", OURS = "ours";

// The three boot firmware images, one for each television type, as the firmware slots of the core's manifest.
// The site never serves one; the user gives their own (or their own game server does).
export const SLOTS = [
  { id: "pif-ntsc", tv: 1, label: "Nintendo 64 boot firmware for Japan and the USA (NTSC)", required: "never" },
  { id: "pif-pal", tv: 0, label: "Nintendo 64 boot firmware for Europe and Australia (PAL)", required: "never" },
  { id: "pif-mpal", tv: 2, label: "Nintendo 64 boot firmware for Brazil (MPAL)", required: "never" },
];
export const slotOfTv = (tv) => SLOTS.find((s) => s.tv === tv)?.id ?? null;

// The destination letters of the header whose console's television type is known, as the opening code reads them
// (shared/open-game.mjs: the PAL letters, Brazil's MPAL letter, and the NTSC regions). Any other letter, a test
// program's or a home-made one's, says no region: such a game has no preferred value.
const PAL_LETTERS = "DFHILPSUWXYZ", MPAL_LETTERS = "B", NTSC_LETTERS = "ACEGJKN";
export function regionOf(destination) {
  if (typeof destination !== "string" || destination.length !== 1) return null;
  if (PAL_LETTERS.includes(destination)) return 0;
  if (MPAL_LETTERS.includes(destination)) return 2;
  if (NTSC_LETTERS.includes(destination)) return 1;
  return null;
}
// The region of a game only SETS the value: a PAL game prefers the European image, an NTSC one the image for Japan
// and the USA, an MPAL one the Brazilian. A game with no region has none.
export const preferredOf = (destination) => { const tv = regionOf(destination); return tv === null ? NONE : slotOfTv(tv); };

// The start to take. `preferred` is the value (a slot's id, NONE or OURS); `given` the slots whose image the user
// has; `handsOver(slot, tv)` whether that image starts this game as a console of television type tv. Answers
// { way, slot, tv } (ownWorks and withoutWorks may be asked as calls, so a start is tried only when needed): way "firmware" (that slot's image, as tv), "ours" (this core's stand-in, with its own loader
// and the firmware's time), "without" (the stand-in as it is), or "tell" (nothing can start it: the user is told).
//
// With a preferred image: that image if the user has it and it hands over; otherwise ours, without a word. Never
// another region's image, never a refusal, and the answer is not kept or shown.
// With no preferred value, the site's five steps: the authentic original (the image of the type the game would run
// as), then any image of the maker's that works, then ours, then starting without, then telling the user.
export function chooseStart({ preferred, given = [], handsOver = () => false, ownWorks = true, withoutWorks = true, gameTv = 1 }) {
  const has = (id) => given.includes(id);
  if (preferred && preferred !== NONE && preferred !== OURS) {
    const slot = SLOTS.find((s) => s.id === preferred);
    if (slot && has(slot.id) && handsOver(slot.id, slot.tv)) return { way: "firmware", slot: slot.id, tv: slot.tv };
    return { way: "ours", slot: null, tv: slot ? slot.tv : gameTv };
  }
  if (preferred === OURS) return { way: "ours", slot: null, tv: gameTv };
  const original = slotOfTv(gameTv);
  if (original && has(original) && handsOver(original, gameTv)) return { way: "firmware", slot: original, tv: gameTv };
  for (const s of SLOTS) if (s.id !== original && has(s.id) && handsOver(s.id, s.tv)) return { way: "firmware", slot: s.id, tv: s.tv };
  const yes = (v) => (typeof v === "function" ? v() : !!v);
  if (yes(ownWorks)) return { way: "ours", slot: null, tv: gameTv };
  if (yes(withoutWorks)) return { way: "without", slot: null, tv: gameTv };
  return { way: "tell", slot: null, tv: gameTv };
}
