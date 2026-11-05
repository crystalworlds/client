#Requires -Version 5.1
<#
================================================================================
 build_atari.ps1  -  rebuild the four Atari catalogues from your own dumps
================================================================================

 MOVED 2026-10-10 to firmware\scripts\lib\. You do not run this file directly
 any more: run firmware\scripts\build-<system>.cmd (or build-all.cmd). For each
 of atari2600, atari5200, atari7800 and lynx it reads the built-in titles in
 firmware\games\<system>\ and, when -GamesRoot names a library laid out as
 <root>\<system>\games + <root>\<system>\bios (the games root set
 in build.ps1, see there), those two folders as well. It writes
 ONLY firmware\output\. Nothing in it needs editing. The paths named
 "firmware/<file>.json" below are now firmware/output/<file>.json.
   -Systems   any of atari2600, atari5200, atari7800, lynx (default: all four).
              Building one system rewrites that system's shelf and merges the
              manifest and BIOS file with what the other systems already have.
   -ListOnly  list every file each system's build would read, then stop:
              nothing is opened, hashed or written.
   CAP GUARD (2026-10-11): if a system being built holds more than
   -MaxBytesPerSystem of cartridges, NOTHING is written (the build fails and
   says so) instead of keeping an arbitrary subset.
   -GamesRoot / -BuiltInRoot / -OutDir   set by build.ps1, or overrides for
              testing.
 THE FOLDER NOW SETTLES THE ONE AMBIGUITY described below: a bare .bin/.rom with
 no content signature is read as 5200 when it sits in games\atari5200, and as
 2600 anywhere else (counted as "by folder"). Content evidence still wins, so a
 cartridge of another system is recognised, reported by name and not written
 unless that system is being built.
 A previous output is copied to output\.previous\ before it is replaced.

 WHAT THIS DOES
   Scans a folder (recursively, including inside .zip and zips nested in zips;
   .7z and .rar are NOT opened) for Atari 2600, 5200, 7800 and Lynx cartridges, and writes five
   files next to the site, so the distributed source can ship CODE ONLY and none
   of Atari's data:

     firmware/output/atari_manifest.json     every title found, described WITHOUT its
                                      bytes (a few hundred KB). This is what the
                                      page reads to know what EXISTS.
     firmware/output/atari2600_games.json     the 2600 cartridges, base64, keyed by content
     firmware/output/atari5200_games.json     the 5200 cartridges
     firmware/output/atari7800_games.json     the 7800 cartridges
     firmware/output/atarilynx_games.json     the Lynx cartridges

   Keys are 'a2600-x' / 'a5200-x' / 'a7800-x' / 'alynx-x' plus the first 12 hex
   of the file's SHA-256 — the same content-addressed shape the NES uses
   ('nes-x<sha12>'), so the same loading rules apply and a dump found loose,
   found in a zip and found three zips deep all produce the identical id.

 WHY FIVE FILES AND NOT ONE
   Because of what the Pokemon mini sink in build_nintendo.ps1 already learned
   and writes down: a catalogue whose game files are big must live in its OWN file so
   they are lazy-loaded only when a title of that system is launched. Measured
   on this machine's library: 5,212 2600 cartridges (30 MB), 203 5200 (4 MB),
   302 7800 (14 MB), and a Lynx shelf that is entirely inside zips. Folded into
   one file that is ~64 MB of base64 that every visitor fetches to find out
   whether a single Lynx title exists. The manifest answers that question for a
   few hundred KB; the bytes are fetched per system, on demand.

 WHY THIS IS A SEPARATE SCRIPT FROM build_nintendo.ps1
   The NES, Game Boy, Pokemon mini and Game & Watch sinks all live in that one
   builder, and following the NES pattern would have put these there too. Two
   measured reasons not to, both about build time rather than about taste:

     1. SCALE. These four libraries are 10,000+ files and tens of gigabytes once
        the accompanying box scans, manuals and videos are counted (1,499 PNGs
        and 150 MP4s in the 7800 folder alone). Folding them in would add that
        walk to every run of the main builder, including the runs that
        are only about a Game & Watch game file.
     2. The main builder is a live, shared file. Threading four more sinks
        through its eight interleaved sites (declarations, detectors, Consider,
        the output block, the confirmation prompt) is the kind of edit that is
        cheap to get almost right.

   The conventions are the SAME — content hashing, the same archive recursion,
   the same key shape, the same "no bytes in the script" rule — so this reads as
   that builder's fifth sink, moved out rather than written differently. If the
   Atari catalogues ever shrink to a handful of curated titles, folding it back
   in is a straight lift.

 CLASSIFICATION IS BY CONTENT, NEVER BY FOLDER NAME
   This is the rule the Atari sweep paid for twice in one day: a folder-name
   rule nearly discarded 558 homebrew cartridges, and 'Testing' folders turned
   out to hold commercial duplicates. So every file is classified by what is
   IN it, in this order:

     1. MAGIC, which is decisive where it exists.
          "LYNX" at offset 0 ................ Lynx, headered (.lnx)
          "ATARI7800" at offset 1 ........... 7800, headered (.a78)
     2. KNOWN FIRMWARE, by SHA-256. The console BIOS images are listed below by
        hash and are routed to the manifest's `bios` section — they are NOT
        titles and must never appear as something to play. All three cores run
        without them (the handoff states this: "The 7800 core needs no BIOS, the
        5200 core no console firmware and the Lynx core no boot firmware").
     3. SIZE, as a firmware fallback for an unlisted dump of the same game file:
        a 2,048-byte 5200 image, a 512-byte Lynx image.
     4. CONTENT SIGNATURES FOR HEADERLESS IMAGES -- added 2026-10-02, because
        without them a raw Lynx or 7800 dump named `.bin` was routed to the
        2600 shelf by step 5, and `.lyx` (the usual raw-Lynx extension) was
        never even opened. Measured over a local Atari folder before the
        fix: 81 cartridges from the 7800 and Lynx folders landed on the 2600
        shelf and the .lyx images were skipped unseen. Both tests are the
        CONSOLE'S OWN, so they are decisive rather than heuristic:
          Lynx  the boot firmware's loader frame: byte 0 is 256-n (n = 1..5
                blocks), and the first 51-byte block, read LSB first, is below
                the public modulus and decrypts (c^3 mod N) to a block whose
                skipped top byte is 0x15. Measured: 1,197 of 1,197 Lynx
                loaders carry it; 0 of 5,212 2600 images do.
                (the Lynx emulation documents, 08-boot.md; N from lynxkey.h)
          7800  the BIOS's cartridge test on FFF8-FFFF -- reset vector not
                0000/FFFF, region byte D7..D4 and D0 set, FFF9 low nibble 3 or
                7 with its high nibble >= 4, reset vector at or above that page
                -- and NOT a 2600 image (vectors repeating every 8 KB). Tried in
                the flat/SuperGame, Activision and bankset layouts, as the core
                does. Measured: all 45 headerless 7800 .bin games pass; 0 of
                5,212 2600 and 0 of 409 5200 images do.
                (the 7800 emulation documents, 05-cartridges.md, "A cartridge
                without a header" -- the core makes the same decision at load.)
     5. EXTENSION, last, and ONLY because the 2600 and the 5200 have no content
        signature at all.

   THE AMBIGUITY, NAMED RATHER THAN HIDDEN. A raw Atari 2600 image and a raw
   Atari 5200 image carry no header and no magic. The obvious content test —
   the 6502 reset vector in the last two bytes — does not separate them:
   measured over this library, 2600 images put it in $Fxxx 84% of the time and
   5200 images split roughly half between $Fxxx and $5xxx. There is therefore no
   reliable way to tell a bare `.bin` apart, and this script does not pretend
   otherwise: `.a52` is read as 5200, `.a26` as 2600, and a bare `.bin` or
   `.rom` is read as 2600 — the larger library, and the system whose dumps are
   overwhelmingly `.bin`. Every such guess is COUNTED and reported at the end as
   `byExtension`, so the figure is visible rather than implied. A `.bin` that
   carries a Lynx loader frame or passes the 7800 BIOS test never gets this far
   (step 4), so the guess is confined to the two machines that genuinely cannot
   be told apart.

 Only hashes and sizes live in this script - never any game file bytes - so nothing
 sensitive is embedded. All hashing happens locally; nothing is uploaded.

 USAGE
   .\build_atari.ps1 -Source X:\path\to\your\games
   .\build_atari.ps1 -Source X:\path\to\your\games -WhatIf   # scan and report only

   With no -Source it scans the firmware folder itself, which is the
   OTHER ROUTE: drop cartridges straight into firmware\ and run this. That is
   the same staging the Pokemon mini sink offers for loose .min dumps, and it is
   half of what was asked for ("allow me to add games to the firmware
   folder or the content page in settings"). The other half is the content page,
   which reads the identical key shape, so a title added either way is the same
   title with the same id.
================================================================================
#>
[CmdletBinding()]
param(
  [string[]] $Systems = @('atari2600', 'atari5200', 'atari7800', 'lynx'),
  [string]   $GamesRoot,
  [string]   $BuiltInRoot,
  [string]   $OutDir,
  [switch]   $WhatIf,
  [switch]   $ListOnly,
  [long]     $MaxBytesPerSystem = 256MB,
  [string[]] $ServerServed = @()
)

# Every path is relative to this script's own location:
#   <site>\firmware\scripts\lib\<this file>
$FirmwareDir = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
if (-not $BuiltInRoot) { $BuiltInRoot = Join-Path $FirmwareDir 'games' }
if (-not $GamesRoot)   { $GamesRoot   = $BuiltInRoot }
if (-not $OutDir)      { $OutDir      = Join-Path $FirmwareDir 'output' }
# Folder names are the library's system names (2026-10-11).
$FolderOf = [ordered]@{ a2600 = 'atari2600'; a5200 = 'atari5200'; a7800 = 'atari7800'; alynx = 'lynx' }
$SysByName = @{ atari2600 = 'a2600'; atari5200 = 'a5200'; atari7800 = 'a7800'; lynx = 'alynx'; atarilynx = 'alynx' }
$Want = [ordered]@{}
foreach ($n in @($Systems | ForEach-Object { $_ -split ',' } | ForEach-Object { $_.Trim().ToLowerInvariant() } | Where-Object { $_ })) {
  if (-not $SysByName.ContainsKey($n)) { throw "unknown system '$n' (use atari2600, atari5200, atari7800, lynx)" }
  $Want[$SysByName[$n]] = $true
}
# Only the repo's own built-in folders are ever created; the library root is
# read, never written to.
foreach ($k in $FolderOf.Keys) { New-Item -ItemType Directory -Force -Path (Join-Path $BuiltInRoot $FolderOf[$k]) | Out-Null }
# The folders one system stands for, built-ins FIRST so a built-in title is
# always the copy kept (the first copy of a hash wins):
#   <BuiltInRoot>\<sys>                              the repo's built-in titles
#   <GamesRoot>\<sys>\games, <GamesRoot>\<sys>\bios  a library laid out by system,
#                                                    with games and bios folders
#   <GamesRoot>\<sys>                                any other root (flat layout)
# A system folder named in -ServerServed (served by the game server, set in
# build.ps1) reads its built-in folder only, never the library root (2026-10-12).
$ServerServed = @($ServerServed | ForEach-Object { $_ -split ',' } | ForEach-Object { $_.Trim().ToLowerInvariant() } | Where-Object { $_ })
function Get-InputFolders([string]$d) {
  $list = New-Object System.Collections.Generic.List[string]
  $list.Add([System.IO.Path]::GetFullPath((Join-Path $BuiltInRoot $d)))
  if ($ServerServed -contains $d) { return @($list | Where-Object { Test-Path -LiteralPath $_ -PathType Container }) }
  $lib = Join-Path $GamesRoot $d
  if (Test-Path -LiteralPath (Join-Path $lib 'games') -PathType Container) {
    # games and its sibling cartridge folders (homebrew, prototypes, tests, ...; 2026-10-21),
    # named in one place: the game server's systems.json "cartridge_folders"
    foreach ($sub in @(Get-CartridgeFolders) + @('bios')) { $list.Add([System.IO.Path]::GetFullPath((Join-Path $lib $sub))) }
  } else { $list.Add([System.IO.Path]::GetFullPath($lib)) }
  return @($list | Select-Object -Unique | Where-Object { Test-Path -LiteralPath $_ -PathType Container })
}
function Get-CartridgeFolders {
  $p = if ($env:CWS_SYSTEMS_JSON) { $env:CWS_SYSTEMS_JSON } else { (Join-Path $(if ($env:CW_PROJECTS) { $env:CW_PROJECTS } else { '..' }) 'CrystalWorldsServer\internal\library\systems.json') }
  $f = @((Get-Content -LiteralPath $p -Raw -ErrorAction Stop | ConvertFrom-Json).cartridge_folders)
  if ($f.Count -lt 1 -or $f[0] -ne 'games') { throw "$p has no cartridge_folders starting with games" }
  return $f
}
if ($ListOnly) {
  foreach ($fk in $Want.Keys) {
    foreach ($root in (Get-InputFolders $FolderOf[$fk])) {
      $files = @(Get-ChildItem -LiteralPath $root -Recurse -File -ErrorAction SilentlyContinue)
      Write-Host ("[{0}] {1}  ({2} file(s), {3:N0} bytes)" -f $FolderOf[$fk], $root, $files.Count, (($files | Measure-Object Length -Sum).Sum + 0)) -ForegroundColor Cyan
      foreach ($f in $files) { Write-Host ("    {0}" -f $f.FullName.Substring($root.Length).TrimStart('\')) }
    }
  }
  Write-Host 'List only: nothing was opened, hashed or written.' -ForegroundColor Yellow
  exit 0
}
New-Item -ItemType Directory -Force -Path $OutDir | Out-Null
$script:FolderHint = $null

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.IO.Compression.FileSystem

# ---------------------------------------------------------------------------
# The four systems. `ext` is the extension evidence of LAST resort (see
# CLASSIFICATION above); `magic` is the decisive evidence where it exists.
# ---------------------------------------------------------------------------
$SYS = [ordered]@{
  a2600 = @{ key='a2600-x'; label='Atari 2600'; out='atari2600_games.json'; min=64;   max=512KB }
  a5200 = @{ key='a5200-x'; label='Atari 5200'; out='atari5200_games.json'; min=2048; max=512KB }
  # max includes each format's header: the 7800 core takes 1 MB plus a 128-byte
  # .a78 header and the Lynx core 2 MB plus a 64-byte .lnx header (their
  # INTERFACE docs). Written as bare 1MB/2MB these dropped the three full-size
  # 7800 demos. The minima are the smallest real programs in the library: an
  # 896-byte headered 7800 sound test, 473-byte BLL homebrew for the Lynx.
  a7800 = @{ key='a7800-x'; label='Atari 7800'; out='atari7800_games.json'; min=256;  max=(1MB + 128) }
  alynx = @{ key='alynx-x'; label='Atari Lynx'; out='atarilynx_games.json'; min=64;   max=(2MB + 64)  }
}

# Console firmware, BY CONTENT HASH. Extracted from this machine's own library
# and hashed; see CLASSIFICATION note 2. These are routed to the manifest's
# `bios` section and never offered as titles.
#
# THE 5200's TWO 'Firmware' FILES ARE ONE FILE. '5200.rom' and
# '[BIOS] Atari 5200 (USA).a52' are both 2,048 bytes with the IDENTICAL
# SHA-256 06b250f1…, carrying the 5200 BIOS's "RJZ 1982" signature at $07F0 and
# 6502 vectors (NMI $FCA2, RESET $FD23, IRQ $FC00) that all land inside the
# $F800-$FFFF BIOS window. Two names, one image, and firmware rather than a
# cartridge — established by reading the bytes, which is the only way the
# question could be settled: the folder is called 'Firmware', and a folder name
# decides nothing here.
$BIOS = @{
  '06b250f18983d058c0f156ce7ee88ae48b6eaf11e6f10f21dccf6ac7ffb6a6af' = @{ sys='a5200'; what='Atari 5200 BIOS' }
  '7d94551defcd8e7b045a34255654d6d169a683f63062d51dee3eedabf2042db0' = @{ sys='a7800'; what='Atari 7800 BIOS (NTSC)' }
  '69b8417ba85a0a4af8325b94996bf76ec2a2535814f5f39c3121775e681968f7' = @{ sys='a7800'; what='Atari 7800 BIOS (NTSC, alt dump)' }
  '63e1884e27c89d47e968e2c31dd268e17b415be590865739d5b366c76c123c48' = @{ sys='a7800'; what='Atari 7800 BIOS (PAL)' }
  '368a5b43b9ab18c7108341e7da5cb3c65dbe5ca1d8334eb8654bf3d73b6f6308' = @{ sys='a7800'; what='Atari 7800 High Score Cartridge BIOS' }
  '2e3aaf5ab638ad7d735232736bad78c90c4fce98f7a7974fd1d734f0c2e57d60' = @{ sys='alynx'; what='Atari Lynx boot firmware' }
  'c26a36c1990bcf841155e5a6fea4d2ee1a4d53b3cc772e70f257a962ad43b383' = @{ sys='alynx'; what='Atari Lynx boot firmware (common dump)' }
}

# NB the collection of firmware actually FOUND is $FirmwareFound, not $bios.
# PowerShell variable names are CASE-INSENSITIVE, so `$bios = [ordered]@{}`
# silently overwrites the $BIOS table above and every lookup then misses --
# which presents as "no BIOS was detected" plus a method-not-found on the
# wrong type, several hundred lines away from the assignment that caused it.
$sha = [System.Security.Cryptography.SHA256]::Create()
Add-Type -AssemblyName System.Numerics

# The Lynx boot's public modulus, most significant byte first. A published
# constant (the Lynx core's lynxkey.h); used only to recognise a loader.
$LynxN = [byte[]](0x35,0xB5,0xA3,0x94,0x28,0x06,0xD8,0xA2,0x26,0x95,0xD7,0x71,0xB2,0x3C,0xFD,0x56,0x1C,0x4A,
                  0x19,0xB6,0xA3,0xB0,0x26,0x00,0x36,0x5A,0x30,0x6E,0x3C,0x4D,0x63,0x38,0x1B,0xD4,0x1C,0x13,
                  0x64,0x89,0x36,0x4C,0xF2,0xBA,0x2A,0x58,0xF4,0xFE,0xE1,0xFD,0xAC,0x7E,0x79)
$le = New-Object byte[] 52; for ($i = 0; $i -lt 51; $i++) { $le[$i] = $LynxN[50 - $i] }   # LE + a 0 sign byte
$LynxModulus = New-Object System.Numerics.BigInteger (,$le)

# A raw image whose first page is a Lynx boot loader frame. See CLASSIFICATION 4.
function Test-LynxLoader([byte[]]$b) {
  if ($b.Length -lt 52) { return $false }
  if ($b[0] -lt 0xFB) { return $false }                       # 256 - n, n = 1..5
  $c = New-Object byte[] 52; [Array]::Copy($b, 1, $c, 0, 51)   # LSB first, + a 0 sign byte
  $cv = New-Object System.Numerics.BigInteger (,$c)
  if ($cv.CompareTo($LynxModulus) -ge 0) { return $false }
  $m = [System.Numerics.BigInteger]::ModPow($cv, 3, $LynxModulus).ToByteArray()
  $top = 0; if ($m.Length -gt 50) { $top = $m[50] }
  return ($top -eq 0x15)
}

# The 7800 BIOS's cartridge test, in the three layouts the core tries, and not
# a 2600 image. See CLASSIFICATION 4.
function Test-7800Tail([byte[]]$b, [int]$end) {
  $o = $end - 8
  if ($o -lt 0) { return $false }
  $rv = $b[$o + 4] + 256 * $b[$o + 5]
  if ($rv -eq 0 -or $rv -eq 0xFFFF) { return $false }
  if (($b[$o] -band 0xF1) -ne 0xF1) { return $false }
  if (($b[$o + 1] -band 0x0B) -ne 0x03) { return $false }
  $page = $b[$o + 1] -shr 4
  if ($page -lt 4) { return $false }
  return (($rv -shr 8) -ge ($page -shl 4))
}
function Test-2600Mirror([byte[]]$b) {
  $L = $b.Length
  foreach ($a in 0xDFFA, 0xBFFA, 0x9FFA, 0x7FFA, 0x5FFA) {
    $off = $L - (0x10000 - $a)
    if ($off -lt 0) { return $false }
    for ($i = 0; $i -lt 6; $i++) { if ($b[$off + $i] -ne $b[$L - 6 + $i]) { return $false } }
  }
  return $true
}
function Test-7800Image([byte[]]$b) {
  $L = $b.Length
  if ($L -lt 4096) { return $false }
  if (Test-7800Tail $b $L) { return (-not (Test-2600Mirror $b)) }
  if ($L -eq 131072 -and (Test-7800Tail $b (15 * 8192))) { return $true }   # Activision: block 14 at the top
  if (Test-7800Tail $b ([int]($L / 2))) { return $true }                     # bankset: the CPU's half
  return $false
}
function Get-Sha([byte[]]$b) { -join ($sha.ComputeHash($b) | ForEach-Object { $_.ToString('x2') }) }

# ---------------------------------------------------------------------------
# Classify. Returns a hashtable @{ sys; how } or $null.
#   how = 'magic' | 'bios' | 'size' | 'extension'
# ---------------------------------------------------------------------------
function Get-AtariKind([byte[]]$b, [string]$name) {
  if ($null -eq $b -or $b.Length -lt 64) { return $null }
  $ext = [System.IO.Path]::GetExtension($name).ToLowerInvariant()

  # 1. MAGIC -- decisive.
  if ($b.Length -ge 4 -and $b[0] -eq 0x4C -and $b[1] -eq 0x59 -and $b[2] -eq 0x4E -and $b[3] -eq 0x58) {
    return @{ sys='alynx'; how='magic' }                       # "LYNX"
  }
  if ($b.Length -ge 10) {
    $tag = [System.Text.Encoding]::ASCII.GetString($b, 1, 9)
    if ($tag -eq 'ATARI7800') { return @{ sys='a7800'; how='magic' } }
  }

  # 2. KNOWN FIRMWARE, by content hash.
  $h = Get-Sha $b
  if ($BIOS.ContainsKey($h)) { return @{ sys=$BIOS[$h].sys; how='bios'; what=$BIOS[$h].what } }

  # 3. SIZE, as the firmware fallback for an unlisted dump of the same game file.
  #    A 5200 cartridge is 4 KB or more and a Lynx cartridge far more, so these
  #    two sizes cannot be a game on their own system.
  if ($b.Length -eq 2048 -and $ext -eq '.a52') { return @{ sys='a5200'; how='size'; what='Atari 5200 BIOS (unlisted dump)' } }
  if ($b.Length -eq 512  -and ($ext -eq '.lnx' -or $ext -eq '.o')) { return @{ sys='alynx'; how='size'; what='Atari Lynx boot firmware (unlisted dump)' } }

  # 4. CONTENT SIGNATURES for headerless images -- the consoles' own tests.
  if (Test-LynxLoader $b) { return @{ sys='alynx'; how='content' } }
  if (Test-7800Image $b)  { return @{ sys='a7800'; how='content' } }

  # 5. EXTENSION -- last, and only where no content signature exists at all.
  switch ($ext) {
    '.a52' { return @{ sys='a5200'; how='extension' } }
    '.a26' { return @{ sys='a2600'; how='extension' } }
    '.a78' { return @{ sys='a7800'; how='extension' } }   # headerless .a78 dumps exist
    '.lnx' { return @{ sys='alynx'; how='extension' } }
    '.o'   { return @{ sys='alynx'; how='extension' } }   # raw Lynx homebrew
    '.lyx' { return @{ sys='alynx'; how='extension' } }   # raw Lynx without a loader frame
    # THE AMBIGUITY -- see the header. Since 2026-10-10 the games folder decides
    # it: games\atari5200 means 5200, anywhere else 2600.
    '.bin' { if ($script:FolderHint -eq 'a5200') { return @{ sys='a5200'; how='folder' } }; return @{ sys='a2600'; how='extension' } }
    '.rom' { if ($script:FolderHint -eq 'a5200') { return @{ sys='a5200'; how='folder' } }; return @{ sys='a2600'; how='extension' } }
  }
  return $null
}

# ---------------------------------------------------------------------------
# Collection. First copy of a hash wins and the rest are ignored, exactly as
# build_nintendo.ps1's Consider() does -- so duplicates at different depths, and
# the commercial duplicates that turned up inside 'Testing' folders, are
# harmless rather than something a folder rule has to catch.
# ---------------------------------------------------------------------------
$found   = @{}; foreach ($k in $SYS.Keys) { $found[$k]   = [ordered]@{} }
$bytesIn = @{}; foreach ($k in $SYS.Keys) { $bytesIn[$k] = 0L }
# PER SYSTEM, not one total. A single `tooBig` counter is how 307 Lynx titles
# were dropped by the byte budget and reported as an eight-thousand-file run's
# unremarkable-looking "out of range 307" -- a number that reads like a few odd
# files and was in fact a third of one system's shelf. A rejection that cannot
# be attributed to a system is a rejection nobody will investigate.
$outOfRange = @{}; foreach ($k in $SYS.Keys) { $outOfRange[$k] = 0 }
$overBudget = @{}; foreach ($k in $SYS.Keys) { $overBudget[$k] = 0 }
$FirmwareFound = [ordered]@{}
# The firmware images' BYTES, kept apart from $FirmwareFound so the manifest's
# descriptive `bios` section cannot grow a `b` by accident. Written to their
# own file, firmware/output/atari_bios.json -- see the end of this script.
$FirmwareBytes = @{}
$report  = [ordered]@{
  scanned = 0; kept = 0; biosFound = 0; duplicates = 0; tooBig = 0;
  unclassified = 0; byMagic = 0; byContent = 0; byExtension = 0; byFolder = 0; archives = 0
}

function Consider([byte[]]$b, [string]$name) {
  $script:report.scanned++
  $kind = Get-AtariKind $b $name
  if ($null -eq $kind) { $script:report.unclassified++; return }

  $h = Get-Sha $b
  $s = $kind.sys

  if ($kind.how -eq 'bios' -or $kind.how -eq 'size') {
    if (-not $FirmwareFound.Contains($h)) {
      $script:report.biosFound++
      $FirmwareFound[$h] = [ordered]@{ s=$s; n=[System.IO.Path]::GetFileName($name); z=$b.Length; what=$kind.what }
      $script:FirmwareBytes[$h] = $b
    }
    return
  }

  if ($kind.how -eq 'magic')     { $script:report.byMagic++ }
  if ($kind.how -eq 'content')   { $script:report.byContent++ }
  if ($kind.how -eq 'extension') { $script:report.byExtension++ }
  if ($kind.how -eq 'folder')    { $script:report.byFolder++ }

  $cfg = $SYS[$s]
  if ($b.Length -lt $cfg.min -or $b.Length -gt $cfg.max) { $script:outOfRange[$s]++; return }

  $id = $cfg.key + $h.Substring(0, 12)
  if ($found[$s].Contains($id)) { $script:report.duplicates++; return }
  if ($bytesIn[$s] + $b.Length -gt $MaxBytesPerSystem) { $script:overBudget[$s]++; return }

  $found[$s][$id] = [ordered]@{
    n = [System.IO.Path]::GetFileNameWithoutExtension($name)
    z = $b.Length
    h = $h
    _bytes = $b
  }
  $script:bytesIn[$s] += $b.Length
  $script:report.kept++
}

$CART_EXT = @('.bin', '.a26', '.a52', '.a78', '.lnx', '.lyx', '.rom', '.o')
$MAX_DEPTH = 3

function Scan-Archive([string]$path, [int]$depth) {
  if ($depth -gt $MAX_DEPTH) { Write-Warning "nested deeper than $MAX_DEPTH -- NOT opening $path"; return }
  $script:report.archives++
  try { $zip = [System.IO.Compression.ZipFile]::OpenRead($path) } catch { Write-Warning "unreadable archive: $path"; return }
  try {
    foreach ($e in $zip.Entries) {
      if ($e.Length -eq 0) { continue }
      $ext = [System.IO.Path]::GetExtension($e.Name).ToLowerInvariant()
      $isZip = ($ext -eq '.zip')
      if (-not $isZip -and $CART_EXT -notcontains $ext) { continue }
      if ($e.Length -gt 8MB) { continue }
      $ms = New-Object System.IO.MemoryStream
      $st = $e.Open(); $st.CopyTo($ms); $st.Close()
      $b = $ms.ToArray(); $ms.Dispose()
      if ($isZip) {
        # A nested archive is opened the way the site's readZip() opens one, so
        # a pack that works in the browser works here and vice versa.
        $tmp = [System.IO.Path]::GetTempFileName()
        [System.IO.File]::WriteAllBytes($tmp, $b)
        Scan-Archive $tmp ($depth + 1)
        Remove-Item $tmp -Force -ErrorAction SilentlyContinue
      } else {
        Consider $b "$($e.FullName)"
      }
    }
  } finally { $zip.Dispose() }
}

foreach ($fk in $Want.Keys) {
 foreach ($root in (Get-InputFolders $FolderOf[$fk])) {
  $script:FolderHint = $fk
  Write-Host "Scanning $root ..." -ForegroundColor Cyan
  Get-ChildItem -LiteralPath $root -Recurse -File -ErrorAction SilentlyContinue | ForEach-Object {
    $ext = $_.Extension.ToLowerInvariant()
    if ($ext -eq '.zip') { Scan-Archive $_.FullName 1 }
    elseif ($CART_EXT -contains $ext) {
      if ($_.Length -gt 8MB) { return }
      Consider ([System.IO.File]::ReadAllBytes($_.FullName)) $_.Name
    }
  }
 }
}

# ---------------------------------------------------------------------------
# Report
# ---------------------------------------------------------------------------
Write-Host ''
Write-Host 'Classified by content:' -ForegroundColor Cyan
$anyDropped = $false
foreach ($k in $SYS.Keys) {
  $line = "  {0,-12} {1,6} cartridges  {2,13:N0} bytes" -f $SYS[$k].label, $found[$k].Count, $bytesIn[$k]
  if ($outOfRange[$k] -or $overBudget[$k]) {
    $anyDropped = $true
    $line += "   DROPPED: {0} out of size range, {1} over the {2:N0}-byte budget" -f $outOfRange[$k], $overBudget[$k], $MaxBytesPerSystem
    Write-Host $line -ForegroundColor Yellow
  } else {
    Write-Host $line
  }
}
Write-Host ("  {0,-12} {1,6} images (never offered as titles)" -f 'firmware', $FirmwareFound.Count)
foreach ($h in $FirmwareFound.Keys) { Write-Host ("      {0}  {1}" -f $FirmwareFound[$h].what, $FirmwareFound[$h].n) -ForegroundColor DarkGray }
Write-Host ''
Write-Host ("  scanned {0}  kept {1}  duplicates {2}  unclassified {3}" -f `
  $report.scanned, $report.kept, $report.duplicates, $report.unclassified)
if ($anyDropped) {
  Write-Host '  SOMETHING WAS DROPPED -- see the per-system lines above. Raise' -ForegroundColor Red
  Write-Host '  -MaxBytesPerSystem, or decide that shelf needs per-title fetch.' -ForegroundColor Red
}
Write-Host ("  identified by magic {0}, by content signature {1}, by folder {2}, by extension {3}  <- the last is the guess; see the header" -f `
  $report.byMagic, $report.byContent, $report.byFolder, $report.byExtension) -ForegroundColor Yellow
# Content of a system that is not being built: named, never written.
foreach ($k in $SYS.Keys) {
  if (-not $Want.Contains($k) -and $found[$k].Count) {
    Write-Host ("  NOT WRITTEN: {0} {1} cartridge(s) were found in another system's folder - move them to games\{2} and build that system:" -f $found[$k].Count, $SYS[$k].label, $FolderOf[$k]) -ForegroundColor Yellow
    foreach ($id in $found[$k].Keys) { Write-Host ("      {0}" -f $found[$k][$id].n) -ForegroundColor Yellow }
  }
}
foreach ($h in @($FirmwareFound.Keys)) {
  if (-not $Want.Contains($FirmwareFound[$h].s)) {
    Write-Host ("  NOT WRITTEN: {0} ({1}) belongs in games\{2}" -f $FirmwareFound[$h].n, $FirmwareFound[$h].what, $FolderOf[$FirmwareFound[$h].s]) -ForegroundColor Yellow
  }
}
Write-Host ("  archives opened {0}" -f $report.archives)

if ($WhatIf) { Write-Host 'WhatIf: nothing written.' -ForegroundColor Yellow; return }

# CAP GUARD (2026-10-11). A system over -MaxBytesPerSystem would otherwise be
# written as whichever cartridges the folder walk met first: an arbitrary
# subset that can drop the built-in titles. The manifest and BIOS file are
# shared by all four systems, so the whole run is refused and every current
# output is left exactly as it was.
$overCapSys = @($Want.Keys | Where-Object { $overBudget[$_] })
if ($overCapSys.Count) {
  Write-Host ''
  foreach ($k in $overCapSys) {
    Write-Host ("NOT WRITTEN - OVER CAP: {0} has {1} more cartridge(s) than the {2:N0}-byte cap fits." -f $SYS[$k].label, $overBudget[$k], $MaxBytesPerSystem) -ForegroundColor Red
    foreach ($root in (Get-InputFolders $FolderOf[$k])) { Write-Host ("    " + $root) -ForegroundColor Red }
  }
  Write-Host '  Writing would keep an arbitrary subset, so nothing was written and every current output is unchanged.' -ForegroundColor Red
  Write-Host '  Trim those folders, or serve the full library from the game server.' -ForegroundColor Red
  exit 1
}

# ---------------------------------------------------------------------------
# Write
# ---------------------------------------------------------------------------
$utf8 = New-Object System.Text.UTF8Encoding $false
$Previous = Join-Path $OutDir '.previous'
function Save-Previous([string]$path) {
  if (Test-Path -LiteralPath $path -PathType Leaf) {
    New-Item -ItemType Directory -Force -Path $Previous | Out-Null
    Copy-Item -LiteralPath $path -Destination (Join-Path $Previous (Split-Path $path -Leaf)) -Force
  }
}
# The systems NOT being built keep what the existing manifest and BIOS file say
# about them, so building one system never empties another's shelf.
$oldManifest = $null; $oldBios = $null
$mpOld = Join-Path $OutDir 'atari_manifest.json'
$bpOld = Join-Path $OutDir 'atari_bios.json'
if (Test-Path -LiteralPath $mpOld) { $oldManifest = [System.IO.File]::ReadAllText($mpOld) | ConvertFrom-Json }
if (Test-Path -LiteralPath $bpOld) { $oldBios = [System.IO.File]::ReadAllText($bpOld) | ConvertFrom-Json }

$manifest = [ordered]@{}
foreach ($k in $SYS.Keys) {
  if (-not $Want.Contains($k)) {
    if ($oldManifest -and $oldManifest.titles) {
      foreach ($pp in $oldManifest.titles.PSObject.Properties) { if ($pp.Value.s -eq $k) { $manifest[$pp.Name] = $pp.Value } }
    }
    continue
  }
  $cartsOut = [ordered]@{}
  foreach ($id in $found[$k].Keys) {
    $e = $found[$k][$id]
    $cartsOut[$id] =[ordered]@{ n=$e.n; z=$e.z; b=[Convert]::ToBase64String($e._bytes) }
    $manifest[$id] = [ordered]@{ s=$k; n=$e.n; z=$e.z }
  }
  $p = Join-Path $OutDir $SYS[$k].out
  Save-Previous $p
  [System.IO.File]::WriteAllText($p, ($cartsOut | ConvertTo-Json -Depth 5 -Compress), $utf8)
  Write-Host ("Wrote {0}  ({1} cartridges, {2:N0} bytes of content)" -f $p, $cartsOut.Count, $bytesIn[$k]) -ForegroundColor Green
}

# The manifest is the same content described WITHOUT the bytes, so the page can
# ask what exists without downloading tens of megabytes to answer -- the NES's
# nes_manifest.json and the Game Boy's gb_manifest.json, for four systems. The
# `bios` section is separate and carries no bytes: it says which firmware the
# user has. The bytes are in firmware/output/atari_bios.json, written below.
# The BIOS section: images of the systems being built as found now, the rest
# carried over from the previous build.
$biosKeep = [ordered]@{}; $biosKeepBytes = [ordered]@{}
if ($oldManifest -and $oldManifest.bios) {
  foreach ($pp in $oldManifest.bios.PSObject.Properties) { if (-not $Want.Contains($pp.Value.s)) { $biosKeep[$pp.Name] = $pp.Value } }
}
if ($oldBios) {
  foreach ($pp in $oldBios.PSObject.Properties) { if (-not $Want.Contains($pp.Value.s)) { $biosKeepBytes[$pp.Name] = $pp.Value } }
}
foreach ($h in @($FirmwareFound.Keys)) {
  if ($Want.Contains($FirmwareFound[$h].s)) { $biosKeep[$h] = $FirmwareFound[$h] }
}
$manifestOut = [ordered]@{
  _note = 'Built by firmware/scripts/lib/build_atari.ps1. Ids are content-addressed: <sys>-x + the first 12 hex of the file SHA-256. `s` names the system; bytes live in firmware/output/atari<sys>_games.json and are fetched per system, on demand.'
  titles = $manifest
  bios   = $biosKeep
}
$mp = Join-Path $OutDir 'atari_manifest.json'
Save-Previous $mp
[System.IO.File]::WriteAllText($mp, ($manifestOut | ConvertTo-Json -Depth 5 -Compress), $utf8)
Write-Host ("Wrote {0}  ({1} titles, {2} firmware images)" -f $mp, $manifest.Count, $biosKeep.Count) -ForegroundColor Green

# ---------------------------------------------------------------------------
# THE FIRMWARE IMAGES' BYTES -- added 2026-10-02. Until then every firmware
# record was @{ s; n; z; what } with no bytes, so the user's own console
# firmware (the 5200 BIOS, 06b250f1..., most of all) was classified correctly
# and then reached no shipped file: the core could never be given it.
#
# NONE OF THE FOUR CORES NEEDS ONE. Each runs on firmware written for its
# project when the user supplies none (the core notes: "The 7800 core needs
# no BIOS, the 5200 core no console firmware and the Lynx core no boot
# firmware; the user may supply any of them"). This file is what lets a user
# supply their own -- an OPTION the page offers the core, never a precondition.
#
# A SEPARATE FILE, NEVER A SHELF, so a firmware image cannot be offered as a
# title by any code that walks the shelves. Keyed by full SHA-256, the same key
# as the manifest's `bios` section. Ignored by .gitignore like every other
# Atari-derived output here -- this repository has a public remote.
# ---------------------------------------------------------------------------
$biosOut = $biosKeepBytes
foreach ($h in $FirmwareFound.Keys) {
  $e = $FirmwareFound[$h]
  if (-not $Want.Contains($e.s)) { continue }
  $biosOut[$h] = [ordered]@{ s=$e.s; n=$e.n; z=$e.z; what=$e.what; b=[Convert]::ToBase64String($FirmwareBytes[$h]) }
}
$bp = Join-Path $OutDir 'atari_bios.json'
Save-Previous $bp
[System.IO.File]::WriteAllText($bp, ($biosOut | ConvertTo-Json -Depth 5 -Compress), $utf8)
Write-Host ("Wrote {0}  ({1} firmware images, with their bytes)" -f $bp, $biosOut.Count) -ForegroundColor Green
