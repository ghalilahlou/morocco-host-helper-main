-- Script de test pour vérifier le système de tokens

-- 1. Vérifier la structure de la table token_control_settings
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'token_control_settings' 
ORDER BY ordinal_position;

-- 2. Vérifier la structure de la table property_verification_tokens
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'property_verification_tokens' 
ORDER BY ordinal_position;

-- 3. Vérifier les contraintes de clé étrangère
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
    AND (tc.table_name = 'token_control_settings' OR tc.table_name = 'property_verification_tokens');

-- 4. Vérifier les données existantes
SELECT 'token_control_settings' as table_name, COUNT(*) as count FROM token_control_settings
UNION ALL
SELECT 'property_verification_tokens' as table_name, COUNT(*) as count FROM property_verification_tokens
UNION ALL
SELECT 'properties' as table_name, COUNT(*) as count FROM properties;

-- 5. Vérifier les paramètres de contrôle existants
SELECT 
    tcs.*,
    p.name as property_name,
    p.address as property_address
FROM token_control_settings tcs
LEFT JOIN properties p ON tcs.property_id = p.id
ORDER BY tcs.created_at DESC;

-- 6. Vérifier les tokens de vérification existants
SELECT 
    pvt.*,
    p.name as property_name,
    p.address as property_address
FROM property_verification_tokens pvt
LEFT JOIN properties p ON pvt.property_id = p.id
ORDER BY pvt.created_at DESC;

-- 7. Tester la fonction RPC verify_property_token
SELECT * FROM verify_property_token(
    'e3134554-7233-42b4-90b4-424d5aa74f40'::UUID,
    '2ca50aa4-0754-409a-93d5-6e1dc7287b13-0b711e3e-c976-44f4-89eb-6fb23075b3b9'
);

-- 8. Tester la fonction RPC check_reservation_allowed
SELECT * FROM check_reservation_allowed('e3134554-7233-42b4-90b4-424d5aa74f40'::UUID);

-- 9. Vérifier les permissions RLS
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
WHERE tablename IN ('token_control_settings', 'property_verification_tokens')
ORDER BY tablename, policyname;
