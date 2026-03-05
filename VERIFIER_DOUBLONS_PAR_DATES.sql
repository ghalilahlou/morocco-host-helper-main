-- ============================================================================
-- VÉRIFICATION DES DOUBLONS PAR DATES (sans guest_name)
-- Ce type de doublon peut causer des problèmes dans create-booking-for-signature
-- ============================================================================

-- REMPLACER '488d5074-b6ce-40a8-b0d5-036e97993410' par votre property_id réel

-- 1. VÉRIFIER LES RÉSERVATIONS AVEC LES MÊMES DATES (sans filtre guest_name)
-- ============================================================================
-- Cette requête identifie les réservations qui ont les mêmes property_id + check_in_date + check_out_date
-- mais des guest_name différents. Ce sont celles qui pourraient être confondues par create-booking-for-signature
-- AVANT la correction que nous avons apportée.
SELECT 
  'DOUBLONS PAR DATES (sans guest_name)' as type,
  property_id,
  check_in_date,
  check_out_date,
  COUNT(*) as duplicate_count,
  string_agg(id::text, ', ') as booking_ids,
  string_agg(COALESCE(guest_name, 'NULL'), ', ') as guest_names,
  string_agg(status::text, ', ') as statuses,
  string_agg(COALESCE(booking_reference, 'NULL'), ', ') as booking_references,
  string_agg(created_at::text, ', ') as created_dates
FROM bookings
WHERE property_id = '488d5074-b6ce-40a8-b0d5-036e97993410'
GROUP BY property_id, check_in_date, check_out_date
HAVING COUNT(*) > 1
ORDER BY duplicate_count DESC;

-- 2. LISTER TOUTES LES RÉSERVATIONS POUR ANALYSE
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
  CASE 
    WHEN updated_at > created_at THEN 
      EXTRACT(EPOCH FROM (updated_at - created_at))/3600 
    ELSE 0 
  END as hours_between_create_update
FROM bookings
WHERE property_id = '488d5074-b6ce-40a8-b0d5-036e97993410'
ORDER BY check_in_date DESC, created_at DESC;

-- 3. COMPTER LES RÉSERVATIONS PAR STATUT
-- ============================================================================
SELECT 
  status,
  COUNT(*) as count,
  MIN(created_at) as oldest_created,
  MAX(created_at) as newest_created,
  MIN(updated_at) as oldest_updated,
  MAX(updated_at) as newest_updated
FROM bookings
WHERE property_id = '488d5074-b6ce-40a8-b0d5-036e97993410'
GROUP BY status
ORDER BY count DESC;

-- 4. VÉRIFIER LES RÉSERVATIONS CRÉÉES RÉCEMMENT (DERNIÈRES 48H)
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
  CASE 
    WHEN updated_at > created_at THEN 'MISE À JOUR'
    ELSE 'CRÉATION'
  END as action_type
FROM bookings
WHERE property_id = '488d5074-b6ce-40a8-b0d5-036e97993410'
  AND created_at >= NOW() - INTERVAL '48 hours'
ORDER BY created_at DESC;
