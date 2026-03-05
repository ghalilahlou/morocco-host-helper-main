-- ============================================================================
-- COMMANDE DE DIAGNOSTIC COMPLÈTE - TRIGGERS, FONCTIONS, STRUCTURE
-- Pour identifier l'origine du problème (Base de données / Edge Functions / Frontend)
-- ============================================================================

-- REMPLACER '488d5074-b6ce-40a8-b0d5-036e97993410' par votre property_id réel

-- ============================================================================
-- SECTION 1 : TRIGGERS SUR BOOKINGS
-- ============================================================================

-- 1.1 Liste des triggers actifs
SELECT 
  'TRIGGERS ACTIFS' as info,
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

-- 1.2 Définitions complètes des triggers
SELECT 
  'DÉFINITIONS TRIGGERS' as info,
  tgname as trigger_name,
  pg_get_triggerdef(oid) as definition
FROM pg_trigger
WHERE tgrelid = 'bookings'::regclass
  AND NOT tgisinternal
ORDER BY tgname;

-- ============================================================================
-- SECTION 2 : FONCTIONS LIÉES AUX BOOKINGS
-- ============================================================================

-- 2.1 Liste des fonctions
SELECT 
  'FONCTIONS BOOKINGS' as info,
  p.proname as function_name,
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

-- 2.2 Fonctions qui modifient les bookings (UPDATE/DELETE)
SELECT 
  'FONCTIONS QUI MODIFIENT' as info,
  p.proname as function_name,
  CASE 
    WHEN pg_get_functiondef(p.oid) ILIKE '%UPDATE%bookings%' THEN 'UPDATE'
    WHEN pg_get_functiondef(p.oid) ILIKE '%DELETE%bookings%' THEN 'DELETE'
    WHEN pg_get_functiondef(p.oid) ILIKE '%INSERT%bookings%' THEN 'INSERT'
    ELSE 'OTHER'
  END as operation
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
-- SECTION 3 : TRIGGERS ET LEURS FONCTIONS
-- ============================================================================

SELECT 
  'TRIGGERS ET FONCTIONS' as info,
  t.tgname as trigger_name,
  p.proname as function_name,
  CASE t.tgenabled 
    WHEN 'O' THEN 'ENABLED'
    ELSE 'DISABLED'
  END as status
FROM pg_trigger t
JOIN pg_proc p ON t.tgfoid = p.oid
WHERE t.tgrelid = 'bookings'::regclass
  AND NOT t.tgisinternal
ORDER BY t.tgname;

-- ============================================================================
-- SECTION 4 : POLICIES RLS
-- ============================================================================

SELECT 
  'POLICIES RLS' as info,
  policyname,
  cmd as command,
  permissive
FROM pg_policies
WHERE tablename = 'bookings'
ORDER BY policyname;

-- ============================================================================
-- SECTION 5 : CONTRAINTES
-- ============================================================================

SELECT 
  'CONTRAINTES' as info,
  conname as constraint_name,
  CASE contype
    WHEN 'p' THEN 'PRIMARY KEY'
    WHEN 'u' THEN 'UNIQUE'
    WHEN 'c' THEN 'CHECK'
    ELSE contype::text
  END as type
FROM pg_constraint
WHERE conrelid = 'bookings'::regclass
ORDER BY conname;

-- 5.2 Définitions des contraintes
SELECT 
  'DÉFINITIONS CONTRAINTES' as info,
  conname as constraint_name,
  pg_get_constraintdef(oid) as definition
FROM pg_constraint
WHERE conrelid = 'bookings'::regclass
ORDER BY conname;

-- ============================================================================
-- SECTION 6 : ÉTAT DES RÉSERVATIONS
-- ============================================================================

-- 6.1 Toutes les réservations
SELECT 
  'TOUTES LES RÉSERVATIONS' as info,
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

-- 6.2 Statistiques par statut
SELECT 
  'STATISTIQUES' as info,
  status,
  COUNT(*) as count
FROM bookings
WHERE property_id = '488d5074-b6ce-40a8-b0d5-036e97993410'
GROUP BY status
ORDER BY count DESC;

-- 6.3 Réservations récentes (24h)
SELECT 
  'RÉSERVATIONS RÉCENTES' as info,
  id,
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
-- SECTION 7 : VÉRIFICATION DES DOUBLONS
-- ============================================================================

-- 7.1 Doublons par dates
SELECT 
  'DOUBLONS PAR DATES' as info,
  check_in_date,
  check_out_date,
  COUNT(*) as count
FROM bookings
WHERE property_id = '488d5074-b6ce-40a8-b0d5-036e97993410'
GROUP BY check_in_date, check_out_date
HAVING COUNT(*) > 1
ORDER BY count DESC;

-- 7.2 Doublons par booking_reference
SELECT 
  'DOUBLONS PAR booking_reference' as info,
  booking_reference,
  COUNT(*) as count
FROM bookings
WHERE property_id = '488d5074-b6ce-40a8-b0d5-036e97993410'
  AND booking_reference IS NOT NULL
GROUP BY booking_reference
HAVING COUNT(*) > 1
ORDER BY count DESC;
