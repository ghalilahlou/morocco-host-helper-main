-- Requête unique pour diagnostiquer les tables admin existantes
SELECT 
  tablename,
  CASE 
    WHEN tablename ILIKE '%admin%' THEN 'Table admin'
    WHEN tablename ILIKE '%user%' THEN 'Table user'
    WHEN tablename ILIKE '%role%' THEN 'Table role'
    WHEN tablename ILIKE '%token%' THEN 'Table token'
    WHEN tablename ILIKE '%permission%' THEN 'Table permission'
    ELSE 'Table normale'
  END as type_table
FROM pg_tables 
WHERE schemaname = 'public'
  AND (tablename ILIKE '%admin%'
    OR tablename ILIKE '%user%'
    OR tablename ILIKE '%role%'
    OR tablename ILIKE '%token%'
    OR tablename ILIKE '%permission%')
ORDER BY tablename;

