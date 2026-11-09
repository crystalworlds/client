/* ===========================================================================
 * Game Boy Emulation tab, area 5 of eight: Sound
 * gbApuEmulationTabHTML(d) returns this area's HTML; the tab's composer in
 * gb-emulation-tab.js calls every area in order (2 November 2026: the tab
 * was split into area files so a builder can read one area at a time).
 * Loaded by a plain <script src> tag (the site must open over file://).
 * =========================================================================== */

function gbApuEmulationTabHTML(d) {
  return '<div class="gbemu-area" id="gbemu-area-apu">' +

  '<section class="sect gbemu-area-head" id="gbemu-area-apu-head"><h3 class="sect-h">Area 5 of eight: Sound</h3>' +
    '<p class="gbemu-key">The sound unit: its own clock and the frame sequencer, the square channels with sweep, envelope, length and the trigger chain, the wave channel, the noise channel, power and the DACs (sections 15 to 17), and the whole sound map with every primitive (appendix B).</p>' +
    '<p class="hw-readable">This area is the file <code>gb-apu-emulation-tab.js</code>, one of the eight area files that together make the Game Boy Emulation tab. It can be read on its own; the build checklist is in the first area, and the rule for what a build must implement is beside it.</p>' +
    '<p class="hw-readable"><b>Where the rest of this page is.</b> When a sentence here points to a section or appendix that is not in this area, it is in one of these files (the links work on the assembled page):</p><ul class="gbemu-bullets"><li><b>Overview, build checklist and interface</b> (<code>gb-machine-emulation-tab.js</code>): <a href="#gbe-m1">1. Clocks, map, and one phase that matters</a> <a href="#gbe-m3">3. Where the machine starts</a> <a href="#gbe-gaps">24. What this page does not cover</a></li><li><b>Processor</b> (<code>gb-cpu-emulation-tab.js</code>): <a href="#gbe-m2">2. The processor</a> <a href="#gbe-ops">Appendix D. The instruction set</a></li><li><b>Memory, timer, interrupts, transfers, serial, pad</b> (<code>gb-memory-emulation-tab.js</code>): <a href="#gbe-m4">4. Timer, DMA, interrupt line</a> <a href="#gbe-hw">5. What a real Game Boy settled</a> <a href="#gbe-regs">Appendix A. Every register, every bit</a></li><li><b>Picture</b> (<code>gb-ppu-emulation-tab.js</code>): <a href="#gbe-m5">6. The sprite scan</a> <a href="#gbe-1">7. The decision that decides everything</a> <a href="#gbe-2">8. Step the machine by dots</a> <a href="#gbe-3">9. The fetcher</a> <a href="#gbe-4">10. The two FIFOs</a> <a href="#gbe-5">11. The window is a separate machine</a> <a href="#gbe-6">12. Sprites stall the pipeline</a> <a href="#gbe-7">13. Writes that land mid-line</a> <a href="#gbe-8">14. Interrupts, blocking, power</a> <a href="#gbe-addr">Appendix C. Tile, map and object addressing</a> <a href="#gbe-pipe">Appendix E. The picture pipeline, in numbers</a></li><li><b>Cartridges and mappers</b> (<code>gb-mappers-emulation-tab.js</code>): <a href="#gbe-mappers">Appendix H. The cartridge mappers, register by register</a></li><li><b>Super Game Boy and link devices</b> (<code>gb-sgb-emulation-tab.js</code>): <a href="#gbe-sgb">Appendix A, continued: the Super Game Boy and the link-port devices</a></li><li><b>Tests and scores</b> (<code>gb-acceptance-emulation-tab.js</code>): <a href="#gbe-9">18. Traps that cost us weeks</a> <a href="#gbe-10">19. What to test with, in order</a> <a href="#gbe-11">20. How to measure a change</a> <a href="#gbe-score">21. The score, and what a score is worth</a> <a href="#gbe-unwinnable">22. Rows nobody can win honestly</a> <a href="#gbe-12">23. The evidence</a> <a href="#gbe-labels">Appendix F. Labels, flexibility, and what is not established</a> <a href="#gbe-verify">Appendix G. The verification scorecard</a></li></ul>' +
    '<p class="hw-readable"><b>Units in this area.</b> Every time in sections 15 to 17 is in T-cycles of the master clock (written T) as the sound unit counts them, unless a sentence says machine cycles. A <b>sound tick</b> is always 2&nbsp;T (Rule 15/1). <b>B</b> is the T of one machine cycle&rsquo;s own sound ticks: 4&nbsp;T on the original (and on the Color at single speed), 2&nbsp;T in the Color&rsquo;s double speed. A <b>restart</b> is a trigger written while the channel&rsquo;s NR52 enable flag reads 1; a <b>cold trigger</b> is one written while it reads 0. A channel&rsquo;s <b>period</b> is the formula of appendix B.5 for its frequency register.</p>' +
  '</section>' +
  '<div class="gbemu-toc"><b>In this area</b><a href="#gbe-s1">15. The sound unit is not on the processor&rsquo;s clock</a><a href="#gbe-s2">16. The square channels</a><a href="#gbe-s3">17. Wave, noise, and power</a><a href="#gbe-sound-regs">Appendix B. The sound registers, and the primitives the refinements modify</a></div>' +

  /* ---------------------------------------------------------------- S1 */
  '<section class="sect" id="gbe-s1"><h3 class="sect-h">15. The sound unit is not on the processor&rsquo;s clock</h3>' +
    '<p class="hw-readable">Everything else in the sound unit depends on Rule 15/1, which is why it comes first.</p>' +
    '<div class="gbemu-rule" id="gbr-15-1"><b>Rule 15/1.</b> The sound unit must take one sound tick every 2&nbsp;T of the master clock, counted on the master clock and not on the processor&rsquo;s machine cycle. Every frequency timer, every wave-position advance and every noise step is driven by sound ticks. On the original a machine cycle is 4&nbsp;T, so the sound unit runs exactly two sound ticks per machine cycle; in the Color&rsquo;s double speed it runs one (the Color tab, Rule C13/2).</div>' +
    '<div class="gbemu-example"><b>Example.</b> A square channel with a period of 64&nbsp;T takes 32 sound ticks per period. On the original that is 16 machine cycles. A core that instead runs &ldquo;two sound ticks per machine cycle&rdquo; gives the same 16 machine cycles on the original, but in the Color&rsquo;s double speed it runs the 32 sound ticks in 16 machine cycles of 2&nbsp;T, so in 32&nbsp;T instead of 64&nbsp;T: every channel an octave too high there.</div>' +
    '<div class="gbemu-why"><b>Why.</b> The sound unit ticks at a fixed rate off the master clock; it is not driven by the processor&rsquo;s machine cycle, and the two merely coincide. <b>One sound tick is 2 T-cycles</b>, a machine cycle is 4 T, so on the original the sound unit runs two ticks per machine cycle for ever and nothing can tell the difference between &ldquo;two ticks per machine cycle&rdquo; and &ldquo;one tick every 2&nbsp;T&rdquo;: the rule is <b>invisible on an original Game Boy</b>. Build it the first way and you have written a bug you cannot observe until you build a Game Boy Color. In double speed a machine cycle is <b>2&nbsp;T of the same 4&nbsp;MHz clock</b>, so a core that runs two ticks per machine cycle runs every frequency timer, every wave-position advance and every noise step at twice its rate. <b>The symptom is that every Colour title plays an octave too high in double speed.</b> Watch for the half-fix, which is what hides it: compensating the frame sequencer (noticing the divider runs twice as fast and moving the sequencer&rsquo;s tap up a bit), while leaving the channels alone fixes half of one fact and leaves the half nobody names. <b>DERIVED</b>: the reference documentation states it in as many words, that the length of a sound tick is not affected by double speed, <b>and appendix B.16 reproduces that sentence and both halves of the rule it implies, so an offline reader does not have to go and find it.</b> A second consequence, worth more than the audible one for anyone scoring: <b>every timing cartridge in the sound suite runs under a speed switch</b>, so a core with this fault measures every declared delay against half the period the cartridge declares. The rows do not look like tuning problems. They look like a model that is wrong everywhere by a little.</div>' +

    '<h4 class="gbemu-sub">The frame sequencer</h4>' +
    '<div class="gbemu-rule" id="gbr-15-2"><b>Rule 15/2.</b> The frame sequencer is clocked by the falling edge of bit 12 of the divider (bit 4 of the visible register) giving 512&nbsp;Hz, and by nothing else: it must not have a counter of its own. Build it as an edge detector on that bit: one frame-sequencer event for every change of the bit from 1 to 0, whatever made the change. (In the Color&rsquo;s double speed the bit is 13: the Color tab, Rule C13/5.)</div>' +
    '<div class="gbemu-example"><b>Example.</b> The divider&rsquo;s internal counter reads <code>0x1000</code> (bit 12 = 1) and the processor writes the divider, which zeroes the whole counter: bit 12 goes from 1 to 0, so the frame sequencer takes one event in that machine cycle. The same write with the counter at <code>0x0800</code> (bit 12 = 0) is no falling edge and takes no event. This is the much-discussed &ldquo;writing the divider clocks the sound unit&rdquo; quirk; with the edge detector it needs no code of its own.</div>' +
    '<div class="gbemu-why"><b>Why.</b> Give the sequencer its own counter and you will be implementing the quirk as a special case for ever.</div>' +

    '<div class="gbemu-rule" id="gbr-15-3"><b>Rule 15/3.</b> The frame sequencer has eight steps, numbered 0 to 7 by a step counter. Each step performs exactly the clocks in this table and no others:' +
      '<table class="gbemu-table"><thead><tr><th>Step (counter value, 0 to 7)</th><th>Clocks length</th><th>Clocks the sweep</th><th>Clocks the envelope</th></tr></thead><tbody>' +
        '<tr><td>0</td><td>yes</td><td>no</td><td>no</td></tr>' +
        '<tr><td>1</td><td>no</td><td>no</td><td>no</td></tr>' +
        '<tr><td>2</td><td>yes</td><td>yes</td><td>no</td></tr>' +
        '<tr><td>3</td><td>no</td><td>no</td><td>no</td></tr>' +
        '<tr><td>4</td><td>yes</td><td>no</td><td>no</td></tr>' +
        '<tr><td>5</td><td>no</td><td>no</td><td>no</td></tr>' +
        '<tr><td>6</td><td>yes</td><td>yes</td><td>no</td></tr>' +
        '<tr><td>7</td><td>no</td><td>no</td><td>yes</td></tr>' +
      '</tbody></table>' +
      'That is: <b>length on the even steps, sweep on steps 2 and 6, the envelope on step 7.</b></div>' +

    '<div class="gbemu-rule" id="gbr-15-4"><b>Rule 15/4.</b> Powering the sound unit on must set the step counter to 7. On each frame-sequencer event that is not skipped (Rule 15/5), the sound unit must, in this order:' +
      '<ol class="gbemu-steps"><li>add 1 to the step counter, modulo 8;</li><li>perform the clocks of the step the counter now reads (Rule 15/3), in this order: the extra envelope step (Rule B.13/6), length, the sweep, the regular envelope tick.</li></ol>' +
      'So after a power-on with the divider bit low, the first event performed is step 0 (a length step) and the first envelope step is the eighth event.</div>' +
    '<div class="gbemu-example"><b>Example.</b> Power on with bit 12 reading 0. The step counter reads 7. The 1st falling edge after that adds 1 (7 to 0) and performs step 0: length only. The 3rd performs step 2: length and sweep. The 8th performs step 7: the first envelope clock. A build whose counter starts at 3 instead also clocks length only on the 1st event, but reaches the envelope on the 4th event, not the 8th.</div>' +
    '<div class="gbemu-why"><b>Why.</b> The parity of your own numbering against a cartridge&rsquo;s is a free convention and two declared tables fix it: do not assume an origin. <b>The two tables are SameSuite&rsquo;s <code>channel_2_nrx2_speed_change</code> Tests 6 and 7</b>, which are the same stimulus written at two alignments a known distance apart; B.13 works them and derives the parity from them. The instruction above is unfulfillable without a shipped representative, and Rule 15/4 is ours. <b>DERIVED</b> for the parity, and for the origin <b>OBSERVED</b>: it is measured on this core, not assumed, and the measurement is one length counter. <b>Why the origin is not yours to choose.</b> It is not a free convention (it is directly observable through NR52&rsquo;s channel flags and the length counters) and the eight candidates collapse to exactly <b>four</b> classes distinguishable at power-on: the first event does nothing (origins 0, 2, 4), clocks length only (3, 7), clocks length <em>and</em> steps the sweep (1, 5), or is the envelope step (6). This core is in the length-only class, and <b>7 rather than 3</b> is what puts the first envelope step on the eighth event instead of the fourth. Everything downstream that numbers a step (length, sweep, envelope, the extra length clock, the extra envelope tick) inherits this, so a reader who guesses it plays music that sounds perfectly normal and is permanently one sequencer step out on every expiry. That is the textbook silent divergence.</div>' +

    '<div class="gbemu-rule" id="gbr-15-5"><b>Rule 15/5.</b> <b>Powering the sound unit on while that bit is already high makes it skip the first event.</b> At the power-on write, if the selected divider bit read 1 at the sound unit&rsquo;s most recent test of it (Rule 15/6, step 3, of the previous machine cycle; the test runs whether the unit is on or off; before a run&rsquo;s first test the stored reading is 0, with or without a boot program, so that test takes no event), the sound unit must arm a one-bit skip flag. The next falling edge of that bit then clears the flag and does nothing else: it performs no step and does not advance the step counter, so the counter still reads 7 and the first event that does run is step 0. The flag must be kept as its own bit of state until that falling edge arrives; it must not be implemented by clearing the stored copy of the divider bit. Powering on with the bit at 0 arms nothing.</div>' +
    '<div class="gbemu-example"><b>Example.</b> Power on with bit 12 reading 1: the flag is armed and the counter reads 7. The 1st falling edge clears the flag; nothing is clocked and the counter stays 7. The 2nd falling edge performs step 0 (length). The same power-on with bit 12 reading 0 performs step 0 on the 1st falling edge, exactly one event earlier. A build that instead clears its stored copy of bit 12 at power-on re-latches the live 1 on the very next sound-unit test and still sees the edge when the bit falls: the skip is lost.</div>' +
    '<div class="gbemu-why"><b>Why.</b> MECHANISM, read from our source (<code>APU_POWER_SKIPS_DIV_EVENT</code>, the falling-edge test in <code>apu_tick4</code>). Clearing the stored bit does not work: the detector re-latches the live bit on the very next tick, well before the bit falls, so the edge is seen anyway. The skip has to survive until the bit actually goes low. <b>DERIVED</b>, and from as clean a controlled experiment as the corpus contains: the suite ships three cartridges beside three otherwise identical siblings differing by a single inserted wait, and the siblings&rsquo; declared tables are the plain tables displaced by <em>exactly one</em> sequencer step. The quantity is one event, read off the declaration. Worth <b>+3 rows</b>.</div>' +

    '<div class="gbemu-rule" id="gbr-15-6"><b>Rule 15/6.</b> <b>Where in the machine cycle the edge is acted on.</b> Within every machine cycle the sound unit&rsquo;s work must run in this order (the full machine-cycle order is appendix E.5&rsquo;s):' +
      '<ol class="gbemu-steps">' +
        '<li>The timer&rsquo;s four ticks (E.5).</li>' +
        '<li>If the cycle carries a processor write, the write reaches its register (for a sound register: the sound unit).</li>' +
        '<li>The sound unit tests the selected divider bit once. If it reads 0 and read 1 at the previous test, one frame-sequencer event is taken (Rules 15/4 and 15/5). A fall made by any of step 1&rsquo;s four timer ticks, or by a divider write in step 2, is taken here. While the unit is off the test still runs and stores the reading, but a fall takes no event: nothing is clocked and the step counter does not move.</li>' +
        '<li>The cycle&rsquo;s sound ticks: two on the original, each in the order of Rule 16/10.</li>' +
        '<li>If the cycle carries a processor read of a sound register, the read sees the state after step 4.</li>' +
        '<li>After the sound ticks: a staged duty becomes pending (Rule 16/5) and a deferred noise frequency write is applied (Rule 17/12).</li>' +
      '</ol>' +
      'So a length, envelope or sweep step lands before the channel ticks of the same machine cycle.</div>' +
    '<div class="gbemu-example"><b>Example.</b> A sweep step (step 2) falls in a machine cycle in which channel 1&rsquo;s period counter also expires on the second sound tick. The sweep&rsquo;s frequency write is made in step 3, so the period reload made at that expiry in step 4 already uses the new frequency.</div>' +
    '<div class="gbemu-why"><b>Why.</b> <b>DERIVED</b> from the same three cartridge pairs as Rule 15/5. Steps 1, 2, 3 and 6 settled from our source (<code>write8_core</code> in <code>gb.c</code>: the timer ticks, then the bus write, then <code>apu_tick4</code>, which tests the divider bit before its sound ticks and applies the staged duty and the deferred noise write after them).</div>' +

    '<div class="gbemu-rule" id="gbr-15-7"><b>Rule 15/7.</b> <b>The &ldquo;extra length clock&rdquo; quirk is one predicate</b>: <em>does the next sequencer step clock length?</em> It must answer yes exactly when the skip flag of Rule 15/5 is clear and the step counter currently reads an odd value (so the next step is even); while the skip flag is armed it must answer no. Both arms of the quirk that use it are in appendix B.7, and the predicate is written out in B.14.</div>' +
    '<div class="gbemu-example"><b>Example.</b> Just after a power-on with the bit low, the counter reads 7 and no skip is armed: the next step is 0, a length step, so the answer is yes. Just after a power-on with the bit high, the counter also reads 7 but the skip is armed: the next event performs no step, so the answer is no.</div>' +
    '<div class="gbemu-why"><b>Why.</b> Keep it as a named question rather than an inline parity test, because the quirk is an off-by-one and an inline parity test is where an off-by-one hides. And it is <em>entailed</em> by the skip above: while the skip is armed the next event performs no step at all, so it is certainly not one that clocks length. Without that the skip is self-inconsistent: it would suppress a step and still answer questions about which step that was.</div>' +
  '</section>' +

  /* ---------------------------------------------------------------- S2 */
  '<section class="sect" id="gbe-s2"><h3 class="sect-h">16. The square channels</h3>' +
    '<p class="hw-readable">The two pulse channels are where the sound suite does its hardest work, and almost everything below was read off the cartridges&rsquo; own prose rather than fitted to their tables. That distinction is the point of this section: <b>the tables then confirmed the sentences</b>, which is the opposite order from tuning a constant until a table matches.</p>' +

    '<h4 class="gbemu-sub">The trigger chain: what reloads, what does not, and what still advances</h4>' +
    '<div class="gbemu-rule" id="gbr-16-1"><b>Rule 16/1.</b> A trigger reloads the channel&rsquo;s countdown with the value in this table, at the moment the write reaches the sound unit. <b>Our seam</b>: a processor write reaches the sound unit before that machine cycle&rsquo;s sound ticks (Rule 15/6, E.5), so each reload carries those ticks, B, as a term of its own. <b>The other seam</b>: the write lands after the cycle&rsquo;s ticks, and the reload drops that term, so the first sample still falls on the same dot. A build must use one seam&rsquo;s column throughout.' +
      '<table class="gbemu-table"><thead><tr><th>Channel (T on the sound unit&rsquo;s clock)</th><th>Our seam: loaded at the write, before the cycle&rsquo;s sound ticks</th><th>The other seam: loaded after the cycle&rsquo;s sound ticks</th></tr></thead><tbody>' +
        '<tr><td>Square 1 and 2, cold trigger</td><td>period + 8&nbsp;T + B</td><td>period + 8&nbsp;T</td></tr>' +
        '<tr><td>Square 1 and 2, restart</td><td>period + 4&nbsp;T + B</td><td>period + 4&nbsp;T</td></tr>' +
        '<tr><td>Wave</td><td>period + 6&nbsp;T + B</td><td>period + 6&nbsp;T</td></tr>' +
        '<tr><td>Noise: the start delay, after which the up-counter is zeroed and the down-counter loaded (section 17)</td><td>8&nbsp;T, plus 4&nbsp;T at divisor code 1, plus 2&nbsp;T on a restart, plus a flat 4&nbsp;T at both speeds (the noise delay does not scale with speed)</td><td>the same less B: plus 0&nbsp;T at single speed, plus 2&nbsp;T in double speed</td></tr>' +
      '</tbody></table>' +
      'On either seam, therefore, <b>a cold trigger&rsquo;s first sample ends the period plus 8&nbsp;T after the end of the writing machine cycle, and a restart&rsquo;s the period plus 4&nbsp;T after it</b> (a restart is one 4&nbsp;T unit shorter), before the grid of Rule 16/4 is applied. A trigger reloads the countdown only; it does not reset the sample (duty) position.</div>' +
    '<div class="gbemu-example"><b>Example.</b> On the original, channel 1 at frequency <code>0x7F0</code> has a period of (2048 &minus; 2032) &times; 4 = 64&nbsp;T (appendix B.5). A cold trigger on our seam loads 64 + 8 + 4 = 76&nbsp;T; the writing cycle&rsquo;s two sound ticks take 4&nbsp;T, so 72&nbsp;T = period + 8&nbsp;T remain at the end of that cycle. A restart loads 64 + 4 + 4 = 72&nbsp;T, and 68&nbsp;T = period + 4&nbsp;T remain. On the other seam the cold trigger loads 72&nbsp;T after the ticks: the same instant. Noise, cold trigger at divisor code 1, our seam: 8 + 4 + 4 = 16&nbsp;T at both speeds; a restart at code 0: 8 + 2 + 4 = 14&nbsp;T.</div>' +
    '<div class="gbemu-why"><b>Why.</b> Three separate facts, from three separate declarations, with the unit fixed by a fourth. <b>A cold trigger&rsquo;s first sample is late by the period plus 8&nbsp;T.</b> The cartridge declares it: <i>&ldquo;it takes (sample length + 2) ticks from the moment channel 1 is enabled until the output register is affected&rdquo;</i>. <b>A restart is one tick shorter</b>: period plus 4&nbsp;T. Also declared, in the restart cartridge&rsquo;s own words. <b>The unit is not assumed.</b> A third cartridge fixes it in a sentence about itself (<i>&ldquo;since we&rsquo;re running in a 1&nbsp;MHz world now&rdquo;</i>), so a &ldquo;tick&rdquo; in these files is one 1&nbsp;MHz machine cycle, 4&nbsp;T. That is the whole derivation: two quantities in words, one unit in words, no sweep. <b>NAMING COLLISION.</b> The word &ldquo;tick&rdquo; carries <em>two</em> values on this page and both are right in their own place: <b>in these cartridge declarations a tick is the author&rsquo;s 1 MHz machine cycle, 4 T</b>, which is what this paragraph derives; <b>in sections 15 and 17 a &ldquo;sound tick&rdquo; is this core&rsquo;s own unit, 2 T of the master clock, always</b>. They are not in conflict (one is a cartridge&rsquo;s word for its own grid, the other is the sound unit&rsquo;s clock), but the caution under Rule 16/2 calls a 2 T reading of <em>this</em> knob unobservable, and read out of context that looks like it refutes section 15. It does not. <b>Say which tick you mean wherever you write the word.</b> In our source both square delays are loaded at the trigger write, which reaches the sound unit before that machine cycle&rsquo;s own ticks, and the load carries the write lead as its own term: the period plus 8&nbsp;T (restart 4&nbsp;T) plus one machine cycle, 4&nbsp;T at single speed and 2&nbsp;T in double, the same lead the wave channel&rsquo;s reload carries. The first column is MECHANISM, read from our source (<code>apu_trigger</code>, with <code>SQ_TRIG_PHASE</code> 8, <code>SQ_TRIG_RESTART_SHORTER</code> 4, <code>NOISE_TRIG_DELAY_T</code> 8, <code>NOISE_TRIG_DELAY_DIV1_T</code> 4, <code>NOISE_RESTART_EXTRA_T</code> 2). The second is DERIVED from the first by that one subtraction and is measured only for the wave channel (section 17).</div>' +

    '<div class="gbemu-rule" id="gbr-16-2"><b>Rule 16/2.</b> <b>A restart landing inside the last machine cycle of a sample still advances the waveform position.</b> On our seam: when a restart is written to channel 1 or channel 2 and that channel&rsquo;s sample countdown has 4&nbsp;T or fewer remaining at the moment the write lands (before that cycle&rsquo;s sound ticks run), the duty position must advance by one, and then the countdown is reloaded as Rule 16/1. The threshold is <em>at most</em> 4&nbsp;T, not exactly 4 and not exactly 1; the unit is T-cycles on the sound unit&rsquo;s own clock, so it is one machine cycle at single speed and two in double speed. A cold trigger at the same countdown advances nothing, and the rule does not apply to channels 3 and 4.</div>' +
    '<div class="gbemu-example"><b>Example.</b> Channel 1 is playing with duty position 3. A restart lands with 4&nbsp;T left on the countdown: the position becomes 4, and the new pulse&rsquo;s first sample is position 4. With 2&nbsp;T left: also 4. With 6&nbsp;T left: it stays 3. In the Color&rsquo;s double speed with 4&nbsp;T left the position also advances, although the writing cycle&rsquo;s one sound tick takes the countdown only to 2&nbsp;T, so a reading &ldquo;advance if the sample would expire within this machine cycle&rdquo; gives the wrong answer there. A cold trigger (the NR52 flag reads 0) with 2&nbsp;T left: the position stays where it was.</div>' +
    '<div class="gbemu-why"><b>Why.</b> And the third element of the chain is the one that is easy to miss: the restart cartridge also says <i>&ldquo;the new pulse&rsquo;s first sample will be the next sample the old pulse would have played&rdquo;</i>. That sample is already committed, and throwing away the countdown does not un-commit it; a cold trigger has no committed sample to preserve. The threshold is given in numbers because &ldquo;the last machine cycle&rdquo; admits at least four readings, and seven were scored. Against the declared 144-cell table seven rival readings of what a retrigger does to the waveform unit, each a function of nothing but the countdown remaining, score 16, 4, <b>0</b>, 32, 64, 25 and 22 wrong. <b>Exactly one survives</b>, and it is the cartridge&rsquo;s own sentence made mechanical. <b>It is the third in that list and it is <code>countdown &lt;= 4&nbsp;T</code>, guarded by &ldquo;this is a restart&rdquo; and by &ldquo;this is channel 1 or 2&rdquo;</b>, and it is named outright here because the four obvious rivals (<code>== 1</code>, <code>&lt;= 1</code>, <code>== 0</code>, &ldquo;would expire within this machine cycle&rdquo;) are all wrong, all plausible, and unresolvable without a copy of the table. With the two delays of Rule 16/1 alone, sixteen cells are wrong, <b>all at one residue of the retrigger delay, each a contiguous run exactly one sample period wide</b>. A residual with that shape is a missing <em>edge rule</em>, not a mistuned constant. MECHANISM, read from our source (the restart test in <code>apu_trigger</code>).</div>' +
    '<div class="gbemu-why"><b>One caution that generalises past this channel.</b> <b>The knob&rsquo;s observable resolution is 4&nbsp;T</b>: the rival reading that a &ldquo;tick&rdquo; means 2&nbsp;T is not merely wrong, it is <em>unobservable</em>, because the processor samples the sound unit&rsquo;s output register at machine-cycle granularity. Measured rather than argued: the two settings produce byte-identical output on all 43 measured rows. Before you argue about a value, find out whether anything can see it.</div>' +

    '<div class="gbemu-rule" id="gbr-16-3"><b>Rule 16/3.</b> <b>And the restart test of Rule 16/2, on the other seam.</b> On ours the countdown compared with 4&nbsp;T is the one standing before the cycle&rsquo;s ticks run. On the other seam those ticks have already run, and a sample that expired in them has already advanced the position, which is the same advance; so a restart advances it again only when the countdown read after the ticks is above 0 and at most 4&nbsp;T less B: never at single speed, and at 2&nbsp;T or less in double speed.</div>' +
    '<div class="gbemu-example"><b>Example.</b> Double speed, other seam: the countdown reads 2&nbsp;T after the cycle&rsquo;s one sound tick (it read 4&nbsp;T before it, which on our seam advances): the restart advances the position. It reads 0 or less: the expiry inside the tick has already advanced it, and the restart adds nothing. Single speed: 4&nbsp;T less B is 0, so the restart itself never advances; a countdown of 4&nbsp;T or less before the ticks has already expired inside them.</div>' +
    '<div class="gbemu-why"><b>Why.</b> DERIVED from our source (a sample expires when its countdown reaches 0 or below); not measured on a build of that seam.</div>' +

    '<h4 class="gbemu-sub">The sample clock free-runs from power-on, and the table is a modulus</h4>' +
    '<div class="gbemu-rule" id="gbr-16-4"><b>Rule 16/4.</b> <b>The square channels&rsquo; sample clock is a 4&nbsp;T divider whose phase is set when the sound unit is powered on, not when a channel is triggered.</b> A trigger reloads the period <em>counter</em>; it does not re-phase the divider that counter is clocked by. <b>Where the grid edges are, exactly</b>: count T on the sound unit&rsquo;s clock from the write that powers it on (<code>FF26</code> bit 7 set from clear); that write is count 0, and each sound tick after it adds 2&nbsp;T. A square channel&rsquo;s sample can end only at the end of a sound tick that brings that count to a multiple of 4 <b>at single speed</b>, and to 2 more than a multiple of 4 (2, 6, 10, &hellip; T) <b>in double speed</b>: the edge sits one machine cycle&rsquo;s worth of sound ticks (4 T, or 2 T in double speed) after a multiple of 4. A trigger&rsquo;s first expiry (its reload of Rule 16/1 counted from the write) must be pushed forward to the first such edge at or after it; every later expiry falls on one anyway, because a period is a whole number of 4 T steps. At single speed every trigger already meets an edge, so this changes nothing on the original; the double-speed half is the Colour tab&rsquo;s section 13 (Rule C13/3).</div>' +
    '<div class="gbemu-example"><b>Example.</b> Single speed: every processor write falls at a count that is a multiple of 4. A cold trigger at count 40 with a 64&nbsp;T period loads 76&nbsp;T (Rule 16/1) and would expire at count 116, a multiple of 4: a grid edge, so nothing moves. Double speed: the same trigger written at count 6 loads 64 + 8 + 2 = 74&nbsp;T and would expire at count 80. 80 is a multiple of 4, which is not a grid edge in double speed, so the expiry moves to count 82 (the countdown becomes 76&nbsp;T).</div>' +
    '<div class="gbemu-why"><b>Why.</b> Two cartridges state one object between them (<i>&ldquo;channel 1 is aligned to the sound unit&rsquo;s enable time, not the processor&rsquo;s start time&rdquo;</i> and <i>&ldquo;this test verifies that channel 1 ticks at 1&nbsp;MHz&rdquo;</i>) and between them that is a 1&nbsp;MHz divider anchored at power-on. <b>No constant is introduced by implementing it.</b> The grid is 4&nbsp;T because a cartridge tick is 4&nbsp;T, as derived under Rule 16/1. Read from our source (<code>SQ_ENABLE_GRID</code>).</div>' +
    '<div class="gbemu-why"><b>Why no constant could ever have closed these rows, and it is the most transferable thing on this page.</b> One of the two cartridges moves its delay <em>before</em> the trigger, so its declared table is not linear in that delay: delays of 1 and 3 machine cycles <b>agree with each other and disagree with a delay of 0</b>. <b>That is a modulus, not an offset</b>, and no additive constant can produce it: every constant that closes one cartridge opens the other. With the grid, <b>four rows pass that fail without it</b>, +4 fixed / 0 broken, with both channels byte-exact against their declared tables. <b>At single speed the adjustment must be identically zero</b>, because a machine cycle <em>is</em> the 4&nbsp;T grid, so every trigger already lands on an edge. Instrumented count of non-zero adjustments: <b>0 across all 69 sound cartridges at single speed; 200 events across 9 of them in double speed.</b> A null with its denominator, in both directions, which is the only kind worth quoting.</div>' +
    '<div class="gbemu-why"><b>And the three sound denominators on these two pages are three different counts of three different things.</b> <b>69 sound cartridges</b> is every cartridge in SameSuite&rsquo;s sound folder, each run on its own, which is the corpus the census above was instrumented over, and the 9 are inside it. <b>68 sound rows</b> is the SameSuite row count from the suite enumeration in section 21, and it is what &ldquo;identical on all 68 sound rows&rdquo; means everywhere it appears. <b>Twelve Color-specific sound cartridges</b> is a subset of the 51 Blargg rows, named on the Colour tab. <b>They are not nested in the way the numbers invite</b>: 69 is one more than 68 and this page does not say which cartridge the extra one is. <b>NOT ESTABLISHED, and named rather than closed by arithmetic</b>; what would settle it is the census instrument printing its corpus list beside its count.</div>' +

    '<h4 class="gbemu-sub">Four more, each declared rather than fitted</h4>' +
    '<ul class="gbemu-bullets">' +
      '<li>A new duty does not take effect mid-sample: Rule 16/5.</li>' +
      '<li>The sweep&rsquo;s second overflow check is late: Rule 16/6.</li>' +
      '<li>The envelope write glitch: Rule 16/7.</li>' +
      '<li>The waveform unit does not run before its channel&rsquo;s first trigger: Rule 16/8.</li>' +
    '</ul>' +
    '<div class="gbemu-rule" id="gbr-16-5"><b>Rule 16/5.</b> <b>A new duty does not take effect mid-sample.</b> In steps, both machines, for a write to NR11 (channel 1) or NR21 (channel 2):' +
      '<ol class="gbemu-steps">' +
        '<li>The write stores its duty bits as <em>staged</em>.</li>' +
        '<li>After that machine cycle&rsquo;s sound ticks (so after any sample boundary inside the write&rsquo;s own cycle), the staged duty becomes <em>pending</em> (Rule 15/6, step 6).</li>' +
        '<li>The duty in force changes to the pending one at the next reload of the channel&rsquo;s period counter made by an expiry (the next sample boundary, Rule 16/10, step 4), and is used from that sample on. A trigger&rsquo;s reload of the counter does not count: after a trigger the old duty stays in force until the first expiry.</li>' +
      '</ol></div>' +
    '<div class="gbemu-example"><b>Example.</b> Single speed, channel 1 at frequency <code>0x7F8</code>: a period of (2048 &minus; 2040) &times; 4 = 32&nbsp;T, 8 machine cycles. A sample boundary falls on the second sound tick of machine cycle k. An NR11 write in cycle k: the boundary in cycle k keeps the old duty (the new one is only staged during the ticks); the new duty takes over at the next boundary, 32&nbsp;T later in cycle k + 8. An NR11 write in cycle k &minus; 1 is pending by the end of that cycle, so the boundary in cycle k already applies it. A build that applies the write at the start of its cycle gets cycle k&rsquo;s case one sample early.</div>' +
    '<div class="gbemu-why"><b>Why.</b> The cartridge says so in its header line. No number is chosen: the boundary is the waveform unit&rsquo;s own reload. <b>The write also lands at the end of its machine cycle</b>, which is a second and separate fact: with the write applied at the start of its cycle, every sub-test whose delay is a multiple of the sample length, <em>and only those</em>, reads one sample early. Seven cells, all at a sample boundary. <b>+2 rows.</b> Required: our core with this switched off fails <code>channel_1_duty_delay</code> and <code>channel_2_duty_delay</code> on the Color exactly as an independent build that left it out did. Read from our source (<code>DUTY_WRITE_DELAYED</code>).</div>' +

    '<div class="gbemu-rule" id="gbr-16-6"><b>Rule 16/6.</b> <b>The sweep&rsquo;s second overflow check is late by 8 cycles: 32&nbsp;T.</b> This applies to two sweep calculations: the second, overflow-only calculation made after a sweep step has written a new frequency, and the trigger&rsquo;s own check (appendix B.9 says when each is made). Each must run as follows:' +
      '<ol class="gbemu-steps">' +
        '<li>The calculation itself is made at once, at the step or at the trigger write, from NR10 and the shadow frequency as they stand then.</li>' +
        '<li>If it overflows, the channel is not stopped. Instead a stop countdown is loaded with 32&nbsp;T plus the seam&rsquo;s lead: 32&nbsp;T + B when the frame step armed it, 32&nbsp;T + 2B when a trigger write did.</li>' +
        '<li>At every sound tick the countdown drops by 2&nbsp;T (Rule 16/10, step 3). The check lands in the sound tick that brings it to 0 or below.</li>' +
        '<li><b>When it lands, the stop happens only if NR10&rsquo;s shift is non-zero at that moment.</b> An NR10 write with shift 0 that reaches the sound unit before the check lands voids it; a write with any other shift does not.</li>' +
        '<li>A trigger made while a check is pending discards it and puts the trigger&rsquo;s own check in its place. There is one countdown: a step whose second calculation overflows while a check is pending reloads it as in step 2 and what was left is lost; a second calculation that does not overflow leaves it running.</li>' +
      '</ol></div>' +
    '<div class="gbemu-example"><b>Example.</b> On the original (B = 4&nbsp;T), a step in machine cycle k whose second calculation overflows loads 32 + 4 = 36&nbsp;T: the check lands in the 18th sound tick from the step, the second tick of cycle k + 8, so an NR52 read in cycle k + 7 still sees channel 1 on and one in cycle k + 8 sees it off. A trigger&rsquo;s overflowing check written in cycle k loads 32 + 8 = 40&nbsp;T and lands in cycle k + 9. In the Color&rsquo;s double speed (B = 2&nbsp;T): 34&nbsp;T, landing in cycle k + 16, and 36&nbsp;T, landing in cycle k + 17. If NR10 is written with shift 0 in cycle k + 3, the step-armed check of the first case lands in cycle k + 8 and does not stop the channel; written with shift 3 instead, the channel stops in cycle k + 8 as though NR10 had not been touched.</div>' +
    '<div class="gbemu-why"><b>Why.</b> The cartridge declares it in a comment beside the sub-tests that measure it, and the unit is the file&rsquo;s own, recoverable from two other sentences in the same file that state a period and a phase length in the same units. <b>Which calculation is late is fixed by the table, not chosen</b>: the frequency <em>write</em> is on time and only the second, overflow-only calculation is late. Had the whole sweep event been late, eight declared cells would still carry the old oscillation, and they do not. <b>+2 rows</b>, and exactly two rows change verdict. The landing-time shift test is <code>channel_1_sweep_restart</code>&rsquo;s: NR10 written with shift 0 before the check lands, and the channel never stops. Read from our source (the sweep&rsquo;s late check, <code>SWEEP_KILL_DELAY_T</code> 32).</div>' +

    '<div class="gbemu-rule" id="gbr-16-7"><b>Rule 16/7.</b> <b>The envelope write glitch</b> must be built exactly as appendix B.13 gives it: every constant in it is the documentation&rsquo;s, and B.13 carries every constant, both declared tables and the two branch listings. The one place the behaviour deviates from that prose: the adjustment is computed exactly as the prose computes it, and in <em>Case 1</em> (the old pace being non-zero) it is <b>committed only when the direction changed, or when the old direction was increase</b> (either condition is enough). <b>That is Case 1 and not the whole rule:</b> B.13&rsquo;s own Case 2 table has an unchanged direction and an old direction of decrease still commit a step down. Separately, <b>enabling the envelope schedules one extra envelope tick</b>.</div>' +
    '<div class="gbemu-example"><b>Example.</b> Case 1, old pace non-zero, old direction decrease, and the write leaves the direction bit at decrease: the prose&rsquo;s adjustment is computed but not committed, so the volume is <code>unchanged</code>. The same write with the old direction increase, or with the direction bit changed, commits it.</div>' +
    '<div class="gbemu-why"><b>Why.</b> The deviation is read off a declared table rather than swept. The <b>three</b> cells that disagree with the prose are exactly the three writes that leave the direction bit alone with the old direction set to decrease, and the declared table in B.13 carries three <code>unchanged</code> verdicts. <b>Every constant, both declared tables and the two branch listings are in appendix B.13</b>, because &ldquo;the constants are the documentation&rsquo;s&rdquo; is not usable by a reader who does not have the documentation. The extra envelope tick is declared by the cartridge in its own header comment.</div>' +

    '<div class="gbemu-rule" id="gbr-16-8"><b>Rule 16/8.</b> <b>The waveform unit does not run before its channel has been triggered</b> for the first time since the sound unit was last powered on: until then the period counter runs and reloads, but the duty position does not advance. From that first trigger until the first sample ends (the first expiry of the period counter after it), the channel&rsquo;s output reads 0. Two effects, one condition.</div>' +
    '<div class="gbemu-example"><b>Example.</b> Power on, then wait 10 periods, then trigger channel 2 for the first time at duty 50%: the duty position is still 0 (powering on zeroes it), and the channel outputs 0 until its countdown first expires, whatever the duty pattern says for position 0. A later restart of the same channel does not repeat the 0 sample.</div>' +
    '<div class="gbemu-why"><b>Why.</b> Both effects are the documentation&rsquo;s own sentence. It reaches far more rows than it looks like it should, because every duty and volume cartridge in the suite performs one power-on and one trigger per byte it dumps. <b>+7 rows</b>. &ldquo;Since the last power-on&rdquo; and &ldquo;the first sample&rdquo; settled from our source (<code>DUTY_OFF_UNTIL_FIRST_TRIGGER</code>: powering on clears the flag, the first trigger sets it, and the zero output lasts until the first duty step).</div>' +

    '<div class="gbemu-rule" id="gbr-16-9"><b>Rule 16/9.</b> <b>The sweep step&rsquo;s own overflow stop is late too, and a recent trigger voids it.</b> This is the first calculation of a step (not the second, overflow-only one of Rule 16/6, and not the trigger&rsquo;s). When it overflows, the channel is not stopped at once:' +
      '<ol class="gbemu-steps">' +
        '<li>Every trigger of channel 1 loads a void-window countdown with 12&nbsp;T at the write; it drops by 2&nbsp;T at every sound tick (Rule 16/10, step 2) and stops at 0.</li>' +
        '<li>At the step, if the void-window countdown is above 0 (the trigger reached the sound unit fewer than 12&nbsp;T before the step), the stop is voided and the channel keeps playing.</li>' +
        '<li>Otherwise a step-stop countdown is loaded with 8&nbsp;T, replacing what is left if a stop is already pending. It drops by 2&nbsp;T at every sound tick, counted in the same sound-tick stage as the late check of Rule 16/6 (Rule 16/10, step 1), and the channel stops in the sound tick that brings it to 0 or below, <b>with no shift test at landing</b>.</li>' +
        '<li>A trigger also cancels a step stop still pending.</li>' +
      '</ol></div>' +
    '<div class="gbemu-example"><b>Example.</b> On the original a trigger written in machine cycle k loads 12&nbsp;T; cycle k&rsquo;s two sound ticks leave 8&nbsp;T, cycle k + 1&rsquo;s leave 4&nbsp;T, cycle k + 2&rsquo;s leave 0. A step whose first calculation overflows in cycle k (the write is taken before the step, Rule 15/6), k + 1 or k + 2 is voided; one in cycle k + 3, 12&nbsp;T after the write, is not. In the Color&rsquo;s double speed (one sound tick per cycle) the voided steps are those in cycles k to k + 5, and cycle k + 6 is not voided. A step not voided in cycle m loads 8&nbsp;T: on the original the stop lands in the second sound tick of cycle m + 1 (an NR52 read in cycle m sees the channel on, one in cycle m + 1 sees it off); in double speed it lands in cycle m + 3.</div>' +
    '<div class="gbemu-why"><b>Why.</b> These two are section 22&rsquo;s <b>sites 4 and 5</b> for the sweep-restart row: the void window <b>12 T</b> and the late step stop <b>8 T</b> (6 T also scores), both FITTED on a derived placement; our source&rsquo;s own record of that row gives 49 failing cells of 128 with both switched off, and 0 with both on. Read from our source (<code>SWEEP_TRIG_VOID_T</code> 12, <code>SWEEP_STEP_STOP_T</code> 8).</div>' +

    '<div class="gbemu-rule" id="gbr-16-10"><b>Rule 16/10.</b> <b>Order inside one sound tick</b> (step 4 of Rule 15/6), for the square channels and the sweep:' +
      '<ol class="gbemu-steps">' +
        '<li>A pending step stop (Rule 16/9): subtract 2&nbsp;T; at 0 or below, stop channel 1.</li>' +
        '<li>The void-window countdown (Rule 16/9): if above 0, subtract 2&nbsp;T.</li>' +
        '<li>A pending late check (Rule 16/6): subtract 2&nbsp;T; at 0 or below, stop channel 1 if NR10&rsquo;s shift is non-zero.</li>' +
        '<li>Each square channel&rsquo;s countdown: subtract 2&nbsp;T; at each expiry (0 or below) add the period back, make the pending duty the duty in force (Rule 16/5), and advance the duty position by one if Rule 16/8 and Rule 17/22 allow it. A trigger&rsquo;s first expiry falls on a grid edge (Rule 16/4).</li>' +
        '<li>Then the wave channel (section 17) and the noise channel&rsquo;s stages (Rule 17/13).</li>' +
      '</ol></div>' +
    '<div class="gbemu-why"><b>Why.</b> Settled from our source (<code>apu_chan_tick</code>). Steps 1 and 3 before step 4 mean that a stop landing in a sound tick silences the channel for that tick&rsquo;s output.</div>' +
  '</section>' +

  /* ---------------------------------------------------------------- S3 */
  '<section class="sect" id="gbe-s3"><h3 class="sect-h">17. Wave, noise, and power</h3>' +
    '<h4 class="gbemu-sub">The wave channel</h4>' +
    '<div class="gbemu-rule" id="gbr-17-1"><b>Rule 17/1.</b> <b>Channel 3 reads wave memory only while it is playing</b> (its NR52 flag reads 1). While it is disabled its period counter still runs and reloads, but its position does not advance and no sample is read into its buffer.</div>' +
    '<div class="gbemu-why"><b>Why.</b> This sounds like a nicety and it is a real defect: a disabled channel that keeps stepping latches a sample into its buffer, and a trigger resets the position but <em>not</em> the buffer, so the channel emits that stale sample for a whole period before its first real read. Note that a core almost certainly already asserts this rule <em>on the other side of the same fact</em>, by allowing the processor to touch wave memory freely while the channel is off. Two halves of one statement; make sure you have both. Read from our source (<code>APU_WAVE_READS_ONLY_WHEN_ON</code>).</div>' +

    '<div class="gbemu-rule" id="gbr-17-2"><b>Rule 17/2.</b> <b>Powering the sound unit off clears the current sample</b>: the wave channel&rsquo;s held sample must be set to 0, not only its output.</div>' +
    '<div class="gbemu-why"><b>Why.</b> Again, one half of a rule most cores already have: powering off zeroes every channel&rsquo;s output, but the wave channel recomputes its output from the held sample on the very next tick, so the explicit zero is undone before anything can observe it.</div>' +

    '<div class="gbemu-rule" id="gbr-17-3"><b>Rule 17/3.</b> <b>On the original Game Boy the channel owns wave memory while it plays, and a read and a write meet it at two different instants.</b> Both are stated against our seam: a processor write reaches the sound unit before that machine cycle&rsquo;s two sound ticks run, a processor read after them (Rule 15/6, E.5). Write p for the index (0 to 31) of the sample the channel read most recently, as the access arrives.' +
      '<table class="gbemu-table"><thead><tr><th>Access while channel 3 plays (original; times in T on the sound unit&rsquo;s clock)</th><th>Condition</th><th>Result</th></tr></thead><tbody>' +
        '<tr><td>Read</td><td>the channel read a new sample on the second of the read cycle&rsquo;s two sound ticks</td><td>the byte holding the channel&rsquo;s current sample (the one just read)</td></tr>' +
        '<tr><td>Read</td><td>any other case</td><td><code>0xFF</code></td></tr>' +
        '<tr><td>Write</td><td>channel 3&rsquo;s countdown is more than 2&nbsp;T and at most 4&nbsp;T as the write arrives (so the next sample read falls on the second tick of the write&rsquo;s own cycle)</td><td>lands on the byte about to be read, <code>((p + 1) &amp; 31) &gt;&gt; 1</code>, and not on the byte its address names</td></tr>' +
        '<tr><td>Write</td><td>any other case</td><td>dropped</td></tr>' +
      '</tbody></table>' +
      '<b>Every other write while the channel plays is dropped.</b> So the window is one tick, 2&nbsp;T, on both sides. Only the write inside the window is redirected (appendix B.10); the rest are dropped.</div>' +
    '<div class="gbemu-example"><b>Example.</b> The channel last read sample p = 5. A write to <code>FF3A</code> arrives with the countdown at 4&nbsp;T: the first sound tick leaves 2&nbsp;T, the second reaches 0 and reads sample 6, so the write lands on byte ((5 + 1) &amp; 31) &gt;&gt; 1 = 3 (<code>FF33</code>). With the countdown at 2&nbsp;T the read falls on the first tick, and with 6&nbsp;T on no tick of this cycle: the write is dropped. A read in a cycle whose second tick reads sample 6 returns byte 3; a read in a cycle whose sample was read on the first tick returns <code>0xFF</code>.</div>' +
    '<div class="gbemu-why"><b>Why.</b> Measured, not assumed: at wave periods of 6&nbsp;T and 14&nbsp;T the reference lands 81 of 256 and 34 of 256 processor reads, against the 2/period predictions of 0.333 and 0.143. Blargg <code>dmg_sound</code> 09 scores the read and 12 the write, and our core passes both.</div>' +

    '<div class="gbemu-rule" id="gbr-17-4"><b>Rule 17/4.</b> <b>On the Color there is no window at all</b>: the access is not refused, it is redirected: a read returns the byte holding the current sample and a write lands on the byte about to be read (<code>((p + 1) &amp; 31) &gt;&gt; 1</code>), on every cycle. The Color tab, Rule C13/6, has the full rule.</div>' +
    '<div class="gbemu-why"><b>Why.</b> A device split justified by the device rather than by a constant, and the Color side needs no constant because it has no window. Worth 2 rows.</div>' +

    '<p class="hw-readable"><b>The wave trigger delay.</b> A trigger costs the wave channel <b>an extra 6&nbsp;T</b> before its first read, where every other channel reloads with a bare period; the reload is Rule 16/1&rsquo;s wave row.</p>' +
    '<div class="gbemu-example"><b>Example.</b> <b>In one sentence, on our seam:</b> the trigger loads the countdown with the period plus 6&nbsp;T plus the T of the write cycle&rsquo;s own sound ticks still to run (4&nbsp;T at single speed, 2&nbsp;T in double speed), so the first read falls the period plus 6&nbsp;T after the end of the writing machine cycle. On the original at a wave period of 32&nbsp;T: 32 + 6 + 4 = 42&nbsp;T loaded, 38&nbsp;T left at the end of the writing cycle. A build that loads the period plus 6 at the write, before those ticks, reads 4&nbsp;T early and fails <code>09-wave_read_while_on</code> (measured on an independent build).</div>' +
    '<div class="gbemu-why"><b>Why.</b> <b>That constant was not fitted; it was decomposed.</b> The reference&rsquo;s wave read runs a constant 10&nbsp;T later than a bare-period reload at the write. Ten splits into two independently known parts: the documented 6&nbsp;T trigger delay, and our own bus seam&rsquo;s 4&nbsp;T write phase. The residual measured exactly 4&nbsp;T at two periods, and two further periods predicted from it came out right.</div>' +

    '<div class="gbemu-rule" id="gbr-17-5"><b>Rule 17/5.</b> <b>The famous &ldquo;first sample&rdquo; quirk is structural, not a special case.</b> A trigger must reset the position to 0 and must <em>not</em> load the sample buffer. The first read then advances to position 1: the low nibble of byte 0. Model the buffer and the position as separate objects.</div>' +
    '<div class="gbemu-example"><b>Example.</b> Wave byte 0 (<code>FF30</code>) holds <code>0x12</code> and the buffer holds 7 from earlier play. After a trigger the channel plays 7 until its first read, then 2 (position 1, the low nibble of byte 0), then the high nibble of byte 1, and so on. <b>The first nibble (1, position 0) is not heard until the waveform loops</b> from position 31 to 0.</div>' +
    '<div class="gbemu-why"><b>Why.</b> The channel therefore plays the buffer&rsquo;s previous contents first, then the <em>second</em> nibble. Model the buffer and the position as separate objects and the quirk emerges; conflate them and you will implement it by hand.</div>' +

    '<div class="gbemu-rule" id="gbr-17-6"><b>Rule 17/6.</b> <b>On the original Game Boy, retriggering the channel while it is reading corrupts wave memory.</b> On our seam (Rule 16/1&rsquo;s first column):' +
      '<ol class="gbemu-steps">' +
        '<li><b>The guards:</b> the channel must be enabled (a restart), and this is an original-Game-Boy rule only. There is no such corruption on a Color.</li>' +
        '<li><b>The window:</b> the retrigger corrupts when channel 3&rsquo;s sample countdown has <b>2&nbsp;T or fewer</b> remaining as the write lands. One sound tick, so the byte read the write collides with is the one the <em>next</em> tick will perform, not one already done.</li>' +
        '<li><b>The byte:</b> with the position held at <i>p</i> when the write arrives, the byte it names is <b><code>((p + 2) &amp; 31) &gt;&gt; 1</code></b>, where <b><i>p</i> is the index (0 to 31) of the sample most recently read</b>: on each wave step the position advances first and the sample at the new position is read, so <i>p</i> is that new position, not the one about to be read. If your position means &ldquo;the next sample&rdquo;, the formula is one step back.</li>' +
        '<li><b>The corruption:</b> if the named byte is one of the first four (bytes 0 to 3), the first byte is rewritten with the named byte. If it is any of the later twelve (bytes 4 to 15), <em>all four</em> of the first bytes are rewritten with the four aligned bytes the read came from (the named byte&rsquo;s group of four: bytes 4 to 7, 8 to 11 or 12 to 15).</li>' +
      '</ol></div>' +
    '<div class="gbemu-example"><b>Example.</b> A restart lands with 2&nbsp;T left and p = 9: the named byte is ((9 + 2) &amp; 31) &gt;&gt; 1 = 5, one of the later twelve, so bytes 0 to 3 become copies of bytes 4 to 7. With p = 1: byte ((1 + 2) &amp; 31) &gt;&gt; 1 = 1, so byte 0 becomes a copy of byte 1. With 4&nbsp;T left: no corruption.</div>' +
    '<div class="gbemu-why"><b>Why.</b> Two knobs sit in this one step (when the window opens, and which byte it names) and they are not independent: of fifteen combinations swept, exactly one passes, and it is the one where the two cancel. <b>A point, not a plateau</b>, which is how you can tell the rule was right and only its boundary was off by a step. The combination is given in full because it is the one rule in these three sound sections that cannot be guessed past at all. Both are stated relative to a write path that reaches the sound unit <em>before</em> that machine cycle&rsquo;s two sound ticks run, which is the seam B.16 describes, and to a trigger whose reload counts those two ticks (the 4&nbsp;T of the decomposition above). <b>Both seams, measured.</b> On ours, of twenty cells (the window at 2&nbsp;T or fewer and the three two-tick bands above it, to 8&nbsp;T, against the byte named from p + 0 to p + 4) exactly one passes 10-wave_trigger_while_on: <b>2&nbsp;T, p + 2</b>. <b>Blargg <code>dmg_sound</code> 10-wave_trigger_while_on is what scores it</b>, and it is an original-machine cartridge, which matters more than it looks, and appendix B says why: most of the sound board is scored through two registers this machine does not have, and those twelve cartridges are the route that does not need them.</div>' +

    '<div class="gbemu-rule" id="gbr-17-7"><b>Rule 17/7.</b> <b>The same corruption on the other seam</b> (the write lands after the machine cycle&rsquo;s two sound ticks, where E.5&rsquo;s read order places them, <b>with the trigger&rsquo;s reload no longer counting them</b>, so that the first read after a trigger stays at the same instant): <b>the window is still 2&nbsp;T or fewer remaining as the write lands, the countdown read after the cycle&rsquo;s ticks, and the byte is <code>((p + 1) &amp; 31) &gt;&gt; 1</code></b>: the window keeps its width and the byte moves back one sample. The guards and the corruption are those of Rule 17/6.</div>' +
    '<div class="gbemu-example"><b>Example.</b> Other seam, a restart with 2&nbsp;T left after the ticks and p = 9: the named byte is ((9 + 1) &amp; 31) &gt;&gt; 1 = 5, and bytes 0 to 3 become copies of bytes 4 to 7.</div>' +
    '<div class="gbemu-why"><b>Why.</b> On that seam exactly one of twenty passes again (windows from none to 6&nbsp;T, the same five bytes), and it is this one. 09-wave_read_while_on passes on that arrangement too. That is the pair a build on that seam needs. Moving the write alone, with the 4&nbsp;T left in the reload, is not that seam: it moves the first trigger and the retrigger together, so 10 still passes at 2&nbsp;T, p + 2 while 04, 05 and 09 fail. And the wave-memory access window of Rule 17/3 is also written for our seam: on the other seam, built as described, 12-wave_write_while_on fails, so an implementer there owes it a measurement of its own.</div>' +

    '<h4 class="gbemu-sub">The noise channel, and the register that does not exist</h4>' +
    '<div class="gbemu-rule" id="gbr-17-8"><b>Rule 17/8.</b> <b>There is no seven-bit shift register.</b> There is <b>one fifteen-stage register, always</b>, and the width bit chooses only <em>where the feedback is deposited</em>: in narrow mode it is deposited at stage 6 <em>as well as</em> stage 14, so the upper stages keep running and carry the short sequence delayed.</div>' +
    '<div class="gbemu-why"><b>Why.</b> The rival reading (that narrow mode deposits at stage 6 <em>instead</em>, draining the upper stages) is not refuted by any test that triggers the channel fresh, because <b>while narrow mode is held the two are observationally identical</b>. Only widening a <em>running</em> channel can separate them, and fitted with a free offset both readings score a perfect 1.0000, which means nothing at all. <b>NOT FULLY SETTLED</b>, and stated at its real strength: both hypotheses were refuted <em>for the reference we compared against</em>, whose upper-bit behaviour is a third thing; ours is confirmed self-consistent and reproduces its own stream exactly. The narrow direction (which is what music actually uses) agrees exactly, and nothing in the corpus watches the other.</div>' +

    '<div class="gbemu-rule" id="gbr-17-9"><b>Rule 17/9.</b> The rest of the register. <b>Feedback is bit&nbsp;0 XOR bit&nbsp;1</b>; the register shifts right; the result is deposited at stage 14 always. <b>The channel&rsquo;s output is the <em>inverted</em> bit&nbsp;0</b>, and the seed is all fifteen stages set, and the eight divisor values are <b>8, 16, 32, 48, 64, 80, 96, 112</b>: <b>code&nbsp;0 is half of code&nbsp;1</b>.' +
      '<table class="gbemu-table"><thead><tr><th>Divisor code (NR43 bits 2 to 0)</th><th>0</th><th>1</th><th>2</th><th>3</th><th>4</th><th>5</th><th>6</th><th>7</th></tr></thead><tbody>' +
        '<tr><td>Divisor, in T</td><td>8</td><td>16</td><td>32</td><td>48</td><td>64</td><td>80</td><td>96</td><td>112</td></tr>' +
      '</tbody></table>' +
    '</div>' +
    '<div class="gbemu-why"><b>Why.</b> Two of these details are where cores differ. The seed is why the output sits low for the first several shifts after a trigger, by an amount that depends on the width. Code 0 is the one entry no regular formula produces and the one people therefore get wrong.</div>' +

    '<div class="gbemu-rule" id="gbr-17-10"><b>Rule 17/10.</b> <b>The divisor stage is not reset by a trigger.</b> Only the shift stage is.</div>' +
    '<div class="gbemu-why"><b>Why.</b> The cartridge <em>declares</em> the split: its nine arms are labelled &ldquo;affected&rdquo; and &ldquo;not affected&rdquo; in its own comments, and the label is exactly <em>divisor code is non-zero</em> (nine arms, four shifts, no exception). A second cartridge says it from the other side: <i>&ldquo;the values in this test are not affected by frequency alignment&rdquo;</i>, and every value in it has divisor code 0. <b>The mechanism.</b> A free-running clock of period 8&nbsp;T (non-zero code) or 4&nbsp;T (code 0) runs from power-on; a trigger asks for the half period and the first step is taken on the nearest edge of <em>that</em> clock. At single speed the processor writes on a 4&nbsp;T grid, so a code-0 request always lands exactly on its own clock (which is why code 0 shows no alignment effect at all), while a non-zero-code request lands either exactly on the 8&nbsp;T clock or exactly half way between two of its edges. That half-way case is the entire effect. <b>This paragraph is correct as far as it goes and it is not the whole clock; the subsection below (Rules 17/13 and 17/14) replaces the schedule it implies.</b></div>' +

    '<div class="gbemu-rule" id="gbr-17-11"><b>Rule 17/11.</b> <b>The first step after a trigger is half a period in, not a whole one, plus the start delay, and the two are added, never substituted.</b> <b>The start delay does not replace the half period and must not be published in its place</b>: the counter model of Rule 17/13 <em>derives</em> the half period (the tapped bit first rises after 2<sup>shift</sup> expiries) rather than replacing it. B.15 has the whole form and the four arms that fix it.</div>' +
    '<div class="gbemu-why"><b>Why.</b> Read off four declared arms with the harness&rsquo;s own read offset measured rather than assumed: three periods, two widths, one form. Over-determined, not fitted to one number.</div>' +
    '<div class="gbemu-why"><b>NOT DERIVED, and named rather than hidden:</b> the additive term beside that half period. No document in reach states it, and <b>the board cannot choose its form</b>: two candidate expressions are identical on all 68 sound rows. Every row that would separate them also depends on the free-running phase, so no probe can. It is carried as undecided. Likewise, divisor codes 5, 6 and 7 <b>appear nowhere in the corpus</b>, so the rule&rsquo;s behaviour above code 4 is <em>unmeasured</em>, not established. <b>What this core ships is the literal 8</b>, and appendix B.15 states it outright with the second candidate beside it: a reader cannot reproduce our board score from a term we decline to name.</div>' +

    '<div class="gbemu-rule" id="gbr-17-12"><b>Rule 17/12.</b> <b>A write to the noise frequency register lands at the end of its machine cycle, not the start</b> (Rule 15/6, step 6). Every noise step the writing machine cycle&rsquo;s own sound ticks perform uses the width, divisor and shift that stood before the write.</div>' +
    '<div class="gbemu-example"><b>Example.</b> The cartridge that separates them triggers wide, runs, then writes narrow with the same code and shift (so <em>only</em> the feedback deposit changes) and declares 128 bytes of what follows. Applied on entry: 62 of 128 wrong. Deferred to the end of the cycle: <b>exact in all 128</b>, with its mirror cartridge still exact.</div>' +
    '<div class="gbemu-why"><b>Why.</b> Applied on entry, the width and divisor a mid-run write installs are already visible to the steps that machine cycle still owes. MECHANISM, read from our source (<code>NOISE_NR43_DEFER</code>).</div>' +

    '<h4 class="gbemu-sub">The noise clock is a free-running counter, and a frequency write never touches its up-counter</h4>' +
    '<div class="gbemu-why"><b>Start with what the 48-rule family does and does not settle, because it is the trap this row sets.</b> That family: every monotone rule computing <em>a duration from the write</em> (enumerated and refuted against <code>channel_4_freq_change</code>, and the refutation is sound). It does <em>not</em> make the row underivable, and concluding that it does is the mistake: the hardware computes <em>a position in a count that never stopped</em>. <b>The family was complete; it was not the universe.</b></div>' +
    '<div class="gbemu-rule" id="gbr-17-13"><b>Rule 17/13.</b> <b>The clock, in three cascaded free-running stages.</b>' +
      '<ol class="gbemu-steps">' +
        '<li><b>(a)</b> A mod-4 clock, stepping once every sound tick, <b>zeroed only by powering the sound unit on</b>, never by a frequency write, never by a trigger.</li>' +
        '<li><b>(b)</b> A 4-bit down-counter examined when that clock reaches one phase, <b>plus a second examination at a second phase while the latched divisor code is 0</b> (the latched code is the one the last frequency write applied, and that write lands at the end of its machine cycle, not at its start (Rule 17/12); the trigger&rsquo;s extra 4&nbsp;T at code 1 reads the same latched value): that second examination is the whole of <em>&ldquo;code 0 runs at double rate&rdquo;</em>, and it replaces the special-cased half period. Each examination subtracts 1; on expiry (reaching 0) it reloads from the divisor field, a divisor of 0 reloading as 1. The counter never holds 0 at an examination, so it never wraps: it starts at 1 at reset and at every power-on, and every load gives it 1 or more. <b>Our two phases are 3 and 1, and 3 is the primary: the one that governs every divisor code, non-zero ones included; 1 is the code-0-only second.</b></li>' +
        '<li><b>(c)</b> A 14-bit up-counter, incremented once per expiry, <b>whose bit selected by the shift field drives the shift register on that bit&rsquo;s rising edge</b>, so shifts 14 and 15 never step the register at all, because the counter is only 14 bits wide.</li>' +
      '</ol></div>' +
    '<div class="gbemu-example"><b>Example.</b> Divisor code 2, shift 1, on our phases: the down-counter is examined only when the mod-4 clock reaches 3, once every 4 sound ticks (8&nbsp;T); it expires on every second examination (16&nbsp;T) and reloads with 2; each expiry adds 1 to the up-counter, and the register steps when the up-counter&rsquo;s bit 1 goes from 0 to 1 (counts 1 to 2, 5 to 6, 9 to 10, and so on), once every 4 expiries (64&nbsp;T). At code 0 the down-counter is also examined when the clock reaches 1, reloads as 1, and so expires at every examination: once every 2 sound ticks (4&nbsp;T).</div>' +
    '<div class="gbemu-why"><b>Why.</b> Which of the pair is which matters and cannot be read off the four rows usually offered as evidence, because they are all at code 0, where the two are symmetric. The <em>values</em> depend on where your clock&rsquo;s zero sits relative to your own tick call site and must be re-derived, never copied; the <em>assignment</em> does not. B.17 has the anchor that lets you map ours onto yours, and the intra-tick ordering that travels with it. MECHANISM, read from our source (<code>NOISE_COUNTER_MODEL</code>, <code>NOISE_EXAM_PHASE</code> 3, <code>NOISE_EXAM_PHASE2</code> 1).</div>' +

    '<div class="gbemu-rule" id="gbr-17-14"><b>Rule 17/14.</b> <b>A frequency write never touches the up-counter.</b> It re-points the tap and changes the increment rate <em>under a counter that keeps its value</em>. What it does reload is the down-counter, and only for a non-zero divisor code: the new code, applied at the end of the write&rsquo;s machine cycle, loads the down-counter with that code; a code of 0 returns the counter to double-rate examination and leaves the down-counter&rsquo;s residual alone. A trigger, by contrast, <em>does</em> re-zero the shift stage: at the end of its start delay (Rule 16/1) the up-counter is zeroed and the down-counter loaded, while the mod-4 clock keeps running.</div>' +
    '<div class="gbemu-example"><b>Example.</b> The up-counter reads 5 (binary 101) under shift 2, and a write changes the shift to 1. The counter keeps 5; on the next expiry it becomes 6, bit 1 rises, and the register steps. A model that restarted the count at the write would count 0, 1, 2 and step only on the second expiry.</div>' +
    '<div class="gbemu-why"><b>Why.</b> The residual a code-0 write leaves is what makes a later write produce an earlier step. MECHANISM, read from our source (<code>apu.c</code>, the deferred frequency write under <code>NOISE_NR43_DEFER</code> with <code>NOISE_COUNTER_MODEL</code>). <b>So there is no post-write schedule to be monotone in</b>, which is exactly why the 48-rule family provably could not contain the answer. The trigger half most cores already have, and it survives unchanged.</div>' +
    '<div class="gbemu-why"><b>Three things fall out with no free parameter, and they are the reason to prefer this model even where a period model scores the same.</b> <b>Equal-period divisor/shift pairs become structural:</b> pairs of equal effective period drive the <em>same</em> up-counter bit grid, so they must agree (a period model gets that by arithmetic coincidence). <b>The one-machine-cycle alignment effect is derived rather than read off:</b> the trigger re-zeroes the up-counter while the divisor stage keeps running, and whether the trigger falls on an examination phase or half way between two of them is the entire effect. And <b>a later write can produce an earlier step</b>, which is the model-independent falsifier section 22 records: a write leaves the down-counter&rsquo;s residual untouched, a <em>later</em> write leaves a <em>shorter</em> residual, so the new slower cadence is anchored <em>earlier</em> and every step after it arrives earlier.</div>' +

    '<div class="gbemu-rule" id="gbr-17-15"><b>Rule 17/15.</b> <b>The trigger&rsquo;s start delay is 8&nbsp;T, plus 4&nbsp;T more when the divisor code is 1</b> (the full load is Rule 16/1&rsquo;s noise row). <b>The shipped form is <em>== 1</em></b>: the 4&nbsp;T is added at code 1 and at no other code.</div>' +
    '<div class="gbemu-why"><b>LABEL: DERIVED against our own corpus, with one declared term, not MECHANISM, and the difference is stated rather than glossed.</b> The shape is CONVERGENCE in origin: two independent source readings agreed on it. Every <em>value</em> in it was then fixed against a declared table rather than chosen. <b>The one term that does not close:</b> the 4&nbsp;T at code 1. That term is <b>DECLARED BY OUR OWN CORPUS</b>. Measured here, not borrowed: ablate it and four of our own declared cells in two other suites break, so four cells independently require it. <b>Its value is declared; its form above code 4 is NOT ESTABLISHED.</b> <b>Mind where the rival forms actually part company:</b> <em>== 1</em>, <em>&le; 1</em> and <em>odd</em> <b>do not first differ at code 5</b>. They differ at code 0 and at code 3, and both are heavily exercised. <b><em>&le; 1</em> is refuted by B.15&rsquo;s own validating table</b>: all four of its arms sit at code 0, and under <em>&le; 1</em> they would predict 20 / 20 / 24 / 32&nbsp;T against a measured 16 / 16 / 20 / 28. <b><em>odd</em> is refuted at code 3</b>: codes 2, 3 and 4 fall out of the counter model with nothing read off, and adding the term at code 3 breaks them. What remains open is <em>only</em> the form <b>above code 4</b>: no cartridge in this corpus exercises divisor codes 5, 6 or 7 at both trigger phases, so whether those three take the term is unmeasured. <b>What would establish it:</b> exactly that cartridge. The nearest implementation carries the same term and <em>its own author disowns it in an adjacent comment</em>; that is not why we take it, and it is not evidence.</div>' +

    '<div class="gbemu-rule" id="gbr-17-16"><b>Rule 17/16.</b> <b>Two more knobs, named rather than hidden, because a reader cannot reproduce a score from a term we decline to name.</b> The phase at which the mod-4 clock&rsquo;s zero sits relative to the tick call site is <b>FORCED in kind and READ OFF in value</b> (Rule 17/13 and B.17). The restart&rsquo;s extra lead is <b>BOUNDED, NOT VALUED</b>: a build may ship any value in the half-open range (0,&nbsp;8]&nbsp;T. <b>The restart&rsquo;s extra lead ships at 2&nbsp;T here</b> (Rule 16/1&rsquo;s noise row).</div>' +
    '<div class="gbemu-example"><b>Example.</b> A lead of 2&nbsp;T, 4&nbsp;T or 8&nbsp;T passes both restart tables; a lead of 0 or 10&nbsp;T fails both.</div>' +
    '<div class="gbemu-why"><b>Why.</b> Every value in the half-open range (0,&nbsp;8]&nbsp;T passes both restart tables, 128 cells each, while 0 and 10 each fail both. <b>Ship any value in that window.</b> The number is stated here rather than deferred, because <em>a bound that admits two readings needs one shipped representative stated in every place the quantity appears, not a bound in one place and an example in another.</em> <b>The invariant is the bound; 2 is a legal representative of it and is not a finding.</b></div>' +

    '<div class="gbemu-why"><b>What the counter model accounts for, measured.</b> <b>368 cells</b> of four suites, 32 + 64 + 128 + 144, fall out of the counter with no half-period reload and no read-off tie-break. That set is the model&rsquo;s pre-registered falsifier: refuted if <em>any</em> of the 368 moved at all, and 368 of 368 hold. <b>This is a falsification test and not a regression check, and the distinction is the reason it is worth anything:</b> a model that re-derived one row by breaking another would have been a trade. Channel 4 stands at 1096 of 1100 cells. <b>THE ROW (<code>channel_4_freq_change</code>) STILL FAILS, at 4 of 64, and the board does not move.</b> The four miss in opposite directions (one pair 8&nbsp;T early, the other 8&nbsp;T late), so <b>no constant closes both</b>, and closing it with a fitted number was refused. <b>60 of 64 is a better failure, not a pass.</b></div>' +

    '<h4 class="gbemu-sub">Power, the DAC, and one rule that is refused</h4>' +
    '<div class="gbemu-rule" id="gbr-17-17"><b>Rule 17/17.</b> <b>Whether powering off clears the length counters is a device split.</b> On the original, powering the sound unit off must leave the four length counters as they were; on the Color it clears them (the Color tab, Rule C13/7).</div>' +
    '<div class="gbemu-why"><b>Why.</b> A cartridge pair declares it. The two members of one test are the same program differing only in their work-RAM addresses, and at the same sub-test one asserts <i>&ldquo;powering off shouldn&rsquo;t affect NR41&rdquo;</i> and the other <i>&ldquo;powering off should clear NR41&rdquo;</i>. No constant is introduced by honouring it: it gates two carve-outs you already have on a flag you already carry.</div>' +

    '<div class="gbemu-rule" id="gbr-17-18"><b>Rule 17/18.</b> <b>The read-back masks are not decoration.</b> Every sound register must read back its written value ORed with a fixed mask of unused bits (the table is appendix B.3). Treat that table as a hard invariant rather than something to fill in later. The status register&rsquo;s low four bits are <em>read-only</em>: they are the channels&rsquo; own enable state, not storage.</div>' +
    '<div class="gbemu-why"><b>Why.</b> One Mooneye cartridge sweeps them all.</div>' +

    '<div class="gbemu-rule" id="gbr-17-19"><b>Rule 17/19.</b> <b>Wave memory survives a power cycle of the sound unit and stays readable and writable while it is off</b>, even though every other register is zeroed and every write to them ignored, with the exceptions appendix B.11 lists.</div>' +

    '<div class="gbemu-rule" id="gbr-17-20"><b>Rule 17/20.</b> <b>The DAC is not a pass-through of the digital value.</b> A powered DAC maps 0&ndash;15 onto the full analogue swing, so <b>digital 0 is a rail, not silence</b>; an unpowered DAC sits at the midpoint. The mixer is appendix B.12.</div>' +
    '<div class="gbemu-example"><b>Example.</b> <b>Silence is not zero.</b> With three DACs powered and every channel at digital zero, the idle level sits at exactly <code>&minus;3 &times; 15 &times; 8 / 480 = &minus;0.7500</code> of full scale. A host that fills an underrun with zeroes therefore produces a <b>0.75 full-scale step, 24,575 units, about 10&nbsp;dB louder than the music</b>.</div>' +
    '<div class="gbemu-why"><b>Why.</b> That is the difference between &ldquo;the channel is quiet&rdquo; and &ldquo;the channel is off&rdquo;, and a model emitting an unsigned 0&ndash;15 conflates them. The two are related by an affine map only while the set of powered DACs is constant, and they diverge at exactly the moment a game switches a DAC, which is the moment that audibly clicks on real hardware. The model predicted the idle figure to four decimal places before it was measured, which is how it was known to be the DAC state and not an artefact.</div>' +

    '<div class="gbemu-rule" id="gbr-17-21"><b>Rule 17/21.</b> When the host&rsquo;s audio buffer runs out (an underrun), the host must hold the last frame instead of filling with zeroes.</div>' +
    '<div class="gbemu-why"><b>Why.</b> A held direct-current level is inaudible, and it is the transition that clicks (Rule 17/20&rsquo;s example).</div>' +

    '<div class="gbemu-rule" id="gbr-17-22"><b>Rule 17/22.</b> <b>What holds in our core while the unit is off.</b> Powering off zeroes both square channels&rsquo; duty positions and disables every channel; a disabled channel steps neither its duty position, nor its wave position, nor its noise shift register, so only the period timers run (on channel 4, the three counter stages of Rule 17/13); powering on zeroes the duty and wave positions again and sets the step counter so that the next event is step 0 (Rule 15/4).</div>' +
    '<div class="gbemu-why"><b>Why.</b> MECHANISM, read from our source (<code>apu_power_off</code>, <code>apu_power_on</code>, <code>DUTY_STOPPED_HOLDS_PHASE</code>, <code>APU_WAVE_READS_ONLY_WHEN_ON</code>).</div>' +

    '<div class="gbemu-rule" id="gbr-17-23"><b>Rule 17/23.</b> <b>A powered-off sound unit should not clock its channels, and our core does not implement that rule: its channels keep clocking while the unit is off</b>, with the price written down. A build that matches our core must keep running the period timers while the unit is off, within the limits of Rule 17/22.</div>' +
    '<div class="gbemu-why"><b>Why, and the price.</b> The documentation says the pulse phase &ldquo;is only ever reset by turning the sound unit off&rdquo;, which it cannot be if the off state keeps advancing it. Measured with every other arm held on, so the attribution is a control and not an inference: it buys <b>nothing</b> on the board, and it makes the audio instrument <b>worse by 156</b>, taking two pulse tracks that were exact to 0.49. It is kept as a switch rather than deleted, because two exact tracks going to 0.49 is not a phase error, and whatever it is, <b>this arm exposed it rather than created it</b>.</div>' +
  '</section>' +

  /* ---------------------------------------------------------------- 9 */
  '<section class="sect" id="gbe-sound-regs"><h3 class="sect-h">Appendix B. The sound registers, and the primitives the refinements modify</h3>' +
    '<p class="gbemu-key">Sections 15 to 17 are refinements. <b>This appendix is what they are ' +
    'refinements <em>of</em></b>: the register map, the duty patterns, the period formulas, ' +
    'the length widths, the divisor table. None of it is subtle and all of it is load-bearing: the ' +
    'sound rows of the board are the largest single block on it, and not one of them is reachable ' +
    'without this. Read it first and then read 15&ndash;17; reading them the other way round is ' +
    'what makes the sound unit look like the hardest part of the machine.</p>' +
    '<p class="hw-readable"><b>Units in this appendix.</b> &ldquo;T&rdquo; is a T-cycle of the master clock. A <b>sound tick</b> is 2&nbsp;T, at single speed and in double speed alike (Rule B.16/1). A <b>sequencer step</b> is one step 0 to 7 of the frame sequencer (section 15); a <b>sequencer event</b> is one falling edge of its divider bit, and an event performs one step unless the power-on skip (Rule B.11/3) suppresses it. Bits are numbered from 0, the least significant.</p>' +
    '<p class="hw-readable"><b>Naming.</b> The registers are conventionally NR<i>cn</i> where ' +
    '<i>c</i> is the channel and <i>n</i> the register: NR10 to NR14 for channel 1, NR21 to ' +
    'NR24 for channel 2, NR30 to NR34 for channel 3, NR41 to NR44 for channel 4, NR50 to NR52 for ' +
    'the master block. The names are used everywhere, including by the test cartridges, so they are ' +
    'worth keeping even though they are opaque. Channel 2 has no NR20 and channel 4 no NR40; ' +
    'those two addresses, <code>FF15</code> and <code>FF1F</code>, exist and read ' +
    '<code>0xFF</code>. Section 17 has the reason that second absence matters.</p>' +
    '<p class="gbemu-key"><b>Two sound registers are deliberately absent from this appendix, and most of the sound board is scored through them.</b> <code>PCM12</code> (<code>FF76</code>) and <code>PCM34</code> (<code>FF77</code>) ' +
    'expose each channel&rsquo;s current digital output to the processor. <b>They do not exist on ' +
    'the original Game Boy</b>, which is why they are not in the tables below: they are ' +
    'fully described on the <b>Colour tab, section 13 and its appendix A register map</b>. G.2 ' +
    'records what they are worth: most of SameSuite reads the channel back through them, so without ' +
    'them most of that suite cannot score at all.</p>' +
    '<div class="gbemu-why"><b>Why this matters for a build of the original machine: a pointer to the Colour tab is necessary and it is not sufficient, and the difference is the structural hole in the sound block.</b> ' +
    'A reader building for the <em>original</em> Game Boy cannot use those two registers at all ' +
    '(their machine does not have them), so the Colour tab says where ' +
    'the instrument is <em>described</em>, not how to score. That would leave the largest block of sound rows on the board ' +
    'unreachable from the machine this page is about. <b>That is true of SameSuite. It is not true ' +
    'of the sound unit.</b> The original-machine route is <b>Blargg&rsquo;s <code>dmg_sound</code>, ' +
    'twelve cartridges, and they are on this board</b>. It is a better <em>first</em> instrument than ' +
    'SameSuite for three reasons:' +
    '<ol class="gbemu-steps"><li>it runs on the original;</li>' +
    '<li>it <b>self-reports</b>, on screen and ' +
    'in cartridge RAM at <code>0xA000</code>, not on the serial port (section 19 has the format), so G.6&rsquo;s &ldquo;score yourself with no reference images&rdquo; ' +
    'route covers it;</li><li>its twelve cover the registers, the length counter, the trigger, the ' +
    'sweep in two parts, the power interaction, and all three wave-memory-while-on behaviours.</li></ol>' +
    '<b>Build against those twelve first and reach for PCM12/PCM34 afterwards</b>, not the other ' +
    'way round. <b>What it cannot do, said plainly so the route is not oversold.</b> Of the four ' +
    'quantities sections 15 to 17 print, <code>dmg_sound</code> ' +
    'scores <b>two</b>: the sequencer origin, through <code>02-len_ctr</code> and ' +
    '<code>07-len_sweep_period_sync</code>, and the wave retrigger corruption, through ' +
    '<code>10-wave_trigger_while_on</code>, which is its authority. The restart position-advance ' +
    'threshold and the noise examination phases are read back per sample and are <b>genuinely ' +
    'unscoreable on the original machine</b>: no instrument on this machine can see either ' +
    'of them. That is not an argument for leaving them to the reader; it is the reason they had to ' +
    'be printed as values rather than left to be derived, and it is the sharpest case on this page ' +
    'for B.15&rsquo;s rule about shipped representatives (a quantity that admits two readings has one shipped value, stated in every place the quantity appears).</div>' +

    '<h4 class="gbemu-sub">B.1: Channel 1, the sweeping pulse</h4>' +
    '<div class="gbemu-rule" id="gbr-B-1-1"><b>Rule B.1/1.</b> Channel 1&rsquo;s registers must have exactly the bit fields of this table. A field marked write only is not returned by a read (Rule B.3/1 gives what a read returns).</div>' +
    '<table class="gbemu-table"><thead><tr><th>Address</th><th>Name</th><th>Bits (bit 7 is the most significant, bit 0 the least)</th></tr></thead><tbody>' +
      '<tr><td><code>FF10</code></td><td>NR10</td><td><b>7</b> unused. <b>6&ndash;4</b> sweep pace. <b>3</b> direction, 1 = decreasing. <b>2&ndash;0</b> shift</td></tr>' +
      '<tr><td><code>FF11</code></td><td>NR11</td><td><b>7&ndash;6</b> duty. <b>5&ndash;0</b> length load, <b>write only</b></td></tr>' +
      '<tr><td><code>FF12</code></td><td>NR12</td><td><b>7&ndash;4</b> initial volume. <b>3</b> envelope direction, 1 = increasing. <b>2&ndash;0</b> envelope pace. <b>Bits 7&ndash;3 non-zero = the channel&rsquo;s DAC is powered</b></td></tr>' +
      '<tr><td><code>FF13</code></td><td>NR13</td><td>The low eight bits of the 11-bit period. <b>Write only</b></td></tr>' +
      '<tr><td><code>FF14</code></td><td>NR14</td><td><b>7</b> trigger, write only. <b>6</b> length enable. <b>5&ndash;3</b> unused. <b>2&ndash;0</b> the high three bits of the period, write only</td></tr>' +
    '</tbody></table>' +
    '<h4 class="gbemu-sub">B.2: Channels 2, 3 and 4</h4>' +
    '<div class="gbemu-rule" id="gbr-B-2-1"><b>Rule B.2/1.</b> The registers from <code>FF15</code> to <code>FF3F</code> must have exactly the bit fields of this table. &ldquo;As NR11&rdquo; (and the like) means the same fields at the same bit positions, for this row&rsquo;s channel. Addresses marked &ldquo;none&rdquo; hold no register: a read returns <code>0xFF</code> and a write changes nothing.</div>' +
    '<table class="gbemu-table"><thead><tr><th>Address</th><th>Name</th><th>Bits (bit 7 is the most significant, bit 0 the least)</th></tr></thead><tbody>' +
      '<tr><td><code>FF15</code></td><td>none</td><td>Does not exist. Reads <code>0xFF</code></td></tr>' +
      '<tr><td><code>FF16</code></td><td>NR21</td><td>As NR11</td></tr>' +
      '<tr><td><code>FF17</code></td><td>NR22</td><td>As NR12</td></tr>' +
      '<tr><td><code>FF18</code></td><td>NR23</td><td>As NR13</td></tr>' +
      '<tr><td><code>FF19</code></td><td>NR24</td><td>As NR14</td></tr>' +
      '<tr><td><code>FF1A</code></td><td>NR30</td><td><b>7</b> DAC power for channel 3: this channel&rsquo;s DAC is one bit, not a field. <b>6&ndash;0</b> unused</td></tr>' +
      '<tr><td><code>FF1B</code></td><td>NR31</td><td>All eight bits are the length load. <b>Write only</b></td></tr>' +
      '<tr><td><code>FF1C</code></td><td>NR32</td><td><b>6&ndash;5</b> output level. <b>0</b> mute, <b>1</b> full, <b>2</b> half, <b>3</b> quarter. All other bits unused</td></tr>' +
      '<tr><td><code>FF1D</code></td><td>NR33</td><td>Low eight bits of the period. Write only</td></tr>' +
      '<tr><td><code>FF1E</code></td><td>NR34</td><td>As NR14</td></tr>' +
      '<tr><td><code>FF1F</code></td><td>none</td><td>Does not exist. Reads <code>0xFF</code></td></tr>' +
      '<tr><td><code>FF20</code></td><td>NR41</td><td><b>5&ndash;0</b> length load, write only. Bits 7&ndash;6 unused: <b>channel 4 has no duty</b></td></tr>' +
      '<tr><td><code>FF21</code></td><td>NR42</td><td>As NR12</td></tr>' +
      '<tr><td><code>FF22</code></td><td>NR43</td><td><b>7&ndash;4</b> clock shift. <b>3</b> width: 1 = the 7-bit feedback path. <b>2&ndash;0</b> divisor code</td></tr>' +
      '<tr><td><code>FF23</code></td><td>NR44</td><td><b>7</b> trigger. <b>6</b> length enable. Bits 5&ndash;0 unused: <b>channel 4 has no period register</b></td></tr>' +
      '<tr><td><code>FF24</code></td><td>NR50</td><td><b>7</b> external input to the left. <b>6&ndash;4</b> left volume. <b>3</b> external input to the right. <b>2&ndash;0</b> right volume. <b>The volume field is a multiplier of <code>value + 1</code></b>, so 0 is not silence: it is one eighth</td></tr>' +
      '<tr><td><code>FF25</code></td><td>NR51</td><td>The routing byte. <b>7&ndash;4</b> channels 4, 3, 2, 1 to the <em>left</em>; <b>3&ndash;0</b> the same four to the <em>right</em>. Bit <i>n</i> is the right side of channel <i>n</i>+1; bit <i>n</i>+4 its left</td></tr>' +
      '<tr><td><code>FF26</code></td><td>NR52</td><td><b>7</b> sound unit power, read/write. <b>6&ndash;4</b> unused, read 1. <b>3&ndash;0</b> the four channels&rsquo; active flags, <b>read only</b>: bit <i>n</i> is channel <i>n</i>+1. They are state, not storage: writing them does nothing</td></tr>' +
      '<tr><td><code>FF27</code>&ndash;<code>FF2F</code></td><td>none</td><td>Do not exist. Read <code>0xFF</code></td></tr>' +
      '<tr><td><code>FF30</code>&ndash;<code>FF3F</code></td><td>Wave</td><td>32 four-bit samples, two per byte, <b>high nibble first</b>. Read/write with no mask, while channel 3 is <em>off</em></td></tr>' +
    '</tbody></table>' +
    '<div class="gbemu-example"><b>Example.</b> Writing <code>0x81</code> to NR51 routes channel 1 to the right (bit 0) and channel 4 to the left (bit 7), and nothing else anywhere. Writing <code>0x77</code> to NR50 sets both side volumes to 7, a multiplier of 8; writing <code>0x00</code> sets both to a multiplier of 1, which is one eighth of full, not silence.</div>' +

    '<h4 class="gbemu-sub">B.3: The read-back OR masks, which section 17 calls a hard invariant</h4>' +
    '<div class="gbemu-rule" id="gbr-B-3-1"><b>Rule B.3/1.</b> A processor read of a sound register must return the byte last written to it ORed with that register&rsquo;s mask in this table. Two registers do not follow that form: NR52 (Rule B.3/2), and wave memory while channel 3 is playing (Rule B.10/5).</div>' +
    '<table class="gbemu-table"><thead><tr><th>Mask (ORed onto the written byte at every read)</th><th>Registers</th></tr></thead><tbody>' +
      '<tr><td><code>0x00</code></td><td>NR12, NR22, NR42, NR43, NR50, NR51, and all 16 bytes of wave memory: these read back exactly what was written</td></tr>' +
      '<tr><td><code>0x3F</code></td><td>NR11, NR21: the length load is write-only, the duty reads back</td></tr>' +
      '<tr><td><code>0x70</code></td><td>NR52</td></tr>' +
      '<tr><td><code>0x7F</code></td><td>NR30</td></tr>' +
      '<tr><td><code>0x80</code></td><td>NR10</td></tr>' +
      '<tr><td><code>0x9F</code></td><td>NR32</td></tr>' +
      '<tr><td><code>0xBF</code></td><td>NR14, NR24, NR34, NR44: only the length-enable bit reads back; the trigger and the period bits do not</td></tr>' +
      '<tr><td><code>0xFF</code></td><td>NR13, NR23, NR31, NR33, NR41, the two absent registers <code>FF15</code> and <code>FF1F</code>, and <code>FF27</code>&ndash;<code>FF2F</code></td></tr>' +
    '</tbody></table>' +
    '<div class="gbemu-rule" id="gbr-B-3-2"><b>Rule B.3/2.</b> NR52&rsquo;s low four bits are not storage. A read composes them at the moment of the read from the four channels&rsquo; enabled state (bit <i>n</i> = 1 exactly when channel <i>n</i>+1 is enabled), ORs in the <code>0x70</code> mask and bit 7 (1 while the sound unit is powered). A write to bits 3&ndash;0 changes nothing.</div>' +
    '<div class="gbemu-example"><b>Example.</b> Write <code>0x34</code> to NR11: a read returns <code>0x34 | 0x3F</code> = <code>0x3F</code>. Write <code>0xC0</code> to NR14 (trigger and length enable): a read returns <code>0xC0 | 0xBF</code> = <code>0xFF</code>; write <code>0x80</code> (trigger alone): it returns <code>0xBF</code>. With the unit powered and only channel 2 enabled, NR52 reads <code>0x80 | 0x70 | 0x02</code> = <code>0xF2</code>, whatever was last written to its low bits.</div>' +
    '<div class="gbemu-why"><b>Why.</b> Every sound register reads back its written value ORed with ' +
    'the byte beside it; one Mooneye cartridge sweeps all of them at once, so this is not a table to ' +
    'fill in later. <b>DERIVED</b> and pinned by <code>bits/unused_hwio-GS</code>. ' +
    'Two rows carry a trap. <b>NR52&rsquo;s low four bits are not storage</b>: ' +
    'they are the channels&rsquo; own enable state, composed at the read, so a core that ' +
    'stores and returns the written byte passes the mask sweep and fails every test that asks ' +
    'whether a channel is still playing. And <b>the length loads are write-only</b>, which is why ' +
    'NR11 reads <code>0x3F</code>-ORed and NR31 reads <code>0xFF</code>: an implementer who stores the ' +
    'whole byte and masks on the way out gets the same answer, and that is a legitimate ' +
    'alternative (the observable is the byte, not where you kept it).</div>' +

    '<h4 class="gbemu-sub">B.4: The four duty patterns, and their bit order</h4>' +
    '<div class="gbemu-rule" id="gbr-B-4-1"><b>Rule B.4/1.</b> Each pulse channel (1 and 2) holds a <b>duty position</b> 0&ndash;7. It advances by one ' +
    'every time the channel&rsquo;s period counter expires (Rule B.5/1), from 7 back to 0. The pattern selected by NRx1 bits 7&ndash;6 ' +
    'says whether the output is high or low at that position. <b>Position 0 is the leftmost entry ' +
    'in the table</b>, and the position advances from left to right.</div>' +
    '<table class="gbemu-table"><thead><tr><th>NRx1 7&ndash;6</th><th>Nominal</th><th>Positions 0&ndash;7</th></tr></thead><tbody>' +
      '<tr><td><code>00</code></td><td>12.5%</td><td><code>0 0 0 0 0 0 0 1</code></td></tr>' +
      '<tr><td><code>01</code></td><td>25%</td><td><code>1 0 0 0 0 0 0 1</code></td></tr>' +
      '<tr><td><code>10</code></td><td>50%</td><td><code>1 0 0 0 0 1 1 1</code></td></tr>' +
      '<tr><td><code>11</code></td><td>75%</td><td><code>0 1 1 1 1 1 1 0</code></td></tr>' +
    '</tbody></table>' +
    '<div class="gbemu-rule" id="gbr-B-4-2"><b>Rule B.4/2.</b> When the pattern reads 1 the channel emits its current envelope volume; ' +
    'when it reads 0 it emits digital 0, which is a rail and not silence (section 17). A trigger does not reset the duty position (Rule B.16/4 says what does).</div>' +
    '<div class="gbemu-example"><b>Example.</b> Duty <code>01</code>, volume 9, position 6: the pattern reads 0, so the channel emits digital 0. After the next expiry the position is 7, the pattern reads 1, and the channel emits 9. After the one after that the position wraps to 0, which also reads 1.</div>' +
    '<div class="gbemu-why"><b>Why.</b> <b>The phase matters and the absolute origin does not.</b> ' +
    '<b>The four tables are ' +
    'defined only up to one <em>common</em> rotation</b>: rotate all four by the same amount ' +
    'and shift the position counter to match and nothing is observable. ' +
    'A rotation cannot change how many ones a pattern contains, and these four contain ' +
    '<b>1, 2, 4 and 6</b>, so <b>no two of them are rotations of each other</b>, which is ' +
    'why pattern 3 is pattern 1 <em>inverted</em> rather ' +
    'than rotated. The freedom an implementer has is the common one. What <em>is</em> ' +
    'observable is the relationship between the four (pattern 3 is pattern 1 inverted, not ' +
    'pattern 1 rotated) and the fact that a trigger does <b>not</b> reset the position. ' +
    'Section 16 is entirely about the things that do and do not reset here.</div>' +

    '<h4 class="gbemu-sub">B.5: The four period formulas</h4>' +
    '<div class="gbemu-rule" id="gbr-B-5-1"><b>Rule B.5/1.</b> Each channel&rsquo;s period counter reloads with the value in this table, in T-cycles, and each expiry does what the third column says. For channel 4 the counter is the three-stage counter of section 17; the formula gives the period it produces.</div>' +
    '<table class="gbemu-table"><thead><tr><th>Channel</th><th>Counter reload, in T-cycles</th><th>What one expiry does</th></tr></thead><tbody>' +
      '<tr><td>1 and 2</td><td><code>(2048 &minus; f) &times; 4</code>, where <i>f</i> is the 11-bit value from NRx3 and NRx4 bits 2&ndash;0</td><td>Advance the duty position by one. Eight expiries is one cycle, so the tone is <code>4194304 / (32 &times; (2048 &minus; f))</code> Hz</td></tr>' +
      '<tr><td>3</td><td><code>(2048 &minus; f) &times; 2</code>: <b>half</b> the pulse channels&rsquo;</td><td>Advance the wave position by one <em>nibble</em> and latch that sample. 32 expiries is one cycle</td></tr>' +
      '<tr><td>4</td><td><code>divisor[code] &lt;&lt; shift</code>, with <code>code</code> from NR43 bits 2&ndash;0 and <code>shift</code> from bits 7&ndash;4</td><td>One step of the shift register</td></tr>' +
    '</tbody></table>' +
    '<div class="gbemu-rule" id="gbr-B-5-2"><b>Rule B.5/2.</b> The divisor table is ' +
    '<code>8, 16, 32, 48, 64, 80, 96, 112</code> for codes 0 to 7. Codes 1 to 7 are ' +
    '<code>16 &times; code</code>; <b>code 0 is 8, half of code 1</b>, not zero and not 16.</div>' +
    '<div class="gbemu-example"><b>Example.</b> Channel 1 at <i>f</i> = 1024: the counter reloads with (2048 &minus; 1024) &times; 4 = 4,096&nbsp;T, and eight expiries make 32,768&nbsp;T, a 128&nbsp;Hz tone. Channel 3 at the same <i>f</i> reloads with 2,048&nbsp;T, and its 32 expiries make a 64&nbsp;Hz cycle. Channel 4 with NR43 = <code>0x00</code> (code 0, shift 0) has a period of 8&nbsp;T; with <code>0x21</code> (code 1, shift 2) it has 16 &lt;&lt; 2 = 64&nbsp;T.</div>' +
    '<div class="gbemu-why"><b>Why.</b> The divisor table holds <b>the entry a formula will not give you.</b> Writing it ' +
    'as a formula with a special case for 0 is the same table; writing it as ' +
    '<code>16 &times; code</code> with code 0 clamped to 1 is <em>not</em>, and it is wrong by an ' +
    'octave on the commonest noise setting there is.</div>' +
    '<div class="gbemu-rule" id="gbr-B-5-3"><b>Rule B.5/3.</b> Shift values 14 and 15 get no special case in the period formulas: the formula gives them a period like any other shift. The counter model of section 17 never steps at shift 14 or 15 (Rule 17/13 (c)), so that period is never used.</div>' +
    '<div class="gbemu-why"><b>Why.</b> Shift values 14 and 15 are meaningless on hardware and this core does ' +
    'not special-case them. <b>NOT PINNED</b>: nothing in our corpus reaches them. In the counter model of section 17 the tapped bit at these shifts would be bit 14 or 15 of the 14-bit up-counter, which does not exist, so our shift register does not step at all at shift 14 or 15.</div>' +

    '<h4 class="gbemu-sub">B.6: The shift register</h4>' +
    '<div class="gbemu-rule" id="gbr-B-6-1"><b>Rule B.6/1.</b> The noise channel&rsquo;s shift register has fifteen bits, 0 to 14. One step, in this order:' +
    '<ol class="gbemu-steps"><li>take <code>x</code> = bit 0 exclusive-or bit 1;</li>' +
    '<li>shift the whole register right by one;</li>' +
    '<li>write <code>x</code> into <b>bit 14</b>;</li>' +
    '<li>if NR43 bit 3 is 1, also write <code>x</code> into <b>bit 6</b>, replacing what step 2 put there (this is what makes the sequence short and buzzy).</li></ol>' +
    'A trigger sets all fifteen bits to 1.</div>' +
    '<div class="gbemu-rule" id="gbr-B-6-2"><b>Rule B.6/2.</b> <b>The channel outputs its volume when bit 0 is 0</b>, and digital 0 when bit 0 is 1.</div>' +
    '<div class="gbemu-example"><b>Example.</b> From the trigger value <code>0x7FFF</code>: <code>x</code> = 1 XOR 1 = 0; the shift gives <code>0x3FFF</code>; bit 14 is written 0 and stays <code>0x3FFF</code>; with NR43 bit 3 = 1, bit 6 is written 0 as well, giving <code>0x3FBF</code>. Bit 0 is 1 after that step, so the channel emits digital 0.</div>' +
    '<div class="gbemu-why"><b>Why.</b> Note the inversion in Rule B.6/2: getting it ' +
    'the other way round is inaudible in isolation and wrong in every mix. ' +
    '<b>The label, split: most of Rule B.6/1 is DERIVED and one ' +
    'word of it is not, which is what section 17 says of the same question.</b> ' +
    '<b>DERIVED:</b> the single ' +
    'fifteen-stage register, the bit-0 XOR bit-1 feedback, the right shift, the deposit at bit 14, ' +
    'the inversion at the output, and the all-ones seed. <b>NOT FULLY SETTLED: the one word ' +
    '&ldquo;as well&rdquo;</b> (step 4: bit 6 <em>as well as</em> bit 14). The rival reading (that narrow mode deposits at bit 6 ' +
    '<em>instead</em>, draining the upper stages) is observationally identical to ours for as ' +
    'long as narrow mode is held, so no test that triggers the channel fresh can separate them, and ' +
    'fitted with a free offset both score a perfect 1.0000, <b>which means nothing at all</b>. ' +
    'Section 17 carries the full account. <b>Falsifier, and it is the only one: widen a ' +
    '<em>running</em> channel</b>: nothing in the corpus does.</div>' +

    '<h4 class="gbemu-sub">B.7: Length counters, and the interaction that costs a week</h4>' +
    '<div class="gbemu-rule" id="gbr-B-7-1"><b>Rule B.7/1.</b> <b>Two widths.</b> Channel 3&rsquo;s length counter is <b>8 bits, maximum 256</b>; channels 1, ' +
        '2 and 4 have <b>6 bits, maximum 64</b>. The register field is a <em>load</em>, not the ' +
        'counter: writing <i>v</i> to it sets the counter to <code>max &minus; v</code>.</div>' +
    '<div class="gbemu-rule" id="gbr-B-7-2"><b>Rule B.7/2.</b> On each length-clocking step of the frame sequencer (the even steps 0, 2, 4 and 6; section 15), a channel whose NRx4 bit 6 is 1 and whose counter is above zero decrements its counter by one. A channel whose NRx4 bit 6 is 0 is not decremented. Reaching zero disables the ' +
        'channel; the counter is not reloaded.</div>' +
    '<div class="gbemu-rule" id="gbr-B-7-3"><b>Rule B.7/3.</b> A trigger with the counter at zero reloads it to the maximum. A trigger with the counter above zero leaves it as it is.</div>' +
    '<div class="gbemu-rule" id="gbr-B-7-4"><b>Rule B.7/4.</b> <b>The extra length clock, on enabling.</b> When an NRx4 write meets all three of these conditions, the counter decrements by one at that write:' +
    '<ul class="gbemu-bullets"><li>the write takes the length-enable bit from 0 to 1;</li>' +
    '<li><code>next_clocks_length()</code> (Rule B.14/1) is false, that is, the next sequencer step would not clock length;</li>' +
    '<li>the counter is above zero.</li></ul>' +
    'If that decrement reaches zero and the same write has bit 7 (trigger) clear, the channel is disabled. If the same write is also a trigger, the channel is not disabled and the trigger then runs (Rule B.7/3 reloads the counter from zero to the maximum).</div>' +
    '<div class="gbemu-rule" id="gbr-B-7-5"><b>Rule B.7/5.</b> <b>And the same clock on triggering.</b> After a trigger has run (with its reload of Rule B.7/3), if the counter <em>equals</em> its maximum, length is enabled, and ' +
        '<code>next_clocks_length()</code> is false, the counter is decremented by one. The test is on the counter&rsquo;s value after the trigger, not on whether the trigger reloaded it: a counter already at its maximum (a length write of 0) is decremented in the same way as one the trigger reloaded from zero. This decrement cannot disable the channel, because it cannot reach zero from the maximum.</div>' +
    '<div class="gbemu-example"><b>Example.</b> Channel 1, NR11 length field written 60: the counter is 64 &minus; 60 = 4, and with NR14 bit 6 = 1 the channel is disabled on the fourth length-clocking step after that. NR31 written 0 gives channel 3 a counter of 256. ' +
    '<b>Both arms in one write:</b> channel 2 with its counter at 1 and length disabled; the sequencer has just performed step 0, so the next step (1) does not clock length. The program writes <code>0xC0</code> to NR24 (trigger and length enable). In order: Rule B.7/4 decrements 1 to 0, and the channel is not disabled because the write is a trigger; the trigger reloads 0 to 64 (Rule B.7/3); Rule B.7/5 sees 64 with length enabled and decrements to 63. Read from our source (<code>apu_write_nrx4</code>). The same write made just after step 1 (so the next step, 2, clocks length) changes nothing beyond the trigger: the counter goes 1, then stays 1.</div>' +
    '<div class="gbemu-why"><b>Why.</b> A trigger reloading an empty counter is what makes ' +
        'a bare trigger produce sound at all after a length has run out. <b>Keep &ldquo;does the next step clock length?&rdquo; as a named predicate</b>, not an ' +
        'inline parity test. It is used in both Rules B.7/4 and B.7/5, it is where an off-by-one hides, and ' +
        'section 15 shows it is <em>entailed</em> by the power-on skip rather than independent of ' +
        'it. B.14 writes it out.</div>' +

    '<h4 class="gbemu-sub">B.8: The envelope, and the one value that means &ldquo;never&rdquo;</h4>' +
    '<div class="gbemu-rule" id="gbr-B-8-1"><b>Rule B.8/1.</b> A trigger sets the current volume to NRx2 bits 7&ndash;4 and loads the envelope timer ' +
        'with the pace (NRx2 bits 2&ndash;0), <b>or 8 if the pace is 0</b>.</div>' +
    '<div class="gbemu-rule" id="gbr-B-8-2"><b>Rule B.8/2.</b> On the envelope step of the sequencer (step 7; section 15), a channel whose current <b>pace is 0 does nothing at all</b>: ' +
        'its timer is not counted down and its volume does not change.</div>' +
    '<div class="gbemu-rule" id="gbr-B-8-3"><b>Rule B.8/3.</b> On the envelope step, a channel whose pace is not 0 counts its timer down by one. When the timer then reads 0 or below (a timer that held 0 before this count, as at the hand-over, expires on it), an <b>envelope step</b> happens: the timer reloads with the pace and the volume moves by one in the ' +
        'envelope&rsquo;s direction (NRx2 bit 3: 1 up, 0 down), <b>saturating</b> at 0 and 15: it does not wrap and it ' +
        'does not stop the channel.</div>' +
    '<div class="gbemu-rule" id="gbr-B-8-4"><b>Rule B.8/4.</b> <b>The DAC is the NRx2 byte, not the volume.</b> Channels 1, 2 and 4 have a powered DAC ' +
        'exactly when <code>NRx2 &amp; 0xF8</code> is non-zero: a non-zero initial volume (bits 7&ndash;4) <em>or</em> ' +
        'direction bit 3 set. The pace bits 2&ndash;0 do not count. Channel 3&rsquo;s DAC is NR30 bit 7 alone. Clearing a channel&rsquo;s DAC disables ' +
        'the channel at that write, and a trigger while its DAC is unpowered leaves the channel disabled. Only the enable is withheld: the rest of the trigger still runs (period counter, volume and envelope timer, length reload and extra length clock, first-trigger bits, sweep shadow and check, noise register and start delay, wave position).</div>' +
    '<div class="gbemu-example"><b>Example.</b> NR12 = <code>0xF0</code> (volume 15, decreasing, pace 0), then a trigger: the volume is 15 and the timer is loaded with 8, and the volume stays 15 for as long as the note is held, because no envelope sequencer step touches a pace-0 channel. A build that treated pace 0 as a period of 8 would lower it by one on every eighth envelope sequencer step. NR12 = <code>0xF1</code> (pace 1): the volume falls by one on every envelope sequencer step, 15, 14, &hellip; 0, then stays at 0 with the channel still enabled. NR12 = <code>0x08</code> powers the DAC (bit 3 is set) with volume 0; NR12 = <code>0x07</code> leaves it unpowered, and a trigger then produces nothing.</div>' +
    '<div class="gbemu-why"><b>Why.</b> Pace 0 means the envelope is off, not that ' +
        'its period is 8. The 8 of Rule B.8/1 is a reload value that is then never reached; the two are ' +
        'easy to conflate and the conflation produces a slow fade on every note a game meant to ' +
        'hold. Section 17 is why a cleared DAC ' +
        'is not the same thing as the channel being quiet. ' +
        'Writing NRx2 while the channel plays has a documented glitch with its own arithmetic: ' +
        'B.13 and section 16 have it; it is a refinement of the rules above and not a replacement for ' +
        'them.</div>' +

    '<h4 class="gbemu-sub">B.9: The sweep</h4>' +
    '<div class="gbemu-rule" id="gbr-B-9-1"><b>Rule B.9/1.</b> Channel 1 only. The sweep works on a <b>shadow copy</b> of the period, loaded ' +
    'from the channel&rsquo;s period at each trigger, not on NR13/NR14 directly.</div>' +
    '<div class="gbemu-rule" id="gbr-B-9-2"><b>Rule B.9/2.</b> <b>One calculation is</b> <code>delta = shadow &gt;&gt; shift</code>, then ' +
        '<code>shadow &minus; delta</code> if NR10 bit 3 is 1, <code>shadow + delta</code> ' +
        'if it is 0. <b>Every</b> calculation performs the overflow check: a result above 2047 ' +
        '<b>disables the channel</b> (when the stop lands is given by Rules B.9/3 and B.9/5). A calculation made with NR10 bit 3 = 1 sets the <b>negate-used flag</b> (Rule B.9/6).</div>' +
    '<div class="gbemu-rule" id="gbr-B-9-3"><b>Rule B.9/3.</b> A trigger of channel 1, in this order:' +
    '<ol class="gbemu-steps"><li>loads the shadow from the channel&rsquo;s period;</li>' +
    '<li>reloads the sweep timer with the pace, <b>or 8 if the pace is 0</b>;</li>' +
    '<li>arms the sweep if the pace is non-zero, the shift is non-zero, or both;</li>' +
    '<li>clears the negate-used flag, and cancels any overflow stop still pending from earlier;</li>' +
    '<li><b>only if the shift is non-zero</b>, performs one calculation at once, for its overflow check ' +
        'alone (the result is written nowhere).</li></ol>' +
    'If that calculation overflows, the channel does not stop at the write: <b>immediate is the calculation, not the stop</b>. The stop lands 32&nbsp;T plus two machine cycles&rsquo; worth of sound ticks later (8&nbsp;T at single speed, 4&nbsp;T in double speed), counted on sound ticks from the first sound tick of the trigger write&rsquo;s machine cycle: the same late check section 16 describes for a step, armed here by the trigger write. A later trigger replaces a pending stop with its own check.</div>' +
    '<div class="gbemu-rule" id="gbr-B-9-4"><b>Rule B.9/4.</b> On each sweep step of the frame sequencer (section 15), the sweep timer counts down by one. When it then reads 0 or below (a timer that held 0 before this count expires on it) it reloads with the pace, or 8 if the pace is 0, in the same way. <b>If the pace is 0, or the sweep is not armed, nothing else happens</b>: no calculation, no overflow check, no write-back, whatever the shift. The pace tested is NR10&rsquo;s value at that moment. (The trigger&rsquo;s own check of Rule B.9/3 still runs at pace 0 when the shift is non-zero.) Neither this rule nor Rule B.9/5 tests channel 1&rsquo;s enable: the timer, the calculations and the write-back run on a disabled channel too.</div>' +
    '<div class="gbemu-rule" id="gbr-B-9-5"><b>Rule B.9/5.</b> Otherwise the timer&rsquo;s expiry is a <b>sweep step</b>, in this order:' +
    '<ol class="gbemu-steps"><li>one calculation with its overflow check, <b>whatever the shift is</b> (at shift 0 the delta is the whole shadow);</li>' +
    '<li>if the result is 2047 or less <em>and</em> the shift is non-zero: write the result back to ' +
        'both the shadow and the channel&rsquo;s period (NR13, and NR14 bits 2&ndash;0), <b>then perform a second calculation ' +
        'whose only purpose is its overflow check</b>; its result is written nowhere;</li>' +
    '<li>if the result of step 1 is above 2047, it is <b>written back nowhere</b> (not to ' +
        'the shadow, not to NR13/NR14), so the shadow freezes and every later step recomputes ' +
        'the same overflow.</li></ol>' +
    'The write-back of step 2 takes effect at the sweep step itself. The second calculation&rsquo;s stop lands 32&nbsp;T late (section 16). The timing of the stop ordered by step 1 is also section 16&rsquo;s.</div>' +
    '<div class="gbemu-rule" id="gbr-B-9-6"><b>Rule B.9/6.</b> A write to NR10 that clears the direction bit (bit 3 from 1 to 0) while the negate-used flag is set disables the channel. The flag is set by any calculation made with bit 3 = 1 (Rule B.9/2) and cleared at every trigger.</div>' +
    '<div class="gbemu-example"><b>Example.</b> Shadow 1024, NR10 = <code>0x11</code> (pace 1, increase, shift 1). Sweep step: 1024 + 512 = 1536, which fits and the shift is non-zero, so 1536 goes to the shadow and the period; the second calculation gives 1536 + 768 = 2304, above 2047, so the channel stops, 32&nbsp;T late. ' +
    '<b>The two guards differ.</b> Shadow 1100, NR10 = <code>0x10</code> (pace 1, increase, shift 0). The trigger performs no calculation (shift 0), so the channel survives the trigger. At the first sweep step the calculation still runs: 1100 + 1100 = 2200, above 2047, so the step stops the channel and writes nothing. With NR10 = <code>0x01</code> (pace 0, shift 1) and a shadow of 1500, the trigger calculates 1500 + 750 = 2250 and stops the channel late, but a sweep timer expiry at pace 0 calculates nothing. ' +
    '<b>Negate-used:</b> NR10 = <code>0x19</code> (pace 1, decrease, shift 1), trigger: the trigger&rsquo;s calculation is a decreasing one, so the flag is set; a later write of <code>0x11</code> to NR10 disables the channel.</div>' +
    '<div class="gbemu-why"><b>Why.</b> The shadow is what makes a ' +
    'period written mid-sweep behave the way it does. The trigger&rsquo;s check is how a trigger can kill the channel before a single sweep step has been ' +
        'clocked. Rule B.9/3&rsquo;s late stop is read from our source (the trigger calls the late check with the write&rsquo;s lead of two cycles). ' +
    'Rule B.9/4 is what makes pace 0 mean &ldquo;never&rdquo; rather than &ldquo;immediately&rdquo;; MECHANISM, read from our source (<code>apu_sweep_tick</code>). ' +
    'In Rule B.9/5 the two calculations per step are both required, and the second one ' +
        'is not optional. <b>The written-back-nowhere arm: LABEL: NOT MEASURED, and it is a choice between two different ' +
        'machines rather than a rounding difference.</b> Section 5&rsquo;s station 03 is the bench ' +
        'station designed for exactly this question and <b>nothing has been captured there; no console ' +
        'has been asked</b>. The live rival is that the sweep keeps clocking and keeps writing back ' +
        'the truncated result. <b>Nothing in either large processor suite reaches this case and both ' +
        'rules pass on our core</b>, so no row on this board can tell you which you built. ' +
        '<b>What would settle ' +
        'it:</b> station 03 run on silicon. ' +
    '<b>The overflow check on a step is NOT gated on the shift, and the one on a trigger ' +
        'is.</b> Stated because Rule B.9/3 gives the trigger&rsquo;s <em>&ldquo;if the shift ' +
        'is non-zero&rdquo;</em> guard and an implementer will carry it across and lose the kill. On a ' +
        'sweep step the calculation and its overflow check run <b>whatever the shift is</b>; only ' +
        'the write-back carries the non-zero-shift condition. <b>At shift 0 the delta is the whole ' +
        'shadow</b>, so an increasing sweep computes twice the shadow, and a shadow above 1023 ' +
        'overflows and disables the channel on a step that writes nothing. A core that guards the ' +
        'step&rsquo;s check the way the trigger&rsquo;s is guarded never fires that kill. ' +
        '<b>MECHANISM</b> as a structural statement about the two paths; the <em>step</em> ' +
        'arm is read from our own source. ' +
    'Rule B.9/6: one flag, cleared at every trigger.</div>' +
    '<div class="gbemu-why"><b>Why (timing).</b> Section 16 adds the <em>timing</em>. Of a sweep step&rsquo;s effects, <b>the 32&nbsp;T delay belongs to the second overflow ' +
    'check alone</b>: 8 cycles, 32&nbsp;T, declared in the cartridge&rsquo;s ' +
    'own comment. The frequency <em>write</em> is on time. The rules above are the mechanism; that ' +
    'one delay is the refinement. ' +
    '<b>The rival reading (that the two overflow stops are ' +
    '<em>both</em> declared late by the cartridge that tests them) is refuted with ' +
    'evidence rather than merely disagreed with:</b> had the whole sweep event been late, eight ' +
    'declared cells would still carry the old oscillation, and they do not. An implementer who ' +
    'implements the both-late reading loses exactly those eight cells.</div>' +

    '<h4 class="gbemu-sub">B.10: Wave memory and its volume shift</h4>' +
    '<div class="gbemu-rule" id="gbr-B-10-1"><b>Rule B.10/1.</b> Wave memory is 32 samples of four bits at <code>FF30</code>&ndash;<code>FF3F</code>, <b>high nibble ' +
        'first</b>: position 0 is the high nibble of <code>FF30</code>, position 1 its low nibble, and so on to position 31, the low nibble of <code>FF3F</code>.</div>' +
    '<div class="gbemu-rule" id="gbr-B-10-2"><b>Rule B.10/2.</b> A trigger sets the wave position to 0. Each expiry of channel 3&rsquo;s period counter first advances the position by one and then reads the sample there (Rule B.5/1), so the first read happens one period ' +
        'after the trigger and <b>the first sample a freshly triggered channel emits is position 1, not ' +
        'position 0</b>.</div>' +
    '<div class="gbemu-rule" id="gbr-B-10-3"><b>Rule B.10/3.</b> <b>The output level is a right shift, and mute is not shift 3.</b> With <code>level</code> = NR32 bits ' +
        '6&ndash;5, the channel emits <code>level ? (sample &gt;&gt; (level &minus; 1)) : 0</code>:' +
    '<table class="gbemu-table"><thead><tr><th>Level (NR32 bits 6&ndash;5)</th><th>Channel 3 emits (digital, 0&ndash;15)</th></tr></thead><tbody>' +
      '<tr><td>0</td><td>0, whatever the sample</td></tr>' +
      '<tr><td>1</td><td>the sample</td></tr>' +
      '<tr><td>2</td><td>the sample shifted right by 1</td></tr>' +
      '<tr><td>3</td><td>the sample shifted right by 2</td></tr>' +
    '</tbody></table></div>' +
    '<div class="gbemu-example"><b>Example.</b> <code>FF30</code> = <code>0x1F</code>. After a trigger, the first sample emitted is position 1, the low nibble, 15 (not 1). At level 1 the channel emits 15, at level 2 it emits 7, at level 3 it emits 3, and at level 0 it emits 0. Shifting 15 right by 3 would give 1, which is why mute cannot be written as a fourth shift.</div>' +
    '<div class="gbemu-rule" id="gbr-B-10-4"><b>Rule B.10/4.</b> <b>Wave memory survives a power-off of the sound unit</b> and stays readable and ' +
        'writable while the unit is off, though every other register is zeroed (section 17).</div>' +
    '<div class="gbemu-rule" id="gbr-B-10-5"><b>Rule B.10/5.</b> While channel 3 is <em>playing</em>, wave memory belongs to the channel. On this machine ' +
        'a processor read returns <code>0xFF</code> and a processor write is dropped, except inside the one-tick ' +
        'window section 17 gives, where the read returns the byte holding the current sample and the write lands on the byte about to be read. (The Colour behaves differently: Colour tab, section 13.)</div>' +
    '<div class="gbemu-why"><b>Why.</b> Rule B.10/2 is the mechanism behind the delay section 17 measures. ' +
        'Rule B.10/3 is <b>MECHANISM</b>, and the reason it is worth writing that way is that the four cases are ' +
        'not four shifts.</div>' +

    '<h4 class="gbemu-sub">B.11: Power, and what a power-off destroys</h4>' +
    '<div class="gbemu-rule" id="gbr-B-11-1"><b>Rule B.11/1.</b> Writing NR52 bit 7 to 0 <b>zeroes every register from <code>FF10</code> to ' +
        '<code>FF25</code></b> (NR10 through NR51), and while the unit stays off writes to them are ignored, ' +
        '<b>with one exception inside that range</b>: Rule B.11/2. Two registers that are ' +
        'often listed as the exceptions lie <em>outside</em> that range altogether and are simply ' +
        'unaffected: <b>NR52 is <code>FF26</code></b> and <b>wave memory is ' +
        '<code>FF30</code>&ndash;<code>FF3F</code></b>. The same write acts on the internal state as follows:' +
    '<ul class="gbemu-bullets"><li><b>Zeroed:</b> each channel&rsquo;s enable flag, DAC, length enable, internal period, period counter (which then runs on at internal period 0, Rule 17/23), duty in force, pending and staged duty, duty position, current volume, envelope fields and timer, extra envelope flag (Rule B.13/6) and output; the sweep&rsquo;s pace, direction, shift, shadow, timer, armed state, negate-used flag and the three countdowns of Rules 16/6 and 16/9; channel 3&rsquo;s output level and current sample; channel 4&rsquo;s NR43 fields; the master volumes and routing; the skip flag (Rule 15/5).</li>' +
    '<li><b>Not touched:</b> the length counters on the original (Rule 17/17); the noise shift register, until a trigger; the wave position, the step counter, the first-trigger bits (Rule B.16/6), the sample clock of Rule 16/4, the noise stages of Rule 17/13 and the noise start delay (Rule B.15/2), until the power-on resets them. A deferred NR43 write lands in its own machine cycle (Rule 15/6, step 6), so none is left over at this write.</li></ul></div>' +
    '<div class="gbemu-rule" id="gbr-B-11-2"><b>Rule B.11/2.</b> <b>On this machine the length counters are unaffected by a power-off, and their load registers stay ' +
        'writable while the unit is off</b>: NR11 <code>FF11</code>, NR21 <code>FF16</code>, ' +
        'NR31 <code>FF1B</code>, NR41 <code>FF20</code> specifically, <b>all four inside the range ' +
        'Rule B.11/1 zeroes</b>. Such a write reaches ' +
        'the <em>length counter</em> and nothing else (the counter becomes <code>max &minus; v</code>, Rule B.7/1). The register byte is not stored while ' +
        'the unit is off, so the duty bits of NR11 and NR21 in the same write do not land. On the ' +
        'Colour the whole write is discarded, and a power-off clears the counters (section 17).</div>' +
    '<div class="gbemu-rule" id="gbr-B-11-3"><b>Rule B.11/3.</b> Powering the unit on while the sequencer&rsquo;s divider bit is already high makes it ' +
        'skip the first sequencer event (section 15). The skip is one bit of state, armed at that power-on and consumed by the first event; it is not implemented by clearing the stored divider bit.</div>' +
    '<div class="gbemu-example"><b>Example.</b> With the unit off, write <code>0xBC</code> to NR11 (duty 2, length 60): channel 1&rsquo;s length counter becomes 64 &minus; 60 = 4, and NR11 still holds 0, so after the unit is powered on and channel 1 triggered, the duty is 0 (pattern <code>00</code>), not 2. The same write to NR10 while the unit is off does nothing at all.</div>' +
    '<div class="gbemu-why"><b>Why.</b> Naming NR52 and wave memory as the exceptions to ' +
        '<code>FF10</code>&ndash;<code>FF25</code> makes the list read as exhaustive, when the one ' +
        'real in-range exception is Rule B.11/2 and the four registers it names all sit ' +
        'inside the range Rule B.11/1 zeroes. Section 17 has the cartridge pair that declares Rule B.11/2 a device ' +
        'split and says the Colour clears the counters. <b>And the exception is narrower than ' +
        '&ldquo;writable&rdquo; suggests, which an implementer needs</b>: only the counter is reached. <b>Read from our own source</b>, and the device split ' +
        'is a compile-time switch there rather than a measurement. Rule B.11/3 is one bit of state, not a cleared bit.</div>' +

    '<h4 class="gbemu-sub">B.12: From four digital values to two numbers</h4>' +
    '<div class="gbemu-rule" id="gbr-B-12-1"><b>Rule B.12/1.</b> ' +
    'Each channel produces a digital value 0&ndash;15. Its DAC, if powered (Rule B.8/4), maps that to ' +
    '<code>2d &minus; 15</code>, i.e. &minus;15 to +15; an unpowered DAC contributes <b>exactly ' +
    'zero</b>, which is the midpoint and not a rail. The routing byte NR51 selects which of the four ' +
    'sums into each side, giving &minus;60 to +60, and the master volume field of NR50 multiplies by ' +
    '<code>value + 1</code>, 1 to 8, so each side lands in <b>&minus;480 to +480</b>.</div>' +
    '<div class="gbemu-example"><b>Example.</b> Left side: channel 1 powered and emitting 15 (+15), channel 2 powered and emitting 0 (&minus;15), channel 3&rsquo;s DAC unpowered (0), channel 4 not routed left; NR50 left volume 7. The left side is (15 &minus; 15 + 0) &times; 8 = 0. Power channel 3&rsquo;s DAC with its output at 0 and the same side becomes (&minus;15) &times; 8 = &minus;120: switching a DAC on moves the level, while a powered channel going quiet only moves it to its rail.</div>' +
    '<div class="gbemu-why"><b>Why.</b> The path, end to end, so that the figures in section 17 have units. ' +
    'That is where section 17&rsquo;s &minus;0.75 idle level and its <b>24,575</b>-unit underrun ' +
    'step come from; both are this arithmetic, not a measurement. <b>The second figure is on the ' +
    'output scale, not this one:</b> the mixer&rsquo;s own domain is &plusmn;480, and the measuring ' +
    'sample is <code>(side &times; 32767) / 480</code>, so 0.75 of full scale is ' +
    '<code>0.75 &times; 32767 = 24,575.25</code>, truncating to <b>24,575</b>, which is the ' +
    'figure section 17 quotes. The host path that plays (Rule B.12/3) divides by 960, not 480: after its output capacitor a side can swing from one rail to the other, twice the mixer&rsquo;s &plusmn;480, so 960 maps to 32,767, the output can never clip, and it plays at half the measuring level.</div>' +
    '<div class="gbemu-rule" id="gbr-B-12-2"><b>Rule B.12/2.</b> What is <em>not</em> free is the polarity and the DAC rule of Rule B.12/1: a build must not emit an unsigned 0&ndash;15 per channel. The scaling after the &plusmn;480 sum is free (Rule B.12/3 gives ours).</div>' +
    '<div class="gbemu-why"><b>Why.</b> An implementer may scale differently, or mix in floating point, and nothing ' +
    'on the board can tell: the board scores framebuffers and declared tables, not samples. ' +
    'Emit an unsigned 0&ndash;15 and ' +
    'you have conflated &ldquo;quiet&rdquo; with &ldquo;off&rdquo;, and the two diverge at exactly ' +
    'the moment a game switches a DAC.</div>' +
    '<div class="gbemu-rule" id="gbr-B-12-3"><b>Rule B.12/3.</b> <b>Our host output path</b> (no board row depends on it; a build that wants our audio must match it). Once per ' +
    'sound tick (two T-cycles), for each side, on the &plusmn;480 sum, before the samples are ' +
    'averaged and scaled:' +
    '<ol class="gbemu-steps"><li><code>out = in &minus; charge</code>;</li>' +
    '<li><code>charge = in &minus; out &times; 0.999916001764</code>.</li></ol>' +
    'The charge starts at 0 at reset. Each <code>out</code> is truncated to an integer and added to a running sum for its side. At each host sample the sum is divided by the number of sound ticks it holds, a plain average over that host sample&rsquo;s period, and is then emptied. The host sample is that average scaled to the host range, <code>(average &times; 32767) / 960</code> (the Why box under Rule B.12/1 gives why 960), truncating toward zero once across the division and the scale, and ' +
    '<b>saturated at &plusmn;32,767, never wrapped</b>. ' +
    '<b>Every figure on this page, including the &minus;0.75 and the 24,575 above, is taken before ' +
    'this stage</b>: the measuring path reads the raw sum by design, so an implementer comparing sound ' +
    'figures with this page must compare the raw sum too.</div>' +
    '<div class="gbemu-why"><b>Why.</b> <b>One more stage, on the host path only: the output capacitor.</b> The console&rsquo;s sound leaves through a coupling capacitor, so ' +
    'no direct current reaches the jack, and without one a quiet machine with powered DACs plays ' +
    'as a sample stuck at &minus;0.75 of full scale. Ours is a one-pole block. ' +
    'The factor is a published per-T-cycle figure (0.999958) squared for the two-T tick, so ' +
    'it does not depend on the host&rsquo;s sample rate. Because a centred signal can swing to ' +
    'twice the half-range (a full step up after a long silence at the rail), the scaled sample must be ' +
    'saturated. Labels: the capacitor is MECHANISM; the ' +
    'factor is taken from the documentation and its magnitude is not established by us.</div>' +

    '<h4 class="gbemu-sub">B.13: The envelope write glitch, with every constant in it</h4>' +
    '<div class="gbemu-rule" id="gbr-B-13-1"><b>Rule B.13/1.</b> <b>A write to NRx2 of channel 1, 2 or 4 while that channel is enabled does not ' +
    'merely store the new fields</b>. First it changes the live volume; then the fields are stored (Rule B.13/5). The change is ' +
    'computed from the <em>old</em> pace and direction, read from the channel&rsquo;s live state ' +
    'rather than from any register shadow: the direction and pace fields the previous NRx2 write stored (Rule B.13/5), with no separate latch. Which formula applies is decided by the old pace (the low three bits of the old value):' +
    '<ul class="gbemu-bullets"><li>old pace non-zero: <b>Case 1</b>, Rule B.13/2;</li><li>old pace zero: <b>Case 2</b>, Rule B.13/3.</li></ul></div>' +
    '<div class="gbemu-why"><b>Why, and the evidence both cases are read off.</b> Section 16 says our deviation from the documented rule exists and that ' +
    '<i>&ldquo;every constant in it is the documentation&rsquo;s&rdquo;</i>; the constants are here. ' +
    '<b>MECHANISM, and the three lines below are the documentation&rsquo;s own ' +
    'words:</b> <i>&ldquo;If the old envelope period was zero and the envelope is still doing ' +
    'automatic updates, volume is incremented by 1; otherwise, if the envelope was in decrease mode, ' +
    'volume is incremented by 2. If the mode was changed (increase to decrease, or decrease ' +
    'to increase) volume is set to 16 minus volume. Only the low 4 bits of volume are kept ' +
    'after the above operations.&rdquo;</i> So the documentation&rsquo;s adjustment is ' +
    '<code>adj = (old_pace == 0) ? 1 : (old_direction == increase ? 0 : 2)</code>, and the constants ' +
    '1, 2, 16 and the four-bit mask are the documentation&rsquo;s, not ours. ' +
    'Our one deviation from the prose in Case 1 is ' +
    '<b>DERIVED from a declared table</b> rather than swept. The glitch cartridge declares its own ' +
    'expected results, and its first row is taken before the first sequencer step so it isolates ' +
    'the write&rsquo;s effect with no envelope tick mixed in:' +
    '<table class="gbemu-table"><thead><tr><th>Old</th><th>New</th><th>Required volume</th><th>What the prose computes</th><th>Verdict</th></tr></thead><tbody>' +
      '<tr><td><code>$20</code></td><td><code>$20</code></td><td>2</td><td>+1 or +2 &rarr; 3 or 4</td><td><b>unchanged</b></td></tr>' +
      '<tr><td><code>$08</code></td><td><code>$08</code></td><td>1</td><td>+1 &rarr; 1</td><td>agrees</td></tr>' +
      '<tr><td><code>$22</code></td><td><code>$22</code></td><td>2</td><td>+2 &rarr; 4</td><td><b>unchanged</b></td></tr>' +
      '<tr><td><code>$32</code></td><td><code>$32</code></td><td>3</td><td>+2 &rarr; 5</td><td><b>unchanged</b></td></tr>' +
      '<tr><td><code>$20</code></td><td><code>$08</code></td><td>13</td><td>+1 then flip &rarr; 13</td><td>agrees</td></tr>' +
      '<tr><td><code>$08</code></td><td><code>$47</code></td><td>15</td><td>+1 then flip &rarr; 15</td><td>agrees</td></tr>' +
      '<tr><td><code>$22</code></td><td><code>$08</code></td><td>12</td><td>+2 then flip &rarr; 12</td><td>agrees</td></tr>' +
      '<tr><td><code>$08</code></td><td><code>$32</code></td><td>15</td><td>+1 then flip &rarr; 15</td><td>agrees</td></tr>' +
    '</tbody></table>' +
    '<b>The three disagreements are exactly the three writes that leave the ' +
    'direction bit alone with the old direction set to decrease</b>: ' +
    '<code>$20</code>&rarr;<code>$20</code>, <code>$22</code>&rarr;<code>$22</code> and ' +
    '<code>$32</code>&rarr;<code>$32</code>, the three rows the table marks <b>unchanged</b>. Hence ' +
    'the commit condition <b>for Case 1</b> (Rule B.13/2): compute the adjustment as the prose computes it, and ' +
    'commit it only when the direction changed or the old direction was increase. ' +
    '<b>That table is a mixed table, not a Case 1 table, and which case a ' +
    'row belongs to is read off the <em>old</em> pace.</b> <b>Five of its eight rows have an old pace of zero</b> ' +
    '(every row whose old value is <code>$20</code> or <code>$08</code>), which makes them ' +
    '<b>Case 2</b>. That includes <code>$20</code>&rarr;<code>$20</code>, one of the three writes ' +
    'Case 1&rsquo;s predicate selects, so <b>only two of the three ' +
    '<code>unchanged</code> rows are Case 1 rows</b> (<code>$22</code>&rarr;<code>$22</code> and ' +
    '<code>$32</code>&rarr;<code>$32</code>). The three-disagreements sentence is still <em>true</em> as a ' +
    'statement about the table (exactly three rows leave the direction bit alone with the ' +
    'old direction set to decrease, and those three are the three marked unchanged) and ' +
    '<b>every row of it is correct under the case it belongs to</b>, which is why the three ' +
    'verdicts stand. What the table is not is Case 1&rsquo;s evidence on its own. ' +
    '<b>The two cases do not agree on every row of it, and that disagreement ' +
    'is the whole reason the case split exists.</b> Evaluated row by row, the two rules agree on ' +
    'all <b>five</b> Case 2 ' +
    'rows (<code>$20</code>&rarr;<code>$20</code>, <code>$08</code>&rarr;<code>$08</code>, ' +
    '<code>$20</code>&rarr;<code>$08</code>, <code>$08</code>&rarr;<code>$47</code>, ' +
    '<code>$08</code>&rarr;<code>$32</code>) and <b>disagree on all three Case 1 rows</b>: ' +
    '<code>$22</code>&rarr;<code>$22</code> requires 2 and Case 2&rsquo;s rule gives 1, ' +
    '<code>$32</code>&rarr;<code>$32</code> requires 3 and gives 2, and ' +
    '<code>$22</code>&rarr;<code>$08</code> requires 12 and gives 13, because Case 2 reads ' +
    'the adjustment off <code>live</code> where Case 1 reads it off the <em>old pace and ' +
    'direction</em>, which on these rows is 2 and not 1. <b>A page that said the two cases agree ' +
    'everywhere would be saying the split does not matter.</b></div>' +
    '<div class="gbemu-rule" id="gbr-B-13-2"><b>Rule B.13/2.</b> <b>Case 1: the old pace was non-zero.</b> Let <code>adj</code> = 0 if the old direction was increase and 2 if it was decrease (the documentation&rsquo;s adjustment for a non-zero old pace). Then:' +
    '<table class="gbemu-table"><thead><tr><th>Direction bit 3, old against new</th><th>Old direction</th><th>New volume (4 bits)</th></tr></thead><tbody>' +
      '<tr><td>changed</td><td>either</td><td><code>(16 &minus; (volume + adj)) &amp; 15</code></td></tr>' +
      '<tr><td>unchanged</td><td>increase</td><td><code>(volume + adj) &amp; 15</code></td></tr>' +
      '<tr><td>unchanged</td><td>decrease</td><td><b>nothing is committed</b>: the volume is left exactly as it was</td></tr>' +
    '</tbody></table>' +
    'The commit condition &ldquo;only when the direction changed or the old direction was increase&rdquo; is Case 1&rsquo;s alone; it does not apply to Case 2.</div>' +
    '<div class="gbemu-example"><b>Example.</b> Volume 2, old <code>$22</code> (decrease, pace 2), new <code>$22</code>: direction unchanged and old direction decrease, so the volume stays 2 (the prose would give 4). Old <code>$22</code>, new <code>$08</code>, volume 2: direction changed, <code>adj</code> = 2, (16 &minus; 4) &amp; 15 = 12. Old <code>$2A</code> (increase, pace 2), new <code>$2A</code>, volume 2: <code>adj</code> = 0, so (2 + 0) &amp; 15 leaves 2.</div>' +
    '<div class="gbemu-why"><b>Why.</b> The third row of Rule B.13/2&rsquo;s table is our one deviation from the prose. ' +
    '<b>The commit condition is Case 1&rsquo;s, not the ' +
    'rule&rsquo;s: Case 2 contradicts it outright.</b> Read as a general condition ' +
    '(<em>commit only when the direction changed or the old direction was increase</em>) ' +
    'it is refuted by Case 2&rsquo;s own third row, <code>D1&nbsp;=&nbsp;0, ' +
    'D2&nbsp;=&nbsp;0, P2&nbsp;=&nbsp;1</code>, where the direction is unchanged, the old direction ' +
    'is decrease, and the required volume is <code>V&nbsp;&minus;&nbsp;1</code>: something is ' +
    'committed. <b>An implementer who takes the condition as the rule loses every Case 2 step-down.</b> ' +
    '<b>The transferable part:</b> a ' +
    'predicate stated at the end of one case, in a subsection whose next paragraph opens another ' +
    'case, reads as the subsection&rsquo;s conclusion unless it says which case it belongs to.</div>' +
    '<div class="gbemu-rule" id="gbr-B-13-3"><b>Rule B.13/3.</b> <b>Case 2: the old pace was zero.</b> Let <code>live = (new_value &amp; 0x0F) != 0</code> (the new direction or the new pace is non-zero). Then:' +
    '<ul class="gbemu-bullets"><li>direction bit ' +
    '<b>changed</b>: <code>volume = (16 &minus; (volume + (live ? 1 : 0))) &amp; 15</code>;</li>' +
    '<li>direction bit <b>unchanged</b> and <code>live</code>: ' +
    '<code>volume = (volume + (old_direction == increase ? +1 : &minus;1)) &amp; 15</code>;</li>' +
    '<li>otherwise nothing.</li></ul>' +
    'With <code>D1</code> the old direction, <code>D2</code> the new (1 = increase) and ' +
    '<code>P2</code> the new pace, and <code>V</code> the volume before the write:' +
    '<table class="gbemu-table"><thead><tr><th><code>D1</code> (old direction, 1 = increase)</th><th><code>D2</code> (new direction)</th><th><code>P2</code> (new pace: 0, or 1 for any non-zero pace)</th><th>Required (4 bits)</th></tr></thead><tbody>' +
      '<tr><td>0</td><td>0</td><td>0</td><td><code>V</code>: no step, no flip</td></tr>' +
      '<tr><td>1</td><td>0</td><td>0</td><td><code>16 &minus; V</code>: flip only</td></tr>' +
      '<tr><td>0</td><td>0</td><td>1</td><td><code>V &minus; 1</code>: step down</td></tr>' +
      '<tr><td>1</td><td>0</td><td>1</td><td><code>16 &minus; (V + 1)</code>: step folded into the complement</td></tr>' +
      '<tr><td>0</td><td>1</td><td>any</td><td><code>16 &minus; (V + 1)</code></td></tr>' +
      '<tr><td>1</td><td>1</td><td>any</td><td><code>V + 1</code>: step up</td></tr>' +
    '</tbody></table></div>' +
    '<div class="gbemu-example"><b>Example.</b> Volume 5, old <code>$50</code> (decrease, pace 0). New <code>$51</code>: unchanged, live, decrease, so 4. New <code>$50</code>: not live, so 5. New <code>$58</code>: changed and live, (16 &minus; 6) &amp; 15 = 10. From old <code>$58</code> (increase, pace 0) to new <code>$50</code>: changed, not live, 16 &minus; 5 = 11. Volume 15, old <code>$F8</code> (increase, pace 0), new <code>$F8</code>: unchanged, live, increase, so (15 + 1) &amp; 15 = 0. It wraps; it does not stop at 15.</div>' +
    '<div class="gbemu-why"><b>Why.</b> <b>DERIVED from a second ' +
    'declared table</b>, all 128 cells of a volume cartridge with the divider reset first so no ' +
    'sequencer step intervenes. Read as behaviour: <b>the step happens exactly when the write leaves ' +
    'that nibble non-zero, it goes in the envelope&rsquo;s own direction, and it wraps in four bits ' +
    'rather than saturating.</b> The documentation&rsquo;s unconditional &ldquo;+1&rdquo; is that ' +
    'same step seen only through the direction-change cases; taken literally it gets two of the ' +
    'eight rows wrong. The cartridge writes new pace 0 or 1 only; Rule B.13/3 treats any non-zero pace as 1 (read from our source, <code>apu_write_nrx2</code>).</div>' +
    '<div class="gbemu-rule" id="gbr-B-13-4"><b>Rule B.13/4.</b> <b>Masking.</b> Every committed ' +
    'result of Rules B.13/2 and B.13/3 is masked to four bits: it <b>wraps</b>. The <em>ordinary</em> envelope ' +
    'step of Rule B.8/3 does <b>not</b> wrap: it saturates, stopping ' +
    'at 15 going up and 0 going down. <b>Two different rules on the same variable; implement ' +
    'both.</b></div>' +
    '<div class="gbemu-rule" id="gbr-B-13-5"><b>Rule B.13/5.</b> <b>What the write stores, whatever it did to the volume.</b> After the volume change, the ' +
    'register fields are stored unconditionally: initial volume from bits 7&ndash;4, ' +
    'direction from bit 3, pace from bits 2&ndash;0. <b>The initial volume is a shadow</b>: a ' +
    'write while the channel runs never loads it into the live volume; only a trigger does (Rule B.8/1). The ' +
    'DAC is set on the same write (Rule B.8/4): it is powered exactly when the upper five bits are non-zero, so ' +
    'writing a value that clears them <b>disables the channel immediately</b>.</div>' +
    '<div class="gbemu-rule" id="gbr-B-13-6"><b>Rule B.13/6.</b> <b>Enabling the envelope schedules one extra envelope step.</b> ' +
    '<b>A write to the NRx2 register of an enabled channel that takes the ' +
    'pace from zero to non-zero arms a one-shot flag</b> for that channel. A trigger does not arm this flag and does not clear it; a power-off clears it (Rule B.11/1). The flag is consumed at the next sequencer step ' +
    'that does <em>not</em> clock length (Rule B.13/7 gives which steps those are): the flag is cleared and a full ' +
    'envelope step (Rule B.8/3) is performed, meaning the volume steps <em>and</em> the envelope timer reloads, as though the timer had expired. It runs whether or not the channel is still enabled, and with the fields stored at that moment: if a later NRx2 write took the pace back to 0, the volume still moves and the timer reloads with 0. On step 7, where the regular envelope tick of Rule B.8/2 and B.8/3 also falls, both run, the extra step first: the regular tick then counts down the timer the extra step has just reloaded, so it changes the volume a second time only at pace 1. We apply this to channels 1, 2 and 4.</div>' +
    '<div class="gbemu-rule" id="gbr-B-13-7"><b>Rule B.13/7.</b> <b>Our sequencer step numbering, and the parity it fixes.</b> ' +
    'Our step counter sits at 7 across a power-on and is incremented ' +
    'before the step runs, so the first event after a power-on with the divider bit low is step 0, ' +
    'a length step, and the first envelope step is the eighth event (step 7). Length runs on the even steps 0, 2, 4, 6. In this numbering the flag of Rule B.13/6 is consumed on the odd steps 1, 3, 5, 7, the steps at which we do <em>not</em> clock length.</div>' +
    '<div class="gbemu-example"><b>Example.</b> Channel 2 enabled at volume 10, NR22 = <code>$A0</code> (decrease, pace 0). Just after step 4 the program writes <code>$A1</code> (pace 1). Rule B.13/3: unchanged direction, live, decrease, so the volume becomes 9; the flag is armed. Step 5 (odd): the flag is consumed, the timer reloads with 1 and the volume becomes 8. Step 6: nothing. Step 7: the regular tick counts the timer from 1 to 0, so an envelope step brings the volume to 7. Had the write come just after step 6 instead, step 7 would run the extra step (9 to 8, timer 1) and then the regular tick (timer to 0, 8 to 7): two changes on one step, because the pace is 1. At pace 2 the regular tick would only count the timer from 2 to 1.</div>' +
    '<div class="gbemu-why"><b>Why.</b> Cartridge-declared, ' +
    'in the cartridge&rsquo;s own header: <i>&ldquo;Enabling the envelope triggers an APU bug ' +
    '. In the next even DIV-APU tick the APU will tick the volume envelope of that channel, ' +
    'even if it would not tick the volume envelope at that tick otherwise.&rdquo;</i> The order on step 7 is MECHANISM, read from our source (<code>apu_frame_step</code> consumes the flag before it calls <code>apu_env_tick</code>). The parity of ' +
    '&ldquo;even&rdquo; against your own step numbering is a free convention; ours is fixed by a ' +
    'cartridge that writes the same test at two alignments a known distance apart. <b>Do not assume ' +
    'an origin: derive your parity from a declared table</b>, as section 15 already says. ' +
    '<b>The cartridge is <code>channel_2_nrx2_speed_change</code> and the two declared tables are ' +
    'its Tests 6 and 7</b>: Test 6 writes the envelope register half a sequencer period before a ' +
    'step, Test 7 writes it right at one, and both declare the extra tick landing at the <em>same ' +
    'absolute time</em>. Two of our steps after the first write and one after the second, ' +
    'which is to say on the steps at which we do <em>not</em> clock length. That is what fixes the ' +
    'parity, and it is why our flag is consumed on the odd steps. <b>The origin is ' +
    'restated here rather than deferred, because B.15&rsquo;s rule is that a quantity that ' +
    'admits two readings needs one shipped representative stated in every place it appears.</b> ' +
    'Section 15 carries the ' +
    'enumeration of the four observable classes that makes that checkable against your own core. ' +
    '<b>One honest gap.</b> Whether that extra tick reaches the noise channel ' +
    'as well is <b>NOT ESTABLISHED</b>: nothing declares it, the sound suite ships no noise row that ' +
    'would separate the two settings, and turning it off for noise would be fitted to our audio ' +
    'instrument and must not be landed as a mechanism. <b>We ship it on for all three.</b> And a ' +
    '<b>revision caveat that belongs beside the rule</b>: the glitch cartridge&rsquo;s own header ' +
    'says the behaviour <i>&ldquo;appears to be different across revisions&rdquo;</i>, and the ' +
    'documentation paragraph the constants come from is scoped to particular Colour revisions. Our ' +
    'board is scored on one of them. Matching this table is correct for that revision and is ' +
    '<b>convergence with a revision</b>, not a statement about every console.</div>' +

    '<h4 class="gbemu-sub">B.14: The length predicate, written out</h4>' +
    '<div class="gbemu-rule" id="gbr-B-14-1"><b>Rule B.14/1.</b> <code>next_clocks_length()</code>, the question Rules B.7/4 and B.7/5 ask, must be computed as follows, where <code>current_step</code> is the number (0 to 7, Rule B.13/7) of the sequencer step most recently performed:' +
    '<div class="gbemu-pre">next_clocks_length():\n' +
    '    if a power-on sequencer skip is armed:   return false\n' +
    '    return ((current_step + 1) &amp; 1) == 0</div>' +
    'Length runs on the even steps, so <b>the next step clocks length exactly ' +
    'when the current step is odd</b>, unless the skip of Rule B.11/3 is armed, in which case the answer is false.</div>' +
    '<div class="gbemu-example"><b>Example.</b> Just after step 3: the next step is 4, a length step, so the predicate is true and enabling length takes no extra clock. Just after step 4: the next is 5, so it is false and enabling length with the counter above zero decrements it at once. Just after a power-on with the divider bit low: <code>current_step</code> is 7, the next is 0, so it is true. Just after a power-on with the divider bit high: the skip is armed, so it is false, even though the step after the skipped event will be step 0.</div>' +
    '<div class="gbemu-why"><b>Why.</b> B.7 states both arms of the extra length clock and section 15 gives ' +
    'advice about naming the quirk. <b>Neither writes the predicate down</b>, and the predicate is ' +
    'where the off-by-one hides. <b>The skip clause is not an independent rule</b>. It ' +
    'is entailed by section 15&rsquo;s power-on skip: while the skip is armed the next sequencer ' +
    'event performs <em>no step at all</em>, so it is certainly not one that clocks length. Without ' +
    'that clause the skip is self-inconsistent, suppressing a step while still answering questions ' +
    'about which step it was. ' +
    '<b>All four conditions on the enable edge are load-bearing.</b> A write ' +
    'that merely re-writes an already-set enable bit does nothing; a write when the next step ' +
    '<em>does</em> clock length does nothing, because the ordinary clock is about to happen anyway, ' +
    'and that is the whole shape of the off-by-one. On the trigger side, order matters: ' +
    '<b>reload inside the trigger, then apply the extra decrement</b> (Rule B.7/5). MECHANISM, read from our source (<code>apu_write_nrx4</code>). <b>The rule ' +
    'is identical on all four channels; only the maximum differs</b> (64 on channels 1, 2 and ' +
    '4, 256 on channel 3), so only the value a trigger reloads and the value the extra clock ' +
    'decrements from change. There is no channel-specific exception. ' +
    '<b>Label: MECHANISM throughout.</b> Every number here is either a register ' +
    'field width or the documented sequencer table, and <b>nothing in B.14 was swept</b>. Our own ' +
    'corroboration is that the length behaviour matches an independent implementation to within a ' +
    'millisecond on a held note (98.6 ms against 99.8 ms), which is convergence and is ' +
    'not what the rule rests on.</div>' +

    '<h4 class="gbemu-sub">B.15: The noise channel&rsquo;s first step, and the additive term we ship</h4>' +
    '<p class="hw-readable">Section 17 labels this term NOT DERIVED and undecided. <b>What our ' +
    'core ships is stated here, so that a reader can reproduce our board score.</b></p>' +
    '<div class="gbemu-rule" id="gbr-B-15-1"><b>Rule B.15/1.</b> The first ' +
    'shift after a noise trigger lands at the time this expression gives (all terms in T on the sound unit&rsquo;s own clock, at single speed and in double speed alike):' +
    '<div class="gbemu-pre">first step after a trigger = period / 2  +  trigger delay\n' +
    '\n' +
    'trigger delay = 8  +  (latched divisor code == 1 ? 4 : 0)\n' +
    '                   +  (restart ? 2 : 0)  +  4\n' +
    '\n' +
    '   the trailing 4 is the APU&rsquo;S OWN START DELAY: a FLAT 4 T in BOTH speed\n' +
    '   regimes. It is NOT the bus seam&rsquo;s write lead. Every term above is in T\n' +
    '   on the sound unit&rsquo;s own clock, which double speed does not scale.\n' +
    '\n' +
    'period = divisor &lt;&lt; shift, divisors 8, 16, 32, 48, 64, 80, 96, 112</div>' +
    'A <b>restart</b> is a trigger while channel 4 is already enabled; it adds 2&nbsp;T and does not pay the base 8 a second time.</div>' +
    '<div class="gbemu-rule" id="gbr-B-15-2"><b>Rule B.15/2.</b> The four literals are the <em>trigger&rsquo;s start delay</em> (the time <code>ns_trig</code> runs for before the counter&rsquo;s reset lands); they are not the first step. In order:' +
    '<ol class="gbemu-steps"><li>At the trigger write, the shift register is set to all ones (Rule B.6/1) and <code>ns_trig</code> is loaded with the trigger delay of Rule B.15/1 and nothing more.</li>' +
    '<li>It counts down 2&nbsp;T per sound tick, from the first sound tick of the write&rsquo;s own machine cycle (the write reaches the sound unit before that cycle&rsquo;s ticks).</li>' +
    '<li>While it runs, the divisor stage and the up-counter keep counting but the shift register does not step.</li>' +
    '<li>On the sound tick on which it expires, after that tick&rsquo;s examination (Rule B.17/3), the up-counter is zeroed and the down-counter reloads from the latched divisor code (0 reloading as 1).</li>' +
    '<li>Section 17&rsquo;s counter model then produces the first step half a period later.</li></ol></div>' +
    '<div class="gbemu-rule" id="gbr-B-15-3"><b>Rule B.15/3.</b> <b>The shipped <code>+ 4</code> is the ' +
    'APU&rsquo;s own start delay and nothing ' +
    'else.</b> It is a <b>flat 4&nbsp;T in both speed regimes</b>. It is not the bus seam&rsquo;s write lead (one machine cycle: 4&nbsp;T at single speed, 2&nbsp;T in double speed), and not the harness&rsquo;s measured read offset. <b>The write lead is real and is still paid</b>: at the call site, by the order in which the write and the machine cycle&rsquo;s ticks run (Rule B.15/2, step 2), which is exactly what Rule B.16/3 means by keeping them separate. ' +
    'It is not a term of the expression of Rule B.15/1 and must not be added to it.</div>' +
    '<div class="gbemu-example"><b>Example.</b> On a cold trigger at divisor code 0 the ' +
    'delay is a flat <b>12&nbsp;T</b> and the whole expression is <code>period / 2 + 12</code>, ' +
    'which is what the validating table below measures: <b>16, 16, 20 and 28&nbsp;T</b> at ' +
    'periods 8, 8, 16 and 32 (12&nbsp;T on a cold trigger at code 0 is also the value <code>ns_trig</code> is loaded with). A cold trigger at code 1 loads 8 + 4 + 4 = 16&nbsp;T; a restart at code 0 loads 8 + 2 + 4 = 14&nbsp;T, not 8 + 8 + 4.</div>' +
    '<p class="gbemu-key"><b>The half-period is MECHANISM and it is over-determined rather than ' +
    'fitted.</b> The divider&rsquo;s two edges are half a period apart and the channel starts on the ' +
    'first one. Four declared arms of one cartridge, three periods and two widths, all reproduced by ' +
    'one form. The &ldquo;first step, measured&rdquo; column is what the cartridge reports: T-cycles from the trigger write to the first read that sees the step.</p>' +
    '<table class="gbemu-table"><thead><tr><th>Register value</th><th>Period</th><th>Width</th><th>First step, measured</th></tr></thead><tbody>' +
      '<tr><td><code>$08</code></td><td>8 T</td><td>7-bit</td><td>16 T after the write</td></tr>' +
      '<tr><td><code>$00</code></td><td>8 T</td><td>15-bit</td><td>16 T</td></tr>' +
      '<tr><td><code>$18</code></td><td>16 T</td><td>7-bit</td><td>20 T</td></tr>' +
      '<tr><td><code>$28</code></td><td>32 T</td><td>7-bit</td><td>28 T</td></tr>' +
    '</tbody></table>' +
    '<p class="hw-readable">16 = 8/2 + 12, 20 = 16/2 + 12, 28 = 32/2 + 12, where the 12 is the 8 ' +
    'plus <b>that same flat 4&nbsp;T: the APU&rsquo;s own start delay, in both speed ' +
    'regimes</b>, the one representative named identically in the expression above. ' +
    '<b>One form, four ' +
    'arms, two widths, three periods.</b></p>' +
    '<div class="gbemu-example"><b>Example: what a build will see inside itself (INSTRUMENT-MEASURED).</b> Inside our core, counted from the instant the trigger write reaches the sound unit (at the start of the write&rsquo;s machine cycle, before that cycle&rsquo;s sound ticks run) to the end of the sound tick on which the shift register first shifts, the four arms come out at <b>14, 14, 18 and 26 T</b>: each exactly 2 T before the table. That 2 T is the harness&rsquo;s read offset, the distance from the step to the first read that can see it at single speed. So a build that measures inside itself from the write, as ours does, should get 14, 14, 18 and 26; one that gets 16, 16, 20 and 28 there is 2 T late. ' +
    'The divisor-code-1 arm that the table lacks <b>depends on the trigger&rsquo;s phase</b>. The four-step clock of B.17 is zeroed when the sound unit is powered on and steps once per 2 T sound tick, two ticks per single-speed machine cycle, so a write (made before its cycle&rsquo;s ticks) finds it at 0 or at 2: at 0 when an even number of machine cycles has passed since the power-on, at 2 when odd. A write a fixed number of machine cycles after the power-on therefore always finds the same phase; writes in general do not. The code-0 arms examine on both phases and do not care: <b>14, 14, 18 and 26 T</b> either way. The code-1 arms (<code>$09</code>, <code>$01</code>) examine on one phase only: <b>22 T</b> when the trigger finds the clock at 0 and <b>18 T</b> when it finds it at 2 (and <code>$19</code>: 30 and 26). Measured with an instrumented copy of our sound unit, one trigger per arm, the channel cold, single speed, the trigger moved by 0 to 3 machine cycles (<code>test/tabprobe/noisefirst</code>).</div>' +
    '<div class="gbemu-why"><b>Why.</b> <b>The four constants are named literals, READ FROM OUR OWN ' +
    'SOURCE</b> (a base of <b>8</b>, <b>+4</b> when the latched divisor code is 1, ' +
    '<b>+2</b> on a restart, and a flat <b>+4</b>), which makes them a fact about this ' +
    'emulator and not about hardware; the labels on the individual terms are in section 17, B.17 ' +
    'and F.8, and <b>section 17 and B.17 both carry the trigger start delay as 8&nbsp;T with ' +
    '4&nbsp;T more at divisor code 1</b>. ' +
    'Rule B.15/2 is MECHANISM, read from our source (the noise tick and <code>apu_trigger</code>). <b>The half period is what section 17&rsquo;s counter model ' +
    'then produces</b>: the trigger re-zeroes the 14-bit up-counter, the bit selected by the ' +
    'shift field first <em>rises</em> after <b>2<sup>shift</sup></b> expiries of the divisor ' +
    'stage, and at divisor code 0 the second examination phase halves the expiry period, ' +
    'so the tapped bit rises exactly half a period after the delay ends, at every code and every ' +
    'shift. <b>The counter model does not retire the half period; it derives it.</b> All three ' +
    'statements (the expression above, section 17&rsquo;s bullet, and the table above) ' +
    'read the same: <b>first step = half a period, plus the start delay</b>. ' +
    'Rule B.15/3: our source is explicit ' +
    'that the 4 is <em>not</em> the machine-cycle seam lead, and says why: the seam lead is the ' +
    'processor&rsquo;s machine cycle and halves in double speed, while this delay is the sound ' +
    'unit&rsquo;s own and does not. MECHANISM, read from our source (the noise branch of <code>apu_trigger</code>, <code>NOISE_COUNTER_MODEL</code>). ' +
    '<b>One name for that 4&nbsp;T term, at every site that states it.</b> ' +
    'A write lead halves in double speed and a sound-clock term does not, so <em>the bus ' +
    'seam&rsquo;s write lead</em> and <em>the harness&rsquo;s own measured read offset</em> ' +
    'cannot both name this 4, and in fact neither does. It is <b>the APU&rsquo;s own start ' +
    'delay, flat 4&nbsp;T, both speeds</b>: in the expression above, in the table caption ' +
    'above, and wherever else the term is named.</div>' +
    '<div class="gbemu-why"><b>Why: three forms a re-implementer arrives at, and why each is wrong.</b> ' +
    '<b>One: the trigger delay on its own, with no period term</b> (' +
    '<code>8 + (code == 1 ? 4 : 0) + (restart ? 2 : 0) + 4</code> offered as the whole of the ' +
    'first shift after a trigger). It is a flat <b>12</b> at every arm, against measured first ' +
    'steps of <b>16, 16, 20 and 28</b>, and <b>it reproduces none of the four</b>: it misses ' +
    '<code>$08</code> and <code>$00</code> by 4&nbsp;T, <code>$18</code> by 8 and ' +
    '<code>$28</code> by 16. ' +
    '<b>Two: the free-running-grid form</b>, ' +
    '<code>half = period / 2 + 8</code>, with the step then snapped onto a free-running divisor ' +
    'grid. <b>That is not the shipped model:</b> the shipped model is section 17&rsquo;s free-running counter, which a frequency write never reloads, so <b>there is no grid to ' +
    'snap to</b>. The form carries no divisor-code clause either, so an implementer copying it loses ' +
    'every divisor-code-1 row. <b>The grid-snapping arm and the shipped counter arm coincide at ' +
    'divisor code 0 with no restart, at every shift</b>, because the half period is in both of ' +
    'them, which is why the board never separated them. ' +
    '<b>Three: the shipped flat <code>+ 4</code> read as the bus ' +
    'seam&rsquo;s write lead.</b> An implementer who adds the seam&rsquo;s own write lead of one ' +
    'machine cycle (4&nbsp;T at single speed, 2&nbsp;T in double) on top of the ' +
    'expression pays the 4&nbsp;T twice, gets <code>period / 2 + 16</code>, and misses every one ' +
    'of the four arms. An implementer who ' +
    'instead obeys B.16&rsquo;s &ldquo;keep them separate&rdquo;, reads the shipped 4 <em>as</em> ' +
    'the write lead and removes it, gets <code>period / 2 + 8</code>: wrong in all four ' +
    'as well, and landing exactly on the grid form above, which is what makes this the ' +
    'easiest of the three to talk yourself into.</div>' +
    '<div class="gbemu-why"><b>What the validating table can and cannot catch.</b> All four ' +
    'of its arms (<code>$08</code>, <code>$00</code>, <code>$18</code>, <code>$28</code>) ' +
    'carry divisor code <b>0</b> in their low three bits, and none of them is a restart. ' +
    '<b>The table cannot exercise the divisor-code-1 term, and it cannot exercise the restart ' +
    'term either</b>, and it cannot separate the two models, because they agree at code 0. It ' +
    'validates the expression exactly where the expression is complete. <b>A table that agrees ' +
    'with a formula over a variable it holds constant has not checked that variable</b>, and a ' +
    'table offered as a formula&rsquo;s evidence must say which of the formula&rsquo;s inputs it ' +
    'varies. <b>What would settle it:</b> a fifth arm at a divisor code of 1 (register ' +
    'value <code>$09</code> or <code>$19</code>), which is one declared row and would ' +
    'exercise both the divisor-code term and the model split at once.</div>' +
    '<div class="gbemu-why"><b>The restart&rsquo;s extra lead ships at 2&nbsp;T</b>, as B.17 and ' +
    'F.8&rsquo;s F12 both state; it is <b>BOUNDED, NOT VALUED</b>: any value in ' +
    '(0,&nbsp;8]&nbsp;T passes both 128-cell restart tables and 0 and 10 each fail both. <b>A ' +
    'restart does not pay the base 8 a second time.</b> That rival reading is invisible to the ' +
    'board (8 is <em>also</em> inside the bound, so a core built either way passes the ' +
    'whole suite without a single row moving), which is why a bound that admits two ' +
    'readings needs one shipped representative stated in every place the quantity appears, not a ' +
    'bound in one place and an example in another.</div>' +
    '<div class="gbemu-why"><b>Our core ships the literal 8, and that is the number a reader needs ' +
    'to reproduce our score.</b> <b>It is NOT ESTABLISHED and it is ' +
    'unresolved.</b> No document in reach states it, and two candidate expressions fit everything we ' +
    'can see: the <b>literal 8</b>, and <b>the channel&rsquo;s own divisor value for the current ' +
    'code</b>. They are identical on all 68 sound rows for a reason that is structural rather than ' +
    'lucky: <b>they coincide exactly at divisor code 0, because the first entry in the ' +
    'divisor table <em>is</em> 8</b>, and every row that would separate them uses a non-zero code, ' +
    'where the result also depends on the free-running divisor phase that this arm does not model. ' +
    'So no probe on the board can choose between them. <b>We ship the simpler of the two and carry ' +
    'it as undecided rather than picked.</b> ' +
    '<b>Three further gaps in the same neighbourhood, named rather than ' +
    'hidden.</b> <b>Under the counter model of ' +
    'section 17 there is no grid to snap to and no tie to break</b> (B.17), and divisor codes 2, 3 and 4 need no read value. ' +
    '<b>Divisor codes 5, 6 and 7 appear nowhere in the corpus</b>, so the rule&rsquo;s ' +
    'behaviour above code 4 is unmeasured, not established. And <b>the restart&rsquo;s extra lead, ' +
    'which ships at 2&nbsp;T</b>, is <b>CONVERGENCE, not derivation</b>: the declared tables bound ' +
    'that extra to somewhere in (0,&nbsp;8]&nbsp;T and cannot value it; another implementation ' +
    'chose among the possibilities and we agreed with it. <b>Do not read the 8 in the expression ' +
    'above as that lead</b>: they are two different terms. <b>What would settle the ' +
    'additive term:</b> a cartridge sweeping the ' +
    'trigger&rsquo;s phase across a whole period at a non-zero divisor code, which would separate ' +
    'the free-running phase from the additive term instead of confounding them. Nothing in the ' +
    'present corpus does that. <b>Do not read our 8 as a measurement.</b></div>' +

    '<h4 class="gbemu-sub">B.16: Three rules sections 15 to 17 point at rather than state</h4>' +
    '<div class="gbemu-rule" id="gbr-B-16-1"><b>Rule B.16/1.</b> <b>The sound unit&rsquo;s clock domain, in full: one sound tick is 2 T-cycles of the 4 MHz master clock, always.</b> If your tick ' +
    'function is called once per <em>machine cycle</em> (the natural place to call it), ' +
    'it must advance <b>two</b> ticks at single speed, where a machine cycle is 4 T, and <b>one</b> ' +
    'tick in double speed, where a machine cycle is only 2 T of the same clock.</div>' +
    '<div class="gbemu-why"><b>Why.</b> The documentation ' +
    'sentence section 15 cites is: <i>&ldquo;The length of APU ticks is not affected by Color double ' +
    'speed, so the APU works just the same regardless of CPU speed.&rdquo;</i> Get this wrong in ' +
    'the obvious direction and every frequency timer, every wave-position advance and every noise ' +
    'step runs at twice its rate in double speed: <b>an octave up in every Colour title</b>, and ' +
    'every declared delay in the sound suite measured against half the period the cartridge states, ' +
    'because those cartridges run under a speed switch.</div>' +
    '<div class="gbemu-rule" id="gbr-B-16-2"><b>Rule B.16/2.</b> <b>The frame sequencer is the other half of the same fact.</b> The sequencer is clocked by the falling edge of bit 4 of the ' +
    'visible divider register (bit 12 of the internal 16-bit counter) giving 512 Hz. ' +
    'In double speed that counter runs twice as fast, so bit 12 would deliver 1024 Hz; <b>take bit ' +
    '13 there instead</b> to restore 512 Hz.' +
    '<table class="gbemu-table"><thead><tr><th>Machine and speed</th><th>Bit of the internal 16-bit counter whose falling edge clocks the sequencer</th></tr></thead><tbody>' +
      '<tr><td>Original machine</td><td>12</td></tr>' +
      '<tr><td>Colour at single speed</td><td>12</td></tr>' +
      '<tr><td>Colour at double speed</td><td>13</td></tr>' +
    '</tbody></table></div>' +
    '<div class="gbemu-why"><b>Why.</b> This is the half that gets fixed alone. <b>Compensating the sequencer and not the channels is the ' +
    'same bug, half fixed.</b></div>' +
    '<div class="gbemu-rule" id="gbr-B-16-3"><b>Rule B.16/3.</b> The two parts of a trigger delay compose without overlapping and must be kept separate: the bus seam&rsquo;s ' +
    'write lead, which is one machine cycle and therefore <em>does</em> scale with processor speed ' +
    '(4 T single, 2 T double), and any physical start delay expressed in T on the sound unit&rsquo;s ' +
    'own clock, which <em>does not</em>.</div>' +
    '<div class="gbemu-rule" id="gbr-B-16-4"><b>Rule B.16/4.</b> <b>The pulse phase is only ever reset by turning the sound unit off.</b> ' +
    'A pulse channel&rsquo;s duty position (its place in the eight-step duty waveform, Rule B.4/1) is a ' +
    '<b>persistent object</b>: powering the sound unit off sets it to 0, and nothing else resets it. Disabling the channel (by a length counter reaching zero, by a ' +
    'sweep overflow, by clearing its DAC) does <b>not</b> reset it. Two consequences:' +
    '<ul class="gbemu-bullets"><li><b>A stopped channel holds its duty position</b> (its period timer may keep running; ' +
    'the position must not advance, so a restart resumes where it stopped and not where it would ' +
    'have been).</li>' +
    '<li><b>A stop commits the sample already in flight.</b> A stop landing inside the ' +
    'last machine cycle of a sample still advances the duty position for that sample: it is ' +
    'already committed. The same clause applies on the restart side (section 16). <b>The stop side, exactly, in our core</b>: the threshold is the restart side&rsquo;s, 4 T or less left on the channel&rsquo;s period timer (the literal 4, at both speeds). It applies to a stop made by switching the channel&rsquo;s DAC off (an NRx2 write with its top five bits clear) while the channel is enabled and it has been triggered at least once since power-on (the first bit of Rule B.16/6, set by the trigger itself; the first advance need not have happened); the duty position then advances once as the channel stops. A stop by the length counter or the sweep does not take this step.</li></ul></div>' +
    '<div class="gbemu-example"><b>Example.</b> Channel 2 at duty position 5 with 12&nbsp;T left on its period timer; NR22 is written <code>0x00</code>. The channel stops and the position stays 5. With 4&nbsp;T left instead, the position advances to 6 as the channel stops. Either way, when the channel is triggered again it continues from that position (5 or 6), not from 0 and not from where it would have run to. A length expiry with 4&nbsp;T left leaves it at 5.</div>' +
    '<div class="gbemu-why"><b>Why.</b> ' +
    'Two independent statements of one rule. The documentation says exactly that, and a ' +
    'cartridge declares the same thing in its own header: <i>&ldquo;even after stopping the channel, ' +
    'the current sample index/phase remains unchanged. It is only reset by turning the APU off ' +
    '(NR52).&rdquo;</i> The 4&nbsp;T threshold is one machine cycle at single speed, the seam lead a register write has. The stop side is read from our source (the DAC-off path).</div>' +
    '<div class="gbemu-rule" id="gbr-B-16-5"><b>Rule B.16/5.</b> <b>Our core keeps clocking the channels while the sound unit is powered off</b> (the per-sound-tick channel step keeps running). This is a declined arm of Rule B.16/4, not an omission.</div>' +
    '<div class="gbemu-why"><b>Why.</b> <b>The third arm of Rule B.16/4 is refused here, with the price ' +
    'written down.</b> If the pulse phase is only ever reset by powering off, then a powered-off ' +
    'unit cannot be advancing it, so a powered-off unit should not clock its channels at all. ' +
    '<b>Our core does clock them, and we decline to stop.</b> Measured with every other arm held on, ' +
    'so the attribution is a control and not an inference: it buys <b>nothing</b> on the board and ' +
    'makes the audio instrument <b>worse by 156</b>, taking two pulse tracks that were exact to ' +
    '0.49. It is kept as a switch rather than deleted, because two exact tracks going to 0.49 is not ' +
    'a phase error, and whatever it is, this arm exposed it rather than created it. <b>The rule is ' +
    'MECHANISM; our refusal to implement it is a declined arm with a measured cost, and the reason ' +
    'it is declined is the cost, not the rule.</b></div>' +
    '<div class="gbemu-rule" id="gbr-B-16-6"><b>Rule B.16/6.</b> <b>The first duty step after power-on.</b> Carry exactly two bits per pulse channel:' +
    '<ul class="gbemu-bullets"><li><b>has this channel been ' +
    'triggered since the unit was powered on?</b> Cleared at power-on, set by any trigger. ' +
    'While it is clear, <b>the duty position does not advance at all</b>.</li>' +
    '<li><b>is the first step ' +
    'after that first trigger still pending?</b> Armed <em>only</em> by the first trigger ' +
    'after power-on, cleared by the first advance of the duty position. While it is set the ' +
    'channel&rsquo;s output reads 0 regardless of the duty table.</li></ul>' +
    '<b>Two objects must stay distinct:</b> the duty <em>step counter</em> (the duty position), which a trigger must ' +
    '<b>not</b> reset, and the duty <em>timer</em> (the period counter), which a trigger must reset. This gate belongs to ' +
    'the counter. One clause is deliberately outside it: <b>a duty value written before the ' +
    'channel&rsquo;s first trigger must still be the duty it starts with</b> (freeze the ' +
    'clocking, not the register).</div>' +
    '<div class="gbemu-example"><b>Example.</b> Power on, write duty <code>10</code> to NR11, trigger channel 1. Until the first expiry of its period counter the channel outputs 0, even though the duty table&rsquo;s position 0 reads 1. At that expiry the position advances from 0 to 1 and the pending bit clears; from then on the output follows the duty <code>10</code> table, and position 1 reads 0. Before the trigger, expiries of the period counter (if it runs) move nothing.</div>' +
    '<div class="gbemu-why"><b>Why.</b> The documentation&rsquo;s own ' +
    'obscure-behaviour section: <i>&ldquo;Just after powering on, the first duty step of Ch1 and Ch2 ' +
    'after they are triggered for the first time is played as if it were 0. Also, the duty cycle ' +
    'clocking is disabled until the first trigger.&rdquo;</i> <b>Two effects, one condition, and no ' +
    'number is chosen.</b> Most cores conflate the two objects. ' +
    '<b>Why that one reaches so many rows.</b> Every duty and volume ' +
    'cartridge in the sound suite performs one power-on and one trigger per byte it dumps, so it ' +
    'fires on every declared byte. Worth <b>+7 board rows</b> here. ' +
    '<b>The price and its control are two numbers about two builds.</b> The ' +
    '<b>+7</b> is the knock-out: the ' +
    'shipped build against an otherwise identical build with the clause disabled. The ' +
    '<b>null control</b> is the default setting against the ' +
    '<em>explicit</em> &ldquo;on&rdquo; setting, which must produce nothing, and does: every ' +
    'scoreable frame stream byte-identical. That ' +
    'is the run that proves the switch reaches the compiler, and it is the same pattern section 20 ' +
    'insists on under <em>&ldquo;run the controls before the boards&rdquo;</em>. <b>261 is the ' +
    'scoreable denominator, not the board</b>: 264 rows less the 3 that carry no verdict. <b>Name ' +
    'the two builds each figure came from, every time:</b> a sentence that joins a price and its ' +
    'control with &ldquo;with&rdquo; makes the control read as a refutation of the price.</div>' +

    '<h4 class="gbemu-sub">B.17: The noise tie rule, and what replaced it</h4>' +
    '<div class="gbemu-rule" id="gbr-B-17-1"><b>Rule B.17/1.</b> The noise channel has no divisor grid and no tie rule. ' +
    'Under the free-running counter model of section 17 the ' +
    'shift register steps on the rising edge of a selected bit of a counter that a frequency write ' +
    'never reloads. For divisor codes 2, 3 and 4 nothing is read from anywhere: those cells fall out of ' +
    'the counter. The one term that remains is ' +
    'labelled where it lives: the trigger start delay takes <b>+4&nbsp;T at divisor code 1</b> (Rule B.15/1), ' +
    '<b>declared by our own corpus rather than read</b>. Section 17 states its form as ' +
    'UNMEASURED above code 4 and names the cartridge that would settle it.</div>' +
    '<div class="gbemu-rule" id="gbr-B-17-2"><b>Rule B.17/2.</b> <b>The two values a reader needs to reproduce our channel-4 ' +
    'score.</b> The ' +
    'mod-4 clock&rsquo;s examination phases ship at <b>3</b> and <b>1</b>. <b>3 is the ' +
    'primary</b>: the phase that governs <em>every</em> divisor code, including the seven ' +
    'non-zero ones. <b>1 is the second phase, the one that applies only while the ' +
    'latched code is 0</b>. Our clock is zeroed by sound-unit power-on and incremented at the top ' +
    'of each sound tick, <em>before</em> the down-counter is examined, so the examination sees 1, ' +
    '2, 3, 0 on the first four sound ticks after power-on and <b>the first primary examination is ' +
    'the third sound tick</b>.</div>' +
    '<div class="gbemu-example"><b>Example.</b> Counting sound ticks from 1 after a power-on: the clock reads 1, 2, 3, 0, 1, 2, 3, 0 on ticks 1 to 8. At latched code 0 the down-counter is examined on ticks 1, 3, 5, 7 (clock 1 and 3): every 4&nbsp;T. At any other code it is examined on ticks 3 and 7 only (clock 3): every 8&nbsp;T.</div>' +
    '<div class="gbemu-rule" id="gbr-B-17-3"><b>Rule B.17/3.</b> On the sound tick on which the trigger&rsquo;s start delay expires, <b>the examination runs first and the ' +
    'counter reset lands after it</b>.</div>' +
    '<div class="gbemu-why"><b>Why.</b> ' +
    '<b>FORCED in kind, ' +
    'READ OFF in value</b>: what is forced is that there are two examination phases and that the ' +
    'second one applies only while the latched divisor code is 0; where the clock&rsquo;s zero sits ' +
    'relative to your own tick call site is a property of your code, not of the hardware, so ' +
    '<b>derive your own pair rather than copying ours</b>. ' +
    '<b>Which of the two is which, and where our zero sits, is stated because the pair on its own is not ' +
    'a representative.</b> The first-primary-examination sentence is the anchor: a reader who derives the pair ' +
    '(<i>a</i>,&nbsp;<i>b</i>) on their own call site can now tell whether their <i>a</i> is our 3 ' +
    'or our 1 by counting ticks from power-on, instead of guessing. <b>Why it could not be derived ' +
    'from the evidence beside it, which is the part worth carrying away.</b> B.15&rsquo;s four ' +
    'validating arms are <em>all at divisor code 0</em>, where both phases fire and the pair is ' +
    'symmetric (so that table cannot separate primary from secondary, and both assignments ' +
    'reproduce all four arms), which is B.15&rsquo;s own trap, <em>a table ' +
    'that agrees with a formula over a variable it holds constant has not checked that ' +
    'variable</em>. <b>What would settle it independently:</b> a fifth ' +
    'declared arm at a non-zero code, register value <code>$09</code> or <code>$19</code>. ' +
    '<b>Rule B.17/3 is entangled with the pair: getting the pair right and ' +
    'the ordering wrong cancels on this same all-code-0 table and separates everywhere else.</b> ' +
    'The ordering is not fitted to the four arms: it follows from the ' +
    'seam. The write reaches the sound unit before that machine cycle&rsquo;s ticks run, and what ' +
    'the trigger asks for is the <em>end</em> of the delay, not its start. <b>And the measurement ' +
    'that says you cannot get it from the table either way, taken on this core ' +
    'by swapping the two statements and re-running:</b> the two orderings are ' +
    '<b>indistinguishable</b> here. Identical first-step timings on all four of B.15&rsquo;s ' +
    'arms <em>and</em> on six further register values (<code>$09</code>, <code>$19</code>, ' +
    '<code>$02</code>, <code>$12</code>, <code>$03</code>, <code>$05</code>), at every alignment a ' +
    'machine-cycle-aligned write can reach at single speed. <b>That is a fact about our call site, ' +
    'not about the hardware</b>, and it is the reason the instruction has to be <em>derive</em> ' +
    'rather than <em>copy</em>: an implementer whose trigger delay lands the expiry on the examination ' +
    'phase will see the difference we cannot, and will have no declared row to check it against. ' +
    '<b>An implementer who picks the ordering because it reproduces the four arms has fitted a constant ' +
    'the four arms do not constrain</b>; an implementer who reads it off their own write seam has not. ' +
    'The restart&rsquo;s extra lead ships at ' +
    '<b>2&nbsp;T</b> and is <b>BOUNDED, NOT VALUED</b>: any value in (0,&nbsp;8]&nbsp;T passes both ' +
    '128-cell restart tables, 0 and 10 each fail both. <b>The invariant is the bound; 2 is a legal ' +
    'representative of it and is not a finding.</b></div>' +

    '</section>' +

  /* ================================================================ APP-C */
  '</div>';
}
