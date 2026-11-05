# firmware: your games, and the files the site builds from them

## Games root

The build scripts read each system's library from `<games root>\<system>\games`
and `<games root>\<system>\bios`. That is one setting, `$GamesRoot`, at the top
of `scripts\build.ps1`. By default it is this folder's own `games\`:

    $GamesRoot = Join-Path (Split-Path $PSScriptRoot -Parent) 'games'

To build from a library kept somewhere else, set the environment variable
`CW_GAMES_ROOT` to the folder that holds the system folders, for example in
PowerShell:

    $env:CW_GAMES_ROOT = 'X:\path\to\your\games'

`-Root <folder>` does the same for a single run. The build prints which games
root it used and where the setting came from. Every system is served by the
game server at present (next section), so no build reads the games root.

Whatever the root, every build also reads the built-in titles in
`games\<system>\` first, and output always goes to `output\`.

## Served by the game server

Every system is served by the game server, so nothing is built into the site.

- Every system is listed in `$ServerServed` in `scripts\build.ps1`. For those
  systems a build reads only the empty `games\<system>\` folders, never the
  games root, so a full library can never be baked into the site.
- A build of a served system writes EMPTY outputs (`gb_games.json` /
  `gb_manifest.json`, `nes_games.json` / `nes_manifest.json`,
  `gnw_games.json`, `pokemini_games.json`, the Atari shelves, and colour-unit
  stubs that define no unit), so the site reads "no built-ins" without a 404.
- The Game & Watch LCD artwork, `output\artwork.json.gz`, is not a game file
  and stays. The game server gives the device files only, so a served
  Game & Watch build leaves the artwork exactly as it is.
- To build your own games into the site instead, remove the system from
  `$ServerServed`.

## Dump and build

1. Put your games in the folder for their system (loose files, `.zip` files,
   sub-folders: all fine). Folder names are the system names:

   | Folder             | System                                           |
   |--------------------|--------------------------------------------------|
   | `gb`               | Game Boy (`.gb`, plus the boot firmware if you have it) |
   | `gbc`              | Game Boy Color (`.gbc`)                          |
   | `nes`              | NES (`.nes`, `.unf`): the shelf is picked per game, by the file's hash first, then its name (Famicom merged into `nes` 2026-10-12) |
   | `famicom`          | Famicom (`.nes`): the cartridges whose hash says Famicom, moved back out of `nes` 2026-10-15; read by the same NES build |
   | `fds`              | Famicom Disk System (`.fds`): not built yet, see below |
   | `gnw`              | Game & Watch firmware dumps, LCD artwork (`.svg`), colour-unit flash |
   | `pm`               | Pokémon mini (`.min`, plus `bios.min`)           |
   | `atari2600`        | Atari 2600 (`.a26`, `.bin`)                      |
   | `atari5200`        | Atari 5200 (`.a52`, `.bin`, plus the 5200 BIOS)  |
   | `atari7800`        | Atari 7800 (`.a78`, `.bin`)                      |
   | `lynx`             | Atari Lynx (`.lnx`, `.lyx`, `.o`)                |

   Under the games root (above) a system's games go in `<system>\games` and
   its BIOS in `<system>\bios`. In this folder they go straight in
   `games\<system>\`.

2. Double-click `scripts\build-<system>.cmd` for that system (for example
   `build-gb.cmd`, `build-pm.cmd`), or `scripts\build-all.cmd` for everything.
3. Reload the site.

`scripts\dry-run-all.cmd` lists every file each build would read and stops:
nothing is opened, hashed or written.

The built-in folders under `games\` are created by the first build if they are
missing. The games root is only ever read, never written to.

A file put in the wrong system's folder is recognised by its contents and
reported by name. It is never added to the wrong system: move it and build
that system. gb and gbc are built together (they share one output file), and
so are nes and fds (`build-nes` and `build-fds` do the same build; `-System famicom`
still works as another name for it). A bare `.bin` in an `atari5200` folder is read as a 5200 game,
anywhere else as 2600, because those two have nothing in the file to tell them
apart. Building one Atari system keeps the other three as they were.

Every build copies the file it replaces to `output\.previous\` first. If you
empty a system's folders and build it, that system's output is removed (and kept
in `output\.previous\`).

## Large libraries: the cap guard

Each output has a cap, because the site downloads the whole file the first
time a game of that system is played:

| Output                     | Cap                                         |
|----------------------------|---------------------------------------------|
| `nes_games.json`           | 64 games / 48 MB (the same as a content pack) |
| `gb_games.json`            | the 12 catalogue cartridges, plus at most 64 other titles / 32 MB |
| each Atari `*_games.json`  | 256 MB per system                           |
| `gnw_games.json`, `pokemini_games.json` | only the known titles, matched by content, so no cap is needed |

If a system's folders hold more than its cap, **that system is not built**: the
build fails with a red `NOT WRITTEN - OVER CAP` message naming the folders, and
the current output is left exactly as it was. (For the Atari systems, which
share a manifest, nothing is written for any of them.) It never keeps an
arbitrary subset. A full library belongs
on the game server (Crystal Worlds Server: Library & folders), which sends one
game at a time. Disk System (`.fds`) images are not built into the output; they
also play through the game server or a content pack.

## Clean

`scripts\clean.cmd` removes the built files: everything in `output\` and the
Game & Watch colour units' `play\mario\firmware_mario.js` and
`play\zelda\firmware_zelda.js`. It lists them and asks first. It never touches
`games\` or the games root. Run a build again to get them back.

## What else is in here

| Folder         | What it is                                                        |
|----------------|-------------------------------------------------------------------|
| `games\`       | The built-in titles, one folder per system. Never published (git-ignored). |
| `output\`      | What the builds make; the site loads these. Never published.      |
| `scripts\`     | The build and clean scripts. `scripts\lib\` holds the two builders they run. |
| `site\`        | Part of the website itself: the content-pack loader, the hashing helper, the unsupported-list checker, cloud storage, and two name indexes (Game Boy, Pokémon mini). Do not edit or delete. |
| `variants\`    | Site data: which files are versions of the same game (regions, revisions, hacks), so the shelves show one tile per game. Built by `WASM_Source\variants\`. Do not edit. |
| `unsupported\` | Site data: the files the site knows it cannot run (recorded by the test sweeps), so it says so instead of booting them. Built by `tools\unsupported\`. Do not edit. |

From PowerShell: `.\scripts\build.ps1 -System gb` (or `nes, atari2600`, or
`all`), `.\scripts\build.ps1 -System all -DryRun` to list without building,
and `.\scripts\clean.ps1 -Force` to clean without the question.
