/* ===========================================================================
 * Game Boy Color Emulation tab, area 1 of four: Overview, checklist, and what differs from the Game Boy
 * gbcMachineEmulationTabHTML(d) returns this area's HTML; the tab's composer in
 * gbc-emulation-tab.js calls every area in order (2 November 2026: the tab
 * was split into area files so a builder can read one area at a time).
 * Loaded by a plain <script src> tag (the site must open over file://).
 * =========================================================================== */

function gbcMachineEmulationTabHTML(d) {
  return '<div class="gbemu-area" id="gbcemu-area-machine">' +

  '<section class="gbemu-hero">' +
    '<div class="gbemu-hero-num"><b>259</b>\n<span>of 264</span>\n</div><div class="gbemu-hero-txt"><h3>How to build a Game Boy Color, starting from a Game Boy that is already right</h3>' +
      '<p>This is the research for the colour machine, written to the same standard as the ' +
      'original&rsquo;s page and assuming you have read it: everything there is still true here, and ' +
      'this page is only what the Color adds, changes and breaks. The number beside it is the ' +
      'board score this core earns (below). One fact belongs beside it: <b>not one colour behaviour in this project is attested by a measurement on real ' +
      'Color hardware</b>: every figure is scored against another emulator&rsquo;s stored ' +
      'render or against two independent implementations agreeing. That does not make the ' +
      'mechanisms below wrong. It means section&nbsp;17 is the part you must read before quoting ' +
      'any number from this page.</p>' +
      '<p>The core these pages describe stands at <b>259 passing rows of 264</b> on the public Game ' +
      'Boy Emulator Shootout board, on a <em>PASS-only, all-264-rows</em> basis: one board ' +
      'covering both machines. Section&nbsp;17 gives that basis in full, says why published ' +
      'comparisons are not like-for-like, and names which of the remaining rows nobody can win ' +
      'honestly. <b>Quote a basis or the number means nothing.</b></p>' +
    '<div class="gbemu-rule" id="gbcr-0-1"><b>Rule C0/1.</b> A build must implement everything the core this site ships does, with the values this page gives as current. A build that wants to match ours must leave out three kinds of thing: (1) anything this page describes as switched off, an off arm, a research arm, refused, not shipped, or written but behind a switch that is off; (2) anything this page puts outside the core (the site&rsquo;s player, the host&rsquo;s devices and files); (3) any earlier value or earlier core this page or a record names as history: building it gives an older core, not a second valid one. On the original, four parts belong together and a build must implement all four: the running processor&rsquo;s two-dot look, the drawing registers&rsquo; extra machine cycle, the dispatch holds of 3 and 1, and the mode-1 source on dot 6. Every other part this page describes is required: a build that leaves one out has a gap in that build, not an option.</div>' +
    '<div class="gbemu-why"><b>Why.</b> These pages describe the core this site ships, and both tabs state this same rule. History is kept off the tab (it lives in the developer changelog) so older records can still be read. A build with only some of the four original-machine parts, or none of them, is not the core this site is scored against.</div>' +
    '<div class="gbemu-rule" id="gbcr-0-2"><b>Rule C0/2.</b> A build of the Color must implement every part on this checklist. Item 1 is the Game Boy tab&rsquo;s own checklist, and it is built first: where this page says nothing different, the original&rsquo;s rule holds. Each later item names the section that specifies the part and the area file that holds it (this page is split into four area files, listed after this introduction).</div>' +
    '<p class="gbemu-key"><b>The build checklist: every part a build of the Color must implement.</b></p><ul class="gbemu-bullets" style="list-style:none;padding-left:4px"><li>1. <b>Everything on the Game Boy tab&rsquo;s checklist first.</b> The Color runs the original&rsquo;s machine underneath; where this page says nothing different, the original&rsquo;s rule holds. <i>File: the Game Boy tab&rsquo;s eight area files, <code>gb-*-emulation-tab.js</code>.</i></li><li>2. <b>The start</b>: the boot program&rsquo;s two pieces and the hand-over, the register file by branch, KEY0 and compatibility mode, the divider by header, the no-boot fallback and the booted lists (section 2). <i>File: <code>gbc-machine-emulation-tab.js</code>.</i></li><li>3. <b>Double speed</b>: KEY1, the switch, the 32,769-cycle stall, the speed change counted in machine cycles, the divider&rsquo;s one reset, the picture&rsquo;s move, the frame sequencer&rsquo;s delay, what scales and what does not (section 3). <i>File: <code>gbc-timing-emulation-tab.js</code>.</i></li><li>4. <b>Work RAM</b>: eight banks, the register&rsquo;s 0-to-1 rule (section 4). <i>File: <code>gbc-timing-emulation-tab.js</code>.</i></li><li>5. <b>Video memory</b>: two banks, the attribute byte, the access rules and windows at both speeds (section 5). <i>File: <code>gbc-ppu-emulation-tab.js</code>.</i></li><li>6. <b>Palette memory</b>: indexes, auto-increment and wrap, the busy window, colour conversion (section 6). <i>File: <code>gbc-ppu-emulation-tab.js</code>.</i></li><li>7. <b>Priority</b>: the bit that means two things (section 7). <b>Objects</b>: the attribute byte, bank and palette, the priority order by mode (section 8). <i>File: <code>gbc-ppu-emulation-tab.js</code>.</i></li><li>8. <b>Compatibility mode</b>: which registers are alive, the compatibility palette and what the host supplies for it (section 9). <i>File: <code>gbc-ppu-emulation-tab.js</code>.</i></li><li>9. <b>The Color&rsquo;s picture timing</b>: the CPU-visible timing table, interrupt sources and LY, the LCDC train, the tile-data select glitches, the E.1 Color column, the window on the Color, the processor-to-dot phase (section 10). <i>File: <code>gbc-ppu-emulation-tab.js</code>.</i></li><li>10. <b>Block transfers</b>: general-purpose and horizontal-blank, their timing at both speeds, cancel, display off (section 11). <i>File: <code>gbc-timing-emulation-tab.js</code>.</i></li><li>11. <b>Sprite-memory transfer on the Color</b>: the bus split, the conflict read (section 12). <i>File: <code>gbc-timing-emulation-tab.js</code>.</i></li><li>12. <b>Sound on the Color</b>: the unit off the processor&rsquo;s clock, the sample grid in double speed, <code>FF76</code>/<code>FF77</code>, 512 Hz in double speed, the wave rule, the power and length splits (section 13). <i>File: <code>gbc-apu-emulation-tab.js</code>.</i></li><li>13. <b>The undocumented registers</b> (section 14) and <b>the revision choices</b> this core makes (section 15). <i>Files: <code>gbc-timing-emulation-tab.js</code>, <code>gbc-machine-emulation-tab.js</code>.</i></li><li>14. <b>Every Color register, bit by bit</b> (appendix A). <i>File: <code>gbc-timing-emulation-tab.js</code>.</i></li></ul>' +
    '<div class="gbemu-why"><b>Result of a build from these pages.</b> An independent build that read only the two tabs (the Game Boy tab and this one) wrote a Game Boy Color in plain JavaScript. It had none of our test programs; we ran them on it and compared it with our core. It is identical to ours, with the same verdict and every checkpoint byte for byte, on 94 of 94 Color test runs (73 of them sound), 167 of 167 Game Boy test runs (12 of them sound) and 3 of 3 Super Game Boy runs; it gives the same verdict as ours on all 60 AGE runs and the same picture as ours on all 24 mealybug cells it was scored on. The board figure beside the title is our core&rsquo;s.</div></div></section>' +
  gbcEmuAreaIndexHTML() +

  '<section class="sect" id="gbce-glossary"><h3 class="sect-h">Glossary</h3>' +
    '<p class="hw-readable">Every technical word on this tab is used only in the sense given here; words the Color shares with the original are defined in the Game Boy tab&rsquo;s glossary and used here in the same sense.</p>' +
    '<h4 class="gbemu-sub">Overview and start (sections 1, 2, 15 to 18)</h4>' +
    '<dl class="gbemu-gloss">' +
      '<dt>Hand-over state (Color tab)</dt><dd>The <b>booted</b> state: what the real Color boot program leaves at the first instruction at 0x0100, given by the measured lists. (Rule C2/13, Rules C2/18, C2/19)</dd>' +
      '<dt>No-boot fallback (no-boot start)</dt><dd>Our core&rsquo;s start of a Color with no boot program: a partial copy of the hand-over state, for instruments only, not a way to run. (Rules C2/14 to C2/17)</dd>' +
      '<dt>Colour-mode flag</dt><dd><code>!(v &amp; 0x0C)</code> for the value v written to KEY0 (0xFF4C) while the boot program is mapped; true means colour mode. Never called the compatibility flag. (Rule C2/3)</dd>' +
      '<dt>Colour mode / compatibility mode</dt><dd>The two modes the colour-mode flag selects: colour mode when true; compatibility mode (the Color running a cartridge with no Color flag as the original would) when false. (Rule C2/3)</dd>' +
      '<dt>Color-flagged cartridge</dt><dd>A cartridge whose header byte $0143 has bit 7 set. "No Color flag" / "unflagged": bit 7 clear. (Rule C2/6)</dd>' +
      '<dt>Title checksum</dt><dd>The sum of header bytes $0134 to $0143 modulo 256; handed off in B only by the licensee test. (Rule C2/7)</dd>' +
      '<dt>Nintendo licensee (licensee test)</dt><dd>$014B = 0x01, or $014B = 0x33 with $0144, $0145 the ASCII characters 0 and 1 respectively. (Rule C2/7)</dd>' +
      '<dt>Revision (silicon) / boot program image revision</dt><dd>Silicon revisions are 0, A, B, C, D, E (this core targets C); "revision 2" is the revision of the boot program image, a different axis. (Rule C15/1)</dd>' +
      '<dt>Dead (register)</dt><dd>A register that no longer changes the machine when written: KEY0 after the 0xFF50 write. (Rule C2/3)</dd>' +
      '<dt>Steps (in "5,570 steps")</dt><dd>Calls of our core&rsquo;s processor step loop (the instruction step), not dots or machine cycles. (section 2, boot program bullets)</dd>' +
      '<dt>Render (colour board)</dt><dd>A reference image with 8 or fewer distinct colours; images with more are not renders and are not scored. (Rule C17/1)</dd>' +
    '</dl>' +
    '<h4 class="gbemu-sub">Timing, double speed, transfers (sections 3, 4, 11, 12, 14, appendix A)</h4>' +
    '<dl class="gbemu-gloss">' +
      '<dt>CPU T-cycle</dt><dd>one period of the processor&rsquo;s own clock: four per machine cycle at both speeds; one T-cycle (one dot) at single speed, half a T-cycle (half a dot) in double speed. "Processor T-cycles" means the same. Used for the community figure for the speed-switch stall (131,080 CPU T-cycles; this core&rsquo;s stall is the shorter one of Rule C3/4), the frame (140,448 CPU T-cycles in double speed) and the real-time-clock divisor (Color tab, section 3 (units paragraph), Rule C3/1)</dd>' +
      '<dt>going up / coming down</dt><dd>a speed switch from single speed to double speed / from double speed to single speed (Color tab, section 3 (units paragraph))</dd>' +
      '<dt>armed (KEY1)</dt><dd>bit 0 of 0xFF4D, written by the processor; a STOP in colour mode with it set takes the speed switch (Color tab, Rules C3/2, C3/4)</dd>' +
      '<dt>stalled machine cycle</dt><dd>one machine cycle of the speed-switch stall, numbered from 1 starting with the first machine cycle after the STOP&rsquo;s operand fetch; it lasts the dots of the speed in force during it (Color tab, Rule C3/4)</dd>' +
      '<dt>speed flip</dt><dd>the moment the current speed (KEY1 bit 7) changes: the start of machine cycle 2 after the STOP&rsquo;s operand fetch, before that cycle is clocked, so machine cycle 1 runs at the old speed and cycle 2 at the new (Rule C3/4); with an interrupt already pending on revisions B and C, the start of machine cycle 3. It is counted in machine cycles whether the processor is halted or running (Rule C3/5).</dd>' +
      '<dt>the device / colour mode (as register gates)</dt><dd>"the device": true on any Color, also running an original cartridge; "colour mode": false on a Color running a cartridge with no Color flag (compatibility mode) (Color tab, Rule C4/1)</dd>' +
      '<dt>cursor (block transfer)</dt><dd>the destination as written with its low four bits cleared at the register write, advanced by one per byte; each byte goes to 0x8000 ((cursor &amp; 0x1FFF) in the bank FF4F selects)</dd>' +
      '<dt>byte slot</dt><dd>the time one byte of a block takes: one machine cycle in double speed; the double-speed horizontal-blank block spends one before its first byte (Color tab, Rule C11/8)</dd>' +
    '</dl>' +
    '<h4 class="gbemu-sub">Picture (sections 5 to 9)</h4>' +
    '<dl class="gbemu-gloss">' +
      '<dt>Colour mode</dt><dd>A Color running a cartridge with the Color flag (our source: <code>cgb_mode</code> set). (Color tab, section 5 head paragraph; section 9)</dd>' +
      '<dt>Compatibility mode</dt><dd>A Color running a cartridge without the Color flag (<code>cgb_mode</code> clear): colour hardware mostly off, the double colour resolution on. Not the same as "the original" and not the same as "the device is an original". (Color tab, section 5 head paragraph; Rule C9/1)</dd>' +
      '<dt>Attribute byte (background)</dt><dd>The bank-1 byte at the same offset as a tile-map cell in bank 0: palette, bank, flips, priority. Acts as 0x00 outside colour mode. (Rules C5/1, C5/3)</dd>' +
      '<dt>Last-pixel dot</dt><dd>The dot the line&rsquo;s 160th pixel leaves the background queue (its pop dot); 256 at SCX 0 with no objects. The palette data ports&rsquo; busy window closes on the last-pixel dot + 4 (access scale). (Rule C6/3)</dd>' +
      '<dt>Busy window (palette data ports)</dt><dd>The access-scale dots on which a write to 0xFF69/0xFF6B is dropped (index still advances) and a read returns 0xFF: lines 0 to 143, display on, from dot 84 (87 in double speed) to the last-pixel dot + 3. (Rule C6/3 and its table)</dd>' +
      '<dt>Palette word</dt><dd>The 15-bit little-endian colour (red bits 0-4, green 5-9, blue 10-14) of one palette entry; the core emits it raw (BGR555). (Rules C6/1, C6/6, C6/8)</dd>' +
      '<dt>Index rule / smaller-X rule</dt><dd>The two object merge rules: lower OAM memory index wins regardless of X (latched bit 0 = 0) / first opaque arrival in fetch order wins, which is the smaller X (latched bit 0 = 1). (Rule C8/2)</dd>' +
      '<dt>Latched rule (object priority)</dt><dd>Bit 0 of the 0xFF6C byte written while the boot program is mapped; distinct from the stored register byte, which colour-mode writes after the hand-over still change. (Rule C8/3)</dd>' +
      '<dt>Held under</dt><dd>An opaque object pixel loses to the background: (background attribute bit 7 OR object attribute bit 7) AND background colour index not 0 AND LCDC bit 0 set (Color). (Rule C7/2)</dd>' +
      '<dt>Double resolution</dt><dd>In compatibility mode a colour index goes through BGP/OBP0/OBP1 to a shade, and that shade is the entry number in a Color palette. (Rule C9/1)</dd>' +
    '</dl>' +
    '<h4 class="gbemu-sub">Picture timing (section 10)</h4>' +
    '<dl class="gbemu-gloss">' +
      '<dt>lead dots, conflict dot, commit dot (C)</dt><dd>the dots of the LCDC write train: lead dots C - 3 and C - 2, conflict dot C - 1 (the register holds the two-stage intermediate), commit dot C (a tag-8 consumer reads the new value) (Rule C10/9; the Game Boy tab E.9)</dd>' +
      '<dt>owed budget</dt><dd>the dots an LCDC write that takes the train owes to the picture after its own machine cycle: 5 at single speed (the original&rsquo;s), 3 in double speed on the Color (Rules C10/3, C10/4)</dd>' +
      '<dt>two-stage intermediate</dt><dd>the LCDC value on the conflict dot: old OR (new AND 1), with bit 1 cleared when the written value clears it (Rule C10/3)</dd>' +
      '<dt>the train</dt><dd>the LCDC write&rsquo;s lead dots, conflict dot and commit dot, run only for writes landing in mode 3 with the display on (Rules C10/3, C10/9)</dd>' +
      '<dt>read dot</dt><dd>the dot on which a fetcher step&rsquo;s read executes: the second dot of its two-dot step (Rules C10/14, C10/15)</dd>' +
      '<dt>set write, clear write (of bit 4)</dt><dd>an LCDC write whose incoming bit 4 is 1 while the "before" value&rsquo;s bit 4 is 0 (set), or the reverse (clear) (Rules C10/15, C10/16; for the per-line count, Rule C10/23 judges on the write&rsquo;s own two values)</dd>' +
      '<dt>"before" value</dt><dd>the value a substitution rule compares the incoming bit 4 against: the live register on the lead dots, otherwise a stored copy of the most recent write sequence&rsquo;s pre-write value, updated when the conflict dot ends (Rule C10/16)</dd>' +
      '<dt>stash (last unsigned byte, last object byte, tile stash)</dt><dd>bytes kept from earlier tile-data or object reads that the set rules deliver as substitutes; cleared only by reset (Rule C10/20)</dd>' +
      '<dt>age (of an object fetch)</dt><dd>the read dot minus the dot on which the most recent object fetch of the line ended (Rules C10/12, C10/18)</dd>' +
      '<dt>discharged</dt><dd>a fence site with its own Color arm, recording no breach (section 10, "three words")</dd>' +
      '<dt>unresolved</dt><dd>a fence row with no Color arm; at run time it returns the original&rsquo;s value and records a breach (a declared placeholder) (section 10, "three words")</dd>' +
      '<dt>carried</dt><dd>code with no device test; the original&rsquo;s behaviour runs on both machines and no fence row records it (section 10, "three words")</dd>' +
      '<dt>fence row</dt><dd>our source&rsquo;s name for a place where the Color might differ from the original; a pointer into the source, like a constant&rsquo;s name (section 10, the Color column for appendix E.1)</dd>' +
      '<dt>timing block</dt><dd>the Color&rsquo;s own processor-visible timing values (CT_ON = 1 in our source): LY, STAT mode bits, requests, wake, speed switch, access windows, per speed (Rule C10/35)</dd>' +
      '<dt>line-144 one-shot</dt><dd>the Color&rsquo;s mode-2-select status request written straight into IF on line 143 (event dot 454 single speed, 451 double), one machine cycle (single speed) before the vertical-blank request; it never drives the status line (Rule C10/39)</dd>' +
      '<dt>priming increments</dt><dd>the window position counter&rsquo;s seven increments at the start of mode 3 (line dots 90 to 96 at SCX 0 with no object); paused on every dot an object fetch is in progress (Rules C10/30, C10/32)</dd>' +
      '<dt>notice-dot increment</dt><dd>the priming increment on the dot an object is noticed; kept on the Color, handed back on the original when the fetcher is on the first dot of a step (Rule C10/32)</dd>' +
    '</dl>' +
  '</section>' +


  '<section class="sect gbemu-area-head" id="gbcemu-area-machine-head"><h3 class="sect-h">Area 1 of four: Overview, checklist, and what differs from the Game Boy</h3>' +
    '<p class="gbemu-key">Start here: what changes from the original and what does not, the build checklist (each line names the file that holds the part), where the Color starts, the revision choices, what to test with, what the evidence is worth and what is not settled.</p>' +
    '<p class="hw-readable">This area is the file <code>gbc-machine-emulation-tab.js</code>, one of the four area files that together make the Game Boy Color Emulation tab. It can be read on its own; the build checklist is in the first area, and the rule for what a build must implement is beside it.</p>' +
    '<p class="hw-readable"><b>Where the rest of this page is.</b> When a sentence here points to a section or appendix that is not in this area, it is in one of these files (the links work on the assembled page):</p><ul class="gbemu-bullets"><li><b>Processor-visible timing, double speed, transfers, registers</b> (<code>gbc-timing-emulation-tab.js</code>): <a href="#gbce-3">3. Double speed</a> <a href="#gbce-4">4. Work RAM, and the two questions every register asks</a> <a href="#gbce-11">11. The block transfer</a> <a href="#gbce-12">12. Sprite-memory transfer on the Color</a> <a href="#gbce-14">14. The undocumented registers</a> <a href="#gbce-regs">Appendix A. The Color&rsquo;s registers, bit by bit</a></li><li><b>The Color picture</b> (<code>gbc-ppu-emulation-tab.js</code>): <a href="#gbce-5">5. Video memory banking and the attribute byte</a> <a href="#gbce-6">6. Palette memory and the colour pipeline</a> <a href="#gbce-7">7. Priority: the bit that means two things</a> <a href="#gbce-8">8. Objects</a> <a href="#gbce-9">9. Compatibility mode</a> <a href="#gbce-10">10. Where the picture processor departs</a></li><li><b>The Color sound</b> (<code>gbc-apu-emulation-tab.js</code>): <a href="#gbce-13">13. Sound</a></li></ul>' +
  '</section>' +
  '<div class="gbemu-toc"><b>In this area</b><a href="#gbce-1">1. What changes, and what does not</a><a href="#gbce-2">2. Where the Color starts</a><a href="#gbce-15">15. Revisions, and why one core cannot be both</a><a href="#gbce-16">16. What to test with</a><a href="#gbce-17">17. What the evidence here is worth</a><a href="#gbce-18">18. What is not settled</a></div>' +

  '<section class="sect" id="gbce-1"><h3 class="sect-h">1. What changes, and what does not</h3>' +
    '<div class="gbemu-rule" id="gbcr-1-1"><b>Rule C1/1.</b> A build must make the Color the original machine plus four things: <b>banked memory</b>, <b>colour</b>, <b>a block transfer</b>, and <b>a clock switch</b>. Everything else is the original&rsquo;s, unchanged. Same Sharp SM83. Same 4,194,304 Hz master clock. Same 456-dot line, same 154 lines, same 70,224-dot frame, same 160&times;144 screen. Same five-step fetcher at eight dots per tile, same two pixel queues, same window machine, same ten objects per line, same mode-2 scan at two dots an entry.</div>' +
    '<div class="gbemu-why"><b>Why.</b> Start from what is <em>identical</em>, because it is most of the machine and because assuming otherwise costs weeks.</div>' +
    '<div class="gbemu-rule" id="gbcr-1-2"><b>Rule C1/2.</b> <b>The attribute byte must cost no extra dot.</b> The fetcher reads the map byte and its attribute byte in the <em>same</em> T-cycle, one from each video-memory bank: one event, not two. So the fetcher period is unchanged, the object-wait window is still three dots of eight, and <b>mode 3 is not longer on a Color for the same scene</b>.</div>' +
    '<div class="gbemu-example"><b>Example.</b> A background tile fetch takes 8 dots on the original, and it takes the same 8 dots on a Color in colour mode: the attribute read happens on the map read&rsquo;s dot, not on a ninth dot. A build that gave the attribute read its own dot would spend 9 dots per tile, and a line of 160 pixels needs at least 20 tile fetches (160 / 8), so it would draw that line at least 20 dots longer than the original does. If your colour build spends more dots drawing a line than your monochrome one did, that is a bug and not a feature of the hardware.</div>' +
    '<div class="gbemu-why"><b>Why.</b> The single most useful structural fact, and the one that keeps the port honest.</div>' +
    '<div class="gbemu-rule" id="gbcr-1-3"><b>Rule C1/3.</b> A build must keep <b>ten objects per line</b> and <b>the order objects are fetched in</b> (ascending by X, then by memory index) exactly as on the original. Only the <em>merge</em> rule changes (sections 7 and 8). The entire object cost model (run detection, the re-entry wait, and the phase the wait is keyed on: the Game Boy tab&rsquo;s appendix E.3 and E.4) must be carried across untouched.</div>' +
    '<div class="gbemu-why"><b>Why.</b> These are named because they look like they should have changed on a Color, and they do not, on either machine.</div>' +
    '<div class="gbemu-rule" id="gbcr-1-4"><b>Rule C1/4.</b> <b>A build must have no first-object discount</b> (no special reduced cost for the first object on a line). The cost of the first object comes from the same wait as every other object: the wait keyed on the fetcher&rsquo;s phase (the Game Boy tab, appendix E.4), which produces the line&rsquo;s opening correctly with no first-run branch at all. A build that carries the old discount at <em>either</em> of its two settings fails.</div>' +
    '<div class="gbemu-why"><b>Why.</b> The discount does not carry across because it does not exist. The original machine&rsquo;s page refutes it by name in section 12 and appendix E.4, and our core ships without it. E.4 records that the whole board is byte-identical with and without the special case. <b>The general lesson is the part to keep: a special case for &ldquo;the first one&rdquo; almost always means a missing state variable, not a missing constant.</b></div>' +
    '<p class="hw-readable">What does change is that from here on <b>two different questions</b> ' +
    'have to be asked separately, and section 4 is about nothing else: <em>is this machine a ' +
    'Color</em>, and <em>is it running a Color cartridge</em>. Confusing them is the most common ' +
    'single fault in a colour port, and it is invisible on every test suite you already own.</p></section>' +


  /* ------------------------------------------------------------------- 2 */
  '<section class="sect" id="gbce-2"><h3 class="sect-h">2. Where the Color starts</h3>' +
    '<div class="gbemu-rule" id="gbcr-2-1"><b>Rule C2/1.</b> To run cartridges, a Color build must execute the real Color boot program. It must not start a Color-flagged cartridge from a table of hand-over values in its place. (The no-boot start of Rules C2/14 to C2/17 is a fallback for instruments, not a way to run.)</div>' +
    '<div class="gbemu-why"><b>Why.</b> The original&rsquo;s page offers two honest ways to begin: run the real boot program, or tabulate what it leaves. <b>On the Color only the first one is honest</b>, and the reason is structural rather than a matter of taste: <b>every Color test in both of the vendored suites (Mooneye and mealybug tearoom) runs a cartridge with no Color flag in its header.</b> (Other suites do carry the flag: blargg&rsquo;s processor suite, its Color sound suite and its interrupt-time cartridge, and the Color acid test, so the Color-flagged branch is executed by cartridges, only never asserted against a declared register set.) All of them therefore exercise the boot program&rsquo;s compatibility branch, and <em>none</em> exercises the branch a Color-only title takes. A table for that branch cannot be validated by anything anyone holds. Execute the program.</div>' +
    '<h4 class="gbemu-sub">The boot program is 2,304 bytes and it is mapped in two pieces</h4>' +
    '<div class="gbemu-rule" id="gbcr-2-2"><b>Rule C2/2.</b> While the boot program is mapped, a build must map it in two pieces, each image byte at the address equal to its offset in the image. It occupies <code>0x0000&ndash;0x00FF</code> <b>and</b> <code>0x0200&ndash;0x08FF</code>, with a hole at <code>0x0100&ndash;0x01FF</code>: a read in the hole returns the cartridge, so the cartridge header stays visible <em>through</em> the boot program. The image&rsquo;s own bytes at offsets <code>0x100&ndash;0x1FF</code> are never mapped. With an image shorter than <code>0x900</code> bytes the whole of <code>0x0200&ndash;0x08FF</code> shows the cartridge; with one shorter than <code>0x100</code> bytes the start is the no-boot start.</div>' +
    '<div class="gbemu-example"><b>Example.</b> With the boot program mapped, a read of <code>0x0134</code> returns the first byte of the cartridge&rsquo;s title, not image byte <code>0x134</code>; a read of <code>0x0200</code> returns image byte <code>0x200</code>; a read of <code>0x00FF</code> returns image byte <code>0x0FF</code>. Map all 2,304 bytes flat at <code>0x0000</code> and you hide the header from the one program that must read it, and the failure presents as a checksum bug.</div>' +
    '<div class="gbemu-why"><b>Why the hole is load-bearing, not padding.</b> The boot program reads the header: that is how it sums <code>0x0134&ndash;0x0143</code> into the title checksum it hands off, and how it picks the compatibility palette.<br><br>' +
    '<b>Two different quantities are in play here, and one word for both will ' +
    'not close the arithmetic.</b> <b>2,304 is the size of the image</b>: ' +
    '<code>0x900</code> bytes, which is what the boot program&rsquo;s own file weighs on disk. ' +
    '<b>2,048 is how much of it is ever visible</b>: <code>0x0000&ndash;0x00FF</code> is 256 bytes ' +
    'and <code>0x0200&ndash;0x08FF</code> is 1,792, and 256 + 1,792 = <b>2,048</b>, not 2,304. ' +
    '<b>The missing 256 are the image&rsquo;s own bytes at offsets ' +
    '<code>0x100&ndash;0x1FF</code>, which the machine never maps</b>: the cartridge header ' +
    'is there instead. So the file is 2,304 bytes long and the boot program is 2,048 bytes of code ' +
    'and data, and <b>the warning in the example is about the file</b>: it is exactly because the image ' +
    'carries those 256 bytes that mapping it flat is a thing an implementer can do by accident. ' +
    '<b>A page that states a size, states a range, and does not add them up leaves the reader to ' +
    'discover the 256 by subtraction</b>, and the reader will assume they got the range wrong.</div>' +
    '<h4 class="gbemu-sub">Two registers do the handover, and only one of them is the latch</h4>' +
    '<div class="gbemu-rule" id="gbcr-2-3"><b>Rule C2/3.</b> <b><code>0xFF4C</code> (KEY0) must be writable only while the boot program is mapped.</b> A write of value <code>v</code> while it is mapped sets <b>the <em>colour-mode</em> flag to <code>!(value &amp; 0x0C)</code></b>, that is to <code>!(v &amp; 0x0C)</code>: the flag is true, and the machine runs in colour mode, when bits 2 and 3 of <code>v</code> are both clear; the flag is false, and the machine runs in compatibility mode, when bit 2 is set, or bit 3 is set, or both are. After the handover (the <code>0xFF50</code> write of Rule C2/4) the register is dead: a write to <code>0xFF4C</code> no longer changes the flag.</div>' +
    '<table class="gbemu-table"><thead><tr><th>Value the boot program writes to <code>0xFF4C</code></th><th><code>!(value &amp; 0x0C)</code></th><th>The machine runs in</th></tr></thead><tbody>' +
      '<tr><td><code>0x00</code>: bits 2 and 3 clear (Color-flagged cartridge)</td><td><b>true</b></td><td><b>colour mode</b></td></tr>' +
      '<tr><td><code>0x04</code>: bit 2 set (cartridge with no Color flag)</td><td><b>false</b></td><td><b>compatibility mode</b></td></tr>' +
    '</tbody></table>' +
    '<div class="gbemu-example"><b>Example.</b> The boot program writes <code>0x04</code> for a cartridge with no Color flag: bit 2 is set, so the flag reads <b>false</b> and that machine runs in compatibility mode. A value of <code>0x08</code> (bit 3 alone) or <code>0x0C</code> would also give false. For a Color-flagged cartridge the value has bits 2 and 3 clear, so the flag is true and the machine runs in colour mode. A write of <code>0x04</code> made after <code>0xFF50</code> has unmapped the boot program leaves a colour-mode machine in colour mode.</div>' +
    '<div class="gbemu-why"><b>Why the flag is named for colour mode.</b> The flag is true in colour mode, so its name is the colour-mode flag. <b>Every gate in sections 4 to 9 below hangs on this one predicate</b>: a reader who took <code>!(value &amp; 0x0C)</code> for a <em>compatibility</em> flag would put Color cartridges into compatibility mode and no-flag cartridges into colour mode, and the error would propagate through the entire port before anything looked wrong. Settled from our source: the write takes effect only while the boot program is mapped, and the latch is <code>0xFF50</code>, not this register.</div>' +
    '<div class="gbemu-rule" id="gbcr-2-4"><b>Rule C2/4.</b> <b><code>0xFF50</code> is the latch.</b> Writing a value with bit 0 set to <code>0xFF50</code> unmaps the boot program, permanently until the machine is reset.</div>' +
    '<h4 class="gbemu-sub">What the Color boot program does that the original&rsquo;s does not</h4>' +
    '<p class="hw-readable">Each of these was established by putting a sentinel value in the ' +
    'register before reset and looking at whether it survived, which distinguishes ' +
    '&ldquo;never written&rdquo; from &ldquo;written zero&rdquo;, and those are different facts.</p>' +
    '<ul class="gbemu-bullets">' +
      '<li>It <b>writes the work-RAM bank register</b>, and the value it writes is <b>0</b>: a sentinel stored there before the boot program runs is gone at handover on 5 of 5 cartridges, and the register holds 0 (in colour mode <code>0xFF70</code> then reads <code>0xF8</code>, and bank 1 is what <code>D000</code>-<code>DFFF</code> shows, 0 selecting 1; in compatibility mode the register reads <code>0xFF</code>). Measured on flagged and unflagged headers.</li>' +
      '<li>It <b>writes the object-priority register only on the compatibility branch</b>: ' +
        'sentinel intact on <b>5 of 5</b> Color-flagged cartridges, ' +
        '<code>0x01</code> on 2 of 2 ' +
        'compatibility ones.</li>' +
      '<li>It <b>performs three general-purpose block transfers</b>: <code>0xFF55</code> = ' +
        '<code>0x12</code>, <code>0x40</code>, <code>0x40</code>, so <b>19, 65 and 65 blocks</b>. ' +
        'Section 11 has why that matters for one machine cycle of the handover timing. ' +
        '<b>There are three transfers, not four, and the tile-map copy is one of them.</b> ' +
        '19 blocks of 16 bytes ' +
        'is <b>304 bytes exactly</b>: the first transfer <em>is</em> the tile-map copy ' +
        'described in the next bullet, and ' +
        'the two 65-block transfers, 1,040 bytes each, are the clearing of video memory. ' +
        '<b>An implementer who reads the tile-map copy as a fourth thing ' +
        'performs four transfers where the boot program performs three</b>, which is one ' +
        'machine cycle of extra handover cost and lands on the divider.</li>' +
      '<li>That first transfer (the <b>304-byte background tile map</b>) is issued 5,570 steps of our core&rsquo;s processor step loop before the boot program&rsquo;s <code>0xFF4C</code> write drops the machine to compatibility mode, so the copy lands while the machine is still in colour mode.</li>' +
      '<li>It <b>assigns the compatibility palettes from the cartridge header</b>. Section 9.</li>' +
    '</ul>' +
    '<div class="gbemu-rule" id="gbcr-2-5"><b>Rule C2/5.</b> At reset, before any boot program runs, the object-priority register <code>0xFF6C</code> must select index priority (object priority by memory order), because the boot program leaves it unwritten for a Color-flagged title. A no-boot start must load 0 into the work-RAM bank register <code>0xFF70</code>, the value the boot program writes.</div>' +
    '<div class="gbemu-why"><b>Why.</b> The reset default is derived from the measurement above (sentinel intact on 5 of 5 Color-flagged cartridges) rather than chosen to make a score come out. ' +
        '<b>The Color-flagged denominator is five everywhere on this tab</b>: the object-priority bullet ' +
        'above, the checksum refutation in this section (Rule C2/7), ' +
        'the work-RAM bank instrument in section 4 and the palette invariance in section 7 all ' +
        'read <em>5</em>. A denominator that drifts in one bullet and holds in four is the ' +
        'cheapest kind of false figure and the hardest to notice, so check all five together.</div>' +
    '<h4 class="gbemu-sub">What it leaves in the registers, and the checksum register</h4>' +
    '<div class="gbemu-rule" id="gbcr-2-6"><b>Rule C2/6.</b> At the hand-over (the first instruction at <code>0x0100</code>) the processor registers must hold the values in this table. The column is chosen by bit 7 of header byte <code>$0143</code>. <code>A = 0x11</code> and <code>F = 0x80</code> (Z set; N, H and C clear) on <em>both</em> branches. The branches differ in <code>B</code>, <code>D</code>, <code>E</code>, <code>H</code> and <code>L</code>; they agree in <code>A</code>, <code>F</code>, <code>C</code>, <code>SP</code> and <code>PC</code>. Rule C2/7 decides <code>B</code>, Rule C2/8 the <code>H</code> and <code>L</code> exception, Rule C2/9 the Game Boy Advance.</div>' +
    '<table class="gbemu-table"><thead><tr><th>Register</th><th>Color-flagged cartridge (<code>$0143</code> bit 7 set)</th><th>No Color flag (bit 7 clear)</th></tr></thead><tbody>' +
      '<tr><td><code>A</code></td><td><code>0x11</code></td><td><code>0x11</code></td></tr>' +
      '<tr><td><code>F</code></td><td><code>0x80</code> (Z set)</td><td><code>0x80</code> (Z set)</td></tr>' +
      '<tr><td><code>B</code></td><td><code>0x00</code></td><td>the title checksum, <b>but only for a Nintendo licensee</b>; <code>0x00</code> otherwise</td></tr>' +
      '<tr><td><code>C</code></td><td><code>0x00</code></td><td><code>0x00</code></td></tr>' +
      '<tr><td><code>D</code></td><td><code>0xFF</code></td><td><code>0x00</code></td></tr>' +
      '<tr><td><code>E</code></td><td><code>0x56</code></td><td><code>0x08</code></td></tr>' +
      '<tr><td><code>H</code></td><td><code>0x00</code></td><td><code>0x00</code>, <b>except</b> <code>0x99</code> when the title checksum is <code>0x43</code> or <code>0x58</code>. The checksum here is the value handed off in <code>B</code>: it exists only for a Nintendo licensee (the licensee test below), so any other cartridge, whatever its title sums to, gets <code>0x00</code>; and never on a Color-flagged cartridge (the other column)</td></tr>' +
      '<tr><td><code>L</code></td><td><code>0x0D</code></td><td><code>0x7C</code>, <b>except</b> <code>0x1A</code> in the same two cases</td></tr>' +
      '<tr><td><code>SP</code></td><td><code>0xFFFE</code></td><td><code>0xFFFE</code></td></tr>' +
      '<tr><td><code>PC</code></td><td><code>0x0100</code></td><td><code>0x0100</code></td></tr>' +
    '</tbody></table>' +
    '<div class="gbemu-example"><b>Example.</b> The compatibility handover is declared by a test cartridge: ' +
    '<code>A=11 F=80 B=00 C=00 D=00 E=08 H=00 L=7C</code>, <code>SP=0xFFFE</code>, ' +
    '<code>PC=0x0100</code> (a cartridge whose licensee gives <code>B = 0x00</code>). For a Color-flagged cartridge the set is different (' +
    '<code>C=00 D=FF E=56 H=00 L=0D</code>) and it is not declared by anything.</div>' +
    '<div class="gbemu-why"><b>Why <code>A</code> and <code>F</code> are the same on both branches.</b> ' +
    'The boot program sets <code>AF = $1180</code> before it splits, and the split writes only ' +
    '<code>C</code>, <code>D</code>, <code>E</code>, <code>H</code> and <code>L</code>. <b><code>A = 0x11</code> is load-bearing ' +
    'far beyond the handover</b>: a Color-only cartridge&rsquo;s entry code conventionally tests ' +
    '<code>A == $11</code> and refuses to run otherwise, so a core that hands off <code>0x01</code> ' +
    'on a Color does not merely start with a wrong register (<b>three of the five titles on ' +
    'our own ladder refuse to boot at all).</b><br><br>' +
    '<b>Labels, because the two columns are not worth the same.</b> ' +
    '<code>A = 0x11</code>, <code>F = 0x80</code> and the whole compatibility column are ' +
    '<b>DERIVED and declared</b>: a test cartridge asserts exactly that set. <b>The ' +
    'Color-flagged column is DERIVED BY EXECUTION AND DECLARED BY NOTHING.</b> Every Color test in ' +
    'both vendored suites carries no Color flag, so all of them exercise the compatibility branch ' +
    'and none exercises this one. This core earns the column by running the real boot program rather ' +
    'than tabulating it, which is exactly why the guard on it is <em>do not extend the table</em> ' +
    'rather than <em>discover the values</em>.<br><br>' +
    '<b>And one register that looks like a measurement and is a loop counter.</b> ' +
    '<code>E = 0x56</code> at the colour-mode handover is deterministic because the program ends ' +
    'with <code>ld e,c</code> and <code>C</code> is left over from the register-write loop that set ' +
    'up the video-memory clear: the low byte of <code>0xFF51</code> plus five. It does not depend on ' +
    'the transfer having worked, which is exactly the kind of thing worth knowing before you ' +
    'conclude your transfer works because <code>E</code> is right.</div>' +
    '<div class="gbemu-rule" id="gbcr-2-7"><b>Rule C2/7.</b> <b>The licensee test for <code>B</code>.</b> On the branch with no Color flag, <code>B</code> must be the title checksum, the sum of bytes ' +
    '<code>$0134</code>&ndash;<code>$0143</code> modulo 256, <em>only if</em> one of two conditions holds: the ' +
    'old licensee byte <code>$014B</code> is <code>0x01</code>; <em>or</em> <code>$014B</code> is ' +
    '<code>0x33</code> and the new licensee bytes <code>$0144</code> and <code>$0145</code> are the ASCII ' +
    'characters <code>0</code> and <code>1</code> respectively. Otherwise <code>B = 0x00</code>. On the Color-flagged branch <code>B = 0x00</code> for every cartridge, whatever its licensee. <b>The ' +
    'rule: <code>B</code> is the title checksum only for a cartridge with no Color flag <em>and</em> ' +
    'a Nintendo licensee; every Color-flagged cartridge hands off zero.</b></div>' +
    '<div class="gbemu-example"><b>Example.</b> Three Nintendo cartridges for the original Game Boy, on the same binary, handed off <code>0x3C</code>, <code>0xDB</code> and ' +
    '<code>0x46</code>, each matching its own independently computed header sum. A cartridge with no Color flag, <code>$014B = 0x33</code>, <code>$0144</code> = <code>0</code> and <code>$0145</code> = <code>2</code> fails the test and hands off <code>B = 0x00</code> whatever its title sums to. A Color-flagged cartridge with <code>$014B = 0x01</code> also hands off <code>B = 0x00</code>.</div>' +
    '<div class="gbemu-why"><b>Why.</b> Measured ' +
    '<code>B = 0x00</code> for all five Color-flagged titles, because the checksum routine is ' +
    'called only from inside the compatibility path, which a Color-flagged cartridge never enters. ' +
    'The controls (the three Nintendo cartridges in the example) are what make that a finding rather than a null.</div>' +
    '<div class="gbemu-rule" id="gbcr-2-8"><b>Rule C2/8.</b> On the branch with no Color flag, when the title checksum handed off in <code>B</code> is <code>0x43</code> or <code>0x58</code>, the boot program leaves <code>HL = $991A</code> (<code>H = 0x99</code>, <code>L = 0x1A</code>) rather than ' +
    '<code>$007C</code>. A cartridge that fails the licensee test of Rule C2/7 hands off <code>B = 0x00</code> and so always gets <code>$007C</code>; a Color-flagged cartridge always gets <code>H = 0x00</code>, <code>L = 0x0D</code>.</div>' +
    '<div class="gbemu-example"><b>Example.</b> A cartridge with no Color flag, <code>$014B = 0x01</code> and a title that sums to <code>0x58</code>: <code>B = 0x58</code>, <code>HL = $991A</code>. The same title with <code>$014B = 0x02</code>: <code>B = 0x00</code>, <code>HL = $007C</code>.</div>' +
    '<div class="gbemu-why"><b>Why, and its label.</b> <b>The <code>0x43</code>/<code>0x58</code> exception is stated because the ' +
    'core does it, and its derivation is NOT ESTABLISHED.</b> Those two title checksums select a ' +
    'different compatibility palette. <b>That is what this core ships; nothing in our documentation ' +
    'derives it</b>, and what would establish it is the boot program&rsquo;s own palette-selection ' +
    'listing, which is not in our tree.</div>' +
    '<div class="gbemu-rule" id="gbcr-2-9"><b>Rule C2/9.</b> <b>Advance-model variation:</b> on a Game Boy Advance <code>B</code> ' +
    'is handed off <b>incremented by one</b> (an 8-bit <code>inc</code> of the Color&rsquo;s value) and <code>F</code> is recomputed from that increment ' +
    '(Z set if it wrapped to zero, H set if it carried out of bit 3, N and C clear). Every other register is the Color&rsquo;s.</div>' +
    '<div class="gbemu-example"><b>Example.</b> ' +
    'On an Advance running a Color-flagged cartridge the Color&rsquo;s <code>B = 0x00</code> becomes <code>B = 0x01</code>, ' +
    'and <code>F = 0x00</code> (no wrap, no carry out of bit 3). <b>That is the documented convention by which a caller tells a Color ' +
    'from an Advance: check bit 0 of <code>B</code>.</b></div>' +
    '<h4 class="gbemu-sub">The divider, per model, and what six readings actually buy</h4>' +
    '<div class="gbemu-rule" id="gbcr-2-10"><b>Rule C2/10.</b> The post-boot internal divider is not one value and it is not the ' +
    'original&rsquo;s value with a correction applied: at <code>PC = 0x0100</code> it must hold the value in this table for the model built. (On the Color it also depends on the cartridge header: Rule C2/17.)</div>' +
    '<p class="hw-readable">The values are the 16-bit internal counter, which counts T-cycles; the visible register <code>0xFF04</code> is its top byte.</p>' +
    '<table class="gbemu-table"><thead><tr><th>Model</th><th>Internal counter at <code>PC = 0x0100</code></th></tr></thead><tbody>' +
      '<tr><td>Game Boy</td><td><code>0xABC8</code></td></tr>' +
      '<tr><td>Color, revisions A&ndash;E</td><td><code>0x2674</code>, the value the Mooneye cartridges declare; at the hand-over it also depends on the cartridge header (the fallback subsection below gives the rule)</td></tr>' +
      '<tr><td>Color, revision 0</td><td><code>0x2880</code></td></tr>' +
      '<tr><td>Game Boy Advance</td><td><code>0x2678</code>: one machine cycle from the Color</td></tr>' +
    '</tbody></table>' +
    '<div class="gbemu-why"><b>Why.</b> Each was solved from <em>its own</em> ' +
    'cartridge&rsquo;s six declared readings. Carrying the original&rsquo;s correction across would have produced ' +
    '<code>0xABC8</code> on a Color and failed: the two values are <b>34,132</b> ' +
    'apart (<code>0xABC8 = 43,976</code> against ' +
    '<code>0x2674 = 9,844</code>). And six declared ' +
    'readings buy a <b>class</b>, not a value: each of these is one of four consecutive ' +
    'candidates, and all four were built and scored and <b>no row anywhere separates them</b>, ' +
    'because nothing in the machine reads the bottom two bits. The honest statement is stronger ' +
    'than &ldquo;solved&rdquo;: solved to an equivalence class, with the class then measured to be ' +
    'inert.<br><br><b>A machine can only pass one of the two boot-divider ' +
    'cartridges</b>: the A&ndash;E one and the revision-0 one assert different phases. This project ' +
    'targets revision C, passes A&ndash;E and fails 0. Passing both would mean the pair ' +
    'discriminates nothing.</div>' +
    '<div class="gbemu-rule" id="gbcr-2-11"><b>Rule C2/11.</b> <b>Where there is no declared reading, invent nothing</b>: a revision-0 build uses the Color&rsquo;s register set (Rule C2/6) and no value is made up for it.</div>' +
    '<div class="gbemu-why"><b>Why.</b> Revision 0 has no post-boot register cartridge anywhere in the corpus.</div>' +
    '<div class="gbemu-rule" id="gbcr-2-12"><b>Rule C2/12.</b> A build that runs the real program rather than the table must start the divider at <b>4</b> and not 0, as on the original: it leads the first instruction fetch by one machine cycle. The Game Boy tab&rsquo;s section 3 states it; it is a property of the machine rather than of the model, so it applies here unchanged.</div>' +
    '<div class="gbemu-why"><b>Carry its label across as well, not just its value:</b> section 3 of the Game Boy tab states the 4 ' +
    'outright and records that the lead is <b>measured</b> and its mechanism is <b>NOT ' +
    'ESTABLISHED</b> (it reconciles two measurements and nothing explains it). Do not go ' +
    'hunting here for a derivation that is not there either.</div>' +
    '<h4 class="gbemu-sub">If you cannot run the boot program: what this core does, and why it is not a way to play</h4>' +
    '<div class="gbemu-rule" id="gbcr-2-13"><b>Rule C2/13.</b> &ldquo;The hand-over state&rdquo;, wherever this page uses it, is the <b>booted</b> state: what the real Color boot program leaves at the first instruction at <code>0x0100</code>, given by the measured lists of Rules C2/18 (no Color flag) and C2/19 (Color-flagged). The no-boot fallback (Rules C2/14 to C2/17) is our core&rsquo;s partial copy of it. Where the two differ, a build must choose by what it is matching, as this table says.</div>' +
    '<table class="gbemu-table"><thead><tr><th>What the build is matching</th><th>What it loads at the hand-over</th></tr></thead><tbody>' +
      '<tr><td>Our runs with the boot program (every board figure on this page is one)</td><td>The fallback <em>and</em> the booted list: palette memory, both video-memory banks and the Color registers as listed. Where they differ the list wins (the compatibility palettes and index registers, bank 0&rsquo;s logo tiles 1 to 25, the frame sequencer at step 0 after an unflagged boot and 7 after a flagged one, channel 1&rsquo;s frequency <code>0x7C1</code>). Anything a list does not mention comes from the fallback.</td></tr>' +
      '<tr><td>Our core started with no boot program</td><td>The fallback exactly as described and nothing from the lists (empty video memory, sequencer 7, channel 1&rsquo;s internal frequency 0).</td></tr>' +
    '</tbody></table>' +
    '<div class="gbemu-example"><b>Example.</b> A cartridge with no Color flag, matched against our booted runs: the frame sequencer starts at step 0 (the list), channel 1&rsquo;s frequency register holds <code>0x7C1</code> (the list), and the divider comes from the header table of Rule C2/17 (the fallback; the list gives the same rule). The same cartridge matched against our no-boot start: sequencer step 7, channel 1&rsquo;s stored <code>FF13</code>/<code>FF14</code> bytes giving <code>0x700</code> but its internal frequency 0 (Rule C2/15), both video-memory banks zero.</div>' +
    '<div class="gbemu-why"><b>Why.</b> Our no-boot fallback reproduces the processor registers, the picture position and phase, the divider, the register block and the sound unit, and leaves out the compatibility palettes and the video memory.</div>' +
    '<div class="gbemu-rule" id="gbcr-2-14"><b>Rule C2/14.</b> The no-boot start is <b>a fallback for instruments, not a supported way to run:</b> the site will not start a Color-only title without the real boot program. Everything in Rules C2/15 to C2/17 describes our fallback. None of it is a claim about hardware.</div>' +
    '<div class="gbemu-rule" id="gbcr-2-15"><b>Rule C2/15.</b> A no-boot start must load exactly this state:</div>' +
    '<ul class="gbemu-bullets">' +
    '<li><b>Processor registers:</b> the two-branch table above, branch chosen by <code>$0143</code> bit ' +
    '7.</li>' +
    '<li><b>Colour mode or compatibility mode:</b> taken straight from <code>$0143</code> bit 7 alone (bits 2 and 3 of that byte do not count), because ' +
    'no program writes <code>0xFF4C</code>. The register itself is left at 0.</li>' +
    '<li><b>Where the picture is: the booted hand-over.</b> Line 148, dot 354, mode 1, for a cartridge without the Color flag; line 144, dot 166, mode 1, for one with it. The dot is the counter&rsquo;s reading. Rule C2/16 gives how the start gets there.</li>' +
    '<li><b>Divider: by the cartridge header</b>, through how long the boot program takes, as in the ' +
    'table below.</li>' +
    '<li><b>The register block:</b> the original&rsquo;s hand-over table (section 3 of the ' +
    'original&rsquo;s page) with the line and mode above: <code>LCDC = 0x91</code>, the four status ' +
    'selects clear, <code>LYC = 0</code>, <code>SCY = SCX = WY = WX = 0</code>, <code>BGP = 0xFC</code>, ' +
    '<b><code>OBP0 = OBP1 = 0x00</code></b> (the boot programs never write them), <code>TAC = ' +
    '0xF8</code>, <code>IF = 0xE1</code>, <code>SC = 0x7E</code>; <code>0xFF55</code> reads ' +
    '<code>0xFF</code> (no transfer). The pad register selects neither button group ' +
    '(<code>0x30</code>).</li>' +
    '<li><b>The sound unit:</b> the original&rsquo;s no-boot table, with channel 1 running at volume 0 so ' +
    '<code>0xFF26</code> reads <code>0xF1</code>; wave memory reads alternately <code>0x00</code> and ' +
    '<code>0xFF</code>, starting with <code>0x00</code> at <code>0xFF30</code>. The frame sequencer ' +
    'starts at step 7 here (a booted run leaves it at 0). Channel 1&rsquo;s frequency is the ' +
    'original&rsquo;s no-boot state too (the Game Boy tab, Rule 3/11): the stored bytes are <code>FF13</code> = 0 and <code>FF14</code> = <code>BF</code>, but the channel&rsquo;s <em>internal</em> 11-bit frequency is 0, not <code>0x700</code>, and the sweep&rsquo;s shadow frequency is 0. The stored low three bits of <code>FF14</code> do not reach the internal frequency: a later write to <code>FF13</code> replaces the internal frequency&rsquo;s low 8 bits and keeps its high 3 bits (0), and only a write to <code>FF14</code> sets the high 3 bits. ' +
    '<b>Example.</b> After the no-boot start, a cartridge writes <code>FF13</code> = <code>0x40</code> and nothing to <code>FF14</code>: the internal frequency is <code>0x040</code>, not <code>0x740</code>. ' +
    'A booted Color leaves <code>0x7C1</code> there instead (the list further down, ' +
    'measured), the last note of its start-up chime. Our fallback does not copy it: the frequency ' +
    'register is write-only and channel 1 is silent at volume 0, so no register read differs (a cartridge ' +
    'that retriggered channel 1 without first writing its frequency would hear the difference). ' +
    'Both values are right for what they describe; the fallback is simply not the booted state here. ' +
    'Read from our source (the sound unit&rsquo;s no-boot reset is the same on both machines).</li>' +
    '<li><b>Compatibility branch (no Color flag):</b> <code>0xFF6C</code> holds <code>0x01</code>, X ' +
    'priority, as the boot program writes it; the palette index registers hold <code>0x88</code> and ' +
    '<code>0x90</code>, so <code>0xFF68</code> reads <code>0xC8</code> and <code>0xFF6A</code> reads ' +
    '<code>0xD0</code>. <b>Colour branch:</b> every background palette entry white (<code>0x7FFF</code>), ' +
    'every object palette entry 0, the index registers at <code>0x80</code> and <code>0x81</code> ' +
    '(reading <code>0xC0</code> and <code>0xC1</code>), and <code>0xFF6C</code> at 0. With these the I/O ' +
    'registers at the hand-over, <code>0xFF00</code> to <code>0xFF7F</code>, are identical to a booted ' +
    'run on the three cartridges compared.</li>' +
    '<li><b>Not modelled, and why it is not a way to play:</b> the compatibility palettes themselves ' +
    '(every colour word stays <code>0x0000</code>, black, so a cartridge with no Color flag draws a black ' +
    'screen), the video memory the boot program leaves (its logo and its own glyph; both banks stay ' +
    'zero), and a title the boot program&rsquo;s own table recognises (its divider, picture position and ' +
    'palette come from that table, which is firmware data).</li>' +
    '</ul>' +
    '<div class="gbemu-rule" id="gbcr-2-16"><b>Rule C2/16.</b> A no-boot start must place the picture at the booted hand-over&rsquo;s position by these steps, with only the picture running:</div>' +
    '<ol class="gbemu-steps">' +
      '<li>Start at line 0, dot 0 of an <b>ordinary</b> line (full length, counter from 0; not a switch-on line of 450 dots whose counter starts at 8), with the display on.</li>' +
      '<li>Run the picture unit, and nothing else, through ordinary lines until the line&rsquo;s dot counter reads the target dot: line 148, dot 354 for a cartridge without the Color flag; line 144, dot 166 for one with it. The timer, the divider and the sound unit do not move during this run, and the frame it draws is not shown: no frame-finished signal is given. Its pixels stay in the frame buffer, with no refill, until the cartridge&rsquo;s first frame draws over them; the palettes are zero during the run, so every word reads <code>0x0000</code>.</li>' +
      '<li>Keep everything the run did to the picture: the line, the dot, the mode (mode 1), the coincidence comparison and the status line are the ones it reaches, and every internal picture state is the one it would have there.</li>' +
      '<li>Drop every request the run raised: IF is set as the register table of Rule C2/15 gives it (<code>0xE1</code>), not as the run leaves it.</li>' +
      '<li>The first machine cycle of the processor then processes dots 354 to 357 of line 148 (unflagged case): dots 0 to 353 have been processed when it begins.</li>' +
    '</ol>' +
    '<div class="gbemu-example"><b>Example.</b> Unflagged: 148 full lines and 354 dots, 67,842 dots, which is 4k&nbsp;+&nbsp;2, so the processor-to-dot phase is the booted one (machine cycles covering 4k&nbsp;+&nbsp;2 to 4k&nbsp;+&nbsp;5). Color-flagged: 144 full lines and 166 dots, 65,830 dots, also 4k&nbsp;+&nbsp;2 (DERIVED, by the same arithmetic).</div>' +
    '<div class="gbemu-why"><b>Labels.</b> MECHANISM, read from our source (<code>CGB_NOBOOT_HANDOVER</code> runs the picture until the counter reads that dot). Measured against booted runs on our core: 19,996 instruction boundaries ' +
    'in 20,000 fall on a dot of the form 4k&nbsp;+&nbsp;2 either way. A no-boot start runs at the booted Color&rsquo;s processor-to-dot phase.</div>' +
    '<div class="gbemu-rule" id="gbcr-2-17"><b>Rule C2/17.</b> At the hand-over the internal divider must hold the value this table gives for the cartridge header (booted and no-boot alike), except that a no-boot start on the revision 0 or Advance model takes that model&rsquo;s value from Rule C2/10, whatever the header says. Read the rows top to bottom and take the first that matches; then apply the last row if the Color flag is set.</div>' +
    '<table class="gbemu-table"><thead><tr><th>Cartridge header</th><th>Internal divider at the ' +
    'hand-over (16-bit internal counter, T-cycles)</th></tr></thead><tbody><tr><td>Old licensee <code>$014B</code> neither <code>$01</code> ' +
    'nor <code>$33</code></td><td><code>0x2678</code></td></tr><tr><td><code>$014B</code> = ' +
    '<code>$33</code>, and new licensee <code>$0144</code> is not the character ' +
    '<code>0</code></td><td><code>0x2674</code></td></tr><tr><td><code>$014B</code> = <code>$33</code>, ' +
    '<code>$0144</code> is <code>0</code> and <code>$0145</code> is not ' +
    '<code>1</code></td><td><code>0x2698</code></td></tr><tr><td>The Nintendo path: <code>$014B</code> = ' +
    '<code>$01</code>, or <code>$33</code> with new licensee <code>01</code>, for a title the boot ' +
    'program&rsquo;s own table does not recognise</td><td><code>0x3780</code> for <code>$01</code>; ' +
    '<code>0x37A0</code> for <code>$33</code> with <code>01</code></td></tr><tr><td>Any row above with ' +
    'the Color flag set (<code>$0143</code> bit 7)</td><td>That value less ' +
    '<code>0x7DC</code></td></tr></tbody></table>' +
    '<div class="gbemu-example"><b>Example.</b> A cartridge with no Color flag and <code>$014B = $01</code>, for a title the boot program&rsquo;s table does not recognise: <code>0x3780</code>. A Color-flagged cartridge with <code>$014B = $33</code> and new licensee <code>01</code>, for a title the boot program&rsquo;s table does not recognise: <code>0x37A0</code> less <code>0x7DC</code> is <code>0x2FC4</code> (DERIVED, by subtraction).</div>' +
    '<div class="gbemu-why"><b>Why, and its label.</b> Measured by running the real Color boot program (revision 2 image) on our ' +
    'core to the hand-over and changing one header field at a time, with the header checksum re-derived ' +
    'each time. The title, the cartridge type, the sizes, the destination and the version do not move it. ' +
    'A title the boot program&rsquo;s table recognises takes longer and lands elsewhere (seen: ' +
    '<code>0x3688</code> on line 147, and <code>0x2D00</code> on line 147, dot 394); that path is not ' +
    'modelled. Label: MECHANISM for every value as the state the boot program leaves, measured on our ' +
    'core running the real firmware, not on hardware; no byte of the firmware is copied. Mooneye ' +
    '<code>boot_hwio-C</code> and <code>unused_hwio-C</code> pass without a boot program on this start, ' +
    'and all 86 Mooneye cartridges that apply to a Color pass either way.</div>' +
    '<p class="hw-readable"><b>You can score the colour board this way, if you load the palette that section ' +
    '9 tabulates.</b> Every cartridge on the colour board receives the index-0 entry of the boot program&rsquo;s lookup table (none is Nintendo-licensed), and section 9 prints all 24 bytes of that entry as a measurement of this core. Loaded with no boot program, together with the other 104 bytes as section 9 measures them, they score 27 of 27 at 0 px (measured on an independent build). Our own fallback, above, loads no palette and no video memory and draws a black screen; Rules C2/18 and C2/19 give what to load instead.</p>' +
    '<div class="gbemu-rule" id="gbcr-2-18"><b>Rule C2/18.</b> <b>What the Color&rsquo;s compatibility branch leaves behind</b> (the booted state for a cartridge with no Color flag): a build that starts with no boot program and wants to draw what our core draws with one loads the fallback <em>and</em> this list.</div>' +
    '<p class="hw-readable">Measured on the shipped core at the first ' +
    'instruction at <code>0x0100</code>, after the real Color boot program (revision 2 image), on three ' +
    'mealybug cartridges and four Mooneye cartridges with no Color flag, identical on all seven except the ' +
    'divider. Layouts and rules only; no byte of the boot program or of any glyph is printed here.</p>' +
    '<ul class="gbemu-bullets">' +
      '<li><b>Palette memory:</b> background palette 0 and object palettes 0 and 1 hold the 24 bytes of section ' +
      '9&rsquo;s table; background palettes 1 to 7 hold <code>0x7FFF</code> in every entry; object palettes 2 ' +
      'to 7 hold <code>0x0000</code>. <code>0xFF68</code> reads <code>0xC8</code> and <code>0xFF6A</code> reads ' +
      '<code>0xD0</code>. With these loaded the six census colours of section 9 come out of an ordinary ' +
      'compatibility-mode render.</li>' +
      '<li><b>Video memory, bank 0, tile data:</b> byte for byte the original&rsquo;s hand-over (section 3 of ' +
      'the Game Boy tab, &ldquo;What the boot program leaves in video memory&rdquo;): tiles 1 to 24 by that ' +
      'page&rsquo;s header rule, tile 25 the trademark glyph, everything else zero. Measured: 0 bytes of 6,144 ' +
      'differ from our original&rsquo;s booted hand-over on each cartridge, and 0 of 384 differ from the header ' +
      'rule for tiles 1 to 24.</li>' +
      '<li><b>Video memory, bank 0, both tile maps: all zero.</b> This is where the Color differs. The original ' +
      'leaves 25 map entries (tiles 1 to 12 at <code>0x9904</code> to <code>0x990F</code>, tile 25 at ' +
      '<code>0x9910</code>, tiles 13 to 24 at <code>0x9924</code> to <code>0x992F</code>); the Color leaves ' +
      'none: 25 bytes of 2,048 differ, and they are exactly those 25. Whatever the 304-byte tile-map transfer ' +
      'listed above wrote, the maps are empty at the hand-over. So a Color draws no logo, but an object that ' +
      'uses tile 25 still finds its glyph.</li>' +
      '<li><b>Video memory, bank 1, and sprite memory:</b> all zero (0 non-zero bytes of 8,192 and of ' +
      '160).</li>' +
      '<li><b>The Color registers:</b> <code>0xFF4C</code> holds <code>0x04</code> and is dead; ' +
      '<code>0xFF6C</code> holds <code>0x01</code> (X priority) and reads <code>0xFF</code>; ' +
      '<code>0xFF4F</code> reads <code>0xFE</code>; <code>0xFF55</code> reads <code>0xFF</code>; ' +
      '<code>0xFF72</code> and <code>0xFF73</code> read <code>0x00</code>, <code>0xFF74</code> ' +
      '<code>0xFF</code>, <code>0xFF75</code> <code>0x8F</code>; <code>0xFF4D</code> reads <code>0xFF</code> (not mapped in compatibility mode); ' +
      '<code>0xFF70</code> reads <code>0xFF</code> (its read is gated on the mode; the bank it selects still applies, <a href="#gbcr-4-4">Rule C4/4</a>).</li>' +
      '<li><b>The sound unit:</b> <code>0xFF26</code> reads <code>0xF1</code>: channel 1 is still running after ' +
      'the chime, with its DAC on, duty 2, initial volume 15, envelope decreasing at pace 3, and its current ' +
      'volume already 0 (so <code>0xFF76</code> reads <code>0x00</code>); its length counter is not enabled, ' +
      'its sweep is off with the shadow frequency equal to its frequency register (<code>0x7C1</code>). ' +
      'Channels 2 to 4 are off with their DACs off. <code>0xFF10</code> to <code>0xFF25</code> read back ' +
      'exactly the values in the Game Boy tab&rsquo;s section 3 sound table (with the read-back masks), the ' +
      'same on both machines. The frame sequencer&rsquo;s step counter is 0 on both machines (our no-boot start ' +
      'sets 7). Wave memory differs: on the Color the sixteen bytes read alternately <code>0x00</code> and ' +
      '<code>0xFF</code>, starting with <code>0x00</code> at <code>0xFF30</code>; on the original they read ' +
      '<code>0x00</code>. <code>misc/boot_hwio-C</code> asserts the <code>0xF1</code>.</li>' +
      '<li><b>The divider is not one value per model.</b> The Color boot program&rsquo;s length depends on the ' +
      'cartridge header by one machine cycle, before it switches the display on: the internal counter is ' +
      '<code>0x2674</code> on the four Mooneye cartridges tried and <code>0x2678</code> on the three mealybug ' +
      'cartridges tried. The picture position at the hand-over is the same on all seven (line 148, dot 354, ' +
      'mode 1). The <code>0x2674</code> in the per-model table above is the Mooneye cartridges&rsquo; value, ' +
      'which is the one a cartridge declares. The header byte that decides it is the licensee: the table above.</li>' +
    '</ul>' +
    '<div class="gbemu-rule" id="gbcr-2-19"><b>Rule C2/19.</b> <b>The booted state for a Color-flagged cartridge</b> is this list.</div>' +
    '<p class="gbemu-key">Measured: our core running the real Color boot program, revision 2 image, to the first instruction at <code>0x0100</code>, on two cartridge headers with the Color flag set, bit 7 alone and bits 7 and 6, identical but for the flag byte.</p>' +
    '<ul class="gbemu-bullets">' +
      '<li><b>Registers:</b> the Color-flagged column of Rule C2/6&rsquo;s table.</li>' +
      '<li><b>Picture:</b> line 144, dot 166, mode 1, display on (<code>LCDC 0x91</code>), <code>BGP 0xFC</code>, <code>OBP0 = OBP1 = 0x00</code>.</li>' +
      '<li><b>Divider:</b> the header table of Rule C2/17, less <code>0x7DC</code>.</li>' +
      '<li><b>Sound: the same as the unflagged list</b>: <code>FF26</code> reads <code>0xF1</code> (channel 1 running at volume 0, frequency <code>0x7C1</code>), <code>FF10</code>-<code>FF25</code> read back the Game Boy tab&rsquo;s section 3 values, wave memory alternates <code>0x00</code> and <code>0xFF</code> from <code>0xFF30</code>; the one difference is the frame sequencer, which stands at step 7 here (0 after an unflagged boot).</li>' +
      '<li><b>Palettes:</b> all eight background palettes white (<code>0x7FFF</code>), all eight object palettes 0, index registers <code>0x80</code> and <code>0x81</code>.</li>' +
      '<li><b>Video memory:</b> bank 0 tile data byte for byte as the unflagged case (tiles 1 to 24 from the header&rsquo;s logo, tile 25 the trademark glyph, everything else 0), both maps empty, bank 1 empty, sprite memory empty.</li>' +
      '<li><b>Colour registers:</b> work-RAM bank register 0, so bank 1 at <code>D000</code>-<code>DFFF</code> (<code>0xFF70</code> reads <code>0xF8</code>), video-memory bank 0 (<code>0xFF4F</code> reads <code>0xFE</code>), <code>0xFF6C</code> reads <code>0xFE</code> (object priority by memory order), <code>0xFF4D</code> reads <code>0x7E</code>, <code>0xFF55</code> reads <code>0xFF</code>; the mode register holds the cartridge&rsquo;s flag byte and is dead from here on.</li>' +
      '<li><b>The vertical-blank request raised on the way</b> (line 144, dot 3): the no-boot run drops it with every other request it raises and sets IF from the register table (<code>0xE1</code>), whose low five bits, <code>0x01</code>, are exactly what a real boot leaves (measured above), so the flagged start reads the same IF either way.</li>' +
    '</ul>' +
    '<div class="gbemu-why"><b>Why.</b> Our no-boot colour branch matches this state except in two places, both stated so a build can close them: the booted state has the logo tiles in bank 0 (the fallback leaves video memory empty), and channel 1&rsquo;s frequency is <code>0x7C1</code> (the fallback keeps the original&rsquo;s no-boot internal frequency 0, the Game Boy tab, Rule 3/11). The frame sequencer agrees here (7 on both); after an unflagged boot it is 0, a third difference that belongs to the unflagged case.<br><br>' +
    '<b>Labels:</b> every value in both lists is MEASURED on the shipped core with the real ' +
    'boot program; it describes our core, and the palette and video-memory contents are the boot ' +
    'program&rsquo;s work, so loading them by hand reproduces our renders and is not a claim about any other ' +
    'boot image.</div>' +
    '</section>' +


  /* ------------------------------------------------------------------- 3 */
  '<section class="sect" id="gbce-15"><h3 class="sect-h">15. Revisions, and why one core cannot be both</h3>' +
    '<div class="gbemu-rule" id="gbcr-15-1"><b>Rule C15/1.</b> A build must decide which revision of the Color it models before it quotes any figure. There is revision 0, A, B, C, D and E, plus the Game Boy Advance running in its Color mode. This core targets <b>revision C</b>, and it is scored with the <b>revision-2 boot <em>program</em></b>: &ldquo;revision 2&rdquo; is the revision of the boot program image, a different axis from the silicon revision, and there is no silicon revision 2.</div>' +
    '<div class="gbemu-why"><b>Why.</b> <b>There is no such thing as &ldquo;the Game Boy Color&rdquo; for this ' +
    'purpose.</b> The revisions differ in ways that are visible on a screen. Without a chosen revision every figure you produce means ' +
    '&ldquo;agrees with one stored photograph&rdquo; and you will not know which.</div>' +
    '<table class="gbemu-table"><thead><tr><th>What splits by revision</th><th>How far apart</th></tr></thead><tbody>' +
      '<tr><td>Vertical scroll written mid-fetch</td><td>Revision C mixes the two bitplanes, D caches and cannot. <b>6,217 px of 23,040</b> on one cell: the largest revision difference anywhere on the suite</td></tr>' +
      '<tr><td>The tile-select glitch</td><td>A <b>singleton at revision D</b>, not a threshold, so a <code>&gt;=</code> comparison is wrong even where a comparison is right</td></tr>' +
      '<tr><td>Palette write phase</td><td>Splits at D</td></tr>' +
      '<tr><td>Unusable-region reads</td><td>Different revisions mirror, mask above a boundary, or synthesise</td></tr>' +
      '<tr><td>Post-boot divider</td><td>Revision 0 <code>0x2880</code>, A&ndash;E <code>0x2674</code>, Advance <code>0x2678</code></td></tr>' +
      '<tr><td>Post-boot registers on the Advance</td><td><b>One rule, not two constants:</b> its <code>B</code> is an <code>inc</code> of the Color&rsquo;s, and its flags are what that one <code>inc</code> leaves, which is why two registers differ and only one thing changed</td></tr>' +
      '<tr><td>Power-on line phase</td><td>One dot earlier, <b>in Color double speed only</b></td></tr>' +
      '<tr><td>The sound unit&rsquo;s envelope write glitch</td><td><b>The cartridge that tests it says so itself</b>: <i>&ldquo;it appears to be different across revisions&rdquo;</i>. Its declared table is one revision&rsquo;s output, and this project&rsquo;s revision choice is Rule C15/1: the boot <em>program image</em> the board runs is revision 2 and the silicon targeted is revision C, two axes that must not be confused (&ldquo;revision 2&rdquo; is easy to read as a seventh console, and Rule C15/1 enumerates the silicon revisions). The same word appears once more below, in the length-clock row, where it comes from the documentation and <b>this project cannot map it onto 0&ndash;E either</b>; it is left quoted rather than translated. Matching that declared table anywhere else is convergence, not derivation</td></tr>' +
      '<tr><td>Three sound frequency-change variants</td><td>They ship <b>side by side</b>, and <b>at most one can be correct for any one machine</b>. None is a board row here. Improving all three at once is therefore not three wins: it is a signal that wants explaining</td></tr>' +
      '<tr><td>The extra length-clock rule</td><td>A documented <b>revision-02 variant</b> in which the current enable state does not matter: it breaks one commercial title and was changed on later revisions. Not modelled here, and the rows that would score it are among the revision-dependent ones the board does not carry</td></tr>' +
    '</tbody></table>' +
    '<div class="gbemu-why"><b>Two consequences this project lives with and states rather than ' +
    'resolves.</b> <b>This site never chooses a revision at run time</b>: the core holds a few revision tests (the Advance&rsquo;s power-on B register, the no-boot divider of revision 0 and the Advance, and in the speed switch the timer step, the line-register read and the divider reset on revisions B and C against D and E), but the site always runs revision C, so none of them chooses a value here (every other model ' +
    'comparison in it sits in a comment), so a behaviour whose reference splits by revision ' +
    'cannot be settled here by choosing a value, and choosing one anyway is the definition of a ' +
    'fitted constant. And the recommendation on record is to carry the revision as a first-class ' +
    'setting, made <em>because</em> it moves the score by <b>zero pixels</b>: one knob already ' +
    'reproduces a second reference column on 6,217 px out of sample and is inert on 2,048 more, and ' +
    'those 2,048 are behaviour the core cannot express at any setting.<br><br>' +
    '<b>And a hazard that is easy to get backwards: a revision-ambiguous ' +
    'reference from real hardware can outrank a revision-known reference from an emulator.</b> The ' +
    'one colour artefact whose published reference claims to be a photograph of a real device names ' +
    'no model and no revision. If that photograph is of a revision C and your core targets a D, the ' +
    'better-sourced reference is the one that misleads you.</div></section>' +

  /* ------------------------------------------------------------------ 16 */
  '<section class="sect" id="gbce-16"><h3 class="sect-h">16. What to test with</h3>' +
    '<p class="gbemu-key"><b>A note on every score in sections 16 and 17</b> (ours, other emulators&rsquo; and the board&rsquo;s): they are reported, not something this page lets you reproduce. Each needs the test cartridges themselves, and for the AGE rows the author&rsquo;s hardware tables, which ship with those cartridges and are not on this page (the Game Boy tab, section 24). A build from this page checks itself by running the same cartridges; the figures here say what to expect when it does.</p>' +
    '<table class="gbemu-table"><thead><tr><th>Suite</th><th>What it proves</th><th>What it cannot see</th></tr></thead><tbody>' +
      '<tr><td><b>Blargg</b></td><td>The processor, as on the original, plus twelve sound cartridges that are Color-specific.</td><td>Anything about colour.</td></tr>' +
      '<tr><td><b>Mooneye, the Color rows</b></td><td>Post-boot registers, the boot divider per model, and a sweep of every unused register address, which is the sharpest register-map authority anyone holds. <b>On our core all 86 Mooneye cartridges that apply to a Color pass, with the Color boot program and without one</b> (measured on the core this site ships). Which cartridges apply, by the suite&rsquo;s own naming rule as our harness reads it: every cartridge in <code>acceptance/</code>, <code>emulator-only/</code> and <code>misc/</code> whose name carries no model list, or whose model list names the Color (a letter set from G, S, C and A that contains C, or a <code>cgb</code> list other than <code>cgb0</code>); <code>manual-only/</code>, <code>madness/</code> and <code>utils/</code> are not counted.</td><td><b>They all run cartridges with no Color flag.</b> Every one of them exercises the compatibility branch, and none exercises the branch a Color-only title takes.</td></tr>' +
      '<tr><td><b>cgb-acid2</b></td><td>Attributes, banks, priority and palettes, in one frame, in true colour mode. The only artefact here whose published reference claims to come from a real device. This page does not describe the correct frame: the test of record is the suite&rsquo;s own stored reference image, which the board compares as appendix G.1 of the Game Boy tab describes.</td><td>Timing. And its reference names no revision: section 15.</td></tr>' +
      '<tr><td><b>SameSuite</b></td><td>Sixty-eight rows, of which <b>sixty-five run in true colour mode</b>. This is where colour-mode coverage actually lives, and it is where the sound work in section 13 landed.</td><td>The picture, mostly. And one of its own tests is the only witness to its own author&rsquo;s palette-blocking behaviour, which is not independence.</td></tr>' +
      '<tr><td><b>daid, the speed-switch trio</b></td><td>Declared register tables (divider, line counter, status) sampled across a speed switch. These are what pin the switch: 32, 128 and 64 declared bytes respectively.</td><td>Anything not adjacent to a <code>STOP</code>.</td></tr>' +
      '<tr><td><b>magen</b></td><td>The horizontal-blank block transfer, and object index priority. <b>A recommendation, not coverage:</b> magen is <em>not</em> among the nine suites the 264-row board enumerates and this project does not score it, so nothing it exercises is coverage here. Section 8 records that <b>every Color test this project owns runs in X priority</b> and that the index rule rests on two source readings and on nothing that runs.</td><td>Sound, timing. And it cannot tell you anything about this core&rsquo;s score, because nothing here runs it.</td></tr>' +
      '<tr><td><b>mealybug, colour columns</b></td><td>The picture pipeline, one dot at a time, <b>in compatibility mode</b>.</td><td><b>Colour mode.</b> Read section 17 before quoting any figure from it.</td></tr>' +
    '</tbody></table>' +
    '<p class="gbemu-key">And one you should write yourself, because it is cheap and it cannot go ' +
    'stale: <b>a cartridge that counts frames per real-time-clock second either side of a speed ' +
    'switch and requires the two counts to agree.</b> No absolute constant appears in it, so it can ' +
    'never drift out of date. On the core this site ships it reads 60 against 59 (either 59 or 60 is a correct reading of 59.73 frames per clock second; section 3&rsquo;s clock row says why); a clock in ' +
    'the wrong domain reads 60 against 30. Its own author argues its tier down in the same ' +
    'document, which is the right instinct: a cartridge you wrote asserting your own expectation is ' +
    'not the same kind of evidence as one somebody else verified on silicon.</p>' +
    '<h4 class="gbemu-sub">Two newer Color suites: cgb-acid-hell and the AGE tests</h4>' +
    '<p class="hw-readable">Our figure is measured on the core this site serves (its sha256 begins <code>ca5a2a32f97e</code>), with the same build, plan, judge and frame counts for every emulator. ' +
    'Neither suite is published ready to run, so we built both from their authors&rsquo; published source with the RGBDS assembler: ' +
    '<b>cgb-acid-hell</b> by Matt Currie (one frame that must match its author&rsquo;s reference picture pixel for pixel, in colour mode) and ' +
    'the <b>AGE tests</b> by Christoph Sprenger (47 tests of picture and processor timing, from <code>HALT</code> and the status register to sprite and video memory access and the speed switch). Both carry the MIT licence. ' +
    'Each AGE test names the machines its author checked it on: a DMG, or a Game Boy Color of revision B, C or E, either in colour mode or running a monochrome cartridge. ' +
    '<b>We count the runs that name the machines this core models</b>, the DMG and the Color of revision C: 49 runs of the AGE tests, plus cgb-acid-hell. ' +
    'A test that prints its own verdict (TEST PASSED or TEST FAILED) is judged by that verdict. A picture test is compared with its author&rsquo;s reference picture: colour at full 5-bit precision, and a monochrome picture allowing each emulator its own four shades. ' +
    'Every emulator was given the same real boot programs and the same frame counts, with colour correction off.</p>' +
    '<table class="gbemu-table"><thead><tr><th>Emulator</th><th>Version</th><th>Machine</th><th>Score</th></tr></thead><tbody>' +
      '<tr><td><b>Ours</b></td><td>this site</td><td>DMG and Color revision C</td><td><b>49 of 50</b></td></tr>' +
      '<tr><td>SameBoy</td><td>1.0.5 (the official program)</td><td>DMG and Color revision C</td><td>39 of 50</td></tr>' +
      '<tr><td>DocBoy</td><td>1.3</td><td>DMG and Color (no revision named, no boot program)</td><td>17 of 50</td></tr>' +
      '<tr><td>Gambatte</td><td>v0.5.0 (libretro, cbda5ea)</td><td>DMG and Color (no revision chosen)</td><td>11 of 50</td></tr>' +
      '<tr><td>mGBA</td><td>0.11-dev (libretro, b256448)</td><td>DMG and Color (no revision chosen)</td><td>0 of 50</td></tr>' +
    '</tbody></table>' +
    '<p class="hw-readable"><b>On these two suites we are ahead of SameBoy 1.0.5</b> (49 of 50 against its 39, on the same 50 runs). Set to the Color of revision E, SameBoy 1.0.5 passes 31 of the 36 runs that name that revision. ' +
    'SameBoy and DocBoy were run on 7 Nov 2026; Gambatte and mGBA are the versions shown, run on 26 Oct 2026. DocBoy names no revision and runs without a boot program, so its 17 is probably a floor.</p>' +
    '<p class="hw-readable"><b>The timing edges our passing runs rest on</b>, each one the processor can see:</p>' +
    '<ul class="gbemu-bullets">' +
      '<li><code>EI</code> just before <code>HALT</code> with an interrupt waiting returns to the <code>HALT</code> (both machines).</li>' +
      '<li>On the DMG, on a line without sprites, the status register reports the end of drawing three dots before the last pixel, and video and sprite memory open at that moment.</li>' +
      '<li>On the line the screen is switched on, the end of drawing is reported two dots later and video memory stays open until drawing starts.</li>' +
      '<li>The start of vertical blank and of each frame show one machine cycle of mode 0 first (the DMG, and the Color of revision C at single speed).</li>' +
      '<li>On the Color at single speed, video memory closes when drawing starts and opens with the status report, and sprite memory refuses writes from the start of each line.</li>' +
      '<li><code>halt-m0-interrupt</code>: on the DMG a running processor sees the end-of-drawing interrupt two dots before a halted one does (the halted timing is held by Mooneye&rsquo;s <code>hblank_ly_scx_timing</code>), and on the Color <code>HALT</code> checks for an interrupt at the end of its own machine cycle.</li>' +
      '<li>The Color&rsquo;s line-144 status interrupt comes one machine cycle before vertical blank, so Mooneye&rsquo;s <code>vblank_stat_intr-C</code> passes.</li>' +
      '<li><code>stat-int</code> on the DMG: the interrupts at the start of each line reach a running DMG one machine cycle sooner, as the AGE tables say, and a write to a drawing register (scroll, window position, screen control, palettes) lands one machine cycle later within the processor&rsquo;s write (the Game Boy tab&rsquo;s drawing registers&rsquo; extra machine cycle); every mealybug picture passes with it (24 of 24).</li>' +
      '<li><code>stat-mode-window</code> on the DMG: a window that starts in the last three pixels of a line (WX 164 or 165) still makes drawing last longer by its first tile fetch, exactly as at WX 162 and 163.</li>' +
      '<li><code>stat-mode-sprites</code> on all three machine settings (DMG, Color, Color at double speed): a sprite hidden off the left edge of the screen (X 1 to 7) costs drawing exactly as much time as the same sprite 8 pixels to the right.</li>' +
      '<li><code>stat-int</code> on the Color: at double speed the end-of-drawing interrupt comes one dot after the last pixel.</li>' +
      '<li><code>spsw-div</code>: after a speed switch the divider restarts at the end of the switch.</li>' +
      '<li><code>m3-bg-bgp</code> on the DMG: the first pixel of a line takes a palette change only when the write covers both it and the next pixel. That rule is <b>FITTED</b>: one hardware photograph supports it and the reason is not known; it changes nothing unless the palette changes at that moment.</li>' +
      '<li>On the Color at double speed, <code>vram-read</code>, <code>oam-read</code> and <code>oam-write</code>: video and sprite memory close and open exactly when the status register changes mode (video memory while it reads drawing, sprite memory while it reads the sprite search or drawing; a write to sprite memory meets the closing edge one dot sooner, <b>FITTED</b>).</li>' +
      '<li><code>stat-mode-ds</code>: on the first line after the screen is switched on the drawing mode is reported three dots after drawing starts and the end of drawing one dot later (both <b>FITTED</b>: the dot counts are the tables&rsquo;, the reason is not known).</li>' +
      '<li><code>ly</code> on the Color: on line 153 the line counter reads 153 on the same tick as every other line changes, and then 0 (section 10 gives the dot).</li>' +
      '<li><code>cgb-acid-hell</code>, and <code>m3-bg-lcdc</code> and <code>m3-bg-bgp</code> in colour mode, in compatibility mode and in double speed: on the Color a write to a drawing register lands inside its own machine cycle, as on the DMG (section 10, Rule C10/25).</li>' +
      '<li><code>m3-bg-scx</code> on both machines and at both speeds: the background map column is the whole scroll plus the screen position the tile lands on, divided once, so a mid-line change of the scroll&rsquo;s low bits moves the column. The sum carries one extra pixel on the original and none on the Color outside an object fetch, which is the whole difference between the original&rsquo;s photograph and the Color ones (the Game Boy tab, Rule C.1/2; section 10, Rule C10/2).</li>' +
      '<li><code>stat-mode-window</code> on the Color, in colour mode, compatibility mode and double speed: the DMG&rsquo;s three window rules, with the Color&rsquo;s counts (section 10, Rule C10/49).</li>' +
      '<li><code>spsw-mode0</code>, <code>spsw-tima</code>, <code>spsw-interrupts</code> and <code>spsw-ch2-lc-delay</code>: the switch pauses for 32,768 machine cycles in both directions with one divider reset, the speed change is counted in machine cycles, and each switch up toggles a one-machine-cycle delay of the sound unit&rsquo;s frame sequencer (section 3).</li>' +
      '<li><code>lcd-align-ly</code>: LY changes on the same dot on every line, and a read just before it changes returns the old and new values ANDed (section 10, Rule C10/36).</li>' +
    '</ul>' +
    '<p class="hw-readable">What fails: one run, <code>oam-write-dmgC</code>, sprite memory writes on the DMG just after the screen is switched on, on the rows its author marks as depending on when the LCD was last switched off. ' +
    'Every other counted run passes, cgb-acid-hell included, pixel for pixel. The SameBoy and DocBoy columns are SameBoy 1.0.5 (Color revision C) and DocBoy 1.3; the Gambatte and mGBA columns are the versions in the table above.</p>' +
    '<table class="gbemu-table"><thead><tr><th>Test</th><th>Machine</th><th>Ours</th><th>SameBoy 1.0.5</th><th>DocBoy 1.3</th><th>Gambatte</th><th>mGBA</th></tr></thead><tbody>' +
      '<tr><td><code>cgb-acid-hell</code></td><td>Color, colour mode</td><td>pass</td><td>pass</td><td><b>fail</b></td><td><b>fail</b></td><td><b>fail</b></td></tr>' +
      '<tr><td><code>ei-halt-dmgC-cgbBCE</code></td><td>DMG</td><td>pass</td><td>pass</td><td>pass</td><td><b>fail</b></td><td><b>fail</b></td></tr>' +
      '<tr><td><code>ei-halt-dmgC-cgbBCE</code></td><td>Color, colour mode</td><td>pass</td><td>pass</td><td>pass</td><td><b>fail</b></td><td><b>fail</b></td></tr>' +
      '<tr><td><code>halt-m0-interrupt-dmgC-cgbBCE</code></td><td>DMG</td><td>pass</td><td>pass</td><td><b>fail</b></td><td>pass</td><td><b>fail</b></td></tr>' +
      '<tr><td><code>halt-m0-interrupt-dmgC-cgbBCE</code></td><td>Color, colour mode</td><td>pass</td><td>pass</td><td><b>fail</b></td><td><b>fail</b></td><td><b>fail</b></td></tr>' +
      '<tr><td><code>halt-prefetch-dmgC-cgbBCE</code></td><td>DMG</td><td>pass</td><td>pass</td><td>pass</td><td><b>fail</b></td><td><b>fail</b></td></tr>' +
      '<tr><td><code>halt-prefetch-dmgC-cgbBCE</code></td><td>Color, colour mode</td><td>pass</td><td>pass</td><td>pass</td><td><b>fail</b></td><td><b>fail</b></td></tr>' +
      '<tr><td><code>lcd-align-ly-cgbBC</code></td><td>Color, colour mode</td><td>pass</td><td><b>fail</b></td><td><b>fail</b></td><td><b>fail</b></td><td><b>fail</b></td></tr>' +
      '<tr><td><code>ly-dmgC-cgbBC</code></td><td>DMG</td><td>pass</td><td>pass</td><td>pass</td><td>pass</td><td><b>fail</b></td></tr>' +
      '<tr><td><code>ly-dmgC-cgbBC</code></td><td>Color, colour mode</td><td>pass</td><td>pass</td><td><b>fail</b></td><td><b>fail</b></td><td><b>fail</b></td></tr>' +
      '<tr><td><code>ly-ncmBC</code></td><td>Color, monochrome cartridge</td><td>pass</td><td>pass</td><td><b>fail</b></td><td>pass</td><td><b>fail</b></td></tr>' +
      '<tr><td><code>m3-bg-bgp</code></td><td>DMG</td><td>pass</td><td><b>fail</b></td><td><b>fail</b></td><td><b>fail</b></td><td><b>fail</b></td></tr>' +
      '<tr><td><code>m3-bg-bgp</code></td><td>Color, monochrome cartridge</td><td>pass</td><td>pass</td><td><b>fail</b></td><td>pass</td><td><b>fail</b></td></tr>' +
      '<tr><td><code>m3-bg-lcdc-ds</code></td><td>Color, colour mode</td><td>pass</td><td>pass</td><td><b>fail</b></td><td>pass</td><td><b>fail</b></td></tr>' +
      '<tr><td><code>m3-bg-lcdc-nocgb</code></td><td>Color, monochrome cartridge</td><td>pass</td><td><b>fail</b></td><td><b>fail</b></td><td><b>fail</b></td><td><b>fail</b></td></tr>' +
      '<tr><td><code>m3-bg-lcdc</code></td><td>Color, colour mode</td><td>pass</td><td><b>fail</b></td><td><b>fail</b></td><td><b>fail</b></td><td><b>fail</b></td></tr>' +
      '<tr><td><code>m3-bg-lcdc</code></td><td>DMG</td><td>pass</td><td>pass</td><td>pass</td><td>pass</td><td><b>fail</b></td></tr>' +
      '<tr><td><code>m3-bg-scx-ds</code></td><td>Color, colour mode</td><td>pass</td><td>pass</td><td><b>fail</b></td><td>pass</td><td><b>fail</b></td></tr>' +
      '<tr><td><code>m3-bg-scx-nocgb</code></td><td>Color, monochrome cartridge</td><td>pass</td><td>pass</td><td><b>fail</b></td><td>pass</td><td><b>fail</b></td></tr>' +
      '<tr><td><code>m3-bg-scx</code></td><td>Color, colour mode</td><td>pass</td><td>pass</td><td><b>fail</b></td><td>pass</td><td><b>fail</b></td></tr>' +
      '<tr><td><code>m3-bg-scx</code></td><td>DMG</td><td>pass</td><td>pass</td><td><b>fail</b></td><td>pass</td><td><b>fail</b></td></tr>' +
      '<tr><td><code>oam-read-dmgC-cgbBC</code></td><td>DMG</td><td>pass</td><td><b>fail</b></td><td><b>fail</b></td><td><b>fail</b></td><td><b>fail</b></td></tr>' +
      '<tr><td><code>oam-read-dmgC-cgbBC</code></td><td>Color, colour mode</td><td>pass</td><td>pass</td><td><b>fail</b></td><td><b>fail</b></td><td><b>fail</b></td></tr>' +
      '<tr><td><code>oam-read-ncmBC</code></td><td>Color, monochrome cartridge</td><td>pass</td><td>pass</td><td><b>fail</b></td><td><b>fail</b></td><td><b>fail</b></td></tr>' +
      '<tr><td><code>oam-write-cgbBCE</code></td><td>Color, colour mode</td><td>pass</td><td>pass</td><td><b>fail</b></td><td><b>fail</b></td><td><b>fail</b></td></tr>' +
      '<tr><td><code>oam-write-dmgC</code></td><td>DMG</td><td><b>fail</b></td><td><b>fail</b></td><td><b>fail</b></td><td><b>fail</b></td><td><b>fail</b></td></tr>' +
      '<tr><td><code>oam-write-ncmBCE</code></td><td>Color, monochrome cartridge</td><td>pass</td><td>pass</td><td><b>fail</b></td><td><b>fail</b></td><td><b>fail</b></td></tr>' +
      '<tr><td><code>spsw-interrupts-cgbBC</code></td><td>Color, colour mode</td><td>pass</td><td><b>fail</b></td><td><b>fail</b></td><td><b>fail</b></td><td><b>fail</b></td></tr>' +
      '<tr><td><code>spsw-ch2-lc-delay-cgbBCE</code></td><td>Color, colour mode</td><td>pass</td><td><b>fail</b></td><td><b>fail</b></td><td><b>fail</b></td><td><b>fail</b></td></tr>' +
      '<tr><td><code>spsw-div-cgbBCE</code></td><td>Color, colour mode</td><td>pass</td><td>pass</td><td>pass</td><td><b>fail</b></td><td><b>fail</b></td></tr>' +
      '<tr><td><code>spsw-mode0-cgbBCE</code></td><td>Color, colour mode</td><td>pass</td><td>pass</td><td>pass</td><td><b>fail</b></td><td><b>fail</b></td></tr>' +
      '<tr><td><code>spsw-stop-prefetch-cgbBCE</code></td><td>Color, colour mode</td><td>pass</td><td>pass</td><td>pass</td><td>pass</td><td><b>fail</b></td></tr>' +
      '<tr><td><code>spsw-tima-cgbBC</code></td><td>Color, colour mode</td><td>pass</td><td><b>fail</b></td><td><b>fail</b></td><td><b>fail</b></td><td><b>fail</b></td></tr>' +
      '<tr><td><code>stat-int-dmgC-cgbBCE</code></td><td>DMG</td><td>pass</td><td>pass</td><td>pass</td><td><b>fail</b></td><td><b>fail</b></td></tr>' +
      '<tr><td><code>stat-int-dmgC-cgbBCE</code></td><td>Color, colour mode</td><td>pass</td><td>pass</td><td><b>fail</b></td><td><b>fail</b></td><td><b>fail</b></td></tr>' +
      '<tr><td><code>stat-int-ncmBCE</code></td><td>Color, monochrome cartridge</td><td>pass</td><td>pass</td><td>pass</td><td><b>fail</b></td><td><b>fail</b></td></tr>' +
      '<tr><td><code>stat-mode-sprites-dmgC-cgbBCE</code></td><td>DMG</td><td>pass</td><td>pass</td><td><b>fail</b></td><td><b>fail</b></td><td><b>fail</b></td></tr>' +
      '<tr><td><code>stat-mode-sprites-dmgC-cgbBCE</code></td><td>Color, colour mode</td><td>pass</td><td>pass</td><td>pass</td><td><b>fail</b></td><td><b>fail</b></td></tr>' +
      '<tr><td><code>stat-mode-sprites-ds-cgbBCE</code></td><td>Color, colour mode</td><td>pass</td><td>pass</td><td>pass</td><td><b>fail</b></td><td><b>fail</b></td></tr>' +
      '<tr><td><code>stat-mode-window-cgbBCE</code></td><td>Color, colour mode</td><td>pass</td><td>pass</td><td>pass</td><td><b>fail</b></td><td><b>fail</b></td></tr>' +
      '<tr><td><code>stat-mode-window-dmgC</code></td><td>DMG</td><td>pass</td><td>pass</td><td><b>fail</b></td><td><b>fail</b></td><td><b>fail</b></td></tr>' +
      '<tr><td><code>stat-mode-window-ds-cgbBCE</code></td><td>Color, colour mode</td><td>pass</td><td>pass</td><td>pass</td><td><b>fail</b></td><td><b>fail</b></td></tr>' +
      '<tr><td><code>stat-mode-window-ncmBCE</code></td><td>Color, monochrome cartridge</td><td>pass</td><td>pass</td><td>pass</td><td><b>fail</b></td><td><b>fail</b></td></tr>' +
      '<tr><td><code>stat-mode-dmgC-cgbBC</code></td><td>DMG</td><td>pass</td><td>pass</td><td>pass</td><td><b>fail</b></td><td><b>fail</b></td></tr>' +
      '<tr><td><code>stat-mode-dmgC-cgbBC</code></td><td>Color, colour mode</td><td>pass</td><td><b>fail</b></td><td><b>fail</b></td><td><b>fail</b></td><td><b>fail</b></td></tr>' +
      '<tr><td><code>stat-mode-ds-cgbBCE</code></td><td>Color, colour mode</td><td>pass</td><td>pass</td><td><b>fail</b></td><td><b>fail</b></td><td><b>fail</b></td></tr>' +
      '<tr><td><code>stat-mode-ncmBC</code></td><td>Color, monochrome cartridge</td><td>pass</td><td><b>fail</b></td><td><b>fail</b></td><td><b>fail</b></td><td><b>fail</b></td></tr>' +
      '<tr><td><code>vram-read-cgbBCE</code></td><td>Color, colour mode</td><td>pass</td><td>pass</td><td><b>fail</b></td><td><b>fail</b></td><td><b>fail</b></td></tr>' +
      '<tr><td><code>vram-read-dmgC</code></td><td>DMG</td><td>pass</td><td>pass</td><td><b>fail</b></td><td><b>fail</b></td><td><b>fail</b></td></tr>' +
      '<tr><td><code>vram-read-ncmBCE</code></td><td>Color, monochrome cartridge</td><td>pass</td><td>pass</td><td><b>fail</b></td><td><b>fail</b></td><td><b>fail</b></td></tr>' +
    '</tbody></table>' +
    '</section>' +

  /* ------------------------------------------------------------------ 17 */
  '<section class="sect" id="gbce-17"><h3 class="sect-h">17. What the evidence here is worth</h3>' +
    '<p class="gbemu-key"><b>Every figure about colour in this project is scored against another ' +
    'emulator&rsquo;s stored render, or against two independent implementations agreeing. Not one is ' +
    'a measurement against silicon.</b> The core says so in its own source, in as many words: no ' +
    'colour-mode behaviour is device-attested anywhere on the disk, at any tier. That is the number ' +
    'at the top of this page and it is the frame for everything below.</p>' +

    '<h4 class="gbemu-sub">The public board, and the basis this page holds to</h4>' +
    '<p class="hw-readable">Separately from the colour pixel board below, there is the Game Boy ' +
    'Emulator Shootout&rsquo;s own enumeration: <b>264 rows</b> across nine suites, covering both ' +
    'machines from one core (97 Mooneye, 68 SameSuite, 51 Blargg, 24 mealybug tearoom, 9 ' +
    'daid, 5 acid, 4 cpp, 3 ashiepaws, 3 ax6). This core stands at <b>259 PASS, 2 FAIL, 0 ERROR, 3 ' +
    'unscoreable</b> on the core this site serves, measured by framebuffer <em>byte</em> comparison per row. ' +
    'The original machine&rsquo;s section 22 ' +
    'names both failures; <b>both are Color rows</b>. ' +
    '<b>Two of two, row by row:</b> ' +
    '<code>daid/ppu_scanline_bgp.gb</code> is ' +
    'declined <em>on the Color</em>, and <code>channel_4_freq_change</code> is a ' +
    'Colour-side defect. <code>ashiepaws/strikethrough.gb</code>, on the original machine, and the colour-mode row <code>cgb-acid-hell.gbc</code> are not among the failures. ' +
    '<code>channel_4_freq_change</code> has 4 wrong cells and FAILs. <b>A ' +
    'defect narrowed is not a row won.</b></p>' +
    '<p class="gbemu-key"><b>Published comparisons are not like-for-like, and the error is worth ' +
    'three rows.</b> Totals in circulation count <code>INFO</code> rows (rows that ship no ' +
    'reference and that <em>nobody</em> can score, including the emulator being credited with them ' +
    '), while this figure counts <code>PASS</code> only. And two of the comparison emulators ' +
    'were <b>never run on 3 of the 264 rows</b> (DocBoy 1.3 cannot run them), all three of which this core passes.</p>' +
    '<table class="gbemu-table"><thead><tr><th>Basis</th><th>Ours</th><th>SameBoy 1.0.5</th><th>Emulicious</th><th>DocBoy 1.3</th></tr></thead><tbody>' +
      '<tr><td><b>PASS only, all 264</b></td><td><b>259</b></td><td>252</td><td>never run</td><td>cannot run 3</td></tr>' +
      '<tr><td>PASS + INFO, all 264</td><td><b>262</b></td><td>255</td><td>never run</td><td>cannot run 3</td></tr>' +
      '<tr><td>PASS only, shared 261</td><td><b>256</b></td><td>249</td><td>251</td><td>255</td></tr>' +
      '<tr><td>PASS + INFO, shared 261</td><td><b>259</b></td><td>252</td><td>254</td><td>258</td></tr>' +
    '</tbody></table>' +
    '<p class="gbemu-key"><b>Only the first row of that table is a measurement; the other ' +
    'three are arithmetic from it, and are marked as such.</b> The three rows outside the shared 261 are three this core passes. <b>The SameBoy 1.0.5 and DocBoy 1.3 columns ' +
    'were taken by us on 7 Nov 2026 with the board&rsquo;s own tool and judge; the Emulicious column is the board&rsquo;s published run of 4 June 2026.</b></p>' +
    '<p class="hw-readable"><b>On the ordering: on the ' +
    'two bases where DocBoy runs every row, this core passes one row more than DocBoy 1.3: 256 and 255, 259 and 258.</b> The Game Boy tab, section 21, names the five rows on which the two differ. The basis held here ' +
    'is the first row. A figure three higher than ours is the <code>PASS + INFO</code> basis and is ' +
    'not comparable with it. And a trap from the same family: two scoring scripts in this project ' +
    'enumerate <b>264</b> and <b>288</b> rows. Both are useful; the totals must never be ' +
    'differenced.</p>' +
    '<p class="gbemu-key"><b>How much of that board is colour, and it is less than it looks.</b> ' +
    'The 24 mealybug rows are original-Game-Boy cartridges. Of SameSuite&rsquo;s 68, ' +
    '<b>sixty-five run in true colour mode</b>, so the single largest body of colour-mode ' +
    'coverage anyone holds is <em>the sound unit</em>, not the picture. Every Mooneye colour row ' +
    'runs a cartridge with no Color flag. <b>Read that sentence twice before quoting a colour ' +
    'score:</b> the board&rsquo;s colour strength is in section 13, and its colour <em>picture</em> ' +
    'coverage is almost entirely compatibility mode.</p>' +

    '<h4 class="gbemu-sub">The colour board, with its denominators</h4>' +
    '<ul class="gbemu-bullets">' +
      '<li><b>31</b> cartridges built. All 31 have a revision-C reference file.</li>' +
      '<li><b>27</b> of those files are four-shade compatibility-mode renders, and 27 are scored. Each is scored by Rule C17/1.</li>' +
      '<li><b>4</b> are 171-colour images, <b>not a render</b>, which is not the same as no reference and is certainly not a zero. <b>The four are <code>m3_lcdc_win_en_change_multiple_wx</code>, <code>m3_wx_4_change</code>, <code>m3_wx_5_change</code> and <code>m3_wx_6_change</code></b>; the other 27 together use exactly the six census colours of section 9 and no other, at most five in any one image. INSTRUMENT-MEASURED: our scorer&rsquo;s classification. They are detected by measurement, counting colours against what the compatibility palette can produce, rather than by a hardcoded list of names (Rule C17/1).</li>' +
      '<li><b>20</b> is the intersection of the two revision columns, and is the ' +
        'denominator for the revision-disagreement figure <em>only</em>. Quoting it as the ' +
        'board&rsquo;s denominator is the most available mistake on this subject. <b>Where the 20 ' +
        'comes from:</b> the table ' +
        'three paragraphs below denominates revision D on <b>20</b> and denominates revision C ' +
        '<em>restricted to D&rsquo;s cells</em> on <b>20</b> as well. That second row asserts ' +
        'by construction that every D cell has a C counterpart, so the intersection is 20. <b>Do ' +
        'not reach for 24 here</b>: that is the mealybug row count from the board ' +
        'enumeration above, a different quantity entirely.</li>' +
      '<li>Seven cells exist in the colour column with no counterpart for the original, and ' +
        '<b>they are not colour tests</b>. All seven carry no Color flag, so they run in ' +
        'compatibility mode where every bank and palette write is ignored. What they actually test ' +
        'is <em>when</em>, within a background tile fetch, each register is latched.</li>' +
    '</ul>' +
    '<div class="gbemu-rule" id="gbcr-17-1"><b>Rule C17/1.</b> To score the colour board as we do, a build must classify each reference image first: an image with more than 8 distinct colours is not a render and is not scored. Every other image must be scored exactly, pixel for pixel, against our 15-bit colour expanded to 8 bits per channel as <code>(c &lt;&lt; 3) | (c &gt;&gt; 2)</code> (<code>RENDER_MAX_COLOURS</code>), on the picture read at the first <code>LD B,B</code> by the rule in the Game Boy tab&rsquo;s section 19: the single frame buffer as it stands at that instruction, with lines not yet redrawn still holding the previous frame.</div>' +
    '<div class="gbemu-example"><b>Example.</b> A 5-bit channel value <code>c = 31</code> expands to <code>248 | 7 = 255</code>; <code>c = 16</code> expands to <code>128 | 4 = 132</code>; <code>c = 0</code> stays 0. A reference image with 171 colours is not scored; one with 6 is.</div>' +
    '<div class="gbemu-why"><b>Why 8.</b> The compatibility palette produces six colours, and the margin keeps a legitimate six-colour cell from being excluded.</div>' +
    '<p class="gbemu-key"><b>Every scored cell on that board runs in compatibility mode.</b> A ' +
    'colour-mode-only defect cannot be detected by any figure on it, in any configuration. That one ' +
    'sentence disposes of most of the ways a colour score gets over-read.</p>' +
    '<h4 class="gbemu-sub">The figures, and why there are two that must never be summed</h4>' +
    '<table class="gbemu-table"><thead><tr><th>Against</th><th>Score</th><th>Denominator</th></tr></thead><tbody>' +
      '<tr><td><b>Revision C: current</b></td><td><b>0 px, 27 of 27 passing</b> <span class="gbemu-what">(measured on the core this site ships)</span></td><td>27 compatibility-mode renders</td></tr>' +
      '<tr><td>Revision D</td><td>9,607 px, 8 of 20 passing, <b>not re-measured on the core this site ships</b></td><td>20: <b>a different denominator</b></td></tr>' +
      '<tr><td>Revision C restricted to D&rsquo;s cells</td><td>1,346 px, 14 of 20: <b>not re-measured on the core this site ships, also stale</b></td><td>The only like-for-like comparison</td></tr>' +
    '</tbody></table>' +
    '<p class="gbemu-key"><b>Read that table this way.</b> The ' +
    'current figure is <b>0 px and 27 of 27</b>. <b>The two ' +
    'revision-D rows are stale</b>: they have not been re-measured against the current core, and they are marked rather ' +
    'than silently carried. Do not difference them against the 0.</p>' +
    '<p class="hw-readable">One cell alone accounted for 6,217 px of the D column&rsquo;s excess. The ' +
    'scoring script <b>deliberately refuses to print a D total</b>, and that refusal stands: two ' +
    'totals on one page is an invitation to quote the flattering one.</p>' +
    '<p class="gbemu-key"><b>And the board is not a pass at any number, including zero.</b> Its own ' +
    'fence reports a breach on all 27 cells and <b>10 distinct rows still returning the original ' +
    'Game Boy&rsquo;s value on a Color run</b>. A green cell is not a closed cell: this project ' +
    'renders one stored reference column exactly on <b>8,263 px where a second column says something ' +
    'different</b>, and all but two of those score as passes.</p>' +
    '<p class="hw-readable">The breach covers all 27 cells and 10 distinct rows on the core this site serves; the status-register ' +
    'write conflict has its own Color arm (section 10) and is not among the 10. <b>The 8,263 has not been re-measured on the core this site serves</b>, and it is marked here for the same reason the table above is marked. ' +
    'The <em>argument</em> these figures make does not depend on their magnitude (a green cell is not ' +
    'a closed cell whether the breach count is ten or three), but <b>a number not re-taken ' +
    'is stale until someone re-takes it, and a stale number in a sentence that is ' +
    'still true is exactly how a page stops being trustworthy.</b> Re-measure before you quote, ' +
    'including from this page.</p>' +
    '<h4 class="gbemu-sub">Two failure modes worth carrying away</h4>' +
    '<ul class="gbemu-bullets">' +
      '<li><b>A census on a corpus that cannot enter the failing state blesses the wrong thing.</b> ' +
        'Elsewhere on this estate a tree scored 24 of 24 on the original&rsquo;s board <em>and</em> ' +
        '512 px wrong on dmg-acid2, because a census had validated a write site on cartridges that ' +
        'enable the display and then write <code>LCDC</code> during drawing, so the failing ' +
        'case could not arise there at all. Four of this project&rsquo;s colour arms rest on that ' +
        'same corpus and no other, and one of them is carried explicitly flagged: its value is ' +
        'discriminated by exactly <b>one cell of twenty-seven</b>, while two cells that arm its gate ' +
        'hundreds of times evaluate the branch <b>zero</b> times and are degenerate.</li>' +
      '<li><b>A colour reference can carry <em>less</em> information than a monochrome one.</b> Four ' +
        'cells share one pixel-identical reference image in the colour column. Three more go from ' +
        'fully informative to almost entirely one flat colour. So a single pixel score over that set ' +
        'averages three populations that mean different things, and the sharper of the two revision ' +
        'columns is sharper by a measurable margin rather than by preference.</li>' +
    '</ul>' +

    '<h4 class="gbemu-sub">And which of the remaining rows nobody can win honestly</h4>' +
    '<p class="hw-readable">The original Game Boy&rsquo;s page has this at length in its section ' +
    '22, and it is the same list because it is the same board. The colour-relevant entries, so a ' +
    'reader of this page alone is not left chasing them:</p>' +
    '<ul class="gbemu-bullets">' +
      '<li><b>Three rows ship no reference at all.</b> Every emulator on the board reports them ' +
        'unscoreable. Counting them as passes is the first half of the like-for-like problem ' +
        'above.</li>' +
      '<li><b>One row&rsquo;s correct answer is instance-dependent on real silicon.</b> The suite ' +
        'ships three accepted reference images for it because the author records that which of ' +
        'three per-pixel outcomes occurs <b>varies between individual consoles, and within a single ' +
        'console</b>. <b>A hardware capture settles nothing general there</b>: there is no ' +
        'single right answer to go and measure. Its <em>Colour</em> half is a different row, ' +
        'defined with one reference and an unambiguous rule, and it is declined: the residual is ' +
        'one pixel at each of eight boundaries, which is a one-dot quantity where the only axis ' +
        'available moves in fours, and <b>the one constant that reaches it wins the row and costs ' +
        'five protected colour cells</b> (both merge-rule cells among them). +1 for ' +
        '&minus;5, measured rather than estimated.</li>' +
      '<li><b>One colour acid test (<code>cgb-acid-hell</code>) passes, and it was never declined.</b> Its last two pixels were one bit of one plane on each of two rows, ' +
        'and the Game Boy tab&rsquo;s section 22 writes out why it was ' +
        '<em>not</em> declined on price and <em>not</em> unwinnable in principle; ' +
        'what closed it is the Color&rsquo;s drawing-register write landing inside its own machine cycle (section 10, Rule C10/25). <b>Do not ' +
        'confuse this row with the previous bullet</b>: the revision-sensitive argument (six ' +
        'named reference columns agreeing pixel for pixel with exactly one revision differing ' +
        ') belongs there, to a row declined on which revision this project claims, and not ' +
        'here.</li>' +
      '<li><b>One sound row cannot be closed from this corpus</b>, and it ' +
        'carries a ' +
        'model-independent falsifier worth knowing: a write landing <em>one machine cycle later</em> ' +
        'moves the observed event <b>eight T-cycles earlier</b>, which refutes every rule whose ' +
        'schedule is non-decreasing in the write time (that is the entire family anyone would ' +
        'propose). Forty-eight structured rules were built and scored against all 64 declared cells; ' +
        'the best reaches 41 and none completes a single group. The original&rsquo;s section 22 has ' +
        'it in full. The board carries <b>one</b> sound failure, ' +
        '<code>channel_4_freq_change</code>: <code>ashiepaws/strikethrough.gb</code> is not a ' +
        'failure, as the paragraph at the top of this section says. <b>So this list ' +
        'totals six, and must:</b> three with no reference, one instance-dependent, ' +
        'one colour acid test, one sound row. <b>Six</b>, which is the three named failures ' +
        'plus the three that ship nothing, and matches the original&rsquo;s section 22 exactly. ' +
        '<b>A list of unwinnable rows is a figure with a dependent</b>, and its dependent is the ' +
        'board.</li>' +
      '<li><b>And a category rather than a row: anything that declares itself revision-dependent.</b> ' +
        'Several sound cartridges say so in their own headers, and three frequency-change variants ' +
        'ship side by side of which <b>at most one can be correct for any one machine</b>. Matching ' +
        'such a table is <b>convergence at best, never derivation</b>: label it before ' +
        'spending on it. None of them is a board row, which is the only reason they cost nothing ' +
        'here.</li>' +
    '</ul></section>' +

  /* ------------------------------------------------------------------ 18 */
  '<section class="sect" id="gbce-18"><h3 class="sect-h">18. What is not settled</h3>' +
    '<p class="hw-readable">Listed plainly, because a build guide that does not draw its own edge is ' +
    'worse than one that stops sooner, and because every item here is a place where a ' +
    'confident-looking implementation is guessing.</p>' +
    '<ul class="gbemu-bullets">' +
      '<li><b>The edges of the palette block while the picture is being drawn.</b> Our core blocks ' +
        '(section 6 gives the window). Two reference implementations disagree ' +
        'outright about the block itself, and the only cartridge that tests it belongs to one of them; ' +
        'what remains open is the window&rsquo;s exact edges (FITTED to the reference, not to hardware) ' +
        'and whether a blocked access also pushes a black pixel. Section 6.</li>' +
      '<li><b>Whether <code>0xFF6C</code> reads back as a register in compatibility mode.</b> Two ' +
        'witnesses say open bus, one says it reads. This core follows the one, knowingly, and the ' +
        'divergence is recorded rather than smoothed over. <b>Appendix A carries the same ' +
        'divergence</b>: its <code>FF6C</code> row names the contested arm and reconciles it ' +
        'under the register map, with why no board row separates the two arms. On the core this site ships a write to <code>0xFF6C</code> in compatibility mode is dropped, so after the boot program the register reads <code>0xFF</code> exactly as open bus would; appendix A says why that is what passes <code>misc/bits/unused_hwio-C</code>.</li>' +
      '<li><b>The colour-mode boot handover&rsquo;s register values.</b> Section 2 states the ' +
        'complete two-branch table, including <code>A</code> and <code>F</code>. ' +
        '<b>What is unsettled is not the values but their standing:</b> the ' +
        'Color-flagged column is earned by executing the program and is declared by nothing, ' +
        'because every Color test in both vendored suites carries no Color flag. Execute the ' +
        'program; do not extend the table.</li>' +
      '<li><b>The <em>pixel</em> figures in section 17 are compatibility-mode evidence</b>: ' +
        'every mealybug cell this project scores runs a cartridge with no Color flag, so those ' +
        'figures are evidence about <em>the Color picture processor running an ' +
        'original-Game-Boy cartridge</em>, and that is <b>not the thing a reader assumes a Color ' +
        'reference frame is</b>. What remains unsettled: the two ' +
        'colour-mode picture rows the board does carry are scored against <b>the board suite&rsquo;s ' +
        'own stored reference images</b>, and <code>cgb-acid2</code>&rsquo;s published reference ' +
        '<b>names no ' +
        'revision</b> (section 15, and the suite table in section 16). ' +
        '<b>One of those two rows is scored against an image its publisher says is a ' +
        'photograph:</b> section 16 calls <code>cgb-acid2</code> <em>&ldquo;the only artefact here ' +
        'whose published reference claims to come from a real device&rdquo;</em> and section 15 ' +
        'builds its whole revision hazard on that claim. <b>Do not read past that in either ' +
        'direction: it is neither hardware attestation nor nothing.</b>' +
        '<br><br><b>What this page holds, stated because the hero number depends on it.</b> ' +
        'The hero text&rsquo;s <b>no colour behaviour is hardware-attested</b> and this ' +
        'section&rsquo;s <em>&ldquo;not one is a measurement against silicon&rdquo;</em> are true ' +
        'as written, and they are true because <b>this project declines to count a publisher&rsquo;s ' +
        'claim of provenance as an attestation</b>, not because no such claim is on the ' +
        'board. The grounds are the ones section 15 already gives: the claim <b>names no model and ' +
        'no revision</b>, so it cannot be checked against the revision this core targets; nothing ' +
        'in this project verified how the image was produced; and the scorer compares against a ' +
        'stored file either way. <b>That is a ruling, not an absence</b>, and a reader entitled to ' +
        'disagree with it should be able to see it. Section 15&rsquo;s hazard is the same ruling ' +
        'read forwards: a revision-ambiguous reference from real hardware can outrank a ' +
        'revision-known one from an emulator, which is a reason to hold the claim at arm&rsquo;s ' +
        'length rather than a reason to discount it. <b>A revision-named ' +
        'photometric capture of a colour-flagged cartridge is still the single most valuable ' +
        'acquisition available to this project.</b> This tab embeds no frames at all, which is a ' +
        'smaller defect than it looks, and it is recorded here so the two are not confused.' +
        '<br><br><b>And there ARE colour-mode picture rows on the board: two of them.</b> ' +
        '<code>cgb-acid2.gbc</code> is a board row. It runs on model ' +
        'CGB with the Color boot program, it is scored against the board suite&rsquo;s own stored ' +
        'reference, and <b>it PASSES</b>; so does <code>cgb-acid-hell</code>, itself also a colour-mode row, which is why the acid suite reads 3 PASS / 0 FAIL ' +
        '/ 2 INFO on both tabs, the two INFO being <code>which.gb</code> twice. <b>Both ' +
        'passing: it is not true that nothing here is scored against a colour-mode render.</b>' +
        '<br><br><b>You will meet a note in this project that says otherwise, and it is about a ' +
        'different thing.</b> An ' +
        '&ldquo;unscoreable&rdquo; comment in one off-board instrument records that <b>that ' +
        'instrument&rsquo;s own ' +
        'vendored folder</b> holds <code>cgb-acid2.gbc</code> with no reference image beside it. ' +
        'The board&rsquo;s references live in a separate pinned corpus, and the note says nothing ' +
        'about them. <b>A note about one instrument&rsquo;s tree is not a fact about the ' +
        'board</b>, and the general rule is worth more than the instance: ' +
        '<b>a claim of the form &ldquo;nothing anywhere does X&rdquo; must be checked ' +
        'against the board, not against the tree you happen to be looking at</b> ' +
        '. A universal negative taken from a local note is the cheapest false claim a page ' +
        'can make, and the most expensive to find.</li>' +
      '<li><b>Which of three revision-split window and line-counter mechanisms</b> produces two ' +
        'cells&rsquo; pixels. Three candidates, and the reference images alone cannot separate ' +
        'them.</li>' +
      '<li><b>The display-enable wrap phase on a Color: measured, but not against ' +
        'silicon.</b> The Game Boy tab&rsquo;s appendix ' +
        'E.2 <b>prices it on the colour pixel board over five points</b>: differences of 449 to 453 ' +
        'read 20,002 / 3,170 / <b>10,027</b> / 15,602 / 20,002 differing pixels, and the 449 and ' +
        '453 columns coming out identical four apart is the demonstration that these cells measure ' +
        'the line boundary&rsquo;s <em>phase</em> against the processor grid. So it is measured. ' +
        '<b>What it is measured against is the whole of the remaining gap:</b> a stored render from ' +
        'another emulator at one revision, which is why the Colour&rsquo;s value is ' +
        'FITTED-TO-STORED-RENDER and never observed. The document asserting that the ' +
        'timings differ on colour hardware, <em>even in compatibility mode</em>, gives no number at ' +
        'all. <b>Nothing this project owns attests it on silicon, at any revision</b>, and the ' +
        'tests that pin it on the original declare themselves as failing on Color. <b>Priced is ' +
        'not attested</b>, and that distinction is the whole of what is still open here.</li>' +
      '<li><b>The block-transfer register&rsquo;s value on a freshly reset machine.</b> The ' +
        'documentation says <code>0xFF</code>; this core reads <code>0x80</code>, because the length ' +
        'field is zeroed by the reset and only ever set to its full value on completion. Our no-boot start (section 2) sets the idle value, so with or without a boot program a cartridge first reads <code>0xFF</code>; the <code>0x80</code> survives only between the reset and a boot program&rsquo;s own first transfer. Named here ' +
        'because it is exactly the kind of thing a page like this ' +
        'exists to surface.</li>' +
      '<li><b>The general-purpose transfer&rsquo;s cost in double speed.</b> Unmeasured by ' +
        'declaration; nothing in reach exercises it.</li>' +
      '<li><b>The block transfer&rsquo;s interaction with a concurrent sprite-memory transfer.</b> ' +
        'Section 11.</li>' +
      '<li><b>The additive term in the noise channel&rsquo;s first step after a trigger.</b> The ' +
        'half-period is structural and over-determined by four declared arms; the constant beside ' +
        'it is stated by no document in reach, and <b>the board cannot choose its form</b>: ' +
        'two candidate expressions are byte-identical on all 68 sound rows, because every row that ' +
        'would separate them also depends on the free-running divisor phase. Carried as undecided, ' +
        'not picked. Section 13 and the original&rsquo;s section 17.</li>' +
      '<li><b>Noise divisor codes 5, 6 and 7.</b> They appear nowhere in the corpus, so the ' +
        'rule&rsquo;s behaviour above code 4 is <em>unmeasured</em>, not established. One cartridge ' +
        'exercising a high code at the right trigger phase would settle it; none does.</li>' +
      '<li><b>The shift register&rsquo;s upper stages when a running channel is widened.</b> Two ' +
        'physical readings are observationally identical while narrow mode is held, so no ' +
        'fresh-trigger test can separate them; both are refuted for the implementation we compared ' +
        'against, whose behaviour is a third thing. The narrow direction (which is what music ' +
        'uses) agrees exactly, and nothing in the corpus watches the other.</li>' +
      '<li><b>The speed switch&rsquo;s smaller parts</b>: the sound channels&rsquo; one-sample delay at a switch down and the frame-sequencer delay carried through a divider write at single speed are not modelled, and the revision D and E branches are read, not measured. ' +
        'Section 3.</li>' +
      '<li><b>What the object scan sees while a sprite-memory transfer holds the bus.</b> ' +
        '<b>Do not ask which object survives: none does.</b> The ' +
        'scan performs no read while the transfer holds the bus, so all forty slots test one stale ' +
        'value and the cap fills with ten copies of one position. <b>Which index &ldquo;survives&rdquo; ' +
        'is not observable at all</b>: two codebases give different indices while producing ' +
        'identical pixels. It belongs to both machines and the full account lives on the original ' +
        'Game Boy&rsquo;s page, section 5.</li>' +
    '</ul>' +
    '<p class="gbemu-key">And the same honest answer the original&rsquo;s page gives, which does not ' +
    'get weaker for being repeated: <b>everything above is necessary and it is not sufficient.</b> ' +
    'What is written here is the part that took the research: the mechanisms most colour ' +
    'cores get wrong, the two predicates that decide the shape of the whole port, and the difference ' +
    'between a number that was derived, a number that was observed, and a number that was adjusted ' +
    'until the tests passed. <b>This page never presents the third as the first</b>, and the reason ' +
    'the list above is long is that refusing to do so leaves things on it.</p></section>' +

  /* ================================================================ APP-A
   * THE COLOUR REGISTER MAP, consolidated. Lettered rather than numbered so
   * the eighteen numbered sections' cross-references stay valid. Everything
   * here is transcription out of this core's decode paths; the sections
   * above are the research. LABELS INLINE, same as everywhere else.    */
  '</div>';
}
