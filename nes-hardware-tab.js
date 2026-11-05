/* ===========================================================================
 * NES, Famicom and Famicom Disk System: the Hardware tab.
 *
 * Replaces the short spec-box version that lived inline in index.html. Same
 * shape and styling as the Pokémon mini tab (pmHardwareTabHTML), which is the
 * model: prose sections with their headings, tables where a table is
 * clearer, and a Sources list at the end.
 *
 * WRITING RULES FOR THIS FILE
 *   - Every figure comes from a named public source in NES_HW_SOURCES, and the
 *     timing numbers were checked against at least two of them.
 *   - Plain English, British spelling, no long dashes, no emulator names.
 *
 * One function serves all three catalogues. A Famicom title gets the Famicom
 * header; a disk (d.nesConsole === 'fds') gets the Disk System header and its
 * Disk System section moved to the top. The body is the same family write-up.
 * Uses gbhwTable() from gb-hardware-tab.js, which loads first; a local copy
 * stands in if that file is ever missing, so this tab never fails to render.
 * ======================================================================== */

function neshwTable(head, rows, opts) {
  if (typeof gbhwTable === 'function') return gbhwTable(head, rows, opts);
  const th = head.map(h => `<th>${h}</th>`).join('');
  const tb = rows.map(r => '<tr>' + r.map(c => `<td style="white-space:normal">${c}</td>`).join('') + '</tr>').join('');
  return `<div class="hw-table-wrap"><table class="hw-table"><thead><tr>${th}</tr></thead><tbody>${tb}</tbody></table></div>`;
}

const NES_HW_SPECS = [
  { k:'CPU',        v:'Ricoh RP2A03 (NTSC) or RP2A07 (PAL): a MOS 6502 core without decimal mode, plus the sound hardware, sprite DMA and controller ports, at 1.789773 MHz (NTSC)' },
  { k:'Picture',    v:'Ricoh RP2C02 (NTSC) or RP2C07 (PAL), clocked at three times the CPU on NTSC' },
  { k:'Work RAM',   v:'2 KB' },
  { k:'Video RAM',  v:'2 KB for two screens of tile map, 256 bytes of sprite memory, 32 bytes of palette' },
  { k:'Screen',     v:'256 × 240, about 224 lines visible on a typical NTSC set, 60.0988 frames a second (PAL: 50.007)' },
  { k:'Colours',    v:'64-entry palette, roughly 54 distinct; 25 on screen from the palettes as set' },
  { k:'Sprites',    v:'64 on screen, at most 8 on one line, 8 × 8 or 8 × 16' },
  { k:'Sound',      v:'5 channels: 2 pulse, triangle, noise and a 1-bit delta sample channel. Famicom cartridges can add more' },
  { k:'Cartridge',  v:'PRG (program memory) for the CPU and CHR (character memory, read-only or RAM) for the PPU, banked by a mapper on the cartridge. NES 72 pins, Famicom 60 pins' },
  { k:'Controllers',v:'D-pad, A, B, Select, Start, read one bit at a time from a 4021 shift register' },
  { k:'Released',   v:'Famicom 15 July 1983 (Japan), NES October 1985 (New York test), Famicom Disk System 21 February 1986' },
];

const NES_HW_SOURCES = [
  '<b>NESdev Wiki</b>, the community\'s reference for the NES and Famicom (<a href="https://www.nesdev.org/wiki/Nesdev_Wiki" target="_blank" rel="noopener">nesdev.org/wiki</a>). Pages used: <a href="https://www.nesdev.org/wiki/CPU" target="_blank" rel="noopener">CPU</a>, <a href="https://www.nesdev.org/wiki/2A03" target="_blank" rel="noopener">2A03</a>, <a href="https://www.nesdev.org/wiki/CPU_memory_map" target="_blank" rel="noopener">CPU memory map</a>, <a href="https://www.nesdev.org/wiki/PPU_memory_map" target="_blank" rel="noopener">PPU memory map</a>, <a href="https://www.nesdev.org/wiki/PPU_rendering" target="_blank" rel="noopener">PPU rendering</a>, <a href="https://www.nesdev.org/wiki/PPU_palettes" target="_blank" rel="noopener">PPU palettes</a>, <a href="https://www.nesdev.org/wiki/PPU_variants" target="_blank" rel="noopener">PPU variants</a>, <a href="https://www.nesdev.org/wiki/PPU_power_up_state" target="_blank" rel="noopener">PPU power-up state</a>, <a href="https://www.nesdev.org/wiki/Cycle_reference_chart" target="_blank" rel="noopener">cycle reference chart</a>, <a href="https://www.nesdev.org/wiki/APU" target="_blank" rel="noopener">APU</a>, <a href="https://www.nesdev.org/wiki/APU_DMC" target="_blank" rel="noopener">APU DMC</a>, <a href="https://www.nesdev.org/wiki/Mapper" target="_blank" rel="noopener">Mapper</a>, <a href="https://www.nesdev.org/wiki/MMC1" target="_blank" rel="noopener">MMC1</a>, <a href="https://www.nesdev.org/wiki/MMC3" target="_blank" rel="noopener">MMC3</a>, <a href="https://www.nesdev.org/wiki/MMC5" target="_blank" rel="noopener">MMC5</a>, the expansion audio pages for <a href="https://www.nesdev.org/wiki/FDS_audio" target="_blank" rel="noopener">FDS</a>, <a href="https://www.nesdev.org/wiki/VRC6_audio" target="_blank" rel="noopener">VRC6</a>, <a href="https://www.nesdev.org/wiki/VRC7_audio" target="_blank" rel="noopener">VRC7</a>, <a href="https://www.nesdev.org/wiki/MMC5_audio" target="_blank" rel="noopener">MMC5</a>, <a href="https://www.nesdev.org/wiki/Namco_163_audio" target="_blank" rel="noopener">Namco 163</a> and <a href="https://www.nesdev.org/wiki/Sunsoft_5B_audio" target="_blank" rel="noopener">Sunsoft 5B</a>, <a href="https://www.nesdev.org/wiki/Family_Computer" target="_blank" rel="noopener">Family Computer</a>, <a href="https://www.nesdev.org/wiki/Family_Computer_Disk_System" target="_blank" rel="noopener">Family Computer Disk System</a>, <a href="https://www.nesdev.org/wiki/CIC_lockout_chip" target="_blank" rel="noopener">CIC lockout chip</a>, <a href="https://www.nesdev.org/wiki/Standard_controller" target="_blank" rel="noopener">standard controller</a>, <a href="https://www.nesdev.org/wiki/Zapper" target="_blank" rel="noopener">Zapper</a> and <a href="https://www.nesdev.org/wiki/Four_Score" target="_blank" rel="noopener">Four Score</a>. The mapper game counts there come from the NesCartDB cartridge database.',
  '<b>Rodrigo Copetti, "NES Architecture"</b> (<a href="https://www.copetti.org/writings/consoles/nes/" target="_blank" rel="noopener">copetti.org</a>). Used to corroborate the CPU, memory and PPU figures, the decimal-mode story and the Famicom differences.',
  '<b>Wikipedia</b>, "<a href="https://en.wikipedia.org/wiki/Nintendo_Entertainment_System" target="_blank" rel="noopener">Nintendo Entertainment System</a>", "<a href="https://en.wikipedia.org/wiki/Family_Computer_Disk_System" target="_blank" rel="noopener">Family Computer Disk System</a>" and "<a href="https://en.wikipedia.org/wiki/Memory_management_controller_(Nintendo)" target="_blank" rel="noopener">Memory management controller (Nintendo)</a>". Used for dates, prices, sales, the models and the Disk System\'s commercial history.',
  '<b>Chromagi</b> console accessory archive (<a href="https://chromagi.com/nintendo/fc-nes/hvc-002?lang=en" target="_blank" rel="noopener">chromagi.com</a>), for the ratings printed on the Famicom and NES power adapters.',
];

function nesHardwareTabHTML(d) {
  const con = (d && d.nesConsole) || 'nes';
  const isFDS = con === 'fds';
  const isFC = con === 'famicom';
  const specRows = NES_HW_SPECS.map(r => `<div class="row"><span class="k">${r.k}</span><span class="v">${r.v}</span></div>`).join('');
  const mapperText = (d.mapper !== null && d.mapper !== undefined)
    ? (d.mapperName ? `${d.mapper} (${d.mapperName})` : String(d.mapper))
    : 'not stated';

  const models = neshwTable(
    ['Model', 'Code', 'Released', 'Notes'],
    [
      ['Family Computer (Famicom)', 'HVC-001', '15 Jul 1983, Japan, ¥14,800', 'Two controllers wired in; controller II has a microphone instead of Select and Start. RF output only. 60-pin cartridges, a 15-pin expansion port on the front. Early units froze because of a faulty chip and were recalled, and the square rubber buttons became round plastic ones.'],
      ['Nintendo Entertainment System', 'NES-001', 'Oct 1985 New York test, nationwide Sep 1986; Europe and Australia 1986–87', 'Front-loading 72-pin slot behind a door, detachable controllers, RF plus composite video and mono audio sockets, the 10NES lockout chip, and an expansion port underneath that nothing official used.'],
      ['Sharp C1 / My Computer TV', 'n/a', '1983, Japan', 'A Sharp television with a Famicom built in, using an RGB picture chip for a sharper image.'],
      ['Famicom Disk System', 'HVC-022 drive, HVC-023 RAM adapter', '21 Feb 1986, Japan, ¥15,000', 'Disk drive plus a RAM adapter that plugs into the cartridge slot. See its own section.'],
      ['Twin Famicom', 'Sharp', '1986, Japan', 'Sharp\'s licensed Famicom with a Disk System drive built in and composite output.'],
      ['Famicom Titler', 'Sharp', '1989, Japan', 'A Famicom for titling home videos, with an RGB picture chip and S-Video.'],
      ['New-Style NES ("top-loader")', 'NES-101', 'Oct 1993, US$49.99', 'Top-loading slot, no lockout chip, redesigned controllers. RF output only.'],
      ['New Famicom (AV Famicom)', 'HVC-101', 'Dec 1993, Japan', 'The Famicom redone like the top-loader: composite output, detachable NES-style controllers, no microphone.'],
    ],
    { wrapCols: [2, 3] }
  );

  const cpuMap = neshwTable(
    ['Range', 'Size', 'What is there'],
    [
      ['$0000–$07FF', '2 KB', 'Work RAM. $0000–$00FF is the fast "zero page"; $0100–$01FF is the stack.'],
      ['$0800–$1FFF', '6 KB', 'Three mirrors of the 2 KB, because only 11 address lines reach the RAM'],
      ['$2000–$2007', '8 B', 'PPU registers'],
      ['$2008–$3FFF', '~8 KB', 'The same eight PPU registers, repeated every 8 bytes'],
      ['$4000–$4017', '24 B', 'Sound, sprite DMA ($4014) and the controller ports ($4016, $4017)'],
      ['$4018–$401F', '8 B', 'Test registers, normally switched off'],
      ['$4020–$5FFF', '~8 KB', 'Cartridge space, used by a few mappers for registers or extra RAM'],
      ['$6000–$7FFF', '8 KB', 'Cartridge RAM, often battery-backed for saves'],
      ['$8000–$FFFF', '32 KB', 'Cartridge PRG (program memory) and mapper registers. The last six bytes are the NMI, reset and IRQ vectors.'],
    ],
    { wrapCols: [2], monoCols: [0] }
  );

  const ppuMap = neshwTable(
    ['Range', 'Size', 'What is there'],
    [
      ['$0000–$0FFF', '4 KB', 'Pattern table 0: 256 tiles, from the cartridge\'s CHR (character memory, read-only or RAM)'],
      ['$1000–$1FFF', '4 KB', 'Pattern table 1: another 256 tiles'],
      ['$2000–$2FFF', '4 KB', 'Four nametables of 32 × 30 tiles, each with a 64-byte attribute table. Only 2 KB exists in the console, so two are mirrors unless the cartridge adds RAM.'],
      ['$3000–$3EFF', '~4 KB', 'Mirror of the nametables'],
      ['$3F00–$3F1F', '32 B', 'Palette RAM: 4 background and 4 sprite palettes'],
      ['$3F20–$3FFF', '224 B', 'Mirrors of the palette'],
      ['OAM (separate)', '256 B', 'Sprite memory: 64 sprites × 4 bytes (Y, tile, attributes, X)'],
    ],
    { wrapCols: [2], monoCols: [0] }
  );

  const regions = neshwTable(
    ['', 'NTSC (NES, Famicom)', 'PAL (Europe, Australia)', 'Dendy (Russian famiclone)'],
    [
      ['Master crystal', '21.477272 MHz', '26.601712 MHz', '26.601712 MHz'],
      ['CPU clock', '÷12 = 1.789773 MHz', '÷16 = 1.662607 MHz', '÷15 = 1.773448 MHz'],
      ['PPU dots per CPU cycle', '3', '3.2', '3'],
      ['Lines per frame', '262', '312', '312'],
      ['Visible lines', '240', '239 (plus a black border)', '239'],
      ['Vertical blank after NMI', '20 lines, about 2,273 CPU cycles', '70 lines, about 7,459 CPU cycles', '20 lines (after 51 idle lines)'],
      ['CPU cycles per frame', '29,780.5', '33,247.5', '35,464'],
      ['Frame rate', '60.0988 Hz', '50.0070 Hz', '50.0070 Hz'],
    ],
    {}
  );

  const apu = neshwTable(
    ['Channel', 'What it does'],
    [
      ['Pulse 1 and 2', 'Square waves at 12.5%, 25%, 50% or 75% duty (75% sounds like 25% inverted). 11-bit pitch, 4-bit volume or a decaying envelope, a length counter, and a sweep unit that slides pitch by itself. The two sweeps differ by one in how they subtract.'],
      ['Triangle', 'A 32-step, 4-bit triangle wave an octave lower than a pulse at the same setting. No volume control at all: it is on or off, which is why NES bass lines never fade. Has a linear counter for finer note lengths.'],
      ['Noise', 'A 15-bit shift register clocked at one of 16 rates. A mode bit shortens the loop to 93 steps for a metallic, pitched buzz. Envelope and length counter as on the pulses.'],
      ['DMC (delta modulation)', 'Plays 1-bit delta-coded samples from cartridge memory ($C000–$FFFF) by nudging a 7-bit level up or down, at one of 16 rates from 4.18 kHz to 33.14 kHz; samples run up to 4,081 bytes and can loop or raise an IRQ. Games can also write the 7-bit level directly for raw PCM, which is how voice clips and drum kits are done.'],
    ],
    { wrapCols: [1] }
  );

  const mappers = neshwTable(
    ['Board / chip', 'iNES no.', 'PRG up to', 'CHR', 'What it adds; examples'],
    [
      ['NROM', '0', '32 KB', '8 KB read-only', 'No banking at all. Super Mario Bros., Donkey Kong, Excitebike.'],
      ['UxROM', '2', '256 KB', '8 KB RAM', 'Switches one 16 KB PRG bank; graphics are copied into CHR RAM. Mega Man, Contra, Castlevania.'],
      ['CNROM', '3', '32 KB', 'Banked, read-only', 'Switches the 8 KB of graphics. The earliest banking on the Famicom. Gradius, Arkanoid.'],
      ['AxROM', '7', '256 KB', '8 KB RAM', 'Switches 32 KB at a time and picks one of two single-screen nametables. Battletoads, Marble Madness.'],
      ['MMC1 (SxROM)', '1', '512 KB', 'Up to 128 KB', 'Written one bit at a time through a 5-write serial register. Mirroring control, battery RAM up to 32 KB. About 390 games, more board variants than any other. The Legend of Zelda, Metroid, Mega Man 2.'],
      ['MMC2 / MMC4', '9 / 10', '128 KB / 256 KB', 'Latched', 'Switches graphics automatically when particular tiles are drawn. MMC2: Mike Tyson\'s Punch-Out!! only. MMC4: Fire Emblem and other Japanese titles.'],
      ['MMC3 (TxROM)', '4', '512 KB', 'Up to 256 KB, 1 KB and 2 KB banks', 'Fine-grained banking and a scanline counter, clocked by the PPU\'s A12 address line, that interrupts at a chosen line for status bars and split scrolling. About 300 games. Super Mario Bros. 3, Kirby\'s Adventure, Mega Man 3–6.'],
      ['MMC5 (ExROM)', '5', '1 MB', 'Up to 1 MB', 'Nintendo\'s most capable chip: 1 KB of extra RAM, per-tile colour (8 × 8 attributes), a vertical split screen, scanline IRQ, an 8 × 8 multiplier, up to 128 KB PRG RAM and extra sound. Castlevania III, Just Breed, Uncharted Waters.'],
      ['MMC6', '4', '512 KB', 'Up to 256 KB', 'An MMC3 with 1 KB of battery RAM inside. StarTropics.'],
      ['Konami VRC6 / VRC7', '24, 26 / 85', 'n/a', 'n/a', 'Konami\'s Japanese mappers, with extra sound (below).'],
      ['Namco 163', '19', 'n/a', 'n/a', 'Namco\'s mapper with up to 8 wavetable channels.'],
      ['Sunsoft FME-7 / 5B', '69', 'n/a', 'n/a', 'Sunsoft\'s mapper; the 5B version adds a sound chip (Gimmick!).'],
    ],
    { wrapCols: [3, 4] }
  );

  const expAudio = neshwTable(
    ['Chip', 'Extra channels', 'Games'],
    [
      ['Famicom Disk System', '1 wavetable channel: a 64-step, 6-bit waveform with a 32-step pitch modulation table and its own envelopes', 'The Disk System versions of Zelda, Metroid, Kid Icarus; Otocky'],
      ['Konami VRC6', '2 pulse with 8 duty settings and 4-bit volume, plus 1 sawtooth', 'Akumajou Densetsu (Castlevania III in Japan), Esper Dream 2, Madara'],
      ['Konami VRC7', '6 channels of 2-operator FM, derived from Yamaha\'s YM2413 (OPLL): 15 fixed instruments and one programmable', 'Lagrange Point only'],
      ['Nintendo MMC5', '2 pulse (no sweep) and an 8-bit PCM channel', 'Just Breed, Metal Slader Glory; Shin 4 Nin Uchi Mahjong uses the PCM'],
      ['Namco 163', 'Up to 8 wavetable channels of 4-bit samples in 128 bytes of RAM, updated in turn, so more channels means a lower rate and, at 8, an audible whine', 'Most use 4 channels; King of Kings and Erika to Satoru no Yume Bouken use all 8'],
      ['Sunsoft 5B', '3 square channels, a noise generator and an envelope generator: a Yamaha YM2149F, itself a version of the General Instrument AY-3-8910', 'Gimmick! only'],
    ],
    { wrapCols: [1, 2] }
  );

  const power = neshwTable(
    ['', 'Famicom (HVC-001)', 'NES (NES-001)', 'Famicom Disk System'],
    [
      ['Power adapter', 'HVC-002: 10 V DC, 850 mA, centre negative', 'NES-002: 9 V <b>AC</b>, 1.3 A (the console rectifies and regulates it to 5 V)', 'Drive: six C cells or its own adapter. RAM adapter: powered by the Famicom'],
      ['Video out', 'RF only', 'RF, plus composite video and mono audio', 'Through the Famicom'],
      ['Cartridge', '60 pins, label up, vertical', '72 pins, pushed in and pressed down behind a door', 'RAM adapter in the cartridge slot; disks in the drive'],
      ['Controllers', 'Hard-wired, I and II; II has a microphone', 'Two detachable 7-pin ports', 'As the Famicom'],
      ['Expansion', '15-pin port on the front (light gun, keyboard, extra controllers)', '48-pin port underneath, never used by a Nintendo product', 'n/a'],
    ],
    { wrapCols: [1, 2, 3] }
  );

  const fdsSection = `
      <section class="sect">${hwSectH('The Famicom Disk System')}
        <p class="hw-readable">The Famicom Disk System came out in Japan on <b>21 February 1986</b> for ¥15,000. Nintendo's reason was cost: cartridge memory chips were expensive in 1985, and a rewritable disk let games be larger, save progress without a battery, and be sold more cheaply. It has two parts. The <b>drive</b> reads and writes <b>Disk Cards</b>, Nintendo's version of Mitsumi's 2.8-inch Quick Disk. The <b>RAM adapter</b> plugs into the cartridge slot and connects to the drive by a cable; inside it is a Ricoh <b>RP2C33</b> chip that runs the drive, adds a sound channel and a timer, and maps memory for the Famicom.</p>
        ${neshwTable(['Range', 'What the RAM adapter puts there'], [
          ['$4020–$409F', 'Disk System registers: timer, drive control, data port, sound'],
          ['$6000–$DFFF', '32 KB of RAM. A game is loaded from disk into here and run from RAM.'],
          ['$E000–$FFFF', '8 KB BIOS: the boot screen with Mario and Luigi, the disk loader and a library of routines'],
          ['PPU $0000–$1FFF', '8 KB of CHR RAM for the graphics'],
        ], { wrapCols: [1], monoCols: [0] })}
        <p class="hw-readable"><b>The disks.</b> Each side holds about <b>64 KB</b>, roughly 112 KB for a double-sided disk once formatted. The Quick Disk has no seeking: its single motor moves the head along one <b>spiral track</b>, so the drive behaves like a tape loop, and reading a whole side takes about seven seconds. Files are read in order, which is why Disk System games pause to load and ask you to turn the disk over. The drive's slot has raised moulding that matches the word <b>NINTENDO</b> recessed into official disks, so ordinary Quick Disks do not fit; the BIOS also checks for a licence file on the disk and shows it at boot.</p>
        <p class="hw-readable"><b>Disk Writer and Disk Fax.</b> Shops had <b>Disk Writer</b> kiosks that wrote a new game onto your old disk for <b>¥500</b>, a fraction of a new cartridge. Blue disks with a shutter worked with <b>Disk Fax</b> kiosks, which sent high scores to Nintendo for national contests. The drive went out of production in 1990 but the writing service lasted until September 2003. About <b>4.4 million</b> drives were sold and roughly 194 games released.</p>
        <p class="hw-readable"><b>Sound.</b> The RP2C33's extra channel is a <b>wavetable</b>: a 64-step waveform of 6-bit samples that the game writes, played at a chosen pitch, with a 32-entry modulation table that can wobble the pitch for vibrato and bell-like tones, its own volume envelope, and four master volume levels. It is why the Disk System versions of Zelda, Metroid and Kid Icarus sound different from the later NES cartridges.</p>
        <p class="hw-readable"><b>Its weak point.</b> The drive is turned by a rubber belt that hardens and stretches with age, and a worn belt is the usual reason a Disk System no longer loads. Disks themselves suffer from dust and fingerprints because the yellow ones have no shutter.</p>
      </section>`;

  return `
    <div class="hw-tab">
      <div class="hw-chip-header">
        <h2>${isFDS ? 'Famicom Disk System' : isFC ? 'Family Computer (Famicom)' : 'Nintendo Entertainment System'}</h2>
        <p class="hw-chip-tag">${isFDS
          ? 'A Famicom with the RP2C33 RAM adapter and a Quick Disk drive: 32 KB of RAM, 8 KB BIOS, one wavetable sound channel · 1986'
          : 'Ricoh 2A03 CPU at 1.79 MHz and Ricoh 2C02 picture chip, 2 KB of work RAM, 5 sound channels, mappers on the cartridge · ' + (isFC ? '1983' : '1985')}</p>
      </div>

      <section class="sect">${hwSectH('The machine')}
        <p class="hw-readable">The Family Computer was designed at Nintendo R&amp;D2 by <b>Masayuki Uemura</b>, with president Hiroshi Yamauchi pushing hard for a low price. It went on sale in Japan on <b>15 July 1983</b> at ¥14,800. After the American video game crash, Nintendo restyled it as the Nintendo Entertainment System, a grey front-loading box meant to look more like a video recorder than a toy, tested it in New York in <b>October 1985</b> and launched it across the United States in September 1986. Europe and Australia followed in 1986 and 1987. Sales reached about <b>61.91 million</b>. The NES was discontinued in 1995; the Famicom was made until <b>September 2003</b>.</p>
        <p class="hw-readable">The design is two Ricoh chips and very little else: the <b>2A03</b>, which is the CPU plus the sound, and the <b>2C02</b>, which makes the picture, with 2 KB of RAM for each. Everything else, including how big a game can be, comes from the cartridge, which feeds the CPU from its PRG (program memory) and the picture chip directly from its CHR (character memory, read-only or RAM). That split is why the same console could run both a 24 KB Donkey Kong and a 768 KB Kirby's Adventure.</p>
        <div class="factbox factbox-stacked">${specRows}</div>
      </section>

      ${isFDS ? fdsSection : ''}

      <section class="sect">${hwSectH('Models and revisions')}
        <p class="hw-readable">Nintendo and Sharp made the Famicom in several forms, and the NES in two. All run the same software, region and lockout permitting.</p>
        ${models}
        <p class="hw-readable">Nintendo also built the machine into arcade cabinets, the <b>Vs. System</b> and the <b>PlayChoice-10</b>, using RGB versions of the picture chip. Some of the Vs. System chips have their palettes scrambled, a different order for each chip, as copy protection, and one family swaps two register addresses.</p>
      </section>

      <section class="sect">${hwSectH('The processor: Ricoh 2A03')}
        <p class="hw-readable">The CPU is a <b>MOS 6502</b> core made under licence by Ricoh, the same family as the Apple II, Commodore 64 and Atari 2600. It has an 8-bit accumulator A, two 8-bit index registers X and Y, an 8-bit stack pointer fixed to page $01, a 16-bit program counter and a flags register, and 56 instructions with 13 addressing modes. It reaches 64 KB.</p>
        <p class="hw-readable">One feature is missing on purpose: the 6502's <b>decimal mode</b>. The flag can still be set and cleared, but additions and subtractions ignore it. Ricoh disabled it by cutting the connections to the decimal circuits on the chip, usually explained as a way to avoid paying MOS royalties on the full design. The rest of the core behaves like a standard 6502, including its well-known bug: an indirect <span class="hw-mono-inline">JMP</span> through an address ending in $FF takes its high byte from the start of the same page instead of the next one.</p>
        <p class="hw-readable">The same chip also contains the <b>sound hardware</b>, a <b>sprite DMA</b> unit that copies 256 bytes to the picture chip's sprite memory when $4014 is written (513 or 514 CPU cycles, during which the CPU stops), and the <b>controller ports</b>: three output lines for strobing controllers and two serial inputs.</p>
        <p class="hw-readable">The NTSC part is the <b>RP2A03</b>, at 1.789773 MHz (the 21.477 MHz crystal divided by 12). The PAL part is the <b>RP2A07</b>, at 1.662607 MHz, with sound rates retuned for the slower clock and a DMA bug fixed (see Quirks). Interrupts are the 6502's three: <b>NMI</b>, which the picture chip raises at the start of every vertical blank and drives every game's frame loop; <b>reset</b>; and <b>IRQ</b>, used by the sound frame counter, the sample channel and mappers with line counters.</p>
      </section>

      <section class="sect">${hwSectH('Memory maps')}
        <p class="hw-readable">The CPU and the picture chip each have their own address space. The CPU's is 64 KB, and the top half belongs entirely to the cartridge:</p>
        ${cpuMap}
        <p class="hw-readable">The picture chip has a separate 16 KB space, reached from the CPU only through its registers at $2006 and $2007:</p>
        ${ppuMap}
      </section>

      <section class="sect">${hwSectH('The picture: Ricoh 2C02')}
        <p class="hw-readable">Graphics are built from <b>8 × 8 tiles</b> at 2 bits a pixel, 16 bytes each, in two pattern tables of 256 tiles. The <b>background</b> is drawn from a <b>nametable</b>, a 32 × 30 grid of tile numbers that exactly fills the 256 × 240 screen. Colour is set by the <b>attribute table</b> at the end of each nametable, which gives one 2-bit palette choice for each <b>16 × 16</b> area, so every block of four tiles shares a palette. That coarse grid is the source of the NES look, and of colour bleeding at the edges of scrolling screens.</p>
        <p class="hw-readable">There are four nametables in the address space but RAM for only two. The cartridge decides how the two are mirrored: <b>vertical</b> mirroring lays them side by side for sideways scrolling, <b>horizontal</b> stacks them for vertical scrolling, and some mappers switch between them or add RAM for all four. Scrolling in both directions at once with only two screens means one edge of the picture shows the wrong tiles, and you can see it on the right-hand edge of Super Mario Bros. 3.</p>
        <p class="hw-readable"><b>Sprites</b> are 64 entries in a 256-byte sprite memory (OAM), each with a Y position, a tile number, an attribute byte (palette, behind-background flag, flips) and an X position. They are 8 × 8, or 8 × 16 using two tiles. Before each line the chip searches OAM for the sprites on it and can only keep <b>8 per line</b>; the rest are not drawn. Games cycle which sprites are dropped each frame, which is the flicker that every NES player knows.</p>
        <p class="hw-readable"><b>Colour.</b> Palette RAM holds <b>4 background palettes and 4 sprite palettes</b> of 3 colours each plus one shared backdrop colour, so <b>25 colours</b> can be on screen at once from the palettes as set. Each entry picks from a <b>64-entry master palette</b>, of which roughly 54 are distinct, because several entries are duplicate blacks; sources count 52 to 54 depending on how the greys are treated. One entry, $0D, produces a signal "blacker than black" that confuses some televisions, so games avoid it. Three emphasis bits darken the other colour channels for tinted screens. The 2C02 does not make RGB and convert it: it produces the <b>NTSC composite signal directly</b>, which is why NES colour has no single correct value and looks different from set to set. The RGB arcade chips have their own fixed palette.</p>
        <p class="hw-readable">The CPU controls the chip through eight registers at <span class="hw-mono-inline">$2000–$2007</span>: PPUCTRL, PPUMASK, PPUSTATUS, OAMADDR, OAMDATA, PPUSCROLL, PPUADDR and PPUDATA. Video memory can only be written safely during vertical blanking or with rendering off.</p>
      </section>

      <section class="sect">${hwSectH('Screen timing and regions')}
        <p class="hw-readable">On NTSC the picture chip runs at exactly three times the CPU clock. A line is <b>341 dots</b> and a frame is <b>262 lines</b>: 240 visible, one idle line, 20 lines of vertical blank, and a pre-render line that sets up the next frame. On every other frame, if rendering is on, the pre-render line is one dot short; this keeps the colour artefacts from settling into fixed stripes, and it is why the NTSC frame works out to <b>29,780.5 CPU cycles</b> and <b>60.0988 Hz</b>, not 60.</p>
        <p class="hw-readable">The regions differ more than most consoles'. A PAL console has a different crystal, divides it differently, and has <b>70 lines</b> of vertical blank instead of 20, so games run at 50 Hz and usually about a sixth slower unless they were adjusted. The Dendy, a widely sold Russian clone, mixes the two: PAL frame rate, but an NTSC-like vertical blank with idle lines added, so that NTSC games run at the right pace on PAL televisions.</p>
        ${regions}
        <p class="hw-readable">On NTSC the picture chip also ignores writes to its main registers for about <b>29,658 CPU cycles</b> after power-on or reset, so every game waits for two vertical blanks before setting it up. The Famicom's reset button resets only the CPU, not the picture chip, and a few Famicom games that set up the PPU too early fail on an NES.</p>
      </section>

      <section class="sect">${hwSectH('Sound: the 2A03\'s five channels')}
        <p class="hw-readable">The sound hardware lives inside the CPU chip. It has five channels, all set through registers at $4000–$4017:</p>
        ${apu}
        <p class="hw-readable">A <b>frame counter</b> clocks the envelopes, sweeps and length counters at about 240 Hz in a 4-step or 5-step sequence; in 4-step mode it can also raise an IRQ. The channels are mixed by two resistor networks, one for the pulses and one for the other three, and the mix is <b>not linear</b>: loud notes on one channel slightly squash the others. On the Famicom the mixed sound also travels through the cartridge and back, so a cartridge can add its own channels before it reaches the television. The NES's 72-pin slot sends those pins to the unused expansion port instead, so no NES cartridge has extra sound; Castlevania III uses Konami's VRC6 sound chip in Japan, while the American version is on MMC5 with a rewritten soundtrack for the standard channels.</p>
      </section>

      <section class="sect">${hwSectH('Cartridges and mappers')}
        <p class="hw-readable">An NES cartridge has two buses: the CPU sees its <b>PRG</b> (program memory) through 32 KB at $8000–$FFFF, and the picture chip sees its <b>CHR</b> (character memory, read-only), or <b>CHR RAM</b> that the game fills itself, as the 8 KB of pattern tables. Anything bigger than 32 KB plus 8 KB needs a <b>mapper</b>, hardware on the cartridge that swaps banks of cartridge memory into those windows when the game writes to particular addresses. Mappers range from a single off-the-shelf logic chip to custom chips with timers, extra RAM and sound. Mappers also decide nametable mirroring and battery saves.</p>
        <p class="hw-readable">Cartridge dumps are usually stored in the <b>iNES</b> format, whose 16-byte header gives the PRG and CHR sizes, the mirroring, a battery flag and a <b>mapper number</b>. The numbering is the community's, not Nintendo's, and the later NES 2.0 header adds submappers to separate boards that share a number. The common ones:</p>
        ${mappers}
        <p class="hw-readable">Nintendo also restricted how many games a licensed publisher could release in a year and manufactured every licensed cartridge itself, which is why the lockout chip below mattered so much commercially.</p>
      </section>

      <section class="sect">${hwSectH('Famicom expansion audio')}
        <p class="hw-readable">Because the Famicom's sound passes through the cartridge, a Japanese game could bring its own sound chip. Six did so in the licensed library:</p>
        ${expAudio}
      </section>

      ${isFDS ? '' : fdsSection}

      <section class="sect">${hwSectH('The lockout chip (CIC)')}
        <p class="hw-readable">The front-loading NES contains a <b>CIC</b> (Checking Integrated Circuit), marketed as <b>10NES</b>: a small 4-bit Sharp microcontroller acting as a lock, which expects to talk to a matching key chip in every licensed cartridge. If the handshake fails, it pulls the reset line of the CPU and picture chip low and high about <b>once a second</b>, which is the familiar blinking power light and flashing screen. A dirty or worn 72-pin connector causes the same symptom on genuine games.</p>
        <p class="hw-readable">The chips came in regional versions so that cartridges only worked in their own markets: <b>3193</b> (and later 6113) for North America, <b>3197</b> for "PAL-A" (the UK, Italy and Australia), <b>3195</b> for "PAL-B" (most of mainland Europe), 3196 for Asia, and 3198 for the FamicomBox hotel unit. Unlicensed publishers such as Color Dreams beat it by sending voltage spikes through the cartridge that stunned the lock chip; Tengen instead made its own key chip. The Famicom never had a CIC, and the 1993 top-loader dropped it.</p>
      </section>

      <section class="sect">${hwSectH('Controllers and peripherals')}
        <p class="hw-readable"><b>The controller</b> has eight buttons and one chip, a <b>4021</b> shift register. The game writes 1 then 0 to $4016 to latch the buttons, then reads them one per read in the order A, B, Select, Start, Up, Down, Left, Right. Official controllers return 1 for every read after the eighth. On the original Famicom, controller II's <b>microphone</b> appears as bit 2 of $4016 whenever it is read; The Legend of Zelda uses it to scare off Pols Voice.</p>
        <p class="hw-readable"><b>Zapper.</b> The light gun has a photodiode behind a lens, tuned to the 15 kHz flicker of a CRT, and reports two bits: light seen, and trigger pulled. A game blanks the screen to black for a frame and draws white boxes over each target; if the gun sees light, it is pointing at a box. It needs a CRT: modern screens delay and smooth the picture so the gun never sees the flash at the expected time. On the Famicom the gun plugs into the expansion port.</p>
        <p class="hw-readable"><b>R.O.B.</b> (Robotic Operating Buddy) came with the 1985 Deluxe Set. It has no cable: a light sensor in its head reads commands sent as patterns of screen flashes. Only two games used it, Gyromite and Stack-Up. It was mostly there to help sell the NES as a toy-store item after the crash.</p>
        <p class="hw-readable"><b>Multiplayer.</b> The NES <b>Four Score</b> and the wireless <b>NES Satellite</b> plug into both ports and add two more; the game reads 24 bits per port, with a signature at the end that tells it the adapter is there. On the Famicom, Hori's 4 Players Adapter and the expansion port do the same.</p>
        <p class="hw-readable"><b>Other add-ons.</b> The <b>Power Pad</b> (Bandai's Family Trainer in Japan) is a floor mat of pressure switches. The <b>NES Advantage</b> and <b>NES Max</b> are arcade stick and turbo pads; Mattel's <b>Power Glove</b> came in 1989. The Famicom had a wider set, all through its expansion port: the <b>Family BASIC</b> keyboard and its cassette <b>Data Recorder</b>, the <b>Famicom 3D System</b> shutter glasses, a modem for online banking and betting, and the Disk System's own drive.</p>
      </section>

      <section class="sect">${hwSectH('Power and physical')}
        ${power}
        <p class="hw-readable">The two original power adapters are not interchangeable as sold: the Famicom's gives DC and the NES's gives AC. The NES's front-loading slot is a <b>zero insertion force</b> design in which the cartridge is pushed in and then pressed down onto the pins. The springs in that connector wear and oxidise over the years, causing the blinking-screen fault above, and replacing or re-tensioning the 72-pin connector is the most common NES repair.</p>
      </section>

      <section class="sect">${hwSectH('Quirks and hardware bugs')}
        <p class="hw-readable"><b>Sprite overflow flag.</b> The picture chip has a flag meant to say "more than 8 sprites on this line", but the search that sets it has a bug: after finding eight it steps through memory diagonally and reports both false positives and false negatives. Few games trust it.</p>
        <p class="hw-readable"><b>Sprite zero hit.</b> The reliable alternative: a flag set when the first sprite in OAM overlaps a non-transparent background pixel. Super Mario Bros. waits for it under the status bar to start scrolling the rest of the screen.</p>
        <p class="hw-readable"><b>DMC conflicts.</b> On NTSC consoles, when the sample channel fetches a byte at the same moment the game reads the controller port, the port is read extra times and buttons are lost or doubled. Games that play samples read the controllers repeatedly until two reads agree. The PAL 2A07 fixed it.</p>
        <p class="hw-readable"><b>OAM decay and corruption.</b> Sprite memory is dynamic RAM that is only refreshed while rendering. Left with rendering off for too long its contents fade, which is one reason games rewrite it every frame by DMA. Some 2C02 revisions also corrupt sprite memory when OAMADDR is written at the wrong moment.</p>
        <p class="hw-readable"><b>Open bus.</b> Reading an address where nothing answers returns whatever was last on the data bus, usually the high byte of the address just read. Several games depend on this by accident.</p>
        <p class="hw-readable"><b>Colour $0D and the palette.</b> As above: one colour code produces an out-of-range black, and NES colours depend on the television decoding a composite signal, so no two references agree exactly on the palette.</p>
        <p class="hw-readable"><b>Mapper differences.</b> The same mapper can behave differently between chip makers: the MMC3's line counter, for example, fires on every line in one revision and stops in another when it is set to zero, and the MMC1 ignores the second of two writes on consecutive cycles. The same chip can also sit on boards wired differently: Tengen's Alien Syndrome board connects its RAMBO-1's character address line A17 to the nametable select, as Nintendo's TLSROM board does with the MMC3, and the CoolBoy and MindKids multicarts add four outer bank registers to an MMC3 clone. Protection chips decode their own addresses: the TXC chip in Creatom answers a read at any $41xx address with address line A8 set, not only at $4100, and the game depends on it. The arcade VS. System's RGB picture chips cannot read back sprite or palette memory as the console's chip can.</p>
      </section>

      <section class="sect">
        <h3 class="sect-h">${isFDS ? 'This disk' : 'This cartridge'}</h3>
        <div class="factbox">
          ${isFDS ? '' : `<div class="row"><span class="k">iNES mapper</span><span class="v">${mapperText}</span></div>`}
          <div class="row"><span class="k">Size</span><span class="v">${d.cartridge || 'not stated'}</span></div>
          <div class="row"><span class="k">File</span><span class="v">${d.fullName || 'not stated'}</span></div>
        </div>
        <p class="hw-readable">${isFDS
          ? 'These figures come from the disk image itself. The site has no reference list of Disk System titles to match it against, so it reports only what the file says.'
          : 'These figures come from the cartridge file\'s own 16-byte iNES header. The site has no reference list of NES titles to match it against, so it reports only what the file says about itself. The mapper is the part that matters at run time: it is hardware on the cartridge, not in the console.'}
          No game, disk or BIOS is bundled with this site; it reads them only from a content pack or a file you choose.</p>
      </section>

      <section class="sect">
        <h3 class="sect-h">Sources</h3>
        <ul class="hw-sources">${NES_HW_SOURCES.map(s => `<li>${s}</li>`).join('')}</ul>
      </section>
    </div>`;
}
