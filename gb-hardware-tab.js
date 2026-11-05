/* ===========================================================================
 * Game Boy and Game Boy Color: the Hardware tab.
 *
 * Replaces the short spec-box version that lived inline in index.html. Same
 * shape and styling as the Pokémon mini tab (pmHardwareTabHTML), which is the
 * model: a run of prose sections with their headings, tables where a
 * table is clearer, and a Sources list at the end.
 *
 * WRITING RULES FOR THIS FILE
 *   - Every figure comes from a named public source in GB_HW_SOURCES. Where a
 *     number matters it was checked against at least two of them; where the
 *     sources disagree (the DMG's weight, the CPU's name) the page says so.
 *   - Plain English, British spelling, no long dashes.
 *   - No emulator names. The page is about the machine.
 *
 * One function serves both catalogues: a Game Boy Color title (d.system ===
 * 'gbc') gets the Color header and its Color section first; everything else
 * gets the original Game Boy header. The body is the same family write-up,
 * because a Color is a Game Boy with additions, not a different machine.
 * ======================================================================== */

/* A plain table. `wrapCols` lists the column indexes holding sentences, which
   are allowed to wrap (.hw-table is nowrap by default, which suits numbers and
   addresses but turns a sentence into a sideways scroll on a phone). */
function gbhwTable(head, rows, opts) {
  opts = opts || {};
  const wrap = new Set(opts.wrapCols || []);
  const mono = new Set(opts.monoCols || []);
  const th = head.map(h => `<th>${h}</th>`).join('');
  const tb = rows.map(r => '<tr>' + r.map((c, i) => {
    const style = wrap.has(i) ? ' style="white-space:normal;min-width:220px"' : '';
    const v = mono.has(i) ? `<span class="hw-mono-inline">${c}</span>` : c;
    return `<td${style}>${v}</td>`;
  }).join('') + '</tr>').join('');
  return `<div class="hw-table-wrap${opts.scroll ? ' hw-table-scroll' : ''}" style="margin:12px 0 10px"><table class="hw-table"><thead><tr>${th}</tr></thead><tbody>${tb}</tbody></table></div>`;
}

const GB_HW_SPECS_DMG = [
  { k:'CPU',          v:'Sharp SM83 core inside the DMG-CPU chip, 4.194304 MHz (2<sup>22</sup> Hz), about 1.05 million machine cycles a second' },
  { k:'Work RAM',     v:'8 KB, on its own chip beside the CPU' },
  { k:'Video RAM',    v:'8 KB, also a separate chip' },
  { k:'Other RAM',    v:'127 bytes of fast "high RAM" and 160 bytes of sprite memory, both inside the CPU' },
  { k:'Boot program', v:'256 bytes, inside the CPU, unmapped once it hands over to the cartridge' },
  { k:'Screen',       v:'160 × 144, four shades, reflective STN LCD with no backlight, 59.73 frames a second' },
  { k:'Sprites',      v:'40 on screen, at most 10 on one line, 8 × 8 or 8 × 16' },
  { k:'Sound',        v:'4 channels: 2 pulse, 1 programmable wave, 1 noise. Mono speaker, stereo on headphones' },
  { k:'Cartridge',    v:'32 KB without a mapper; up to 8 MB with one (MBC5)' },
  { k:'Link',         v:'Serial port at 8,192 bits a second' },
  { k:'Power',        v:'4 × AA (about 30 hours) or 6 V DC, 0.7 W' },
  { k:'Size',         v:'90 × 148 × 32 mm' },
];

const GB_HW_SPECS_CGB = [
  { k:'CPU',          v:'The same SM83 core inside the CPU CGB chip, 4.194304 MHz or 8.388608 MHz in double-speed mode' },
  { k:'Work RAM',     v:'32 KB: eight 4 KB banks, one fixed and one switchable at a time' },
  { k:'Video RAM',    v:'16 KB: two 8 KB banks, now inside the CPU chip' },
  { k:'Boot program', v:'2 KB, in two parts either side of the cartridge header' },
  { k:'Screen',       v:'160 × 144 colour TFT LCD, 15-bit colour (32,768), 56 colours from the palettes at once' },
  { k:'Palettes',     v:'8 background and 8 sprite palettes of 4 colours, in their own palette RAM' },
  { k:'Sound',        v:'Unchanged from the Game Boy' },
  { k:'Extras',       v:'DMA straight into video RAM, a faster link port, an infrared port' },
  { k:'Power',        v:'2 × AA (about 10 hours) or 3 V DC, 0.6 W' },
  { k:'Size',         v:'133.5 × 78 × 27.4 mm, 138 g' },
];

const GB_HW_SOURCES = [
  '<b>Pan Docs</b>, the community\'s main Game Boy reference, maintained by gbdev (<a href="https://gbdev.io/pandocs/" target="_blank" rel="noopener">gbdev.io/pandocs</a>). Used for the specification table, memory map, PPU modes and timing, palettes, sprites, sound, the cartridge header, every MBC, the CGB registers, the link port, the Super Game Boy, the boot programs, the Printer, Camera and 4-player adapter, and the OAM, HALT and STAT quirks.',
  '<b>Gekkio, Game Boy: Complete Technical Reference</b> (<a href="https://gekkio.fi/files/gb-docs/gbctr.pdf" target="_blank" rel="noopener">gekkio.fi/files/gb-docs/gbctr.pdf</a>). Source for the SM83 identification and its history in Sharp\'s data books, and for the chip name in each model.',
  '<b>Game Boy hardware database</b> by Gekkio (<a href="https://gbhwdb.gekkio.fi/" target="_blank" rel="noopener">gbhwdb.gekkio.fi</a>), built from photographs of real boards sent in by owners. Source for the CPU revision letters, mainboard revisions and the RAM, amplifier and LCD-bias parts named here.',
  '<b>Rodrigo Copetti, "Game Boy / Color Architecture"</b> (<a href="https://www.copetti.org/writings/consoles/game-boy/" target="_blank" rel="noopener">copetti.org</a>). Used to corroborate the memory sizes, the PPU layers, the link speeds and the Color additions.',
  '<b>Wikipedia</b>, "<a href="https://en.wikipedia.org/wiki/Game_Boy" target="_blank" rel="noopener">Game Boy</a>", "<a href="https://en.wikipedia.org/wiki/Game_Boy_Color" target="_blank" rel="noopener">Game Boy Color</a>" and "<a href="https://en.wikipedia.org/wiki/Super_Game_Boy" target="_blank" rel="noopener">Super Game Boy</a>". Used only for the commercial and physical facts: dates, prices, sizes, weights, battery life, sales, colours and the Super Game Boy\'s speed difference.',
];

function gbHardwareTabHTML(d) {
  const isCGB = d && d.system === 'gbc';
  const rowsOf = list => list.map(r => `<div class="row"><span class="k">${r.k}</span><span class="v">${r.v}</span></div>`).join('');
  const feats = (d.features && d.features.length) ? d.features.map(f => `<li>${f}</li>`).join('') : '<li>No special hardware listed</li>';

  const models = gbhwTable(
    ['Model', 'Code', 'Released', 'Chip', 'Screen', 'Power', 'Notes'],
    [
      ['Game Boy', 'DMG-01', 'Apr 1989 Japan, Jul 1989 N. America, Sep 1990 Europe', 'DMG-CPU, revisions A, B, C', 'Reflective STN, green tint', '4 × AA, ~30 h', 'The original. Contrast wheel, volume wheel, one speaker, headphone socket.'],
      ['Play It Loud!', 'DMG-01', 'Mar 1995', 'DMG-CPU', 'As above', 'As above', 'The same machine in red, yellow, green, blue, black, white and clear shells.'],
      ['Game Boy Pocket', 'MGB-001', 'Jul 1996 Japan, Sep 1996 N. America', 'CPU MGB', 'FSTN, true black on grey', '2 × AAA, ~10 h', 'Smaller and 125 g. The first production run had no power light; a later revision added one.'],
      ['Game Boy Light', 'MGB-101', 'Apr 1998, Japan only', 'CPU MGB', 'FSTN with electroluminescent backlight', '2 × AA, ~12 h lit, ~20 h unlit', 'The only backlit Game Boy before the Advance SP.'],
      ['Super Game Boy', 'SNES cartridge', 'Jun 1994 Japan and N. America, Sep 1994 Europe', 'SGB-CPU 01 plus an ICD2 interface chip', 'Your television, via the SNES', 'From the SNES', 'A whole Game Boy in a cartridge. Runs about 2.4% fast on NTSC (see below).'],
      ['Super Game Boy 2', 'SNES cartridge', 'Jan 1998, Japan only', 'CPU SGB2', 'Your television', 'From the SNES', 'Its own crystal, so correct speed, and a link port.'],
      ['Game Boy Color', 'CGB-001', 'Oct 1998 Japan, Nov 1998 N. America and Europe', 'CPU CGB, revisions up to E', 'Colour TFT, no backlight', '2 × AA, ~10 h', 'Plays nearly every older cartridge. 138 g.'],
    ],
    { wrapCols: [2, 3, 4, 6] }
  );

  const memMap = gbhwTable(
    ['Range', 'Size', 'What is there'],
    [
      ['$0000–$3FFF', '16 KB', 'Cartridge program memory, bank 0. Usually fixed. The boot program sits over the bottom of it at power-on.'],
      ['$4000–$7FFF', '16 KB', 'Cartridge program memory, switchable bank (selected by the MBC, if there is one)'],
      ['$8000–$9FFF', '8 KB', 'Video RAM: tile graphics and two 32 × 32 tile maps. On a Color, two banks.'],
      ['$A000–$BFFF', '8 KB', 'Cartridge RAM, usually battery-backed, often banked. Also where MBC clocks and sensors appear.'],
      ['$C000–$CFFF', '4 KB', 'Work RAM, bank 0'],
      ['$D000–$DFFF', '4 KB', 'Work RAM, bank 1 (banks 1–7 on a Color)'],
      ['$E000–$FDFF', '7.5 KB', 'Echo RAM: a mirror of $C000–$DDFF. Nintendo said not to use it.'],
      ['$FE00–$FE9F', '160 B', 'Sprite attribute memory (OAM): 40 sprites × 4 bytes'],
      ['$FEA0–$FEFF', '96 B', 'Not usable. What it reads back differs between models (see Quirks).'],
      ['$FF00–$FF7F', '128 B', 'Hardware registers: buttons, link, timer, sound, LCD, and the Color\'s extra registers'],
      ['$FF80–$FFFE', '127 B', 'High RAM. The only memory the CPU can use while a sprite DMA runs.'],
      ['$FFFF', '1 B', 'Interrupt enable register'],
    ],
    { wrapCols: [2], monoCols: [0] }
  );

  const irqs = gbhwTable(
    ['Interrupt', 'Vector', 'Raised by'],
    [
      ['VBlank', '$0040', 'The screen finishing a frame. The safe moment to update graphics.'],
      ['LCD STAT', '$0048', 'A chosen PPU mode starting, or the line counter LY matching LYC. Used for mid-screen effects.'],
      ['Timer', '$0050', 'The TIMA counter overflowing'],
      ['Serial', '$0058', 'A link-cable byte finishing'],
      ['Joypad', '$0060', 'A button being pressed (also wakes the CPU from STOP)'],
    ],
    { wrapCols: [2], monoCols: [1] }
  );

  const ppuModes = gbhwTable(
    ['Mode', 'Name', 'Length', 'CPU can reach'],
    [
      ['2', 'OAM scan: find the sprites on this line', '80 dots', 'Video RAM; on a Color, palettes'],
      ['3', 'Drawing: sending pixels to the LCD', '172–289 dots, depending on scroll, window and sprites', 'Nothing'],
      ['0', 'HBlank: rest of the line', '376 dots minus mode 3', 'Video RAM, OAM, palettes'],
      ['1', 'VBlank: lines 144–153', '4,560 dots (10 lines)', 'Video RAM, OAM, palettes'],
    ],
    { wrapCols: [1, 2] }
  );

  const sound = gbhwTable(
    ['Channel', 'Type', 'What it can do'],
    [
      ['1', 'Pulse with sweep', 'Square-ish wave at 12.5%, 25%, 50% or 75% duty. 11-bit pitch, volume envelope, length timer, and a sweep unit that slides the pitch up or down by itself.'],
      ['2', 'Pulse', 'The same without the sweep.'],
      ['3', 'Wave', 'Plays 32 four-bit samples from wave RAM at $FF30–$FF3F, so the game draws its own waveform. Volume is only 0%, 25%, 50% or 100%.'],
      ['4', 'Noise', 'A linear-feedback shift register, 15 bits long for hiss or 7 bits for a metallic buzz. Envelope and length timer.'],
    ],
    { wrapCols: [2] }
  );

  const mbcs = gbhwTable(
    ['Controller', 'Program memory up to', 'RAM up to', 'Notes and examples'],
    [
      ['None', '32 KB', '8 KB (rare)', 'Tetris, Dr. Mario and other early games. The whole game is visible at once.'],
      ['MBC1', '2 MB', '32 KB', 'The first common mapper. The full 2 MB and the full 32 KB cannot be had on one cartridge: the extra two bank bits go to one or the other. A rewired "MBC1M" form was used for multi-game cartridges.'],
      ['MBC2', '256 KB', '512 × 4 bits, built in', 'Carries its own tiny RAM, of which only the low 4 bits of each byte exist.'],
      ['MBC3', '2 MB', '32 KB', 'Adds an optional real-time clock with its own crystal: seconds, minutes, hours and a 9-bit day counter (0–511). Pokémon Gold, Silver and Crystal.'],
      ['MBC30', '4 MB', '64 KB', 'A doubled MBC3, used by the Japanese Pokémon Crystal.'],
      ['MBC5', '8 MB', '128 KB', 'The first controller Nintendo guaranteed for the Color\'s double speed. The rumble version drives a motor from one of the RAM-bank bits; Pokémon Pinball pulses it to vary the strength.'],
      ['MBC6', 'n/a', 'n/a', 'Flash memory for downloaded content; used by one Japanese game, Net de Get.'],
      ['MBC7', 'n/a', '256 B EEPROM (93LC56)', 'Two-axis accelerometer (ADXL202E) for tilt games: Kirby Tilt \'n\' Tumble.'],
      ['MMM01', 'n/a', 'n/a', 'A controller for multi-game cartridges.'],
      ['Hudson HuC1, HuC3', 'n/a', 'n/a', 'Hudson\'s own controllers. Both add an infrared LED; HuC3 adds a clock and a speaker.'],
      ['Pocket Camera (MAC-GBD)', '1 MB', '128 KB', 'The Game Boy Camera\'s controller, which also talks to the image sensor.'],
      ['Bandai TAMA5', 'n/a', 'n/a', 'Tamagotchi 3, with a clock.'],
    ],
    { wrapCols: [3] }
  );

  const header = gbhwTable(
    ['Address', 'Field', 'What it does'],
    [
      ['$0100–$0103', 'Entry point', 'Where the CPU goes when the boot program finishes. Almost always a NOP and a jump.'],
      ['$0104–$0133', 'Nintendo logo', '48 bytes of bitmap. The boot program draws it and compares it; if one byte is wrong, the machine stops.'],
      ['$0134–$0143', 'Title', 'Upper-case ASCII, 16 characters on early cartridges, shorter on later ones'],
      ['$013F–$0142', 'Manufacturer code', 'Four characters on later cartridges; purpose not known'],
      ['$0143', 'Color flag', '$80 = works on both; $C0 = Game Boy Color only'],
      ['$0144–$0145', 'New licensee code', 'Two-character publisher code'],
      ['$0146', 'SGB flag', '$03 = uses Super Game Boy features'],
      ['$0147', 'Cartridge type', 'Which mapper, and whether there is RAM, a battery, a clock or rumble'],
      ['$0148', 'Program size', '32 KB × 2<sup>n</sup>'],
      ['$0149', 'RAM size', 'Cartridge RAM fitted'],
      ['$014A', 'Destination', '$00 Japan, $01 everywhere else. Nothing enforces it.'],
      ['$014B', 'Old licensee code', '$33 means "see the new code"'],
      ['$014C', 'Version', 'Usually $00'],
      ['$014D', 'Header checksum', 'Checked by the boot program; a wrong value stops the machine'],
      ['$014E–$014F', 'Global checksum', 'Sum of the whole cartridge image. The console never checks it.'],
    ],
    { wrapCols: [2], monoCols: [0] }
  );

  const boots = gbhwTable(
    ['Boot program', 'Size', 'Checks the logo?', 'Notes'],
    [
      ['DMG0', '256 B', 'Yes', 'Very early Japanese units. Blinks the screen on failure instead of hanging.'],
      ['DMG', '256 B', 'Yes', 'The familiar scroll-down logo and "ba-ding" chime, then the header checksum'],
      ['MGB', '256 B', 'Yes', 'One byte different, so a game can tell it is on a Pocket'],
      ['SGB, SGB2', '256 B', 'No', 'Passes the header to the SNES side, which shows its own start-up screen'],
      ['CGB0, CGB', '2 KB', 'Yes', 'The Color logo animation; also chooses a colour palette for older games'],
      ['AGB0, AGB', '2 KB', 'Yes', 'The Game Boy Advance\'s copy, one instruction different so games can tell it apart'],
    ],
    { wrapCols: [3] }
  );

  const physical = gbhwTable(
    ['', 'Game Boy (DMG)', 'Game Boy Pocket', 'Game Boy Light', 'Game Boy Color'],
    [
      ['Screen', 'STN, greenish, about 2.5 in diagonal', 'FSTN, black and white', 'FSTN, backlit', 'Colour TFT, about 2.3 in diagonal'],
      ['Batteries', '4 × AA', '2 × AAA', '2 × AA', '2 × AA'],
      ['Battery life', 'About 30 h', 'About 10 h', 'About 12 h lit, 20 h unlit', 'About 10 h'],
      ['External power', '6 V DC', '3 V DC', '3 V DC', '3 V DC'],
      ['Size', '90 × 148 × 32 mm', 'n/a', 'n/a', '133.5 × 78 × 27.4 mm'],
      ['Weight', '220 g without batteries, about 300 g with', '125 g', 'n/a', '138 g'],
    ],
    { wrapCols: [1, 2, 3, 4] }
  );

  const colorSection = `
      <section class="sect">${hwSectH('Game Boy Color: what changed')}
        <p class="hw-readable">The Game Boy Color, launched in October 1998, keeps the original's CPU core, sound hardware, screen size and cartridge slot, and adds to them rather than replacing them. The new chip, <b>CPU CGB</b>, went through revisions up to <b>E</b>; it carries the 16 KB of video RAM on the die, with the 32 KB of work RAM on a separate Sharp chip beside it.</p>
        <p class="hw-readable"><b>Double speed.</b> Setting bit 0 of the KEY1 register and then executing STOP switches the CPU from 4.19 MHz to <b>8.39 MHz</b>. The timer, divider, link port and sprite DMA speed up with it. The PPU, the new video RAM DMA and the sound do not, so the picture and the music keep their timing while the game logic gets twice the time.</p>
        <p class="hw-readable"><b>More memory.</b> Work RAM grows to 32 KB as eight 4 KB banks: bank 0 is always at $C000, and the SVBK register picks which of banks 1–7 appears at $D000 (asking for bank 0 gives bank 1). Video RAM doubles to two 8 KB banks, selected by VBK.</p>
        <p class="hw-readable"><b>Colour.</b> Colours are 15-bit, five bits each of red, green and blue, so 32,768 in all. There are <b>8 background palettes of 4 colours and 8 sprite palettes of 3 colours</b> (colour 0 of a sprite is transparent), held in their own palette RAM and written through index and data registers that can step forward on each write. That gives <b>56 colours on screen</b> from the palettes as set; games that rewrite palettes during the frame get more. The second video RAM bank holds an attribute byte for every background tile, choosing its palette, which video RAM bank its graphics come from, horizontal and vertical flip, and whether it is drawn over sprites. Sprites gain a palette number and a bank bit too.</p>
        <p class="hw-readable"><b>Video RAM DMA.</b> Two new modes copy data straight into video RAM. General-purpose DMA copies a block of up to 2 KB at once while the CPU waits. HBlank DMA copies <b>16 bytes at the end of each visible line</b>, so a game can stream new graphics in during play without stopping.</p>
        <p class="hw-readable"><b>Links.</b> The serial port gains faster clocks: 8,192, 16,384, 262,144 or 524,288 bits a second depending on a bit in its control register and the speed mode. There is also an <b>infrared port</b> at $FF56, an LED and a receiver on the top of the case, used by Pokémon for Mystery Gift and by a few other games.</p>
        <p class="hw-readable"><b>Playing older cartridges.</b> A cartridge whose header byte $0143 is not $80 or $C0 runs in compatibility mode. The boot program gives it colours: for games published by Nintendo it hashes the title and looks up a hand-picked palette, and for any game the player can override the choice by holding a direction, optionally with A or B, while the logo plays, giving <b>12 preset palettes</b>. A handful of old games that relied on quirks of the original hardware behave differently on a Color (see Quirks).</p>
        <p class="hw-readable"><b>The screen.</b> The Color's LCD mixes colours non-linearly and its pigments are not very saturated, so a raw RGB value does not look the same on it as on a modern monitor, and Game Boy Color games tend to look washed out or over-bright when shown unaltered. Games written later for the Game Boy Advance's brighter screen often detect it and switch palettes.</p>
      </section>`;

  return `
    <div class="hw-tab">
      <div class="hw-chip-header">
        <h2>${isCGB ? 'Game Boy Color' : 'Game Boy'}</h2>
        <p class="hw-chip-tag">${isCGB
          ? 'Nintendo CGB-001: the Game Boy\'s Sharp SM83 core at up to 8.39 MHz, 15-bit colour, 32 KB of work RAM · 1998'
          : 'Nintendo DMG-01: a Sharp SM83 core at 4.19 MHz, a 160 × 144 four-shade LCD and four sound channels · 1989'}</p>
      </div>
      ${isCGB && typeof hwDiagramHTML === 'function' ? hwDiagramHTML('gbc') : ''}

      <section class="sect">${hwSectH('The machine')}
        <p class="hw-readable">The Game Boy came out of Nintendo's R&amp;D1, led by <b>Gunpei Yokoi</b> with <b>Satoru Okada</b> doing much of the engineering. It is the clearest example of Yokoi's "lateral thinking with withered technology": a cheap, mature reflective LCD with no backlight, an 8-bit processor of a kind that was already old in 1989, and four AA cells that lasted about thirty hours when colour-screened rivals managed a fraction of that. It launched in Japan on 21 April 1989 at ¥12,500, in North America that July at US$89.99 with Tetris in the box, and in Europe in September 1990. Counting the Game Boy and the Game Boy Color together, <b>118.69 million</b> were sold before production ended in March 2003.</p>
        <p class="hw-readable">Almost the whole machine is one chip. The DMG-CPU holds the processor core, the picture processor, the sound generator, the timer, the link port, the boot program and a little fast RAM; outside it there are only the two 8 KB RAM chips, an audio amplifier, the LCD and its driver board, and the cartridge. Later models shrank this further: the Pocket and Light use a single CPU MGB chip, and the Color's CPU CGB takes the video RAM inside as well.</p>
        <div class="factbox factbox-stacked">${rowsOf(isCGB ? GB_HW_SPECS_CGB : GB_HW_SPECS_DMG)}</div>
      </section>

      <section class="sect">${hwSectH('Models and revisions')}
        <p class="hw-readable">Every handheld below, and the Super Game Boy, runs the same software model. The differences are the screen, the power, the size and a few small behaviours a game can detect. Chip names are as printed on the parts, from the community hardware database.</p>
        ${models}
        <p class="hw-readable">Inside the original DMG there were <b>eight mainboard revisions</b> (DMG-CPU-01 to -08) and <b>four CPU markings</b>: DMG-CPU, then A, B and C, with some late B and C chips mounted as an epoxy "blob" directly on the board. The Color had six mainboards (CGB-CPU-01 to -06) and its CPU went from no letter through A, B, C, D to E. A few behaviours differ between these revisions, which is how test cartridges written by the community can tell them apart.</p>
      </section>

      ${isCGB ? colorSection : ''}

      <section class="sect">${hwSectH('The processor')}
        <p class="hw-readable">The CPU is usually called the <b>LR35902</b> in older documents, a name of uncertain origin that does not appear on any chip. The more careful community references now identify the core as Sharp's <b>SM83</b>: Sharp's own microcomputer data books of 1990 and 1996 list an SM83 core in chips meant for air conditioners and home appliances, and its description matches the Game Boy's. It is an 8-bit core with a 16-bit address bus.</p>
        <p class="hw-readable">It is often described as a modified Z80, and it is not. It looks like a cut-down Z80 to a programmer: registers A, F, B, C, D, E, H and L, pairable as AF, BC, DE and HL, plus a 16-bit stack pointer and program counter, with flags for zero, subtract, half-carry and carry. But it has none of the Z80's second register set, no IX or IY index registers, no separate I/O ports and most of its prefixed instructions are missing. In their place it adds a few of its own: <span class="hw-mono-inline">LDH</span> for fast access to the top page of memory where the hardware registers live, <span class="hw-mono-inline">LD (HL+)</span> and <span class="hw-mono-inline">LD (HL-)</span> which move a byte and step the pointer, and <span class="hw-mono-inline">SWAP</span> to exchange the two halves of a byte. The inside of the chip is a different design from Zilog's, and instruction timings do not match the Z80's either.</p>
        <p class="hw-readable">The crystal runs at <b>4,194,304 Hz</b>, exactly 2<sup>22</sup>. Instructions take a whole number of <b>machine cycles</b> of four clocks each, so the CPU really does about 1.05 million basic steps a second. The divider register DIV ticks at 16,384 Hz, and the programmable timer TIMA can count at 4,096, 16,384, 65,536 or 262,144 Hz.</p>
        <p class="hw-readable">There are five interrupt sources, each with a fixed address to jump to:</p>
        ${irqs}
        <p class="hw-readable">HALT stops the CPU until an interrupt arrives and is how games save batteries between frames. STOP goes further, stopping the clock almost entirely until a button is pressed; on a Color it is also the instruction that changes speed.</p>
      </section>

      <section class="sect">${hwSectH('Memory map')}
        <p class="hw-readable">The CPU sees 64 KB. Half of it is the cartridge's program memory, split into a fixed 16 KB and a switchable 16 KB window, which is why almost every game larger than 32 KB carries a memory bank controller (MBC) to choose what appears in that window.</p>
        ${memMap}
      </section>

      <section class="sect">${hwSectH('The picture: tiles, maps, window and sprites')}
        <p class="hw-readable">There is no frame buffer. The picture processor (PPU) builds each line as it goes from three things in video RAM: <b>tiles</b>, which are 8 × 8 pixel blocks at 2 bits a pixel (16 bytes each); <b>tile maps</b>, two grids of 32 × 32 tile numbers; and the <b>sprite table</b> in OAM. Video RAM has room for 384 tiles.</p>
        <p class="hw-readable">Three layers are drawn. The <b>background</b> is a 256 × 256 pixel map that can be scrolled to any position and wraps at the edges. The <b>window</b> is a second map that is not scrolled; it is placed at a position on screen and covers the background from there to the bottom-right corner, which is how status bars and dialogue boxes are done. The <b>sprites</b> are up to 40 objects of 8 × 8 or 8 × 16 pixels, each with an X and Y position, a tile number, flips, a palette choice and a flag to put it behind the background.</p>
        <p class="hw-readable">The PPU can only fetch <b>10 sprites on any one line</b>. Extra ones are dropped, which is where Game Boy flicker comes from when games rotate which sprites are drawn. On the original Game Boy, when sprites overlap, the one further left wins, then the one earlier in the table; on a Color running Color software only the table order counts.</p>
        <p class="hw-readable">On the original, colour is just four shades. One register, BGP, says which shade each of the four background colour numbers means; two more, OBP0 and OBP1, do the same for sprites, where colour 0 is always transparent. Fading the screen in and out is done by rewriting these three registers.</p>
        <p class="hw-readable">Rewriting video RAM while it is in use is blocked rather than merely discouraged: during the drawing mode the CPU reads $FF from video RAM and its writes are ignored. Sprite memory is easiest to fill with <b>OAM DMA</b>, which copies 160 bytes from anywhere into OAM in 160 machine cycles; while it runs the CPU can only use high RAM, so every game keeps a tiny copy routine there.</p>
      </section>

      <section class="sect">${hwSectH('Screen timing and PPU modes')}
        <p class="hw-readable">A line lasts <b>456 dots</b> (one dot per clock at normal speed). A frame is <b>154 lines</b>: 144 visible and 10 of vertical blanking. That is <b>70,224 clocks a frame</b>, which at 4,194,304 Hz comes to <b>59.73 frames a second</b>, not 60. Each line passes through these modes, and the STAT register reports which one is current:</p>
        ${ppuModes}
        <p class="hw-readable">The drawing mode is not a fixed length. It starts at 172 dots and grows with fine horizontal scroll, the window starting part-way across, and each sprite on the line, up to about 289; the HBlank after it shrinks to match. That is why code that changes registers part-way down the screen has to be written with care, and why accurate timing of the PPU is the hardest part of reproducing this machine.</p>
        <p class="hw-readable">The LCD must only be switched off during vertical blanking. Nintendo's documentation warned that switching it off mid-frame could damage the screen, and games are written to wait for line 144 before doing so.</p>
      </section>

      <section class="sect">${hwSectH('Sound')}
        <p class="hw-readable">The sound hardware has four channels and has hardly changed across the whole family; the Color uses it as it was.</p>
        ${sound}
        <p class="hw-readable">A <b>frame sequencer</b> running at 512 Hz drives the slow parts: length timers tick at 256 Hz, the sweep at 128 Hz and the volume envelopes at 64 Hz. Each channel can be sent to the left output, the right, both or neither, and each side has its own master volume, so games have real stereo on headphones even though the built-in speaker is mono. The mixer also has an input called <b>VIN</b> from a pin on the cartridge, meant for a sound chip on the cartridge; no licensed game used it, and the Game Boy Advance dropped it.</p>
      </section>

      <section class="sect">${hwSectH('Buttons, link cable and timers')}
        <p class="hw-readable">The eight buttons are read through a single register, $FF00, as two groups of four: the directions in one, A, B, Select and Start in the other. The game picks a group by writing a bit, then reads four bits back where 0 means pressed. A button press can raise an interrupt and wake the CPU from STOP.</p>
        <p class="hw-readable">The <b>link port</b> is a simple synchronous serial port. One Game Boy supplies the clock and the other follows it, and each transfer swaps one byte in each direction at the same time. The internal clock on the original is <b>8,192 Hz</b>, roughly 1 KB a second; an external clock can be much faster. This is the port the Printer, the 4-player adapter and the Japanese mobile-phone adapter plug into.</p>
      </section>

      <section class="sect">${hwSectH('Cartridges and memory bank controllers')}
        <p class="hw-readable">The cartridge connector has 32 pins: the full 16-bit address bus, the 8-bit data bus, read, write and chip-select lines, reset, power and the VIN audio input. A cartridge with no mapper gives 32 KB of program memory and is completely visible to the CPU at once; anything larger needs a <b>memory bank controller</b>, a chip on the cartridge that watches for writes to the program-memory area and uses them to choose which bank of program memory or RAM appears in the switchable windows. The same chips also carry anything else the cartridge adds, such as a clock, a rumble motor or a tilt sensor.</p>
        ${mbcs}
        <p class="hw-readable">Every cartridge starts with a header at <b>$0100–$014F</b>. Two fields are checked by the console itself (the logo and the header checksum). Everything else is information for the game, the boot program's palette choice, or the Super Game Boy.</p>
        ${header}
        <p class="hw-readable">The logo check was Nintendo's protection against unlicensed games. It is not technical: anyone can copy the 48 bytes. It is legal, since copying the logo onto a cartridge means displaying Nintendo's trademark.</p>
      </section>

      <section class="sect">${hwSectH('The boot program')}
        <p class="hw-readable">At power-on a small program inside the CPU runs first, laid over the bottom of the cartridge's program memory. It sets up the hardware, copies the logo from the cartridge into video RAM and scrolls it down the screen, plays the two-note chime, compares the logo with its own copy and checks the header checksum. If both pass, it writes to the register at $FF50, which unmaps it for good until the next reset, and the cartridge's code at $0100 takes over. If either fails, it stops. Nine official versions exist:</p>
        ${boots}
      </section>

      <section class="sect">${hwSectH('The Super Game Boy')}
        <p class="hw-readable">The Super Game Boy is a cartridge for the Super NES with a complete Game Boy inside it, and an <b>ICD2</b> interface chip that captures the Game Boy's picture line by line for the SNES to show on a television. The SNES draws the 160 × 144 picture in the middle of its own 256 × 224 screen and fills the rest with a border.</p>
        <p class="hw-readable">Games marked for it in their header can do more. They send command packets to the SNES by toggling the button register in a set pattern, and with those they can load a custom border, colour the screen with up to four palettes assigned to areas of the 20 × 18 tile grid, use the SNES's sound, and read up to <b>four controllers</b> through a multitap.</p>
        <p class="hw-readable">Its weakness is speed. Its Game Boy clock is taken from the SNES's own crystal, so on an NTSC console it runs at about <b>4.2955 MHz</b>, roughly <b>2.4% faster</b> than a handheld, and music plays slightly sharp; on a PAL console it is about 1.5% fast. It has no link port either. The <b>Super Game Boy 2</b>, released only in Japan in January 1998, fixes both with its own crystal and a link socket.</p>
      </section>

      ${isCGB ? '' : colorSection}

      <section class="sect">${hwSectH('Accessories and add-ons')}
        <p class="hw-readable"><b>Game Link Cable.</b> Two-player play through the link port. The plug changed size with the Pocket, so there are adapters and cables for every combination.</p>
        <p class="hw-readable"><b>Four Player Adapter (DMG-07).</b> Joins four Game Boys. The adapter supplies the clock and runs the network: it first pings each port, then passes each machine's data on to the others one packet later. Players are numbered by the socket they plug into.</p>
        <p class="hw-readable"><b>Game Boy Camera.</b> A cartridge with an <b>M64282FP</b> image sensor. The sensor is 128 × 128 but its top and bottom rows are unusable, so photos are <b>128 × 112</b> in four shades. The cartridge holds 1 MB of program memory and 128 KB of battery-backed RAM, enough for 30 photos, and its controller, the MAC-GBD, works much like an MBC3 that can also run the sensor.</p>
        <p class="hw-readable"><b>Game Boy Printer.</b> A thermal printer made for Nintendo by Seiko Instruments, printing <b>160 pixels across</b> on 38 mm paper. It has its own microcontroller and an 8 KB buffer, and takes packets over the link cable that begin with the bytes $88 $33.</p>
        <p class="hw-readable"><b>Rumble and sensors.</b> Rumble cartridges use the MBC5's spare bank bit to drive a motor; tilt cartridges carry an MBC7 with an accelerometer; Hudson's HuC chips add infrared. The Color's own infrared port covers the rest.</p>
        <p class="hw-readable"><b>Super Game Boy</b> and <b>Super Game Boy 2</b>, described above. The GameCube's Game Boy Player later did the same job with Game Boy Advance hardware.</p>
      </section>

      <section class="sect">${hwSectH('Power, screen and physical')}
        ${physical}
        <p class="hw-readable">The original's weight is quoted two ways and both are right: about 220 g for the console alone and about 300 g with four AA cells. Its LCD is a reflective STN panel with a yellow-green cast and noticeable smearing when things move fast, which some games use for fake transparency by flickering sprites. The contrast wheel sets the LCD bias voltage; the volume wheel only affects the speaker and headphones. The Pocket's FSTN panel is far crisper and genuinely black and grey. The Color's screen is a colour TFT, still without any light of its own.</p>
      </section>

      <section class="sect">${hwSectH('Quirks and hardware bugs')}
        <p class="hw-readable"><b>The HALT bug.</b> If HALT is executed with interrupts disabled while one is already waiting, the CPU does not halt, and it also fails to step the program counter, so the next byte is read twice. Assemblers for the Game Boy traditionally put a NOP after every HALT to be safe.</p>
        <p class="hw-readable"><b>OAM corruption.</b> On the original, the Pocket and the Super Game Boy, incrementing or decrementing a 16-bit register that holds an address in $FE00–$FEFF while the PPU is scanning sprite memory scrambles part of the sprite table. Reading or writing that area at that time does the same. The Color is immune, even in compatibility mode.</p>
        <p class="hw-readable"><b>The STAT write bug.</b> On the original Game Boy, writing anything to the STAT register can fire a spurious LCD interrupt during most modes. Two games depend on it, <i>Road Rash</i> and <i>Xerd no Densetsu</i>, and so do not work properly on a Color.</p>
        <p class="hw-readable"><b>The unusable area.</b> Reading $FEA0–$FEFF gives different answers by model: zeros on the original (and OAM corruption during sprite scan), different patterns across Color revisions, and a repeated nibble on the last Color revision and the Advance. It is one of several ways software can tell models apart.</p>
        <p class="hw-readable"><b>Telling the hardware apart.</b> Games detect a Color or an Advance from the register values the boot program leaves behind, and a Pocket from the one-byte difference in its boot program. The Color also has four registers at $FF72–$FF75 whose purpose is unknown.</p>
        <p class="hw-readable"><b>Variable mode 3.</b> Because the drawing mode changes length with sprites and scroll, effects timed by counting cycles shift if a sprite moves onto the line. Accurate games time effects from interrupts instead.</p>
        <p class="hw-readable"><b>A running processor sees the LCD interrupts sooner.</b> On the original Game Boy, a processor that is running a program notices the start-of-line and end-of-drawing interrupts a couple of dots earlier than one waiting in HALT, so the same interrupt can be taken one machine cycle apart depending on what the processor was doing. A program that times a mid-line effect from such an interrupt depends on this; the AGE timing tests, checked on real hardware by their author, measure both cases.</p>
        <p class="hw-readable"><b>A sprite hidden off the left edge still costs time.</b> A sprite placed at X 1 to 7, so that part or all of it is off the left edge of the screen, lengthens the drawing mode exactly as much as the same sprite 8 pixels further right would. The AGE tests measure it on the original and on the Color, at both speeds.</p>
        <p class="hw-readable"><b>The Color at double speed: the end-of-drawing interrupt comes a dot late.</b> In double-speed mode the Color raises its end-of-drawing (mode 0) interrupt one dot after the last pixel is drawn, not at it.</p>
        <p class="hw-readable"><b>The divider after a speed switch.</b> When the Color switches between normal and double speed, the divider restarts at the very end of the switch, not a machine cycle before it. A program that reads the divider just after a switch sees the difference; the AGE test <code>spsw-div</code> measures it.</p>
        <p class="hw-readable"><b>The first pixel and a palette write (FITTED).</b> On the original Game Boy, a palette write that lands while the first pixel of a line is being drawn changes that pixel only if the write also covers the pixel after it. This is <b>FITTED</b>: one hardware photograph in the AGE tests supports it, and why the hardware behaves this way is not known.</p>
        <p class="hw-readable"><b>The Color at double speed: memory follows the status register.</b> In double-speed mode the Color's video memory is closed to the processor exactly while the status register reads "drawing", and sprite memory while it reads "sprite search" or "drawing". At normal speed the original Game Boy closes video memory a few dots before drawing starts; at double speed the Color does not. The AGE tests <code>vram-read</code>, <code>oam-read</code> and <code>oam-write</code> measure both edges on real hardware.</p>
        <p class="hw-readable"><b>The first line after switching the screen on, at double speed (FITTED).</b> On that line the Color reports the drawing mode three dots after drawing really starts, and the end of drawing one dot later than on other lines; video and sprite memory follow the same report. This is <b>FITTED</b>: the dot counts come from the AGE tables, and why that line differs is not known.</p>
        <p class="hw-readable"><b>Line 153 at double speed.</b> On line 153 the line counter reads 153 from the same moment every other line changes its number, then 0 a few dots later. The AGE test <code>ly</code> measures it on the Color.</p>
        <p class="hw-readable"><b>Super Game Boy speed.</b> The first Super Game Boy's 2.4% speed-up on NTSC means games, and their music, run slightly fast on it.</p>
      </section>

      <section class="sect">${hwSectH('This cartridge: ' + d.name)}
        <p class="hw-readable">What this title uses, and how big it is:</p>
        <ul class="hw-sources hw-readable">${feats}<li>Cartridge size: ${d.cartridge || 'not stated'}</li></ul>
        <p class="hw-readable">No cartridge and no boot program is distributed with this site. Both are read at run time from your own machine.</p>
      </section>

      <section class="sect">
        <h3 class="sect-h">Sources</h3>
        <ul class="hw-sources">${GB_HW_SOURCES.map(s => `<li>${s}</li>`).join('')}</ul>
      </section>
    </div>`;
}
