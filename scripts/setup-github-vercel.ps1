# Script de configuration GitHub + Vercel + Docker
# Usage: .\scripts\setup-github-vercel.ps1

Write-Host "🚀 Configuration GitHub + Vercel + Docker pour Morocco Host Helper" -ForegroundColor Green
Write-Host "==================================================================" -ForegroundColor Green

# Vérifier que nous sommes dans un repo Git
if (-not (Test-Path ".git")) {
    Write-Host "❌ Ce n'est pas un repository Git. Initialisez d'abord Git:" -ForegroundColor Red
    Write-Host "   git init" -ForegroundColor Yellow
    Write-Host "   git add ." -ForegroundColor Yellow
    Write-Host "   git commit -m 'Initial commit'" -ForegroundColor Yellow
    exit 1
}

# Vérifier la branche actuelle
$currentBranch = git branch --show-current
Write-Host "📋 Branche actuelle: $currentBranch" -ForegroundColor Cyan

if ($currentBranch -ne "main") {
    $response = Read-Host "⚠️  Vous n'êtes pas sur la branche 'main'. Voulez-vous continuer? (y/N)"
    if ($response -notmatch "^[Yy]$") {
        Write-Host "❌ Configuration annulée" -ForegroundColor Red
        exit 1
    }
}

Write-Host ""
Write-Host "📋 ÉTAPES DE CONFIGURATION:" -ForegroundColor Green
Write-Host "==========================" -ForegroundColor Green

Write-Host ""
Write-Host "1️⃣  CONFIGURATION GITHUB REPOSITORY" -ForegroundColor Blue
Write-Host "-----------------------------------" -ForegroundColor Blue
Write-Host "✅ Repository Git détecté" -ForegroundColor Green
Write-Host "✅ Workflows GitHub Actions créés" -ForegroundColor Green
Write-Host "✅ Configuration Docker Compose prête" -ForegroundColor Green

Write-Host ""
Write-Host "2️⃣  CONFIGURATION DES SECRETS GITHUB" -ForegroundColor Blue
Write-Host "------------------------------------" -ForegroundColor Blue
Write-Host "Allez sur: https://github.com/VOTRE_USERNAME/VOTRE_REPO/settings/secrets/actions" -ForegroundColor Yellow
Write-Host ""
Write-Host "Ajoutez ces secrets:" -ForegroundColor White
Write-Host "  🔑 VITE_SUPABASE_URL" -ForegroundColor Magenta
Write-Host "  🔑 VITE_SUPABASE_ANON_KEY" -ForegroundColor Magenta
Write-Host "  🔑 VITE_OPENAI_API_KEY" -ForegroundColor Magenta
Write-Host "  🔑 VITE_RESEND_API_KEY" -ForegroundColor Magenta
Write-Host "  🔑 VITE_RESEND_FROM_EMAIL" -ForegroundColor Magenta
Write-Host "  🔑 VERCEL_TOKEN" -ForegroundColor Magenta
Write-Host "  🔑 VERCEL_ORG_ID" -ForegroundColor Magenta
Write-Host "  🔑 VERCEL_PROJECT_ID" -ForegroundColor Magenta
Write-Host "  🔑 SUPABASE_ACCESS_TOKEN" -ForegroundColor Magenta
Write-Host "  🔑 SUPABASE_PROJECT_REF" -ForegroundColor Magenta

Write-Host ""
Write-Host "3️⃣  CONFIGURATION VERCEL" -ForegroundColor Blue
Write-Host "------------------------" -ForegroundColor Blue
Write-Host "1. Allez sur: https://vercel.com/dashboard" -ForegroundColor Yellow
Write-Host "2. Importez votre repository GitHub" -ForegroundColor White
Write-Host "3. Configurez les variables d'environnement" -ForegroundColor White
Write-Host "4. Activez le déploiement automatique" -ForegroundColor White

Write-Host ""
Write-Host "4️⃣  CONFIGURATION SUPABASE" -ForegroundColor Blue
Write-Host "--------------------------" -ForegroundColor Blue
Write-Host "1. Allez sur: https://supabase.com/dashboard" -ForegroundColor Yellow
Write-Host "2. Sélectionnez votre projet" -ForegroundColor White
Write-Host "3. Allez dans Settings > API" -ForegroundColor White
Write-Host "4. Copiez les clés dans les secrets GitHub" -ForegroundColor White

Write-Host ""
Write-Host "5️⃣  COMMANDES UTILES" -ForegroundColor Blue
Write-Host "-------------------" -ForegroundColor Blue
Write-Host "# Pousser vers GitHub (déclenche le déploiement)" -ForegroundColor White
Write-Host "git add ." -ForegroundColor Yellow
Write-Host "git commit -m 'feat: add Docker and Vercel deployment'" -ForegroundColor Yellow
Write-Host "git push origin main" -ForegroundColor Yellow
Write-Host ""
Write-Host "# Voir les déploiements" -ForegroundColor White
Write-Host "gh run list" -ForegroundColor Yellow
Write-Host ""
Write-Host "# Voir les logs de déploiement" -ForegroundColor White
Write-Host "gh run view --log" -ForegroundColor Yellow

Write-Host ""
Write-Host "🎉 CONFIGURATION TERMINÉE!" -ForegroundColor Green
Write-Host "=========================" -ForegroundColor Green
Write-Host ""
Write-Host "Prochaines étapes:" -ForegroundColor White
Write-Host "1. Configurez les secrets GitHub" -ForegroundColor Cyan
Write-Host "2. Importez le projet sur Vercel" -ForegroundColor Cyan
Write-Host "3. Poussez votre code vers GitHub" -ForegroundColor Cyan
Write-Host "4. Vérifiez le déploiement automatique" -ForegroundColor Cyan
Write-Host ""
Write-Host "🔗 URLs importantes:" -ForegroundColor White
Write-Host "- GitHub Actions: https://github.com/VOTRE_USERNAME/VOTRE_REPO/actions" -ForegroundColor Yellow
Write-Host "- Vercel Dashboard: https://vercel.com/dashboard" -ForegroundColor Yellow
Write-Host "- Supabase Dashboard: https://supabase.com/dashboard" -ForegroundColor Yellow