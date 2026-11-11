# Membuat ZIP untuk diunggah ke Microsoft Edge Add-ons (dan Chrome Web Store).
# Pemakaian: pwsh ./pack.ps1   -> dist/input-kib-e-<versi>.zip
$ErrorActionPreference = 'Stop'
$root = $PSScriptRoot
$manifest = Get-Content (Join-Path $root 'manifest.json') -Raw | ConvertFrom-Json
$version = $manifest.version

# Hanya file yang dibutuhkan extension. template/, graft/, dist/, store/ tidak ikut.
$include = @('manifest.json', 'background.js', 'content', 'panel', 'lib', 'icons')

$dist = Join-Path $root 'dist'
$stage = Join-Path $dist 'stage'
if (Test-Path $stage) { Remove-Item $stage -Recurse -Force }
New-Item -ItemType Directory -Force $stage | Out-Null
foreach ($item in $include) { Copy-Item (Join-Path $root $item) -Destination $stage -Recurse }

$zip = Join-Path $dist "input-kib-e-$version.zip"
if (Test-Path $zip) { Remove-Item $zip -Force }
Compress-Archive -Path (Join-Path $stage '*') -DestinationPath $zip
Remove-Item $stage -Recurse -Force
Write-Output "Selesai: $zip ($([math]::Round((Get-Item $zip).Length / 1KB)) KB)"
