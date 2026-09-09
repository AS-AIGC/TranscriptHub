$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

# Prefer the local Node 20 runtime (downloaded) to match backend dependency requirements.
$nodeDir = Join-Path $root "node-v20.19.5-win-x64"
$nodeExe = Join-Path $nodeDir "node.exe"
$npmCmd = Join-Path $nodeDir "npm.cmd"

if (!(Test-Path $nodeExe)) {
  Write-Host "Missing $nodeExe"
  Write-Host "Download Node.js v20.19.5 (win-x64 zip) into $root, or run the download step from the setup instructions."
  exit 1
}

Write-Host "Node: $(& $nodeExe -v)"

if (!(Test-Path (Join-Path $root "node_modules"))) {
  Write-Host "Installing npm dependencies..."
  & $npmCmd install
}

Write-Host "Migrating DB schema (idempotent)..."
& $nodeExe (Join-Path $root "scripts\\db-migrate.js")
if ($LASTEXITCODE -ne 0) {
  Write-Host "DB migration failed."
  exit $LASTEXITCODE
}

Write-Host "Starting backend (HTTPS) ..."
& $nodeExe (Join-Path $root "main.js")
