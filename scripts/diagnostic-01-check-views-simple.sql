-- ============================================================
-- DIAGNOSTIC SIMPLIFIÉ - Vues problématiques
-- ============================================================
-- Version simplifiée sans ambiguïté de colonnes

-- 1. Vérifier si la vue 'profiles' existe
SELECT 
    'Vue profiles' as check_type,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM pg_views 
            WHERE schemaname = 'public' AND viewname = 'profiles'
        ) 
        THEN 'EXISTE ⚠️'
        ELSE 'N''EXISTE PAS ✅'
    END as status;

-- 2. Détails de la vue profiles (si elle existe)
SELECT 
    viewname,
    substring(definition, 1, 200) as definition_preview,
    CASE 
        WHEN definition LIKE '%auth.users%' OR definition LIKE '%auth_users%' 
        THEN '⚠️ EXPOSE auth.users'
        ELSE 'Vérifier manuellement'
    END as security_warning
FROM pg_views 
WHERE schemaname = 'public' AND viewname = 'profiles';

-- 3. Vérifier v_guest_submissions
SELECT 
    'Vue v_guest_submissions' as check_type,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM pg_views 
            WHERE schemaname = 'public' AND viewname = 'v_guest_submissions'
        ) 
        THEN 'EXISTE'
        ELSE 'N''EXISTE PAS'
    END as status;

-- 4. Vérifier v_booking_health
SELECT 
    'Vue v_booking_health' as check_type,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM pg_views 
            WHERE schemaname = 'public' AND viewname = 'v_booking_health'
        ) 
        THEN 'EXISTE'
        ELSE 'N''EXISTE PAS'
    END as status;

-- 5. RÉSUMÉ FINAL
SELECT 
    'RÉSUMÉ' as section,
    COUNT(*) FILTER (WHERE viewname = 'profiles') as vue_profiles_count,
    COUNT(*) FILTER (WHERE viewname = 'v_guest_submissions') as vue_guest_submissions_count,
    COUNT(*) FILTER (WHERE viewname = 'v_booking_health') as vue_booking_health_count
FROM pg_views 
WHERE schemaname = 'public' 
  AND viewname IN ('profiles', 'v_guest_submissions', 'v_booking_health');

