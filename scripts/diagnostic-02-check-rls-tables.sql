-- ============================================================
-- ÉTAPE 2 : DIAGNOSTIC - Vérifier l'état RLS des tables
-- ============================================================
-- Ce script vérifie quelles tables ont RLS activé et quelles policies existent

-- 2.1 État RLS des tables problématiques
SELECT 
    t.schemaname,
    t.tablename,
    t.rowsecurity as rls_enabled,
    CASE 
        WHEN t.rowsecurity THEN '✅ RLS ACTIVÉ'
        ELSE '❌ RLS DÉSACTIVÉ'
    END as status
FROM pg_tables t
WHERE t.schemaname = 'public'
  AND t.tablename IN ('properties', 'guests', 'guest_submissions', 'generated_documents')
ORDER BY t.tablename;

-- 2.2 Policies existantes par table
SELECT 
    p.schemaname,
    p.tablename,
    p.policyname,
    p.permissive,
    p.roles,
    p.cmd as command_type,
    p.qual as using_expression,
    p.with_check as with_check_expression
FROM pg_policies p
WHERE p.schemaname = 'public'
  AND p.tablename IN ('properties', 'guests', 'guest_submissions', 'generated_documents')
ORDER BY p.tablename, p.policyname;

-- 2.3 Tables avec policies mais RLS désactivé (PROBLÈME)
SELECT 
    t.schemaname,
    t.tablename,
    t.rowsecurity as rls_enabled,
    COUNT(p.policyname) as policies_count,
    array_agg(p.policyname) as policy_names,
    '⚠️ POLICIES EXISTENT MAIS RLS DÉSACTIVÉ' as problem
FROM pg_tables t
LEFT JOIN pg_policies p ON p.schemaname = t.schemaname AND p.tablename = t.tablename
WHERE t.schemaname = 'public'
  AND t.tablename IN ('properties', 'guests', 'guest_submissions', 'generated_documents')
  AND t.rowsecurity = false
GROUP BY t.schemaname, t.tablename, t.rowsecurity
HAVING COUNT(p.policyname) > 0;

-- 2.4 Tables publiques sans RLS (PROBLÈME CRITIQUE)
SELECT 
    t.schemaname,
    t.tablename,
    t.rowsecurity as rls_enabled,
    COUNT(p.policyname) as policies_count,
    '❌ TABLE PUBLIQUE SANS RLS' as problem
FROM pg_tables t
LEFT JOIN pg_policies p ON p.schemaname = t.schemaname AND p.tablename = t.tablename
WHERE t.schemaname = 'public'
  AND t.tablename IN ('properties', 'guests', 'guest_submissions', 'generated_documents')
  AND t.rowsecurity = false
GROUP BY t.schemaname, t.tablename, t.rowsecurity;

-- ============================================================
-- RÉSUMÉ ÉTAPE 2
-- ============================================================
SELECT 
    'ÉTAPE 2 : État RLS des tables' as etape,
    t.tablename,
    CASE 
        WHEN t.rowsecurity THEN '✅ OK'
        ELSE '❌ PROBLÈME'
    END as status,
    (SELECT COUNT(*) FROM pg_policies p WHERE p.schemaname = 'public' AND p.tablename = t.tablename) as nb_policies
FROM pg_tables t
WHERE t.schemaname = 'public'
  AND t.tablename IN ('properties', 'guests', 'guest_submissions', 'generated_documents')
ORDER BY t.rowsecurity, t.tablename;

