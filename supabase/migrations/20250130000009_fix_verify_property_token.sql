-- Migration: Correction de la fonction verify_property_token
-- Date: 2025-01-30
-- Description: Corriger la fonction pour utiliser la bonne table

-- Corriger la fonction verify_property_token pour utiliser property_verification_tokens
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
END;
$$;

-- Accorder les permissions appropriées
GRANT EXECUTE ON FUNCTION public.verify_property_token(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.verify_property_token(UUID, TEXT) TO anon;

-- Commentaire pour documentation
COMMENT ON FUNCTION public.verify_property_token(UUID, TEXT) IS 
'Vérifie la validité d''un token pour une propriété en utilisant property_verification_tokens';
