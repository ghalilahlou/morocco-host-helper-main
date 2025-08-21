-- Étape 1: Nettoyer les références dans bookings vers des submissions de test
UPDATE bookings 
SET submission_id = NULL
WHERE submission_id IN (
    SELECT gs.id FROM guest_submissions gs
    JOIN property_verification_tokens pvt ON pvt.id = gs.token_id
    WHERE pvt.booking_id NOT LIKE '________-____-____-____-____________'
    OR pvt.booking_id IS NULL
);

-- Étape 2: Supprimer toutes les guest_submissions avec des tokens liés à des codes Airbnb
DELETE FROM guest_submissions 
WHERE token_id IN (
    SELECT id FROM property_verification_tokens 
    WHERE booking_id NOT LIKE '________-____-____-____-____________'
    OR booking_id IS NULL
);

-- Étape 3: Supprimer tous les tokens avec des booking_id qui ne sont pas des UUIDs valides  
DELETE FROM property_verification_tokens 
WHERE booking_id NOT LIKE '________-____-____-____-____________'
  OR booking_id IS NULL;

-- Vérifier l'état après nettoyage
SELECT 'Tokens restants' as type, count(*) as count FROM property_verification_tokens
UNION ALL
SELECT 'Submissions restantes' as type, count(*) as count FROM guest_submissions;