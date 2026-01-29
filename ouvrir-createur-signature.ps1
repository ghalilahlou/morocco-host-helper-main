# 🖊️ Script de Lancement du Créateur de Signature
# Lance signature-creator.html dans le navigateur par défaut

Write-Host "🖊️ Lancement du créateur de signature..." -ForegroundColor Cyan
Write-Host ""

$htmlFile = Join-Path $PSScriptRoot "signature-creator.html"

if (Test-Path $htmlFile) {
    Write-Host "✅ Fichier trouvé: $htmlFile" -ForegroundColor Green
    Write-Host ""
    Write-Host "📖 Instructions:" -ForegroundColor Yellow
    Write-Host "   1. Dessinez votre signature sur le canvas" -ForegroundColor White
    Write-Host "   2. Cliquez sur 'Générer Base64'" -ForegroundColor White
    Write-Host "   3. Le Base64 sera copié automatiquement" -ForegroundColor White
    Write-Host "   4. Collez-le dans scripts/ajouter-signature-vraie.sql" -ForegroundColor White
    Write-Host ""
    Write-Host "🌐 Ouverture dans le navigateur..." -ForegroundColor Cyan
    
    Start-Process $htmlFile
    
    Write-Host "✅ Créateur de signature ouvert!" -ForegroundColor Green
} else {
    Write-Host "❌ Erreur: signature-creator.html introuvable" -ForegroundColor Red
    Write-Host "   Chemin attendu: $htmlFile" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Appuyez sur une touche pour continuer..." -ForegroundColor Gray
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
