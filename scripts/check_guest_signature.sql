-- =====================================================
-- SCRIPT DE DIAGNOSTIC : Vérification Signatures Guest
-- =====================================================
-- Ce script vérifie la présence et l'intégrité des signatures
-- des guests dans la base de données
-- =====================================================

-- 1. Liste des signatures guests récentes
SELECT 
  cs.id,
  cs.booking_id,
  cs.signer_name,
  cs.signature_type,
  CASE 
    WHEN cs.signature_data IS NOT NULL THEN 'OUI'
    ELSE 'NON'
  END as has_signature_data,
  CASE 
    WHEN cs.signature_data IS NOT NULL 
    THEN LENGTH(cs.signature_data)
    ELSE 0
  END as signature_length,
  CASE 
    WHEN cs.signature_data LIKE 'data:image/png%' THEN 'PNG (base64)'
    WHEN cs.signature_data LIKE 'data:image/jpg%' OR cs.signature_data LIKE 'data:image/jpeg%' THEN 'JPEG (base64)'
    WHEN cs.signature_data LIKE 'http%' THEN 'URL'
    ELSE 'Format inconnu'
  END as signature_format,
  cs.signed_at,
  cs.created_at,
  b.guest_name,
  b.booking_reference,
  p.name as property_name
FROM contract_signatures cs
LEFT JOIN bookings b ON b.id = cs.booking_id
LEFT JOIN properties p ON p.id = b.property_id
WHERE cs.signature_type = 'guest'
ORDER BY cs.created_at DESC
LIMIT 10;

-- 2. Statistiques globales des signatures guests
SELECT 
  COUNT(*) as total_signatures_guest,
  COUNT(CASE WHEN signature_data IS NOT NULL THEN 1 END) as signatures_avec_data,
  COUNT(CASE WHEN signature_data IS NULL THEN 1 END) as signatures_sans_data,
  MIN(created_at) as premiere_signature,
  MAX(created_at) as derniere_signature
FROM contract_signatures
WHERE signature_type = 'guest';

-- 3. Bookings avec et sans signature guest
SELECT 
  'Avec signature' as statut,
  COUNT(DISTINCT b.id) as nombre_bookings
FROM bookings b
INNER JOIN contract_signatures cs ON cs.booking_id = b.id AND cs.signature_type = 'guest'
UNION ALL
SELECT 
  'Sans signature' as statut,
  COUNT(DISTINCT b.id) as nombre_bookings
FROM bookings b
LEFT JOIN contract_signatures cs ON cs.booking_id = b.id AND cs.signature_type = 'guest'
WHERE cs.id IS NULL;

-- 4. Détails d'un booking spécifique (REMPLACER 'BOOKING_ID' par l'ID réel)
-- DÉCOMMENTER et remplacer BOOKING_ID pour tester un booking spécifique
/*
SELECT 
  cs.id as signature_id,
  cs.signature_type,
  cs.signer_name,
  CASE 
    WHEN cs.signature_data IS NOT NULL THEN 'OUI'
    ELSE 'NON'
  END as has_signature,
  LENGTH(cs.signature_data) as signature_length,
  SUBSTRING(cs.signature_data, 1, 50) || '...' as signature_preview,
  cs.signed_at,
  cs.created_at
FROM contract_signatures cs
WHERE cs.booking_id = 'BOOKING_ID'
ORDER BY cs.created_at DESC;
*/

-- 5. Vérification des guests sans signature
SELECT 
  b.id as booking_id,
  b.booking_reference,
  b.guest_name,
  b.check_in_date,
  b.check_out_date,
  b.status,
  p.name as property_name,
  b.created_at
FROM bookings b
LEFT JOIN properties p ON p.id = b.property_id
LEFT JOIN contract_signatures cs ON cs.booking_id = b.id AND cs.signature_type = 'guest'
WHERE cs.id IS NULL
  AND b.status IN ('confirmed', 'pending')
  AND b.check_in_date >= CURRENT_DATE - INTERVAL '30 days'
ORDER BY b.created_at DESC
LIMIT 20;

-- =====================================================
-- INSTRUCTIONS D'UTILISATION
-- =====================================================
-- 1. Exécuter ce script dans l'éditeur SQL de Supabase
-- 2. Analyser les résultats pour identifier les bookings sans signature
-- 3. Pour un booking spécifique, décommenter la requête #4 et remplacer BOOKING_ID
-- =====================================================
