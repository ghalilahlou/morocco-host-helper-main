-- Diagnostic du problème guest_name = null
-- Analyser pourquoi le nom de l'invité n'est pas récupéré

-- ============================================================================
-- 1. ANALYSER LA RÉSERVATION SPÉCIFIQUE
-- ============================================================================

-- Vérifier la réservation avec le document récent
SELECT 
    'Réservation avec document récent' as analysis_type,
    b.id as booking_id,
    b.status as booking_status,
    b.guest_name,
    b.guest_email,
    b.guest_phone,
    b.created_at as booking_created,
    b.updated_at as booking_updated
FROM bookings b
WHERE b.id = '305c34d4-f815-4bd3-8cb4-103cfa6d64ff';

-- ============================================================================
-- 2. ANALYSER LES INVITÉS DE CETTE RÉSERVATION
-- ============================================================================

-- Vérifier les invités de cette réservation
SELECT 
    'Invités de la réservation' as analysis_type,
    g.id as guest_id,
    g.booking_id,
    g.full_name,
    g.nationality,
    g.document_type,
    g.document_number,
    g.created_at as guest_created
FROM guests g
WHERE g.booking_id = '305c34d4-f815-4bd3-8cb4-103cfa6d64ff';

-- ============================================================================
-- 3. ANALYSER LES DOCUMENTS UPLOADÉS
-- ============================================================================

-- Vérifier tous les documents de cette réservation
SELECT 
    'Documents de la réservation' as analysis_type,
    ud.id as document_id,
    ud.booking_id,
    ud.guest_id,
    ud.document_type,
    ud.processing_status,
    ud.file_name,
    ud.created_at as document_created,
    ud.extracted_data
FROM uploaded_documents ud
WHERE ud.booking_id = '305c34d4-f815-4bd3-8cb4-103cfa6d64ff';

-- ============================================================================
-- 4. ANALYSER LES SOUMISSIONS D'INVITÉS
-- ============================================================================

-- Vérifier les soumissions pour cette réservation
SELECT 
    'Soumissions de la réservation' as analysis_type,
    gs.id as submission_id,
    gs.booking_id,
    gs.status as submission_status,
    gs.guest_data,
    gs.booking_data,
    gs.created_at as submission_created
FROM guest_submissions gs
WHERE gs.booking_id = '305c34d4-f815-4bd3-8cb4-103cfa6d64ff';

-- ============================================================================
-- 5. ANALYSER LES DOCUMENTS GÉNÉRÉS
-- ============================================================================

-- Vérifier les documents générés pour cette réservation
SELECT 
    'Documents générés de la réservation' as analysis_type,
    gd.id as generated_doc_id,
    gd.booking_id,
    gd.document_type,
    gd.is_signed,
    gd.created_at as generated_created
FROM generated_documents gd
WHERE gd.booking_id = '305c34d4-f815-4bd3-8cb4-103cfa6d64ff';

-- ============================================================================
-- 6. ANALYSER LES SIGNATURES
-- ============================================================================

-- Vérifier les signatures pour cette réservation
SELECT 
    'Signatures de la réservation' as analysis_type,
    cs.id as signature_id,
    cs.booking_id,
    cs.signer_name,
    cs.signer_email,
    cs.signed_at,
    cs.created_at as signature_created
FROM contract_signatures cs
WHERE cs.booking_id = '305c34d4-f815-4bd3-8cb4-103cfa6d64ff';

-- ============================================================================
-- 7. ANALYSER LES AUTRES RÉSERVATIONS RÉCENTES
-- ============================================================================

-- Vérifier d'autres réservations récentes pour comparaison
SELECT 
    'Autres réservations récentes' as analysis_type,
    b.id as booking_id,
    b.status as booking_status,
    b.guest_name,
    b.guest_email,
    b.created_at as booking_created,
    COUNT(ud.id) as document_count,
    COUNT(g.id) as guest_count,
    COUNT(gs.id) as submission_count
FROM bookings b
LEFT JOIN uploaded_documents ud ON ud.booking_id = b.id
LEFT JOIN guests g ON g.booking_id = b.id
LEFT JOIN guest_submissions gs ON gs.booking_id = b.id
WHERE b.created_at >= NOW() - INTERVAL '7 days'
GROUP BY b.id, b.status, b.guest_name, b.guest_email, b.created_at
ORDER BY b.created_at DESC
LIMIT 10;

-- ============================================================================
-- 8. ANALYSER LES TYPES DE DOCUMENTS
-- ============================================================================

-- Vérifier tous les types de documents récents
SELECT 
    'Types de documents récents' as analysis_type,
    ud.document_type,
    COUNT(*) as count,
    COUNT(CASE WHEN ud.processing_status = 'completed' THEN 1 END) as completed,
    COUNT(CASE WHEN ud.processing_status = 'pending' THEN 1 END) as pending,
    COUNT(CASE WHEN ud.processing_status = 'failed' THEN 1 END) as failed
FROM uploaded_documents ud
WHERE ud.created_at >= NOW() - INTERVAL '7 days'
GROUP BY ud.document_type
ORDER BY count DESC;

-- ============================================================================
-- 9. ANALYSER LES ERREURS DE TRAITEMENT
-- ============================================================================

-- Vérifier les documents avec des erreurs de traitement
SELECT 
    'Documents avec erreurs' as analysis_type,
    ud.id as document_id,
    ud.booking_id,
    ud.document_type,
    ud.processing_status,
    ud.file_name,
    ud.created_at,
    ud.extracted_data
FROM uploaded_documents ud
WHERE ud.processing_status = 'failed'
OR ud.processing_status = 'error'
OR ud.processing_status = 'pending'
ORDER BY ud.created_at DESC
LIMIT 10;

-- ============================================================================
-- 10. RÉSUMÉ DU DIAGNOSTIC
-- ============================================================================

-- Résumé des problèmes identifiés
SELECT 
    'DIAGNOSTIC SUMMARY' as summary_type,
    (SELECT COUNT(*) FROM bookings WHERE guest_name IS NULL AND created_at >= NOW() - INTERVAL '7 days') as bookings_without_guest_name,
    (SELECT COUNT(*) FROM uploaded_documents WHERE document_type = 'identity' AND created_at >= NOW() - INTERVAL '7 days') as identity_documents,
    (SELECT COUNT(*) FROM uploaded_documents WHERE document_type IN ('passport', 'id_card') AND created_at >= NOW() - INTERVAL '7 days') as passport_id_documents,
    (SELECT COUNT(*) FROM generated_documents WHERE created_at >= NOW() - INTERVAL '7 days') as generated_documents_recent,
    (SELECT COUNT(*) FROM bookings WHERE id NOT IN (SELECT DISTINCT booking_id FROM generated_documents WHERE booking_id IS NOT NULL) AND created_at >= NOW() - INTERVAL '7 days') as bookings_without_generated_docs;
