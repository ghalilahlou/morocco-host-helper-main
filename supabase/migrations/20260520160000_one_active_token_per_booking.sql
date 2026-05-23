-- Un seul lien invité actif par réservation (évite 11+ tokens sur le même booking_id)
CREATE UNIQUE INDEX IF NOT EXISTS idx_one_active_token_per_booking
ON public.property_verification_tokens (booking_id)
WHERE is_active = true AND booking_id IS NOT NULL;

COMMENT ON INDEX public.idx_one_active_token_per_booking IS
  'Au plus un property_verification_token actif par booking_id';
