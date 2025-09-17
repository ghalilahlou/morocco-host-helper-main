-- 🔍 TEST UPLOAD DOCUMENTS : IDENTIFIER LE PROBLÈME
-- Ce script teste l'upload des documents et identifie pourquoi ils ne sont pas sauvegardés

-- ========================================
-- 1. ANALYSE DES SOUMISSIONS RÉCENTES
-- ========================================

-- Vérifier les soumissions avec et sans documents
SELECT 
    gs.id as submission_id,
    gs.created_at,
    gs.status,
    gs.booking_id,
    CASE 
        WHEN gs.document_urls IS NULL OR gs.document_urls = '[]'::jsonb 
        THEN 'SANS DOCUMENTS' 
        ELSE 'AVEC DOCUMENTS' 
    END as document_status,
    jsonb_array_length(COALESCE(gs.document_urls, '[]'::jsonb)) as document_count,
    gs.guest_data->'documentUrls' as guest_data_document_urls,
    gs.document_urls as stored_document_urls
FROM guest_submissions gs
ORDER BY gs.created_at DESC
LIMIT 10;

-- ========================================
-- 2. ANALYSE DU STOCKAGE SUPABASE
-- ========================================

-- Vérifier si les fichiers existent dans le bucket guest-documents
-- Note: Cette requête nécessite des permissions spéciales sur storage
SELECT 
    'guest-documents bucket' as storage_location,
    'Vérifier manuellement dans Supabase Dashboard > Storage' as instruction;

-- ========================================
-- 3. ANALYSE DES RÉSERVATIONS LIÉES
-- ========================================

-- Vérifier les réservations avec leurs soumissions
SELECT 
    b.id as booking_id,
    b.check_in_date,
    b.check_out_date,
    b.status as booking_status,
    COUNT(gs.id) as submission_count,
    COUNT(CASE WHEN gs.document_urls IS NOT NULL AND gs.document_urls != '[]'::jsonb THEN 1 END) as submissions_with_docs,
    COUNT(CASE WHEN gs.document_urls IS NULL OR gs.document_urls = '[]'::jsonb THEN 1 END) as submissions_without_docs
FROM bookings b
LEFT JOIN guest_submissions gs ON b.id = gs.booking_id
GROUP BY b.id, b.check_in_date, b.check_out_date, b.status
ORDER BY b.created_at DESC
LIMIT 10;

-- ========================================
-- 4. TEST DE CRÉATION DE DONNÉES
-- ========================================

-- Créer une soumission de test avec documents (si nécessaire)
-- Décommentez et modifiez selon vos besoins
/*
INSERT INTO guest_submissions (
    token_id,
    guest_data,
    document_urls,
    status,
    booking_id
) VALUES (
    'TOKEN-UUID-ICI',
    '{"guests": [{"fullName": "TEST USER", "documentNumber": "TEST123"}]}',
    '["https://example.com/test-doc.pdf"]',
    'completed',
    'BOOKING-UUID-ICI'
);
*/

-- ========================================
-- 5. VÉRIFICATION DES RELATIONS
-- ========================================

-- Vérifier que les soumissions sont bien liées aux réservations
SELECT 
    gs.id as submission_id,
    gs.booking_id,
    gs.token_id,
    pvt.property_id,
    b.id as linked_booking_id,
    b.status as booking_status,
    CASE 
        WHEN gs.booking_id = b.id THEN 'LIÉE CORRECTEMENT'
        ELSE 'LIEN CASSÉ'
    END as link_status
FROM guest_submissions gs
JOIN property_verification_tokens pvt ON gs.token_id = pvt.id
LEFT JOIN bookings b ON gs.booking_id = b.id
ORDER BY gs.created_at DESC
LIMIT 10;

-- ========================================
-- 6. RÉSUMÉ DIAGNOSTIC
-- ========================================

-- Créer un résumé des problèmes
SELECT 
    'DIAGNOSTIC UPLOAD DOCUMENTS' as diagnostic_type,
    NOW() as diagnostic_date,
    'Vérifier les résultats ci-dessus pour identifier le problème' as instruction;
