$port = 8080
$root = $PSScriptRoot
if (-not $root) { $root = (Get-Location).Path }

$mimeTypes = @{
    '.html' = 'text/html; charset=utf-8'
    '.css'  = 'text/css; charset=utf-8'
    '.js'   = 'application/javascript; charset=utf-8'
    '.json' = 'application/json; charset=utf-8'
    '.png'  = 'image/png'
    '.jpg'  = 'image/jpeg'
    '.gif'  = 'image/gif'
    '.svg'  = 'image/svg+xml'
    '.ico'  = 'image/x-icon'
}

$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:$port/")

try {
    $listener.Prefixes.Add("http://+:$port/")
} catch {}

try {
    $listener.Start()
} catch {
    Write-Host "Trying localhost only..." -ForegroundColor Yellow
    $listener = New-Object System.Net.HttpListener
    $listener.Prefixes.Add("http://localhost:$port/")
    $listener.Start()
}

$localIP = (Get-NetIPAddress -AddressFamily IPv4 | Where-Object {
    $_.InterfaceAlias -notlike '*Loopback*' -and
    $_.IPAddress -ne '127.0.0.1' -and
    $_.IPAddress -notlike '169.254.*'
} | Select-Object -First 1).IPAddress

Write-Host ""
Write-Host "=== Game Server Started ===" -ForegroundColor Green
Write-Host "  PC:   http://localhost:$port/" -ForegroundColor Cyan
if ($localIP) {
    Write-Host "  Mobile: http://${localIP}:$port/" -ForegroundColor Cyan
}
Write-Host "  Press Ctrl+C to stop" -ForegroundColor Yellow
Write-Host ""

$dataDir = Join-Path $root "data"
$feedbackFile = Join-Path $dataDir "feedback.json"
$maxFeedbackBodyBytes = 16384
if (-not (Test-Path $dataDir)) {
    New-Item -Path $dataDir -ItemType Directory | Out-Null
}

function Write-JsonResponse {
    param(
        [Parameter(Mandatory = $true)]$Response,
        [Parameter(Mandatory = $true)]$Object,
        [int]$StatusCode = 200
    )
    $json = $Object | ConvertTo-Json -Depth 8 -Compress
    $bytes = [System.Text.Encoding]::UTF8.GetBytes($json)
    $Response.StatusCode = $StatusCode
    $Response.ContentType = 'application/json; charset=utf-8'
    $Response.ContentLength64 = $bytes.Length
    $Response.OutputStream.Write($bytes, 0, $bytes.Length)
}

function Read-RequestBodyText {
    param([Parameter(Mandatory = $true)]$Request)
    $reader = New-Object System.IO.StreamReader($Request.InputStream, $Request.ContentEncoding)
    try {
        return $reader.ReadToEnd()
    } finally {
        $reader.Dispose()
    }
}

function Load-FeedbackList {
    param([string]$Path)
    if (-not (Test-Path $Path)) { return @() }
    try {
        $raw = Get-Content -Path $Path -Raw -Encoding UTF8
        if (-not $raw) { return @() }
        $arr = $raw | ConvertFrom-Json
        if ($arr -is [System.Array]) { return @($arr) }
        if ($null -ne $arr) { return @($arr) }
        return @()
    } catch {
        return @()
    }
}

while ($listener.IsListening) {
    $context = $listener.GetContext()
    $request = $context.Request
    $response = $context.Response

    $urlPath = $request.Url.LocalPath
    $method = $request.HttpMethod

    if ($urlPath -eq '/api/feedback') {
        if ($method -eq 'OPTIONS') {
            $response.StatusCode = 204
            $response.OutputStream.Close()
            continue
        }
        if ($method -eq 'POST') {
            try {
                $contentLength = $request.ContentLength64
                if ($contentLength -gt $maxFeedbackBodyBytes) {
                    Write-JsonResponse -Response $response -Object @{ ok = $false; error = 'payload_too_large' } -StatusCode 413
                    $response.OutputStream.Close()
                    continue
                }
                $rawBody = Read-RequestBodyText -Request $request
                if (-not $rawBody) {
                    Write-JsonResponse -Response $response -Object @{ ok = $false; error = 'empty_body' } -StatusCode 400
                    $response.OutputStream.Close()
                    continue
                }
                $rawLen = [System.Text.Encoding]::UTF8.GetByteCount($rawBody)
                if ($rawLen -gt $maxFeedbackBodyBytes) {
                    Write-JsonResponse -Response $response -Object @{ ok = $false; error = 'payload_too_large' } -StatusCode 413
                    $response.OutputStream.Close()
                    continue
                }
                $payload = $rawBody | ConvertFrom-Json
                $content = [string]$payload.content
                if ([string]::IsNullOrWhiteSpace($content) -or $content.Trim().Length -lt 5) {
                    Write-JsonResponse -Response $response -Object @{ ok = $false; error = 'invalid_content' } -StatusCode 400
                    $response.OutputStream.Close()
                    continue
                }

                $list = Load-FeedbackList -Path $feedbackFile
                $ip = $request.RemoteEndPoint.Address.ToString()
                $entry = [PSCustomObject]@{
                    id = [Guid]::NewGuid().ToString('N')
                    name = ([string]$payload.name).Trim()
                    contact = ([string]$payload.contact).Trim()
                    content = $content.Trim()
                    time = ([string]$payload.time).Trim()
                    serverTime = (Get-Date).ToString("yyyy-MM-dd HH:mm:ss")
                    ip = $ip
                }

                $newList = @($entry) + @($list | Select-Object -First 2000)
                ($newList | ConvertTo-Json -Depth 8) | Set-Content -Path $feedbackFile -Encoding UTF8

                Write-Host "200 /api/feedback (POST)" -ForegroundColor Green
                Write-JsonResponse -Response $response -Object @{ ok = $true; id = $entry.id } -StatusCode 200
            } catch {
                Write-Host "500 /api/feedback (POST)" -ForegroundColor Red
                Write-JsonResponse -Response $response -Object @{ ok = $false; error = 'server_error' } -StatusCode 500
            }
            $response.OutputStream.Close()
            continue
        }
        if ($method -eq 'GET') {
            try {
                $limitRaw = $request.QueryString["limit"]
                $limit = 100
                if ($limitRaw) {
                    $parsed = 0
                    if ([int]::TryParse($limitRaw, [ref]$parsed)) {
                    if ($parsed -gt 0 -and $parsed -le 500) {
                        $limit = $parsed
                    }
                    }
                }
                $list = @(Load-FeedbackList -Path $feedbackFile | Select-Object -First $limit)
                Write-Host "200 /api/feedback (GET)" -ForegroundColor Green
                Write-JsonResponse -Response $response -Object ([PSCustomObject]@{ ok = $true; items = @($list) }) -StatusCode 200
            } catch {
                Write-Host "500 /api/feedback (GET)" -ForegroundColor Red
                Write-JsonResponse -Response $response -Object @{ ok = $false; error = 'server_error' } -StatusCode 500
            }
            $response.OutputStream.Close()
            continue
        }

        Write-JsonResponse -Response $response -Object @{ ok = $false; error = 'method_not_allowed' } -StatusCode 405
        $response.OutputStream.Close()
        continue
    }

    if ($urlPath -eq '/') { $urlPath = '/index.html' }

    $filePath = Join-Path $root ($urlPath -replace '/', '\')

    try {
        if (Test-Path $filePath -PathType Leaf) {
            $ext = [System.IO.Path]::GetExtension($filePath).ToLower()
            $contentType = $mimeTypes[$ext]
            if (-not $contentType) { $contentType = 'application/octet-stream' }

            $response.ContentType = $contentType
            $response.StatusCode = 200
            $bytes = [System.IO.File]::ReadAllBytes($filePath)
            $response.ContentLength64 = $bytes.Length
            $response.OutputStream.Write($bytes, 0, $bytes.Length)
            Write-Host "200 $urlPath" -ForegroundColor Green
        } else {
            $response.StatusCode = 404
            $msg = [System.Text.Encoding]::UTF8.GetBytes("404 Not Found")
            $response.ContentLength64 = $msg.Length
            $response.OutputStream.Write($msg, 0, $msg.Length)
            Write-Host "404 $urlPath" -ForegroundColor Red
        }
    } catch {
        try {
            $response.StatusCode = 500
            $msg = [System.Text.Encoding]::UTF8.GetBytes("500 Internal Server Error")
            $response.ContentLength64 = $msg.Length
            $response.OutputStream.Write($msg, 0, $msg.Length)
        } catch { }
        Write-Host "500 $urlPath" -ForegroundColor Red
    } finally {
        try { $response.OutputStream.Close() } catch { }
    }
}
