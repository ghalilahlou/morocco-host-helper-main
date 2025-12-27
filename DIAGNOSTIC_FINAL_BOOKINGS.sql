-- ============================================================================
-- DIAGNOSTIC FINAL - Voir exactement ce qui reste dans bookings
-- ============================================================================

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
ORDER BY check_in_date;

-- Vérifier s'il reste des codes Airbnb
SELECT 
  'Codes Airbnb restants' as type,
  COUNT(*) as total
FROM public.bookings
WHERE property_id = '488d5074-b6ce-40a8-b0d5-036e97993410'
AND booking_reference ~ '^(HM|CL|PN|ZN|JN|UN|FN|HN|KN|SN)[A-Z0-9]+';

-- Voir toutes les guest_submissions
SELECT 
  gs.id,
  gs.booking_id,
  gs.guest_name,
  b.booking_reference,
  b.guest_name as booking_guest_name
FROM public.guest_submissions gs
LEFT JOIN public.bookings b ON gs.booking_id = b.id
WHERE b.property_id = '488d5074-b6ce-40a8-b0d5-036e97993410'
ORDER BY gs.created_at DESC;
