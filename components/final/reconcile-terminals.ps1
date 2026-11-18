[CmdletBinding()]
param(
    [string]$BridgeUrl = 'http://127.0.0.1:8765',
    [switch]$RecoverMissing
)

$ErrorActionPreference = 'Stop'
$keyPath = Join-Path $env:ProgramData 'SkuD\bridge-key.dpapi'
if (-not (Test-Path -LiteralPath $keyPath -PathType Leaf)) {
    throw "Bridge key not found at $keyPath. Run this script as the Windows user that starts the bridge."
}

$protectedValue = (Get-Content -Raw -LiteralPath $keyPath).Trim()
$secureKey = ConvertTo-SecureString -String $protectedValue
$pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secureKey)
try {
    $bridgeKey = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer)
} finally {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer)
}

$headers = @{ Authorization = "Bearer $bridgeKey" }
$baseUrl = $BridgeUrl.TrimEnd('/')
try {
    $report = Invoke-RestMethod -Uri "$baseUrl/v1/accounts?fresh=1" -Headers $headers -TimeoutSec 20
} catch {
    throw "Could not read bridge account status at $baseUrl. Confirm the bridge is running and this is the Windows user that owns its DPAPI key. Details: $($_.Exception.Message)"
} finally {
    $bridgeKey = $null
    $secureKey = $null
}

$activeAccounts = @($report.accounts | Where-Object { $_.is_active })
$runningAccounts = @($activeAccounts | Where-Object { $_.terminal_running })
$missingAccounts = @($activeAccounts | Where-Object { -not $_.terminal_running })
$connectedAccounts = @($activeAccounts | Where-Object { $_.ea_connected })

Write-Host ''
Write-Host 'SkuD active-account reconciliation' -ForegroundColor Cyan
Write-Host "Active accounts: $($activeAccounts.Count) | Running MT5 processes: $($runningAccounts.Count) | Missing processes: $($missingAccounts.Count) | Fresh EA-connected: $($connectedAccounts.Count)"
Write-Host 'A running process is not proof of a successful broker login; EA status is reported separately.'

$now = [DateTimeOffset]::UtcNow.ToUnixTimeSeconds()
$rows = foreach ($account in $activeAccounts) {
    $heartbeat = 'never'
    if ($null -ne $account.last_seen) {
        $seenAt = [DateTimeOffset]::FromUnixTimeSeconds([long][double]$account.last_seen)
        $ageSeconds = $now - $seenAt.ToUnixTimeSeconds()
        $heartbeat = '{0} ({1}s ago)' -f $seenAt.ToLocalTime().ToString('yyyy-MM-dd HH:mm:ss'), $ageSeconds
    }

    [PSCustomObject]@{
        Login = $account.login
        Server = $account.server
        Terminal = if ($account.terminal_running) { 'RUNNING' } else { 'MISSING' }
        EA = if ($account.ea_connected) { 'CONNECTED' } else { $account.state }
        LastHeartbeat = $heartbeat
    }
}
$rows | Format-Table -AutoSize -Wrap

if (-not $RecoverMissing) {
    Write-Host 'Read-only report complete. No terminals were started or stopped.'
    Write-Host 'To launch only currently missing active accounts, run: .\reconcile-terminals.ps1 -RecoverMissing'
    return
}

if ($missingAccounts.Count -eq 0) {
    Write-Host 'No missing active-account terminals; nothing to recover.' -ForegroundColor Green
    return
}

Write-Host ''
Write-Host 'The bridge will re-check process state and launch only active logins that are still missing.' -ForegroundColor Yellow
$missingAccounts | Select-Object login, server | Format-Table -AutoSize
$confirmation = Read-Host 'Type LAUNCH to continue'
if ($confirmation -cne 'LAUNCH') {
    Write-Host 'Recovery cancelled. No terminals were started or stopped.'
    return
}

try {
    $recovery = Invoke-RestMethod -Method Post -Uri "$baseUrl/v1/terminals/reconcile" -Headers $headers -TimeoutSec 300
} catch {
    throw "Bridge recovery failed. No process was deliberately stopped. Details: $($_.Exception.Message)"
}

Write-Host ''
Write-Host ("Recovery result: {0} active, {1} already running, {2} launch requested, {3} in progress, {4} failed." -f `
    $recovery.active_accounts, $recovery.already_running, $recovery.launch_requested, $recovery.in_progress, $recovery.failed)
$recovery.results | Format-Table login, status, message -AutoSize -Wrap
Write-Host 'A launch request is not a successful broker login. Allow MT5 time to connect, then rerun the report to check EA heartbeats.'
