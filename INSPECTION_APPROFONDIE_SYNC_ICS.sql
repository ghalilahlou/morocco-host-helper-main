-- ============================================================================
-- INSPECTION APPROFONDIE - Diagnostic Complet de la Synchronisation ICS
-- ============================================================================
-- Property ID: 488d5074-b6ce-40a8-b0d5-036e97993410
-- ============================================================================

-- ============================================================================
-- PARTIE 1 : ÉTAT ACTUEL DES DONNÉES
-- ============================================================================

-- 1.1 Réservations dans airbnb_reservations
SELECT 
  'airbnb_reservations' as source,
  COUNT(*) as total,
  MIN(start_date) as premiere_date,
  MAX(end_date) as derniere_date
FROM public.airbnb_reservations
WHERE property_id = '488d5074-b6ce-40a8-b0d5-036e97993410';

-- 1.2 Réservations dans bookings avec codes Airbnb
SELECT 
  'bookings (codes Airbnb)' as source,
  COUNT(*) as total,
  MIN(check_in_date) as premiere_date,
  MAX(check_out_date) as derniere_date
FROM public.bookings
WHERE property_id = '488d5074-b6ce-40a8-b0d5-036e97993410'
AND booking_reference ~ '^(HM|CL|PN|ZN|JN|UN|FN|HN|KN|SN)[A-Z0-9]+';

-- 1.3 Lien ICS configuré
SELECT 
  id,
  name,
  airbnb_ics_url,
  updated_at
FROM public.properties
WHERE id = '488d5074-b6ce-40a8-b0d5-036e97993410';

-- ============================================================================
-- PARTIE 2 : DÉTAIL DES RÉSERVATIONS PROBLÉMATIQUES
-- ============================================================================

-- 2.1 Toutes les réservations avec codes Airbnb dans bookings
SELECT 
  id,
  booking_reference,
  guest_name,
  check_in_date,
  check_out_date,
  status,
  created_at,
  updated_at
FROM public.bookings
WHERE property_id = '488d5074-b6ce-40a8-b0d5-036e97993410'
AND booking_reference ~ '^(HM|CL|PN|ZN|JN|UN|FN|HN|KN|SN)[A-Z0-9]+'
ORDER BY check_in_date;

-- 2.2 Vérifier si ces codes existent aussi dans airbnb_reservations
SELECT 
  b.booking_reference,
  b.guest_name as booking_guest_name,
  b.check_in_date as booking_checkin,
  ar.airbnb_booking_id,
  ar.guest_name as airbnb_guest_name,
  ar.start_date as airbnb_checkin,
  CASE 
    WHEN ar.airbnb_booking_id IS NOT NULL THEN 'DOUBLON'
    ELSE 'UNIQUEMENT dans bookings'
  END as statut
FROM public.bookings b
LEFT JOIN public.airbnb_reservations ar 
  ON ar.property_id = b.property_id 
  AND ar.airbnb_booking_id = b.booking_reference
WHERE b.property_id = '488d5074-b6ce-40a8-b0d5-036e97993410'
AND b.booking_reference ~ '^(HM|CL|PN|ZN|JN|UN|FN|HN|KN|SN)[A-Z0-9]+'
ORDER BY b.check_in_date;

-- ============================================================================
-- PARTIE 3 : ANALYSE DE LA SYNCHRONISATION
-- ============================================================================

-- 3.1 Statut de synchronisation
SELECT 
  property_id,
  sync_status,
  last_sync_at,
  reservations_count,
  last_error
FROM public.airbnb_sync_status
WHERE property_id = '488d5074-b6ce-40a8-b0d5-036e97993410';

-- 3.2 Réservations récemment créées/modifiées
SELECT 
  'airbnb_reservations' as source,
  airbnb_booking_id as code,
  guest_name,
  start_date,
  end_date,
  created_at,
  updated_at
FROM public.airbnb_reservations
WHERE property_id = '488d5074-b6ce-40a8-b0d5-036e97993410'
AND updated_at > NOW() - INTERVAL '24 hours'
ORDER BY updated_at DESC;

-- ============================================================================
-- PARTIE 4 : COMPARAISON DES SOURCES
-- ============================================================================

-- 4.1 Codes présents dans bookings mais PAS dans airbnb_reservations
SELECT 
  'Codes dans bookings UNIQUEMENT' as type,
  b.booking_reference,
  b.guest_name,
  b.check_in_date,
  b.check_out_date,
  b.created_at
FROM public.bookings b
LEFT JOIN public.airbnb_reservations ar 
  ON ar.property_id = b.property_id 
  AND ar.airbnb_booking_id = b.booking_reference
WHERE b.property_id = '488d5074-b6ce-40a8-b0d5-036e97993410'
AND b.booking_reference ~ '^(HM|CL|PN|ZN|JN|UN|FN|HN|KN|SN)[A-Z0-9]+'
AND ar.airbnb_booking_id IS NULL
ORDER BY b.check_in_date;

-- 4.2 Codes présents dans airbnb_reservations mais PAS dans bookings
SELECT 
  'Codes dans airbnb_reservations UNIQUEMENT' as type,
  ar.airbnb_booking_id,
  ar.guest_name,
  ar.start_date,
  ar.end_date,
  ar.created_at
FROM public.airbnb_reservations ar
LEFT JOIN public.bookings b 
  ON b.property_id = ar.property_id 
  AND b.booking_reference = ar.airbnb_booking_id
WHERE ar.property_id = '488d5074-b6ce-40a8-b0d5-036e97993410'
AND b.id IS NULL
ORDER BY ar.start_date;

-- ============================================================================
-- PARTIE 5 : SOLUTION - NETTOYAGE COMPLET
-- ============================================================================

-- 5.1 PREVIEW : Voir ce qui sera supprimé
SELECT 
  'SERA SUPPRIMÉ' as action,
  id,
  booking_reference,
  guest_name,
  check_in_date,
  check_out_date
FROM public.bookings
WHERE property_id = '488d5074-b6ce-40a8-b0d5-036e97993410'
AND booking_reference ~ '^(HM|CL|PN|ZN|JN|UN|FN|HN|KN|SN)[A-Z0-9]+';

-- 5.2 EXÉCUTION : Supprimer toutes les réservations avec codes Airbnb
-- ⚠️ DÉCOMMENTEZ POUR EXÉCUTER
/*
DELETE FROM public.bookings
WHERE property_id = '488d5074-b6ce-40a8-b0d5-036e97993410'
AND booking_reference ~ '^(HM|CL|PN|ZN|JN|UN|FN|HN|KN|SN)[A-Z0-9]+';
*/

-- 5.3 VÉRIFICATION : Confirmer que c'est vide
SELECT 
  COUNT(*) as remaining_codes
FROM public.bookings
WHERE property_id = '488d5074-b6ce-40a8-b0d5-036e97993410'
AND booking_reference ~ '^(HM|CL|PN|ZN|JN|UN|FN|HN|KN|SN)[A-Z0-9]+';

-- ============================================================================
-- PARTIE 6 : RÉSUMÉ FINAL
-- ============================================================================

SELECT 
  'RÉSUMÉ APRÈS NETTOYAGE' as titre,
  (SELECT COUNT(*) FROM public.airbnb_reservations WHERE property_id = '488d5074-b6ce-40a8-b0d5-036e97993410') as airbnb_reservations,
  (SELECT COUNT(*) FROM public.bookings WHERE property_id = '488d5074-b6ce-40a8-b0d5-036e97993410' AND booking_reference ~ '^(HM|CL|PN|ZN|JN|UN|FN|HN|KN|SN)[A-Z0-9]+') as bookings_codes_airbnb,
  (SELECT COUNT(*) FROM public.bookings WHERE property_id = '488d5074-b6ce-40a8-b0d5-036e97993410' AND (booking_reference IS NULL OR booking_reference = 'INDEPENDENT_BOOKING')) as bookings_manuels;
