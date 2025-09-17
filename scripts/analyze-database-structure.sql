-- =====================================================
-- ANALYSE COMPLETE DE LA STRUCTURE DE BASE DE DONNEES
-- =====================================================

-- 1. LISTE DE TOUTES LES TABLES
SELECT 
    schemaname as schema,
    tablename as table_name,
    tableowner as owner,
    hasindexes as has_indexes,
    hasrules as has_rules,
    hastriggers as has_triggers,
    rowsecurity as rls_enabled
FROM pg_tables 
WHERE schemaname IN ('public', 'auth')
ORDER BY schemaname, tablename;

-- =====================================================
-- 2. RELATIONS ET CLÉS ÉTRANGÈRES
-- =====================================================

-- Toutes les relations entre tables
SELECT 
    tc.table_name as table_source,
    kcu.column_name as column_source,
    ccu.table_name as table_target,
    ccu.column_name as column_target,
    tc.constraint_name,
    tc.constraint_type
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu 
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage ccu 
    ON ccu.constraint_name = tc.constraint_name
    AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY'
    AND tc.table_schema = 'public'
ORDER BY tc.table_name, tc.constraint_name;

-- =====================================================
-- 3. STRUCTURE DÉTAILLÉE DE CHAQUE TABLE
-- =====================================================

-- Colonnes de toutes les tables avec types et contraintes
SELECT 
    t.table_name,
    c.column_name,
    c.data_type,
    c.is_nullable,
    c.column_default,
    CASE 
        WHEN pk.column_name IS NOT NULL THEN 'PRIMARY KEY'
        WHEN fk.column_name IS NOT NULL THEN 'FOREIGN KEY'
        WHEN uq.column_name IS NOT NULL THEN 'UNIQUE'
        ELSE ''
    END as constraint_type,
    c.ordinal_position
FROM information_schema.tables t
LEFT JOIN information_schema.columns c 
    ON c.table_name = t.table_name AND c.table_schema = t.table_schema
LEFT JOIN (
    SELECT ku.table_name, ku.column_name
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage ku 
        ON tc.constraint_name = ku.constraint_name
    WHERE tc.constraint_type = 'PRIMARY KEY' AND tc.table_schema = 'public'
) pk ON pk.table_name = c.table_name AND pk.column_name = c.column_name
LEFT JOIN (
    SELECT ku.table_name, ku.column_name
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage ku 
        ON tc.constraint_name = ku.constraint_name
    WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_schema = 'public'
) fk ON fk.table_name = c.table_name AND fk.column_name = c.column_name
LEFT JOIN (
    SELECT ku.table_name, ku.column_name
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage ku 
        ON tc.constraint_name = ku.constraint_name
    WHERE tc.constraint_type = 'UNIQUE' AND tc.table_schema = 'public'
) uq ON uq.table_name = c.table_name AND uq.column_name = c.column_name
WHERE t.table_schema = 'public'
    AND t.table_type = 'BASE TABLE'
ORDER BY t.table_name, c.ordinal_position;

-- =====================================================
-- 4. ANALYSE DES DONNÉES ADMIN SPÉCIFIQUEMENT
-- =====================================================

-- Relations impliquant les tables admin
SELECT 
    'ADMIN RELATIONS' as category,
    tc.table_name as table_source,
    kcu.column_name as column_source,
    ccu.table_name as table_target,
    ccu.column_name as column_target
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu 
    ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage ccu 
    ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
    AND tc.table_schema = 'public'
    AND (tc.table_name LIKE 'admin_%' OR ccu.table_name LIKE 'admin_%')
ORDER BY tc.table_name;

-- =====================================================
-- 5. COMPTAGE DES ENREGISTREMENTS PAR TABLE
-- =====================================================

-- Compter les enregistrements dans chaque table
SELECT 
    'COMPTAGE' as section,
    'properties' as table_name,
    COUNT(*) as record_count
FROM properties

UNION ALL
SELECT 
    'COMPTAGE' as section,
    'bookings' as table_name,
    COUNT(*) as record_count
FROM bookings

UNION ALL
SELECT 
    'COMPTAGE' as section,
    'guests' as table_name,
    COUNT(*) as record_count
FROM guests

UNION ALL
SELECT 
    'COMPTAGE' as section,
    'admin_users' as table_name,
    COUNT(*) as record_count
FROM admin_users

UNION ALL
SELECT 
    'COMPTAGE' as section,
    'admin_statistics' as table_name,
    COUNT(*) as record_count
FROM admin_statistics

UNION ALL
SELECT 
    'COMPTAGE' as section,
    'admin_activity_logs' as table_name,
    COUNT(*) as record_count
FROM admin_activity_logs

ORDER BY table_name;

-- =====================================================
-- 6. POLITIQUES RLS PAR TABLE
-- =====================================================

-- Toutes les politiques RLS
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual
FROM pg_policies 
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

-- =====================================================
-- 7. ANALYSE DES CONFLITS POTENTIELS
-- =====================================================

-- Tables sans RLS qui devraient en avoir
SELECT 
    t.table_name,
    CASE WHEN p.tablename IS NULL THEN 'PAS DE RLS' ELSE 'RLS ACTIVÉ' END as rls_status,
    COUNT(DISTINCT p.policyname) as policy_count
FROM information_schema.tables t
LEFT JOIN pg_policies p ON p.tablename = t.table_name AND p.schemaname = t.table_schema
WHERE t.table_schema = 'public' 
    AND t.table_type = 'BASE TABLE'
    AND t.table_name NOT LIKE 'pg_%'
GROUP BY t.table_name, p.tablename
ORDER BY t.table_name;

-- Message final
SELECT '=== ANALYSE TERMINEE ===' as message;
