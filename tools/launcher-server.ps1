param(
    [int]$PreferredPort = 4173,
    [switch]$NoBrowser
)

$ErrorActionPreference = "Stop"
$root = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot ".."))
$listener = $null
$port = $PreferredPort

# Path the server answers with the folder it is hosting. See the handler below.
$IdentityPath = "/__rogue-launcher"

# Ask a port whether a launcher for THIS folder is already serving it.
#
# Why this matters: the browser caches by origin, and localhost:4174 is a
# different origin from localhost:4173. When this script quietly climbed to the
# next free port because an old launcher window was still open, the new port
# had an empty cache and the game re-downloaded all ~19MB of art and audio —
# the ETag revalidation below never got the chance to answer 304. Leaving one
# launcher window open was enough to make every later launch a cold load.
#
# So: probe the range first. If a launcher for this same folder answers, reuse
# it and keep the origin (and its warm cache) stable.
# Which process is listening on this port, if any.
function Get-PortOwner {
    param([int]$Port)
    try {
        $conn = Get-NetTCPConnection -State Listen -LocalPort $Port -ErrorAction Stop |
            Select-Object -First 1
        if (-not $conn) { return $null }
        return Get-CimInstance Win32_Process -Filter "ProcessId=$($conn.OwningProcess)" -ErrorAction Stop
    }
    catch { return $null }
}

# Is that process an older copy of THIS launcher, serving THIS folder?
#
# The identity probe below only recognises launchers new enough to answer it.
# A launcher started before that endpoint existed can never answer, so the
# probe rejects it and the port climbs — which is exactly the "it opens on a
# new address every time" problem, and it would never have healed on its own,
# because the stale server keeps holding the port for as long as its window
# stays open. Matching on the command line catches those too.
function Test-OurLauncherProcess {
    param($Proc)
    if (-not $Proc -or -not $Proc.CommandLine) { return $false }
    if ($Proc.ProcessId -eq $PID) { return $false }
    $script = Join-Path $PSScriptRoot "launcher-server.ps1"
    return $Proc.CommandLine -like "*$script*"
}

function Test-ExistingLauncher {
    param([int]$Port)

    $client = $null
    try {
        $client = [System.Net.Sockets.TcpClient]::new()
        # Loopback answers immediately or not at all; a short timeout keeps
        # startup snappy when the port belongs to something unrelated.
        if (-not $client.ConnectAsync("127.0.0.1", $Port).Wait(250)) { return $false }

        $stream = $client.GetStream()
        $stream.ReadTimeout = 1000
        $request = "GET $IdentityPath HTTP/1.1`r`nHost: localhost:$Port`r`nConnection: close`r`n`r`n"
        $bytes = [System.Text.Encoding]::ASCII.GetBytes($request)
        $stream.Write($bytes, 0, $bytes.Length)

        $reader = [System.IO.StreamReader]::new($stream, [System.Text.Encoding]::UTF8)
        $response = $reader.ReadToEnd()

        # Body is the served root. Compare paths, not ports: another game (or
        # another checkout of this one) on this port is not ours to reuse.
        $servedRoot = ($response -split "`r`n`r`n", 2)[-1].Trim()
        return $servedRoot -and
            ([string]::Equals(
                $servedRoot.TrimEnd([System.IO.Path]::DirectorySeparatorChar),
                $root.TrimEnd([System.IO.Path]::DirectorySeparatorChar),
                [System.StringComparison]::OrdinalIgnoreCase))
    }
    catch { return $false }
    finally { if ($client) { $client.Dispose() } }
}

$mimeTypes = @{
    ".html"  = "text/html; charset=utf-8"
    ".js"    = "text/javascript; charset=utf-8"
    ".mjs"   = "text/javascript; charset=utf-8"
    ".css"   = "text/css; charset=utf-8"
    ".json"  = "application/json; charset=utf-8"
    ".png"   = "image/png"
    ".jpg"   = "image/jpeg"
    ".jpeg"  = "image/jpeg"
    ".gif"   = "image/gif"
    ".svg"   = "image/svg+xml"
    ".ico"   = "image/x-icon"
    ".wav"   = "audio/wav"
    ".mp3"   = "audio/mpeg"
    ".ogg"   = "audio/ogg"
    ".ttf"   = "font/ttf"
    ".otf"   = "font/otf"
    ".woff"  = "font/woff"
    ".woff2" = "font/woff2"
    ".xml"   = "application/xml"
    ".txt"   = "text/plain; charset=utf-8"
}

function Send-Response {
    param(
        [System.Net.Sockets.NetworkStream]$Stream,
        [int]$StatusCode,
        [string]$StatusText,
        [byte[]]$Body,
        [string]$ContentType = "text/plain; charset=utf-8",
        [bool]$SendBody = $true,
        [string]$ExtraHeaders = ""
    )

    # no-cache, NOT no-store. The two read alike and do opposite things:
    # no-store forbade the browser from keeping a copy at all, so every load
    # re-fetched all 80MB of art and audio from disk. no-cache lets it keep
    # them and asks it to check first — and the ETag below turns that check
    # into a 304 with no body whenever the file has not changed. Edits still
    # appear immediately, because the check happens on every request.
    $headers = "HTTP/1.1 $StatusCode $StatusText`r`n" +
        "Content-Type: $ContentType`r`n" +
        "Content-Length: $($Body.Length)`r`n" +
        "Cache-Control: no-cache`r`n" +
        $ExtraHeaders +
        "Connection: close`r`n`r`n"
    # A browser hanging up mid-response is routine, not an error: Chrome opens
    # speculative connections it never uses, and cancels in-flight requests
    # whenever the page navigates or reloads. The socket write then throws
    # "An established connection was aborted by the software in your host
    # machine", and with $ErrorActionPreference = Stop that took the whole
    # server down with it — one cancelled request ended the play session.
    #
    # There is nobody left to tell, so swallow it and go back to accepting.
    try {
        $headerBytes = [System.Text.Encoding]::ASCII.GetBytes($headers)
        $Stream.Write($headerBytes, 0, $headerBytes.Length)

        if ($SendBody -and $Body.Length -gt 0) {
            $Stream.Write($Body, 0, $Body.Length)
        }
    }
    catch [System.IO.IOException] { return }
    catch [System.ObjectDisposedException] { return }
}

$reclaimTried = [System.Collections.Generic.HashSet[int]]::new()

try {
    while ($port -lt ($PreferredPort + 20)) {
        try {
            $listener = [System.Net.Sockets.TcpListener]::new(
                [System.Net.IPAddress]::Loopback,
                $port
            )
            $listener.Start()
            break
        }
        catch {
            if ($listener) {
                $listener.Stop()
                $listener = $null
            }

            # Occupied. If the occupant is a launcher already serving this same
            # folder, that IS the game server — point the browser at it and
            # leave it running rather than starting a rival on a new port.
            if (Test-ExistingLauncher -Port $port) {
                $existingUrl = "http://localhost:$port/"
                Write-Host "Rogue is already running at $existingUrl" -ForegroundColor Green
                Write-Host "Reusing it, so the browser keeps the art it already cached."
                Write-Host "The window that started it is the one serving the game; close that to stop."
                if (-not $NoBrowser) {
                    Start-Process $existingUrl
                }
                exit 0
            }

            # It did not answer, but it may still be one of ours: a launcher
            # too old to know the identity endpoint, left running in a window
            # from days ago. It cannot be reused (its headers predate the
            # caching fix, so it re-sends the whole game every load) and it
            # will hold this port forever, so retire it and take the port.
            # Tried once per port, so a kill that does not free the socket
            # falls through to climbing instead of looping.
            if (-not $reclaimTried.Contains($port)) {
                [void]$reclaimTried.Add($port)
                $owner = Get-PortOwner -Port $port
                if (Test-OurLauncherProcess $owner) {
                    Write-Host "Port $port is held by an older Rogue launcher (pid $($owner.ProcessId))." -ForegroundColor Yellow
                    Write-Host "Closing it so the game keeps its usual address."
                    Stop-Process -Id $owner.ProcessId -Force -ErrorAction SilentlyContinue
                    for ($wait = 0; $wait -lt 30; $wait++) {
                        Start-Sleep -Milliseconds 100
                        if (-not (Get-PortOwner -Port $port)) { break }
                    }
                    continue
                }
            }

            $port++
        }
    }

    if (-not $listener) {
        throw "Could not find an available local port."
    }

    $gameUrl = "http://localhost:$port/"
    Write-Host "Rogue is running at $gameUrl" -ForegroundColor Green
    Write-Host "Keep this window open while playing."
    Write-Host "Press Ctrl+C or close this window to stop."
    if (-not $NoBrowser) {
        Start-Process $gameUrl
    }

    while ($true) {
        $client = $listener.AcceptTcpClient()
        $stream = $null
        $reader = $null

        try {
            $stream = $client.GetStream()
            $reader = [System.IO.StreamReader]::new(
                $stream,
                [System.Text.Encoding]::ASCII,
                $false,
                1024,
                $true
            )

            $requestLine = $reader.ReadLine()
            # The conditional headers live here; the loop used to discard them,
            # which is why the server could never answer 304.
            $ifNoneMatch = $null
            while ($headerLine = $reader.ReadLine()) {
                if ($headerLine -match '^(?i)If-None-Match:\s*(.+)$') {
                    $ifNoneMatch = $Matches[1].Trim()
                }
            }

            if (-not $requestLine) {
                continue
            }

            $requestParts = $requestLine.Split(" ")
            if ($requestParts.Length -lt 2) {
                $body = [System.Text.Encoding]::UTF8.GetBytes("Bad request")
                Send-Response $stream 400 "Bad Request" $body
                continue
            }

            $method = $requestParts[0]
            if ($method -ne "GET" -and $method -ne "HEAD") {
                $body = [System.Text.Encoding]::UTF8.GetBytes("Method not allowed")
                Send-Response $stream 405 "Method Not Allowed" $body
                continue
            }

            $urlPath = $requestParts[1].Split("?")[0]
            $decodedPath = [System.Uri]::UnescapeDataString($urlPath)

            # Identity endpoint. A launcher starting up asks every port in the
            # range who it is serving; whoever answers with this folder is a
            # server for this game, and the new launcher steps aside and reuses
            # it instead of taking a fresh port. Not a file, so it is answered
            # before any path resolution and never cached.
            if ($decodedPath -eq $IdentityPath) {
                $body = [System.Text.Encoding]::UTF8.GetBytes($root)
                Send-Response $stream 200 "OK" $body "text/plain; charset=utf-8" ($method -eq "GET")
                continue
            }

            if ($decodedPath -eq "/") {
                $decodedPath = "/index.html"
            }

            $relativePath = $decodedPath.TrimStart("/").Replace("/", [System.IO.Path]::DirectorySeparatorChar)
            $target = [System.IO.Path]::GetFullPath((Join-Path $root $relativePath))
            $rootPrefix = $root.TrimEnd([System.IO.Path]::DirectorySeparatorChar) +
                [System.IO.Path]::DirectorySeparatorChar

            if (-not $target.StartsWith($rootPrefix, [System.StringComparison]::OrdinalIgnoreCase)) {
                $body = [System.Text.Encoding]::UTF8.GetBytes("Forbidden")
                Send-Response $stream 403 "Forbidden" $body
                continue
            }

            if (Test-Path -LiteralPath $target -PathType Container) {
                $target = Join-Path $target "index.html"
            }

            if (-not (Test-Path -LiteralPath $target -PathType Leaf)) {
                $body = [System.Text.Encoding]::UTF8.GetBytes("Not found")
                Send-Response $stream 404 "Not Found" $body
                continue
            }

            # Size plus mtime is enough to tell "same file" from "edited file"
            # without hashing 80MB on every request.
            $info = [System.IO.FileInfo]::new($target)
            $etag = '"{0:x}-{1:x}"' -f $info.LastWriteTimeUtc.Ticks, $info.Length
            $validators = "ETag: $etag`r`n" +
                "Last-Modified: $($info.LastWriteTimeUtc.ToString('r'))`r`n"

            if ($ifNoneMatch -and $ifNoneMatch -eq $etag) {
                Send-Response $stream 304 "Not Modified" @() "text/plain; charset=utf-8" $false $validators
                continue
            }

            $body = [System.IO.File]::ReadAllBytes($target)
            $extension = [System.IO.Path]::GetExtension($target).ToLowerInvariant()
            $contentType = if ($mimeTypes.ContainsKey($extension)) {
                $mimeTypes[$extension]
            }
            else {
                "application/octet-stream"
            }

            Send-Response $stream 200 "OK" $body $contentType ($method -eq "GET") $validators
        }
        catch {
            # Best-effort courtesy 500. If the request failed *because* the
            # connection died, this write dies too — and an exception raised
            # from inside a catch is not caught by that same catch, so it used
            # to escape the request loop and kill the listener.
            try {
                if ($stream -and $stream.CanWrite) {
                    $body = [System.Text.Encoding]::UTF8.GetBytes("Server error")
                    Send-Response $stream 500 "Internal Server Error" $body
                }
            }
            catch { }
        }
        finally {
            if ($reader) {
                $reader.Dispose()
            }
            if ($stream) {
                $stream.Dispose()
            }
            $client.Dispose()
        }
    }
}
finally {
    if ($listener) {
        $listener.Stop()
    }
}
