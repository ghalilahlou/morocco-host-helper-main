-- 🔍 TEST UPLOAD DEBUG : IDENTIFIER LE PROBLÈME EXACT
-- Exécutez ce script dans Supabase SQL Editor pour identifier le problème

-- ========================================
-- 1. ANALYSE COMPLÈTE DES SOUMISSIONS
-- ========================================

-- Vérifier TOUTES les soumissions avec leurs documents
SELECT 
    gs.id as submission_id,
    gs.created_at,
    gs.status,
    gs.booking_id,
    gs.token_id,
    CASE 
        WHEN gs.document_urls IS NULL THEN 'NULL'
        WHEN gs.document_urls = '[]'::jsonb THEN 'EMPTY ARRAY'
        WHEN jsonb_array_length(gs.document_urls) > 0 THEN 'HAS DOCS'
        ELSE 'UNKNOWN'
    END as doc_status,
    jsonb_array_length(COALESCE(gs.document_urls, '[]'::jsonb)) as doc_count,
    gs.document_urls as raw_document_urls,
    LEFT(gs.guest_data::text, 200) as guest_data_preview
FROM guest_submissions gs
ORDER BY gs.created_at DESC;

-- ========================================
-- 2. ANALYSE DES RÉSERVATIONS AVEC DOCUMENTS
-- ========================================

-- Vérifier les réservations et leurs soumissions
SELECT 
    b.id as booking_id,
    b.check_in_date,
    b.check_out_date,
    b.status as booking_status,
    b.created_at as booking_created,
    COUNT(gs.id) as submission_count,
    COUNT(CASE WHEN gs.document_urls IS NOT NULL AND gs.document_urls != '[]'::jsonb THEN 1 END) as submissions_with_docs,
    COUNT(CASE WHEN gs.document_urls IS NULL OR gs.document_urls = '[]'::jsonb THEN 1 END) as submissions_without_docs,
    STRING_AGG(
        CASE 
            WHEN gs.document_urls IS NULL THEN 'NULL'
            WHEN gs.document_urls = '[]'::jsonb THEN 'EMPTY'
            ELSE 'HAS_DOCS'
        END, 
        ', ' ORDER BY gs.created_at
    ) as doc_status_summary
FROM bookings b
LEFT JOIN guest_submissions gs ON b.id = gs.booking_id
GROUP BY b.id, b.check_in_date, b.check_out_date, b.status, b.created_at
ORDER BY b.created_at DESC;

-- ========================================
-- 3. VÉRIFIER LES TOKENS ET PROPRIÉTÉS
-- ========================================

-- Vérifier que les tokens sont valides (sans expires_at)
SELECT 
    pvt.id as token_id,
    pvt.property_id,
    pvt.created_at as token_created,
    pvt.is_used as token_used,
    COUNT(gs.id) as submission_count,
    COUNT(CASE WHEN gs.document_urls IS NOT NULL AND gs.document_urls != '[]'::jsonb THEN 1 END) as submissions_with_docs
FROM property_verification_tokens pvt
LEFT JOIN guest_submissions gs ON pvt.id = gs.token_id
GROUP BY pvt.id, pvt.property_id, pvt.created_at, pvt.is_used
ORDER BY pvt.created_at DESC;

-- ========================================
-- 4. ANALYSE DES DONNÉES GUEST
-- ========================================

-- Extraire les informations des invités pour chaque soumission
SELECT 
    gs.id as submission_id,
    gs.booking_id,
    gs.created_at,
    CASE 
        WHEN gs.guest_data IS NOT NULL AND gs.guest_data ? 'guests' 
        THEN jsonb_array_length(gs.guest_data->'guests')
        ELSE 0
    END as guest_count,
    CASE 
        WHEN gs.guest_data IS NOT NULL AND gs.guest_data ? 'guests' 
        THEN gs.guest_data->'guests'->0->>'fullName'
        ELSE 'N/A'
    END as first_guest_name,
    CASE 
        WHEN gs.guest_data IS NOT NULL AND gs.guest_data ? 'guests' 
        THEN gs.guest_data->'guests'->0->>'documentNumber'
        ELSE 'N/A'
    END as first_guest_doc_number,
    gs.document_urls as stored_document_urls,
    CASE 
        WHEN gs.document_urls IS NULL THEN 'NO DOCS STORED'
        WHEN gs.document_urls = '[]'::jsonb THEN 'EMPTY DOCS ARRAY'
        WHEN jsonb_array_length(gs.document_urls) > 0 THEN 'DOCS STORED'
        ELSE 'UNKNOWN'
    END as storage_status
FROM guest_submissions gs
ORDER BY gs.created_at DESC;

-- ========================================
-- 5. RÉSUMÉ DU PROBLÈME
-- ========================================

-- Créer un résumé diagnostique
SELECT 
    'DIAGNOSTIC UPLOAD COMPLET' as diagnostic_type,
    NOW() as diagnostic_date,
    COUNT(*) as total_submissions,
    COUNT(CASE WHEN document_urls IS NOT NULL AND document_urls != '[]'::jsonb THEN 1 END) as submissions_with_docs,
    COUNT(CASE WHEN document_urls IS NULL OR document_urls = '[]'::jsonb THEN 1 END) as submissions_without_docs,
    ROUND(
        (COUNT(CASE WHEN document_urls IS NULL OR document_urls = '[]'::jsonb THEN 1 END)::float / COUNT(*)::float) * 100, 
        2
    ) as percentage_without_docs
FROM guest_submissions;
