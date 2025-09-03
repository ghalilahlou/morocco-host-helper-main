# Script de redéploiement forcé simple
Write-Host "Redéploiement forcé des fonctions Edge..." -ForegroundColor Cyan

# Ajouter un commentaire de timestamp pour forcer le redéploiement
$timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
Write-Host "Timestamp: $timestamp" -ForegroundColor Yellow

# Fonction à redéployer en priorité
$functionPath = "supabase/functions/resolve-guest-link/index.ts"

if (Test-Path $functionPath) {
    # Lire le contenu actuel
    $content = Get-Content $functionPath -Raw
    
    # Ajouter un commentaire de timestamp au début
    $newContent = "// Last redeploy: $timestamp`n$content"
    
    # Sauvegarder le fichier modifié
    Set-Content -Path $functionPath -Value $newContent -NoNewline
    
    Write-Host "✅ Fichier $functionPath modifie avec timestamp" -ForegroundColor Green
    Write-Host "📝 Ajout du commentaire: // Last redeploy: $timestamp" -ForegroundColor Green
    
    # Afficher la taille du fichier
    $size = (Get-Item $functionPath).Length
    Write-Host "📊 Nouvelle taille: $size bytes" -ForegroundColor Green
    
} else {
    Write-Host "❌ Fichier $functionPath non trouve!" -ForegroundColor Red
}

Write-Host "`nProchaines etapes:" -ForegroundColor Cyan
Write-Host "1. Commitez et poussez ce changement sur GitHub" -ForegroundColor White
Write-Host "2. Le workflow GitHub Actions se declenchera automatiquement" -ForegroundColor White
Write-Host "3. Ou utilisez le dashboard Supabase pour deployer manuellement" -ForegroundColor White
