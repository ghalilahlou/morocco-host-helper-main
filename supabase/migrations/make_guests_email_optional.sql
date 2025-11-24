-- Rendre la colonne email optionnelle dans la table guests
-- Car pour les aperçus et rencontres physiques, l'email n'est pas toujours nécessaire

ALTER TABLE guests 
ALTER COLUMN email DROP NOT NULL;

-- Commentaire pour documentation
COMMENT ON COLUMN guests.email IS 'Email du guest (optionnel - peut être NULL pour les aperçus ou rencontres physiques)';


