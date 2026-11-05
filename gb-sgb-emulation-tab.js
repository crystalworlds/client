/* ===========================================================================
 * Game Boy Emulation tab, area 7 of eight: Super Game Boy and link devices
 * gbSgbEmulationTabHTML(d) returns this area's HTML; the tab's composer in
 * gb-emulation-tab.js calls every area in order (2 November 2026: the tab
 * was split into area files so a builder can read one area at a time).
 * Loaded by a plain <script src> tag (the site must open over file://).
 * =========================================================================== */

function gbSgbEmulationTabHTML(d) {
  return '<div class="gbemu-area" id="gbemu-area-sgb">' +

  '<section class="sect gbemu-area-head" id="gbemu-area-sgb-head"><h3 class="sect-h">Area 7 of eight: Super Game Boy and link devices</h3>' +
    '<p class="gbemu-key">The Super Game Boy (the shelf and the packet protocol) and the devices on the link port and around the console: the Game Boy Printer, the link cable, infrared, rumble, the HuC3 tone, the Barcode Boy and the Pocket Sonar. These were parts of appendix A (A.1, A.1.1 and A.6) and keep their numbers.</p>' +
    '<p class="hw-readable">This area is the file <code>gb-sgb-emulation-tab.js</code>, one of the eight area files that together make the Game Boy Emulation tab. It can be read on its own; the build checklist is in the first area, and the rule for what a build must implement is beside it.</p>' +
    '<p class="hw-readable"><b>Where the rest of this page is.</b> When a sentence here points to a section or appendix that is not in this area, it is in one of these files (the links work on the assembled page):</p><ul class="gbemu-bullets"><li><b>Overview, build checklist and interface</b> (<code>gb-machine-emulation-tab.js</code>): <a href="#gbe-m1">1. Clocks, map, and one phase that matters</a> <a href="#gbe-m3">3. Where the machine starts</a> <a href="#gbe-gaps">24. What this page does not cover</a></li><li><b>Processor</b> (<code>gb-cpu-emulation-tab.js</code>): <a href="#gbe-m2">2. The processor</a> <a href="#gbe-ops">Appendix D. The instruction set</a></li><li><b>Memory, timer, interrupts, transfers, serial, pad</b> (<code>gb-memory-emulation-tab.js</code>): <a href="#gbe-m4">4. Timer, DMA, interrupt line</a> <a href="#gbe-hw">5. What a real Game Boy settled</a> <a href="#gbe-regs">Appendix A. Every register, every bit</a></li><li><b>Picture</b> (<code>gb-ppu-emulation-tab.js</code>): <a href="#gbe-m5">6. The sprite scan</a> <a href="#gbe-1">7. The decision that decides everything</a> <a href="#gbe-2">8. Step the machine by dots</a> <a href="#gbe-3">9. The fetcher</a> <a href="#gbe-4">10. The two FIFOs</a> <a href="#gbe-5">11. The window is a separate machine</a> <a href="#gbe-6">12. Sprites stall the pipeline</a> <a href="#gbe-7">13. Writes that land mid-line</a> <a href="#gbe-8">14. Interrupts, blocking, power</a> <a href="#gbe-addr">Appendix C. Tile, map and object addressing</a> <a href="#gbe-pipe">Appendix E. The picture pipeline, in numbers</a></li><li><b>Sound</b> (<code>gb-apu-emulation-tab.js</code>): <a href="#gbe-s1">15. The sound unit is not on the processor&rsquo;s clock</a> <a href="#gbe-s2">16. The square channels</a> <a href="#gbe-s3">17. Wave, noise, and power</a> <a href="#gbe-sound-regs">Appendix B. The sound registers, and the primitives the refinements modify</a></li><li><b>Cartridges and mappers</b> (<code>gb-mappers-emulation-tab.js</code>): <a href="#gbe-mappers">Appendix H. The cartridge mappers, register by register</a></li><li><b>Tests and scores</b> (<code>gb-acceptance-emulation-tab.js</code>): <a href="#gbe-9">18. Traps that cost us weeks</a> <a href="#gbe-10">19. What to test with, in order</a> <a href="#gbe-11">20. How to measure a change</a> <a href="#gbe-score">21. The score, and what a score is worth</a> <a href="#gbe-unwinnable">22. Rows nobody can win honestly</a> <a href="#gbe-12">23. The evidence</a> <a href="#gbe-labels">Appendix F. Labels, flexibility, and what is not established</a> <a href="#gbe-verify">Appendix G. The verification scorecard</a></li></ul>' +
  '</section>' +
  '<div class="gbemu-toc"><b>In this area</b><a href="#gbe-sgb">Appendix A, continued: the Super Game Boy and the link-port devices</a></div>' +

  '<section class="sect" id="gbe-sgb"><h3 class="sect-h">Appendix A, continued: the Super Game Boy and the link-port devices</h3>' +
    '<p class="hw-readable">Three parts of appendix A, kept here with their numbers: the end of A.1 (now numbered A.1.2, the Game Boy Printer, and A.1.3, the extra hardware around the console), A.1.1 and A.6. The rest of appendix A is in the area &ldquo;Memory, timer, interrupts, transfers, serial, pad&rdquo;. A clean build of the core needs only A.6; A.1.1 to A.1.3 describe devices and site features that are off unless a cartridge has them or the player attaches them (Rule A.1.3/1).</p>' +

    '<h4 class="gbemu-sub" id="gbe-printer">A.1.2: The Game Boy Printer, a device on the link port</h4>' +
    '<p class="hw-readable">The core carries a printer that answers on the cable as the real one does: packets of commands (initialize, data, print, status inquiry), an 8&nbsp;KiB image buffer filled in bands of 160 by 16 dots, the run-length code games use to shorten their data, palettes and margins, and a checksum on every packet. The layout is Pan Docs&rsquo; &ldquo;Game Boy Printer&rdquo;; every rule below is read from our source.</p>' +
    '<div class="gbemu-rule" id="gbr-A-1-2-1"><b>Rule A.1.2/1.</b> The Game Boy is always the clock master. It sends a packet as these serial bytes, in this order:' +
      '<ol class="gbemu-steps">' +
        '<li><code>88</code>, then <code>33</code> (the two opening bytes).</li>' +
        '<li>The <b>command</b>: <code>01</code> initialize, <code>02</code> print, <code>04</code> data, <code>0F</code> status inquiry.</li>' +
        '<li>The <b>compression flag</b>: 1 means the body is run-length coded (Rule A.1.2/4); 0 means it is not.</li>' +
        '<li>The <b>body length</b> in bytes, two bytes, low byte first.</li>' +
        '<li>The body (as many bytes as the length says; none when it is 0).</li>' +
        '<li>The <b>checksum</b>, two bytes, low byte first: the 16-bit sum of the command byte, the compression flag, both length bytes and every body byte.</li>' +
        '<li>Two closing bytes (games send <code>00</code>).</li>' +
      '</ol></div>' +
    '<div class="gbemu-rule" id="gbr-A-1-2-2"><b>Rule A.1.2/2.</b> Each byte the Game Boy sends shifts one byte back from the printer. The printer sends <code>00</code> back during every byte from the first opening byte to the second checksum byte, <code>81</code> during the first closing byte, and its status byte (Rule A.1.2/3) during the second closing byte.</div>' +
    '<div class="gbemu-example"><b>Example.</b> A status inquiry with no body: the Game Boy sends <code>88 33 0F 00 00 00 0F 00 00 00</code> (command <code>0F</code>, flag 0, length 0, checksum <code>000F</code> sent as <code>0F 00</code>, two closing bytes). The printer sends back eight <code>00</code> bytes, then <code>81</code>, then its status byte.</div>' +
    '<div class="gbemu-rule" id="gbr-A-1-2-3"><b>Rule A.1.2/3.</b> The status byte&rsquo;s bits:' +
      '<table class="gbemu-table"><thead><tr><th>Bit</th><th>Set when</th></tr></thead><tbody>' +
        '<tr><td>0</td><td>this packet&rsquo;s checksum was wrong; the packet is refused and nothing prints</td></tr>' +
        '<tr><td>1</td><td>the printer is busy printing</td></tr>' +
        '<tr><td>2</td><td>ready: an end-of-page data packet (Rule A.1.2/4) has been processed; it stays set after printing and is cleared by initialize or by the timeout of Rule A.1.2/6</td></tr>' +
        '<tr><td>3</td><td>data has been received and not yet processed</td></tr>' +
        '<tr><td>4</td><td>the command byte was not one of the four in Rule A.1.2/1</td></tr>' +
      '</tbody></table></div>' +
    '<div class="gbemu-rule" id="gbr-A-1-2-4"><b>Rule A.1.2/4.</b> A data packet&rsquo;s body is image data in tile format, in bands of 160 by 16 dots (two rows of 20 tiles, 640 bytes), appended to the 8&nbsp;KiB buffer. With the compression flag set, the body is read as runs: a byte n with bit 7 set means &ldquo;the next byte, repeated (n &amp; <code>7F</code>) + 2 times&rdquo;; a byte n with bit 7 clear means &ldquo;the next (n &amp; <code>7F</code>) + 1 bytes, copied as they are&rdquo;. A data packet with length 0 marks the end of the page. A data packet that arrives after a finished print starts a new page.</div>' +
    '<div class="gbemu-example"><b>Example.</b> The compressed body <code>82 AA 01 11 22</code> unpacks to <code>AA AA AA AA 11 22</code>: <code>82</code> has bit 7 set, so <code>AA</code> is repeated 2 + 2 = 4 times; <code>01</code> has bit 7 clear, so the next 1 + 1 = 2 bytes are copied.</div>' +
    '<div class="gbemu-rule" id="gbr-A-1-2-5"><b>Rule A.1.2/5.</b> A print packet has a 4-byte body, in this order: the number of copies (0 prints nothing but the margins); the margins (high nibble before the image, low nibble after it, each unit 16 dot lines of paper feed); the palette (the 2-bit shade for each colour index, as BGP; <code>00</code> acts as <code>E4</code>); the exposure (its low 7 bits). A print packet is ignored while the printer is busy, and ignored before the end-of-page packet has been processed.</div>' +
    '<div class="gbemu-rule" id="gbr-A-1-2-6"><b>Rule A.1.2/6.</b> When a packet takes effect: an initialize, data or print packet acts after the printer has sent its own status byte for that packet (so its status byte still shows the state before it). A status inquiry first processes what is pending and then sends its status byte. A gap of more than 100&nbsp;ms of emulated time with no byte, while the paper is not moving, returns the printer to its initialized state.</div>' +
    '<div class="gbemu-rule" id="gbr-A-1-2-7"><b>Rule A.1.2/7.</b> Print timing, in emulated time: 272&nbsp;ms from the start of a print to the first dot line, then 66.8&nbsp;ms per dot line. A Game Boy Camera photo therefore takes about 14 seconds, as on the real printer.</div>' +
    '<div class="gbemu-rule" id="gbr-A-1-2-8"><b>Rule A.1.2/8.</b> On this site the printer is attached to every cartridge in a listening mode: it drives the cable only after the game has sent the two opening bytes <code>88 33</code>. A game that looks for another Game Boy on the cable therefore still finds nothing.</div>' +
    '<div class="gbemu-why"><b>Why.</b> When a packet takes effect: MECHANISM, read from the order of replies in real-printer captures. The timing is DERIVED from four real prints (Game Boy Camera, Super Mario Bros. Deluxe, two Pokemon Crystal pages): each one&rsquo;s count of busy replies is matched to the poll. The start delay has no measured cause (NOT ESTABLISHED). <b>Checked</b>: the Camera&rsquo;s replies equal the real capture&rsquo;s run for run and its printed frame equals the real print on 8,704 of 8,704 pixels; Pokemon Crystal&rsquo;s picture box equals a real print on 3,136 of 3,136. The printer sits outside the machine&rsquo;s own state, so with no printer attached the core behaves exactly as it does without the printer, and every save state still loads.</div>' +

    '<h4 class="gbemu-sub" id="gbe-extra-hw">A.1.3: The extra hardware around the console</h4>' +
    '<div class="gbemu-rule" id="gbr-A-1-3-1"><b>Rule A.1.3/1.</b> Each part in the table below is off unless the cartridge has it or the player plugs it in. With all of them off the core is the one measured on the board.</div>' +
    '<p class="hw-readable">Sources: Pan Docs (Super Game Boy, Serial Data Transfer, HuC3, the Colour registers), SameBoy (MIT) for the Super Game Boy&rsquo;s order of effects and the infrared sensor, and Dan Docs (shonumi) for the Barcode Boy and the Pocket Sonar.</p>' +
    '<table class="gbemu-table"><thead><tr><th>Part</th><th>What the core does</th><th>Label</th></tr></thead><tbody>' +
    '<tr><td><b>Super Game Boy</b></td><td>The Game Boy inside a Super Game Boy is an original machine with a packet receiver on the joypad lines (A.6). Every ' +
    'complete 16-byte packet from an unlocked cartridge (header <code>0x146</code> = <code>0x03</code>, <code>0x14B</code> = <code>0x33</code>) is handed ' +
    'to the page, which does what the SNES did: the four palettes (PAL01, PAL23, PAL03, PAL12, PAL_SET, PAL_TRN), the colour per 8 by 8 cell (ATTR_BLK, ' +
    'ATTR_LIN, ATTR_DIV, ATTR_CHR, ATTR_SET, ATTR_TRN), the border (CHR_TRN, PCT_TRN; 256 tiles of 4 bits, a 32 by 28 map, four 16-colour palettes) and the ' +
    'screen mask (MASK_EN), shown as a 256 by 224 picture with the screen at (48, 40). A transfer reads the screen as the console drew it, three frames ' +
    'after its command. MLT_REQ selects up to four players; the core reads the chosen player&rsquo;s own buttons. Not done: the SNES&rsquo;s own sound ' +
    '(SOUND, SOU_TRN), programs sent to the SNES (DATA_SND, DATA_TRN, JUMP), and the SNES program&rsquo;s boot animation. Until a game sends its ' +
    'border, the border is the SNES program&rsquo;s own default border, or the built-in border chosen in Settings, when a Super Game Boy firmware file is on a game server (' +
    'section A.1.1), else plain black.</td><td>MECHANISM. CONVERGENCE (SameBoy): the border fades out and in over 64 frames; the 32 ' +
    'built-in palettes and the title table used by the &ldquo;every game&rdquo; choice.</td></tr>' +
    '<tr><td><b>Link cable</b></td><td>Two machines run together, the second kept level with the first to the dot. On the driving machine&rsquo;s falling ' +
    'clock edge one bit goes each way; the other machine shifts only while its own transfer is enabled with the external clock, and its eighth bit ends ' +
    'its transfer and raises its serial interrupt.</td><td>MECHANISM. CONVERGENCE (SameBoy): a partner with its serial port off sends 0 bits, a partner on ' +
    'its own clock sends 1 bits.</td></tr>' +
    '<tr><td><b>Infrared</b></td><td>Only between two linked machines: a sensor sees any LED that is on (the Colour&rsquo;s <code>FF56</code> bit 0, or a ' +
    'HuC1 or HuC3 cartridge&rsquo;s own LED, register <code>0x0E</code>, bit 0), including its own. With reading enabled, light clears <code>FF56</code> bit 1; ' +
    'HuC1 and HuC3 read <code>0xC1</code>. A steady light fades from the sensor. Alone, a machine sees no light.</td><td>MECHANISM for the registers. ' +
    'CONVERGENCE (SameBoy&rsquo;s sensor model: warm-up 19,900 cycles, threshold 240, fade after 31,500).</td></tr>' +
    '<tr><td><b>Rumble</b></td><td>On types <code>1C</code> to <code>1E</code>, bit 3 of the RAM-bank register is the motor; the core reports the share of ' +
    'each frame it was on, and the page vibrates the controller (or a phone).</td><td>MECHANISM</td></tr>' +
    '<tr><td><b>HuC3 tone</b></td><td>The second extended command <code>0xE</code> with controller memory <code>0x27</code> = 1 triggers a tone, ' +
    'number <code>0x26</code> &amp; 3. No source anywhere describes the sound, so the page plays an alarm-clock beep (0.1 s on, 0.1 s off; 1046, 1319, ' +
    '1568 or 2093 Hz) while <code>0x27</code> stays 1, at most 10 seconds.</td><td>MECHANISM for the trigger; FITTED for the sound.</td></tr>' +
    '<tr><td><b>Barcode Boy</b></td><td>A device on the link port: it answers the game&rsquo;s <code>10 07 10 07</code> with <code>FF FF 10 07</code>; ' +
    'when a card is swiped it drives the cable and sends STX, the 13 digits in ASCII and ETX, twice (30 bytes), then wants the greeting again.</td>' +
    '<td>MECHANISM. FITTED: one byte per 4,096 cycles, and a byte waits until the game&rsquo;s transfer is enabled.</td></tr>' +
    '<tr><td><b>Pocket Sonar</b></td><td>An MBC1 with a sonar. <b>Recognised</b> by the header alone: the cartridge type selects MBC1 (H.1) and the eleven title bytes at <code>0134</code>-<code>013E</code> read <code>POCKETSONAR</code> in ASCII; nothing else marks it. Then: <code>0x6000</code> = 1 selects it, <code>0x4000</code> 1 then 0 sends a pulse, ' +
    '<code>0xA000</code> reads the echo arriving now (open water, an object, a single <code>0x00</code> at the floor, then the floor). The depth is the ' +
    'time since the pulse at 1,500 m/s, there and back. A Colour reads <code>0x00</code>.</td><td>MECHANISM for the registers and the timing. FITTED: ' +
    'the lake is simulated (a floor between about 4 and 9 metres, a few fish).</td></tr>' +
    '</tbody></table>' +

    '<h4 class="gbemu-sub" id="gbe-sgb-shelf">A.1.1: The Super Game Boy shelf</h4>' +
    '<p class="hw-readable"><b>The site, not the core.</b> A.1.1 describes what this site does around the core; a build of the core needs none of it. <b>What it is.</b> Super Game Boy is a system of its own on this site, beside Game Boy and Game Boy Color, as many ' +
    'emulators show it. Its games are ordinary Game Boy cartridges, so the same game can sit on the Super Game Boy shelf <em>and</em> ' +
    'on the Game Boy or Game Boy Color shelf. The game server lists each file once and says which shelves hold the same ' +
    'bytes, so a title on the Super Game Boy shelf plays the same cartridge, with the same saves, as its Game Boy tile. Picking Super Game Boy in ' +
    'the Systems menu shows the shelf; on the mixed wall each game shows once, as its Game Boy or Color tile.</p>' +
    '<p class="hw-readable"><b>How it plays.</b> The same core (the served one, below), opened in Super Game Boy mode for every game the shelf ' +
    'holds, whatever the Super Game Boy choice in Settings says: the Game Boy inside the Super Game Boy is an original machine, so a game made for ' +
    'the Color as well plays on that machine, as it does on a real Super Game Boy. A real Super Game Boy never reads the Color flag at ' +
    '<code>0x143</code>; it reads the Super Game Boy flag. So a cartridge marked Color-only that also asks for the Super Game Boy ' +
    '(<code>0x146</code> = <code>0x03</code> with <code>0x14B</code> = <code>0x33</code>), such as the homebrew In the Dark, runs on the ' +
    'Game Boy inside it, sends its own border and palettes and plays in Super Game Boy mode. A Color-only cartridge ' +
    'without that flag plays as a Color game. The picture is the Super NES&rsquo;s 256 by 224 television picture, enlarged to fill the play window; there is no ' +
    'television drawn around it.</p>' +
    '<p class="hw-readable"><b>The border, by the rule of the real machine.</b> The game&rsquo;s own border when it sends one (CHR_TRN and ' +
    'PCT_TRN, above). Before that, the Super Game Boy&rsquo;s own default border, which is Nintendo&rsquo;s artwork inside the Super NES ' +
    'cartridge program, so it is never shipped: a game server provides the file (the firmware slot &ldquo;Super Game Boy SNES ' +
    'program&rdquo;) and the page reads the border out of it each time (<code>play/cores/gb/sgb-border.mjs</code>). With no such file, the ' +
    'game&rsquo;s fan art instead (below); plain black only with neither. Where it is: in SGB1 (256 KB) the tiles at <code>$03:D868</code> and the map at <code>$04:EE6F</code>, each packed ' +
    'with the program&rsquo;s own word packing (its routine at <code>$01:83CA</code>: a marker word, then literal words or a marker, an offset ' +
    'into the output and a count of words to copy), and the four colour palettes at <code>$04:EFF1</code> + <code>$80</code>; in SGB2 (512 KB) ' +
    'the same three stored plain at <code>$0B:C2C0</code>, <code>$0A:9800</code> and <code>$0B:8000</code> + <code>$80</code>. The map&rsquo;s ' +
    'palette 7 is shown as palette 4, as the program leaves it after its boot animation. MECHANISM: Nintendo&rsquo;s own data, read in place; ' +
    'the layout was learned from Gearboy (GPL-3.0, read for the format only, no code taken), which reports its result identical, pixel for ' +
    'pixel, to what the real program leaves in video memory. Checked here on both program versions: SGB1 draws the grey Game Boy frame ' +
    'with &ldquo;Nintendo Super GAME BOY&rdquo;, SGB2 the Game Boy Pocket frame.</p>' +
    '<p class="hw-readable"><b>The other built-in borders.</b> On a real Super Game Boy the player picks a border from the ' +
    'machine&rsquo;s own menu (L and R together, then the picture-frame icon): the default, a black one and seven pictures. Each is placed by ' +
    'its own routine in the Super NES program (a table of loaders at SGB1 <code>$01:8071</code>, by the border number at <code>$0C03</code>; ' +
    'SGB2 changes them in bank <code>$08</code>), so the steps were found by running both programs on a small 65816 interpreter written for ' +
    'this, through their own menu to each border, and recording what the program did: its unpacking routine (<code>$01:D6C8</code>, the same ' +
    'packing as above), each copy into the border&rsquo;s tiles and map, and the palette address its fade-in reads (the four palettes at ' +
    'that address + <code>$80</code>). The page replays those steps from the player&rsquo;s own firmware (<code>sgb-border.mjs</code>), so no ' +
    'artwork is shipped. Checked: every border built this way is identical, pixel for pixel, to the picture the program itself left on ' +
    'screen, and none moves (60 seconds sampled). SGB1: Black, Windows and clouds, Cork board, Sign in a forest, Cats, Desk, Stairs; SGB2: ' +
    'Black, Circuit board, Palm trees, Tiled wall, Gears, Swamp, Dolphins, Temple. In Windows and clouds the clouds are sprites copied from ' +
    'a table (<code>$02:D2AD</code>), drawn over the border by the console&rsquo;s priority rule; Gears uses more than 256 tile places but ' +
    'at most 256 different tiles, which are renumbered. The choice is in the play window&rsquo;s Settings, Display, &ldquo;Super Game Boy ' +
    'border&rdquo;, shown when the firmware is loaded; it replaces only the firmware&rsquo;s default, never the game&rsquo;s own border. ' +
    'Not offered: SGB1&rsquo;s Theatre. Its audience are sprites placed and moved by the program&rsquo;s own code, not copied from a table, ' +
    'so they cannot be replayed from addresses; it stays on the hardware list. Only these two program versions were run, so the two other ' +
    'SGB1 versions keep the default border.</p>' +
    '<p class="hw-readable"><b>Fan art, when there is no firmware.</b> The border is chosen automatically, with no setting: ' +
    'the game&rsquo;s own border; else the Super Game Boy&rsquo;s default border when its firmware is loaded; else the ' +
    'game&rsquo;s fan art, a 16:9 picture made for the game (1920 by 1080), which fills the play window behind the ' +
    'Game Boy screen while the screen keeps its Super Game Boy colours; plain black only when there is neither firmware nor fan art. When the ' +
    'game sends its own border, its border replaces the fan art.</p>' +
    '<p class="hw-readable"><b>Tiles, drawer, clips and readings.</b> On the wall a Super Game Boy title looks exactly like its Game Boy or ' +
    'Color tile. Its drawer shows a photograph of a television with a Super NES, the Super Game Boy and controllers, and on the television ' +
    'the game&rsquo;s clip: the play window&rsquo;s own picture from power-on in this mode, for 120 seconds with no input (recorded by loading ' +
    'this core module as the play window does). The compatibility list reads the same clips: a ' +
    'Game Boy screen that moves or holds a picture after the first 10 seconds plays, a flat screen boots, no clip is nothing; ' +
    'a Color-only cartridge keeps its Game Boy Color reading. A version of a game held only on the Super Game Boy shelf (a fan translation ' +
    'or a patched copy) is a version of its game, like translations on every shelf: one tile, listed under its game. On the home page&rsquo;s Game Boy card each ' +
    'game is counted once: a Super Game Boy game that is also on the Game Boy or Color shelf, or whose versions are, is counted there, and only the games held on ' +
    'the Super Game Boy shelf alone add to the totals; the card&rsquo;s &ldquo;By kind of game&rdquo; table shows the whole shelf in its ' +
    'own Super Game Boy section.</p>' +

    '<h4 class="gbemu-sub">A.6: The Super Game Boy packet protocol</h4>' +
    '<p class="hw-readable">The whole protocol is one register: <code>FF00</code>, bits 4 and 5, the two lines the pad matrix already uses. There is no new port and no serial involvement.</p>' +
    '<div class="gbemu-rule" id="gbr-A-6-1"><b>Rule A.6/1.</b> The Game Boy inside a Super Game Boy is an original machine. Carry the Super Game Boy as its own flag, absent by default; it must not be a third value of a &ldquo;which machine&rdquo; setting.</div>' +
    '<div class="gbemu-why"><b>Why.</b> Dozens of sites read a &ldquo;which machine&rdquo; axis meaning <em>is this a Colour</em>, and a third value satisfies all of them and silently puts the Super Game Boy on the Colour picture paths. <b>MECHANISM</b>, and the payoff is that attaching the peripheral changes no existing line.</div>' +
    '<div class="gbemu-rule" id="gbr-A-6-2"><b>Rule A.6/2.</b> The gate. Super Game Boy functions are unlocked only when the cartridge header has both <code>$0146&nbsp;==&nbsp;$03</code> <b>and</b> <code>$014B&nbsp;==&nbsp;$33</code>. While either does not hold, every command is ignored.</div>' +
    '<div class="gbemu-why"><b>Why.</b> Nothing responds without it: a test cartridge that does not set both bytes cannot win any of these rows, whatever the receiver does.</div>' +
    '<div class="gbemu-rule" id="gbr-A-6-3"><b>Rule A.6/3.</b> The packet receiver. On every processor write to <code>FF00</code>, mask the written byte with <code>$30</code>; call it v, and call the masked value of the previous write p. Then, in this order of tests (the first that applies decides):' +
      '<table class="gbemu-table"><thead><tr><th>Receiver state before the write</th><th>v</th><th>p</th><th>Result</th></tr></thead><tbody>' +
        '<tr><td>any</td><td><code>$00</code> (both lines low)</td><td>any</td><td><b>Reset and arm</b>: clear the 16-byte buffer and the bit count; state becomes armed. This applies in every state, mid-packet included.</td></tr>' +
        '<tr><td>armed</td><td><code>$30</code> (both lines high)</td><td>any</td><td>state becomes receiving</td></tr>' +
        '<tr><td>armed</td><td>anything but <code>$00</code> and <code>$30</code></td><td>any</td><td>the packet aborts; state becomes idle</td></tr>' +
        '<tr><td>receiving</td><td><code>$30</code></td><td><code>$10</code> (P15 was low)</td><td>latch a <b>1</b> bit</td></tr>' +
        '<tr><td>receiving</td><td><code>$30</code></td><td><code>$20</code> (P14 was low)</td><td>latch a <b>0</b> bit</td></tr>' +
        '<tr><td>receiving</td><td>any other case</td><td>any</td><td>nothing</td></tr>' +
        '<tr><td>idle</td><td>anything but <code>$00</code></td><td>any</td><td>nothing</td></tr>' +
      '</tbody></table>' +
      'A bit is latched on the release to both-high, not on the drive. Within one bit period the last line driven low before the release decides the bit (that is what p records).</div>' +
    '<div class="gbemu-example"><b>Example.</b> Writes of <code>$00, $30, $20, $30, $10, $30</code> (after masking) give: reset and arm, receiving, nothing, a 0 bit, nothing, a 1 bit. Writes of <code>$00, $30, $10, $20, $30</code> give a single <b>0</b> bit: both lines were driven low in that bit period and P14 was driven low last.</div>' +
    '<div class="gbemu-rule" id="gbr-A-6-4"><b>Rule A.6/4.</b> A packet is 128 data bits, stored least-significant bit first within each byte, giving 16 bytes. The command applies on the write that latches the 128th data bit. A stop bit follows; its value is never inspected. After the 128th data bit the receiver is idle: it takes no further bits until the next reset (a write of <code>$00</code>, then <code>$30</code>). Each packet of a multi-packet command therefore arrives after its own reset, and the host joins the packets in arrival order.</div>' +
    '<div class="gbemu-rule" id="gbr-A-6-5"><b>Rule A.6/5.</b> Packet byte 0 holds the command code in bits 7 to 3 and the packet count in bits 2 to 0; a command is 1 to 7 packets. The one command the board scores is <code>$11</code>, multi-player request (MLT_REQ); its byte 1 holds a mode. The mode byte&rsquo;s low two bits, taken directly, are the new AND mask on the player index (mask = mode &amp; 3).</div>' +
    '<div class="gbemu-why"><b>Why.</b> <b>MECHANISM, with zero free parameters:</b> the documented rule is <em>mask = players &minus; 1</em>, and for the three documented modes 0, 1 and 3 the mode <em>is</em> players &minus; 1 identically, so using the byte reproduces the documented rule and extends to the undocumented mode 2 without a choice. <b>The rival reading (mode 2 means four players, mask 3) is refuted, not merely unchosen: it peaks at 18 of 24 cells.</b> Appendix G.2 puts a cpp row out of reach without <em>&ldquo;genuinely implementing the Super Game Boy packet protocol&rdquo;</em>, and the staged build order costs it at three rows.</div>' +
    '<div class="gbemu-rule" id="gbr-A-6-6"><b>Rule A.6/6.</b> The player index advances by one, then is ANDed with the current mask, on every write to <code>FF00</code> that takes P15 (bit 5) from low to high. The index and the receiver of Rule A.6/3 are separate state machines, each updated on every write; one write can reset the receiver and advance the index.</div>' +
    '<div class="gbemu-why"><b>Why.</b> Both scoring cartridges read the pad id with a <code>$00&nbsp;&rarr;&nbsp;$30</code> pulse, which is <em>simultaneously</em> a receiver reset and a counter advance; <b>model them as one state machine with two exits and the reads stop working.</b> <b>MECHANISM</b>: the rising-edge advance, taken <em>from the stated rule</em> and not from the score. <b>The corpus does not discriminate the polarity:</b> every pulse in all three cartridges is edge-balanced, so a falling-edge model scores the same 59 of 59. State that rather than letting a clean score imply a measurement.</div>' +
    '<div class="gbemu-rule" id="gbr-A-6-7"><b>Rule A.6/7.</b> Reading <code>FF00</code> with a Super Game Boy attached:' +
      '<table class="gbemu-table"><thead><tr><th>Groups selected (bits 5 and 4 of <code>FF00</code>)</th><th>Low nibble returns</th></tr></thead><tbody>' +
        '<tr><td>neither (<code>$30</code>)</td><td>the <b>pad id</b>: <code>$F</code> minus the player index, so <code>$F</code>, <code>$E</code>, <code>$D</code>, <code>$C</code> for players 1 to 4. With the one-player mask (0) the index is always 0, so this reads <code>$F</code>, the original&rsquo;s answer.</td></tr>' +
        '<tr><td>one or both</td><td>the selected lines of the player the index names: player 1&rsquo;s buttons for index 0; for index 1 to 3, the buttons of players 2 to 4, which the host supplies as three more pads. With no such pad attached, every line of that player reads 1 (released).</td></tr>' +
      '</tbody></table>' +
      'Read from our source.</div>' +
    '<div class="gbemu-rule" id="gbr-A-6-8"><b>Rule A.6/8.</b> The extra advance. On the write that latches the 128th data bit of a multi-player request packet from an unlocked cartridge, after that same write&rsquo;s own index step of Rule A.6/6, do in this order:' +
      '<ol class="gbemu-steps">' +
        '<li>If the new mode&rsquo;s bit 0 is clear, add 1 to the index (a plain +1, masked by nothing).</li>' +
        '<li>Store the new mask, mode &amp; 3.</li>' +
        '<li>AND the index with the new mask.</li>' +
      '</ol>' +
      'So when the extra advance applies, the index ends at (index + 1) AND new mask, whatever the old mask was. Read from our source (the packet receiver).</div>' +
    '<div class="gbemu-example"><b>Example.</b> The index is 1 and the mask is 3. A multi-player request with mode 2 arrives; the write that latches its 128th bit has p = <code>$20</code>, so it is not a P15 edge and Rule A.6/6 does not advance the index. Mode 2&rsquo;s bit 0 is clear, so step 1 makes the index 2; step 2 stores mask 2; step 3 gives 2 AND 2 = 2. Had p been <code>$10</code>, that write would first have advanced the index under the old mask (1 + 1 = 2, AND 3 = 2), and step 1 would then make it 3, and step 3 gives 3 AND 2 = 2.</div>' +
    '<div class="gbemu-why"><b>Why, and how strong.</b> The AND mask is <b>MECHANISM</b> (Rule A.6/5). The extra advance is <b>CONVERGENCE</b>: no stated rule produces it; it is matched to the suite&rsquo;s own declared results table, and it is <b>unobservable for mode 0</b>, where the mask is 0, so <em>&ldquo;extra when bit 0 is clear&rdquo;</em> and <em>&ldquo;extra for mode 2 only&rdquo;</em> are <b>the same machine on every program that can be written</b>. That collapses two candidates to one and <b>does not make either derived.</b> <b>What would establish it:</b> a stated rule, or a cartridge that separates the two, and by the argument above no such cartridge can exist, which is itself the finding. The other two rows carry no fitted bit. A cpp sub-test exists for the armed-then-abort case of Rule A.6/3 and nothing else; two cpp sub-tests drive both lines low in each order to pin the last-line-wins rule; a cpp sub-test corrupts the stop bit deliberately and expects the command to have taken effect anyway.</div>' +
    '<div class="gbemu-why"><b>What this appendix does not pin.</b> Everything the peripheral does <em>with</em> a packet once it has one (borders, palettes, the sound chip, the character transfers) is outside <em>the core</em>. <b>Nothing on this 264-row board scores any of that</b>, so the core does not build it and does not claim it. That is not the same as the site not doing it: the core hands every complete packet from an unlocked cartridge to the host page, in arrival order, and the site&rsquo;s player (outside the core, in the page) does what the Super NES did with them, which is A.1.3&rsquo;s Super Game Boy row (palettes, cell colours, borders, the screen mask). So A.1.3 describes the site and this appendix describes the core; a clean build of the core needs only what is here. The three rows here are won by the transport, the header gate, the multi-player mask and the pad id, and by nothing else.</div>' +
  '</section>' +
  '</div>';
}
