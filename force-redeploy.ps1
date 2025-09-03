# Script de redéploiement forcé des fonctions Edge
Write-Host "Redéploiement forcé des fonctions Edge..." -ForegroundColor Cyan

# Configuration
$projectRef = "csopyblkfyofwkeqqegd"
$anonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNzb3B5YmxrZnlvZndrZXFxZWdkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTM5OTkwNTQsImV4cCI6MjA2OTU3NTA1NH0.QcIqFLgD6Cg5hYu5Q4iQjvuckTVJyKo6wDd9AMEeakM"

# Test de la fonction resolve-guest-link avec différentes méthodes
Write-Host "`nTest de resolve-guest-link avec differentes methodes..." -ForegroundColor Blue

$url = "https://$projectRef.supabase.co/functions/v1/resolve-guest-link"
$headers = @{
    "apikey" = $anonKey
    "Authorization" = "Bearer $anonKey"
    "Content-Type" = "application/json"
}

# Test GET
Write-Host "Test GET..." -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri $url -Method GET -Headers $headers -TimeoutSec 10
    Write-Host "GET: Status $($response.StatusCode)" -ForegroundColor Green
} catch {
    Write-Host "GET: Erreur $($_.Exception.Response.StatusCode)" -ForegroundColor Red
}

# Test POST avec body vide
Write-Host "Test POST avec body vide..." -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri $url -Method POST -Headers $headers -Body "{}" -TimeoutSec 10
    Write-Host "POST vide: Status $($response.StatusCode)" -ForegroundColor Green
} catch {
    Write-Host "POST vide: Erreur $($_.Exception.Response.StatusCode)" -ForegroundColor Red
}

# Test POST avec paramètres valides
Write-Host "Test POST avec parametres valides..." -ForegroundColor Yellow
$body = @{
    propertyId = "test-property"
    token = "test-token"
} | ConvertTo-Json

try {
    $response = Invoke-WebRequest -Uri $url -Method POST -Headers $headers -Body $body -TimeoutSec 10
    Write-Host "POST valide: Status $($response.StatusCode)" -ForegroundColor Green
    Write-Host "Reponse: $($response.Content)" -ForegroundColor Green
} catch {
    Write-Host "POST valide: Erreur $($_.Exception.Response.StatusCode)" -ForegroundColor Red
    if ($_.Exception.Response) {
        Write-Host "Details: $($_.Exception.Response.StatusDescription)" -ForegroundColor Red
    }
}

Write-Host "`nDiagnostic termine!" -ForegroundColor Cyan
Write-Host "Si vous obtenez des erreurs 400/500, les fonctions sont deployees mais mal configurees" -ForegroundColor Yellow
Write-Host "Si vous obtenez des erreurs 404, les fonctions ne sont pas deployees" -ForegroundColor Red
