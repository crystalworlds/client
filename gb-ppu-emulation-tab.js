/* ===========================================================================
 * Game Boy Emulation tab, area 4 of eight: Picture
 * gbPpuEmulationTabHTML(d) returns this area's HTML; the tab's composer in
 * gb-emulation-tab.js calls every area in order (2 November 2026: the tab
 * was split into area files so a builder can read one area at a time).
 * Loaded by a plain <script src> tag (the site must open over file://).
 * =========================================================================== */

function gbPpuEmulationTabHTML(d) {
  return '<div class="gbemu-area" id="gbemu-area-ppu">' +

  '<section class="sect gbemu-area-head" id="gbemu-area-ppu-head"><h3 class="sect-h">Area 4 of eight: Picture</h3>' +
    '<p class="gbemu-key">The picture processor: the sprite scan, mode 3 dot by dot, the fetcher, the two queues and the output stage, the window, objects, mid-line writes, the status line and the access windows (sections 6 to 14), the addressing formulas (appendix C) and every pipeline constant (appendix E).</p>' +
    '<p class="hw-readable">This area is the file <code>gb-ppu-emulation-tab.js</code>, one of the eight area files that together make the Game Boy Emulation tab. It can be read on its own; the build checklist is in the first area, and the rule for what a build must implement is beside it.</p>' +
    '<p class="hw-readable"><b>Where the rest of this page is.</b> When a sentence here points to a section or appendix that is not in this area, it is in one of these files (the links work on the assembled page):</p><ul class="gbemu-bullets"><li><b>Overview, build checklist and interface</b> (<code>gb-machine-emulation-tab.js</code>): <a href="#gbe-m1">1. Clocks, map, and one phase that matters</a> <a href="#gbe-m3">3. Where the machine starts</a> <a href="#gbe-gaps">24. What this page does not cover</a></li><li><b>Processor</b> (<code>gb-cpu-emulation-tab.js</code>): <a href="#gbe-m2">2. The processor</a> <a href="#gbe-ops">Appendix D. The instruction set</a></li><li><b>Memory, timer, interrupts, transfers, serial, pad</b> (<code>gb-memory-emulation-tab.js</code>): <a href="#gbe-m4">4. Timer, DMA, interrupt line</a> <a href="#gbe-hw">5. What a real Game Boy settled</a> <a href="#gbe-regs">Appendix A. Every register, every bit</a></li><li><b>Sound</b> (<code>gb-apu-emulation-tab.js</code>): <a href="#gbe-s1">15. The sound unit is not on the processor&rsquo;s clock</a> <a href="#gbe-s2">16. The square channels</a> <a href="#gbe-s3">17. Wave, noise, and power</a> <a href="#gbe-sound-regs">Appendix B. The sound registers, and the primitives the refinements modify</a></li><li><b>Cartridges and mappers</b> (<code>gb-mappers-emulation-tab.js</code>): <a href="#gbe-mappers">Appendix H. The cartridge mappers, register by register</a></li><li><b>Super Game Boy and link devices</b> (<code>gb-sgb-emulation-tab.js</code>): <a href="#gbe-sgb">Appendix A, continued: the Super Game Boy and the link-port devices</a></li><li><b>Tests and scores</b> (<code>gb-acceptance-emulation-tab.js</code>): <a href="#gbe-9">18. Traps that cost us weeks</a> <a href="#gbe-10">19. What to test with, in order</a> <a href="#gbe-11">20. How to measure a change</a> <a href="#gbe-score">21. The score, and what a score is worth</a> <a href="#gbe-unwinnable">22. Rows nobody can win honestly</a> <a href="#gbe-12">23. The evidence</a> <a href="#gbe-labels">Appendix F. Labels, flexibility, and what is not established</a> <a href="#gbe-verify">Appendix G. The verification scorecard</a></li></ul>' +
  '</section>' +
  '<div class="gbemu-toc"><b>In this area</b><a href="#gbe-m5">6. The sprite scan</a><a href="#gbe-1">7. The decision that decides everything</a><a href="#gbe-2">8. Step the machine by dots</a><a href="#gbe-3">9. The fetcher</a><a href="#gbe-4">10. The two FIFOs</a><a href="#gbe-5">11. The window is a separate machine</a><a href="#gbe-6">12. Sprites stall the pipeline</a><a href="#gbe-7">13. Writes that land mid-line</a><a href="#gbe-8">14. Interrupts, blocking, power</a><a href="#gbe-addr">Appendix C. Tile, map and object addressing</a><a href="#gbe-pipe">Appendix E. The picture pipeline, in numbers</a></div>' +

  '<section class="sect" id="gbe-m5"><h3 class="sect-h">6. The sprite scan</h3>' +
    '<p class="hw-readable"><b>Scale in sections 6 to 13.</b> Every dot number in sections 6 to 13 is on the <b>event scale</b> that appendix E defines, counted from the line&rsquo;s dot 0: &ldquo;X happens on dot D&rdquo; means X happens while the picture processor processes dot D. Where a sentence speaks of a processor access or an interrupt test, it names the <b>access scale</b> (section 14, &ldquo;Access windows&rdquo;), on which that event is first seen on dot D&nbsp;+&nbsp;1. Lengths (&ldquo;80 dots&rdquo;) are counts of dots.</p>' +
    '<div class="gbemu-rule" id="gbr-6-1"><b>Rule 6/1.</b> Mode 2 is <b>80 dots</b>: forty sprite-memory entries at <b>two dots each</b>. <b>The test for each entry runs on the SECOND dot of its pair</b>: slot <em>k</em> (0 to 39, in memory order) performs its read on line dot <code>5 + 2k</code>, so the first slot reads on dot 5, the last on dot 83, and mode 3 is entered on dot 84. A mid-scan write to LCDC bit 2 or to sprite memory is seen by exactly those slots whose read dot is on or after the first dot on which the new value is read (E.1 gives that dot for each write).</div>' +
    '<div class="gbemu-example"><b>Example.</b> Slot 10 reads on dot 5 + 2 &times; 10 = 25. If a write&rsquo;s new value is first read on dot 25, slot 10 and every later slot see it. If it is first read on dot 26, slot 10 sees the old value and slot 11, on dot 27, is the first to see the new one. A build that tests on the first dot of each pair (dot 24 for slot 10) puts slot 10 on the wrong side of a value first read on dot 25.</div>' +
    '<div class="gbemu-why"><b>Why.</b> Which of the two dots carries the test matters: a mid-scan write to LCDC bit 2 or to sprite memory lands on one side of it or the other. It is the same second-dot rule section 9 states for the fetcher (Rule 9/2), and this core shares one expression between them.</div>' +
    '<div class="gbemu-rule" id="gbr-6-2"><b>Rule 6/2.</b> An entry is selected when the current line falls inside the sprite&rsquo;s vertical extent (<code>Y &minus; 16</code> for the given height: lines <code>Y &minus; 16</code> to <code>Y &minus; 16 + height &minus; 1</code>, height 8 or 16) and fewer than ten are already held. <b>Selection is in memory order and the first ten win</b>, however far right they sit.</div>' +
    '<div class="gbemu-example"><b>Example.</b> At height 8 an entry with Y = 20 covers lines 4 to 11; at height 16 it covers lines 4 to 19. If slots 0 to 11 all cover line 50, slots 0 to 9 are selected and slots 10 and 11 are not, whatever their X.</div>' +
    '<div class="gbemu-rule" id="gbr-6-3"><b>Rule 6/3.</b> Selection order is not display order. On the original Game Boy, where two objects&rsquo; pixels overlap, the object with the <b>smaller X coordinate is drawn on top</b>, and only when two share an X does the lower memory index win. Build it this way: select in memory order (Rule 6/2), then <em>fetch</em> in ascending (X, index) order, and let the merge keep whatever arrived first: a fetched object pixel of colour 1 to 3 is written into an object-queue slot only if that slot holds colour 0. That makes the highest-priority object the one that shows.</div>' +
    '<div class="gbemu-example"><b>Example.</b> Slot 3 at X = 40 covers screen columns 32 to 39; slot 1 at X = 44 covers columns 36 to 43. Fetch order is slot 3 (X 40) then slot 1 (X 44), so in columns 36 to 39 slot 3&rsquo;s opaque pixels stay and slot 1 shows only where slot 3 is colour 0. With both at X = 40, slot 1 is fetched first and is on top.</div>' +
    '<div class="gbemu-why"><b>Why.</b> Conflating selection order with display order is a visible bug. Fetch in plain memory order instead and dmg-acid2 grows its moles: that is the failure it labels &ldquo;Object Priority Lower X Coordinate&rdquo; and &ldquo;Same X Coordinate&rdquo;. That an object pixel only fills a colour-0 slot on the original is read from our source (the merge test <code>objf[s] == 0</code>).</div>' +
    '<div class="gbemu-rule" id="gbr-6-4"><b>Rule 6/4.</b> <b>Sprite <em>height</em> (LCDC bit 2) is read twice, not once.</b> The size bit has <b>two consumers</b>: the mode-2 scan&rsquo;s height (Rule 6/2) and the mode-3 fetch&rsquo;s height (Rule 12/7), read at different times. A title that changes the bit in between gets a sprite selected at one height and fetched at another, and that is the behaviour to model.</div>' +
    '<div class="gbemu-why"><b>Why.</b> Do not write &ldquo;height is not part of the scan&rdquo;: the scan plainly uses it, because that is what <code>Y &minus; 16</code> <em>for the given height</em> means. Section 12 has the fetch side.</div>' +
  '</section>' +

  /* ---------------------------------------------------------------- 1 */
  '<section class="sect" id="gbe-1"><h3 class="sect-h">7. The decision that decides everything</h3>' +
    '<div class="gbemu-rule" id="gbr-7-1"><b>Rule 7/1.</b> A scanline is <b>456 dots</b>. Mode 2 (the sprite scan) is a fixed 80. Mode 3 (drawing) runs somewhere between <b>172 and 289</b>, and mode 0 gets whatever is left.</div>' +
    '<div class="gbemu-rule" id="gbr-7-2"><b>Rule 7/2.</b> <b>Mode 3 has no length variable at all.</b> The fetcher and the pixel queue run one dot at a time, pixels are popped toward the screen one at a time, and mode 3 ends when the line&rsquo;s work is done (Rules 7/3 to 7/5). Its duration is an <em>output</em> of the machine, not an input.</div>' +
    '<div class="gbemu-why"><b>Why.</b> Almost every emulator computes that mode 3 length from a formula (<code>172 + (SCX &amp; 7) + sprite penalties</code>) and then draws the whole line in one go. That approach cannot ever be fixed. It produces correct-looking output and correct average timing, and it can never model a game that rewrites a register <em>during</em> the line, because in that design there is no &ldquo;during&rdquo;. Built dot by dot, every documented penalty falls out on its own (the table at the end of this section).</div>' +
    '<p class="hw-readable"><b>Mode 3 has two ends, and this page names both.</b> The <b>internal</b> end (Rule 7/3) is the fetcher&rsquo;s last push of the line; the <b>internal mode-0 entry</b> (Rule 7/5) comes later, on the dot the 160th pixel is popped. Between them the pixel pipeline keeps running (Rule 7/4). What STAT reports, and when the mode-0 interrupt source rises, are separate again (appendix E.6, Rules <a href="#gbr-E-6-3">E.6/3</a> to <a href="#gbr-E-6-6">E.6/6</a>).</p>' +
    '<div class="gbemu-rule" id="gbr-7-3"><b>Rule 7/3. The internal end of mode 3.</b> Internal mode 3 ends on the first dot on which, tested after that dot&rsquo;s draw block (so a push or a pop on that dot counts), both (a) and (b) hold:' +
      '<ul class="gbemu-bullets">' +
        '<li>(a) <code>P + Q &minus; D &ge; 160</code>, where <code>P</code> is the number of pixels popped toward the screen so far on this line (fine-scroll discards not counted), <code>Q</code> is the number of pixels in the background queue, and <code>D</code> is the number of fine-scroll discards still owed that will drop a pixel (a discard voided by a window takeover, whose dots are still spent on the original, Rule 11/11, is not subtracted). Window columns still to be dropped on a WX 0 to 6 line (E.8.1) are <em>not</em> subtracted: <code>Q</code> counts them as it stands.</li>' +
        '<li>(b) No object work is left: no object fetch is in progress, and no selected object is still ahead. &ldquo;Still ahead&rdquo; is exactly E.6&rsquo;s block quantity (<a href="#gbr-E-6-5">Rule E.6/5</a>): a selected object not yet fetched (not the one being fetched) whose column, X less 8 and never below 0, is at or right of <code>P</code> and left of 160, with object enable read at its outstanding-work view: a set write is seen from C, a clear from C &minus; 1, as E.9.1&rsquo;s table gives it through E.1.3&rsquo;s object-enable exception.</li>' +
      '</ul>' +
      'Internal mode 3 changes only once per line: nothing after this dot reopens it. This internal end is what E.9&rsquo;s &ldquo;the line&rsquo;s last pixel is in the queue&rdquo; and the LCDC train&rsquo;s mode-3 test mean.</div>' +
    '<div class="gbemu-rule" id="gbr-7-4"><b>Rule 7/4. Between the two ends.</b> The pixel pipeline runs on every dot on which internal mode is 3 <em>or</em> fewer than 160 pixels have been popped. So between the internal end and the internal mode-0 entry it keeps running exactly as in mode 3: on every dot until the 160th pixel is popped the fetcher keeps stepping (it fetches past the screen&rsquo;s right edge and its pushes wait in the queue), pixels pop, and the window comparator still runs, so a window whose position matches in those last pixels still takes over and restarts the fetcher on the window. None of this reopens internal mode 3; what it can move is the reported mode (E.8.1, a window at WX 160 to 165).</div>' +
    '<div class="gbemu-rule" id="gbr-7-5"><b>Rule 7/5. The internal mode-0 entry.</b> Internal mode 0 is entered on the dot the 160th pixel is <em>popped</em>. The horizontal-blank transfer and the palette window key to this dot, not to the internal end of Rule 7/3.</div>' +
    '<p class="hw-readable">The two ends and the report on one line, as a schedule. Object-free line at SCX 0, on the original:</p>' +
    '<table class="gbemu-table"><thead><tr><th>Dot (event scale, from the line&rsquo;s dot 0)</th><th>What happens</th></tr></thead><tbody>' +
      '<tr><td>84</td><td>Mode 3 entered (Rule 6/1)</td></tr>' +
      '<tr><td>84 to 89</td><td>The priming fetch (Rule 7/6); the fine-scroll count is fixed on dot 89 (Rule 11/12)</td></tr>' +
      '<tr><td>90 to 97</td><td>The first real fetch: its three data steps on dots 90&ndash;95, its push step on dots 96 and 97; the push, and the first pop, on dot 97 (E.5.1)</td></tr>' +
      '<tr><td>249</td><td>The last tile&rsquo;s push: <b>internal mode 3 ends</b> (Rule 7/3)</td></tr>' +
      '<tr><td>253</td><td>STAT&rsquo;s reported mode becomes 0 (first seen by an access on access-scale dot 254, section 14&rsquo;s first access table; E.6 has the rule)</td></tr>' +
      '<tr><td>256</td><td>The 160th pixel is popped: <b>internal mode-0 entry</b> (Rule 7/5)</td></tr>' +
      '<tr><td>257</td><td>That pixel leaves the output stage for the screen, with its palette applied (Rule 13/4)</td></tr>' +
    '</tbody></table>' +
    '<div class="gbemu-why"><b>Why.</b> Both ends are read from our source: the mode-3 end test, and the pipeline running while mode 3 is internal <em>or</em> fewer than 160 pixels have been popped. The dots 249 and 256 are INSTRUMENT-MEASURED (<code>test/tabprobe</code>); the rule is read from our source (the mode-3 end test). That a voided discard is not subtracted in (a) is read from our source (a discard marked voided is left out of the end test).</div>' +
    '<div class="gbemu-rule" id="gbr-7-6"><b>Rule 7/6. The priming fetch.</b> A line opens with a priming fetch, then the first real fetch. The priming fetch <b>takes</b> the early push opportunity at the high-plane step (Rule 9/3), so it costs 6 dots, but it <b>deposits nothing into the queue and does not advance the fetcher&rsquo;s tile counter</b> (<code>fetch_x</code>): it completes at the high-plane step and restarts the fetcher <em>before</em> the push, so neither the eight pixels nor the <code>fetch_x</code> increment ever happen. The first real fetch therefore re-reads map column 0.</div>' +
    '<div class="gbemu-why"><b>Why.</b> Read from source: the priming branch completes at the high-plane step and restarts the fetcher before the push. The alternative, depositing eight pixels and then clearing them, is invisible on an ordinary line and moves the fetcher&rsquo;s phase for any object due inside the 12-dot opening, which is the load-bearing OAM X = 8 seam.</div>' +
    '<p class="hw-readable">Every documented penalty then falls out on its own:</p>' +
    '<table class="gbemu-table"><thead><tr><th>Documented penalty (dots added to mode 3)</th><th>What actually produces it</th></tr></thead><tbody>' +
      '<tr><td>+12 dots minimum</td><td><b>Two fetches, and each costs 6 dots rather than 8.</b> The high-plane step carries a push opportunity of its own (Rule 9/3), so a fetch that pushes there finishes two dots early. The priming fetch, whose tile is <em>discarded</em> (Rule 7/6), then the first real fetch: 6 + 6. The five-step cycle on its own gives 8. <b>The 6 + 6 is a length argument, not a dot schedule.</b> It says why drawing takes 12 dots more than 160; it does not say on which dots the steps fall. Measured on the shipped core (appendix E.5.1), the first real fetch&rsquo;s three data steps are on dots 90&ndash;95, its push step on dots 96 and 97, and the first pop on dot 97, so read as a schedule the first real fetch spans eight dots, not six. Take every dot position from E.5.1, which reconciles the two in its part (b).</td></tr>' +
      '<tr><td>+ (SCX &amp; 7)</td><td>Discarding that many pixels off the first tile before the counter starts</td></tr>' +
      '<tr><td>+6 when the window starts</td><td>Clearing the background queue and restarting the fetcher, and the restart fetch takes that <em>same</em> early push, so it costs 6 and not 8. There is no priming fetch at a takeover, which is exactly why the window is worth 6 where the line start is worth 12. 6 is what a takeover costs when it lands after the line&rsquo;s first pixel has left the queue (WX 8 and above, or WX 0 to 7 on a line whose WX was written during the priming fetch). Earlier takeovers cost between 7 dots more and 2 dots fewer than the same line drawn without a window, because a takeover before the first pop shares dots with the line opening and voids the fine-scroll discard. On the Colour the voided discard&rsquo;s dots are saved; on the original they are still spent (Rule 11/11), so no takeover makes the line shorter there and the &ldquo;fewer&rdquo; end of that range is the Colour&rsquo;s. Appendix E.8.1 tabulates every case, measured on the shipped core.</td></tr>' +
      '<tr><td>+6 to +11 per sprite</td><td>The sprite fetch stalling the background fetcher</td></tr>' +
    '</tbody></table>' +
    '<p class="gbemu-key">The test: if you ever have to <em>add</em> a penalty as a special case, ' +
    'the mechanism underneath is wrong. Every one of those numbers should be something you ' +
    'measure coming out, never something you put in.</p></section>' +

  /* ---------------------------------------------------------------- 2 */
  '<section class="sect" id="gbe-2"><h3 class="sect-h">8. Step the machine by dots</h3>' +
    '<div class="gbemu-rule" id="gbr-8-1"><b>Rule 8/1.</b> The picture processor advances one dot at a time, four dots per machine cycle, driven from the same clock as the timer. <b>A write must be placeable at dot granularity, because the delivery phase differs per register and is not one number</b> (appendix E.1).</div>' +
    '<div class="gbemu-why"><b>Why.</b> That is what makes a write from the processor land at the right pixel, and in this design it is. <b>Note exactly what that claims.</b> It is a statement about what the ' +
    '<em>model</em> must be able to do, not about what the hardware does between dots. That a ' +
    'processor write lands between two dots on silicon is <b>NOT ESTABLISHED as a hardware ' +
    'statement</b>: no document and no capture in our record says it, and F.4 carries that ' +
    'label. <b>What would establish it:</b> a capture showing a write landing at a sub-dot phase. ' +
    'Nothing we hold can.</div>' +
    '<p class="hw-readable">It costs about <b>70,224 dot steps per frame</b>. That sounds ' +
    'expensive and is not: it runs comfortably in WebAssembly in a browser tab, which is ' +
    'where this one runs. Correctness first; there is more headroom than you think.</p></section>' +

  /* ---------------------------------------------------------------- 3 */
  '<section class="sect" id="gbe-3"><h3 class="sect-h">9. The fetcher</h3>' +
    '<div class="gbemu-rule" id="gbr-9-1"><b>Rule 9/1.</b> The background fetcher runs five steps. The first four take <b>two dots each</b>; the fifth (the push) is retried every dot until it succeeds.' +
    '<ol class="gbemu-steps">' +
      '<li><b>Get tile</b>: read the map. Background uses map 0x9800 unless LCDC bit 3 ' +
        'selects 0x9C00; the window uses bit 6. Background coordinates are ' +
        '<code>((SCX/8) + fetcher_x) &amp; 0x1F</code> and <code>(LY + SCY) &amp; 255</code>. ' +
        'The window uses its own X and its own row counter, not LY.</li>' +
      '<li><b>Get tile data, low plane</b>: LCDC bit 4 selects 0x8000 addressed unsigned, ' +
        'or the signed form: tile n at <code>0x9000</code> + (signed n) &times; 16, covering <code>0x8800</code>&ndash;<code>0x97FF</code> (appendix C.3 gives both forms; it is not &ldquo;base <code>0x8800</code>&rdquo;).</li>' +
      '<li><b>Get tile data, high plane</b>: the next address. <b>It also attempts a push</b>, outside the four numbered steps (Rule 9/3).</li>' +
      '<li><b>Sleep</b>.</li>' +
      '<li><b>Push</b>: eight pixels, but <em>only if the background queue is empty</em>.</li>' +
    '</ol></div>' +
    '<div class="gbemu-why"><b>Why.</b> The LCDC bit 4 choice is the subject of four separate test cartridges and it is where most of the hard failures live.</div>' +
    '<div class="gbemu-rule" id="gbr-9-2"><b>Rule 9/2. The cycle is EIGHT dots.</b> Number the dots of one cycle <code>pos = step &times; 2 + sub</code>, running <b>0 to 7</b>. Each two-dot step does nothing on its first dot and executes its body (including every register read it makes) on its <b>second</b>. So the bodies land on pos 1, 3, 5 and 7, as the table gives. The push is attempted on pos 7, the last dot of the cycle, not a ninth one. If the background queue is empty there, the push succeeds on pos 7 and the next cycle begins (pos 0) on the next dot: <b>period exactly 8</b>. If the queue is not empty, the fetcher is parked: it stays at its push step and retries one dot per dot, and <em>those</em> are the dots that take the cycle past 8.</div>' +
    '<table class="gbemu-table"><thead><tr><th><code>pos</code> (dots from the start of the fetcher&rsquo;s cycle, 0 to 7)</th><th>What happens</th></tr></thead><tbody>' +
      '<tr><td>0&ndash;1</td><td><b>Get tile</b>: the map read, on pos 1</td></tr>' +
      '<tr><td>2&ndash;3</td><td><b>Low plane</b>: the first data read, on pos 3</td></tr>' +
      '<tr><td>4&ndash;5</td><td><b>High plane</b>: the second data read, on pos 5, <b>and a push attempt on the same dot</b>. Succeed here and the fetch ends at 6 dots. Only the priming fetch and the window&rsquo;s restart fetch attempt it (Rule 9/3)</td></tr>' +
      '<tr><td>6&ndash;7</td><td><b>Sleep</b>, then <b>the push on pos 7</b>: the last dot of the cycle, not a ninth one</td></tr>' +
    '</tbody></table>' +
    '<div class="gbemu-example"><b>Example.</b> On an object-free line at SCX = 0 the first real fetch starts (pos 0) on dot 90: map read on dot 91 (pos 1), low plane on dot 93 (pos 3), high plane on dot 95 (pos 5), push on dot 97 (pos 7), and the next fetch&rsquo;s pos 0 is dot 98. A fetcher that spends a ninth dot on a successful push starts the next fetch on dot 99, and the one after on dot 108 instead of 106.</div>' +
    '<div class="gbemu-why"><b>Why.</b> The five-step listing does not say the cycle is eight. Four steps at two dots is eight, the fifth is a push, and the obvious reading (eight plus a push) gives nine. <b>It is eight.</b> Getting the fetcher&rsquo;s period wrong by one dot is catastrophic. &ldquo;The fifth step is retried every dot&rdquo; describes the stall, not the steady state. A fetcher that spends a dot of its own on the push even when it succeeds runs on a nine-dot period, drifts one dot per fetch, and will look like a scroll bug.</div>' +
    '<div class="gbemu-rule" id="gbr-9-3"><b>Rule 9/3. The early push on pos 5.</b> Only two fetches ever attempt the push on pos 5: the line&rsquo;s priming fetch (which completes there and deposits nothing, Rule 7/6) and the window&rsquo;s restart fetch after a takeover (which pushes there when the queue is empty). A fetch that pushes on pos 5 costs 6 dots instead of 8. Every other fetch, the line&rsquo;s first real fetch included, goes on to the sleep step and pushes on pos 7 even when the queue is already empty on pos 5.</div>' +
    '<div class="gbemu-example"><b>Example.</b> On an object-free line at SCX = 0 the first real fetch&rsquo;s high-plane read is on dot 95 with an empty queue, and its push is on dot 97, not 95 (E.5.1). Section 7 spends the 6-dot cost twice at the start of a line (priming fetch and first real fetch, 6 + 6) and once at a window takeover.</div>' +
    '<div class="gbemu-why"><b>Why.</b> Read from our own source and INSTRUMENT-MEASURED.</div>' +
    '<p class="hw-readable"><b>Three invariants elsewhere on this page depend on exactly this ' +
    ', so check yours against all three.</b> Section 7 ' +
    'derives the +12-dot line opening from <em>two</em> fetches at 6 dots each, which requires the ' +
    'push opportunity on pos 5. Section 12 and appendix E.3 place the object-stall window at ' +
    '<b>pos 4, 5 and 6: the three dots ending immediately before the push, not including ' +
    'it</b>, which requires the push on pos 7; E.3 shows that a window containing pos 7 cannot ' +
    'produce the hardware-observed cost of 11 at residue 0. And appendix E.1 indexes every ' +
    'mid-line register lead on the second-dot rule above. <b>Get the period wrong and all three ' +
    'move together, which is what makes the fault so hard to see</b>: the line length stays ' +
    'plausible and only the pixels move.</p>' +
    '<div class="gbemu-why"><b>Flexibility.</b> You may put each step&rsquo;s body on its first ' +
    'dot instead and shift every lead in E.1 by one to compensate. <b>What is observable is the dot ' +
    'each read happens on in absolute line time and the eight-dot period, not which half of a step ' +
    'you call it.</b></div>' +
    '<div class="gbemu-rule" id="gbr-9-4"><b>Rule 9/4.</b> The two data reads are <b>two dots apart</b> (pos 3 and pos 5), and they are separate events. A register written between them is seen by one and not the other.</div>' +
    '<div class="gbemu-example"><b>Example.</b> In the first real fetch of the example under Rule 9/2 the low plane is read on dot 93 and the high plane on dot 95. A change to LCDC bit 4 first read on dot 94 or 95 is seen by the high-plane read and not by the low-plane read, so the two planes of that tile come from different tile-data areas.</div>' +
    '<div class="gbemu-why"><b>Why.</b> Half the difficulty in this whole subject follows from that single fact.</div>' +
    '<div class="gbemu-rule" id="gbr-9-5"><b>Rule 9/5.</b> Reads the processor is not allowed to make return 0xFF. <b>The fetcher&rsquo;s own reads are never blocked on the original</b>: nothing gates them, not the processor&rsquo;s access windows and not a sprite-memory transfer running from video memory (that conflict is on the processor&rsquo;s side, section 5); the fetcher always reads video memory as it stands.</div>' +
    '<div class="gbemu-why"><b>Why.</b> Read from our source (the fetcher reads video memory directly, with no access test). No rule in our core blocks a fetcher read.</div>' +
  '</section>' +

  /* ---------------------------------------------------------------- 4 */
  '<section class="sect" id="gbe-4"><h3 class="sect-h">10. The two FIFOs</h3>' +
    '<div class="gbemu-rule" id="gbr-10-1"><b>Rule 10/1.</b> There are two independent queues, one for background and one for sprites. They are paired at the moment a pixel pops, mixed on the next dot as the pixel reaches the screen (the output stage, appendix E.1.3), and both cleared at the start of drawing. Each pixel carries its colour, its palette, and two priority bits.</div>' +
    '<div class="gbemu-why"><b>Why.</b> MECHANISM, read from our source, <code>ppu_out_emit</code>.</div>' +
    '<div class="gbemu-rule" id="gbr-10-2"><b>Rule 10/2.</b> A fine-scroll discard (the <code>SCX &amp; 7</code> pixels dropped at the start of the line, section 11) pops the <b>background queue only</b>. It does not advance the screen column and it does not shift the object queue: objects are placed by screen column, so the object queue moves only on a real pop, when a pixel goes to the screen. An object at OAM X 0 to 7 is therefore clipped by its own X (appendix C.6), never a second time by the scroll.</div>' +
    '<div class="gbemu-why"><b>Why.</b> MECHANISM, read from our source (the discard branch of the output step touches the background queue and nothing else).</div>' +
    '<div class="gbemu-rule" id="gbr-10-3"><b>Rule 10/3.</b> <b>Eight pixels is the most either queue ever holds.</b> The background push fires <em>only into an empty queue</em> (Rule 9/1, step 5), so a second push can never stack on a first.</div>' +
    '<div class="gbemu-why"><b>Why.</b> Do not read the storage width as the machine&rsquo;s depth: a &ldquo;sixteen-entry&rdquo; queue is a statement about the ring buffer and not about the machine. The storage is sixteen slots wide in this core (wide enough that the head index can wrap without a special case) and the occupancy never passes eight.</div>' +
    '<div class="gbemu-rule" id="gbr-10-4"><b>Rule 10/4. The merge on the original Game Boy.</b> Pop one pixel from each queue. If the background is disabled (LCDC bit 0 clear), the background pixel is forced to colour 0 first, and the test below uses the forced value. Then the sprite pixel wins <em>unless</em> it is colour 0 (transparent), or sprites are disabled, or the sprite&rsquo;s priority bit is set and the background pixel is not colour 0:</div>' +
    '<table class="gbemu-table"><thead><tr><th>Sprite pixel colour (0 to 3)</th><th>Sprites enabled (LCDC bit 1)</th><th>Sprite priority bit</th><th>Background pixel colour, after the LCDC bit 0 forcing (0 to 3)</th><th>Pixel shown</th></tr></thead><tbody>' +
      '<tr><td>0</td><td>any</td><td>any</td><td>any</td><td>background</td></tr>' +
      '<tr><td>1 to 3</td><td>clear</td><td>any</td><td>any</td><td>background</td></tr>' +
      '<tr><td>1 to 3</td><td>set</td><td>clear</td><td>any</td><td>sprite</td></tr>' +
      '<tr><td>1 to 3</td><td>set</td><td>set</td><td>0</td><td>sprite</td></tr>' +
      '<tr><td>1 to 3</td><td>set</td><td>set</td><td>1 to 3</td><td>background</td></tr>' +
    '</tbody></table>' +
    '<div class="gbemu-why"><b>Why.</b> Colour 0 means &ldquo;transparent&rdquo; for a sprite and ' +
    '&ldquo;lightest shade&rdquo; for the background. A wrong bit in a sprite whose other bit is 0 ' +
    'turns a visible pixel into nothing at all, so a fault can present as a sprite that was ' +
    'never drawn. Do not go hunting for a second mechanism; it is one fault wearing two ' +
    'faces.</div></section>' +

  /* ---------------------------------------------------------------- 5 */
  '<section class="sect" id="gbe-5"><h3 class="sect-h">11. The window is a separate machine</h3>' +
    '<div class="gbemu-rule" id="gbr-11-1"><b>Rule 11/1.</b> <b>The window has its own line counter (its row counter) and it is not derived from LY.</b> It is a state variable that changes only as Rules 11/5 and 11/6 say, not a function of the screen line.</div>' +
    '<div class="gbemu-why"><b>Why.</b> This is the classic wrong-but-almost-right trap, so it is worth stating flatly. MECHANISM. Rules 11/2 to 11/6 are the window&rsquo;s state; the comparison that starts it is composed in appendix E.8.</div>' +

    '<div class="gbemu-rule" id="gbr-11-2"><b>Rule 11/2. The Y condition.</b> A frame-scoped <b>Y condition</b> is set on any dot where <code>WY</code> equals the picture&rsquo;s own line counter <em>and</em> window-enable reads set in the window comparator&rsquo;s view of LCDC bit 5 (E.9.1; appendix E.1&rsquo;s WY row). The test is made on every dot of every line, vertical-blank lines included (every dot the picture processes with the display on). Once set, the condition stays set for the rest of the frame. It is cleared at the frame wrap into line 0 and when the screen is switched off, and it is set at the switch-on itself when WY is 0, whatever window-enable reads. The line counter compared is the picture&rsquo;s own, not the LY register&rsquo;s reading, so on line 153 the test compares WY with 153 even while the register already reads 0.</div>' +
    '<div class="gbemu-example"><b>Example.</b> WY = 150: the condition is set on line 150 and cleared by the wrap into line 0, so it never arms the next frame; every match made on a vertical-blank line (WY 144 to 153) is discarded the same way. WY = 40 with window-enable reading clear on every dot of line 40 and set from line 41 on: no dot of line 40 sets the condition, and no later line of that frame equals 40, so the window does not appear in that frame.</div>' +
    '<div class="gbemu-why"><b>Why.</b> MECHANISM, read from our source, <code>lcdc_wincmp</code>. The switch-on writer has no enable term: MECHANISM, read from our source, NOT ESTABLISHED on hardware, and inert on our corpus, where every switch-on with WY 0 has the window enabled. The comparison with line 153 rather than the register&rsquo;s 0 is read from our source and inert, since the wrap clears the condition anyway.</div>' +

    '<div class="gbemu-rule" id="gbr-11-3"><b>Rule 11/3. The window&rsquo;s x counter.</b> A per-line counter (<code>win_px</code>) starts at 0 at mode-3 entry. It rises by <b>seven increments before the first pixel is drawn</b> (the priming increments: its values 0 to 6 stand for the hardware&rsquo;s positions &minus;7 to &minus;1, and they are what make WX = 7 place the window at screen column 0), then by one for each pixel popped toward the screen. A fine-scroll discard pop does not increment it (Rule 11/13).</div>' +
    '<div class="gbemu-rule" id="gbr-11-4"><b>Rule 11/4. The takeover.</b> When the x counter reaches WX (appendix E.8 gives the comparison in full, with its one-dot correction), and the Y condition holds, and the window is enabled, the window takes over: the background queue is cleared and the fetcher restarts against the window map. <b>The row counter does NOT increment here.</b> The window renders from its CURRENT row and the row advances afterwards (Rule 11/5).</div>' +
    '<div class="gbemu-why"><b>Why.</b> Incrementing first skips row 0 and shows the wrong window row for the whole frame, which dmg-acid2 draws as an eye where the right chin should be.</div>' +

    '<div class="gbemu-rule" id="gbr-11-5"><b>Rule 11/5. When the row counter advances.</b> <b>The row counter increments at the END of each activation</b> (an activation runs from a takeover to the dot it ends), and it has <b>two increment sites</b>, both required:' +
      '<ul class="gbemu-bullets">' +
        '<li><b>Site 1: the end of an activation mid-line.</b> On the dot window-enable reads low at the fetcher&rsquo;s tile-number step (Rule 11/7 gives the dot and the reading), if the window is active: <b>increment, then deactivate</b>.</li>' +
        '<li><b>Site 2: the line wrap.</b> At the wrap, if the window is <em>still</em> active: increment. This is the same rule: the wrap is simply how an activation that ran to the end of the line is ended. E.5 places it in the wrap ordering (<a href="#gbr-E-5-10">Rule E.5/10</a>).</li>' +
      '</ul>' +
      'Between them every activation increments exactly once, and a line that never activated the window increments not at all. If the window is hidden on a line, <b>its row counter does not advance</b>; re-enabling it later resumes at the same row.</div>' +
    '<div class="gbemu-rule" id="gbr-11-6"><b>Rule 11/6. When the row counter returns to 0.</b> At the wrap into line 0, at the switch-on and at the switch-off of the display. Nowhere else: a WY or LCDC write does not reset it. The table gives every event that changes the window&rsquo;s per-frame state.</div>' +
    '<table class="gbemu-table"><thead><tr><th>Event</th><th>Y condition (Rule 11/2)</th><th>Row counter</th><th>Frame flag (the window has taken over on some line of this frame, Rule 11/14)</th></tr></thead><tbody>' +
      '<tr><td>Wrap into line 0</td><td>cleared</td><td>0</td><td>cleared</td></tr>' +
      '<tr><td>Display switched on</td><td>set if WY is 0, else cleared</td><td>0</td><td>cleared</td></tr>' +
      '<tr><td>Display switched off</td><td>cleared</td><td>0</td><td>cleared</td></tr>' +
      '<tr><td>A dot on which WY equals the line counter and window-enable reads set</td><td>set</td><td>unchanged</td><td>unchanged</td></tr>' +
      '<tr><td>Takeover (Rule 11/4)</td><td>unchanged</td><td>unchanged</td><td>set</td></tr>' +
      '<tr><td>Site 1 or site 2 with the window active (Rule 11/5)</td><td>unchanged</td><td>+1</td><td>unchanged</td></tr>' +
      '<tr><td>A write to WY or LCDC</td><td>unchanged by the write itself</td><td>unchanged</td><td>unchanged</td></tr>' +
    '</tbody></table>' +
    '<div class="gbemu-why"><b>Why.</b> The resets are read from our source.</div>' +
    '<div class="gbemu-example"><b>Example.</b> <b>What Rule 11/5 looks like.</b> Toggle the window&rsquo;s ' +
    'enable bit so the ' +
    'window draws on alternate lines only. Its row counter advances once on each line where it drew ' +
    'and not at all on the lines between, so <b>every row of the window is drawn, in order, once ' +
    'each</b>: rows 0, 1, 2, &hellip; land on screen lines L, L + 2, L + 4, &hellip;, with background ' +
    'lines between them. The window&rsquo;s image is <b>spread over twice the height</b>, not cut. A core ' +
    'that derives the row from the screen line instead draws rows 0, 2, 4, &hellip; and loses every ' +
    'other row. Toggle it <em>mid-line</em> instead ' +
    'and you get the same mechanism at finer grain: the counter increments <b>at the end of each ' +
    'activation</b>, so a second activation on the same line displays the <em>next</em> row of ' +
    'window pixels on that same line.</div>' +

    '<div class="gbemu-rule" id="gbr-11-7"><b>Rule 11/7. Site 1: which dot, and which reading of the bit.</b> The test is made on the tile-number step&rsquo;s <b>second</b> dot (pos 1, the dot the tile-number read itself executes on), and it reads window-enable as the comparator&rsquo;s view of it stood <b>two dots earlier</b> on the line (dots of an object stall count among those two): on an uninterrupted fetch, that is the previous fetch&rsquo;s push dot. That view takes a set or a clear from C &minus; 2 (E.9.1), so a tile-number step that executes on C or later acts on the new value and one that executes on C &minus; 1 or earlier acts on the old.</div>' +
    '<div class="gbemu-example"><b>Example.</b> Measured on <code>m3_lcdc_win_en_change_multiple_wx</code>: a clearing write with C on dot 100 stops line 2&rsquo;s window at its step on dot 100, and does not stop line 1&rsquo;s at its step on dot 99; line 1&rsquo;s window runs on to its next step, on dot 107, and stops there, because the setting write that follows has C on 108.</div>' +
    '<div class="gbemu-why"><b>Why.</b> In our source the delay is <code>WIN_ABORT_DELAY</code> = 3: the bit is kept in a per-dot history and read three entries back, counting the current dot. Reading it on the step&rsquo;s first dot (pos 0) through a view one dot later (C &minus; 1) is the same rule wherever no stall falls between the two dots. Its cost, measured on the shipped core: the bit taken on the current dot, the original&rsquo;s board 24 of 24 to 23 of 24 (<code>m3_lcdc_win_en_change_multiple_wx</code> 79&nbsp;px); one dot back, 40&nbsp;px; three dots back, 24&nbsp;px; the Mooneye cartridges unmoved. The dots are INSTRUMENT-MEASURED; the two-dot delay is FITTED (our source fits it to that cartridge&rsquo;s tile counts). Applying E.9.1&rsquo;s C &minus; 2 on the step&rsquo;s body dot instead gives 79 differing pixels. Site 1 is the site that makes a mid-line toggle show the next window row.</div>' +
    '<div class="gbemu-rule" id="gbr-11-8"><b>Rule 11/8. What the fetcher does after site 1.</b> The deactivation does not restart the fetcher: the same tile-number step goes on to form a background address, and its column is <code>((SCX &gt;&gt; 3) + n) &amp; 31</code>, where n is the fetcher&rsquo;s tile counter. That counter was reset to 0 when the window took over and counts every tile pushed since, so n is the number of window tiles pushed in this activation, not the number of tiles pushed on the line. A second activation on the same line resets it again.</div>' +
    '<div class="gbemu-example"><b>Example.</b> SCX = 16, the window takes over and pushes 3 window tiles, then site 1 deactivates it: the background map column read is <code>((16 &gt;&gt; 3) + 3) &amp; 31</code> = 5, whatever number of background tiles the line pushed before the takeover.</div>' +
    '<div class="gbemu-why"><b>Why.</b> Read from our source.</div>' +
    '<div class="gbemu-why"><b>Why both sites, measured.</b> Any account that states either site alone describes a different machine. <b>INSTRUMENT-MEASURED on the shipped core</b>, by counting each site ' +
    'separately over a full run of three cartridges. <code>m3_lcdc_win_en_change_multiple</code> ' +
    'activates the window twice on every line and the counter advances <b>twice per line</b> (' +
    'once at site 1 on dot 154 and once at site 2), which is exactly the ' +
    '&ldquo;second activation shows the next row&rdquo; sentence above, observed rather than ' +
    'argued. <code>m3_lcdc_win_en_change_multiple_wx</code> reaches site 1 on 4,227 lines of the ' +
    'run; with site 1 absent that cartridge never advances its window row at all. ' +
    '<code>m2_win_en_toggle</code> reaches site 1 <b>zero</b> times and site 2 on 9,951 lines: it ' +
    'cannot see the difference, which is why a core built from E.5 alone passes it and still ' +
    'renders the other two wrong. That a line that never activated the window increments not at all is what <code>m2_win_en_toggle</code> pins, and it is the half E.5 alone gets right. <b>Falsifier:</b> either count coming out at zero on an ' +
    'instrumented build of the shipped core.</div>' +
    '<div class="gbemu-why"><b>Why it is a state variable.</b> MECHANISM: the window&rsquo;s row counter is a state variable, not a function of the screen line, and this is the single most expensive thing on the page to get wrong. Deriving it from the screen line passes casual titles and looks right forever. On our board, deriving it from the screen line is the heaviest failure on the whole grid: <b>6,067 differing pixels</b> on <code>m3_lcdc_win_en_change_multiple</code>, one of the 24 monochrome mealybug cells. With the two increment sites of Rule 11/5, that cell is at 0 px on the shipped core. The mechanism is measured directly, by counting each site, in the box above. Deriving the window row from LY passes every commercial game you will try and fails two test cartridges outright. It is the single most common way to be 95% correct forever.</div>' +

    '<div class="gbemu-rule" id="gbr-11-9"><b>Rule 11/9. The x counter starts at 0.</b> The seven increments of Rule 11/3 are a <em>process</em> and not a starting value: the counter is 0 at mode-3 entry and reaches 7 only through them. What could go negative is the <b>comparator&rsquo;s operand</b>, not the counter: the comparator subtracts a one-dot correction for a counter that has already advanced on this dot (<code>priming_bump</code>, defined once, in appendix E.8). A build that subtracts it at counter 0 evaluates &minus;1 there, and must not let that wrap to 255 in unsigned arithmetic.</div>' +
    '<div class="gbemu-why"><b>Why.</b> &ldquo;The counter starts at 0&rdquo; and &ldquo;it is primed before the visible line, so its operand goes negative&rdquo; cannot both be true of one quantity, and they are not one quantity. The difference is testable: start the counter at 7 instead and the comparator matches on the first dot of mode 3, before the processor has had a chance to write WX for this line, so a title that writes WX during the priming is judged against the <em>previous</em> line&rsquo;s value. An operand of &minus;1 evaluated in unsigned arithmetic wraps to 255, which gets the takeover position wrong at small WX and nowhere else: a fault that hides in a corner of one cartridge and is invisible everywhere else. That warning applies to any build that does subtract at counter 0; it does not describe ours (Rule 11/10).</div>' +
    '<div class="gbemu-rule" id="gbr-11-10"><b>Rule 11/10. Two kinds of line.</b> A <b>line primed by a write</b> is a line on which a WX write took effect while the priming fetch was still outstanding: the new WX is first seen by the picture unit on one of line dots 85 to 89. The one-dot correction of Rule 11/9 is applied only on such a line. On the shipped core the operand never evaluates to &minus;1:</div>' +
    '<table class="gbemu-table"><thead><tr><th>Kind of line</th><th>Comparator opens on (dot, event scale, from the line&rsquo;s dot 0)</th><th>Correction subtracted</th><th>WX 0 to 7 take over on (dot, event scale, from the line&rsquo;s dot 0)</th></tr></thead><tbody>' +
      '<tr><td>Primed by a write (new WX first seen on dots 85 to 89)</td><td>after seven dots of mode 3 without an object fetch have passed: dot 90 at the earliest</td><td>this dot&rsquo;s priming increment, so the earliest operand it ever evaluates is 0</td><td>90 + WX (with no object fetch on the line before the takeover)</td></tr>' +
      '<tr><td>Every other line</td><td>the first dot of mode 3, line dot 84</td><td>nothing</td><td>WX = 0 takes over on dot 84 (E.8.1 has each other WX)</td></tr>' +
    '</tbody></table>' +
    '<div class="gbemu-example"><b>Example.</b> A line on which WX = 3 is first seen on dot 87, with no object fetch: the comparator stays closed until dot 90 and the window takes over on dot 93. On a line where WX = 0 has stood since before mode 3, the window takes over on dot 84.</div>' +
    '<div class="gbemu-why"><b>Why.</b> Appendix E.8.1, &ldquo;Two kinds of line&rdquo;, has both kinds measured, and what each WX then does. <b>The counter, the correction, the enable and WX are four terms and this section states them in four places.</b> They compose into one comparison and an implementer holding only the fragments cannot write it down: <b>appendix E.8 is that comparison as a single expression</b>, with each term carrying the section it comes from and a flexibility clause for the two of the four that are ours rather than the machine&rsquo;s.</div>' +

    '<h4 class="gbemu-sub">The window does not inherit the background&rsquo;s fine scroll</h4>' +
    '<div class="gbemu-rule" id="gbr-11-11"><b>Rule 11/11.</b> <b>When the window takes over a line, the pending <code>SCX&nbsp;&amp;&nbsp;7</code> discard belongs to the background fetch that was just abandoned, and it must be abandoned with it.</b> What is abandoned is the pixels, not the time: on the original the discard&rsquo;s dots are still spent, as a stall that drops no window pixel. On the Colour they are not spent.</div>' +
    '<div class="gbemu-why"><b>Why.</b> Leave the discard standing and the window&rsquo;s own first pixels are thrown away instead, so the window slides horizontally with the background&rsquo;s fine scroll, which on hardware it ignores entirely. The dots stay on the original because the hardware ends drawing at the same dot for every WX from 1 to 165 (appendix E.8.1). <b>No test cartridge on the board scores this.</b> It shows up as a status bar that judders while the playfield scrolls underneath it: visible in Super Mario Land 2 and Looney Tunes, in their attract demos, from about frame 1,300 of a run with <em>no input at all</em>, so a scripted check that presses buttons and lands in a non-scrolling room does not see it. Measured rather than eyeballed: over sixteen consecutive frames the window rows&rsquo; displacement equalled <code>SCX&nbsp;&amp;&nbsp;7</code> at every frame, quality 1.00: a 0-to-7-pixel sawtooth tracking the fine scroll exactly, not lagging it. The boundary between the displaced rows and the correct ones is <b>exactly WY</b> in both games. A mid-line scroll rewrite landing a few dots late is not the cause: logging every display-register write in a scrolling frame shows that neither cartridge rewrites scroll mid-line at all.</div>' +
    '<div class="gbemu-why"><b>Why it is safe.</b> <b>It is a change of scope, not of value.</b> The discard&rsquo;s value and the dot at which it is latched are pinned by two banked cartridges and by a 252-probe table of mode-3 lengths; voiding the discard <em>at the takeover</em> leaves both untouched. A counter at the two takeover sites, exercised in both directions first, shows <b>50 of 252 probes and 13 of 33 cartridges do take a window takeover</b>, and a length recorder shown sensitive on three cartridges then finds <b>zero</b> length changes across all 285. The arm changes which pixels are dropped, not how many dots are spent. <b>Board movement: 0 of 264.</b> It is worth nothing on any scoreboard and it is the most visible fix on this page.</div>' +
    '<div class="gbemu-rule" id="gbr-11-12"><b>Rule 11/12. The latch dot.</b> The fine-scroll count (<code>SCX &amp; 7</code>) is fixed on <b>line dot 89</b>: five dots after mode-3 entry at dot 84, on the <em>last dot of the priming fetch</em>, the dot on which the fetcher restarts; the first real tile fetch takes its first step on dot 90 (Rule 9/2). It is read from the live SCX at that instant, not at mode-3 entry.</div>' +
    '<div class="gbemu-example"><b>Example.</b> SCX reads 0x02 through dot 88 and 0x05 from dot 89: the line discards 5 pixels. SCX reads 0x05 through dot 88 and 0x02 from dot 89: the line discards 2. A build latching at mode-3 entry (dot 84) discards 2 in the first case and 5 in the second.</div>' +
    '<div class="gbemu-why"><b>Why.</b> A page that names a constant and withholds it is worse than one that never mentioned it (section 19), and an unstated latch dot is the single highest silent-divergence risk for an implementation here. <b>MECHANISM, and the source of the mechanism is a hardware statement</b>: ' +
    '<code>m3_scx_low_3_bits</code>: <i>&ldquo;the lowest 3 bits appear to be read at the ' +
    'start of the B of the first B01s read cycle&rdquo;</i>. <b>Why the other reading fails, since ' +
    'it is the obvious one:</b> latching at mode-3 entry reads SCX two dots before the processor ' +
    'writes it, so every line spends the PREVIOUS line&rsquo;s fine scroll (measured on ' +
    '<code>m3_window_timing_wx_0</code>: with the latch at mode-3 entry its law is ' +
    '<code>4 &minus; ((SCX &minus; 1) &amp; 7)</code>; with the latch at 89 it is <code>4 &minus; (SCX &amp; 7)</code>). <b>Falsifier:</b> an instrumented build of the shipped core latching ' +
    'the discard on any dot but 89 at <code>SCX &amp; 7 = 0</code>. Measured: 89.</div>' +

    '<h4 class="gbemu-sub">And a second rule on the same axis, at a different site: the takeover comparator does not count the discards</h4>' +
    '<div class="gbemu-rule" id="gbr-11-13"><b>Rule 11/13.</b> <b>The window&rsquo;s x counter (Rule 11/3) must not increment when the output path consumes a fine-scroll discard pixel.</b> A discard pop is <em>a pixel the scroll owes</em>, not a step of the window&rsquo;s position, and that counter is exactly what the takeover comparator tests against WX. At the takeover, therefore, <code>win_px &minus; lx == 7</code> whatever <code>SCX &amp; 7</code> is.</div>' +
    '<div class="gbemu-example"><b>Example.</b> The Colour acid cartridge, <code>SCX&nbsp;&amp;&nbsp;7&nbsp;=&nbsp;4</code>, WX = 33: the takeover lands at screen column 33 &minus; 7 = 26. A build that counts the four discard pops reads <code>win_px &minus; lx == 7 + (SCX&nbsp;&amp;&nbsp;7)</code> = 11 at the takeover, so takeover at <code>win_px&nbsp;==&nbsp;WX&nbsp;==&nbsp;33</code> lands at <code>33&minus;7&minus;4&nbsp;=&nbsp;22</code>: the window origin inherits the background&rsquo;s fine scroll.</div>' +
    '<div class="gbemu-why"><b>Why.</b> <b>These are two rules and not one, and they are easy to confuse: conflate them and the second fault survives.</b> Rule 11/11 voids a <em>pending</em> discard <b>at the takeover</b>. Rule 11/13 is about what the comparator reads <em>on the way to</em> the takeover. <b>MECHANISM.</b> The rule <em>removes</em> a term and introduces no constant. <b>Note where the damage is NOT.</b> At the takeover dot the pending discard count reads <b>zero</b>: the four discards were spent early in the line, long before the window&rsquo;s position matched. So Rule 11/11, which voids a <em>pending</em> discard, <b>cannot reach this fault and is not the site</b>. <b>The damage is not that the window drops the pixels; it is that the comparator counted the pops that dropped them.</b> Two clauses, two sites, one axis, and a reader who implements only the first will reproduce this fault exactly.</div>' +
    '<div class="gbemu-why"><b>Evidence.</b> On a build that counts the discard pops, the takeover relation <code>win_px &minus; lx == 7 + (SCX&nbsp;&amp;&nbsp;7)</code> (the seven priming increments plus one per discard pop) measures <b>11 on every activating line, 432 takeover records, zero violations, one distinct value</b> on the Colour acid cartridge with <code>SCX&nbsp;&amp;&nbsp;7&nbsp;=&nbsp;4</code>; the no-scroll control gives a gap of exactly <b>7</b> where <code>SCX&nbsp;&amp;&nbsp;7&nbsp;=&nbsp;0</code>. The takeover lands at 22 where scroll-independent gives 26: <b>the four-pixel displacement is the four counted discards, one for one.</b> <b>INSTRUMENT-MEASURED</b>, on our own core, with an observation-only instrument proved behaviourally neutral (probe and control render the cartridge byte-identically at all checkpoints compared). <b>Falsifier:</b> the relation failing at the takeover on that cartridge, or a probe build whose framebuffer differs from the control&rsquo;s. The gate behind it, proven in both directions: five builds, one cartridge, framebuffer hashes over all 65 checkpoints; the knob at its off value is <b>byte-identical to the unmodified tree</b>; the two settings <b>differ</b> on an observable; a compiler define turns the arm <em>on</em> from the control source and <em>off</em> from the arm source. <b>All five hashes fall into exactly two classes.</b> That is the whole of what a gate has to show, and a sweep that cannot show it is measuring nothing.</div>' +
    '<div class="gbemu-why"><b>THE ROW STILL FAILS, and it is reported that way.</b> Rule 11/13 takes <code>cgb-acid-hell</code> from <b>120 px to 2 px</b> (120 differing pixels without the rule, 2 with it); with it, rows 136, 137 and 138 are byte-exact against the reference and the band is at x 26 (x 22 without it). The two survivors are a greyscale delta of <b>226</b> against the suite&rsquo;s tolerance of 50, so the suite&rsquo;s own comparator returns FAIL with and without the rule: worst delta 226 (255 without it). <b>Board movement: 0 of 264</b>, with the other 263 rows byte-identical. Cost across every instrument this project holds: <b>zero</b>. <b>118 of 120 pixels is not a win on this board and is not reported as one</b>: section 22 carries the row and the two unattributed pixels. It ships for a reason that is <em>not</em> the trade rule&rsquo;s: <i>it closes a real defect the corpus cannot see, and leaving it in means the next window defect hides behind it.</i> <b>And the corpus fact behind it, which is worth more than the fix:</b> no cartridge in this project&rsquo;s entire scored set supplies the stimulus this clause needs: a non-zero <code>SCX&nbsp;&amp;&nbsp;7</code> with the window at or past position 7, so the discards are spent <em>before</em> the position match rather than after it. <b>One witness in 264 rows, and it is the failing row itself.</b> Appendix G.6 carries the census, the live negative control inside it, and what it means for anyone scoring their own build.</div>' +

    '<div class="gbemu-rule" id="gbr-11-14"><b>Rule 11/14. Turning the window off part-way through a frame leaves a mark on the original Game Boy.</b> Once the window has taken over on some line of the frame and LCDC bit 5 is then cleared, a later line whose WX lands on a tile boundary (<code>(WX &amp; 7) == 7 - (SCX &amp; 7)</code>) gets one extra colour-0 pixel at <code>WX - 7</code>, and the rest of that line moves one pixel right. The Color does not do this. The core keeps one more flag for it: whether the window has taken over during this frame (the frame flag of Rule 11/6&rsquo;s table). <b>This is the same insertion as appendix E.8.3&rsquo;s first bullet, with a second way to arm it</b>, not a second mechanism: E.8.3 states the whole rule, both arms and every shared condition.</div>' +
    '<div class="gbemu-example"><b>Example.</b> SCX &amp; 7 = 0: the condition is <code>(WX &amp; 7) == 7</code>, so WX 7, 15, 23 and so on qualify. With WX = 15 on a later line of such a frame, screen column 8 gets the extra colour-0 pixel and the line&rsquo;s pixels from there on sit one column further right.</div>' +
    '<div class="gbemu-why"><b>Why.</b> MECHANISM for the frame flag, read from our source, <code>WIN_DIS_INSERT</code>. MEASURED: on a test grid of 64 cells the line moves by one pixel on exactly the 8 cells the rule names and on none of the other 56 or of 64 controls, and the reference agrees on all 64; Star Trek: 25th Anniversary&rsquo;s playfield lines up with the rule (one pixel left without it). The 264-row board does not move.</div>' +
  '</section>' +

  /* ---------------------------------------------------------------- 6 */
  '<section class="sect" id="gbe-6"><h3 class="sect-h">12. Sprites stall the pipeline</h3>' +
    '<div class="gbemu-rule" id="gbr-12-1"><b>Rule 12/1. Model the freeze, not the penalty.</b> A sprite fetch is not a separate renderer. It is something the background pipeline <b>runs through</b>: the fetcher freezes mid-step, the sprite&rsquo;s two data reads happen, and the background fetch resumes where it stopped.</div>' +
    '<div class="gbemu-why"><b>Why.</b> The famous &ldquo;6 to 11 dots per sprite&rdquo; is that freeze, and its length varies because it depends where in its own step the fetcher was when the sprite arrived. If you add dots to a counter instead, you will get the line length right and every register write inside the freeze wrong.</div>' +
    '<div class="gbemu-rule" id="gbr-12-2"><b>Rule 12/2. The wait and the fetch.</b> <b>A sprite has no cost. It has a place in a queue behind a fetcher that is part-way through a cycle.</b> For an object at OAM X 8 or more, the wait is the distance to the recurring three-dot <b>phase window</b> inside the fetcher&rsquo;s eight-dot cycle, <b>positions 4, 5 and 6 of the eight: the three dots ending immediately before the push, not including it</b>, and the fetch itself is an unconditional six. The phase window does not suspend during a stall, it <em>stretches</em>: a second sprite arriving mid-stall meets an open phase window and is served at once. Appendix E.3 has the rule in full.</div>' +
    '<div class="gbemu-why"><b>Why.</b> Written that way there is <b>no clamp and no constant</b>: the &ldquo;floor of 6&rdquo; that every table quotes appears in neither reference implementation as a number at all. In one it is a guard that is already false, in the other it is the sprite test sitting inside an already-granted permission. <b>A special case for &ldquo;the first one&rdquo; almost always means a missing state variable, not a missing constant.</b> <b>First qualification: the three-dot phase window is CONVERGENCE, not mechanism.</b> Both reference implementations read three and our own dwell instrument measures three on this fetcher; <b>no hardware document states it</b>, so it does not fall out of the fetcher&rsquo;s structure. And the width alone is not enough: <b>two different three-dot windows fit a width of 3</b> (an implementer given only the width has a coin to flip and no way to know it). Appendix E.3 carries the argument for positions 4, 5 and 6, and it carries the one forced by silicon rather than the circular one written in our own source.</div>' +
    '<div class="gbemu-rule" id="gbr-12-3"><b>Rule 12/3. Clipped objects.</b> For a clipped object (OAM X 0 to 7) this core bypasses the phase window entirely and uses <code>begin = 89 + X</code>, <code>end = max(100, begin + 6)</code> (dots, event scale). An object hidden off the left edge at OAM X 1 to 7 costs exactly what the same object eight pixels to the right (X + 8) costs, at every fine scroll, on both machines. OAM X 0 keeps its own row. Appendix E.3.1 has the wait in dots.</div>' +
    '<div class="gbemu-example"><b>Example.</b> OAM X 0: <code>begin = 89</code>, <code>end = max(100, 95) = 100</code>. OAM X 3 at SCX 0 costs what OAM X 11 costs at SCX 0.</div>' +
    '<div class="gbemu-why"><b>Why.</b> <b>Second qualification: &ldquo;no clamp and no constant&rdquo; is true of the phase window and false of this core as shipped</b>: for clipped objects there is <b>a clamp and two constants, both read off an oracle</b>. The famous ladder is produced by <em>two</em> mechanisms in two regimes, and an implementation of the phase window alone will not reproduce the clipped column. The X 1 to 7 equality holds because the hardware table of the AGE test <code>stat-mode-sprites</code> (verified on DMG-CPU C and CPU CGB B, C and E) reads the row for X the same as the row for X + 8.</div>' +
    '<div class="gbemu-rule" id="gbr-12-4"><b>Rule 12/4. The two elevens.</b> <code>N</code> sprites <em>stacked</em> at one X cost <code>11 + 6(N&minus;1)</code> dots: the first eleven, every later one six. <code>N</code> sprites <em>spread</em> eight apart cost <b>eleven each</b>. Both figures are at the residue where one object costs 11, <code>(OAM X + SCX) mod 8 = 0</code> (the ladder of E.3.1).</div>' +
    '<div class="gbemu-example"><b>Example.</b> Three sprites stacked at X = 48, SCX 0: 11 + 6 &times; 2 = 23 dots. Three sprites at X = 48, 56 and 64, SCX 0: 3 &times; 11 = 33 dots.</div>' +
    '<div class="gbemu-why"><b>Why.</b> <b>The two elevens are different quantities, and conflating them is the commonest way to be wrong about this.</b> Quoting &ldquo;the sprite stall is 11&rdquo; without naming the geometry says nothing.</div>' +
    '<div class="gbemu-why"><b>The 11 and the 6 in that one expression have completely ' +
    'different backing; they are not one figure.</b> <b>The 11 is HARDWARE-OBSERVED and it is ' +
    'the best-evidenced number on this page:</b> measured on silicon three independent ways. ' +
    'Blind, with the falsifier registered before the run (<em>77 px means eleven, 84 px means ' +
    'twelve, more than 3.5 px from both means neither</em>), reading 77.638 &plusmn; 1.56 and then ' +
    '76.748 &plusmn; 0.37 on a revised cartridge; slopes of &minus;11.086 &plusmn; 0.22 and ' +
    '&minus;10.9585 &plusmn; 0.070; a three-device floor at OAM X = 0; and a seam cell at OAM X = 8 ' +
    'reading 11.13 &plusmn; 0.30, excluding 10 at 3.8&sigma; and 12 at 2.9&sigma;. <b>The 6 has ' +
    'never been photographed by anyone</b>: our own consolidation says so in as many words, ' +
    'and it sits in the &ldquo;agreed by implementations, photographed by none&rdquo; bucket along ' +
    'with the alignment key&rsquo;s SCX term and the ramp shape. <b>Two restrictions travel with the ' +
    '11 and must not be dropped:</b> the three-device floor is a ruler downward only. The ' +
    'plot is twelve tile-rows tall, so every cost from 11 upward draws the same picture, and it ' +
    'establishes <b>eleven or more, never exactly eleven</b>, and only at OAM X = 0; and the ' +
    '&minus;11 slope does not exclude a third account, because all 36 of that cartridge&rsquo;s ' +
    'objects sit at <code>X &equiv; 0 (mod 8)</code>, where <em>&ldquo;the last pixel in the ' +
    'background queue counts&rdquo;</em> also gives &minus;11 and is indistinguishable. ' +
    '<b>Reporting note worth copying:</b> on the first photograph the <em>registered validity check ' +
    'failed</em> (calibration residual 0.2462 px against a 0.15 bar) and that was ' +
    'reported <b>above</b> the result, not under it.</div>' +
    '<div class="gbemu-rule" id="gbr-12-5"><b>Rule 12/5. No first-run discount.</b> The ladder contains no first-run discount, and this core ships without one.</div>' +
    '<div class="gbemu-why"><b>Why.</b> A first-run discount is <b>REFUTED</b>: neither reference implementation has a first-run special case and neither does the suite author&rsquo;s own arithmetic, our on-screen row at the current base is <code>11 10 9 8 7 6 6 6</code> with no discount term present, and the knob that would reinstate it is unreachable at the shipped configuration (passing either of its settings is a build failure). Appendix E.4 has the measurement and the caution that goes with it.</div>' +
    '<div class="gbemu-rule" id="gbr-12-6"><b>Rule 12/6. The wait must not depend on its own completion.</b> The pixel queue empties only when a pixel is output, and a waiting sprite stops output, so a wait defined as &ldquo;until the fetcher pushes&rdquo; can only be ended by its own ending. <b>Our rule for it</b>: a fetcher parked at its push with pixels still queued counts as inside the phase window, and the object is served at once (appendix E.3, &ldquo;The parked fetcher&rdquo;).</div>' +
    '<div class="gbemu-why"><b>Why.</b> <b>A structural trap with a name, because it will stop your core dead.</b> Built with a wait &ldquo;until the fetcher pushes&rdquo;, a core never ends mode 3 on a line with a single on-screen sprite. The guarantee that the wait must not depend on its own completion is a property of the machine, not of any one program: two reference implementations reach it by entirely different constructions, one inverting the precondition and the other routing the sprite branch outside the push gate altogether.</div>' +
    '<div class="gbemu-rule" id="gbr-12-7"><b>Rule 12/7. Height at the fetch.</b> Sprite height (LCDC bit 2) is read <em>at the fetch</em>, not latched at the scan (Rule 6/4 has the scan&rsquo;s own reading). A game that changes height between a sprite&rsquo;s two data reads gets one plane from an 8-pixel-tall sprite and the other from a 16-pixel-tall one: different rows of different tiles, in the same sprite.</div>' +
    '<div class="gbemu-why"><b>Why.</b> That behaviour is required, not optional: the reference demands a pixel value a core without it cannot produce anywhere in the frame.</div>' +
  '</section>' +

  /* ---------------------------------------------------------------- 7 */
  '<section class="sect" id="gbe-7"><h3 class="sect-h">13. Writes that land mid-line</h3>' +
    '<p class="hw-readable">This is what the hard tests are about, and what everything above exists to support. A register write from the processor lands on one specific dot. Whether it affects the pixel being drawn depends on whether the pipeline had already read that register for that pixel, and different parts of the pipeline read different registers at different moments.</p>' +
    '<div class="gbemu-rule" id="gbr-13-1"><b>Rule 13/1. Each fetcher step samples what it needs, when it needs it.</b> Do not snapshot the display registers at the start of a line, and do not read them live everywhere either. The map address is formed at step 1 (pos 1); the data base is decided at the data reads (pos 3 and pos 5, Rule 9/2). Those are different dots and a write can fall between them.</div>' +
    '<div class="gbemu-rule" id="gbr-13-2"><b>Rule 13/2. Register visibility.</b> <b>The lead is zero dots by default</b>: a write lands at the end of its machine cycle and a read samples at the end of its machine cycle, and they are the same instant. The departures from that are <b>per register</b>, they run &minus;1 to +3 dots, never four (a negative lead means the register latches <em>after</em> its cycle ends), and they are tabulated in appendix E.1. <b>One addition on the original:</b> with the screen on, a write to any of the seven drawing registers (LCDC, SCY, SCX, BGP, OBP0, OBP1, WX) lands one whole machine cycle (four dots) after its lead puts it; WY is not one of them. E.1 has it in dots.</div>' +
    '<div class="gbemu-why"><b>Why.</b> &ldquo;A write is gated roughly a machine cycle behind a read of the same register&rdquo; is a trap: it is two different facts wearing one sentence, and neither of them is &ldquo;roughly&rdquo;. The first is register visibility (Rule 13/2); the second is access blocking, where &ldquo;later&rdquo; is genuinely true and the number is 6 dots, not a machine cycle (Rule 14/2). <b>Distrust any note that calls this delay one machine cycle; the number is 6.</b> The one-machine-cycle addition is the counterpart of the running processor&rsquo;s earlier interrupts (Rule 13/6): the line-start look made alone costs 22 mealybug rows, because every mealybug write is timed from a mode-2 interrupt and would land four dots early; with the addition every mealybug picture stays where the hardware photographs have it (24 of 24, 0 pixels). WY is left out because no hardware table puts a WY write behind a running dispatch, and one window cartridge stops settling with it in. MECHANISM (one placement for every drawing register).</div>' +
    '<div class="gbemu-rule" id="gbr-13-3"><b>Rule 13/3. A register can have a committed value and a pending one.</b> Where a write and a read land on the same dot, which one the fetch sees is a real decision the hardware makes and your core must make the same way (E.1 gives it per register).</div>' +
    '<div class="gbemu-rule" id="gbr-13-4"><b>Rule 13/4. Palette writes take effect on the pixel reaching the screen</b>, not the pixel being fetched and not the pixel being popped. The queue holds colour indices; a popped pixel is paired with its object pixel and held for one dot, and the palette is applied as it leaves that one-dot output stage: a pixel popped on dot D leaves the output stage for the screen on dot D + 1 and takes the palette standing on dot D + 1.</div>' +
    '<div class="gbemu-example"><b>Example.</b> On an object-free line at SCX = 0, column x pops on dot <code>97 + x</code> and takes the palette standing on dot <code>98 + x</code>: column 0 pops on dot 97 and takes the palette of dot 98; column 159 pops on dot 256 and takes the palette of dot 257 (section 10 and appendix E.1.3, checked on pixels there).</div>' +
    '<div class="gbemu-why"><b>Why.</b> MECHANISM, read from our source (<code>ppu_out_emit</code>, with an output stage of one pixel on both machines). The palette applied on the pop dot is one dot early.</div>' +
    '<div class="gbemu-rule" id="gbr-13-5"><b>Rule 13/5. Where the interrupt test sits against the picture.</b> At each instruction boundary, in this order:' +
      '<ol class="gbemu-steps">' +
        '<li>Run the picture through the dots of the machine cycle that would fetch the next opcode, and leave the timer where the previous instruction left it.</li>' +
        '<li>Then make the interrupt test.</li>' +
      '</ol>' +
      'A request the picture raises on dot D (event scale) is seen by a test made on access-scale dot D + 1 or later. <a href="#gbr-E-5-5">Rule E.5/5</a> states the same drain from the machine-cycle side.</div>' +
    '<div class="gbemu-why"><b>Why.</b> This places almost every mid-line write in the test cartridges: those writes are made by interrupt handlers, so the dot each one lands on follows from the dot its interrupt was noticed on. Make the test before paying those dots and every handler starts four dots early, and every write it makes lands four dots early with it. MECHANISM, read from our source (<code>ppu_settle</code>, called at the boundary before the test). An independent build that tested before those dots lost four Mooneye rows on the Color (<code>intr_2_mode0_timing</code>, <code>intr_2_mode3_timing</code>, <code>intr_2_oam_ok_timing</code>, <code>vblank_stat_intr-C</code>) and about 11,000 mealybug pixels, and won them back by moving the test.</div>' +
    '<div class="gbemu-rule" id="gbr-13-6"><b>Rule 13/6. The look.</b> On the original, a <b>running</b> processor&rsquo;s interrupt test also sees an end-of-drawing request that rises in the next two dots, and a halted one does not. The same look is made at the start of each line, for the mode-2, coincidence and vertical-blank requests. It ships only together with Rule 13/2&rsquo;s one-machine-cycle addition for the drawing registers. The full rule, both clocks and the cost of each other placement are in appendix D.10.1; E.1 gives the write timing in dots; E.5 gives the order inside a machine cycle.</div>' +
    '<div class="gbemu-why"><b>Why.</b> The AGE tests <code>stat-int</code> and <code>halt-m0-interrupt</code> measure the running side, Mooneye&rsquo;s <code>hblank_ly_scx_timing</code> the halted side, and those AGE tables also ask for the line-start look. Both parts are MECHANISM (two sampling points; one placement for every drawing register); the look&rsquo;s two dots are FITTED.</div>' +
    '<p class="gbemu-key">The practical rule: when a fault will not resolve, stop asking <em>what value</em> was used and start asking <em>at which dot it was read</em>. A read that is correct and early, or correct and late, by one or two dots is the usual cause.</p></section>' +

  /* ---------------------------------------------------------------- 8 */
  '<section class="sect" id="gbe-8"><h3 class="sect-h">14. Interrupts, blocking, power</h3>' +
    '<div class="gbemu-rule" id="gbr-14-1"><b>Rule 14/1. The status interrupt is one line with four sources ORed together</b> (the mode-0, mode-1 and mode-2 sources and the coincidence source, each counted only when its STAT select bit is set), <b>and it raises a request only on that line&rsquo;s rising edge.</b> Write it as literally that and recompute it every dot.</div>' +
    '<div class="gbemu-why"><b>Why.</b> The much-discussed &ldquo;blocking&rdquo; behaviour is then not a feature you implement: it is what the expression does by itself when two enabled conditions overlap.</div>' +
    '<div class="gbemu-rule" id="gbr-14-2"><b>Rule 14/2. Access blocking.</b> <b>Access blocking must be driven by the live mode</b>, not by a dot count. Video memory reads return 0xFF while drawing; sprite memory returns 0xFF during the scan and the draw; writes are dropped in the same windows. <b>The edges:</b> reads block on the <em>live</em> mode and release on the <em>reported</em> one, while writes follow the <em>reported</em> mode at both edges (<b>a six-dot gap at the closing edge and none at the opening one</b>), so video-memory reads close six dots before mode 3 begins and writes close when mode 3 is reported. The access-window tables at the end of this section give every dot. <b>Exactly, on the original</b> (read from our source): a video-memory or sprite-memory <b>read</b> is refused while the live mode <em>or</em> the reported mode is 3 (and video memory for the six dots before mode 3); a <b>write</b> is refused while the reported mode is 3. One override: on a line on which the scan selected no object, the early mode-0 report of Rule 14/17 lifts the read block too, even while the live mode is still 3. On a line with an object fetch (E.6, case B) there is no such override: the early report lifts the write block at once, and the read block only when the live mode has also left 3.</div>' +
    '<div class="gbemu-example"><b>Example.</b> A line of case B whose last object fetch is still running when the early mode-0 report is made (E.6): from the report on, a write to video memory lands; a read of video memory returns <code>0xFF</code> until internal mode 3 ends (the fetch done, Rule 7/2), and returns the stored byte from then on. On an object-free line the same read returns the stored byte from the early report on.</div>' +
    '<div class="gbemu-why"><b>Why.</b> This is another reason the mode has to be real state. A build implementing one rule for both reads and writes will fail the write-timing rows. The behaviour is HARDWARE-OBSERVED on 19 samples of one cartridge; <b>the magnitude 6 is NOT ESTABLISHED</b>: it is a bare constant in our core with an anti-sweep tripwire and no account at its site. Appendix E.1.5; the sweep is at the end of this section.</div>' +
    '<div class="gbemu-rule" id="gbr-14-3"><b>Rule 14/3. Turning the screen off</b> holds the line counter at 0 and reports mode 0, and the status interrupt line <b>freezes at its last value; it does not drop</b>: the comparator and the mode sources stop being evaluated (the line-153 subsection below and appendix A.3). So switching the screen back on with a source still true raises no new edge. Turning it on starts the machine immediately, but <b>the first frame is not displayed</b>: the frame a switch-on starts writes nothing to the frame buffer, which keeps its previous contents until the next frame draws over them (<code>frame_discard</code>; section 19 has how that meets a screenshot).</div>' +
    '<div class="gbemu-why"><b>Why.</b> Without the undisplayed first frame, the boot sequence and one whole class of timing test behave wrongly.</div>' +
    '<div class="gbemu-rule" id="gbr-14-4"><b>Rule 14/4. The power-on line</b> is short and out of phase with an ordinary line. <b>The numbers: that line is 451 dots long, not 456, and mode 3 begins 76 dots into it, not 80</b>. On the access scale it runs from dot 8 (the enable write&rsquo;s access) to dot 458, and mode 3 is first seen on dot 85. It reports mode 0 through what would be the scan, raising no mode-2 status interrupt, while the scan itself still happens. Two details:' +
      '<ul class="gbemu-bullets">' +
        '<li>The interrupt-logic mode on that line is 0 from the enable write itself until mode 3 begins, so with the mode-0 (horizontal-blank) select set the status line rises at the enable write and requests a status interrupt there, unless the line was already high when the screen went off (it freezes while the screen is off, Rule 14/3). With only the mode-2 or mode-1 select set nothing is raised on that line.</li>' +
        '<li>The scan starts where the dot counter starts: slot k is examined on dot 9&nbsp;+&nbsp;2k instead of 5&nbsp;+&nbsp;2k, so slots 0 to 37 are examined and <b>slots 38 and 39 never are</b>: an object in either of the last two sprite-memory slots adds no stall on the power-on line (whose picture is never displayed).</li>' +
      '</ul></div>' +
    '<div class="gbemu-example"><b>Example.</b> Slot 37 is examined on dot 9 + 2 &times; 37 = 83, the last scan dot; slot 38 would be dot 85, after mode 3 has begun on dot 84. An object in slot 38 on the line after the power-on line is examined normally, on dot 5 + 2 &times; 38 = 81.</div>' +
    '<div class="gbemu-why"><b>Why.</b> The power-on line&rsquo;s length is the whole of your processor-to-dot phase constant. The two details are measured on our core. Appendix E.2 has the evidence, the sweep, and the two honest limits: the <em>length</em> is pinned exactly and the <em>mode-3 offset</em> is not, because the test samples on a four-dot grid.</div>' +
    '<div class="gbemu-rule" id="gbr-14-5"><b>Rule 14/5.</b> Once the screen is on, every line is exactly 456 dots of processor time, so <b>the phase established when the screen came up is fixed for the rest of the run</b>.</div>' +
    '<div class="gbemu-why"><b>Why.</b> Any program that cycles the screen erases whatever phase your reset established. Every real program does. Measured here, the entire pixel board is a pure function of the power-on line&rsquo;s length <b>modulo 4</b>: lengths four apart give pixel-identical output. <b>That is the direct statement that what these suites measure here is the phase and not the length</b>, and it is why a leaky write cycle (one that makes a line 457 dots) is not a small error but a phase that walks one dot per line for ever.</div>' +

    '<h4 class="gbemu-sub">The one architectural decision you cannot retrofit</h4>' +
    '<div class="gbemu-rule" id="gbr-14-6"><b>Rule 14/6. Two independent quantities.</b> <b>The signal that raises the status interrupt (the interrupt-logic mode, which drives the three mode sources) and the mode the status register reports are two independent quantities.</b> Carry the two separately from the first line of code; do not derive both from one live mode variable with a reporting lag on top. Both are separate again from the internal mode of section 7.</div>' +
    '<div class="gbemu-why"><b>Why.</b> Derive both from one live mode variable ' +
    'with a reporting lag on top and you have made them <em>one</em> degree of freedom, and ' +
    'then every sweep you run across phases, leads and skews reads as a wall, because the thing you ' +
    'need to move has nowhere to move to. The sharpest measurement of it: making the sprite-scan interrupt source ' +
    'a <b>one-dot pulse</b> rather than a held window costs <b>exactly one test</b> (the one ' +
    'that depends on it being held) and <b>nothing else in the corpus notices</b>. ' +
    'The window that test depends on is the mode-0 source held across the line ' +
    'boundary until the mode-2 source takes over on dot 2, not the mode-2 source itself. Measured on the shipped core (Rule 14/7&rsquo;s table has the dots): making the mode-2 source ' +
    'a one-dot pulse, or holding it through the whole scan, moves no Mooneye row on either machine and no ' +
    'mealybug pixel; dropping the mode-0 source at the line boundary instead fails ' +
    '<code>acceptance/ppu/stat_irq_blocking</code> on both machines and nothing else. The two ' +
    'shapes are otherwise indistinguishable, which is precisely what you would expect if the ' +
    'reported mode and the interrupt source were separate wires. <b>No parameter reaches this and no ' +
    'amount of tuning substitutes for it.</b></div>' +
    '<div class="gbemu-rule" id="gbr-14-7"><b>Rule 14/7. The mode sources, dot by dot, on the original.</b> One interrupt-logic mode drives the three mode sources, so at most one is high at a time and a change from one selected source to another on the same dot makes no edge; the coincidence source is ORed beside it. The interrupt-logic mode takes these values (&ldquo;none&rdquo; drives no source):</div>' +
    '<table class="gbemu-table"><thead><tr><th>Line</th><th>Dots (event scale, from the line&rsquo;s dot 0)</th><th>Interrupt-logic mode</th><th>Source high (if its select is set)</th></tr></thead><tbody>' +
      '<tr><td>1 to 143</td><td>0 and 1</td><td>0, held over from the previous line</td><td>mode 0</td></tr>' +
      '<tr><td>1 to 143</td><td>2 and 3</td><td>2</td><td>mode 2</td></tr>' +
      '<tr><td>0</td><td>0 to 2</td><td>1, held over from line 153</td><td>mode 1</td></tr>' +
      '<tr><td>0</td><td>3</td><td>2</td><td>mode 2</td></tr>' +
      '<tr><td>0 to 143</td><td>4 to 83 (the rest of the scan)</td><td>none</td><td>none</td></tr>' +
      '<tr><td>0 to 143</td><td>84 (the first dot of mode 3) until the mode-0 report (E.6)</td><td>3</td><td>none</td></tr>' +
      '<tr><td>0 to 143</td><td>after that, to the line&rsquo;s end (E.6 gives the dot the mode-0 source rises)</td><td>0</td><td>mode 0</td></tr>' +
      '<tr><td>144</td><td>0 to 5</td><td>0, held over from line 143</td><td>mode 0</td></tr>' +
      '<tr><td>144</td><td>6 to 455</td><td>1</td><td>mode 1</td></tr>' +
      '<tr><td>145 to 153</td><td>every dot</td><td>1</td><td>mode 1</td></tr>' +
    '</tbody></table>' +
    '<div class="gbemu-rule" id="gbr-14-8"><b>Rule 14/8. The requests at the frame edges.</b> <b>Line 144.</b> The vertical-blank request and the line-144 mode-2 request are raised together at the wrap into line 144, dot 0. The mode-2 one is not a source with a width: it is a single request written straight into IF, and only when the mode-2 select is set and the status line is low on that dot, so it can neither hold the line high nor block a later edge. Lines 145 to 152 have no mode-2 source at all. A selected mode-0 source is held from line 143 into line 144 and falls on dot 6, where the mode-1 source rises (appendix E.6&rsquo;s <code>VB_MODE_DOT</code>, <a href="#gbr-E-6-1">Rule E.6/1</a>). <b>The wrap into line 0.</b> The interrupt-logic mode stays 1 through dots 0 to 2 of line 0, so a selected mode-1 source is still high there, and becomes 2 on dot 3, where the mode-2 source rises; with both selects set the line stays high across the change and raises nothing. On the Colour the line-144 mode-2 request moves a machine cycle earlier (the Colour tab, section 10).</div>' +
    '<div class="gbemu-example"><b>Example.</b> Mode-1 and mode-2 selects both set, status line high through line 153: on line 0 the mode-1 source holds the line high on dots 0 to 2 and the mode-2 source on dot 3, so no rising edge and no request. With only the mode-2 select set, the line rises on dot 3 of line 0 and a request is raised there.</div>' +
    '<div class="gbemu-why"><b>Why.</b> MECHANISM for the sources, read from our source: <code>int_mode</code> is set to &minus;1 (&ldquo;none&rdquo;) at <code>LINE_PRE</code>, dot 4. The Color tab&rsquo;s section 10 lists every source in absolute dots.</div>' +
    '<div class="gbemu-rule" id="gbr-14-9"><b>Rule 14/9. What STAT reports at the frame edges</b> is separate from the sources (Rule 14/6). The original reports mode 0 for one machine cycle at both frame edges: an access on access-scale dots 0 to 4 of line 0 reads mode 0 and one from dot 5 reads mode 2; line 144 likewise reads mode 0 on dots 0 to 4 and mode 1 from dot 5. The report changes as dot 4 is processed, the dot every other line&rsquo;s mode-2 report changes on; the requests and the access windows keep their own dots. The Colour at single speed reads mode 0 on dots 0 to 2 of line 0 and mode 2 from dot 3 (the access-window tables below have both devices). The no-boot hand-over of section 3 is not a wrap: it stores mode 2 directly.</div>' +
    '<div class="gbemu-why"><b>Why.</b> FITTED to the AGE <code>stat-mode</code> table for DMG-CPU C.</div>' +
    '<div class="gbemu-why"><b>A resolution bound that goes with it</b>, and it will save you an argument: an interrupt is recognised at a machine-cycle boundary, so <b>any statement of the form &ldquo;the source rises N dots before the mode changes&rdquo; is over-specified by construction</b>. The honest form is &ldquo;in the machine cycle before&rdquo;. The same fact means a timing suite can never see more than three dots of any phase you place, however carefully you place it.</div>' +
    '<div class="gbemu-rule" id="gbr-14-10"><b>Rule 14/10. Which boundary.</b> The processor tests for a request at <b>instruction</b> boundaries, once after each instruction&rsquo;s last machine cycle, and at every machine cycle only while halted (appendix D.8 and D.10.1). Across a longer instruction a request waits for the instruction to finish.</div>' +
    '<div class="gbemu-why"><b>Why.</b> The timing suites mostly wait halted or in runs of one-cycle instructions, which is why the quantum they see is one machine cycle.</div>' +
    '<div class="gbemu-rule" id="gbr-14-11"><b>Rule 14/11. The dispatch holds (the &ldquo;dispatch-eligibility lag&rdquo; of the constants table below), on the original only.</b> When a rising edge of the status line raises a <b>new</b> request (the status bit was clear in IF before the edge), the status bit is set in IF at once but left out of the interrupt test:' +
      '<ul class="gbemu-bullets">' +
        '<li>for <b>3 dots</b> after any status edge on line 0 (the power-on line counts, because it is line 0; <a href="#gbr-E-6-2">Rule E.6/2</a>);</li>' +
        '<li>for <b>1 dot</b> after a <b>coincidence edge</b>: any rising edge of the status line raised while the coincidence term (select bit 6 and the flag) is high, including one that a mode source raises on the same dot.</li>' +
      '</ul>' +
      'Each hold is its own counter. The edge, raised while dot D is processed, arms the counter to the hold&rsquo;s length h; the counter is decremented at the head of each later dot; a test made after the picture has processed dot T sees the bit only when T is at least D + h, so tests ending on D to D + h &minus; 1 are withheld. A coincidence edge on line 0 arms both counters, and the bit is withheld while either runs. If the status bit was already set in IF when the edge came (the program wrote it, or an earlier request was not yet taken), no hold is armed, because there is no new request to delay. A processor write to IF does not touch a running hold: the hold only runs down, so while it runs the status bit stays hidden from every sample even if the program has just written it set, and writing it clear simply clears the bit. The Colour uses neither hold (the Colour tab, section 10).</div>' +
    '<div class="gbemu-example"><b>Example.</b> Line 0&rsquo;s mode-2 request is raised on dot 3 (D = 3, h = 3), so a test after dot 5 does not see it and a test after dot 6 (access-scale dot 7) does. A halted processor on the original samples after dots 4, 8, 12 and so on, so it takes the request at the sample after dot 8 (with no hold it would take it after dot 4); a hold of 4 gives the same halted sample, so a halted sample cannot tell 3 from 4. A running processor, whose look reaches two dots further (Rule 13/6), takes the request one machine cycle sooner than the halted one.</div>' +
    '<div class="gbemu-why"><b>Why.</b> Which edges arm the hold, and that only a new request is held: MECHANISM, read from our source (<code>LYC_DISPATCH_LAG</code>, <code>LINE0_DISPATCH_LAG</code>, <code>IRQ_HOLD_FRESH_ONLY</code>); the two lengths keep the label the constants table gives them. That an IF write does not touch a running hold is read from our source: the IF write stores the five bits and nothing else. That the two counters are separate and a coincidence edge on line 0 arms both is read from our source. Holding a request that was already set fails: a request the processor could already see can vanish between the two samples of a dispatch, which then takes address 0000 (the Pokemon Gold and Silver Spaceworld 1997 demos crash this way on the Game Boy). A hold of 4 dots hides line-start raises from the sample of the running processor&rsquo;s look at the start of the line (D.10.1).</div>' +
    '<div class="gbemu-why"><b>And the reason this section is thinner than it deserves, said plainly.</b> <b>Almost every instrument in this project is a pixel instrument.</b> A decision in the picture domain has six things pointed at it; a decision in the interrupt domain has one. The honest label for that domain&rsquo;s open questions is <b>unobservable with what we own</b>, not <em>unexamined</em>, and <b>&ldquo;we found nothing there&rdquo; and &ldquo;we cannot look there&rdquo; are the same sentence</b> if you do not write down which one you mean.</div>' +

    '<h4 class="gbemu-sub">A level comparator may not raise twice when its comparison never changed</h4>' +
    '<div class="gbemu-rule" id="gbr-14-12"><b>Rule 14/12.</b> The line-compare source is a <b>level</b>: the flag is &ldquo;the current line equals the compare register&rdquo;, and the interrupt is that level&rsquo;s <em>rising edge</em>. For <code>LYC = 0</code> the comparison is true <b>continuously</b> from line 153 across the wrap into line 0: the compared value does not change at that boundary. So there is exactly one rising edge, and a core must not produce two. The comparator&rsquo;s blind window at the start of a line (Rule 14/14) governs what the comparator <em>reads</em>, but it may not <b>manufacture a falling edge on a live match</b>.</div>' +
    '<div class="gbemu-why"><b>Why.</b> Where the second edge comes from is the useful part, because it is a feature every correct core has: the blind spot at the start of a line is real. A core that drops the flag at line 0 dot 0 and raises it again as dot 3 is processed (the blind window covering the four counter values 0 to 3: <code>LYC_BLANK_DOTS</code> = 4, armed at the wrap and decremented at the head of each later dot, live from the dot on which the counter reads 4; MECHANISM, read from our source) makes a second dispatch that re-enters the cartridge&rsquo;s handler and restarts its data pointer, putting a whole frame&rsquo;s palette schedule <b>one scanline late</b>. <b>The carry applies to exactly one event per frame</b>, and that blast radius is measured rather than hoped for: the compared value differs across every other line boundary, so no other wrap can carry, and line 153&rsquo;s own sequence (where the compared value genuinely does change) is untouched. The check that turned it from a plausible story into a finding is the <b>negative space</b>. A one-scanline error can only be visible where consecutive rows of the cartridge&rsquo;s own data table differ. With the other half of the fault corrected and this half not, the residual sits on exactly ten rows (7, 23, 39, 55, 79, 87, 95, 103, 119, 135): every row where the table changes, and <b>row 71 is absent</b>, because the two data blocks either side of it carry identical data. A residual that merely looked structured would have no reason to skip it; this one must. <b>MECHANISM.</b></div>' +

    '<h4 class="gbemu-sub">Line 153, dot by dot, and the blind spot&rsquo;s actual width</h4>' +
    '<p class="hw-readable">Line 153 has two different things at two different dot offsets: what the processor reads from the line register, and what the line comparator sees. <b>Every dot in this subsection is on the access scale</b> (Rule 14/16), counted from the line&rsquo;s dot 0: a value given for dot D is what an access sees when the line&rsquo;s dot counter reads D, and a change first seen on dot D happens as dot D &minus; 1 is processed.</p>' +
    '<div class="gbemu-rule" id="gbr-14-13"><b>Rule 14/13. What the processor reads from the line register (LY).</b> On the original, lines 1 to 153 take their new number at the wrap itself: an access on dot 0 of the line already reads it. <b>Line 153 is the exception.</b> An access on dots 0&ndash;1 reads <b>153</b>; an access on dots 2&ndash;455 reads <b>0</b> (the register changes as dot 1 is processed).</div>' +
    '<div class="gbemu-example"><b>Example.</b> On the original at single speed the processor&rsquo;s accesses fall on dots 1, 5, 9 and so on, so a program first reads a new line number at its access on dot 1, and on line 153 it reads 153 only at its access on dot 1; its access on dot 5 already reads 0.</div>' +
    '<div class="gbemu-why"><b>Why.</b> INSTRUMENT-MEASURED (<code>test/tabprobe</code>, the register as read). <b>The dot that split falls on is FITTED</b>: the constants table below carries it as such and no test we own separates it from its neighbours. <b>What is not fitted is the shape:</b> the register reads zero for very nearly a whole line before the frame wraps, and that is what an implementer must reproduce. <b>So a poll for &ldquo;the register reads 153&rdquo; has a window of <b>two dots in 456</b> on our value and a narrow one on any value</b>: a poll loop longer than that window can miss it forever. That is not hypothetical: one of our own bench cartridges polls for it, and in our own emulator its poll misses on every one of four million instructions. <b>Sync on 152, which is readable for a whole line, then delay a fixed count.</b> This early zero is the original machine&rsquo;s. The Colour shows a new line number later: first to an access on dot 1 at single speed and on dot 3 in double speed (measured the same way). On a Colour our core gives LY on line 153 its own dots: 153 from dot 0 and 0 from dot 4 at single speed, and 153 from dot 3 (the dot every other line changes on in double speed) and 0 from dot 9 in double speed, which the AGE hardware table for CPU CGB B and C passes. The Colour tab, section 10, has the table and the labels.</div>' +
    '<div class="gbemu-rule" id="gbr-14-14"><b>Rule 14/14. What the line comparator sees on line 153.</b> The comparator has a blind window at the start of <em>every</em> line during which its output is forced low. <b>On line 153 it is blinded a second time</b>, and the value it compares against changes from 153 to 0:</div>' +
    '<table class="gbemu-table"><thead><tr><th>Access dot (access scale, from line 153&rsquo;s dot 0)</th><th>Value compared against</th><th>Comparator</th></tr></thead><tbody>' +
      '<tr><td>0&ndash;3</td><td>153</td><td><b>blind</b>: output forced 0</td></tr>' +
      '<tr><td>4&ndash;7</td><td>153</td><td><b>live</b> &rarr; a match on 153 raises here</td></tr>' +
      '<tr><td>8&ndash;11</td><td>0</td><td><b>blind again</b>: output drops</td></tr>' +
      '<tr><td>12&ndash;455</td><td>0</td><td><b>live</b> &rarr; a match on 0 raises here</td></tr>' +
    '</tbody></table>' +
    '<div class="gbemu-example"><b>Example.</b> &ldquo;A match on 153 raises here&rdquo; at 4 means the flag, the status line and the request bit rise while dot 3 is processed and an access on dot 4 is the first to see them; likewise the match on 0 rises while dot 11 is processed and is first seen on dot 12. <b>So a compare value of 153 and a compare value of 0 can both fire on this one line, exactly <em>two</em> machine cycles apart</b>, at dot 4 and at dot 12. <b>Two machine cycles, not one:</b> the table puts the two events eight dots apart and a machine cycle is four dots, so a core built from a &ldquo;one machine cycle apart&rdquo; reading raises the second event four dots early.</div>' +
    '<div class="gbemu-why"><b>Why.</b> INSTRUMENT-MEASURED with the probe in our source tree (<code>test/tabprobe</code>, compare value 153 and 0, coincidence select set).</div>' +
    '<div class="gbemu-rule" id="gbr-14-15"><b>Rule 14/15. Three rules go with the sequence</b>, because the sequence alone is not enough to build.' +
      '<ul class="gbemu-bullets">' +
        '<li>The <b>coincidence flag</b> is the level <code>compared == target</code>, masked by the blind window.</li>' +
        '<li>The <b>interrupt</b> is the rising edge of the <em>whole</em> status line (the coincidence source ORed with the mode sources, Rule 14/1), not of the flag alone, so a mode source already holding the line high suppresses the coincidence dispatch.</li>' +
        '<li><b>A blind window may not manufacture a falling edge on a match that is already true</b> (Rule 14/12): a blind window never clears a flag that is already high while the comparison still holds (<code>LYC_CARRY</code>). It can act <em>only</em> at the 153-to-0 wrap, because the compared value differs across every other line boundary.</li>' +
      '</ul>' +
      '<b>Line 153&rsquo;s own sequence is untouched by the third rule</b>, because there the compared value genuinely changes, so no carry applies and both events still fire two machine cycles apart. With the screen <b>off</b>, the comparator stops, including its output: <b>the output freezes, it does not drop</b>.</div>' +
    '<div class="gbemu-example"><b>Example.</b> Compare value 0, flag high on the last dot of line 153 (it rose as seen from access dot 12): at the wrap into line 0 the comparison still holds, so the flag stays high through line 0&rsquo;s blind window (access dots 0 to 3) and the status line raises nothing there.</div>' +
    '<div class="gbemu-why"><b>Why.</b> MECHANISM, read from our source. The rule in our source is general, and the wrap is the only place it can act. One published document says the signal reads 0 while the screen is off; a test cartridge contradicts it, and the test wins. <b>Why it is worth building rather than skipping.</b> Drop the 153 window entirely (blind through dot 3, then straight to 0) and a match on 153 becomes <b>impossible</b>. <b>Prehistorik Man</b> sets its target to 153 and waits for exactly that interrupt. It hangs forever with a blank screen, and <b>no test cartridge notices.</b></div>' +
    '<p class="gbemu-key"><b>The five constants, stated outright with their labels, because an implementer has to implement a blind spot and needs to know how wide it is and where it ' +
    'opens.</b></p>' +
    '<table class="gbemu-table"><thead><tr><th>Constant</th><th>Our value (dots; a dot position is on the access scale, from the line&rsquo;s dot 0)</th><th>Label</th></tr></thead><tbody>' +
      '<tr><td>Start-of-line blind window</td><td><b>4 dots</b></td><td>MECHANISM: one machine cycle, the comparator&rsquo;s own reload</td></tr>' +
      '<tr><td>The second blind window on line 153</td><td><b>4 dots</b></td><td>MECHANISM, same reason; named separately in our source on purpose</td></tr>' +
      '<tr><td>The dot that second window opens on</td><td><b>8</b></td><td><b>NOT PINNED in its interior.</b> Our own sweep found <b>four adjacent placements indistinguishable</b> (identical pass set, 0 of 31 renders differing), while placements outside that band lose named rows. <b>Treat the interior of the band as a free choice, not as a measured constant.</b> What <em>is</em> pinned: the window exists, it is one machine cycle wide, 153 is live before it and 0 is live after it</td></tr>' +
      '<tr><td>The dot the line register starts reading 0 on line 153</td><td><b>2</b></td><td><b>FITTED.</b> Adjacent values were never separated by any test we own</td></tr>' +
      '<tr><td>Dispatch-eligibility lag, coincidence source only (Rule 14/11)</td><td><b>1 dot</b></td><td><b>FITTED, and deliberately restricted to that one source</b>: applying it to all sources costs 20 of our 24 picture-processor board cells. Swept with the running processor&rsquo;s look at the line start (3, 2 and 1): only 1 keeps <code>daid/ppu_scanline_bgp</code> byte-identical (at 4 it moves 55 checkpoints); a halted sample cannot tell 1 from 4. The line-0 hold beside it is 3 dots, for the same reason</td></tr>' +
    '</tbody></table>' +
    '<p class="hw-readable"><b>Label for the sequence as a whole: DERIVED from a published table and ' +
    'confirmed by test cartridges, not measured on a real console.</b> No station in ' +
    'section 5 tested it.</p>' +

    '<h4 class="gbemu-sub">Access windows, as the dots a processor access sees</h4>' +
    '<div class="gbemu-rule" id="gbr-14-16"><b>Rule 14/16. The access scale.</b> An access &ldquo;on dot D&rdquo; is made when the line&rsquo;s dot counter reads D: the picture processor has finished dots 0 to D&minus;1 and has not begun dot D. That is the scale of appendix E.2&rsquo;s <code>8 + 4c</code>. An event that the scale table at the head of appendix E places on dot D (mode 3 entered on dot 84, for instance) is first seen by an access on dot D+1, except the video-memory read close, which that table already gives on this scale: an access on dot 78 is the first closed read.</div>' +
    '<div class="gbemu-example"><b>Example.</b> Mode 3 is entered on event-scale dot 84, so an access on dot 84 still finds both memories as the scan left them and an access on dot 85 is the first to find mode 3 (the row &ldquo;85 to the dot before mode 0 is reported&rdquo; below).</div>' +
    '<div class="gbemu-rule" id="gbr-14-17"><b>Rule 14/17. The access windows</b>, in absolute dots on an ordinary line, on the power-on line and at the line boundary, are as the three tables below give them, at single speed: the original in the first two tables, the Colour (compatibility mode, no objects, SCX 0) in the third. On the original, a line on which the scan selected no object reports mode 0, and reopens both memories, three dots before its last pixel (E.6); the power-on line has no early video-memory read close (it runs no scan) and reports mode 0 two dots after its last pixel; and lines 144 and 0 report mode 1 and mode 2 only from dot 5 on this scale, after a machine cycle of mode 0. On the Colour the windows follow the status register (the Colour tab, section 5).</div>' +
    '<table class="gbemu-table"><thead><tr><th>Ordinary line (1 to 143), access on dot (access scale, from the line&rsquo;s dot 0)</th><th>Video ' +
    'memory read</th><th>Video memory write</th><th>Sprite memory read</th><th>Sprite memory ' +
    'write</th><th>STAT mode</th></tr></thead><tbody>' +
    '<tr><td>0 to 3</td><td>open</td><td>open</td><td><b>closed</b></td><td>open</td><td>0</td></tr>' +
    '<tr><td>4</td><td>open</td><td>open</td><td>open</td><td>open</td><td>0</td></tr>' +
    '<tr><td>5 to 77</td><td>open</td><td>open</td><td>closed</td><td>closed</td><td>2</td></tr>' +
    '<tr><td>78 to ' +
    '83</td><td><b>closed</b></td><td>open</td><td>closed</td><td><b>open</b></td><td>2</td></tr>' +
    '<tr><td>84</td><td><b>open</b></td><td>open</td><td>closed</td><td>open</td><td>2</td></tr>' +
    '<tr><td>85 to the dot before mode 0 is reported (253 at SCX 0 with no ' +
    'objects)</td><td>closed</td><td>closed</td><td>closed</td><td>closed</td><td>3</td></tr>' +
    '<tr><td>from the mode-0 report (254 at SCX 0 with no objects) to ' +
    '455</td><td>open</td><td>open</td><td>open</td><td>open</td><td>0</td></tr>' +
    '</tbody></table>' +
    '<table class="gbemu-table"><thead><tr><th>Other lines, access on dot (access scale, from the line&rsquo;s dot 0)</th><th>Video memory ' +
    'read</th><th>Video memory write</th><th>Sprite memory read</th><th>Sprite memory ' +
    'write</th><th>STAT mode</th></tr></thead><tbody>' +
    '<tr><td>Power-on line, 8 to ' +
    '84</td><td>open</td><td>open</td><td>open</td><td>open</td><td>0</td></tr>' +
    '<tr><td>Power-on line, 85 up to the mode-0 report on 259 (SCX 0, no ' +
    'objects)</td><td>closed</td><td>closed</td><td>closed</td><td>closed</td><td>3</td></tr>' +
    '<tr><td>Power-on line, 259 to its last dot, ' +
    '458</td><td>open</td><td>open</td><td>open</td><td>open</td><td>0</td></tr>' +
    '<tr><td>Line 0 after vertical blank, 0 to ' +
    '4</td><td>open</td><td>open</td><td><b>closed</b></td><td>open</td><td>0</td></tr>' +
    '<tr><td>Line 0 after vertical blank, 5 to ' +
    '77</td><td>open</td><td>open</td><td>closed</td><td><b>closed</b></td><td>2</td></tr>' +
    '<tr><td>Line 0 after vertical blank, 78 on</td><td colspan="5">as an ordinary line</td></tr>' +
    '<tr><td>Line 144, 0 to ' +
    '4</td><td>open</td><td>open</td><td>open</td><td>open</td><td>0</td></tr>' +
    '<tr><td>Line 144 from dot 5, and lines 145 to 153, every ' +
    'dot</td><td>open</td><td>open</td><td>open</td><td>open</td><td>1</td></tr>' +
    '</tbody></table>' +
    '<table class="gbemu-table"><thead><tr><th>The Colour at single speed, access on dot (access scale, from the line&rsquo;s dot 0)</th><th>Video memory ' +
    'read</th><th>Video memory write</th><th>Sprite memory read</th><th>Sprite memory ' +
    'write</th><th>STAT mode</th></tr></thead><tbody>' +
    '<tr><td>Ordinary line, 0 to 2</td><td>open</td><td>open</td><td>closed</td><td><b>closed</b></td><td>0</td></tr>' +
    '<tr><td>Ordinary line, 3</td><td>open</td><td>open</td><td>closed</td><td>closed</td><td>2</td></tr>' +
    '<tr><td>Ordinary line, 4</td><td>open</td><td>open</td><td>open</td><td>open</td><td>2</td></tr>' +
    '<tr><td>Ordinary line, 5 to 82</td><td>open</td><td>open</td><td>closed</td><td>closed</td><td>2</td></tr>' +
    '<tr><td>Ordinary line, 83 and 84</td><td><b>open</b></td><td>open</td><td>closed</td><td>closed</td><td>3</td></tr>' +
    '<tr><td>Ordinary line, 85 to the dot before mode 0 is reported (254 at SCX 0 with no objects)</td><td>closed</td><td>closed</td><td>closed</td><td>closed</td><td>3</td></tr>' +
    '<tr><td>Ordinary line, from the mode-0 report (255 at SCX 0 with no objects) to 455</td><td>open</td><td>open</td><td>open</td><td>open</td><td>0</td></tr>' +
    '<tr><td>Power-on line, 8 to 84</td><td>open</td><td>open</td><td>open</td><td>open</td><td>0</td></tr>' +
    '<tr><td>Power-on line, 85 to 89</td><td><b>open</b></td><td>closed</td><td>closed</td><td>closed</td><td>3</td></tr>' +
    '<tr><td>Power-on line, 90 up to the mode-0 report on 259</td><td>closed</td><td>closed</td><td>closed</td><td>closed</td><td>3</td></tr>' +
    '<tr><td>Power-on line, 259 to its last dot, 457</td><td>open</td><td>open</td><td>open</td><td>open</td><td>0</td></tr>' +
    '<tr><td>Line 0 after vertical blank, 0 to 2</td><td>open</td><td>open</td><td>closed</td><td>closed</td><td>0</td></tr>' +
    '<tr><td>Line 0 after vertical blank, 3 to 82</td><td>open</td><td>open</td><td>closed</td><td>closed</td><td>2</td></tr>' +
    '<tr><td>Line 0 after vertical blank, 83 on</td><td colspan="5">as an ordinary line</td></tr>' +
    '<tr><td>Line 144, 0 to 3</td><td>open</td><td>open</td><td>open</td><td>open</td><td>0</td></tr>' +
    '<tr><td>Line 144 from dot 4, and lines 145 to 153, every dot</td><td>open</td><td>open</td><td>open</td><td>open</td><td>1</td></tr>' +
    '</tbody></table>' +
    '<div class="gbemu-why"><b>Why.</b> INSTRUMENT-MEASURED dot by dot, at single speed, with the probe in our source tree (<code>test/tabprobe</code>, which tests a read and a write of each memory on every dot against a saved copy of the machine).</div>' +
    '<div class="gbemu-why"><b>The access edges, in one place</b> (access scale). Sprite-memory reads close at the line boundary, dot 0, not at the scan&rsquo;s first dot: access dots 0 to 3 of an ordinary line refuse a sprite-memory read although the scan&rsquo;s first slot and STAT&rsquo;s mode-2 report come on dot 4 (INSTRUMENT-MEASURED, not a misprint; the read gate is keyed to the line boundary, the report to the scan). Sprite-memory writes stay open until dot 4 and reopen from 78 to 84. On the power-on line both memories stay open until mode 3 is first seen, dot 85, with no early video-memory read close (that line runs no scan; the AGE <code>vram-read</code> table reads it open there, and no access the corpus makes can tell: an early close there changes none of the 66 original Mooneye acceptance rows). At the frame wrap, line 0 closes sprite-memory reads from dot 0; its writes follow the reported mode, which is 0 until dot 5 on the original (so writes close from 5) and already closed from dot 0 on the Colour. The Colour&rsquo;s other departures are in its table: no early video-memory close, sprite-memory writes refused from dot 0 with no window where the scan ends, and a power-on line on which video memory still reads until dot 89 (the first 6 dots of drawing, event-scale dots 84 to 89; access dots 85 to 89 in the table).</div>' +
    '<div class="gbemu-rule" id="gbr-14-18"><b>Rule 14/18. Where the processor&rsquo;s accesses fall</b>, at single speed, because a window only matters on the dots an access can land on. The screen-on write&rsquo;s access is on dot 8 of the power-on line, so in a run of one-cycle instructions the power-on line&rsquo;s accesses fall on 12, 16, 20 and so on, including 80 and 84 (both open on the shipped core). On every later line they fall on dots 1, 5, 9, ..., 77, 81, 85 on the original, and on 2, 6, 10, ..., 78, 82, 86 on a Color at single speed, whose power-on line is a dot shorter. So the one-dot openings at dots 4 and 84 of an ordinary line are never reached by the processor at single speed. Dot 84 of the power-on line is reached, and <code>lcdon_timing-GS</code> requires it open: closing that one dot fails the row.</div>' +
    '<div class="gbemu-why"><b>Why.</b> MEASURED on a run of one-cycle instructions after a screen-on write.</div>' +
    '<div class="gbemu-why"><b>The 6 of the early read close, swept</b>, which is the measurement ' +
    'appendix E.1.5 says would establish it. With the close starting L dots before dot 84: L = 2 fails ' +
    '<code>lcdon_timing-GS</code> and <code>lcdon_write_timing-GS</code>; 3, 4, 5 and 6 pass both; 7 ' +
    'and 8 fail both; <code>intr_2_oam_ok_timing</code>, <code>intr_2_mode3_timing</code>, ' +
    '<code>stat_lyc_onoff</code> and <code>bits/mem_oam</code> pass at every value. On the ' +
    'original&rsquo;s access grid the close may start on any dot from 78 to 81, and 6 is our ' +
    'representative of that band: FITTED to those two cartridges, a band and not a value.</div>' +
    '</section>' +


  /* ---------------------------------------------------------------- S1
   * The sound unit. Sound affects no figure on the mealybug board and 68 rows
   * of the 264-row board. Every claim carries its
   * label: DERIVED (read off a rule or a cartridge's own declaration),
   * MEASURED (scored against hardware or a declared table), CONVERGENCE, or
   * NOT SETTLED. Do not promote one without moving the evidence with it.   */
  '<section class="sect" id="gbe-addr"><h3 class="sect-h">Appendix C. Tile, map and object addressing</h3>' +
    '<p class="hw-readable">Sections 9 to 12 describe <em>when</em> the fetcher reads and what ' +
    'happens if a register moves between two of its reads. This appendix is <em>what address it ' +
    'forms</em>. Both halves are needed and only one of them is interesting, which is why this one ' +
    'sits at the back.</p>' +

    '<h4 class="gbemu-sub">C.1: The background map</h4>' +
    '<div class="gbemu-rule" id="gbr-C-1-1"><b>Rule C.1/1.</b> The background map&rsquo;s base address is <code>0x9800</code> when LCDC bit 3 is 0 and <code>0x9C00</code> when LCDC bit 3 is 1. Each map is <b>32 &times; 32 bytes</b> of tile numbers: 1024 bytes, so the two maps exactly fill <code>0x9800</code>&ndash;<code>0x9FFF</code>.</div>' +
    '<div class="gbemu-rule" id="gbr-C-1-2"><b>Rule C.1/2.</b> The background map byte the fetcher reads is formed in three parts:' +
      '<ul class="gbemu-bullets">' +
      '<li><b>Column:</b> <code>tx = ((SCX &gt;&gt; 3) + fetcher_x) &amp; 0x1F</code>, where <code>fetcher_x</code> counts the tiles fetched on this line, from 0.</li>' +
      '<li><b>Row:</b> <code>ty = (LY + SCY) &amp; 0xFF</code>: eight bits, so it wraps at 256 pixels, which is 32 tiles.</li>' +
      '<li><b>Cell:</b> <code>base + (ty &gt;&gt; 3) &times; 32 + tx</code>.</li>' +
      '</ul></div>' +
    '<div class="gbemu-rule" id="gbr-C-1-3"><b>Rule C.1/3.</b> <code>tx</code> must be masked to five bits, and <code>ty</code> to eight, <em>before</em> the shift and the sum of Rule C.1/2. A build must not replace the five-bit mask on <code>tx</code> by one <code>&amp; 0x3FF</code> on the finished address.</div>' +
    '<div class="gbemu-why"><b>Why.</b> <b>Two independent wraps, and only one of them can be folded away ' +
    'safely.</b> The five-bit mask is what makes the map wrap horizontally at 32 tiles rather than running into the next row. <b>Folding the <em>horizontal</em> mask into one ' +
    '<code>&amp; 0x3FF</code> on the finished address is the one that bleeds:</b> with ' +
    '<code>(SCX &gt;&gt; 3) + fetcher_x</code> left unmasked it reaches 32 and above, which carries ' +
    'straight into the <code>&times; 32</code> term and <b>reads the next row of the map</b>. It needs ' +
    'only a non-zero <code>SCX</code> and enough tiles fetched, so it is reachable on an ordinary ' +
    'scrolling line. <b>MECHANISM.</b> <b>And the <em>vertical</em> fold is identity</b>, for every reachable ' +
    'value and not merely in the common case. ' +
    '<code>(ty &amp; 0xFF) &gt;&gt; 3</code> is <code>(ty &gt;&gt; 3) &amp; 0x1F</code>, and since ' +
    '<code>tx &lt; 32</code> leaves the low five bits of the row term untouched, the ' +
    '<code>&amp; 0x3FF</code> distributes and gives back the same byte. So the two folds are not ' +
    'symmetric: the vertical one costs nothing, and it is the horizontal one that costs a tile ' +
    'row.</div>' +
    '<div class="gbemu-example"><b>Example.</b> LCDC bit 3 = 0 (base <code>0x9800</code>), <code>SCX = 0xF8</code> (so <code>SCX &gt;&gt; 3</code> = 31), <code>LY + SCY</code> = 0 (so <code>ty</code> = 0). The second tile fetched on the line has <code>fetcher_x</code> = 1: <code>tx = (31 + 1) &amp; 0x1F</code> = 0, and the cell is <code>0x9800</code>, column 0 of map row 0 (the horizontal wrap). With the mask folded into <code>&amp; 0x3FF</code> instead, the sum is 32 and the cell is <code>0x9800 + 32</code> = <code>0x9820</code>, column 0 of map row 1: the wrong row.</div>' +

    '<h4 class="gbemu-sub">C.2: The window map</h4>' +
    '<div class="gbemu-rule" id="gbr-C-2-1"><b>Rule C.2/1.</b> The window map has the same 32 &times; 32 shape. Its base address is <code>0x9800</code> when <b>LCDC bit 6</b> is 0 and <code>0x9C00</code> when LCDC bit 6 is 1. Its column is <code>tx = fetcher_x &amp; 0x1F</code>, with <b>no scroll term at all</b>, and its <code>ty</code> is the window&rsquo;s <b>own line counter</b> (section 11): not LY, and not LY&nbsp;&minus;&nbsp;WY.</div>' +
    '<div class="gbemu-why"><b>Why.</b> Section 11 is entirely about that counter and section 18 names ' +
    'deriving it from LY as a trap that passes every game.</div>' +

    '<h4 class="gbemu-sub">C.3: Tile data, and the signed addressing</h4>' +
    '<div class="gbemu-rule" id="gbr-C-3-1"><b>Rule C.3/1.</b> The background and the window take tile <i>n</i>&rsquo;s data address from this table. With LCDC bit 4 = 0 the tile number is sign-extended: write the sign extension literally.</div>' +
    '<table class="gbemu-table"><thead><tr><th>LCDC bit 4</th><th>Address of tile <i>n</i> (byte address of the tile&rsquo;s first byte)</th><th>Reach (byte addresses)</th></tr></thead><tbody>' +
      '<tr><td><b>1</b></td><td><code>0x8000 + n &times; 16</code>, <i>n</i> unsigned 0&ndash;255</td><td><code>0x8000</code>&ndash;<code>0x8FFF</code></td></tr>' +
      '<tr><td><b>0</b></td><td><code>0x9000 + (signed char)n &times; 16</code></td><td><code>0x8800</code>&ndash;<code>0x97FF</code></td></tr>' +
    '</tbody></table>' +
    '<div class="gbemu-example"><b>Example.</b> With LCDC bit 4 = 0: tile 0 is at <code>0x9000</code>, tile ' +
    '127 at <code>0x97F0</code>, tile 128 at <code>0x8800</code>, tile 255 at <code>0x8FF0</code>.</div>' +
    '<div class="gbemu-why"><b>Why.</b> The second form is the one people re-derive wrongly. <b>It is not ' +
    '&ldquo;base <code>0x8800</code> with 128 added&rdquo;</b>: that gives the same set of ' +
    'addresses by a different route and then goes wrong the moment you try to express the first ' +
    'form the same way.</div>' +
    '<div class="gbemu-rule" id="gbr-C-3-2"><b>Rule C.3/2.</b> <b>Objects never use the signed mode</b>: an object&rsquo;s tile number is always unsigned ' +
    'from <code>0x8000</code>, whatever LCDC bit 4 says.</div>' +
    '<div class="gbemu-rule" id="gbr-C-3-3"><b>Rule C.3/3.</b> <b>Within the tile:</b> 16 bytes, two per row. Row ' +
    '<code>r = ty &amp; 7</code> lives at <code>tile_base + r &times; 2</code>; that byte is the ' +
    '<b>low</b> bitplane and the byte after it is the <b>high</b> one. The fetcher reads them in ' +
    'two separate steps, which is why section 13 can put a register write between them.</div>' +

    '<h4 class="gbemu-sub">C.4: Composing a pixel</h4>' +
    '<div class="gbemu-rule" id="gbr-C-4-1"><b>Rule C.4/1.</b> For the <i>p</i>-th pixel of a tile, counting from 0 at the <b>left</b>: ' +
    'take <code>b = 7 &minus; p</code>; the colour index is ' +
    '<code>(((hi &gt;&gt; b) &amp; 1) &lt;&lt; 1) | ((lo &gt;&gt; b) &amp; 1)</code>. ' +
    '<b>The high plane is the high bit of the index, and bit 7 of each byte is the leftmost pixel.</b> ' +
    'A horizontal flip is the same expression with <code>b = p</code>: a bit-order ' +
    'change, not a buffer reversal.</div>' +
    '<div class="gbemu-rule" id="gbr-C-4-2"><b>Rule C.4/2.</b> The colour index is 0 to 3 and it is <b>not</b> a shade. The background&rsquo;s ' +
    'index goes through BGP: <code>shade = (BGP &gt;&gt; (index &times; 2)) &amp; 3</code>. An ' +
    'object&rsquo;s goes through OBP0 or OBP1 the same way, <b>except that index 0 is ' +
    'transparency and is never looked up</b>.</div>' +
    '<div class="gbemu-why"><b>Why.</b> The flip being a bit-order change matters because the flip is read at the fetch and can ' +
    'change between the two plane reads. Keep the index, not the shade, as far down the ' +
    'pipeline as you can: the priority comparison in section 12 is on indices, and this core scores ' +
    'every figure on the page in indices for exactly that reason.</div>' +
    '<div class="gbemu-example"><b>Example.</b> <code>lo = 0xA0</code>, <code>hi = 0xC0</code>. Pixels <i>p</i> = 0, 1, 2, 3 have indices 3, 2, 1, 0, and pixels 4 to 7 have index 0. Flipped (<code>b = p</code>), pixel 7 has index 3 and pixel 0 has index 0. Through <code>BGP = 0x1B</code> (bit pairs 00, 01, 10, 11 from the top): index 3 gives shade 0, index 2 shade 1, index 1 shade 2, index 0 shade 3. Through OBP0 the index-0 pixels are transparent and take no shade at all.</div>' +

    '<h4 class="gbemu-sub">C.5: The object table</h4>' +
    '<div class="gbemu-rule" id="gbr-C-5-1"><b>Rule C.5/1.</b> The object table is <code>0xFE00</code>&ndash;<code>0xFE9F</code>: <b>40 entries of 4 ' +
    'bytes</b>, laid out as the two tables below give.</div>' +
    '<table class="gbemu-table"><thead><tr><th>Byte (offset within the 4-byte entry)</th><th>What it is</th></tr></thead><tbody>' +
      '<tr><td><b>0</b></td><td>Y position <b>plus 16</b>. An object at Y = 16 has its top row on ' +
        'line 0; Y = 0 is entirely above the screen</td></tr>' +
      '<tr><td><b>1</b></td><td>X position <b>plus 8</b>. X = 8 is flush with the left edge; X = 0 ' +
        'and X &ge; 168 are off-screen</td></tr>' +
      '<tr><td><b>2</b></td><td>Tile number, <b>always unsigned from <code>0x8000</code></b>. In ' +
        '8&times;16 mode <b>bit 0 is masked off</b> (the pair is <i>n</i> AND 0xFE then ' +
        '<i>n</i> OR 0x01) and the mask is applied whatever the program wrote</td></tr>' +
      '<tr><td><b>3</b></td><td>Attributes: the next table</td></tr>' +
    '</tbody></table>' +
    '<table class="gbemu-table"><thead><tr><th>Attribute bit (bit of byte 3)</th><th>Meaning</th></tr></thead><tbody>' +
      '<tr><td><b>7</b></td><td>Priority. Set = the object is hidden behind background colours 1, 2 and 3, and shows only over colour 0</td></tr>' +
      '<tr><td><b>6</b></td><td>Vertical flip</td></tr>' +
      '<tr><td><b>5</b></td><td>Horizontal flip</td></tr>' +
      '<tr><td><b>4</b></td><td>Palette: 0 = OBP0, 1 = OBP1</td></tr>' +
      '<tr><td><b>3</b></td><td>Unused on this machine. Tile bank on the Colour</td></tr>' +
      '<tr><td><b>2&ndash;0</b></td><td>Unused on this machine. Palette number on the Colour</td></tr>' +
    '</tbody></table>' +
    '<div class="gbemu-rule" id="gbr-C-5-2"><b>Rule C.5/2.</b> On this machine attribute bits 3&ndash;0 are <b>not consulted</b> by any consumer.</div>' +
    '<div class="gbemu-why"><b>Why.</b> <b>Bits 3&ndash;0 are not &ldquo;don&rsquo;t care&rdquo;, they are ' +
    '&ldquo;not consulted&rdquo;</b>, and the distinction is what makes a colour port possible ' +
    'later: force them to zero at one place rather than branching on the machine at each consumer, ' +
    'and every downstream expression reduces textually to the monochrome one. The Colour page says ' +
    'the same thing about the background attribute byte, and it is the same discipline.</div>' +

    '<h4 class="gbemu-sub">C.6: Selecting and addressing an object</h4>' +
    '<div class="gbemu-rule" id="gbr-C-6-1"><b>Rule C.6/1.</b> <b>The scan tests Y only.</b> An object is on this line if ' +
        '<code>LY &ge; Y &minus; 16</code> and <code>LY &lt; Y &minus; 16 + h</code>, where ' +
        '<i>h</i> is 8 when LCDC bit 2 is 0 and 16 when LCDC bit 2 is 1. <b>X plays no part in selection</b>: an object at ' +
        'X = 0 is invisible and still consumes one of the ten slots. The first ten in memory order ' +
        'are kept; the eleventh is dropped whatever its X.</div>' +
    '<div class="gbemu-rule" id="gbr-C-6-2"><b>Rule C.6/2.</b> <b>The row within the object is a masked field, not a subtraction.</b> ' +
        '<code>row = (LY &minus; (Y &minus; 16)) &amp; (h &minus; 1)</code>, three bits or four ' +
        'according to the height <i>h</i> read at the fetch (Rule C.6/5), and a vertical flip <b>complements within that field</b> ' +
        '(<code>row</code> XOR <code>(h &minus; 1)</code>) rather ' +
        'than computing <code>h &minus; 1 &minus; row</code>.</div>' +
    '<div class="gbemu-why"><b>Why.</b> The two forms agree everywhere except when ' +
        'something changes the height <em>after</em> the difference was formed, which is ' +
        'exactly what a mid-line write to LCDC bit 2 does, and a test requires it. The silicon has ' +
        'no row register wider than the field, so it cannot produce a negative row; a signed ' +
        'subtraction models a subtractor that is not there. <b>DERIVED.</b></div>' +
    '<div class="gbemu-example"><b>Example.</b> An object selected at height 16 with <code>LY &minus; (Y &minus; 16)</code> = 12; LCDC bit 2 is cleared before its fetch, so the fetch reads <i>h</i> = 8. Masked: <code>row = 12 &amp; 7</code> = 4, and with a vertical flip <code>4 XOR 7</code> = 3. The subtraction form would give row 12 unflipped (past the end of an 8-row tile) and <code>7 &minus; 12</code> = &minus;5 flipped, a row that does not exist.</div>' +
    '<div class="gbemu-rule" id="gbr-C-6-3"><b>Rule C.6/3.</b> <b>Address:</b> <code>0x8000 + tile &times; 16 + row &times; 2</code>, low plane there ' +
        'and high plane at +1.</div>' +
    '<div class="gbemu-rule" id="gbr-C-6-4"><b>Rule C.6/4.</b> <b>The left clip.</b> The object&rsquo;s leftmost screen column is ' +
        '<code>X &minus; 8</code>. If that is negative, <b>discard that many pixels from the front ' +
        'of the fetched row</b> and merge the rest at column 0. The object is still fetched and ' +
        'still costs its dots (section 12), which is why an object at X = 0 can ' +
        'lengthen a line it contributes no pixels to.</div>' +
    '<div class="gbemu-example"><b>Example.</b> X = 3: the leftmost column is &minus;5, so the first 5 fetched pixels are discarded and pixels 5, 6 and 7 of the row land on screen columns 0, 1 and 2.</div>' +
    '<div class="gbemu-rule" id="gbr-C-6-5"><b>Rule C.6/5.</b> <b>Height is read at the fetch, not at the scan.</b></div>' +
    '<div class="gbemu-why"><b>Why.</b> Section 18 names latching it at the ' +
        'scan as a trap: a change between the two plane reads makes them come from different rows, ' +
        'and the reference requires that.</div>' +
    '<p class="hw-readable">Fetch order, the ten-object limit, the priority rule between two objects ' +
    'and the sprite-memory corruption bug are all in sections 5, 6 and 12: they are ' +
    'behaviour, not addressing, and they are where the research went.</p></section>' +

  /* ================================================================ APP-D
   * THE INSTRUCTION SET. Added because section 24 used to scope all 512
   * opcodes out of this page as "documented elsewhere" -- which assumes the
   * reader has the documentation and the suite. A reader who has neither has
   * no processor at all, and every other appendix is unreachable without one.
   *
   * Transcription out of the decode paths of the core the rest of this page
   * describes, which passes 51 of 51 Blargg rows and 97 of 97 Mooneye rows,
   * so the board is what verifies it. Where a figure is not sourced from the
   * core, the text says so.                                              */
  '<section class="sect" id="gbe-pipe"><h3 class="sect-h">Appendix E. The picture pipeline, in numbers</h3>' +
    '<p class="hw-readable">Sections 7 to 14 are about what is hard. They give the model of a ' +
    'dot-accurate pipeline and then, almost everywhere, decline to say <em>which dot</em>. This ' +
    'appendix says which dot. It is the single most expensive thing on this page to reconstruct and ' +
    'the one a reader cannot derive, because most of it is per-register and several of the numbers ' +
    'are fitted and have no derivation to find.</p>' +
    '<p class="gbemu-key"><b>Units used throughout.</b> A <b>dot</b> is one T-cycle of ' +
    'picture time; a machine cycle is four dots at normal speed (the original, and a Colour at single speed) and two in the Colour&rsquo;s double speed, and an ordinary line is 456 dots. Rule E/1 fixes where every absolute dot is counted from; Rule E/2 defines a register&rsquo;s <b>lead</b>.</p>' +

    '<div class="gbemu-rule" id="gbr-E-1"><b>Rule E/1.</b> <b>Every absolute dot number on this page is counted from ' +
    'this core&rsquo;s own line boundary (dot 0), and that boundary is FOUR DOTS BEFORE the mode-2 scan ' +
    'starts.</b> The line does not open in mode 2: there is a four-dot gap first, the mode-2 status ' +
    'interrupt is raised inside it, and STAT&rsquo;s mode bits change at its end. So on this ' +
    'page&rsquo;s scale <b>mode 3 is entered on dot 84, not dot 80</b>, while the ordinary ' +
    '<em>observable</em> &ldquo;mode 3 begins 80 dots into the line&rdquo; is unchanged: the ' +
    'two statements differ by the gap and by nothing else. In our source the gap is one constant, ' +
    '<code>LINE_PRE</code>, and <b>its value is 4</b>. Unless a table or sentence says otherwise, the absolute dots on this page are on the event scale (&ldquo;on dot D&rdquo; means while the picture processor processes dot D).</div>' +
    '<div class="gbemu-why"><b>Why.</b> Mode 3&rsquo;s LENGTH is untouched by the gap: all ' +
    '117 mode-3 probes are byte-identical across every value of it, so it is pure phase.</div>' +
    '<div class="gbemu-rule" id="gbr-E-2"><b>Rule E/2.</b> A register&rsquo;s <b>lead</b>, in dots, is <em>how many of the dots of the write&rsquo;s machine cycle fall ' +
    'after the register takes the value</em> (four dots at normal speed). Lead 0 means the register latches at the end of the ' +
    'write&rsquo;s machine cycle; lead 2 means it latches two dots before that cycle ends and the ' +
    'pipeline sees the new value for those two dots; a negative lead means it latches <em>after</em> ' +
    'the cycle ends. Leads are explanation and bookkeeping only: the specification of when a write is first seen is E.1.1, in absolute dots.</div>' +

    '<p class="hw-readable"><b>The scale, printed once, so no reader has to infer it from the ' +
    'numbers.</b> The dot column is on the event scale of Rule E/1 except the one row marked as access scale.</p>' +
    '<table class="gbemu-table"><thead><tr><th>Event on an ordinary line</th><th>Dot (event scale, counted from the line boundary, dot 0; one row access scale)</th><th>Which section uses it</th></tr></thead><tbody>' +
      '<tr><td>Line boundary; the four-dot gap opens</td><td><b>0</b></td><td>none</td></tr>' +
      '<tr><td>The mode-2 scan&rsquo;s first slot performs its read</td><td><b>5</b> (slot <em>k</em> at dot <code>5 + 2k</code>)</td><td>section 6</td></tr>' +
      '<tr><td>Video-memory <em>reads</em> close (6 dots early, on the live mode)</td><td><b>78</b>, and this row alone is on the access scale of section 14: an access made on dot 78 is the first to find the read closed, so do not add one to it as section 14 says for the other rows.</td><td>E.1.5</td></tr>' +
      '<tr><td><b>Mode 3 entered</b>; fetcher restarted, and the priming fetch starts on this same dot: dot 84 is its pos 0 (it runs 84 to 89, its step bodies on 85, 87 and 89), not the dot after</td><td><b>84</b></td><td>E.1, E.2, E.3.1, E.5.1</td></tr>' +
      '<tr><td>Video-memory and sprite-memory <em>writes</em> close (on the reported mode)</td><td><b>84</b></td><td>E.1, E.1.5</td></tr>' +
      '<tr><td><b>The fine-scroll discard is latched</b> from SCX: last dot of the priming fetch</td><td><b>89</b></td><td>section 11, E.1</td></tr>' +
      '<tr><td>A clipped object&rsquo;s <code>begin</code> at OAM X = 0 (<code>89 + X</code>)</td><td><b>89</b></td><td>E.3.1</td></tr>' +
      '<tr><td>The window counter&rsquo;s seven priming increments</td><td><b>90 to 96</b></td><td>section 11, E.8</td></tr>' +
      '<tr><td><b>The line&rsquo;s first visible pixel leaves the QUEUE</b> (the first pop)</td><td><b>97</b></td><td>E.8, F.6</td></tr>' +
      '<tr><td>The same pixel reaches the SCREEN (the first frame-buffer write)</td><td><b>98</b></td><td>E.5.1, E.1.2</td></tr>' +
      '<tr><td>The line&rsquo;s last visible pixel leaves the queue, at <code>SCX &amp; 7 = 0</code></td><td><b>256</b></td><td>none</td></tr>' +
    '</tbody></table>' +
    '<div class="gbemu-why"><b>Why.</b> INSTRUMENT-MEASURED on the shipped core, line 1 of ' +
    '<code>m3_window_timing</code> at <code>SCX&nbsp;=&nbsp;0</code>, by logging the dot at each ' +
    'named site. <b>Falsifier:</b> any of these dots reading differently on an instrumented build of ' +
    'the shipped core at <code>SCX&nbsp;=&nbsp;0</code>. <b>The first-pop and screen rows are two stages, not one.</b> Every ' +
    '&ldquo;pixel leaves&rdquo; number this ' +
    'page prints is a <em>pop</em>; the screen is one dot later, always, and structurally, ' +
    'not by a pipeline setting. <b>E.5.1 has the ordering and its falsifier</b>, and a core that ' +
    'collapses the two stages cannot satisfy this table&rsquo;s 84 and 97 together.</div>' +
    '<div class="gbemu-rule" id="gbr-E-3"><b>Rule E/3.</b> <b>If your core counts its line from the scan instead, subtract 4 from ' +
    'every absolute dot on this page and you have your own numbers.</b> What must not be subtracted ' +
    'is a <em>difference</em>: every interval here (the 6-dot access lead, the 5 dots from ' +
    'mode-3 entry to the discard latch, the 12-dot opening, the 451 of E.2) is invariant ' +
    'under the choice.</div>' +
    '<div class="gbemu-example"><b>Example.</b> Counted from the scan, mode 3 is entered on dot 80 and the first pop is on dot 93; the interval from mode-3 entry to the discard latch is still 5 dots (89 &minus; 84 on this page&rsquo;s scale, 85 &minus; 80 on yours). <b>The scale is ours; the intervals are the claim.</b></div>' +

    '<h4 class="gbemu-sub">E.1: The mid-line register sampling table</h4>' +
    '<div class="gbemu-rule" id="gbr-E-1-1"><b>Rule E.1/1.</b> <b>Build from E.1.1, not from this section&rsquo;s lead table.</b> E.1.1&rsquo;s table gives, for every register and every consumer, the absolute dot on which the consumer first reads a written value, on both machines and both speeds, with the original&rsquo;s extra machine cycle (Rule E.1/8) already in. <b>E.1.1&rsquo;s table is the specification. The lead table in this section is explanation</b>: its leads are our source&rsquo;s bookkeeping and only mean something against our own cycle accounting (one of them, OBP0/OBP1, is even quoted in two conventions).</div>' +
    '<p class="hw-readable"><b>MECHANISM, and it is three statements rather than one</b> (Rules E.1/2 to E.1/5).</p>' +
    '<div class="gbemu-rule" id="gbr-E-1-2"><b>Rule E.1/2.</b> A display register write is not one event, it is two: the dot the register <em>takes</em> the value, and ' +
    'the dot each <em>consumer</em> reads it. Both have to be right and they are separate ' +
    'quantities.</div>' +
    '<div class="gbemu-rule" id="gbr-E-1-3"><b>Rule E.1/3.</b> <b>A write lands at the END of its machine cycle, exactly as a read samples at the end of ' +
        'its machine cycle.</b> That is the default and it is not a compensation for anything else.</div>' +
    '<div class="gbemu-why"><b>Why.</b> Instrumenting every ' +
        'sprite-memory write a write-timing cartridge makes, the write must land on picture-dot 84 ' +
        '(blocked) and not dot 80 (not blocked). <b>A single global write phase does not exist</b>: ' +
        'we built one, swept it 0 to 4, and it cannot pass the suite at any value.</div>' +
    '<div class="gbemu-rule" id="gbr-E-1-4"><b>Rule E.1/4.</b> <b>Individual registers depart from that default by a fixed number of dots.</b> That ' +
        'departure is the register&rsquo;s lead (Rule E/2), it is small (&minus;1 to +3; on the original with the ' +
        'screen on, seven registers add a whole machine cycle to it, Rule E.1/8), and it is <em>per ' +
        'register</em>, not per class. Palettes and geometry do not split cleanly, which is exactly ' +
        'why one phase for all writes fails.</div>' +
    '<div class="gbemu-rule" id="gbr-E-1-5"><b>Rule E.1/5.</b> <b>Each consumer reads the register on the dot it needs it</b>, not at the start of the ' +
        'line and not from a per-line snapshot. Several registers have <em>more than one</em> ' +
        'consumer at different dots, and the same write can be visible to one and not the other on ' +
        'the same dot.</div>' +
    '<div class="gbemu-rule" id="gbr-E-1-6"><b>Rule E.1/6.</b> <b>The fetcher&rsquo;s dot structure, because the tables are indexed on ' +
    'it</b> (section 9 states the fetcher). <b>Four two-dot steps, pos 0 to 7, with the push on pos 7: the last dot of the ' +
    'fourth step, not a ninth dot.</b> If the background queue is not empty when the fetcher reaches pos 7, the fetcher is parked on pos 7 and ' +
    'retries the push once per dot, and only those retry dots take the cycle past 8. ' +
    '<b>Within a two-dot step the first dot does nothing and the step&rsquo;s body (' +
    'including every register read it makes) executes on the SECOND dot.</b> So a step sees a written value exactly when the value&rsquo;s first-seen dot for that consumer (E.1.1) is the step&rsquo;s second dot or earlier.</div>' +
    '<div class="gbemu-example"><b>Example.</b> On an object-free line at SCX&nbsp;=&nbsp;0 the first map read after the priming fetch is the body of the step covering dots 90 and 91, so it executes on dot 91 (Rule E.1.1/4). An SCY write whose first-seen dot for the fetcher is 91 is used by that map read; one whose first-seen dot is 92 is not, and the map read uses the old SCY.</div>' +
    '<div class="gbemu-why"><b>Why.</b> <b>Do not read Rule E.1/6 as four steps of two dots and then a push.</b> That ' +
    'is a nine-dot cycle, and section 9 exists to forbid exactly that reading. A fetcher that ' +
    'spends a dot of its own on a push that succeeds drifts one dot per fetch and presents as a ' +
    'scroll bug. It matters more here than anywhere else on the page because <b>this is the ' +
    'paragraph every lead in the table below is indexed on</b>, so the nine-dot reading does not ' +
    'merely mis-time the push: it re-indexes fourteen register leads under it.</div>' +
    '<div class="gbemu-rule" id="gbr-E-1-7"><b>Rule E.1/7.</b> <em>Flexibility, restated in full:</em> a build may put each ' +
    'step&rsquo;s body on its first dot instead and shift every lead below by one to compensate. ' +
    '<b>What is observable is the dot each read happens on in absolute line time <em>and the ' +
    'eight-dot period</em>, not which half of a step you call it.</b> <b>Both invariants, ' +
    'always</b>: a flexibility clause that drops one of its two invariants reads as ' +
    'permission to move the one it dropped.</div>' +

    '<p class="hw-readable"><b>Explanation table, not the specification.</b> The lead column is in dots, in Rule E/2&rsquo;s convention, before Rule E.1/8&rsquo;s extra machine cycle. E.1.1 turns every row into absolute dots.</p>' +
    '<table class="gbemu-table"><thead><tr><th>Register</th><th>Lead (dots, Rule E/2; explanation only)</th><th>Consumer, and the dot it reads on</th><th>Label</th></tr></thead><tbody>' +
      '<tr><td><b>SCY</b> <code>$FF42</code></td><td><b>+1</b></td><td><code>ty = LY + SCY</code>, recomputed at <em>each</em> of the two data reads (steps 1 and 2), not cached at the map read. The map read samples SCY too, for the map row (C.1); what is not carried forward from it is the row within the tile, so SCY is read live three times per fetch</td><td><b>FITTED</b>: a sharp unique optimum. The fetch that samples SCY needs it one dot earlier than the cycle end; nothing derives the one dot</td></tr>' +
      '<tr><td><b>SCX</b> <code>$FF43</code></td><td><b>+1</b></td><td>the map read at step 0 forms the tile column from <code>(SCX &gt;&gt; 3) + fetch_x</code>; the low three bits drive the fine-scroll discard at the start of the line</td><td><b>FITTED, and the number is 1.</b> See the SCX evidence below</td></tr>' +
      '<tr><td><b>WX</b> <code>$FF4B</code></td><td><b>+2</b></td><td>the window trigger&rsquo;s positional comparator</td><td><b>MECHANISM</b> for the placement: dot arithmetic, derived before measurement. See below</td></tr>' +
      '<tr><td><b>BGP</b> <code>$FF47</code></td><td><b>+2</b>, two-stage</td><td>applied at the <b>output</b>, where the pixel reaches the screen, not where it leaves the queue</td><td>MECHANISM for the stage; the pair with the OR is INSTRUMENT-MEASURED. See E.1.2</td></tr>' +
      '<tr><td><b>OBP0 / OBP1</b> <code>$FF48/9</code></td><td><b>2</b> in this table&rsquo;s convention (our source&rsquo;s constant is 3), single stage (build from E.1.1: on the original with the screen on N + 6, the lead plus the extra machine cycle; Colour N + 2, double speed N + 1)</td><td>applied at the output, same place. The register holds the new value from the third dot of the write&rsquo;s machine cycle, two dots before the cycle ends; E.1.1 gives the dot. Read as +3 under this head (dots before the cycle end), both palette cells come out one pixel early, as measured on two independent builds. Our source&rsquo;s 3 is the constant handed to the palette write, and that write spends one dot of its own before the value lands, so the constant is one more than the lead. The background palette&rsquo;s 2 in the row above is already in this table&rsquo;s convention: its OR lands two dots before the cycle ends.</td><td><b>FITTED.</b> 3 is a residual optimum, and it is <em>provably degenerate</em> with the OR stage: <code>OR=0, lead L</code> is byte-identical to <code>OR=1, lead L&minus;1</code> on the cartridge that pins it. The <em>pair</em> is fitted, not the lead alone. The dot is INSTRUMENT-MEASURED (E.1.1)</td></tr>' +
      '<tr><td><b>LCDC</b> <code>$FF40</code></td><td><b>+2</b>, two-stage, <b>per bit per consumer</b></td><td>see E.1.3</td><td>mixed; per entry</td></tr>' +
      '<tr><td><b>WY</b> <code>$FF4A</code></td><td>0</td><td>the window&rsquo;s per-frame arming condition, evaluated <b>every dot</b> and <b>conjunctively with window-enable</b></td><td><b>FITTED.</b> No hardware statement conditions the arming latch on window-enable. Adopted on a compatibility ground: 26 of our own probe cartridges clear window-enable during drawing, and without the conjunction this core activates the window on 17 of them and pays its penalty. It becomes MECHANISM on a hardware statement about the <em>latch</em>, and on nothing less</td></tr>' +
      '<tr><td><b>LYC</b> <code>$FF45</code></td><td><b>&minus;1</b></td><td>the coincidence comparator (latches one dot late; the processor&rsquo;s value wins a same-dot conflict)</td><td><b>NOT ESTABLISHED.</b> Shipped at &minus;1 on the stated analogy to the interrupt-flag register, and the analogy is itself unpinned. Our own source calls the sharing <em>wrong in principle</em>, because LYC&rsquo;s phase is speed-dependent on the Colour and one constant cannot serve both rows</td></tr>' +
      '<tr><td><b>IF</b> <code>$FF0F</code></td><td><b>&minus;1</b></td><td>interrupt dispatch</td><td><b>NOT ESTABLISHED</b>, same standing. The window in which any value passes on our corpus is <b>eleven dots wide</b></td></tr>' +
      '<tr><td><b>STAT</b> <code>$FF41</code></td><td>0, <b>plus a one-dot transient on the original</b> (as absolute dots, E.1.1: <code>$78</code> on N + 4, the written bits from N + 5)</td><td>the status line, re-evaluated at the write and again after the held dot. <b>On the original</b> a write first puts <code>$78</code> in STAT (every interrupt source selected, as if <code>$FF</code> had been written) for one dot, and only then the written bits 6&ndash;3. <b>On the Colour</b> there is no all-selects moment: one cycle holds an intermediate of old and new bits, different at each speed (the Colour tab has it)</td><td><b>MECHANISM</b> for the transient: it is the original&rsquo;s documented STAT write quirk, and <i>Pinball Deluxe</i> needs it (defect D8). Holding it for <b>one dot</b> rather than applying it instantaneously is <b>CONVERGENCE</b> with the reference. The transient ships; the core constant is <code>STAT_CONFLICT_MOMENT = 0x78</code>.</td></tr>' +
      '<tr><td><b>DMA</b> <code>$FF46</code></td><td><b>0</b>: no lead</td><td>the sprite-memory transfer. A plain end-of-cycle write, like every register this table gives no lead: the transfer steps before the access in the write&rsquo;s own machine cycle (E.5), so that cycle moves no byte of the new transfer, and section 4 counts the start from it</td><td>MECHANISM, read from our source. Given a lead, the transfer starts a machine cycle early: an independent build that did so lost Mooneye timing rows (<code>call_timing</code>, <code>jp_timing</code> and <code>oam_dma_timing</code> among them)</td></tr>' +
    '</tbody></table>' +

    '<div class="gbemu-rule" id="gbr-E-1-8"><b>Rule E.1/8.</b> <b>One machine cycle more for the drawing registers, on the original.</b> On the original, when LCDC bit 7 is 1 as LCDC stands before the write (screen on), a write to LCDC, SCY, SCX, BGP, OBP0, OBP1 or WX lands four dots (one machine cycle) later than its lead alone gives. WY, STAT, LYC, IF and DMA never take this extra machine cycle; nor does any write on a Colour (compatibility mode included), nor any write made with the screen off. E.1.1&rsquo;s original column already includes it.</div>' +
    '<div class="gbemu-why"><b>Why.</b> Our core runs the picture four dots before the register&rsquo;s own write code (its lead then applies on top, unchanged), and the machine cycle owes those four dots back, so the processor&rsquo;s timing does not move. In E.1&rsquo;s convention each of those leads is four less: SCY and SCX &minus;3, WX, BGP, OBP0, OBP1 and LCDC &minus;2, which is 1 to 3 dots inside the machine cycle after the write&rsquo;s own. The leads in the table are fitted on mealybug, whose every write is made by a handler entered from a mode-2 interrupt, and the fit placed each of those writes as if that dispatch came one machine cycle later than it does on a running processor (AGE <code>stat-int</code>, its author&rsquo;s hardware table). With the dispatch on time (D.10.1) every mealybug write arrives four dots earlier, and the photographed pictures stay where they are only if each write lands four dots later. Measured: mealybug 24 of 24 at 0 pixels with the on-time dispatch and this extra machine cycle; 2 of 24 (52,489 pixels) with the on-time dispatch alone. Against a core with the dispatch one machine cycle late and no extra machine cycle, the 264-row board is byte-identical; docboy&rsquo;s agreement is 17,299 differing pixels against that core&rsquo;s 26,307 (the whole &ldquo;BGP written after a polled STAT read&rdquo; family at 0), with 25 rows a few pixels further (24 window switch-off rows, 17 to 20 or 22 pixels each, and one start-up row); the window rows move because a window-enable clear lands after the window&rsquo;s takeover and our core does not model the abandoned window start. WY is left out because no table we hold puts a WY write behind a running dispatch and one docboy window cartridge stops settling with it in. Label: MECHANISM (one placement for every drawing register; the four is the dispatch shift it compensates). Constant: <code>DMG_WRITE_LAG</code> = 4.</div>' +
    '<div class="gbemu-rule" id="gbr-E-1-9"><b>Rule E.1/9.</b> <b>Which registers in FF40 to FF4B take a lead at all.</b> SCY, SCX, WX, the palettes and LCDC take a lead. <b>Every other register here, STAT, DMA and WY, takes no lead</b>: the write lands at the end of its machine cycle and is first seen on N + 4 (E.1.1). LY takes no write at all: it is read-only, and a write to it is ignored.</div>' +
    '<div class="gbemu-why"><b>Why.</b> In our core the generic lead path serves SCY, SCX and WX in this block (and LYC, with IF outside it); the palettes and LCDC have write paths of their own (E.1.2, E.1.3). MECHANISM, read from our source (<code>io_write_early</code>, whose default is 0).</div>' +
    '<div class="gbemu-why"><b>Why SCX&rsquo;s lead is 1, and FITTED.</b> A conflict-map derivation predicts a lead of <b>2</b>. <b>The code says 1, and the code is right</b>: a sweep through the knob contradicts the derivation. Over arms &minus;1/0/1/2/3/4 the ' +
    'deciding cartridge reads <b>65 / 35 / 0 / 41 / 51 / 159</b> differing pixels, an optimum at 1 ' +
    'that takes the cell to zero. Reproduced by two independent instruments; against the derived 2, ' +
    'the 1 fixes 41 px and creates none. <b>The value is FITTED, on that sweep, and not MECHANISM.</b> Whoever reopens it owes an account of why ' +
    'the derivation loses to the only corpus that can see it.</div>' +
    '<div class="gbemu-why"><b>Why WX&rsquo;s lead is 2, which is the opposite shape.</b> The lead of 2 ' +
    '<em>is</em> derived: the deciding cartridge&rsquo;s handler writes WX at dot 97 while the ' +
    'comparator passes the deciding position at dot 96, so a default write lands one dot too late ' +
    'and two dots early puts the write in front of it. <b>A sweep does not corroborate the value</b>: the sweep over this lead moves 13,744 px and 4,718 px ' +
    'elsewhere with <b>0 of the 66 deciding cells moving</b>, and <i>&ldquo;an optimum summed across ' +
    'consumers cannot corroborate a derivation about one of them&rdquo;</i>. One reference ' +
    'implementation instead leaves the write at the default phase and advances one picture dot ' +
    'immediately after it; we built that shape and it was worse here by about <b>13,700 ' +
    'pixels</b>.</div>' +
    '<div class="gbemu-rule" id="gbr-E-1-10"><b>Rule E.1/10.</b> <b>Flexibility, and it is the whole point of the table.</b> These leads ' +
    'are only observable as <em>the dot the consumer&rsquo;s read sees the new value</em>. If your ' +
    'fetcher reads SCY at a different dot from ours, your SCY lead is a different number and both ' +
    'cores are right. <b>What must match is the composite: which pixel is the first to carry the new ' +
    'value.</b> That is what the mid-line cartridges photograph. Copy the invariant, not the ' +
    'column.</div>' +

    '<p class="gbemu-key"><b>E.1.1: Every lead above as an absolute dot, on both machines and both speeds.</b> This is the specification of when each register write is first seen (Rule E.1/1).</p>' +
    '<div class="gbemu-rule" id="gbr-E-1-1-1"><b>Rule E.1.1/1.</b> To find the first dot on which a consumer reads a written value:' +
    '<ol class="gbemu-steps">' +
      '<li>Take the machine cycle that carries the write (for <code>LDH (n),A</code>, its third and last) and call the first dot it covers <b>N</b>: a dot number of the current line on the scale of Rule E/1. Section 1 gives N: on the original N is 4k&nbsp;+&nbsp;1, on a Colour at single speed 4k&nbsp;+&nbsp;2; in double speed N is even and the cycle covers N and N&nbsp;+&nbsp;1 (the Colour tab, section 10). <b>B</b> is the dots per machine cycle: 4 on the original and at single speed, 2 in double speed.</li>' +
      '<li>Pick the column for the machine and speed.</li>' +
      '<li><b>On the original with the screen off</b> (LCDC bit 7 is 0 as LCDC stands before the write): do not use the table. The extra machine cycle of Rule E.1/8 is not applied and nothing draws, so the write simply lands as a write with no lead does, on N&nbsp;+&nbsp;4; the register value is what the switch-on later finds. The LCDC write that switches the screen on is itself made with the screen off and takes effect at once (E.2).</li>' +
      '<li>Otherwise read the cell. A cell <b>N + d</b> is on the event scale: the consumer reads the new value while the picture processor processes dot N + d, and on every later dot; on dot N + d &minus; 1 it still reads the old value, or the transient the cell names for that dot. In the original&rsquo;s column the seven drawing registers (LCDC, SCY, SCX, WX, BGP, OBP0, OBP1) already carry Rule E.1/8&rsquo;s extra machine cycle, so with the screen on they are seen four dots later than their lead alone gives.</li>' +
    '</ol></div>' +
    '<div class="gbemu-rule" id="gbr-E-1-1-2"><b>Rule E.1.1/2.</b> A write with no lead is first seen on N&nbsp;+&nbsp;4 (N&nbsp;+&nbsp;2 in double speed).</div>' +
    '<div class="gbemu-why"><b>Why.</b> Working from the lead column alone puts the palettes one pixel early, WX one dot off and SCX a dot out, because a lead means nothing until you know which dots the write&rsquo;s machine cycle covers. This table needs no lead convention: implement the dot. To get E.1&rsquo;s lead back from a cell, subtract the cell from <code>N + B</code>. A build that lands every bus access at the end of its machine cycle implements these cells directly and needs no lead at all. The screen-off case is read from our source (<code>write8</code>: the lag is taken only on the original, with the screen on, for the seven drawing registers).</div>' +
    '<table class="gbemu-table"><thead><tr><th>Register, consumer</th><th>Original, screen on (B = 4, N = 4k + 1): first dot the consumer reads the new value, event scale, from N</th><th>Colour, single speed (B = 4, N = 4k + 2): same scale</th><th>Colour, double speed (B = 2, N even): same scale</th></tr></thead><tbody>' +
      '<tr><td><b>SCY</b>, every fetcher read of it (map row and both data reads)</td><td>N + 7</td><td>N + 4</td><td>N + 2</td></tr>' +
      '<tr><td><b>SCX</b>, the register (the fine-scroll discard latches it live on dot 89)</td><td>N + 7</td><td>N + 3</td><td>N + 1</td></tr>' +
      '<tr><td><b>SCX</b>, the background map read (tile column)</td><td>N + 7</td><td>N + 4: the pre-write SCX is held for this consumer for one dot</td><td>N + 2</td></tr>' +
      '<tr><td><b>WX</b>, the register</td><td>N + 6</td><td>N + 2</td><td>N</td></tr>' +
      '<tr><td><b>WX</b>, the window takeover comparator</td><td>N + 7 when the pre-write WX is 7 or more (the one-dot hold of E.8), otherwise N + 6</td><td>N + 3 when the pre-write WX is 7 or more, otherwise N + 2</td><td>N + 1 when the pre-write WX is 7 or more, otherwise N</td></tr>' +
      '<tr><td><b>WY</b>, the register and the per-frame arming test (every dot)</td><td>N + 4</td><td>N + 4</td><td>N + 2</td></tr>' +
      '<tr><td><b>BGP</b>, at the output stage</td><td>old OR new on N + 6; the new value from N + 7</td><td>N + 2; no OR dot</td><td>N + 1 (not consulted in colour mode, where double speed lives)</td></tr>' +
      '<tr><td><b>OBP0, OBP1</b>, at the output stage</td><td>N + 6</td><td>N + 2</td><td>N + 1</td></tr>' +
      '<tr><td><b>LCDC</b>, every consumer, for a write that lands in mode 3 with the display on</td><td>lead dots N + 4 and N + 5, conflict dot N + 6, commit dot C = N + 7; each consumer in E.9.1</td><td>lead dots N and N + 1, conflict dot N + 2, C = N + 3</td><td>no lead dots; conflict dot N, C = N + 1; each consumer in E.9.1</td></tr>' +
      '<tr><td><b>LCDC</b>, a write that lands outside mode 3, or with the display off</td><td>no train: the whole register, every consumer at once, on N + 8 with the display on, and on N + 4 for a write made with the display off, as for any write with no lead</td><td>N + 4</td><td>N + 2</td></tr>' +
      '<tr><td><b>STAT</b>, the register and the status line</td><td>the all-selects value <code>$78</code> on N + 4, the written bits from N + 5; the line is re-evaluated at the write and again after N + 4</td><td>the Colour&rsquo;s intermediate (bit 6 old, bits 5 to 3 new) on N + 4, the written bits from N + 5</td><td>the intermediate (bit 3 old, bits 6 to 4 new) on N + 2, the written bits from N + 3</td></tr>' +
      '<tr><td><b>LYC</b>, the coincidence comparator</td><td>N + 5: the comparison on N + 4 still uses the old LYC</td><td>N + 5</td><td>N + 3</td></tr>' +
      '<tr><td><b>IF</b>, against requests the picture unit raises</td><td>the written value lands after dot N + 4: a request raised on N + 4 or earlier is overwritten by it, one raised on N + 5 or later survives</td><td>the same</td><td>lands after N + 2; a request on N + 3 or later survives</td></tr>' +
      '<tr><td><b>IF</b>, against timer and serial requests</td><td colspan="3">the lead is a picture-side quantity only. The write&rsquo;s own machine cycle runs its four timer ticks first (the timer, and the serial clock divided from the same counter), then the picture&rsquo;s dots, then the write lands: a timer or serial request raised in the write&rsquo;s own cycle is overwritten by the written value, and one raised in the next cycle&rsquo;s ticks survives. The written value replaces all five bits. Both machines, both speeds. MECHANISM, read from our source (the write path ticks the timer before it pays the picture and stores IF)</td></tr>' +
    '</tbody></table>' +
    '<div class="gbemu-example"><b>Example (the extra machine cycle).</b> On the original with the screen on, <code>LDH (0x47),A</code> writes BGP in a machine cycle covering dots 101 to 104, so N = 101 (4 &times; 25 + 1). The register holds old OR new on dot 107 (N + 6) and the new value from dot 108 (N + 7). On an object-free line at SCX&nbsp;=&nbsp;0 (Rule E.1.1/4) that is screen column 9 for the OR and columns 10 onward for the new value. Reading the lead column alone (+2, two dots before the end of the write&rsquo;s cycle) would put the OR on dot 103 and the new value on 104, columns 5 and 6: four columns early, because it leaves out Rule E.1/8.</div>' +
    '<div class="gbemu-example"><b>Example (the OBP convention).</b> On a Colour at single speed an OBP0 write in a cycle covering dots 102 to 105 has N = 102 (4 &times; 25 + 2): the output stage applies the new OBP0 from dot 104 (N + 2). Reading the source&rsquo;s constant 3 as a lead (three dots before the cycle end) would apply it from dot 103, one pixel early.</div>' +
    '<div class="gbemu-example"><b>Example (screen off, and double speed).</b> On the original with LCDC bit 7 = 0, an SCX write with N = 201 holds the new SCX from dot 205 (N + 4): no lead, no extra machine cycle, and nothing draws. On a Colour in double speed, a WY write with N = 100 is seen by the arming test from dot 102 (N + 2).</div>' +
    '<div class="gbemu-rule" id="gbr-E-1-1-3"><b>Rule E.1.1/3.</b> Every cell above is a property of the shipped core and must be reproduced as a dot; the evidence label on whether hardware agrees stays exactly as E.1&rsquo;s table gives it for each register.</div>' +
    '<div class="gbemu-why"><b>Labels.</b> Every dot in this table is <b>INSTRUMENT-MEASURED</b> on the shipped core: a per-dot probe that logs each register as its consumers read it on every dot, run on a probe cartridge of our own that writes each register during mode 3, on the original, the Colour in compatibility mode, the Colour in colour mode, and the Colour in double speed (compatibility and colour mode gave identical dots). It describes our core and reproduces our renders; every double-speed cell is unscored by any cartridge we hold. The original&rsquo;s and the single-speed Colour&rsquo;s columns are measured with the probe in our source tree (<code>test/tabprobe</code>), which takes N from a WY write made at the same point of the same program (WY has no lead and no lag, so it is first seen on N&nbsp;+&nbsp;4) and reads every consumer on every dot; the same probe built with <code>DMG_WRITE_LAG</code> at 0 reads every lagged cell of the original&rsquo;s column exactly four dots earlier, which is the check that the instrument reads the lag. <b>Falsifier:</b> any cell reading differently on an instrumented build of the shipped core.</div>' +
    '<div class="gbemu-rule" id="gbr-E-1-1-4"><b>Rule E.1.1/4.</b> <b>Where the consumers read, so the table turns into pixels.</b> On an object-free line at SCX&nbsp;=&nbsp;0, on both machines and at both speeds, the background fetcher&rsquo;s step bodies execute on these line dots (event scale, Rule E/1):' +
    '<ol class="gbemu-steps">' +
      '<li>the priming fetch on 85, 87 and 89;</li>' +
      '<li>the map read on 91;</li>' +
      '<li>the low data read on 93;</li>' +
      '<li>the high data read on 95;</li>' +
      '<li>the push on 97;</li>' +
      '<li>and every eight dots after that (map reads on 99, 107, 115 and so on).</li>' +
    '</ol>' +
    'The pixel for screen column x leaves the queue on dot <code>97 + x</code> and reaches the screen on dot <code>98 + x</code>. So the background-enable view on dot d decides column <code>d &minus; 97</code>, and a palette value present on dot d colours column <code>d &minus; 98</code>.</div>' +
    '<div class="gbemu-why"><b>Why.</b> Checked on pixels: background-enable toggled by writes whose conflict dots fall on 127, 147, 179 and 199 of one line changed the screen at exactly columns 30, 50, 82 and 102, and BGP writes whose values landed on dots 128 and 148 (the second with its OR on 147) changed the screen at columns 30 and 49: dot minus 98, with the OR taking the first column. The two written values are not recorded here. The result needs the first write&rsquo;s old value ORed with its new one to equal its old value, so that its OR on 127 changes nothing, and the second write&rsquo;s not to; values whose first OR differs also change column 29. MECHANISM, derived from the OR rule. And the original&rsquo;s OR always lands on a column of the form 4k&nbsp;+&nbsp;1, which is why E.1.2&rsquo;s transients sit on columns 1, 13, 145 and 157.</div>' +

    '<p class="gbemu-key"><b>E.1.2: The palette stage, in full, because it is the one people ' +
    'get wrong twice.</b> Two separate facts, and they are easily confounded, plus one rule for column 0.</p>' +
    '<div class="gbemu-rule" id="gbr-E-1-2-1"><b>Rule E.1.2/1.</b> <b>The palette is applied where the pixel reaches the screen (the output stage, one dot after the pop), not where it leaves the ' +
        'queue.</b> The queue holds colour <em>indices</em>.</div>' +
    '<div class="gbemu-why"><b>Why.</b> With the palette at the output stage, the cartridges that improve against a palette applied at the pop are all consumed at the output stage; every geometry cartridge (scroll, window ' +
        'position, map select, data select) is <b>unchanged to the pixel</b>, which is the ' +
        'right signature and a better argument than the size of the improvement. <b>MECHANISM.</b></div>' +
    '<div class="gbemu-rule" id="gbr-E-1-2-2"><b>Rule E.1.2/2.</b> <b>On the original, a background-palette write shows a one-pixel transient of <code>old | new</code>.</b> ' +
        'The register genuinely holds the OR for one dot: it takes <code>old|new</code> two dots ' +
        'before its cycle would end and the real value one dot later (on the original with the screen ' +
        'on, the whole pair one machine cycle later, Rule E.1/8; the absolute dots are E.1.1&rsquo;s BGP row). <b>This is a background ' +
        'phenomenon only</b>: the object palettes do not do it, and our object-side OR ships ' +
        'at 0.</div>' +
    '<div class="gbemu-example"><b>Example.</b> BGP goes from <code>0xE4</code> to <code>0x1B</code>. For one dot the register reads <code>0xE4 | 0x1B</code> = <code>0xFF</code>, so a background pixel of index 1 shows shade 1 (old), then shade 3 (the OR) for one column, then shade 2 (new).</div>' +
    '<div class="gbemu-rule" id="gbr-E-1-2-3"><b>Rule E.1.2/3.</b> <b>One rule for the first pixel of a line, on the original.</b> Screen column 0 takes the shade that the palette gives it at its own ' +
        'output dot AND the shade the palette gives at column 1&rsquo;s output dot, combined bit by ' +
        'bit. So a palette change that covers column 0 alone, or starts at column 1, leaves column 0 ' +
        'unchanged; a change covering both columns changes it. Where the palette does not change ' +
        'between those two dots it changes nothing. <b>Which palette</b>: whichever column 0 used, BGP or OBP0/OBP1. At column 1&rsquo;s output dot our core decides column 0&rsquo;s winner again from its queue slot (object colour, priority bit, background colour), and takes that winner&rsquo;s palette as it stands then. <b>The object enable this second decision uses is the one column 1&rsquo;s own merge uses</b>: through the one-dot shadow of Rule E.1.3/4, that is the register as it stood on column 1&rsquo;s pop dot. It is <em>not</em> the register as it stands on column 1&rsquo;s output dot, and it is not column 0&rsquo;s own live read of Rule E.1.3/5. <b>The background colour this second decision uses is the slot&rsquo;s own, unblanked: it makes no background-enable test</b> (LCDC bit 0 is not read for it, neither as column 0 saw it nor as column 1 sees it), and the priority bit is weighed against that same colour. ' +
        'Not on the Colour.</div>' +
    '<div class="gbemu-example"><b>Example (background enable).</b> Column 0&rsquo;s background pixel is one the palette draws in shade 3, with no object over it. A write clearing LCDC bit 0 lands after column 0&rsquo;s own merge (Rule E.1.3/5), which still reads the enable set: shade 3. From column 1&rsquo;s pop the enable reads clear, so column 1 onwards shows background colour 0. The second decision takes the slot&rsquo;s colour as it is, with no enable test: shade 3, and 3 AND 3 = 3, so column 0 stays shade 3. A build that applies column 1&rsquo;s background enable to the second decision gets colour 0 there and 3 AND 0 = 0: on mealybug <code>m3_lcdc_bg_en_change</code> that is 4 wrong pixels, column 0 of lines 75 to 78. Read from our source; an independent build changed in this one place goes from 23 to 24 of 24 mealybug cells.</div>' +
    '<div class="gbemu-example"><b>Example (object enable).</b> Column 0 shows an object pixel (object colour 3, OBP0 shade 3) over background index 0. Column 1 is popped on dot P + 1 and output on dot P + 2. A write clearing object enable puts the new value in the register from dot P + 2. Column 0&rsquo;s own merge (Rule E.1.3/5, on dot P + 1) sees object enable set: shade 3. The second decision on dot P + 2 reads the shadow, which still holds the register of dot P + 1 (set): the winner is again the object, shade 3, and 3 AND 3 = 3, so column 0 shows the object. Reading the register live on dot P + 2 (clear) would make the winner background index 0 and turn column 0 into background colour 0; that reading is wrong.</div>' +
    '<div class="gbemu-example"><b>Example.</b> Column 0 is background index 1 with <code>BGP = 0xE4</code> (shade 1, binary 01). A write to <code>0xFF</code> (shade 3, binary 11) whose new value is present on column 0&rsquo;s output dot and on column 1&rsquo;s: 11 AND 11 = shade 3, column 0 changes. Present on column 0&rsquo;s dot only (old again on column 1&rsquo;s): 11 AND 01 = shade 1, unchanged. Present from column 1&rsquo;s dot only: 01 AND 11 = shade 1, unchanged.</div>' +
    '<div class="gbemu-why"><b>Why.</b> It needs no extra state, because column 0&rsquo;s ' +
        'queue slot is still intact when column 1 is output. Evidence: the AGE test ' +
        '<code>m3-bg-bgp</code>, a photograph of a DMG-CPU C, where a BGP write to black covering column 0 ' +
        'alone (lines 9 and 21) or starting at column 1 (lines 32 and 44) leaves column 0 as it was. ' +
        'It passes with this rule (0 pixels; 2 pixels without it), and mealybug stays 24 of 24. <b>FITTED</b>: one photograph, and ' +
        'the mechanism is not known; the bitwise AND is the smallest rule that reads all four lines. The evidence is a BGP write only, so the object side is read from our source and not measured. ' +
        'Constant: <code>PX0_LATE_DMG</code> = 1.</div>' +
    '<div class="gbemu-why"><b>Why.</b> <b>The trap: three knobs move one quantity.</b> ' +
    '<code>D = OR + BGP_LEAD + OUT_PIPE</code>, where <code>OUT_PIPE</code> is how many dots a ' +
    'colour index waits between the queue and the screen. The optimum is <code>D = 3</code> and the ' +
    'three substitute for each other, so you can reach the right answer three ways and only one of ' +
    'them is the mechanism. <b>What separates them:</b> at <em>equal D</em>, the OR-on corner beats ' +
    'the OR-off corner by at least <b>880 pixels</b>. The OR survives the substitution that absorbs ' +
    'the other two axes, so it is a real mechanism and not a phase knob wearing its name. Our ' +
    'shipped corner is <code>OR = 1, lead = 2, pipe = 0</code>. <b>INSTRUMENT-MEASURED.</b></div>' +
    '<div class="gbemu-why"><b>And how that evidence is labelled, because the label is easy to ' +
    'over-trust.</b> Our render carries 128 OR transients at screen columns ' +
    '1, 13, 145 and 157 on the monochrome reference and zero on the colour reference, which ' +
    'is how we know the mechanism belongs to the device that has it. <b>That is scored against ' +
    'reference renders, which are the suite author&rsquo;s own emulator output, so it is ' +
    'CONVERGENCE and not a hardware observation.</b> Our own source calls it a direct reference ' +
    'observation and a reader could easily read those words as silicon. It is not. And the object ' +
    'side&rsquo;s <code>OR = 0</code> rests on one cartridge&rsquo;s residual optimum plus ' +
    'self-consistency, and that cartridge provably cannot tell the OR from one dot of lead: ' +
    '<b>do not quote the object arm as evidenced.</b></div>' +

    '<p class="gbemu-key"><b>E.1.3: LCDC, which is not one register.</b> The dots named here (lead dots, conflict dot, commit dot C) are E.1.1&rsquo;s LCDC rows, on the event scale.</p>' +
    '<div class="gbemu-rule" id="gbr-E-1-3-1"><b>Rule E.1.3/1.</b> On monochrome ' +
    'hardware an LCDC write during drawing is <b>two-stage</b>: for exactly one dot (the conflict dot) the register ' +
    'reads <code>old | (new &amp; BG_ENABLE)</code>, and only then the real value. So clearing any ' +
    'bit, and setting any bit except background-enable, is one dot late, except as Rules E.1.3/2 and E.1.3/7 say.</div>' +
    '<div class="gbemu-rule" id="gbr-E-1-3-2"><b>Rule E.1.3/2.</b> <b>The object-enable exception, as our core ships it.</b> For every mode-3 write whose new value has object-enable (bit 1) clear, wherever on the line it lands, the intermediate on the conflict dot carries bit 1 cleared. In dots (E.9.1): a clearing write reaches the outstanding-work test on C &minus; 1 and the merge on C; a setting write reaches them on C and C + 1.</div>' +
    '<div class="gbemu-example"><b>Example.</b> LCDC goes from <code>0x93</code> to <code>0x91</code> (object-enable cleared). By Rule E.1.3/1 alone the conflict dot would read <code>0x93 | (0x91 &amp; 0x01)</code> = <code>0x93</code>, objects still on; with the exception it reads <code>0x91</code>. From <code>0x91</code> to <code>0x93</code> (object-enable set) the conflict dot reads <code>0x91</code>: the set is one dot late.</div>' +
    '<div class="gbemu-why"><b>Why.</b> <b>One documented ' +
    'exception:</b> a write that <em>clears</em> object-enable takes effect immediately (not ' +
    'a dot late) when it lands at the start of a line or during an object fetch. Without it ' +
    'the intermediate keeps objects enabled for one dot and a mode-0 timing cartridge fails. ' +
    '<b>MECHANISM.</b> Our core applies it unconditionally, as Rule E.1.3/2 states. The conditional form was built and measured behind its own constant (<code>OBJ_EN_EXC</code> at 0) and refuted: it fixed neither of the two pixels it was predicted to fix and created 88 across the two object-enable cells, so the shipped value, 1, is unconditional. The refutation is READ FROM OUR OWN SOURCE (its measurement block at that constant); the dots are INSTRUMENT-MEASURED.</div>' +
    '<div class="gbemu-rule" id="gbr-E-1-3-3"><b>Rule E.1.3/3.</b> <b>This part is not optional.</b> LCDC&rsquo;s bits are ' +
    'read by <em>different consumers at different dots</em>, and the same write is visible to some ' +
    'and not others on the same dot. Each consumer takes its own view of LCDC, named by a <b>tag</b> in the tables below. <b>Read E.9 before building this table: it ' +
    'prints each tag as an explicit dot set relative to the commit dot, which is the form to ' +
    'build from. The tags below are our internal names and nothing else.</b></div>' +
    '<div class="gbemu-why"><b>Why.</b> MECHANISM. This core routes every LCDC read through one accessor carrying ' +
    'a per-consumer <b>settling width</b>. <b>Those integers are opaque tags, not dot counts, and ' +
    'they do not form an ordinal: E.9 decodes them into the dots they stand for and says ' +
    'which part of the decode is not established.</b></div>' +
    '<table class="gbemu-table"><thead><tr><th>Tag (a name, not a dot count)</th><th>What the consumer sees (dots relative to E.1.1&rsquo;s lead dots, conflict dot and commit dot)</th></tr></thead><tbody>' +
      '<tr><td>6</td><td>the new value for the whole two-dot lead window (earliest)</td></tr>' +
      '<tr><td>7</td><td>the new value on the conflict dot (one dot early)</td></tr>' +
      '<tr><td>8</td><td>the register as committed (nominal)</td></tr>' +
      '<tr><td>9</td><td>the <b>pre-write</b> value for one dot after the commit (one dot late)</td></tr>' +
      '<tr><td>10</td><td>the union of the last lead dot and the conflict dot (a contiguous two-dot early window)</td></tr>' +
      '<tr><td>61</td><td>tag 6 restricted to the <b>last</b> lead dot only</td></tr>' +
    '</tbody></table>' +
    '<table class="gbemu-table"><thead><tr><th>Bit (of LCDC)</th><th>Name</th><th>Consumer</th><th>Tag (E.9 gives its dots)</th><th>Label</th></tr></thead><tbody>' +
      '<tr><td>0</td><td>BG_ENABLE</td><td>the pixel merge, at the queue pop</td><td><b>7</b></td><td>MECHANISM: the released bit of the two-stage write</td></tr>' +
      '<tr><td>1</td><td>OBJ_ENABLE</td><td><b>object selection</b>: is this object served at all</td><td><b>61</b></td><td>FITTED</td></tr>' +
      '<tr><td>1</td><td>OBJ_ENABLE</td><td><b>outstanding-work test</b>: is object work still owed</td><td><b>8</b></td><td>MECHANISM (nominal)</td></tr>' +
      '<tr><td>1</td><td>OBJ_ENABLE</td><td><b>the merge</b>, at the screen write</td><td><b>7</b> plus a permanent one-dot shadow</td><td>see Rule E.1.3/4</td></tr>' +
      '<tr><td>2</td><td>OBJ_SIZE</td><td>the object fetch&rsquo;s <b>low</b>-plane address</td><td><b>9</b></td><td>FITTED</td></tr>' +
      '<tr><td>2</td><td>OBJ_SIZE</td><td>the object fetch&rsquo;s <b>high</b>-plane address</td><td><b>10</b> when <code>(OAM_X + SCX) mod 8 &lt; 5</code> (Rule E.1.3/6), else <b>8</b></td><td>FITTED</td></tr>' +
      '<tr><td>2</td><td>OBJ_SIZE</td><td>the sprite-memory scan</td><td><b>9</b></td><td>inert on our corpus</td></tr>' +
      '<tr><td>3</td><td>BG_MAP</td><td>the map read at step 0</td><td><b>8</b></td><td>MECHANISM-adjacent; the <em>release</em> of this consumer from the two-stage conflict is DERIVED</td></tr>' +
      '<tr><td>4</td><td>TILE_SEL</td><td>background data path</td><td><b>8</b></td><td>DERIVED: read live and ungated at both data steps, on every model</td></tr>' +
      '<tr><td>4</td><td>TILE_SEL</td><td><b>window</b> data path</td><td><b>7</b></td><td><b>FITTED</b></td></tr>' +
      '<tr><td>5</td><td>WIN_ENABLE</td><td>the window comparator, the window stop test and the per-frame arming test</td><td><b>8</b>, but the bit is written into the register on the last lead dot, so all three see a set and a clear alike from <b>C &minus; 2</b> at single speed</td><td>the dot: INSTRUMENT-MEASURED; why the bit goes early: FITTED; see Rule E.1.3/7.</td></tr>' +
      '<tr><td>6</td><td>WIN_MAP</td><td>the window map read</td><td><b>8</b>, and the bit is in the register from the last lead dot, so the new map is read from <b>C &minus; 2</b></td><td>the dot: INSTRUMENT-MEASURED.</td></tr>' +
    '</tbody></table>' +
    '<div class="gbemu-rule" id="gbr-E-1-3-4"><b>Rule E.1.3/4.</b> <b>Bit 1 at the merge takes the value as it stood ONE DOT EARLIER, permanently</b>, at every ' +
      'column but column 0 (Rule E.1.3/5). Not a conflict-window special case: a standing one-dot shadow at ' +
      'that one consumer.</div>' +
    '<div class="gbemu-why"><b>Why.</b> During output a pixel and a dot are the same thing, which is why the symptom is' +
      ' a boundary displaced by exactly one pixel. <b>MECHANISM in shape</b> (the mixing stage consults ' +
      'the enable one dot behind) <b>and it is not expressible as a settling width</b>: tags 7, 8 and 9' +
      ' all give the identical board. Measured: the shadow fixes all 56 original pixels and, without Rule E.1.3/5, ' +
      'creates two, at column 0 on two lines (lines 17 and 22, column 0, of <code>m3_lcdc_obj_en_change</code> and of its variant); with Rule E.1.3/5 those two are not on the board. ' +
      'Stated because &ldquo;54 of 56&rdquo; would be the wrong description.</div>' +
    '<div class="gbemu-rule" id="gbr-E-1-3-5"><b>Rule E.1.3/5.</b> <b>Screen column 0 is merged one dot later than every other column, on the original.</b> Every other column takes background-enable at its pop (the tag-7 ' +
      'view, E.9.1) and object-enable through the one-dot shadow of Rule E.1.3/4, which is the register as it stood' +
      ' on the pop dot. The pixel for screen column 0 takes both on the dot after its pop, the dot it ' +
      'reaches the screen (E.5.1): background-enable through the same tag-7 view, consulted a dot later, ' +
      'and object-enable as the register itself holds it on that dot, with no shadow. For column 0 popped' +
      ' on dot P, column 0 sees the write as this table gives:' +
      '<table class="gbemu-table"><thead><tr><th>Mode-3 LCDC write (commit dot C, E.1.1)</th><th>Column 0 sees the new bit when (dots, event scale)</th></tr></thead><tbody>' +
      '<tr><td>a set or a clear of background-enable</td><td>P + 1 is C &minus; 1 or later</td></tr>' +
      '<tr><td>a clear of object-enable</td><td>P + 1 is C &minus; 1 or later (the conflict dot&rsquo;s intermediate already carries the cleared bit: Rule E.1.3/2)</td></tr>' +
      '<tr><td>a set of object-enable</td><td>P + 1 is C or later</td></tr>' +
      '</tbody></table></div>' +
    '<div class="gbemu-example"><b>Example.</b> A clipped object stalls the first pop to dot 106 (P = 106) and a mode-3 write clearing background-enable has C = 108. P + 1 = 107 = C &minus; 1, so column 0 shows the clear. Under the every-other-column rule column 0 would take background-enable at its pop on 106 = C &minus; 2, before the tag-7 view shows the new value, and would not.</div>' +
    '<div class="gbemu-why"><b>Why it is rarely visible:</b> on an object-free line at SCX &amp; ' +
      '7 = 0 the first pop is on dot 97, which is C &minus; 3 or C + 1 of any mode-3 LCDC write on the ' +
      'original and never on the one dot where the two rules differ; a clipped object&rsquo;s stall (or a' +
      ' fine scroll) is what moves the first pop there. Measured on the three cells it closes, where a ' +
      'clipped object stalls the first pop to dot 106, which is C &minus; 2 of a clear whose C is 108: ' +
      '<code>m3_lcdc_bg_en_change</code> lines 19 to 22 (the background-enable half, 4&nbsp;px when it ' +
      'alone is switched off), <code>m3_lcdc_obj_en_change</code> and ' +
      '<code>m3_lcdc_obj_en_change_variant</code> lines 17 and 22 (the object-enable half, 2&nbsp;px ' +
      'each). Both halves off: the original&rsquo;s board reads 21 of 24 instead of 24 of 24, those 8&nbsp;px and ' +
      'nothing else, and the Mooneye cartridges unmoved. Only clears are scored: in all three cells every' +
      ' LCDC write that reaches a column-0 pop inside its window clears its bit, so the two set halves ' +
      'are READ FROM OUR OWN SOURCE and unscored. The constant is <code>LX0_LIVE</code> = 1, on the ' +
      'original&rsquo;s arm only. Label: CONVERGENCE (our source records the rule as read from a ' +
      'reference implementation&rsquo;s construction, and the images it is scored against are emulator ' +
      'renders, E.1.2); the dots are INSTRUMENT-MEASURED. Our source also records the obvious variant, ' +
      'background-enable taken early at the insert instead of late, as measured and wrong (4 pixels ' +
      'created, none fixed): it is the stage that moves, not the freshness of the value.</div>' +

    '<div class="gbemu-rule" id="gbr-E-1-3-6"><b>Rule E.1.3/6.</b> <b>Bit 2 is sampled TWICE inside one object fetch</b>, once per plane, and the two ' +
        'samples may disagree. <b>They are not at two ' +
        'dots. Both plane reads happen on the SAME dot (the last dot of the six) and ' +
        'the fetch forms TWO ADDRESSES, each from its own view of LCDC.</b> The low plane&rsquo;s address is formed with tag 9; the high ' +
        'plane&rsquo;s with tag 10 when <code>(OAM_X + SCX) mod 8 &lt; 5</code> and tag 8 otherwise, evaluated on the object&rsquo;s OAM X and the live SCX. That second formation point costs no dot: the read ' +
        'stays where it is and only the sample its address is computed from moves. <b>The formula is the rule, not the wait</b>: an object served at once (at a parked fetcher, or later in a run of objects at one position) still takes the early view when the formula holds, and a wait that did happen for another reason does not count.</div>' +
    '<div class="gbemu-example"><b>Example.</b> OAM X = 19 at SCX = 0: <code>19 mod 8</code> = 3, less than 5, so the high-plane address uses tag 10. OAM X = 20 at SCX = 1: <code>21 mod 8</code> = 5, not less than 5, so it uses tag 8.</div>' +
    '<div class="gbemu-why"><b>Why.</b> <b>Where the two samples sit, because the flat 6 and this ' +
        'requirement have to be reconciled:</b> our source says ' +
        'exactly this: forming one address for both planes means LCDC.2 <i>&ldquo;could only ' +
        'ever reach both planes together, and every residual on ' +
        '<code>m3_lcdc_obj_size_change</code> is a HIGH-plane difference the shipped shape cannot ' +
        'express&rdquo;</i>. <b>So the transferable statement is a second address-formation point, ' +
        'not a second dot</b>, and an implementer who spends dots looking for the second read will not ' +
        'find one. That is required, not optional: a program that changes sprite height ' +
        'between the two reads gets one plane from an 8-row sprite and the other from a 16-row ' +
        'sprite, and the reference demands a pixel value a core without it cannot produce anywhere ' +
        'in the frame. <b>The condition on the high plane&rsquo;s early window is FITTED and its ' +
        'magnitude is given outright</b>: the early window applies when ' +
        '<code>(OAM_X + SCX) mod 8 &lt; 5</code>, the case in which this fetch waits for the ' +
        'fetcher. (The formula as the rule is read from our source.) Our source argues the 5 is not a new constant but the wait ladder&rsquo;s own 5; ' +
        '<b>the same block also records a scoring plateau over 4 to 7</b>, so the 5 is selected by ' +
        'score inside a plateau and the argument is an argument, not a derivation.</div>' +
    '<div class="gbemu-rule" id="gbr-E-1-3-7"><b>Rule E.1.3/7.</b> <b>Bits 5 and 6 reach the register one dot ahead of the rest, in both directions.</b> At single speed a write landing in mode 3 puts the new window-enable and window-map bits into the register itself on the last lead dot (C &minus; 2), before the intermediate exists, and they stay new through the conflict dot. So the window comparator, the window stop test, the per-frame arming test and the window map read all see a <em>set</em> and a <em>clear</em> from C &minus; 2. <b>That last consumer is the original&rsquo;s.</b> On the Colour at single speed the register holds the bits from C &minus; 2 too, but the window map read sees them one dot later, from C &minus; 1 (its view lags the register by one dot; in double speed C + 1), as E.9.1&rsquo;s table and the Colour tab give it; the comparator, stop test and arming test are C &minus; 2 on both. The clear-only release (constant <code>WINCMP_CLR_EARLY</code>: on the conflict dot, a write that clears window-enable is shown cleared to the comparator) is shipped, but at single speed it changes nothing, because the clear has already arrived a dot earlier. It acts only where there are no lead dots, which is the Colour in double speed: there a clear reaches the comparator on C &minus; 1 and a set on C.</div>' +
    '<div class="gbemu-why"><b>Why.</b> The constants: <code>WLEAD_BITS</code> names the bits written early (5 and 6) and <code>WLEAD_DOTS</code> how many dots ahead of the intermediate (1). One site, five consumers behind it. Our core is early in both directions. Dots INSTRUMENT-MEASURED; the early write of bits 5 and 6 is FITTED (shipped on the evidence of one cartridge, as the Colour tab records).</div>' +
    '<div class="gbemu-rule" id="gbr-E-1-3-8"><b>Rule E.1.3/8.</b> <b>The two-stage write&rsquo;s lead and its pending repayment are one budget, not two knobs.</b> The cycle must balance: <code>pending == B &minus; 1 + lead</code>, where B is the dots per machine cycle, unconditionally, in the same scope as the subtraction.</div>' +
    '<div class="gbemu-why"><b>FITTED, and this one is worth flagging loudly.</b> The two-stage ' +
    'write&rsquo;s <em>lead</em> is 2 dots and its <em>pending</em> repayment is 5 dots, and ' +
    '<b>those two are one budget, not two knobs</b>. The cycle balances only when ' +
    '<code>pending == B &minus; 1 + lead</code>, which at the four-dot budget this site ships ' +
    'under is <code>pending == 3 + lead</code>, and this core refuses to compile an unbalanced ' +
    'pair. An ' +
    'unbalanced pair silently drops one picture dot on every LCDC write, so a game that writes LCDC ' +
    'once a line drifts one dot per line for ever, and the dropped dot reads as a lead effect in every measurement taken on such a core. If you take one engineering lesson from this appendix, take that ' +
    'one: any subtract-then-repay construct must repay unconditionally in the same scope as the ' +
    'subtraction, or it is not a lead, it is a leak.</div>' +
    '<div class="gbemu-why"><b>&ldquo;Pending repayment&rdquo;, defined in E.5&rsquo;s currency, ' +
    'because one write has one balance law and the term has to be in E.5&rsquo;s units before it ' +
    'can be checked against it.</b> E.5 says a register with lead <code>L</code> ticks ' +
    '<code>withheld = max(0, B &minus; L)</code> dots before the access and owes ' +
    '<code>owed = 2B &minus; withheld</code> after, the pair summing to <code>2B</code>. ' +
    '<b><code>pending</code> here is that <code>owed</code> minus one</b>, and the one is not a ' +
    'discrepancy: <b>this site performs one internal tick of its own that E.5&rsquo;s generic path ' +
    'does not</b>. Count what the cycle contributes either way and both come to <code>B</code>: ' +
    'here <code>(pend &minus; lead) + 1 + pending &minus; pend</code>, in the generic path ' +
    '<code>(pend &minus; lead) + owed &minus; pend</code>. So in full, ' +
    '<code>pending = 2B &minus; max(0, B &minus; lead) &minus; 1</code>, which is ' +
    '<code>B &minus; 1 + lead</code> wherever the lead fits in the budget and clamps with it where ' +
    'it does not (E.5&rsquo;s two-dot case). <b>At <code>B = 4</code>, lead 2: withheld 2, owed 6, ' +
    'pending 5, which is the shipped pair.</b></div>' +
    '<div class="gbemu-rule" id="gbr-E-1-3-9"><b>Rule E.1.3/9.</b> <b>Do not hard-code the 3.</b> The 3 is <code>B &minus; 1</code>, <em>not</em> <code>B</code>; a build must not substitute <code>B</code> for it.</div>' +
    '<div class="gbemu-why"><b>Why, and the obvious repair is the wrong ' +
    'one, which is why it is written out here.</b> Substituting ' +
    '<code>B</code> makes this site repay what E.5&rsquo;s tick-free path repays while still ' +
    'performing its own tick, injecting an extra dot per write on every device. A second ' +
    'defect wearing the first one&rsquo;s clothes, and our own source names that exact substitution ' +
    'as the mistake to avoid when unifying the two constructs. <b>Read from source</b>: ' +
    '<code>src/gb.c</code>, the LCDC guard (<code>LCDC_PEND != 3 + LCDC_LEAD</code> is a compile ' +
    'error) and the comment at the palette write that derives the <code>&minus;1</code> from the ' +
    'internal tick. <b>The limit, stated rather than left in the guard:</b> that compile-time check ' +
    'spells the <code>3</code> as a literal, so it is blind to the budget. ' +
    'It is sound as shipped because the site is reached with <code>B = 4</code>, and the colour ' +
    'path through it is registered as an unresolved row rather than an implemented one, ' +
    '<b>which is the honest reason this has not bitten, not a reason it cannot.</b></div>' +

    '<p class="gbemu-key"><b>E.1.4 (What happens to a write that lands mid-fetch: nothing ' +
    'special, and that is the answer).</b></p>' +
    '<div class="gbemu-rule" id="gbr-E-1-4-1"><b>Rule E.1.4/1.</b> A write whose first-seen dot falls after a fetch&rsquo;s map read and no later than its ' +
    'data reads is seen by the data reads and not by the map read, because each step reads what it ' +
    'needs on its own dot. There is no snapshot, no latch and no fetch-in-progress guard. That is ' +
    'the whole of the mid-line behaviour on an uninterrupted line. <b>The one exception is an object ' +
    'stall</b>, and it is E.3.</div>' +
    '<div class="gbemu-example"><b>Example.</b> On an object-free line at SCX&nbsp;=&nbsp;0 the map read is on dot 91 and the data reads on 93 and 95 (Rule E.1.1/4). An SCY write first seen by the fetcher on dot 92 is used by both data reads of that fetch (the row within the tile), while the map read on 91 used the old SCY for the map row.</div>' +

    '<p class="gbemu-key"><b>E.1.5: &ldquo;Roughly a machine cycle&rdquo; is two different ' +
    'facts and neither of them is roughly.</b> A write is commonly described as gated roughly a ' +
    'machine cycle behind a read of the same register. That description conflates register visibility ' +
    'with access blocking.</p>' +
    '<div class="gbemu-rule" id="gbr-E-1-5-1"><b>Rule E.1.5/1.</b> <b>Fact one: register visibility. The lead is ZERO dots by ' +
    'default.</b> A write lands at the end of its machine cycle; a read samples at the end of its ' +
    'machine cycle. They are the same instant, and the per-register departures are the table in E.1 ' +
    '(<b>&minus;1 to +3 dots, never four</b>: LYC and IF ship at <b>&minus;1</b>, WY and ' +
    'STAT at <b>0</b>; on the original with the screen on, the seven drawing registers add a whole ' +
    'machine cycle on top of their lead, Rule E.1/8). No write phase may be applied to <em>reads</em>: reads sample at the end of the machine cycle.</div>' +
    '<div class="gbemu-why"><b>Why.</b> Measured against <code>lcdon_write_timing-GS</code>, which ' +
    'requires a sprite-memory write on a dot where that write must be blocked; at one machine cycle ' +
    'earlier it is not blocked and the test fails. <b>Applying any write phase to <em>reads</em> as ' +
    'well collapses five Mooneye tests</b>: precisely the ones measuring when the processor ' +
    'can next see a mode change. Reads sample at the end of the machine cycle and that is pinned ' +
    'hard.</div>' +
    '<div class="gbemu-rule" id="gbr-E-1-5-2"><b>Rule E.1.5/2.</b> <b>Fact two: access blocking, and the number is 6 dots.</b> ' +
    '<b>A read blocks on the LIVE mode and releases on the REPORTED one; a write follows the ' +
    'REPORTED mode at both edges.</b> Concretely, in dots of the line, video-memory reads close ' +
    '<b>6 dots before mode 3 begins</b> (dot <b>78</b>) on the access scale, and video-memory writes close <b>when mode ' +
    '3 is reported</b> (dot <b>84</b>). <b>Both of those dots are counted from the line boundary, ' +
    'on the scale at the head of this appendix</b> (Rule E/1; dot 84 is the same edge Rule E.1/3&rsquo;s explanation ' +
    'calls <b>picture-dot 84</b>) and the <em>interval</em>, ' +
    '6 dots, is the claim. Both release at the same instant. Sprite memory carries the same 6 with ' +
    'one extra wrinkle the samples force: the scan releases the sprite-memory <em>write</em> port ' +
    'while it still has 6 dots to run, so there is a window (live mode 3, reported mode still ' +
    '2) in which a sprite-memory write lands between two that do not.</div>' +
    '<div class="gbemu-why"><b>Labelled honestly, because the behaviour and the magnitude are not ' +
    'worth the same.</b> OBSERVED against <code>lcdon_write_timing-GS</code>, 19 samples, its cycle-131 and cycle-245 ' +
    'cases. The <em>behaviour</em>: reads on the live edge, writes on the ' +
    'reported one, both releasing together (is <b>HARDWARE-OBSERVED</b> on that ' +
    'cartridge&rsquo;s 19 samples). <b>The magnitude 6 is NOT ESTABLISHED</b>: in our source it is a ' +
    'bare constant with an anti-sweep tripwire and no account at its site, and nothing derives it. ' +
    'What would establish it is a document stating the early close, or a sweep over the access rows ' +
    'with the blast radius printed. &ldquo;Roughly a machine cycle&rdquo; is wrong by half ' +
    'a machine cycle.</div>' +

    '<h4 class="gbemu-sub">E.2: The power-on line</h4>' +
    '<p class="hw-readable">Section 14 names this as load-bearing and then never states it. Here it ' +
    'is. <b>HARDWARE-OBSERVED</b>: on the Mooneye author&rsquo;s silicon, pinned by ' +
    '<code>lcdon_timing-GS</code> with the sample points aligned exactly, its cycle-<em>c</em> read ' +
    'landing on dot <code>8 + 4c</code> after the enable write, instrumented rather than ' +
    'calibrated.</p>' +
    '<div class="gbemu-rule" id="gbr-E-2-1"><b>Rule E.2/1.</b> <b>The scanline on which the screen is switched on is 451 dots long, not ' +
    '456. Mode 3 begins 76 dots into it, not 80.</b> In the table the ordinary line&rsquo;s dots are counted from the start of the mode-2 scan (the observable scale, four dots after this page&rsquo;s line boundary, Rule E/1), and the power-on line&rsquo;s from the enable write.</div>' +
    '<table class="gbemu-table"><thead><tr><th>Quantity (dots)</th><th>Ordinary line (from the start of the scan)</th><th>Power-on line (from the enable write)</th></tr></thead><tbody>' +
      '<tr><td>Length</td><td>456</td><td><b>451</b>: five dots shorter</td></tr>' +
      '<tr><td>Mode 3 begins at</td><td>80</td><td><b>76</b>: one machine cycle earlier</td></tr>' +
      '<tr><td>Reports mode 2 during the scan</td><td>yes</td><td><b>no</b>: it reads mode 0 through what would be the scan and raises no mode-2 status interrupt. The scan itself still happens, on slots 0 to 37 only (slot k on dot 9&nbsp;+&nbsp;2k), and with the mode-0 select set the status line rises at the enable write (section 14)</td></tr>' +
    '</tbody></table>' +
    '<div class="gbemu-rule" id="gbr-E-2-2"><b>Rule E.2/2.</b> <b>What &ldquo;lands on dot 8 + 4c&rdquo; means, in dots.</b> c counts the machine cycles after the one that carries the enable write, starting at 1:' +
    '<ol class="gbemu-steps">' +
      '<li>The enable write&rsquo;s own cycle processes no dot: nothing is processed at the instant of the write.</li>' +
      '<li>The dot counter starts at 8.</li>' +
      '<li>Cycle c covers dots <code>8 + 4(c &minus; 1)</code> to <code>8 + 4c &minus; 1</code>, with its read landing after the last of them.</li>' +
      '<li>So <code>8 + 4c</code> is the first dot a cycle-c read does <em>not</em> see.</li>' +
    '</ol>' +
    'On a Colour in double speed the same holds with two dots per cycle: cycle c covers <code>8 + 2(c &minus; 1)</code> and <code>8 + 2c &minus; 1</code>. Section 1 carries the phase this leaves for every later line.</div>' +
    '<div class="gbemu-example"><b>Example.</b> Cycle 1 covers dots 8 to 11, and its read sees dot 11 but not dot 12 (= 8 + 4 &times; 1). Cycle 19 covers dots 80 to 83. In double speed cycle 1 covers dots 8 and 9.</div>' +
    '<div class="gbemu-why"><b>Why.</b> Processing dot 8 at the instant of the enable write reads mode 3 one sample early and fails both switch-on cartridges. <b>INSTRUMENT-MEASURED</b> on the shipped core with a per-dot probe; the agreement with <code>lcdon_timing-GS</code> is the hardware half, as stated above.</div>' +
    '<div class="gbemu-rule" id="gbr-E-2-3"><b>Rule E.2/3.</b> <b>MECHANISM:</b> implement both numbers as <em>initial conditions on an ' +
    'ordinary line</em>, not as special cases in the mode machine. Our dot counter starts at 8 and ' +
    'the line wraps at 459, <b>against a fixed mode-3 threshold of dot 84</b>: ' +
    '<code>84 &minus; 8 = 76</code>, which is the 76 in the table above, and ' +
    '<code>459 &minus; 8 = 451</code>. <b>The threshold is 84 and not 80 because of the four-dot ' +
    'line-opening gap named at the head of this appendix (Rule E/1); without it this paragraph does not ' +
    'add up and an implementer lands one machine cycle out.</b></div>' +
    '<div class="gbemu-why"><b>Why.</b> The difference, 451, is the only thing the corpus can see. <b>A pure phase ' +
    'offset cannot explain both numbers</b>: starting S dots in would give a line of ' +
    '<code>456 &minus; S</code> with mode 3 at <code>80 &minus; S</code>, and 451 would force mode 3 ' +
    'to 75, which fails. The line loses one dot beyond the phase shift.</div>' +
    '<div class="gbemu-rule" id="gbr-E-2-4"><b>Rule E.2/4.</b> <b>Start dot and wrap dot are not two knobs, they are one quantity written ' +
    'twice.</b> A build may choose any (start, wrap, threshold) that satisfies both equations: ' +
    '<code>threshold &minus; start = 76</code> and ' +
    '<code>wrap &minus; start = 451</code>. A pair chosen without the first equation ' +
    'satisfies neither observable. At the shipped <code>(8, 459)</code> the threshold is <b>84</b>; at ' +
    '<code>(9, 460)</code> it is <b>85</b>. <b>The pair <code>(4, 455)</code> is NOT a legal ' +
    'choice at a fixed threshold of 84</b>: it gives the right 451 and the wrong 80.</div>' +
    '<div class="gbemu-why"><b>Why.</b> Swept against each other over eight points, every observable we own came out a pure ' +
    'function of <code>wrap &minus; start</code>: (8, 458) and (9, 459) are identical on the colour ' +
    'board, on both 64-pixel blocks of the tile-select window cartridge, on its total, and on the ' +
    'scroll-Y cartridge; so are (8, 459) and (9, 460). <b>Choose any pair whose difference is ' +
    '451, and move the mode-3 threshold with them.</b> INSTRUMENT-MEASURED, and ' +
    'independently audit-confirmed twice, which is rarer on ' +
    'this page than it should be and is worth more than an unaudited number. ' +
    '<b>The clause that sentence needs, and it is not optional:</b> ' +
    'the pair is free <em>only</em> because the sweep that measured it moved the ' +
    'threshold with the start. ' +
    '<b>Falsifier:</b> an instrumented build of the shipped core reporting mode-3 entry anywhere ' +
    'but 76 dots into the power-on line. Measured on this core: it reports 84 with the counter ' +
    'seeded at 8, which is 76.</div>' +
    '<p class="hw-readable"><b>The sweep, priced.</b> Each column is a value of <code>wrap &minus; start</code> in dots; each cell is the count of differing pixels on the colour pixel board, taken on an earlier state of that board (the paragraphs below give the denomination).</p>' +
    '<table class="gbemu-table"><thead><tr><th>Difference</th><th>449</th><th>450</th><th><b>451</b></th><th>452</th><th>453</th></tr></thead><tbody>' +
      '<tr><td><b>Colour pixel board</b>, differing pixels</td><td>20,002</td><td>3,170</td><td><b>10,027</b></td><td>15,602</td><td>20,002</td></tr>' +
    '</tbody></table>' +
    '<div class="gbemu-why"><b>The denominator, because a figure must travel with the base that ' +
    'produced it.</b> It is the ' +
    '<b>colour pixel board</b>: the same board the explanation above is reporting when it says ' +
    '(8,&nbsp;458) and (9,&nbsp;459) come out identical, and the same one the paragraph below is ' +
    'reporting when it prices 450 at 3,170 against 451 at 10,027 (the pair in that sentence ' +
    'is this table&rsquo;s own second and third cells). <b>It is a pixel board and not the 264-row ' +
    'board</b>, and reading it as rows would make a five-point sweep look like a catastrophe. ' +
    '<b>Falsifier for the denomination:</b> any of these five figures failing to reproduce on the colour pixel board at the stated difference, on the board state they were taken on (they are not today&rsquo;s board; see Rule E.2/5).</div>' +
    '<div class="gbemu-why"><b>449 and 453 are four apart and identical.</b> That is the direct ' +
    'demonstration that these suites measure the phase of the line boundary against the ' +
    'processor&rsquo;s machine-cycle grid and not the length, and it is why a leaky write ' +
    'cycle that makes one line 457 dots is not a small error but a phase that walks one dot per line ' +
    'for ever.</div>' +
    '<div class="gbemu-why"><b>Honest limits, both directions.</b> <b>The length is pinned exactly:</b> ' +
    '452 fails <code>lcdon_timing-GS</code>; 449 and 450 pass it and then fail ' +
    '<code>intr_2_mode0_timing_sprites</code>; only 451 passes both. <b>The mode-3 offset is NOT ' +
    'pinned:</b> the test samples on a 4-dot grid, so 76, 77, 78 and 79 are indistinguishable across ' +
    'both power-on tests. We chose 76 because it makes the offset exactly one machine cycle earlier ' +
    'than a normal line: recorded as under-determined, not as measured. <b>Colour hardware ' +
    'wants 450, and that is FITTED-TO-STORED-RENDER, never observed:</b> the published statement ' +
    'that the timings differ on colour hardware (<em>even in monochrome compatibility ' +
    'mode</em>) gives no number at all, and its own chapter carries its author&rsquo;s ' +
    '&ldquo;TODO: test everything&rdquo;. <b>The sum is documented; the magnitude is ours.</b> It ' +
    'costs 128 pixels on one window cartridge and that cost is not open: 450 gives the board 3,170 ' +
    'with those blocks wrong, 451 gives 10,027 with them right, and the contention is established ' +
    'rather than suspected.</div>' +
    '<div class="gbemu-rule" id="gbr-E-2-5"><b>Rule E.2/5.</b> <b>What ships, so an implementer does not have to infer it from the prices.</b> ' +
    'The power-on line&rsquo;s length (<code>wrap &minus; start</code>) on the original: <b>451</b>. A Color at single speed, compatibility mode included: <b>450</b>. A ' +
    'Color in double speed: <b>448</b>, FITTED (the Colour tab, Rule C10/46). ' +
    'The three are separate constants on purpose, so the double-speed value can move without ' +
    'touching the others.</div>' +
    '<div class="gbemu-why"><b>Why.</b> The double-speed value is FITTED, not scored on any board row, because every colour-board cartridge ' +
    'runs at single speed and nothing this project owns turns the screen on in double speed; the Colour tab, Rule C10/46, gives what it was fitted to. The colour board&rsquo;s current figure, 0&nbsp;px and 27 of 27 (the ' +
    'Colour tab, section 17), is taken at 450 on the shipped core. The 3,170 and 10,027 above were taken on an earlier state of the colour board and are kept as the prices they were; ' +
    'they are not the board today.</div>' +
    '<div class="gbemu-why"><b>Why this constant outranks your reset skew.</b> It is the <em>one</em> ' +
    'processor-to-dot phase knob that survives a real boot program: the boot program cycles the ' +
    'screen, which re-seeds the dot counter and erases whatever phase your reset established. Every ' +
    'real program does this. Once the screen is on and the LCDC dot budget balances, every line is ' +
    'exactly 456 dots, so the phase set here is fixed for the rest of the run.</div>' +

    '<h4 class="gbemu-sub">E.3: The object stall, positioned</h4>' +
    '<p class="hw-readable">This subsection places an object&rsquo;s wait inside the background fetcher&rsquo;s eight-dot cycle. Units used throughout E.3 and E.4: a <b>dot</b> is a line dot on the scale at the head of this appendix (mode-3 entry is dot 84); a <b>pos</b> is section 9&rsquo;s fetcher position, <code>pos = step &times; 2 + sub</code>, running 0 to 7 within one tile fetch, with the <b>push on pos 7</b>. An object&rsquo;s <b>wait</b> is the dots from its notice dot up to (not including) the first dot of its object fetch; its <b>stall</b> is the dots of its object fetch, first to last inclusive; its <b>cost</b> is wait plus stall, the dots the object adds to mode 3.</p>' +

    '<div class="gbemu-rule" id="gbr-E-3-1"><b>Rule E.3/1.</b> The phase window. An object served through the phase window (which objects these are: rule E.3.4/2) waits, and its object fetch starts on the first dot, from its notice dot on (the notice dot included), on which the fetcher is in the window or is parked (rule E.3/3). <b>The window is pos 4, 5 and 6: the three dots ending immediately before the push.</b> It does not include the push (pos 7). Stated without any internal names: the wait ends when the fetcher is <b>at or past the first dot of its high-byte fetch and has not yet reached the push</b>. In section 9&rsquo;s numbering the high-byte fetch occupies pos 4 and pos 5 and the push is pos 7, so that condition is <code>{4,5,6}</code> and nothing else.</div>' +

    '<div class="gbemu-rule" id="gbr-E-3-2"><b>Rule E.3/2.</b> The order inside one mode-3 dot, for the object test. Each dot runs these steps in this order:' +
    '<ol class="gbemu-steps">' +
      '<li>The object test runs <b>before</b> the dot&rsquo;s pixel is popped, and to its exclusion: a dot on which an object is noticed pops nothing, so the notice dot carries no output and is itself one of the dots the object costs. (E.5.1 is the home of this ordering, with its measurement and its falsifier.)</li>' +
      '<li>The object test also runs <b>before</b> the dot&rsquo;s fetcher step (E.5, item (d) before (f)). So the pos it reads is the pos of the step dot the fetcher is <b>about to run</b> on this dot, not the one it ran on the previous dot.</li>' +
      '<li>If no object is due (rule E.3.4/2), the dot runs as it would on a line with no objects (E.5).</li>' +
      '<li>If an object is due and the table of rule E.3.4/2 says its fetch starts on this dot (for an object served through the phase window: the pos read in step 2 is 4, 5 or 6, or the fetcher is parked), the object fetch starts on this dot. This dot is the fetch&rsquo;s first dot; the fetcher does <b>not</b> step; nothing is popped.</li>' +
      '<li>If an object is due and its fetch does not start on this dot, the object waits: the fetcher <b>does</b> step on this dot, nothing is popped, and <code>lx</code> does not advance.</li>' +
    '</ol></div>' +
    '<div class="gbemu-why"><b>Why.</b> MECHANISM, read from our source: the object test reads the fetcher state before <code>ppu_fetcher_step</code> runs on that dot. A build that steps the fetcher first and tests afterwards gets the same ladder only if it applies <code>{4,5,6}</code> to the pos the fetcher held before that step (and undoes the step when the fetch starts); the ladders in this section are the check.</div>' +

    '<div class="gbemu-example"><b>Example.</b> The ladder that rules E.3/1 and E.3/2 produce in the steady cycle, residue by residue. An object at OAM X arrives at <code>lx = X &minus; 8</code>, and residue r (the alignment key of rule E.4/3: <code>(OAM X + SCX) mod 8</code>) meets the window as though it arrived at <b><code>(r &minus; 1) mod 8</code></b>. The wait counts from the notice dot; the fetch is a flat six dots.' +
    '<table class="gbemu-table"><thead><tr><th>Residue r (0 to 7)</th><th>Pos the object meets on its notice dot, <code>(r &minus; 1) mod 8</code> (section 9 pos)</th><th>Wait (dots, notice dot to the first dot at pos 4, 5 or 6, that dot excluded)</th><th>Cost (dots: wait + 6)</th></tr></thead><tbody>' +
      '<tr><td>0</td><td>7 (the push)</td><td>5 (pos 7, 0, 1, 2, 3)</td><td>11</td></tr>' +
      '<tr><td>1</td><td>0</td><td>4</td><td>10</td></tr>' +
      '<tr><td>2</td><td>1</td><td>3</td><td>9</td></tr>' +
      '<tr><td>3</td><td>2</td><td>2</td><td>8</td></tr>' +
      '<tr><td>4</td><td>3</td><td>1</td><td>7</td></tr>' +
      '<tr><td>5</td><td>4</td><td>0</td><td>6</td></tr>' +
      '<tr><td>6</td><td>5</td><td>0</td><td>6</td></tr>' +
      '<tr><td>7</td><td>6</td><td>0</td><td>6</td></tr>' +
    '</tbody></table>' +
    'Two near-misses of the rule&rsquo;s sentence, and both are wrong. &ldquo;At or past the <em>second</em> dot&rdquo; is <code>pos &ge; 5</code>, and it names the reading this section exists to refute; leaving the push exclusion off admits pos 7. Both ways of closing the window are wrong, and the ladders say so:' +
    '<table class="gbemu-table"><thead><tr><th>Window (section 9 pos)</th><th>Ladder, residue 0 to 7 (cost in dots)</th><th>Verdict</th></tr></thead><tbody>' +
      '<tr><td><code>{4,5,6}</code>, as stated everywhere else here</td><td><code>11 10 9 8 7 6 6 6</code></td><td><b>correct</b></td></tr>' +
      '<tr><td><code>{5,6}</code>: &ldquo;at or past the second&rdquo;, push excluded</td><td><code>12 11 10 9 8 7 6 6</code></td><td>wrong at <b>6 of 8</b> alignments</td></tr>' +
      '<tr><td><code>{5,6,7}</code>: &ldquo;at or past the second&rdquo;, push not excluded</td><td><code>6 11 10 9 8 7 6 6</code></td><td>the suffix this section refutes at <b>3.8&sigma;</b></td></tr>' +
    '</tbody></table>' +
    'The trap the test-before-pop order of rule E.3/2 sets: testing before the pop does <em>not</em> also move the notice dot one earlier against the fetcher, so it does <em>not</em> license shifting the window to <code>{5,6,7}</code> to recover the ladder. Make that shift and you get the right ladder from the wrong comb: line lengths stay exactly right while every mid-line register write inside an object stall lands on the wrong pixel. <b>Test-before-pop and <code>{4,5,6}</code> hold together; they are not alternatives, and a ladder check cannot tell you which pair you have.</b> Test-before-pop is also why residue 0&rsquo;s cost is 11 rather than 10: five dots of output are lost, the notice dot included.</div>' +

    '<div class="gbemu-why"><b>Why.</b> Section 12 says the wait is the distance to a recurring <b>three-dot ' +
    'window</b> inside the fetcher&rsquo;s <b>eight-dot cycle</b>, and stops. <b>Two different three-dot windows fit a width of 3, the width alone does not say which, and picking ' +
    'the wrong one gets residue 0 wrong for ever.</b> Rule E.3/1 says which three.</div>' +
    '<div class="gbemu-why"><b>Why: the width.</b> <b>The width is CONVERGENCE + INSTRUMENT-MEASURED.</b> Both reference ' +
    'implementations read 3, and our own dwell instrument measures 3 open dots of 8 on this ' +
    'fetcher. <b>No hardware document states three</b>: section 12 reads as though the ' +
    'three-of-eight window fell out of the fetcher&rsquo;s structure, and it did not.</div>' +
    '<div class="gbemu-why"><b>Why: the position.</b> <b>The position is forced by silicon, and it is the part of this ' +
    'appendix most worth getting right.</b> Our own source derives 4/5/6 from the mealybug ' +
    'author&rsquo;s wait ladder <code>5,4,3,2,1,0,0,0</code>, and that author&rsquo;s ' +
    'expectations are that author&rsquo;s own emulator renders, against which we then score our ' +
    'ladder and report a constant offset of 0. <b>That is fitting to a law and then scoring against ' +
    'the law it was fitted to.</b> A non-circular route exists three documents away and our source ' +
    'never uses it. ' +
    'In an 8-dot cycle with a 3-dot window and a flat 6-dot fetch, <b>11 is ' +
    'the maximum possible cost</b>: 6 plus a maximum wait of <code>8 &minus; 3 = 5</code>. ' +
    '<b>Silicon says residue 0 costs 11</b> (section 12, and the seam cell at OAM X = 8 reads ' +
    '<b>11.13 &plusmn; 0.30</b>, excluding 10 at 3.8&sigma; and 12 at 2.9&sigma;). Therefore residue ' +
    '0 arrives on the one dot at which the wait is maximal: <b>the dot immediately after the ' +
    'window closes</b>. Our own trace puts residue 1 at pos 0, so residue 0 arrives at pos 7 and the ' +
    'window ends at pos 6: <code>{4,5,6}</code>. <b>The suffix window <code>{5,6,7}</code> is ' +
    'excluded directly</b>: it would give residue 0 a wait of 0 and a cost of 6, which the ' +
    'seam cell refutes at 3.8&sigma; and a three-device floor refutes again. <b>The seam cell is the ' +
    'decisive one</b>, because OAM X = 8 is the smallest X served through the phase window at all ' +
    '(E.3.1 explains why smaller ones are not). ' +
    '<b>Label: the position is MECHANISM, conditional.</b> It follows from the ' +
    'HARDWARE-OBSERVED 11 at residue 0 <em>given</em> the 3-of-8 width and the flat 6, both of which ' +
    'are CONVERGENCE. It does <b>not</b> follow from the oracle&rsquo;s wait table alone, and the ' +
    'derivation written in our own source is the circular one. An implementer should implement the ' +
    'silicon argument, not the ladder argument.</div>' +
    '<div class="gbemu-why"><b>Why: the residue mapping.</b> <code>(r &minus; 1) mod 8</code> is a description of behaviour. Our own source comment writes ' +
    '<code>(r + 6) mod 8</code>, which reproduces neither its own stated anchor nor its own ladder: ' +
    'the slip is in the prose and not in the behaviour, because the shipped predicate tests ' +
    '<code>4 &le; pos &le; 6</code> directly and computes no residue mapping at all. Do not go ' +
    'looking for a line of code that performs it. ' +
    '<b>MECHANISM, and it kills an entire family of wrong answers:</b> a ' +
    '<em>suffix</em> window (<code>pos &ge; 8 &minus; W</code>) can never place residue 0, because ' +
    'every suffix contains pos 7. <b>If you have the width right and the ladder is still wrong at ' +
    'one alignment, the position is what is wrong, not the width.</b></div>' +
    '<div class="gbemu-why"><b>Why: the convention.</b> <b>Rule E.3/2&rsquo;s step 1 is the convention this whole section is stated on, and without it the ' +
    'window above is unbuildable.</b> Both the residue mapping and ' +
    '<code>{4,5,6}</code> are read on that <b>one</b> intra-dot ordering. <b>Read E.5.1 before implementing this window.</b> ' +
    'The portable sentence of rule E.3/1 is the same window derived from silicon above and tabulated ' +
    'in section 12 and in the F7 row of the constants register.</div>' +
    '<div class="gbemu-why"><b>Why one word costs so much here.</b> The ladder is ' +
    'the object stall&rsquo;s whole contribution to line length, so either wrong window moves ' +
    '<em>every</em> mode-3 length on every line carrying an object, which reaches the ' +
    'mealybug cells and the mode-0 timing rows together, the pair this page repeatedly warns move ' +
    'as one. <b>The transferable part:</b> a paragraph offered as the portable restatement of a ' +
    'derived rule is a dependent of that rule exactly as a number is a dependent of a number, and ' +
    'it needs guarding the way a number does. The gate re-derives the ladder from every ' +
    'statement of the window on this page and fails if any two of them disagree.</div>' +
    '<div class="gbemu-why"><b>Why: two constructions.</b> Two reference implementations reach that same window by opposite constructions: ' +
    'one compares against the fetcher&rsquo;s own stage, the other treats it as a permission ' +
    'granted by the last fetch step and cleared by the push. <b>CONVERGENCE</b>, and two structures ' +
    'sharing only this is what makes it the hardware fact rather than either core&rsquo;s habit.</div>' +

    '<div class="gbemu-rule" id="gbr-E-3-3"><b>Rule E.3/3.</b> The parked fetcher: the one state the window does not cover. <b>&ldquo;Parked&rdquo; always means both conditions at once:</b> the fetcher is at its push step holding a full row (past its last data step), <b>and</b> the background queue is not empty, so it cannot push and holds there until the queue drains. A parked fetcher counts as pos 7, outside the window. <b>A parked fetcher ends an object&rsquo;s wait as though it were inside the window.</b> A fetcher at its push step whose queue is empty is <b>not</b> parked: it pushes on that dot, and an object waiting then waits for the window like any other. E.3.2 and E.3.4 say the same thing as &ldquo;parked at its push stage with a non-empty queue&rdquo;. The cases, for an object served through the phase window that is waiting on this dot:' +
    '<table class="gbemu-table"><thead><tr><th>Fetcher state at the object test (before its step; section 9 pos)</th><th>Background queue</th><th>Parked?</th><th>The waiting object, on this dot</th></tr></thead><tbody>' +
      '<tr><td>pos 4, 5 or 6</td><td>empty or not</td><td>no</td><td>its fetch starts (the window, rule E.3/1)</td></tr>' +
      '<tr><td>at the push step with a full row</td><td>not empty</td><td><b>yes</b></td><td>its fetch starts (rule E.3/4)</td></tr>' +
      '<tr><td>at the push step with a full row</td><td>empty</td><td>no</td><td>waits; the fetcher pushes on this dot</td></tr>' +
      '<tr><td>pos 0 to 3</td><td>empty or not</td><td>no</td><td>waits; the fetcher steps</td></tr>' +
    '</tbody></table></div>' +
    '<div class="gbemu-rule" id="gbr-E-3-4"><b>Rule E.3/4.</b> An object that becomes due while the ' +
    'fetcher is parked, or that is waiting when the fetcher parks, is served at once: its six-dot fetch starts ' +
    'on that dot with no further wait. The parked row is pushed after the object fetch, when the queue ' +
    'has drained.</div>' +
    '<div class="gbemu-example"><b>Example.</b> Three objects spread eight apart at OAM X 16, 24 and 32, SCX 0. Each is its own run (rule E.4/1) at residue 0, so each costs 11: 33 dots in all. Read &ldquo;parked&rdquo; without the queue condition (a fetcher at its push step counted as parked whether or not its queue holds pixels) and every object of the spread row after the first would be served at once and cost 6, not 11: 11 + 6 + 6 = 23 dots. Section 12&rsquo;s 11 per spread object rules that reading out.</div>' +
    '<div class="gbemu-why"><b>Why.</b> Parked counts as pos 7, outside the window, ' +
    'and the queue cannot drain while an object waits, because the wait stops output; without rule E.3/4 the wait would never end. ' +
    'This is the deadlock section 12 names, closed. Without it, the phase window alone freezes Zelda and Super Mario Land (seven titles in all) on certain lines ' +
    'carrying two objects. Rule E.3/4 leaves every cost on the ladder above unchanged (it only acts where the window ' +
    'alone would wait for ever), and no mealybug cell reaches it. MECHANISM (reachability: serving is ' +
    'the only exit from that state), read from our source (<code>OBJ_PARK_OPEN</code> = 1; parked = the push step reached with the background queue non-empty).</div>' +

    '<p class="gbemu-key"><b>E.3.1: The ladder has TWO mechanisms.</b></p>' +
    '<div class="gbemu-rule" id="gbr-E-3-1-1"><b>Rule E.3.1/1.</b> The familiar row <code>11 10 9 8 7 6 6 6</code> is produced by the phase window ' +
    'only for <b>OAM X &ge; 8</b>. <b>For a clipped object (OAM X 0 to 7) this core ' +
    'bypasses the phase window entirely</b> and uses a two-constraint model: ' +
    '<code>begin = 89 + X</code>, <code>end = max(100, begin + 6)</code>, ' +
    '<code>cost = end &minus; begin</code>, where X is the OAM X. ' +
    '<b><code>begin</code> and <code>end</code> are absolute dots of the line, on the ' +
    'scale at the head of this appendix</b> (mode-3 entry is dot 84). At SCX&nbsp;&amp;&nbsp;7 = 0, <code>begin</code> is the last dot <em>before</em> the stall (the notice dot is <code>begin + 1</code>), not the first stall dot. ' +
    'They are <b>not</b> dots into mode 3, and <b>SCX does not move them</b>. ' +
    'The dot on which a clipped object is noticed does ride the fine scroll, for OAM X 1 to 7 (not for OAM X 0): it is <code>begin + 1</code> for OAM X 0 at any SCX, and <code>begin + 1 + (SCX &amp; 7)</code> for OAM X 1 to 7. Rules E.3.1/2 and E.3.1/3 give the dots.</div>' +
    '<div class="gbemu-example"><b>Example.</b> At OAM X = 0: <code>begin</code> is <b>dot 89</b>, five dots into mode 3, <b>the same dot the ' +
    'fine-scroll discard is latched on</b>; the object is noticed on dot 90; the floor at <code>end = 100</code> is line dot 100, ' +
    'three dots after the line&rsquo;s first visible pixel leaves at 97; cost = 100 &minus; 89 = 11. Read as dots into mode 3, the same formula gives <code>begin</code> = 169 + X, which is wrong. ' +
    'The anchor at the neighbouring site is stated in the same units: <code>notice = 89 + X</code>, which puts ' +
    'OAM X = 8 at dot 97.</div>' +
    '<div class="gbemu-why"><b>Why.</b> <b>That is a clamp and two constants (100 and 6), and ' +
    'our own source says where they came from: measured in the oracle across the whole clipped ' +
    'regime.</b> <b>CONVERGENCE.</b> The arm that rides the fine scroll at the <code>end</code> constraint is a knob and it is off in the shipped core. ' +
    '<b>Why the units matter even though the cost is ' +
    'right either way:</b> <code>cost = end &minus; begin</code> is invariant under the offset and ' +
    'reproduces <code>11 10 9 8 7 6 6 6</code> under both readings (absolute dots, or dots into mode 3, 80 dots apart), so no ladder check can catch ' +
    'it; only a mid-line register write landing during the clipped object&rsquo;s stall ' +
    'separates them. <b>Falsifier:</b> the shipped core noticing a clipped object at OAM X = 0 on any dot but 90 (89 is the last dot before its stall; rule E.3.1/3 gives the measurement).</div>' +

    '<div class="gbemu-rule" id="gbr-E-3-1-2"><b>Rule E.3.1/2.</b> When a clipped object is due: the pre-visible position. A clipped object (OAM X 0 to 7) is due by an pre-visible position, built like this:' +
    '<ol class="gbemu-steps">' +
      '<li>Before mode 3 the pre-visible position stands at &minus;15.</li>' +
      '<li>On every dot of mode 3 on which no object fetch is in progress (a notice dot is such a dot), the position rises by one, until it reaches SCX&nbsp;&amp;&nbsp;7; there it stops.</li>' +
      '<li>Each clipped object&rsquo;s threshold is OAM X&nbsp;&minus;&nbsp;8, plus SCX&nbsp;&amp;&nbsp;7 when OAM X is 1 to 7 (not when OAM X is 0).</li>' +
      '<li>At the object test of a dot, a clipped object is due when the position, as step 2 left it on that dot, is at or above its threshold. The test is &ldquo;reached&rdquo;, not &ldquo;equals&rdquo;.</li>' +
      '<li>Once due, the object stays due on every later dot of the line until it is fetched, whether or not a pixel has left the queue.</li>' +
    '</ol>' +
    'SCX&nbsp;&amp;&nbsp;7 in steps 2 and 3 is the live register, read again on every dot, for the stop and for the threshold alike. It is not the value the discard latched on dot 89, though the two agree on any line whose SCX does not change during mode 3. The position is consulted only for objects at OAM X 0 to 7.</div>' +
    '<div class="gbemu-example"><b>Example.</b> OAM X = 0, SCX&nbsp;&amp;&nbsp;7 = 0: the position is &minus;14 after dot 84 and reaches &minus;8 on dot 90, so the object is noticed on dot 90 (not 89, which is <code>begin</code>). OAM X&nbsp;=&nbsp;1 at SCX&nbsp;=&nbsp;3: threshold &minus;7 + 3 = &minus;4, reached on dot 94. OAM X = 0 at SCX = 3: threshold &minus;8 (no SCX term for OAM X 0), still dot 90. Because the position stands still through a stall, a second clipped object at a larger X is noticed later by the stall dots the first one held: OAM X 0 then 3 are noticed on 90 and 103 (the position stands at &minus;8 through the first stall, 90 to 100, and reaches &minus;5 on 103), not on 90 and 93.</div>' +
    '<div class="gbemu-why"><b>Why.</b> MECHANISM, read from our source: the pre-visible position is <code>px_pos</code> (its starting value &minus;15 settled from the source), and the due test is in <code>ppu_object_at</code>.</div>' +

    '<div class="gbemu-rule" id="gbr-E-3-1-3"><b>Rule E.3.1/3.</b> The clipped stall dot by dot (OAM X 0 to 7, except the hidden objects of rule E.3.1/5, whose fetch starts after a wait). The fetch of a clipped object starts on its notice dot. ' +
    '<b>Floor: no object fetch, of any OAM X, may end before line dot 100.</b>' +
    '<table class="gbemu-table"><thead><tr><th>Dot (line dot, appendix E scale: mode-3 entry is dot 84)</th><th>Which dot it is, and what happens on it, as the shipped core runs it</th></tr>' +
    '</thead><tbody>' +
    '<tr><td>the notice dot</td><td><b>90 + X</b> for OAM X&nbsp;=&nbsp;0 to 7 at SCX&nbsp;&amp;&nbsp;7&nbsp;=&nbsp;0. For OAM X 1 to 7 it moves later by SCX&nbsp;&amp;&nbsp;7 (OAM X&nbsp;=&nbsp;1 at SCX&nbsp;=&nbsp;3 is noticed on dot 94); OAM X&nbsp;=&nbsp;0 does not move. Built as the pre-visible position of rule E.3.1/2. This dot is the stall&rsquo;s first dot</td></tr>' +
    '<tr><td>the last stall dot</td><td><b>max(100, notice dot + 5)</b>: the fetch is six dots, notice dot included, and may not end before line dot 100. OAM X 0 to 5 at SCX&nbsp;=&nbsp;0 all end on dot 100 (stalls of 11 down to 6 dots); OAM X 6 and 7 end on 101 and 102</td></tr>' +
    '<tr><td>every stall dot, notice dot to last stall dot inclusive</td><td>The background fetcher <b>does not step</b>; no pixel is popped or output; the pre-visible position and <code>lx</code> are frozen; the window&rsquo;s priming counter does not advance on any stall dot after the notice dot (E.8.4 has the notice dot itself); E.3.3&rsquo;s input recording runs on the dots after the notice dot</td></tr>' +
    '<tr><td>the dot after the last stall dot</td><td>The fetcher resumes at exactly the step and sub-dot it froze in</td></tr>' +
    '</tbody></table></div>' +
    '<div class="gbemu-example"><b>Example: a worked line, OAM X&nbsp;=&nbsp;0, SCX&nbsp;=&nbsp;0, no window.</b> The priming fetch runs on dots 84 to 89 (the fine scroll latched on 89, the fetcher back at its first step); the object is noticed on 90 and the stall holds 90 to 100 (11 dots); the first real fetch then runs 101 to 108 (map read on 102, low plane on 104, high plane on 106, push on 108), the first pixel leaves on 108 instead of 97, and mode 0 is reported 11 dots later than on the same line without the object. The same object at OAM X&nbsp;=&nbsp;4 is noticed on 94 after the first real fetch has done its map and low-plane reads (on 91 and 93), holds 94 to 100 (7 dots), and the fetch resumes on 101 with its high-plane step: 101 is that step&rsquo;s first, idle dot and the high-plane read executes on 102, by section 9&rsquo;s two-dot step (MECHANISM). INSTRUMENT-MEASURED on the shipped core, identical on both machines.</div>' +
    '<div class="gbemu-why"><b>Why.</b> Measured on the shipped core with a synthetic cartridge (no boot residue, one object, every OAM X from 0 to 7, SCX&nbsp;&amp;&nbsp;7 at 0, 3 and 7, both machines), the object at OAM X&nbsp;=&nbsp;0 is noticed on dot 90. The cost formula of rule E.3.1/1 holds because its <code>begin</code> is the last dot before the stall. MECHANISM, read from our source, for the pre-visible position (<code>px_pos</code>) and for an object staying due once its threshold is reached (<code>ppu_object_at</code>). The floor applies to every object fetch&rsquo;s end in our core: read from our source (the end test is shared by every object fetch).</div>' +

    '<div class="gbemu-rule" id="gbr-E-3-1-4"><b>Rule E.3.1/4.</b> Both freeze, and where the pixels land. During a clipped object&rsquo;s stall the background fetcher <em>and</em> the output are frozen together (rule E.3.1/3, third row: no fetcher step, no pop, no output, and no fine-scroll discard either, since a discard is a pop). The fetched object row goes into the object queue by screen column: its pixels at columns below 0 (OAM X &minus; 8 + i &lt; 0, i the pixel&rsquo;s index 0 to 7 in the row) are dropped and the rest are merged from screen column 0 on (appendix C.6, the left clip). Fine-scroll discards never shift the object queue (section 10), so the scroll does not clip the object a second time. Where the object test sits against the line&rsquo;s fine-scroll discards (discards pop from dot 97):' +
    '<table class="gbemu-table"><thead><tr><th>OAM X</th><th>When the object is noticed, against the discards (line dots, appendix E scale)</th></tr></thead><tbody>' +
      '<tr><td><b>0</b></td><td>on dot 90, before the first discard can happen</td></tr>' +
      '<tr><td><b>1 to 7</b></td><td>when the pre-visible position (which counts mode-3 dots, not pops) reaches the threshold of rule E.3.1/2; at a non-zero <code>SCX &amp; 7</code> this can fall among the discards, and the discards then wait out the stall</td></tr>' +
      '<tr><td><b>8</b></td><td>only once every discard of the line is spent (rule E.3.1/6)</td></tr>' +
      '<tr><td><b>9 and up</b></td><td>when the count of real pops equals OAM X &minus; 8, which the discards never advance, so always after them</td></tr>' +
    '</tbody></table></div>' +
    '<div class="gbemu-why"><b>Why.</b> MECHANISM, read from our source (the clipped-object notice, the pre-visible position and the discard branch).</div>' +

    '<div class="gbemu-rule" id="gbr-E-3-1-5"><b>Rule E.3.1/5.</b> A hidden object that pays the visible object&rsquo;s wait (both machines). When OAM X is 1 to 7 and X + (SCX&nbsp;&amp;&nbsp;7) is 8 or more, the object, once noticed, first waits <code>max(0, 5 &minus; ((X + SCX) mod 8))</code> dots before its six-dot fetch, with the background fetcher still stepping and nothing popped. That is exactly the alignment wait the same object eight pixels to the right pays (rule E.4/2). Rules E.3.1/2 and E.3.1/3 hold as they stand for OAM X 0, and for OAM X 1 to 7 whenever X + (SCX&nbsp;&amp;&nbsp;7) is below 8 (so at SCX&nbsp;&amp;&nbsp;7&nbsp;=&nbsp;0 every row stands). The wait is counted by <b>one counter for the line</b>, not one per object, in these steps:' +
    '<ol class="gbemu-steps">' +
      '<li>At mode-3 entry the line&rsquo;s wait counter is set to 0.</li>' +
      '<li>On each dot whose object test finds such a hidden object due: if the counter is at or above the wait (computed from the live SCX on that dot), the object&rsquo;s six-dot fetch starts on this dot. Otherwise the counter rises by one, the background fetcher steps, and nothing is popped.</li>' +
      '<li>On each dot whose object test ends any other way (any object fetch starts, this hidden object&rsquo;s included, or a due object waits for the phase window), the counter is set to 0 at the end of the test.</li>' +
      '<li>On a dot that runs no object test (a window takeover dot), and on a dot on which no object is due, the counter keeps its value.</li>' +
    '</ol>' +
    'So the wait counts dots that run the object test, starting from the notice dot. The floor of rule E.3.1/3 applies to this fetch&rsquo;s end too.</div>' +
    '<div class="gbemu-example"><b>Example.</b> OAM X = 3, SCX = 5: X + (SCX &amp; 7) = 8, so the object waits. It is noticed on dot 90 + 3 + 5 = 98 (rule E.3.1/3). Its wait is max(0, 5 &minus; (8 mod 8)) = 5: the counter reads 0, 1, 2, 3, 4 on dots 98 to 102, with the fetcher stepping, and the fetch starts on 103 when the counter reads 5, ending on 108. Cost 11, the same as OAM X = 11 at SCX = 5 (residue 0). The same object at SCX = 4 (X + 4 = 7, below 8) does not wait: noticed on 97, stall 97 to 102 (max(100, 97 + 5)), cost 6. If one of the dots 98 to 102 ran no object test, the counter would not rise on it and the fetch would start one dot later (read from our source; no measured case). <b>Does the clipped floor still apply after that wait?</b> It cannot bind here: an object of this kind is noticed on dot 90 + X + (SCX &amp; 7), which is 98 or later because X + (SCX &amp; 7) is at least 8, so its wait and its six dots end after 100 anyway. A build without the floor on this path gets the same dots.</div>' +
    '<div class="gbemu-why"><b>Why.</b> Served at once instead (a flat six dots), this object costs up to 5 dots fewer than the hardware. Evidence: the AGE test <code>stat-mode-sprites</code> (verified on DMG-CPU C and CPU CGB B, C and E) reads the row for X 1 to 7 the same as the row for X 9 to 15 at every SCX; traced on our core, they are equal, and the test passes on the original, the Colour and the Colour in double speed. Without the wait it reads 22 wrong (the original and the Colour) and 41 wrong (the Colour in double speed). Applying the wait to every hidden X instead leaves 6 wrong. On our own 252-probe mode-3 table, 7 probes (one object at OAM X 1, 2 or 4 with X + SCX of 8 or more) are 2 to 6 dots longer with the wait than without it. Label: the X = X + 8 equivalence is MECHANISM (the hardware table&rsquo;s); the gate at X + (SCX&nbsp;&amp;&nbsp;7) &ge; 8 is FITTED (it is where our opening fetch did not already charge the wait). Constant: <code>OBJ_CLIP_WAIT</code> = 2. The one counter (<code>obj_gap</code>), its reset at mode-3 entry and at the end of every other object-test outcome, and the 22 / 41 split by machine are read from our source.</div>' +

    '<div class="gbemu-rule" id="gbr-E-3-1-6"><b>Rule E.3.1/6.</b> The object next door, OAM X = 8. ' +
    '<b>&ldquo;Screen position 0&rdquo; is OAM X = 8</b>, which is <em>not</em> clipped and ' +
    '<em>is</em> served through the phase window; the clipped regime is OAM X 0 to 7, at screen ' +
    'positions &minus;8 to &minus;1. <b>The output-position arm has to be on</b> (it is on in the shipped core). The OAM X = 8 object is <b>due</b> on' +
    ' a dot when, at the object test (which runs before the fetcher steps, rule E.3/2), all four of these hold:' +
    '<ol class="gbemu-steps">' +
      '<li>fewer than eight pixels of the line have been popped (real pops; fine-scroll discards are not counted);</li>' +
      '<li>the priming fetch has completed;</li>' +
      '<li>every fine-scroll discard of the line has been spent;</li>' +
      '<li>the background queue already holds a pixel, <b>or this dot is ' +
      'the fetcher&rsquo;s pos 7</b>, the last dot of its fourth step, on which the ordinary push ' +
      'happens. A window restart fetch&rsquo;s early push on pos 5 does <em>not</em> count.</li>' +
    '</ol>' +
    'Then the phase window (rule E.3/1) decides when its fetch starts. The pixel a window restart fetch pushes early is the case E.5&rsquo;s position hold exists for (rule E.3.4/3): that pixel is not popped while the ' +
    'object at its pre-visible position is owed, and each dot so withheld is taken off the object&rsquo;s ' +
    'fetch, so mode 3 does not move.</div>' +
    '<div class="gbemu-example"><b>Example: the plain line.</b> Measured on the shipped core, ' +
    'an object at OAM X = 8 is noticed on <b>dot 97</b>, which is <code>89 + X</code>, ' +
    'and which is a push dot, so the object lands on the comb at offset 0 and costs <b>11</b>, ' +
    'the seam cell&rsquo;s value. With the output-position arm off, ' +
    'the comparator cannot separate &ldquo;before output has started&rdquo; from &ldquo;at ' +
    'position 0&rdquo;, the object is noticed at mode-3 entry with the queue empty, so its wait ' +
    'is free and it costs <b>6</b>; the same object then costs <b>&minus;1</b> at SCX 7: a negative cost, ' +
    'which is the signature of an object noticed before output has begun rather than at a ' +
    'position. <b>A core built with the arm off gets 6 at the seam and cannot ' +
    'repair it from the ladder</b>, because the ladder is a difference and the error is in the ' +
    'notice dot. <b>Falsifier:</b> the ' +
    'shipped core noticing an OAM X = 8 object on any dot but 97 on the plain line at SCX &amp; 7 = 0; that falsifier covers that line and ' +
    'nothing wider.</div>' +
    '<p class="hw-readable">Every case of rule E.3.1/6, measured on the shipped core with a synthetic cartridge (one line,' +
    ' no boot residue, the objects named and no others); the WX = 7 row is the same, dot for dot, on ' +
    'line 64 of <code>m3_lcdc_win_map_change</code>. All dots are line dots on the appendix E scale (mode-3 entry is dot 84).</p> <table ' +
    'class="gbemu-table"><thead><tr><th>Line</th><th>The OAM X = 8 object is due on (line dot)</th><th>Its ' +
    'fetch (line dots, first to last)</th><th>First pixel leaves the queue (line dot)</th></tr></thead><tbody> <tr><td>plain, SCX &amp; 7 = ' +
    '0</td><td>97: pos 7 of the first real fetch, queue empty</td><td>102 to 107</td><td>108</td></tr> ' +
    '<tr><td>plain, SCX &amp; 7 = 3</td><td>100: the first dot after the three discards, queue holding ' +
    'pixels</td><td>102 to 107</td><td>108</td></tr> <tr><td>plain, a clipped object at OAM X = 0 first' +
    ' (its stall 90 to 100)</td><td>108: pos 7 of the first real fetch, which resumed on ' +
    '101</td><td>113 to 118</td><td>119</td></tr> <tr><td>plain, clipped at OAM X = 2 first (stall 92 ' +
    'to 100)</td><td>106: pos 7</td><td>111 to 116</td><td>117</td></tr> <tr><td>plain, clipped at OAM ' +
    'X = 5 first (stall 95 to 100)</td><td>103: pos 7</td><td>108 to 113</td><td>114</td></tr> ' +
    '<tr><td>window, WX = 7, unprimed (takeover on 96)</td><td>103: the restart fetch pushes early on ' +
    '102 (pos 5), which does not count; the position hold keeps that pixel on 102</td><td>107 to 111: ' +
    'five dots, the held dot taken off</td><td>112</td></tr> <tr><td>window, WX = 7, a clipped object ' +
    'at OAM X = 0 first (takeover on 107)</td><td>114 (hold on 113)</td><td>118 to ' +
    '122</td><td>123</td></tr> <tr><td>window, WX = 7, clipped at OAM X = 2 first (takeover on ' +
    '105)</td><td>112 (hold on 111)</td><td>116 to 120</td><td>121</td></tr> <tr><td>window, WX = 6, ' +
    'unprimed (takeover on 95)</td><td>102: the early push on 101 goes to the one dropped column ' +
    '(E.8.1) and a pixel is left in the queue</td><td>106 to 111</td><td>112</td></tr> <tr><td>window, ' +
    'WX = 0, unprimed (takeover on 84)</td><td>96: pos 7 of the window&rsquo;s first tile ' +
    'fetch</td><td>101 to 106</td><td>114, after the seven dropped columns</td></tr> </tbody></table> ' +
    '<div class="gbemu-rule" id="gbr-E-3-1-7"><b>Rule E.3.1/7.</b> Which machine the table above is. Every row was measured on the original. The rows without a clipped object hold on the Colour too. The two <b>window</b> rows with a clipped object first (WX = 7 with OAM X = 0 first, and with OAM X = 2 first) do not: on the Colour the window takes over one dot earlier on those lines (106 for OAM X = 0 and 104 for OAM X = 2, E.8.4&rsquo;s measured list), so a Colour build must start from those takeover dots; the rest of each row then follows by the same rules, but that Colour arithmetic was not measured cell by cell. The three plain-line rows with a clipped object first are measured on the original only.</div>' +
    '<div class="gbemu-why"><b>Why.</b> What the clauses of rule E.3.1/6 are worth, switched off on the shipped core: the pos-7 clause ' +
    'off (the queue alone), the original&rsquo;s board 24 of 24 to 19 of 24, 79&nbsp;px ' +
    '(<code>m3_bgp_change_sprites</code> 36, <code>m3_lcdc_bg_en_change</code> 21, ' +
    '<code>m3_lcdc_obj_en_change_variant</code> 12, <code>m3_obp0_change</code> 6, ' +
    '<code>m3_lcdc_obj_en_change</code> 4), the Mooneye cartridges unmoved; pos 6 counted as well as ' +
    'pos 7, 14 of 24 and 982&nbsp;px, and <code>intr_2_mode0_timing_sprites</code> fails; the position ' +
    'hold off, 22 of 24 (<code>m3_lcdc_tile_sel_win_change</code> 40&nbsp;px, ' +
    '<code>m3_lcdc_win_map_change</code> 40&nbsp;px). The hold fires on 8 dots of the displayed frame ' +
    'in each of those two cells and on none in the other 22. In our source the predicate is ' +
    '<code>OBJ_X0_OUTPUT</code> = 3 and the hold <code>OBJ_POS_HOLD</code> = 1. Labels: the predicate ' +
    'is FITTED (three readings of &ldquo;output has started&rdquo; were built and the board chose); the' +
    ' hold is FITTED (shipped for the cells it closes); every dot above is ' +
    'INSTRUMENT-MEASURED. That the pop count of condition 1 counts real pops only (the count the discards never advance) is read from our source.</div>' +

    '<div class="gbemu-why"><b>Why: three consequences of E.3.1, all load-bearing.</b> <b>Section 12&rsquo;s ' +
    '&ldquo;no clamp and no constant&rdquo; is true of the phase window and false of this core as ' +
    'shipped.</b> <b>An implementation of the phase window alone will not reproduce our clipped column.</b> And <b>the three-device silicon floor ' +
    'at OAM X = 0 is measured in the clipped regime and therefore does not test the phase window at ' +
    'all</b>: only the X = 8 seam cell and the march slope do, which is why the position ' +
    'argument of E.3 is stated on those two deliberately.</div>' +

    '<p class="gbemu-key"><b>E.3.2: The structural trap, restated with its fix.</b></p>' +
    '<div class="gbemu-rule" id="gbr-E-3-2-1"><b>Rule E.3.2/1.</b> <b>The wait must end on a condition that is the inverse of the push&rsquo;s own ' +
    'precondition.</b> The push requires an empty background queue; the wait&rsquo;s exit for the parked state requires a ' +
    '<em>non-empty</em> one: ours ends when the fetcher is parked at its push stage with a ' +
    'non-empty queue (rules E.3/3 and E.3/4).</div>' +
    '<div class="gbemu-why"><b>Why.</b> The pixel ' +
    'queue empties only when a pixel is output, and a waiting object stops output. So <b>a wait ' +
    'defined as &ldquo;until the fetcher pushes&rdquo; can only be ended by its own ending.</b> ' +
    'The fetcher does advance during the wait, ' +
    'but it advances to the push step and <b>parks</b> there, because the push requires an empty ' +
    'queue and the queue cannot drain while the wait holds output still. ' +
    'All five candidates we built for that exit are bit-identical on the ' +
    'board: <b>the board is evidence that the fence holds, not evidence for this ' +
    'candidate.</b></div>' +

    '<p class="gbemu-key"><b>E.3.3: What happens to the frozen background step.</b></p>' +
    '<div class="gbemu-rule" id="gbr-E-3-3-1"><b>Rule E.3.3/1.</b> Two ' +
    'distinct phases, and conflating them is a common error:' +
    '<table class="gbemu-table"><thead><tr><th>Phase (length in dots)</th><th>The background fetcher</th><th><code>lx</code></th><th>Pixel output</th></tr></thead><tbody>' +
      '<tr><td><b>the wait</b> (0&ndash;5 dots)</td><td><b>advances</b> every dot</td><td>frozen</td><td>none</td></tr>' +
      '<tr><td><b>the fetch</b> (flat 6 dots)</td><td><b>frozen</b></td><td>frozen</td><td>none</td></tr>' +
    '</tbody></table>' +
    'The background step freezes ' +
    'exactly where it is, at (step s, sub b), and resumes at exactly (step s, sub b). ' +
    'If it froze with one dot of a two-dot step still owed, it pays that one dot on resume. ' +
    '<b>An object fetch cannot abort an in-flight data read</b>: the read is ' +
    'not abandoned and not re-issued, it simply happens later.</div>' +
    '<div class="gbemu-why"><b>Why. MECHANISM, and this is the answer to &ldquo;what happens to the ' +
    'remaining dots&rdquo;: nothing is lost and nothing is added.</b> Mode ' +
    '3&rsquo;s length is therefore unchanged by the freeze itself, <em>by construction rather than ' +
    'by measurement</em>. Measured on our own core with a ' +
    'freeze census, <b>1,200 of 1,440 freezes per cartridge land before the high-byte read</b>, 880 ' +
    'of them with the high-byte step exactly pending, and those pending reads resolve 5 to 10 dots ' +
    'later.</div>' +
    '<div class="gbemu-rule" id="gbr-E-3-3-2"><b>Rule E.3.3/2.</b> The recorded inputs. <b>When an object fetch starts, the tile fetch it freezes completes its map ' +
    'read and both of its pixel-row reads with the register values they would have had at the dots ' +
    'they would have executed on with no object present</b>, not with whatever the processor wrote during the stall. The object&rsquo;s dots are paid on ' +
    'top; pixel output, not the fetcher, is what the penalty holds back. ' +
    '<b>The stall stays exactly where it is and ' +
    'nothing about the fetcher&rsquo;s timing moves. What moves is only which dot the fetch&rsquo;s ' +
    'register inputs are sampled on.</b> During the stall, the address inputs of each owed read are recorded (rules E.3.3/4 and E.3.3/5); the fetcher, running at its normal ' +
    'unchanged dots after the stall, computes its addresses from those recordings instead of from ' +
    'the live registers. Do <b>not</b> delay the start of ' +
    'the stall until the read completes. <b>If mode 3 moves at all, the implementation is wrong, and a pixel gain does not rescue it.</b></div>' +
    '<div class="gbemu-why"><b>Why.</b> Left alone, the ' +
    'pending read resolves against whatever the processor wrote <em>during</em> the stall. Hardware ' +
    'does not do that. The obvious implementation, delaying the start of the stall until the read completes, grows mode 3 by 1 to 2 dots per object and breaks ' +
    '<code>intr_2_mode0_timing_sprites</code>. The mode-3 falsifier is not decoration.</div>' +
    '<div class="gbemu-rule" id="gbr-E-3-3-3"><b>Rule E.3.3/3.</b> <b>Record the ' +
    'address-arithmetic consumers only.</b> <b>The closed list is: background map select, window map ' +
    'select, tile-data select, SCX, SCY. Window enable is deliberately not on it.</b></div>' +
    '<div class="gbemu-why"><b>Why.</b> Swapping whole registers ' +
    'over-reaches <em>and</em> under-reaches: swapping LCDC wholesale also reaches the ' +
    'window-enable comparison, which is a different consumer with its own timing and is not part of ' +
    'the address arithmetic; and a raw-register snapshot cannot see a consumer whose settling width ' +
    'resolves through the pending value. The closed list is MECHANISM by argument.</div>' +

    '<div class="gbemu-rule" id="gbr-E-3-3-4"><b>Rule E.3.3/4.</b> Arming the recording, and which dot each read is recorded on. Dots in this rule are counted from <b>F</b>, the first dot of the object fetch (F + 1 is the dot after it).' +
    '<ol class="gbemu-steps">' +
      '<li><b>F is the first dot of every object fetch, clipped or not</b>, through one path in both regimes of E.3.1. For a clipped object that does not wait (rule E.3.1/3) F is its notice dot. For an object that waits (an object served through the phase window, or a hidden object of rule E.3.1/5) F is the dot its wait ends, <b>not</b> the dot it was noticed on.</li>' +
      '<li>On F, any previous recording is discarded.</li>' +
      '<li>On F, the owed reads are counted from the fetcher&rsquo;s state on F (the fetcher does not step on F, rule E.3/2): frozen at pos p from 0 to 5, the owed reads are the bodies of steps p / 2 (rounded down) to 2 (step 0 the map read, step 1 the low plane, step 2 the high plane). A fetch frozen on the first dot of a step (p even) owes that step&rsquo;s body, and one frozen on its second dot (p odd) owes it too. A fetch frozen at its sleep or push step (pos 6 or 7), or parked, owes nothing. At most three reads, on the would-be dots of a six-dot span.</li>' +
      '<li>Each owed read has a <b>would-be dot</b>, the dot it would have executed on with no object: for the first owed step, F + 1 when p is even and F itself when p is odd; each later owed step two dots after the one before.</li>' +
      '<li>Each owed read is recorded on its <b>recording dot</b>, the dot after its would-be dot.</li>' +
      '<li>A read whose recording dot would fall after the stall&rsquo;s last dot is not recorded: the fetcher makes that read from the live registers when it reaches it.</li>' +
      '<li>After the stall, the fetcher runs its owed steps on its normal dots and takes each recorded read&rsquo;s inputs from the recording.</li>' +
    '</ol>' +
    'The cases, in dots counted from F:' +
    '<table class="gbemu-table"><thead><tr><th>Fetcher pos on F (section 9 pos, before its step)</th><th>Owed reads</th><th>Would-be dots (from F)</th><th>Recording dots (from F)</th></tr></thead><tbody>' +
      '<tr><td>0</td><td>map, low plane, high plane</td><td>F + 1, F + 3, F + 5</td><td>F + 2, F + 4, F + 6</td></tr>' +
      '<tr><td>1</td><td>map, low plane, high plane</td><td>F, F + 2, F + 4</td><td>F + 1, F + 3, F + 5</td></tr>' +
      '<tr><td>2</td><td>low plane, high plane</td><td>F + 1, F + 3</td><td>F + 2, F + 4</td></tr>' +
      '<tr><td>3</td><td>low plane, high plane</td><td>F, F + 2</td><td>F + 1, F + 3</td></tr>' +
      '<tr><td>4</td><td>high plane</td><td>F + 1</td><td>F + 2</td></tr>' +
      '<tr><td>5</td><td>high plane</td><td>F</td><td>F + 1</td></tr>' +
      '<tr><td>6 or 7 (sleep or push), or parked</td><td>none</td><td>none</td><td>none</td></tr>' +
    '</tbody></table>' +
    'In a six-dot stall (F to F + 5) a recording dot of F + 6 falls after the stall, so at pos 0 the high plane is read live. Nothing after the frozen fetch&rsquo;s high-plane read is recorded. ' +
    '<b>&ldquo;The stall&rdquo; is one object fetch, not a run</b>: when a second object&rsquo;s fetch starts straight after the first (a run at one position), F is that second fetch&rsquo;s first dot, the recording starts again from there, counted from the fetcher&rsquo;s state then (which has not moved since the first object froze it), and anything recorded for the first is discarded. ' +
    '<b>During a clipped stall longer than six dots</b> the recording is complete within the first six dots after the notice dot and the remaining stall dots record nothing.</div>' +
    '<div class="gbemu-example"><b>Example.</b> An object at OAM X = 8 on a plain line at SCX = ' +
    '0 is noticed on 97 and its fetch starts on 102 (F = 102, not 97), with the fetcher then at the first dot of its ' +
    'high-plane step (pos 4), so only the high-plane read is owed: its would-be dot is 103 and it is recorded on 104 (measured on ' +
    '<code>m3_scy_change</code> line 64). Not recorded on 103, and not counted from 97. ' +
    'A clipped object at OAM X&nbsp;=&nbsp;0 freezes the first real fetch on F = 90 before it has started (pos 0), so all three of its reads are owed, at their would-be dots 91, 93 and 95, and recorded on 92, 94 and 96, all inside the stall 90 to 100. ' +
    'Derived from the rule, not measured: the clipped object at OAM X = 4 of the worked line of rule E.3.1/3 freezes the first real fetch on F = 94 at pos 4, so only the high plane is owed, would-be dot 95, recorded on 96; the fetcher then makes that read on 102 from the recording.</div>' +
    '<div class="gbemu-why"><b>Why.</b> Read from our source (the owed count is set afresh at every object fetch&rsquo;s start). READ FROM OUR OWN SOURCE, too, that every object fetch re-arms the recording. What the board can see of the re-arming: arming the recording for the ' +
    'line&rsquo;s first object fetch only, or letting a later object at the same OAM X keep its ' +
    'run&rsquo;s first recording, is each byte-identical on the original&rsquo;s board, so every pixel ' +
    'the recording is worth (the 502 and 496&nbsp;px below) comes from the line&rsquo;s first object ' +
    'fetch.</div>' +

    '<div class="gbemu-rule" id="gbr-E-3-3-5"><b>Rule E.3.3/5.</b> Which value each input is recorded with, on the recording dot of rule E.3.3/4:' +
    '<table class="gbemu-table"><thead><tr><th>Input</th><th>Value recorded</th></tr></thead><tbody>' +
      '<tr><td>SCX, SCY</td><td>the register as it stood at the <b>start of the would-be dot</b>, not at its end (its end is the start of the recording dot): the one-dot lead, shipped value 1. A processor write to either lands between dots, after the cycle&rsquo;s picture dots less the register&rsquo;s lead (E.1), and the recording sees it from the first dot processed after it lands. The Colour&rsquo;s separate hold on SCX&rsquo;s map consumer is not applied to the recording.</td></tr>' +
      '<tr><td>background map select, window map select, tile-data select</td><td>each select as its own consumer view reads <b>on the recording dot</b>, that is, one dot after the would-be read, with that consumer&rsquo;s settling (E.1.3, E.9) applied there</td></tr>' +
      '<tr><td>window enable</td><td>not recorded (rule E.3.3/3)</td></tr>' +
    '</tbody></table>' +
    'The one-dot shadow that carries SCX and SCY must be <b>seeded at the freeze dot</b> F, or it silently applies on even stall ' +
    'lengths and not odd ones (at an odd pos on F the first recording dot is F + 1, whose would-be dot is F).</div>' +
    '<div class="gbemu-example"><b>Example (derived from the rule, not a measured case).</b> The OAM X = 8 object above: its high-plane read&rsquo;s would-be dot is 103 and its recording dot 104. A processor write to SCY that lands between dots 103 and 104 is <b>not</b> in the recording (the recording takes SCY as it stood at the start of 103); a write that lands between 102 and 103 is. Without the lead the recording would take the values one dot late, and the first write would be in it. <b>Before or after the head-of-dot settling (E.5) makes no difference here</b>: the recording takes the plain SCX and SCY registers, which have no settling counter of their own, so the head step does not change them. Read from our source.</div>' +
    '<div class="gbemu-why"><b>Why.</b> <b>The one-dot lead is FITTED, deliberately not ' +
    'MECHANISM.</b> Nothing derives it; the shape is ' +
    'precedented, because three other consumers in this core carry per-consumer settling widths, ' +
    '<b>but a precedent is not a derivation</b> and no hardware statement says the address inputs ' +
    'are read a dot before the read they feed. <b>What would earn MECHANISM:</b> a document or a ' +
    'device pinning the input-latch dot within a two-dot fetcher step. The seeding is a trap worth naming: ' +
    'a shadow seeded later applies the lead on one stall parity only.</div>' +

    '<div class="gbemu-rule" id="gbr-E-3-3-6"><b>Rule E.3.3/6.</b> The scope cases, answered from the shipped core.' +
    '<table class="gbemu-table"><thead><tr><th>Case</th><th>Recording</th></tr></thead><tbody>' +
      '<tr><td>a clipped object&rsquo;s stall</td><td>recorded, by rule E.3.3/4 (F is the notice dot, or for a hidden object the dot its wait ends)</td></tr>' +
      '<tr><td>the first fetch after the priming fetch</td><td>covered by rule E.3.3/4, not by a special case. The priming fetch ends on dot 89 with the fetcher back at its first step, and no clipped object can be noticed before dot 90 (rule E.3.1/3), so an object at OAM X&nbsp;=&nbsp;0 freezes the first real fetch before it has started and all three of its reads are recorded</td></tr>' +
      '<tr><td>the priming fetch itself</td><td>never recorded on our core, because no object is ever noticed while it runs</td></tr>' +
      '<tr><td>a window takeover</td><td>throws the recording away. The restart abandons the fetch the recording belonged to, so with no object the window&rsquo;s first tile is fetched from the live registers</td></tr>' +
      '<tr><td>a restart fetch frozen by an object</td><td>covered like any other fetch: an object whose fetch freezes the restart fetch arms a recording for it on the same rule</td></tr>' +
      '<tr><td>a later object of a run</td><td>re-arms: the previous recording is discarded and the owed reads are counted again from the fetcher&rsquo;s state at that object&rsquo;s F; the fetcher has not moved since the first object froze it</td></tr>' +
    '</tbody></table></div>' +
    '<div class="gbemu-example"><b>Example: a restart fetch frozen by an object.</b> Measured on ' +
    '<code>m3_lcdc_tile_sel_win_change</code> line 48: WX = 7, takeover on 96, an object at OAM X = 6 ' +
    'fetches on 97 to 102 with the restart fetch not yet begun (pos 0); the map read&rsquo;s inputs are ' +
    'recorded on 99 and the low plane&rsquo;s on 101, and the high plane&rsquo;s would be recorded on ' +
    '103, after the stall, so the restart fetch takes its map read (dot 104) and low plane (106) from ' +
    'the recording and its high plane (108, with the early push) live.</div>' +
    '<div class="gbemu-why"><b>Why.</b> Switching the recording off for ' +
    'restart fetches altogether is byte-identical on the original&rsquo;s board: on our corpus the ' +
    'recorded and the live values agree there. ' +
    '<b>What the recording is worth, measured by switching it off on the shipped core</b> (both mealybug boards, every cell): the original&rsquo;s board 24 of 24 to 22 of 24 (<code>m3_scy_change</code> 502&nbsp;px, <code>m3_lcdc_tile_sel_change</code> 496&nbsp;px); the Color&rsquo;s board 27 of 27 to 25 of 27 (<code>m3_scy_change</code> 208&nbsp;px, <code>m3_lcdc_tile_sel_change</code> 124&nbsp;px). Taking SCX and SCY one dot late instead (the lead at 0): the original&rsquo;s board 24 of 24 to 23 of 24 (<code>m3_scy_change</code> 4&nbsp;px); the Color&rsquo;s board 27 of 27 to 26 of 27 (<code>m3_scy_change</code> 64&nbsp;px). Labels: the closed list is MECHANISM by argument, the one-dot lead FITTED.</div>' +

    '<p class="gbemu-key"><b>E.3.4: When an object is due, and what the wait does with an empty queue.</b></p>' +
    '<div class="gbemu-rule" id="gbr-E-3-4-1"><b>Rule E.3.4/1.</b> The wait of rule E.3/1 has no queue ' +
    'condition: once the priming fetch is over, it ends when the fetcher is on pos 4, 5 or 6, or parked at ' +
    'the push with a non-empty queue (rule E.3/3), whether or not the background queue holds a pixel. What has a queue ' +
    'condition is the test that makes an object <i>due</i> (rule E.3.4/2).</div>' +
    '<div class="gbemu-rule" id="gbr-E-3-4-2"><b>Rule E.3.4/2.</b> When an object is due, and what starts its fetch, by OAM X. The due test runs at the object test of each dot (rule E.3/2).' +
    '<table class="gbemu-table"><thead><tr><th>Object (OAM X)</th><th>Due on a dot when</th><th>Its fetch&rsquo;s first dot</th></tr></thead><tbody>' +
      '<tr><td>any OAM X, when it is not the first of its run (rule E.4/1)</td><td>its own row below</td><td>the dot it is due: no wait</td></tr>' +
      '<tr><td><b>0</b> (clipped)</td><td>the pre-visible position of rule E.3.1/2 has reached &minus;8</td><td>the notice dot (rule E.3.1/3)</td></tr>' +
      '<tr><td><b>1 to 7</b> (clipped), X + (SCX &amp; 7) below 8</td><td>the pre-visible position has reached OAM X &minus; 8 + (SCX &amp; 7)</td><td>the notice dot (rule E.3.1/3)</td></tr>' +
      '<tr><td><b>1 to 7</b> (hidden), X + (SCX &amp; 7) 8 or more</td><td>the same as the row above</td><td>after the hidden wait of rule E.3.1/5</td></tr>' +
      '<tr><td><b>8</b> (screen column 0)</td><td>all four conditions of rule E.3.1/6 hold</td><td>the first dot, from its notice dot on, at pos 4, 5 or 6 or with the fetcher parked (rules E.3/1, E.3/3)</td></tr>' +
      '<tr><td><b>9 and above</b></td><td>the count of pixels already output (real pops) is from X &minus; 8 to X &minus; 1 and the object is still unfetched. No position, queue or priming condition</td><td>as for OAM X 8</td></tr>' +
    '</tbody></table>' +
    'For OAM X 0 to 7 the test is &ldquo;reached&rdquo;, not &ldquo;equals&rdquo;, so an ' +
    'object whose notice dot is spent on something else is noticed on the next dot that runs the object test. ' +
    'A window takeover dot runs no object test. ' +
    'For OAM X 9 and above, with object selection steady the object is due on the dot the count equals X &minus; 8; the wider span X &minus; 8 to X &minus; 1 matters for an object passed over because selection read clear, which is due again inside its eight columns (E.9.1&rsquo;s &ldquo;When object selection is consulted&rdquo;), never after.</div>' +
    '<div class="gbemu-example"><b>Example: a takeover dot.</b> With WX = 7 (takeover on dot 96) an object at OAM X = 6, due on 96, is ' +
    'noticed on 97 and stalls 97 to 102; OAM X = 7 is due on 97 and does the same. The restart fetch then ' +
    'runs 103 to 108. The OAM X = 8 object is due on 97 on an ordinary line (the push ' +
    'dot), and on dot 100 at SCX = 3, after the three discards.</div>' +
    '<div class="gbemu-rule" id="gbr-E-3-4-3"><b>Rule E.3.4/3.</b> One hold at the pop. On any dot on which, after the fetcher has stepped, the queue holds ' +
      'a pixel, no column is being dropped or discarded, and an object sits at the current pixel count (its OAM X &minus; 8 equals the count of real pops, which is never true for OAM X 0 to 7), that ' +
      'dot pops nothing and is credited to the coming object fetch, which then runs one dot shorter. The ' +
      'line&rsquo;s length does not change.</div>' +
    '<div class="gbemu-example"><b>Example: WX = 7, one object at OAM X = 8, SCX = 0.</b> Takeover on 96; the ' +
    'restart fetch pushes on 102 into an empty queue, and that same dot&rsquo;s pop is held for the object ' +
    '(the queue now holds a pixel and the object sits at count 0); the object is due on 103, waits 103 to 106 ' +
    'because the restart&rsquo;s next fetch is on pos 0 to 3, starts its fetch on 107 (pos 4) and finishes on ' +
    '111, five dots after the credit; the first pixel leaves on 112. So the object waits into the next tile, but because it was not due until the queue filled, not because the wait needs a ' +
    'pixel. <b>With WX = 15 and an object at OAM X = 16</b> the object is due on 106, the dot after the ' +
    'takeover, with the queue empty, and its wait ends on 110 on the restart fetch&rsquo;s pos 4, still with ' +
    'the queue empty; the restart fetch then resumes and pushes on 117. A wait that required a pixel would ' +
    'hold that object until after 117.</div>' +
    '<div class="gbemu-why"><b>Why.</b> Adding a queue condition to the wait is one way to reach two of the window cells; it is not what our core does. ' +
    'Read from our ' +
    'own source and INSTRUMENT-MEASURED with a synthetic cartridge, identical on both machines. ' +
    'Priced on the shipped core: requiring a non-empty queue for the wait ' +
    'to end moves no mealybug pixel on either board, with or without the WIN_POS_TRIG knock-out of E.8.1, so ' +
    'nothing in the corpus separates the two readings; the queue condition on the due test is the one this ' +
    'core ships. The span X &minus; 8 to X &minus; 1 for OAM X 9 and above, and the exact-equality position test of the pop hold, are read from our source.</div>' +

    '<h4 class="gbemu-sub">E.4: The three object-cost terms, defined</h4>' +
    '<div class="gbemu-rule" id="gbr-E-4-1"><b>Rule E.4/1.</b> Run detection. A <em>run</em> is a maximal sequence of ' +
    'objects served at the same pre-visible position with no pixel emitted between them, and <b>the wait ' +
    'is paid once per run, not once per object</b>: within a run, every object after the first starts its flat six dots immediately, ' +
    'with no wait. A run ends at the first of these two events, whichever comes first:' +
    '<table class="gbemu-table"><thead><tr><th>Event (at the object test of a dot)</th><th>The run</th><th>The next object</th></tr></thead><tbody>' +
      '<tr><td>(a) a dot passes with no object due (a pixel is emitted on that dot)</td><td>over</td><td>first of a new run: pays the re-entry wait (rule E.4/2)</td></tr>' +
      '<tr><td>(b) an object is noticed whose OAM X differs from the last one fetched, even though no pixel was emitted between them</td><td>over</td><td>this object is the first of a new run: pays the re-entry wait</td></tr>' +
      '<tr><td>an object is due at the same OAM X as the last one fetched, no pixel emitted since</td><td>continues</td><td>its six-dot fetch starts on this dot</td></tr>' +
    '</tbody></table></div>' +
    '<div class="gbemu-example"><b>Example: why the two elevens are different quantities.</b> N objects ' +
    '<em>stacked</em> at one X cost <code>11 + 6(N&minus;1)</code>: one run, one wait, N ' +
    'fetches. N objects <em>spread</em> eight apart cost <b>11 each</b>: N runs, N waits. At residue 0 with N = 3: stacked, 11 + 6 + 6 = 23 dots; spread, 11 + 11 + 11 = 33 dots. ' +
    'Quoting &ldquo;the object stall is 11&rdquo; without naming the geometry says nothing.</div>' +
    '<div class="gbemu-why"><b>Why.</b> MECHANISM. The half that later objects of a run start with no wait is the half both reference implementations confirm.</div>' +

    '<div class="gbemu-rule" id="gbr-E-4-2"><b>Rule E.4/2.</b> The re-entry wait: the wait paid by the <em>first</em> ' +
    'object of a run. It is the distance from the current dot to the next dot on which the fetcher is in ' +
    'the window of E.3 (rule E.3/1): <code>max(0, 5 &minus; ((OAM_X + SCX) mod 8))</code> dots in the ' +
    'steady cycle, and <em>whatever the fetcher&rsquo;s actual state says</em> outside it. ' +
    '<b>It is 0 to 5 dots</b>, never negative and never clamped from ' +
    'above by a constant. <b>The window does not suspend during a stall, it ' +
    'stretches</b>: a second object arriving mid-stall meets an open window and is served at once. ' +
    '<b>The ' +
    'dot that satisfies the wait is the first dot of the fetch, not an extra dot before it.</b></div>' +
    '<div class="gbemu-example"><b>Example.</b> A first object&rsquo;s fetch starts with the fetcher frozen at pos 4. A second object at a different X becomes due during that fetch; it is tested on the dot after the fetch ends, against the fetcher still at pos 4, so its wait is 0 and it costs 6. Reading the phase as having moved on six dots during the stall (pos 4 + 6 = pos 2 of the next fetch) would give a wait of 2 and a cost of 8; that reading is wrong. And treating the satisfying dot as a separate wait dot costs one extra dot on the line&rsquo;s first object ' +
    '(7 instead of 6) while objects entered with a full queue cost 6: that asymmetry is the ' +
    'tell.</div>' +
    '<div class="gbemu-why"><b>Why. MECHANISM.</b> The ceiling is a consequence of an eight-dot cycle with a three-dot ' +
    'window, not a <code>min()</code>. ' +
    'Our core reaches the stretching without a flag, because an object due during a fetch is not tested until ' +
    'the dot after the fetch ends and the fetcher is still parked exactly where it froze, so the ' +
    'phase test is made against the pre-stall position: <b>NOT ESTABLISHED</b> whether ' +
    'hardware disarms and re-arms an explicit ready flag or simply reads the frozen phase as we do; ' +
    'we built the explicit form, it is not shipped, and nothing we own separates the two.</div>' +

    '<div class="gbemu-rule" id="gbr-E-4-3"><b>Rule E.4/3.</b> <b>The alignment key is <code>(OAM_X + SCX) mod 8</code>, not ' +
    '<code>OAM_X mod 8</code>.</b></div>' +
    '<div class="gbemu-example"><b>Example.</b> OAM X = 16 at SCX = 3: the key is (16 + 3) mod 8 = 3, so the wait is 2 and the cost 8. Keyed on OAM X mod 8 = 0 instead, it would cost 11.</div>' +
    '<div class="gbemu-why"><b>Why.</b> The phase argument is MECHANISM: the background fetcher ' +
    'runs <code>SCX mod 8</code> dots ahead of the visible position all line, because the ' +
    'fine-scroll pixels are produced and discarded, so the quantity that decides the wait is the ' +
    'fetcher&rsquo;s phase at the hit. <b>The SCX term itself is tier 2 / CONVERGENCE</b> by our own ' +
    'specification and has never been photographed.</div>' +

    '<div class="gbemu-rule" id="gbr-E-4-4"><b>Rule E.4/4.</b> <b>The first-object discount does not exist.</b> The line&rsquo;s opening run pays the same re-entry wait (rule E.4/2) as every later run: no first-run special case, no discount. An opening-run discount, by alignment <code>8/6/4</code> or as the row <code>8 7 6 6 4 4 4 4</code>, is wrong.</div>' +
    '<div class="gbemu-why"><b>Why. REFUTED, and our core ' +
    'ships without it.</b> The belief was that the line&rsquo;s opening run leaves the line&rsquo;s ' +
    'own start state rather than re-entering object mode, so it gets a <em>discount</em> where later ' +
    'runs get a <em>wait</em>. What is true: <b>neither reference implementation has a ' +
    'first-run special case and neither does the suite author&rsquo;s own arithmetic</b>; ' +
    '<code>8 7 6 6 4 4 4 4</code> does not ' +
    're-derive at the current base and <b>the configuration that produced it is recorded nowhere</b>, ' +
    'which is the fault that makes a figure worthless, since a figure must travel with the ' +
    'configuration that produced it; and our on-screen row at the current base is ' +
    '<code>11 10 9 8 7 6 6 6</code> with no discount term present.</div>' +
    '<div class="gbemu-why"><b>Why: the knob itself, because its absence is easy to misread.</b> ' +
    'This core does not carry a live discount knob: ' +
    '<b>it is unreachable at the shipped configuration and passing either of its ' +
    'settings is a build failure.</b> Verified behaviourally: forcing it either way gives ' +
    'the identical 61 of 105 on the deciding cartridge. <b>The general lesson:</b> a special case ' +
    'for &ldquo;the first one&rdquo; almost always means a missing ' +
    'state variable, not a missing constant. Here the missing variable was the fetcher&rsquo;s ' +
    'phase; once the wait is keyed on phase, the line&rsquo;s opening produces the right answer with ' +
    'no branch at all, and removing the special case entirely was byte-identical across the whole ' +
    'board. <b>A caution to inherit:</b> at our shipped configuration that knob is unreachable, so ' +
    'sweeping it scores identically at every value and <b>reads as a clean null result while ' +
    'measuring nothing</b>. If you keep such a knob, make an unreachable setting a build failure.</div>' +

    '<h4 class="gbemu-sub">E.5: Ordering, within a machine cycle and within a dot</h4>' +
    '<p class="hw-readable"><b>Scale in E.5 and E.6.</b> Every dot number in E.5 and E.6 is on the <b>event scale</b>, counted from the line&rsquo;s dot 0 as defined at the head of this appendix: &ldquo;X happens on dot D&rdquo; means X happens while the picture processor processes dot D, and a processor access first sees X on dot D&nbsp;+&nbsp;1 of the <b>access scale</b> (section 14, &ldquo;Access windows&rdquo;). Where a sentence below speaks of a processor access or a dispatch test, it names the access scale in so many words. Machine-cycle steps are counted in T-cycles; a sound tick is 2 T-cycles.</p>' +
    '<div class="gbemu-why"><b>Why.</b> Section 22 calls this <i>&ldquo;a seam that governs every register write ' +
    'in the machine&rdquo;</i> and then declines to say where our seam sits. It sits here.</div>' +

    '<div class="gbemu-rule" id="gbr-E-5-1"><b>Rule E.5/1.</b> From the arrangement inside a machine cycle, a build must match exactly three things, and only these three: ' +
    '<b>(1)</b> the bus access is at the end of the machine cycle, for reads and writes alike (E.1.5); ' +
    '<b>(2)</b> each register&rsquo;s lead in dots (E.1); ' +
    '<b>(3)</b> the order of the steps marked <b>[observable]</b> in the within-dot list of Rule E.5/6. ' +
    'Two further placements inside the machine cycle are rules of other sections, with their measured costs below: section 4, the sprite-memory transfer steps before the processor&rsquo;s access, for reads and writes alike; section 17, a sound-register write reaches the sound unit before that machine cycle&rsquo;s two sound ticks. ' +
    'Every other detail of the two step lists below is the shipped core&rsquo;s arrangement, not a requirement: for example, a build may run the picture unit ahead of the processor instead of behind it and subtract the constant elsewhere; nothing we own can tell the difference, provided (1) to (3) and those two placements hold.</div>' +
    '<p class="hw-readable"><b>The shipped core&rsquo;s order within one machine cycle (an implementation, not a requirement beyond Rule E.5/1).</b> There are two orders: one for a read and one for a write.</p>' +
    '<p class="hw-readable"><b>A read machine cycle</b> (opcode fetches included):</p>' +
    '<ol class="gbemu-steps">' +
      '<li>Timer: four ticks of one T-cycle each, before anything else.</li>' +
      '<li>Sound: two sound ticks (2&nbsp;T each).</li>' +
      '<li>Picture: the dots <em>owed from the previous machine cycle</em> are processed now; at rest that is exactly four.</li>' +
      '<li>Sprite-memory transfer: one byte.</li>' +
      '<li>Real-time clock.</li>' +
      '<li><b>The processor&rsquo;s read lands.</b></li>' +
    '</ol>' +
    '<p class="hw-readable"><b>A write machine cycle:</b></p>' +
    '<ol class="gbemu-steps">' +
      '<li>Timer: four ticks.</li>' +
      '<li>Picture: the owed dots, less the register&rsquo;s lead (E.1; Rule E.5/3 gives the exact count).</li>' +
      '<li>Sprite-memory transfer: one byte.</li>' +
      '<li><b>The processor&rsquo;s write lands.</b></li>' +
      '<li>Real-time clock.</li>' +
      '<li>Sound: two sound ticks.</li>' +
    '</ol>' +
    '<p class="hw-readable">So a write reaches the sound unit before that ' +
    'machine cycle&rsquo;s two sound ticks, and a read sees the sound unit after them. <b>Exception:</b> writes to the display-control and ' +
    'palette registers interleave their own dots (E.9.1) and step the transfer after the write instead of before it,' +
    ' which nothing can see: those writes touch neither sprite memory nor the transfer register.</p>' +
    '<div class="gbemu-example"><b>Example.</b> A read of <code>NR52</code> and a write to a sound register in the same kind of cycle at single speed: the read&rsquo;s cycle runs its two sound ticks (step 2) before the read lands (step 6), so the read reports the sound unit after both ticks; the write&rsquo;s cycle lands the value (step 4) before its two sound ticks (step 6), so both ticks already run with the new value.</div>' +
    '<div class="gbemu-why"><b>Why.</b> Section 4 (the transfer steps before the access, reads and writes alike) and section 17 (a ' +
    'sound-register write reaches the sound unit before that cycle&rsquo;s sound ticks) state the same placements as the lists above. What ' +
    'the two placements are worth, measured on the shipped core: with the transfer stepped after the access,' +
    ' 12 of the 65 original-machine Mooneye cartridges that do not need the boot program fail (section ' +
    '4); with a sound-register write moved after the cycle&rsquo;s sound ticks and nothing else changed, ' +
    '<code>dmg_sound</code> 04, 05 and 09 fail (section 17 gives the arrangement under which the other ' +
    'seam works for the wave channel).</div>' +

    '<div class="gbemu-rule" id="gbr-E-5-2"><b>Rule E.5/2.</b> <b>Within one machine cycle: ' +
    'tick the cycle&rsquo;s picture dots first, then land the bus access.</b> The dots ticked before an access are the debt carried from the previous machine cycle. ' +
    'Use this operational form when describing the seam, not &ldquo;at the start of the cycle&rdquo; or &ldquo;at the end of the cycle&rdquo;.</div>' +
    '<div class="gbemu-why"><b>Why.</b> One of ' +
    'our source comments calls this arrangement &ldquo;accesses happen at the start of their cycle&rdquo; and ' +
    'two other records call it &ldquo;the end of the cycle&rdquo;; <b>both describe the same code</b>' +
    ': the four dots ticked before an access are the debt carried from the previous cycle, so ' +
    'the two phrases name the same instant under two conventions. The page uses the operational form ' +
    'rather than either of the two phrases our own records use.</div>' +

    '<div class="gbemu-rule" id="gbr-E-5-3"><b>Rule E.5/3.</b> Write <code>B</code> for ' +
    'the machine cycle&rsquo;s dot budget: <b>4 at single speed, 2 in double speed</b>. For a write to a register with lead <code>L</code> (E.1; where E.1 states the constant the write path is handed, <code>L</code> is that constant), the cycle ticks <code>withheld</code> dots before the access and owes <code>owed</code> dots after it, where ' +
    '<code>withheld = max(0, B &minus; L)</code>, ' +
    '<code>owed = B + L + (B &minus; L &minus; withheld)</code>, which is just ' +
    '<code>owed = 2B &minus; withheld</code>. Implement the form <code>owed = 2B &minus; withheld</code>: ' +
    '<b>the two halves of a machine cycle must always sum ' +
    'to <code>2B</code>, whatever the lead does.</b> Where <code>L</code> is at most <code>B</code> (negative leads included) this is <code>B &minus; L</code> dots before the access and <code>B + L</code> after. ' +
    'Assert <code>ticked + owed == 2B</code> at every machine cycle. ' +
    'The budget is the quantity <code>B</code>, never the literal 4.</div>' +
    '<div class="gbemu-example"><b>Example.</b> Both regimes: ' +
    '<code>B&nbsp;=&nbsp;4, L&nbsp;=&nbsp;3</code>: withhold 1, owe 7, total 8 = 2B. ' +
    '<code>B&nbsp;=&nbsp;2, L&nbsp;=&nbsp;3</code>: withhold 0, owe 4, total 4 = 2B. ' +
    'The unbalanced pair <code>B &minus; L</code> before and <code>B + L</code> after gives, at <code>B&nbsp;=&nbsp;2, L&nbsp;=&nbsp;3</code>, &minus;1 before (the loop does not run, so 0) and 5 after: 5 dots against a budget of 4.</div>' +
    '<div class="gbemu-why"><b>Why.</b> <b>One consequence that is not optional.</b> The dots-per-machine-cycle ' +
    'constant is a single literal and it is the most load-bearing one in the file. Our source writes the constant 4 because it is ' +
    'written for the single-speed case; <code>B</code> is the quantity. <b>On ' +
    'double-speed colour hardware a machine cycle is two dots, not four.</b> Every dot-denominated ' +
    'picture quantity keeps its <em>rate</em> across a speed change but its <em>phase against the ' +
    'machine-cycle grid does not</em>. With <code>B = 2</code> and a lead of 3, ' +
    '<code>B &minus; L = &minus;1</code>: <b>the withholding term goes negative</b>, the ' +
    'loop does not run, and if the repayment is still computed as <code>B + L</code>, as though the ' +
    'full lead had been withheld, the cycle hands back more dots than it held: one dot here, ' +
    'and up to three machine cycles of silent debt across a line. <b>That is not a clamp, it is a ' +
    'leak</b>: a clamp would lose the dot once and stop; this pays the missing dots out of ' +
    'the next cycle for ever, so the picture walks against the processor instead of sitting one dot ' +
    'wrong. Rule E.5/3 withholds what the cycle can, <em>records the shortfall</em>, and subtracts it from the ' +
    'repayment; <code>owed = 2B &minus; withheld</code> is the form to implement because it says ' +
    'outright what the pair is <em>for</em>. <b>The ' +
    'conservation is the falsifier</b>: with <code>ticked + owed == 2B</code> asserted at every ' +
    'machine cycle, this whole class of defect cannot ship.</div>' +

    '<div class="gbemu-rule" id="gbr-E-5-4"><b>Rule E.5/4.</b> <b>At a two-dot budget a lead of +3 is unrepresentable.</b> ' +
    '<code>withheld = max(0, B &minus; L)</code> is <b>0</b> at ' +
    '<code>B&nbsp;=&nbsp;2, L&nbsp;=&nbsp;3</code>: the cycle withholds nothing, so the register&rsquo;s ' +
    '<em>effective</em> lead on the generic write path is 2, not 3. Every lead of 3 or more collapses onto 2 at that budget, ' +
    'and the conservation check of Rule E.5/3 does not see it, because the halves still sum to ' +
    '<code>2B</code>. <b><code>OBP0</code> and <code>OBP1</code> are handed a constant of 3 ' +
    '(E.1, where it is lead 2 in that table&rsquo;s convention because the palette write spends ' +
    'one dot of its own), so on a Colour ' +
    'in double speed those two registers are one dot short of their stated lead.</b> ' +
    'What the shipped core delivers, in dots, on E.1.1&rsquo;s scale (N is the first dot covered by the machine cycle that carries the write): ' +
    'no register with a constant of 3 takes the generic path. The object and background palettes go through the palette write, which spends one dot of its own before the value lands. So in double speed a palette write is first seen on <b>N&nbsp;+&nbsp;1</b>, the second and last dot of its two-dot machine cycle, which is lead 1 in E.1&rsquo;s convention, against <b>N&nbsp;+&nbsp;2</b> (lead 2) at single speed. The cycle still balances: four dots across its two halves. The generic path does collapse as described: <code>WX</code>, at +2, is first seen on <b>N</b>, the first dot of the two-dot machine cycle. The clamp is shipped; it is a consequence of the budget, not a decision.</div>' +
    '<div class="gbemu-why"><b>Why.</b> <b>The budget conserves; the phase does not, and the two are different claims.</b> A page ' +
    'that states a falsifier and stops there tells an implementer the wrong thing ' +
    'is impossible, so the consequence the conservation does NOT fix is stated as its own rule. The object ' +
    'palettes are exactly the consumer E.1 records as the hardest to separate from its OR stage. ' +
    'The double-speed dots above are INSTRUMENT-MEASURED on the shipped core with a colour-mode probe; no scored cell sees them. ' +
    'Whether hardware clamps the same way is <b>NOT ESTABLISHED</b>: nothing on either board can see it, because ' +
    'every scored Colour cell runs in compatibility mode where the object palettes take the ' +
    'original&rsquo;s path. <b>What would settle it:</b> a colour-mode cartridge writing ' +
    '<code>OBP0</code> at a known dot in double speed and photographing which pixel first carries ' +
    'the new value (the same invariant E.1 says to copy instead of the column). Stating ' +
    'the clamp is not the same as endorsing it.</div>' +
    '<div class="gbemu-why"><b>Why (the other sign is the trap).</b> It is written out here because it ' +
    'is easy to arrive at. The rejected form is ' +
    '<code>owed = B + L &minus; (B &minus; L &minus; withheld)</code>, which reduces to ' +
    '<code>2L + withheld</code>: at single speed it coincides with the right answer and looks ' +
    'sound, but at <code>B&nbsp;=&nbsp;2, L&nbsp;=&nbsp;3</code>, reachable on a Colour in ' +
    'double speed through the constant of 3 that <code>OBP0</code>/<code>OBP1</code> are handed (E.1), it returns ' +
    '<code>owed&nbsp;=&nbsp;6</code> against a budget of <b>4</b>. <b>The unbalanced pair ' +
    'over-pays by one dot per cycle; the rejected form over-pays by two.</b> An implementer who copies ' +
    'it inherits double the leak it appears to remove, in the one regime where this page also ' +
    'warns that a leak <em>will present as a lead effect rather than as a leak</em>, so ' +
    'the symptom sends them sweeping E.1&rsquo;s leads instead of the budget. <b>How that form ' +
    'arises:</b> the literal 4 is replaced by the quantity <code>B</code> and the <em>expression</em> around it is not re-evaluated at <code>B&nbsp;=&nbsp;2</code>. Any change to this ' +
    'arithmetic owes the same two-regime check as the example under Rule E.5/3. ' +
    'And the version an implementer writes by accident: spelling the ' +
    'withholding term <code>4 &minus; L</code>, ' +
    'which at a lead of 3 is <b>1</b> and never goes negative (arithmetic that contradicts ' +
    'the sentence it is there to support). The constant is the cycle&rsquo;s budget, not the ' +
    'literal 4. Build the separation in from the start; retrofitting it means auditing every lead ' +
    'in E.1.</div>' +

    '<div class="gbemu-rule" id="gbr-E-5-5"><b>Rule E.5/5.</b> The debt of Rule E.5/2 must be drained at every instruction boundary <b>before</b> interrupts are sampled. It is therefore a bounded phase relationship and never an accumulation. That drain is also where the interrupt test sits in picture time: a request the picture raises on dot D (event scale) is seen by a test on access-scale dot D&nbsp;+&nbsp;1 or later. Section 13 and appendix D.10.1 have the rule on both clocks.</div>' +
    '<div class="gbemu-why"><b>Why.</b> The drain places every interrupt handler&rsquo;s writes: a test made before the drain starts every handler, and every write it makes, four dots early (appendix D.10.1 gives what each other placement costs).</div>' +

    '<p class="hw-readable"><b>Within one dot.</b></p>' +
    '<div class="gbemu-rule" id="gbr-E-5-6"><b>Rule E.5/6.</b> On every dot the picture processor runs the eight steps below in the order given. Steps and sub-steps marked <b>[observable]</b> are pinned by something we own: a build must keep them in this order against each other and against the steps they name. The places of the unmarked steps are the shipped core&rsquo;s arrangement.</div>' +
    '<ol class="gbemu-steps">' +
      '<li>Any deferred status-source rise scheduled for this dot (E.6, Rule E.6/1).</li>' +
      '<li><b>[observable] Every settling counter decrements at the HEAD of the dot</b>, before any ' +
        'consumer reads: the LCDC lead, conflict and late counters, the window-position hold, the ' +
        'coincidence comparator&rsquo;s blind window, the dispatch holds (Rule E.5/7 gives how to arm one).</li>' +
      '<li>If the screen is off: stop. The line counter is held at 0 and the mode reads 0. The status line' +
      ' does <em>not</em> drop: with the screen off it keeps its last value, as section 14 and A.3 ' +
      'state; measured on <code>stat_lyc_onoff</code>, a switch-off with the line high leaves it high. ' +
      'See section 14 for what the <em>comparator</em> does, and A.3 for when it restarts.</li>' +
      '<li>The window&rsquo;s per-frame arming test.</li>' +
      '<li><b>[observable] The output stage</b>: one pixel leaves for the screen (the pixel popped on the previous dot), and <b>the palette ' +
        'is applied here</b> (E.1.2).</li>' +
      '<li>The mode block for this dot: scan, or draw, or blank. <b>[observable] Inside the draw block, ' +
      'in this order</b>; the order answers where each push sits against the object test:' +
      '<ol class="gbemu-steps" type="a">' +
        '<li>An object fetch in progress takes the dot (E.3.3&rsquo;s recording runs here), and sub-steps (b) to (g) do not run on this dot.</li>' +
        '<li>Otherwise: the output position and the window&rsquo;s priming counter advance (E.3.1, E.8.4).</li>' +
        '<li>The window comparator, and on a match the takeover. A takeover after ' +
          'the priming fetch has completed ends the draw block for this dot (E.8.1).</li>' +
        '<li>The object test, which reads object selection every time it runs (E.9.1). An object found due either waits ' +
          '(the fetcher steps, nothing is popped) or starts its fetch on this dot (the fetcher does not step). <b>[observable] The object test runs BEFORE the pop, and to its ' +
          'exclusion</b> (Rule E.5.1/1).</li>' +
        '<li>Otherwise an insertion of E.8.2 or E.8.3, if one fires.</li>' +
        '<li>Otherwise the fetcher steps, ' +
          'and <b>every push happens inside this step</b>: the ordinary push on pos 7 and a window restart ' +
          'fetch&rsquo;s early push on pos 5 alike, both after the object test (Rule E.5/8).</li>' +
        '<li>Then, on the same ' +
          'dot, exactly one of: a dropped window column (E.8.1), a fine-scroll discard, the position hold (Rule E.5/9), or the ' +
          'pop.</li>' +
      '</ol></li>' +
      '<li><b>[observable]</b> Mode-3 end detection, then the mode-0 status report (E.6), then the ' +
        'internal mode-0 entry.</li>' +
      '<li><b>The dot counter increments, and only then the line wraps</b>, in this order:' +
      '<ol class="gbemu-steps" type="a">' +
        '<li>the dot counter goes to 0;</li>' +
        '<li>the coincidence comparator&rsquo;s blind window is armed;</li>' +
        '<li>the window&rsquo;s row counter advances <b>if the window is still active</b> (Rule E.5/10);</li>' +
        '<li><b>then</b> the line counter increments;</li>' +
        '<li>then the vertical-blank entry at line 144, and the frame wrap at line 154.</li>' +
      '</ol></li>' +
    '</ol>' +

    '<div class="gbemu-rule" id="gbr-E-5-7"><b>Rule E.5/7.</b> Because every settling counter decrements at the head of the dot (step 2), before any consumer sees it, a counter armed to N covers N&nbsp;&minus;&nbsp;1 dots: the dots after the arming dot numbered 1 to N&nbsp;&minus;&nbsp;1. <b>To hold a value for one dot ' +
        '<em>after</em> a write, arm the counter to two, not one.</b></div>' +
    '<div class="gbemu-example"><b>Example.</b> A write arms a counter during dot D. Armed to 2: the head of dot D&nbsp;+&nbsp;1 decrements it to 1, so dot D&nbsp;+&nbsp;1&rsquo;s consumers still see the value held; the head of dot D&nbsp;+&nbsp;2 decrements it to 0, so it is released from dot D&nbsp;+&nbsp;2. One dot held. Armed to 1: the head of dot D&nbsp;+&nbsp;1 decrements it to 0 before any consumer reads, so no dot is held.</div>' +
    '<div class="gbemu-why"><b>Why.</b> This is the trap in step 2: arming to the number of dots wanted holds one dot too few.</div>' +

    '<div class="gbemu-rule" id="gbr-E-5-8"><b>Rule E.5/8.</b> <b>A push on dot D is not visible to the object test until dot D&nbsp;+&nbsp;1</b> (both event scale: the object test of dot D, sub-step (d), runs before that dot&rsquo;s push in sub-step (f)). This holds for a window restart fetch&rsquo;s early push on pos 5 exactly as for the ordinary push on pos 7. ' +
      'Putting the restart&rsquo;s early push before the object test is not what our core does.</div>' +
    '<div class="gbemu-example"><b>Example.</b> At <code>SCX&nbsp;=&nbsp;0</code> the line&rsquo;s first push executes on dot 97 (Rule E.5.1/2&rsquo;s table). The object test of dot 97 has already run, without those eight pixels in the queue; the first object test that sees them is the one on dot 98. A core that tests objects after stepping the fetcher lets dot 97&rsquo;s object test see them, one dot early.</div>' +
    '<div class="gbemu-why"><b>Why.</b> This is real and load-bearing (the seam cell at OAM X ' +
      '= 8 is exactly this dot), and a core that tests objects after stepping the fetcher will be one dot ' +
      'off there and nowhere else.</div>' +

    '<div class="gbemu-rule" id="gbr-E-5-9"><b>Rule E.5/9. The position hold, sub-step (g).</b> When the pixel about to be popped would leave at an output position' +
      ' equal to OAM X&nbsp;&minus;&nbsp;8 of an object that the scan selected for this line and that has not yet been fetched, the pixel stays in the queue and is not popped on this dot. The test is made only while object selection reads set. The output position is the count of pixels popped so far on this line, so it is never negative, and an object at OAM X below 8 never matches. ' +
      'Each dot so withheld is taken off that object&rsquo;s six-dot fetch when the fetch starts, so mode' +
      ' 3 does not move. The constant is <code>OBJ_POS_HOLD</code> = 1.</div>' +
    '<div class="gbemu-example"><b>Example.</b> An object at OAM X = 20, selected and not yet fetched: when the next pixel would leave at output position 12 (20&nbsp;&minus;&nbsp;8), it is held. If one dot is held and the object&rsquo;s fetch then starts, that fetch runs 5 dots instead of 6. An object at OAM X = 5 would need output position &minus;3, which never occurs, so it is never held for.</div>' +
    '<div class="gbemu-why"><b>Why.</b> MECHANISM, read from our source (<code>obj_due_at_output</code>). The hold catches the one push the object test cannot see in time; on our corpus that ' +
      'is a restart fetch&rsquo;s early push with an object at OAM X = 8 (E.3.1 has the dots).</div>' +

    '<div class="gbemu-rule" id="gbr-E-5-10"><b>Rule E.5/10.</b> The window row counter has <b>two</b> increment sites, and a build must have both: ' +
        'the wrap, step 8(c), ends an activation that ran ' +
        'to the end of the line (the counter advances only if the window is still active at the wrap); section 11&rsquo;s site 1 ends one that was switched off ' +
        'mid-line. <b>Section 11 has the pair and the measurement.</b></div>' +
    '<div class="gbemu-why"><b>Why.</b> A core with only ' +
        'the wrap site cannot produce a second window activation on one line and cannot advance the ' +
        'window row on a cartridge that clears window-enable before every line ends.</div>' +

    '<div class="gbemu-rule" id="gbr-E-5-11"><b>Rule E.5/11.</b> The line counter increments at the wrap, after that dot&rsquo;s ' +
    'work (step 8(d)), and the new line&rsquo;s dot 0 is the first dot that sees the new line number.</div>' +
    '<div class="gbemu-why"><b>Why.</b> MECHANISM. <b>NOT ESTABLISHED, and named rather than glossed:</b> whether the <em>object ' +
    'path</em> is read earlier in the dot than the background and window paths. Our assignment of ' +
    'LCDC bit 2 at width 9 versus width 8 turns on exactly this, and <b>no instrument we own ' +
    'separates them</b>: the background boundary resolves only to one tile column, which is ' +
    '8 dots, and the object boundary is quantised to object positions, which is also 8 dots. ' +
    '<b>What would settle it is designed and not built:</b> one mid-line LCDC write flipping bits 2 ' +
    'and 3 together, with ten objects at consecutive X so that each object&rsquo;s fetch lands on ' +
    'its own dot and the boundary resolves to one object, which is one dot. Read the answer off ' +
    '<em>which object is the first to change height</em>, using the background map boundary as the ' +
    'coarse anchor. A difference larger than one dot refutes both orderings and would teach the ' +
    'most.</div>' +

    '<p class="gbemu-key"><b>E.5.1: The object test against the output stage, which is the ' +
    'relationship every absolute dot at the start of mode 3 depends on.</b></p>' +
    '<div class="gbemu-why"><b>Why.</b> ' +
    'Without Rule E.5.1/1 the list above pins the object test against the <em>fetcher</em> (step 6) and the output stage ' +
    'against the <em>mode block</em> (step 5 before step 6) and <b>never pins the object test ' +
    'against the pop</b>. That is two relationships where an implementer needs three, and the missing ' +
    'one is load-bearing: it is what places the fetcher&rsquo;s eight-dot comb against the ' +
    'line&rsquo;s dots, and <b>dot 89, dots 90&ndash;96, dot 97, <code>notice = 89 + X</code> and ' +
    'the stall window <code>{4,5,6}</code> are all dependents of it</b>. It is stated as an ordering, ' +
    'not as a constant: a constant would be one more thing to get one out.</div>' +
    '<p class="hw-readable"><b>THE ORDERING, in two clauses</b> (Rules E.5.1/1 and E.5.1/2).</p>' +
    '<div class="gbemu-rule" id="gbr-E-5-1-1"><b>Rule E.5.1/1.</b> Within one dot of the draw block, ' +
    '<b>the object test is made BEFORE the dot&rsquo;s pixel is popped, and to its exclusion</b>: ' +
    'a dot on which an object is due takes no pixel out of the background queue at all, whether the object waits or starts its fetch on that dot. So ' +
    '<b>the notice dot (the first dot on which the object test finds the object due) is itself one of the dots its stall costs</b>.</div>' +
    '<div class="gbemu-rule" id="gbr-E-5-1-2"><b>Rule E.5.1/2.</b> ' +
    '<b>The pop is not the output</b>: the pixel a dot pops reaches the screen at the output ' +
    'stage (step 5) of the <em>following</em> dot, because the output stage runs before the mode block and ' +
    'therefore carries the previous dot&rsquo;s pop. The one dot between them is structural: it ' +
    'is the stage order in the list above, not a pipeline depth.</div>' +
    '<p class="hw-readable">The opening of an ordinary line on the shipped core at <code>SCX&nbsp;=&nbsp;0</code>, with Rules E.5.1/1 and E.5.1/2 together. All of these hold at once.</p>' +
    '<table class="gbemu-table"><thead><tr><th>Dot (event scale, from the line&rsquo;s dot 0, <code>SCX&nbsp;=&nbsp;0</code>)</th><th>What happens on it</th></tr></thead><tbody>' +
      '<tr><td>84</td><td>Mode 3 entered; the priming fetch starts</td></tr>' +
      '<tr><td>84&ndash;89</td><td>The priming fetch</td></tr>' +
      '<tr><td>89</td><td>The priming fetch&rsquo;s last dot: the fine scroll is latched, and the first real fetch begins</td></tr>' +
      '<tr><td>90&ndash;95</td><td>The first real fetch&rsquo;s three data steps</td></tr>' +
      '<tr><td>96 and 97</td><td>The first real fetch&rsquo;s push step (pos 6 and pos 7), executing on 97</td></tr>' +
      '<tr><td>97</td><td>The first pop</td></tr>' +
      '<tr><td>98</td><td>The first frame-buffer write (the first pixel reaches the screen)</td></tr>' +
      '<tr><td>256</td><td>The last pop (the line&rsquo;s last visible pixel leaves the queue)</td></tr>' +
      '<tr><td>257</td><td>The last frame-buffer write</td></tr>' +
    '</tbody></table>' +
    '<div class="gbemu-example"><b>Example.</b> The step an implementer is most ' +
    'likely to drop is the push: the six-dot fetch is the three <em>data</em> steps, and the push ' +
    'is a fourth step occupying pos 6 and pos 7 and taking effect on pos 7. Drop it and the first ' +
    'pop lands on 96 and the whole line is one dot early.</div>' +
    '<div class="gbemu-rule" id="gbr-E-5-1-3"><b>Rule E.5.1/3.</b> The scale table at the head of this appendix gives ' +
    '&ldquo;the line&rsquo;s first visible pixel <em>leaves</em>&rdquo; at <b>97</b>, and its last ' +
    'at <b>256</b>: these are <b>POP dots</b>. On the shipped core the corresponding frame-buffer writes ' +
    'are <b>98</b> and <b>257</b>. <b>This one-dot separation is not <code>OUT_PIPE</code>.</b> E.1.2 ships ' +
    '<code>OUT_PIPE = 0</code>; <code>OUT_PIPE</code> counts dots ' +
    '<em>on top of</em> the structural dot of Rule E.5.1/2. A build that sets a pipeline of 1 to reproduce the separation ' +
    'has it twice.</div>' +
    '<div class="gbemu-why"><b>Why.</b> A reader may reasonably take <code>OUT_PIPE = 0</code> to mean the queue and the ' +
    'screen are the same dot; they are not. <b>MECHANISM, and INSTRUMENT-MEASURED on the ' +
    'shipped core</b> by <code>test/objphase.py</code> and <code>test/openphase.py</code>, which ' +
    'record the fetcher&rsquo;s phase at the notice dot and the frame-buffer write inside the ' +
    'output stage itself. <b>Falsifier for Rule E.5.1/1:</b> the output position advancing across the dot an ' +
    'object is first noticed on, at any alignment. <b>Falsifier for Rule E.5.1/2:</b> the first frame-buffer ' +
    'write of a line landing on the same dot as the line&rsquo;s first pop.</div>' +
    '<div class="gbemu-why"><b>Why (what Rule E.5.1/1 settles, and what it does NOT).</b> It is why the ' +
    'ladder&rsquo;s worst cell is <b>11</b> and not 10: residue 0 loses <em>five</em> dots of ' +
    'output, the notice dot included. Measured on the shipped core at every alignment, ' +
    '<code>lx</code> does not advance across the notice dot at any of the eight. <b>But it does ' +
    'not move the window.</b> It is tempting to reason that testing before the pop must also ' +
    'notice the object one dot earlier against the fetcher, and to shift the stall window to the ' +
    'suffix <code>{5,6,7}</code> to compensate. <b>That step is wrong.</b> Where the pop sits ' +
    'inside a dot does not move the fetcher&rsquo;s phase at the notice dot: the notice dot ' +
    'is fixed by the object&rsquo;s position and the fetcher&rsquo;s own cycle, and the pop is ' +
    'downstream of both. Measured on the shipped core, which tests before the pop: <b>residue r is ' +
    'noticed at <code>pos = (r &minus; 1) mod 8</code>, residue 0 on the push dot pos 7, and the ' +
    'window is <code>{4,5,6}</code></b> (the same window E.3 derives from silicon, on this ' +
    'same ordering). <b>Test-before-pop and <code>{4,5,6}</code> are the pair that holds together; ' +
    'they are not alternatives.</b></div>' +
    '<div class="gbemu-why"><b>Why (what Rule E.5.1/2 settles).</b> The opening-of-line anchors are simultaneously ' +
    'satisfiable, and they are only unsatisfiable in a core that collapses the pop and the output ' +
    'into one stage. Read against a 6 + 6 opening, the scale table&rsquo;s 84, 89, ' +
    '90&ndash;96 and 97 look as though they cannot all hold, and the arm that resolves the ' +
    'apparent conflict gives a <b>172-dot mode 3</b> and a one-dot displacement of every line ' +
    'that no ordinary instrument can see. The table above is measured on the shipped core at <code>SCX&nbsp;=&nbsp;0</code>.</div>' +

    '<h4 class="gbemu-sub">E.6: The two constants section 22 describes and never names</h4>' +
    '<div class="gbemu-why"><b>Why.</b> Section 22 tells the story of both of these rows and gives neither ' +
    'quantity a name an implementer can carry. Here they are, named, labelled, and with the falsifier ' +
    'attached to the one that has no derivation.</div>' +

    '<div class="gbemu-rule" id="gbr-E-6-1"><b>Rule E.6/1. <code>VB_MODE_DOT</code> = 6, a literal.</b> On the original, the mode-1 status interrupt ' +
    '<em>source</em> and the vertical-blank interrupt are two separate signals. Of the five things line 144&rsquo;s entry does, <b>only one belongs later: the ' +
    'mode-1 status source</b>, which rises on line 144, dot 6 (event scale; a dispatch test first sees it on access-scale dot 7). <b>The other four components stay on line 144, dot 0</b>, the vertical-blank interrupt among them. ' +
    'This placement is a monochrome answer, guarded as one in our source (device scope below).</div>' +
    '<div class="gbemu-why"><b>Why.</b> Label: FITTED, a ' +
    'placement inside the band both cartridges allow, not a derivation. Read from source (<code>VB_MODE_DOT</code>, ' +
    '<code>LINE0_DISPATCH_LAG</code>). The reason for dot 6 is the look of a running processor at the start ' +
    'of each line (D.10.1): with the look, a running processor sees a line-start request one machine cycle sooner than without it; the AGE test ' +
    '<code>stat-int</code> (its author&rsquo;s hardware table, a running processor) wants the mode-1 source on dot 6 for ' +
    'its mode-1 rows, 7 fails them, and Mooneye&rsquo;s <code>intr_1_2_timing-GS</code> passes at 6. ' +
    'The four other components stay at dot 0 ' +
    'because <code>vblank_stat_intr-GS</code> measures the vertical-blank interrupt against line ' +
    '144&rsquo;s scan source and declares them simultaneous. <b>Cost across the whole protected set: ' +
    'zero</b>: monochrome mealybug 24/24 at 0 px, colour mealybug byte-identical per cell, ' +
    'both acid cartridges unmoved, the 252-probe mode-3 table identical at every probe, 572 ' +
    'reference frames byte-identical, Blargg unchanged, and the 264-row board diffed per row with ' +
    'exactly one row moving. <b>Device scope, stated because it is a real limit:</b> the ' +
    'cartridge&rsquo;s own header records PASS on DMG/MGB/SGB and FAIL on CGB/AGB/AGS, so the ' +
    'interval is not 4,560 dots on colour hardware.</div>' +
    '<p class="hw-readable">The band, measured without the look (42 builds, dots 0 to 13 at each of three dispatch ' +
    'lags). These rows do not give where the band sits on the shipped core, which has the look; they give its width and how it moves with the lag.</p>' +
    '<table class="gbemu-table"><thead><tr><th>Dispatch lag (dots)</th><th>Values of <code>VB_MODE_DOT</code> that PASS (line 144, event scale, from dot 0)</th><th>Every other value from 0 to 13</th></tr></thead><tbody>' +
      '<tr><td>0</td><td>1, 2, 3, 4</td><td>FAIL</td></tr>' +
      '<tr><td>4</td><td>5, 6, 7, 8</td><td>FAIL</td></tr>' +
      '<tr><td>8</td><td>9, 10, 11, 12</td><td>FAIL</td></tr>' +
    '</tbody></table>' +
    '<div class="gbemu-why"><b>Why.</b> <b>The passing band is exactly four dots wide and its first dot is ' +
    'always <code>dispatch_lag + 1</code>.</b> Four dots is the processor&rsquo;s dispatch-sample ' +
    'quantum: any rise inside one machine cycle is seen at the same sample.</div>' +

    '<div class="gbemu-rule" id="gbr-E-6-2"><b>Rule E.6/2. The line-0 hold, 3 dots.</b> ' +
    'On line 0 only, a rising edge of the status interrupt line sets its request bit exactly as on every other line, ' +
    'but if that bit was clear before the edge, the bit is <b>withheld from the dispatch test for 3 dots</b> after it rises: a hold counter is set to 3 on the dot the edge rises and decremented at the head of each later dot (E.5, step 2), and the dispatch test, made between dots on the access scale, sees the bit only once the counter reads 0. Nothing ' +
    'else is delayed: the source still rises where it rises (the mode-2 source at dot 2 on lines 1 to 143 and at dot 3 ' +
    'on line 0), the request bit still reads set, and only the processor&rsquo;s decision to take the interrupt ' +
    'is one sample later. A request bit that was already set when the edge came is not held. This is the only place the line-0 hold is named.</div>' +
    '<div class="gbemu-example"><b>Example.</b> Line 0, mode-2 source selected, status line low before: the mode-2 source rises on dot 3 (event scale) and the request bit reads set from access-scale dot 4. A dispatch test on access-scale dot 4, 5 or 6 does not see the request; one on dot 7 does. Without the hold the first dispatch test to see it would be on dot 4.</div>' +
    '<div class="gbemu-why"><b>Why.</b> A hold of 4 dots (one machine cycle) hides the raise from the sample of the look (D.10.1), and a halted sample cannot ' +
    'tell 3 from 4. That a request bit already set is not held is read from our source (<code>IRQ_HOLD_FRESH_ONLY</code>).</div>' +

    '<p class="hw-readable"><b>The mode-0 report on the original.</b> Rules E.6/3 to E.6/6 and the table below them give, for each dot of mode 3, whether STAT&rsquo;s reported mode becomes 0 on that dot and whether the mode-0 interrupt source rises on it. The Colour has its own timing: there the timing block sets both the report and the source instead (the Colour tab, section 10), using the same quantity <b>object dots still owed</b> of Rule E.6/4. The power-on line has its own report (E.2, section 14).</p>' +
    '<div class="gbemu-rule" id="gbr-E-6-3"><b>Rule E.6/3. Which kind of line.</b> Classify each line by these three cases, which do not overlap: ' +
    '<b>(A)</b> the scan selected no object for the line; ' +
    '<b>(B)</b> an object fetch has started on this line: from the <b>first dot of the line&rsquo;s first object fetch</b> (the dot on which that fetch begins, a clipped object included) to the end of the line, <em>including every dot while that first fetch is still running</em>, not only once it has completed; ' +
    '<b>(C)</b> the scan selected objects but no object fetch has started yet on this line (all off-screen to the right, or objects disabled before any fetch). ' +
    'A line can move from (C) to (B) mid-line, on the first dot of its first object fetch. Before the line&rsquo;s first object fetch begins, the dots on which an object found due waits for the phase window (E.5, step 6(d)) are not fetch dots: the line is still in (C) on them.</div>' +
    '<div class="gbemu-rule" id="gbr-E-6-4"><b>Rule E.6/4. The two counts.</b> On every dot of mode 3, after that dot&rsquo;s pop (E.5, step 6(g)): ' +
    '<b>pixels still to leave</b> = 160 minus the pixels popped so far on this line, this dot&rsquo;s pop included (not the pixels written to the screen, which lag one dot, Rule E.5.1/2). ' +
    '<b>Object dots still owed</b> = the dots the object fetch in progress still needs after this dot: 6 minus the dots of that fetch processed so far, the fetch&rsquo;s first dot counting as the first, and minus any dots the position hold took off it (Rule E.5/9); or 0 when no object fetch is in progress. The count does not include the floor of Rule E.3.1/3 (no object fetch ends before line dot 100): a fetch the floor lengthens ends by dot 100, when far more than 3 pixels are still to leave, so the floor can never change a report. Rule E.6/5 can block the report instead.</div>' +
    '<div class="gbemu-rule" id="gbr-E-6-5"><b>Rule E.6/5. The block, not a count.</b> On a line of case (B), while object enable reads set at its outstanding-work consumer (tag 8 of E.9), the report does not fire on this dot at all if any <em>other</em> selected object that has not been fetched yet has its column at or to the right of the current output position and left of column 160. An object&rsquo;s column is OAM X&nbsp;&minus;&nbsp;8, taken as 0 when that is negative (a clipped object counts as column 0). &ldquo;Not fetched yet&rdquo; includes an object that is waiting for the phase window and has not started its fetch. <b>The object whose fetch is in progress never blocks</b>: it is counted by object dots still owed (Rule E.6/4). An object counts as fetched from its fetch&rsquo;s last dot; until then it is either &ldquo;in progress&rdquo; (counted, never blocking) or not started (blocking). With object enable reading clear at tag 8 (in dots, a set write is seen from C and a clear from C &minus; 1, E.9.1&rsquo;s table), the block is skipped and only the fetch in progress counts.</div>' +
    '<div class="gbemu-rule" id="gbr-E-6-6"><b>Rule E.6/6. The report, case by case</b> (the shipped core, on the original). Each change is made on the first dot on which its condition holds. The constants: <code>OBJ_M0_LEAD</code> = 3 (case B), <code>M0_LEAD_DMG</code> = 3 (case A), <code>WIN_HELD_EXTRA</code> = 1 (case A with the window at WX 1 to 7), <code>WIN_TAIL_HOLD</code> on (case A with a window at WX 164 or 165).</div>' +
    '<table class="gbemu-table"><thead><tr><th>Kind of line (Rule E.6/3)</th><th>STAT reports mode 0 on the first dot (event scale) on which</th><th>The mode-0 source rises on</th></tr></thead><tbody>' +
      '<tr><td>(A) The scan selected no object</td><td>pixels still to leave &le; 3; &le; 2 when, on that dot, the window is active and the WX register reads 1 to 7 (the live register, not the WX matched at the takeover: Rule E.8.1/5); held back while a window at WX 164 or 165 is still to start (E.8.1). Video and sprite memory reopen on the same dot as the report.</td><td>the dot of the last pixel&rsquo;s pop (pixels still to leave 0): the two separate by three dots</td></tr>' +
      '<tr><td>(B) <b>An object fetch has started on this line</b>: from the first dot of the line&rsquo;s first object fetch, <em>including while that first fetch is still running</em>, not only once it has completed</td><td>pixels still to leave + object dots still owed &le; 3, and no object blocks (Rule E.6/5). Memory writes reopen on this dot; memory reads only when the live mode has also left 3 (Rule 14/2).</td><td>the same dot as the report</td></tr>' +
      '<tr><td>(C) Objects were selected but no object fetch has started yet (all off-screen to the right, or objects disabled before any fetch)</td><td colspan="2">the dot of the last pixel&rsquo;s pop, both together (no lead; Mooneye <code>intr_2_mode0_timing_sprites</code> fails with one). These lines are exact and must not move.</td></tr>' +
    '</tbody></table>' +
    '<p class="hw-readable"><b>The power-on line</b> (E.2) has its own report for case A (two dots after its last pixel, section 14) and no early memory release. Its mode-0 <em>source</em> follows this table&rsquo;s source column by case, and a case-B line (an object fetch started, from the scan of E.2) takes case B&rsquo;s report and source too: the lead is not switched off on that line. Read from our source (<code>OBJ_M0_LEAD</code> has no power-on-line condition; the object-free leads have one).</p>' +
    '<div class="gbemu-example"><b>Example (case A).</b> <code>SCX&nbsp;=&nbsp;0</code>, no objects, no window: pops run from dot 97 to dot 256. After dot 253&rsquo;s pop 157 pixels are popped, so 3 are still to leave: STAT reports mode 0 on dot 253 (a read first sees it on access-scale dot 254). The mode-0 source rises on dot 256, with the 160th pop. With the window started at WX 1 to 7 the report waits for 2 still to leave.</div>' +
    '<div class="gbemu-example"><b>Example (case B, the misreads ruled out).</b> Object A at OAM X = 166 (column 158) is the line&rsquo;s first fetched object; the line&rsquo;s 158th pixel was popped before A&rsquo;s fetch begins on dot n, so pixels still to leave stay at 2 throughout (no pop on fetch dots, step 6(a)). No position-hold dots are credited to A.</div>' +
    '<table class="gbemu-table"><thead><tr><th>Dot (event scale; n = first dot of A&rsquo;s fetch)</th><th>Dots of A&rsquo;s fetch processed</th><th>Object dots still owed</th><th>Pixels still to leave</th><th>Sum</th><th>Report?</th></tr></thead><tbody>' +
      '<tr><td>n</td><td>1</td><td>5</td><td>2</td><td>7</td><td>no</td></tr>' +
      '<tr><td>n + 1</td><td>2</td><td>4</td><td>2</td><td>6</td><td>no</td></tr>' +
      '<tr><td>n + 2</td><td>3</td><td>3</td><td>2</td><td>5</td><td>no</td></tr>' +
      '<tr><td>n + 3</td><td>4</td><td>2</td><td>2</td><td>4</td><td>no</td></tr>' +
      '<tr><td>n + 4</td><td>5</td><td>1</td><td>2</td><td>3</td><td><b>yes</b>: mode 0 reported and the mode-0 source rises</td></tr>' +
    '</tbody></table>' +
    '<p class="hw-readable">The report fires on dot n&nbsp;+&nbsp;4, while A&rsquo;s fetch is still running (its last dot is n&nbsp;+&nbsp;5). A build that starts case (B) only once the first fetch has completed, or that lets A block its own report, cannot fire on n&nbsp;+&nbsp;4. Now add object B at OAM X = 167 (column 159), selected and not yet fetched: on every dot above B&rsquo;s column 159 is at or right of output position 158 and left of 160, so B blocks the report on every one of those dots, n&nbsp;+&nbsp;4 included, until B&rsquo;s own fetch begins; from then B is the fetch in progress and is counted, not blocking. A never blocks.</p>' +
    '<div class="gbemu-why"><b>Why.</b> MECHANISM for the cases, read from our source (<code>OBJ_M0_LEAD</code> 3, <code>M0_LEAD_DMG</code> 3, <code>WIN_HELD_EXTRA</code> 1, <code>WIN_TAIL_HOLD</code>, <code>obj_dots_owed</code>); the leads themselves keep the labels given in Rules E.6/7 and E.6/8. Case A&rsquo;s lead is FITTED, to the AGE tests <code>stat-mode</code>, <code>vram-read</code> and <code>oam-read</code> on the DMG (constant <code>M0_LEAD_DMG</code>). E.8.1 has two refinements of that lead (a window at WX 1 to 7, and a window that starts in the last pixels). On a line of case (B) the report and the source are one event in our core on the original. In the block, an object that has not started is past any lead, so our source code returns a value too large to pass (999) rather than a count; counting a blocking object as six owed dots is a different rule. The sentence &ldquo;the status register reports mode 0 three dots before the line&rsquo;s last pixel has left&rdquo;, and the Color tab&rsquo;s paraphrase of it, are not enough to pass <code>intr_2_mode0_timing_sprites</code>: implemented from them alone, the cartridge can stop at testcase #0A (ten objects at OAM X&nbsp;=&nbsp;1). <b>A board row depends on the table exactly.</b> Mooneye&rsquo;s <code>intr_2_mode0_timing_sprites</code> passes on our core and fails with the case-(B) lead at 0, 2 or 4 instead of 3; without E.3.1&rsquo;s clipped-object rule (begin 89 + X, end at least 100); <b>when case (B) is taken to start only once the first object fetch has completed</b> (a copy of our core changed in exactly that one place fails the row); and <b>when the object being fetched is allowed to block its own report</b> (an independent build that let the in-progress object block failed the row, and the same build with only that changed passes it). The row&rsquo;s failure always shows as 77 differing checkpoints whatever the cause, so that number does not single out a cause. It does not move with the running look, the object-free lead, the parked-fetcher rule, the position hold or the hidden-object wait.</div>' +

    '<div class="gbemu-rule" id="gbr-E-6-7"><b>Rule E.6/7. <code>OBJ_M0_LEAD</code>: what it changes.</b> On a line of case (B), the lead writes the reported mode, the interrupt-logic mode and ' +
    'the status line, <b>and nothing else</b>: no internal mode, no mode-0 flag, so it moves ' +
    'no fetcher dot, no stall length, no push, no queue state and no horizontal-blank transfer. ' +
    '<b>Memory blocking moves only where it reads the reported mode</b> (Rule 14/2): the write blocks, which follow the reported mode, lift with the early report; the read blocks lift only when the live mode has also left 3. It is conditioned <b>once per line</b> (by Rule E.6/3&rsquo;s case), not per object and not per run.</div>' +
    '<div class="gbemu-why"><b>Why.</b> <b><code>OBJ_M0_LEAD</code> = 3 on the original and 2 on the Color: FITTED.</b> The number is three dots on the original, ' +
    'chosen because it scores, and it cannot be re-derived. The ten-objects family ' +
    'refutes a per-object scaling, and the ten-runs family refutes a per-run one.</div>' +

    '<div class="gbemu-rule" id="gbr-E-6-8"><b>Rule E.6/8. The lead&rsquo;s value.</b> The case-(B) lead (the 3 in the table) is <b>3 on the original</b> and <b>2 on the Color</b> (<code>OBJ_M0_LEAD_CGB</code>), the Color&rsquo;s 2 at both speeds. ' +
    'In general, on a line with objects the report must land on dot W&nbsp;+&nbsp;c (event scale), where c is the dots the line&rsquo;s objects added to mode 3 and W is the first dot of the processor&rsquo;s sample window that holds the same line&rsquo;s last-pixel dot without objects. For a build whose processor samples at a different phase: <b>your lead is 3 minus the number of dots from the dot your object-free line pops its last pixel to the next dot after which your processor samples.</b></div>' +
    '<div class="gbemu-example"><b>Example.</b> Our original: every processor access after a display switch-on sees the picture state after a line dot of the form 4k on this appendix&rsquo;s scale (its machine cycle ticked dots 4k&nbsp;&minus;&nbsp;3 to 4k). An object-free line at <code>SCX&nbsp;=&nbsp;0</code> pops its last pixel on dot 256, the last dot of the sample window 253 to 256; W is 253, the processor samples right after dot 256 (0 dots on), and the lead is 256&nbsp;&minus;&nbsp;253&nbsp;=&nbsp;3. Our Color samples after dots 4k&nbsp;+&nbsp;1 (the Color tab, section 10): from dot 256 the next sample is after dot 257, 1 dot on, so its lead is 3&nbsp;&minus;&nbsp;1&nbsp;=&nbsp;2. A build whose processor sees the line one dot later than ours needs 2.</div>' +
    '<div class="gbemu-why"><b>Why 3, and why a correct build may need another number.</b> The cartridge pins the report to the dot against the processor&rsquo;s sampling. Instrumented on the shipped core (line 68 of every one of its 105 testcases, the dot of each STAT read in both rounds and the dot of the report): across the testcases the report falls on each of the four dots of the four-dot window between the read that still sees mode 3 and the read that sees mode 0, on the first dot in 42 testcases, the second in 14, the third in 32 and the fourth in 17. So the cartridge has no slack at all: on our original a report one dot later fails testcase #00 first and one dot earlier fails #0A first. On the Color at 3 the cartridge fails at testcase #0A; at 2 it passes all 105 testcases, with or without the boot program, and 0, 1, 4 and 5 fail at #00, #00, #01 and #01. INSTRUMENT-MEASURED. The lead is a phase, not a property of objects: the one-dot difference is MECHANISM (the measured phase), the 3 it is applied to is FITTED, so the Color&rsquo;s 2 is FITTED by inheritance. Double speed uses the same 2, and nothing we hold reaches it (NOT ESTABLISHED).</div>' +
    '<div class="gbemu-why"><b>Why (the unlocking insight, and it is the transferable part).</b> The ' +
    'picture unit leaves mode 3 when the fetcher finishes; the status register reports mode 0 when ' +
    'the last pixel has left. <b>Two observables imply two events, therefore two sites.</b> Both ' +
    'sites produce the same three dots and both close the cartridge (the optimum is sharp and ' +
    'identical at both, failures <code>61 &rarr; 47 &rarr; 15 &rarr; 0 &rarr; 42</code> for N = 0 to ' +
    '4), <b>so the magnitude is pinned by the cartridge and not by the site. The site decides ' +
    'the price:</b> shortening the line&rsquo;s first object fetch by three dots costs ' +
    '<b>0 px &rarr; 13,066 px across 13 of 24 mealybug cells</b>, because it moves the ' +
    'fetcher&rsquo;s dots and every pixel after the line&rsquo;s first object moves with them; ' +
    'correcting the <em>report</em> costs <b>0 px, 24/24, byte-identical</b>. Two further sites are ' +
    'refuted on arithmetic: each reaches only ' +
    'OAM X &lt; 8, so neither can move the single-object cells at X = 13 that the cartridge ' +
    'fails.</div>' +
    '<div class="gbemu-why"><b>Why (a blindness, stated so it is not mistaken for a pass).</b> Our 252-probe ' +
    'mode-3 table reads <em>both</em> its columns off the internal mode, which this lead does ' +
    'not touch. <b>&ldquo;The table is unmoved&rdquo; is a statement about the table&rsquo;s reach, ' +
    'not evidence that the knob is inert.</b> The instruments that see this axis are the cartridge ' +
    'itself and our object-ladder gate; both move with this constant. <b>Registered falsifier:</b> ' +
    'if a later structure makes the object pipeline three dots shorter <em>on the pixels</em> while ' +
    'the mealybug board holds, then this constant is describing a lag that was really a length, and ' +
    'it must go to 0 in the same ship. <b>What would earn MECHANISM:</b> a device or a document ' +
    'pinning the dot the status register&rsquo;s mode bits fall, relative to the last pixel of a ' +
    'line whose shifter was interrupted by an object.</div>' +

    '<h4 class="gbemu-sub">E.7: What this appendix deliberately does not claim</h4>' +
    '<ul class="gbemu-bullets">' +
      '<li><b>The processor-side write phase for the interrupt-flag and coincidence registers.</b> ' +
        'Both ship one dot late on a stated analogy to each other, and the analogy is itself ' +
        'unpinned. Our corpus&rsquo;s passing window is eleven dots wide. <b>NOT ESTABLISHED</b>, ' +
        'and what would decide it is anything at all.</li>' +
      '<li><b>The mode-3 offset on the power-on line</b> (E.2). Under-determined to one machine ' +
        'cycle. <b>NOT ESTABLISHED.</b></li>' +
      '<li><b>The magnitude of the 6-dot access close</b> (E.1.5). A bare constant with an ' +
        'anti-sweep tripwire and no account at its site.</li>' +
      '<li><b>The flat 6-dot object fetch.</b> Photographed by nobody. What would decide it is a ' +
        'silicon reading at a <em>stacked</em> geometry: every tier-1 object reading we hold ' +
        'measures the <em>first</em> object of a run and none measures a later one.</li>' +
      '<li><b>The object window&rsquo;s position, unconditionally.</b> Every tier-1 object reading ' +
        'sits at <code>X &equiv; 0 (mod 8)</code>, the one residue that says where the window ' +
        '<em>ends</em> and nothing about where it <em>sits</em>. <b>One cartridge stepping a single ' +
        'object across X = 0 to 23 at two SCX values would settle the position, the flat 6 and the ' +
        'SCX term together.</b> That is the highest-value unbuilt instrument we know of.</li>' +
      '<li><b>Whether the object path is read earlier in the dot than the background path</b> ' +
        '(E.5, Rule E.5/11). Designed instrument, not built.</li>' +
      '<li><b>Every colour-hardware magnitude in this appendix.</b> The <em>direction</em> of the ' +
        'monochrome/colour split is documented; <b>no published source gives a number</b>, and every ' +
        'colour value here was selected against stored renders. They are ' +
        '<b>FITTED-TO-STORED-RENDER</b> and must never be quoted as hardware.</li>' +
    '</ul>' +

    '<h4 class="gbemu-sub">E.8: The window-takeover comparator, as one expression</h4>' +
    '<p class="hw-readable"><b>Scale and terms in E.8 and E.9.</b> Every dot number in E.8 and E.9 is a dot of the line, counted from the line&rsquo;s dot 0, on the <b>event scale</b> at the head of this appendix (&ldquo;X happens on dot D&rdquo;: X happens while the picture processor processes dot D), unless a sentence says <b>first-seen dot</b> (the dot from which a processor read sees the change, D&nbsp;+&nbsp;1). <code>N</code> is the first dot covered by the machine cycle that carries the processor&rsquo;s write (E.1.1). <code>s</code> is SCX&nbsp;&amp;&nbsp;7. Three different counts are used and never mixed: the <b>position counter</b> <code>win_px</code> (Rule E.8.4/1); the <b>output position</b>, the count of pixels already output on the line, which is the screen column (<code>lx</code> in our source; not E.3.1&rsquo;s clipped-object position); and the <b>fetcher position</b> <code>pos</code> (step&nbsp;&times;&nbsp;2&nbsp;+&nbsp;sub-dot, section 9&rsquo;s numbering, counted from the fetcher&rsquo;s last restart; it does not advance on object-stall dots).</p>' +
    '<div class="gbemu-why"><b>Why.</b> This page describes the takeover in three fragments that do not ' +
    'compose. Section 11 gives the counter and its seven priming increments; it gives the ' +
    'one-dot correction and the signed operand separately, four paragraphs apart; E.1 gives WX its ' +
    'own lead and E.1.3 gives window-enable its own settling. An implementer holding all three cannot ' +
    'write the comparison down. Here it is as one expression, with each term carrying the ' +
    'section it comes from.</div>' +

    '<div class="gbemu-rule" id="gbr-E-8-1"><b>Rule E.8/1.</b> On a dot on which the pixel pipeline runs (internal mode 3, and after the internal end until the 160th pixel is popped: Rule 7/4), the window must take over (the background queue is cleared and the fetcher restarts on the window) if and only if all four terms of the block below hold on that dot. Two further rules can stop a takeover on a dot where all four hold: the closed comparator of a line primed by a write (Rule E.8.1/2) and the postponement of a match on the first dot window enable returns (Rule E.8.3/3).</div>' +
    '<div class="gbemu-pre">takeover on this dot  iff\n' +
    '      window_enable  (LCDC bit 5, at its settling -- E.1.3, Rule E.9/4)\n' +
    '  AND wy_condition   (frame-scoped, latched on any line where WY == LY,\n' +
    '                      cleared at vertical blank -- section 11)\n' +
    '  AND NOT win_active (a takeover already in force on this line)\n' +
    '  AND (win_px - priming_bump) == WX_cmp      (SIGNED arithmetic, Rule E.8/2)\n' +
    '\n' +
    'where WX_cmp is the HELD WX, not the live register (Rule E.8/3):\n' +
    '      WX_cmp = wx_old   if the WX hold is in force on this dot\n' +
    '                        AND wx_old &gt;= 7\n' +
    '             = WX       otherwise      (WX at its +2 lead -- E.1)\n' +
    '\n' +
    '      wx_old      = the value WX held before the in-flight write\n' +
    '      hold        = a counter armed to 2 by the WX write and decremented\n' +
    '                    at the head of each dot; the hold is in force on a\n' +
    '                    dot when the counter is not 0 after that decrement:\n' +
    '                    exactly one dot, the first dot on which the register\n' +
    '                    holds the new WX (E.5\'s counter rule: arm to two to\n' +
    '                    hold for one dot after the write)\n' +
    '\n' +
    'and priming_bump is 1 ONLY on a line primed by a write (E.8.1), while the seven priming increments are\n' +
    '      running and this dot\'s own increment has already landed;\n' +
    '      0 on every other dot, and on every dot of an unprimed line (Rule E.8/4).\n' +
    '\n' +
    'and win_px is the per-line position counter (Rule E.8.4/1) that\n' +
    '      starts at 0 on the first dot of mode 3 (dot 84),\n' +
    '      takes its seven priming increments from the 7th dot of mode 3 on which\n' +
    '      no object fetch is in progress (dots 90 to 96 with no object;\n' +
    '      Rule E.8.4/1 gives the pauses and the hand-back),\n' +
    '      increments once per pixel popped, column dropped and pixel inserted thereafter,\n' +
    '  and DOES NOT increment on a fine-scroll discard pop.</div>' +

    '<div class="gbemu-rule" id="gbr-E-8-2"><b>Rule E.8/2.</b> The comparison <code>(win_px &minus; priming_bump) == WX_cmp</code> must be evaluated in signed arithmetic, so that an operand of &minus;1 equals no value of WX.</div>' +
    '<div class="gbemu-example"><b>Example.</b> A build that subtracts the bump at a counter of 0 forms 0&nbsp;&minus;&nbsp;1&nbsp;=&nbsp;&minus;1. Signed, &minus;1 matches no WX from 0 to 255 and no takeover happens on that dot. Evaluated in 8 bits unsigned, &minus;1 wraps to 255. On our core the operand never reaches &minus;1 (Rule E.8.1/2 keeps the comparator closed on a primed line until the counter has moved).</div>' +
    '<div class="gbemu-why"><b>Why.</b> The <b>priming bump</b> is the one-dot correction for a counter that has already advanced on this dot, defined once, in Rule E.8/4. On our core it never meets a counter of 0, because a primed line keeps the comparator closed until the counter has moved, so the operand never reaches &minus;1. A build that does subtract at counter 0 must keep the comparison signed: <b>evaluated unsigned, &minus;1 wraps to 255, which gets the takeover position wrong at small WX and nowhere else.</b></div>' +

    '<div class="gbemu-rule" id="gbr-E-8-3"><b>Rule E.8/3.</b> The comparator must compare against the held WX, <code>WX_cmp</code>, never the live register alone. A write to WX saves the value WX held before it as <code>wx_old</code> and arms the hold counter to 2. Then, on each dot:' +
    '<ol class="gbemu-steps">' +
      '<li>At the head of the dot, before any consumer reads, the hold counter decreases by 1 if it is not 0.</li>' +
      '<li>If the counter is now not 0, the hold is in force on this dot. This is exactly one dot: the first dot on which the register holds the new WX.</li>' +
      '<li>The comparator uses <code>wx_old</code> on this dot if the hold is in force <b>and</b> <code>wx_old</code> is 7 or more. In every other case (no hold, or <code>wx_old</code> from 0 to 6) it uses the register.</li>' +
    '</ol>' +
    'The resulting dots, with <code>N</code> the first dot of the WX write&rsquo;s machine cycle:</div>' +
    '<table class="gbemu-table"><thead><tr><th>Machine</th><th>Register holds the new WX from (dot, from N)</th><th>Hold dot: the comparator still uses the pre-write WX if it is 7 or more (dot, from N)</th><th>Comparator uses the new WX from, pre-write WX 7 or more (dot, from N)</th><th>Comparator uses the new WX from, pre-write WX 0 to 6 (dot, from N)</th></tr></thead><tbody>' +
      '<tr><td>Colour, single speed</td><td>N&nbsp;+&nbsp;2</td><td>N&nbsp;+&nbsp;2</td><td>N&nbsp;+&nbsp;3</td><td>N&nbsp;+&nbsp;2 (no hold)</td></tr>' +
      '<tr><td>Original, display on (the extra machine cycle of E.1)</td><td>N&nbsp;+&nbsp;6</td><td>N&nbsp;+&nbsp;6</td><td>N&nbsp;+&nbsp;7</td><td>N&nbsp;+&nbsp;6 (no hold)</td></tr>' +
      '<tr><td>Colour, double speed</td><td>N</td><td>N</td><td>N&nbsp;+&nbsp;1</td><td>N (no hold)</td></tr>' +
    '</tbody></table>' +
    '<div class="gbemu-example"><b>Example.</b> Colour at single speed, a write of WX&nbsp;=&nbsp;30 over WX&nbsp;=&nbsp;20 whose machine cycle covers dots 100 to 103 (N&nbsp;=&nbsp;100). The register reads 30 from dot 102. The hold counter is armed to 2 by the write; at the head of dot 102 it falls to 1, so the hold is in force on 102 and the comparator compares against 20 there; at the head of dot 103 it falls to 0, and from 103 the comparator compares against 30. If <code>win_px&nbsp;&minus;&nbsp;priming_bump</code> is 20 on dot 102, the window takes over on 102 at the old value. The same write over WX&nbsp;=&nbsp;5 has no hold: the comparator compares against 30 from dot 102. On the original with the display on, the same write cycle gives 106, 106 and 107. The counter is armed to 2, but the hold is in force on one dot only, because the first decrement comes at the head of the first dot after the write.</div>' +
    '<div class="gbemu-why"><b>Why.</b> E.1.1&rsquo;s WX rows give the same dots; build from E.1.1. The original&rsquo;s shape is the Colour&rsquo;s shifted by four dots. A build that delivers WX to its comparator on N&nbsp;+&nbsp;3 (Colour, single speed) has reproduced the lead and the hold together. The window_enable term reads LCDC bit 5 from the last lead dot of an LCDC write at single speed, in both directions (E.1.3). INSTRUMENT-MEASURED.<br>' +
    'Our comparator does ' +
    'not read the live WX. It reads a <b>held</b> WX: a write to WX arms a <b>2-dot hold</b> and the ' +
    'comparison uses the <em>pre-write</em> value for the duration, which is what stops a write ' +
    'landing exactly on the deciding dot from moving the takeover. <b>FITTED</b>, and F.5 says so: ' +
    'the shape is precedented (it is the display-control register&rsquo;s settling model ' +
    'applied to WX), but a precedent is not a derivation, and no ' +
    'hardware statement says WX settles late at this comparator. <b>The relation is the ' +
    'transferable part, not the number: a comparator that fires a dot later needs a dot more of ' +
    'hold.</b> <b>Falsifier:</b> a cartridge that rewrites WX on the deciding dot and takes over at ' +
    'the new value.<br>' +
    '<b>The <code>wx_old &ge; 7</code> guard on that hold</b> is stated here exactly as our record states it, in both halves, because neither half may ' +
    'be quoted without the other. <b>It is load-bearing:</b> without it the hold ' +
    '<em>resurrects</em> the <code>WX &lt; 7</code> trigger this comparator structurally excludes, ' +
    'and manufactures a spurious window at the left edge of the line. <b>Its mechanism is ' +
    'unexplained</b>: nothing in our record accounts for why the hold should apply only above ' +
    '7. And the precision that keeps the first half from being overstated: isolated behind its own ' +
    'knob, the clause is <b>byte-inert</b> with the hold off, and with the hold on it moves 140 rows ' +
    'of which <b>exactly one</b> appears in the comparison against the shipped core, and that ' +
    'one is the fix it was added for. <b>Seven of the 140 differ before the spurious trigger exists ' +
    'at all, so the remainder is not downstream of it and is not accounted for.</b> ' +
    '<b>FITTED, mechanism unexplained.</b> <b>To establish:</b> an account of the 7 that does not ' +
    'appeal to the comparator&rsquo;s own exclusion, or a stimulus separating the two. F.5 calls both the hold and this guard load-bearing.</div>' +

    '<div class="gbemu-rule" id="gbr-E-8-4"><b>Rule E.8/4.</b> <code>priming_bump</code> must be 1 on a dot if and only if all three hold on that dot: the line is primed by a write (Rule E.8.1/1); the seven priming increments of Rule E.8.4/1 are still running; and this dot&rsquo;s own priming increment has already landed. On every other dot, and on every dot of an unprimed line, it is 0. This is the one definition of <code>priming_bump</code>; E.8.1 measures it. The order inside one dot of a primed line, while the increments run:' +
    '<ol class="gbemu-steps">' +
      '<li>The dot&rsquo;s priming increment lands (the counter is bumped at the head of the dot).</li>' +
      '<li>The comparator reads the counter (at the foot of the dot) and subtracts <code>priming_bump</code>&nbsp;=&nbsp;1, so it compares the position the line is <em>about</em> to reach.</li>' +
    '</ol>' +
    'After the seventh increment the counter moves only for pixels popped, columns dropped and pixels inserted, and those increments land after the comparator in the dot, so a comparator reading on a later dot sees an increment made on an earlier dot and subtracts nothing.</div>' +
    '<div class="gbemu-example"><b>Example.</b> A primed line, no object, WX&nbsp;=&nbsp;3. The increments land on dots 90 to 96. On dot 93 the fourth increment lands first, the counter reads 4, and the comparator compares 4&nbsp;&minus;&nbsp;1&nbsp;=&nbsp;3 with WX&nbsp;3: the window takes over on dot 93 (90&nbsp;+&nbsp;WX, Rule E.8.1/2). After the priming: section 11&rsquo;s worked example takes over at <code>win_px&nbsp;==&nbsp;WX&nbsp;==&nbsp;33</code> with nothing subtracted. An unconditional <code>(win_px &minus; 1) == WX</code> would need <code>win_px&nbsp;=&nbsp;34</code> for the same takeover, one pixel right.</div>' +
    '<div class="gbemu-why"><b>Why.</b> The convention this page uses is ' +
    '<code>win_px&nbsp;==&nbsp;WX</code>: the comparator fires on the dot the counter reaches ' +
    'WX, and the subtraction is <em>conditional</em>: it removes this dot&rsquo;s own bump only on a line primed by a write and only while the priming increments are running, because there and only there the counter is ' +
    'bumped at the head of the dot and read at the foot of it, so it reports the position the line ' +
    'is <em>about</em> to reach. After the priming the bump came from the previous dot and there is ' +
    'nothing to subtract. <b>Writing the correction as unconditional moves every post-priming ' +
    'takeover one pixel right</b>, which is the class of error F.6 warns readers about two ' +
    'appendices later. The <b>seven</b> is a process, not a ' +
    'starting value; section 11 shows the two are testable apart. The <b>discard clause</b> (section 11) is written into the counter ' +
    'here rather than into the comparator because <em>that is where it lives</em>: the ' +
    'comparator reading a counter that counted the pops is the whole of the bug.</div>' +

    '<div class="gbemu-rule" id="gbr-E-8-5"><b>Rule E.8/5.</b> The dot on which the seven priming increments begin and the priming bump form a pair: only their combination is observable, so a build that moves one must move the other with it. Whatever split a build chooses, it must keep both of these: the seven increments complete strictly before the dot on which the line&rsquo;s first visible pixel leaves, never on that dot; and the comparison is signed (Rule E.8/2). On the shipped core, on a line with no object, mode 3 is entered on dot 84, the seven increments are on dots 90 to 96 inclusive, and the first visible pixel leaves on dot 97.</div>' +
    '<div class="gbemu-example"><b>Example.</b> &ldquo;6 dots into mode 3&rdquo; is ambiguous by one; it means six dots after the <em>entry dot</em> 84, not after the first drawn dot: 84&nbsp;+&nbsp;6&nbsp;=&nbsp;90, the first increment. Dots 90, 91, 92, 93, 94, 95 and 96 carry the seven; dot 97 carries the first visible pixel and no increment.</div>' +
    '<div class="gbemu-why"><b>Why.</b> Two of the four terms are ours and not the machine&rsquo;s. Start the priming one dot later and you ' +
    'buy a four-pixel fix on one cartridge and roughly nineteen thousand pixels of damage across ' +
    'four others. INSTRUMENT-MEASURED on the ' +
    'shipped core; <b>falsifier:</b> the window position counter taking its seven priming ' +
    'increments on any other seven dots. Whatever split you choose, check it against a cartridge that writes WX in the range 0 ' +
    'to 7. <b>WX&rsquo;s +2 lead is MECHANISM</b> (derived from dot arithmetic before it was ' +
    'measured); <b>window-enable&rsquo;s settling</b> (at single speed a set and a clear both reach the comparator on the last lead dot, C &minus; 2; the clear-only release acts only on a Colour in double speed) is stated in E.1.3. <b>Falsifier for the expression as a whole:</b> any cartridge on which it ' +
    'predicts a takeover dot the instrumented core does not take.</div>' +

    '<h4 class="gbemu-sub">E.8.1: The comparator as the shipped core runs it, and what each WX does to the line</h4>' +
    '<div class="gbemu-why"><b>Why.</b> Measured on the shipped core, the priming bump is not applied on every line, the comparator is not open before the priming increments on every line, and E.8 does not say which window pixels a WX below 7 drops. The definition of <code>priming_bump</code> in Rule E.8/4 is the one measured here, and this subsection adds what E.8 leaves out.</div>' +

    '<div class="gbemu-rule" id="gbr-E-8-1-1"><b>Rule E.8.1/1.</b> A line is <b>primed by a write</b> when a write to WX takes effect while the line&rsquo;s priming fetch is still outstanding: the picture unit first sees the new value on one of line dots 85 to 89. Every other line is <b>unprimed</b>.</div>' +
    '<div class="gbemu-example"><b>Example.</b> <code>m3_window_timing</code> is a primed line on every row but one, because its handler writes WX five dots into mode 3.</div>' +

    '<div class="gbemu-rule" id="gbr-E-8-1-2"><b>Rule E.8.1/2.</b> The comparator must open and subtract as this table gives, by the kind of line (no object on the line, window enable and the Y condition holding throughout):</div>' +
    '<table class="gbemu-table"><thead><tr><th>Line</th><th>Comparator open (dot, from the line&rsquo;s dot 0)</th><th>Subtracts priming_bump?</th><th>Takeover dot, WX&nbsp;0 (event scale, from the line&rsquo;s dot 0)</th><th>Takeover dot, WX 1 to 7 (same scale)</th><th>Takeover dot, WX 8 and above (same scale)</th></tr></thead><tbody>' +
      '<tr><td>unprimed</td><td>from the first dot of mode 3, dot 84</td><td>never: it compares the position counter with the held WX exactly</td><td>84 (the counter is 0 on dots 84 to 89)</td><td>89&nbsp;+&nbsp;WX, the dot the counter reaches WX (WX&nbsp;=&nbsp;7 on dot 96, one dot before the first pop)</td><td>90&nbsp;+&nbsp;WX&nbsp;+&nbsp;s</td></tr>' +
      '<tr><td>primed by a write</td><td>closed on the first six dots of mode 3 on which no object fetch is in progress; open from the seventh such dot (dot 90 at the earliest)</td><td>yes, by Rule E.8/4, while the priming increments run</td><td>90</td><td>90&nbsp;+&nbsp;WX</td><td>90&nbsp;+&nbsp;WX&nbsp;+&nbsp;s</td></tr>' +
    '</tbody></table>' +
    '<div class="gbemu-why"><b>Why.</b> After the priming the two kinds of line agree. In our source this is <code>WIN_POS_TRIG</code>&nbsp;=&nbsp;4, FITTED. Its other arms, measured on both mealybug boards: subtracting on every line, the original&rsquo;s board 24 of 24 to 19 of 24 (<code>m3_wx_5_change</code> 13,636&nbsp;px, <code>m3_wx_6_change</code> 4,792&nbsp;px, <code>m3_lcdc_tile_sel_win_change</code> 774&nbsp;px, <code>m3_window_timing_wx_0</code> 630&nbsp;px, <code>m3_lcdc_win_map_change</code> 232&nbsp;px); the Color&rsquo;s board 27 of 27 to 22 of 27 (<code>m3_lcdc_tile_sel_win_change2</code> 638&nbsp;px, <code>m3_window_timing_wx_0</code> 630&nbsp;px, <code>m3_lcdc_tile_sel_win_change</code> 620&nbsp;px, <code>m3_lcdc_win_map_change2</code> 70&nbsp;px, <code>m3_lcdc_win_map_change</code> 60&nbsp;px); never subtracting, the original&rsquo;s board 24 of 24 to 22 of 24 (<code>m3_lcdc_win_en_change_multiple_wx</code> 16&nbsp;px, <code>m3_window_timing</code> 9&nbsp;px); the Color&rsquo;s board 27 of 27 to 26 of 27 (<code>m3_window_timing</code> 10&nbsp;px).<br>' +
    'For <code>m3_lcdc_tile_sel_win_change</code> on the Color under &ldquo;subtracting on every line&rdquo;, an independent build of that arm read 534, with the other four cells matching; the shipped core reads <b>620</b> (and the other four Color cells and all five original cells of that ' +
    'arm agree with the list above, to the pixel). Where they lie, by rows of eight: 64 on rows 16 to 23, 54 on 24 to 31, 64 ' +
    'on 32 to 39, 46 on 40 to 47, 102 on 56 to 63, 56 on 64 to 71, 38 on 120 to 127, 98 on 128 to 135 and 98 ' +
    'on 136 to 143; rows 48 to 55 and 72 to 119 do not move. Not the cause: requiring a pixel in the ' +
    'background queue for an object&rsquo;s wait to end (an alternative reading of E.3) gives 620 as ' +
    'well. So the difference sits in some other rule that only the knocked-out comparator exercises; compare ' +
    'row by row against the list above.</div>' +

    '<div class="gbemu-rule" id="gbr-E-8-1-3"><b>Rule E.8.1/3.</b> With no object on the line and window enable and the Y condition holding throughout, a build must produce every row of this table on the Colour. On the original it must produce every row except where Rules E.8.1/4 and E.8.1/5 change the timing of a row with WX 1 to 7; the pixels on screen are those of the table on both machines.</div>' +
    '<table class="gbemu-table"><thead><tr><th>Line and WX</th><th>Takeover dot (event scale, from the line&rsquo;s dot 0)</th><th>Priming fetch still outstanding at the takeover?</th><th>Dot the first window pixel leaves the queue (same scale)</th><th>Window pixel shown at screen column 0 (window pixels counted from 0)</th><th>Mode 3 length against the same line without a window (dots)</th></tr>' +
    '</thead><tbody>' +
    '<tr><td>unprimed, WX&nbsp;0</td><td>84</td><td>yes</td><td>103 if s&nbsp;=&nbsp;0; otherwise 104&nbsp;+&nbsp;s</td><td>7&nbsp;+&nbsp;s</td><td>6 longer if s&nbsp;=&nbsp;0; otherwise 7 longer</td></tr>' +
    '<tr><td>unprimed, WX 1 to 7</td><td>89&nbsp;+&nbsp;WX</td><td>no</td><td>102</td><td>7&nbsp;&minus;&nbsp;WX</td><td>5&nbsp;&minus;&nbsp;s longer (shorter when s is 6 or 7)</td></tr>' +
    '<tr><td>primed, WX 0 to 7</td><td>90&nbsp;+&nbsp;WX</td><td>no</td><td>103</td><td>7&nbsp;&minus;&nbsp;WX</td><td>6&nbsp;&minus;&nbsp;s longer</td></tr>' +
    '<tr><td>either, WX 8 and above</td><td>90&nbsp;+&nbsp;WX&nbsp;+&nbsp;s</td><td>no</td><td>96&nbsp;+&nbsp;WX&nbsp;+&nbsp;s, at screen column WX&nbsp;&minus;&nbsp;7</td><td>(background)</td><td>6 longer</td></tr>' +
    '</tbody></table>' +
    '<div class="gbemu-why"><b>Why.</b> INSTRUMENT-MEASURED with a synthetic cartridge, and checked against the rows of <code>m3_window_timing</code> and <code>m3_window_timing_wx_0</code>. On the Colour every row holds as printed. On the original, a row whose takeover falls while the fine-scroll discard is still pending pays the discard&rsquo;s s dots after its drops (Rule E.8.1/4), so its first window pixel leaves s dots later and drawing ends s dots later; and a line whose window is active at WX 1 to 7 reports mode 0 one dot later (Rule E.8.1/5).</div>' +

    '<p class="hw-readable"><b>Three rules on the original only, from the AGE test <code>stat-mode-window</code></b> (its author&rsquo;s hardware table, DMG-CPU C), which reads the end of drawing at the same dot for every WX from 1 to 165. All three are on the original only; the Colour&rsquo;s table above holds as printed, and the Colour&rsquo;s version of this test fails on 3 runs.</p>' +
    '<div class="gbemu-rule" id="gbr-E-8-1-4"><b>Rule E.8.1/4.</b> On the original, when a window takes over while the line&rsquo;s fine-scroll discard is still pending (WX 1 to 7 with s above 0), the fine scroll must still be paid. The takeover voids the discard as a discard (no window pixel is discarded for it, section 11), and the discard&rsquo;s s dots are still spent:' +
    '<ol class="gbemu-steps">' +
      '<li>The window&rsquo;s 7&nbsp;&minus;&nbsp;WX columns are dropped, one per dot, from the push dot (Rule E.8.1/7, path A).</li>' +
      '<li>On each of the next s dots on which the background queue holds pixels, no pixel is popped, no window pixel is dropped, and the position counter does not move.</li>' +
      '<li>Window pixels then pop, one per dot.</li>' +
    '</ol>' +
    'So the picture is unchanged and drawing ends s dots later than the last column of Rule E.8.1/3&rsquo;s table says.</div>' +
    '<div class="gbemu-example"><b>Example.</b> Original, unprimed line, WX&nbsp;=&nbsp;3, s&nbsp;=&nbsp;2, no object. The takeover is on dot 92 (89&nbsp;+&nbsp;WX); the restart fetch pushes on dot 98; the 4 drops are on dots 98 to 101; dots 102 and 103 pop nothing; the first window pixel leaves on dot 104, and screen column 0 shows window pixel 4, as in the table. Mode 3 is 5 dots longer than without the window: the table&rsquo;s 5&nbsp;&minus;&nbsp;s&nbsp;=&nbsp;3, plus s&nbsp;=&nbsp;2. On the Colour the same line pops its first window pixel on 102 and is 3 longer.</div>' +
    '<div class="gbemu-why"><b>Why.</b> MECHANISM; mealybug unmoved. Constant: <code>WIN_FINE_STALL</code> = 1.</div>' +

    '<div class="gbemu-rule" id="gbr-E-8-1-5"><b>Rule E.8.1/5.</b> On the original, on an object-free line on which the window is active, the mode-0 report must come one dot later than E.6&rsquo;s object-free report whenever the WX register reads 1 to 7 on the dot the report is tested: the report&rsquo;s lead, three dots before the last pixel (E.6), becomes two. The WX this test reads is the <b>live register on the report dot</b>, not the value the comparator matched at the takeover: a handler that rewrites WX between the takeover and the report changes the answer. Only the report moves; the pixels and internal mode 3 do not.</div>' +
    '<div class="gbemu-example"><b>Example.</b> Original, SCX&nbsp;0, no objects. A line whose window started at WX 8 to 163 reports mode 0 first seen on dot 260. A line whose window started at WX&nbsp;3, with WX still 3 at the report, also reports it first seen on dot 260; without this rule it would be first seen on dot 259. If the handler writes WX&nbsp;=&nbsp;20 after that takeover and before the report, the test reads 20, the lead stays three, and the report is first seen on dot 259.</div>' +
    '<div class="gbemu-why"><b>Why.</b> Without this rule our core reads those lines one dot early against WX 8 to 163 at every SCX (traced: first seen on dot 259 against 260 at SCX 0, the first-seen scale of Rule E.8.1/6; each change is made as the dot before is processed). Putting the dot into the pixel pipeline breaks mealybug (<code>m3_window_timing</code> 6 pixels, <code>m3_lcdc_tile_sel_win_change</code> 124), so the pixels are right and only the report moves: on those lines the original&rsquo;s object-free report (E.6, three dots before the last pixel) leads by two. Which WX: read from our source. FITTED: one dot, the report only, the reason not known. Constant: <code>WIN_HELD_EXTRA</code> = 1.</div>' +

    '<div class="gbemu-rule" id="gbr-E-8-1-6"><b>Rule E.8.1/6.</b> On the original, on an object-free line, a window that starts in the line&rsquo;s last three pixels must still lengthen the mode-0 report. Two tests, both made after that dot&rsquo;s fetcher step and pop (the test sits after the pixel pipeline in the dot):' +
    '<ol class="gbemu-steps">' +
      '<li><b>Still to start.</b> While the window is not active and all four of these hold on the dot, the report of E.6 is held (mode 0 is not reported): window enable reads set at the comparator; the Y condition holds; WX&nbsp;&minus;&nbsp;7 is not below the count of pixels popped so far; and WX is at most 165.</li>' +
      '<li><b>Started at WX 164 or 165.</b> Once the window is active with the WX register at 164 or 165, the report is held while the background queue is empty (the takeover cleared it and the fetch has not pushed yet), and STAT reports mode 0 from the first dot on which all three hold: the window is active; the background queue is empty; and <code>pos</code>&nbsp;&ge;&nbsp;(160&nbsp;&minus;&nbsp;pixels popped)&nbsp;+&nbsp;2.</li>' +
    '</ol>' +
    'In step 2, <code>pos</code> is the <b>count</b> of fetcher dots run since the takeover&rsquo;s restart, including the step just taken on this dot: 1 after the first such dot, 2 after the second. It is not the index of the dot just run, and it does not advance on object-stall dots. &ldquo;Pixels popped&rdquo; includes the pixel just popped on this dot. A WX of 166 or more is not held by either step, and nothing else lengthens such a line: it reports like a line with no window. <b>The last pixel is a separate matter</b>: the comparator runs until the 160th pop (Rule 7/4), so at SCX&nbsp;0 a window at WX 160 to 166 still takes over (WX 166 with 159 pixels popped, for column 159), and the 160th pixel is popped on dot 262 instead of 256; the mode-0 request, counted from the pixels still to pop (E.6), moves with it. WX 167 and above never match, and the last pixel stays on dot 256. Traced on our core (<code>stat-mode-window-dmgC</code>, the lines at SCX&nbsp;0).</div>' +
    '<table class="gbemu-table"><thead><tr><th>WX (original, SCX&nbsp;0, WY&nbsp;0, no objects)</th><th>Mode 0 report: change made as this dot is processed (event scale, from the line&rsquo;s dot 0)</th><th>Mode 0 report: first-seen dot (a read made on this dot sees mode 0)</th><th>Internal mode 3 ends as this dot is processed (event scale) / first seen</th></tr></thead><tbody>' +
      '<tr><td>160 to 165</td><td>259</td><td>260</td><td>249 / 250</td></tr>' +
      '<tr><td>166, 167 and 200</td><td>253 (E.6&rsquo;s &ldquo;three dots before the last pixel&rdquo; of a line with no window, popped on dot 256)</td><td>254, the no-window dot</td><td>249 / 250</td></tr>' +
    '</tbody></table>' +
    '<div class="gbemu-example"><b>Example.</b> WX&nbsp;=&nbsp;165, SCX&nbsp;0: the takeover lands with 158 pixels popped, so 2 pixels are still to draw and step 2 needs <code>pos</code>&nbsp;&ge;&nbsp;2&nbsp;+&nbsp;2&nbsp;=&nbsp;4. The takeover dot does not step the fetcher; the restart fetch&rsquo;s first four dots bring <code>pos</code> to 1, 2, 3 and 4, and on the fourth, after its step, the test holds: mode 0 is set as that dot is processed (dot 259 in the table) and first seen on the next (260). WX&nbsp;=&nbsp;164 takes over one pixel earlier, with 3 still to draw, and needs <code>pos</code>&nbsp;&ge;&nbsp;5: one dot more, from a takeover one dot earlier, so the same dot 259. Traced: SCX&nbsp;8 gives first-seen dot 260 for WX 162 to 165, SCX&nbsp;9 one dot later, and WX&nbsp;166 is unchanged.</div>' +
    '<div class="gbemu-why"><b>Why.</b> At WX 164 or 165 the window&rsquo;s position match falls on pixel 157 or 158; the hardware reads those lines exactly like WX 162 and 163 (drawing lasts longer by the window&rsquo;s start-up fetch) and WX 166 like no window. <b>Why 166 is like no window in our core</b>: the hold&rsquo;s rule has an upper bound, WX at most 165 (the &ldquo;still to start&rdquo; test), and nothing else lengthens the line: the drawing itself (internal mode 3, section 7) ends with the fetcher&rsquo;s last push on the same dot for every one of these WX values, so the only difference is the report. Measured with <code>test/tabprobe</code> (SCX 0, WY 0, no objects); the probe reads the state at the start of each dot, so a read made on a first-seen dot sees mode 0. Without this rule the report comes three dots before the last pixel, before the window has started, so it never sees it; with it, the same three-dot lead is counted through the window&rsquo;s fetch. Read from our source (<code>WIN_TAIL_HOLD</code>, <code>WIN_TAIL_K</code> 2). MECHANISM; the 2 is that lead&rsquo;s own arithmetic (a six-dot fetch, a three-dot lead, the push dot), and 1 or 3 leave 4 wrong cells each. Constants: <code>WIN_TAIL_HOLD</code> = 1, <code>WIN_TAIL_K</code> = 2.<br>' +
    'With the three rules E.8.1/4 to E.8.1/6, <code>stat-mode-window</code> on the DMG passes; without them it has 44 wrong cells. Our own window switch-off rows are discussed in E.1&rsquo;s write-timing paragraph. SameBoy 0.16.2 fails this test.</div>' +

    '<div class="gbemu-rule" id="gbr-E-8-1-7"><b>Rule E.8.1/7.</b> A takeover must follow one of two paths, chosen by whether the line&rsquo;s priming fetch is still outstanding on the takeover dot (not by whether a pixel has left the queue yet):</div>' +
    '<table class="gbemu-table"><thead><tr><th>Priming fetch on the takeover dot T</th><th>Path</th><th>Cases (Rule E.8.1/3&rsquo;s table)</th><th>Columns to drop: 7&nbsp;&minus;&nbsp;WX for WX 0 to 6, read from</th></tr></thead><tbody>' +
      '<tr><td>completed</td><td>A, the steps below</td><td>every row but the first</td><td>the WX register on the takeover dot T (fixed at the takeover, not at the push)</td></tr>' +
      '<tr><td>still outstanding</td><td>B, the steps below</td><td>in practice WX&nbsp;=&nbsp;0 on an unprimed line, on dot 84, or a WX&nbsp;=&nbsp;0 window whose enable first reads set on dots 85 to 88, which takes over one dot later, on 86 to 89 (Rule E.8.3/3)</td><td>the WX register on the dot the window&rsquo;s first tile fetch pushes, not at the takeover</td></tr>' +
    '</tbody></table>' +
    '<p class="hw-readable"><b>Path A</b>, the takeover on dot T after the priming fetch has completed:</p>' +
    '<ol class="gbemu-steps">' +
      '<li>Dot T is spent on the switch and nothing else: the fetcher does not step and nothing is popped. The background queue is cleared and the pending fine-scroll discard voided (section 11; on the original its dots are kept, Rule E.8.1/4).</li>' +
      '<li>The restart fetch runs on dots T&nbsp;+&nbsp;1 to T&nbsp;+&nbsp;6 and pushes on T&nbsp;+&nbsp;6, its high-plane step.</li>' +
      '<li>For WX below 7, the first 7&nbsp;&minus;&nbsp;WX window pixels are dropped, one per dot, starting on the push dot T&nbsp;+&nbsp;6. A drop dot outputs nothing.</li>' +
      '<li>Window pixels then leave the queue, one per dot (on the original after any stall dots of Rule E.8.1/4).</li>' +
    '</ol>' +
    '<p class="hw-readable">This is the only path on which a takeover costs exactly 6.</p>' +
    '<div class="gbemu-example"><b>Example (path A).</b> Primed line, WX&nbsp;=&nbsp;2, no object: T&nbsp;=&nbsp;92; restart fetch on 93 to 98, push on 98; drops on 98, 99, 100, 101 and 102 (7&nbsp;&minus;&nbsp;2&nbsp;=&nbsp;5); the first window pixel leaves on 103 and screen column 0 shows window pixel 5. WX&nbsp;=&nbsp;20, s&nbsp;=&nbsp;0: T&nbsp;=&nbsp;110; push on 116, no drop, the first window pixel leaves on 116 at screen column 13.</div>' +
    '<p class="hw-readable"><b>Path B</b>, the takeover on dot T while the priming fetch is outstanding:</p>' +
    '<ol class="gbemu-steps">' +
      '<li>The takeover spends no dot of its own. It restarts the priming fetch from its first step, and the restarted priming fetch takes its first dot on T itself.</li>' +
      '<li>The restarted priming fetch completes on its sixth dot, T&nbsp;+&nbsp;5, and on that dot latches SCX&nbsp;&amp;&nbsp;7 into the discard count as usual. The voiding happened at the takeover, before this latch, so <b>this latch stands and applies to the window</b>.</li>' +
      '<li>The next fetch is the window&rsquo;s first tile and takes no early push: 8 dots, T&nbsp;+&nbsp;6 to T&nbsp;+&nbsp;13, pushing on T&nbsp;+&nbsp;13; except that with WX&nbsp;=&nbsp;0 and a latched SCX&nbsp;&amp;&nbsp;7 of 0 it starts one dot into its first step and takes 7, T&nbsp;+&nbsp;6 to T&nbsp;+&nbsp;12, pushing on T&nbsp;+&nbsp;12 (Rule E.8.1/8 says which fine scroll this tests).</li>' +
      '<li>On the push dot the number of columns to drop is read from WX: 7&nbsp;&minus;&nbsp;WX.</li>' +
      '<li>From the push dot one pixel per dot is removed: first the 7&nbsp;&minus;&nbsp;WX drops, then the SCX&nbsp;&amp;&nbsp;7 discards.</li>' +
      '<li>Window pixels then leave the queue. Screen column 0 shows window pixel (7&nbsp;&minus;&nbsp;WX)&nbsp;+&nbsp;(SCX&nbsp;&amp;&nbsp;7).</li>' +
    '</ol>' +
    '<div class="gbemu-example"><b>Example (path B, the WX&nbsp;=&nbsp;0 arm as an expression).</b> With the takeover on dot T while the priming fetch is outstanding (T&nbsp;=&nbsp;84 on an unprimed line) and s the fine scroll latched when it completes, the first window pixel leaves the queue on dot <b>T&nbsp;+&nbsp;19 when s&nbsp;=&nbsp;0, and T&nbsp;+&nbsp;20&nbsp;+&nbsp;s otherwise</b>: 103 and 104&nbsp;+&nbsp;s at T&nbsp;=&nbsp;84. Counted: s&nbsp;=&nbsp;0, push on 84&nbsp;+&nbsp;12&nbsp;=&nbsp;96, seven drops on 96 to 102, first window pixel on 103. s&nbsp;=&nbsp;3, push on 84&nbsp;+&nbsp;13&nbsp;=&nbsp;97, seven drops on 97 to 103, three discards on 104 to 106, first window pixel on 107&nbsp;=&nbsp;104&nbsp;+&nbsp;3, and screen column 0 shows window pixel 7&nbsp;+&nbsp;3&nbsp;=&nbsp;10.</div>' +
    '<div class="gbemu-why"><b>Why.</b> The WX&nbsp;=&nbsp;0 expression is the whole of what F.5 calls the WX&nbsp;=&nbsp;0 arm, and it is the cartridge author&rsquo;s own description of <code>m3_window_timing_wx_0</code> in its source header (the window &ldquo;activating one T-cycle later when WX&nbsp;=&nbsp;0 and SCX&nbsp;&gt;&nbsp;0&rdquo;), stated in dots. Label: the one-dot early start at zero fine scroll is CONVERGENCE (our source records its shape as read from a reference implementation, no expression taken) and FITTED; the re-latched discard and the drop count read at the push are FITTED. Measured cost of each, switched off on the shipped core: the one-dot start, the original&rsquo;s board 24 of 24 to 23 of 24 (<code>m3_window_timing_wx_0</code> 18&nbsp;px); the Color&rsquo;s board 27 of 27 to 26 of 27 (<code>m3_window_timing_wx_0</code> 18&nbsp;px); voiding the re-latched discard as well, the original&rsquo;s board 24 of 24 to 23 of 24 (<code>m3_window_timing_wx_0</code> 504&nbsp;px); the Color&rsquo;s board 27 of 27 to 26 of 27 (<code>m3_window_timing_wx_0</code> 504&nbsp;px); reading the drop count at the takeover instead of the push, the original&rsquo;s board 24 of 24 to 22 of 24 (<code>m3_lcdc_win_en_change_multiple_wx</code> 1&nbsp;px, <code>m3_window_timing</code> 1&nbsp;px); the Color&rsquo;s board 27 of 27 to 26 of 27 (<code>m3_window_timing</code> 1&nbsp;px); choosing the path by whether a pixel has left the queue yet instead of by whether the priming fetch is outstanding (a proxy, which takes the early push and the switch dot away from every takeover before the first pop; in our source this knock-out is <code>WIN_PRIME_LX0</code> = 0, which puts both tests on <code>lx &gt; 0</code>. On our core it leaves the lines whose takeover falls on dots 90 to 96 with no object, WX 1 to 7 unprimed, at their shipped picture: <code>m3_wx_4_change</code>, <code>m3_wx_5_change</code> and <code>m3_wx_4_change_sprites</code> stay at 0&nbsp;px. Why those lines keep their timing under it is NOT ESTABLISHED in our core), the original&rsquo;s board 24 of 24 to 21 of 24 (<code>m3_lcdc_tile_sel_win_change</code> 922&nbsp;px, <code>m3_lcdc_win_map_change</code> 128&nbsp;px, <code>m3_window_timing</code> 7&nbsp;px); the Color&rsquo;s board 27 of 27 to 22 of 27 (<code>m3_lcdc_tile_sel_win_change2</code> 638&nbsp;px, <code>m3_lcdc_tile_sel_win_change</code> 606&nbsp;px, <code>m3_lcdc_win_map_change2</code> 70&nbsp;px, <code>m3_lcdc_win_map_change</code> 64&nbsp;px, <code>m3_window_timing</code> 7&nbsp;px).</div>' +

    '<div class="gbemu-rule" id="gbr-E-8-1-8"><b>Rule E.8.1/8.</b> The one-dot early start of path B (a 7-dot first window fetch when WX&nbsp;=&nbsp;0) must test the fine scroll latched on the dot the restarted priming fetch completes: the test is made on that dot, immediately after that dot latches SCX &amp; 7 into the discard count and before anything else can change it, so the count it reads ' +
    'is the value just latched. It must not test the discard count still pending at any other moment.</div>' +
    '<div class="gbemu-why"><b>Why.</b> Testing the discard count still pending instead gives 630 for the knock-out above that prints 504. In the build that priced the knock-out voiding the re-latched discard as ' +
    'well, the voiding comes after this test, which is why it still prices at 504. Read from our own ' +
    'source.</div>' +

    '<p class="hw-readable"><b>Which WX each test reads.</b> An index; each row&rsquo;s rule is the home of the fact.</p>' +
    '<table class="gbemu-table"><thead><tr><th>Test</th><th>The WX it reads</th><th>On which dot</th><th>Rule</th></tr></thead><tbody>' +
      '<tr><td>takeover comparator</td><td>the held WX, <code>WX_cmp</code>: the pre-write value on the hold dot when it is 7 or more, otherwise the register</td><td>every dot it is open</td><td>E.8/3</td></tr>' +
      '<tr><td>columns to drop, path A</td><td>the WX register</td><td>the takeover dot</td><td>E.8.1/7</td></tr>' +
      '<tr><td>columns to drop, path B</td><td>the WX register</td><td>the dot the window&rsquo;s first tile fetch pushes</td><td>E.8.1/7</td></tr>' +
      '<tr><td>mode-0 report one dot later (original)</td><td>the WX register (1 to 7)</td><td>the dot the report is tested</td><td>E.8.1/5</td></tr>' +
      '<tr><td>report held for a late window (original)</td><td>the WX register (at most 165; 164 or 165 once started)</td><td>each dot of the hold</td><td>E.8.1/6</td></tr>' +
      '<tr><td>insertion while active</td><td>the WX register, no hold, no correction</td><td>each dot of mode 3 with the window active</td><td>E.8.2/1</td></tr>' +
      '<tr><td>insertion without a takeover</td><td>the WX register</td><td>each dot of mode 3 with the window inactive</td><td>E.8.3/1</td></tr>' +
    '</tbody></table>' +

    '<h4 class="gbemu-sub">E.8.2: A WX match while the window is already active inserts one pixel</h4>' +
    '<div class="gbemu-rule" id="gbr-E-8-2-1"><b>Rule E.8.2/1.</b> On every dot of mode 3 on which the window is active, a build must make a second test, which fires when <b>all</b> of these hold on the dot:' +
    '<ol class="gbemu-steps">' +
      '<li>window enable reads set at the comparator;</li>' +
      '<li>the Y condition holds;</li>' +
      '<li>the output position (the count of pixels already output on the line, which is the screen column; <code>lx</code> in our source) plus 7 equals the <b>live</b> WX register (no hold, no correction);</li>' +
      '<li>the position counter minus 7 is a multiple of 8 (Rule E.8.4/1 defines the counter);</li>' +
      '<li>the output position is not the one at which this line&rsquo;s takeover, or an earlier insertion, happened.</li>' +
    '</ol>' +
    'The test is evaluated before the object test but acted on only when no object is due on the dot, which is E.5&rsquo;s order: the object test, (d), then the insertion, (e). <b>What it does:</b> this dot outputs one pixel of background colour 0 (palette 0 on the Color; the object queue is popped and merged as on any dot) without popping the background queue and without stepping the fetcher, and the output position and the counter each advance by one. The rest of the line follows one pixel later and its last pixel falls off the right edge.</div>' +
    '<div class="gbemu-example"><b>Example.</b> Both machines: <code>m3_wx_4_change</code> line 12 takes the window over on dot 93 (WX&nbsp;4, unprimed), the handler then writes WX&nbsp;=&nbsp;12, and on dot 107 the output position is 5, so 5&nbsp;+&nbsp;7&nbsp;=&nbsp;12 matches the live WX and a colour-0 pixel is inserted at screen column 5.</div>' +
    '<div class="gbemu-why"><b>Why.</b> The order and the output position are MECHANISM, read from our source. Label: the shape is the test author&rsquo;s written statement in the cartridge&rsquo;s source header (&ldquo;window reactivation zero pixels should be present when the window is already activated and the pixel that the window reactivates on is on the same cycle as the window tile nametable read&rdquo;); the conditions are FITTED. Measured, switched off on the shipped core: the original&rsquo;s board 24 of 24 to 21 of 24 (<code>m3_wx_5_change</code> 638&nbsp;px, <code>m3_wx_4_change</code> 229&nbsp;px, <code>m3_wx_4_change_sprites</code> 10&nbsp;px); the Color&rsquo;s board 27 of 27 to 26 of 27 (<code>m3_wx_4_change_sprites</code> 10&nbsp;px).</div>' +

    '<h4 class="gbemu-sub">E.8.3: A WX match while window enable reads clear</h4>' +
    '<div class="gbemu-why"><b>Why.</b> A two-dot pending match fits rows 16 and 17 of <code>m3_lcdc_win_en_change_multiple_wx</code>, but our core does two other things, and Rules E.8.3/1 to E.8.3/3 are they.</div>' +
    '<div class="gbemu-rule" id="gbr-E-8-3-1"><b>Rule E.8.3/1.</b> <b>The insertion without a takeover.</b> On a dot on which the window is not active and window enable reads clear at the comparator, a build must insert one colour-0 pixel, exactly as in Rule E.8.2/1, when all of these hold:' +
    '<ol class="gbemu-steps">' +
      '<li>window enable has read set at the comparator on some earlier dot of this line&rsquo;s mode 3 (the first arm; Rule E.8.3/2 gives the second);</li>' +
      '<li>the Y condition holds;</li>' +
      '<li>the position counter equals the live WX register;</li>' +
      '<li>the fetcher&rsquo;s previous dot was the first dot of its fourth step, so this dot would have been its push dot (in our source: on this dot the fetcher is due to run the second dot of its fourth step, <code>fetch_step</code> 3 and <code>fetch_sub</code> 1, steps counted from 0; MECHANISM);</li>' +
      '<li>the output position differs from the last insertion&rsquo;s.</li>' +
    '</ol>' +
    'No takeover follows.</div>' +
    '<div class="gbemu-example"><b>Example.</b> On <code>m3_lcdc_win_en_change_multiple_wx</code> it fires on rows 15 and 39 (WX 15 and 39, both 7 more than a multiple of 8), at screen columns 8 and 32.</div>' +
    '<div class="gbemu-why"><b>Why.</b> Label: FITTED. Measured, switched off: the original&rsquo;s board 24 of 24 to 23 of 24 (<code>m3_lcdc_win_en_change_multiple_wx</code> 2&nbsp;px); the Color&rsquo;s board unchanged at 27 of 27.</div>' +
    '<div class="gbemu-rule" id="gbr-E-8-3-2"><b>Rule E.8.3/2.</b> <b>One insertion, two ways to arm it.</b> The insertion of Rule E.8.3/1 and its first arm run on both machines (the Colour tab, section 10). On the original only, a second arm replaces condition 1 (window enable read set earlier on this line); conditions 2 to 5 are shared. The second arm, the frame flag, is section 11&rsquo;s last paragraph: the window has taken over on some earlier line <em>of this frame</em> (a flag cleared at the frame wrap and at switch-off) and the tile-boundary test <code>(WX &amp; 7) == 7 - (SCX &amp; 7)</code> holds, with SCX as the fetcher reads it on that dot. Either arm, with all the shared conditions, inserts the one colour-0 pixel; neither makes a takeover.</div>' +
    '<div class="gbemu-why"><b>Why.</b> MECHANISM, read from our source (one insertion test, <code>WIN_INSERT_ZERO</code> 2 with <code>WIN_DIS_INSERT</code> 1).</div>' +
    '<div class="gbemu-rule" id="gbr-E-8-3-3"><b>Rule E.8.3/3.</b> <b>A match on the first dot enable returns is postponed by one dot.</b> If the comparator matches on a dot whose previous drawing dot read window enable clear, no takeover happens on that dot; the takeover happens on the next dot of the line on which the window is inactive and enable reads set, <b>without testing the position again</b>. The enable history is kept only on drawing dots, so on the first dot of mode 3 the previous drawing dot is the last drawing dot of the line before. <b>A drawing dot, exactly</b>: every dot from the line&rsquo;s dot 84 until the dot its 160th pixel is popped, object-stall dots and window-restart dots included; the history takes one entry per such dot, before that dot&rsquo;s object or fetcher work.</div>' +
    '<div class="gbemu-example"><b>Example.</b> Row 16 of <code>m3_lcdc_win_en_change_multiple_wx</code>: WX&nbsp;16, enable returns on dot 106, the dot the counter reaches 16, so the takeover lands on dot 107 at screen column 10, the column row 17 reaches with WX&nbsp;17 and no postponement.</div>' +
    '<div class="gbemu-why"><b>Why.</b> The drawing-dot definition is read from our source. Label: CONVERGENCE (our source records the shape as read from a reference implementation, no expression taken), FITTED. Measured, switched off: the original&rsquo;s board 24 of 24 to 23 of 24 (<code>m3_lcdc_win_en_change_multiple_wx</code> 3&nbsp;px); the Color&rsquo;s board unchanged at 27 of 27.</div>' +
    '<div class="gbemu-rule" id="gbr-E-8-3-4"><b>Rule E.8.3/4.</b> <b>Any other match while enable reads clear does nothing</b>, and the counter keeps counting: it does not stop at WX, so a window enabled after its match position has passed does not appear on that line.</div>' +

    '<h4 class="gbemu-sub">E.8.4: The position counter, defined in full</h4>' +
    '<div class="gbemu-rule" id="gbr-E-8-4-1"><b>Rule E.8.4/1.</b> The position counter <code>win_px</code> that E.8 compares, in full, including what happens during an object stall and after a takeover. It is 0 on the first dot of mode 3, and then:' +
    '<ol class="gbemu-steps">' +
      '<li><b>Priming increments:</b> one on each dot of mode 3 from the seventh dot on which no object fetch is in progress (dot 90 with no object) until it reaches 7. They <b>do not happen on stall dots</b>: during a clipped object&rsquo;s stall (E.3.1) they pause and resume after it, and the seven all still happen. They <b>do</b> happen on the wait dots before a phase-window object&rsquo;s fetch, and on the notice dot itself, because the priming step runs earlier in the dot than the object test. They <b>continue after a takeover</b> until the counter reaches 7.</li>' +
      '<li><b>The original&rsquo;s hand-back:</b> on the dot an object&rsquo;s fetch starts (any object, clipped or not), if that dot&rsquo;s priming increment has landed and the fetcher is on the first dot of a step, the increment is undone. The Color keeps it (the Colour tab, section 10).</li>' +
      '<li><b>One more for every pixel popped</b>, every column dropped (Rule E.8.1/7) and every pixel inserted (Rules E.8.2/1, E.8.3/1).</li>' +
      '<li><b>Nothing for a fine-scroll discard pop</b>, as section 11 states, and nothing for a fine-scroll stall dot of Rule E.8.1/4.</li>' +
    '</ol></div>' +
    '<div class="gbemu-example"><b>Example.</b> Measured on the shipped core, a WX&nbsp;=&nbsp;7 window with one clipped object on the line (unprimed, SCX&nbsp;=&nbsp;0): the takeover lands on dot 107, 105, 105, 103, 103 and 101 for OAM X 0 to 5 on the original and 106, 105, 104, 103, 102 and 101 on the Color, and on dot 96 for OAM X 6 and 7 on both, because the object is then noticed after the window has already started. Without an object the same window takes over on dot 96 (Rule E.8.1/2).</div>' +
    '<div class="gbemu-why"><b>Why.</b> The hand-back is MECHANISM, read from our source, <code>WIN_PRIME_OBJ_DOT</code> = 5. The pause costs, switched off (increments running through stalls): the original&rsquo;s board 24 of 24 to 22 of 24 (<code>m3_lcdc_tile_sel_win_change</code> 606&nbsp;px, <code>m3_lcdc_win_map_change</code> 246&nbsp;px); the Color&rsquo;s board 27 of 27 to 23 of 27 (<code>m3_lcdc_tile_sel_win_change2</code> 657&nbsp;px, <code>m3_lcdc_tile_sel_win_change</code> 542&nbsp;px, <code>m3_lcdc_win_map_change2</code> 210&nbsp;px, <code>m3_lcdc_win_map_change</code> 64&nbsp;px). The original&rsquo;s hand-back, switched off: the original&rsquo;s board 24 of 24 to 23 of 24 (<code>m3_lcdc_tile_sel_win_change</code> 178&nbsp;px); the Color&rsquo;s board unchanged at 27 of 27; carried to the Color: the original&rsquo;s board unchanged at 24 of 24; the Color&rsquo;s board 27 of 27 to 26 of 27 (<code>m3_lcdc_tile_sel_win_change</code> 128&nbsp;px).</div>' +

    '<h4 class="gbemu-sub">E.9: The display-control settling scale, decoded (the integers are tags, not dot counts)</h4>' +
    '<div class="gbemu-rule" id="gbr-E-9-1"><b>Rule E.9/1.</b> The integers 6, 7, 8, 9, 10 and 61 that E.1.3 uses for LCDC consumers are <b>tags</b>: each is the name of one consumer&rsquo;s view of the LCDC register. A tag is not a count of dots, not an offset and not a rank: 61 is not sixty-one on ' +
    'the same axis as 6, it is a restriction <em>of</em> 6, and 10 is a union of two others. A build must give each consumer the set of dots on which it sees the new value, as Rule E.9/3&rsquo;s table gives it, and never derive a delay from the integer.</div>' +
    '<div class="gbemu-example"><b>Example.</b> Tags 7 and 61 are both &ldquo;one dot early&rdquo; and are different dots. For a write with C on dot 104: a tag-7 consumer sees the new value from 103 onward; a tag-61 consumer sees it on 102, the <em>old</em> value again on 103, and the new value from 104. A build that reads 61 as &ldquo;later than 10&rdquo; or as a number of dots gets both wrong.</div>' +
    '<div class="gbemu-why"><b>Why.</b> E.1.3 keys its whole per-bit table on a private ordinal (6, 7, ' +
    '8, 9, 10, 61) and the one relationship that makes it decodable is three paragraphs ' +
    'later. Stated outright here, because a reader who assumes those integers are dots will ' +
    'build the wrong table and the error will look like a lead effect. They are opaque tags. ' +
    'They are not dot counts, and they do not form an ordinal.</div>' +

    '<div class="gbemu-rule" id="gbr-E-9-2"><b>Rule E.9/2.</b> Every tag is built from three named dots plus the nominal commit. <b>The <em>commit dot</em>, written <code>C</code>, is the first dot on which a nominal consumer (tag 8) reads the new value.</b> For a write whose own machine cycle covers dots N to N&nbsp;+&nbsp;3 (section 1), C is the last dot of the write&rsquo;s own machine cycle on a Colour at single speed, and the last dot of the machine cycle after the write&rsquo;s on the original with the display on; the table gives every named dot. The relations between the named dots are the same on every machine; only where they sit against N differs:</div>' +
    '<table class="gbemu-table"><thead><tr><th>Named dot</th><th>Position (dots, from C)</th><th>Colour at single speed (dot, from N)</th><th>Original, display on (dot, from N)</th><th>Colour in double speed (dot, from N; the write cycle covers N and N&nbsp;+&nbsp;1)</th><th>What the register itself holds on it</th></tr></thead><tbody>' +
      '<tr><td>first lead dot</td><td><b>C &minus; 3</b></td><td>N, the first dot of the write&rsquo;s cycle</td><td>N&nbsp;+&nbsp;4</td><td>none: there are no lead dots</td><td>the pre-write value</td></tr>' +
      '<tr><td>last lead dot</td><td><b>C &minus; 2</b></td><td>N + 1</td><td>N&nbsp;+&nbsp;5</td><td>none</td><td>the pre-write value, except bits 5 and 6, which are already new (E.1.3).</td></tr>' +
      '<tr><td><b>the conflict dot</b></td><td><b>C &minus; 1</b></td><td>N + 2</td><td>N&nbsp;+&nbsp;6</td><td>N</td><td>the two-stage ' +
      'intermediate: the pre-write value, with background-enable set if either the old or the new value ' +
      'sets it, bits 5 and 6 new, and object-enable new when the write clears it (E.1.3). In double speed bits 5 and 6 are not early, so the intermediate is the pre-write value with background-enable set if either value sets it, and object-enable cleared if the write clears it. So the ' +
      '<em>register</em> still holds background-enable set here when the write clears it, but no consumer' +
      ' of background-enable reads the register on this dot (Rule E.9/5).</td></tr>' +
      '<tr><td>the commit dot</td><td><b>C</b></td><td>N + 3, the last dot of the write&rsquo;s cycle</td><td>N&nbsp;+&nbsp;7, the last dot of the machine cycle after the write&rsquo;s</td><td>N&nbsp;+&nbsp;1</td><td>the new value</td></tr>' +
    '</tbody></table>' +
    '<div class="gbemu-example"><b>Example.</b> Original, display on, a write cycle on dots 97 to 100 (N&nbsp;=&nbsp;97): lead dots 101 and 102, conflict dot 103, C&nbsp;=&nbsp;104 (E.9.1 measures every dot). Colour at single speed, a write cycle on 98 to 101: lead dots 98 and 99, conflict dot 100, C&nbsp;=&nbsp;101. Colour in double speed, a write cycle on 107 and 108: conflict dot 107, C&nbsp;=&nbsp;108.</div>' +
    '<div class="gbemu-why"><b>Why.</b> On the original with the display on the whole train is one machine cycle later than the write&rsquo;s own cycle (E.1, the paragraph under the table). Placing the lead dots on the last two dots of the cycle and C two dots after it lands every LCDC consumer two dots late. E.1&rsquo;s lead of 2 is where the intermediate lands, two dots before the cycle ends; the lead dots are the two dots before it, at the start of the cycle. Then the three named dots have fixed positions and the whole scale is arithmetic. <b>The two lead dots are two because this register&rsquo;s lead is ' +
    '2</b> (E.1&rsquo;s table, LCDC row). At a lead of <code>L</code> there are <code>L</code> lead ' +
    'dots and the conflict dot stays at <code>C &minus; 1</code>; the tags name dots, not ' +
    'offsets, so they travel with the lead.</div>' +

    '<div class="gbemu-rule" id="gbr-E-9-3"><b>Rule E.9/3.</b> Each tag is the nominal behaviour plus or minus a subset of the named dots of Rule E.9/2. A consumer with a given tag must see the new value on exactly these dots, for a write that sets a bit and for a write that clears it alike; where a consumer&rsquo;s view of a set differs from its view of a clear, Rule E.9/4 gives each:</div>' +
    '<table class="gbemu-table"><thead><tr><th>Tag (a name)</th><th>Reads as</th><th><b>The dots on which the consumer sees the NEW value</b> (named dots of Rule E.9/2)</th><th>In terms of the three dots</th></tr></thead><tbody>' +
      '<tr><td><b>8</b></td><td>nominal</td><td><b>C onward</b></td><td>the value as committed, and nothing early or late</td></tr>' +
      '<tr><td><b>9</b></td><td>one dot late</td><td><b>C + 1 onward</b>: the pre-write value on C itself</td><td>the pre-write value held for one dot <em>after</em> the commit</td></tr>' +
      '<tr><td><b>7</b></td><td>one dot early</td><td><b>C &minus; 1 onward</b></td><td>nominal, plus the <b>conflict dot</b></td></tr>' +
      '<tr><td><b>61</b></td><td>one dot early, the other one</td><td><b>C &minus; 2, then the OLD value again on C &minus; 1, then C onward</b></td><td>nominal, plus the <b>last lead dot</b>, and <em>not</em> the conflict dot</td></tr>' +
      '<tr><td><b>10</b></td><td>a contiguous two-dot early window</td><td><b>C &minus; 2 onward</b></td><td>nominal, plus <b>both</b> of the above: the union of 7 and 61</td></tr>' +
      '<tr><td><b>6</b></td><td>earliest</td><td><b>C &minus; 3 and C &minus; 2, then the OLD value again on C &minus; 1, then C onward</b></td><td>nominal, plus <b>both lead dots</b>, and <em>not</em> the conflict dot</td></tr>' +
    '</tbody></table>' +

    '<div class="gbemu-rule" id="gbr-E-9-4"><b>Rule E.9/4.</b> Each LCDC consumer must first use the new value on the dot this table gives. Every cell is a named dot of Rule E.9/2; &ldquo;set&rdquo; is a write that sets the bit, &ldquo;clear&rdquo; one that clears it, and a cell that names one dot without &ldquo;set&rdquo; or &ldquo;clear&rdquo; applies to both.</div>' +
    '<table class="gbemu-table"><thead><tr><th>Consumer (LCDC bit)</th><th>Original: first dot using the new value (named dot)</th><th>Colour, single speed (named dot)</th><th>Colour, double speed (named dot)</th></tr></thead><tbody>' +
      '<tr><td>background-enable at the merge (0)</td><td>C &minus; 1, set and clear; for screen column 0 alone, C ' +
      '&minus; 2, counted on its pop dot (its decision is taken on the dot after the pop, ' +
      'E.1.3)</td><td>C &minus; 1, set and clear</td><td>C &minus; 1, set and clear</td></tr> <tr><td>object selection (1)</td><td>set:' +
      ' C &minus; 2, old again on C &minus; 1, new from C; clear: from C &minus; 2. Consulted on every ' +
      'dot of mode 3 with no object fetch in progress, each dot of a wait included (Rule E.9/6)</td><td>not gated: the Colour selects and fetches the object either way</td><td>not ' +
      'gated</td></tr>' +
      '<tr><td>outstanding-work test (1)</td><td>set: C; clear: C &minus; 1</td><td>set: C; clear: C &minus; 1</td><td>set: C; clear: C &minus; 1</td></tr>' +
      '<tr><td>object-enable at the merge (1), counted on the dot the pixel reaches the screen, one after its pop</td><td>set: C + 1; clear: C; for screen column 0 alone, on' +
      ' the dot it reaches the screen: set C, clear C &minus; 1 (E.1.3)</td><td>set: C + 1; clear: ' +
      'C</td><td>set: C + 1; clear: C</td></tr>' +
      '<tr><td>object height at the scan (2)</td><td>C + 1, set and clear</td><td>C + 1, set and clear</td><td>C + 1, set and clear</td></tr>' +
      '<tr><td>object height, fetch low-plane address (2)</td><td>C + 1, set and clear</td><td>C, set and clear</td><td>C, set and clear</td></tr>' +
      '<tr><td>object height, fetch high-plane address (2)</td><td>C &minus; 2 when the object&rsquo;s (OAM X + SCX) mod 8 is below 5 (tag 10), otherwise C (tag 8), whether or not the fetch actually waited (Rule E.1.3/6); set and clear</td><td>C, set and clear</td><td>C, set and clear</td></tr>' +
      '<tr><td>background map read (3)</td><td>C, set and clear</td><td>C + 1, set and clear</td><td>C + 1, set and clear</td></tr>' +
      '<tr><td>background tile-data reads (4)</td><td>C, set and clear</td><td>C, set and clear</td><td>C, set and clear</td></tr>' +
      '<tr><td>window tile-data reads (4)</td><td>C &minus; 1, set and clear</td><td>low read: C &minus; 2; high read: set C, clear C &minus; 2</td><td>low read: C &minus; 1; high read: set C, clear C &minus; 1</td></tr>' +
      '<tr><td>window comparator, stop test, arming test (5)</td><td>C &minus; 2, set or clear; the stop ' +
      'test reads this view two dots behind the tile-number step it acts on, so a step executing on C or ' +
      'later stops on the new value (section 11, site 1)</td><td>C &minus; 2, set or clear</td><td>set: ' +
      'C; clear: C &minus; 1</td></tr>' +
      '<tr><td>window map read (6)</td><td>C &minus; 2, set and clear</td><td>C &minus; 1, set and clear</td><td>C + 1, set and clear</td></tr>' +
    '</tbody></table>' +
    '<div class="gbemu-example"><b>Example: the outstanding-work test, a set and a clear.</b> Original, display on, write cycle on 97 to 100, so C&nbsp;=&nbsp;104. A write that <b>sets</b> object-enable (bit 1): the outstanding-work test reads the bit as set from dot 104 (C) and as clear on 103 and before. A write that <b>clears</b> it: the test reads the bit as clear from dot 103 (C&nbsp;&minus;&nbsp;1). The same write as seen by object-enable at the merge: a set from 105 (C&nbsp;+&nbsp;1), a clear from 104 (C). Neither is &ldquo;C plus the tag&rdquo;.</div>' +
    '<div class="gbemu-why"><b>Why.</b> C is N + 3 at single speed and N + 1 in double speed, with N the first dot of the write&rsquo;s machine cycle (section 1); on the original with the display on, N + 7 (measured with <code>test/tabprobe</code>: every tag keeps its place against C, for a set and for a clear). Every dot here is <b>INSTRUMENT-MEASURED</b> on the shipped core: a per-dot probe evaluates each consumer&rsquo;s own accessor on every dot around writes that set and clear every bit, on the original, the Colour in both modes and the Colour in double speed. Which accessor each consumer uses, and so which tag, is READ FROM OUR OWN SOURCE; the three object-height fetch rows are the measured tag views (8, 9 and 10) applied to that reading. This is tier one in the sense of the paragraph on the two tiers below: a description of our core, exact, and what reproduces our renders. The cross-check against pixels: the background-enable row, applied to writes on known dots, reproduced the screen columns where the picture changed, column for column. <b>Falsifier:</b> any row reading differently on an instrumented build of the shipped core.</div>' +

    '<div class="gbemu-rule" id="gbr-E-9-5"><b>Rule E.9/5.</b> <b>The conflict-dot row of Rule E.9/2 is the register, not every consumer.</b> A consumer that reads the register (tags ' +
    '8, 9, 61, 6) sees the intermediate on the conflict dot. A tag-7 consumer does not read the register on that dot: while the conflict flag is up it ' +
    'reads the incoming value whole, set or clear. Background-enable at the merge is tag 7, so a clear ' +
    'reaches the merge on C &minus; 1 exactly as a set does, on both machines (Rule E.9/4, first row).</div>' +
    '<div class="gbemu-example"><b>Example.</b> Measured on <code>m3_lcdc_bg_en_change</code> line 19: the register reads <code>$93</code> on the conflict dot (dot 107) while the merge&rsquo;s view of background-enable already reads clear.</div>' +
    '<div class="gbemu-why"><b>Why.</b> Read from ' +
    'our own source and consistent with the per-dot probe behind E.9.1; an independent build measured the register reading at 343 px and 52 px on the two Color background-enable cells against 0 px for the tag-7 ' +
    'reading.</div>' +

    '<div class="gbemu-rule" id="gbr-E-9-6"><b>Rule E.9/6.</b> <b>On the original, object selection is consulted on every dot, not only at the notice.</b> The object test runs on every dot of mode 3 on which no object ' +
    'fetch is in progress (E.5), and every time it runs it reads object selection through its view in ' +
    'Rule E.9/4. So:' +
    '<ol class="gbemu-steps">' +
      '<li>An object waiting for the phase window (E.3) is tested afresh on each dot of its wait.</li>' +
      '<li>On a dot on which selection reads clear, no object is due, the pixel is popped as on any dot, and the wait dots already spent stay spent.</li>' +
      '<li>The fetch starts only on a dot on which selection reads set and the wait has ended; once it has started, selection is not consulted again for that object and the fetch completes.</li>' +
      '<li>An object passed over this way is not consumed: if selection reads set again while the output position is still within its eight columns, it is due again and meets a fresh wait.</li>' +
    '</ol>' +
    '<b>Except the hidden-object wait of E.3.4</b> (an object at OAM X 1 to 7 waiting before its fetch): that wait is counted in one counter for the whole line, not per object, set and cleared exactly as Rule E.3.1/5&rsquo;s steps say (set to 0 at mode-3 entry and at the end of every object test that ends any other way, a due object waiting for the phase window included). A dot on which selection reads clear runs no object test that finds an object due, so it leaves the counter untouched, so if selection reads set again while the object is still due, its wait resumes from the count it had reached, not from zero.</div>' +
    '<div class="gbemu-rule" id="gbr-E-9-7"><b>Rule E.9/7.</b> An object at OAM X 8 or more is due on any dot on which the output position (pixels output) is from X &minus; 8 to X &minus; 1 and it has not been fetched, and never after that. When two are due the lower OAM X goes first, so a passed-over object can hold back another only inside its own eight columns.</div>' +
    '<div class="gbemu-example"><b>Example.</b> Measured on <code>m3_lcdc_obj_en_change_variant</code> line 130: an object at OAM X = 16 is due ' +
    'from dot 105 and waits on 105 to 109; a write clearing bit 1 has C on 112, so selection reads ' +
    'clear from 110 (C &minus; 2), the dot the wait would have ended on, and output resumes on 110 with' +
    ' no fetch: the object cost its five wait dots and nothing more. It stays due while the output position is from 8 to 15 (Rule E.9/7).</div>' +
    '<div class="gbemu-why"><b>Why.</b> It is worth 96 pixels. Tested only when the wait begins ' +
    'instead: the original&rsquo;s board 24 of 24 to 23 of 24 ' +
    '(<code>m3_lcdc_obj_en_change_variant</code> 96&nbsp;px), the Mooneye cartridges unmoved. ' +
    'INSTRUMENT-MEASURED. The passed-over object meeting a fresh wait is READ FROM OUR OWN SOURCE; no cell we hold does this. The hidden-object wait counter is read from our source. The due window and the order of two due objects are MECHANISM, read from our source, <code>ppu_object_at</code>.</div>' +

    '<div class="gbemu-rule" id="gbr-E-9-8"><b>Rule E.9/8.</b> <b>The train of Rule E.9/2 applies only to a write that lands in internal mode 3 with the display on.</b> Mode 3 here is the picture&rsquo;s internal drawing mode (section 7), tested once in the write&rsquo;s machine cycle: on the original with the display on, after the four dots the write cycle runs first, and otherwise before any of its dots are processed. It begins on dot 84 and ends when the line&rsquo;s last pixel is in the queue and no object work is left, not when STAT reports mode 0. Anywhere else LCDC is a plain write first seen on N + 4, or N + 8 on the original with the display on, by every consumer at once.</div>' +
    '<div class="gbemu-example"><b>Example.</b> A write in mode 0 of the same line as E.9.1&rsquo;s, on the original with the display on: every consumer at once on N + 8 (measured).</div>' +
    '<div class="gbemu-why"><b>Why.</b> Read from our source, <code>ppu_mode</code> and <code>LCDC_M3ONLY</code>; the restriction to mode 3 is FITTED, worth one Mooneye row, <code>intr_2_mode0_timing_sprites</code>.</div>' +

    '<p class="gbemu-key"><b>E.9.1: One LCDC write, every dot.</b></p>' +
    '<div class="gbemu-rule" id="gbr-E-9-1-1"><b>Rule E.9.1/1.</b> An LCDC write in internal mode 3 with the display on must interleave its dots with its bus writes and repay exactly the dots it ran early, in this order. On the original with the display on, for a write cycle covering N to N&nbsp;+&nbsp;3:' +
    '<ol class="gbemu-steps">' +
      '<li>The write cycle processes its own four dots, N to N&nbsp;+&nbsp;3, with LCDC unchanged.</li>' +
      '<li>It processes N&nbsp;+&nbsp;4 (first lead dot, C&nbsp;&minus;&nbsp;3); then the first bus write puts the new bits 5 and 6 into the register.</li>' +
      '<li>It processes N&nbsp;+&nbsp;5 (last lead dot, C&nbsp;&minus;&nbsp;2); then the intermediate is written.</li>' +
      '<li>It processes N&nbsp;+&nbsp;6 (conflict dot, C&nbsp;&minus;&nbsp;1); then the final value is written: the last thing the write cycle does.</li>' +
      '<li>Of the five dots the train owes (<code>LCDC_PEND</code>, the pending repayment) the four already run are taken back, so the next machine cycle processes one dot, N&nbsp;+&nbsp;7 (C), before its own access, which therefore lands after N&nbsp;+&nbsp;7: exactly where it would have landed with no LCDC write.</li>' +
    '</ol>' +
    'Seven plus one is eight, two cycles of four: E.5&rsquo;s balance. On a Colour at single speed the train is the same, shifted to the Colour&rsquo;s phase (Rule E.9/2); when the write sets the tile-data select bit the Colour tab&rsquo;s glitch dot is spent on C inside the write&rsquo;s own cycle and four dots are owed instead of five. In double speed, for a write cycle covering two dots N and N&nbsp;+&nbsp;1: there are no lead dots; the write cycle processes the conflict dot N; C is N&nbsp;+&nbsp;1; and the dots owed are cut to the two-dot budget: the next cycle processes N&nbsp;+&nbsp;1, N&nbsp;+&nbsp;2 and N&nbsp;+&nbsp;3, and its access lands after N&nbsp;+&nbsp;3, exactly where it would have landed with no LCDC write (a write cycle covering 107 and 108: the next cycle processes 108, 109 and 110, and its access lands after 110).</div>' +
    '<p class="hw-readable">One worked example in absolute dots, measured rather than reasoned. The instruction is <code>LDH ($40),A</code> with A = <code>$FF</code> over LCDC = <code>$80</code> (display on, every other bit clear), on the original at single speed, on line 2 with no object on the line and SCX = 0. <code>LDH (n),A</code> is three machine cycles: the opcode read, the operand read and the write. The write cycle is placed on 97 to 100. &ldquo;Processed in&rdquo; names the processor machine cycle during which the picture unit actually steps that dot. INSTRUMENT-MEASURED with the per-dot probe in our source tree (<code>test/tabprobe</code>).</p>' +
    '<table class="gbemu-table"><thead><tr><th>Dot (event scale, from the line&rsquo;s dot 0)</th><th>Processed in</th><th>Named dot</th><th>LCDC as the register holds it</th><th>Consumers that first see the new value on this dot</th></tr></thead><tbody>' +
      '<tr><td>89 to 92</td><td>cycle 1, the opcode read; the read lands after 92</td><td></td><td><code>$80</code></td><td>none</td></tr>' +
      '<tr><td>93 to 96</td><td>cycle 2, the operand read; the read lands after 96</td><td></td><td><code>$80</code></td><td>none</td></tr>' +
      '<tr><td>97 to 100</td><td>cycle 3, the write cycle, which covers 97 to 100: its own four dots, run before the write&rsquo;s own code</td><td></td><td><code>$80</code></td><td>none</td></tr>' +
      '<tr><td><b>101</b></td><td>cycle 3</td><td>first lead dot, C &minus; 3</td><td><code>$80</code></td><td>a tag-6 consumer would; no shipped consumer carries tag 6. Then, between 101 and 102, the first bus write puts the new bits 5 and 6 into the register</td></tr>' +
      '<tr><td><b>102</b></td><td>cycle 3</td><td>last lead dot, C &minus; 2</td><td><code>$E0</code>: bits 5 and 6 new</td><td>window comparator, window stop test, per-frame arming test, window map read (bits 5 and 6, set or clear); object selection (tag 61) for a set, and for a clear from here on; the object fetch&rsquo;s high-plane address when that object&rsquo;s (OAM X + SCX) mod 8 is below 5 (tag 10; Rule E.1.3/6, whether or not the fetch waited). Then, between 102 and 103, the intermediate is written</td></tr>' +
      '<tr><td><b>103</b></td><td>cycle 3</td><td>conflict dot, C &minus; 1</td><td><code>$E1</code>: the intermediate</td><td>background-enable at the merge (tag 7); window tile-data reads (tag 7); the outstanding-work test when the write clears object-enable. Object selection reads the intermediate again here, so a set of bit 1 is old again on this dot. Then, between 103 and 104, the final value is written: the last thing the write cycle does</td></tr>' +
      '<tr><td><b>104</b></td><td>cycle 4 (the next instruction&rsquo;s opcode read), its only owed dot</td><td>commit, C, the last dot of the machine cycle after the write&rsquo;s</td><td><code>$FF</code></td><td>background map read, background tile-data reads, outstanding-work test for a set, object selection for a set (again), the high-plane address when the fetch did not wait (tag 8); object-enable at the merge when the write clears it</td></tr>' +
      '<tr><td><b>105</b></td><td>cycle 5</td><td>C + 1</td><td><code>$FF</code></td><td>object height at the scan and at the object fetch&rsquo;s low-plane address (tag 9: the pre-write value was still read on C); object-enable at the merge when the write sets it (the merge reads bit 1 as the register stood on the previous dot)</td></tr>' +
      '<tr><td>106 to 108</td><td>cycle 5; cycle 4&rsquo;s read landed after 104, cycle 5&rsquo;s lands after 108</td><td></td><td><code>$FF</code></td><td>none</td></tr>' +
    '</tbody></table>' +
    '<div class="gbemu-why"><b>Why.</b> The write cycle covers 97 to 100 and processes seven dots: its own four, 97 to 100, with LCDC unchanged, then 101, 102 and 103, landing its three bus writes between them. The next machine cycle processes one, 104, before its own access, which therefore lands after 104. The double-speed budget is measured with <code>test/tabprobe</code> (a write cycle on 90 and 91: it processes 90, the next cycle 91 to 93, four dots in two cycles); the Colour tab, section 10, records the balancing.</div>' +

    '<div class="gbemu-why"><b>Why tag 6 does not include the conflict dot, and that is the easiest ' +
    'row in the table to get wrong.</b> Read from source ' +
    ', <code>src/gb.c</code>, <code>lcdc_cw()</code> and the <code>LCDC_PRE_SPAN</code> ' +
    'block: a tag-6 consumer returns the pending value only while the early-visibility counter is ' +
    'live, that counter covers the lead dots and self-clears before the conflict dot, and the ' +
    'source states the consequence in as many words, on the conflict dot a tag-6 read ' +
    '<i>&ldquo;falls through to return the register, the two-stage INTERMEDIATE, which does not ' +
    'carry the new bit&rdquo;</i>. <b>So 6 is non-contiguous in exactly the way 61 is</b>, which ' +
    'strengthens the paragraph below rather than weakening it: the scale has TWO non-monotone ' +
    'members, not one. E.1.3&rsquo;s width column is exact on this: it says ' +
    '&ldquo;for the whole two-dot lead window&rdquo; and stops there. ' +
    '<b>Falsifier:</b> a build in which a tag-6 consumer reads the new value on the ' +
    'conflict dot at <code>LCDC_PRE_SPAN = 1</code>, the shipped value. (At ' +
    '<code>LCDC_PRE_SPAN = 2</code> it does: that arm exists, it is not shipped, and it ' +
    'closes 178 pixels while creating 908.)</div>' +
    '<div class="gbemu-why"><b>Why 7 and 61 are the pair that proves the scale is not an ordinal</b>, ' +
    'and why the distinction is worth the paragraph: they are both &ldquo;one dot early&rdquo; and ' +
    'they are <em>different dots</em>. A consumer tagged 61 sees the new value on the last lead dot ' +
    'and the <em>old</em> one on the conflict dot immediately after it. <b>That is not monotone in ' +
    'time</b>, and any implementation that models settling as a single scalar offset cannot express ' +
    'it. <b>Build your table on the dot predicate, not on our integers</b>: the predicate is ' +
    'the durable claim and the numbering is ours.</div>' +
    '<div class="gbemu-why"><b>The two tiers in this appendix, kept apart because one table ' +
    'carrying both would read as more authoritative than half of it is.</b> ' +
    '<b>Tier one: the dot arithmetic above is a description of THIS CORE and it is exact.</b> ' +
    'Every row is readable in <code>src/gb.c</code>&rsquo;s <code>lcdc_cw()</code> and checkable by ' +
    'anyone holding the source; that is why it is printed in dots instead of in tags, and it is ' +
    'what a reader needs in order to build the same machine. <b>It is not a finding about ' +
    'hardware</b> and nothing here claims it is. <b>Tier two: that the hardware settles this ' +
    'way is NOT ESTABLISHED</b>, and the next paragraph is why. Keep the two apart: an implementer ' +
    'copying tier one reproduces our renders, and a reader quoting tier one as silicon behaviour is ' +
    'quoting us.</div>' +
    '<div class="gbemu-why"><b>And the part of this that is NOT ESTABLISHED, stated so the decode ' +
    'above is not read as more than it is.</b> The mapping from tag to dot set is recoverable from ' +
    'E.1.3&rsquo;s own &ldquo;what the consumer sees&rdquo; column and from nothing else on this ' +
    'page; <b>no cartridge in this corpus reads an affected consumer on the conflict dot and on the ' +
    'last lead dot separately</b>, so the non-contiguity that 61 asserts rests on our own ' +
    'implementation rather than on a measurement. <b>What would establish it:</b> a cartridge that ' +
    'writes LCDC so that exactly one of those two dots falls inside an object fetch. Until then ' +
    'treat the table above as <b>a decode of our scale, not as a finding about the hardware</b>, ' +
    'and note that E.1.3 already records the one case where three tags give an identical board.</div>' +
    '</section>' +

  /* ================================================================ APP-F
   * THE LABEL SWEEP. Sections 5 and 15-17 label every claim; sections 7-14
   * and 18-20 carried no labels at all, which is the half of the page a
   * builder spends the most time in. Ninety-four claims judged, with the
   * vocabulary section 20 publishes plus the two rows it lacks.
   *
   * Rows carrying two labels -- a mechanism with a fitted parameter inside
   * it, or one sentence holding two numbers with different backing -- are
   * counted under both, so the totals exceed the row count. That is not an
   * error; it is the point.                                             */
  '</div>';
}
