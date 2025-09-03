# Test simple de la fonction Edge resolve-guest-link
Write-Host "Test de la fonction Edge resolve-guest-link" -ForegroundColor Cyan

# Configuration
$url = "https://csopyblkfyofwkeqqegd.supabase.co/functions/v1/resolve-guest-link"
$anonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNzb3B5YmxrZnlvZndrZXFxZWdkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTM5OTkwNTQsImV4cCI6MjA2OTU3NTA1NH0.QcIqFLgD6Cg5hYu5Q4iQjvuckTVJyKo6wDd9AMEeakM"

Write-Host "URL de test: $url" -ForegroundColor Yellow

# Headers
$headers = @{
    "Authorization" = "Bearer $anonKey"
    "Content-Type" = "application/json"
}

# Body de test
$body = @{
    propertyId = "test-property-id"
    token = "test-token"
} | ConvertTo-Json

Write-Host "Envoi de la requete de test..." -ForegroundColor Blue

try {
    # Test de la fonction
    $response = Invoke-RestMethod -Uri $url -Method POST -Headers $headers -Body $body -TimeoutSec 30
    
    Write-Host "SUCCES ! Fonction repond correctement" -ForegroundColor Green
    $response | ConvertTo-Json -Depth 3
    
} catch {
    Write-Host "ERREUR lors de l'appel de la fonction:" -ForegroundColor Red
    
    if ($_.Exception.Response) {
        $statusCode = $_.Exception.Response.StatusCode
        Write-Host "Code de statut: $statusCode" -ForegroundColor Red
        
        switch ($statusCode) {
            400 { Write-Host "Erreur 400: Mauvaise requete" -ForegroundColor Yellow }
            401 { Write-Host "Erreur 401: Non autorise" -ForegroundColor Yellow }
            403 { Write-Host "Erreur 403: Interdit" -ForegroundColor Yellow }
            404 { Write-Host "Erreur 404: Non trouve - La fonction Edge n'existe pas" -ForegroundColor Yellow }
            500 { Write-Host "Erreur 500: Erreur interne du serveur" -ForegroundColor Yellow }
            default { Write-Host "Erreur $statusCode: Probleme inconnu" -ForegroundColor Yellow }
        }
        
    } else {
        Write-Host "Message d'erreur: $($_.Exception.Message)" -ForegroundColor Red
    }
}

Write-Host "Test termine!" -ForegroundColor Cyan
