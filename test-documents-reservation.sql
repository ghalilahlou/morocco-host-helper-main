-- Test spécifique pour vérifier l'enregistrement des documents de réservation
-- Pièce d'identité, contrat, police, et autres documents

-- ============================================================================
-- 1. VÉRIFIER LES TYPES DE DOCUMENTS UPLOADÉS
-- ============================================================================

-- Analyser tous les types de documents stockés
SELECT 
    'Types de documents uploadés' as analysis_type,
    document_type,
    COUNT(*) as total_count,
    COUNT(CASE WHEN created_at >= NOW() - INTERVAL '7 days' THEN 1 END) as last_7_days,
    COUNT(CASE WHEN processing_status = 'completed' THEN 1 END) as completed,
    COUNT(CASE WHEN processing_status = 'pending' THEN 1 END) as pending,
    COUNT(CASE WHEN processing_status = 'failed' THEN 1 END) as failed
FROM uploaded_documents
GROUP BY document_type
ORDER BY total_count DESC;

-- ============================================================================
-- 2. VÉRIFIER LES DOCUMENTS PAR RÉSERVATION
-- ============================================================================

-- Documents par réservation récente
SELECT 
    'Documents par réservation' as analysis_type,
    b.id as booking_id,
    b.status as booking_status,
    b.guest_name,
    b.created_at as booking_created,
    COUNT(ud.id) as total_documents,
    COUNT(CASE WHEN ud.document_type = 'passport' THEN 1 END) as passports,
    COUNT(CASE WHEN ud.document_type = 'id_card' THEN 1 END) as id_cards,
    COUNT(CASE WHEN ud.document_type = 'contract' THEN 1 END) as contracts,
    COUNT(CASE WHEN ud.document_type = 'police_form' THEN 1 END) as police_forms,
    COUNT(CASE WHEN ud.document_type = 'other' THEN 1 END) as other_documents
FROM bookings b
LEFT JOIN uploaded_documents ud ON ud.booking_id = b.id
WHERE b.created_at >= NOW() - INTERVAL '30 days'
GROUP BY b.id, b.status, b.guest_name, b.created_at
ORDER BY b.created_at DESC
LIMIT 15;

-- ============================================================================
-- 3. VÉRIFIER LES DOCUMENTS GÉNÉRÉS
-- ============================================================================

-- Documents générés par réservation
SELECT 
    'Documents générés par réservation' as analysis_type,
    b.id as booking_id,
    b.status as booking_status,
    b.guest_name,
    b.created_at as booking_created,
    COUNT(gd.id) as total_generated_docs,
    COUNT(CASE WHEN gd.document_type = 'contract' THEN 1 END) as generated_contracts,
    COUNT(CASE WHEN gd.document_type = 'police_form' THEN 1 END) as generated_police_forms,
    COUNT(CASE WHEN gd.document_type = 'receipt' THEN 1 END) as generated_receipts,
    COUNT(CASE WHEN gd.is_signed = true THEN 1 END) as signed_documents
FROM bookings b
LEFT JOIN generated_documents gd ON gd.booking_id = b.id
WHERE b.created_at >= NOW() - INTERVAL '30 days'
GROUP BY b.id, b.status, b.guest_name, b.created_at
ORDER BY b.created_at DESC
LIMIT 15;

-- ============================================================================
-- 4. VÉRIFIER LES SIGNATURES DE CONTRATS
-- ============================================================================

-- Signatures par réservation
SELECT 
    'Signatures par réservation' as analysis_type,
    b.id as booking_id,
    b.status as booking_status,
    b.guest_name,
    b.created_at as booking_created,
    COUNT(cs.id) as total_signatures,
    COUNT(CASE WHEN cs.signed_at IS NOT NULL THEN 1 END) as signed_contracts,
    MIN(cs.signed_at) as first_signature,
    MAX(cs.signed_at) as last_signature
FROM bookings b
LEFT JOIN contract_signatures cs ON cs.booking_id = b.id
WHERE b.created_at >= NOW() - INTERVAL '30 days'
GROUP BY b.id, b.status, b.guest_name, b.created_at
ORDER BY b.created_at DESC
LIMIT 15;

-- ============================================================================
-- 5. VÉRIFIER LES SOUMISSIONS D'INVITÉS
-- ============================================================================

-- Soumissions par réservation
SELECT 
    'Soumissions par réservation' as analysis_type,
    b.id as booking_id,
    b.status as booking_status,
    b.guest_name,
    b.created_at as booking_created,
    COUNT(gs.id) as total_submissions,
    COUNT(CASE WHEN gs.status = 'submitted' THEN 1 END) as submitted,
    COUNT(CASE WHEN gs.status = 'reviewed' THEN 1 END) as reviewed,
    COUNT(CASE WHEN gs.status = 'approved' THEN 1 END) as approved,
    COUNT(CASE WHEN gs.status = 'rejected' THEN 1 END) as rejected
FROM bookings b
LEFT JOIN guest_submissions gs ON gs.booking_id = b.id
WHERE b.created_at >= NOW() - INTERVAL '30 days'
GROUP BY b.id, b.status, b.guest_name, b.created_at
ORDER BY b.created_at DESC
LIMIT 15;

-- ============================================================================
-- 6. VÉRIFICATION COMPLÈTE D'UNE RÉSERVATION
-- ============================================================================

-- Vue d'ensemble complète d'une réservation (remplacer 'BOOKING_ID' par un ID réel)
/*
SELECT 
    'Vue complète réservation' as analysis_type,
    b.id as booking_id,
    b.status as booking_status,
    b.guest_name,
    b.guest_email,
    b.created_at as booking_created,
    -- Documents uploadés
    (SELECT COUNT(*) FROM uploaded_documents ud WHERE ud.booking_id = b.id) as uploaded_docs,
    (SELECT COUNT(*) FROM uploaded_documents ud WHERE ud.booking_id = b.id AND ud.document_type = 'passport') as passports,
    (SELECT COUNT(*) FROM uploaded_documents ud WHERE ud.booking_id = b.id AND ud.document_type = 'id_card') as id_cards,
    -- Documents générés
    (SELECT COUNT(*) FROM generated_documents gd WHERE gd.booking_id = b.id) as generated_docs,
    (SELECT COUNT(*) FROM generated_documents gd WHERE gd.booking_id = b.id AND gd.document_type = 'contract') as generated_contracts,
    -- Signatures
    (SELECT COUNT(*) FROM contract_signatures cs WHERE cs.booking_id = b.id) as signatures,
    -- Soumissions
    (SELECT COUNT(*) FROM guest_submissions gs WHERE gs.booking_id = b.id) as submissions
FROM bookings b
WHERE b.id = 'BOOKING_ID';
*/

-- ============================================================================
-- 7. RÉSUMÉ DES DOCUMENTS PAR TYPE
-- ============================================================================

-- Résumé global des documents
SELECT 
    'RÉSUMÉ GLOBAL DOCUMENTS' as summary_type,
    (SELECT COUNT(*) FROM uploaded_documents WHERE document_type = 'passport') as total_passports,
    (SELECT COUNT(*) FROM uploaded_documents WHERE document_type = 'id_card') as total_id_cards,
    (SELECT COUNT(*) FROM uploaded_documents WHERE document_type = 'contract') as total_contracts,
    (SELECT COUNT(*) FROM uploaded_documents WHERE document_type = 'police_form') as total_police_forms,
    (SELECT COUNT(*) FROM generated_documents WHERE document_type = 'contract') as total_generated_contracts,
    (SELECT COUNT(*) FROM generated_documents WHERE document_type = 'police_form') as total_generated_police_forms,
    (SELECT COUNT(*) FROM contract_signatures) as total_signatures;

-- ============================================================================
-- 8. VÉRIFICATION DES ERREURS DE TRAITEMENT
-- ============================================================================

-- Documents avec erreurs de traitement
SELECT 
    'Documents avec erreurs' as analysis_type,
    ud.id as document_id,
    ud.booking_id,
    ud.document_type,
    ud.processing_status,
    ud.created_at,
    ud.extracted_data
FROM uploaded_documents ud
WHERE ud.processing_status = 'failed'
OR ud.processing_status = 'error'
ORDER BY ud.created_at DESC
LIMIT 10;

-- ============================================================================
-- 9. VÉRIFICATION DES DOCUMENTS RÉCENTS
-- ============================================================================

-- Documents des dernières 24 heures
SELECT 
    'Documents récents (24h)' as analysis_type,
    ud.id as document_id,
    ud.booking_id,
    ud.document_type,
    ud.processing_status,
    ud.file_name,
    ud.created_at,
    b.guest_name,
    b.status as booking_status
FROM uploaded_documents ud
LEFT JOIN bookings b ON b.id = ud.booking_id
WHERE ud.created_at >= NOW() - INTERVAL '24 hours'
ORDER BY ud.created_at DESC
LIMIT 20;

-- ============================================================================
-- 10. TEST DE LA FONCTION submit-guest-info
-- ============================================================================

-- Vérifier les soumissions récentes et leurs documents
SELECT 
    'Soumissions récentes avec documents' as analysis_type,
    gs.id as submission_id,
    gs.booking_id,
    gs.status as submission_status,
    gs.created_at as submission_created,
    b.guest_name,
    b.status as booking_status,
    -- Vérifier les documents dans guest_data
    CASE 
        WHEN gs.guest_data->>'documentUrls' IS NOT NULL THEN 'Has document URLs in guest_data'
        ELSE 'No document URLs in guest_data'
    END as document_urls_status,
    -- Vérifier les documents uploadés
    (SELECT COUNT(*) FROM uploaded_documents ud WHERE ud.booking_id = gs.booking_id) as uploaded_docs_count
FROM guest_submissions gs
LEFT JOIN bookings b ON b.id = gs.booking_id
WHERE gs.created_at >= NOW() - INTERVAL '1 day'
ORDER BY gs.created_at DESC
LIMIT 10;
