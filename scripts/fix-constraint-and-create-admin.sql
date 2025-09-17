-- ✅ CORRECTION CONTRAINTE + CRÉATION ADMIN
-- Script pour résoudre le problème de contrainte et créer l'admin

-- =====================================================
-- 1. AJOUTER LA CONTRAINTE UNIQUE MANQUANTE
-- =====================================================

-- Ajouter contrainte unique sur user_id si elle n'existe pas
ALTER TABLE admin_users 
ADD CONSTRAINT admin_users_user_id_unique 
UNIQUE (user_id);

-- =====================================================
-- 2. CRÉER L'ADMIN PRINCIPAL (VERSION SÉCURISÉE)
-- =====================================================

-- Vérifier d'abord si l'admin existe déjà
DO $$
DECLARE
    admin_exists BOOLEAN;
    auth_user_id UUID;
BEGIN
    -- Récupérer l'ID de l'utilisateur auth
    SELECT id INTO auth_user_id 
    FROM auth.users 
    WHERE email = 'ghalilahlou26@gmail.com';
    
    IF auth_user_id IS NULL THEN
        RAISE NOTICE '❌ Utilisateur ghalilahlou26@gmail.com non trouvé dans auth.users';
        RETURN;
    END IF;
    
    -- Vérifier si l'admin existe déjà
    SELECT EXISTS(
        SELECT 1 FROM admin_users 
        WHERE user_id = auth_user_id
    ) INTO admin_exists;
    
    IF admin_exists THEN
        -- Mettre à jour l'admin existant
        UPDATE admin_users 
        SET 
            email = 'ghalilahlou26@gmail.com',
            full_name = 'Ghali Lahlou',
            role = 'super_admin',
            is_active = true
        WHERE user_id = auth_user_id;
        
        RAISE NOTICE '✅ Admin existant mis à jour';
    ELSE
        -- Créer le nouvel admin
        INSERT INTO admin_users (user_id, email, full_name, role, is_active, created_at)
        VALUES (
            auth_user_id,
            'ghalilahlou26@gmail.com',
            'Ghali Lahlou',
            'super_admin',
            true,
            NOW()
        );
        
        RAISE NOTICE '✅ Nouvel admin créé avec succès';
    END IF;
END $$;

-- =====================================================
-- 3. VÉRIFICATION FINALE
-- =====================================================

-- Vérifier la structure de la table
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND table_name = 'admin_users'
ORDER BY ordinal_position;

-- Vérifier les contraintes
SELECT 
    constraint_name,
    constraint_type,
    column_name
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu 
    ON tc.constraint_name = kcu.constraint_name
WHERE tc.table_schema = 'public' 
AND tc.table_name = 'admin_users';

-- Vérifier le compte admin
SELECT 
    user_id,
    email,
    full_name,
    role,
    is_active,
    created_at
FROM admin_users 
WHERE email = 'ghalilahlou26@gmail.com';

-- Message final
SELECT '🎉 Admin configuré avec succès !' as message;
