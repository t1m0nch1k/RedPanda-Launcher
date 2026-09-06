$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$version = (Get-Content (Join-Path $root "VERSION") -Raw).Trim()
$files = @(
  "package.json",
  "installer/package.json",
  "website/package.json",
  "src-tauri/Cargo.toml",
  "installer/src-tauri/Cargo.toml",
  "src-tauri/tauri.conf.json",
  "installer/src-tauri/tauri.conf.json"
)
foreach ($relative in $files) {
  $path = Join-Path $root $relative
  $content = Get-Content $path -Raw
  if ($relative.EndsWith(".json")) {
    $actual = ((Get-Content $path -Raw | ConvertFrom-Json).version)
  } else {
    $actual = [regex]::Match($content, '(?m)^version\s*=\s*"([^"]+)"').Groups[1].Value
  }
  if ($actual -ne $version) { throw "$relative has version '$actual', expected '$version'" }
}
if ($env:GITHUB_REF_NAME -and $env:GITHUB_REF_NAME -match '^v(.+)$' -and $Matches[1] -ne $version) {
  throw "Git tag version does not match VERSION"
}
Write-Host "Version $version is consistent across release manifests."
