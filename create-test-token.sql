-- Création d'un token de test pour votre propriété
-- Remplacez 'VOTRE_PROPERTY_ID' par l'ID de votre propriété

-- 1. D'abord, créons une propriété de test si elle n'existe pas
INSERT INTO public.properties (
    id,
    name,
    address,
    description,
    contact_info,
    user_id
) VALUES (
    'e3134554-7233-42b4-90b4-424d5aa74f40'::UUID, -- Remplacez par votre property ID
    'Propriété de Test',
    'Adresse de Test, Marrakech',
    'Propriété de test pour le système de tokens',
    '{"email": "test@example.com", "phone": "+212 6 12 34 56 78"}'::JSONB,
    (SELECT id FROM auth.users LIMIT 1) -- Prendre le premier utilisateur disponible
) ON CONFLICT (id) DO NOTHING;

-- 2. Créer un token de test pour cette propriété
INSERT INTO public.property_verification_tokens (
    property_id,
    token,
    is_active,
    expires_at
) VALUES (
    'e3134554-7233-42b4-90b4-424d5aa74f40'::UUID, -- Même ID que la propriété
    '2ca50aa4-0754-409a-93d5-6e1dc7287b13-0b711e3e-c976-44f4-89eb-6fb23075b3b9', -- Votre token existant
    true,
    NULL -- Pas d'expiration
) ON CONFLICT (property_id, token) DO NOTHING;

-- 3. Vérifier que le token a été créé
SELECT 
    'Token créé' as status,
    pvt.id,
    pvt.property_id,
    pvt.token,
    pvt.is_active,
    p.name as property_name
FROM public.property_verification_tokens pvt
JOIN public.properties p ON p.id = pvt.property_id
WHERE pvt.property_id = 'e3134554-7233-42b4-90b4-424d5aa74f40'::UUID;

-- 4. Tester la fonction verify_property_token
SELECT 
    'Test fonction' as test_type,
    *
FROM public.verify_property_token(
    'e3134554-7233-42b4-90b4-424d5aa74f40'::UUID, 
    '2ca50aa4-0754-409a-93d5-6e1dc7287b13-0b711e3e-c976-44f4-89eb-6fb23075b3b9'
);

-- 5. Compter les tokens créés
SELECT 
    'Résumé' as type,
    COUNT(*) as total_tokens,
    COUNT(CASE WHEN is_active = true THEN 1 END) as active_tokens
FROM public.property_verification_tokens;
