-- 🔍 Vérification Base de Données - Réservations et Données
-- Exécutez ces requêtes dans l'éditeur SQL de Supabase pour vérifier les données

-- 1. Vérifier les réservations existantes
SELECT 
    id,
    property_id,
    guest_name,
    check_in_date,
    check_out_date,
    status,
    created_at,
    updated_at
FROM bookings
ORDER BY created_at DESC
LIMIT 10;

-- 2. Compter le nombre total de réservations
SELECT 
    COUNT(*) as total_reservations,
    COUNT(CASE WHEN status = 'confirmed' THEN 1 END) as confirmed_reservations,
    COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_reservations,
    COUNT(CASE WHEN status = 'cancelled' THEN 1 END) as cancelled_reservations
FROM bookings;

-- 3. Vérifier les propriétés
SELECT 
    id,
    name,
    address,
    created_at,
    updated_at
FROM properties
ORDER BY created_at DESC
LIMIT 10;

-- 4. Vérifier les utilisateurs et leurs propriétés
SELECT 
    u.id as user_id,
    u.email,
    p.id as property_id,
    p.name as property_name,
    p.address
FROM auth.users u
LEFT JOIN properties p ON u.id = p.owner_id
ORDER BY u.created_at DESC;

-- 5. Vérifier les signatures de contrats
SELECT 
    id,
    booking_id,
    signed_at,
    created_at
FROM contract_signatures
ORDER BY created_at DESC
LIMIT 10;

-- 6. Vérifier les documents
SELECT 
    id,
    booking_id,
    file_name,
    file_type,
    created_at
FROM documents
ORDER BY created_at DESC
LIMIT 10;

-- 7. Vérifier la structure des tables principales
SELECT 
    table_name,
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_name IN ('bookings', 'properties', 'contract_signatures', 'documents')
ORDER BY table_name, ordinal_position;

-- 8. Vérifier les dernières activités
SELECT 
    'bookings' as table_name,
    COUNT(*) as count,
    MAX(created_at) as last_activity
FROM bookings
UNION ALL
SELECT 
    'properties' as table_name,
    COUNT(*) as count,
    MAX(created_at) as last_activity
FROM properties
UNION ALL
SELECT 
    'contract_signatures' as table_name,
    COUNT(*) as count,
    MAX(created_at) as last_activity
FROM contract_signatures
UNION ALL
SELECT 
    'documents' as table_name,
    COUNT(*) as count,
    MAX(created_at) as last_activity
FROM documents;
