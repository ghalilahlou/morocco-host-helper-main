# 🚀 LANCEMENT CRÉATEUR DE SIGNATURE

Write-Host ""
Write-Host "🖊️ Ouverture du créateur de signature..." -ForegroundColor Cyan
Write-Host ""

$htmlPath = Join-Path $PSScriptRoot "signature-creator.html"

if (Test-Path $htmlPath) {
    Start-Process $htmlPath
    Write-Host "✅ Fichier ouvert dans votre navigateur" -ForegroundColor Green
    Write-Host ""
    Write-Host "📋 Instructions:" -ForegroundColor Yellow
    Write-Host "  1. Dessinez votre signature sur le canvas blanc" -ForegroundColor White
    Write-Host "  2. Cliquez sur 'Générer Base64'" -ForegroundColor White
    Write-Host "  3. Le code est automatiquement copié" -ForegroundColor White
    Write-Host "  4. Passez à l'étape 2 ci-dessous" -ForegroundColor White
    Write-Host ""
} else {
    Write-Host "❌ Fichier introuvable: $htmlPath" -ForegroundColor Red
}

Write-Host "Appuyez sur une touche pour continuer..." -ForegroundColor Gray
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
