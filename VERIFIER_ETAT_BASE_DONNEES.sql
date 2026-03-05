-- ============================================================================
-- SCRIPT DE VÉRIFICATION COMPLÈTE DE L'ÉTAT DE LA BASE DE DONNÉES
-- Pour diagnostiquer le problème d'écrasement des réservations
-- ============================================================================

-- REMPLACER '488d5074-b6ce-40a8-b0d5-036e97993410' par votre property_id réel
-- Vous pouvez le trouver dans l'URL ou dans les logs de l'application

-- 1. COMPTER TOUTES LES RÉSERVATIONS POUR LA PROPRIÉTÉ
-- ============================================================================
SELECT 
  'TOTAL RÉSERVATIONS' as type,
  COUNT(*) as count
FROM bookings
WHERE property_id = '488d5074-b6ce-40a8-b0d5-036e97993410';

-- 2. COMPTER PAR STATUT
-- ============================================================================
SELECT 
  status,
  COUNT(*) as count
FROM bookings
WHERE property_id = '488d5074-b6ce-40a8-b0d5-036e97993410'
GROUP BY status
ORDER BY count DESC;

-- 3. LISTER TOUTES LES RÉSERVATIONS AVEC DÉTAILS
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

-- 4. VÉRIFIER LES RÉSERVATIONS TERMINÉES (COMPLETED)
-- ============================================================================
SELECT 
  'RÉSERVATIONS TERMINÉES' as type,
  COUNT(*) as count
FROM bookings
WHERE property_id = '488d5074-b6ce-40a8-b0d5-036e97993410'
  AND status = 'completed';

-- 5. VÉRIFIER LES RÉSERVATIONS EN ATTENTE (PENDING)
-- ============================================================================
SELECT 
  'RÉSERVATIONS EN ATTENTE' as type,
  COUNT(*) as count
FROM bookings
WHERE property_id = '488d5074-b6ce-40a8-b0d5-036e97993410'
  AND status = 'pending';

-- 6. VÉRIFIER LES TRIGGERS ACTIFS
-- ============================================================================
SELECT 
  tgname as trigger_name,
  tgenabled as is_enabled,
  pg_get_triggerdef(oid) as definition
FROM pg_trigger
WHERE tgrelid = 'bookings'::regclass
  AND NOT tgisinternal
ORDER BY tgname;

-- 7. VÉRIFIER LES CONTRAINTES UNIQUES (qui peuvent bloquer les insertions)
-- ============================================================================
SELECT 
  conname as constraint_name,
  contype as constraint_type,
  pg_get_constraintdef(oid) as definition
FROM pg_constraint
WHERE conrelid = 'bookings'::regclass
  AND contype IN ('u', 'p')  -- unique ou primary key
ORDER BY conname;

-- 8. VÉRIFIER SI LA FONCTION cleanup_duplicate_bookings EXISTE
-- ============================================================================
-- Cette fonction peut supprimer des réservations si elle a été appelée avec dry_run=FALSE
-- Vérifier d'abord si elle existe dans la base de données
SELECT 
  '=== FONCTIONS DE NETTOYAGE ===' as section,
  p.proname as function_name,
  CASE 
    WHEN p.proname = 'identify_duplicate_bookings' THEN 'EXISTE - Peut identifier les doublons'
    WHEN p.proname = 'cleanup_duplicate_bookings' THEN 'EXISTE - Peut supprimer les doublons'
    ELSE 'AUTRE'
  END as function_status
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
  AND (p.proname LIKE '%duplicate%' OR p.proname LIKE '%cleanup%')
ORDER BY p.proname;

-- 9. VÉRIFIER LES RÉSERVATIONS RÉCENTES (DERNIÈRES 24H)
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

-- 10. VÉRIFIER LES DOUBLONS POTENTIELS
-- ============================================================================
SELECT 
  property_id,
  check_in_date,
  check_out_date,
  COUNT(*) as duplicate_count,
  string_agg(id::text, ', ') as booking_ids,
  string_agg(status::text, ', ') as statuses
FROM bookings
WHERE property_id = '488d5074-b6ce-40a8-b0d5-036e97993410'
GROUP BY property_id, check_in_date, check_out_date
HAVING COUNT(*) > 1
ORDER BY duplicate_count DESC;
