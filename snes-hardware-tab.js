/* ===========================================================================
 * Super Nintendo hardware reference: the data behind the Hardware tab of every Super Nintendo
 * and Super Famicom cartridge. snesHardwareReference(catalogue) returns { header, body, sources }
 * in the shape of sega8HardwareReference (sega8-hardware-tab.js), so the caller can put its
 * per-cartridge and per-core sections between body and sources. Catalogue id: 'snes'.
 * SNES_HW.cartridgeNote and SNES_HW.emulatorNote are ready paragraphs for those two sections.
 *
 * Loaded by a plain <script src> tag (not fetch) so the site still opens from disk over
 * file://. Names here start with _snhw or SNES_HW so they cannot meet another file's.
 *
 * WRITING RULE: every figure comes from the Super Nintendo build chapters (the Emulation tab,
 * WASM_Source/snes-tabs/chapters/) or the research behind the emulator; where sources
 * disagree, or a value is not established, the text says so. No figure is guessed.
 * Site wording rules: plain English, Australian spelling, no em dash, no emulator names.
 * `sources` is an empty string: a list of sources is a public credit, and credits wait
 * for approval. WASM_Source/snes-tabs/build.mjs --check runs the public-text rules on this file.
 * ======================================================================== */

function _snhwTable(head, rows) {
  var th = head.map(function (h) { return '<th>' + h + '</th>'; }).join('');
  var tr = rows.map(function (r) { return '<tr>' + r.map(function (c) { return '<td>' + c + '</td>'; }).join('') + '</tr>'; }).join('');
  return '<div class="hw-table-wrap hw-table-scroll"><table class="hw-table"><thead><tr>' + th + '</tr></thead><tbody>' + tr + '</tbody></table></div>';
}
function _snhwFacts(rows) {
  return '<div class="factbox factbox-stacked">' + rows.map(function (r) { return '<div class="row"><span class="k">' + r[0] + '</span><span class="v">' + r[1] + '</span></div>'; }).join('') + '</div>';
}
function _snhwH(h) {
  return (typeof hwSectH === 'function') ? hwSectH(h) : '<h3 class="sect-h">' + h + '</h3>';
}
function _snhwP(s) { return '<p class="hw-readable">' + s + '</p>'; }

var SNES_HW = {
  title: 'Super Nintendo Entertainment System and Super Famicom',
  tag: 'Ricoh 5A22 (65C816 core), two picture chips, Sony S-SMP and S-DSP sound &middot; 1990',
  specs: [
    ['CPU', 'The S-CPU (Ricoh 5A22) with a 65C816 core: 3.58, 2.68 or 1.79 MHz by the memory it reaches'],
    ['Work RAM', '128 KB'],
    ['Video', 'Two chips, PPU1 and PPU2, with 64 KB of video RAM: 256 &times; 224 pixels (239 with overscan; 512 wide in hi-res, twice the lines interlaced), 256 colours on screen from 32,768, 128 sprites with 32 on a line, eight background modes including Mode 7'],
    ['Sound', 'The S-SMP (an SPC700 processor) and the S-DSP with 64 KB of their own RAM: eight voices of compressed samples, stereo, with echo'],
    ['Start-up firmware', 'None for the S-CPU: the cartridge runs from power-on. The sound processor has a 64-byte boot program'],
    ['Cartridges', 'Lo, Hi, ExLo and ExHi maps, battery save RAM, and chips on the cartridge: the SA-1, the Super FX, the S-DD1, the SPC7110 and the cartridge clocks play here'],
    ['Controls', 'Two controller ports. The standard pad has a d-pad, A, B, X, Y, L, R, Select and Start; the multitap, the mouse, the Super Scope and the Justifier also play here'],
    ['Regions', 'NTSC at 60.0988 pictures a second and PAL at 50.0070, each from its own master clock'],
  ],
  sections: [
    { h: 'The machine', html:
      _snhwP('The <b>Super Famicom</b> went on sale in Japan in <b>1990</b>, and the <b>Super Nintendo Entertainment System</b> in North America in <b>1991</b> and in Europe and Australia in <b>1992</b>. The Super Famicom and the Super Nintendo are the same console in different cases: Japanese and North American consoles are NTSC machines, and consoles sold in Europe and Australia are PAL machines with a slower master clock and 312 lines to a picture. Here the Super Famicom is the same wall as the Super Nintendo; the region a game starts in comes from its cartridge.') +
      _snhwP('The first consoles have the CPU and the two picture chips as three separate chips (the <b>3-chip</b> board). Later boards put all three into one chip (the <b>1-chip</b> board), which brightens the picture more slowly after a change of brightness and has a sharper picture output; the later, smaller consoles use it. Software cannot tell a 1-chip console from a 3-chip one. The chips also came in revisions: the S-CPU in two (its revision number is in $4210) and PPU2 in three, and they differ in a few timing details.') +
      _snhwP('The emulator runs either region. Its Machine menu offers the NTSC and PAL consoles, the 1-chip board of each, and the early Super Famicom (S-CPU revision 1, PPU2 version 1). Its default is an NTSC 3-chip console with S-CPU revision 2, PPU1 version 1 and PPU2 version 3, and every score in the Emulation tab names that machine.') },
    { h: 'CPU and memory', html:
      _snhwP('Everything runs from one crystal, the <b>master clock</b>: <b>21.477 MHz</b> on NTSC consoles (six times the NTSC colour carrier, exactly 236,250,000 / 11 Hz) and <b>21.281 MHz</b> on PAL. The S-CPU wraps a 65C816 core, a 16-bit descendant of the 6502 with a 24-bit address. It does not run at one speed: each memory access takes 6, 8 or 12 master clocks by the address it reaches, so the processor runs at 3.58, 2.68 or 1.79 MHz from moment to moment.') +
      _snhwTable(['Access', 'Master clocks', 'Speed (NTSC)'], [
        ['Registers at $2000 to $3FFF and $4200 to $5FFF; an internal step', '6', '3.58 MHz'],
        ['Fast cartridges in banks $80 to $FF, when the game sets $420D bit 0', '6', '3.58 MHz'],
        ['Work RAM, the other cartridge areas, and fast cartridges without $420D', '8', '2.68 MHz'],
        ['$4000 to $41FF, which holds the controller ports', '12', '1.79 MHz'],
      ]) +
      _snhwP('Beside the processor the S-CPU has <b>eight DMA channels</b>, which copy blocks to the picture and sound chips at 8 master clocks a byte, and <b>HDMA</b>, which uses the same channels to change picture registers on every line (the source of most wavy and gradient effects). It also has an 8 &times; 8-bit multiplier and a 16 &divide; 8-bit divider that give their answer a few steps later, timers that raise an interrupt at a chosen line and dot, and a unit that, when the game turns it on, reads both pads by itself at the start of every vertical blank.') +
      _snhwP('Work RAM is <b>128 KB</b>, at banks $7E and $7F, with its first 8 KB repeated at $0000 to $1FFF of banks $00 to $3F and $80 to $BF. Once every line the CPU is stopped for 40 master clocks while the work RAM refreshes. The picture and sound chips sit on a second, 8-bit bus (the B bus) reached through $2100 to $21FF.') },
    { h: 'Video: PPU1 and PPU2', html:
      _snhwP('The picture is made by two chips working as one. They hold three memories: <b>64 KB of video RAM</b> for tile maps and tiles, <b>CGRAM</b> with 256 colours of 15 bits (32,768 possible colours), and <b>OAM</b> with 128 sprites. A picture is 256 dots wide and 224 lines high (239 with overscan); modes 5 and 6 and the pseudo hi-res setting draw 512 dots across, and interlace doubles the lines to 448 or 478.') +
      _snhwTable(['Mode', 'Backgrounds and their colours'], [
        ['0', 'four backgrounds of 4 colours'],
        ['1', 'two of 16 colours and one of 4 (the mode most games use)'],
        ['2', 'two of 16 colours, each tile column scrolled on its own'],
        ['3', 'one of 256 colours and one of 16'],
        ['4', 'one of 256 colours and one of 4, with column scrolling'],
        ['5', 'one of 16 and one of 4 colours, 512 dots across'],
        ['6', 'one of 16 colours, 512 dots across, with column scrolling'],
        ['7', 'one 1024 &times; 1024 pixel picture of 256 colours that can be rotated, scaled and tilted (Mode 7)'],
      ]) +
      _snhwP('Sprites are 8 &times; 8 to 64 &times; 64 pixels in two sizes at a time. At most <b>32 sprites</b> and <b>34 rows of 8 sprite pixels</b> fit on a line; past that, sprites drop out and a flag is set. Two windows can cut each layer, and <b>colour maths</b> adds or subtracts a second screen or a fixed colour, which games use for transparency, shadows and fades. Mosaic, master brightness and direct colour complete the set.') +
      _snhwP('A line is 1,364 master clocks (340 dots), and the PPU works through it dot by dot, so a register written part way along a line changes the picture from that dot on. A field is 262 lines on NTSC and 312 on PAL.') },
    { h: 'Sound: the S-SMP and the S-DSP', html:
      _snhwP('Sound is a separate computer made by Sony, with its own clock: a ceramic resonator of nominally <b>24.576 MHz</b>. The <b>S-SMP</b> holds an <b>SPC700</b> 8-bit processor, three timers and four ports to the main CPU; the <b>S-DSP</b> makes the sound. They share <b>64 KB of audio RAM</b>, so a game first uploads its sound program and samples through the four ports.') +
      _snhwP('The S-DSP plays <b>eight voices</b> at once. Each voice reads samples packed 16 to a 9-byte block, smooths them with gaussian interpolation, and shapes them with an attack-decay-sustain-release or gain envelope; any voice can play noise instead or have its pitch moved by the voice before it. An <b>echo</b> with an 8-tap filter and its own area of audio RAM (up to 30 KB) gives the reverb many games are known for. The output is stereo at the resonator divided by 768: nominally 32,000 samples a second.') +
      _snhwP('Real consoles measure <b>32,030 to 32,160</b> samples a second, because the resonator is not exact. The emulator runs the sound at <b>32,040</b> samples a second, the reported average of real consoles, a chosen setting and not a measurement of one console.') },
    { h: 'Start-up firmware', html:
      _snhwP('The Super Nintendo has <b>no start-up program</b> for its main CPU: at power-on it reads the reset address from the cartridge and runs the game. The only firmware in the console is the sound processor&rsquo;s <b>64-byte boot program</b> (the IPL), which clears the first page of audio RAM, signals that it is ready and loads whatever the game sends through the ports.') +
      _snhwP('The emulator can run the console&rsquo;s own boot program, chosen by its SHA-256. The play window runs the emulator&rsquo;s own boot program, written from the documented upload protocol, which takes the same steps; another emulator&rsquo;s copy is never used.') +
      _snhwP('Several cartridge chips carry a program of their own inside the chip: the DSP-1, DSP-2, DSP-3 and DSP-4 (a program and a data image), the Cx4 (a 3 KB data table), the ST010 and ST011, and the ST018. Those images are identified by their SHA-256 like the boot program. These chips are not run here yet. The SA-1 and the Super FX need no such image: their programs are on the cartridge.') },
    { h: 'Cartridges and boards', html:
      _snhwP('A cartridge is a board wired to the 24-bit address bus by its own decoding. Most boards follow one of four maps:') +
      _snhwTable(['Map', 'Where the game appears', 'Save RAM'], [
        ['Lo', '32 KB in the upper half of each bank, banks $00 to $7D and $80 to $FF', 'banks $70 to $7D and $F0 to $FF'],
        ['Hi', 'whole 64 KB banks at $40 to $7D and $C0 to $FF, with their upper halves also in banks $00 to $3F and $80 to $BF', '8 KB windows at $6000 to $7FFF of banks $20 to $3F and $A0 to $BF'],
        ['ExLo', 'as Lo, with a second 4 MB', 'as Lo'],
        ['ExHi', 'as Hi, with a second 4 MB (games up to 8 MB)', 'banks $80 to $BF at $6000 to $7FFF'],
      ]) +
      _snhwP('The header inside the game does not reliably say how the board is wired, so the emulator takes the board from a <b>table keyed by the game&rsquo;s SHA-256</b>: 1,190 game rows and 150 boards. For a game the table does not know, it scores the four header places and reads the board from the best one. A 512-byte copier header is skipped, and copier files stored in another order are put back. Save RAM with a battery is written to the game&rsquo;s save soon after the game changes it, and a save state never replaces it.') +
      _snhwP('Some boards carry a chip that does work for the console. Here is where each one stands:') +
      _snhwTable(['Chip', 'What it does', 'Games', 'Here'], [
        ['SA-1', 'a second 65C816 at 10.74 MHz with 2 KB of fast RAM, its own DMA, a maths unit and a timer', 'about 35, among them Super Mario RPG, Kirby Super Star and Kirby&rsquo;s Dream Land 3', 'plays'],
        ['Super FX (MARIO chip, GSU-1, GSU-2)', 'a 16-bit processor that draws pictures into cartridge RAM for the console to show', 'Star Fox, Stunt Race FX, Vortex, Dirt Trax FX, Dirt Racer, Yoshi&rsquo;s Island, Doom, Winter Gold', 'plays'],
        ['DSP-1, DSP-1B, DSP-2, DSP-3, DSP-4', 'a NEC signal processor with a fixed maths program', 'about 19 with the DSP-1 (Super Mario Kart, Pilotwings); one each with the others (Dungeon Master, SD Gundam GX, Top Gear 3000)', 'plays: the chip runs its own program'],
        ['Cx4', 'a Hitachi processor that runs code from the cartridge, with a 3 KB maths table', 'Mega Man X2 and Mega Man X3', 'plays: the chip runs its own program from the cartridge'],
        ['S-DD1', 'a graphics decompressor on the DMA path', 'Street Fighter Alpha 2 and Star Ocean', 'plays'],
        ['SPC7110', 'a decompressor and data port, with a clock chip on one board', 'three games, among them Tengai Makyou Zero', 'plays'],
        ['OBC1', 'a sprite table helper', 'Metal Combat', 'plays'],
        ['ST010, ST011, ST018', 'a faster NEC processor (ST010, ST011) and an ARM processor (ST018)', 'one each: F1 Race of Champions II and the two Hayazashi Nidan Morita Shogi games', 'plays: each chip runs its own program'],
        ['S-RTC, Epson RTC-4513', 'clock chips', 'Dai Kaijuu Monogatari II (S-RTC); Tengai Makyou Zero (Epson)', 'plays: the clock runs from the play window&rsquo;s time and is kept with the battery save'],
      ]) +
      _snhwP('The four competition cartridges, which carry a second chip beside a DSP-1, are not supported: the play window names the board instead of starting it. The Super Game Boy, Satellaview and Sufami Turbo base cartridges are refused by name.') },
    { h: 'Controllers', html:
      _snhwP('The console has two controller ports. The standard pad has a d-pad, <b>A, B, X, Y</b>, the <b>L and R</b> shoulder buttons, <b>Select</b> and <b>Start</b>: twelve buttons, read as 16 bits one at a time, in the order B, Y, Select, Start, Up, Down, Left, Right, A, X, L, R and four bits that are always 0.') +
      _snhwP('Other devices plug into the same ports, and all four play here: the <b>multitap</b> (up to five players), the <b>mouse</b> (Mario Paint and many others), and the <b>Super Scope</b> and <b>Justifier</b> light guns. A game finds out what is plugged in from the identity bits each device sends after its buttons.') +
      _snhwP('The play window plugs in what the cartridge needs: the mouse in port 1 for Mario Paint, the Super Scope in port 2 for Super Scope 6 and the other games made only for it, the Justifier in port 2 for Lethal Enforcers, and a pad in each port otherwise. <b>Controller port 1</b> and <b>Controller port 2</b> in the play window&rsquo;s settings change that. The multitap goes in either port (players 2 to 5 behind port 2, or players 1 to 4 behind port 1), and the light guns work only in port 2, as on the console.') +
      _snhwP('You aim a light gun by pointing at the picture with the mouse or a finger; a crosshair shows where it aims. The left mouse button or a touch fires; on the Super Scope the right button is the cursor and the middle one pauses, and on the Justifier the right button is Start. The mouse moves when you drag on the picture, or a double click hands it your own mouse until you press Escape. On a multitap, players 3, 4 and 5 have keys of their own (the numeric keypad, the Home and End block, and the keys around P), and players 3 and 4 can also use the third and fourth game controllers. Lethal Enforcers plays with two Justifiers: the second gun, in pink, is aimed by a second finger on a touch screen, or by player 2&rsquo;s keys or the second game controller.') },
  ],
  cartridgeNote: 'The header inside a Super Nintendo game names the game and its country, but it does not reliably say how the board is wired. The play window looks the game up by its SHA-256 in a table of known boards, and where the table is silent it reads the board from the header. The region the game starts in, NTSC or PAL, comes from the same place. A battery save is kept for every game whose board has one.',
  emulatorNote: 'One emulator plays the Super Nintendo and the Super Famicom. It is written in C and compiled to WebAssembly, runs one whole picture per step, and keeps every chip in step with the main CPU at every access the chip can see. The SA-1, Super FX, S-DD1 and SPC7110 chips and the cartridge clocks run inside it. How it is built and checked, chip by chip, is in the Emulation tab.',
};

/* The console-wide part of a Super Nintendo Hardware tab: header, spec box, every reference
   section. Returns { header, body, sources } (sources is ''), or null for another id. */
function snesHardwareReference(catalogue) {
  if (catalogue !== 'snes') return null;
  var r = SNES_HW;
  var header = '\n      <div class="hw-chip-header">\n        <h2>' + r.title + '</h2>\n        <p class="hw-chip-tag">' + r.tag + '</p>\n      </div>';
  var body = r.sections.map(function (s, i) {
    return '\n      <section class="sect">' + _snhwH(s.h) + s.html + (i === 0 ? _snhwFacts(r.specs) : '') + '\n      </section>';
  }).join('');
  return { header: header, body: body, sources: '' };
}
