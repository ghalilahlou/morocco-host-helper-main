# Script pour télécharger les edge functions de Supabase vers le projet local
# Ce script sauvegarde les fonctions existantes et télécharge les nouvelles versions

Write-Host "=== Téléchargement des Edge Functions de Supabase ===" -ForegroundColor Green

# Créer un dossier de sauvegarde avec timestamp
$backupDir = "supabase/functions_backup_$(Get-Date -Format 'yyyyMMdd_HHmmss')"
Write-Host "Création du dossier de sauvegarde: $backupDir" -ForegroundColor Yellow

# Sauvegarder les fonctions existantes
if (Test-Path "supabase/functions") {
    Copy-Item -Path "supabase/functions" -Destination $backupDir -Recurse -Force
    Write-Host "Sauvegarde créée dans: $backupDir" -ForegroundColor Green
} else {
    Write-Host "Aucune fonction existante à sauvegarder" -ForegroundColor Yellow
}

# Liste des fonctions à télécharger (basée sur la liste obtenue)
$functions = @(
    "extract-document-data",
    "get-airbnb-reservation", 
    "send-owner-notification",
    "submit-guest-info",
    "resolve-guest-link",
    "storage-sign-url",
    "issue-guest-link",
    "get-booking-verification-summary",
    "get-admin-users",
    "get-admin-stats",
    "verify-admin-status",
    "suspend-user",
    "delete-user",
    "get-performance-stats",
    "create-storage-bucket",
    "create-booking-for-signature",
    "add-admin-user",
    "generate-id-documents",
    "get-all-users",
    "sync-documents",
    "generate-contract",
    "generate-police-forms",
    "save-contract-signature",
    "send-guest-contract",
    "sync-airbnb-unified",
    "get-guest-documents-unified"
)

Write-Host "Téléchargement de $($functions.Count) edge functions..." -ForegroundColor Cyan

$successCount = 0
$failedFunctions = @()

foreach ($function in $functions) {
    Write-Host "Téléchargement de: $function" -ForegroundColor White
    
    try {
        # Télécharger la fonction
        $result = supabase functions download $function --project-ref csopyblkfyofwkeqqegd
        
        if ($LASTEXITCODE -eq 0) {
            Write-Host "✓ $function téléchargée avec succès" -ForegroundColor Green
            $successCount++
        } else {
            Write-Host "✗ Erreur lors du téléchargement de $function" -ForegroundColor Red
            $failedFunctions += $function
        }
    }
    catch {
        Write-Host "✗ Exception lors du téléchargement de $function : $($_.Exception.Message)" -ForegroundColor Red
        $failedFunctions += $function
    }
}

Write-Host "`n=== Résumé du téléchargement ===" -ForegroundColor Green
Write-Host "Fonctions téléchargées avec succès: $successCount" -ForegroundColor Green
Write-Host "Fonctions échouées: $($failedFunctions.Count)" -ForegroundColor Red

if ($failedFunctions.Count -gt 0) {
    Write-Host "Fonctions échouées:" -ForegroundColor Red
    foreach ($func in $failedFunctions) {
        Write-Host "  - $func" -ForegroundColor Red
    }
}

# Vérifier la structure des fonctions téléchargées
Write-Host "`n=== Vérification de la structure ===" -ForegroundColor Cyan
if (Test-Path "supabase/functions") {
    $downloadedFunctions = Get-ChildItem "supabase/functions" -Directory | Where-Object { $_.Name -ne "_shared" }
    Write-Host "Fonctions trouvées localement: $($downloadedFunctions.Count)" -ForegroundColor Green
    
    foreach ($func in $downloadedFunctions) {
        if (Test-Path "$($func.FullName)/index.ts") {
            Write-Host "✓ $($func.Name) - index.ts présent" -ForegroundColor Green
        } else {
            Write-Host "✗ $($func.Name) - index.ts manquant" -ForegroundColor Red
        }
    }
} else {
    Write-Host "✗ Aucune fonction téléchargée trouvée" -ForegroundColor Red
}

Write-Host "`n=== Instructions ===" -ForegroundColor Yellow
Write-Host "1. Vérifiez que toutes les fonctions ont été téléchargées correctement"
Write-Host "2. Si tout est OK, vous pouvez supprimer le dossier de sauvegarde: $backupDir"
Write-Host "3. Si des problèmes sont détectés, restaurez depuis la sauvegarde"

Write-Host "`nSauvegarde disponible dans: $backupDir" -ForegroundColor Cyan
