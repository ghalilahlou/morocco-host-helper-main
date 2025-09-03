-- Migration pour ajouter le champ profession à la table guests
-- Date: 2025-01-30

-- Ajouter le champ profession à la table guests
ALTER TABLE public.guests 
ADD COLUMN IF NOT EXISTS profession TEXT;

-- Ajouter le champ motif_sejour à la table guests pour permettre la sélection du motif
ALTER TABLE public.guests 
ADD COLUMN IF NOT EXISTS motif_sejour TEXT DEFAULT 'TOURISME';

-- Ajouter le champ adresse_personnelle à la table guests pour l'adresse personnelle de l'invité
ALTER TABLE public.guests 
ADD COLUMN IF NOT EXISTS adresse_personnelle TEXT;

-- Mettre à jour les types TypeScript si nécessaire
-- Note: Ceci nécessitera une mise à jour des types dans src/types/guestVerification.ts et autres fichiers

-- Ajouter des commentaires pour documenter les nouveaux champs
COMMENT ON COLUMN public.guests.profession IS 'Profession de l''invité';
COMMENT ON COLUMN public.guests.motif_sejour IS 'Motif du séjour (TOURISME, AFFAIRES, FAMILLE, etc.)';
COMMENT ON COLUMN public.guests.adresse_personnelle IS 'Adresse personnelle de l''invité (au Maroc ou à l''étranger)';

-- Créer un index sur le champ profession pour améliorer les performances des requêtes
CREATE INDEX IF NOT EXISTS idx_guests_profession ON public.guests(profession);

-- Créer un index sur le champ motif_sejour
CREATE INDEX IF NOT EXISTS idx_guests_motif_sejour ON public.guests(motif_sejour);
