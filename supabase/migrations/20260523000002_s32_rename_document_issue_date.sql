-- S32 : Renommer document_issue_date → document_expiry_date dans la table guests
-- La colonne stocke la date d'EXPIRATION (pas d'émission) — le nom était trompeur.
-- ⚠️  DÉPLOYER PROGRESSIVEMENT :
--   1. Appliquer cette migration (crée la vue alias)
--   2. Déployer le front-end et les Edge Functions avec le nouveau nom
--   3. Supprimer la vue alias dans 30 jours

-- 1. Renommer la colonne
ALTER TABLE public.guests
  RENAME COLUMN document_issue_date TO document_expiry_date;

-- 2. Vue de compatibilité pour les lectures legacy (30 jours de grâce)
-- DROP cette vue après avoir migré tout le code consommateur.
CREATE OR REPLACE VIEW public.guests_legacy AS
  SELECT
    *,
    document_expiry_date AS document_issue_date  -- alias rétrocompatible
  FROM public.guests;

COMMENT ON VIEW public.guests_legacy IS
  'Vue de compatibilité temporaire post-migration S32. À supprimer après 2026-06-23.';

COMMENT ON COLUMN public.guests.document_expiry_date IS
  'Date d''expiration du document d''identité (YYYY-MM-DD). Anciennement document_issue_date.';
