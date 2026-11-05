/* ===========================================================================
 * Game Boy Color Emulation tab, area 2 of four: Processor-visible timing, double speed, transfers, registers
 * gbcTimingEmulationTabHTML(d) returns this area's HTML; the tab's composer in
 * gbc-emulation-tab.js calls every area in order (2 November 2026: the tab
 * was split into area files so a builder can read one area at a time).
 * Loaded by a plain <script src> tag (the site must open over file://).
 * =========================================================================== */

function gbcTimingEmulationTabHTML(d) {
  return '<div class="gbemu-area" id="gbcemu-area-timing">' +

  '<section class="sect gbemu-area-head" id="gbcemu-area-timing-head"><h3 class="sect-h">Area 2 of four: Processor-visible timing, double speed, transfers, registers</h3>' +
    '<p class="gbemu-key">Double speed and the speed switch, work RAM banking, the block transfer, the sprite-memory transfer on the Color, the undocumented registers and every Color register bit by bit (appendix A). The Color&rsquo;s picture timing table, its interrupt sources and LY are in the picture area (section 10).</p>' +
    '<p class="hw-readable">This area is the file <code>gbc-timing-emulation-tab.js</code>, one of the four area files that together make the Game Boy Color Emulation tab. It can be read on its own; the build checklist is in the first area, and the rule for what a build must implement is beside it.</p>' +
    '<p class="hw-readable"><b>Where the rest of this page is.</b> When a sentence here points to a section or appendix that is not in this area, it is in one of these files (the links work on the assembled page):</p><ul class="gbemu-bullets"><li><b>Overview, checklist, and what differs from the Game Boy</b> (<code>gbc-machine-emulation-tab.js</code>): <a href="#gbce-1">1. What changes, and what does not</a> <a href="#gbce-2">2. Where the Color starts</a> <a href="#gbce-15">15. Revisions, and why one core cannot be both</a> <a href="#gbce-16">16. What to test with</a> <a href="#gbce-17">17. What the evidence here is worth</a> <a href="#gbce-18">18. What is not settled</a></li><li><b>The Color picture</b> (<code>gbc-ppu-emulation-tab.js</code>): <a href="#gbce-5">5. Video memory banking and the attribute byte</a> <a href="#gbce-6">6. Palette memory and the colour pipeline</a> <a href="#gbce-7">7. Priority: the bit that means two things</a> <a href="#gbce-8">8. Objects</a> <a href="#gbce-9">9. Compatibility mode</a> <a href="#gbce-10">10. Where the picture processor departs</a></li><li><b>The Color sound</b> (<code>gbc-apu-emulation-tab.js</code>): <a href="#gbce-13">13. Sound</a></li></ul>' +
  '</section>' +
  '<div class="gbemu-toc"><b>In this area</b><a href="#gbce-3">3. Double speed</a><a href="#gbce-4">4. Work RAM, and the two questions every register asks</a><a href="#gbce-11">11. The block transfer</a><a href="#gbce-12">12. Sprite-memory transfer on the Color</a><a href="#gbce-14">14. The undocumented registers</a><a href="#gbce-regs">Appendix A. The Color&rsquo;s registers, bit by bit</a></div>' +

  /* ------------------------------------------------------------------- 3 */
  '<section class="sect" id="gbce-3"><h3 class="sect-h">3. Double speed</h3>' +
    '<p class="gbemu-key"><b>Double speed does not make the Game Boy run faster. It halves the ' +
    'number of picture-processor dots in a machine cycle.</b> Everything in the table of ' +
    '<a href="#gbcr-3-9">Rule C3/9</a> follows from that one sentence (<a href="#gbcr-3-1">Rule C3/1</a>).</p>' +
    '<p class="hw-readable"><b>Units in this section.</b> A <b>T-cycle</b> is one period of the master clock and a <b>dot</b> is one T-cycle of picture-processor time, at both speeds. A <b>CPU T-cycle</b> is one period of the processor&rsquo;s own clock: one T-cycle at single speed, half a T-cycle in double speed. A <b>machine cycle</b> is four CPU T-cycles at both speeds, so it is four T-cycles (four dots) at single speed and two T-cycles (two dots) in double speed. &ldquo;Going up&rdquo; is a switch from single speed to double speed; &ldquo;coming down&rdquo; is a switch from double speed to single speed.</p>' +

    '<div class="gbemu-rule" id="gbcr-3-1"><b>Rule C3/1.</b> A machine cycle is four CPU T-cycles at both speeds. At single speed it covers four dots of the picture processor; in double speed it covers two dots. The picture processor&rsquo;s dot rate (one dot per T-cycle of the master clock) is the same at both speeds.</div>' +
    '<div class="gbemu-example"><b>Example.</b> An instruction of 3 machine cycles covers 12 dots at single speed and 6 dots in double speed. The line it runs on is the same length in dots at both speeds, so in double speed the processor runs twice as many machine cycles in one line.</div>' +
    '<div class="gbemu-why"><b>Why.</b> A machine cycle is still four CPU T-cycles. At single speed those four CPU T-cycles are four dots; in double speed they are two. A core that instead &ldquo;runs the CPU twice&rdquo; will get the CPU right and the picture wrong.</div>' +

    '<h4 class="gbemu-sub">The register</h4>' +
    '<div class="gbemu-rule" id="gbcr-3-2"><b>Rule C3/2.</b> In colour mode, <code>0xFF4D</code> (KEY1) holds two bits: <b>bit 7 is the current speed</b> (1 = double speed; read only) and <b>bit 0 is armed</b> (written by the processor). Bits 1&ndash;6 read 1. So a read returns <code>0x7E | armed | (double &lt;&lt; 7)</code>.</div>' +
    '<div class="gbemu-example"><b>Example.</b> At single speed with bit 0 written 1, a read returns <code>0x7F</code>. In double speed with bit 0 clear, it returns <code>0xFE</code>.</div>' +
    '<div class="gbemu-rule" id="gbcr-3-3"><b>Rule C3/3.</b> <b>The speed switch exists only in colour mode.</b> On the original Game Boy, and on a Color running a cartridge with no Color flag (compatibility mode), there is no speed switch at all, and a read of <code>0xFF4D</code> must return <code>0xFF</code>. In colour mode the register must answer as <a href="#gbcr-3-2">Rule C3/2</a> says from the cartridge&rsquo;s first instruction.</div>' +
    '<div class="gbemu-why"><b>Why.</b> A test cartridge asserts that address as unmapped in compatibility mode. <b>The <code>0xFF</code> outside colour mode is load-bearing, with field evidence in both directions.</b> Returning 0 on an original Game Boy drops ' +
        'blargg&rsquo;s processor suite into its own speed-switch path (' +
        '<code>ldh a,[KEY1] / rlca / ret c</code>) where it executes a real <code>STOP</code> ' +
        'and hangs. Returning <code>0xFF</code> on a Color <em>before</em> the register is mapped ' +
        'sets bit 7, which reads as &ldquo;already in double speed&rdquo;, and three commercial ' +
        'titles then skipped their own speed switch in silence. One register, two opposite failures, ' +
        'neither of which says anything on screen.</div>' +

    '<h4 class="gbemu-sub">The switch itself</h4>' +
    '<div class="gbemu-rule" id="gbcr-3-4"><b>Rule C3/4.</b> A speed switch is taken when the processor executes <code>STOP</code> in colour mode with KEY1 bit 0 (armed) set. It runs in this order. Stalled machine cycles are numbered from 1, starting at the end of the <code>STOP</code>&rsquo;s operand fetch; each one lasts the dots of the speed in force during it.' +
      '<ol class="gbemu-steps">' +
        '<li>The <code>STOP</code>&rsquo;s operand (its second byte) is fetched <b>at the old speed</b>. This core always fetches it, also when an interrupt is pending.</li>' +
        '<li>At the end of that operand fetch: KEY1 is cleared, both bits (bit 0 now reads 0; bit 7 still shows the old speed until the flip of step 5); the divider is reset (<a href="#gbcr-3-7">Rule C3/7</a>); the flip counter is set to 4 (<a href="#gbcr-3-5">Rule C3/5</a>).</li>' +
        '<li>If an interrupt is pending at that moment (a request both enabled and pending: IE AND IF, bits 0 to 4, non-zero, whatever the master enable IME holds), there is no stall: the processor goes on to its next instruction boundary, and Rule C3/5&rsquo;s table, row 2, applies. Otherwise <b>the processor halts; it does not park</b>, and the stall countdown starts at <b>32,766 machine cycles</b>.</li>' +
        '<li>Stalled machine cycles 1 to 3 run <b>at the old speed</b>: 4 dots each going up, 2 dots each coming down. Each of them first counts the flip counter down by one (4 to 3, 3 to 2, 2 to 1).</li>' +
        '<li>At the start of stalled machine cycle 4 the flip counter reaches 0 and the speed flips, before that cycle is clocked: KEY1 bit 7 changes to the new speed. If LCDC bit 7 is set at that moment (judged <b>at the flip</b>), and the line is not the power-on line, the picture processor moves 2 dots onto the new speed&rsquo;s phase: going up it runs 2 extra dots at once; coming down nothing is rewound: it skips the next 2 dots the processor would have paid it, so it waits 2 dots while the processor runs on (<a href="#gbce-10">section 10</a>&rsquo;s timing table, the speed-switch row).</li>' +
        '<li>Stalled machine cycles 4 to 32,766 (32,763 of them) run <b>at the new speed</b>: 2 dots each going up, 4 dots each coming down.</li>' +
        '<li>At the end of stalled machine cycle 32,766 the stall expires: the processor leaves the halt and the divider is reset again (<a href="#gbcr-3-7">Rule C3/7</a>). The next instruction boundary follows.</li>' +
      '</ol>' +
      'The picture processor runs through every stalled machine cycle (<a href="#gbcr-3-8">Rule C3/8</a>). An interrupt can end the stall early (<a href="#gbcr-3-6">Rule C3/6</a>).</div>' +
    '<p class="hw-readable"><b>The stall in dots.</b> This table is on the dot scale, counted from the end of the <code>STOP</code>&rsquo;s operand fetch to the wake. It gives the stalled machine cycles&rsquo; dots and the 2-dot move of step 5 separately, then the total the picture processor runs with the screen on (the move made) and with it off (no move).</p>' +
    '<table class="gbemu-table"><thead><tr><th>Direction</th><th>Stalled machine cycles 1 to 3, old speed (dots)</th><th>Stalled machine cycles 4 to 32,766, new speed (dots)</th><th>The 2-dot move at the flip (dots)</th><th>Total, screen on (dots)</th><th>Total, screen off (dots)</th></tr></thead><tbody>' +
      '<tr><td>Going up (single to double)</td><td>3 &times; 4 = 12</td><td>32,763 &times; 2 = 65,526</td><td>+2 (runs 2 extra dots)</td><td><b>65,540</b></td><td><b>65,538</b></td></tr>' +
      '<tr><td>Coming down (double to single)</td><td>3 &times; 2 = 6</td><td>32,763 &times; 4 = 131,052</td><td>&minus;2 (skips 2 dots)</td><td><b>131,056</b></td><td><b>131,058</b></td></tr>' +
    '</tbody></table>' +
    '<div class="gbemu-example"><b>Example.</b> Going up, with the screen on, on line 40, and no interrupt pending or raised: the operand fetch ends; stalled machine cycles 1 to 3 cost 3 &times; 4 = 12 dots; at the start of cycle 4 KEY1 bit 7 becomes 1 and the picture processor runs 2 extra dots at once; cycles 4 to 32,766 cost 32,763 &times; 2 = 65,526 dots; 12 + 2 + 65,526 = 65,540 dots, and the processor resumes. Coming down, screen on: cycles 1 to 3 cost 3 &times; 2 = 6 dots, the picture processor skips 2 dots, and cycles 4 to 32,766 cost 32,763 &times; 4 = 131,052 dots; 6 &minus; 2 + 131,052 = 131,056 dots. With the screen off there is no move: 12 + 65,526 = 65,538 dots going up and 6 + 131,052 = 131,058 coming down.</div>' +
    '<div class="gbemu-why"><b>Why.</b> <b>The community figure: the stall is 131,080 CPU T-cycles (32,770 machine cycles) and that is ' +
        'not a wall-clock constant.</b> Because ' +
        'it is denominated in CPU T-cycles, its duration in dots differs by a factor of two between ' +
        'the two directions: 65,540 dots going up, 131,080 coming down, if every stalled cycle ran ' +
        'at the new speed. <b>In this core they do not:</b> the speed flip is deferred into the stall ' +
        '(<a href="#gbcr-3-5">Rule C3/5</a>), so the first three stalled machine cycles run at the ' +
        'old speed. A source that converts one ' +
        'direction, gets 15.63 ms, and calls that agreement has measured one number twice. ' +
        '<b>LABEL: CONVERGENCE, not measurement: the same label this quantity carries on the ' +
        'Game Boy page&rsquo;s appendix D.9, and the largest constant in this section.</b> ' +
        'The Color&rsquo;s stall is 4 machine cycles shorter than that figure: 32,766 machine cycles in all. ' +
        'The 4 is FITTED (section 10&rsquo;s timing table, the speed-switch row); ' +
        'with the Color timing block off (<code>CT_ON</code> 0) the stall is the original figure above. ' +
        'INSTRUMENT-MEASURED on the shipped core with the probe in our source tree (<code>test/tabprobe</code>): 32,766 ' +
        'machine cycles between the operand fetch and the next instruction, and 4 more in a copy built ' +
        'with the shortening off. ' +
        'The CONVERGENCE label is about the original figure: two independent implementations reach it from two different unit systems; <b>both ' +
        'are calibrated to a Colour revision this core does not target</b> and one of them models ' +
        'no revision axis at all. Two implementations agreeing is evidence about what the community ' +
        'models, not about hardware. Nothing here leans on its precision (the only consumer ' +
        'is the countdown, and the one test that exercises it discards the interval).</div>' +

    '<div class="gbemu-rule" id="gbcr-3-5"><b>Rule C3/5.</b> The speed flip is <b>deferred by a flip counter set to 4</b> at the end of the <code>STOP</code>&rsquo;s operand fetch. The counter goes down by one <b>once per stalled machine cycle while the processor is halted</b> (at the start of that cycle, before it is clocked), and <b>once per instruction boundary while it is running</b> (after an owed horizontal-blank block, before the dispatch and the instruction; a dispatch and the instruction after it share one boundary). The speed flips when the counter reaches 0. An interrupt never cancels the flip. So &ldquo;four machine cycles after the <code>STOP</code>&rdquo; holds while the processor is running only when each instruction in between is one machine cycle long.' +
      '<table class="gbemu-table"><thead><tr><th>Case</th><th>The stall</th><th>When the speed flips</th><th>Divider resets (<a href="#gbcr-3-7">Rule C3/7</a>)</th></tr></thead><tbody>' +
        '<tr><td>1. No interrupt pending at the <code>STOP</code>, none raised during the stall</td><td>32,766 machine cycles, then the processor resumes</td><td>at the start of stalled machine cycle 4, halted (after 3 machine cycles)</td><td>two: at the <code>STOP</code>, and at the end of stalled machine cycle 32,766</td></tr>' +
        '<tr><td>2. An interrupt already pending at the <code>STOP</code></td><td><b>none: skipped entirely</b></td><td>at the fourth instruction boundary after the <code>STOP</code>, before that boundary&rsquo;s dispatch and instruction</td><td>one, at the <code>STOP</code></td></tr>' +
        '<tr><td>3. An interrupt wakes the stall before the flip (at the boundary after stalled machine cycle 1, 2 or 3)</td><td>ends at the wake (<a href="#gbcr-3-6">Rule C3/6</a>)</td><td>still happens: the woken boundary counts down once, then each later instruction boundary once, until 0</td><td>one, at the <code>STOP</code>; the countdown is abandoned with no second reset</td></tr>' +
        '<tr><td>4. An interrupt wakes the stall after the flip</td><td>ends at the wake (Rule C3/6)</td><td>already flipped, at the start of stalled machine cycle 4</td><td>one, at the <code>STOP</code>; no second reset</td></tr>' +
      '</tbody></table>' +
      'Between the end of the operand fetch and the flip, a read of KEY1 returns bit 0 = 0 (cleared at the <code>STOP</code>) and bit 7 = the old speed: <code>0x7E</code> with the old speed in bit 7.</div>' +
    '<div class="gbemu-example"><b>Example.</b> Going up with a request already pending and IME clear (row 2). After the <code>STOP</code> the processor runs <code>LD HL,nn</code> (3 machine cycles), <code>NOP</code>, <code>NOP</code> and then <code>LDH A,[KEY1]</code>. The flip counter goes from 4 to 3 at the boundary before <code>LD HL,nn</code>, to 2 before the first <code>NOP</code>, to 1 before the second, and to 0 before <code>LDH</code>: the speed flips there, after 3 + 1 + 1 = 5 machine cycles, not 4, and <code>LDH</code> runs in double speed and reads <code>0xFE</code>. A KEY1 read by an instruction at the second or third boundary returns <code>0x7E</code> (single speed, not armed). Coming down, a read before the flip returns <code>0xFE</code> and one after it <code>0x7E</code>. A core that counts the flip down only while halted never flips in row 2, and KEY1 then reads the old speed for ever.</div>' +
    '<div class="gbemu-why"><b>Why.</b> In row 2 a core that counts the flip down only while halted loses the switch, and the register then reads the old speed for ever (one licensed title polls it and never leaves its loop). MECHANISM. Named and not changed: whether <code>STOP</code>&rsquo;s second byte is consumed when an interrupt is pending. This core always fetches it; no stimulus we own can see the difference. ' +
      'The flip counter&rsquo;s 4 (three stalled machine cycles at the old speed) is bracketed rather than ' +
        'tuned: 0 gives 4 differing samples, 3 gives 1, <b>4 gives 0 of 224</b>, 5 gives 1. Both ' +
        'neighbours fail. The quantity still comes entirely from one test author&rsquo;s declared ' +
        'tables, and it is labelled that way: <b>FITTED, cartridge-declared</b>. The Game ' +
        'Boy page&rsquo;s appendix D.9 carries this same 4 and this same bracket, so the two tabs ' +
        'agree about how much is known: the bracket is what is known, and no derivation of the 4 ' +
        'exists to hunt for. <b>Required, and measured</b>: daid&rsquo;s <code>speed_switch_timing_ly</code> passes on our core and fails with any one of these switched off: the 32,766-cycle stall (the 4 fewer cycles), the flip deferral (the flip counter of 4), or the picture&rsquo;s two-dot move at the flip (section 10). It does not move with the divider&rsquo;s late release or with the whole Color timing block off, so the row is about the switch itself. ' +
      'The screen test for the two-dot move reads LCDC bit 7 at the flip, not at the <code>STOP</code>, and the move is not made on the power-on line. Read from our source (the <code>KEY1</code> read path, the deferral counter in both the halted and the running step, <code>ct_switch_ppu</code>).</div>' +

    '<div class="gbemu-rule" id="gbcr-3-6"><b>Rule C3/6.</b> The stall is an ordinary halt with a countdown, and it ends early on an interrupt exactly as <code>HALT</code> does on the Color:' +
      '<ol class="gbemu-steps">' +
        '<li>At the boundary of each stalled machine cycle the request is tested raw: a request both enabled and pending (IE AND IF, bits 0 to 4, non-zero), whatever the master enable IME holds.</li>' +
        '<li>When the test finds one, the countdown is abandoned. The halted Color then runs <b>one extra machine cycle</b> (at the speed in force: 4 dots at single speed, 2 dots in double speed) before it leaves the halt (<a href="#gbce-10">section 10</a>&rsquo;s halted-wake row).</li>' +
        '<li>The instruction boundary then continues as any other: a horizontal-blank block that is owed runs (<a href="#gbcr-11-8">Rule C11/8</a>), then the dispatch if IME is set, otherwise the next instruction.</li>' +
      '</ol>' +
      'A halted processor wakes only on such an interrupt or on the countdown. It must not be modelled as parked (the original&rsquo;s <code>STOP</code>, which wakes only on a selected pad line).</div>' +
    '<div class="gbemu-example"><b>Example.</b> Going up, the vertical-blank request is raised with IE bit 0 set and IME clear during stalled machine cycle 2 (the flip counter is then 2). At the next boundary the raw test finds it; the processor runs one extra machine cycle of 4 dots (still single speed) and leaves the halt; that woken boundary counts the flip counter down to 1 (<a href="#gbcr-3-5">Rule C3/5</a>, row 3), and its instruction runs at single speed; no dispatch is made, because IME is clear. At the next instruction boundary the counter reaches 0 and the speed flips.</div>' +
    '<div class="gbemu-why"><b>Why.</b> The difference between halted and parked is fatal rather than ' +
        'cosmetic: a parked processor wakes only on a selected pad line, and a cartridge that writes <code>0x30</code> to the pad ' +
        'register (no group selected) immediately before its <code>STOP</code> can ' +
        'then never wake at all. The extra machine cycle is taken because the stall is an ordinary halt with a countdown, so the same path is taken as for <code>HALT</code>. MECHANISM, read from our source.</div>' +

    '<div class="gbemu-rule" id="gbcr-3-7"><b>Rule C3/7.</b> The divider during a speed switch:' +
      '<ol class="gbemu-steps">' +
        '<li>It is reset at the <code>STOP</code>, at the end of the operand fetch.</li>' +
        '<li>It then runs through the stall, so the timer and the sound unit&rsquo;s frame sequencer see its edges.</li>' +
        '<li>When the countdown expires it is reset again. That second reset is released at the <b>end</b> of the switch&rsquo;s last machine cycle (stalled machine cycle 32,766), not at its start, so that cycle&rsquo;s four clocks are not counted.</li>' +
      '</ol>' +
      'An interrupt that wakes the stall early abandons the countdown with no second reset, so the divider counts on from the reset made at the <code>STOP</code>. With an interrupt already pending at the <code>STOP</code> there is no stall and the divider is reset once, at the <code>STOP</code>. <a href="#gbcr-3-5">Rule C3/5</a>&rsquo;s table lists the resets for each case.</div>' +
    '<div class="gbemu-example"><b>Example.</b> After step 3 the divider&rsquo;s counter is 0 at the end of stalled machine cycle 32,766. The first machine cycle of the next instruction is the first to count. A build that releases the reset at the start of cycle 32,766 has already counted that cycle&rsquo;s four clocks, so its first divider step after the switch comes one machine cycle early.</div>' +
    '<div class="gbemu-why"><b>Why.</b> <b>For a divider read, the divider is held in reset for the whole switch and released when the stall ' +
        'expires</b>: nothing can read the divider during the stall, so the read sees the same as from Rule C3/7&rsquo;s two resets. This is an ordering result, not a magnitude: resetting it only at the ' +
        '<code>STOP</code> (with no second reset at expiry) gives one differing sample of 32 against a cartridge&rsquo;s declared ' +
        'table; resetting it <em>before</em> the operand fetch makes it worse, and is kept in the ' +
        'source as a scored negative saying the reset must move later rather than earlier; releasing ' +
        'it at expiry gives <b>0 of 32, exact</b>. The release at the end of the last machine cycle: the AGE test <code>spsw-div</code>, verified on CPU CGB B, C and E, says the number of machine cycles to the first divider step after a switch is always the same; MECHANISM. Read from our source.</div>' +

    '<div class="gbemu-rule" id="gbcr-3-8"><b>Rule C3/8.</b> <b>The picture processor keeps running through the stall</b>, on every stalled machine cycle: the line counter advances and the status register cycles across the switch.</div>' +
    '<div class="gbemu-why"><b>Why.</b> The declared data has the ' +
        'line counter advancing and the status register cycling across the switch, and a parked ' +
        'picture processor would do neither.</div>' +

    '<p class="hw-readable"><b>Two things recorded rather than implemented.</b> On real hardware the ' +
    'joypad exit takes priority over the switch when a selected line already reads low; nothing this ' +
    'project owns reaches that case, so it is named and not modelled. And there is a characterised, ' +
    'unclosed residual: <b>when the stall ends, our picture processor is 4 to 9 dots (two to ' +
    'four machine cycles) behind where the cartridge&rsquo;s declarations put it, and the ' +
    'processor is not.</b> The offset is constant, repeats at 456 dots and never re-absorbs. ' +
    'The locus is named (the machine cycle that takes the stall to zero ' +
    'still pays a full tick before the processor resumes); this core does not change it.</p>' +

    '<h4 class="gbemu-sub">What scales and what does not</h4>' +
    '<div class="gbemu-rule" id="gbcr-3-9"><b>Rule C3/9.</b> In double speed each quantity below must scale as its row says, compared with the same quantity at single speed.</div>' +
    '<table class="gbemu-table"><thead><tr><th>Quantity</th><th>In double speed (compared with single speed)</th><th>Why</th></tr></thead><tbody>' +
      '<tr><td>Instruction rate</td><td><b>Twice as fast in wall time</b></td><td>Structural: the same machine cycle covers half as much of the line</td></tr>' +
      '<tr><td>Divider, timer</td><td><b>Twice as fast</b></td><td>Falls out. There is no speed term anywhere in the timer, and there should not be</td></tr>' +
      '<tr><td>Serial internal clock</td><td><b>Twice as fast</b></td><td>It is a bit of the divider, so it comes along for free</td></tr>' +
      '<tr><td>Dot clock, line counter, mode boundaries</td><td><b>Unchanged</b></td><td>Nailed to wall time. This is <em>the</em> conditional: ideally one, on one literal</td></tr>' +
      '<tr><td>Frame</td><td><b>70,224 dots, unchanged</b></td><td>140,448 CPU T-cycles. A frame budget written in CPU T-cycles silently halves the frame. And what one frame step of our core runs is not &ldquo;the next frame&rsquo;s worth of dots&rdquo; either: with the display on it runs until the picture wraps into line 144, dot 0 (not to the vertical-blank request, which on the Color comes three dots later); with the display off it runs one frame of dots (twice as many CPU T-cycles in double speed) from its own start; it never runs past two frames. The Game Boy tab, section 1, has every case, including a step during which the display is switched off or on. A speed switch does not change this: the stall&rsquo;s dots count like any others, and the picture keeps running through it</td></tr>' +
      '<tr><td>Sprite-memory transfer</td><td>Still 160 machine cycles, so <b>half the wall time</b></td><td>640 dots at single speed, 320 in double</td></tr>' +
      '<tr><td>Block transfer</td><td><b>Two dots per byte in both modes</b></td><td>32 dots per 16-byte block either way, but 8 machine cycles single and <b>16</b> double, so it costs a double-speed program twice as much processor time per byte. A horizontal-blank block in double speed spends one more machine cycle first (<a href="#gbcr-11-8">Rule C11/8</a>), and a general-purpose transfer one more machine cycle once (<a href="#gbcr-11-9">Rule C11/9</a>)</td></tr>' +
      '<tr><td>Sound frame sequencer</td><td><b>Still 512 Hz</b></td><td>By selecting divider bit <b>13</b> instead of bit 12. Measured on the shipped core with a synthetic Color-flagged cartridge that switches speed and then loops: 1,028 steps over 120 frames (8,426,880 dots, counted from the first dot after the switch stall ends) on bit 13, 2,057 on bit 12; 512 Hz predicts 1,028.7. A window that includes the switch stall reads lower where the divider is held in reset through it (1,020 on one build that does so).</td></tr>' +
      '<tr><td>Sound channel timers, wave advance, noise steps</td><td><b>Unchanged</b></td><td>The sound unit is not clocked by the processor at all: a machine cycle is 2 T here, so a core that runs the channels per machine cycle runs them at <b>twice</b> their rate. Section 13</td></tr>' +
      '<tr><td>The square channels&rsquo; sample grid</td><td><b>Becomes visible</b></td><td>The 4 T grid is invisible at single speed because a machine cycle <em>is</em> 4 T. In double speed the processor writes on a 2 T grid and can miss it: 0 adjustments over 69 cartridges at single speed, 200 over 9 in double</td></tr>' +
      '<tr><td>Real-time clock</td><td><b>Unchanged in wall time</b></td><td><b>So its divisor doubles</b>: 8,388,608 processor T-cycles to a clock second, or equivalently half an advance per machine cycle. <b>Mind the sign</b>, which the measurement in this same cell gives: 30 frames per clock second means the uncorrected clock runs <em>fast</em>, so the divisor must grow, not shrink. Measured with a cartridge that compares frames per clock second either side of a switch and needs no absolute constant, so it cannot go stale: measured on the shipped core with that cartridge (<code>rtc_speed</code>, our own): <b>60 against 59</b> with the clock in wall time, <b>60 against 30</b> with it left in the processor&rsquo;s domain. The count is the number of whole frames between two clock-second edges and 4,194,304 / 70,224 = 59.73 frames per clock second, so 59 and 60 are both correct readings of one rate and which one a run prints depends on phase; the cartridge passes any pair within 3. The finding is the factor of two, not the 59 or 60.</td></tr>' +
    '</tbody></table>' +
    '<div class="gbemu-why"><b>Why.</b> The trap in that table with the longest fuse: <b>implement the block ' +
    'transfer as &ldquo;eight machine cycles&rdquo; and it is right at single speed and <em>half ' +
    'the charge</em> in double</b>. The row above prices the same block at 8 machine cycles ' +
    'single and <b>16</b> double, so charging 8 in double speed hands the processor eight machine ' +
    'cycles back that it should have spent, and the failure looks like a title running <b>fast</b>, ' +
    'not like a transfer bug, so it will be attributed to everything else first. ' +
    '<b>Get that sign right: under-charging returns time, it does not consume it, so the symptom ' +
    'is FAST and never slow.</b> A symptom stated with the wrong sign is worse than no symptom, ' +
    'because it sends the reader looking down the one branch that cannot contain the cause. The ' +
    'real-time-clock row turns on the same sign question.</div></section>' +

  /* ------------------------------------------------------------------- 4 */
  '<section class="sect" id="gbce-4"><h3 class="sect-h">4. Work RAM, and the two questions every register asks</h3>' +
    '<h4 class="gbemu-sub">Device or mode, and they are not the same question</h4>' +
    '<div class="gbemu-rule" id="gbcr-4-1"><b>Rule C4/1.</b> Every Color register is gated on one of two predicates, and the read side and the write side of one register may use different ones:' +
    '<ul class="gbemu-bullets">' +
      '<li><b>The device: is this machine a Color?</b> True even when it is running an original cartridge.</li>' +
      '<li><b>The mode: is it in colour mode?</b> False for an original cartridge, because the boot program ' +
        'put it into compatibility mode.</li>' +
    '</ul>' +
    'A build must implement the two as separate tests and apply to each register, on each side, the predicate appendix A&rsquo;s last column gives it.</div>' +
    '<div class="gbemu-example"><b>Example.</b> The video-memory bank register (<code>FF4F</code>) is the clearest case and the one to hold ' +
    'in mind: <b>its read is gated on the device and its write on the mode.</b> A Color running an ' +
    'original cartridge still <em>shows</em> that register (a test cartridge with no Color ' +
    'flag asserts the read mask directly) and still <em>ignores</em> writes to it, which is ' +
    'what makes the second bank unreachable there. The work-RAM bank register (<code>FF70</code>) is gated differently again: its read on the mode, its write on the mode or the boot program, and the bank it selects applies in both modes (<a href="#gbcr-4-4">Rule C4/4</a>).</div>' +
    '<div class="gbemu-why"><b>Why.</b> Which predicate a register uses ' +
    'is not guessable from the register&rsquo;s purpose. <b>Two neighbouring ' +
    'registers, two different predicates, and a single test for both gets one of them wrong ' +
    'silently.</b> Write the two tests separately and say at each why.</div>' +

    '<h4 class="gbemu-sub">Work RAM: eight banks, all eight reachable, but only seven through the register</h4>' +
    '<div class="gbemu-rule" id="gbcr-4-2"><b>Rule C4/2.</b> In colour mode work RAM is <b>32 KB in eight 4 KB banks.</b> <code>0xC000&ndash;0xCFFF</code> is always bank 0. ' +
        '<code>0xD000&ndash;0xDFFF</code> is the banked half: it shows the bank that bits 2&ndash;0 of <code>0xFF70</code> select, except that <b><code>0xFF70</code> = 0 selects bank 1</b>. The register keeps bits 2 to 0 of the written value (0 stays 0 at the store; only the indexing treats 0 as 1) and reads back as those bits with bits 7 to 3 set (<code>value</code> OR <code>0xF8</code>). It has <b>no latch</b>: a game may write it at any time.</div>' +
    '<div class="gbemu-example"><b>Example.</b> Write <code>0x00</code> to <code>FF70</code>: it reads <code>0xF8</code>, and <code>0xD000</code> shows bank 1. Write <code>0x01</code>: it reads <code>0xF9</code>, and <code>0xD000</code> shows the same bank 1. Write <code>0x0B</code>: it reads <code>0xFB</code>, and <code>0xD000</code> shows bank 3. Bank 0 is reachable only at <code>0xC000</code>.</div>' +
    '<div class="gbemu-why"><b>Why.</b> So seven banks are reachable through eight ' +
        'register values, and bank 0 is reachable only at <code>0xC000</code>: reachable, ' +
        'though, which is why the heading says all eight are reachable and only seven through the ' +
        'register. That is not a quirk ' +
        'to be tidied away: it is the thing that makes 0 and 1 the same memory.</div>' +
    '<div class="gbemu-rule" id="gbcr-4-3"><b>Rule C4/3.</b> <b>The echo region is banked too.</b> ' +
        '<code>0xE000&ndash;0xFDFF</code> mirrors <code>0xC000&ndash;0xDDFF</code>, so everything ' +
        'from <code>0xF000</code> up mirrors the <em>banked</em> half and follows the bank register ' +
        'with it. This rule is the processor&rsquo;s echo only: a sprite-memory transfer sourced at <code>0xF000</code> and up reads bank 1 whatever <code>FF70</code> selects (<a href="#gbcr-12-3">Rule C12/3</a>).</div>' +
    '<div class="gbemu-example"><b>Example.</b> With <code>FF70</code> = 3, a read of <code>0xF123</code> returns the byte at <code>0xD123</code> in bank 3, and a read of <code>0xE123</code> returns the byte at <code>0xC123</code> in bank 0.</div>' +
    '<div class="gbemu-why"><b>Why.</b> An echo pinned to bank 1 would be a second, unbanked view of the same address, ' +
        'which is not a mirror. ' +
    'An instrument for the banking that needs no reference image at all, which is ' +
    'the kind worth building first: <b>write a distinct byte to <code>0xD000</code> under each of ' +
    'the eight bank values, then read all eight back.</b> A banked machine returns <b>seven distinct ' +
    'values of eight</b>, because 0 aliases 1; an unbanked one returns one. Measured at 7 of 8 on 5 ' +
    'of 5 Color cartridges and 1 of 8 on 2 of 2 originals.</div>' +
    '<div class="gbemu-rule" id="gbcr-4-4"><b>Rule C4/4.</b> <b>Which mode gates <code>FF70</code>, for the read, the write and the bank it selects.</b>' +
      '<table class="gbemu-table"><thead><tr><th>Use of <code>FF70</code> on the Color</th><th>Colour mode</th><th>Compatibility mode, boot program still mapped</th><th>Compatibility mode, boot program unmapped (<code>FF50</code> written)</th></tr></thead><tbody>' +
        '<tr><td>a processor read</td><td>the stored bits 2 to 0 with bits 7 to 3 set: <code>value OR 0xF8</code></td><td><code>0xFF</code></td><td><code>0xFF</code></td></tr>' +
        '<tr><td>a processor write</td><td>stored (bits 2 to 0)</td><td><b>stored</b> (bits 2 to 0)</td><td>ignored</td></tr>' +
        '<tr><td>the bank shown at <code>0xD000</code>&ndash;<code>0xDFFF</code>, to the processor (and in the processor&rsquo;s echo, Rule C4/3) and to a sprite-memory or block transfer sourced there</td><td>the stored value, 0 selecting 1 (Rule C4/2)</td><td>the stored value, 0 selecting 1</td><td>the stored value, 0 selecting 1: it can no longer change, so it is whatever the boot program left (0, so bank 1, section 2)</td></tr>' +
      '</tbody></table>' +
      'The write gate is the palette data ports&rsquo; gate (Rule C6/5): colour mode <em>or</em> the boot program mapped. A sprite-memory transfer (<code>FF46</code> = <code>0xD0</code> to <code>0xDF</code>) or a block transfer sourced at <code>0xD000</code>&ndash;<code>0xDFFF</code> reads the bank in the third row, in every mode; only a sprite-memory transfer sourced at <code>0xF000</code> and up differs (<a href="#gbcr-12-3">Rule C12/3</a>). Read from our source.</div>' +
    '<div class="gbemu-example"><b>Example.</b> The Color boot program, starting an original cartridge, writes <code>KEY0</code> (which turns colour mode off) and then still writes <code>FF70</code> to reach the bank holding the compatibility palette it prepared, and reads that palette back from <code>0xD000</code>&ndash;<code>0xDFFF</code> to load it into palette memory. A build that ignores that <code>FF70</code> write, or that shows bank 1 whenever colour mode is off, reads the wrong bank, loads a palette of zeros and draws every original cartridge in black. Measured on an independent build on 2 November 2026: exactly that, on every compatibility-mode AGE row; with only this rule changed it reads the same palette bytes as our core.</div></section>' +

  /* ------------------------------------------------------------------ 11 */
  '<section class="sect" id="gbce-11"><h3 class="sect-h">11. The block transfer</h3>' +
    '<p class="hw-readable"><b>Units in this section.</b> A block is 16 bytes. Dots are picture-processor dots; machine cycles are at the speed in force (four dots at single speed, two in double speed; <a href="#gbcr-3-1">Rule C3/1</a>). &ldquo;Owed&rdquo; means a block has been earned and waits to run at the processor&rsquo;s next instruction boundary.</p>' +
    '<div class="gbemu-rule" id="gbcr-11-1"><b>Rule C11/1.</b> The registers (colour mode only):' +
    '<table class="gbemu-table"><thead><tr><th>Register</th><th>What it holds</th></tr></thead><tbody>' +
      '<tr><td><code>0xFF51</code> / <code>0xFF52</code></td><td>Source address, high and low. <b>The low four bits are discarded</b></td></tr>' +
      '<tr><td><code>0xFF53</code> / <code>0xFF54</code></td><td>Destination, high and low. Low four bits discarded again</td></tr>' +
      '<tr><td><code>0xFF55</code></td><td>Bits 0&ndash;6 length in 16-byte blocks <b>minus one</b>; bit 7 chooses the mode: 1 = horizontal-blank transfer, 0 = general-purpose transfer (<a href="#gbcr-11-4">Rule C11/4</a> has the cancelling case)</td></tr>' +
    '</tbody></table>' +
      '<b>A transfer is 16-byte aligned at both ends</b>, which is what the discarded bits are for.</div>' +

    '<div class="gbemu-rule" id="gbcr-11-2"><b>Rule C11/2.</b> <b>A source in video memory does not read video memory.</b> A source byte read from an address below ' +
        '<code>0x8000</code> or in <code>0xA000&ndash;0xDFFF</code> goes to the bus; a source byte at any other address ' +
        'returns <code>0xFF</code>.</div>' +

    '<div class="gbemu-rule" id="gbcr-11-3"><b>Rule C11/3.</b> <b>The destination is an offset into video memory, not an address.</b> Store the ' +
        'register bytes whole and resolve at the point of use. The <b>cursor</b> is the destination as written, with its low four bits cleared at the register write (<code>FF54</code> keeps bits 4 to 7 only); it advances by one per byte. Each byte is written to <code>0x8000 | (cursor &amp; 0x1FFF)</code> in the video bank <code>FF4F</code> selects at that byte, re-masked on <em>every</em> ' +
        'byte, not once at the start. So a block of 16 bytes fills 16 consecutive addresses and the next block starts on the next 16-byte boundary.</div>' +
    '<div class="gbemu-example"><b>Example.</b> Destination written as <code>0x9F</code> / <code>0xF5</code>, length 2 blocks (<code>FF55</code> bits 0&ndash;6 = 1): the cursor is <code>0x9FF0</code>. The first block fills <code>0x9FF0</code>&ndash;<code>0x9FFF</code>. The second block <em>wraps inside video memory</em> and fills <code>0x8000</code>&ndash;<code>0x800F</code>; it does not run on into work memory at <code>0xA000</code>.</div>' +
    '<div class="gbemu-why"><b>Why.</b> The low-nibble clear belongs to the register write, not to each byte: a mask of <code>0x1FF0</code> applied per byte would put all 16 bytes on one address. Read from our source.<br>' +
        '<b>Do not try to justify the re-mask from a pair of written values.</b> Writing ' +
        '<code>0xFF00</code> and writing <code>0x9F00</code> behave identically: both mask to ' +
        '<code>0x1F00</code>, they differ only in bits the mask discards, and they differ by ' +
        '<code>0x6000</code> (a multiple of the 8K window), so the two cursors stay ' +
        'congruent for the whole of the longest possible transfer. <b>No pair of values can show ' +
        'the effect</b>: the three bits masked away here are ' +
        'discarded on every path, so no written <em>value</em> is ever distinguished by them. ' +
        '<b>What actually justifies the instruction is the placement, not a value:</b> re-mask each ' +
        'byte and a transfer running off the top of video memory <em>wraps inside it</em>; build ' +
        'one absolute address at the start and let the cursor increment and it runs past ' +
        '<code>0x9FFF</code> into work memory. That is a real difference and it is reachable from a ' +
        'legal register pair. <b>Read from source</b>: the transfer indexes video memory as ' +
        '<code>(cursor &amp; 0x1FFF) | (bank &lt;&lt; 13)</code> at each byte.</div>' +

    '<div class="gbemu-rule" id="gbcr-11-4"><b>Rule C11/4.</b> A write to <code>0xFF55</code> in colour mode first stores the written bits 0&ndash;6 as the length, <b>on every write, the cancelling write included</b>, and then acts by this table:' +
      '<table class="gbemu-table"><thead><tr><th>Transfer live when the write is made</th><th>Bit 7 of the written value</th><th>Result</th></tr></thead><tbody>' +
        '<tr><td>none</td><td>0</td><td>a general-purpose transfer starts (<a href="#gbcr-11-9">Rule C11/9</a>)</td></tr>' +
        '<tr><td>none</td><td>1</td><td>a horizontal-blank transfer starts (<a href="#gbcr-11-6">Rule C11/6</a>)</td></tr>' +
        '<tr><td>a horizontal-blank transfer</td><td>0</td><td><b>it is cancelled and nothing starts</b></td></tr>' +
        '<tr><td>a horizontal-blank transfer</td><td>1</td><td>a horizontal-blank transfer starts again with the new length (<a href="#gbcr-11-6">Rule C11/6</a>); read from our source</td></tr>' +
      '</tbody></table>' +
      'A general-purpose transfer is never live when a processor write is made, because no instruction runs during it (<a href="#gbcr-11-9">Rule C11/9</a>).</div>' +
    '<div class="gbemu-why"><b>Why.</b> Cancelling is the register&rsquo;s second function, not a special case bolted on. ' +
        'The naive reading (&ldquo;bit 7 clear means general purpose&rdquo;) starts a ' +
        'full-speed copy where hardware stops one. The length is taken before the cancel is decided.</div>' +

    '<div class="gbemu-rule" id="gbcr-11-5"><b>Rule C11/5.</b> A read of <code>0xFF55</code> in colour mode returns, by state:' +
      '<table class="gbemu-table"><thead><tr><th>State</th><th>Bit 7</th><th>Bits 6&ndash;0</th><th>Whole byte</th></tr></thead><tbody>' +
        '<tr><td>a transfer is live</td><td><b>0</b></td><td>blocks remaining, minus one</td><td><code>0x00</code> to <code>0x7F</code></td></tr>' +
        '<tr><td>a transfer has completed (nothing live)</td><td>1</td><td>all 1</td><td><code>0xFF</code></td></tr>' +
        '<tr><td>freshly reset, before any transfer has run</td><td>1</td><td>0 (the reset zeroes the length field; only a completion drives it to all 1)</td><td><code>0x80</code></td></tr>' +
        '<tr><td>a horizontal-blank transfer cancelled (<a href="#gbcr-11-4">Rule C11/4</a>)</td><td>1</td><td>the cancelling write&rsquo;s bits 6&ndash;0</td><td><code>0x80</code> OR those bits</td></tr>' +
      '</tbody></table>' +
      '<b>On read, bit 7 clear means a transfer is live.</b></div>' +
    '<div class="gbemu-example"><b>Example.</b> Write <code>0x83</code> (horizontal-blank, 4 blocks) with nothing live: before the first block a read returns <code>0x03</code>; after the first block <code>0x02</code>; after the fourth block <code>0xFF</code>. Write <code>0x05</code> while it is still live: it is cancelled and a read returns <code>0x85</code>.</div>' +
    '<div class="gbemu-why"><b>Why.</b> Bit 7&rsquo;s polarity is the opposite from ' +
        'every other status bit in the machine and it is the one thing a reader will misremember. ' +
        'The fresh-reset <code>0x80</code> is visible only between the reset and the first transfer: the Color boot program&rsquo;s own general-purpose transfers leave <code>0xFF</code> by the hand-over, and the no-boot start sets <code>0xFF</code>, so a cartridge first reads <code>0xFF</code> (section 2 is right for both starts). Section 18 carries that as a named open item against documentation that ' +
        'says <code>0xFF</code> there too. <b>This rule and appendix A are the two places an implementer copies the idle value from, so the divergence is named in both.</b> ' +
        'So the only observable that ' +
        'moves is the value <em>during</em> a transfer: take the reading mid-transfer or you ' +
        'are testing nothing.</div>' +

    '<div class="gbemu-rule" id="gbcr-11-6"><b>Rule C11/6.</b> When a horizontal-blank transfer is started (<a href="#gbcr-11-4">Rule C11/4</a>), its first block is owed at once only if, at the write, the display is on, the picture processor&rsquo;s <b>internal</b> mode is 0 and its line is below 144; with the display off the first block is always owed at once. Arming is a per-line <em>edge</em>, ' +
      'not a level. The internal mode is 0 from the internal mode-0 entry (the dot on which the line&rsquo;s 160th pixel is popped) to the end of the line, and on dots 0 to 3 of lines 1 to 143, because it stays 0 across the line boundary until the scan begins on dot 4. The wrap into line 0 sets the internal mode to 2 on dot 0.' +
      '<table class="gbemu-table"><thead><tr><th>Display (LCDC bit 7)</th><th>Line of the write (the picture processor&rsquo;s line, 0 to 153)</th><th>Dots of that line at the write (from the line&rsquo;s dot 0)</th><th>Internal mode</th><th>First block</th></tr></thead><tbody>' +
        '<tr><td>off</td><td>any</td><td>any</td><td>none (no horizontal blanks at all)</td><td><b>owed at the write</b>; it moves at the next instruction boundary like any other. The blocks after it wait for horizontal blanks, so they wait until the display is on</td></tr>' +
        '<tr><td>on</td><td>0</td><td>dot 0 up to the internal mode-0 entry</td><td>2 or 3</td><td>waits for line 0&rsquo;s own horizontal blank</td></tr>' +
        '<tr><td>on</td><td>0 to 143</td><td>from the internal mode-0 entry to the line&rsquo;s last dot</td><td>0</td><td><b>owed at the write</b></td></tr>' +
        '<tr><td>on</td><td>1 to 143</td><td>dots 0 to 3</td><td>0 (carried across the line boundary)</td><td><b>owed at the write</b></td></tr>' +
        '<tr><td>on</td><td>1 to 143</td><td>dot 4 up to the internal mode-0 entry</td><td>2 or 3</td><td>waits for this line&rsquo;s horizontal blank</td></tr>' +
        '<tr><td>on</td><td>144 to 153 (vertical blank)</td><td>any</td><td>any</td><td>nothing is owed at the write and nothing during vertical blank: waits for line 0&rsquo;s horizontal blank</td></tr>' +
      '</tbody></table></div>' +
    '<div class="gbemu-example"><b>Example.</b> Display on. A start written on line 37, dot 2, owes its first block at once (internal mode still 0 from line 36). A start written on line 0, dot 2, waits until line 0&rsquo;s horizontal blank. A start written on line 150 waits until line 0&rsquo;s horizontal blank of the next frame.</div>' +
    '<div class="gbemu-why"><b>Why.</b> &ldquo;Already in mode 0&rdquo; means a horizontal blank of a visible line, 0 to 143, with the display on, so a transfer started there does not wait for the next horizontal blank. <b>With the display off there are no horizontal blanks at all</b>, so a transfer started ' +
        'then stalls forever unless the first block is owed at the moment of the write. Two test ' +
        'rows hang on exactly that. Read from our source (the start write owes a block only when the display is on, the internal mode is 0 and the line is below 144, or when the display is off).</div>' +

    '<div class="gbemu-rule" id="gbcr-11-7"><b>Rule C11/7.</b> <b>Rate: 16 bytes per block, two dots per byte</b>: 32 dots per block in both speed modes, which is 8 machine cycles at single speed and 16 in double. Inside a block: at single speed two bytes are written and then one machine cycle (4 dots) advances, eight times; in double speed one byte is written and then one machine cycle (2 dots) advances, sixteen times; counting from the block&rsquo;s first byte. No instruction runs during a block.</div>' +
    '<div class="gbemu-why"><b>Why.</b> Because no instruction runs during a block, only the picture processor can see that placement. MECHANISM, read from our source (<code>hdma_chunk</code>). Section 3 (<a href="#gbcr-3-9">Rule C3/9</a>, the block-transfer row) has why the machine-cycle count matters.</div>' +

    '<div class="gbemu-rule" id="gbcr-11-8"><b>Rule C11/8.</b> A horizontal-blank transfer moves <b>exactly one block per horizontal blank</b>: 16 bytes, not two blocks and not ' +
        '&ldquo;as many as fit&rdquo;. A block is owed:' +
      '<ul class="gbemu-bullets"><li><b>at single speed</b>: on the internal mode-0 entry of lines 0 to 143 (the dot the line&rsquo;s last pixel has left, which on an object line can be up to 2 dots after STAT reports mode 0);</li>' +
      '<li><b>in double speed</b>: 3 dots later, 3 dots after the last pixel (section 10&rsquo;s timing table, the horizontal-blank row, whose single-speed cell points back here).</li></ul>' +
      'A block still owed when the next horizontal blank arrives is not owed twice: a second blank cannot owe a second block. An owed block runs at the next instruction boundary at which the processor is not halted, in this order:' +
      '<ol class="gbemu-steps">' +
        '<li>The picture is paid up to the boundary and the interrupt request is sampled, as at any boundary (the Game Boy tab, D.10.1).</li>' +
        '<li>If the processor is halted, nothing moves: <b>a halted processor moves no bytes</b>, and the block waits for the wake.</li>' +
        '<li>The block runs. At single speed: 8 machine cycles, with no extra machine cycle (that one belongs to the general-purpose transfer only). In double speed: first one byte slot, one machine cycle (2 dots), before the first byte, then 16 machine cycles, so a block takes 17 there. Its machine cycles pay their dots like any others, and no instruction runs during it.</li>' +
        '<li>Then the dispatch, if sample (1) asked for one; otherwise the next instruction. A request raised during the block is not taken at this boundary but at the next.</li>' +
      '</ol>' +
      '<b>Each horizontal-blank block stalls the processor for its whole length.</b> &ldquo;The processor keeps running&rdquo; means between blocks, not during them.</div>' +
    '<div class="gbemu-example"><b>Example.</b> Double speed, a horizontal-blank transfer live, no object on the line: the last pixel leaves on dot D; the block is owed on dot D + 3. At the next boundary the block costs 1 + 16 = 17 machine cycles, 34 dots. A timer request raised during those 17 machine cycles is not dispatched at this boundary: the next instruction runs first, and the request is taken at the boundary after it. At single speed the same block is owed on dot D and costs 8 machine cycles, 32 dots.</div>' +
    '<div class="gbemu-why"><b>Why.</b> Both double-speed rules (the 3 dots and the one byte slot) are ' +
      'MECHANISM, read in the reference and in our source (<code>CT_HDMA_DS</code> 3, ' +
      '<code>CT_HDMA_LEAD_DS</code> 1). The order at the boundary is read from our source (the step routine: settle, sample, block, dispatch, instruction). After a ' +
      'cancelling write <code>0xFF55</code> reads <code>0x80</code> with the cancelling write&rsquo;s length ' +
      'bits. Read from our own source; the cost in machine cycles is the general-purpose rate above. ' +
      '<b>One block per blank is worth stating as a number</b>, because everything above ' +
        'it (the per-block ' +
        'rate, the per-line edge, the stall arithmetic) is denominated in blocks, so an implementer transferring two per blank reproduces every figure on this page and the wrong ' +
        'picture. The arming is a per-line edge precisely so a blank cannot pay for a block ' +
        'twice.</div>' +

    '<div class="gbemu-rule" id="gbcr-11-9"><b>Rule C11/9.</b> <b>A general-purpose transfer locks the processor out for its whole length:</b> ' +
        'no instruction executes between the write that starts it and its ' +
        'last byte. It runs in this order:' +
      '<ol class="gbemu-steps">' +
        '<li>The write that starts it completes its instruction.</li>' +
        '<li>At the next instruction boundary the picture is paid up and the interrupt request is sampled.</li>' +
        '<li><b>One extra machine cycle, once per transfer, independent of length</b>, at both speeds: 4 dots at single speed, 2 dots in double speed.</li>' +
        '<li>All the blocks, back to back: 8 machine cycles each at single speed, 16 in double (<a href="#gbcr-11-7">Rule C11/7</a>).</li>' +
        '<li>The processor resumes: the dispatch, if sample (2) asked for one, otherwise the next instruction.</li>' +
      '</ol>' +
      'The clock advances for the transfer. A halted processor moves no bytes.</div>' +
    '<div class="gbemu-example"><b>Example.</b> <code>0x12</code> written to <code>FF55</code> with nothing live starts a general-purpose transfer of 19 blocks. At single speed it costs 1 + 19 &times; 8 = 153 machine cycles, 612 dots. In double speed it costs 1 + 19 &times; 16 = 305 machine cycles, 610 dots. A build that leaves out the extra machine cycle costs 608 dots at single speed.</div>' +
    '<div class="gbemu-why"><b>Why.</b> The lock-out shows up only in the costing, and <b>a free copy ' +
        'matches every figure on this page</b> (the block rate, the one extra machine cycle, ' +
        'the 12 T-cycle handover shortfall, all of it), because those are statements about ' +
        'how long the transfer takes, not about who is running while it does. ' +
        'That is also why <em>&ldquo;a halted processor moves no bytes&rdquo;</em> is ' +
        'consistent rather than contradictory: the transfer runs <em>from</em> the processor&rsquo;s ' +
        'own step, so a processor that is not stepping is not transferring. <b>MECHANISM for the ' +
        'horizontal-blank mode&rsquo;s complement</b> (the whole point of that mode is that ' +
        'the processor keeps running) and <b>read from our own source</b> for the ' +
        'general-purpose arm. The place of the extra machine cycle, first, before the first block, is read from our source.</div>' +

    '<h4 class="gbemu-sub">One extra machine cycle, once per general-purpose transfer</h4>' +
    '<p class="hw-readable">The extra machine cycle of <a href="#gbcr-11-9">Rule C11/9</a> step 3 rests on three parts with three different strengths, and ' +
    'this page labels the result by the weakest.</p>' +
    '<ul class="gbemu-bullets">' +
      '<li><b>The magnitude is from the cartridge.</b> A boot-divider test reads the divider at six ' +
        'declared points with declared spacing, which pins the boot program&rsquo;s total length to ' +
        'one machine cycle. Without the extra machine cycle this core is 12 T-cycles short of the reference at handover on every ' +
        'cartridge tried: a <em>constant</em> 12, not a per-cartridge figure.</li>' +
      '<li><b>The locus is from our own trace.</b> All 176 executions of the boot program&rsquo;s ' +
        'wait-for-vertical-blank routine were logged on both sides and diffed line for line. They ' +
        'disagree in exactly two shapes: a 24 T-cycle spin that the next wait re-absorbs, ' +
        'contributing <b>zero</b> at handover, and <b>three general-purpose transfers each 4 ' +
        'T-cycles short</b>. Three times four is the whole twelve. Without the extra machine cycle ours cost 32 T &times; blocks ' +
        'exactly; the reference costs 32 T &times; blocks + 4. <b>Constant, not proportional.</b></li>' +
      '<li><b>The value is from the reference implementation&rsquo;s own cycle trace</b>, and ' +
        'that is what makes this <b>CONVERGENCE</b> rather than a derivation. Pan Docs, read at its ' +
        'own locus, gives only <i>&ldquo;8 M-cycles in Normal Speed Mode, and 16 &lsquo;fast&rsquo; ' +
        'M-cycles in Double Speed Mode&rdquo;</i> per sixteen bytes and names no fixed overhead. The ' +
        'one suite cartridge that times a transfer times the <em>horizontal-blank</em> one. Neither ' +
        'derives it.</li>' +
    '</ul>' +
    '<div class="gbemu-why"><b>Why.</b> It is labelled convergence and it is <b>not</b> fitted, and the difference ' +
    'is procedural rather than rhetorical: <b>no constant was swept, and the locus was found before ' +
    'the value.</b> Its reach, with its denominators: three transfers with the boot program and zero without, zero across all ' +
    '252 drawing-mode probes, and exactly one cartridge in 292 that performs a general-purpose ' +
    'transfer of its own. <b>Double speed is unmeasured, by declaration</b>: nothing in reach ' +
    'exercises it. <b>What our core does there</b>, so a build can match it: the same one extra machine cycle per general-purpose transfer (not per block), spent before the first block, at both speeds; in double speed that cycle is two dots, and each 16-byte block then takes 16 machine cycles. Read from our source (<code>GDMA_SETUP_M</code> 1, with no speed term).</div>' +
    '<p class="hw-readable">One thing deliberately <em>not</em> modelled: the case where a ' +
    'concurrent sprite-memory transfer also lands the byte in sprite memory. Both reference ' +
    'implementations model it and both hedge it, one of them putting the duplication at roughly one ' +
    'byte in two. A guess at a corruption is worse than its absence, and the phase it would need is ' +
    'half a machine cycle finer than this core can express.</p></section>' +

  /* ------------------------------------------------------------------ 12 */
  '<section class="sect" id="gbce-12"><h3 class="sect-h">12. Sprite-memory transfer on the Color</h3>' +
    '<p class="hw-readable">The bus rule is on the original Game Boy&rsquo;s page, in section 5, ' +
    'with the measurement behind it and the note that the document everyone cites has ' +
    '<code>TODO</code> where its answer should be. The short form: <b>ask which bus the transfer ' +
    'occupies, never whether one is running.</b> Machine cycles below are numbered from W, the machine cycle that carries the processor&rsquo;s write to <code>0xFF46</code>.</p>' +
    '<div class="gbemu-rule" id="gbcr-12-1"><b>Rule C12/1.</b> Sort both the transfer&rsquo;s source and the ' +
    'processor&rsquo;s address into a group: external, video, work RAM, or none. Same group is a conflict; ' +
    'different groups is nothing. <b>On the Color the cartridge and work RAM are on separate buses</b> (separate groups), where the original puts ' +
    'them on one.' +
      '<table class="gbemu-table"><thead><tr><th>Transfer source</th><th>Processor access</th><th>Original</th><th>Color</th></tr></thead><tbody>' +
        '<tr><td>cartridge memory or cartridge RAM</td><td>work RAM</td><td>conflict</td><td><b>nothing</b></td></tr>' +
        '<tr><td>work RAM</td><td>cartridge memory or cartridge RAM</td><td>conflict</td><td><b>nothing</b></td></tr>' +
        '<tr><td>any group</td><td>the same group</td><td>conflict</td><td>conflict</td></tr>' +
      '</tbody></table>' +
      '<b>What a conflict does</b>: a processor read on the transfer&rsquo;s bus returns the byte the transfer is moving in that machine cycle (source byte 0 in W+2, source byte j in W+3+j), and a processor write on that bus is dropped. Same rule on both machines; the Game Boy tab&rsquo;s section 4 has it with the table.</div>' +
    '<div class="gbemu-why"><b>Why.</b> The Color&rsquo;s whole contribution to that rule is <b>one fewer ' +
    'collision</b>. The ' +
    'split is pinned by a cartridge rather than chosen: it pushes a register pair to a work-RAM ' +
    'stack during a transfer sourced from cartridge memory and pops it back. On the original it must read ' +
    'the transfer&rsquo;s bytes and the push must not land, on the Color it must read back what it ' +
    'pushed. One cartridge asserting both devices.</div>' +
    '<div class="gbemu-rule" id="gbcr-12-2"><b>Rule C12/2.</b> <b>Start-up and lock-out: the original&rsquo;s, with no device split.</b>' +
      '<ol class="gbemu-steps">' +
        '<li>W: the processor writes <code>0xFF46</code>.</li>' +
        '<li>W+1: nothing moves.</li>' +
        '<li>W+2: the transfer becomes active and the processor is locked out of sprite memory.</li>' +
        '<li>W+3+j: byte j lands, for j = 0 to 159.</li>' +
        '<li>W+162: the lock lifts for the access in this machine cycle, with all 160 bytes in place.</li>' +
      '</ol>' +
      '<b>Duration: 160 machine cycles</b>: 640 dots at single speed, <b>320 in double</b>. While the transfer owns sprite memory, on both machines, processor reads of it return ' +
        '<code>0xFF</code> and processor writes to it are dropped.</div>' +
    '<div class="gbemu-why"><b>Why.</b> The Game Boy tab&rsquo;s section 4 has the table and' +
      ' the dots. Measured on the Color device: <code>oam_dma_start</code>, <code>oam_dma_restart</code>,' +
      ' <code>oam_dma_timing</code>, <code>oam_dma/basic</code>, <code>oam_dma/reg_read</code> and every ' +
      'instruction-timing row pass. In double speed the same cycle counts are half the dots; not ' +
      'measured.</div>' +
    '<div class="gbemu-rule" id="gbcr-12-3"><b>Rule C12/3.</b> A source at or above <code>0xE000</code> mirrors work RAM on the Color exactly as on the original (address &minus; <code>0x2000</code>, the Game Boy tab, section 4), with the upper 4 KiB (<code>0xF000</code> and up, mirroring <code>0xD000</code> and up) always bank 1, whatever <code>FF70</code> selects. This is the transfer&rsquo;s view only: the processor&rsquo;s echo follows <code>FF70</code> (<a href="#gbcr-4-3">Rule C4/3</a>), and a source at <code>0xD000</code>&ndash;<code>0xDFFF</code> reads the bank <code>FF70</code> selects, in every mode (<a href="#gbcr-4-4">Rule C4/4</a>).</div>' +
    '<div class="gbemu-example"><b>Example.</b> <code>0xF0</code> written to <code>FF46</code> with <code>FF70</code> = 3: the transfer copies <code>0xD000</code>&ndash;<code>0xD09F</code> of bank 1, not of bank 3, and not a run of <code>0xFF</code> bytes.</div>' +
    '<div class="gbemu-why"><b>Why.</b> Published accounts say such a source <b>reads <code>0xFF</code> on a Color</b>. <b>Our core does not do that</b>: this is an unresolved row, so the original&rsquo;s value is returned; a build that matches our core does the same. The single test that pins the original&rsquo;s behaviour ' +
        'declares itself as failing on Color, so <b>nothing covers the Color side at all</b>: ' +
        'the same test that fixes one machine guarantees the other is unmeasured.</div>' +
    '<p class="hw-readable"><b>Three processor questions a Color build asks, answered.</b> Where a request ' +
      'is noticed: at each instruction boundary with the picture paid up, which in picture time is the ' +
      'end of the cycle that would fetch the next opcode, and that cycle becomes dispatch M1; on the timer side ours tests at the start of that cycle, and testing at its end instead loses no Colour row (the Game Boy tab, D.10.1). The transfer start-up: two cycles, exact, ' +
      'as in <a href="#gbcr-12-2">Rule C12/2</a>. How <code>interrupt_time</code> and <code>halt_bug</code> report: on the ' +
      'screen only, and our board compares a screenshot with the reference picture (the Game Boy tab, ' +
      'section 19).</p></section>' +

  /* ------------------------------------------------------------------ 14 */
  '<section class="sect" id="gbce-14"><h3 class="sect-h">14. The undocumented registers</h3>' +
    '<div class="gbemu-rule" id="gbcr-14-1"><b>Rule C14/1.</b> The four registers behave as this table says. &ldquo;The device&rdquo; means on any Color, in colour mode and in compatibility mode alike (<a href="#gbcr-4-1">Rule C4/1</a>).' +
    '<table class="gbemu-table"><thead><tr><th>Register</th><th>Behaviour</th><th>Gate</th></tr></thead><tbody>' +
      '<tr><td><code>0xFF72</code>, <code>0xFF73</code></td><td>Fully readable and writable, all eight bits. Initial value <code>0x00</code></td><td><b>The device</b>: writes are stored and read back in compatibility mode too</td></tr>' +
      '<tr><td><code>0xFF74</code></td><td>Fully readable and writable <b>in colour mode</b>, initial <code>0x00</code>. <b>Otherwise read-only and locked at <code>0xFF</code></b>: a write outside colour mode is dropped rather than stored</td><td><b>Colour mode</b></td></tr>' +
      '<tr><td><code>0xFF75</code></td><td><b>Only bits 4, 5 and 6 are writable</b> (storage). The rest read 1, so a fresh register reads <b><code>0x8F</code></b></td><td><b>The device</b> (bits 6&ndash;4)</td></tr>' +
    '</tbody></table>' +
    'So the rule to build is: <b>0xFF72, 0xFF73 and the ' +
    'three storage bits of 0xFF75 belong to the device, not the mode; only 0xFF74 is gated on colour ' +
    'mode.</b></div>' +
    '<div class="gbemu-example"><b>Example.</b> Write <code>0x00</code> to <code>FF75</code>: it reads <code>0x8F</code>. Write <code>0x20</code>: it reads <code>0xAF</code>. In compatibility mode write <code>0x5A</code> to <code>FF72</code> and to <code>FF74</code>: <code>FF72</code> reads <code>0x5A</code> and <code>FF74</code> reads <code>0xFF</code>.</div>' +
    '<div class="gbemu-why"><b>Why.</b> The documentation gates all four on the <b>mode</b>, not the device: <code>0xFF74</code> ' +
    'draws that distinction in its own description, and it is the reason to read the gating off the ' +
    'register rather than off the family. In the documentation&rsquo;s reading, outside colour mode the write is <b>dropped rather than ' +
    'stored</b>, so a compatibility run cannot leave a value behind for a later colour-mode read to ' +
    'find. <b>That mode gating is the documentation&rsquo;s, and it is not what the core this site ships does.</b> &ldquo;Mapped on a cartridge with no Color flag&rdquo; means the write is <em>stored</em> in compatibility mode, and a core that drops it fails <code>misc/bits/unused_hwio-C</code>. Our core stores writes to <code>0xFF72</code>, <code>0xFF73</code> and <code>0xFF75</code> on the device in both modes (and keeps <code>0xFF74</code> locked outside colour mode), which makes the cartridge pass, and nothing else is needed. ' +
    'The &ldquo;dropped outside colour mode&rdquo; reading is the wrong answer by the cartridge&rsquo;s own test. Label: MECHANISM (cartridge-declared). ' +
    'Two independent sources agree on the <code>0x8F</code> rather than one ' +
    'being fitted to the other: the documentation, and a test cartridge that asserts it directly. ' +
    'And a third cartridge independently asserts <code>0xFF72</code>, <code>0xFF73</code> and ' +
    '<code>0xFF75</code> as <em>mapped</em> on a cartridge with no Color flag, with ' +
    '<code>0xFF74</code> pointedly absent from that list, which is exactly what ' +
    '&ldquo;locked at <code>0xFF</code> otherwise&rdquo; predicts. Three readings, one answer, and ' +
    'the agreement is checkable rather than asserted.</div></section>' +

  /* ------------------------------------------------------------------ A */
  '<section class="sect" id="gbce-regs"><h3 class="sect-h">Appendix A. The Color&rsquo;s registers, bit by bit</h3>' +
    '<p class="hw-readable">Scattered through the sections above, because each one arrived with its ' +
    'own argument. Collected here, because an implementer needs the map before the arguments. ' +
    '<b>Everything in <code>0xFF00</code>&ndash;<code>0xFF4B</code> and <code>0xFFFF</code> is ' +
    'unchanged from the original machine and is in appendix A of that page</b>; this is only what ' +
    'the Color adds.</p>' +
    '<div class="gbemu-rule" id="gbcr-A-1"><b>Rule CA/1.</b> Each register in the table below must behave as its row says. The last column gives the gate in the sense of <a href="#gbcr-4-1">Rule C4/1</a>: &ldquo;the device&rdquo; (any Color) or &ldquo;colour mode&rdquo;, for the read side and the write side.</div>' +
    '<div class="gbemu-why"><b>Why.</b> <b>Read the last column as section 4&rsquo;s two questions, because they ' +
    'are the only two that matter.</b> A register is reachable either because the machine ' +
    '<em>is</em> a Color, or only while it is <em>in</em> colour mode, and those are ' +
    'different tests. Several registers answer them differently on the read side and the write ' +
    'side, which is exactly why the column is here and not folded into the bit list. Getting one ' +
    'wrong produces a machine that works perfectly until it runs a monochrome cartridge.</div>' +
    '<table class="gbemu-table"><thead><tr><th>Address</th><th>Name</th><th>Bits</th><th>Which gate</th></tr></thead><tbody>' +
    '<tr><td><code>FF02</code></td><td>SC</td><td><b>7</b> transfer start; <b>1</b> the clock speed, in ' +
    'colour mode only: 0 shifts at 8,192 bits per second (divider bit 8), 1 at 262,144 (divider bit 3), ' +
    'both twice that in double speed because the divider runs twice as fast; <b>0</b> clock source, 1 = ' +
    'internal. The other bits read 1. <a href="#gbcr-A-2">Rule CA/2</a> has the composed read, the shift clock&rsquo;s tap and the external-clock case</td><td><b>Bit ' +
    '1: colour mode</b>, read and speed alike; the rest neither gate. MECHANISM (the published rates; the ' +
    'tap follows from the rate). <code>misc/boot_hwio-C</code> and <code>misc/bits/unused_hwio-C</code> ' +
    'pass; they run in compatibility mode, where bit 1 reads 1.</td></tr>' +
      '<tr><td><code>FF4C</code></td><td>KEY0</td><td>The compatibility byte. <b>Colour mode is off when either bit 2 or bit 3 is set</b>; the boot program writes <code>0x04</code> for a cartridge with no Color flag. Bit 3 selects a further mode this core does not model at all</td><td><b>Writable only while the boot program is mapped.</b> Dead afterwards: <code>FF50</code> is the latch, not this</td></tr>' +
      '<tr><td><code>FF4D</code></td><td>KEY1</td><td><b>7</b> current speed, read only, 1 = double. <b>6&ndash;1</b> read 1. <b>0</b> armed: set it, then execute STOP, and the machine switches. The composed read is <code>0x7E OR armed OR (double &lt;&lt; 7)</code> (<a href="#gbcr-3-2">Rule C3/2</a>, <a href="#gbcr-3-4">Rule C3/4</a>)</td><td><b>Colour mode.</b> A Color running a cartridge with no Color flag has <em>no speed switch at all</em> and reads <code>0xFF</code> here, which is what Blargg&rsquo;s <code>cpu_instrs</code> depends on (<a href="#gbcr-3-3">Rule C3/3</a>)</td></tr>' +
      '<tr><td><code>FF4F</code></td><td>VBK</td><td><b>0</b> the video bank the <em>processor</em> sees; bits 7&ndash;1 read 1, so the byte is <code>0xFE OR bank</code>. The picture processor is unaffected by it and sees both banks</td><td><b>Read gated on the device, write gated on colour mode.</b> Two different tests, deliberately: in compatibility mode the register is visible and its writes are ignored, so the second bank is unreachable there</td></tr>' +
      '<tr><td><code>FF51</code></td><td>HDMA1</td><td>Transfer source, high byte. <b>Write only</b> here: it reads <code>0xFF</code></td><td>Colour mode, both sides</td></tr>' +
      '<tr><td><code>FF52</code></td><td>HDMA2</td><td>Transfer source, low byte: <b>the low four bits are discarded</b>. Write only</td><td>Colour mode, both sides</td></tr>' +
      '<tr><td><code>FF53</code></td><td>HDMA3</td><td>Destination, high byte. The destination is an <em>offset</em> into video memory, so the top bits are ignored <b>at the point of use</b>, but <b>store the byte whole and do not mask it here</b>. &ldquo;Ignored&rdquo; here means ignored <em>at the point of use</em>, not masked at the register: section 11 (<a href="#gbcr-11-3">Rule C11/3</a>) gives the reason, which is placement and not any pair of written values. Write only</td><td>Colour mode, both sides</td></tr>' +
      '<tr><td><code>FF54</code></td><td>HDMA4</td><td>Destination, low byte: <b>low four bits discarded</b>. Both ends are 16-byte aligned. Write only</td><td>Colour mode, both sides</td></tr>' +
      '<tr><td><code>FF55</code></td><td>HDMA5</td><td>Write: <b>7</b> mode: 1 follows horizontal blank, 0 copies at once; <b>6&ndash;0</b> length in 16-byte chunks <em>minus one</em>. Read: <b>bit 7 CLEAR means a transfer is live</b>, the opposite polarity to every other status bit on this page, with chunks remaining minus one in bits 6&ndash;0. <b>Idle it reads <code>0xFF</code>: after a transfer has completed.</b> <b>On a freshly reset machine this core reads <code>0x80</code></b> (before any transfer and before any boot program has run: a no-boot start sets the idle value, section 2), because the length field is zeroed by the reset and only ever driven to its full value on completion; the documentation says <code>0xFF</code> there too. <b>Section 18 carries that divergence as a named open item</b>, and this row and section 11 (<a href="#gbcr-11-5">Rule C11/5</a>) are the two places an implementer copies the idle value from</td><td><b>Colour mode.</b> Section 11 (<a href="#gbcr-11-4">Rule C11/4</a>) has the register&rsquo;s second function: bit 7 clear while a horizontal-blank transfer is live <em>cancels</em> it and starts nothing, and the length is taken even on the cancelling write</td></tr>' +
    '<tr><td><code>FF56</code></td><td>RP</td><td>The infrared port. In colour mode bits 7 and 6 (the ' +
    'read enable) and bit 0 (the LED) read back what was written; bit 1, the received signal, reads 1, no ' +
    'light, unless a second linked Colour (or a HuC1 or HuC3 cartridge) shines its LED with reading enabled, when it reads 0 (the ' +
    'Game Boy tab, appendix A.1, gives the sensor model); bits 2 to 5 read 1. Outside ' +
    'colour mode it reads <code>0xFF</code> and ignores writes</td><td><b>Colour mode.</b> MECHANISM for ' +
    'the storage and bit 1 (the published register description); bits 2 to 5 reading 1 is the convention, ' +
    'NOT ESTABLISHED by any test we hold. <code>misc/bits/unused_hwio-C</code> lists the address as ' +
    'unmapped in compatibility mode, which this matches.</td></tr>' +
      '<tr><td><code>FF68</code></td><td>BCPS</td><td><b>7</b> auto-increment. <b>6</b> reads 1. <b>5&ndash;0</b> byte index into the 64 bytes of background palette memory</td><td><b>The device</b> for the index: in compatibility mode it still reads back, as <code>index OR 0x40</code> (a fresh one reads <code>0xC8</code> after the boot program), while the data register stays closed. Section 6.</td></tr>' +
      '<tr><td><code>FF69</code></td><td>BCPD</td><td>The byte at that index. <b>The auto-increment happens on a write and not on a read</b></td><td><b>Write: colour mode, or the boot program.</b> That second term is load-bearing, not defensive: section 6 has the 27 uniformly white cells that proved it. <b>Read: colour mode only</b>; with the boot program mapped after it has turned colour mode off, a read is open bus, <code>0xFF</code> (Rule C6/4)</td></tr>' +
      '<tr><td><code>FF6A</code></td><td>OCPS</td><td>As <code>FF68</code>, for the 64 bytes of object palette memory</td><td>The device, same split as <code>FF68</code> (a fresh one reads <code>0xD0</code> after the boot program).</td></tr>' +
      '<tr><td><code>FF6B</code></td><td>OCPD</td><td>As <code>FF69</code></td><td>Same as <code>FF69</code>: write in colour mode or while the boot program is mapped; read in colour mode only</td></tr>' +
      '<tr><td><code>FF6C</code></td><td>OPRI</td><td><b>0</b> the object priority rule: clear = lower memory index wins, set = the original&rsquo;s smaller-X rule. Bits 7&ndash;1 read 1, so the byte is <code>0xFE OR bit&nbsp;0</code></td><td><b>The device</b> for the read: a Color answers here even in compatibility mode. <b>CONTESTED, and this is the one row in this table that is:</b> two witnesses put <code>FF6C</code> on open bus in compatibility mode and one says it reads, and <b>this core follows the one, knowingly</b>. Section 18 carries it as unsettled and the paragraphs below this table say why the Mooneye list does not dispose of it. <b>Do not copy this row without that caveat.</b> <b>Boot-locked:</b> a write after the handover is stored and inert in colour mode and <b>dropped in compatibility mode</b>, so after the real boot program the byte stays <code>0x01</code> and reads <code>0xFF</code> (<a href="#gbcr-A-4">Rule CA/4</a>). Section 8. The shipped core passes <code>misc/bits/unused_hwio-C</code> because the write is dropped in compatibility mode.</td></tr>' +
      '<tr><td><code>FF70</code></td><td>SVBK</td><td><b>2&ndash;0</b> the work-RAM bank mapped at <code>0xD000</code>&ndash;<code>0xDFFF</code>. <b><code>0</code> selects bank 1</b>, not bank 0. <code>0xC000</code>&ndash;<code>0xCFFF</code> is always bank 0. Bits 7&ndash;3 read 1 (<a href="#gbcr-4-2">Rule C4/2</a>)</td><td><b>Read: colour mode</b> (<code>0xFF</code> in compatibility mode). <b>Write: colour mode, or while the boot program is mapped.</b> The bank it selects applies in both modes; in compatibility mode after the boot program it is the value the boot program left (<a href="#gbcr-4-4">Rule C4/4</a>). The read is the opposite choice from VBK above, on purpose: no witness says a Color shows this register in compatibility mode and both references put it the other way</td></tr>' +
      '<tr><td><code>FF72</code></td><td>none</td><td>Eight bits, fully read/write, initial <code>0x00</code></td><td><b>The device, in both modes</b>: stored and read back in compatibility mode too, as the cartridge that tests it declares. Section 14 (<a href="#gbcr-14-1">Rule C14/1</a>).</td></tr>' +
      '<tr><td><code>FF73</code></td><td>none</td><td>Eight bits, fully read/write, initial <code>0x00</code></td><td>As <code>FF72</code>: the device, in both modes.</td></tr>' +
      '<tr><td><code>FF74</code></td><td>none</td><td>Eight bits read/write <em>in colour mode</em>; read-only and locked at <code>0xFF</code> otherwise</td><td>Colour mode, and this register&rsquo;s own documented text is what draws the distinction for the whole block</td></tr>' +
      '<tr><td><code>FF75</code></td><td>none</td><td><b>Only bits 6&ndash;4 are storage</b>; the rest read 1, so a fresh register reads <code>0x8F</code></td><td>As <code>FF72</code>: the device, in both modes (bits 6&ndash;4).</td></tr>' +
      '<tr><td><code>FF76</code></td><td>PCM12</td><td>Channel 1&rsquo;s current digital value in bits 3&ndash;0, channel 2&rsquo;s in bits 7&ndash;4. <b>Read only</b></td><td><b>The device.</b> This and the next are the only window a cartridge has onto the sound unit&rsquo;s internal state, and the timing cartridges in section 16 use them as their instrument</td></tr>' +
      '<tr><td><code>FF77</code></td><td>PCM34</td><td>Channels 3 and 4, same layout. <b>Read only</b></td><td>The device, as above</td></tr>' +
    '</tbody></table>' +
    '<div class="gbemu-why"><b>Why.</b> <b>Two honest limits on that table.</b> First, ' +
    '<code>FF51</code>&ndash;<code>FF54</code> read <code>0xFF</code> on this core because ' +
    '<em>neither reference gives a confident read value for them</em> and inventing one would be a ' +
    'byte nothing pins: stated as an omission rather than left to be found. Second, ' +
    '<code>FF69</code> and <code>FF6B</code> are covered by no test this project holds; their read ' +
    'behaviour is written from two references&rsquo; structure alone. <b>CONVERGENCE, not ' +
    'derivation</b>, and section 17 is where that distinction is priced.</div>' +

    '<div class="gbemu-rule" id="gbcr-A-2"><b>Rule CA/2.</b> <code>FF02</code> (SC) on the Color reads <code>0x7C | bit 7 | bit 1 | bit 0</code> in ' +
    'colour mode and <code>0x7E | bit 7 | bit 0</code> outside it, where bit 1 reads 1 and selects ' +
    'nothing. In words: bits 2 to 6 always read 1 (and bit 1 too outside colour mode); bits 7, 1 and 0 ' +
    'read back as last written, except that bit 7 clears itself when a transfer ends. <b>Both taps carry the same one-machine-cycle lead</b> as the original&rsquo;s clock (the Game Boy tab, A.1): the shift clock is bit 8, or bit 3, of the counter plus 4 T-cycles, and a bit shifts on its falling edge. <b>A transfer with the external clock and no partner never ' +
    'completes</b>: bit 7 stays set, SB does not shift and no serial interrupt is raised.</div>' +
    '<div class="gbemu-example"><b>Example.</b> After a write of <code>0x81</code>, colour mode reads <code>0xFD</code> ' +
    'and compatibility mode <code>0xFF</code>; after <code>0x83</code>, both read <code>0xFF</code>; with ' +
    '<code>0x00</code> written, <code>0x7C</code> and <code>0x7E</code>.</div>' +
    '<div class="gbemu-why"><b>Why.</b> Read from our source (one tap lead for both speeds of clock). The shift clock is tapped from the free-running divider one machine cycle ahead, as on the ' +
    'original (the Game Boy tab, A.1).</div>' +

    '<div class="gbemu-rule" id="gbcr-A-3"><b>Rule CA/3.</b> An address that is unmapped in the current mode (one this table, and the original&rsquo;s appendix A, give no value for in that mode) reads <code>0xFF</code>, exactly as on the original.</div>' +
    '<div class="gbemu-why"><b>Why.</b> <b>What a Color maps at all, in compatibility mode.</b> Mooneye ' +
    '<code>bits/unused_hwio-C</code> is the specification and it lists exactly <code>FF4F</code>, ' +
    '<code>FF68</code>, <code>FF6A</code>, <code>FF72</code>, <code>FF73</code>, ' +
    '<code>FF75</code>, <code>FF76</code> and <code>FF77</code> as mapped, and ' +
    '<code>FF4C</code>, <code>FF4D</code>, <code>FF4E</code>, <code>FF69</code>, ' +
    '<code>FF50</code>&ndash;<code>FF67</code> and <code>FF6B</code>&ndash;<code>FF71</code> as ' +
    'not. <b>That list looks wrong beside the table above until you notice it is describing a ' +
    'different mode, not a different machine</b>, for every row but one. Every unmapped ' +
    'address reads <code>0xFF</code>, exactly as on the original.</div>' +

    '<div class="gbemu-rule" id="gbcr-A-4"><b>Rule CA/4.</b> <code>FF6C</code> (OPRI) in compatibility mode: the read is gated on the device and returns <code>0xFE | bit&nbsp;0</code> of the stored byte; a write after the hand-over is dropped. In colour mode a write after the hand-over is stored and inert.</div>' +
    '<div class="gbemu-example"><b>Example.</b> <b>On a booted run in compatibility mode our arm cannot be told from open bus by any write a ' +
    'title can make:</b> the byte is <code>0x01</code> from the boot program, the read is <code>0xFE | 0x01 = ' +
    '0xFF</code>, and writes are dropped. Our no-boot start does not separate them either: on its compatibility branch it stores <code>0x01</code>, as ' +
    'the boot program does (Rule C2/15), so a read gives <code>0xFF</code>; only its colour branch leaves 0 (a read gives <code>0xFE</code>). The arms separate only in colour mode, where nobody disputes that the ' +
    'register reads.</div>' +
    '<div class="gbemu-why"><b>Why.</b> <b>The one row the Mooneye list&rsquo;s mode explanation does not reach.</b> ' +
    '<code>FF6C</code> is inside <code>FF6B</code>&ndash;<code>FF71</code>, so that list says ' +
    '<b>a Color in compatibility mode does not map it</b>, and &ldquo;a different mode, not ' +
    'a different machine&rdquo; is no answer here, because <em>compatibility mode is exactly what ' +
    'the table&rsquo;s own cell for <code>FF6C</code> is about</em>. Section 18 records the ' +
    'question as open: <i>&ldquo;two witnesses say open bus, one says it reads; this ' +
    'core follows the one, knowingly&rdquo;</i>. ' +
    '<b>The two open-bus witnesses are this very list and the ' +
    'second reference implementation&rsquo;s own register table</b>, which marks <code>OPRI</code> ' +
    'readable in colour mode and <em>not</em> in compatibility mode; the one that reads it back is ' +
    'the first reference implementation, which gates the read on the <em>device</em> the way this ' +
    'core does.<br>' +
    '<b>And the reason nothing on the board separates them, which is the ' +
    'part an implementer can act on.</b> The boot program leaves <code>OPRI</code> holding ' +
    '<code>0x01</code> on the compatibility branch (section 2 measures exactly that, on 2 ' +
    'of 2 compatibility cartridges) and this core returns <code>0xFE | bit&nbsp;0</code>. ' +
    'So the contested arm returns <b><code>0xFF</code></b>, which is byte for byte what open bus ' +
    'returns. <b>Measured here: <code>cgb_mode = 0</code>, the stored byte is ' +
    '<code>0x01</code>, and a read of <code>FF6C</code> gives <code>0xFF</code>.</b> ' +
    '<code>bits/unused_hwio-C</code> asserts <code>test_unmapped</code> across ' +
    '<code>FF6B</code>&ndash;<code>FF71</code> and does not separate the two arms here. ' +
        'The core passes <code>misc/bits/unused_hwio-C</code> as shipped (section 14), because in compatibility mode our core drops a write to <code>FF6C</code> after the hand-over. The cartridge writes the register and expects <code>0xFF</code>; a core that stored the write would read <code>0xFE</code> and fail it. ' +
    '<b>What would settle it now:</b> a hardware reading of <code>FF6C</code> in ' +
    'compatibility mode after a cartridge with no Color flag writes <code>0x00</code> there; ' +
    '<code>0xFE</code> would mean the register stores in that mode, which our core does not do. Measured on ' +
    'the shipped core.</div>' +

    '<p class="gbemu-key"><b>And the two things in this map that are not registers.</b> Video ' +
    'memory is 16 KB in two banks at the same addresses; work RAM is 32 KB in eight. In both cases ' +
    '<b>the bank cannot travel inside the address</b>, so every read that needs a specific bank has ' +
    'to carry the bank beside the address rather than folded into it. Section 5 says why that is ' +
    'the most consequential structural difference between the two machines, and it is worth ' +
    'restating at the foot of a register map: on this machine, <b>a map of addresses is no longer ' +
    'enough to say what a read returns</b>.</p></section>' +

  '</div>';
}
