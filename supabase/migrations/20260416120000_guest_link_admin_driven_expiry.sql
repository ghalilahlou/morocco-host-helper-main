-- Liens invités : pas d'expiration automatique par défaut (expires_at NULL).
-- Révocation / fin de validité date : via is_active ou expires_at fixé par l'administrateur.

UPDATE public.property_verification_tokens
SET expires_at = NULL, updated_at = NOW()
WHERE is_active = true
  AND expires_at IS NOT NULL;

COMMENT ON COLUMN public.property_verification_tokens.expires_at IS
'Si non NULL et dans le passé, le lien est refusé. NULL = pas d''expiration automatique; désactiver via is_active ou poser une date (action admin).';

-- Back-office : lire / mettre à jour les jetons invités (hôtes gardent leurs politiques existantes)
DROP POLICY IF EXISTS "Admins can view all property verification tokens" ON public.property_verification_tokens;
CREATE POLICY "Admins can view all property verification tokens" ON public.property_verification_tokens
  FOR SELECT USING (public.is_admin_user(auth.uid()));

DROP POLICY IF EXISTS "Admins can update all property verification tokens" ON public.property_verification_tokens;
CREATE POLICY "Admins can update all property verification tokens" ON public.property_verification_tokens
  FOR UPDATE USING (public.is_admin_user(auth.uid()))
  WITH CHECK (public.is_admin_user(auth.uid()));
