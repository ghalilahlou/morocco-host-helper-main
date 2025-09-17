-- ==========================================
-- ANALYSE TOKENS ET LOGIQUE D'ANALYTICS
-- Morocco Host Helper Platform
-- ==========================================

SELECT '🪙 ANALYSE TOKENS ET ANALYTICS' as section;
SELECT '====================================' as separator;

-- ===========================================
-- 1. STRUCTURE SYSTÈME DE TOKENS
-- ===========================================

SELECT '🔍 STRUCTURE SYSTÈME TOKENS' as analysis_section;

-- 1.1 Vérification table token_allocations
SELECT 
  'Table token_allocations' as table_check,
  CASE 
    WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'token_allocations')
    THEN '✅ Table token_allocations existe'
    ELSE '❌ Table token_allocations manquante'
  END as table_status;

-- 1.2 Structure colonnes token_allocations
SELECT 
  'Colonnes token_allocations' as structure_check,
  column_name,
  data_type,
  is_nullable,
  CASE 
    WHEN column_name IN ('user_id', 'tokens_allocated', 'tokens_used', 'tokens_remaining', 'is_active')
    THEN '✅ Colonne critique'
    ELSE 'ℹ️ Colonne additionnelle'
  END as importance
FROM information_schema.columns 
WHERE table_name = 'token_allocations' 
  AND table_schema = 'public'
ORDER BY ordinal_position;

-- 1.3 Données actuelles tokens
SELECT 
  'Allocations tokens actuelles' as current_tokens,
  count(*) as total_allocations,
  count(CASE WHEN is_active = true THEN 1 END) as active_allocations,
  sum(tokens_allocated) as total_tokens_allocated,
  sum(tokens_used) as total_tokens_used,
  sum(tokens_remaining) as total_tokens_remaining,
  CASE 
    WHEN count(*) > 0 
    THEN '✅ ' || count(*) || ' allocations configurées'
    ELSE '⚠️ Aucune allocation de tokens'
  END as allocation_status
FROM token_allocations;

-- ===========================================
-- 2. LOGIQUE ALLOCATION DE TOKENS
-- ===========================================

SELECT '⚙️ LOGIQUE ALLOCATION TOKENS' as analysis_section;

-- 2.1 Allocations par utilisateur
SELECT 
  'Allocations par utilisateur' as allocation_analysis,
  ta.user_id,
  au.email,
  ta.tokens_allocated,
  ta.tokens_used,
  ta.tokens_remaining,
  ta.is_active,
  ta.created_at,
  CASE 
    WHEN ta.tokens_remaining > 0 AND ta.is_active 
    THEN '✅ Tokens disponibles'
    WHEN ta.tokens_remaining = 0 AND ta.is_active
    THEN '⚠️ Tokens épuisés'
    WHEN NOT ta.is_active
    THEN '❌ Allocation inactive'
    ELSE '🔍 État indéterminé'
  END as token_status
FROM token_allocations ta
LEFT JOIN auth.users au ON au.id = ta.user_id
ORDER BY ta.created_at DESC
LIMIT 10;

-- 2.2 Vérification cohérence calculs tokens
SELECT 
  'Cohérence calculs tokens' as consistency_check,
  ta.user_id,
  ta.tokens_allocated,
  ta.tokens_used,
  ta.tokens_remaining,
  ta.tokens_allocated - ta.tokens_used as calculated_remaining,
  CASE 
    WHEN ta.tokens_remaining = (ta.tokens_allocated - ta.tokens_used)
    THEN '✅ Calcul cohérent'
    ELSE '❌ Incohérence: ' || ta.tokens_remaining || ' ≠ ' || (ta.tokens_allocated - ta.tokens_used)
  END as calculation_status
FROM token_allocations ta
WHERE ta.tokens_allocated IS NOT NULL 
  AND ta.tokens_used IS NOT NULL 
  AND ta.tokens_remaining IS NOT NULL;

-- ===========================================
-- 3. UTILISATION DES TOKENS
-- ===========================================

SELECT '📊 UTILISATION TOKENS' as analysis_section;

-- 3.1 Statistiques utilisation
WITH token_stats AS (
  SELECT 
    ta.user_id,
    ta.tokens_allocated,
    ta.tokens_used,
    ta.tokens_remaining,
    CASE 
      WHEN ta.tokens_allocated > 0 
      THEN ROUND((ta.tokens_used * 100.0 / ta.tokens_allocated), 2)
      ELSE 0 
    END as usage_percentage
  FROM token_allocations ta
  WHERE ta.is_active = true
)
SELECT 
  'Statistiques utilisation tokens' as usage_stats,
  count(*) as active_users,
  ROUND(avg(usage_percentage), 2) as avg_usage_percentage,
  count(CASE WHEN usage_percentage > 80 THEN 1 END) as heavy_users,
  count(CASE WHEN usage_percentage = 0 THEN 1 END) as unused_allocations,
  CASE 
    WHEN avg(usage_percentage) > 50 
    THEN '✅ Utilisation active des tokens'
    WHEN avg(usage_percentage) > 20
    THEN '⚠️ Utilisation modérée des tokens'
    ELSE '🔍 Faible utilisation des tokens'
  END as usage_assessment
FROM token_stats;

-- 3.2 Top utilisateurs de tokens
SELECT 
  'Top utilisateurs tokens' as top_users,
  au.email,
  ta.tokens_used,
  ta.tokens_allocated,
  ROUND((ta.tokens_used * 100.0 / NULLIF(ta.tokens_allocated, 0)), 2) as usage_percentage,
  CASE 
    WHEN ta.tokens_used > ta.tokens_allocated * 0.8 THEN '🔴 Utilisation élevée'
    WHEN ta.tokens_used > ta.tokens_allocated * 0.5 THEN '🟡 Utilisation modérée'
    ELSE '🟢 Utilisation faible'
  END as usage_level
FROM token_allocations ta
JOIN auth.users au ON au.id = ta.user_id
WHERE ta.is_active = true AND ta.tokens_used > 0
ORDER BY ta.tokens_used DESC
LIMIT 5;

-- ===========================================
-- 4. LOGIQUE ANALYTICS INTERFACE ADMIN
-- ===========================================

SELECT '📈 LOGIQUE ANALYTICS ADMIN' as analysis_section;

-- 4.1 Données pour AdminAnalytics.tsx
WITH analytics_data AS (
  SELECT 
    -- Données utilisateurs
    (SELECT count(*) FROM auth.users) as total_users,
    (SELECT count(*) FROM auth.users WHERE created_at > (now() - interval '30 days')) as new_users_month,
    -- Données propriétés
    (SELECT count(*) FROM properties) as total_properties,
    (SELECT count(*) FROM properties WHERE user_id IS NOT NULL) as active_properties,
    -- Données réservations
    (SELECT count(*) FROM bookings) as total_bookings,
    (SELECT count(*) FROM bookings WHERE created_at > (now() - interval '30 days')) as new_bookings_month,
    (SELECT COALESCE(sum(total_amount), 0) FROM bookings) as total_revenue,
    (SELECT COALESCE(sum(total_amount), 0) FROM bookings WHERE created_at > (now() - interval '30 days')) as revenue_month,
    -- Données tokens
    (SELECT COALESCE(sum(tokens_allocated), 0) FROM token_allocations WHERE is_active = true) as total_tokens_allocated,
    (SELECT COALESCE(sum(tokens_used), 0) FROM token_allocations WHERE is_active = true) as total_tokens_used
)
SELECT 
  'Données Analytics Dashboard' as analytics_component,
  'Utilisateurs: ' || total_users || ' (nouveaux: +' || new_users_month || ')' as users_analytics,
  'Propriétés: ' || total_properties || ' (actives: ' || active_properties || ')' as properties_analytics,
  'Réservations: ' || total_bookings || ' (nouvelles: +' || new_bookings_month || ')' as bookings_analytics,
  'Revenue: ' || total_revenue || '€ (mois: +' || revenue_month || '€)' as revenue_analytics,
  'Tokens: ' || total_tokens_used || '/' || total_tokens_allocated || ' utilisés' as tokens_analytics,
  CASE 
    WHEN total_users > 0 AND total_properties > 0 AND total_bookings > 0
    THEN '✅ Analytics complètes disponibles'
    WHEN total_users > 0 AND total_properties > 0
    THEN '⚠️ Analytics partielles (sans réservations)'
    ELSE '❌ Analytics limitées'
  END as analytics_completeness
FROM analytics_data;

-- 4.2 Évolution temporelle (derniers 6 mois)
SELECT 
  'Évolution derniers 6 mois' as time_analysis,
  date_trunc('month', created_at) as month,
  count(*) as new_items,
  'users' as item_type
FROM auth.users 
WHERE created_at > (now() - interval '6 months')
GROUP BY date_trunc('month', created_at)
UNION ALL
SELECT 
  'Évolution derniers 6 mois' as time_analysis,
  date_trunc('month', created_at) as month,
  count(*) as new_items,
  'bookings' as item_type
FROM bookings 
WHERE created_at > (now() - interval '6 months')
GROUP BY date_trunc('month', created_at)
ORDER BY month DESC, item_type;

-- ===========================================
-- 5. MÉTRIQUES BUSINESS INTELLIGENCE
-- ===========================================

SELECT '🎯 MÉTRIQUES BUSINESS INTELLIGENCE' as analysis_section;

-- 5.1 KPIs principaux
WITH business_kpis AS (
  SELECT 
    -- Taux de conversion propriétaire
    ROUND(
      (SELECT count(DISTINCT user_id) FROM properties WHERE user_id IS NOT NULL) * 100.0 / 
      NULLIF((SELECT count(*) FROM auth.users), 0), 2
    ) as property_owner_rate,
    -- Taux de réservation par propriété
    ROUND(
      (SELECT count(*) FROM bookings) * 1.0 / 
      NULLIF((SELECT count(*) FROM properties), 0), 2
    ) as bookings_per_property,
    -- Revenue moyen par réservation
    ROUND(
      (SELECT COALESCE(avg(total_amount), 0) FROM bookings WHERE total_amount > 0), 2
    ) as avg_booking_amount,
    -- Taux d'utilisation tokens
    ROUND(
      (SELECT COALESCE(sum(tokens_used), 0) FROM token_allocations WHERE is_active = true) * 100.0 / 
      NULLIF((SELECT COALESCE(sum(tokens_allocated), 0) FROM token_allocations WHERE is_active = true), 0), 2
    ) as token_usage_rate
)
SELECT 
  'KPIs Business Intelligence' as kpi_analysis,
  property_owner_rate || '% des utilisateurs sont propriétaires' as conversion_rate,
  bookings_per_property || ' réservations par propriété' as booking_efficiency,
  avg_booking_amount || '€ revenue moyen par réservation' as revenue_efficiency,
  token_usage_rate || '% des tokens alloués utilisés' as token_efficiency,
  CASE 
    WHEN property_owner_rate > 10 AND bookings_per_property > 1 AND token_usage_rate > 20
    THEN '✅ Métriques business saines'
    WHEN property_owner_rate > 5 OR bookings_per_property > 0.5
    THEN '⚠️ Métriques business en développement'
    ELSE '🔍 Métriques business faibles'
  END as business_health
FROM business_kpis;

-- 5.2 Analyse cohorts utilisateurs
SELECT 
  'Analyse cohorts utilisateurs' as cohort_analysis,
  date_trunc('month', au.created_at) as registration_month,
  count(*) as users_registered,
  count(CASE WHEN p.user_id IS NOT NULL THEN 1 END) as became_owners,
  count(CASE WHEN b.property_id IS NOT NULL THEN 1 END) as made_bookings,
  ROUND(
    count(CASE WHEN p.user_id IS NOT NULL THEN 1 END) * 100.0 / count(*), 2
  ) as owner_conversion_rate
FROM auth.users au
LEFT JOIN properties p ON p.user_id = au.id
LEFT JOIN bookings b ON b.property_id = p.id
WHERE au.created_at > (now() - interval '12 months')
GROUP BY date_trunc('month', au.created_at)
ORDER BY registration_month DESC
LIMIT 6;

-- ===========================================
-- 6. TESTS PERFORMANCE ANALYTICS
-- ===========================================

SELECT '⚡ TESTS PERFORMANCE ANALYTICS' as analysis_section;

-- Test performance requêtes analytics
DO $$
DECLARE
    start_time TIMESTAMP;
    execution_time INTERVAL;
    result_count INTEGER;
BEGIN
    -- Test 1: Requête dashboard stats
    start_time := clock_timestamp();
    
    SELECT count(*) INTO result_count
    FROM (
        SELECT count(*) FROM auth.users
        UNION ALL
        SELECT count(*) FROM properties  
        UNION ALL
        SELECT count(*) FROM bookings
        UNION ALL
        SELECT count(*) FROM token_allocations
    ) stats;
    
    execution_time := clock_timestamp() - start_time;
    
    RAISE NOTICE '📊 PERFORMANCE Analytics Dashboard:';
    RAISE NOTICE '   ⏱️ Temps stats principales: %', execution_time;
    
    -- Test 2: Requête analytics avancées
    start_time := clock_timestamp();
    
    SELECT count(*) INTO result_count
    FROM auth.users au
    LEFT JOIN properties p ON p.user_id = au.id
    LEFT JOIN bookings b ON b.property_id = p.id
    LEFT JOIN token_allocations ta ON ta.user_id = au.id;
    
    execution_time := clock_timestamp() - start_time;
    
    RAISE NOTICE '   ⏱️ Temps analytics avancées: %', execution_time;
    
    IF execution_time < interval '2 seconds' THEN
        RAISE NOTICE '   ✅ Performance analytics acceptable';
    ELSE
        RAISE NOTICE '   ⚠️ Performance analytics à optimiser';
    END IF;
END $$;

-- ===========================================
-- 7. RECOMMANDATIONS TOKENS ET ANALYTICS
-- ===========================================

SELECT '💡 RECOMMANDATIONS TOKENS ET ANALYTICS' as analysis_section;

WITH recommendations AS (
  SELECT 
    (SELECT count(*) FROM token_allocations) as token_allocations_count,
    (SELECT count(*) FROM token_allocations WHERE is_active = true) as active_allocations,
    (SELECT COALESCE(avg(tokens_used * 100.0 / NULLIF(tokens_allocated, 0)), 0) FROM token_allocations WHERE is_active = true) as avg_usage_rate,
    (SELECT count(*) FROM auth.users) as total_users,
    (SELECT count(*) FROM properties) as total_properties,
    (SELECT count(*) FROM bookings) as total_bookings
)
SELECT 
  'Recommandations Tokens' as recommendation_type,
  CASE 
    WHEN token_allocations_count = 0 
    THEN '🔧 Configurer des allocations de tokens initiales'
    WHEN avg_usage_rate < 20
    THEN '📈 Promouvoir l''utilisation des tokens (usage: ' || ROUND(avg_usage_rate, 1) || '%)'
    WHEN avg_usage_rate > 80
    THEN '⚡ Augmenter les allocations (usage élevé: ' || ROUND(avg_usage_rate, 1) || '%)'
    ELSE '✅ Système tokens bien équilibré'
  END as token_recommendation,
  CASE 
    WHEN total_users > 10 AND total_properties > 5 AND total_bookings > 3
    THEN '✅ Analytics riches - dashboard complet possible'
    WHEN total_users > 5 AND total_properties > 2
    THEN '⚠️ Analytics partielles - dashboard basique'
    ELSE '🔧 Besoin de plus de données pour analytics significatives'
  END as analytics_recommendation
FROM recommendations;

-- ===========================================
-- 8. RÉSUMÉ TOKENS ET ANALYTICS
-- ===========================================

SELECT '🏁 RÉSUMÉ TOKENS ET ANALYTICS' as final_section;

WITH tokens_analytics_summary AS (
  SELECT 
    CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'token_allocations') THEN 1 ELSE 0 END as has_token_table,
    (SELECT count(*) FROM token_allocations) as token_allocations,
    (SELECT COALESCE(sum(tokens_used), 0) FROM token_allocations WHERE is_active = true) as tokens_used,
    (SELECT count(*) FROM auth.users) as users_for_analytics,
    (SELECT count(*) FROM bookings) as bookings_for_analytics,
    (SELECT COALESCE(sum(total_amount), 0) FROM bookings) as revenue_for_analytics
)
SELECT 
  'TOKENS ET ANALYTICS' as summary_type,
  CASE 
    WHEN has_token_table = 1 AND token_allocations > 0
    THEN '✅ Système tokens opérationnel (' || token_allocations || ' allocations)'
    WHEN has_token_table = 1
    THEN '⚠️ Système tokens configuré mais vide'
    ELSE '❌ Système tokens non configuré'
  END as token_system_status,
  CASE 
    WHEN users_for_analytics > 0 AND bookings_for_analytics > 0
    THEN '✅ Analytics riches (' || users_for_analytics || ' users, ' || bookings_for_analytics || ' bookings)'
    WHEN users_for_analytics > 0
    THEN '⚠️ Analytics basiques (' || users_for_analytics || ' users seulement)'
    ELSE '❌ Données insuffisantes pour analytics'
  END as analytics_status,
  CASE 
    WHEN has_token_table = 1 AND token_allocations > 0 AND users_for_analytics > 0
    THEN 'Interface admin peut afficher tokens et analytics complets'
    WHEN has_token_table = 1 AND users_for_analytics > 0
    THEN 'Interface admin peut afficher analytics basiques'
    ELSE 'Interface admin limitée - configuration tokens recommandée'
  END as admin_interface_capability
FROM tokens_analytics_summary;

SELECT '====================================' as separator;
SELECT 'ANALYSE TOKENS ET ANALYTICS TERMINÉE' as completion;
