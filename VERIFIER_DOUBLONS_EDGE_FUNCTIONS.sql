-- ============================================================================
-- VÉRIFICATION DES DOUBLONS QUI PEUVENT CAUSER DES PROBLÈMES DANS LES EDGE FUNCTIONS
-- ============================================================================

-- REMPLACER '488d5074-b6ce-40a8-b0d5-036e97993410' par votre property_id réel

-- 1. VÉRIFIER LES RÉSERVATIONS AVEC LES MÊMES DATES (problème dans create-booking-for-signature)
-- ============================================================================
-- Cette requête identifie les réservations qui ont les mêmes property_id + check_in_date + check_out_date
-- Ce sont celles qui pourraient être confondues par create-booking-for-signature
SELECT 
  'DOUBLONS PAR DATES (create-booking-for-signature)' as type,
  property_id,
  check_in_date,
  check_out_date,
  COUNT(*) as duplicate_count,
  string_agg(id::text, ', ') as booking_ids,
  string_agg(COALESCE(guest_name, 'NULL'), ', ') as guest_names,
  string_agg(status::text, ', ') as statuses,
  string_agg(COALESCE(booking_reference, 'NULL'), ', ') as booking_references
FROM bookings
WHERE property_id = '488d5074-b6ce-40a8-b0d5-036e97993410'
GROUP BY property_id, check_in_date, check_out_date
HAVING COUNT(*) > 1
ORDER BY duplicate_count DESC;

-- 2. VÉRIFIER LES RÉSERVATIONS AVEC LE MÊME booking_reference (problème dans submit-guest-info-unified)
-- ============================================================================
-- Cette requête identifie les réservations qui ont le même booking_reference
-- Ce sont celles qui pourraient être confondues par submit-guest-info-unified et issue-guest-link
SELECT 
  'DOUBLONS PAR booking_reference' as type,
  booking_reference,
  property_id,
  COUNT(*) as duplicate_count,
  string_agg(id::text, ', ') as booking_ids,
  string_agg(COALESCE(guest_name, 'NULL'), ', ') as guest_names,
  string_agg(status::text, ', ') as statuses,
  string_agg(check_in_date::text, ', ') as check_in_dates
FROM bookings
WHERE property_id = '488d5074-b6ce-40a8-b0d5-036e97993410'
  AND booking_reference IS NOT NULL
GROUP BY booking_reference, property_id
HAVING COUNT(*) > 1
ORDER BY duplicate_count DESC;

-- 3. VÉRIFIER LES RÉSERVATIONS INDEPENDENT_BOOKING AVEC MÊMES DATES ET NOM
-- ============================================================================
-- Cette requête identifie les réservations INDEPENDENT_BOOKING qui ont les mêmes dates et nom
-- Ce sont celles qui pourraient être confondues par submit-guest-info-unified
SELECT 
  'DOUBLONS INDEPENDENT_BOOKING' as type,
  property_id,
  check_in_date,
  check_out_date,
  guest_name,
  COUNT(*) as duplicate_count,
  string_agg(id::text, ', ') as booking_ids,
  string_agg(status::text, ', ') as statuses
FROM bookings
WHERE property_id = '488d5074-b6ce-40a8-b0d5-036e97993410'
  AND booking_reference = 'INDEPENDENT_BOOKING'
GROUP BY property_id, check_in_date, check_out_date, guest_name
HAVING COUNT(*) > 1
ORDER BY duplicate_count DESC;

-- 4. VÉRIFIER LES RÉSERVATIONS RÉCENTES CRÉÉES/MODIFIÉES PAR LES EDGE FUNCTIONS
-- ============================================================================
SELECT 
  'RÉSERVATIONS RÉCENTES' as type,
  id,
  booking_reference,
  guest_name,
  status,
  check_in_date,
  check_out_date,
  created_at,
  updated_at,
  EXTRACT(EPOCH FROM (updated_at - created_at))/60 as minutes_between_create_update
FROM bookings
WHERE property_id = '488d5074-b6ce-40a8-b0d5-036e97993410'
  AND updated_at >= NOW() - INTERVAL '7 days'
ORDER BY updated_at DESC
LIMIT 20;
