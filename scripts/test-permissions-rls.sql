-- ==========================================
-- TEST PERMISSIONS ET POLITIQUES RLS
-- Morocco Host Helper Platform
-- ==========================================

-- ===========================================
-- 1. AUDIT DES POLITIQUES RLS EXISTANTES
-- ===========================================

SELECT '🔒 AUDIT POLITIQUES RLS' as test_section;

-- Voir toutes les politiques RLS actuelles
SELECT 
  'Politiques RLS actuelles' as audit_type,
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual
FROM pg_policies 
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

-- Compter les politiques par table
SELECT 
  'Nombre de politiques par table' as audit_type,
  tablename,
  count(*) as nb_policies,
  CASE 
    WHEN count(*) >= 2 THEN '✅ Bien protégée'
    WHEN count(*) = 1 THEN '⚠️ Protection partielle'
    ELSE '❌ Non protégée'
  END as protection_level
FROM pg_policies 
WHERE schemaname = 'public'
GROUP BY tablename
ORDER BY count(*) DESC;

-- ===========================================
-- 2. VÉRIFICATION RLS ACTIVÉ
-- ===========================================

SELECT '🔒 VÉRIFICATION RLS ACTIVÉ' as test_section;

-- Vérifier si RLS est activé sur les tables critiques
SELECT 
  'État RLS par table' as check_type,
  c.relname as table_name,
  CASE 
    WHEN c.relrowsecurity THEN '✅ RLS activé'
    ELSE '❌ RLS désactivé'
  END as rls_status,
  CASE 
    WHEN c.relforcerowsecurity THEN '✅ Force RLS'
    ELSE '⚠️ Pas de force RLS'
  END as force_rls_status
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' 
  AND c.relkind = 'r'
  AND c.relname IN ('properties', 'bookings', 'host_profiles', 'admin_users', 'token_allocations')
ORDER BY c.relname;

-- ===========================================
-- 3. TEST ACCÈS ADMINISTRATEUR
-- ===========================================

SELECT '👨‍💼 TEST ACCÈS ADMINISTRATEUR' as test_section;

-- Vérifier les utilisateurs administrateurs
SELECT 
  'Utilisateurs administrateurs' as admin_check,
  count(*) as nb_admins,
  string_agg(DISTINCT role, ', ') as roles_available,
  CASE 
    WHEN count(*) > 0 THEN '✅ Des admins existent'
    ELSE '❌ Aucun admin configuré'
  END as admin_status
FROM admin_users;

-- Détails des admins
SELECT 
  'Détails administrateurs' as admin_details,
  au.role,
  u.email,
  au.created_at,
  CASE 
    WHEN au.role = 'super_admin' THEN '🔴 Super Admin'
    WHEN au.role = 'admin' THEN '🟡 Admin'
    ELSE '🟢 ' || au.role
  END as role_display
FROM admin_users au
JOIN auth.users u ON u.id = au.user_id
ORDER BY 
  CASE au.role 
    WHEN 'super_admin' THEN 1 
    WHEN 'admin' THEN 2 
    ELSE 3 
  END;

-- ===========================================
-- 4. TEST POLITIQUES SPÉCIFIQUES
-- ===========================================

SELECT '🔐 TEST POLITIQUES SPÉCIFIQUES' as test_section;

-- Test politique admin_users
SELECT 
  'Politique admin_users' as policy_test,
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM pg_policies 
      WHERE tablename = 'admin_users' 
      AND schemaname = 'public'
    ) THEN '✅ Politiques admin_users configurées'
    ELSE '❌ Aucune politique admin_users'
  END as admin_users_policy_status;

-- Test politique properties  
SELECT 
  'Politique properties' as policy_test,
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM pg_policies 
      WHERE tablename = 'properties' 
      AND schemaname = 'public'
    ) THEN '✅ Politiques properties configurées'
    ELSE '❌ Aucune politique properties'
  END as properties_policy_status;

-- Test politique bookings
SELECT 
  'Politique bookings' as policy_test,
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM pg_policies 
      WHERE tablename = 'bookings' 
      AND schemaname = 'public'
    ) THEN '✅ Politiques bookings configurées'
    ELSE '❌ Aucune politique bookings'
  END as bookings_policy_status;

-- ===========================================
-- 5. TEST FONCTIONS DE SÉCURITÉ
-- ===========================================

SELECT '🛡️ TEST FONCTIONS SÉCURITÉ' as test_section;

-- Vérifier les fonctions avec SECURITY DEFINER
SELECT 
  'Fonctions SECURITY DEFINER' as security_check,
  routine_name,
  security_type,
  CASE 
    WHEN security_type = 'DEFINER' THEN '✅ Sécurisée'
    ELSE '⚠️ Non sécurisée'
  END as security_status
FROM information_schema.routines 
WHERE routine_schema = 'public'
  AND routine_name IN ('get_users_for_admin', 'get_dashboard_stats_real', 'get_all_users_for_admin')
ORDER BY routine_name;

-- ===========================================
-- 6. SIMULATION TEST ACCÈS
-- ===========================================

SELECT '🧪 SIMULATION TEST ACCÈS' as test_section;

-- Simuler accès normal (non-admin)
SELECT 
  'Simulation accès utilisateur normal' as simulation_type,
  'Peut voir ses propres propriétés' as access_level,
  count(*) as nb_properties_visible
FROM properties 
WHERE user_id IS NOT NULL; -- Simule auth.uid() = user_id

-- Simuler accès admin (via fonction)
SELECT 
  'Simulation accès administrateur' as simulation_type,
  'Peut voir toutes les données via fonctions' as access_level,
  CASE 
    WHEN public.get_users_for_admin() IS NOT NULL 
    THEN 'OK - ' || json_array_length(public.get_users_for_admin()) || ' utilisateurs visibles'
    ELSE 'ÉCHEC - Aucune donnée accessible'
  END as admin_access_result;

-- ===========================================
-- 7. VÉRIFICATION POLITIQUES CRITIQUES
-- ===========================================

SELECT '⚠️ VÉRIFICATION POLITIQUES CRITIQUES' as test_section;

-- Vérifier si les politiques permettent l'accès admin
SELECT 
  'Politiques autorisant admin' as critical_check,
  tablename,
  policyname,
  CASE 
    WHEN qual LIKE '%admin%' OR qual LIKE '%get_user_role%' THEN '✅ Inclut logique admin'
    ELSE '⚠️ Pas de logique admin détectée'
  END as admin_logic_status
FROM pg_policies 
WHERE schemaname = 'public'
  AND tablename IN ('properties', 'bookings', 'admin_users')
ORDER BY tablename;

-- ===========================================
-- 8. RECOMMANDATIONS SÉCURITÉ
-- ===========================================

SELECT '📋 RECOMMANDATIONS SÉCURITÉ' as test_section;

WITH security_audit AS (
  SELECT 
    -- RLS activé sur tables critiques
    (SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace 
     WHERE n.nspname = 'public' AND c.relkind = 'r' AND c.relrowsecurity 
     AND c.relname IN ('properties', 'bookings', 'admin_users')) as tables_with_rls,
    -- Politiques configurées
    (SELECT count(DISTINCT tablename) FROM pg_policies 
     WHERE schemaname = 'public' AND tablename IN ('properties', 'bookings', 'admin_users')) as tables_with_policies,
    -- Admins configurés
    (SELECT count(*) FROM admin_users) as nb_admins,
    -- Fonctions sécurisées
    (SELECT count(*) FROM information_schema.routines 
     WHERE routine_schema = 'public' AND security_type = 'DEFINER'
     AND routine_name LIKE '%admin%') as secure_functions
)
SELECT 
  'Score sécurité' as metric,
  (tables_with_rls + tables_with_policies + CASE WHEN nb_admins > 0 THEN 1 ELSE 0 END + secure_functions) as score_total,
  CASE 
    WHEN (tables_with_rls + tables_with_policies + CASE WHEN nb_admins > 0 THEN 1 ELSE 0 END + secure_functions) >= 6
    THEN '✅ Sécurité excellente'
    WHEN (tables_with_rls + tables_with_policies + CASE WHEN nb_admins > 0 THEN 1 ELSE 0 END + secure_functions) >= 4
    THEN '⚠️ Sécurité correcte'
    ELSE '❌ Sécurité insuffisante'
  END as security_level,
  CASE 
    WHEN tables_with_rls < 3 THEN 'Activez RLS sur toutes les tables critiques'
    WHEN tables_with_policies < 3 THEN 'Ajoutez des politiques RLS'
    WHEN nb_admins = 0 THEN 'Créez au moins un utilisateur admin'
    ELSE 'Sécurité bien configurée'
  END as recommendation
FROM security_audit;

-- ===========================================
-- 9. RÉSUMÉ PERMISSIONS
-- ===========================================

SELECT '🏁 RÉSUMÉ PERMISSIONS' as final_section;

SELECT 
  'État général des permissions' as summary,
  (SELECT count(*) FROM pg_policies WHERE schemaname = 'public') as total_policies,
  (SELECT count(DISTINCT tablename) FROM pg_policies WHERE schemaname = 'public') as tables_protected,
  (SELECT count(*) FROM admin_users) as admin_users_count,
  CASE 
    WHEN (SELECT count(*) FROM pg_policies WHERE schemaname = 'public') >= 5 AND
         (SELECT count(*) FROM admin_users) > 0
    THEN '✅ Permissions bien configurées'
    WHEN (SELECT count(*) FROM pg_policies WHERE schemaname = 'public') >= 2
    THEN '⚠️ Permissions partielles'
    ELSE '❌ Permissions insuffisantes'
  END as permissions_status;

SELECT '==========================================';
SELECT 'TESTS PERMISSIONS ET RLS TERMINÉS';
SELECT 'Vérifiez les ❌ et ⚠️ ci-dessus pour améliorer la sécurité';
SELECT '==========================================';
