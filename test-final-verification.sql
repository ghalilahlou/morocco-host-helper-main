-- Script de test final basé sur la structure réelle de la base de données
-- Ce script utilise exactement les colonnes qui existent dans votre base

-- ============================================================================
-- 1. VÉRIFICATION DES DOCUMENTS UPLOADÉS
-- ============================================================================

-- Vérifier tous les documents récents
SELECT 
    'uploaded_documents' as table_name,
    id,
    booking_id,
    guest_id,
    file_name,
    document_type,
    processing_status,
    created_at,
    CASE 
        WHEN document_url IS NOT NULL THEN 'URL fournie'
        ELSE 'Pas d URL'
    END as url_status,
    CASE 
        WHEN extracted_data IS NOT NULL THEN 'Donnees extraites presentes'
        ELSE 'Pas de donnees extraites'
    END as extracted_data_status
FROM uploaded_documents 
WHERE created_at >= NOW() - INTERVAL '1 day'
ORDER BY created_at DESC
LIMIT 20;

-- ============================================================================
-- 2. VÉRIFICATION DES SOUMISSIONS D'INVITÉS
-- ============================================================================

-- Vérifier les soumissions récentes
SELECT 
    'guest_submissions' as table_name,
    id,
    booking_id,
    token_id,
    status,
    created_at,
    CASE 
        WHEN booking_data IS NOT NULL THEN 'Donnees booking presentes'
        ELSE 'Pas de donnees booking'
    END as booking_data_status,
    CASE 
        WHEN guest_data IS NOT NULL THEN 'Donnees invites presentes'
        ELSE 'Pas de donnees invites'
    END as guest_data_status
FROM guest_submissions 
WHERE created_at >= NOW() - INTERVAL '1 day'
ORDER BY created_at DESC
LIMIT 10;

-- ============================================================================
-- 3. VÉRIFICATION DES RÉSERVATIONS
-- ============================================================================

-- Vérifier les réservations récentes
SELECT 
    'bookings' as table_name,
    id,
    property_id,
    check_in_date,
    check_out_date,
    number_of_guests,
    status,
    created_at,
    updated_at
FROM bookings 
WHERE created_at >= NOW() - INTERVAL '1 day'
ORDER BY created_at DESC
LIMIT 10;

-- ============================================================================
-- 4. VÉRIFICATION DES INVITÉS
-- ============================================================================

-- Vérifier les invités récents
SELECT 
    'guests' as table_name,
    id,
    booking_id,
    full_name,
    nationality,
    document_type,
    document_number,
    created_at
FROM guests 
WHERE created_at >= NOW() - INTERVAL '1 day'
ORDER BY created_at DESC
LIMIT 10;

-- ============================================================================
-- 5. VÉRIFICATION DES PROPRIÉTÉS AVEC SYNC AIRBNB
-- ============================================================================

-- Vérifier les propriétés avec synchronisation Airbnb
SELECT 
    'properties' as table_name,
    id,
    name,
    airbnb_ics_url,
    created_at,
    updated_at
FROM properties 
WHERE airbnb_ics_url IS NOT NULL
ORDER BY updated_at DESC
LIMIT 10;

-- Vérifier le statut de synchronisation Airbnb
SELECT 
    'airbnb_sync_status' as table_name,
    id,
    property_id,
    sync_status,
    last_sync_at,
    reservations_count,
    last_error,
    created_at,
    updated_at
FROM airbnb_sync_status 
ORDER BY updated_at DESC
LIMIT 10;

-- ============================================================================
-- 6. ANALYSE DES RELATIONS ENTRE TABLES
-- ============================================================================

-- Vérifier l'intégrité des relations
SELECT 
    'Relations verifiees' as analysis_type,
    COUNT(DISTINCT b.id) as total_bookings,
    COUNT(DISTINCT g.id) as total_guests,
    COUNT(DISTINCT ud.id) as total_uploaded_documents,
    COUNT(DISTINCT gs.id) as total_guest_submissions
FROM bookings b
LEFT JOIN guests g ON g.booking_id = b.id
LEFT JOIN uploaded_documents ud ON ud.booking_id = b.id
LEFT JOIN guest_submissions gs ON gs.booking_id = b.id
WHERE b.created_at >= NOW() - INTERVAL '1 day';

-- ============================================================================
-- 7. VÉRIFICATION DES DOCUMENTS PAR TYPE
-- ============================================================================

-- Analyser les types de documents stockés
SELECT 
    'Types de documents' as analysis_type,
    document_type,
    COUNT(*) as count,
    COUNT(CASE WHEN extracted_data IS NOT NULL THEN 1 END) as with_extracted_data,
    COUNT(CASE WHEN document_url IS NOT NULL THEN 1 END) as with_url,
    COUNT(CASE WHEN guest_id IS NOT NULL THEN 1 END) as linked_to_guest
FROM uploaded_documents 
WHERE created_at >= NOW() - INTERVAL '7 days'
GROUP BY document_type
ORDER BY count DESC;

-- ============================================================================
-- 8. VÉRIFICATION DES ERREURS POTENTIELLES
-- ============================================================================

-- Documents sans booking_id
SELECT 
    'Documents orphelins' as issue_type,
    COUNT(*) as count
FROM uploaded_documents 
WHERE booking_id IS NULL
AND created_at >= NOW() - INTERVAL '1 day';

-- Soumissions sans booking_id
SELECT 
    'Soumissions orphelines' as issue_type,
    COUNT(*) as count
FROM guest_submissions 
WHERE booking_id IS NULL
AND created_at >= NOW() - INTERVAL '1 day';

-- Invités sans booking_id
SELECT 
    'Invites orphelins' as issue_type,
    COUNT(*) as count
FROM guests 
WHERE booking_id IS NULL
AND created_at >= NOW() - INTERVAL '1 day';

-- ============================================================================
-- 9. VÉRIFICATION DE LA SYNCHRONISATION AIRBNB
-- ============================================================================

-- Réservations créées via synchronisation Airbnb
SELECT 
    'Reservations Airbnb' as analysis_type,
    COUNT(*) as total_reservations,
    COUNT(CASE WHEN created_at >= NOW() - INTERVAL '1 day' THEN 1 END) as recent_reservations,
    COUNT(CASE WHEN status = 'confirmed' THEN 1 END) as confirmed_reservations,
    COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_reservations
FROM bookings b
JOIN properties p ON p.id = b.property_id
WHERE p.airbnb_ics_url IS NOT NULL
AND b.created_at >= NOW() - INTERVAL '7 days';

-- Réservations Airbnb spécifiques
SELECT 
    'Airbnb Reservations' as analysis_type,
    COUNT(*) as total_airbnb_reservations,
    COUNT(CASE WHEN created_at >= NOW() - INTERVAL '1 day' THEN 1 END) as recent_airbnb_reservations
FROM airbnb_reservations ar
JOIN properties p ON p.id = ar.property_id
WHERE p.airbnb_ics_url IS NOT NULL
AND ar.created_at >= NOW() - INTERVAL '7 days';

-- ============================================================================
-- 10. RÉSUMÉ GÉNÉRAL
-- ============================================================================

-- Résumé des données récentes
SELECT 
    'RESUME GENERAL' as summary_type,
    (SELECT COUNT(*) FROM bookings WHERE created_at >= NOW() - INTERVAL '1 day') as bookings_today,
    (SELECT COUNT(*) FROM guests WHERE created_at >= NOW() - INTERVAL '1 day') as guests_today,
    (SELECT COUNT(*) FROM uploaded_documents WHERE created_at >= NOW() - INTERVAL '1 day') as documents_today,
    (SELECT COUNT(*) FROM guest_submissions WHERE created_at >= NOW() - INTERVAL '1 day') as submissions_today,
    (SELECT COUNT(*) FROM properties WHERE airbnb_ics_url IS NOT NULL) as properties_with_airbnb,
    (SELECT COUNT(*) FROM airbnb_reservations WHERE created_at >= NOW() - INTERVAL '1 day') as airbnb_reservations_today,
    (SELECT COUNT(*) FROM airbnb_sync_status WHERE updated_at >= NOW() - INTERVAL '1 day') as sync_status_updates_today;

-- ============================================================================
-- 11. VÉRIFICATION DES TABLES ADMINISTRATIVES
-- ============================================================================

-- Vérifier les utilisateurs administrateurs
SELECT 
    'admin_users' as table_name,
    COUNT(*) as total_admins,
    COUNT(CASE WHEN is_active = true THEN 1 END) as active_admins,
    COUNT(CASE WHEN role = 'super_admin' THEN 1 END) as super_admins
FROM admin_users;

-- Vérifier les logs d'activité admin
SELECT 
    'admin_activity_logs' as table_name,
    COUNT(*) as total_logs,
    COUNT(CASE WHEN created_at >= NOW() - INTERVAL '1 day' THEN 1 END) as recent_logs
FROM admin_activity_logs;

-- Vérifier les statistiques admin
SELECT 
    'admin_statistics' as table_name,
    COUNT(*) as total_statistics,
    MAX(date) as latest_statistics_date
FROM admin_statistics;

-- ============================================================================
-- 12. VÉRIFICATION DES TOKENS ET CONTRÔLES
-- ============================================================================

-- Vérifier les allocations de tokens
SELECT 
    'token_allocations' as table_name,
    COUNT(*) as total_allocations,
    SUM(tokens_allocated) as total_tokens_allocated,
    SUM(tokens_used) as total_tokens_used,
    SUM(tokens_remaining) as total_tokens_remaining
FROM token_allocations
WHERE is_active = true;

-- Vérifier les paramètres de contrôle des tokens
SELECT 
    'token_control_settings' as table_name,
    COUNT(*) as total_settings,
    COUNT(CASE WHEN control_type = 'unlimited' THEN 1 END) as unlimited_properties,
    COUNT(CASE WHEN control_type = 'limited' THEN 1 END) as limited_properties,
    COUNT(CASE WHEN control_type = 'blocked' THEN 1 END) as blocked_properties
FROM token_control_settings
WHERE is_enabled = true;

-- ============================================================================
-- 13. VÉRIFICATION DES PROFILS HÔTES
-- ============================================================================

-- Vérifier les profils d'hôtes
SELECT 
    'host_profiles' as table_name,
    COUNT(*) as total_profiles,
    COUNT(CASE WHEN full_name IS NOT NULL THEN 1 END) as profiles_with_names,
    COUNT(CASE WHEN phone IS NOT NULL THEN 1 END) as profiles_with_phones,
    COUNT(CASE WHEN avatar_url IS NOT NULL THEN 1 END) as profiles_with_avatars
FROM host_profiles;

-- ============================================================================
-- 14. VÉRIFICATION COMPLÈTE DE L'INTÉGRITÉ
-- ============================================================================

-- Vérifier l'intégrité générale du système
SELECT 
    'INTEGRITE GENERALE' as check_type,
    (SELECT COUNT(*) FROM properties) as total_properties,
    (SELECT COUNT(*) FROM bookings) as total_bookings,
    (SELECT COUNT(*) FROM guests) as total_guests,
    (SELECT COUNT(*) FROM uploaded_documents) as total_documents,
    (SELECT COUNT(*) FROM guest_submissions) as total_submissions,
    (SELECT COUNT(*) FROM generated_documents) as total_generated_docs,
    (SELECT COUNT(*) FROM contract_signatures) as total_signatures,
    (SELECT COUNT(*) FROM airbnb_reservations) as total_airbnb_reservations,
    (SELECT COUNT(*) FROM admin_users WHERE is_active = true) as active_admins;

-- ============================================================================
-- 15. VÉRIFICATION DES DONNÉES RÉCENTES (DERNIÈRE HEURE)
-- ============================================================================

-- Documents de la dernière heure
SELECT 
    'Recent documents (1h)' as info_type,
    COUNT(*) as count,
    document_type,
    processing_status
FROM uploaded_documents 
WHERE created_at >= NOW() - INTERVAL '1 hour'
GROUP BY document_type, processing_status
ORDER BY count DESC;

-- Soumissions de la dernière heure
SELECT 
    'Recent submissions (1h)' as info_type,
    COUNT(*) as count,
    status
FROM guest_submissions 
WHERE created_at >= NOW() - INTERVAL '1 hour'
GROUP BY status;

-- Réservations de la dernière heure
SELECT 
    'Recent bookings (1h)' as info_type,
    COUNT(*) as count,
    status
FROM bookings 
WHERE created_at >= NOW() - INTERVAL '1 hour'
GROUP BY status;
