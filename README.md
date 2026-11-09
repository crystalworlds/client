# CrystalWorlds.Media

[![Licence: CrystalWorlds.Media Project Licence 1.1](https://img.shields.io/badge/licence-CrystalWorlds.Media%201.1-blue)](licenses/LICENSE)
[![Non-commercial](https://img.shields.io/badge/use-non--commercial-lightgrey)](licenses/LICENSE)
[![Change it, don't sever it](https://img.shields.io/badge/components-ask%20first-orange)](licenses/LICENSE)
[![Research: cite it, don't copy it](https://img.shields.io/badge/research-cite%2C%20don't%20copy-blue)](licenses/LICENSE)
[![AI: no training, no AI-built copies](https://img.shields.io/badge/AI-no%20training%2C%20no%20AI--built%20copies-red)](licenses/LICENSE)
[![Third-party imagery: no licence granted](https://img.shields.io/badge/imagery-no%20licence%20granted-important)](licenses/NOTICE)

A fan-built video and game preservation project that runs in the browser. It hosts no files: it plays your own. It has three parts:

- **Media:** one wall of tiles for your films, series and games. Films and series
  come from your own Emby or Jellyfin server. Games come from your own files: a
  content pack, a single game file, the firmware folder of a copy you host
  yourself, or a Crystal Worlds game server, a separate program in its own
  repository that the site connects to (see below).
  **Fair share:** when the games are in Shuffle order and more than one system
  is picked, each picked system gets an equal share of the game tiles, dealt in
  turn so the wall stays mixed, instead of the biggest libraries filling it. A
  system with fewer games than its share runs out and its share goes to the
  others. Films, series and the widgets keep their own places. While the wall
  moves fast (a held key, Page Down, a fling), tiles start their clips once it
  slows.
- **Emulators written for this project**, one play window for every console:
  every Nintendo Game & Watch (the segmented-LCD units on our own Sharp SM5A /
  SM510 / SM511 / SM512 core, the two colour ARM units on our own STM32 twin,
  and the Tetris Jr. prototype), Game Boy and Game Boy Color, Pokémon mini,
  NES / Famicom / Famicom Disk System / VS., and the Atari 2600, 5200, 7800
  and Lynx.
- **Hardware and Emulation pages** for each system: how the console works, how
  our core is built, how we test it, and how it compares with other emulators,
  plus a compatibility list for every system.

The site ships **no games and no console firmware.** Every game and BIOS comes
from the visitor's own files. The ignore rules in `.gitignore` keep them out of
this repository.

---

## Version 2.0.0

The first release of CrystalWorlds.Media. The full notes are in
[`CHANGELOG.md`](CHANGELOG.md); in short:

- **Emulators and systems.** Eleven emulators written for this project, plus
  the rebuilt Tetris Jr. prototype, cover fourteen consoles and handhelds. The
  Home page reads "#1 emulators in the world on nine systems", and each
  system's card gives its measured score beside other emulators, with the
  date: Game & Watch 61 of 61 units pass all six parts of our test; Game Boy
  259 of 264 on the public Game Boy accuracy board and 49 of 50 on the
  cgb-acid-hell and AGE tests (SameBoy 1.0.5: 39); NES 147 of 147 on
  AccuracyCoin; Pokémon mini 10 of 12 on our own test cartridges; Atari 2600
  18 of 18 and Atari 7800 27 of 27 on our tests; Atari 5200 47 of
  47 on Acid5200; Atari Lynx 128 of 129 on the Lynx hardware test suite.
- **Checked by rebuilding.** Each system's Emulation tab is handed to a builder
  who has never seen our code; the emulator built from the tab alone is tested
  against ours. All nine match ours: Game & Watch, Pokémon mini, Game Boy,
  Game Boy Color, NES, Atari 2600, 5200, 7800 and Lynx. The results, with
  dates and the fingerprint of each emulator file checked, are on the Home
  page.
- **Documentation.** A Hardware page, an Emulation page and a compatibility
  list for every system.
- **The wall.** Films, shows and games on one wall, with search as you type,
  one tile per game with its versions in a Variant menu, the original manuals
  in a page-turn viewer, box art, and the Continue row.
- **The Control Bar.** Rewind, pause, eight save slots, speed, mute, full
  screen, screenshots, variants, manuals, and keys and help in every game, and
  cheats where a game has a cheat list.
- **Media servers.** Emby and Jellyfin, with MKV, HEVC, AV1, DivX and Xvid, and
  Dolby Digital, Dolby Digital Plus and DTS sound, played in the browser.
- **Phones, folds and controllers.** Touch buttons on each device, full-screen
  menus on phones and folds, controllers with A where your pad says A, and a
  TV remote.
- **R.O.B.** A 3D R.O.B. stands beside Gyromite and Stack-Up, reads the screen
  flashes and plays along, in the browser.
- **Game & Watch.** All 61 classic units, the two colour units at 60 frames a
  second with clean sound, and the rebuilt Tetris Jr.
- **Your games, four ways.** A content pack, a single file with Play a file,
  the firmware folder of a copy you host yourself, or a Crystal Worlds game
  server, a separate program in its own repository that the site connects to.
- **The vault.** A vault code and an optional recovery email, with no account
  and no password, in Settings, Access Code.
- **Known limits.** Listed at the end of the 2.0.0 notes in `CHANGELOG.md`.

---

## Quick start: run it locally

The site needs no build step and nothing to install on Windows. It must be
served by a web server, not opened as a `file://` path: the pictures, the game
data and the emulators do not load from a file path.

1. Open a PowerShell prompt in this folder.
2. Run `.\server.ps1`. It serves this folder on port 8080
   (`.\server.ps1 8081` for another port).
3. Open <http://localhost:8080/>.
4. Stop the server with **Ctrl + C** in its window.

A copy you run yourself opens on the wall, and shows Tetris Jr. and R.O.B. until
you add your own games. The Home, Features, Compatibility, Timeline and About
windows and each system's Hardware and Emulation tabs show only on
crystalworlds.media.

`server.ps1` starts the faster local server in `tools\localserver\` (Go,
standard library only) when that folder is there, building it on first use if
Go is installed. When it is not there, or cannot be built, `server.ps1` says so
and starts `server-single.ps1`, a small PowerShell server that needs nothing
else. Both send the two headers the emulators need
(`Cross-Origin-Opener-Policy: same-origin` and
`Cross-Origin-Embedder-Policy: credentialless`) and tell the browser not to
keep stale copies of the files. The faster server can also serve HTTPS (port
8443, or `.\server.ps1 8080 8443`) with the certificate named by `cert_file`
and `key_file` in `localserver.local.json`; the key file must sit outside the
site folder.

**Phones, tablets and TVs on your network.** `server-single.ps1` tries to answer
every address of this computer, and prints the addresses to open on another
device (an IP address is the reliable one). If Windows does not allow that, it
answers this computer only and prints the two commands (`netsh http add
urlacl` and a firewall rule) to run once in an administrator prompt. The
browser gives the emulators their fastest path (shared memory between threads)
only on `localhost` or an `https` address; on a plain `http` address of another
device the games still play, and the Game Boy takes its slower path.

The site names no host of its own: its links and sitemap use the address it is
served from. **One address (optional):** if your copy answers under several
names on the same HTTPS port (an IP address, localhost, a computer name), copy
`site.local.json.example` to `site.local.json` and put the one address in it.
The page then moves there, so sign-ins are kept in one place. Without the file
nothing moves.

**Online parts.** Supabase holds only the vault: a vault code and an optional
recovery email, used to link a browser to a game server. Browsing works without
it. For the credits roll, each page load also reads the public list of supporters'
GitHub names from a second Supabase project. It sends no sign-in, and if it fails the roll is
simply shown without names. The game server is a separate program in its own
repository.

---

## Hosting it on a web server

The site is static files, so any web server or static host can serve it
(nginx, Apache, IIS, Caddy, a cloud static host). Copy this folder as it is;
there is nothing to build. Four things to know:

- **Send the two headers on every file:** `Cross-Origin-Opener-Policy:
  same-origin` and `Cross-Origin-Embedder-Policy: credentialless`, the same as
  `server.ps1`. Without them the site still loads and the games still play,
  but the browser keeps the emulators off their fastest path.
- **Serve it over `https`.** Only an `https` address (or `localhost`) is a
  secure page, which the fastest emulator path needs, and a Crystal Worlds
  game server accepts only the secure site. On an `https` page the browser
  also refuses a media server that answers only plain `http`, so give your
  Emby or Jellyfin server an `https` address too.
- **Page addresses.** On a plain web server the site's own addresses use `#/`
  (for example `/#/device/<id>` for a game's drawer), which need no server
  rules. `404.html` is the not-found page.
- **No games on the server.** Do not put your game or firmware files in the
  served folder unless only you can reach it: `firmware/games/` and
  `firmware/output/` are for a copy you host yourself (see below), and
  everything in them is served to whoever can open the site.

---

## Setting it up: adding films, series and games

The site comes empty: it shows what **you** give it. Everything is set up in
**Settings > Media and content**, where each source is a tile. Choose a tile to
set it up; once it is set up, the same tile changes its settings.

### Films and series: a media server

There is a **Media server** tile for each kind of server: **Emby** and
**Jellyfin**. Choose the one your library is on, then enter the server's
address (for example `http://your-server:8096`; with no port given, 8096 is
tried), your user name and password, and choose **Sign in**. If the server
shows its users on its sign-in screen, you can pick yourself from the row of
users instead of typing a name. If the server has **Quick Connect** switched
on, **Sign in with a code** gives you a code to approve from a device that is
already signed in. Your films and series then appear on the content page.
Nothing is uploaded: the connection is between your device and your server.

One media server is used at a time. Both can stay signed in: signing in to the
second makes it the one in use, and the switch on each tile chooses between
them. **Sign out** on a tile signs out of that server only.

On the secure (https) address, a server that answers only plain http can be
reached only through a media proxy. The faster local server in
`tools\localserver\` has one, which forwards only to the servers named under
`emby_proxy` in its `localserver.local.json`; on any other web server, give
the media server an `https` address.

### Games: three ways

Use whichever suits you. Each game is recognised by its contents (a hash of
the file), so file names and folders do not matter.

**1. A Crystal Worlds game server.**
The game server is a separate program, in its own repository, that runs on a
computer that holds your games. Point it at your game folders, then on the
site choose **Game server**, enter the server's address and choose
**Connect**. Whoever runs the server approves this browser on the server, and
if the server asks for one you enter your PIN. The server sends each game and
firmware file only when it is played.

**2. A content pack (a .zip opened in the browser).**
Put your own files in one `.zip`: game files, console firmware (BIOS) files,
and for the Game & Watch units their firmware dumps, LCD artwork (`.svg`) and
colour-unit flash images. Choose **Content pack > Open content pack (.zip)...**
and pick the file. The site identifies everything inside it and keeps the pack
in this browser until you close it in the same place. Nothing is sent anywhere.

**3. The firmware folder, built into files the site loads.**
For a copy of the site you run yourself:

1. Put your files in `firmware\games\<system>\` (loose files, `.zip` files and
   sub-folders are all fine; a system's BIOS goes in the same folder):

   | Folder | System |
   |---|---|
   | `gb` | Game Boy (`.gb`, plus the boot firmware if you have it) |
   | `gbc` | Game Boy Color (`.gbc`) |
   | `nes` | NES (`.nes`, `.unf`) |
   | `famicom` | Famicom (`.nes`) |
   | `fds` | Famicom Disk System (`.fds`, plus the Disk System firmware) |
   | `gnw` | Game & Watch firmware dumps, LCD artwork (`.svg`), colour-unit flash |
   | `pm` | Pokémon mini (`.min`, plus `bios.min`) |
   | `atari2600` | Atari 2600 (`.a26`, `.bin`) |
   | `atari5200` | Atari 5200 (`.a52`, `.bin`, plus the 5200 BIOS) |
   | `atari7800` | Atari 7800 (`.a78`, `.bin`) |
   | `lynx` | Atari Lynx (`.lnx`, `.lyx`, `.o`) |

2. Double-click `firmware\scripts\build-<system>.cmd` (for example
   `build-gb.cmd`), or `build-all.cmd` for every system. The build writes the
   JSON files in `firmware\output\`.
3. Reload the site.

`firmware\scripts\dry-run-all.cmd` lists what each build would read without
writing anything. The full details are in [`firmware/README.md`](firmware/README.md).
Your games and the built files are never part of this repository: `.gitignore`
keeps `firmware\games\` and `firmware\output\` out of it. The same steps are on
the **Host it yourself** tile in Settings.

**One game at once: Play a file.**
To try a single game without setting anything up, choose **Play a file** and
drop the game file (or a `.zip` holding it) on the box, or choose it with the
button. It plays straight away from the page's memory and is let go when the
game closes; nothing is uploaded or kept, apart from the game's own battery
save, which is kept as for any game. Disk System and Pokémon mini games also
need their console's firmware from a content pack or a game server.

---

## What the main files are

| Path | What it is |
|---|---|
| `index.html` | The single-page app: the Media wall, the Home, About, Timeline and Compatibility windows, Settings, the device drawers and the system tabs. |
| `*-hardware-tab.js`, `*-emulation-tab.js` | Each system's Hardware and Emulation pages. Most Emulation pages are built from the emulator projects' own documents. |
| `emby.js` and `emby*.js` | The media server client for films and series, Emby and Jellyfin (one client; the differences are listed at the top of `emby.js`). |
| `cws.js` | The client for the Crystal Worlds game server (the server itself is a separate program in its own repository). |
| `play/host/` | **The one play window** for every console: `play/host/index.html?sys=<id>#<game>`, with the Control Bar, saves, rewind, Continue, input and sound shared. Each console is a core in `play/cores/<id>/` with its touch overlay in `play/shared/overlays/<id>.json`. |
| `play/<system>/` | Each emulator's built core and web files (`gameboy`, `nes`, `pokemini`, `atari2600`, `atari5200`, `atari7800`, `atarilynx`, `gnw`, `tetrisjr`). |
| `play/gnw/` | The Game & Watch host and our clean-room Sharp core (`gwc-core.js`). |
| `play/twin*.js`, `play/mario/`, `play/zelda/` | The digital twin of the colour Game & Watch units (STM32H7B0). Their firmware is not included. |
| `play/rob/` | The 3D R.O.B. that plays along with Gyromite and Stack-Up. |
| `gameboy-core/` | The Game Boy core's source (`src/gb.c`, with `apu.c` and `apu.h`). `bash gameboy-core/tools/build.sh` (or `tools\build.bat`) builds `gameboy-core/build/gb.wasm` with a clang that has the WebAssembly target (LLVM); the result is byte-identical to `play/gameboy/build/gb.wasm`. |
| `firmware/` | Site code and data for games (`firmware/site/`, `firmware/variants/`, `firmware/compat/`, `firmware/unsupported/`) and the build scripts in `firmware/scripts/`. Games you add go in `firmware/games/`, and builds write `firmware/output/`; both folders are ignored. See `firmware/README.md`. |
| `metadata/` | The built-in game details (names, years, makers, descriptions and review scores) shown in a game's drawer, a few files per system. |
| `artwork/` | Game & Watch device artwork, one folder per device. |
| `images/art/` | The device photos, box art and console art, one file each, with the index `images/art/art-index.js` that says which file holds each picture. |
| `frame/`, `images/`, `fonts/`, `FavIcon/` | Page frame textures, site art, the credits roll fonts and app icons. |
| `downloads/` | Our own test cartridges for Pokémon mini, Atari 2600, 5200, 7800 and Lynx, under the MIT licence (see each zip's README). |
| `vendor/` | Third-party runtime libraries (libav.js, mediabunny, pdf.js, hls.js, supabase-js) with their licences. |
| `server.ps1`, `server-single.ps1` | The local server described in the quick start. |
| `site.local.json.example`, `carts.local.json.example` | Optional local settings: the one address of a copy (above), and Game Boy cartridge slots read from a folder on this computer. Copy without `.example`; the copies are never part of the repository. |
| `robots.txt`, `.well-known/tdmrep.json` | Rules for crawlers: search engines are allowed, AI training crawlers are asked to stay out, and text and data mining is reserved (`LICENSE`, section 3E). |
| `licenses/` | The project licence, the assets licence, `NOTICE` and `THIRD-PARTY-NOTICES`. |

The source of the NES, Pokémon mini and colour Game & Watch twin cores, with
their build and check scripts and the builders of the site's pictures and
data, is kept in a separate core source repository, not in this one.

---

## Settings for the game build scripts

The site itself needs none of this. The game build scripts in `firmware/scripts/`
read `CW_GAMES_ROOT` for the folder that holds your games (see `firmware/README.md`);
with it unset they use `firmware/games`.

Example (PowerShell): `$env:CW_GAMES_ROOT = 'X:\MyGames'; .irmware\scriptsuild.ps1 -System gb -DryRun`

---

## Suggestions and submissions

Suggestions and submissions are welcome from anyone. Open an issue or a pull
request for a bug report, a fix, a correction to a Hardware or Emulation page,
a measurement from real hardware, a game that does not play right, or an idea.
Every submission is read and considered.

**Games and firmware are never accepted.** An issue or pull request that
contains a game, a BIOS, a boot program or any other console firmware, or a
link to one, is always rejected and closed, whatever else it contains. This
project plays only the files each visitor already owns, and it never ships,
hosts or shares them. The details are in [`CONTRIBUTING.md`](CONTRIBUTING.md).

---

## Notes

- **Licence.** The project is under the
  [CrystalWorlds.Media Project Licence 1.1](licenses/LICENSE). On
  crystalworlds.media the Emulation pages ask each visitor to agree to its
  terms for the documentation (sections 3A to 3E) the first time they open
  one, once per browser; a new licence version asks again.

- This is a fan project. It is not affiliated with, endorsed by or sponsored by
  Nintendo, Atari or any other company. "Game & Watch", "Game Boy", "Pokémon",
  "Famicom", "Atari" and related names are trademarks of their owners.

- **The per-device screen and button geometry** of the Game & Watch units was
  read from the 53 `gnw_*.lay` community external-artwork layouts:
  **Lee Robson (hydef)** on 52 of the 53, with **DarthMarino**,
  **Henrik Algestam** and **ICEknight** on a few. **None of them carries a
  licence line**, so there is no licence to cite and this project asserts none.
  See [`licenses/THIRD-PARTY-NOTICES`](licenses/THIRD-PARTY-NOTICES) section 2.

- Changes are recorded in [`CHANGELOG.md`](CHANGELOG.md).
