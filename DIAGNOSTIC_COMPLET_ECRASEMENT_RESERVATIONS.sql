-- ============================================================================
-- DIAGNOSTIC COMPLET : Problème d'écrasement des réservations
-- Date: 2026-02-02
-- ============================================================================

-- 1. VÉRIFIER TOUTES LES RÉSERVATIONS POUR LA PROPRIÉTÉ
-- ============================================================================
SELECT 
  '=== TOUTES LES RÉSERVATIONS ===' as section,
  b.id,
  b.booking_reference,
  b.guest_name,
  b.status,
  b.property_id,
  b.user_id,
  b.check_in_date,
  b.check_out_date,
  b.created_at,
  b.updated_at,
  -- Vérifier les documents générés
  b.documents_generated->>'contract' as has_contract,
  b.documents_generated->>'policeForm' as has_police,
  -- Compter les guests
  (SELECT COUNT(*) FROM guests WHERE booking_id = b.id) as guest_count,
  -- Compter les submissions
  (SELECT COUNT(*) FROM guest_submissions WHERE booking_id = b.id) as submission_count
FROM bookings b
WHERE b.property_id = '488d5074-b6ce-40a8-b0d5-036e97993410'
ORDER BY b.check_in_date DESC, b.created_at DESC;

-- 2. STATISTIQUES PAR STATUT
-- ============================================================================
-- ✅ CORRIGÉ : Vérifier d'abord les valeurs valides de l'enum booking_status
SELECT 
  '=== STATISTIQUES PAR STATUT ===' as section,
  b.status,
  COUNT(*) as count
FROM bookings b
WHERE b.property_id = '488d5074-b6ce-40a8-b0d5-036e97993410'
GROUP BY b.status
ORDER BY count DESC;

-- 2b. COMPTER PAR STATUT (avec détails)
SELECT 
  '=== COMPTAGE DÉTAILLÉ PAR STATUT ===' as section,
  COUNT(CASE WHEN b.status = 'completed' THEN 1 END) as completed_count,
  COUNT(CASE WHEN b.status = 'pending' THEN 1 END) as pending_count,
  COUNT(CASE WHEN b.status = 'confirmed' THEN 1 END) as confirmed_count,
  COUNT(*) as total_count
FROM bookings b
WHERE b.property_id = '488d5074-b6ce-40a8-b0d5-036e97993410';

-- 3. VÉRIFIER LES RÉSERVATIONS TERMINÉES (COMPLETED)
-- ============================================================================
SELECT 
  '=== RÉSERVATIONS TERMINÉES (COMPLETED) ===' as section,
  b.id,
  b.booking_reference,
  b.guest_name,
  b.status,
  b.check_in_date,
  b.check_out_date,
  b.created_at,
  b.updated_at,
  b.documents_generated,
  (SELECT COUNT(*) FROM guests WHERE booking_id = b.id) as guest_count,
  (SELECT COUNT(*) FROM guest_submissions WHERE booking_id = b.id) as submission_count
FROM bookings b
WHERE b.property_id = '488d5074-b6ce-40a8-b0d5-036e97993410'
  AND b.status = 'completed'
ORDER BY b.check_in_date DESC, b.created_at DESC;

-- 4. VÉRIFIER LES RÉSERVATIONS EN ATTENTE (PENDING)
-- ============================================================================
SELECT 
  '=== RÉSERVATIONS EN ATTENTE (PENDING) ===' as section,
  b.id,
  b.booking_reference,
  b.guest_name,
  b.status,
  b.check_in_date,
  b.check_out_date,
  b.created_at,
  b.updated_at,
  (SELECT COUNT(*) FROM guests WHERE booking_id = b.id) as guest_count,
  (SELECT COUNT(*) FROM guest_submissions WHERE booking_id = b.id) as submission_count
FROM bookings b
WHERE b.property_id = '488d5074-b6ce-40a8-b0d5-036e97993410'
  AND b.status = 'pending'
ORDER BY b.check_in_date DESC, b.created_at DESC;

-- 5. VÉRIFIER LES TRIGGERS ET FONCTIONS QUI MODIFIENT LES RÉSERVATIONS
-- ============================================================================
SELECT 
  '=== TRIGGERS SUR LA TABLE BOOKINGS ===' as section,
  tgname as trigger_name,
  tgtype::text as trigger_type,
  tgenabled as is_enabled,
  pg_get_triggerdef(oid) as trigger_definition
FROM pg_trigger
WHERE tgrelid = 'bookings'::regclass
  AND NOT tgisinternal
ORDER BY tgname;

-- 6. VÉRIFIER LES FONCTIONS QUI PEUVENT MODIFIER LES RÉSERVATIONS
-- ============================================================================
SELECT 
  '=== FONCTIONS LIÉES AUX BOOKINGS ===' as section,
  p.proname as function_name,
  pg_get_functiondef(p.oid) as function_definition
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
  AND (
    pg_get_functiondef(p.oid) ILIKE '%bookings%'
    OR pg_get_functiondef(p.oid) ILIKE '%booking%'
  )
ORDER BY p.proname;

-- 7. VÉRIFIER LES POLICIES RLS QUI PEUVENT FILTRER LES RÉSERVATIONS
-- ============================================================================
SELECT 
  '=== POLICIES RLS SUR BOOKINGS ===' as section,
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'bookings'
ORDER BY policyname;

-- 8. VÉRIFIER LES CONTRAINTES ET INDEX
-- ============================================================================
SELECT 
  '=== CONTRAINTES ET INDEX ===' as section,
  conname as constraint_name,
  contype as constraint_type,
  pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint
WHERE conrelid = 'bookings'::regclass
ORDER BY conname;

-- 9. VÉRIFIER LES RÉSERVATIONS RÉCENTES (DERNIÈRES 24H)
-- ============================================================================
SELECT 
  '=== RÉSERVATIONS RÉCENTES (24H) ===' as section,
  b.id,
  b.booking_reference,
  b.guest_name,
  b.status,
  b.property_id,
  b.check_in_date,
  b.created_at,
  b.updated_at,
  EXTRACT(EPOCH FROM (NOW() - b.updated_at))/3600 as hours_since_update
FROM bookings b
WHERE b.property_id = '488d5074-b6ce-40a8-b0d5-036e97993410'
  AND b.updated_at >= NOW() - INTERVAL '24 hours'
ORDER BY b.updated_at DESC;

-- 10. VÉRIFIER LES DOUBLONS POTENTIELS
-- ============================================================================
SELECT 
  '=== DOUBLONS POTENTIELS ===' as section,
  b.property_id,
  b.booking_reference,
  b.guest_name,
  b.check_in_date,
  b.check_out_date,
  COUNT(*) as duplicate_count,
  string_agg(b.id::text, ', ') as booking_ids,
  string_agg(b.status::text, ', ') as statuses
FROM bookings b
WHERE b.property_id = '488d5074-b6ce-40a8-b0d5-036e97993410'
GROUP BY b.property_id, b.booking_reference, b.guest_name, b.check_in_date, b.check_out_date
HAVING COUNT(*) > 1
ORDER BY duplicate_count DESC;

-- 11. VÉRIFIER LA VUE MATÉRIALISÉE
-- ============================================================================
SELECT 
  '=== VUE MATÉRIALISÉE ===' as section,
  COUNT(*) as total_in_view,
  COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_in_view,
  COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_in_view,
  COUNT(CASE WHEN property_id = '488d5074-b6ce-40a8-b0d5-036e97993410' THEN 1 END) as for_property_in_view
FROM mv_bookings_enriched
WHERE property_id = '488d5074-b6ce-40a8-b0d5-036e97993410';

-- 12. COMPARAISON : TABLE vs VUE MATÉRIALISÉE
-- ============================================================================
SELECT 
  '=== COMPARAISON TABLE vs VUE ===' as section,
  (SELECT COUNT(*) FROM bookings WHERE property_id = '488d5074-b6ce-40a8-b0d5-036e97993410') as count_in_table,
  (SELECT COUNT(*) FROM mv_bookings_enriched WHERE property_id = '488d5074-b6ce-40a8-b0d5-036e97993410') as count_in_view,
  (SELECT COUNT(*) FROM bookings WHERE property_id = '488d5074-b6ce-40a8-b0d5-036e97993410' AND status = 'completed') as completed_in_table,
  (SELECT COUNT(*) FROM mv_bookings_enriched WHERE property_id = '488d5074-b6ce-40a8-b0d5-036e97993410' AND status = 'completed') as completed_in_view;
