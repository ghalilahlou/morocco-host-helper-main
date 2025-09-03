# Script de déploiement pour les nouvelles fiches de police
# Date: 2025-01-30

Write-Host "🚀 Déploiement des nouvelles fiches de police..." -ForegroundColor Green

# 1. Vérifier que nous sommes dans le bon répertoire
if (-not (Test-Path "supabase")) {
    Write-Host "❌ Erreur: Dossier 'supabase' non trouvé. Exécutez ce script depuis la racine du projet." -ForegroundColor Red
    exit 1
}

# 2. Appliquer la migration de base de données
Write-Host "📊 Application de la migration de base de données..." -ForegroundColor Yellow
try {
    supabase db push
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Migration appliquée avec succès" -ForegroundColor Green
    } else {
        Write-Host "❌ Erreur lors de l'application de la migration" -ForegroundColor Red
        exit 1
    }
} catch {
    Write-Host "❌ Erreur lors de l'application de la migration: $_" -ForegroundColor Red
    exit 1
}

# 3. Redéployer les fonctions Edge modifiées
Write-Host "🔧 Redéploiement des fonctions Edge..." -ForegroundColor Yellow

$functions = @(
    "generate-documents",
    "submit-guest-info", 
    "create-booking-for-signature"
)

foreach ($function in $functions) {
    Write-Host "📦 Déploiement de $function..." -ForegroundColor Cyan
    try {
        supabase functions deploy $function
        if ($LASTEXITCODE -eq 0) {
            Write-Host "✅ $function déployé avec succès" -ForegroundColor Green
        } else {
            Write-Host "❌ Erreur lors du déploiement de $function" -ForegroundColor Red
        }
    } catch {
        Write-Host "❌ Erreur lors du déploiement de $function: $_" -ForegroundColor Red
    }
}

# 4. Vérifier l'état des fonctions
Write-Host "🔍 Vérification de l'état des fonctions..." -ForegroundColor Yellow
try {
    supabase functions list
} catch {
    Write-Host "⚠️ Impossible de lister les fonctions: $_" -ForegroundColor Yellow
}

# 5. Résumé du déploiement
Write-Host "`n🎉 Déploiement terminé!" -ForegroundColor Green
Write-Host "`n📋 Résumé des modifications:" -ForegroundColor Cyan
Write-Host "   ✅ Nouveau champ 'profession' ajouté" -ForegroundColor Green
Write-Host "   ✅ Nouveau champ 'motif_sejour' sélectionnable" -ForegroundColor Green
Write-Host "   ✅ Nouveau champ 'adresse_personnelle' ajouté" -ForegroundColor Green
Write-Host "   ✅ Adresse de l'établissement corrigée" -ForegroundColor Green
Write-Host "   ✅ Motif du séjour personnalisable" -ForegroundColor Green
Write-Host "   ✅ Adresse au Maroc = adresse personnelle de l'invité" -ForegroundColor Green

Write-Host "`n🧪 Tests recommandés:" -ForegroundColor Yellow
Write-Host "   1. Créer un nouveau bien avec une adresse" -ForegroundColor White
Write-Host "   2. Créer une réservation avec des invités" -ForegroundColor White
Write-Host "   3. Remplir les nouveaux champs (profession, motif, adresse)" -ForegroundColor White
Write-Host "   4. Générer les fiches de police" -ForegroundColor White
Write-Host "   5. Vérifier que le PDF contient les bonnes informations" -ForegroundColor White

Write-Host "`n📚 Documentation: TEST-NOUVELLES-FICHES-POLICE.md" -ForegroundColor Cyan
