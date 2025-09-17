-- Script de test simple pour vérifier la syntaxe SQL
-- Ce script teste les requêtes principales sans ambiguïté

-- Test 1: Vérifier les tables principales
SELECT 'uploaded_documents' as table_name, COUNT(*) as count FROM uploaded_documents;
SELECT 'guest_submissions' as table_name, COUNT(*) as count FROM guest_submissions;
SELECT 'bookings' as table_name, COUNT(*) as count FROM bookings;
SELECT 'guests' as table_name, COUNT(*) as count FROM guests;

-- Test 2: Vérifier les tables Airbnb
SELECT 'airbnb_reservations' as table_name, COUNT(*) as count FROM airbnb_reservations;
SELECT 'airbnb_sync_status' as table_name, COUNT(*) as count FROM airbnb_sync_status;

-- Test 3: Vérifier les tables admin
SELECT 'admin_users' as table_name, COUNT(*) as count FROM admin_users;
SELECT 'admin_activity_logs' as table_name, COUNT(*) as count FROM admin_activity_logs;
SELECT 'admin_statistics' as table_name, COUNT(*) as count FROM admin_statistics;

-- Test 4: Vérifier les tables de tokens
SELECT 'token_allocations' as table_name, COUNT(*) as count FROM token_allocations;
SELECT 'token_control_settings' as table_name, COUNT(*) as count FROM token_control_settings;

-- Test 5: Vérifier les autres tables
SELECT 'properties' as table_name, COUNT(*) as count FROM properties;
SELECT 'host_profiles' as table_name, COUNT(*) as count FROM host_profiles;
SELECT 'system_logs' as table_name, COUNT(*) as count FROM system_logs;
SELECT 'generated_documents' as table_name, COUNT(*) as count FROM generated_documents;
SELECT 'contract_signatures' as table_name, COUNT(*) as count FROM contract_signatures;
SELECT 'property_verification_tokens' as table_name, COUNT(*) as count FROM property_verification_tokens;
SELECT 'guest_verification_tokens' as table_name, COUNT(*) as count FROM guest_verification_tokens;

-- Test 6: Vérifier les relations (sans ambiguïté)
SELECT 
    'Relations test' as test_type,
    COUNT(DISTINCT b.id) as total_bookings,
    COUNT(DISTINCT g.id) as total_guests,
    COUNT(DISTINCT ud.id) as total_documents
FROM bookings b
LEFT JOIN guests g ON g.booking_id = b.id
LEFT JOIN uploaded_documents ud ON ud.booking_id = b.id;

-- Test 7: Vérifier les propriétés avec Airbnb
SELECT 
    'Properties with Airbnb' as test_type,
    COUNT(*) as total_properties,
    COUNT(CASE WHEN airbnb_ics_url IS NOT NULL THEN 1 END) as with_airbnb_url
FROM properties;

-- Test 8: Vérifier les réservations récentes (sans ambiguïté)
SELECT 
    'Recent bookings' as test_type,
    COUNT(*) as total_recent,
    COUNT(CASE WHEN b.status = 'confirmed' THEN 1 END) as confirmed
FROM bookings b
WHERE b.created_at >= NOW() - INTERVAL '7 days';

-- Test 9: Vérifier les réservations Airbnb récentes (sans ambiguïté)
SELECT 
    'Recent Airbnb reservations' as test_type,
    COUNT(*) as total_recent,
    COUNT(CASE WHEN ar.created_at >= NOW() - INTERVAL '7 days' THEN 1 END) as very_recent
FROM airbnb_reservations ar;

-- Test 10: Résumé final
SELECT 
    'FINAL SUMMARY' as summary_type,
    (SELECT COUNT(*) FROM properties) as total_properties,
    (SELECT COUNT(*) FROM bookings) as total_bookings,
    (SELECT COUNT(*) FROM guests) as total_guests,
    (SELECT COUNT(*) FROM uploaded_documents) as total_documents,
    (SELECT COUNT(*) FROM guest_submissions) as total_submissions,
    (SELECT COUNT(*) FROM airbnb_reservations) as total_airbnb_reservations,
    (SELECT COUNT(*) FROM admin_users WHERE is_active = true) as active_admins;
