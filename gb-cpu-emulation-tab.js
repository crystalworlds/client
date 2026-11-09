/* ===========================================================================
 * Game Boy Emulation tab, area 2 of eight: Processor
 * gbCpuEmulationTabHTML(d) returns this area's HTML; the tab's composer in
 * gb-emulation-tab.js calls every area in order (2 November 2026: the tab
 * was split into area files so a builder can read one area at a time).
 * Loaded by a plain <script src> tag (the site must open over file://).
 * =========================================================================== */

function gbCpuEmulationTabHTML(d) {
  return '<div class="gbemu-area" id="gbemu-area-cpu">' +

  '<section class="sect gbemu-area-head" id="gbemu-area-cpu-head"><h3 class="sect-h">Area 2 of eight: Processor</h3>' +
    '<p class="gbemu-key">The processor: section 2 and appendix D entire, that is the opcode grids, the instruction glossary, flags, DAA, the undefined opcodes, HALT and its bug, STOP, interrupt dispatch and where a request is noticed (the running processor&rsquo;s look), and which machine cycle carries which bus access.</p>' +
    '<p class="hw-readable">This area is the file <code>gb-cpu-emulation-tab.js</code>, one of the eight area files that together make the Game Boy Emulation tab. It can be read on its own; the build checklist is in the first area, and the rule for what a build must implement is beside it.</p>' +
    '<p class="hw-readable"><b>Where the rest of this page is.</b> When a sentence here points to a section or appendix that is not in this area, it is in one of these files (the links work on the assembled page):</p><ul class="gbemu-bullets"><li><b>Overview, build checklist and interface</b> (<code>gb-machine-emulation-tab.js</code>): <a href="#gbe-m1">1. Clocks, map, and one phase that matters</a> <a href="#gbe-m3">3. Where the machine starts</a> <a href="#gbe-gaps">24. What this page does not cover</a></li><li><b>Memory, timer, interrupts, transfers, serial, pad</b> (<code>gb-memory-emulation-tab.js</code>): <a href="#gbe-m4">4. Timer, DMA, interrupt line</a> <a href="#gbe-hw">5. What a real Game Boy settled</a> <a href="#gbe-regs">Appendix A. Every register, every bit</a></li><li><b>Picture</b> (<code>gb-ppu-emulation-tab.js</code>): <a href="#gbe-m5">6. The sprite scan</a> <a href="#gbe-1">7. The decision that decides everything</a> <a href="#gbe-2">8. Step the machine by dots</a> <a href="#gbe-3">9. The fetcher</a> <a href="#gbe-4">10. The two FIFOs</a> <a href="#gbe-5">11. The window is a separate machine</a> <a href="#gbe-6">12. Sprites stall the pipeline</a> <a href="#gbe-7">13. Writes that land mid-line</a> <a href="#gbe-8">14. Interrupts, blocking, power</a> <a href="#gbe-addr">Appendix C. Tile, map and object addressing</a> <a href="#gbe-pipe">Appendix E. The picture pipeline, in numbers</a></li><li><b>Sound</b> (<code>gb-apu-emulation-tab.js</code>): <a href="#gbe-s1">15. The sound unit is not on the processor&rsquo;s clock</a> <a href="#gbe-s2">16. The square channels</a> <a href="#gbe-s3">17. Wave, noise, and power</a> <a href="#gbe-sound-regs">Appendix B. The sound registers, and the primitives the refinements modify</a></li><li><b>Cartridges and mappers</b> (<code>gb-mappers-emulation-tab.js</code>): <a href="#gbe-mappers">Appendix H. The cartridge mappers, register by register</a></li><li><b>Super Game Boy and link devices</b> (<code>gb-sgb-emulation-tab.js</code>): <a href="#gbe-sgb">Appendix A, continued: the Super Game Boy and the link-port devices</a></li><li><b>Tests and scores</b> (<code>gb-acceptance-emulation-tab.js</code>): <a href="#gbe-9">18. Traps that cost us weeks</a> <a href="#gbe-10">19. What to test with, in order</a> <a href="#gbe-11">20. How to measure a change</a> <a href="#gbe-score">21. The score, and what a score is worth</a> <a href="#gbe-unwinnable">22. Rows nobody can win honestly</a> <a href="#gbe-12">23. The evidence</a> <a href="#gbe-labels">Appendix F. Labels, flexibility, and what is not established</a> <a href="#gbe-verify">Appendix G. The verification scorecard</a></li></ul>' +
  '</section>' +
  '<div class="gbemu-toc"><b>In this area</b><a href="#gbe-m2">2. The processor</a><a href="#gbe-ops">Appendix D. The instruction set</a></div>' +

  '<section class="sect" id="gbe-m2"><h3 class="sect-h">2. The processor</h3>' +
    '<p class="hw-readable">A Sharp SM83. It is <em>not</em> a Z80 and not an 8080, and reaching for ' +
    'either as a starting point costs more than writing it out: no IX/IY, no alternate register set, ' +
    'no block instructions, different flags, and a handful of opcodes that exist nowhere else.</p>' +
    '<div class="gbemu-rule" id="gbr-2-1"><b>Rule 2/1.</b> The machine must be stepped one machine cycle at a time, not one instruction at a time. Inside each machine cycle the timer, the picture processor and any transfer in flight must be advanced. An instruction that takes five machine cycles must let five machine cycles of everything else happen between its own bus accesses.</div>' +
    '<div class="gbemu-why"><b>Why.</b> Stepped per instruction, every mid-instruction interaction on this page is unreachable. Rule D.1/3 states what is observable (how many machine cycles elapse, and which one carries each bus access), and D.12 places each access.</div>' +
    '<p class="hw-readable"><b>Everything else about the processor is in appendix D, each rule stated once.</b> The five points builders get wrong most often, and where each is stated:</p>' +
    '<ul class="gbemu-bullets">' +
      '<li><b>The flag register has no low nibble</b>, and pushing and popping AF must keep it at 0: Rule D.2/1.</li>' +
      '<li><b>Interrupt dispatch</b>, its five machine cycles and what it clears: Rules D.10/1 to D.10/3, cycle by cycle in D.12.2.</li>' +
      '<li><b>Where a request is noticed</b> (at instruction boundaries, and nowhere else), the instant on the picture&rsquo;s and the timer&rsquo;s clocks, and the running processor&rsquo;s look: Rules D.10.1/1 to D.10.1/7.</li>' +
      '<li><b>EI takes effect after the NEXT instruction, not immediately; DI is immediate</b>; a dispatch cancels an enable still in flight: Rules D.8/5 to D.8/7.</li>' +
      '<li><b>The HALT bug, and the trap inside it</b> (an EI still in flight does not count as interrupts off): Rules D.8/1 and D.8/2.</li>' +
    '</ul></section>' +

  /* ---------------------------------------------------------------- M3 */
  '<section class="sect" id="gbe-ops"><h3 class="sect-h">Appendix D. The instruction set</h3>' +
    '<p class="hw-readable">Section 2 gives the shape of the processor, the stepping model and the ' +
    'two behaviours people get wrong. It does not list the opcodes, and section 24 scopes them out ' +
    'as <i>&ldquo;well documented elsewhere&rdquo;</i>, which is true and useless to a reader who ' +
    'does not have the elsewhere. This appendix lists them. ' +
    'Everything below is read out of this core&rsquo;s decode paths, so <b>the 51 Blargg rows and ' +
    'the 97 Mooneye rows are what verify it</b>. Both are rows of the public board, broken down by group in appendix G.2; D.10.1&rsquo;s denominators count acceptance cartridges only.</p>' +

    '<h4 class="gbemu-sub">D.1: How to read the tables</h4>' +
    '<div class="gbemu-rule" id="gbr-D-1-1"><b>Rule D.1/1.</b> Each mnemonic must have the effect this table gives, so a build needs no outside knowledge of the instruction set. Flags are D.5&rsquo;s, cycle counts the grids&rsquo; (D.3, D.4), bus order D.12&rsquo;s. Operands: r is B, C, D, E, H, L or A; rr a register pair; (rr) the byte at the address in rr; n8 / d8 an immediate byte, n16 / a16 an immediate 16-bit value stored low byte first; e8 a signed byte.</div>' +
    '<table class="gbemu-table"><thead><tr><th>Mnemonic</th><th>Effect</th></tr></thead><tbody>' +
      '<tr><td><code>LD dst,src</code></td><td>dst = src. <code>(HL+)</code>/<code>(HL-)</code>: use HL, then add or subtract 1. <code>LDH (a8),A</code> / <code>LDH A,(a8)</code>: the address is <code>0xFF00 + a8</code>; <code>LDH (C),A</code> / <code>LDH A,(C)</code> (<code>0xE2</code> / <code>0xF2</code>, this page&rsquo;s one spelling; other references write <code>LD (C),A</code>): <code>(C)</code> means <code>0xFF00 + C</code>. <code>LD (a16),SP</code> stores SP low byte first. <code>LD HL,SP+e8</code>: HL = SP + e8. <code>LD SP,HL</code>: SP = HL</td></tr>' +
      '<tr><td><code>PUSH rr</code> / <code>POP rr</code></td><td>PUSH: SP &minus; 1, write high byte; SP &minus; 1, write low byte. POP: read low byte at SP, SP + 1; read high byte, SP + 1. With AF the low four bits of F read 0</td></tr>' +
      '<tr><td><code>ADD ADC SUB SBC AND XOR OR CP</code></td><td>A = A op operand (ADC/SBC add or subtract the carry too); CP subtracts and keeps only the flags. <code>ADD HL,rr</code>: HL = HL + rr. <code>ADD SP,e8</code>: SP = SP + e8</td></tr>' +
      '<tr><td><code>INC</code> / <code>DEC</code></td><td>add or subtract 1 (8-bit forms set flags as D.5; 16-bit forms set none)</td></tr>' +
      '<tr><td><code>JP a16</code> / <code>JP HL</code> / <code>JR e8</code></td><td>PC = a16; PC = HL; PC = PC + e8, with PC already past the 2-byte instruction. A condition (NZ, Z, NC, C) tests the Z or C flag; if false nothing happens but the shorter cycle count</td></tr>' +
      '<tr><td><code>CALL a16</code> / <code>RST n</code></td><td>push the address of the next instruction, then PC = a16 or PC = n (n = 00, 08, 10, &hellip;, 38)</td></tr>' +
      '<tr><td><code>RET</code> / <code>RETI</code></td><td>pop PC; RETI also sets IME at once</td></tr>' +
      '<tr><td><code>RLCA RRCA RLA RRA</code>, the CB rotates and shifts</td><td>D.5.2, written out</td></tr>' +
      '<tr><td><code>BIT b,x</code> / <code>RES b,x</code> / <code>SET b,x</code></td><td>test bit b (Z = bit clear) / clear it / set it</td></tr>' +
      '<tr><td><code>SWAP x</code></td><td>exchange the two nibbles</td></tr>' +
      '<tr><td><code>CPL</code> / <code>SCF</code> / <code>CCF</code> / <code>DAA</code></td><td>A = NOT A / set carry / invert carry / decimal adjust (D.6)</td></tr>' +
      '<tr><td><code>DI</code> / <code>EI</code> / <code>HALT</code> / <code>STOP</code> / <code>NOP</code></td><td>D.8 to D.10; NOP does nothing</td></tr>' +
    '</tbody></table>' +

    '<p class="hw-readable"><b>Times are T-cycles</b>; one machine cycle is four of them. Every ' +
    'figure is <code>bytes / T-cycles</code>, and a conditional instruction reads ' +
    '<code>taken or not taken</code>.</p>' +
    '<div class="gbemu-rule" id="gbr-D-1-2"><b>Rule D.1/2.</b> Every cycle count in the grids is the sum of three charges, and a build must produce it that way:</div>' +
    '<table class="gbemu-table"><thead><tr><th>Primitive</th><th>Charge</th></tr></thead><tbody>' +
      '<tr><td>Fetching a byte at PC: the opcode, and each immediate byte after it</td><td>one machine cycle</td></tr>' +
      '<tr><td>Any bus read or bus write the instruction performs</td><td>one machine cycle each</td></tr>' +
      '<tr><td>An explicit internal delay with no bus access</td><td>one machine cycle each</td></tr>' +
    '</tbody></table>' +
    '<div class="gbemu-why"><b>Why.</b> <b>None of these counts is a table in this core, and that is the point.</b> ' +
    'They are generated by the three primitives. <b>MECHANISM.</b> An implementer who implements those three rules and puts ' +
    'the internal delays where the tables put them reproduces every count below without transcribing ' +
    'one. An implementer who transcribes the table instead gets the same answers and no way to check ' +
    'them.</div>' +
    '<div class="gbemu-rule" id="gbr-D-1-3"><b>Rule D.1/3.</b> What a build must reproduce is <b>how many machine cycles elapse, and which of them each bus access ' +
    'falls on</b>. How it <em>accounts</em> for cycles is free. <b>The invariant: between ' +
    'an instruction&rsquo;s own bus accesses, the timer, the picture processor and any transfer in ' +
    'flight must be advanced</b> (Rule 2/1). <b>D.12 is the other half of that sentence</b>: the rule ' +
    'for which machine cycle carries which access, and the cases where it is not obvious.</div>' +
    '<div class="gbemu-why"><b>Why.</b> Every mid-line behaviour on this page depends on the placement. An emulator that executes a whole instruction and then charges its total at the ' +
    'end passes Blargg&rsquo;s instruction suite completely and fails Mooneye, every ' +
    'write-lands-mid-line section, and the sprite-memory corruption rows. Read D.12 ' +
    'before you write a single opcode; it is much cheaper than discovering it from a failure ' +
    'pattern.</div>' +
    '<div class="gbemu-rule" id="gbr-D-1-4"><b>Rule D.1/4.</b> <b>Prefix <code>CB</code> is not an instruction.</b> It is one machine ' +
    'cycle of fetch followed by a second fetch that decodes as the CB table, and the counts in the ' +
    'CB grids are the <em>total</em>, prefix included.</div>' +
    '<p class="hw-readable"><b>Two conventions in the mnemonics:</b> ' +
    '<code>d8</code>/<code>d16</code> are unsigned immediates, <code>a8</code>/<code>a16</code> ' +
    'addresses, <code>e8</code> a <b>signed</b> 8-bit displacement; <code>(HL+)</code> and ' +
    '<code>(HL-)</code> access memory at HL and then increment or decrement HL.</p>' +

    '<h4 class="gbemu-sub">D.2: The flag register</h4>' +
    '<table class="gbemu-table"><thead><tr><th>Bit</th><th>7</th><th>6</th><th>5</th><th>4</th><th>3&ndash;0</th></tr></thead><tbody>' +
      '<tr><td>Name</td><td><b>Z</b> zero</td><td><b>N</b> subtract</td><td><b>H</b> half-carry</td><td><b>C</b> carry</td><td>none</td></tr>' +
    '</tbody></table>' +
    '<div class="gbemu-rule" id="gbr-D-2-1"><b>Rule D.2/1.</b> <b>Bits 3&ndash;0 of F do not exist.</b> They must read back zero however they were ' +
    'written, so anything that pushes and pops AF must mask: <code>push af / pop af</code> returns F with its low nibble 0.</div>' +
    '<div class="gbemu-why"><b>Why.</b> In this core that is enforced at exactly one site (the write path that loads ' +
    '<code>AF</code>), so <code>POP AF</code> masks the popped low byte with <code>0xF0</code> ' +
    'and nothing else needs to. <b>The invariant is the read-back, not the mask site</b>: any ' +
    'structure in which the low nibble of F can never be observed as non-zero is correct. Get it ' +
    'wrong and <code>push af / pop af</code> round-trips fail, which is the first thing ' +
    'Blargg&rsquo;s <code>01-special</code> checks.</div>' +

    '<h4 class="gbemu-sub">D.3: The primary opcode map</h4>' +
    '<p class="hw-readable">Rows are the high nibble, columns the low nibble. Each cell is the ' +
    'mnemonic, then <code>bytes / T-cycles</code>; the eleven bytes that are not instructions read <code>(undefined)</code>, then &ldquo;locks, D.7&rdquo;, in the same two-part shape, so a parser that reads the grid as text keeps every column aligned. Low half first.</p>' +
    gbOpGridHTML(GB_OPS, 0) +
    gbOpGridHTML(GB_OPS, 8) +

    '<h4 class="gbemu-sub">D.4: The CB-prefixed map</h4>' +
    gbOpGridHTML(gbCbOps(), 0) +
    gbOpGridHTML(gbCbOps(), 8) +
    '<div class="gbemu-rule" id="gbr-D-4-1"><b>Rule D.4/1.</b> <b><code>0x76</code> must decode as HALT, not as <code>LD (HL),(HL)</code>.</b> It is the one hole ' +
        'punched in the otherwise perfectly regular <code>0x40</code>&ndash;<code>0x7F</code> ' +
        'register-to-register block.</div>' +
    '<div class="gbemu-why"><b>Why.</b> A decoder written as &ldquo;the whole block is ' +
        '<code>LD r,r&rsquo;</code>&rdquo; will halt nothing and hang on the first title that ' +
        'idles.</div>' +
    '<p class="hw-readable">Two more notes the grids cannot carry:</p>' +
    '<ul class="gbemu-bullets">' +
      '<li><b><code>0xCB</code> shows no cycle count</b> because it never completes on its own. Its ' +
        'cost is inside the CB grids (Rule D.1/4).</li>' +
      '<li><b>Eleven cells are empty</b> in the primary map; those byte values decode to no ' +
        'instruction, and D.7 says what happens when one executes. <b>The CB page is completely ' +
        'full</b>: all 256 entries.</li>' +
    '</ul>' +

    '<h4 class="gbemu-sub">D.5: Flag effects, by operation family</h4>' +
    '<div class="gbemu-rule" id="gbr-D-5-1"><b>Rule D.5/1.</b> Each operation must set the four flags as this table gives. <code>0</code> means cleared, <code>1</code> set, and <b>&middot;</b> ' +
    'means <em>unchanged</em> (not &ldquo;undefined&rdquo;: code depends on the flag keeping its value). <code>x</code> is the operand.</div>' +
    '<table class="gbemu-table"><thead><tr><th>Family</th><th>Z</th><th>N</th><th>H</th><th>C</th></tr></thead><tbody>' +
      '<tr><td><code>ADD A,x</code> / <code>ADD A,d8</code></td><td>result = 0</td><td>0</td><td><code>(A&amp;0xF) + (x&amp;0xF) &gt; 0xF</code></td><td><code>A + x &gt; 0xFF</code></td></tr>' +
      '<tr><td><code>ADC A,x</code> / <code>ADC A,d8</code></td><td>result = 0</td><td>0</td><td><code>(A&amp;0xF) + (x&amp;0xF) + carry_in &gt; 0xF</code></td><td><code>A + x + carry_in &gt; 0xFF</code></td></tr>' +
      '<tr><td><code>SUB x</code> / <code>SUB d8</code></td><td>result = 0</td><td>1</td><td><code>(A&amp;0xF) &minus; (x&amp;0xF) &lt; 0</code></td><td><code>A &minus; x &lt; 0</code></td></tr>' +
      '<tr><td><code>SBC A,x</code> / <code>SBC A,d8</code></td><td>result = 0</td><td>1</td><td><code>(A&amp;0xF) &minus; (x&amp;0xF) &minus; carry_in &lt; 0</code></td><td><code>A &minus; x &minus; carry_in &lt; 0</code></td></tr>' +
      '<tr><td><code>CP x</code> / <code>CP d8</code></td><td>as SUB, <b>result discarded</b></td><td>1</td><td>as SUB</td><td>as SUB</td></tr>' +
      '<tr><td><code>AND x</code> / <code>AND d8</code></td><td>result = 0</td><td>0</td><td><b>1</b></td><td>0</td></tr>' +
      '<tr><td><code>OR</code> / <code>XOR</code></td><td>result = 0</td><td>0</td><td>0</td><td>0</td></tr>' +
      '<tr><td><code>INC r</code> (8-bit)</td><td>result = 0</td><td>0</td><td><code>(v &amp; 0xF) == 0xF</code></td><td><b>&middot;</b></td></tr>' +
      '<tr><td><code>DEC r</code> (8-bit)</td><td>result = 0</td><td>1</td><td><code>(v &amp; 0xF) == 0</code></td><td><b>&middot;</b></td></tr>' +
      '<tr><td><code>INC rr</code> / <code>DEC rr</code> (16-bit)</td><td>&middot;</td><td>&middot;</td><td>&middot;</td><td>&middot;</td></tr>' +
      '<tr><td><code>ADD HL,rr</code></td><td><b>&middot;</b></td><td>0</td><td><code>(HL &amp; 0xFFF) + (rr &amp; 0xFFF) &gt; 0xFFF</code></td><td><code>HL + rr &gt; 0xFFFF</code></td></tr>' +
      '<tr><td><code>ADD SP,e8</code> / <code>LD HL,SP+e8</code></td><td><b>0</b></td><td><b>0</b></td><td><code>(SP &amp; 0xF) + (e &amp; 0xF) &gt; 0xF</code></td><td><code>(SP &amp; 0xFF) + (e &amp; 0xFF) &gt; 0xFF</code></td></tr>' +
      '<tr><td><code>RLCA RRCA RLA RRA</code></td><td><b>0 always</b></td><td>0</td><td>0</td><td>the bit shifted out</td></tr>' +
      '<tr><td>CB <code>RLC RRC RL RR SLA SRA SRL</code></td><td>result = 0</td><td>0</td><td>0</td><td>the bit shifted out</td></tr>' +
      '<tr><td>CB <code>SWAP</code></td><td>result = 0</td><td>0</td><td>0</td><td><b>0</b></td></tr>' +
      '<tr><td>CB <code>BIT y,r</code></td><td><b>selected bit is 0</b></td><td>0</td><td><b>1</b></td><td><b>&middot;</b></td></tr>' +
      '<tr><td>CB <code>RES</code> / <code>SET</code></td><td>&middot;</td><td>&middot;</td><td>&middot;</td><td>&middot;</td></tr>' +
      '<tr><td><code>CPL</code></td><td>&middot;</td><td><b>1</b></td><td><b>1</b></td><td>&middot;</td></tr>' +
      '<tr><td><code>SCF</code></td><td>&middot;</td><td>0</td><td>0</td><td><b>1</b></td></tr>' +
      '<tr><td><code>CCF</code></td><td>&middot;</td><td>0</td><td>0</td><td><b>inverted</b></td></tr>' +
      '<tr><td><code>DAA</code></td><td>see D.6</td><td><b>&middot;</b></td><td><b>0</b></td><td>see D.6</td></tr>' +
      '<tr><td>Every <code>LD</code>, <code>PUSH</code>, jump, call, <code>RET</code>, <code>RETI</code>, <code>RST</code>, <code>NOP</code>, <code>EI</code>, <code>DI</code>, <code>HALT</code>, <code>STOP</code></td><td>&middot;</td><td>&middot;</td><td>&middot;</td><td>&middot;</td></tr>' +
      '<tr><td><code>POP AF</code></td><td colspan="4"><b>loaded from the stack</b>, low nibble forced to 0</td></tr>' +
    '</tbody></table>' +
    '<div class="gbemu-rule" id="gbr-D-5-2"><b>Rule D.5/2.</b> <b><code>carry_in</code> is the C flag as it stood when the instruction ' +
    'began</b>: <code>ADC</code> and <code>SBC</code> must read it before they write it.</div>' +
    '<div class="gbemu-example"><b>Example.</b> <b><code>SUB A</code>, <code>CP A</code> and <code>XOR A</code> are the three ' +
    'idiomatic zeroing forms and are not interchangeable</b>: <code>XOR A</code> gives ' +
    '<code>A=0, F=Z---</code>, <code>SUB A</code> gives <code>A=0, F=ZN--</code>, and ' +
    '<b><code>CP A</code> clears nothing at all</b>. It discards its result and leaves A ' +
    'exactly as it was, setting <code>F=ZN--</code> as a side effect, which is the only reason it ' +
    'sits in this list. <b>Two of the three write A and one does not, and real code depends on ' +
    'which.</b></div>' +

    '<p class="gbemu-key"><b>D.5.1: The two half-carries that are computed on a different ' +
    'byte.</b></p>' +
    '<div class="gbemu-why"><b>Why this has its own subsection.</b> This is the classic silent divergence: get either wrong and nothing fails loudly, ' +
    'because almost no code reads the flag after these instructions, until one does.</div>' +
    '<div class="gbemu-rule" id="gbr-D-5-1-1"><b>Rule D.5.1/1.</b> <b><code>ADD HL,rr</code>: H must be the carry out of bit 11 into bit ' +
    '12, the <em>high</em> byte&rsquo;s low nibble.</b> Not bit 3. The test is ' +
    '<code>(HL &amp; 0x0FFF) + (rr &amp; 0x0FFF) &gt; 0x0FFF</code>, and C is the carry out of bit ' +
    '15. <b>Z is left alone entirely</b>: the only add on the machine that does not touch ' +
    'it.</div>' +
    '<div class="gbemu-example"><b>Example.</b> Three cases of Rule D.5.1/1, the second ruling out the 8-bit reading:</div>' +
    '<table class="gbemu-table"><thead><tr><th>Case</th><th>Result</th><th>Flags</th></tr></thead><tbody>' +
      '<tr><td><code>HL = 0x0FFF</code>, <code>BC = 0x0001</code></td><td><code>HL = 0x1000</code></td><td><b>H set</b>, C clear, Z untouched</td></tr>' +
      '<tr><td><code>HL = 0x00FF</code>, <code>BC = 0x0001</code></td><td><code>HL = 0x0100</code></td><td><b>H clear</b>: no carry out of bit 11. An implementer who reused the 8-bit rule sets H here and is wrong</td></tr>' +
      '<tr><td><code>HL = 0xFFFF</code>, <code>BC = 0x0001</code></td><td><code>HL = 0x0000</code></td><td><b>H set, C set</b>, and <b>Z still whatever it was</b>, not set</td></tr>' +
    '</tbody></table>' +
    '<div class="gbemu-rule" id="gbr-D-5-1-2"><b>Rule D.5.1/2.</b> <b><code>ADD SP,e8</code> and <code>LD HL,SP+e8</code>: H must be the carry out of bit ' +
    '3 and C the carry out of bit 7, both on the <em>low</em> byte, both computed as an unsigned byte addition.</b> ' +
    'The displacement is signed for the <em>result</em> and unsigned for the <em>flags</em>: take the ' +
    'low byte of SP, add the raw offset byte, and read the bit-3 and bit-7 carries out of that. Z and ' +
    'N are both <b>cleared</b>: the only 16-bit arithmetic that clears Z.</div>' +
    '<div class="gbemu-example"><b>Example.</b> Four cases of Rule D.5.1/2, the last ruling out sign extension before the flags:</div>' +
    '<table class="gbemu-table"><thead><tr><th>Case</th><th>Result</th><th>Flags</th></tr></thead><tbody>' +
      '<tr><td><code>SP = 0x000F</code>, <code>e8 = +1</code></td><td><code>0x0010</code></td><td><b>H set</b>, C clear</td></tr>' +
      '<tr><td><code>SP = 0x00FF</code>, <code>e8 = +1</code></td><td><code>0x0100</code></td><td><b>H set, C set</b></td></tr>' +
      '<tr><td><code>SP = 0xFFFF</code>, <code>e8 = +1</code></td><td><code>0x0000</code></td><td><b>H set, C set</b>: the flags came from <code>0xFF + 0x01</code>, not from the 16-bit result</td></tr>' +
      '<tr><td><code>SP = 0x0000</code>, <code>e8 = &minus;1</code> (byte <code>0xFF</code>)</td><td><code>0xFFFF</code></td><td><b>H clear, C clear</b>: <code>0x00 + 0xFF</code> carries out of neither bit. <b>This is the case that catches implementations that sign-extend before computing the flags</b></td></tr>' +
    '</tbody></table>' +
    '<p class="hw-readable"><code>LD HL,SP+e8</code> writes HL and leaves SP alone; ' +
    '<code>ADD SP,e8</code> writes SP. <b>The flags are identical; only the destination and the ' +
    'cycle count differ</b>: 16 T against 12 T, because <code>ADD SP</code> carries two ' +
    'internal delays and <code>LD HL,SP+e8</code> one (D.12.1).</p>' +

    '<h4 class="gbemu-sub">D.5.2: Eight rotate and shift operations, written out</h4>' +
    '<p class="hw-readable"><b>The eight are <code>RLC RRC RL RR SLA SRA SWAP SRL</code></b>, and ' +
    'they reach the reader in three other places on this page: the opcode grid, D.5&rsquo;s flag ' +
    'rows and D.12.1&rsquo;s read-modify-write list. Those give their flags and their timing and ' +
    'not what any of them does to the byte, and ' +
    '<b>D.5&rsquo;s carry column cannot tell them apart</b>: it reads &ldquo;the bit shifted ' +
    'out&rdquo; for the circular rotates and the through-carry rotates alike, and for ' +
    '<code>SRA</code> and <code>SRL</code> alike, because <b>what separates them is what goes ' +
    '<em>into</em> the vacated bit, not what comes out of the other end</b>, and the flag table has ' +
    'no column for that. D.13 does not scope this family out. 64 CB opcodes, four unprefixed ' +
    'rotates and <code>CPL</code> are written out here rather than left to be guessed from the ' +
    'mnemonic.</p>' +
    '<p class="hw-readable">The CB block <code>0x00</code>&ndash;<code>0x3F</code> <em>is</em> this ' +
    'family. Bits 5&ndash;3 of the operation byte pick the operation, the low three bits pick the ' +
    'operand in the usual <code>B C D E H L (HL) A</code> order: <b>eight operations &times; eight ' +
    'operands = 64 opcodes</b>, with no holes.</p>' +
    '<div class="gbemu-rule" id="gbr-D-5-2-1"><b>Rule D.5.2/1.</b> Each of the eight must change the byte, fill the vacated bit and set C exactly as this table and the listing under it give, and set Z, N and H as the listing gives.</div>' +
    '<table class="gbemu-table"><thead><tr><th>Operation</th><th>Opcodes</th><th>What happens to the byte</th><th>The vacated bit is filled with</th><th>C receives</th></tr></thead><tbody>' +
      '<tr><td><code>RLC r</code></td><td><code>0x00</code>&ndash;<code>0x07</code></td><td>rotate left, <b>circular</b></td><td>the <b>old bit 7</b>: the byte wraps into itself</td><td>the old bit 7</td></tr>' +
      '<tr><td><code>RRC r</code></td><td><code>0x08</code>&ndash;<code>0x0F</code></td><td>rotate right, <b>circular</b></td><td>the <b>old bit 0</b></td><td>the old bit 0</td></tr>' +
      '<tr><td><code>RL r</code></td><td><code>0x10</code>&ndash;<code>0x17</code></td><td>rotate left <b>through C</b>: a 9-bit rotate of C and the byte together</td><td>the <b>C flag as it stood on entry</b></td><td>the old bit 7</td></tr>' +
      '<tr><td><code>RR r</code></td><td><code>0x18</code>&ndash;<code>0x1F</code></td><td>rotate right <b>through C</b></td><td>the <b>C flag as it stood on entry</b></td><td>the old bit 0</td></tr>' +
      '<tr><td><code>SLA r</code></td><td><code>0x20</code>&ndash;<code>0x27</code></td><td>shift left, nothing comes back</td><td><b>0</b></td><td>the old bit 7</td></tr>' +
      '<tr><td><code>SRA r</code></td><td><code>0x28</code>&ndash;<code>0x2F</code></td><td>shift right, <b>arithmetic</b>: the sign is preserved</td><td><b>bit 7 keeps its own old value</b>; it is not cleared and it is not taken from anywhere else</td><td>the old bit 0</td></tr>' +
      '<tr><td><code>SWAP r</code></td><td><code>0x30</code>&ndash;<code>0x37</code></td><td><b>exchange the two nibbles</b>: <code>(v &lt;&lt; 4) OR (v &gt;&gt; 4)</code></td><td>nothing is vacated: no bit leaves the byte</td><td><b>0, unconditionally</b></td></tr>' +
      '<tr><td><code>SRL r</code></td><td><code>0x38</code>&ndash;<code>0x3F</code></td><td>shift right, <b>logical</b></td><td><b>0</b></td><td>the old bit 0</td></tr>' +
    '</tbody></table>' +
    '<div class="gbemu-pre">v = operand                        # B C D E H L (HL) A, by the low 3 bits\n' +
    'RLC :  c = v &gt;&gt; 7 ;  r = (v &lt;&lt; 1) | c\n' +
    'RRC :  c = v &amp; 1  ;  r = (v &gt;&gt; 1) | (c &lt;&lt; 7)\n' +
    'RL  :  c = v &gt;&gt; 7 ;  r = (v &lt;&lt; 1) | C_in\n' +
    'RR  :  c = v &amp; 1  ;  r = (v &gt;&gt; 1) | (C_in &lt;&lt; 7)\n' +
    'SLA :  c = v &gt;&gt; 7 ;  r =  v &lt;&lt; 1\n' +
    'SRA :  c = v &amp; 1  ;  r = (v &gt;&gt; 1) | (v &amp; 0x80)\n' +
    'SWAP:  c = 0      ;  r = (v &lt;&lt; 4) | (v &gt;&gt; 4)\n' +
    'SRL :  c = v &amp; 1  ;  r =  v &gt;&gt; 1\n\n' +
    'r is truncated to 8 bits\n' +
    'Z = (r == 0)   for all eight, SWAP included\n' +
    'N = 0\n' +
    'H = 0\n' +
    'C = c          C_in is the C flag as it stood when the instruction began</div>' +
    '<div class="gbemu-why"><b>Why: the three distinctions D.5&rsquo;s table cannot express.</b> ' +
    '<code>RLC</code>/<code>RRC</code> feed the vacated bit from the byte&rsquo;s own far end; ' +
    '<code>RL</code>/<code>RR</code> feed it from C. All four put the same bit <em>into</em> C, ' +
    'which is why one column serves them and none of them is identified by it. <code>SRA</code> ' +
    'preserves bit 7 and <code>SRL</code> clears it, and <b>they are otherwise the same ' +
    'instruction</b>. <code>SWAP</code> is the only member that writes <code>C = 0</code> ' +
    'regardless of the operand: it is a rotate by four in effect, but no bit leaves the byte, ' +
    'so there is nothing for C to catch.</div>' +
    '<div class="gbemu-rule" id="gbr-D-5-2-2"><b>Rule D.5.2/2.</b> <b><code>RLCA</code> <code>RRCA</code> <code>RLA</code> <code>RRA</code> ' +
    '(<code>0x07 0x0F 0x17 0x1F</code>) must run the same four data paths on A as <code>RLC</code>, <code>RRC</code>, <code>RL</code> and <code>RR</code>, and differ in exactly one ' +
    'thing: Z is <em>cleared</em>, not computed.</b> They are also one byte and 4 T against two bytes and 8 T.</div>' +
    '<div class="gbemu-example"><b>Example.</b> <code>RLCA</code> on <code>A = 0x00</code> ' +
    'leaves <code>A = 0x00</code> with <b>Z clear</b>; <code>CB RLC A</code> on the same value ' +
    'leaves <b>Z set</b>. <b>A core that ' +
    'implements the unprefixed four by dispatching into the CB handler gets the value right and Z ' +
    'wrong on every zero result</b>, which is the whole of the difference and is invisible until a ' +
    'branch reads it.</div>' +
    '<div class="gbemu-rule" id="gbr-D-5-2-3"><b>Rule D.5.2/3.</b> <b><code>CPL</code> (<code>0x2F</code>): <code>A = ~A</code>, ' +
    'ones complement, every bit inverted.</b> N and H must be <b>set</b>; Z and C must be <b>untouched</b>, ' +
    'and untouched is literal: whatever Z and C held survives. There is no arithmetic here and nothing is added or ' +
    'compared.</div>' +
    '<div class="gbemu-why"><b>Why.</b> The core ORs the two bits in rather than assigning F. ' +
    '<b>READ FROM SOURCE</b>: <code>src/gb.c</code>, ' +
    '<code>exec_cb()</code> for the eight, and the <code>0x07</code> <code>0x0F</code> ' +
    '<code>0x17</code> <code>0x1F</code> <code>0x2F</code> cases of the main decoder for the other ' +
    'five. <b>Falsifier:</b> Blargg&rsquo;s <code>cpu_instrs</code> members checksum every one of ' +
    'these against hardware, so a single wrong fill bit fails a scored row; and if this table and ' +
    '<code>src/gb.c</code> ever disagree, the code is what ships and this table is what is ' +
    'wrong.</div>' +

    '<h4 class="gbemu-sub">D.6: <code>DAA</code> (<code>0x27</code>) in full</h4>' +
    '<div class="gbemu-rule" id="gbr-D-6-1"><b>Rule D.6/1.</b> <code>DAA</code> must compute exactly this listing, with nothing omitted. <b>The subtract branch does not test A at ' +
    'all</b>: it is driven purely by the flags the preceding <code>SUB</code> or ' +
    '<code>SBC</code> left behind.</div>' +
    '<div class="gbemu-pre">if N == 0:                                   # adjust after an addition\n' +
    '    if C == 1 or A &gt; 0x99:           A += 0x60 ; C = 1\n' +
    '    if H == 1 or (A &amp; 0x0F) &gt; 0x09:  A += 0x06\n' +
    'else:                                        # adjust after a subtraction\n' +
    '    if C == 1:                       A -= 0x60\n' +
    '    if H == 1:                       A -= 0x06\n\n' +
    'A wraps modulo 256\n' +
    'H = 0\n' +
    'N unchanged\n' +
    'C as set above. DAA never clears C\n' +
    'Z = (A == 0)</div>' +
    '<div class="gbemu-why"><b>Why.</b> The decimal adjust is the single most commonly wrong instruction on this ' +
    'machine, and its rule cannot be guessed, because of the subtract branch.</div>' +
    '<div class="gbemu-rule" id="gbr-D-6-2"><b>Rule D.6/2.</b> Five things in that listing are load-bearing, and a build must keep all five:' +
    '<ul class="gbemu-bullets">' +
      '<li><b>The subtract branch tests only the flags.</b> No <code>&gt; 0x99</code>, no ' +
        '<code>&gt; 0x09</code>. Symmetry is the wrong instinct here.</li>' +
      '<li><b>C is never cleared.</b> If it arrived set it leaves set; in the subtract branch it is ' +
        'not written at all. Only the add branch can <em>set</em> it.</li>' +
      '<li><b>H is always cleared</b>, on both branches, unconditionally.</li>' +
      '<li><b>N is preserved</b>, on both branches. It is the only flag DAA carries through.</li>' +
      '<li><b>The order of the two add-branch tests is load-bearing: the <code>&gt; 0x99</code> ' +
        'test must run first.</b></li>' +
    '</ul></div>' +
    '<div class="gbemu-why"><b>Why the order matters.</b> The reason the reversal seems safe is true and covers one ' +
        'direction only: <code>+0x60</code> cannot change the low nibble, so ' +
        '<code>(A &amp; 0x0F) &gt; 0x09</code> does read the same before or after it. But swapping ' +
        'the two tests also moves the <code>A &gt; 0x99</code> test to <em>after</em> the ' +
        '<code>+0x06</code>, and <code>+0x06</code> <em>can</em> change the high nibble and ' +
        'can wrap, which is exactly what &ldquo;A wraps modulo 256&rdquo; in the listing admits. In the swapped order A wraps to 8 bits straight after its <code>+0x06</code>, before the <code>&gt; 0x99</code> test, and the counts and the worked case below are taken that way; wrapped only at the end, the swapped order gives 6 and 0 disagreements instead. MECHANISM, recomputed from the listing. ' +
        'Brute-forced over the whole add-branch input space (256 values of A &times; C ' +
        '&times; H, N = 0, so <b>1024 inputs</b>) the two orders disagree on <b>18</b> of ' +
        'them, and <b>156</b> disagreements are reachable from ordinary valid-BCD additions (both ' +
        'operands 0&ndash;99, no carry in): 156 of those 100 &times; 100 operand pairs. The swapped order is equivalent <em>only</em> on an accumulator wider ' +
        'than 8 bits with the threshold changed to <code>&gt; 0x9F</code> (0 disagreements over the ' +
        'same 1024 inputs); on the 8-bit A this machine has it is simply wrong, and a core taking ' +
        'the reversed order fails <code>01-special</code>, which checksums this exhaustively. ' +
        '<b>Falsifier, and it runs on every gate pass:</b> the gate brute-forces both orders and ' +
        'fails if they ever stop diverging, or if the counts above stop matching.</div>' +
    '<div class="gbemu-example"><b>Example.</b> <code>0x61 + 0x99</code> leaves ' +
        '<code>A=0xFA H=0 C=0</code>; as listed above DAA gives <code>A=0x60 C=1</code> (160 ' +
        'decimal, correct) and the swapped order gives <code>A=0x00 C=0</code>, wrong value ' +
        'and the carry lost.</div>' +
    '<div class="gbemu-rule" id="gbr-D-6-3"><b>Rule D.6/3.</b> <b>Z must be computed on the adjusted A, after both corrections</b>, never on the pre-adjust value.</div>' +
    '<div class="gbemu-why"><b>Why.</b> Computing ' +
    'it on the pre-adjust value is a common and invisible error: invisible because it only ' +
    'differs when an adjustment carries A to zero, which is exactly what a BCD counter rolling over ' +
    'does.</div>' +
    '<div class="gbemu-example"><b>Example.</b> Eight cases of Rules D.6/1 to D.6/3:</div>' +
    '<table class="gbemu-table"><thead><tr><th>Preceding operation</th><th>On entry</th><th>After <code>DAA</code></th></tr></thead><tbody>' +
      '<tr><td><code>LD A,$45 ; ADD A,$38</code></td><td><code>A=7D F=----</code></td><td><code>A=83 F=----</code> (45 + 38 = 83)</td></tr>' +
      '<tr><td><code>LD A,$09 ; ADD A,$01</code></td><td><code>A=0A F=----</code></td><td><code>A=10 F=----</code></td></tr>' +
      '<tr><td><code>LD A,$99 ; ADD A,$01</code></td><td><code>A=9A F=----</code></td><td><code>A=00 F=Z--C</code> (carry out)</td></tr>' +
      '<tr><td><code>LD A,$99 ; ADD A,$99</code></td><td><code>A=32 F=--HC</code></td><td><code>A=98 F=---C</code> (99 + 99 = 198)</td></tr>' +
      '<tr><td><code>LD A,$45 ; SUB $38</code></td><td><code>A=0D F=-NH-</code></td><td><code>A=07 F=-N--</code></td></tr>' +
      '<tr><td><code>LD A,$00 ; SUB $01</code></td><td><code>A=FF F=-NHC</code></td><td><code>A=99 F=-N-C</code> (borrow)</td></tr>' +
      '<tr><td><code>LD A,$50 ; SUB $10</code></td><td><code>A=40 F=-N--</code></td><td><code>A=40 F=-N--</code> (no adjustment needed)</td></tr>' +
      '<tr><td>any subtraction leaving zero</td><td><code>A=00 F=ZN--</code></td><td><code>A=00 F=ZN--</code></td></tr>' +
    '</tbody></table>' +
    '<div class="gbemu-why"><b>DERIVED</b>, and deliberately not copied from a table: this core ' +
    'builds the instruction from the carry and half-carry conditions and confirms it against ' +
    'Blargg <code>01-special</code>. That matters because the widely-circulated tables for this ' +
    'instruction disagree with each other, and the one place they agree is the add branch, ' +
    'which is the branch that is easy.</div>' +

    '<h4 class="gbemu-sub">D.7: The opcodes that are not instructions</h4>' +
    '<div class="gbemu-rule" id="gbr-D-7-1"><b>Rule D.7/1.</b> Eleven byte values decode to nothing: <code>0xD3</code> ' +
    '<code>0xDB</code> <code>0xDD</code> <code>0xE3</code> <code>0xE4</code> <code>0xEB</code> ' +
    '<code>0xEC</code> <code>0xED</code> <code>0xF4</code> <code>0xFC</code> <code>0xFD</code>. ' +
    'There are no others.</div>' +
    '<div class="gbemu-rule" id="gbr-D-7-2"><b>Rule D.7/2.</b> <b>When one executes, the processor must lock ' +
    'permanently.</b> The byte&rsquo;s own fetch is an ordinary opcode fetch, one machine cycle that advances PC past it, and the lock takes hold at the end of that fetch; nothing can read PC afterwards, so this is unobservable. In this core, from that point every step consumes exactly one machine cycle and does nothing ' +
    'else: no fetch, no advance of PC, and <b>no interrupt dispatch</b>, because the lock is ' +
    'tested before the pending-interrupt check. The rest of the machine keeps running: the picture ' +
    'processor, the timer, the sound unit and any transfer in flight are all still clocked by those ' +
    'cycles, and a frame step still runs a whole frame of them, so the picture keeps being drawn. Only a reset clears it. On this site a game that locks is stopped, with a message. <b>Do not implement these as <code>NOP</code></b>.</div>' +
    '<div class="gbemu-why"><b>Why: two labels, because they are worth different amounts.</b> ' +
    '<em>That</em> the processor locks up is the documented hardware behaviour and this core follows ' +
    'it: <b>MECHANISM</b>. <em>The granularity</em> (one machine cycle per step, with ' +
    'the rest of the machine still clocked) is this core&rsquo;s structure and is ' +
    '<b>NOT ESTABLISHED</b> against hardware: no test we hold executes an undefined opcode. What ' +
    'would establish it is a cartridge that executes one and then observes the picture or the timer, ' +
    'which nobody appears to have written. <b>The flexibility and its invariant.</b> Any structure satisfying (a) the ' +
    'processor never fetches another instruction, (b) it never dispatches an interrupt, and (c) time ' +
    'continues to pass for everything else, is indistinguishable from this one on anything the board ' +
    'can score. A title that reaches one ' +
    'has already lost control, and silently continuing as a <code>NOP</code> hides the bug that got it there.</div>' +

    '<h4 class="gbemu-sub">D.8: <code>HALT</code> (<code>0x76</code>), and the halt bug as a rule</h4>' +
    '<p class="hw-readable"><code>HALT</code> is 1 byte, 4 T. Throughout this subsection ' +
    '<b><code>pending = IE &amp; IF &amp; 0x1F</code></b>, with the status bit left out while E.6&rsquo;s line-0 or coincidence hold runs: the same view every sample of the request uses (Rule D.10.1/2). Only the low five bits exist. &ldquo;An enable scheduled&rdquo; means an <code>EI</code> has run and IME has not yet become set (Rule D.8/5).</p>' +
    '<div class="gbemu-rule" id="gbr-D-8-1"><b>Rule D.8/1.</b> When <code>HALT</code> executes, the processor must act on the first row of this table that matches, with <code>pending</code> read at the instant Rule D.8/2 gives:' +
    '<table class="gbemu-table"><thead><tr><th>IME</th><th>An enable scheduled</th><th><code>pending</code></th><th>What HALT does</th></tr></thead><tbody>' +
      '<tr><td>clear</td><td>no</td><td>not 0</td><td><b>The halt bug.</b> The processor <b>does not halt</b>. The <em>next</em> opcode fetch reads its byte <b>without advancing PC</b>, so that byte is fetched twice; the armed state is consumed by that one fetch.</td></tr>' +
      '<tr><td>clear</td><td>yes</td><td>not 0</td><td>Rule D.8/6: no halt and no halt bug; PC is left on the <code>HALT</code> and the next boundary dispatches.</td></tr>' +
      '<tr><td colspan="3">any other combination (IME set; or <code>pending</code> = 0)</td><td>The processor <b>halts</b>.</td></tr>' +
    '</tbody></table></div>' +
    '<div class="gbemu-why"><b>Why: an enable in flight is not interrupts-off.</b> &ldquo;No interrupt-enable scheduled&rdquo; in the first row is the difference between running a real game and not. ' +
    '<code>EI</code> does not enable interrupts immediately; it schedules the enable to take effect ' +
    'after the <em>next</em> instruction completes. So in <code>ei ; halt</code>, IME is still clear ' +
    'when <code>HALT</code> executes and becomes set as <code>HALT</code> completes. ' +
    'Treat it as off and the bug arms on perfectly ordinary code, ' +
    'and the doubled fetch then lands on the first byte of an interrupt handler.</div>' +
    '<div class="gbemu-example"><b>Example.</b> Tokyo ' +
    'Disneyland&rsquo;s vertical-blank vector holds <code>CALL $0478</code>. With the in-flight <code>EI</code> treated as off, the corrupted fetch ' +
    'reads its operand one byte early, and the machine calls <code>$78CD</code> into nothing. Built to Rule D.8/1, the bug does not arm and the call goes to <code>$0478</code>.</div>' +
    '<div class="gbemu-rule" id="gbr-D-8-2"><b>Rule D.8/2.</b> Where <code>pending</code> is read for Rule D.8/1:' +
    '<table class="gbemu-table"><thead><tr><th>Machine</th><th>Where HALT&rsquo;s own test is made (dots on the access scale of section 14)</th></tr></thead><tbody>' +
      '<tr><td>Original</td><td>The picture is first paid up to the end of HALT&rsquo;s own machine cycle (with the display on). <b>Exactly</b>: let F be the access dot of HALT&rsquo;s own opcode fetch (access scale). That fetch&rsquo;s machine cycle still owes the dots up to its end (E.5); they are paid now, and the test is made on the dot S the boundary after HALT would have (Rule D.10.1/3). With no look at the boundary before HALT the cycle owes four dots, F to F + 3, and S is F + 4. After a look there (Rule D.10.1/6, steps 3 and 4) it owes two, F and F + 1, and S is F + 2. So with no look of HALT&rsquo;s own, HALT&rsquo;s test and the first halted sample (Rule D.8/4) are made on the same dot. Then the look (two more dots, Rule D.10.1/6) is added only when all of these hold: the display is on; no sprite-memory transfer is running or starting; the vertical-blank or the status interrupt (IE bit 0 or bit 1, either or both) is enabled in IE while its IF bit is clear; and the line is near a rising request (Rule D.10.1/5, row 7). So with the look the test is made two dots past the end of HALT&rsquo;s machine cycle. Rule D.10.1/5&rsquo;s next-instruction row does not apply (HALT is the instruction), and the two looked dots are owed back like any look&rsquo;s (Rule D.10.1/6, step 4).</td></tr>' +
      '<tr><td>Colour at single speed</td><td>At the end of HALT&rsquo;s own machine cycle, with no look: on access dot F + 4, as on the original.</td></tr>' +
      '<tr><td>Colour in double speed</td><td>At HALT&rsquo;s own opcode-fetch access, dot F, with that cycle&rsquo;s two dots still owed (they are paid with the next machine cycle), and with no look. Read from our source (<code>CT_HALT_TEST_END</code> = 1 pays the owed dots at single speed only).</td></tr>' +
    '</tbody></table></div>' +
    '<div class="gbemu-why"><b>Why.</b> Read from our source (the HALT case; <code>DMG_HALT_TEST_END</code> = 2 selects the original&rsquo;s test with the look). The AGE test <code>halt-m0-interrupt</code> (the halt bug, decided by the request as HALT executes) needs the look: SCX 0 to 2 arm the bug, 3 does not. The Colour&rsquo;s test is the Colour tab&rsquo;s (section 10). Labels: the HALT test at the end of its cycle is MECHANISM, the two dots FITTED (D.10.1).</div>' +
    '<div class="gbemu-example"><b>Example (where F + 4 is).</b> On an ordinary line of the original (accesses on dots 4k + 1, Rule 1/4), with no look at the boundary before HALT, HALT&rsquo;s opcode fetch makes its access on dot 249. The test first processes dots 249, 250, 251 and 252 (the fetch cycle&rsquo;s owed dots), so with no look of its own it is made on access dot 253 and sees every request raised on dot 252 or earlier. With HALT&rsquo;s look it processes dots 253 and 254 as well and sees every request raised on dot 254 or earlier. Reading &ldquo;the end of HALT&rsquo;s own machine cycle&rdquo; as the fetch access itself (dot 249, nothing paid) is wrong: it tests four dots too early.</div>' +
    '<div class="gbemu-example"><b>Example.</b> On the original, let HALT&rsquo;s machine cycle end on access dot E (that is F + 4), with the look&rsquo;s conditions holding. In <code>halt-m0-interrupt</code> the mode-0 request moves one dot later per step of SCX and is first seen at dot E when SCX is 0 (read from our source&rsquo;s account of that test). SCX 0, 1, 2 put it at E, E + 1, E + 2: inside the test at E + 2, so the bug arms. SCX 3 puts it at E + 3: not seen, no bug. A test made at E (no look) would arm the bug for SCX 0 only.</div>' +
    '<div class="gbemu-rule" id="gbr-D-8-3"><b>Rule D.8/3.</b> <b>An interrupt dispatch must clear any armed ' +
    'doubled fetch.</b></div>' +
    '<div class="gbemu-why"><b>Why.</b> The doubled fetch belongs to the instruction stream <code>HALT</code> was ' +
    'sitting in, not to a handler. If a dispatch happens while the arm is live and the arm survives ' +
    'it, the doubled fetch eats the handler&rsquo;s first opcode byte: the same silent ' +
    'catastrophe by a second route.</div>' +
    '<div class="gbemu-rule" id="gbr-D-8-4"><b>Rule D.8/4.</b> <b>While halted</b>, the machine must run in this order, one step per machine cycle, starting at the ' +
    'boundary straight after <code>HALT</code>&rsquo;s own opcode fetch:' +
    '<ol class="gbemu-steps">' +
      '<li>Test the request, with the same test and at the same instant as at any instruction boundary (Rule D.10.1/3; a halted processor never makes the look).</li>' +
      '<li>If the test finds <code>pending</code> = 0: run one idle machine cycle (everything else keeps being clocked) and go back to step 1.</li>' +
      '<li>If the test finds <code>pending</code> &ne; 0, whether or not IME is set, the halt ends. <b>On the original, waking costs no machine cycle.</b> <b>On the Colour</b>, a halted processor samples the request, then runs one more machine cycle, and only then leaves HALT, so waking there costs one machine cycle before the dispatch or the next fetch (the Colour tab, section 10, &ldquo;A halted processor wakes&rdquo;).</li>' +
      '<li>If IME is set, the five dispatch cycles start at once, exactly as from an instruction boundary. If IME is clear, the next machine cycle is the next opcode fetch: execution simply resumes at PC, the ' +
    'interrupt is not taken and its IF bit is not cleared.</li>' +
    '</ol></div>' +
    '<div class="gbemu-why"><b>Why.</b> Step 4&rsquo;s clear-IME arm is the whole reason <code>halt</code> ' +
    'with interrupts disabled is a usable idiom. The <code>pending</code> that wakes the halt is the ' +
    'one dispatch tests, so the status bit withheld on line 0 and after a coincidence edge (E.6) does ' +
    'not wake it either. The Colour&rsquo;s extra cycle is its own timing: MECHANISM, read in the reference. MEASURED, both arms on the original: one extra wake cycle when IME is set fails ten original ' +
    'rows (<code>di_timing-GS</code>, <code>halt_ime0_nointr_timing</code>, ' +
    '<code>halt_ime1_timing2-GS</code> and seven picture-interrupt rows); one extra wake cycle when IME' +
    ' is clear fails <code>halt_ime0_nointr_timing</code>.</div>' +

    '<div class="gbemu-rule" id="gbr-D-8-5"><b>Rule D.8/5.</b> <b>The enable rules, because the halt bug is stated in terms of ' +
    'them.</b>' +
    '<table class="gbemu-table"><thead><tr><th>Instruction</th><th>Effect on IME</th><th>First instruction boundary that can dispatch (counted from the end of this instruction)</th></tr></thead><tbody>' +
      '<tr><td><code>EI</code> (<code>0xFB</code>)</td><td>Schedules the enable; IME becomes set as the <em>next</em> instruction completes. If an enable is already scheduled, <code>EI</code> does nothing: only the first of a run of consecutive <code>EI</code>s starts the schedule, and a later one must not restart it.</td><td>The second: the boundary straight after <code>EI</code> tests with IME still clear, so the instruction that follows always runs.</td></tr>' +
      '<tr><td><code>DI</code> (<code>0xF3</code>)</td><td>Clears IME at once and <b>also cancels any schedule in flight</b>.</td><td>None, until IME is set again.</td></tr>' +
      '<tr><td><code>RETI</code> (<code>0xD9</code>)</td><td>Sets IME at once, with no delay, and cancels any schedule.</td><td>The first: the very next boundary, with no instruction between.</td></tr>' +
    '</tbody></table></div>' +
    '<div class="gbemu-why"><b>Why.</b> Restarting the delay on each <code>EI</code> means ' +
    '<code>ei ; ei ; ei</code> never enables interrupts at all (Mooneye <code>ei_sequence</code>). The one-instruction delay of <code>EI</code> is what makes <code>ei; ret</code> behave the way real code expects. This is the boundary each rule acts at, as our core runs it.</div>' +
    '<div class="gbemu-example"><b>Example.</b> In <code>ei ; nop ; nop</code> a request already ' +
    'pending is taken before the second <code>nop</code>. Step by step: the boundary straight after <code>EI</code> makes its test with IME still clear, so nothing is taken there and the first <code>nop</code> runs; IME becomes set as that <code>nop</code> completes; the boundary after it takes the request. A reading in which IME is set at the boundary straight after <code>EI</code> would take the request before the first <code>nop</code>; that reading is wrong.</div>' +
    '<div class="gbemu-rule" id="gbr-D-8-6"><b>Rule D.8/6.</b> <b><code>EI</code> then <code>HALT</code> with a request already pending</b> (both machines): the <code>HALT</code> must not halt and must not arm the halt bug. PC is left on the <code>HALT</code> itself (as if it had not advanced), IME becomes set as the <code>HALT</code> completes, and the next boundary dispatches, pushing the <code>HALT</code>&rsquo;s own address. So the handler returns to the <code>HALT</code>, which then runs again with IME as the handler left it (with RETI, set, so it halts normally if nothing else is pending).</div>' +
    '<div class="gbemu-why"><b>Why.</b> MECHANISM, read from our source (<code>EI_HALT_REPEAT</code>); the AGE test <code>ei-halt</code>, verified on hardware, reads the return address as the <code>HALT</code>&rsquo;s.</div>' +
    '<div class="gbemu-rule" id="gbr-D-8-7"><b>Rule D.8/7.</b> <b>A dispatch must cancel an enable still in flight.</b> The only way the two ' +
    'can meet is <code>EI</code> executed while IME is already set (with IME clear nothing can dispatch ' +
    'until the enable lands). If a request is taken at the next boundary, the dispatch clears IME and ' +
    'clears the scheduled enable with it, so IME stays clear in the handler until the handler&rsquo;s own ' +
    '<code>EI</code> or <code>RETI</code>, and a second request cannot nest after the handler&rsquo;s ' +
    'first instruction.</div>' +
    '<div class="gbemu-why"><b>Why.</b> MECHANISM: the enable an <code>EI</code> schedules is already in force when IME ' +
    'is set, so there is nothing left for it to do. No hardware test we hold separates the two readings: ' +
    'the other one (the enable survives and sets IME again once the handler&rsquo;s first instruction ' +
    'completes) moves none of the 66 original Mooneye acceptance rows either. Falsifier: a cartridge that ' +
    'runs <code>EI</code> with IME set, takes an interrupt at the next boundary, and tests whether a ' +
    'second request can pre-empt the handler&rsquo;s second instruction.</div>' +
    '<div class="gbemu-why"><b>The flexibility and its invariant.</b> How you represent &ldquo;an ' +
    'enable is in flight&rdquo; is yours: this core uses a small counter that <code>EI</code> ' +
    'sets and the step loop advances, but a flag plus a one-instruction deferral is equally correct. ' +
    '<b>The invariant is that during the instruction immediately following <code>EI</code>, IME is ' +
    'still clear for dispatch purposes and the halt bug must not arm.</b> Both halves, or the ' +
    'rule is only half applied.</div>' +

    '<h4 class="gbemu-sub">D.9: <code>STOP</code> (<code>0x10</code>)</h4>' +
    '<div class="gbemu-rule" id="gbr-D-9-1"><b>Rule D.9/1.</b> <code>STOP</code> is <b>two bytes</b>: the opcode and one operand byte ' +
    'that is fetched and discarded. This core charges <b>8 T</b>: two fetches, the opcode and its operand (D.12.1), and it is the figure appendix D.3&rsquo;s grid prints.</div>' +
    '<div class="gbemu-why"><b>Why.</b> Many published tables give 4 T and ' +
    'treat the second byte as skipped rather than fetched; <b>NOT ESTABLISHED</b>: nothing we ' +
    'hold measures <code>STOP</code>&rsquo;s own duration, and what would establish it is a ' +
    'cartridge that times a <code>STOP</code> which returns immediately.</div>' +
    '<div class="gbemu-rule" id="gbr-D-9-2"><b>Rule D.9/2.</b> What happens next splits on one condition. <b>The speed switch is ' +
    'armed</b> when all three hold: the device is a Color, the machine is in colour mode, and bit 0 of ' +
    '<code>KEY1</code> (<code>0xFF4D</code>) is set. Armed: Rule D.9/3. Not armed (original hardware, or a Colour with no switch ' +
    'pending): Rule D.9/5.</div>' +
    '<div class="gbemu-rule" id="gbr-D-9-3"><b>Rule D.9/3.</b> <b>Armed: a Colour performing a speed switch.</b> The machine must run these steps:' +
    '<ol class="gbemu-steps">' +
      '<li>At the end of the <code>STOP</code>&rsquo;s operand fetch: <code>KEY1</code> is cleared to <code>0x00</code> and a step counter starts (the Colour tab, Rule C3/5, has the exact points). The divider is not reset there.</li>' +
      '<li>If no interrupt is already pending, the processor <b>halts</b> and a countdown starts: <b>32,769 machine cycles on the shipped core</b>, the AGE emulator&rsquo;s pause of 32,768 machine cycles counted one more, because this core&rsquo;s bus accesses land at the end of a machine cycle (the Colour tab, section 3, has both totals in dots). The community figure is 32,770 machine cycles (131,080 T-cycles), which this core does not use. If an interrupt is already pending there is no halt and no countdown.</li>' +
      '<li><b>The speed changes whether or not the processor halts</b>, counted in machine cycles, never in instructions: at the start of the second machine cycle after the operand fetch, or of the third on revisions B and C when an interrupt was already pending.</li>' +
      '<li>The divider is reset once, at the end of the machine cycle before the speed changes, and then runs through the stall (so the timer and the sound unit&rsquo;s frame sequencer see its edges).</li>' +
      '<li>When the countdown expires the halt ends. There is no second reset: the 32,768 machine cycles after the reset are twice the divider&rsquo;s range, so it reads 0 there.</li>' +
      '<li>An interrupt wakes the halt early: the countdown is cancelled; the speed change and the reset of step 4 still happen.</li>' +
    '</ol>' +
    'Observable rule: the divider <b>reads 0 when the countdown expires</b>, as if it came out of reset there. The halt is a halt (Rule D.8/4), not STOP mode.</div>' +
    '<div class="gbemu-why"><b>Why the count is in machine cycles.</b> MECHANISM, read in the AGE emulator (by the author of the AGE tests) and confirmed on his speed-switch tables, verified on CPU CGB B and C; the extra machine cycle on revisions B and C with an interrupt pending is FITTED to <code>spsw-interrupts</code>, its reason NOT ESTABLISHED. ' +
    '<b>What would show it wrong:</b> a hardware capture of an edge after a switch that disagrees with the constant 149 dots per pair of switches (the Colour tab, Rule C10/43).</div>' +
    '<div class="gbemu-why"><b>Why step 3.</b> The switch belongs to the clock, not to the halt. A core that counts the change only inside ' +
    'the halt loses the switch on the no-halt path: <code>KEY1</code> is cleared, its speed bit never ' +
    'rises, and a game polling for double speed spins forever.</div>' +
    '<div class="gbemu-why"><b>Why one reset.</b> 32,768 machine cycles of 4 T-cycles are 131,072, twice the 16-bit divider&rsquo;s range, so it reads 0 after the stall with no second reset; one exception at the reset itself (the Colour tab, Rule C3/7, step 2) is what <code>spsw-tima</code> needs. MECHANISM, read in the AGE emulator; <code>spsw-div</code> and <code>spsw-tima</code> pass. Read from our source (<code>spsw_div_reset</code>).</div>' +
    '<div class="gbemu-why"><b>Why it halts and does not enter STOP mode: the difference is fatal rather than ' +
    'cosmetic.</b> A halted processor wakes on an interrupt or on the countdown. One in STOP mode wakes ' +
    'only on a selected joypad line. A test cartridge in our own tree writes <code>P1 = $30</code> ' +
    ' (<em>no</em> group selected) immediately before its <code>STOP</code>, so a core ' +
    'that enters STOP mode here can never wake, and the detector yields no verdict at all rather than a ' +
    'failure.</div>' +
    '<div class="gbemu-why"><b>32,770 machine cycles is CONVERGENCE, not measurement.</b> Two ' +
    'independent implementations reach the same figure from two different unit systems, but ' +
    'both are calibrated to a Colour revision this core does not target, and one of them models no ' +
    'revision axis at all. Two implementations agreeing is evidence about what the community models, ' +
    'not about hardware. Nothing here leans on its precision: the only consumer is the countdown, ' +
    'and the one test that exercises it discards the whole interval by waiting for a real-time-clock ' +
    'second edge after the switch.</div>' +
    '<div class="gbemu-rule" id="gbr-D-9-4"><b>Rule D.9/4.</b> <b>Not modelled on the armed path: the joypad exit.</b> On hardware a selected joypad line already reading low takes priority ' +
    'over the switch. This core&rsquo;s colour path has no such concept, so a title that arms ' +
    '<code>KEY1</code> <em>and</em> holds a selected line low switches where hardware would take the ' +
    'joypad exit.</div>' +
    '<div class="gbemu-why"><b>Why it is named.</b> Named rather than discovered later. No test we hold reaches it.</div>' +
    '<div class="gbemu-rule" id="gbr-D-9-5"><b>Rule D.9/5.</b> <b>Not armed: original hardware, or a Colour with no switch ' +
    'pending.</b> The machine enters <b>STOP mode</b>: the processor fetches nothing until a <em>selected</em> joypad line reads low. A group must actually be selected in <code>P1</code>; with <code>P1 = $30</code> ' +
    'nothing can ever wake it, which is the real behaviour and not a bug to route around. With a Super Game Boy attached only player 1&rsquo;s lines wake it (Rule A.6/7). The ' +
    'divider is reset at the end of the operand fetch, after that fetch&rsquo;s access, by the same path as a write to <code>FF04</code> (Rule 4/1): a high selected timer bit can increment TIMA, and the sound unit sees a fall of its sequencer bit (Rule 15/2). <b>Time still passes in STOP mode</b>, so the wake can arrive: <b>every machine cycle of STOP mode is an ordinary 4-T tick</b>, so the divider and timer count (and can raise the timer request), the sound unit and its frame sequencer run, an object-memory transfer already running carries on, and the cartridge clock advances. Only the processor stops. The picture runs too, except in the one case of Rule D.9/6. <b>The wake.</b> At the head of each machine cycle of STOP mode, after the picture is paid, the machine tests the pad. When a selected line reads low, STOP mode ends, and that machine cycle still runs as an ordinary 4-T tick with no interrupt test, no look and no fetch; the wake adds no machine cycle of its own. An ordinary instruction boundary follows it (Rules D.10.1/3 and D.10.1/5): the look is decided as at any boundary, and a request that became pending in STOP mode is taken there when IME is set.</div>' +
    '<div class="gbemu-why"><b>Why.</b> Read from our source.</div>' +
    '<div class="gbemu-rule" id="gbr-D-9-6"><b>Rule D.9/6.</b> <b>The picture is blanked in STOP mode, under one condition: the LCD is on <em>and</em> the reported mode is 1.</b> At the end of the <code>STOP</code>&rsquo;s operand fetch, read as the picture stands at that fetch&rsquo;s access, when both hold:' +
    '<ol class="gbemu-steps">' +
      '<li>The whole frame buffer is filled once, with shade index 0 on the original and <code>0x0000</code> on the Colour (the Colour tab, section 6).</li>' +
      '<li>The picture unit stops: no dot is processed (LY, STAT, the comparator and the frame buffer all hold). The dots the operand fetch still owes are dropped, not repaid.</li>' +
      '<li>At the wake, the picture unit resumes where it stopped: the waking machine cycle&rsquo;s own dots are owed as usual and paid at the next instruction boundary.</li>' +
    '</ol>' +
    'A <code>STOP</code> in modes 0, 2 or 3, or with the LCD off, blanks nothing, and the picture keeps running while the processor is in STOP mode. <b>This blanking is required, not optional: a board row depends on it.</b></div>' +
    '<div class="gbemu-why"><b>Why.</b> daid&rsquo;s <code>stop_instr</code> (on the original) has a reference picture that our core matches only with the blanking; built without it, it fails at 55 checkpoints (our core with the blanking switched off fails exactly as an independent build that left it out did). Leaving modes 0 and 2 untouched is ' +
    '<b>NOT ESTABLISHED</b>: no declared behaviour for them exists anywhere we hold, and the ' +
    'constraint is there so the code matches its own claim rather than because anything measured ' +
    'it. Read from our source (<code>STOP_BLANKS_LCD</code>, <code>STOP_BLANK_MODES</code>, and the flag <code>lcd_parked</code> that skips every dot).</div>' +

    '<h4 class="gbemu-sub">D.10: Interrupt dispatch</h4>' +
    '<p class="hw-readable">Not an opcode, but it is the other consumer of the instruction stream ' +
    'and its shape belongs with the tables.</p>' +
    '<div class="gbemu-rule" id="gbr-D-10-1"><b>Rule D.10/1.</b> <b>A dispatch is five machine cycles: two internal, push the high byte ' +
    'of PC, push the low byte, load the vector.</b> IME is cleared at the start, and the request bit is cleared as part of it (Rule D.10/3; D.12.2 gives the instant).</div>' +
    '<div class="gbemu-rule" id="gbr-D-10-2"><b>Rule D.10/2.</b> <b><code>IE &amp; IF</code> must be re-sampled <em>after</em> the high-byte ' +
    'push</b>, and the vector chosen from that re-sample. <b>If every bit is ' +
    'cancelled at the re-sample, the vector taken is <code>0x0000</code></b>.</div>' +
    '<div class="gbemu-why"><b>Why.</b> That is not an optimisation, it is the observable: <b>the high-byte push lands on ' +
    '<code>0xFFFF</code> when <code>SP&nbsp;=&nbsp;0x0000</code></b>, overwriting IE itself, and the ' +
    'value written there decides which vector is taken. It can ' +
    'redirect the dispatch to a different vector, or cancel every bit. (Mooneye <code>ie_push</code>, measured ' +
    'on that suite author&rsquo;s hardware.)</div>' +
    '<div class="gbemu-example"><b>Example.</b> <b>The stack pointer that redirects is <code>0x0000</code> alone. ' +
    '<code>0x0001</code> seems as though it should and does not, and that is the trap.</b> A ' +
    'push writes the high byte at <code>SP&minus;1</code> and the low byte at ' +
    '<code>SP&minus;2</code>, so for either to land on <code>0xFFFF</code> you need ' +
    '<code>SP = 0x0000</code> (high byte) or <code>SP = 0x0001</code> (low byte): those two, and ' +
    'only those two, reach IE at all. <b>With <code>SP = 0xFFFF</code> the two writes land at ' +
    '<code>0xFFFE</code> and <code>0xFFFD</code>, and neither is IE</b>, so an implementer who expects ' +
    'the effect there is studying a stack pointer that cannot produce it. <b>Of the two that do ' +
    'reach IE, only <code>0x0000</code> does it before the sample.</b> With ' +
    '<code>SP&nbsp;=&nbsp;0x0001</code> the byte that reaches IE is the <em>low</em> byte, written ' +
    'at M4, and D.12.2 places the sample between M3 and M4: the vector is already decided. That ' +
    'write changes IE for the <em>next</em> dispatch and ' +
    'is invisible to this one. <b>Which pushes reach IE and which of them reach it in time are two ' +
    'questions, and both have to be answered in the same breath, because the sample sits between ' +
    'the two writes.</b></div>' +
    '<table class="gbemu-table"><thead><tr><th>Bit</th><th>Source</th><th>Vector</th></tr></thead><tbody>' +
      '<tr><td>0</td><td>V-Blank</td><td><code>0x0040</code></td></tr>' +
      '<tr><td>1</td><td>LCD status</td><td><code>0x0048</code></td></tr>' +
      '<tr><td>2</td><td>Timer</td><td><code>0x0050</code></td></tr>' +
      '<tr><td>3</td><td>Serial</td><td><code>0x0058</code></td></tr>' +
      '<tr><td>4</td><td>Joypad</td><td><code>0x0060</code></td></tr>' +
    '</tbody></table>' +
    '<div class="gbemu-rule" id="gbr-D-10-3"><b>Rule D.10/3.</b> Priority is lowest bit first. <b>The IF bit must be cleared only if a bit ' +
    'survived the re-sample</b>: a cancelled dispatch clears nothing.</div>' +
    '<div class="gbemu-why"><b>Why it is here.</b> The same five vectors ' +
    'and the same priority are in appendix A; they are repeated here because a dispatch is an ' +
    'instruction-stream event and an implementer reading this appendix should not have to leave it.</div>' +
    '<h4 class="gbemu-sub">D.10.1: Where a pending request is noticed</h4>' +
    '<p class="hw-readable"><b>Scale used throughout D.10.1.</b> Every dot here is on the access scale of section 14: &ldquo;dot S&rdquo; means the current line&rsquo;s dot counter reads S, so dots 0 to S &minus; 1 of the line are finished and dot S is not begun. A picture request raised while the picture processor works dot D (event scale) is seen by a test made on dot D + 1 or later. One machine cycle is 4 dots on the original.</p>' +
    '<div class="gbemu-rule" id="gbr-D-10-1-1"><b>Rule D.10.1/1.</b> The processor must test for a pending request <b>once per instruction, at the instruction boundary after its last machine cycle, and never ' +
    'inside an instruction.</b> While halted it tests once per machine cycle (Rule D.8/4). The test is: IME set and ' +
    '<code>IE &amp; IF &amp; 0x1F</code> non-zero, with the status bit left out while the line-0 hold or the ' +
    'coincidence hold of E.6 runs.</div>' +
    '<div class="gbemu-rule" id="gbr-D-10-1-2"><b>Rule D.10.1/2.</b> Every sample of the request must read the same held view as Rule D.10.1/1: this test, the halted wake and the halt-bug arming test of D.8, and the re-sample of D.12.2 (so a status request still held is not taken by the re-sample either). Once a test starts a dispatch, nothing else is sampled until the re-sample after the high-byte push' +
    ' (D.12.2), and the handler&rsquo;s first instruction always runs before the next test.</div>' +
    '<div class="gbemu-why"><b>Why.</b> MECHANISM, read from our source.</div>' +
    '<div class="gbemu-rule" id="gbr-D-10-1-3"><b>Rule D.10.1/3. The instant of the test, with no look.</b> The picture&rsquo;s clock and the timer&rsquo;s clock place it differently. At every instruction boundary (and before every idle machine cycle of HALT) the machine must run these steps:' +
    '<ol class="gbemu-steps">' +
      '<li><b>Pay the picture.</b> The picture processor processes every dot it owes (appendix E.5&rsquo;s order pays each machine cycle&rsquo;s dots at the start of the next cycle, and the debt is paid off here). It has then finished every dot up to the dot the next opcode fetch&rsquo;s access would be made on. Call the dot counter&rsquo;s reading at this point <b>S</b>.</li>' +
      '<li><b>Leave the timer.</b> The timer is not advanced: it stands where the previous instruction&rsquo;s last machine cycle left it.</li>' +
      '<li><b>Test</b> (Rule D.10.1/1), on dot S. The test sees every picture request raised on dot S &minus; 1 (event scale) or earlier, and the timer, serial and pad requests raised up to the end of ' +
    'the previous instruction&rsquo;s last machine cycle; it sees none raised in the four timer ticks of ' +
    'the machine cycle that follows.</li>' +
      '<li><b>If the test takes a request</b>, the five dispatch cycles start here, and in picture time the first of them is the machine cycle that would have fetched the next opcode: dispatch M1. Nothing is fetched in it and PC does not advance. It advances the timer and the sound unit by four T-cycles and processes no dots of its own (it owes four, paid by the next cycle, as every cycle does). Four more cycles follow (D.12.2). Each idle machine cycle of HALT is the same as this M1.</li>' +
      '<li><b>If it takes none</b>, the next opcode fetch makes its access on dot S, and each later machine cycle of that instruction makes its access 4 dots after the one before it (S + 4, S + 8, &hellip;).</li>' +
    '</ol>' +
    '<b>In one sentence, for a core that runs the picture before each access:</b> before the test, run the picture through the dots of the machine cycle ' +
    'that would fetch the next opcode, and do not advance the timer for that cycle (leave it where the previous instruction left it).</div>' +
    '<div class="gbemu-why"><b>Why.</b> MECHANISM, read from our source (<code>ppu_settle</code>, <code>service_interrupt</code>): in our core the picture&rsquo;s owed dots are paid at the instruction boundary and the request test follows.</div>' +

    '<div class="gbemu-rule" id="gbr-D-10-1-4"><b>Rule D.10.1/4. The look (the original only).</b> At an instruction boundary of a running original, when every row of Rule D.10.1/5 holds, the picture processor must process two more dots after step 1 of Rule D.10.1/3 and before the test, and the next machine cycle owes those two dots back (Rule D.10.1/6), so the processor&rsquo;s timing does not move (Rule D.10.1/7). This is <b>the look</b>. When any row fails, the test is made on dot S as Rule D.10.1/3 puts it. A halted processor never looks: its test stays on dot S. HALT&rsquo;s own test uses the look with its own conditions (Rule D.8/2). Not on the Colour, which has its own timing (the Colour tab, section 10).</div>' +
    '<div class="gbemu-why"><b>Why: the running processor sees two dots further than the halted one.</b> Three hardware tables decide it: the AGE test <code>stat-int</code> (a running processor taking the mode-0, mode-2 and mode-1 interrupts) needs the running side two dots later than the halted one, <code>halt-m0-interrupt</code> (the halt bug, decided by the request as HALT executes) needs the same two dots, and Mooneye&rsquo;s <code>hblank_ly_scx_timing</code> (a halted processor) needs the halted side where Rule D.10.1/3 puts it. The look is fitted together with E.1&rsquo;s drawing-register write placement and E.6&rsquo;s line-0 and coincidence holds of 3 dots and 1 dot (section 14). Labels: the split into two sampling points and the HALT test are MECHANISM, the two dots FITTED. Constants: <code>RUN_IRQ_LOOK_DMG</code> = 2, <code>RUN_IRQ_LOOK_EDGES</code> = 3, <code>DMG_HALT_TEST_END</code> = 2.</div>' +

    '<div class="gbemu-rule" id="gbr-D-10-1-5"><b>Rule D.10.1/5. When the look is made.</b> The look is made at an instruction boundary if and only if all eight rows hold. Each row is read at the boundary, after step 1 of Rule D.10.1/3 has paid the picture.' +
    '<table class="gbemu-table"><thead><tr><th>Row</th><th>Condition</th><th>Holds when (dots on the access scale of section 14, S as in Rule D.10.1/3)</th></tr></thead><tbody>' +
      '<tr><td>1</td><td>Machine</td><td>An original, never a Colour.</td></tr>' +
      '<tr><td>2</td><td>Processor</td><td>Running: not halted.</td></tr>' +
      '<tr><td>3</td><td>Display</td><td>On.</td></tr>' +
      '<tr><td>4</td><td>Sprite-memory transfer</td><td>None running, and none starting.</td></tr>' +
      '<tr><td>5</td><td>Picture level</td><td>No dots owed once step 1 has paid the picture. This holds at every boundary reached after at least one machine cycle has run since the last look, so <b>a look on the previous boundary does not block this one</b>, even after a one-cycle <code>NOP</code>. The only boundary this row excludes is one reached with no machine cycle run since a look (a halted processor&rsquo;s own look; a halted processor never looks anyway, row 2).</td></tr>' +
      '<tr><td>6</td><td>Worth the look</td><td>The vertical-blank or the status interrupt, either or both, is enabled in IE while its bit is clear in IF: <code>IE &amp; 0x03 &amp; ~IF</code> is not 0. IF here is the stored byte: a status bit that is set and still held out of the test (Rule 14/11) counts as set.</td></tr>' +
      '<tr><td>7</td><td>Near a rising request</td><td>At least one of: S is 452 or more (the end of a line, the power-on line included); S is 12 or less (the start of a line); the line is drawing (internal mode 3, the live mode that drives memory blocking, or interrupt-logic mode 3) and the output position (the count of pixels popped so far on the line, the glossary&rsquo;s sense; not the pixels that have reached the screen, which lag the pops by one dot) is 140 or more. <code>RUN_IRQ_LOOK_EDGES</code> switches these windows: it is a pair of on/off bits, 1 for the line start (the first two windows) and 2 for the end of drawing, so 3 is both. It is not a count of dots. These are the dots where a picture request can rise: the start of a line (the first two windows: mode 2, coincidence and vertical blank) and the end of drawing (the third).</td></tr>' +
      '<tr><td>8</td><td>The next instruction</td><td>Its second machine cycle is not a memory access through (HL), (BC), (DE), (C) or the stack. Read off the opcode at PC (peeked: no machine cycle and no dot is spent on it), the look is <b>not</b> made before: <code>LD (BC),A</code>, <code>LD (DE),A</code>, <code>LD (HL+),A</code>, <code>LD (HL-),A</code> and the four loads of A from the same places; <code>INC (HL)</code>, <code>DEC (HL)</code>; every <code>LD r,(HL)</code> and <code>LD (HL),r</code>; the eight A-with-(HL) arithmetic and logic opcodes; <code>LDH (C),A</code> and <code>LDH A,(C)</code>; the four <code>POP</code>s, <code>RET</code> and <code>RETI</code>. As bytes: <code>0x02 0x12 0x22 0x32 0x0A 0x1A 0x2A 0x3A 0x34 0x35 0x46 0x4E 0x56 0x5E 0x66 0x6E 0x7E 0x70</code>&ndash;<code>0x75 0x77 0x86 0x8E 0x96 0x9E 0xA6 0xAE 0xB6 0xBE 0xE2 0xF2 0xC1 0xD1 0xE1 0xF1 0xC9 0xD9</code>. Every other opcode allows it (its second cycle is an operand fetch, an internal cycle or a second opcode byte), <code>0xCB</code> included.</td></tr>' +
    '</tbody></table></div>' +
    '<div class="gbemu-why"><b>Why row 5 reads as it does.</b> In our source the test is &ldquo;no dots owed&rdquo; <em>after</em> the boundary has paid the picture, which is always true once a machine cycle has run: after a look, the opcode fetch that follows processes no dots, and the next machine cycle processes the remaining two, so by the next boundary the picture is level again. In a run of <code>NOP</code>s near the start of a line the look is therefore made at <em>every</em> boundary, not every other one (Example 1 below). The opcode list of row 8 is read from our source (the look&rsquo;s gate); with it, no instruction that follows a look makes a data access in its second machine cycle, the cycle that repays the two dots.</div>' +

    '<div class="gbemu-rule" id="gbr-D-10-1-6"><b>Rule D.10.1/6. What the look does.</b> When Rule D.10.1/5 holds, the machine must run these steps in place of Rule D.10.1/3&rsquo;s steps 3 to 5 (step 1 has paid the picture to dot S; step 2 still leaves the timer):' +
    '<ol class="gbemu-steps">' +
      '<li>The picture processor processes two more dots (dots S and S + 1). The dot counter reads S + 2. The timer is not advanced.</li>' +
      '<li>The test is made on dot S + 2. It reads the request bits as they then stand (with the holds of E.6), so it sees a picture request raised on dot S + 1 (event scale) or earlier.</li>' +
      '<li>The next machine cycle (the opcode fetch, or dispatch M1 if the test took a request) processes no dots. Its access, if it has one, is made on dot S + 2.</li>' +
      '<li>The machine cycle after it processes two dots instead of four. Its access is made on dot S + 4, the dot it has with no look. From there on the picture and the processor are level again. For a one-cycle instruction such as <code>NOP</code>, this cycle is the next boundary&rsquo;s step 1, which pays two dots and reaches S + 4.</li>' +
    '</ol>' +
    'If the processor is halted when it next samples and the picture is still ahead from a look (only after HALT&rsquo;s own look, Rule D.8/2), that sample leaves out every request the look raised. <b>Exactly</b>: it applies to the <em>first</em> halted sample after HALT&rsquo;s own look only (the one made while the picture is still two dots ahead); it leaves out every IF bit that was clear when that look began and set by the end of its two dots. Every later sample sees those bits like any other. Read from our source (the halted sample masks only while the picture is ahead).</div>' +
    '<div class="gbemu-example"><b>Example.</b> On an ordinary line of the original, HALT&rsquo;s fetch access is on dot 249 (no look before HALT) and HALT&rsquo;s look runs: HALT&rsquo;s test processes dots 249 to 254 (Rule D.8/2). A request bit that was clear before dot 253 and is set by the end of dot 254 is left out of the first halted sample, which is made with the picture still standing at the end of dot 254; the halted machine cycle then processes the two owed dots only (Rule D.10.1/6, step 4), and the second halted sample, made one machine cycle later, sees the bit.</div>' +
    '<div class="gbemu-why"><b>Why.</b> MECHANISM for the gate and the repayment, read from our source (<code>run_look</code>, <code>ppu_pay</code>); the two dots are FITTED, as above.</div>' +

    '<div class="gbemu-rule" id="gbr-D-10-1-7"><b>Rule D.10.1/7. The invariant, whatever the bookkeeping: a look never moves a later data access.</b> The one access a look moves is the opcode fetch (or dispatch M1) in the machine cycle straight after it, by two dots (Rule D.10.1/6, step 3). Every other bus read and bus write after the look, a register write&rsquo;s N included (E.1.1), must fall on exactly the dot it would have fallen on with no look, because the two dots are repaid by the start of the second machine cycle after the look. A build that pays each opcode fetch&rsquo;s dots at the boundary pays 2 instead of 4 at the boundary after a look, and must not carry the two dots into a later write.</div>' +
    '<div class="gbemu-why"><b>Why it is stated as an invariant.</b> An independent build that refused a look on the boundary right after a look scored 4 of 24 mealybug pictures (every handler&rsquo;s writes one machine cycle late on lines 1 to 143); the same build with only that changed scored 24 of 24. Example 3 shows how the refusal produces that.</div>' +

    '<div class="gbemu-example"><b>Example 1: a run of <code>NOP</code>s from the start of a line.</b> An original, running, display on, no transfer, IE = <code>0x02</code> and IF bit 1 clear, and a boundary on which step 1 leaves the dot counter at S = 0. Every row of Rule D.10.1/5 holds while S is 12 or less. <b>The dots in Examples 1 to 3 are counted from that boundary</b>, to keep the arithmetic plain; they are not a real line&rsquo;s phase. On an ordinary line of the original every S is a dot 4k + 1 (Rule 1/4): a run from the start of such a line has S = 1, 5, 9, 13, 17, every dot below is one higher, and row 7&rsquo;s &ldquo;S is 12 or less&rdquo; then holds for S = 1, 5 and 9 only, so three boundaries look, not four.' +
    '<table class="gbemu-table"><thead><tr><th>Boundary</th><th>S after step 1 (access dot)</th><th>Look made?</th><th>Test made on (access dot)</th><th><code>NOP</code> opcode fetch on (access dot)</th><th>Dots the <code>NOP</code>&rsquo;s cycle owes, paid at the next boundary</th></tr></thead><tbody>' +
      '<tr><td>1</td><td>0</td><td>yes</td><td>2</td><td>2</td><td>2</td></tr>' +
      '<tr><td>2</td><td>4</td><td>yes</td><td>6</td><td>6</td><td>2</td></tr>' +
      '<tr><td>3</td><td>8</td><td>yes</td><td>10</td><td>10</td><td>2</td></tr>' +
      '<tr><td>4</td><td>12</td><td>yes</td><td>14</td><td>14</td><td>2</td></tr>' +
      '<tr><td>5</td><td>16</td><td>no: S is past 12</td><td>16</td><td>16</td><td>4</td></tr>' +
    '</tbody></table>' +
    'The boundaries stay 4 dots apart (0, 4, 8, 12, 16), as with no look at all. Two wrong readings this rules out: (a) &ldquo;a look blocks the next boundary&rsquo;s look&rdquo; would test on 2, 4, 10, 12, 16; (b) &ldquo;a look shifts everything after it two dots later&rdquo; would put boundary 2 at S = 6, not 4.</div>' +
    '<div class="gbemu-example"><b>Example 2: a write after a look.</b> A boundary with S = 4, every row holding, and the next instruction <code>LDH (a8),A</code> (<code>0xE0</code>: M1 opcode, M2 fetch a8, M3 the write; its second cycle is an operand fetch, so row 8 allows the look).' +
    '<table class="gbemu-table"><thead><tr><th>Event</th><th>No look (access dot)</th><th>With the look (access dot)</th></tr></thead><tbody>' +
      '<tr><td>The test</td><td>4</td><td>6</td></tr>' +
      '<tr><td>M1: opcode fetch</td><td>4</td><td>6</td></tr>' +
      '<tr><td>M2: fetch a8</td><td>8</td><td>8</td></tr>' +
      '<tr><td>M3: the write to <code>0xFF00 + a8</code></td><td>12</td><td>12</td></tr>' +
    '</tbody></table>' +
    'The write is on dot 12 either way. A build that carries the two dots forward puts it on 14: that is the wrong reading. With <code>LDH (C),A</code> (<code>0xE2</code>) in its place, row 8 fails and no look is made: the test is on 4 and the write, in M2, on 8.</div>' +
    '<div class="gbemu-example"><b>Example 3: what refusing the second look costs.</b> In Example 1, let a picture request be raised on dot 5 (event scale), so a test first sees it on dot 6. Built to the rules, boundary 2 tests on 6 and takes it there. A build that refuses the look at boundary 2 (because boundary 1 looked) tests on 4, misses it, and takes it at boundary 3, one machine cycle later; every write the handler makes then lands one machine cycle late.</div>' +

    '<div class="gbemu-why"><b>The same rule, in a second form, and what each other placement costs.</b> Run the picture level with ' +
    'the timer, and in picture time the test sits at the <em>end</em> of the machine cycle that would ' +
    'fetch the next opcode; when the request is taken, that cycle becomes dispatch M1: nothing it ' +
    'fetched is used, PC does not advance, and four more cycles follow. On the picture side that is ' +
    'exactly our core. On the timer side ours tests at the <em>start</em> of that cycle. Measured, with' +
    ' each reading built into a copy of our core (an older core than the shipped one, see below):</div>' +
    '<table class="gbemu-table"><thead><tr><th>Where the test is made</th><th>Original rows lost (of the 65 the measured core passed)</th><th>Colour rows lost (of the 52 the measured core passed)</th></tr></thead><tbody>' +
    '<tr><td>Ours: at the boundary, picture paid up</td><td>0</td><td>0</td></tr>' +
    '<tr><td>At the end of the next fetch cycle on both clocks (the second form)</td><td>1:' +
    ' <code>serial/boot_sclk_align-dmgABCmgb</code></td><td>0</td></tr>' +
    '<tr><td>At the previous instruction&rsquo;s last access, picture not paid up (four dots ' +
    'early)</td><td>6: <code>hblank_ly_scx_timing-GS</code>, <code>intr_1_2_timing-GS</code>, ' +
    '<code>intr_2_mode0_timing</code>, <code>intr_2_mode0_timing_sprites</code>, ' +
    '<code>intr_2_mode3_timing</code>, <code>intr_2_oam_ok_timing</code></td><td>3: ' +
    '<code>intr_2_mode0_timing</code>, <code>intr_2_mode3_timing</code>, ' +
    '<code>intr_2_oam_ok_timing</code></td></tr>' +
    '<tr><td>Ours, but the cycle is not absorbed: six dispatch cycles</td><td>10: ' +
    '<code>di_timing-GS</code>, <code>halt_ime0_nointr_timing</code>, <code>intr_timing</code> and ' +
    'seven picture-interrupt rows</td><td>6</td></tr>' +
    '<tr><td>Ours, but the vector chosen at M1 instead of after the high-byte push</td><td>1: ' +
    '<code>interrupts/ie_push</code></td><td>1: <code>interrupts/ie_push</code></td></tr>' +
    '</tbody></table>' +
    '<div class="gbemu-why"><b>The denominators, as the table was measured:</b> the 66 Mooneye acceptance ' +
    'cartridges for the original, run without a boot program (65 passed on the measured core; ' +
    '<code>boot_hwio-dmgABCmgb</code> needed the boot program for one sound byte), and the 53 unsuffixed ' +
    'acceptance cartridges run on the Color device (52 passed on the measured core; ' +
    '<code>intr_2_mode0_timing_sprites</code> failed there and was not counted). <b>The shipped core passes all 66 and all 53</b> (with and without the boot program). The measured core lacked two changes the shipped core has, section 3&rsquo;s sound table and E.6&rsquo;s Color lead, ' +
    'and neither moves the instant this table is about. The table has not been re-taken on the shipped core: read each row as what that placement cost on the measured core, not as a count on the shipped core. The rule it supports, the first row, is the shipped core&rsquo;s and is MECHANISM.</div>' +


    '<h4 class="gbemu-sub">D.11: Two structural notes the tables would otherwise hide</h4>' +
    '<p class="hw-readable"><b><code>LD B,B</code> (<code>0x40</code>) is an exact no-op on ' +
    'hardware.</b> This core additionally raises a harness flag when it executes, because ' +
    'Mooneye&rsquo;s test cartridges reserve that opcode as a &ldquo;read my result registers ' +
    'now&rdquo; marker. <b>That is a build convenience and not a behaviour.</b> A port does not need ' +
    'it, but a port that wants to score against Mooneye needs some equivalent hook, and this ' +
    'is the cheapest one.</p>' +
    '<p class="hw-readable"><b>Which opcodes carry the sprite-memory corruption triggers.</b> The ' +
    'corruption rule itself is section 5; what belongs here is <em>which instructions reach it</em>, ' +
    'because that is decode-path information and nothing else on the page carries it.</p>' +
    '<div class="gbemu-rule" id="gbr-D-11-1"><b>Rule D.11/1.</b> These instructions, and only these, must reach the corruption triggers of section 5, charged as this table gives:</div>' +
    '<table class="gbemu-table"><thead><tr><th>Trigger</th><th>Opcodes</th></tr></thead><tbody>' +
      '<tr><td>Increment / decrement unit</td><td><code>INC rr</code> / <code>DEC rr</code> (<code>0x03 ' +
      '0x13 0x23 0x33 0x0B 0x1B 0x2B 0x3B</code>) and the first stack cycle of <code>PUSH</code>, ' +
    '<code>CALL</code> and <code>RST</code>, and <b>interrupt dispatch</b>, charged exactly as <code>PUSH</code> charges it: one event, attributed to the start of the internal cycle just before the high-byte write (M2 of <code>PUSH</code>, <code>RST</code> and the dispatch, M4 of <code>CALL</code>), on the stack pointer before its decrement, then the two real writes, each corrupting as a write. MECHANISM, read from our source (<code>push16</code>, <code>OAM_BUG_IDU_BUS</code>). MECHANISM: the source document names the interrupt beside push, ' +
    'call and rst, and the dispatch has the same cycle shape as <code>PUSH</code> from its internal cycle ' +
    'on. No cartridge we hold puts the stack pointer in sprite memory during a dispatch, so no result buffer moves either way.</td></tr>' +

      '<tr><td>Read-modify-write (section 5&rsquo;s &ldquo;read during an increment&rdquo;)</td><td><code>LD A,(HL+)</code> <code>0x2A</code>, <code>LD A,(HL-)</code> <code>0x3A</code>, and the <b>first</b> stack read of <code>POP rr</code> (all four), <code>RET</code>, <code>RETI</code> and a taken <code>RET cc</code>. Each is charged in this order: first the read-during-increment event, sampled at the start of that machine cycle, then the read itself corrupts as a plain read (section 5&rsquo;s read row). The <b>second</b> stack read of the same instructions is a plain read only, with no increment event. An untaken <code>RET cc</code> reads nothing and charges nothing. Like every trigger here, it acts only inside section 5&rsquo;s window (original, screen on, lines 0 to 143, counter below 80, no transfer), so never in vertical blank and never on a Colour. MECHANISM, read from our source (<code>pop16</code>, <code>OAM_BUG_RMW</code>).</td></tr>' +
    '</tbody></table>' +
    '<div class="gbemu-rule" id="gbr-D-11-2"><b>Rule D.11/2.</b> The counts are asymmetric: <b>the push form charges three corrupting accesses</b> (two real writes plus one ' +
    'implied decrement: the fourth collapses into the same machine cycle as a real write), ' +
    'and <b>the pop form charges three</b> (in this page&rsquo;s terms, the first two are one event, section 5&rsquo;s &ldquo;read during an increment&rdquo;, followed by the read&rsquo;s own plain read corruption, and the third is the second read&rsquo;s plain read corruption, as the Read-modify-write row above gives it). <code>LD (HL+),A</code> (<code>0x22</code>) and <code>LD (HL-),A</code> (<code>0x32</code>) are on neither row: each is charged as one plain write corruption, and the pointer&rsquo;s increment charges nothing.</div>' +
    '<div class="gbemu-why"><b>Why.</b> The counts are the source document&rsquo;s, not ' +
    'arithmetic; for the pop form the source document&rsquo;s words are: one read, one glitched write, and a second read with no ' +
    'glitched write. <b>Deriving four for either is the natural mistake.</b> MECHANISM, read from our source.</div>' +

    '<h4 class="gbemu-sub">D.12: Which machine cycle carries which bus access</h4>' +
    '<div class="gbemu-why"><b>Why this subsection exists.</b> D.1 states the invariant in its own words (<i>&ldquo;how many ' +
    'machine cycles elapse, <b>and which of them each bus access falls on</b>&rdquo;</i>) ' +
    'and then supplies only the first half. The grids give totals. <b>This is the second half, and ' +
    'it is the most expensive omission a build guide can have</b>, because of when you find out: a ' +
    'core that charges an instruction&rsquo;s total at the end <b>passes Blargg&rsquo;s ' +
    '<code>instr_timing</code> and all eleven <code>cpu_instrs</code> cartridges from the first ' +
    'day</b>, and then fails <code>mem_timing</code>, <code>mem_timing-2</code>, most of ' +
    'Mooneye&rsquo;s acceptance timing rows, every mid-line section of this page and the ' +
    'sprite-memory corruption rows, in a pattern that reads like a picture-processor bug. ' +
    'You will search for it in the wrong subsystem for as long as you let yourself.</div>' +

    '<div class="gbemu-rule" id="gbr-D-12-1"><b>Rule D.12/1.</b> <b>The rule, and it is a rule rather than a 512-row table.</b> Four ' +
    'statements produce every placement below, and a build must follow all four:' +
    '<ol class="gbemu-steps">' +
      '<li><b>One machine cycle is charged for each of:</b> a byte fetched at PC (the opcode, and ' +
        'each immediate byte after it), each bus read, each bus write, and each explicit internal ' +
        'delay. That is Rule D.1/2, unchanged.</li>' +
      '<li><b>The time is spent first and the access lands at the END of the cycle it is charged ' +
        'to.</b> Within one machine cycle: advance the timer by four, advance the picture ' +
        'processor by four dots, advance any transfer in flight, <em>then</em> perform the read or ' +
        'the write. <b>This is the whole of &ldquo;a write lands mid-line&rdquo;</b>; appendix E.5 ' +
        'gives the ordering in full and E.1 the per-register departures from it.</li>' +
      '<li><b>Cycles run in program order and the accesses fall in the order the instruction needs ' +
        'them.</b> Immediates are fetched low byte first, one cycle each. A 16-bit push writes the ' +
        'HIGH byte first, at <code>SP&minus;1</code>, then the low byte at <code>SP&minus;2</code>. ' +
        'A 16-bit pop reads the LOW byte first, at <code>SP</code>, then the high byte at ' +
        '<code>SP+1</code>. Two cycles each, and <b>neither carries an internal delay of its ' +
        'own</b>: where an instruction has one, it belongs to the instruction, not to the ' +
        'push or the pop.</li>' +
      '<li><b>Everything else is arithmetic on registers and costs nothing.</b> If you can name no ' +
        'fetch, no bus access and no documented internal delay for a cycle, that cycle does not ' +
        'exist.</li>' +
    '</ol>' +
    '<b>M1 is always the opcode fetch.</b></div>' +
    '<div class="gbemu-why"><b>Why.</b> <b>Apply those four and the totals in D.3 and D.4 fall out, and so does ' +
    'the placement.</b> The cases in D.12.1 are the ones where the shape is not obvious, where ' +
    'the instruction has an internal delay whose position matters, or a count that does not follow ' +
    'from counting its bytes and its accesses. ' +
    '<b>MECHANISM</b>, read out of this core&rsquo;s decode paths; what verifies it is the board' +
    ': <code>mem_timing</code> 3 of 3, <code>mem_timing-2</code> 3 of 3, Mooneye 97 of 97, ' +
    'and the 24 mealybug cells that photograph where a write landed.</div>' +

    '<h4 class="gbemu-sub">D.12.1: The cases that are not obvious</h4>' +
    '<div class="gbemu-rule" id="gbr-D-12-1-1"><b>Rule D.12.1/1.</b> These instructions must place their machine cycles exactly as this table gives (M1 first).</div>' +
    '<table class="gbemu-table"><thead><tr><th>Instruction</th><th>M-cycles, in order</th><th>Note</th></tr></thead><tbody>' +
      '<tr><td><code>LD (a16),SP</code> <code>0x08</code></td><td><b>5.</b> M1 opcode &middot; M2 fetch <code>a16</code> low &middot; M3 fetch <code>a16</code> high &middot; <b>M4 write SP&rsquo;s LOW byte to <code>a16</code></b> &middot; <b>M5 write SP&rsquo;s HIGH byte to <code>a16+1</code></b></td><td>The one instruction that writes sixteen bits to an absolute address, and the only place on the machine where the <em>low</em> byte is written first. It is not a push and it does not follow the push order</td></tr>' +
      '<tr><td><code>CALL a16</code> <code>0xCD</code></td><td><b>6.</b> M1 opcode &middot; M2 operand low &middot; M3 operand high &middot; <b>M4 internal delay</b> &middot; <b>M5 write PC high at <code>SP&minus;1</code></b> &middot; <b>M6 write PC low at <code>SP&minus;2</code></b></td><td>The delay sits <em>between</em> the last fetch and the first write. Both writes are in the last two cycles of the instruction</td></tr>' +
      '<tr><td><code>CALL cc,a16</code></td><td><b>6 taken, 3 not taken.</b> Both operand fetches happen either way. Taken, the shape above; not taken, the instruction ends after M3</td><td><b>The operand is always fetched</b>: a not-taken conditional call still costs three cycles and still advances PC by three. A core that skips the fetches costs two cycles and lands PC in the middle of an address</td></tr>' +
      '<tr><td><code>PUSH rr</code></td><td><b>4.</b> M1 opcode &middot; <b>M2 internal delay</b> &middot; <b>M3 write high at <code>SP&minus;1</code></b> &middot; <b>M4 write low at <code>SP&minus;2</code></b></td><td><b>The delay is before both writes, not between them and not after.</b> This is the case the question is usually asked about. Move it after the writes and both writes land one cycle earlier in timer, picture and transfer time: directly observable, and it is what <code>push_timing</code> measures</td></tr>' +
      '<tr><td><code>POP rr</code></td><td><b>3.</b> M1 opcode &middot; <b>M2 read low at <code>SP</code></b> &middot; <b>M3 read high at <code>SP+1</code></b></td><td><b>No internal delay at all.</b> Pop is not push backwards. <code>POP AF</code> is the same three cycles and masks the popped low byte with <code>0xF0</code> (D.2)</td></tr>' +
      '<tr><td><code>RST n</code></td><td><b>4.</b> M1 opcode &middot; <b>M2 internal</b> &middot; <b>M3 write PC high</b> &middot; <b>M4 write PC low</b></td><td>Exactly <code>PUSH</code>&rsquo;s shape with the vector loaded at the end. One byte, no operand fetch</td></tr>' +
      '<tr><td><code>RET</code> <code>0xC9</code></td><td><b>4.</b> M1 opcode &middot; <b>M2 read PC low</b> &middot; <b>M3 read PC high</b> &middot; <b>M4 internal</b></td><td>The delay is <em>after</em> the reads: the mirror of <code>PUSH</code>, where it is before the writes</td></tr>' +
      '<tr><td><code>RET cc</code></td><td><b>5 taken, 2 not taken.</b> M1 opcode &middot; <b>M2 internal. The condition-check cycle, which runs either way</b> &middot; taken: M3 read low &middot; M4 read high &middot; M5 internal</td><td><b>This is the only conditional on the machine that pays a cycle for asking.</b> A not-taken <code>RET cc</code> costs 8 T, not 4. Mooneye <code>ret_cc_timing</code> pins both the leading cycle and the trailing one; neither is movable</td></tr>' +
      '<tr><td><code>RETI</code> <code>0xD9</code></td><td><b>4.</b> Identical to <code>RET</code></td><td>The difference is not in the timing: <b>IME is set immediately, with no one-instruction deferral</b>, and any <code>EI</code> schedule in flight is cancelled (D.8)</td></tr>' +
      '<tr><td><code>ADD SP,e8</code> <code>0xE8</code></td><td><b>4.</b> M1 opcode &middot; <b>M2 fetch <code>e8</code></b> &middot; M3 internal &middot; M4 internal</td><td><b>Two internal delays and no bus access after M2.</b> On hardware they are the low-byte add and the high-byte add carrying into it; nothing observable separates them here</td></tr>' +
      '<tr><td><code>LD HL,SP+e8</code> <code>0xF8</code></td><td><b>3.</b> M1 opcode &middot; <b>M2 fetch <code>e8</code></b> &middot; M3 internal</td><td>One delay where <code>ADD SP,e8</code> has two: that single cycle is the entire difference between 16 T and 12 T, and the flags are identical (D.5.1)</td></tr>' +
      '<tr><td>Read-modify-write on <code>(HL)</code>: <code>INC (HL)</code> <code>0x34</code>, <code>DEC (HL)</code> <code>0x35</code></td><td><b>3.</b> M1 opcode &middot; <b>M2 read <code>(HL)</code></b> &middot; <b>M3 write <code>(HL)</code></b></td><td><b>The read and the write are in adjacent cycles with nothing between them, and the write is the last cycle of the instruction.</b> No internal delay. A core that does the read and the write in one cycle passes every instruction-timing row and fails the access-window rows</td></tr>' +
      '<tr><td>CB read-modify-write on <code>(HL)</code>: <code>RLC RRC RL RR SLA SRA SWAP SRL RES SET</code></td><td><b>4.</b> M1 the <code>0xCB</code> byte &middot; M2 the operation byte &middot; <b>M3 read <code>(HL)</code></b> &middot; <b>M4 write <code>(HL)</code></b></td><td>The prefix fetch is a machine cycle of its own, so the read is M3 and not M2: one cycle later in line time than the unprefixed forms above</td></tr>' +
      '<tr><td><code>BIT n,(HL)</code></td><td><b>3.</b> M1 <code>0xCB</code> &middot; M2 operation byte &middot; <b>M3 read <code>(HL)</code></b>. <b>There is no fourth cycle and no write.</b></td><td>The exception inside the CB <code>(HL)</code> block. <code>BIT</code> only tests, so it never performs the write half: 12 T against 16 T for its neighbours in the same column of the grid</td></tr>' +
      '<tr><td><code>JP a16</code> <code>0xC3</code> / <code>JP cc,a16</code></td><td><b>4 taken, 3 not taken.</b> M1 &middot; M2 operand low &middot; M3 operand high &middot; <b>M4 internal, only if taken</b></td><td>The taken-branch cycle is the <em>last</em> cycle, after both fetches. Operands are always fetched</td></tr>' +
      '<tr><td><code>JP HL</code> <code>0xE9</code></td><td><b>1.</b> M1 opcode, and nothing else</td><td>No internal cycle. The one jump on the machine that costs 4 T, and the reason a jump table through HL is cheap</td></tr>' +
      '<tr><td><code>JR e8</code> <code>0x18</code> / <code>JR cc,e8</code></td><td><b>3 taken, 2 not taken.</b> M1 &middot; M2 fetch <code>e8</code> &middot; <b>M3 internal, only if taken</b></td><td>Same shape: operand always fetched, penalty cycle last</td></tr>' +
      '<tr><td><code>INC rr</code> / <code>DEC rr</code> (16-bit)</td><td><b>2.</b> M1 opcode &middot; <b>M2 internal</b></td><td>No bus access in M2. <b>But see Rule D.12.3/1</b>: M2 is the cycle that carries the sprite-memory corruption trigger, and <em>where within M2</em> is not free</td></tr>' +
      '<tr><td><code>ADD HL,rr</code> / <code>LD SP,HL</code> <code>0xF9</code></td><td><b>2.</b> M1 opcode &middot; <b>M2 internal</b></td><td>Same shape, no corruption trigger</td></tr>' +
      '<tr><td><code>LDH (a8),A</code> <code>0xE0</code> / <code>LDH A,(a8)</code> <code>0xF0</code></td><td><b>3.</b> M1 &middot; M2 fetch <code>a8</code> &middot; <b>M3 the access at <code>0xFF00+a8</code></b></td><td>The access is the last cycle, as always</td></tr>' +
      '<tr><td><code>LDH (C),A</code> <code>0xE2</code> / <code>LDH A,(C)</code> <code>0xF2</code></td><td><b>2.</b> M1 &middot; <b>M2 the access at <code>0xFF00+C</code></b></td><td>No operand to fetch, so the access is one cycle earlier than the <code>LDH</code> forms. <b>This is the two-cycle write every timing-sensitive register poke is built out of</b></td></tr>' +
      '<tr><td><code>LD (a16),A</code> <code>0xEA</code> / <code>LD A,(a16)</code> <code>0xFA</code></td><td><b>4.</b> M1 &middot; M2 operand low &middot; M3 operand high &middot; <b>M4 the access</b></td><td>none</td></tr>' +
      '<tr><td><code>HALT</code> <code>0x76</code></td><td><b>1.</b> M1 opcode, and that is the whole instruction</td><td>The idling is not part of <code>HALT</code>: each subsequent step consumes one machine cycle while the halt holds (D.8)</td></tr>' +
      '<tr><td><code>STOP</code> <code>0x10</code></td><td><b>2.</b> M1 opcode &middot; <b>M2 fetch the second byte, which is discarded</b></td><td>It is fetched, not skipped: PC advances by two. D.9 records that its own duration is NOT ESTABLISHED and that published tables give 4 T</td></tr>' +
      '<tr><td><code>EI</code> <code>0xFB</code> / <code>DI</code> <code>0xF3</code></td><td><b>1 each.</b> M1 opcode</td><td>Neither carries a delay cycle. <code>EI</code>&rsquo;s deferral is in <em>when IME takes effect</em>, not in cycles spent: it is set after the following instruction completes (D.8)</td></tr>' +
      '<tr><td>Prefix <code>0xCB</code></td><td><b>Its own machine cycle, always.</b> M1 is the <code>0xCB</code> byte and M2 is the operation byte</td><td>So a register-operand CB instruction is 2 cycles, an <code>(HL)</code> form is 4, and <code>BIT n,(HL)</code> is 3. The totals in the CB grids already include the prefix</td></tr>' +
    '</tbody></table>' +

    '<h4 class="gbemu-sub">D.12.2: Interrupt dispatch, cycle by cycle</h4>' +
    '<p class="hw-readable">D.10 gives the five cycles and the observable. This is where each one ' +
    'falls, because the sample point is only meaningful against the writes.</p>' +
    '<div class="gbemu-rule" id="gbr-D-12-2-1"><b>Rule D.12.2/1.</b> The five dispatch cycles must carry exactly this, in this order:</div>' +
    '<table class="gbemu-table"><thead><tr><th>Cycle</th><th>What it carries</th></tr></thead><tbody>' +
      '<tr><td><b>M1</b></td><td>internal: no bus access. IME has already been cleared, before M1 runs. ' +
      'In picture time M1 is the machine cycle that would have fetched the next opcode, and the test that' +
      ' started the dispatch sits at its end (D.10.1).</td></tr>' +

      '<tr><td><b>M2</b></td><td>internal: no bus access</td></tr>' +
      '<tr><td><b>M3</b></td><td><b>write PC&rsquo;s high byte at <code>SP&minus;1</code></b></td></tr>' +
      '<tr><td><em>between M3 and M4</em></td><td><b><code>IE &amp; IF &amp; 0x1F</code> is sampled and the vector is decided here.</b> This is the observable, and it is why the placement matters: if M3&rsquo;s write landed on <code>0xFFFF</code> it has already changed IE by the time this read happens</td></tr>' +
      '<tr><td><b>M4</b></td><td><b>write PC&rsquo;s low byte at <code>SP&minus;2</code></b></td></tr>' +
      '<tr><td><b>M5</b></td><td>internal: PC is loaded with the vector. If the sample found no bit set, the vector is <code>0x0000</code> and no IF bit is cleared</td></tr>' +
    '</tbody></table>' +
    '<div class="gbemu-why"><b>Why.</b> <b>Sample after M3 and before M4. That single ordering is the whole of ' +
    'Mooneye <code>ie_push</code></b>, and a core that samples at M1 gets the right vector on every ' +
    'ordinary dispatch and cannot produce the redirect at all. <b>The stack pointers that reach IE ' +
    'are <code>0x0000</code> and <code>0x0001</code>; the stack pointer that can redirect ' +
    '<em>this</em> dispatch is <code>0x0000</code> alone</b>. Read that off the table above ' +
    'rather than taking it on trust: <code>0x0001</code> puts its byte on <code>0xFFFF</code> at ' +
    '<b>M4</b>, and the sample has already happened. See D.10.</div>' +
    '<div class="gbemu-rule" id="gbr-D-12-2-2"><b>Rule D.12.2/2. The same five cycles on the dot scale.</b> S is the dot of Rule D.10.1/3: the dot the next opcode fetch&rsquo;s access ' +
    'would have used with no look, on section 14&rsquo;s access scale. With no look the test is made on S. With a look the test is made on S + 2 (Rule D.10.1/6) and every later row of this table is unchanged (Rule D.10.1/7).</div>' +
    '<table class="gbemu-table"><thead><tr><th>Event</th><th>Dot (access scale of section 14, counted from S)</th></tr></thead><tbody>' +
    '<tr><td>The test that starts the dispatch; M1 ends (no access)</td><td>S (S + 2 after a look)</td></tr>' +
    '<tr><td>M2 ends (no access)</td><td>S + 4</td></tr>' +
    '<tr><td>M3: PC high byte written at <code>SP&minus;1</code></td><td>S + 8</td></tr>' +
    '<tr><td>The re-sample of <code>IE &amp; IF &amp; 0x1F</code>, and the vector chosen</td><td>S + 8,' +
    ' after M3&rsquo;s write</td></tr>' +
    '<tr><td>M4: PC low byte written at <code>SP&minus;2</code></td><td>S + 12</td></tr>' +
    '<tr><td>M5 ends: PC holds the vector</td><td>S + 16</td></tr>' +
    '<tr><td>The handler&rsquo;s first opcode fetch</td><td>S + 20</td></tr>' +
    '</tbody></table>' +
    '<div class="gbemu-why"><b>Why.</b> Read from our source (<code>service_interrupt</code>, <code>run_look</code>, <code>ppu_pay</code>).</div>' +
    '<div class="gbemu-rule" id="gbr-D-12-2-3"><b>Rule D.12.2/3.</b> The vector is the lowest bit set at the re-sample, ' +
    'whichever bit started the dispatch: a higher-priority request that rose during M1 to M3 takes it, ' +
    'and only that bit&rsquo;s IF is cleared. <b>When it is cleared</b>: after M4&rsquo;s bus access (the low-byte push) and before M5. If no bit was left at the re-sample, nothing is cleared and the vector is <code>0x0000</code>. The re-sample sees IF through E.6&rsquo;s line-0 and ' +
    'coincidence holds, exactly as the test at the boundary does (Rule D.10.1/2).' +
    '<table class="gbemu-table"><thead><tr><th>A second request for the same source as the vector taken</th><th>After the dispatch</th></tr></thead><tbody>' +
      '<tr><td>A timer or serial request raised in M4&rsquo;s ticks (the timer ticks before the access in every cycle, E.5)</td><td>Cleared with it</td></tr>' +
      '<tr><td>A timer or serial request raised in M5</td><td>Survives in IF (to be taken once the handler re-enables interrupts)</td></tr>' +
      '<tr><td>A picture request whose dot is processed in M5 (M4&rsquo;s own dots are paid at the start of M5)</td><td>Survives in IF</td></tr>' +
    '</tbody></table></div>' +
    '<div class="gbemu-why"><b>Why.</b> Read from our source (the dispatch routine).</div>' +


    '<h4 class="gbemu-sub">D.12.3: Where you may put the delay somewhere else</h4>' +
    '<p class="hw-readable">Per D.1&rsquo;s flexibility clause (Rule D.1/3), stated as invariants rather than as ' +
    'our arrangement. <b>These are the places where an implementer could place an internal cycle ' +
    'differently and no observable on the board or on any cartridge we hold would move:</b></p>' +
    '<ul class="gbemu-bullets">' +
      '<li><b><code>ADD SP,e8</code>&rsquo;s two internal cycles, and <code>LD HL,SP+e8</code>&rsquo;s ' +
        'one.</b> Neither touches the bus, so their order relative to the register arithmetic is ' +
        'unobservable. <b>The invariant is the count and the access map: 4 cycles with bus accesses ' +
        'on M1 and M2 only; 3 cycles with bus accesses on M1 and M2 only.</b></li>' +
      '<li><b>Whether <code>INC rr</code> / <code>DEC rr</code> / <code>ADD HL,rr</code> / ' +
        '<code>LD SP,HL</code> update the register before or after M2 elapses.</b> Nothing reads ' +
        'the register in between. <b>Invariant: 2 cycles, one bus access (the opcode fetch).</b></li>' +
      '<li><b>Which of dispatch&rsquo;s M1 and M2 you call which.</b> They are two identical ' +
        'internal cycles. <b>Invariant: two internal cycles before the first push, the sample ' +
        'between the two pushes, one internal cycle after the second.</b></li>' +
      '<li><b>Where in your code the vector is chosen</b>, as long as the <em>read</em> of ' +
        '<code>IE &amp; IF</code> happens after M3&rsquo;s write has landed and before M5 loads PC.</li>' +
    '</ul>' +
    '<div class="gbemu-rule" id="gbr-D-12-3-1"><b>Rule D.12.3/1. The places that seem flexible and are not.</b> Each of these costs ' +
    'named rows if you move it, and a build must keep all four:' +
    '<ul class="gbemu-bullets">' +
      '<li><b><code>PUSH</code>, <code>CALL</code> and <code>RST</code>: the internal cycle is ' +
        'before the writes.</b> Moving it after shifts both writes one machine cycle earlier ' +
        'against the timer, the picture processor and any transfer in flight. That is observable ' +
        'and it is scored.</li>' +
      '<li><b><code>RET cc</code>: the leading internal cycle runs on the not-taken path too.</b> ' +
        'Not-taken is 2 cycles, not 1. Fold it into the taken path and <code>ret_cc_timing</code> ' +
        'fails while every other conditional passes, which is a maximally confusing signal.</li>' +
      '<li><b>Conditional calls, jumps and relative jumps fetch their operands whether or not they ' +
        'are taken.</b> The saving is the internal cycle and the writes, never the fetches.</li>' +
      '<li><b>The sprite-memory corruption trigger on <code>INC rr</code> / <code>DEC rr</code> is ' +
        'sampled at the START of M2, not at its end.</b> This is the one place where a cycle with ' +
        'no bus access still has an observable sub-cycle phase: the increment/decrement unit ' +
        'is doing its work at the head of the cycle while the bus access of an ordinary cycle would ' +
        'be at the tail. D.11 lists which opcodes reach the triggers; section 5 has the corruption ' +
        'rule itself. <b>If your <code>oam_bug</code> rows fail with every instruction timing ' +
        'correct, this phase is where to look.</b></li>' +
    '</ul></div>' +
    '<div class="gbemu-why"><b>One thing to build in from the start, because retrofitting it is the ' +
    'expensive path.</b> Write the processor so that every fetch, read, write and internal delay ' +
    'goes through one function that advances the rest of the machine and <em>then</em> performs the ' +
    'access. Do that and the whole table above is a consequence of how each opcode is written, ' +
    'rather than 512 entries to keep in step. <b>The falsifier for the structure, not for any one ' +
    'row:</b> if your core can execute a whole instruction and only then advance the timer and the ' +
    'picture processor, it is wrong no matter what the grids say, and no amount of ' +
    '<code>instr_timing</code> passing will tell you.</div>' +

    '<h4 class="gbemu-sub">D.13: What this appendix does not pin</h4>' +
    '<ul class="gbemu-bullets">' +
      '<li><b><code>STOP</code>&rsquo;s own duration</b> (D.9). This core charges 8 T; published ' +
        'tables give 4.</li>' +
      '<li><b>Undefined-opcode granularity</b> (D.7). The lockup is documented; what the rest of the ' +
        'machine does during it is this core&rsquo;s structure.</li>' +
      '<li><b><code>HALT</code> advance granularity on Colour hardware.</b> On the original this ' +
        'core idles one machine cycle per step while halted. One oracle advances by four on Colour, ' +
        'and by four on the cycle it has just halted, and by two otherwise. <b>Caught by ' +
        'nothing</b>: no suite covers halt granularity, so this is named rather than ' +
        'resolved. What would establish it is a cartridge that halts and then reads the timer.</li>' +
    '</ul></section>' +

  /* ================================================================ APP-E
   * THE PICTURE PIPELINE, IN NUMBERS. Sections 7-14 give the mechanisms and
   * withhold the constants. A clean-room build from those sections alone
   * lands 60-90 rows short of the board, and the shortfall is clerical rather
   * than conceptual. This appendix is that clerical layer: every dot, every
   * lead, every width, with its label and -- where the label is FITTED -- the
   * value stated outright so nobody hunts for a derivation that does not
   * exist.
   *
   * WHERE RECORDS DISAGREE, the code is read and the code wins; those rulings
   * are marked in place. Two matter enough to repeat here: the scroll
   * register's lead is 1 and not 2, and access blocking is 6 dots and not
   * "one machine cycle" -- a phrase several records carry and the code beside
   * them contradicts by half.                                           */
  '</div>';
}
