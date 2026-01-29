-- =====================================================
-- DIAGNOSTIC : Vérifier signature pour ce booking spécifique
-- =====================================================

-- 1. Trouver le booking de Mouhcine Temsamani
SELECT 
  b.id as booking_id,
  b.booking_reference,
  b.guest_name,
  b.guest_email,
  b.check_in_date,
  b.created_at
FROM bookings b
WHERE 
  (b.guest_name LIKE '%MOUHCINE%' OR b.guest_name LIKE '%TEMSAMANI%')
  OR b.guest_email = 'ghalilahlou26@gmail.com'
ORDER BY b.created_at DESC
LIMIT 5;

-- 2. Vérifier si ce booking a une signature guest
SELECT 
  cs.id,
  cs.booking_id,
  cs.signature_type,
  cs.signer_name,
  CASE 
    WHEN cs.signature_data IS NOT NULL THEN 'OUI'
    ELSE 'NON'
  END as has_signature,
  LENGTH(cs.signature_data) as signature_length,
  SUBSTRING(cs.signature_data, 1, 50) as signature_preview,
  cs.signed_at,
  cs.created_at
FROM contract_signatures cs
WHERE cs.booking_id IN (
  SELECT b.id 
  FROM bookings b 
  WHERE (b.guest_name LIKE '%MOUHCINE%' OR b.guest_name LIKE '%TEMSAMANI%')
     OR b.guest_email = 'ghalilahlou26@gmail.com'
)
ORDER BY cs.created_at DESC;

-- 3. Vérifier TOUTES les signatures de ce booking (guest ET landlord)
WITH target_booking AS (
  SELECT b.id
  FROM bookings b
  WHERE (b.guest_name LIKE '%MOUHCINE%' OR b.guest_name LIKE '%TEMSAMANI%')
     OR b.guest_email = 'ghalilahlou26@gmail.com'
  ORDER BY b.created_at DESC
  LIMIT 1
)
SELECT 
  cs.signature_type,
  cs.signer_name,
  CASE 
    WHEN cs.signature_data IS NOT NULL THEN 'OUI' 
    ELSE 'NON' 
  END as has_data,
  LENGTH(cs.signature_data) as data_length,
  LEFT(cs.signature_data, 30) as data_preview,
  cs.signed_at
FROM contract_signatures cs
WHERE cs.booking_id = (SELECT id FROM target_booking)
ORDER BY cs.signature_type, cs.created_at DESC;

-- 4. Si pas de signature guest, vérifier pourquoi
SELECT 
  b.id,
  b.guest_name,
  b.status,
  EXISTS(
    SELECT 1 FROM contract_signatures cs 
    WHERE cs.booking_id = b.id AND cs.signature_type = 'guest'
  ) as has_guest_signature,
  EXISTS(
    SELECT 1 FROM contract_signatures cs 
    WHERE cs.booking_id = b.id AND cs.signature_type = 'landlord'
  ) as has_landlord_signature,
  (
    SELECT COUNT(*) FROM guests g WHERE g.booking_id = b.id
  ) as guests_count
FROM bookings b
WHERE (b.guest_name LIKE '%MOUHCINE%' OR b.guest_name LIKE '%TEMSAMANI%')
   OR b.guest_email = 'ghalilahlou26@gmail.com'
ORDER BY b.created_at DESC
LIMIT 1;
