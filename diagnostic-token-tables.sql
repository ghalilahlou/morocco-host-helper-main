-- Diagnostic des tables de tokens
-- Ce script permet de vérifier l'état des tables de tokens

-- 1. Vérifier l'existence des tables
SELECT 
  'Tables existantes' as type,
  table_name,
  table_type
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name LIKE '%token%'
ORDER BY table_name;

-- 2. Compter les tokens dans chaque table
SELECT 
  'verification_tokens' as table_name,
  COUNT(*) as token_count,
  COUNT(CASE WHEN is_active = true THEN 1 END) as active_tokens
FROM verification_tokens
UNION ALL
SELECT 
  'property_verification_tokens' as table_name,
  COUNT(*) as token_count,
  COUNT(CASE WHEN is_active = true THEN 1 END) as active_tokens
FROM property_verification_tokens;

-- 3. Vérifier les tokens pour une propriété spécifique
-- Remplacez 'VOTRE_PROPERTY_ID' par l'ID de votre propriété
SELECT 
  'verification_tokens' as source,
  id,
  property_id,
  token,
  is_active,
  expires_at,
  created_at
FROM verification_tokens
WHERE property_id = 'VOTRE_PROPERTY_ID'
UNION ALL
SELECT 
  'property_verification_tokens' as source,
  id,
  property_id,
  token,
  is_active,
  expires_at,
  created_at
FROM property_verification_tokens
WHERE property_id = 'VOTRE_PROPERTY_ID'
ORDER BY created_at DESC;

-- 4. Vérifier les permissions sur les fonctions RPC
SELECT 
  routine_name,
  routine_type,
  security_type
FROM information_schema.routines 
WHERE routine_schema = 'public' 
  AND routine_name LIKE '%token%';

-- 5. Vérifier les politiques RLS
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual
FROM pg_policies 
WHERE tablename LIKE '%token%';
