/* ===========================================================================
 * Game Boy Emulation tab, area 8 of eight: Tests and scores
 * gbAcceptanceEmulationTabHTML(d) returns this area's HTML; the tab's composer in
 * gb-emulation-tab.js calls every area in order (2 November 2026: the tab
 * was split into area files so a builder can read one area at a time).
 * Loaded by a plain <script src> tag (the site must open over file://).
 * =========================================================================== */

function gbAcceptanceEmulationTabHTML(d) {
  const cells = GB_MB_CELLS.map(function (row) {
    const n = row[0], what = row[1], cls = row[2];
    const label = GB_HW_CLASS[cls][0], tip = GB_HW_CLASS[cls][1];
    return '<figure class="gbemu-cell">' +
      gbEmuShot('mb_' + n + '.png', n) +
      '<figcaption><code>' + n + '</code>' +
      '<span class="gbemu-diff">0 px</span>' +
      '<span class="gbemu-hw gbemu-hw-' + cls + '" title="' + tip + '">' + label + '</span>' +
      '<span class="gbemu-what">' + what + '</span></figcaption></figure>';
  }).join('');

  const carts = GB_EMU_CARTS.map(function (row) {
    return '<figure class="gbemu-cell gbemu-cart">' +
      gbEmuShot('gbcart_' + row[0] + '.png', row[1]) +
      '<figcaption><b>' + row[1] + '</b><span class="gbemu-what">' + row[3] + ' &middot; ' + row[2] + '</span></figcaption></figure>';
  }).join('');

  return '<div class="gbemu-area" id="gbemu-area-acceptance">' +

  '<section class="sect gbemu-area-head" id="gbemu-area-acceptance-head"><h3 class="sect-h">Area 8 of eight: Tests and scores</h3>' +
    '<p class="gbemu-key">How to test and what the score means: the traps, what to test with and in which order, how to measure a change (sections 18 to 20), the score and the rows nobody can win (21, 22), the evidence (23), the labels and the flexibility register (appendix F) and the verification scorecard (appendix G).</p>' +
    '<p class="hw-readable">This area is the file <code>gb-acceptance-emulation-tab.js</code>, one of the eight area files that together make the Game Boy Emulation tab. It can be read on its own; the build checklist is in the first area, and the rule for what a build must implement is beside it.</p>' +
    '<p class="hw-readable"><b>Where the rest of this page is.</b> When a sentence here points to a section or appendix that is not in this area, it is in one of these files (the links work on the assembled page):</p><ul class="gbemu-bullets"><li><b>Overview, build checklist and interface</b> (<code>gb-machine-emulation-tab.js</code>): <a href="#gbe-m1">1. Clocks, map, and one phase that matters</a> <a href="#gbe-m3">3. Where the machine starts</a> <a href="#gbe-gaps">24. What this page does not cover</a></li><li><b>Processor</b> (<code>gb-cpu-emulation-tab.js</code>): <a href="#gbe-m2">2. The processor</a> <a href="#gbe-ops">Appendix D. The instruction set</a></li><li><b>Memory, timer, interrupts, transfers, serial, pad</b> (<code>gb-memory-emulation-tab.js</code>): <a href="#gbe-m4">4. Timer, DMA, interrupt line</a> <a href="#gbe-hw">5. What a real Game Boy settled</a> <a href="#gbe-regs">Appendix A. Every register, every bit</a></li><li><b>Picture</b> (<code>gb-ppu-emulation-tab.js</code>): <a href="#gbe-m5">6. The sprite scan</a> <a href="#gbe-1">7. The decision that decides everything</a> <a href="#gbe-2">8. Step the machine by dots</a> <a href="#gbe-3">9. The fetcher</a> <a href="#gbe-4">10. The two FIFOs</a> <a href="#gbe-5">11. The window is a separate machine</a> <a href="#gbe-6">12. Sprites stall the pipeline</a> <a href="#gbe-7">13. Writes that land mid-line</a> <a href="#gbe-8">14. Interrupts, blocking, power</a> <a href="#gbe-addr">Appendix C. Tile, map and object addressing</a> <a href="#gbe-pipe">Appendix E. The picture pipeline, in numbers</a></li><li><b>Sound</b> (<code>gb-apu-emulation-tab.js</code>): <a href="#gbe-s1">15. The sound unit is not on the processor&rsquo;s clock</a> <a href="#gbe-s2">16. The square channels</a> <a href="#gbe-s3">17. Wave, noise, and power</a> <a href="#gbe-sound-regs">Appendix B. The sound registers, and the primitives the refinements modify</a></li><li><b>Cartridges and mappers</b> (<code>gb-mappers-emulation-tab.js</code>): <a href="#gbe-mappers">Appendix H. The cartridge mappers, register by register</a></li><li><b>Super Game Boy and link devices</b> (<code>gb-sgb-emulation-tab.js</code>): <a href="#gbe-sgb">Appendix A, continued: the Super Game Boy and the link-port devices</a></li></ul>' +
  '</section>' +
  '<div class="gbemu-toc"><b>In this area</b><a href="#gbe-9">18. Traps: wrong models that still play games</a><a href="#gbe-10">19. What to test with, in order</a><a href="#gbe-11">20. How to measure a change</a><a href="#gbe-score">21. The score, and what a score is worth</a><a href="#gbe-unwinnable">22. Rows nobody can win honestly</a><a href="#gbe-12">23. The evidence</a><a href="#gbe-labels">Appendix F. Labels, flexibility, and what is not established</a><a href="#gbe-verify">Appendix G. The verification scorecard</a></div>' +

  '<section class="sect" id="gbe-9"><h3 class="sect-h">18. Traps: wrong models that still play games</h3>' +
    '<p class="hw-readable">Each rule in this section forbids a model that plays games correctly and is still wrong. ' +
    'Most of them restate, as a prohibition, a rule whose home is an earlier section, and each names that section. ' +
    'Rules 18/7, 18/15 and 18/16 are for whoever tests a build rather than for the build itself.</p>' +

    '<div class="gbemu-rule" id="gbr-18-1"><b>Rule 18/1. Mode 3 is stepped, not tabulated.</b> A build must step mode 3 ' +
      'dot by dot (section 8). It must not take the length of mode 3 from a table.</div>' +
    '<div class="gbemu-why"><b>Why.</b> A table of mode-3 lengths gives correct average timing and is permanently ' +
      'unable to model anything happening during the line. Everything else on this page depends on not doing it.</div>' +

    '<div class="gbemu-rule" id="gbr-18-2"><b>Rule 18/2. The window row does not come from LY.</b> A build must not ' +
      'derive the window&rsquo;s tile row from LY; section 11 gives the counter it comes from.</div>' +
    '<div class="gbemu-why"><b>Why.</b> Deriving the window row from LY passes every game. It fails the moment the ' +
      'window is switched off and on again mid-frame.</div>' +

    '<div class="gbemu-rule" id="gbr-18-3"><b>Rule 18/3. The window takeover comparator is signed.</b> The window ' +
      'takeover comparator is primed before the visible line, so its positions below zero are real: a build must ' +
      'use signed arithmetic for it and must not clamp it at zero (section 11).</div>' +
    '<div class="gbemu-why"><b>Why.</b> Measured on our core: a comparator clamped at zero fires on exactly the ' +
      'right rows (90 fires on lines 0 to 7 and nowhere else), and it reads <b>7 px fixed against 30,630 created, ' +
      'five passing cells destroyed</b>, two of them into five figures. It does not misplace the window; it draws a ' +
      'window on rows that have none. <b>Acting in exactly the right place is not evidence that the action is ' +
      'right.</b></div>' +

    '<div class="gbemu-rule" id="gbr-18-4"><b>Rule 18/4. An object&rsquo;s cost is a stall, not added dots.</b> A ' +
      'build must pay each object&rsquo;s cost as a stall of the pipeline inside mode 3 (section 12; appendix E.3 ' +
      'gives the wait and the stall), during which the background fetcher does not step and nothing is popped. It ' +
      'must not add the cost to the line as a count of extra dots.</div>' +
    '<div class="gbemu-why"><b>Why.</b> With object penalties added as dots, the line comes out the right length ' +
      'and every register write inside the object fetch lands on the wrong pixel.</div>' +

    '<div class="gbemu-rule" id="gbr-18-5"><b>Rule 18/5. Object height is read at the fetch.</b> Each of the two ' +
      'tile-data reads of an object fetch must use the object height (LCDC bit 2) as it stands when that read is ' +
      'made. The object fetch must not use a height latched at the sprite scan (section 6).</div>' +
    '<div class="gbemu-example"><b>Example.</b> LCDC bit 2 changes from 1 (8x16 objects) to 0 (8x8 objects) ' +
      'between an object fetch&rsquo;s low-plane read and its high-plane read. The low plane is read with height 16 ' +
      'and the high plane with height 8, so the two planes can come from different tile rows. A build that latched ' +
      'the height at the scan would read both planes with height 16.</div>' +
    '<div class="gbemu-why"><b>Why.</b> A mid-fetch change makes the two planes come from different tile rows, and ' +
      'the reference requires that.</div>' +

    '<div class="gbemu-rule" id="gbr-18-6"><b>Rule 18/6. Registers are sampled per fetcher step.</b> Each fetcher ' +
      'step must sample the registers it needs on the dot it needs them (section 9; appendix E gives the dots). A ' +
      'build must not snapshot the registers once per line, and must not read them live at every use either.</div>' +
    '<div class="gbemu-why"><b>Why.</b> Neither a per-line snapshot nor a live read everywhere is right: each ' +
      'fetcher step samples what it needs when it needs it.</div>' +

    '<div class="gbemu-rule" id="gbr-18-7"><b>Rule 18/7. A probe reports the value used.</b> An instrument that ' +
      'reports a value from the picture pipeline must report the value the pipeline used (for a fetch, the address ' +
      'the fetch formed), never the value it <em>would</em> form.</div>' +
    '<div class="gbemu-why"><b>Why.</b> A probe that reports the address a fetch would form, rather than the one ' +
      'it formed, can support several confident conclusions that are all void.</div>' +

    '<div class="gbemu-rule" id="gbr-18-8"><b>Rule 18/8. The sprite-memory corruption is not gated on the reported ' +
      'mode.</b> A build must not gate the sprite-memory corruption on the reported mode being 2: the line&rsquo;s ' +
      'first machine cycle corrupts a row while the mode bits STAT returns still read 0 (section 5 gives the row ' +
      'rule).</div>' +
    '<div class="gbemu-why"><b>Why.</b> Gate on &ldquo;mode is 2&rdquo; and you lose exactly one timing of ' +
      'fifteen, and it is the one no counter bias can reach.</div>' +

    '<div class="gbemu-rule" id="gbr-18-9"><b>Rule 18/9. A transfer blocks one bus.</b> During a sprite-memory ' +
      'transfer a build must block only the bus the transfer occupies, not every bus (section 4).</div>' +
    '<div class="gbemu-why"><b>Why.</b> The transfer occupies one bus, not all of them. Block everything and nine ' +
      'instruction-timing cartridges hang: they execute from cartridge memory while sourcing the transfer from ' +
      'video memory.</div>' +

    '<div class="gbemu-rule" id="gbr-18-10"><b>Rule 18/10. Colour 0 is two different things.</b> A build must keep ' +
      'the two meanings of colour index 0 apart: in an object pixel it is transparent; in the background it is the ' +
      'lightest shade.</div>' +
    '<div class="gbemu-why"><b>Why.</b> A wrong bit can make a drawn object vanish, which reads as a second, ' +
      'non-existent fault.</div>' +

    '<div class="gbemu-rule" id="gbr-18-11"><b>Rule 18/11. The sound unit is clocked from the master clock.</b> A ' +
      'build must clock the sound unit from the master clock (section 15), never from the processor&rsquo;s machine ' +
      'cycles, and the frame sequencer and every channel must take that same clock.</div>' +
    '<div class="gbemu-why"><b>Why.</b> Clocking the sound unit from the processor is correct on this machine for ' +
      'ever, and an octave out in Colour double speed. Compensating the frame sequencer and not the channels is the ' +
      'same bug, half fixed.</div>' +

    '<div class="gbemu-rule" id="gbr-18-12"><b>Rule 18/12. One clock is read at one instant.</b> Every reading of ' +
      'the dot counter that places an event must be taken at the same point of the machine cycle: always before the ' +
      'cycle&rsquo;s tick, or always after it, never some readings before and some after (section 5 reconciles two ' +
      'sample points on one clock).</div>' +
    '<div class="gbemu-example"><b>Example.</b> Hooks placed before and after a machine cycle&rsquo;s tick read the ' +
      'dot counter four dots apart. One event read by the hook before the tick at dot 100 falls in machine cycle ' +
      '100 / 4 = 25; read by the hook after the tick it is at dot 104 and falls in machine cycle 26. Divide by four ' +
      'and every event seen by one of the two hooks is one row out, always, invisibly.</div>' +
    '<div class="gbemu-why"><b>Why.</b> Hooks placed before and after a machine cycle&rsquo;s tick read the dot ' +
      'counter four dots apart. Divide by four and half your events are one row out, always, invisibly.</div>' +

    '<div class="gbemu-rule" id="gbr-18-13"><b>Rule 18/13. A level comparator raises once.</b> The LY=LYC ' +
      'comparison is a level. Where it is true on the last dot of one line and is still true on the next line ' +
      '(this happens only with LYC = 0, from line 153 into line 0, because LY reads 0 early in line 153; section ' +
      '14), the comparator&rsquo;s start-of-line blind spot must not drop the comparison, so it must not produce a ' +
      'falling edge and a second request.</div>' +
    '<div class="gbemu-example"><b>Example.</b> With LYC = 0, the comparison becomes true in line 153 and stays true ' +
      'through line 0: one request is raised, in line 153, and none at the start of line 0. With LYC = 153 ' +
      'nothing carries: the compared value changes within line 153 (153, then 0), so the comparison does not stay ' +
      'true into line 0 and this rule does not apply; section 14 gives line 153.</div>' +
    '<div class="gbemu-why"><b>Why.</b> The line-compare flag is true continuously across the frame wrap for one ' +
      'compare value (LYC = 0). A start-of-line blind spot must not manufacture a falling edge on a live match.</div>' +

    '<div class="gbemu-rule" id="gbr-18-14"><b>Rule 18/14. The window does not inherit the fine scroll.</b> At a ' +
      'window takeover a build must drop the pending <code>SCX &amp; 7</code> discard: it belongs to the abandoned ' +
      'background fetch (section 11).</div>' +
    '<div class="gbemu-why"><b>Why.</b> Keep the discard and the window judders with the playfield, which no test ' +
      'on any board scores.</div>' +

    '<div class="gbemu-rule" id="gbr-18-15"><b>Rule 18/15. A table that is a modulus has no offset.</b> When two ' +
      'delays agree with each other and disagree with a third, a tester must treat the table as a grid (a modulus) ' +
      'and must not sweep for an additive constant.</div>' +
    '<div class="gbemu-example"><b>Example.</b> Section 16: delays of 1 and 3 agree and both disagree with 0. A grid ' +
      'of 2 gives that (1 and 3 are odd, 0 is even); no offset added to the delay can produce it.</div>' +
    '<div class="gbemu-why"><b>Why.</b> Two delays agreeing with each other and disagreeing with a third is a grid, ' +
      'not a constant. No additive number can ever fit it, and sweeping for one gives declines and no reason.</div>' +

    '<div class="gbemu-rule" id="gbr-18-16"><b>Rule 18/16. A &ldquo;do not re-derive this&rdquo; note carries its ' +
      'axes.</b> A note that forbids re-deriving a result must list the axes the first derivation swept. It forbids ' +
      'nothing outside those axes.</div>' +
    '<div class="gbemu-why"><b>Why.</b> Such a note can never be stronger than the axes the first derivation swept, ' +
      'and without the list it can forbid exactly the work that closes a row.</div>' +
  '</section>' +

  /* ---------------------------------------------------------------- 10 */
  '<section class="sect" id="gbe-10"><h3 class="sect-h">19. What to test with, in order</h3>' +
    '<div class="gbemu-rule" id="gbr-19-1"><b>Rule 19/1. Run the suites in order.</b> Run the suites in the order ' +
      'of the table below, step 1 first. This orders <em>suites</em>; appendix G&rsquo;s ladder (Rule G.4/1) orders the <em>rows</em> a build should make pass, and a stage there may take rows from a suite that comes later here (Mooneye&rsquo;s cartridge and timer rows sit in stages 2 and 3, before dmg-acid2 in stage 4). Build in G.4&rsquo;s order; use this table to choose which suite to run next.</div>' +
    '<div class="gbemu-why"><b>Why.</b> Each one is nearly useless until the one before it passes, and each sees ' +
      'something the others cannot.</div>' +
    '<table class="gbemu-table"><thead><tr><th>Suite</th><th>Step (run order, from 1)</th><th>What it proves</th><th>What it cannot see</th></tr></thead><tbody>' +
      '<tr><td><b>Blargg</b></td><td>1</td><td>The processor itself: instructions, timing, interrupts, memory access windows.</td><td>Anything about the picture. A core can pass all of it and render nothing.</td></tr>' +
      '<tr><td><b>dmg-acid2</b></td><td>2</td><td>The renderer end to end, in one frame. Sprite priority, the window, palettes, the background/sprite merge.</td><td>Timing. It draws one static scene; nothing is rewritten mid-line.</td></tr>' +
      '<tr><td><b>Mooneye</b></td><td>3</td><td>Timing at instruction granularity, when interrupts fire, when modes change, what the processor sees.</td><td>What appears on screen.</td></tr>' +
      '<tr><td><b>mealybug tearoom</b></td><td>4</td><td>The pipeline itself, one dot at a time. Every cartridge rewrites a display register mid-line and checks the picture.</td><td>Sound, saving, link cable, cartridge hardware.</td></tr>' +
      '<tr><td><b>SameSuite</b></td><td>5</td><td>The sound unit, at machine-cycle granularity, against tables the cartridges declare in their own source. 68 rows, and almost every fact in sections 15&ndash;17 came from one.</td><td>The picture. And several of its rows declare themselves revision-dependent: read section 22 before spending on those.</td></tr>' +
      '<tr><td><b>daid, ashiepaws, ax6, cpp</b></td><td>6</td><td>The awkward corners: bus conflicts during a transfer, the cartridge clock latch, mid-line palette schedules. Small suites, and each one settles something nothing else can.</td><td>Almost everything else. They are arbiters, not coverage.</td></tr>' +
    '</tbody></table>' +
    '<div class="gbemu-why"><b>A sanity check on your own progress.</b> <b>A core that plays a shelf ' +
    'of commercial games convincingly can still fail every mealybug cartridge.</b> Resist the ' +
    'tempting explanation that commercial games deliberately avoid the timing those cartridges ' +
    'are built to provoke: <b>we have no evidence whatever about what commercial developers ' +
    'intended</b>. The measurable ' +
    'form is the useful one, and it is enough.</div>' +

    '<div class="gbemu-rule" id="gbr-19-2"><b>Rule 19/2. Prefer a declared table to a picture.</b> Whenever you have ' +
      'the choice, prefer a cartridge that declares a table to one that draws a picture.</div>' +
    '<div class="gbemu-why"><b>Why.</b> A declared table is a list of values the author ' +
    'asserts hardware produces; it can be scored byte for byte, it says <em>where</em> you are ' +
    'wrong, and it cannot be satisfied by a render that happens to look right. A reference image ' +
    'can be matched by a core that is wrong for reasons the image cannot resolve: section 23 ' +
    'has a measured case of exactly that on this very page.</div>' +

    '<div class="gbemu-rule" id="gbr-19-3"><b>Rule 19/3. Write one instrument with no absolute constant.</b> Write ' +
      'at least one instrument of your own that carries no absolute constant. Its best shape is an invariance: ' +
      'perturb something the hardware demonstrably does <em>not</em> consult, and require the output to be ' +
      'unchanged.</div>' +
    '<div class="gbemu-why"><b>Why.</b> Such an instrument can never go stale. It cannot be satisfied by fitting ' +
    'your core to somebody else&rsquo;s render, and it does not rot when a reference is republished.</div>' +

    '<h4 class="gbemu-sub">How each suite tells you the verdict, and when to take the picture</h4>' +
    '<div class="gbemu-rule" id="gbr-19-4"><b>Rule 19/4. Where and when each verdict is read.</b> A harness must ' +
      'read each suite&rsquo;s verdict from the place the Verdict column of the table below gives, at the moment ' +
      'its When column gives. For mealybug tearoom and dmg-acid2 the picture is taken and scored by Rule 19/5, from ' +
      'the frame buffer of Rule 19/6.</div>' +
    '<div class="gbemu-why"><b>Why.</b> An implementer needs this before the first score, and the suites do not all ' +
    'say it in their own folders. This is how our own harnesses read them; every line is what our instruments do, ' +
    'not a claim about what the authors intended. The suites&rsquo; readmes do not all say this, and one suite ' +
    'ships no readme at all.</div>' +
    '<table class="gbemu-table"><thead><tr><th>Suite</th><th>Verdict (where the harness reads it)</th><th>When (the moment the harness reads it)</th></tr></thead><tbody>' +
      '<tr><td>blargg <code>cpu_instrs</code> (the 11 single cartridges), <code>instr_timing</code>, ' +
      '<code>mem_timing</code> (its 3 single cartridges)</td><td>Text sent out of the serial port (each ' +
      'byte written to <code>0xFF01</code> and started with <code>0x81</code> to <code>0xFF02</code>): ' +
      'the word <code>Passed</code> or <code>Failed</code>. Nothing at <code>0xA000</code>: measured on ' +
      'our core, no signature from any of the 15, and 18 to 31 serial bytes from each.</td><td>When the ' +
      'word appears.</td></tr> <tr><td>blargg <code>mem_timing-2</code> (3 single cartridges), ' +
      '<code>oam_bug</code> (8), <code>dmg_sound</code> (12)</td><td>Cartridge RAM at <code>0xA000</code>' +
      ' only, in the format of the <code>7-timing_effect</code> row below; a status of <code>0x00</code> ' +
      'is a pass. <b>Not one byte on the serial port</b>: measured on our core, zero serial bytes from ' +
      'all 23 and the signature present in all 23, so a harness that waits for serial text waits for ' +
      'ever. None of the 23 reports anywhere else.</td><td>When the status leaves <code>0x80</code>. ' +
      '<code>oam_bug/7-timing_effect</code> never leaves it: it fills its result buffer and stops, and ' +
      'section 5 gives the answer to score it against</td></tr> <tr><td>blargg <code>halt_bug</code>, ' +
      '<code>interrupt_time</code></td><td>On the screen only. Neither sends a byte to the serial port ' +
      'nor writes the signature at <code>0xA000</code>: on our core, no serial byte and no signature in ' +
      '30,000,000 steps. Our board reads them as it reads every row (appendix G.1): a screenshot compared' +
      ' with the suite&rsquo;s own reference picture. Reading the word <code>Passed</code> off the ' +
      'background map scores the same but is not what the board does. <b>The screen' +
      ' text is drawn with each tile number equal to the character&rsquo;s ASCII code</b>, so the map ' +
      'reads as text with no font: measured on our core with no boot program, by the 105th frame the map ' +
      'at <code>0x9800</code> reads <code>halt bug</code> on its first row and <code>Passed</code> on its' +
      ' fourteenth, and every non-blank tile number on it is a printable character code. ' +
      '<code>interrupt_time</code> is a Colour row: the board&rsquo;s row list runs it on the Color ' +
      'only</td><td>After the run time the board&rsquo;s row list gives the row.</td></tr>' +

      '<tr><td>blargg <code>oam_bug/7-timing_effect</code>, its buffer</td><td>The format every blargg ' +
      'cartridge uses at <code>0xA000</code>: the status byte at <code>0xA000</code> (<code>0x80</code> ' +
      'while running, the result code after), the signature <code>0xDE 0xB0 0x61</code> at ' +
      '<code>0xA001</code> to <code>0xA003</code>, then the printed text from <code>0xA004</code>, ending' +
      ' in a zero byte. This cartridge loops over 116 timings and may print, per timing, the timing and a' +
      ' dump of sprite memory (its source is in the suite&rsquo;s <code>oam_bug/source</code> folder, as <code>dmg_sound</code>&rsquo;s is in <code>dmg_sound/source</code>; the include that holds the comparison routine it calls, <code>oam_bug.inc</code>, is not there). The text fills the buffer, 8,188 bytes from <code>0xA004</code> to <code>0xBFFF</code>, ' +
      'with the status still <code>0x80</code>: on the real console, and on ours (measured: ' +
      '8,188 bytes, status <code>0x80</code>; later in our run cartridge RAM stops answering). No board ' +
      'row scores it and no instrument of ours decodes our own core&rsquo;s buffer: what was checked is ' +
      'section 5&rsquo;s row rule against the console&rsquo;s saved buffers</td><td>Never a verdict; do not' +
      ' wait for one.</td></tr>' +

      '<tr><td>Mooneye</td><td>At the <code>LD B,B</code> breakpoint (opcode <code>0x40</code>): ' +
      '<code>B C D E H L</code> = 3, 5, 8, 13, 21, 34 is a pass; all six <code>0x42</code> is a fail</td>' +
      '<td>The first <code>LD B,B</code></td></tr>' +
      '<tr><td>mealybug tearoom, dmg-acid2</td><td>A picture, compared with the reference image; shades mapped and differing pixels counted by Rule 19/5, steps 4 and 5</td>' +
      '<td>The frame buffer as it stands when the cartridge first executes <code>LD B,B</code>, taken by Rule 19/5, steps 1 to 3</td></tr>' +
    '</tbody></table>' +

    '<div class="gbemu-rule" id="gbr-19-5"><b>Rule 19/5. Taking and scoring the picture for mealybug tearoom and ' +
      'dmg-acid2.</b> Take and score the picture in these steps, in this order:</div>' +
    '<ol class="gbemu-steps">' +
      '<li>Run the cartridge until it executes <code>LD B,B</code> (opcode <code>0x40</code>, a one-cycle ' +
        'instruction) for the first time.</li>' +
      '<li>Take the picture as soon as the step that executed that <code>LD B,B</code> returns, at the ' +
        'instruction boundary right after it. At that point the picture has been paid up to the start of the ' +
        'instruction&rsquo;s machine cycle: it has processed every dot up to the access of the ' +
        '<code>LD B,B</code>&rsquo;s opcode fetch, so the frame buffer is what an access made at that fetch would ' +
        'see on section 14&rsquo;s access scale. The four dots after that access, which D.10.1&rsquo;s boundary ' +
        'rule would run before the next instruction&rsquo;s interrupt test, are not run.</li>' +
      '<li>Read the frame buffer (Rule 19/6) as it stands at that point, without running on to the end of the ' +
        'frame. Nothing waits for a frame to count as completed.</li>' +
      '<li>Map each pixel&rsquo;s shade index to a byte: shade index 0 is <code>0xFF</code> (lightest), 1 ' +
        '<code>0xAA</code>, 2 <code>0x55</code>, 3 <code>0x00</code>.</li>' +
      '<li>Compare with the reference image and count every pixel that differs, exactly.</li>' +
    '</ol>' +
    '<div class="gbemu-rule" id="gbr-19-6"><b>Rule 19/6. The frame buffer the picture is read from.</b> The ' +
      'picture of Rule 19/5 is read from a frame buffer with these properties, and a build scored by that rule ' +
      'must keep the same: (a) there is <b>one</b> frame buffer, written pixel by pixel as each line is drawn, with ' +
      'no separate copy of the last completed frame; (b) the frame a switch-on starts writes nothing to the buffer, ' +
      'so its lines keep what the buffer last held (shade 0 everywhere if nothing has been drawn since reset); (c) ' +
      'switching the display off does not clear the buffer.</div>' +
    '<div class="gbemu-example"><b>Example.</b> The first <code>LD B,B</code>&rsquo;s opcode-fetch access falls on ' +
      'line 100 after 40 of that line&rsquo;s pixels have been written to the buffer. The picture then shows the ' +
      'frame in progress on lines 0 to 99 and on columns 0 to 39 of line 100, and the previous frame on columns ' +
      '40 to 159 of line 100 and on lines 101 to 143. If the first <code>LD B,B</code> comes in the frame a ' +
      'switch-on starts and nothing has been drawn since reset, every pixel reads shade 0, scored as ' +
      '<code>0xFF</code>.</div>' +
    '<div class="gbemu-why"><b>Why.</b> Read from our harness (its run-to-breakpoint mode) and our source ' +
      '(<code>gb_frame_ptr</code>, <code>frame_discard</code>). So the lines already drawn show the frame in ' +
      'progress and the lines below still show the previous frame.</div>' +
  '</section>' +

  /* ---------------------------------------------------------------- 11 */
  '<section class="sect" id="gbe-11"><h3 class="sect-h">20. How to measure a change</h3>' +
    '<p class="hw-readable">This section is the method: how a fact about the machine is separated from a figure ' +
    'that merely scores well. Everything before it is facts about one machine.</p>' +

    '<h4 class="gbemu-sub">Say how you know: derived, observed, or fitted</h4>' +
    '<div class="gbemu-rule" id="gbr-20-1"><b>Rule 20/1. Every number carries its label.</b> Every number you ' +
      'publish must carry the label from the table below that says how it is known. A FITTED number must be stated ' +
      'outright and labelled FITTED, never presented as DERIVED.</div>' +
    '<div class="gbemu-why"><b>Why.</b> Three kinds of number, and <b>a page that presents the third (fitted) as ' +
    'the first (derived) is worse than no page</b>.</div>' +
    '<table class="gbemu-table"><thead><tr><th>Label</th><th>What it means</th><th>What it is worth</th></tr></thead><tbody>' +
      '<tr><td><b>DERIVED</b></td><td>Read off a rule, or off a cartridge&rsquo;s own declaration: a sentence in its source, a table it asserts. The unit derived too, not assumed.</td><td>It predicts things you have not measured yet. Every one of the sound facts above made a prediction elsewhere before it was scored.</td></tr>' +
      '<tr><td><b>OBSERVED</b></td><td>Matched against what hardware actually put out, with the apparatus and the sample count named.</td><td>Exactly as much as the stimulus reached. One fill pattern, one console, one alignment: say which.</td></tr>' +
      '<tr><td><b>CONVERGENCE</b></td><td>Agrees with an independent implementation&rsquo;s output, where nothing derives it. Legitimate; not the same thing.</td><td>Only if the agreement is independent. If the other implementation&rsquo;s source cites the same test as its evidence, the agreement is circular and worth nothing.</td></tr>' +
      '<tr><td><b>FITTED</b></td><td>Adjusted until a test passed.</td><td>Nothing outside the test it was fitted to. It is not forbidden, but it must be labelled, bounded, and it must not be allowed to look like the first row of this table. <b>State the number outright</b>, so nobody hunts for a derivation that does not exist.</td></tr>' +
      '<tr><td><b>INSTRUMENT-MEASURED</b></td><td>Scored on <em>our own</em> core or corpus, with a named instrument and a printed denominator. <b>A fact about this emulator, not about hardware.</b></td><td>As much as the corpus reaches, and no more. <b>Seventeen</b> claims in sections 7 to 14 and 18 to 20 carry this label; without a word for it they read as OBSERVED when they are measurements of ourselves.</td></tr>' +
      '<tr><td><b>NOT ESTABLISHED</b></td><td>The record does not settle it. <b>Say what would.</b></td><td>Nothing, and that is the point. A vocabulary with no word for a gap forces every gap into one of the rows above. <b>Eight</b> claims in those same sections carry this word; appendix F is the sweep that found them.</td></tr>' +
    '</tbody></table>' +

    '<div class="gbemu-rule" id="gbr-20-2"><b>Rule 20/2. A figure written twice has a check.</b> A figure quoted in ' +
      'two places is one figure written twice: it must have a check that re-derives it and requires every copy to ' +
      'agree.</div>' +
    '<div class="gbemu-why"><b>Why.</b> <b>Both figures in the table above carry a check</b> (appendix G.7): ' +
    'the gate re-derives them from F.4&ndash;F.7&rsquo;s Label columns and ' +
    'requires this table, F.2 and F.7 to agree. <b>The transferable part:</b> a number quoted in ' +
    'two sections is one figure written twice, and the second copy is always the one that goes ' +
    'stale, because a re-measurement gets stamped where it was taken. It matters most here, ' +
    'because this table is the vocabulary the rest of the page is written in.</div>' +

    '<div class="gbemu-rule" id="gbr-20-3"><b>Rule 20/3. Mooneye is an observation on someone else&rsquo;s silicon; ' +
      'mealybug is CONVERGENCE.</b> Passing a Mooneye cartridge must be recorded as an observation on its ' +
      'author&rsquo;s hardware, and the denominator clause must say so. Matching a mealybug expectation must be ' +
      'labelled <b>CONVERGENCE, never OBSERVED</b>; this applies to every mealybug-derived constant on this ' +
      'page.</div>' +
    '<div class="gbemu-why"><b>One distinction that belongs in this table and lives here rather than ' +
    'in a footnote.</b> Mooneye cartridges declare their own expected results, authored against ' +
    '<em>their</em> author&rsquo;s hardware, so passing one is an observation <b>on someone ' +
    'else&rsquo;s silicon</b>. <b>mealybug expectations are ' +
    'the suite author&rsquo;s own emulator renders</b>. Section 23 says this about the pixel figures.</div>' +

    '<div class="gbemu-rule" id="gbr-20-4"><b>Rule 20/4. The test between DERIVED and FITTED is procedural.</b> A ' +
      'number may be labelled DERIVED only if its <em>site</em> was found before its <em>value</em>. A number ' +
      'arrived at by sweeping a constant to minimise a residual must be labelled FITTED, however good the residual ' +
      'gets.</div>' +
    '<div class="gbemu-example"><b>Example.</b> Candidate sites are enumerated and each is measured, and the ' +
      'winning interval turns out to be exactly one machine cycle wide: that is a quantum, not a tuned figure. A ' +
      'constant chosen because it gives the smallest residual is not, however small that residual is.</div>' +
    '<div class="gbemu-why"><b>Why.</b> The practical test between the first and the last is <b>procedural, not ' +
    'rhetorical</b>: was any constant swept, and was the <em>site</em> found before the <em>value</em>?</div>' +

    '<h4 class="gbemu-sub">Register what must move and what must not, with falsifiers, before you build</h4>' +
    '<div class="gbemu-rule" id="gbr-20-5"><b>Rule 20/5. Register the experiment before the code exists.</b> ' +
      'Before you build a change, write the experiment down as a table (not a plan), with these three parts, ' +
      'checked in this order:</div>' +
    '<ol class="gbemu-steps">' +
      '<li><b>Does the axis move anything at all?</b> Two settings must differ on some named observable. If they ' +
        'do not, it is not an axis and nothing measured through it means anything. This check comes first because ' +
        'it is the one that catches a knob that is not wired up, and a knob that is not wired up scores a perfect, ' +
        'reassuring null.</li>' +
      '<li><b>MUST MOVE</b>: each cell you expect to change, with the value you expect and <em>the observation ' +
        'that would refute you</em>. Naming the falsifier is what stops a partial result being read as a win.</li>' +
      '<li><b>MUST NOT MOVE</b>: the ground you have already banked, enumerated by name, with the one you think is ' +
        'most at risk <b>named in advance as the risk</b>. If any of it moves, you revert and write the price ' +
        'down. You do not tune around it.</li>' +
    '</ol>' +
    '<div class="gbemu-rule" id="gbr-20-6"><b>Rule 20/6. Check the experiment can separate the hypotheses.</b> ' +
      'Before you run a registered experiment, build its separation table: for every pair of rival rules, the ' +
      'cells on which they give different output. If any pair gives identical output on every cell the experiment ' +
      'measures, change what it sweeps until every rival is separated from every other.</div>' +
    '<div class="gbemu-example"><b>Example.</b> A bench cartridge sweeping one variable: four of its six rival ' +
      'rules produce <em>identical</em> output on every cell it would measure, so it would come back a confident ' +
      'confirmation of nothing. Sweeping a different variable separates every rival from every other, at worst by ' +
      '20 cells of 256.</div>' +
    '<div class="gbemu-why"><b>Why.</b> <b>A registration can be refuted before it is run.</b></div>' +

    '<h4 class="gbemu-sub">&ldquo;Nothing fixed, nothing broken&rdquo; is not a verdict on the change</h4>' +
    '<div class="gbemu-rule" id="gbr-20-7"><b>Rule 20/7. A null is a measurement of a pair.</b> A result of ' +
      '&ldquo;0 fixed / 0 broken&rdquo; is a verdict on <b>the change against the rest of your emulator at that ' +
      'tree</b>, not on the change alone. The record of a null must name the tree it was measured in.</div>' +
    '<div class="gbemu-example"><b>Example (the instrument cannot see the rows).</b> The sound suite reports almost ' +
      'everything it reports through two registers that expose the channels&rsquo; digital output to the ' +
      'processor. A working copy that does not map those registers <b>reads a constant value at both addresses and ' +
      'passes 2 of 68 sound rows no matter what</b>. A change known independently to be worth <b>+8 rows</b>, priced ' +
      'in such a copy, comes back <b>0 fixed / 0 broken, 68 of 68 rows byte-identical</b>: a flawless null. It is ' +
      'not the change that is measured; it is the tree.</div>' +
    '<div class="gbemu-example"><b>Example (a sibling change is missing).</b> A correct change each of whose rows ' +
      'carries a <em>second</em> residual, which a different change has to clear first, is worth nothing ' +
      '<em>in that copy</em>. A correct change whose rows are all blocked behind another correct change scores ' +
      'exactly zero, and looks identical to a change that does nothing. The two examples fail in opposite ' +
      'directions.</div>' +
    '<div class="gbemu-rule" id="gbr-20-8"><b>Rule 20/8. When a decline may be re-priced.</b> A change declined on a ' +
      'null may be re-priced only if the null was taken in a copy that could not observe the rows the change would ' +
      'move. A change with a <em>measured cost</em> stays declined, and a null measured in a tree that could ' +
      'observe those rows is a real null.</div>' +
    '<div class="gbemu-why"><b>Why.</b> <b>A null is a measurement of a pair (the arm and the tree), and the record ' +
    'has to say which tree.</b> The narrow, mechanical test for re-pricing a decline is <em>was it priced in a copy ' +
    'that could observe the rows it would move?</em> That test does not license retrying everything.</div>' +

    '<h4 class="gbemu-sub">And the same rule with the sign reversed: the half that gets forgotten</h4>' +
    '<div class="gbemu-rule" id="gbr-20-9"><b>Rule 20/9. A knock-out price is pinned to a commit.</b> A knock-out ' +
      'price is a fact about the whole emulator at the commit it was taken on. Whoever quotes it must quote that ' +
      'commit with it.</div>' +
    '<div class="gbemu-why"><b>Why.</b> Everyone eventually learns that a price can be <em>too low</em> because ' +
    'the tree is not ready. <b>Almost nobody watches the other direction: a price that was taken ' +
    'honestly can <em>rise</em> underneath you, because later arms land on top of it and start ' +
    'depending on it.</b> <b>A knock-out price is a fact about the whole emulator on the day it was ' +
    'taken, and it moves. If you quote the number, pin it to a commit.</b> That single sentence is ' +
    'the whole of combination pricing, and it runs in both directions: an arm can be worth nothing ' +
    'today and a great deal later, and it can be worth a little when you land it and a great deal ' +
    'by the time anyone checks. Neither figure is a mistake; a figure quoted without its commit ' +
    'is. <b>A figure without the core it was taken on tells you nothing about what to measure ' +
    'against</b>, and naming the core is the whole difference between a caveat and an instruction. When ' +
    'a later change comes to depend on the same constant, the two are no longer separable and both ' +
    'prices are correct for their commits.</div>' +

    '<div class="gbemu-rule" id="gbr-20-10"><b>Rule 20/10. Price by knock-out, not by addition.</b> Once a change is ' +
      'in, price it by knock-out: build the shipped core, build it again with the one thing disabled, score both ' +
      'on the same board, and difference the two row by row, counting fixed and broken separately (Rule ' +
      '20/15).</div>' +
    '<div class="gbemu-example"><b>Example (arithmetic only, not a measurement of this core).</b> At one commit the ' +
      'shipped build passes 90 rows of a board and the build with one constant knocked out passes 80. Row by row, ' +
      '11 rows pass only in the shipped build and 1 row passes only in the knocked-out build. The price at that ' +
      'commit is <b>+11 fixed / &minus;1 broken</b>, quoted with the commit; it is not &ldquo;+10&rdquo;. At a later ' +
      'commit the same two builds give a different pair, and that pair is the price at that later commit.</div>' +
    '<div class="gbemu-why"><b>Why.</b> It asks the question you actually care about: <em>what does the core lose ' +
    'without this?</em> And it keeps working after the arm stops being separable from its neighbours, which is ' +
    'exactly when an addition-shaped price stops meaning anything.</div>' +

    '<div class="gbemu-rule" id="gbr-20-11"><b>Rule 20/11. The two builds of a price are one measurement.</b> To ' +
      'get the price at a later commit, take both builds again at that commit. Never re-stamp one row of a price ' +
      '(the shipped row) to a later board without re-taking the knocked-out row beside it.</div>' +
    '<div class="gbemu-why"><b>Why.</b> The two rows of a knock-out price are <em>one measurement of a pair</em>, ' +
    'and re-stamping one half would turn a measured price into two numbers from two different cores. The pair ' +
    'stays at the commit it was taken on, so its shipped row need not equal the board of record in section 21. ' +
    '<b>Take the price again if you want today&rsquo;s price</b>; do not repair it by editing half of it.</div>' +

    '<div class="gbemu-rule" id="gbr-20-12"><b>Rule 20/12. Say whether a number is a snapshot or a historical ' +
      'fact.</b> Label each number you record as one of two kinds: a <b>snapshot</b> (a property of the whole core ' +
      'at one commit, such as a knock-out price), which carries its commit and must be re-measured before it is ' +
      'quoted for another commit; or a <b>historical fact</b> (such as &ldquo;this change was worth zero in that ' +
      'copy at that commit&rdquo;), which does not date, must be reported accurately, and must not be ' +
      're-measured.</div>' +
    '<div class="gbemu-why"><b>Why.</b> A historical fact re-measured is wasted work and a snapshot left unpinned is ' +
    'a trap. A price can be board-neutral at the commit a change lands and positive at a later commit: both ' +
    'figures are correct, one as a historical fact and one as a snapshot.</div>' +

    '<div class="gbemu-rule" id="gbr-20-13"><b>Rule 20/13. A figure on the board&rsquo;s convention is not a board ' +
      'figure.</b> A figure counts as a figure from your board only if it was scored on your board&rsquo;s own ' +
      'tree. A figure taken in another working copy, against a different master, is not one, even when it is ' +
      'written on the same row convention.</div>' +
    '<div class="gbemu-example"><b>Example.</b> A re-pricing note made in a sibling working copy against a different ' +
      'master reads <code>0 fixed / 0 broken</code> on the board&rsquo;s own row convention, so it looks exactly like ' +
      'a verdict from the board and is not one. A knock-out on the main tree settles it.</div>' +

    '<div class="gbemu-rule" id="gbr-20-14"><b>Rule 20/14. Run the controls before the boards.</b> Before a ' +
      'knock-out price is scored, prove that the two builds differ, in these steps:</div>' +
    '<ol class="gbemu-steps">' +
      '<li>Compare the preprocessed source line for line: the default build and a build with the switch explicitly ' +
        '&ldquo;on&rdquo; must be byte-identical, and the knocked-out build must differ from them at the sites the ' +
        'switch controls.</li>' +
      '<li>Compare the two binaries by hash: they must differ.</li>' +
      '<li>Only then score the boards. The site is then proved compiled in and reachable before scoring, not ' +
        'after.</li>' +
    '</ol>' +
    '<div class="gbemu-why"><b>Why.</b> A knock-out price is worthless if the switch never reached the compiler. The ' +
    'list of instrument faults below is the reason: a probe injected at a site the build does not contain returns ' +
    'a clean, plausible, quotable zero.</div>' +

    '<h4 class="gbemu-sub">And the general rules</h4>' +
    '<div class="gbemu-rule" id="gbr-20-15"><b>Rule 20/15. Score fixed and broken separately, never the ' +
      'difference.</b></div>' +
    '<div class="gbemu-example"><b>Example.</b> A change that repairs sixty pixels and breaks four looks identical, ' +
      'as a difference, to one that repairs fifty-six. Only one of them is hiding a regression.</div>' +
    '<div class="gbemu-rule" id="gbr-20-16"><b>Rule 20/16. Check where, not just how many.</b> Compare which pixels ' +
      '(or rows) changed, not only the count.</div>' +
    '<div class="gbemu-why"><b>Why.</b> Measured: a test can score the same figure before and after a change while ' +
      'every pixel in it has moved.</div>' +
    '<div class="gbemu-rule" id="gbr-20-17"><b>Rule 20/17. Prove your test can fail.</b> Before a test&rsquo;s ' +
      'result counts, show it detecting a known fault.</div>' +
    '<div class="gbemu-why"><b>Why.</b> A test that reports no problems and a broken test that cannot report ' +
      'anything look the same.</div>' +
    '<div class="gbemu-rule" id="gbr-20-18"><b>Rule 20/18. Print the denominator.</b> Print every count with its ' +
      'denominator, and check that a candidate rule <em>varies</em> across the population before checking whether ' +
      'it <em>fits</em>.</div>' +
    '<div class="gbemu-why"><b>Why.</b> A rule that separates a fault perfectly is worthless if it also separates ' +
      'everything else.</div>' +
    '<div class="gbemu-rule" id="gbr-20-19"><b>Rule 20/19. A null is quoted with its positive control.</b> Print a ' +
      'null as the count <em>and</em> the number of opportunities, and show the counter reading non-zero somewhere ' +
      'first. A null on this page is quotable only where the positive control is quoted beside it.</div>' +
    '<div class="gbemu-why"><b>Why.</b> <b>Almost every instrument failure produces a null, and a null looks like a ' +
      'finding that closes work.</b> That is the whole reason for Rule 20/17. &ldquo;Zero events&rdquo; from a ' +
      'probe that never armed and &ldquo;zero events&rdquo; from a machine that does not do the thing are the same ' +
      'line of output.</div>' +
    '<div class="gbemu-rule" id="gbr-20-20"><b>Rule 20/20. Exercise an instrument in both directions before ' +
      'trusting it.</b> Before an instrument supports a claim, show it can fail <em>in the direction you are about ' +
      'to claim</em>: force the wrong rule and confirm the output moves; then believe the right one.</div>' +
    '<div class="gbemu-why"><b>Why.</b> Not just &ldquo;can it fail&rdquo;. A null that has been shown to arm is a ' +
      'fact about the machine; one that has not is an absence of measurement wearing a fact&rsquo;s clothes.</div>' +
    '<div class="gbemu-rule" id="gbr-20-21"><b>Rule 20/21. Distrust a rule that names a coordinate.</b> Do not ship a ' +
      'rule keyed to a scanline or a column. Ship one condition, at one place, derived from a measurement, or do ' +
      'not ship it.</div>' +
    '<div class="gbemu-why"><b>Why.</b> Anything keyed to a scanline or a column can be made to score well on one ' +
      'cartridge and teaches nothing.</div>' +
    '<div class="gbemu-rule" id="gbr-20-22"><b>Rule 20/22. Re-measure before you quote.</b> Before quoting stored ' +
      'test output, re-measure it on the current source.</div>' +
    '<div class="gbemu-why"><b>Why.</b> Stored test output goes stale silently: stored renders can show cartridges ' +
      'failing that the current source passes.</div>' +
    '<div class="gbemu-rule" id="gbr-20-23"><b>Rule 20/23. Instrument the instrument.</b> Instrument the thing you ' +
      'are measuring, then instrument the instrument.</div>' +
    '<div class="gbemu-why"><b>Why.</b> A one-pixel bug in the measuring apparatus produced a clean, ' +
      'self-consistent, five-fold signal that survived a passing control and three rounds of analysis.</div>' +

    '<h4 class="gbemu-sub">Five shapes an instrument fault takes, each of which looks like a finding</h4>' +
    '<p class="hw-readable"><b>A heading that counts its own list is a dependent:</b> add a shape ' +
    'and the number above it goes stale unless the same edit moves it.</p>' +
    '<ul class="gbemu-bullets">' +
      '<li><b>Sampling coarser than the quantity.</b> Measured case: a frequency trajectory sampled every ' +
        '39&nbsp;ms, against a sweep that steps every 23.4&nbsp;ms, read as &ldquo;the sweep&rsquo;s first step is ' +
        'one clock early&rdquo;, identical to the reference from the second sample onward <em>including a repeated ' +
        'value</em>. <b>The detail that made it persuasive (identical from the second step on, including the ' +
        'repeat) is exactly the signature a one-window offset produces.</b> The thing that feels like confirmation ' +
        '<em>is</em> the artefact. Guard: Rule 20/24.</li>' +
      '<li><b>A control that cannot fail.</b> A check that a compiled-out feature changes nothing, made by putting an ' +
        'old source file on an include path to shadow the real one, cannot work: a quoted include searches the ' +
        'including file&rsquo;s own directory first, so both builds compile the same file and <b>the test compares ' +
        'a file with itself</b>. A deliberate compile error in the shadow copy, and a count of how often the ' +
        'compiler sees it (zero), exposes it. A conclusion can survive re-running when its first evidence does ' +
        'not. <b>Right by luck is not right by construction.</b> Guard: Rule 20/25.</li>' +
      '<li><b>A switch that never reaches the compiler.</b> When <b>the name being varied is a label the build ' +
        'silently ignores</b>, nothing is varied at all and every candidate reads &ldquo;nothing moves&rdquo;. ' +
        'Measured case: two candidate behaviours read that way; varied for real, one moves 464 pixels across eleven ' +
        'test pictures and the other 433 across one, and the experiment settles thirteen questions instead of ' +
        'eleven, <b>purely by testing properly</b>. Guard: Rule 20/26.</li>' +
      '<li><b>A probe in code that is not in the build.</b> A site can be read, quoted and reasoned about all day ' +
        'and still not exist in the binary that produced the number. Measured case: of twenty citation sites ' +
        'swept, <b>six were not in the build at all</b> (compiled out or inside an assertion) and two more were ' +
        'compiled and never executed. An arm placed at one of the dead ones scored <b>byte-inert across all 24 ' +
        'cartridges</b>, which is the cleanest, most plausible, most quotable refutation shape there is, and it ' +
        'meant nothing. The usual warning (a dead instrument returns a zero) does not go far enough: <b>the ' +
        'instrument can be killed by the build configuration of something you are only reading.</b> Guard: Rule ' +
        '20/27.</li>' +
      '<li><b>Identical scores across a sweep.</b> Measured case: six adjacent placements of one window all scored ' +
        'the same. The knob does turn, in ways the score does not see. The scores were identical because <b>no ' +
        'placement in that family can reach the trial the test is deciding on</b>. That is a fact about the model, ' +
        'and it is a different statement from &ldquo;the value does not matter&rdquo;. Guard: Rule 20/28.</li>' +
    '</ul>' +
    '<div class="gbemu-rule" id="gbr-20-24"><b>Rule 20/24. Sample at least as finely as the quantity.</b> An ' +
      'instrument&rsquo;s sampling interval must be no longer than the step of the quantity it samples.</div>' +
    '<div class="gbemu-rule" id="gbr-20-25"><b>Rule 20/25. A control must be able to fail.</b> Before a ' +
      'control&rsquo;s result counts, put a deliberate fault into the thing it controls (for a shadowed source ' +
      'file, a compile error) and confirm the control sees it.</div>' +
    '<div class="gbemu-rule" id="gbr-20-26"><b>Rule 20/26. A scorer prints its switches.</b> A scorer that accepts ' +
      'build switches must print every switch it passed on, on every run, and must refuse a switch whose form it ' +
      'cannot actually override. A figure taken by a scorer without that guard is a null of unknown provenance: it ' +
      'must be <em>re-taken</em>, not re-read.</div>' +
    '<div class="gbemu-rule" id="gbr-20-27"><b>Rule 20/27. A probe site is proved in the build.</b> Before a probe ' +
      'or a change placed at a site is scored, show that the site is compiled into the build and executed.</div>' +
    '<div class="gbemu-rule" id="gbr-20-28"><b>Rule 20/28. Identical rows are an instrument defect until proven ' +
      'otherwise.</b> When a sweep scores identically at every setting, first check that the knob turns (moves ' +
      'some byte). If it does, report what the identical scores show about the model (which trial no setting can ' +
      'reach), not that the value does not matter.</div>' +

    '<div class="gbemu-rule" id="gbr-20-29"><b>Rule 20/29. A residual can hide where the output is zero.</b> A table ' +
      'of differences scored on output alone must not be used to clear a section: a section whose output ' +
      'difference is zero can still leave behind a different register state.</div>' +
    '<div class="gbemu-example"><b>Example.</b> A per-section table of differences scored on <em>audible ' +
      'output</em> reads <code>0.0000</code> on a section that is silent on both sides, and that silent section ' +
      'carries the divergence, because the register state it leaves behind is audible two sections later. <b>A ' +
      'table scored on the output alone will print a zero and be pointing straight at the cause.</b></div>' +

    '<h4 class="gbemu-sub">Measure how much of your own machine nothing can see</h4>' +
    '<p class="hw-readable">This is the finding a reader is least likely to anticipate, and it is ' +
    'the one most worth copying. The census enumerates every internal decision in this core and exercises ' +
    'each, <b>scored in raw bytes of output rather than in passes</b>: a hash of the ' +
    'complete frame from every cartridge and every probe row, so that a change too small to move a ' +
    'verdict still registers.</p>' +
    '<table class="gbemu-table"><tbody>' +
      '<tr><td><b>84</b></td><td>decisions enumerated</td></tr>' +
      '<tr><td><b>48</b></td><td>observable: some tried value moves a byte somewhere</td></tr>' +
      '<tr><td><b>35</b></td><td><b>unobservable: 42 per cent</b>; no value tried moves a single byte</td></tr>' +
      '<tr><td><b>9</b></td><td>of those 35 are <b>live decisions</b>: shipped at a value that elects a behaviour, with nothing able to say whether it is right</td></tr>' +
      '<tr><td><b>1</b></td><td><b>not independently variable</b>: <code>OBJ_PREVIS_AT0</code>, which the build refuses while <code>OBJ_X0_OUTPUT</code> is set, so no value of it can be tried on its own. 48 + 35 + 1 = 84</td></tr>' +
    '</tbody></table>' +
    '<p class="gbemu-key"><b>The three classes partition the 84.</b> They come from one pass of one census over 84 top-level switches: 48 observable, 35 unobservable, and 1 not independently variable (<code>OBJ_PREVIS_AT0</code>: the build refuses it while <code>OBJ_X0_OUTPUT</code> is set, so it can only move together with that switch and was never tried alone). Quote 84 as the enumeration and the three as its classes. The gate holds the relation <code>observable + unobservable + not independently variable = enumerated</code>. INSTRUMENT-MEASURED, from the census record.</p>' +
    '<div class="gbemu-rule" id="gbr-20-30"><b>Rule 20/30. Census your own decisions in bytes.</b> Enumerate every ' +
      'internal decision of your core, exercise each, score it in raw bytes of output rather than in passes, and ' +
      'record how many decisions no tried value can move.</div>' +
    '<div class="gbemu-rule" id="gbr-20-31"><b>Rule 20/31. &ldquo;Unobservable&rdquo; is a bound.</b> Record an ' +
      'unobservable decision as &ldquo;no value tried moved a byte&rdquo;, a bound and not a proof. Never file it ' +
      'as &ldquo;not refuted&rdquo;.</div>' +
    '<div class="gbemu-why"><b>Why.</b> <b>Roughly two fifths of the choices you will agonise over cannot be ' +
    'checked by any test you have.</b> Four things follow, and each one is a trap on its own. ' +
    '<b>&ldquo;Unobservable&rdquo; here means &ldquo;no value tried moved a byte&rdquo;</b>: ' +
    'a bound, not a proof. <b>Most of them are invisible because of the corpus, not because ' +
    'of the machine</b>: thirty-two of the thirty-five are reachable by code that could be written. ' +
    '<b>Most censuses have no category for this at all</b>, so such decisions get filed under ' +
    '&ldquo;not refuted&rdquo;, which reads as &ldquo;checked and fine&rdquo; and is not the same ' +
    'thing. And the count is <b>an undercount by construction</b>, because errors accumulate one ' +
    'way only: an observable choice gets checked by accident eventually, and nobody ever sweeps a ' +
    'dead one.</div>' +
    '<div class="gbemu-why"><b>The sting in it.</b> <b>A decision can <em>become</em> unobservable as your ' +
    'emulator improves.</b> As cells go to zero, the pixels a given choice could have moved stop ' +
    'existing. <b>And the same thing happens to your controls.</b> Find out which two fifths, ' +
    'measure it in bytes, and write it down: it is the only part of a correctness claim that ' +
    'a score can never contain.</div>' +
    '<div class="gbemu-rule" id="gbr-20-32"><b>Rule 20/32. A one-point null is not a sweep.</b> &ldquo;No effect at ' +
      'the one value tried&rdquo; and &ldquo;no effect&rdquo; are different verdicts, and only the second closes ' +
      'anything. Record a null at one value as the first.</div>' +
    '<div class="gbemu-rule" id="gbr-20-33"><b>Rule 20/33. A column of zeroes is one fact about the cartridge.</b> ' +
      'When settings that are each shown live elsewhere all read 0 on one test cartridge, record one fact (the ' +
      'cartridge cannot enter the state), not one finding per setting, and nothing about the settings.</div>' +
    '<div class="gbemu-example"><b>Example.</b> <b>A column of thirteen zeroes is not thirteen findings, it is one ' +
      'fact about the cartridge.</b> Thirteen settings, every one demonstrably live on the existing corpus at ' +
      'between 35 and 6,845 differing pixels, all read 0 on one new test cartridge, which says that cartridge ' +
      'cannot enter the state, and says nothing whatever about the thirteen settings.</div>' +
    '<p class="gbemu-key">These are the two sentences this section exists to leave you with: Rules 20/32 and ' +
    '20/33.</p></section>' +

  /* ------------------------------------------------------------- SCORE
   * The comparison basis. The rule here is the one the project's own record
   * states: pick a basis, state it, hold it. Do NOT update the headline
   * number without updating the basis line and the ceiling arithmetic with
   * it, and do not difference the 264-row total against any other scorer's. */
  '<section class="sect" id="gbe-score"><h3 class="sect-h">21. The score, and what a score is worth</h3>' +
    '<p class="hw-readable">The public Game Boy Emulator Shootout board enumerates <b>264 rows</b> ' +
    'across nine suites (97 Mooneye, 68 SameSuite, 51 Blargg, 24 mealybug tearoom, 9 daid, ' +
    '5 acid, 4 cpp, 3 ashiepaws, 3 ax6) covering both the original Game Boy and the Color ' +
    'from one core. A <b>row</b> is one test cartridge (or one cartridge on one machine) with its verdict: ' +
    'PASS, FAIL, ERROR, or INFO for a row that ships no reference and so cannot be scored.</p>' +
    '<div class="factbox" style="margin-bottom:18px">' +
      '<div class="row"><span class="k">Board of record</span><span class="v">258 PASS &middot; 3 FAIL &middot; 0 ERROR &middot; 3 INFO, of 264</span></div>' +
      '<div class="row"><span class="k">Basis</span><span class="v">PASS only, all 264 rows, 0 unjoined</span></div>' +
      '<div class="row"><span class="k">Conditions</span><span class="v">Board machine, both boot programs supplied, on a committed tree (Rule 21/3); the served core is the core measured (below)</span></div>' +
      '<div class="row"><span class="k">How measured</span><span class="v">Rule 21/2</span></div>' +
    '</div>' +
    '<div class="gbemu-rule" id="gbr-21-1"><b>Rule 21/1.</b> The board figure is the number of rows that PASS under each suite&rsquo;s own comparator, counted over every row of the board. INFO rows are not counted as passes. The figure must be quoted with its basis (Rule 21/5).</div>' +
    '<div class="gbemu-rule" id="gbr-21-2"><b>Rule 21/2.</b> A board run must compare, for every row and at every checkpoint of that row, the framebuffer <em>bytes</em> of the control build against those of the candidate build. Neither the suite&rsquo;s own tolerance verdict nor a result carried forward from a previous run may stand in for that comparison.</div>' +
    '<div class="gbemu-rule" id="gbr-21-3"><b>Rule 21/3.</b> A board figure must be measured on a committed tree, so that anyone can reach the exact source it was taken on. A citation to one machine&rsquo;s directory is not a basis. If an input cannot be committed, commit the way to rebuild it (appendix G.6).</div>' +
    '<div class="gbemu-why"><b>Why.</b> A board figure taken on a working tree is reproducible only if the tree is reachable, and a citation to one machine&rsquo;s directory is a defect by this page&rsquo;s own standard. ' +
      'The structures that a measured tree carries on top of a committed one can also be stated on the page so that the tree can be rebuilt: for this board they are the scan ' +
      'latch and grip lag in section 5, the removed window increment in section 11 and the counter model in section 17.</div>' +
    '<p class="hw-readable"><b>This is the core this site runs, and the board figure is measured on it.</b> ' +
    'The served core&rsquo;s sha256 begins <code>5bd7320427e1</code>: the footer prints it, ' +
    '<code>play/gameboy/CORE-VERSION.json</code> names it, and the browser can recompute it from ' +
    '<code>build/gb.wasm</code>. <b>The whole 264-row board was last re-run on this core: every row byte-identical to the run before it, 258 PASS, 3 FAIL, 3 INFO.</b> ' +
    'The served core includes the unlicensed boards of appendix H.11, the interrupt-hold rule of section 14 and the extra hardware of appendix A.1 (the Super Game Boy, the link cable and infrared between two machines, rumble, the HuC3 tone, the Barcode Boy and the Pocket Sonar), all of that hardware off unless used.</p>' +
    '<div class="gbemu-rule" id="gbr-21-4"><b>Rule 21/4.</b> A documentation page and the core it documents are one deliverable and are published together. Before relying on any claim of this page, check that the core you run is the served core: compare its sha256 with the one above.</div>' +
    '<div class="gbemu-why"><b>Why.</b> A page and its artifact drift apart silently. ' +
      'For example, an artifact that carries no <code>OBJ_M0_LEAD</code>, <code>OAM_GRIP_LAG</code> or <code>OAM_SCAN_LATCH</code> (the object row&rsquo;s report lead, the grip phase and the scan latch) ' +
      'leaves three of this page&rsquo;s claims with no site-side referent.</div>' +
    '<h4 class="gbemu-sub">The whole board, by suite, so the three failures can be found</h4>' +
    '<p class="hw-readable">A headline figure that cannot be resolved into named rows is not a ' +
    'result, it is a mood. Every one of the three is named in section 22. Every count in this table is a number of rows of the board.</p>' +
    '<table class="gbemu-table"><thead><tr><th>Suite</th><th>PASS (rows)</th><th>FAIL (rows)</th><th>ERROR (rows)</th><th>INFO (rows)</th></tr></thead><tbody>' +
      '<tr><td>acid</td><td>2</td><td>1</td><td>0</td><td>2</td></tr>' +
      '<tr><td>ashiepaws</td><td>3</td><td>0</td><td>0</td><td>0</td></tr>' +
      '<tr><td>ax6</td><td>3</td><td>0</td><td>0</td><td>0</td></tr>' +
      '<tr><td>blargg</td><td>51</td><td>0</td><td>0</td><td>0</td></tr>' +
      '<tr><td>cpp</td><td>4</td><td>0</td><td>0</td><td>0</td></tr>' +
      '<tr><td>daid</td><td>7</td><td>1</td><td>0</td><td>1</td></tr>' +
      '<tr><td>mealybug tearoom</td><td>24</td><td>0</td><td>0</td><td>0</td></tr>' +
      '<tr><td>Mooneye</td><td>97</td><td>0</td><td>0</td><td>0</td></tr>' +
      '<tr><td>SameSuite</td><td>67</td><td>1</td><td>0</td><td>0</td></tr>' +
      '<tr><td><b>Total</b></td><td><b>258</b></td><td><b>3</b></td><td><b>0</b></td><td><b>3</b></td></tr>' +
    '</tbody></table>' +
    '<h4 class="gbemu-sub">Published comparisons are not like-for-like, and the error is worth three rows</h4>' +
    '<div class="gbemu-rule" id="gbr-21-5"><b>Rule 21/5.</b> Every board figure, ours or a rival&rsquo;s, must name its basis: which verdicts it counts (PASS only, or PASS + INFO) and over which row set (every row of the board, or the shared 261, the rows on which all four emulators below were run). Two figures on different bases must not be compared. This page holds to one basis, the first row of the table below, and every figure quoted on this page is on it unless it names another.</div>' +
    '<div class="gbemu-why"><b>Why.</b> <b>Totals in circulation count <code>INFO</code> rows: rows that ' +
    'ship no reference, which nobody can score, including the emulator being credited with ' +
    'them.</b> And two of the comparison emulators <b>were never run on 3 of these 264 rows at ' +
    'all</b>, all three of which this core passes. Those two errors point the same way and they are ' +
    'why a single headline figure is meaningless without its basis.</div>' +
    '<p class="hw-readable">In the table below every count is a number of rows; the first column names the basis (Rule 21/5).</p>' +
    '<table class="gbemu-table"><thead><tr><th>Basis (verdicts counted, row set)</th><th>Ours (rows)</th><th>SameBoy (rows)</th><th>Emulicious (rows)</th><th>DocBoy (rows)</th></tr></thead><tbody>' +
      '<tr><td><b>PASS only, all 264</b></td><td><b>258</b></td><td>250</td><td>never run</td><td>never run</td></tr>' +
      '<tr><td>PASS + INFO, all 264</td><td><b>261</b></td><td>253</td><td>never run</td><td>never run</td></tr>' +
      '<tr><td>PASS only, shared 261</td><td><b>255</b></td><td>249</td><td>251</td><td>255</td></tr>' +
      '<tr><td>PASS + INFO, shared 261</td><td><b>258</b></td><td>252</td><td>254</td><td>258</td></tr>' +
    '</tbody></table>' +
    '<div class="gbemu-example"><b>Example.</b> How our column follows from the board of record. Table row 1 is the board of record itself. Table row 2 adds the 3 INFO rows to it. Table row 3 takes away from row 1 the 3 rows outside the shared set: all three of them PASS on this core, so row 3 is row 1 minus 3. Table row 4 adds the 3 INFO rows to row 3; the INFO rows lie inside the shared set. So our four figures are b, b + 3, b &minus; 3 and b, where b is the board of record. Rows 2 to 4 follow from row 1 by this arithmetic.</div>' +
    '<div class="gbemu-why"><b>Why the arithmetic holds.</b> <b>The step that row 3 depends on is that the rows outside the shared set are rows this core passes, and it is stated ' +
    'rather than assumed:</b> the three rows outside that set are three rows this core passes. The rival ' +
    'columns were not re-taken: <b>they are the figures as published, and a ' +
    'rival that has moved since is a rival this table is stale about.</b></div>' +
    '<p class="hw-readable"><b>The ordering, base by base.</b> ' +
    '<b>On the two bases where DocBoy was run at all, the shared 261, it ' +
    'is a tie: 255 and 255, 258 and 258.</b> A tie is not a lead and this page will not report ' +
    'it as one; <b>on the two all-264 bases the comparison is against SameBoy alone</b>: ' +
    'Emulicious and DocBoy were never run on three of those rows, so their columns read ' +
    '&ldquo;never run&rdquo; and no ordering against them exists there. <b>That is not the same as ' +
    'saying the comparison does not exist</b> ' +
    ': one of the three rivals <em>was</em> run on all four bases and its figures are in the ' +
    'SameBoy column of the table above. The basis this page holds to is the first ' +
    'row ' +
    ' (<b>PASS only, all 264</b>) and every figure quoted anywhere above is on it. ' +
    'Figures three higher than ours are the <code>PASS + INFO</code> basis and are not comparable ' +
    'to it.</p>' +
    '<div class="gbemu-rule" id="gbr-21-6"><b>Rule 21/6.</b> Two scoring ' +
    'scripts in this project enumerate <b>264</b> and <b>288</b> rows respectively. Both are ' +
    'useful; neither total is comparable with the other and they must never be differenced. If you ' +
    'build your own board, the row set is part of the number: quote it with every figure.</div>' +
    '<div class="gbemu-why"><b>Why.</b> A second denominator trap, from the same family as the INFO rows of Rule 21/5.</div>' +
    '<h4 class="gbemu-sub">The ceiling, and why it is not a limit on effort</h4>' +
    '<div class="gbemu-rule" id="gbr-21-7"><b>Rule 21/7.</b> The <b>ceiling</b> is the board&rsquo;s row count minus every row deducted in the table below: the rows that ship no reference, and each failing row that is declined, unreachable or only partially derivable, each named in section 22. Equivalently, the ceiling is the board of record plus the rows still open. A ceiling holds only for one set of decisions; when a decision changes, the ceiling changes with it, even if no row&rsquo;s verdict moves.</div>' +
    '<p class="hw-readable">Subtract the rows that are not winnable from the board, ' +
    'and the arithmetic is short. Every figure in this table is a count of rows of the board.</p>' +
    '<table class="gbemu-table"><thead><tr><th>Rows (count)</th><th>Step</th></tr></thead><tbody>' +
      '<tr><td><code>264</code></td><td>the board</td></tr>' +
      '<tr><td><code>&minus;3</code></td><td>ship no reference at all: <b>every</b> emulator reports INFO on these three. <b>261 is the ceiling for anybody</b>, this core included</td></tr>' +
      '<tr><td><code>&minus;1</code></td><td><b>partially</b> derivable from this corpus: <code>channel_4_freq_change</code>. 14 of its 18 wrong cells are won and <b>4 remain</b>, missing in opposite directions so that no constant closes both (section 22). The row still fails and the deduction stands</td></tr>' +
      '<tr><td><code>&minus;1</code></td><td>unreachable: <code>cgb-acid-hell</code>. A site exists: 118 of the 120 pixels are closed at zero cost (section 11) and <b>2 remain unattributed</b>. The deduction stands</td></tr>' +
      '<tr><td><code>&minus;1</code></td><td>declined permanently, on the hardware revision this project claims: <code>ppu_scanline_bgp</code>, the Color half</td></tr>' +
      '<tr><td><b><code>258</code></b></td><td><b>the ceiling under the decisions as they stand</b></td></tr>' +
      '<tr><td><b><code>258</code></b></td><td><b>the board today.</b> <b>No row sits between it and the ceiling</b>: the board and the ceiling are the same number, which is what a ceiling met looks like</td></tr>' +
    '</tbody></table>' +
    '<div class="gbemu-rule" id="gbr-21-8"><b>Rule 21/8.</b> Every time the ceiling table is changed, check two things: the ceiling line must equal the top line minus every deduction, and the bottom line (the board today) must equal the board of record at the top of this section. If either disagrees, a row has been counted in the wrong class.</div>' +
    '<div class="gbemu-why"><b>Why.</b> <b>Read the two 258s carefully, because they are not the same claim.</b> ' +
    'The upper one is <em>264 minus the rows this project has decided against</em>; the lower is ' +
    '<em>what the scorer printed</em>. They coincide because nothing is open. <b>That is not a ' +
    'stopping condition.</b> A ceiling is only ever a ceiling given a set of decisions (Rule 21/7), and three of ' +
    'the four deductions above carry a reopen condition that is stated in section 22 (Rule 22/1). ' +
    'A ceiling can move on a day when no row moves, because a ceiling is the board plus the rows that are ' +
    'still open, so a row decided against is not among them.</div>' +
    '<div class="gbemu-rule" id="gbr-21-9"><b>Rule 21/9.</b> A decline must carry a reopen condition. This holds for every decline, including a &ldquo;forced fork&rdquo; (a claim that no structure can satisfy two authorities at once).</div>' +
    '<div class="gbemu-why"><b>Why.</b> A decline with no stated ' +
    'condition is indistinguishable from a closure, and the next reader has nothing to act on. ' +
    'Decisions can be revisited, and a reopen can buy a mechanism, not a fudge: on ' +
    '<code>ppu_scanline_bgp</code> (the original half) a reopen allowed a fitted value, and what closes the row is mostly a ' +
    'mechanism (the level comparator in section 14); the fitted value carries ' +
    'one machine cycle of the fix (section 22). That is the ' +
    'argument against writing a decline as if it were permanent.</div>' +
    '<div class="gbemu-rule" id="gbr-21-10"><b>Rule 21/10.</b> Cite a decline by its document and its date, never by an ordinal (&ldquo;the third decline&rdquo;).</div>' +
    '<div class="gbemu-why"><b>Why.</b> An ordinal that does not enumerate the events it is counting cannot be reconciled when two records disagree. An unreconciled count is ' +
    'how a sixth decline gets written as a fourth.</div></section>' +

  /* -------------------------------------------------------- UNWINNABLE */
  '<section class="sect" id="gbe-unwinnable"><h3 class="sect-h">22. Rows nobody can win honestly</h3>' +
    '<p class="hw-readable">Every board has some, and no board says which. This section exists ' +
    'because a reader who does not know will spend weeks on them, and because two of them ' +
    'are unwinnable for reasons that are genuinely interesting about the hardware.</p>' +
    '<p class="gbemu-key"><b>Three rows on this board are not passing, and all three are named.</b> ' +
    'A ceiling that does not resolve into rows with names is not a ceiling, it is an excuse, so ' +
    'here they are before the arguments, in the table of Rule 22/1. The three that ship no reference are on top of those three ' +
    'and belong to everyone. <b>Three subsections below record rows that read as unwinnable and ' +
    'are won</b> (the sweep-restart row, the two fork rows, and <code>ashiepaws/strikethrough.gb</code>), and they ' +
    'are kept because the reason each looked unwinnable is reusable.</p>' +
    '<div class="gbemu-rule" id="gbr-22-1"><b>Rule 22/1.</b> The rows that are not passing, their class and the condition that reopens each, are these. A row in this table must not be closed by any means its reopen column excludes.</div>' +
    '<table class="gbemu-table"><thead><tr><th>Row</th><th>Verdict and residue (suite&rsquo;s own comparator)</th><th>Class</th><th>Reopen condition</th></tr></thead><tbody>' +
      '<tr><td><code>acid/cgb-acid-hell.gbc</code></td><td>FAIL, <b>2 px</b> differ</td><td>unreachable: a site exists (section 11) and the 2 px are unattributed</td><td>what would establish the cause of the 2 px: the probe cartridge described under &ldquo;The Color acid row&rdquo; below</td></tr>' +
      '<tr><td><code>daid/ppu_scanline_bgp.gb</code> on the Color</td><td>FAIL</td><td>declined permanently, by design, on consistency</td><td>only a change to the ruling about which Color revision this project claims (Rule 22/4)</td></tr>' +
      '<tr><td><code>samesuite/apu/channel_4/channel_4_freq_change.gb</code></td><td>FAIL, wrong in <b>4 cells of 64</b></td><td>partially derivable</td><td>a structural account of the reload boundary, or a stimulus that separates the two directions; not a constant (Rule 22/5)</td></tr>' +
      '<tr><td>the three rows that ship no reference</td><td>INFO for every emulator</td><td>unscoreable</td><td>none: the gap is in the board</td></tr>' +
    '</tbody></table>' +
    '<div class="gbemu-rule" id="gbr-22-2"><b>Rule 22/2.</b> A row counts only when it passes under the suite&rsquo;s own comparator. <b>A defect ' +
    'closed is not a row won, and 118 of 120 pixels is not 118/120 of a row.</b> A failing row contributes <b>zero rows</b> to the board, however much of it is right.</div>' +
    '<div class="gbemu-example"><b>Example.</b> <code>cgb-acid-hell</code> differs on 2 px of a frame and <code>channel_4_freq_change</code> is right on 60 of its 64 cells. Both are FAIL under the suite&rsquo;s own comparator, and each contributes 0 rows, not a fraction of one.</div>' +
    '<div class="gbemu-why"><b>Why.</b> This is the distinction that governs this whole section, stated once ' +
    'because two of the three remaining rows depend on it. ' +
    'If you take one ' +
    'sentence from this section, take that one: a board is a count of rows, and partial credit on a ' +
    'row is a number you tell yourself.</div>' +

    '<h4 class="gbemu-sub">Three rows have no reference at all</h4>' +
    '<p class="hw-readable">They ship nothing to score against. Every emulator on the board reports ' +
    'them as unscoreable, including the ones quoted as beating this one. They are not a gap in any ' +
    'core; they are a gap in the board, and counting them as passes is the first half of the ' +
    'like-for-like problem in section 21.</p>' +

    '<h4 class="gbemu-sub">One row&rsquo;s correct answer varies between individual consoles</h4>' +
    '<p class="gbemu-key">This is the one worth reading even if you never touch this board. The ' +
    'test (<code>ppu_scanline_bgp</code>, the original half) writes the background palette register ten times per scanline and photographs the result, ' +
    'so the picture <em>is</em> a diagram of when a palette write takes effect. The suite ships ' +
    '<b>three</b> accepted reference images, and its own definition says why, verbatim: ' +
    '<i>&ldquo;changing the BGP register has three possible effects for one pixel: the previous BGP ' +
    'is used, the next BGP is used, or the OR result of the previous and next BGP is used, the last ' +
    'case causing a black line. Which case occurs seems to be hardware and instance dependent as ' +
    'some DMGs do not do a consistent single case.&rdquo;</i></p>' +
    '<div class="gbemu-rule" id="gbr-22-3"><b>Rule 22/3.</b> A row that ships several accepted references passes when the render is byte-identical to any one of them. <b>Passing any one of the three is sufficient.</b></div>' +
    '<div class="gbemu-why"><b>Why.</b> Verified by reading the scorer, which loops the loaded references and returns a pass ' +
    'on the first that matches, not assumed. And <b>a trap for anyone reconstructing that fact from ' +
    'a report:</b> the harness stores only the <em>first</em> reference&rsquo;s filename as the ' +
    'display name while scoring all three, so a results file or a summary will tell you there is ' +
    'one reference. There are three.</div>' +
    '<p class="hw-readable">Read the suite&rsquo;s definition carefully, because it is stronger than &ldquo;the captures ' +
    'disagree&rdquo;. The variation is <b>between individual consoles, and within one console</b>. ' +
    '<b>So a hardware capture settles nothing general here</b>: there is no single right ' +
    'answer to go and measure, and a bench session buys this row nothing. Do not confuse it with a ' +
    'revision-dependent row, where several named revisions agree and one differs: there a ruling ' +
    'produces a right answer. Here no ruling and no photograph can. <b>The first is a decision; the ' +
    'second is not decidable at all.</b></p>' +
    '<p class="hw-readable"><b>How this core passes it, which is easily misread.</b> The passing build carries a ' +
    'fitted value: <em>our</em> fit, at a site <em>we</em> chose by enumerating seven ' +
    'candidates and measuring each, moving nothing on protected ground, and not generalising to any ' +
    'other row. What closes the row is mostly the mechanism in section 14. And the render it lands on ' +
    'is <b>byte-identical to one of the three references: 0 of 23,040 pixels differ at ' +
    'all</b>, standing 464 px from each of the other two, which is exactly the distance those two ' +
    'stand from it. <b>We did not choose which one:</b> the reference it matches is the ' +
    '&ldquo;OR&rdquo; outcome, which is the outcome our core&rsquo;s palette model ' +
    'predicts. That is the difference between matching a picture and being right for a reason.</p>' +
    '<div class="gbemu-rule" id="gbr-22-4"><b>Rule 22/4.</b> <b>The Color half of the same test is a different row, and it is ' +
    'declined permanently.</b> Only a change to the ruling about which Color revision this project claims reopens it. <b>A ' +
    'cheaper site is not grounds to reopen, and neither is a free one.</b></div>' +
    '<div class="gbemu-why"><b>Why.</b> The Color half is defined with one reference and an unambiguous rule (no ' +
    'three-way ambiguity, no instance dependence) and the same two clauses take it most of ' +
    'the way and leave <b>one pixel at each of eight boundaries</b>. That is a one-dot quantity and ' +
    'the dispatch sample moves in fours, so no placement on that axis can reach it: measured, the ' +
    'residual steps 4,032 / 1,728 / 576 pixels across whole machine cycles and <b>576 is the ' +
    'floor</b>. Three sites win the row outright, at five, seven and twenty-two protected Color ' +
    'cells; the cheapest costs five, two of them the merge rule&rsquo;s own.<br><br>' +
    '<b>And the price is not the reason, which is the easy thing to get ' +
    'wrong.</b> The cheapest site is <b>+1 for &minus;5</b>, and the prices are all true and all ' +
    'evidence; they are not the argument. The ' +
    'row is declined <b>on consistency</b>: the five cells the cheapest site spends encode the ' +
    'behaviour of <em>one</em> Color revision, and releasing them would adopt the <b>minority</b> ' +
    'revision at those cells while the project claims the <b>majority</b> everywhere else. A board ' +
    'that answers the same question two ways is worse than a board one row shorter. ' +
    'Note which side of the trade each word is about: the <em>target</em> is instance-dependent, ' +
    'which is why no capture settles it; the <em>price</em> is revision-dependent, which is what ' +
    'the ruling is about. Collapse the two and you will read the decline as a claim about the ' +
    'reference, and it is not.</div>' +

    '<h4 class="gbemu-sub">The noise-channel row: <code>channel_4_freq_change</code>, partially derivable, still failing at 4 cells of 64</h4>' +
    '<div class="gbemu-rule" id="gbr-22-5"><b>Rule 22/5.</b> <b>The row fails at 4 cells of 64 and does not count</b> (Rule 22/2). Those 4 cells must not be closed with a fitted constant, and <b>a glitch-correction layer is ' +
    'declined explicitly</b>. The row reopens only on a structural ' +
    'account of the reload boundary, or a stimulus that separates the two directions.</div>' +
    '<div class="gbemu-why"><b>Why.</b> The ' +
    'four are two pairs, both with the frequency write landing half way between two examinations of ' +
    'the divisor clock at a code-2 target, and <b>they miss in opposite directions</b>: one ' +
    'pair 8 T-cycles early, the other 8 T-cycles late. <b>No constant closes both</b>, because one number cannot ' +
    'be added and subtracted at once; that is the counter-reload boundary. ' +
    'The nearest implementation carries a glitch-correction layer, and its own author describes it as ' +
    'per-revision hand-built tables: <i>&ldquo;a simplified and deterministic variant of ' +
    'specific instances of revisions I own&rdquo;</i>, with cases flagged non-deterministic. <b>That ' +
    'layer is FITTED and this project will not take it.</b></div>' +
    '<p class="gbemu-key"><b>The hard part of this row is the quantifier.</b> The enumeration ' +
    'below refutes an entire family of rules, and the natural conclusion to draw is that the ' +
    'row is not derivable from this corpus and that <b>anything closing it would be fitted</b>. ' +
    'That conclusion is <b>right about monotone schedule rules and wrong about derivability</b>: ' +
    'a sound refutation of one family is not a refutation of every rule, and the ' +
    'error is in the quantifier rather than in the proof. <b>14 of the 18 cells the monotone family leaves wrong are won ' +
    'with no value fitted to this cartridge at all</b>: the row stands at 60 of 64 cells, and channel 4 ' +
    'as a whole at 1096 of 1100 cells, and <b>368 further cells, which a read-off tie-break also ' +
    'passes, are DERIVED</b>. The refutation below is given in full, ' +
    'because it is sound and is the reason the obvious family of rules cannot work.</p>' +
    '<p class="hw-readable">The argument in full: a noise-channel test declares ' +
    'eight groups of eight cells, and each group ' +
    'declares exactly <b>one</b> falling edge, so the whole table is eight readings of when ' +
    'one shift happens. <b>And it contains a model-independent falsifier.</b> Two groups differ in ' +
    'one thing: the frequency write lands one machine cycle later. Moving that write four T-cycles ' +
    '<em>later</em> moves the falling step <b>eight T-cycles earlier in absolute time</b>. A second ' +
    'pair says it again on a different starting value.</p>' +
    '<p class="hw-readable">A later write producing an earlier step <b>refutes every rule whose ' +
    'post-write schedule is non-decreasing in the write time</b>, which is the entire family ' +
    'anyone would propose: keep the old remaining count then apply the new period, reload the full ' +
    'new period, treat it as a retrigger, any of those snapped to the free-running grid in either ' +
    'direction. All monotone. Two independent pairs kill all of them. Forced rather than argued: ' +
    '<b>48 structured two-stage rules, built from pieces this core already carries, were scored against ' +
    'all 64 declared cells (the best of the 48 reaches 41, and 64 is ' +
    'what the row needs). No rule reached a single whole group.</b> The cartridge&rsquo;s own author ' +
    'writes that <i>&ldquo;the logic behind it is still unclear&rdquo;</i>.</p>' +
    '<p class="hw-readable"><b>What the 48-rule enumeration proves, and what it does ' +
    'not.</b> It proves that <em>a later write producing an earlier step refutes every rule whose ' +
    'post-write schedule is non-decreasing in the write time</em>. That stands. <b>What ' +
    'it does not prove is that no rule exists</b>: every rule in the family computes <em>a duration ' +
    'from the write</em>, and the hardware computes <em>a position in a count that never ' +
    'stopped</em>. <b>The family is complete; it is not the universe.</b> Its own closing sentence ' +
    'names the gap exactly: <i>&ldquo;the write time enters the mechanism in a way no counter ' +
    'model in this tree reproduces&rdquo;</i>. The answer is a counter model, and section 17 states ' +
    'it. Fourteen ' +
    'of the eighteen close with <em>no</em> free choice (every constant in the model that ' +
    'wins them is pinned by the other four channel-4 suites). <b>It also does not need a finer cartridge</b>, which is the obvious thing to ask for: the ' +
    'eight declared edges are enough once the shape is right. <b>What is left is the four cells of Rule 22/5</b>, and section 17 ' +
    'says why they are different.</p>' +

    '<h4 class="gbemu-sub">The sweep-restart row: now passing at 0 cells of 128, and two traps on the way to it</h4>' +
    '<div class="gbemu-rule" id="gbr-22-6"><b>Rule 22/6.</b> The sweep-restart row needs two placements inside the sweep unit, both stated as build rules in section 16: <b>site 4</b> voids a sweep step&rsquo;s own overflow stop when a trigger landed within the 12 T-cycles before the step, and <b>site 5</b> otherwise lands that stop 8 T-cycles late. They are not the 32 T-cycle late check of section 16 and B.9, which is a separate rule and also required.</div>' +
    '<div class="gbemu-why"><b>Why.</b> A derived placement carrying two fitted values (site 4 and site 5). Five sites inside the sweep unit were scanned ' +
    'against all 128 declared cells: <b>site 1</b> never wins, <b>site 2</b> wins ' +
    'the bulk outright, <b>site 3</b> buys 35 cells and <b>breaks two sibling cartridges</b> from ' +
    '0 to 15 and 0 to 63, and <b>sites 4 and 5 together</b> take the cartridge to <b>0 of 128</b> at no cost anywhere.</div>' +
    '<p class="hw-readable"><b>The diagnosis that presents itself is wrong, and it is worth stating ' +
    'so you do not spend on it.</b> ' +
    'Without the two placements the cartridge fails on 49 cells of 128, and it reads as though <b>48 of the 49 are entirely whether a ' +
    'register write lands before or after the sound unit&rsquo;s own step within the same machine ' +
    'cycle</b> (a processor-versus-sound-unit ordering seam governing <em>every</em> register ' +
    'write in the machine) with the remaining 1 an immediate kill path needing a constant ' +
    'nothing declares. On that reading even a perfect fix leaves one cell that only a fitted number closes, and ' +
    'the seam is a whole-machine question not to be taken as a way of buying one row.</p>' +
    '<p class="gbemu-key"><b>The first trap is that diagnosis: there is no seam.</b> That ' +
    'attribution is <em>inferred and never measured</em>, and instrumenting this core&rsquo;s own ' +
    'timestamps settles it in two numbers. From the divider reset to the restart write is ' +
    '<b>+4,093 machine cycles</b> (4,090 idle instructions plus the write on the third cycle ' +
    'of a three-cycle store, which is correct) and from the same reset to the natural ' +
    'divider-to-sound rollover is <b>+4,097</b> against a textbook 4,096, also correct. Both ' +
    'processor-side quantities are right, so there is no seam to move and nothing to route. The ' +
    'three machine cycles lie entirely in the sweep unit&rsquo;s own path.</p>' +
    '<div class="gbemu-rule" id="gbr-22-7"><b>Rule 22/7.</b> Before declining a row because no derivation reaches it, enumerate the alternative sites and answer: <em>does a placement exist that wins the row at zero measured cost to protected ' +
    'ground?</em> Only if none exists may the decline stand on derivability.</div>' +
    '<div class="gbemu-why"><b>Why.</b> <b>The second trap is the close, and it is the more instructive one.</b> The argument that closes the row is about ' +
    '<em>derivability</em> (fixing the seam perfectly still leaves the kill cell) ' +
    'when the question that decides whether a bounded fitted value is allowed is a different one ' +
    'entirely: the question of Rule 22/7. For this row the answer is yes: sites 4 and 5 (Rule 22/6).</div>' +

    '<h4 class="gbemu-sub">Two rows that look like forced forks, and both were won</h4>' +
    '<p class="hw-readable">The fork, as it presents itself: ' +
    '<i>&ldquo;Reproducing the mealybug author&rsquo;s sprite law <em>necessarily</em> fails one ' +
    'Mooneye timing test. The two authorities are calibrated on different observables (what ' +
    'pixels come out, against when mode 0 begins), so no photograph of any console could ever ' +
    'have reconciled them. The other fork is arithmetic: deferring one interrupt source off the ' +
    'frame wrap wins that row and loses the two mealybug cartridges that the current placement ' +
    'takes to zero. +1 for &minus;2.&rdquo;</i> <b>Both halves are refuted</b>, and the sentence ' +
    'that holds the answer is the one about different observables: read the ' +
    'right way round.</p>' +
    '<p class="gbemu-key"><b>Two observables do not force a choice. They imply two events, and two ' +
    'events admit two sites.</b> This core&rsquo;s source holds ' +
    'that the picture processor <em>leaves</em> mode 3 when the fetcher finishes while STAT ' +
    '<em>reports</em> mode 0 when the last pixel has left. The mealybug suite grades which pixel ' +
    'got which value; the Mooneye cartridge grades when mode 0 begins. So a correction carried by ' +
    'the <b>report</b> and not by the <b>pipeline</b> is visible to the second and invisible to the ' +
    'first. The fork is not between the authorities. It is between two sites ' +
    'served from one.</p>' +
    '<div class="gbemu-rule" id="gbr-22-8"><b>Rule 22/8. The sprite row.</b> On a line on which an object fetch has <em>begun</em>, ' +
    'STAT reports mode 0 <b>three dots before the line&rsquo;s last pixel</b>. That writes the reported ' +
    'mode and the interrupt line and nothing else: no fetcher dot, no stall length, no push, ' +
    'no queue, no memory block, all of which still happen at pixel 160. The condition is <b>&ldquo;an object was <em>fetched</em>&rdquo;</b>: ' +
    'not noticed and not selected. Rules E.6/6 and E.6/8 (<code>OBJ_M0_LEAD</code>) are the home of this rule and give its value on each machine.</div>' +
    '<div class="gbemu-example"><b>Example.</b> Two lines, each with one object selected by the scan. On the first line that object&rsquo;s fetch begins: STAT reports mode 0 three dots before the line&rsquo;s last pixel leaves, and the pixels are unchanged. On the second line the object passes the scan but no fetch of it ever starts (<b>selected-but-never-fetched is reachable</b>): that line does not move at all.</div>' +
    '<div class="gbemu-why"><b>Why.</b> With the rule the ' +
    'cartridge passes <b>105 of 105</b>, and the mealybug board, dmg-acid2, Blargg, every other ' +
    'Mooneye suite, the boot handover and a 252-probe table of mode-3 lengths are all byte-identical with and without it. ' +
    '<b>The alternative site is the one that would cost the fork:</b> shortening the ' +
    'line&rsquo;s first object fetch by three dots also takes the cartridge to 105 of 105, and ' +
    'costs <b>13 of the 24 mealybug cells (0 px to 13,066 px</b>), because it moves ' +
    'the fetcher&rsquo;s dots, so every pixel after the line&rsquo;s first object moves with them. ' +
    'It is kept reachable in one build so that price stays reproducible.<br><br>' +
    '<b>Labelled FITTED, not MECHANISM, and the split is the honest part.</b> ' +
    'The <em>site</em> is derived: two observables imply two events, which is this core&rsquo;s own ' +
    'standing position, and the condition (an object was fetched) is what the 105 ' +
    'testcases measure directly (lines with objects selected and never fetched are ' +
    'exact without it and must not move). <b>Read from ' +
    'source</b>: the flag this correction is conditioned on is set where an object fetch ' +
    '<em>begins</em>, not where one is selected. The <em>magnitude</em> is a number that scored. What would earn ' +
    'MECHANISM is a device or a document pinning where STAT&rsquo;s mode bits fall relative to the ' +
    'last pixel of a line whose shifter was interrupted by an object. <b>Falsifier registered:</b> ' +
    'if a later structure makes the object pipeline three dots shorter <em>on the pixels</em> and ' +
    'the mealybug board holds, this constant is describing a lag that was really a length, and it ' +
    'goes to zero in the same change.</div>' +
    '<div class="gbemu-rule" id="gbr-22-9"><b>Rule 22/9. The interrupt row.</b> <b>The mode-1 STAT interrupt source and the VBlank interrupt are two separate ' +
    'signals.</b> Of the five things line 144, dot 0 does (dots on the event scale, from the line&rsquo;s dot 0: set the mode, set the reported mode, set the interrupt mode, raise VBlank, raise the ' +
    'line-144 sprite-scan request), only the mode-1 STAT source belongs later: it rises on dot 6 (Rule E.6/1, its home). The other four must stay ' +
    'at dot 0.</div>' +
    '<div class="gbemu-why"><b>Why.</b> The row is won at the <em>other end of the same interval</em>, with the frame-wrap placement ' +
    'unchanged, so the trade of the fork is not taken. The other four stay at dot 0 because a different cartridge measures VBlank against the line-144 mode-2 STAT and ' +
    'declares them simultaneous: split more than that one component and it breaks. ' +
    'The passing band is exactly <b>four dots wide</b>, and its first dot tracks this ' +
    'core&rsquo;s own interrupt-dispatch lag at every lag tried (42 builds, every dot from 0 ' +
    'to 13 at each of three lags), because four dots is the processor&rsquo;s ' +
    'dispatch-sample quantum, so any rise inside one machine cycle is seen at the same sample. ' +
    'A running processor sees line-start requests one machine cycle sooner than it would without the look of appendix D.10.1, the line-0 lag is 3, and ' +
    'the source ships the literal dot 6, which the AGE <code>stat-int</code> hardware table asks for and ' +
    'at which this row passes (FITTED; appendix E.6).</div>' +
    '<p class="hw-readable"><b>And the method note, which is the part worth taking away.</b> Both ' +
    'rows were watched in both directions rather than filed away, and that is how they are won. ' +
    '<b>A &ldquo;forced fork&rdquo; is a claim that no structure can satisfy both authorities ' +
    ', which is a claim about the search, not about the hardware</b>, and it carries a ' +
    'reopen condition like any other decline (Rule 21/9). Here the condition holds: the gate built to refuse a ' +
    'pass while <em>either</em> authority says no reports both satisfied, with the sprite ' +
    'law&rsquo;s own alignment row unchanged.</p>' +

    '<h4 class="gbemu-sub">The Color acid row (<code>cgb-acid-hell</code>: a site does exist, and the row still fails at 2 px)</h4>' +
    '<p class="gbemu-key"><b>The site is one increment in our own output path, and 118 of the 120 ' +
    'pixels close at zero measured cost.</b> The tempting conclusion is the opposite one: ' +
    'that the Color acid test is blocked because <em>no site exists</em> ' +
    'for an answer, on the evidence of 375 measurement arms moving zero pixels. That null is real ' +
    'and the conclusion drawn from it is not, which is the transferable part of this entry and the ' +
    'subject of appendix G.6. ' +
    '<b>The row still FAILS, at 2 px</b>, and contributes zero rows to the board (Rule 22/2). Section 11 carries ' +
    'the mechanism, the gate and the cost; what follows is the measurement underneath the ' +
    'diagnosis.</p>' +
    '<p class="hw-readable"><b>What the 120 px decomposes into, measured without section 11&rsquo;s ' +
    'increment.</b> Rows 136, 137 and 138 account for <b>118</b> of it, and on all three our row is ' +
    'the reference row <em>translated exactly four pixels left</em>: over the 156 columns ' +
    'where the comparison is defined, <code>ours[x] == ref[x+4]</code> gives zero mismatches, and no ' +
    'other shift comes within four. The cartridge sets <code>SCX&nbsp;=&nbsp;$B4</code>, so ' +
    '<code>SCX&nbsp;&amp;&nbsp;7&nbsp;=&nbsp;4</code>. <b>The displacement is exactly the fine ' +
    'scroll</b>, which is a decomposition and not yet a cause. The remaining <b>2</b> are a single ' +
    'colour exchange in one column, at <code>(68,80)</code> and <code>(69,80)</code>: ' +
    '<b>read those as (row, column), not (x, y)</b>, which is the opposite of the convention their ' +
    'shape suggests and is stated here because the whole of the next paragraph turns on the column ' +
    'being 80 and the rows being adjacent. (The check that catches the pair read the other way ' +
    'round is in the sentence after next: the tile covers screen x ' +
    '76&ndash;83, which 68 is not in.) They are ' +
    'the two that are still open. <b>INSTRUMENT-MEASURED</b> against the suite&rsquo;s own ' +
    'reference. <b>Falsifier:</b> any residual outside those five rows, or a shift other than 4 ' +
    'fitting the three.</p>' +
    '<p class="hw-readable"><b>The two survivors are characterised and deliberately NOT ' +
    'attributed.</b> Both lie in the background tile fetched at <code>fetch_x = 10</code>, whose ' +
    'eight pixels cover screen x 76&ndash;83; the low plane is identical to the reference on both ' +
    'rows, and the whole delta is <b>one bit of the high plane, bit 3</b>, on each row. On both rows ' +
    'the reference&rsquo;s implied high byte is numerically equal to the tile number for that fetch ' +
    '(<code>$55</code> and <code>$55</code>, <code>$49</code> and <code>$49</code>): <b>stated ' +
    'as a coincidence of two measured values and not asserted as its cause.</b> That fetch is the ' +
    'one on the line whose high-byte step landed on a dot where LCDC bit 4 had just been cleared; ' +
    'its two neighbours ran with the bit set. <b>NOT ESTABLISHED.</b> Two candidate structures ' +
    'differ only in <em>direction</em> (a glitch on the 1&rarr;0 write versus the 0&rarr;1 ' +
    'write) and this cartridge toggles the bit both ways every eight dots, so it is ' +
    'compatible with both. <b>What would establish it:</b> a probe cartridge holding LCDC bit 4 at ' +
    'one value across several tiles and making a <em>single</em> transition in a chosen direction, ' +
    'aligned to a chosen fetcher step, with a known tile number in the map. <b>One convenient ' +
    'non-candidate is measured out rather than argued away:</b> turning on the tile-select glitch ' +
    'this core carries leaves the row at 2 px, the same two pixels, unmoved.</p>' +
    '<p class="hw-readable">The measurement underneath it: without section 11&rsquo;s increment the Color acid test differs on ' +
    '<b>120 pixels</b>, and the interesting ' +
    'thing about it is the shape of the negative result. <b>375 arms were built and scored against ' +
    'that one cartridge</b>: all 204 guarded settings stepped both ways, the mask-valued ones ' +
    'swept by mask rather than by one, the structurally paired ones at legal pairs, and the 11 ' +
    'unguarded literals edited in place. <b>Pixels moved: zero. Not one, on any arm.</b> The master ' +
    'switch that disables the entire LCDC per-bit settling family moves nothing; the window origin ' +
    'moves nothing, in either direction.</p>' +
    '<p class="gbemu-key">The reason is worth more than the row. That cartridge is decided by ' +
    'mid-line LCDC writes and by where the window starts, and on the core the 375 arms were measured on <b>the whole LCDC settling ' +
    'family is guarded as original-Game-Boy-only</b>, so on a colour machine every per-bit width ' +
    'and the master switch above them collapse to a single unparameterised path. <b>The one ' +
    'cartridge on this board that stresses mid-line LCDC writes on a Color is the one cartridge ' +
    'that family cannot reach</b>, which is not a coincidence about the row; it is what that guard ' +
    'means, stated for once in terms of a board row.</p>' +
    '<p class="hw-readable"><b>The shipped core differs from the core the 375 arms were measured on.</b> On the core this site ships the settling family is <b>live</b> on a Color: the original&rsquo;s widths pass through the unresolved guard, and the Color carries its own widths for the window&rsquo;s data reads (10 low, 12 high) and its map read (92). The Colour tab&rsquo;s section 10 gives them with the tile-data select rules they serve. The zero-pixel result above belongs to the core it was taken on and has not been re-taken; the row&rsquo;s current figure is the 2&nbsp;px stated above.</p>' +
    '<p class="hw-readable">Keep the three apart, because they collapse back into &ldquo;declined&rdquo; ' +
    'the moment you stop writing them out. <b>It is not declined on price</b>: nothing was ' +
    'priced and nothing could be. <b>It is not unwinnable in principle</b>: the picture is ' +
    'determinate and there is a right answer. What the null invites you to write is the third: ' +
    '<b>blocked behind structure nobody has ' +
    'authorised</b>, a colour arm for that family, with a fitted value unable to buy it because a ' +
    'fitted value needs a site and there is none. <b>That last step is where it goes wrong.</b></p>' +
    '<div class="gbemu-rule" id="gbr-22-10"><b>Rule 22/10.</b> <em>A sweep of ' +
    'one axis establishes that that axis cannot win the row; it never licenses &ldquo;the row cannot ' +
    'be won&rdquo;.</em> Before a null from a sweep is read as a negative, list the structures that bear on the cartridge and are outside the registry the sweep enumerated.</div>' +
    '<div class="gbemu-why"><b>Why. Where that reasoning goes wrong, and it is not where you would ' +
    'guess.</b> The sweep is sound and its null is real: 375 arms moved zero pixels on this ' +
    'cartridge. <b>What is wrong is the sentence written on top of it</b>. ' +
    'Two structures bearing directly on this cartridge are outside the knob registry ' +
    'the sweep enumerated and were never armed at all, and <b>the one registered knob that does ' +
    'textually gate the statement the fix removes is byte-inert on this cartridge</b>. ' +
    'Measured, not assumed: building with it set produces a framebuffer identical to the control at ' +
    'all 65 checkpoints. So the honest form is not <em>&ldquo;no knob touches this line&rdquo;</em>; ' +
    'one does. It is: <b>the only knob on this line cannot move a pixel on the only cartridge that ' +
    'exercises it, so a sweep over the knobs could not have found this defect even though it stepped ' +
    'the right line.</b> A knob that cannot move a pixel is indistinguishable from a knob that is ' +
    'not wired, and <b>a registry that silently omits a structure produces nulls that read like ' +
    'negatives</b>.</div>' +

    '<h4 class="gbemu-sub">The transfer-versus-scan row: <code>strikethrough</code>, WON</h4>' +
    '<p class="gbemu-key"><b><code>ashiepaws/strikethrough.gb</code> passes at 0 differing pixels.</b> Two ' +
    'things close it, and <b>they are separable and are ' +
    'separately measured</b>: the scan-latch mechanism, and the grip phase. Section 5 carries both ' +
    'in full, with their labels and denominators.</p>' +
    '<p class="hw-readable"><code>strikethrough</code> is about what the picture processor reads ' +
    'from sprite memory while a transfer is running across the scan. The obvious attack is to ' +
    'register rival explanations (six of them fit) and photograph a real console to ' +
    'choose between them.</p>' +
    '<p class="gbemu-key"><b>The question those six rivals answer (<em>which object ' +
    'survives</em>) turns out not to be a question about the hardware at all.</b> Two ' +
    'independent codebases produce identical pixels on this cartridge while attributing the bar to ' +
    'different object indices, and an index cannot be read off the pixels: the bar&rsquo;s pixel position ' +
    'is shared by two objects, because that cartridge&rsquo;s X spacing wraps at 256. <b>The rule is ' +
    'structural and carries no fitted constant:</b> while a transfer holds the bus the scan performs ' +
    'no read, the shared byte latches hold their previous contents, all forty slots test against one ' +
    'stale Y, and the ten-object cap fills with ten copies of one position. The single bar is ' +
    'a product of ten fetches walking the transfer&rsquo;s write cursor, not of one survivor. ' +
    'Section 5 has it in full, together with the finding that the bench cartridge built for the ' +
    'which-object question cannot answer it.</p>' +
    '<p class="gbemu-key"><b>What closes it, in two parts, because a reader who implements ' +
    'only the first will land halfway.</b> With the scan-latch mechanism and without the grip phase, this cartridge goes from 7 differing pixels to <b>0</b>, nothing else on the board moves ' +
    ', and <b>11 of 35</b> self-checking transfer cartridges still fail, ' +
    '<em>exactly the eleven that fail with neither part</em>. Not one of the eleven moves. <b>That ' +
    'null is the measurement that proves there is a second, separable question</b>, and the second ' +
    'question is <em>when</em> the transfer takes the bus. Section 5 states it as a bound rather ' +
    'than a value. <b>INSTRUMENT-MEASURED</b>, 264-row byte comparison plus a 35-cartridge corpus. ' +
    '<b>Falsifier:</b> the mechanism alone moving any of the eleven.</p>' +
    '<div class="gbemu-rule" id="gbr-22-11"><b>Rule 22/11.</b> <b>Before you build a stimulus, state your two hypotheses as different bytes in the ' +
    'cartridge&rsquo;s own memory, and show the stimulus produces them.</b></div>' +
    '<div class="gbemu-example"><b>Example.</b> A cartridge whose ' +
    'transfer source is byte-identical to its destination cannot distinguish stale from fresh, ' +
    'however many alignments you sweep: under both hypotheses the bytes the scan sees are the same.</div>' +
    '<div class="gbemu-why"><b>Why. The lesson this row is for, which is not about sprite ' +
    'memory.</b> The question everybody answers first (' +
    '<em>which object survives</em>) has no answer: rival rules registered against it are registered against a ' +
    'quantity the screen does not carry. The check of Rule 22/11 costs minutes and is standing practice ' +
    'here.</div>' +

    '<h4 class="gbemu-sub">And a category, not a row: anything that declares itself revision-dependent</h4>' +
    '<div class="gbemu-rule" id="gbr-22-12"><b>Rule 22/12.</b> Matching the declared table of a cartridge that declares itself revision-dependent is <b>convergence at best, ' +
    'never derivation</b>, and it must be labelled that way <em>before</em> anyone spends on it.</div>' +
    '<div class="gbemu-why"><b>Why.</b> Several sound cartridges say in their own headers that their behaviour ' +
    '<i>&ldquo;appears to be different across revisions&rdquo;</i>, and their declared table is one ' +
    'revision&rsquo;s output. Three frequency-change variants ship side by side of which <b>at most ' +
    'one can be correct for any one machine</b>. ' +
    'None of them is a board row here, which is the only reason they cost nothing.</div></section>' +

  /* ---------------------------------------------------------------- 12 */
  '<section class="sect" id="gbe-12"><h3 class="sect-h">23. The evidence</h3>' +
    '<p class="hw-readable">All twenty-four scoreable original-Game-Boy cartridges in the mealybug ' +
    'tearoom suite, rendered by the core described above, at <b>0 differing pixels of 23,040</b> ' +
    'on every one. Each frame below is 160&times;144, exactly as the core emitted it.</p>' +
    '<p class="hw-readable"><b>What that claim is, precisely.</b> The images everyone scores ' +
    'against are the suite author&rsquo;s own emulator&rsquo;s renders, published with his own ' +
    'hedge: <i>&ldquo;screenshots from my Game Boy emulator (which I believe to be ' +
    'correct)&rdquo;</i>. Photographs of real hardware are a <em>separate</em> directory. So this ' +
    'is <b>0 px against the suite&rsquo;s reference renders</b>, and not a measurement against ' +
    'silicon. The badge on each frame says whether a <em>readable</em> photograph of that cartridge ' +
    'on a real Game Boy exists behind the reference: seven do, fourteen are glare-blown or ' +
    'tonally flat, two have no photograph anywhere and one is undecided. That badge says an image ' +
    'exists. It does not say any number here was scored against it; none were.</p>' +
    '<p class="gbemu-key"><b>And one place where 24 of 24 is known to prove nothing.</b> ' +
    'These references are four-shade images, and a shade is not a colour: at one locus that has ' +
    'been checked, the reference paints an intermediate row and the row beneath it ' +
    'in the <em>same shade</em>, while the colour machine&rsquo;s reference paints them as two ' +
    'different colours, and photographs of real hardware show the intermediate row is ' +
    'genuinely there. So a core that omits that row and a core that draws it produce ' +
    '<em>identical</em> output against this reference. Zero differing pixels there is not a pass ' +
    'and not a failure; the reference cannot resolve the question. That locus was found by looking ' +
    'at it directly. How many other loci behave the same way is not known, ' +
    'and no score on this page can tell.</p>' +
    '<p class="gbemu-key"><b>And one more thing that silently invalidates a score, which nothing in ' +
    'the suite tells you.</b> Its specified starting condition is <em>after the boot program has ' +
    'run</em>, and the boot program leaves residue in video memory. Measured on a core on which <code>m3_scy_change</code> itself failed by about 10,800&nbsp;px, <b>ten of the 24 cartridges are residue-dependent</b> (a count not re-taken on the shipped core, where that cell passes), and what they carry between them ' +
    'is <b>two different figures at two different bases, which must never be swapped</b>: at the ' +
    'base this section was written on, <b>3,423 differing pixels (nineteen per cent of that ' +
    'board of 17,825)</b>; re-derived from the two committed origin files, ' +
    '<b><code>79,670 &minus; 76,189 = 3,481 px net</code></b>, which is the figure appendices G.4 ' +
    'and G.6 quote. None of it is picture-processor error, and one cartridge&rsquo;s 540 px ' +
    'is entirely an artefact of the harness. The ' +
    'heaviest are not the obvious one: four of them draw mostly their own tiles and lean on the ' +
    'residue only for part of the frame, which is exactly the case that reads like a rendering ' +
    'defect and is not. <b>The fourteen that did not move are worth as much as ' +
    'the ten</b>, because ' +
    'they are confirmed independent of boot state.</p>' +
    '<div class="gbemu-rule" id="gbr-23-1"><b>Rule 23/1.</b> Never sum or average a post-boot score ' +
    'against a cold-start one, and say which of the two you took.</div>' +
    '<div class="gbemu-rule" id="gbr-23-2"><b>Rule 23/2.</b> When quoting the boot residue, say which of its three figures you are quoting, every time: 3,423 px (at a board total of 17,825), 3,481 px (the net difference between the two committed origin files) or 3,827 px (the sum of absolute movements).</div>' +
    '<div class="gbemu-why"><b>Why. The reconciliation is more ' +
    'useful than either number.</b> <b>The cell count is ten</b>, and the tenth is the easy one to ' +
    'miss: <code>m3_scy_change</code> is the ' +
    '<em>only</em> cell the boot program makes <b>worse</b> (10,788 &rarr; 10,961, a loss of 173 px), ' +
    'so a <em>&ldquo;residue makes cells read high&rdquo;</em> framing has no slot to put it in. ' +
    '<b>The two pixel figures are both correct and are not the same measurement</b>: 3,481 is ' +
    'the net difference between the two committed origin files and reconciles exactly by ' +
    'subtraction with no build and no boot program needed; 3,423 was taken at a different board ' +
    'total. <b>And a third figure belongs beside them so the pair cannot be ' +
    'misread as a discrepancy: the sum of <em>absolute</em> movements is 3,827, against a net of ' +
    '3,481.</b></div>' +
    '<div class="gbemu-grid">' + cells + '</div>' +
    '<h4 class="gbemu-sub">And it plays real cartridges</h4>' +
    '<p class="hw-readable">Passing a test suite is not the same as running software. These eight ' +
    'commercial titles were booted from cold on this same core, in this browser, and captured ' +
    'where they landed.</p>' +
    '<div class="gbemu-grid gbemu-grid-carts">' + carts + '</div>' +
    '<div class="factbox" style="margin-top:18px">' +
      '<div class="row"><span class="k">Runs as</span><span class="v">WebAssembly, in your browser, on its own worker thread</span></div>' +
      '<div class="row"><span class="k">Timing</span><span class="v">Dot-level: the pipeline is modelled per dot, not per scanline</span></div>' +
      '<div class="row"><span class="k">Screen</span><span class="v">160 &times; 144, four shades, integer-scaled only</span></div>' +
      '<div class="row"><span class="k">Also passes</span><span class="v">dmg-acid2 pixel-perfect; Blargg; Mooneye; 258 of 264 board rows: section 21</span></div>' +
    '</div>' +
    '<p class="hw-readable" style="margin-top:12px">The palette selector above the screen is a ' +
    'display choice and nothing more. The core emits shade <em>indices</em>; every figure on this ' +
    'page is scored on those indices, so changing the skin cannot move a single number here.</p>' +
  '</section>' +

  '<section class="sect" id="gbe-labels"><h3 class="sect-h">Appendix F. Labels, flexibility, and what is not established</h3>' +
    '<p class="hw-readable">This appendix gives claims on this page a label that says how each is known, and lists ' +
    'the places where a build may differ from ours and still pass. In order: the label vocabulary (F.1, with the ' +
    'finer appendix words mapped onto it in F.1.1); the count of labels (F.2); the four labels that most change how ' +
    'a section reads (F.3); <b>eighty-seven claims</b> from sections 7 to 14 and 18 to 20, each with the label its ' +
    'evidence actually supports (F.4 to F.7); the flexibility register, the places where a developer may ' +
    'legitimately build something different and still pass (F.8); and a separately counted label table for ' +
    'sections 1 to 4 and 6 (F.9). Section 20 publishes the label table and sections 5 and 15 to 17 apply it ' +
    'rigorously.</p>' +
    '<p class="gbemu-key"><b>Sections 1 to 4 and 6 are labelled separately, in F.9</b>, as a ' +
    'separately counted table: separately because F.2&rsquo;s 87 rows and 97 assignments ' +
    'are a count of the F.4 to F.7 sweep, and folding fifteen more rows into it would make a ' +
    'published figure move for a reason that has nothing to do with the sweep that produced it. ' +
    '<b>That F.4 to F.7 label sections 7 to 14 and 18 to 20 while F.9 labels sections 1 to 4 and 6 is a division of ' +
    'the work, not a statement of confidence.</b></p>' +

    '<h4 class="gbemu-sub">F.1: The vocabulary</h4>' +
    '<p class="hw-readable">The six labels in this table are the <b>page vocabulary</b>, and they are the words F.2 ' +
    'and F.9 count. Each row defines one label: a claim carrying it asserts what the second column says. The third ' +
    'column gives the word section 20&rsquo;s label table uses for the same thing.</p>' +
    '<table class="gbemu-table" id="gbe-labels-vocab"><thead><tr><th>Label</th><th>Definition: what a claim carrying this label asserts</th><th>Section 20&rsquo;s word</th></tr></thead><tbody>' +
      '<tr><td><b>MECHANISM</b></td><td>Follows from a rule already stated, from a document, or from a cartridge&rsquo;s own declaration. It predicts things not yet measured.</td><td>DERIVED</td></tr>' +
      '<tr><td><b>HARDWARE-OBSERVED</b></td><td>Scored against what a real console put out, with apparatus, sample count <b>and whose silicon</b> named.</td><td>OBSERVED</td></tr>' +
      '<tr><td><b>INSTRUMENT-MEASURED</b></td><td>Scored on <em>our own</em> core or corpus with a named instrument and a printed denominator. <b>A fact about our emulator, not about hardware.</b> Distinct from HARDWARE-OBSERVED (Rule F.1/1).</td><td>INSTRUMENT-MEASURED</td></tr>' +
      '<tr><td><b>CONVERGENCE</b></td><td>Matched to another implementation&rsquo;s output, or read off its structure. Legitimate; not a derivation.</td><td>CONVERGENCE</td></tr>' +
      '<tr><td><b>FITTED</b></td><td>Swept until a test passed. The number is stated outright and called fitted (Rule F.1/2).</td><td>FITTED</td></tr>' +
      '<tr><td><b>NOT ESTABLISHED</b></td><td>The record does not settle it. The claim says what would (Rule F.1/2).</td><td>NOT ESTABLISHED</td></tr>' +
    '</tbody></table>' +
    '<div class="gbemu-rule" id="gbr-F-1-1"><b>Rule F.1/1.</b> Each label on this page must be used only in the sense ' +
      'the F.1 table gives it. A claim labelled INSTRUMENT-MEASURED is a fact about our emulator or our corpus and must ' +
      'never be presented as HARDWARE-OBSERVED.</div>' +
    '<div class="gbemu-why"><b>Why.</b> Both labels name a scored result; only HARDWARE-OBSERVED is a fact about ' +
      'hardware. Most of what looks like measurement on this page is measurement of this emulator (F.2).</div>' +
    '<div class="gbemu-rule" id="gbr-F-1-2"><b>Rule F.1/2.</b> A claim labelled FITTED must state its number ' +
      'outright and say that it was fitted. A claim labelled NOT ESTABLISHED must say what would establish it.</div>' +
    '<div class="gbemu-why"><b>Why NOT ESTABLISHED earns a row of its own.</b> An implementer told that a fitted ' +
      'value is derivable will hunt for a derivation that does not exist, and will either stall or invent one. ' +
      '<b>A named gap costs the reader five minutes; a mislabelled constant costs weeks.</b> A vocabulary with no ' +
      'word for a gap forces every gap into one of the other labels.</div>' +
    '<div class="gbemu-rule" id="gbr-F-1-3"><b>Rule F.1/3.</b> Passing a Mooneye cartridge is HARDWARE-OBSERVED ' +
      '<b>on someone else&rsquo;s silicon</b>, and the claim&rsquo;s denominator clause must say so. Matching a ' +
      'mealybug expectation is <b>CONVERGENCE, never OBSERVED</b> (never HARDWARE-OBSERVED). This holds for every ' +
      'mealybug-derived constant on the page, including several in appendix E.</div>' +
    '<div class="gbemu-why"><b>Why.</b> Mooneye cartridges declare their own expected results, authored against ' +
      '<em>their</em> author&rsquo;s hardware. <b>mealybug expectations are the suite author&rsquo;s own emulator ' +
      'renders.</b> Section 23 says this about the pixel figures; this rule applies it to every mealybug-derived ' +
      'constant.</div>' +
    '<p class="gbemu-key"><b>F.1.1: the second vocabulary, mapped rather than denied.</b> ' +
    '<b>Sections 15 to 17 and ' +
    'appendices B and E also use a finer set of words</b>, which is not a competing scheme and is not sloppy ' +
    'usage: an appendix that states one constant needs to say more about that one constant than a ' +
    'six-word scheme can carry. <b>What matters is that they are mapped</b>: a reader who meets ' +
    '<code>BOUNDED, NOT VALUED</code> has somewhere to look it up, and can tell whether it ' +
    'is a seventh label or a phrase. Each row below says which of the six it lives under and what ' +
    'it adds.</p>' +
    '<table class="gbemu-table"><thead><tr><th>Appendix word</th><th>Lives under (F.1 label)</th><th>What it adds</th></tr></thead><tbody>' +
      '<tr><td><code>DERIVED</code> (bare)</td><td>MECHANISM</td><td>F.1 says MECHANISM <em>is</em> this page&rsquo;s word for it, and outside sections 15&ndash;17 that holds. <b>Section 17 is the exception and it is deliberate:</b> <em>&ldquo;DERIVED against our own corpus &hellip; not MECHANISM&rdquo;</em> means the structure follows from a model whose <em>terms were fixed against our own declared tables</em>. It therefore does <b>not</b> predict outside that corpus, which is the thing MECHANISM claims. Read it as MECHANISM in form with an INSTRUMENT-MEASURED reach.</td></tr>' +
      '<tr><td><code>MEASURED</code> (bare)</td><td>INSTRUMENT-MEASURED</td><td>Used in F.9&rsquo;s divider row, where the point of the row is that the <em>what</em> is measured and the <em>why</em> is not. F.9 counts it; F.2 has no occurrence of it.</td></tr>' +
      '<tr><td><code>CARTRIDGE-DECLARED</code></td><td>MECHANISM</td><td>The rule comes from a cartridge&rsquo;s own asserted table. Under Rule F.1/3 this is also HARDWARE-OBSERVED <em>on someone else&rsquo;s silicon</em>, which is why it gets its own word rather than being filed as an observation of ours.</td></tr>' +
      '<tr><td><code>DECLARED BY OUR OWN CORPUS</code></td><td>INSTRUMENT-MEASURED</td><td>Stronger than convergence and weaker than derivation: several of <em>our</em> declared cells independently require the term, so ablating it breaks them. It is a fact about the corpus.</td></tr>' +
      '<tr><td><code>BOUNDED, NOT VALUED</code></td><td>NOT ESTABLISHED, with a measured envelope</td><td>The evidence fixes an interval and cannot fix a point. <b>It obliges the shipped representative to be stated wherever the quantity appears</b>: in B.15, two readings of one quantity both pass the suite, so only the stated representative tells a reader which one ships.</td></tr>' +
      '<tr><td><code>FORCED in kind, READ OFF in value</code></td><td>MECHANISM for the structure; CONVERGENCE for the number</td><td>Two labels on one quantity. What is forced is that the thing exists and how many of it there are; the number depends on the reader&rsquo;s own call site and must be re-derived, never copied.</td></tr>' +
      '<tr><td><code>NOT PINNED</code>, <code>NOT FULLY SETTLED</code>, <code>NOT DERIVED</code>, <code>UNMEASURED</code>, <code>NOT MEASURED</code></td><td>NOT ESTABLISHED</td><td>Five shadings of one label, distinguishing <em>why</em> it is not established: no site chosen, more than one reading survives, the account is missing, nothing in the corpus exercises it, and no instrument has been pointed at it. <b>All five are NOT ESTABLISHED for counting purposes</b> and none of them is a weaker word for it.</td></tr>' +
      '<tr><td><code>NOT RECONCILED</code></td><td>NOT ESTABLISHED, about a set rather than a value</td><td>Two or more figures the page states cannot all be right and the page cannot say which is wrong. Section 20&rsquo;s census carries the live instance.</td></tr>' +
      '<tr><td><code>DECLINED</code></td><td>not a label at all: a decision</td><td>We know what the alternative is and are not taking it, with the cost written down. It says nothing about evidence and must never be read as one of the six.</td></tr>' +
      '<tr><td><code>READ FROM OUR OWN SOURCE</code></td><td>INSTRUMENT-MEASURED</td><td>A fact about what this emulator does, established by reading its code rather than by scoring it. Weaker than a measurement of the emulator and much weaker than one of hardware; used where the page owes an implementer our literal.</td></tr>' +
    '</tbody></table>' +
    '<div class="gbemu-rule" id="gbr-F-1-1-1"><b>Rule F.1.1/1.</b> A finer word may <em>add</em> to one of the six ' +
      'and must never <em>replace</em> it. A phrase that cannot be said to live under one of the six is not a label: ' +
      'it is prose, and it must not be typeset as though it were a label.</div>' +
    '<div class="gbemu-rule" id="gbr-F-1-1-2"><b>Rule F.1.1/2.</b> F.2 counts the six F.1 words only. F.9 counts ' +
      'the six and one extension, the bare <code>DERIVED</code> and <code>MEASURED</code> of its divider row, which ' +
      'Rule F.9/2 states with its reason.</div>' +
    '<div class="gbemu-why"><b>Why.</b> The rule that comes with the map is the one to copy: the finer words exist ' +
      'to say more about one constant, and a count only means something while every word it counts is one of a ' +
      'fixed, defined set.</div>' +

    '<h4 class="gbemu-sub">F.2: The count</h4>' +
    '<div class="gbemu-rule" id="gbr-F-2-1"><b>Rule F.2/1. The counting rule.</b> A label assignment is one ' +
      'occurrence of a label word in the Label column of a row of F.4 to F.7. <b>Every occurrence of a ' +
      'label word in a row&rsquo;s Label column counts once, and the label words are exactly the six ' +
      'in F.1.</b> Words in the Claim and On-what columns never count. A row whose claim is two claims ' +
      'wearing one sentence gets both labels, and both count.</div>' +
    '<div class="gbemu-example"><b>Example.</b> The row for section 11&rsquo;s &ldquo;at counter 0 it evaluates ' +
      '&minus;1&rdquo; (F.5) carries MECHANISM, NOT ESTABLISHED and CONVERGENCE in its Label column: one row, ' +
      'three assignments. The row for section 7&rsquo;s +6 at a window takeover (F.4) carries MECHANISM + ' +
      'INSTRUMENT-MEASURED: one row, two assignments. The row for the input-latch dot within a two-dot fetcher step ' +
      '(F.4) says in its On-what column what would establish it, and still counts once, as FITTED, and never as ' +
      'NOT ESTABLISHED (Rule F.7/1).</div>' +
    '<div class="gbemu-why"><b>Why.</b> Claims and assignments are different quantities, and a page that does not ' +
      'say which of the two it is quoting can carry two incompatible figures side by side for a long time without ' +
      'either of them looking wrong. That a two-claim row gets both labels, the appendix says in three places.</div>' +
    '<p class="hw-readable"><b>Label assignments, not claims</b>: counted from the ' +
    'enumeration in F.4 to F.7 under Rule F.2/1, and it sums to ' +
    '<b>97 across 80 labelled rows of 87</b>. Of the enumeration&rsquo;s <b>87 rows</b>, <b>7</b> carry no label ' +
    '(design rules, definitional statements, an implementation choice and one withdrawal); the remaining ' +
    '<b>80</b> carry <b>97 label assignments</b>, because <b>15</b> of them carry more than one (thirteen ' +
    'carrying two and two carrying three, an <b>excess of 17</b> over one per row). Count assignments and claims ' +
    'separately or this table will not close: the two totals differ by the excess and are not ' +
    'interchangeable.</p>' +
    '<table class="gbemu-table"><thead><tr><th>Label</th><th>Assignments (occurrences in the Label columns of F.4 to F.7), or rows where the first column says rows or claims</th></tr></thead><tbody>' +
      '<tr><td>MECHANISM</td><td><b>57</b></td></tr>' +
      '<tr><td>INSTRUMENT-MEASURED</td><td><b>17</b></td></tr>' +
      '<tr><td><b>NOT ESTABLISHED</b></td><td><b>8</b></td></tr>' +
      '<tr><td>CONVERGENCE</td><td><b>7</b></td></tr>' +
      '<tr><td>FITTED</td><td><b>6</b></td></tr>' +
      '<tr><td>HARDWARE-OBSERVED</td><td><b>2</b></td></tr>' +
      '<tr><td><b>Total assignments</b></td><td><b>97</b></td></tr>' +
      '<tr><td>Rows carrying no label</td><td>7</td></tr>' +
      '<tr><td>Rows carrying more than one</td><td><b>15</b></td></tr>' +
      '<tr><td>of those, rows carrying three</td><td><b>2</b></td></tr>' +
      '<tr><td>Excess assignments over labelled rows</td><td><b>17</b></td></tr>' +
      '<tr><td><b>Claims enumerated</b></td><td><b>87</b></td></tr>' +
    '</tbody></table>' +
    '<div class="gbemu-rule" id="gbr-F-2-2"><b>Rule F.2/2.</b> A check of this table must recount <em>every</em> ' +
      'figure in it (the six label rows, the total, the unlabelled, the multi-label, the three-label and the ' +
      'excess) out of the Label columns of F.4 to F.7, and must re-derive every relation it asserts from those ' +
      'tables, never from the figures this table carries.</div>' +
    '<div class="gbemu-example"><b>Example.</b> The arithmetic that holds is <b>80 labelled + 17 excess = 97 ' +
      'assignments</b>, and <b>80 + 7 unlabelled = 87 claims</b>. 17 is the <em>excess</em> (the assignments ' +
      'beyond one per labelled row), not the 15 rows that carry more than one label. <b>80 + 15 = 97</b> is not a ' +
      'relation this table has (80 + 15 is 95): <code>labelled + multi = assignments</code> is only true while no ' +
      'row carries three labels, and two rows here do, so a check asserting it passes on the wrong figure and ' +
      'rejects the right one.</div>' +
    '<div class="gbemu-why"><b>Why.</b> The 17 is the figure most easily filed in the wrong row, which is why it ' +
      'has a row of its own. The figures check (appendix G.7) recounts every figure in this table out of the ' +
      'F.4&ndash;F.7 tables rather than believing any of them. The general form is worth more than the instance: ' +
      '<em>a relation asserted by a check must itself be re-derived from the table, not from the figure the table ' +
      'currently carries.</em></div>' +
    '<div class="gbemu-rule" id="gbr-F-2-3"><b>Rule F.2/3.</b> The FITTED figure counts rows, not values: six of ' +
      'the eighty-seven rows carry FITTED in their Label column. A build that needs the fitted constants rather ' +
      'than the count must take them from appendix E, where each is stated outright beside its value.</div>' +
    '<div class="gbemu-why"><b>Why.</b> Count the fitted values named in the <em>notes</em> as well and the set is ' +
      'different and larger, which is why the two figures are not interchangeable. A count of fitted values is a ' +
      'fact about this appendix, and the values are facts about the emulator.</div>' +
    '<div class="gbemu-rule" id="gbr-F-2-4"><b>Rule F.2/4.</b> A figure taken from this table must be quoted ' +
      'against this table&rsquo;s denominator: the claims of sections 7 to 14 and 18 to 20, which is ' +
      'eleven sections.</div>' +
    '<div class="gbemu-example"><b>Example.</b> <b>Only two claims in eleven sections are hardware ' +
      'observations.</b> One of the two HARDWARE-OBSERVED rows sits in section <b>18</b> (F.7). Quote the same two ' +
      'against the eight sections 7 to 14 and the sentence is false while its numerator still checks out.</div>' +
    '<div class="gbemu-why"><b>Why.</b> The two hardware observations in eleven sections are the most useful single ' +
      'number in this appendix: most of what looks like measurement on this page is measurement <em>of this ' +
      'emulator</em>. <b>A denominator quoted from memory beside a numerator read off a table is how a true figure ' +
      'ends up saying a false thing</b>, and it is the shape this appendix is least able to catch.</div>' +

    '<h4 class="gbemu-sub">F.3: The four relabellings that matter most</h4>' +
    '<ul class="gbemu-bullets">' +
      '<li><b>The three-of-eight object window is CONVERGENCE, not mechanism.</b> It comes from two ' +
        'other implementations agreeing and from an instrument pointed at our own fetcher; no ' +
        'hardware document states three. <b>Its position: the window ends just before the push</b>; two ' +
        'three-dot windows fit the measurement. Appendix E.3 carries both the width and the position, and it ' +
        'carries the non-circular argument for the position rather than the circular one our own source uses.</li>' +
      '<li><b>&ldquo;A write is gated roughly a machine cycle behind a read&rdquo; is two claims ' +
        'wearing one sentence.</b> Access blocking and value delivery are different quantities; the ' +
        'first is <b>6 dots</b> and the second is explicitly per-register, with one value&rsquo;s ' +
        'corroboration formally withdrawn and two more declared open. Appendix E.1.5 separates ' +
        'them. <b>And our records disagree with the code rather than with each other</b>: ' +
        '<em>three</em> of them say &ldquo;one machine cycle&rdquo; and the code beside them ' +
        'implements 6, so they are all wrong the same way.</li>' +
      '<li><b>The 11 and the 6 in <code>11 + 6(N&minus;1)</code> have completely different ' +
        'backing.</b> The 11 is the most strongly evidenced number on this page: silicon, ' +
        'blind, pre-registered, two cartridges and three devices. <b>The 6 has never been ' +
        'photographed by anyone</b> and our own consolidation says so in as many words. Section 12 ' +
        'states them as two figures (F.6 gives each its label).</li>' +
      '<li><b>The cost of the unsigned-counter clamp is INSTRUMENT-MEASURED, and it is not a misplaced window.</b> ' +
        'Section 18 (Rule 18/3) warns against the clamp with the measured cost. ' +
        'The clamp was <em>built, pre-registered and measured</em>: it fires on exactly the ' +
        'right rows (90 fires on lines 0 to 7 and nowhere else) and it reads ' +
        '<b>7 px fixed against 30,630 created, five passing cells destroyed</b>, two of them into ' +
        'five figures. <b>Acting in exactly the right place is not evidence that the action is ' +
        'right.</b> It draws a window on rows that have none.</li>' +
    '</ul>' +

    '<h4 class="gbemu-sub">F.4: Sections 7 to 9</h4>' +
    '<p class="hw-readable">F.4 to F.7 give one row per claim. The Claim column starts with the number of the section the claim is from; the Label column is the only column Rule F.2/1 counts; the On-what column gives the evidence.</p>' +
    '<table class="gbemu-table"><thead><tr><th>Claim (section number first)</th><th>Label</th><th>On what</th></tr></thead><tbody>' +
      '<tr><td>7: a scanline is 456 dots</td><td>MECHANISM</td><td>Fixed by the master clock and the frame: 456 &times; 154 = 70,224 at 59.7275 fps. It exists nowhere as a value to sweep.</td></tr>' +
      '<tr><td>7: mode 2 is a fixed 80</td><td>MECHANISM</td><td>Forty entries at two dots each. The 80 is a product, not an input.</td></tr>' +
      '<tr><td>7: mode 3 runs between 172 and 289</td><td><b>CONVERGENCE</b> for the bounds; MECHANISM that it is an output</td><td>Our own specification grades the pair as tier 2: documentation plus our probe corpus. <b>Neither bound is a measurement of hardware and neither exists in our core as a literal.</b> The stronger adjacent claim (mode 3 has no length) is the mechanism and is what the section is for.</td></tr>' +
      '<tr><td>7: +12 dots minimum, two 6-dot fetches</td><td>MECHANISM (documented)</td><td>The high-plane step carries its own push opportunity, so the priming fetch completes after 6 dots rather than 8. <b>One clarification the page owes:</b> our explicit early-push flag is deliberately <em>not</em> applied at line open, because the 12-dot prime already accounts for it; it exists only for the window takeover, where the queue state is not structurally empty.</td></tr>' +
      '<tr><td>7: <code>+ (SCX &amp; 7)</code></td><td>MECHANISM</td><td>The dots follow from the pixels dropped. <b>The dot on which the discard is latched is a separate, fitted matter</b> (appendix E.1).</td></tr>' +
      '<tr><td>7: +6 at a window takeover</td><td>MECHANISM + INSTRUMENT-MEASURED</td><td>Measured at the site: without the early push the switch costs 8, with it 6. A derivation from documentation contradicts it, and the measurement stands: <b>a derivation from documentation is not corroboration of a measurement; it is a second claim the measurement can refute.</b></td></tr>' +
      '<tr><td>7: no priming fetch at a takeover</td><td>MECHANISM</td><td>Structural, and both halves are sourced above.</td></tr>' +
      '<tr><td>7: +6 to +11 per sprite</td><td>MECHANISM (emergent)</td><td>An output of the phase wait, but the window width underneath it is CONVERGENCE and the 6 inside it has never been photographed.</td></tr>' +
      '<tr><td>7: &ldquo;if you have to add a penalty as a special case, the mechanism is wrong&rdquo;</td><td>design rule</td><td>Correctly framed as advice; no label needed.</td></tr>' +
      '<tr><td>8: four dots per machine cycle, same clock as the timer</td><td>MECHANISM</td><td>Definitional: one T-cycle is one dot.</td></tr>' +
      '<tr><td>8: about 70,224 dot steps per frame</td><td>MECHANISM</td><td>456 &times; 154.</td></tr>' +
      '<tr><td>8: &ldquo;on real hardware the write happens between two dots&rdquo;</td><td><b>NOT ESTABLISHED</b> as a hardware statement</td><td>No document or capture in our record says a processor write lands between two dots. <b>What it can carry:</b> the model must be able to place a write at dot granularity, because the delivery phase differs per register and is not one number. That is true, useful and defensible.</td></tr>' +
      '<tr><td>9: five steps, four of two dots, the fifth retried</td><td>MECHANISM, <b>and a point of legitimate flexibility</b></td><td>The 8-dot steady cycle and the retry-until-empty push are required; the five-named-step decomposition is one internal structure among several. Register F2 below.</td></tr>' +
      '<tr><td>9: map select from LCDC bits 3 and 6</td><td>MECHANISM</td><td>Register definition; scored pixel-exact by dmg-acid2.</td></tr>' +
      '<tr><td>9: background coordinates and their masks</td><td>MECHANISM</td><td>The masks are the map&rsquo;s own dimensions: 32 &times; 32 tiles, 256-pixel wrap.</td></tr>' +
      '<tr><td>9: LCDC bit 4 selects unsigned or signed addressing</td><td>MECHANISM</td><td>Register definition; four test cartridges score it.</td></tr>' +
      '<tr><td>9: the high-plane step attempts a push</td><td>MECHANISM (documented)</td><td>Same source as the 12-dot prime.</td></tr>' +
      '<tr><td>9: the two data reads are separate events two dots apart</td><td>MECHANISM</td><td>Follows from the step lengths; it is what every mid-line rewrite cartridge is built to provoke.</td></tr>' +
      '<tr><td>9: blocked reads return <code>0xFF</code>, the fetcher&rsquo;s too</td><td>MECHANISM for the processor&rsquo;s reads; <b>not so</b> for the fetcher&rsquo;s</td><td>Bus behaviour, scored by the access-window rows. Our core never blocks the fetcher&rsquo;s own reads (section 9).</td></tr>' +
      '<tr><td>9 (<em>not stated in section 9</em>): the dot within a two-dot step at which that step&rsquo;s register inputs are latched</td><td><b>FITTED</b>, shipped at 1</td><td>Our own note is unambiguous: <em>fitted, deliberately not mechanism; nothing derives the one-dot lead; a precedent is not a derivation; a score selects it.</em> <b>It ships at 1</b>, with a compile-time error forbidding the value 2 as a falsifier aimed at an arm that switches nothing. Appendix E.3.3 carries it. <b>To establish:</b> a document or a device pinning the input-latch dot within a two-dot fetcher step.</td></tr>' +
    '</tbody></table>' +

    '<h4 class="gbemu-sub">F.5: Sections 10 and 11</h4>' +
    '<table class="gbemu-table"><thead><tr><th>Claim (section number first)</th><th>Label</th><th>On what</th></tr></thead><tbody>' +
      '<tr><td>10: two queues, mixed at the pop, both cleared at the start of drawing</td><td>MECHANISM</td><td>Structural; the clear at mode-3 entry is what makes the line&rsquo;s opening state reproducible.</td></tr>' +
      '<tr><td>10: each pixel carries colour, palette and two priority bits</td><td><b>our implementation choice</b></td><td>On the original machine the merge needs less. Register F1 gives the invariant.</td></tr>' +
      '<tr><td>10: eight pixels is the most either holds</td><td>MECHANISM</td><td>The push fires only into an empty queue, so a second push cannot stack on a first; eight per eight dots is what makes output continuous at one pixel per dot.</td></tr>' +
      '<tr><td>10: the storage is sixteen slots wide</td><td><b>NOT ESTABLISHED</b> as anything about hardware</td><td>The only warrant for 16 anywhere in our record is the array declaration itself, which is the weakest warrant we recognise. And we measured that the depth buys nothing: a 16-deep variant pushing whenever there is room for 8, rather than only when empty, <b>changed nothing at all</b>. The invariant is occupancy &le; 8.</td></tr>' +
      '<tr><td>10: the sprite/background merge rule</td><td>MECHANISM</td><td>Register-defined; dmg-acid2 scores it pixel-exact and names the two failures by title when it is wrong.</td></tr>' +
      '<tr><td>10: background disabled forces colour 0</td><td>MECHANISM</td><td>LCDC bit 0 on the original machine.</td></tr>' +
      '<tr><td>10: colour 0 means two different things</td><td>MECHANISM</td><td>Definitional, and the reason one wrong bit reads as two faults.</td></tr>' +
      '<tr><td>11: a frame-scoped Y condition latches and clears at the vertical blank</td><td>MECHANISM for the latch; <b>FITTED</b> for how we evaluate it</td><td>Our core evaluates the arming condition <b>every dot</b> and <b>conjunctively with window-enable</b>, and its own registration says <em>no hardware statement conditions the arming latch on window-enable; a precedent is not a derivation and neither is self-consistency.</em> The ground is compatibility: 26 probe cartridges clear the enable during drawing and 17 showed this core over-arming.</td></tr>' +
      '<tr><td>11: seven increments before the first pixel</td><td>The <b>seven</b> is MECHANISM (documented); the <b>dot they begin on</b> is MECHANISM by a timing argument, swept as a check</td><td>The seven belong at the <em>end</em> of the priming rather than its start, because the first pixel leaves at dot 97 and six is the last phase at which the counter still completes before that pixel rather than on it. Swept over 0, 5, 6, 7, 8 to confirm. <b>Two honesty notes:</b> our core ships the phase as 6 with a one-dot comparator term, so a reader copying a literal 7 into a different comparator convention is off by one; and our own provenance tooling files a value fixed by published geometry as <em>the test to distrust first in any future audit, precisely because it sounds the strongest.</em></td></tr>' +
      '<tr><td>11: the comparator fires when the counter reaches WX</td><td>MECHANISM for the comparison; <b>FITTED</b> for its width and hold</td><td>Our core compares against a <em>held</em> WX: for 2 dots after a write the comparator still sees the pre-write WX when that value is 7 or more (E.8, E.1.1). 9 is the settling <em>tag</em> our source gives the comparator&rsquo;s view of WX, a label in E.9&rsquo;s sense, not a number of dots or bits; nothing needs to be built for it beyond the hold. The <code>wx_old &ge; 7</code> condition is a clause our own record calls <em>load-bearing, its mechanism unexplained</em>. <b>The transferable part is the relation, not our numbers:</b> a comparator that fires a dot later needs a dot more of hold.</td></tr>' +
      '<tr><td>11: the takeover clears the queue and restarts the fetcher on the window</td><td>MECHANISM</td><td>This is what produces the +6. The row counter does <b>not</b> increment at the takeover: it increments at the end of each activation (section 11, both sites).</td></tr>' +
      '<tr><td>11: a hidden window does not advance its row counter</td><td>MECHANISM</td><td>Documented, and section 11 draws the picture.</td></tr>' +
      '<tr><td>11: deriving the window row from LY fails two cartridges</td><td><b>INSTRUMENT-MEASURED</b></td><td>A fact about our test set. The page should not let it read as a fact about hardware.</td></tr>' +
      '<tr><td>11: &ldquo;at counter 0 it evaluates &minus;1&rdquo;</td><td>MECHANISM for the correction; <b>NOT ESTABLISHED</b> for that phrasing; <b>CONVERGENCE</b> for the WX = 0 case</td><td>The mechanism is clean: the counter is bumped at the head of the dot and compared at the foot of the same dot, so during the priming it reports the position the line is <em>about</em> to reach. Measured on the shipped core, WX 1 to 7 take over on dot <code>89 + WX</code> on a line with no WX write during the priming fetch and on <code>90 + WX</code> on a line with one, and WX&nbsp;=&nbsp;0 on dot 84 and 90 respectively; the correction is applied only on the second kind of line, and the operand never reaches &minus;1 (E.8.1). But that specific sentence appears nowhere in our record and the knob implementing it has no provenance row at all. Separately the WX = 0 arm carries an explicit <b>oracle-derived</b> line in our source (shape only, no expression or constant taken), which is CONVERGENCE by our own definition and must be labelled so.</td></tr>' +
      '<tr><td>11: the window rows&rsquo; displacement equalled <code>SCX &amp; 7</code>, board movement 0 of 264</td><td>INSTRUMENT-MEASURED, with denominators: <b>the model row on this page</b></td><td>Sixteen frames, both directions exercised, 50 of 252 probes and 13 of 33 cartridges shown to take a takeover, a length recorder shown sensitive on three cartridges before reading zero across all 285, and the board result stated as zero. Leave it exactly as it is.</td></tr>' +
    '</tbody></table>' +

    '<h4 class="gbemu-sub">F.6: Sections 12 to 14</h4>' +
    '<table class="gbemu-table"><thead><tr><th>Claim (section number first)</th><th>Label</th><th>On what</th></tr></thead><tbody>' +
      '<tr><td>12: the fetcher freezes mid-step and resumes where it stopped</td><td>MECHANISM</td><td>Our own record files it as derived, with its mechanism: a label that follows its evidence.</td></tr>' +
      '<tr><td>12: &ldquo;6 to 11 dots&rdquo; is that freeze</td><td>MECHANISM (emergent)</td><td>Output of the wait, not input to it.</td></tr>' +
      '<tr><td>12: a <b>three-dot</b> window in an <b>eight-dot</b> cycle</td><td>eight: MECHANISM. <b>three: CONVERGENCE + INSTRUMENT-MEASURED</b></td><td>Both oracles read three and our own dwell instrument measures three on this core. <b>No hardware document states three.</b> This is the single most important relabelling in sections 7 to 14.</td></tr>' +
      '<tr><td>12: <em>which</em> three (the window&rsquo;s position)</td><td>MECHANISM, conditional</td><td>Two three-dot windows fit the measurement and an implementer given only the width has to guess. Appendix E.3 forces the position from the silicon 11 at residue 0 rather than from the oracle ladder our own source uses, which is circular.</td></tr>' +
      '<tr><td>12: the fetch itself is an unconditional six</td><td>MECHANISM + CONVERGENCE, <b>and explicitly never photographed</b></td><td>Our own consolidation is emphatic: <em>the 11 has been photographed as a slope and as a floor; the 6 has not.</em> Say that on the page: it is the difference between the two numbers in the same sentence.</td></tr>' +
      '<tr><td>12: the &ldquo;floor of 6&rdquo; appears in neither reference implementation as a number</td><td>CONVERGENCE evidence (a negative)</td><td>A statement about two other implementations&rsquo; structure: legitimate, load-bearing, and not a derivation. <b>And it is only true of the unclipped regime</b>: our own clipped-object path does carry a clamp and two constants, read off an oracle (appendix E.3.1).</td></tr>' +
      '<tr><td>12: <code>11 + 6(N&minus;1)</code></td><td><b>The 11 is HARDWARE-OBSERVED; the 6 is CONVERGENCE.</b> Two numbers, two labels, one sentence</td><td>Section 12 states them as two figures. Two restrictions travel with the 11: the three-device floor is a ruler downward only (it establishes <em>eleven or more</em>, never <em>exactly eleven</em>) and the &minus;11 slope does not exclude a third account (<em>the last pixel in the background queue counts</em>), because all 36 of that cartridge&rsquo;s objects sit at <code>X &equiv; 0 (mod 8)</code>.</td></tr>' +
      '<tr><td>12: the window stretches rather than suspending</td><td>MECHANISM</td><td>Follows from the window being a recurring property of the fetcher&rsquo;s phase rather than a gate the stall closes.</td></tr>' +
      '<tr><td>12: a wait cannot await its own completion</td><td>MECHANISM, corroborated by CONVERGENCE</td><td>The non-self-terminating requirement is a property of the machine; that two independent constructions satisfy it is convergence. The page already words this correctly.</td></tr>' +
      '<tr><td>12: sprite height is read at the fetch, not latched at the scan</td><td>MECHANISM, scored</td><td>The strongest evidence shape available short of silicon: a required output that no alternative model can produce.</td></tr>' +
      '<tr><td>13: each fetcher step samples what it needs when it needs it</td><td>MECHANISM</td><td>Follows from the step lengths and the two-dot separation.</td></tr>' +
      '<tr><td>13: do not snapshot, do not read live everywhere</td><td>MECHANISM</td><td>Both alternatives are refuted by mid-line rewrite cartridges.</td></tr>' +
      '<tr><td>13: &ldquo;a write is gated roughly a machine cycle behind a read&rdquo;</td><td><b>Two quantities wearing one sentence</b></td><td>Appendix E.1.5 carries both: access blocking is <b>6 dots</b> (behaviour HARDWARE-OBSERVED, magnitude NOT ESTABLISHED), and value delivery is <b>per register</b> (our specification says so in capitals: <em>registers do not share a write phase</em>). The word &ldquo;roughly&rdquo; hides two quantities, six numbers and two declared unknowns.</td></tr>' +
      '<tr><td>13: a committed value and a pending one, and which wins a same-dot conflict</td><td>MECHANISM that the decision exists; <b>NOT ESTABLISHED</b> for which decision</td><td>Our core resolves same-dot conflicts in the processor&rsquo;s favour for LYC and IF, and records that the sharing is <em>wrong in principle</em>, because LYC&rsquo;s phase is speed-dependent on the Colour and one constant cannot serve both rows.</td></tr>' +
      '<tr><td>13: palette writes take effect at the output stage (the pixel reaching the screen, one dot after its pop; section 13)</td><td>MECHANISM for the <em>where</em>; <b>FITTED</b> for the <em>when</em></td><td>The apply-at-output structure is mechanism. The two delivery leads are fitted and are different from each other (2 for the background palette against 3 for the object palettes) for what is structurally the same write. <b>The asymmetry is in the constants, not in the landing dot:</b> the background palette&rsquo;s OR stage takes one dot of its own, so both sums are 3 in our source (<code>BGP_OR</code> + <code>BGP_LEAD</code> = 1 + 2, <code>OBP_OR</code> + <code>OBP_LEAD</code> = 0 + 3), and both writes first reach the register two dots before the cycle ends (the background palette with its OR, the object palettes with the value), which E.1&rsquo;s table writes as 2 for each (on the original with the screen on, one machine cycle later: E.1). MECHANISM for the arithmetic, read from our source; the sum stays FITTED.</td></tr>' +
      '<tr><td>13 (<em>worth adding</em>: one refuted neighbour an implementer will otherwise re-propose)</td><td>Withdrawn, with its refutation recorded</td><td><em>Withdrawn: a processor write becomes visible to the picture unit at the start of its machine cycle</em> (refuted by an instrumented run of the write-timing cartridge). A refuted candidate published beside the shipped one saves a reader from re-proposing it.</td></tr>' +
      '<tr><td>14: one status line, four sources ORed, rising edge only</td><td>MECHANISM</td><td>The emergence of blocking from the OR is the content of the claim and is checkable by inspection.</td></tr>' +
      '<tr><td>14: video and sprite memory return <code>0xFF</code> in their windows</td><td>MECHANISM, with a measured refinement</td><td>Reads block on the live edge and release on the reported one; writes follow the reported mode at both edges. A build implementing one rule for both fails the write-timing rows. Section 14 and appendix E.1.5 state it.</td></tr>' +
      '<tr><td>14 (<em>it changes results</em>: video memory closes <b>6 dots</b> ahead of mode 3)</td><td><b>NOT ESTABLISHED</b></td><td>A bare constant in our core with a tripwire against sweeping it and no account at its site. An implementation without the early close will not reproduce our access windows. <b>To establish:</b> a document stating the early close, or a sweep over the access rows with the blast radius printed. Until a document or such a sweep exists, the honest form is: our core closes video memory six dots early and we cannot say why.</td></tr>' +
      '<tr><td>14: screen off parks the line counter, reports mode 0, and the status interrupt line freezes at its last value; it does not drop (section 14).</td><td>MECHANISM</td><td>Documented and scored.</td></tr>' +
      '<tr><td>14: screen on starts immediately, first frame not displayed</td><td>MECHANISM</td><td>Required by the boot sequence and a whole class of timing test.</td></tr>' +
      '<tr><td>14: the power-on line is the whole of your phase constant</td><td>MECHANISM for the original; <b>FITTED for the Colour</b></td><td>The original&rsquo;s value is pinned by two timing cartridges that measure it directly, <em>and no pixel score was consulted while it was derived: the pixel suite&rsquo;s later agreement is corroboration, not derivation, and that ordering is the reason it is worth anything.</em> The Colour&rsquo;s is FITTED-TO-STORED-RENDER, because the document asserting a compatibility-mode difference gives <b>no number</b>. Appendix E.2 states both.</td></tr>' +
      '<tr><td>14: the pixel board is a pure function of that line&rsquo;s length modulo 4</td><td>INSTRUMENT-MEASURED, <b>independently audit-confirmed twice</b></td><td>The rare claim on this page that got a second, independent pass and came back confirmed. <b>An audited number is worth more than an unaudited one.</b></td></tr>' +
      '<tr><td>14: a leaky write cycle is a phase that walks one dot per line</td><td>MECHANISM, <b>and we ship the enforcement, which is the useful half</b></td><td>Our core refuses to build an unbalanced subtract/repay pair at all: a compile-time error, because an unbalanced pair drops a dot on every LCDC write, silently. Three quarters of one apparent &ldquo;lead effect&rdquo; here was the dropped dot, so <b>every figure taken by sweeping the lead alone with an unbalanced pair is a measurement of a broken budget.</b> Register F5.</td></tr>' +
      '<tr><td>14: derive both modes from one variable and you have one degree of freedom</td><td>MECHANISM (architectural)</td><td>Falsifiable, and falsified in the right direction: nothing tunable reaches it.</td></tr>' +
      '<tr><td>14: a one-dot scan-source pulse costs exactly one test</td><td>INSTRUMENT-MEASURED, <b>single-instrument</b></td><td>The caveat belongs in the same breath and section 14 carries it there: a decision in the pixel domain has six instruments pointed at it, a decision in the interrupt domain has one. <b>Every finding there is single-sourced.</b></td></tr>' +
      '<tr><td>14 (<em>absent</em>: where the frame wrap&rsquo;s mode-2 entry is split)</td><td><b>FITTED</b></td><td>On the shipped core all 66 of the original&rsquo;s Mooneye acceptance rows pass (D.10.1), so our placement costs no row. Dots 1 through 4 all cost the same single unit (<b>a binary placement, not a phase to tune).</b></td></tr>' +
      '<tr><td>14: an interrupt is recognised at a machine-cycle boundary, so &ldquo;N dots before&rdquo; is over-specified</td><td>MECHANISM</td><td>A resolution bound derived from the dispatch granularity. Correct, and unusually valuable.</td></tr>' +
      '<tr><td>14: the ten residual rows, and row 71 absent</td><td>MECHANISM: already labelled, correctly</td><td>The negative-space check is what makes it a mechanism rather than a story.</td></tr>' +
      '<tr><td>14: the comparator carries a blind spot and it is real</td><td>MECHANISM for its existence; <b>NOT ESTABLISHED</b> for its width and placement as hardware facts</td><td>A blind spot that must not manufacture a falling edge cannot be implemented without its width and the dot it opens on. <b>Section 14 states our shipped values</b>: 4 dots at the start of every line, a second 4-dot window opening at dot 8 on line 153, with the interior of that placement a free choice over four adjacent values.</td></tr>' +
    '</tbody></table>' +

    '<h4 class="gbemu-sub">F.7: Sections 18 to 20</h4>' +
    '<p class="hw-readable">Section 18&rsquo;s entries restate claims from sections 7 to 17 and ' +
    'inherit their labels. Seven need a row of their own.</p>' +
    '<table class="gbemu-table"><thead><tr><th>Claim (section number first)</th><th>Label</th><th>On what</th></tr></thead><tbody>' +
      '<tr><td>18: the unsigned-counter clamp draws a window on rows that have none (7 px fixed against 30,630 created)</td><td><b>INSTRUMENT-MEASURED</b> on our core</td><td>Rule 18/3&rsquo;s Why and F.3 carry the measured figures.</td></tr>' +
      '<tr><td>18: gating the corruption on the reported mode loses one timing of fifteen</td><td><b>HARDWARE-OBSERVED</b></td><td>One original Game Boy via an EverDrive GB, fifteen clean timings, read from each cartridge&rsquo;s own result buffer. Console, apparatus and denominator all named: one of only two hardware observations in these eleven sections. The sweep covers sections 7 to 14 and 18 to 20, and this row is in 18.</td></tr>' +
      '<tr><td>18: blocking the whole bus hangs nine cartridges</td><td>INSTRUMENT-MEASURED</td><td>Our corpus, our switch, nine named cartridges.</td></tr>' +
      '<tr><td>18: clocking the sound unit from the processor is an octave out in double speed</td><td>MECHANISM</td><td>Documented; appendix B writes the rule out rather than citing it.</td></tr>' +
      '<tr><td>18: reading one clock at two instants</td><td>MECHANISM</td><td>Section 5&rsquo;s reconciliation of two sample points on one clock, with three predictions registered before the build and all three confirmed.</td></tr>' +
      '<tr><td>18: looking for an offset where the table is a modulus</td><td>MECHANISM</td><td>Section 16: delays of 1 and 3 agree and both disagree with 0, which no offset can produce.</td></tr>' +
      '<tr><td>18: &ldquo;do not re-derive this&rdquo; twice forbade the work that closed the row</td><td>INSTRUMENT-MEASURED (historical)</td><td>Two named instances in our record. A historical fact; it does not date and must not be re-measured.</td></tr>' +
      '<tr><td>19: the suite row counts</td><td><b>declared basis, not a measurement</b></td><td>Section 21 pins the enumeration at one commit. Any count quoted in section 19 is on that basis and should say so, because section 21 also warns that our two scoring scripts enumerate 264 and 288 and must never be differenced.</td></tr>' +
      '<tr><td>19: a core can pass all of Blargg and render nothing</td><td>MECHANISM</td><td>Follows from what the suite observes.</td></tr>' +
      '<tr><td>19: several rows declare themselves revision-dependent</td><td>MECHANISM (cartridge-declared)</td><td>The cartridges say it in their own headers; section 22 quotes the form.</td></tr>' +
      '<tr><td>19: commercial games &ldquo;deliberately avoid&rdquo; the timing</td><td>the observation is INSTRUMENT-MEASURED; <b>the &ldquo;deliberately&rdquo; is NOT ESTABLISHED</b></td><td>We can show a core passing commercial titles while failing mealybug. <b>We have no evidence about what commercial developers intended.</b> The measurable form is the observation alone.</td></tr>' +
      '<tr><td>19: prefer a declared table to a picture</td><td>MECHANISM, with a measured case cited</td><td>Correct as written; section 23 carries the instance.</td></tr>' +
      '<tr><td>19: write one instrument carrying no absolute constant</td><td>method rule</td><td>The most transferable paragraph in the section.</td></tr>' +
      '<tr><td>20: 254 PASS and 237 PASS with the constant knocked out</td><td>INSTRUMENT-MEASURED <b>snapshot</b>, correctly pinned</td><td>Pinned at its own earlier commit and correct there. <b>The board of record is 258 at a later tree</b>, and the page says so beside the pair so a reader meeting 254 here and 258 in section 21 does not think one is stale.</td></tr>' +
      '<tr><td>20: +17 fixed / &minus;0 broken, decomposed into named rows</td><td>INSTRUMENT-MEASURED snapshot</td><td>Resolved into named rows, which is what makes it quotable. Keep the commit attached.</td></tr>' +
      '<tr><td>20: &ldquo;it was board-neutral on the day it landed&rdquo;</td><td>INSTRUMENT-MEASURED <b>historical fact</b></td><td>The page states the distinction correctly. It does not date and must not be re-measured.</td></tr>' +
      '<tr><td>20: a tree that passes 2 of 68 sound rows no matter what</td><td>INSTRUMENT-MEASURED, with denominator</td><td>The model form for a null: the tree is named and the blindness is quantified.</td></tr>' +
      '<tr><td>20: 84 decisions, 48 observable, 35 unobservable, 1 not independently variable</td><td>INSTRUMENT-MEASURED, one pass of the census; the three classes partition the 84</td><td>Keep <em>&ldquo;unobservable here means no value tried moved a byte: a bound, not a proof&rdquo;</em> adjacent to the numbers, not a paragraph away. <b>48 + 35 + 1 = 84</b>: the three classes partition the 84, and a row that restates the figures must add all three, or a shortfall would not show. Section 20 carries the one not independently variable switch as a row of its own.</td></tr>' +
      '<tr><td>20: &ldquo;thirty-two of the thirty-five are reachable by code that could be written&rdquo;</td><td><b>NOT ESTABLISHED</b></td><td>A claim about programs that do not exist; nothing in the record scores it. <b>To establish, or recast:</b> say how the thirty-two were judged reachable, by inspection of the site, by an authored probe, or by argument. It is the one number in the census carrying no method.</td></tr>' +
      '<tr><td>20: the 39 ms sampling against a 23.4 ms step</td><td>INSTRUMENT-MEASURED (withdrawal)</td><td>A retracted finding with its cause named.</td></tr>' +
      '<tr><td>20: thirteen live settings all reading 0 on one new cartridge</td><td>INSTRUMENT-MEASURED, positive control quoted beside the null</td><td>The page&rsquo;s own rule applied to the page&rsquo;s own number.</td></tr>' +
      '<tr><td>20: the label table itself</td><td>definitional</td><td>Section 20&rsquo;s table carries both of the words this sweep needed. Of the eighty-seven claims swept here, <b>eight needed NOT ESTABLISHED and seventeen needed INSTRUMENT-MEASURED</b>.</td></tr>' +
    '</tbody></table>' +
    '<p class="gbemu-key"><b>The eight NOT ESTABLISHED rows, gathered so they can ' +
    'be counted:</b> the ' +
    'between-two-dots write claim (8); the ' +
    'sixteen-slot queue, whose only warrant is its own array size (10); the ' +
    '&ldquo;evaluates &minus;1&rdquo; phrasing (11); which value wins a same-dot conflict (13); the six-dot video-memory close (14); the ' +
    'comparator&rsquo;s blind-spot width and placement as hardware facts (14); &ldquo;deliberately&rdquo; (19); and ' +
    '&ldquo;thirty-two reachable&rdquo; (20).</p>' +
    '<div class="gbemu-rule" id="gbr-F-7-1"><b>Rule F.7/1.</b> A gathering of rows by label must be read off ' +
      'the Label column (Rule F.2/1), never off the notes. When a count moves, the list that enumerates it must be ' +
      're-derived from the table, never trusted to still match.</div>' +
    '<div class="gbemu-example"><b>Example: why the input-latch dot within a two-dot fetcher step is not in ' +
    'that list, and it is a trap worth naming.</b> It carries <code>FITTED</code> in its ' +
    'Label column in F.4, not NOT ESTABLISHED: its note asks what would establish it, ' +
    'which is exactly the kind of sentence that pulls a row into a gathering of unestablished ' +
    'claims when the gathering is read off the notes. <b>Apply this ' +
    'appendix&rsquo;s own counting rule (count the Label column, not the prose) and ' +
    'the answer is eight, which is what F.2 and the last row of the table above both carry.</b></div>' +
    '<div class="gbemu-why"><b>Why.</b> <b>A count and its enumeration are one figure written twice</b>, and ' +
    'G.4 needs the same rule.</div>' +

    '<h4 class="gbemu-sub">F.8: The flexibility register</h4>' +
    '<p class="hw-readable">The acceptance test this page is written against is that an offline ' +
    'implementer reaches the same score <b>and derives their own equivalents where flexibility ' +
    'exists</b>. These are the places the page presents an implementation choice as a requirement. ' +
    '<b>Each gives the invariant, not our number.</b></p>' +
    '<div class="gbemu-rule" id="gbr-F-8-1"><b>Rule F.8/1.</b> For each row F1 to F13, a build must satisfy the ' +
      'invariant in the third column. The second column (Ours) is the choice our core ships; a build need not copy ' +
      'it.</div>' +
    '<div class="gbemu-example"><b>Example.</b> F3: our queue storage has 16 slots. A build whose queue storage ' +
      'has exactly 8 slots never holds more than 8 pixels, so it satisfies the F3 invariant and is equivalent to ' +
      'ours.</div>' +
    '<table class="gbemu-table"><thead><tr><th>#</th><th>Ours</th><th>The invariant you must satisfy</th></tr></thead><tbody>' +
      '<tr><td><b>F1</b> what a queued pixel carries</td><td>colour, palette and two priority bits</td><td>Enough per-pixel state that the merge at pop needs no second look at sprite memory and no knowledge of which fetch produced the pixel. On the original machine that is at minimum the colour index, the sprite/background origin, and the sprite&rsquo;s priority bit.</td></tr>' +
      '<tr><td><b>F2</b> the fetcher&rsquo;s decomposition</td><td>five steps, the first four of two dots each, the fifth retried per dot</td><td>(a) a steady-state background fetch occupies exactly 8 dots; (b) the two tile-data reads are exactly 2 dots apart and are separate bus events; (c) the push is refused unless the background queue is empty; (d) a push opportunity exists at the high-plane step, such that the line&rsquo;s two opening fetches cost 12 dots rather than 16 and a fetch restarted at a window takeover completes in 6 rather than 8.</td></tr>' +
      '<tr><td><b>F3</b> the queue&rsquo;s storage width</td><td>16 slots, so the head index wraps without a special case</td><td><b>Occupancy never exceeds 8.</b> We measured a 16-deep variant that pushes whenever there is room for 8 and it changed nothing at all, so the depth is an allowance, not a finding, and any storage satisfying the occupancy bound is equivalent.</td></tr>' +
      '<tr><td><b>F4</b> the write-delivery phase</td><td>per-register leads in dots (appendix E.1). <b>Do not copy these.</b></td><td>(a) a write must be placeable at dot granularity; (b) the delivery phase must be adjustable <b>per register</b>, because one global constant provably cannot serve them all; (c) the <em>ordering</em> between registers is the durable claim and the individual dot counts are ours; (d) a same-dot write/read conflict must resolve deterministically and the resolution must be stated. Build your own measurement against whichever mid-line rewrite cartridges you hold.</td></tr>' +
      '<tr><td><b>F5</b> the dot budget</td><td>a subtract/repay pair with a compile-time guard</td><td><b>A line must still be exactly 456 dots after any register write.</b> A mechanism that spends a dot and does not repay it is a phase that walks one dot per line for ever, and <b>it will present as a lead effect rather than as a leak</b>: three quarters of one apparent lead effect here was a dropped dot.</td></tr>' +
      '<tr><td><b>F6</b> the window&rsquo;s priming split</td><td>the x counter&rsquo;s seven increments begin 6 dots into mode 3, with a one-dot correction in the comparator</td><td><b>The seven increments must complete strictly before the dot on which the line&rsquo;s first visible pixel leaves, never on it.</b> Starting them one dot later is a pure four-pixel fix on one cartridge and roughly nineteen thousand pixels of damage across four others. Whatever split you choose, check it against a cartridge that writes WX in the range 0 to 7, and <b>use signed arithmetic</b>: the positions below zero are real and must not be clamped.</td></tr>' +
      '<tr><td><b>F7</b> the object stall&rsquo;s representation</td><td>a countdown to the fetcher&rsquo;s phase, with a three-dot window per eight-dot cycle</td><td>(a) the wait&rsquo;s ending condition must be a fetcher <b>state</b>, never the wait&rsquo;s own completion, or a single on-screen sprite stops mode 3 terminating; (b) the window is 3 dots of every 8; (c) it <b>ends just before the push</b>: a window that includes the push dot cannot place the residue-0 case, and both three-dot windows otherwise fit the measurement.</td></tr>' +
      '<tr><td><b>F8</b> the reported mode and the interrupt source</td><td>two separately carried quantities with a configurable split at the frame wrap</td><td><b>They are independent.</b> A build in which moving the interrupt source necessarily moves the reported mode has one degree of freedom where the machine has two, and no tuning substitutes for separating them. Carry them apart from the first line of code.</td></tr>' +
      '<tr><td><b>F9</b> stepping granularity</td><td>one dot at a time, about 70,224 steps per frame</td><td><b>A processor write must be observable at the dot it lands on.</b> Any structure delivering that is acceptable; the cost is not the obstacle it appears to be.</td></tr>' +
      '<tr><td><b>F10</b> when the transfer takes the bus</td><td>a dot-resolved lag of <b>2</b> before the grip is in force</td><td><b>The scan slot in flight when the transfer takes the bus still completes its read, and the grip is in force before the next transfer machine cycle.</b> That is the whole claim. A lag of 0 is refuted (eleven cartridges fail) and so is a whole machine cycle (it swaps which cartridges fail, one for one); <b>1 and 2 are indistinguishable on everything we hold.</b> Ship either. Section 5 names the two stimuli that would separate them.</td></tr>' +
      '<tr><td><b>F11</b> which byte of the transfer the object fetch takes</td><td>the transfer&rsquo;s write cursor</td><td><b>Not observable, and therefore not ours to state.</b> Five structural readings of &ldquo;the cursor&rdquo; and switching the clause off entirely all give a byte-identical framebuffer on 264 rows and 35 cartridges: the stacked objects are opaque under every tile the cursor can supply. <b>The invariant is that tile and attribute come from the transfer rather than from the object.</b> Anything satisfying that passes.</td></tr>' +
      '<tr><td><b>F12</b> the noise restart&rsquo;s extra lead</td><td><b>2&nbsp;T</b></td><td><b>Any value in (0,&nbsp;8]&nbsp;T</b>. 0 and 10 each fail both 128-cell restart tables, and <b>every value inside that bound passes both</b>. The two failing endpoints do <em>not</em> establish that everything strictly between them passes: strictly between 0 and 10 admits <b>9</b>, which the bound excludes. The bound is what the restart tables establish; the three other statements of this quantity make no wider claim. <b>A bound, not a value</b>: do not read our 2 as a measurement.</td></tr>' +
      '<tr><td><b>F13</b> the noise examination phases</td><td><b>3</b> primary and <b>1</b> secondary, on a mod-4 clock</td><td><b>FORCED in kind, READ OFF in value.</b> What is forced: there are two examination phases, and the second applies only while the latched divisor code is 0. <b>Where the clock&rsquo;s zero sits is a property of your tick call site, not of the hardware</b>: derive your own pair. <b>Which of the two is which is <em>not</em> a free convention</b>, and the assignment is stated rather than left to the pair: <b>3 is the primary</b>, governing every divisor code; <b>1 is the code-0-only second phase</b>. <b>And the anchor that makes ours translatable to another call site:</b> our clock is zeroed at sound-unit power-on and incremented at the top of each tick before the examination, so the first primary examination is the third sound tick. Counted from the power-on write itself: that write reaches the sound unit before its own machine cycle&rsquo;s two sound ticks (E.5), so those two ticks are the 1 and the 2, and the next machine cycle&rsquo;s first tick is the first primary examination. (Read from our source; it is also why B.15&rsquo;s code-1 arm depends on whether the trigger comes an even or an odd number of machine cycles after the power-on.) B.15&rsquo;s four arms are all at code 0 and cannot separate the two. Section 17 and B.17.</td></tr>' +
    '</tbody></table>' +

    '<h4 class="gbemu-sub">F.9: Sections 1 to 4 and 6, labelled separately</h4>' +
    '<p class="gbemu-key">This table labels the claims of sections 1 to 4 and 6: the clock and map, the processor, ' +
    'the boot handoff, the timer and transfer, and the object scan. <b>These rows are counted ' +
    'separately from F.2 and do not enter ' +
    'its 87 / 97</b>, which is a count of the F.4 to F.7 sweep. ' +
    '<b>This table has 15 rows carrying 18 assignments.</b> <b>Three rows carry two labels ' +
    'each</b> (the divider&rsquo;s 4, the transfer start-up delay, and the latched scan ' +
    'coordinates) and the other twelve carry one, so 15 + 3 = 18.</p>' +
    '<div class="gbemu-rule" id="gbr-F-9-1"><b>Rule F.9/1.</b> This table is counted under the counting rule of ' +
      'Rule F.2/1, <em>every occurrence of a label word in the Label column counts once</em>, with the three ' +
      'clauses of Rules F.9/2 to F.9/4, which F.2&rsquo;s count does not need. Its counts never enter F.2&rsquo;s.</div>' +
    '<div class="gbemu-rule" id="gbr-F-9-2"><b>Rule F.9/2. The word list is wider here than F.1&rsquo;s six.</b> ' +
      'This table assigns <b>eight</b> label words: F.1&rsquo;s ' +
      '<code>MECHANISM</code>, <code>INSTRUMENT-MEASURED</code>, <code>HARDWARE-OBSERVED</code>, ' +
      '<code>CONVERGENCE</code>, <code>FITTED</code> and <code>NOT ESTABLISHED</code>, plus ' +
      '<code>DERIVED</code> and a bare <code>MEASURED</code>, both of which appear in the ' +
      'divider row and neither of which F.1 defines. <b>F.1 is not widened to eight:</b> <code>DERIVED</code> and ' +
      'the bare <code>MEASURED</code> are this table&rsquo;s own usage, and F.1.1 maps them ' +
      'rather than promoting them to page vocabulary.</div>' +
    '<div class="gbemu-rule" id="gbr-F-9-3"><b>Rule F.9/3. Longest match wins.</b> A label word sitting ' +
      'inside a longer label word is that longer word and nothing else.</div>' +
    '<div class="gbemu-example"><b>Example.</b> <code>MEASURED</code> is a substring of ' +
      '<code>INSTRUMENT-MEASURED</code>, so &ldquo;every occurrence&rdquo; taken literally counts every instrument ' +
      'row twice. The row &ldquo;1: the dot clock leads the machine cycle by one dot&rdquo; carries ' +
      'INSTRUMENT-MEASURED in its Label column: one assignment, INSTRUMENT-MEASURED, and no MEASURED.</div>' +
    '<div class="gbemu-rule" id="gbr-F-9-4"><b>Rule F.9/4.</b> A label word named only to be ' +
      '<em>excluded</em> is not an assignment.</div>' +
    '<div class="gbemu-example"><b>Example.</b> The divider row&rsquo;s Label column reads <b>MEASURED</b> that the ' +
      'lead exists and is one machine cycle; <b>NOT ESTABLISHED</b> for why: <em>explicitly not MECHANISM and not ' +
      'DERIVED</em>. That is two assignments, MEASURED and NOT ESTABLISHED. Without this clause the same table ' +
      'counts 20, and the difference is a rule and not a recount.</div>' +
    '<div class="gbemu-why"><b>Why.</b> <b>Without these clauses the 18 is not reproducible from this table</b>, ' +
      'and a count a reader cannot repeat is a claim about a count, which is the exact charge this appendix lays ' +
      'against any figure a reader cannot recount.</div>' +
    '<table class="gbemu-table"><thead><tr><th>Claim</th><th>Label</th><th>Note</th></tr></thead><tbody>' +
      '<tr><td>1: the master clock is 4,194,304&nbsp;Hz, a line is 456 dots, a frame is 70,224</td><td>MECHANISM</td><td>Definitional and cross-checked by every timing cartridge on the board. The only trap is the frame rate that follows: <b>59.7275, not 60.</b></td></tr>' +
      '<tr><td>1: the dot clock leads the machine cycle by <b>one dot</b></td><td><b>INSTRUMENT-MEASURED</b>, with a named decisive cartridge</td><td>Skews of 0, 2 and 3 were swept and all fail; only 1 passes. <b>That is a unique optimum on our corpus, not a derivation</b>: the section states the cartridge and the three-machine-cycle pattern it wants, which is what makes the claim checkable rather than asserted.</td></tr>' +
      '<tr><td>1: the address map, region by region</td><td>MECHANISM</td><td>Documented everywhere and verified by the mapper rows. Appendix H is the part that is not.</td></tr>' +
      '<tr><td>2: the instruction set, its cycle counts and its flag effects</td><td>MECHANISM</td><td>Appendix D carries all 512 opcode cells; the suite that scores them finds every error. <b>The eleven byte values that decode to no instruction are D.7 and are the one place a table can be silently short.</b></td></tr>' +
      '<tr><td>3: the post-boot register state</td><td>MECHANISM (cartridge-declared)</td><td>Pinned by a cartridge that declares its own expected registers. HARDWARE-OBSERVED <em>on someone else&rsquo;s silicon</em>, per the clause in F.1.</td></tr>' +
      '<tr><td>3: the divider does not hand off at zero when the real boot program runs</td><td><b>MECHANISM</b>, and the <em>handoff</em> value is a consequence</td><td>The handoff number is whatever the boot program&rsquo;s own execution leaves. <b>Do not carry <em>that</em> as a constant</b>: a hand-written table passes the register test, and <b>fails the I/O test</b>, which is precisely the diagnostic that says the table is right and the <em>history</em> is missing. A hand-written table <b>passes <code>boot_div</code> too</b>, provided it tabulates the internal 16-bit counter rather than the visible byte, and section 3 supplies that value. <code>boot_hwio</code> is the row that genuinely needs the image.</td></tr>' +
      '<tr><td>3 and 5, <em>and it is a second constant, which the first one easily hides</em>: the divider holds <b>4</b>, not 0, when the boot program&rsquo;s first instruction is fetched</td><td><b>MEASURED</b> that the lead exists and is one machine cycle; <b>NOT ESTABLISHED</b> for why: explicitly <b>not</b> MECHANISM and <b>not</b> DERIVED</td><td>This is <em>not</em> a consequence of running the boot program: it is a constant the core carries <em>into</em> it, and the row above saying &ldquo;do not carry it as a constant&rdquo; reads as covering both. The 4 reconciles two measurements (a cycle-exact boot run landing at <code>0xABC4</code> against a cartridge that passes only at <code>0xABC8</code>) and nothing accounts for it. <b>Section 5 states it plainly and section 3 agrees with it.</b></td></tr>' +
      '<tr><td>4: the timer is one counter read two ways; overflow is two events at different cycles</td><td>MECHANISM</td><td>The interrupt is the carry-out and fires at the overflow; the reload is 4&nbsp;T later. Modelling them as one event fails one named cartridge by exactly one glitch increment.</td></tr>' +
      '<tr><td>4: the transfer moves one byte per machine cycle, 160 bytes, after a start-up delay of ' +
      '<b>2 machine cycles</b></td><td><b>MECHANISM</b> for the rate and the length; ' +
      '<b>INSTRUMENT-MEASURED</b> for the start-up delay of <b>2</b></td><td>The rate and the length are ' +
      'observed by the instruction-timing tests directly. <b>The start-up is a different kind of thing, ' +
      'and a row that does not name it hides that</b>: it is pinned on our core, not derived. With the ' +
      'transfer stepping before the processor&rsquo;s access in every machine cycle (section 4, E.5), a ' +
      'start-up of 2 passes all 65 of the original-machine Mooneye cartridges that do not need the boot ' +
      'program, every transfer row among them; 1 and 3 each fail 16 of them, 4 fails 18, and 2 with the ' +
      'step after the access fails 12. <b>Section 4 states the 2 outright, because the grip phase in ' +
      'section 5 is a dot-resolved lag measured from the instant this countdown expires.</b></td></tr>' +

      '<tr><td>4: the transfer owns sprite memory <em>and only</em> sprite memory</td><td><b>INSTRUMENT-MEASURED</b>, and section 5 carries the hardware</td><td>Block more than sprite memory and the timing tests hang. <b>Section 5&rsquo;s bus discussion is the evidence and it is the right shape: ask <em>which</em> bus, not <em>whether</em>.</b></td></tr>' +
      '<tr><td>4: a source at or above <code>$E000</code> mirrors work RAM on the original</td><td>MECHANISM (cartridge-declared), <b>with a stated hole</b></td><td>The single cartridge that pins it <em>declares itself failing</em> on the Colour, so it provides no coverage there at all. The section says so; that is the model form for a coverage gap.</td></tr>' +
      '<tr><td>4: the status interrupt is one line, four sources ORed, rising edge only</td><td>MECHANISM</td><td>Write it literally and recompute every dot; the much-discussed blocking behaviour is then not a feature you implement. Section 14 has the rest.</td></tr>' +
      '<tr><td>6: the scan examines 40 objects and fills a cap of 10, by X order or by index order</td><td>MECHANISM</td><td>Section 6 and appendix C.5/C.6 carry the selection and the addressing.</td></tr>' +
      '<tr><td>6: the scan files entries on <em>latched</em> coordinates while a transfer holds the bus</td><td><b>HARDWARE-OBSERVED</b> for the behaviour; <b>NOT ESTABLISHED</b> for the mechanism</td><td>35 self-checking cartridges on one DMG, one session. <b>The two labels on one row are the point of the row</b>: section 5 states why a clean hardware sheet upgrades the what and not the why.</td></tr>' +
      '<tr><td>6: the object scan&rsquo;s own read of the sprite-height bit</td><td><b>NOT ESTABLISHED</b></td><td>E.1.3 records it as inert on our corpus: no cartridge here changes sprite height across the scan. Our core reads it through the tag-9 view (new from C + 1) on the dot each object-memory slot is examined, one slot every two dots on dots 5 to 83 (MECHANISM, read from our source, <code>LCDC_W_OBJ_SCAN</code>). <b>What would establish it:</b> a cartridge that does.</td></tr>' +
    '</tbody></table>' +
    '<p class="hw-readable"><b>The shape of that table is the finding, not any row in it.</b> <b>Three ' +
    'of the fifteen are NOT ESTABLISHED</b>, three are measured on our own instrument and presented as ' +
    'such, and <b>one is a hardware observation.</b></p> <p ' +
    'class="hw-readable"><b>The comparison, plainly. Sections 1 to 4 and 6 are not better established ' +
    'than the rest of the page.</b> On these counts they carry a <em>higher</em> proportion of NOT ' +
    'ESTABLISHED than the sections F.2 swept, and also a <em>higher</em> proportion of hardware observation: ' +
    '<b>3 of 15 is 20.0 % against F.2&rsquo;s 8 of 87, which is 9.2 %</b> (a factor of 2.2) and <b>the' +
    ' hardware share is 1 of 15 against 2 of 87</b>, a factor of 2.9. Both fractions and both ' +
    'percentages are re-derived by the figures check (appendix G.7) from F.9&rsquo;s and F.2&rsquo;s own ' +
    'tables.</p>' +
    '<div class="gbemu-rule" id="gbr-F-9-5"><b>Rule F.9/5.</b> This comparison must be read as a ' +
      'direction and never as a magnitude, and never as evidence that sections 1 to 4 and 6 are ' +
      '<em>worse</em>.</div>' +
    '<div class="gbemu-why"><b>Why.</b> Fifteen rows is a small denominator: one row moving shifts' +
    ' it by nearly seven points, and the factors of 2.2 and 2.9 are arithmetic on ' +
    'two fractions rather than a measured effect size. Sections 1 to 4 and 6 are more widely agreed, ' +
    'which is a different property, and agreement is not establishment, which is the whole ' +
    'reason the table exists.</div></section>' +

  /* ================================================================ APP-G
   * VERIFICATION. Sections 19 to 22 say which suites exist, what the score
   * is and which rows cannot be won. None of them says HOW A ROW IS SCORED,
   * what each suite decomposes into, or in what order to build so that each
   * stage has a gate that cannot pass until the stage before it is right.
   * That is this appendix. Deliberately does NOT repeat section 21's board
   * table or its ceiling ladder -- it points at them.                   */
  '<section class="sect" id="gbe-verify"><h3 class="sect-h">Appendix G. The verification scorecard</h3>' +
    '<p class="hw-readable">Everything above tells you what to build. <b>This tells you how you will ' +
    'know whether you built it</b>, and, just as importantly, how a verification run can come ' +
    'back green while measuring nothing at all. The board of record and the ceiling are section 21; ' +
    'the arguments about the three failing rows are section 22. What follows is the machinery under ' +
    'both.</p>' +

    '<h4 class="gbemu-sub">G.1: How a row is scored, before anything else</h4>' +
    '<div class="gbemu-rule" id="gbr-G-1-1"><b>Rule G.1/1.</b> A row is scored only by comparing a screenshot with reference PNG images: no serial capture, no memory inspection, no verdict string parsing. One comparison runs these steps:' +
    '<ol class="gbemu-steps">' +
      '<li>Convert both images to 8-bit greyscale (values 0 to 255) with no dithering.</li>' +
      '<li>Take the absolute per-pixel difference of the two greyscale images.</li>' +
      '<li><b>If any resulting pixel value is greater than 50, it is not a match.</b> If every resulting pixel value is 50 or less, it is a match.</li>' +
    '</ol></div>' +
    '<div class="gbemu-example"><b>Example.</b> A screenshot whose greyscale differs from the reference by 50 at one pixel and by 0 everywhere else matches. The same screenshot with one pixel differing by 51 does not match. A difference of exactly 50 is inside the match.</div>' +
    '<div class="gbemu-rule" id="gbr-G-1-2"><b>Rule G.1/2.</b> The verdict for a row is given by this table. The rows are tested from the top, and the first row whose condition holds gives the verdict.' +
    '<table class="gbemu-table"><thead><tr><th>Order (tested from the top)</th><th>Condition</th><th>Verdict</th></tr></thead><tbody>' +
      '<tr><td>1</td><td><b>no pass-reference exists at all</b></td><td><b>INFO</b></td></tr>' +
      '<tr><td>2</td><td>screenshot matches any pass-reference</td><td><b>PASS</b></td></tr>' +
      '<tr><td>3</td><td>screenshot matches any fail-reference</td><td><b>FAIL</b></td></tr>' +
      '<tr><td>4</td><td>a pass-reference exists but nothing matched</td><td><b>FAIL</b></td></tr>' +
    '</tbody></table></div>' +
    '<div class="gbemu-example"><b>Example.</b> A row that ships no pass-reference is INFO whatever the screenshot shows (row 1). A screenshot that matches a pass-reference and also a fail-reference is PASS, because row 2 is tested before row 3.</div>' +
    '<div class="gbemu-rule" id="gbr-G-1-3"><b>Rule G.1/3.</b> A row&rsquo;s reference file is, by default, the cartridge&rsquo;s own path with ' +
    '<code>.png</code> substituted. A row may also ship a <code>.fail.png</code>, the fail-reference. A row may have several pass-references where the hardware has more ' +
    'than one legitimate outcome; the harness returns PASS on the first that matches.</div>' +
    '<div class="gbemu-why"><b>Why.</b> The fail-reference lets the ' +
    'harness distinguish <em>wrong in the specific way that means the emulator failed the test</em> ' +
    'from <em>wrong in some other way</em>. Row 1 of Rule G.1/2 is where the three unscoreable rows come ' +
    'from, and it is why every rival reports INFO on the same three: nobody can score a row that ' +
    'ships nothing to score against. <b>A match on a second reference is ' +
    'invisible in a results file</b>, which records only the first reference&rsquo;s filename as the ' +
    'display name while scoring against all of them, so anybody reconstructing &ldquo;which ' +
    'reference did we match&rdquo; from a report alone will get it wrong.</div>' +
    '<div class="gbemu-rule" id="gbr-G-1-4"><b>Rule G.1/4.</b> Before a single processor test ' +
    'can score, a build must have enough of a picture processor to render the background layer and a font.</div>' +
    '<div class="gbemu-why"><b>Why.</b> <b>Most of these cartridges self-report on ' +
    'screen</b>: Blargg&rsquo;s and Mooneye&rsquo;s cartridges compute a verdict and ' +
    '<em>print</em> it, and the board reads the printed verdict as pixels. Blargg&rsquo;s <code>cpu_instrs</code>, <code>instr_timing</code> and <code>mem_timing</code> also send their output to the serial port, which is much ' +
    'cheaper to read while bootstrapping: use it, and do not confuse it with what the board ' +
    'reads. The other Blargg cartridges (<code>mem_timing-2</code>, <code>oam_bug</code>, <code>dmg_sound</code>, <code>halt_bug</code>) send nothing there; Rule 19/4 says where each is read.</div>' +

    '<h4 class="gbemu-sub">G.2: The nine suites, decomposed, and what to expect of each</h4>' +
    '<p class="hw-readable">Section 19 says what each suite proves and what it cannot see. This is ' +
    'what each one <em>contains</em>, so you can tell whether a stage is finished. Counts are the ' +
    'board&rsquo;s own manifest at the commit in section 21. Every count in this table is in board rows; &ldquo;&times;N&rdquo; is N rows; &ldquo;Ours: P / F / I&rdquo; is this core&rsquo;s PASS, FAIL and INFO rows for that suite, as section 21 counts them.</p>' +
    '<table class="gbemu-table"><thead><tr><th>Suite</th><th>Decomposition</th><th>What to expect, and ours (Ours: PASS / FAIL / INFO rows)</th></tr></thead><tbody>' +
      '<tr><td><b>blargg</b><br>51 rows</td><td><code>cpu_instrs</code> 11, <code>instr_timing</code> 1, <code>halt_bug</code> 1, <code>interrupt_time</code> 1 (Colour), <code>mem_timing</code> 3, <code>mem_timing-2</code> 3, <code>oam_bug</code> 7 (the suite ships eight single cartridges; the board leaves out <code>7-timing_effect</code>, which never prints a verdict: section 5 scores it against its declared answer instead), <code>dmg_sound</code> 12, <code>cgb_sound</code> 12</td><td>The oldest and most load-bearing suite, and the one to build against first. <code>cpu_instrs</code> and <code>instr_timing</code> will find <b>every</b> opcode error you have, including the ones you are sure you do not have. <code>oam_bug</code> is original-machine-only and needs the picture processor&rsquo;s sprite-memory access pattern modelled, not just the processor&rsquo;s. <b>Ours: 51 / 0 / 0.</b></td></tr>' +
      '<tr><td><b>mooneye</b><br>97 rows</td><td>acceptance 32, timer 13, ppu 12, mbc1 13, mbc5 8, mbc2 7, oam_dma 3, bits 3, misc 2, instr (DAA) 1, interrupts 1, serial 1, manual-only 1</td><td>The backbone. Mooneye cartridges signal success by loading the Fibonacci sequence <code>3 5 8 13 21 34</code> into the registers and printing a pass screen; the board reads the screen. The timer and picture sections are where cycle accuracy stops being optional. <b>Ours: 97 / 0 / 0.</b></td></tr>' +
      '<tr><td><b>samesuite</b><br>68 rows</td><td>channel 1 &times;17, channel 2 &times;14, channel 3 &times;13, channel 4 &times;12, common 5, dma 4, ppu 1, sgb 2</td><td>Almost entirely sound, on Colour. Most rows read the channel output back through the Colour&rsquo;s <code>PCM12</code>/<code>PCM34</code> registers, so <b>they are scored on the actual sample a channel is emitting at a named moment</b>, not on anything audible; without those registers most of the suite cannot score at all. <b>They are described on the Colour tab, section 13 and its appendix A</b>, not in appendix B here, because the original Game Boy does not have them; appendix B says so too. Channels 1 and 2 fall out together once the frame sequencer is right; channel 3&rsquo;s wave-memory window and channel 4&rsquo;s shift-register schedule are each a job of their own. The label sections 15 to 17 and appendix B carry for this block is <b>covered, verified implementable, with four named omissions</b> (the evidence is in the explanation under this table). <b>Ours: 67 / 1 / 0.</b></td></tr>' +
      '<tr><td><b>mealybug tearoom</b><br>24 rows</td><td>mid-mode-3 writes to BGP, OBP0, SCX, SCY, individual LCDC bits, the window registers and the map selection</td><td>These are the cells that tell you whether your pipeline is a pipeline or a scanline renderer wearing one. <b>Progress here is measured in pixels, not rows</b>: start recording <em>which</em> pixels are wrong, not how many. The suite also ships Colour revision-C and revision-D reference sets which this board does not score; that separate colour board is where several of section 22&rsquo;s prices are denominated. <b>Ours: 24 / 0 / 0.</b></td></tr>' +
      '<tr><td><b>daid</b><br>9 rows</td><td><code>ppu_scanline_bgp</code> &times;2, <code>stop_instr</code> &times;3, <code>speed_switch_timing</code> &times;3, <code>rom_and_ram</code> (no reference)</td><td><code>ppu_scanline_bgp</code> writes the background palette <b>ten times per scanline</b>, four machine cycles apart, from a handler exactly one scanline long, so the rendered image <em>is</em> a picture of when a palette write takes effect. The <code>STOP</code> rows are winnable and are a good check on appendix D.9: <code>STOP</code> blanks the original&rsquo;s screen but makes a Colour screen go black, unless the <code>STOP</code> lands during mode 3, in which case the picture freezes as it stands. <b>Ours: 7 / 1 / 1.</b></td></tr>' +
      '<tr><td><b>acid</b><br>5 rows</td><td><code>dmg-acid2</code>, <code>cgb-acid2</code>, <code>cgb-acid-hell</code>, <code>which.gb</code> &times;2 (no reference)</td><td><code>dmg-acid2</code> is the best-designed diagnostic on the board: one frame in which about a dozen separate behaviours each produce a visibly distinct, individually nameable defect. <b>It is the single best return on effort in the whole pipeline stage.</b> <code>cgb-acid-hell</code> is not; section 22 says why. <b>Ours: 2 / 1 / 2.</b></td></tr>' +
      '<tr><td><b>cpp</b><br>4 rows</td><td>MBC3 RAM-gate width, RTC latching by a single write, invalid RTC bank, one Super Game Boy packet stress test</td><td>Three are mapper detail work; the fourth cannot be passed without genuinely implementing the Super Game Boy packet protocol, <b>which appendix A.6 describes register by register.</b> <b>Ours: 4 / 0 / 0.</b></td></tr>' +
      '<tr><td><b>ax6</b><br>3 rows</td><td><code>rtc3test</code> parts 1&ndash;3, on Colour</td><td>The MBC3 real-time clock: registers, latching, rollover, invalid values. Up to 20 seconds of emulated time each, so they are among the slowest rows you will run, and they are pure mapper work with no picture or sound involvement. <b>Ours: 3 / 0 / 0.</b></td></tr>' +
      '<tr><td><b>ashiepaws</b><br>3 rows</td><td><code>bully</code> on both machines, <code>strikethrough</code></td><td><code>bully</code> is a broad self-reporting battery and is ordinary work: it is also what pins the bus-conflict rule in section 5. <code>strikethrough</code> is not derivable from any document and the rule it needs is not the rule its name suggests: section 5 carries the whole account, and it is <b>two</b> separable rules rather than one. <b>Ours: 3 / 0 / 0.</b></td></tr>' +
    '</tbody></table>' +
    '<div class="gbemu-why"><b>Why the samesuite label reads &ldquo;covered, verified implementable, with four named omissions&rdquo;.</b> The label is earned in both directions, which is a stronger and a weaker claim than &ldquo;covered by sections 15 to 17&rdquo;, and unlike that one it has something behind it. <b>The first half:</b> an independent build, working from sections 15 to 17 and appendix B and nothing else, produced a complete four-channel sound unit that renders. It matched the idle mixer level to four decimals from B.12&rsquo;s own arithmetic (<code>&minus;0.7500</code> of full scale, 24,575 units) and recovered its emitted pitches from the rendered samples to within 0.1&nbsp;Hz of B.5&rsquo;s formulas. That is a stronger claim than &ldquo;covered&rdquo;: the block is not merely written down, it has been built from. <b>The second half:</b> the same build stopped, guessed or could not implement at exactly four places where the page named a quantity, said it was measured, and did not print it: the frame-sequencer origin (section 15), which of the two noise examination phases is primary (B.17 and F13), the restart position-advance threshold (section 16) and the wave retrigger corruption&rsquo;s window and byte (section 17; the one rule the build could not implement at all, as opposed to guess past). <b>All four print their shipped representative</b>, under B.15&rsquo;s own rule; the label moves again if that stops being true.</div>' +

    '<h4 class="gbemu-sub">G.3: Six ways a verification result becomes a lie</h4>' +
    '<p class="hw-readable">Each of the six is a way a run can report a result its instrument did not measure. Each is stated as a rule, with the reason after it.</p>' +
    '<div class="gbemu-rule" id="gbr-G-3-1"><b>Rule G.3/1 (image comparison is a tolerance test).</b> A PASS must never be read as &ldquo;nothing moved&rdquo;. Read pixel deltas, not verdicts, and decompose a change into the pixels it fixed and the pixels it newly broke <em>before</em> you overwrite a baseline.</div>' +
    '<div class="gbemu-why"><b>Why.</b> A pixel has to ' +
        'differ by more than 50 luminance before it counts (Rule G.1/1), so an error of up to 50 in every pixel can sit inside a PASS. On a four-shade picture (shades 85 apart, Rule 19/5) one whole ' +
        'shade of error always fails; on a reference whose levels lie closer than 51 apart (many Color renders, compared in luminance) a whole level of error can pass. <b>&ldquo;The row passes, therefore nothing ' +
        'moved&rdquo; is always false.</b> A count of wrong pixels hides the same thing inside a FAIL.</div>' +
    '<div class="gbemu-example"><b>Example.</b> A cell reads 59 wrong pixels before a change and 41 after. The count fell, yet the two sets of wrong pixels <b>share no pixel</b>: all 59 were fixed and 41 pixels that had been correct were broken. A second cell reads 59 before a change and 59 after, with 43 fixed and 43 newly broken: the count is unchanged and 43 pixels moved each way.</div>' +
    '<div class="gbemu-rule" id="gbr-G-3-2"><b>Rule G.3/2 (a knob outside the compiled path reports every arm as free).</b> Before anything is scored on an axis, ' +
        '<b>two settings of the axis must differ on some ' +
        'named observable</b>: a positive control. State the observable and state the two values it ' +
        'took. If the two settings agree, <b>the axis is not an axis</b>, and nothing is scored on it.</div>' +
    '<div class="gbemu-why"><b>Why.</b> A sweep over parameters that cannot reach the output measures nothing, and its null reads like a result. Four spellings of ' +
        'the same fault: <b>dead at compile time</b>, <b>shadowed</b> by a companion that always ' +
        'wins the boolean, <b>inert for the observable</b> because the edge is raised elsewhere ' +
        'unconditionally, and <b>unexercised</b> because no cartridge creates the condition.</div>' +
    '<div class="gbemu-example"><b>Example.</b> Two parameters sitting inside a disabled conditional branch: every setting of either one gives the same output, so a sweep over them reports every arm as free. The positive control (two settings, one named observable, two values) fails before the sweep is run, and the sweep is not run.</div>' +
    '<div class="gbemu-rule" id="gbr-G-3-3"><b>Rule G.3/3 (an instrument that does not forward its inputs).</b> If your ' +
        'harness can be pointed at another source tree or given compiler defines, <b>every ' +
        'instrument must honour those inputs and you must confirm it behaviourally</b>: point ' +
        'the instrument at a tree carrying a <b>known</b> change and require the observable to ' +
        '<b>move</b>.</div>' +
    '<div class="gbemu-why"><b>Why.</b> An instrument that ignores the variable that redirects it at a tree prints a green result for a change it never saw, under exactly the words a landing requires, and says nothing about it.</div>' +
    '<div class="gbemu-rule" id="gbr-G-3-4"><b>Rule G.3/4 (a harness that does not clear its memory).</b> The harness must zero its machine structure before use, so that no field, the device field included, runs uninitialised.</div>' +
    '<div class="gbemu-why"><b>Why.</b> With an ' +
        'uninitialised device field, <b>every figure that passes through the harness is wrong</b> ' +
        'on every row where the two machines differ, which is most of the interesting ones. It is ' +
        'the cheapest trap here to avoid and the most expensive to discover late, because the ' +
        'numbers it produces are <em>plausible</em>.</div>' +
    '<div class="gbemu-example"><b>Example.</b> A figure in appendix E.6 whose true value is 61 reads 47 through a harness with an uninitialised device field: a plausible number, and wrong.</div>' +
    '<div class="gbemu-rule" id="gbr-G-3-5"><b>Rule G.3/5 (a defect needs a re-measurement date, not an origin ' +
        'date).</b> A defect row must carry the date its observable was last re-measured, by the instrument that measures it. An origin date is not enough, and reading a commit log is not re-measuring an observable.</div>' +
    '<div class="gbemu-why"><b>Why.</b> <b>An ' +
        'origin date says when you last examined the mechanism; it says nothing about the ' +
        'observable, and the observable is what moves under you.</b> A defect row can be fixed already by a later commit, or by a commit whose subject line <em>announced</em> the fix, and still be open; and a row&rsquo;s headline figure can be one the instrument that measures it has never produced.</div>' +
    '<div class="gbemu-rule" id="gbr-G-3-6"><b>Rule G.3/6 (three rows ship no reference).</b> Quote a basis with every total. Totals taken on different bases must never be differenced.</div>' +
    '<div class="gbemu-why"><b>Why.</b> The three rows that ship no reference can be scored by ' +
        'nobody, this core included, and every rival reports INFO on the same three. <b>261, not ' +
        '264, is the ceiling for anybody.</b> A number without a basis means nothing: ' +
        '&ldquo;PASS only&rdquo; and &ldquo;PASS + INFO&rdquo; differ by exactly three for ' +
        'everyone.</div>' +

    '<h4 class="gbemu-sub">G.4: A staged build order, and what each stage is worth</h4>' +
    '<div class="gbemu-rule" id="gbr-G-4-1"><b>Rule G.4/1.</b> Build in the order of the table below, stage 0 first, and finish each stage&rsquo;s gates before starting the next stage. <b>Every stage&rsquo;s gate is a test that cannot ' +
    'pass until the previous stage is right.</b></div>' +
    '<div class="gbemu-why"><b>Why.</b> Build in this order and watch the number climb. Build everything and ' +
    'then debug, and you will spend a week staring at a black screen with no instrument that can ' +
    'tell you which of six subsystems is wrong. The gate property is the whole of what makes a ' +
    'ladder a ladder.</div>' +
    '<p class="gbemu-key"><b>On the numbers below.</b> The per-stage row counts are exact counts ' +
    'from the board&rsquo;s own manifest: they are what each section of the board contains. ' +
    '<b>The cumulative column is an arithmetic projection of what becomes reachable, not a measured ' +
    'stage-by-stage history</b>; no such history was recorded, and your own climb will be ' +
    'lumpier than this table. Every figure in the table is in board rows; &ldquo;~&rdquo; marks a count that depends on how the acceptance rows are split between stages.</p>' +
    '<table class="gbemu-table"><thead><tr><th>Stage (built in this order, from 0)</th><th>Gates (board rows in brackets)</th><th>Worth, then the running total from stage 0 (board rows)</th></tr></thead><tbody>' +
      '<tr><td><b>0. Enough picture to read a verdict</b></td><td>the background layer drawing tiles through BGP, and the screen on. No window, no objects, no mid-line anything</td><td><b>0 rows, and skipping it costs you every row.</b> Take the serial shortcut anyway while bootstrapping</td></tr>' +
      '<tr><td><b>1. The processor</b></td><td><code>blargg/cpu_instrs</code> 01&ndash;11 (11), <code>instr_timing</code> (1), <code>halt_bug</code> (1), <code>mooneye/acceptance/instr/daa</code> (1). <b>Appendix D is this stage.</b></td><td><b>14. Cumulative 14.</b> Do not move on until <code>cpu_instrs</code> is 11 of 11: every opcode error you leave behind resurfaces later disguised as a picture bug or a sound bug, at ten times the cost to diagnose</td></tr>' +
      '<tr><td><b>2. The memory map, the mappers, and the boot program</b></td><td>mbc1 (13), mbc5 (8), mbc2 (7), <code>mem_timing</code> + <code>-2</code> (6), <code>rtc3test</code> (3), cpp MBC3/RTC (3), <code>acceptance/bits</code> (3), boot state: <code>boot_regs</code>, <code>boot_div</code>, <code>boot_hwio</code> (3)</td><td><b>46. Cumulative 60.</b> Overlay the real 256-byte boot image, start at <code>PC = 0</code> with everything zeroed, and unmap on a write to <code>0xFF50</code>. <b>A hand-written table passes <code>boot_regs</code>, and passes <code>boot_div</code> too provided it tabulates the <em>internal 16-bit counter</em> and not just the visible byte</b>: section 3 supplies that value and records the row passing on it. <b><code>boot_hwio</code> does not need the image</b>: with section 3&rsquo;s hand-over tables and <code>FF26</code> = <code>0xF1</code> it passes with no boot program (measured on a scratch copy of our core, and on an independent build).</td></tr>' +
      '<tr><td><b>3. Timer, interrupts, sprite-memory transfer</b></td><td><code>acceptance/timer</code> (13), <code>acceptance</code> instruction and interrupt timing (~29), <code>oam_dma</code> (3), <code>interrupts</code> (1), <code>blargg/interrupt_time</code> (1, Colour only; an original-only build counts ~46 here)</td><td><b>~47. Cumulative ~107.</b> Where sub-instruction accuracy becomes mandatory. <b>The timer overflow is two events at different cycles</b>: the interrupt request is the counter&rsquo;s carry-out and fires <em>at</em> the overflow, while the reload is delayed 4 T-cycles after it. Model them as one and you fail <code>rapid_toggle</code> by exactly one glitch increment and spend days searching for a write-ordering bug that is not there</td></tr>' +
      '<tr><td><b>4. The pixel pipeline, against acid2</b></td><td>the two acid2 rows (2), <code>acceptance/ppu</code> (12), daid <code>STOP</code> and speed-switch (6), <code>bully</code> &times;2 (2), <code>strikethrough</code> (1), samesuite dma + ppu (5), <code>oam_bug</code> (7). <b>Sections 7 to 14 and appendix E are this stage.</b></td><td><b>~35. Cumulative ~142.</b> Get <code>dmg-acid2</code> pixel-perfect before starting on anything harder. <b><code>strikethrough</code> belongs in this stage</b>: it needs the scan-latch rule <em>and</em> the grip phase of section 5, and the first without the second buys the row while leaving a 35-cartridge corpus 11 short</td></tr>' +
      '<tr><td><b>5. mealybug&rsquo;s per-pixel cells</b></td><td>mealybug (24), <code>ppu_scanline_bgp</code> on the original (1)</td><td><b>25. Cumulative ~167.</b> Change how you measure here: rows are too coarse, because a cell can go from 370 wrong pixels to 34 and read FAIL the whole way</td></tr>' +
      '<tr><td><b>6. The sound unit</b></td><td><code>dmg_sound</code> (12), <code>cgb_sound</code> (12), <code>samesuite/apu</code> (61). <b>Sections 15 to 17 and appendix B are this stage.</b></td><td><b>85. Cumulative ~252</b>: 84 winnable and one that is not. The largest single block on the board and the one most often left undone, which is exactly why it is worth doing</td></tr>' +
      '<tr><td><b>7. The remainder that can be climbed</b></td><td>mooneye misc / manual-only / serial (4), a Super Game Boy model (3): <b>appendix A.6</b></td><td><b>7, and here is the only place a row comes off.</b> 252 + 7 = 259 counted as if everything were winnable; <b>one of stage 6&rsquo;s 85 sound rows is not</b>, so the honest cumulative is <b>258, which is the board</b>. The ladder stops here because there is nothing above it to climb</td></tr>' +
      '<tr><td><em>Not a stage: the six rows nobody climbs</em></td><td>the three rows that ship no reference (3); the three failing rows of section 22: one of which sits inside stage 6&rsquo;s sound block and is not added again (3)</td><td><b>No rows.</b> 258 + 3 + 3 = 264, which is the manifest total. <b>It is not a target and this table must never be read as a route to it</b></td></tr>' +
    '</tbody></table>' +
    '<div class="gbemu-why"><b>Why the ladder stops short of the manifest.</b> The three ' +
    'no-reference rows and the three remaining failures are not stages to climb: they are the ' +
    'rows section 21 subtracts and section 22 argues, and <b>nobody ' +
    'has them</b>. The three no-reference rows are INFO for every emulator alive, this core ' +
    'included, and the remaining failures are named and open. A cumulative column that ran on to ' +
    'the manifest would read as a promise of a full board, which is exactly the thing the rest of ' +
    'the page exists to refuse. The unwinnable rows sit below the line, on the not-a-stage row, where ' +
    'they belong.</div>' +
    '<div class="gbemu-rule" id="gbr-G-4-2"><b>Rule G.4/2.</b> The ladder&rsquo;s bottom line must ' +
    'equal the board of record in section 21, checked the way section 21 checks its own: <b>0 + 14 + 46 + ~47 + ~35 + 25 + 85 + 7 = 259 rows counted as ' +
    'if every one were winnable, minus the one unwinnable sound row inside stage 6 = 258</b>, which ' +
    'is the board of record in section 21. <b>This table cannot be edited one cell at a time:</b> when the board moves, stage 4, stage 7, the ' +
    'not-a-stage row and this sum all move together.</div>' +
    '<div class="gbemu-why"><b>Why.</b> That is the invariant. A ladder whose bottom no longer ' +
    'equals the board has a row counted in the wrong class. If yours does not balance, one of your ' +
    'buckets is double-counting, and that is worth more to know than the total.</div>' +
    '<div class="gbemu-rule" id="gbr-G-4-3"><b>Rule G.4/3.</b> After any change to a per-stage count, run these steps before doing anything else:' +
    '<ol class="gbemu-steps">' +
      '<li>Re-add the whole cumulative column from the top (stage 0), each cell the cell above it plus its own stage&rsquo;s worth.</li>' +
      '<li>Re-run the bottom-line sum of Rule G.4/2.</li>' +
    '</ol></div>' +
    '<div class="gbemu-why"><b>Why.</b> The defect this table is most prone to is a per-stage count that moves while the ' +
    'cumulative column below it does not: move stage 4 by one and leave stage 5 and stage 6 ' +
    'alone, and two adjacent cells of one table disagree by one while the row beneath them is ' +
    'already using the new figures. A warning does not catch that, because nothing <em>runs</em> a ' +
    'warning; the check is one line of arithmetic, so it is written down as a ' +
    'procedure rather than as a caution. A page whose stated invariant is violated by the table that states it has a more ' +
    'expensive problem than a wrong number, because the invariant is what a reader was told to ' +
    'trust instead of checking.</div>' +
    '<p class="hw-readable">Three things worth having in advance.</p>' +
    '<ul class="gbemu-bullets">' +
      '<li><b>Stage 2 sequencing:</b> the original&rsquo;s boot program waits on the line register ' +
      'during the logo scroll, so it cannot run to completion until you have a picture processor. ' +
      'Hand-initialisation is the correct thing to do for stages 1 and 2 and the wrong thing to keep.</li>' +
      '<li><b>Stage 4, line 0:</b> on lines 1 to 143 the scan-source status interrupt is raised ' +
      '<em>before</em> the scan&rsquo;s first dot (the source is high on dots 2 and 3 of section 14&rsquo;s scale, counted from the line boundary, the scan starting on dot 4), and on line 0 one dot later, on dot 3 only (section 14). The resulting ' +
      'difference is four pixels on one line of one test, which is exactly the size of thing that eats ' +
      'a month if you file it as a mystery instead of a known line-0 case.</li>' +
      '<li><b>Stage 5 baselines:</b> a baseline captured without the boot program is not comparable with one captured with it (Rule G.6/2, which carries the measured size of the difference). Keep three separate things and ' +
      'never average them: a <b>frozen origin</b> written ' +
      'once and never rewritten, a <b>monotone watch</b> holding the best value ever seen per cell, ' +
      'and the <b>pixel identities</b> at the state that set each best.</li>' +
    '</ul>' +

    '<h4 class="gbemu-sub">G.5: How to measure yourself when you disagree with this page</h4>' +
    '<p class="hw-readable"><b>You will disagree with this page.</b> You will build a subsystem ' +
    'differently, measure something this page measured, and get a different number. Rule G.5/1 is the ' +
    'bar your measurement has to clear: the same bar every number on this page had to ' +
    'clear.</p>' +
    '<div class="gbemu-rule" id="gbr-G-5-1"><b>Rule G.5/1.</b> A measurement must carry all four of these, and the first must be written before the run:' +
    '<ol class="gbemu-steps">' +
      '<li><b>A pre-registered expectation, written before the run.</b> In advance and in numbers: ' +
        'name the cells that <b>must move</b> and the cells that <b>must not move</b>, and give ' +
        'each its own falsifier. <b>A prediction written after the result is not a prediction; it ' +
        'is a description.</b></li>' +
      '<li><b>A positive control proving the instrument can detect the thing</b>, as Rule G.3/2 states it.</li>' +
      '<li><b>A stated denominator</b>, and your basis too, every time. A count ' +
        'without a denominator cannot be compared with anything, and <b>a zero without a ' +
        'denominator cannot be distinguished from an unexercised instrument.</b></li>' +
      '<li><b>A named falsifier</b>: what observation would show this wrong? If nothing would, it ' +
        'is not a measurement. <b>Keep the falsifier&rsquo;s scope honest</b>: <em>a sweep of one axis establishes that that axis cannot win the row. It ' +
        'never licenses the sentence &ldquo;the row cannot be won.&rdquo;</em></li>' +
    '</ol></div>' +
    '<div class="gbemu-example"><b>Example.</b> Stated denominators: <em>&ldquo;48 structured rules scored against all 64 ' +
        'declared cells; best of 48 was 41.&rdquo;</em> <em>&ldquo;375 arms; 0 of 120 pixels ' +
        'moved.&rdquo;</em> <em>&ldquo;Four cartridges of 112 fire the hook at all.&rdquo;</em></div>' +
    '<div class="gbemu-why"><b>Why.</b> The side benefit of step 1 is not small: drafting an operational ' +
        'criterion is a search, and it returns instruments. Writing down ' +
        'what would refute a claim requires enumerating the tests that bear on it, and the ' +
        'enumeration can turn up checks nobody knew existed. Step 4&rsquo;s scope matters because a row that one axis cannot win can be won on an axis the sweep never touched.</div>' +
    '<div class="gbemu-rule" id="gbr-G-5-2"><b>Rule G.5/2.</b> <b>When your measurement contradicts this page and meets Rule G.5/1, your measurement wins.</b> If you sweep an axis this page calls dead and it moves, you have ' +
    'found something and this page is wrong. <b>Bring the pre-registration, the positive control, ' +
    'the denominator and the falsifier, and the number is yours.</b></div>' +
    '<div class="gbemu-why"><b>Why.</b> Plainly and without qualification: that is how this page ' +
    'was built. A note reading <i>&ldquo;do not re-derive ' +
    'this&rdquo;</i> does not outrank a re-derivation that meets Rule G.5/1: re-derivation is what closes the rows such notes protect.</div>' +
    '<div class="gbemu-rule" id="gbr-G-5-3"><b>Rule G.5/3.</b> <b>A finding that lives only in a tree nobody else can reach does not exist.</b> ' +
    '<b>If it ' +
    'cannot be committed, commit the way to rebuild it</b>: a fresh clone must reach a ' +
    'working instrument.</div>' +
    '<div class="gbemu-why"><b>Why.</b> A note saying <i>&ldquo;do not re-derive this&rdquo;</i> that sits in a branch the main ' +
    'line cannot see protects nothing: the next person re-spends the entire sweep that produced it.</div>' +

    '<h4 class="gbemu-sub">G.6: You cannot score yourself without the cartridges, and this is the structural gap in this page</h4>' +
    '<p class="gbemu-key"><b>Stated plainly, because it is the largest ' +
    'remaining hole.</b> Everything above tells you how a row is scored, what each suite contains ' +
    'and in what order to build. <b>None of it is reachable without the cartridges and the reference ' +
    'images, and this page ships neither and cannot.</b> They are other people&rsquo;s work under ' +
    'other people&rsquo;s licences, and a page that hands you a number you cannot reproduce is ' +
    'handing you a mood. So: here is what the board is made of, so you can assemble the same one; ' +
    'and here is what to do while you cannot.</p>' +
    '<p class="hw-readable"><b>What the 264 rows are, as an assembly list.</b> Nine suites, each ' +
    'published separately by its own author, decomposed row-for-row in G.2: <b>97 Mooneye, 68 ' +
    'SameSuite, 51 Blargg, 24 mealybug tearoom, 9 daid, 5 acid, 4 cpp, 3 ashiepaws, 3 ax6.</b> ' +
    'Three of the 264 ship no reference image and are unscoreable by anyone.</p>' +
    '<div class="gbemu-rule" id="gbr-G-6-1"><b>Rule G.6/1.</b> <b>The row set is part ' +
    'of the number.</b> If you assemble a different set, say so and stop ' +
    'comparing with this page&rsquo;s figure.</div>' +
    '<div class="gbemu-why"><b>Why.</b> Two scorers in this project enumerate 264 and 288 rows and their ' +
    'totals must never be differenced (Rule G.3/6).</div>' +
    '<div class="gbemu-rule" id="gbr-G-6-2"><b>Rule G.6/2.</b> <b>Both boot programs must be supplied.</b> A ' +
    'baseline captured without them is not comparable with one captured with them, and a difference between the two must be quoted with its base attached.</div>' +
    '<div class="gbemu-why"><b>Why.</b> Ten of the 24 ' +
    'mealybug cells draw tiles the boot program leaves in video memory, measured here at 3,481 ' +
    'pixels <b>net</b> across exactly those ten cells, in both directions (<code>79,670 &minus; 76,189</code> between the two committed origin ' +
    'totals, which is why it can be re-derived by subtraction with no build). <b>Quote it with that base attached:</b> the sum of absolute movements is 3,827, and section 23 ' +
    'carries a 3,423 taken at a different board total: three numbers, three bases, never interchangeable.</div>' +
    '<p class="gbemu-key"><b>And what to do before you have any of it, which is most of the ' +
    'build.</b> Three of G.4&rsquo;s <b>eight</b> stages are gated mostly by cartridges that ' +
    '<em>self-report over ' +
    'the serial port</em> as well as on screen: the processor suite especially. <b>Read the ' +
    'serial output and you can score the serial-reporting rows of stages 1 to 3 with no reference images at all</b>, needing only ' +
    'the cartridges. Rule 19/4 names them (<code>cpu_instrs</code>, <code>instr_timing</code>, <code>mem_timing</code>); the rest of those stages, <code>halt_bug</code> and <code>mem_timing-2</code> among them, are read where Rule 19/4 says, not from the serial port. Stage 0 needs nothing but your own eyes. It is stages 4 and 5, the pixel work, that ' +
    'genuinely require the reference set, and that is exactly where this page stops being a ' +
    'substitute for measurement.</p>' +
    '<p class="hw-readable"><b>Every number on this page is a fact about a corpus, and a corpus has ' +
    'holes you can only find by searching for them.</b> Two such holes are known, and both are ' +
    'invisible to a sweep:</p>' +
    '<ul class="gbemu-bullets">' +
      '<li><b>The window fine-scroll blind spot, and it is the more valuable half of section ' +
        '11&rsquo;s second defect.</b> This project&rsquo;s entire scored protected set contains ' +
        '<b>no cartridge with a non-zero <code>SCX&nbsp;&amp;&nbsp;7</code> and a window at or past ' +
        'position 7</b>: the one stimulus that spends the discards <em>before</em> the ' +
        'position match. <b>One witness in 264 rows, and it is the failing row itself.</b> The ' +
        'census was taken by instrumenting the fine-scroll latch and the drain rather than by ' +
        'grepping for register writes, which matters, because the result is sharper than the ' +
        'hypothesis: <b>six of the seven window fence cartridges never execute the clause at ' +
        'all</b>. Structurally dead, 0 lines of 144, so they cannot regress from a change ' +
        'there and <em>they cannot confirm it either</em>. <b>The seventh reaches it 126 times and ' +
        'still does not move</b>, because its window position is 0: the takeover fires before any ' +
        'discard on that line has been popped, and a term removed from a counter cannot move a ' +
        'comparison already satisfied at zero. <b>That makes it a live negative control, not an ' +
        'absent one</b>: it proves the change does not damage a window path that does drain ' +
        'fine scroll, which is worth having and is not confirmation. <b>Our whole window fence is ' +
        'calibrated at zero fine scroll</b>, and the one axis the defect lives on is the axis six of ' +
        'the seven do not vary.</li>' +
      '<li><b>And the qualifier on that sentence, which has to be said out loud or the next reader ' +
        'takes the wider claim.</b> It is true of the <em>scored</em> set. It is <b>not</b> true of ' +
        'everything this project holds: a second-tier agreement corpus (another ' +
        'emulator&rsquo;s renders, never summed with hardware and never a tie-breaker) ' +
        'contains <b>277 tests</b> of precisely that stimulus, non-zero fine scroll with the window ' +
        'past 7. <b>An instrument that silently scores the wrong source tree cannot see them</b>, which is trap 3 in G.3 (Rule G.3/3) arriving from ' +
        'the other direction. Scored on the right tree, 46 of those tests are byte-identical with that corpus. <b>So the blind spot is partly ' +
        'instrumental and not only a gap in the corpus.</b></li>' +
    '</ul>' +
    '<div class="gbemu-rule" id="gbr-G-6-3"><b>Rule G.6/3.</b> Before you trust a null, take the census: instrument the clause itself and count ' +
    'how many lines, cartridges and cells <em>reach</em> it. Then keep the two failure modes apart: ' +
    '<em>the corpus does not contain the stimulus</em> and <em>the instrument cannot ' +
    'see it</em> produce the same zero.</div>' +
    '<div class="gbemu-why"><b>Why.</b> <b>This is the transferable rule, and the one this appendix exists for.</b> ' +
    '<b>A row you pass tells you your corpus agrees with you. It does not tell you your corpus ' +
    'examined the clause.</b> A clause nothing executes and a clause ' +
    'everything agrees with print the same green. <b>And a knob that cannot move a pixel is ' +
    'indistinguishable from a knob that is not wired</b> (Rule G.3/2).</div>' +

    '<h4 class="gbemu-sub">G.7: The dependent-figure gate, because this page&rsquo;s most common defect is arithmetic and it is checked rather than watched for</h4>' +
    '<p class="gbemu-key"><b>The defect this exists for.</b> A figure moves and one of its ' +
    'dependents does not. It is the most common factual error on a page like this one, it is ' +
    'almost always written by someone who has just checked their own arithmetic, and it ' +
    'survives adjacency: the edit that moves the figure can land in the ' +
    'paragraph immediately beside the dependent it has just made stale. G.4&rsquo;s ladder is the example to keep in mind: one per-stage cell can disagree with the running total two cells away while the ' +
    'paragraph beneath states the invariant (Rule G.4/2).</p>' +
    '<p class="hw-readable"><b>The diagnosis is not carelessness, and treating it as carelessness is ' +
    'why it recurs.</b> What an author cannot do is check <em>everything that reads</em> their ' +
    'arithmetic, because a figure&rsquo;s dependents are scattered across two tabs, forty sections ' +
    'and nine appendices, and nothing lists them. <b>A page whose defence against this is a warning ' +
    'in prose has no defence</b>: a warning does not run.</p>' +
    '<p class="gbemu-key"><b>So it is a program.</b> ' +
    'It lives beside these tabs as ' +
    '<code>tools/check-emulation-figures.js</code> and runs with no arguments and no build. It ' +
    'renders all three tabs (this one, the Colour one and the NES one), flattens them ' +
    'to text, and <b>re-derives every figure on the page that has a ' +
    'dependent elsewhere on the page</b>.</p>' +
    '<div class="gbemu-rule" id="gbr-G-7-1"><b>Rule G.7/1.</b> <b>A check asserts a relation, not a value.</b></div>' +
    '<div class="gbemu-why"><b>Why.</b> The gate does not ' +
    'know what the board is; it knows that the ladder&rsquo;s bottom line must equal it. That ' +
    'is the only design that survives the numbers legitimately moving.</div>' +
    '<p class="hw-readable"><b>The checker and all three tabs are in the repository</b>, so the gate is reproducible from a clone. <b>What a reader actually needs, though, is</b> the relation list in the next paragraph, which exists so that the ' +
    'procedure survives the file rather than depending on it.</p>' +
    '<p class="hw-readable"><b>What it asserts, stated here as well as in the file, so the procedure ' +
    'survives the file.</b> The board of record&rsquo;s PASS + FAIL + INFO equals its denominator, ' +
    'and the hero block and the Colour tab quote the same board. The nine-suite enumeration sums to ' +
    'that denominator on both tabs. Section 21&rsquo;s per-suite table sums, by column, to the ' +
    'factbox above it and, in total, to the denominator. The four comparison bases differ from each ' +
    'other by exactly the INFO count, and the Colour tab mirrors that table cell for cell. ' +
    '<b>G.4&rsquo;s cumulative column is the running sum of its own stage worths</b>, its bottom line ' +
    'equals the board, and the ladder plus the rows nobody climbs equals the manifest. G.2&rsquo;s ' +
    'per-suite decompositions sum to the enumeration&rsquo;s counts. F.2&rsquo;s label column sums to ' +
    'its stated total, its labelled and unlabelled rows sum to its claim count, and <b>F.7&rsquo;s ' +
    'gathered list is counted item by item against F.2&rsquo;s figure</b>. The mealybug residue&rsquo;s ' +
    'net re-derives by subtraction from the two origin totals and its cell count agrees everywhere ' +
    'it is stated. The Colour tab&rsquo;s divider difference is the actual difference of the two ' +
    'values. Section 22&rsquo;s named rows account for its whole pixel count, and the Colour ' +
    'tab&rsquo;s double-speed stall agrees with itself in both units. <b>And E.5&rsquo;s dot-budget ' +
    'pair is evaluated, not read</b>: the expression the page states is run at both speeds over ' +
    'every lead E.1 uses and required to spend exactly <code>2B</code> dots per machine cycle.</p>' +
    '<div class="gbemu-rule" id="gbr-G-7-2"><b>Rule G.7/2.</b> A check that sweeps a range must take the range from the table it claims to cover, not from a hard-coded list; and where the claim depends on the table carrying a particular kind of entry, a separate assertion must fail outright when the table stops carrying one.</div>' +
    '<div class="gbemu-why"><b>Why, and how the E.5 check is written.</b> A sweep hard-coded to <code>L&nbsp;=&nbsp;0&hellip;3</code> ' +
    'beside a paragraph claiming <em>&ldquo;every lead E.1 uses&rdquo;</em> is a claim about ' +
    'coverage the code does not meet, and E.1 uses two ' +
    '<b>negative</b> leads, <code>LYC</code> and <code>IF</code>, both at &minus;1, which such a ' +
    'sweep never evaluates. <b>That is this page&rsquo;s ' +
    'own defect class one level up</b>: a figure (the sweep&rsquo;s range) moves in prose and its ' +
    'dependent (the loop) does not. <b>The fix is to the sweep, not to the ' +
    'claim</b>: the leads are read out of E.1&rsquo;s own table, so a register added ' +
    'with a new lead extends the check by construction, and a separate assertion fails outright if ' +
    'E.1 ever stops carrying a negative lead, because at that moment the sentence above would ' +
    'quietly become false again.</div>' +
    '<p class="hw-readable"><b>And the rest of what it asserts, which is the part to read if you ' +
    'are building the same thing for your own page.</b> <b>A gate whose checks are written only ' +
    'against the last audit&rsquo;s findings is a gate that will always be one pass behind</b>, so ' +
    'it also asserts ' +
    'that <b>F.9&rsquo;s row, assignment, NOT ESTABLISHED, INSTRUMENT-MEASURED and ' +
    'HARDWARE-OBSERVED counts are re-derived from the Label column of F.9&rsquo;s own table</b>, ' +
    'under the exclusion rule F.9 states, with its ratio percentages recomputed against F.2; that ' +
    '<b>section 21&rsquo;s ceiling ladder actually subtracts</b>: manifest minus its ' +
    'deductions equals the ceiling, the ceiling equals the board, and the universal ceiling is the ' +
    'first deduction on its own; that <b>section 23&rsquo;s photograph badges counted in prose are ' +
    'the badges the grid renders</b>, from the data table 2,700 lines above the sentence that ' +
    'counts them; that <b>the noise restart&rsquo;s extra lead is the same value in all four places ' +
    'that state it and sits inside the bound all three places give</b>; that <b>B.13&rsquo;s ' +
    'disagreement count is the number of <code>unchanged</code> verdicts in B.13&rsquo;s own ' +
    'table</b>, and that section 16 says the same number; that the <b>Colour tab&rsquo;s revision ' +
    'intersection is the denominator its own comparison table uses</b>; that the <b>speed-switch ' +
    'stall agrees in both units on both tabs and carries its label on both</b>; that ' +
    '<b>E.2&rsquo;s five-point sweep is quoted correctly by its own prose and by the Colour ' +
    'tab</b>; that <b>section 22 names as many failing rows as the board counts</b>; and that ' +
    '<b>section 23&rsquo;s residue percentage re-derives from the two figures beside it</b>.</p>' +
    '<div class="gbemu-rule" id="gbr-G-7-3"><b>Rule G.7/3.</b> <b>Any figure you write or touch gets a check before you finish</b>, in ' +
    'the same edit, not in a later pass. When you add a figure that another figure is derived ' +
    'from, add the relation to the gate in that same edit: <b>not the value, the relation</b>.</div>' +
    '<div class="gbemu-why"><b>Why.</b> A gate built from an audit ' +
    'report covers exactly what has already been found and nothing that is being written ' +
    'that day, which is a property of how it was ' +
    'commissioned rather than of how it was coded. <b>A gate assembled from findings tests the ' +
    'past. A gate assembled from edits tests the present.</b> A relation added later is a relation added by ' +
    'somebody who no longer remembers which figures were derived from which.</div>' +
    '<p class="gbemu-key"><b>Three properties the gate has that a checker usually does not, each of them ' +
    'tied to a trap in G.3:</b> Rules G.7/4, G.7/5 and G.7/6.</p>' +
    '<div class="gbemu-rule" id="gbr-G-7-4"><b>Rule G.7/4.</b> <b>Struck text is removed before anything is read.</b></div>' +
    '<div class="gbemu-why"><b>Why.</b> A defensive measure: a page that supersedes a figure by striking it rather than ' +
    'deleting it leaves the old number in the markup, and a checker that read it would be reading ' +
    'the exact number it exists to catch.</div>' +
    '<div class="gbemu-rule" id="gbr-G-7-5"><b>Rule G.7/5.</b> <b>A check that cannot find its input fails</b>; it does not ' +
    'pass quietly and it does not skip.</div>' +
    '<div class="gbemu-why"><b>Why.</b> A gate that silently stops testing a section is ' +
    'worse than no gate, and a rewritten paragraph is precisely how a figure leaves its ' +
    'check&rsquo;s reach.</div>' +
    '<div class="gbemu-rule" id="gbr-G-7-6"><b>Rule G.7/6.</b> The gate must be proven in both directions before it is trusted, and every relation must be held to that standard one at a time. For each check:' +
    '<ol class="gbemu-steps">' +
      '<li>Mutate the check&rsquo;s guarded figure, on its own.</li>' +
      '<li>Run the gate and require it to fail <em>and to name that check</em>.</li>' +
      '<li>Revert the mutation.</li>' +
    '</ol>' +
    'A rule check is proven against the defect as it stood before the fix, and a widened ' +
    'accounting is proven against fresh unguarded statements of the figure it accounts for. A check that cannot be made to fire is not a check, and a check added without these steps is a claim about a ' +
    'check.</div>' +
    '<div class="gbemu-example"><b>Example.</b> Run ' +
    'against a tree carrying the six defects it was built from, the gate reports <b>six failures</b> and ' +
    'names each one, including <em>&ldquo;the page states owed = B + L &minus; (B &minus; L &minus; ' +
    'withheld), which does not conserve: B=2 L=3 spends 6 against a budget of 4&rdquo;</em>, which ' +
    'is the E.5 defect in one line. Against a tree with those six fixed it reports none.</div>' +
    '<div class="gbemu-why"><b>Why.</b> <b>A gate ' +
    'that has ' +
    'only ever been seen to pass has not been shown to be a gate</b>: that is trap 5 in G.3 (Rule G.3/5), ' +
    'and it applies to this file as much as to anything it checks. <b>Every check is mutation-proven before it is kept, and the tree is ' +
    'clean at 99 of 99 afterwards.</b></div>' +
    '<p class="gbemu-key"><b>Three ways a check can be worse than no check, all three of them ' +
    'defects in the checker rather than on the page:</b> Rules G.7/7, G.7/8 and G.7/9.</p>' +
    '<div class="gbemu-rule" id="gbr-G-7-7"><b>Rule G.7/7 (a check can enforce an error).</b> <b><em>A relation ' +
        'asserted by a check must itself be re-derived from the table, not from the figure the ' +
        'table currently carries.</em></b></div>' +
    '<div class="gbemu-example"><b>Example.</b> F.2&rsquo;s multi-label row and its ' +
        'excess-assignment row are different quantities (<b>15</b> and <b>17</b>), ' +
        'and a gate asserting <code>labelled + multi = assignments</code> is ' +
        'only true when no row carries three labels, which two of F.2&rsquo;s rows do. Such a ' +
        'check passes on the wrong figure and would <em>reject</em> the right one. The rule ' +
        'generalises well past the instance. F.2&rsquo;s eleven figures are recounted out of the ' +
        'F.4&ndash;F.7 tables on every run.</div>' +
    '<div class="gbemu-rule" id="gbr-G-7-8"><b>Rule G.7/8 (a check can be vacuous over its own sweep variable).</b> Mutate the variable a check sweeps, not just the figure it reads; a check that cannot fail for any value of its sweep variable must be given an assertion that can. <b>A sweep that cannot fail ' +
        'is a loop, not a check.</b></div>' +
    '<div class="gbemu-example"><b>Example.</b> A dot-budget check that ' +
        'sweeps E.1&rsquo;s leads and asserts <code>withheld + owed == 2B</code> is, under the ' +
        'shipped <code>owed = 2B &minus; withheld</code>, an <b>identity in the lead</b>. No ' +
        'value any E.1 row could carry can fail it, and mutating three different leads leaves the ' +
        'run green, so reading the leads out of ' +
        'E.1 &ldquo;extends the check by construction&rdquo; (Rule G.7/2) extends only the sweep, and the ' +
        'sweep decides nothing. The check therefore also requires the <em>rejected</em> ' +
        'form (the same expression with the other sign) to fail somewhere in the ' +
        'sweep, ties the page&rsquo;s worked counter-example to a lead E.1 actually carries, and ' +
        'requires the worked examples&rsquo; worst case to be E.1&rsquo;s largest lead. <b>All ' +
        'three fire when a lead moves. The identity alone never fires.</b></div>' +
    '<div class="gbemu-rule" id="gbr-G-7-9"><b>Rule G.7/9 (a gate that cannot bootstrap must still return a verdict).</b> The gate must report a verdict on every run, including a run that cannot render the page. To that end:' +
    '<ol class="gbemu-steps">' +
      '<li>The counters and the verdict sit above the render.</li>' +
      '<li>Every module-scope extraction lives inside a named bootstrap check.</li>' +
      '<li>Anything still able to escape is caught and reported as a <b>gate</b> defect with a verdict line.</li>' +
    '</ol></div>' +
    '<div class="gbemu-why"><b>Why.</b> Extractions that run ' +
        'at module scope sit outside the harness, so renaming one anchor throws before any check ' +
        'runs: exit 1, ' +
        '<b>zero checks reported, no MISSING line and no verdict</b> (the larger version of ' +
        'the silent skip Rule G.7/5 forbids).</div>' +
    '<div class="gbemu-example"><b>Example (proven both ways).</b> Renaming the board anchor gives ' +
        '<em>FAIL bootstrap: the board factbox this whole gate depends on is reachable</em> and a ' +
        'verdict; breaking the tab&rsquo;s exported function gives <em>FAIL gate bootstrap</em> and ' +
        'a verdict.</div>' +
    '<p class="gbemu-key"><b>And twenty relations for pairs that would otherwise go unguarded</b>, ' +
    'ordered by what it would cost to get them wrong rather than by where they sit. The ' +
    '<b>post-boot divider</b>, which exists in three copies across two tabs; the <b>118-of-120 pixel residue</b>, restated six times; <b>24,575 against the ' +
    '&plusmn;480 mixer domain</b>; <b>456 &times; 154 = 70,224</b> and the frame rate that follows; the ' +
    '<b>264/288 scorer pair</b> section 21 warns must never be differenced; the <b>power-on ' +
    'line&rsquo;s 451 and 76</b> together with the phase-offset refutation that rests on them; the ' +
    '<b>6-dot access close</b> and the dot it lands on; the <b>knock-out price table</b>, ' +
    'duplicated cross-tab, with its conservation and its prose decomposition; <b>section 20&rsquo;s ' +
    'label table against F.2</b>; <b>F.2&rsquo;s hardware sentence against the sweep&rsquo;s own ' +
    'scope</b>; <b>section 20&rsquo;s census</b>; a <b>heading that counts its own bullets</b>; ' +
    '<b>G.2&rsquo;s per-suite triples against section 21&rsquo;s table</b>; <b>B.15&rsquo;s shipped ' +
    'noise constants across four statements</b>, including whether its validating table can ' +
    'exercise the term it validates; <b>B.11&rsquo;s power-off range against its own exception</b>; ' +
    'the <b>Colour boot image&rsquo;s size, ranges and hole</b>; the <b>boot program&rsquo;s three ' +
    'block transfers against the tile-map copy</b>; the <b>Colour tab&rsquo;s prohibition count</b>; ' +
    '<b>F.9&rsquo;s counting rule against the words this file counts</b>; and <b>B.4&rsquo;s duty ' +
    'table against the prose that describes it</b>. The two bootstrap proofs of Rule G.7/9 are the only mutations that ' +
    'test the gate rather than the page.</p>' +
    '<p class="gbemu-key"><b>And five more relations for figures that would otherwise be uncovered.</b> <b>160 &times; 144 = 23,040 ' +
    'pixels</b>, against every statement of it on either tab and against the E.2 ' +
    'colour sweep it is the base of; the <b>69 / 9 / 200 double-speed adjustment census</b>, three ' +
    'copies across two tabs, with the 9 inside the 69; the <b>136-pixel positive control and the 252 and ' +
    '33 probe denominators</b>, cross-tab, together with the window-takeover census that shares ' +
    'them; the <b>sprite-memory transfer&rsquo;s 160 machine cycles against its 640 and 320 ' +
    'dots</b>, both copies; and the <b>frame sequencer&rsquo;s 512 Hz against the divider bit it is ' +
    'taken from</b>, five copies across two tabs, with 1024 as twice 512 and bit 13 as bit 12 plus ' +
    'one. Three checks re-derive from the table underneath a figure rather than from the figure (Rule G.7/7): <b>the heading check covers every heading that counts what follows it</b> (four of them); <b>the Colour tab&rsquo;s prohibition count counts prohibitions in the table</b>; and <b>B.15&rsquo;s check evaluates the expression against every arm of its ' +
    'validating table</b>.</p>' +
    '<p class="gbemu-key"><b>The count of checks is ' +
    'itself a figure with a dependent</b>, and this sentence is where it lives: <b>the gate asserts 99 checks</b>, and the gate&rsquo;s own ledger check fails if that number and the ' +
    'number of checks that ran ever differ. <b>This appendix names the relations worth naming ' +
    'and does not enumerate all ninety-nine</b>: the gate file is the enumeration, and a ' +
    'diff of it is the only reliable account of what a change added.</p>' +
    '<p class="gbemu-key"><b>Twenty-four of those checks are the NES tab&rsquo;s, and they were ' +
    'written in the same edit as the page they check</b> (Rule G.7/3). <b>What is different ' +
    'about that tab, and it weakens what a check there can be:</b> its subject has no external ' +
    'authority at all, so every one of its relations is internal. A table against the prose ' +
    'that counts it, a total against its parts, a derived constant against the sweep it has to sit ' +
    'inside. <b>Twenty-two mutations, twenty-two named failures, each applied on its own and ' +
    'reverted.</b></p>' +
    '<p class="gbemu-key"><b>More of the same defect, one level up: checks that claim more ' +
    'than they do, and how each is closed:</b> Rules G.7/10 to G.7/13, then two checks of their own kind.</p>' +
    '<div class="gbemu-rule" id="gbr-G-7-10"><b>Rule G.7/10.</b> <b>A check whose name overstates its coverage is a wrong figure.</b> A check&rsquo;s name must not claim more statements than the check reads.</div>' +
    '<div class="gbemu-example"><b>Example.</b> ' +
        'A check called &ldquo;the frame geometry, wherever either tab states it&rdquo; that reads ' +
        '<b>six of nine</b> statements is not the check its name describes: it can stop one ' +
        'sentence short of a factbox, miss a sentence that says &ldquo;steps&rdquo; where the ' +
        'pattern wanted &ldquo;dot steps&rdquo;, and <em>extract</em> a table row and then use ' +
        'one of its three numbers. A name like &ldquo;the post-boot divider: every copy on ' +
        'both tabs&rdquo; makes the same promise and breaks the same way: reading four ' +
        'extraction points out of twenty-one statements, and leaving out section 3&rsquo;s own ' +
        'handover row (the first one an implementer copies) satisfies the code and not ' +
        'the name.</div>' +
    '<div class="gbemu-rule" id="gbr-G-7-11"><b>Rule G.7/11.</b> Coverage is <b>ACCOUNTED</b>: every extraction records the span of text it ' +
        'consumed, and at the end the ' +
        'check sweeps the whole page for the figure and fails on any occurrence outside every ' +
        'span. The mutation that proves it is a new unguarded sentence, which the run must name as unguarded.</div>' +
    '<div class="gbemu-why"><b>Why.</b> Widening such a check by hand rots by the next paragraph. <b>A tenth statement of the frame, written next week, fails this gate until it is ' +
        'guarded.</b> That is the only way a name with &ldquo;every&rdquo; in it stays true.</div>' +
    '<div class="gbemu-rule" id="gbr-G-7-12"><b>Rule G.7/12.</b> <b>A relation the page calls its own reason to believe two tables needs a check behind ' +
        'it.</b></div>' +
    '<div class="gbemu-example"><b>Example.</b> The Colour tab says the palette assignment and the colour census ' +
        '&ldquo;were taken by different instruments and agree colour for colour; that agreement is ' +
        'the reason to believe either&rdquo;, and without a check a palette word can be ' +
        'changed in one table, the census left alone, and the gate still reports all green. The ' +
        'two tables are ' +
        're-derived against each other, against the 5-to-8 expansion the page calls its own proof ' +
        'of the census, and against the palette byte budget: the assignment spans both stores (24 of 128 bytes, and 104 untouched), so a procedure naming only <code>0xFF69</code> and calling the remainder forty, which is arithmetic for a single 64-byte store, fails it.</div>' +
    '<div class="gbemu-rule" id="gbr-G-7-13"><b>Rule G.7/13.</b> <b>An identity that hides a known disagreement must be evaluated, not stated.</b></div>' +
    '<div class="gbemu-example"><b>Example.</b> The ' +
        'whole argument for why no board row separates the two <code>FF6C</code> arms is ' +
        '<code>0xFE | 1 == 0xFF == open bus</code>, stated in three places. ' +
        'It is computed, with the settling cartridge&rsquo;s different write required to make ' +
        'the two arms actually part.</div>' +
    '<ul class="gbemu-bullets">' +
      '<li><b>And one check that is not a figure relation at all, because the defect it guards is ' +
        'not a figure.</b> Prose cannot guard prose, so where D.6 lists <code>DAA</code>&rsquo;s ' +
        'two add-branch tests the gate brute-forces the page&rsquo;s own listing in its own ' +
        'order and reversed, against the core, over all 1024 add-branch inputs, and <b>requires ' +
        'the reversed order to be wrong</b>. If the divergence ever disappears, the listing has ' +
        'been changed and the check says so.</li>' +
      '<li><b>And the ledger is checked too, because a count of checks is a figure like any ' +
        'other</b>, and the only thing that <em>can</em> re-derive it is the gate. <b>The last ' +
        'check in the file counts itself</b> and compares the total with the ledger sentence (&ldquo;the gate asserts &hellip; checks&rdquo;) ' +
        'and with the mutation-proof line (&ldquo;the tree is clean at &hellip; afterwards&rdquo;, Rule G.7/6).</li>' +
    '</ul>' +

    '<h4 class="gbemu-sub">Guarding a rule rather than a number</h4>' +
    '<p class="hw-readable"><b>A rule can be stated correctly in one place and wrongly in another, and that defect is not a number.</b> ' +
    '<b>A gate ' +
    'that relates numbers cannot see it</b>, and <b>a page that closes numeric holes for long enough will find its prose ' +
    'restatements have grown to fill the space.</b> Three rules on this page are restated in a second place: ' +
    'E.3&rsquo;s object-stall window (restated in the one paragraph offered as the portable form), ' +
    'E.1.3&rsquo;s balance law (beside the constant E.5 derives) and ' +
    'section 4&rsquo;s timer overflow (three writes that misbehave, counted by appendix A). Rules G.7/14 to G.7/17 say which of the three a gate can guard, and how.</p>' +
    '<div class="gbemu-rule" id="gbr-G-7-14"><b>Rule G.7/14.</b> <b>Coverage accounting belongs in the extractors, not in the checks.</b> ' +
        'Every <code>grab</code> in the file records the span of page text it ' +
        'consumed, and one sweep at the end asks, of every figure the gate claims to guard, ' +
        'whether every statement of it on either tab fell inside something some check actually ' +
        'read. <b>A check written next week joins the scheme the moment it calls ' +
        '<code>grab</code></b>, and a figure joins it by one line in a registry rather than by a ' +
        'rewrite of the check that owns it.</div>' +
    '<div class="gbemu-why"><b>Why.</b> A mechanism that makes two checks account for every site they claim reaches two checks ' +
        'and no more: inject a tenth statement of the frame geometry and the gate fails ' +
        'correctly, but inject a new paragraph restating the board and it passes, and where the ' +
        'Colour tab states a figure twice, mutating the copy no check reads passes. <b>Nine figures are in the registry and all nine are ' +
        'read everywhere they appear</b>: the frame, the divider, the board of record, ' +
        'the board denominator, the shared-basis denominator, the scanline, the master clock, the ' +
        'doubled clock divisor and the sprite-transfer length.</div>' +
    '<div class="gbemu-rule" id="gbr-G-7-15"><b>Rule G.7/15.</b> <b>A registry entry is a guard ' +
        'only if it captures the quantity rather than the answer.</b> Capture the quantity; let the equality have something ' +
        'to disagree with.</div>' +
    '<div class="gbemu-why"><b>Why.</b> An extraction pattern whose ' +
        'capture group contains the literal it is checking can never disagree with the page, and ' +
        'the coverage sweep then hunts for that same literal, so a site edited to a different ' +
        'value does not merely pass (it disappears from the value check and from the sweep ' +
        'that exists to find exactly that).</div>' +
    '<p class="hw-readable"><b>And the harder question: can a RULE be guarded, or only a number?</b> ' +
        '<b>Two of the three can, and the route in is the same both times: a rule with a ' +
        'computable consequence is guardable through the consequence.</b> E.3&rsquo;s window is a ' +
        'set, and a set produces a wait ladder; the gate re-derives the ladder from every ' +
        'statement of the window on the page and requires them to agree, evaluates the two refuted ' +
        'windows in the same arithmetic, and requires them to keep producing exactly the ladders ' +
        'written beside them. E.1.3&rsquo;s balance law is an equation; the gate evaluates it ' +
        'beside E.5&rsquo;s over both speed budgets and every lead E.1&rsquo;s table states. ' +
        '<b>And the trap inside that fix is the one to carry away.</b> A check that reads only ' +
        'the literal set <code>{4,5,6}</code> out of the portable paragraph&rsquo;s last clause ' +
        'never touches the sentence that <em>derives</em> it (not &ldquo;first&rdquo;, not ' +
        'the push exclusion, not pos 4, pos 5 or pos 7), so softening the ordinal while ' +
        'leaving the set intact passes, with that very check reporting <code>ok</code>.</p>' +
    '<div class="gbemu-rule" id="gbr-G-7-16"><b>Rule G.7/16.</b> <b>A paragraph guarded by its conclusion is not guarded by its rule, so the check reads the rule.</b> It extracts the ordinal, ' +
        'the push clause and the three positions, composes them into a window, and requires that ' +
        'window to equal the set the sentence concludes with and to produce the published ' +
        'ladder.</div>' +
    '<div class="gbemu-example"><b>Example.</b> Softening &ldquo;first&rdquo; to &ldquo;second&rdquo; reports the derived ' +
        '<code>{5,6}</code> against the stated <code>{4,5,6}</code> and prints ' +
        '<code>12 11 10 9 8 7 6 6</code> beside the published <code>11 10 9 8 7 6 6 6</code>; ' +
        'deleting the push clause reports <code>{4,5,6,7}</code> and its ladder.</div>' +
    '<p class="hw-readable"><b>The third cannot be, and saying so is the point of this paragraph.</b> A missing ' +
        'ARM (a section describing two abnormal timer writes where the core keeps three) breaks no relation and has no computable consequence on this page. <b>What is ' +
        'recoverable is the count, and only the count:</b> appendix A states how many abnormal ' +
        'writes section 4 carries and section 4 enumerates them, which is a figure and its ' +
        'dependent, and they are wired together. <b>It does not ' +
        'guard what any arm SAYS.</b> An arm stated wrongly still passes, and no mechanism on this ' +
        'page will catch it.</p>' +
    '<div class="gbemu-rule" id="gbr-G-7-17"><b>Rule G.7/17.</b> When a paragraph restates a rule ' +
        'derived elsewhere on this page, it carries the derivation&rsquo;s own terms, or a worked ' +
        'consequence the gate can evaluate, or it does not get written.</div>' +
    '<div class="gbemu-why"><b>Why: the honest limit, stated rather than left to be found.</b> ' +
        '<b>Prose cannot be checked mechanically</b>, and the errors that survive are exactly the ' +
        'ones no gate we could write would catch: a symptom ' +
        'stated with the sign inverted, a warning naming the wrong axis, an illustrative pair that ' +
        'does not illustrate. Each is a sentence that is wrong about arithmetic sitting two ' +
        'lines above it and correct. Rule G.7/17 is the discipline that replaces the check, because a stated ' +
        'limit is worth more than a check that pretends. <b>The portable ' +
        'restatement is the highest-risk paragraph on a page like this</b>: it is the one an implementer lifts <em>because</em> it is free of our internal names, which is ' +
        'exactly what puts it out of reach of every check indexed on those names.</div>' +
    '<p class="gbemu-key"><b>The gate holds the numbers and reads none of the words around them</b>, so a ' +
    'gloss beside a figure can drift while the figure itself stays right, which is the ' +
    'same shape as every defect in this appendix, and it reaches the one paragraph whose ' +
    'subject is the gate.</p>' +
    '<div class="gbemu-rule" id="gbr-G-7-18"><b>Rule G.7/18.</b> <b>The procedure, which is the part to copy if you build your own ' +
    'page:</b>' +
    '<ol class="gbemu-steps">' +
      '<li>Run the gate after any change to a figure, before publishing.</li>' +
      '<li>Treat a failure as a blocking defect rather than a note.</li>' +
      '<li>When a figure you add has another figure derived from it, add the relation in the same edit (Rule G.7/3).</li>' +
      '<li>When a check fails, decide which of the two numbers is wrong <em>by re-deriving it from its ' +
    'source</em>, never by making one match the other.</li>' +
    '</ol></div>' +
    '<div class="gbemu-why"><b>Why.</b> Every one of the defects this gate was built ' +
    'from would have been &ldquo;fixable&rdquo; in the wrong direction, and two of them by editing ' +
    'the figure that was right.</div></section>' +

  /* ================================================================ APP-H
   * THE CARTRIDGE MAPPERS, which section 24 scopes out and this appendix
   * supplies. 34 board
   * rows sit behind this appendix -- mooneye mbc1 13, mbc2 7, mbc5 8, cpp 3,
   * ax6 3 -- and half of them fail SILENTLY: a wrong mapper does not crash,
   * it returns the wrong bank. Transcription from this core's cartridge
   * paths, so the board is what verifies it.                            */
  '</div>';
}
