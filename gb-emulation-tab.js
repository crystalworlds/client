/* ===========================================================================
 * Game Boy (DMG) Emulation tab — gbEmulationTabHTML(d): helpers and the composer of the eight area files
 *
 * Moved verbatim out of index.html (no edits to the code itself) so that
 * documentation work on this tab is independent of work on the main page.
 * Loaded by a plain <script src> tag — deliberately NOT fetch(), because the
 * site must also open from disk over file://, where fetch is blocked.
 * Defines its builder as a top-level function declaration, exactly as before,
 * so it remains a window global and index.html calls it unchanged.
 * =========================================================================== */

/* ===========================================================================
 *  GAME BOY -> EMULATION TAB
 *
 *  A self-contained reference for this site's own DMG core: what it scores,
 *  against what, and what that score is and is not entitled to claim. It cites
 *  no external page on purpose -- a reader should be able to finish here.
 *
 *  THE ONE THING THIS PAGE MUST NOT GET WRONG, and the reason the wording is
 *  laboured: mealybug's `expected/` directory is the SUITE AUTHOR'S OWN
 *  EMULATOR RENDER, carrying his own hedge ("screenshots from my Game Boy
 *  emulator (which I believe to be correct)"). The hardware material is the
 *  separate `photos/` directory. Every pixel count on this page is therefore a
 *  comparison against another emulator's render, NOT against silicon. The
 *  discriminator is "was a pixel count involved, or was a picture read?" --
 *  a count can only ever be computed against the render.
 *
 *  The hardware column exists so a reader can see which rows have a readable
 *  device photograph standing behind the reference image. It says such an image
 *  EXISTS. It does not say any number here was scored against it -- none was.
 * ========================================================================= */

/* name -> [what the cartridge exercises, hardware-verification class].
   Classes are the project's own, from its board-state document:
     hw  = a READABLE device photograph backs this cell's reference image
     att = a photograph exists and is unusable (glare-blown or tonally flat)
     unc = the evidence does not settle it
     nev = no DMG device image of this cartridge exists anywhere            */
const GB_MB_CELLS = [
  ['m2_win_en_toggle',                 'Window enable toggled during the OAM scan, before pixels are drawn.', 'nev'],
  ['m3_bgp_change',                    'The background palette rewritten part-way along a scanline.', 'hw'],
  ['m3_bgp_change_sprites',            'The same palette write, with sprites on the line to merge against.', 'att'],
  ['m3_lcdc_bg_en_change',             'Background switched off and on mid-line.', 'hw'],
  ['m3_lcdc_bg_map_change',            'The background map swapped mid-line, so one line reads two maps.', 'att'],
  ['m3_lcdc_obj_en_change',            'Sprites switched off and on mid-line.', 'att'],
  ['m3_lcdc_obj_en_change_variant',    'The same toggle moved to a different dot.', 'att'],
  ['m3_lcdc_obj_size_change',          'Sprite height changed from 8 to 16 mid-line, between a sprite&rsquo;s two data reads.', 'att'],
  ['m3_lcdc_obj_size_change_scx',      'The same change with the background scrolled, moving every fetch.', 'hw'],
  ['m3_lcdc_tile_sel_change',          'The tile-data base swapped mid-line, so one line reads two tile sets.', 'att'],
  ['m3_lcdc_tile_sel_win_change',      'The same swap landing inside a window fetch.', 'att'],
  ['m3_lcdc_win_en_change_multiple',   'The window switched on and off repeatedly down the frame.', 'hw'],
  ['m3_lcdc_win_en_change_multiple_wx','The same, walked across window positions.', 'unc'],
  ['m3_lcdc_win_map_change',           'The window map swapped mid-line.', 'att'],
  ['m3_obp0_change',                   'A sprite palette rewritten part-way along a line.', 'att'],
  ['m3_scx_high_5_bits',               'Coarse horizontal scroll changed mid-line.', 'att'],
  ['m3_scx_low_3_bits',                'Fine scroll changed mid-line: the bits that lengthen mode 3 itself.', 'att'],
  ['m3_scy_change',                    'Vertical scroll rewritten mid-line.', 'nev'],
  ['m3_window_timing',                 'Exactly when the window takes over the fetcher.', 'att'],
  ['m3_window_timing_wx_0',            'The same, with the window pinned at the screen edge.', 'att'],
  ['m3_wx_4_change',                   'Window position written to 4 mid-line.', 'hw'],
  ['m3_wx_4_change_sprites',           'The same, with sprites competing for the fetcher.', 'att'],
  ['m3_wx_5_change',                   'Window position written to 5: one dot later in the fetch.', 'hw'],
  ['m3_wx_6_change',                   'Window position written to 6.', 'hw'],
];

const GB_EMU_CARTS = [
  ['tetris',      'Tetris',              '1989', 'Nintendo'],
  ['drmario',     'Dr. Mario',           '1990', 'Nintendo'],
  ['marioland',   'Super Mario Land',    '1989', 'Nintendo'],
  ['sml2',        'Super Mario Land 2',  '1992', 'Nintendo'],
  ['zelda',       'Link&rsquo;s Awakening', '1993', 'Nintendo'],
  ['prehistorik', 'Prehistorik Man',     '1994', 'Titus'],
  ['pinball',     'Pinball Deluxe',      '1994', 'GameTek'],
  ['disneyland',  'Tokyo Disneyland',    '1994', 'Tomy'],
];

const GB_HW_CLASS = {
  hw:  ['Silicon-backed',  'A readable photograph of this cartridge on a real Game Boy stands behind the reference image.'],
  att: ['Photo unusable',  'A photograph exists and cannot be read - glare-blown, or the tones do not separate.'],
  unc: ['Unclassified',    'The evidence does not settle it, and the project declines to guess.'],
  nev: ['No photo exists', 'No photograph of this cartridge on a DMG exists anywhere.'],
};

/* ================================================================ APP-D
 * THE INSTRUCTION SET, as data. Index is the opcode byte; each entry is
 * 'MNEMONIC|bytes / T-cycles', and an empty entry is one of the eleven byte
 * values that decode to no instruction at all (appendix D.7). Conditional
 * instructions carry both figures, taken first.
 *
 * The CB page is NOT transcribed -- gbCbOps() generates it from its own
 * rules, because that page is completely regular and a hand-written second
 * table would add 256 fresh chances to be wrong and no information. If you
 * are checking this file against silicon, check the generator, not 256 cells.
 */
const GB_OPS = [
  'NOP|1 / 4', 'LD BC,d16|3 / 12', 'LD (BC),A|1 / 8', 'INC BC|1 / 8', 'INC B|1 / 4', 'DEC B|1 / 4', 'LD B,d8|2 / 8', 'RLCA|1 / 4',
  'LD (a16),SP|3 / 20', 'ADD HL,BC|1 / 8', 'LD A,(BC)|1 / 8', 'DEC BC|1 / 8', 'INC C|1 / 4', 'DEC C|1 / 4', 'LD C,d8|2 / 8', 'RRCA|1 / 4',
  'STOP n8|2 / 8', 'LD DE,d16|3 / 12', 'LD (DE),A|1 / 8', 'INC DE|1 / 8', 'INC D|1 / 4', 'DEC D|1 / 4', 'LD D,d8|2 / 8', 'RLA|1 / 4',
  'JR e8|2 / 12', 'ADD HL,DE|1 / 8', 'LD A,(DE)|1 / 8', 'DEC DE|1 / 8', 'INC E|1 / 4', 'DEC E|1 / 4', 'LD E,d8|2 / 8', 'RRA|1 / 4',
  'JR NZ,e8|2 / 12 or 8', 'LD HL,d16|3 / 12', 'LD (HL+),A|1 / 8', 'INC HL|1 / 8', 'INC H|1 / 4', 'DEC H|1 / 4', 'LD H,d8|2 / 8', 'DAA|1 / 4',
  'JR Z,e8|2 / 12 or 8', 'ADD HL,HL|1 / 8', 'LD A,(HL+)|1 / 8', 'DEC HL|1 / 8', 'INC L|1 / 4', 'DEC L|1 / 4', 'LD L,d8|2 / 8', 'CPL|1 / 4',
  'JR NC,e8|2 / 12 or 8', 'LD SP,d16|3 / 12', 'LD (HL-),A|1 / 8', 'INC SP|1 / 8', 'INC (HL)|1 / 12', 'DEC (HL)|1 / 12', 'LD (HL),d8|2 / 12', 'SCF|1 / 4',
  'JR C,e8|2 / 12 or 8', 'ADD HL,SP|1 / 8', 'LD A,(HL-)|1 / 8', 'DEC SP|1 / 8', 'INC A|1 / 4', 'DEC A|1 / 4', 'LD A,d8|2 / 8', 'CCF|1 / 4',
  'LD B,B|1 / 4', 'LD B,C|1 / 4', 'LD B,D|1 / 4', 'LD B,E|1 / 4', 'LD B,H|1 / 4', 'LD B,L|1 / 4', 'LD B,(HL)|1 / 8', 'LD B,A|1 / 4',
  'LD C,B|1 / 4', 'LD C,C|1 / 4', 'LD C,D|1 / 4', 'LD C,E|1 / 4', 'LD C,H|1 / 4', 'LD C,L|1 / 4', 'LD C,(HL)|1 / 8', 'LD C,A|1 / 4',
  'LD D,B|1 / 4', 'LD D,C|1 / 4', 'LD D,D|1 / 4', 'LD D,E|1 / 4', 'LD D,H|1 / 4', 'LD D,L|1 / 4', 'LD D,(HL)|1 / 8', 'LD D,A|1 / 4',
  'LD E,B|1 / 4', 'LD E,C|1 / 4', 'LD E,D|1 / 4', 'LD E,E|1 / 4', 'LD E,H|1 / 4', 'LD E,L|1 / 4', 'LD E,(HL)|1 / 8', 'LD E,A|1 / 4',
  'LD H,B|1 / 4', 'LD H,C|1 / 4', 'LD H,D|1 / 4', 'LD H,E|1 / 4', 'LD H,H|1 / 4', 'LD H,L|1 / 4', 'LD H,(HL)|1 / 8', 'LD H,A|1 / 4',
  'LD L,B|1 / 4', 'LD L,C|1 / 4', 'LD L,D|1 / 4', 'LD L,E|1 / 4', 'LD L,H|1 / 4', 'LD L,L|1 / 4', 'LD L,(HL)|1 / 8', 'LD L,A|1 / 4',
  'LD (HL),B|1 / 8', 'LD (HL),C|1 / 8', 'LD (HL),D|1 / 8', 'LD (HL),E|1 / 8', 'LD (HL),H|1 / 8', 'LD (HL),L|1 / 8', 'HALT|1 / 4', 'LD (HL),A|1 / 8',
  'LD A,B|1 / 4', 'LD A,C|1 / 4', 'LD A,D|1 / 4', 'LD A,E|1 / 4', 'LD A,H|1 / 4', 'LD A,L|1 / 4', 'LD A,(HL)|1 / 8', 'LD A,A|1 / 4',
  'ADD A,B|1 / 4', 'ADD A,C|1 / 4', 'ADD A,D|1 / 4', 'ADD A,E|1 / 4', 'ADD A,H|1 / 4', 'ADD A,L|1 / 4', 'ADD A,(HL)|1 / 8', 'ADD A,A|1 / 4',
  'ADC A,B|1 / 4', 'ADC A,C|1 / 4', 'ADC A,D|1 / 4', 'ADC A,E|1 / 4', 'ADC A,H|1 / 4', 'ADC A,L|1 / 4', 'ADC A,(HL)|1 / 8', 'ADC A,A|1 / 4',
  'SUB B|1 / 4', 'SUB C|1 / 4', 'SUB D|1 / 4', 'SUB E|1 / 4', 'SUB H|1 / 4', 'SUB L|1 / 4', 'SUB (HL)|1 / 8', 'SUB A|1 / 4',
  'SBC A,B|1 / 4', 'SBC A,C|1 / 4', 'SBC A,D|1 / 4', 'SBC A,E|1 / 4', 'SBC A,H|1 / 4', 'SBC A,L|1 / 4', 'SBC A,(HL)|1 / 8', 'SBC A,A|1 / 4',
  'AND B|1 / 4', 'AND C|1 / 4', 'AND D|1 / 4', 'AND E|1 / 4', 'AND H|1 / 4', 'AND L|1 / 4', 'AND (HL)|1 / 8', 'AND A|1 / 4',
  'XOR B|1 / 4', 'XOR C|1 / 4', 'XOR D|1 / 4', 'XOR E|1 / 4', 'XOR H|1 / 4', 'XOR L|1 / 4', 'XOR (HL)|1 / 8', 'XOR A|1 / 4',
  'OR B|1 / 4', 'OR C|1 / 4', 'OR D|1 / 4', 'OR E|1 / 4', 'OR H|1 / 4', 'OR L|1 / 4', 'OR (HL)|1 / 8', 'OR A|1 / 4',
  'CP B|1 / 4', 'CP C|1 / 4', 'CP D|1 / 4', 'CP E|1 / 4', 'CP H|1 / 4', 'CP L|1 / 4', 'CP (HL)|1 / 8', 'CP A|1 / 4',
  'RET NZ|1 / 20 or 8', 'POP BC|1 / 12', 'JP NZ,a16|3 / 16 or 12', 'JP a16|3 / 16', 'CALL NZ,a16|3 / 24 or 12', 'PUSH BC|1 / 16', 'ADD A,d8|2 / 8', 'RST $00|1 / 16',
  'RET Z|1 / 20 or 8', 'RET|1 / 16', 'JP Z,a16|3 / 16 or 12', 'PREFIX CB|1 / see CB', 'CALL Z,a16|3 / 24 or 12', 'CALL a16|3 / 24', 'ADC A,d8|2 / 8', 'RST $08|1 / 16',
  'RET NC|1 / 20 or 8', 'POP DE|1 / 12', 'JP NC,a16|3 / 16 or 12', '', 'CALL NC,a16|3 / 24 or 12', 'PUSH DE|1 / 16', 'SUB d8|2 / 8', 'RST $10|1 / 16',
  'RET C|1 / 20 or 8', 'RETI|1 / 16', 'JP C,a16|3 / 16 or 12', '', 'CALL C,a16|3 / 24 or 12', '', 'SBC A,d8|2 / 8', 'RST $18|1 / 16',
  'LDH (a8),A|2 / 12', 'POP HL|1 / 12', 'LDH (C),A|1 / 8', '', '', 'PUSH HL|1 / 16', 'AND d8|2 / 8', 'RST $20|1 / 16',
  'ADD SP,e8|2 / 16', 'JP HL|1 / 4', 'LD (a16),A|3 / 16', '', '', '', 'XOR d8|2 / 8', 'RST $28|1 / 16',
  'LDH A,(a8)|2 / 12', 'POP AF|1 / 12', 'LDH A,(C)|1 / 8', 'DI|1 / 4', '', 'PUSH AF|1 / 16', 'OR d8|2 / 8', 'RST $30|1 / 16',
  'LD HL,SP+e8|2 / 12', 'LD SP,HL|1 / 8', 'LD A,(a16)|3 / 16', 'EI|1 / 4', '', '', 'CP d8|2 / 8', 'RST $38|1 / 16'
];

function gbCbOps() {
  const rot = ['RLC', 'RRC', 'RL', 'RR', 'SLA', 'SRA', 'SWAP', 'SRL'];
  const reg = ['B', 'C', 'D', 'E', 'H', 'L', '(HL)', 'A'];
  const out = new Array(256);
  for (let op = 0; op < 256; op++) {
    const r = reg[op & 7], hl = (op & 7) === 6;
    const name = op < 0x40
      ? rot[op >> 3] + ' ' + r
      : (op < 0x80 ? 'BIT' : (op < 0xC0 ? 'RES' : 'SET')) + ' ' + ((op >> 3) & 7) + ',' + r;
    out[op] = name + '|2 / ' + (!hl ? 8 : (op < 0x80 && op >= 0x40 ? 12 : 16));
  }
  return out;
}

function gbOpCell(e) {
  if (!e) return '<td><code>(undefined)</code><br>locks, D.7</td>';  /* same two-part shape as every other cell: a code mnemonic, then one line */
  const i = e.indexOf('|');
  return '<td><code>' + e.slice(0, i) + '</code><br>' + e.slice(i + 1) + '</td>';
}

/* half is 0 for the x0-x7 grid and 8 for the x8-xF grid. */
function gbOpGridHTML(ops, half) {
  let head = '';
  for (let c = 0; c < 8; c++) head += '<th>x' + (half + c).toString(16).toUpperCase() + '</th>';
  let rows = '';
  for (let r = 0; r < 16; r++) {
    rows += '<tr><td><b>' + r.toString(16).toUpperCase() + 'x</b></td>';
    for (let c = 0; c < 8; c++) rows += gbOpCell(ops[r * 16 + half + c]);
    rows += '</tr>';
  }
  /* Each half carries its own label, in a line before it and in its corner cell, so a text parser
   * cannot lay the x8-xF half over the x0-x7 half. */
  const label = half ? 'High half: columns x8 to xF' : 'Low half: columns x0 to x7';
  return '<p><b>' + label + '</b></p><div class="gbemu-scroll"><table class="gbemu-table gbemu-ops"><thead><tr><th>' + (half ? 'High half' : 'Low half') + '</th>' +
    head + '</tr></thead><tbody>' + rows + '</tbody></table></div>';
}

function gbEmuShot(key, alt) {
  return '<img class="gbemu-shot" src="' + imgSrc(key) + '" alt="' + alt + '" loading="lazy" width="160" height="144">';
}

/* ===========================================================================
 * The areas (2 November 2026). The tab is split into eight area
 * files, one per part of the machine, so a builder can read one at a time.
 * Each area file defines its builder as a global function; gbEmulationTabHTML
 * calls them in this order and wraps them, so every anchor of the single-file
 * tab (#gbe-...) still resolves and every old deep link still lands. An area
 * whose file is not loaded is named as not loaded rather than failing.
 * =========================================================================== */
const GB_EMU_AREAS = [
  { key: 'machine', title: 'Overview, build checklist and interface', file: 'gb-machine-emulation-tab.js', fn: 'gbMachineEmulationTabHTML', sections: [['gbe-glossary', 'Glossary'], ['gbe-m1', '1. Clocks, map, and one phase that matters'], ['gbe-m3', '3. Where the machine starts'], ['gbe-gaps', '24. What this page does not cover']] },
  { key: 'cpu', title: 'Processor', file: 'gb-cpu-emulation-tab.js', fn: 'gbCpuEmulationTabHTML', sections: [['gbe-m2', '2. The processor'], ['gbe-ops', 'Appendix D. The instruction set']] },
  { key: 'memory', title: 'Memory, timer, interrupts, transfers, serial, pad', file: 'gb-memory-emulation-tab.js', fn: 'gbMemoryEmulationTabHTML', sections: [['gbe-m4', '4. Timer, DMA, interrupt line'], ['gbe-hw', '5. What a real Game Boy settled'], ['gbe-regs', 'Appendix A. Every register, every bit']] },
  { key: 'ppu', title: 'Picture', file: 'gb-ppu-emulation-tab.js', fn: 'gbPpuEmulationTabHTML', sections: [['gbe-m5', '6. The sprite scan'], ['gbe-1', '7. The decision that decides everything'], ['gbe-2', '8. Step the machine by dots'], ['gbe-3', '9. The fetcher'], ['gbe-4', '10. The two FIFOs'], ['gbe-5', '11. The window is a separate machine'], ['gbe-6', '12. Sprites stall the pipeline'], ['gbe-7', '13. Writes that land mid-line'], ['gbe-8', '14. Interrupts, blocking, power'], ['gbe-addr', 'Appendix C. Tile, map and object addressing'], ['gbe-pipe', 'Appendix E. The picture pipeline, in numbers']] },
  { key: 'apu', title: 'Sound', file: 'gb-apu-emulation-tab.js', fn: 'gbApuEmulationTabHTML', sections: [['gbe-s1', '15. The sound unit is not on the processor&rsquo;s clock'], ['gbe-s2', '16. The square channels'], ['gbe-s3', '17. Wave, noise, and power'], ['gbe-sound-regs', 'Appendix B. The sound registers, and the primitives the refinements modify']] },
  { key: 'mappers', title: 'Cartridges and mappers', file: 'gb-mappers-emulation-tab.js', fn: 'gbMappersEmulationTabHTML', sections: [['gbe-mappers', 'Appendix H. The cartridge mappers, register by register']] },
  { key: 'sgb', title: 'Super Game Boy and link devices', file: 'gb-sgb-emulation-tab.js', fn: 'gbSgbEmulationTabHTML', sections: [['gbe-sgb', 'Appendix A, continued: the Super Game Boy and the link-port devices']] },
  { key: 'acceptance', title: 'Tests and scores', file: 'gb-acceptance-emulation-tab.js', fn: 'gbAcceptanceEmulationTabHTML', sections: [['gbe-9', '18. Traps that cost us weeks'], ['gbe-10', '19. What to test with, in order'], ['gbe-11', '20. How to measure a change'], ['gbe-score', '21. The score, and what a score is worth'], ['gbe-unwinnable', '22. Rows nobody can win honestly'], ['gbe-12', '23. The evidence'], ['gbe-labels', 'Appendix F. Labels, flexibility, and what is not established'], ['gbe-verify', 'Appendix G. The verification scorecard']] }
];

function gbEmuGlobal() { return typeof window !== 'undefined' ? window : globalThis; }

/* The area index: replaces the single-file tab's table of contents, with the
 * same section links grouped by area. */
function gbEmuAreaIndexHTML() {
  const g = gbEmuGlobal();
  let h = '<div class="gbemu-toc"><b>This page in eight areas, one file each</b>';
  for (let i = 0; i < GB_EMU_AREAS.length; i++) {
    const a = GB_EMU_AREAS[i];
    h += '<a href="#gbemu-area-' + a.key + '">' + (i + 1) + '. ' + a.title + '</a>';
  }
  h += '</div>';
  for (let i = 0; i < GB_EMU_AREAS.length; i++) {
    const a = GB_EMU_AREAS[i];
    const loaded = typeof g[a.fn] === 'function';
    h += '<div class="gbemu-toc"><b>' + (i + 1) + '. ' + a.title + ' <span style="font-weight:400">(' + a.file + (loaded ? '' : ', not loaded') + ')</span></b>';
    for (const s of a.sections) h += '<a href="#' + s[0] + '">' + s[1] + '</a>';
    h += '</div>';
  }
  return h;
}

/* One area's HTML, or '' if its file is not loaded. */
function gbEmulationAreaHTML(d, key) {
  const a = GB_EMU_AREAS.find(function (x) { return x.key === key; });
  const f = a && gbEmuGlobal()[a.fn];
  return typeof f === 'function' ? f(d) : '';
}

function gbEmulationTabHTML(d) {
  const g = gbEmuGlobal();
  let h = '<div class="gbemu">';
  for (const a of GB_EMU_AREAS) {
    const f = g[a.fn];
    h += typeof f === 'function' ? f(d)
      : '<div class="gbemu-area" id="gbemu-area-' + a.key + '"><p class="hw-readable">' + a.title + ': its file, <code>' + a.file + '</code>, is not loaded.</p></div>';
  }
  return h + '</div>';
}
