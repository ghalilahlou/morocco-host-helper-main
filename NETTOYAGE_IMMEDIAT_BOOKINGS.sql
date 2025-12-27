-- ============================================================================
-- NETTOYAGE IMMÉDIAT - Supprimer les réservations avec codes Airbnb
-- ============================================================================
-- Property ID: 488d5074-b6ce-40a8-b0d5-036e97993410
-- ============================================================================

-- ÉTAPE 1 : Voir ce qui sera supprimé
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

-- ÉTAPE 2 : Supprimer (DÉCOMMENTEZ pour exécuter)
/*
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
*/

-- ÉTAPE 3 : Vérifier que c'est vide
SELECT COUNT(*) as remaining_airbnb_codes
FROM public.bookings
WHERE property_id = '488d5074-b6ce-40a8-b0d5-036e97993410'
AND booking_reference LIKE 'HM%';
