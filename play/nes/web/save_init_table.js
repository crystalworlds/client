/* save_init_table.js -- THE FRESH SAVE: one default, and a per-cartridge table for the rest.
 *
 *
 * THE DESIGN (2026-10-11): "a DEFAULT fresh-save state that covers most
 * games, plus a PER-GAME TABLE keyed by hash for the games that need a different initial save state.  A dump
 * captures the program chip but not the save chip's initial contents, so those must be supplied from a table."
 * Each row records its evidence and its board type (battery RAM or Bandai EEPROM).
 *
 * THE DEFAULT: a battery cartridge's work RAM with no save yet starts at $00 (SAVE_INIT_DEFAULT).  That is the
 * value the library already runs under and the one that suits most: a library sweep
 * found $FF a net loss.  LABEL: FITTED (the contents of a fresh SRAM are NOT
 * ESTABLISHED, the reset-state notes, section 3), chosen by count, not derived.
 *
 * THE KEY: the CRC-32 of everything after the header and trainer -- the same content key as web/hdr_table.js,
 * computed once by every loader.  A row names one exact file content, so it applies under any header.
 *
 * A ROW IS ONE OF:
 *   board 'ram'           a battery-RAM board: `fill` is the fresh save's byte for this cartridge.  FITTED per row;
 *                         the row's evidence says what the program reads and why the default fails it.  Optional
 *                         `mapper`/`sub`: the battery-RAM board itself, for a dump whose header names the wrong one
 *                         (an overdump or bad dump the header table has no row for); its evidence says how.
 *   board 'x24c01'        a Bandai LZ93D50 board with an X24C01 serial EEPROM (mapper 159), and
 *   board '24c02'         one with a 24C02 (mapper 16 submapper 5): the cartridge is SEATED on that board.  The
 *                         fresh state is then the core's erased part ($FF, src/nes_mapper.inc), which is
 *                         MECHANISM; the row's evidence is how the board was identified (the clean dump's database
 *                         row, matched by content).
 *
 * THE RULE, identical in test/hdr_fix.h save_init_apply() (both native loaders, from test/save_init.inc, which
 * tools/save_init_table.mjs --c emits from THIS file at build time) and web/core.js parseINES()/loadCartridge():
 *   - after the header-correction table; no row: nothing changes, and a battery board's RAM starts at the default;
 *   - an EEPROM row: mapper and submapper become the board's, the battery bit is set (the part is non-volatile);
 *   - a 'ram' row: the battery bit is set and the fresh save's byte is the row's `fill`; with `mapper`, the
 *     cartridge is seated on that board as well;
 *   - a restored save always overwrites the fresh state (web/store.js, nes_battery_load).
 * SWITCH: SAVE_INIT.enabled = false here, NES_R19_SAVE_INIT=0 natively: no table (the default still applies).
 * tools/save_init_table.mjs --check refuses an unsorted or duplicated key, an unknown board, a board whose mapper
 * does not match it, or a row with no evidence.
 */
export const SAVE_INIT = { enabled: true };
export const SAVE_INIT_DEFAULT = 0x00;
export const SAVE_INIT_BOARDS = { ram: null, x24c01: { mapper: 159, sub: 0 }, '24c02': { mapper: 16, sub: 5 } };

/* Sorted by crc.  `size` is the content length the CRC covers (a second check on the key). */
export const SAVE_INIT_ROWS = [
  { crc: 0x0D2488B4, size: 786448, board: 'x24c01', title: 'Magical Taruruuto-kun 2 - Mahou Daibouken (J) [o1]',
    evidence: 'an overdump on a 16.0 header with no database row; its declared program and character parts are byte-identical to the clean dump (B7F28915), whose row is 159 (X24C01). On 16.0 the core lends work RAM and the EEPROM read (D4 of $6000-$7FFF) came from it, so $00 acknowledged and $FF did not: draws on 159 under either fill (saveprobe, 2026-10-17).' },
  { crc: 0x2EAF885A, size: 786448, board: 'x24c01', title: 'Magical Taruruuto-kun - Fantastic World!! (J) (V1.1) [o1]',
    evidence: 'overdump; declared parts byte-identical to V1.1 [!] (DCB972CE), row 159 (X24C01); draws on 159 under either fill (saveprobe, 2026-10-17).' },
  { crc: 0x3F15D20D, size: 524288, board: 'ram', fill: 0xFF, title: 'Famicom Jump II - Saikyou no 7 Nin (J) [!]',
    evidence: 'Bandai LZ93D50 with 8 KB battery SRAM (mapper 153, the header table\'s row). Delta debugging over the 8 KB save ($00 against $FF) narrows the start-up to ONE byte, $6B77, read before anything writes it: $00 BLANK (the program jams), $01-$FF draw. The NESdev wiki records "freezes if SRAM is all $00" as a real-hardware bug of the game. FITTED: any non-zero byte draws; $FF is the chosen value.' },
  { crc: 0x484083AE, size: 1048592, board: 'ram', fill: 0xFF, title: 'Silva Saga (J) [o1]',
    evidence: 'a save-select screen that trusts all-zero slots: under a $00 fresh save the program lists three saved games at level 1 and loading one gives a broken map; under $FF, and under a pseudo-random fill, all three slots are empty, as on a new cartridge (site loader screenshots at frame 600 after two Start presses, 29 Oct 2026). FITTED: any fill whose slots fail the check the program makes; $FF is the value chosen for fresh saves and agrees with the random arm. An overdump of the same program; same three bogus slots under $00.' },
  { crc: 0x6B393C12, size: 393216, board: 'x24c01', title: 'SD Gundam Gaiden - Knight Gundam Monogatari (J) (V1.0) [T+Eng0.10_Assassin_Productions]',
    evidence: 'a translation of V1.0 [!] (E170404C, row 159, X24C01; same sizes, 4,273 bytes differ); a translation patch does not change the board. Draws on 159 under either fill (saveprobe, 2026-10-17).' },
  { crc: 0x900E3A23, size: 524288, board: 'ram', fill: 0xFF, title: 'Silva Saga (J)',
    evidence: 'a save-select screen that trusts all-zero slots: under a $00 fresh save the program lists three saved games at level 1 and loading one gives a broken map; under $FF, and under a pseudo-random fill, all three slots are empty, as on a new cartridge (site loader screenshots at frame 600 after two Start presses, 29 Oct 2026). FITTED: any fill whose slots fail the check the program makes; $FF is the value chosen for fresh saves and agrees with the random arm.' },
  { crc: 0xB959D69A, size: 1048592, board: '24c02', title: 'SD Gundam Gaiden - Knight Gundam Monogatari 2 - Hikari no Kishi (J) [o1]',
    evidence: 'overdump; declared parts byte-identical to [!] (B049A8C4), row 16.5 (24C02); draws on 16.5 under either fill (saveprobe, 2026-10-17).' },
  { crc: 0xCBADBCD3, size: 1048592, board: '24c02', title: 'SD Gundam Gaiden - Knight Gundam Monogatari 3 - Densetsu no Kishi Dan (J) [o1]',
    evidence: 'overdump; declared parts byte-identical to [!] (C2840372), row 16.5 (24C02); draws on 16.5 under either fill (saveprobe, 2026-10-17).' },
  { crc: 0xE4F8B4FE, size: 786432, board: 'ram', fill: 0xFF, title: 'Silva Saga (Japan) [T-En by Aishsha v1.01]',
    evidence: 'a save-select screen that trusts all-zero slots: under a $00 fresh save the program lists three saved games at level 1 and loading one gives a broken map; under $FF, and under a pseudo-random fill, all three slots are empty, as on a new cartridge (site loader screenshots at frame 600 after two Start presses, 29 Oct 2026). FITTED: any fill whose slots fail the check the program makes; $FF is the value chosen for fresh saves and agrees with the random arm. A translation; same three bogus slots under $00.' },
  { crc: 0xEC9E30FD, size: 393216, board: 'x24c01', title: 'SD Gundam Gaiden - Knight Gundam Monogatari (J) (V1.0) [b1]',
    evidence: 'a bad dump of V1.0 [!] (E170404C, row 159, X24C01): program identical, 66 character bytes differ. Draws on 159 under either fill (saveprobe, 2026-10-17).' },
  { crc: 0xF5285951, size: 1048592, board: 'ram', fill: 0xFF, mapper: 153, sub: 0, title: 'Famicom Jump II - Saikyou no 7 Nin (J) [o1]',
    evidence: 'an overdump on a 16.0 header with no header-table row; its declared 512 KB program is byte-identical to [!] (3F15D20D, row 153 with 8 KB SRAM). On 16.0 it JAMS under $00 and is BLANK under $FF; seated on 153 it is BLANK under $00 and draws under $FF, as [!] (saveprobe, 2026-10-17). Fill as [!].' },
  { crc: 0xF76AA523, size: 524288, board: 'ram', fill: 0xFF, mapper: 153, sub: 0, title: 'Famicom Jump II - Saikyou no 7 Nin (J) [b1]',
    evidence: 'a bad dump of [!] (14 program bytes differ) on a 16.0 header with no header-table row. On 16.0 JAMMED / BLANK; on 153 BLANK under $00 and draws under $FF, as [!] (saveprobe, 2026-10-17). Board and fill as [!].' },
];

export function saveInitLookup(crc, size) {
  let lo = 0, hi = SAVE_INIT_ROWS.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1, r = SAVE_INIT_ROWS[mid];
    if (r.crc === crc) return (size === undefined || r.size === size) ? r : null;
    if (r.crc < crc) lo = mid + 1; else hi = mid - 1;
  }
  return null;
}
