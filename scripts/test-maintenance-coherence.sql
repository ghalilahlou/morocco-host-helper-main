-- ==========================================
-- TESTS MAINTENANCE ET COHÉRENCE GLOBALE
-- Morocco Host Helper Platform
-- ==========================================

SELECT '🔧 TESTS MAINTENANCE ET COHÉRENCE' as section;
SELECT '=====================================' as separator;

-- ===========================================
-- 1. TESTS INTÉGRITÉ DONNÉES
-- ===========================================

SELECT '🔒 INTÉGRITÉ DONNÉES' as test_section;

-- 1.1 Contraintes référentielles
SELECT 
  'Contraintes référentielles' as integrity_test,
  table_name,
  constraint_name,
  constraint_type,
  CASE 
    WHEN constraint_type = 'FOREIGN KEY' THEN '🔗 Relation'
    WHEN constraint_type = 'PRIMARY KEY' THEN '🔑 Clé primaire'
    WHEN constraint_type = 'UNIQUE' THEN '🎯 Unicité'
    ELSE '📋 Autre'
  END as constraint_description
FROM information_schema.table_constraints 
WHERE table_schema = 'public' 
  AND table_name IN ('properties', 'bookings', 'host_profiles', 'admin_users', 'token_allocations')
ORDER BY table_name, constraint_type;

-- 1.2 Doublons potentiels
SELECT 
  'Doublons utilisateurs par email' as duplicate_check,
  email,
  count(*) as occurrences,
  CASE 
    WHEN count(*) = 1 THEN '✅ Unique'
    ELSE '❌ Doublon détecté'
  END as uniqueness_status
FROM auth.users 
GROUP BY email 
HAVING count(*) > 1
UNION ALL
SELECT 
  'Tous emails uniques' as duplicate_check,
  'N/A' as email,
  0 as occurrences,
  '✅ Aucun doublon email' as uniqueness_status
WHERE NOT EXISTS (
  SELECT 1 FROM auth.users 
  GROUP BY email 
  HAVING count(*) > 1
);

-- 1.3 Orphelins de données
SELECT 
  'Propriétés orphelines' as orphan_check,
  count(*) as orphan_count,
  CASE 
    WHEN count(*) = 0 THEN '✅ Aucune propriété orpheline'
    ELSE '⚠️ ' || count(*) || ' propriétés sans propriétaire'
  END as orphan_status
FROM properties 
WHERE user_id IS NULL OR user_id NOT IN (SELECT id FROM auth.users);

SELECT 
  'Réservations orphelines' as orphan_check,
  count(*) as orphan_count,
  CASE 
    WHEN count(*) = 0 THEN '✅ Aucune réservation orpheline'
    ELSE '⚠️ ' || count(*) || ' réservations sans propriété'
  END as orphan_status
FROM bookings 
WHERE property_id IS NULL OR property_id NOT IN (SELECT id FROM properties);

-- ===========================================
-- 2. TESTS PERFORMANCE SYSTÈME
-- ===========================================

SELECT '⚡ PERFORMANCE SYSTÈME' as test_section;

-- 2.1 Test performance requêtes critiques
DO $$
DECLARE
    start_time TIMESTAMP;
    execution_time INTERVAL;
    query_name TEXT;
BEGIN
    -- Test 1: get_users_for_admin
    query_name := 'get_users_for_admin()';
    start_time := clock_timestamp();
    PERFORM public.get_users_for_admin();
    execution_time := clock_timestamp() - start_time;
    
    RAISE NOTICE '⚡ PERFORMANCE %:', query_name;
    RAISE NOTICE '   ⏱️ Temps: %', execution_time;
    
    IF execution_time < interval '2 seconds' THEN
        RAISE NOTICE '   ✅ Performance excellente';
    ELSIF execution_time < interval '5 seconds' THEN
        RAISE NOTICE '   ⚠️ Performance acceptable';
    ELSE
        RAISE NOTICE '   ❌ Performance lente - optimisation nécessaire';
    END IF;
    
    -- Test 2: Jointure complexe users + properties + bookings
    query_name := 'Jointure complexe users+properties+bookings';
    start_time := clock_timestamp();
    
    PERFORM count(*)
    FROM auth.users au
    LEFT JOIN host_profiles hp ON hp.id = au.id
    LEFT JOIN properties p ON p.user_id = au.id
    LEFT JOIN bookings b ON b.property_id = p.id;
    
    execution_time := clock_timestamp() - start_time;
    
    RAISE NOTICE '⚡ PERFORMANCE %:', query_name;
    RAISE NOTICE '   ⏱️ Temps: %', execution_time;
    
    IF execution_time < interval '3 seconds' THEN
        RAISE NOTICE '   ✅ Performance acceptable pour jointures complexes';
    ELSE
        RAISE NOTICE '   ⚠️ Performance lente - indexation recommandée';
    END IF;
END $$;

-- 2.2 Taille des tables
SELECT 
  'Taille tables principales' as size_analysis,
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as table_size,
  pg_total_relation_size(schemaname||'.'||tablename) as size_bytes
FROM pg_tables 
WHERE schemaname = 'public' 
  AND tablename IN ('properties', 'bookings', 'host_profiles', 'admin_users', 'token_allocations')
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

-- ===========================================
-- 3. TESTS COHÉRENCE MÉTIER
-- ===========================================

SELECT '💼 COHÉRENCE MÉTIER' as test_section;

-- 3.1 Cohérence business rules
SELECT 
  'Réservations avec montants négatifs' as business_rule,
  count(*) as violations,
  CASE 
    WHEN count(*) = 0 THEN '✅ Aucun montant négatif'
    ELSE '❌ ' || count(*) || ' montants négatifs détectés'
  END as rule_status
FROM bookings 
WHERE total_amount < 0;

SELECT 
  'Réservations avec dates incohérentes' as business_rule,
  count(*) as violations,
  CASE 
    WHEN count(*) = 0 THEN '✅ Toutes les dates cohérentes'
    ELSE '❌ ' || count(*) || ' dates incohérentes'
  END as rule_status
FROM bookings 
WHERE check_out_date <= check_in_date;

SELECT 
  'Propriétés sans nom' as business_rule,
  count(*) as violations,
  CASE 
    WHEN count(*) = 0 THEN '✅ Toutes les propriétés nommées'
    ELSE '⚠️ ' || count(*) || ' propriétés sans nom'
  END as rule_status
FROM properties 
WHERE name IS NULL OR trim(name) = '';

-- 3.2 Cohérence allocations tokens
SELECT 
  'Allocations tokens incohérentes' as business_rule,
  count(*) as violations,
  CASE 
    WHEN count(*) = 0 THEN '✅ Calculs tokens cohérents'
    ELSE '❌ ' || count(*) || ' calculs tokens incorrects'
  END as rule_status
FROM token_allocations 
WHERE tokens_remaining != (tokens_allocated - tokens_used)
  AND tokens_allocated IS NOT NULL 
  AND tokens_used IS NOT NULL 
  AND tokens_remaining IS NOT NULL;

-- ===========================================
-- 4. TESTS SÉCURITÉ
-- ===========================================

SELECT '🔐 TESTS SÉCURITÉ' as test_section;

-- 4.1 Politiques RLS actives
SELECT 
  'Politiques RLS par table' as security_test,
  tablename,
  count(*) as nb_policies,
  CASE 
    WHEN count(*) >= 2 THEN '✅ Bien sécurisée'
    WHEN count(*) = 1 THEN '⚠️ Sécurité partielle'
    ELSE '❌ Non sécurisée'
  END as security_level
FROM pg_policies 
WHERE schemaname = 'public'
  AND tablename IN ('properties', 'bookings', 'admin_users', 'token_allocations')
GROUP BY tablename
ORDER BY count(*) DESC;

-- 4.2 Fonctions avec SECURITY DEFINER
SELECT 
  'Fonctions sécurisées' as security_test,
  routine_name,
  security_type,
  CASE 
    WHEN security_type = 'DEFINER' THEN '✅ Sécurisée'
    ELSE '⚠️ Non sécurisée'
  END as security_status
FROM information_schema.routines 
WHERE routine_schema = 'public'
  AND routine_name LIKE '%admin%'
ORDER BY routine_name;

-- ===========================================
-- 5. TESTS MAINTENABILITÉ
-- ===========================================

SELECT '🔧 MAINTENABILITÉ' as test_section;

-- 5.1 Documentation fonctions
SELECT 
  'Documentation fonctions critiques' as maintainability_test,
  routine_name,
  CASE 
    WHEN routine_definition LIKE '%---%' OR routine_definition LIKE '%/*%*/%'
    THEN '✅ Documentée'
    ELSE '⚠️ Documentation recommandée'
  END as documentation_status
FROM information_schema.routines 
WHERE routine_schema = 'public'
  AND routine_name IN ('get_users_for_admin', 'get_all_users_for_admin', 'get_dashboard_stats_real')
ORDER BY routine_name;

-- 5.2 Conventions de nommage
SELECT 
  'Conventions nommage tables' as naming_convention,
  table_name,
  CASE 
    WHEN table_name ~ '^[a-z_]+$' THEN '✅ Convention respectée'
    ELSE '⚠️ Convention non standard'
  END as naming_status
FROM information_schema.tables 
WHERE table_schema = 'public'
  AND table_name IN ('properties', 'bookings', 'host_profiles', 'admin_users', 'token_allocations')
ORDER BY table_name;

-- ===========================================
-- 6. TESTS MONITORING
-- ===========================================

SELECT '📊 MONITORING' as test_section;

-- 6.1 Métriques de santé système
WITH system_health AS (
  SELECT 
    (SELECT count(*) FROM auth.users) as total_users,
    (SELECT count(*) FROM properties) as total_properties,
    (SELECT count(*) FROM bookings) as total_bookings,
    (SELECT count(*) FROM admin_users WHERE is_active = true) as active_admins,
    (SELECT count(*) FROM token_allocations WHERE is_active = true) as active_token_allocations,
    -- Activité récente (dernières 24h)
    (SELECT count(*) FROM auth.users WHERE created_at > now() - interval '24 hours') as new_users_24h,
    (SELECT count(*) FROM bookings WHERE created_at > now() - interval '24 hours') as new_bookings_24h
)
SELECT 
  'Métriques santé système' as health_metrics,
  total_users || ' users (' || new_users_24h || ' nouveaux 24h)' as users_metric,
  total_properties || ' propriétés' as properties_metric,
  total_bookings || ' réservations (' || new_bookings_24h || ' nouvelles 24h)' as bookings_metric,
  active_admins || ' admins actifs' as admins_metric,
  active_token_allocations || ' allocations tokens actives' as tokens_metric,
  CASE 
    WHEN total_users > 0 AND total_properties > 0 AND active_admins > 0
    THEN '✅ Système en bonne santé'
    WHEN total_users > 0 AND active_admins > 0
    THEN '⚠️ Système fonctionnel mais peu de données'
    ELSE '❌ Système nécessite attention'
  END as overall_health
FROM system_health;

-- ===========================================
-- 7. RECOMMANDATIONS MAINTENANCE
-- ===========================================

SELECT '💡 RECOMMANDATIONS MAINTENANCE' as recommendations_section;

WITH maintenance_analysis AS (
  SELECT 
    -- Performance
    CASE WHEN EXISTS (SELECT 1 FROM pg_stat_user_tables WHERE n_tup_ins + n_tup_upd + n_tup_del > 1000) THEN 1 ELSE 0 END as needs_vacuum,
    -- Sécurité
    (SELECT count(*) FROM pg_policies WHERE schemaname = 'public') as total_policies,
    -- Données
    (SELECT count(*) FROM bookings WHERE total_amount IS NULL) as bookings_without_amount,
    -- Fonctions
    (SELECT count(*) FROM information_schema.routines WHERE routine_schema = 'public' AND routine_name LIKE '%admin%') as admin_functions
)
SELECT 
  'Recommandations maintenance' as recommendation_type,
  CASE 
    WHEN needs_vacuum = 1 
    THEN '🔧 VACUUM et ANALYZE recommandés pour optimiser les performances'
    ELSE '✅ Maintenance base OK'
  END as performance_recommendation,
  CASE 
    WHEN total_policies < 5 
    THEN '🔐 Renforcer les politiques RLS pour la sécurité'
    ELSE '✅ Sécurité RLS correcte'
  END as security_recommendation,
  CASE 
    WHEN bookings_without_amount > 0 
    THEN '💰 Mettre à jour les montants manquants: ' || bookings_without_amount || ' réservations'
    ELSE '✅ Données financières complètes'
  END as data_recommendation,
  CASE 
    WHEN admin_functions >= 3 
    THEN '✅ Fonctions admin complètes'
    ELSE '🔧 Compléter les fonctions admin manquantes'
  END as functions_recommendation
FROM maintenance_analysis;

-- ===========================================
-- 8. SCORE GLOBAL SYSTÈME
-- ===========================================

SELECT '🏁 SCORE GLOBAL SYSTÈME' as final_section;

WITH system_score AS (
  SELECT 
    -- Données (25%)
    CASE 
      WHEN (SELECT count(*) FROM auth.users) > 0 AND 
           (SELECT count(*) FROM properties) > 0 AND 
           (SELECT count(*) FROM bookings) > 0 
      THEN 25 ELSE 0 
    END as data_score,
    -- Fonctionnalités (25%)
    CASE 
      WHEN EXISTS (SELECT 1 FROM information_schema.routines WHERE routine_name = 'get_users_for_admin') AND
           EXISTS (SELECT 1 FROM information_schema.views WHERE table_name = 'profiles') AND
           EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'bookings' AND column_name = 'total_amount')
      THEN 25 ELSE 0 
    END as functionality_score,
    -- Sécurité (25%)
    CASE 
      WHEN (SELECT count(*) FROM admin_users WHERE is_active = true) > 0 AND
           (SELECT count(*) FROM pg_policies WHERE schemaname = 'public') >= 3
      THEN 25 ELSE 0 
    END as security_score,
    -- Performance/Maintenance (25%)
    CASE 
      WHEN (SELECT count(*) FROM bookings WHERE total_amount IS NULL) = 0 AND
           (SELECT count(*) FROM properties WHERE user_id IS NULL) = 0
      THEN 25 ELSE 15 
    END as maintenance_score
)
SELECT 
  'SCORE GLOBAL SYSTÈME' as final_assessment,
  (data_score + functionality_score + security_score + maintenance_score) || '/100' as total_score,
  data_score || '/25 Données' as data_component,
  functionality_score || '/25 Fonctionnalités' as functionality_component,
  security_score || '/25 Sécurité' as security_component,
  maintenance_score || '/25 Maintenance' as maintenance_component,
  CASE 
    WHEN (data_score + functionality_score + security_score + maintenance_score) >= 90
    THEN '🌟 EXCELLENT - Système production-ready'
    WHEN (data_score + functionality_score + security_score + maintenance_score) >= 75
    THEN '✅ BON - Système opérationnel'
    WHEN (data_score + functionality_score + security_score + maintenance_score) >= 60
    THEN '⚠️ CORRECT - Améliorations recommandées'
    WHEN (data_score + functionality_score + security_score + maintenance_score) >= 40
    THEN '🔧 MÉDIOCRE - Corrections nécessaires'
    ELSE '🚨 CRITIQUE - Intervention urgente requise'
  END as system_grade,
  CASE 
    WHEN (data_score + functionality_score + security_score + maintenance_score) >= 75
    THEN 'Système prêt pour utilisation en production'
    WHEN (data_score + functionality_score + security_score + maintenance_score) >= 60
    THEN 'Système utilisable avec surveillance'
    ELSE 'Appliquer les corrections avant utilisation'
  END as final_recommendation
FROM system_score;

SELECT '=====================================' as separator;
SELECT 'TESTS MAINTENANCE ET COHÉRENCE TERMINÉS' as completion;
