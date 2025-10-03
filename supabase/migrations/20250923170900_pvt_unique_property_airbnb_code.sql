-- Migration: Créer contrainte unique pour (property_id, airbnb_confirmation_code)
-- Objectif: Corriger l'erreur 42P10 lors de l'upsert avec ON CONFLICT

-- 1) Colonnes de sécurité si absentes
ALTER TABLE public.property_verification_tokens
  ADD COLUMN IF NOT EXISTS airbnb_confirmation_code TEXT,
  ADD COLUMN IF NOT EXISTS access_code_hash TEXT,
  ADD COLUMN IF NOT EXISTS used_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_used_at TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb;

-- 2) Nettoyage des doublons avant unique (ne touche pas aux NULL)
DELETE FROM public.property_verification_tokens p
USING public.property_verification_tokens p2
WHERE p.id < p2.id
  AND p.property_id = p2.property_id
  AND p.airbnb_confirmation_code IS NOT NULL
  AND p2.airbnb_confirmation_code IS NOT NULL
  AND p.airbnb_confirmation_code = p2.airbnb_confirmation_code;

-- 3) Supprimer l'ancien index partiel s'il existe (le partiel peut casser ON CONFLICT)
DROP INDEX IF EXISTS idx_pvt_property_airbnb_code_unique;

-- 4) Créer une vraie contrainte UNIQUE (non partielle) sur (property_id, airbnb_confirmation_code)
ALTER TABLE public.property_verification_tokens
  ADD CONSTRAINT pvt_property_airbnb_code_unique
  UNIQUE (property_id, airbnb_confirmation_code);

-- Remarque : Postgres autorise plusieurs NULL dans une contrainte UNIQUE,
-- donc les tokens "sans code" ne sont pas bloqués.

-- 5) Index optionnel pour performance (access_code_hash)
CREATE INDEX IF NOT EXISTS idx_pvt_access_code_hash 
  ON public.property_verification_tokens(access_code_hash) 
  WHERE access_code_hash IS NOT NULL;
