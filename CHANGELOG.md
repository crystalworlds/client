# Changelog

All notable changes to this project are recorded here. The format is based on
[Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

## [Unreleased]

### Added

- **Image and Play Time widgets.** Two new widgets in Settings, Widgets, both off until you turn them on. Image shows your own pictures in a tile among the others: pick one picture or a group, make as many Image tiles as you like, and each one turns through only its own pictures. The pictures are made smaller and kept in this browser on this device only, never uploaded or synced, and removing a tile removes its pictures. Each Image tile can show the whole picture, fill the tile, or slowly pan and zoom. Play Time shows the games you pick, three at a time, each with its logo or box and how long you have played it in this browser; press one to open it. Each has a frequency and a size: one tile, two tiles wide, or two by two. Every widget, old and new, can now be put in order in Settings, Widgets: drag a row by the handle at its end, or focus the handle and press Up or Down. When two widgets would land on the same tile, the one higher in the list gets it. On a phone, where the wall is one tile wide, every size is one tile.
- **Game Boy screens respond like the real ones.** The Game Boy, Game Boy Pocket and Light, and Game Boy Color play windows now show the slow change of the real screen: a game that shows something on every other frame to make it see-through, such as Chikyuu Kaihou Gun ZAS, looks steady and half see-through as it does on the console, instead of blinking, and moving things leave a faint trail. It works the same whether your browser draws 30 or 60 pictures a second. Settings, Display, Screen response turns it off for a sharp picture on every frame. The Super Game Boy draws on a television, so it stays sharp. Screenshots show the picture as you see it.
- **Most played.** The games' Sorting menu has a new Most played order: the games you have played longest in this browser first, then the rest in the Shuffle order. Choose it again for least played first.
- **One save list for every game.** The Saves panel is now the same table on every system: up to 20 saves a game, newest first, each row with its picture first (both screens on a two-screen game, both consoles with two linked Game Boys), then its name and note, when it was saved, the play time and, where it matters, the machine. Select a row, then Load or Save; saving over a save asks first and can be undone, and a New save row adds one while there is room. The auto save from when you last closed the game is pinned on top in its own colour and can only be loaded. It works by touch, mouse, keyboard and controller, larger on a TV, and every save made before keeps its place and still loads. The colour units' own-firmware page has the same list.
- **Resume play in every game's details.** When a game has an auto save from the last time it was closed, a Resume play button sits left of Play Now! and carries on from that moment; without one there is no button. It resumes the game on the box: an auto save made while playing another version belongs to that version and resumes from its own details or its Continue card.
- **An OLED theme.** Settings, Look, Theme now has OLED beside Dark and Light: the dark theme with a pure black page and a black ground around the game picture in the play windows. Everything else, from tiles and drawers to menus and Settings, keeps the dark colours. On a small screen the offline page follows it too.
- **An offline page for the installed app.** Opened from the home screen when the site can't be reached, it now says so, with a Try again button, instead of showing only the icon. It comes after 3 seconds with no answer (at once when the phone knows it is offline), keeps trying by itself every few seconds and opens the site as soon as it answers. It stores nothing but that page and its picture.
- **Long Variants lists are easy to search.** In a game's details, each group of versions now runs A to Z, with the default first. A list of more than 20 versions has a filter box that narrows every group as you type, so one hack among a thousand is a few letters away. The Variant menu in the play window has the same box and order. Both work with a controller and an on-screen keyboard, and Play still opens the game on the box.
- **Pokemon mini files that belong to no game get tiles.** A demo, a test program or homebrew on your game server that is not a version of a game now has a tile of its own, under its type box in the Systems menu: Bad Apple under Demos, a test suite as one tile under Diagnostic. Its name is the file's name, tidied, and it has the generic box. A version of a game is never a tile: the Pichu Bros. Mini previews and the Pokemon Party Mini GameCube games are versions in their game's drawer.
- **Stories for 16-Bit sponsors.** Settings, Media and content has a new Stories tile. Sign in with GitHub and a Stories button appears on the search bar, to read and listen in a window of their own. Sign-in is optional and nothing else needs it; a visitor who does not sign in sends nothing to GitHub.
- **Swap A/B.** A new button on the Control Bar, left of Keys, swaps a controller's A with B and X with Y in the game only (Ctrl+B also works). The wall, drawers, menus, Settings and the bar itself keep the controller's normal layout, keyboard and on-screen buttons do not change, and the choice is remembered for every game. Consoles where those buttons all do the same thing do not show it.
- **Supporters in the credits.** The credits roll names current public sponsors, by their GitHub names, under Special thanks. With none, it looks as it did.
- **Two more Game & Watch programs.** Helmet's original CN-07 program and Judge's revised IP-15 program can be played when they are on your game server: pick one from the version list in the device's details, then Play Now!. Each runs on its device's own artwork and keeps its own saves; Play Now! without a pick, and Play on a tile, run the version the device always had. Helmet's tile, details, play window and Emulation tab now give that version's real model number, CN-17.
- **Teal, the Game Boy Light's screen,** joins the Game Boy's palettes.
- **Colour correction for the Game Boy Color.** A real Game Boy Color screen is not a modern screen, and raw colours look too saturated on one. Settings, Display has Colour correction whenever the picture is from a Color. It is off unless you turn it on, and it changes the picture at once with no restart.
- **Auto save on exit.** Settings, Configurations, Screen and tiles has a new switch, on by default: when you leave a game you have played, it is saved where you were, so its Continue card starts from there. Switch it off and leaving a game saves nothing; saves you make yourself and the game’s own save on its cartridge are not changed.
- **Preferred region.** Settings, Configurations, Screen and tiles has a new choice: Default, USA, Europe or Japan. With a region picked, a game's versions from that region come first in its Variants list, in the game's details and in the play window, and Play opens that region's version when the game has one; otherwise Play opens the version on the tile. Tiles, search, box art, hacks and translations stay as they are, and each version keeps its own saves. Default changes nothing.
- **Games we have not tested yet.** A game that matches none of our lists now shows as Unknown, under its own name, and its details say we have not tested it yet, with our email address so you can tell us what it is and where you found it. Before, such a game showed as Commercial. The Systems menu has an Unknown box beside Homebrew and the other types, ticked to start with; it appears only while such a game is on the wall. Homebrew games stay Homebrew.

### Changed

- **Widgets go with what they show.** Trailer playback, Film facts, Collection stats and Cast come from your films and shows, so they now show only while Movies is on; Play Time shows only while games are shown; Clock, Weather, Movie quotes and Image show whenever widgets are on. Each comes back in its place when its content is shown again.
- **An open cast member or collection stays open.** With a cast member’s page open, turning Movies on (the controller’s button, the O key or the Systems menu) showed every film and show under their name. It now shows only theirs, and the Filters menu and the games sorts work on their list too.
- **A cheat that is on is green.** In the Cheats menu, a cheat that is on now has a green row and a green “on” tag, as other things that are on are marked across the site.
- **Signing in to an http-only media server says what is wrong.** On this secure (https) site, an Emby or Jellyfin server that only answers on http used to fail with "answered, but not as a media server (404)", which blamed the server. Now the message says the site is secure and cannot use an http address, to ask the server's owner for its https address. A server address typed without a port is also tried on https at the standard port and at 8920, the secure port Emby and Jellyfin use, before http, and a server that does not answer at all is reported in a few seconds. The light theme's sign-in messages are a darker red that is easier to read.
- Checked by rebuilding on Home now shows the new Game Boy emulator. Builders who had never seen our code rebuilt the Game Boy and the Game Boy Color from their Emulation tabs alone on 9 and 10 November 2026, and both builds are identical to ours on every test: 170 of 170 Game Boy tests, 94 of 94 Color tests, and every AGE and mealybug test. The Color tab now says more plainly how the Color picks the background map column, how long the line the screen is switched on lasts when the speed changes on it, and what the sound unit reads just after a divider write.
- Checked by rebuilding on Home now shows the new NES emulator. A builder who had never seen our code rebuilt it from the NES Emulation tab alone on 9 November 2026, and the build is identical to ours on all 9 test sections, with 202 of 202 cartridge types and 208 of 208 library games.
- The Acceptance page of the NES Emulation tab now gives the test results recorded on the new emulator: 202 of 202 cartridge types draw, and 101 of the 304 types the pages describe have no cartridge to test with.
- The NES Emulation tab's summary page now gives the number of cartridge types the emulator handles as 301, measured on the new emulator (it said 233).
- **A more accurate Game Boy.** The Game Boy emulator now passes 49 of the 50 cgb-acid-hell and AGE tests (32 before) and 259 of the 264 tests on the public Game Boy accuracy board (258 before). On the Game Boy Color, the double-speed switch, writes to the picture registers in the middle of a line, mid-line scrolling and the window are now timed as the hardware does them. On the original Game Boy the screen goes blank while a game switches the picture off, as a real one does, so a brief white frame can show at some screen changes.
- On two linked Game Boy Color machines, a steady infrared light now fades from the receiver after a moment, as it does on the hardware. A game that crashes the processor now leaves the screen, timer and sound running underneath, as on the hardware; the play window still stops it with a message.
- The Game Boy comparison on Home now names SameBoy 1.0.5 and DocBoy 1.3, which we ran ourselves with the public board's own tool.
- The NES comparison on Home now uses AccuracyCoin's 4 November 2026 build, with 147 tests: the NES emulator passes all 147, and Nestopia UE 2.0.0, MesenCE 2.2.1 and 2.2.0, Mesen2 2.1.1, puNES 0.111 and FCEUX 2.7.0, each its newest release, were run again on the same build. puNES and FCEUX now get a score.
- Two more emulators in the NES comparison on Home, run on the same AccuracyCoin build: NintendulatorNRS (its 6 November 2026 build) passes 132 of the 147 tests, and FCEUmm, the libretro core, passes 84, the same tests as FCEUX. Every emulator in the table was run twice, with the same pass or fail on every test.
- **151 more NES and Famicom cartridges start.** The NES emulator now builds 68 more kinds of cartridge board, so most of the multicarts and Chinese and Taiwanese games that showed "Not supported yet" now play, among them the Koudai Guaishou and Aoshi Tiandi role-playing games and many 4-in-1 to 18-in-1 multicarts. Desert Storm still says "Not supported yet": its picture would be garbled.
- Mirai Shinwa Jarvas now draws its map instead of one small picture across the screen, Kyonshiizu 2 and Kyuukyoku Harikiri Stadium scroll properly, and the Kyonshiizu 2 demo cartridge shows its title.
- J.Y. Company cartridges, such as Aladdin, China Rabbit Baby and Tekken 2, get their split screens back, and Tengen's Klax draws the picture below its split on the right line.
- Autobot Bros. 2 now shows its title screen; like on other emulators, it goes black when a game is started.
- The NES Emulation pages describe the new emulator. Saves made in the NES play window before this update cannot be loaded by the new emulator; the games' own battery saves are kept.
- The Game Boy and Game Boy Color Emulation pages describe the new emulator, and 17 places where a page and the emulator disagreed are put right.
- Every Game Boy, Game Boy Color and Super Game Boy game was tested again on the new emulator. No game that played before stops playing, and the compatibility list shows the new test date.
- **Pinball Deluxe no longer breaks when you press Start again and again.** On the original Game Boy, an interrupt a game asks for on one screen line now holds back the next line's interrupt for a moment, and a Game Boy waiting for its timer wakes one step later, as the hardware does. Before, the table fell apart into stripes within a minute or two of pressing Start and the game then stopped. After several minutes of nonstop pressing it can still stop. Speedball 2 now draws its match screen in whole pictures, and the sound in many games moves by a tiny fraction of a second.
- **The Game Boy Camera is faster.** With a normally lit picture from your camera, its Shoot screen now shows about 8 new pictures a second, as a real Game Boy Camera does in a well-lit room (about 5 or 6 before). Photos are as bright as before, and a dark room still slows it down, as it does on the real camera.
- The Game Boy Hardware tab now explains how games read the buttons, that a button's contacts can bounce, what the link port reads with nothing attached, what memory holds at power-on and the old battery figures for HALT, and that the Super Game Boy's SNES side checks the logo and the header checksum. The Game Boy Emulation tab describes the Screen response setting.
- The moving pictures on the Super Game Boy tiles, and on 81 Game Boy tiles, were recorded again on the new emulator.
- **Settings tabs on a computer show their icons.** Each page's name in Settings now has the same icon beside it that a phone shows.
- **On-screen buttons with depth.** The touch buttons, D-pad, sticks and console switches now have a rim and a face, a soft arc of light along the top and a faint shadow, and a pressed button sinks. Their sizes, places and touch areas, the labels, Swap A/B and the opacity setting are as they were. Buttons drawn on a console's own picture are unchanged.
- **One finger presses one button.** Where two on-screen buttons sit close together, a touch now presses only the button under the finger, on every system: tapping Left on the Tetris Jr. no longer also presses Drop, and the Game A, Select and keypad buttons no longer catch the button beside them. Between two buttons the nearer one answers. The D-pad still gives diagonals, and a finger can still slide from one button to the next.
- The colour Mario and Zelda units' custom firmware page no longer shows an error when Saves is closed before any firmware has started. Save and Load there now say that no firmware is running yet.
- **R.O.B. puts his box away.** In R.O.B. Play Time, when every part of the set is in its place and Play again appears, the parts box fades away and the picture moves in on R.O.B. and his set at full size. Play again brings the box back with every part in it. With Grab on, a controller's A or the Enter key on Play again now presses it.
- **R.O.B. Play Time gives him more room on small screens.** On any phone, fold or tablet, Pick a set and the main controls now sit side by side with R.O.B. above them. Turned wide, the two stay side by side on the right, with R.O.B. to their left. A computer's layout is unchanged.
- Fast forward on the Control Bar is now called Turbo.
- On a phone, a fold or any small screen, in light mode, Home, Features, Compatibility, the Timeline, About, Stories and the keys page now follow the theme: white ground, dark words, light cards, tables and credits. A small screen has no red frame, so a black screen has nothing to belong to. On a computer they stay on the black screen inside the frame, in both themes.
- **The Game Boy's palette and machine are two settings now.** Mono Palette in Settings, Display changes the picture at once and no longer holds the Game Boy Color. The machine has its own choice in Settings, Machine: Game Boy or Game Boy Color, for any game that can run on both. Changing it restarts the game, and each machine keeps its own save slots. If Game Boy Color was your skin, it is now your machine and nothing else changes.
- The Game Boy and Game Boy Color Emulation pages answer about 120 more questions a rebuilder would ask, in plainer and stricter wording. No figure on them changed.
- Moving onto the search bar with a controller, the arrows or Tab now leaves Home, Features, About, the Timeline, Compatibility or Stories open. A click, a tap, Enter or A on the search box still closes the window so the results can show.
- The on-screen buttons now light up when the matching button on a controller is pressed, on every system. The setting that lights them for the keyboard is now called "Light buttons pressed on the keyboard".
- A search for "Pokemon Breeder" now finds Pokemon Sodateyasan Mini, also called Pokemon Breeder Mini.
- Pokemon Sodateyasan Mini, Pokemon Puzzle Collection Vol. 2 and Togepi's Great Adventure now open on the original game, with the fan translation as a version in the drawer.
- Text that was too faint to read was made darker or lighter across the site, in both themes: the Hardware and Emulation pages, tile labels, drawer headings and tabs, Compatibility, the weather widget, and links in Home and About.
- The page-not-found card no longer shows a line that looked like an error code.
- Game server connection errors now say what can actually be told apart: a page open as plain http, a browser blocking access to your network, or a list of things to check. The certificate advice appears only for a bare number address.

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
