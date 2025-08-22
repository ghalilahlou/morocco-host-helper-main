-- Diagnostic de la structure actuelle de contract_signatures
-- Vérifier quelles colonnes existent réellement

-- 1. Voir toutes les colonnes de la table
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'contract_signatures'
ORDER BY ordinal_position;

-- 2. Voir les contraintes
SELECT 
    constraint_name,
    constraint_type
FROM information_schema.table_constraints 
WHERE table_name = 'contract_signatures';

-- 3. Voir les politiques RLS
SELECT 
    policyname,
    cmd
FROM pg_policies 
WHERE tablename = 'contract_signatures';

-- 4. Voir quelques exemples de données (si la table contient des données)
SELECT * FROM contract_signatures LIMIT 3;
