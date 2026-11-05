/* cgb-boot.js — a clean-room Game Boy Color boot stub that carries a chosen
 * palette configuration into the machine.
 *
 * WHY THIS EXISTS, AND WHY IT IS NOT A HACK.
 *
 * A Game Boy Color running an ORIGINAL cartridge separates background, OBJ0 and
 * OBJ1 IN HARDWARE: the machine is in compatibility mode and its framebuffer is
 * true colour, with the three planes drawn through three independent palettes in
 * the console's palette RAM. That separation is the PPU's, not the boot firmware's.
 *
 * All the boot firmware contributes is the VALUES — it hashes the cartridge title,
 * looks the hash up in a table, and writes twelve colours into palette RAM. We
 * have that table (cgb-palettes.js) and that hash (cgb-assign.js), so we can
 * write the same twelve colours ourselves and the console does the rest.
 *
 * Measured, not assumed:
 *   - a CGB machine with NO boot program renders a BLACK screen. The frame is
 *     already BGR555; palette RAM is simply all zeroes. Nothing else is wrong.
 *   - a CGB machine booted with THIS stub reaches a BYTE-IDENTICAL framebuffer
 *     to one booted with the real Nintendo boot firmware, on every cartridge tried,
 *     offset only by the frames the real boot firmware spends animating its logo.
 *
 * So this replaces a 2,304-byte copyrighted boot program that visitors mostly do not have
 * with 256 bytes of our own instructions that produce the same machine. No
 * Nintendo code is reproduced, quoted or required: every byte below is emitted
 * by the assembler in this file, and the only data are colours from the table.
 *
 * ***THIS IS THE ONLY REASON THE FEATURE WORKS FOR EVERY VISITOR.*** Requiring a
 * boot program would have made colour a privilege of people who already own a
 * dump.
 *
 * NO DOM, NO CORE, NO I/O — a function from a palette configuration to bytes, so
 * tools/cgb_assign_test.mjs can check it outside a browser.
 */

import { hexToRgb } from "./cgb-assign.js";

/* Hardware registers, by their low byte (the LDH addressing mode covers $FF00
 * plus this). Named rather than numbered because a wrong constant here produces
 * a plausible-looking wrong picture, which is the worst kind of bug to find. */
const R = {
  LCDC: 0x40,   // LCD control
  BGP:  0x47,   // DMG background palette mapping
  OBP0: 0x48,   // DMG object palette 0 mapping
  OBP1: 0x49,   // DMG object palette 1 mapping
  KEY0: 0x4c,   // CPU/compatibility mode select
  BANK: 0x50,   // writing here unmaps the boot program
  BCPS: 0x68,   // background palette index (bit 7 = auto-increment)
  BCPD: 0x69,   // background palette data
  OCPS: 0x6a,   // object palette index (bit 7 = auto-increment)
  OCPD: 0x6b,   // object palette data
};

/* The boot program occupies $0000..$00FF and is unmapped by writing to $FF50.
 * The write must be the LAST thing it does, positioned so that the instruction
 * ENDS at $00FF — the program counter then falls through to $0100, which is
 * where every cartridge's entry point is. That is the handover, and it is why
 * the final two bytes are placed at a fixed address rather than appended. */
const STUB_LEN = 0x100;
const UNMAP_AT = 0xfe;        // LDH ($50),A is two bytes: $00FE and $00FF

/* Values left in the machine at handover. The first is the one that matters and
 * the rest are the ordinary post-boot state a cartridge is entitled to assume.
 *   KEY0 = $04 is THE line that makes this work: it puts the Color into DMG
 * compatibility mode, where BGP/OBP0/OBP1 select among the palettes we are about
 * to write instead of the attribute-driven CGB mapping. Without it the machine
 * runs as a full Color, a DMG cartridge's blank tile attributes select palette 0
 * for everything, and the screen is one flat colour. */
const KEY0_DMG_COMPAT = 0x04;
const LCDC_ON = 0x91;         // LCD on, background on, tile data at $8000
const BGP_INIT = 0xfc;        // shades 3,3,3,0 — the usual post-boot mapping
const OBP_INIT = 0xff;
const A_AT_HANDOVER = 0x11;   // the value a Game Boy Color hands a cartridge
const STACK_TOP = 0xfffe;

/** 5 bits a channel, which is what the hardware stores.
 *  The table's 8-bit hex was produced by round(x*255/31), so this inverts that
 *  exactly rather than shifting — a shift would be off by one on some values and
 *  the error would be invisible until someone compared pixels. */
const to5 = (v) => Math.round((v * 31) / 255);

/** "#RRGGBB" -> the two little-endian bytes the palette data register wants. */
export function colorToBgr555(hex) {
  const [r, g, b] = hexToRgb(hex);
  const v = (to5(b) << 10) | (to5(g) << 5) | to5(r);
  return [v & 0xff, (v >> 8) & 0xff];
}

/**
 * Assemble the boot stub for one palette configuration.
 *
 * @param {{bg:string[],obj0:string[],obj1:string[]}} cfg  four colours each
 * @returns {Uint8Array} exactly 256 bytes
 */
export function cgbBootStub(cfg) {
  if (!cfg || !Array.isArray(cfg.bg) || cfg.bg.length !== 4 ||
      !Array.isArray(cfg.obj0) || cfg.obj0.length !== 4 ||
      !Array.isArray(cfg.obj1) || cfg.obj1.length !== 4) {
    throw new Error("cgb-boot: need a configuration with four colours in each of bg, obj0, obj1");
  }

  const b = [];
  const LD_A = (n) => b.push(0x3e, n & 0xff);          // LD A,n8
  const LDH  = (n) => b.push(0xe0, n & 0xff);          // LDH (n8),A
  const put  = (reg, val) => { LD_A(val); LDH(reg); };

  /* 1. Compatibility mode, before anything reads a palette. */
  put(R.KEY0, KEY0_DMG_COMPAT);

  /* 2. The background palette. Index $80 = entry 0 with auto-increment set, so
   *    the eight data writes walk through the four colours without re-indexing. */
  put(R.BCPS, 0x80);
  for (const hex of cfg.bg) for (const byte of colorToBgr555(hex)) put(R.BCPD, byte);

  /* 3. Both object palettes, the same way. OBJ0 is palette 0 and OBJ1 is
   *    palette 1, so writing the eight colours consecutively lands each in the
   *    right place. THE TWO ARE SEPARATE AND THAT IS THE POINT -- sprites
   *    coloured independently of the background, and of each other, is most of
   *    what makes a colourised original cartridge look right. */
  put(R.OCPS, 0x80);
  for (const hex of cfg.obj0) for (const byte of colorToBgr555(hex)) put(R.OCPD, byte);
  for (const hex of cfg.obj1) for (const byte of colorToBgr555(hex)) put(R.OCPD, byte);

  /* 4. The rest of the post-boot state. A cartridge is entitled to find these
   *    set; leaving them out is the class of bug that renders "nearly right". */
  put(R.BGP, BGP_INIT);
  put(R.OBP0, OBP_INIT);
  put(R.OBP1, OBP_INIT);
  put(R.LCDC, LCDC_ON);
  b.push(0x31, STACK_TOP & 0xff, (STACK_TOP >> 8) & 0xff);   // LD SP,$FFFE
  LD_A(A_AT_HANDOVER);                                        // A = $11

  if (b.length > UNMAP_AT) {
    throw new Error(`cgb-boot: stub is ${b.length} bytes and must fit before $${UNMAP_AT.toString(16)}`);
  }
  while (b.length < UNMAP_AT) b.push(0x00);                   // NOP padding
  LDH(R.BANK);                                                // unmap; PC -> $0100

  if (b.length !== STUB_LEN) throw new Error(`cgb-boot: assembled ${b.length} bytes, expected ${STUB_LEN}`);
  return new Uint8Array(b);
}

/** A stable key for caching one stub per configuration. */
export function cgbBootKey(cfg) {
  return "cgbpal:" + cfg.bg.join("") + cfg.obj0.join("") + cfg.obj1.join("");
}
