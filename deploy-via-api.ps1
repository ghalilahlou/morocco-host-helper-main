# Script de déploiement des fonctions Edge via API
Write-Host "Deploiement des fonctions Edge via API Supabase..." -ForegroundColor Cyan

# Configuration
$projectRef = "csopyblkfyofwkeqqegd"
$anonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNzb3B5YmxrZnlvZndrZXFxZWdkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTM5OTkwNTQsImV4cCI6MjA2OTU3NTA1NH0.QcIqFLgD6Cg5hYu5Q4iQjvuckTVJyKo6wDd9AMEeakM"

# Liste des fonctions à déployer
$functions = @(
    "resolve-guest-link",
    "issue-guest-link", 
    "submit-guest-info",
    "save-contract-signature",
    "generate-documents",
    "list-guest-docs",
    "storage-sign-url",
    "extract-document-data",
    "sync-airbnb-calendar",
    "sync-airbnb-reservations",
    "get-airbnb-reservation",
    "send-owner-notification"
)

Write-Host "Projet: $projectRef" -ForegroundColor Yellow
Write-Host "Nombre de fonctions a deployer: $($functions.Count)" -ForegroundColor Yellow

# Headers pour l'API
$headers = @{
    "apikey" = $anonKey
    "Authorization" = "Bearer $anonKey"
    "Content-Type" = "application/json"
}

# Vérifier l'état actuel
Write-Host "`nVerification de l'etat actuel..." -ForegroundColor Blue

foreach ($function in $functions) {
    $url = "https://$projectRef.supabase.co/functions/v1/$function"
    
    try {
        $response = Invoke-WebRequest -Uri $url -Method GET -Headers $headers -TimeoutSec 10
        Write-Host "✅ $function : Fonctionne (Status: $($response.StatusCode))" -ForegroundColor Green
    } catch {
        if ($_.Exception.Response.StatusCode -eq 404) {
            Write-Host "❌ $function : Non deployee (404)" -ForegroundColor Red
        } else {
            Write-Host "⚠️ $function : Erreur $($_.Exception.Response.StatusCode)" -ForegroundColor Yellow
        }
    }
}

Write-Host "`nDiagnostic termine!" -ForegroundColor Cyan
Write-Host "Toutes les fonctions sont en erreur 404 - elles ne sont pas deployees" -ForegroundColor Red
Write-Host "`nSolutions:" -ForegroundColor Yellow
Write-Host "1. Utilisez le dashboard Supabase pour deployer manuellement" -ForegroundColor White
Write-Host "2. Poussez sur GitHub pour declencher le workflow automatique" -ForegroundColor White
Write-Host "3. Installez le CLI Supabase localement" -ForegroundColor White
