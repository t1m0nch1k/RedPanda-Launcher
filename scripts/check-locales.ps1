$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$localeDir = Join-Path $root "src/locales"
$files = Get-ChildItem -LiteralPath $localeDir -Filter "*.json" | Sort-Object Name
if ($files.Count -lt 2) { throw "At least two locale files are required" }

function Get-KeySet([object]$value, [string]$prefix = "") {
    $keys = [System.Collections.Generic.HashSet[string]]::new()
    foreach ($property in $value.PSObject.Properties) {
        $key = if ($prefix) { "$prefix.$($property.Name)" } else { $property.Name }
        [void]$keys.Add($key)
        if ($property.Value -is [pscustomobject]) {
            foreach ($nested in Get-KeySet $property.Value $key) { [void]$keys.Add($nested) }
        }
    }
    return $keys
}

$reference = Get-Content -LiteralPath $files[0].FullName -Raw | ConvertFrom-Json
$referenceKeys = Get-KeySet $reference
foreach ($file in $files | Select-Object -Skip 1) {
    $current = Get-Content -LiteralPath $file.FullName -Raw | ConvertFrom-Json
    $currentKeys = Get-KeySet $current
    $missing = $referenceKeys | Where-Object { -not $currentKeys.Contains($_) }
    $extra = $currentKeys | Where-Object { -not $referenceKeys.Contains($_) }
    if ($missing -or $extra) {
        throw "$($file.Name): missing [$($missing -join ', ')]; extra [$($extra -join ', ')]"
    }
}
Write-Host "Locale keys are consistent across $($files.Count) files."
