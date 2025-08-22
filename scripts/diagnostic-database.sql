-- 🔍 Diagnostic de la Base de Données - Problème de Signature Électronique
-- Exécutez ces requêtes dans l'éditeur SQL de Supabase pour diagnostiquer le problème

-- 1. Vérifier si la table contract_signatures existe et sa structure
SELECT 
    table_name,
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'contract_signatures'
ORDER BY ordinal_position;

-- 2. Vérifier les contraintes de la table contract_signatures
SELECT 
    constraint_name,
    constraint_type,
    table_name
FROM information_schema.table_constraints 
WHERE table_name = 'contract_signatures';

-- 3. Vérifier les clés étrangères
SELECT 
    tc.constraint_name,
    tc.table_name,
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc 
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
    AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY' 
    AND tc.table_name = 'contract_signatures';

-- 4. Vérifier les données existantes dans contract_signatures
SELECT 
    id,
    booking_id,
    LENGTH(signature_data) as signature_length,
    LENGTH(contract_content) as contract_length,
    signed_at,
    created_at
FROM contract_signatures
LIMIT 10;

-- 5. Vérifier les bookings liés
SELECT 
    b.id as booking_id,
    b.status,
    b.check_in_date,
    b.check_out_date,
    p.name as property_name,
    cs.id as signature_id
FROM bookings b
LEFT JOIN properties p ON b.property_id = p.id
LEFT JOIN contract_signatures cs ON b.id = cs.booking_id
WHERE b.id IN (
    SELECT DISTINCT booking_id 
    FROM contract_signatures
)
LIMIT 10;

-- 6. Vérifier les permissions RLS (Row Level Security)
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies 
WHERE tablename = 'contract_signatures';

-- 7. Vérifier les triggers sur la table
SELECT 
    trigger_name,
    event_manipulation,
    action_statement,
    action_timing
FROM information_schema.triggers 
WHERE event_object_table = 'contract_signatures';

-- 8. Test d'insertion pour vérifier les contraintes
-- ATTENTION: Cette requête va échouer intentionnellement pour diagnostiquer
INSERT INTO contract_signatures (
    booking_id,
    signature_data,
    contract_content
) VALUES (
    '00000000-0000-0000-0000-000000000000', -- UUID invalide pour test
    'test_signature_data',
    'test_contract_content'
);

-- 9. Vérifier la taille des colonnes TEXT
SELECT 
    column_name,
    character_maximum_length,
    data_type
FROM information_schema.columns 
WHERE table_name = 'contract_signatures' 
    AND data_type = 'text';

-- 10. Vérifier les index sur la table
SELECT 
    indexname,
    indexdef
FROM pg_indexes 
WHERE tablename = 'contract_signatures';

-- 11. Vérifier les statistiques de la table
SELECT 
    schemaname,
    tablename,
    attname,
    n_distinct,
    correlation
FROM pg_stats 
WHERE tablename = 'contract_signatures';

-- 12. Vérifier les erreurs récentes dans les logs (si accessible)
-- Cette requête peut ne pas fonctionner selon les permissions
SELECT 
    log_time,
    error_severity,
    message
FROM pg_stat_activity 
WHERE state = 'active' 
    AND query LIKE '%contract_signatures%'
LIMIT 10;
