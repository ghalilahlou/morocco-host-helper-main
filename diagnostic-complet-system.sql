-- Diagnostic complet du système de tokens
-- Ce script vérifie l'état actuel de votre base de données

-- 1. Vérifier toutes les tables existantes
SELECT 
  'Tables existantes' as type,
  table_name,
  table_type
FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;

-- 2. Vérifier spécifiquement les tables liées aux tokens
SELECT 
  'Tables de tokens' as type,
  table_name
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND (table_name LIKE '%token%' OR table_name LIKE '%property%' OR table_name LIKE '%booking%')
ORDER BY table_name;

-- 3. Vérifier les tables de base nécessaires
SELECT 
  CASE 
    WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'properties') 
    THEN 'EXISTS' 
    ELSE 'MISSING' 
  END as properties_table,
  CASE 
    WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'property_verification_tokens') 
    THEN 'EXISTS' 
    ELSE 'MISSING' 
  END as property_verification_tokens_table,
  CASE 
    WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'verification_tokens') 
    THEN 'EXISTS' 
    ELSE 'MISSING' 
  END as verification_tokens_table,
  CASE 
    WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'bookings') 
    THEN 'EXISTS' 
    ELSE 'MISSING' 
  END as bookings_table;

-- 4. Vérifier les fonctions RPC existantes
SELECT 
  routine_name,
  routine_type,
  security_type
FROM information_schema.routines 
WHERE routine_schema = 'public' 
  AND routine_name LIKE '%token%'
ORDER BY routine_name;

-- 5. Vérifier les permissions sur les fonctions
SELECT 
  routine_name,
  grantee,
  privilege_type
FROM information_schema.routine_privileges 
WHERE routine_schema = 'public' 
  AND routine_name LIKE '%token%'
ORDER BY routine_name, grantee;