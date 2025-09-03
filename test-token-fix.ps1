# Script de test et correction du problème de token
Write-Host "Test et correction du probleme de token..." -ForegroundColor Cyan

# Configuration
$projectRef = "csopyblkfyofwkeqqegd"
$anonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNzb3B5YmxrZnlvZndrZXFxZWdkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTM5OTkwNTQsImV4cCI6MjA2OTU3NTA1NH0.QcIqFLgD6Cg5hYu5Q4iQjvuckTVJyKo6wDd9AMEeakM"

Write-Host "Projet: $projectRef" -ForegroundColor Yellow

# Étape 1: Vérifier la structure du token dans la base
Write-Host "`nEtape 1: Verification de la structure du token..." -ForegroundColor Blue

$tokenUrl = "https://$projectRef.supabase.co/rest/v1/property_verification_tokens?select=*&limit=5"
try {
    $response = Invoke-WebRequest -Uri $tokenUrl -Headers @{"apikey"=$anonKey} -TimeoutSec 10
    $tokens = $response.Content | ConvertFrom-Json
    
    Write-Host "✅ Tokens trouves: $($tokens.Count)" -ForegroundColor Green
    
    foreach ($token in $tokens) {
        $hasBooking = $token.booking_id -ne $null
        $status = if ($hasBooking) { "AVEC booking_id" } else { "SANS booking_id" }
        $color = if ($hasBooking) { "Yellow" } else { "Green" }
        
        Write-Host "   Token: $($token.token.Substring(0, 20))... - $status" -ForegroundColor $color
        Write-Host "   Property: $($token.property_id) - Active: $($token.is_active)" -ForegroundColor $color
        if ($hasBooking) {
            Write-Host "   Booking ID: $($token.booking_id)" -ForegroundColor $color
        }
        Write-Host ""
    }
    
} catch {
    Write-Host "❌ Erreur acces tokens: $($_.Exception.Response.StatusCode)" -ForegroundColor Red
}

# Étape 2: Test avec token SANS booking_id
Write-Host "`nEtape 2: Test avec token SANS booking_id..." -ForegroundColor Blue

# Chercher un token sans booking_id
$generalTokenUrl = "https://$projectRef.supabase.co/rest/v1/property_verification_tokens?select=*&booking_id=is.null&is_active=eq.true&limit=1"
try {
    $response = Invoke-WebRequest -Uri $generalTokenUrl -Headers @{"apikey"=$anonKey} -TimeoutSec 10
    $generalTokens = $response.Content | ConvertFrom-Json
    
    if ($generalTokens -and $generalTokens.Count -gt 0) {
        $generalToken = $generalTokens[0]
        Write-Host "✅ Token general trouve: $($generalToken.token.Substring(0, 20))..." -ForegroundColor Green
        
        # Test de la fonction avec ce token
        $testBody = @{
            propertyId = $generalToken.property_id
            token = $generalToken.token
        } | ConvertTo-Json
        
        Write-Host "Test avec token general: $testBody" -ForegroundColor Yellow
        
        $functionUrl = "https://$projectRef.supabase.co/functions/v1/resolve-guest-link"
        try {
            $response = Invoke-WebRequest -Uri $functionUrl -Method POST -Headers @{"Authorization"="Bearer $anonKey"; "Content-Type"="application/json"} -Body $testBody -TimeoutSec 15
            Write-Host "✅ SUCCES! Fonction fonctionne avec token general" -ForegroundColor Green
            Write-Host "Reponse: $($response.Content)" -ForegroundColor Green
        } catch {
            Write-Host "❌ Erreur fonction: $($_.Exception.Response.StatusCode)" -ForegroundColor Red
        }
        
    } else {
        Write-Host "❌ Aucun token general trouve" -ForegroundColor Red
    }
    
} catch {
    Write-Host "❌ Erreur recherche token general: $($_.Exception.Response.StatusCode)" -ForegroundColor Red
}

Write-Host "`nDiagnostic termine!" -ForegroundColor Cyan
Write-Host "Le probleme vient du fait que vos tokens ont des booking_id" -ForegroundColor Yellow
Write-Host "La fonction resolve-guest-link cherche des tokens SANS booking_id" -ForegroundColor Yellow
