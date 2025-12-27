-- ============================================================================
-- NETTOYAGE AVEC GESTION DES CONTRAINTES - Version Corrigée
-- ============================================================================
-- ⚠️ ATTENTION : Supprime les guest_submissions ET les bookings
-- ============================================================================

-- ÉTAPE 1 : BACKUP (Créer des sauvegardes)
CREATE TABLE IF NOT EXISTS public.guest_submissions_backup_20250127 AS
SELECT gs.* 
FROM public.guest_submissions gs
INNER JOIN public.bookings b ON gs.booking_id = b.id
WHERE b.property_id = '488d5074-b6ce-40a8-b0d5-036e97993410'
AND b.booking_reference ~ '^(HM|CL|PN|ZN|JN|UN|FN|HN|KN|SN)[A-Z0-9]+';

CREATE TABLE IF NOT EXISTS public.bookings_backup_20250127 AS
SELECT * FROM public.bookings
WHERE property_id = '488d5074-b6ce-40a8-b0d5-036e97993410'
AND booking_reference ~ '^(HM|CL|PN|ZN|JN|UN|FN|HN|KN|SN)[A-Z0-9]+';

-- ÉTAPE 2 : Voir ce qui sera supprimé
SELECT 
  'GUEST SUBMISSIONS À SUPPRIMER' as type,
  COUNT(*) as total
FROM public.guest_submissions gs
INNER JOIN public.bookings b ON gs.booking_id = b.id
WHERE b.property_id = '488d5074-b6ce-40a8-b0d5-036e97993410'
AND b.booking_reference ~ '^(HM|CL|PN|ZN|JN|UN|FN|HN|KN|SN)[A-Z0-9]+';

SELECT 
  'BOOKINGS À SUPPRIMER' as type,
  COUNT(*) as total
FROM public.bookings
WHERE property_id = '488d5074-b6ce-40a8-b0d5-036e97993410'
AND booking_reference ~ '^(HM|CL|PN|ZN|JN|UN|FN|HN|KN|SN)[A-Z0-9]+';

-- ÉTAPE 3 : SUPPRESSION EN CASCADE (dans le bon ordre)

-- 3.1 D'abord supprimer les guest_submissions
DELETE FROM public.guest_submissions
WHERE booking_id IN (
  SELECT id FROM public.bookings
  WHERE property_id = '488d5074-b6ce-40a8-b0d5-036e97993410'
  AND booking_reference ~ '^(HM|CL|PN|ZN|JN|UN|FN|HN|KN|SN)[A-Z0-9]+'
);

-- 3.2 Ensuite supprimer les bookings
DELETE FROM public.bookings
WHERE property_id = '488d5074-b6ce-40a8-b0d5-036e97993410'
AND booking_reference ~ '^(HM|CL|PN|ZN|JN|UN|FN|HN|KN|SN)[A-Z0-9]+';

-- ÉTAPE 4 : VÉRIFICATION
SELECT 
  'VÉRIFICATION APRÈS SUPPRESSION' as titre,
  (SELECT COUNT(*) FROM public.bookings 
   WHERE property_id = '488d5074-b6ce-40a8-b0d5-036e97993410'
   AND booking_reference ~ '^(HM|CL|PN|ZN|JN|UN|FN|HN|KN|SN)[A-Z0-9]+') as codes_airbnb_restants,
  (SELECT COUNT(*) FROM public.guest_submissions gs
   INNER JOIN public.bookings b ON gs.booking_id = b.id
   WHERE b.property_id = '488d5074-b6ce-40a8-b0d5-036e97993410'
   AND b.booking_reference ~ '^(HM|CL|PN|ZN|JN|UN|FN|HN|KN|SN)[A-Z0-9]+') as guest_submissions_restantes;

-- Devrait retourner 0 pour les deux

-- ÉTAPE 5 : RÉSUMÉ FINAL
SELECT 
  'RÉSUMÉ FINAL' as titre,
  (SELECT COUNT(*) FROM public.airbnb_reservations WHERE property_id = '488d5074-b6ce-40a8-b0d5-036e97993410') as reservations_ics,
  (SELECT COUNT(*) FROM public.bookings WHERE property_id = '488d5074-b6ce-40a8-b0d5-036e97993410' AND (booking_reference IS NULL OR booking_reference = 'INDEPENDENT_BOOKING')) as reservations_manuelles,
  (SELECT COUNT(*) FROM public.bookings WHERE property_id = '488d5074-b6ce-40a8-b0d5-036e97993410' AND booking_reference ~ '^(HM|CL|PN|ZN|JN|UN|FN|HN|KN|SN)[A-Z0-9]+') as codes_airbnb_restants;
