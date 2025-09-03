-- ✅ CORRECTION: Ajouter la fonction RPC manquante get_admin_user_by_id
-- Cette fonction est utilisée par AdminContext pour vérifier les droits administrateur

-- 1. Fonction pour récupérer les informations admin d'un utilisateur
CREATE OR REPLACE FUNCTION public.get_admin_user_by_id(user_id_param UUID)
RETURNS TABLE (
    role TEXT,
    is_active BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Retourner les informations admin de l'utilisateur spécifié
    RETURN QUERY
    SELECT
        au.role::TEXT,
        au.is_active
    FROM public.admin_users au
    WHERE au.user_id = user_id_param
    AND au.is_active = true
    LIMIT 1;
END;
$$;

-- 2. Fonction pour récupérer les utilisateurs pour l'admin (utilisée dans AdminContext)
CREATE OR REPLACE FUNCTION public.get_users_for_admin()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    result JSONB;
BEGIN
    -- Récupérer tous les utilisateurs avec leurs informations de base
    SELECT jsonb_agg(
        jsonb_build_object(
            'id', u.id,
            'email', u.email,
            'full_name', u.full_name,
            'created_at', u.created_at,
            'is_admin', CASE WHEN au.user_id IS NOT NULL THEN true ELSE false END,
            'admin_role', COALESCE(au.role, 'user'),
            'admin_active', COALESCE(au.is_active, false)
        )
    ) INTO result
    FROM public.users u
    LEFT JOIN public.admin_users au ON u.id = au.user_id
    WHERE u.id IS NOT NULL;
    
    RETURN COALESCE(result, '[]'::jsonb);
END;
$$;

-- 3. Accorder les permissions appropriées
GRANT EXECUTE ON FUNCTION public.get_admin_user_by_id(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_users_for_admin() TO authenticated;

-- 4. Commentaires pour documentation
COMMENT ON FUNCTION public.get_admin_user_by_id(UUID) IS 
'Retourne les informations admin d''un utilisateur spécifique. Utilisée par AdminContext pour vérifier les droits administrateur.';

COMMENT ON FUNCTION public.get_users_for_admin() IS 
'Retourne la liste de tous les utilisateurs avec leurs informations admin pour le dashboard administrateur.';
