-- ============================================================
-- ÉTAPE 1 : DIAGNOSTIC - Vérifier les vues problématiques
-- ============================================================
-- Ce script identifie les vues qui exposent auth.users ou utilisent SECURITY DEFINER
-- EXÉCUTER CHAQUE SECTION SÉPARÉMENT si vous avez des erreurs

-- 1.1 Vérifier si la vue 'profiles' existe et son contenu
SELECT 
    v.schemaname,
    v.viewname,
    v.definition,
    CASE 
        WHEN v.definition LIKE '%auth.users%' OR v.definition LIKE '%auth_users%' 
        THEN '⚠️ EXPOSE auth.users'
        ELSE '✅ Sécurisée'
    END as security_status
FROM pg_views v
WHERE v.schemaname = 'public' 
  AND v.viewname = 'profiles';

-- 1.2 Vérifier les permissions sur la vue profiles
SELECT 
    tp.grantee,
    tp.privilege_type,
    tp.is_grantable
FROM information_schema.table_privileges tp
WHERE tp.table_schema = 'public' 
  AND tp.table_name = 'profiles';

-- 1.3 Vérifier toutes les vues avec SECURITY DEFINER
SELECT 
    n.nspname as schema_name,
    c.relname as view_name,
    CASE 
        WHEN c.relkind = 'v' THEN 'view'
        WHEN c.relkind = 'm' THEN 'materialized view'
        ELSE 'other'
    END as view_type,
    pg_get_viewdef(c.oid, true) as view_definition
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE c.relkind IN ('v', 'm')
  AND n.nspname = 'public'
  AND c.relname IN ('profiles', 'v_guest_submissions', 'v_booking_health')
ORDER BY c.relname;

-- 1.4 Vérifier les options de sécurité des vues (PostgreSQL 15+)
SELECT 
    n.nspname as schema_name,
    c.relname as view_name,
    (
        SELECT array_agg(opt.option_name || '=' || opt.option_value)
        FROM pg_options_to_table(c.reloptions) opt
    ) as view_options
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE c.relkind = 'v'
  AND n.nspname = 'public'
  AND c.relname IN ('profiles', 'v_guest_submissions', 'v_booking_health')
ORDER BY c.relname;

-- ============================================================
-- RÉSUMÉ ÉTAPE 1
-- ============================================================
SELECT 
    'ÉTAPE 1 : Diagnostic des vues' as etape,
    COUNT(*) FILTER (WHERE v.viewname = 'profiles') as vue_profiles_exists,
    COUNT(*) FILTER (WHERE v.viewname IN ('v_guest_submissions', 'v_booking_health')) as autres_vues_problematiques
FROM pg_views v
WHERE v.schemaname = 'public' 
  AND v.viewname IN ('profiles', 'v_guest_submissions', 'v_booking_health');
