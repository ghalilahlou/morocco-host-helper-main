-- Diagnostic de la synchronisation Airbnb
-- Vérifier les tables et données

-- 1. Vérifier si les tables existent
SELECT 
    table_name,
    table_type
FROM information_schema.tables 
WHERE table_name IN ('airbnb_reservations', 'airbnb_sync_status', 'properties')
ORDER BY table_name;

-- 2. Vérifier la structure de airbnb_reservations
SELECT 
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'airbnb_reservations'
ORDER BY ordinal_position;

-- 3. Vérifier la structure de airbnb_sync_status
SELECT 
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'airbnb_sync_status'
ORDER BY ordinal_position;

-- 4. Vérifier les propriétés avec URL Airbnb
SELECT 
    id,
    name,
    airbnb_ics_url,
    user_id
FROM properties 
WHERE airbnb_ics_url IS NOT NULL AND airbnb_ics_url != '';

-- 5. Vérifier les réservations Airbnb existantes
SELECT 
    COUNT(*) as total_reservations,
    COUNT(DISTINCT property_id) as properties_with_reservations
FROM airbnb_reservations;

-- 6. Vérifier le statut de synchronisation
SELECT 
    property_id,
    sync_status,
    last_sync_at,
    last_error,
    reservations_count,
    created_at
FROM airbnb_sync_status
ORDER BY updated_at DESC;

-- 7. Vérifier les politiques RLS sur airbnb_reservations
SELECT 
    policyname,
    cmd,
    qual
FROM pg_policies 
WHERE tablename = 'airbnb_reservations';

-- 8. Vérifier les politiques RLS sur airbnb_sync_status
SELECT 
    policyname,
    cmd,
    qual
FROM pg_policies 
WHERE tablename = 'airbnb_sync_status';
