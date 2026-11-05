/* core.js — the JS side of the NES core's wasm ABI.
 *
 * Stage 6.  This module owns EXACTLY ONE thing: turning build/nes.wasm into a
 * callable machine.  It does no rendering, no audio output, no input polling
 * and no DOM.  Those live in render/audio/shell so that the ABI can be tested
 * headlessly in Node with the same file the browser loads — the Game Boy
 * core's web/core.js draws the same line and it is the line that let its ABI
 * be regression-tested without a browser.
 *
 * THE MEMORY MODEL IS THE PART THAT IS EASY TO GET WRONG.
 * The core is built `--target=wasm32 -nostdlib`: there is no malloc, and
 * `nes_set_cart()` takes RAW POINTERS into linear memory for PRG, CHR and work
 * RAM.  The host must therefore place those buffers itself.  We bump-allocate
 * from the END OF THE INITIAL MEMORY.  Everything below that mark may be a data
 * segment or the shadow stack; everything above it is definitely unused.
 * Using the initial value of __stack_pointer instead LOOKS right and is not:
 * with this link order it reads 131072, which is the stack size, and the data
 * segments live above it.  That allocator corrupts the core's own statics.
 */

export const NES_W = 256;
export const NES_H = 240;

/* Buttons, in the order the shift register clocks them out. */
export const BTN = { A: 0x01, B: 0x02, SELECT: 0x04, START: 0x08,
                     UP: 0x10, DOWN: 0x20, LEFT: 0x40, RIGHT: 0x80 };

/* AUTO: the cartridge's own region -- an NES 2.0
 * header's byte 12, else the header-correction table's row (the database's
 * System field, TABLE-READ), else NTSC.  The core never sees AUTO. */
export const REGION = { NTSC: 0, PAL: 1, DENDY: 2, AUTO: -1 };

/* THE NAMETABLE WIRING, and these are the core's own numbers — ciram_src_t in
 * src/nes_mapper.inc.  They are a WIRING, not an adjective: CIRAM A10 is driven
 * by picture-bus A11, or by A10, or tied low, or tied high, or the cartridge
 * decodes all four pages itself.  The header bit maps straight through, which
 * is the whole point of storing the wiring rather than a name.
 *
 * Failure mode of getting FOUR wrong: it is numerically adjacent to LOW, so a
 * four-screen cartridge silently runs on SINGLE-SCREEN A.  Nothing crashes;
 * the status bar and the playfield share one nametable and scroll into each
 * other.  That is exactly the defect this file shipped — see the note on
 * parseINES below. */
export const CIRAM = { A11: 0, A10: 1, LOW: 2, HIGH: 3, FOUR: 4 };
/* One side of a Disk System disk, in the raw container. 65,500 bytes, and a
 * length that is not a multiple of it is a container this core cannot account
 * for rather than a disk with an odd size. */
export const FDS_SIDE_BYTES = 65500;
export const CIRAM_NAME = ['PPU-A11 (horizontal)', 'PPU-A10 (vertical)',
                           'single-screen A', 'single-screen B', 'four-screen'];

/* THE SECOND CONTAINER.  See web/unif_boards.js for why it exists and for the
 * rule about what may be in its table. */
import { UNIF_BOARDS, UNIF_UNSERVED, MIRR_TO_CIRAM, resolveBoard } from './unif_boards.js';
import { hdrLookup, hdrDecide, crc32, HDR_R18, HDR_DISPATCHED } from './hdr_table.js';
import { SAVE_INIT, SAVE_INIT_DEFAULT, SAVE_INIT_BOARDS, saveInitLookup } from './save_init_table.js';
/* The header-table switches (noRamRow
 * mirrorRow), re-exported so a page can turn each off. */
export { HDR_R18 };
import { inputDeviceFor } from './input_table.js';
export { UNIF_BOARDS, UNIF_UNSERVED };

/* iNES / NES 2.0 header parse.  Returns the fields nes_set_cart() wants.
 * Kept here rather than in the shell because a malformed header is an ABI
 * problem, not a UI one: passing a bad prg_size hands the core a pointer to
 * memory it does not own.
 *
 * THIS FUNCTION WAS WRONG IN THREE WAYS UNTIL IT WAS MEASURED, and the wrong
 * version is described rather than quietly replaced, because the shape of the
 * miss is the transferable part.  It was never checked against the board
 * machine's own loader — test/native_main.c load_ines() — and the browser was
 * therefore mounting cartridges differently from the machine the board scores.
 *
 *   1. FOUR-SCREEN MIRRORING returned 2.  Two is CIRAM_LOW, single-screen A.
 *      Every four-screen cartridge in the corpus ran on one nametable.
 *   2. CHARACTER RAM was always 8 KB.  NES 2.0 byte 11 declares it as two
 *      shift counts; a part with 32 KB fitted got 8 and the mapper's banking
 *      aliased every bank onto the same block.
 *   3. WORK RAM was always 8 KB.  NES 2.0 byte 10 declares it, and when it
 *      declares NONE that is a fact about the board — several mapper-suite
 *      cartridges are built with no work RAM so the suite can check the chip
 *      reports none.  And an unidentified mapper 5 cartridge needs 64 KB, not
 *      8: the chip banks the window, so 8 KB aliases four banks onto one and
 *      Just Breed reads its own save back corrupted.
 *
 * The rules below are load_ines()'s rules, stated the same way, so the two
 * loaders can be diffed rather than compared by eye.  web/selfcheck.mjs runs
 * that diff over the whole pinned corpus on every invocation. */
/* THE HEADER-CORRECTION TABLE.
 * The rule, and its source (TABLE-READ, a published game database, pinned), are
 * stated at the head of web/hdr_table.js; the two native loaders apply the
 * same rule through test/hdr_fix.h.  Set HEADER_FIX.enabled = false to turn
 * it off (the bench and the worker do so for ?hdrfix=0).  A cartridge whose
 * header was overridden carries `headerFix` naming header -> table values,
 * and loadCartridge() logs it. */
export const HEADER_FIX = { enabled: true };
/* THE FAMILY BASIC KEYBOARD IS PLUGGED IN WHEN THE TITLE ASKS FOR IT -- round
 * eighteen.  The input table names device
 * $23 (the Family BASIC keyboard) for the BASIC cartridges, and the core has
 * had the keyboard for some time (nes_kb_attach), but no host
 * ever attached it: Family BASIC polls the keyboard's tenth row, reads $0
 * there ("no keyboard"), and never draws its screen.  LABEL: MECHANISM (host)
 * -- a keyboard is a thing somebody plugs in, and the table says this title
 * came with one.  FAILURE MODE of not attaching: the four BASIC files are
 * BLANK.  SWITCH: KB_AUTO.enabled = false (?kb=0 on the bench) is the
 * before-arm; the keys themselves are the host's (web/shell.js FamilyKeyboard). */
export const KB_AUTO = { enabled: true };
/* A FILE SHORTER THAN ITS HEADER (
 * audit R13).  Off (refused, as before) unless enabled: then what is there is
 * loaded and the rest of the declared size is filled with `pad`, and the
 * cartridge carries `truncated` (bytes missing) for the shell to warn about.
 * LABEL: FITTED -- nothing measures what an absent part of a dump held; the
 * pad value is chosen, not derived.  Identical to the native loaders'
 * NES_R18_TRUNC_LOAD / NES_R18_TRUNC_PAD.  On since 2026-10-08 (by decision). */
export const TRUNC_LOAD = { enabled: true, pad: 0xFF };   /* APPROVED FITTED DEFAULT, 2026-10-08 */
/* A FRESH BATTERY SAVE.
 * Off: a battery cartridge's work RAM starts at $00, as before.  On: at
 * `value` ($FF) -- a restored save (web/store.js) overwrites it, so only a
 * cartridge with no save yet sees it.  LABEL: FITTED (a fresh SRAM's contents
 * are NOT ESTABLISHED; Famicom Jump II jams on $00, Silva Saga reads $00 as
 * three blank saves).  Identical to the native NES_R18_SAVE_FILL.  On from
 * 2026-10-08 (by decision); OFF AGAIN 2026-10-11: the library
 * sweep priced it at a net loss, so it was declined. */
export const SAVE_FILL = { enabled: false, value: 0xFF };   /* declined 2026-10-11 */
export const DEVICE_FAMILY_KEYBOARD = 0x23;
/* THE CHARACTER RAM/FIRMWARE MIX BOARDS' RAM PART,
 * the same rule as test/hdr_fix.h
 * hdr_chr_mix_default().  After the header table, a cartridge on one of these
 * numbers with character firmware and no second (RAM) part gets the board's
 * documented RAM size, so every dump of a TQROM or Waixing mixed board -- not
 * only the CRCs the table has rows for -- has the part the core routes to.
 * MECHANISM (NESdev wiki, each mapper's page).  enabled = false turns it off. */
export const CHR_MIX_DEFAULT = { enabled: true, size: { 119: 8192, 74: 2048, 191: 2048, 194: 2048, 192: 4096, 195: 4096 } };

/* NES 2.0 exponent-multiplier sizes decoded; false restores the old reading. */
export const NES2_EXPONENT_SIZES = true;
/* CRC-32 over program then character firmware, as separate parts: the key of
 * web/input_table.js (web/hdr_table.js exports its own single-buffer crc32,
 * imported above; the two compute the same CRC).  Character RAM is not in the file and not in
 * the key. */
function crc32parts(...parts) {
  let c = ~0;
  for (const p of parts) if (p) for (let i = 0; i < p.length; i++) {
    c ^= p[i];
    for (let b = 0; b < 8; b++) c = (c >>> 1) ^ (0xEDB88320 & -(c & 1));
  }
  return ~c >>> 0;
}

const DISKDUDE_SIGNATURE = true;
/* Bytes 7-15 spell "DiskDude!". */
export function isDiskDude(b) {
  const s = [0x44, 0x69, 0x73, 0x6b, 0x44, 0x75, 0x64, 0x65, 0x21];
  if (b.length < 16) return false;
  for (let i = 0; i < 9; i++) if (b[7 + i] !== s[i]) return false;
  return true;
}

export function parseINES(bytes) {
  if (bytes.length < 16) throw new Error('iNES: file shorter than a header');
  if (!(bytes[0] === 0x4e && bytes[1] === 0x45 && bytes[2] === 0x53 && bytes[3] === 0x1a))
    throw new Error('iNES: bad magic — not a .nes file');

  const f6 = bytes[6];
  /* A HEADER SIGNED "DiskDude!".
   * One header tool wrote its name into bytes 7-15, so byte 7's upper nibble
   * there is the letter 'D' ($44), not a mapper nibble.  Only that exact
   * signature is read as the tool's: a general "bytes 12-15 non-zero" guard is
   * wrong in both directions on this library (the comment below), the
   * signature is not.  Bytes 7-15 then count as zero.  MECHANISM; identical in
   * test/native_main.c load_ines, test/boot_sweep_main.c and tools/ines.mjs.
   * Switch: DISKDUDE_SIGNATURE. */
  const f7 = (DISKDUDE_SIGNATURE && isDiskDude(bytes)) ? 0 : bytes[7];
  const nes2 = (f7 & 0x0c) === 0x08;

  /* [LATER: the exact "DiskDude!" signature IS now read as
   * the tool's (isDiskDude above): it is the one rule here wrong in neither
   * direction.  The general guard below stays out, for the reasons given.]
   * NO ARCHAIC-HEADER GUARD, AND IT IS A MEASURED CHOICE, NOT AN OVERSIGHT.
   * On headers of this vintage bytes 7-15 hold a copier's name in ASCII, so
   * byte 7's upper nibble is part of the string rather than a mapper nibble --
   * "DiskDude!" starts with 'D' = 0x44.  The standard guard is bytes 12-15:
   * any non-zero means archaic, trust only byte 6's nibble.
   * tools/mapper_census.mjs applies it; THIS PARSER AND test/native_main.c's
   * load_ines() DO NOT, and they must keep agreeing with each other -- that is
   * what web/selfcheck.mjs diffs.
   *
   * MEASURED over a local library 2026-10-01: OF 16,232 iNES FILES THE TWO
   * RULES DISAGREE ON NINE, six of them carrying "DiskDude!".  Run under both
   * rules, three change verdict, and the guard is worth +1 cartridge that draws
   * and costs none.  THE CENSUS'S OWN COMMENT HAD SAID "SEVERAL HUNDRED" AND
   * THAT WAS WRONG BY TWO ORDERS OF MAGNITUDE; it is corrected there.
   *
   * AND THE GUARD IS WRONG IN BOTH DIRECTIONS: two of the nine are Pegasus
   * 5-in-1 (Golden Five), a Codemasters board that genuinely IS mapper 71,
   * where byte 7's upper nibble is a real mapper nibble and the guard throws it
   * away and reads mapper 7.  So the rule is NOT changed here -- a guard known
   * wrong in both directions is not adjudicated, and all 265 pinned cartridges
   * have modern headers on which the two rules agree.  test/boot_sweep_main.c
   * computes BOTH and prints both (--header=guarded|raw).  Nine files, two
   * directions, not a chip-sized job. */
  let prg16k = bytes[4], chr8k = bytes[5], mapper = (f7 & 0xf0) | (f6 >> 4), submapper = 0;
  if (nes2) {
    prg16k |= (bytes[9] & 0x0f) << 8;
    chr8k  |= (bytes[9] & 0xf0) << 4;
    mapper |= (bytes[8] & 0x0f) << 8;
    submapper = bytes[8] >> 4;
  }

  let prgSize = prg16k * 16384;
  let chrSize = chr8k * 8192;
  /* NES 2.0 EXPONENT-MULTIPLIER SIZES (MECHANISM, the NES
   * 2.0 specification): a size nibble of $F makes the LSB byte EEEEEEMM and the
   * size 2^E x (MM x 2 + 1) bytes.  Identical in test/native_main.c load_ines,
   * test/boot_sweep_main.c load_cart and tools/ines.mjs.  Failure mode of
   * reading $F as size bits: the claimed size exceeds the file and the
   * cartridge is refused.  Switch: NES2_EXPONENT_SIZES. */
  if (nes2 && NES2_EXPONENT_SIZES) {
    if ((bytes[9] & 0x0f) === 0x0f) prgSize = (2 ** (bytes[4] >> 2)) * ((bytes[4] & 3) * 2 + 1);
    if ((bytes[9] & 0xf0) === 0xf0) chrSize = (2 ** (bytes[5] >> 2)) * ((bytes[5] & 3) * 2 + 1);
  }
  const trainer = (f6 & 4) ? 512 : 0;
  const off = 16 + trainer;
  /* The header's wiring, before the table can see it. */
  let ciram = (f6 & 8) ? CIRAM.FOUR : (f6 & 1) ? CIRAM.A10 : CIRAM.A11;
  let ramNone = false;

  /* Keyed on the CONTENT after the header and trainer, never on the header. */
  let headerFix = null, chrRam2Size = 0, ramMin = 0, chrRamMin = 0, region = REGION.NTSC, hdrBattery = 0;
  if (nes2) region = [REGION.NTSC, REGION.PAL, REGION.NTSC, REGION.DENDY][bytes[12] & 3];
  if (HEADER_FIX.enabled && bytes.length > off) {
    const crc = crc32(bytes, off, bytes.length);
    const row = hdrLookup(crc);
    /* An iNES 1.0 header cannot name a region; the row can.  This is
     * identical to test/boot_sweep_main.c load_cart(). */
    if (!nes2 && row && row.region) region = row.region;
    const d = hdrDecide({ nes2, mapper, submapper, prgSize, chrSize, ciram, battery: (f6 & 2) ? 1 : 0 }, row, bytes.length - off);
    if (d) {
      if (d.changed.length)
        headerFix = { crc: crc.toString(16).toUpperCase().padStart(8, '0'), text: d.changed.join('; '),
                      from: { mapper, submapper, prgSize, chrSize },
                      to: { mapper: d.mapper, submapper: d.submapper, prgSize: d.prgSize, chrSize: d.chrSize } };
      mapper = d.mapper; submapper = d.submapper; prgSize = d.prgSize; chrSize = d.chrSize;
      chrRam2Size = d.chrRam2; ramMin = d.ramMin; chrRamMin = d.chrRamMin || 0;
      if (!nes2 && d.ciram !== undefined) ciram = d.ciram;
      ramNone = !nes2 && !!d.ramNone;
      hdrBattery = !nes2 && d.battery ? 1 : 0;   /* the row records a battery: the save is kept */
    }
  }
  /* THE FRESH SAVE'S TABLE (the rule is web/save_init_table.js's,
   * identical to test/hdr_fix.h save_init_apply): after the header table, a row keyed on the same content CRC
   * places an EEPROM board, or names a battery-RAM board's fresh-save byte.  Either sets the battery bit. */
  let saveInit = null, batteryRow = 0;
  if (SAVE_INIT.enabled && bytes.length > off) {
    const row = saveInitLookup(crc32(bytes, off, bytes.length), bytes.length - off);
    if (row) {
      const brd = SAVE_INIT_BOARDS[row.board] || (row.mapper !== undefined ? { mapper: row.mapper, sub: row.sub } : null);
      saveInit = { board: row.board, fill: row.board === 'ram' ? row.fill : null, title: row.title,
                   from: brd ? { mapper, submapper } : null };
      if (brd) { mapper = brd.mapper; submapper = brd.sub; }
      batteryRow = 1;
    }
  }
  /* mapper 218's pad wiring.  Its "alternative layout" bit is not four-screen: with bit 0 it names
   * the A13 wire (single-screen B), without it the A12 wire (single-screen A) -- see src/nes_mapper.inc.
   * Identical in test/native_main.c, test/boot_sweep_main.c and tools/ines.mjs. */
  if (mapper === 218 && ciram === CIRAM.FOUR) ciram = (f6 & 1) ? CIRAM.HIGH : CIRAM.LOW;
  /* mapper 30 (UNROM 512): bit 3 without bit 0 is the single-screen board whose latch D7 picks the page
   * (passed as LOW); bit 3 with bit 0 is the four-screen board (src/nes_mapper.inc).
   * Identical in test/native_main.c, test/boot_sweep_main.c and tools/ines.mjs. */
  if (mapper === 30 && ciram === CIRAM.FOUR && !(f6 & 1)) ciram = CIRAM.LOW;
  if (CHR_MIX_DEFAULT.enabled && !chrRam2Size && chrSize && CHR_MIX_DEFAULT.size[mapper])
    chrRam2Size = CHR_MIX_DEFAULT.size[mapper];
  /* a file shorter than its header.  Refused unless TRUNC_LOAD is
   * on; then padded to the declared size (FITTED, see TRUNC_LOAD). */
  let truncated = 0;
  if (off + prgSize + chrSize > bytes.length) {
    if (!TRUNC_LOAD.enabled || bytes.length < off + 1)
      throw new Error(`iNES: header claims ${prgSize + chrSize} bytes of cartridge, file has ${bytes.length - off}`);
    truncated = off + prgSize + chrSize - bytes.length;
    const full = new Uint8Array(off + prgSize + chrSize);
    full.fill(TRUNC_LOAD.pad & 0xff);
    full.set(bytes);
    bytes = full;
  }

  /* CHARACTER RAM SIZE.  NES 2.0 byte 11 is two shift counts, volatile and
   * non-volatile; the part is one array either way, so they are summed.  A
   * plain iNES container cannot say, and 8 KB is the only defensible default
   * because that is the window size. */
  let chrRamSize = 0;
  if (chrSize === 0) {
    if (nes2) {
      if (bytes[11] & 0x0f) chrRamSize += 64 << (bytes[11] & 0x0f);
      if (bytes[11] >> 4)   chrRamSize += 64 << (bytes[11] >> 4);
    }
    /* MAPPER 6 IS THE ONE NUMBER WHOSE CHARACTER RAM IS FOUR WINDOWS DEEP:
     * its latch selects one of four 8 KB banks and 129 of the library's 156
     * mapper-6 files carry no character firmware.  At 8 KB all four alias onto
     * one block.  Only when the container cannot say.
     * test/native_main.c load_ines() does the same. */
    if (!chrRamSize && mapper === 6) chrRamSize = 32768;
    /* GTROM (mapper 111 with no character firmware) always carries 32 KB of RAM: pages 0-1 are pattern
     * memory and pages 2-3 the nametables (W: "GTROM").  NES 2.0 headers often give only the 16 KB pattern part,
     * because the nametable half is not CHR in the usual sense, so the board's size is taken in both containers. */
    if (mapper === 111) chrRamSize = 32768;
    /* UNROM 512 (mapper 30) carries 32 KB, four 8 KB pattern banks (W "UNROM 512": an iNES header defaults
     * to 32 KB; an NES 2.0 header that declares a size is believed).  See src/nes_mapper.inc. */
    if (!chrRamSize && mapper === 30) chrRamSize = 32768;
    if (!nes2 && chrRamMin > chrRamSize) chrRamSize = chrRamMin;
    if (!chrRamSize) chrRamSize = 8192;
  }

  /* WORK RAM AT $6000-$7FFF.  The 8 KB floor applies ONLY to a container that
   * cannot say: every status-byte cartridge in the corpus writes its protocol
   * to $6000, so a plain iNES container with no field for it must be floored
   * or the whole suite reports "never started".  NES 2.0 CAN say, and when it
   * says none, that is the board. */
  let prgRamSize = 0;
  if (nes2) {
    if (bytes[10] & 0x0f) prgRamSize += 64 << (bytes[10] & 0x0f);
    if (bytes[10] >> 4)   prgRamSize += 64 << (bytes[10] >> 4);
  }
  if (!nes2 && prgRamSize < 8192) prgRamSize = 8192;
  if (mapper === 5 && !nes2 && prgRamSize < 0x10000) prgRamSize = 0x10000;
  /* A TRAINER NEEDS $7000-$71FF TO EXIST -- see loadCartridge(). */
  if (trainer && prgRamSize < 8192) prgRamSize = 8192;
  /* The table's work+save RAM, raised and never lowered, iNES 1.0 only. */
  if (!nes2 && ramMin > prgRamSize) prgRamSize = ramMin;
  /* NO RAM ON THE BOARD:
   * the table's row records 0 KB of work and save RAM, so $6000-$7FFF is open
   * bus, not the 8 KB floor above.  LABEL: MECHANISM (TABLE-READ): a board
   * with no RAM part answers nothing there.  FAILURE MODE of the floor: a
   * program that relies on open bus at $6000 (Battletoads & Double Dragon,
   * Low G Man) reads back what it wrote and takes the other branch.  Kept
   * when the header has a trainer (it needs $7000) or the battery bit (a
   * header that says a save exists is not overruled into losing one).
   * Identical to test/hdr_fix.h's callers; switch HDR_R18.noRamRow. */
  if (ramNone && !trainer && !(f6 & 2) && !batteryRow) prgRamSize = 0;   /* a fresh-save row is a save */

  return { region,
    headerFix, chrRam2Size,
    prg: bytes.subarray(off, off + prgSize),
    chr: chrSize ? bytes.subarray(off + prgSize, off + prgSize + chrSize) : null,
    prgSize, chrSize, mapper, submapper,
    /* THE NES 2.0 MISCELLANEOUS PART: byte 14 counts the parts after the character
     * firmware; their bytes run to the end of the file.  Mapper 355's microcontroller program is one. */
    misc: (nes2 && (bytes[14] & 3) && bytes.length > off + prgSize + chrSize) ? bytes.subarray(off + prgSize + chrSize) : null,
    chrIsRam: chrSize === 0 ? 1 : 0,
    chrRamSize, prgRamSize,
    /* The header bit is the wiring, unconverted.  Bit 3 (alternative layout)
     * wins over bit 0, and it means FOUR — see the CIRAM table above.  The
     * table's row replaces it on an iNES 1.0 header when it records one.
     * */
    ciram,
    truncated,
    battery: ((f6 & 2) || batteryRow || hdrBattery) ? 1 : 0,
    saveInit,   /* the fresh-save table's row, or null */
    trainer: trainer ? 1 : 0,
    /* The 512 bytes themselves, which this parser used to skip and nothing
     * read.  loadCartridge() places them at $7000. */
    trainerData: trainer ? bytes.subarray(16, 16 + 512) : null,
    nes2,
    /* NES 2.0 byte 15: the default expansion device.  0 where the container
     * cannot say -- loadCartridge() then asks web/input_table.js. */
    expansion: nes2 ? (bytes[15] & 0x3f) : 0,
  };
}

/* =========================================================================
 * UNIF, AND IT IS A CHUNK WALK RATHER THAN A HEADER READ
 *
 * SPEC SOURCE: the NESdev wiki "UNIF" page (read 2026-10-02).  The container:
 *
 *     "UNIF"                 4 bytes
 *     revision               4 bytes, LE32 -- the MINIMUM revision a reader
 *                            needs; not a reason to refuse on its own
 *     reserved               24 bytes, to offset 32
 *     then chunks, ANY ORDER: 4-byte id, 4-byte LE32 length, data
 *
 * Chunks: MAPR (board name, NUL-terminated, REQUIRED), PRG0-PRGF / CHR0-CHRF
 * (the parts; at least PRG0 required), PCKn / CCKn (CRC-32 of part n), NAME,
 * READ, WRTR, DINF, TVCI (0 NTSC, 1 PAL, 2 both), CTRL, BATR, VROR (the
 * character part is RAM), MIRR (see web/unif_boards.js).  ANY OTHER ID IS
 * SKIPPED BY ITS LENGTH -- TVSC, for one, occurs in this library and is in no
 * document read.
 *
 * MEASURED over the library's 152 UNIF files (tools/unif_census.mjs): revision
 * 7 on 149, 8 on one, 4 on one; 50 PCK/CCK CRCs present and ALL 50 AGREE with
 * the parts this walk extracts.  That is the walk's independent check: an
 * off-by-one walk fails a CRC.  ONE FILE IS MALFORMED -- Tin Choi Ma Lei (Ch)
 * [U].unf, whose NAME chunk declares 71 bytes and holds 25 -- and it is
 * REFUSED BY NAME rather than parsed into whatever that produces.
 *
 * MULTIPLE PARTS CONCATENATE IN INDEX ORDER, NOT FILE ORDER.  Twelve files here
 * carry PRG1 and four carry PRG2.  A loader that appended in file order would
 * transpose banks, and the symptom is a garbled boot that looks exactly like a
 * wrong mapper.  A REPEATED id (two PRG0s, two MAPRs) is ambiguous and the
 * file is refused, not resolved by picking one.
 *
 * WHAT IS REFUSED, AND EVERY REFUSAL NAMES ITS REASON.  Bad magic; a header
 * shorter than 32 bytes; a chunk id that is not four printable characters (the
 * walk has lost step); a chunk length past the end of the file; stray bytes
 * after the last chunk; a repeated chunk; no MAPR or an empty one; no program
 * part; a MIRR value the format does not define; a board with no row; and a
 * board whose row says the chip lacks what the board needs.  NO HALF-LOADS.
 *
 * THERE IS NO MAPPER NUMBER IN A UNIF FILE -- the board name is the identity.
 * web/unif_boards.js is the board -> chip table, sourced row by row. */
export class UnifError extends Error {
  /* kind: 'malformed' (the container), 'board' (no row for the board), 'needs'
   * (a row, but the chip lacks what the board needs).  Tools count by it. */
  constructor(msg, board, kind = 'malformed') {
    super(msg); this.name = 'UnifError'; this.board = board ?? null; this.kind = kind;
  }
  /* The sentence a player reads (2026-10-21).  The message
   * above stays the technical one, for logs and tools. */
  get plain() {
    if (this.kind === 'malformed') return 'This cartridge file is damaged or incomplete, so it cannot start.';
    return `This cartridge is built on a board (${this.board}) that this emulator does not have yet, so it cannot start.`;
  }
}

/* A CARTRIDGE ON A CHIP THIS CORE DOES NOT HAVE IS REFUSED BY NAME (
 * 2026-10-21: "refuse a cartridge on an unsupported chip by
 * name with a plain message instead of a black screen").  Before this an iNES
 * file whose mapper number, after the header-correction table, reached no chip
 * was powered on with straight-through banking: most showed one colour, a few
 * multicart menus drew and could start nothing.  UNIF files were already
 * refused by board name; this is the same rule for the number.  The set is
 * web/hdr_table.js HDR_DISPATCHED, measured by mapprobe when the table is built
 * and re-derived by the hdr-table gate, so it cannot drift from the core. */
const DISPATCHED = new Set(HDR_DISPATCHED);
export class CartError extends Error {
  constructor(msg, plain, kind) { super(msg); this.name = 'CartError'; this.plain = plain; this.kind = kind; }
}

export function isUNIF(bytes) {
  return bytes.length >= 4 && bytes[0] === 0x55 && bytes[1] === 0x4e &&
         bytes[2] === 0x49 && bytes[3] === 0x46;
}

/* The chunk walk on its own, with no board lookup.  Tools want the chunks
 * without a cartridge: the census, the CRC adjudication, the control. */
export function unifChunks(bytes) {
  if (!isUNIF(bytes)) throw new UnifError('UNIF: bad magic — not a UNIF file');
  if (bytes.length < 32) throw new UnifError(`UNIF: ${bytes.length} bytes is shorter than the 32-byte header`);
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const revision = dv.getUint32(4, true);
  const chunks = [];
  let off = 32;
  while (off < bytes.length) {
    /* Fewer than eight bytes left cannot be a chunk.  Stray bytes are a
     * truncated or padded file; neither is something to guess past. */
    if (off + 8 > bytes.length)
      throw new UnifError(`UNIF: ${bytes.length - off} stray byte(s) at ${off} after the last chunk ` +
                          `— the container is truncated or malformed`);
    const id = String.fromCharCode(bytes[off], bytes[off + 1], bytes[off + 2], bytes[off + 3]);
    /* A chunk id is four printable characters.  Once the walk is out of step
     * every later offset is wrong, so this is a refusal, not a skip. */
    if (!/^[\x21-\x7e]{4}$/.test(id))
      throw new UnifError(`UNIF: byte ${off} should start a chunk id and reads ` +
                          `${JSON.stringify(id)} — the container is malformed`);
    const len = dv.getUint32(off + 4, true);
    if (off + 8 + len > bytes.length)
      throw new UnifError(`UNIF: chunk ${id} at ${off} declares ${len} bytes and the file has ` +
                          `${bytes.length - off - 8} — the container is truncated or malformed`);
    if (chunks.some((c) => c.id === id))
      throw new UnifError(`UNIF: chunk ${id} appears twice (again at ${off}) — ambiguous, refused`);
    chunks.push({ id, off: off + 8, len });
    off += 8 + len;
  }
  return { revision, chunks, end: off };
}

/* NUL-terminated text, surrounding whitespace stripped.  Exported so the
 * census reads MAPR exactly as the loader does. */
export function unifText(bytes, c) {
  let s = '';
  for (let i = 0; i < c.len; i++) { if (bytes[c.off + i] === 0) break; s += String.fromCharCode(bytes[c.off + i]); }
  return s.trim();
}

export function parseUNIF(bytes) {
  const { revision, chunks } = unifChunks(bytes);
  const find = (id) => chunks.find((c) => c.id === id);

  const maprChunk = find('MAPR');
  if (!maprChunk) throw new UnifError('UNIF: no MAPR chunk, so the file does not say what board it is');
  const board = unifText(bytes, maprChunk);
  if (!board) throw new UnifError('UNIF: the MAPR chunk is empty, so the file does not say what board it is');

  /* The parts, gathered in INDEX order -- see the header note. */
  const HEX = '0123456789ABCDEF';
  const gather = (prefix) => {
    const parts = [];
    for (let i = 0; i < 16; i++) {
      const c = find(prefix + HEX[i]);
      if (c) parts.push(c);
    }
    let total = 0;
    for (const c of parts) total += c.len;
    const buf = new Uint8Array(total);
    let at = 0;
    for (const c of parts) { buf.set(bytes.subarray(c.off, c.off + c.len), at); at += c.len; }
    return { buf, n: parts.length };
  };
  const prg = gather('PRG');
  const chr = gather('CHR');
  if (!prg.buf.length) throw new UnifError(`UNIF: board ${board} has no program part (PRG0-PRGF)`, board);

  const mirrChunk = find('MIRR');
  const mirr = mirrChunk && mirrChunk.len >= 1 ? bytes[mirrChunk.off] : 0;
  if (mirr >= MIRR_TO_CIRAM.length)
    throw new UnifError(`UNIF: MIRR is ${mirr}; the format defines 0-5 — refused`, board);

  /* The board lookup comes LAST, so a malformed file is refused as malformed
   * whatever board it names. */
  const known = resolveBoard(board);
  if (!known) {
    const u = UNIF_UNSERVED[board];
    throw new UnifError(
      `UNIF board ${board} has no chip in this core` +
      (u ? ` (documented as mapper ${u.cand}; ${u.files} file${u.files === 1 ? ' tested carries' : 's tested carry'} it)` : '') +
      `. REFUSED BY NAME rather than loaded as a guessed mapper number.`, board, 'board');
  }
  if (known.needs)
    throw new UnifError(`UNIF board ${board} needs ${known.needs}. REFUSED BY NAME rather than loaded ` +
                        `onto a chip that lacks it.`, board, 'needs');

  /* MIRR 5 means "the chip sets it": nothing is stored and the chip's
   * power-on decides.  An ABSENT MIRR is read as 0 (horizontal), the format's
   * zero value; the census measured 145 of 151 well-formed files carry one. */
  const wired = MIRR_TO_CIRAM[mirr];
  const ciram = wired === null ? CIRAM.A11 : wired;

  /* BATR is a boolean byte; a present chunk with no byte is read as true. */
  const batr = find('BATR');
  const battery = batr ? (batr.len === 0 || bytes[batr.off] !== 0 ? 1 : 0) : 0;
  /* VROR: the character part is RAM, preloaded with the CHR bytes given.
   * No file in this library carries it; implemented to the format page. */
  const vror = find('VROR');
  const vrorOn = vror ? (vror.len === 0 || bytes[vror.off] !== 0) : false;
  const tvci = find('TVCI');

  const chrSize = chr.buf.length;
  const chrIsRam = chrSize === 0 || vrorOn ? 1 : 0;
  return {
    container: 'UNIF', revision, board, boardWhy: known.why, boardSrc: known.src,
    prg: prg.buf,
    chr: chrSize ? chr.buf : null,
    prgSize: prg.buf.length,
    chrSize,
    mapper: known.mapper,
    submapper: known.sub ?? 0,
    chrIsRam,
    chrRamSize: chrIsRam ? (chrSize || 8192) : 0,
    /* The board row's second character part:
     * RAM beside the firmware, handed over with nes_set_chr_ram2. */
    chrRam2Size: (!chrIsRam && known.chrRam2) ? known.chrRam2 * 1024 : 0,
    /* UNIF has no work-RAM size field, so the 8 KB floor applies for exactly
     * the reason it applies to plain iNES -- see parseINES -- and mapper 5 is
     * given 64 KB for the same reason as there. */
    prgRamSize: known.mapper === 5 ? 0x10000 : 8192,
    ciram,
    mirrorByChip: wired === null,
    battery,
    trainer: 0,
    nes2: false,
    tv: tvci && tvci.len >= 1 ? bytes[tvci.off] : null,
    name: find('NAME') ? unifText(bytes, find('NAME')) : null,
    prgParts: prg.n,
    chrParts: chr.n,
  };
}

/* THE ONE PLACE A FORMAT IS CHOSEN, and it chooses on CONTENT.  Four of this
 * library's UNIF files are named `.nes`, and nothing here ever sees a filename
 * anyway -- the browser shell hands over bytes.  NesCore.loadCartridge() calls
 * this; test/native_main.c and test/boot_sweep_main.c dispatch the same way,
 * on the first four bytes. */
export function parseCart(bytes) {
  const b = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  return isUNIF(b) ? parseUNIF(b) : parseINES(b);
}

export class NesCore {
  constructor(instance) {
    this.x = instance.exports;
    this.mem = this.x.memory;
    /* See the header comment: the end of the INITIAL memory, never
     * __stack_pointer. */
    this._brk = this.mem.buffer.byteLength;
    this.ctx = 0;
    this.abi = this.x.nes_abi_version();
  }

  static async load(url, fetchImpl = fetch) {
    /* FETCHED WHOLE, NOT STREAMED.  A save state names the core
     * artefact that took it by its sha256 (stateIdent below), and a streamed
     * compile never hands the bytes over to be hashed.  This also retires the
     * old two-path shape -- instantiateStreaming, then a second fetch if the
     * server got the MIME type wrong -- because instantiate() on the bytes has
     * no MIME requirement at all.  The artefact is ~170 KB; streaming it bought
     * nothing measurable. */
    const buf = await (await fetchImpl(url)).arrayBuffer();
    const { instance } = await WebAssembly.instantiate(buf, {});
    const c = new NesCore(instance);
    c._coreBytes = new Uint8Array(buf);
    return c;
  }

  static async fromBytes(bytes) {
    const { instance } = await WebAssembly.instantiate(bytes, {});
    const c = new NesCore(instance);
    c._coreBytes = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
    return c;
  }

  _alloc(n) {
    const p = this._brk;
    this._brk = (this._brk + n + 15) & ~15;
    const need = Math.ceil(this._brk / 65536);
    const have = this.mem.buffer.byteLength / 65536;
    /* Grow with headroom: every grow DETACHES the old ArrayBuffer, so every
     * cached view goes stale.  Growing rarely is what keeps _views() honest. */
    if (need > have) this.mem.grow(need - have + 16);
    return p;
  }

  get u8() { return new Uint8Array(this.mem.buffer); }

  /* Load a cartridge and power on.  Safe to call again for a different
   * cartridge;
   * allocations are not reclaimed, which is deliberate — a bump allocator that
   * frees is a bug farm, and a fresh instance costs a few milliseconds. */
  loadCartridge(bytes, region = REGION.AUTO, opt = {}) {
    /* parseCart, not parseINES: the container is chosen on content here, so a
     * UNIF file reaches the core and a refused one throws its reason. */
    let c;
    try { c = parseCart(bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes)); }
    catch (e) {
      if (e instanceof UnifError) throw e;
      throw new CartError(String(e && e.message || e), 'This file is damaged or is not an NES cartridge file, so it cannot start.', 'container');
    }
    if (c.container !== 'UNIF' && !DISPATCHED.has(c.mapper))
      throw new CartError(`iNES mapper ${c.mapper} has no chip in this core. REFUSED BY NAME rather than run on straight-through banking.`,
        `This cartridge is built on a chip (mapper ${c.mapper}) that this emulator does not have yet, so it cannot start.`, 'mapper');
    /* MAPPER 111 IS TWO BOARDS: with character firmware it
     * is the Ninja Ryukenden (Ch) board, which the core has; with character RAM
     * it is GTROM, which it has not -- refused by name, as before. */
    /* GTROM is now built, so the refusal is gone.  The board's 32 KB of
     * RAM (two pattern pages and two nametable pages) is given whatever the header says: see parseINES. */
    /* The medium's identity is the file AS GIVEN, header and all -- see
     * mediumSha below.  Kept by reference and hashed on first ask. */
    this._mediumBytes = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
    this._mediumSha = null;
    /* opt.submapper SEATS THE CARTRIDGE ON A CHIP ITS CONTAINER CANNOT NAME --
     * the board's `board_submapper`.  The native harness takes
     * the same value as --board-submapper; the two must agree or the cross-host
     * check is comparing two different consoles (web/selfcheck.mjs).  The
     * container's own value is kept beside it so a result can name both.
     * */
    if (Number.isInteger(opt.submapper)) { c.containerSubmapper = c.submapper; c.submapper = opt.submapper; }
    this.cart = c;

    const ctxSize = this.x.nes_sizeof_context();
    this.ctx     = this._alloc(ctxSize);
    this.pPrg    = this._alloc(c.prgSize);
    /* The sizes come from the container, not from a constant. See parseINES:
     * hard-coding 8 KB here is what gave a 32 KB character-RAM part 8 KB and
     * an unidentified mapper 5 board one eighth of its work RAM. */
    this.chrBytes = c.chrIsRam ? c.chrRamSize : c.chrSize;
    this.pChr    = this._alloc(this.chrBytes);
    this.prgRamBytes = c.prgRamSize;
    /* _alloc(0) is legal and returns a pointer nothing will be read through:
     * prg_ram_size 0 is a board with no RAM fitted, which the mapper suite
     * deliberately tests for. */
    this.pPrgRam = this._alloc(this.prgRamBytes);
    this.pAudio  = this._alloc(4096 * 2);

    const u8 = this.u8;
    u8.fill(0, this.ctx, this.ctx + ctxSize);
    u8.set(c.prg, this.pPrg);
    if (c.chr) u8.set(c.chr, this.pChr); else u8.fill(0, this.pChr, this.pChr + this.chrBytes);
    /* THE TRAINER GOES AT $7000.
     * Work RAM is $6000-$7FFF, so $7000 is offset $1000.  All three loaders
     * used to discard it; measured over 28 FFE copier cartridges with
     * tools/ffe_boot.mjs, 4 drew with it discarded and 16 with it placed.
     * The copier BIOS's documented `JSR $7003` at reset was measured as well
     * and is NOT done: it scored 14 of 28, two fewer than placement alone. */
    if (SAVE_FILL.enabled && c.battery && this.prgRamBytes)
      u8.fill(SAVE_FILL.value & 0xff, this.pPrgRam, this.pPrgRam + this.prgRamBytes);
    /* a row of the fresh-save table names this cartridge's own byte; everything else starts at the
     * default (SAVE_INIT_DEFAULT, $00 -- the allocator's zero). */
    else if (c.saveInit && c.saveInit.fill !== null && c.battery && this.prgRamBytes)
      u8.fill(c.saveInit.fill & 0xff, this.pPrgRam, this.pPrgRam + this.prgRamBytes);
    else if (SAVE_INIT_DEFAULT && c.battery && this.prgRamBytes)
      u8.fill(SAVE_INIT_DEFAULT & 0xff, this.pPrgRam, this.pPrgRam + this.prgRamBytes);
    if (c.saveInit) console.info(`[saveinit] ${[c.saveInit.fill !== null ? `fresh save $${c.saveInit.fill.toString(16).toUpperCase().padStart(2, '0')}` : '',
      c.saveInit.from ? `board ${c.saveInit.from.mapper}.${c.saveInit.from.submapper} -> ${c.mapper}.${c.submapper} (${c.saveInit.board})` : ''].filter(Boolean).join('; ')} (fresh-save table)`);
    if (c.trainerData) u8.set(c.trainerData, this.pPrgRam + 0x1000);

    if (region === REGION.AUTO) region = c.region ?? REGION.NTSC;
    this.x.nes_init(this.ctx, region);
    /* The divider must be set BEFORE the first cycle runs.  Setting it after a
     * run silently discards nothing and produces a correct-looking but EMPTY
     * read — measured: peak amplitude 0 over 4096 samples on a title screen
     * that is audibly playing. */
    this.x.nes_audio_set_divider(this.ctx, this.audioDivider || 40);
    this.x.nes_set_cart(this.ctx, this.pPrg, c.prgSize, this.pChr, this.chrBytes,
                        this.pPrgRam, this.prgRamBytes, c.mapper, c.ciram,
                        c.chrIsRam, c.battery, c.submapper);
    /* A second (RAM) character part, from the header-correction table. */
    if (c.chrRam2Size && this.x.nes_set_chr_ram2) {
      const p2 = this._alloc(c.chrRam2Size);
      this.u8.fill(0, p2, p2 + c.chrRam2Size);
      this.x.nes_set_chr_ram2(this.ctx, p2, c.chrRam2Size);
    }
    /* a miscellaneous part (mapper 355's microcontroller program) is lent before power-on. */
    if (c.misc && c.misc.length && this.has('nes_set_misc')) {
      const pm = this._alloc(c.misc.length);
      this.u8.set(c.misc, pm);
      this.x.nes_set_misc(this.ctx, pm, c.misc.length);
    }
    /* VISIBLE, ALWAYS: an overridden header is named in the console. */
    if (c.headerFix) console.info(`[hdrfix] content CRC ${c.headerFix.crc}: ${c.headerFix.text} (header -> table, TABLE-READ; ?hdrfix=0 turns this off)`);
    /* WHICH PERIPHERAL THE TITLE WANTS.
     * THE RULE, identical to test/periph.inc periph_detect(): NES 2.0 byte 15
     * non-zero is believed; else the input table's row (TABLE-READ, keyed by
     * the CRC-32 of program then character firmware); else 0.  Set before
     * power-on so the first strobe already sees the right device. */
    this.inputSource = 'none';
    let dev = c.expansion || 0;
    if (dev) this.inputSource = 'header';
    else { dev = inputDeviceFor(crc32parts(c.prg, c.chr)); if (dev) this.inputSource = 'table'; }
    this.x.nes_set_expansion_device(this.ctx, dev);
    /* opt.ramFill: a DECLARED power-on fill for one
     * test row -- the acceptance suite's nestest, whose golden log was recorded
     * under zero (test/BOARD-ROWS.json power_on_fill).  Mode numbers are the
     * core's (0 zero, 1 ones, 2 pattern, 3 random).  Applied only where the
     * core exports the setter (INSTRUMENT in the ABI); the player never passes it. */
    if (Number.isInteger(opt.ramFill) && this.has('nes_set_ram_fill')) this.x.nes_set_ram_fill(this.ctx, opt.ramFill, 0);
    /* the keyboard, attached before power-on so the program's first
     * scan already finds it.  this.kbAttached tells the shell to route keys. */
    this.kbAttached = false;
    if (dev === DEVICE_FAMILY_KEYBOARD && KB_AUTO.enabled && this.has('nes_kb_attach')) {
      this.x.nes_kb_attach(this.ctx, 1);
      this.kbAttached = true;
    }
    this.x.nes_power_on(this.ctx);
    return c;
  }

  /* ---- THE PERIPHERALS ----------------
   * inputDevice is the NES 2.0 expansion-device number in force; inputSupported
   * is 1 (this core has it), 2 (part of it) or 0 (pads are plugged in instead).
   * The setters are per frame, like setButtons. */
  get inputDevice()    { return this.x.nes_expansion_device(this.ctx); }
  get inputSupported() { return this.x.nes_input_supported(this.inputDevice); }
  portDevice(port)     { return this.x.nes_port_device(this.ctx, port & 1); }
  get expDevice()      { return this.x.nes_exp_device(this.ctx); }
  setExpansionDevice(d){ this.x.nes_set_expansion_device(this.ctx, d & 0x3f); }
  setButtons34(which, mask)        { this.x.nes_set_buttons34(this.ctx, which & 1, mask & 0xff); }
  setZapper(slot, x, y, trigger)   { this.x.nes_set_zapper(this.ctx, slot & 1, x | 0, y | 0, trigger ? 1 : 0); }
  setVaus(knob, fire)              { this.x.nes_set_vaus(this.ctx, knob & 0xff, fire ? 1 : 0); }
  setMat(buttons)                  { this.x.nes_set_mat(this.ctx, buttons & 0xfff); }
  /* ONE MICROPHONE, ONE PATH.  The voice level goes into the core once
   * (nes_set_famicom_mic) and the core hands it to whichever microphone the
   * machine has: controller II's on $4016 D2, and -- once merged with the
   * `coverage` module's mapper 188 -- the Karaoke Studio's on $6000 D2, through
   * inp_mic_level() in src/nes_input.inc.  The site offers one "voice" key. */
  setMic(on) { this.x.nes_set_famicom_mic(this.ctx, on ? 1 : 0); }
  /* THE FAMILY BASIC KEYBOARD.  A key is its place in the matrix:
   * row 0-8, half 0-1, key 0-3 (the peripherals chapter, section 3.8); the map
   * from a PC key to that place is web/shell.js FamilyKeyboard's. */
  kbAttach(on)               { this.x.nes_kb_attach(this.ctx, on ? 1 : 0); this.kbAttached = !!on; }
  kbKey(row, half, key, held){ this.x.nes_kb_key(this.ctx, row, half, key, held ? 1 : 0); }
  get kbReads()              { return this.has('nes_kb_reads') ? this.x.nes_kb_reads(this.ctx) : 0; }

  /* ---- THE DATACH BARCODE READER.  Only a
   * Datach cartridge (mapper 157) has one.  datachScan swipes a card: a string
   * of 7, 8, 12 or 13 digits (7 / 12 get the check digit a printed card
   * carries); returns true if the swipe started.  datachBusy: a card is passing. */
  get hasBarcode() { return this.has('nes_datach_state') && this.x.nes_datach_state(this.ctx) !== 0; }
  get datachBusy() { return this.has('nes_datach_state') && this.x.nes_datach_state(this.ctx) === 2; }
  datachScan(digits) {
    const s = String(digits).replace(/\s+/g, '');
    if (!/^(\d{7}|\d{8}|\d{12}|\d{13})$/.test(s) || !this.has('nes_datach_scan')) return false;
    let a = 0, b = 0;
    for (let i = 0; i < s.length; i++) { const d = s.charCodeAt(i) - 48; if (i < 8) a += d * 2 ** (4 * i); else b += d * 2 ** (4 * (i - 8)); }
    return !!this.x.nes_datach_scan(this.ctx, a >>> 0, b >>> 0, s.length);
  }

  /* ---- THE FAMICOM DATA RECORDER.
   * Its jacks are on the keyboard, so it does nothing unless the
   * keyboard is attached (kbAttached).  Tapes are 8-bit unsigned mono PCM;
   * web/data-recorder.js turns a WAV file into that and a recording back
   * into a WAV file.  Both buffers are placed in linear memory ONCE per size
   * and reused (the allocator never frees), and are lent to the core. */
  get hasDataRecorder() { return this.has('nes_dr_insert') && !!this.x.nes_dr_state(this.ctx, 13); }
  drInsert(pcm, rate) {
    if (!this._drTape || this._drTapeCap < pcm.length) { this._drTape = this._alloc(pcm.length); this._drTapeCap = pcm.length; }
    this.u8.set(pcm, this._drTape);
    return this.x.nes_dr_insert(this.ctx, this._drTape, pcm.length, rate >>> 0);
  }
  drEject() { this.x.nes_dr_eject(this.ctx); }
  /* A blank tape of `seconds` at `rate` for RECORD (default 5 minutes). */
  drBlank(seconds = 300, rate = 32000) {
    const n = Math.max(1, Math.round(seconds * rate));
    if (!this._drRec || this._drRecCap < n) { this._drRec = this._alloc(n); this._drRecCap = n; }
    return this.x.nes_dr_record_buffer(this.ctx, this._drRec, n, rate >>> 0);
  }
  drPlay()   { return this.x.nes_dr_command(this.ctx, 1); }
  drRecord() { return this.x.nes_dr_command(this.ctx, 2); }
  drStop()   { return this.x.nes_dr_command(this.ctx, 0); }
  drSeek(sample) { this.x.nes_dr_seek(this.ctx, sample >>> 0); }
  /* { mode: 'stop'|'play'|'record', head, samples, rate, recorded, reads,
   *   edges, overflow, ended } -- cheap, safe to read every frame. */
  get drState() {
    const s = (w) => this.x.nes_dr_state(this.ctx, w);
    return { mode: ['stop', 'play', 'record'][s(0)] || 'stop', head: s(1), samples: s(2), rate: s(3),
             recorded: s(4), reads: s(5), edges: s(6), overflow: s(7), ended: !!s(8), tape: !!s(9), blank: !!s(10) };
  }
  /* The recorded samples, copied out (the core keeps writing its buffer). */
  drRecording() {
    const n = this.x.nes_dr_state(this.ctx, 4);
    return this._drRec ? this.u8.slice(this._drRec, this._drRec + n) : new Uint8Array(0);
  }

  /* ---- THE DISK SYSTEM ---------------------------------------------------
   *
   * The Disk System is not a cartridge and the container is not iNES.  The RAM
   * adapter is 32 KB of program RAM, 8 KB of character RAM and the drive's own
   * 8 KB firmware mapped at $E000; mapper 20 is the container world's name for
   * "this is not a cartridge at all".
   *
   * THE FIRMWARE IS PART OF THE MACHINE UNDER TEST and it is not ours to ship:
   * a disk image is loaded BY that program, not by the console.  The caller
   * supplies both, from the user's own disk.  Nothing here fetches either.
   *
   * THE DISK IS NOT COPIED into the core — nes_set_disk() takes a pointer, like
   * nes_set_cart() — so it is placed in linear memory here, for the same reason
   * parseINES lives here: placement is an ABI problem.
   *
   * The caller must set the disk BEFORE nes_power_on(); the drive's power-on
   * reads the side count.  This method does the whole sequence.
   *
   * IT DOES NOT INSERT.  See web/shell.js FdsDrive: insertion is a timed
   * sequence and putting it here would make the ABI own a policy it cannot
   * measure. */
  loadDiskSystem(bios, disk, region = REGION.NTSC) {
    if (bios.length !== 8192)
      throw new Error(`FDS: drive firmware is ${bios.length} bytes, expected 8192`);
    /* fwNES containers carry a 16-byte header before the sides. Strip it; a
     * length that is then not a whole number of sides is a container this core
     * cannot account for, and an unaccountable container is not run. */
    let d = disk;
    /* The disk's identity is the file as given, like a cartridge's. */
    this._mediumBytes = disk; this._mediumSha = null;
    if (d.length >= 16 && d[0] === 0x46 && d[1] === 0x44 && d[2] === 0x53 && d[3] === 0x1a)
      d = d.subarray(16);
    if (d.length === 0 || d.length % FDS_SIDE_BYTES !== 0)
      throw new Error(`FDS: ${d.length} bytes is not a whole number of ${FDS_SIDE_BYTES}-byte sides`);

    const ctxSize = this.x.nes_sizeof_context();
    this.ctx      = this._alloc(ctxSize);
    this.pPrg     = this._alloc(8192);
    this.chrBytes = 8192;
    this.pChr     = this._alloc(this.chrBytes);
    this.prgRamBytes = 32768;
    this.pPrgRam  = this._alloc(this.prgRamBytes);
    this.pDisk    = this._alloc(d.length);
    this.diskBytes = d.length;
    this.pAudio   = this._alloc(4096 * 2);

    const u8 = this.u8;
    u8.fill(0, this.ctx, this.ctx + ctxSize);
    u8.set(bios, this.pPrg);
    u8.fill(0, this.pChr, this.pChr + this.chrBytes);
    u8.fill(0, this.pPrgRam, this.pPrgRam + this.prgRamBytes);
    u8.set(d, this.pDisk);

    if (region === REGION.AUTO) region = REGION.NTSC;   /* a disk carries no region; the drive is Japanese */
    this.x.nes_init(this.ctx, region);
    this.x.nes_audio_set_divider(this.ctx, this.audioDivider || 40);
    this.x.nes_set_cart(this.ctx, this.pPrg, 8192, this.pChr, this.chrBytes,
                        this.pPrgRam, this.prgRamBytes, 20, CIRAM.A11, 1, 0, 0);
    this.x.nes_set_disk(this.ctx, this.pDisk, d.length);
    this.x.nes_power_on(this.ctx);
    this.cart = { mapper: 20, disk: true, sides: this.x.nes_fds_sides(this.ctx),
                  prgSize: 8192, chrSize: 0, chrIsRam: 1, ciram: CIRAM.A11,
                  battery: 0, submapper: 0, nes2: false, diskBytes: d.length };
    return this.cart;
  }

  fdsEject()        { this.x.nes_fds_eject(this.ctx); }
  fdsInsert(side)   { this.x.nes_fds_insert(this.ctx, side >>> 0); }
  get fdsSides()    { return this.x.nes_fds_sides(this.ctx); }
  get fdsSide()     { return this.x.nes_fds_side(this.ctx); }
  get fdsInserted() { return !!this.x.nes_fds_inserted(this.ctx); }
  get fdsHead()     { return this.x.nes_fds_head(this.ctx); }
  /* The packed drive snapshot, unpacked. It exists so a shell can say WHY
   * nothing happened rather than only that nothing happened. */
  fdsState() {
    const s = this.x.nes_fds_state(this.ctx);
    return { motor: s & 1, xferReset: (s >> 1) & 1, readMode: (s >> 2) & 1,
             ioEnable: (s >> 3) & 1, sndEnable: (s >> 4) & 1, irqEnable: (s >> 5) & 1,
             irqOnByte: (s >> 6) & 1, byteReady: (s >> 7) & 1, endOfHead: (s >> 8) & 1,
             scanning: (s >> 9) & 1, inserted: (s >> 10) & 1,
             writes: this.x.nes_fds_writes(this.ctx), raw: s };
  }

  reset()      { this.x.nes_reset(this.ctx); }
  get frame()  { return this.x.nes_frame(this.ctx); }
  get cycles() { return this.x.nes_cycles(this.ctx); }
  get jammed() { return !!this.x.nes_jammed(this.ctx); }
  get mapper() { return this.x.nes_mapper_num(this.ctx); }

  /* BOTH PORTS. The console has two, the ABI has always taken the index, and
   * the bench only ever drove port 0 — so every two-player title in the
   * library was unreachable in the browser while the core was fine. `port` is
   * masked to one bit by the core; passing anything else is a caller bug and
   * is not silently widened here. */
  setButtons(port, mask) { this.x.nes_set_buttons(this.ctx, port & 1, mask & 0xff); }
  buttons(port)          { return this.x.nes_buttons(this.ctx, port & 1); }
  /* How many times the cartridge actually clocked each port's shift register,
   * and how many strobes it wrote. A title that reads zero times is not
   * reading the pad, which is a different fault from a pad that reads wrong. */
  padReads(port)   { return this.x.nes_pad_reads(this.ctx, port & 1); }
  get padStrobes() { return this.x.nes_pad_strobes(this.ctx); }

  get region()   { return this.x.nes_region_get(this.ctx); }
  get ciramSrc() { return this.x.nes_ciram_src(this.ctx); }

  /* Instrument-grade stepping and peeking. These are what the ladder driver
   * uses, and they are here rather than in the ladder because they are the
   * ABI: nes_peek() reads WITHOUT ticking, which is the property that lets a
   * verdict be read without perturbing the machine that produced it. */
  stepInstruction() { this.x.nes_step_instruction(this.ctx); }
  peek(a)           { return this.x.nes_peek(this.ctx, a & 0xffff); }
  ciramPeek(a)      { return this.x.nes_ciram_peek(this.ctx, a & 0xfff); }
  get ppuStatus()   { return this.x.nes_ppu_status_peek(this.ctx); }

  /* Run until the PPU frame counter advances.
   *
   * NOTE: nes_frames_done() is exported but is NEVER INCREMENTED by the core —
   * it is only zeroed at reset, so it reads 0 forever.  nes_frame() is the
   * real counter.  Recorded in DEFECTS as the host-visible symptom.
   *
   * The chunk size trades call overhead against overshoot.  1024 CPU cycles is
   * ~3% of a frame; measured cost of the boundary loop is under 3% of frame
   * time at 256x240. */
  runFrame(maxCycles = 40000) {
    const start = this.x.nes_frame(this.ctx);
    let spent = 0;
    while (this.x.nes_frame(this.ctx) === start && spent < maxCycles) {
      this.x.nes_run_cycles(this.ctx, 1024);
      spent += 1024;
    }
    return this.x.nes_frame(this.ctx) !== start;
  }

  /* Advance one frame AND STOP ON THE BOUNDARY.
   *
   * runFrame() above runs in 1024-cycle chunks and stops as soon as the frame
   * counter has moved, which OVERSHOOTS into the next frame by up to 1023
   * cycles. For playing a game that is invisible. For an instrument it is not,
   * and the difference was measured rather than argued: the commercial ladder
   * driven with runFrame() reported Super Mario Bros. 3 at ambient 71636 and
   * response 70710 where the board machine said 71500 and 70574 — the same
   * 136 on both, because both are differences against a histogram taken at a
   * moment the two hosts were not at the same place in the frame. EFFECT and
   * the rung agreed, which is exactly what makes it dangerous: the headline
   * matched and two of the five figures did not.
   *
   * WHY IT IS NOT SIMPLY nes_step_instruction IN A LOOP. That is what the
   * board machine does and it is ~30,000 calls across the wasm boundary per
   * frame, which makes a twelve-title ladder run take twenty minutes. The
   * picture unit's own scanline counter says where we are, so the VISIBLE
   * region is covered in chunks and the last two dozen scanlines — which is
   * where the frame counter actually increments, at the wrap to scanline -1 —
   * are stepped instruction by instruction. A 256-cycle chunk is about 2.3
   * scanlines, so a chunk begun at scanline 239 or earlier cannot reach the
   * wrap; the boundary is always found by the exact path.
   *
   * No region constant is duplicated here. The guard is the visible region,
   * which is 240 scanlines on every region this core supports. */
  stepFrame() {
    const x = this.x, c = this.ctx;
    const f = x.nes_frame(c);
    while (x.nes_frame(c) === f && !x.nes_jammed(c)) {
      const sl = x.nes_scanline(c);
      if (sl >= 0 && sl < 240) x.nes_run_cycles(c, 256);
      else x.nes_step_instruction(c);
    }
    return x.nes_frame(c) !== f;
  }

  /* The framebuffer is 256x240 uint16: bits 0-5 are the 2C02 palette index,
   * bits 6-8 are the colour-emphasis bits latched from PPUMASK at that pixel.
   * It is a VIEW INTO LINEAR MEMORY and is invalidated by any memory.grow(),
   * so it is fetched fresh rather than cached. */
  framebuffer() {
    return new Uint16Array(this.mem.buffer, this.x.nes_framebuffer(this.ctx), NES_W * NES_H);
  }

  audioAvailable() { return this.x.nes_audio_available(this.ctx); }

  /* Drain up to `max` signed 16-bit samples. Returns a fresh view of just the
   * samples written — copy it before the next call, the buffer is reused. */
  readAudio(max = 4096) {
    const got = this.x.nes_audio_read(this.ctx, this.pAudio, Math.min(max, 4096));
    return new Int16Array(this.mem.buffer, this.pAudio, got);
  }

  /* ==== PERSISTENCE — src/nes.c SECTION 12 ===================
   * Battery memory and save states.  Every method here works on BYTES and
   * writes nowhere: where a save is kept is the shell's decision (web/store.js
   * BatteryKeeper), and a battery image or a state embeds the title's own
   * memory, so nothing here logs a payload.  Each method is inert, not an
   * error, on a core artefact that predates the exports -- has() says which. */
  has(name) { return typeof this.x[name] === 'function'; }

  /* THE IDENTITY A SAVE STATE CARRIES: the core artefact's sha256, then the
   * medium's.  Hashed on first ask and kept.  coreSha is null for an instance
   * built without its bytes -- there is nothing to hash -- and a state then
   * carries zeros there, which a load also requires. */
  get coreSha()   { if (!this._coreSha && this._coreBytes) this._coreSha = sha256(this._coreBytes); return this._coreSha || null; }
  get mediumSha() { if (!this._mediumSha && this._mediumBytes) this._mediumSha = sha256(this._mediumBytes); return this._mediumSha || null; }
  get mediumShaHex() { const h = this.mediumSha; return h ? hex(h) : null; }
  stateIdent() {
    const id = new Uint8Array(64);
    if (this.coreSha) id.set(this.coreSha, 0);
    if (this.mediumSha) id.set(this.mediumSha, 32);
    return id;
  }

  /* A scratch buffer in linear memory, grown on demand and reused.  It comes
   * from the same bump allocator as everything else, so the cost is one
   * allocation per instance per size class. */
  _scratch(n) {
    if (!this._scr || this._scrLen < n) { this._scr = this._alloc(n); this._scrLen = n; }
    return this._scr;
  }

  /* ---- battery memory ---- */
  get batterySize() { return this.has('nes_battery_size') && this.ctx ? this.x.nes_battery_size(this.ctx) : 0; }
  get batteryDirty() { return this.has('nes_battery_dirty') && this.ctx ? !!this.x.nes_battery_dirty(this.ctx) : false; }
  batteryClean() { if (this.has('nes_battery_clean') && this.ctx) this.x.nes_battery_clean(this.ctx); }
  /* The regions, as {ptr, len}, in the order the image concatenates them. */
  batteryRegions() {
    if (!this.has('nes_battery_regions') || !this.ctx) return [];
    const out = [];
    for (let i = 0, n = this.x.nes_battery_regions(this.ctx); i < n; i++)
      out.push({ ptr: this.x.nes_battery_ptr(this.ctx, i), len: this.x.nes_battery_len(this.ctx, i) });
    return out;
  }
  /* A COPY of the image, or null when the cartridge has no battery.  `clean`
   * marks the memory clean AT THE SAME INSTANT the copy is taken, which is
   * what a host persisting the copy wants: a write the title makes after this
   * call is then dirty again, rather than lost between the copy and the mark. */
  batterySave({ clean = false } = {}) {
    const n = this.batterySize;
    if (!n) return null;
    const p = this._scratch(n);
    const got = this.x.nes_battery_save(this.ctx, p, n);
    if (got !== n) return null;
    const out = new Uint8Array(this.mem.buffer, p, n).slice();
    if (clean) this.batteryClean();
    return out;
  }
  /* Put an image back.  Call after loadCartridge() and before the first
   * frame.  false, with nothing copied, when the size does not match. */
  batteryLoad(bytes) {
    const n = this.batterySize;
    if (!n || !bytes || bytes.length !== n) return false;
    const p = this._scratch(n);
    this.u8.set(bytes, p);
    return this.x.nes_battery_load(this.ctx, p, n) === 1;
  }

  /* ---- save states ---- */
  get stateSize() { return this.has('nes_state_size') && this.ctx ? this.x.nes_state_size(this.ctx) : 0; }
  /* The whole machine, as a copy.  Throws on a core without the export. */
  saveState() {
    if (!this.has('nes_state_save')) throw new Error('this core artefact has no save-state export');
    if (!this.ctx) throw new Error('no machine is mounted');
    const n = this.stateSize;
    const idp = this._scratch(n + 64), sp = idp + 64;
    this.u8.set(this.stateIdent(), idp);
    const got = this.x.nes_state_save(this.ctx, sp, n, idp);
    if (got !== n) throw new Error(`save state: the core wrote ${got} of ${n} bytes`);
    return new Uint8Array(this.mem.buffer, sp, n).slice();
  }
  /* Restore one, or THROW naming the refusal -- the machine is untouched on a
   * refusal.  The error carries `.code`, the core's number. */
  loadState(bytes) {
    if (!this.has('nes_state_load')) throw new Error('this core artefact has no save-state export');
    if (!this.ctx) throw new Error('no machine is mounted');
    const b = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
    const idp = this._scratch(b.length + 64), sp = idp + 64;
    this.u8.set(this.stateIdent(), idp);
    this.u8.set(b, sp);
    const e = this.x.nes_state_load(this.ctx, sp, b.length, idp);
    if (e) {
      const err = new Error(`save state refused: ${this._cstr(this.x.nes_state_error(e))}`);
      err.name = 'StateRefused'; err.code = e;
      throw err;
    }
    return true;
  }
  _cstr(p) { const u = this.u8; let s = ''; for (let i = p; u[i]; i++) s += String.fromCharCode(u[i]); return s; }
}

/* ---- SHA-256 (FIPS 180-4), written here rather than taken from the platform.
 * crypto.subtle exists only in a SECURE context, and this shell is also served
 * over plain HTTP by IP to a television, where it does not exist at all.  A
 * save keyed by a hash the television cannot compute is a save the television
 * cannot find, so the hash is computed the same way everywhere.  Synchronous;
 * checked against the published test vectors by tools/saves_gate.mjs. */
const SHA_K = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2]);
export function sha256(bytes) {
  const len = bytes.length;
  const total = ((len + 9 + 63) >> 6) << 6;
  const m = new Uint8Array(total);
  m.set(bytes); m[len] = 0x80;
  const dv = new DataView(m.buffer);
  dv.setUint32(total - 8, Math.floor(len / 0x20000000)); dv.setUint32(total - 4, (len << 3) >>> 0);
  const H = new Uint32Array([0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
                             0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19]);
  const W = new Uint32Array(64);
  const rotr = (x, n) => (x >>> n) | (x << (32 - n));
  for (let off = 0; off < total; off += 64) {
    for (let t = 0; t < 16; t++) W[t] = dv.getUint32(off + t * 4);
    for (let t = 16; t < 64; t++) {
      const a = W[t - 15], b = W[t - 2];
      const s0 = rotr(a, 7) ^ rotr(a, 18) ^ (a >>> 3), s1 = rotr(b, 17) ^ rotr(b, 19) ^ (b >>> 10);
      W[t] = (W[t - 16] + s0 + W[t - 7] + s1) >>> 0;
    }
    let a = H[0], b = H[1], c = H[2], d = H[3], e = H[4], f = H[5], g = H[6], h = H[7];
    for (let t = 0; t < 64; t++) {
      const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25), ch = (e & f) ^ (~e & g);
      const t1 = (h + S1 + ch + SHA_K[t] + W[t]) >>> 0;
      const S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22), mj = (a & b) ^ (a & c) ^ (b & c);
      const t2 = (S0 + mj) >>> 0;
      h = g; g = f; f = e; e = (d + t1) >>> 0; d = c; c = b; b = a; a = (t1 + t2) >>> 0;
    }
    H[0] += a; H[1] += b; H[2] += c; H[3] += d; H[4] += e; H[5] += f; H[6] += g; H[7] += h;
  }
  const out = new Uint8Array(32), ov = new DataView(out.buffer);
  for (let i = 0; i < 8; i++) ov.setUint32(i * 4, H[i]);
  return out;
}
export const hex = (b) => Array.from(b, (v) => v.toString(16).padStart(2, '0')).join('');
