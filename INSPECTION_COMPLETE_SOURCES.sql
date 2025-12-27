-- ============================================================================
-- INSPECTION COMPLÈTE - Vérifier TOUTES les sources de données
-- ============================================================================

-- 1. Vérifier les bookings restants
SELECT 
  'BOOKINGS' as source,
  id,
  booking_reference,
  guest_name,
  check_in_date,
  check_out_date,
  created_at
FROM public.bookings
WHERE property_id = '488d5074-b6ce-40a8-b0d5-036e97993410'
ORDER BY check_in_date;

-- 2. Compter les bookings par type de référence
SELECT 
  'BOOKINGS - Statistiques' as type,
  COUNT(*) as total,
  COUNT(CASE WHEN booking_reference IS NULL THEN 1 END) as null_ref,
  COUNT(CASE WHEN booking_reference = 'INDEPENDENT_BOOKING' THEN 1 END) as independent,
  COUNT(CASE WHEN booking_reference ~ '^(HM|CL|PN|ZN|JN|UN|FN|HN|KN|SN)[A-Z0-9]+' THEN 1 END) as codes_airbnb
FROM public.bookings
WHERE property_id = '488d5074-b6ce-40a8-b0d5-036e97993410';

-- 3. Vérifier les airbnb_reservations
SELECT 
  'AIRBNB_RESERVATIONS' as source,
  COUNT(*) as total
FROM public.airbnb_reservations
WHERE property_id = '488d5074-b6ce-40a8-b0d5-036e97993410';

-- 4. Vérifier les guest_submissions
SELECT 
  'GUEST_SUBMISSIONS' as source,
  COUNT(*) as total
FROM public.guest_submissions gs
INNER JOIN public.bookings b ON gs.booking_id = b.id
WHERE b.property_id = '488d5074-b6ce-40a8-b0d5-036e97993410';

-- 5. Lister TOUS les bookings avec leurs détails
SELECT 
  b.id,
  b.booking_reference,
  b.guest_name,
  b.check_in_date,
  b.check_out_date,
  CASE 
    WHEN b.booking_reference IS NULL THEN 'NULL'
    WHEN b.booking_reference = 'INDEPENDENT_BOOKING' THEN 'INDEPENDENT'
    WHEN b.booking_reference ~ '^(HM|CL|PN|ZN|JN|UN|FN|HN|KN|SN)[A-Z0-9]+' THEN 'CODE_AIRBNB'
    ELSE 'AUTRE'
  END as type_reference,
  (SELECT COUNT(*) FROM public.guest_submissions WHERE booking_id = b.id) as nb_submissions
FROM public.bookings b
WHERE b.property_id = '488d5074-b6ce-40a8-b0d5-036e97993410'
ORDER BY b.check_in_date;
