-- ============================================================================
-- DIAGNOSTIC URGENT - Pourquoi rawDataCount = 0 ?
-- ============================================================================

-- 1. Vérifier combien de réservations existent pour cette propriété
SELECT 
  'RÉSERVATIONS POUR CETTE PROPRIÉTÉ' as section,
  COUNT(*) as total,
  COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending,
  COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed,
  COUNT(CASE WHEN status = 'confirmed' THEN 1 END) as confirmed,
  COUNT(CASE WHEN status = 'archived' THEN 1 END) as archived,
  COUNT(CASE WHEN status = 'draft' THEN 1 END) as draft
FROM bookings
WHERE property_id = '488d5074-b6ce-40a8-b0d5-036e97993410';

-- 2. Voir les réservations de cette propriété
SELECT 
  'DÉTAILS DES RÉSERVATIONS' as section,
  id,
  guest_name,
  booking_reference,
  check_in_date,
  check_out_date,
  status,
  created_at
FROM bookings
WHERE property_id = '488d5074-b6ce-40a8-b0d5-036e97993410'
ORDER BY created_at DESC
LIMIT 20;

-- 3. Vérifier si le filtre status='draft' exclut tout
SELECT 
  'RÉSERVATIONS NON-DRAFT' as section,
  COUNT(*) as total
FROM bookings
WHERE property_id = '488d5074-b6ce-40a8-b0d5-036e97993410'
  AND status != 'draft';

-- 4. Vérifier le user_id
SELECT 
  'RÉSERVATIONS PAR USER' as section,
  user_id,
  COUNT(*) as total
FROM bookings
WHERE property_id = '488d5074-b6ce-40a8-b0d5-036e97993410'
GROUP BY user_id;

-- 5. Vérifier si c'est un problème de user_id
SELECT 
  'RÉSERVATIONS POUR CET UTILISATEUR' as section,
  COUNT(*) as total_toutes_proprietes,
  COUNT(CASE WHEN property_id = '488d5074-b6ce-40a8-b0d5-036e97993410' THEN 1 END) as total_cette_propriete
FROM bookings
WHERE user_id = '1ef553dd-f4c3-4a7e-877c-eeb9423a48f0';
