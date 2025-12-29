-- Vérifier les réservations actuelles pour studio casa
SELECT 
  id,
  booking_reference,
  guest_name,
  check_in_date,
  check_out_date,
  status,
  number_of_guests,
  documents_generated,
  created_at
FROM bookings
WHERE property_id = '488d5074-b6ce-40a8-b0d5-036e97993410'
  AND user_id = '1ef553dd-f4c3-4a7e-877c-eeb9423a48f0'
ORDER BY created_at DESC;
