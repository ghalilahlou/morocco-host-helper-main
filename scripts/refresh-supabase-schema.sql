-- ✅ SCRIPT: Rafraîchir le cache de schéma PostgREST après ajout de nouvelles fonctions RPC
-- Exécutez ceci après avoir créé les nouvelles fonctions pour que l'API les reconnaisse

-- 1. Forcer le rafraîchissement du cache PostgREST
NOTIFY pgrst, 'reload schema';

-- 2. Vérifier que les fonctions sont bien créées
SELECT 
  p.proname as function_name,
  n.nspname as schema_name,
  pg_get_function_identity_arguments(p.oid) as arguments,
  CASE 
    WHEN p.proacl IS NULL THEN 'No specific permissions'
    ELSE array_to_string(p.proacl, ', ')
  END as permissions
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public' 
  AND p.proname IN (
    'get_signed_contracts_for_user',
    'check_contract_signature', 
    'get_booking_guest_count',
    'verify_property_token',
    'get_property_for_verification'
  )
ORDER BY p.proname;

-- 3. Vérifier les permissions spécifiquement pour authenticated
SELECT 
  p.proname as function_name,
  has_function_privilege('authenticated', p.oid, 'EXECUTE') as can_execute_authenticated,
  has_function_privilege('anon', p.oid, 'EXECUTE') as can_execute_anon
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public' 
  AND p.proname IN (
    'get_signed_contracts_for_user',
    'check_contract_signature', 
    'get_booking_guest_count',
    'verify_property_token',
    'get_property_for_verification'
  )
ORDER BY p.proname;
