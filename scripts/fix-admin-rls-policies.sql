-- ✅ CORRECTION DES POLITIQUES RLS ADMINISTRATEUR
-- Script pour corriger les erreurs de syntaxe et doublons

-- 1. NETTOYER LES POLITIQUES EXISTANTES
DROP POLICY IF EXISTS "Admins can view all admin users" ON admin_users;
DROP POLICY IF EXISTS "Admins can view all users" ON admin_users;
DROP POLICY IF EXISTS "Admins can manage users" ON admin_users;
DROP POLICY IF EXISTS "Admins can view statistics" ON admin_statistics;
DROP POLICY IF EXISTS "Admins can view activity logs" ON admin_activity_logs;
DROP POLICY IF EXISTS "Admins can manage token allocations" ON token_allocations;

-- 2. CRÉER DES POLITIQUES CORRECTES ET SIMPLES

-- ✅ Politique pour admin_users
CREATE POLICY "Admin users access" ON admin_users
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM admin_users admin_check
      WHERE admin_check.user_id = auth.uid()
      AND admin_check.is_active = true
    )
  );

-- ✅ Politique pour admin_statistics  
CREATE POLICY "Admin statistics access" ON admin_statistics
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM admin_users admin_check
      WHERE admin_check.user_id = auth.uid()
      AND admin_check.is_active = true
    )
  );

-- ✅ Politique pour admin_activity_logs
CREATE POLICY "Admin activity logs access" ON admin_activity_logs
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM admin_users admin_check
      WHERE admin_check.user_id = auth.uid()
      AND admin_check.is_active = true
    )
  );

-- ✅ Politique pour token_allocations
CREATE POLICY "Admin token allocations access" ON token_allocations
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM admin_users admin_check
      WHERE admin_check.user_id = auth.uid()
      AND admin_check.is_active = true
    )
  );

-- 3. VÉRIFICATION DES POLITIQUES
SELECT 
  schemaname,
  tablename,
  policyname,
  cmd,
  qual
FROM pg_policies 
WHERE schemaname = 'public' 
AND tablename LIKE 'admin_%'
ORDER BY tablename, policyname;
