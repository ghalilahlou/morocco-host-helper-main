-- ============================================================================
-- VÉRIFICATION DES RÉSERVATIONS INDÉPENDANTES
-- ============================================================================
-- Ce script permet de vérifier l'état des réservations en base de données
-- avant d'appliquer les corrections pour l'affichage dans le calendrier

-- ============================================================================
-- 1. STATISTIQUES GÉNÉRALES DES RÉSERVATIONS
-- ============================================================================
SELECT 
  'STATISTIQUES GÉNÉRALES' as section,
  COUNT(*) as total_reservations,
  COUNT(CASE WHEN property_id IS NOT NULL THEN 1 END) as avec_property_id,
  COUNT(CASE WHEN property_id IS NULL THEN 1 END) as sans_property_id,
  COUNT(CASE WHEN guest_name IS NOT NULL AND guest_name != '' THEN 1 END) as avec_guest_name,
  COUNT(CASE WHEN booking_reference IS NULL OR booking_reference = '' THEN 1 END) as sans_booking_reference,
  COUNT(CASE WHEN booking_reference = 'INDEPENDENT_BOOKING' THEN 1 END) as independent_booking
FROM bookings;

-- ============================================================================
-- 2. RÉSERVATIONS INDÉPENDANTES (sans code Airbnb)
-- ============================================================================
SELECT 
  'RÉSERVATIONS INDÉPENDANTES' as section,
  id,
  property_id,
  user_id,
  guest_name,
  booking_reference,
  check_in_date,
  check_out_date,
  number_of_guests,
  status,
  created_at,
  CASE 
    WHEN property_id IS NULL THEN '❌ MANQUANT'
    ELSE '✅ OK'
  END as property_id_status,
  CASE 
    WHEN guest_name IS NULL OR guest_name = '' THEN '❌ MANQUANT'
    ELSE '✅ OK'
  END as guest_name_status
FROM bookings
WHERE 
  -- Exclure les codes Airbnb
  (booking_reference IS NULL 
   OR booking_reference = '' 
   OR booking_reference = 'INDEPENDENT_BOOKING'
   OR NOT (booking_reference ~ '^(HM|CL|PN|ZN|JN|UN|FN|HN|KN|SN|RM|TN|VN|WN|XN|YN|AN|BN|CN|DN|EN|GN|LN|MN|NN|ON|QN|RN)[A-Z0-9]+$'))
ORDER BY created_at DESC
LIMIT 20;

-- ============================================================================
-- 3. RÉSERVATIONS RÉCENTES (dernières 24h)
-- ============================================================================
SELECT 
  'RÉSERVATIONS RÉCENTES (24h)' as section,
  id,
  property_id,
  guest_name,
  booking_reference,
  check_in_date,
  check_out_date,
  status,
  created_at,
  CASE 
    WHEN property_id IS NULL THEN '❌ property_id MANQUANT'
    WHEN guest_name IS NULL OR guest_name = '' THEN '⚠️ guest_name MANQUANT'
    ELSE '✅ COMPLET'
  END as validation_status
FROM bookings
WHERE created_at > NOW() - INTERVAL '24 hours'
ORDER BY created_at DESC;

-- ============================================================================
-- 4. RÉSERVATIONS PAR PROPRIÉTÉ
-- ============================================================================
SELECT 
  'RÉSERVATIONS PAR PROPRIÉTÉ' as section,
  p.id as property_id,
  p.name as property_name,
  COUNT(b.id) as total_reservations,
  COUNT(CASE WHEN b.guest_name IS NOT NULL AND b.guest_name != '' THEN 1 END) as avec_guest_name,
  COUNT(CASE WHEN b.booking_reference IS NULL OR b.booking_reference = '' OR b.booking_reference = 'INDEPENDENT_BOOKING' THEN 1 END) as independantes
FROM properties p
LEFT JOIN bookings b ON b.property_id = p.id
GROUP BY p.id, p.name
ORDER BY total_reservations DESC;

-- ============================================================================
-- 5. RÉSERVATIONS PROBLÉMATIQUES (sans property_id)
-- ============================================================================
SELECT 
  'RÉSERVATIONS PROBLÉMATIQUES' as section,
  id,
  user_id,
  guest_name,
  booking_reference,
  check_in_date,
  check_out_date,
  status,
  created_at,
  '❌ PROBLÈME: property_id manquant' as issue
FROM bookings
WHERE property_id IS NULL
ORDER BY created_at DESC
LIMIT 10;

-- ============================================================================
-- 6. RÉSERVATIONS AVEC GUESTS
-- ============================================================================
SELECT 
  'RÉSERVATIONS AVEC GUESTS' as section,
  b.id as booking_id,
  b.property_id,
  b.guest_name as booking_guest_name,
  b.booking_reference,
  COUNT(g.id) as nombre_guests,
  STRING_AGG(g.full_name, ', ') as noms_guests
FROM bookings b
LEFT JOIN guests g ON g.booking_id = b.id
WHERE 
  (b.booking_reference IS NULL 
   OR b.booking_reference = '' 
   OR b.booking_reference = 'INDEPENDENT_BOOKING')
GROUP BY b.id, b.property_id, b.guest_name, b.booking_reference
ORDER BY b.created_at DESC
LIMIT 20;

-- ============================================================================
-- 7. DIAGNOSTIC COMPLET POUR UNE RÉSERVATION SPÉCIFIQUE
-- ============================================================================
-- Remplacez 'VOTRE_BOOKING_ID' par l'ID d'une réservation à diagnostiquer
/*
SELECT 
  'DIAGNOSTIC RÉSERVATION' as section,
  b.*,
  p.name as property_name,
  p.address as property_address,
  (SELECT COUNT(*) FROM guests WHERE booking_id = b.id) as nombre_guests,
  (SELECT STRING_AGG(full_name, ', ') FROM guests WHERE booking_id = b.id) as noms_guests
FROM bookings b
LEFT JOIN properties p ON p.id = b.property_id
WHERE b.id = 'VOTRE_BOOKING_ID';
*/

-- ============================================================================
-- INSTRUCTIONS D'UTILISATION
-- ============================================================================
-- 1. Copiez ce script dans l'éditeur SQL de Supabase
-- 2. Exécutez-le section par section ou en entier
-- 3. Analysez les résultats :
--    - Section 1 : Vue d'ensemble des statistiques
--    - Section 2 : Liste des réservations indépendantes
--    - Section 3 : Réservations créées récemment
--    - Section 4 : Répartition par propriété
--    - Section 5 : Réservations avec problèmes
--    - Section 6 : Réservations avec leurs guests
--    - Section 7 : Diagnostic détaillé (décommenter et remplacer l'ID)
--
-- 4. Partagez les résultats pour diagnostic
