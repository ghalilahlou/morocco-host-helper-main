-- Test urgent des problèmes critiques
-- Script rapide pour identifier les actions immédiates

-- ============================================================================
-- 1. PROBLÈME CRITIQUE: 0 documents générés
-- ============================================================================

-- Vérifier si des documents ont été générés récemment
SELECT 
    'URGENT: Generated Documents Check' as issue,
    COUNT(*) as total_generated_docs,
    COUNT(CASE WHEN created_at >= NOW() - INTERVAL '7 days' THEN 1 END) as last_7_days,
    COUNT(CASE WHEN created_at >= NOW() - INTERVAL '30 days' THEN 1 END) as last_30_days
FROM generated_documents;

-- Vérifier les réservations qui devraient avoir des documents générés
SELECT 
    'Bookings needing generated docs' as issue,
    b.id as booking_id,
    b.status,
    b.documents_generated,
    b.created_at,
    CASE 
        WHEN b.documents_generated IS NOT NULL THEN 'Has documents_generated field'
        ELSE 'Missing documents_generated field'
    END as documents_status
FROM bookings b
WHERE b.status IN ('confirmed', 'completed', 'pending')
AND b.created_at >= NOW() - INTERVAL '30 days'
ORDER BY b.created_at DESC
LIMIT 10;

-- ============================================================================
-- 2. PROBLÈME: Doublons de signatures
-- ============================================================================

-- Identifier les doublons de signatures
SELECT 
    'Signature duplicates found' as issue,
    booking_id,
    COUNT(*) as signature_count,
    MIN(created_at) as first_signature,
    MAX(created_at) as last_signature,
    EXTRACT(EPOCH FROM (MAX(created_at) - MIN(created_at)))/60 as minutes_between_signatures
FROM contract_signatures
GROUP BY booking_id
HAVING COUNT(*) > 1
ORDER BY signature_count DESC
LIMIT 10;

-- ============================================================================
-- 3. PROBLÈME: Taux de soumission faible
-- ============================================================================

-- Réservations récentes sans soumissions
SELECT 
    'Recent bookings without submissions' as issue,
    b.id as booking_id,
    b.status,
    b.created_at,
    b.guest_name,
    b.guest_email,
    CASE 
        WHEN b.guest_email IS NOT NULL THEN 'Has guest email'
        ELSE 'Missing guest email'
    END as guest_contact_status
FROM bookings b
WHERE b.created_at >= NOW() - INTERVAL '7 days'
AND b.id NOT IN (SELECT DISTINCT booking_id FROM guest_submissions WHERE booking_id IS NOT NULL)
ORDER BY b.created_at DESC
LIMIT 10;

-- ============================================================================
-- 4. VÉRIFICATION DES PROCESSUS DE GÉNÉRATION
-- ============================================================================

-- Vérifier les réservations avec documents_generated mais sans generated_documents
SELECT 
    'Bookings with documents_generated but no generated_documents' as issue,
    b.id as booking_id,
    b.documents_generated,
    b.status,
    b.created_at,
    COUNT(gd.id) as actual_generated_docs
FROM bookings b
LEFT JOIN generated_documents gd ON gd.booking_id = b.id
WHERE b.documents_generated IS NOT NULL
GROUP BY b.id, b.documents_generated, b.status, b.created_at
HAVING COUNT(gd.id) = 0
ORDER BY b.created_at DESC
LIMIT 5;

-- ============================================================================
-- 5. VÉRIFICATION DE LA FONCTION submit-guest-info
-- ============================================================================

-- Vérifier les soumissions récentes créées par la fonction
SELECT 
    'Recent submissions from submit-guest-info' as issue,
    gs.id as submission_id,
    gs.booking_id,
    gs.status,
    gs.created_at,
    gs.submitted_at,
    CASE 
        WHEN gs.booking_data IS NOT NULL THEN 'Has booking data'
        ELSE 'Missing booking data'
    END as booking_data_status,
    CASE 
        WHEN gs.guest_data IS NOT NULL THEN 'Has guest data'
        ELSE 'Missing guest data'
    END as guest_data_status,
    CASE 
        WHEN gs.token_id IS NOT NULL THEN 'Has token'
        ELSE 'Missing token'
    END as token_status
FROM guest_submissions gs
WHERE gs.created_at >= NOW() - INTERVAL '1 day'
ORDER BY gs.created_at DESC
LIMIT 5;

-- ============================================================================
-- 6. VÉRIFICATION DES TOKENS
-- ============================================================================

-- Vérifier les tokens de vérification
SELECT 
    'Property verification tokens' as issue,
    COUNT(*) as total_tokens,
    COUNT(CASE WHEN is_active = true THEN 1 END) as active_tokens,
    COUNT(CASE WHEN created_at >= NOW() - INTERVAL '7 days' THEN 1 END) as recent_tokens
FROM property_verification_tokens;

-- Vérifier les tokens d'invités
SELECT 
    'Guest verification tokens' as issue,
    COUNT(*) as total_tokens,
    COUNT(CASE WHEN is_active = true THEN 1 END) as active_tokens,
    COUNT(CASE WHEN expires_at > NOW() THEN 1 END) as valid_tokens,
    COUNT(CASE WHEN created_at >= NOW() - INTERVAL '7 days' THEN 1 END) as recent_tokens
FROM guest_verification_tokens;

-- ============================================================================
-- 7. RÉSUMÉ DES ACTIONS URGENTES
-- ============================================================================

-- Résumé des problèmes critiques
SELECT 
    'URGENT ACTIONS NEEDED' as summary,
    CASE 
        WHEN (SELECT COUNT(*) FROM generated_documents) = 0 THEN 'CRITICAL: Fix document generation process'
        ELSE 'OK: Documents generated'
    END as action_1,
    CASE 
        WHEN (SELECT COUNT(*) FROM contract_signatures) > (SELECT COUNT(*) FROM bookings) THEN 'URGENT: Clean signature duplicates'
        ELSE 'OK: Signatures consistent'
    END as action_2,
    CASE 
        WHEN (SELECT COUNT(*) FROM guest_submissions WHERE created_at >= NOW() - INTERVAL '7 days') = 0 THEN 'URGENT: Test submit-guest-info function'
        ELSE 'OK: Recent submissions present'
    END as action_3,
    CASE 
        WHEN (SELECT COUNT(*) FROM property_verification_tokens WHERE is_active = true) = 0 THEN 'URGENT: Check token generation'
        ELSE 'OK: Active tokens present'
    END as action_4;

-- ============================================================================
-- 8. PRIORITÉS D'ACTION
-- ============================================================================

-- Priorités d'action basées sur l'analyse
SELECT 
    'ACTION PRIORITIES' as priority_type,
    '1. CRITICAL: Fix document generation (0 documents generated)' as priority_1,
    '2. URGENT: Clean signature duplicates (64 signatures for 48 bookings)' as priority_2,
    '3. HIGH: Test submit-guest-info function (low submission rate)' as priority_3,
    '4. MEDIUM: Optimize submission process (46% submission rate)' as priority_4,
    '5. LOW: Monitor and optimize performance' as priority_5;
