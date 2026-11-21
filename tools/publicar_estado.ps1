# Lee la batería del anillo, actualiza status.json y lo publica en GitHub Pages.
# Uso: powershell -File tools\publicar_estado.ps1
$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
Set-Location $root
python "$root\tools\ring.py" estado
git add status.json
git diff --cached --quiet
if ($LASTEXITCODE -ne 0) {
    git commit -q -m "Estado del anillo: batería actualizada"
    git push -q
    Write-Host "Publicado. La página se actualiza en ~1 minuto."
} else {
    Write-Host "Sin cambios que publicar."
}
