-- ============================================================================
-- SCRIPT SIMPLIFIÉ DE DIAGNOSTIC - SANS ERREURS
-- Pour diagnostiquer le problème d'écrasement des réservations
-- ============================================================================

-- REMPLACER '488d5074-b6ce-40a8-b0d5-036e97993410' par votre property_id réel

-- 1. VÉRIFIER LES VALEURS VALIDES DE L'ENUM booking_status
-- ============================================================================
SELECT 
  'VALEURS ENUM booking_status' as info,
  e.enumlabel as valeur_valide
FROM pg_enum e
JOIN pg_type t ON e.enumtypid = t.oid
WHERE t.typname = 'booking_status'
ORDER BY e.enumsortorder;

-- 2. COMPTER TOUTES LES RÉSERVATIONS POUR LA PROPRIÉTÉ
-- ============================================================================
SELECT 
  'TOTAL RÉSERVATIONS' as type,
  COUNT(*) as count
FROM bookings
WHERE property_id = '488d5074-b6ce-40a8-b0d5-036e97993410';

-- 3. COMPTER PAR STATUT (seulement les valeurs valides)
-- ============================================================================
SELECT 
  status,
  COUNT(*) as count
FROM bookings
WHERE property_id = '488d5074-b6ce-40a8-b0d5-036e97993410'
GROUP BY status
ORDER BY count DESC;

-- 4. LISTER TOUTES LES RÉSERVATIONS AVEC DÉTAILS
-- ============================================================================
SELECT 
  id,
  booking_reference,
  guest_name,
  status,
  check_in_date,
  check_out_date,
  created_at,
  updated_at,
  (SELECT COUNT(*) FROM guests WHERE booking_id = bookings.id) as guest_count
FROM bookings
WHERE property_id = '488d5074-b6ce-40a8-b0d5-036e97993410'
ORDER BY check_in_date DESC, created_at DESC;

-- 5. VÉRIFIER LES RÉSERVATIONS TERMINÉES (COMPLETED)
-- ============================================================================
SELECT 
  'RÉSERVATIONS TERMINÉES' as type,
  COUNT(*) as count
FROM bookings
WHERE property_id = '488d5074-b6ce-40a8-b0d5-036e97993410'
  AND status = 'completed';

-- 6. VÉRIFIER LES RÉSERVATIONS EN ATTENTE (PENDING)
-- ============================================================================
SELECT 
  'RÉSERVATIONS EN ATTENTE' as type,
  COUNT(*) as count
FROM bookings
WHERE property_id = '488d5074-b6ce-40a8-b0d5-036e97993410'
  AND status = 'pending';

-- 7. VÉRIFIER LES RÉSERVATIONS RÉCENTES (DERNIÈRES 24H)
-- ============================================================================
SELECT 
  id,
  booking_reference,
  guest_name,
  status,
  created_at,
  updated_at,
  EXTRACT(EPOCH FROM (NOW() - updated_at))/3600 as hours_since_update
FROM bookings
WHERE property_id = '488d5074-b6ce-40a8-b0d5-036e97993410'
  AND updated_at >= NOW() - INTERVAL '24 hours'
ORDER BY updated_at DESC;

-- 8. VÉRIFIER LES DOUBLONS POTENTIELS (mêmes dates)
-- ============================================================================
SELECT 
  property_id,
  check_in_date,
  check_out_date,
  COUNT(*) as duplicate_count,
  string_agg(id::text, ', ') as booking_ids,
  string_agg(status::text, ', ') as statuses,
  string_agg(COALESCE(guest_name, 'NULL'), ', ') as guest_names
FROM bookings
WHERE property_id = '488d5074-b6ce-40a8-b0d5-036e97993410'
GROUP BY property_id, check_in_date, check_out_date
HAVING COUNT(*) > 1
ORDER BY duplicate_count DESC;

-- 9. VÉRIFIER LES TRIGGERS ACTIFS
-- ============================================================================
SELECT 
  tgname as trigger_name,
  CASE tgenabled 
    WHEN 'O' THEN 'ENABLED'
    WHEN 'D' THEN 'DISABLED'
    ELSE 'UNKNOWN'
  END as status
FROM pg_trigger
WHERE tgrelid = 'bookings'::regclass
  AND NOT tgisinternal
ORDER BY tgname;

-- 10. VÉRIFIER LES CONTRAINTES UNIQUES
-- ============================================================================
SELECT 
  conname as constraint_name,
  CASE contype
    WHEN 'u' THEN 'UNIQUE'
    WHEN 'p' THEN 'PRIMARY KEY'
    WHEN 'c' THEN 'CHECK'
    ELSE contype::text
  END as constraint_type,
  pg_get_constraintdef(oid) as definition
FROM pg_constraint
WHERE conrelid = 'bookings'::regclass
  AND contype IN ('u', 'p')
ORDER BY conname;
