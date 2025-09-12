# Script de déploiement automatique sur GitHub et Vercel
# PowerShell script pour Windows

Write-Host "🚀 Déploiement automatique sur GitHub et Vercel" -ForegroundColor Green
Write-Host "===============================================" -ForegroundColor Green

# Vérifier si Git est installé
try {
    $gitVersion = git --version
    Write-Host "✅ Git détecté: $gitVersion" -ForegroundColor Green
} catch {
    Write-Host "❌ Git n'est pas installé. Veuillez installer Git d'abord." -ForegroundColor Red
    exit 1
}

# Vérifier si Node.js est installé
try {
    $nodeVersion = node --version
    Write-Host "✅ Node.js détecté: $nodeVersion" -ForegroundColor Green
} catch {
    Write-Host "❌ Node.js n'est pas installé. Veuillez installer Node.js d'abord." -ForegroundColor Red
    exit 1
}

# Vérifier les variables d'environnement
Write-Host "`n🔍 Vérification des variables d'environnement..." -ForegroundColor Yellow

if (-not (Test-Path ".env")) {
    Write-Host "⚠️ Fichier .env non trouvé. Création d'un exemple..." -ForegroundColor Yellow
    Copy-Item "env.example" ".env"
    Write-Host "📝 Veuillez configurer le fichier .env avec vos clés Supabase" -ForegroundColor Yellow
}

# Nettoyer le projet
Write-Host "`n🧹 Nettoyage du projet..." -ForegroundColor Yellow
node scripts/cleanup-for-deployment.js

# Vérifier le statut Git
Write-Host "`n📋 Statut Git actuel:" -ForegroundColor Yellow
git status --short

# Demander confirmation
$confirm = Read-Host "`n❓ Voulez-vous continuer avec le déploiement ? (y/N)"
if ($confirm -ne "y" -and $confirm -ne "Y") {
    Write-Host "❌ Déploiement annulé par l'utilisateur." -ForegroundColor Red
    exit 0
}

# Ajouter tous les fichiers modifiés
Write-Host "`n📤 Ajout des fichiers au commit..." -ForegroundColor Yellow
git add .

# Créer le commit
$commitMessage = "feat: Déploiement complet - 4 types de documents + corrections"
Write-Host "💾 Création du commit: $commitMessage" -ForegroundColor Yellow
git commit -m $commitMessage

# Vérifier si un remote existe
$remoteExists = git remote get-url origin 2>$null
if ($LASTEXITCODE -ne 0) {
    Write-Host "`n🔗 Configuration du remote GitHub..." -ForegroundColor Yellow
    $githubUrl = Read-Host "Entrez l'URL de votre repository GitHub (ex: https://github.com/username/repo.git)"
    git remote add origin $githubUrl
}

# Pousser vers GitHub
Write-Host "`n📤 Push vers GitHub..." -ForegroundColor Yellow
git push -u origin main

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Code poussé vers GitHub avec succès !" -ForegroundColor Green
} else {
    Write-Host "❌ Erreur lors du push vers GitHub." -ForegroundColor Red
    exit 1
}

# Instructions pour Vercel
Write-Host "`n🌐 Instructions pour Vercel:" -ForegroundColor Cyan
Write-Host "1. Allez sur https://vercel.com" -ForegroundColor White
Write-Host "2. Connectez-vous avec votre compte GitHub" -ForegroundColor White
Write-Host "3. Cliquez sur 'New Project'" -ForegroundColor White
Write-Host "4. Importez votre repository: $githubUrl" -ForegroundColor White
Write-Host "5. Configuration recommandée:" -ForegroundColor White
Write-Host "   - Framework: Vite" -ForegroundColor Gray
Write-Host "   - Build Command: npm run vercel-build" -ForegroundColor Gray
Write-Host "   - Output Directory: dist" -ForegroundColor Gray
Write-Host "   - Install Command: npm install --legacy-peer-deps" -ForegroundColor Gray

# Variables d'environnement pour Vercel
Write-Host "`n🔑 Variables d'environnement à configurer dans Vercel:" -ForegroundColor Cyan
Write-Host "VITE_SUPABASE_URL=https://votre-projet.supabase.co" -ForegroundColor Gray
Write-Host "VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." -ForegroundColor Gray
Write-Host "SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." -ForegroundColor Gray

# Instructions pour Supabase
Write-Host "`n🔧 Instructions pour Supabase Edge Functions:" -ForegroundColor Cyan
Write-Host "1. Allez sur https://supabase.com/dashboard" -ForegroundColor White
Write-Host "2. Sélectionnez votre projet" -ForegroundColor White
Write-Host "3. Edge Functions > Deploy" -ForegroundColor White
Write-Host "4. Déployez ces fonctions:" -ForegroundColor White
Write-Host "   - submit-guest-info" -ForegroundColor Gray
Write-Host "   - generate-contract" -ForegroundColor Gray
Write-Host "   - generate-police-forms" -ForegroundColor Gray
Write-Host "   - generate-id-documents" -ForegroundColor Gray
Write-Host "   - save-contract-signature" -ForegroundColor Gray
Write-Host "   - storage-sign-url" -ForegroundColor Gray

Write-Host "`n🎉 Déploiement GitHub terminé !" -ForegroundColor Green
Write-Host "📋 Prochaines étapes:" -ForegroundColor Yellow
Write-Host "1. Configurer Vercel avec les instructions ci-dessus" -ForegroundColor White
Write-Host "2. Déployer les Edge Functions sur Supabase" -ForegroundColor White
Write-Host "3. Tester l'application déployée" -ForegroundColor White

Write-Host "`n📚 Documentation complète disponible dans:" -ForegroundColor Cyan
Write-Host "   - GUIDE-DEPLOIEMENT-COMPLET.md" -ForegroundColor Gray
Write-Host "   - GUIDE-CORRECTION-FICHE-ID.md" -ForegroundColor Gray
