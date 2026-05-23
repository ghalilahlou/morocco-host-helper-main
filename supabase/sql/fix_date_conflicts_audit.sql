-- =============================================================================
-- Audit conflits de dates (bookings vs guest_submissions vs tokens)
-- =============================================================================

-- 1) Soumission invité ≠ dates enregistrées sur la réservation
SELECT
  b.id AS booking_id,
  p.name AS property_name,
  b.guest_name,
  b.check_in_date AS booking_check_in,
  b.check_out_date AS booking_check_out,
  (gs.booking_data->>'checkIn')::text AS submission_check_in,
  (gs.booking_data->>'checkOut')::text AS submission_check_out,
  gs.updated_at AS submission_updated_at,
  (
    SELECT string_agg(
      coalesce(g_elem->>'fullName', g_elem->>'full_name', '?'),
      ' | '
    )
    FROM jsonb_array_elements(
      CASE
        WHEN jsonb_typeof(gs.guest_data->'guests') = 'array' THEN gs.guest_data->'guests'
        ELSE '[]'::jsonb
      END
    ) AS g_elem
  ) AS submission_guest_names
FROM public.guest_submissions gs
JOIN public.bookings b ON b.id = gs.booking_id
LEFT JOIN public.properties p ON p.id = b.property_id
WHERE gs.booking_data IS NOT NULL
  AND (gs.booking_data->>'checkIn') IS NOT NULL
  AND (
    b.check_in_date::text IS DISTINCT FROM left(gs.booking_data->>'checkIn', 10)
    OR b.check_out_date::text IS DISTINCT FROM left(gs.booking_data->>'checkOut', 10)
  )
ORDER BY gs.updated_at DESC
LIMIT 100;

-- 2) Token partagé : un token_id → plusieurs booking_id (cause majeure)
SELECT
  gs.token_id,
  count(DISTINCT gs.booking_id) AS bookings_distincts,
  count(*) AS submissions_count,
  min(gs.updated_at) AS first_submission,
  max(gs.updated_at) AS last_submission
FROM public.guest_submissions gs
WHERE gs.token_id IS NOT NULL
GROUP BY gs.token_id
HAVING count(DISTINCT gs.booking_id) > 1
ORDER BY bookings_distincts DESC
LIMIT 30;

-- 3) Mai 2026 : séjours 21-23 vs 23-28 (pattern Samia / Sakara)
SELECT
  b.id,
  p.name AS property_name,
  b.guest_name,
  b.check_in_date,
  b.check_out_date,
  (SELECT string_agg(g.full_name, ' | ') FROM public.guests g WHERE g.booking_id = b.id) AS guests_names
FROM public.bookings b
LEFT JOIN public.properties p ON p.id = b.property_id
WHERE (b.check_in_date = '2026-05-21' AND b.check_out_date = '2026-05-23')
   OR (b.check_in_date = '2026-05-23' AND b.check_out_date = '2026-05-28')
ORDER BY b.check_in_date;

-- 4) Magno juillet (nouvelle résa)
SELECT b.*, (SELECT count(*) FROM public.guests g WHERE g.booking_id = b.id) AS n_guests
FROM public.bookings b
WHERE b.property_id = 'e9014f29-d8dd-45ce-adbb-d0497a13987f'::uuid
  AND b.check_in_date = '2026-07-10'
  AND b.check_out_date = '2026-07-12';
