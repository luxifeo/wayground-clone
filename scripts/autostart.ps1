<#
.SYNOPSIS
  Install / remove / show the scheduled tasks that start the app when Windows starts.

.DESCRIPTION
  install    Needs an elevated PowerShell (Run as administrator). Creates two tasks for the
             current user:
             - "WaygroundClone - startup": 30 s after boot, whether or not anyone is logged on,
               without storing a password (S4U logon). Runs "app.ps1 serve"; log in logs\app.log.
             - "WaygroundClone - logon": 2 min after you log on. Fallback in case the boot task
               could not start (for example the domain was unreachable). Runs "app.ps1 start",
               which does nothing when the app is already up.
             Both run as you, so "npm run app:stop" / "app:restart" keep working.
  uninstall  Removes both tasks (needs elevation too).
  status     Shows both tasks and their last result.

.EXAMPLE
  powershell -NoProfile -ExecutionPolicy Bypass -File scripts\autostart.ps1 install
#>
param([ValidateSet('install', 'uninstall', 'status')][string]$Action = 'status')

$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent $PSScriptRoot
$App = Join-Path $PSScriptRoot 'app.ps1'
$User = [Security.Principal.WindowsIdentity]::GetCurrent().Name
$BootTask = 'WaygroundClone - startup'
$LogonTask = 'WaygroundClone - logon'

function New-AppAction($verb) {
  New-ScheduledTaskAction -Execute 'powershell.exe' -WorkingDirectory $Root `
    -Argument "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$App`" $verb"
}

function Install-Tasks {
  # boot: long running (the task stays "Running" while the app runs), no time limit
  $boot = New-ScheduledTaskTrigger -AtStartup
  $boot.Delay = 'PT30S'
  Register-ScheduledTask -TaskName $BootTask -Force `
    -Description 'Starts the Wayground clone (DB + build + server on port 4000) at boot. Log: logs\app.log' `
    -Action (New-AppAction 'serve') -Trigger $boot `
    -Principal (New-ScheduledTaskPrincipal -UserId $User -LogonType S4U -RunLevel Limited) `
    -Settings (New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable `
      -ExecutionTimeLimit ([TimeSpan]::Zero) -MultipleInstances IgnoreNew) | Out-Null

  # logon fallback: later than the boot task so they do not both start the app
  $logon = New-ScheduledTaskTrigger -AtLogOn -User $User
  $logon.Delay = 'PT2M'
  Register-ScheduledTask -TaskName $LogonTask -Force `
    -Description 'Starts the Wayground clone in a window at logon if it is not already running.' `
    -Action (New-AppAction 'start') -Trigger $logon `
    -Principal (New-ScheduledTaskPrincipal -UserId $User -LogonType Interactive -RunLevel Limited) `
    -Settings (New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries `
      -ExecutionTimeLimit (New-TimeSpan -Minutes 10) -MultipleInstances IgnoreNew) | Out-Null

  Write-Host "Installed '$BootTask' and '$LogonTask' for $User."
}

function Uninstall-Tasks {
  foreach ($t in $BootTask, $LogonTask) {
    if (Get-ScheduledTask -TaskName $t -ErrorAction SilentlyContinue) { Unregister-ScheduledTask -TaskName $t -Confirm:$false; Write-Host "Removed '$t'." }
  }
}

function Show-Tasks {
  $tasks = Get-ScheduledTask -TaskName 'WaygroundClone*' -ErrorAction SilentlyContinue
  if (-not $tasks) { Write-Host 'No autostart task installed.'; return }
  $tasks | ForEach-Object {
    $i = $_ | Get-ScheduledTaskInfo
    [pscustomobject]@{ Task = $_.TaskName; State = $_.State; LastRun = $i.LastRunTime; LastResult = ('0x{0:X}' -f $i.LastTaskResult); RunAs = $_.Principal.UserId; Logon = $_.Principal.LogonType }
  } | Format-Table -AutoSize
}

switch ($Action) {
  'install' { Install-Tasks }
  'uninstall' { Uninstall-Tasks }
  'status' { Show-Tasks }
}
