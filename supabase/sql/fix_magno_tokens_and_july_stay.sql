-- =============================================================================
-- Magno / La pépite — désactivation des 11 anciens tokens + option séjour juillet
-- Exécuter dans Supabase SQL Editor (rôle service / postgres).
--
-- CONFIRMATION MÉTIER : aucune trace de 10–12 juillet 2026 pour Magno en base.
-- Séjour actuel : 29168681… (13–15 mai 2026). Décommenter la section B seulement
-- si le séjour réel Airbnb est bien 10–12/07/2026.
-- =============================================================================

-- A) Désactiver tous les liens actifs pointant vers la résa mai (11 tokens)
UPDATE public.property_verification_tokens
SET
  is_active = false,
  updated_at = now()
WHERE booking_id = '29168681-a9db-400d-b2ea-ca8f7ae7fa1d'::uuid
  AND is_active = true;

-- Vérification
SELECT id, created_at, is_active, metadata->'reservationData'->>'guestName' AS meta_guest
FROM public.property_verification_tokens
WHERE booking_id = '29168681-a9db-400d-b2ea-ca8f7ae7fa1d'::uuid
ORDER BY created_at DESC;

-- ---------------------------------------------------------------------------
-- B) OPTIONNEL — Nouvelle réservation 10–12 juillet 2026 (à décommenter après validation hôte)
-- Propriété : La pépite de Gauthier (e9014f29-d8dd-45ce-adbb-d0497a13987f)
-- ---------------------------------------------------------------------------
/*
INSERT INTO public.bookings (
  user_id,
  property_id,
  check_in_date,
  check_out_date,
  guest_name,
  number_of_guests,
  booking_reference,
  status,
  created_at,
  updated_at
)
SELECT
  p.user_id,
  'e9014f29-d8dd-45ce-adbb-d0497a13987f'::uuid,
  '2026-07-10'::date,
  '2026-07-12'::date,
  'JANSEN GERALD MAGNO',
  3,
  'INDEPENDENT_BOOKING',
  'pending',
  now(),
  now()
FROM public.properties p
WHERE p.id = 'e9014f29-d8dd-45ce-adbb-d0497a13987f'::uuid
  AND NOT EXISTS (
    SELECT 1 FROM public.bookings b
    WHERE b.property_id = p.id
      AND b.booking_reference = 'INDEPENDENT_BOOKING'
      AND b.check_in_date = '2026-07-10'::date
      AND b.check_out_date = '2026-07-12'::date
  )
RETURNING id, check_in_date, check_out_date, guest_name;
*/
-- Puis émettre un NOUVEAU lien invité depuis l’app (UnifiedBookingModal) sur ce booking_id.
