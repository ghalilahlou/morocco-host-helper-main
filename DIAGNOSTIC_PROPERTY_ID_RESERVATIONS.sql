-- ============================================================================
-- DIAGNOSTIC - Vérifier les property_id des réservations
-- Exécutez ce script dans Supabase pour vérifier l'état des réservations
-- ============================================================================

-- 1. Voir toutes les propriétés avec le nombre de réservations
SELECT 
  p.id as property_id,
  p.name as property_name,
  COUNT(b.id) as nombre_reservations
FROM properties p
LEFT JOIN bookings b ON b.property_id = p.id
GROUP BY p.id, p.name
ORDER BY nombre_reservations DESC;

-- 2. Vérifier les réservations SANS property_id (problème potentiel)
SELECT 
  'RÉSERVATIONS SANS PROPERTY_ID' as section,
  id,
  guest_name,
  status,
  check_in_date,
  created_at
FROM bookings
WHERE property_id IS NULL;

-- 3. Voir les 10 dernières réservations avec leur property_id
SELECT 
  'DERNIÈRES RÉSERVATIONS' as section,
  b.id,
  b.guest_name,
  b.status,
  b.check_in_date,
  b.property_id,
  p.name as property_name,
  b.created_at
FROM bookings b
LEFT JOIN properties p ON p.id = b.property_id
ORDER BY b.created_at DESC
LIMIT 10;

-- 4. Compter les réservations par propriété avec le nom
SELECT 
  'RÉSERVATIONS PAR PROPRIÉTÉ' as section,
  b.property_id,
  p.name as property_name,
  COUNT(*) as total,
  COUNT(CASE WHEN b.status = 'completed' THEN 1 END) as completed,
  COUNT(CASE WHEN b.status = 'pending' THEN 1 END) as pending
FROM bookings b
LEFT JOIN properties p ON p.id = b.property_id
GROUP BY b.property_id, p.name
ORDER BY total DESC;
