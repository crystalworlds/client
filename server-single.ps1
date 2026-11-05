# server-single.ps1 -- THE ORIGINAL single-threaded server, kept verbatim (below this
# header) as the fallback while the concurrent server (server.ps1 ->
# tools/localserver) is proven. Run: .\server-single.ps1 [port]

# Requires -Version 5.1
# Minimal local static file server for testing the site (index.html + gnw.js) with correct
# COOP/COEP headers, in case any future emulator core needs SharedArrayBuffer/WASM threads.

Clear-Host
$RootPath = $PSScriptRoot
# Port is an optional argument -- `.\server.ps1 8081` -- so a second instance can
# be brought up beside a running one without editing this file. Default unchanged.
$Port     = if ($args.Count -ge 1 -and $args[0]) { [int]$args[0] } else { 8080 }
$Url      = "http://localhost:$Port/"

# ---------------------------------------------------------------------------
#  WHO CAN REACH THIS SERVER -- and the Windows trap sitting in the middle of it.
#
#  This used to bind ONE prefix, http://localhost:$Port/. That is not merely a
#  default: HttpListener prefixes are matched by HTTP.sys against the request's
#  Host header BEFORE this script ever sees the request, so a listener bound to
#  "localhost" answers http://localhost:8080/ and rejects http://mini:8080/ with
#  a bare "Bad Request - Invalid Hostname" that looks like it came from the site.
#  It did not; nothing in this file ran. That is why a TV on the LAN could not
#  load the page at all while the same URL worked on the machine itself.
#
#  The Windows-specific trap: a non-loopback prefix -- the wildcard http://+:P/,
#  and equally an explicit http://mini:P/ or http://192.168.1.5:P/ -- requires
#  either an elevated process or a standing URL ACL reservation. Without one,
#  the failure does not arrive at Prefixes.Add(); it arrives at Start(), as an
#  HttpListenerException with ErrorCode 5 (access denied). Read casually that is
#  indistinguishable from "port already in use", and it sends you hunting for a
#  process that does not exist. So the two are told apart explicitly below and
#  each prints its own remedy.
#
#  CHOICE MADE HERE: try the wildcard, fall back to loopback, never demand
#  elevation. Binding explicit per-name prefixes instead was the alternative and
#  it was rejected for two reasons -- it needs exactly the same elevation or ACL
#  (so it buys nothing), and it would have to guess in advance every Host header
#  a TV might send (machine name, machine.local, a DHCP address that changes).
#  The wildcard answers all of them. When it is unavailable the server still
#  starts on loopback, exactly as before, and prints the one command that fixes
#  it permanently -- a degraded server plus instructions, never a dead one.
# ---------------------------------------------------------------------------
$WildcardPrefix   = "http://+:$Port/"
$LoopbackPrefixes = @("http://localhost:$Port/", "http://127.0.0.1:$Port/")

# Every address a TV could plausibly be pointed at. Best-effort: this is used for
# the "type this on your TV" hint only, so any failure just prints less.
function Get-LanAddresses {
    $addrs = @()
    try {
        $addrs += (Get-NetIPAddress -AddressFamily IPv4 -ErrorAction Stop |
                   Where-Object { $_.IPAddress -notlike '127.*' -and $_.IPAddress -notlike '169.254.*' } |
                   Select-Object -ExpandProperty IPAddress)
    } catch {
        try {
            $addrs += ([System.Net.Dns]::GetHostAddresses([System.Net.Dns]::GetHostName()) |
                       Where-Object { $_.AddressFamily -eq 'InterNetwork' -and $_.ToString() -notlike '127.*' } |
                       ForEach-Object { $_.ToString() })
        } catch {}
    }
    return $addrs | Sort-Object -Unique
}

# ---------------------------------------------------------------------------
#  /carts/ -- a READ-ONLY mount of the user's own Game Boy cartridge directory.
#  Ported unchanged in behaviour from the Game Boy core's tools/serve.py, because
#  the page that consumes it (play/gameboy/) is that core's shell and expects
#  exactly this route.
#
#  Cartridge firmware is strictly local and never enters this repository, so the
#  path is CONFIGURED, never hardcoded: carts.local.json is gitignored, and
#  carts.local.json.example beside it makes the mechanism discoverable without
#  committing anybody's path or filenames.
#
#  Safe because of three things together, and all three are load-bearing:
#    * HttpListener binds localhost only, so this is reachable from this machine
#      and nowhere else;
#    * the mount is read-only -- GET and HEAD, nothing else -- so the page can
#      never write back into the directory holding the firmware;
#    * every request is RESOLVED and then checked to lie inside the configured
#      root, because a route mapping a URL onto a local directory is exactly
#      where path traversal lives. The check is on the resolved path, not the
#      URL text: %2e%2e, mixed separators and symlinks all defeat a textual
#      check and none of them defeat this one.
#
#  Absence is normal, not an error: no config or no directory means /carts/
#  simply 404s and the page falls back to its file picker, so it still works for
#  someone who has supplied nothing at all.
# ---------------------------------------------------------------------------
$CartsDir   = $null
$CartsSlots = @{}
$CartsBios  = ""
$CartsBiosCgb = ""
$CartsCfg   = Join-Path $RootPath "carts.local.json"
if (Test-Path -LiteralPath $CartsCfg -PathType Leaf) {
    try {
        $cfg = Get-Content -Raw -Encoding UTF8 -LiteralPath $CartsCfg | ConvertFrom-Json
        $d = "$($cfg.dir)".Trim()
        if ($d -and (Test-Path -LiteralPath $d -PathType Container)) {
            $CartsDir  = [System.IO.Path]::GetFullPath($d)
            $CartsBios = "$($cfg.bios)".Trim()
            $CartsBiosCgb = "$($cfg.biosCgb)".Trim()
            if ($cfg.slots) {
                foreach ($p in $cfg.slots.PSObject.Properties) {
                    if ("$($p.Value)".Trim()) { $CartsSlots[$p.Name] = "$($p.Value)".Trim() }
                }
            }
            # A policy the tooling depends on and does not check is a policy that
            # holds until somebody is in a hurry. Ask git, do not assume.
            $ignored = $false
            try { git -C $RootPath check-ignore -q -- $CartsCfg 2>$null; $ignored = ($LASTEXITCODE -eq 0) } catch { }
            if (-not $ignored) {
                Write-Host "[carts] *** WARNING *** carts.local.json is NOT gitignored." -ForegroundColor Red
                Write-Host "[carts] It names your cartridge directory and filenames, which must" -ForegroundColor Red
                Write-Host "[carts] never be committed. Add it to .gitignore before you commit." -ForegroundColor Red
            }
        }
        elseif ($d) { Write-Host "[carts] directory not found: $d -- /carts/ disabled" -ForegroundColor DarkYellow }
    }
    catch { Write-Host "[carts] carts.local.json could not be read ($($_.Exception.Message)) -- /carts/ disabled" -ForegroundColor DarkYellow }
}

# Resolve a /carts/ URL to a real file, or $null if it escapes the root.
function Resolve-CartPath {
    param([string]$Rel)
    if (-not $CartsDir) { return $null }
    $Rel = [System.Uri]::UnescapeDataString($Rel).Replace('\', '/')
    # Windows-specific, and rejected by intent rather than by luck: a component
    # like "C:" makes Join-Path produce a DRIVE-RELATIVE path that silently
    # escapes the root. It happens to 404 today because the path does not exist,
    # and "refused because it was missing" is not a defence.
    foreach ($part in $Rel.Split('/')) { if ($part -like '*:*') { return $null } }
    $parts = @($Rel.Split('/') | Where-Object { $_ -and $_ -ne '.' })
    if ($parts.Count -eq 0) { return $null }
    $target = $CartsDir
    foreach ($p in $parts) { $target = Join-Path $target $p }
    try { $target = [System.IO.Path]::GetFullPath($target) } catch { return $null }
    $root = $CartsDir.TrimEnd('\')
    if ($target -ne $root -and -not $target.StartsWith($root + '\', [System.StringComparison]::OrdinalIgnoreCase)) { return $null }
    return $target
}

$Listener = New-Object System.Net.HttpListener
$Listener.Prefixes.Add($WildcardPrefix)
$BoundLan = $true

try {
    try {
        $Listener.Start()
    } catch [System.Net.HttpListenerException] {
        # ErrorCode 5 = ERROR_ACCESS_DENIED: the wildcard needs elevation or a URL
        # ACL. This is the case that reads like a port conflict and is not one.
        # 183 = ERROR_ALREADY_EXISTS, 32 = ERROR_SHARING_VIOLATION: those genuinely
        # ARE another process on the port, and no amount of elevation helps, so they
        # are deliberately NOT swallowed -- they rethrow into the handler below.
        if ($_.Exception.ErrorCode -ne 5) { throw }

        Write-Host ""
        Write-Host " Could not bind $WildcardPrefix -- access denied." -ForegroundColor Yellow
        Write-Host " This is NOT a port conflict. Windows reserves non-loopback" -ForegroundColor Gray
        Write-Host " bindings; the port itself is free." -ForegroundColor Gray
        Write-Host " Falling back to loopback only: this machine will work," -ForegroundColor Yellow
        Write-Host " but a TV or phone on the network will NOT be able to connect." -ForegroundColor Yellow
        Write-Host ""
        Write-Host " To allow LAN access permanently, run ONCE in an ADMIN prompt:" -ForegroundColor Cyan
        Write-Host "   netsh http add urlacl url=http://+:$Port/ user=$env:USERDOMAIN\$env:USERNAME" -ForegroundColor White
        Write-Host " (then re-run this script normally -- no elevation needed after that)" -ForegroundColor Gray
        Write-Host " You may also need to let it through the firewall, once, as admin:" -ForegroundColor Cyan
        Write-Host "   netsh advfirewall firewall add rule name=`"GW Dev Server $Port`" dir=in action=allow protocol=TCP localport=$Port" -ForegroundColor White
        Write-Host " Or simply run this script as Administrator for a one-off session." -ForegroundColor Gray
        Write-Host ""

        $Listener = New-Object System.Net.HttpListener
        foreach ($p in $LoopbackPrefixes) { $Listener.Prefixes.Add($p) }
        $BoundLan = $false
        $Listener.Start()
    }

    Write-Host "==========================================================" -ForegroundColor Green
    Write-Host " GW Local Dev Server Running! " -ForegroundColor Green
    Write-Host " Context URL: $Url" -ForegroundColor Cyan
    if ($BoundLan) {
        Write-Host " Reachable from the network (bound $WildcardPrefix)" -ForegroundColor Green
        $lan = Get-LanAddresses
        Write-Host " On your TV, open one of:" -ForegroundColor Cyan
        Write-Host "   http://$($env:COMPUTERNAME):$Port/" -ForegroundColor White
        foreach ($a in $lan) { Write-Host "   http://$($a):$Port/" -ForegroundColor White }
        Write-Host " (an IP address is the reliable one -- TVs often cannot resolve" -ForegroundColor Gray
        Write-Host "  a Windows machine name. If nothing connects, it is the firewall.)" -ForegroundColor Gray
        # Cross-origin isolation is a SECURE-CONTEXT feature. localhost counts as
        # secure; http://mini:8080 and http://192.168.x.x:8080 do not. The COOP/COEP
        # headers this server sends are still sent, but the browser will not grant
        # crossOriginIsolated over plain HTTP to a non-loopback host, so anything
        # gated on SharedArrayBuffer (the Game Boy page's worker path) silently
        # takes its slower fallback there. Stated here rather than discovered.
        Write-Host " NOTE: over plain HTTP to a non-localhost address the browser" -ForegroundColor DarkYellow
        Write-Host " will NOT grant cross-origin isolation, so SharedArrayBuffer is" -ForegroundColor DarkYellow
        Write-Host " unavailable and the Game Boy page falls back off its worker path." -ForegroundColor DarkYellow
    } else {
        Write-Host " LOOPBACK ONLY -- this machine can connect, the TV cannot." -ForegroundColor Yellow
    }
    Write-Host " Serving directory: $RootPath" -ForegroundColor Gray
    Write-Host " Press [Ctrl + C] in this window to stop the server." -ForegroundColor Yellow
    if ($CartsDir) {
        Write-Host " /carts/ mounted READ-ONLY, $($CartsSlots.Count) slot(s) mapped" -ForegroundColor Cyan
        Write-Host " (local only; path from carts.local.json, never committed)" -ForegroundColor Gray
    } else {
        Write-Host " /carts/ not mounted -- the Game Boy page will use its file picker." -ForegroundColor Gray
        Write-Host " To map your own folder: copy carts.local.json.example to carts.local.json." -ForegroundColor Gray
    }
    Write-Host "==========================================================" -ForegroundColor Green

    # -----------------------------------------------------------------------
    #  WHY THIS EXISTS: one stalled client used to wedge the WHOLE server.
    #
    #  This loop is single-threaded -- one GetContext(), one response, then the
    #  next request. The body used to go out as a single blocking
    #  OutputStream.Write($Bytes, 0, $Bytes.Length). A blocking write returns
    #  only once the client has drained the socket, and HttpListener applies no
    #  write deadline, so a client that stops reading -- a throttled or occluded
    #  background tab, a fetch whose body is never consumed, a paused media read
    #  -- blocks that one Write with no timeout at all. While it is blocked,
    #  nothing else is served: HTTP.sys silently queues every other request from
    #  every tab and the whole site stops responding.
    #
    #  That is worse here than it sounds, because of the Cache-Control set below:
    #  every asset is re-fetched on every page load, so a RELOAD does not
    #  recover. The reloaded page immediately re-requests the same multi-megabyte
    #  blobs (firmware/output/gb_games.json ~29 MB, firmware/output/pokemini_games.json ~7 MB)
    #  from a server that is still wedged, and hangs again. Only closing the
    #  browser -- which destroys the stuck socket and lets the blocked Write
    #  finally return -- brought it back.
    #
    #  That is exactly the reported Pokemon mini symptom: works, then stops,
    #  survives a refresh, needs a browser restart. The Mini never received its
    #  game-file blob, so _bootIfReady() never ran, and it threw nothing. It was never
    #  specific to the Mini -- every core on the page loads its game files the same way.
    #
    #  The fix is a deadline, not a thread pool: send the body in chunks and give
    #  each chunk a bounded time. A client that makes no progress for $TimeoutMs
    #  is dropped and the server goes straight back to serving everyone else.
    #  WriteAsync + Task.Wait rather than Stream.WriteTimeout, because
    #  HttpListener's response stream reports CanTimeout = false and therefore
    #  ignores WriteTimeout entirely.
    # -----------------------------------------------------------------------
    function Write-ResponseBody {
        param(
            [Parameter(Mandatory = $true)] [System.Net.HttpListenerResponse] $Response,
            [Parameter(Mandatory = $true)] [byte[]] $Bytes,
            [int] $TimeoutMs = 20000
        )
        if ($Bytes.Length -eq 0) { return }
        $stream = $Response.OutputStream
        $chunk  = 262144        # 256 KiB: cheap enough, small enough to notice a stall
        $offset = 0
        while ($offset -lt $Bytes.Length) {
            $n    = [Math]::Min($chunk, $Bytes.Length - $offset)
            $task = $stream.WriteAsync($Bytes, $offset, $n)
            if (-not $task.Wait($TimeoutMs)) {
                # Abort(), not Close(): the WriteAsync above is still outstanding and
                # Close() would block on the very socket we are trying to escape.
                try { $Response.Abort() } catch { }
                throw ("client stalled -- no progress for {0} ms at {1}/{2} bytes; connection dropped" -f $TimeoutMs, $offset, $Bytes.Length)
            }
            $offset += $n
        }
    }

    while ($Listener.IsListening) {
        # Wait for the next request. GetContext() throws when the listener is being
        # stopped (Ctrl + C) -- treat that as "time to exit" and leave the loop.
        try { $Context = $Listener.GetContext() }
        catch { break }

        # Handle each request in its OWN try/catch/finally. If the browser drops the
        # connection mid-response (a cancelled fetch, a closed tab, navigating away),
        # OutputStream.Write throws "The I/O operation has been aborted ...". That is
        # harmless and expected -- we log it and keep serving instead of letting it
        # bubble up and shut the whole server down. The response is always closed in
        # the finally, so no connection is ever left dangling.
        try {
            $Request  = $Context.Request
            $Response = $Context.Response

            $SubPath = $Request.Url.LocalPath.TrimStart('/')
            if ([string]::IsNullOrEmpty($SubPath)) { $SubPath = "index.html" }
            # A directory URL serves its index.html. Without this, /play/gameboy/
            # 404s and only /play/gameboy/index.html works -- which is fine for a
            # link the site writes itself, and a trap for anyone who types or
            # bookmarks the tidy form. Relative URLs inside the page resolve the
            # same either way because both end in a slash-terminated directory.
            elseif ($SubPath.EndsWith('/')) { $SubPath = $SubPath + "index.html" }

            $LocalPath = $Request.Url.LocalPath

            # --- /carts/, read-only -------------------------------------------
            if ($LocalPath -eq "/carts" -or $LocalPath.StartsWith("/carts/", [System.StringComparison]::OrdinalIgnoreCase)) {
                $Response.AddHeader("Cross-Origin-Opener-Policy", "same-origin")
                $Response.AddHeader("Cross-Origin-Embedder-Policy", "credentialless")
                $Response.AddHeader("Cache-Control", "no-store")
                $Response.KeepAlive = $false

                if ($Request.HttpMethod -ne "GET" -and $Request.HttpMethod -ne "HEAD") {
                    # The directory holding the firmware is served read-only. Full stop.
                    $Response.StatusCode = 405
                    Write-Host "[405] cartridge directory is read-only: $($Request.HttpMethod) $LocalPath" -ForegroundColor Red
                }
                elseif (-not $CartsDir) {
                    $Response.StatusCode = 404
                    Write-Host "[404] /carts/ not configured (no carts.local.json)" -ForegroundColor DarkYellow
                }
                elseif ($LocalPath -eq "/carts" -or $LocalPath -eq "/carts/") {
                    # The index: WHICH SLOTS ARE MAPPED, and nothing more. Filenames
                    # are included because the page must request them; they never
                    # leave this machine.
                    $slots = New-Object PSObject
                    foreach ($k in $CartsSlots.Keys) { $slots | Add-Member -NotePropertyName $k -NotePropertyValue $CartsSlots[$k] }
                    $json = ([PSCustomObject]@{ available = $true; slots = $slots; bios = $CartsBios; biosCgb = $CartsBiosCgb } | ConvertTo-Json -Compress -Depth 4)
                    $Bytes = [System.Text.Encoding]::UTF8.GetBytes($json)
                    $Response.ContentType = "application/json"
                    $Response.ContentLength64 = $Bytes.Length
                    if ($Request.HttpMethod -eq "GET") { $Response.OutputStream.Write($Bytes, 0, $Bytes.Length) }
                    Write-Host "[200] (application/json) /carts/ -- $($CartsSlots.Count) slot(s)" -ForegroundColor Green
                }
                else {
                    $Cart = Resolve-CartPath $LocalPath.Substring("/carts/".Length)
                    if ($null -eq $Cart) {
                        $Response.StatusCode = 403
                        Write-Host "[403] outside the cartridge directory: $LocalPath" -ForegroundColor Red
                    }
                    # -LiteralPath, and this is NOT a style preference. Test-Path
                    # treats [ and ] as WILDCARD characters, so a perfectly ordinary
                    # cartridge filename like "[BIOS] Nintendo Game Boy Boot ....gb"
                    # is read as a character class matching one of B,I,O,S -- and
                    # 404s a file that is sitting right there. Measured: the boot
                    # program silently failed to load until this changed.
                    elseif (-not (Test-Path -LiteralPath $Cart -PathType Leaf)) {
                        $Response.StatusCode = 404
                        Write-Host "[404] no such cartridge in the local folder" -ForegroundColor Red
                    }
                    else {
                        $Bytes = [System.IO.File]::ReadAllBytes($Cart)
                        $Response.ContentType = "application/octet-stream"
                        $Response.ContentLength64 = $Bytes.Length
                        if ($Request.HttpMethod -eq "GET") { Write-ResponseBody -Response $Response -Bytes $Bytes }
                        # The filename is NOT logged: it names the user's own firmware.
                        Write-Host "[200] (cartridge firmware, $($Bytes.Length) bytes) /carts/*" -ForegroundColor Green
                    }
                }
            }
            # `else`, not `continue`: `continue` out of a try/catch/finally inside a
            # loop is a PowerShell 5.1 sharp edge, and this loop's finally is what
            # closes the response. An if/else has no such question over it.
            else {

            $TargetFile = [System.IO.Path]::GetFullPath((Join-Path $RootPath $SubPath))

            # carts.local.json is served to NOBODY. It is an input to this server,
            # not content: it names the directory holding the user's cartridge
            # firmware and every filename in it. Without this line any page on
            # localhost could simply fetch it -- the static handler serves whatever
            # is in the root, and .. is normalised by HttpListener before we see it,
            # so /carts/../carts.local.json arrives here as an ordinary request.
            # The page never needs it: /carts/ publishes the slot map instead.
            if ($SubPath -ieq "carts.local.json" -or $SubPath -imatch '(^|/)\.git(/|$)') {
                $Response.StatusCode = 404
                Write-Host "[404] refused (local configuration, not content): /$SubPath" -ForegroundColor DarkYellow
            }
            elseif (-not $TargetFile.StartsWith($RootPath, [System.StringComparison]::OrdinalIgnoreCase)) {
                $Response.StatusCode = 403
                Write-Host "[403] Forbidden (Traversal Blocked): /$SubPath" -ForegroundColor Red
            }
            elseif (Test-Path -LiteralPath $TargetFile -PathType Leaf) {
                $Bytes = [System.IO.File]::ReadAllBytes($TargetFile)

                $Extension = [System.IO.Path]::GetExtension($TargetFile).ToLower()
                $ContentType = switch ($Extension) {
                    ".html" { "text/html; charset=utf-8" }
                    ".js"   { "application/javascript" }
                    ".mjs"  { "application/javascript" }
                    ".css"  { "text/css" }
                    ".wasm" { "application/wasm" }
                    ".zip"  { "application/zip" }
                    ".svg"  { "image/svg+xml" }
                    ".json" { "application/json" }
                    ".png"  { "image/png" }
                    ".jpg"  { "image/jpeg" }
                    ".jpeg" { "image/jpeg" }
                    # The tile-artwork derivatives (artwork/_tiles/, see
                    # tools/build_tile_art.ps1) are WebP. Without this they fell
                    # to application/octet-stream and the browser refused to
                    # decode them as images.
                    ".webp" { "image/webp" }
                    default { "application/octet-stream" }
                }

                # -------------------------------------------------------------
                #  gzip. The site's big assets are text -- index.html, gnw.js and
                #  the firmware JSON are megabytes of markup and base64 -- and
                #  none of it was compressed at all. Over a phone connection that
                #  is the difference that shows.
                #
                #  TWO THINGS THIS MUST NOT DO, and both are guarded by the same
                #  allowlist rather than by a blocklist that a new file type
                #  would silently fall through:
                #
                #    * NEVER DOUBLE-ENCODE. artwork.json.gz and firmware/*.json.gz
                #      are ALREADY gzip on disk and the page inflates them itself
                #      (DecompressionStream in content_pack.js). Sending them with
                #      Content-Encoding: gzip would make the browser inflate them
                #      once before the page inflated them again, and the page's
                #      own inflate would fail on plain JSON. .gz is not in the
                #      allowlist, and it must never be added to it.
                #    * NEVER SPEND CPU FOR NOTHING. .png/.jpg/.webp/.webm/.zip are
                #      already compressed formats; gzip makes them marginally
                #      BIGGER and costs a pass over every byte. Not listed.
                #
                #  Only sent when the client asked for it, and only above a size
                #  where the ~20-byte gzip envelope can pay for itself.
                $Compressible = @(".html", ".js", ".mjs", ".css", ".json", ".svg", ".wasm", ".txt", ".md", ".map")
                $AcceptEnc = "" + $Request.Headers["Accept-Encoding"]
                if ($Compressible -contains $Extension -and
                    $Bytes.Length -ge 1024 -and
                    $AcceptEnc -match '(^|,)\s*gzip\s*(;|,|$)') {
                    try {
                        $ms = New-Object System.IO.MemoryStream
                        $gz = New-Object System.IO.Compression.GZipStream($ms, [System.IO.Compression.CompressionMode]::Compress, $true)
                        $gz.Write($Bytes, 0, $Bytes.Length)
                        $gz.Dispose()                      # MUST flush before reading the buffer
                        $Packed = $ms.ToArray()
                        $ms.Dispose()
                        # Only if it actually helped. A file that grows under gzip
                        # is sent as it was -- the point is fewer bytes, not the
                        # header.
                        if ($Packed.Length -lt $Bytes.Length) {
                            $Saved = $Bytes.Length
                            $Bytes = $Packed
                            $Response.AddHeader("Content-Encoding", "gzip")
                            $Response.AddHeader("Vary", "Accept-Encoding")
                            Write-Host ("        gzip {0} -> {1} bytes ({2}% smaller)" -f $Saved, $Bytes.Length, [int]((1 - ($Bytes.Length / $Saved)) * 100)) -ForegroundColor DarkGray
                        }
                    }
                    catch {
                        # Compression is an optimisation, never a reason to fail a
                        # request: fall through and send the file uncompressed.
                        Write-Host ("[warn] gzip failed for /$SubPath -- sending uncompressed: {0}" -f $_.Exception.Message) -ForegroundColor DarkYellow
                    }
                }

                $Response.ContentType = $ContentType
                # AFTER compression: this must be the length of what is actually
                # written, or the browser waits for bytes that never arrive.
                $Response.ContentLength64 = $Bytes.Length

                $Response.AddHeader("Cross-Origin-Opener-Policy", "same-origin")
                # "credentialless" keeps the page cross-origin-isolated (SharedArrayBuffer
                # still works for the emulator/transcoder WASM) while allowing cross-origin
                # embeds that don't send their own COEP -- e.g. YouTube trailer <iframe
                # credentialless> tiles on the Video page. Stricter "require-corp" blocked them.
                $Response.AddHeader("Cross-Origin-Embedder-Policy", "credentialless")
                # UNCHANGED, and deliberately so: every asset is re-fetched on
                # every page load, which is what you want while developing -- an
                # edit is always the thing you see. The cost is that there is no
                # such thing as a warm load here: cold and warm are identical, so
                # the full page weight is paid every time. That is exactly why the
                # gzip above is worth having rather than a nicety.
                $Response.AddHeader("Cache-Control", "no-cache, no-store, must-revalidate")
                # This loop is single-threaded/synchronous and doesn't correctly service a
                # second request pipelined onto a kept-alive connection -- it just hangs
                # forever waiting on GetContext() for a "new" connection that never opens
                # while the browser sits on the old one. Forcing Connection: close makes
                # every request open a fresh socket, which this server can handle fine.
                $Response.KeepAlive = $false

                Write-ResponseBody -Response $Response -Bytes $Bytes
                Write-Host "[200] ($ContentType) /$SubPath" -ForegroundColor Green
            }
            else {
                $Response.StatusCode = 404
                Write-Host "[404] Not Found: /$SubPath" -ForegroundColor Red
            }

            }   # end of the non-/carts/ branch
        }
        catch {
            # Client aborted mid-response (or a transient socket error) -- benign.
            Write-Host ("[warn] request aborted: {0}" -f $_.Exception.Message) -ForegroundColor DarkYellow
        }
        finally {
            if ($null -ne $Context) { try { $Context.Response.Close() } catch { } }
        }
    }
}
catch [System.Net.HttpListenerException] {
    # The genuine port conflict, kept distinct from the access-denied case handled
    # at Start(). Naming which one this is saves the next person the same hunt.
    if ($_.Exception.ErrorCode -eq 183 -or $_.Exception.ErrorCode -eq 32) {
        Write-Host ""
        Write-Host " Port $Port is already in use by another process." -ForegroundColor Red
        Write-Host " This IS a port conflict (unlike the access-denied case above)." -ForegroundColor Gray
        Write-Host " Find it with:  netstat -ano | findstr :$Port" -ForegroundColor White
        Write-Host " Or just start this server on another port:  .\server.ps1 8090" -ForegroundColor White
        Write-Host ""
    } else {
        Write-Error $_.Exception.Message
    }
}
catch {
    Write-Error $_.Exception.Message
}
finally {
    if ($null -ne $Listener) {
        $Listener.Stop()
        $Listener.Close()
        Write-Host "Server successfully halted." -ForegroundColor Yellow
    }
}
