-- Correction spécifique de la fonction verify_property_token
-- Ce script corrige les problèmes de permissions et de structure

-- 1. Supprimer la fonction existante si elle pose problème
DROP FUNCTION IF EXISTS public.verify_property_token(UUID, TEXT);

-- 2. Recréer la fonction avec une approche plus robuste
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
  -- Vérifier d'abord si la table existe
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'property_verification_tokens') THEN
    RAISE EXCEPTION 'Table property_verification_tokens does not exist';
  END IF;
  
  -- Vérifier si la propriété existe
  IF NOT EXISTS (SELECT 1 FROM public.properties WHERE properties.id = p_property_id) THEN
    RAISE EXCEPTION 'Property with id % does not exist', p_property_id;
  END IF;
  
  -- Retourner le résultat de la vérification
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

-- 3. Accorder toutes les permissions nécessaires
GRANT EXECUTE ON FUNCTION public.verify_property_token(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.verify_property_token(UUID, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.verify_property_token(UUID, TEXT) TO service_role;

-- 4. Créer une fonction de test pour vérifier le bon fonctionnement
CREATE OR REPLACE FUNCTION public.test_verify_property_token()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  test_property_id UUID;
  test_token TEXT;
  result_count INTEGER;
BEGIN
  -- Vérifier si la table existe
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'property_verification_tokens') THEN
    RETURN 'ERROR: Table property_verification_tokens does not exist';
  END IF;
  
  -- Vérifier si la table properties existe
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'properties') THEN
    RETURN 'ERROR: Table properties does not exist';
  END IF;
  
  -- Vérifier si la fonction existe
  IF NOT EXISTS (SELECT 1 FROM information_schema.routines WHERE routine_schema = 'public' AND routine_name = 'verify_property_token') THEN
    RETURN 'ERROR: Function verify_property_token does not exist';
  END IF;
  
  -- Compter les tokens existants
  SELECT COUNT(*) INTO result_count FROM public.property_verification_tokens;
  
  RETURN 'SUCCESS: Function created, ' || result_count || ' tokens found in database';
END;
$$;

-- 5. Exécuter le test
SELECT public.test_verify_property_token() as test_result;

-- 6. Nettoyer la fonction de test
DROP FUNCTION IF EXISTS public.test_verify_property_token();