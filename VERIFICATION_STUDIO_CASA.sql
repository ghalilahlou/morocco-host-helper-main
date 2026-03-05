-- ============================================================================
-- VÉRIFICATION CRITIQUE - Combien de réservations pour "studio casa" ?
-- ============================================================================

-- 1. VÉRIFICATION pour la propriété 488d5074-b6ce-40a8-b0d5-036e97993410 (studio casa)
SELECT 
  'STUDIO CASA' as property,
  p.name,
  COUNT(b.id) as total_reservations
FROM properties p
LEFT JOIN bookings b ON b.property_id = p.id
WHERE p.id = '488d5074-b6ce-40a8-b0d5-036e97993410'
GROUP BY p.id, p.name;

-- 2. Liste des réservations pour cette propriété
SELECT 
  b.id,
  b.guest_name,
  b.status,
  b.check_in_date,
  b.created_at
FROM bookings b
WHERE b.property_id = '488d5074-b6ce-40a8-b0d5-036e97993410'
ORDER BY b.created_at DESC;

-- ✅ SI VOUS VOYEZ SEULEMENT 1 RÉSERVATION CI-DESSUS, C'EST NORMAL !
-- Le cache affiche correctement 1 réservation car cette propriété n'en a qu'une.

-- 🔍 POUR TESTER LE BUG : Utilisez une propriété avec PLUSIEURS réservations
-- Par exemple "Palais Princess" (c28c29da-4868-4557-a8b0-988fbb800c79) qui a 12 réservations
