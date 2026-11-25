/* ===========================================================================
 * Sega 8-bit hardware reference: the data behind the Hardware tab of every SG-1000,
 * Master System and Game Gear cartridge. sega8HardwareReference(catalogue) returns
 * { header, body, sources } in the shape of atariHardwareReference (atari-hardware-tab.js),
 * so the caller can put its per-cartridge and per-core sections between body and sources.
 * Catalogue ids: 'sg1000', 'mastersystem', 'gamegear'.
 *
 * Loaded by a plain <script src> tag (not fetch) so the site still opens from disk over
 * file://. Names here start with _s8hw or SEGA8_HW so they cannot meet the Atari file's.
 *
 * WRITING RULE: every figure comes from the Sega 8-bit build chapters (the Emulation tab,
 * WASM_Source/sega8-tabs/chapters/) or the research behind the emulator; where sources
 * disagree, or a value is not established, the text says so. No figure is guessed.
 * Site wording rules: plain English, Australian spelling, no em dash, no emulator names.
 * `sources` is an empty string: a list of sources is a public credit, and credits wait
 * for approval.
 * ======================================================================== */

function _s8hwTable(head, rows) {
  var th = head.map(function (h) { return '<th>' + h + '</th>'; }).join('');
  var tr = rows.map(function (r) { return '<tr>' + r.map(function (c) { return '<td>' + c + '</td>'; }).join('') + '</tr>'; }).join('');
  return '<div class="hw-table-wrap hw-table-scroll"><table class="hw-table"><thead><tr>' + th + '</tr></thead><tbody>' + tr + '</tbody></table></div>';
}
function _s8hwFacts(rows) {
  return '<div class="factbox factbox-stacked">' + rows.map(function (r) { return '<div class="row"><span class="k">' + r[0] + '</span><span class="v">' + r[1] + '</span></div>'; }).join('') + '</div>';
}
function _s8hwH(h) {
  return (typeof hwSectH === 'function') ? hwSectH(h) : '<h3 class="sect-h">' + h + '</h3>';
}

/* Shared pieces: the three devices are one family with one CPU and one sound design. */
var _S8HW_Z80 = '<p class="hw-readable">Every console in the family has a <b>Zilog Z80</b> running at the master clock divided by 15: <b>3.579545 MHz</b> on an NTSC console (about 3.55 MHz on PAL). A television line is exactly 228 Z80 clocks, and a frame is 262 lines on NTSC (<b>59.9227</b> frames a second) or 313 on PAL (<b>49.7015</b>). The Game Gear has the CMOS version of the Z80, which differs from the older NMOS part in a few undocumented details.</p>';
var _S8HW_PSG = '<p class="hw-readable">The sound chip is the <b>SN76489</b> design: three square-wave tone channels and one noise channel, each with 16 volume steps of 2 dB, clocked from the Z80&rsquo;s clock divided by 16. A tone of period N plays at Z80 clock / (32 N), so the lowest note is about 109 Hz. The SG-1000 has Texas Instruments&rsquo; own SN76489AN; the later consoles have Sega&rsquo;s copy of it built into the video chip, whose noise generator is 16 bits long instead of 15.</p>';

var SEGA8_HW_SG1000 = {
  title: 'Sega SG-1000 and SG-1000 II',
  tag: 'Zilog Z80, TI TMS9918A video, TI SN76489AN sound &middot; 1983',
  specs: [
    ['CPU', 'Zilog Z80 at 3.58 MHz'],
    ['Work RAM', '1 KB, repeated through $C000 to $FFFF'],
    ['Video', 'TI TMS9918A with 16 KB of video RAM: 256 &times; 192 pixels, 16 colours (colour 0 is transparent), 32 sprites with 4 on a line'],
    ['Sound', 'TI SN76489AN: 3 tone channels and 1 noise channel'],
    ['Start-up firmware', 'None: the cartridge runs from power-on'],
    ['Cartridges', 'Mostly 8 to 32 KB with no mapper; Sega My Cards through the Card Catcher adaptor'],
    ['Controls', 'Two pads (wired on the SG-1000, detachable on the SG-1000 II) and a Hold button on the console'],
    ['Machine choices here', 'SG-1000, SG-1000 II, the SG-1000 II&rsquo;s later one-chip board, the PAL SG-1000 II, the Othello Multivision, and the Mark III'],
  ],
  sections: [
    { h: 'The machine', html: '<p class="hw-readable">The <b>SG-1000</b> was Sega&rsquo;s first home console, sold in Japan from <b>1983</b>. The <b>SG-1000 II</b> followed in <b>1984</b> with the same chips and pads that unplug from the console. The <b>SC-3000</b> is the home-computer version, with a keyboard, BASIC cartridges and a tape recorder: it is not built here, but SC-3000 cartridges that are ordinary SG-1000 games play on the SG-1000.</p>' +
      '<p class="hw-readable">The design is built from off-the-shelf parts: a Z80, Texas Instruments&rsquo; TMS9918A video chip and TI&rsquo;s SN76489AN sound chip. Its descendants, the Mark III and the Master System, keep the TMS9918A&rsquo;s picture modes inside Sega&rsquo;s own video chip, so they can still run SG-1000 software.</p>' },
    { h: 'CPU and memory', html: _S8HW_Z80 +
      '<p class="hw-readable">The cartridge owns $0000 to $BFFF. Work RAM is only <b>1 KB</b>, and it appears 16 times over in $C000 to $FFFF. There is no memory control port, no I/O control port, no Reset button and no card slot. The console decodes only two address lines for its ports:</p>' +
      _s8hwTable(['Ports', 'Read', 'Write'], [
        ['$40 to $7F', '$FF', 'the sound chip'],
        ['$80 to $BF', 'video data (even) and status (odd)', 'video data (even) and control (odd)'],
        ['$C0 to $FF', 'the two pads', 'nothing'],
      ]) },
    { h: 'Video: the TMS9918A', html: '<p class="hw-readable">The TMS9918A has eight registers and four picture modes: <b>Graphics I</b> (a 32 &times; 24 grid of 8 &times; 8 tiles with one colour pair per group of eight tiles), <b>Graphics II</b> (the screen in three thirds, each tile row with its own colours), <b>multicolour</b> (4 &times; 4 blocks) and <b>text</b> (40 columns of 6-pixel characters). It has <b>32 sprites</b>, 8 &times; 8 or 16 &times; 16 and optionally magnified, of which only <b>4 can share a line</b>: a fifth sets a flag and its number in the status register.</p>' +
      '<p class="hw-readable">Its <b>16 colours</b> are produced as video voltages (luminance and two colour differences) and are the chip&rsquo;s own; the Master System shows the same modes in its own, darker approximation. The chip has no line interrupt, no scroll registers and no position counters. One register bit switches between 4 KB and 16 KB video memory addressing, and because the two wire the address lines to the memory chips differently, data already in video memory moves when the bit changes; a few games depend on that.</p>' },
    { h: 'Sound', html: _S8HW_PSG + '<p class="hw-readable">The discrete TI chip takes time to load each write and holds the Z80 while it does. How long exactly is not established on a console.</p>' },
    { h: 'Cartridges and cards', html: '<p class="hw-readable">Most SG-1000 cartridges are 8 to 32 KB with no mapper chip; a smaller program simply repeats through the cartridge area. A few carry their own RAM (2 KB in Othello, 8 KB in The Castle, neither with a battery). Taiwanese conversions of MSX games came with RAM adaptors: one adds 8 KB at $2000, the other turns work RAM into 8 KB.</p>' +
      '<p class="hw-readable">Sega&rsquo;s credit-card-sized <b>My Cards</b> hold up to 32 KB. The SG-1000 plays them through the <b>Card Catcher</b>, a passive adaptor in the cartridge slot.</p>' },
    { h: 'Controls and the Machine choices', html: '<p class="hw-readable">Each pad has a d-pad and two buttons. The <b>Hold</b> button on the console pauses the game: it goes straight to the Z80&rsquo;s non-maskable interrupt, because the TMS9918A has no pin for it.</p>' +
      '<p class="hw-readable">The <b>Mark III</b> is offered as a third Machine for these cartridges: it takes them in its own slot and shows them in the Master System&rsquo;s colours, with 8 KB of work RAM. The export Master System is not offered: its cartridge connector is different and its start-up firmware refuses SG-1000 programs.</p>' +
      '<p class="hw-readable">Later SG-1000 II units, and the Korean and Taiwanese boards built like them, replace the TI video and sound chips with one Sega and Yamaha chip, the <b>315-5066</b>: the same picture modes in slightly different colours (the only published values are an approximation), Sega&rsquo;s own sound chip, and <b>2 KB</b> of work RAM. It is offered as the <b>SG-1000 II (later one-chip board)</b>; Circus Charlie (Korea), made for those boards, starts on it.</p>' +
      '<p class="hw-readable">The SG-1000 II sold in PAL countries has the <b>TMS9929A</b>, the TMS9918A&rsquo;s PAL twin: the same picture, 313 lines a frame at <b>50.16</b> frames a second, with the Z80 on its own 3.58 MHz clock. It is offered as the <b>SG-1000 II (PAL)</b>; the homebrew games made for PAL start on it.</p>' +
      '<p class="hw-readable">Tsukuda&rsquo;s <b>Othello Multivision</b> (1983) is a licensed SG-1000 with a keypad on the console and its own Othello built in, which runs when the slot is empty. It is offered as a Machine choice; the cartridges released for it start on it, and its own Othello plays with the keypad.</p>' },
  ],
};

var SEGA8_HW_SMS = {
  title: 'Sega Master System and Mark III',
  tag: 'Zilog Z80, Sega VDP 315-5124 or 315-5246 with its PSG, optional YM2413 FM &middot; 1985',
  specs: [
    ['CPU', 'Zilog Z80 at 3.58 MHz (3.55 MHz on PAL consoles)'],
    ['Work RAM', '8 KB, repeated at $E000'],
    ['Video', 'Sega VDP: 256 &times; 192 pixels (also 224 and 240 lines on the Master System II), 32 colours on screen from 64, 64 sprites with 8 on a line, plus the four TMS9918 modes'],
    ['Video RAM', '16 KB'],
    ['Sound', 'Sega&rsquo;s SN76489 copy inside the VDP; Yamaha YM2413 FM on the Japanese Master System and in the Mark III&rsquo;s FM Sound Unit'],
    ['Start-up firmware', 'Yes on the Master System models (logo, header and region check, and on some a built-in game); none on the Mark III'],
    ['Cartridges', 'Up to 512 KB through a mapper chip; My Cards in the card slot of the Mark III, the first Master System and the Japanese model'],
    ['Controls', 'Two pads with buttons 1 and 2; Pause (and on some models Reset) on the console'],
    ['Machine choices here', 'Master System II (the default) NTSC and PAL, Master System NTSC and PAL, Mark III, Mark III with the FM Sound Unit, Japanese Master System'],
  ],
  sections: [
    { h: 'The machine', html: '<p class="hw-readable">The <b>Mark III</b> came out in Japan in <b>October 1985</b>: the SG-1000&rsquo;s design with Sega&rsquo;s own video chip, a superset of the TMS9918A with a new tile mode (Mode 4), 8 KB of work RAM and a card slot. An <b>FM Sound Unit</b> plugged into its expansion port added a Yamaha YM2413. It has no start-up firmware.</p>' +
      '<p class="hw-readable">The <b>Master System</b> is the Mark III in a new shell with a different cartridge connector, sold in the USA from <b>1986</b> and in Europe and Australia from <b>1987</b>, with a start-up program that checks the cartridge&rsquo;s header and region. The <b>Japanese Master System</b> (1987) put the YM2413 on the board and added a socket for the 3-D glasses. The <b>Master System II</b> is the later, simpler model: the newer 315-5246 video chip, no card slot, no Reset button and no expansion port, and a game built into its start-up firmware (Alex Kidd in Miracle World or Sonic the Hedgehog).</p>' },
    { h: 'The models', html: _s8hwTable(['', 'Master System', 'Master System II', 'Japanese Master System', 'Mark III'], [
        ['Video chip', '315-5124', '315-5246', '315-5124', '315-5124'],
        ['I/O chip', '315-5216', '315-5237', '315-5297', 'none'],
        ['FM sound', 'no', 'no', 'YM2413 on the board', 'with the FM Sound Unit'],
        ['Start-up firmware', 'yes', 'yes, with a built-in game', 'yes', 'none'],
        ['Card slot', 'yes', 'no', 'yes', 'yes'],
        ['Reset button', 'yes', 'no', 'no', 'sources disagree'],
        ['Region', 'export', 'export', 'Japan', 'Japan'],
        ['TV', 'NTSC or PAL', 'NTSC or PAL', 'NTSC', 'NTSC'],
      ]) +
      '<p class="hw-readable">The two video chips differ in ways games notice. The 315-5124 has extra masks on its table addresses (Ys needs them), doubles only some sprites across when they are zoomed, and has only the 192-line picture. The 315-5246 adds the 224-line and 240-line pictures (Codemasters games use 224) and zooms every sprite. Each cartridge here starts on the model it needs: the Master System II for an ordinary export cartridge, the first Master System for cards, 3-D games and the games that need the older chip, the Japanese Master System for Japanese cartridges.</p>' },
    { h: 'CPU and memory', html: _S8HW_Z80 +
      _s8hwTable(['Range', 'What'], [
        ['$0000 to $BFFF', 'the slot area: the cartridge, the card, or the start-up firmware, chosen by port $3E'],
        ['$C000 to $DFFF', 'work RAM, 8 KB'],
        ['$E000 to $FFFF', 'the same RAM again'],
        ['$FFFC to $FFFF', 'the Sega mapper&rsquo;s registers (each write also lands in RAM)'],
      ]) +
      '<p class="hw-readable">Port <b>$3E</b> switches each slot, the work RAM and the I/O chip on and off; the start-up firmware uses it to look at the cartridge and then hand over. On the first Master System a cartridge wins when two slots are on at once; on the Master System II their outputs are combined. The Mark III has no port $3E.</p>' },
    { h: 'Video', html: '<p class="hw-readable">In <b>Mode 4</b> the screen is a 32 &times; 28 grid of 8 &times; 8 tiles, with 16 colours each for the background and the sprites, chosen from 64 (2 bits each of red, green and blue). The background scrolls by the pixel in both directions, with a lock for the top rows and the right-hand columns so a status bar can stay still. There are <b>64 sprites</b>, 8 &times; 8 or 8 &times; 16, <b>8 on a line</b>. A line counter can raise an interrupt every few lines, which games use to change the scroll part-way down the screen.</p>' +
      '<p class="hw-readable">The chip and the Z80 share video memory: the Z80 gets a turn only in the chip&rsquo;s free slots, about one every 26 Z80 clocks while the picture is drawn. Writes that come faster are lost. The chip also keeps the four TMS9918A modes, shown in a fixed Sega palette.</p>' },
    { h: 'Sound', html: _S8HW_PSG +
      '<p class="hw-readable">The <b>YM2413</b> (OPLL) is a nine-channel FM synthesiser with 15 built-in instruments and one user instrument, or six channels plus five drums. It exists only on the Japanese Master System and in the Mark III&rsquo;s FM Sound Unit; games find it through port $F2 and use it if it is there. On the Mark III unit the FM and the PSG never play together. On export consoles ports $F0 to $F2 are the controller ports again. The Master System II limits the PSG&rsquo;s loudest output, so its top three volume steps sound the same (the exact limit is not established).</p>' },
    { h: 'Start-up firmware', html: '<p class="hw-readable">The start-up firmware shows the Sega logo, checks the cartridge&rsquo;s &ldquo;TMR SEGA&rdquo; header, its region and its checksum, and hands over. Versions include the export <b>v1.3</b> (1986), the rare <b>v2.0</b> (1987), <b>v2.4</b> with Hang On and Safari Hunt, <b>v3.4</b> with Hang On, <b>v4.4</b> with Missile Defense 3-D, the Master System II&rsquo;s <b>Alex Kidd</b> and <b>Sonic</b> versions, and the Japanese <b>v2.1</b>, which accepts nearly everything. They leave the machine in slightly different states, and a few games depend on it.</p>' +
      '<p class="hw-readable">Here the console&rsquo;s own firmware runs first when it has been added, unless a cartridge&rsquo;s record names another. When it refuses a cartridge, it stays on its message, as a real console does. Without firmware, our own program stands in for it.</p>' +
      '<p class="hw-readable">Korean cartridges were made for Samsung&rsquo;s consoles. Samsung&rsquo;s later Master System II, the Aladdin Boy, has its own firmware with Alex Kidd built in, which checks no header at all; its first console ran the Japanese v2.1. Taiwanese cartridges were sold for the Mark III, which has no firmware. Each starts that way here.</p>' },
    { h: 'Cartridges and mapper boards', html: '<p class="hw-readable">A cartridge carries nothing that names its board, so each game file is identified by its hash. The boards:</p>' +
      _s8hwTable(['Board', 'How it pages'], [
        ['Sega', 'three 16 KB slots chosen at $FFFD to $FFFF, the first 1 KB fixed; up to 32 KB of battery RAM through $FFFC'],
        ['Codemasters', 'each 16 KB slot chosen by a write inside it; some with 8 KB of RAM'],
        ['Korean', 'slot 2 chosen by a write to $A000'],
        ['MSX and Nemesis', 'four 8 KB windows, for Korean conversions of MSX games'],
        ['Janggun', '8 KB windows, with banks that can read bit-reversed'],
        ['Plain', 'up to 48 KB with no mapper'],
      ]) +
      '<p class="hw-readable">Battery RAM keeps a game&rsquo;s saves. A few cartridges have RAM with no battery, which forgets at power-off.</p>' +
      '<p class="hw-readable">Korean shops sold cartridges holding many games on one large chip, and Australia had one too, 4 PAK All Action. A small board on each lets the console see one game&rsquo;s pieces at a time. There are thirteen kinds of these multi-game boards, and all of them are built here.</p>' },
    { h: 'Controls and accessories', html: '<p class="hw-readable">The pads have a d-pad and buttons 1 and 2. <b>Pause</b> is a button on the console, which raises the Z80&rsquo;s non-maskable interrupt. Accessories built here:</p>' +
      '<ul class="hw-readable"><li><b>Light Phaser</b>: a light gun whose sensor sees a small disc of the screen; the console latches its position counter when the gun sees the beam.</li>' +
      '<li><b>Paddle Control</b> (Japan): a knob and one button.</li><li><b>Sports Pad</b>: a trackball with two buttons.</li>' +
      '<li><b>3-D glasses</b>: shutter glasses for the card slot or the Japanese socket; the game shows a picture for each eye in turn.</li>' +
      '<li><b>Terebi Oekaki</b>: a drawing board with its own cartridge.</li>' +
      '<li><b>Sega Graphic Board</b>: a drawing board on the controller port, made for its own program and never sold.</li></ul>' +
      '<p class="hw-readable">The <b>Handle Controller</b> and the <b>Control Stick</b> read as ordinary pads, and the <b>Rapid Fire Unit</b> is the site&rsquo;s autofire.</p>' },
  ],
};

var SEGA8_HW_GG = {
  title: 'Sega Game Gear',
  tag: 'Zilog Z80 (CMOS), Sega VDP 315-5378, stereo PSG, 160 &times; 144 colour LCD &middot; 1990',
  specs: [
    ['CPU', 'Zilog Z80 (CMOS) at 3.58 MHz'],
    ['Work RAM', '8 KB'],
    ['Screen', 'Colour LCD showing 160 &times; 144 pixels of the 256 &times; 192 picture'],
    ['Colours', '32 on screen from 4,096 (4 bits each of red, green and blue)'],
    ['Sound', 'Sega&rsquo;s SN76489 copy with stereo on the headphone socket; the speaker is mono'],
    ['Start-up firmware', 'A 1 KB program on the later boards; none on the first'],
    ['Cartridges', 'Game Gear cartridges; Master System games through an adaptor, run in Master System mode'],
    ['Controls', 'A d-pad, buttons 1 and 2, and Start'],
    ['TV standard', 'Every Game Gear runs at 59.92 frames a second, European ones too'],
    ['Machine choices here', 'Game Gear (two-chip board, the default), Game Gear (one-chip board), Game Gear without start-up firmware (the first board), Japanese Game Gear'],
  ],
  sections: [
    { h: 'The machine', html: '<p class="hw-readable">The <b>Game Gear</b> went on sale in Japan in <b>October 1990</b>. Inside it is very nearly a Master System II: the same Z80, 8 KB of work RAM and a version of the 315-5246 video chip, the <b>315-5378</b>, which adds a second mode with a 12-bit palette and a smaller visible window for the LCD. It adds a Start button, a stereo headphone socket and a link port (Gear-to-Gear) for two consoles.</p>' +
      '<p class="hw-readable">A pin on the cartridge decides how the console runs. A Game Gear cartridge leaves it in <b>Game Gear mode</b>. A Master System game, plugged in through an adaptor or sold on a Game Gear cartridge, holds the pin, and the console becomes a Master System: 6-bit colour, Start as the Pause button, and the whole picture squeezed onto the small screen by the console itself. Master System programs sold as Game Gear cartridges are on the Master System shelf here.</p>' },
    { h: 'The boards', html: _s8hwTable(['Machine', 'What differs'], [
        ['Game Gear (two-chip board)', 'the 1 KB start-up firmware; the default here'],
        ['Game Gear (one-chip board)', 'the later single-chip board: some video timings a pixel apart, and a different HALT timing'],
        ['Game Gear without start-up firmware', 'the first board, which starts straight from the cartridge'],
        ['Japanese Game Gear', 'reads as Japanese on port $00; chosen for cartridges sold only in Japan'],
      ]) +
      '<p class="hw-readable">The board differences come from two published sources and one measured test, and are not established on a console. Which start-up firmware Japanese units had is not established either.</p>' },
    { h: 'CPU and memory', html: _S8HW_Z80 +
      '<p class="hw-readable">The memory map is the Master System&rsquo;s. Port $00 reads the Start button, the region and the TV standard; ports $01 to $05 are the link port; port $06 sets which sound channels go to the left and right ears.</p>' +
      '<p class="hw-readable">The <b>Gear-to-Gear cable</b> joins two consoles&rsquo; link ports: seven pins that cross over, and a serial port sending whole bytes at up to 4,800 bits a second, with an interrupt when a byte arrives. Here two Game Gears can be joined in one window, side by side, for two players.</p>' },
    { h: 'Screen and colour', html: '<p class="hw-readable">In Game Gear mode each colour is 4 bits each of red, green and blue, written to colour memory in two bytes; the first is held in a latch until the second arrives. The LCD shows columns 48 to 207 and lines 24 to 167 of the 256 &times; 192 picture. Its pixels are not square; their shape here is fitted until a photograph settles it.</p>' +
      '<p class="hw-readable">In Master System mode the console fits the whole picture onto the panel itself: it drops 8 columns at each side and lights the six sub-pixels of two LCD pixels from every three picture pixels (which gives fine coloured edges), and turns every three lines into two. The full Master System picture can be chosen instead.</p>' },
    { h: 'Sound', html: _S8HW_PSG + '<p class="hw-readable">Port $06 sends each channel to the left, the right or both ears on headphones. The built-in speaker is mono and ignores it. Headphones are the default here; the speaker is a choice in a game&rsquo;s settings.</p>' },
    { h: 'Cartridges and saves', html: '<p class="hw-readable">Game Gear cartridges use the Sega and Codemasters mapper boards (the Master System tab lists them) with battery RAM for saves. Five baseball cartridges save to a small <b>93C46 EEPROM</b> chip instead (64 words of 16 bits); it is kept here like battery RAM.</p>' },
    { h: 'Start-up firmware', html: '<p class="hw-readable">From the second board on, a <b>1 KB</b> program shows the licence line and refuses a cartridge without the &ldquo;TMR SEGA&rdquo; header, leaving the screen dark. It hands over after about 3.5 seconds. Here, as on a real Game Gear, a refused cartridge stays on the dark screen.</p>' },
    { h: 'Not built', html: '<p class="hw-readable">Playing the Gear-to-Gear link online with a second player elsewhere (two Game Gears in one window are built), the TV tuner, and the Master System&rsquo;s accessories, which have no port on the Game Gear.</p>' },
  ],
};

var SEGA8_HW = { sg1000: SEGA8_HW_SG1000, mastersystem: SEGA8_HW_SMS, gamegear: SEGA8_HW_GG };

/* The console-wide part of a Sega 8-bit Hardware tab: header, spec box, every reference
   section. Returns { header, body, sources } (sources is ''), or null for another id. */
function sega8HardwareReference(catalogue) {
  var r = SEGA8_HW[catalogue];
  if (!r) return null;
  var header = '\n      <div class="hw-chip-header">\n        <h2>' + r.title + '</h2>\n        <p class="hw-chip-tag">' + r.tag + '</p>\n      </div>';
  var body = r.sections.map(function (s, i) {
    return '\n      <section class="sect">' + _s8hwH(s.h) + s.html + (i === 0 ? _s8hwFacts(r.specs) : '') + '\n      </section>';
  }).join('');
  return { header: header, body: body, sources: '' };
}
