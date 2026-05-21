-- =============================================================================
-- SCRIPT DE RESTITUTION — Conflits contrats / noms invités
-- À exécuter dans Supabase → SQL Editor (rôle postgres / service_role)
--
-- Mode d'emploi :
--   1) Faire un BACKUP de la base via Supabase Studio → Database → Backups
--   2) Lancer ce script bloc par bloc, vérifier les SELECT de preview AVANT
--      de décommenter et exécuter les UPDATE/DELETE
--   3) Tous les correctifs sont enveloppés dans BEGIN ... ROLLBACK / COMMIT
--      → testez avec ROLLBACK d'abord, puis remplacez par COMMIT
--
-- Restitution possible :
--   ✅ guest_name = 'Guest' avec guests.full_name OK     → AUTO (bloc B)
--   ✅ Doublons contrats même URL                         → AUTO (bloc C, archive)
--   ✅ Doublons contrats versions différentes              → SEMI (bloc D, garde dernier signé)
--   ⚠️  guest_name MISMATCH (Volkan ≠ Claire)              → MANUEL (bloc E, audit)
--   ❌ guest_name = 'Guest' SANS aucun guest               → NON RESTITUABLE auto
--      (relancer le lien invité, ou marquer 'cancelled')
-- =============================================================================

-- ---------------------------------------------------------------------------
-- BLOC A — Inventaire avant correctif (à exécuter d'abord pour photo)
-- ---------------------------------------------------------------------------
SELECT
  (SELECT count(*) FROM public.bookings) AS total_bookings,
  (SELECT count(*) FROM public.bookings WHERE lower(trim(coalesce(guest_name, ''))) = 'guest') AS placeholder_guest,
  (SELECT count(*) FROM public.guests) AS total_guests_rows,
  (SELECT count(*) FROM public.generated_documents WHERE document_type = 'contract') AS total_contracts,
  (
    SELECT count(*) FROM (
      SELECT booking_id FROM public.generated_documents
      WHERE document_type = 'contract'
      GROUP BY booking_id HAVING count(*) > 1
    ) sub
  ) AS bookings_with_multiple_contracts;

-- ---------------------------------------------------------------------------
-- BLOC B — RESTITUTION 1 : bookings.guest_name = 'Guest' avec guests.full_name OK
-- ---------------------------------------------------------------------------
-- Preview
SELECT
  b.id AS booking_id,
  b.guest_name AS guest_name_actuel,
  g.full_name AS nouveau_guest_name,
  b.check_in_date,
  b.check_out_date,
  b.booking_reference
FROM public.bookings b
JOIN public.guests g ON g.booking_id = b.id
WHERE lower(trim(coalesce(b.guest_name, ''))) = 'guest'
  AND g.full_name IS NOT NULL
  AND trim(g.full_name) <> ''
  AND lower(trim(g.full_name)) <> 'guest'
ORDER BY b.updated_at DESC;

-- Exécution (décommenter, vérifier ROLLBACK d'abord)
-- BEGIN;
--   WITH primary_guest AS (
--     SELECT DISTINCT ON (booking_id) booking_id, full_name
--     FROM public.guests
--     WHERE full_name IS NOT NULL AND trim(full_name) <> '' AND lower(trim(full_name)) <> 'guest'
--     ORDER BY booking_id, created_at ASC
--   )
--   UPDATE public.bookings b
--   SET guest_name = pg.full_name,
--       updated_at = now()
--   FROM primary_guest pg
--   WHERE pg.booking_id = b.id
--     AND lower(trim(coalesce(b.guest_name, ''))) = 'guest';
--   -- Vérification : combien de lignes modifiées ?
--   SELECT count(*) AS still_placeholder
--   FROM public.bookings WHERE lower(trim(coalesce(guest_name, ''))) = 'guest';
-- ROLLBACK;  -- ou COMMIT;

-- ---------------------------------------------------------------------------
-- BLOC C — RESTITUTION 2 : DOUBLONS EXACTS (même URL) dans generated_documents
-- ---------------------------------------------------------------------------
-- Preview : lignes en doublon strict (même booking + même type + même URL)
WITH dups AS (
  SELECT
    booking_id, document_type, document_url,
    array_agg(id ORDER BY created_at DESC) AS ids,
    count(*) AS n
  FROM public.generated_documents
  WHERE document_type = 'contract'
  GROUP BY booking_id, document_type, document_url
  HAVING count(*) > 1
)
SELECT
  booking_id,
  document_url,
  n AS doublons_count,
  ids[1] AS id_keep,
  ids[2:] AS ids_to_delete
FROM dups
ORDER BY n DESC;

-- Exécution : garder le + récent par (booking, url), supprimer les autres
-- BEGIN;
--   WITH dups AS (
--     SELECT
--       booking_id, document_type, document_url,
--       array_agg(id ORDER BY created_at DESC) AS ids
--     FROM public.generated_documents
--     WHERE document_type = 'contract'
--     GROUP BY booking_id, document_type, document_url
--     HAVING count(*) > 1
--   ),
--   to_delete AS (
--     SELECT unnest(ids[2:]) AS id FROM dups
--   )
--   DELETE FROM public.generated_documents
--   WHERE id IN (SELECT id FROM to_delete);
--   -- Vérification
--   SELECT count(*) AS contracts_after_dedup
--   FROM public.generated_documents WHERE document_type = 'contract';
-- ROLLBACK;  -- ou COMMIT;

-- ---------------------------------------------------------------------------
-- BLOC D — RESTITUTION 3 : VERSIONS MULTIPLES (URL différentes) — soft archive
-- ---------------------------------------------------------------------------
-- Stratégie : pour chaque booking, garder UNIQUEMENT le dernier contrat signé
-- (ou le dernier tout court s'il n'y a pas de signé). Soft-archive le reste
-- via une table d'archives + suppression.
--
-- ⚠️ Décision métier : "le dernier contrat signé fait foi" — à valider.

-- 1) Créer la table d'archive si elle n'existe pas
CREATE TABLE IF NOT EXISTS public.generated_documents_archive (
  LIKE public.generated_documents INCLUDING ALL,
  archived_at timestamptz DEFAULT now(),
  archive_reason text
);

-- 2) Preview : pour chaque booking, identifier le contrat À GARDER et ceux À ARCHIVER
WITH ranked AS (
  SELECT
    id, booking_id, is_signed, document_url, created_at,
    ROW_NUMBER() OVER (
      PARTITION BY booking_id
      ORDER BY is_signed DESC, created_at DESC
    ) AS rank_in_booking
  FROM public.generated_documents
  WHERE document_type = 'contract'
)
SELECT
  booking_id,
  count(*) FILTER (WHERE rank_in_booking = 1) AS kept,
  count(*) FILTER (WHERE rank_in_booking > 1) AS to_archive
FROM ranked
GROUP BY booking_id
HAVING count(*) > 1
ORDER BY to_archive DESC
LIMIT 50;

-- 3) Exécution : archiver puis supprimer (TRANSACTION)
-- BEGIN;
--   WITH ranked AS (
--     SELECT
--       id, booking_id,
--       ROW_NUMBER() OVER (
--         PARTITION BY booking_id
--         ORDER BY is_signed DESC, created_at DESC
--       ) AS rank_in_booking
--     FROM public.generated_documents
--     WHERE document_type = 'contract'
--   ),
--   to_archive AS (
--     SELECT id FROM ranked WHERE rank_in_booking > 1
--   )
--   INSERT INTO public.generated_documents_archive
--   SELECT gd.*, now() AS archived_at, 'superseded_by_latest_signed' AS archive_reason
--   FROM public.generated_documents gd
--   WHERE gd.id IN (SELECT id FROM to_archive);
--
--   WITH ranked AS (
--     SELECT
--       id,
--       ROW_NUMBER() OVER (
--         PARTITION BY booking_id
--         ORDER BY is_signed DESC, created_at DESC
--       ) AS rank_in_booking
--     FROM public.generated_documents
--     WHERE document_type = 'contract'
--   )
--   DELETE FROM public.generated_documents
--   WHERE id IN (SELECT id FROM ranked WHERE rank_in_booking > 1);
--
--   -- Vérification
--   SELECT count(*) AS contracts_after,
--          (SELECT count(*) FROM public.generated_documents_archive) AS archived
--   FROM public.generated_documents WHERE document_type = 'contract';
-- ROLLBACK;  -- ou COMMIT;

-- ---------------------------------------------------------------------------
-- BLOC E — AUDIT manuel : NAME_MISMATCH (ex. Volkan/Claire)
-- ---------------------------------------------------------------------------
-- Pas de correctif auto — décision métier nécessaire.
-- Lister les cas à arbitrer :
SELECT
  b.id AS booking_id,
  b.booking_reference,
  b.check_in_date,
  b.check_out_date,
  b.guest_name AS booking_guest_name,
  g.full_name AS guest_table_full_name,
  g.document_number,
  g.created_at AS guest_created,
  b.updated_at AS booking_updated
FROM public.bookings b
JOIN public.guests g ON g.booking_id = b.id
WHERE b.guest_name IS NOT NULL
  AND trim(b.guest_name) <> ''
  AND lower(trim(b.guest_name)) <> 'guest'
  AND lower(trim(g.full_name)) <> lower(trim(b.guest_name))
  AND NOT (
    -- match partiel (prénom commun)
    lower(trim(b.guest_name)) LIKE '%' || lower(trim(split_part(g.full_name, ' ', 1))) || '%'
    OR lower(trim(g.full_name)) LIKE '%' || lower(trim(split_part(b.guest_name, ' ', 1))) || '%'
  )
ORDER BY b.updated_at DESC;

-- Pour chaque ligne ci-dessus, l'équipe métier doit décider :
--   (a) Le bon nom est dans bookings.guest_name → UPDATE guests.full_name
--   (b) Le bon nom est dans guests.full_name    → UPDATE bookings.guest_name
--   (c) Deux séjours différents furent confondus → split en 2 bookings
--   (d) Cas test ou doublon à supprimer          → DELETE booking + guests
--
-- Template d'exécution pour (b) :
-- UPDATE public.bookings SET guest_name = 'NOM CORRECT', updated_at = now()
-- WHERE id = '<booking_uuid>'::uuid;

-- ---------------------------------------------------------------------------
-- BLOC F — AUDIT : bookings 'Guest' SANS aucun guest (non restituable auto)
-- ---------------------------------------------------------------------------
SELECT
  b.id AS booking_id,
  b.booking_reference,
  b.check_in_date,
  b.check_out_date,
  b.status,
  b.created_at,
  CASE
    WHEN b.check_out_date < current_date THEN 'expired_no_submission'
    WHEN b.check_in_date < current_date THEN 'in_stay_no_submission'
    ELSE 'future_pending'
  END AS situation
FROM public.bookings b
LEFT JOIN public.guests g ON g.booking_id = b.id
WHERE lower(trim(coalesce(b.guest_name, ''))) = 'guest'
  AND g.id IS NULL
ORDER BY b.check_in_date;

-- Action recommandée pour ces lignes :
--   • situation = 'expired_no_submission'  → marquer status = 'cancelled' ou 'archived'
--   • situation = 'in_stay_no_submission'  → relancer le lien invité urgemment
--   • situation = 'future_pending'         → vérifier que le lien invité existe et fonctionne

-- ---------------------------------------------------------------------------
-- BLOC G — RAPPORT FINAL (à exécuter après tous les correctifs pour confirmer)
-- ---------------------------------------------------------------------------
SELECT
  (SELECT count(*) FROM public.bookings) AS total_bookings,
  (SELECT count(*) FROM public.bookings WHERE lower(trim(coalesce(guest_name, ''))) = 'guest') AS placeholder_guest_remaining,
  (SELECT count(*) FROM public.generated_documents WHERE document_type = 'contract') AS contracts_active,
  (SELECT count(*) FROM public.generated_documents_archive WHERE document_type = 'contract') AS contracts_archived,
  (
    SELECT count(*) FROM (
      SELECT booking_id FROM public.generated_documents
      WHERE document_type = 'contract'
      GROUP BY booking_id HAVING count(*) > 1
    ) sub
  ) AS bookings_still_with_multiple_contracts;

-- =============================================================================
-- FIN DU SCRIPT
-- =============================================================================
