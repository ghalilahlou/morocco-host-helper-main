# 🚀 DÉPLOIEMENT AUTOMATIQUE DE LA FONCTION EDGE resolve-guest-link
Write-Host "🚀 DÉPLOIEMENT DE LA FONCTION EDGE resolve-guest-link" -ForegroundColor Cyan
Write-Host "=====================================================" -ForegroundColor Cyan

Write-Host "`n📋 Vérification des prérequis..." -ForegroundColor Yellow

# Vérifier si supabase CLI est installé
try {
    $supabaseVersion = supabase --version
    Write-Host "✅ Supabase CLI détecté: $supabaseVersion" -ForegroundColor Green
} catch {
    Write-Host "❌ Supabase CLI non trouvé!" -ForegroundColor Red
    Write-Host "📥 Installez-le via: winget install Supabase.CLI" -ForegroundColor Yellow
    Write-Host "   Ou: https://supabase.com/docs/guides/cli" -ForegroundColor Yellow
    exit 1
}

Write-Host "`n🔍 Vérification du statut du projet..." -ForegroundColor Yellow

try {
    $status = supabase status
    Write-Host "✅ Projet Supabase connecté" -ForegroundColor Green
    Write-Host $status
} catch {
    Write-Host "❌ Erreur de connexion au projet Supabase" -ForegroundColor Red
    Write-Host "🔑 Vérifiez votre authentification: supabase login" -ForegroundColor Yellow
    exit 1
}

Write-Host "`n🚀 Déploiement de la fonction Edge..." -ForegroundColor Yellow

try {
    Write-Host "📤 Déploiement de resolve-guest-link..." -ForegroundColor Blue
    $deployResult = supabase functions deploy resolve-guest-link --no-verify-jwt
    
    Write-Host "✅ Déploiement réussi!" -ForegroundColor Green
    Write-Host $deployResult
    
} catch {
    Write-Host "❌ Erreur lors du déploiement:" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    exit 1
}

Write-Host "`n🔍 Vérification du déploiement..." -ForegroundColor Yellow

try {
    $functions = supabase functions list
    Write-Host "📋 Fonctions Edge disponibles:" -ForegroundColor Green
    Write-Host $functions
    
    if ($functions -match "resolve-guest-link") {
        Write-Host "✅ resolve-guest-link est maintenant déployée!" -ForegroundColor Green
    } else {
        Write-Host "❌ resolve-guest-link n'apparaît pas dans la liste" -ForegroundColor Red
    }
    
} catch {
    Write-Host "❌ Erreur lors de la vérification:" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
}

Write-Host "`n🧪 Test de la fonction déployée..." -ForegroundColor Yellow

# Test simple de la fonction
$url = "https://csopyblkfyofwkeqqegd.supabase.co/functions/v1/resolve-guest-link"
$anonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNzb3B5YmxrZnlvZndrZXFxZWdkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTM5OTkwNTQsImV4cCI6MjA2OTU3NTA1NH0.QcIqFLgD6Cg5hYu5Q4iQjvuckTVJyKo6wDd9AMEeakM"

$headers = @{
    "Authorization" = "Bearer $anonKey"
    "Content-Type" = "application/json"
}

$body = @{
    propertyId = "test-property-id"
    token = "test-token"
} | ConvertTo-Json

try {
    $response = Invoke-RestMethod -Uri $url -Method POST -Headers $headers -Body $body -TimeoutSec 30
    
    Write-Host "✅ SUCCÈS ! Fonction répond correctement" -ForegroundColor Green
    Write-Host "📄 Réponse: $($response | ConvertTo-Json)" -ForegroundColor Green
    
} catch {
    if ($_.Exception.Response) {
        $statusCode = $_.Exception.Response.StatusCode
        Write-Host "📊 Code de statut: $statusCode" -ForegroundColor Yellow
        
        if ($statusCode -eq 404) {
            Write-Host "❌ La fonction n'est toujours pas accessible (404)" -ForegroundColor Red
            Write-Host "🔄 Attendez quelques minutes et réessayez" -ForegroundColor Yellow
        } else {
            Write-Host "🔍 Erreur $statusCode: $($_.Exception.Message)" -ForegroundColor Yellow
        }
    } else {
        Write-Host "❌ Erreur de test: $($_.Exception.Message)" -ForegroundColor Red
    }
}

Write-Host "`n🚀 Déploiement terminé!" -ForegroundColor Cyan
Write-Host "Si la fonction fonctionne, testez votre réservation sur Vercel!" -ForegroundColor Green
