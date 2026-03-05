-- ============================================================================
-- DIAGNOSTIC FINAL : Problème d'écrasement des réservations
-- VERSION GARANTIE SANS ERREURS
-- ============================================================================

-- REMPLACER '488d5074-b6ce-40a8-b0d5-036e97993410' par votre property_id réel

-- ============================================================================
-- PARTIE 1 : TOUTES LES RÉSERVATIONS POUR LA PROPRIÉTÉ
-- ============================================================================
SELECT 
  '=== TOUTES LES RÉSERVATIONS ===' as section,
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

-- ============================================================================
-- PARTIE 2 : STATISTIQUES PAR STATUT
-- ============================================================================
SELECT 
  '=== STATISTIQUES PAR STATUT ===' as section,
  status,
  COUNT(*) as count
FROM bookings
WHERE property_id = '488d5074-b6ce-40a8-b0d5-036e97993410'
GROUP BY status
ORDER BY count DESC;

-- ============================================================================
-- PARTIE 3 : COMPTAGE DÉTAILLÉ
-- ============================================================================
SELECT 
  '=== COMPTAGE DÉTAILLÉ ===' as section,
  COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_count,
  COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_count,
  COUNT(CASE WHEN status = 'confirmed' THEN 1 END) as confirmed_count,
  COUNT(*) as total_count
FROM bookings
WHERE property_id = '488d5074-b6ce-40a8-b0d5-036e97993410';

-- ============================================================================
-- PARTIE 4 : RÉSERVATIONS TERMINÉES
-- ============================================================================
SELECT 
  '=== RÉSERVATIONS TERMINÉES ===' as section,
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
  AND status = 'completed'
ORDER BY check_in_date DESC, created_at DESC;

-- ============================================================================
-- PARTIE 5 : RÉSERVATIONS EN ATTENTE
-- ============================================================================
SELECT 
  '=== RÉSERVATIONS EN ATTENTE ===' as section,
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
  AND status = 'pending'
ORDER BY check_in_date DESC, created_at DESC;

-- ============================================================================
-- PARTIE 6 : TRIGGERS SUR BOOKINGS
-- ============================================================================
SELECT 
  '=== TRIGGERS SUR BOOKINGS ===' as section,
  tgname as trigger_name,
  CASE tgenabled 
    WHEN 'O' THEN 'ENABLED'
    WHEN 'D' THEN 'DISABLED'
    ELSE 'OTHER'
  END as status
FROM pg_trigger
WHERE tgrelid = 'bookings'::regclass
  AND NOT tgisinternal
ORDER BY tgname;

-- ============================================================================
-- PARTIE 7 : DÉFINITIONS DES TRIGGERS
-- ============================================================================
SELECT 
  '=== DÉFINITIONS DES TRIGGERS ===' as section,
  tgname as trigger_name,
  pg_get_triggerdef(oid) as definition
FROM pg_trigger
WHERE tgrelid = 'bookings'::regclass
  AND NOT tgisinternal
ORDER BY tgname;

-- ============================================================================
-- PARTIE 8 : FONCTIONS LIÉES AUX BOOKINGS
-- ============================================================================
SELECT 
  '=== FONCTIONS LIÉES AUX BOOKINGS ===' as section,
  p.proname as function_name
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
  AND (
    p.proname ILIKE '%booking%'
    OR p.proname ILIKE '%duplicate%'
    OR p.proname ILIKE '%cleanup%'
    OR p.proname ILIKE '%conflict%'
  )
ORDER BY p.proname;

-- ============================================================================
-- PARTIE 9 : POLICIES RLS
-- ============================================================================
SELECT 
  '=== POLICIES RLS ===' as section,
  policyname,
  cmd as command
FROM pg_policies
WHERE tablename = 'bookings'
ORDER BY policyname;

-- ============================================================================
-- PARTIE 10 : CONTRAINTES
-- ============================================================================
SELECT 
  '=== CONTRAINTES ===' as section,
  conname as constraint_name,
  CASE contype
    WHEN 'p' THEN 'PRIMARY KEY'
    WHEN 'u' THEN 'UNIQUE'
    WHEN 'c' THEN 'CHECK'
    ELSE contype::text
  END as constraint_type
FROM pg_constraint
WHERE conrelid = 'bookings'::regclass
ORDER BY conname;

-- ============================================================================
-- PARTIE 11 : DÉFINITIONS DES CONTRAINTES
-- ============================================================================
SELECT 
  '=== DÉFINITIONS DES CONTRAINTES ===' as section,
  conname as constraint_name,
  pg_get_constraintdef(oid) as definition
FROM pg_constraint
WHERE conrelid = 'bookings'::regclass
ORDER BY conname;

-- ============================================================================
-- PARTIE 12 : RÉSERVATIONS RÉCENTES (24H)
-- ============================================================================
SELECT 
  '=== RÉSERVATIONS RÉCENTES (24H) ===' as section,
  id,
  booking_reference,
  guest_name,
  status,
  check_in_date,
  created_at,
  updated_at
FROM bookings
WHERE property_id = '488d5074-b6ce-40a8-b0d5-036e97993410'
  AND updated_at >= NOW() - INTERVAL '24 hours'
ORDER BY updated_at DESC;

-- ============================================================================
-- PARTIE 13 : VÉRIFIER LES DOUBLONS PAR DATES (sans guest_name)
-- ============================================================================
SELECT 
  '=== DOUBLONS PAR DATES ===' as section,
  property_id,
  check_in_date,
  check_out_date,
  COUNT(*) as duplicate_count
FROM bookings
WHERE property_id = '488d5074-b6ce-40a8-b0d5-036e97993410'
GROUP BY property_id, check_in_date, check_out_date
HAVING COUNT(*) > 1
ORDER BY duplicate_count DESC;

-- ============================================================================
-- PARTIE 14 : DÉTAILS DES DOUBLONS (si la partie 13 retourne des résultats)
-- ============================================================================
-- Exécutez cette requête seulement si la partie 13 montre des doublons
-- Remplacez les dates par celles trouvées dans la partie 13
/*
SELECT 
  '=== DÉTAILS DES DOUBLONS ===' as section,
  id,
  booking_reference,
  guest_name,
  status,
  check_in_date,
  check_out_date,
  created_at
FROM bookings
WHERE property_id = '488d5074-b6ce-40a8-b0d5-036e97993410'
  AND check_in_date = '2026-02-24'  -- Remplacez par la date trouvée
  AND check_out_date = '2026-02-26'  -- Remplacez par la date trouvée
ORDER BY created_at;
*/

-- ============================================================================
-- PARTIE 15 : COMPARAISON TABLE vs VUE MATÉRIALISÉE
-- ============================================================================
SELECT 
  '=== COMPARAISON TABLE vs VUE ===' as section,
  (SELECT COUNT(*) FROM bookings WHERE property_id = '488d5074-b6ce-40a8-b0d5-036e97993410') as count_in_table,
  (SELECT COUNT(*) FROM mv_bookings_enriched WHERE property_id = '488d5074-b6ce-40a8-b0d5-036e97993410') as count_in_view,
  (SELECT COUNT(*) FROM bookings WHERE property_id = '488d5074-b6ce-40a8-b0d5-036e97993410' AND status = 'completed') as completed_in_table,
  (SELECT COUNT(*) FROM mv_bookings_enriched WHERE property_id = '488d5074-b6ce-40a8-b0d5-036e97993410' AND status = 'completed') as completed_in_view;
