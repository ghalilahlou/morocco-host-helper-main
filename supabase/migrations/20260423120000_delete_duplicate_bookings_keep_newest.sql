-- Supprime les doublons (même bien + dates + référence), garde la ligne la plus récente.
-- Tout s’exécute dans un seul bloc PL/pgSQL (pas de TEMP TABLE : compatible pooler Supabase).
-- Puis index uniques partiels anti-récidive.

DO $$
DECLARE
  dup_ids uuid[];
BEGIN
  -- Scalar subquery : même avec 0 ligne à supprimer, dup_ids reçoit '{}' (pas « non assigné »).
  dup_ids := coalesce(
    (
      SELECT array_agg(id)
      FROM (
        SELECT
          id,
          row_number() OVER (
            PARTITION BY
              property_id,
              check_in_date,
              check_out_date,
              coalesce(booking_reference, '')
            ORDER BY
              created_at DESC NULLS LAST,
              id DESC
          ) AS rn
        FROM public.bookings
      ) ranked
      WHERE rn > 1
    ),
    '{}'::uuid[]
  );

  IF dup_ids = '{}'::uuid[] OR cardinality(dup_ids) = 0 THEN
    RAISE NOTICE 'Aucun doublon à supprimer';
    RETURN;
  END IF;

  DELETE FROM public.contract_signatures WHERE booking_id = ANY (dup_ids);
  DELETE FROM public.guest_submissions WHERE booking_id = ANY (dup_ids);
  DELETE FROM public.uploaded_documents WHERE booking_id = ANY (dup_ids);
  DELETE FROM public.guests WHERE booking_id = ANY (dup_ids);

  IF to_regclass('public.generated_documents') IS NOT NULL THEN
    DELETE FROM public.generated_documents WHERE booking_id = ANY (dup_ids);
  END IF;

  IF to_regclass('public.document_storage') IS NOT NULL THEN
    DELETE FROM public.document_storage WHERE booking_id = ANY (dup_ids);
  END IF;

  IF to_regclass('public.bookings_audit') IS NOT NULL THEN
    DELETE FROM public.bookings_audit WHERE booking_id = ANY (dup_ids);
  END IF;

  DELETE FROM public.bookings WHERE id = ANY (dup_ids);

  RAISE NOTICE 'Doublons supprimés: % ligne(s)', cardinality(dup_ids);
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_bookings_unique_independent_stay
  ON public.bookings (property_id, check_in_date, check_out_date)
  WHERE booking_reference = 'INDEPENDENT_BOOKING';

CREATE UNIQUE INDEX IF NOT EXISTS idx_bookings_unique_null_ref_stay
  ON public.bookings (property_id, check_in_date, check_out_date)
  WHERE booking_reference IS NULL;
