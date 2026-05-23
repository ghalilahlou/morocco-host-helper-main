-- S3 : Trigger BEFORE INSERT/UPDATE qui rejette un 2e token actif pour le même booking_id
-- Renforce l'invariant "1 token actif par réservation" au niveau base de données.
-- Complète l'index unique déjà en place (20260520160000_one_active_token_per_booking).

CREATE OR REPLACE FUNCTION public.enforce_one_active_token_per_booking()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  -- Ignorer si le token est inactif ou sans booking
  IF NEW.is_active = false OR NEW.booking_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Vérifier qu'aucun autre token actif n'existe pour ce booking
  IF EXISTS (
    SELECT 1
    FROM public.property_verification_tokens
    WHERE booking_id   = NEW.booking_id
      AND is_active    = true
      AND id           <> COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
  ) THEN
    RAISE EXCEPTION
      'DUPLICATE_ACTIVE_TOKEN: un token actif existe déjà pour booking_id=%', NEW.booking_id
      USING ERRCODE = 'unique_violation';
  END IF;

  RETURN NEW;
END;
$$;

-- Attacher le trigger
DROP TRIGGER IF EXISTS trg_one_active_token_per_booking
  ON public.property_verification_tokens;

CREATE TRIGGER trg_one_active_token_per_booking
  BEFORE INSERT OR UPDATE ON public.property_verification_tokens
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_one_active_token_per_booking();

COMMENT ON FUNCTION public.enforce_one_active_token_per_booking() IS
  'S3 — Garantit qu''il n''existe qu''un seul token is_active=true par booking_id.
   Lève UNIQUE_VIOLATION si la contrainte est violée.';
