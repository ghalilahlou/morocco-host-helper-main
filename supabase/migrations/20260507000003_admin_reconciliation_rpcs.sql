-- ============================================================
-- Admin Reconciliation RPCs
-- Détection et correction des champs manquants / incohérents
-- dans les guests et bookings (fiches de police / contrats)
-- ============================================================

-- ------------------------------------------------------------
-- 1. Helper: admin_safe_to_date
--    Préfixé "admin_" pour éviter tout conflit avec des fonctions
--    système. STABLE (pas IMMUTABLE) car les blocs EXCEPTION
--    empêchent l'optimisation IMMUTABLE sur certaines versions PG.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_safe_to_date(p_text TEXT)
RETURNS DATE
STABLE
LANGUAGE plpgsql
SET search_path = public AS $$
BEGIN
  IF p_text IS NULL OR trim(p_text) = '' THEN
    RETURN NULL;
  END IF;
  -- Format ISO YYYY-MM-DD
  BEGIN
    RETURN trim(p_text)::DATE;
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;
  -- Format DD/MM/YYYY
  BEGIN
    RETURN TO_DATE(trim(p_text), 'DD/MM/YYYY');
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;
  RETURN NULL;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_safe_to_date(TEXT) TO authenticated;

-- ------------------------------------------------------------
-- 2. admin_get_discrepant_bookings
--    Retourne (JSONB) les réservations ayant des champs
--    manquants ou incohérents. Seuls les admins actifs y ont accès.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_get_discrepant_bookings()
RETURNS JSONB
SECURITY DEFINER
LANGUAGE plpgsql
SET search_path = public, auth AS $$
DECLARE
  v_result JSONB;
BEGIN
  -- Guard: seuls les admins actifs
  IF NOT EXISTS (
    SELECT 1 FROM public.admin_users
    WHERE user_id = auth.uid() AND is_active = true
  ) THEN
    RAISE EXCEPTION 'Accès refusé';
  END IF;

  WITH booking_with_sub AS (
    SELECT
      b.id                AS booking_id,
      b.booking_reference,
      p.name              AS property_name,
      b.check_in_date,
      b.check_out_date,
      b.status,
      b.created_at,
      gs.id               AS submission_id,
      gs.booking_data     AS sub_booking_data,
      gs.guest_data       AS sub_guest_data
    FROM public.bookings b
    LEFT JOIN public.properties p ON p.id = b.property_id
    LEFT JOIN LATERAL (
      SELECT id, booking_data, guest_data
      FROM public.guest_submissions
      WHERE booking_id = b.id
      ORDER BY created_at DESC NULLS LAST
      LIMIT 1
    ) gs ON true
    WHERE b.status::text IN ('pending', 'confirmed', 'completed')
  ),
  booking_guests AS (
    -- to_jsonb(g.*) sérialise toutes les colonnes qui existent réellement
    -- → les accès ->>'profession' retournent NULL si la colonne est absente
    SELECT
      g.booking_id,
      jsonb_agg(to_jsonb(g.*) ORDER BY g.created_at) AS guests
    FROM public.guests g
    GROUP BY g.booking_id
  ),
  flagged AS (
    SELECT
      bws.*,
      bg.guests,
      array_remove(ARRAY[
        -- Mismatch date check-in
        CASE
          WHEN bws.sub_booking_data->>'checkInDate' IS NOT NULL
            AND bws.check_in_date IS NOT NULL
            AND public.admin_safe_to_date(bws.sub_booking_data->>'checkInDate') IS NOT NULL
            AND bws.check_in_date <> public.admin_safe_to_date(bws.sub_booking_data->>'checkInDate')
          THEN 'date_checkin_mismatch'
        END,
        -- Mismatch date check-out
        CASE
          WHEN bws.sub_booking_data->>'checkOutDate' IS NOT NULL
            AND bws.check_out_date IS NOT NULL
            AND public.admin_safe_to_date(bws.sub_booking_data->>'checkOutDate') IS NOT NULL
            AND bws.check_out_date <> public.admin_safe_to_date(bws.sub_booking_data->>'checkOutDate')
          THEN 'date_checkout_mismatch'
        END,
        -- Date de naissance suspecte
        CASE
          WHEN EXISTS (
            SELECT 1 FROM jsonb_array_elements(COALESCE(bg.guests, '[]'::jsonb)) AS g
            WHERE public.admin_safe_to_date(g->>'date_of_birth') IS NOT NULL
              AND (
                public.admin_safe_to_date(g->>'date_of_birth') > CURRENT_DATE
                OR public.admin_safe_to_date(g->>'date_of_birth') < CURRENT_DATE - INTERVAL '100 years'
              )
          )
          THEN 'dob_suspicious'
        END,
        -- Numéro de document trop court (< 6 caractères)
        CASE
          WHEN EXISTS (
            SELECT 1 FROM jsonb_array_elements(COALESCE(bg.guests, '[]'::jsonb)) AS g
            WHERE (g->>'document_number') IS NOT NULL
              AND trim(g->>'document_number') <> ''
              AND length(trim(g->>'document_number')) < 6
          )
          THEN 'document_number_suspect'
        END,
        -- Champs requis fiche de police manquants
        CASE
          WHEN EXISTS (
            SELECT 1 FROM jsonb_array_elements(COALESCE(bg.guests, '[]'::jsonb)) AS g
            WHERE (g->>'profession'          IS NULL OR trim(g->>'profession')          = '')
               OR (g->>'motif_sejour'        IS NULL OR trim(g->>'motif_sejour')        = '')
               OR (g->>'adresse_personnelle' IS NULL OR trim(g->>'adresse_personnelle') = '')
          )
          THEN 'missing_required_fields'
        END,
        -- Numéro de document manquant
        CASE
          WHEN EXISTS (
            SELECT 1 FROM jsonb_array_elements(COALESCE(bg.guests, '[]'::jsonb)) AS g
            WHERE g->>'document_number' IS NULL OR trim(g->>'document_number') = ''
          )
          THEN 'missing_document_number'
        END,
        -- Date de naissance manquante
        CASE
          WHEN EXISTS (
            SELECT 1 FROM jsonb_array_elements(COALESCE(bg.guests, '[]'::jsonb)) AS g
            WHERE g->>'date_of_birth' IS NULL
          )
          THEN 'missing_dob'
        END
      ], NULL) AS flags
    FROM booking_with_sub bws
    JOIN booking_guests bg ON bg.booking_id = bws.booking_id
  )
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'booking_id',              f.booking_id,
        'booking_reference',       f.booking_reference,
        'property_name',           f.property_name,
        'check_in_date',           f.check_in_date,
        'check_out_date',          f.check_out_date,
        'status',                  f.status,
        'created_at',              f.created_at,
        'submission_id',           f.submission_id,
        'submission_booking_data', f.sub_booking_data,
        'submission_guest_data',   f.sub_guest_data,
        'guests',                  f.guests,
        'flags',                   to_jsonb(f.flags),
        'severity', CASE
          WHEN f.flags && ARRAY[
            'date_checkin_mismatch','date_checkout_mismatch',
            'dob_suspicious','document_number_suspect',
            'missing_document_number','missing_dob'
          ] THEN 'critical'
          ELSE 'warning'
        END
      )
      ORDER BY
        CASE WHEN f.flags && ARRAY['date_checkin_mismatch','date_checkout_mismatch','dob_suspicious']
          THEN 0 ELSE 1 END,
        f.check_in_date DESC NULLS LAST
    ),
    '[]'::jsonb
  )
  INTO v_result
  FROM flagged f
  WHERE array_length(f.flags, 1) > 0;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_get_discrepant_bookings() TO authenticated;

-- ------------------------------------------------------------
-- 3. admin_correct_guest_field
--    Whitelist stricte des champs autorisés + audit log.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_correct_guest_field(
  p_guest_id UUID,
  p_field    TEXT,
  p_value    TEXT,
  p_reason   TEXT DEFAULT NULL
)
RETURNS VOID
SECURITY DEFINER
LANGUAGE plpgsql
SET search_path = public, auth AS $$
DECLARE
  v_old_value  TEXT;
  v_booking_id UUID;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.admin_users
    WHERE user_id = auth.uid() AND is_active = true
  ) THEN
    RAISE EXCEPTION 'Accès refusé';
  END IF;

  SELECT booking_id INTO v_booking_id FROM public.guests WHERE id = p_guest_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invité introuvable: %', p_guest_id;
  END IF;

  CASE p_field
    WHEN 'full_name' THEN
      SELECT full_name INTO v_old_value FROM public.guests WHERE id = p_guest_id;
      UPDATE public.guests SET full_name = p_value, updated_at = now() WHERE id = p_guest_id;

    WHEN 'date_of_birth' THEN
      SELECT date_of_birth::TEXT INTO v_old_value FROM public.guests WHERE id = p_guest_id;
      UPDATE public.guests SET date_of_birth = public.admin_safe_to_date(p_value), updated_at = now() WHERE id = p_guest_id;

    WHEN 'document_number' THEN
      SELECT document_number INTO v_old_value FROM public.guests WHERE id = p_guest_id;
      UPDATE public.guests SET document_number = p_value, updated_at = now() WHERE id = p_guest_id;

    WHEN 'document_type' THEN
      SELECT document_type INTO v_old_value FROM public.guests WHERE id = p_guest_id;
      UPDATE public.guests SET document_type = p_value, updated_at = now() WHERE id = p_guest_id;

    WHEN 'document_issue_date' THEN
      SELECT document_issue_date::TEXT INTO v_old_value FROM public.guests WHERE id = p_guest_id;
      UPDATE public.guests SET document_issue_date = public.admin_safe_to_date(p_value), updated_at = now() WHERE id = p_guest_id;

    WHEN 'nationality' THEN
      SELECT nationality INTO v_old_value FROM public.guests WHERE id = p_guest_id;
      UPDATE public.guests SET nationality = p_value, updated_at = now() WHERE id = p_guest_id;

    WHEN 'place_of_birth' THEN
      SELECT place_of_birth INTO v_old_value FROM public.guests WHERE id = p_guest_id;
      UPDATE public.guests SET place_of_birth = p_value, updated_at = now() WHERE id = p_guest_id;

    WHEN 'profession' THEN
      SELECT profession INTO v_old_value FROM public.guests WHERE id = p_guest_id;
      UPDATE public.guests SET profession = p_value, updated_at = now() WHERE id = p_guest_id;

    WHEN 'motif_sejour' THEN
      SELECT motif_sejour INTO v_old_value FROM public.guests WHERE id = p_guest_id;
      UPDATE public.guests SET motif_sejour = p_value, updated_at = now() WHERE id = p_guest_id;

    WHEN 'adresse_personnelle' THEN
      SELECT adresse_personnelle INTO v_old_value FROM public.guests WHERE id = p_guest_id;
      UPDATE public.guests SET adresse_personnelle = p_value, updated_at = now() WHERE id = p_guest_id;

    WHEN 'email' THEN
      SELECT email INTO v_old_value FROM public.guests WHERE id = p_guest_id;
      UPDATE public.guests SET email = p_value, updated_at = now() WHERE id = p_guest_id;

    ELSE
      RAISE EXCEPTION 'Champ non autorisé: %', p_field;
  END CASE;

  INSERT INTO public.admin_activity_logs (
    admin_user_id, action, resource_type, resource_id, details
  ) VALUES (
    auth.uid(),
    'correct_guest_field',
    'guest',
    p_guest_id,
    jsonb_build_object(
      'field',      p_field,
      'old_value',  v_old_value,
      'new_value',  p_value,
      'booking_id', v_booking_id,
      'reason',     p_reason
    )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_correct_guest_field(UUID, TEXT, TEXT, TEXT) TO authenticated;

-- ------------------------------------------------------------
-- 4. admin_correct_booking_dates
--    Corrige check-in / check-out + validation + audit log.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_correct_booking_dates(
  p_booking_id     UUID,
  p_check_in_date  TEXT DEFAULT NULL,
  p_check_out_date TEXT DEFAULT NULL,
  p_reason         TEXT DEFAULT NULL
)
RETURNS VOID
SECURITY DEFINER
LANGUAGE plpgsql
SET search_path = public, auth AS $$
DECLARE
  v_old_checkin  DATE;
  v_old_checkout DATE;
  v_new_checkin  DATE;
  v_new_checkout DATE;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.admin_users
    WHERE user_id = auth.uid() AND is_active = true
  ) THEN
    RAISE EXCEPTION 'Accès refusé';
  END IF;

  SELECT check_in_date, check_out_date
  INTO   v_old_checkin, v_old_checkout
  FROM   public.bookings
  WHERE  id = p_booking_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Réservation introuvable: %', p_booking_id;
  END IF;

  v_new_checkin  := COALESCE(public.admin_safe_to_date(p_check_in_date),  v_old_checkin);
  v_new_checkout := COALESCE(public.admin_safe_to_date(p_check_out_date), v_old_checkout);

  IF v_new_checkin >= v_new_checkout THEN
    RAISE EXCEPTION 'La date de check-in (%) doit être antérieure au check-out (%)',
      v_new_checkin, v_new_checkout;
  END IF;

  UPDATE public.bookings SET
    check_in_date  = v_new_checkin,
    check_out_date = v_new_checkout,
    updated_at     = now()
  WHERE id = p_booking_id;

  INSERT INTO public.admin_activity_logs (
    admin_user_id, action, resource_type, resource_id, details
  ) VALUES (
    auth.uid(),
    'correct_booking_dates',
    'booking',
    p_booking_id,
    jsonb_build_object(
      'old_check_in_date',  v_old_checkin,
      'new_check_in_date',  v_new_checkin,
      'old_check_out_date', v_old_checkout,
      'new_check_out_date', v_new_checkout,
      'reason',             p_reason
    )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_correct_booking_dates(UUID, TEXT, TEXT, TEXT) TO authenticated;

-- Recharger le cache PostgREST pour exposer immédiatement les nouvelles fonctions
NOTIFY pgrst, 'reload schema';
