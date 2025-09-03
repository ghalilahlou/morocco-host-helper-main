# Script de redéploiement des fonctions Edge
Write-Host "Redéploiement des fonctions Edge..." -ForegroundColor Cyan

# Configuration
$projectRef = "csopyblkfyofwkeqqegd"
$anonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNzb3B5YmxrZnlvZndrZXFxZWdkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTM5OTkwNTQsImV4cCI6MjA2OTU3NTA1NH0.QcIqFLgD6Cg5hYu5Q4iQjvuckTVJyKo6wDd9AMEeakM"

# Méthode 1: Essayer de déclencher un redéploiement via l'API
Write-Host "`nMethode 1: Tentative de redéploiement via API..." -ForegroundColor Blue

$url = "https://$projectRef.supabase.co/functions/v1/resolve-guest-link"
$headers = @{
    "apikey" = $anonKey
    "Authorization" = "Bearer $anonKey"
    "Content-Type" = "application/json"
    "X-Client-Info" = "supabase-js/2.53.0"
}

# Test avec différents types de requêtes pour forcer un redéploiement
$testBodies = @(
    @{ propertyId = "test"; token = "test" },
    @{ propertyId = "demo"; token = "demo" },
    @{ propertyId = "sample"; token = "sample" }
)

foreach ($body in $testBodies) {
    $jsonBody = $body | ConvertTo-Json
    Write-Host "Test avec: $jsonBody" -ForegroundColor Yellow
    
    try {
        $response = Invoke-WebRequest -Uri $url -Method POST -Headers $headers -Body $jsonBody -TimeoutSec 15
        Write-Host "Status: $($response.StatusCode) - $($response.StatusDescription)" -ForegroundColor Green
        
        if ($response.StatusCode -eq 200) {
            Write-Host "SUCCES! Fonction fonctionne maintenant!" -ForegroundColor Green
            Write-Host "Reponse: $($response.Content)" -ForegroundColor Green
            break
        }
        
    } catch {
        $statusCode = $_.Exception.Response.StatusCode
        Write-Host "Erreur $statusCode: $($_.Exception.Response.StatusDescription)" -ForegroundColor Red
        
        if ($statusCode -eq 500) {
            Write-Host "Erreur serveur - la fonction est deployee mais a des problemes internes" -ForegroundColor Yellow
        }
    }
}

# Méthode 2: Vérifier l'état de la base de données
Write-Host "`nMethode 2: Verification de la base de donnees..." -ForegroundColor Blue

$dbUrl = "https://$projectRef.supabase.co/rest/v1/property_verification_tokens?select=*&limit=1"
try {
    $response = Invoke-WebRequest -Uri $dbUrl -Headers @{"apikey"=$anonKey} -TimeoutSec 10
    Write-Host "Base de donnees accessible: Status $($response.StatusCode)" -ForegroundColor Green
    
    if ($response.Content -ne "[]") {
        Write-Host "Donnees trouvees dans la table" -ForegroundColor Green
    } else {
        Write-Host "Table vide - c'est peut-etre le probleme!" -ForegroundColor Yellow
    }
    
} catch {
    Write-Host "Erreur acces base de donnees: $($_.Exception.Response.StatusCode)" -ForegroundColor Red
}

# Méthode 3: Test avec des paramètres réels
Write-Host "`nMethode 3: Test avec parametres reels..." -ForegroundColor Blue

# Essayer de récupérer des données réelles de la base
$realDataUrl = "https://$projectRef.supabase.co/rest/v1/properties?select=id&limit=1"
try {
    $response = Invoke-WebRequest -Uri $realDataUrl -Headers @{"apikey"=$anonKey} -TimeoutSec 10
    $properties = $response.Content | ConvertFrom-Json
    
    if ($properties -and $properties.Count -gt 0) {
        $realPropertyId = $properties[0].id
        Write-Host "Propriete trouvee: $realPropertyId" -ForegroundColor Green
        
        # Test avec une vraie propriété
        $realBody = @{
            propertyId = $realPropertyId
            token = "test-token-real"
        } | ConvertTo-Json
        
        Write-Host "Test avec vraie propriete: $realBody" -ForegroundColor Yellow
        
        try {
            $response = Invoke-WebRequest -Uri $url -Method POST -Headers $headers -Body $realBody -TimeoutSec 15
            Write-Host "Test reel: Status $($response.StatusCode)" -ForegroundColor Green
            Write-Host "Reponse: $($response.Content)" -ForegroundColor Green
        } catch {
            Write-Host "Test reel: Erreur $($_.Exception.Response.StatusCode)" -ForegroundColor Red
        }
        
    } else {
        Write-Host "Aucune propriete trouvee dans la base" -ForegroundColor Yellow
    }
    
} catch {
    Write-Host "Erreur acces proprietes: $($_.Exception.Response.StatusCode)" -ForegroundColor Red
}

Write-Host "`nDiagnostic complet termine!" -ForegroundColor Cyan
Write-Host "Si la fonction retourne toujours des erreurs, le probleme est dans la logique ou la base de donnees" -ForegroundColor Yellow
