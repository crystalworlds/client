#Requires -Version 5.1
<#
  build.ps1 - build the site's game files.

  Double-click the build-<system>.cmd file for the system you added games to,
  or build-all.cmd for everything. From PowerShell:

      .\build.ps1 -System gb
      .\build.ps1 -System nes, atari2600
      .\build.ps1 -System all
      .\build.ps1 -System all -DryRun     # list what each build would read;
                                          # nothing is opened or written

  WHERE THE GAMES COME FROM. For each system the build reads:
    1. firmware\games\<system>\   the built-in titles (always, and first, so a
                                  built-in is the copy that is kept), and
    2. $GamesRoot\<system>\games\ and $GamesRoot\<system>\bios\  (the setting
                                  below; a root without those sub-folders is
                                  read as $GamesRoot\<system>\), EXCEPT for the
                                  systems in $ServerServed below, which read
                                  only (1).
  Output always goes to firmware\output\.

  System        reads <system> folders     writes output\...
  ------------  -------------------------  ---------------------------------
  gb, gbc       gb and gbc (together)      gb_games.json, gb_manifest.json
  nes, fds      nes and fds (together;     nes_games.json, nes_manifest.json
                and famicom: Famicom games
                moved back to famicom by
                hash 2026-10-15; the shelf
                is picked per game)
  gnw           gnw                        gnw_games.json, artwork.json.gz
                                           (+ the two colour units' files
                                           under play\mario and play\zelda)
  pm            pm                         pokemini_games.json
  atari2600     atari2600                  atari2600_games.json  \  plus
  atari5200     atari5200                  atari5200_games.json   | atari_manifest.json
  atari7800     atari7800                  atari7800_games.json   | and atari_bios.json
  lynx          lynx                       atarilynx_games.json  /  (merged)

  gb and gbc share one output file, as do nes and fds, so building
  any one of a group rebuilds all of its folders.

  CAP GUARD. Each output has a cap (NES 64 files / 48 MB, extra Game Boy titles
  64 files / 32 MB, each Atari system 256 MB). A system whose folders hold more
  than its cap is NOT written: the build fails, names the folders, and leaves
  the current output as it was, instead of keeping an arbitrary subset.

  Games may be loose files or inside .zip archives (and .7z/.rar for the
  Nintendo systems when 7-Zip is installed), in any sub-folders. A file in the
  wrong system's folder is recognised by its content and reported by name; it
  is never written into the wrong system.

  Every output is copied to output\.previous\ before it is replaced.
#>
[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)]
  [string[]] $System,
  [switch]   $DryRun,
  [string]   $Root          # testing only: overrides $GamesRoot below
)
$ErrorActionPreference = 'Stop'

# =============================================================================
#  GAMES ROOT
#
#  The builds read each system's library from $GamesRoot\<system>\games and
#  $GamesRoot\<system>\bios, as well as the built-in titles in
#  firmware\games\<system>.
#
#  The default is the repo's own folder, firmware\games. To build from a
#  library kept somewhere else, set the environment variable CW_GAMES_ROOT to
#  the folder that holds the <system> folders (or pass -Root for one run).
#  See firmware\README.md, "Games root".
# =============================================================================
$GamesRoot = Join-Path (Split-Path $PSScriptRoot -Parent) 'games'
$GamesRootFrom = 'default: firmware\games'
if ($env:CW_GAMES_ROOT) { $GamesRoot = $env:CW_GAMES_ROOT; $GamesRootFrom = 'from CW_GAMES_ROOT' }

# =============================================================================
#  SERVED BY THE GAME SERVER  (2026-10-12: "I want to fully start
#  testing the server")
#
#  These systems have no built-in titles any more: their shelves come purely
#  from the game server. Their builds NEVER read $GamesRoot (a full library
#  there must not be baked into the site), only firmware\games\<system>, which
#  is empty, so building one of them retires its output to output\.previous\.
#  The Game & Watch LCD artwork (output\artwork.json.gz) is NOT a game file
#  and stays: the server path gives the device files only, so a served gnw
#  build keeps it as it is. Every system is served, so nothing is built in.
# =============================================================================
$ServerServed = @('gb', 'gbc', 'nes', 'famicom', 'fds', 'atari2600', 'gnw', 'pm', 'atari5200', 'atari7800', 'lynx')

if ($Root) { $GamesRoot = $Root; $GamesRootFrom = 'from -Root' }
$BuiltInRoot = Join-Path (Split-Path $PSScriptRoot -Parent) 'games'

$Lib = Join-Path $PSScriptRoot 'lib'
$Nintendo = [ordered]@{ gb = 'gameboy'; gbc = 'gameboy'; nes = 'nes'; fds = 'nes'; famicom = 'nes'; gnw = 'gnw'; pm = 'pokemini'; pokemonmini = 'pokemini'; pokemini = 'pokemini' }
$Atari    = [ordered]@{ atari2600 = 'atari2600'; atari5200 = 'atari5200'; atari7800 = 'atari7800'; lynx = 'lynx'; atarilynx = 'lynx' }

$names = @($System | ForEach-Object { $_ -split ',' } | ForEach-Object { $_.Trim().ToLowerInvariant() } | Where-Object { $_ })
if ($names -contains 'all') { $names = @('gnw', 'pm', 'gb', 'nes', 'atari2600', 'atari5200', 'atari7800', 'lynx') }

$nin = New-Object System.Collections.Generic.List[string]
$ata = New-Object System.Collections.Generic.List[string]
foreach ($n in $names) {
  if ($Nintendo.Contains($n)) { if (-not $nin.Contains($Nintendo[$n])) { $nin.Add($Nintendo[$n]) } }
  elseif ($Atari.Contains($n)) { if (-not $ata.Contains($Atari[$n])) { $ata.Add($Atari[$n]) } }
  else { throw "Unknown system '$n'. Use gb, gbc, nes, fds, famicom, gnw, pm, atari2600, atari5200, atari7800, lynx or all." }
}

Write-Host ("Games root: {0}   ({1})" -f $GamesRoot, $GamesRootFrom) -ForegroundColor Yellow
Write-Host ("Built-ins:  {0}" -f $BuiltInRoot) -ForegroundColor DarkGray
if ($DryRun) { Write-Host 'DRY RUN: listing what each build would read. Nothing is opened, hashed or written.' -ForegroundColor Yellow }

# Each builder runs in its own PowerShell process, so one failing cannot leave
# the other half-run, and the exit code says which one failed.
$ps = (Get-Process -Id $PID).Path
$common = @('-GamesRoot', $GamesRoot, '-BuiltInRoot', $BuiltInRoot)
$ninArgs = @('-ServerServed', ($ServerServed -join ','))
if ($DryRun) { $common += '-ListOnly' }
$failed = $false
if ($nin.Count) {
  & $ps -NoProfile -ExecutionPolicy Bypass -File (Join-Path $Lib 'build_nintendo.ps1') -Systems ($nin -join ',') @common @ninArgs
  if ($LASTEXITCODE) { $failed = $true }
}
if ($ata.Count) {
  & $ps -NoProfile -ExecutionPolicy Bypass -File (Join-Path $Lib 'build_atari.ps1') -Systems ($ata -join ',') @common @ninArgs
  if ($LASTEXITCODE) { $failed = $true }
}
Write-Host ''
if ($failed) { Write-Host 'BUILD FAILED - see the red lines above.' -ForegroundColor Red; exit 1 }
if ($DryRun) { Write-Host 'Dry run finished. Nothing was written.' -ForegroundColor Green; exit 0 }
Write-Host 'Built. Reload the site to see the games.' -ForegroundColor Green
