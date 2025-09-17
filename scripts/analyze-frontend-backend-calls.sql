-- ==========================================
-- ANALYSE APPELS FRONTEND <-> BACKEND <-> DATABASE
-- Morocco Host Helper Platform
-- ==========================================

SELECT '🔄 ANALYSE FLUX FRONTEND -> BACKEND -> DATABASE' as section;
SELECT '====================================================' as separator;

-- ===========================================
-- 1. SIMULATION APPELS AdminContext.tsx
-- ===========================================

SELECT '📱 SIMULATION AdminContext.tsx' as analysis_section;

-- Ligne 79: const { data: users } = useQuery get_users_for_admin
SELECT 
  'AdminContext.tsx ligne 79 - get_users_for_admin()' as frontend_call,
  'supabase.rpc(''get_users_for_admin'')' as call_method,
  CASE 
    WHEN EXISTS (SELECT 1 FROM information_schema.routines WHERE routine_name = 'get_users_for_admin')
    THEN '✅ Fonction SQL disponible'
    ELSE '❌ Fonction SQL manquante'
  END as backend_availability;

-- Test réel de l'appel
DO $$
DECLARE
    users_result JSON;
    users_count INTEGER;
    execution_time INTERVAL;
    start_time TIMESTAMP;
BEGIN
    start_time := clock_timestamp();
    
    -- Simuler l'appel frontend
    SELECT public.get_users_for_admin() INTO users_result;
    
    execution_time := clock_timestamp() - start_time;
    
    IF users_result IS NOT NULL THEN
        SELECT json_array_length(users_result) INTO users_count;
        RAISE NOTICE '✅ SIMULATION AdminContext.get_users_for_admin():';
        RAISE NOTICE '   📊 Utilisateurs retournés: %', users_count;
        RAISE NOTICE '   ⏱️ Temps d''exécution: %', execution_time;
        RAISE NOTICE '   📦 Taille réponse: % caractères', length(users_result::text);
    ELSE
        RAISE NOTICE '❌ ÉCHEC AdminContext.get_users_for_admin()';
    END IF;
END $$;

-- Ligne 80: properties select *
SELECT 
  'AdminContext.tsx ligne 80 - properties.*' as frontend_call,
  'supabase.from(''properties'').select(''*'')' as call_method,
  count(*) as properties_returned,
  CASE 
    WHEN count(*) > 0 
    THEN '✅ ' || count(*) || ' propriétés disponibles pour frontend'
    ELSE '❌ Aucune propriété - frontend sera vide'
  END as frontend_impact
FROM properties;

-- Ligne 81: bookings with properties(name)
SELECT 
  'AdminContext.tsx ligne 81 - bookings + properties(name)' as frontend_call,
  'supabase.from(''bookings'').select(''*, properties(name)'')' as call_method,
  count(b.id) as bookings_returned,
  count(p.name) as bookings_with_property_name,
  CASE 
    WHEN count(b.id) > 0 AND count(p.name) > 0
    THEN '✅ ' || count(b.id) || ' réservations avec noms de propriétés'
    WHEN count(b.id) > 0
    THEN '⚠️ ' || count(b.id) || ' réservations mais relations cassées'
    ELSE '❌ Aucune réservation'
  END as relation_status
FROM bookings b
LEFT JOIN properties p ON p.id = b.property_id;

-- Ligne 92: calcul revenue total_amount
SELECT 
  'AdminContext.tsx ligne 92 - revenue calculation' as frontend_call,
  'bookings.reduce((sum, booking) => sum + (booking.total_amount || 0), 0)' as frontend_logic,
  count(CASE WHEN total_amount IS NOT NULL THEN 1 END) as bookings_with_amount,
  count(CASE WHEN total_amount IS NULL THEN 1 END) as bookings_without_amount,
  COALESCE(sum(total_amount), 0) as calculated_revenue,
  CASE 
    WHEN count(CASE WHEN total_amount IS NOT NULL THEN 1 END) = count(*)
    THEN '✅ Tous les bookings ont un montant - calcul revenue OK'
    WHEN count(CASE WHEN total_amount IS NOT NULL THEN 1 END) > 0
    THEN '⚠️ Certains bookings sans montant - revenue partiel'
    ELSE '❌ Aucun booking avec montant - revenue = 0'
  END as revenue_calculation_status
FROM bookings;

-- ===========================================
-- 2. SIMULATION APPELS AdminUsers.tsx
-- ===========================================

SELECT '👥 SIMULATION AdminUsers.tsx' as analysis_section;

-- Ligne 57: Edge Function get-all-users
SELECT 
  'AdminUsers.tsx ligne 57 - Edge Function get-all-users' as frontend_call,
  'supabase.functions.invoke(''get-all-users'')' as call_method,
  CASE 
    WHEN EXISTS (SELECT 1 FROM information_schema.routines WHERE routine_name = 'get_all_users_for_admin')
    THEN '✅ Alternative SQL function disponible'
    ELSE '❌ Edge Function et alternative manquantes'
  END as backend_status;

-- Test alternative Edge Function
DO $$
DECLARE
    all_users_result JSON;
    users_array JSON;
    execution_time INTERVAL;
    start_time TIMESTAMP;
BEGIN
    start_time := clock_timestamp();
    
    SELECT public.get_all_users_for_admin() INTO all_users_result;
    SELECT all_users_result->>'users' INTO users_array;
    
    execution_time := clock_timestamp() - start_time;
    
    IF users_array IS NOT NULL THEN
        RAISE NOTICE '✅ SIMULATION AdminUsers Edge Function alternative:';
        RAISE NOTICE '   👥 Utilisateurs: %', json_array_length(users_array::json);
        RAISE NOTICE '   ⏱️ Temps: %', execution_time;
    ELSE
        RAISE NOTICE '❌ ÉCHEC simulation Edge Function alternative';
    END IF;
END $$;

-- Ligne 68-70: properties par utilisateur
SELECT 
  'AdminUsers.tsx ligne 68-70 - properties par user' as frontend_call,
  'properties.filter(p => p.user_id === user.id)' as frontend_logic,
  au.email,
  count(p.id) as user_properties,
  CASE 
    WHEN count(p.id) > 0 THEN '🏠 ' || count(p.id) || ' propriétés'
    ELSE '👤 Aucune propriété'
  END as frontend_display
FROM auth.users au
LEFT JOIN properties p ON p.user_id = au.id
GROUP BY au.id, au.email
ORDER BY count(p.id) DESC
LIMIT 3;

-- ===========================================
-- 3. SIMULATION APPELS Dashboard.tsx
-- ===========================================

SELECT '📊 SIMULATION Dashboard.tsx' as analysis_section;

-- Stats dashboard
WITH dashboard_stats AS (
  SELECT 
    (SELECT count(*) FROM auth.users) as total_users,
    (SELECT count(*) FROM properties) as total_properties,
    (SELECT count(*) FROM bookings) as total_bookings,
    (SELECT COALESCE(sum(total_amount), 0) FROM bookings) as total_revenue,
    (SELECT count(*) FROM properties WHERE user_id IS NOT NULL) as active_properties,
    (SELECT count(*) FROM bookings WHERE status = 'pending') as pending_bookings
)
SELECT 
  'Dashboard.tsx - Stats Cards' as frontend_component,
  'Utilisateurs: ' || total_users as users_card,
  'Propriétés: ' || total_properties as properties_card,
  'Réservations: ' || total_bookings as bookings_card,
  'Revenue: ' || total_revenue || '€' as revenue_card,
  CASE 
    WHEN total_users > 0 AND total_properties > 0 AND total_bookings > 0
    THEN '✅ Dashboard aura des données complètes'
    WHEN total_users > 0 AND total_properties > 0
    THEN '⚠️ Dashboard avec utilisateurs/propriétés mais sans réservations'
    ELSE '❌ Dashboard avec données limitées'
  END as dashboard_completeness
FROM dashboard_stats;

-- ===========================================
-- 4. ANALYSE PERFORMANCE APPELS
-- ===========================================

SELECT '⚡ PERFORMANCE APPELS DATABASE' as analysis_section;

-- Test performance fonction get_users_for_admin
DO $$
DECLARE
    result JSON;
    start_time TIMESTAMP;
    execution_time INTERVAL;
    data_size INTEGER;
BEGIN
    start_time := clock_timestamp();
    
    -- Test fonction critique
    SELECT public.get_users_for_admin() INTO result;
    
    execution_time := clock_timestamp() - start_time;
    data_size := length(result::text);
    
    RAISE NOTICE '📊 PERFORMANCE get_users_for_admin():';
    RAISE NOTICE '   ⏱️ Temps d''exécution: %', execution_time;
    RAISE NOTICE '   📦 Taille données: % caractères', data_size;
    RAISE NOTICE '   🔄 Users retournés: %', json_array_length(result);
    
    IF execution_time < interval '2 seconds' THEN
        RAISE NOTICE '   ✅ Performance acceptable (< 2s)';
    ELSE
        RAISE NOTICE '   ⚠️ Performance lente (> 2s)';
    END IF;
END $$;

-- Test performance requêtes séparées (comme AdminUsers.tsx fait)
DO $$
DECLARE
    start_time TIMESTAMP;
    execution_time INTERVAL;
    properties_count INTEGER;
    bookings_count INTEGER;
BEGIN
    start_time := clock_timestamp();
    
    -- Simuler les 3 requêtes séparées d'AdminUsers
    SELECT count(*) FROM properties INTO properties_count;
    SELECT count(*) FROM bookings INTO bookings_count;
    SELECT count(*) FROM admin_users INTO properties_count; -- réutilise la variable
    
    execution_time := clock_timestamp() - start_time;
    
    RAISE NOTICE '📊 PERFORMANCE requêtes séparées AdminUsers:';
    RAISE NOTICE '   ⏱️ Temps total 3 requêtes: %', execution_time;
    
    IF execution_time < interval '1 second' THEN
        RAISE NOTICE '   ✅ Performance excellente (< 1s)';
    ELSE
        RAISE NOTICE '   ⚠️ Performance à optimiser (> 1s)';
    END IF;
END $$;

-- ===========================================
-- 5. COHÉRENCE TYPES FRONTEND <-> DATABASE
-- ===========================================

SELECT '🔗 COHÉRENCE TYPES FRONTEND <-> DATABASE' as analysis_section;

-- Types attendus par le frontend vs disponibles en database
SELECT 
  'Types BookingType (frontend)' as type_check,
  'Colonnes attendues vs disponibles' as verification,
  CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'bookings' AND column_name = 'id') 
       THEN '✅ id' ELSE '❌ id' END ||
  CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'bookings' AND column_name = 'property_id') 
       THEN ' ✅ property_id' ELSE ' ❌ property_id' END ||
  CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'bookings' AND column_name = 'guest_name') 
       THEN ' ✅ guest_name' ELSE ' ❌ guest_name' END ||
  CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'bookings' AND column_name = 'total_amount') 
       THEN ' ✅ total_amount' ELSE ' ❌ total_amount' END ||
  CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'bookings' AND column_name = 'status') 
       THEN ' ✅ status' ELSE ' ❌ status' END as booking_type_compliance;

-- Types PropertyType (frontend)
SELECT 
  'Types PropertyType (frontend)' as type_check,
  'Colonnes attendues vs disponibles' as verification,
  CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'properties' AND column_name = 'id') 
       THEN '✅ id' ELSE '❌ id' END ||
  CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'properties' AND column_name = 'name') 
       THEN ' ✅ name' ELSE ' ❌ name' END ||
  CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'properties' AND column_name = 'user_id') 
       THEN ' ✅ user_id' ELSE ' ❌ user_id' END ||
  CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'properties' AND column_name = 'address') 
       THEN ' ✅ address' ELSE ' ❌ address' END as property_type_compliance;

-- ===========================================
-- 6. SIMULATION COMPLETE WORKFLOW
-- ===========================================

SELECT '🔄 SIMULATION WORKFLOW COMPLET' as analysis_section;

-- Simulation complète : User login -> Admin check -> Data loading
DO $$
DECLARE
    -- Variables simulation
    test_user_id UUID;
    is_admin_result BOOLEAN := FALSE;
    admin_data JSON;
    workflow_time INTERVAL;
    start_time TIMESTAMP;
BEGIN
    start_time := clock_timestamp();
    
    -- 1. Simuler récupération user ID (après login)
    SELECT id INTO test_user_id FROM auth.users LIMIT 1;
    
    IF test_user_id IS NULL THEN
        RAISE NOTICE '❌ WORKFLOW: Aucun utilisateur pour test';
        RETURN;
    END IF;
    
    -- 2. Simuler vérification admin
    SELECT EXISTS(
        SELECT 1 FROM admin_users 
        WHERE user_id = test_user_id AND is_active = true
    ) INTO is_admin_result;
    
    -- 3. Simuler chargement données admin
    IF is_admin_result THEN
        SELECT public.get_users_for_admin() INTO admin_data;
    END IF;
    
    workflow_time := clock_timestamp() - start_time;
    
    RAISE NOTICE '🔄 SIMULATION WORKFLOW COMPLET:';
    RAISE NOTICE '   👤 User testé: %', test_user_id;
    RAISE NOTICE '   🔐 Est admin: %', is_admin_result;
    RAISE NOTICE '   📊 Données chargées: %', (admin_data IS NOT NULL);
    RAISE NOTICE '   ⏱️ Temps total workflow: %', workflow_time;
    
    IF workflow_time < interval '3 seconds' THEN
        RAISE NOTICE '   ✅ Workflow rapide - UX acceptable';
    ELSE
        RAISE NOTICE '   ⚠️ Workflow lent - UX à améliorer';
    END IF;
END $$;

-- ===========================================
-- 7. RÉSUMÉ APPELS FRONTEND/BACKEND
-- ===========================================

SELECT '🏁 RÉSUMÉ APPELS FRONTEND/BACKEND' as final_section;

WITH calls_analysis AS (
  SELECT 
    -- Fonctions disponibles
    CASE WHEN EXISTS (SELECT 1 FROM information_schema.routines WHERE routine_name = 'get_users_for_admin') THEN 1 ELSE 0 END as has_get_users,
    CASE WHEN EXISTS (SELECT 1 FROM information_schema.routines WHERE routine_name = 'get_all_users_for_admin') THEN 1 ELSE 0 END as has_get_all_users,
    CASE WHEN EXISTS (SELECT 1 FROM information_schema.views WHERE table_name = 'profiles') THEN 1 ELSE 0 END as has_profiles_view,
    -- Données disponibles
    (SELECT count(*) FROM auth.users) as users_count,
    (SELECT count(*) FROM properties) as properties_count,
    (SELECT count(*) FROM bookings) as bookings_count,
    -- Colonnes critiques
    CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'bookings' AND column_name = 'total_amount') THEN 1 ELSE 0 END as has_total_amount
)
SELECT 
  'APPELS FRONTEND -> BACKEND' as analysis_summary,
  has_get_users || '/1 fonction get_users_for_admin' as admin_functions,
  has_get_all_users || '/1 fonction get_all_users_for_admin' as edge_functions,
  has_profiles_view || '/1 vue profiles' as database_views,
  users_count || ' users, ' || properties_count || ' properties, ' || bookings_count || ' bookings' as data_summary,
  CASE 
    WHEN has_get_users = 1 AND has_profiles_view = 1 AND has_total_amount = 1
    THEN '✅ TOUS APPELS FRONTEND SUPPORTÉS'
    WHEN has_get_users = 1 AND has_profiles_view = 1
    THEN '⚠️ APPELS SUPPORTÉS - Revenue partiel'
    ELSE '❌ APPELS FRONTEND NON SUPPORTÉS'
  END as frontend_support_status,
  CASE 
    WHEN has_get_users = 1 AND has_profiles_view = 1 AND users_count > 0
    THEN 'Frontend peut charger et afficher toutes les données'
    WHEN has_get_users = 1 AND has_profiles_view = 1
    THEN 'Frontend peut charger les structures mais données limitées'
    ELSE 'Frontend aura des erreurs - corrections nécessaires'
  END as recommendation
FROM calls_analysis;

SELECT '====================================================' as separator;
SELECT 'ANALYSE APPELS FRONTEND/BACKEND TERMINÉE' as completion;
