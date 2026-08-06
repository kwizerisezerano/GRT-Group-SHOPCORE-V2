<#
.SYNOPSIS
    Brings the whole ShopCore stack up on Windows: MySQL, migrations, seed,
    backend and frontend.

.DESCRIPTION
    The Windows counterpart to scripts/dev-up.sh. Idempotent — safe to re-run,
    and the way to recover after a restart.

    Written for Windows PowerShell 5.1, which is what ships with Windows and
    does NOT support the '&&' operator. Everything here uses separate
    statements for that reason.

.EXAMPLE
    .\scripts\dev-up.ps1

.EXAMPLE
    .\scripts\dev-up.ps1 -Reset      # drop and recreate the database first
#>

[CmdletBinding()]
param(
    [switch]$Reset
)

$ErrorActionPreference = 'Stop'

$Root     = Split-Path -Parent $PSScriptRoot
$Backend  = Join-Path $Root 'backend'
$Frontend = Join-Path $Root 'frontend'
$DbName   = 'shopcore_v2'

function Write-Step($Message) { Write-Host "==> $Message" -ForegroundColor Cyan }
function Write-Ok  ($Message) { Write-Host "  ok $Message" -ForegroundColor Green }
function Write-Warn($Message) { Write-Host "  ! $Message"  -ForegroundColor Yellow }
function Fail      ($Message) { Write-Host "  !! $Message" -ForegroundColor Red; exit 1 }

# 32 random bytes as 64 hex characters — same shape as `openssl rand -hex 32`.
function New-HexKey {
    $bytes = New-Object byte[] 32
    $rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
    try { $rng.GetBytes($bytes) } finally { $rng.Dispose() }
    $sb = New-Object System.Text.StringBuilder
    foreach ($b in $bytes) { [void]$sb.Append($b.ToString('x2')) }
    return $sb.ToString()
}

function Test-Url($Url) {
    try {
        Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 3 | Out-Null
        return $true
    } catch {
        return $false
    }
}

function Wait-ForUrl($Url, $What, $TimeoutSeconds) {
    for ($i = 0; $i -lt $TimeoutSeconds; $i++) {
        if (Test-Url $Url) { return }
        Start-Sleep -Seconds 1
    }
    Fail "timed out after $TimeoutSeconds seconds waiting for $What"
}

# ------------------------------------------------------------------ MySQL ---
Write-Step 'MySQL'

# XAMPP is the documented setup on Windows, so look there before PATH.
$MysqlExe = $null
$candidates = @(
    'C:\xampp\mysql\bin\mysql.exe',
    'C:\Program Files\MySQL\MySQL Server 8.0\bin\mysql.exe',
    'C:\Program Files\MySQL\MySQL Server 8.4\bin\mysql.exe'
)
foreach ($candidate in $candidates) {
    if (Test-Path $candidate) { $MysqlExe = $candidate; break }
}
if (-not $MysqlExe) {
    $onPath = Get-Command mysql.exe -ErrorAction SilentlyContinue
    if ($onPath) { $MysqlExe = $onPath.Source }
}
if (-not $MysqlExe) {
    Fail "mysql.exe not found. Start XAMPP's MySQL, or install MySQL 8 and put it on PATH."
}
Write-Ok "using $MysqlExe"

# XAMPP's root has no password out of the box. This is also why Windows does
# not hit the auth_socket problem the Linux script works around.
$MysqlArgs = @('-uroot')

try {
    'SELECT 1;' | & $MysqlExe $MysqlArgs 2>&1 | Out-Null
    if ($LASTEXITCODE -ne 0) { throw 'connect failed' }
} catch {
    Fail "Cannot connect to MySQL as root. Is it running? In XAMPP Control Panel, press Start next to MySQL."
}
Write-Ok 'reachable'

# --------------------------------------------------------------- Database ---
Write-Step 'Database'
if ($Reset) {
    "DROP DATABASE IF EXISTS $DbName;" | & $MysqlExe $MysqlArgs
    Write-Ok "dropped $DbName"
}

$createSql = @"
CREATE DATABASE IF NOT EXISTS $DbName CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE DATABASE IF NOT EXISTS ${DbName}_shadow CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
"@
$createSql | & $MysqlExe $MysqlArgs
Write-Ok "$DbName ready"

# ---------------------------------------------------------------- Backend ---
Write-Step 'Backend'
Push-Location $Backend
try {
    if (-not (Test-Path 'node_modules')) {
        npm install --silent
        Write-Ok 'installed dependencies'
    }

    if (-not (Test-Path '.env')) {
        Copy-Item '.env.example' '.env'
        $env_lines = Get-Content '.env'
        $env_lines = $env_lines -replace '^DATABASE_URL=.*', "DATABASE_URL=`"mysql://root@127.0.0.1:3306/$DbName`""
        $env_lines = $env_lines -replace '^RESEND_API_KEY=.*', 'RESEND_API_KEY=""'
        Set-Content '.env' $env_lines
        Write-Ok 'created .env'
    }

    #
    # Repair, don't just create. A .env written before a secret was introduced
    # is this project's worst failure mode: the server exits at boot, the API
    # answers nothing, and the browser reports login as ECONNREFUSED or a
    # failed cross-origin request — which looks like a frontend bug.
    #
    # Only ever fills a key that is absent or blank. It must never replace one
    # that already holds a value: ENCRYPTION_KEY is what every encrypted
    # column was written with, so overwriting it turns readable data into
    # ciphertext nobody can open.
    #
    $added = @()
    foreach ($key in @('JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET', 'ENCRYPTION_KEY', 'BLIND_INDEX_KEY')) {
        $content = Get-Content '.env'
        $line = $content | Where-Object { $_ -match "^\s*$key\s*=" } | Select-Object -First 1

        $value = ''
        if ($line) {
            $value = ($line -replace "^\s*$key\s*=\s*", '').Trim('"').Trim()
        }

        if ([string]::IsNullOrWhiteSpace($value)) {
            $kept = $content | Where-Object { $_ -notmatch "^\s*$key\s*=" }
            $kept += "$key=`"$(New-HexKey)`""
            Set-Content '.env' $kept
            $added += $key
        }
    }
    if ($added.Count -gt 0) {
        Write-Ok "added missing secrets to .env: $($added -join ', ')"
    }

    npx prisma generate | Out-Null
    npx prisma migrate deploy | Out-Null
    if ($LASTEXITCODE -ne 0) { Fail 'prisma migrate deploy failed' }
    Write-Ok 'migrations applied'

    npx prisma db seed | Out-Null
    Write-Ok 'seeded reference data'
} finally {
    Pop-Location
}

if (-not (Test-Url 'http://127.0.0.1:4000/api/health')) {
    # Its own visible window, so the log is there to read when something
    # goes wrong rather than hidden in a detached process.
    Start-Process powershell -ArgumentList @(
        '-NoExit', '-Command', "Set-Location '$Backend'; npm run dev"
    )
    Wait-ForUrl 'http://127.0.0.1:4000/api/health' 'backend' 120
}
Write-Ok 'http://127.0.0.1:4000  (docs at /api/docs)'

# --------------------------------------------------------------- Frontend ---
Write-Step 'Frontend'
Push-Location $Frontend
try {
    if (-not (Test-Path 'node_modules')) {
        npm install --silent
        Write-Ok 'installed dependencies'
    }
    if (-not (Test-Path '.env')) {
        Set-Content '.env' 'VITE_ENCRYPTION_KEY="local-dev-encryption-key-not-for-production"'
        Write-Ok 'created .env'
    }
} finally {
    Pop-Location
}

if (-not (Test-Url 'http://127.0.0.1:5173/')) {
    Start-Process powershell -ArgumentList @(
        '-NoExit', '-Command', "Set-Location '$Frontend'; npm run dev"
    )
    Wait-ForUrl 'http://127.0.0.1:5173/' 'frontend' 180
}
Write-Ok 'http://127.0.0.1:5173'

Write-Host ''
Write-Step 'Stack is up. Two new windows are running the servers — leave them open.'
