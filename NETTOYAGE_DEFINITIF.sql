-- ============================================================================
-- NETTOYAGE DÉFINITIF - Supprimer TOUTES les réservations avec codes Airbnb
-- ============================================================================
-- ⚠️ ATTENTION : Cette action est IRRÉVERSIBLE
-- ============================================================================

-- ÉTAPE 1 : BACKUP (Optionnel - Créer une sauvegarde)
CREATE TABLE IF NOT EXISTS public.bookings_backup_20250127 AS
SELECT * FROM public.bookings
WHERE property_id = '488d5074-b6ce-40a8-b0d5-036e97993410'
AND booking_reference ~ '^(HM|CL|PN|ZN|JN|UN|FN|HN|KN|SN)[A-Z0-9]+';

-- ÉTAPE 2 : SUPPRESSION DÉFINITIVE
DELETE FROM public.bookings
WHERE property_id = '488d5074-b6ce-40a8-b0d5-036e97993410'
AND booking_reference ~ '^(HM|CL|PN|ZN|JN|UN|FN|HN|KN|SN)[A-Z0-9]+';

-- ÉTAPE 3 : VÉRIFICATION
SELECT 
  'VÉRIFICATION APRÈS SUPPRESSION' as titre,
  COUNT(*) as codes_airbnb_restants
FROM public.bookings
WHERE property_id = '488d5074-b6ce-40a8-b0d5-036e97993410'
AND booking_reference ~ '^(HM|CL|PN|ZN|JN|UN|FN|HN|KN|SN)[A-Z0-9]+';

-- Devrait retourner 0

-- ÉTAPE 4 : RÉSUMÉ FINAL
SELECT 
  'RÉSUMÉ FINAL' as titre,
  (SELECT COUNT(*) FROM public.airbnb_reservations WHERE property_id = '488d5074-b6ce-40a8-b0d5-036e97993410') as reservations_ics,
  (SELECT COUNT(*) FROM public.bookings WHERE property_id = '488d5074-b6ce-40a8-b0d5-036e97993410' AND (booking_reference IS NULL OR booking_reference = 'INDEPENDENT_BOOKING')) as reservations_manuelles,
  (SELECT COUNT(*) FROM public.bookings WHERE property_id = '488d5074-b6ce-40a8-b0d5-036e97993410' AND booking_reference ~ '^(HM|CL|PN|ZN|JN|UN|FN|HN|KN|SN)[A-Z0-9]+') as codes_airbnb_restants;
