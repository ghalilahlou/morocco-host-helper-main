-- =========================================
-- 🔍 TESTS EXHAUSTIFS POUR DÉTECTER INCOHÉRENCES
-- Morocco Host Helper Platform - Diagnostic Complet
-- =========================================

BEGIN;

-- ===========================================
-- 📊 SECTION 1: TESTS BACKEND/FRONTEND MATCH
-- ===========================================

-- Test 1.1: AdminContext expects profiles table
SELECT 
  '🔍 TEST 1.1: Vue profiles existe' as test,
  CASE 
    WHEN EXISTS (SELECT 1 FROM information_schema.views WHERE table_name = 'profiles')
    THEN '✅ OK - Vue profiles trouvée'
    ELSE '❌ ERREUR - Vue profiles manquante (AdminContext ligne 79)'
  END as status,
  (SELECT count(*) FROM information_schema.views WHERE table_name = 'profiles') as nb_views;

-- Test 1.2: AdminContext expects total_amount column
SELECT 
  '🔍 TEST 1.2: Colonne total_amount' as test,
  CASE 
    WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'bookings' AND column_name = 'total_amount')
    THEN '✅ OK - Colonne total_amount trouvée'
    ELSE '❌ ERREUR - Colonne total_amount manquante (AdminContext ligne 92)'
  END as status,
  pg_typeof((SELECT total_amount FROM bookings LIMIT 1))::text as type_found;

-- Test 1.3: useBookings.ts expects propertyId field
SELECT 
  '🔍 TEST 1.3: Transformation propertyId' as test,
  CASE 
    WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'bookings' AND column_name = 'property_id')
    THEN '✅ OK - property_id existe pour transformation en propertyId'
    ELSE '❌ ERREUR - property_id manquant'
  END as status;

-- Test 1.4: BookingWizard validation needs propertyId
SELECT 
  '🔍 TEST 1.4: Validation property_id NOT NULL' as test,
  count(*) as nb_bookings_orphans,
  CASE 
    WHEN count(*) = 0 THEN '✅ OK - Aucun booking orphelin'
    ELSE '⚠️ ATTENTION - ' || count(*) || ' bookings sans property_id'
  END as status
FROM bookings WHERE property_id IS NULL;

-- ===========================================
-- 📋 SECTION 2: TESTS DONNÉES COHÉRENTES
-- ===========================================

-- Test 2.1: Guests sans doublons
WITH guest_duplicates AS (
  SELECT email, count(*) as nb_occurrences
  FROM guests 
  WHERE email IS NOT NULL
  GROUP BY email
  HAVING count(*) > 1
)
SELECT 
  '🔍 TEST 2.1: Doublons guests' as test,
  count(*) as nb_emails_dupliques,
  CASE 
    WHEN count(*) = 0 THEN '✅ OK - Aucun doublon guest'
    ELSE '⚠️ ATTENTION - ' || count(*) || ' emails dupliqués'
  END as status
FROM guest_duplicates;

-- Test 2.2: Properties avec user_id valide
SELECT 
  '🔍 TEST 2.2: Properties avec user_id' as test,
  count(*) as nb_properties_orphelines,
  CASE 
    WHEN count(*) = 0 THEN '✅ OK - Toutes les properties ont un user_id'
    ELSE '⚠️ ATTENTION - ' || count(*) || ' properties sans user_id'
  END as status
FROM properties WHERE user_id IS NULL;

-- Test 2.3: Bookings avec guest_id valide
SELECT 
  '🔍 TEST 2.3: Bookings avec guest_id' as test,
  count(*) as nb_bookings_sans_guest,
  CASE 
    WHEN count(*) = 0 THEN '✅ OK - Tous les bookings ont un guest_id'
    ELSE '⚠️ ATTENTION - ' || count(*) || ' bookings sans guest_id'
  END as status
FROM bookings WHERE guest_id IS NULL;

-- Test 2.4: Admin users avec email
SELECT 
  '🔍 TEST 2.4: Admin users avec email' as test,
  count(*) as nb_admins_sans_email,
  CASE 
    WHEN count(*) = 0 THEN '✅ OK - Tous les admins ont un email'
    ELSE '⚠️ ATTENTION - ' || count(*) || ' admins sans email'
  END as status
FROM admin_users WHERE email IS NULL OR email = '';

-- ===========================================
-- 🔧 SECTION 3: TESTS FONCTIONS REQUISES
-- ===========================================

-- Test 3.1: get_users_for_admin function
SELECT 
  '🔍 TEST 3.1: Fonction get_users_for_admin' as test,
  CASE 
    WHEN EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'get_users_for_admin')
    THEN '✅ OK - Fonction existe'
    ELSE '❌ ERREUR - Fonction manquante'
  END as status;

-- Test 3.2: Test exécution get_users_for_admin
SELECT 
  '🔍 TEST 3.2: Exécution get_users_for_admin' as test,
  CASE 
    WHEN public.get_users_for_admin() IS NOT NULL 
    THEN '✅ OK - Fonction s''exécute: ' || json_array_length(public.get_users_for_admin()) || ' users'
    ELSE '❌ ERREUR - Fonction retourne NULL'
  END as status;

-- Test 3.3: get_dashboard_stats_real function
SELECT 
  '🔍 TEST 3.3: Fonction get_dashboard_stats_real' as test,
  CASE 
    WHEN EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'get_dashboard_stats_real')
    THEN '✅ OK - Fonction existe'
    ELSE '❌ ERREUR - Fonction manquante'
  END as status;

-- Test 3.4: Test exécution dashboard stats
SELECT 
  '🔍 TEST 3.4: Exécution dashboard stats' as test,
  CASE 
    WHEN public.get_dashboard_stats_real() IS NOT NULL 
    THEN '✅ OK - Stats disponibles'
    ELSE '❌ ERREUR - Stats NULL'
  END as status;

-- ===========================================
-- 📊 SECTION 4: TESTS TYPES DE DONNÉES
-- ===========================================

-- Test 4.1: Types booking status enum
SELECT 
  '🔍 TEST 4.1: Booking status enum' as test,
  string_agg(DISTINCT status::text, ', ') as statuses_found,
  CASE 
    WHEN 'pending' = ANY(array_agg(DISTINCT status::text)) AND 
         'confirmed' = ANY(array_agg(DISTINCT status::text))
    THEN '✅ OK - Statuses standards trouvés'
    ELSE '⚠️ ATTENTION - Vérifier les statuses'
  END as status
FROM bookings;

-- Test 4.2: Types admin role enum
SELECT 
  '🔍 TEST 4.2: Admin role enum' as test,
  string_agg(DISTINCT role::text, ', ') as roles_found,
  CASE 
    WHEN 'admin' = ANY(array_agg(DISTINCT role::text)) OR 
         'super_admin' = ANY(array_agg(DISTINCT role::text))
    THEN '✅ OK - Roles admin trouvés'
    ELSE '⚠️ ATTENTION - Vérifier les roles'
  END as status
FROM admin_users;

-- Test 4.3: Types property status
SELECT 
  '🔍 TEST 4.3: Property status' as test,
  count(DISTINCT status) as nb_status_differents,
  string_agg(DISTINCT status::text, ', ') as statuses_found
FROM properties;

-- ===========================================
-- 🔗 SECTION 5: TESTS RELATIONS/FOREIGN KEYS
-- ===========================================

-- Test 5.1: Relations bookings -> properties
SELECT 
  '🔍 TEST 5.1: Relations bookings->properties' as test,
  count(b.id) as total_bookings,
  count(p.id) as bookings_with_valid_property,
  CASE 
    WHEN count(b.id) = count(p.id) THEN '✅ OK - Toutes les relations valides'
    ELSE '⚠️ ATTENTION - ' || (count(b.id) - count(p.id)) || ' relations cassées'
  END as status
FROM bookings b
LEFT JOIN properties p ON p.id = b.property_id;

-- Test 5.2: Relations bookings -> guests
SELECT 
  '🔍 TEST 5.2: Relations bookings->guests' as test,
  count(b.id) as total_bookings,
  count(g.id) as bookings_with_valid_guest,
  CASE 
    WHEN count(b.id) = count(g.id) THEN '✅ OK - Toutes les relations valides'
    ELSE '⚠️ ATTENTION - ' || (count(b.id) - count(g.id)) || ' relations cassées'
  END as status
FROM bookings b
LEFT JOIN guests g ON g.id = b.guest_id;

-- Test 5.3: Relations properties -> users
SELECT 
  '🔍 TEST 5.3: Relations properties->users' as test,
  count(p.id) as total_properties,
  count(hp.id) as properties_with_valid_owner,
  CASE 
    WHEN count(p.id) = count(hp.id) THEN '✅ OK - Toutes les relations valides'
    ELSE '⚠️ ATTENTION - ' || (count(p.id) - count(hp.id)) || ' properties sans owner valide'
  END as status
FROM properties p
LEFT JOIN host_profiles hp ON hp.id = p.user_id;

-- ===========================================
-- 📈 SECTION 6: TESTS DONNÉES BUSINESS
-- ===========================================

-- Test 6.1: Revenue calculations
SELECT 
  '🔍 TEST 6.1: Calculs revenue' as test,
  count(*) as nb_bookings_with_amount,
  sum(total_amount) as revenue_total,
  avg(total_amount) as revenue_moyen,
  CASE 
    WHEN sum(total_amount) > 0 THEN '✅ OK - Revenue calculé: ' || sum(total_amount)
    ELSE '⚠️ ATTENTION - Aucun revenue'
  END as status
FROM bookings WHERE total_amount IS NOT NULL AND total_amount > 0;

-- Test 6.2: Token allocations
SELECT 
  '🔍 TEST 6.2: Token allocations' as test,
  count(*) as total_allocations,
  count(*) FILTER (WHERE is_active = true) as active_allocations,
  sum(tokens_remaining) as tokens_remaining_total,
  CASE 
    WHEN count(*) > 0 THEN '✅ OK - ' || count(*) || ' allocations trouvées'
    ELSE '⚠️ ATTENTION - Aucune allocation token'
  END as status
FROM token_allocations;

-- ===========================================
-- 🎯 SECTION 7: TESTS SPÉCIFIQUES FRONTEND
-- ===========================================

-- Test 7.1: Simulation AdminContext.loadDashboardData()
WITH dashboard_simulation AS (
  SELECT 
    (SELECT count(*) FROM auth.users) as totalUsers,
    (SELECT count(*) FROM properties) as totalProperties,
    (SELECT count(*) FROM bookings) as totalBookings,
    (SELECT COALESCE(sum(total_amount), 0) FROM bookings) as totalRevenue
)
SELECT 
  '🔍 TEST 7.1: Simulation AdminContext.loadDashboardData' as test,
  json_build_object(
    'totalUsers', totalUsers,
    'totalProperties', totalProperties,
    'totalBookings', totalBookings,
    'totalRevenue', totalRevenue
  ) as dashboard_data,
  CASE 
    WHEN totalUsers > 0 AND totalProperties >= 0 AND totalBookings >= 0 
    THEN '✅ OK - Dashboard data cohérentes'
    ELSE '❌ ERREUR - Dashboard data incohérentes'
  END as status
FROM dashboard_simulation;

-- Test 7.2: Simulation AdminUsers.loadUsers()
SELECT 
  '🔍 TEST 7.2: Simulation AdminUsers.loadUsers' as test,
  count(*) as total_users_enriched,
  count(*) FILTER (WHERE properties_count > 0) as property_owners,
  count(*) FILTER (WHERE total_bookings > 0) as users_with_bookings,
  CASE 
    WHEN count(*) > 0 THEN '✅ OK - ' || count(*) || ' utilisateurs enrichis'
    ELSE '❌ ERREUR - Aucun utilisateur enrichi'
  END as status
FROM (
  SELECT 
    au.id,
    au.email,
    COALESCE(hp.full_name, au.email) as full_name,
    COALESCE(prop_stats.properties_count, 0) as properties_count,
    COALESCE(prop_stats.total_bookings, 0) as total_bookings,
    COALESCE(prop_stats.properties_count, 0) > 0 as is_property_owner
  FROM auth.users au
  LEFT JOIN host_profiles hp ON hp.id = au.id
  LEFT JOIN (
    SELECT 
      p.user_id,
      count(p.id)::integer as properties_count,
      count(b.id)::integer as total_bookings
    FROM properties p
    LEFT JOIN bookings b ON b.property_id = p.id
    GROUP BY p.user_id
  ) prop_stats ON prop_stats.user_id = au.id
) enriched_users;

-- ===========================================
-- 📊 SECTION 8: RÉSUMÉ INCOHÉRENCES
-- ===========================================

-- Résumé final avec priorités
SELECT 
  '🎯 RÉSUMÉ INCOHÉRENCES DÉTECTÉES' as section,
  CASE 
    WHEN (SELECT count(*) FROM bookings WHERE property_id IS NULL) > 0 
    THEN '🔴 CRITIQUE: Bookings orphelins'
    WHEN NOT EXISTS (SELECT 1 FROM information_schema.views WHERE table_name = 'profiles')
    THEN '🔴 CRITIQUE: Vue profiles manquante'
    WHEN NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'get_users_for_admin')
    THEN '🔴 CRITIQUE: Fonctions admin manquantes'
    ELSE '🟢 SUCCÈS: Aucune incohérence critique'
  END as priorite_1,
  CASE 
    WHEN (SELECT count(*) FROM admin_users WHERE email IS NULL) > 0
    THEN '🟡 MINEUR: Admins sans email'
    WHEN (SELECT count(*) FROM properties WHERE user_id IS NULL) > 0
    THEN '🟡 MINEUR: Properties orphelines'
    ELSE '🟢 OK: Données cohérentes'
  END as priorite_2;

ROLLBACK;  -- Ne pas modifier la base, juste tester

