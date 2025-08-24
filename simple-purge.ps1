# 🔒 SCRIPT DE PURGE SIMPLIFIÉ
Write-Host "🚨 PURGE SIMPLIFIÉE DES SECRETS" -ForegroundColor Red

# 1. Supprimer les fichiers .env de l'index
Write-Host "🗑️ Suppression des fichiers .env..." -ForegroundColor Yellow
git rm --cached --ignore-unmatch "*.env*" 2>$null
git rm --cached --ignore-unmatch ".env" 2>$null
git rm --cached --ignore-unmatch ".env.local" 2>$null

# 2. Commiter la suppression
Write-Host "💾 Commit de la suppression..." -ForegroundColor Yellow
git add .
git commit -m "🔒 SECURITY: Suppression définitive des fichiers .env" --allow-empty

# 3. Nettoyer le garbage collector
Write-Host "🧹 Nettoyage..." -ForegroundColor Yellow
git gc --prune=now

Write-Host "✅ Purge terminée!" -ForegroundColor Green
Write-Host "📋 Prochaine étape: git push --force" -ForegroundColor Cyan
