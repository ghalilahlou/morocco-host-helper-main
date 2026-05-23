-- =============================================================================
-- Correction Saima (21–23 mai) vs Sakara (23–28 mai) — 7ème ciel
-- Passeport : SAIMA RADYAH RAB (souvent OCR « SAUNA RAB »)
-- =============================================================================

-- A) Vérification
SELECT
  b.id,
  b.check_in_date,
  b.check_out_date,
  b.guest_name,
  p.name AS property,
  (SELECT string_agg(g.full_name, ' | ') FROM public.guests g WHERE g.booking_id = b.id) AS guests
FROM public.bookings b
JOIN public.properties p ON p.id = b.property_id
WHERE b.property_id = 'a0ae5d83-41a7-49e4-8939-d1850ab3c61c'::uuid
  AND (
    (b.check_in_date = '2026-05-21' AND b.check_out_date = '2026-05-23')
    OR (b.check_in_date = '2026-05-23' AND b.check_out_date = '2026-05-28')
  )
ORDER BY b.check_in_date;

-- B) Soumission erronée (SAUNA RAB sur créneau 23–28 = données Saima mal routées)
SELECT
  gs.booking_id,
  gs.booking_data->>'checkIn' AS sub_check_in,
  gs.booking_data->>'checkOut' AS sub_check_out,
  gs.guest_data->'guests' AS submission_guests,
  gs.updated_at
FROM public.guest_submissions gs
WHERE gs.booking_id = 'e6113444-9e48-4cef-8d45-e797478d7bf7'::uuid;

-- C) Après correction script Node : résa Saima 21–23 + nettoyage guests fantômes sur 23–28
-- Exécuter tools/fix-saima-sakara.mjs ou laisser l’agent appliquer
