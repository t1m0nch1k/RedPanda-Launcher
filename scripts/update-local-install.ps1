$ErrorActionPreference = 'Stop'
$sourceExe = 'C:\Users\artem\Desktop\RedPanda Launcher\src-tauri\target\release\redpanda-launcher.exe'
$installDir = Join-Path $env:LOCALAPPDATA 'Programs\RedPanda Launcher'
$installedExe = Join-Path $installDir 'redpanda-launcher.exe'
$manifestPath = Join-Path $installDir '.redpanda-install.json'

if (-not (Test-Path $sourceExe)) {
    throw "Source executable not found at $sourceExe"
}

if (-not (Test-Path $installedExe)) {
    throw "Installed executable not found at $installedExe"
}

# Stop any running processes
$running = Get-Process -Name "redpanda-launcher" -ErrorAction SilentlyContinue
if ($running) {
    Write-Host "Stopping running RedPanda Launcher process..."
    $running | Stop-Process -Force
    Start-Sleep -Seconds 1
}

# Backup old binary
$backupExe = Join-Path $installDir 'redpanda-launcher.exe.bak'
Copy-Item -LiteralPath $installedExe -Destination $backupExe -Force

# Copy new binary
Copy-Item -LiteralPath $sourceExe -Destination $installedExe -Force

# Update manifest
if (Test-Path $manifestPath) {
    $manifest = Get-Content -LiteralPath $manifestPath -Raw | ConvertFrom-Json
    $record = @($manifest.files | Where-Object { $_.path -eq 'redpanda-launcher.exe' })
    if ($record.Count -gt 0) {
        $newHash = (Get-FileHash -LiteralPath $installedExe -Algorithm SHA256).Hash.ToLowerInvariant()
        $record[0].sha256 = $newHash
        $record[0].size = (Get-Item -LiteralPath $installedExe).Length
        [IO.File]::WriteAllText($manifestPath, ($manifest | ConvertTo-Json -Depth 10), [Text.UTF8Encoding]::new($false))
    }
}

$finalHash = (Get-FileHash -LiteralPath $installedExe -Algorithm SHA256).Hash
Write-Host "=============================================" -ForegroundColor Green
Write-Host " SUCCESS: RedPanda Launcher successfully updated!" -ForegroundColor Green
Write-Host " Path: $installedExe" -ForegroundColor Green
Write-Host " SHA256: $finalHash" -ForegroundColor Green
Write-Host " Size: $([math]::Round((Get-Item $installedExe).Length / 1MB, 2)) MB" -ForegroundColor Green
Write-Host "=============================================" -ForegroundColor Green
