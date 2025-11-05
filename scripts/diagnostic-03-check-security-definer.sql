-- ============================================================
-- ÉTAPE 3 : DIAGNOSTIC - Vérifier SECURITY DEFINER sur les vues
-- ============================================================
-- Ce script identifie les vues créées avec SECURITY DEFINER

-- 3.1 Vérifier les fonctions avec SECURITY DEFINER
SELECT 
    n.nspname as schema_name,
    p.proname as function_name,
    pg_get_functiondef(p.oid) as definition
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.prosecdef = true  -- SECURITY DEFINER
ORDER BY p.proname;

-- 3.2 Vérifier les vues et leurs propriétés de sécurité
-- Note: PostgreSQL stocke SECURITY DEFINER différemment pour les vues
-- Il faut vérifier via pg_get_viewdef et les options
SELECT 
    c.relname as view_name,
    n.nspname as schema_name,
    CASE 
        WHEN c.reloptions IS NOT NULL 
        THEN array_to_string(c.reloptions, ', ')
        ELSE 'No special options'
    END as view_options,
    -- La définition complète pour voir si SECURITY DEFINER est mentionné
    substring(pg_get_viewdef(c.oid, true) from 1 for 200) as view_def_preview
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE c.relkind = 'v'
  AND n.nspname = 'public'
  AND c.relname IN ('profiles', 'v_guest_submissions', 'v_booking_health')
ORDER BY c.relname;

-- 3.3 Vérifier les dépendances des vues problématiques
SELECT 
    dependent_ns.nspname as dependent_schema,
    dependent_view.relname as dependent_view,
    source_ns.nspname as source_schema,
    source_table.relname as source_table,
    pg_describe_object(d.classid, d.objid, d.objsubid) as dependency_description
FROM pg_depend d
JOIN pg_rewrite r ON d.objid = r.oid
JOIN pg_class dependent_view ON r.ev_class = dependent_view.oid
JOIN pg_class source_table ON d.refobjid = source_table.oid
JOIN pg_namespace dependent_ns ON dependent_ns.oid = dependent_view.relnamespace
JOIN pg_namespace source_ns ON source_ns.oid = source_table.relnamespace
WHERE dependent_view.relkind = 'v'
  AND dependent_ns.nspname = 'public'
  AND dependent_view.relname IN ('profiles', 'v_guest_submissions', 'v_booking_health')
  AND source_table.relname IN ('users', 'auth.users');

-- ============================================================
-- RÉSUMÉ ÉTAPE 3
-- ============================================================
SELECT 
    'ÉTAPE 3 : Vues SECURITY DEFINER' as etape,
    c.relname as view_name,
    '⚠️ À VÉRIFIER' as status,
    CASE 
        WHEN pg_get_viewdef(c.oid, true) LIKE '%auth%users%' 
        THEN 'EXPOSE auth.users'
        ELSE 'Autre problème'
    END as detail
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE c.relkind = 'v'
  AND n.nspname = 'public'
  AND c.relname IN ('profiles', 'v_guest_submissions', 'v_booking_health')
ORDER BY c.relname;

