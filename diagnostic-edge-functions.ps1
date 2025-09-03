# 🚀 SCRIPT DE DIAGNOSTIC AUTOMATIQUE - EDGE FUNCTIONS
# Ce script diagnostique automatiquement les problèmes avec resolve-guest-link

Write-Host "🔍 DIAGNOSTIC AUTOMATIQUE DES EDGE FUNCTIONS" -ForegroundColor Cyan
Write-Host "=============================================" -ForegroundColor Cyan

# 1. VÉRIFICATION DE LA CONNECTIVITÉ
Write-Host "`n📡 Test de connectivité vers Supabase..." -ForegroundColor Yellow
try {
    $connection = Test-NetConnection -ComputerName "csopyblkfyofwkeqqegd.supabase.co" -Port 443 -InformationLevel Quiet
    if ($connection.TcpTestSucceeded) {
        Write-Host "✅ Connectivité OK vers Supabase" -ForegroundColor Green
    } else {
        Write-Host "❌ Problème de connectivité vers Supabase" -ForegroundColor Red
        exit 1
    }
} catch {
    Write-Host "❌ Erreur de test de connectivité: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

# 2. DEMANDE DE L'ANON_KEY
Write-Host "`n🔑 Configuration de l'authentification..." -ForegroundColor Yellow
$anonKey = Read-Host "Entrez votre anon_key (trouvable dans Settings > API)"

if ([string]::IsNullOrEmpty($anonKey)) {
    Write-Host "❌ Anon_key manquante" -ForegroundColor Red
    exit 1
}

Write-Host "✅ Anon_key configurée" -ForegroundColor Green

# 3. TEST DE LA FONCTION resolve-guest-link
Write-Host "`n🧪 Test de la fonction resolve-guest-link..." -ForegroundColor Yellow

$headers = @{
    "Authorization" = "Bearer $anonKey"
    "Content-Type" = "application/json"
}

$body = @{
    propertyId = "test-property-id"
    token = "test-token"
} | ConvertTo-Json

try {
    Write-Host "📤 Envoi de la requête..." -ForegroundColor Blue
    
    $response = Invoke-RestMethod -Uri "https://csopyblkfyofwkeqqegd.supabase.co/functions/v1/resolve-guest-link" -Method POST -Headers $headers -Body $body -TimeoutSec 30
    
    Write-Host "✅ Fonction répond correctement!" -ForegroundColor Green
    Write-Host "📄 Réponse reçue:" -ForegroundColor Green
    $response | ConvertTo-Json -Depth 3
    
} catch {
    Write-Host "❌ Erreur lors de l'appel de la fonction:" -ForegroundColor Red
    
    if ($_.Exception.Response) {
        $statusCode = $_.Exception.Response.StatusCode
        Write-Host "📊 Code de statut: $statusCode" -ForegroundColor Red
        
        switch ($statusCode) {
            400 { Write-Host "🔍 Erreur 400: Mauvaise requête (paramètres invalides)" -ForegroundColor Yellow }
            401 { Write-Host "🔍 Erreur 401: Non autorisé (problème d'authentification)" -ForegroundColor Yellow }
            403 { Write-Host "🔍 Erreur 403: Interdit (permissions insuffisantes)" -ForegroundColor Yellow }
            404 { Write-Host "🔍 Erreur 404: Non trouvé (fonction inexistante ou mal configurée)" -ForegroundColor Yellow }
            500 { Write-Host "🔍 Erreur 500: Erreur interne du serveur" -ForegroundColor Yellow }
            default { Write-Host "🔍 Erreur $statusCode: Problème inconnu" -ForegroundColor Yellow }
        }
        
        # Essayer de récupérer le message d'erreur
        try {
            $errorResponse = $_.Exception.Response.GetResponseStream()
            $reader = New-Object System.IO.StreamReader($errorResponse)
            $errorBody = $reader.ReadToEnd()
            Write-Host "📄 Corps de l'erreur: $errorBody" -ForegroundColor Red
        } catch {
            Write-Host "📄 Impossible de récupérer le corps de l'erreur" -ForegroundColor Red
        }
    } else {
        Write-Host "📄 Message d'erreur: $($_.Exception.Message)" -ForegroundColor Red
    }
}

# 4. TEST AVEC DES PARAMÈTRES RÉELS
Write-Host "`n🔍 Test avec des paramètres réels..." -ForegroundColor Yellow
Write-Host "Voulez-vous tester avec des paramètres réels ? (o/n)" -ForegroundColor Cyan
$testReel = Read-Host

if ($testReel -eq "o" -or $testReel -eq "O") {
    $realPropertyId = Read-Host "Entrez un propertyId réel"
    $realToken = Read-Host "Entrez un token réel"
    
    $realBody = @{
        propertyId = $realPropertyId
        token = $realToken
    } | ConvertTo-Json
    
    try {
        Write-Host "📤 Test avec paramètres réels..." -ForegroundColor Blue
        
        $realResponse = Invoke-RestMethod -Uri "https://csopyblkfyofwkeqqegd.supabase.co/functions/v1/resolve-guest-link" -Method POST -Headers $headers -Body $realBody -TimeoutSec 30
        
        Write-Host "✅ Test avec paramètres réels réussi!" -ForegroundColor Green
        Write-Host "📄 Réponse:" -ForegroundColor Green
        $realResponse | ConvertTo-Json -Depth 3
        
    } catch {
        Write-Host "❌ Test avec paramètres réels échoué:" -ForegroundColor Red
        Write-Host "📄 Message: $($_.Exception.Message)" -ForegroundColor Red
    }
}

# 5. RÉSUMÉ DU DIAGNOSTIC
Write-Host "`n📋 RÉSUMÉ DU DIAGNOSTIC" -ForegroundColor Cyan
Write-Host "=====================" -ForegroundColor Cyan

Write-Host "✅ Connectivité Supabase: OK" -ForegroundColor Green
Write-Host "✅ Anon_key: Configurée" -ForegroundColor Green

if ($response) {
    Write-Host "✅ Fonction resolve-guest-link: OPÉRATIONNELLE" -ForegroundColor Green
    Write-Host "🎯 Le problème vient du frontend, pas de la fonction" -ForegroundColor Green
} else {
    Write-Host "❌ Fonction resolve-guest-link: PROBLÈME DÉTECTÉ" -ForegroundColor Red
    Write-Host "🔧 Vérifiez la configuration de la fonction dans Supabase" -ForegroundColor Yellow
}

Write-Host "`n🚀 Diagnostic terminé!" -ForegroundColor Cyan
Write-Host "Consultez les résultats ci-dessus pour identifier le problème." -ForegroundColor Cyan
