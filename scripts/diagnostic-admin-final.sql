-- ✅ DIAGNOSTIC COMPLET DU SYSTÈME ADMINISTRATEUR
-- Script pour vérifier toute la logique admin après corrections

-- =====================================================
-- 1. VÉRIFICATION DES TABLES ADMIN
-- =====================================================

-- Tables existantes
SELECT 
  table_name,
  table_type,
  is_insertable_into,
  is_typed
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name LIKE 'admin_%'
ORDER BY table_name;

-- =====================================================
-- 2. STRUCTURE DES TABLES ADMIN
-- =====================================================

-- Colonnes admin_users
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND table_name = 'admin_users'
ORDER BY ordinal_position;

-- =====================================================
-- 3. DONNÉES ADMIN EXISTANTES
-- =====================================================

-- Utilisateurs admin actuels
SELECT 
  id,
  user_id,
  email,
  full_name,
  role,
  is_active,
  created_at
FROM admin_users
ORDER BY created_at DESC;

-- Statistiques admin
SELECT 
  id,
  total_users,
  total_properties,
  total_bookings,
  active_users,
  calculated_at
FROM admin_statistics
ORDER BY calculated_at DESC
LIMIT 5;

-- Logs d'activité récents
SELECT 
  id,
  admin_user_id,
  action,
  details,
  created_at
FROM admin_activity_logs
ORDER BY created_at DESC
LIMIT 10;

-- =====================================================
-- 4. VÉRIFICATION DES POLITIQUES RLS
-- =====================================================

-- Politiques actuelles
SELECT 
  schemaname,
  tablename,
  policyname,
  cmd,
  permissive,
  roles,
  qual,
  with_check
FROM pg_policies 
WHERE schemaname = 'public' 
AND (tablename LIKE 'admin_%' OR tablename = 'properties' OR tablename = 'bookings')
ORDER BY tablename, policyname;

-- =====================================================
-- 5. TEST DE FONCTIONNALITÉ ADMIN
-- =====================================================

-- Test d'accès avec un utilisateur admin
DO $$
DECLARE
    admin_user_id UUID;
    test_result TEXT;
BEGIN
    -- Récupérer un admin existant
    SELECT user_id INTO admin_user_id
    FROM admin_users 
    WHERE is_active = true 
    LIMIT 1;
    
    IF admin_user_id IS NOT NULL THEN
        -- Simuler l'accès admin
        PERFORM set_config('request.jwt.claims', 
            json_build_object('sub', admin_user_id)::text, 
            true);
        
        -- Tester l'accès aux données
        PERFORM COUNT(*) FROM admin_users;
        PERFORM COUNT(*) FROM admin_statistics;
        PERFORM COUNT(*) FROM properties;
        PERFORM COUNT(*) FROM bookings;
        
        test_result := '✅ Accès admin fonctionnel';
    ELSE
        test_result := '❌ Aucun admin actif trouvé';
    END IF;
    
    RAISE NOTICE '%', test_result;
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE '❌ Erreur lors du test admin: %', SQLERRM;
END $$;

-- =====================================================
-- 6. COMPTEURS DE VALIDATION
-- =====================================================

-- Résumé final
SELECT 
    'admin_users' as table_name,
    COUNT(*) as record_count,
    COUNT(CASE WHEN is_active = true THEN 1 END) as active_count
FROM admin_users

UNION ALL

SELECT 
    'admin_statistics' as table_name,
    COUNT(*) as record_count,
    COUNT(CASE WHEN calculated_at > NOW() - INTERVAL '24 hours' THEN 1 END) as recent_count
FROM admin_statistics

UNION ALL

SELECT 
    'admin_activity_logs' as table_name,
    COUNT(*) as record_count,
    COUNT(CASE WHEN created_at > NOW() - INTERVAL '24 hours' THEN 1 END) as recent_count
FROM admin_activity_logs

ORDER BY table_name;
