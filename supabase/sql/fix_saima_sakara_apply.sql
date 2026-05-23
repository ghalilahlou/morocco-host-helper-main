-- =============================================================================
-- Correction Saima (21–23) / Sakara (23–28) — 7ème ciel
-- Exécuter dans Supabase SQL Editor OU : node tools/fix-saima-sakara.mjs
-- =============================================================================

-- IDs
-- Saima 21–23 : 6f160405-0bf9-44be-b156-42b95f570994
-- Sakara 23–28 : e6113444-9e48-4cef-8d45-e797478d7bf7
-- Guest Saima  : 315d84a6-4768-4d0a-9cce-eb06f08483c1

-- 1) Saima : pièce d’identité complète (ex-OCR « SAUNA RAB »)
UPDATE public.guests SET
  full_name = 'SAIMA RADYAH RAB',
  document_number = '558769636',
  date_of_birth = '1999-09-22',
  nationality = 'UNITED STATES OF AMERICA',
  document_type = 'passport',
  updated_at = now()
WHERE id = '315d84a6-4768-4d0a-9cce-eb06f08483c1'::uuid;

UPDATE public.bookings SET
  guest_name = 'SAIMA RADYAH RAB',
  number_of_guests = 1,
  check_in_date = '2026-05-21',
  check_out_date = '2026-05-23',
  updated_at = now()
WHERE id = '6f160405-0bf9-44be-b156-42b95f570994'::uuid;

-- 2) Soumission Saima (dates 21–23)
UPDATE public.guest_submissions SET
  booking_data = jsonb_build_object(
    'checkIn', '2026-05-21',
    'checkOut', '2026-05-23',
    'numberOfGuests', 1,
    'nightsCount', 2,
    'airbnbCode', 'INDEPENDENT_BOOKING',
    'propertyName', '7ème ciel – Vue sur l''océan - 2 chambres'
  ),
  guest_data = jsonb_build_object(
    'fullName', 'SAIMA RADYAH RAB',
    'documentNumber', '558769636',
    'guests', jsonb_build_array(jsonb_build_object(
      'fullName', 'SAIMA RADYAH RAB',
      'firstName', 'Saima',
      'lastName', 'Radyah Rab',
      'idType', 'passport',
      'idNumber', '558769636',
      'documentNumber', '558769636',
      'dateOfBirth', '1999-09-22',
      'documentIssueDate', '2027-03-12',
      'nationality', 'United States of America',
      'profession', 'Administrator',
      'motifSejour', 'TOURISME',
      'adressePersonnelle', '1955 Lardner Street, Philadelphia, PA'
    ))
  ),
  status = 'completed',
  updated_at = now()
WHERE booking_id = '6f160405-0bf9-44be-b156-42b95f570994'::uuid;

-- 3) Scans ID → résa Saima
UPDATE public.uploaded_documents SET
  booking_id = '6f160405-0bf9-44be-b156-42b95f570994'::uuid,
  guest_id = '315d84a6-4768-4d0a-9cce-eb06f08483c1'::uuid,
  updated_at = now()
WHERE booking_id = 'e6113444-9e48-4cef-8d45-e797478d7bf7'::uuid
  AND document_type = 'identity';

-- 4) Sakara : vider invités erronés (SAUNA / RAFID)
DELETE FROM public.guests
WHERE booking_id = 'e6113444-9e48-4cef-8d45-e797478d7bf7'::uuid;

UPDATE public.bookings SET
  guest_name = 'SAKARA (à compléter)',
  number_of_guests = 2,
  check_in_date = '2026-05-23',
  check_out_date = '2026-05-28',
  updated_at = now()
WHERE id = 'e6113444-9e48-4cef-8d45-e797478d7bf7'::uuid;

UPDATE public.guest_submissions SET
  booking_data = jsonb_build_object(
    'checkIn', '2026-05-23',
    'checkOut', '2026-05-28',
    'numberOfGuests', 2,
    'nightsCount', 5,
    'airbnbCode', 'INDEPENDENT_BOOKING',
    'propertyName', '7ème ciel – Vue sur l''océan - 2 chambres'
  ),
  guest_data = jsonb_build_object('guests', '[]'::jsonb),
  status = 'pending',
  updated_at = now()
WHERE booking_id = 'e6113444-9e48-4cef-8d45-e797478d7bf7'::uuid;

-- 5) Supprimer PDF erronés Sakara (+ contrat/police obsolètes Saima avant regen)
DELETE FROM public.generated_documents
WHERE booking_id IN (
  '6f160405-0bf9-44be-b156-42b95f570994'::uuid,
  'e6113444-9e48-4cef-8d45-e797478d7bf7'::uuid
);

DELETE FROM public.uploaded_documents
WHERE booking_id IN (
  '6f160405-0bf9-44be-b156-42b95f570994'::uuid,
  'e6113444-9e48-4cef-8d45-e797478d7bf7'::uuid
)
AND document_type IN ('contract', 'police');

-- 6) Vérification
SELECT b.id, b.check_in_date, b.check_out_date, b.guest_name,
  (SELECT string_agg(g.full_name, ' | ') FROM public.guests g WHERE g.booking_id = b.id) AS guests
FROM public.bookings b
WHERE b.id IN (
  '6f160405-0bf9-44be-b156-42b95f570994'::uuid,
  'e6113444-9e48-4cef-8d45-e797478d7bf7'::uuid
)
ORDER BY b.check_in_date;

-- Puis régénérer documents Saima (PowerShell, depuis la racine du projet) :
-- node tools/fix-saima-sakara.mjs
-- ou curl :
-- curl -X POST "%SUPABASE_URL%/functions/v1/submit-guest-info-unified" ^
--   -H "Authorization: Bearer %SUPABASE_SERVICE_ROLE_KEY%" ^
--   -H "Content-Type: application/json" ^
--   -d "{\"action\":\"generate_all_documents\",\"bookingId\":\"6f160405-0bf9-44be-b156-42b95f570994\",\"documentTypes\":[\"contract\",\"police\"]}"
