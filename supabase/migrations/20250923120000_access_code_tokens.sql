-- Migration: Replace plain password with airbnb_confirmation_code + access_code_hash
-- Adds used_count, last_used_at, metadata and unique index

-- 1) Ensure pgcrypto for hashing (if backfill via SQL)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 2) Add new columns
ALTER TABLE public.property_verification_tokens
  ADD COLUMN IF NOT EXISTS airbnb_confirmation_code TEXT,
  ADD COLUMN IF NOT EXISTS access_code_hash TEXT,
  ADD COLUMN IF NOT EXISTS used_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_used_at TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb;

-- 3) Backfill: move existing plain password into airbnb_confirmation_code
--    and try to compute access_code_hash if a pepper is provided via GUC `app.access_code_pepper`.
--    If the GUC is not set, we still set the confirmation code, and the hash will be populated by runtime upserts later.
DO $$
DECLARE
  pepper TEXT;
  has_password BOOLEAN := FALSE;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'property_verification_tokens'
      AND column_name = 'password'
  ) INTO has_password;

  IF has_password THEN
    BEGIN
      pepper := current_setting('app.access_code_pepper', true);
    EXCEPTION WHEN others THEN
      pepper := NULL;
    END;

    IF pepper IS NOT NULL AND length(pepper) > 0 THEN
      UPDATE public.property_verification_tokens AS pvt
        SET airbnb_confirmation_code = COALESCE(pvt.airbnb_confirmation_code, pvt.password),
            access_code_hash = CASE
              WHEN pvt.password IS NOT NULL THEN encode(digest(pvt.password || pepper, 'sha256'), 'hex')
              ELSE access_code_hash END
        WHERE pvt.password IS NOT NULL AND pvt.airbnb_confirmation_code IS NULL;
    ELSE
      -- No pepper set: only move the value; hash will be set by application layer later
      UPDATE public.property_verification_tokens AS pvt
        SET airbnb_confirmation_code = COALESCE(pvt.airbnb_confirmation_code, pvt.password)
        WHERE pvt.password IS NOT NULL AND pvt.airbnb_confirmation_code IS NULL;
    END IF;
  END IF;
END $$;

-- 4) Create unique index on (property_id, airbnb_confirmation_code) for non-null codes
CREATE UNIQUE INDEX IF NOT EXISTS idx_pvt_property_airbnb_code_unique
  ON public.property_verification_tokens(property_id, airbnb_confirmation_code)
  WHERE airbnb_confirmation_code IS NOT NULL;

-- 5) Optional performance index on access_code_hash lookups
CREATE INDEX IF NOT EXISTS idx_pvt_access_code_hash
  ON public.property_verification_tokens(access_code_hash)
  WHERE access_code_hash IS NOT NULL;

-- 6) Drop old column after backfill
ALTER TABLE public.property_verification_tokens
  DROP COLUMN IF EXISTS password;

COMMENT ON COLUMN public.property_verification_tokens.airbnb_confirmation_code IS 'Original Airbnb confirmation code (masked in app; uniqueness scoped per property)';
COMMENT ON COLUMN public.property_verification_tokens.access_code_hash IS 'SHA-256 hash of (code + ACCESS_CODE_PEPPER), never store cleartext';
COMMENT ON COLUMN public.property_verification_tokens.used_count IS 'Number of successful validations';
COMMENT ON COLUMN public.property_verification_tokens.last_used_at IS 'Timestamp of last successful validation';
COMMENT ON COLUMN public.property_verification_tokens.metadata IS 'Free-form JSON for auxiliary info (e.g., provenance)';


