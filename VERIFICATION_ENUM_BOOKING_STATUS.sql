-- ============================================================================
-- VÉRIFICATION DE L'ENUM booking_status
-- ============================================================================

-- 1. Vérifier les valeurs de l'enum booking_status
SELECT 
  'VALEURS ENUM booking_status' as section,
  unnest(enum_range(NULL::booking_status)) as valeur_enum;

-- 2. Vérifier les statuts réellement utilisés dans la table bookings
SELECT 
  'STATUTS UTILISÉS DANS bookings' as section,
  status,
  COUNT(*) as count
FROM bookings
GROUP BY status
ORDER BY count DESC;

-- 3. Vérifier les réservations pour cette propriété (SANS filtrer par status)
SELECT 
  'RÉSERVATIONS POUR CETTE PROPRIÉTÉ (TOUS STATUTS)' as section,
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

-- 4. Compter par statut pour cette propriété
SELECT 
  'RÉPARTITION PAR STATUT' as section,
  status,
  COUNT(*) as count
FROM bookings
WHERE property_id = '488d5074-b6ce-40a8-b0d5-036e97993410'
GROUP BY status;
