-- Ajouter la colonne is_preview à la table bookings pour identifier les réservations temporaires d'aperçu
ALTER TABLE bookings 
ADD COLUMN IF NOT EXISTS is_preview BOOLEAN DEFAULT FALSE;

-- Créer un index pour faciliter les requêtes de nettoyage
CREATE INDEX IF NOT EXISTS idx_bookings_is_preview ON bookings(is_preview) WHERE is_preview = TRUE;

-- Commentaire pour documentation
COMMENT ON COLUMN bookings.is_preview IS 'Indique si cette réservation est temporaire (créée pour un aperçu de document)';


