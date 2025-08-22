-- Supprimer les anciennes politiques RLS
DROP POLICY IF EXISTS "Users can view tokens for their properties" ON public.property_verification_tokens;
DROP POLICY IF EXISTS "Users can create tokens for their properties" ON public.property_verification_tokens;
DROP POLICY IF EXISTS "Users can update tokens for their properties" ON public.property_verification_tokens;

-- Recréer les politiques RLS correctement
CREATE POLICY "Users can view tokens for their properties" 
ON public.property_verification_tokens 
FOR SELECT 
USING (
  property_id IN (
    SELECT id FROM public.properties WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Users can create tokens for their properties" 
ON public.property_verification_tokens 
FOR INSERT 
WITH CHECK (
  property_id IN (
    SELECT id FROM public.properties WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Users can update tokens for their properties" 
ON public.property_verification_tokens 
FOR UPDATE 
USING (
  property_id IN (
    SELECT id FROM public.properties WHERE user_id = auth.uid()
  )
);

-- Vérifier que RLS est activé
ALTER TABLE public.property_verification_tokens ENABLE ROW LEVEL SECURITY;

-- Test d'insertion manuel pour vérifier
-- (À exécuter en tant qu'utilisateur authentifié)
INSERT INTO public.property_verification_tokens (
  property_id,
  token,
  is_active
) VALUES (
  'a1072d02-dc8a-48b2-82a7-7f50d02d3985',
  'test-token-' || gen_random_uuid(),
  true
) ON CONFLICT (property_id) DO UPDATE SET
  token = EXCLUDED.token,
  is_active = EXCLUDED.is_active,
  updated_at = now();
