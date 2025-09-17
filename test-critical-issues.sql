-- Test des problèmes critiques identifiés
-- Script rapide pour diagnostiquer les problèmes principaux

-- ============================================================================
-- 1. PROBLÈME CRITIQUE: 0 documents générés
-- ============================================================================

-- Vérifier si le problème vient de la table ou du processus
SELECT 
    'CRITICAL: Generated Documents' as issue,
    COUNT(*) as total_count,
    COUNT(CASE WHEN created_at >= NOW() - INTERVAL '30 days' THEN 1 END) as last_30_days,
    COUNT(CASE WHEN is_signed = true THEN 1 END) as signed_count
FROM generated_documents;

-- Vérifier les réservations qui devraient avoir des documents générés
SELECT 
    'Bookings needing generated docs' as issue,
    b.id as booking_id,
    b.status,
    b.documents_generated,
    b.created_at
FROM bookings b
WHERE b.status IN ('confirmed', 'completed')
AND b.id NOT IN (SELECT DISTINCT booking_id FROM generated_documents WHERE booking_id IS NOT NULL)
ORDER BY b.created_at DESC
LIMIT 5;

-- ============================================================================
-- 2. PROBLÈME: Plus de signatures que de réservations
-- ============================================================================

-- Identifier les doublons de signatures
SELECT 
    'Signature duplicates' as issue,
    booking_id,
    COUNT(*) as signature_count,
    MIN(created_at) as first_signature,
    MAX(created_at) as last_signature
FROM contract_signatures
GROUP BY booking_id
HAVING COUNT(*) > 1
ORDER BY signature_count DESC
LIMIT 5;

-- ============================================================================
-- 3. PROBLÈME: Réservations sans soumissions
-- ============================================================================

-- Réservations récentes sans soumissions
SELECT 
    'Bookings without submissions' as issue,
    b.id as booking_id,
    b.status,
    b.created_at,
    b.guest_name,
    b.guest_email
FROM bookings b
WHERE b.created_at >= NOW() - INTERVAL '7 days'
AND b.id NOT IN (SELECT DISTINCT booking_id FROM guest_submissions WHERE booking_id IS NOT NULL)
ORDER BY b.created_at DESC
LIMIT 5;

-- ============================================================================
-- 4. PROBLÈME: Réservations sans documents uploadés
-- ============================================================================

-- Réservations récentes sans documents
SELECT 
    'Bookings without documents' as issue,
    b.id as booking_id,
    b.status,
    b.created_at,
    b.guest_name
FROM bookings b
WHERE b.created_at >= NOW() - INTERVAL '7 days'
AND b.id NOT IN (SELECT DISTINCT booking_id FROM uploaded_documents WHERE booking_id IS NOT NULL)
ORDER BY b.created_at DESC
LIMIT 5;

-- ============================================================================
-- 5. VÉRIFICATION DES PROCESSUS
-- ============================================================================

-- Vérifier le statut des documents uploadés
SELECT 
    'Document processing status' as issue,
    processing_status,
    COUNT(*) as count,
    COUNT(CASE WHEN created_at >= NOW() - INTERVAL '7 days' THEN 1 END) as recent
FROM uploaded_documents
GROUP BY processing_status
ORDER BY count DESC;

-- Vérifier le statut des soumissions
SELECT 
    'Submission status' as issue,
    status,
    COUNT(*) as count,
    COUNT(CASE WHEN created_at >= NOW() - INTERVAL '7 days' THEN 1 END) as recent
FROM guest_submissions
GROUP BY status
ORDER BY count DESC;

-- ============================================================================
-- 6. TEST DE LA FONCTION submit-guest-info
-- ============================================================================

-- Vérifier les soumissions récentes créées par la fonction
SELECT 
    'Recent submissions from function' as issue,
    gs.id as submission_id,
    gs.booking_id,
    gs.status,
    gs.created_at,
    CASE 
        WHEN gs.booking_data IS NOT NULL THEN 'Has booking data'
        ELSE 'Missing booking data'
    END as booking_data_status,
    CASE 
        WHEN gs.guest_data IS NOT NULL THEN 'Has guest data'
        ELSE 'Missing guest data'
    END as guest_data_status
FROM guest_submissions gs
WHERE gs.created_at >= NOW() - INTERVAL '1 day'
ORDER BY gs.created_at DESC
LIMIT 5;

-- ============================================================================
-- 7. RÉSUMÉ RAPIDE
-- ============================================================================

-- Résumé des problèmes critiques
SELECT 
    'CRITICAL ISSUES SUMMARY' as summary,
    (SELECT COUNT(*) FROM generated_documents) as generated_docs_count,
    (SELECT COUNT(*) FROM bookings WHERE status IN ('confirmed', 'completed')) as completed_bookings,
    (SELECT COUNT(*) FROM contract_signatures) as signatures_count,
    (SELECT COUNT(*) FROM bookings) as total_bookings,
    (SELECT COUNT(*) FROM guest_submissions WHERE created_at >= NOW() - INTERVAL '7 days') as recent_submissions,
    (SELECT COUNT(*) FROM uploaded_documents WHERE created_at >= NOW() - INTERVAL '7 days') as recent_documents;

-- ============================================================================
-- 8. ACTIONS RECOMMANDÉES
-- ============================================================================

-- Actions à prendre
SELECT 
    'RECOMMENDED ACTIONS' as action_type,
    CASE 
        WHEN (SELECT COUNT(*) FROM generated_documents) = 0 THEN 'URGENT: Vérifier le processus de génération de documents'
        ELSE 'OK: Documents générés présents'
    END as action_1,
    CASE 
        WHEN (SELECT COUNT(*) FROM contract_signatures) > (SELECT COUNT(*) FROM bookings) THEN 'ATTENTION: Nettoyer les doublons de signatures'
        ELSE 'OK: Signatures cohérentes'
    END as action_2,
    CASE 
        WHEN (SELECT COUNT(*) FROM guest_submissions WHERE created_at >= NOW() - INTERVAL '7 days') = 0 THEN 'ATTENTION: Aucune soumission récente - vérifier la fonction'
        ELSE 'OK: Soumissions récentes présentes'
    END as action_3;
