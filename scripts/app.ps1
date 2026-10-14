<#
.SYNOPSIS
  Start / stop / restart / check the deployed Wayground clone (production mode, port 4000).

.DESCRIPTION
  start    Starts PostgreSQL if needed, builds the client and runs the server in its own
           console window ("npm run start"). The window keeps running after this script ends;
           server logs are shown there. Waits until /api/health answers.
  stop     Closes that window and every process in it. Add -Db to also stop PostgreSQL.
  restart  stop + start (rebuilds the client, so code changes go live).
  status   Database, app, Tailscale Funnel and public URL health.
  serve    Runs "npm run start" in the foreground with output appended to logs\app.log.
           Used by the boot-time scheduled task (no window there); see scripts\autostart.ps1.
  logs     Shows the last lines of logs\app.log.

.EXAMPLE
  npm run app:status
  powershell -NoProfile -ExecutionPolicy Bypass -File scripts\app.ps1 restart
#>
param(
  [ValidateSet('start', 'stop', 'restart', 'status', 'serve', 'logs')][string]$Action = 'status',
  [switch]$Db
)

$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent $PSScriptRoot
$Port = 4000
$DbPort = 5433
$Tailscale = 'C:\Program Files\Tailscale\tailscale.exe'
$LogDir = Join-Path $Root 'logs'
$LogFile = Join-Path $LogDir 'app.log'

# The public URL is machine specific and stays out of the repo: PUBLIC_URL (environment or the
# git-ignored .env at the repo root) wins, otherwise it is read from "tailscale funnel status".
function Get-PublicUrl {
  if ($env:PUBLIC_URL) { return $env:PUBLIC_URL.Trim().TrimEnd('/') }
  $envFile = Join-Path $Root '.env'
  if (Test-Path $envFile) {
    $line = Get-Content $envFile | Where-Object { $_ -match '^\s*PUBLIC_URL\s*=' } | Select-Object -First 1
    if ($line) { return ($line -replace '^\s*PUBLIC_URL\s*=\s*', '').Trim().Trim('"').TrimEnd('/') }
  }
  if (Test-Path $Tailscale) {
    $m = [regex]::Match((& $Tailscale funnel status 2>$null | Out-String), 'https://[^\s()]+')
    if ($m.Success) { return $m.Value.TrimEnd('/') }
  }
  return $null
}

function Test-Health($url) {
  try { return (Invoke-RestMethod "$url/api/health" -TimeoutSec 5).ok -eq $true } catch { return $false }
}

function Get-Listener($p) {
  Get-NetTCPConnection -State Listen -LocalPort $p -ErrorAction SilentlyContinue | Select-Object -First 1
}

function Stop-App {
  $npm = Get-CimInstance Win32_Process -Filter "Name='node.exe'" | Where-Object { $_.CommandLine -match 'npm-cli\.js"?\s+run start(\s|$)' }
  foreach ($p in $npm) {
    $parent = Get-CimInstance Win32_Process -Filter "ProcessId=$($p.ParentProcessId)"
    # "start" opens "cmd /k npm run start", "serve" runs "cmd /c npm run start >> log": end that cmd and all inside
    $target = $p.ProcessId
    if ($parent -and $parent.CommandLine -match '/[ck] .*npm run start') { $target = $parent.ProcessId }
    taskkill /PID $target /T /F | Out-Null
  }
  # a server started some other way that still holds the port
  $l = Get-Listener $Port
  if ($l) {
    $proc = Get-Process -Id $l.OwningProcess -ErrorAction SilentlyContinue
    if ($proc -and $proc.ProcessName -eq 'node') { taskkill /PID $l.OwningProcess /T /F | Out-Null }
    else { Write-Warning "Port $Port is used by $($proc.ProcessName) (PID $($l.OwningProcess)); not stopping it." }
  }
  Start-Sleep -Seconds 2
  if (Get-Listener $Port) { Write-Warning "Port $Port is still in use." } else { Write-Host "App stopped." }
  if ($Db) {
    Push-Location $Root
    try { & npm.cmd run db:stop } finally { Pop-Location }
  }
}

function Start-App {
  if (Test-Health "http://localhost:$Port") { Write-Host "App is already running: http://localhost:$Port"; return }
  if (Get-Listener $Port) { throw "Port $Port is in use but not answering /api/health. Run 'stop' first." }
  Start-Process cmd.exe -ArgumentList '/k', 'npm run start' -WorkingDirectory $Root
  Write-Host 'Starting: database, client build, server...'
  for ($i = 1; $i -le 100; $i++) {
    Start-Sleep -Seconds 3
    if (Test-Health "http://localhost:$Port") { Write-Host "App is up after ~$($i * 3)s: http://localhost:$Port"; return }
  }
  throw "App did not answer within 5 minutes. Read the 'npm run start' window for the error."
}

function Show-Status {
  $dbState = 'stopped'; if (Get-Listener $DbPort) { $dbState = 'running' }
  $appState = 'stopped'; if (Test-Health "http://localhost:$Port") { $appState = 'running' } elseif (Get-Listener $Port) { $appState = 'port in use, not healthy' }
  Write-Host "Database  (port $DbPort): $dbState"
  Write-Host "App       (port $Port): $appState"
  if (Test-Path $Tailscale) {
    Write-Host '--- Tailscale Funnel:'
    & $Tailscale funnel status
  } else { Write-Host 'Tailscale: not installed' }
  $publicUrl = Get-PublicUrl
  if ($publicUrl) {
    $pub = 'unreachable'; if (Test-Health $publicUrl) { $pub = 'ok' }
    Write-Host "Public    ($publicUrl): $pub"
  } else { Write-Host 'Public    : no Tailscale Funnel and no PUBLIC_URL in .env' }
}

function Start-Foreground {
  if (Test-Health "http://localhost:$Port") { return }
  New-Item -ItemType Directory -Force $LogDir | Out-Null
  if ((Test-Path $LogFile) -and (Get-Item $LogFile).Length -gt 5MB) { Move-Item -Force $LogFile (Join-Path $LogDir 'app.prev.log') }
  Add-Content -Encoding utf8 $LogFile "===== $(Get-Date -Format 's') start as $env:USERNAME ====="
  Push-Location $Root
  try { & cmd.exe /c "npm run start >> `"$LogFile`" 2>&1" } finally { Pop-Location }
  Add-Content -Encoding utf8 $LogFile "===== $(Get-Date -Format 's') stopped (exit $LASTEXITCODE) ====="
  exit 0 # being stopped by app.ps1 is not a failure
}

function Show-Logs {
  if (Test-Path $LogFile) { Get-Content $LogFile -Tail 60 }
  else { Write-Host "No log yet: $LogFile (when started with 'start', the log is in its window)" }
}

switch ($Action) {
  'start' { Start-App }
  'stop' { Stop-App }
  'restart' { Stop-App; Start-App }
  'status' { Show-Status }
  'serve' { Start-Foreground }
  'logs' { Show-Logs }
}
