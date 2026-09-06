param(
    [Parameter(Mandatory = $true)][string]$Version,
    [Parameter(Mandatory = $true)][string]$OutputDir
)

$ErrorActionPreference = "Stop"
$assetName = "RedPanda_Setup_${Version}.exe"
$assetPath = Join-Path $OutputDir $assetName
$manifestPath = Join-Path $OutputDir "update-manifest.json"
$signaturePath = Join-Path $OutputDir "update-manifest.json.sig"

if (-not (Test-Path -LiteralPath $assetPath)) {
    throw "Installer asset not found: $assetPath"
}
if ([string]::IsNullOrWhiteSpace($env:REDPANDA_UPDATE_SIGNING_PRIVATE_KEY_PEM)) {
    throw "REDPANDA_UPDATE_SIGNING_PRIVATE_KEY_PEM is required for a production release"
}
if ([string]::IsNullOrWhiteSpace($env:REDPANDA_UPDATE_KEY_ID)) {
    throw "REDPANDA_UPDATE_KEY_ID is required for a production release"
}

$hash = (Get-FileHash -Algorithm SHA256 -LiteralPath $assetPath).Hash.ToLowerInvariant()
$size = (Get-Item -LiteralPath $assetPath).Length
$manifest = [ordered]@{
    version = $Version
    assetName = $assetName
    sha256 = $hash
    size = $size
    downloadUrl = "https://github.com/t1m0nch1k/RedPanda-Launcher/releases/download/v${Version}/${assetName}"
    keyId = $env:REDPANDA_UPDATE_KEY_ID
}

$json = $manifest | ConvertTo-Json -Compress
[System.IO.File]::WriteAllText($manifestPath, $json, [System.Text.UTF8Encoding]::new($false))

$keyPath = Join-Path $env:TEMP "redpanda-update-key-$([guid]::NewGuid()).pem"
try {
    [System.IO.File]::WriteAllText($keyPath, $env:REDPANDA_UPDATE_SIGNING_PRIVATE_KEY_PEM, [System.Text.UTF8Encoding]::new($false))
    & openssl pkeyutl -sign -rawin -inkey $keyPath -in $manifestPath -out $signaturePath
    if ($LASTEXITCODE -ne 0) { throw "openssl failed to sign update manifest" }
    $signature = [Convert]::ToBase64String([System.IO.File]::ReadAllBytes($signaturePath))
    [System.IO.File]::WriteAllText($signaturePath, $signature, [System.Text.UTF8Encoding]::new($false))
}
finally {
    Remove-Item -LiteralPath $keyPath -Force -ErrorAction SilentlyContinue
}
