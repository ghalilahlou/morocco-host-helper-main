# 🔒 SCRIPT DE PURGE GIT - SUPPRESSION DES SECRETS
# Exécutez ce script en tant qu'administrateur

Write-Host "🚨 PURGE DE L'HISTORIQUE GIT - SUPPRESSION DES SECRETS" -ForegroundColor Red
Write-Host "==================================================" -ForegroundColor Red

# Vérification que nous sommes dans le bon répertoire
if (-not (Test-Path ".git")) {
    Write-Host "❌ ERREUR: Ce script doit être exécuté dans un répertoire Git" -ForegroundColor Red
    exit 1
}

Write-Host "✅ Répertoire Git détecté" -ForegroundColor Green

# 1. Sauvegarde de l'état actuel
Write-Host "📦 Création d'une sauvegarde..." -ForegroundColor Yellow
$backupDir = "backup-$(Get-Date -Format 'yyyyMMdd-HHmmss')"
Copy-Item -Path "." -Destination "../$backupDir" -Recurse -Force
Write-Host "✅ Sauvegarde créée: ../$backupDir" -ForegroundColor Green

# 2. Suppression des fichiers .env du working directory
Write-Host "🗑️ Suppression des fichiers .env locaux..." -ForegroundColor Yellow
Get-ChildItem -Path "." -Name "*.env*" | ForEach-Object {
    Remove-Item $_ -Force
    Write-Host "   Supprimé: $_" -ForegroundColor Yellow
}

# 3. Suppression des fichiers .env de l'index Git
Write-Host "🗑️ Suppression des fichiers .env de l'index Git..." -ForegroundColor Yellow
git rm --cached --ignore-unmatch "*.env*" 2>$null
git rm --cached --ignore-unmatch ".env" 2>$null
git rm --cached --ignore-unmatch ".env.local" 2>$null
git rm --cached --ignore-unmatch ".env.development" 2>$null
git rm --cached --ignore-unmatch ".env.production" 2>$null

# 4. Nettoyage de l'historique avec filter-branch
Write-Host "🧹 Nettoyage de l'historique Git..." -ForegroundColor Yellow
Write-Host "   ⚠️ Cette opération peut prendre du temps..." -ForegroundColor Yellow

# Suppression des fichiers .env de tout l'historique
git filter-branch --force --index-filter `
    "git rm --cached --ignore-unmatch *.env* .env .env.local .env.development .env.production" `
    --prune-empty --tag-name-filter cat -- --all

# 5. Nettoyage des références
Write-Host "🧹 Nettoyage des références..." -ForegroundColor Yellow
git for-each-ref --format="%(refname)" refs/original | ForEach-Object {
    git update-ref -d $_
}

# 6. Nettoyage du garbage collector
Write-Host "🗑️ Nettoyage du garbage collector..." -ForegroundColor Yellow
git reflog expire --expire=now --all
git gc --prune=now --aggressive

# 7. Commit des changements
Write-Host "💾 Commit des changements..." -ForegroundColor Yellow
git add .
git commit -m "🔒 SECURITY: Purge complete des secrets de l'historique Git" --allow-empty

Write-Host ""
Write-Host "✅ PURGE TERMINÉE AVEC SUCCÈS!" -ForegroundColor Green
Write-Host "==================================================" -ForegroundColor Green
Write-Host ""
Write-Host "📋 PROCHAINES ÉTAPES:" -ForegroundColor Cyan
Write-Host "1. Vérifiez que les secrets ont été supprimés" -ForegroundColor White
Write-Host "2. Testez l'application localement" -ForegroundColor White
Write-Host "3. Poussez les changements: git push --force" -ForegroundColor White
Write-Host "4. Rotatez les clés Supabase" -ForegroundColor White
Write-Host ""
Write-Host "⚠️ ATTENTION: Utilisez 'git push --force' avec précaution!" -ForegroundColor Red
Write-Host ""
