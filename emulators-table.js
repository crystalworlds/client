/*
 * emulators-table.js -- the home page's "11 emulators" cards (2026-10-18).
 *
 * WHY. The request: "a table with the emulator, what systems it plays, what chips it supports ... something
 * informative and clever to prove the claims." One card per emulator family (grouped as: Game &
 * Watch = the Sharp SM510, SM5A and SM511/SM512 cores; Game Boy = DMG and Color; the colour Game &
 * Watch = Mario and Zelda), the consoles it plays (the Systems menu's own pictures), the chips it
 * models by part name, and its score with the date it was measured. "See the proof" opens that
 * core's own Emulation tab (the build specification the drawer shows) at its score or acceptance
 * section, in a window of its own, so the proof is reachable without owning any game.
 *
 * WHERE THE FACTS COME FROM: each card's figures are what the served cores score, as each system's
 *   Emulation tab records them with their dates, and the compatibility ladder (firmware/compat/ladder.json).
 *   Decided 2026-10-18: only public tests are shown; our own 171-row NES board is not (no one else can run it),
 *   so the NES card's score is AccuracyCoin alone.
 * Other emulators are not named here (site rule: names only in comparison tables).
 */
(function () {
  'use strict';
  if (window.CwEmuCards) return;
  const IMG = k => 'images/consoles/' + k + '.webp?v=2.1.1';
  const P = (img, name) => ({ img, name });
  const N = name => ({ name });

  /* THE COMPATIBILITY LADDER (18 Oct 2026): in place of "N games playable, all tested",
     a ladder like the RPCS3 / shadPS4 compatibility lists. The counts are GENERATED, never typed here:
     `node tools/compat-ladder/build.mjs` writes firmware/compat/ladder.json from the dated records (the
     not-supported lists and their ledger, the GB/GBC audits and input confirmations, NES_Capture and
     Atari_Capture pass 1, the Pokemon mini, colour-unit and Game & Watch acceptance runs); its README
     has the mapping table per system and every judgement call. Games are counted as the site's tiles
     group them (versions collapsed), shown or hidden. Compatibility only: no file counts, nothing
     about what the library holds. The file is fetched with cache revalidation, so a rebuild needs no
     ?v= bump. Our capture does not play games to the end, so the top rung is "Plays", never
     "Playable". (Superseded 2026-10-18: a rung is how far OUR EMULATOR gets, never how far a test went;
     a shown game not on the not-supported list is Plays. The old note follows.) Menus was worded as "not yet confirmed" because most of the capture runs give no
     input (GB, GBC, NES) or measure no response to it (Atari), 18 Oct 2026. */
  const LADDER_URL = 'firmware/compat/ladder.json';
  const RUNGS = [
    /* Three categories (2026-10-18: Ingame and Menus removed). Each is [key, label, meaning,
       the ladder.json keys it adds up]; the data file keeps its five columns. */
    ['plays', 'Plays', 'the game plays on our emulator.', ['plays', 'ingame']],
    ['boots', 'Boots', 'the game starts on our emulator but does not play: the screen stays blank, freezes, or stops at its title.', ['menus', 'boots']],
    ['nothing', 'Nothing', 'the game does not start on our emulator.', ['nothing']],
  ];
  let ladder = null, ladderP = null;
  const loadLadder = () => ladderP || (ladderP = fetch(LADDER_URL, { cache: 'no-cache' })
    .then(r => (r.ok ? r.json() : null)).catch(() => null).then(j => (ladder = j && j.cards ? j : null)));
  /* Rung colours: one ordered ramp (best = strongest), greys for the two rungs that do not reach a
     picture of the game; every count is also printed beside its swatch, so colour is never the only cue. */
  function ladderCSS() {
    if (document.getElementById('emu-lad-css')) return;
    const st = document.createElement('style');
    st.id = 'emu-lad-css';
    st.textContent = `
  .emu-cards, .emu-lad-legend { --lad-plays: #5eead4; --lad-ingame: #2bb3a3; --lad-menus: #1f7a74; --lad-boots: #7b8491; --lad-nothing: #4a515b; --lad-track: rgba(255,255,255,.06); }
  :root[data-theme="light"] .emu-cards, :root[data-theme="light"] .emu-lad-legend { --lad-plays: #0f766e; --lad-ingame: #14a396; --lad-menus: #8fd6cd; --lad-boots: #a3abb6; --lad-nothing: #d3d8de; --lad-track: rgba(0,0,0,.05); }
  .emu-lad { display: flex; flex-direction: column; gap: 7px; }
  .emu-lad-bar { display: flex; gap: 2px; height: 12px; border-radius: 6px; overflow: hidden; background: var(--lad-track); }
  .emu-lad-bar span { min-width: 4px; flex-basis: 0; }
  .emu-lad-key { list-style: none; margin: 0; padding: 0; display: flex; flex-wrap: wrap; gap: 4px 12px; font-size: 12px; color: var(--muted); font-variant-numeric: tabular-nums; }
  .emu-lad-key li { display: inline-flex; align-items: center; gap: 5px; }
  .emu-lad-key b { color: var(--text); font-weight: 700; }
  .emu-lad-key i { width: 10px; height: 10px; border-radius: 3px; flex: none; }
  .emu-lad .lad-plays { background: var(--lad-plays); } .emu-lad .lad-ingame { background: var(--lad-ingame); }
  .emu-lad .lad-menus { background: var(--lad-menus); } .emu-lad .lad-boots { background: var(--lad-boots); }
  .emu-lad .lad-nothing { background: var(--lad-nothing); }
  .emu-lad-legend { margin: 14px 0 0; }
  .emu-top { display: flex; align-items: flex-start; justify-content: space-between; gap: 10px; }
  .emu-rank { flex: none; display: flex; flex-direction: column; align-items: flex-end; text-align: right; max-width: 45%; }
  .emu-rank b { font-size: 26px; line-height: 1; font-weight: 800; color: var(--accent); }
  .emu-rank span { font-size: 11px; line-height: 1.3; color: var(--muted); }
  .emu-rank b + span { margin-top: 4px; }
  .emu-lad-legend .lad-plays { background: var(--lad-plays); } .emu-lad-legend .lad-boots { background: var(--lad-boots); } .emu-lad-legend .lad-nothing { background: var(--lad-nothing); }
  .emu-lad-more summary { cursor: pointer; font-size: 12px; font-weight: 700; color: var(--accent); }
  .emu-lad-more dl { margin: 8px 0 0; display: grid; grid-template-columns: auto 1fr; gap: 5px 10px; font-size: 12.5px; line-height: 1.45; }
  .emu-lad-more dt { color: var(--text); font-weight: 700; display: flex; align-items: center; align-self: start; gap: 6px; }
  .emu-lad-more dt i { width: 10px; height: 10px; border-radius: 3px; flex: none; }
  .emu-lad-more dd { margin: 0; color: var(--muted); }
  .emu-lad-t th[scope="col"] { white-space: nowrap; }
  .emu-lad-t tr.emu-lad-part th { text-align: left; padding-top: 10px; font-weight: 700; }
  .emu-lad-tw, .emu-cmp { max-width: 100%; overflow-x: auto; }
  @media (max-width: 640px) { .emu-lad-t { font-size: 11px; } .emu-lad-t th, .emu-lad-t td { padding: 3px 2px; } }`;
    document.head.appendChild(st);
  }
  /* HOW WE COMPARE (18 Oct: "show the measured results with dates of the tests ... post what you can
     honestly, and everything else is measured before release"). MEASURED comparisons only, from the records
     named in each note; no figure taken from anyone's claims. Other emulators may be named here: these are
     comparison tables. Rows: [emulator, version, score, date]. */
  /* "Ours" is the site's own version (Settings title), which is the version of the cores it ships
     (2026-10-18), never a build or round name. */
  const SITE_VERSION = (() => {
    const el = document.querySelector('#vault-overlay .modal-title');
    const m = el && /(\d+\.\d+\.\d+)/.exec(el.textContent || '');
    return m ? m[1] : '2.1.1';
  })();
  const COMPARE = {
    /* GB versions (2026-10-18): the board (gbdev.io/GBEmulatorShootout, run 'Updated On Thu, 04 Jun 2026')
       prints none; its emulators/*.py fetch the latest GitHub release at run time. GitHub releases on that
       date: LIJI32/SameBoy v1.0.3 (2026-03-04; v1.0.4 2026-10-09), Docheinstein/docboy 1.2 (2026-03-22;
       1.3 2026-06-20). Emulicious downloads from emulicious.net with no version history: not stated.
       2026-11-07: SameBoy 1.0.5 and DocBoy 1.3 run by us with the board's own tool, rows and judge: the same answers as the
       4 June run on all 261 shared rows. Ours 256 / 259 on the 261 from core 37c1741215a4 (8 Nov 2026), and the same on core ca5a2a32f97e (9 Nov 2026, every row byte-identical).
       mGBA added 2026-10-30: the board's own cells for the mGBA column, counted from the page
       read 30 Oct 2026, same run: 145 PASS + 3 INFO on the shared 261 (147 / 150 on all 264, the page's
       "mGBA (150/264)"); mgba-emu/mgba newest release on that date 0.10.5 (2025-03-09), still the newest. */
    gb: { test: 'The public Game Boy accuracy board (264 rows), on the 261 rows every column was run on. Score: PASS only, then PASS plus INFO.',
      rows: [
        ['Ours', SITE_VERSION, '256 / 259', '9 Nov 2026'],
        ['DocBoy', '1.3', '255 / 258', '7 Nov 2026'],
        ['Emulicious', 'not stated', '251 / 254', '4 Jun 2026'],
        ['SameBoy', '1.0.5', '249 / 252', '7 Nov 2026'],
        ['mGBA', '0.10.5', '145 / 148', '4 Jun 2026'],
      ],
      note: 'On the 261 tests every emulator was run on, we pass 256 and DocBoy 1.3 passes 255. We ran SameBoy 1.0.5 and DocBoy 1.3 ourselves on 7 November 2026 with the board’s own tool and judge: on these 261 tests they gave the same answers as the board’s published run of 4 June 2026. Emulicious and mGBA are the board’s own run of 4 June 2026; we have not re-run them. In that run the board left three Super Game Boy tests blank for DocBoy and Emulicious (they were not tested, rather than failed), so this table compares the 261 tests every emulator was run on. Across all 264 tests, including those three, we score 259. mGBA 0.10.5 is still its newest release. Emulicious publishes no release history.' },
    /* 8 Nov 2026 (AccuracyCoin 66e8711, 4 Nov 2026, 147 scored tests): every emulator its newest release, each
       from its project's own release page, run by script (Mesen and FCEUX read from RAM, Nestopia UE
       and puNES from the picture, every reading equal to the cartridge's own tally). Ours: 147 / 147 at alignments
       0, 1 and 2 on the release core.
       9 Nov 2026 (same cartridge): NintendulatorNRS 202611061000 (its author's page, read from the picture)
       and FCEUmm libretro e0f3086 (the official libretro buildbot build, read from RAM by our own libretro runner); run 2 of
       every arm agrees with run 1 on every pass and fail. */
    nes: { test: 'AccuracyCoin, its 4 November 2026 build (147 scored tests, NTSC), each emulator on its default settings, judged by the cartridge itself.',
      rows: [
        ['Ours', SITE_VERSION, '147 / 147', '8 Nov 2026'],
        ['Nestopia UE', '2.0.0', '145 / 147', '8 Nov 2026'],
        ['MesenCE', '2.2.1', '141 / 147', '8 Nov 2026'],
        ['MesenCE', '2.2.0', '141 / 147', '8 Nov 2026'],
        ['NintendulatorNRS', '6 Nov 2026 build', '132 / 147', '9 Nov 2026'],
        ['Mesen2', '2.1.1', '128 / 147', '8 Nov 2026'],
        ['puNES', '0.111', '102 / 147', '8 Nov 2026'],
        ['FCEUX', '2.7.0', '84 / 147', '8 Nov 2026'],
        ['FCEUmm (libretro)', '2 Nov 2026 build', '84 / 147', '9 Nov 2026'],
      ],
      note: 'We pass all 147; no other emulator measured here does. Nestopia UE 2.0.0 passes 145: it fails DMA Landing on Write and DMC Reload Timing, and every other emulator measured here fails DMC Reload Timing too. The newest test in this build, DMC Playback Rate, is passed by Nestopia UE, NintendulatorNRS and every Mesen release, and failed by puNES, FCEUX and FCEUmm. On its defaults FCEUX 2.7.0 scores 84, with 3 tests skipped by the cartridge; with its New PPU option on it scores 89. FCEUmm, the libretro core, passes the same 84 tests as FCEUX on its defaults, with the same 3 skipped. With every documented accuracy option on, MesenCE 2.2.1 scores 137. Each emulator is its newest release (FCEUmm has no releases, so it is the newest official libretro build), run by us on 8 and 9 November 2026. Every emulator was run twice, with the same pass or fail on every test.' },
    /* 7800 (2026-10-18: #1 with a scoreboard saying why): the Atari ranking of
       18 Oct 2026: scoreboard of 7 Oct 2026 (ours 27, A7800 11 with 1 fail and 15 unable to run,
       ProSystem 1; common set 12 vs 11), library run of 23 Oct 2026 (A7800 refuses 98 of
       805 files, ours runs all 98 and 91 pass the play checks; was 100 / 89 in the 12 Oct sweep), boards/devices table (b). */
    a7800: { test: 'There is no public test suite or scoreboard for the Atari 7800, so we wrote our own test cartridges and ran them on the three emulators below. There are 27 tests: 24 test cartridges we wrote (one for each 7800 cartridge board, in each of the two header formats), each checking that its board works the way the published 7800 cartridge format describes it, and 3 public tests of the 6502 processor.',
      rows: [
        ['Ours', SITE_VERSION, '27 of 27', '7 Oct 2026'],
        ['A7800', '7a2afdc (16 Nov 2024)', '11 of 27', '7 Oct 2026'],
        ['ProSystem', 'libretro 8a88014', '1 of 27', '7 Oct 2026'],
      ],
      note: '12 of the 27 use the newer (version 4) cartridge header, which only we can read, and 3 are processor tests that the other two cannot be given. On the 12 that all three can load, we pass 12, A7800 11 and ProSystem 1. Games, tested on us and A7800 (805 files, 23 Oct 2026): A7800 will not load 98 of them (files without a header); we load all 98, and 91 of them play. We also support hardware A7800 does not: a second POKEY sound chip, a Yamaha YM2151 sound chip on the cartridge, COVOX sound, the SOUPER board, 2600 cartridges, cartridges without a header, and the SaveKey, AtariVox, SNES pad and Sega pad adaptors.',
      /* more: a second button under the note that opens the card's proof at another anchor (2026-10-18:
         "add the 27 test cartridges to a table on the Emulation tab of the 7800, link it here"). */
      more: { label: 'See all 27 tests', anchor: 'atari7800emu-05-cartridges--our-7800-test-cartridges', title: 'Atari 7800: our test cartridges' },
      download: { href: '/downloads/atari7800-tests/atari7800-test-cartridges.zip', label: 'our 25 test cartridges in one zip (the 24 counted and SOUPER), with a read-me' } },
    /* 2600 and 5200 (2026-10-19: both #1 with an explanation). Rung 2 of the ranking rule:
       scoreboards of 7 Oct 2026; games from the ranking of 18 Oct
       and its 19 Oct updates. Cartridge types: our
       enum atari_scheme and Stella c4016ea Bankswitch.hxx, 58 each, the same list; controllers: our
       enum atari_controller 18 devices, Stella Control.hxx 17 (its two paddle axis modes are input modes).
       19 Oct 2026: the 5200 counts measure the emulator WITH the original BIOS (an Atari_Capture
       run with the BIOS); our own firmware is its own line. Both have a rewind (play/host/rewind-ring.mjs, checked on
       River Raid); PlusROM is not listed against us: we never let a cartridge contact outside servers. */
    a2600: { test: 'There is no public test suite or scoreboard for the Atari 2600, so we wrote our own test cartridges and ran them on the three emulators below. There are 18 tests: 15 test cartridges we wrote (one for each of 15 bank-switching schemes), each checking that its scheme works the way it is documented, and 3 public tests of the 6502 processor.',
      rows: [
        ['Ours', SITE_VERSION, '18 of 18', '7 Oct 2026'],
        ['Stella', '7.0c', '15 of 18', '7 Oct 2026'],
        ['Gopher2600', '79ce82a', '14 of 18', '7 Oct 2026'],
      ],
      note: 'Level with Stella. The 3 processor tests cannot be given to Stella or Gopher2600, so they count for nothing against either; on the 15 test cartridges all three can run, we pass 15, Stella 15 and Gopher2600 14. Games, tested on us and Stella (2,089 files, 23 Oct 2026): Stella’s run counted 3 files as playing that ours did not, all unfinished prototypes; checked one by one, none is a fault in our emulator (two play on ours too, and the third asks for a part of the game the file does not have). Our core and Stella both have the same 58 cartridge types; 50 of them reach this site (the core’s multicart sizes and Movie Cart are never chosen here). Controllers: we support 18 and Stella 17. Both have the Kid Vid and play its tapes’ narration, from audio files the player supplies; only we have the SNES pad adaptor. Only we can load Supercharger games through the real Supercharger’s own firmware, if supplied, from a tape signal made from the file. Both have a rewind. We never let a cartridge contact outside servers.',
      download: { href: '/downloads/atari2600-tests/atari2600-test-cartridges.zip', label: 'our 15 test cartridges in one zip, with a read-me and their source' } },
    /* 5200: rung 1 (Acid5200, a public suite): ours 47, Altirra 46 (as installed), Atari800 20, so #1 (28 Oct
       2026, after the cycle-exact ANTIC DMA; before that #2 with ours 41). */
    a5200: { test: 'Acid5200, the public test suite for the Atari 5200 by Avery Lee (version 1.2), ran on three emulators: one cartridge that runs 47 tests of the 6502 processor, ANTIC, GTIA and POKEY one after another, each checking the chip against the console. Altirra is by the author of the suite.',
      rows: [
        ['Ours', SITE_VERSION, '47 of 47', '28 Oct 2026'],
        ['Altirra', '4.40 (31 Dec 2025)', '46 of 47', '28 Oct 2026'],
        ['Atari800', 'd722329 (25 Sep 2026)', '20 of 47', '28 Oct 2026'],
      ],
      note: 'Altirra passes all 47 with its “Allow NMI blocking” setting turned on; it is off when Altirra is installed, and the row shows it off. All three gave the same result with the original BIOS and with their own free firmware. We pass all 47 since 28 Oct 2026: the last 6 needed ANTIC modelled one cycle at a time (DMA pattern, playfield start and stop timing, the HSCROL bug, virtual DMA and phantom player-missile DMA), and we pass the blocked NMI test, which Altirra fails unless that setting is on. Our own 3 test cartridges and 3 public processor tests (28 Oct 2026): we pass 6 of 6. Altirra and Atari800 could each run 1 of them, the timers cartridge: Altirra passes it and Atari800 fails it (with the serial port idle it reads the POKEY interrupt status as FF, where the hardware manual gives F7). Two need a key pressed on one controller only, which neither can replay, and the 3 processor tests are bare processor images that neither can be given. Games, with the original BIOS (ours 28 Oct 2026, Atari800 19 Oct 2026): the 155 files that did not play here on 18 Oct and can run on both, and Sinistar, each played 9 times with the input at different moments. Each plays 93 at least once, not quite the same ones (Cloudburst plays only here; a 3-D Asteroids demo plays once in 9, only on Atari800); Atari800 plays 48 every time and we play 46. The 3 that differ (Sinistar, Capture The Flag and a pre-release Fort Apocalypse) stop here only when a keypad key is held at an unlucky moment: the console is documented to report a held key about 8 times a frame, as we do, while Atari800 reports it once a frame. Jet Boot Jack stops on both, more often than not. A check on a real console would settle these, not made yet. Our own replacement firmware, used when no BIOS is supplied, is a separate question: on the same 158 files (19 Oct 2026), Atari800’s own free firmware plays 38 and ours plays the same 38. Both support the same cartridge boards.',
      download: { href: '/downloads/atari5200-tests/atari5200-test-cartridges.zip', label: 'our 3 test cartridges in one zip, with a read-me and their source' } },
    /* Pokemon mini (2026-10-21). Rung 2 of the ranking rule. Console answers:
       our bench results (photographed 30 Sep 2026, n = 1 console). Ours (served wasm 67094916)
       and PokeMini e1b0c60: verify-r.mjs re-run 21 Oct 2026, byte-identical to 18 Oct. GBE+ 05a05e9 (our own
       frontend, two shades) and MAME 0.288 (Lua script) measured 21 Oct 2026; games: the site-acceptance steps on all
       46 distinct files, all four 46 / 46. MAME: no shake input in its port list; 30 s of Togepi no Daibouken gives
       4 zero crossings (ours 20,160). Measured 18 and 21 Oct 2026. */
    pm: { test: 'There is no public test suite or scoreboard for the Pokémon mini, so we wrote our own test cartridges, ran them on a real Pokémon mini and photographed its answers, then ran them on each emulator below. There are 12 test cartridges; each paints the whole screen black or white to answer one question about the console (the processor, the picture chip, the clock, the save memory, the shake sensor).',
      rows: [
        ['Ours', SITE_VERSION, '10 of 12', '25 Oct 2026'],
        ['PokeMini', 'e1b0c60 (11 Mar 2026)', '9 of 12', '21 Oct 2026'],
        ['GBE+', '05a05e9 (24 Aug 2026)', '7 of 12', '21 Oct 2026'],
        ['MAME', '0.288', '4 of 12', '21 Oct 2026'],
      ],
      note: 'The answers come from one console, photographed on 30 Sep 2026, so a second console could move a row. The one row between us and PokeMini is dividing by zero: the console does not run the next instruction, and PokeMini does. No emulator here, us included, matches the console on the save memory row (that console had already been played, so its save memory was no longer as it left the factory) or on the clock at start-up. MAME has no input for the shake sensor and makes no sound. Games, tested on all four (21 Oct 2026): every game we tested (17 games, 46 versions) was started through the real Pokémon mini firmware, left for 20 seconds, then given every button; all four emulators play all 46. Two players (25 Oct 2026): two of our emulated consoles side by side, linked by infrared, play the link modes of Party mini, Zany Cards, Pokémon Tetris and Pichu Bros. mini, and complete Race mini’s ranking exchange.',
      more: { label: 'See all 12 tests', anchor: 'pme-bench', title: 'Pokémon mini: our test cartridges' },
      download: { href: '/downloads/pokemon-mini-tests/pokemon-mini-test-cartridges.zip', label: 'our 12 test cartridges in one zip, with a read-me and their source' } },
    alynx: { test: 'lynx-tests: 129 tests whose expected results were recorded on a real Lynx, judged test by test.',
      rows: [
        ['Ours', SITE_VERSION, '128 / 129', '7 Oct 2026'],
        ['Gearlynx', '1090365', '124 / 129', '7 Oct 2026'],
        ['Holani', '1.0.0', '121 / 129', '7 Oct 2026'],
        ['Handy', 'libretro-handy bc55d46', '23 / 129', '7 Oct 2026'],
        ['Mednafen Lynx', 'beetle-lynx fcdefcf', 'could not run any test', '7 Oct 2026'],
      ],
      note: 'Every emulator was given the same boot firmware except Handy, which only takes its own.',
      download: { href: '/downloads/atarilynx-tests/atarilynx-test-cartridges.zip', label: 'our 10 Lynx test cartridges in one zip (the parts lynx-tests does not cover), with a read-me and their source' } },
  };
  function compareHTML(key) {
    const C = COMPARE[key];
    if (!C) return '';
    return `<details class="emu-cmp"><summary>How we compare</summary>
      <p class="emu-lib-note">${esc(C.test)}</p>
      <table class="emu-lib-t emu-cmp-t"><thead><tr><th scope="col">Emulator</th><th scope="col">Version</th><th scope="col">Score</th><th scope="col">Measured</th></tr></thead>
      <tbody>${C.rows.map(r => `<tr${r[0] === 'Ours' ? ' class="emu-cmp-ours"' : ''}><th scope="row">${esc(r[0])}</th><td>${esc(r[1])}</td><td>${esc(r[2])}</td><td>${esc(r[3])}</td></tr>`).join('')}</tbody></table>
      <p class="emu-lib-note">${esc(C.note)}</p>
      ${C.download ? `<p class="emu-lib-note"><b>Download:</b> <a href="${esc(C.download.href)}" download>${esc(C.download.label)}</a>, MIT licence</p>` : ''}
      ${C.more ?`<button type="button" class="emu-proof" data-emu-more="${esc(key)}">${esc(C.more.label)}</button>` : ''}
    </details>`;
  }
  const CAT_LABEL = { commercial: 'Commercial', unl: 'Unlicensed and pirate', homebrew: 'Homebrew and public domain', hack: 'Hacks and translations', proto: 'Prototypes and betas', demo: 'Demos and samples', test: 'Testing and diagnostics' };

  /* proof: { fn, args, anchor, title } -- fn is a global tab builder already on the page. */
  const CARDS = [
    { name: 'Game & Watch', count: 3, rank: ['#1', 'Level with', 'MAME'], lib: 'gnw', sub: 'All three Sharp cores',
      plays: [P('gameandwatch', 'Game & Watch, 61 units')],
      key: ['Sharp SM510 (18 units)', 'Sharp SM5A (16 units)', 'Sharp SM511 (23) and SM512 (4)'],
      chips: [
        ['Processors', 'Sharp SM510; Sharp SM5A (its own SM500-family program counter and instruction table); Sharp SM511 and SM512'],
        ['Picture', 'Each chip’s LCD driver, segment by segment: SM510 2 x 16 segments x 4 commons; SM5A through its W shift registers and segment decoder; SM512 adds a third display file'],
        ['Sound', 'Piezo speaker on every unit; the SM511/SM512 melody generator with its melody data'],
        ['Unit', 'Each unit’s wiring, buttons, clock and demo mode'],
      ],
      score: { big: '61 of 61', text: 'units match the original chips exactly. Every unit passed all six parts of our test: start-up, timing, sound, save and restore, artwork and clock, and demo mode. A second emulator, built only from our written documents, passed all six too', date: '1 Nov 2026' },
      proof: { fn: 'gnwSm510EmulationTabHTML', args: [{ id: 'silver-ball' }, 'SM510'], anchor: 'gwemu-70-acceptance', title: 'Game & Watch: the acceptance tests' } },

    { name: 'Game & Watch colour', count: 1, rank: ['#1'], lib: 'tft', libLine: '2 games tested, 100% play, at 60fps', sub: 'An ARM digital twin, the only emulator ever made for these units',
      plays: [P('tft_mario', 'Super Mario Bros.'), P('tft_zelda', 'The Legend of Zelda')],
      key: ['STM32H7B0-class ARM Cortex-M7', 'LTDC display, DMA2D', 'OTFDEC decryption'],
      chips: [
        ['Processor', 'STM32H7B0-class system on chip: one ARM Cortex-M7 with double-precision float, at 88 MHz (measured from its own SysTick)'],
        ['Picture', 'LTDC two-layer display controller with its colour lookup table; DMA2D (Chrom-ART) graphics accelerator'],
        ['Storage', 'OCTOSPI memory-mapped external flash (1 MB Mario, 4 MB Zelda) read through OTFDEC, the on-the-fly AES-128 decryption the real firmware expects'],
        ['Other', 'SysTick and TIM5 timers, RTC, NVIC interrupts, GPIO buttons; SAI audio to the speaker'],
      ],
      score: { big: 'Real firmware', text: 'boots each unit’s own encrypted firmware. No public test suite exists for these units, so there is no public score yet, but we are building one', date: '' },
      proof: { fn: 'tftEmulationTabHTML', args: [{ id: 'reissue-super-mario-bros', model: 'HXA-001' }], anchor: '', title: 'Game & Watch colour: the ARM digital twin' } },

    { name: 'Game Boy', count: 1, rank: ['#1'], lib: 'gb', sub: 'One core for all three machines',
      plays: [P('gb', 'Game Boy'), P('gbc', 'Game Boy Color'), P('sgb', 'Super Game Boy')],
      key: ['Sharp SM83 CPU', 'DMG and Color picture units', 'Super Game Boy (ICD2 and the Super NES side)', '{chips.gb.licensed} licensed and {chips.gb.unlicensed} unlicensed cartridge chips'],
      chips: [
        ['Processor', 'Sharp SM83, with the Color’s double-speed mode'],
        ['Picture', 'The original (DMG) picture unit, dot by dot; the Color picture unit (revision C) with its palettes, video memory banks and HDMA block transfer'],
        ['Sound', 'The four-channel sound unit, both machines'],
        ['System', 'Timer, sprite DMA, interrupts, serial port, the Color’s infrared port'],
        ['Super Game Boy', 'The ICD2 chip that hands the Game Boy’s picture and command packets to the Super NES; the Super NES side at a high level: borders (the game’s own, or the Super Game Boy’s own read from your firmware), colours and palettes, the screen mask, up to four players'],
        ['Cartridges', '{chips.gb.licensed} licensed: MBC1, MBC2, MBC3 with its clock, MBC5, MBC6, MBC7 (tilt), HuC1, HuC3, MMM01, M161, TAMA5, Pocket Camera (a real webcam), Pocket Sonar. {chips.gb.unlicensed} unlicensed: Sintax, Vast Fame, Sachen MMC1 and MMC2, Wisdom Tree, Rocket Games, Li Cheng, Hitek, BBD, Makon, NT, PKJD, GGB-81, Story of Lasama, Chongwu, New GB Color HK0701 and HK0819, Gowin'],
        ['Accessories', '{chips.gb.accessories}'],
      ],
      score: { big: '259 of 264', text: 'on the public Game Boy accuracy board, with mealybug 24 of 24, Mooneye 97 of 97 and Blargg 51 of 51 on its rows; Game Boy Color mealybug 27 of 27. Two newer Game Boy Color suites, cgb-acid-hell and the AGE tests, built from their published source: 49 of 50 on the machines we model, against SameBoy 1.0.5’s 39 on the same 50 (every result is on the Game Boy Color tab). {games} games tested ({files} files). {play}.', date: '9 Nov 2026 (tests, Color suites and games)' },
      proof: { fn: 'gbEmulationTabHTML', args: [{ system: 'gb' }], anchor: 'gbe-score', title: 'Game Boy: the score' } },

    { name: 'NES', count: 1, rank: ['#1'], lib: 'nes', sub: 'NES, Famicom and the Disk System',
      plays: [P('nes', 'NES'), P('fds_famicom', 'Famicom'), P('fds_famicom', 'Disk System'), P('rob', 'R.O.B.')], grid2: true,
      key: ['Ricoh 2A03 / 2A07', 'Ricoh 2C02 / 2C07 and Vs. PPUs', '{chips.nes.mappers} mappers'],
      chips: [
        ['Processor and sound', 'Ricoh 2A03 (NTSC) and 2A07 (PAL), plus Dendy timing'],
        ['Picture', 'Ricoh 2C02 and 2C07; the Vs. System RGB picture units 2C03, 2C04 (four versions) and 2C05 (five versions)'],
        ['Disk System', 'The RAM adapter (32 KB RAM, timer interrupt), the disk drive and its wavetable sound'],
        ['Cartridge sound', 'MMC5, Namco 163, Konami VRC6 and VRC7 (FM), Sunsoft 5B'],
        ['Cartridges', '{chips.nes.mappers} mapper numbers plus the Disk System: MMC1, MMC2, MMC3, MMC4, MMC5, MMC6, FME-7, Konami VRC1 to VRC7, Namco 163, Tengen RAMBO-1, Bandai FCG, Irem G-101, the Study Box, homebrew boards such as Action 53 and GTROM, and many more'],
        ['Accessories', '{chips.nes.accessories}'],
      ],
      score: { big: '147 of 147', text: 'on AccuracyCoin (its 4 November 2026 build), the public NES accuracy test cartridge, judged by the cartridge itself. R.O.B. is built in too: a 3D R.O.B. stands beside the game, reads its screen flashes and plays Gyromite and Stack-Up, with no add-on to install. {games} games tested ({files} files). {play}.', date: '8 Nov 2026 (tests), 25, 26 and 30 Oct, 1 Nov and 8 Nov 2026 (games), 8 Nov 2026 (core)' },
      proof: { fn: 'nesEmulationTabHTML', args: [{ id: 'nes-proof', system: 'nes', catalogue: 'nes' }], anchor: 'nese-2', title: 'NES: the score, AccuracyCoin' } },

    { name: 'Pokémon mini', count: 1, rank: ['#1'], lib: 'pm', sub: '',
      plays: [P('pokemini', 'Pokémon mini')],
      key: ['Epson S1C88 CPU', 'PRC picture unit', 'EEPROM, IR, rumble, shake'],
      chips: [
        ['Processor', 'Epson S1C88'],
        ['Picture', 'The PRC picture processor and the 96 x 64 panel, with its blended greys'],
        ['Sound', 'Square-wave sound'],
        ['System', 'Timers, battery-backed clock, 8 KB save EEPROM'],
        ['Accessories', '{chips.pm.accessories}'],
      ],
      score: { big: '10 of 12', text: 'on the Pokémon mini tests (12 test cartridges we wrote, whose answers were photographed on a real console). {games} games tested ({files} versions). {play}.', date: '25 Oct 2026 (tests), 29 Oct 2026 (games)' },
      proof: { fn: 'pmEmulationTabHTML', args: [{}], anchor: '', title: 'Pokémon mini: how it is built and checked' } },

    { name: 'Atari 2600', count: 1, rank: ['#1', 'Level with', 'Stella'], lib: 'a2600', sub: '',
      plays: [P('atari2600', 'Atari 2600')],
      key: ['MOS 6507', 'TIA', 'RIOT 6532', '{chips.a2600.types} cartridge types'],
      chips: [
        ['Processor', 'MOS 6507'],
        ['Picture and sound', 'TIA'],
        ['System', 'RIOT 6532 (RAM, timer, ports)'],
        ['Cartridges', '{chips.a2600.types} cartridge types: 46 bank-switching schemes with their Superchip forms (F8, F6, F4, E0, E7, FE, 3F, FA, DPC for Pitfall II, the Supercharger and 36 more) and 4 ARM coprocessor schemes (DPC+, CDF, BUS, ELF)'],
        ['Accessories', '{chips.a2600.accessories}'],
      ],
      score: { big: '18 of 18', text: 'on the 2600 tests (15 test cartridges we wrote, 3 public processor tests). {games} games tested ({files} files). {play}. None of the {rivalnone} that don’t plays on Stella either. Of the {notplays} that don’t, Stella plays {rivalplays}.', date: '7 Oct 2026 (tests), 29 Oct 2026 (games), 23 Oct 2026 (against Stella)' },
      proof: { fn: 'atariEmulationTabHTML', args: [{ catalogue: 'atari2600' }], anchor: 'atari2600emu-10-interface', title: 'Atari 2600: the interface and the board' } },

    { name: 'Atari 5200', count: 1, rank: ['#1'], lib: 'a5200', sub: '',
      plays: [P('atari5200', 'Atari 5200')],
      key: ['6502C SALLY', 'ANTIC, GTIA', 'POKEY'],
      chips: [
        ['Processor', '6502C (SALLY)'],
        ['Picture', 'ANTIC and GTIA'],
        ['Sound and keypad', 'POKEY'],
        ['Firmware', 'The original BIOS when your game server has it, else our own replacement (you can choose ours in the play window’s Settings). The 32 games that use Atari’s own code need the original. The three games made for the later two-port console start on its own firmware, from your game server'],
        ['Cartridges', '{chips.a5200.boards} boards: 4 KB to 32 KB, Bounty Bob (40 KB) and Super Cart (64 to 512 KB)'],
        ['Accessories', '{chips.a5200.accessories}'],
      ],
      score: { big: '47 of 47', text: 'on Acid5200, the public 5200 test suite. With the original BIOS: {games} games tested ({files} files). {play}. Without it, on our own replacement firmware: 454 of 522 files play.', date: '28 Oct 2026 (tests and games)' },
      proof: { fn: 'atariEmulationTabHTML', args: [{ catalogue: 'atari5200' }], anchor: 'atari5200emu-10-verification', title: 'Atari 5200: verification' } },

    { name: 'Atari 7800', count: 1, rank: ['#1'], lib: 'a7800', sub: '',
      plays: [P('atari7800', 'Atari 7800')],
      key: ['6502C SALLY', 'MARIA', 'TIA, RIOT'],
      chips: [
        ['Processor', '6502C (SALLY)'],
        ['Picture', 'MARIA'],
        ['Sound and ports', 'TIA (sound and inputs), RIOT 6532, INPTCTRL'],
        ['Cartridge sound', 'POKEY (one or two), YM2151, COVOX'],
        ['BIOS', 'Atari’s BIOS when your game server has it (the PAL one for PAL games), else the cartridge starts directly. The 183 files that show nothing without it need it'],
        ['Cartridges', '{chips.a7800.boards} boards: flat, SuperGame, Absolute, Activision, VersaBoard, SOUPER, the bankset boards of new homebrew, their RAM and bank variants, and 2600 cartridges'],
        ['Accessories', '{chips.a7800.accessories}'],
      ],
      score: { big: '27 of 27', text: 'on the 7800 tests (24 test cartridges we wrote, 3 public processor tests). {games} games tested ({files} files). {play}. The {rivalnone} that don’t, don’t play on A7800 either. Of the {notplays} that don’t, A7800 plays {rivalplays}. A7800 won’t load {rivalrefuses} files that we run.', date: '7 Oct 2026 (tests), 29 Oct 2026 (games), 23 Oct 2026 (against A7800)' },
      proof: { fn: 'atariEmulationTabHTML', args: [{ catalogue: 'atari7800' }], anchor: 'atari7800emu-11-interface', title: 'Atari 7800: the interface and the board' } },

    { name: 'Atari Lynx', count: 1, rank: ['#1'], lib: 'alynx', sub: '',
      plays: [P('atarilynx', 'Atari Lynx')],
      key: ['Mikey (65C02)', 'Suzy', 'EEPROM'],
      chips: [
        ['Mikey', 'The 65C02 processor, timers, display, four sound channels and the serial port'],
        ['Suzy', 'Sprite engine, maths unit, buttons and the cartridge port'],
        ['Cartridges', '.lnx, LNX2 and headerless images, BLL homebrew programs, cartridge RAM, save EEPROMs 93C46 to 93C86'],
        ['Boot', 'Atari’s boot program when your game server has it, else our own; Atari’s is never needed'],
      ],
      score: { big: '128 of 129', text: 'on the Lynx hardware test suite, whose answers were recorded on real Lynx consoles', date: '7 Oct 2026 (tests), 29 Oct 2026 (games)' },
      proof: { fn: 'atariEmulationTabHTML', args: [{ catalogue: 'atarilynx' }], anchor: 'atarilynxemu-11-interface', title: 'Atari Lynx: the interface and the board' } },
  ];
  const TJ = { name: 'Tetris Jr.', plays: [P('tetrisjr', 'Tetris Jr.')],
    text: 'Not emulated: rebuilt. No program from this 1988 prototype survives to emulate, so its rules were rebuilt from the only unit known, and it is not counted in the 11.' };

  const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const pics = list => list.map(p => p.img
    ? `<span class="emu-pic"><img src="${IMG(p.img)}" alt="" loading="lazy"><span>${esc(p.name)}</span></span>`
    : `<span class="emu-pic emu-pic-name"><b>${esc(p.name)}</b></span>`).join('');

  const n = x => Number(x).toLocaleString('en-AU');
  /* line: a hand-worded line that replaces the counted one (the colour units, 2026-10-18). */
  function ladderHTML(key, line) {
    const C0 = ladder && ladder.cards[key];
    if (!C0) return '';
    const COLS = (ladder.columns || ['plays', 'ingame', 'menus', 'boots', 'nothing', 'untested']);
    const C = { untested: C0.untested, rungs: {}, byCat: C0.byCat && {} };
    for (const [k, , , from] of RUNGS) C.rungs[k] = from.reduce((a, f) => a + (C0.rungs[f] || 0), 0);
    if (C0.byCat) for (const [cat, row] of Object.entries(C0.byCat))
      C.byCat[cat] = [...RUNGS.map(([, , , from]) => from.reduce((a, f) => a + (row[COLS.indexOf(f)] || 0), 0)), 0, 0, row[COLS.indexOf('untested')] || 0];
    const total = RUNGS.reduce((a, [k]) => a + (C.rungs[k] || 0), 0);
    if (!total) return '';
    /* The percentage is the share that Plays (2026-10-18), rounded DOWN so 99.6% never reads 100%. */
    const said = RUNGS.map(([k, label]) => `${label} ${n(C.rungs[k] || 0)}`).join(', ');
    const segs = RUNGS.filter(([k]) => C.rungs[k] > 0).map(([k]) => `<span class="lad-${k}" style="flex-grow:${C.rungs[k]}"></span>`).join('');
    const key_ = RUNGS.map(([k, label]) => `<li><i class="lad-${k}"></i>${label} <b>${n(C.rungs[k] || 0)}</b></li>`).join('');
    /* rungs x kinds of game, only where a system has more than one kind (as before) */
    const kinds = Object.keys(CAT_LABEL).filter(k => C.byCat && C.byCat[k]);
    let table = '';
    if (kinds.length > 1) {
      const cols = RUNGS.map(([k, label], i) => [i, label]).filter(([i]) => kinds.some(c => C.byCat[c][i] > 0));
      const untested = kinds.some(c => C.byCat[c][5] > 0);
      /* A shelf the card also shows apart (25 Oct: the Game Boy card's table gets a Super Game
         Boy section): its own rows by kind, under its name, from ladder.json byShelf. */
      const part = sh => {
        const P0 = C0.byShelf[sh], rows = {};
        for (const [cat, row] of Object.entries(P0.byCat || {})) rows[cat] = [...RUNGS.map(([, , , from]) => from.reduce((a, f) => a + (row[COLS.indexOf(f)] || 0), 0)), 0, 0, row[COLS.indexOf('untested')] || 0];
        const ks = Object.keys(CAT_LABEL).filter(k => rows[k]);
        return ks.length ? `<tr class="emu-lad-part"><th scope="rowgroup" colspan="${cols.length + 1 + (untested ? 1 : 0)}">${esc(P0.label || sh)}</th></tr>${
          ks.map(c => `<tr><th scope="row">${CAT_LABEL[c]}</th>${cols.map(([i]) => `<td>${n(rows[c][i])}</td>`).join('')}${untested ? `<td>${n(rows[c][5])}</td>` : ''}</tr>`).join('')}` : '';
      };
      table = `<table class="emu-lib-t emu-lad-t"><thead><tr><th></th>${cols.map(([, l]) => `<th scope="col">${l}</th>`).join('')}${untested ? '<th scope="col">Not yet tested</th>' : ''}</tr></thead><tbody>${
        kinds.map(c => `<tr><th scope="row">${CAT_LABEL[c]}</th>${cols.map(([i]) => `<td>${n(C.byCat[c][i])}</td>`).join('')}${untested ? `<td>${n(C.byCat[c][5])}</td>` : ''}</tr>`).join('')}${
        C0.byShelf ? Object.keys(C0.byShelf).map(part).join('') : ''}</tbody></table>`;
    }
    return `<div class="emu-lad">
      <p class="emu-lib-line">${line ? esc(line) : `${n(total)} games tested, ${Math.floor(C.rungs.plays * 100 / total)}% play${C.untested ? `, ${n(C.untested)} not yet` : ''}`}</p>
      <div class="emu-lad-bar" role="img" aria-label="${esc('Compatibility: ' + said)}">${segs}</div>
      <ul class="emu-lad-key" aria-hidden="true">${key_}</ul>
      ${table ? `<details class="emu-lad-more"><summary>By kind of game</summary><div class="emu-lad-tw">${table}</div></details>` : ''}
    </div>`;
  }
  function fillLadders(host) {
    host.querySelectorAll('[data-lad]').forEach(el => { const l = el.dataset.ladLine; el.innerHTML = ladderHTML(el.dataset.lad, l) || (l ? `<p class="emu-lib-line">${esc(l)}</p>` : ''); });
    host.querySelectorAll('[data-score-t]').forEach(el => { el.textContent = scoreText(el.dataset.scoreT, el.dataset.scoreLad); });
    host.querySelectorAll('[data-chip-t]').forEach(el => {
      const t = chipText(el.dataset.chipT);
      el.textContent = t == null ? '' : t; el.hidden = t == null;
      if (el.tagName === 'DD' && el.previousElementSibling) el.previousElementSibling.hidden = t == null;
    });
  }
  /* THE CHIP COUNTS AND ACCESSORIES (30 Oct 2026: "We seem to keep adding homebrew chips and I don't see
     these numbers keep growing"). A card's {chips.<card>.<name>} comes from ladder.json `chips`, written by
     tools/compat-ladder/chips.mjs from the served cores' own tables where one exists (the NES's dispatched
     mapper numbers, its Controller list, the 7800's boards), so a core install moves the card with it; the
     rest is counted there by hand, each with how. Until ladder.json arrives (or if it fails, or the value is
     empty, as the Lynx's accessories are) the item is left out, never shown stale. */
  function chipText(t) {
    if (!/\{chips\./.test(t)) return t;
    let miss = false;
    const out = t.replace(/\{chips\.(\w+)\.(\w+)\}/g, (m, c, k) => {
      const v = ladder && ladder.chips && ladder.chips[c] ? ladder.chips[c][k] : null;
      if (v == null || v === '') { miss = true; return m; }
      return typeof v === 'number' ? n(v) : String(v);
    });
    return miss ? null : out;
  }
  function chipEl(tag, t) {
    if (!/\{chips\./.test(t)) return `<${tag}>${esc(t)}</${tag}>`;
    const v = chipText(t);
    return `<${tag} data-chip-t="${esc(t)}"${v == null ? ' hidden' : ''}>${v == null ? '' : esc(v)}</${tag}>`;
  }
  /* THE COUNTED SENTENCES (22 Oct 2026). A card's "N games tested (M files). N play." line
     drifted after every list cut while it was typed by hand (the 2600 and 7800 lines). The
     numbers now come from the same ladder.json card as its Plays / Boots / Nothing bar: {games} is the
     bar's total, {files} the card's FILE_TOTALS entry below, {play} "All play" or "N play", {notplays} the
     bar's Boots plus Nothing. Before ladder.json arrives (or if it fails, or FILE_TOTALS has no entry) the first
     counted sentence and every sentence after it are left out (the 5200's "Without it" leans on the
     sentence before it), never shown stale; a {notplays} of zero leaves out only its own sentence.
     `build.mjs --check` refuses a hand-typed count in these lines. */
  /* FILE TOTALS (22 Oct 2026): the "(M files)" part keeps the file count of each card's dated
     comparison run, never typed into the card text; the games and plays numbers stay generated from
     ladder.json. Update an entry only from a new dated run. */
  const FILE_TOTALS = {
    gb: { files: 4484 },
    pm: { files: 49 },
    nes: { files: 20622 },
    a2600: { files: 2089 },
    a5200: { files: 502 },
    a7800: { files: 805 },
  };
  function ladCounts(key) {
    const C0 = ladder && ladder.cards[key];
    if (!C0) return null;
    const sum = from => from.reduce((a, f) => a + (C0.rungs[f] || 0), 0);
    const games = RUNGS.reduce((a, [, , , from]) => a + sum(from), 0), plays = sum(RUNGS[0][3]);
    /* rivalnone / rivalplays / rivalrefuses (23 Oct 2026): from the recorded comparison with the
       other emulator (build.mjs, THE RIVAL SENTENCES); absent or zero leaves its sentence out. */
    return games ? Object.assign({ games, plays, files: FILE_TOTALS[key] && FILE_TOTALS[key].files, notplays: games - plays }, C0.rival || {}) : null;
  }
  function scoreText(text, key) {
    if (!/\{\w+\}/.test(text)) return text;
    let k = ladCounts(key);
    if (k && /\{files\}/.test(text) && !(k.files > 0)) k = null;   /* no FILE_TOTALS entry: leave every counted sentence out */
    let cut = false;
    return text.split(/(?<=\.)\s+/).map(s => {
      if (cut || (!k && /\{\w+\}/.test(s))) { cut = true; return null; }
      let ok = true;
      const t = s.replace(/\{(\w+)\}/g, (m, w) => {
        if (!k) { ok = false; return m; }
        if (w === 'play') return k.plays === k.games ? 'All play' : `${n(k.plays)} play`;
        if (!(k[w] > 0)) { ok = false; return m; }
        return n(k[w]);
      });
      return ok ? t : null;
    }).filter(Boolean).join(' ');
  }

  function cardHTML(c, i) {
    /* rank: [place, then grey note lines, one per line] from the card's measured comparison (2026-10-18); none = not ranked yet.
       G&W 'Level with MAME' (decided: a comparison, allowed under the 2026-10-04 scoreboard rule): the 4 Oct
       acceptance A2 ran all 61 units against the reference port, 34 identical at every step and the 27 SM511/512 as the reference. */
    return `<article class="emu-card">
      <div class="emu-top"><div class="emu-pics${c.grid2 ? ' emu-pics-2x2' : ''}">${pics(c.plays)}</div>${c.rank ? `<div class="emu-rank"><b>${esc(c.rank[0])}</b>${c.rank.slice(1).filter(Boolean).map(t => `<span>${esc(t)}</span>`).join('')}</div>` : ''}</div>
      <h3 class="emu-name">${esc(c.name)}${c.count > 1 ? ` <span class="emu-n">${c.count} of the 11 emulators built</span>` : ''}</h3>
      ${c.sub ? `<p class="emu-sub">${esc(c.sub)}</p>` : ''}
      <ul class="emu-key">${c.key.map(k => chipEl('li', k)).join('')}</ul>
      <details class="emu-chips"><summary>Every chip it models${c.chips.some(([k]) => k === 'Accessories') ? ', and the accessories' : ''}</summary>
        <dl>${c.chips.map(([k, v]) => `<dt${chipText(v) == null ? ' hidden' : ''}>${esc(k)}</dt>${chipEl('dd', v)}`).join('')}</dl>
      </details>
      ${c.libLine ? `<p class="emu-lib-line">${esc(c.libLine)}</p>` : `<div class="emu-lad-slot" data-lad="${esc(c.lib)}">${ladderHTML(c.lib)}</div>`}
      ${compareHTML(c.lib)}
      <div class="emu-score"><b>${esc(c.score.big)}</b> <span${/\{\w+\}/.test(c.score.text) ? ` data-score-lad="${esc(c.lib)}" data-score-t="${esc(c.score.text)}"` : ''}>${esc(scoreText(c.score.text, c.lib))}</span>${c.score.date ? `<small>Measured ${esc(c.score.date)}</small>` : ''}</div>
      <button type="button" class="emu-proof" data-emu-proof="${i}">See the proof</button>
    </article>`;
  }

  function render() {
    const host = document.getElementById('emu-cards');
    if (!host || host.dataset.built) return;
    host.dataset.built = '1';
    if (!document.getElementById('emu-lad-legend')) {
      const lg = document.createElement('details');
      lg.id = 'emu-lad-legend';
      lg.className = 'emu-lad-more emu-lad-legend';
      lg.innerHTML = `<summary>Compatibility categories</summary>
        <dl>${RUNGS.map(([k, label, text]) => `<dt><i class="lad-${k}"></i>${label}</dt><dd>${esc(text)}</dd>`).join('')}</dl>
        <p class="emu-lib-note">Each game is counted once, with its versions grouped.</p>`;
      host.parentNode.insertBefore(lg, host);
    }
    /* Tetris Jr. sits to the right of Pokemon mini, so the four Atari cards sit together (21 Oct). */
    const tjHTML = `<article class="emu-card emu-card-tj"><div class="emu-pics">${pics(TJ.plays)}</div>
        <h3 class="emu-name">${esc(TJ.name)} <span class="emu-n emu-n-alt">rebuilt, not emulated</span></h3>
        <p class="emu-sub">${esc(TJ.text)}</p>
        <p class="emu-lib-line">1 prototype, playable and tested.</p></article>`;
    host.innerHTML = CARDS.map((c, i) => cardHTML(c, i) + (c.lib === 'pm' ? tjHTML : '')).join('');
    ladderCSS();
    loadLadder().then(() => fillLadders(host));
    host.addEventListener('click', e => {
      const b = e.target.closest('[data-emu-proof]');
      if (b) openProof(CARDS[+b.dataset.emuProof]);
      /* "See all N tests": the card's own proof tab, opened at the compare entry's anchor */
      const m = e.target.closest('[data-emu-more]');
      const C = m && COMPARE[m.dataset.emuMore];
      const card = C && CARDS.find(x => x.lib === m.dataset.emuMore);
      if (card && card.proof) openProof({ proof: Object.assign({}, card.proof, { anchor: C.more.anchor, title: C.more.title }) });
    });
  }

  function overlay() {
    let ov = document.getElementById('emu-proof-overlay');
    if (ov) return ov;
    ov = document.createElement('div');
    ov.className = 'overlay';
    ov.id = 'emu-proof-overlay';
    ov.setAttribute('role', 'dialog');
    ov.setAttribute('aria-modal', 'true');
    ov.innerHTML = `<div class="modal" style="max-width:1100px;">
      <div class="modal-head"><div><div class="modal-sub">The proof</div><div class="modal-title" id="emu-proof-title"></div></div>
      <button class="modal-close" type="button" aria-label="Close">×</button></div>
      <div class="emu-proof-body" id="emu-proof-body"></div></div>`;
    ov.addEventListener('click', e => { if (e.target === ov || e.target.closest('.modal-close')) closeOverlay('emu-proof-overlay'); });
    document.body.appendChild(ov);
    return ov;
  }

  function openProof(c) {
    const p = c && c.proof;
    if (!p) return;
    if (window.__cwNoDocs) return;   // Hardware and Emulation pages only on crystalworlds.media (4 Nov 2026, index.html head)
    const ov = overlay();
    let html = '';
    try {
      const f = window[p.fn];
      const r = typeof f === 'function' ? f.apply(null, p.args) : '';
      html = typeof r === 'string' ? r : (r && r.header ? '<div class="hw-tab">' + r.header + r.body + (r.sources || '') + '</div>' : '');
    } catch (e) { html = ''; }
    if (!html) html = '<p style="padding:20px">This part of the documentation has not loaded yet. Try again in a moment.</p>';
    document.getElementById('emu-proof-title').textContent = p.title;
    { const sub = ov.querySelector('.modal-sub'); if (sub) sub.textContent = p.sub || 'The proof'; }
    const body = document.getElementById('emu-proof-body');
    body.innerHTML = html;
    if (typeof openOverlay === 'function') openOverlay('emu-proof-overlay'); else ov.classList.add('open');
    /* The terms box before an Emulation page (docterms.js, 4 Nov 2026), from the first frame; a
       Hardware page has none. Asked again after the jump to the anchor, which it then holds still. */
    const isEmu = !(p.fn === 'cwSysDocHTML' && p.args && p.args[1] === 'hardware');
    if (window.cwDocTerms) window.cwDocTerms.proof(ov, isEmu);
    const target = p.anchor && body.querySelector('#' + CSS.escape(p.anchor));
    requestAnimationFrame(() => {
      if (target) target.scrollIntoView({ block: 'start' });
      else ov.scrollTop = 0;
      const x = ov.querySelector('.modal-close'); if (x) try { x.focus({ preventScroll: true }); } catch (_) {}
      if (window.cwDocTerms) window.cwDocTerms.proof(ov, isEmu);
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', render); else render();
  /* openDoc: any { fn, args, anchor, title } in the same window (deeplinks.js: #/<system>/hardware|emulation, 2026-10-21) */
  window.CwEmuCards = { render, cards: CARDS, openProof: i => openProof(CARDS[i]), openDoc: p => openProof({ proof: p }) };
})();
