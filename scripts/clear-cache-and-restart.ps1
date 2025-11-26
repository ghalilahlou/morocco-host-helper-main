# Script PowerShell pour vider le cache Vite et redémarrer le serveur
# Utilisation: .\scripts\clear-cache-and-restart.ps1

Write-Host "🧹 Nettoyage du cache Vite..." -ForegroundColor Yellow

# Supprimer le cache Vite
$viteCachePath = "node_modules\.vite"
if (Test-Path $viteCachePath) {
    Remove-Item -Recurse -Force $viteCachePath -ErrorAction SilentlyContinue
    Write-Host "✅ Cache Vite supprimé" -ForegroundColor Green
} else {
    Write-Host "ℹ️  Cache Vite introuvable (déjà vide)" -ForegroundColor Cyan
}

# Supprimer le cache dist si existe
$distPath = "dist"
if (Test-Path $distPath) {
    Remove-Item -Recurse -Force $distPath -ErrorAction SilentlyContinue
    Write-Host "✅ Dossier dist supprimé" -ForegroundColor Green
}

# Vérifier que les modifications sont présentes
Write-Host "`n🔍 Vérification des modifications..." -ForegroundColor Yellow

$bookingWizardPath = "src\components\BookingWizard.tsx"
if (Test-Path $bookingWizardPath) {
    $content = Get-Content $bookingWizardPath -Raw
    if ($content -match "CRÉER CETTE RÉSERVATION") {
        Write-Host "✅ Modification du bouton détectée dans BookingWizard.tsx" -ForegroundColor Green
    } else {
        Write-Host "❌ Modification du bouton NON trouvée dans BookingWizard.tsx" -ForegroundColor Red
    }
    
    if ($content -match "TEST MODIFICATION") {
        Write-Host "✅ Logs de test détectés dans BookingWizard.tsx" -ForegroundColor Green
    } else {
        Write-Host "❌ Logs de test NON trouvés dans BookingWizard.tsx" -ForegroundColor Red
    }
} else {
    Write-Host "❌ BookingWizard.tsx introuvable" -ForegroundColor Red
}

$documentUploadPath = "src\components\wizard\DocumentUploadStep.tsx"
if (Test-Path $documentUploadPath) {
    $content = Get-Content $documentUploadPath -Raw
    if ($content -match "editingGuest &&") {
        Write-Host "✅ Dialog conditionnel détecté dans DocumentUploadStep.tsx" -ForegroundColor Green
    } else {
        Write-Host "❌ Dialog conditionnel NON trouvé dans DocumentUploadStep.tsx" -ForegroundColor Red
    }
    
    if ($content -match "TEST MODIFICATION") {
        Write-Host "✅ Logs de test détectés dans DocumentUploadStep.tsx" -ForegroundColor Green
    } else {
        Write-Host "❌ Logs de test NON trouvés dans DocumentUploadStep.tsx" -ForegroundColor Red
    }
} else {
    Write-Host "❌ DocumentUploadStep.tsx introuvable" -ForegroundColor Red
}

Write-Host "`n📝 Instructions:" -ForegroundColor Cyan
Write-Host "1. Redémarrer le serveur: npm run dev" -ForegroundColor White
Write-Host "2. Vider le cache du navigateur (Ctrl+Shift+Delete)" -ForegroundColor White
Write-Host "3. Recharger la page avec Ctrl+Shift+R (hard refresh)" -ForegroundColor White
Write-Host "4. Vérifier dans la console:" -ForegroundColor White
Write-Host "   - Log bleu: '🔵 [TEST MODIFICATION] BookingWizard chargé...'" -ForegroundColor White
Write-Host "   - Log vert: '🟢 [TEST MODIFICATION] DocumentUploadStep chargé...'" -ForegroundColor White
Write-Host "5. Vérifier que le bouton affiche: '🚀 CRÉER CETTE RÉSERVATION (TEST MODIFICATION)'" -ForegroundColor White

Write-Host "`n✅ Nettoyage terminé !" -ForegroundColor Green


