-- CORRECTION DES POLITIQUES RLS POUR PERMETTRE L'ACCÈS ADMIN
-- Le problème : les politiques empêchent de lire admin_users pour vérifier le statut

-- =====================================================
-- 1. SUPPRIMER LES POLITIQUES BLOQUANTES
-- =====================================================

DROP POLICY IF EXISTS "admin_users_access" ON admin_users;

-- =====================================================
-- 2. CRÉER UNE POLITIQUE QUI PERMET L'AUTO-VÉRIFICATION
-- =====================================================

-- Politique qui permet à chaque utilisateur de voir son propre statut admin
CREATE POLICY "admin_self_check" ON admin_users
  FOR SELECT USING (
    auth.uid() = user_id  -- Un user peut voir son propre statut
  );

-- Politique qui permet aux super_admins de tout voir/modifier
CREATE POLICY "super_admin_access" ON admin_users
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM admin_users sa
      WHERE sa.user_id = auth.uid() 
      AND sa.role = 'super_admin' 
      AND sa.is_active = true
    )
  );

-- =====================================================
-- 3. TESTER L'ACCÈS MAINTENANT
-- =====================================================

-- Test 1: Votre compte peut-il se voir lui-même ?
SELECT 
    'TEST AUTO-VERIFICATION' as test,
    user_id,
    email,
    role,
    is_active
FROM admin_users 
WHERE user_id = '1ef553dd-f4c3-4a7e-877c-eeb9423a48f0';

-- Test 2: Simuler la requête du frontend
-- (Simule auth.uid() = votre user_id)
SELECT set_config('request.jwt.claims', '{"sub": "1ef553dd-f4c3-4a7e-877c-eeb9423a48f0"}', true);

-- Test 3: Requête identique à celle du frontend
SELECT *
FROM admin_users
WHERE user_id = '1ef553dd-f4c3-4a7e-877c-eeb9423a48f0';

-- =====================================================
-- 4. VÉRIFICATION DES NOUVELLES POLITIQUES
-- =====================================================

SELECT 
    tablename,
    policyname,
    cmd,
    qual
FROM pg_policies 
WHERE schemaname = 'public' 
AND tablename = 'admin_users'
ORDER BY policyname;

-- Message final
SELECT 'Politiques admin corrigees pour permettre auto-verification' as message;
