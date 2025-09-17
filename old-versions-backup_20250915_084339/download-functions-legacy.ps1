# Script pour télécharger les edge functions avec l'option legacy-bundle
Write-Host "=== Telechargement des Edge Functions (Legacy Bundle) ===" -ForegroundColor Green

# Creer un dossier de sauvegarde
$backupDir = "supabase/functions_backup_$(Get-Date -Format 'yyyyMMdd_HHmmss')"
Write-Host "Creation du dossier de sauvegarde: $backupDir" -ForegroundColor Yellow

# Sauvegarder les fonctions existantes
if (Test-Path "supabase/functions") {
    Copy-Item -Path "supabase/functions" -Destination $backupDir -Recurse -Force
    Write-Host "Sauvegarde creee dans: $backupDir" -ForegroundColor Green
}

# Liste des fonctions a telecharger
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

Write-Host "Telechargement de $($functions.Count) edge functions avec --legacy-bundle..." -ForegroundColor Cyan

$successCount = 0
$failedFunctions = @()

foreach ($function in $functions) {
    Write-Host "Telechargement de: $function" -ForegroundColor White
    
    # Telecharger la fonction avec legacy-bundle
    supabase functions download --legacy-bundle $function --project-ref csopyblkfyofwkeqqegd
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "OK $function telechargee avec succes" -ForegroundColor Green
        $successCount++
    } else {
        Write-Host "ERREUR lors du telechargement de $function" -ForegroundColor Red
        $failedFunctions += $function
    }
}

Write-Host ""
Write-Host "=== Resume du telechargement ===" -ForegroundColor Green
Write-Host "Fonctions telechargees avec succes: $successCount" -ForegroundColor Green
Write-Host "Fonctions echouees: $($failedFunctions.Count)" -ForegroundColor Red

if ($failedFunctions.Count -gt 0) {
    Write-Host "Fonctions echouees:" -ForegroundColor Red
    foreach ($func in $failedFunctions) {
        Write-Host "  - $func" -ForegroundColor Red
    }
}

# Verifier la structure des fonctions telechargees
Write-Host ""
Write-Host "=== Verification de la structure ===" -ForegroundColor Cyan
if (Test-Path "supabase/functions") {
    $downloadedFunctions = Get-ChildItem "supabase/functions" -Directory | Where-Object { $_.Name -ne "_shared" }
    Write-Host "Fonctions trouvees localement: $($downloadedFunctions.Count)" -ForegroundColor Green
    
    foreach ($func in $downloadedFunctions) {
        if (Test-Path "$($func.FullName)/index.ts") {
            Write-Host "OK $($func.Name) - index.ts present" -ForegroundColor Green
        } else {
            Write-Host "ERREUR $($func.Name) - index.ts manquant" -ForegroundColor Red
        }
    }
} else {
    Write-Host "ERREUR Aucune fonction telechargee trouvee" -ForegroundColor Red
}

Write-Host ""
Write-Host "Sauvegarde disponible dans: $backupDir" -ForegroundColor Cyan
