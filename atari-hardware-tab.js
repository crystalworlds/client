/* ===========================================================================
 * Atari hardware reference: the data behind the Hardware tab of every Atari
 * 2600, 5200, 7800 and Lynx cartridge. atariHardwareTabHTML() in index.html
 * calls atariHardwareReferenceHTML(sys) and wraps it with the per-cartridge
 * and per-core sections it already had.
 *
 * Loaded by a plain <script src> tag (not fetch) so the site still opens from
 * disk over file://. Everything is a top-level declaration, so it is a window
 * global, the same pattern as the *-emulation-tab.js files.
 *
 * WRITING RULE (the Pokemon mini tab's rule, kept): every figure here comes
 * from a NAMED public source, and was checked against a second one where a
 * second one exists. Where only one source states a thing, or where sources
 * disagree, the text says so instead of picking one quietly. Short keys in
 * the comments: [SPG] Stella Programmer's Guide, [NC] nocash 2600 specs,
 * [KH] Kevin Horton's bankswitch_sizes.txt, [WP] Wikipedia, [7SG] the 7800
 * Software Guide (GCC/Atari, community-updated), [7BS] 7800 bankswitching
 * guide, [AN] A.N.A.L.O.G. #15 5200 tech notes, [EPX] the Epyx/Atari Lynx
 * developer documentation, [AA] AtariAge archives and forums.
 *
 * Site wording rules: plain English, British/Australian spelling, no long
 * em dash in any text (en dash only in number ranges), no emulator names.
 * Researched and written 2026-10-10.
 *
 * OPEN FINDING (2026-10-10, atarihw): ATARI_SYSTEMS.atarilynx.cpu in
 * index.html reads "65SC02 at 16 MHz". 16 MHz is the Lynx's crystal, not
 * its CPU rate; the CPU takes 4 ticks (4 MHz) for a page-mode RAM read and
 * 5 or more otherwise [EPX ch.2/4, WP "up to 4 MHz, 3.6 average"]. That row
 * still shows under "The emulator" on the Lynx Hardware tab. Left untouched
 * because the field is described as the core's published figure; falsifier:
 * the core's own CPU_HZ, if it states the CPU rate rather than the crystal.
 * ======================================================================== */

/* Small renderers shared by all four machines. hwSectH() is defined in
   index.html; it is only called at render time, long after both scripts ran. */
function _ahwTable(head, rows) {
  const th = head.map(h => `<th>${h}</th>`).join('');
  const tr = rows.map(r => `<tr>${r.map(c => `<td>${c}</td>`).join('')}</tr>`).join('');
  return `<div class="hw-table-wrap hw-table-scroll"><table class="hw-table"><thead><tr>${th}</tr></thead><tbody>${tr}</tbody></table></div>`;
}
const _m = s => `<span class="hw-mono-inline">${s}</span>`;
function _ahwFacts(rows) {
  return `<div class="factbox factbox-stacked">${rows.map(r => `<div class="row"><span class="k">${r[0]}</span><span class="v">${r[1]}</span></div>`).join('')}</div>`;
}

/* ---------------------------------------------------------------------------
 * ATARI 2600
 * ------------------------------------------------------------------------- */
const ATARI_HW_2600 = {
  title: 'Atari 2600 (Video Computer System)',
  tag: 'MOS 6507 CPU, TIA video and sound chip, 6532 RIOT for RAM, I/O and timer &middot; 1977',
  specs: [
    ['CPU', 'MOS 6507 (a 6502 in a 28-pin package) at 1.193182 MHz NTSC, 1.182298 MHz PAL'],
    ['RAM', '128 bytes, inside the 6532 RIOT'],
    ['Video', 'TIA: no frame buffer; a 40-pixel playfield, 2 players, 2 missiles and a ball, all rebuilt every scanline'],
    ['Resolution', '160 colour clocks wide; 192 visible lines is the NTSC convention, not a hardware limit'],
    ['Colours', '128 NTSC, 104 PAL, 8 SECAM'],
    ['Sound', '2 channels, each with 16 waveform settings, a 5-bit frequency divider and 4-bit volume'],
    ['Cartridge window', '4 KB; larger games bank-switch (up to 32 KB in Atari&rsquo;s own scheme, more in others)'],
    ['BIOS', 'None. The cartridge is the only program the machine has'],
    ['Controller ports', '2 &times; 9-pin; joystick, paddles, driving controller, keypad'],
    ['Console switches', 'Power, TV type (colour/B&amp;W), two difficulty switches, Game Select, Game Reset'],
  ],
  sections: [
    { h: 'The machine', html: `
      <p class="hw-readable">The 2600 began as <b>Stella</b>, a project at Atari&rsquo;s Cyan Engineering subsidiary, and launched in September 1977 at <b>US$199</b> as the <b>Atari Video Computer System (VCS)</b>. It was renamed the 2600 (after its part number, CX2600) in November 1982, when the 5200 arrived alongside it. It stayed in production until 1992, selling roughly <b>30 million</b> units, which makes it one of the longest-lived consoles ever made.</p>
      <p class="hw-readable">The design is famous for how little it has. Memory was the expensive part in 1977, so the machine has <b>128 bytes of RAM</b> and <b>no video memory at all</b>. The graphics chip, the TIA (Television Interface Adaptor, designed by Jay Miner with Joe Decuir), holds exactly one scanline&rsquo;s worth of picture in its registers. To draw a screen, the program has to rewrite those registers in time with the television&rsquo;s electron beam, line after line, sixty times a second. Programmers call this <b>racing the beam</b>, and it is why every 2600 game is really a hand-timed piece of real-time code.</p>` },

    { h: 'Models and revisions', html: `
      <p class="hw-readable">The electronics barely changed in fifteen years; the shell changed several times. Collectors name the models by their switches and weight.</p>
      ${_ahwTable(['Model', 'Year', 'What is different'], [
        ['CX2600 &ldquo;Heavy Sixer&rdquo;', '1977', 'Six front switches, thick moulded shell, the first production run'],
        ['CX2600 &ldquo;Light Sixer&rdquo;', '1978', 'Same six switches, thinner and lighter shell once production moved overseas'],
        ['CX2600-A &ldquo;Four-switch&rdquo;', '1980', 'Difficulty switches moved to the back; four switches left on the front'],
        ['CX2600-A &ldquo;Darth Vader&rdquo;', '1982', 'All-black four-switch shell with no woodgrain'],
        ['2600 Jr.', '1986', 'Small cost-reduced redesign under the Tramiel management, sold for under US$50'],
        ['Sears Tele-Games Video Arcade', '1977 on', 'Sears-branded version of the same hardware, with a few Sears-only titles'],
      ])}
      <p class="hw-readable" style="margin-top:10px">Inside, the models share the same three chips and the same cartridge slot, so the library runs across all of them.</p>` },

    { h: 'Regions: NTSC, PAL and SECAM', html: `
      <p class="hw-readable">The 2600 was built in three television standards, and a cartridge is written for one of them. The TIA&rsquo;s clock is the TV colour carrier, so the CPU speed, the line timing and the colour palette all follow the region.</p>
      ${_ahwTable(['', 'NTSC', 'PAL', 'SECAM'], [
        ['Colour clock', '3.579545 MHz', '3.546894 MHz', 'as PAL'],
        ['CPU clock (colour clock &divide; 3)', '1.193182 MHz', '1.182298 MHz', 'as PAL'],
        ['Lines per frame', '262', '312', '312'],
        ['Frame rate', '60 Hz', '50 Hz', '50 Hz'],
        ['Palette', '128 colours (16 hues &times; 8 brightness)', '104 colours', '8 colours'],
      ])}
      <p class="hw-readable" style="margin-top:10px">The French SECAM console has only eight colours because SECAM cannot be driven the same way; the colour/B&amp;W switch has no effect on it. An NTSC game on a PAL console therefore runs slower, rolls or shows the wrong colours, which is why many games had separate PAL releases with retuned timing and colour values.</p>` },

    { h: 'The processor', html: `
      <p class="hw-readable">The CPU is a <b>MOS 6507</b>: a full 6502 core in a cheaper 28-pin package. Atari chose it on price (the 6507 and RIOT were negotiated at about US$12 a pair). Two things were lost to the smaller package. Only <b>13 address lines</b> are brought out, so the machine sees just <b>8 KB</b> of address space, and the interrupt pins are gone, so the 2600 has <b>no interrupts at all</b>. Every piece of timing is done by counting cycles or by polling the RIOT timer.</p>
      <p class="hw-readable">The CPU runs at the colour clock divided by three. One CPU cycle is three pixels, and one scanline is exactly <b>76 CPU cycles</b>. The TIA register <span class="hw-mono-inline">WSYNC</span> is the programmer&rsquo;s lifeline: writing to it stops the CPU until the start of the next line, so a kernel can resynchronise to the beam every line.</p>` },

    { h: 'Memory map', html: `
      <p class="hw-readable">With 13 address lines the whole map repeats every 8 KB, and inside it the chips are only partly decoded, so each one also appears at several mirror addresses. The canonical locations are:</p>
      ${_ahwTable(['Range', 'Size', 'Contents'], [
        [_m('$0000–$002C'), 'write', 'TIA registers (video, sound, object positions)'],
        [_m('$0000–$000D'), 'read', 'TIA read registers (15 collision latches, paddle and button inputs)'],
        [_m('$0080–$00FF'), '128 B', 'RAM in the RIOT; also the 6502 stack, which therefore shares zero page'],
        [_m('$0280–$0297'), '', 'RIOT ports (joysticks, console switches) and the interval timer'],
        [_m('$1000–$1FFF'), '4 KB', 'Cartridge memory (usually written as $F000–$FFFF, one of its mirrors)'],
      ])}
      <p class="hw-readable" style="margin-top:10px">Putting RAM and the TIA in zero page is deliberate: the 6502&rsquo;s short zero-page instructions save a cycle on every access, and in a 76-cycle line every cycle counts.</p>` },

    { h: 'The TIA: video', html: `
      <p class="hw-readable">A scanline is <b>228 colour clocks</b>: 68 of horizontal blank and <b>160</b> visible. The standard NTSC frame the Stella Programmer&rsquo;s Guide lays out is 3 lines of vertical sync, 37 of vertical blank, <b>192</b> of picture and 30 of overscan, 262 in all. PAL games use 312 lines. None of this is enforced by the hardware: the program generates vertical sync itself, so a game can draw more or fewer lines, and a game that gets it wrong makes the TV roll.</p>
      <p class="hw-readable">What the TIA draws on each line is built from six things:</p>
      ${_ahwTable(['Object', 'What it is'], [
        ['Playfield', '20 bits of low-resolution blocks (4 colour clocks each) for the left half; the right half repeats or mirrors them, giving 40 blocks across'],
        ['Player 0 and Player 1', '8-pixel-wide sprites, which can be stretched to double or quadruple width or copied two or three times across the line'],
        ['Missile 0 and Missile 1', '1-pixel lines in the matching player&rsquo;s colour, widths 1, 2, 4 or 8'],
        ['Ball', 'A 1-pixel line in the playfield colour, widths 1, 2, 4 or 8'],
      ])}
      <p class="hw-readable" style="margin-top:10px">Objects have no X coordinate register. A program positions them by writing a reset strobe at the exact moment the beam passes the desired spot, then nudging them up to 7 pixels left or 8 right with <span class="hw-mono-inline">HMOVE</span>. HMOVE has a visible side effect: it blanks the first 8 pixels of the line, which is the source of the short black &ldquo;comb&rdquo; marks at the left edge of many 2600 games. The TIA latches <b>15 collision pairs</b> between the objects in hardware, which is how most 2600 games detect hits without spending CPU time on it.</p>
      <div class="hw-caveat">The often-quoted &ldquo;160 &times; 192&rdquo; is a convention, not a mode. Horizontally 160 is fixed by the TIA; vertically the program decides, and most games change graphics only every second line to save time, so the effective vertical resolution is often lower.</div>` },

    { h: 'The TIA: sound', html: `
      <p class="hw-readable">The same chip makes the sound: <b>two channels</b>, each set by three registers. <span class="hw-mono-inline">AUDC</span> (4 bits) chooses the waveform from pure square tones, buzzy pulse patterns and noise built from 4-bit and 5-bit shift registers; several of the sixteen settings duplicate each other. <span class="hw-mono-inline">AUDF</span> (5 bits) divides a base rate of roughly 30 kHz by 1 to 32. <span class="hw-mono-inline">AUDV</span> (4 bits) sets the volume in 16 steps.</p>
      <p class="hw-readable">Because the frequency is a 5-bit divider applied to a waveform that is itself a divided pattern, the available pitches are sparse and most are out of tune with the Western scale. That is why 2600 music has its characteristic sour sound, and why composers picked keys around whichever notes the chip could actually play. The base rate is two ticks per scanline, about 31.4 kHz on NTSC.</p>` },

    { h: 'The RIOT: RAM, ports and the timer', html: `
      <p class="hw-readable">The MOS <b>6532 RIOT</b> (RAM, I/O, Timer) holds the 128 bytes of RAM, two 8-bit I/O ports and one interval timer. Port A reads the two joysticks (four direction bits each); port B reads the console switches. The timer counts down once every 1, 8, 64 or 1024 CPU cycles, chosen by which register it is started through, and is how a game measures out the vertical blank and overscan periods while doing game logic.</p>
      ${_ahwTable(['Register', 'Counts every', 'One tick (NTSC)'], [
        [_m('TIM1T'), '1 cycle', '838 ns'],
        [_m('TIM8T'), '8 cycles', '6.7 &micro;s'],
        [_m('TIM64T'), '64 cycles', '53.6 &micro;s'],
        [_m('T1024T'), '1024 cycles', '858 &micro;s'],
      ])}` },

    { h: 'No BIOS, and what starts a game', html: `
      <p class="hw-readable">There is no boot firmware. At power-on the 6507 reads its reset vector from the top of the cartridge and runs the game directly, with RAM and the TIA in whatever state the silicon powered up in. Every game therefore starts by clearing memory and registers itself. It also means the console performs no checks of any kind: no logo, no region lock and no licence check, which is why so many third-party companies could publish for it.</p>` },

    { h: 'Cartridges and bank switching', html: `
      <p class="hw-readable">The cartridge slot exposes only a <b>4 KB</b> window. Games larger than that use <b>bank switching</b>: logic on the cartridge watches the address bus and swaps which part of the cartridge appears in the window. Unlike later consoles there was no standard. Each publisher invented its own scheme, and a cartridge file carries no header to say which one it uses, so tools identify the scheme from the file&rsquo;s size and contents. The main ones:</p>
      ${_ahwTable(['Scheme', 'Size', 'How banks change', 'Examples'], [
        ['None', '2 KB / 4 KB', 'No switching', 'Combat, Adventure, most early games'],
        ['F8 (Atari)', '8 KB', 'Touching $1FF8 or $1FF9 selects one of two 4 KB banks', 'Asteroids, Pac-Man'],
        ['F6 (Atari)', '16 KB', '$1FF6–$1FF9, four 4 KB banks', 'Dig Dug, Crystal Castles'],
        ['F4 (Atari)', '32 KB', '$1FF4–$1FFB, eight 4 KB banks', 'Fatal Run'],
        ['Super Chip (F8SC, F6SC, F4SC)', '+128 B RAM', 'Adds 128 bytes of RAM: written at $1000–$107F, read at $1080–$10FF', 'Dig Dug, Crystal Castles'],
        ['FA (CBS RAM Plus)', '12 KB +256 B', '$1FF8–$1FFA, three 4 KB banks, 256 bytes of RAM', 'Omega Race, Tunnel Runner, Mountain King'],
        ['E0 (Parker Brothers)', '8 KB', 'Four 1 KB slices; three are switchable, the top one is fixed', 'Gyruss, Popeye, James Bond 007'],
        ['E7 (M Network)', '16 KB +2 KB', 'Eight 2 KB banks plus 2 KB of RAM', 'BurgerTime, Bump &rsquo;n&rsquo; Jump'],
        ['3F (Tigervision)', '8 KB+', 'A write to $00–$3F (normally TIA space) selects a 2 KB bank', 'Miner 2049er, Espial, Polaris'],
        ['FE (Activision)', '8 KB', 'Watches the stack during subroutine calls and returns', 'Decathlon, Robot Tank'],
        ['DPC (Activision)', '10 KB', 'Display Processor Chip: banking plus data fetchers, a random number generator and three-voice music', 'Pitfall II only'],
        ['AR (Starpath Supercharger)', '6 KB RAM', 'Game loaded from cassette into RAM', 'Dragonstomper, Escape from the Mindmaster'],
        ['F0 (Dynacom Megaboy)', '64 KB', 'Each access to $1FF0 advances to the next of sixteen 4 KB banks', 'Megaboy'],
      ])}
      <p class="hw-readable" style="margin-top:10px">Two schemes deserve a note. The <b>3F</b> trick works because writes to $00–$3F also go to the TIA, which ignores the ones it does not use, so the cartridge can listen to them for free. And Pitfall II&rsquo;s <b>DPC</b> was effectively a co-processor on the cartridge; its three-voice music is something the TIA alone cannot do. The modern homebrew scene has gone much further, with cartridges that carry a 32-bit ARM processor (the Harmony and Melody boards and their DPC+ and CDF schemes), so &ldquo;what a 2600 can do&rdquo; now depends heavily on what is in the cartridge.</p>` },

    { h: 'Controllers and peripherals', html: `
      <p class="hw-readable">The two 9-pin ports were wired generally enough that Atari and others built many devices for them, and the same connector became a de facto standard on other computers.</p>
      ${_ahwTable(['Device', 'How it is read'], [
        ['CX40 Joystick', 'Four switches on RIOT port A, fire button on a TIA input'],
        ['CX30 Paddles', 'Two per port. Each knob is a 1 M&Omega; potentiometer; the game discharges a capacitor and counts scanlines until it recharges'],
        ['CX20 Driving Controller', 'Looks like a paddle but is a rotary switch with a 2-bit Gray code, so it turns endlessly (Indy 500)'],
        ['CX50 Keyboard Controller', '12-key pad (4 rows &times; 3 columns), scanned by driving the rows from port A'],
        ['Video Touch Pad, Kid&rsquo;s Controller', 'Variants of the keypad for Star Raiders and the Sesame Street titles'],
        ['CX22 / CX80 Trak-Ball', 'Can emulate a joystick, or report movement directly in trackball mode'],
        ['XG-1 light gun', 'Sold with the XE Game System; trigger on port A, light sensor on a TIA input'],
        ['Starpath Supercharger', 'A long cartridge with 6 KB of RAM and a cable to a cassette player; games load from tape, some in several stages'],
      ])}
      <p class="hw-readable" style="margin-top:10px">The <b>Supercharger</b> (1982, US$69.95 with Phaser Patrol) multiplied the console&rsquo;s RAM by roughly fifty and let Starpath ship larger, more detailed games on ordinary audio cassettes. It is incompatible with most 7800 consoles.</p>` },
  ],
  sources: [
    '<b>Stella Programmer&rsquo;s Guide</b>, Steve Wright, Atari, 1979; HTML transcription at <a href="https://alienbill.com/2600/101/docs/stella.html" target="_blank" rel="noopener">alienbill.com</a>. Primary source for the scanline and frame structure, the TIA objects, collisions, the sound registers, the RIOT timer and the console switch bits.',
    '<b>nocash Atari 2600 specifications</b>, Martin Korth (<a href="https://problemkaputt.de/2k6specs.htm" target="_blank" rel="noopener">problemkaputt.de/2k6specs.htm</a>). Second source for the clocks, the regional palettes and line counts, the memory map and mirroring, the timer intervals, the bank-switching schemes and the controller wiring.',
    '<b>Cart sizes and bankswitching methods</b>, Kevin Horton (<a href="https://atariage.com/2600/programming/bankswitch_sizes.txt" target="_blank" rel="noopener">atariage.com</a>). Hotspot addresses, extra RAM and example games for each scheme; agrees with the nocash list on every scheme both describe.',
    '<b>Wikipedia</b>, &ldquo;Atari 2600&rdquo; and &ldquo;Atari 2600 hardware&rdquo;. History, models and years, sales, the 6507 package and the colour counts (the colour counts agree with the nocash specifications).',
    '<b>Wikipedia</b>, &ldquo;Starpath Supercharger&rdquo;, with the AR entry in Horton&rsquo;s list above, for the Supercharger.',
    '<b>AtariAge</b> (<a href="https://atariage.com/" target="_blank" rel="noopener">atariage.com</a>): the 2600 archives, rarity guide and programming forums, used to cross-check model names and the homebrew cartridge formats.',
  ],
};

/* ---------------------------------------------------------------------------
 * ATARI 5200
 * ------------------------------------------------------------------------- */
const ATARI_HW_5200 = {
  title: 'Atari 5200 SuperSystem',
  tag: '6502C &ldquo;SALLY&rdquo; CPU, ANTIC display processor, GTIA colour chip, POKEY sound and input chip &middot; 1982',
  specs: [
    ['CPU', '6502C (Atari&rsquo;s &ldquo;SALLY&rdquo;) at 1.79 MHz (colour clock &divide; 2)'],
    ['RAM', '16 KB'],
    ['BIOS', '2 KB: start-up program and the character set'],
    ['Video', 'ANTIC (display lists, DMA, 14 modes) and GTIA (colour, 4 players and 4 missiles)'],
    ['Colours', '256 (16 hues &times; 16 brightness), up to 16 on screen in GTIA modes, more with per-line changes'],
    ['Sound', 'POKEY: 4 channels, pairable into 2 channels of 16-bit pitch'],
    ['Cartridge', '32 KB window at $4000–$BFFF; a few later games bank-switch beyond it'],
    ['Controllers', 'Analog (non-centring) joystick, 12-key keypad, Start, Pause, Reset, two fire buttons each side'],
    ['Regions', 'North America only (NTSC); no PAL model was released'],
  ],
  sections: [
    { h: 'The machine', html: `
      <p class="hw-readable">The 5200 is, inside, an <b>Atari 400 home computer without the keyboard</b>. It uses the same custom chipset (ANTIC, GTIA and POKEY) and the same CPU family, with the memory map rearranged and a new, much smaller operating system. It launched in North America in <b>October 1982 at US$299.95</b>, widely available from January 1983, as Atari&rsquo;s answer to the Intellivision and, almost immediately, to the ColecoVision. It was discontinued on <b>21 May 1984</b> after selling a little over a million units, caught by the 1983 market crash and by its own controllers.</p>
      <p class="hw-readable">Because the hardware is so close to the computers, developers could write and debug most of a 5200 game on an Atari 400 or 800. But the two are deliberately <b>not software-compatible</b>: the chips sit at different addresses and the 2 KB start-up firmware replaces the computers&rsquo; 10 KB operating system.</p>` },

    { h: 'Models: four-port and two-port', html: `
      ${_ahwTable(['Model', 'Year', 'What is different'], [
        ['Four-port', '1982', 'Four controller ports. Power is fed through the TV switchbox: one cable carries both power and video, and the switchbox changes the TV over automatically.'],
        ['Two-port', '1983', 'Two controller ports, a conventional separate power supply and RF switch, and a revised cartridge port so the VCS Cartridge Adapter (2600 adapter) fits'],
      ])}
      <p class="hw-readable" style="margin-top:10px">The four-port switchbox was elegant but fragile, and the extra two ports were little used, so the revision simplified both. The 2600 adapter (CX55, summer 1983) plugs into the cartridge slot and carries its own 2600 chipset; it does not use the 5200&rsquo;s chips. Four-port consoles need a modification to accept it.</p>` },

    { h: 'The processor', html: `
      <p class="hw-readable">The CPU is Atari&rsquo;s <b>6502C</b>, known inside Atari as <b>SALLY</b>: a 6502 with an extra <b>HALT</b> input. ANTIC uses that pin to stop the CPU for a cycle whenever it needs the bus to fetch screen data. This is the defining performance fact of the Atari 8-bit family: the 1.79 MHz headline speed is what the CPU gets on lines ANTIC leaves alone, and on a busy text or bitmap line ANTIC takes a large share of the 114 cycles available.</p>` },

    { h: 'Memory map', html: `
      ${_ahwTable(['Range', 'Size', 'Contents'], [
        [_m('$0000–$3FFF'), '16 KB', 'RAM. The BIOS reserves the start of page 0 and $0200–$021B for shadow registers and interrupt vectors; page 1 is the stack'],
        [_m('$4000–$BFFF'), '32 KB', 'Cartridge'],
        [_m('$C000–$C0FF'), '', 'GTIA registers (page $D0 on the computers)'],
        [_m('$D400–$D4FF'), '', 'ANTIC registers (the same page as on the computers)'],
        [_m('$E800–$E8FF'), '', 'POKEY registers (page $D2 on the computers)'],
        [_m('$F800–$FFFF'), '2 KB', 'BIOS: character set and start-up program'],
      ])}
      <p class="hw-readable" style="margin-top:10px">The chips are only partly decoded, so each register block also appears at mirror addresses within its area. The relocation of GTIA and POKEY is most of what separates a 5200 program from an Atari 400/800 one.</p>` },

    { h: 'ANTIC and GTIA: video', html: `
      <p class="hw-readable">Video is split between two chips. <b>ANTIC</b> is a small processor in its own right: it runs a <b>display list</b>, a program in RAM that says, line by line, which of its <b>14 modes</b> to use (6 text modes and 8 bitmap modes) and where in memory the data lives. Display lists can mix modes down the screen, point each line at a different address, and request fine horizontal and vertical scrolling. A flag on any line triggers a <b>display list interrupt</b>, which lets the program change colours or settings partway down the screen; this is how Atari games show far more colours than any single mode allows.</p>
      <p class="hw-readable"><b>GTIA</b> turns ANTIC&rsquo;s output into colour and adds the sprites, which Atari calls <b>player-missile graphics</b>: <b>four players</b> 8 pixels wide and <b>four missiles</b> 2 pixels wide (which can be combined into a fifth player), each a vertical strip the full height of the screen, with selectable widths, priorities and pixel-perfect collision detection. GTIA&rsquo;s palette is <b>256 colours</b>, 16 hues at 16 brightness levels, and it adds three special modes (16 shades of one hue, 9 colours, or 16 hues) beyond what ANTIC supplies.</p>
      ${_ahwFacts([
        ['Line', '228 colour clocks, 114 CPU cycles'],
        ['Frame', '262 lines, about 60 Hz (NTSC)'],
        ['Playfield widths', 'Narrow, normal or wide, selected in ANTIC'],
        ['Interrupts', 'Display list interrupt (NMI) and vertical blank interrupt (NMI) from ANTIC; POKEY raises the IRQs'],
      ])}` },

    { h: 'POKEY: sound, controllers and more', html: `
      <p class="hw-readable"><b>POKEY</b> (Pot Keyboard Integrated Circuit, designed by Doug Neubauer) does far more than sound. Its <b>four audio channels</b> each have an 8-bit frequency divider, a volume control and a choice of distortions built from 4-, 5-, 9- and 17-bit polynomial counters; pairs of channels can be joined into 16-bit dividers for accurate pitch, and two high-pass filters give extra timbres. The same chip provides <b>eight potentiometer inputs</b>, a <b>keyboard scanner</b>, a serial port, timers and a hardware random-number register.</p>
      <p class="hw-readable">On the 5200 those inputs are the controllers. Each analog joystick is two potentiometers read by POKEY&rsquo;s pot inputs (horizontal on POT0, 2, 4 and 6; vertical on POT1, 3, 5 and 7). The keypads are read through POKEY&rsquo;s keyboard scanner, with two bits of GTIA&rsquo;s console register selecting which controller port is being scanned. The lower fire buttons arrive on GTIA&rsquo;s trigger inputs, one per port.</p>` },

    { h: 'The BIOS and the title screen', html: `
      <p class="hw-readable">The 2 KB BIOS does what the 2600 never had: it initialises the hardware, installs default interrupt handlers and shadow registers (copies of chip registers in RAM that it writes back every vertical blank), and shows the familiar title screen. That screen reads the game&rsquo;s name from the cartridge (<b>20 characters at $BFE8</b>) and its copyright year from the two bytes after, shows them with the Atari logo, and after a few seconds jumps to the game through the start address at <b>$BFFE</b>.</p>
      <p class="hw-readable">One documented escape hatch: if the year&rsquo;s second byte at <b>$BFFD</b> is <span class="hw-mono-inline">$FF</span>, the BIOS treats the cartridge as a <b>diagnostic cartridge</b> and jumps to it at once, skipping the title screen. There is no signature or licence check; any correctly laid-out cartridge will run.</p>` },

    { h: 'Cartridges', html: `
      <p class="hw-readable">The slot maps up to <b>32 KB</b> directly, which covers nearly the whole official library (most games are 8, 16 or 32 KB). A few cartridges bank-switch beyond that, and some 16 KB games are wired so the same 16 KB appears twice in the window. Like the 2600&rsquo;s, a 5200 cartridge image has no header, so tools tell these layouts apart by size and by known checksums.</p>` },

    { h: 'Controllers and peripherals', html: `
      <p class="hw-readable">The standard controller is ambitious: an <b>analog, non-centring joystick</b> (it stays where you leave it), a <b>12-key keypad</b> with slots for game-specific overlay cards, <b>Start, Pause and Reset</b>, and <b>two fire buttons on each side</b>. In practice it is the machine&rsquo;s best-known weakness. The stick&rsquo;s flexible circuit and rubber boot wore out quickly, and an analog stick that does not spring back made many arcade conversions hard to control.</p>
      ${_ahwTable(['Accessory', 'Notes'], [
        ['CX53 Trak-Ball', 'Pro-Line trackball with its own keypad; suited to Centipede and Missile Command'],
        ['CX55 VCS Cartridge Adapter', 'Plays 2600 cartridges using its own 2600 chipset; two-port model, or a modified four-port'],
      ])}` },
  ],
  sources: [
    '<b>&ldquo;5200 tech notes&rdquo;</b>, A.N.A.L.O.G. Computing #15 (January 1984), transcribed at <a href="https://atarimuseum.ctrl-alt-rees.com/videogames/consoles/5200/conv_to_5200.html" target="_blank" rel="noopener">atarimuseum.ctrl-alt-rees.com</a> and <a href="https://mail.retroisle.com/atari/5200/Technical/Firmware/technotes.php" target="_blank" rel="noopener">retroisle.com</a>. Primary source for the memory map, the chip relocations, the BIOS start-up sequence, the cartridge header and the controller wiring.',
    '<b>cc65 Atari 5200 target documentation</b> (<a href="https://cc65.github.io/doc/atari5200.html" target="_blank" rel="noopener">cc65.github.io</a>). Second source for the cartridge name (20 bytes) and year fields, and for the $FF diagnostic-cartridge rule.',
    '<b>Wikipedia</b>, &ldquo;Atari 5200&rdquo;. Launch and discontinuation dates, price, sales, the four-port and two-port differences and the accessory list.',
    '<b>Wikipedia</b>, &ldquo;ANTIC&rdquo;, &ldquo;CTIA and GTIA&rdquo; and &ldquo;POKEY&rdquo;. The display modes, player-missile graphics, the 256-colour palette and POKEY&rsquo;s channels and inputs.',
    '<b>De Re Atari</b> (Atari, 1981), at <a href="https://www.atariarchives.org/dere/" target="_blank" rel="noopener">atariarchives.org</a>. The Atari 8-bit chipset reference the 5200 shares: display lists, DMA and the line timing.',
    '<b>AtariAge</b> 5200 archives and forums (<a href="https://atariage.com/" target="_blank" rel="noopener">atariage.com</a>), for cross-checking the models, the adapter and the cartridge layouts.',
  ],
};

/* ---------------------------------------------------------------------------
 * ATARI 7800
 * ------------------------------------------------------------------------- */
const ATARI_HW_7800 = {
  title: 'Atari 7800 ProSystem',
  tag: '6502C &ldquo;SALLY&rdquo; CPU, MARIA graphics chip, and a full 2600 chipset (TIA and RIOT) on board &middot; 1986',
  specs: [
    ['CPU', '6502C &ldquo;SALLY&rdquo; at 1.79 MHz (1.77 MHz PAL); slows to 1.19 MHz while touching the TIA or RIOT'],
    ['RAM', '4 KB (two 6116 2 KB chips) plus the RIOT&rsquo;s 128 bytes'],
    ['BIOS', '4 KB NTSC (logo and cartridge signature check); 16 KB PAL'],
    ['Video', 'MARIA: display-list sprite engine, 7.16 MHz, 160- and 320-pixel modes'],
    ['Colours', '256-colour palette; 8 palettes of 3 colours plus background, 25 per line'],
    ['Lines', '263 per frame NTSC, 313 PAL'],
    ['Sound', 'TIA (2 channels, as the 2600); some cartridges add a POKEY'],
    ['Cartridge', '48 KB window at $4000–$FFFF; larger games bank-switch'],
    ['2600 compatibility', 'Built in: the console contains a real TIA and RIOT'],
  ],
  sections: [
    { h: 'The machine', html: `
      <p class="hw-readable">The 7800 was designed for Atari by <b>General Computer Corporation (GCC)</b>, the Massachusetts arcade company behind Ms. Pac-Man and Food Fight, and announced in <b>May 1984</b> (at one point it was called the Atari 3600). Weeks later Jack Tramiel bought Atari&rsquo;s consumer division and the launch was shelved. It finally went on sale nationally in <b>May 1986 at US$79.95</b>, PAL versions followed from 1987, and it was discontinued in 1992. About 59 official 7800 games were released; its real library was the hundreds of 2600 games it also plays.</p>
      <p class="hw-readable">Its design is a deliberate bet: a modest CPU paired with <b>MARIA</b>, a graphics chip built to move a great many objects, which suited the arcade games of 1981–83 that GCC knew well. Against the NES and Master System of 1986 its weak spot was sound, because the main board carries only the 2600&rsquo;s TIA.</p>` },

    { h: 'Models and regions', html: `
      ${_ahwTable(['Version', 'What is different'], [
        ['NTSC, first production (1984 stock, sold from 1986)', 'Expansion port on the left side (intended for a laserdisc player and computer add-ons that never shipped)'],
        ['NTSC, later production (from about late 1987)', 'Expansion port removed; minor board changes that make a few 2600 games less reliable'],
        ['PAL (from 1987)', 'Different BIOS: no signature check and no logo; a built-in game when no cartridge is found; joypads instead of the Pro-Line joystick in some markets'],
      ])}
      <p class="hw-readable" style="margin-top:10px">An NTSC 7800 cartridge may start on a PAL console, because the PAL BIOS does not check signatures, but MARIA&rsquo;s PAL timing (313 lines, slightly slower clocks) means it will not always run correctly.</p>` },

    { h: 'The processor and the clock', html: `
      <p class="hw-readable">The CPU is the same <b>6502C &ldquo;SALLY&rdquo;</b> as the 5200, with the HALT pin MARIA uses to take the bus. MARIA runs from a <b>7.16 MHz</b> clock (twice the NTSC colour carrier) and the CPU gets a quarter of that, <b>1.79 MHz</b>. But whenever the CPU touches the TIA or the RIOT, the 2600 chips that are still on the board, it drops to <b>1.19 MHz</b> for that access, the 2600&rsquo;s own speed, because those chips cannot go faster. A line is <b>454 MARIA cycles</b>, or 113.5 CPU cycles.</p>` },

    { h: 'Memory map', html: `
      ${_ahwTable(['Range', 'Size', 'Contents'], [
        [_m('$0000–$001F'), '', 'TIA registers (sound, and video only in 2600 mode)'],
        [_m('$0020–$003F'), '', 'MARIA registers'],
        [_m('$0040–$01FF'), '', 'RAM shadowed from the main block, so zero page and the stack are real RAM'],
        [_m('$0280–$02FF'), '', 'RIOT ports and timer (joysticks, console switches)'],
        [_m('$1800–$27FF'), '4 KB', 'Main RAM (two 6116 chips)'],
        [_m('$4000–$FFFF'), '48 KB', 'Cartridge'],
      ])}
      <p class="hw-readable" style="margin-top:10px">A write-once register at <span class="hw-mono-inline">$0001</span> (often called <span class="hw-mono-inline">INPTCTRL</span>) chooses what the console is: it enables MARIA and RAM, the cartridge, or the TIA&rsquo;s video output, and has a <b>lock bit</b>. Once the BIOS sets the lock, the mode cannot be changed again until the power is switched off. That is how a 2600 cartridge, once handed over, gets a console that behaves exactly like a 2600.</p>` },

    { h: 'MARIA: display lists, not tiles', html: `
      <p class="hw-readable">MARIA has no fixed sprite slots and no tile map. Instead the screen is divided into horizontal <b>zones</b>, usually 8 or 16 lines tall, listed in a <b>display list list</b> (DLL) of 3-byte entries. Each zone points to a <b>display list</b>: a chain of 4- or 5-byte headers, each describing one object (where its graphics are, which palette, its width and X position). The 5-byte form adds <b>indirect</b> (character) mode, where the data is a row of character codes rather than pixels, which is how backgrounds are drawn. On every line MARIA reads the headers and paints the objects into a line buffer, halting the CPU while it works.</p>
      <p class="hw-readable">The limit is therefore <b>time, not a sprite count</b>. Header and graphics fetches cost a fixed number of MARIA cycles each, and all of it must fit in one line. Figures such as &ldquo;100 objects on screen, 30 on a line&rdquo; are rough results of that budget, not registers. The less DMA a line uses, the more time is left for the CPU.</p>
      ${_ahwTable(['Mode', 'Pixel width', 'Colours per object'], [
        ['160A', '2 per pixel (160 across)', '3 + transparent, from any of 8 palettes'],
        ['160B', '2 per pixel', '12 + transparent, from 2 groups of palettes'],
        ['320A', '1 per pixel (320 across)', '1 + transparent'],
        ['320B', '1 per pixel', '3 + transparent, with placement restrictions'],
        ['320C', '1 per pixel', '4 colours from paired palettes, with placement restrictions'],
        ['320D', '1 per pixel', '1 or 3 colours, at 320A&rsquo;s DMA cost'],
      ])}
      <p class="hw-readable" style="margin-top:10px">Other MARIA features: <b>holey DMA</b>, which treats odd memory blocks as blank so 8- and 16-line zones need less graphics storage; <b>Kangaroo mode</b>, which turns off transparency; and a <b>display list interrupt</b> (an NMI) that fires after the previous zone so the program can change colours mid-screen.</p>
      <p class="hw-readable">The palette is <b>256 colours</b> (16 hues &times; 16 brightness levels). Eight palettes of three colours plus one shared background give <b>25 colours on a line</b>, and display list interrupts change them further down the screen.</p>` },

    { h: 'Sound: TIA, and POKEY on the cartridge', html: `
      <p class="hw-readable">The console&rsquo;s only sound chip is the <b>TIA</b>, exactly as on the 2600: two channels with its narrow choice of pitches. GCC expected cartridges to bring their own sound hardware, and the cartridge slot allows it. Two official games carry a <b>POKEY</b> on the cartridge (Ballblazer and Commando), which gives them four-channel Atari 8-bit sound; some lists add a third. Many modern homebrew games include a POKEY too, and recent homebrew boards add other chips.</p>` },

    { h: 'The BIOS and the signature check', html: `
      <p class="hw-readable">The NTSC 7800 is one of the earliest consoles to use <b>public-key cryptography</b> as a lockout. Every official NTSC cartridge carries a <b>digital signature</b> at <span class="hw-mono-inline">$FF80–$FFF7</span>: a hash of the cartridge, encrypted with a private key that only Atari held. At power-on the 4 KB BIOS computes the hash of the cartridge, decrypted the stored signature with the public key in the BIOS and compared the two. The byte at <span class="hw-mono-inline">$FFF9</span> sets the range: its high nibble gives the first page of the cartridge to check, and its low nibble must be 3 or 7; <span class="hw-mono-inline">$FFF8</span> is a region byte.</p>
      <p class="hw-readable">If the signature matches, the BIOS locks the console in <b>7800 mode</b> and starts the game (NTSC consoles show the Atari logo at start-up). If not, it assumes the cartridge is a 2600 game, switches the TIA&rsquo;s video on, locks the console in <b>2600 mode</b> and resets into the cartridge. So a 7800 game that fails the check does not show an error; it is simply run as a 2600 game and crashes.</p>
      <p class="hw-readable">Atari&rsquo;s original signing program for the Atari ST was later recovered and hand-decompiled into C, so homebrew 7800 games can now be signed. The scheme is often described as Rabin-style; the signature uses 960 bits.</p>
      <p class="hw-readable">The <b>PAL BIOS</b> (16 KB) does not do the check at all, the usual explanation being export restrictions on cryptography at the time. It instead uses simpler tests to tell 7800 and 2600 cartridges apart, skips the logo, and on the community&rsquo;s account includes a copy of Asteroids that runs when no cartridge is recognised.</p>
      <div class="hw-caveat">Not established here: the exact rules the PAL BIOS uses to decide between 7800 and 2600 cartridges. Sources describe them only as heuristics.</div>` },

    { h: 'Cartridges and bank switching', html: `
      <p class="hw-readable">The slot maps <b>48 KB</b> directly. Bigger games use one of a few schemes, most of them variations on Atari&rsquo;s own &ldquo;SuperGame&rdquo; board:</p>
      ${_ahwTable(['Scheme', 'Size', 'How it works', 'Examples'], [
        ['Flat', 'up to 48 KB', 'No switching', 'Most early titles'],
        ['SuperGame', '128 KB', 'Eight 16 KB banks switched into $8000–$BFFF; the last bank fixed at $C000–$FFFF', 'Commando, Ace of Aces'],
        ['SuperGame + 16 KB', '144 KB', 'An extra 16 KB of cartridge memory at $4000–$7FFF', 'Alien Brigade, Crossbow'],
        ['SuperGame + RAM', '+8 or 16 KB RAM', 'RAM on the cartridge at $4000–$7FFF', 'Impossible Mission, Summer Games, Winter Games'],
        ['F-18 Hornet (Absolute)', '64 KB', '32 KB fixed, two 16 KB banks at $4000', 'F-18 Hornet'],
        ['Activision', '128 KB', 'Eight 16 KB banks at $A000–$DFFF, switched by writes above $FF80', 'Double Dragon, Rampage'],
        ['POKEY boards', '32 KB+', 'A POKEY chip on the cartridge', 'Ballblazer, Commando'],
      ])}
      <p class="hw-readable" style="margin-top:10px">7800 cartridge dumps often carry a 128-byte header (the <span class="hw-mono-inline">.a78</span> format, a community invention) that records which of these the game needs, its region and its controllers, because the cartridge itself carries no such information.</p>` },

    { h: '2600 compatibility', html: `
      <p class="hw-readable">The 7800 plays 2600 games with <b>real 2600 hardware</b>, not imitation: the TIA and RIOT are on the board, and in 2600 mode the CPU runs at the 2600&rsquo;s speed and the TIA drives the video. Compatibility is close to complete, with known exceptions. Early consoles with the expansion port have the fewest problems; later revisions trouble a few games, including some with Atari&rsquo;s Super Chip RAM, and titles such as Robot Tank, Decathlon and Space Shuttle are reported to fail on some units. The Tigervision cartridges do not seat in the 7800 slot at all, and the Starpath Supercharger does not work with most 7800s.</p>` },

    { h: 'Controllers and peripherals', html: `
      ${_ahwTable(['Device', 'Notes'], [
        ['CX24 Pro-Line Joystick', 'North American pack-in: a stick with a button on each side, read as two separate buttons in 7800 mode'],
        ['CX78 Joypad', 'European pack-in: a D-pad with two buttons'],
        ['2600 controllers', 'Joysticks, paddles, driving and keypad controllers all work; paddle triggers are read from the RIOT'],
        ['XG-1 light gun', 'Supported by a handful of 7800 games'],
        ['High Score Cartridge', 'Pass-through cartridge with battery-backed RAM for high scores; developed in the 1980s but not released then'],
      ])}
      <p class="hw-readable" style="margin-top:10px">Two-button mode is something the program must ask for: it sets two bits of the RIOT&rsquo;s port B as outputs, after which the two buttons appear separately on TIA inputs. In 2600 mode both sides act as one button, as on a 2600 stick.</p>` },
  ],
  sources: [
    '<b>7800 Software Guide</b> (GCC / Atari, updated by the 7800 homebrew community) at <a href="https://7800.8bitdev.org/index.php/7800_Software_Guide" target="_blank" rel="noopener">7800.8bitdev.org</a>. Primary source for the memory map, MARIA, display lists, zones, DMA timing, the control register, the clock slow-down and the controller set-up.',
    '<b>Atari 7800 bankswitching guide</b> at <a href="https://7800.8bitdev.org/index.php/ATARI_7800_BANKSWITCHING_GUIDE" target="_blank" rel="noopener">7800.8bitdev.org</a>. The cartridge schemes and the games that use them.',
    '<b>Wikipedia</b>, &ldquo;Atari 7800&rdquo;. History, dates, price, sales, the BIOS sizes, MARIA&rsquo;s palette and per-line colours, and the POKEY games; second source for the clocks and RAM.',
    '<b>Atari 7800 encryption</b> archive at <a href="https://www.atariage.com/7800/archives/encryption.html" target="_blank" rel="noopener">AtariAge</a>, and the <b>sign7800</b> tool notes (<a href="https://se.aminet.net/util/crypt/sign7800.readme" target="_blank" rel="noopener">aminet.net</a>). The signature scheme, its size, the $FFF8/$FFF9 rules and the recovered ST signing program.',
    '<b>Atari 7800 model differences and game incompatibilities</b>, ConsoleMods wiki (<a href="https://consolemods.org/wiki/Atari_7800:Atari_7800_Model_Differences" target="_blank" rel="noopener">consolemods.org</a>), with the AtariAge forums. Expansion-port revisions, the PAL BIOS behaviour and the 2600 games that fail on some consoles.',
    '<b>AtariAge</b> 7800 forums (<a href="https://atariage.com/" target="_blank" rel="noopener">atariage.com</a>), for the MARIA graphics modes and their colour rules.',
  ],
};

/* ---------------------------------------------------------------------------
 * ATARI LYNX
 * ------------------------------------------------------------------------- */
const ATARI_HW_LYNX = {
  title: 'Atari Lynx',
  tag: 'Mikey (65C02 CPU, display, sound, timers, serial) and Suzy (sprite engine and maths unit), 16 MHz, in a colour handheld &middot; 1989',
  specs: [
    ['CPU', '65C02 core inside Mikey; up to 4 MHz on page-mode RAM reads, slower otherwise (about 3.6 MHz on average)'],
    ['System clock', '16 MHz crystal; one tick is 62.5 ns'],
    ['RAM', '64 KB (two 64K &times; 4 DRAMs)'],
    ['Boot firmware', '512 bytes, inside Mikey'],
    ['Screen', '3.5-inch backlit colour LCD, 160 &times; 102 pixels'],
    ['Colours', '16 per line from a palette of 4,096 (12-bit)'],
    ['Refresh', 'Set by the program; documented settings of 59.9 Hz and 75 Hz'],
    ['Graphics', 'Suzy: hardware sprite scaling, stretching, tilting and collision buffer'],
    ['Sound', '4 channels with 8-bit output; stereo on the Lynx II'],
    ['Cartridge', 'Not memory-mapped: read into RAM through a counter; up to 1 MB without extra hardware'],
    ['Link', 'ComLynx serial cable, up to 62,500 baud; up to 8 players'],
    ['Power', '6 &times; AA, about 4–5 hours (Lynx I), 5–6 hours (Lynx II)'],
  ],
  sections: [
    { h: 'The machine', html: `
      <p class="hw-readable">The Lynx began at <b>Epyx</b> in 1986 as the <b>Handy</b>, designed by <b>RJ Mical</b> and <b>Dave Needle</b>, two of the designers of the Amiga. Epyx could not fund the launch, and Atari took the design over. It went on sale in North America on <b>1 September 1989 at US$179.95</b>, beating the Game Gear and arriving weeks after the Game Boy, as the <b>first handheld with a colour LCD</b>. Europe and Japan followed in 1990. It sold around two million units before Atari dropped it in 1995 to concentrate on the Jaguar.</p>
      <p class="hw-readable">It is technically far ahead of its rivals: a <b>16 MHz</b> system clock, <b>64 KB</b> of RAM, a 4,096-colour palette and a dedicated sprite processor that can <b>scale</b> sprites in hardware, which Atari used for pseudo-3D racing and flying games no other handheld of the time could manage. The cost was size, price and battery life: six AA cells lasting about four or five hours.</p>` },

    { h: 'Models: Lynx and Lynx II', html: `
      ${_ahwTable(['Model', 'Year', 'What is different'], [
        ['Lynx (Lynx I)', '1989', 'Large shell, mono speaker and headphone output, no way to turn the backlight off'],
        ['Lynx II', '1991, US$99', 'Smaller, with rubber grips; clearer screen; a button to switch the backlight off to save power; <b>stereo</b> headphone output'],
      ])}
      <p class="hw-readable" style="margin-top:10px">Both run the same games. The stereo hardware the Lynx II added is a set of registers that send each of the four channels to the left, right or both outputs; the developer documentation records that it was designed in after the original hardware had shipped. Games written for the Lynx I simply play in mono.</p>` },

    { h: 'Mikey and Suzy', html: `
      <p class="hw-readable">The whole machine is two custom chips. <b>Mikey</b> contains everything except the sprite engine: the <b>65C02 CPU</b> itself (a core built into the chip, not a separate part), the boot firmware, the memory controller, the display driver and palette, <b>eight timers</b>, the <b>sound</b> generator, the <b>UART</b> for ComLynx and the interrupt logic. <b>Suzy</b> is the graphics engine: it draws sprites into RAM, maintains the collision buffer, contains a <b>hardware maths unit</b>, and reads the buttons and the cartridge.</p>
      <p class="hw-readable">The two share one bus to RAM. When Suzy draws, it asks Mikey for the bus and the CPU stops until Suzy has finished, so sprite drawing and CPU work take turns rather than run in parallel. The documentation sets the worst-case wait for the bus at 2.5 &micro;s.</p>` },

    { h: 'The processor and memory timing', html: `
      <p class="hw-readable">Everything runs from a <b>16 MHz</b> crystal, so one tick is 62.5 ns. The CPU does not have a fixed clock: each bus cycle takes a number of ticks that depends on what it touches. A read from RAM in the same page as the last one (DRAM page mode) takes <b>4 ticks</b>, which is 4 MHz; an ordinary RAM or read-only memory cycle takes <b>5 ticks</b>; a hardware register takes 5 or more, and a cartridge read <b>15</b>. That is why the CPU speed is quoted as &ldquo;up to 4 MHz&rdquo; with an average near 3.6 MHz, and why the &ldquo;16 MHz&rdquo; often quoted is the crystal, not the CPU.</p>
      <p class="hw-readable">The 64 KB of RAM sits under the whole address space. The top 1 KB is shared with the chips and the boot firmware, and a register called <span class="hw-mono-inline">MAPCTL</span> switches each part between hardware and RAM:</p>
      ${_ahwTable(['Range', 'Contents (when not switched to RAM)'], [
        [_m('$0000–$FBFF'), 'RAM, always'],
        [_m('$FC00–$FCFF'), 'Suzy registers'],
        [_m('$FD00–$FDFF'), 'Mikey registers'],
        [_m('$FE00–$FFF7'), 'Boot firmware'],
        [_m('$FFF8'), 'Reserved'],
        [_m('$FFF9'), _m('MAPCTL') + ': one bit per block chooses hardware/boot firmware or RAM'],
        [_m('$FFFA–$FFFF'), 'CPU vectors (from boot firmware or RAM)'],
      ])}` },

    { h: 'The display', html: `
      <p class="hw-readable">The LCD has <b>480 &times; 102</b> physical dots arranged as <b>160 &times; 102 colour pixels</b> (red, green and blue side by side). Each pixel in RAM is 4 bits, an index into a 16-entry palette, so the frame buffer is <b>8,160 bytes</b> (102 lines of 80 bytes). Each palette entry has 4 bits of red, green and blue, giving <b>4,096</b> possible colours. Programs often change palette entries between lines to show more than 16 on one screen.</p>
      <p class="hw-readable">There is no fixed frame rate. Mikey&rsquo;s timers generate the line and frame timing, and the developer documentation gives two standard settings:</p>
      ${_ahwTable(['Setting', 'Line time', 'Frame', 'Rate'], [
        ['60 Hz', '159 &micro;s', '105 lines (102 shown + 3 blank)', '59.90 Hz'],
        ['75 Hz', '127 &micro;s', '105 lines', '74.99 Hz'],
      ])}
      <p class="hw-readable" style="margin-top:10px">50 Hz is possible but the documentation warns it flickers on the LCD. The display can also be <b>flipped</b> 180 degrees, Mikey reading the frame buffer backwards and Suzy drawing accordingly, which is how Lynx games support left-handed play with the console turned upside down. The buttons are duplicated so that either way up has a pair of fire buttons on the right.</p>` },

    { h: 'Suzy: sprites, scaling and collisions', html: `
      <p class="hw-readable">Suzy has no sprite list in hardware and no sprite limit. Sprites are described by <b>sprite control blocks</b> in RAM, linked into a chain in the order they should be painted, and Suzy draws each one into the frame buffer in turn. Sprite data can be <b>1, 2, 3 or 4 bits per pixel</b> and is stored <b>run-length packed</b> (with literal runs), unpacked as it is drawn.</p>
      <p class="hw-readable">Each sprite has independent horizontal and vertical <b>size</b>, a <b>stretch</b> that changes the size on every line and a <b>tilt</b> that shifts each line sideways, so a single sprite can be scaled, turned into a trapezoid or sheared. Combined, these produce the road and floor effects in games such as Checkered Flag and Blue Lightning. Sprites can be flipped either way and are clipped at the screen edges by the hardware.</p>
      <p class="hw-readable"><b>Collision detection</b> uses a second buffer the size of the screen. Each sprite can write a collision number (0–15) into it as it is drawn, and Suzy records the highest number it painted over in the sprite&rsquo;s own collision byte. Eight sprite types (normal, background, boundary, shadow, XOR and so on) decide which colours are drawn and which take part in collisions.</p>` },

    { h: 'The maths unit', html: `
      <p class="hw-readable">Suzy includes arithmetic hardware the 65C02 lacks: a <b>16 &times; 16 to 32-bit multiply</b>, signed or unsigned, with a 32-bit accumulator, and a <b>32 &divide; 16 divide</b> giving a 32-bit quotient and 16-bit remainder. A multiply takes 44 ticks (54 with sign and accumulate); a divide takes 176 ticks plus 14 for each leading zero in the divisor. Dividing by zero sets a flag and returns <span class="hw-mono-inline">$FFFFFFFF</span>. This is what made the Lynx&rsquo;s 3D and scaling games practical on an 8-bit CPU.</p>` },

    { h: 'Sound', html: `
      <p class="hw-readable">Mikey has <b>four identical channels</b>. Each is driven by its own timer and a <b>12-bit shift register</b> with feedback: nine of its outputs can be selected and fed back through an exclusive-OR, so one generator can produce square waves, pulse patterns or many kinds of noise depending on the taps. Each channel has a 7-bit volume and a sign bit (an 8-bit output in two&rsquo;s complement), and an <b>integrate</b> mode that turns the square wave into a rough triangle. The channels are mixed digitally.</p>
      <p class="hw-readable">Because the output is a straight 8-bit value per channel, programs can also bypass the shift register and write samples directly, which is how some Lynx games play speech and digitised sound. The Lynx I has one speaker and a mono headphone jack; the Lynx II adds per-channel stereo panning and attenuation.</p>` },

    { h: 'Cartridges', html: `
      <p class="hw-readable">Lynx cartridges are <b>not mapped into memory</b>. The CPU cannot run code from them; it reads them one byte at a time through a Suzy register, and everything is copied into RAM first. The cartridge address is made of two parts: an <b>8-bit shift register</b> that selects a block (256 blocks), loaded one bit at a time, and a <b>counter of up to 11 bits</b> that advances on every read within the block. A 128 KB cartridge, for example, uses 9 counted bits (512-byte blocks) and 8 shifted bits.</p>
      ${_ahwFacts([
        ['Block select', '8-bit shift register: 256 blocks'],
        ['Within a block', 'Counter of up to 11 bits: block sizes up to 2 KB'],
        ['Per strobe', 'Up to 19 address bits, 512 KB'],
        ['Total', 'Two strobes, so up to 1 MB without extra hardware'],
        ['Read time', '15 ticks per byte (392 ns available at the cartridge pins)'],
      ])}
      <p class="hw-readable" style="margin-top:10px">Cartridges range from 128 KB up to that 1 MB limit. Because games copy their code and graphics into RAM from the cartridge as they run, the cartridge behaves more like a very fast disk than like the directly-executed cartridges of other consoles.</p>` },

    { h: 'The boot firmware and cartridge encryption', html: `
      <p class="hw-readable">The 512-byte boot firmware in Mikey initialises the hardware and then loads the start of the cartridge. That first part is <b>encrypted</b>: the firmware reads it in blocks of <b>51 bytes</b>, treats each block as one large number, <b>cubes it modulo a 51-byte public key</b> (the RSA scheme with exponent 3) and writes the result into RAM at <span class="hw-mono-inline">$0200</span>, then runs it. The decrypted loader, which is ordinary code, then reads the rest of the game. A cartridge whose first block does not decrypt to working code simply never starts.</p>
      <p class="hw-readable">So, unlike the 7800, the Lynx does not check a signature over the whole game; it protects only the first loader, which is enough to stop unlicensed cartridges from booting without Atari&rsquo;s key. The encryption tools and keys have since become available, and homebrew development kits produce bootable cartridges routinely.</p>
      <div class="hw-caveat">The block size, the exponent and the load address are stated by homebrew tool sources and community forum analysis, which agree with each other; the Epyx documentation itself does not describe the encryption.</div>` },

    { h: 'Timers, interrupts and ComLynx', html: `
      <p class="hw-readable">Mikey&rsquo;s <b>eight timers</b> can be chained, each counting the overflows of the one before. Two of them generate the display&rsquo;s line and frame timing, one sets the serial baud rate, and the rest are free for the game; each can raise an interrupt. The four sound channels have their own timers in the same chain.</p>
      <p class="hw-readable"><b>ComLynx</b> is a single-wire serial bus on a 3-contact jack (ground, power and data) driven by Mikey&rsquo;s UART at up to <b>62,500 baud</b>, about 104 bytes per frame at 60 Hz. Every console on the cable sees every byte, including its own, so games implement their own turn-taking. Atari supported up to <b>eight</b> consoles linked together. The design originally used infrared (it was nicknamed RedEye) and changed to cable before release.</p>` },

    { h: 'Known hardware quirks', html: `
      <p class="hw-readable">The Epyx documentation has a chapter titled &ldquo;Software Related Hardware Perniciousness&rdquo;, listing the hardware bugs developers had to work around. Among them:</p>
      <ul class="hw-sources hw-readable">
        <li><b>Sleep is broken.</b> The CPU will not stay asleep unless Suzy is using the bus.</li>
        <li><b>Suzy registers are unsafe while it draws.</b> Touching the sprite control registers mid-draw corrupts the result, and two Suzy accesses back to back can break it.</li>
        <li><b>Palette page break.</b> A pen palette that starts at an address ending in <span class="hw-mono-inline">$FA</span> loses its last two bytes.</li>
        <li><b>Cartridge writes.</b> For 12 ticks after a write to the cartridge begins, the CPU must not access Suzy.</li>
        <li><b>Timers.</b> With reload disabled, a timer whose &ldquo;done&rdquo; flag is already set will not count at all.</li>
      </ul>` },

    { h: 'Controls and power', html: `
      <p class="hw-readable">An 8-way <b>D-pad</b>, <b>A and B</b> buttons (duplicated, so the console works either way up), <b>Option 1</b>, <b>Option 2</b> and <b>Pause</b>, plus power on and power off (and, on the Lynx II, the backlight). Power is <b>six AA cells</b> or an external supply; Mikey can sense which is in use. A magnetic tape interface was designed into Mikey, but the boot firmware never enables it and no product used it.</p>` },
  ],
  sources: [
    '<b>Lynx developer documentation</b> (Epyx, 1987; Atari revisions to 1991), HTML edition at <a href="https://www.monlynx.de/lynx/lynxdoc.html" target="_blank" rel="noopener">monlynx.de</a>. Primary source for the clocks and tick counts, RAM timing, the memory map and MAPCTL, the display and its timer settings, Suzy&rsquo;s sprites, collisions and maths unit, the sound channels, the cartridge addressing, ComLynx, the boot firmware size and the hardware bugs.',
    '<b>Wikipedia</b>, &ldquo;Atari Lynx&rdquo;. History, dates, prices, sales, the Lynx II changes, battery life and the CPU&rsquo;s average speed; second source for the resolution, palette, RAM, ComLynx player count and cartridge sizes.',
    '<b>cc65 Lynx boot loader source</b> (<a href="https://github.com/cc65/cc65/blob/master/libsrc/lynx/bootldr.s" target="_blank" rel="noopener">github.com/cc65</a>) and the <b>AtariAge Lynx encryption thread</b> (<a href="https://forums.atariage.com/topic/129030-lynx-encryption/" target="_blank" rel="noopener">forums.atariage.com</a>). The encrypted loader&rsquo;s 51-byte blocks, exponent 3, the public-key length and the $0200 load address.',
    '<b>Ian Farquhar</b>, Usenet post on Lynx authentication, 27 November 1990 (<a href="https://mirror.cyberbits.eu/textfiles.com/programming/CRYPTOGRAPHY/atalynx.txt" target="_blank" rel="noopener">textfiles.com mirror</a>). A contemporary account that the boot firmware uses public-key authentication; its guesses about the details are superseded by the sources above.',
    '<b>AtariAge</b> Lynx forums and archives (<a href="https://atariage.com/" target="_blank" rel="noopener">atariage.com</a>), for cross-checking models, cartridge sizes and ComLynx behaviour.',
  ],
};

const ATARI_HW = {
  atari2600: ATARI_HW_2600,
  atari5200: ATARI_HW_5200,
  atari7800: ATARI_HW_7800,
  atarilynx: ATARI_HW_LYNX,
};

/* The console-wide part of an Atari Hardware tab: header, spec box, every
   reference section. Returns { header, body, sources } so the caller can put
   its per-cartridge and per-core sections between body and sources. */
function atariHardwareReference(sys) {
  const r = ATARI_HW[sys];
  if (!r) return null;
  const header = `
      <div class="hw-chip-header">
        <h2>${r.title}</h2>
        <p class="hw-chip-tag">${r.tag}</p>
      </div>${sys === 'atarilynx' && typeof hwDiagramHTML === 'function' ? hwDiagramHTML('atarilynx') : ''}`;
  const body = r.sections.map((s, i) => `
      <section class="sect">${hwSectH(s.h)}${s.html}${i === 0 ? _ahwFacts(r.specs) : ''}
      </section>`).join('');
  const sources = `
      <section class="sect">
        <h3 class="sect-h">Sources</h3>
        <ul class="hw-sources">${r.sources.map(s => `<li>${s}</li>`).join('')}</ul>
      </section>`;
  return { header, body, sources };
}
