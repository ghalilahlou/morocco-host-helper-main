-- ============================================================================
-- DIAGNOSTIC COMPLET : Triggers, Fonctions et Structure de la Base de Données
-- Pour identifier l'origine du problème d'écrasement des réservations
-- ============================================================================

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
  END as level,
  pg_get_triggerdef(oid) as definition
FROM pg_trigger
WHERE tgrelid = 'bookings'::regclass
  AND NOT tgisinternal
ORDER BY tgname;

-- ============================================================================
-- PARTIE 2 : FONCTIONS LIÉES AUX BOOKINGS
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
  END as security,
  pg_get_functiondef(p.oid) as full_definition
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
  AND (
    p.proname ILIKE '%booking%'
    OR p.proname ILIKE '%duplicate%'
    OR p.proname ILIKE '%cleanup%'
    OR p.proname ILIKE '%conflict%'
    OR pg_get_functiondef(p.oid) ILIKE '%bookings%'
  )
ORDER BY p.proname;

-- ============================================================================
-- PARTIE 3 : FONCTIONS QUI MODIFIENT LES BOOKINGS (UPDATE/DELETE)
-- ============================================================================

SELECT 
  '=== FONCTIONS QUI MODIFIENT LES BOOKINGS ===' as section,
  p.proname as function_name,
  CASE 
    WHEN pg_get_functiondef(p.oid) ILIKE '%UPDATE%bookings%' THEN 'UPDATE'
    WHEN pg_get_functiondef(p.oid) ILIKE '%DELETE%bookings%' THEN 'DELETE'
    WHEN pg_get_functiondef(p.oid) ILIKE '%INSERT%bookings%' THEN 'INSERT'
    ELSE 'OTHER'
  END as operation_type,
  pg_get_functiondef(p.oid) as definition
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
-- PARTIE 4 : TRIGGERS QUI APPELENT DES FONCTIONS
-- ============================================================================

SELECT 
  '=== TRIGGERS ET LEURS FONCTIONS ===' as section,
  t.tgname as trigger_name,
  p.proname as function_name,
  CASE t.tgenabled 
    WHEN 'O' THEN 'ENABLED'
    ELSE 'DISABLED'
  END as trigger_status,
  pg_get_triggerdef(t.oid) as trigger_definition
FROM pg_trigger t
JOIN pg_proc p ON t.tgfoid = p.oid
WHERE t.tgrelid = 'bookings'::regclass
  AND NOT t.tgisinternal
ORDER BY t.tgname;

-- ============================================================================
-- PARTIE 5 : VÉRIFIER LES FONCTIONS DE NETTOYAGE/SUPPRESSION
-- ============================================================================

SELECT 
  '=== FONCTIONS DE NETTOYAGE/SUPPRESSION ===' as section,
  p.proname as function_name,
  CASE 
    WHEN pg_get_functiondef(p.oid) ILIKE '%DELETE%' THEN 'CONTAINS DELETE'
    WHEN pg_get_functiondef(p.oid) ILIKE '%cleanup%' THEN 'CLEANUP FUNCTION'
    WHEN pg_get_functiondef(p.oid) ILIKE '%duplicate%' THEN 'DUPLICATE HANDLER'
    ELSE 'OTHER'
  END as function_type,
  pg_get_functiondef(p.oid) as definition
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
  AND (
    p.proname ILIKE '%cleanup%'
    OR p.proname ILIKE '%delete%'
    OR p.proname ILIKE '%duplicate%'
    OR pg_get_functiondef(p.oid) ILIKE '%DELETE FROM bookings%'
  )
ORDER BY p.proname;

-- ============================================================================
-- PARTIE 6 : VÉRIFIER LES POLICIES RLS QUI PEUVENT FILTRER
-- ============================================================================

SELECT 
  '=== POLICIES RLS SUR BOOKINGS ===' as section,
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd as command,
  qual as using_expression,
  with_check as with_check_expression
FROM pg_policies
WHERE tablename = 'bookings'
ORDER BY policyname;

-- ============================================================================
-- PARTIE 7 : VÉRIFIER LES CONTRAINTES QUI PEUVENT BLOQUER
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
  END as validation_status,
  pg_get_constraintdef(oid) as definition
FROM pg_constraint
WHERE conrelid = 'bookings'::regclass
ORDER BY contype, conname;

-- ============================================================================
-- PARTIE 8 : VÉRIFIER LES INDEX QUI PEUVENT AFFECTER LES REQUÊTES
-- ============================================================================

SELECT 
  '=== INDEX SUR BOOKINGS ===' as section,
  indexname as index_name,
  indexdef as definition,
  CASE 
    WHEN indexdef ILIKE '%UNIQUE%' THEN 'UNIQUE'
    ELSE 'NON-UNIQUE'
  END as index_type
FROM pg_indexes
WHERE tablename = 'bookings'
  AND schemaname = 'public'
ORDER BY indexname;

-- ============================================================================
-- PARTIE 9 : VÉRIFIER LES VUES MATÉRIALISÉES
-- ============================================================================

SELECT 
  '=== VUES MATÉRIALISÉES ===' as section,
  schemaname,
  matviewname as view_name,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||matviewname)) as size,
  (SELECT COUNT(*) FROM pg_stat_user_tables WHERE relname = matviewname) as has_stats
FROM pg_matviews
WHERE matviewname ILIKE '%booking%'
ORDER BY matviewname;

-- ============================================================================
-- PARTIE 10 : RÉSUMÉ DES MODIFICATIONS RÉCENTES (DERNIERS 7 JOURS)
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
-- PARTIE 11 : VÉRIFIER LES APPELS RÉCENTS AUX FONCTIONS (si audit activé)
-- ============================================================================

-- Note: Cette requête nécessite une table d'audit si elle existe
SELECT 
  '=== VÉRIFICATIONS FINALES ===' as section,
  'Vérifiez les logs de votre application pour voir quelles fonctions sont appelées' as note,
  'Vérifiez les logs Supabase Edge Functions dans le dashboard' as note2;
