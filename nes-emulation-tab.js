/* ===========================================================================
 * NES / Famicom Emulation tab -- nesEmulationTabHTML(d)
 *
 * Written to the same standard as gb-emulation-tab.js, gbc-emulation-tab.js
 * and pm-emulation-tab.js, and loaded the same way: a plain <script src> tag,
 * deliberately NOT fetch(), because the site must also open from disk over
 * file://, where fetch is blocked. The builder is a top-level function
 * declaration, so it is a window global and index.html calls it unchanged.
 *
 * ---------------------------------------------------------------------------
 * EVERY FIGURE ON THIS PAGE IS GATED.
 * ---------------------------------------------------------------------------
 * tools/check-emulation-figures.js renders this file, flattens it to text, and
 * re-derives every figure here that has a dependent elsewhere on the page. If
 * you move a number, move its dependents in the same edit, and if you add a
 * figure another figure is derived from, add the RELATION to the gate.
 *
 * VISITOR TEXT ONLY (decided 18 October 2026). The rendered page carries
 * no developer notes: no "Added <date>", no work-round names, no defect
 * ids, no internal labels (MECHANISM, FITTED, CALIBRATED, TABLE-READ, NOT
 * ESTABLISHED and the like) in prose, no file paths, no commit hashes, and no
 * description of our internal process. Say the fact in plain English. The
 * gate refuses the page if any of these come back.
 *
 * The core this page describes (the factbox figures are moved by the install
 * generator from play/nes/CORE-VERSION.json; this comment follows them):
 *   eight source files   1,459,526 bytes over eight files, LF-normalised,
 *                        set hash b3cafee8e510492b...
 *   the module           257,125 bytes, sha256 8bf5958fe848c0c0...
 *
 * NO SCREENSHOTS. There is no NES render bundled in this repository's image
 * payloads, and a broken image is worse than an absent one.
 * =========================================================================== */
function nesEmulationTabHTML(d) {
  return '<div class="gbemu nesemu">' +

  '<section class="gbemu-hero">' +
    '<div class="gbemu-hero-num"><b>146</b><span>of 146 on AccuracyCoin</span></div>' +
    '<div class="gbemu-hero-txt">' +
      '<h3>How to build a Nintendo Entertainment System, and how much of it anybody can check</h3>' +
      '<p>This is the research for the fifth core on this site, and the number beside it is a ' +
      'public one: <b>146 of 146</b> on AccuracyCoin, the public NES accuracy test cartridge, ' +
      'judged by the cartridge itself. Anyone can run the same cartridge and read the same ' +
      'verdicts, which is the point of quoting it. Section&nbsp;2 says what it covers and what ' +
      'it does not.</p>' +
      '<p><b>Beyond that cartridge, nobody outside can say &ldquo;this core is correct&rdquo;, ' +
      'and this page does not say it either.</b> Our own checks detect change, not correctness; ' +
      'section&nbsp;6 says what a passing check is worth, and section&nbsp;13 lists the things ' +
      'this page could not establish at all.</p>' +
      '<p><b>The most useful thing on this page is section&nbsp;9</b>, which says plainly which ' +
      'cartridge mapper chips this core has and which it does not, and section&nbsp;8, which ' +
      'answers the question a reader actually has: <b>nothing here is keyed to a list of named ' +
      'titles.</b> The mapper number is read out of the cartridge&rsquo;s own header, in three ' +
      'independent places, and that is why the site&rsquo;s game indexer identified Battletoads ' +
      'as mapper 7 where reputation would have said something else.</p>' +
    '</div>' +
  '</section>' +

  '<div class="gbemu-toc"><b>The claim</b>' +
    '<a href="#nese-1">1. What this page is, and what it is scored against</a>' +
    '<a href="#nese-2">2. The score: AccuracyCoin, a public test cartridge</a>' +
    '<a href="#nese-3">3. How the core is tested between versions</a>' +
    '<a href="#nese-4">4. The test cartridges, and the assembler that is not pinned</a>' +
    '<a href="#nese-5">5. What the automatic checks cover</a>' +
    '<a href="#nese-6">6. What a passing check is worth</a>' +
  '</div>' +

  '<div class="gbemu-toc"><b>The machine</b>' +
    '<a href="#nese-7">7. Timing: one crystal, two dividers, and the frame rate that is not 60</a>' +
    '<a href="#nese-8">8. Where the mapper number comes from</a>' +
    '<a href="#nese-9">9. The mapper chips this core has, and the ones it does not</a>' +
  '</div>' +

  '<div class="gbemu-toc"><b>What it does when you run it</b>' +
    '<a href="#nese-10">10. The commercial ladder</a>' +
    '<a href="#nese-11">11. The Famicom Disk System</a>' +
    '<a href="#nese-12">12. Running it in the browser</a>' +
  '</div>' +

  '<div class="gbemu-toc"><b>Method</b>' +
    '<a href="#nese-13">13. What this page could not establish</a>' +
    '<a href="#nese-labels">Appendix A. How to read the claims on this page</a>' +
    '<a href="#nese-gate">Appendix B. How the figures on this page are checked</a>' +
  '</div>' +

  /* The build specification follows this page in the same tab (one section per
   * area, from nes-*-emulation-tab.js). Each link's text is the area's heading. */
  '<div class="gbemu-toc"><b>The build specification, below this page</b>' +
    '<a href="#nesemu-area-machine">Machine &amp; ABI: how to build it, exactly as our core runs it</a>' +
    '<a href="#nesemu-area-cpu">CPU: how to build it, exactly as our core runs it</a>' +
    '<a href="#nesemu-area-ppu">PPU: how to build it, exactly as our core runs it</a>' +
    '<a href="#nesemu-area-apu">APU &amp; expansion audio: how to build it, exactly as our core runs it</a>' +
    '<a href="#nesemu-area-mappers">Cartridge &amp; mappers: how to build it, exactly as our core runs it</a>' +
    '<a href="#nesemu-area-fds">Disk System: how to build it, exactly as our core runs it</a>' +
    '<a href="#nesemu-area-peripherals">Peripherals &amp; VS: how to build it, exactly as our core runs it</a>' +
    '<a href="#nesemu-area-acceptance">Acceptance: how to build it, exactly as our core runs it</a>' +
  '</div>' +

  /* ==================================================================== 1 */
  '<section class="sect" id="nese-1"><h3 class="sect-h">1. What this page is, and what it is scored against</h3>' +
    '<p>The NES and the Famicom are one machine in two boxes: a Ricoh 2A03 (a 6502 core ' +
    'with the decimal flag present, settable and <em>ignored</em>, plus the audio unit on the same ' +
    'die), a 2C02 picture unit, two controller ports, and whatever banking hardware the ' +
    'cartridge happens to contain. The last of those is why an NES emulator is never finished in ' +
    'the way a Game Boy one can be: the console is small and the cartridges are not.</p>' +
    '<p class="gbemu-key"><b>Everything on this page is about one exact build of the core and ' +
    'nothing else.</b> A measurement that does not reproduce these hashes is about a different ' +
    'machine, and its number says nothing about this one.</p>' +
    '<table class="gbemu-table"><tbody>' +
      '<tr><td>Source</td><td>Eight files: ' +
        '<code>nes.c</code> 273,171, <code>nes_apu.inc</code> 105,099, <code>nes_cpu.inc</code> ' +
        '49,906, <code>nes_fds.inc</code> 82,540, <code>nes_input.inc</code> 74,202, ' +
        '<code>nes_mapper.inc</code> 695,532, <code>nes_ppu.inc</code> 142,628, ' +
        '<code>nes_vs.inc</code> 36,448 bytes. <b>1,459,526 bytes in total</b>, LF-normalised, set ' +
        'hash <code>b3cafee8e510492b&hellip;</code>. <code>nes.c</code> includes the other seven, ' +
        'so all eight are compiled.</td></tr>' +
      '<tr><td>Binary</td><td>The WebAssembly module, sha256 ' +
        '<code>8bf5958fe848c0c0&hellip;</code>, <b>257,125 bytes</b>, 208 exported functions, ' +
        '<b>0 imports</b>, ABI version 1, emulator context 157,984 bytes</td></tr>' +
      '<tr><td>Build</td><td><code>clang --target=wasm32 -nostdlib -O2 -flto -ffreestanding</code>, ' +
        'no entry point, exports dynamic, 128 KiB stack, undefined symbols allowed. <b>It is ' +
        'byte-reproducible.</b> The build recipe reproduces 257,125 bytes and that equals the ' +
        'module this site runs, byte for byte, which is what makes the hash checkable rather than ' +
        'a label.</td></tr>' +
    '</tbody></table>' +
    '<p class="hw-readable"><b>The export surface has grown by 115 and lost none</b> since the core had 93 exported functions: <b>208</b> now, <b>0 removed</b>, so a host written against an older version of this core still links. ' +
    '<b>That is not a claim that the older core is still correct</b>: the module is a different ' +
    '257,125 bytes with a different hash, and every figure on this page is about the current ' +
    'one.</p>' +
    '<p class="gbemu-key"><b>What none of this establishes is that the core is correct</b>: ' +
    'only that these bytes are the ones that built the module the site serves. A hash detects ' +
    'change, and that is the whole of its claim.</p></section>' +

  /* ==================================================================== 2
   * DECIDED 2026-10-18: this site shows only PUBLIC standard scores. No
   * figure from the internal regression board appears on this page. The score
   * shown is AccuracyCoin's, judged by the cartridge itself. */
  '<section class="sect" id="nese-2"><h3 class="sect-h">2. The score: AccuracyCoin, a public test cartridge</h3>' +
    '<p class="gbemu-key"><b>AccuracyCoin: 146 of 146, judged by the cartridge itself.</b> ' +
    'AccuracyCoin is a public NES accuracy test cartridge. It runs 146 tests of the processor, ' +
    'the picture unit, the audio unit and the timing between them, and it prints its own verdict ' +
    'for each one on the screen. Nothing outside the cartridge decides whether a test passed, so ' +
    'a pass means the behaviour matches what the cartridge was written against, not merely that ' +
    'it agrees with another emulator.</p>' +
    '<p class="hw-readable"><b>Measured on 2 November 2026, on the core this site serves, with the cartridge&rsquo;s 20 October 2026 build.</b> ' +
    'The last test to pass was the hybrid-addresses test. <b>Why this number and not ' +
    'another:</b> anyone can run the same cartridge and read the same screen, on this site, on ' +
    'another emulator or on a console, and that is what makes a score public.</p>' +
    '<p class="gbemu-key"><b>Not yet checked on a real NES.</b> The change that made the ' +
    'hybrid-addresses test pass has not yet been compared with a real console. Until it is, the ' +
    'last pass is the cartridge&rsquo;s verdict on this core and not an observation of the ' +
    'hardware.</p>' +
    '<p class="hw-readable"><b>What it does not cover.</b> AccuracyCoin tests the console itself. ' +
    'It does not test the mapper chips other cartridges carry, the Famicom Disk System or the ' +
    'input peripherals; sections 9, 11 and 12 describe those, and section&nbsp;13 lists what this ' +
    'page could not establish at all.</p></section>' +

  /* ==================================================================== 3 */
  '<section class="sect" id="nese-3"><h3 class="sect-h">3. How the core is tested between versions</h3>' +
    '<p class="hw-readable">Besides AccuracyCoin, every new version of the core is re-tested ' +
    'against a regression board of its own: a set of test cartridges that is run again before ' +
    'a version is published, so that a fix which breaks something else is caught first. ' +
    '<b>This page publishes no score from it.</b> Its make-up and its counting rules are our own ' +
    'choices, and nobody outside can run it and get a number to compare, so a total from it would ' +
    'be a figure only we could check. The public score is the one in section&nbsp;2.</p>' +
    '<h4 class="gbemu-sub">Why the processor cannot be finished first</h4>' +
    '<p class="hw-readable">Several of the processor test suites <em>measure instruction timing by ' +
    'counting an audio-unit counter</em>, and <em>detect dummy reads by watching the picture ' +
    'unit&rsquo;s vblank flag lose its value</em>. So the processor tests cannot all pass before ' +
    'the picture and audio units exist, and reporting those as plain failures would send somebody ' +
    'hunting a processor bug that is not there. One branch-timing cartridge shows it plainly: ' +
    'without the audio unit it reports <b>all 64 of its measured times as zero</b>, not wrong ' +
    'non-zero values, which is what a broken branch gives, but zero, meaning the measuring clock ' +
    'is absent.</p>' +
    '</section>' +

  /* ==================================================================== 4 */
  '<section class="sect" id="nese-4"><h3 class="sect-h">4. The test cartridges, and the assembler that is not pinned</h3>' +
    '<p class="gbemu-key"><b>A score measured against a collection of test cartridges that has ' +
    'changed is a score on a different test.</b> Two public collections are used, each pinned to ' +
    'an exact commit and kept separate, so the two never blur into one undifferentiated ' +
    'denominator.</p>' +
    '<table class="gbemu-table"><thead><tr><th>Collection</th><th>Pin</th><th>Ships</th></tr></thead><tbody>' +
      '<tr><td>the public NES test-program collection</td><td><code>95d8f621ae55cee0d09b91519a8989ae0e64753b</code></td><td>built cartridges</td></tr>' +
      '<tr><td><code>holy-mapperel</code></td><td><code>4e48b59432b5f1d3c011ac830e40ddf7ed5bbc61</code></td><td><b>source only: must be assembled</b></td></tr>' +
    '</tbody></table>' +
    '<p class="hw-readable">The first collection carries its own identity check: ' +
    '<code>nestest.nes</code> at sha256 <code>f67d55fd&hellip;</code> and a golden log at sha256 ' +
    '<code>627c8e18&hellip;</code>, exactly 8,991 lines, with two independent sources agreeing byte ' +
    'for byte. The mapper-chip suite is distributed separately and is not in the first ' +
    'collection.</p>' +
    '<p class="hw-readable"><b>The instruction set against that golden log:</b> 8,987 of its ' +
    '8,991 lines match exactly, and the other 4 differ only in one known limit of the log ' +
    'format, with the machine state right on all of them, including the 197 unofficial-opcode ' +
    'lines. A separate decode census drives all <b>256 encodings</b>: <b>12</b> halt as they ' +
    'should and <b>0</b> reach the decoder&rsquo;s default, which proves the decoder is complete ' +
    'and not that any instruction is correct.</p>' +
    '<h4 class="gbemu-sub">The assembler, and why it matters</h4>' +
    '<p class="gbemu-key"><b>The mapper-chip suite ships as source only, so its 35 cartridges are ' +
    'assembled here.</b> The collection is pinned to a commit; <b>the assembler that turns it into ' +
    'cartridges is not.</b> It is declared as any recent cc65 release, and the release in use is ' +
    '<b><code>ca65 V2.19 - Git 2ea1df8</code></b>.</p>' +
    '<p class="hw-readable"><b>A different cc65 release could emit different bytes from the same ' +
    'source without any check noticing</b>, because the built cartridges are not hashed. It is ' +
    'cheap for anyone to settle: assemble the 35 cartridges under two different cc65 releases and ' +
    'hash both sets. If every cartridge is byte-identical across releases, the exposure is ' +
    'theoretical and recording the version is enough.</p></section>' +

  /* ==================================================================== 5 */
  '<section class="sect" id="nese-5"><h3 class="sect-h">5. What the automatic checks cover</h3>' +
    '<p class="gbemu-key"><b>Before a new version of the core is published here, it runs a fixed ' +
    'set of automatic checks, and every one has to give its expected result.</b> Most of them ' +
    'test something a player would recognise:</p>' +
    '<ul class="gbemu-bullets">' +
      '<li><b>The light gun.</b> Duck Hunt registers a hit with the Zapper aimed at the duck and ' +
        'none aimed at the sky.</li>' +
      '<li><b>The other controllers.</b> Both Arkanoid editions move the paddle with the knob, the ' +
        'Power Pad runs the athlete, and the Four Score and the Famicom adapter carry players 3 ' +
        'and 4. Each is judged from what the game did, never from our own port.</li>' +
      '<li><b>The Family BASIC keyboard.</b> It types through the title, the name prompt and the ' +
        'menu, enters <code>PRINT 12*3</code>, and passes only if the program puts 36 on the ' +
        'screen. With the keyboard unplugged the same script must fail.</li>' +
      '<li><b>The Famicom accessories.</b> Each accessory added in October 2026 is read back by a small ' +
        'test program of our own against its published wiring, and played in a real game against a run ' +
        'without it: Hyper Olympic runs with the Hyper Shot buttons, Gimmi a Break buzzes in on the Party ' +
        'Tap, Exciting Boxing lands punches, the mahjong keypad discards tiles, Oeka Kids draws with the ' +
        'tablet, Barcode World reads a card, Super Mogura Tataki scores on the mole mat, Top Rider rides, ' +
        'Space Shadow fires the Hyper Shot gun, the Subor keyboard types BASIC and its mouse opens a ' +
        'window, and the Miracle Piano lesson moves on when middle C is played.</li>' +
      '<li><b>Saves.</b> Battery memory and save states survive a round trip, a battery save ' +
        'survives a reload in a real browser, and Disk System saves are played to the save on ' +
        'Metroid, The Legend of Zelda and Zelda II: the saved disk matches a reference save byte ' +
        'for byte, and a write-protected disk is left untouched.</li>' +
      '<li><b>The mapper chips.</b> Which mapper numbers the core supports is measured, not listed ' +
        '(section&nbsp;9).</li>' +
      '<li><b>The VS System.</b> The arcade mode changes no ordinary cartridge: 534 of 534 non-VS ' +
        'files run identically, frame for frame, with it and without it.</li>' +
      '<li><b>The expansion sound chips.</b> The Sunsoft 5B, VRC6, VRC7 and Namco 163 each move the ' +
        'output when driven and fall silent when switched off.</li>' +
      '<li><b>Play, not just boot.</b> A set of titles is played past the title screen on the core ' +
        'the site ships.</li>' +
    '</ul>' +
    '<p class="hw-readable"><b>Each check is itself tested with deliberately broken input</b>, ' +
    'which it must reject. A check that has never been seen to fail cannot be told apart from one ' +
    'that tests nothing.</p></section>' +

  /* ==================================================================== 6 */
  '<section class="sect" id="nese-6"><h3 class="sect-h">6. What a passing check is worth</h3>' +
    '<p class="gbemu-key"><b>A passing check here detects change; it does not certify ' +
    'correctness.</b> It says that the core under test is the exact build behind the published ' +
    'figures, and that nothing it measures has moved. Apart from AccuracyCoin, which judges ' +
    'itself, no outside authority says this core is correct, so a green result means the ' +
    'measurement did not move, not that the measurement is right.</p>' +
    '<p class="hw-readable"><b>Some checks compare this core&rsquo;s output with another ' +
    'emulator&rsquo;s, and agreement there is convergence, never correctness.</b> Two ' +
    'implementations can share one wrong belief, and a disagreement is a question rather than a ' +
    'verdict until a test cartridge or a hardware document settles it.</p></section>' +

  /* ==================================================================== 7 */
  '<section class="sect" id="nese-7"><h3 class="sect-h">7. Timing: one crystal, two dividers, and the frame rate that is not 60</h3>' +
    '<p class="hw-readable">One crystal drives the whole machine and two ' +
    'dividers hang off it. The processor and the picture unit are therefore not <em>roughly ' +
    'synchronised</em>; they are rigidly locked in an integer ratio, and every timing fact in this ' +
    'core is expressed in that ratio rather than in seconds. <b>This is a boundary fact</b>: a ' +
    're-implementer needs it before any opcode.</p>' +
    '<table class="gbemu-table"><thead><tr><th>Region</th><th>Master clock</th><th>CPU divider</th><th>Dot divider</th><th>Dots per CPU cycle</th><th>Frame rate</th></tr></thead><tbody>' +
      '<tr><td><b>NTSC</b></td><td>21.477272 MHz</td><td>&divide; 12</td><td>&divide; 4</td><td><b>exactly 3</b></td><td><b>60.0988 Hz</b></td></tr>' +
      '<tr><td><b>PAL</b></td><td>26.601712 MHz</td><td>&divide; 16</td><td>&divide; 5</td><td><b>exactly 3.2</b></td><td><b>50.007 Hz</b></td></tr>' +
    '</tbody></table>' +
    '<p class="gbemu-key"><b>3.2 is why PAL is a different machine and not a scaled NTSC one.</b> ' +
    'A dot budget that divides evenly into a CPU cycle and one that does not are different ' +
    'schedulers, not the same scheduler at another speed. PAL is a timing mode inside this core, ' +
    'not a second core, and every region-sensitive figure names its region.</p>' +
    '<p class="hw-readable"><b>Failure mode of rounding either frame rate to a whole number:</b> it ' +
    'puts the audio resampler at a slightly wrong rate. <em>It does not sound wrong immediately</em>: ' +
    'it drifts, and the audio buffer underruns or overruns on a timescale of minutes, which ' +
    'is long enough that the cause looks like anything but the frame rate.</p>' +
    '<h4 class="gbemu-sub">The audio sample rate follows from the CPU rate, and is not a round number either</h4>' +
    '<p class="hw-readable">The core emits signed 16-bit mono at the CPU rate divided by the mix ' +
    'divider: <b>1,789,773 &divide; 40 = 44,744.3 Hz</b>. It is <b>not 44,100</b> and it is not the ' +
    'device rate; the browser host resamples. A host that assumes 44,100 here gets ' +
    'the same slow drift the paragraph above describes, from a different direction.</p></section>' +

  /* ==================================================================== 8 */
  '<section class="sect" id="nese-8"><h3 class="sect-h">8. Where the mapper number comes from</h3>' +
    '<p class="gbemu-key"><b>Nothing on this site is hardcoded to work only on a subset of named ' +
    'games.</b> There is no title list anywhere in the path from a file on disk to a running ' +
    'machine. <b>The mapper number is read out of the cartridge&rsquo;s own 16-byte header</b>, ' +
    'and it is read that way in three independent places, none of which knows what any cartridge ' +
    'is called.</p>' +
    '<table class="gbemu-table"><thead><tr><th>Where</th><th>What it does with the header</th></tr></thead><tbody>' +
      '<tr><td>the site&rsquo;s game indexer</td><td>reads the mapper number when it indexes a supplied cartridge, and records it beside the title&rsquo;s length</td></tr>' +
      '<tr><td>the browser loader</td><td>parses the header again at load time and hands the number to the core along with mirroring, battery, submapper and the character-memory kind</td></tr>' +
      '<tr><td>the core</td><td>switches on the number it was handed, and exposes it back so the page can display what the machine actually believes</td></tr>' +
    '</tbody></table>' +
    '<p class="hw-readable"><b>All twelve bits, and the layout is the whole of the rule.</b> The ' +
    'low nibble is the high nibble of header byte 6; the next nibble is the high nibble of byte 7; ' +
    'and when byte 7&rsquo;s bits 2&ndash;3 read 2 (the NES 2.0 announcement), bits ' +
    '8&ndash;11 come from the low nibble of byte 8. All three are implemented, so a NES 2.0 dump ' +
    'of a mapper above 255 is described correctly rather than folded back onto some other ' +
    'mapper&rsquo;s number.</p>' +
    '<p class="hw-readable">Read from the same header and equally unguessed: <b>mirroring</b> ' +
    '(four-screen from bit 3 wins over the horizontal/vertical bit 0), <b>battery</b>, the ' +
    '512-byte <b>trainer</b> offset, the <b>submapper</b>, and whether the cartridge carries ' +
    'character RAM rather than character firmware, which is simply a declared character ' +
    'size of zero. <b>A malformed header is rejected, not guessed</b>: bad magic and a declared ' +
    'size larger than the file both refuse the load, because passing the core a bad size hands it ' +
    'a pointer to memory it does not own.</p>' +
    '<p class="gbemu-key"><b>Battletoads is the worked case, and it is the reason this section ' +
    'exists.</b> Its reputation says one thing and its header says <b>7</b>: AxROM. The ' +
    'indexer read 7, the loader read 7, and the core ran mapper 7. <b>A table of names keyed ' +
    'to titles would have had to be right about that, and a header reader cannot be wrong about ' +
    'it.</b> The only title-keyed table anywhere in this path is a lookup from <em>number to ' +
    'human-readable chip name</em>, 15 entries long, used for display; a number with no entry is ' +
    'shown as a number, which is more honest than a guess.</p></section>' +

  /* ==================================================================== 9 */
  '<section class="sect" id="nese-9"><h3 class="sect-h">9. The mapper chips this core has, and the ones it does not</h3>' +
    '<p class="gbemu-key"><b>233 mapper numbers are dispatched, and that figure is measured ' +
    'rather than listed.</b> A test builds a machine for each number, sweeps the whole cartridge ' +
    'address space and compares it against an identical mapper-0 control, so the count comes ' +
    'from running the core (measured 1 November 2026, when mapper 30, the UNROM 512 homebrew board, joined). A hand-written list of what an emulator ' +
    'supports drifts away from the code; a measured one cannot. Anything undispatched falls ' +
    'through to a default that does nothing, which is the honest behaviour: a cartridge whose ' +
    'chip is absent runs as though it had no banking hardware, and shows it.</p>' +
    '<p class="hw-readable"><b>The table below details 14 of the 233</b>: the ones with a ' +
    'failure mode worth naming to anyone re-implementing them. It is not the dispatch list and ' +
    'does not claim to be. <b>The Disk System&rsquo;s mapper 20 is not a mapper chip at all</b> ' +
    '(it is a RAM adapter with its own register window, and it has section&nbsp;11 to itself), ' +
    'and mapper 5 is absent for the structural reason stated under the table.</p>' +
    '<h4 class="gbemu-sub">How the numbers were chosen, and what a dispatched number is worth</h4>' +
    '<p class="hw-readable">The numbers were added in order of how many files each one covers in a ' +
    'large library of cartridge dumps, found by a census of the files&rsquo; own headers rather ' +
    'than by reputation, and the measuring sweep covers the whole NES 2.0 range so that numbers ' +
    'above 255 are measured rather than assumed absent. <b>A full sweep of 16,844 cartridge ' +
    'files on 18 October 2026 drew a picture from 15,989 of them (94.92%).</b> It detects change ' +
    'and gross breakage and nothing finer.</p>' +
    '<p class="hw-readable"><b>What a dispatched number is worth, stated once: it means the number ' +
    'reaches a chip that changes state.</b> That is all the measurement shows. <b>It catches a ' +
    'chip that is absent or grossly wrong and cannot catch one that is subtly wrong</b>: an ' +
    'inverted mirroring bit, an interrupt a scanline late or a character bank off by one all still ' +
    'draw a picture, and most still play.</p>' +
    '<table class="gbemu-table"><thead><tr><th>Number</th><th>Chip</th><th>The thing about it worth knowing</th></tr></thead><tbody>' +
      '<tr><td><b>0</b></td><td>NROM</td><td>latches nothing. A 16 KB part mirrors at $C000 because address line A14 is not connected: the mirror falls out of bank masking rather than being special-cased.</td></tr>' +
      '<tr><td><b>1</b></td><td>MMC1</td><td>a serial shift register, because the package had no pins for a parallel one. Powers up in the fixed-last-bank mode, and that is a convention: the datasheet says the banks are unknown at power-up. <b>Failure mode of the other mode:</b> a long list of very widely shipped titles show a black screen.</td></tr>' +
      '<tr><td><b>2</b></td><td>UxROM</td><td>switches the low 16 KB window, fixes the last bank high.</td></tr>' +
      '<tr><td><b>3</b></td><td>CNROM</td><td>a character-bank latch and nothing else.</td></tr>' +
      '<tr><td><b>4</b></td><td>MMC3</td><td><b>MMC3 has no scanline input.</b> Its only timing signal is picture-bus address line A12, which distinguishes the two pattern tables. Clocking its counter from a scanline number is the classic way an MMC3 implementation dies.</td></tr>' +
      '<tr><td><b>7</b></td><td>AxROM</td><td>32 KB program banking and single-screen mirroring selection.</td></tr>' +
      '<tr><td><b>9</b></td><td>MMC2</td><td>latch 0 fires on <b>exactly</b> two addresses.</td></tr>' +
      '<tr><td><b>10</b></td><td>MMC4</td><td>the same chip with <b>ranges</b> instead of single addresses. An implementation using ranges for both passes MMC4 <em>and can still pass MMC2</em>, which is why both are built and both are tested.</td></tr>' +
      '<tr><td><b>11</b></td><td>Color Dreams</td><td>the same shape as GxROM with the two bit-fields swapped. <b>Failure mode of assuming otherwise:</b> both fields land in the wrong place at once.</td></tr>' +
      '<tr><td><b>66</b></td><td>GxROM / MHROM</td><td>one latch, two fields, no windows.</td></tr>' +
      '<tr><td><b>69</b></td><td>Sunsoft FME-7 / 5B</td><td>a select/data register pair and a real clock. Its counter is <b>not</b> gated on A12 like MMC3&rsquo;s, so it keeps counting with the screen off.</td></tr>' +
      '<tr><td><b>78</b></td><td>IF-12 and the Jaleco board</td><td><b>Two boards share this number and do not share a mirroring scheme.</b> The container&rsquo;s submapper is the only thing that says which, so power-on applies the latch to put the wiring in a defined state rather than leaving the header&rsquo;s.</td></tr>' +
      '<tr><td><b>118</b></td><td>TxSROM</td><td>an MMC3 with one wire moved: nametable line CIRAM A10 is driven by <em>character</em> address line A17, so the nametable page varies per 1 KB region. It shares MMC3&rsquo;s register writer rather than keeping a second copy to hold in step.</td></tr>' +
      '<tr><td><b>180</b></td><td>UNROM built with a 7408</td><td>the fixed bank is ORed into the <em>high</em> window, so $8000 is fixed and $C000 switches: the opposite of UxROM. <b>Failure mode of treating it as ordinary UxROM:</b> the reset vector is read out of a switchable bank, so the title boots from whatever bank happens to be selected and crashes as soon as it switches.</td></tr>' +
    '</tbody></table>' +
    '<p class="gbemu-key"><b>Mapper 5: MMC5, implemented as a subset, and the one a reader ' +
    'will meet.</b> It is absent from the table above for a structural reason rather than a ' +
    'missing one: <b>MMC5&rsquo;s registers live at $5000&ndash;$5FFF, not in the ' +
    '$8000&ndash;$FFFF window that table dispatches</b>, so it is reached from the power-on path ' +
    'and its own register window instead of from that switch. <b>Two of the twelve cartridges in ' +
    'section 10 are mapper 5, and neither stops at the first rung</b>; one of them reaches PLAYS. ' +
    'The build specification below this page states what the subset implements and what it ' +
    'does not.</p>' +
    '<p class="hw-readable"><b>MMC5&rsquo;s expansion audio is implemented, and no cartridge in ' +
    'this library exercises it.</b> That is a measurement and not an assumption: counted register ' +
    'by register, Castlevania III writes <code>$5010</code> and <code>$5012</code> once each and ' +
    'Just Breed clears the range once, and neither ever loads a period, a length or a volume. ' +
    '<b>The NES&rsquo;s 72-pin connector does not carry the expansion-audio return pin at ' +
    'all</b>, so a Castlevania III sold for the NES could not sound those channels on the machine ' +
    'it shipped for.</p>' +
    '<h4 class="gbemu-sub">A chip that does not bank character memory still needs a character map</h4>' +
    '<p class="hw-readable"><b>The picture bus goes through the map whether or not the chip banks ' +
    'character memory.</b> Leaving the map at zero makes the pattern window eight copies of its ' +
    'own first kilobyte, so every graphic in an AxROM or UxROM title is drawn from the wrong eighth ' +
    'of pattern memory: it looks like a bank bug and is a missing initialisation. A chip that sets ' +
    'only program banks still has to start with an identity character map. Battletoads shows the ' +
    'failure loudly: nearly half its title screen changes every second with no input.</p></section>' +

  /* =================================================================== 10 */
  '<section class="sect" id="nese-10"><h3 class="sect-h">10. The commercial ladder</h3>' +
    '<p class="hw-readable"><b>The results in this section were measured on an earlier version of ' +
    'this core</b> and have not been re-taken on the current one.</p>' +
    '<p class="gbemu-key"><b>A title is not tested until it is played.</b> Loading a cartridge and ' +
    'watching it not crash is not a result. The ladder is scripted input, rungs in order, and ' +
    'every result naming which core, which power-on fill and which alignment produced it.</p>' +
    '<p class="hw-readable"><b>It detects <em>change</em> and <em>gross breakage</em>, never ' +
    'correctness</b>, and no outside reference decides any of it. A title can climb every rung ' +
    'while drawing the wrong colours, mis-timing its raster split or silently skipping a level. ' +
    '<b>What it can do that a test cartridge cannot</b> is tell the difference between ' +
    '<em>boots</em> and <em>plays</em>, because test cartridges are not games.</p>' +
    '<table class="gbemu-table"><thead><tr><th>Rung</th><th>What it means</th></tr></thead><tbody>' +
      '<tr><td><b>1 BOOTS</b></td><td>executes without jamming and produces frames</td></tr>' +
      '<tr><td><b>2 DRAWS</b></td><td>the screen holds more than one palette index</td></tr>' +
      '<tr><td><b>3 ANIMATES</b></td><td>some pixel changes during a full second</td></tr>' +
      '<tr><td><b>4 RESPONDS</b></td><td>pressing Start changes the screen <b>by more than it was changing on its own</b></td></tr>' +
      '<tr><td><b>5 PLAYS</b></td><td>after responding, it keeps animating and keeps drawing for five more seconds</td></tr>' +
    '</tbody></table>' +
    '<p class="hw-readable"><b>Five rungs, and a rung is not attempted if the one below it ' +
    'failed</b>: &ldquo;responds to input&rdquo; means nothing about a machine that never ' +
    'drew anything.</p>' +
    '<h4 class="gbemu-sub">Rung 4 carries its own control, and that is why it is worth anything</h4>' +
    '<p class="hw-readable">A title screen with a blinking cursor changes every frame, so ' +
    '&ldquo;the screen changed after I pressed Start&rdquo; proves nothing. <b>The ladder runs the ' +
    'cartridge twice.</b> Two machines from two independent loads are driven through an ' +
    'identical prefix in lockstep and then diverged by exactly one thing: one presses Start ' +
    'and the other presses nothing. Everything the attract sequence would have done on its own ' +
    'happens in <em>both</em> and cancels, and what is left (<code>EFFECT</code>, the ' +
    'histogram distance between the two) is the press and nothing else. <b>The test refuses ' +
    'without its own control</b>: before the press the two machines must be pixel-identical, ' +
    'and if they are not, no number is printed. The rung is <b><code>EFFECT &gt; 0</code></b>, ' +
    'with the magnitude printed beside it so a three-pixel result can still be argued with.</p>' +
    '<p class="hw-readable"><b>The press waits for the game to listen.</b> Some intros never read ' +
    'the controller (Battletoads reads <code>$4016</code> exactly once in 900 frames of its ' +
    'intro), so rung 4 presses only after the cartridge has actually read the controller port, ' +
    'and prints the frame at which it started listening. Because the unpressed machine cancels ' +
    'the attract sequence, a title whose attract mode is a full game demo can still be ' +
    'judged.</p>' +
    '<h4 class="gbemu-sub">The results</h4>' +
    '<table class="gbemu-table"><thead><tr><th>Title</th><th>Mapper</th><th>Rung</th><th>ambient</th><th>response</th></tr></thead><tbody>' +
      '<tr><td>Super Mario Bros.</td><td>0</td><td><b>PLAYS</b></td><td>388</td><td>32,424</td></tr>' +
      '<tr><td>Castlevania</td><td>2</td><td><b>PLAYS</b></td><td>0</td><td>45,112</td></tr>' +
      '<tr><td>Super Mario Bros. 3</td><td>4</td><td><b>PLAYS</b></td><td><b>71,500</b></td><td>70,574</td></tr>' +
      '<tr><td>Kirby&rsquo;s Adventure</td><td>4</td><td><b>PLAYS</b></td><td>2,438</td><td>32,364</td></tr>' +
      '<tr><td>Mega Man 2</td><td>1</td><td>RESPONDS</td><td>2,228</td><td>26,202</td></tr>' +
      '<tr><td>Metroid</td><td>1</td><td>RESPONDS</td><td>20,128</td><td>44,118</td></tr>' +
      '<tr><td>The Legend of Zelda</td><td>1</td><td>RESPONDS</td><td>60,458</td><td>101,018</td></tr>' +
      '<tr><td>Battletoads</td><td>7</td><td><b>PLAYS</b></td><td>0</td><td>13,574</td></tr>' +
      '<tr><td>1942</td><td>0</td><td>DRAWS</td><td>0</td><td>none</td></tr>' +
      '<tr><td>Donkey Kong</td><td>0</td><td>DRAWS</td><td>0</td><td>none</td></tr>' +
      '<tr><td>Castlevania III</td><td><b>5</b></td><td><b>PLAYS</b></td><td>25,830</td><td>11,526</td></tr>' +
      '<tr><td>Just Breed</td><td><b>5</b></td><td>ANIMATES</td><td>0</td><td>0</td></tr>' +
    '</tbody></table>' +
    '<p class="gbemu-key"><b>Twelve cartridges over six mapper numbers: 6 PLAYS, 3 RESPONDS, ' +
    '1 ANIMATES, 2 DRAWS, 0 BOOTS.</b> By mapper, the twelve are ' +
    '<b>3 of mapper 0, 3 of mapper 1, 1 of mapper 2, 2 of mapper 4, 2 of mapper 5 and 1 of ' +
    'mapper 7</b>, and <b>nothing stops at the bottom rung</b>.</p>' +
    '<h4 class="gbemu-sub">One title changes rung with the power-on fill, which is why fills are named</h4>' +
    '<p class="hw-readable">The same twelve cartridges, the same core, three fills: <b>Mega Man 2 ' +
    'climbs a rung under a randomised power-on fill and not under either deterministic one</b>, ' +
    'and every other title is unchanged. Whatever it reads out of uninitialised memory steers it. ' +
    '<b>Failure mode of reporting a single number:</b> the verdict would be recorded as a defect ' +
    'in this core and somebody would go looking for it in the mapper chip. It is a property of the ' +
    'fill, and the only way anybody can tell is that the fill is on the line.</p>' +
    '<h4 class="gbemu-sub">The dumps are matched by content, never by name</h4>' +
    '<p class="hw-readable">Every dump is classified before it is run, and a bad, over-dumped, ' +
    'translated or hacked one is <b>refused</b> rather than scored silently. <b>Just Breed is ' +
    'available as two genuinely different dumps of the same cartridge</b>: identical container ' +
    'header (same mapper, same bank counts, same size) and <b>155,126 of 786,448 payload bytes ' +
    'differ, first at offset 73,744</b>.</p>' +
    '<p class="gbemu-key"><b>Which of the two is sound cannot be decided by anything here.</b> ' +
    'Both reach the same rung, and they draw different frames (frame checksums ' +
    '<code>C6D3753D</code> and <code>CFA4A423</code>). Two different checksums say the dumps ' +
    'differ, never which one is right.</p>' +
    '<h4 class="gbemu-sub">What a rung does and does not license</h4>' +
    '<ul class="gbemu-bullets">' +
      '<li><b>PLAYS is not &ldquo;correct&rdquo;.</b> It is &ldquo;nothing gross is broken in the first fifteen seconds under one scripted input&rdquo;.</li>' +
      '<li><b>A rung is not comparable across cores</b> unless both name their fill, their alignment and their build.</li>' +
      '<li><b>A rung is not comparable across versions of the ladder.</b> Widening one rung&rsquo;s window once moved a title two rungs, so any change to the rung definitions invalidates the table.</li>' +
      '<li><b>A title near a threshold will flicker</b>, and the printed ambient and response numbers exist so that can be seen rather than guessed at.</li>' +
    '</ul></section>' +

  /* =================================================================== 11 */
  '<section class="sect" id="nese-11"><h3 class="sect-h">11. The Famicom Disk System</h3>' +
    '<p class="hw-readable"><b>Not a cartridge.</b> A RAM adapter in the cartridge slot, a cable, ' +
    'and a drive. The adapter holds 32 KB of program RAM, 8 KB of character RAM, and 8 KB of the ' +
    'drive&rsquo;s own firmware. <b>A disk is loaded by that firmware, not by the machine</b>, ' +
    'which is why this subsystem cannot be specified without it and why the firmware is part of ' +
    'the machine under test.</p>' +
    '<p class="gbemu-key"><b>What is implemented: the RAM adapter, the memory map, the drive ' +
    'transport with per-block gaps, synthesised checksums, the write path, the wavetable sound ' +
    'channel, automatic disk changes, and three pinned drive firmwares.</b> A sweep of 433 disk ' +
    'images on 18 October 2026 loaded 411 of them, and Disk System saves are checked against a ' +
    'reference save on three titles (section&nbsp;5).</p>' +
    '<h4 class="gbemu-sub">Three firmwares, and they are not three witnesses</h4>' +
    '<p class="hw-readable"><b>Every result names its drive revision, alongside the core and the ' +
    'fill.</b> Three revisions are pinned. <b>They are not three independent references:</b> one ' +
    'revision and the Sharp image differ by <b>9.5%</b> of their bytes, while the two Nintendo ' +
    'images differ by <b>39.7%</b>, so only one of the three is independent of the others, ' +
    'and a result quoted against &ldquo;the Disk System&rdquo; without naming which is not a ' +
    'result.</p>' +
    '<h4 class="gbemu-sub">The drive is a transport, and the container is not the disk</h4>' +
    '<p class="hw-readable"><b>This is what makes the Disk System different from every mapper ' +
    'chip in the core.</b> The drive has a head, a motor and a real data rate. Bytes arrive whether ' +
    'or not the processor is ready for them, the head cannot seek, and rewinding means stopping ' +
    'the motor and running the whole disk past the head again. <b>A model that returns bytes ' +
    'instantly passes a loader and fails anything that times the drive, and the firmware ' +
    'times the drive.</b> <b>One byte arrives every 150 CPU cycles</b> at the NTSC rate: the ' +
    'byte timer reloads with 149 and the byte is delivered on the cycle at which it is found at ' +
    'zero, which is about 11,932 bytes per second. The rate comes from the drive&rsquo;s ' +
    'measured data rate of about 96.4 kbit/s: a property of the motor and the encoding, not a ' +
    'designed number.</p>' +
    '<p class="hw-readable"><b>The container format discarded what the firmware expects.</b> A disk ' +
    'image stores each side&rsquo;s blocks back to back with no gaps and no CRCs, because the tools ' +
    'that made them threw both away. So the gaps are <em>synthesised</em>, and that is a property ' +
    'of the container and not of the hardware: stated here rather than buried, because a ' +
    'reader building from this page would otherwise model a disk that has never existed.</p>' +
    '<h4 class="gbemu-sub">Spin-up is an edge, not a delay</h4>' +
    '<p class="hw-readable">The motor takes time to reach speed, and a model without that is not ' +
    'merely optimistic: <b>it removes an edge the firmware is watching for</b>. The drive ' +
    'reports not-ready while it spins up and ready afterwards, and the firmware detects the ' +
    '<em>transition</em>. Report ready the instant the motor bit is set and there is no transition ' +
    'to detect, and the firmware waits forever with the head at byte 0. The spin-up length is ' +
    'chosen to be long enough for the firmware&rsquo;s poll loop to observe it; the real value ' +
    'is an analogue property of a motor and is not a designed number.</p>' +
    '<h4 class="gbemu-sub">The leader before the first block, and the sweep that found its length</h4>' +
    '<p class="hw-readable">The leader before the first block was <b>200</b> byte-periods in an ' +
    'early version of this drive model. 200 byte-periods is about one frame, and the firmware is ' +
    'not yet listening in that frame. Sweeping the leader with everything else held gives a ' +
    '<b>plateau</b>, not a peak (this sweep was taken before the per-block gaps were ' +
    'modelled):</p>' +
    '<table class="gbemu-table"><thead><tr><th>Leader swept</th><th>status register read</th><th>data register read</th></tr></thead><tbody>' +
      '<tr><td>200, 1000, 3000, 3200</td><td><b>0 times</b></td><td><b>2 times</b></td></tr>' +
      '<tr><td>3400, 3500, 3520, 3537</td><td><b>4 times</b></td><td><b>118 times</b></td></tr>' +
      '<tr><td>4000, 5000, 8000, 16000</td><td><b>4 times</b></td><td><b>118 times</b></td></tr>' +
    '</tbody></table>' +
    '<p class="gbemu-key"><b>A tuned constant has a best value and gets worse either side of it. ' +
    'This has a threshold between 3,200 and 3,400 and is then flat to 16,000: eighty times ' +
    'the old value.</b> That is the signature of <em>a race being won</em>, not of a number being ' +
    'tuned. What is being raced: the drive firmware releases the transfer reset, spends about ' +
    'fifteen frames doing other work, and only then arms the byte interrupt. <b>A 200-byte leader ' +
    'has long since ended by then, so the first byte the firmware is handed is 3,046 bytes into ' +
    'the side (the middle of the disk-info block) instead of the byte that starts ' +
    'it.</b></p>' +
    '<p class="hw-readable"><b>The value used is derived, not searched for.</b> A real disk ' +
    'carries roughly 28,300 bits of unwritten leader before the first block, which is ' +
    '<b>3,537 bytes</b>. <b>That it lands inside the measured plateau rather than at its edge is ' +
    'the check on the derivation</b>, and it is the reason this is a hardware figure and not a ' +
    'number that happened to work.</p>' +
    '<p class="gbemu-key"><b>The leader and the gap interact, and that is worth knowing before ' +
    'sweeping either.</b> With the leader too short <em>and</em> the synthesised gap delivered as ' +
    'readable data, lengthening the leader alone changes nothing and silencing the gap alone ' +
    'changes nothing: three of the four combinations behave identically and only the fourth ' +
    'moves. Swept one at a time, neither looks as if it matters.</p>' +
    '<h4 class="gbemu-sub">What is still unchecked</h4>' +
    '<ul class="gbemu-bullets">' +
      '<li><b>The checksums are synthesised, not modelled.</b> A <code>.fds</code> image discarded ' +
        'the real ones, so the error flag is never driven and <b>a corrupt disk reads as a good ' +
        'disk</b>. No amount of work on the drive can lift that limit from a <code>.fds</code> ' +
        'file.</li>' +
      '<li><b>The wavetable channel has never been compared with an outside reference.</b> It is ' +
        'implemented and it moves the mix. The music heard while a disk boots is the drive ' +
        'firmware&rsquo;s own boot music played on the console&rsquo;s audio unit, so it is no ' +
        'evidence that the wavetable is right.</li>' +
      '<li><b>Whether three drive registers are gated by the master I/O enable is not ' +
        'known.</b> No test measures it. Gating the whole register range broke a test that was ' +
        'passing, so the reload latch is <em>not</em> gated and the other three are left ' +
        'alone.</li>' +
    '</ul></section>' +

  /* =================================================================== 12 */
  '<section class="sect" id="nese-12"><h3 class="sect-h">12. Running it in the browser</h3>' +
    '<h4 class="gbemu-sub">The frame callback is not a clock</h4>' +
    '<p class="gbemu-key"><b>Emulation is paced by the wall clock; the animation-frame callback ' +
    'only paints.</b> Running one emulated frame per animation frame looks right, on the ' +
    'reasoning that the display is 60 Hz and the machine is 60.0988 Hz, and it is wrong: in a ' +
    'visible tab the callback was measured at 29.9 Hz, which ran the machine at half speed and ' +
    'starved the audio.</p>' +
    '<p class="hw-readable"><b>The callback rate follows the display, the compositor, window ' +
    'occlusion and the browser&rsquo;s own throttling.</b> A 30 Hz panel halves it; a hidden tab ' +
    'takes it to zero. So the host turns elapsed real time into whole emulated frames on a 4 ms ' +
    'tick and runs them, <b>at most four per tick</b>, so that a long stall is dropped rather than ' +
    'replayed as a burst. <b>Failure mode of the obvious design:</b> every symptom appears in the ' +
    'audio, and every hour spent there is wasted, because the defect is in the pacing.</p>' +
    '<p class="hw-readable"><b>One measurement, with its conditions.</b> An earlier version of ' +
    'the browser page, paced the same way, ran <b>60.10 emulated frames per second</b> against the ' +
    'machine&rsquo;s <b>60.0988 Hz</b>, with 0 underruns, 0 drops and 89 ms of audio latency, ' +
    '<b>over 8 seconds on one MMC3 title</b>, in Chrome, <b>with the tab asserted visible</b>. ' +
    'That last condition matters: a hidden tab fires no frame callbacks at all, so a runtime ' +
    'figure quoted without asserting visibility is a figure about a machine nobody was watching. ' +
    '<b>No tolerance is stated for the gap between the two numbers</b>: it is an agreeing reading ' +
    'over eight seconds of one title, not a pass band.</p>' +
    '<h4 class="gbemu-sub">An exported counter that reads zero forever</h4>' +
    '<p class="gbemu-key"><b>The core exports a completed-frames counter, ' +
    '<code>nes_frames_done</code>, that is never incremented.</b> It is zeroed at reset and ' +
    'written nowhere else, so <b>it reads 0 for the lifetime of the machine</b>. The frame number ' +
    'that does advance is <code>nes_frame</code>, and a host should wait on that one. An export ' +
    'that always reads zero is indistinguishable, from outside, from a machine that has stopped: ' +
    'a host written against it would report a dead emulator running at full speed.</p>' +
    '<h4 class="gbemu-sub">The frame the host actually draws</h4>' +
    '<p class="hw-readable">The framebuffer is <b>256 &times; 240</b>: <b>61,440 pixels</b>, ' +
    '<b>122,880 bytes</b> at two bytes each. <b>Bits 0&ndash;5 are the palette index and bits ' +
    '6&ndash;8 are the colour-emphasis bits latched from the mask register at that pixel</b>, so ' +
    'emphasis is per-pixel rather than per-frame and a renderer that applies it globally will be ' +
    'wrong on exactly the titles that use it for an effect. <b>The buffer is a view into linear ' +
    'memory and is invalidated by any growth of that memory</b>, so it is fetched fresh rather ' +
    'than cached: a cached view survives testing and fails in the field.</p></section>' +

  /* =================================================================== 13 */
  '<section class="sect" id="nese-13"><h3 class="sect-h">13. What this page could not establish</h3>' +
    '<p class="gbemu-key"><b>Every item here is an absence with a name.</b> A page whose gaps are ' +
    'unlisted is a page that has silently promoted its guesses.</p>' +
    '<ul class="gbemu-bullets">' +
      '<li><b>No figure on this page comes from our own measurement of real hardware.</b> ' +
        'Every number is scored against a self-reporting test cartridge, against another ' +
        'implementation&rsquo;s output, or against our own instruments, and where a value rests on ' +
        'someone else&rsquo;s published hardware measurement, the build specification cites it. ' +
        'There is no bench and no oscilloscope behind this page.</li>' +
      '<li><b>The light gun is a model, calibrated rather than measured.</b> It is the same for ' +
        'every game: each pixel&rsquo;s light is its composite level decoded to NTSC colour, raised ' +
        'to the tube&rsquo;s power and weighted per phosphor by the diode, which sees a small spot ' +
        'round the aim point and answers a few lines late. Its values were chosen by running a ' +
        'light-gun test cartridge on this core against 45 published readings from real hardware, ' +
        'and 44 of the 45 land within two lines. That is agreement with published readings, not a ' +
        'measurement of a real gun.</li>' +
      '<li><b>The one runtime frame-rate reading this page carries is eight seconds of one ' +
        'title on one browser</b> (section&nbsp;12). The on-screen readout is rounded to a whole ' +
        'number before it is displayed and cannot support a figure to two decimal places, so that ' +
        'reading came from an instrumented run and not from the page. <b>No tolerance is declared ' +
        'for it</b>, which means it can detect a gross pacing failure and nothing finer.</li>' +
      '<li><b>The assembler that builds the mapper-chip suite&rsquo;s 35 cartridges is ' +
        'not pinned.</b> Section 4 carries it and the cheap way to settle it.</li>' +
      '<li><b>Which of two Just Breed dumps is sound is undecided</b>, and no signature check ' +
        'available here separates them. Section 10 describes them.</li>' +
      '<li><b>One title plays and is nearly silent</b>: an audio RMS of 27 where its playing ' +
        'peers read 587 to 1,504, an order of magnitude apart. <b>It is recorded as an open lead, ' +
        'not diagnosed.</b></li>' +
      '<li><b>Expansion sound levels are not measured.</b> Six extra sound sources are ' +
        'implemented: the VRC6, the VRC7&rsquo;s FM synthesis, the Namco 163, the Sunsoft 5B, ' +
        'the MMC5 and the Disk System&rsquo;s wavetable. Nothing available measures any cartridge ' +
        'sound chip&rsquo;s absolute output level, so every level except the VRC7&rsquo;s rests on ' +
        'one stated assumption, and several are set to match another emulator rather than a ' +
        'console.</li>' +
      '<li><b>The library sweep in section&nbsp;9 says how many files drew a picture, not whether ' +
        'any of them is right.</b> At that size the useful output is the list of files that did ' +
        'not draw and why, and that list is kept per file.</li>' +
      '<li><b>This page makes no claim to be the most accurate NES emulator.</b> A comparison ' +
        'whose basis is not stated is worse than none, so no other emulator&rsquo;s published ' +
        'figure is quoted beside ours here. The public comparison is AccuracyCoin, which anyone can ' +
        'run on any emulator.</li>' +
    '</ul></section>' +

  /* ================================================================ APP-A */
  '<section class="sect" id="nese-labels"><h3 class="sect-h">Appendix A. How to read the claims on this page</h3>' +
    '<p class="hw-readable">Where a value follows from how the hardware is wired, the page says ' +
    'why. Where it comes from a measurement, the page says what was measured and on what. Where ' +
    'it is a convention or a calibrated choice, the page says so in words, and where something is ' +
    'not known, it is listed in section&nbsp;13.</p>' +
    '<p class="gbemu-key"><b>The one exception to &ldquo;explain it&rdquo; is emergent ' +
    'silicon.</b> The dot at which sprite evaluation garbles object memory, the cycle a sample ' +
    'fetch steals and the controller read it corrupts, open-bus decay, the exact dummy accesses ' +
    'of a read-modify-write opcode: these have no design intent behind them. For those the value ' +
    'is taken from measurement and cited, and nobody should spend a week hunting an explanation ' +
    'that does not exist.</p></section>' +

  /* ================================================================ APP-B */
  '<section class="sect" id="nese-gate"><h3 class="sect-h">Appendix B. How the figures on this page are checked</h3>' +
    '<p class="hw-readable"><b>This page is checked by a program before it is published.</b> It ' +
    'renders the page, reads the figures back, and re-derives every figure that another figure ' +
    'depends on: the eight source file sizes must add up to the stated total, the factbox must ' +
    'state the build the site actually serves, the clock dividers must give the stated ratios, ' +
    'and the ladder&rsquo;s tallies must match its table.</p>' +
    '<p class="gbemu-key"><b>It holds numbers, not words.</b> A sentence that describes a ' +
    'mechanism backwards still passes, so the wording is checked by reading it, and when a check ' +
    'fails, the wrong number is found by re-deriving it from its source, never by making one ' +
    'match the other.</p></section>' +

  '</div>';
}
