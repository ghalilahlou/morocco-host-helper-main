-- =====================================================
-- DIAGNOSTIC COMPLET DE LA LOGIQUE ADMINISTRATEUR
-- =====================================================

-- 1. VÉRIFICATION DES TABLES ADMIN
-- =====================================================
SELECT '1. VÉRIFICATION DES TABLES ADMIN' as section;

-- Vérifier si les tables admin existent
SELECT 
  schemaname,
  tablename,
  tableowner
FROM pg_tables 
WHERE tablename IN ('admin_users', 'token_allocations', 'admin_activity_logs', 'admin_statistics')
ORDER BY tablename;

-- 2. VÉRIFICATION DES POLITIQUES RLS
-- =====================================================
SELECT '2. VÉRIFICATION DES POLITIQUES RLS' as section;

-- Voir toutes les politiques RLS sur admin_users
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies 
WHERE tablename = 'admin_users'
ORDER BY policyname;

-- 3. VÉRIFICATION DES CONTRAINTES
-- =====================================================
SELECT '3. VÉRIFICATION DES CONTRAINTES' as section;

-- Voir les contraintes sur admin_users
SELECT 
  tc.constraint_name,
  tc.constraint_type,
  kcu.column_name,
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
  AND tc.table_schema = kcu.table_schema
LEFT JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
  AND ccu.table_schema = tc.table_schema
WHERE tc.table_name = 'admin_users'
ORDER BY tc.constraint_type, tc.constraint_name;

-- 4. VÉRIFICATION DES DONNÉES ADMIN
-- =====================================================
SELECT '4. VÉRIFICATION DES DONNÉES ADMIN' as section;

-- Compter tous les administrateurs
SELECT 
  'admin_users' as table_name,
  COUNT(*) as total_records,
  COUNT(CASE WHEN is_active = true THEN 1 END) as active_records,
  COUNT(CASE WHEN role = 'super_admin' THEN 1 END) as super_admins,
  COUNT(CASE WHEN role = 'admin' THEN 1 END) as admins
FROM public.admin_users;

-- 5. VÉRIFICATION DES UTILISATEURS SPÉCIFIQUES
-- =====================================================
SELECT '5. VÉRIFICATION DES UTILISATEURS SPÉCIFIQUES' as section;

-- Vérifier les 3 utilisateurs spécifiques
SELECT 
  u.email,
  u.id as user_id,
  u.created_at as user_created,
  CASE 
    WHEN au.id IS NOT NULL THEN '✅ Administrateur'
    ELSE '❌ Non administrateur'
  END as admin_status,
  au.role,
  au.is_active as admin_active,
  au.created_at as admin_created,
  ta.tokens_allocated,
  ta.tokens_remaining
FROM auth.users u
LEFT JOIN public.admin_users au ON u.id = au.user_id
LEFT JOIN public.token_allocations ta ON u.id = ta.user_id
WHERE u.email IN ('ghalilahlou26@gmail.com', 'L.benmouaz@gmail.com', 'Hicham.boumnade@nexa-p.com')
ORDER BY u.email;

-- 6. VÉRIFICATION DES DOUBLONS
-- =====================================================
SELECT '6. VÉRIFICATION DES DOUBLONS' as section;

-- Chercher les doublons dans admin_users
SELECT 
  user_id,
  COUNT(*) as count_duplicates,
  array_agg(id) as duplicate_ids,
  array_agg(role) as roles,
  array_agg(is_active) as active_states
FROM public.admin_users
GROUP BY user_id
HAVING COUNT(*) > 1
ORDER BY count_duplicates DESC;

-- 7. VÉRIFICATION DES TOKENS
-- =====================================================
SELECT '7. VÉRIFICATION DES TOKENS' as section;

-- Compter les allocations de tokens
SELECT 
  'token_allocations' as table_name,
  COUNT(*) as total_allocations,
  COUNT(CASE WHEN is_active = true THEN 1 END) as active_allocations,
  SUM(tokens_allocated) as total_tokens_allocated,
  SUM(tokens_used) as total_tokens_used,
  SUM(tokens_remaining) as total_tokens_remaining
FROM public.token_allocations;

-- 8. VÉRIFICATION DES TRIGGERS
-- =====================================================
SELECT '8. VÉRIFICATION DES TRIGGERS' as section;

-- Voir les triggers sur admin_users
SELECT 
  trigger_name,
  event_manipulation,
  action_timing,
  action_statement
FROM information_schema.triggers
WHERE event_object_table = 'admin_users'
ORDER BY trigger_name;

-- 9. VÉRIFICATION DES FONCTIONS
-- =====================================================
SELECT '9. VÉRIFICATION DES FONCTIONS' as section;

-- Voir les fonctions liées aux admins
SELECT 
  proname as function_name,
  prosrc as function_source
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public' 
  AND prosrc ILIKE '%admin%'
ORDER BY proname;
