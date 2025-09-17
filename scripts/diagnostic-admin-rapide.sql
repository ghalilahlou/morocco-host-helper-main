-- =====================================================
-- DIAGNOSTIC RAPIDE DES TABLES ADMIN EXISTANTES
-- =====================================================

-- 1. TOUTES LES TABLES PUBLIQUES
-- =====================================================
SELECT '1. TOUTES LES TABLES PUBLIQUES' as section;

SELECT 
  tablename,
  tableowner,
  'Table publique' as type
FROM pg_tables 
WHERE schemaname = 'public'
ORDER BY tablename;

-- 2. TABLES AVEC "admin" DANS LE NOM
-- =====================================================
SELECT '2. TABLES AVEC "admin" DANS LE NOM' as section;

SELECT 
  tablename,
  tableowner,
  'Table admin' as type
FROM pg_tables 
WHERE tablename ILIKE '%admin%'
  AND schemaname = 'public'
ORDER BY tablename;

-- 3. TABLES AVEC "user" DANS LE NOM
-- =====================================================
SELECT '3. TABLES AVEC "user" DANS LE NOM' as section;

SELECT 
  tablename,
  tableowner,
  'Table user' as type
FROM pg_tables 
WHERE tablename ILIKE '%user%'
  AND schemaname = 'public'
ORDER BY tablename;

-- 4. TABLES AVEC "role" DANS LE NOM
-- =====================================================
SELECT '4. TABLES AVEC "role" DANS LE NOM' as section;

SELECT 
  tablename,
  tableowner,
  'Table role' as type
FROM pg_tables 
WHERE tablename ILIKE '%role%'
  AND schemaname = 'public'
ORDER BY tablename;

-- 5. TABLES AVEC "token" DANS LE NOM
-- =====================================================
SELECT '5. TABLES AVEC "token" DANS LE NOM' as section;

SELECT 
  tablename,
  tableowner,
  'Table token' as type
FROM pg_tables 
WHERE tablename ILIKE '%token%'
  AND schemaname = 'public'
ORDER BY tablename;

-- 6. COLONNES AVEC "admin" DANS LE NOM
-- =====================================================
SELECT '6. COLONNES AVEC "admin" DANS LE NOM' as section;

SELECT 
  table_name,
  column_name,
  data_type,
  'Colonne admin' as type
FROM information_schema.columns
WHERE column_name ILIKE '%admin%'
  AND table_schema = 'public'
ORDER BY table_name, column_name;

-- 7. COLONNES AVEC "role" DANS LE NOM
-- =====================================================
SELECT '7. COLONNES AVEC "role" DANS LE NOM' as section;

SELECT 
  table_name,
  column_name,
  data_type,
  'Colonne role' as type
FROM information_schema.columns
WHERE column_name ILIKE '%role%'
  AND table_schema = 'public'
ORDER BY table_name, column_name;

-- 8. POLITIQUES RLS EXISTANTES
-- =====================================================
SELECT '8. POLITIQUES RLS EXISTANTES' as section;

SELECT 
  tablename,
  policyname,
  cmd,
  'Politique RLS' as type
FROM pg_policies 
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

-- 9. RÉSUMÉ DES TABLES POTENTIELLEMENT ADMIN
-- =====================================================
SELECT '9. RÉSUMÉ DES TABLES POTENTIELLEMENT ADMIN' as section;

SELECT 
  tablename,
  CASE 
    WHEN tablename ILIKE '%admin%' THEN 'Table admin'
    WHEN tablename ILIKE '%user%' AND tablename ILIKE '%role%' THEN 'Table user/role'
    WHEN tablename ILIKE '%token%' THEN 'Table token'
    WHEN tablename ILIKE '%permission%' THEN 'Table permission'
    ELSE 'Table potentiellement liée'
  END as type_admin
FROM pg_tables 
WHERE schemaname = 'public'
  AND (tablename ILIKE '%admin%'
    OR tablename ILIKE '%user%'
    OR tablename ILIKE '%role%'
    OR tablename ILIKE '%token%'
    OR tablename ILIKE '%permission%')
ORDER BY tablename;

