-- Étape 1: Nettoyer définitivement toutes les données de test

-- Supprimer toutes les guest_submissions avec des tokens liés à des codes Airbnb (données de test)
DELETE FROM guest_submissions 
WHERE token_id IN (
    SELECT id FROM property_verification_tokens 
    WHERE booking_id NOT LIKE '________-____-____-____-____________'  -- Format UUID
    OR booking_id IS NULL
);

-- Supprimer tous les tokens avec des booking_id qui ne sont pas des UUIDs valides
DELETE FROM property_verification_tokens 
WHERE booking_id NOT LIKE '________-____-____-____-____________'  -- Format UUID
  OR booking_id IS NULL;

-- Vérifier l'état après nettoyage
SELECT 'Tokens restants' as type, count(*) as count FROM property_verification_tokens
UNION ALL
SELECT 'Submissions restantes' as type, count(*) as count FROM guest_submissions;