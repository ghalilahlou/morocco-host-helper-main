-- ✅ DIAGNOSTIC COMPLET : Vérifier l'état de la réservation "Mouhcine"

-- 1. Trouver la réservation par nom de guest
SELECT 
  id,
  guest_name,
  booking_reference,
  status,
  check_in_date,
  check_out_date,
  created_at,
  updated_at,
  property_id
FROM bookings
WHERE guest_name ILIKE '%mouhcine%'
   OR guest_name ILIKE '%mouhine%'
ORDER BY created_at DESC
LIMIT 5;

-- 2. Vérifier toutes les réservations INDEPENDENT_BOOKING
SELECT 
  id,
  guest_name,
  booking_reference,
  status,
  check_in_date,
  check_out_date,
  (SELECT COUNT(*) FROM guests WHERE guests.booking_id = bookings.id) as guest_count,
  (SELECT COUNT(*) FROM guest_submissions WHERE guest_submissions.booking_id = bookings.id) as submission_count
FROM bookings
WHERE booking_reference = 'INDEPENDENT_BOOKING'
ORDER BY created_at DESC
LIMIT 10;

-- 3. Statistiques des statuts actuels
SELECT 
  status,
  COUNT(*) as count,
  booking_reference,
  COUNT(CASE WHEN booking_reference = 'INDEPENDENT_BOOKING' THEN 1 END) as independent_count
FROM bookings
GROUP BY status, booking_reference
ORDER BY status;

-- 4. Vérifier les réservations avec documents
SELECT 
  b.id,
  b.guest_name,
  b.booking_reference,
  b.status,
  gs.contract_url,
  gs.police_url,
  g.full_name as guest_full_name
FROM bookings b
LEFT JOIN guest_submissions gs ON gs.booking_id = b.id
LEFT JOIN guests g ON g.booking_id = b.id
WHERE b.booking_reference = 'INDEPENDENT_BOOKING'
ORDER BY b.created_at DESC
LIMIT 5;
