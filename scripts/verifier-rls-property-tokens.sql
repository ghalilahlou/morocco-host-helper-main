-- Vérifier les politiques RLS sur property_verification_tokens
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
WHERE tablename = 'property_verification_tokens';

-- Vérifier si l'utilisateur actuel peut voir ses propriétés
SELECT 
    id,
    name,
    user_id,
    CASE 
        WHEN user_id = '88d5d01f-3ddd-40f7-90b0-260376f5accd' THEN '✅ Propriété de l\'utilisateur actuel'
        ELSE '❌ Propriété d\'un autre utilisateur'
    END as status
FROM properties 
WHERE id = 'a1072d02-dc8a-48b2-82a7-7f50d02d3985';

-- Vérifier les tokens existants pour cette propriété
SELECT 
    id,
    property_id,
    token,
    is_active,
    created_at
FROM property_verification_tokens 
WHERE property_id = 'a1072d02-dc8a-48b2-82a7-7f50d02d3985';
