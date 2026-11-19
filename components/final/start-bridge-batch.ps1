# Start the bridge in batch bring-up mode: only the first batch of managed
# terminals is launched at boot; press Enter in the bridge window to launch
# the next batch once the current one has been reviewed.
#
# Usage:
#   .\start-bridge-batch.ps1              # batches of 10
#   .\start-bridge-batch.ps1 -BatchSize 5 # smaller batches
param(
  [int]$BatchSize = 10
)

$env:SKUD_BOOT_BATCH_SIZE = [string]$BatchSize
& $PSScriptRoot\start-bridge.ps1 @args
