-- Migration: Ajouter la colonne document_issue_date à la table guests
-- Description: Cette colonne stocke la date de délivrance de la pièce d'identité du guest
-- Date: 2026-02-06

-- Ajouter la colonne document_issue_date à la table guests
ALTER TABLE public.guests
ADD COLUMN IF NOT EXISTS document_issue_date DATE;

-- Ajouter un commentaire explicatif
COMMENT ON COLUMN public.guests.document_issue_date IS 'Date de délivrance de la pièce d''identité du guest (Date of issue)';

-- Créer un index pour les recherches par date de délivrance (optionnel, mais utile pour les requêtes)
CREATE INDEX IF NOT EXISTS idx_guests_document_issue_date 
ON public.guests(document_issue_date) 
WHERE document_issue_date IS NOT NULL;
