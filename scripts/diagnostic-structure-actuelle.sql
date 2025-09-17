-- =====================================
-- DIAGNOSTIC STRUCTURE ACTUELLE
-- Morocco Host Helper Platform
-- =====================================

-- 1. LISTER TOUTES LES TABLES EXISTANTES
-- =====================================
SELECT 
    '1. Tables Existantes' as diagnostic,
    schemaname,
    tablename,
    tableowner,
    hasindexes,
    hasrules,
    hastriggers
FROM pg_tables 
WHERE schemaname IN ('public', 'auth')
ORDER BY schemaname, tablename;

-- 2. STRUCTURE DÉTAILLÉE DE CHAQUE TABLE
-- =====================================
SELECT 
    '2. Structure Tables' as diagnostic,
    t.table_name,
    c.column_name,
    c.data_type,
    c.is_nullable,
    c.column_default,
    CASE 
        WHEN pk.column_name IS NOT NULL THEN 'PRIMARY KEY'
        WHEN fk.column_name IS NOT NULL THEN 'FOREIGN KEY → ' || fk.foreign_table_name || '(' || fk.foreign_column_name || ')'
        ELSE ''
    END as constraints
FROM information_schema.tables t
JOIN information_schema.columns c 
    ON t.table_schema = c.table_schema 
    AND t.table_name = c.table_name
LEFT JOIN (
    SELECT 
        kcu.table_schema,
        kcu.table_name,
        kcu.column_name
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
        ON tc.constraint_name = kcu.constraint_name
    WHERE tc.constraint_type = 'PRIMARY KEY'
) pk ON c.table_schema = pk.table_schema 
    AND c.table_name = pk.table_name 
    AND c.column_name = pk.column_name
LEFT JOIN (
    SELECT 
        kcu.table_schema,
        kcu.table_name,
        kcu.column_name,
        ccu.table_name as foreign_table_name,
        ccu.column_name as foreign_column_name
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
        ON tc.constraint_name = kcu.constraint_name
    JOIN information_schema.referential_constraints rc
        ON tc.constraint_name = rc.constraint_name
    JOIN information_schema.constraint_column_usage ccu
        ON rc.unique_constraint_name = ccu.constraint_name
    WHERE tc.constraint_type = 'FOREIGN KEY'
) fk ON c.table_schema = fk.table_schema 
    AND c.table_name = fk.table_name 
    AND c.column_name = fk.column_name
WHERE t.table_schema = 'public'
ORDER BY t.table_name, c.ordinal_position;

-- 3. COLONNES DE AUTH.USERS DISPONIBLES
-- =====================================
SELECT 
    '3. Colonnes auth.users' as diagnostic,
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_schema = 'auth' 
  AND table_name = 'users'
ORDER BY ordinal_position;

-- 4. DONNÉES RÉELLES DANS LES TABLES
-- =====================================
-- Compter les enregistrements
SELECT '4a. Comptage Tables' as diagnostic,
       'auth.users' as table_name, 
       count(*) as nb_records 
FROM auth.users
UNION ALL
SELECT '4a. Comptage Tables', 'properties', count(*) FROM properties
UNION ALL  
SELECT '4a. Comptage Tables', 'bookings', count(*) FROM bookings
UNION ALL
SELECT '4a. Comptage Tables', 'guests', count(*) FROM guests
UNION ALL
SELECT '4a. Comptage Tables', 'admin_users', count(*) FROM admin_users
ORDER BY table_name;

-- 5. ÉCHANTILLON DES DONNÉES UTILISATEURS
-- =====================================
SELECT 
    '5. Échantillon Users' as diagnostic,
    id,
    email,
    created_at,
    last_sign_in_at,
    email_confirmed_at,
    CASE WHEN raw_user_meta_data IS NOT NULL THEN 'Metadata présent' ELSE 'Pas de metadata' END as metadata_status
FROM auth.users
ORDER BY created_at DESC
LIMIT 5;

-- 6. RELATIONS ACTUELLES UTILISATEUR → PROPRIÉTÉS
-- =====================================
SELECT 
    '6. Relations User-Properties' as diagnostic,
    au.email as user_email,
    p.id as property_id,
    p.name as property_name,
    p.created_at as property_created
FROM auth.users au
JOIN properties p ON p.user_id = au.id
ORDER BY au.email, p.created_at
LIMIT 10;

-- 7. VÉRIFICATION DES CONTRAINTES MANQUANTES
-- =====================================
-- Tables sans foreign keys vers auth.users
SELECT 
    '7. Tables sans FK vers auth.users' as diagnostic,
    table_name,
    column_name,
    'Potentielle référence manquante' as issue
FROM information_schema.columns c
WHERE c.table_schema = 'public'
  AND c.column_name LIKE '%user_id%'
  AND NOT EXISTS (
    SELECT 1 
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name
    WHERE tc.constraint_type = 'FOREIGN KEY'
      AND kcu.table_name = c.table_name
      AND kcu.column_name = c.column_name
  );

-- 8. VÉRIFICATION DES INDEX
-- =====================================
SELECT 
    '8. Index Existants' as diagnostic,
    schemaname,
    tablename,
    indexname,
    indexdef
FROM pg_indexes
WHERE schemaname = 'public'
ORDER BY tablename, indexname;
