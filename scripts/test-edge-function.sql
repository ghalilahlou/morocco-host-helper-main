-- 🔍 Test de l'Edge Function save-contract-signature
-- Exécutez ces requêtes pour diagnostiquer le problème

-- 1. Vérifier que la table contract_signatures existe et est accessible
SELECT 
    table_name,
    table_type
FROM information_schema.tables 
WHERE table_name = 'contract_signatures';

-- 2. Vérifier la structure de contract_signatures
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'contract_signatures'
ORDER BY ordinal_position;

-- 3. Vérifier les permissions RLS sur contract_signatures
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd
FROM pg_policies 
WHERE tablename = 'contract_signatures';

-- 4. Vérifier qu'il y a des bookings valides pour tester
SELECT 
    id,
    property_id,
    check_in_date,
    check_out_date,
    status,
    created_at
FROM bookings
LIMIT 5;

-- 5. Vérifier les données existantes dans contract_signatures
SELECT 
    COUNT(*) as total_signatures,
    COUNT(CASE WHEN signature_data IS NOT NULL THEN 1 END) as valid_signatures
FROM contract_signatures;

-- 6. Test d'insertion manuel pour vérifier les permissions
-- ATTENTION: Cette requête va échouer si il n'y a pas de booking valide
INSERT INTO contract_signatures (
    booking_id,
    signature_data,
    contract_content
) 
SELECT 
    b.id,
    'test_signature_data',
    'test_contract_content'
FROM bookings b
LIMIT 1
ON CONFLICT DO NOTHING;

-- 7. Vérifier que l'insertion a fonctionné
SELECT 
    COUNT(*) as signatures_after_test
FROM contract_signatures;

-- 8. Nettoyer le test
DELETE FROM contract_signatures 
WHERE signature_data = 'test_signature_data';

-- 9. Résumé du diagnostic
SELECT 
    'Edge Function database test completed' as status,
    now() as tested_at;
