-- =====================================
-- CORRECTION SIMPLE - STRUCTURE RÉELLE
-- Morocco Host Helper Platform
-- =====================================

-- D'abord, vérifions la structure exacte de host_profiles
SELECT 
    'Structure host_profiles' as info,
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'host_profiles'
ORDER BY ordinal_position;

-- ===========================================
-- 1. VUE PROFILES SIMPLIFIÉE (sans colonnes inexistantes)
-- ===========================================
DROP VIEW IF EXISTS public.profiles;
CREATE VIEW public.profiles AS
SELECT 
  au.id,
  au.email,
  COALESCE(hp.full_name, au.raw_user_meta_data->>'full_name', au.email) as full_name,
  hp.avatar_url,
  au.created_at,
  au.updated_at,
  hp.phone
FROM auth.users au
LEFT JOIN public.host_profiles hp ON hp.id = au.id;

-- ===========================================
-- 2. FONCTION USERS ENRICHIS SIMPLIFIÉE
-- ===========================================
CREATE OR REPLACE FUNCTION public.get_all_users_enriched()
RETURNS TABLE(
  id UUID,
  email TEXT,
  full_name TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    au.id,
    au.email,
    COALESCE(hp.full_name, au.raw_user_meta_data->>'full_name', au.email) as full_name,
    au.created_at,
    au.updated_at
  FROM auth.users au
  LEFT JOIN public.host_profiles hp ON hp.id = au.id;
END;
$$;

-- ===========================================
-- 3. VUE USERS_ENRICHED SIMPLIFIÉE
-- ===========================================
DROP VIEW IF EXISTS public.users_enriched;
CREATE VIEW public.users_enriched AS
SELECT 
  au.id,
  au.email,
  COALESCE(hp.full_name, au.raw_user_meta_data->>'full_name', au.email) as full_name,
  au.created_at,
  au.last_sign_in_at as last_login,
  au.email_confirmed_at IS NOT NULL as is_active,
  COALESCE(adm.role, 'user') as role,
  COALESCE(prop_stats.properties_count, 0) as properties_count,
  COALESCE(prop_stats.properties_count, 0) > 0 as is_property_owner,
  prop_stats.last_booking_date,
  COALESCE(prop_stats.total_bookings, 0) as total_bookings,
  hp.phone
FROM auth.users au
LEFT JOIN public.host_profiles hp ON hp.id = au.id
LEFT JOIN public.admin_users adm ON adm.user_id = au.id
LEFT JOIN (
  SELECT 
    p.user_id,
    count(p.id) as properties_count,
    count(b.id) as total_bookings,
    max(b.created_at) as last_booking_date
  FROM properties p
  LEFT JOIN bookings b ON b.property_id = p.id
  GROUP BY p.user_id
) prop_stats ON prop_stats.user_id = au.id;

-- ===========================================
-- 4. FONCTION DASHBOARD STATS SIMPLE
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
    'totalRevenue', 0,  -- Simplifié pour éviter erreurs
    'activeProperties', (SELECT count(*) FROM properties WHERE user_id IS NOT NULL),
    'pendingBookings', (SELECT count(*) FROM bookings WHERE status = 'pending'),
    'completedBookings', (SELECT count(*) FROM bookings WHERE status = 'completed'),
    'propertyOwners', (SELECT count(DISTINCT user_id) FROM properties WHERE user_id IS NOT NULL)
  ) INTO result;
  
  RETURN result;
END;
$$;

-- ===========================================
-- 5. TEST IMMÉDIAT
-- ===========================================

-- Test 1: Vérifier que la vue profiles fonctionne
SELECT 'TEST 1 - Vue profiles' as test, count(*) as nb_profiles FROM public.profiles;

-- Test 2: Vérifier la fonction users enriched
SELECT 'TEST 2 - Users enriched' as test, count(*) as nb_users FROM public.get_all_users_enriched();

-- Test 3: Dashboard stats
SELECT 'TEST 3 - Dashboard stats' as test, public.get_dashboard_stats_real() as stats;

-- Test 4: Vue users_enriched avec vraies données
SELECT 
  'TEST 4 - Users enriched avec propriétés' as test,
  email,
  full_name,
  properties_count,
  is_property_owner,
  role
FROM public.users_enriched
WHERE properties_count > 0 OR role != 'user'
LIMIT 5;

-- ===========================================
-- 6. DONNÉES EXACTES POUR VOTRE INTERFACE
-- ===========================================
SELECT 
  'STATISTIQUES INTERFACE ADMIN' as section,
  (SELECT count(*) FROM auth.users) as total_users,
  (SELECT count(*) FROM properties) as total_properties,
  (SELECT count(*) FROM bookings) as total_bookings,
  (SELECT count(DISTINCT user_id) FROM properties WHERE user_id IS NOT NULL) as property_owners,
  (SELECT count(*) FROM admin_users) as admin_count;

-- Échantillon des utilisateurs propriétaires
SELECT 
  'UTILISATEURS PROPRIÉTAIRES' as section,
  au.email,
  COALESCE(hp.full_name, au.email) as nom,
  count(p.id) as nb_proprietes,
  string_agg(p.name, ', ') as proprietes
FROM auth.users au
JOIN properties p ON p.user_id = au.id
LEFT JOIN host_profiles hp ON hp.id = au.id
GROUP BY au.id, au.email, hp.full_name
ORDER BY count(p.id) DESC
LIMIT 10;
