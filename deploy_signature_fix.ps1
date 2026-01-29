# Script de déploiement de la correction signature guest dans fiche de police
# Date: 2026-01-12

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  DÉPLOIEMENT CORRECTION SIGNATURE GUEST" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Vérifier que nous sommes dans le bon répertoire
$currentDir = Get-Location
if (-not (Test-Path "supabase/functions/submit-guest-info-unified/index.ts")) {
    Write-Host "❌ ERREUR: Ce script doit être exécuté depuis la racine du projet" -ForegroundColor Red
    Write-Host "Répertoire actuel: $currentDir" -ForegroundColor Yellow
    exit 1
}

Write-Host "✅ Répertoire correct: $currentDir" -ForegroundColor Green
Write-Host ""

# Afficher un résumé des modifications
Write-Host "📋 RÉSUMÉ DES MODIFICATIONS:" -ForegroundColor Yellow
Write-Host "  - Récupération signature guest depuis contract_signatures" -ForegroundColor White
Write-Host "  - Passage signature à generatePoliceFormsPDF" -ForegroundColor White
Write-Host "  - Affichage signature dans PDF (169 lignes ajoutées)" -ForegroundColor White
Write-Host "  - Nouvelle action: regenerate_police_with_signature" -ForegroundColor White
Write-Host ""

# Demander confirmation
Write-Host "⚠️  ATTENTION: Cette modification va déployer submit-guest-info-unified" -ForegroundColor Yellow
$confirm = Read-Host "Voulez-vous continuer? (o/n)"

if ($confirm -ne "o" -and $confirm -ne "O") {
    Write-Host "❌ Déploiement annulé" -ForegroundColor Red
    exit 0
}

Write-Host ""
Write-Host "🚀 Démarrage du déploiement..." -ForegroundColor Cyan
Write-Host ""

# Déployer la fonction
Write-Host "📦 Déploiement de submit-guest-info-unified..." -ForegroundColor Yellow
try {
    supabase functions deploy submit-guest-info-unified
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Fonction déployée avec succès!" -ForegroundColor Green
    } else {
        Write-Host "❌ Erreur lors du déploiement (code: $LASTEXITCODE)" -ForegroundColor Red
        exit 1
    }
} catch {
    Write-Host "❌ ERREUR: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  ✅ DÉPLOIEMENT TERMINÉ" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "📝 PROCHAINES ÉTAPES:" -ForegroundColor Yellow
Write-Host ""
Write-Host "1. Vérifier les logs:" -ForegroundColor White
Write-Host "   supabase functions logs submit-guest-info-unified --follow" -ForegroundColor Cyan
Write-Host ""
Write-Host "2. Tester avec un nouveau guest:" -ForegroundColor White
Write-Host "   - Soumettre un guest via le formulaire" -ForegroundColor Gray
Write-Host "   - Le guest signe le contrat" -ForegroundColor Gray
Write-Host "   - Vérifier que la fiche de police contient les 2 signatures" -ForegroundColor Gray
Write-Host ""
Write-Host "3. Régénérer les fiches existantes (si nécessaire):" -ForegroundColor White
Write-Host "   - Exécuter scripts/identify_police_forms_to_regenerate.sql" -ForegroundColor Gray
Write-Host "   - Utiliser l'action 'regenerate_police_with_signature'" -ForegroundColor Gray
Write-Host ""
Write-Host "📚 Documentation complète:" -ForegroundColor Yellow
Write-Host "   CORRECTION_SIGNATURE_GUEST_POLICE_APPLIQUEE.md" -ForegroundColor Cyan
Write-Host ""
Write-Host "🎉 Correction appliquée avec succès!" -ForegroundColor Green
Write-Host ""
