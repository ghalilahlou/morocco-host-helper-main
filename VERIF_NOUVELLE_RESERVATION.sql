-- Vérifier TOUTES les réservations récentes (dernières 2 heures)
SELECT 
  'RÉSERVATIONS RÉCENTES (2h)' as section,
  id,
  property_id,
  user_id,
  booking_reference,
  guest_name,
  check_in_date,
  check_out_date,
  status,
  number_of_guests,
  created_at,
  CASE 
    WHEN property_id = '488d5074-b6ce-40a8-b0d5-036e97993410' THEN '✅ BONNE PROPRIÉTÉ'
    ELSE '⚠️ AUTRE PROPRIÉTÉ'
  END as propriete_match,
  CASE 
    WHEN user_id = '1ef553dd-f4c3-4a7e-877c-eeb9423a48f0' THEN '✅ BON USER'
    WHEN user_id IS NULL THEN '❌ USER NULL'
    ELSE '⚠️ AUTRE USER'
  END as user_match
FROM bookings
WHERE created_at > NOW() - INTERVAL '2 hours'
ORDER BY created_at DESC
LIMIT 10;

-- Vérifier le total actuel pour cette propriété
SELECT 
  'TOTAL ACTUEL studio casa' as section,
  COUNT(*) as total,
  COUNT(CASE WHEN user_id = '1ef553dd-f4c3-4a7e-877c-eeb9423a48f0' THEN 1 END) as pour_cet_utilisateur,
  COUNT(CASE WHEN user_id IS NULL THEN 1 END) as user_null,
  COUNT(CASE WHEN user_id != '1ef553dd-f4c3-4a7e-877c-eeb9423a48f0' THEN 1 END) as autre_utilisateur
FROM bookings
WHERE property_id = '488d5074-b6ce-40a8-b0d5-036e97993410';
