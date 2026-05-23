
-- =============================================================================
-- CONTRAINTES D'ISOLATION HÔTE + RÈGLES MÉTIER RÉSERVATIONS
-- Exécuter dans Supabase SQL Editor (rôle postgres)
-- =============================================================================

-- =============================================================================
-- SECTION 1 : Règles métier réservations (unicité par propriété + dates)
-- =============================================================================

-- 1.1 Déjà existant : INDEPENDENT_BOOKING unique par (property_id, check_in, check_out)
-- Vérifier qu'il est actif :
SELECT indexname, indexdef
FROM pg_indexes
WHERE indexname = 'idx_bookings_unique_independent_stay';

-- Si absent, le recréer :
-- CREATE UNIQUE INDEX IF NOT EXISTS idx_bookings_unique_independent_stay
-- ON public.bookings (property_id, check_in_date, check_out_date)
-- WHERE booking_reference = 'INDEPENDENT_BOOKING';

-- 1.2 Un seul token actif par booking (déjà créé en Phase 2)
SELECT indexname FROM pg_indexes WHERE indexname = 'idx_one_active_token_per_booking';

-- =============================================================================
-- SECTION 2 : Cohérence token.property_id = booking.property_id
-- =============================================================================

-- 2.1 Contrainte de cohérence via index partiel avec CHECK (Postgres 15+)
-- Sinon, trigger de validation

CREATE OR REPLACE FUNCTION public.check_token_booking_property_match()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  booking_prop_id uuid;
BEGIN
  -- Si le booking_id est défini sur le token, vérifier que la propriété correspond.
  -- pvt.booking_id est TEXT, pvt.property_id est UUID, bookings.property_id est UUID.
  IF NEW.booking_id IS NOT NULL AND NEW.property_id IS NOT NULL THEN
    SELECT property_id INTO booking_prop_id
    FROM public.bookings
    WHERE id = NEW.booking_id::uuid;

    IF booking_prop_id IS NOT NULL AND booking_prop_id <> NEW.property_id THEN
      RAISE EXCEPTION
        'ISOLATION VIOLATION: token.property_id (%) ≠ booking.property_id (%). '
        'Un token ne peut référencer que la propriété à laquelle il appartient.',
        NEW.property_id, booking_prop_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_check_token_booking_property ON public.property_verification_tokens;
CREATE TRIGGER trg_check_token_booking_property
BEFORE INSERT OR UPDATE OF booking_id, property_id
ON public.property_verification_tokens
FOR EACH ROW EXECUTE FUNCTION public.check_token_booking_property_match();

-- 2.2 Vérification préalable : y a-t-il des tokens actuellement incohérents ?
-- (pvt.booking_id = TEXT → cast ::uuid ; pvt.property_id = UUID = b.property_id)
SELECT pvt.id, pvt.property_id AS token_property, b.property_id AS booking_property
FROM public.property_verification_tokens pvt
JOIN public.bookings b ON b.id = pvt.booking_id::uuid
WHERE pvt.booking_id IS NOT NULL
  AND pvt.property_id <> b.property_id;
-- Attendu : 0 lignes

-- =============================================================================
-- SECTION 3 : Règle "1 séjour = 1 set de données invité unique"
-- Un booking ne peut pas accueillir des guests appartenant à d'autres bookings
-- (guard contre le bug du "token bus")
-- =============================================================================

-- 3.1 Vérifier des doublons (guests.booking_id incohérent)
SELECT g.booking_id, g.full_name, b.property_id
FROM public.guests g
JOIN public.bookings b ON b.id = g.booking_id
WHERE g.booking_id IS NULL
   OR NOT EXISTS (SELECT 1 FROM public.bookings bk WHERE bk.id = g.booking_id);
-- Attendu : 0 lignes

-- 3.2 Contrainte NOT NULL sur guests.booking_id (devrait déjà être le cas)
ALTER TABLE public.guests ALTER COLUMN booking_id SET NOT NULL;

-- =============================================================================
-- SECTION 4 : Vue de monitoring "santé du système"
-- =============================================================================

CREATE OR REPLACE VIEW public.v_system_health AS
SELECT
  'tokens_orphelins_actifs' AS indicateur,
  count(*) AS valeur,
  CASE WHEN count(*) = 0 THEN 'OK' ELSE 'ALERTE' END AS statut
FROM public.property_verification_tokens pvt
WHERE pvt.is_active = true AND pvt.booking_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM public.bookings b WHERE b.id = pvt.booking_id::uuid)

UNION ALL

SELECT
  'tokens_multi_actifs_par_booking',
  count(DISTINCT booking_id),
  CASE WHEN count(DISTINCT booking_id) = 0 THEN 'OK' ELSE 'ALERTE' END
FROM (
  SELECT booking_id FROM public.property_verification_tokens
  WHERE is_active = true AND booking_id IS NOT NULL
  GROUP BY booking_id HAVING count(*) > 1
) sub

UNION ALL

SELECT
  'contrats_doublons',
  count(DISTINCT booking_id),
  CASE WHEN count(DISTINCT booking_id) = 0 THEN 'OK' ELSE 'ALERTE' END
FROM (
  SELECT booking_id FROM public.generated_documents
  WHERE document_type = 'contract'
  GROUP BY booking_id, document_url HAVING count(*) > 1
) sub

UNION ALL

SELECT
  'bookings_placeholder_guest',
  count(*),
  CASE WHEN count(*) <= 15 THEN 'OK' ELSE 'ALERTE' END
FROM public.bookings
WHERE lower(trim(coalesce(guest_name, ''))) = 'guest'
   OR guest_name IS NULL

UNION ALL

SELECT
  'bookings_total',
  count(*),
  'INFO'
FROM public.bookings;

-- Utilisation : SELECT * FROM public.v_system_health;
-- Attendu : tokens_orphelins=0, tokens_multi=0, contrats_doublons=0
