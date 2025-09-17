-- Diagnostic simple du système de tokens
-- Exécutez ce script étape par étape

-- 1. Vérifier les tables existantes
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name IN ('properties', 'property_verification_tokens', 'bookings', 'guests')
ORDER BY table_name;

-- 2. Si les tables existent, vérifier leur contenu
-- (Décommentez les lignes suivantes si les tables existent)

-- SELECT COUNT(*) as total_properties FROM properties;
-- SELECT COUNT(*) as total_tokens FROM property_verification_tokens;
-- SELECT COUNT(*) as total_bookings FROM bookings;

-- 3. Vérifier les fonctions RPC
SELECT routine_name 
FROM information_schema.routines 
WHERE routine_schema = 'public' 
  AND routine_name = 'verify_property_token';

-- 4. Test simple de la fonction (si elle existe)
-- SELECT * FROM verify_property_token('e3134554-7233-42b4-90b4-424d5aa74f40'::UUID, 'test-token');