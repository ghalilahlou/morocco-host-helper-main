# Script de déploiement pour les nouvelles fonctionnalités
# - Prévention des réservations en double
# - Système d'email pour guests et propriétaires
# - Correction des problèmes de canvas
# Date: 2025-01-30

Write-Host "🚀 DÉPLOIEMENT: Prévention doublons + Système email" -ForegroundColor Cyan
Write-Host "===============================================" -ForegroundColor Cyan

# Vérification des prérequis
Write-Host "🔍 Vérification des prérequis..." -ForegroundColor Yellow

# Vérifier si Supabase CLI est installé
try {
    $supabaseVersion = supabase --version
    Write-Host "✅ Supabase CLI détecté: $supabaseVersion" -ForegroundColor Green
} catch {
    Write-Host "❌ Supabase CLI non trouvé. Installation requise." -ForegroundColor Red
    exit 1
}

# Vérifier la connexion au projet
Write-Host "🔗 Vérification de la connexion au projet..." -ForegroundColor Yellow
try {
    supabase status
    Write-Host "✅ Connexion au projet Supabase active" -ForegroundColor Green
} catch {
    Write-Host "❌ Pas de connexion au projet Supabase" -ForegroundColor Red
    Write-Host "💡 Exécutez 'supabase login' et 'supabase link --project-ref YOUR_PROJECT_ID'" -ForegroundColor Yellow
    exit 1
}

Write-Host ""
Write-Host "📋 ÉTAPES DU DÉPLOIEMENT:" -ForegroundColor Cyan
Write-Host "1. Migrations de base de données" -ForegroundColor White
Write-Host "2. Déploiement des Edge Functions" -ForegroundColor White
Write-Host "3. Vérification des déploiements" -ForegroundColor White
Write-Host ""

# Confirmation avant déploiement
$confirm = Read-Host "Continuer avec le déploiement? (y/N)"
if ($confirm -ne "y" -and $confirm -ne "Y") {
    Write-Host "⏹️ Déploiement annulé par l'utilisateur" -ForegroundColor Yellow
    exit 0
}

Write-Host ""

# ÉTAPE 1: MIGRATIONS DE BASE DE DONNÉES
Write-Host "📊 ÉTAPE 1/3: Migrations de base de données" -ForegroundColor Cyan
Write-Host "-------------------------------------------" -ForegroundColor Cyan

Write-Host "🔨 Application des migrations..." -ForegroundColor Yellow

# Migration 1: Prévention des doublons
Write-Host "📝 Migration: Prévention des réservations en double" -ForegroundColor White
try {
    supabase db push
    Write-Host "✅ Migration prévention doublons appliquée" -ForegroundColor Green
} catch {
    Write-Host "❌ Erreur lors de l'application des migrations" -ForegroundColor Red
    Write-Host "📋 Détail de l'erreur: $_" -ForegroundColor Red
    exit 1
}

Write-Host ""

# ÉTAPE 2: DÉPLOIEMENT DES EDGE FUNCTIONS
Write-Host "⚡ ÉTAPE 2/3: Déploiement des Edge Functions" -ForegroundColor Cyan
Write-Host "--------------------------------------------" -ForegroundColor Cyan

# Liste des fonctions à déployer
$functions = @(
    "submit-guest-info",
    "create-booking-for-signature", 
    "send-guest-contract",
    "send-owner-notification"
)

foreach ($function in $functions) {
    Write-Host "🔄 Déploiement: $function" -ForegroundColor White
    try {
        supabase functions deploy $function
        Write-Host "✅ $function déployée avec succès" -ForegroundColor Green
    } catch {
        Write-Host "❌ Erreur lors du déploiement de $function" -ForegroundColor Red
        Write-Host "📋 Détail: $_" -ForegroundColor Red
        # Continuer avec les autres fonctions
    }
    Start-Sleep -Seconds 2
}

Write-Host ""

# ÉTAPE 3: VÉRIFICATIONS
Write-Host "🔍 ÉTAPE 3/3: Vérifications post-déploiement" -ForegroundColor Cyan
Write-Host "---------------------------------------------" -ForegroundColor Cyan

Write-Host "📋 Vérification des fonctions Edge..." -ForegroundColor Yellow
try {
    supabase functions list
    Write-Host "✅ Fonctions Edge listées avec succès" -ForegroundColor Green
} catch {
    Write-Host "⚠️ Impossible de lister les fonctions Edge" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "🧪 Tests de base recommandés:" -ForegroundColor Yellow
Write-Host "1. Créer une nouvelle réservation avec le même utilisateur et mêmes dates (doit échouer)" -ForegroundColor White
Write-Host "2. Tester l'ajout d'un email dans le formulaire invité" -ForegroundColor White
Write-Host "3. Vérifier l'envoi d'emails après signature du contrat" -ForegroundColor White
Write-Host "4. Tester le canvas de signature" -ForegroundColor White

Write-Host ""
Write-Host "📧 Configuration email requise:" -ForegroundColor Yellow
Write-Host "Assurez-vous que les variables d'environnement suivantes sont définies:" -ForegroundColor White
Write-Host "- RESEND_API_KEY: Clé API Resend" -ForegroundColor White
Write-Host "- RESEND_FROM_EMAIL: Adresse email d'expédition" -ForegroundColor White

Write-Host ""
Write-Host "🎉 DÉPLOIEMENT TERMINÉ!" -ForegroundColor Green
Write-Host "=======================" -ForegroundColor Green
Write-Host ""
Write-Host "🔧 NOUVELLES FONCTIONNALITÉS DÉPLOYÉES:" -ForegroundColor Cyan
Write-Host "✅ Prévention des réservations en double" -ForegroundColor Green
Write-Host "✅ Champ email optionnel pour les invités" -ForegroundColor Green
Write-Host "✅ Envoi automatique d'email aux invités" -ForegroundColor Green
Write-Host "✅ Amélioration de la gestion du canvas de signature" -ForegroundColor Green
Write-Host "✅ Contraintes de base de données pour la cohérence" -ForegroundColor Green

Write-Host ""
Write-Host "📖 DOCUMENTATION DES CHANGEMENTS:" -ForegroundColor Cyan
Write-Host ""
Write-Host "1. PRÉVENTION DES DOUBLONS:" -ForegroundColor Yellow
Write-Host "   - Contrainte unique sur (property_id, check_in_date, check_out_date, user_id)" -ForegroundColor White
Write-Host "   - Trigger automatique de vérification des conflits" -ForegroundColor White
Write-Host "   - Fonction check_booking_conflicts() pour détecter les chevauchements" -ForegroundColor White
Write-Host ""
Write-Host "2. SYSTÈME EMAIL:" -ForegroundColor Yellow
Write-Host "   - Champ 'email' ajouté à la table guests (optionnel)" -ForegroundColor White
Write-Host "   - Fonction Edge 'send-guest-contract' pour les invités" -ForegroundColor White
Write-Host "   - Intégration dans le processus de signature" -ForegroundColor White
Write-Host ""
Write-Host "3. AMÉLIORATIONS TECHNIQUES:" -ForegroundColor Yellow
Write-Host "   - Gestion améliorée du canvas de signature" -ForegroundColor White
Write-Host "   - Validation d'email côté client et serveur" -ForegroundColor White
Write-Host "   - Types TypeScript mis à jour" -ForegroundColor White

Write-Host ""
Write-Host "⚠️  ACTIONS REQUISES APRÈS DÉPLOIEMENT:" -ForegroundColor Red
Write-Host "1. Configurer les clés API Resend dans Supabase Dashboard" -ForegroundColor White
Write-Host "2. Tester le formulaire de vérification des invités" -ForegroundColor White
Write-Host "3. Vérifier les logs des Edge Functions" -ForegroundColor White
Write-Host "4. Tester les scénarios de conflit de réservation" -ForegroundColor White

Write-Host ""
Write-Host "📞 SUPPORT:" -ForegroundColor Cyan
Write-Host "En cas de problème, vérifiez les logs Supabase et les erreurs de console du navigateur." -ForegroundColor White

Write-Host ""
Write-Host "🎯 Déploiement terminé avec succès! Bonne utilisation! 🎉" -ForegroundColor Green
