# Script de régénération de fiche de police pour un booking spécifique
# Usage: Remplacer BOOKING_ID et ANON_KEY puis exécuter

# =====================================================
# CONFIGURATION
# =====================================================

$SUPABASE_URL = "https://csopyblkfyofwkeqqegd.supabase.co"
$ANON_KEY = "REMPLACER_PAR_VOTRE_ANON_KEY"  # Votre clé anon Supabase
$BOOKING_ID = "REMPLACER_PAR_BOOKING_ID"     # ID du booking de Mouhcine

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  RÉGÉNÉRATION FICHE DE POLICE" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Booking ID: $BOOKING_ID" -ForegroundColor Yellow
Write-Host ""

# =====================================================
# VÉRIFICATION
# =====================================================

if ($ANON_KEY -eq "REMPLACER_PAR_VOTRE_ANON_KEY") {
    Write-Host "❌ ERREUR: Veuillez configurer ANON_KEY" -ForegroundColor Red
    Write-Host ""
    Write-Host "Pour obtenir votre ANON_KEY:" -ForegroundColor Yellow
    Write-Host "1. Allez sur https://supabase.com/dashboard/project/csopyblkfyofwkeqqegd/settings/api" -ForegroundColor Gray
    Write-Host "2. Copiez la clé 'anon public'" -ForegroundColor Gray
    exit 1
}

if ($BOOKING_ID -eq "REMPLACER_PAR_BOOKING_ID") {
    Write-Host "❌ ERREUR: Veuillez configurer BOOKING_ID" -ForegroundColor Red
    Write-Host ""
    Write-Host "Pour obtenir le BOOKING_ID:" -ForegroundColor Yellow
    Write-Host "1. Exécutez le script SQL: scripts/diagnostic_mouhcine_signature.sql" -ForegroundColor Gray
    Write-Host "2. Copiez le 'booking_id' retourné" -ForegroundColor Gray
    exit 1
}

# =====================================================
# RÉGÉNÉRATION
# =====================================================

Write-Host "🔄 Régénération en cours..." -ForegroundColor Yellow
Write-Host ""

$body = @{
    action = "regenerate_police_with_signature"
    bookingId = $BOOKING_ID
} | ConvertTo-Json

try {
    $response = Invoke-RestMethod -Uri "$SUPABASE_URL/functions/v1/submit-guest-info-unified" `
        -Method POST `
        -Headers @{
            "Authorization" = "Bearer $ANON_KEY"
            "Content-Type" = "application/json"
        } `
        -Body $body

    Write-Host "✅ SUCCÈS !" -ForegroundColor Green
    Write-Host ""
    Write-Host "Message: $($response.message)" -ForegroundColor White
    Write-Host "Signature guest présente: $($response.hasGuestSignature)" -ForegroundColor White
    Write-Host ""
    Write-Host "📄 Nouvelle fiche de police générée !" -ForegroundColor Green
    Write-Host ""
    Write-Host "💡 Vous pouvez maintenant télécharger la fiche depuis le dashboard" -ForegroundColor Cyan
    
} catch {
    Write-Host "❌ ERREUR lors de la régénération" -ForegroundColor Red
    Write-Host ""
    Write-Host "Détails de l'erreur:" -ForegroundColor Yellow
    Write-Host $_.Exception.Message -ForegroundColor Red
    Write-Host ""
    
    if ($_.Exception.Response) {
        $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
        $responseBody = $reader.ReadToEnd()
        Write-Host "Réponse du serveur:" -ForegroundColor Yellow
        Write-Host $responseBody -ForegroundColor Red
    }
    
    exit 1
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  ✅ TERMINÉ" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
