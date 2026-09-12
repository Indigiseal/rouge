param(
    [int]$PreferredPort = 4173,
    [switch]$NoBrowser
)

$ErrorActionPreference = "Stop"
$root = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot ".."))
$listener = $null
$port = $PreferredPort

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
    $headerBytes = [System.Text.Encoding]::ASCII.GetBytes($headers)
    $Stream.Write($headerBytes, 0, $headerBytes.Length)

    if ($SendBody -and $Body.Length -gt 0) {
        $Stream.Write($Body, 0, $Body.Length)
    }
}

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
            if ($stream -and $stream.CanWrite) {
                $body = [System.Text.Encoding]::UTF8.GetBytes("Server error")
                Send-Response $stream 500 "Internal Server Error" $body
            }
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
