# Usage: .\scripts\release.ps1 0.2.2
param (
    [Parameter(Mandatory=$true)]
    [string]$Version
)

$ErrorActionPreference = "Stop"

if ($Version -notmatch '^\d+\.\d+\.\d+$') {
    throw "Version must use semantic versioning, for example 0.2.2"
}

$Tag = "v$Version"

Write-Host "🚀 Начинаем релиз версии $Tag..." -ForegroundColor Cyan

# 1. Keep all executable projects and user-facing version labels in sync
$PkgJson = Get-Content package.json | ConvertFrom-Json
$PkgJson.version = $Version
$PkgJson | ConvertTo-Json -Depth 10 | Set-Content package.json

$VersionFiles = @(
    @{ Path = "src-tauri/Cargo.toml"; Pattern = '(?m)^version\s*=\s*"[^"]+"'; Replacement = "version = `"$Version`"" },
    @{ Path = "installer/src-tauri/Cargo.toml"; Pattern = '(?m)^version\s*=\s*"[^"]+"'; Replacement = "version = `"$Version`"" },
    @{ Path = "installer/package.json"; Pattern = '"version"\s*:\s*"[^"]+"'; Replacement = "`"version`": `"$Version`"" },
    @{ Path = "installer/package-lock.json"; Pattern = '"version"\s*:\s*"\d+\.\d+\.\d+"\s*,\s*\r?\n\s*"lockfileVersion"'; Replacement = "`"version`": `"$Version`",`n  `"lockfileVersion`"" },
    @{ Path = "installer/package-lock.json"; Pattern = '"name"\s*:\s*"redpanda-installer"\s*,\s*\r?\n\s*"version"\s*:\s*"\d+\.\d+\.\d+"'; Replacement = "`"name`": `"redpanda-installer`",`n      `"version`": `"$Version`"" },
    @{ Path = "src-tauri/tauri.conf.json"; Pattern = '"version"\s*:\s*"[^"]+"'; Replacement = "`"version`": `"$Version`"" },
    @{ Path = "installer/src-tauri/tauri.conf.json"; Pattern = '"version"\s*:\s*"[^"]+"'; Replacement = "`"version`": `"$Version`"" },
    @{ Path = "src-tauri/src/updater.rs"; Pattern = 'CURRENT_VERSION: &str = "[^"]+"'; Replacement = "CURRENT_VERSION: &str = `"$Version`"" },
    @{ Path = "src-tauri/src/updater.rs"; Pattern = 'RedPandaLauncher/\d+\.\d+\.\d+'; Replacement = "RedPandaLauncher/$Version" },
    @{ Path = "src/App.tsx"; Pattern = 'v\d+\.\d+\.\d+ Stable'; Replacement = "v$Version Stable" },
    @{ Path = "src/components/SettingsModal.tsx"; Pattern = 'Версия v\d+\.\d+\.\d+ Stable'; Replacement = "Версия v$Version Stable" },
    @{ Path = "src/components/SettingsModal.tsx"; Pattern = 'current_version \|\| "\d+\.\d+\.\d+"'; Replacement = "current_version || `"$Version`"" },
    @{ Path = "scripts/build-custom-installer.ps1"; Pattern = '\[string\]\$Version = "\d+\.\d+\.\d+"'; Replacement = "[string]`$Version = `"$Version`"" }
)

foreach ($item in $VersionFiles) {
    $filePath = Join-Path (Get-Location) $item.Path
    $content = Get-Content $filePath -Raw
    if (-not [regex]::IsMatch($content, $item.Pattern)) {
        throw "Version marker was not found in $($item.Path)"
    }
    $updated = [regex]::Replace($content, $item.Pattern, $item.Replacement, 1)
    Set-Content -Path $filePath -Value $updated -NoNewline
}

# 2. Git stage, commit and tag
git add .
git commit -m "bump: release $Tag"
git tag -a $Tag -m "Release $Tag"

# 3. Push commits and tag to GitHub
git push origin HEAD
git push origin $Tag

Write-Host "✅ Тег $Tag успешно создан и запушен!" -ForegroundColor Green
Write-Host "🤖 Если у вас настроен GitHub Token / Actions, релиз соберётся автоматически." -ForegroundColor Yellow
