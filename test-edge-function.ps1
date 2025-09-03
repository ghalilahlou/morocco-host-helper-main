# 🧪 TEST SIMPLE DE LA FONCTION EDGE resolve-guest-link
Write-Host "🧪 TEST DE LA FONCTION EDGE resolve-guest-link" -ForegroundColor Cyan
Write-Host "=============================================" -ForegroundColor Cyan

# Configuration
$url = "https://csopyblkfyofwkeqqegd.supabase.co/functions/v1/resolve-guest-link"
$anonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNzb3B5YmxrZnlvZndrZXFxZWdkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTM5OTkwNTQsImV4cCI6MjA2OTU3NTA1NH0.QcIqFLgD6Cg5hYu5Q4iQjvuckTVJyKo6wDd9AMEeakM"

Write-Host "🔗 URL de test: $url" -ForegroundColor Yellow
Write-Host "🔑 Anon Key: $($anonKey.Substring(0, 20))..." -ForegroundColor Yellow

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

Write-Host "`n📤 Envoi de la requête de test..." -ForegroundColor Blue
Write-Host "📄 Body: $body" -ForegroundColor Blue

try {
    # Test de la fonction
    $response = Invoke-RestMethod -Uri $url -Method POST -Headers $headers -Body $body -TimeoutSec 30
    
    Write-Host "`n✅ SUCCÈS ! Fonction répond correctement" -ForegroundColor Green
    Write-Host "📄 Réponse reçue:" -ForegroundColor Green
    $response | ConvertTo-Json -Depth 3
    
    Write-Host "`n🎯 DIAGNOSTIC: Le problème vient du FRONTEND" -ForegroundColor Green
    Write-Host "La fonction Edge fonctionne, vérifiez votre code frontend" -ForegroundColor Green
    
} catch {
    Write-Host "`n❌ ERREUR lors de l'appel de la fonction:" -ForegroundColor Red
    
    if ($_.Exception.Response) {
        $statusCode = $_.Exception.Response.StatusCode
        Write-Host "📊 Code de statut: $statusCode" -ForegroundColor Red
        
        switch ($statusCode) {
            400 { 
                Write-Host "🔍 Erreur 400: Mauvaise requête" -ForegroundColor Yellow
                Write-Host "   Vérifiez les paramètres propertyId et token" -ForegroundColor Yellow
            }
            401 { 
                Write-Host "🔍 Erreur 401: Non autorisé" -ForegroundColor Yellow
                Write-Host "   Problème d'authentification avec l'anon_key" -ForegroundColor Yellow
            }
            403 { 
                Write-Host "🔍 Erreur 403: Interdit" -ForegroundColor Yellow
                Write-Host "   Permissions insuffisantes" -ForegroundColor Yellow
            }
            404 { 
                Write-Host "🔍 Erreur 404: Non trouvé" -ForegroundColor Yellow
                Write-Host "   La fonction Edge n'existe pas ou n'est pas accessible" -ForegroundColor Yellow
            }
            500 { 
                Write-Host "🔍 Erreur 500: Erreur interne du serveur" -ForegroundColor Yellow
                Write-Host "   Problème côté Supabase" -ForegroundColor Yellow
            }
            default { 
                Write-Host "🔍 Erreur $statusCode: Problème inconnu" -ForegroundColor Yellow
            }
        }
        
        Write-Host "`n🎯 DIAGNOSTIC: Problème côté SUPABASE" -ForegroundColor Red
        Write-Host "Vérifiez la configuration de la fonction Edge dans Supabase" -ForegroundColor Yellow
        
    } else {
        Write-Host "📄 Message d'erreur: $($_.Exception.Message)" -ForegroundColor Red
        Write-Host "`n🎯 DIAGNOSTIC: Problème de réseau ou de timeout" -ForegroundColor Red
    }
}

Write-Host "`n🚀 Test terminé!" -ForegroundColor Cyan
Write-Host "Consultez les résultats ci-dessus pour identifier le problème." -ForegroundColor Cyan
