# Changelog

All notable changes to this project are recorded here. The format is based on
[Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

## [Unreleased]

## [2.0.0] - 2026-11-06

**CrystalWorlds.Media 2.0.0** is the first release of CrystalWorlds.Media, a
new project with a new site: one page for your own films, shows and games,
played in the browser by emulators written for this project. The site hosts
no games, no console firmware and no films: everything plays from your own
files and your own media server.

### Added

#### Emulators and systems
- **Eleven emulators written for this project**, plus the rebuilt Tetris Jr.
  prototype, cover fourteen consoles and handhelds: every Nintendo Game & Watch
  (61 units on our Sharp SM510, SM5A and SM511 / SM512 cores), the two colour
  Game & Watch units (Super Mario Bros. and The Legend of Zelda), Tetris Jr.,
  Game Boy, Game Boy Color (with the Super Game Boy), Pokémon mini, NES, Famicom,
  the Famicom Disk System, and the Atari 2600, 5200, 7800 and Lynx. One play
  window runs them all.
- **#1 emulators in the world on nine systems.** Each system's card on Home
  gives its measured score beside other emulators, with the date it was
  measured:
  - Game & Watch: 61 of 61 units pass all six parts of our test (start-up,
    timing, sound, save and restore, artwork and clock, demo mode).
  - Colour Game & Watch: each unit boots its own encrypted firmware, at 60
    frames a second. No public test suite exists for these units.
  - Game Boy: 258 of 264 on the public Game Boy accuracy board, level with
    DocBoy on the 261 rows every emulator was run on; mealybug 24 of 24, Mooneye
    97 of 97, Blargg 51 of 51. On the newer cgb-acid-hell and AGE tests, 32 of
    50, ahead of SameBoy 0.16.2's 25.
  - NES: 146 of 146 on AccuracyCoin (its 20 October 2026 build); no other
    emulator measured passes all 146 (Nestopia UE 2.0.0: 144). 233 mapper
    numbers plus the Disk System.
  - Pokémon mini: 10 of 12 on our own test cartridges, whose answers were
    photographed on a real console (PokeMini: 9).
  - Atari 2600: 18 of 18 on our tests, level with Stella.
  - Atari 5200: 47 of 47 on Acid5200, the public 5200 test suite (Altirra 4.40:
    46 on its default settings).
  - Atari 7800: 27 of 27 on our tests (A7800: 11).
  - Atari Lynx: 128 of 129 on the Lynx hardware test suite (Gearlynx: 124).
- **Games that play**, from the compatibility list: Game Boy and Color 2,806 of
  2,826 games; NES, Famicom and Disk System 4,348 of 4,530; Atari 2600 805 of
  808; Atari 5200 484 of 495 with the original BIOS; Atari 7800 314 of 317;
  Atari Lynx 812 of 860; Pokémon mini 17 of 17; Game & Watch 61 of 61.
- **The console's own firmware comes first.** The Game Boy, Game Boy Color,
  Super Game Boy, Disk System, Pokémon mini, Atari 5200, 7800 and Lynx start
  on your own console firmware whenever you have it. Without it, the Atari
  5200 and Lynx start on our own replacement firmware and the 7800 starts the
  cartridge directly.
- **Our own test cartridges** for the Pokémon mini, Atari 2600, 5200, 7800 and
  Lynx, ready to download with their source, under the MIT licence.

#### Checked by rebuilding
- **A stranger's build, from our words alone.** To show that our
  documentation is accurate, each system's Emulation tab is handed to a
  builder who has never seen our code. The builder makes an emulator from the
  tab alone, and that build is tested against ours. Home lists each result
  with its date, the build time, and the first characters of the SHA-256
  fingerprint of the exact emulator file the site serves, so anyone can
  confirm which build was tested.
- **Matches ours on all nine systems:** Game & Watch (all 6 test sections pass
  on all 61 games), Pokémon mini (54 of 54 games identical in picture and
  sound), Game Boy (identical on 170 of 170 tests, every AGE and mealybug
  test), Game Boy Color, NES (identical on all 9 test sections: 200 of 200
  cartridge types, 208 of 208 library games), Atari 2600 (167 of 167 runs
  identical), Atari 7800 (332 of 332), Atari 5200 (68 of 68) and Atari Lynx
  (40 of 40). Every one of these builds was made from the documents alone.
- **What it means:** where a stranger with only our tab builds an emulator that
  behaves exactly like ours, the tab describes the machine completely.

#### Documentation
- **Hardware and Emulation pages** for every system: how the console works,
  how our core is built and tested, and how it compares with other emulators,
  with the date of every measurement.
- **A compatibility list** for every system: Plays, Boots or Nothing, the
  reason when a game does not play, and the date it was last tested. Known
  releases not found yet are listed by name as "Untested / not found" and are
  never counted.
- **Home, Features, Timeline and About** windows on crystalworlds.media, each
  with its own address to share. Home opens with our film, Attention to Detail,
  in the site's own player.

#### Your games, four ways
- **A content pack:** a .zip of your own game files and console firmware,
  opened in the browser and kept on this device.
- **Play a file:** drop one game file on the box and it plays straight away,
  with nothing uploaded or kept.
- **The firmware folder** of a copy of the site you host yourself.
- **A Crystal Worlds game server:** the site connects to a Crystal Worlds game
  server, a separate program in its own repository, approved once from the
  server.
- **The vault** needs no account and no password: your browser holds a random
  vault code, and the vault keeps only that code and, if you add one, a
  recovery email (Settings, Access Code).

#### The wall, search, variants, manuals and covers
- **One wall** for films, shows and games: live device tiles or box art,
  playing clips, the Display, Sort and Filter menus, the Systems menu, and a
  fair share of tiles for each system picked in Shuffle order.
- **Search as you type** across games, films and shows; a game is found by its
  name in other regions too, and quote marks are ignored.
- **Variants:** one tile per game, with every region, revision and release in
  its Variant menu; Play opens the game on the box, and a variant plays only
  when you pick it. A game with a
  commercial release shows under the Commercial box even when its tile's main
  copy is another kind, and a tile is always found by its own name. Each system has its
  own tile of a game: the NES, Famicom and Disk System copies are separate
  tiles, and a search shows each one. Hacks and translations are always
  versions of their original game and never a tile of their own.
- **Manuals:** the original instruction booklets in a page-turn viewer, at
  Normal or Large size. 1,680 NES, Famicom and Disk System tiles have one.
- **Covers:** a game shows its box. A game with no box art gets a clean box of
  its own system instead of an empty space.
- **The Continue row** puts unfinished films, next episodes and games in one
  order, by when each was last played.
- **The System Switcher:** LB and RB (or `,` `.`) slide a carousel of
  systems over the wall. On the wall, X and Y (or `O` and `W`) switch Movies and
  Widgets on and off.

#### The Control Bar
- **Everything in every game:** Rewind (hold it and the game runs backward),
  Pause, eight save slots per game with a picture, the date, the play time and
  a note, saved to a file and loaded on another device if you like, Speed
  (normal, two or four times), Mute, Full screen, Screenshots, Variants,
  Manuals, and Keys and help.
- **Cheats** where a game has a cheat list: Game Genie, GameShark, Pro Action
  Replay and memory codes, off until you switch them on.
- **Nothing hidden on a narrow screen:** the labels come off first, then the
  buttons wrap onto another line.

#### Media servers
- **Emby and Jellyfin.** Sign in with your user name and password, pick
  yourself from the server's users, or use Quick Connect on Jellyfin. Both can
  stay signed in; the switch on each tile chooses the one in use.
- **Formats browsers give up on.** Files the browser can play are played as
  they are. MKV is repackaged in the browser, and 10-bit HEVC, AV1, DivX and
  Xvid are converted live. Dolby Digital, Dolby Digital Plus and DTS are
  decoded to stereo. When nothing else will do, the player asks your server to
  convert; Settings chooses Auto, Always or Never.
- **Subtitles** drawn by the page, **Up Next** with skipped intros where the
  server knows them, progress saved back to your server, and silent
  **widgets** on the wall: clock, weather, trailers, film facts, collection
  stats and cast.

#### Phones, folds and controllers
- **Phones and tablets:** the buttons drawn on each device are the buttons you
  press, a see-through pad appears when a game needs more, rumble games buzz the
  phone, tilt games follow it, and the site can be added to the home screen.
- **Folds:** the Systems menu and Settings open full screen on phones, folds
  and small tablets, either way up, and every window (Home, Features,
  Compatibility, Timeline, About) has a close button there.
- **Controllers:** A is A on Nintendo-style and Xbox-style pads, players two
  to four join on their own pads where a game allows it, and every key and
  button can be changed in Settings. A TV remote's arrows, OK, Back and colour
  keys work across the site.

#### R.O.B.
- **R.O.B., the Robotic Operating Buddy,** has his own place on the wall. Start
  Gyromite or Stack-Up and a 3D R.O.B. stands beside the game, reads its screen
  flashes and moves his arms and hands at the real robot's speed. Set out his
  gyros, trays and blocks with a mouse, a finger or a controller; a spinning
  gyro on its tray presses the button the game waits for, and Stack-Up checks
  your blocks against the picture it asked for. Play Time lets you drive him
  yourself. It runs in the browser, with no add-on to install.

#### Game & Watch
- **All 61 classic units play,** each with its own on-screen buttons in
  close-up view and full screen; the units with a clock start at the right
  time of day.
- **The SM5A units keep time:** their one-second counter ticks every 60.00
  frames on 15 of 15 units that can be measured, and their beep is at the
  right pitch.
- **The colour units** (Super Mario Bros. and The Legend of Zelda) run at the
  panel's 60 frames a second, with their music at its own tempo and clean
  sound.
- **Tetris Jr.,** a 1988 prototype, is rebuilt and playable. No program from it
  survives, so it is rebuilt rather than emulated.
- **Each unit's drawer** opens on a still of its own artwork with its screen
  running the demo.

#### Licence
- **One project licence,** the CrystalWorlds.Media Project Licence 1.1, covers
  the code and the assets.
- **Research and documentation** may be read, cited and quoted in reasonable
  excerpts with credit (in paid work too), and its facts may be used, with
  credit, to improve your own projects. It may not be copied wholesale,
  presented as someone else's own work, or used as the source to build an
  emulator or a front end (section 3A of the licence).
- **The source code** is provided so anyone can check our results. It and the
  emulator cores may not be used to develop other front-end software
  (section 3B).
- **No AI-built copies and no AI training.** No AI or other automated system
  may build software from our documentation or source, or be trained on
  them, and text and data mining is reserved. Repeating our clean-room proof,
  an AI included, to check our results is allowed (sections 3C to 3E).

### Known limits
- **NES:** 182 of the 4,530 games tested do not play yet (73 boot but do not
  play, 109 show nothing).
- **Atari 5200:** with the original BIOS, 11 of 495 games do not play; on our
  own replacement firmware 454 of 522 files play, and the 32 games that use
  Atari's own code need the original.
- **Atari 7800:** 183 files show nothing without the console's BIOS.
- **Atari Lynx:** 48 of 860 games boot but do not play.
- **Pokémon mini:** our emulator does not match the console on two of our
  twelve tests, the save memory and the clock at start-up.
- **Plex** is not supported.

## [1.2.0] — 2026-08-05

### Added
- **Super Mario Bros. Special** (YM-901-S, 1987) — the ultra-rare Table Top
  competition prize is now playable. It runs the standard Super Mario Bros. game
  (a byte-identical dump) inside its gold flip-lid cabinet, with a live tile and
  drawer preview and a foam-aware drawer sheen (matte foam, glossy case/screen).
- **Ball (reissue)** (RGW-001, 2010) — the Club Nintendo reissue of the very
  first Game & Watch is now playable, running the original AC-01 firmware (the
  reissue's own firmware was never dumped; the added mute is covered by the
  built-in software mute).
- **Multi Screen save thumbnails now show BOTH LCD screens.** Stacked units
  (Zelda, Bomb Sweeper, Gold Cliff, DK-52…) get a two-screen thumbnail in a 4×2
  grid; side-by-side units (Mario Bros., Lifeboat…) a 2×3 grid — so a save slot
  finally shows what's actually happening on screen.

### Changed
- Save/load thumbnails are higher-resolution and reproduce each screen's exact
  in-game proportions — no more squish or blur.
- The on-screen emulator diagnostic counter (fps/frame/etc.) is hidden in normal
  play; it now appears only in **Developer Mode**.
- Removed the scrollbar from the save/load panel.

### Fixed
- Multi Screen arrow-key press art (Bomb Sweeper, Gold Cliff, Zelda) no longer
  balloons to full-screen — the d-pad highlights the pressed button instead.
- **Light mode:** Super Mario Bros. (Special) no longer shows a white border
  around the cut-out device, and the save panel's Load/Delete buttons are legible
  again (they were light-green/red on a light background).

## [1.1.0] — 2026-08-03

### Added
- **TFT twin audio now sounds like the real hardware.** The Mario/Zelda STM32H7
  twin plays through a software **small-speaker model**, so the wideband "crackle"
  of the raw firmware output is smoothed and the drums blend into percussion —
  matching the physical unit's tiny speaker. This is the one settled-on "Device"
  voicing; loading your own firmware is required for the twin to make any sound.
- **Visual Filmstrip Rewind** for the classic emulator — hold the ◄◄ button (next
  to Pause) or **Ctrl + ←** to scrub backward through play with a VHS scan-band
  effect, then release to resume. ~60s of instant, no-buffer history; the effect
  is pinned to the LCD glass and covers both screens on Multi Screen titles.
- **Content pack loader** (Settings → Content) — instead of running the builder,
  you can open a single **.zip** of your own dumps + segment SVGs + colour-unit
  flash, and the site identifies everything in-browser exactly as the builder does
  (dumps and SVGs by SHA-256, colour units by size-pairing; nested .zip archives are
  recursed). It's stored in IndexedDB so it persists across visits, works for both
  the classic emulators and the Mario/Zelda TFT twin, and uploads nothing. If the
  pre-built content is installed it still takes precedence. When content is
  missing, a "Batteries not included" banner offers the pack directly; the
  "install it locally" (builder) option is shown only when served from
  localhost, since it can't affect a remote/GitHub Pages deployment.

### Fixed
- **Device drawer would not open** (all titles): clicking a tile paused the live
  previews and then threw before the drawer appeared. A stray variable rename had
  left `emLineChartSVG` referencing an undefined `color`; also repaired 10 CSS
  `transition` rules that had become invalid.
- **Selected top-nav item hover** now uses a lighter shade of the *current* accent
  colour instead of a hardcoded green, with a clearer light/dark difference.

### Performance
- Rewind history is now allocated only for the interactive play window, not for
  every live tile/drawer preview — opening the catalogue and drawer stays smooth.

## [1.0.0] — Initial public release

- First community release: **code only, no Nintendo content**. All firmware dumps, segment
  artwork and colour-unit firmware are rebuilt locally from your own dumps with
  that release's firmware build script (see `README.md`).
- 59 classic Game & Watch devices (SM5A / SM510 / SM511 / SM512 emulation),
  the STM32H7 TFT twin (Mario / Zelda), manual booklets, a series timeline,
  12-slot save states, and a local collection tracker.
- Non-commercial licensing (PolyForm Noncommercial 1.0.0 for code, CC BY-NC-SA
  4.0 for original assets) — see `licenses/`.

<!-- Note: set the real 1.0.0 tag/date when you cut it in git; left undated here
     rather than guess. Move items from [Unreleased] into a dated version section
     each time you push a new release. -->
