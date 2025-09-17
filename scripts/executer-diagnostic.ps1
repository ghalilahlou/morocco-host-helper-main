# 🔍 SCRIPT DE DIAGNOSTIC : PIÈCES D'IDENTITÉ DES INVITÉS
# Ce script exécute le diagnostic SQL pour analyser le stockage des pièces d'identité

Write-Host "🔍 DIAGNOSTIC COMPLET : PIÈCES D'IDENTITÉ DES INVITÉS" -ForegroundColor Cyan
Write-Host "=================================================" -ForegroundColor Cyan
Write-Host ""

# Vérifier que nous sommes dans le bon répertoire
if (-not (Test-Path "supabase")) {
    Write-Host "❌ ERREUR : Répertoire supabase non trouvé" -ForegroundColor Red
    Write-Host "Exécutez ce script depuis la racine du projet" -ForegroundColor Yellow
    exit 1
}

# Vérifier que le fichier de diagnostic existe
$diagnosticFile = "scripts/diagnostic-pieces-identite.sql"
if (-not (Test-Path $diagnosticFile)) {
    Write-Host "❌ ERREUR : Fichier de diagnostic non trouvé : $diagnosticFile" -ForegroundColor Red
    exit 1
}

Write-Host "✅ Fichier de diagnostic trouvé : $diagnosticFile" -ForegroundColor Green
Write-Host ""

# Lire le contenu du fichier de diagnostic
$sqlContent = Get-Content $diagnosticFile -Raw
Write-Host "📄 Contenu du fichier SQL chargé (" $sqlContent.Length "caractères)" -ForegroundColor Green
Write-Host ""

# Instructions pour l'utilisateur
Write-Host "🎯 INSTRUCTIONS POUR EXÉCUTER LE DIAGNOSTIC :" -ForegroundColor Yellow
Write-Host ""
Write-Host "1. Ouvrez Supabase Dashboard" -ForegroundColor White
Write-Host "2. Allez dans 'SQL Editor'" -ForegroundColor White
Write-Host "3. Copiez-collez le contenu suivant :" -ForegroundColor White
Write-Host ""
Write-Host "4. Cliquez sur 'Run' pour exécuter le diagnostic" -ForegroundColor White
Write-Host ""

# Afficher le contenu SQL
Write-Host "📋 CONTENU SQL À COPIER :" -ForegroundColor Cyan
Write-Host "----------------------------------------" -ForegroundColor Cyan
Write-Host $sqlContent -ForegroundColor White
Write-Host "----------------------------------------" -ForegroundColor Cyan
Write-Host ""

# Créer un fichier de sortie pour faciliter la copie
$outputFile = "diagnostic-pieces-identite-output.txt"
$sqlContent | Out-File -FilePath $outputFile -Encoding UTF8

Write-Host "💾 Fichier de sortie créé : $outputFile" -ForegroundColor Green
Write-Host "Vous pouvez copier le contenu de ce fichier dans Supabase SQL Editor" -ForegroundColor Yellow
Write-Host ""

# Instructions supplémentaires
Write-Host "🔧 ANALYSE DES RÉSULTATS :" -ForegroundColor Yellow
Write-Host ""
Write-Host "Après exécution, vérifiez :" -ForegroundColor White
Write-Host "- ✅ Structure des tables correcte" -ForegroundColor Green
Write-Host "- ✅ Données présentes dans guest_submissions" -ForegroundColor Green
Write-Host "- ✅ Vue v_guest_submissions accessible" -ForegroundColor Green
Write-Host "- ✅ Relations entre tables correctes" -ForegroundColor Green
Write-Host "- ✅ Permissions RLS configurées" -ForegroundColor Green
Write-Host ""

Write-Host "🚨 PROBLÈMES POTENTIELS À IDENTIFIER :" -ForegroundColor Red
Write-Host ""
Write-Host "- ❌ Table guest_submissions vide" -ForegroundColor Red
Write-Host "- ❌ Vue v_guest_submissions manquante" -ForegroundColor Red
Write-Host "- ❌ Données guest_data vides" -ForegroundColor Red
Write-Host "- ❌ Relations entre tables cassées" -ForegroundColor Red
Write-Host "- ❌ Permissions RLS trop restrictives" -ForegroundColor Red
Write-Host ""

Write-Host "📊 PROCHAINES ÉTAPES :" -ForegroundColor Cyan
Write-Host ""
Write-Host "1. Exécuter le diagnostic dans Supabase" -ForegroundColor White
Write-Host "2. Analyser les résultats" -ForegroundColor White
Write-Host "3. Identifier les problèmes" -ForegroundColor White
Write-Host "4. Corriger les données ou la structure" -ForegroundColor White
Write-Host "5. Tester à nouveau l'affichage" -ForegroundColor White
Write-Host ""

Write-Host "🎯 OBJECTIF : Comprendre pourquoi les pièces d'identité ne s'affichent pas" -ForegroundColor Cyan
Write-Host ""

# Attendre que l'utilisateur appuie sur une touche
Write-Host "Appuyez sur une touche pour continuer..." -ForegroundColor Yellow
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")

Write-Host ""
Write-Host "✅ Diagnostic prêt à être exécuté !" -ForegroundColor Green
Write-Host "Copiez le contenu de $outputFile dans Supabase SQL Editor" -ForegroundColor Yellow
