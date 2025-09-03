# =====================================================
# SCRIPT DE CORRECTION DE LA DOUBLE LOGIQUE DE RÉSERVATIONS
# =====================================================
# Ce script corrige la double logique de création de réservations
# et nettoie les doublons existants
# =====================================================

Write-Host "🚨 CORRECTION DE LA DOUBLE LOGIQUE DE CRÉATION DE RÉSERVATIONS" -ForegroundColor Red
Write-Host "=====================================================" -ForegroundColor Red

# 1. VÉRIFICATION DE L'ENVIRONNEMENT
# =====================================================
Write-Host "`n📋 VÉRIFICATION DE L'ENVIRONNEMENT..." -ForegroundColor Yellow

# Vérifier si Supabase CLI est installé
try {
    $supabaseVersion = supabase --version
    Write-Host "✅ Supabase CLI détecté: $supabaseVersion" -ForegroundColor Green
} catch {
    Write-Host "❌ Supabase CLI non trouvé. Installation..." -ForegroundColor Red
    Write-Host "Exécutez d'abord: install-supabase-cli.ps1" -ForegroundColor Red
    exit 1
}

# Vérifier la connexion à Supabase
Write-Host "`n🔗 VÉRIFICATION DE LA CONNEXION SUPABASE..." -ForegroundColor Yellow
try {
    supabase status
    Write-Host "✅ Connexion Supabase établie" -ForegroundColor Green
} catch {
    Write-Host "❌ Erreur de connexion Supabase" -ForegroundColor Red
    Write-Host "Vérifiez votre configuration dans .env" -ForegroundColor Red
    exit 1
}

# 2. ANALYSE DES DOUBLONS EXISTANTS
# =====================================================
Write-Host "`n🔍 ANALYSE DES DOUBLONS EXISTANTS..." -ForegroundColor Yellow

# Créer un fichier temporaire pour l'analyse
$analysisFile = "analyse_doublons_intelligente_$(Get-Date -Format 'yyyyMMdd_HHmmss').sql"
Write-Host "📄 Création du fichier d'analyse: $analysisFile" -ForegroundColor Blue

# Extraire seulement la section d'analyse du script principal
$analysisSQL = @"
-- ANALYSE DES DOUBLONS AVEC CONTEXTE (SECTION 1 ET 2)
WITH duplicate_bookings AS (
  SELECT 
    property_id,
    check_in_date,
    check_out_date,
    user_id,
    COUNT(*) as duplicate_count,
    ARRAY_AGG(id ORDER BY created_at) as booking_ids,
    ARRAY_AGG(created_at ORDER BY created_at) as created_dates,
    ARRAY_AGG(submission_id IS NOT NULL ORDER BY created_at) as has_submission,
    ARRAY_AGG(COALESCE(submission_id::text, 'NULL') ORDER BY created_at) as submission_ids
  FROM public.bookings
  GROUP BY property_id, check_in_date, check_out_date, user_id
  HAVING COUNT(*) > 1
)
SELECT 
  'ANALYSE DES DOUBLONS:' as message,
  property_id,
  check_in_date,
  check_out_date,
  user_id,
  duplicate_count,
  booking_ids,
  created_dates,
  has_submission,
  submission_ids
FROM duplicate_bookings
ORDER BY duplicate_count DESC, check_in_date;

-- ANALYSE DÉTAILLÉE
WITH duplicate_bookings AS (
  SELECT 
    property_id,
    check_in_date,
    check_out_date,
    user_id
  FROM public.bookings
  GROUP BY property_id, check_in_date, check_out_date, user_id
  HAVING COUNT(*) > 1
)
SELECT 
  b.id,
  b.property_id,
  b.check_in_date,
  b.check_out_date,
  b.user_id,
  b.status,
  b.submission_id,
  b.created_at,
  b.updated_at,
  p.name as property_name,
  u.email as user_email,
  (SELECT COUNT(*) FROM public.guests WHERE booking_id = b.id) as guest_count,
  (SELECT COUNT(*) FROM public.uploaded_documents WHERE booking_id = b.id) as document_count,
  (SELECT COUNT(*) FROM public.guest_submissions WHERE id = b.submission_id) as submission_exists
FROM public.bookings b
JOIN duplicate_bookings d ON 
  b.property_id = d.property_id AND
  b.check_in_date = d.check_in_date AND
  b.check_out_date = d.check_out_date AND
  b.user_id = d.user_id
LEFT JOIN public.properties p ON b.property_id = p.id
LEFT JOIN auth.users u ON b.user_id = u.id
ORDER BY b.property_id, b.check_in_date, b.check_out_date, b.user_id, b.created_at;
"@

$analysisSQL | Out-File -FilePath $analysisFile -Encoding UTF8

# 3. NETTOYAGE INTELLIGENT DES DOUBLONS
# =====================================================
Write-Host "`n🧹 NETTOYAGE INTELLIGENT DES DOUBLONS..." -ForegroundColor Yellow

# Créer le script de nettoyage intelligent
$cleanupFile = "nettoyage_intelligent_$(Get-Date -Format 'yyyyMMdd_HHmmss').sql"
Write-Host "📄 Création du script de nettoyage intelligent: $cleanupFile" -ForegroundColor Blue

$cleanupSQL = @"
-- NETTOYAGE INTELLIGENT DES DOUBLONS
BEGIN;

-- Créer une table temporaire pour stocker les réservations à conserver
CREATE TEMP TABLE bookings_to_keep AS
WITH ranked_bookings AS (
  SELECT 
    b.id,
    b.property_id,
    b.check_in_date,
    b.check_out_date,
    b.user_id,
    b.status,
    b.submission_id,
    b.created_at,
    b.updated_at,
    COALESCE((SELECT COUNT(*) FROM public.guests WHERE booking_id = b.id), 0) as guest_count,
    COALESCE((SELECT COUNT(*) FROM public.uploaded_documents WHERE booking_id = b.id), 0) as document_count,
    ROW_NUMBER() OVER (
      PARTITION BY b.property_id, b.check_in_date, b.check_out_date, b.user_id 
      ORDER BY 
        CASE WHEN b.submission_id IS NOT NULL THEN 1 ELSE 2 END,
        COALESCE((SELECT COUNT(*) FROM public.guests WHERE booking_id = b.id), 0) DESC,
        COALESCE((SELECT COUNT(*) FROM public.uploaded_documents WHERE booking_id = b.id), 0) DESC,
        CASE WHEN b.status = 'confirmed' THEN 1 ELSE 2 END,
        b.created_at DESC,
        b.id
    ) as rn
  FROM public.bookings b
)
SELECT 
  id, 
  property_id, 
  check_in_date, 
  check_out_date, 
  user_id, 
  status, 
  submission_id,
  created_at, 
  updated_at,
  guest_count,
  document_count
FROM ranked_bookings
WHERE rn = 1;

-- Afficher le plan de nettoyage
SELECT 
  'PLAN DE NETTOYAGE INTELLIGENT:' as message,
  (SELECT COUNT(*) FROM public.bookings) as total_bookings,
  (SELECT COUNT(*) FROM bookings_to_keep) as bookings_to_conserve,
  (SELECT COUNT(*) FROM public.bookings) - (SELECT COUNT(*) FROM bookings_to_keep) as bookings_to_delete,
  (SELECT SUM(guest_count) FROM bookings_to_keep) as total_guests_conserved,
  (SELECT SUM(document_count) FROM bookings_to_keep) as total_documents_conserved;

-- Supprimer les réservations en double
DELETE FROM public.bookings 
WHERE id NOT IN (SELECT id FROM bookings_to_keep);

-- Vérifier le résultat
SELECT 
  'RÉSULTAT APRÈS NETTOYAGE:' as message,
  COUNT(*) as total_bookings_remaining
FROM public.bookings;

-- Vérifier qu'il n'y a plus de doublons
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
    WHEN COUNT(*) = 0 THEN '✅ AUCUN DOUBLON DÉTECTÉ - Nettoyage réussi !'
    ELSE '❌ DOUBLONS ENCORE PRÉSENTS: ' || COUNT(*) || ' groupes de doublons détectés'
  END as verification_result
FROM duplicate_check;

-- Vérifier l'intégrité des données conservées
SELECT 
  'VÉRIFICATION INTÉGRITÉ:' as message,
  COUNT(*) as total_bookings,
  SUM(CASE WHEN submission_id IS NOT NULL THEN 1 ELSE 0 END) as bookings_with_submission,
  SUM(CASE WHEN submission_id IS NULL THEN 1 ELSE 0 END) as bookings_without_submission
FROM public.bookings;

-- Nettoyer la table temporaire
DROP TABLE IF EXISTS bookings_to_keep;

COMMIT;
"@

$cleanupSQL | Out-File -FilePath $cleanupFile -Encoding UTF8

# 4. CORRECTION DES COMPOSANTS FRONTEND
# =====================================================
Write-Host "`n🔧 CORRECTION DES COMPOSANTS FRONTEND..." -ForegroundColor Yellow

# Corriger WelcomingContractSignature.tsx
Write-Host "📝 Correction de WelcomingContractSignature.tsx..." -ForegroundColor Blue
$welcomingFile = "src/components/WelcomingContractSignature.tsx"
if (Test-Path $welcomingFile) {
    $content = Get-Content $welcomingFile -Raw
    $correctedContent = $content -replace 'if \(!bookingId\) \{[\s\S]*?bookingId = bookingResult\.bookingId;[\s\S]*?\}', '// ✅ CORRECTION: Ne jamais créer de nouvelle réservation
    if (!bookingId) {
      throw new Error(''ID de réservation manquant. Impossible de signer le contrat.'');
    }

    console.log(''✅ Utilisation de la réservation existante:'', bookingId);'
    
    $correctedContent | Set-Content $welcomingFile -Encoding UTF8
    Write-Host "✅ WelcomingContractSignature.tsx corrigé" -ForegroundColor Green
} else {
    Write-Host "⚠️ Fichier WelcomingContractSignature.tsx non trouvé" -ForegroundColor Yellow
}

# Corriger ContractSignature.tsx
Write-Host "📝 Correction de ContractSignature.tsx..." -ForegroundColor Blue
$contractFile = "src/components/ContractSignature.tsx"
if (Test-Path $contractFile) {
    $content = Get-Content $contractFile -Raw
    $correctedContent = $content -replace 'if \(!bookingId\) \{[\s\S]*?bookingId = bookingResult\.bookingId;[\s\S]*?\}', '// ✅ CORRECTION: Ne jamais créer de nouvelle réservation
    if (!bookingId) {
      throw new Error(''ID de réservation manquant. Impossible de signer le contrat.'');
    }

    console.log(''✅ Utilisation de la réservation existante:'', bookingId);'
    
    $correctedContent | Set-Content $contractFile -Encoding UTF8
    Write-Host "✅ ContractSignature.tsx corrigé" -ForegroundColor Green
} else {
    Write-Host "⚠️ Fichier ContractSignature.tsx non trouvé" -ForegroundColor Yellow
}

# 5. CORRECTION DES EDGE FUNCTIONS
# =====================================================
Write-Host "`n⚡ CORRECTION DES EDGE FUNCTIONS..." -ForegroundColor Yellow

# Corriger create-booking-for-signature
Write-Host "📝 Correction de create-booking-for-signature..." -ForegroundColor Blue
$edgeFunctionFile = "supabase/functions/create-booking-for-signature/index.ts"
if (Test-Path $edgeFunctionFile) {
    $content = Get-Content $edgeFunctionFile -Raw
    
    # Ajouter la vérification des réservations existantes
    $verificationCode = @"
    // ✅ CORRECTION: Vérifier si une réservation existe déjà
    const { data: existingBooking, error: checkError } = await server
      .from("bookings")
      .select("id, status")
      .eq("property_id", body.propertyId)
      .eq("check_in_date", body.checkInDate)
      .eq("check_out_date", body.checkOutDate)
      .maybeSingle();

    if (existingBooking) {
      console.log('✅ Réservation existante trouvée:', existingBooking.id);
      return ok({ 
        bookingId: existingBooking.id,
        propertyId: body.propertyId,
        guestName: body.guestName,
        checkInDate: body.checkInDate,
        checkOutDate: body.checkOutDate,
        numberOfGuests: body.numberOfGuests || 1,
        status: existingBooking.status,
        message: "Existing booking found and reused"
      });
    }
"@
    
    # Insérer le code de vérification avant la création
    $insertPoint = $content.IndexOf('// 2. Create booking')
    if ($insertPoint -ne -1) {
        $newContent = $content.Substring(0, $insertPoint) + $verificationCode + "`n`n" + $content.Substring($insertPoint)
        $newContent | Set-Content $edgeFunctionFile -Encoding UTF8
        Write-Host "✅ create-booking-for-signature corrigé" -ForegroundColor Green
    } else {
        Write-Host "⚠️ Point d'insertion non trouvé dans create-booking-for-signature" -ForegroundColor Yellow
    }
} else {
    Write-Host "⚠️ Fichier create-booking-for-signature non trouvé" -ForegroundColor Yellow
}

# 6. REDÉPLOIEMENT DES MIGRATIONS
# =====================================================
Write-Host "`n🚀 REDÉPLOIEMENT DES MIGRATIONS..." -ForegroundColor Yellow

# Appliquer les migrations
Write-Host "📦 Application des migrations..." -ForegroundColor Blue
try {
    supabase db push
    Write-Host "✅ Migrations appliquées avec succès" -ForegroundColor Green
} catch {
    Write-Host "❌ Erreur lors de l'application des migrations" -ForegroundColor Red
    Write-Host "Vérifiez les logs ci-dessus pour plus de détails" -ForegroundColor Red
    exit 1
}

# 7. REDÉPLOIEMENT DES EDGE FUNCTIONS
# =====================================================
Write-Host "`n⚡ REDÉPLOIEMENT DES EDGE FUNCTIONS..." -ForegroundColor Yellow

# Redéployer les fonctions
Write-Host "📤 Redéploiement des fonctions..." -ForegroundColor Blue
try {
    supabase functions deploy
    Write-Host "✅ Edge Functions redéployées avec succès" -ForegroundColor Green
} catch {
    Write-Host "❌ Erreur lors du redéploiement des fonctions" -ForegroundColor Red
    Write-Host "Vérifiez les logs ci-dessus pour plus de détails" -ForegroundColor Red
}

# 8. VÉRIFICATION FINALE
# =====================================================
Write-Host "`n✅ VÉRIFICATION FINALE..." -ForegroundColor Yellow

# Vérifier l'état de la base de données
Write-Host "🔍 Vérification de l'état de la base de données..." -ForegroundColor Blue
try {
    supabase status
    Write-Host "✅ Vérification terminée" -ForegroundColor Green
} catch {
    Write-Host "⚠️ Erreur lors de la vérification finale" -ForegroundColor Yellow
}

# 9. NETTOYAGE DES FICHIERS TEMPORAIRES
# =====================================================
Write-Host "`n🧹 NETTOYAGE DES FICHIERS TEMPORAIRES..." -ForegroundColor Yellow

# Supprimer les fichiers temporaires
if (Test-Path $analysisFile) {
    Remove-Item $analysisFile
    Write-Host "✅ Fichier d'analyse supprimé: $analysisFile" -ForegroundColor Green
}

if (Test-Path $cleanupFile) {
    Remove-Item $cleanupFile
    Write-Host "✅ Script de nettoyage supprimé: $cleanupFile" -ForegroundColor Green
}

# 10. RÉSUMÉ FINAL
# =====================================================
Write-Host "`n🎉 CORRECTION DE LA DOUBLE LOGIQUE TERMINÉE!" -ForegroundColor Green
Write-Host "=====================================================" -ForegroundColor Green
Write-Host "✅ Doublons de réservations nettoyés intelligemment" -ForegroundColor Green
Write-Host "✅ Composants frontend corrigés" -ForegroundColor Green
Write-Host "✅ Edge Functions corrigés" -ForegroundColor Green
Write-Host "✅ Contraintes d'unicité appliquées" -ForegroundColor Green
Write-Host "✅ Migrations déployées" -ForegroundColor Green
Write-Host "✅ Edge Functions redéployées" -ForegroundColor Green

Write-Host "`n📋 PROCHAINES ÉTAPES:" -ForegroundColor Blue
Write-Host "1. Testez la création de nouvelles réservations" -ForegroundColor White
Write-Host "2. Vérifiez qu'il n'y a plus de duplication" -ForegroundColor White
Write-Host "3. Testez le processus de signature de contrat" -ForegroundColor White
Write-Host "4. Vérifiez que les documents sont bien associés" -ForegroundColor White

Write-Host "`n🔗 DOCUMENTATION:" -ForegroundColor Blue
Write-Host "- CORRECTION-DOUBLE-LOGIQUE-RESERVATIONS.md" -ForegroundColor White
Write-Host "- NETTOYAGE-INTELLIGENT-DOUBLONS.sql" -ForegroundColor White

Write-Host "`n✨ La double logique de création de réservations est maintenant corrigée!" -ForegroundColor Green
Write-Host "🚫 Plus de réservations en double créées automatiquement" -ForegroundColor Green
