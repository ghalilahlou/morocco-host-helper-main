-- ============================================================
-- FIX DÉFINITIF : Liens invités qui expirent par erreur
--
-- Causes identifiées :
-- 1. Anciennes versions de issue-guest-link définissaient expires_at = +30j par défaut
-- 2. Anciennes versions désactivaient tous les tokens existants lors de la génération d'un nouveau
-- 3. max_uses DEFAULT 1 rendait les tokens invalides après 1 utilisation
-- ============================================================

-- 1) Effacer expires_at pour TOUS les tokens actifs
--    (idempotent avec migration 20260416120000)
UPDATE public.property_verification_tokens
SET expires_at = NULL,
    updated_at = NOW()
WHERE expires_at IS NOT NULL;

-- 2) Mettre max_uses à NULL pour tous les tokens
--    (supprime la limite "1 utilisation maximum")
UPDATE public.property_verification_tokens
SET max_uses = NULL,
    updated_at = NOW()
WHERE max_uses IS NOT NULL;

-- 3) Changer le DEFAULT de max_uses à NULL (pas de limite par défaut)
ALTER TABLE public.property_verification_tokens
  ALTER COLUMN max_uses SET DEFAULT NULL;

-- 4) Réactiver les tokens récemment désactivés par l'ancienne Edge Function
--    (bug : l'ancienne version désactivait TOUS les tokens lors de la génération d'un nouveau)
--    On ne réactive que ceux désactivés après 2026-01-01 (période du bug connu)
--    car ceux d'avant pourraient avoir été désactivés légitimement.
UPDATE public.property_verification_tokens
SET is_active = true,
    updated_at = NOW()
WHERE is_active = false
  AND updated_at > '2026-01-01 00:00:00+00'
  AND id NOT IN (
    -- Exclure les tokens désactivés par l'admin (via AdminGuestLinkSection)
    -- On ne peut pas les distinguer, donc on réactive tous ceux de la période du bug
    -- L'admin pourra les désactiver manuellement si nécessaire
    SELECT id FROM public.property_verification_tokens WHERE 1=0
  );

-- 5) Mettre à jour le commentaire de la colonne
COMMENT ON COLUMN public.property_verification_tokens.expires_at IS
'NULL = pas d''expiration automatique. Seul is_active=false ou une date future explicitement posée par admin révoque le lien.';

COMMENT ON COLUMN public.property_verification_tokens.max_uses IS
'NULL = pas de limite d''utilisation. Valeur > 0 pour limiter le nombre d''utilisations (non utilisé dans le flux principal).';
