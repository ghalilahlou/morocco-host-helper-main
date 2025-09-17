-- Vérifier les politiques RLS sur la table airbnb_reservations
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies 
WHERE tablename = 'airbnb_reservations';

-- Vérifier si RLS est activé
SELECT 
    schemaname,
    tablename,
    rowsecurity
FROM pg_tables 
WHERE tablename = 'airbnb_reservations';

-- Vérifier les données dans la table (avec service role)
SELECT COUNT(*) as total_reservations FROM airbnb_reservations;

-- Vérifier les données récentes
SELECT 
    id,
    property_id,
    airbnb_booking_id,
    summary,
    created_at
FROM airbnb_reservations 
ORDER BY created_at DESC 
LIMIT 5;


