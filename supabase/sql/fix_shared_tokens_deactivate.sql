-- =============================================================================
-- Désactiver les tokens « bus partagé » (1 token → plusieurs réservations)
-- Exécuter dans Supabase SQL Editor
-- =============================================================================

-- A) Audit (avant correction)
SELECT
  gs.token_id,
  count(DISTINCT gs.booking_id) AS nb_bookings,
  count(*) AS submissions_count,
  pvt.is_active,
  left(pvt.token, 16) AS token_prefix,
  pvt.property_id,
  pvt.booking_id AS token_booking_id
FROM public.guest_submissions gs
LEFT JOIN public.property_verification_tokens pvt ON pvt.id = gs.token_id
WHERE gs.token_id IS NOT NULL
GROUP BY gs.token_id, pvt.is_active, pvt.token, pvt.property_id, pvt.booking_id
HAVING count(DISTINCT gs.booking_id) > 1
ORDER BY nb_bookings DESC;

-- B) Désactivation des 5 tokens identifiés (+ métadonnée de traçabilité)
UPDATE public.property_verification_tokens
SET
  is_active = false,
  updated_at = now(),
  metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
    'deactivatedReason', 'shared_token_fix',
    'deactivatedAt', to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
  )
WHERE id IN (
  '50d51c12-127c-4a93-9cd3-5d988175e47a'::uuid,
  '5cc9acf4-c299-48e7-8ada-084e9932c7ab'::uuid,
  '73a33917-1a1e-4c27-a4c0-b4b8c7441945'::uuid,
  'aee301ed-6505-46f0-9d4f-4222634b8fe5'::uuid,
  'f6309bc8-0c51-4856-b8b8-de7370c65470'::uuid
)
AND is_active = true;

-- C) Désactiver TOUS les tokens encore actifs liés à >1 booking (filet automatique)
UPDATE public.property_verification_tokens pvt
SET
  is_active = false,
  updated_at = now(),
  metadata = coalesce(pvt.metadata, '{}'::jsonb) || jsonb_build_object(
    'deactivatedReason', 'shared_token_auto_audit',
    'deactivatedAt', to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
  )
WHERE pvt.is_active = true
  AND pvt.id IN (
    SELECT gs.token_id
    FROM public.guest_submissions gs
    WHERE gs.token_id IS NOT NULL
    GROUP BY gs.token_id
    HAVING count(DISTINCT gs.booking_id) > 1
  );

-- D) Vérification (doit retourner 0 ligne avec is_active = true)
SELECT
  gs.token_id,
  count(DISTINCT gs.booking_id) AS nb_bookings,
  pvt.is_active
FROM public.guest_submissions gs
JOIN public.property_verification_tokens pvt ON pvt.id = gs.token_id
WHERE gs.token_id IS NOT NULL
GROUP BY gs.token_id, pvt.is_active
HAVING count(DISTINCT gs.booking_id) > 1 AND pvt.is_active = true;

-- E) Prévention (optionnel — à appliquer une fois les liens corrigés)
-- CREATE UNIQUE INDEX IF NOT EXISTS idx_one_active_token_per_booking
-- ON public.property_verification_tokens (booking_id)
-- WHERE is_active = true AND booking_id IS NOT NULL;
