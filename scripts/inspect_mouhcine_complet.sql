-- =====================================================
-- INSPECTION COMPLÈTE : Réservation Mouhcine
-- =====================================================

-- 1. TROUVER LA/LES RÉSERVATION(S) DE MOUHCINE
SELECT 
  id,
  booking_reference,
  guest_name,
  guest_email,
  check_in_date,
  check_out_date,
  status,
  created_at,
  updated_at
FROM bookings
WHERE 
  guest_name LIKE '%MOUHCINE%' 
  OR guest_name LIKE '%TEMSAMANI%'
  OR guest_email = 'ghalilahlou26@gmail.com'
ORDER BY created_at DESC;

-- 2. VÉRIFIER LES SIGNATURES POUR CHAQUE BOOKING DE MOUHCINE
WITH mouhcine_bookings AS (
  SELECT id 
  FROM bookings
  WHERE guest_name LIKE '%MOUHCINE%' 
     OR guest_name LIKE '%TEMSAMANI%'
     OR guest_email = 'ghalilahlou26@gmail.com'
)
SELECT 
  cs.booking_id,
  b.booking_reference,
  cs.signer_name,
  CASE 
    WHEN cs.signature_data IS NOT NULL AND LENGTH(cs.signature_data) > 100 THEN 'OUI (valide)'
    WHEN cs.signature_data IS NOT NULL THEN 'OUI (suspect - trop court)'
    ELSE 'NON'
  END as has_valid_signature,
  LENGTH(cs.signature_data) as signature_length,
  LEFT(cs.signature_data, 50) as signature_start,
  cs.signed_at,
  cs.created_at
FROM contract_signatures cs
INNER JOIN bookings b ON b.id = cs.booking_id
WHERE cs.booking_id IN (SELECT id FROM mouhcine_bookings)
ORDER BY cs.created_at DESC;

-- 3. VÉRIFIER LES DOCUMENTS GÉNÉRÉS
WITH mouhcine_bookings AS (
  SELECT id 
  FROM bookings
  WHERE guest_name LIKE '%MOUHCINE%' 
     OR guest_name LIKE '%TEMSAMANI%'
     OR guest_email = 'ghalilahlou26@gmail.com'
)
SELECT 
  ud.booking_id,
  b.booking_reference,
  ud.document_type,
  ud.created_at as document_created_at,
  LEFT(ud.document_url, 80) as url_preview,
  ud.file_size
FROM uploaded_documents ud
INNER JOIN bookings b ON b.id = ud.booking_id
WHERE ud.booking_id IN (SELECT id FROM mouhcine_bookings)
ORDER BY ud.created_at DESC;

-- 4. STATISTIQUES : Compter les réservations et documents
WITH mouhcine_bookings AS (
  SELECT id 
  FROM bookings
  WHERE guest_name LIKE '%MOUHCINE%' 
     OR guest_name LIKE '%TEMSAMANI%'
     OR guest_email = 'ghalilahlou26@gmail.com'
)
SELECT 
  'Nombre de réservations' as metric,
  COUNT(*) as count
FROM mouhcine_bookings
UNION ALL
SELECT 
  'Signatures guest',
  COUNT(*)
FROM contract_signatures
WHERE booking_id IN (SELECT id FROM mouhcine_bookings)
  AND signature_type = 'guest'
UNION ALL
SELECT 
  'Fiches de police',
  COUNT(*)
FROM uploaded_documents
WHERE booking_id IN (SELECT id FROM mouhcine_bookings)
  AND document_type = 'police_form';

-- 5. DÉTAILS DU DERNIER BOOKING (le plus récent)
WITH latest_booking AS (
  SELECT id
  FROM bookings
  WHERE guest_name LIKE '%MOUHCINE%' 
     OR guest_name LIKE '%TEMSAMANI%'
     OR guest_email = 'ghalilahlou26@gmail.com'
  ORDER BY created_at DESC
  LIMIT 1
)
SELECT 
  b.*,
  -- Vérifier si signature existe
  EXISTS(
    SELECT 1 FROM contract_signatures cs 
    WHERE cs.booking_id = b.id AND cs.signature_type = 'guest'
  ) as has_guest_signature,
  -- Vérifier si fiche de police existe
  EXISTS(
    SELECT 1 FROM uploaded_documents ud 
    WHERE ud.booking_id = b.id AND ud.document_type = 'police_form'
  ) as has_police_form
FROM bookings b
WHERE b.id IN (SELECT id FROM latest_booking);
