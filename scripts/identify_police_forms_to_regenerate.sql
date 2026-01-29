-- =====================================================
-- SCRIPT DE RÉGÉNÉRATION DES FICHES DE POLICE
-- Pour ajouter les signatures guests aux documents existants
-- =====================================================

-- 1. Identifier les bookings qui ont une signature guest MAIS une fiche de police déjà générée
SELECT 
  b.id as booking_id,
  b.booking_reference,
  b.guest_name,
  b.check_in_date,
  b.check_out_date,
  p.name as property_name,
  cs.id as signature_id,
  cs.signed_at as guest_signed_at,
  CASE 
    WHEN cs.signature_data IS NOT NULL THEN 'OUI'
    ELSE 'NON'
  END as has_guest_signature,
  LENGTH(cs.signature_data) as signature_length,
  -- Vérifier si fiche de police existe déjà
  (
    SELECT COUNT(*)
    FROM uploaded_documents ud
    WHERE ud.booking_id = b.id
    AND ud.document_type = 'police_form'
  ) as police_forms_count
FROM bookings b
INNER JOIN properties p ON p.id = b.property_id
INNER JOIN contract_signatures cs ON cs.booking_id = b.id AND cs.signature_type = 'guest'
WHERE b.status IN ('confirmed', 'pending', 'checked_in')
  AND cs.signature_data IS NOT NULL
  AND b.check_in_date >= CURRENT_DATE - INTERVAL '60 days'  -- Bookings des 60 derniers jours
ORDER BY b.created_at DESC;

-- 2. Liste des bookings nécessitant une régénération
-- (ont une signature guest ET une fiche de police existante)
WITH bookings_to_regenerate AS (
  SELECT 
    b.id as booking_id,
    b.booking_reference,
    b.guest_name,
    cs.signed_at as guest_signed_at
  FROM bookings b
  INNER JOIN contract_signatures cs ON cs.booking_id = b.id AND cs.signature_type = 'guest'
  WHERE cs.signature_data IS NOT NULL
    AND b.status IN ('confirmed', 'pending', 'checked_in', 'checked_out')
    AND EXISTS (
      SELECT 1 
      FROM uploaded_documents ud 
      WHERE ud.booking_id = b.id 
      AND ud.document_type = 'police_form'
    )
)
SELECT 
  COUNT(*) as total_bookings_to_regenerate,
  MIN(guest_signed_at) as oldest_signature,
  MAX(guest_signed_at) as newest_signature
FROM bookings_to_regenerate;

-- =====================================================
-- NOTES POUR LA RÉGÉNÉRATION
-- =====================================================
-- 
-- Pour régénérer les fiches de police avec les signatures,
-- vous devez appeler l'Edge Function avec l'action suivante:
-- 
-- POST /functions/v1/submit-guest-info-unified
-- {
--   "action": "regenerate_police_with_signature",
--   "bookingId": "ID_DU_BOOKING"
-- }
-- 
-- Cette action va:
-- 1. Récupérer la signature guest depuis contract_signatures
-- 2. Générer un nouveau PDF de police avec la signature
-- 3. Remplacer l'ancien document dans uploaded_documents
-- 
-- Pour régénérer en masse, créez un script qui itère sur
-- tous les booking_id retournés par la requête #1 ci-dessus.
-- =====================================================

-- 3. Statistiques détaillées par propriété
SELECT 
  p.id as property_id,
  p.name as property_name,
  COUNT(DISTINCT b.id) as total_bookings,
  COUNT(DISTINCT CASE WHEN cs.signature_data IS NOT NULL THEN b.id END) as bookings_with_signature,
  COUNT(DISTINCT CASE WHEN ud.id IS NOT NULL THEN b.id END) as bookings_with_police,
  COUNT(DISTINCT CASE 
    WHEN cs.signature_data IS NOT NULL AND ud.id IS NOT NULL 
    THEN b.id 
  END) as bookings_needing_regeneration
FROM properties p
INNER JOIN bookings b ON b.property_id = p.id
LEFT JOIN contract_signatures cs ON cs.booking_id = b.id AND cs.signature_type = 'guest'
LEFT JOIN uploaded_documents ud ON ud.booking_id = b.id AND ud.document_type = 'police_form'
WHERE b.status IN ('confirmed', 'pending', 'checked_in', 'checked_out')
  AND b.check_in_date >= CURRENT_DATE - INTERVAL '60 days'
GROUP BY p.id, p.name
ORDER BY bookings_needing_regeneration DESC;
