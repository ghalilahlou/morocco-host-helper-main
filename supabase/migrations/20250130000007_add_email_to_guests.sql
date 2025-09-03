-- Migration pour ajouter le champ email aux invités
-- Date: 2025-01-30

-- 1. Ajouter le champ email à la table guests
ALTER TABLE public.guests
ADD COLUMN IF NOT EXISTS email TEXT;

-- 2. Créer un index sur le champ email pour améliorer les performances
CREATE INDEX IF NOT EXISTS idx_guests_email ON public.guests(email);

-- 3. Ajouter une contrainte de validation pour l'email (optionnel mais valide si présent)
ALTER TABLE public.guests
ADD CONSTRAINT check_email_format 
CHECK (email IS NULL OR email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$');

-- 4. Ajouter un commentaire pour documenter le nouveau champ
COMMENT ON COLUMN public.guests.email IS 'Adresse email de l''invité (optionnel) pour l''envoi du contrat';

-- 5. Mettre à jour les types TypeScript si nécessaire
-- Note: Ceci nécessitera une mise à jour des types dans src/types/guestVerification.ts et autres fichiers
