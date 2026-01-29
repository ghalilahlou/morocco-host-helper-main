# Script pour régénérer la fiche de police avec signature
# Pour le booking de MOUHCINE TEMSAMANI

$SUPABASE_URL = "https://csopyblkfyofwkeqqegd.supabase.co"
$ANON_KEY = $env:ANON_KEY

if (-not $ANON_KEY) {
    Write-Host "❌ ERREUR: Variable d'environnement ANON_KEY non définie" -ForegroundColor Red
    Write-Host "Définissez-la avec: `$env:ANON_KEY = 'votre_clé'" -ForegroundColor Yellow
    exit 1
}

# 1. Récupérer d'abord la signature depuis contract_signatures
Write-Host "`n🔍 Étape 1: Récupération de la signature..." -ForegroundColor Cyan

$bookingId = "e5448f75-b793-4b2d-99b8-f7d3ccc37604"

$signatureQuery = @{
    Uri = "$SUPABASE_URL/rest/v1/contract_signatures?booking_id=eq.$bookingId`&order=created_at.desc`&limit=1`&select=signature_data,signed_at,signer_email"
    Method = "GET"
    Headers = @{
        "apikey" = $ANON_KEY
        "Authorization" = "Bearer $ANON_KEY"
    }
}

try {
    $signatureResponse = Invoke-RestMethod @signatureQuery
    
    if ($signatureResponse -and $signatureResponse.Count -gt 0) {
        $signature = $signatureResponse[0]
        Write-Host "✅ Signature trouvée!" -ForegroundColor Green
        Write-Host "   - Email: $($signature.signer_email)" -ForegroundColor Gray
        Write-Host "   - Signée le: $($signature.signed_at)" -ForegroundColor Gray
        Write-Host "   - Longueur: $($signature.signature_data.Length) caractères" -ForegroundColor Gray
        
        # 2. Appeler submit-guest-info-unified avec l'action regenerate_police_with_signature
        Write-Host "`n🔄 Étape 2: Régénération de la fiche de police..." -ForegroundColor Cyan
        
        $body = @{
            action = "regenerate_police_with_signature"
            bookingId = $bookingId
            signature = @{
                data = $signature.signature_data
                timestamp = $signature.signed_at
            }
        } | ConvertTo-Json -Depth 10
        
        Write-Host "`n📤 Envoi de la requête..." -ForegroundColor Yellow
        Write-Host "Body: $($body.Substring(0, [Math]::Min(500, $body.Length)))..." -ForegroundColor Gray
        
        $regenerateParams = @{
            Uri = "$SUPABASE_URL/functions/v1/submit-guest-info-unified"
            Method = "POST"
            Headers = @{
                "apikey" = $ANON_KEY
                "Authorization" = "Bearer $ANON_KEY"
                "Content-Type" = "application/json"
            }
            Body = $body
        }
        
        $result = Invoke-RestMethod @regenerateParams
        
        Write-Host "`n✅ SUCCÈS! Fiche de police régénérée" -ForegroundColor Green
        Write-Host "`n📊 Résultat:" -ForegroundColor Cyan
        Write-Host ($result | ConvertTo-Json -Depth 5) -ForegroundColor White
        
        if ($result.data.policeUrl) {
            Write-Host "`n🔗 URL de la fiche de police:" -ForegroundColor Cyan
            Write-Host $result.data.policeUrl -ForegroundColor Green
            Write-Host "`n⚠️ Ouvrez ce lien pour vérifier que la signature du guest apparaît!" -ForegroundColor Yellow
        }
        
    } else {
        Write-Host "❌ Aucune signature trouvée pour ce booking" -ForegroundColor Red
        Write-Host "Booking ID: $bookingId" -ForegroundColor Gray
    }
    
} catch {
    Write-Host "`n❌ ERREUR lors de l'exécution:" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    Write-Host "`nDétails de l'erreur:" -ForegroundColor Yellow
    Write-Host $_ -ForegroundColor Gray
}

Write-Host "`n✅ Script terminé" -ForegroundColor Cyan
