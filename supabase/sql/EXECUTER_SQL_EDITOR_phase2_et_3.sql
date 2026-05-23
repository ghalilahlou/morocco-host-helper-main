-- =============================================================================
-- EXECUTER DANS SUPABASE SQL EDITOR
-- Dashboard : https://supabase.com/dashboard/project/csopyblkfyofwkeqqegd/sql/new
-- Rôle requis : postgres (service_role)
-- Durée estimée : 10-30 secondes
-- =============================================================================
-- ETAPE 0 : Diagnostic initial
-- =============================================================================
SELECT
  (SELECT count(*) FROM public.property_verification_tokens) AS total_tokens,
  (SELECT count(*) FROM public.property_verification_tokens WHERE is_active = true) AS actifs,
  (SELECT count(*) FROM public.property_verification_tokens WHERE is_active = true AND booking_id IS NULL) AS actifs_sans_booking,
  (SELECT count(*) FROM public.property_verification_tokens WHERE is_active = true AND booking_id IS NOT NULL) AS actifs_avec_booking,
  (
    SELECT count(*) FROM public.property_verification_tokens pvt
    WHERE pvt.is_active = true AND pvt.booking_id IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM public.bookings b WHERE b.id = pvt.booking_id)
  ) AS actifs_orphelins;

-- =============================================================================
-- ETAPE 1 : DESACTIVER tous les tokens actifs pointant vers des bookings supprimés
-- (1 seule requête SQL = rapide même sur des centaines de milliers de lignes)
-- =============================================================================
BEGIN;

  UPDATE public.property_verification_tokens pvt
  SET is_active = false, updated_at = now()
  WHERE pvt.is_active = true
    AND pvt.booking_id IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM public.bookings b WHERE b.id = pvt.booking_id
    );

  -- Résultat attendu : X lignes mises à jour
  -- Vérification
  SELECT count(*) AS orphelins_restants
  FROM public.property_verification_tokens pvt
  WHERE pvt.is_active = true
    AND pvt.booking_id IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM public.bookings b WHERE b.id = pvt.booking_id);

COMMIT;

-- =============================================================================
-- ETAPE 2 : DESACTIVER l'ancien token quand plusieurs actifs pour le même booking
-- (garde le plus récent par booking_id)
-- =============================================================================
BEGIN;

  WITH ranked AS (
    SELECT id, booking_id,
      ROW_NUMBER() OVER (
        PARTITION BY booking_id
        ORDER BY created_at DESC
      ) AS rn
    FROM public.property_verification_tokens
    WHERE is_active = true AND booking_id IS NOT NULL
  )
  UPDATE public.property_verification_tokens
  SET is_active = false, updated_at = now()
  WHERE id IN (SELECT id FROM ranked WHERE rn > 1);

  -- Vérification : doit retourner 0
  SELECT booking_id, count(*) AS nb
  FROM public.property_verification_tokens
  WHERE is_active = true AND booking_id IS NOT NULL
  GROUP BY booking_id HAVING count(*) > 1;

COMMIT;

-- =============================================================================
-- ETAPE 3 : APPLIQUER LA MIGRATION - index unique (1 token actif par booking)
-- =============================================================================
CREATE UNIQUE INDEX IF NOT EXISTS idx_one_active_token_per_booking
ON public.property_verification_tokens (booking_id)
WHERE is_active = true AND booking_id IS NOT NULL;

COMMENT ON INDEX public.idx_one_active_token_per_booking IS
  'Au plus un property_verification_token actif par booking_id';

-- Vérification que l'index existe
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'property_verification_tokens'
  AND indexname = 'idx_one_active_token_per_booking';

-- =============================================================================
-- ETAPE 4 : RESYNC bookings.guest_name NULL/Guest depuis guests.full_name
-- =============================================================================
-- DRY-RUN d'abord
SELECT b.id, b.guest_name AS avant, g.full_name AS apres, b.check_in_date
FROM public.bookings b
JOIN LATERAL (
  SELECT full_name FROM public.guests
  WHERE booking_id = b.id AND full_name IS NOT NULL
    AND trim(full_name) <> '' AND lower(trim(full_name)) <> 'guest'
  ORDER BY created_at ASC LIMIT 1
) g ON true
WHERE (b.guest_name IS NULL OR lower(trim(coalesce(b.guest_name, ''))) IN ('', 'guest'));

-- Si résultat ok -> APPLIQUER :
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
-- ETAPE 5 : DESACTIVER le token orphelin de SAKARA (booking supprime)
-- =============================================================================
UPDATE public.property_verification_tokens
SET is_active = false, updated_at = now()
WHERE id = 'd1187605-b960-48ee-bc0c-dc254ee16c68'  -- Token SAKARA orphelin
   OR (is_active = true AND booking_id IS NOT NULL
       AND NOT EXISTS (SELECT 1 FROM public.bookings b WHERE b.id = booking_id));

-- =============================================================================
-- ETAPE 6 : NETTOYER token_id orphelins dans guest_submissions (FK invalides)
-- =============================================================================
-- DRY-RUN
SELECT count(*) AS orphan_fks
FROM public.guest_submissions gs
WHERE gs.token_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.property_verification_tokens pvt WHERE pvt.id = gs.token_id
  );

-- APPLIQUER (met token_id à NULL pour les FK orphelines)
BEGIN;
  UPDATE public.guest_submissions
  SET token_id = NULL
  WHERE token_id IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM public.property_verification_tokens pvt WHERE pvt.id = token_id
    );
COMMIT;

-- =============================================================================
-- ETAPE 7 : DIAGNOSTIC FINAL
-- =============================================================================
SELECT
  (SELECT count(*) FROM public.property_verification_tokens) AS total_tokens,
  (SELECT count(*) FROM public.property_verification_tokens WHERE is_active = true) AS actifs,
  (SELECT count(*) FROM public.property_verification_tokens WHERE is_active = true AND booking_id IS NULL) AS actifs_sans_booking,
  (SELECT count(*) FROM public.property_verification_tokens WHERE is_active = true AND booking_id IS NOT NULL) AS actifs_avec_booking,
  (
    SELECT count(*) FROM public.property_verification_tokens pvt
    WHERE pvt.is_active = true AND pvt.booking_id IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM public.bookings b WHERE b.id = pvt.booking_id)
  ) AS orphelins_actifs_restants,
  (
    SELECT count(DISTINCT booking_id) FROM public.property_verification_tokens
    WHERE is_active = true AND booking_id IS NOT NULL
  ) AS bookings_avec_token_actif,
  (
    SELECT count(*) FROM public.bookings
    WHERE guest_name IS NULL OR lower(trim(coalesce(guest_name, ''))) = 'guest'
  ) AS bookings_placeholder_restants;

-- Vérifier index
SELECT indexname FROM pg_indexes WHERE indexname = 'idx_one_active_token_per_booking';
