-- Migration pour ajouter le statut 'draft' aux réservations
-- Les réservations 'draft' ne sont pas affichées dans le calendrier
-- et ne sont créées qu'après validation complète (signature + documents)

-- ✅ IMPORTANT : PostgreSQL nécessite que les nouvelles valeurs ENUM soient commitées
-- avant de pouvoir être utilisées. Cette migration doit être exécutée en premier,
-- puis une deuxième migration créera l'index qui utilise 'draft'.

-- 1. Ajouter 'draft' à l'ENUM booking_status
ALTER TYPE booking_status ADD VALUE IF NOT EXISTS 'draft';

-- 2. Commenter le nouveau statut
COMMENT ON TYPE booking_status IS 'Statuts des réservations: draft (brouillon, non validé), pending (en attente), completed (complétée), archived (archivée)';

-- Note: L'index sera créé dans une migration séparée après le commit de cette transaction

