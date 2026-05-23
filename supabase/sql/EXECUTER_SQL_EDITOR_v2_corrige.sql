-- =============================================================================
-- v2 CORRIGEE — cast ::uuid sur pvt.booking_id dans les comparaisons
-- EXECUTER DANS SUPABASE SQL EDITOR
-- Dashboard : https://supabase.com/dashboard/project/csopyblkfyofwkeqqegd/sql/new
-- Durée estimée : 5-15 secondes par étape
-- =============================================================================

-- =============================================================================
-- ETAPE 0 : Diagnostic initial (combien a deja ete nettoye par le script Node)
-- =============================================================================
SELECT
  (SELECT count(*) FROM public.property_verification_tokens) AS total_tokens,
  (SELECT count(*) FROM public.property_verification_tokens WHERE is_active = true) AS actifs_total,
  (SELECT count(*) FROM public.property_verification_tokens WHERE is_active = true AND booking_id IS NULL) AS actifs_sans_booking,
  (SELECT count(*) FROM public.property_verification_tokens WHERE is_active = true AND booking_id IS NOT NULL) AS actifs_avec_booking,
  (
    SELECT count(*) FROM public.property_verification_tokens pvt
    WHERE pvt.is_active = true AND pvt.booking_id IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM public.bookings b WHERE b.id = pvt.booking_id::uuid)
  ) AS actifs_orphelins;

-- =============================================================================
-- ETAPE 1 : DESACTIVER tokens actifs orphelins (si le script Node n'a pas tout fait)
-- =============================================================================
BEGIN;
  UPDATE public.property_verification_tokens pvt
  SET is_active = false, updated_at = now()
  WHERE pvt.is_active = true
    AND pvt.booking_id IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM public.bookings b WHERE b.id = pvt.booking_id::uuid
    );
COMMIT;

-- Verification : doit retourner 0
SELECT count(*) AS orphelins_actifs_restants
FROM public.property_verification_tokens pvt
WHERE pvt.is_active = true AND pvt.booking_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM public.bookings b WHERE b.id = pvt.booking_id::uuid);

-- =============================================================================
-- ETAPE 2 : GARDER seulement le token le plus recent par booking_id
-- (desactive les anciens si plusieurs actifs pour le meme booking)
-- =============================================================================
BEGIN;
  WITH ranked AS (
    SELECT id,
      ROW_NUMBER() OVER (PARTITION BY booking_id ORDER BY created_at DESC) AS rn
    FROM public.property_verification_tokens
    WHERE is_active = true AND booking_id IS NOT NULL
  )
  UPDATE public.property_verification_tokens
  SET is_active = false, updated_at = now()
  WHERE id IN (SELECT id FROM ranked WHERE rn > 1);
COMMIT;

-- Verification : doit retourner 0 lignes
SELECT booking_id, count(*) AS nb_actifs
FROM public.property_verification_tokens
WHERE is_active = true AND booking_id IS NOT NULL
GROUP BY booking_id HAVING count(*) > 1;

-- =============================================================================
-- ETAPE 3 : APPLIQUER LA MIGRATION — index unique
-- =============================================================================
CREATE UNIQUE INDEX IF NOT EXISTS idx_one_active_token_per_booking
ON public.property_verification_tokens (booking_id)
WHERE is_active = true AND booking_id IS NOT NULL;

COMMENT ON INDEX public.idx_one_active_token_per_booking IS
  'Au plus un property_verification_token actif par booking_id';

-- Verification
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'property_verification_tokens'
  AND indexname = 'idx_one_active_token_per_booking';

-- =============================================================================
-- ETAPE 4 : NETTOYER token_id orphelins dans guest_submissions
-- =============================================================================
-- Diagnostic
SELECT count(*) AS orphan_fks
FROM public.guest_submissions gs
WHERE gs.token_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.property_verification_tokens pvt WHERE pvt.id = gs.token_id
  );

-- Application
BEGIN;
  UPDATE public.guest_submissions
  SET token_id = NULL
  WHERE token_id IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM public.property_verification_tokens pvt WHERE pvt.id = token_id
    );
COMMIT;

-- =============================================================================
-- ETAPE 5 : RESYNC bookings.guest_name NULL/Guest depuis guests.full_name
-- (les 6 cases fixees via Node, mais on relance au cas ou)
-- =============================================================================
-- Diagnostic
SELECT b.id, b.guest_name AS avant, g.full_name AS apres, b.check_in_date
FROM public.bookings b
JOIN LATERAL (
  SELECT full_name FROM public.guests
  WHERE booking_id = b.id AND full_name IS NOT NULL
    AND trim(full_name) <> '' AND lower(trim(full_name)) <> 'guest'
  ORDER BY created_at ASC LIMIT 1
) g ON true
WHERE (b.guest_name IS NULL OR lower(trim(coalesce(b.guest_name, ''))) IN ('', 'guest'));

-- Application
BEGIN;
  WITH first_real_guest AS (
    SELECT DISTINCT ON (booking_id) booking_id, full_name
    FROM public.guests
    WHERE full_name IS NOT NULL
      AND trim(full_name) <> ''
      AND lower(trim(full_name)) <> 'guest'
    ORDER BY booking_id, created_at ASC
  )
  UPDATE public.bookings b
  SET guest_name = frg.full_name, updated_at = now()
  FROM first_real_guest frg
  WHERE frg.booking_id = b.id
    AND (b.guest_name IS NULL OR lower(trim(coalesce(b.guest_name, ''))) IN ('', 'guest'));
COMMIT;

-- =============================================================================
-- ETAPE 6 : APPLIQUER LE TRIGGER de prévention sync guest_name
-- =============================================================================
CREATE OR REPLACE FUNCTION public.sync_booking_guest_name_from_guests()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  target_booking_id uuid;
  current_guest_name text;
  first_real_guest_name text;
BEGIN
  IF TG_OP = 'DELETE' THEN
    target_booking_id := OLD.booking_id;
  ELSE
    target_booking_id := NEW.booking_id;
  END IF;
  IF target_booking_id IS NULL THEN RETURN COALESCE(NEW, OLD); END IF;

  SELECT guest_name INTO current_guest_name FROM public.bookings WHERE id = target_booking_id;

  IF current_guest_name IS NOT NULL
     AND trim(current_guest_name) <> ''
     AND lower(trim(current_guest_name)) <> 'guest'
  THEN RETURN COALESCE(NEW, OLD); END IF;

  SELECT g.full_name INTO first_real_guest_name
  FROM public.guests g
  WHERE g.booking_id = target_booking_id
    AND g.full_name IS NOT NULL AND trim(g.full_name) <> ''
    AND lower(trim(g.full_name)) <> 'guest'
  ORDER BY g.created_at ASC LIMIT 1;

  IF first_real_guest_name IS NOT NULL THEN
    UPDATE public.bookings SET guest_name = first_real_guest_name, updated_at = now()
    WHERE id = target_booking_id;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_booking_guest_name ON public.guests;
CREATE TRIGGER trg_sync_booking_guest_name
AFTER INSERT OR UPDATE OF full_name OR DELETE
ON public.guests
FOR EACH ROW EXECUTE FUNCTION public.sync_booking_guest_name_from_guests();

-- Verification
SELECT tgname FROM pg_trigger WHERE tgname = 'trg_sync_booking_guest_name';

-- =============================================================================
-- ETAPE 7 : DIAGNOSTIC FINAL
-- =============================================================================
SELECT
  (SELECT count(*) FROM public.property_verification_tokens WHERE is_active = true) AS tokens_actifs,
  (SELECT count(*) FROM public.property_verification_tokens WHERE is_active = true AND booking_id IS NOT NULL) AS tokens_avec_booking,
  (SELECT count(DISTINCT booking_id) FROM public.property_verification_tokens WHERE is_active = true AND booking_id IS NOT NULL) AS bookings_distincts_avec_token,
  (
    SELECT count(*) FROM public.property_verification_tokens pvt
    WHERE pvt.is_active = true AND pvt.booking_id IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM public.bookings b WHERE b.id = pvt.booking_id::uuid)
  ) AS orphelins_restants,
  (
    SELECT count(*) FROM public.bookings
    WHERE guest_name IS NULL OR lower(trim(coalesce(guest_name, ''))) = 'guest'
  ) AS placeholders_restants,
  (SELECT count(*) FROM public.generated_documents WHERE document_type = 'contract') AS contrats_actifs;
