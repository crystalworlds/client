/* unif_boards.js — THE UNIF BOARD TABLE, and it is the only copy.
 *
 * test/native_main.c and test/boot_sweep_main.c do not carry their own: the
 * native builds GENERATE test/unif_boards.inc from this file at build time
 * (tools/unif_table.mjs --c), the same way the opcode table is generated, so
 * the three loaders cannot disagree about a board.  tools/unif_parity.mjs
 * then diffs the JS and C loaders over every UNIF file in the library.
 *
 * WHY A SECOND CONTAINER EXISTS AT ALL.
 *
 * A local library holds 16,384 cartridge files.  16,232 are iNES and THE
 * OTHER 152 ARE UNIF, and until then not one of them could be
 * loaded by anything here.  MEASURED 2026-10-02 by classifying on CONTENT
 * (tools/unif_census.mjs): 148 end in `.unf` and FOUR WEAR `.nes` -- two
 * copies of Drip (UNL-DRIPGAME) and two multicarts (BMC-FK23C).
 *
 * ---------------------------------------------------------------------------
 * UNIF IDENTIFIES A CARTRIDGE BY ITS BOARD, NOT BY A MAPPER NUMBER.
 *
 * An iNES header says "mapper 4".  A UNIF file says `NES-TLROM`, the part
 * number printed on a Nintendo board.  The core dispatches on a number, so the
 * container needs a TABLE, and a table is a place for a wrong fact to live
 * quietly: a wrong row boots into garbage, which is worse than a refusal.
 *
 * THE RULE FOR BEING IN THIS TABLE.  A row names a chip this core dispatches
 * (tools/unif_census.mjs FAILS if a row points at a number `nes-test mapprobe`
 * does not dispatch) and every row cites its documentary sources in `src`:
 *
 *   W  NESdev wiki, "UNIF to NES 2.0 Mapping"         (read 2026-10-02)
 *   M  reference M's UNIF loader board map (read 2026-10-02;
 *      READ ONLY to check rows -- nothing copied, ported or transliterated)
 *   B  the NESdev wiki page for the board family or mapper itself
 *      (AxROM, GxROM, DxROM, SxROM, TxROM, BNROM, MMC2, INES Mapper 146,
 *      INES Mapper 068)
 *
 * A row with TWO OR MORE sources is SOURCE-READ, VERIFIED.  A row with ONE is
 * SOURCE-READ, SINGLE -- kept because the board family page assigns the number
 * and no file in this library exercises it, but it is flagged as such.  ROWS
 * EXERCISED BY THE LIBRARY ARE THEN ADJUDICATED BY BOOT (tools/unif_boot.mjs).
 *
 * A board whose chip this core does not have is NOT given a row with a guessed
 * number.  It is absent here, and the loader refuses it BY NAME.
 *
 * `sub` is the documented NES 2.0 submapper (W).  It is passed to the core,
 * which reads a submapper for mapper 78 and, later, for mapper 4
 * (1 = MMC6, 4 = MMC3A).  So NES-HKROM's `sub: 1` below is now LIVE: an HKROM
 * UNIF board loads as MMC6, with its 1 KB at $7000 and no RAM at $6000.
 * For every other row it is still inert --
 * recorded so a later chip that keys on it gets the right value.
 *
 * `needs` marks a board whose number the core dispatches but whose documented
 * behaviour it does NOT implement.  Such a row is REFUSED BY NAME with the
 * reason, never loaded: the number exists, the board does not.
 */

/* MIRR -> this core's ciram wiring.  ciram_src_t in src/nes_mapper.inc is
 * A11=0, A10=1, LOW=2, HIGH=3, FOUR=4.  UNIF's MIRR byte (W, and the UNIF
 * format page) is 0 horizontal, 1 vertical, 2 one-screen A ($2000),
 * 3 one-screen B ($2400), 4 four-screen, 5 controlled by the mapper chip.
 * Rows 0-4 therefore map straight through; 5 is NOT a wiring -- the chip sets
 * it, so the loader leaves the board default and the chip's power-on decides.
 * Any value above 5 is undefined by the format and the file is REFUSED.
 *
 * Failure mode of folding 5 into 4: a board whose chip controls mirroring
 * would be given four screens of nametable RAM it does not have. */
export const MIRR_TO_CIRAM = [0, 1, 2, 3, 4, null];

export const UNIF_BOARDS = {
  /* ---- Nintendo: no chip, or a discrete latch ------------------------ */
  'NES-NROM':       { mapper: 0,   src: 'W M',   why: 'no mapper chip' },
  'NES-NROM-128':   { mapper: 0,   src: 'W M',   why: 'no mapper chip, 16 KB program' },
  'NES-NROM-256':   { mapper: 0,   src: 'W M',   why: 'no mapper chip, 32 KB program' },
  'NES-RROM':       { mapper: 0,   src: 'W M',   why: 'no mapper chip' },
  'NES-RROM-128':   { mapper: 0,   src: 'M',     why: 'no mapper chip' },
  'NES-CNROM':      { mapper: 3,   sub: 2, src: 'W M',   why: 'character-bank latch, bus conflicts' },
  'NES-UNROM':      { mapper: 2,   sub: 2, src: 'W M',   why: 'program-bank latch, bus conflicts' },
  'NES-UOROM':      { mapper: 2,   sub: 2, src: 'W M',   why: 'program-bank latch, 256 KB' },
  'NES-CPROM':      { mapper: 13,  src: 'W M',   why: 'character-RAM bank latch' },
  'NES-GNROM':      { mapper: 66,  src: 'B',     why: 'program + character latch (GxROM)' },
  'NES-MHROM':      { mapper: 66,  src: 'M B',   why: 'program + character latch (GxROM)' },
  'NES-AMROM':      { mapper: 7,   sub: 2, src: 'W B',   why: 'AxROM, bus conflicts' },
  'NES-ANROM':      { mapper: 7,   sub: 1, src: 'W M B', why: 'AxROM, no bus conflicts' },
  'NES-AN1ROM':     { mapper: 7,   sub: 1, src: 'W B',   why: 'AxROM, no bus conflicts' },
  'NES-AOROM':      { mapper: 7,   src: 'W B',   why: 'AxROM (W: submapper varies by cartridge)' },
  'NES-BNROM':      { mapper: 34,  sub: 2, src: 'W B',   why: '32 KB program latch' },
  /* ---- Nintendo MMC1 (SxROM page: mapper 1) ---------------------------- */
  'NES-SAROM':      { mapper: 1,   src: 'W M B', why: 'MMC1' },
  'NES-SBROM':      { mapper: 1,   src: 'W M B', why: 'MMC1' },
  'NES-SCROM':      { mapper: 1,   src: 'W M B', why: 'MMC1' },
  'NES-SC1ROM':     { mapper: 1,   src: 'W B',   why: 'MMC1' },
  'NES-SEROM':      { mapper: 1,   sub: 5, src: 'W M B', why: 'MMC1, fixed 32 KB program' },
  'NES-SFROM':      { mapper: 1,   src: 'W B',   why: 'MMC1' },
  'NES-SGROM':      { mapper: 1,   src: 'W M B', why: 'MMC1' },
  'NES-SHROM':      { mapper: 1,   sub: 5, src: 'W B',   why: 'MMC1, fixed 32 KB program' },
  'NES-SH1ROM':     { mapper: 1,   sub: 5, src: 'W B',   why: 'MMC1, fixed 32 KB program' },
  'NES-SJROM':      { mapper: 1,   src: 'W B',   why: 'MMC1' },
  'NES-SKROM':      { mapper: 1,   src: 'W M B', why: 'MMC1' },
  'NES-SLROM':      { mapper: 1,   src: 'W M B', why: 'MMC1' },
  'NES-SL1ROM':     { mapper: 1,   src: 'W M B', why: 'MMC1' },
  'NES-SL2ROM':     { mapper: 1,   src: 'W B',   why: 'MMC1' },
  'NES-SL3ROM':     { mapper: 1,   src: 'W B',   why: 'MMC1' },
  'NES-SLRROM':     { mapper: 1,   src: 'W B',   why: 'MMC1' },
  'NES-SNROM':      { mapper: 1,   src: 'W M B', why: 'MMC1, battery work RAM' },
  'NES-SOROM':      { mapper: 1,   src: 'W M B', why: 'MMC1, banked work RAM' },
  /* ---- Nintendo MMC3 (TxROM page: mapper 4, except 118 / 119) -------- */
  'NES-TBROM':      { mapper: 4,   src: 'W M B', why: 'MMC3' },
  'NES-TEROM':      { mapper: 4,   src: 'W M B', why: 'MMC3' },
  'NES-TFROM':      { mapper: 4,   src: 'W M B', why: 'MMC3' },
  'NES-TGROM':      { mapper: 4,   src: 'W M B', why: 'MMC3, character RAM' },
  'NES-TKROM':      { mapper: 4,   src: 'W M B', why: 'MMC3, battery work RAM' },
  'NES-TLROM':      { mapper: 4,   src: 'W M B', why: 'MMC3' },
  'NES-TL1ROM':     { mapper: 4,   src: 'W B',   why: 'MMC3' },
  'NES-TL2ROM':     { mapper: 4,   src: 'W B',   why: 'MMC3' },
  'NES-TNROM':      { mapper: 4,   src: 'W B',   why: 'MMC3, character RAM' },
  'NES-TR1ROM':     { mapper: 4,   src: 'W M B', why: 'MMC3, four screens of nametable RAM' },
  'NES-TSROM':      { mapper: 4,   src: 'W M B', why: 'MMC3' },
  'NES-TVROM':      { mapper: 4,   src: 'W M B', why: 'MMC3, four screens of nametable RAM' },
  'NES-HKROM':      { mapper: 4,   sub: 1, src: 'W M', why: 'MMC6 -- MMC3 register interface' },
  /* M maps these three to 4 and leaves the difference to its game database;
   * W and the TxROM page both assign 118 / 119.  This core has no database,
   * so the container's number has to be the board's. */
  'NES-TKSROM':     { mapper: 118, src: 'W B',   why: 'MMC3 with nametable off CHR A17' },
  'NES-TLSROM':     { mapper: 118, src: 'W B',   why: 'MMC3 with nametable off CHR A17' },
  'NES-TQROM':      { mapper: 119, src: 'W B',   why: 'MMC3 with mixed character RAM/ROM' },
  /* ---- Nintendo MMC2 / MMC5 ------------------------------------------ */
  'NES-PNROM':      { mapper: 9,   src: 'W B',   why: 'MMC2, character latch' },
  'NES-PEEOROM':    { mapper: 9,   src: 'W B',   why: 'MMC2, character latch' },
  'NES-EKROM':      { mapper: 5,   src: 'W M',   why: 'MMC5' },
  'NES-ELROM':      { mapper: 5,   src: 'W M',   why: 'MMC5' },
  'NES-ETROM':      { mapper: 5,   src: 'W M',   why: 'MMC5' },
  'NES-EWROM':      { mapper: 5,   src: 'W M',   why: 'MMC5' },
  /* ---- Namco 108 boards (DxROM page: "iNES assigns mapper 206") ------ */
  'NES-DEROM':      { mapper: 206, src: 'B',     why: 'Namco 108' },
  'NES-DE1ROM':     { mapper: 206, src: 'B',     why: 'Namco 108' },
  'NES-DRROM':      { mapper: 206, src: 'B',     why: 'Namco 108, four screens of nametable RAM' },
  /* ---- Sunsoft -------------------------------------------------------- */
  'SUNSOFT_UNROM':  { mapper: 93,  src: 'W M',   why: 'Sunsoft-2 on a UNROM-shaped board' },
  /* NTBROM IS NANTETTATTE!! BASEBALL, NOT AFTER BURNER (the inherited
   * comment had it wrong -- the two files carrying it in this library are
   * both Nantettatte!! Baseball).  W and B make it mapper 68 SUBMAPPER 1:
   * Sunsoft-4 plus an external option-firmware cartridge, selected into
   * $8000-$BFFF by bit 3 of $F000 (1 internal, 0 external).  The UNIF files
   * carry the option firmware as PRG1 (16 KB) after the 128 KB PRG0.
   *
   * sunsoft4_write() treats that bit as a fourth bank bit and has no external
   * firmware, and the concatenated 144 KB part puts the option firmware where the fixed
   * last bank should be.  So the number dispatches and the board does not
   * exist here: REFUSED BY NAME until a chip implementation covers 68.1. */
  /* 68.1 is implemented (sunsoft4_write and
   * s4_ext_apply in src/nes_mapper.inc), so the refusal is lifted. */
  'NES-NTBROM':     { mapper: 68,  sub: 1, src: 'W M B', why: 'Sunsoft-4 with option-firmware cartridge' },
  /* ---- the one third-party row ---------------------------------------
   * Sachen SA-016-1M.  W maps it to 79; M maps it to 146; B (INES Mapper 146)
   * says 146 denotes Sachen 3015 / SA-016 and is "functionally identical" to
   * mapper 79's NINA-03/06.  Three sources, one chip, and 79 is the one this
   * core has.  Adjudicated by boot in tools/unif_boot.mjs. */
  'UNL-SA-016-1M':  { mapper: 79,  src: 'W M B', why: 'NINA-03/06 decode (as mapper 146 = 79)' },
  /* ---- Boards whose chip this core now has --------------
   * Every number below was once in UNIF_UNSERVED with the
   * candidate number W and M agreed on (that table names both where they
   * differ, and none of these differed); the chips are in
   * src/nes_mapper.inc.  Adjudicated by boot and, where an iNES
   * twin exists, by tools/unif_twin.mjs. */
  'UNL-Sachen-8259A':     { mapper: 141, src: 'W M', why: 'Sachen 8259A: 3-bit register file, 2 KB windows counting 4 KB' },
  'UNL-Sachen-8259B':     { mapper: 138, src: 'W M', why: 'Sachen 8259B: 2 KB windows counting 2 KB' },
  'UNL-Sachen-8259C':     { mapper: 139, src: 'W M', why: 'Sachen 8259C: 2 KB windows counting 8 KB' },
  'UNL-Sachen-8259D':     { mapper: 137, src: 'W M', why: 'Sachen 8259D: 1 KB windows, top 4 KB fixed' },
  'UNL-Sachen-74LS374N':  { mapper: 150, src: 'W M', why: 'Sachen 74LS374N register file with read-back' },
  'UNL-22211':            { mapper: 132, src: 'W M', why: 'TXC 22211A accumulator chip' },
  'UNL-SA-0037':          { mapper: 148, src: 'W M', why: 'Sachen SA-008-A latch, bus conflicts' },
  'UNL-SA-0036':          { mapper: 149, src: 'W M', why: 'Sachen SA-0036 character latch' },
  'UNL-SA-72007':         { mapper: 145, src: 'W M', why: 'Sachen SA-72007 character latch at $4100' },
  'UNL-SA-72008':         { mapper: 133, src: 'W M', why: 'Sachen SA-72008 latch at $4100' },
  'UNL-TC-U01-1.5M':      { mapper: 147, src: 'W M', why: 'Sachen TC-U01: the TXC accumulator chip, rotated data bits' },
  'BMC-SuperHIK8in1':     { mapper: 45,  src: 'W M', why: 'MMC3 with the four-register outer bank' },
  'BMC-N625092':          { mapper: 221, src: 'W M', why: 'NTDEC two-latch multicart' },
  'BMC-NovelDiamond9999999in1': { mapper: 201, src: 'W M', why: 'address-latch multicart' },
  /* M ALONE: W has no number for TEK90 (UNIF_UNSERVED said so). Kept as
   * SOURCE-READ, SINGLE and adjudicated by boot. */
  'UNL-TEK90':            { mapper: 90,  src: 'M',   why: 'J.Y. Company ASIC' },
  /* 143 is now visible to mapprobe (it reads as
   * well as writes) and 176 is written. */
  'UNL-SA-NROM':          { mapper: 143, src: 'W M', why: 'Sachen SA-NROM: NROM plus a read-only protection port' },
  'BMC-FK23C':            { mapper: 176, src: 'W M', why: 'FK23C: MMC3 behind a multicart controller' },
  'BMC-Super24in1SC03':   { mapper: 176, src: 'W M', why: 'FK23C family' },
  /* Pass three: the tail's boards, each with the number W and M agree on. */
  'BMC-D1038':            { mapper: 59,  src: 'W M', why: 'address-latch multicart' },
  'BMC-70in1':            { mapper: 236, src: 'W M', why: 'address-latch multicart, outer bank' },
  'BMC-70in1B':           { mapper: 236, src: 'W M', why: 'address-latch multicart, outer bank' },
  'BMC-8157':             { mapper: 301, src: 'W M', why: 'address-latch multicart' },
  'BMC-64in1NoRepeat':    { mapper: 314, src: 'W M', why: 'register multicart' },
  'BMC-190in1':           { mapper: 300, src: 'W M', why: 'data-latch multicart' },
  'BMC-GS-2004':          { mapper: 283, src: 'W M', why: '32 KB latch, menu firmware at $6000' },
  'BMC-T-262':            { mapper: 265, src: 'W M', why: 'address-latch multicart with a lock' },
  'BMC-BS-5':             { mapper: 286, src: 'W M', why: 'address-decoded 8 KB/2 KB banking' },
  'UNL-EDU2000':          { mapper: 329, src: 'W M', why: '32 KB latch, banked 32 KB work RAM' },
  'UNL-8237':             { mapper: 215, src: 'W M', why: 'MMC3 with scrambled register addresses' },
  'UNL-SL1632':           { mapper: 14,  src: 'W M', why: 'VRC2 / MMC3 hybrid, switched by $A131' },
  'UNL-603-5052':         { mapper: 238, src: 'W M', why: 'MMC3 with a $4020-$7FFF protection latch' },
  /* W 233, M 226.  W's number is taken: 233 is 226 plus the RESET flip-flop
   * on bank bit 5, which is what the board's name says it has; MEASURED in
   * (the reset cycles the menu's two halves). */
  'BMC-42in1ResetSwitch': { mapper: 233, src: 'W', why: 'address multicart, reset switches the 32-game half' },
  'UNL-KOF97':            { mapper: 263, src: 'W M', why: 'MMC3 with a bit-permuted data bus' },
  'UNL-SMB2J':            { mapper: 304, src: 'W M', why: 'FDS conversion: $5000-$7FFF firmware, 12-bit counter' },
  'UNL-T-230':            { mapper: 529, src: 'W M', why: 'VRC2/4 clone with folded address lines' },
  /* W: NES 2.0 Mapper 262 ("an MMC3 clone with both
   * CHR-ROM and 8 KiB of CHR-RAM"); M agrees.  `chrRam2` (KB) is the second character part, beside the
   * firmware, that the readers hand the core with nes_set_chr_ram2 -- the one thing a UNIF file cannot say. */
  'UNL-SHERO':            { mapper: 262, chrRam2: 8, src: 'W M', why: 'MMC3 clone: $4100 character quarters, 8 KB character RAM, title jumper, four screens' },
  /* Mapper 142 is now dispatched.  W: UNIF to NES 2.0
   * Mapping gives UNL-KS7032 = 142; M's UNIF loader agrees.  The library's one file is a Disk System conversion. */
  'UNL-KS7032':           { mapper: 142, src: 'W M', why: 'Kaiser FDS conversion: $6000 firmware bank, VRC3-style 16-bit counter' },
  /* Six boards whose chips are now dispatched.  W: UNIF to NES 2.0
   * Mapping (A65AS 285, AX5705 530, H2288 123, WS 332, Supervision16in1 53); M's UNIF loader agrees on those five.
   * UNL-CC-21 has no number in W; F's loader runs it as mapper 27 (its CC-21 board, keyed to the Mi Hun Che boards),
   * and that is the number this core gives the chip. */
  'BMC-A65AS':            { mapper: 285, src: 'W M', why: '16/32 KB latch with one-screen wiring' },
  'UNL-AX5705':           { mapper: 530, src: 'W M', why: 'scrambled program banks, nibble-written 1 KB character banks' },
  'UNL-H2288':            { mapper: 123, src: 'W M', why: 'MMC3 with a scrambled $8000 select and a $5800 program override' },
  'BMC-WS':               { mapper: 332, src: 'W M', why: '$6000 latch multicart with a lock bit' },
  'BMC-Supervision16in1': { mapper: 53,  src: 'W M', why: '$6000/$8000 registers, $6000 firmware, a 32 KB menu part' },
  'UNL-CC-21':            { mapper: 27,  src: 'F', why: 'address latch: one-screen page and 4 KB character bank from bit 0' },
  /* W: UNIF to NES 2.0 Mapping and the board pages
   * ("NES 2.0 Mapper 283": GS-2004 and GS-2013 are its two layouts; "INES Mapper 226" lists the 63-in-1 on three
   * 512 KB chips; "UNIF/UNL-DripGame" = 284).  M's loader has its own board for the two multicarts, with the
   * same banking; the core tells the layouts apart by the firmware size W gives each, so no private number. */
  'BMC-GS-2013':           { mapper: 283, src: 'W M', why: '32 KB latch, $6000 the last 8 KB of the first 256 KB (no extra chip)' },
  'BMC-Ghostbusters63in1': { mapper: 226, src: 'W M F', why: '226 on three 512 KB chips: its own chip select' },
  'UNL-DRIPGAME':          { mapper: 284, src: 'W M', why: 'FPGA board: two sample channels, cycle counter, extended attributes' },
  /* W: UNIF to NES 2.0 Mapping gives *-TF1201 = 298,
   * DREAMTECH01 = 521 and *-MARIO1-MALEE2 = 42 with 2 KB of work RAM; W's own board page "INES Mapper 055" names
   * BTL-MARIO1-MALEE2 as mapper 55 (NROM-256, 2 KB firmware at $6000, 2 KB RAM at $7000), which is that board and
   * not 42's ($6000 bank register, counter): 55 is taken, as P does.  M has a private board id for it. */
  'UNL-TF1201':            { mapper: 298, src: 'W M', why: 'VRC4 clone (VRC4b wiring) whose acknowledge leaves the counter enabled' },
  'DREAMTECH01':           { mapper: 521, src: 'W M', why: '$5020 16 KB latch, last 16 KB on its own chip' },
  'BTL-MARIO1-MALEE2':     { mapper: 55,  src: 'B P', why: 'NROM-256 with 2 KB firmware at $6000 and 2 KB RAM at $7000' },
};

/* The boards this library holds that have NO row above, with the number the
 * sources give.  NOT USED TO LOAD ANYTHING -- the refusal message names the
 * candidate, and a later round has the list without re-measuring.  Every
 * number here is OUTSIDE the set this core dispatches (checked by
 * tools/unif_census.mjs), which is why these boards are refused: there is no
 * chip to map them to, not merely no row.  Where W and M disagree, both are
 * given.  `files` is this library's count, MEASURED 2026-10-02. */
export const UNIF_UNSERVED = {
  /* The three boards that stood here (BTL-MARIO1-MALEE2, DREAMTECH01, UNL-TF1201) now have rows
   * above.  An unknown board is still refused by name, with no candidate number. */
};

/* Board names are matched EXACTLY as the MAPR chunk spells them, after the
 * terminating NUL and surrounding whitespace are stripped.  No case folding,
 * no prefix matching: `NES-SL1ROM` and `NES-SLROM` are different boards.
 *
 * ONE ALIAS, AND IT IS DOCUMENTED: W states that the NES- / HVC- prefixes are
 * interchangeable for Nintendo's own boards (the Famicom and NES editions of
 * one board), so an `HVC-` name with no row of its own is looked up under
 * `NES-`.  No other prefix is stripped -- BMC-, UNL- and BTL- name different
 * vendors and stripping them could alias two unrelated boards. */
export function resolveBoard(name) {
  const has = (k) => Object.prototype.hasOwnProperty.call(UNIF_BOARDS, k);
  if (has(name)) return UNIF_BOARDS[name];
  if (name.startsWith('HVC-') && has('NES-' + name.slice(4))) return UNIF_BOARDS['NES-' + name.slice(4)];
  return null;
}
