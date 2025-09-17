-- Migration des tokens de verification_tokens vers property_verification_tokens
-- Ce script corrige l'incohérence entre les tables de tokens

-- 1. Créer la table property_verification_tokens si elle n'existe pas
CREATE TABLE IF NOT EXISTS public.property_verification_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    property_id UUID NOT NULL,
    token TEXT NOT NULL,
    is_active BOOLEAN DEFAULT true,
    expires_at TIMESTAMPTZ NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    booking_id UUID NULL,
    
    -- Contraintes
    CONSTRAINT fk_property_verification_tokens_property_id 
        FOREIGN KEY (property_id) REFERENCES public.properties(id) ON DELETE CASCADE,
    CONSTRAINT unique_property_token UNIQUE (property_id, token)
);

-- 2. Migrer les tokens de verification_tokens vers property_verification_tokens
INSERT INTO public.property_verification_tokens (
    property_id,
    token,
    is_active,
    expires_at,
    created_at,
    updated_at
)
SELECT 
    property_id,
    token,
    COALESCE(is_active, true),
    expires_at,
    COALESCE(created_at, NOW()),
    COALESCE(updated_at, NOW())
FROM public.verification_tokens
WHERE NOT EXISTS (
    SELECT 1 FROM public.property_verification_tokens pvt 
    WHERE pvt.property_id = verification_tokens.property_id 
    AND pvt.token = verification_tokens.token
)
ON CONFLICT (property_id, token) DO NOTHING;

-- 3. Mettre à jour la fonction verify_property_token pour être plus robuste
CREATE OR REPLACE FUNCTION public.verify_property_token(p_property_id UUID, p_token TEXT)
RETURNS TABLE (
  id UUID,
  property_id UUID,
  token TEXT,
  expires_at TIMESTAMPTZ,
  is_valid BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Essayer d'abord property_verification_tokens
  RETURN QUERY
  SELECT 
    pvt.id,
    pvt.property_id,
    pvt.token,
    pvt.expires_at,
    (pvt.expires_at > NOW() OR pvt.expires_at IS NULL) as is_valid
  FROM public.property_verification_tokens pvt
  WHERE pvt.property_id = p_property_id 
    AND pvt.token = p_token
    AND pvt.is_active = true
  LIMIT 1;
  
  -- Si aucun résultat, essayer verification_tokens (fallback)
  IF NOT FOUND THEN
    RETURN QUERY
    SELECT 
      vt.id,
      vt.property_id,
      vt.token,
      vt.expires_at,
      (vt.expires_at > NOW() OR vt.expires_at IS NULL) as is_valid
    FROM public.verification_tokens vt
    WHERE vt.property_id = p_property_id 
      AND vt.token = p_token
      AND COALESCE(vt.is_active, true) = true
    LIMIT 1;
  END IF;
END;
$$;

-- 4. S'assurer que les permissions sont correctes
GRANT EXECUTE ON FUNCTION public.verify_property_token(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.verify_property_token(UUID, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.verify_property_token(UUID, TEXT) TO service_role;

-- 5. Désactiver temporairement RLS sur property_verification_tokens pour les Edge Functions
ALTER TABLE public.property_verification_tokens DISABLE ROW LEVEL SECURITY;

-- 6. Créer des politiques RLS permissives si nécessaire
-- (Décommentez si vous voulez réactiver RLS)
/*
ALTER TABLE public.property_verification_tokens ENABLE ROW LEVEL SECURITY;

-- Politique pour les Edge Functions (service_role)
CREATE POLICY "Service role can access all tokens" ON public.property_verification_tokens
    FOR ALL USING (true);

-- Politique pour les utilisateurs authentifiés
CREATE POLICY "Users can view tokens for their properties" ON public.property_verification_tokens
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.properties p
            WHERE p.id = property_verification_tokens.property_id
            AND p.user_id = auth.uid()
        )
    );
*/

-- 7. Vérifier le résultat
SELECT 
  'Migration terminée' as status,
  (SELECT COUNT(*) FROM public.property_verification_tokens) as total_tokens,
  (SELECT COUNT(*) FROM public.property_verification_tokens WHERE is_active = true) as active_tokens;
