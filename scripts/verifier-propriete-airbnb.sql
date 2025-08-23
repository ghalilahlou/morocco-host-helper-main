-- Vérifier votre propriété spécifique
-- Remplacez 'VOTRE_PROPRIETE_ID' par l'ID de votre propriété

-- 1. Vérifier votre propriété
SELECT 
    id,
    name,
    airbnb_ics_url,
    user_id
FROM properties 
WHERE user_id = '88d5d01f-3ddd-40f7-90b0-260376f5accd'
ORDER BY name;

-- 2. Vérifier le statut de synchronisation de votre propriété
SELECT 
    property_id,
    sync_status,
    last_sync_at,
    last_error,
    reservations_count,
    created_at
FROM airbnb_sync_status
WHERE property_id IN (
    SELECT id FROM properties 
    WHERE user_id = '88d5d01f-3ddd-40f7-90b0-260376f5accd'
)
ORDER BY updated_at DESC;

-- 3. Vérifier les réservations Airbnb de votre propriété
SELECT 
    COUNT(*) as total_reservations,
    property_id
FROM airbnb_reservations
WHERE property_id IN (
    SELECT id FROM properties 
    WHERE user_id = '88d5d01f-3ddd-40f7-90b0-260376f5accd'
)
GROUP BY property_id;

-- 4. Voir quelques réservations récentes
SELECT 
    id,
    property_id,
    summary,
    start_date,
    end_date,
    guest_name,
    number_of_guests,
    created_at
FROM airbnb_reservations
WHERE property_id IN (
    SELECT id FROM properties 
    WHERE user_id = '88d5d01f-3ddd-40f7-90b0-260376f5accd'
)
ORDER BY created_at DESC
LIMIT 5;
