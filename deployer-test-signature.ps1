# 🚀 Script de Déploiement Rapide - Test Signature

Write-Host ""
Write-Host "🚀 DÉPLOIEMENT TEST - Signature Loueur Positionnée en Haut" -ForegroundColor Cyan
Write-Host "=" * 70 -ForegroundColor Gray
Write-Host ""

# Vérifier que Supabase CLI est installé
Write-Host "🔍 Vérification de Supabase CLI..." -ForegroundColor Yellow
$supabaseInstalled = Get-Command supabase -ErrorAction SilentlyContinue

if (-not $supabaseInstalled) {
    Write-Host "❌ Supabase CLI n'est pas installé!" -ForegroundColor Red
    Write-Host ""
    Write-Host "📦 Installation requise:" -ForegroundColor Yellow
    Write-Host "   npm install -g supabase" -ForegroundColor White
    Write-Host ""
    Write-Host "OU déployez manuellement via Supabase Dashboard" -ForegroundColor White
    Write-Host ""
    exit 1
}

Write-Host "✅ Supabase CLI trouvé" -ForegroundColor Green
Write-Host ""

# Se placer dans le bon répertoire
$projectPath = $PSScriptRoot
Set-Location $projectPath

Write-Host "📂 Répertoire: $projectPath" -ForegroundColor Gray
Write-Host ""

# Demander confirmation
Write-Host "⚠️  ATTENTION: Cette version est en MODE TEST" -ForegroundColor Yellow
Write-Host "   La signature du loueur sera positionnée EN HAUT de la page" -ForegroundColor Yellow
Write-Host ""
Write-Host "Voulez-vous continuer? (O/N): " -ForegroundColor Cyan -NoNewline
$confirmation = Read-Host

if ($confirmation -ne 'O' -and $confirmation -ne 'o') {
    Write-Host ""
    Write-Host "❌ Déploiement annulé" -ForegroundColor Red
    Write-Host ""
    exit 0
}

Write-Host ""
Write-Host "🚀 Déploiement en cours..." -ForegroundColor Cyan
Write-Host ""

try {
    # Déployer la fonction
    supabase functions deploy submit-guest-info-unified
    
    $exitCode = $LASTEXITCODE
    
    if ($exitCode -eq 0) {
        Write-Host ""
        Write-Host "✅ DÉPLOIEMENT RÉUSSI!" -ForegroundColor Green
        Write-Host ""
        Write-Host "📋 Prochaines étapes:" -ForegroundColor Yellow
        Write-Host "   1. Ouvrir Supabase Dashboard → Edge Functions → Logs" -ForegroundColor White
        Write-Host "   2. Exécuter: scripts/force-regenerate-police.sql" -ForegroundColor White
        Write-Host "   3. Régénérer la fiche de police pour le booking" -ForegroundColor White
        Write-Host "   4. Chercher dans les logs: 'TEST MODE'" -ForegroundColor White
        Write-Host "   5. Télécharger le PDF et vérifier" -ForegroundColor White
        Write-Host ""
        Write-Host "🔍 Logs attendus:" -ForegroundColor Yellow
        Write-Host "   '⚠️ TEST MODE: Signature du loueur positionnée EN HAUT'" -ForegroundColor Gray
        Write-Host "   'normalYPosition: XXX'" -ForegroundColor Gray
        Write-Host "   'testYPosition: YYY'" -ForegroundColor Gray
        Write-Host ""
        Write-Host "📖 Guide complet: TEST_POSITIONNEMENT_SIGNATURE.md" -ForegroundColor Cyan
        Write-Host ""
    } else {
        Write-Host ""
        Write-Host "❌ ÉCHEC DU DÉPLOIEMENT" -ForegroundColor Red
        Write-Host ""
        Write-Host "💡 Solutions possibles:" -ForegroundColor Yellow
        Write-Host "   1. Vérifier votre connexion Supabase: supabase login" -ForegroundColor White
        Write-Host "   2. Vérifier la configuration: supabase link" -ForegroundColor White
        Write-Host "   3. Déployer manuellement via Supabase Dashboard" -ForegroundColor White
        Write-Host ""
    }
} catch {
    Write-Host ""
    Write-Host "❌ ERREUR: $_" -ForegroundColor Red
    Write-Host ""
}

Write-Host ""
Write-Host "Appuyez sur une touche pour continuer..." -ForegroundColor Gray
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
