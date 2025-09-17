-- ==========================================
-- TEST INTERFACE ADMINISTRATEUR AVEC VRAIES DONNÉES
-- Morocco Host Helper Platform
-- ==========================================

-- ===========================================
-- 1. SIMULATION COMPLÈTE AdminContext.tsx
-- ===========================================

SELECT '🖥️ SIMULATION AdminContext.tsx' as test_section;

-- Test exact ligne 79: useQuery get_users_for_admin
DO $$
DECLARE
    users_result JSON;
    users_count INTEGER;
BEGIN
    SELECT public.get_users_for_admin() INTO users_result;
    SELECT json_array_length(users_result) INTO users_count;
    
    RAISE NOTICE '📊 AdminContext.get_users_for_admin():';
    RAISE NOTICE '   ✅ Fonction exécutée avec succès';
    RAISE NOTICE '   📈 % utilisateurs retournés', users_count;
    RAISE NOTICE '   🔍 Premier utilisateur: %', (users_result->0->>'email');
END $$;

-- Test ligne 80: properties select *
SELECT 
  '📊 AdminContext.properties.*' as test_simulation,
  count(*) as total_properties,
  count(CASE WHEN user_id IS NOT NULL THEN 1 END) as properties_with_owner,
  count(CASE WHEN name IS NOT NULL THEN 1 END) as properties_with_name,
  CASE 
    WHEN count(*) > 0 
    THEN '✅ ' || count(*) || ' propriétés disponibles pour l interface admin'
    ELSE '❌ Aucune propriété - Interface admin sera vide'
  END as admin_interface_impact
FROM properties;

-- Test ligne 81: bookings with properties(name)
SELECT 
  '📊 AdminContext.bookings + properties(name)' as test_simulation,
  count(b.id) as total_bookings,
  count(p.name) as bookings_with_property_name,
  count(CASE WHEN b.total_amount IS NOT NULL THEN 1 END) as bookings_with_amount,
  CASE 
    WHEN count(b.id) > 0 
    THEN '✅ ' || count(b.id) || ' réservations pour l interface admin'
    ELSE '❌ Aucune réservation - Interface admin revenue à 0'
  END as booking_interface_impact
FROM bookings b
LEFT JOIN properties p ON p.id = b.property_id;

-- Test ligne 92: calcul revenue total_amount
SELECT 
  '📊 AdminContext.revenue calculation' as test_simulation,
  count(CASE WHEN total_amount IS NOT NULL THEN 1 END) as bookings_with_revenue,
  COALESCE(sum(total_amount), 0) as total_revenue_calculated,
  COALESCE(avg(total_amount), 0) as average_booking_amount,
  CASE 
    WHEN sum(total_amount) > 0 
    THEN '✅ Revenue total: ' || sum(total_amount) || ' (affiché dans dashboard)'
    WHEN count(*) > 0 AND sum(total_amount) IS NULL
    THEN '⚠️ Réservations sans montant - Revenue affiché: 0'
    ELSE '❌ Aucune donnée revenue - Dashboard affichera 0'
  END as revenue_display_result
FROM bookings;

-- ===========================================
-- 2. SIMULATION AdminUsers.tsx
-- ===========================================

SELECT '👥 SIMULATION AdminUsers.tsx' as test_section;

-- Test ligne 57: simulation edge function get-all-users
DO $$
DECLARE
    all_users_result JSON;
    users_from_function JSON;
BEGIN
    SELECT public.get_all_users_for_admin() INTO all_users_result;
    SELECT all_users_result->>'users' INTO users_from_function;
    
    RAISE NOTICE '📊 AdminUsers.get-all-users simulation:';
    RAISE NOTICE '   ✅ Alternative function works';
    RAISE NOTICE '   📈 Users in response: %', json_array_length(users_from_function::json);
END $$;

-- Test ligne 68-70: properties par utilisateur
SELECT 
  '📊 AdminUsers.properties par utilisateur' as test_simulation,
  u.email,
  COALESCE(hp.full_name, 'Nom non défini') as display_name,
  count(p.id) as user_properties_count,
  count(b.id) as user_bookings_count,
  COALESCE(sum(b.total_amount), 0) as user_total_revenue,
  CASE 
    WHEN count(p.id) > 0 
    THEN '✅ Propriétaire actif'
    ELSE '👤 Utilisateur simple'
  END as user_type_in_interface
FROM auth.users u
LEFT JOIN host_profiles hp ON hp.id = u.id
LEFT JOIN properties p ON p.user_id = u.id
LEFT JOIN bookings b ON b.property_id = p.id
GROUP BY u.id, u.email, hp.full_name
ORDER BY count(p.id) DESC, count(b.id) DESC
LIMIT 5;

-- ===========================================
-- 3. SIMULATION Dashboard.tsx STATISTIQUES
-- ===========================================

SELECT '📈 SIMULATION Dashboard.tsx' as test_section;

-- Statistiques exactes comme affichées dans le dashboard
WITH dashboard_stats AS (
  SELECT 
    (SELECT count(*) FROM auth.users) as total_users,
    (SELECT count(*) FROM properties) as total_properties,
    (SELECT count(*) FROM bookings) as total_bookings,
    (SELECT COALESCE(sum(total_amount), 0) FROM bookings) as total_revenue,
    (SELECT count(*) FROM properties WHERE user_id IS NOT NULL) as active_properties,
    (SELECT count(*) FROM bookings WHERE status = 'pending') as pending_bookings,
    (SELECT count(*) FROM bookings WHERE status = 'completed') as completed_bookings,
    (SELECT count(DISTINCT user_id) FROM properties WHERE user_id IS NOT NULL) as property_owners
)
SELECT 
  '📊 Dashboard Statistics Display' as dashboard_element,
  'Utilisateurs: ' || total_users as users_stat,
  'Propriétés: ' || total_properties as properties_stat,
  'Réservations: ' || total_bookings as bookings_stat,
  'Revenue: ' || total_revenue || '€' as revenue_stat,
  'Propriétaires: ' || property_owners as owners_stat,
  CASE 
    WHEN total_users > 0 AND total_properties > 0 AND total_bookings > 0
    THEN '✅ Dashboard aura des données significatives'
    WHEN total_users > 0 AND total_properties > 0
    THEN '⚠️ Dashboard avec utilisateurs/propriétés mais pas de réservations'
    WHEN total_users > 0
    THEN '⚠️ Dashboard avec utilisateurs mais pas de propriétés'
    ELSE '❌ Dashboard sera presque vide'
  END as dashboard_visual_impact
FROM dashboard_stats;

-- ===========================================
-- 4. DONNÉES RÉELLES POUR INTERFACE
-- ===========================================

SELECT '💾 DONNÉES RÉELLES POUR INTERFACE' as test_section;

-- Top 3 propriétaires (comme affiché dans AdminUsers)
SELECT 
  '🏠 Top Propriétaires (AdminUsers display)' as interface_section,
  row_number() OVER (ORDER BY count(p.id) DESC) as rank,
  u.email,
  COALESCE(hp.full_name, substring(u.email from 1 for 20)) as display_name,
  count(p.id) as properties_count,
  count(b.id) as bookings_count,
  COALESCE(sum(b.total_amount), 0) as total_revenue,
  CASE 
    WHEN count(p.id) >= 3 THEN '🔥 Super host'
    WHEN count(p.id) >= 2 THEN '⭐ Host actif' 
    WHEN count(p.id) = 1 THEN '🏠 Nouveau host'
    ELSE '👤 Pas de propriété'
  END as host_badge
FROM auth.users u
LEFT JOIN host_profiles hp ON hp.id = u.id
LEFT JOIN properties p ON p.user_id = u.id
LEFT JOIN bookings b ON b.property_id = p.id
GROUP BY u.id, u.email, hp.full_name
ORDER BY count(p.id) DESC, count(b.id) DESC
LIMIT 3;

-- Réservations récentes (comme affiché dans Dashboard)
SELECT 
  '📅 Réservations Récentes (Dashboard display)' as interface_section,
  b.id as booking_id,
  COALESCE(b.guest_name, 'Invité #' || b.id) as guest_display,
  COALESCE(p.name, 'Propriété #' || b.property_id) as property_display,
  b.check_in_date,
  b.check_out_date,
  COALESCE(b.total_amount, 0) as amount_display,
  CASE b.status
    WHEN 'pending' THEN '🟡 En attente'
    WHEN 'confirmed' THEN '✅ Confirmée'
    WHEN 'completed' THEN '🏁 Terminée'
    WHEN 'cancelled' THEN '❌ Annulée'
    ELSE '❓ ' || b.status
  END as status_display,
  CASE 
    WHEN b.check_in_date > CURRENT_DATE THEN '🔮 Future'
    WHEN b.check_out_date >= CURRENT_DATE THEN '🏠 En cours'
    ELSE '📜 Passée'
  END as timing_badge
FROM bookings b
LEFT JOIN properties p ON p.id = b.property_id
ORDER BY b.created_at DESC
LIMIT 5;

-- ===========================================
-- 5. SIMULATION INTERFACE UTILISATEUR
-- ===========================================

SELECT '🎨 SIMULATION INTERFACE UTILISATEUR' as test_section;

-- Cards dashboard comme affichées
SELECT 
  '📋 Dashboard Cards Simulation' as ui_element,
  json_build_object(
    'users_card', json_build_object(
      'title', 'Utilisateurs Total',
      'value', (SELECT count(*) FROM auth.users),
      'icon', '👥',
      'color', 'blue'
    ),
    'properties_card', json_build_object(
      'title', 'Propriétés Total', 
      'value', (SELECT count(*) FROM properties),
      'icon', '🏠',
      'color', 'green'
    ),
    'bookings_card', json_build_object(
      'title', 'Réservations Total',
      'value', (SELECT count(*) FROM bookings), 
      'icon', '📅',
      'color', 'purple'
    ),
    'revenue_card', json_build_object(
      'title', 'Revenue Total',
      'value', (SELECT COALESCE(sum(total_amount), 0) FROM bookings),
      'icon', '💰',
      'color', 'yellow'
    )
  ) as dashboard_cards_data;

-- ===========================================
-- 6. VÉRIFICATION FONCTIONNALITÉS CLÉS
-- ===========================================

SELECT '🔧 VÉRIFICATION FONCTIONNALITÉS CLÉS' as test_section;

-- Test recherche utilisateurs (AdminUsers searchTerm)
SELECT 
  '🔍 Fonctionnalité recherche utilisateurs' as feature_test,
  count(*) as total_searchable_users,
  count(CASE WHEN u.email ILIKE '%gmail%' THEN 1 END) as gmail_users,
  count(CASE WHEN hp.full_name IS NOT NULL THEN 1 END) as users_with_names,
  CASE 
    WHEN count(*) >= 5 
    THEN '✅ Recherche sera utile avec ' || count(*) || ' utilisateurs'
    ELSE '⚠️ Peu d utilisateurs pour la recherche'
  END as search_functionality_impact
FROM auth.users u
LEFT JOIN host_profiles hp ON hp.id = u.id;

-- Test filtrage par rôle (AdminUsers userRole filter)
SELECT 
  '👨‍💼 Fonctionnalité filtrage par rôle' as feature_test,
  count(CASE WHEN au.role = 'admin' THEN 1 END) as admin_users,
  count(CASE WHEN au.role = 'super_admin' THEN 1 END) as super_admin_users,
  count(CASE WHEN au.role IS NULL THEN 1 END) as regular_users,
  CASE 
    WHEN count(CASE WHEN au.role IS NOT NULL THEN 1 END) > 0
    THEN '✅ Filtrage par rôle fonctionnel'
    ELSE '⚠️ Tous les utilisateurs sont réguliers'
  END as role_filter_functionality
FROM auth.users u
LEFT JOIN admin_users au ON au.user_id = u.id;

-- ===========================================
-- 7. RÉSUMÉ INTERFACE ADMIN
-- ===========================================

SELECT '🏁 RÉSUMÉ INTERFACE ADMIN' as final_section;

WITH interface_readiness AS (
  SELECT 
    -- Données disponibles
    CASE WHEN (SELECT count(*) FROM auth.users) >= 1 THEN 1 ELSE 0 END +
    CASE WHEN (SELECT count(*) FROM properties) >= 1 THEN 1 ELSE 0 END +
    CASE WHEN (SELECT count(*) FROM bookings) >= 1 THEN 1 ELSE 0 END as data_score,
    -- Fonctions disponibles
    CASE WHEN EXISTS (SELECT 1 FROM information_schema.routines WHERE routine_name = 'get_users_for_admin') THEN 1 ELSE 0 END +
    CASE WHEN EXISTS (SELECT 1 FROM information_schema.views WHERE table_name = 'profiles') THEN 1 ELSE 0 END +
    CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'bookings' AND column_name = 'total_amount') THEN 1 ELSE 0 END as functions_score
)
SELECT 
  'Interface Admin Readiness' as assessment,
  data_score || '/3 données' as data_readiness,
  functions_score || '/3 fonctions' as functions_readiness,
  (data_score + functions_score) || '/6 total' as total_score,
  CASE 
    WHEN (data_score + functions_score) = 6 THEN '✅ INTERFACE PARFAITEMENT PRÊTE'
    WHEN (data_score + functions_score) >= 4 THEN '⚠️ INTERFACE UTILISABLE (quelques limitations)'
    WHEN (data_score + functions_score) >= 2 THEN '❌ INTERFACE PROBLÉMATIQUE'
    ELSE '🚨 INTERFACE NON FONCTIONNELLE'
  END as interface_status,
  CASE 
    WHEN (data_score + functions_score) = 6 THEN 'Vous pouvez utiliser l interface admin maintenant'
    WHEN (data_score + functions_score) >= 4 THEN 'Interface utilisable mais améliorations recommandées'
    WHEN (data_score + functions_score) >= 2 THEN 'Appliquez solution-parfaite-finale.sql'
    ELSE 'Corrigez les problèmes critiques avant utilisation'
  END as recommendation
FROM interface_readiness;

SELECT '==========================================';
SELECT 'TESTS INTERFACE ADMIN TERMINÉS';
SELECT 'L interface admin peut maintenant être testée avec ces données réelles';
SELECT '==========================================';
