# Usage: .\scripts\release.ps1 0.3.0
param (
    [Parameter(Mandatory=$true)]
    [string]$Version
)

$ErrorActionPreference = "Stop"

if ($Version -notmatch '^\d+\.\d+\.\d+(?:_fix[1-9]\d*)?$') {
    throw "Version must use MAJOR.MINOR.PATCH or a hotfix suffix such as 0.3.0_fix1"
}

$Tag = "v$Version"
$BaseVersion = $Version -replace '_fix\d+$', ''

$versionFile = Join-Path (Get-Location) "VERSION"
Set-Content -Path $versionFile -Value $BaseVersion -NoNewline

Write-Host "🚀 Начинаем релиз версии $Tag..." -ForegroundColor Cyan

# 1. Keep all executable projects and user-facing version labels in sync
$PkgJson = Get-Content package.json | ConvertFrom-Json
$PkgJson.version = $BaseVersion
$PkgJson | ConvertTo-Json -Depth 10 | Set-Content package.json

$VersionFiles = @(
    @{ Path = "package-lock.json"; Pattern = '"version"\s*:\s*"\d+\.\d+\.\d+"\s*,\s*\r?\n\s*"lockfileVersion"'; Replacement = "`"version`": `"$BaseVersion`",`n  `"lockfileVersion`"" },
    @{ Path = "website/package.json"; Pattern = '"version"\s*:\s*"[^\"]+"'; Replacement = "`"version`": `"$BaseVersion`"" },
    @{ Path = "website/package-lock.json"; Pattern = '"version"\s*:\s*"\d+\.\d+\.\d+"\s*,\s*\r?\n\s*"lockfileVersion"'; Replacement = "`"version`": `"$BaseVersion`",`n  `"lockfileVersion`"" },
    @{ Path = "website/package-lock.json"; Pattern = '"name"\s*:\s*"website"\s*,\s*\r?\n\s*"version"\s*:\s*"\d+\.\d+\.\d+"'; Replacement = "`"name`": `"website`",`n  `"version`": `"$BaseVersion`"" },
    @{ Path = "src-tauri/Cargo.toml"; Pattern = '(?m)^version\s*=\s*"[^"]+"'; Replacement = "version = `"$BaseVersion`"" },
    @{ Path = "installer/src-tauri/Cargo.toml"; Pattern = '(?m)^version\s*=\s*"[^"]+"'; Replacement = "version = `"$BaseVersion`"" },
    @{ Path = "installer/package.json"; Pattern = '"version"\s*:\s*"[^"]+"'; Replacement = "`"version`": `"$BaseVersion`"" },
    @{ Path = "installer/package-lock.json"; Pattern = '"version"\s*:\s*"\d+\.\d+\.\d+"\s*,\s*\r?\n\s*"lockfileVersion"'; Replacement = "`"version`": `"$BaseVersion`",`n  `"lockfileVersion`"" },
    @{ Path = "installer/package-lock.json"; Pattern = '"name"\s*:\s*"redpanda-installer"\s*,\s*\r?\n\s*"version"\s*:\s*"\d+\.\d+\.\d+"'; Replacement = "`"name`": `"redpanda-installer`",`n      `"version`": `"$BaseVersion`"" },
    @{ Path = "src-tauri/tauri.conf.json"; Pattern = '"version"\s*:\s*"[^"]+"'; Replacement = "`"version`": `"$BaseVersion`"" },
    @{ Path = "installer/src-tauri/tauri.conf.json"; Pattern = '"version"\s*:\s*"[^"]+"'; Replacement = "`"version`": `"$BaseVersion`"" }
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
