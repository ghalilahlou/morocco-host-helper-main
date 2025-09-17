# Script PowerShell de vérification de la santé des Edge Functions
# Usage: .\scripts\health-check.ps1

Write-Host "🔍 Vérification de la santé des Edge Functions..." -ForegroundColor Blue

# Vérifier que les services Docker sont en cours d'exécution
$services = docker-compose -f docker-compose.functions.yml ps
if (-not ($services -match "Up")) {
    Write-Host "❌ Les services Docker ne sont pas en cours d'exécution" -ForegroundColor Red
    exit 1
}

# Liste des fonctions à tester
$functions = @(
    "sync-documents",
    "submit-guest-info", 
    "generate-documents",
    "issue-guest-link",
    "resolve-guest-link"
)

$baseUrl = "http://localhost:54321/functions/v1"

Write-Host "🧪 Test des Edge Functions..." -ForegroundColor Blue

foreach ($func in $functions) {
    Write-Host "Testing $func..." -ForegroundColor Yellow
    
    # Test avec une requête OPTIONS (CORS)
    try {
        $corsResponse = Invoke-WebRequest -Uri "$baseUrl/$func" `
            -Method OPTIONS `
            -Headers @{
                "Access-Control-Request-Method" = "POST"
                "Access-Control-Request-Headers" = "authorization,content-type"
                "Origin" = "http://localhost:3000"
            } `
            -ErrorAction Stop
        Write-Host "✅ $func - CORS OK" -ForegroundColor Green
    } catch {
        Write-Host "❌ $func - CORS FAILED" -ForegroundColor Red
    }
    
    # Test avec une requête POST (avec gestion d'erreur attendue)
    try {
        $postResponse = Invoke-WebRequest -Uri "$baseUrl/$func" `
            -Method POST `
            -Headers @{
                "Content-Type" = "application/json"
                "Authorization" = "Bearer $env:SUPABASE_ANON_KEY"
            } `
            -Body '{"test": true}' `
            -ErrorAction Stop
        Write-Host "✅ $func - HTTP $($postResponse.StatusCode) (OK)" -ForegroundColor Green
    } catch {
        $statusCode = $_.Exception.Response.StatusCode.value__
        if ($statusCode -eq 200 -or $statusCode -eq 400 -or $statusCode -eq 401) {
            Write-Host "✅ $func - HTTP $statusCode (OK)" -ForegroundColor Green
        } else {
            Write-Host "❌ $func - HTTP $statusCode (FAILED)" -ForegroundColor Red
        }
    }
}

Write-Host "📊 Résumé des tests terminé" -ForegroundColor Blue
Write-Host "🔗 URL des fonctions: $baseUrl" -ForegroundColor Cyan
