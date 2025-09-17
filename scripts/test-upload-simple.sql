-- 🔍 TEST UPLOAD SIMPLE : VÉRIFIER LE PROBLÈME
-- Exécutez ce script dans Supabase SQL Editor

-- ========================================
-- 1. VÉRIFIER LA STRUCTURE DES TABLES
-- ========================================

-- Vérifier guest_submissions
SELECT 
    'guest_submissions' as table_name,
    COUNT(*) as total_rows,
    COUNT(CASE WHEN document_urls IS NOT NULL AND document_urls != '[]'::jsonb THEN 1 END) as with_docs,
    COUNT(CASE WHEN document_urls IS NULL OR document_urls = '[]'::jsonb THEN 1 END) as without_docs
FROM guest_submissions;

-- ========================================
-- 2. ANALYSER LES SOUMISSIONS RÉCENTES
-- ========================================

-- Voir les 5 dernières soumissions
SELECT 
    id,
    created_at,
    status,
    booking_id,
    CASE 
        WHEN document_urls IS NULL THEN 'NULL'
        WHEN document_urls = '[]'::jsonb THEN 'EMPTY ARRAY'
        ELSE 'HAS DOCS'
    END as doc_status,
    jsonb_array_length(COALESCE(document_urls, '[]'::jsonb)) as doc_count,
    LEFT(guest_data::text, 100) as guest_data_preview
FROM guest_submissions 
ORDER BY created_at DESC 
LIMIT 5;

-- ========================================
-- 3. VÉRIFIER LES RÉSERVATIONS LIÉES
-- ========================================

-- Vérifier que les soumissions sont liées aux réservations
SELECT 
    gs.id as submission_id,
    gs.booking_id,
    b.id as linked_booking_id,
    b.status as booking_status,
    CASE 
        WHEN gs.booking_id = b.id THEN '✅ LIÉE'
        ELSE '❌ NON LIÉE'
    END as link_status
FROM guest_submissions gs
LEFT JOIN bookings b ON gs.booking_id = b.id
ORDER BY gs.created_at DESC
LIMIT 10;

-- ========================================
-- 4. TEST DE CRÉATION MANUELLE
-- ========================================

-- Créer une soumission de test (décommentez si nécessaire)
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
    '["https://example.com/test-doc.jpg"]',
    'completed',
    'BOOKING-UUID-ICI'
);
*/
