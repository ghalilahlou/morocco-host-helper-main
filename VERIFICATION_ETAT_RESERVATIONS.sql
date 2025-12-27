-- ============================================================================
-- VÉRIFICATION DE L'ÉTAT ACTUEL DES RÉSERVATIONS
-- ============================================================================
-- Exécutez ces requêtes dans Supabase SQL Editor pour diagnostiquer
-- Property ID: 488d5074-b6ce-40a8-b0d5-036e97993410
-- ============================================================================

-- ============================================================================
-- PARTIE 1 : VÉRIFIER LES RÉSERVATIONS DANS airbnb_reservations
-- ============================================================================

SELECT 
  '=== RÉSERVATIONS DANS airbnb_reservations ===' as section;

SELECT 
  airbnb_booking_id,
  guest_name,
  start_date,
  end_date,
  created_at,
  updated_at
FROM public.airbnb_reservations
WHERE property_id = '488d5074-b6ce-40a8-b0d5-036e97993410'
ORDER BY start_date DESC;

-- Comptage
SELECT 
  COUNT(*) as total_airbnb_reservations
FROM public.airbnb_reservations
WHERE property_id = '488d5074-b6ce-40a8-b0d5-036e97993410';

-- ============================================================================
-- PARTIE 2 : VÉRIFIER LES RÉSERVATIONS DANS bookings AVEC CODES AIRBNB
-- ============================================================================

SELECT 
  '=== RÉSERVATIONS DANS bookings AVEC CODES AIRBNB ===' as section;

SELECT 
  id,
  booking_reference,
  guest_name,
  check_in_date,
  check_out_date,
  status,
  created_at
FROM public.bookings
WHERE property_id = '488d5074-b6ce-40a8-b0d5-036e97993410'
AND (
  booking_reference LIKE 'HM%' OR
  booking_reference LIKE 'CL%' OR
  booking_reference LIKE 'PN%' OR
  booking_reference LIKE 'ZN%' OR
  booking_reference LIKE 'JN%' OR
  booking_reference LIKE 'UN%' OR
  booking_reference LIKE 'FN%' OR
  booking_reference LIKE 'HN%' OR
  booking_reference LIKE 'KN%' OR
  booking_reference LIKE 'SN%'
)
ORDER BY check_in_date DESC;

-- Comptage
SELECT 
  COUNT(*) as total_bookings_avec_codes_airbnb
FROM public.bookings
WHERE property_id = '488d5074-b6ce-40a8-b0d5-036e97993410'
AND (
  booking_reference LIKE 'HM%' OR
  booking_reference LIKE 'CL%' OR
  booking_reference LIKE 'PN%' OR
  booking_reference LIKE 'ZN%' OR
  booking_reference LIKE 'JN%' OR
  booking_reference LIKE 'UN%' OR
  booking_reference LIKE 'FN%' OR
  booking_reference LIKE 'HN%' OR
  booking_reference LIKE 'KN%' OR
  booking_reference LIKE 'SN%'
);

-- ============================================================================
-- PARTIE 3 : VÉRIFIER LE LIEN ICS CONFIGURÉ
-- ============================================================================

SELECT 
  '=== LIEN ICS CONFIGURÉ ===' as section;

SELECT 
  id,
  name,
  airbnb_ics_url,
  updated_at
FROM public.properties
WHERE id = '488d5074-b6ce-40a8-b0d5-036e97993410';

-- ============================================================================
-- PARTIE 4 : RÉSUMÉ GLOBAL
-- ============================================================================

SELECT 
  '=== RÉSUMÉ GLOBAL ===' as section;

SELECT 
  (SELECT COUNT(*) FROM public.airbnb_reservations WHERE property_id = '488d5074-b6ce-40a8-b0d5-036e97993410') as airbnb_reservations,
  (SELECT COUNT(*) FROM public.bookings WHERE property_id = '488d5074-b6ce-40a8-b0d5-036e97993410' AND booking_reference LIKE 'HM%') as bookings_codes_airbnb,
  (SELECT airbnb_ics_url IS NOT NULL FROM public.properties WHERE id = '488d5074-b6ce-40a8-b0d5-036e97993410') as has_ics_url,
  (SELECT airbnb_ics_url FROM public.properties WHERE id = '488d5074-b6ce-40a8-b0d5-036e97993410') as ics_url;

-- ============================================================================
-- PARTIE 5 : DÉTAIL DES RÉSERVATIONS PROBLÉMATIQUES
-- ============================================================================

SELECT 
  '=== RÉSERVATIONS SPÉCIFIQUES (HMDMWXRRNC, HMXTD4Y7ZAQ, HMS4FEKFSQ) ===' as section;

-- Dans airbnb_reservations
SELECT 
  'airbnb_reservations' as table_name,
  airbnb_booking_id,
  guest_name,
  start_date,
  end_date
FROM public.airbnb_reservations
WHERE property_id = '488d5074-b6ce-40a8-b0d5-036e97993410'
AND airbnb_booking_id IN ('HMDMWXRRNC', 'HMXTD4Y7ZAQ', 'HMS4FEKFSQ')

UNION ALL

-- Dans bookings
SELECT 
  'bookings' as table_name,
  booking_reference as airbnb_booking_id,
  guest_name,
  check_in_date::text as start_date,
  check_out_date::text as end_date
FROM public.bookings
WHERE property_id = '488d5074-b6ce-40a8-b0d5-036e97993410'
AND booking_reference IN ('HMDMWXRRNC', 'HMXTD4Y7ZAQ', 'HMS4FEKFSQ');

-- ============================================================================
-- PARTIE 6 : COMMANDES DE NETTOYAGE (DÉCOMMENTEZ POUR EXÉCUTER)
-- ============================================================================

/*
-- ⚠️ ATTENTION : Décommentez ces lignes SEULEMENT si vous voulez supprimer les réservations

-- Supprimer de airbnb_reservations
DELETE FROM public.airbnb_reservations
WHERE property_id = '488d5074-b6ce-40a8-b0d5-036e97993410';

-- Supprimer de bookings (codes Airbnb)
DELETE FROM public.bookings
WHERE property_id = '488d5074-b6ce-40a8-b0d5-036e97993410'
AND (
  booking_reference LIKE 'HM%' OR
  booking_reference LIKE 'CL%' OR
  booking_reference LIKE 'PN%' OR
  booking_reference LIKE 'ZN%' OR
  booking_reference LIKE 'JN%' OR
  booking_reference LIKE 'UN%' OR
  booking_reference LIKE 'FN%' OR
  booking_reference LIKE 'HN%' OR
  booking_reference LIKE 'KN%' OR
  booking_reference LIKE 'SN%'
);

-- Supprimer le lien ICS
UPDATE public.properties
SET airbnb_ics_url = NULL
WHERE id = '488d5074-b6ce-40a8-b0d5-036e97993410';
*/

-- ============================================================================
-- FIN DU SCRIPT
-- ============================================================================
