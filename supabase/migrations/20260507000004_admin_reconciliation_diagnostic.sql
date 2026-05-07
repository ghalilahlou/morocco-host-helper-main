-- ============================================================
-- DIAGNOSTIC SCRIPT — à exécuter dans le SQL Editor Supabase
-- pour identifier pourquoi admin_get_discrepant_bookings échoue
-- ============================================================

-- 1. Vérifier que la fonction existe
SELECT
  proname AS function_name,
  prosecdef AS security_definer,
  proconfig AS config
FROM pg_proc
WHERE proname = 'admin_get_discrepant_bookings'
  AND pronamespace = 'public'::regnamespace;

-- 2. Vérifier les colonnes de guest_submissions
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'guest_submissions'
ORDER BY ordinal_position;

-- 3. Vérifier les colonnes de guests
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'guests'
ORDER BY ordinal_position;

-- 4. Vérifier les colonnes de bookings
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'bookings'
ORDER BY ordinal_position;

-- 5. Tester manuellement la logique centrale (sans guard admin)
--    Copie cette partie seule si tu veux tester le SQL brut
WITH booking_with_sub AS (
  SELECT
    b.id AS booking_id,
    b.booking_reference,
    b.check_in_date,
    b.check_out_date,
    gs.id AS submission_id,
    gs.booking_data AS sub_booking_data
  FROM public.bookings b
  LEFT JOIN LATERAL (
    SELECT id, booking_data
    FROM public.guest_submissions
    WHERE booking_id = b.id
    ORDER BY created_at DESC NULLS LAST
    LIMIT 1
  ) gs ON true
  WHERE b.status::text IN ('pending', 'confirmed', 'completed')
  LIMIT 5
),
booking_guests AS (
  SELECT
    g.booking_id,
    COUNT(*) AS guest_count,
    jsonb_agg(to_jsonb(g.*) ORDER BY g.created_at) AS guests
  FROM public.guests g
  GROUP BY g.booking_id
)
SELECT
  bws.booking_id,
  bws.booking_reference,
  bws.check_in_date,
  bws.check_out_date,
  bws.submission_id IS NOT NULL AS has_submission,
  bg.guest_count
FROM booking_with_sub bws
LEFT JOIN booking_guests bg ON bg.booking_id = bws.booking_id;

-- 6. Forcer le reload du cache PostgREST
SELECT pg_notify('pgrst', 'reload schema');
