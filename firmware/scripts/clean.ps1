#Requires -Version 5.1
<#
  clean.ps1 - remove the files the build scripts made.

  Removes ONLY generated files:
    firmware\output\*  (the built .json / .json.gz files and output\.previous\)
    play\mario\firmware_mario.js and play\zelda\firmware_zelda.js
                       (the Game & Watch colour units' firmware, built by
                       build-gnw)
  It never touches firmware\games\ (your games), firmware\variants\,
  firmware\unsupported\ or anything else. Everything it removes can be made
  again by running the build scripts.

  It lists what it will remove and asks first. -Force skips the question.
#>
[CmdletBinding()]
param([switch] $Force)
$ErrorActionPreference = 'Stop'

$FirmwareDir = Split-Path $PSScriptRoot -Parent
$SiteRoot    = Split-Path $FirmwareDir -Parent
$OutDir      = Join-Path $FirmwareDir 'output'

$targets = New-Object System.Collections.Generic.List[string]
if (Test-Path -LiteralPath $OutDir) {
  Get-ChildItem -LiteralPath $OutDir -Recurse -File -Force |
    Where-Object { $_.Name -match '\.json(\.gz)?$' } |
    ForEach-Object { $targets.Add($_.FullName) }
}
foreach ($t in @('play\mario\firmware_mario.js', 'play\zelda\firmware_zelda.js')) {
  $p = Join-Path $SiteRoot $t
  if (Test-Path -LiteralPath $p -PathType Leaf) { $targets.Add($p) }
}

if ($targets.Count -eq 0) { Write-Host 'Already clean - no built files found.' -ForegroundColor Green; return }

Write-Host 'Will REMOVE these built files (your games are not touched):' -ForegroundColor Yellow
foreach ($t in $targets) { Write-Host ('   {0}  ({1:N0} bytes)' -f $t.Substring($SiteRoot.Length + 1), (Get-Item -LiteralPath $t -Force).Length) -ForegroundColor Yellow }
if (-not $Force) {
  $a = Read-Host 'Remove them? [Y/N]'
  if ($a -notmatch '^\s*(y|yes)\s*$') { Write-Host 'Cancelled - nothing removed.' -ForegroundColor Yellow; return }
}
foreach ($t in $targets) { Remove-Item -LiteralPath $t -Force }
$prev = Join-Path $OutDir '.previous'
if ((Test-Path -LiteralPath $prev) -and -not (Get-ChildItem -LiteralPath $prev -Force)) { Remove-Item -LiteralPath $prev -Force }
Write-Host ('Removed {0} file(s). Run a build script to make them again.' -f $targets.Count) -ForegroundColor Green
