-- =====================================
-- CORRECTION SPÉCIFIQUE : Adapter à votre structure existante
-- Morocco Host Helper Platform
-- =====================================

-- ANALYSE : Votre base a déjà host_profiles, mais l'app charge 'profiles'
-- SOLUTION : Créer une vue 'profiles' qui pointe vers host_profiles + auth.users

-- ===========================================
-- 1. CRÉER VUE PROFILES BASÉE SUR VOTRE STRUCTURE
-- ===========================================
-- L'AdminContext charge depuis 'profiles' - créons cette vue
DROP VIEW IF EXISTS public.profiles;
CREATE VIEW public.profiles AS
SELECT 
  au.id,
  au.email,
  COALESCE(hp.full_name, au.raw_user_meta_data->>'full_name', au.email) as full_name,
  hp.avatar_url,
  au.created_at,
  GREATEST(au.updated_at, hp.updated_at) as updated_at,
  hp.bio,
  hp.phone,
  hp.language_preference
FROM auth.users au
LEFT JOIN public.host_profiles hp ON hp.id = au.id;

-- ===========================================
-- 2. CORRIGER LE ADMINCONTEXT DANS L'APPLICATION
-- ===========================================
-- Au lieu de modifier la DB, modifions l'AdminContext pour utiliser la vraie structure

-- Query qui fonctionne avec votre structure actuelle pour AdminContext:
/*
-- Remplacer dans AdminContext.tsx ligne 78-82 :
const [usersRes, propertiesRes, bookingsRes] = await Promise.all([
  supabase.from('profiles').select('*'),  // ❌ Cette ligne cause l'erreur
  supabase.from('properties').select('*'),
  supabase.from('bookings').select('*, properties(name)')
]);

-- Par :
const [usersRes, propertiesRes, bookingsRes] = await Promise.all([
  supabase.rpc('get_all_users_enriched'),  // ✅ Utilise fonction custom
  supabase.from('properties').select('*'),
  supabase.from('bookings').select('*, properties(name)')
]);
*/

-- ===========================================
-- 3. FONCTION POUR RÉCUPÉRER UTILISATEURS ENRICHIS
-- ===========================================
CREATE OR REPLACE FUNCTION public.get_all_users_enriched()
RETURNS TABLE(
  id UUID,
  email TEXT,
  full_name TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  properties_count BIGINT,
  total_bookings BIGINT,
  is_property_owner BOOLEAN,
  last_booking_date TIMESTAMPTZ,
  admin_role TEXT
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
    COALESCE(au.updated_at, hp.updated_at) as updated_at,
    COALESCE(prop_stats.properties_count, 0) as properties_count,
    COALESCE(prop_stats.total_bookings, 0) as total_bookings,
    COALESCE(prop_stats.properties_count, 0) > 0 as is_property_owner,
    prop_stats.last_booking_date,
    adm.role as admin_role
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
END;
$$;

-- ===========================================
-- 4. FONCTION DASHBOARD STATS ADAPTÉE À VOTRE STRUCTURE
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
    'totalRevenue', (
      SELECT COALESCE(sum(
        CASE 
          WHEN total_amount IS NOT NULL THEN total_amount
          WHEN price_per_night IS NOT NULL THEN 
            price_per_night * GREATEST(1, extract(days from (check_out_date - check_in_date)))
          ELSE 0 
        END), 0) 
      FROM bookings b 
      LEFT JOIN properties p ON p.id = b.property_id
    ),
    'activeProperties', (
      SELECT count(*) FROM properties 
      WHERE user_id IS NOT NULL
    ),
    'pendingBookings', (
      SELECT count(*) FROM bookings WHERE status = 'pending'
    ),
    'completedBookings', (
      SELECT count(*) FROM bookings WHERE status = 'completed'
    ),
    'propertyOwners', (
      SELECT count(DISTINCT user_id) FROM properties WHERE user_id IS NOT NULL
    ),
    'activeTokenAllocations', (
      SELECT count(*) FROM token_allocations WHERE is_active = true
    ),
    'airbnbSyncedProperties', (
      SELECT count(*) FROM airbnb_sync_status WHERE is_active = true
    )
  ) INTO result;
  
  RETURN result;
END;
$$;

-- ===========================================
-- 5. CORRIGER LA VUE USERS_ENRICHED POUR ADMINUSERS
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
  hp.phone,
  hp.bio,
  COALESCE(ta.tokens_allocated, 0) as tokens_allocated,
  COALESCE(ta.tokens_remaining, 0) as tokens_remaining
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
) prop_stats ON prop_stats.user_id = au.id
LEFT JOIN (
  SELECT 
    user_id,
    sum(tokens_allocated) as tokens_allocated,
    sum(tokens_remaining) as tokens_remaining
  FROM token_allocations
  WHERE is_active = true
  GROUP BY user_id
) ta ON ta.user_id = au.id;

-- ===========================================
-- 6. VÉRIFICATION DE LA COHÉRENCE AVEC VRAIES DONNÉES
-- ===========================================
CREATE OR REPLACE FUNCTION public.verify_real_data_consistency()
RETURNS TABLE(
  verification_type TEXT,
  count_value BIGINT,
  description TEXT,
  status TEXT
) 
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  -- Compter les vrais utilisateurs
  SELECT 
    'Total Users'::TEXT,
    (SELECT count(*) FROM auth.users)::BIGINT,
    'Utilisateurs authentifiés'::TEXT,
    '✅ OK'::TEXT
  UNION ALL
  -- Compter les propriétaires
  SELECT 
    'Property Owners'::TEXT,
    (SELECT count(DISTINCT user_id) FROM properties WHERE user_id IS NOT NULL)::BIGINT,
    'Utilisateurs avec propriétés'::TEXT,
    CASE WHEN (SELECT count(DISTINCT user_id) FROM properties WHERE user_id IS NOT NULL) > 0 
         THEN '✅ OK' ELSE '⚠️ AUCUN' END
  UNION ALL
  -- Compter les propriétés
  SELECT 
    'Total Properties'::TEXT,
    (SELECT count(*) FROM properties)::BIGINT,
    'Propriétés enregistrées'::TEXT,
    CASE WHEN (SELECT count(*) FROM properties) > 0 
         THEN '✅ OK' ELSE '⚠️ AUCUNE' END
  UNION ALL
  -- Compter les réservations
  SELECT 
    'Total Bookings'::TEXT,
    (SELECT count(*) FROM bookings)::BIGINT,
    'Réservations enregistrées'::TEXT,
    CASE WHEN (SELECT count(*) FROM bookings) > 0 
         THEN '✅ OK' ELSE '⚠️ AUCUNE' END
  UNION ALL
  -- Vérifier admin users
  SELECT 
    'Admin Users'::TEXT,
    (SELECT count(*) FROM admin_users)::BIGINT,
    'Administrateurs configurés'::TEXT,
    CASE WHEN (SELECT count(*) FROM admin_users) > 0 
         THEN '✅ OK' ELSE '❌ AUCUN ADMIN' END
  UNION ALL
  -- Vérifier host profiles
  SELECT 
    'Host Profiles'::TEXT,
    (SELECT count(*) FROM host_profiles)::BIGINT,
    'Profils hôtes complets'::TEXT,
    CASE WHEN (SELECT count(*) FROM host_profiles) > 0 
         THEN '✅ OK' ELSE 'ℹ️ OPTIONNEL' END
  UNION ALL
  -- Vérifier token allocations
  SELECT 
    'Token Allocations'::TEXT,
    (SELECT count(*) FROM token_allocations WHERE is_active = true)::BIGINT,
    'Allocations de tokens actives'::TEXT,
    CASE WHEN (SELECT count(*) FROM token_allocations WHERE is_active = true) > 0 
         THEN '✅ OK' ELSE 'ℹ️ AUCUNE' END;
END;
$$;

-- ===========================================
-- 7. REQUÊTE POUR DEBUGGER L'INTERFACE ADMIN
-- ===========================================
-- Cette requête montre exactement ce que votre interface devrait afficher
SELECT 
  'DONNÉES POUR INTERFACE ADMIN' as section,
  (SELECT count(*) FROM auth.users) as total_users,
  (SELECT count(*) FROM properties) as total_properties,
  (SELECT count(*) FROM bookings) as total_bookings,
  (SELECT count(DISTINCT user_id) FROM properties WHERE user_id IS NOT NULL) as property_owners,
  (SELECT count(*) FROM admin_users) as admin_users;

-- Exemple des 5 premiers utilisateurs enrichis
SELECT 
  'UTILISATEURS ENRICHIS - ÉCHANTILLON' as section,
  email,
  full_name,
  properties_count,
  total_bookings,
  is_property_owner,
  role
FROM public.users_enriched
ORDER BY created_at DESC
LIMIT 5;

-- ===========================================
-- 8. COMMANDES POUR TESTER L'INTERFACE
-- ===========================================

-- Test 1: Fonction dashboard stats
SELECT 'TEST DASHBOARD STATS' as test, public.get_dashboard_stats_real() as data;

-- Test 2: Fonction users enriched  
SELECT 'TEST USERS ENRICHED' as test, count(*) as total_users FROM public.get_all_users_enriched();

-- Test 3: Vue profiles
SELECT 'TEST PROFILES VIEW' as test, count(*) as total_profiles FROM public.profiles;

-- ===========================================
-- RÉSUMÉ FINAL
-- ===========================================
SELECT * FROM public.verify_real_data_consistency();
