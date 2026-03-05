-- Fix PGRST204: ajouter la colonne email (nullable) à guests si elle n'existe pas.
-- L'ancien front peut envoyer email; on l'accepte en nullable pour que l'insert réussisse.
-- Dans le flux "host sans signature", l'email n'est pas utilisé (raison pratique).

ALTER TABLE public.guests
ADD COLUMN IF NOT EXISTS email TEXT;

COMMENT ON COLUMN public.guests.email IS 'Email invité (optionnel, nullable). Non utilisé dans le flux host sans signature.';
