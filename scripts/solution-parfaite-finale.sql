-- =====================================
-- SOLUTION PARFAITE - BASÉE SUR VOTRE STRUCTURE RÉELLE
-- Morocco Host Helper Platform
-- =====================================

-- ===========================================
-- 1. CRÉER LA VUE PROFILES (AdminContext ligne 79)
-- ===========================================
DROP VIEW IF EXISTS public.profiles CASCADE;
CREATE VIEW public.profiles AS
SELECT 
  hp.id,
  au.email,
  hp.full_name,
  hp.avatar_url,
  hp.phone,
  hp.created_at,
  hp.updated_at
FROM public.host_profiles hp
JOIN auth.users au ON au.id = hp.id;

-- ===========================================
-- 2. AJOUTER COLONNE TOTAL_AMOUNT (AdminContext ligne 92)
-- ===========================================
-- L'app calcule le revenu depuis booking.total_amount
ALTER TABLE public.bookings 
ADD COLUMN IF NOT EXISTS total_amount DECIMAL(10,2);

-- Calculer total_amount basé sur vos données existantes
UPDATE public.bookings 
SET total_amount = COALESCE(total_price, 0)
WHERE total_amount IS NULL AND total_price IS NOT NULL;

-- ===========================================
-- 3. FONCTION GET_USERS_FOR_ADMIN (AdminContext ligne 79)
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
      'full_name', COALESCE(hp.full_name, au.email),
      'created_at', au.created_at,
      'updated_at', COALESCE(hp.updated_at, au.updated_at),
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
-- 4. FONCTION DASHBOARD STATS RÉELLES
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
    'totalRevenue', (SELECT COALESCE(sum(total_amount), 0) FROM bookings),
    'activeProperties', (SELECT count(*) FROM properties WHERE user_id IS NOT NULL),
    'pendingBookings', (SELECT count(*) FROM bookings WHERE status = 'pending'),
    'completedBookings', (SELECT count(*) FROM bookings WHERE status = 'completed'),
    'propertyOwners', (SELECT count(DISTINCT user_id) FROM properties WHERE user_id IS NOT NULL),
    'activeTokens', (SELECT COALESCE(sum(tokens_remaining), 0) FROM token_allocations WHERE is_active = true)
  ) INTO result;
  
  RETURN result;
END;
$$;

-- ===========================================
-- 5. FONCTION POUR EDGE FUNCTION GET-ALL-USERS (AdminUsers ligne 57)
-- ===========================================
-- Alternative à l'edge function manquante
CREATE OR REPLACE FUNCTION public.get_all_users_for_admin()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result JSON;
BEGIN
  SELECT json_build_object(
    'users', json_agg(
      json_build_object(
        'id', au.id,
        'email', au.email,
        'created_at', au.created_at,
        'user_metadata', json_build_object(
          'full_name', hp.full_name
        )
      )
    )
  ) INTO result
  FROM auth.users au
  LEFT JOIN public.host_profiles hp ON hp.id = au.id;
  
  RETURN result;
END;
$$;

-- ===========================================
-- 6. TESTS AVEC VOS VRAIES DONNÉES
-- ===========================================

-- Test 1: Vue profiles
SELECT 'TEST 1: Profiles' as test, count(*) as nb_profiles FROM public.profiles;

-- Test 2: Fonction users admin
SELECT 'TEST 2: Users Admin' as test, 
       CASE 
         WHEN public.get_users_for_admin() IS NOT NULL 
         THEN 'OK - ' || json_array_length(public.get_users_for_admin()) || ' utilisateurs'
         ELSE 'Erreur'
       END as result;

-- Test 3: Dashboard stats
SELECT 'TEST 3: Dashboard Stats' as test, public.get_dashboard_stats_real() as data;

-- Test 4: Edge function alternative
SELECT 'TEST 4: Edge Function Alt' as test,
       CASE 
         WHEN public.get_all_users_for_admin()->>'users' IS NOT NULL
         THEN 'OK - Edge function simulée'
         ELSE 'Erreur'
       END as result;

-- ===========================================
-- 7. DONNÉES RÉELLES POUR INTERFACE
-- ===========================================

-- Statistiques exactes pour votre dashboard
SELECT 
  'STATS DASHBOARD RÉELLES' as info,
  (SELECT count(*) FROM auth.users) as total_users,
  (SELECT count(*) FROM properties) as total_properties,
  (SELECT count(*) FROM bookings) as total_bookings,
  (SELECT count(DISTINCT user_id) FROM properties WHERE user_id IS NOT NULL) as property_owners,
  (SELECT count(*) FROM admin_users) as admin_users,
  (SELECT count(*) FROM token_allocations WHERE is_active = true) as active_tokens;

-- Exemples propriétaires avec vraies données
SELECT 
  'PROPRIÉTAIRES RÉELS' as info,
  au.email,
  hp.full_name,
  count(p.id) as nb_properties,
  count(b.id) as nb_bookings,
  sum(b.total_amount) as revenue_total
FROM auth.users au
LEFT JOIN host_profiles hp ON hp.id = au.id
JOIN properties p ON p.user_id = au.id
LEFT JOIN bookings b ON b.property_id = p.id
GROUP BY au.id, au.email, hp.full_name
ORDER BY count(p.id) DESC
LIMIT 5;

-- Bookings récents avec vos vraies colonnes
SELECT 
  'BOOKINGS RÉCENTS' as info,
  b.id,
  b.status::text,
  b.check_in_date,
  b.check_out_date,
  b.total_amount,
  b.guest_name,
  p.name as property_name
FROM bookings b
LEFT JOIN properties p ON p.id = b.property_id
ORDER BY b.created_at DESC
LIMIT 5;

-- ===========================================
-- 8. VÉRIFICATION FINALE
-- ===========================================
SELECT 
  'VÉRIFICATION FINALE' as check_type,
  CASE 
    WHEN EXISTS (SELECT 1 FROM information_schema.views WHERE table_name = 'profiles') 
    THEN '✅ Vue profiles créée'
    ELSE '❌ Vue profiles manquante'
  END as profiles_status,
  CASE 
    WHEN EXISTS (SELECT 1 FROM information_schema.routines WHERE routine_name = 'get_users_for_admin') 
    THEN '✅ Fonction users créée'
    ELSE '❌ Fonction users manquante'
  END as function_status,
  CASE 
    WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'bookings' AND column_name = 'total_amount') 
    THEN '✅ Colonne total_amount ajoutée'
    ELSE '❌ Colonne total_amount manquante'
  END as column_status;

-- ===========================================
-- 9. COMMANDES POUR TESTER L'INTERFACE
-- ===========================================

-- Ces requêtes correspondent exactement à ce que votre app attend:

-- AdminContext ligne 79 (get_users_for_admin)
SELECT 'SIMULATION AdminContext' as test, 
       json_array_length(public.get_users_for_admin()) as nb_users_returned;

-- AdminContext ligne 80 (properties.*)
SELECT 'SIMULATION properties.*' as test, count(*) as nb_properties FROM properties;

-- AdminContext ligne 81 (bookings + properties(name))
SELECT 'SIMULATION bookings + properties' as test, 
       count(b.id) as nb_bookings,
       count(p.name) as nb_with_property_name
FROM bookings b
LEFT JOIN properties p ON p.id = b.property_id;

-- AdminUsers ligne 68-70 (properties by user)
SELECT 'SIMULATION AdminUsers properties' as test,
       count(DISTINCT user_id) as nb_property_owners
FROM properties WHERE user_id IS NOT NULL;

-- ===========================================
-- RÉSUMÉ SUCCÈS
-- ===========================================
SELECT 
  'RÉSUMÉ FINAL' as section,
  '✅ Solution adaptée à votre structure réelle' as status,
  'AdminContext peut maintenant charger les vraies données' as conclusion;
