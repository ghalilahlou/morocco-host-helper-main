-- ✅ CORRECTION DE LA STRUCTURE DE LA TABLE ADMIN_USERS
-- Script pour corriger la structure manquante

-- =====================================================
-- 1. VÉRIFIER LA STRUCTURE ACTUELLE
-- =====================================================

-- Voir les colonnes existantes de admin_users
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
-- 2. AJOUTER LES COLONNES MANQUANTES SI NÉCESSAIRE
-- =====================================================

-- Ajouter la colonne email si elle n'existe pas
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'admin_users' 
        AND column_name = 'email'
    ) THEN
        ALTER TABLE admin_users ADD COLUMN email TEXT;
        RAISE NOTICE '✅ Colonne email ajoutée';
    ELSE
        RAISE NOTICE '✅ Colonne email existe déjà';
    END IF;
END $$;

-- Ajouter la colonne full_name si elle n'existe pas
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'admin_users' 
        AND column_name = 'full_name'
    ) THEN
        ALTER TABLE admin_users ADD COLUMN full_name TEXT;
        RAISE NOTICE '✅ Colonne full_name ajoutée';
    ELSE
        RAISE NOTICE '✅ Colonne full_name existe déjà';
    END IF;
END $$;

-- Ajouter la colonne role si elle n'existe pas
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'admin_users' 
        AND column_name = 'role'
    ) THEN
        ALTER TABLE admin_users ADD COLUMN role TEXT DEFAULT 'admin';
        RAISE NOTICE '✅ Colonne role ajoutée';
    ELSE
        RAISE NOTICE '✅ Colonne role existe déjà';
    END IF;
END $$;

-- Ajouter la colonne is_active si elle n'existe pas
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'admin_users' 
        AND column_name = 'is_active'
    ) THEN
        ALTER TABLE admin_users ADD COLUMN is_active BOOLEAN DEFAULT true;
        RAISE NOTICE '✅ Colonne is_active ajoutée';
    ELSE
        RAISE NOTICE '✅ Colonne is_active existe déjà';
    END IF;
END $$;

-- =====================================================
-- 3. REMPLIR LES DONNÉES MANQUANTES
-- =====================================================

-- Mettre à jour les données admin avec les infos des utilisateurs
UPDATE admin_users 
SET 
    email = COALESCE(admin_users.email, auth_users.email),
    full_name = COALESCE(admin_users.full_name, 
                        SPLIT_PART(auth_users.email, '@', 1))
FROM (
    SELECT id, email 
    FROM auth.users
) AS auth_users
WHERE admin_users.user_id = auth_users.id
AND (admin_users.email IS NULL OR admin_users.full_name IS NULL);

-- =====================================================
-- 4. CRÉER UN UTILISATEUR ADMIN PRINCIPAL
-- =====================================================

-- Créer l'admin principal si pas encore fait
INSERT INTO admin_users (user_id, email, full_name, role, is_active)
SELECT 
    u.id,
    u.email,
    COALESCE(u.raw_user_meta_data->>'full_name', SPLIT_PART(u.email, '@', 1)),
    'super_admin',
    true
FROM auth.users u
WHERE u.email = 'ghalilahlou26@gmail.com'
ON CONFLICT (user_id) 
DO UPDATE SET 
    email = EXCLUDED.email,
    full_name = EXCLUDED.full_name,
    role = 'super_admin',
    is_active = true;

-- =====================================================
-- 5. VÉRIFICATION FINALE
-- =====================================================

-- Vérifier la structure mise à jour
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND table_name = 'admin_users'
ORDER BY ordinal_position;

-- Vérifier les données admin
SELECT 
    id,
    user_id,
    email,
    full_name,
    role,
    is_active,
    created_at
FROM admin_users
ORDER BY created_at;

-- Message de confirmation
SELECT '🎉 Structure admin_users corrigée et données synchronisées !' as message;
