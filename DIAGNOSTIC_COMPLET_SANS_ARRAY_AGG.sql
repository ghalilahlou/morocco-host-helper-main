-- ============================================================================
-- DIAGNOSTIC COMPLET : Triggers, Fonctions et Structure (VERSION SANS ERREURS)
-- Pour identifier l'origine du problème d'écrasement des réservations
-- ============================================================================

-- REMPLACER '488d5074-b6ce-40a8-b0d5-036e97993410' par votre property_id réel

-- ============================================================================
-- PARTIE 1 : TRIGGERS SUR LA TABLE BOOKINGS
-- ============================================================================

SELECT 
  '=== TRIGGERS SUR BOOKINGS ===' as section,
  tgname as trigger_name,
  CASE tgenabled 
    WHEN 'O' THEN 'ENABLED'
    WHEN 'D' THEN 'DISABLED'
    WHEN 'R' THEN 'REPLICA'
    WHEN 'A' THEN 'ALWAYS'
    ELSE 'UNKNOWN'
  END as status,
  CASE tgtype::integer & 2
    WHEN 2 THEN 'BEFORE'
    ELSE 'AFTER'
  END as timing,
  CASE tgtype::integer & 4
    WHEN 4 THEN 'INSERT'
    ELSE ''
  END ||
  CASE tgtype::integer & 8
    WHEN 8 THEN ' UPDATE'
    ELSE ''
  END ||
  CASE tgtype::integer & 16
    WHEN 16 THEN ' DELETE'
    ELSE ''
  END as events,
  CASE tgtype::integer & 1
    WHEN 1 THEN 'ROW'
    ELSE 'STATEMENT'
  END as level
FROM pg_trigger
WHERE tgrelid = 'bookings'::regclass
  AND NOT tgisinternal
ORDER BY tgname;

-- ============================================================================
-- PARTIE 2 : DÉFINITIONS DES TRIGGERS (séparé pour éviter les erreurs)
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
-- PARTIE 3 : FONCTIONS LIÉES AUX BOOKINGS (noms seulement)
-- ============================================================================

SELECT 
  '=== FONCTIONS LIÉES AUX BOOKINGS ===' as section,
  p.proname as function_name,
  pg_get_function_identity_arguments(p.oid) as arguments,
  CASE p.provolatile
    WHEN 'i' THEN 'IMMUTABLE'
    WHEN 's' THEN 'STABLE'
    WHEN 'v' THEN 'VOLATILE'
  END as volatility,
  CASE p.prosecdef
    WHEN true THEN 'SECURITY DEFINER'
    ELSE 'SECURITY INVOKER'
  END as security
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
-- PARTIE 4 : FONCTIONS QUI MODIFIENT LES BOOKINGS
-- ============================================================================

SELECT 
  '=== FONCTIONS QUI MODIFIENT LES BOOKINGS ===' as section,
  p.proname as function_name,
  CASE 
    WHEN pg_get_functiondef(p.oid) ILIKE '%UPDATE%bookings%' THEN 'UPDATE'
    WHEN pg_get_functiondef(p.oid) ILIKE '%DELETE%bookings%' THEN 'DELETE'
    WHEN pg_get_functiondef(p.oid) ILIKE '%INSERT%bookings%' THEN 'INSERT'
    ELSE 'OTHER'
  END as operation_type
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
  AND (
    pg_get_functiondef(p.oid) ILIKE '%UPDATE%bookings%'
    OR pg_get_functiondef(p.oid) ILIKE '%DELETE%bookings%'
    OR pg_get_functiondef(p.oid) ILIKE '%INSERT%bookings%'
  )
ORDER BY p.proname;

-- ============================================================================
-- PARTIE 5 : TRIGGERS ET LEURS FONCTIONS
-- ============================================================================

SELECT 
  '=== TRIGGERS ET LEURS FONCTIONS ===' as section,
  t.tgname as trigger_name,
  p.proname as function_name,
  CASE t.tgenabled 
    WHEN 'O' THEN 'ENABLED'
    ELSE 'DISABLED'
  END as trigger_status
FROM pg_trigger t
JOIN pg_proc p ON t.tgfoid = p.oid
WHERE t.tgrelid = 'bookings'::regclass
  AND NOT t.tgisinternal
ORDER BY t.tgname;

-- ============================================================================
-- PARTIE 6 : FONCTIONS DE NETTOYAGE/SUPPRESSION
-- ============================================================================

SELECT 
  '=== FONCTIONS DE NETTOYAGE/SUPPRESSION ===' as section,
  p.proname as function_name,
  CASE 
    WHEN pg_get_functiondef(p.oid) ILIKE '%DELETE%' THEN 'CONTAINS DELETE'
    WHEN pg_get_functiondef(p.oid) ILIKE '%cleanup%' THEN 'CLEANUP FUNCTION'
    WHEN pg_get_functiondef(p.oid) ILIKE '%duplicate%' THEN 'DUPLICATE HANDLER'
    ELSE 'OTHER'
  END as function_type
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
  AND (
    p.proname ILIKE '%cleanup%'
    OR p.proname ILIKE '%delete%'
    OR p.proname ILIKE '%duplicate%'
  )
ORDER BY p.proname;

-- ============================================================================
-- PARTIE 7 : POLICIES RLS SUR BOOKINGS
-- ============================================================================

SELECT 
  '=== POLICIES RLS SUR BOOKINGS ===' as section,
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd as command
FROM pg_policies
WHERE tablename = 'bookings'
ORDER BY policyname;

-- ============================================================================
-- PARTIE 8 : CONTRAINTES SUR BOOKINGS
-- ============================================================================

SELECT 
  '=== CONTRAINTES SUR BOOKINGS ===' as section,
  conname as constraint_name,
  CASE contype
    WHEN 'p' THEN 'PRIMARY KEY'
    WHEN 'u' THEN 'UNIQUE'
    WHEN 'c' THEN 'CHECK'
    WHEN 'f' THEN 'FOREIGN KEY'
    WHEN 't' THEN 'TRIGGER'
    ELSE contype::text
  END as constraint_type,
  CASE convalidated
    WHEN true THEN 'VALIDATED'
    ELSE 'NOT VALIDATED'
  END as validation_status
FROM pg_constraint
WHERE conrelid = 'bookings'::regclass
ORDER BY contype, conname;

-- ============================================================================
-- PARTIE 9 : DÉFINITIONS DES CONTRAINTES (séparé)
-- ============================================================================

SELECT 
  '=== DÉFINITIONS DES CONTRAINTES ===' as section,
  conname as constraint_name,
  pg_get_constraintdef(oid) as definition
FROM pg_constraint
WHERE conrelid = 'bookings'::regclass
ORDER BY conname;

-- ============================================================================
-- PARTIE 10 : INDEX SUR BOOKINGS
-- ============================================================================

SELECT 
  '=== INDEX SUR BOOKINGS ===' as section,
  indexname as index_name,
  CASE 
    WHEN indexdef ILIKE '%UNIQUE%' THEN 'UNIQUE'
    ELSE 'NON-UNIQUE'
  END as index_type
FROM pg_indexes
WHERE tablename = 'bookings'
  AND schemaname = 'public'
ORDER BY indexname;

-- ============================================================================
-- PARTIE 11 : VUES MATÉRIALISÉES
-- ============================================================================

SELECT 
  '=== VUES MATÉRIALISÉES ===' as section,
  schemaname,
  matviewname as view_name,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||matviewname)) as size
FROM pg_matviews
WHERE matviewname ILIKE '%booking%'
ORDER BY matviewname;

-- ============================================================================
-- PARTIE 12 : RÉSUMÉ DES MODIFICATIONS RÉCENTES
-- ============================================================================

SELECT 
  '=== RÉSUMÉ DES MODIFICATIONS RÉCENTES ===' as section,
  COUNT(*) as total_bookings,
  COUNT(CASE WHEN created_at >= NOW() - INTERVAL '7 days' THEN 1 END) as created_last_7_days,
  COUNT(CASE WHEN updated_at >= NOW() - INTERVAL '7 days' THEN 1 END) as updated_last_7_days,
  COUNT(CASE WHEN created_at >= NOW() - INTERVAL '24 hours' THEN 1 END) as created_last_24h,
  COUNT(CASE WHEN updated_at >= NOW() - INTERVAL '24 hours' THEN 1 END) as updated_last_24h
FROM bookings
WHERE property_id = '488d5074-b6ce-40a8-b0d5-036e97993410';

-- ============================================================================
-- PARTIE 13 : LISTER TOUTES LES RÉSERVATIONS POUR ANALYSE
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
