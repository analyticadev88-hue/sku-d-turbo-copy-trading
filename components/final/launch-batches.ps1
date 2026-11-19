# Launch managed MT5 terminals in verified batches.
# Default: all active accounts that are not currently running, 10 per batch.
# After each batch the script waits for every terminal's EA to confirm (heartbeat),
# prints a per-account table, and pauses for review before the next batch.
#
# Usage:
#   .\launch-batches.ps1                     # batches of 10, prompt between batches
#   .\launch-batches.ps1 -BatchSize 5        # smaller batches
#   .\launch-batches.ps1 -Auto               # all batches back-to-back
#   .\launch-batches.ps1 -Login 62591734,202527712   # specific accounts only
param(
  [int]$BatchSize = 10,
  [string[]]$Login = @(),
  [int]$ConfirmSeconds = 180,
  [switch]$Auto
)

$ErrorActionPreference = 'Stop'
$bridgeBase = 'http://127.0.0.1:8765'
$keyPath = 'C:\ProgramData\SkuD\bridge-key.dpapi'

Add-Type -AssemblyName System.Security
if (-not (Test-Path $keyPath)) { throw "Bridge key file not found: $keyPath" }
$bridgeKey = [Text.Encoding]::UTF8.GetString(
  [Security.Cryptography.ProtectedData]::Unprotect(
    [IO.File]::ReadAllBytes($keyPath), $null, [Security.Cryptography.DataProtectionScope]::LocalMachine))

function Get-BridgeAccounts {
  $response = Invoke-RestMethod -Uri "$bridgeBase/v1/accounts" -Headers @{ Authorization = "Bearer $bridgeKey" } -TimeoutSec 15
  if ($response.accounts) { return $response.accounts }
  return $response
}

function Request-Launch($targetLogin) {
  try {
    $result = Invoke-RestMethod -Method Post -Uri "$bridgeBase/v1/accounts/$targetLogin/launch" `
      -Headers @{ Authorization = "Bearer $bridgeKey" } -TimeoutSec 60
    return "launch ok: $($result.message)"
  } catch {
    return "launch failed: $($_.Exception.Message)"
  }
}

function Write-BatchTable($batchLogins) {
  $accounts = Get-BridgeAccounts
  $rows = foreach ($item in $accounts) {
    if ($batchLogins -notcontains [string]$item.login) { continue }
    $heartbeatAge = if ($item.last_seen) {
      $age = [int]([DateTimeOffset]::UtcNow.ToUnixTimeSeconds() - $item.last_seen)
      if ($age -lt 60) { "$age`s ago" } elseif ($age -lt 3600) { "{0}m ago" -f [math]::Floor($age / 60) } else { "{0}h ago" -f [math]::Floor($age / 3600) }
    } else { 'never' }
    [pscustomobject]@{
      Login      = $item.login
      Server     = $item.server
      Terminal   = if ($item.terminal_running) { 'RUNNING' } else { 'missing' }
      EA         = if ($item.ea_connected) { 'CONNECTED' } else { 'not confirmed' }
      Heartbeat  = $heartbeatAge
      BridgeNote = $item.message
    }
  }
  $rows | Format-Table -AutoSize
}

Write-Host "Reading active accounts from the bridge..."
$accounts = Get-BridgeAccounts
if ($Login.Count -gt 0) {
  $pending = @($accounts | Where-Object { $Login -contains [string]$_.login -and $_.is_active })
  $missing = $Login | Where-Object { $pending.Login -notcontains $_ }
  if ($missing) { Write-Host "Not found or inactive: $($missing -join ', ')" -ForegroundColor Yellow }
} else {
  $pending = @($accounts | Where-Object { $_.is_active -and -not $_.terminal_running })
}

if ($pending.Count -eq 0) {
  Write-Host "Nothing to launch: every requested account is already running."
  return
}

Write-Host "$($pending.Count) account(s) to launch in batches of $BatchSize.`n"
$batches = @()
for ($i = 0; $i -lt $pending.Count; $i += $BatchSize) {
  $batches += , @($pending[$i..([math]::Min($i + $BatchSize - 1, $pending.Count - 1))])
}

foreach ($batch in $batches) {
  $batchLogins = @($batch | ForEach-Object { [string]$_.login })
  Write-Host "=== Batch of $($batch.Count): $($batchLogins -join ', ') ===" -ForegroundColor Cyan

  foreach ($item in $batch) {
    $note = Request-Launch([string]$item.login)
    Write-Host ("  {0,-12} {1}" -f $item.login, $note)
  }

  $deadline = (Get-Date).AddSeconds($ConfirmSeconds)
  $allConfirmed = $false
  while ((Get-Date) -lt $deadline) {
    Start-Sleep -Seconds 10
    $state = Get-BridgeAccounts
    $allConfirmed = $true
    foreach ($target in $batchLogins) {
      $row = $state | Where-Object { [string]$_.login -eq $target }
      if (-not $row -or -not $row.terminal_running -or -not $row.ea_connected) { $allConfirmed = $false; break }
    }
    if ($allConfirmed) { break }
  }

  Write-BatchTable $batchLogins
  if ($allConfirmed) {
    Write-Host "Batch confirmed: every terminal running and EA heartbeat live.`n" -ForegroundColor Green
  } else {
    Write-Host "Batch timed out after $ConfirmSeconds`s with unconfirmed accounts - see table above.`n" -ForegroundColor Yellow
  }

  if (-not $Auto -and $batches.IndexOf($batch) -lt $batches.Count - 1) {
    $answer = Read-Host "Press Enter for the next batch, or type Q to stop"
    if ($answer -eq 'Q') { Write-Host 'Stopped by operator.'; return }
  }
}

Write-Host 'All batches processed.'
