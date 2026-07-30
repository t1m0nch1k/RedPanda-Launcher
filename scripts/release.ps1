# Usage: .\scripts\release.ps1 0.1.5
param (
    [Parameter(Mandatory=$true)]
    [string]$Version
)

$Tag = "v$Version"

Write-Host "🚀 Начинаем релиз версии $Tag..." -ForegroundColor Cyan

# 1. Update version in package.json, Cargo.toml, tauri.conf.json, updater.rs, App.tsx
$PkgJson = Get-Content package.json | ConvertFrom-Json
$PkgJson.version = $Version
$PkgJson | ConvertTo-Json -Depth 10 | Set-Content package.json

# 2. Git stage, commit and tag
git add .
git commit -m "bump: release $Tag"
git tag -a $Tag -m "Release $Tag"

# 3. Push commits and tag to GitHub
git push origin HEAD:main HEAD:redesign-cyber-brutalism
git push origin $Tag

Write-Host "✅ Тег $Tag успешно создан и запушен!" -ForegroundColor Green
Write-Host "🤖 Если у вас настроен GitHub Token / Actions, релиз соберётся автоматически." -ForegroundColor Yellow
