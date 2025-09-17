-- ✅ DIAGNOSTIC RAPIDE DE L'ÉTAT ADMIN
-- Script pour voir exactement ce qui manque

-- =====================================================
-- 1. STRUCTURE ACTUELLE DES TABLES ADMIN
-- =====================================================

-- Tables admin existantes
SELECT 
  table_name,
  table_type
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name LIKE 'admin_%'
ORDER BY table_name;

-- =====================================================
-- 2. COLONNES DE admin_users
-- =====================================================

SELECT 
  'admin_users columns' as info,
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND table_name = 'admin_users'
ORDER BY ordinal_position;

-- =====================================================
-- 3. DONNÉES ADMIN ACTUELLES
-- =====================================================

-- Nombre d'enregistrements dans chaque table
SELECT 
  'admin_users' as table_name,
  COUNT(*) as record_count
FROM admin_users

UNION ALL

SELECT 
  'admin_statistics' as table_name,
  COUNT(*) as record_count
FROM admin_statistics

UNION ALL

SELECT 
  'admin_activity_logs' as table_name,
  COUNT(*) as record_count
FROM admin_activity_logs;

-- =====================================================
-- 4. UTILISATEURS AUTH DISPONIBLES
-- =====================================================

-- Utilisateurs qui pourraient être admins
SELECT 
  id,
  email,
  created_at,
  last_sign_in_at,
  email_confirmed_at
FROM auth.users
ORDER BY created_at
LIMIT 5;

-- =====================================================
-- 5. POLITIQUES RLS ADMIN
-- =====================================================

-- Politiques actuelles
SELECT 
  tablename,
  policyname,
  cmd
FROM pg_policies 
WHERE schemaname = 'public' 
AND tablename LIKE 'admin_%'
ORDER BY tablename, policyname;

-- =====================================================
-- 6. RECOMMANDATIONS
-- =====================================================

SELECT 
  CASE 
    WHEN NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'admin_users' AND column_name = 'email')
    THEN '❌ Colonne email manquante dans admin_users'
    ELSE '✅ Colonne email présente'
  END as email_status,
  
  CASE 
    WHEN NOT EXISTS (SELECT 1 FROM admin_users WHERE email = 'ghalilahlou26@gmail.com')
    THEN '❌ Compte admin principal manquant'
    ELSE '✅ Compte admin principal présent'
  END as admin_account_status,
  
  CASE 
    WHEN NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'admin_users')
    THEN '❌ Politiques RLS admin manquantes'
    ELSE '✅ Politiques RLS admin présentes'
  END as rls_status;
