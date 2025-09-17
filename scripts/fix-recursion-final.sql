-- CORRECTION DEFINITIVE DE LA RECURSION INFINIE
-- Solution: Politique simple SANS auto-référence

-- 1. SUPPRIMER TOUTES LES POLITIQUES ADMIN
DROP POLICY IF EXISTS "admin_self_check" ON admin_users;
DROP POLICY IF EXISTS "super_admin_access" ON admin_users;
DROP POLICY IF EXISTS "admin_users_access" ON admin_users;

-- 2. CRÉER UNE SEULE POLITIQUE SIMPLE
-- Permet à chaque utilisateur de voir seulement SON PROPRE statut admin
CREATE POLICY "admin_simple_access" ON admin_users
  FOR ALL USING (auth.uid() = user_id);

-- 3. TEST IMMEDIAT
SELECT 
    'TEST ACCES SIMPLE' as test,
    user_id,
    email,
    role,
    is_active
FROM admin_users 
WHERE user_id = '1ef553dd-f4c3-4a7e-877c-eeb9423a48f0';

-- 4. VERIFICATION POLITIQUE
SELECT 
    tablename,
    policyname,
    cmd,
    qual
FROM pg_policies 
WHERE schemaname = 'public' 
AND tablename = 'admin_users';

SELECT 'Politique simple creee sans recursion' as message;
