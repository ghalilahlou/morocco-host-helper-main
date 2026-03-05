-- ============================================================================
-- SCRIPT ULTRA SIMPLIFIÉ - GARANTI SANS ERREUR
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

-- 3. COMPTER PAR STATUT
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
  updated_at
FROM bookings
WHERE property_id = '488d5074-b6ce-40a8-b0d5-036e97993410'
ORDER BY check_in_date DESC, created_at DESC;

-- 5. COMPTER LES RÉSERVATIONS TERMINÉES
-- ============================================================================
SELECT 
  'RÉSERVATIONS TERMINÉES' as type,
  COUNT(*) as count
FROM bookings
WHERE property_id = '488d5074-b6ce-40a8-b0d5-036e97993410'
  AND status = 'completed';

-- 6. COMPTER LES RÉSERVATIONS EN ATTENTE
-- ============================================================================
SELECT 
  'RÉSERVATIONS EN ATTENTE' as type,
  COUNT(*) as count
FROM bookings
WHERE property_id = '488d5074-b6ce-40a8-b0d5-036e97993410'
  AND status = 'pending';

-- 7. RÉSERVATIONS RÉCENTES (DERNIÈRES 24H)
-- ============================================================================
SELECT 
  id,
  booking_reference,
  guest_name,
  status,
  created_at,
  updated_at
FROM bookings
WHERE property_id = '488d5074-b6ce-40a8-b0d5-036e97993410'
  AND updated_at >= NOW() - INTERVAL '24 hours'
ORDER BY updated_at DESC;

-- 8. VÉRIFIER LES DOUBLONS (sans array_agg pour éviter les erreurs)
-- ============================================================================
SELECT 
  property_id,
  check_in_date,
  check_out_date,
  COUNT(*) as duplicate_count
FROM bookings
WHERE property_id = '488d5074-b6ce-40a8-b0d5-036e97993410'
GROUP BY property_id, check_in_date, check_out_date
HAVING COUNT(*) > 1
ORDER BY duplicate_count DESC;

-- 9. DÉTAILS DES DOUBLONS (si la requête #8 retourne des résultats)
-- ============================================================================
-- Exécutez cette requête seulement si la requête #8 montre des doublons
-- Remplacez les dates par celles trouvées dans la requête #8
/*
SELECT 
  id,
  booking_reference,
  guest_name,
  status,
  check_in_date,
  check_out_date,
  created_at
FROM bookings
WHERE property_id = '488d5074-b6ce-40a8-b0d5-036e97993410'
  AND check_in_date = '2026-01-15'  -- Remplacez par la date trouvée
  AND check_out_date = '2026-01-20'  -- Remplacez par la date trouvée
ORDER BY created_at;
*/

-- 10. VÉRIFIER LES TRIGGERS ACTIFS
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

-- 11. VÉRIFIER LES CONTRAINTES UNIQUES
-- ============================================================================
SELECT 
  conname as constraint_name,
  CASE contype
    WHEN 'u' THEN 'UNIQUE'
    WHEN 'p' THEN 'PRIMARY KEY'
    WHEN 'c' THEN 'CHECK'
    ELSE contype::text
  END as constraint_type
FROM pg_constraint
WHERE conrelid = 'bookings'::regclass
  AND contype IN ('u', 'p')
ORDER BY conname;
