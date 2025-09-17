-- ✅ NETTOYAGE DES POLITIQUES RLS EN DOUBLE
-- Script pour supprimer les doublons et simplifier

-- =====================================================
-- 1. SUPPRIMER TOUTES LES POLITIQUES ADMIN EXISTANTES
-- =====================================================

-- Supprimer toutes les politiques admin_users
DROP POLICY IF EXISTS "Admin users access" ON admin_users;
DROP POLICY IF EXISTS "Super admins can manage admin users" ON admin_users;
DROP POLICY IF EXISTS "Admins can view all admin users" ON admin_users;
DROP POLICY IF EXISTS "Admins can manage users" ON admin_users;

-- Supprimer toutes les politiques admin_statistics
DROP POLICY IF EXISTS "Admin statistics access" ON admin_statistics;
DROP POLICY IF EXISTS "Admins can manage statistics" ON admin_statistics;
DROP POLICY IF EXISTS "Admins can view statistics" ON admin_statistics;

-- Supprimer toutes les politiques admin_activity_logs
DROP POLICY IF EXISTS "Admin activity logs access" ON admin_activity_logs;
DROP POLICY IF EXISTS "Admins can insert activity logs" ON admin_activity_logs;
DROP POLICY IF EXISTS "Admins can view activity logs" ON admin_activity_logs;

-- Supprimer toutes les politiques token_allocations
DROP POLICY IF EXISTS "Admin token allocations access" ON token_allocations;
DROP POLICY IF EXISTS "Admins can manage token allocations" ON token_allocations;

-- =====================================================
-- 2. CRÉER DES POLITIQUES SIMPLES ET EFFICACES
-- =====================================================

-- Politique unique pour admin_users (lecture et écriture)
CREATE POLICY "admin_users_policy" ON admin_users
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM admin_users au
      WHERE au.user_id = auth.uid() 
      AND au.is_active = true
    )
  );

-- Politique unique pour admin_statistics
CREATE POLICY "admin_statistics_policy" ON admin_statistics
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM admin_users au
      WHERE au.user_id = auth.uid() 
      AND au.is_active = true
    )
  );

-- Politique unique pour admin_activity_logs
CREATE POLICY "admin_activity_logs_policy" ON admin_activity_logs
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM admin_users au
      WHERE au.user_id = auth.uid() 
      AND au.is_active = true
    )
  );

-- Politique unique pour token_allocations (si la table existe)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'token_allocations') THEN
        EXECUTE 'CREATE POLICY "token_allocations_policy" ON token_allocations
          FOR ALL USING (
            EXISTS (
              SELECT 1 FROM admin_users au
              WHERE au.user_id = auth.uid() 
              AND au.is_active = true
            )
          )';
        RAISE NOTICE '✅ Politique token_allocations créée';
    ELSE
        RAISE NOTICE '⚠️ Table token_allocations n''existe pas encore';
    END IF;
END $$;

-- =====================================================
-- 3. VÉRIFICATION DES NOUVELLES POLITIQUES
-- =====================================================

-- Voir les politiques finales
SELECT 
  tablename,
  policyname,
  cmd,
  permissive
FROM pg_policies 
WHERE schemaname = 'public' 
AND tablename LIKE 'admin_%'
ORDER BY tablename, policyname;

-- Message de confirmation
SELECT '🎉 Politiques RLS admin nettoyées et simplifiées !' as message;
