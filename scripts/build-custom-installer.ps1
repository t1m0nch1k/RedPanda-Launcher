# Build RedPanda Launcher v0.2.0 Custom GUI Installer
param(
    [string]$Version = "0.2.0"
)

$ErrorActionPreference = "Stop"

Write-Host "==================================================" -ForegroundColor Cyan
Write-Host "  RedPanda Launcher v$Version Custom Installer Build" -ForegroundColor Cyan
Write-Host "==================================================" -ForegroundColor Cyan

$RootDir = Get-Location
$PayloadDir = Join-Path $RootDir "installer\src-tauri\payload_staging"
$PayloadZip = Join-Path $RootDir "installer\src-tauri\payload.zip"
$OutDir = Join-Path $RootDir "release_output"

# 1. Clean previous staging
if (Test-Path $PayloadDir) {
    Remove-Item -Recurse -Force $PayloadDir
}
New-Item -ItemType Directory -Force -Path $PayloadDir | Out-Null
New-Item -ItemType Directory -Force -Path $OutDir | Out-Null

# 2. Build RedPanda Launcher
Write-Host "`n[1/4] Building RedPanda Launcher Release Binary..." -ForegroundColor Yellow
npm run tauri build -- --no-bundle

$LauncherExe = Join-Path $RootDir "src-tauri\target\release\redpanda-launcher.exe"
if (-not (Test-Path $LauncherExe)) {
    throw "redpanda-launcher.exe was not found at $LauncherExe"
}

# 3. Stage payload
Write-Host "`n[2/4] Packaging payload into zip archive..." -ForegroundColor Yellow
Copy-Item -Path $LauncherExe -Destination (Join-Path $PayloadDir "redpanda-launcher.exe") -Force

if (Test-Path "src-tauri\icons") {
    $IconsDest = Join-Path $PayloadDir "icons"
    New-Item -ItemType Directory -Force -Path $IconsDest | Out-Null
    Copy-Item -Path "src-tauri\icons\*" -Destination $IconsDest -Recurse -Force
}

if (Test-Path $PayloadZip) {
    Remove-Item -Force $PayloadZip
}

# Compress payload to payload.zip
Compress-Archive -Path "$PayloadDir\*" -DestinationPath $PayloadZip -CompressionLevel Optimal
Write-Host "Payload archive created: $([math]::Round((Get-Item $PayloadZip).Length / 1MB, 2)) MB" -ForegroundColor Green

# Clean up staging dir
Remove-Item -Recurse -Force $PayloadDir

# 4. Build Custom GUI Installer
Write-Host "`n[3/4] Building Custom GUI Installer Frontend & Binary with Embedded UI..." -ForegroundColor Yellow
npm --prefix installer run tauri build -- --no-bundle

$InstallerExe = Join-Path $RootDir "installer\src-tauri\target\release\redpanda-installer.exe"
if (-not (Test-Path $InstallerExe)) {
    throw "Installer binary was not found at $InstallerExe"
}

# 5. Copy final release setup
$FinalSetupExe = Join-Path $OutDir "RedPanda_Setup_${Version}.exe"
Copy-Item -Path $InstallerExe -Destination $FinalSetupExe -Force

Write-Host "`n==================================================" -ForegroundColor Green
Write-Host "  SUCCESS: Custom Installer Generated!" -ForegroundColor Green
Write-Host "  File: $FinalSetupExe" -ForegroundColor Green
Write-Host "  Size: $([math]::Round((Get-Item $FinalSetupExe).Length / 1MB, 2)) MB" -ForegroundColor Green
Write-Host "==================================================" -ForegroundColor Green
