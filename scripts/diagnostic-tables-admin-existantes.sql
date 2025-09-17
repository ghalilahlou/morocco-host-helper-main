-- =====================================================
-- DIAGNOSTIC DES TABLES EXISTANTES AVEC LOGIQUE ADMIN
-- =====================================================

-- 1. RECHERCHE DE TOUTES LES TABLES CONTENANT "admin" DANS LE NOM
-- =====================================================
SELECT '1. TABLES CONTENANT "admin" DANS LE NOM' as section;

SELECT 
  schemaname,
  tablename,
  tableowner,
  'Table avec "admin" dans le nom' as type
FROM pg_tables 
WHERE tablename ILIKE '%admin%'
  AND schemaname = 'public'
ORDER BY tablename;

-- 2. RECHERCHE DE TABLES CONTENANT "user" ET "role" DANS LE NOM
-- =====================================================
SELECT '2. TABLES CONTENANT "user" ET "role" DANS LE NOM' as section;

SELECT 
  schemaname,
  tablename,
  tableowner,
  'Table avec "user" et "role" dans le nom' as type
FROM pg_tables 
WHERE (tablename ILIKE '%user%' AND tablename ILIKE '%role%')
  AND schemaname = 'public'
ORDER BY tablename;

-- 3. RECHERCHE DE TABLES CONTENANT "permission" OU "access" DANS LE NOM
-- =====================================================
SELECT '3. TABLES CONTENANT "permission" OU "access" DANS LE NOM' as section;

SELECT 
  schemaname,
  tablename,
  tableowner,
  'Table avec "permission" ou "access" dans le nom' as type
FROM pg_tables 
WHERE tablename ILIKE '%permission%' 
   OR tablename ILIKE '%access%'
   OR tablename ILIKE '%auth%'
  AND schemaname = 'public'
ORDER BY tablename;

-- 4. RECHERCHE DE TABLES CONTENANT "token" DANS LE NOM
-- =====================================================
SELECT '4. TABLES CONTENANT "token" DANS LE NOM' as section;

SELECT 
  schemaname,
  tablename,
  tableowner,
  'Table avec "token" dans le nom' as type
FROM pg_tables 
WHERE tablename ILIKE '%token%'
  AND schemaname = 'public'
ORDER BY tablename;

-- 5. RECHERCHE DE TABLES CONTENANT "role" DANS LE NOM
-- =====================================================
SELECT '5. TABLES CONTENANT "role" DANS LE NOM' as section;

SELECT 
  schemaname,
  tablename,
  tableowner,
  'Table avec "role" dans le nom' as type
FROM pg_tables 
WHERE tablename ILIKE '%role%'
  AND schemaname = 'public'
ORDER BY tablename;

-- 6. ANALYSE DES COLONNES CONTENANT "admin" OU "role" DANS TOUTES LES TABLES
-- =====================================================
SELECT '6. COLONNES CONTENANT "admin" OU "role" DANS TOUTES LES TABLES' as section;

SELECT 
  tc.table_schema,
  tc.table_name,
  tc.column_name,
  tc.data_type,
  tc.is_nullable,
  tc.column_default,
  'Colonne avec "admin" ou "role" dans le nom' as type
FROM information_schema.columns tc
WHERE (tc.column_name ILIKE '%admin%' 
    OR tc.column_name ILIKE '%role%'
    OR tc.column_name ILIKE '%permission%'
    OR tc.column_name ILIKE '%access%'
    OR tc.column_name ILIKE '%token%')
  AND tc.table_schema = 'public'
ORDER BY tc.table_name, tc.column_name;

-- 7. RECHERCHE DE TABLES AVEC DES COLONNES DE TYPE ENUM CONTENANT "admin"
-- =====================================================
SELECT '7. TABLES AVEC DES COLONNES DE TYPE ENUM CONTENANT "admin"' as section;

SELECT 
  t.typname as enum_name,
  e.enumlabel as enum_value,
  'Enum avec "admin" dans la valeur' as type
FROM pg_type t
JOIN pg_enum e ON t.oid = e.enumtypid
WHERE e.enumlabel ILIKE '%admin%'
ORDER BY t.typname, e.enumsortorder;

-- 8. RECHERCHE DE TABLES AVEC DES CONTRAINTES CHECK CONTENANT "admin"
-- =====================================================
SELECT '8. TABLES AVEC DES CONTRAINTES CHECK CONTENANT "admin"' as section;

SELECT 
  tc.table_schema,
  tc.table_name,
  tc.constraint_name,
  cc.check_clause,
  'Contrainte CHECK avec "admin"' as type
FROM information_schema.table_constraints tc
JOIN information_schema.check_constraints cc ON tc.constraint_name = cc.constraint_name
WHERE tc.constraint_type = 'CHECK'
  AND tc.table_schema = 'public'
  AND cc.check_clause ILIKE '%admin%'
ORDER BY tc.table_name, tc.constraint_name;

-- 9. RECHERCHE DE POLITIQUES RLS CONTENANT "admin"
-- =====================================================
SELECT '9. POLITIQUES RLS CONTENANT "admin"' as section;

SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check,
  'Politique RLS avec "admin"' as type
FROM pg_policies 
WHERE (tablename ILIKE '%admin%'
    OR policyname ILIKE '%admin%'
    OR qual ILIKE '%admin%'
    OR with_check ILIKE '%admin%')
  AND schemaname = 'public'
ORDER BY tablename, policyname;

-- 10. RECHERCHE DE FONCTIONS CONTENANT "admin"
-- =====================================================
SELECT '10. FONCTIONS CONTENANT "admin"' as section;

SELECT 
  n.nspname as schema_name,
  p.proname as function_name,
  pg_get_function_arguments(p.oid) as arguments,
  pg_get_function_result(p.oid) as return_type,
  'Fonction avec "admin" dans le nom' as type
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE p.proname ILIKE '%admin%'
  AND n.nspname = 'public'
ORDER BY p.proname;

-- 11. RECHERCHE DE TRIGGERS CONTENANT "admin"
-- =====================================================
SELECT '11. TRIGGERS CONTENANT "admin"' as section;

SELECT 
  trigger_schema,
  trigger_name,
  event_object_table,
  action_timing,
  event_manipulation,
  action_statement,
  'Trigger avec "admin" dans le nom' as type
FROM information_schema.triggers
WHERE trigger_name ILIKE '%admin%'
  AND trigger_schema = 'public'
ORDER BY event_object_table, trigger_name;

-- 12. RECHERCHE DE VUES CONTENANT "admin"
-- =====================================================
SELECT '12. VUES CONTENANT "admin"' as section;

SELECT 
  schemaname,
  viewname,
  viewowner,
  'Vue avec "admin" dans le nom' as type
FROM pg_views
WHERE viewname ILIKE '%admin%'
  AND schemaname = 'public'
ORDER BY viewname;

-- 13. RECHERCHE DE DONNÉES CONTENANT "admin" DANS LES TABLES EXISTANTES
-- =====================================================
SELECT '13. DONNÉES CONTENANT "admin" DANS LES TABLES EXISTANTES' as section;

-- Cette requête va chercher dans toutes les tables publiques
-- Note: Cette requête peut être lente sur de grandes tables
SELECT 
  'Recherche de données avec "admin" dans toutes les tables' as info,
  'Exécutez manuellement pour chaque table trouvée' as instruction;

-- 14. RÉSUMÉ DES TABLES POTENTIELLEMENT ADMIN
-- =====================================================
SELECT '14. RÉSUMÉ DES TABLES POTENTIELLEMENT ADMIN' as section;

WITH admin_tables AS (
  SELECT DISTINCT tablename, 'admin_in_name' as reason
  FROM pg_tables 
  WHERE tablename ILIKE '%admin%' AND schemaname = 'public'
  
  UNION
  
  SELECT DISTINCT tc.table_name, 'admin_in_column' as reason
  FROM information_schema.columns tc
  WHERE tc.column_name ILIKE '%admin%' AND tc.table_schema = 'public'
  
  UNION
  
  SELECT DISTINCT tc.tablename, 'role_in_name' as reason
  FROM pg_tables tc
  WHERE tc.tablename ILIKE '%role%' AND tc.schemaname = 'public'
  
  UNION
  
  SELECT DISTINCT tc.tablename, 'token_in_name' as reason
  FROM pg_tables tc
  WHERE tc.tablename ILIKE '%token%' AND tc.schemaname = 'public'
)
SELECT 
  tablename,
  string_agg(reason, ', ' ORDER BY reason) as reasons,
  'Table potentiellement liée à l''administration' as type
FROM admin_tables
GROUP BY tablename
ORDER BY tablename;
