-- =====================================================
-- DIAGNOSTIC SIMPLE DES TABLES ADMIN EXISTANTES
-- =====================================================

-- 1. TOUTES LES TABLES PUBLIQUES
-- =====================================================
SELECT '1. TOUTES LES TABLES PUBLIQUES' as section;

SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename;

-- 2. TABLES AVEC "admin" DANS LE NOM
-- =====================================================
SELECT '2. TABLES AVEC "admin" DANS LE NOM' as section;

SELECT tablename FROM pg_tables 
WHERE tablename ILIKE '%admin%' AND schemaname = 'public' 
ORDER BY tablename;

-- 3. TABLES AVEC "user" DANS LE NOM
-- =====================================================
SELECT '3. TABLES AVEC "user" DANS LE NOM' as section;

SELECT tablename FROM pg_tables 
WHERE tablename ILIKE '%user%' AND schemaname = 'public' 
ORDER BY tablename;

-- 4. TABLES AVEC "role" DANS LE NOM
-- =====================================================
SELECT '4. TABLES AVEC "role" DANS LE NOM' as section;

SELECT tablename FROM pg_tables 
WHERE tablename ILIKE '%role%' AND schemaname = 'public' 
ORDER BY tablename;

-- 5. TABLES AVEC "token" DANS LE NOM
-- =====================================================
SELECT '5. TABLES AVEC "token" DANS LE NOM' as section;

SELECT tablename FROM pg_tables 
WHERE tablename ILIKE '%token%' AND schemaname = 'public' 
ORDER BY tablename;

-- 6. COLONNES AVEC "admin" DANS LE NOM
-- =====================================================
SELECT '6. COLONNES AVEC "admin" DANS LE NOM' as section;

SELECT table_name, column_name FROM information_schema.columns
WHERE column_name ILIKE '%admin%' AND table_schema = 'public'
ORDER BY table_name, column_name;

-- 7. COLONNES AVEC "role" DANS LE NOM
-- =====================================================
SELECT '7. COLONNES AVEC "role" DANS LE NOM' as section;

SELECT table_name, column_name FROM information_schema.columns
WHERE column_name ILIKE '%role%' AND table_schema = 'public'
ORDER BY table_name, column_name;

-- 8. POLITIQUES RLS EXISTANTES
-- =====================================================
SELECT '8. POLITIQUES RLS EXISTANTES' as section;

SELECT tablename, policyname FROM pg_policies 
WHERE schemaname = 'public'
ORDER BY tablename, policyname;
