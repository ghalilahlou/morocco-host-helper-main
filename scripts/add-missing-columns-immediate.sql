-- ✅ CORRECTION IMMÉDIATE : Ajouter les colonnes manquantes
-- Script simplifié pour résoudre le problème de structure

-- =====================================================
-- 1. VOIR LA STRUCTURE ACTUELLE
-- =====================================================

-- Voir les colonnes existantes
SELECT 
  column_name,
  data_type
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND table_name = 'admin_users'
ORDER BY ordinal_position;

-- =====================================================
-- 2. AJOUTER LES COLONNES MANQUANTES
-- =====================================================

-- Ajouter email
ALTER TABLE admin_users ADD COLUMN IF NOT EXISTS email TEXT;

-- Ajouter full_name
ALTER TABLE admin_users ADD COLUMN IF NOT EXISTS full_name TEXT;

-- Ajouter role si pas encore fait
ALTER TABLE admin_users ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'admin';

-- Ajouter is_active si pas encore fait
ALTER TABLE admin_users ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

-- =====================================================
-- 3. CRÉER LE COMPTE ADMIN PRINCIPAL
-- =====================================================

-- Insérer ou mettre à jour l'admin principal
INSERT INTO admin_users (user_id, email, full_name, role, is_active, created_at)
SELECT 
    u.id as user_id,
    u.email,
    'Ghali Lahlou' as full_name,
    'super_admin' as role,
    true as is_active,
    NOW() as created_at
FROM auth.users u
WHERE u.email = 'ghalilahlou26@gmail.com'
ON CONFLICT (user_id) 
DO UPDATE SET 
    email = EXCLUDED.email,
    full_name = 'Ghali Lahlou',
    role = 'super_admin',
    is_active = true;

-- =====================================================
-- 4. VÉRIFICATION IMMÉDIATE
-- =====================================================

-- Test de la nouvelle structure
SELECT 
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND table_name = 'admin_users'
ORDER BY ordinal_position;

-- Test du compte admin
SELECT 
    email,
    full_name,
    role,
    is_active,
    created_at
FROM admin_users 
WHERE email = 'ghalilahlou26@gmail.com';

-- Message de confirmation
SELECT '🎉 Colonnes ajoutées et compte admin créé avec succès !' as message;
