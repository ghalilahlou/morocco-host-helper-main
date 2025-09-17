-- =====================================
-- CORRECTION FINALE - TYPES EXACTS
-- Morocco Host Helper Platform
-- =====================================

-- ===========================================
-- 1. FONCTION USERS ENRICHIS AVEC TYPES CORRECTS
-- ===========================================
DROP FUNCTION IF EXISTS public.get_all_users_enriched();
CREATE OR REPLACE FUNCTION public.get_all_users_enriched()
RETURNS TABLE(
  id UUID,
  email VARCHAR(255),  -- Type exact de auth.users.email
  full_name VARCHAR(255),  -- Type adapté
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
    COALESCE(hp.full_name, au.raw_user_meta_data->>'full_name', au.email)::VARCHAR(255) as full_name,
    au.created_at,
    au.updated_at
  FROM auth.users au
  LEFT JOIN public.host_profiles hp ON hp.id = au.id;
END;
$$;

-- ===========================================
-- 2. ALTERNATIVE PLUS SIMPLE : FONCTION SANS TYPES STRICTS
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
      count(p.id) as properties_count,
      count(b.id) as total_bookings,
      max(b.created_at) as last_booking_date
    FROM properties p
    LEFT JOIN bookings b ON b.property_id = p.id
    GROUP BY p.user_id
  ) prop_stats ON prop_stats.user_id = au.id;
  
  RETURN result;
END;
$$;

-- ===========================================
-- 3. VUE PROFILES SIMPLIFIÉE FINALE
-- ===========================================
DROP VIEW IF EXISTS public.profiles;
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
-- 4. TESTS IMMÉDIATS
-- ===========================================

-- Test 1: Vue profiles
SELECT 'TEST 1 - Profiles' as test, count(*) as total FROM public.profiles;

-- Test 2: Fonction JSON
SELECT 'TEST 2 - Users JSON' as test, 
       json_array_length(public.get_users_for_admin()) as nb_users;

-- Test 3: Dashboard stats
SELECT 'TEST 3 - Stats' as test, public.get_dashboard_stats_real() as data;

-- ===========================================
-- 5. DONNÉES RÉELLES POUR DEBUG
-- ===========================================

-- Vraies statistiques
SELECT 
  'STATS RÉELLES' as info,
  (SELECT count(*) FROM auth.users) as users,
  (SELECT count(*) FROM properties) as properties,
  (SELECT count(*) FROM bookings) as bookings,
  (SELECT count(DISTINCT user_id) FROM properties WHERE user_id IS NOT NULL) as owners;

-- Exemple d'utilisateurs avec propriétés
SELECT 
  'PROPRIÉTAIRES EXEMPLE' as info,
  au.email,
  count(p.id) as nb_props
FROM auth.users au
JOIN properties p ON p.user_id = au.id
GROUP BY au.id, au.email
LIMIT 3;

-- Test final de la fonction
SELECT 'DONNÉES UTILISATEURS' as info, public.get_users_for_admin() as users_data;
