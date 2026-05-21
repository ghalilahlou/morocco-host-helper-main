-- =============================================================================
-- AUDIT : noms invités / contrats (mélange entre réservations ou voyageurs)
-- À exécuter dans Supabase → SQL Editor (rôle postgres ou service).
--
-- Symptômes visés :
--   • Contrat PDF avec noms d'autres voyageurs (article « occupants »)
--   • guest_name réservation ≠ lignes table guests
--   • Anciens guests non supprimés après nouvelle soumission
--   • guest_submissions.booking_id rattaché à une autre réservation (dates / token)
--
-- Mode d'emploi :
--   1) Section A : vue globale (30 dernières réservations avec docs)
--   2) Section B–F : détection automatique des anomalies
--   3) Section G–H : cibler UN booking_id ou UN nom (remplacer les placeholders)
-- =============================================================================

-- ---------------------------------------------------------------------------
-- A) Synthèse par réservation (contrat + noms enregistrés)
-- ---------------------------------------------------------------------------
WITH last_contract AS (
  SELECT DISTINCT ON (gd.booking_id)
    gd.booking_id,
    gd.id AS contract_doc_id,
    gd.is_signed,
    gd.created_at AS contract_created_at,
    left(gd.document_url, 80) AS contract_url_prefix
  FROM public.generated_documents gd
  WHERE gd.document_type = 'contract'
  ORDER BY gd.booking_id, gd.created_at DESC
),
booking_guests AS (
  SELECT
    g.booking_id,
    count(*) AS guests_row_count,
    jsonb_agg(
      jsonb_build_object(
        'id', g.id,
        'full_name', g.full_name,
        'document_number', g.document_number,
        'nationality', g.nationality,
        'created_at', g.created_at
      ) ORDER BY g.created_at
    ) AS guests_json
  FROM public.guests g
  GROUP BY g.booking_id
),
last_submission AS (
  SELECT DISTINCT ON (gs.booking_id)
    gs.booking_id,
    gs.id AS submission_id,
    gs.updated_at AS submission_updated_at,
    gs.guest_data,
    gs.booking_data
  FROM public.guest_submissions gs
  WHERE gs.booking_id IS NOT NULL
  ORDER BY gs.booking_id, gs.updated_at DESC NULLS LAST
)
SELECT
  b.id AS booking_id,
  b.booking_reference,
  p.name AS property_name,
  b.check_in_date,
  b.check_out_date,
  b.status,
  b.guest_name AS booking_guest_name,
  b.number_of_guests,
  coalesce(bg.guests_row_count, 0) AS guests_in_table,
  bg.guests_json,
  ls.submission_id,
  ls.submission_updated_at,
  (
    SELECT string_agg(
      coalesce(elem->>'fullName', elem->>'full_name', '?'),
      ' | ' ORDER BY ord
    )
    FROM jsonb_array_elements(
      CASE
        WHEN jsonb_typeof(ls.guest_data) = 'array' THEN ls.guest_data
        WHEN ls.guest_data ? 'guests' THEN ls.guest_data->'guests'
        ELSE '[]'::jsonb
      END
    ) WITH ORDINALITY AS t(elem, ord)
  ) AS submission_guest_names,
  lc.contract_doc_id,
  lc.is_signed AS contract_signed,
  lc.contract_created_at,
  b.documents_generated->>'contract' AS docs_generated_flag
FROM public.bookings b
LEFT JOIN public.properties p ON p.id = b.property_id
LEFT JOIN booking_guests bg ON bg.booking_id = b.id
LEFT JOIN last_submission ls ON ls.booking_id = b.id
LEFT JOIN last_contract lc ON lc.booking_id = b.id
WHERE b.status::text IN ('pending', 'confirmed', 'completed', 'draft')
ORDER BY b.updated_at DESC NULLS LAST
LIMIT 50;

-- ---------------------------------------------------------------------------
-- B) ANOMALIE : plus de lignes guests que number_of_guests (anciens voyageurs restés)
--     → le contrat liste TOUS les guests de la table (article occupants)
-- ---------------------------------------------------------------------------
SELECT
  b.id AS booking_id,
  b.booking_reference,
  p.name AS property_name,
  b.check_in_date,
  b.check_out_date,
  b.guest_name,
  b.number_of_guests,
  count(g.id) AS guests_row_count,
  string_agg(g.full_name, ' | ' ORDER BY g.created_at) AS all_guest_names,
  string_agg(g.document_number, ' | ' ORDER BY g.created_at) AS all_doc_numbers
FROM public.bookings b
JOIN public.guests g ON g.booking_id = b.id
LEFT JOIN public.properties p ON p.id = b.property_id
WHERE b.status::text IN ('pending', 'confirmed', 'completed')
GROUP BY b.id, b.booking_reference, p.name, b.check_in_date, b.check_out_date,
         b.guest_name, b.number_of_guests
HAVING count(g.id) > coalesce(b.number_of_guests, 1)
ORDER BY guests_row_count DESC;

-- ---------------------------------------------------------------------------
-- C) ANOMALIE : guest_name réservation ≠ aucun full_name dans guests
-- ---------------------------------------------------------------------------
SELECT
  b.id AS booking_id,
  b.booking_reference,
  b.guest_name,
  b.check_in_date,
  b.check_out_date,
  string_agg(g.full_name, ' | ') AS guests_full_names
FROM public.bookings b
JOIN public.guests g ON g.booking_id = b.id
WHERE b.guest_name IS NOT NULL AND trim(b.guest_name) <> ''
GROUP BY b.id, b.booking_reference, b.guest_name, b.check_in_date, b.check_out_date
HAVING NOT bool_or(
  lower(trim(g.full_name)) = lower(trim(b.guest_name))
  OR lower(trim(b.guest_name)) LIKE '%' || lower(trim(split_part(g.full_name, ' ', 1))) || '%'
)
ORDER BY b.updated_at DESC NULLS LAST;

-- ---------------------------------------------------------------------------
-- D) ANOMALIE : guest_submissions — booking_id vs dates dans booking_data
--     (migration historique : match par dates + LIMIT 1 peut lier la mauvaise résa)
-- ---------------------------------------------------------------------------
SELECT
  gs.id AS submission_id,
  gs.booking_id AS linked_booking_id,
  b.booking_reference,
  b.check_in_date AS booking_check_in,
  b.check_out_date AS booking_check_out,
  gs.booking_data->>'checkInDate' AS sub_check_in,
  gs.booking_data->>'checkOutDate' AS sub_check_out,
  b.guest_name,
  gs.updated_at
FROM public.guest_submissions gs
JOIN public.bookings b ON b.id = gs.booking_id
WHERE gs.booking_data IS NOT NULL
  AND (
    (gs.booking_data->>'checkInDate' IS NOT NULL AND b.check_in_date::text IS DISTINCT FROM gs.booking_data->>'checkInDate')
    OR (gs.booking_data->>'checkOutDate' IS NOT NULL AND b.check_out_date::text IS DISTINCT FROM gs.booking_data->>'checkOutDate')
  )
ORDER BY gs.updated_at DESC
LIMIT 100;

-- ---------------------------------------------------------------------------
-- E) ANOMALIE : token actif pointe vers booking_id dont guest_name ≠ metadata lien
-- ---------------------------------------------------------------------------
SELECT
  left(pvt.token, 12) || '…' AS token_prefix,
  pvt.property_id,
  pvt.booking_id AS token_booking_id,
  b.guest_name AS booking_guest_name,
  pvt.metadata->'reservationData'->>'guestName' AS meta_guest_name,
  pvt.metadata->'reservationData'->>'startDate' AS meta_start,
  pvt.metadata->'reservationData'->>'endDate' AS meta_end,
  b.check_in_date,
  b.check_out_date,
  pvt.is_active,
  pvt.created_at
FROM public.property_verification_tokens pvt
LEFT JOIN public.bookings b ON b.id::text = pvt.booking_id
WHERE pvt.is_active = true
  AND pvt.booking_id IS NOT NULL
  AND b.id IS NOT NULL
  AND coalesce(trim(b.guest_name), '') <> ''
  AND coalesce(trim(pvt.metadata->'reservationData'->>'guestName'), '') <> ''
  AND lower(trim(b.guest_name)) IS DISTINCT FROM lower(trim(pvt.metadata->'reservationData'->>'guestName'))
ORDER BY pvt.created_at DESC
LIMIT 50;

-- ---------------------------------------------------------------------------
-- F) ANOMALIE : plusieurs contrats générés — comparer date contrat vs MAJ guests
--     (contrat ancien signé alors que guests table a été remplacés après)
-- ---------------------------------------------------------------------------
SELECT
  b.id AS booking_id,
  b.guest_name,
  count(gd.id) AS contract_versions,
  max(gd.created_at) AS last_contract_at,
  max(g.updated_at) AS last_guest_row_update,
  string_agg(DISTINCT g.full_name, ' | ') AS current_guest_names,
  CASE
    WHEN max(g.updated_at) > max(gd.created_at) THEN 'GUESTS_MODIFIED_AFTER_LAST_CONTRACT'
    ELSE 'ok'
  END AS timing_flag
FROM public.bookings b
JOIN public.generated_documents gd ON gd.booking_id = b.id AND gd.document_type = 'contract'
LEFT JOIN public.guests g ON g.booking_id = b.id
GROUP BY b.id, b.guest_name
HAVING count(gd.id) > 1
   OR max(g.updated_at) > max(gd.created_at)
ORDER BY last_contract_at DESC
LIMIT 50;

-- ---------------------------------------------------------------------------
-- G) CIBLAGE : une réservation précise (remplace l’UUID)
-- ---------------------------------------------------------------------------
-- SELECT
--   b.*,
--   (SELECT jsonb_agg(to_jsonb(g.*) ORDER BY g.created_at) FROM public.guests g WHERE g.booking_id = b.id) AS guests,
--   (SELECT jsonb_agg(to_jsonb(gs.*) ORDER BY gs.updated_at DESC) FROM public.guest_submissions gs WHERE gs.booking_id = b.id) AS submissions,
--   (SELECT jsonb_agg(to_jsonb(gd.*) ORDER BY gd.created_at DESC) FROM public.generated_documents gd WHERE gd.booking_id = b.id AND gd.document_type = 'contract') AS contracts
-- FROM public.bookings b
-- WHERE b.id = 'REMPLACER_PAR_BOOKING_UUID'::uuid;

-- ---------------------------------------------------------------------------
-- H) CIBLAGE : chercher un nom (ex. invité qui se plaint)
-- ---------------------------------------------------------------------------
-- SELECT
--   'guests' AS source,
--   g.booking_id,
--   g.full_name,
--   g.document_number,
--   b.check_in_date,
--   b.check_out_date,
--   b.guest_name AS booking_guest_name
-- FROM public.guests g
-- JOIN public.bookings b ON b.id = g.booking_id
-- WHERE g.full_name ILIKE '%REMPLACER_NOM%'
-- UNION ALL
-- SELECT
--   'bookings.guest_name',
--   b.id,
--   b.guest_name,
--   NULL,
--   b.check_in_date,
--   b.check_out_date,
--   b.guest_name
-- FROM public.bookings b
-- WHERE b.guest_name ILIKE '%REMPLACER_NOM%'
-- ORDER BY check_in_date DESC;

-- ---------------------------------------------------------------------------
-- I) Doublons INDEPENDENT_BOOKING (même bien + mêmes dates = une seule résa attendue)
-- ---------------------------------------------------------------------------
SELECT
  property_id,
  check_in_date,
  check_out_date,
  count(*) AS booking_count,
  array_agg(id ORDER BY updated_at DESC) AS booking_ids,
  array_agg(guest_name ORDER BY updated_at DESC) AS guest_names
FROM public.bookings
WHERE booking_reference = 'INDEPENDENT_BOOKING'
GROUP BY property_id, check_in_date, check_out_date
HAVING count(*) > 1;

-- ---------------------------------------------------------------------------
-- J) RPC admin (si migration 20260507000003 appliquée) — réservations « discrepantes »
-- ---------------------------------------------------------------------------
-- SELECT public.admin_get_discrepant_bookings();

-- ---------------------------------------------------------------------------
-- K) CRITIQUE : guest_name (réservation) ≠ guests.full_name (source PDF)
--     La section F peut afficher timing_flag = ok alors que les noms divergent
--     (ex. guest_name « Volkan Topcil » vs guests « CLAIRE JACQUELINE ANN BARNARDO »)
-- ---------------------------------------------------------------------------
WITH bg AS (
  SELECT
    g.booking_id,
    count(*) AS n,
    string_agg(g.full_name, ' | ' ORDER BY g.created_at) AS guest_names,
    max(g.updated_at) AS last_guest_update
  FROM public.guests g
  GROUP BY g.booking_id
),
lc AS (
  SELECT DISTINCT ON (gd.booking_id)
    gd.booking_id,
    gd.created_at AS last_contract_at,
    gd.is_signed
  FROM public.generated_documents gd
  WHERE gd.document_type = 'contract'
  ORDER BY gd.booking_id, gd.created_at DESC
)
SELECT
  b.id AS booking_id,
  b.booking_reference,
  b.check_in_date,
  b.check_out_date,
  b.guest_name AS booking_guest_name,
  bg.guest_names AS guests_table_names,
  bg.n AS guests_count,
  lc.last_contract_at,
  lc.is_signed AS contract_signed,
  CASE
    WHEN lower(trim(coalesce(b.guest_name, ''))) = 'guest' THEN 'PLACEHOLDER_GUEST_NAME'
    WHEN bg.guest_names IS NULL THEN 'NO_GUESTS_ROW'
    WHEN lower(trim(b.guest_name)) = lower(trim(split_part(bg.guest_names, ' | ', 1))) THEN 'names_match'
    ELSE 'NAME_MISMATCH'
  END AS name_flag
FROM public.bookings b
LEFT JOIN bg ON bg.booking_id = b.id
LEFT JOIN lc ON lc.booking_id = b.id
WHERE b.status::text IN ('pending', 'confirmed', 'completed')
  AND lc.booking_id IS NOT NULL
  AND (
    lower(trim(coalesce(b.guest_name, ''))) = 'guest'
    OR (
      bg.guest_names IS NOT NULL
      AND lower(trim(b.guest_name)) IS DISTINCT FROM lower(trim(split_part(bg.guest_names, ' | ', 1)))
    )
  )
ORDER BY lc.last_contract_at DESC NULLS LAST
LIMIT 80;

-- ---------------------------------------------------------------------------
-- L) Même updated_at sur plusieurs guests (batch / migration suspecte)
--     Ex. 2026-04-13 14:21:12.355294+00 sur plusieurs réservations différentes
-- ---------------------------------------------------------------------------
SELECT
  g.updated_at,
  count(DISTINCT g.booking_id) AS bookings_touchées,
  count(*) AS lignes_guests,
  string_agg(DISTINCT g.full_name, ' | ' ORDER BY g.full_name) AS noms_distincts
FROM public.guests g
GROUP BY g.updated_at
HAVING count(DISTINCT g.booking_id) > 3
ORDER BY bookings_touchées DESC, g.updated_at DESC
LIMIT 30;

-- ---------------------------------------------------------------------------
-- M) Détail des réservations touchées par un batch (ex. 2026-04-13 14:21:12)
--     Remplace le timestamp si besoin (résultat de la section L)
-- ---------------------------------------------------------------------------
SELECT
  b.id AS booking_id,
  b.booking_reference,
  b.check_in_date,
  b.check_out_date,
  b.guest_name AS booking_guest_name,
  g.id AS guest_id,
  g.full_name AS guests_full_name,
  g.document_number,
  g.updated_at AS guest_updated_at,
  g.created_at AS guest_created_at,
  (
    SELECT max(gd.created_at)
    FROM public.generated_documents gd
    WHERE gd.booking_id = b.id AND gd.document_type = 'contract'
  ) AS last_contract_at,
  CASE
    WHEN lower(trim(coalesce(b.guest_name, ''))) = 'guest' THEN 'PLACEHOLDER'
    WHEN lower(trim(b.guest_name)) = lower(trim(g.full_name)) THEN 'OK'
    ELSE 'MISMATCH'
  END AS name_sync_flag
FROM public.guests g
JOIN public.bookings b ON b.id = g.booking_id
WHERE g.updated_at = '2026-04-13 14:21:12.355294+00'::timestamptz
ORDER BY b.check_in_date DESC;

-- ---------------------------------------------------------------------------
-- N) Batch 2026-04-13 : contrat généré AVANT création ligne guests → PDF probablement obsolète
--     (guest_created_at = 2026-04-13 14:21:12 pour les 12 résas de la section M)
-- ---------------------------------------------------------------------------
SELECT
  b.id AS booking_id,
  b.booking_reference,
  b.guest_name AS booking_guest_name,
  g.full_name AS guests_full_name,
  g.created_at AS guest_row_created,
  lc.last_contract_at,
  lc.is_signed,
  CASE
    WHEN lc.last_contract_at IS NULL THEN 'NO_CONTRACT'
    WHEN lc.last_contract_at < g.created_at THEN 'CONTRACT_BEFORE_GUEST_BACKFILL'
    ELSE 'CONTRACT_AFTER_GUEST_BACKFILL'
  END AS contract_timing_flag,
  CASE
    WHEN lower(trim(coalesce(b.guest_name, ''))) = 'guest' THEN 'FIX_GUEST_NAME'
    ELSE 'CHECK_NAME_ONLY'
  END AS booking_name_action
FROM public.guests g
JOIN public.bookings b ON b.id = g.booking_id
LEFT JOIN LATERAL (
  SELECT gd.created_at AS last_contract_at, gd.is_signed
  FROM public.generated_documents gd
  WHERE gd.booking_id = b.id AND gd.document_type = 'contract'
  ORDER BY gd.created_at DESC
  LIMIT 1
) lc ON true
WHERE g.created_at = '2026-04-13 14:21:12.355294+00'::timestamptz
ORDER BY
  CASE WHEN lc.last_contract_at < g.created_at THEN 0 ELSE 1 END,
  b.check_in_date DESC;

-- ---------------------------------------------------------------------------
-- O) CORRECTIF DONNÉES (aperçu) — aligner bookings.guest_name sur guests (PLACEHOLDER)
--     Décommenter le UPDATE seulement après validation du SELECT
-- ---------------------------------------------------------------------------
-- SELECT b.id, b.guest_name AS avant, g.full_name AS apres
-- FROM public.bookings b
-- JOIN public.guests g ON g.booking_id = b.id
-- WHERE g.created_at = '2026-04-13 14:21:12.355294+00'::timestamptz
--   AND lower(trim(coalesce(b.guest_name, ''))) = 'guest'
--   AND g.full_name IS NOT NULL AND trim(g.full_name) <> '';

-- UPDATE public.bookings b
-- SET
--   guest_name = g.full_name,
--   updated_at = now()
-- FROM public.guests g
-- WHERE g.booking_id = b.id
--   AND g.created_at = '2026-04-13 14:21:12.355294+00'::timestamptz
--   AND lower(trim(coalesce(b.guest_name, ''))) = 'guest'
--   AND g.full_name IS NOT NULL AND trim(g.full_name) <> '';
