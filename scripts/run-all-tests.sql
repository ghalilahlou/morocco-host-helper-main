-- ==========================================
-- EXÉCUTION DE TOUS LES TESTS DE COHÉRENCE
-- Morocco Host Helper Platform
-- Version: Diagnostic Complet
-- ==========================================

-- Mode d'emploi:
-- 1. Ouvrez votre client SQL (Supabase Dashboard, pgAdmin, psql, etc.)
-- 2. Connectez-vous à votre base de données Morocco Host Helper
-- 3. Exécutez ce script complet
-- 4. Analysez les résultats pour identifier les incohérences

SELECT '🚀 DÉBUT DES TESTS DE COHÉRENCE COMPLETS' as status;
SELECT '==========================================';
SELECT 'Morocco Host Helper Platform - Diagnostic Complet';
SELECT 'Timestamp: ' || NOW()::text;
SELECT '==========================================';

-- ===========================================
-- 🔍 TEST 1: DIAGNOSTIC RAPIDE
-- ===========================================

SELECT '';
SELECT '🔍 TEST 1: DIAGNOSTIC RAPIDE' as test_phase;
SELECT '==========================================';

-- Tests critiques (MUST HAVE)
SELECT '🚨 TESTS CRITIQUES' as section;

SELECT 
  '1. Vue profiles' as test,
  CASE 
    WHEN EXISTS (SELECT 1 FROM information_schema.views WHERE table_name = 'profiles') 
    THEN '✅ OK'
    ELSE '❌ MANQUANTE - AdminContext va ÉCHOUER'
  END as status;

SELECT 
  '2. Fonction get_users_for_admin' as test,
  CASE 
    WHEN EXISTS (SELECT 1 FROM information_schema.routines WHERE routine_name = 'get_users_for_admin') 
    THEN '✅ OK'
    ELSE '❌ MANQUANTE - AdminContext va ÉCHOUER'
  END as status;

SELECT 
  '3. Colonne bookings.total_amount' as test,
  CASE 
    WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'bookings' AND column_name = 'total_amount') 
    THEN '✅ OK'
    ELSE '❌ MANQUANTE - Calcul revenue va ÉCHOUER'
  END as status;

-- Tests importants (SHOULD HAVE)
SELECT '⚠️ TESTS IMPORTANTS' as section;

SELECT 
  '4. Utilisateurs dans auth.users' as test,
  CASE 
    WHEN (SELECT count(*) FROM auth.users) > 0 
    THEN '✅ OK - ' || (SELECT count(*) FROM auth.users) || ' utilisateurs'
    ELSE '❌ VIDE - Interface sera vide'
  END as status;

SELECT 
  '5. Propriétés dans properties' as test,
  CASE 
    WHEN (SELECT count(*) FROM properties) > 0 
    THEN '✅ OK - ' || (SELECT count(*) FROM properties) || ' propriétés'
    ELSE '❌ VIDE - Interface sera vide'
  END as status;

SELECT 
  '6. Propriétés avec propriétaires' as test,
  CASE 
    WHEN (SELECT count(*) FROM properties WHERE user_id IS NOT NULL) > 0 
    THEN '✅ OK - ' || (SELECT count(*) FROM properties WHERE user_id IS NOT NULL) || ' propriétés assignées'
    ELSE '❌ AUCUNE - AdminUsers sera dysfonctionnel'
  END as status;

-- Diagnostic final rapide
WITH diagnostic AS (
  SELECT 
    CASE WHEN EXISTS (SELECT 1 FROM information_schema.views WHERE table_name = 'profiles') THEN 1 ELSE 0 END +
    CASE WHEN EXISTS (SELECT 1 FROM information_schema.routines WHERE routine_name = 'get_users_for_admin') THEN 1 ELSE 0 END +
    CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'bookings' AND column_name = 'total_amount') THEN 1 ELSE 0 END as critiques_ok,
    CASE WHEN (SELECT count(*) FROM auth.users) > 0 THEN 1 ELSE 0 END +
    CASE WHEN (SELECT count(*) FROM properties) > 0 THEN 1 ELSE 0 END +
    CASE WHEN (SELECT count(*) FROM properties WHERE user_id IS NOT NULL) > 0 THEN 1 ELSE 0 END as importants_ok
)
SELECT 
  '🏁 DIAGNOSTIC RAPIDE' as phase_summary,
  critiques_ok || '/3 critiques OK' as score_critique,
  importants_ok || '/3 importants OK' as score_important,
  CASE 
    WHEN critiques_ok = 3 AND importants_ok >= 2 
    THEN '✅ SYSTÈME OPÉRATIONNEL'
    WHEN critiques_ok = 3 AND importants_ok >= 1
    THEN '⚠️ SYSTÈME FONCTIONNEL (données limitées)'
    WHEN critiques_ok >= 2
    THEN '❌ CORRECTIONS REQUISES'
    ELSE '🚨 CORRECTIONS CRITIQUES REQUISES'
  END as status_global
FROM diagnostic;

-- ===========================================
-- 📊 TEST 2: STRUCTURE DATABASE
-- ===========================================

SELECT '';
SELECT '📊 TEST 2: STRUCTURE DATABASE' as test_phase;
SELECT '==========================================';

-- Tables principales
SELECT 
  'Tables principales' as check_type,
  CASE 
    WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'properties') 
    THEN '✅ properties' 
    ELSE '❌ properties manquante' 
  END as properties_status,
  CASE 
    WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'bookings') 
    THEN '✅ bookings' 
    ELSE '❌ bookings manquante' 
  END as bookings_status,
  CASE 
    WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'admin_users') 
    THEN '✅ admin_users' 
    ELSE '❌ admin_users manquante' 
  END as admin_users_status;

-- Statistiques générales
SELECT 
  'Données générales' as stats_type,
  (SELECT count(*) FROM auth.users) as total_users,
  (SELECT count(*) FROM properties) as total_properties,
  (SELECT count(*) FROM bookings) as total_bookings,
  (SELECT count(*) FROM admin_users) as total_admins;

-- ===========================================
-- 🔧 TEST 3: FONCTIONS SQL
-- ===========================================

SELECT '';
SELECT '🔧 TEST 3: FONCTIONS SQL' as test_phase;
SELECT '==========================================';

-- Test fonctions critiques
SELECT 
  'Test get_users_for_admin' as function_test,
  CASE 
    WHEN public.get_users_for_admin() IS NOT NULL 
    THEN '✅ OK - ' || json_array_length(public.get_users_for_admin()) || ' utilisateurs retournés'
    ELSE '❌ ÉCHOUE'
  END as result;

-- Vérification alternatives Edge Functions
SELECT 
  'Alternative get_all_users_for_admin' as function_test,
  CASE 
    WHEN public.get_all_users_for_admin()->>'users' IS NOT NULL
    THEN '✅ OK - Alternative Edge Function disponible'
    ELSE '❌ ÉCHOUE'
  END as result;

-- ===========================================
-- 🎨 TEST 4: SIMULATION INTERFACE ADMIN
-- ===========================================

SELECT '';
SELECT '🎨 TEST 4: SIMULATION INTERFACE ADMIN' as test_phase;
SELECT '==========================================';

-- Données pour dashboard
WITH dashboard_stats AS (
  SELECT 
    (SELECT count(*) FROM auth.users) as total_users,
    (SELECT count(*) FROM properties) as total_properties,
    (SELECT count(*) FROM bookings) as total_bookings,
    (SELECT COALESCE(sum(total_amount), 0) FROM bookings) as total_revenue
)
SELECT 
  'Dashboard Statistics' as interface_element,
  'Users: ' || total_users as users_display,
  'Properties: ' || total_properties as properties_display,
  'Bookings: ' || total_bookings as bookings_display,
  'Revenue: ' || total_revenue || '€' as revenue_display,
  CASE 
    WHEN total_users > 0 AND total_properties > 0 AND total_bookings > 0
    THEN '✅ Interface aura des données significatives'
    ELSE '⚠️ Interface avec données limitées'
  END as interface_readiness
FROM dashboard_stats;

-- Top propriétaires pour AdminUsers
SELECT 
  'Top Propriétaires' as interface_element,
  u.email,
  count(p.id) as properties_count,
  count(b.id) as bookings_count,
  CASE 
    WHEN count(p.id) >= 2 THEN '⭐ Host actif' 
    WHEN count(p.id) = 1 THEN '🏠 Nouveau host'
    ELSE '👤 Simple utilisateur'
  END as user_type
FROM auth.users u
LEFT JOIN properties p ON p.user_id = u.id
LEFT JOIN bookings b ON b.property_id = p.id
GROUP BY u.id, u.email
ORDER BY count(p.id) DESC
LIMIT 3;

-- ===========================================
-- 🔒 TEST 5: SÉCURITÉ RLS
-- ===========================================

SELECT '';
SELECT '🔒 TEST 5: SÉCURITÉ RLS' as test_phase;
SELECT '==========================================';

-- Politiques RLS par table
SELECT 
  'Politiques RLS' as security_check,
  tablename,
  count(*) as nb_policies,
  CASE 
    WHEN count(*) >= 2 THEN '✅ Bien protégée'
    WHEN count(*) = 1 THEN '⚠️ Protection partielle'
    ELSE '❌ Non protégée'
  END as protection_level
FROM pg_policies 
WHERE schemaname = 'public'
  AND tablename IN ('properties', 'bookings', 'admin_users')
GROUP BY tablename
ORDER BY count(*) DESC;

-- Utilisateurs administrateurs
SELECT 
  'Administrateurs configurés' as security_check,
  count(*) as nb_admins,
  string_agg(DISTINCT role, ', ') as roles_available,
  CASE 
    WHEN count(*) > 0 THEN '✅ Administration configurée'
    ELSE '❌ Aucun admin'
  END as admin_status
FROM admin_users;

-- ===========================================
-- 🌐 TEST 6: ALTERNATIVES EDGE FUNCTIONS
-- ===========================================

SELECT '';
SELECT '🌐 TEST 6: ALTERNATIVES EDGE FUNCTIONS' as test_phase;
SELECT '==========================================';

-- Matrice alternatives disponibles
SELECT 
  'Alternatives Edge Functions' as edge_function_check,
  edge_function,
  alternative,
  status
FROM (VALUES
  ('get-all-users', 'get_all_users_for_admin()', '✅ Disponible'),
  ('add-admin-user', 'INSERT admin_users', '✅ SQL direct'),
  ('get-users-for-admin', 'get_users_for_admin()', '✅ Disponible'),
  ('dashboard-stats', 'get_dashboard_stats_real()', '✅ Disponible')
) AS alternatives(edge_function, alternative, status);

-- ===========================================
-- 🏁 RÉSUMÉ FINAL COMPLET
-- ===========================================

SELECT '';
SELECT '🏁 RÉSUMÉ FINAL COMPLET' as final_phase;
SELECT '==========================================';

WITH comprehensive_audit AS (
  SELECT 
    -- Structure
    CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'properties') THEN 1 ELSE 0 END +
    CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'bookings') THEN 1 ELSE 0 END +
    CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'admin_users') THEN 1 ELSE 0 END as structure_score,
    -- Fonctions critiques
    CASE WHEN EXISTS (SELECT 1 FROM information_schema.views WHERE table_name = 'profiles') THEN 1 ELSE 0 END +
    CASE WHEN EXISTS (SELECT 1 FROM information_schema.routines WHERE routine_name = 'get_users_for_admin') THEN 1 ELSE 0 END +
    CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'bookings' AND column_name = 'total_amount') THEN 1 ELSE 0 END as functions_score,
    -- Données
    CASE WHEN (SELECT count(*) FROM auth.users) > 0 THEN 1 ELSE 0 END +
    CASE WHEN (SELECT count(*) FROM properties) > 0 THEN 1 ELSE 0 END +
    CASE WHEN (SELECT count(*) FROM bookings) > 0 THEN 1 ELSE 0 END as data_score,
    -- Sécurité
    CASE WHEN (SELECT count(*) FROM admin_users) > 0 THEN 1 ELSE 0 END +
    CASE WHEN (SELECT count(DISTINCT tablename) FROM pg_policies WHERE schemaname = 'public') >= 2 THEN 1 ELSE 0 END as security_score
)
SELECT 
  'SCORE GLOBAL SYSTÈME' as final_assessment,
  structure_score || '/3 Structure' as structure_status,
  functions_score || '/3 Fonctions' as functions_status,
  data_score || '/3 Données' as data_status,
  security_score || '/2 Sécurité' as security_status,
  (structure_score + functions_score + data_score + security_score) || '/11 TOTAL' as total_score,
  CASE 
    WHEN (structure_score + functions_score + data_score + security_score) >= 9
    THEN '🟢 EXCELLENT - Système parfaitement opérationnel'
    WHEN (structure_score + functions_score + data_score + security_score) >= 7
    THEN '🟡 BON - Système opérationnel avec améliorations mineures'
    WHEN (structure_score + functions_score + data_score + security_score) >= 5
    THEN '🟠 MOYEN - Corrections requises avant utilisation'
    ELSE '🔴 CRITIQUE - Corrections majeures nécessaires'
  END as system_health,
  CASE 
    WHEN (structure_score + functions_score + data_score + security_score) >= 9
    THEN '✅ Vous pouvez utiliser l interface admin immédiatement'
    WHEN (structure_score + functions_score + data_score + security_score) >= 7
    THEN '⚠️ Interface utilisable - quelques optimisations recommandées'
    WHEN (structure_score + functions_score + data_score + security_score) >= 5
    THEN '🔧 Appliquez les corrections identifiées puis testez à nouveau'
    ELSE '🚨 Exécutez solution-parfaite-finale.sql IMMÉDIATEMENT'
  END as action_recommendation
FROM comprehensive_audit;

-- Détails des problèmes détectés
SELECT '';
SELECT '📋 ACTIONS RECOMMANDÉES' as actions_section;

SELECT 
  'Si score < 9' as condition_check,
  'Exécutez: scripts/solution-parfaite-finale.sql' as action_required,
  'Puis relancez: scripts/run-all-tests.sql' as verification_step;

SELECT 
  'Si interface admin ne fonctionne pas' as condition_check,
  'Vérifiez les ❌ dans les tests ci-dessus' as troubleshooting,
  'Corrigez les éléments marqués comme MANQUANT ou ÉCHOUE' as fix_method;

-- Fin des tests
SELECT '';
SELECT '==========================================';
SELECT '🏁 TESTS DE COHÉRENCE TERMINÉS';
SELECT 'Timestamp: ' || NOW()::text;
SELECT 'Analysez les résultats ci-dessus pour identifier les incohérences';
SELECT '==========================================';
SELECT '';
