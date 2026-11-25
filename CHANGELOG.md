# Changelog

All notable changes to this project are recorded here. The format is based on
[Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

## [2.3.0] - 2026-11-26

### Added

- **The Super Nintendo joins CrystalWorlds.Media.** Sixteen bits arrive: a new console on the wall, played by a new emulator written for it, with everything the other consoles have: save states, rewind, turbo, screenshots, battery saves and the touch pad. Games come from your game server's snes folder, or a file you open yourself.
  - **The right console for each game.** A game plays on the Super Nintendo or Super Famicom it was made for: an NTSC game at 60 frames a second, a PAL game on the PAL console at 50, never sped up. The Machine menu offers the other models: the one-chip boards and the early Super Famicom.
  - **The chips in the cartridge.** Star Fox's Super FX draws its polygons, the SA-1 runs Kirby Super Star and Super Mario RPG beside the console's own processor, the S-DD1 unpacks the graphics of Star Ocean and Street Fighter Alpha 2 as the console copies them, the SPC7110 runs Far East of Eden Zero, Momotarou Dentetsu Happy and Super Power League 4, the Cx4 draws the wireframes of Mega Man X2 and X3, the DSP chips turn the tracks of Super Mario Kart and the ground of Pilotwings, and the rest run Top Gear 3000, Dungeon Master, SD Gundam GX, Metal Combat, F1 ROC II and both Morita Shougi games, each chip on its own program. The first time an SPC7110 game is played it shows the maker's own chip test, as a new cartridge did: press A, then Reset, then B, then Reset. Only the four competition cartridges, which carry a second chip, are listed as not supported.
  - **Clocks in the cartridge.** Far East of Eden Zero and Daikaijuu Monogatari II keep their calendar in the battery save, and it moves on by the time that passed while the game was closed.
  - **Unlicensed cartridges.** Bootleg cartridges with their own copy-protection circuits play as they did on a console: Aladdin 2000, Digimon Adventure, King of Fighters 2000, Pokemon Stadium, Soul Edge vs Samurai, Street Fighter EX Plus Alpha, Tekken 2, X-Men vs. Street Fighter, King of Fighters '98, Marvel Super Heroes vs. Street Fighter, A Bug's Life and more, along with a Korean 20-in-1 multicart whose menu starts every game and the board of Gamars Puzzle.
  - **The right board for every file.** A file the tables do not know is read for the board it was made for, so several prototypes, a quiz game and the SA-1 demonstration program start on the right one, and cartridges that are not games (cheat add-ons, adaptors for another console's cartridges, the XBAND modem) are kept off the wall.
  - **Controllers as the cartridge wants.** Two pads by default, and the mouse, the multitap, the Super Scope and the Justifier where a game was made for them, with a choice per port. Five players share one keyboard on a multitap in Super Bomberman 3, Lethal Enforcers takes two Justifiers, and on a computer the Super Scope fires with the left mouse button and takes the right one as its cursor. On a phone the touch pad has every button, with a Y and B button between them so one thumb can run and jump in Super Mario World.
  - **The picture.** The game fills a television's 4:3 screen, or shows its pixels at 8:7 if you choose; hi-res and interlaced screens show at their full size, and the sound is stereo always.
  - **Switched on like a real console.** Each time a game is switched on, the console's memory starts with new leftover contents, as a real Super Nintendo's does, so a game that depends on what was left there behaves as it did on the console: Super James Pond (USA) starts, and if a game stops at power-on, switching off and on again can help, as it did in 1993.
  - **Checked by rebuilding.** Builders who had never seen our code each built one part of the Super Nintendo emulator from its Emulation tab alone, the processor side, the picture chips and the sound unit, and joined as one machine on 26 November 2026 the build is identical to ours on everything checked: 290 of 290 test programs and 382 of 382 test-board checks in picture, sound and every memory, and 1,200 of 1,200 picture scenes.
- **The Nintendo 64 joins CrystalWorlds.Media, as an evaluation preview.** A new console on the wall. It is new here and still being tuned, so it wears an Evaluation preview tag on its card, its Systems menu tile, each game's drawer, the play window and its part of the Compatibility list. Its games come from your game server's n64 folder, or from a file you open yourself (.z64, .n64 or .v64).
  - **Large games, fetched in pieces.** A Nintendo 64 game is 4 to 64 MB. The play window fetches it from your game server in pieces, shows how far it has come, checks that the whole game arrived intact, and keeps it on this device, so the next time it starts at once.
  - **The start-up program for each region.** With the start-up program for a game's region on your game server (Japan and USA, Europe, or Brazil), the console starts with it; without it, ours takes over and the game starts the same way.
  - **Saves and the Controller Pak.** A game's saves are kept in your browser like every other console's, and each game starts with a Controller Pak in the first controller, or a Rumble Pak for a game that only uses that. Doubutsu no Mori (Animal Forest) keeps its cartridge clock's time between visits. Pokémon games wear the blue and yellow Pikachu console, as Pokémon games on the Game Boy Color wear the Pokémon edition.
  - **Four controllers, and what is in each one.** The second, third and fourth controllers come in as you connect pads, as on the console, and a setting for each port chooses what is in it: a Controller Pak, a Rumble Pak, a Transfer Pak or nothing. The Rumble Pak buzzes your controller. The Transfer Pak takes your own Game Boy cartridge file, for the games that read one through it, and keeps its save.
  - **Faster where the browser allows it.** In Chrome and Edge on a computer the emulator draws the picture and runs the console's signal processor on threads of their own beside the machine, so games run closer to full speed. Where the browser can also use your graphics card, each device tries drawing with it as you play and keeps whichever way is fastest there; every way gives the same picture. Other browsers run the same emulator on one thread. For slower devices there is a second engine, Performance, in Settings, Machine, Engine: it gives up the console's exact timing for speed, so some games may differ from the console, and Accuracy stays the default. When a game would run better on Performance, the play window says so once, with a button that switches to it and starts the game again.
  - **The 64DD.** The Nintendo 64's Japanese disk drive plays its disks. The drive's start-up program comes from your game server, or you can choose your own file when a disk asks for it. Each disk keeps its own save, and a disk made to expand a cartridge asks for that cartridge. The 64DD has its own place in the Systems menu.
  - **Test cartridges to download.** The 49 test cartridges we wrote to ask a real Nintendo 64 what the public test suites leave out are one zip on this site, under the MIT licence: each test file with its source, a read-me and the answers two PAL consoles gave. The read-me of each says first if it can hang a console or write to save memory or a Controller Pak.
- **The Sega SG-1000, Master System and Game Gear join CrystalWorlds.Media.** Three new consoles on the wall, played by one new emulator written for the whole Sega 8-bit family, with everything the other consoles have: games from your game server's sg1000, sms and gg folders or a file you open yourself (.sg, .sms or .gg), moving tiles, box art, logos, manuals and cheats, and the consoles' own start-up firmware.
  - **The right console for each game.** The Master System plays on the Master System II by default, with the first Master System, the Mark III (with and without its FM sound unit) and the Japanese Master System in the Machine menu; the Game Gear offers both of its boards and the Japanese Game Gear, which starts without start-up firmware, as the Japanese consoles of its first years did; the SG-1000 offers the SG-1000 II, its later one-chip board, the PAL SG-1000 II sold in PAL countries, the Othello Multivision and the Mark III. A game starts on the console its cartridge was made for: Korean cartridges with the Korean Master System's own start-up firmware, Taiwanese ones on the Mark III, Ax Battler's Game Gear beta without firmware, and games that need a PAL console, the Mark III, the FM sound unit or a save chip on the right one, so 130 more Master System and Game Gear games play. Cartridges sold in Europe and Brazil, or only in PAL countries (Laser Ghost, Space Gun, Marksman Shooting), start on the PAL Master System II, where the Light Phaser aims the same, Circus Charlie (Korea) starts on the SG-1000 II's one-chip board, and the five SG-1000 homebrew games made for 50 Hz start on the PAL SG-1000 II, at the speed they were made for. Saves and save states are kept for each machine.
  - **The consoles' own start-up firmware, when you have it.** With the Master System or Game Gear firmware on your game server the console's own start-up screen runs first; without it, ours takes over and the game starts the same way. A cartridge the console's own refuses stays refused, as on a real console. The games built into the Master System's firmware play from it with no cartridge, as the console does when it is switched on empty: Hang On, Hang On & Safari Hunt, Missile Defense 3-D, and the Alex Kidd in Miracle World and Sonic The Hedgehog built into the Master System II, each a version under its original cartridge. Snail Maze, hidden in the first Master System's firmware, has its own tile, and the buttons that start it on the console are held for you.
  - **Homebrew, demos and test programs.** The free programs authors share online were checked the same way, and 827 of 843 play. All the builds from one download page are one tile, the newest build that plays, with the others as versions in its drawer. Builds made for a flash cartridge start with this emulator's start-up firmware, as a flash cartridge starts them, and 15 Master System programs made for 50 Hz, such as Always Continue, start on the PAL console. The Korean Wonder Kid, the same program as a Game Gear prototype, is on the Master System wall.
  - **The Sega Graphic Board.** The Master System's drawing board, made in 1987 and never sold, works with its own drawing program: the pointer is the pen, and a click, a finger or Z draws.
  - **The Othello Multivision.** Tsukuda's SG-1000 with a keypad on the console is in the SG-1000's Machine menu, and the nineteen cartridges released for it start on it. Its own Othello, built into the console, has its own tile and plays with no cartridge, as the console does when it is switched on empty, when the console's program is on your game server.
  - **Two Game Gears on the Gear-to-Gear cable.** Choose the cable in a Game Gear game's settings and two Game Gears play side by side in one window, for two players: Columns, Baku Baku, Mortal Kombat, Sonic Drift 2 and the other link games.
  - **Test cartridges to download.** The three test cartridges we wrote to ask a real Master System what the public test programs leave open, whether sprites above and below the picture collide, how loud each sound channel gets and how the channels add up, and whether the picture scrolls one pixel every frame, are one zip on this site under the MIT licence, with their source and a read-me giving every expected result.
  - **Checked by rebuilding.** A builder who had never seen our code built the whole Sega 8-bit emulator from its Emulation tab alone on 23 November 2026, and once one line of the builder's own code was corrected, the build is identical to ours on all three consoles: 3,591 of 3,591 runs in picture, sound, every processor step and memory, and every one of the 1,604,000 processor tests.
- **8-bit avatars.** Choose your avatar from 200 characters drawn for CrystalWorlds in the style of the 8-bit consoles, from a knight and a koala to a lawn bowler and a steam train, each in its own colours plus 2 to 4 colour swaps. The choice shows them in a new random order each time it opens: press a character to choose it and press it again for its other colours. Signing up suggests a random avatar and alias, and the dice beside the alias rolls new ones (once you have chosen an avatar, only a new alias). Small circles show your character's head and shoulders, and your own picture is still the last choice. Settings, Your vault, Change avatar opens the same choice.
- **How long a game takes.** A game's drawer now shows, in its green status panel, how long players take to finish it: rushed, at a normal pace and to complete everything, from IGDB.com, where IGDB has times for that game. Every version of a game shows its tile's times, and a time from fewer than three players says so.
- **My games.** Your own record of the games you play, kept in your vault: only your vault code opens it, and Settings can keep it in this browser only. Each game's drawer has a My games section where Play time was: the total over every version and every device you play on, a status (Playing, Played, Backlog, Wishlist, Dropped, Shelved), a completion mark (Beaten, 100%, Endless), a rating in half stars, how long your finished playthroughs took, and your playthroughs, each with one note and its sessions, written in by the emulator itself, which you can fix, remove or add to (sessions in no playthrough are listed as Other sessions). Clear My games data clears the whole record for that game, with Undo. Sessions this browser recorded before My games (from 7 Nov on, sittings of 30 seconds or more) are added to it by themselves, so their play time counts too; they add play time only and never set a status. A heart beside the Manual button adds the game to your favourites, and a button beside it, which looks and works the same way, saves the game in this browser (the play window's Pre-load on device); both take the accent colour chosen in Settings. Each session says the machine it was played on, such as Game Boy Advance, and which release. The first time you play a game it is set to Playing for you; nothing else is ever set by itself.
  - **Games you own without a game file, and a wishlist.** In Settings, Your vault, My games, search the games this site supports and add one you own, or add it to your wishlist. It gets a tile on its console's wall marked No game file (or with a wish ribbon), with no Play button; when its file reaches one of your game servers the real tile takes its place, with everything on it.
  - **My games on the wall.** Tiles show a heart for favourites, a wish ribbon for the wishlist and their status. The Filter panel has a My games tab (any of the statuses and favourites, games without a file, wishlist games, and for the backlog how long a game takes, with No time known always listed), and the order can be Last played, Time played or My rating.
  - **Download and delete My games.** Download everything as JSON or as CSV files in a zip, restore it from a download, or delete everything in My games with your PIN. Your vault, alias, avatar and saves are not touched.
- **Achievements from RetroAchievements.** Connect your RetroAchievements account in Settings, Media and content, Achievements, with your user name and Web API key, and each game's drawer shows the achievements you earned in that game, after My games: how many of the set you have and your points, a progress bar, how many in hardcore and in casual, when you last earned one, every badge in the set (RetroAchievements' own, each a link to it there), the list of achievements with their points, and a link to the game on RetroAchievements.org. They are the achievements you earned in emulators that support RetroAchievements; they are not earned on this site. Games are matched to RetroAchievements by their game file on the Game Boy, Game Boy Color, NES, Famicom, Disk System, Pokémon mini, Atari 2600, 7800 and Lynx, SG-1000, Master System and Game Gear. A game with no achievement set shows nothing. The key stays in this browser and goes only to RetroAchievements.org; Disconnect deletes it, and the tile's switch hides achievements without disconnecting.
  - **Your achievements on the wall.** A new Achievements widget in Settings, Widgets brings your RetroAchievements account in among the tiles: Small shows your latest achievement, Medium adds your points and the game you played last with its progress, and Large shows your latest achievements and the games you are working through; press a game to open its drawer, it looks for news at most every 12 minutes, keeps working offline from what it last saw, and appears only while RetroAchievements is connected.
- **The game's box beside its drawer.** On a wide screen the picture that slides in beside a game's drawer is now the game's own box, in 3D: its cover on the front, its spine on the side, in the shape and size of that console's real boxes (Japanese Game Boy, Game Gear and Mark III boxes have their own; a Nintendo 64 box lies on its side in the West and stands upright in Japan). The box is the one of the release whose cover is shown. It slides in as a box from its very first moment, every time: the box is made ready while the page rests, and a game's cover is fetched as soon as you point at its tile. It turns as you move the mouse over it and catches the same streak of light as before. Where no spine picture is known, the spine is printed from the cover's colours and the game's name. Every console's box turns, as a box can be picked up. A cover far from the shape of its console's box (a cheat cartridge, an add-on) stays a flat picture, with the same streak of light. Game & Watch units still slide in as the unit itself.
- **A film's case beside its drawer.** A film slides in as its case: black for a 4K copy, blue for Blu-ray and a taller black case for DVD, by the copy Play plays, with the server's box picture on the front where it has one, else the poster.
- **Media Enhanced Covers.** A new switch in Settings, under Films and series, puts a small mark in the top-left corner of every film and series poster on the wall and of the drawer's flat poster: 4K, Blu-ray or DVD, by the copy Play plays (a series by its first episode). The marks are our own drawings, and a title whose size is not known shows none. Off at first.
- **The console with its game, first in the drawer's pictures.** A game drawer's pictures now start with the console switched on, playing the same silent picture as its tile, then the box art and the rest. It opens and zooms with one click like the box art, plays in the picture viewer too, and stops as soon as you press Play. On a phone its thumbnail is marked Live and plays when you open it. The Pokémon mini, which has no moving tiles, shows its console switched off.
- **The picture viewer by keys and touch.** Enter or OK on the picture zooms it and Back leaves the zoom first; on a phone a sideways swipe moves to the next picture.
- **A Change Log page.** Change Log, in the Info menu directly under Compatibility, shows every release since 2.0.0, newest first: a one-line summary of each, then its changes as New, Improvements and Fixes, each with the consoles it touches, and tables where a release changed the figures. Search covers every release; filters show one kind of change, one console or the game server's own releases; and every release and every change has its own link to share. It works with a mouse, a finger, the keys and a controller, on a computer and a phone, and the wall's moving tiles rest while it is open, so it scrolls smoothly.
- **An analogue stick on the touch screen.** On a phone the Nintendo 64 and the Atari 5200 have a round stick under your thumb instead of the eight-way pad: it goes as far as your thumb goes, the way the console's own stick does, beside the other buttons.

### Changed

- **New pictures of the consoles.** The NES, Famicom, Disk System, Game Boy, Game Boy Color, Super Game Boy, Atari 2600, 5200, 7800 and Lynx have new pictures on their tiles and in their drawers, and the Game Boy Advance in the play window. A home console's tile is a television of its time with the console's own controller in front, and its drawer shows the whole scene; a handheld is shown on its own. On each one the game shows through the screen's glass, under its reflection.
- **The original release is the tile, on every console.** A re-release (a Virtual Console, Switch Online, Sega Ages, Evercade, mini console or collection release) is now always a version under its game's original cartridge, never the tile, while the original is there. Alex Kidd in Miracle World's tile, for example, is the Master System cartridge, with the Sega Ages release under it.
- **The Systems menu in the order the consoles came out.** From the Atari 2600 of 1977 to the Pokémon mini of 2001; consoles of the same year follow the month they went on sale.
- **Signed in, a reload opens the wall.** Home no longer opens over the wall when you come back with your vault signed in, and reloading Home takes you to the wall. A new visitor still lands on Home.
- **Console buttons shown once.** When a console's own buttons are drawn in the play window, under the screen or on the console's picture (the Atari switches, the Lynx's Option and Pause, the Pokémon mini's Power and Shake, the Master System's Pause), the Control Bar no longer repeats them; the bar's own Reset stays. With a remote or a controller, press Down from the bar's lowest row to reach them, Left and Right to move along them, and hold OK or A to press one. Their keyboard keys and controller buttons are unchanged.
- **The Atari and Game & Watch Emulation tabs open with their test score.** The Atari 2600, 5200, 7800 and Lynx Emulation tabs show each console's test score and the date it was measured at the top, as the Sega tabs do, and the three Game & Watch chip tabs show how many of that chip's units match the original chips.

### Fixed

- **One tile for every game, its versions behind it.** Relabels and reissues of Atari 2600 games, sold under another name, now sit in their game's drawer instead of standing beside it (UFO with Space Jockey, Billard with Trick Shot, Pacman with Pac-Man), and a few that sat in the drawer of a different game with the same name have moved to their own (Commando and Front Line, Labyrinth and Maze Craze). Atari 5200 trainers and reworked builds go with the game they were made from, and the numbered builds of one homebrew program are one tile with each build a version: the Nintendo 64 ScummVM builds, Tetramino on the NES and Time Runner on the Atari 5200. Konchuu Hakase 2 and Tsuri Sensei 2 on the Game Boy Color are two games again.
- **Game servers on your own copy of the site.** Opened at an address other than crystalworlds.media, such as a copy you host yourself, a game server your vault joined over the internet showed as not online, with no way to connect. It now says it is reached over the internet from crystalworlds.media only, and offers Direct connect to reach it on your home network.
- **Smoother scrolling in the play window.** Games that scroll steadily no longer move, stop and jump for seconds at a time: the play window now runs each frame in step with your screen's refresh, while each game still runs at its own console's speed. On every console.
- **The Family Noraebang karaoke cartridges play, with their music.** These five Korean NES karaoke cartridges carry their own music chip, a copy of a Yamaha chip with nine voices and a built-in drum kit, and the emulator did not have it, so they would not start. They now start and play their songs with melody, bass and drums, and only the cartridge's own music is heard, as on the real cartridge, which cuts out the console's own sound.
- **No flash of Settings and the built-in games on a first load.** Settings, the Systems tab and the wall now wait until the site knows whether you are signed in, so R.O.B. Play Time and Tetris Jr. no longer appear for a moment and vanish when you are not.
- **Game Boy Color boxes.** The English translation of Arle no Bouken - Mahou no Jewel shows its game's box and logo, and the 3D boxes of three European games (3D Pocket Pool, Metal Gear Solid and Ottifanten) print their title on the spine instead of showing the side of the box with the consumer notice.
- **No more endless loading screen.** If part of the player, a save on this device or the game itself stops arriving, the play window now carries on without it where it can, or says in plain words what did not come, instead of showing its loading screen with no end.

## [2.2.2] - 2026-11-20

### Changed

- **Log in and Sign up.** The welcome's two tabs are now called Log in and Sign up, with Log in first and chosen when the welcome opens. Their buttons, messages and help, the log out notice, Settings and the Features page use the same words, and the Logout button in Settings, Your vault, now reads Log out.
- **Logging in, in plain words.** The Log in tab no longer assumes you have another device: it asks for your vault code, says you were given it when you signed up, and that Settings, Your vault, shows it on any device where you are logged in. Forgot your vault code? under it opens the email recovery in place; it was called Lost your code?, here and in Settings.
- **One Info menu.** Compatibility, the Timeline and About moved from three buttons on the search bar into one Info button (an (i) with a down arrow) at its right end, with Emulator Research added: on a computer its systems open in a sub-menu beside the menu, and on a phone they open in place; each opens that system's Emulation page. The menu works with a mouse, a finger, the keys and a controller, and every page keeps its own address.
- **One Filter beside the search box.** The Filter button (a funnel with a down arrow, and a number while filters are on) now sits right of the search box whatever the wall shows, and opens one panel: the order of the games and of the films and series, the kinds of game (Commercial, Homebrew, Demos, Diagnostic and Unknown, now with their names), the film choices (Unwatched, Favourites, 4K / HDR, Genre and Decade), Jump to A to Z, the artwork (Live devices or Box art) and the Continue row. On a computer it opens under the search bar in four columns (two on a smaller screen); on a phone it is a sheet with four tabs. F on the keyboard and LT on a controller open it.
- **What is on, at a glance.** Under the search box a chip names each choice that differs from the start, each with its own cross to take it off, and Clear all at the end. Clear all puts the kinds of game back to Commercial and Unknown and turns the film choices off; the order, the artwork and the systems stay as they are.
- **The Systems menu is the systems.** Its top row keeps the collections and Close; the order, the artwork, the Continue row and the kinds of game moved to Filter. Its tab is now called Systems.
- **Jump to A to Z for games.** With only games on the wall, a letter puts the games in name order and goes to the first one with that letter.
- **Nothing matches, for games too.** When the kinds of game leave no games on the wall, it says so, names what is on and offers Clear filters, as it does for films.
- **Films off, from the Filter.** With films and series off, the Filter offers Show films and series in place.
- **Your recovery email is no longer kept.** The vault keeps a scrambled fingerprint of it and a short reminder like p•••@gmail.com, which Settings shows with Change and Remove (both need your PIN); Forgot your vault code? mails your code to the address you type when it and your PIN match.
- **Game Boy, Game Boy Color and Super Game Boy tile clips match the emulator again.** Every clip was recorded afresh from power-on on the current Game Boy emulator and compared frame by frame with the one on the tile; each clip that no longer matched was replaced, and games whose tiles had no clip now have one.
- **Atari 2600 and 7800 colours.** Both now start their colour wheel where the console's colour signal starts, as the 5200 does: on the 2600, Pitfall!'s ground and Pac-Man's walls are yellow; on the 7800, Joust's ledges are gold. PAL colours follow the same rule. Every 2600 and 7800 tile clip is recorded again with the new colours.
- **Atari 5200 colours.** The 5200 now has colours of its own, worked out from how the console makes its colour signal and the setting Atari's service procedure gives it. Blues that showed as teal are blue, and every 5200 tile clip was recorded again with the new colours.
- **Atari 5200 replacement firmware.** Our own firmware now has a start-up screen routine where the console's own one sits. Programs that copy that routine to show their title, such as several Donkey Kong and Adventure II versions, now start on our firmware instead of showing a black screen: 481 of 522 files play without the original BIOS, up from 454.
- **Super Mario Bros. for the Atari 5200 is listed under Demos.** It is a music demo, not a game.

### Fixed

- **Sachen multicarts on the original Game Boy.** The 14 Sachen cartridges made for the Color now start on an original Game Boy with Nintendo's own start-up program, showing Sachen's logo, as the real cartridges did; they used to stop at the logo. With our own start-up program every Sachen cartridge now starts the same way as with Nintendo's.
- **Sachen cartridges start on the machine their header names.** Sachen stored the header scrambled, so the play window now reads it the way the console does: 13 of the Color ones start on the Color (the original Game Boy is a choice in the Machine list), and Beast Fighter on the original Game Boy.
- **Lagrange Point's music is closer to the real chip.** Two small faults in the emulator's Konami VRC7 music chip are fixed: the two halves of each voice now restart together when a note starts, and one step that was off on every low sample is corrected. Notes now start more cleanly, and strongly coloured sounds no longer drift away from the real chip's.
- **The Japanese Pokémon Crystal keeps its whole save.** Its cartridge has 64 KB of save memory in eight banks, on the larger MBC30 chip that only this game used. The emulator reached only four banks, so what the game wrote to banks 4 and 5 landed on top of banks 0 and 1. All eight now keep their own data, and the save keeps all of it when you load it again.
- **A busy game server no longer stops a game loading.** A server is now given 15 seconds, not 3, to start sending a game; while it is slow the loading bar says the server is busy, and if it still sends nothing the message says it didn't answer in time, with a Try again button.
- **Steadier sound on the Atari Lynx with a 44.1 kHz sound device.** The play window now keeps the sound in step with the game on every console, also when the console's sound rate equals the sound device's, so the delay no longer creeps up until the sound drops out for a moment.

## [2.2.1] - 2026-11-16

### Added

- **A Game Boy test page at /gbtest/.** It runs the same Game Boy emulator the site plays games on, with nothing else in the way: choose Game Boy, Game Boy Color or Super Game Boy, then a test file, and the picture appears on a plain 160 x 144 screen, one pixel per Game Boy pixel, with no colour correction, blending or border. Our own start-up programs run first, so a test starts from the same state as on the console. Public test boards can drive it to score the emulator.

## [2.2.0] - 2026-11-16

### Added

- **Your vault: a welcome, an alias and an avatar.** Every page (Home, Features, Stories, Compatibility, the Timeline and About) can be read by anyone; to open the wall, play a game or use Settings you need a vault code. The welcome slides out from a Your vault tab at the right edge (a bar at the foot of an upright phone) whenever you press Play or Settings without one. New member makes a vault in a minute, with no email or password: an alias others see, an optional avatar and a PIN. Existing member opens the vault you already have with its code, then its PIN. Once a vault is saved, every open tab of the browser lets you in at once, with no reload, and the round button at the top right shows your avatar, or the first letter of your alias. The PIN is asked when you open your vault on another browser, change its recovery email or ask for a lost code: Lost your code? mails the code only when the recovery email and the PIN both match. A forgotten PIN cannot be recovered. Log out now removes everything CrystalWorlds keeps on this browser and tells your game servers that this browser has left. A copy of the site on another secure (https) address asks for a vault code before anything else.
- **Game servers by connection key.** Settings, Media and content, Game servers shows both ways in: at home, on the same network, with Direct connect; or over the internet with your connection key, which is safe to share. Give the key to the server's owner, who adds it on the server's Vaults page, and the server appears by itself, wherever you are. You arrive at a server as your vault, with your alias and avatar, and a server no longer asks for a PIN of its own. Once a server is added, the tile shows that server only, with how it is reached and a Use a different server link.
- **Cartridge and disk saves in and out.** The Saves panel of every game that keeps its own save (NES and Disk System, Game Boy and Game Boy Color, the Atari 7800 High Score Cartridge, Atari Lynx and Pokémon mini games, and the Atari SaveKey) has a Game save row: Export gives the game's own save as the plain file other emulators use (a .sav for Game Boy and NES games, with the Game Boy clock after the save as desktop emulators write it), and Import takes one, asks before it replaces the save, and restarts the game to read it. A file of the wrong size is refused with a plain message.
- **Light gun on the Atari 7800 and 2600.** Aim with the mouse, a finger or the keys, and shots land where you aim. Light gun cartridges choose it themselves.
- **More Atari 2600 controllers:** the Sega Genesis pad, CBS Booster Grip, Joy 2B+, Trak-Ball, Atari and Amiga mouse, and QuadTari, in the controller menu.
- **Faster Disk System loading.** While the disk drive is reading, the game runs at four times speed with the sound off, then returns to normal speed by itself. Switch it off with "Load disks faster" in the Disk System's machine settings.
- **Two Atari Lynxes on one cable.** Settings, Machine, ComLynx cable: two Lynxes side by side in one window, for the games made for two players.
- **Auto-fire.** The Keys panel has an Auto-fire tab on every console: switch it on for any button, and holding that button presses it about 15 times a second. Every button starts with it off.
- **Every Game Boy model.** The Machine choice in a Game Boy game's settings, and the Machine item in the play window's bar, list every model of the console. For original Game Boy games: the Game Boy (the default), the Game Boy's first model (the first board, sold in Japan in 1989), the Game Boy Pocket or Light, the Game Boy Color, the Game Boy Advance and the Advance SP or Game Boy Player. For Super Game Boy games, with the Super Game Boy on: the Super Game Boy (the default), the Super Game Boy on a PAL Super NES, and the Super Game Boy 2. For Colour games: the Game Boy Color's first model and revisions A to E, with the last model the default, then the Advance and the Advance SP or Game Boy Player. Changing it restarts the game; your battery save is kept, and a saved game state returns to the machine it was saved on. A game on the Super Game Boy runs at that machine's own speed, about 2% faster than on a handheld, as on a Super NES, and the Super Game Boy 2 at the handheld's speed. Each Colour revision has its own sound timing, as the real ones do, and with Colour correction on the Advance shows its own darker screen.
- **The Game Boy Advance in the play window.** With the Machine set to the Advance, the Advance SP or the Game Boy Player, the play window shows a Game Boy Advance, with its D-pad, A, B, Start and Select pressable on the picture. A Colour game sits in the middle of its wider screen inside a black border, as on the real Advance. On a phone held upright the view moves in on the screen, with the on-screen pad below.
- **CrystalWorlds start-ups on every Game Boy model.** Every Game Boy model, from the original Game Boy and its first model to the Advance and the Super Game Boy, starts with Nintendo's own start-up for that model when your game server has it, and otherwise with its own CrystalWorlds start-up, which leaves the machine exactly as Nintendo's does, with the screen white until the game's first picture, as on the console. CrystalWorlds is also in the Boot program list, and Show start-up logo, under Machine, starts the game with no logo or sound before it.
- **Save states for other emulators.** In a Game Boy game's save list, Export gives a save as a BESS file, the shared save state format other Game Boy emulators read, and Import takes a BESS save from another emulator. After a save from another emulator loads, the game carries on from that moment; music and screen effects settle within a moment.
- **The Workboy keyboard.** The Workboy, a keyboard for the Game Boy that was made but never sold, can be plugged in from the Link cable choice, and it is plugged in by itself for the WorkBoy cartridge. Type on your keyboard; F1 to F9 are the Workboy's program keys, and on a phone or TV the Workboy keys sit in the bar.
- **Game Boy music files.** Open a GBS music file in the Game Boy player to hear its music: the screen shows its title, author and track, with Previous, Play and Next.
- **The Super Game Boy's own sounds.** With the Super Game Boy's SNES program on your game server, the sound effects a Super Game Boy game asks the SNES to play are heard with the game's own sound.
- **Console buzz.** A Game Boy setting, off by default, adds the faint hum a real console's screen and processor put under the sound.

### Changed

- **Older Game Boy save states.** Game Boy save states made before this release no longer load, because the Game Boy player now keeps more of the machine in each one. Battery saves, the games' own saves, are not affected.
- **Game Boy sound:** on the original Game Boy, silent rests when every channel is off, and two timing details of the noise and square channels, from recordings of a real console. On the Game Boy Color's revisions D and E, the last model included, a channel 1 or 2 start moves the note's waveform on one step where the real chip does, so the music sounds as on a real Game Boy Color.
- **Game Boy Printer:** data sent after a finished print without an Initialize is refused, as a real printer does.
- **Infrared on the Game Boy Color.** A Game Boy Color on its own now sees its own infrared light, as the real console does, and no other. Two Game Boy Colors linked side by side face each other's infrared port with the newer sensor's timing, so Pokémon Gold, Silver and Crystal's Mystery Gift gives both players their gift and Pokemon Card GB 2's Card Pop! connects. The Features page has an Infrared link tile for the Game Boy Color.
- **Bad copies are repaired or refused.** A game file that was copied wrongly from its cartridge or disk is no longer played as it is. Where a clean copy of the same game is known and the difference is tiny, the file is repaired in memory as it loads and plays exactly as the clean copy, with its box, details and saves; your own file is never changed. A bad copy that cannot be repaired is refused with a plain reason, and a tile whose main copy was a bad copy now shows a clean copy of the same game.
- **Altered copies are repaired or refused too, and the Compatibility list holds only real games.** Overdumped copies (with extra data) and trained copies (with cheat code added) are treated like bad copies: thousands of them are repaired in memory into their clean copy as they load, and the rest are refused with a plain reason. Fan hacks and translations that cannot start, where the original game plays, are refused as well. None of these files is a game as it was made, so none appears on the Compatibility list as not supported or counts in its figures; a repaired copy is listed with its game, with a note. Other programs that are not games and cannot start on their own (cartridge menus, cheat add-ons, test programs and console firmware opened as a game), and pieces of data that are not programs at all, are refused with a plain reason. Every version held today has had the same start check as its game's main copy, so each one is listed by how it runs, and a version that does not start says why. Beside Plays, Boots and Nothing, the list has three groups that are listed but not counted: Untested, for versions not tested yet, which still play; Unseen by us, one row for each known release of which no copy has reached us; and Data and tools, for programs that run but are not games, such as two shop menu cartridges.
- **Every box cover comes from the site's own picture library.** Covers that were shown from another site when ours had none are now kept with the rest of the site's covers, so they load the same way as every other cover; a game with no cover anywhere shows its system's plain box.
- **37 more NES, Famicom and Disk System files start.** The NES emulator builds 14 more kinds of cartridge board and fixes several others, so games that showed "Not supported yet" now play: among them Battletoads-Double Dragon and Hammerin' Harry 2 (Retro-Bit), Maniac Mansion, S.C.A.T. and A Boy and His Blob (Limited Run Games), the Glider games, Super Russian Roulette, Super Hang-On (China), Blood of Jurassic, Dragon Ball Z Gaiden, Mortal Kombat (JJ-01), several Chinese role-playing games and the Maxivision 30-in-1 and Caltron 9 in 1 multicarts. Caveman Ninja (Beta) now starts and plays on.
- The second disks of Famicom Tantei Club and Tantei Jinguuji Saburou now load with their first disk, so each game goes on past its first disk change, whichever copy of the disk you have.
- The Disk menu of a Disk System game on more than one disk now names each disk as the game does, for example "Disk 1 (Zenpen) side A", "Disk 2 (Kouhen) side A" or "Program disk side B". A disk with no name of its own keeps the plain "Disk 1 side A".
- The NES sound unit now asks for each voice or drum sample at the moment the console does, which changes how dozens of games with voices and drums run. Super Fighter III (FC-28 5027) draws its title, map, fighters and stages instead of scattered tiles, Mortal Kombat III shows both dragon medallions on its title, the Waixing role-playing games draw their lettering, and the PAL builds of Tetramino run as PAL instead of stopping on their PAL-only screen.
- Every NES, Famicom and Disk System tile clip was checked frame by frame against the NES emulator in this release. The 1,869 that no longer matched how it starts each game were made again, and 96 tiles that had no clip now have one, among them Fire Bam, Kick and Run, Titanic Mystery and Winter Games on the Disk System.
- The NES Emulation pages describe the NES emulator in this release. Saved games made in the NES play window before this release cannot be loaded; the games' own battery saves are kept.
- The NES comparison on Home now uses AccuracyCoin's 13 November 2026 build, which adds a check to DMA Landing on Write. The NES emulator passes all 147 tests, and every other emulator in the table, each its newest release, was run again on the same build; none of their scores changed.

### Fixed

- **Game Boy with the boot program set to None:** the original Game Boy and the Game Boy Pocket now start where their own start-up program would have left them, at the last line of the picture, as on the real console.
- **Game Boy Printer:** long pauses in a print no longer lose a page (Pokemon Crystal's second Pokedex page).
- **Game Boy button timing:** presses now reach the game at their own moment within the frame, as on the console, so the Telling LYs test passes.
- **Pinball Deluxe on the original Game Boy:** pressing Start again and again in one more rhythm no longer breaks the table.
- **Disk System games on more than one disk:** when the disk changes by itself, the side the game asks for now goes in first. Games whose disks carry no names, such as Kind Gal's, Bodycon Quest and Fruits Mahjong, no longer show their own wrong-disk message and wait for a button.
- **The installed app's offline page** now also shows with the device's offline switch on, in browsers that showed an error page there before.

## [2.1.1] - 2026-11-10

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
  Atari Lynx 809 of 829; Pokémon mini 17 of 17; Game & Watch 61 of 61.
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
- **Atari Lynx:** 20 of 829 games boot but do not play.
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
