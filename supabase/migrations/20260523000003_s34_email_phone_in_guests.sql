-- S34 : Ajouter email et phone par voyageur dans la table guests
-- Décision : chaque voyageur peut avoir son propre email/téléphone (ex : groupes).
-- Le email du booking reste le contact principal de l'hôte.

ALTER TABLE public.guests
  ADD COLUMN IF NOT EXISTS email TEXT,
  ADD COLUMN IF NOT EXISTS phone TEXT;

COMMENT ON COLUMN public.guests.email IS
  'Email du voyageur (optionnel). Distinct de bookings.guest_email (contact principal hôte).';
COMMENT ON COLUMN public.guests.phone IS
  'Téléphone du voyageur (optionnel). Distinct de bookings.guest_phone.';

-- Index pour retrouver un guest par email (cas support)
CREATE INDEX IF NOT EXISTS idx_guests_email
  ON public.guests(email)
  WHERE email IS NOT NULL;
