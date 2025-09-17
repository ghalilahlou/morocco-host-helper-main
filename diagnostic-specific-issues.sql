-- Diagnostic des problèmes spécifiques identifiés
-- Basé sur les résultats de l'intégrité générale

-- ============================================================================
-- 1. ANALYSE DES DOCUMENTS GÉNÉRÉS (0 trouvés)
-- ============================================================================

-- Vérifier pourquoi aucun document généré
SELECT 
    'Generated Documents Analysis' as analysis_type,
    COUNT(*) as total_generated_docs,
    COUNT(CASE WHEN created_at >= NOW() - INTERVAL '7 days' THEN 1 END) as recent_docs,
    COUNT(CASE WHEN is_signed = true THEN 1 END) as signed_docs,
    COUNT(CASE WHEN document_type = 'contract' THEN 1 END) as contracts,
    COUNT(CASE WHEN document_type = 'police_form' THEN 1 END) as police_forms
FROM generated_documents;

-- Vérifier les réservations avec documents générés
SELECT 
    'Bookings with generated docs' as analysis_type,
    b.id as booking_id,
    b.status,
    b.documents_generated,
    COUNT(gd.id) as generated_docs_count
FROM bookings b
LEFT JOIN generated_documents gd ON gd.booking_id = b.id
GROUP BY b.id, b.status, b.documents_generated
HAVING COUNT(gd.id) = 0
ORDER BY b.created_at DESC
LIMIT 10;

-- ============================================================================
-- 2. ANALYSE DES SIGNATURES (64 signatures pour 48 réservations)
-- ============================================================================

-- Vérifier les doublons de signatures
SELECT 
    'Signature Duplicates Analysis' as analysis_type,
    booking_id,
    COUNT(*) as signature_count,
    MIN(created_at) as first_signature,
    MAX(created_at) as last_signature
FROM contract_signatures
GROUP BY booking_id
HAVING COUNT(*) > 1
ORDER BY signature_count DESC;

-- Vérifier les réservations sans signatures
SELECT 
    'Bookings without signatures' as analysis_type,
    b.id as booking_id,
    b.status,
    b.created_at,
    COUNT(cs.id) as signature_count
FROM bookings b
LEFT JOIN contract_signatures cs ON cs.booking_id = b.id
GROUP BY b.id, b.status, b.created_at
HAVING COUNT(cs.id) = 0
ORDER BY b.created_at DESC
LIMIT 10;

-- ============================================================================
-- 3. ANALYSE DES RÉSERVATIONS AIRBNB (116 pour 48 réservations)
-- ============================================================================

-- Vérifier la correspondance entre réservations et réservations Airbnb
SELECT 
    'Airbnb vs Bookings Analysis' as analysis_type,
    COUNT(DISTINCT b.id) as total_bookings,
    COUNT(DISTINCT ar.id) as total_airbnb_reservations,
    COUNT(DISTINCT ar.property_id) as properties_with_airbnb,
    COUNT(DISTINCT b.property_id) as properties_with_bookings
FROM bookings b
FULL OUTER JOIN airbnb_reservations ar ON ar.property_id = b.property_id;

-- Vérifier les propriétés avec beaucoup de réservations Airbnb
SELECT 
    'Properties with many Airbnb reservations' as analysis_type,
    p.id as property_id,
    p.name,
    COUNT(ar.id) as airbnb_reservations_count,
    COUNT(b.id) as bookings_count
FROM properties p
LEFT JOIN airbnb_reservations ar ON ar.property_id = p.id
LEFT JOIN bookings b ON b.property_id = p.id
GROUP BY p.id, p.name
HAVING COUNT(ar.id) > 5
ORDER BY airbnb_reservations_count DESC;

-- ============================================================================
-- 4. ANALYSE DES SOUMISSIONS D'INVITÉS (22 pour 48 réservations)
-- ============================================================================

-- Vérifier les réservations sans soumissions
SELECT 
    'Bookings without submissions' as analysis_type,
    b.id as booking_id,
    b.status,
    b.created_at,
    COUNT(gs.id) as submission_count
FROM bookings b
LEFT JOIN guest_submissions gs ON gs.booking_id = b.id
GROUP BY b.id, b.status, b.created_at
HAVING COUNT(gs.id) = 0
ORDER BY b.created_at DESC
LIMIT 10;

-- Vérifier les soumissions sans réservations correspondantes
SELECT 
    'Submissions without bookings' as analysis_type,
    gs.id as submission_id,
    gs.booking_id,
    gs.status,
    gs.created_at
FROM guest_submissions gs
LEFT JOIN bookings b ON b.id = gs.booking_id
WHERE b.id IS NULL
ORDER BY gs.created_at DESC;

-- ============================================================================
-- 5. ANALYSE DES DOCUMENTS UPLOADÉS (21 pour 48 réservations)
-- ============================================================================

-- Vérifier les réservations sans documents uploadés
SELECT 
    'Bookings without uploaded documents' as analysis_type,
    b.id as booking_id,
    b.status,
    b.created_at,
    COUNT(ud.id) as document_count
FROM bookings b
LEFT JOIN uploaded_documents ud ON ud.booking_id = b.id
GROUP BY b.id, b.status, b.created_at
HAVING COUNT(ud.id) = 0
ORDER BY b.created_at DESC
LIMIT 10;

-- Vérifier les types de documents uploadés
SELECT 
    'Document types analysis' as analysis_type,
    document_type,
    COUNT(*) as count,
    COUNT(CASE WHEN processing_status = 'completed' THEN 1 END) as completed,
    COUNT(CASE WHEN processing_status = 'pending' THEN 1 END) as pending,
    COUNT(CASE WHEN processing_status = 'failed' THEN 1 END) as failed
FROM uploaded_documents
GROUP BY document_type, processing_status
ORDER BY count DESC;

-- ============================================================================
-- 6. ANALYSE DES INVITÉS (54 pour 48 réservations)
-- ============================================================================

-- Vérifier les réservations avec plusieurs invités
SELECT 
    'Bookings with multiple guests' as analysis_type,
    b.id as booking_id,
    b.number_of_guests,
    COUNT(g.id) as actual_guests_count,
    b.created_at
FROM bookings b
LEFT JOIN guests g ON g.booking_id = b.id
GROUP BY b.id, b.number_of_guests, b.created_at
HAVING COUNT(g.id) > 1
ORDER BY actual_guests_count DESC
LIMIT 10;

-- Vérifier les invités sans réservations
SELECT 
    'Guests without bookings' as analysis_type,
    g.id as guest_id,
    g.full_name,
    g.booking_id,
    g.created_at
FROM guests g
LEFT JOIN bookings b ON b.id = g.booking_id
WHERE b.id IS NULL
ORDER BY g.created_at DESC;

-- ============================================================================
-- 7. ANALYSE DES STATUTS DE RÉSERVATION
-- ============================================================================

-- Vérifier la répartition des statuts
SELECT 
    'Booking status distribution' as analysis_type,
    status,
    COUNT(*) as count,
    COUNT(CASE WHEN created_at >= NOW() - INTERVAL '7 days' THEN 1 END) as recent
FROM bookings
GROUP BY status
ORDER BY count DESC;

-- ============================================================================
-- 8. ANALYSE DES PROPRIÉTÉS
-- ============================================================================

-- Vérifier les propriétés les plus actives
SELECT 
    'Most active properties' as analysis_type,
    p.id as property_id,
    p.name,
    COUNT(b.id) as bookings_count,
    COUNT(ar.id) as airbnb_reservations_count,
    p.airbnb_ics_url IS NOT NULL as has_airbnb_sync
FROM properties p
LEFT JOIN bookings b ON b.property_id = p.id
LEFT JOIN airbnb_reservations ar ON ar.property_id = p.id
GROUP BY p.id, p.name, p.airbnb_ics_url
ORDER BY bookings_count DESC
LIMIT 10;

-- ============================================================================
-- 9. RÉSUMÉ DES PROBLÈMES IDENTIFIÉS
-- ============================================================================

-- Résumé des problèmes potentiels
SELECT 
    'PROBLEMS SUMMARY' as summary_type,
    (SELECT COUNT(*) FROM bookings WHERE id NOT IN (SELECT DISTINCT booking_id FROM guest_submissions WHERE booking_id IS NOT NULL)) as bookings_without_submissions,
    (SELECT COUNT(*) FROM bookings WHERE id NOT IN (SELECT DISTINCT booking_id FROM uploaded_documents WHERE booking_id IS NOT NULL)) as bookings_without_documents,
    (SELECT COUNT(*) FROM bookings WHERE id NOT IN (SELECT DISTINCT booking_id FROM generated_documents WHERE booking_id IS NOT NULL)) as bookings_without_generated_docs,
    (SELECT COUNT(*) FROM guest_submissions WHERE booking_id IS NOT NULL AND booking_id NOT IN (SELECT id FROM bookings)) as orphaned_submissions,
    (SELECT COUNT(*) FROM uploaded_documents WHERE booking_id IS NOT NULL AND booking_id NOT IN (SELECT id FROM bookings)) as orphaned_documents;

-- ============================================================================
-- 10. RECOMMANDATIONS
-- ============================================================================

-- Recommandations basées sur l'analyse
SELECT 
    'RECOMMENDATIONS' as recommendation_type,
    CASE 
        WHEN (SELECT COUNT(*) FROM generated_documents) = 0 THEN 'URGENT: Aucun document généré - vérifier le processus de génération'
        ELSE 'OK: Documents générés présents'
    END as generated_docs_status,
    CASE 
        WHEN (SELECT COUNT(*) FROM contract_signatures) > (SELECT COUNT(*) FROM bookings) THEN 'ATTENTION: Plus de signatures que de réservations - vérifier les doublons'
        ELSE 'OK: Nombre de signatures cohérent'
    END as signatures_status,
    CASE 
        WHEN (SELECT COUNT(*) FROM guest_submissions) < (SELECT COUNT(*) FROM bookings) * 0.8 THEN 'ATTENTION: Taux de soumission faible - vérifier le processus'
        ELSE 'OK: Taux de soumission acceptable'
    END as submissions_status;
