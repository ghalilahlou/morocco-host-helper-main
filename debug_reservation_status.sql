-- Vérifier le statut de la réservation Airbnb b980d1ab-f3a7-44f4-8c2c-66bd92a982a0
-- Cette requête vérifie :
-- 1. Si la réservation existe dans airbnb_reservations
-- 2. Si elle est matchée avec une réservation dans bookings
-- 3. Le statut de la réservation matchée

-- Réservation Airbnb
SELECT 
  'airbnb_reservations' as source,
  airbnb_booking_id,
  guest_name,
  start_date,
  end_date,
  property_id
FROM airbnb_reservations
WHERE airbnb_booking_id = 'b980d1ab-f3a7-44f4-8c2c-66bd92a982a0';

-- Réservations bookings correspondantes (par dates)
SELECT 
  'bookings' as source,
  id,
  booking_reference,
  guest_name,
  check_in_date,
  check_out_date,
  status,
  property_id
FROM bookings
WHERE property_id = (SELECT property_id FROM airbnb_reservations WHERE airbnb_booking_id = 'b980d1ab-f3a7-44f4-8c2c-66bd92a982a0')
  AND check_in_date = (SELECT start_date FROM airbnb_reservations WHERE airbnb_booking_id = 'b980d1ab-f3a7-44f4-8c2c-66bd92a982a0')
  AND check_out_date = (SELECT end_date FROM airbnb_reservations WHERE airbnb_booking_id = 'b980d1ab-f3a7-44f4-8c2c-66bd92a982a0');
