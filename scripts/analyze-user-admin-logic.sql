-- ==========================================
-- ANALYSE APPROFONDIE LOGIQUE UTILISATEURS ET ADMIN
-- Morocco Host Helper Platform
-- ==========================================

SELECT '🔍 ANALYSE LOGIQUE UTILISATEURS ET ADMIN' as section;
SELECT '=============================================' as separator;

-- ===========================================
-- 1. ANALYSE STRUCTURE UTILISATEURS
-- ===========================================

SELECT '👥 STRUCTURE UTILISATEURS' as analysis_section;

-- 1.1 Compter tous les utilisateurs par source
SELECT 
  'Utilisateurs par source' as metric,
  (SELECT count(*) FROM auth.users) as auth_users_total,
  (SELECT count(*) FROM host_profiles) as host_profiles_total,
  (SELECT count(*) FROM admin_users) as admin_users_total,
  CASE 
    WHEN (SELECT count(*) FROM auth.users) > 0 
    THEN '✅ Utilisateurs présents'
    ELSE '❌ Aucun utilisateur'
  END as status;

-- 1.2 Analyse cohérence auth.users <-> host_profiles
SELECT 
  'Cohérence auth.users <-> host_profiles' as analysis,
  count(au.id) as users_with_profiles,
  (SELECT count(*) FROM auth.users) - count(au.id) as users_without_profiles,
  CASE 
    WHEN count(au.id) = (SELECT count(*) FROM auth.users)
    THEN '✅ Tous les utilisateurs ont un profil'
    WHEN count(au.id) > 0
    THEN '⚠️ Certains utilisateurs sans profil'
    ELSE '❌ Aucun profil utilisateur'
  END as coherence_status
FROM auth.users au
LEFT JOIN host_profiles hp ON hp.id = au.id
WHERE hp.id IS NOT NULL;

-- 1.3 Utilisateurs avec propriétés
SELECT 
  'Propriétaires actifs' as metric,
  count(DISTINCT p.user_id) as property_owners,
  count(p.id) as total_properties,
  CASE 
    WHEN count(DISTINCT p.user_id) > 0
    THEN '✅ ' || count(DISTINCT p.user_id) || ' propriétaires avec ' || count(p.id) || ' propriétés'
    ELSE '❌ Aucun propriétaire'
  END as ownership_status
FROM properties p
WHERE p.user_id IS NOT NULL;

-- ===========================================
-- 2. ANALYSE LOGIQUE ADMIN
-- ===========================================

SELECT '🔐 LOGIQUE ADMINISTRATEUR' as analysis_section;

-- 2.1 Détail des administrateurs
SELECT 
  'Administrateurs configurés' as admin_analysis,
  au.role,
  au.is_active,
  u.email,
  u.created_at as user_created,
  au.created_at as admin_since,
  CASE 
    WHEN au.role = 'super_admin' THEN '🔴 Super Admin'
    WHEN au.role = 'admin' THEN '🟡 Admin Standard'
    ELSE '🟢 Autre: ' || au.role
  END as role_display
FROM admin_users au
JOIN auth.users u ON u.id = au.user_id
ORDER BY 
  CASE au.role 
    WHEN 'super_admin' THEN 1 
    WHEN 'admin' THEN 2 
    ELSE 3 
  END;

-- 2.2 Test fonction get_users_for_admin
SELECT 'Test fonction get_users_for_admin' as test_name;
DO $$
DECLARE
    users_result JSON;
    users_count INTEGER;
    sample_user JSON;
BEGIN
    -- Tester la fonction
    SELECT public.get_users_for_admin() INTO users_result;
    
    IF users_result IS NOT NULL THEN
        SELECT json_array_length(users_result) INTO users_count;
        SELECT (users_result->0) INTO sample_user;
        
        RAISE NOTICE '✅ get_users_for_admin() fonctionne:';
        RAISE NOTICE '   📊 % utilisateurs retournés', users_count;
        RAISE NOTICE '   👤 Premier utilisateur: %', (sample_user->>'email');
        RAISE NOTICE '   🏠 Propriétés: %', (sample_user->>'properties_count');
        RAISE NOTICE '   📅 Réservations: %', (sample_user->>'total_bookings');
        RAISE NOTICE '   👑 Rôle: %', (sample_user->>'role');
    ELSE
        RAISE NOTICE '❌ get_users_for_admin() ne retourne pas de données';
    END IF;
END $$;

-- 2.3 Vérification vue profiles
SELECT 
  'Vue profiles pour AdminContext' as test_name,
  count(*) as profiles_count,
  CASE 
    WHEN count(*) > 0 
    THEN '✅ Vue profiles accessible avec ' || count(*) || ' profils'
    ELSE '❌ Vue profiles vide ou inaccessible'
  END as profiles_status
FROM public.profiles;

-- ===========================================
-- 3. ANALYSE FLUX DE DONNÉES FRONTEND
-- ===========================================

SELECT '🔄 FLUX DONNÉES FRONTEND -> BACKEND' as analysis_section;

-- 3.1 Simulation requête AdminUsers.tsx ligne 57
SELECT 'Simulation Edge Function get-all-users' as simulation_type;
-- NOTE: Edge function simulée par get_all_users_for_admin
SELECT 
  CASE 
    WHEN public.get_all_users_for_admin()->>'users' IS NOT NULL
    THEN '✅ Alternative Edge Function disponible'
    ELSE '❌ Edge Function manquante'
  END as edge_function_status;

-- 3.2 Simulation requête AdminUsers.tsx ligne 68-70 (properties par user)
SELECT 
  'Simulation properties par utilisateur' as simulation_type,
  au.email,
  count(p.id) as user_properties,
  count(b.id) as user_bookings,
  CASE 
    WHEN count(p.id) > 0 THEN '🏠 Propriétaire'
    ELSE '👤 Utilisateur simple'
  END as user_type_frontend
FROM auth.users au
LEFT JOIN properties p ON p.user_id = au.id
LEFT JOIN bookings b ON b.property_id = p.id
GROUP BY au.id, au.email
ORDER BY count(p.id) DESC
LIMIT 5;

-- 3.3 Simulation AdminContext.tsx ligne 80-81 (properties + bookings)
SELECT 
  'Simulation AdminContext properties + bookings' as simulation_type,
  count(DISTINCT p.id) as total_properties,
  count(DISTINCT b.id) as total_bookings,
  count(DISTINCT b.id) || ' réservations liées à ' || count(DISTINCT p.id) || ' propriétés' as relation_summary,
  CASE 
    WHEN count(DISTINCT p.id) > 0 AND count(DISTINCT b.id) > 0
    THEN '✅ Relations properties <-> bookings fonctionnelles'
    WHEN count(DISTINCT p.id) > 0
    THEN '⚠️ Propriétés sans réservations'
    ELSE '❌ Aucune donnée'
  END as relation_status
FROM properties p
LEFT JOIN bookings b ON b.property_id = p.id;

-- ===========================================
-- 4. ANALYSE COHÉRENCE DONNÉES UTILISATEURS
-- ===========================================

SELECT '📊 COHÉRENCE DONNÉES UTILISATEURS' as analysis_section;

-- 4.1 Utilisateurs complets (auth + profiles + données)
WITH user_completeness AS (
  SELECT 
    au.id,
    au.email,
    hp.full_name IS NOT NULL as has_profile,
    count(p.id) as properties_count,
    count(b.id) as bookings_count,
    adm.role IS NOT NULL as is_admin
  FROM auth.users au
  LEFT JOIN host_profiles hp ON hp.id = au.id
  LEFT JOIN properties p ON p.user_id = au.id
  LEFT JOIN bookings b ON b.property_id = p.id
  LEFT JOIN admin_users adm ON adm.user_id = au.id
  GROUP BY au.id, au.email, hp.full_name, adm.role
)
SELECT 
  'Complétude données utilisateurs' as completeness_analysis,
  count(*) as total_users,
  count(CASE WHEN has_profile THEN 1 END) as users_with_profiles,
  count(CASE WHEN properties_count > 0 THEN 1 END) as users_with_properties,
  count(CASE WHEN bookings_count > 0 THEN 1 END) as users_with_bookings,
  count(CASE WHEN is_admin THEN 1 END) as admin_users,
  ROUND(
    (count(CASE WHEN has_profile THEN 1 END) * 100.0 / count(*)), 2
  ) || '%' as profile_completion_rate
FROM user_completeness;

-- 4.2 Données manquantes critiques
SELECT 
  'Données manquantes critiques' as missing_data_analysis,
  (SELECT count(*) FROM auth.users au 
   LEFT JOIN host_profiles hp ON hp.id = au.id 
   WHERE hp.id IS NULL) as users_without_profiles,
  (SELECT count(*) FROM properties WHERE user_id IS NULL) as properties_without_owners,
  (SELECT count(*) FROM bookings WHERE property_id IS NULL) as bookings_without_properties,
  CASE 
    WHEN (SELECT count(*) FROM auth.users au 
          LEFT JOIN host_profiles hp ON hp.id = au.id 
          WHERE hp.id IS NULL) = 0
    THEN '✅ Tous les utilisateurs ont un profil'
    ELSE '❌ Utilisateurs sans profil détectés'
  END as data_integrity_status;

-- ===========================================
-- 5. ANALYSE DÉTAILLÉE INTERFACE ADMIN
-- ===========================================

SELECT '🖥️ INTERFACE ADMIN - DONNÉES DISPONIBLES' as analysis_section;

-- 5.1 Données pour tableau de bord
SELECT 
  'Données dashboard admin' as dashboard_data,
  (SELECT count(*) FROM auth.users) as users_for_dashboard,
  (SELECT count(*) FROM properties) as properties_for_dashboard,
  (SELECT count(*) FROM bookings) as bookings_for_dashboard,
  (SELECT COALESCE(sum(total_amount), 0) FROM bookings) as revenue_for_dashboard,
  (SELECT count(*) FROM admin_users) as admins_for_dashboard;

-- 5.2 Utilisateurs récents pour dashboard
SELECT 
  'Top 5 utilisateurs récents (dashboard)' as dashboard_users,
  au.email,
  au.created_at,
  COALESCE(hp.full_name, 'Nom non défini') as display_name,
  extract(days from (now() - au.created_at)) as days_since_registration
FROM auth.users au
LEFT JOIN host_profiles hp ON hp.id = au.id
ORDER BY au.created_at DESC
LIMIT 5;

-- 5.3 Propriétaires actifs pour interface admin
SELECT 
  'Top propriétaires actifs (interface admin)' as admin_interface_data,
  au.email,
  COALESCE(hp.full_name, substring(au.email from 1 for 20)) as display_name,
  count(p.id) as properties_count,
  count(b.id) as bookings_count,
  COALESCE(sum(b.total_amount), 0) as total_revenue,
  CASE 
    WHEN count(p.id) >= 3 THEN '🔥 Super host'
    WHEN count(p.id) >= 2 THEN '⭐ Host actif'
    WHEN count(p.id) = 1 THEN '🏠 Nouveau host'
    ELSE '👤 Pas de propriété'
  END as host_badge
FROM auth.users au
LEFT JOIN host_profiles hp ON hp.id = au.id
LEFT JOIN properties p ON p.user_id = au.id
LEFT JOIN bookings b ON b.property_id = p.id
GROUP BY au.id, au.email, hp.full_name
HAVING count(p.id) > 0
ORDER BY count(p.id) DESC, count(b.id) DESC
LIMIT 5;

-- ===========================================
-- 6. RÉSUMÉ ANALYSE LOGIQUE UTILISATEURS
-- ===========================================

SELECT '🏁 RÉSUMÉ ANALYSE LOGIQUE UTILISATEURS' as final_section;

WITH analysis_summary AS (
  SELECT 
    -- Utilisateurs
    (SELECT count(*) FROM auth.users) as total_users,
    (SELECT count(*) FROM host_profiles) as profiles_count,
    (SELECT count(*) FROM admin_users) as admin_count,
    -- Données métier
    (SELECT count(*) FROM properties WHERE user_id IS NOT NULL) as properties_with_owners,
    (SELECT count(*) FROM bookings) as total_bookings,
    -- Fonctions critiques
    CASE WHEN EXISTS (SELECT 1 FROM information_schema.routines WHERE routine_name = 'get_users_for_admin') THEN 1 ELSE 0 END as has_admin_function,
    CASE WHEN EXISTS (SELECT 1 FROM information_schema.views WHERE table_name = 'profiles') THEN 1 ELSE 0 END as has_profiles_view
)
SELECT 
  'ANALYSE LOGIQUE UTILISATEURS' as analysis_type,
  total_users || ' utilisateurs total' as users_summary,
  admin_count || ' administrateurs configurés' as admin_summary,
  properties_with_owners || ' propriétés avec propriétaires' as ownership_summary,
  total_bookings || ' réservations total' as bookings_summary,
  CASE 
    WHEN has_admin_function = 1 AND has_profiles_view = 1 AND admin_count > 0
    THEN '✅ LOGIQUE ADMIN COMPLÈTE'
    WHEN has_admin_function = 1 AND has_profiles_view = 1
    THEN '⚠️ LOGIQUE ADMIN PARTIELLE (pas d admin configuré)'
    ELSE '❌ LOGIQUE ADMIN INCOMPLÈTE'
  END as admin_logic_status,
  CASE 
    WHEN total_users > 0 AND profiles_count > 0 AND properties_with_owners > 0
    THEN '✅ DONNÉES UTILISATEURS COHÉRENTES'
    WHEN total_users > 0 AND profiles_count > 0
    THEN '⚠️ UTILISATEURS SANS PROPRIÉTÉS'
    ELSE '❌ DONNÉES UTILISATEURS INCOHÉRENTES'
  END as user_data_coherence,
  CASE 
    WHEN has_admin_function = 1 AND has_profiles_view = 1 AND admin_count > 0 AND total_users > 0
    THEN 'Interface admin prête - toutes données accessibles'
    WHEN has_admin_function = 1 AND has_profiles_view = 1 AND admin_count > 0
    THEN 'Interface admin prête - peu de données utilisateurs'
    ELSE 'Interface admin nécessite des corrections'
  END as recommendation
FROM analysis_summary;

SELECT '=============================================' as separator;
SELECT 'ANALYSE UTILISATEURS ET ADMIN TERMINÉE' as completion;
