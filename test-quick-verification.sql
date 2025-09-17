-- Test rapide pour vérifier que la fonction Edge corrigée fonctionne
-- Vérifier les données récentes (dernière heure)

-- ============================================================================
-- 1. VÉRIFIER LES RÉSERVATIONS RÉCENTES
-- ============================================================================

-- Réservations créées dans la dernière heure
SELECT 
    'Réservations récentes (1h)' as check_type,
    b.id as booking_id,
    b.guest_name,
    b.guest_email,
    b.guest_phone,
    b.status,
    b.number_of_guests,
    b.created_at
FROM bookings b
WHERE b.created_at >= NOW() - INTERVAL '1 hour'
ORDER BY b.created_at DESC
LIMIT 10;

-- ============================================================================
-- 2. VÉRIFIER LES INVITÉS RÉCENTS
-- ============================================================================

-- Invités créés dans la dernière heure
SELECT 
    'Invités récents (1h)' as check_type,
    g.id as guest_id,
    g.booking_id,
    g.full_name,
    g.nationality,
    g.document_type,
    g.document_number,
    g.created_at
FROM guests g
WHERE g.created_at >= NOW() - INTERVAL '1 hour'
ORDER BY g.created_at DESC
LIMIT 10;

-- ============================================================================
-- 3. VÉRIFIER LES DOCUMENTS RÉCENTS
-- ============================================================================

-- Documents uploadés dans la dernière heure
SELECT 
    'Documents récents (1h)' as check_type,
    ud.id as document_id,
    ud.booking_id,
    ud.guest_id,
    ud.document_type,
    ud.processing_status,
    ud.file_name,
    ud.created_at
FROM uploaded_documents ud
WHERE ud.created_at >= NOW() - INTERVAL '1 hour'
ORDER BY ud.created_at DESC
LIMIT 10;

-- ============================================================================
-- 4. VÉRIFIER LES SOUMISSIONS RÉCENTES
-- ============================================================================

-- Soumissions créées dans la dernière heure
SELECT 
    'Soumissions récentes (1h)' as check_type,
    gs.id as submission_id,
    gs.booking_id,
    gs.status,
    gs.created_at,
    CASE 
        WHEN gs.guest_data IS NOT NULL THEN 'Has guest data'
        ELSE 'No guest data'
    END as guest_data_status,
    CASE 
        WHEN gs.booking_data IS NOT NULL THEN 'Has booking data'
        ELSE 'No booking data'
    END as booking_data_status
FROM guest_submissions gs
WHERE gs.created_at >= NOW() - INTERVAL '1 hour'
ORDER BY gs.created_at DESC
LIMIT 10;

-- ============================================================================
-- 5. VÉRIFIER LES TYPES DE DOCUMENTS
-- ============================================================================

-- Types de documents récents
SELECT 
    'Types de documents récents' as check_type,
    ud.document_type,
    COUNT(*) as count,
    COUNT(CASE WHEN ud.processing_status = 'completed' THEN 1 END) as completed,
    COUNT(CASE WHEN ud.processing_status = 'pending' THEN 1 END) as pending,
    COUNT(CASE WHEN ud.processing_status = 'failed' THEN 1 END) as failed
FROM uploaded_documents ud
WHERE ud.created_at >= NOW() - INTERVAL '1 hour'
GROUP BY ud.document_type
ORDER BY count DESC;

-- ============================================================================
-- 6. VÉRIFIER LES RELATIONS
-- ============================================================================

-- Vérifier l'intégrité des relations récentes
SELECT 
    'Relations récentes' as check_type,
    b.id as booking_id,
    b.guest_name,
    b.status,
    COUNT(DISTINCT g.id) as guests_count,
    COUNT(DISTINCT ud.id) as documents_count,
    COUNT(DISTINCT gs.id) as submissions_count
FROM bookings b
LEFT JOIN guests g ON g.booking_id = b.id
LEFT JOIN uploaded_documents ud ON ud.booking_id = b.id
LEFT JOIN guest_submissions gs ON gs.booking_id = b.id
WHERE b.created_at >= NOW() - INTERVAL '1 hour'
GROUP BY b.id, b.guest_name, b.status
ORDER BY b.created_at DESC
LIMIT 10;

-- ============================================================================
-- 7. RÉSUMÉ DES CORRECTIONS
-- ============================================================================

-- Résumé des corrections appliquées
SELECT 
    'RÉSUMÉ DES CORRECTIONS' as summary_type,
    (SELECT COUNT(*) FROM bookings WHERE guest_name IS NOT NULL AND created_at >= NOW() - INTERVAL '1 hour') as bookings_with_guest_name,
    (SELECT COUNT(*) FROM bookings WHERE guest_email IS NOT NULL AND created_at >= NOW() - INTERVAL '1 hour') as bookings_with_guest_email,
    (SELECT COUNT(*) FROM bookings WHERE guest_phone IS NOT NULL AND created_at >= NOW() - INTERVAL '1 hour') as bookings_with_guest_phone,
    (SELECT COUNT(*) FROM uploaded_documents WHERE document_type IN ('passport', 'id_card') AND created_at >= NOW() - INTERVAL '1 hour') as specific_document_types,
    (SELECT COUNT(*) FROM uploaded_documents WHERE document_type = 'identity' AND created_at >= NOW() - INTERVAL '1 hour') as identity_document_types,
    (SELECT COUNT(*) FROM guest_submissions WHERE created_at >= NOW() - INTERVAL '1 hour') as recent_submissions;

-- ============================================================================
-- 8. VÉRIFICATION DES PROBLÈMES RÉSOLUS
-- ============================================================================

-- Vérifier que les problèmes ont été résolus
SELECT 
    'PROBLÈMES RÉSOLUS' as check_type,
    CASE 
        WHEN (SELECT COUNT(*) FROM bookings WHERE guest_name IS NULL AND created_at >= NOW() - INTERVAL '1 hour') = 0 
        THEN '✅ guest_name rempli'
        ELSE '❌ guest_name manquant'
    END as guest_name_status,
    CASE 
        WHEN (SELECT COUNT(*) FROM uploaded_documents WHERE document_type = 'identity' AND created_at >= NOW() - INTERVAL '1 hour') = 0 
        THEN '✅ Types spécifiques utilisés'
        ELSE '❌ Type identity encore utilisé'
    END as document_type_status,
    CASE 
        WHEN (SELECT COUNT(*) FROM guest_submissions WHERE created_at >= NOW() - INTERVAL '1 hour') > 0 
        THEN '✅ Soumissions créées'
        ELSE '❌ Aucune soumission'
    END as submissions_status;