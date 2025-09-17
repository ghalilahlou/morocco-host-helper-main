-- Script de test pour vérifier que toutes les colonnes existent
-- Ce script teste l'existence des colonnes dans chaque table

-- Test 1: Vérifier les colonnes de airbnb_sync_status
SELECT 
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'airbnb_sync_status' 
AND table_schema = 'public'
ORDER BY ordinal_position;

-- Test 2: Vérifier les colonnes de guest_submissions
SELECT 
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'guest_submissions' 
AND table_schema = 'public'
ORDER BY ordinal_position;

-- Test 3: Vérifier les colonnes de uploaded_documents
SELECT 
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'uploaded_documents' 
AND table_schema = 'public'
ORDER BY ordinal_position;

-- Test 4: Vérifier les colonnes de properties
SELECT 
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'properties' 
AND table_schema = 'public'
ORDER BY ordinal_position;

-- Test 5: Vérifier les colonnes de bookings
SELECT 
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'bookings' 
AND table_schema = 'public'
ORDER BY ordinal_position;

-- Test 6: Vérifier les colonnes de guests
SELECT 
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'guests' 
AND table_schema = 'public'
ORDER BY ordinal_position;

-- Test 7: Vérifier les colonnes de admin_users
SELECT 
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'admin_users' 
AND table_schema = 'public'
ORDER BY ordinal_position;

-- Test 8: Vérifier les colonnes de token_allocations
SELECT 
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'token_allocations' 
AND table_schema = 'public'
ORDER BY ordinal_position;

-- Test 9: Vérifier les colonnes de token_control_settings
SELECT 
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'token_control_settings' 
AND table_schema = 'public'
ORDER BY ordinal_position;

-- Test 10: Vérifier les colonnes de host_profiles
SELECT 
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'host_profiles' 
AND table_schema = 'public'
ORDER BY ordinal_position;

-- Résumé: Lister toutes les tables et leurs colonnes
SELECT 
    table_name,
    COUNT(*) as column_count,
    STRING_AGG(column_name, ', ' ORDER BY ordinal_position) as columns
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND table_name IN (
    'properties', 'bookings', 'guests', 'uploaded_documents', 
    'generated_documents', 'contract_signatures', 'guest_submissions',
    'property_verification_tokens', 'guest_verification_tokens',
    'airbnb_reservations', 'airbnb_sync_status', 'admin_users',
    'admin_activity_logs', 'admin_statistics', 'token_allocations',
    'token_control_settings', 'host_profiles', 'system_logs'
)
GROUP BY table_name
ORDER BY table_name;
