-- =============================================================================
-- BLOC D — Archive des versions multiples de contrats
-- Prêt à exécuter dans Supabase Dashboard → SQL Editor
--
-- Effet : pour chaque booking avec plusieurs contrats (29 bookings après
-- Blocs B+C), garde uniquement le dernier signé et archive le reste.
--
-- Politique : "le dernier contrat signé fait foi"
--
-- Sécurité :
--   - Étape 1 = preview (SELECT seulement)
--   - Étape 2 = création table archive (idempotent, CREATE IF NOT EXISTS)
--   - Étape 3 = enveloppée dans BEGIN ... ROLLBACK pour test
--   - Étape 4 = même contenu mais avec COMMIT pour exécution réelle
-- =============================================================================

-- ---------------------------------------------------------------------------
-- ÉTAPE 1 — Preview : combien de lignes à archiver par booking ?
-- ---------------------------------------------------------------------------
WITH ranked AS (
  SELECT
    id, booking_id, is_signed, created_at,
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
  count(*) FILTER (WHERE rank_in_booking > 1) AS to_archive,
  count(*) AS total
FROM ranked
GROUP BY booking_id
HAVING count(*) > 1
ORDER BY to_archive DESC;

-- → Vous devriez voir ~29 lignes. Si OK, passer à l'étape 2.

-- ---------------------------------------------------------------------------
-- ÉTAPE 2 — Créer la table d'archive (idempotent, safe à re-exécuter)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.generated_documents_archive (
  LIKE public.generated_documents INCLUDING ALL,
  archived_at timestamptz DEFAULT now(),
  archive_reason text
);

-- ---------------------------------------------------------------------------
-- ÉTAPE 3 — TEST DRY-RUN avec ROLLBACK (ne modifie RIEN)
-- ---------------------------------------------------------------------------
BEGIN;
  WITH ranked AS (
    SELECT
      id, booking_id,
      ROW_NUMBER() OVER (
        PARTITION BY booking_id
        ORDER BY is_signed DESC, created_at DESC
      ) AS rank_in_booking
    FROM public.generated_documents
    WHERE document_type = 'contract'
  ),
  to_archive AS (
    SELECT id FROM ranked WHERE rank_in_booking > 1
  )
  INSERT INTO public.generated_documents_archive
  SELECT gd.*, now() AS archived_at, 'superseded_by_latest_signed' AS archive_reason
  FROM public.generated_documents gd
  WHERE gd.id IN (SELECT id FROM to_archive);

  WITH ranked AS (
    SELECT
      id,
      ROW_NUMBER() OVER (
        PARTITION BY booking_id
        ORDER BY is_signed DESC, created_at DESC
      ) AS rank_in_booking
    FROM public.generated_documents
    WHERE document_type = 'contract'
  )
  DELETE FROM public.generated_documents
  WHERE id IN (SELECT id FROM ranked WHERE rank_in_booking > 1);

  -- Vérification avant rollback
  SELECT
    (SELECT count(*) FROM public.generated_documents WHERE document_type = 'contract') AS contracts_active_after,
    (SELECT count(*) FROM public.generated_documents_archive WHERE document_type = 'contract') AS archived_after;
ROLLBACK;
-- → Si les chiffres affichés vous conviennent (~66 actifs, ~29 archivés),
--    passez à l'étape 4 pour appliquer pour de vrai.

-- ---------------------------------------------------------------------------
-- ÉTAPE 4 — APPLIQUER POUR DE VRAI (remplace ROLLBACK par COMMIT)
-- ---------------------------------------------------------------------------
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
-- COMMIT;

-- ---------------------------------------------------------------------------
-- ÉTAPE 5 — Rapport final
-- ---------------------------------------------------------------------------
SELECT
  (SELECT count(*) FROM public.bookings) AS total_bookings,
  (SELECT count(*) FROM public.bookings WHERE lower(trim(coalesce(guest_name, ''))) = 'guest') AS placeholder_remaining,
  (SELECT count(*) FROM public.generated_documents WHERE document_type = 'contract') AS contracts_active,
  (SELECT count(*) FROM public.generated_documents_archive WHERE document_type = 'contract') AS contracts_archived,
  (
    SELECT count(*) FROM (
      SELECT booking_id FROM public.generated_documents
      WHERE document_type = 'contract'
      GROUP BY booking_id HAVING count(*) > 1
    ) sub
  ) AS bookings_still_with_multiple_contracts;

-- Cible :
--   total_bookings : 94
--   placeholder_remaining : 8 (les NO_GUESTS_ROW non auto-restituables — à traiter à la main)
--   contracts_active : ~66 (1 par booking concerné)
--   contracts_archived : ~29
--   bookings_still_with_multiple_contracts : 0
