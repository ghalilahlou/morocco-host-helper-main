-- CORRECTION URGENTE : SUPPRESSION DU DOUBLON ADMIN
-- Problème : 2 comptes admin avec le même user_id

-- =====================================================
-- 1. IDENTIFIER LES DOUBLONS
-- =====================================================

-- Voir les doublons admin
SELECT 
    id,
    user_id,
    email,
    role,
    is_active,
    created_at
FROM admin_users 
WHERE user_id = '1ef553dd-f4c3-4a7e-877c-eeb9423a48f0'
ORDER BY created_at;

-- =====================================================
-- 2. SUPPRIMER LE DOUBLON SANS EMAIL (plus ancien)
-- =====================================================

-- Supprimer le compte admin sans email
DELETE FROM admin_users 
WHERE user_id = '1ef553dd-f4c3-4a7e-877c-eeb9423a48f0' 
AND email IS NULL;

-- =====================================================
-- 3. VÉRIFIER QU'IL NE RESTE QU'UN SEUL ADMIN
-- =====================================================

-- Vérification finale
SELECT 
    id,
    user_id,
    email,
    role,
    is_active,
    created_at
FROM admin_users 
WHERE user_id = '1ef553dd-f4c3-4a7e-877c-eeb9423a48f0';

-- Compter tous les admins
SELECT COUNT(*) as total_admins FROM admin_users;

-- =====================================================
-- 4. AJOUTER CONTRAINTE UNIQUE POUR ÉVITER LES FUTURS DOUBLONS
-- =====================================================

-- Ajouter contrainte unique sur user_id
ALTER TABLE admin_users 
ADD CONSTRAINT admin_users_user_id_unique 
UNIQUE (user_id);

-- =====================================================
-- 5. NETTOYER LES POLITIQUES RLS PROBLÉMATIQUES
-- =====================================================

-- Supprimer toutes les politiques admin existantes
DROP POLICY IF EXISTS "admin_self_check" ON admin_users;
DROP POLICY IF EXISTS "super_admin_access" ON admin_users;

-- Créer UNE SEULE politique simple
CREATE POLICY "admin_access_only" ON admin_users
  FOR ALL USING (auth.uid() = user_id);

-- =====================================================
-- 6. TEST FINAL
-- =====================================================

-- Simuler l'authentification
SELECT set_config('request.jwt.claims', '{"sub": "1ef553dd-f4c3-4a7e-877c-eeb9423a48f0"}', true);

-- Test d'accès
SELECT 
    'TEST ACCES ADMIN' as test,
    user_id,
    email,
    role,
    is_active
FROM admin_users 
WHERE user_id = '1ef553dd-f4c3-4a7e-877c-eeb9423a48f0';

SELECT 'Doublon supprime et acces corrige' as message;
