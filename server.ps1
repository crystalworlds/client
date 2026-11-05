# Requires -Version 5.1
# Local server for the site -- run exactly as before:
#
#     .\server.ps1            port 8080, every interface (PC, phone, TV)
#     .\server.ps1 8081       another port, beside a running instance
#     .\server.ps1 8080 8443  HTTP port, then HTTPS port
#
# HTTPS (since 2026-10-03): with localserver.local.json present (gitignored)
# the same server ALSO serves HTTPS, default port 8443, with the certificate
# that file names.
# The banner lists the HTTPS addresses first. Plain HTTP on 8080 is kept and is
# never redirected: a TV keeps using http://192.168.1.50:8080/ (the server address).
#
# Since 2026-10-03 this starts the CONCURRENT server in tools\localserver
# (gw-localserver.exe, Go, standard library only). The old single-threaded
# HttpListener loop is kept, unchanged, as server-single.ps1 -- it is the
# fallback below and the way back.
#
# In one line: the old loop served one request at a time, so 100-190 tile
# images and multi-MB archives queued ahead of the page's own scripts and a
# cold Media load waited 14-67 s before anything ran.
#
# The executable is a BUILD OUTPUT (gitignored, never committed). It is built here on first run and rebuilt whenever main.go is
# newer than it. With no Go toolchain and no executable, this falls back to
# server-single.ps1 rather than refusing to start: a slower server, never none.

Clear-Host
$RootPath = $PSScriptRoot
$Port     = if ($args.Count -ge 1 -and $args[0]) { [int]$args[0] } else { 8080 }
$TlsPort  = if ($args.Count -ge 2 -and $args[1]) { [int]$args[1] } else { 0 }   # 0: localserver.local.json, else 8443

$SrvDir = Join-Path $RootPath 'tools\localserver'
$Exe    = Join-Path $SrvDir 'bin\gw-localserver.exe'
$Build  = Join-Path $SrvDir 'build.ps1'

$stale = -not (Test-Path -LiteralPath $Exe -PathType Leaf)
if (-not $stale) {
    $built = (Get-Item -LiteralPath $Exe).LastWriteTimeUtc
    foreach ($s in @(Get-ChildItem -LiteralPath $SrvDir -File | Where-Object { $_.Name -like '*.go' -or $_.Name -eq 'go.mod' } | ForEach-Object FullName)) {
        if ((Test-Path -LiteralPath $s) -and (Get-Item -LiteralPath $s).LastWriteTimeUtc -gt $built) { $stale = $true }
    }
}
if ($stale -and (Test-Path -LiteralPath $Build)) {
    Write-Host " Building the local server (tools\localserver)..." -ForegroundColor Gray
    & powershell -NoProfile -ExecutionPolicy Bypass -File $Build
    if ($LASTEXITCODE -ne 0 -and (Test-Path -LiteralPath $Exe)) {
        Write-Host " Build failed -- starting the previous build instead." -ForegroundColor DarkYellow
    }
}

if (-not (Test-Path -LiteralPath $Exe -PathType Leaf)) {
    Write-Host " The concurrent server is not built and could not be built" -ForegroundColor Yellow
    Write-Host " (no Go toolchain?). Starting the single-threaded server-single.ps1." -ForegroundColor Yellow
    Start-Sleep -Seconds 3   # server-single.ps1 clears the screen; let this be read first
    & (Join-Path $RootPath 'server-single.ps1') $Port
    return
}

& $Exe -root $RootPath -port $Port -https-port $TlsPort
exit $LASTEXITCODE
