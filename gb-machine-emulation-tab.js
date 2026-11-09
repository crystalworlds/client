/* ===========================================================================
 * Game Boy Emulation tab, area 1 of eight: Overview, build checklist and interface
 * gbMachineEmulationTabHTML(d) returns this area's HTML; the tab's composer in
 * gb-emulation-tab.js calls every area in order (2 November 2026: the tab
 * was split into area files so a builder can read one area at a time).
 * Loaded by a plain <script src> tag (the site must open over file://).
 * =========================================================================== */

function gbMachineEmulationTabHTML(d) {
  return '<div class="gbemu-area" id="gbemu-area-machine">' +

  '<section class="gbemu-hero">' +
    '<div class="gbemu-hero-num"><b>259</b>\n<span>of 264</span>\n</div><div class="gbemu-hero-txt"><h3>How to build a Game Boy that is actually correct</h3>' +
      '<p>This is the research, not the result. Everything below is what this project had to ' +
      'establish to reach <b>259 passing rows of 264</b> on the public Game Boy Emulator Shootout ' +
      'board (and zero differing pixels on every mealybug tearoom cartridge) ' +
      'written out so the next person does not have to derive it again. Section&nbsp;21 says ' +
      'exactly what that number is measured on and why published comparisons are not ' +
      'like-for-like; section&nbsp;22 names the rows <em>nobody</em> can win honestly, because a ' +
      'reader chasing those will lose weeks. The proof is at the bottom; the useful part is above it.</p>' +
      '<p>The figure counts whole rows. Section 17 records a closed defect on a row that still fails, ' +
      'and it does not count toward the board, because <b>118 of 120 pixels is ' +
      'not 118/120 of a row</b>. Every dependent figure on this page (the suite table, the ' +
      'ceiling ladder, the staged build order in appendix&nbsp;G.4, and the Colour page&rsquo;s ' +
      'equivalents) states the same board, and the ladder&rsquo;s own invariant is that ' +
      'its bottom equals the board.</p>' +
      '<p><b>If you are building rather than reading, start at appendix&nbsp;A.</b> The eight ' +
      'lettered appendices at the foot of this page are the reference layer: every hardware ' +
      'register with every bit by number and the five interrupt vectors (appendix A), the whole sound map (appendix B), the ' +
      'tile and object addressing formulas (appendix C), <b>all 512 opcode cells (500 instructions, the <code>CB</code> prefix and 11 undefined bytes) with their flags and cycle ' +
      'counts</b> (appendix D), <b>every pipeline constant with its label</b> (appendix E), the label and flexibility ' +
      'register (appendix F), the verification scorecard (appendix G), and the cartridge mappers register by register (appendix H). The ' +
      'numbered sections above them assume all of it ' +
      'and are about what is <em>hard</em>; the appendices are what is merely necessary, and a build ' +
      'needs both. <b>What this page does not carry</b> (a boot program, the test cartridges and their declared tables, other emulators&rsquo; source, our own source and probes) and what a host must supply instead is section 24&rsquo;s paragraph &ldquo;What the host must supply&rdquo;: every such name on this page is a pointer, and the behaviour is stated beside it.</p>' +
      '<p><b>What a build must implement (both tabs say the same).</b> These pages describe the core this site ships.</p>' +
      '<div class="gbemu-rule" id="gbr-0-1"><b>Rule 0/1.</b> A build must implement everything the shipped core does, with its current values. Every value this page states is the shipped core&rsquo;s current value.</div>' +
      '<div class="gbemu-rule" id="gbr-0-2"><b>Rule 0/2.</b> Three kinds of material are not required, and none of them is part of the core: ' +
      '<b>(1)</b> history: this page carries none, and a value from an older core, wherever a reader meets one, builds an older core, not a second valid one; ' +
      '<b>(2)</b> anything this page describes as switched off, an off arm, a research arm, refused, not shipped, or written but behind a switch that is off: a build that wants to match ours leaves it out; ' +
      '<b>(3)</b> anything the page puts outside the core (the site&rsquo;s player, the host&rsquo;s devices and files).</div>' +
      '<div class="gbemu-rule" id="gbr-0-3"><b>Rule 0/3.</b> On the original, four parts belong together, and a build must implement all four: the running processor&rsquo;s two-dot look (D.10.1), the drawing registers&rsquo; extra machine cycle (E.1), the dispatch holds of 3 and 1, and the mode-1 source on dot 6 (E.6). A build with any of the four left out is not the set this site is scored against.</div>' +
      '<div class="gbemu-rule" id="gbr-0-4"><b>Rule 0/4.</b> A part this page describes as part of the core is required. Where a build leaves such a part out, that is a gap in that build, not an option.</div>' +
      '<div class="gbemu-rule" id="gbr-0-5"><b>Rule 0/5.</b> <b>The build checklist.</b> A build of the original must implement every part on the list below. Each line points to where the part is specified, and names the area file that holds it (this page is split into eight area files, listed after this introduction). A part not on this list is either explanation or one of the &ldquo;not required&rdquo; kinds of Rule 0/2.</div><ul class="gbemu-bullets" style="list-style:none;padding-left:4px"><li>1. <b>Clocks and phase</b>: master clock, line and frame length, the processor-to-dot phase (dot clock one dot ahead), the frame step (section 1). <i>File: <code>gb-machine-emulation-tab.js</code>.</i></li><li>2. <b>The start</b>: the no-boot hand-over table (registers, divider, picture, pad select, video-memory logo, sound unit) and the power-on state for a boot program (section 3). <i>File: <code>gb-machine-emulation-tab.js</code>.</i></li><li>3. <b>The processor</b>: all 512 opcode cells with bytes, cycles and flags, <code>DAA</code>, the eleven undefined opcodes that lock (section 2, D.1 to D.7, D.12, the grids in D.3 and D.4). <i>File: <code>gb-cpu-emulation-tab.js</code>.</i></li><li>4. <b>HALT</b>: the two arms, the halt bug, EI/DI/RETI timing, EI then HALT with a request pending (D.8). <i>File: <code>gb-cpu-emulation-tab.js</code>.</i></li><li>5. <b>STOP</b> on the original: stop until a selected pad line reads low, divider reset, the blanking while stopped (D.9). <i>File: <code>gb-cpu-emulation-tab.js</code>.</i></li><li>6. <b>Interrupts</b>: the dispatch (five cycles, the IE re-sample after the high push), where a request is noticed, the running processor&rsquo;s two-dot look and its conditions (D.10, D.10.1, D.12.2; section 13). <i>Files: <code>gb-ppu-emulation-tab.js</code>, <code>gb-cpu-emulation-tab.js</code>.</i></li><li>7. <b>Timer and divider</b>: one counter read two ways, TIMA reload and its write rules; the serial port and its clock (section 4, A.1). <i>File: <code>gb-memory-emulation-tab.js</code>.</i></li><li>8. <b>Sprite-memory transfer</b>: start-up, lock, bus conflict (which bus, the byte read), source mapping incl. <code>0xE000</code> and up (section 4, section 5). <i>File: <code>gb-memory-emulation-tab.js</code>.</i></li><li>9. <b>The scan during a transfer</b>: stale latches, the grip lag at both edges, the mode-3 fetch&rsquo;s cursor (section 5). <i>File: <code>gb-memory-emulation-tab.js</code>.</i></li><li>10. <b>The sprite-memory corruption bug</b>: the row rule, the three expressions, which opcodes trigger it and when (section 5, D.11). <i>Files: <code>gb-memory-emulation-tab.js</code>, <code>gb-cpu-emulation-tab.js</code>.</i></li><li>11. <b>The scan</b>: ten objects, X order on the original (section 6, C.5, C.6). <i>File: <code>gb-ppu-emulation-tab.js</code>.</i></li><li>12. <b>Mode 3 and the fetcher</b>: the priming fetch, the fetcher&rsquo;s steps by dot, the push rule, the fine-scroll discard (sections 7 to 9, E.5, E.5.1). <i>File: <code>gb-ppu-emulation-tab.js</code>.</i></li><li>13. <b>The queues and the output stage</b>: pop, the one-dot output stage, the merge, palettes applied at the screen (section 10, E.1.2, E.1.3). <i>File: <code>gb-ppu-emulation-tab.js</code>.</i></li><li>14. <b>The window</b>: its Y condition, position counter, takeover comparator, row counter with both increment sites, insertions, holds (section 11, E.8 to E.8.4). <i>File: <code>gb-ppu-emulation-tab.js</code>.</i></li><li>15. <b>Objects</b>: the phase-window wait, the six-dot fetch, the parked fetcher, clipped objects and their floor, hidden objects, the pop hold, the stalled fetch&rsquo;s recorded inputs (section 12, E.3 to E.4). <i>File: <code>gb-ppu-emulation-tab.js</code>.</i></li><li>16. <b>Mid-line writes</b>: every register&rsquo;s first consumer dot from E.1.1 (the specification), the LCDC train and its tags, the palette OR, the column-0 rules (section 13, E.1 to E.1.5, E.9, E.9.1). <i>File: <code>gb-ppu-emulation-tab.js</code>.</i></li><li>17. <b>Status, LY and the comparator</b>: the status line, the mode sources and the report as two wires, the blind windows, line 153, the dispatch holds, the mode-0 report leads (section 14, E.6). <i>File: <code>gb-ppu-emulation-tab.js</code>.</i></li><li>18. <b>Memory access windows</b> by dot, and the power-on line (section 14, E.2). <i>File: <code>gb-ppu-emulation-tab.js</code>.</i></li><li>19. <b>Display on and off</b>: switch-on (the power-on line, the frame that writes nothing), switch-off (LY 0, line frozen, buffer kept) (section 14, A.3, E.2). <i>Files: <code>gb-ppu-emulation-tab.js</code>, <code>gb-memory-emulation-tab.js</code>.</i></li><li>20. <b>Sound</b>: the frame sequencer on the divider, the two square channels with sweep, envelope, length and the trigger chain, the wave channel, the noise channel&rsquo;s counter model, power and the DACs, read-back masks (sections 15 to 17, appendix B entire). <i>File: <code>gb-apu-emulation-tab.js</code>.</i></li><li>21. <b>Registers</b>: every bit of <code>FF00</code>-<code>FF7F</code> and its read-back value (appendix A.1 to A.5). <i>File: <code>gb-memory-emulation-tab.js</code>.</i></li><li>22. <b>The Super Game Boy receiver</b>: header gate, packet receiver, multi-player request, pad id (A.6). The borders and palettes are the site&rsquo;s, not the core&rsquo;s. <i>File: <code>gb-sgb-emulation-tab.js</code>.</i></li><li>23. <b>Mappers</b>: header decoding, the shared rules, MBC1, MBC2, MBC3 with its clock, MBC5, no mapper, the other licensed chips, the per-file boards (appendix H). <i>File: <code>gb-mappers-emulation-tab.js</code>.</i></li><li>24. <b>Addressing</b>: background and window maps, tile data in both forms, objects (appendix C). <i>File: <code>gb-ppu-emulation-tab.js</code>.</i></li></ul>' +
      '<p><b>Result of a build from this page alone.</b> An independent build that read only this tab (no other emulator, no boot program, no other document) wrote an original Game Boy in plain JavaScript. It had none of our test programs; we ran them on it and compared it with our core. It is identical to ours, with the same verdict and every checkpoint byte for byte, on 170 of 170 Game Boy and Super Game Boy test runs; it gives the same verdict as ours on all 14 AGE runs and the same picture as ours on all 24 mealybug cells. The board figure beside the title is our core&rsquo;s.</p></div></section>' +
  gbEmuAreaIndexHTML() +

  '<section class="sect" id="gbe-glossary"><h3 class="sect-h">Glossary</h3>' +
    '<p class="hw-readable">Every technical word on this tab is used only in the sense given here. Where a definition points to a rule or section, that place is the full statement.</p>' +
    '<h4 class="gbemu-sub">Clocks and scales</h4>' +
    '<dl class="gbemu-gloss">' +
      '<dt>T-cycle</dt><dd>one period of the master clock (section 1 gives the rate). Timer, divider and sound unit counts are in T-cycles unless a sentence says otherwise.</dd>' +
      '<dt>Machine cycle</dt><dd>four T-cycles on the original, and at the Color&rsquo;s single speed; two T-cycles in the Color&rsquo;s double speed. One processor step; every bus access belongs to exactly one machine cycle.</dd>' +
      '<dt>Dot</dt><dd>one step of the picture processor, one T-cycle long. Dots are numbered within a line from 0 (the first dot after the wrap into that line) to the line&rsquo;s last dot.</dd>' +
      '<dt>Line</dt><dd>the picture processor&rsquo;s own line counter, 0 to 153. Not the LY register&rsquo;s reading (on line 153 LY reads 0 early; section 14).</dd>' +
      '<dt>Event scale</dt><dd>"X happens on dot D" means X happens while the picture processor processes dot D. A read sees X from dot D + 1.</dd>' +
      '<dt>Access scale</dt><dd>"an access on dot D" is made when the line&rsquo;s dot counter reads D: dots 0 to D - 1 of that line are finished and dot D is not begun (section 14, "Access windows").</dd>' +
      '<dt>First-seen dot</dt><dd>the access-scale dot from which a read sees a change. For an event on dot D (event scale) it is D + 1. Every table must say which of the two scales its dot column uses.</dd>' +
      '<dt>N</dt><dd>the first dot covered by the machine cycle that carries a processor write (appendix E.1.1).</dd>' +
      '<dt>C, the commit dot</dt><dd>the first dot on which a nominal consumer (tag 8) reads a new LCDC value (appendix E.9).</dd>' +
      '<dt>Tag</dt><dd>an integer that names one consumer&rsquo;s view of the LCDC register in the settling scale of appendix E.9 (our source calls it a settling width). A tag is a name, not a count of dots; the dots on which each tag reads a set and a clear are E.9&rsquo;s table.</dd>' +
      '<dt>Sound tick</dt><dd>one step of the sound unit, 2 T-cycles long. Two sound ticks per machine cycle at single speed, one in the Color&rsquo;s double speed.</dd>' +
    '</dl>' +
    '<h4 class="gbemu-sub">The picture pipeline</h4>' +
    '<dl class="gbemu-gloss">' +
      '<dt>Push</dt><dd>the fetcher moves 8 pixels into the background queue.</dd>' +
      '<dt>Pop</dt><dd>a pixel leaves the background queue (with the object queue&rsquo;s pixel for the same column) toward the screen.</dd>' +
      '<dt>Output stage</dt><dd>the one-dot stage after the pop. The palette is applied there; a pixel reaches the screen one dot after its pop.</dd>' +
      '<dt>Fetcher position (pos)</dt><dd>step x 2 + sub-dot, counted from the fetcher&rsquo;s last restart (section 9 numbering). Dots spent in an object stall do not advance it.</dd>' +
      '<dt>Parked</dt><dd>the fetcher is at its push step holding a full row <b>and</b> the background queue is not empty, so it cannot push and holds there; it counts as pos 7. A fetcher at its push step with an empty queue is not parked: it pushes on that dot (Rule E.3/3).</dd>' +
      '<dt>Object fetch</dt><dd>the fetch of one object&rsquo;s two tile-data bytes, six dots unless a rule of E.3 lengthens or shortens it; "in progress" from its first dot to its last.</dd>' +
      '<dt>Notice dot</dt><dd>the first dot on which the object test finds an object due. If the fetcher is then in the phase window, the object fetch begins on that same dot; otherwise the object waits and its fetch begins on a later dot. Counts that run "from the fetch" (E.6) start at the fetch&rsquo;s first dot, not at the notice dot (Rules E.5.1/1, E.3.3/4).</dd>' +
      '<dt>Internal mode 3</dt><dd>, <b>internal mode-0 entry</b>: the picture processor&rsquo;s own phases (section 7). Not the reported mode.</dd>' +
      '<dt>Reported mode</dt><dd>the mode bits STAT returns to a read.</dd>' +
      '<dt>Interrupt-logic mode</dt><dd>the picture processor&rsquo;s second mode value, the one that drives the three mode interrupt sources (section 14). It can differ from the reported mode.</dd>' +
      '<dt>Status line</dt><dd>the OR of every selected STAT interrupt source; a request is raised on its rising edge.</dd>' +
      '<dt>Takeover</dt><dd>the window starting on a line: the background queue is cleared and the fetcher restarts on the window.</dd>' +
      '<dt>Power-on line</dt><dd>the first line after the display is switched on (appendix E.2).</dd>' +
    '</dl>' +
    '<h4 class="gbemu-sub">Processor</h4>' +
    '<dl class="gbemu-gloss">' +
      '<dt>Instruction boundary</dt><dd>the point after an instruction&rsquo;s last machine cycle where pending interrupt requests are tested.</dd>' +
      '<dt>The look</dt><dd>at an instruction boundary of a running original processor, the picture runs two dots beyond S before the interrupt test, when every condition of Rule D.10.1/5 holds (Rules D.10.1/4 to D.10.1/7). Never used for any other early sample.</dd>' +
      '<dt>S</dt><dd>the line&rsquo;s dot counter at an instruction boundary once the owed dots are paid (access scale): the dot the next opcode fetch&rsquo;s access is made on with no look (Rule D.10.1/3); the dispatch&rsquo;s dots in D.12.2 are counted from it.</dd>' +
      '<dt>Hand-over</dt><dd>the machine state when a cartridge starts without a boot program (section 3).</dd>' +
    '</dl>' +
    '<h4 class="gbemu-sub">Other</h4>' +
    '<dl class="gbemu-gloss">' +
      '<dt>Sprite-memory transfer</dt><dd>the transfer started by a write to <code>FF46</code> (section 4). On the Color, the <b>block transfer</b> is the <code>FF51</code>-<code>FF55</code> transfer (Color tab, section 11).</dd>' +
      '<dt>Evidence labels</dt><dd>(MECHANISM, FITTED, CONVERGENCE, INSTRUMENT-MEASURED, NOT ESTABLISHED, ...): defined in appendix F. They are facts about how a statement is known and stay on the tab.</dd>' +
    '</dl>' +
    '<h4 class="gbemu-sub">Words with one sense across the tab</h4>' +
    '<dl class="gbemu-gloss">' +
      '<dt>B</dt><dd>the dots (equal to T-cycles) in one machine cycle: 4 on the original and on the Color at single speed, 2 in double speed (Rules E.1.1/1, E.5/3). The sound area uses the same B, counted in T.</dd>' +
      '<dt>Lead</dt><dd>for one register write, how many dots of the write&rsquo;s machine cycle fall after the register takes the value (E.1). E.5 calls the constant handed to the write path L. Explanation only: the specification is E.1.1&rsquo;s absolute dots.</dd>' +
      '<dt>Lead dots, conflict dot</dt><dd>for a mode-3 LCDC write, the dots before C on which some consumers already see new bits, and the one dot on which the register reads the two-stage intermediate (E.1.1&rsquo;s LCDC row, E.9).</dd>' +
      '<dt>Train (LCDC write train)</dt><dd>the dots a mode-3 LCDC write passes through: lead dots, the conflict dot, C (E.9, Rule E.1.3/1).</dd>' +
      '<dt>Output position</dt><dd>the count of pixels popped so far on the line (our source&rsquo;s <code>lx</code>), 0 to 160; it is the screen column of the next pixel (Rules E.5/9, E.6/4, E.9/7).</dd>' +
      '<dt>Pre-visible position</dt><dd>a per-line count that stands at -15 before mode 3 and rises by one on every mode-3 dot with no object fetch in progress until it reaches the live SCX &amp; 7; it decides when an object at OAM X 0 to 7 is due (Rule E.3.1/2; our source&rsquo;s <code>px_pos</code>).</dd>' +
      '<dt>Phase window</dt><dd>fetcher pos 4, 5 and 6 (section 9 numbering), the three dots ending immediately before the push; the push (pos 7) is not in it (Rule E.3/1).</dd>' +
      '<dt>Priming fetch</dt><dd>the line&rsquo;s first background fetch at the start of mode 3 (section 9, E.8).</dd>' +
      '<dt>Position counter (<code>win_px</code>)</dt><dd>the window&rsquo;s per-line x counter, with its priming increments (Rule E.8.4/1).</dd>' +
      '<dt>Dispatch hold</dt><dd>the dots for which a fresh status request is hidden from the interrupt test: 3 dots after a status edge on line 0, 1 dot after a coincidence edge (Rule E.6/2, section 14). Its length is the <b>dispatch lag</b>.</dd>' +
      '<dt>Positive control</dt><dd>a run that must show the effect before a null result counts (Rule G.3/2).</dd>' +
      '<dt>Row</dt><dd>one row of the 264-row board (appendix G). A <b>cell</b> is one checked unit inside a test cartridge&rsquo;s own table.</dd>' +
      '<dt>INFO</dt><dd>a board row with no pass reference; it is neither PASS nor FAIL (G.1).</dd>' +
      '<dt>Basis</dt><dd>what a stated score is measured on: machine, boot program, core (section 21, G).</dd>' +
      '<dt>Arm</dt><dd>one switchable variant of a core behaviour, built for measurement; the shipped core is the arm a build must match.</dd>' +
      '<dt>Board</dt><dd>the 264-row board of record. A cartridge&rsquo;s circuit is written "cartridge board" (appendix H).</dd>' +
    '</dl>' +
    '<h4 class="gbemu-sub">Words whose sense depends on the area (the area decides; no area uses two senses)</h4>' +
    '<dl class="gbemu-gloss">' +
      '<dt>Owed</dt><dd>in E.5, the picture dots a machine cycle has still to process after its access (<code>2B - withheld</code>). On the Color tab&rsquo;s block transfer (section 11), a block that a horizontal blank has made due and the transfer has not yet moved.</dd>' +
      '<dt>W</dt><dd>in sections 4 and 5 and appendix A, the machine cycle of the write to <code>FF46</code> that starts a sprite-memory transfer (A is the dot it becomes active). In E.6 only, the first dot of a processor sample window (Rule E.6/8).</dd>' +
      '<dt>Block</dt><dd>in section 5 and appendix A, a memory access refused by a transfer (contrast conflict). In E.6, the mode-0 report block (Rule E.6/5). On the Color tab, one 16-byte unit of the block transfer.</dd>' +
    '</dl>' +
    '<h4 class="gbemu-sub">Overview and interface (sections 1, 3, 24)</h4>' +
    '<dl class="gbemu-gloss">' +
      '<dt>Covers (a machine cycle covers dots)</dt><dd>The four dots the picture unit advances through between the previous machine cycle&rsquo;s bus access and this one&rsquo;s. A read in the cycle sees the effect of its last dot and nothing later; a write with no lead is first seen on the dot after its last dot. On the original every machine cycle covers dots 4k + 1 to 4k + 4 of the line (Rule 1/4), reached from each start as Rule 1/5 gives. (Rule 1/4, Rule 1/5)</dd>' +
      '<dt>Dot clock leads by one dot</dt><dd>Shorthand on this page for Rule 1/4&rsquo;s phase: cycles cover 4k + 1 to 4k + 4, not 4k to 4k + 3 (which is "in phase"). (Rule 1/4)</dd>' +
      '<dt>Frame step</dt><dd>One call of the core&rsquo;s frame routine, the unit a harness that counts frames counts; it ends at a fixed place in the picture (line 144, dot 0, with the display on), never simply after a frame of dots from its start. (Rule 1/2 (decision table))</dd>' +
      '<dt>One frame of dots</dt><dd>The frame length of Rule 1/1, used as a count when the picture does not reach line 144; counted in processor T-cycles (halved in double speed). (Rule 1/1, Rule 1/2)</dd>' +
      '<dt>Booted start / no-boot start</dt><dd>A run that executes the console&rsquo;s boot program from the power-on state (Rule 3/5), against one that starts at 0x0100 in the hand-over state (Rules 3/2 to 3/4, 3/9 to 3/11). (Rule 3/1)</dd>' +
      '<dt>Power-on state</dt><dd>The cleared machine a boot program starts from. Not the "power-on line" (first line after the display is switched on, E.2). (Rule 3/5)</dd>' +
    '</dl>' +
    '<h4 class="gbemu-sub">Processor (section 2, appendix D)</h4>' +
    '<dl class="gbemu-gloss">' +
      '<dt>an enable scheduled / an enable in flight</dt><dd>an EI has run and IME has not yet become set (it becomes set as the next instruction completes) (D.8 opening paragraph; Rule D.8/5)</dd>' +
      '<dt>the halt bug</dt><dd>HALT executed with IME clear, no enable scheduled and pending not 0: the processor does not halt and the next opcode fetch does not advance PC (that byte is fetched twice) (Rule D.8/1, row 1)</dd>' +
      '<dt>pending (D.8)</dt><dd>IE &amp; IF &amp; 0x1F, with the status bit left out while E.6&rsquo;s line-0 or coincidence hold runs; the same view every sample of the request reads (D.8 opening paragraph; Rule D.10.1/2)</dd>' +
      '<dt>STOP mode</dt><dd>the state a non-armed STOP enters: the processor fetches nothing until a selected joypad line reads low, while every machine cycle is an ordinary 4-T tick for the rest of the machine. Replaces "park" / "parked" in D.9, because "parked" is the seed&rsquo;s word for the picture fetcher (Rule D.9/5)</dd>' +
      '<dt>armed (speed switch)</dt><dd>a STOP executes on a Color, in colour mode, with KEY1 bit 0 set: all three (Rule D.9/2)</dd>' +
      '<dt>data access</dt><dd>a bus read or bus write an instruction performs (Rule D.1/2&rsquo;s second primitive), as opposed to a fetch of an opcode or operand byte at PC (Rule D.1/2; used in Rule D.10.1/7)</dd>' +
      '<dt>M1 ... M5 (of a dispatch)</dt><dd>the five machine cycles of an interrupt dispatch, M1 being the cycle that would have fetched the next opcode (Rule D.10/1, Rule D.12.2/1)</dd>' +
    '</dl>' +
    '<h4 class="gbemu-sub">Memory, timer, transfers (sections 4, 5, appendix A)</h4>' +
    '<dl class="gbemu-gloss">' +
      '<dt>Overflowing tick</dt><dd>The T-cycle on which the counting register (TIMA) increments from <code>0xFF</code>; the timer request is set on it. (Rule 4/3)</dd>' +
      '<dt>Overflow machine cycle</dt><dd>The machine cycle that contains the overflowing tick. (Rule 4/3)</dd>' +
      '<dt>Reload machine cycle</dt><dd>The whole machine cycle after the overflow machine cycle; TMA is copied into TIMA inside its four timer ticks, before its access. (Rule 4/3)</dd>' +
      '<dt>W, A (sprite-memory transfer)</dt><dd>W: the machine cycle carrying the write to <code>0xFF46</code>; A: the access-scale dot of that write&rsquo;s access. Transfer cycles count from W, transfer dots from A. (Rule 4/6)</dd>' +
      '<dt>Transfer active</dt><dd>The transfer&rsquo;s state from W+2&rsquo;s step (before W+2&rsquo;s access) to W+162&rsquo;s step; stays set through a restart. The picture processor sees it from dot A+8. (Rules 4/6, 4/7, 4/8)</dd>' +
      '<dt>Lock (of sprite memory)</dt><dd>Processor reads of sprite memory return <code>0xFF</code> and writes are dropped, W+2 to W+161. A block, not a conflict. (Rules 4/6, 4/11)</dd>' +
      '<dt>Block / conflict</dt><dd>A block substitutes a constant for one region (sprite memory). A conflict returns the byte the transfer is moving that cycle, on a processor access in the same bus group as the transfer&rsquo;s source. (Rule 5/9)</dd>' +
      '<dt>Bus group</dt><dd>One of four classes an address falls in for the conflict rule: external (cartridge program memory and cartridge RAM), video, work RAM and its echo, none (high RAM, registers, sprite memory). On the original, external and work RAM conflict with each other. (Rule 5/9)</dd>' +
      '<dt>Grip, grip lag L</dt><dd>The scan&rsquo;s read suppression during a transfer; it follows the transfer-active state L dots late (L = 1 or 2; shipped 2), at both edges. (Rule 5/5)</dd>' +
      '<dt>Held latches</dt><dd>The two byte-wide object-memory latches (even byte, odd byte), shared with the mode-3 tile fetch; during the grip they keep their previous contents. (Rule 5/4)</dd>' +
      '<dt>dots_into_the_line</dt><dd>The picture&rsquo;s dot counter at the start of the machine cycle that carries a corruption event (bus access: after the cycle&rsquo;s four dots, less 4). (Rule 5/2)</dd>' +
      '<dt>copy_row(dst, src), copy_tail(dst, src)</dt><dd>Copy all four 16-bit words, or words 1 to 3 only, of sprite-memory row src into row dst. (Rule 5/3)</dd>' +
      '<dt>Effective mask</dt><dd>The byte ORed into a processor read of an address in <code>FF00</code>-<code>FF7F</code>: the OR table&rsquo;s entry, or for the five dead entries (P1, SC, TAC, IF, STAT) the mask in A.5.1&rsquo;s table. (Rule A.5/1)</dd>' +
      '<dt>Dead entry</dt><dd>An OR-table entry for an address the I/O decoder answers before the array; printed <code>00</code>, its effective mask is elsewhere. (A.5.1)</dd>' +
    '</dl>' +
    '<h4 class="gbemu-sub">Picture (sections 6 to 14)</h4>' +
    '<dl class="gbemu-gloss">' +
      '<dt>Internal end of mode 3</dt><dd>The first dot on which, after that dot&rsquo;s draw block, pixels popped + pixels queued - discards still owed that will drop a pixel reach 160 and no object work is left. Changes once per line. The fetcher&rsquo;s last push of the line. (Rule 7/3)</dd>' +
      '<dt>Internal mode-0 entry</dt><dd>The dot the 160th pixel of the line is popped. The horizontal-blank transfer and the palette window key to it. (Rule 7/5)</dd>' +
      '<dt>Early push</dt><dd>The push attempt on pos 5 (high-plane step). Taken only by the priming fetch and the window&rsquo;s restart fetch. (Rule 9/3)</dd>' +
      '<dt>Y condition</dt><dd>Frame-scoped flag: set on a dot where WY equals the picture&rsquo;s own line counter and window-enable reads set in the comparator&rsquo;s view; cleared at the wrap into line 0 and at switch-off; set at switch-on when WY is 0. (Rule 11/2)</dd>' +
      '<dt>Window row counter (<code>win_line</code>)</dt><dd>The window&rsquo;s own line counter: +1 at the end of each activation; 0 at the wrap into line 0, switch-on, switch-off. (Rules 11/1, 11/5, 11/6)</dd>' +
      '<dt>Activation</dt><dd>The run of the window from a takeover to its end at site 1 (window-enable read low at the tile-number step) or site 2 (the line wrap). (Rule 11/5)</dd>' +
      '<dt>Site 1 / site 2</dt><dd>The two increment sites of the row counter (mid-line end of an activation / the line wrap with the window active). (Rules 11/5, 11/7)</dd>' +
      '<dt>Line primed by a write</dt><dd>A line on which a WX write took effect while the priming fetch was outstanding (new WX first seen on dots 85 to 89); the only kind of line on which the comparator subtracts its one-dot correction. (Rule 11/10)</dd>' +
      '<dt>Frame flag (<code>win_frame_act</code>)</dt><dd>Set when the window takes over on some line of the frame; cleared at the wrap into line 0, switch-on and switch-off. (Rules 11/6, 11/14)</dd>' +
      '<dt>Fine-scroll discard</dt><dd>One of the <code>SCX &amp; 7</code> pixels popped from the background queue only, at the start of the line; does not advance the screen column, the object queue or the window x counter. (Rules 10/2, 11/12, 11/13)</dd>' +
      '<dt>Interrupt-logic mode "none"</dt><dd>The value (-1 in our source) the interrupt-logic mode takes from dot 4 to the end of the scan; it drives no mode source. (Rule 14/7)</dd>' +
      '<dt>Coincidence edge</dt><dd>Any rising edge of the status line raised while the coincidence term (STAT bit 6 and the flag) is high, including one a mode source raises on the same dot. (Rule 14/11)</dd>' +
      '<dt>Blind window (comparator)</dt><dd>The dots during which the line comparator&rsquo;s output is forced low: 4 dots at the start of every line, and a second 4 on line 153 from access dot 8. (Rules 14/14, 14/15)</dd>' +
      '<dt>Carry</dt><dd>A blind window never clears a coincidence flag that is already high while the comparison still holds (<code>LYC_CARRY</code>); acts only at the 153-to-0 wrap. (Rule 14/15)</dd>' +
    '</dl>' +
    '<h4 class="gbemu-sub">Picture (appendices C, E.1, E.2)</h4>' +
    '<dl class="gbemu-gloss">' +
      '<dt>Line boundary</dt><dd>Dot 0 of a line on this page&rsquo;s scale: four dots (<code>LINE_PRE</code>) before the mode-2 scan starts. Every absolute dot on the tab counts from it unless a table says otherwise. (Rule E/1)</dd>' +
      '<dt>Observable scale</dt><dd>Dots counted from the start of the mode-2 scan, where an ordinary line&rsquo;s mode 3 begins on dot 80. This page&rsquo;s scale minus 4. (Rule E/1, Rule E/3, E.2 table)</dd>' +
      '<dt>Drawing registers</dt><dd>LCDC, SCY, SCX, BGP, OBP0, OBP1 and WX: the seven registers that take the original&rsquo;s extra machine cycle with the screen on. (Rule E.1/8)</dd>' +
      '<dt>Extra machine cycle (the original&rsquo;s write lag)</dt><dd>On the original with LCDC bit 7 = 1 before the write, a drawing-register write lands four dots later than its lead alone gives (<code>DMG_WRITE_LAG</code> = 4). (Rule E.1/8)</dd>' +
      '<dt>Two-stage write</dt><dd>A write whose register holds an intermediate for one dot before the real value: LCDC (<code>old ((new &amp; BG_ENABLE)</code>) and, on the original, BGP (`old)</dd>' +
      '<dt>OR dot / OR transient</dt><dd>The one dot on which BGP holds <code>old (new</code> on the original; the one-column transient it draws.)</dd>' +
      '<dt>Output dot (of a column)</dt><dd>The dot on which that screen column&rsquo;s pixel reaches the screen: one dot after its pop (98 + x on an object-free line at SCX = 0). (Rule E.1.1/4, Rule E.1.2/1)</dd>' +
      '<dt>Live mode</dt><dd>The picture processor&rsquo;s own phase (internal mode); video-memory reads close on it. Contrast reported mode. (Rule E.1.5/2)</dd>' +
      '<dt>Access blocking</dt><dd>The closing of video or sprite memory to processor accesses around mode 3 (reads 6 dots early on the live mode, writes on the reported mode). Distinct from register visibility. (Rule E.1.5/2)</dd>' +
      '<dt>Pending repayment (<code>pending</code>)</dt><dd>The dots the LCDC two-stage write site repays after its access; <code>pending = B - 1 + lead</code>, which is E.5&rsquo;s <code>owed</code> minus the site&rsquo;s one internal tick. (Rule E.1.3/8 and its explanation)</dd>' +
      '<dt>Power-on line, start dot, wrap dot, threshold</dt><dd>The dot counter&rsquo;s seed after the enable write (8), the dot at which that line wraps (459) and the fixed mode-3 entry dot (84); legal choices satisfy threshold - start = 76 and wrap - start = 451. (Rules E.2/3, E.2/4)</dd>' +
    '</dl>' +
    '<h4 class="gbemu-sub">Picture (E.3, E.4)</h4>' +
    '<dl class="gbemu-gloss">' +
      '<dt>Wait (of an object)</dt><dd>The dots from the object&rsquo;s notice dot up to, not including, the first dot of its object fetch. The background fetcher steps on them; nothing is popped. (E.3 head paragraph; Rule E.3.3/1)</dd>' +
      '<dt>Stall (of an object)</dt><dd>The dots of the object&rsquo;s fetch, first to last inclusive: six, or more for a clipped object held by the floor at line dot 100, or one fewer per dot credited by the pop hold. The background fetcher does not step; nothing is popped. (E.3 head paragraph; Rules E.3.1/3, E.3.3/1, E.3.4/3)</dd>' +
      '<dt>Cost (of an object)</dt><dd>Wait plus stall: the dots the object adds to mode 3. (E.3 head paragraph)</dd>' +
      '<dt>Residue / alignment key</dt><dd><code>(OAM X + SCX) mod 8</code>, not <code>OAM X mod 8</code>. Residue r meets the window as though it arrived at pos <code>(r - 1) mod 8</code> (steady cycle). (Rule E.4/3; E.3 residue example)</dd>' +
      '<dt>Run</dt><dd>A maximal sequence of objects served at the same output position with no pixel emitted between them; ends when a dot passes with no object due, or when an object is noticed whose OAM X differs from the last one fetched. (Rule E.4/1)</dd>' +
      '<dt>Re-entry wait</dt><dd>The wait paid by the first object of a run: distance to the next dot with the fetcher in the phase window; <code>max(0, 5 - ((OAM X + SCX) mod 8))</code> in the steady cycle; 0 to 5 dots. (Rule E.4/2)</dd>' +
      '<dt>Clipped object</dt><dd>An object at OAM X 0 to 7 (screen positions -8 to -1). Bypasses the phase window; noticed by the output position. (Rule E.3.1/1)</dd>' +
      '<dt>Hidden object (that waits)</dt><dd>A clipped object at OAM X 1 to 7 with X + (SCX &amp; 7) of 8 or more; waits <code>max(0, 5 - ((X + SCX) mod 8))</code> dots, counted by the line&rsquo;s one wait counter, before its fetch. (Rule E.3.1/5)</dd>' +
      '<dt>Line&rsquo;s wait counter</dt><dd>One counter per line (not per object), set to 0 at mode-3 entry; rises on each object-test dot on which a hidden object waits; set to 0 on any other object-test outcome; unchanged on dots with no object test or no object due. Source name <code>obj_gap</code>. (Rule E.3.1/5)</dd>' +
      '<dt>Real pops</dt><dd>Pixels popped toward the screen, not counting fine-scroll discards (the count <code>lx</code>). (Rules E.3.1/6, E.3.4/2)</dd>' +
      '<dt>Seam cell / seam object</dt><dd>The object at OAM X = 8 (screen column 0), the smallest X served through the phase window. (Rule E.3.1/6)</dd>' +
      '<dt>Floor (object-fetch floor)</dt><dd>No object fetch, of any OAM X, may end before line dot 100. (Rule E.3.1/3)</dd>' +
      '<dt>F (in E.3.3)</dt><dd>The first dot of an object fetch: the notice dot for a clipped object; the dot its wait ends for an object served through the phase window. (Rule E.3.3/4)</dd>' +
      '<dt>Owed read</dt><dd>A map, low-plane or high-plane read of the tile fetch an object fetch freezes, still to execute at F. (Rule E.3.3/4)</dd>' +
      '<dt>Would-be dot</dt><dd>The dot an owed read would have executed on with no object present. (Rule E.3.3/4)</dd>' +
      '<dt>Recording dot</dt><dd>The dot after an owed read&rsquo;s would-be dot, on which its inputs are recorded (if it falls inside the stall). (Rule E.3.3/4)</dd>' +
      '<dt>One-dot lead</dt><dd>SCX and SCY are recorded as they stood at the start of the would-be dot, not at its end. FITTED, shipped value 1. (Rule E.3.3/5)</dd>' +
      '<dt>Pop hold (position hold)</dt><dd>A dot on which an object sits at the current real-pop count and the queue holds a pixel pops nothing; the dot is credited to the coming object fetch. Home also in E.5. (Rule E.3.4/3)</dd>' +
    '</dl>' +
    '<h4 class="gbemu-sub">Picture (E.5 to E.7)</h4>' +
    '<dl class="gbemu-gloss">' +
      '<dt>withheld / owed</dt><dd>Dots a write&rsquo;s machine cycle processes before its access (<code>max(0, B - L)</code>) and owes after it (<code>2B - withheld</code>). (Rule E.5/3)</dd>' +
      '<dt>Debt</dt><dd>The picture dots owed from the previous machine cycle, processed before the next access; drained at every instruction boundary. (Rules E.5/2, E.5/5)</dd>' +
      '<dt>Settling counter</dt><dd>A per-dot down-counter (LCDC lead, conflict and late counters, window-position hold, comparator blind window, dispatch holds) decremented at the head of each dot; armed to N it covers N - 1 dots. (E.5 step 2, Rule E.5/7)</dd>' +
      '<dt>Position hold</dt><dd>The pop withheld on a dot where the next pixel would leave at an unfetched selected object&rsquo;s column (OAM X - 8); each held dot is taken off that object&rsquo;s fetch. (Rule E.5/9)</dd>' +
      '<dt>Pop dot / frame-buffer write</dt><dd>A pixel&rsquo;s pop dot is when it leaves the background queue; it is written to the screen at the next dot&rsquo;s output stage. Scale-table "leaves" figures are pop dots. (Rules E.5.1/2, E.5.1/3)</dd>' +
      '<dt>Pixels still to leave</dt><dd>160 minus the pixels popped so far on the line, the current dot&rsquo;s pop included. (Rule E.6/4)</dd>' +
      '<dt>Object dots still owed</dt><dd>The dots the object fetch in progress still needs after this dot (6 minus the fetch&rsquo;s dots so far, its first dot counting as one, minus position-hold credit), or 0 with none in progress. (Rule E.6/4)</dd>' +
      '<dt>Case (A) / (B) / (C) line</dt><dd>Mode-0 report cases: no object selected / an object fetch has started on the line (from that fetch&rsquo;s first dot) / objects selected, no fetch started yet. (Rule E.6/3)</dd>' +
      '<dt>Line-0 hold</dt><dd>On line 0, a fresh status-line request is hidden from the dispatch test for 3 dots after it rises. (Rule E.6/2)</dd>' +
      '<dt>Sample window, W</dt><dd>The run of event-scale dots whose events one processor sample sees together (on our original, 4k - 3 to 4k); W is its first dot. (Rule E.6/8)</dd>' +
    '</dl>' +
    '<h4 class="gbemu-sub">Picture (E.8, E.9)</h4>' +
    '<dl class="gbemu-gloss">' +
      '<dt>Priming increments</dt><dd>the counter&rsquo;s seven increments from the 7th dot of mode 3 on which no object fetch is in progress (dots 90 to 96 with no object); pause on stall dots; continue after a takeover (Rule E.8.4/1)</dd>' +
      '<dt>Primed by a write / unprimed line</dt><dd>primed: a WX write takes effect while the priming fetch is outstanding (first seen on dots 85 to 89); every other line is unprimed (Rule E.8.1/1)</dd>' +
      '<dt>priming_bump</dt><dd>1 on a dot of a primed line while the priming increments run and this dot&rsquo;s increment has landed; 0 otherwise (Rule E.8/4)</dd>' +
      '<dt>Held WX (<code>WX_cmp</code>)</dt><dd>the WX the takeover comparator uses: <code>wx_old</code> on the hold dot when <code>wx_old</code> is 7 or more, otherwise the register (Rule E.8/3)</dd>' +
      '<dt>Hold (WX hold)</dt><dd>a counter armed to 2 by a WX write, decremented at the head of each dot; in force on the one dot on which it is not 0 after the decrement, the first dot on which the register holds the new WX (Rule E.8/3)</dd>' +
      '<dt>Live WX</dt><dd>the WX register as it stands on the dot a test is made, with no hold and no correction (E.8.1 index table)</dd>' +
      '<dt>Drop (window column drop)</dt><dd>one of the 7 - WX window pixels removed from the queue for WX below 7, one per dot from the push dot; a drop dot outputs nothing (Rule E.8.1/7)</dd>' +
      '<dt>Fine-scroll stall dot</dt><dd>on the original, one of the s dots after the drops of a takeover made while the discard was pending: no pop, no drop, no counter step (Rule E.8.1/4)</dd>' +
      '<dt>Insertion</dt><dd>a dot that outputs one colour-0 pixel without popping the background queue or stepping the fetcher (Rules E.8.2/1, E.8.3/1)</dd>' +
      '<dt>Path A / path B</dt><dd>the two takeover paths: after the priming fetch has completed / while it is outstanding (Rule E.8.1/7)</dd>' +
      '<dt>Drawing dot</dt><dd>every dot from the line&rsquo;s dot 84 until the dot its 160th pixel is popped, object-stall and window-restart dots included (Rule E.8.3/3)</dd>' +
      '<dt>Set / clear (in E.9&rsquo;s tables)</dt><dd>a write that sets the consumer&rsquo;s LCDC bit / one that clears it; a cell naming one dot without either word applies to both (Rule E.9/4)</dd>' +
      '<dt>Outstanding-work test</dt><dd>the LCDC bit 1 consumer that decides whether object work is still owed on the line; set seen from C, clear from C - 1 (Rule E.9/4)</dd>' +
    '</dl>' +
    '<h4 class="gbemu-sub">Sound (sections 15 to 17)</h4>' +
    '<dl class="gbemu-gloss">' +
      '<dt>Cartridge tick</dt><dd>SameSuite&rsquo;s word in its sound files for one 1 MHz machine cycle, 4 T. Never a sound tick (2 T). Rule sentences write "tick" only as "sound tick". (Rule 16/1 explanation (NAMING COLLISION))</dd>' +
      '<dt>Restart / cold trigger</dt><dd>A restart is a trigger written while the channel&rsquo;s NR52 enable flag reads 1; a cold trigger one written while it reads 0. (Sound area head; Rules 16/1, 16/2)</dd>' +
      '<dt>Our seam / the other seam (sound)</dt><dd>Our seam: a processor write reaches the sound unit before that machine cycle&rsquo;s sound ticks, a read after them. The other seam: the write lands after the ticks, and every trigger reload drops the B term. (Rule 15/6 steps 2 and 5; Rule 16/1)</dd>' +
      '<dt>Countdown (of a channel)</dt><dd>The channel&rsquo;s period counter in T: loaded by a trigger (Rule 16/1), decremented by 2 at every sound tick; it expires at 0 or below and the period is added back. (Rules 16/1, 16/10)</dd>' +
      '<dt>Frame-sequencer event</dt><dd>One falling edge of the selected divider bit, tested once per machine cycle at Rule 15/6 step 3; it performs one step unless the skip flag is armed. (Rules 15/2, 15/4, 15/5, 15/6)</dd>' +
      '<dt>Step counter</dt><dd>The frame sequencer&rsquo;s 0 to 7 counter: set to 7 by power-on, incremented before the step is performed. (Rules 15/3, 15/4)</dd>' +
      '<dt>Skip flag</dt><dd>One bit armed by a power-on write while the selected divider bit reads 1; the next falling edge clears it and performs nothing. (Rule 15/5)</dd>' +
      '<dt>Staged / pending duty</dt><dd>A duty written to NR11/NR21 is staged; after the cycle&rsquo;s sound ticks it is pending; at the next reload it is in force. (Rule 16/5)</dd>' +
      '<dt>Late check (sweep)</dt><dd>The held stop of the sweep&rsquo;s second, overflow-only calculation and of the trigger&rsquo;s check: 32 T + B (step-armed) or 32 T + 2B (trigger-armed); it stops the channel only if NR10&rsquo;s shift is non-zero when it lands. (Rule 16/6)</dd>' +
      '<dt>Void window / step stop (sweep)</dt><dd>The 12 T countdown every channel-1 trigger loads (a step overflow while it is above 0 is voided), and the 8 T countdown an unvoided step overflow loads (lands with no shift test). (Rule 16/9)</dd>' +
      '<dt>p (wave channel)</dt><dd>The index (0 to 31) of the sample channel 3 read most recently, as an access or trigger arrives. (Rules 17/3, 17/6)</dd>' +
      '<dt>Mod-4 clock, down-counter, up-counter, examination, expiry (noise)</dt><dd>The three cascaded noise stages: a mod-4 clock stepping every sound tick; a 4-bit down-counter examined at phase 3 (and at phase 1 while the latched code is 0), expiring at 0 and reloading from the divisor code (0 reloads as 1); a 14-bit up-counter incremented per expiry whose shift-selected bit&rsquo;s rising edge steps the register. (Rule 17/13)</dd>' +
    '</dl>' +
    '<h4 class="gbemu-sub">Sound (appendix B)</h4>' +
    '<dl class="gbemu-gloss">' +
      '<dt>Sequencer step</dt><dd>One step 0 to 7 of the frame sequencer. Length on 0, 2, 4, 6; sweep on 2 and 6; envelope on 7. Our counter sits at 7 across a power-on and is incremented before the step runs. (Rules B.7/2, B.13/7, B.14/1)</dd>' +
      '<dt>Sequencer event</dt><dd>One falling edge of the sequencer&rsquo;s divider bit (bit 12 of the internal counter; bit 13 on the Colour in double speed). An event performs one sequencer step unless the power-on skip suppresses it. (Appendix B head; Rules B.11/3, B.16/2)</dd>' +
      '<dt>Power-on skip</dt><dd>One bit of state, armed when the sound unit is powered on while the sequencer&rsquo;s divider bit is high, consumed by the next sequencer event, which then performs no step. (Rule B.11/3; section 15)</dd>' +
      '<dt>Duty position (duty step counter)</dt><dd>A pulse channel&rsquo;s place 0 to 7 in its duty pattern; advances on each period-counter expiry; not reset by a trigger; set to 0 by powering the sound unit off. "Duty step counter" in B.16 means the same thing. Distinct from the duty timer (the period counter), which a trigger reloads. (Rules B.4/1, B.16/4, B.16/6)</dd>' +
      '<dt>Envelope step</dt><dd>The volume moving by one in the envelope&rsquo;s direction (saturating) and the envelope timer reloading with the pace; happens when the envelope timer reaches 0, or once as the extra step of Rule B.13/6. Not the same as an envelope sequencer step (step 7). (Rules B.8/3, B.13/6)</dd>' +
      '<dt>Sweep step</dt><dd>The expiry of the sweep timer with a non-zero pace and an armed sweep: one calculation, and at a non-zero shift a write-back and a second calculation. (Rules B.9/4, B.9/5)</dd>' +
      '<dt>Shadow (sweep)</dt><dd>The sweep&rsquo;s copy of channel 1&rsquo;s period, loaded at each trigger; calculations use it, not NR13/NR14. (Rule B.9/1)</dd>' +
      '<dt>Negate-used flag</dt><dd>Set by any sweep calculation made with NR10 bit 3 = 1, cleared at every trigger; clearing bit 3 while it is set disables channel 1. (Rules B.9/2, B.9/6)</dd>' +
      '<dt>DAC powered</dt><dd>Channels 1, 2, 4: NRx2 &amp; 0xF8 non-zero; channel 3: NR30 bit 7. An unpowered DAC contributes exactly 0 to the mix and keeps its channel disabled. (Rules B.8/4, B.12/1)</dd>' +
      '<dt>Digital output</dt><dd>A channel&rsquo;s value 0 to 15 before its DAC (what PCM12/PCM34 return on the Colour). Digital 0 is a rail (DAC output -15), not silence. (Rules B.4/2, B.12/1)</dd>' +
      '<dt>Case 1 / Case 2 (envelope write glitch)</dt><dd>The NRx2-while-enabled volume change with a non-zero old pace (Case 1) or a zero old pace (Case 2). (Rules B.13/1 to B.13/3)</dd>' +
      '<dt>live (Case 2)</dt><dd><code>(new NRx2 value &amp; 0x0F) != 0</code>: the write leaves the direction bit or the pace non-zero. (Rule B.13/3)</dd>' +
      '<dt>Extra envelope step flag</dt><dd>One-shot per channel, armed by an NRx2 write to an enabled channel taking the pace from 0 to non-zero; consumed on the next odd sequencer step. (Rules B.13/6, B.13/7)</dd>' +
      '<dt><code>next_clocks_length()</code></dt><dd>The length predicate: false while the power-on skip is armed; otherwise true exactly when the last performed sequencer step is odd. (Rule B.14/1)</dd>' +
      '<dt>Restart (noise)</dt><dd>A trigger of channel 4 while it is already enabled. (Rule B.15/1)</dd>' +
      '<dt>Trigger start delay (noise), <code>ns_trig</code></dt><dd>The time from the trigger write to the counter reset: 8 + (code 1 ? 4) + (restart ? 2) + 4 T, on the sound clock, not scaled by double speed. Not the first step. (Rules B.15/1, B.15/2)</dd>' +
      '<dt>APU&rsquo;s own start delay</dt><dd>The trailing flat 4 T of the noise trigger delay. Never called the write lead or the read offset. (Rule B.15/3)</dd>' +
      '<dt>Write lead (bus seam)</dt><dd>One machine cycle (4 T single speed, 2 T double): the processor&rsquo;s write reaches the sound unit before that cycle&rsquo;s sound ticks. Paid by call order, never added as a constant to a sound-clock delay. (Rules B.15/3, B.16/3)</dd>' +
      '<dt>Harness read offset</dt><dd>The 2 T at single speed between the shift-register step and the first processor read that can see it; the difference between B.15&rsquo;s table (16, 16, 20, 28) and the in-core times (14, 14, 18, 26). (Example under Rule B.15/3)</dd>' +
      '<dt>Mod-4 clock, examination phase</dt><dd>The noise counter&rsquo;s clock, +1 at the top of each sound tick, zeroed only by sound-unit power-on; the down-counter is examined at phase 3 (every code) and also at phase 1 while the latched divisor code is 0. (Rule B.17/2; section 17)</dd>' +
    '</dl>' +
    '<h4 class="gbemu-sub">Cartridges (appendix H)</h4>' +
    '<dl class="gbemu-gloss">' +
      '<dt>Low window / high window / RAM window</dt><dd><code>0x0000</code>-<code>0x3FFF</code> / <code>0x4000</code>-<code>0x7FFF</code> / <code>0xA000</code>-<code>0xBFFF</code> of the processor&rsquo;s map, as the cartridge fills them. (H intro, "Words and units")</dd>' +
      '<dt>Program bank</dt><dd>16 KiB of the cartridge image; bank numbers count from 0 at the image&rsquo;s first byte. (H intro; Rule H.1/2)</dd>' +
      '<dt>RAM bank</dt><dd>8 KiB of cartridge RAM, counted from 0 (MBC6&rsquo;s RAM windows use 4 KiB banks, named as such). (H intro; Rules H.1/7, H.10/25)</dd>' +
      '<dt>rom_banks, cartridge mask</dt><dd>The program bank count fixed at load by Rule H.1/2 (always a power of two, 2 to 512); the mask is rom_banks - 1, applied last when a bank number is formed. (Rule H.1/2)</dd>' +
      '<dt>Widening</dt><dd>Doubling rom_banks at load until it covers the file (at most 512); only for a cartridge with a mapper; never narrows. (Rule H.1/2 step 2)</dd>' +
      '<dt>Mapper write</dt><dd>A processor write to <code>0x0000</code>-<code>0x7FFF</code>; it reaches the mapper&rsquo;s bank, enable and mode registers. A write to the RAM window is not a mapper write. (Rule H.2/1)</dd>' +
      '<dt>RAM enable test</dt><dd><code>(v &amp; 0x0F) == 0x0A</code> (MBC1, MBC2, MBC3, MBC5, MMM01, the camera, MBC7&rsquo;s first enable). MBC6 and MBC7&rsquo;s second enable test the whole byte. (Rules H.2/2, H.10/6, H.10/25)</dd>' +
      '<dt>Zero-to-one correction</dt><dd>"If the bank number is 0, use 1", applied to the bank register&rsquo;s own value before the cartridge mask (MBC1 on BANK1 alone, MBC2, MBC3); absent on MBC5, HuC1, HuC3, MBC7. (H intro; Rules H.3/2, H.6/2)</dd>' +
      '<dt>BANK1, BANK2, MODE</dt><dd>MBC1&rsquo;s 5-bit primary bank register, 2-bit secondary register and 1-bit mode register. (Rule H.3/1)</dd>' +
      '<dt>Multicart variant</dt><dd>An MBC1 image of exactly 1 MiB whose logo repeats at two or more of <code>0x40104</code>, <code>0x80104</code>, <code>0xC0104</code>; BANK1 counts as 4 bits. (Rules H.3/5, H.3/6)</dd>' +
      '<dt>Selector (MBC3)</dt><dd>The byte stored by a write to <code>4000</code>-<code>5FFF</code>: a RAM bank or a clock register; read and write paths decode it differently. (Rule H.5/2)</dd>' +
      '<dt>Running counter / latched copy</dt><dd>MBC3&rsquo;s two copies of the five clock registers: writes reach the running counter, reads return the latched copy, a latch write copies the first into the second. (Rule H.5/5)</dd>' +
      '<dt>Clock second</dt><dd>one second of emulated time: as many T-cycles as the master clock&rsquo;s rate in section 1 (the processor&rsquo;s T-cycles at single speed; twice as many processor T-cycles in double speed). Also the unit of the HuC3 and TAMA5 clocks and of the MBC7 busy time and camera capture length scale. (Rule H.5/4)</dd>' +
      '<dt>Time away</dt><dd>Whole seconds since the battery save, applied by the host (MBC3) or by the core on request (HuC3, TAMA5). (Rule H.9/1)</dd>' +
      '<dt>Mode register (HuC3)</dt><dd>Low nibble of a write to <code>0000</code>-<code>1FFF</code>; chooses what the RAM window is (RAM, mailbox, response, semaphore, infrared). (Rules H.10/2, H.10/3)</dd>' +
      '<dt>Pin byte (MBC7)</dt><dd>The byte at offset <code>8_</code> of <code>A000</code>-<code>AFFF</code>: bit 7 chip select, 6 clock, 1 data in, 0 data out. (Rule H.10/9)</dd>' +
      '<dt>Rising clock edge (MBC7)</dt><dd>A pin-byte write with bit 6 set after one with bit 6 clear, chip select high. (Rule H.10/9)</dd>' +
      '<dt>Busy (MBC7)</dt><dd>8,389 T-cycles on the clock-second scale after a write or erase; data out reads 0. (Rule H.10/10)</dd>' +
      '<dt>Footer header (MMM01)</dt><dd>The header at the start of the image&rsquo;s last 32 KiB. (Rule H.10/11)</dd>' +
      '<dt>Locked / unlocked (MMM01)</dt><dd>Before / after the write with bit 6 set at <code>0000</code>-<code>1FFF</code>; bits marked "only while unlocked" cannot change after it. A lock mask is a different thing: it protects program or RAM bank bits from the write that sets it. (Rule H.10/12)</dd>' +
      '<dt>Slot (M161)</dt><dd>A 32 KiB part of the image; slot s maps banks 2s and 2s + 1. (Rules H.10/14, H.10/15)</dd>' +
      '<dt>Flash window, window offset (MBC6)</dt><dd>An 8 KiB window at <code>4000</code> or <code>6000</code> that maps flash; the offset is the address less the window&rsquo;s start. (Rules H.10/25, H.10/26)</dd>' +
      '<dt>Phases (Gowin)</dt><dd>Show, check, off: the switch&rsquo;s three states, counted in reads of <code>0100</code>-<code>01FF</code>. (Rule H.11/3)</dd>' +
    '</dl>' +
    '<h4 class="gbemu-sub">Tests (sections 18 to 20)</h4>' +
    '<dl class="gbemu-gloss">' +
      '<dt>Knock-out price</dt><dd>The difference, row by row, between the shipped build and the same build with one thing disabled, scored on the same board at the same commit; stated as fixed and broken separately, with its commit. (Rules 20/9, 20/10)</dd>' +
      '<dt>Snapshot</dt><dd>A number that is a property of the whole core at one commit (a knock-out price); carries its commit and is re-measured before it is quoted for another commit. (Rule 20/12)</dd>' +
      '<dt>Historical fact</dt><dd>A number that records what was measured at one commit in one copy ("worth zero in that copy"); does not date; reported, never re-measured. (Rule 20/12)</dd>' +
      '<dt>Null</dt><dd>A result of 0 fixed / 0 broken (or zero events); a measurement of the pair (the change and the tree it was measured in). (Rules 20/7, 20/19)</dd>' +
      '<dt>Tree / working copy</dt><dd>The whole source state a measurement was taken in; a null names it. (Rule 20/7)</dd>' +
      '<dt>Registration</dt><dd>The table written before a change is built: axis check, MUST MOVE with falsifiers, MUST NOT MOVE with the named risk. (Rule 20/5)</dd>' +
      '<dt>Unobservable (decision)</dt><dd>No value tried moved a byte of output; a bound, not a proof. (Census table; Rule 20/31)</dd>' +
    '</dl>' +
    '<h4 class="gbemu-sub">Scores (sections 21 to 23)</h4>' +
    '<dl class="gbemu-gloss">' +
      '<dt>Shared set</dt><dd>The rows on which all four emulators of the rival table were run: the board less the 3 rows Emulicious and DocBoy were never run on (Rule 21/5)</dd>' +
      '<dt>Control / candidate</dt><dd>The build without and with a change; a board run compares their framebuffer bytes row by row (Rule 21/2)</dd>' +
      '<dt>Checkpoint</dt><dd>A point in a row&rsquo;s run at which the framebuffer is compared (Rule 21/2)</dd>' +
      '<dt>Ceiling</dt><dd>The board&rsquo;s row count minus every row deducted (no reference; declined; unreachable; partially derivable); equivalently the board of record plus the rows still open. Holds only for one set of decisions (Rule 21/7)</dd>' +
      '<dt>Decline</dt><dd>A decision not to win a row by a means that is available; always carries a reopen condition (Rules 21/9, 21/10, 22/1)</dd>' +
      '<dt>Reopen condition</dt><dd>The stated event that would reopen a declined or unreachable row (Rules 21/9, 22/1)</dd>' +
      '<dt>Cell (of a test)</dt><dd>One declared check in a test cartridge&rsquo;s own table (for example one of the 64 of channel_4_freq_change); a row passes only when all its cells pass (Rule 22/2)</dd>' +
      '<dt>Site</dt><dd>A place in the core where a change or a fitted value could be made (Rules 22/6, 22/7)</dd>' +
      '<dt>Protected ground, protected cells</dt><dd>Rows and cells already passing that a candidate change must not move (Rules 22/4, 22/7)</dd>' +
      '<dt>Knob, knob registry</dt><dd>A setting the sweep tooling can change; the registry is the list a sweep enumerates (Rule 22/10)</dd>' +
      '<dt>Forced fork</dt><dd>A claim that no structure can satisfy two authorities at once; it is a decline and carries a reopen condition (Rule 21/9; section 22, the fork rows)</dd>' +
      '<dt>Boot residue</dt><dd>What the boot program leaves in video memory, on which some mealybug cartridges depend; quoted as one of three figures (3,423 at a board of 17,825; 3,481 net; 3,827 absolute) (Rule 23/2)</dd>' +
    '</dl>' +
    '<h4 class="gbemu-sub">Labels (appendix F)</h4>' +
    '<dl class="gbemu-gloss">' +
      '<dt>Page vocabulary</dt><dd>The six F.1 labels: the only words F.2 counts (F.1; Rule F.1.1/2)</dd>' +
      '<dt>Appendix word (finer label)</dt><dd>A word from sections 15 to 17 and appendices B and E (BOUNDED, NOT VALUED; FORCED in kind, READ OFF in value; NOT PINNED; DECLINED; ...) that lives under one F.1 label and adds to it, never replaces it. DECLINED is a decision, not a label (F.1.1 table; Rule F.1.1/1)</dd>' +
      '<dt>Claim (in appendix F)</dt><dd>One row of F.4 to F.7 or F.9, that is a statement from the numbered section, with its label and evidence (F.4 caption)</dd>' +
      '<dt>Label column</dt><dd>The middle column of F.4 to F.7 and F.9; the only column whose words are counted (Rule F.2/1)</dd>' +
      '<dt>Label assignment</dt><dd>One occurrence of a label word in a row&rsquo;s Label column. Not the same as a claim: a row may carry two or three (Rule F.2/1)</dd>' +
      '<dt>Labelled row / unlabelled row</dt><dd>A row whose Label column carries at least one label word / none (design rule, definitional, implementation choice, withdrawal, method rule, declared basis) (F.2)</dd>' +
      '<dt>Excess (assignments)</dt><dd>Assignments beyond one per labelled row: 17 in F.2. Not the number of rows carrying more than one label (15) (Rule F.2/2 and its example)</dd>' +
      '<dt>The sweep</dt><dd>The labelling of sections 7 to 14 and 18 to 20 in F.4 to F.7 (eleven sections, 87 claims); F.9 is counted separately (Appendix F head; Rule F.2/4; Rule F.9/1)</dd>' +
      '<dt>Longest match</dt><dd>In F.9&rsquo;s count, a label word inside a longer label word (MEASURED inside INSTRUMENT-MEASURED) counts as the longer word only (Rule F.9/3)</dd>' +
      '<dt>Excluded label word</dt><dd>A label word named only to be ruled out ("not MECHANISM"); not an assignment (Rule F.9/4)</dd>' +
      '<dt>Invariant (flexibility register)</dt><dd>The condition in F.8&rsquo;s third column that a build must satisfy; the Ours column is our shipped choice and is not required (Rule F.8/1)</dd>' +
      '<dt>Shipped representative</dt><dd>The value our core ships for a quantity the evidence only bounds (BOUNDED, NOT VALUED); must be stated wherever the quantity appears (F.1.1 table, BOUNDED row)</dd>' +
      '<dt>Figures check</dt><dd>The page&rsquo;s automatic check that recounts appendix F&rsquo;s figures from its own tables (appendix G.7). Used on the tab in place of "dependent-figure gate" (Rule F.2/2 Why box; F.9 comparison paragraph)</dd>' +
    '</dl>' +
    '<h4 class="gbemu-sub">Verification (appendix G)</h4>' +
    '<dl class="gbemu-gloss">' +
      '<dt>Pass-reference / fail-reference</dt><dd>a reference PNG a row ships: by default the cartridge&rsquo;s path with <code>.png</code>; a <code>.fail.png</code> is the fail-reference (Rule G.1/3)</dd>' +
      '<dt>Match</dt><dd>no pixel of the absolute greyscale difference (8-bit, no dithering) exceeds 50 (Rule G.1/1)</dd>' +
      '<dt>Stage, worth, cumulative</dt><dd>a step of the build order; the board rows its gates contain; the running sum of worths from stage 0 (a projection, not a measured history) (G.4 table; Rule G.4/2)</dd>' +
      '<dt>Falsifier</dt><dd>the observation that would show a measurement wrong; its scope is the axis swept, never the row (Rule G.5/1, step 4)</dd>' +
      '<dt>Census</dt><dd>counting how many lines, cartridges and cells reach a clause, by instrumenting the clause (Rule G.6/3)</dd>' +
      '<dt>Frozen origin / monotone watch / pixel identities</dt><dd>the baseline written once; the best value per cell ever seen; the wrong pixels at the state that set each best (G.4, stage 5 bullet)</dd>' +
      '<dt>Gate, check, relation</dt><dd>the figures program (<code>tools/check-emulation-figures.js</code>); one assertion in it; what a check asserts between figures (never a value) (G.7; Rule G.7/1)</dd>' +
      '<dt>Mutation proof</dt><dd>mutate one guarded figure, require the run to fail naming that check, revert (Rule G.7/6)</dd>' +
      '<dt>Coverage accounting, span, registry</dt><dd>every extraction records the page text it consumed (its span); every statement of a registry figure must fall inside some span (Rules G.7/11, G.7/14, G.7/15)</dd>' +
    '</dl>' +
  '</section>' +


  '<section class="sect gbemu-area-head" id="gbemu-area-machine-head"><h3 class="sect-h">Area 1 of eight: Overview, build checklist and interface</h3>' +
    '<p class="gbemu-key">Start here: what this page is, the rule for what a build must implement, the build checklist (each line names the file that holds the part), the clocks, the memory map and the frame step, where the machine starts (the no-boot hand-over and the power-on state for a boot program), and what the host must supply.</p>' +
    '<p class="hw-readable">This area is the file <code>gb-machine-emulation-tab.js</code>, one of the eight area files that together make the Game Boy Emulation tab. It can be read on its own; the build checklist is in the first area, and the rule for what a build must implement is beside it.</p>' +
    '<p class="hw-readable"><b>Where the rest of this page is.</b> When a sentence here points to a section or appendix that is not in this area, it is in one of these files (the links work on the assembled page):</p><ul class="gbemu-bullets"><li><b>Processor</b> (<code>gb-cpu-emulation-tab.js</code>): <a href="#gbe-m2">2. The processor</a> <a href="#gbe-ops">Appendix D. The instruction set</a></li><li><b>Memory, timer, interrupts, transfers, serial, pad</b> (<code>gb-memory-emulation-tab.js</code>): <a href="#gbe-m4">4. Timer, DMA, interrupt line</a> <a href="#gbe-hw">5. What a real Game Boy settled</a> <a href="#gbe-regs">Appendix A. Every register, every bit</a></li><li><b>Picture</b> (<code>gb-ppu-emulation-tab.js</code>): <a href="#gbe-m5">6. The sprite scan</a> <a href="#gbe-1">7. The decision that decides everything</a> <a href="#gbe-2">8. Step the machine by dots</a> <a href="#gbe-3">9. The fetcher</a> <a href="#gbe-4">10. The two FIFOs</a> <a href="#gbe-5">11. The window is a separate machine</a> <a href="#gbe-6">12. Sprites stall the pipeline</a> <a href="#gbe-7">13. Writes that land mid-line</a> <a href="#gbe-8">14. Interrupts, blocking, power</a> <a href="#gbe-addr">Appendix C. Tile, map and object addressing</a> <a href="#gbe-pipe">Appendix E. The picture pipeline, in numbers</a></li><li><b>Sound</b> (<code>gb-apu-emulation-tab.js</code>): <a href="#gbe-s1">15. The sound unit is not on the processor&rsquo;s clock</a> <a href="#gbe-s2">16. The square channels</a> <a href="#gbe-s3">17. Wave, noise, and power</a> <a href="#gbe-sound-regs">Appendix B. The sound registers, and the primitives the refinements modify</a></li><li><b>Cartridges and mappers</b> (<code>gb-mappers-emulation-tab.js</code>): <a href="#gbe-mappers">Appendix H. The cartridge mappers, register by register</a></li><li><b>Super Game Boy and link devices</b> (<code>gb-sgb-emulation-tab.js</code>): <a href="#gbe-sgb">Appendix A, continued: the Super Game Boy and the link-port devices</a></li><li><b>Tests and scores</b> (<code>gb-acceptance-emulation-tab.js</code>): <a href="#gbe-9">18. Traps that cost us weeks</a> <a href="#gbe-10">19. What to test with, in order</a> <a href="#gbe-11">20. How to measure a change</a> <a href="#gbe-score">21. The score, and what a score is worth</a> <a href="#gbe-unwinnable">22. Rows nobody can win honestly</a> <a href="#gbe-12">23. The evidence</a> <a href="#gbe-labels">Appendix F. Labels, flexibility, and what is not established</a> <a href="#gbe-verify">Appendix G. The verification scorecard</a></li></ul>' +
  '</section>' +
  '<div class="gbemu-toc"><b>In this area</b><a href="#gbe-m1">1. Clocks, map, and one phase that matters</a><a href="#gbe-m3">3. Where the machine starts</a><a href="#gbe-gaps">24. What this page does not cover</a></div>' +

  '<section class="sect" id="gbe-m1"><h3 class="sect-h">1. Clocks, map, and one phase that matters</h3>' +
    '<div class="gbemu-rule" id="gbr-1-1"><b>Rule 1/1.</b> The master clock, the machine cycle, the line and the frame must be exactly as this table gives them.</div>' +
    '<table class="gbemu-table"><thead><tr><th>Quantity</th><th>Value (each row names its unit)</th></tr></thead><tbody>' +
      '<tr><td>Master clock</td><td><b>4,194,304 Hz.</b> One tick is a <em>T-cycle</em>, and one T-cycle is one <em>dot</em>.</td></tr>' +
      '<tr><td>Machine cycle</td><td><b>4 T-cycles.</b> Every processor bus access is exactly one of these, and nothing on the bus takes less.</td></tr>' +
      '<tr><td>Scanline</td><td><b>456 dots.</b> 154 lines per frame: 144 visible, 10 of vertical blank.</td></tr>' +
      '<tr><td>Frame</td><td><b>70,224 dots</b>, giving 59.7275 frames per second. Not 60.</td></tr>' +
    '</tbody></table>' +

    '<h4 class="gbemu-sub">The frame step</h4>' +
    '<p class="hw-readable"><b>What one frame step of our core runs, which is what a harness that counts ' +
    'frames counts.</b> A frame is not &ldquo;the next frame&rsquo;s worth of dots&rdquo;. It is cut at a fixed place in ' +
    'the picture, so a program that switches the display off and on does not leave every later frame ' +
    'shifted against the hardware&rsquo;s.</p>' +
    '<div class="gbemu-rule" id="gbr-1-2"><b>Rule 1/2.</b> A frame step must end as this decision table gives, by what the display does during the step. Every row ends the same way: the step finishes the instruction in progress and then returns. One frame of dots is the frame of Rule 1/1. <b>How the rows combine.</b> The step makes these three tests at each instruction boundary (and before every idle machine cycle of a halt or of STOP mode), and any one that holds ends it:<ol class="gbemu-steps"><li>The picture has entered line 144 since the step began.</li><li>The display is off at this boundary and one frame of dots has passed since the step began.</li><li>Two frames of dots have passed since the step began.</li></ol>Each test reads only the state at that boundary and the count from the step&rsquo;s start, never the switches before it, so a display switched on, off and on again inside one step is judged by the same three tests. No test falls between a dispatch and the handler&rsquo;s first instruction.</div>' +
    '<table class="gbemu-table"><thead><tr><th>Display during the step</th><th>Where the step stops (a line and dot of the picture, or a count from the step&rsquo;s own start)</th></tr></thead><tbody>' +
      '<tr><td><b>On</b></td><td>When the picture enters line 144, that is the wrap from line 143 into line 144, dot 0, when all 144 visible lines are in the frame buffer. That is the same dot on both machines; on the original the vertical-blank request is raised there too, while on the Colour the request and the mode-1 report come three dots later (the Colour tab, section 10), and the step does not wait for them. <b>Exactly</b>: the mark is set at the wrap itself, as line 143&rsquo;s dot 455 is processed (Rule E.5/11), before line 144&rsquo;s dot 0 is processed. The step reads the mark before the next boundary pays its owed dots (Rule D.10.1/3, step 1), so a wrap among those dots is read only after that boundary has run its instruction (any dispatch first), and that is the instruction the step finishes. With the display running, consecutive steps are therefore exactly one frame of dots apart, but they are phased to the picture, not to the start point.</td></tr>' +
      '<tr><td><b>Off for the whole step</b></td><td>The picture never reaches line 144, so the step runs one frame of dots from its own start, counted in processor T-cycles: Rule 1/1&rsquo;s frame count of 140,448 processor T-cycles in double speed on the Colour.</td></tr>' +
      '<tr><td><b>Switched off during the step</b></td><td>Once a frame of dots has passed since the step began, counted on the processor&rsquo;s clock (its T-cycles, halved in double speed), because no dots are processed while the display is off. The test is made at each instruction boundary, so the step ends at the first boundary at or past that count.</td></tr>' +
      '<tr><td><b>Switched on during the step</b></td><td>It runs on until the switch-on frame reaches line 144. Since the power-on line is 451 dots and the frame it starts writes nothing to the buffer (section 14), that step ends after the invisible frame, and the next step draws the first visible one.</td></tr>' +
      '<tr><td><b>Any</b> (a cap over every row above)</td><td>No step runs past the first instruction boundary at or past 140,448 dots (two frames) from its start, whatever the display does. The count is on the processor&rsquo;s clock (its T-cycles, halved in double speed), because no dots are processed while the display is off.</td></tr>' +
    '</tbody></table>' +
    '<div class="gbemu-example"><b>Example.</b> The display is off when a step starts, and the cartridge switches it on part-way through. The step does not stop one frame of dots after its start: it is in the row &ldquo;switched on during the step&rdquo;, so it runs through the power-on line and the rest of that frame until the picture enters line 144, then finishes the instruction in progress. That frame wrote nothing to the buffer, so a checkpoint taken after this step shows the buffer section 19 describes for a display just switched on; the step after it is the first to draw a visible frame, and from then on steps are one frame of dots apart (row &ldquo;on&rdquo;). The cap row still applies: neither step runs past the first boundary at or past 140,448 dots. <b>The end of a step with the display on.</b> A run of <code>NOP</code>s on an original, <code>IE = 0x00</code> so no look is made: a fetch access is on dot 453 of line 143, and the test after it finds no mark. The next boundary pays dots 453 to 455 (the wrap, which sets the mark) and line 144&rsquo;s dot 0, and the next <code>NOP</code> fetches on dot 1 of line 144. The test after it finds the mark, and the step returns with the dot counter at line 144, dot 1 and four dots owed.</div>' +
    '<div class="gbemu-rule" id="gbr-1-3"><b>Rule 1/3.</b> Where counting starts is the harness&rsquo;s choice (for example the first ' +
    'fetch at <code>0100</code>, section 3); the step of Rule 1/2 is the same from any start. A checkpoint taken after N steps is the ' +
    'frame buffer as it stands then (section 19 says what the buffer holds while the display is off or ' +
    'just switched on).</div>' +
    '<div class="gbemu-why"><b>Why.</b> Built as &ldquo;a frame of T-cycles from the start point, whatever the display ' +
    'does&rdquo;, an independent build from this page matched our checkpoints byte for byte on 119 of ' +
    '170 runs; with this definition, on 152. That first build&rsquo;s other 18 are not about frames: almost all are rows whose mid-line mechanisms that build chose not to build (the mid-line display-control settling of E.9, the window insertions of E.8.2 and E.8.3, the stalled-fetch recording of E.3.3), where the picture itself differs. A second build from this page, with this definition, matched on 154 of 170, and on every row it passed. MECHANISM, read from our source (<code>gb_run_frame</code> ' +
    'and the line-144 frame boundary).</div>' +

    '<h4 class="gbemu-sub">The processor-to-dot phase</h4>' +
    '<div class="gbemu-rule" id="gbr-1-4"><b>Rule 1/4.</b> <b>Which dots a machine cycle covers, in absolute dots.</b> Say a machine cycle <b>covers</b> the four dots the picture unit advances through between the previous cycle&rsquo;s bus access and this cycle&rsquo;s. A read in that cycle sees the effect of its last dot and of nothing later; a write with no lead (E.1) is first seen on the dot after its last dot. On appendix E&rsquo;s scale (the line boundary four dots before the scan, mode 3 entered on dot 84), <b>on the original every machine cycle must cover dots 4k&nbsp;+&nbsp;1 to 4k&nbsp;+&nbsp;4 of the line</b>, for every whole number k. That is what &ldquo;the dot clock <b>leads the processor&rsquo;s machine cycle by one dot</b>&rdquo; means on this page: with the two clocks in phase the cycles would cover 4k to 4k&nbsp;+&nbsp;3 instead, and that is wrong. ' +
    'This is a phase between two clocks, not an adjustment to any one event.</div>' +
    '<div class="gbemu-example"><b>Example.</b> Mode 3 is entered on dot 84, the last dot of the cycle 81 to 84, and at SCX&nbsp;=&nbsp;0 the line&rsquo;s last pixel leaves and the mode-0 interrupt source rises during dot 256, the last dot of the cycle 253 to 256: a test in that cycle already sees the request, which is what the timing cartridge measures. With the two clocks in phase the cycles would be 252 to 255 and 256 to 259: dot 256 would open a cycle instead of closing one, and the first test to see the request would be one machine cycle later. What STAT&rsquo;s mode bits <em>report</em> is a separate wire: on an object line it changes on that same dot 256, so a read in that cycle sees mode 0; on a line on which the scan selected no object it has already reported mode 0 three dots earlier, changing during dot 253 and first seen by an access on 254 (section 14&rsquo;s access table and E.6). The phase argument here is about the interrupt source, not the report.</div>' +
    '<div class="gbemu-why"><b>Why.</b> The phase is not ' +
    'guessable: skews of 0, 2 and 3 dots all fail, and only 1 passes. What pins ' +
    'it is Mooneye&rsquo;s <code>hblank_ly_scx_timing-GS</code>, which wants the mode-0 interrupt to ' +
    'land in three distinct machine cycles as SCX&nbsp;mod&nbsp;8 goes 0 / 1&ndash;4 / 5&ndash;7. That ' +
    'happens only if the dot on which mode 0 begins at SCX&nbsp;=&nbsp;0 is the <em>last</em> dot of ' +
    'a machine cycle. Put the two clocks in phase and it is the first, which merges the groups into ' +
    'two where hardware has three, and the test fails on its opening iteration. Setting it ' +
    'correctly costs nothing anywhere else. <b>INSTRUMENT-MEASURED</b> on the shipped core with a per-dot probe (it logs every dot the picture unit processes, the machine cycle it was processed in, and where each bus access fell). <b>Falsifier:</b> a read in the cycle covering 253 to 256 that does not see mode 0 on an object-free line at SCX&nbsp;=&nbsp;0.</div>' +
    '<div class="gbemu-rule" id="gbr-1-5"><b>Rule 1/5.</b> The phase of Rule 1/4 must be reached from each start as this table gives.</div>' +
    '<table class="gbemu-table"><thead><tr><th>Start</th><th>Which dots the first machine cycles cover (absolute dots of the line named, appendix E&rsquo;s scale)</th><th>Label</th></tr></thead><tbody>' +
      '<tr><td><b>The hand-over with no boot program</b> (section 3)</td><td>The machine has already processed dot 0 of line 0 when the cartridge&rsquo;s first instruction starts, and owes the picture unit nothing. So the first machine cycle (the read of the opcode at <code>0100</code>) processes no dot of its own and its read lands between dot 0 and dot 1; the second cycle covers dots 1 to 4, and the phase of Rule 1/4 holds from there on.</td><td>INSTRUMENT-MEASURED</td></tr>' +
      '<tr><td><b>After the display is switched on</b> (E.2)</td><td>The cycle carrying the enable write processes no dot (the display is off until the write lands) and the dot counter starts at 8. The first cycle after the write covers dots 8 to 11 of the power-on line, and the c-th covers <code>8 + 4(c &minus; 1)</code> to <code>8 + 4c &minus; 1</code>; its read sees that last dot and not <code>8 + 4c</code>, which is what E.2&rsquo;s &ldquo;cycle-c read landing on dot 8 + 4c&rdquo; means. The power-on line ends on dot 458 (451 dots from 8), and the cycle covering 456, 457 and 458 also covers dot 0 of line 1, so line 1 opens with a cycle covering dots 1 to 4: the same phase the no-boot hand-over reaches. On the original a booted run and a no-boot run therefore run at one phase, and every program that switches the display on lands on it again.</td><td>INSTRUMENT-MEASURED</td></tr>' +
      '<tr><td><b>The Colour</b> (the Colour tab has it)</td><td><b>The phase is different.</b> After a single-speed switch-on the power-on line is 450 dots, so from line 1 on a cycle covers 4k&nbsp;+&nbsp;2 to 4k&nbsp;+&nbsp;5; in double speed a cycle covers two dots, an even-numbered dot and the odd one after it (the Colour tab, section 10). A Colour started with no boot program reaches the same phase: it starts at the booted hand-over (line 148, dot 354, or line 144, dot 166 for a Color-flagged cartridge), arrived at by running the picture unit from line 0 (the Colour tab, section 2).</td><td>INSTRUMENT-MEASURED; the Colour&rsquo;s 450 itself is FITTED (the Colour tab says so)</td></tr>' +
    '</tbody></table>' +

    '<h4 class="gbemu-sub">The address map</h4>' +
    '<div class="gbemu-rule" id="gbr-1-6"><b>Rule 1/6.</b> The processor&rsquo;s 16-bit address space must be mapped as this table gives.</div>' +
    '<table class="gbemu-table"><thead><tr><th>Range (hex addresses, both ends included)</th><th>What is there</th></tr></thead><tbody>' +
      '<tr><td><code>0000&ndash;3FFF</code></td><td>Cartridge program memory, bank 0 (fixed: mostly; MBC1 in its large-cartridge mode can move it)</td></tr>' +
      '<tr><td><code>4000&ndash;7FFF</code></td><td>Cartridge program memory, switchable bank</td></tr>' +
      '<tr><td><code>8000&ndash;9FFF</code></td><td>Video memory. Reads return <code>0xFF</code> while the picture is being drawn</td></tr>' +
      '<tr><td><code>A000&ndash;BFFF</code></td><td>Cartridge RAM, if the cartridge has any and has enabled it</td></tr>' +
      '<tr><td><code>C000&ndash;DFFF</code></td><td>Work RAM</td></tr>' +
      '<tr><td><code>E000&ndash;FDFF</code></td><td>Echo of <code>C000&ndash;DDFF</code>. Real, not a curiosity: the sprite-memory transfer reads it too (section 4)</td></tr>' +
      '<tr><td><code>FE00&ndash;FE9F</code></td><td>Sprite memory, 40 entries of 4 bytes</td></tr>' +
      '<tr><td><code>FEA0&ndash;FEFF</code></td><td>Unusable. What a read returns and what a write does: Rule 1/7</td></tr>' +
      '<tr><td><code>FF00&ndash;FF7F</code></td><td>Hardware registers</td></tr>' +
      '<tr><td><code>FF80&ndash;FFFE</code></td><td>High RAM. Reachable during a sprite-memory transfer, which is why transfer routines live here</td></tr>' +
      '<tr><td><code>FFFF</code></td><td>Interrupt enable</td></tr>' +
    '</tbody></table>' +
    '<div class="gbemu-rule" id="gbr-1-7"><b>Rule 1/7.</b> On the original, a read of <code>FEA0&ndash;FEFF</code> must return <b><code>0xFF</code></b> and a write there must be discarded, to match this core. That is a statement about <em>this core</em>, not about the machine: <b>do not attribute this constant to the hardware.</b> <b>Do not carry it to a Color</b>: the Colour tab&rsquo;s section 10 has the revision split and what our core does there instead.</div>' +
    '<div class="gbemu-why"><b>Why.</b> <b>&ldquo;Unusable&rdquo; is not an answer to what a read returns.</b> Published accounts of the original give <b><code>0x00</code></b> here, so the number we ship is not just unmeasured, it is <b>the opposite of the only account anyone has written down</b>. <b>Our constant is read from source</b> (<code>src/gb.c</code>, <code>UNUSABLE_READ</code>, annotated there as documented DMG behaviour: an annotation the published disagreement puts in doubt). There is <b>no cartridge on the board covering this range at all</b>, on either machine, and no render instrument in the estate can see a bus read, so <b>nothing we own can settle it</b>: <b>NOT ESTABLISHED</b>, with a named disagreement rather than a silent one. <b>Falsifier:</b> a cartridge that reads this range on an original and reports the byte; <code>0x00</code> would retire our constant outright. Section 5&rsquo;s sprite-memory corruption window reaches into this range, which is the one place the page touches it twice.</div>' +
    '<p class="hw-readable">Cartridge mappers needed to run the commercial shelf at the bottom of ' +
    'this page: <b>none</b> (32 KB titles), <b>MBC1</b>, <b>MBC2</b>, <b>MBC3</b> (with its clock) ' +
    'and <b>MBC5</b>. The mealybug cartridges themselves need none of them, so a core can ' +
    'reach 24 of 24 with no mapper at all, and still not boot a single game you own.</p></section>' +

  /* ---------------------------------------------------------------- M2 */
  '<section class="sect" id="gbe-m3"><h3 class="sect-h">3. Where the machine starts</h3>' +
    '<div class="gbemu-rule" id="gbr-3-1"><b>Rule 3/1.</b> A run must begin in exactly one of two ways. <b>(a) Run the real boot program</b> from the power-on state of Rule 3/5 ' +
    'and let it hand over: this is what this core does when its host supplies a boot program (section 24). <b>(b) With no boot program, start at <code>0x0100</code></b> in the ' +
    'hand-over state of Rules 3/2 to 3/4 and 3/9 to 3/11.</div>' +
    '<div class="gbemu-why"><b>Why.</b> These are the two honest ways to begin. The hand-over table is the fallback for builds that cannot ' +
    'carry the boot image, and it is reproduced here because it is not derivable from anything.</div>' +
    '<div class="gbemu-rule" id="gbr-3-2"><b>Rule 3/2.</b> With no boot program, the machine must start at <code>PC = 0x0100</code> holding the values of this table. Each value is what is stored, unless the row says otherwise.</div>' +
    '<table class="gbemu-table"><thead><tr><th>State</th><th>Value at <code>PC = 0x0100</code> (hex)</th></tr></thead><tbody>' +
      '<tr><td>Registers</td><td><code>A=01 F=B0 B=00 C=13 D=00 E=D8 H=01 L=4D SP=FFFE PC=0100</code> (F = zero, half-carry and carry set)</td></tr>' +
      '<tr><td>Divider</td><td>Internal counter <code>0xABC8</code>: the visible register reads <code>0xAB</code>. The low bits are the rest of the 16-bit counter and they matter: a cartridge that probes the <em>phase</em> is what separates <code>0xABC8</code> from the coarser <code>0xABCC</code>. The counter holds that value at the start of the machine cycle that fetches the opcode at <code>0x0100</code>, before that cycle&rsquo;s four timer ticks. See the note below</td></tr>' +
      '<tr><td>Timer</td><td><code>TAC = 0xF8</code> (disabled), <code>IF = 0xE1</code>, <code>SC = 0x7E</code>. These are stored, not only read back: our no-boot start stores TAC as <code>0xF8</code> (enable bit 2 clear), IF&rsquo;s five bits as <code>0x01</code> (vertical blank pending) and SC as <code>0x7E</code> (bits 7 and 0 clear, bits 1 to 6 set). On the original the read-back masks make the difference invisible; on the Colour in colour mode the stored SC bit 1 reads back as 1, which selects the fast serial clock until the cartridge writes SC</td></tr>' +
      '<tr><td>Picture</td><td><code>LCDC = 0x91</code>, <code>STAT = 0x85</code>: <b>only bits 3&ndash;6 of that byte are adopted; see Rule 3/3</b>: <code>LY = LYC = 0</code>, <code>SCY = SCX = 0</code>, <code>WY = WX = 0</code>, <b>mode 2</b></td></tr>' +
      '<tr><td>Palettes</td><td><code>BGP = 0xFC</code>, <code>OBP0 = OBP1 = 0xFF</code>. The <code>0xFF</code> pair is the circulated table&rsquo;s value and is what our no-boot start stores on the original. It is <b>not</b> what a booted run leaves: the boot program never writes OBP0 or OBP1, so after it they hold their power-on value, which is 0 in our core (Rule 3/5). The Colour&rsquo;s no-boot start stores 0 for the same reason (the Colour tab, section 2)</td></tr>' +
      '<tr><td>Pad select</td><td><code>P1</code> select bits stored as <code>0x00</code> (both groups selected), so the pad reads <code>0xCF</code> with nothing pressed; on the Colour <code>0x30</code>. Rule 3/7 has why</td></tr>' +
      '<tr><td>Everything else</td><td><code>0x00</code>: every byte of work RAM and high RAM; <code>IE</code>, <code>TIMA</code>, <code>TMA</code>, <code>SB</code> and <code>FF46</code>. The processor: IME 0, no enable scheduled by EI, not halted. Read from our source (the reset clears the whole machine state and then stores the rows above); sound is Rule 3/11</td></tr>' +
    '</tbody></table>' +
    '<div class="gbemu-why"><b>Why.</b> The divider row is MECHANISM, read from our source (the no-boot reset stores it, and every opcode fetch advances the timer by four before its read). What a real console powers on with in OBP0 and OBP1 is not established.</div>' +

    '<div class="gbemu-rule" id="gbr-3-3"><b>Rule 3/3.</b> <b>STAT at the hand-over.</b> The <code>STAT = 0x85</code> in the table is a circulated byte, not a ' +
    'byte to store. <b>The low three bits of STAT are read-only</b>: bits 0&ndash;1 are the mode and bit 2 is the coincidence flag, all three produced by ' +
    'the display and none of them stored. <b>This core takes the tabulated byte for its writable ' +
    'bits only</b>, <code>0x85 &amp; 0x78 = 0x00</code>, so <b>no STAT interrupt source is enabled ' +
    'at handover</b>, and it sets the display state separately: <b>mode 2, coincidence flag ' +
    'clear</b>. <b>Compose STAT from the mode and the enables; never store this byte ' +
    'whole.</b> The first value a real <code>LDH A,(41)</code> or <code>LD A,(FF41)</code> returns is <b><code>0x86</code></b> (bit 7, coincidence, mode 2), and it stays <code>0x86</code> until the line or the mode changes. ' +
    'The stored mode 2 is a starting state, not a frame ' +
    'wrap: the machine cycle of mode 0 that section 14 gives line 0 on its first five access dots belongs to every later wrap into line 0 (from the first frame after the ' +
    'hand-over on), never to the hand-over itself.</div>' +
    '<div class="gbemu-example"><b>Example.</b> Decode <code>0x85</code> by this page&rsquo;s own rules and it ' +
    'is <b>bit 7 set, coincidence set, mode 1</b>; mode 2 would be <code>0x86</code>. So the row&rsquo;s byte and its &ldquo;mode 2&rdquo; read ' +
    'as a contradiction, and an implementer who resolves it the obvious ' +
    'way gets a wrong register. Stored, only <code>0x85 &amp; 0x78 = 0x00</code> is kept. Composed at the hand-over instant STAT is ' +
    '<code>0x80 | 0x00 | 0x00 | 2 = 0x82</code>: neither <code>0x85</code> nor anything ' +
    'composed from it. <b>But no instruction can read it at that instant.</b> LY and LYC are both 0, and the comparator sets the coincidence flag as dot 0 is processed, before the first opcode fetch&rsquo;s read (Rule 1/5: the machine has processed dot 0 when the cartridge starts), so the first read returns <code>0x80 | 0x04 | 2 = 0x86</code>. <code>0x82</code> is the composed state, not a readable one.</div>' +
    '<div class="gbemu-why"><b>Why.</b> This is <em>not</em> the reported-against-internal split of section 14: the ' +
    'reported mode here is 2 as well. <b>Read from source</b>: <code>src/gb.c</code>, the ' +
    'no-boot-image fallback, <code>gb-&gt;stat = 0x85 &amp; 0x78</code> beside ' +
    '<code>ppu_mode = mode_report = 2</code>. The first read of <code>0x86</code> is INSTRUMENT-MEASURED (the probe <code>test/tabprobe</code>: the flag reads set from the first access dot after the hand-over).</div>' +
    '<div class="gbemu-rule" id="gbr-3-4"><b>Rule 3/4.</b> <b>The interrupt side at the hand-over</b>: the interrupt-logic mode (the second wire of section 14) must be stored as &ldquo;none&rdquo;, not 2, and the status line low. <b>Line 0 then runs on as an ordinary line 0 from dot 1</b>, in these steps (dots of line 0 on appendix E&rsquo;s scale, event scale):' +
    '<ol class="gbemu-steps">' +
      '<li>Dot 0 is already processed before the first opcode fetch&rsquo;s read (Rule 1/5); with LY and LYC both 0 the comparator sets the coincidence flag on it (Rule 3/3). The start-of-line blind window (Rule 14/14) is not running on this dot: only a wrap arms it, and the hand-over is not a wrap.</li>' +
      '<li>Dot 3: the mode-2 source rises. Dot 4: it falls, like every wrap into line 0. Nothing is selected (no STAT source is enabled, Rule 3/3), so nothing is raised.</li>' +
      '<li>From dot 5: the scan takes its slots.</li>' +
      '<li>Dot 84: drawing starts.</li>' +
    '</ol></div>' +
    '<div class="gbemu-why"><b>Why.</b> Read from our source (<code>int_mode = -1</code> in the same block).</div>' +

    '<div class="gbemu-rule" id="gbr-3-5"><b>Rule 3/5.</b> <b>The other start: power-on, when a boot program is run.</b> Rule 3/2&rsquo;s table ' +
    'is only the hand-over. With a boot program the machine must start from this cleared state and let the ' +
    'program do the rest. Everything not listed here is 0.</div>' +
    '<table class="gbemu-table"><thead><tr><th>Part</th><th>At power-on, with a boot program (hex unless a unit is named)</th></tr></thead><tbody>' +
      '<tr><td>Processor</td><td>A, F, B, C, D, E, H, L, SP and PC all 0; interrupts disabled (IME 0); ' +
      'IE and IF stored as 0. The boot program is mapped over <code>0000</code>-<code>00FF</code> (on the ' +
      'Colour also <code>0200</code>-<code>08FF</code>) until it writes a value with bit 0 set to <code>0xFF50</code> (Rule A.4/1).</td></tr>' +
      '<tr><td>Divider and timer</td><td>Internal counter 4 (Rule 3/8; section 5 has exactly where); TIMA, TMA and ' +
      'TAC 0.</td></tr>' +
      '<tr><td>Picture</td><td>Display off (LCDC 0), STAT enables 0, mode 0, LY 0, every scroll and window ' +
      'register 0, BGP, OBP0 and OBP1 0. The frame buffer is filled with white: shade index 0 on the ' +
      'original, <code>0x7FFF</code> on the Colour.</td></tr>' +
      '<tr><td>Pad select</td><td><code>0x00</code> on the original, <code>0x30</code> on the Colour ' +
      '(Rule 3/7).</td></tr>' +
      '<tr><td>Sound</td><td>The unit is powered off and every sound register is 0, wave memory ' +
      'included. Inside it, the noise shift register is all ones and the frame sequencer stands at step ' +
      '7, as in the no-boot start.</td></tr>' +
      '<tr><td>Memory</td><td>Video memory, sprite memory, work memory, high memory and cartridge RAM are ' +
      'all 0 (cartridge RAM until the host loads a save into it).</td></tr>' +
    '</tbody></table>' +
    '<div class="gbemu-why"><b>Why.</b> On a real console work memory is not known to come up zeroed; our core zeroes ' +
    'it and models no power-on pattern.</div>' +
    '<div class="gbemu-rule" id="gbr-3-6"><b>Rule 3/6.</b> <b>A Super Game Boy must start exactly as the original does</b>, ' +
    'on both paths: with no boot program it takes Rule 3/2&rsquo;s hand-over table unchanged (the same ' +
    '<code>A=01 F=B0 B=00 C=13</code> and the rest), and with one it runs the original&rsquo;s boot ' +
    'program from the cleared machine of Rule 3/5. The only additions are the packet receiver and the ' +
    'multi-player pad of appendix A.6, both idle until the cartridge writes to the pad register.</div>' +
    '<div class="gbemu-why"><b>Why.</b> A real ' +
    'Super Game Boy runs a boot program of its own, and its hand-over register values are not modelled ' +
    'here: a cartridge that tells the two machines apart by those registers sees an original. ' +
    'MECHANISM, read from our source (the reset routine, the no-boot table, which has no Super Game Boy ' +
    'branch, and the sound unit&rsquo;s reset).</div>' +

    '<div class="gbemu-rule" id="gbr-3-7"><b>Rule 3/7.</b> The pad-select register at <code>0xFF00</code> must ' +
    'start at the value each model&rsquo;s own test declares, and the two models differ: <b>on the original, ' +
    '<code>0x00</code> (both groups selected, so the pad reads <code>0xCF</code>)</b>, which is what ' +
    '<code>boot_hwio-dmgABCmgb</code> asserts; <b>on the Color, <code>0x30</code> (neither group, reads ' +
    '<code>0xFF</code>)</b>, which is what <code>boot_hwio-C</code> asserts. That is what this core ships, with ' +
    'or without a boot program.</div>' +
    '<div class="gbemu-example"><b>Example.</b> A build that uses <code>0x30</code> on every model fails <code>boot_hwio-dmgABCmgb</code> at <code>0xFF00</code>. ' +
    '<code>0x00</code> selects <em>both</em> groups, so a title sampling the pad on the original before its first ' +
    'write to that register sees the two groups ORed together and gets bits 4&ndash;5 low, where a start at <code>0x30</code> would give them ' +
    'high.</div>' +
    '<div class="gbemu-why"><b>Why.</b> This value is in no other site&rsquo;s hand-over table, and it is wrong in ' +
    'cores that run the real boot program. The rule everyone applies ' +
    '(&ldquo;the boot program sets the registers itself, so do not pre-set them&rdquo;) looks like it ' +
    'covers this one, and it does not: the boot program never writes <code>0xFF00</code> at all. ' +
    'Measured at the register rather than argued from the listing, on a build whose no-boot start stored <code>0x30</code> on every model (the shipped start stores <code>0x00</code> on the original, as above, <code>BOOT_JOYP_SEL</code>): without the boot program the field held <code>0x30</code> and the pad read <code>0xFF</code>; <em>with</em> it, the field was still <code>0x00</code> at handover and the pad read <code>0xCF</code>, because the boot program never writes it.</div>' +

    '<h4 class="gbemu-sub">And if you run the real boot program, the divider does not start at zero</h4>' +
    '<div class="gbemu-rule" id="gbr-3-8"><b>Rule 3/8.</b> The divider is <b>not T-cycles-since-the-first-fetch: it leads that fetch ' +
    'by one machine cycle</b>, and must be started at <b>4</b> rather than 0 at power-on (Rule 3/5).</div>' +
    '<div class="gbemu-example"><b>Example.</b> Our execution of the boot program is cycle-exact at handover (the same ' +
    'total T-cycle count as the reference, no drift). With the counter started at 0, running the program landed the internal counter at <code>0xABC4</code> where the ' +
    'tabulated shortcut uses <code>0xABC8</code>, and <code>0xABC8</code> is what passes. Four ' +
    'T-cycles apart, with the cycle count already exact. Started at 4, the same run reaches the value that passes. The visible register ' +
    'byte is the same either way, so every boot-handover check passes while the sub-byte phase ' +
    'underneath it is wrong, and only a cartridge that probes the <em>phase</em> can see that.</div>' +
    '<div class="gbemu-why"><b>Why.</b> Mooneye&rsquo;s <code>boot_div-dmgABCmgb</code> declares its own six readings and says in its ' +
    'title that it tests the value <em>and relative phase</em>; the phase is pinned by that ' +
    'declaration, not chosen. The prediction and its falsifier: if starting at 4 ' +
    'reached <code>0xABC8</code> and the row still failed, phase was not the mechanism and the change ' +
    'was to be withdrawn rather than tuned. It reached it and the row passed.</div>' +
    '<div class="gbemu-why"><b>Why (the label on that 4, and the trap): it is tempting to call it DERIVED, ' +
    'and it is not.</b> Section 5 states, of the same constant, that it is ' +
    '<em>&ldquo;a reconciliation of two measurements rather than a derivation&rdquo;</em> and ' +
    '&ldquo;not explained&rdquo;, and that is its correct standing. ' +
    'The rule this page holds itself to is that <em>nothing becomes derived without a structural ' +
    'account the source supports</em>, and there is no such account here: what exists is two ' +
    'measurements (a cycle-exact boot run landing at <code>0xABC4</code> and a cartridge that ' +
    'passes only at <code>0xABC8</code>) and a constant chosen to reconcile them. <b>The ' +
    'reconciliation is sound and the prediction-and-falsifier discipline above is exactly right; ' +
    'what it establishes is that the lead exists and is one machine cycle, not <em>why</em>.</b> So: ' +
    '<b>the value is 4, stated outright; the lead is MEASURED; the mechanism is NOT ESTABLISHED.</b> ' +
    '<b>To establish:</b> a structural account of what the divider is counting one machine cycle ' +
    'before the first fetch. A reader who finds it has something this page does not have.</div>' +
    '<div class="gbemu-why"><b>Why (one value or a class).</b> The six declared readings do not ' +
    'determine a value, they determine a <b>class</b>: <code>0xABC8</code> through ' +
    '<code>0xABCB</code> all satisfy them. All four were built and scored and <b>no row anywhere ' +
    'separates them</b>, because nothing in the machine reads the bottom two bits: the timer ' +
    'taps bits 9, 3, 5 and 7, the sound frame sequencer taps bit 12, and the visible register is bits ' +
    '8&ndash;15. The honest statement is stronger than &ldquo;solved&rdquo;: solved to an equivalence ' +
    'class, with the class then measured to be inert. The value shipped is the one in Rule 3/2&rsquo;s table.</div>' +

    '<h4 class="gbemu-sub">What the boot program leaves in video memory, which ten test cartridges draw</h4>' +
    '<p class="hw-readable">The hand-over table of Rule 3/2 is the processor and the registers. It is not the whole hand-over: ' +
    'the boot program also leaves its logo in video memory, and ten of the 24 mealybug cartridges draw it (appendix G.4 ' +
    'and section 23 price it at 3,481 px net). Object cells drawing their objects ' +
    'with tile 25 draw nothing at all on a core that starts with video memory cleared, so every object timing ' +
    'question those cells ask becomes invisible to it.</p>' +
    '<div class="gbemu-rule" id="gbr-3-9"><b>Rule 3/9.</b> With no boot program, video memory and sprite memory must hold this at the hand-over:' +
    '<ul class="gbemu-bullets">' +
      '<li><b>Tiles 1 to 24 are the logo, and they come from the cartridge, not from the boot program.</b> The 48 bytes ' +
      'at <code>0x0104</code>&ndash;<code>0x0133</code> of the cartridge header are the bitmap. Tile <i>t</i> takes header ' +
      'bytes <code>0x0104 + 2(t &minus; 1)</code> and the one after it. Each byte makes four rows of the tile: its high ' +
      'nibble, with every bit doubled horizontally (so four bits become eight), written as two identical rows, then its ' +
      'low nibble the same way, two more rows. So the first byte fills rows 0&ndash;3 and the second rows 4&ndash;7. ' +
      'Only the low bitplane is set; every high-plane byte is 0.</li>' +
      '<li><b>Tile 25 is the registered-trademark mark</b>: an 8 &times; 8 glyph in the low bitplane only, with every one of ' +
      'its eight rows non-zero. Its sixteen bytes at <code>0x8190</code>-<code>0x819F</code>: the low-plane bytes (the even addresses), row 0 to row 7, are <code>3C 42 B9 A5 B9 A5 42 3C</code>, and the eight high-plane bytes (the odd addresses) are all <code>0x00</code>. Drawn, bit 7 on the left, <code>#</code> for colour 1: <code>..####..</code> / <code>.#....#.</code> / <code>#.###..#</code> / <code>#.#..#.#</code> / <code>#.###..#</code> / <code>#.#..#.#</code> / <code>.#....#.</code> / <code>..####..</code>, a circled R. A no-boot start that leaves these bytes out draws nothing where those cells draw tile 25.</li>' +
      '<li><b>The map:</b> tiles 1&ndash;12 at <code>0x9904</code>&ndash;<code>0x990F</code>, tile 25 at ' +
      '<code>0x9910</code>, tiles 13&ndash;24 at <code>0x9924</code>&ndash;<code>0x992F</code>. Every other map byte ' +
      'is 0.</li>' +
      '<li><b>Everything else is zero:</b> tile 0, tiles 26 and up, and all of sprite memory.</li>' +
    '</ul></div>' +
    '<div class="gbemu-example"><b>Example.</b> Tile 1 takes header bytes <code>0x0104</code> and <code>0x0105</code>, and its sixteen bytes sit at <code>0x8010</code>-<code>0x801F</code> (tile <i>t</i> at <code>0x8000 + 16t</code>, the same addressing that puts tile 25 at <code>0x8190</code>). If the byte at <code>0x0104</code> is <code>0xCE</code>: its high nibble <code>C</code> = <code>1100</code> doubles to <code>11110000</code> = <code>0xF0</code>, which is rows 0 and 1; its low nibble <code>E</code> = <code>1110</code> doubles to <code>11111100</code> = <code>0xFC</code>, rows 2 and 3. Rows 0 to 3 of tile 1 are therefore the byte pairs <code>F0 00</code>, <code>F0 00</code>, <code>FC 00</code>, <code>FC 00</code> (low plane, then high plane 0), and rows 4 to 7 come from the byte at <code>0x0105</code> in the same way.</div>' +
    '<div class="gbemu-why"><b>Why.</b> Labels: the layout and the logo rule are MECHANISM, read off our own run of the real ' +
    'program and checked byte for byte against the rule (running the real boot program to the hand-over and comparing video memory with the rule: 0 differing bytes of 384 for the logo tiles); the glyph bytes are read off the same run, MECHANISM: read out of video memory at <code>0x8190</code> after our core ran the real boot program to the hand-over, and the same 8 &times; 8 shape is what the mealybug reference images show wherever a cell draws tile 25.</div>' +

    '<h4 class="gbemu-sub">And the sound unit, which the hand-over table leaves out</h4>' +
    '<div class="gbemu-rule" id="gbr-3-10"><b>Rule 3/10.</b> With no boot program, the sound unit&rsquo;s registers must hold these stored contents at the hand-over. What a read returns is these OR the read-back masks of appendix B.3.</div>' +
    '<table class="gbemu-table"><thead><tr><th>Register</th><th>Stored at the hand-over (hex)</th></tr></thead><tbody>' +
      '<tr><td><code>FF10</code>&ndash;<code>FF14</code> (channel 1)</td><td><code>FF10</code> 80, <code>FF11</code> BF, <code>FF12</code> F3, <code>FF13</code> 00, <code>FF14</code> BF</td></tr>' +
      '<tr><td><code>FF16</code>&ndash;<code>FF19</code> (channel 2)</td><td><code>FF16</code> 3F, <code>FF17</code> 00, <code>FF18</code> 00, <code>FF19</code> BF</td></tr>' +
      '<tr><td><code>FF1A</code>&ndash;<code>FF1E</code> (channel 3)</td><td><code>FF1A</code> 7F, <code>FF1B</code> FF, <code>FF1C</code> 9F, <code>FF1D</code> 00, <code>FF1E</code> BF</td></tr>' +
      '<tr><td><code>FF20</code>&ndash;<code>FF23</code> (channel 4)</td><td><code>FF20</code> FF, <code>FF21</code> 00, <code>FF22</code> 00, <code>FF23</code> BF</td></tr>' +
      '<tr><td><code>FF24</code>, <code>FF25</code>, <code>FF26</code></td><td><code>77</code>, <code>F3</code>, power on</td></tr>' +
      '<tr><td>Wave memory</td><td>all 0</td></tr>' +
    '</tbody></table>' +
    '<div class="gbemu-rule" id="gbr-3-11"><b>Rule 3/11.</b> With no boot program, the sound unit&rsquo;s internal state at the hand-over must be: ' +
    '<ul class="gbemu-bullets">' +
      '<li><b>Channel 1:</b> its DAC is powered, its duty is 2, its initial volume 15 with an envelope pace of 3, and <b>the channel is running</b>, as the boot program&rsquo;s ' +
      'start-up chime leaves it: its current volume is already 0, so it is silent, its duty position is ' +
      'already clocking (the first-trigger rule of appendix B.16 has been spent), and <code>FF26</code> ' +
      'reads <code>0xF1</code>. <b>Exactly</b>: the channel&rsquo;s <em>internal</em> period is 0, not the <code>0x700</code> that <code>FF13</code>/<code>FF14</code> show (those are stored bytes; the internal period is loaded only by a later write or trigger: an NR13 write sets its low eight bits and an NR14 write, with or without the trigger bit, its high three, at the write and from the byte written, and neither reads a stored byte), so its period counter starts loaded with (2048 &minus; 0) &times; 4 = 8,192 T; its duty position is 0; its envelope timer is 0 and its current volume 0; its length counter is 0 with length enable clear.</li>' +
      '<li><b>Every channel&rsquo;s period counter</b> starts loaded with its own period at internal period 0: channel 2 8,192 T, channel 3 4,096 T, the noise channel its divisor for code 0, 8 T (T = T-cycles). The noise channel&rsquo;s down-counter starts loaded at 1. That channel&rsquo;s 8 T is stored and nothing reads it: its clock is the three stages of Rule 17/13.</li>' +
      '<li>The frame sequencer sits at step 7; the noise shift register is all ones; ' +
      'master volume 7 on both sides and the routing byte <code>F3</code>.</li>' +
      '<li>Every other internal value is 0, including those a later write would decode from a stored byte (the sweep fields of <code>FF10</code>, the level of <code>FF1C</code>, every length): the hand-over decodes no stored byte of Rule 3/10 into them.</li>' +
    '</ul></div>' +
    '<div class="gbemu-why"><b>Why.</b> <b>They are our ' +
    'no-boot fallback, and no board row scores them</b>: the board runs the real boot program, which leaves the unit ' +
    'however its start-up chime leaves it. Channel 1&rsquo;s exact internal values are read from our source, the no-boot reset. ' +
    '<b>Labels.</b> <code>FF26</code> bit 0, the channel triggered and still on, is MECHANISM: both boot ' +
    'programs play their chime on channel 1 and never stop it, and <code>boot_hwio-dmgABCmgb</code> ' +
    'declares <code>FF26</code> = <code>0xF1</code> at the hand-over; with it our no-boot start passes ' +
    'that row. The current volume of 0 is NOT ESTABLISHED: where the envelope stands when the boot ' +
    'program hands over was not measured, and 0 keeps the start silent. The rest are this core&rsquo;s ' +
    'choices for a start with no boot program, MECHANISM only in the sense that they are what the code ' +
    'does. With channel 1 left stopped, <code>FF26</code> reads <code>0xF0</code> and a no-boot start fails that row on exactly that byte.</div>' +
    '</section>' +

  /* ---------------------------------------------------------------- M4 */
  '<section class="sect" id="gbe-gaps"><h3 class="sect-h">24. What this page does not cover</h3>' +
    '<p class="hw-readable">Stated plainly, because a build guide that does not draw its own edge is ' +
    'worse than one that stops sooner. Everything above is what was needed to reach 259 of 264 on ' +
    'the board in section 21 and zero differing pixels on every mealybug tearoom cartridge, plus ' +
    'the machine around the picture processor that had to be right first. Two things a build guide ' +
    'might be expected to omit are here rather than absent, because a reader who lacks either ' +
    'cannot reach any other stage. <b>All 512 opcode cells</b> (500 instructions, the <code>CB</code> prefix and 11 undefined bytes) are appendix&nbsp;D, with their byte ' +
    'counts, their T-cycle counts, the complete flag table, <code>DAA</code> written out, the ' +
    'eleven undefined bytes, the halt bug, <code>STOP</code> and the dispatch sequence. <b>The ' +
    'mapper internals</b> are appendix&nbsp;H: MBC1, MBC2, MBC3 with its clock, MBC5, the ' +
    'header fields that select them, every register width, the masking and wrap rules, and what a ' +
    'write outside a defined range does, together with which suite catches which mistake, because ' +
    'the mapper failures that matter are silent and <b>34 rows of the 264 are mapper rows</b>. ' +
    'Not here:</p>' +
    '<ul class="gbemu-bullets">' +
      '<li><b>The sound unit&rsquo;s mixing and output.</b> Sections 15 to 17 give the clocking, the ' +
        'trigger chain and the channels, because that is where the rows are and where the errors ' +
        'are. The master volume registers, the stereo routing byte and the output capacitor are ' +
        'ordinary and documented. <b>The capacitor is on in what you hear</b>: the samples the page plays pass the one-pole block appendix B.12 gives, so a quiet ' +
        'machine sits at zero instead of at its rail. <b>It is off in what we measure</b>: every ' +
        'scored sound figure on this page is taken from the raw sum before the capacitor, because ' +
        'the block moves the direct-current content of every render and therefore every spectral ' +
        'figure.</li>' +
      '<li><b>The screen&rsquo;s slow response.</b> A real Game Boy screen changes slowly, so something a game draws only on every other frame looks steady and half see-through, and moving things leave a short trail. ' +
        '<b>It is on in what you see</b>: the play window, not the core, copies it (Settings, Display, <b>Screen response</b>: &ldquo;As the real screen&rdquo;, the default, or &ldquo;Off (every frame sharp)&rdquo;). ' +
        'Once for every frame the machine makes, each pixel moves part of the way toward the average of this frame and the one before it, in linear light, so a two-frame blink settles to a steady half-tone and a still picture is shown exactly as the game drew it. ' +
        'How far a pixel moves each frame is <b>FITTED</b>, not measured, because no published measurement of these screens was found: 0.55 of the way on the original, 0.70 on the Pocket and Light (taken when the Pocket or Teal palette is chosen), 0.80 on the Color. ' +
        'The Super Game Boy draws on a television, whose glow fades within a few thousandths of a second, so it has none and the setting is not offered there. ' +
        '<b>It is off in what we measure</b>: every picture figure on this page is taken from the core&rsquo;s own frame, which the setting never changes.</li>' +
      '<li><b>Saving.</b> (The link cable, infrared, the Super Game Boy and the other extra hardware are in appendix A.1.)</li>' +
      '<li><b>The Game Boy Color.</b> A different picture processor with a different priority rule, ' +
        'two banks of video memory, colour palettes and a double-speed mode. Several notes above ' +
        'flag where the two machines diverge; that is a signpost, not a guide. <b>It has its own ' +
        'page</b> (the Emulation tab of any Game Boy Color title in this catalogue) ' +
        'written to the same standard and assuming this one has been read first.</li>' +
    '</ul>' +
    '<p class="hw-readable"><b>What the host must supply, and what this page names without carrying.</b></p>' +
    '<div class="gbemu-rule" id="gbr-24-1"><b>Rule 24/1.</b> ' +
    'The page carries no boot program and never will: a build that wants the booted start must be given ' +
    'the console&rsquo;s own boot program by its host (256 bytes for the original, 2,304 for the Colour, ' +
    'mapped as Rule 3/5 says). Without one, section 3&rsquo;s hand-over tables (Rules 3/2 to 3/4, 3/9 to 3/11) are the whole start; ' +
    'Rule 3/5 gives the power-on state the boot program begins from.</div>' +
    '<div class="gbemu-rule" id="gbr-24-2"><b>Rule 24/2.</b> <b>The functions a host calls.</b> A build for this site&rsquo;s host must export these functions under exactly these names. &ldquo;Context&rdquo; is the address <code>gb_create</code> returned.</div>' +
    '<table class="gbemu-table"><thead><tr><th>Name</th><th>Arguments</th><th>Returns</th></tr></thead><tbody>' +
      '<tr><td><code>gb_sizeof_context</code></td><td>none</td><td>the bytes one machine takes</td></tr>' +
      '<tr><td><code>gb_create</code></td><td>none</td><td>the context of a new machine</td></tr>' +
      '<tr><td><code>gb_set_cart</code></td><td>context, image address, image length in bytes</td><td>nothing</td></tr>' +
      '<tr><td><code>gb_reset</code></td><td>context</td><td>nothing</td></tr>' +
      '<tr><td><code>gb_run_frame</code></td><td>context</td><td>nothing; runs one frame step (section 1)</td></tr>' +
      '<tr><td><code>gb_frame_ptr</code></td><td>context</td><td>the address of the frame buffer</td></tr>' +
      '<tr><td><code>gb_frame_format</code></td><td>context</td><td>0 for shade indices, 1 for BGR555</td></tr>' +
      '<tr><td><code>gb_frame_layout_is</code></td><td>context, pixels, bytes, format</td><td>0 when all three match this machine; otherwise 1 for pixels, 2 for bytes, 3 for format, checked in that order</td></tr>' +
      '<tr><td><code>gb_cart_min_block</code></td><td>none</td><td>the smallest block the cartridge store hands out, in bytes</td></tr>' +
      '<tr><td><code>core_version</code></td><td>none</td><td>the interface version, 2</td></tr>' +
    '</tbody></table>' +
    '<div class="gbemu-why"><b>Why.</b> These names are our convention, not hardware.</div>' +
    '<p class="hw-readable">The page also names material it ' +
    'does not reproduce: our source file and its constants (named so a reader of our source can find the ' +
    'site; every behaviour this page relies on is stated here in words and numbers, never only by a ' +
    'constant&rsquo;s name), our probes (<code>test/tabprobe</code> and others, named as the instrument ' +
    'behind a measured figure), other emulators&rsquo; source and published documents (named as the ' +
    'source of a convergence or a refuted claim), the AGE hardware tables, and the test cartridges&rsquo; ' +
    'own sources, including the tables SameSuite declares for the sound rows of sections 15 to 17. Those ' +
    'declared tables are the one reference a build from this page alone lacks for sound: sections 15 to 17 ' +
    'state the rules our core follows, but a build that wants to check itself row by row needs the ' +
    'cartridges, which ship with their own source. <b>The Colour tab</b> (the Emulation tab of any Game Boy Color title on this site) is the one other page this page cites, and it is cited only for Colour behaviour: every place this page says &ldquo;the Colour tab, section n&rdquo; is about the Colour, and a build of the original or the Super Game Boy needs nothing from it. A Colour build needs both pages, this one first.</p>' +
    '<p class="gbemu-key">And the honest answer to the question this page invites: <b>everything ' +
    'above is necessary and it is not sufficient.</b> What is written here is the part that took the ' +
    'research: the mechanisms that are wrong in most cores, the traps that still play games, ' +
    'and the method for telling a real fix from a fitted one. Building from it still means writing ' +
    'the processor, the buses and the harness, and still means running the suites in section 19 in ' +
    'the order given. What it should save is the derivation: nothing above should have to be worked ' +
    'out twice.</p></section>' +

  /* ================================================================ APP-A
   * REFERENCE APPENDICES. Transcription, not research: every row below is
   * read out of the decode paths of the core the rest of this page
   * describes, so the board is what verifies it. Lettered rather than
   * numbered ON PURPOSE -- the twenty-four numbered sections cross-reference
   * each other by number throughout, and inserting a section would have
   * silently broken every one of those references.
   *
   * LABELS, same discipline as sections 5 and 15-17: DERIVED (read off a
   * rule or a document and then confirmed by a named test), MECHANISM
   * (follows from a rule already stated on this page), OBSERVED, FITTED,
   * CONVERGENCE, NOT PINNED (no test we hold can see it).            */
  '</div>';
}
