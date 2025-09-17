-- Vérifier la structure des tables nécessaires
SELECT 
  table_name,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns 
WHERE table_name IN ('contract_signatures', 'guest_submissions')
ORDER BY table_name, ordinal_position;

-- Vérifier que les tables existent
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('contract_signatures', 'guest_submissions');
