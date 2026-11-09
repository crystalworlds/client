#Requires -Version 5.1
<#
================================================================================
 build_nintendo.ps1  -  rebuild the emulator's content from your own dumps
================================================================================

 MOVED 2026-10-10 to firmware\scripts\lib\. You do not run this file directly
 any more: run firmware\scripts\build-<system>.cmd (or build-all.cmd), which
 calls it with the right folders. For each system it reads the built-in
 titles in firmware\games\<system>\ and, when -GamesRoot names a library laid
 out as <root>\<system>\games + <root>\<system>\bios (the games root
 set in build.ps1, see there), those two folders as well. It writes
 ONLY firmware\output\ (plus the two colour-unit files under play\).
 Nothing in it needs editing. The paths named "firmware/<file>.json" below are
 now firmware/output/<file>.json. See firmware\README.md.
   -Systems   any of gnw, pokemini, gameboy, nes (default: all four)
              gnw      <- gnw                gameboy <- gb + gbc
              pokemini <- pm                 nes     <- nes + fds
   Famicom was merged into NES on 2026-10-12 and moved back out on 2026-10-15
   famicom\games holds the cartridges whose HASH says Famicom.
   nes reads nes + famicom + fds;
   a file in a famicom folder is marked c = famicom, and the site's
   nes-console.js still decides by hash first, then by c, header and name. (This builder reads iNES files only: .fds disk images are
   not baked, so the fds folders are scanned but add nothing yet.)
   -ListOnly  list every file each system's build would read, then stop:
              nothing is opened, hashed or written.
   CAP GUARD (2026-10-11): if a system's input holds more NES games than
   $NesMaxFiles / $NesMaxBytes, or more extra Game Boy titles than
   $GbExtraMaxFiles / $GbExtraMaxBytes, that system's output is NOT written
   (the build fails and says so) instead of keeping an arbitrary subset.
   -GamesRoot / -BuiltInRoot / -OutDir / -SiteRoot   set by build.ps1, or
              overrides for testing.
 A previous output is copied to output\.previous\ before it is replaced, and
 content found in the wrong folder is reported by name, never written.

 WHAT THIS DOES
   Scans a folder (recursively, including inside .zip/.7z/.rar archives) for the
   content the emulator needs and rebuilds six things next to the site, so the
   distributed source can ship CODE ONLY and none of Nintendo's data:

     1. firmware/output/gnw_games.json     - the 59 classic firmware dumps (SM5A/510/511/512),
                                     identified by SHA-256 CONTENT HASH.
     2. firmware/output/pokemini_games.json- the 10 Pokemon mini games (~512 KB each) plus
                                     the shared 4 KB BIOS ('bios'), by SHA-256
                                     hash. Kept in its OWN file (not gnw_games.json)
                                     so the big PM games are lazy-loaded only when a
                                     PM game is launched. Also picks up staged
                                     *.min dumps in the firmware/ folder itself.
     3. firmware/output/gb_games.json      - the 12 catalogue Game Boy cartridges and the
                                     two boot programs, by SHA-256 hash, PLUS any
                                     further .gb/.gbc/.sgb titles found, keyed by
                                     content ('gb-x' + 12 hex of the hash).
                                     firmware/output/gb_manifest.json is the same content
                                     described WITHOUT the bytes, so the page can
                                     ask what exists without downloading tens of
                                     megabytes to answer.
     4. firmware/output/nes_games.json     - every NES/Famicom game file found, recognised by the
                                     iNES header magic and keyed by content
                                     ('nes-x' + 12 hex of the hash). There is no
                                     curated title list: the ones that count are
                                     the ones loaded by the content button or
                                     placed in the firmware folder, the same
                                     loading rules as every other game.
                                     firmware/output/nes_manifest.json is again the same
                                     content without the bytes.
     5. firmware/output/artwork.json.gz   - the 71 LCD segment-artwork SVGs, also
                                     identified by SHA-256 hash, gzip'd.
     6. play/<unit>/firmware_*.js  - the two colour (TFT) units' firmware.
                                     These are NOT hashed: the STM32 flash is
                                     encrypted differently on every physical
                                     device, so bytes never match between dumps.
                                     Instead a Mario/Zelda unit is recognised by
                                     finding BOTH flash images at their exact
                                     sizes together in one folder/archive:
                                       internal = 131072 (128 KB), plus
                                       external = 1048576 (1 MB)   -> mario
                                       external = 4194304 (4 MB)   -> zelda

   Only hashes and sizes live in this script - never any game file/flash/art bytes -
   so nothing sensitive is embedded. All hashing happens locally; nothing is
   uploaded anywhere.

 ARCHIVES INSIDE ARCHIVES  (parity with the site's content-pack loader)
   The site opens a content pack with readZip() in firmware/site/content_pack.js, and
   that reader RECURSES: any entry whose name ends in .zip is itself opened and
   its contents are namespaced under the outer entry's path. A person can
   therefore hand the site one zip full of zips and every game file inside is found.
   This script used to look one level deep only, so the same pack had to be
   flattened by hand before a build would see it. It no longer does: a nested
   archive is opened exactly the way the site opens one, so a pack that works in
   the browser works here and vice versa.

   Three details, all of them deliberate:

     * WHAT IS FOLLOWED. The site follows nested .zip only, because a browser
       has no 7-Zip. This script does have 7-Zip, so it also follows a nested
       .7z/.rar when 7z.exe is installed - the same rule it already applies at
       the top level. That can only ever find MORE than the site, never less,
       and only in packs the site could not read at all.

     * IDENTITY IS STILL THE CONTENT HASH. Nesting changes nothing about what a
       file IS: every game file, PM game and SVG is matched by SHA-256 of its bytes, so
       the same dump found loose, found in a zip, and found three zips deep all
       produce the identical id. The first copy seen wins and the rest are
       ignored (Consider() only ever fills an empty slot), so duplicates at
       different depths are harmless - exactly as they are on the site.

     * COLOUR-UNIT PAIRING IS NAMESPACED. The Mario/Zelda flash images are
       recognised by finding both sizes in ONE container, so a nested archive
       gets its own container key (outer.zip/inner.zip), never the outer one's.
       Two units in two zips inside one zip stay two units. This mirrors the
       "namespacing inner names under the outer archive's name" comment on the
       site's readZip().

   LIMITS. The site has no explicit depth or size limit - the browser simply
   runs out of memory on a malicious pack. This script sets two, because it runs
   unattended over whole drives:

       $MaxArchiveDepth   how many archives may be opened inside one another
       $MaxArchiveBytes   total bytes of NESTED archives this run may inflate
                          before it stops opening deeper ones. A top-level
                          archive is not counted - it is already on the disk,
                          and an honest 20 GB library must not trip a cap that
                          exists for a 40 KB bomb.

   Both are announced when they are hit, so a truncated scan can never be
   mistaken for a complete one. Neither can be reached by any real dump set;
   they exist to stop a zip bomb, not to limit you.

 REQUIREMENTS
   * Windows PowerShell 5.1, or PowerShell 7+.
   * 7-Zip (https://www.7-zip.org) ONLY if your dumps live inside .7z/.rar. .zip
     and loose files need nothing extra.

 HOW TO RUN
   Put your dumps (loose, or in .zip/.7z/.rar, any sub-folders) in
   firmware\games\<system>\ and double-click firmware\scripts\build-<system>.cmd.
   No editing, no questions: it scans, prints a summary and writes.
================================================================================
#>
[CmdletBinding()]
param(
  [string[]] $Systems = @('gnw', 'pokemini', 'gameboy', 'nes'),
  [string]   $GamesRoot,
  [string]   $BuiltInRoot,
  [string]   $OutDir,
  [string]   $SiteRoot,
  [switch]   $ListOnly,
  [string[]] $ServerServed = @()
)

# ============================== FOLDERS ======================================
# Every path is relative to this script's own location, so the folder can sit
# anywhere and nothing needs editing:  <site>\firmware\scripts\lib\<this file>
$FirmwareDir = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
if (-not $SiteRoot)  { $SiteRoot  = Split-Path $FirmwareDir -Parent }
if (-not $BuiltInRoot) { $BuiltInRoot = Join-Path $FirmwareDir 'games' }
if (-not $GamesRoot)   { $GamesRoot   = $BuiltInRoot }
if (-not $OutDir)      { $OutDir      = Join-Path $FirmwareDir 'output' }
$Systems = @($Systems | ForEach-Object { $_ -split ',' } | ForEach-Object { $_.Trim().ToLowerInvariant() } | Where-Object { $_ })
# Folder names are the library's system names (2026-10-11).
$SysFolders = [ordered]@{ gnw = @('gnw'); pokemini = @('pm'); gameboy = @('gb', 'gbc'); nes = @('nes', 'famicom', 'fds') }   # famicom merged into nes 2026-10-12; moved back out by hash 2026-10-15
$SysLabel   = @{ gnw = 'Game & Watch'; pokemini = 'Pokemon mini'; gameboy = 'Game Boy / Game Boy Color'; nes = 'NES / Famicom Disk System' }
foreach ($s in $Systems) { if (-not $SysFolders.Contains($s)) { throw "unknown system '$s' (use gnw, pokemini, gameboy, nes)" } }
# Only the repo's own built-in folders are ever created; the library root is
# read, never written to.
foreach ($s in $SysFolders.Keys) { foreach ($d in $SysFolders[$s]) { New-Item -ItemType Directory -Force -Path (Join-Path $BuiltInRoot $d) | Out-Null } }
# The folders one system folder name stands for, built-ins FIRST so a built-in
# title is always the copy that is kept (duplicates are dropped by hash):
#   <BuiltInRoot>\<sys>                              the repo's built-in titles
#   <GamesRoot>\<sys>\games, <GamesRoot>\<sys>\bios  a library laid out by system,
#                                                    with games and bios folders
#   <GamesRoot>\<sys>                                any other root (flat layout)
# A system folder named in -ServerServed (served by the game server, set in
# build.ps1) reads ONLY its built-in folder, never the library root.
$ServerServed = @($ServerServed | ForEach-Object { $_ -split ',' } | ForEach-Object { $_.Trim().ToLowerInvariant() } | Where-Object { $_ })
function Get-InputFolders([string]$d) {
  $list = New-Object System.Collections.Generic.List[string]
  $list.Add([System.IO.Path]::GetFullPath((Join-Path $BuiltInRoot $d)))
  if ($ServerServed -contains $d) { return @($list | Where-Object { Test-Path -LiteralPath $_ -PathType Container }) }
  $lib = Join-Path $GamesRoot $d
  if (Test-Path -LiteralPath (Join-Path $lib 'games') -PathType Container) {
    # games and its sibling cartridge folders (homebrew, prototypes, tests, ...; 2026-10-21),
    # named in one place: the game server's systems.json "cartridge_folders"
    $cf = @((Get-Content -LiteralPath $(if ($env:CWS_SYSTEMS_JSON) { $env:CWS_SYSTEMS_JSON } else { (Join-Path $(if ($env:CW_PROJECTS) { $env:CW_PROJECTS } else { '..' }) 'CrystalWorldsServer\internal\library\systems.json') }) -Raw -ErrorAction Stop | ConvertFrom-Json).cartridge_folders)
    if ($cf.Count -lt 1 -or $cf[0] -ne 'games') { throw 'systems.json has no cartridge_folders starting with games' }
    foreach ($sub in $cf + @('bios')) { $list.Add([System.IO.Path]::GetFullPath((Join-Path $lib $sub))) }
  } else { $list.Add([System.IO.Path]::GetFullPath($lib)) }
  return @($list | Select-Object -Unique | Where-Object { Test-Path -LiteralPath $_ -PathType Container })
}
$SourceFolders = @(foreach ($s in $Systems) { foreach ($d in $SysFolders[$s]) { foreach ($p in (Get-InputFolders $d)) { [pscustomobject]@{ Sys = $d; Path = $p } } } })
if ($ListOnly) {
  foreach ($sf in $SourceFolders) {
    $files = @(Get-ChildItem -LiteralPath $sf.Path -Recurse -File -ErrorAction SilentlyContinue)
    Write-Host ("[{0}] {1}  ({2} file(s), {3:N0} bytes)" -f $sf.Sys, $sf.Path, $files.Count, (($files | Measure-Object Length -Sum).Sum + 0)) -ForegroundColor Cyan
    foreach ($f in $files) { Write-Host ("    {0}" -f $f.FullName.Substring($sf.Path.Length).TrimStart('\')) }
  }
  Write-Host 'List only: nothing was opened, hashed or written.' -ForegroundColor Yellow
  exit 0
}
New-Item -ItemType Directory -Force -Path $OutDir | Out-Null
# ============================================================================

# -------------------------------- options -----------------------------------
$ArchiveExt   = @('.zip', '.7z', '.rar')
$MaxProgramBytes  = 262144          # classic firmware files are a few KB. Any file this size or
                                # smaller is hashed as a game file candidate - its name
                                # and extension are irrelevant (matching is purely
                                # by content), so messy dump names are fine.
$MaxSvgBytes  = 2097152         # segment SVGs run to ~650 KB; generous headroom

# Nested-archive guards. See "ARCHIVES INSIDE ARCHIVES" in the header. The site
# has neither of these; they are here because this script walks whole drives
# unattended and a zip bomb would otherwise run it out of disk.
$MaxArchiveDepth = 8            # archives opened inside one another. A top-level
                                # archive is depth 1, so 8 means "a zip in a zip
                                # in a zip ... eight deep". Real dump sets are 1-2.
$MaxArchiveBytes = 8GB          # total bytes of NESTED archives inflated in one
                                # run (a top-level archive is not charged - see
                                # the header). A bomb multiplies by ~16 a level,
                                # so this stops one within a few levels, while a
                                # real pack never inflates more than a few MB.

$TftInternal  = 131072          # colour-unit internal flash (both units)
$TftExtMario  = 1048576         # colour-unit external flash - Mario
$TftExtZelda  = 4194304         # colour-unit external flash - Zelda

$Root         = $SiteRoot
$OutGnwGames      = Join-Path $OutDir 'gnw_games.json'
$OutArt       = Join-Path $OutDir 'artwork.json.gz'
$OutPokemini  = Join-Path $OutDir 'pokemini_games.json'   # Pokemon mini game files + shared BIOS (base64, id-keyed)
$OutGb        = Join-Path $OutDir 'gb_games.json'         # Game Boy cartridges + boot programs (base64, id-keyed)
$OutGbManifest= Join-Path $OutDir 'gb_manifest.json'     # the same content described, WITHOUT the bytes (a few KB)
$OutNes       = Join-Path $OutDir 'nes_games.json'        # NES/Famicom game files (base64, id-keyed by content)
$OutNesManifest=Join-Path $OutDir 'nes_manifest.json'    # the same content described, WITHOUT the bytes (a few KB)
$OutTft       = @{ mario = (Join-Path $Root 'play\mario\firmware_mario.js');
                   zelda = (Join-Path $Root 'play\zelda\firmware_zelda.js') }

# ---------------------------- Game Boy ---------------------------------------
# MIRRORS firmware/site/content_pack.js. Same manifest, same identity rule (whole-file
# sha256), same keys, same extra-title budget -- so the file this script bakes and
# the pack a user imports in Settings -> Content are interchangeable. If you add a
# row here, add it there; they are the same catalogue seen from two sides.
# Since 2026-10-12 the manifest holds only the two boot programs: the twelve
# showcase cartridge rows (gb-tetris ...) were removed with the showcase entries,
# so those dumps are baked as gb-x<sha12> extras like any other cartridge.
$GbExtraMaxFiles = 64
$GbExtraMaxBytes = 32MB
$GbMaxBytes      = 8MB          # largest cartridge the Game Boy mapper space allows
$GbManifest = @'
[
{"sha256":"cf053eccb4ccafff9e67339d4e78e98dce7d1ed59be819d2a1ba2232c6fce1c7","bytes":256,"device":"bios"},
{"sha256":"c56299bedd56debdbf36442238636bf5887a65c5173b33995682052353804da9","bytes":2304,"device":"biosCgb"}
]
'@ | ConvertFrom-Json
$GbByHash = @{}
foreach ($g in $GbManifest) { $GbByHash[$g.sha256] = $g }
$GbSizes = @{}
foreach ($g in $GbManifest) { $GbSizes[[long]$g.bytes] = $true }

# ------------------------------ NES / Famicom ---------------------------------
# THERE IS NO CURATED NES TITLE LIST HERE, and that is a decision rather than an
# omission: the NES titles that count are "the ones that are loaded by the
# content button or placed in the firmware folder - same loading rules as the
# other games". So there is nothing to match a hash against, and every NES game
# is content-derived, exactly the way the Game Boy's EXTRA titles are ($GbExtra,
# step 0b in Consider): the key is 'nes-x' + the first 12 hex of the file's
# sha256, which is stable across dumps, stable across imports, and cannot
# collide with any catalogue slot name because no catalogue slot exists.
#
# Recognition is the iNES header magic, bytes 4E 45 53 1A ("NES" + EOF) at
# offset 0. That is enough on its own, which is why this needs no logo-plus-
# checksum pair the way the Game Boy does: the Game Boy header has no magic
# number at all, so a cartridge can only be recognised by two weak tests
# agreeing, whereas a 32-bit signature at a fixed offset is one strong test.
# What the magic CANNOT tell us is whether the dump is complete, so the header's
# own declared PRG size is checked against the file length below - a truncated
# dump is reported as truncated instead of shipped as a game that dies on boot.
#
# MIRRORS firmware/site/content_pack.js, the same way the Game Boy block does: same
# recognition test, same key scheme, same budget, so the file this script bakes
# and the pack a user imports in Settings -> Content are interchangeable.
$NesMaxFiles    = 64            # how many NES game files one build will keep
$NesMaxBytes    = 48MB          # total NES bytes one build will keep. The count cap
                                # is what keeps the NES page a page rather than a
                                # directory listing; this is what keeps the write
                                # survivable. Ordinary NES games are 40 KB - 512 KB,
                                # so 64 of them is 16-32 MB and the count binds
                                # first, as intended; the headroom exists so that
                                # one or two large mapper carts cannot make the
                                # byte cap bind at a dozen files.
$NesCartMaxBytes = 64MB + 528   # largest single game file accepted: the limit the
                                # NES shares with the game server and the
                                # content pack (29 Oct 2026), 64 MB plus the
                                # 16-byte header and 512-byte trainer. NES 2.0
                                # headers describe more than the old iNES 6 MiB,
                                # and the large multicarts use it.
$NesMagic       = [byte[]](0x4E, 0x45, 0x53, 0x1A)
# ------------------------------------------------------------------------------

# Pokemon mini content sizes (recognised by content hash, like the classic firmware dumps).
# The 10 game game files are 512 KB Game Paks; the shared BIOS is a 4 KB dump.
$PmGameBytes   = 524288
$PmBiosBytes  = 4096
# -----------------------------------------------------------------------------

$ErrorActionPreference = 'Stop'

# Launched via right-click "Run with PowerShell", the console closes the instant
# the script ends or errors - so the summary/error would flash past. Pause at
# every exit: _Pause is called on each normal exit, and the trap below catches
# any unexpected error, shows it, and pauses too.
# 2026-10-10: the .cmd launchers in firmware\scripts keep the window open, so
# this script never waits for a key itself (build-all runs it unattended).
function _Pause { }
trap {
  Write-Host ''
  Write-Host ('ERROR: ' + $_.Exception.Message) -ForegroundColor Red
  exit 1
}

# ---- game file identity table:  SHA-256 (of the true, unpadded dump) -> title/part.
# 'bytes' is the dump's real length, used for a truncation fallback so a dump
# zero-padded LARGER than the real chip still matches.
$HashTableJson = @'
[
{"sha256":"1b1bb844c4bb0481a87e6c114a438b2d4e308c1581f4e7dd7dfa7ff8222d1cfd","bytes":1856,"device":"ball","part":"program"},
{"sha256":"1b1bb844c4bb0481a87e6c114a438b2d4e308c1581f4e7dd7dfa7ff8222d1cfd","bytes":1856,"device":"ballreissue","part":"program"},
{"sha256":"38bfbb54eedb3761804d6e659da76e2c2dc0f916606ca081a6f0854c15aaba05","bytes":4096,"device":"bfight","part":"program"},
{"sha256":"7f17e2032b8a0037d51f91aa0900f8c0e28d9a5e4e89c96ada1a893dcbc7ef2b","bytes":256,"device":"bfight","part":"melody"},
{"sha256":"38bfbb54eedb3761804d6e659da76e2c2dc0f916606ca081a6f0854c15aaba05","bytes":4096,"device":"bfightn","part":"program"},
{"sha256":"7f17e2032b8a0037d51f91aa0900f8c0e28d9a5e4e89c96ada1a893dcbc7ef2b","bytes":256,"device":"bfightn","part":"melody"},
{"sha256":"3863a70f01819db79155f99eefb90219a01fe689d6940d02121bba60656f8d6c","bytes":4096,"device":"bjack","part":"program"},
{"sha256":"771d34cd866ea5af60cbdf642f58844cbdb8621e5fbc37976aeeeb9933974f78","bytes":256,"device":"bjack","part":"melody"},
{"sha256":"4f559e796947bb11d3a8b5636669c5674c3aa4f75a05b7c343ae829601e031a1","bytes":4096,"device":"bombsweep","part":"program"},
{"sha256":"3c45f3d0c049272344139d143b13a4e2ddbd213263062d8e1a1e682233b1636d","bytes":256,"device":"bombsweep","part":"melody"},
{"sha256":"927b582f26ee72230b4448867444bb800b259d1d1f16d7dce19e7adce16bd7a2","bytes":4096,"device":"boxing","part":"program"},
{"sha256":"6e4736ebada050955f2f75ceeff85be744049510623ef6dc4286e37b411499ea","bytes":256,"device":"boxing","part":"melody"},
{"sha256":"9bcaafaefe6d8cbefdcdab1d5801ed471e3ba52c44f405479c886fed094a3641","bytes":4096,"device":"cgrab","part":"program"},
{"sha256":"27fbd8bbfab1a8d7b2a484256f05e01426cf4170ffa79452c89181a620d8e20c","bytes":1856,"device":"chef","part":"program"},
{"sha256":"aa151f4a31d8f140d6905f705156ca33cda0c548ac2b179df121ac7ed13120ad","bytes":4096,"device":"climber","part":"program"},
{"sha256":"98cace3b07edacb62d989a1f258e063905f3ff99e27389d8cc5cd95f76a9d94b","bytes":256,"device":"climber","part":"melody"},
{"sha256":"aa151f4a31d8f140d6905f705156ca33cda0c548ac2b179df121ac7ed13120ad","bytes":4096,"device":"climbern","part":"program"},
{"sha256":"98cace3b07edacb62d989a1f258e063905f3ff99e27389d8cc5cd95f76a9d94b","bytes":256,"device":"climbern","part":"melody"},
{"sha256":"e9fc7e4858c48faa54ec9bf890c0f1a5a2b18c3a22d168b505d515f7c940bfe3","bytes":4096,"device":"dkcirc","part":"program"},
{"sha256":"cf90bba51dc00e01c0a168157db99b2aaf91ca83194644f8a9c7474b1d5a8430","bytes":256,"device":"dkcirc","part":"melody"},
{"sha256":"7b358188e341faf8dea9dd94717b70ae38a409eb134ec71fe00e7feca42f9778","bytes":4096,"device":"dkhockey","part":"program"},
{"sha256":"1d7d2dfbbf3ac5c05032cbf811607522b452f54bd42959dc54d5f7714cdb17ab","bytes":256,"device":"dkhockey","part":"melody"},
{"sha256":"b279a9b2b6bcdcacbd09bdae869c63a8cbf378745280a5c33593ce48abc052be","bytes":4096,"device":"dkjr","part":"program"},
{"sha256":"ccbfa247ea985d73d56b9c4bdfe9576736abc3520217047658c710645d0916e0","bytes":4096,"device":"dkjrp","part":"program"},
{"sha256":"c0b8625e7e401df44c4f7fb407000e270ed0842ff99458eafab21a90c193568e","bytes":256,"device":"dkjrp","part":"melody"},
{"sha256":"ccbfa247ea985d73d56b9c4bdfe9576736abc3520217047658c710645d0916e0","bytes":4096,"device":"dkjrt","part":"program"},
{"sha256":"c0b8625e7e401df44c4f7fb407000e270ed0842ff99458eafab21a90c193568e","bytes":256,"device":"dkjrt","part":"melody"},
{"sha256":"4112ef438bd98176e2e3f2b75a3bdcb856cdd07b297232ba7a8d992315464761","bytes":4096,"device":"dkong","part":"program"},
{"sha256":"f93e876811487a37a5275de0f4cf0ae716d885573f8c1753d836c7eb03cb5613","bytes":4096,"device":"dkong2","part":"program"},
{"sha256":"00db2b7d6060d0042358bc4d5be7e660be7e2eec6f5bb933bac8be5b2439ce56","bytes":4096,"device":"dkong3","part":"program"},
{"sha256":"b2791b378620460b8ad9795d14eb1eeaae4a52c38ff67cf1a8c3e09a218ec6f0","bytes":256,"device":"dkong3","part":"melody"},
{"sha256":"28a225536ec129f227b8d3e261e6f10012206d0404d5f5d958c60bd71773fa7d","bytes":1856,"device":"egg","part":"program"},
{"sha256":"0d955064089d66c8b0bf7a83fb36400c1630d02f24240c11759e88437682b575","bytes":1856,"device":"fire","part":"program"},
{"sha256":"7e3d50dd31ae9ef5c9b4458dbc66854b87b6db99add3aa080967f09f655e29dc","bytes":4096,"device":"fireatk","part":"program"},
{"sha256":"1005998c0be5af8491fa481d8793e62d47f47e3f9f709ef083aff9cd43950469","bytes":1856,"device":"firews","part":"program"},
{"sha256":"4d61ea391bfa1d2da46c3baf4497d7bf0f2e6e482ce910c75d2ad1b259bd2b48","bytes":1856,"device":"flagman","part":"program"},
{"sha256":"426a433e046ab437aec35283181992952e6db99cf06b4eb8d33e28e7366c6e6d","bytes":4096,"device":"gcliff","part":"program"},
{"sha256":"242b2b65aa5189b3fa6dc29b801762767e1a6e026edd3d8ace8f63a0a0bf522e","bytes":256,"device":"gcliff","part":"melody"},
{"sha256":"d0b1756bdced26372e0524230a9cb72b882c566396ee0069386cd6b65c7247f0","bytes":4096,"device":"ghouse","part":"program"},
{"sha256":"7c7aa1511ebf25964be6f2fb4e5764c37ea04ca3ff09d37b519816aa497d2058","bytes":1856,"device":"helmet","part":"program"},
{"sha256":"f92ce28f00124c1da3627a5461f06d5157d45b1067e5f15c0a36edecdce67a68","bytes":1856,"device":"judge","part":"program"},
{"sha256":"cd1160e842e83226269dfc72c51335cabfbd2e4333317c5ba2f184f6b0df321e","bytes":1856,"device":"helmet~cn07","part":"program"},
{"sha256":"7a6a931445c1af0d84e2edd100a8efdbe4d7d5f7da484de6a1ea54fad3ea3c74","bytes":1856,"device":"judge~ip15","part":"program"},
{"sha256":"c5fc5f8c8b5fa21f0aa8a6448d57c961d6e53b8afa723efe3172e2c98141f194","bytes":4096,"device":"lboat","part":"program"},
{"sha256":"16e1a9b9849ed0c5ebcf818e9ed64157528631ac110b4e649a4e339f08e99582","bytes":1856,"device":"lion","part":"program"},
{"sha256":"bf1de11e8b450de8d6bde4a864848ccff31ac13d3329734ee006dfb5d232a36d","bytes":1856,"device":"manhole","part":"program"},
{"sha256":"371cceca4dccbb6e30c9bd6f46c0a0647d6d0592dc1006b32299947931cf8998","bytes":4096,"device":"manholews","part":"program"},
{"sha256":"e11cfc69bb14c03fcb5f849ac0697e2f0fca399095db09f80ee2f9f0e18ccd4c","bytes":4096,"device":"mario","part":"program"},
{"sha256":"7aa3ba6730c53f968eb6af7efad3db2fdb99bafb020ba100fbe2454b8466672d","bytes":4096,"device":"mariocm","part":"program"},
{"sha256":"6f997b63a6ad297c8a3df9de3d4008db1ef81f5999f49c6c27c14a1d486427bc","bytes":4096,"device":"mariocmt","part":"program"},
{"sha256":"6e22de86c901f718f34f5814955e0cdcca2149f222559bb6402662b26bd626d9","bytes":256,"device":"mariocmt","part":"melody"},
{"sha256":"257aed0bb880a872b02ce237c9d7c3bf183fa65305440c3beafac73cf15b87d3","bytes":4096,"device":"mariotj","part":"program"},
{"sha256":"7b0d8a978483d5d3534c97222e6f0e2f99796776ffd15b86a3fe645d12cb574b","bytes":256,"device":"mariotj","part":"melody"},
{"sha256":"8698ee42695d6e384a3237cbba5fe2da15acffb3214f4127830434574a37b0ff","bytes":4096,"device":"mbaway","part":"program"},
{"sha256":"2657ae126ec3bf62392b5bd51061559cb1e4ec64b8a9fff56afc27c70224043c","bytes":256,"device":"mbaway","part":"melody"},
{"sha256":"273e8e4058a6b5279e4f4f82d02acba0e9a788d9b33533050460213daa83f735","bytes":4096,"device":"mickdon","part":"program"},
{"sha256":"28a225536ec129f227b8d3e261e6f10012206d0404d5f5d958c60bd71773fa7d","bytes":1856,"device":"mmouse","part":"program"},
{"sha256":"e9fc7e4858c48faa54ec9bf890c0f1a5a2b18c3a22d168b505d515f7c940bfe3","bytes":4096,"device":"mmousep","part":"program"},
{"sha256":"cf90bba51dc00e01c0a168157db99b2aaf91ca83194644f8a9c7474b1d5a8430","bytes":256,"device":"mmousep","part":"melody"},
{"sha256":"4c45f7fe4df94bc15aeab606bbe2b20a606c272d3021ed64929c3ae67dce32c3","bytes":1856,"device":"octopus","part":"program"},
{"sha256":"8e042b8e03f3a09f0c7fa4730fb2d6ce29c5265ae429993cdd7d0436758e9ef1","bytes":4096,"device":"opanic","part":"program"},
{"sha256":"13f95a9d6e1d02677267b488476e09ab2b8d179112ab9da86397731a433b1bab","bytes":1856,"device":"pchute","part":"program"},
{"sha256":"9dc1b7e3b7a7b2868127ee204849bdd92347548f75f8ca1e3c71ae58bef12138","bytes":4096,"device":"pinball","part":"program"},
{"sha256":"ec11a70e9fa7bda13562f73c623bf4799404b35c1a8fd1d5b64b517d8e10cdcb","bytes":256,"device":"pinball","part":"melody"},
{"sha256":"101981fee60fee7e0343373b19b1ae414e54eb8212e6b320e3fb6e1f3a87738f","bytes":1856,"device":"popeye","part":"program"},
{"sha256":"fb0621194a49a9c565bf883e394c71c8e1ab023a154c87b34af910cf4de5fb8e","bytes":4096,"device":"popeyep","part":"program"},
{"sha256":"6c46c57f8573bbe1c8beb46e2ae6370fa82cc393a715e1b0da9bc93c250c830e","bytes":256,"device":"popeyep","part":"melody"},
{"sha256":"fb0621194a49a9c565bf883e394c71c8e1ab023a154c87b34af910cf4de5fb8e","bytes":4096,"device":"popeyet","part":"program"},
{"sha256":"6c46c57f8573bbe1c8beb46e2ae6370fa82cc393a715e1b0da9bc93c250c830e","bytes":256,"device":"popeyet","part":"melody"},
{"sha256":"78bdee56533b5dfa4a031b5c14ae3614e3fa113642c86d1a96e628e1d8990ba5","bytes":4096,"device":"rshower","part":"program"},
{"sha256":"254d103f04eac2352a2697561e15b60f0e2b8a4b78bcdeae32bd6990a788f3ab","bytes":4096,"device":"sbuster","part":"program"},
{"sha256":"eac894385cc9523cf1fc5816ba03931e9847c613f0bd693abb61cce26d066135","bytes":256,"device":"sbuster","part":"melody"},
{"sha256":"d4a1eb9d9401edadcb7f903f86918be3000e7afee5ede4b51efa1ea266e38de9","bytes":4096,"device":"smb","part":"program"},
{"sha256":"05a26b5f9e2ae462a38cb08cc65e39bfaf1e1c992e7f227476ecd92eaa94b115","bytes":256,"device":"smb","part":"melody"},
{"sha256":"d4a1eb9d9401edadcb7f903f86918be3000e7afee5ede4b51efa1ea266e38de9","bytes":4096,"device":"smbn","part":"program"},
{"sha256":"05a26b5f9e2ae462a38cb08cc65e39bfaf1e1c992e7f227476ecd92eaa94b115","bytes":256,"device":"smbn","part":"melody"},
{"sha256":"d4a1eb9d9401edadcb7f903f86918be3000e7afee5ede4b51efa1ea266e38de9","bytes":4096,"device":"smbspecial","part":"program"},
{"sha256":"05a26b5f9e2ae462a38cb08cc65e39bfaf1e1c992e7f227476ecd92eaa94b115","bytes":256,"device":"smbspecial","part":"melody"},
{"sha256":"921f7b1683598c928ac486dbdf3741bfa09a28c975aead8fa15375a902699885","bytes":4096,"device":"snoopyp","part":"program"},
{"sha256":"2c1e9bfc8005494fc281c21dd9dbae92d71355fcb802386c79f48bf711232bab","bytes":256,"device":"snoopyp","part":"melody"},
{"sha256":"921f7b1683598c928ac486dbdf3741bfa09a28c975aead8fa15375a902699885","bytes":4096,"device":"snoopyt","part":"program"},
{"sha256":"2c1e9bfc8005494fc281c21dd9dbae92d71355fcb802386c79f48bf711232bab","bytes":256,"device":"snoopyt","part":"melody"},
{"sha256":"09148c55a0dc823556f2c98caea9761b5062a7e5614bae4e96b692d8390f9fad","bytes":4096,"device":"squish","part":"program"},
{"sha256":"d156fde38a4d54e12015aa820cd8363e20455b13f5cc2ab3808c02268107c5a7","bytes":4096,"device":"ssparky","part":"program"},
{"sha256":"f48929ec8c9a9a1e131f4a5d48333fe2dc2b1fbafcdf41815f267b7c73516247","bytes":4096,"device":"stennis","part":"program"},
{"sha256":"af4fed4fe0102e17ab18ea005a74026d5c5545f3193eeb195af7daca8df27ee2","bytes":4096,"device":"tbridge","part":"program"},
{"sha256":"9cb2b6d604d930c94dc8a3d548656b563d487427c957c5c71828b5174385e667","bytes":4096,"device":"tfish","part":"program"},
{"sha256":"9e1237404bcd8edf0b9d415b928d9ef5d5d475e3fbac65d6678a6dcb3eb47c87","bytes":1856,"device":"vermin","part":"program"},
{"sha256":"6a53d017f6b18c52472f7cb40a3fb45a9744c1a3c4bb453a162a168705c0f3c1","bytes":4096,"device":"zelda","part":"program"},
{"sha256":"4dbee2865abcd4767d0c0a1b8a6689efe0c8c49155a9de1ed6ff9abfc43643bc","bytes":256,"device":"zelda","part":"melody"}
]
'@
$Rows = $HashTableJson | ConvertFrom-Json
$ByHash = @{}
foreach ($r in $Rows) {
  $h = $r.sha256.ToLower()
  if (-not $ByHash.ContainsKey($h)) { $ByHash[$h] = New-Object System.Collections.ArrayList }
  [void]$ByHash[$h].Add($r)
}
$KnownLengths = @($Rows | ForEach-Object { $_.bytes } | Sort-Object -Unique -Descending)

# ---- Artwork identity table:  SHA-256 (of the .svg file) -> svgPath key.
$SvgHashJson = @'
[
{"sha256":"db401b6d1774377084bdd12fd7333cb7bcc19854611c7874297aa463b8d4cb30","bytes":72811,"path":"artwork/gnw_ball/gnw_ball.svg"},
{"sha256":"20fa0bb48a7a9cfab813a4c842d1da1e6570dfc47e9041221f379cf23cb0e41d","bytes":589547,"path":"artwork/gnw_bfight/gnw_bfight.svg"},
{"sha256":"c69c97969bafbe2c5b92acda4ba276dc164724a479f130557d495846f9e9128a","bytes":561531,"path":"artwork/gnw_bfightn/gnw_bfightn.svg"},
{"sha256":"027dde7eddb70a6d15c46a762535b7ca5457c67c6fbaf2d93c12bf98086ef170","bytes":114359,"path":"artwork/gnw_bjack/gnw_bjack_bottom.svg"},
{"sha256":"c4c582769bb4b363aee24cd8e884e446d29af45ef5f6fb2ddb6a0268a6242956","bytes":76617,"path":"artwork/gnw_bjack/gnw_bjack_top.svg"},
{"sha256":"1959b5af3a8b37a7f243167edd095b5ec3b7d4f22400d1c8bbe823c6b02531dc","bytes":267045,"path":"artwork/gnw_boxing/gnw_boxing.svg"},
{"sha256":"63c4824cfa5252275cf25f6548637b6cacf215f51b8ade30a897ba3e4c076fe9","bytes":279182,"path":"artwork/gnw_bsweep/gnw_bsweep_bottom.svg"},
{"sha256":"ae12ec5ff7460844b76c49096621c8d79666fc700b43983276c836dfb1ae98ed","bytes":219259,"path":"artwork/gnw_bsweep/gnw_bsweep_top.svg"},
{"sha256":"b117780afee00797cdf42f8dfe125099a699efc059894315d778078e24aaad75","bytes":356585,"path":"artwork/gnw_cgrab/gnw_cgrab.svg"},
{"sha256":"74aa24b59ffd2b59bf81f91a8b94e2f331f99d3cfeebddfece88b17d7b9808a7","bytes":200341,"path":"artwork/gnw_chef/gnw_chef.svg"},
{"sha256":"740452c4b76af3e7430cae7c5ede1b27df0ae53fe3b81f26e2524a2d96d88226","bytes":567878,"path":"artwork/gnw_climber/gnw_climber.svg"},
{"sha256":"389c13b436da2d1b6e9ffc9877decaf76038662e6ffe629f123357709ad7a03f","bytes":545547,"path":"artwork/gnw_climbern/gnw_climbern.svg"},
{"sha256":"0da56c16fe665958c1f1d7cf372050bf3833ecf908a19cf5d757903255888875","bytes":370692,"path":"artwork/gnw_dkcirc/gnw_dkcirc.svg"},
{"sha256":"4f8846901bc76b26ef098f1b9a65a1f9773aa3113ca59a7766bab1f439effe31","bytes":265170,"path":"artwork/gnw_dkhockey/gnw_dkhockey.svg"},
{"sha256":"d1f38e1a77dbacd37dfa5214c1d1e7cff954a6af0adce0e88bc70646904502a9","bytes":282146,"path":"artwork/gnw_dkjr/gnw_dkjr.svg"},
{"sha256":"5ad0b6815a581088d8ebacdc9872017852444c1aeb5435dd84c62398415bd120","bytes":342814,"path":"artwork/gnw_dkjrp/gnw_dkjrp.svg"},
{"sha256":"2fcec16a89557d5ceab65e50ede0b86ec5b1bf0df49b38c4852a93e63a20e42c","bytes":146521,"path":"artwork/gnw_dkong/gnw_dkong_bottom.svg"},
{"sha256":"5f5dbd84a726fb05a1bf46c7c3aa38948cd5e69e7711fe269c4d2aca1539841c","bytes":177776,"path":"artwork/gnw_dkong/gnw_dkong_top.svg"},
{"sha256":"15b40e5486959d1b33952240060bb472afbd53f036df6e8e355760b93584688f","bytes":391531,"path":"artwork/gnw_dkong2/gnw_dkong2_bottom.svg"},
{"sha256":"73734e768c978274c1f70bb440d147d22ff93fc961147444b027b56539835d1e","bytes":268301,"path":"artwork/gnw_dkong2/gnw_dkong2_top.svg"},
{"sha256":"339a166595726460456a0ee1e26e0e49194d9139a4f4679ce94b55fb6f3a8a8c","bytes":294602,"path":"artwork/gnw_dkong3/gnw_dkong3.svg"},
{"sha256":"a6dcd59e0e474b2ea099e42fe4e3ded8c38a333523ef124d1fdc0aefdf3a53c5","bytes":194252,"path":"artwork/gnw_egg/gnw_egg.svg"},
{"sha256":"031e7c5e8e2725f2e16e8ada24fccfbdc49e0ca7926806134f72d9718bc2b6d6","bytes":269534,"path":"artwork/gnw_fireatk/gnw_fireatk.svg"},
{"sha256":"5a351758f7e5015c708a504f531c9540153927df6f0eda4661e8b60dd301c165","bytes":103612,"path":"artwork/gnw_fires/gnw_fires.svg"},
{"sha256":"c48203ca22f8fc8dfbfb7f320700aaa718b295074ad0a0465fb300213bbd06a7","bytes":164998,"path":"artwork/gnw_firews/gnw_fire.svg"},
{"sha256":"a61f10043d00dd8f3a21585793f5a9a2d982aa5e46ce8c3dccb2360948f87e97","bytes":56805,"path":"artwork/gnw_flagman/gnw_flagman.svg"},
{"sha256":"433aba45b2b493c13095d85bff71a0c2cbf27ce03d65d94338f0f8cd4f3bad47","bytes":520873,"path":"artwork/gnw_gcliff/gnw_gcliff_bottom.svg"},
{"sha256":"8ce4562ebdcd5582b8fef692d6a99530509db8ec54528b25ce6ce15432757788","bytes":532129,"path":"artwork/gnw_gcliff/gnw_gcliff_top.svg"},
{"sha256":"e2dcac55bb82463df61fe16b79f77fd4a0f9010f261bcbd6199daf17f55f52f4","bytes":150531,"path":"artwork/gnw_ghouse/gnw_ghouse_bottom.svg"},
{"sha256":"053023ec8dfc4822fcd6d3a0ce79ab324abac04a94fef93ec6ac9e704360416c","bytes":160325,"path":"artwork/gnw_ghouse/gnw_ghouse_top.svg"},
{"sha256":"7fda100a4fa24d2d4c5cdac1a24614ceb3a5f400c8473d9d3a64885e32a3da4e","bytes":110523,"path":"artwork/gnw_helmet/gnw_helmet.svg"},
{"sha256":"4b24fcb7ed2d2dac28d43de40c8c19a59fd302d8b451b85c5c387ba18aad2a1e","bytes":106156,"path":"artwork/gnw_judge/gnw_judge.svg"},
{"sha256":"5917a6516514eb41f4e981d1a6c698f5554e20826428fae7553e23db65eec87e","bytes":157498,"path":"artwork/gnw_lboat/gnw_lboat_left.svg"},
{"sha256":"c46292b8a7ca6b1c494a0ad49872e2068d591d7642026f2bed4e52a6f1377a93","bytes":156142,"path":"artwork/gnw_lboat/gnw_lboat_right.svg"},
{"sha256":"3287f0bf3dac82ce57faba1b53add1b41bdc98bc5cdaeff43779a78774b7f579","bytes":156926,"path":"artwork/gnw_lion/gnw_lion.svg"},
{"sha256":"a58b313a80e816f9c0525fb09d2c109bb5288c761b83039bfd074506cc308da8","bytes":126666,"path":"artwork/gnw_manhole/gnw_manhole.svg"},
{"sha256":"f2f2035d1a60a35d875ee882f2cad9d070ae845fca1d83af7c31a6a49117d201","bytes":225172,"path":"artwork/gnw_manholews/gnw_manholews.svg"},
{"sha256":"2f61efc7797dcd87e43ebc36a2868f76ac109f09b5712e1c1d6f405312158758","bytes":156294,"path":"artwork/gnw_mario/gnw_mario_left.svg"},
{"sha256":"7acdb7e3da77205ff9127925fe3224fdac041b88f9a5d3e249a7b4e645ff774c","bytes":204213,"path":"artwork/gnw_mario/gnw_mario_right.svg"},
{"sha256":"3e0c5dbdc0750c1efcbffa3d1f5b51f2f75a71b267a730cc06c5b1047d8fe6f2","bytes":304752,"path":"artwork/gnw_mariocm/gnw_mariocm.svg"},
{"sha256":"9f7cdafba96d23ca8665cb0416d0978884ac34a09b4c926a0dd990df1cef2247","bytes":295811,"path":"artwork/gnw_mariocmt/gnw_mariocmt.svg"},
{"sha256":"b8858d8a499d42e084164ea78698db5ac96f977845f9255788292af52497e642","bytes":212480,"path":"artwork/gnw_mariotj/gnw_mariotj.svg"},
{"sha256":"5d7e4e226121745c44ba513d95ad813589925737330bf244f26ea57d6a2074dd","bytes":519301,"path":"artwork/gnw_mbaway/gnw_mbaway.svg"},
{"sha256":"46df4f33ed7ed42a48c95f284c94900ef082bda81d80e54ee408dd2e1cafc98e","bytes":123462,"path":"artwork/gnw_mickdon/gnw_mickdon_bottom.svg"},
{"sha256":"2d608b7fa9e689434ee5c4d2c512db07681f86689e7c92dd7004b187d6362d46","bytes":127097,"path":"artwork/gnw_mickdon/gnw_mickdon_top.svg"},
{"sha256":"bb5b2a2bffcd4c60716010951a6569bab20361c33d355ef5a1d5ef83b9ff852e","bytes":182853,"path":"artwork/gnw_mmouse/gnw_mmouse.svg"},
{"sha256":"dd8047bc490098c9f45f881d5396c61875196b100d23274505e4a48ca18da7dc","bytes":278396,"path":"artwork/gnw_mmousep/gnw_mmousep.svg"},
{"sha256":"f4cc48381f04c1d1ae518a3ed048d9e51d71e15d877d709cd34aead414a65bc4","bytes":120914,"path":"artwork/gnw_octopus/gnw_octopus.svg"},
{"sha256":"2a1d45109930b9fa728a944ec107342c56d184e9cc28260c5f0b30194edfe70a","bytes":113943,"path":"artwork/gnw_opanic/gnw_opanic_bottom.svg"},
{"sha256":"e51ca763ed4dcf30034f1f63756e595ce17a10bf0f801cdf929e04fc2e0a294a","bytes":80532,"path":"artwork/gnw_opanic/gnw_opanic_top.svg"},
{"sha256":"17fc8deafbc5206aa524ddbdc19b74dc521ff05fd735a6c854f7a62a85b44820","bytes":170880,"path":"artwork/gnw_pchute/gnw_pchute.svg"},
{"sha256":"43599af8dee6e6ad633b0d4468f8180d453d40995938a8707641d576f78f88f0","bytes":64411,"path":"artwork/gnw_pinball/gnw_pinball_bottom.svg"},
{"sha256":"435558e1dafecd8a335b914e3ab03dd201c9d6441592431004ac34380f55bfb6","bytes":84347,"path":"artwork/gnw_pinball/gnw_pinball_top.svg"},
{"sha256":"360ad99fdcbd6cea85104d2f4f4bc2dcbdaa60d6ce541a7bd504209b37c68f82","bytes":219719,"path":"artwork/gnw_popeye/gnw_popeye.svg"},
{"sha256":"c2d10045b8fdbb1c5d312bf67708b398de7b5d18fd78d974d7d08dc280e8027d","bytes":546685,"path":"artwork/gnw_popeyep/gnw_popeyep.svg"},
{"sha256":"d3264386857e93ce3f9b025e2d87747a703b5eac5faeb336daeccb1965e7294a","bytes":136866,"path":"artwork/gnw_rshower/gnw_rshower_left.svg"},
{"sha256":"e3e1584adbbab4af82ce91ac98ef06fe3e6d84b9b0b92c1263615933a634bc85","bytes":141743,"path":"artwork/gnw_rshower/gnw_rshower_right.svg"},
{"sha256":"9e8c7796433be7051cd3e52f6e2cf72680973bf4b0d402a8078d802a79c4902a","bytes":284193,"path":"artwork/gnw_sbuster/gnw_sbuster_bottom.svg"},
{"sha256":"621be5b7056202a614e215095b34ada3f360f28ad52155b2281f286127e55d9d","bytes":223262,"path":"artwork/gnw_sbuster/gnw_sbuster_top.svg"},
{"sha256":"206326c8a52dddc3f70f9c7c3c85032300036a41621e5a24cbc0722b5966257c","bytes":344665,"path":"artwork/gnw_smb/gnw_smb.svg"},
{"sha256":"7482849ce4280f08b566eb8a4f401336ac7619350d7c8c3e8f1c79d6d012fa16","bytes":651572,"path":"artwork/gnw_smbn/gnw_smbn.svg"},
{"sha256":"2b5eeb4830537fd75615b3ff7dd831228a4d80f19175d68bc249874820cddd4b","bytes":356635,"path":"artwork/gnw_snoopyp/gnw_snoopyp.svg"},
{"sha256":"f1b1078d9efcbdcdccde7e73b3488d0200714c7cd58160dd39bca471cd9c2591","bytes":281182,"path":"artwork/gnw_squish/gnw_squish_bottom.svg"},
{"sha256":"b50d5b118f4342df6fe51889bfcd8fac9d037c87357a778f89c2268b4a6c89df","bytes":73162,"path":"artwork/gnw_squish/gnw_squish_top.svg"},
{"sha256":"803f97224dd9bff1fca47fc6af484a6dac1970abdbc0f9180cdda2471b9ed219","bytes":138996,"path":"artwork/gnw_ssparky/gnw_ssparky.svg"},
{"sha256":"c12a157a26093e69ed323d9490aa4c489eea40e66157156c29191713cf5531ee","bytes":230033,"path":"artwork/gnw_stennis/gnw_stennis.svg"},
{"sha256":"48d387dfb0a2c7720e2ca0408ac79386c8efd9b90a89fbfd61c48a39e7e35865","bytes":244842,"path":"artwork/gnw_tbridge/gnw_tbridge.svg"},
{"sha256":"038da030e3d0874b83d6ee25ef43bdf42ccac4a4b15a6cefa104aa4ecf1b92c5","bytes":259233,"path":"artwork/gnw_tfish/gnw_tfish.svg"},
{"sha256":"32f3f2709b4db5f35c43e549edb60217c322dac795c2aa43fdd05cb9dc046779","bytes":106730,"path":"artwork/gnw_vermin/gnw_vermin.svg"},
{"sha256":"af77426838046e7d94484b6cca75cc456f8e4ae8707dc204c1c1f70716c85131","bytes":426909,"path":"artwork/gnw_zelda/gnw_zelda_bottom.svg"},
{"sha256":"ab346f76a6f706f4bb5a8d95eb5fcd84c4ef9f99dfc3a35a1c1a5e09524cd1c9","bytes":284070,"path":"artwork/gnw_zelda/gnw_zelda_top.svg"}
]
'@
$SvgRows = $SvgHashJson | ConvertFrom-Json
$SvgByHash = @{}
foreach ($s in $SvgRows) { $SvgByHash[$s.sha256.ToLower()] = $s.path }

# ---- Pokemon mini identity table:  SHA-256 (whole-file) -> {PM device id, lang}.
# The 10 game game files are 512 KB; the shared BIOS ('bios') is 4 KB. Matched purely
# by content hash, exactly like the classic firmware dumps - dump filenames are irrelevant.
#
# Unlike Game & Watch (language-agnostic), Pokemon mini titles are region/
# language-specific, so a game may list MANY hashes, one per language dump.
# EVERY DUMP IS ITS OWN FILE (2026-10-10, the site's hash variant tables): the
# device's FIRST row is its primary dump and is written under the device id (so
# saves keyed by that id keep loading); every other dump is written flat under
# 'pm-x' + the first 12 hex of its SHA-256, and the site groups it with its game
# through firmware/variants/pm.json.gz (drawer Variants list, play window
# Variant control). The old {device:{lang:base64}} grouping and the play page's
# own language picker are retired. `lang` stays as a note only. Language keys:
#   en / en-us / en-eu = English (official; -us/-eu disambiguate when a title has
#   both), en-fan = English fan-translation (for the 3 Japan-only games we ship
#   translated), fr = Français, de = Deutsch, ja = 日本語 (Japanese original).
$PmHashJson = @'
[
{"sha256":"16b3a68bb9d3e5c577bc6cf6d9d73c39b4c40b76ca3fbf1a0b9288089f97a014","bytes":524288,"device":"pm-pichu-bros-mini","lang":"ja"},

{"sha256":"035688227eeb8f381f83e1246a10df8a99b27f63b68e548482de16da42fdb4b2","bytes":524288,"device":"pm-pokemon-breeder-mini","lang":"ja"},
{"sha256":"7914ae74c227dd29c93fc9ee23f16da4489396cfa160d034c2394f4bcd3d06e3","bytes":524288,"device":"pm-pokemon-breeder-mini","lang":"en-fan"},

{"sha256":"9c6619a683f76dcb63957d02ac4e812f9148b85e05cc6705b24a8a4e6080b221","bytes":524288,"device":"pm-pokemon-party-mini","lang":"en-us"},
{"sha256":"8f29373c5ab6363369d051d6015726a8aa37c945b85b4b43dd88a6918724eac4","bytes":524288,"device":"pm-pokemon-party-mini","lang":"en-eu"},
{"sha256":"b3a3f78f13bf78d1983c4eeee69f1d048764918bf56b4862580db96121b0de2f","bytes":524288,"device":"pm-pokemon-party-mini","lang":"ja"},

{"sha256":"5ac75fd2b6d5dea85e17e5e6131339e0e19eefe978a6f4b7f8700fb28c89cc23","bytes":524288,"device":"pm-pokemon-pinball-mini","lang":"en"},
{"sha256":"01dda0aaf9c09f17d16b168a2d94ce62f44b35f7f1551eee93b8634435490001","bytes":524288,"device":"pm-pokemon-pinball-mini","lang":"ja"},

{"sha256":"6c473867e9bad1883307d5372dedfa9443a620423d82ae83b6171fcaaffc291e","bytes":524288,"device":"pm-pokemon-puzzle-collection","lang":"en"},
{"sha256":"6c844f44c8d29d56731fd169ed27b0f45db1fd168aa7f34b51580f45ba801a61","bytes":524288,"device":"pm-pokemon-puzzle-collection","lang":"fr"},
{"sha256":"56614a5972d8086674a0efb09c2e27d5b28d22bb1962bb66136eb47ac354713b","bytes":524288,"device":"pm-pokemon-puzzle-collection","lang":"de"},
{"sha256":"83655ad8252218a3c95595193830f170ef5221fad0aba3a4392565313337c4ca","bytes":524288,"device":"pm-pokemon-puzzle-collection","lang":"ja"},

{"sha256":"d75dd948a0bfe92b9f712dbc61cc1fb5ef24c2ddf6a6629f4f00e0fe573f931d","bytes":524288,"device":"pm-pokemon-puzzle-collection-vol-2","lang":"ja"},
{"sha256":"e303afb55f858b284029abe69a7f96d58bf46956cd3e12cc3c1134e171ffae25","bytes":524288,"device":"pm-pokemon-puzzle-collection-vol-2","lang":"en-fan"},

{"sha256":"bc5d1c0664d0f80900558f1e99dded5fe597535b468aefc13c1dae51c18b4fbb","bytes":524288,"device":"pm-pokemon-race-mini","lang":"ja"},

{"sha256":"b54fc57472d363111eb0b229b5e26d3eb653c1b85f211501beab640530d19805","bytes":524288,"device":"pm-pokemon-shock-tetris","lang":"en"},
{"sha256":"f92858c1d895a645401bed70e6984d7884e571e185341591331154221c186a26","bytes":524288,"device":"pm-pokemon-shock-tetris","lang":"ja"},

{"sha256":"dc96d606ed54be035e8c3139a0b20d462b7622b15f617ccc6be411dcbd68c921","bytes":524288,"device":"pm-pokemon-zany-cards","lang":"en"},
{"sha256":"362289ee8914b6b1ec07cbdd7da3f18d5b160c62295cf3ba2b96cfce4c090fa7","bytes":524288,"device":"pm-pokemon-zany-cards","lang":"fr"},
{"sha256":"4b186ffb78f2c5f3cda7eb40faeea39c392dcbb5d42fef6ba2881da3f4c30d59","bytes":524288,"device":"pm-pokemon-zany-cards","lang":"de"},
{"sha256":"7bfc02b080b7aa85a86fc643fd8269e3347faf9724126aaf7cc563380a3eb82b","bytes":524288,"device":"pm-pokemon-zany-cards","lang":"ja"},

{"sha256":"9f34277ae054e8aca6355bc3f73548d860a8ea377103752d403ab150fcc80802","bytes":524288,"device":"pm-togepis-great-adventure","lang":"ja"},
{"sha256":"19265776c8aa438a20a18064fa4097c33ba8edf9d4b712c73e3fd431bd724187","bytes":524288,"device":"pm-togepis-great-adventure","lang":"en-fan"},

{"sha256":"45a1c7f28b9ad585e67f047abe9c1c956724bfcab8c9011002af4274e7c50e8f","bytes":4096,"device":"bios"}
]
'@
$PmRows = $PmHashJson | ConvertFrom-Json
$PmByHash = @{}
foreach ($p in $PmRows) { $PmByHash[$p.sha256.ToLower()] = $p }   # hash -> row (device + optional lang)
$PmPrimary = @{}                                                     # device -> its primary (first-listed) hash
foreach ($p in $PmRows) { if (-not $PmPrimary.ContainsKey($p.device)) { $PmPrimary[$p.device] = $p.sha256.ToLower() } }

# -------------------------------- helpers ------------------------------------
$sha = [System.Security.Cryptography.SHA256]::Create()
function Get-HashHex([byte[]]$bytes, [int]$len) {
  if ($len -lt $bytes.Length) {
    $slice = New-Object byte[] $len
    [System.Array]::Copy($bytes, $slice, $len)
    $bytes = $slice
  }
  return ([System.BitConverter]::ToString($sha.ComputeHash($bytes)) -replace '-', '').ToLower()
}

$Result    = [ordered]@{}                                   # device -> @{ program=b64; melody=b64 }
$PmResult  = [ordered]@{}                                   # pm-id / 'bios' -> b64 (whole file)
$Artwork   = @{}                                            # svgPath -> svg text
$TftCand   = @{}                                            # container -> ArrayList of @{ size; bytes }
$GbResult  = [ordered]@{}                                   # 'gb-<slot>' / 'bios' / 'biosCgb' -> base64
$GbExtra   = [ordered]@{}                                   # 'gb-x<sha12>' -> @{ n; s; z; b }
$script:GbExtraCount = 0
$script:GbExtraBytes = 0L
$script:GbOverCap    = 0    # extra Game Boy titles refused by the budget (cap guard)
$NesResult = [ordered]@{}                                   # 'nes-x<sha12>' -> @{ n; z; m; b }
$script:NesCount = 0
$script:NesBytes = 0L
$script:NesOverCap = 0      # NES games refused by the budget (cap guard)
$Unmatched = New-Object System.Collections.ArrayList
$script:FileCount = 0

# ---- Game Boy / colour-unit discrimination ----------------------------------
# These two are the whole reason the Mario colour unit booted a Game Boy game.
# The colour-unit pairing recognises its flash images BY SIZE ALONE, and 128 KiB
# / 1 MiB / 4 MiB are all perfectly ordinary Game Boy cartridge sizes, so a
# dump set sitting in the same package supplied an "internal.bin" that was
# really Double Dragon II. content_pack.js has guarded against exactly this
# since the collision was found; this script had no equivalent and so shipped a
# cartridge as ARM firmware. Both halves of that guard are mirrored here.

# The Nintendo logo at 0x104-0x133 is what a real boot program compares, and it
# is the cheapest unambiguous "this is a cartridge, not firmware" test there is.
$GbLogo = [byte[]]@(
  0xCE,0xED,0x66,0x66,0xCC,0x0D,0x00,0x0B,0x03,0x73,0x00,0x83,0x00,0x0C,0x00,0x0D,
  0x00,0x08,0x11,0x1F,0x88,0x89,0x00,0x0E,0xDC,0xCC,0x6E,0xE6,0xDD,0xDD,0xD9,0x99,
  0xBB,0xBB,0x67,0x63,0x6E,0x0E,0xEC,0xCC,0xDD,0xDC,0x99,0x9F,0xBB,0xB9,0x33,0x3E)
function Test-GbLogo([byte[]]$b) {
  if ($b.Length -lt 0x134) { return $false }
  for ($i = 0; $i -lt 48; $i++) { if ($b[0x104 + $i] -ne $GbLogo[$i]) { return $false } }
  return $true
}
# The header checksum at 0x14D. A real boot program halts when this fails, so a
# cartridge that fails it is not offered -- the same rule the Game Boy index
# encodes as "will not boot".
function Test-GbHeaderChecksum([byte[]]$b) {
  if ($b.Length -lt 0x150) { return $false }
  $x = 0
  for ($i = 0x134; $i -le 0x14C; $i++) { $x = ($x - $b[$i] - 1) -band 0xFF }
  return ($x -eq $b[0x14D])
}
# PORTED FROM content_pack.js looksLikeArmFirmware(), including its comment's
# point: the reset vector is an ABSOLUTE address (0x08......), not a file
# offset, so it is masked to its low 24 bits before being range-checked. A Game
# Boy cartridge fails on the first two tests -- its first word is 0x000150C3,
# which is not word-aligned, and its reset vector is 0, which has no Thumb bit.
function Test-ArmFirmware([byte[]]$b) {
  if (-not $b -or $b.Length -lt 8) { return $false }
  $sp = [System.BitConverter]::ToUInt32($b, 0)
  $rv = [System.BitConverter]::ToUInt32($b, 4)
  if ($sp -eq 0 -or ($sp -band 3) -ne 0) { return $false }
  if (($rv -band 1) -eq 0) { return $false }
  if (($rv -band 0x00FFFFFF) -ge $b.Length) { return $false }
  return $true
}

# ---- NES: the header magic, and what the header says about the dump's size ----
# 4E 45 53 1A at offset 0 is the iNES signature, and it is the ONLY thing that
# says "this is an NES game". No size, no extension and no directory tells us
# that: 40,976 and 262,160 are ordinary NES file lengths, they collide with
# nothing here, and 524,288 - which the Pokemon mini path claims on length alone
# - is a length no valid iNES file can have, because 524288 - 16 is not a whole
# number of 16 KiB PRG banks plus 8 KiB CHR banks. The magic settles all of it.
function Test-InesHeader([byte[]]$b) {
  if (-not $b -or $b.Length -lt 16) { return $false }
  for ($i = 0; $i -lt 4; $i++) { if ($b[$i] -ne $NesMagic[$i]) { return $false } }
  return $true
}
# IS THE DUMP ACTUALLY ALL THERE? Byte 4 counts PRG banks of 16 KiB. Zero of them
# is not a game, and a file shorter than its own header's PRG claim is a dump
# that was cut short - a half-copied cartridge that boots to a crash and looks
# like an emulator bug. Both are refused by name rather than shipped.
#   The floor is deliberately the 8-bit byte-4 count and not the NES 2.0 12-bit
# one: where NES 2.0 adds high bits (byte 9's low nibble) the real PRG is LARGER,
# so byte 4 alone is always a floor and never a false accusation.
function Test-InesComplete([byte[]]$b) {
  if (-not (Test-InesHeader $b)) { return $false }
  $prg = [int]$b[4]
  if ($prg -eq 0) { return $false }
  return ($b.Length -ge (16 + 16384 * $prg))
}
# THE MAPPER NUMBER, all twelve bits of it. iNES puts the low nibble in byte 6's
# high nibble and the next nibble in byte 7's high nibble; NES 2.0 - announced by
# byte 7 bits 2-3 reading 2 - adds bits 8-11 in byte 8's low nibble. All three
# are implemented here, so a NES 2.0 dump of a mapper above 255 is described
# correctly rather than folded back onto some other mapper's number.
function Get-NesMapper([byte[]]$b) {
  if (-not $b -or $b.Length -lt 16) { return 0 }
  $m = (($b[6] -shr 4) -band 0x0F) -bor ((($b[7] -shr 4) -band 0x0F) -shl 4)
  if ((($b[7] -shr 2) -band 0x03) -eq 2) { $m = $m -bor (($b[8] -band 0x0F) -shl 8) }
  return [int]$m
}

function Should-Read([string]$name, [long]$len) {
  if ($len -le 0) { return $false }
  $ext = [System.IO.Path]::GetExtension($name).ToLower()
  if ($ext -eq '.svg') { return ($len -le $MaxSvgBytes) }
  # Game Boy. Two arms, matching content_pack.js: an exact catalogue SIZE (a 2 MiB
  # cartridge is well past $MaxProgramBytes and would otherwise never be read at all),
  # and a .gb/.gbc/.sgb NAME for the extra titles, capped at the largest cartridge
  # the mapper space allows.
  if ($GbSizes.ContainsKey($len)) { return $true }
  if (($ext -eq '.gb' -or $ext -eq '.gbc' -or $ext -eq '.sgb') -and $len -le $GbMaxBytes) { return $true }
  # NES. A .nes/.fds NAME, because an NES game has no size worth listing: it is
  # routinely larger than $MaxProgramBytes and so would never be read at all, and it
  # shares no exact length with any other sink worth gating on. Recognition is
  # still the header magic in Consider - this only decides what is worth opening.
  if (($ext -eq '.nes' -or $ext -eq '.fds') -and $len -le $NesCartMaxBytes) { return $true }
  if ($len -eq $TftInternal -or $len -eq $TftExtMario -or $len -eq $TftExtZelda) { return $true }
  if ($len -eq $PmGameBytes -or $len -eq $PmBiosBytes) { return $true }   # Pokemon mini game file / BIOS
  if ($len -le $MaxProgramBytes) { return $true }
  return $false
}

function Consider([byte[]]$bytes, [string]$name, [string]$origin, [string]$container) {
  $script:FileCount++
  $len = $bytes.Length
  if ($len -eq 0) { return }
  $ext = [System.IO.Path]::GetExtension($name).ToLower()

  # 0) Game Boy. THIS RUNS BEFORE EVERYTHING ELSE, and the order is the whole
  #    fix rather than a preference -- content_pack.js says the same thing in
  #    the same words, because it had to learn it first. Game Boy cartridge
  #    sizes OVERLAP every other sink here: 131072 / 1048576 / 4194304 are the
  #    colour-unit flash sizes, 524288 is the Pokemon mini game file size, and 256 is
  #    a classic melody. Downstream those sinks claim a file on SIZE and then
  #    `return`, so a cartridge that reached them was either mispaired as ARM
  #    firmware (the Mario colour unit booting Double Dragon II) or consumed and
  #    dropped (every 512 KiB cartridge, silently, including four catalogue
  #    titles). Identity here is a whole-file sha256, so running first cannot
  #    steal anything from anyone: a non-match falls straight through.
  if ($GbSizes.ContainsKey([long]$len)) {
    $h = Get-HashHex $bytes $len
    if ($GbByHash.ContainsKey($h)) {
      $id = $GbByHash[$h].device
      if (-not $GbResult.Contains($id)) {
        $GbResult[$id] = [System.Convert]::ToBase64String($bytes, 0, $len)
        Write-Host ("  gboy   {0,-34}<- {1}  [{2}]" -f $id, $name, $origin) -ForegroundColor Green
      }
      return
    }
  }
  # 0b) Game Boy titles the catalogue never had, kept under the SAME budget and
  #     the SAME key scheme as the pack ('gb-x' + first 12 hex of the sha256).
  #     Gated on the NAME, so internal.bin / external.bin and a .min Pokemon
  #     mini game file can never land here, and on the two checks a real boot program
  #     makes -- a cartridge failing the logo or the header checksum hangs on
  #     hardware, so it is identified but not offered, exactly as the Game Boy
  #     index decides it.
  if (($ext -eq '.gb' -or $ext -eq '.gbc' -or $ext -eq '.sgb') -and $len -le $GbMaxBytes) {
    if ((Test-GbLogo $bytes) -and (Test-GbHeaderChecksum $bytes)) {
      $h = Get-HashHex $bytes $len
      $key = 'gb-x' + $h.Substring(0, 12)
      if (-not $GbExtra.Contains($key)) {
        if ($script:GbExtraCount -ge $GbExtraMaxFiles -or ($script:GbExtraBytes + $len) -gt $GbExtraMaxBytes) {
          [void]$Unmatched.Add(("{0}  ({1} bytes)  [{2}]  - Game Boy extra-title budget full" -f $name, $len, $origin))
          $script:GbOverCap++
        } else {
          $cgb = if ($len -gt 0x143) { $bytes[0x143] } else { 0 }
          $s = if (($cgb -band 0xC0) -eq 0xC0) { 2 } elseif (($cgb -band 0x80) -eq 0x80) { 1 } else { 0 }
          $GbExtra[$key] = @{
            n = [System.IO.Path]::GetFileNameWithoutExtension($name)
            s = $s
            z = $len
            b = [System.Convert]::ToBase64String($bytes, 0, $len)
          }
          $script:GbExtraCount++; $script:GbExtraBytes += $len
          Write-Host ("  gboy+  {0,-34}<- {1}  [{2}]" -f $key, $name, $origin) -ForegroundColor DarkGreen
        }
      }
      return
    }
  }

  # 0c) NES / Famicom, recognised by the iNES magic and keyed by content
  #     ('nes-x' + first 12 hex of the sha256) - the extra-titles path, because
  #     there is no NES catalogue to match a hash against and there must not be
  #     one: what counts is what the content button loaded or what was put in the
  #     firmware folder.
  #
  #     WHY HERE, between the Game Boy steps and everything else. This position
  #     is squeezed from both sides and neither side is a preference:
  #
  #       * NOT EARLIER, because steps 0 and 0b identify by HASH and by NAME. A
  #         magic number is a guess about what a file is; a sha256 match is a
  #         fact about which file it is. A catalogue cartridge whose first four
  #         bytes happened to read "NES\x1A" would be a dead tile in the Game Boy
  #         collection if a guess were allowed to run ahead of the fact, and the
  #         .gb/.gbc/.sgb name gate in 0b is likewise a stronger claim on a file
  #         called MARIO.GB than anything this step could make about it.
  #
  #       * NOT LATER, because every sink below claims files on SIZE and then
  #         `return`s. The Pokemon mini branch takes ANY unmatched 524,288-byte
  #         file by length; the colour-unit branch takes 131,072 / 1,048,576 /
  #         4,194,304; the classic-game file branch takes anything up to
  #         $MaxProgramBytes and reports a hash miss as unrecognised. NES file
  #         lengths run right through all of that - 40,976 and 262,160 are
  #         perfectly ordinary - so an NES game that reached them would be
  #         swallowed or filed as "not in any table", which is the same silent
  #         drop the Game Boy step exists to prevent.
  #
  #     Running first cannot steal anything below it either, for the reason the
  #     Game Boy comment gives about its own hash: a non-match falls straight
  #     through. Nothing that is not an NES game carries 4E 45 53 1A at offset 0 -
  #     an SVG opens with '<', a classic firmware is a few KB of SM5A opcodes, and
  #     STM32 firmware beginning with those bytes would declare a stack pointer
  #     of 0x1A534E45, which is not word-aligned and so is not ARM firmware.
  if (Test-InesHeader $bytes) {
    if (-not (Test-InesComplete $bytes)) {
      # Named as truncated, not as unrecognised. A dump missing half its PRG is a
      # copy that went wrong, and saying so is the difference between a person
      # re-dumping the cartridge and a person filing a bug about a black screen.
      [void]$Unmatched.Add(("{0}  ({1} bytes)  [{2}]  - truncated iNES dump: header declares {3} PRG bank(s) = {4} bytes minimum" -f `
        $name, $len, $origin, [int]$bytes[4], (16 + 16384 * [int]$bytes[4])))
      return
    }
    if ($len -gt $NesCartMaxBytes) {
      [void]$Unmatched.Add(("{0}  ({1} bytes)  [{2}]  - larger than the {3:N0}-byte iNES ceiling" -f $name, $len, $origin, $NesCartMaxBytes))
      return
    }
    $h = Get-HashHex $bytes $len
    $key = 'nes-x' + $h.Substring(0, 12)
    if (-not $NesResult.Contains($key)) {
      if ($script:NesCount -ge $NesMaxFiles -or ($script:NesBytes + $len) -gt $NesMaxBytes) {
        [void]$Unmatched.Add(("{0}  ({1} bytes)  [{2}]  - NES budget full" -f $name, $len, $origin))
        $script:NesOverCap++
      } else {
        $NesResult[$key] = @{
          n = [System.IO.Path]::GetFileNameWithoutExtension($name)
          z = $len
          m = (Get-NesMapper $bytes)
          b = [System.Convert]::ToBase64String($bytes, 0, $len)
        }
        # games\Famicom: the folder says which shelf (2026-10-10).
        if ($script:InFamicom) { $NesResult[$key].c = 'famicom' }
        $script:NesCount++; $script:NesBytes += $len
        Write-Host ("  nes    {0,-34}<- {1}  [{2}]  m{3}" -f $key, $name, $origin, $NesResult[$key].m) -ForegroundColor DarkGreen
      }
    }
    return
  }

  # 1) Pokemon mini game file / BIOS (whole-file hash). Runs before the classic-game file
  #    path so the 4 KB BIOS is not mistaken for a classic firmware candidate below.
  if ($len -eq $PmGameBytes -or $len -eq $PmBiosBytes) {
    $h = Get-HashHex $bytes $len
    if ($PmByHash.ContainsKey($h)) {
      $row = $PmByHash[$h]
      $id  = $row.device
      $b64 = [System.Convert]::ToBase64String($bytes, 0, $len)
      if ($id -eq 'bios') {
        if (-not $PmResult.Contains('bios')) {
          $PmResult['bios'] = $b64
          Write-Host ("  pmini  {0,-34} {1,-6}<- {2}  [{3}]" -f $id, '', $name, $origin) -ForegroundColor Green
        }
      } else {
        # One file, one id: the primary dump under the device id, any other
        # language dump under 'pm-x<sha12>' (see the identity table above).
        $lang = if ($row.PSObject.Properties['lang'] -and $row.lang) { [string]$row.lang } else { 'default' }
        $key = if ($PmPrimary[$id] -eq $h) { $id } else { 'pm-x' + $h.Substring(0, 12) }
        if (-not $PmResult.Contains($key)) {
          $PmResult[$key] = $b64
          Write-Host ("  pmini  {0,-34} {1,-6}<- {2}  [{3}]" -f $key, $lang, $name, $origin) -ForegroundColor Green
        }
      }
      return
    }
    if ($len -eq $PmGameBytes) { [void]$Unmatched.Add(("{0}  ({1} bytes)  [{2}]" -f $name, $len, $origin)); return }
    # a 4 KB non-BIOS file falls through to the classic-game file path below
  }

  # 1) Artwork SVG (whole-file hash)
  if ($ext -eq '.svg') {
    if ($len -le $MaxSvgBytes) {
      $h = Get-HashHex $bytes $len
      if ($SvgByHash.ContainsKey($h)) {
        $p = $SvgByHash[$h]
        if (-not $Artwork.ContainsKey($p)) {
          $Artwork[$p] = [System.Text.Encoding]::UTF8.GetString($bytes)
          Write-Host ("  art    {0,-34}<- {1}  [{2}]" -f $p, $name, $origin) -ForegroundColor Green
        }
        return
      }
    }
    [void]$Unmatched.Add(("{0}  ({1} bytes)  [{2}]" -f $name, $len, $origin)); return
  }

  # 3) Colour-unit flash (recognised by exact size + pairing, NOT by hash)
  if ($len -eq $TftInternal -or $len -eq $TftExtMario -or $len -eq $TftExtZelda) {
    # THE SIZE IS NOT ENOUGH, and believing it was is what put Double Dragon II
    # in the Mario unit's internal flash. An internal-flash candidate must
    # actually look like ARM firmware; anything carrying a Game Boy header is
    # refused outright. An external image has no vector table to check, so it is
    # only screened for the cartridge header.
    if (Test-GbLogo $bytes) {
      [void]$Unmatched.Add(("{0}  ({1} bytes)  [{2}]  - Game Boy cartridge, not colour-unit flash" -f $name, $len, $origin))
      return
    }
    if ($len -eq $TftInternal -and -not (Test-ArmFirmware $bytes)) {
      [void]$Unmatched.Add(("{0}  ({1} bytes)  [{2}]  - not ARM firmware, not colour-unit internal flash" -f $name, $len, $origin))
      return
    }
    if (-not $TftCand.ContainsKey($container)) { $TftCand[$container] = New-Object System.Collections.ArrayList }
    [void]$TftCand[$container].Add(@{ size = $len; bytes = $bytes })
    return
  }

  # 3) Classic game file (content hash, with truncation fallback) - any name/extension
  if ($len -le $MaxProgramBytes) {
    $tryLens = @($len) + @($KnownLengths | Where-Object { $_ -lt $len })
    foreach ($tl in $tryLens) {
      $h = Get-HashHex $bytes $tl
      if ($ByHash.ContainsKey($h)) {
        foreach ($row in $ByHash[$h]) {
          if (-not $Result.Contains($row.device)) { $Result[$row.device] = [ordered]@{} }
          if (-not $Result[$row.device].Contains($row.part)) {
            $Result[$row.device][$row.part] = [System.Convert]::ToBase64String($bytes, 0, $tl)
            Write-Host ("  match  {0,-11}{1,-7}<- {2}  [{3}]" -f $row.device, $row.part, $name, $origin) -ForegroundColor Green
          }
        }
        return
      }
    }
    [void]$Unmatched.Add(("{0}  ({1} bytes)  [{2}]" -f $name, $len, $origin))
  }
}

Add-Type -AssemblyName System.IO.Compression.FileSystem -ErrorAction SilentlyContinue
Add-Type -AssemblyName System.IO.Compression -ErrorAction SilentlyContinue

$SevenZip = @(
  "$env:ProgramFiles\7-Zip\7z.exe",
  "${env:ProgramFiles(x86)}\7-Zip\7z.exe"
) | Where-Object { $_ -and (Test-Path $_) } | Select-Object -First 1
if (-not $SevenZip) { $c = Get-Command 7z.exe -ErrorAction SilentlyContinue; if ($c) { $SevenZip = $c.Source } }

# ======================== archives, to any depth =============================
# This is the parity piece: the site's readZip() recurses into nested .zip
# entries, so this does too. See "ARCHIVES INSIDE ARCHIVES" in the header for
# what is followed, why identity is unaffected, and what the two limits are.
#
# Three functions call each other:
#   Open-ArchiveFile     an archive ON DISK  -> zip reader, or 7-Zip extractor
#   Read-ZipStream       a zip as a STREAM   -> entries; nested .zip recurses here
#   Expand-ArchiveVia7z  a .7z/.rar on disk  -> extract, then walk what came out
#
# Every one of them carries the same four things:
#   $Label      what to print, e.g. "pack.zip/units/HXA-001.zip"
#   $Container  the colour-unit pairing key - a nested archive gets its own
#   $Depth      1 for a top-level archive; the caps below are measured on this

$script:ArchiveBytes  = 0       # decompressed bytes pulled out of archives so far
$script:DepthCapHits  = 0       # archives left unopened because they were too deep
$script:ByteCapHit    = $false  # true once $MaxArchiveBytes has stopped something
$script:No7zWarned    = $false

function Test-ArchiveBudget([string]$What, [long]$Size, [int]$Depth) {
  # TRUE = there is room to open this one. Both refusals are announced, because a
  # scan that quietly stopped looking would report "missing game files" and be believed.
  if ($Depth -gt $MaxArchiveDepth) {
    $script:DepthCapHits++
    Write-Warning ("Nested deeper than {0} archives - NOT opening {1}" -f $MaxArchiveDepth, $What)
    return $false
  }
  if (($script:ArchiveBytes + [long]$Size) -gt $MaxArchiveBytes) {
    if (-not $script:ByteCapHit) {
      $script:ByteCapHit = $true
      Write-Warning ("Archive expansion cap reached ({0:N0} bytes) - no further archives will be opened, starting with {1}" -f $MaxArchiveBytes, $What)
    }
    return $false
  }
  $script:ArchiveBytes += [long]$Size
  return $true
}

function Read-ZipStream {
  param([System.IO.Stream]$Stream, [string]$Label, [string]$Container, [int]$Depth)
  $zip = $null
  try {
    # ZipArchive, not ZipFile::OpenRead, because a NESTED zip only exists as a
    # stream of bytes - there is no file on disk to open. Disposing the archive
    # disposes $Stream with it, which is why nothing else closes it.
    $zip = New-Object System.IO.Compression.ZipArchive($Stream, [System.IO.Compression.ZipArchiveMode]::Read)
  } catch {
    Write-Warning ("Could not read zip {0}: {1}" -f $Label, $_.Exception.Message)
    try { $Stream.Dispose() } catch {}
    return
  }
  try {
    foreach ($e in $zip.Entries) {
      if ([string]::IsNullOrEmpty($e.Name)) { continue }          # directory entry
      $eext = [System.IO.Path]::GetExtension($e.Name).ToLower()

      # A NESTED ARCHIVE. The >22 test is the site's own (22 bytes is the
      # smallest possible zip); anything smaller is treated as an ordinary file,
      # exactly as readZip() does, rather than being thrown away.
      $nested = ($ArchiveExt -contains $eext) -and ($e.Length -gt 22)
      if ($nested -and $eext -ne '.zip' -and -not $SevenZip) {
        # No 7-Zip: fall through and let it be hashed like any other file, which
        # is precisely what this script did before nesting existed.
        if (-not $script:No7zWarned) {
          $script:No7zWarned = $true
          Write-Warning ("7-Zip not installed - nested {0} archives are not being opened." -f $eext)
        }
        $nested = $false
      }

      if ($nested) {
        $childLabel     = $Label     + '/' + $e.FullName
        $childContainer = $Container + '/' + $e.FullName
        if (-not (Test-ArchiveBudget $childLabel $e.Length ($Depth + 1))) { continue }

        $inner = New-Object System.IO.MemoryStream
        $s = $e.Open()
        try { $s.CopyTo($inner) } finally { $s.Dispose() }
        $inner.Position = 0
        if ($eext -eq '.zip') {
          Read-ZipStream $inner $childLabel $childContainer ($Depth + 1)   # disposes $inner
        } else {
          # .7z/.rar needs a real file for 7z.exe, so spill it and extract.
          $spill = Join-Path ([System.IO.Path]::GetTempPath()) ("gnwnest_" + [System.Guid]::NewGuid().ToString('N') + $eext)
          try {
            [System.IO.File]::WriteAllBytes($spill, $inner.ToArray())
            Expand-ArchiveVia7z $spill $eext $childLabel $childContainer ($Depth + 1)
          } finally {
            $inner.Dispose()
            Remove-Item -LiteralPath $spill -Force -ErrorAction SilentlyContinue
          }
        }
        # Like the site: an archive entry is its contents, never also a file of
        # its own. An unreadable one is skipped, it does not abort the pack.
        continue
      }

      if (-not (Should-Read $e.Name $e.Length)) { continue }
      $s = $e.Open(); $ms = New-Object System.IO.MemoryStream
      try { $s.CopyTo($ms); Consider $ms.ToArray() $e.Name ("zip:" + $Label) $Container }
      finally { $ms.Dispose(); $s.Dispose() }
    }
  } finally { $zip.Dispose() }
}

function Expand-ArchiveVia7z {
  param([string]$Path, [string]$Ext, [string]$Label, [string]$Container, [int]$Depth)
  if (-not $SevenZip) { Write-Warning ("Skipping {0} (7-Zip not installed)." -f $Label); return }
  $tmp = Join-Path ([System.IO.Path]::GetTempPath()) ("gnwrom_" + [System.Guid]::NewGuid().ToString('N'))
  New-Item -ItemType Directory -Path $tmp -Force | Out-Null
  try {
    & $SevenZip x $Path "-o$tmp" -y 2>&1 | Out-Null
    foreach ($x in (Get-ChildItem -LiteralPath $tmp -Recurse -File -ErrorAction SilentlyContinue)) {
      $xext = $x.Extension.ToLower()
      if (($ArchiveExt -contains $xext) -and $x.Length -gt 22) {
        # 7-Zip extracts ONE level; an archive that came out of this one is still
        # sealed, so open it the same way anything else is opened.
        $rel            = ($x.FullName.Substring($tmp.Length).TrimStart('\', '/')) -replace '\\', '/'
        $childLabel     = $Label     + '/' + $rel
        $childContainer = $Container + '/' + $rel
        if (-not (Test-ArchiveBudget $childLabel $x.Length ($Depth + 1))) { continue }
        Open-ArchiveFile $x.FullName $xext $childLabel $childContainer ($Depth + 1)
        continue
      }
      if (Should-Read $x.Name $x.Length) {
        Consider ([System.IO.File]::ReadAllBytes($x.FullName)) $x.Name ($Ext.TrimStart('.') + ":" + $Label) $Container
      }
    }
  } catch { Write-Warning ("Could not extract {0}: {1}" -f $Label, $_.Exception.Message) }
  finally { Remove-Item -LiteralPath $tmp -Recurse -Force -ErrorAction SilentlyContinue }
}

function Open-ArchiveFile {
  param([string]$Path, [string]$Ext, [string]$Label, [string]$Container, [int]$Depth)
  if ($Ext -eq '.zip') {
    $fs = $null
    try { $fs = [System.IO.File]::OpenRead($Path) }
    catch { Write-Warning ("Could not read zip {0}: {1}" -f $Label, $_.Exception.Message); return }
    Read-ZipStream $fs $Label $Container $Depth      # disposes $fs
  } else {
    Expand-ArchiveVia7z $Path $Ext $Label $Container $Depth
  }
}
# =============================================================================

# --------------------------------- scan --------------------------------------
# 2026-10-10: no pre-flight refusal and no questions. The folders are fixed
# (firmware\games\<system>\), and a previous output is copied to
# output\.previous\ before it is replaced, so nothing needs cleaning first.
Write-Host ""
if ($SevenZip) { Write-Host "Using 7-Zip: $SevenZip" -ForegroundColor DarkGray }
else { Write-Host "7-Zip not found - .7z/.rar archives will be skipped (.zip and loose files still work)." -ForegroundColor DarkGray }

foreach ($sf in $SourceFolders) {
$SourceFolder = $sf.Path
$script:InFamicom = ($sf.Sys -eq 'famicom')
Write-Host "Scanning $SourceFolder ..." -ForegroundColor Cyan
foreach ($f in (Get-ChildItem -LiteralPath $SourceFolder -Recurse -File -ErrorAction SilentlyContinue)) {
  $ext = $f.Extension.ToLower()

  if ($ArchiveExt -contains $ext) {
    # Depth 1 is a top-level archive, and it is NOT charged to the expansion
    # budget: it is a file that already exists on the disk, not something this
    # run inflated, and a big honest library would otherwise trip a cap meant
    # for zip bombs. Only archives found INSIDE one are charged.
    # The container stays the archive's own full path, so a flat pack pairs its
    # colour-unit flash images exactly as before; only a nested archive gets a
    # container of its own.
    Open-ArchiveFile $f.FullName $ext $f.Name $f.FullName 1
  }
  elseif (Should-Read $f.Name $f.Length) {
    Consider ([System.IO.File]::ReadAllBytes($f.FullName)) $f.Name 'loose' $f.DirectoryName
  }
}
}
# The old loose sweeps of the firmware folder itself (*.min, *.nes, *.fds) are
# gone: those files now live in games\pm, games\nes and games\fds.
$sha.Dispose()

# ---- pair the colour-unit flash images (internal + external in one container)
$TftFound = [ordered]@{}
foreach ($container in $TftCand.Keys) {
  $cands = $TftCand[$container]
  $internal = @($cands | Where-Object { $_.size -eq $TftInternal }) | Select-Object -First 1
  if (-not $internal) { continue }
  $unit = $null; $external = $null
  $em = @($cands | Where-Object { $_.size -eq $TftExtMario }) | Select-Object -First 1
  $ez = @($cands | Where-Object { $_.size -eq $TftExtZelda }) | Select-Object -First 1
  if ($em) { $unit = 'mario'; $external = $em } elseif ($ez) { $unit = 'zelda'; $external = $ez }
  if ($unit -and -not $TftFound.Contains($unit)) {
    $TftFound[$unit] = @{
      internal = [System.Convert]::ToBase64String($internal.bytes)
      external = [System.Convert]::ToBase64String($external.bytes)
    }
    Write-Host ("  tft    {0,-7}<- internal({1}) + external({2})  [{3}]" -f $unit, $internal.size, $external.size, (Split-Path $container -Leaf)) -ForegroundColor Green
  }
}

# -------------------------------- summary ------------------------------------
# A device written key~variant (8 Nov 2026) is another program revision of that device, not a device to count.
$allDevices    = @($Rows | Where-Object { $_.part -eq 'program' -and $_.device -notlike '*~*' } | ForEach-Object { $_.device } | Sort-Object -Unique)
$programFound      = @($allDevices | Where-Object { $Result.Contains($_) -and $Result[$_].Contains('program') })
$programMissing    = @($allDevices | Where-Object { $_ -notin $programFound })
$melodyNeeded  = @($Rows | Where-Object { $_.part -eq 'melody' } | ForEach-Object { $_.device } | Sort-Object -Unique)
$artNeeded     = @($SvgRows | ForEach-Object { $_.path })
$artMissing    = @($artNeeded | Where-Object { -not $Artwork.ContainsKey($_) })
$tftNeeded     = @('mario', 'zelda')
$tftMissing    = @($tftNeeded | Where-Object { -not $TftFound.Contains($_) })
$pmGameNeeded  = @($PmRows | Where-Object { $_.device -ne 'bios' } | ForEach-Object { $_.device })
$pmGameFound   = @($pmGameNeeded | Where-Object { $PmResult.Contains($_) })
$pmGameMissing = @($pmGameNeeded | Where-Object { $_ -notin $pmGameFound })
$pmBios        = $PmResult.Contains('bios')

$Want = @{}; foreach ($s in $Systems) { $Want[$s] = $true }
Write-Host ""
Write-Host ("==== scan complete - examined {0} file(s) ====" -f $script:FileCount) -ForegroundColor Cyan
# A scan that stopped looking must say so here too, beside the counts it affected
# - a warning 2,000 lines up is a warning nobody reads.
if ($script:DepthCapHits -or $script:ByteCapHit) {
  Write-Host ""
  if ($script:DepthCapHits) {
    Write-Host ("INCOMPLETE: {0} archive(s) were nested deeper than {1} levels and were not opened." -f $script:DepthCapHits, $MaxArchiveDepth) -ForegroundColor Red
  }
  if ($script:ByteCapHit) {
    Write-Host ("INCOMPLETE: the {0:N0}-byte archive expansion cap was reached; deeper archives were not opened." -f $MaxArchiveBytes) -ForegroundColor Red
  }
  Write-Host ("Raise `$MaxArchiveDepth / `$MaxArchiveBytes at the top of this script if that was not a zip bomb.") -ForegroundColor Yellow
}
Write-Host ""
Write-Host ("Firmware  {0,3} / {1} classic titles" -f $programFound.Count, $allDevices.Count) -ForegroundColor Green
Write-Host ("Artwork   {0,3} / {1} segment SVGs"    -f ($artNeeded.Count - $artMissing.Count), $artNeeded.Count) -ForegroundColor Green
Write-Host ("Colour    {0,3} / {1} TFT units ({2})" -f ($tftNeeded.Count - $tftMissing.Count), $tftNeeded.Count, (@($TftFound.Keys) -join ', ')) -ForegroundColor Green
$gbCatNeeded = @($GbManifest | Where-Object { $_.device -like 'gb-*' }).Count
$gbCatFound  = @($GbResult.Keys | Where-Object { $_ -like 'gb-*' }).Count
Write-Host ("Game Boy  {0,3} / {1} cartridges, {2} extra, boot {3}/{4}" -f `
  $gbCatFound, $gbCatNeeded, $GbExtra.Count, `
  ($(if ($GbResult.Contains('bios')) { 'DMG' } else { '-' })), `
  ($(if ($GbResult.Contains('biosCgb')) { 'CGB' } else { '-' }))) -ForegroundColor Green
Write-Host ("Pkmn mini {0,3} / {1} PM games  (BIOS {2})" -f $pmGameFound.Count, $pmGameNeeded.Count, ($(if ($pmBios) { 'found' } else { 'MISSING' }))) -ForegroundColor Green
# No "/ total" for the NES: there is no catalogue to be short of. The count IS the
# total, so what is worth printing beside it is how much of the budget it used and
# how many distinct mappers came in - the one number that says whether the set will
# actually run on the cores that exist.
$nesMappers = @($NesResult.Keys | ForEach-Object { $NesResult[$_].m } | Sort-Object -Unique)
Write-Host ("NES       {0,3}   games      ({1:N0} of {2:N0} bytes, {3} mapper(s))" -f `
  $NesResult.Count, $script:NesBytes, $NesMaxBytes, $nesMappers.Count) -ForegroundColor Green

# A system on the server-served list (build.ps1) has no built-ins by design:
# one line instead of listing every title as missing (2026-10-14).
$GnwQuiet = $ServerServed -contains 'gnw'
$PmQuiet  = $ServerServed -contains 'pm'
if ($Want.gnw -and $GnwQuiet) { Write-Host ""; Write-Host "Game & Watch: served by the game server (built-ins only; the artwork file is kept)" -ForegroundColor DarkGray }
if ($Want.gnw -and -not $GnwQuiet -and $programMissing.Count) { Write-Host ""; Write-Host ("Missing firmware: {0}" -f ($programMissing -join ', ')) -ForegroundColor Red }
if ($Want.gnw -and -not $GnwQuiet -and $artMissing.Count) { Write-Host ("Missing artwork: {0} SVG(s)" -f $artMissing.Count) -ForegroundColor Red }
if ($Want.gnw -and -not $GnwQuiet -and $tftMissing.Count) { Write-Host ("Missing colour:  {0}" -f ($tftMissing -join ', ')) -ForegroundColor Red }
if ($Want.pokemini -and $PmQuiet) { Write-Host "Pokemon mini: served by the game server (built-ins only)" -ForegroundColor DarkGray }
if ($Want.pokemini -and -not $PmQuiet -and $pmGameMissing.Count) { Write-Host ("Missing PM games: {0}" -f ($pmGameMissing -join ', ')) -ForegroundColor Red }
if ($Want.pokemini -and -not $PmQuiet -and -not $pmBios -and $pmGameFound.Count) { Write-Host "Missing PM BIOS: bios.min (one BIOS covers every PM game)" -ForegroundColor Red }
if ($Unmatched.Count) {
  Write-Host ""
  Write-Host ("Unrecognised files ({0}) - not in any table:" -f $Unmatched.Count) -ForegroundColor DarkGray
  $Unmatched | Select-Object -First 40 | ForEach-Object { Write-Host ("   " + $_) -ForegroundColor DarkGray }
}

# ------------------------------- write --------------------------------------
# 2026-10-10: only the systems asked for are written. Content of another system
# found in these folders is named and left alone, so a Game Boy cartridge in
# games\NES can never replace the Game Boy output with a one-title shelf.
# CAP GUARD (2026-10-11). A system whose input holds more than its budget
# would otherwise be written as whichever games the folder walk met first: an
# arbitrary subset that can drop the built-in titles. Refuse that system's
# write instead, keep its current output untouched, and fail the build.
$OverCap = [ordered]@{}
if ($Want.nes -and $script:NesOverCap) {
  $OverCap.nes = ("NES: {0} more game(s) than the cap of {1} files / {2:N0} bytes" -f $script:NesOverCap, $NesMaxFiles, $NesMaxBytes)
}
if ($Want.gameboy -and $script:GbOverCap) {
  $OverCap.gameboy = ("Game Boy: {0} more extra title(s) than the cap of {1} files / {2:N0} bytes" -f $script:GbOverCap, $GbExtraMaxFiles, $GbExtraMaxBytes)
}
foreach ($k in @($OverCap.Keys)) {
  Write-Host ""
  Write-Host ("NOT WRITTEN - OVER CAP: {0}." -f $OverCap[$k]) -ForegroundColor Red
  Write-Host "  Its folders hold more than the site's file can carry, so writing would keep an arbitrary subset." -ForegroundColor Red
  Write-Host "  The current output is left exactly as it was. Trim these folders, or serve the full library from the game server:" -ForegroundColor Red
  foreach ($sf in @($SourceFolders | Where-Object { $SysFolders[$k] -contains $_.Sys })) { Write-Host ("    " + $sf.Path) -ForegroundColor Red }
  $Want.Remove($k)
}
$Stray = [ordered]@{
  gnw      = ($programFound.Count + $Artwork.Count + $TftFound.Count)
  pokemini = $PmResult.Count
  gameboy  = ($GbResult.Count + $GbExtra.Count)
  nes      = $NesResult.Count
}
$StrayHome = @{ gnw = 'gnw'; pokemini = 'pm'; gameboy = 'gb or gbc'; nes = 'nes or fds' }
foreach ($k in $Stray.Keys) {
  if (-not $Want[$k] -and -not $OverCap.Contains($k) -and $Stray[$k]) {
    Write-Host ("NOT WRITTEN: {0} {1} item(s) found in the wrong folder - move them to {2} and build that system." -f $Stray[$k], $SysLabel[$k], $StrayHome[$k]) -ForegroundColor Yellow
  }
}
$Previous = Join-Path $OutDir '.previous'
function Save-Previous([string]$path) {
  if (Test-Path -LiteralPath $path -PathType Leaf) {
    New-Item -ItemType Directory -Force -Path $Previous | Out-Null
    Copy-Item -LiteralPath $path -Destination (Join-Path $Previous (Split-Path $path -Leaf)) -Force
  }
}
# An output for a system that was built and found nothing is retired (moved to
# output\.previous\), so an emptied folder means an emptied shelf, not a stale one.
function Retire([string]$path) {
  if (Test-Path -LiteralPath $path -PathType Leaf) {
    Save-Previous $path
    Remove-Item -LiteralPath $path -Force
    Write-Host ("Nothing found for {0} - previous copy kept in output\.previous\" -f (Split-Path $path -Leaf)) -ForegroundColor Yellow
  }
}
$Outs = @{ gnw = @($OutGnwGames, $OutArt, $OutTft.mario, $OutTft.zelda); pokemini = @($OutPokemini); gameboy = @($OutGb, $OutGbManifest); nes = @($OutNes, $OutNesManifest) }
foreach ($k in @($Want.Keys)) { foreach ($p in $Outs[$k]) { Save-Previous $p } }
# SERVED BY THE GAME SERVER (2026-10-12): a server-served system with no
# built-in titles gets EMPTY output files instead of none, so the site reads
# "no built-ins" from a 200 rather than logging a 404 on every visit. Its
# titles come from the game server.
$GbServed  = ($ServerServed -contains 'gb') -and ($ServerServed -contains 'gbc')
$NesServed = ($ServerServed -contains 'nes') -and ($ServerServed -contains 'fds') -and ($ServerServed -contains 'famicom')
# Game & Watch and Pokemon mini joined on 2026-10-14. The G&W LCD artwork
# (artwork.json.gz) is not a game file and the server path gives device files
# only, so a served gnw build with no built-in artwork leaves it exactly as it
# is. The colour units get a stub that defines no unit, so the page asks the
# content pack and then the game server, with no 404.
$GnwServed = $ServerServed -contains 'gnw'
$PmServed  = $ServerServed -contains 'pm'
function Write-Empty([string]$path, [string]$json) {
  [System.IO.File]::WriteAllText($path, $json, (New-Object System.Text.UTF8Encoding($false)))
  Write-Host ("Wrote {0}  (empty: this shelf comes from the game server)" -f $path) -ForegroundColor Green
}
if ($Want.gnw -and -not $programFound.Count)  { if ($GnwServed) { Write-Empty $OutGnwGames '{}' } else { Retire $OutGnwGames } }
if ($Want.gnw -and -not $Artwork.Count -and -not $GnwServed) { Retire $OutArt }
if ($Want.gnw) {
  foreach ($u in @('mario', 'zelda')) {
    if ($TftFound.Contains($u)) { continue }
    if ($GnwServed) { Write-Empty $OutTft[$u] ("/* Auto-generated by build_nintendo.ps1 - no built-in $u firmware: the unit's device zip comes from the game server. */`nwindow.__ARM_FW = window.__ARM_FW || {};`n") }
    else { Retire $OutTft[$u] }
  }
}
if ($Want.pokemini -and -not $PmResult.Count) { if ($PmServed) { Write-Empty $OutPokemini '{}' } else { Retire $OutPokemini } }
if ($Want.gameboy -and -not ($GbResult.Count -or $GbExtra.Count)) {
  if ($GbServed) { Write-Empty $OutGb '{"gameboy":{},"gameboyExtra":{}}'; Write-Empty $OutGbManifest '{"ids":[],"bios":false,"biosCgb":false,"extra":{}}' }
  else { Retire $OutGb; Retire $OutGbManifest }
}
if ($Want.nes -and -not $NesResult.Count) {
  if ($NesServed) { Write-Empty $OutNes '{}'; Write-Empty $OutNesManifest '{}' }
  else { Retire $OutNes; Retire $OutNesManifest }
}

$utf8 = New-Object System.Text.UTF8Encoding($false)

if ($Want.gnw -and $programFound.Count) {
  [System.IO.File]::WriteAllText($OutGnwGames, ($Result | ConvertTo-Json -Depth 5 -Compress), $utf8)
  Write-Host ("Wrote {0}  ({1} titles)" -f $OutGnwGames, $programFound.Count) -ForegroundColor Green
}

if ($Want.pokemini -and $PmResult.Count) {
  # Map: PM device id -> {langKey -> base64 game file} (one entry per loaded language),
  # plus 'bios' -> base64 BIOS. Kept in its OWN file (not gnw_games.json) because
  # each PM game is ~512 KB; the site lazy-loads this only when a PM game launches
  # and shows a language picker when a game has more than one language.
  [System.IO.File]::WriteAllText($OutPokemini, ($PmResult | ConvertTo-Json -Depth 4 -Compress), $utf8)
  Write-Host ("Wrote {0}  ({1} PM games{2})" -f $OutPokemini, @($pmGameFound).Count, ($(if ($pmBios) { ' + BIOS' } else { '' }))) -ForegroundColor Green
}

if ($Want.gameboy -and ($GbResult.Count -or $GbExtra.Count)) {
  # THE SHAPE IS THE CONTENT PACK'S, not a new one. window.__GNW_PACK.gameboy()
  # answers with { 'gb-<slot>': b64, bios: b64, biosCgb: b64 } and
  # gameboyExtra() with { 'gb-x<sha12>': {n,s,z} } over a private `b`; this file
  # is those two maps side by side, so the page can read a baked build and an
  # imported pack through one code path. Its own file rather than gnw_games.json
  # for the same reason the Pokemon mini games have one: cartridges are megabytes
  # and the Game Boy collection lazy-loads them only when it is opened.
  $gbOut = [ordered]@{ gameboy = $GbResult; gameboyExtra = $GbExtra }
  [System.IO.File]::WriteAllText($OutGb, ($gbOut | ConvertTo-Json -Depth 5 -Compress), $utf8)
  Write-Host ("Wrote {0}  ({1} catalogue + {2} extra)" -f $OutGb, $GbResult.Count, $GbExtra.Count) -ForegroundColor Green

  # THE SAME CONTENT, DESCRIBED RATHER THAN CARRIED. gb_games.json is tens of
  # megabytes because it holds every cartridge; the page needs to know WHICH
  # titles exist long before it needs any of their bytes -- to badge a tile as
  # playable, to give a pack-supplied title a tile at all, and to decide whether
  # a CGB-only game has a boot program. Asking that question used to mean
  # downloading the cartridges, on every visit, for a visitor who might never
  # open the Game Boy collection. This file answers it in a few KB; the bytes
  # are fetched once, lazily, when something is actually played.
  $mx = [ordered]@{}
  foreach ($k in $GbExtra.Keys) { $mx[$k] = [ordered]@{ n = $GbExtra[$k].n; s = $GbExtra[$k].s; z = $GbExtra[$k].z } }
  $gbMan = [ordered]@{
    ids     = @($GbResult.Keys | Where-Object { $_ -like 'gb-*' })
    bios    = $GbResult.Contains('bios')
    biosCgb = $GbResult.Contains('biosCgb')
    extra   = $mx
  }
  [System.IO.File]::WriteAllText($OutGbManifest, ($gbMan | ConvertTo-Json -Depth 5 -Compress), $utf8)
  Write-Host ("Wrote {0}  ({1} bytes)" -f $OutGbManifest, (Get-Item $OutGbManifest).Length) -ForegroundColor Green
}

if ($Want.nes -and $NesResult.Count) {
  # THE SHAPE IS THE CONTENT PACK'S, as it is for the Game Boy above.
  # window.__GNW_PACK.nes() answers with the same 'nes-x<sha12>' keys this file
  # uses, over the same {n, z, m, b} record, so the page reads a baked build and
  # an imported pack through one code path and neither knows which it has. Its
  # own file rather than gnw_games.json because an NES set is megabytes and the NES
  # collection lazy-loads it only when it is opened.
  #   n = the file's name with its extension dropped - the only name anybody has,
  #       since there is no catalogue to supply a canonical one.
  #   z = length in bytes.  m = the iNES mapper number (see Get-NesMapper).
  #   b = the game file, base64.
  $nesOut = [ordered]@{}
  foreach ($k in $NesResult.Keys) {
    $nesOut[$k] = [ordered]@{ n = $NesResult[$k].n; z = $NesResult[$k].z; m = $NesResult[$k].m; b = $NesResult[$k].b }
    if ($NesResult[$k].c) { $nesOut[$k].c = $NesResult[$k].c }
  }
  [System.IO.File]::WriteAllText($OutNes, ($nesOut | ConvertTo-Json -Depth 5 -Compress), $utf8)
  Write-Host ("Wrote {0}  ({1} games, {2:N0} bytes of content)" -f $OutNes, $NesResult.Count, $script:NesBytes) -ForegroundColor Green

  # THE SAME CONTENT, DESCRIBED RATHER THAN CARRIED - the identical split the
  # Game Boy pair makes, for the identical reason, and the reason is worth having
  # written down twice because forgetting it once already cost a multi-megabyte
  # download on every visit. nes_games.json holds whole game files; the page needs to
  # know WHICH titles exist long before it needs a byte of any of them - to put a
  # tile on the shelf, to name it, and to say which mapper it wants. Asking that
  # of nes_games.json means fetching every game file, for a visitor who may never open
  # the NES shelf at all. This file answers it in a few KB, and the bytes are
  # fetched once, lazily, when something is actually played.
  #   It is deliberately the SAME map with `b` removed and nothing else changed,
  # so the two files can be compared key for key and a manifest that has drifted
  # from its game files is obvious on sight.
  $nesMan = [ordered]@{}
  foreach ($k in $NesResult.Keys) {
    $nesMan[$k] = [ordered]@{ n = $NesResult[$k].n; z = $NesResult[$k].z; m = $NesResult[$k].m }
    if ($NesResult[$k].c) { $nesMan[$k].c = $NesResult[$k].c }
  }
  [System.IO.File]::WriteAllText($OutNesManifest, ($nesMan | ConvertTo-Json -Depth 5 -Compress), $utf8)
  Write-Host ("Wrote {0}  ({1} bytes)" -f $OutNesManifest, (Get-Item $OutNesManifest).Length) -ForegroundColor Green
}

if ($Want.gnw -and $Artwork.Count) {
  $ordered = [ordered]@{}
  foreach ($k in ($Artwork.Keys | Sort-Object)) { $ordered[$k] = $Artwork[$k] }
  $json  = $ordered | ConvertTo-Json -Depth 3 -Compress
  $bytes = $utf8.GetBytes($json)
  $msOut = New-Object System.IO.MemoryStream
  $gz = New-Object System.IO.Compression.GZipStream($msOut, [System.IO.Compression.CompressionLevel]::Optimal)
  $gz.Write($bytes, 0, $bytes.Length); $gz.Close()
  [System.IO.File]::WriteAllBytes($OutArt, $msOut.ToArray()); $msOut.Dispose()
  Write-Host ("Wrote {0}  ({1} SVGs)" -f $OutArt, $Artwork.Count) -ForegroundColor Green
}

foreach ($unit in @($TftFound.Keys | Where-Object { $Want.gnw })) {
  $bi = $TftFound[$unit].internal; $be = $TftFound[$unit].external
  $js = @"
/* Auto-generated by build_nintendo.ps1 - $unit firmware (internal + external flash), base64. */
window.__ARM_FW = window.__ARM_FW || {};
window.__ARM_FW.$unit = {
  internal: "$bi",
  external: "$be"
};
"@
  $dst = $OutTft[$unit]
  New-Item -ItemType Directory -Path (Split-Path $dst -Parent) -Force | Out-Null
  [System.IO.File]::WriteAllText($dst, $js, $utf8)
  Write-Host ("Wrote {0}" -f $dst) -ForegroundColor Green
}

Write-Host ''
if ($OverCap.Count) {
  Write-Host ("FAILED: not written because over cap: {0}" -f ((@($OverCap.Keys) | ForEach-Object { $SysLabel[$_] }) -join ', ')) -ForegroundColor Red
  exit 1
}
Write-Host 'Done - reload the site and the emulators will come to life.' -ForegroundColor Green
