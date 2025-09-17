-- =====================================
-- MIGRATION COMPLÈTE ET FINALE
-- Morocco Host Helper Platform
-- =====================================

-- ===========================================
-- 1. CRÉER VUE PROFILES
-- ===========================================
DROP VIEW IF EXISTS public.profiles CASCADE;
CREATE VIEW public.profiles AS
SELECT 
  au.id,
  au.email,
  COALESCE(hp.full_name, au.raw_user_meta_data->>'full_name', au.email) as full_name,
  au.created_at,
  au.updated_at
FROM auth.users au
LEFT JOIN public.host_profiles hp ON hp.id = au.id;

-- ===========================================
-- 2. FONCTION DASHBOARD STATS
-- ===========================================
CREATE OR REPLACE FUNCTION public.get_dashboard_stats_real()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result JSON;
BEGIN
  SELECT json_build_object(
    'totalUsers', (SELECT count(*) FROM auth.users),
    'totalProperties', (SELECT count(*) FROM properties),
    'totalBookings', (SELECT count(*) FROM bookings),
    'totalRevenue', 0,
    'activeProperties', (SELECT count(*) FROM properties WHERE user_id IS NOT NULL),
    'pendingBookings', (SELECT count(*) FROM bookings WHERE status = 'pending'),
    'completedBookings', (SELECT count(*) FROM bookings WHERE status = 'completed'),
    'propertyOwners', (SELECT count(DISTINCT user_id) FROM properties WHERE user_id IS NOT NULL)
  ) INTO result;
  
  RETURN result;
END;
$$;

-- ===========================================
-- 3. FONCTION USERS POUR ADMIN
-- ===========================================
CREATE OR REPLACE FUNCTION public.get_users_for_admin()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result JSON;
BEGIN
  SELECT json_agg(
    json_build_object(
      'id', au.id,
      'email', au.email,
      'full_name', COALESCE(hp.full_name, au.raw_user_meta_data->>'full_name', au.email),
      'created_at', au.created_at,
      'updated_at', au.updated_at,
      'properties_count', COALESCE(prop_stats.properties_count, 0),
      'total_bookings', COALESCE(prop_stats.total_bookings, 0),
      'is_property_owner', COALESCE(prop_stats.properties_count, 0) > 0,
      'last_booking_date', prop_stats.last_booking_date,
      'role', COALESCE(adm.role, 'user'),
      'is_active', au.email_confirmed_at IS NOT NULL,
      'last_login', au.last_sign_in_at
    )
  ) INTO result
  FROM auth.users au
  LEFT JOIN public.host_profiles hp ON hp.id = au.id
  LEFT JOIN public.admin_users adm ON adm.user_id = au.id
  LEFT JOIN (
    SELECT 
      p.user_id,
      count(p.id)::integer as properties_count,
      count(b.id)::integer as total_bookings,
      max(b.created_at) as last_booking_date
    FROM properties p
    LEFT JOIN bookings b ON b.property_id = p.id
    GROUP BY p.user_id
  ) prop_stats ON prop_stats.user_id = au.id;
  
  RETURN result;
END;
$$;

-- ===========================================
-- 4. TESTS IMMÉDIATS
-- ===========================================

-- Test 1: Vue profiles
SELECT 'TEST 1 - Profiles' as test, count(*) as total FROM public.profiles;

-- Test 2: Dashboard stats
SELECT 'TEST 2 - Dashboard Stats' as test, public.get_dashboard_stats_real() as data;

-- Test 3: Users pour admin
SELECT 'TEST 3 - Users Admin' as test, 
       CASE 
         WHEN public.get_users_for_admin() IS NOT NULL 
         THEN 'Fonction OK - ' || json_array_length(public.get_users_for_admin()) || ' utilisateurs'
         ELSE 'Erreur fonction'
       END as result;

-- ===========================================
-- 5. STATISTIQUES RÉELLES
-- ===========================================
SELECT 
  'STATISTIQUES PLATEFORME' as section,
  (SELECT count(*) FROM auth.users) as total_users,
  (SELECT count(*) FROM properties) as total_properties,
  (SELECT count(*) FROM bookings) as total_bookings,
  (SELECT count(DISTINCT user_id) FROM properties WHERE user_id IS NOT NULL) as property_owners,
  (SELECT count(*) FROM admin_users) as admin_users;

-- ===========================================
-- 6. EXEMPLES UTILISATEURS PROPRIÉTAIRES
-- ===========================================
SELECT 
  'EXEMPLES PROPRIÉTAIRES' as section,
  au.email,
  COALESCE(hp.full_name, au.email) as nom,
  count(p.id) as nb_proprietes
FROM auth.users au
JOIN properties p ON p.user_id = au.id
LEFT JOIN host_profiles hp ON hp.id = au.id
GROUP BY au.id, au.email, hp.full_name
ORDER BY count(p.id) DESC
LIMIT 5;

-- ===========================================
-- 7. VÉRIFICATION FINALE
-- ===========================================
SELECT 
  'VÉRIFICATION FINALE' as section,
  CASE 
    WHEN EXISTS (SELECT 1 FROM information_schema.views WHERE table_name = 'profiles') 
    THEN '✅ Vue profiles créée'
    ELSE '❌ Vue profiles manquante'
  END as vue_profiles,
  CASE 
    WHEN EXISTS (SELECT 1 FROM information_schema.routines WHERE routine_name = 'get_users_for_admin') 
    THEN '✅ Fonction users créée'
    ELSE '❌ Fonction users manquante'
  END as fonction_users,
  CASE 
    WHEN EXISTS (SELECT 1 FROM information_schema.routines WHERE routine_name = 'get_dashboard_stats_real') 
    THEN '✅ Fonction stats créée'
    ELSE '❌ Fonction stats manquante'
  END as fonction_stats;
