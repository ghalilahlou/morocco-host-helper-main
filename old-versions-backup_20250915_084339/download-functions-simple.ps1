# Script simple pour télécharger les edge functions de Supabase
Write-Host "=== Telechargement des Edge Functions ===" -ForegroundColor Green

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

Write-Host "Telechargement de $($functions.Count) edge functions..." -ForegroundColor Cyan

$successCount = 0
$failedFunctions = @()

foreach ($function in $functions) {
    Write-Host "Telechargement de: $function" -ForegroundColor White
    
    # Telecharger la fonction
    supabase functions download $function --project-ref csopyblkfyofwkeqqegd
    
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

Write-Host ""
Write-Host "Sauvegarde disponible dans: $backupDir" -ForegroundColor Cyan
