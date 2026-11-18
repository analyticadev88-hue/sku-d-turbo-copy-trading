[CmdletBinding()]
param(
    [switch]$Apply,
    [ValidateRange(1024, 20480)]
    [int]$InteractiveHeapKb = 20480,
    [ValidateRange(1, 365)]
    [int]$EventLookbackDays = 7
)

$ErrorActionPreference = 'Stop'
$registryPath = 'HKLM:\SYSTEM\CurrentControlSet\Control\Session Manager\SubSystems'
$registrySubKey = 'SYSTEM\CurrentControlSet\Control\Session Manager\SubSystems'

Write-Host ''
Write-Host 'SkuD Windows desktop-heap diagnostic' -ForegroundColor Cyan
Write-Host 'This checks the interactive desktop heap and recent Windows heap-exhaustion events.'
Write-Host 'It does not change settings unless -Apply is provided and confirmed.'
Write-Host ''

try {
    $currentValue = (Get-ItemProperty -LiteralPath $registryPath -Name Windows).Windows
} catch {
    throw "Could not read the Windows SubSystems registry value: $($_.Exception.Message)"
}

$sharedSectionMatches = [regex]::Matches(
    [string]$currentValue,
    'SharedSection=(\d+),(\d+),(\d+)'
)
if ($sharedSectionMatches.Count -ne 1) {
    throw 'Could not find exactly one three-value SharedSection setting. No changes were made.'
}

$sharedSection = $sharedSectionMatches[0]
$sharedHeapKb = [int]$sharedSection.Groups[1].Value
$interactiveHeapKbCurrent = [int]$sharedSection.Groups[2].Value
$nonInteractiveHeapKb = [int]$sharedSection.Groups[3].Value

Write-Host ("SharedSection currently: {0},{1},{2} (KB)" -f `
    $sharedHeapKb, $interactiveHeapKbCurrent, $nonInteractiveHeapKb)
Write-Host ("Managed MT5 terminal processes: {0}" -f @(
    Get-Process -Name terminal64 -ErrorAction SilentlyContinue
).Count)

$events = @()
try {
    $events = @(
        Get-WinEvent -FilterHashtable @{
            LogName = 'System'
            ProviderName = 'Win32k'
            Id = 243
            StartTime = (Get-Date).AddDays(-$EventLookbackDays)
        } -ErrorAction Stop
    )
} catch {
    if ($_.FullyQualifiedErrorId -notmatch 'NoMatchingEventsFound') {
        Write-Warning "Could not read recent Win32k event 243 entries: $($_.Exception.Message)"
    }
}

if ($events.Count -gt 0) {
    Write-Host ("Found {0} Win32k desktop-heap allocation failure event(s) in the last {1} day(s):" -f `
        $events.Count, $EventLookbackDays) -ForegroundColor Yellow
    $events | Select-Object -First 10 TimeCreated, Id, Message | Format-List
} else {
    Write-Host ("No Win32k event 243 found in the last {0} day(s)." -f $EventLookbackDays)
}

if (-not $Apply) {
    Write-Host ''
    Write-Host 'Read-only diagnostic complete. No registry settings were changed.'
    Write-Host 'If terminals fail to create windows and event 243 confirms heap exhaustion, rerun with -Apply to raise only the interactive value.'
    return
}

if ($interactiveHeapKbCurrent -gt 20480) {
    throw 'The current interactive heap exceeds Microsoft’s 20480 KB guidance. No change was made.'
}

if ($interactiveHeapKbCurrent -ge $InteractiveHeapKb) {
    Write-Host ''
    Write-Host ("No change needed: interactive desktop heap is already {0} KB or higher." -f `
        $InteractiveHeapKb) -ForegroundColor Green
    return
}

$identity = [Security.Principal.WindowsIdentity]::GetCurrent()
$principal = [Security.Principal.WindowsPrincipal]::new($identity)
if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    throw 'Run this script from an elevated PowerShell window to apply a registry change.'
}

if ($events.Count -eq 0) {
    Write-Warning 'No recent Event 243 evidence was found. Increasing the heap may not fix a terminal launch failure caused by another issue.'
}

Write-Host ''
Write-Host ("This will increase only the interactive desktop heap from {0} KB to {1} KB." -f `
    $interactiveHeapKbCurrent, $InteractiveHeapKb) -ForegroundColor Yellow
Write-Host ("The noninteractive value ({0} KB) and session 0 are not changed." -f `
    $nonInteractiveHeapKb)
$confirmation = Read-Host 'Type APPLY to back up the registry value and make this change'
if ($confirmation -cne 'APPLY') {
    Write-Host 'Cancelled. No registry settings were changed.'
    return
}

$backupDirectory = Join-Path $env:ProgramData 'SkuD\backups'
New-Item -ItemType Directory -Force -Path $backupDirectory | Out-Null
$backupPath = Join-Path $backupDirectory (
    'SubSystems-{0}.reg' -f (Get-Date -Format 'yyyyMMdd-HHmmss')
)
& reg.exe export "HKLM\$registrySubKey" $backupPath /y | Out-Null
if ($LASTEXITCODE -ne 0) {
    throw "Registry backup failed (exit code $LASTEXITCODE). No setting was changed."
}
Write-Host "Registry backup saved to $backupPath"

$newValue = [regex]::Replace(
    [string]$currentValue,
    'SharedSection=(\d+),(\d+),(\d+)',
    "SharedSection=`$1,$InteractiveHeapKb,`$3"
)
Set-ItemProperty -LiteralPath $registryPath -Name Windows -Value $newValue

$verifiedValue = (Get-ItemProperty -LiteralPath $registryPath -Name Windows).Windows
if ($verifiedValue -ne $newValue) {
    throw "Registry verification failed. Restore the backup from $backupPath before rebooting."
}

Write-Host ''
Write-Host 'Interactive desktop heap updated and verified.' -ForegroundColor Green
Write-Host 'Restart Windows/VPS during a maintenance window for the change to take effect.'
Write-Host 'MT5 terminals and services will be interrupted by that reboot.'
