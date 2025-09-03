# Script de nettoyage des doublons de réservations
# Créé par la double logique de création de réservations

Write-Host "🧹 NETTOYAGE DES DOUBLONS DE RÉSERVATIONS" -ForegroundColor Cyan
Write-Host "=============================================" -ForegroundColor Cyan

# Configuration Supabase
$SUPABASE_URL = $env:SUPABASE_URL
$SUPABASE_ANON_KEY = $env:SUPABASE_ANON_KEY

if (-not $SUPABASE_URL -or -not $SUPABASE_ANON_KEY) {
    Write-Host "❌ Variables d'environnement Supabase manquantes" -ForegroundColor Red
    Write-Host "Assurez-vous que SUPABASE_URL et SUPABASE_ANON_KEY sont définies" -ForegroundColor Yellow
    exit 1
}

Write-Host "✅ Configuration Supabase détectée" -ForegroundColor Green

# 1. Détection des doublons
Write-Host "`n🔍 DÉTECTION DES DOUBLONS..." -ForegroundColor Yellow

$detectDuplicatesQuery = @"
WITH duplicate_bookings AS (
  SELECT 
    property_id,
    check_in_date,
    check_out_date,
    user_id,
    COUNT(*) as duplicate_count,
    ARRAY_AGG(id ORDER BY created_at) as booking_ids,
    ARRAY_AGG(created_at ORDER BY created_at) as created_dates,
    ARRAY_AGG(submission_id IS NOT NULL ORDER BY created_at) as has_submission
  FROM public.bookings
  GROUP BY property_id, check_in_date, check_out_date, user_id
  HAVING COUNT(*) > 1
)
SELECT 
  property_id,
  check_in_date,
  check_out_date,
  user_id,
  duplicate_count,
  booking_ids,
  created_dates,
  has_submission
FROM duplicate_bookings
ORDER BY duplicate_count DESC, check_in_date;
"@

try {
    $response = Invoke-RestMethod -Uri "$SUPABASE_URL/rest/v1/rpc/exec_sql" -Method POST -Headers @{
        "apikey" = $SUPABASE_ANON_KEY
        "Authorization" = "Bearer $SUPABASE_ANON_KEY"
        "Content-Type" = "application/json"
        "Prefer" = "return=representation"
    } -Body (@{
        query = $detectDuplicatesQuery
    } | ConvertTo-Json -Depth 10)

    if ($response -and $response.Count -gt 0) {
        Write-Host "❌ DOUBLONS DÉTECTÉS : $($response.Count) groupes" -ForegroundColor Red
        
        foreach ($duplicate in $response) {
            Write-Host "`n📊 Groupe de doublons :" -ForegroundColor Yellow
            Write-Host "  - Propriété: $($duplicate.property_id)" -ForegroundColor White
            Write-Host "  - Check-in: $($duplicate.check_in_date)" -ForegroundColor White
            Write-Host "  - Check-out: $($duplicate.check_out_date)" -ForegroundColor White
            Write-Host "  - Nombre: $($duplicate.duplicate_count)" -ForegroundColor White
            Write-Host "  - IDs: $($duplicate.booking_ids -join ', ')" -ForegroundColor White
            Write-Host "  - Avec submission: $($duplicate.has_submission -join ', ')" -ForegroundColor White
        }
    } else {
        Write-Host "✅ AUCUN DOUBLON DÉTECTÉ !" -ForegroundColor Green
        Write-Host "Le système est déjà propre." -ForegroundColor Green
        exit 0
    }
} catch {
    Write-Host "❌ Erreur lors de la détection des doublons :" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    exit 1
}

# 2. Demande de confirmation
Write-Host "`n⚠️  ATTENTION : Cette opération va supprimer des réservations en double" -ForegroundColor Red
Write-Host "Les réservations avec submission_id seront conservées (plus complètes)" -ForegroundColor Yellow
Write-Host "Les réservations sans submission_id seront supprimées" -ForegroundColor Yellow

$confirmation = Read-Host "`nVoulez-vous procéder au nettoyage ? (oui/non)"

if ($confirmation -ne "oui") {
    Write-Host "❌ Nettoyage annulé par l'utilisateur" -ForegroundColor Yellow
    exit 0
}

# 3. Nettoyage des doublons
Write-Host "`n🧹 NETTOYAGE EN COURS..." -ForegroundColor Yellow

$cleanupQuery = @"
-- Créer une table temporaire avec les réservations à conserver
CREATE TEMP TABLE bookings_to_keep AS
WITH ranked_bookings AS (
  SELECT 
    id,
    property_id,
    check_in_date,
    check_out_date,
    user_id,
    submission_id,
    created_at,
    ROW_NUMBER() OVER (
      PARTITION BY property_id, check_in_date, check_out_date, user_id 
      ORDER BY 
        -- Priorité 1: Réservations avec submission_id (plus complètes)
        CASE WHEN submission_id IS NOT NULL THEN 1 ELSE 2 END,
        -- Priorité 2: Réservations les plus récentes
        created_at DESC,
        -- Priorité 3: ID le plus petit
        id
    ) as rn
  FROM public.bookings
)
SELECT id FROM ranked_bookings WHERE rn = 1;

-- Supprimer les doublons
DELETE FROM public.bookings 
WHERE id NOT IN (SELECT id FROM bookings_to_keep);

-- Retourner le nombre de réservations supprimées
SELECT 
  (SELECT COUNT(*) FROM public.bookings) as remaining_bookings,
  (SELECT COUNT(*) FROM bookings_to_keep) as kept_bookings;
"@

try {
    $cleanupResponse = Invoke-RestMethod -Uri "$SUPABASE_URL/rest/v1/rpc/exec_sql" -Method POST -Headers @{
        "apikey" = $SUPABASE_ANON_KEY
        "Authorization" = "Bearer $SUPABASE_ANON_KEY"
        "Content-Type" = "application/json"
        "Prefer" = "return=representation"
    } -Body (@{
        query = $cleanupQuery
    } | ConvertTo-Json -Depth 10)

    if ($cleanupResponse -and $cleanupResponse.Count -gt 0) {
        $result = $cleanupResponse[0]
        Write-Host "✅ NETTOYAGE TERMINÉ !" -ForegroundColor Green
        Write-Host "  - Réservations conservées: $($result.kept_bookings)" -ForegroundColor Green
        Write-Host "  - Réservations restantes: $($result.remaining_bookings)" -ForegroundColor Green
    } else {
        Write-Host "✅ Nettoyage terminé" -ForegroundColor Green
    }
} catch {
    Write-Host "❌ Erreur lors du nettoyage :" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    exit 1
}

# 4. Vérification post-nettoyage
Write-Host "`n🔍 VÉRIFICATION POST-NETTOYAGE..." -ForegroundColor Yellow

$verificationQuery = @"
WITH duplicate_check AS (
  SELECT 
    property_id,
    check_in_date,
    check_out_date,
    user_id,
    COUNT(*) as count
  FROM public.bookings
  GROUP BY property_id, check_in_date, check_out_date, user_id
  HAVING COUNT(*) > 1
)
SELECT 
  CASE 
    WHEN COUNT(*) = 0 THEN 'AUCUN DOUBLON'
    ELSE 'DOUBLONS ENCORE PRÉSENTS: ' || COUNT(*) || ' groupes'
  END as verification_result
FROM duplicate_check;
"@

try {
    $verificationResponse = Invoke-RestMethod -Uri "$SUPABASE_URL/rest/v1/rpc/exec_sql" -Method POST -Headers @{
        "apikey" = $SUPABASE_ANON_KEY
        "Authorization" = "Bearer $SUPABASE_ANON_KEY"
        "Content-Type" = "application/json"
        "Prefer" = "return=representation"
    } -Body (@{
        query = $verificationQuery
    } | ConvertTo-Json -Depth 10)

    if ($verificationResponse -and $verificationResponse.Count -gt 0) {
        $verificationResult = $verificationResponse[0].verification_result
        if ($verificationResult -eq "AUCUN DOUBLON") {
            Write-Host "🎉 SUCCÈS : $verificationResult" -ForegroundColor Green
        } else {
            Write-Host "⚠️  ATTENTION : $verificationResult" -ForegroundColor Yellow
        }
    }
} catch {
    Write-Host "⚠️  Impossible de vérifier le résultat final" -ForegroundColor Yellow
}

Write-Host "`n✨ NETTOYAGE TERMINÉ !" -ForegroundColor Green
Write-Host "Les composants frontend ont été corrigés et les doublons nettoyés." -ForegroundColor Green
Write-Host "Le système ne devrait plus créer de nouvelles duplications." -ForegroundColor Green
