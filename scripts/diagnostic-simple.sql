-- 🔍 DIAGNOSTIC SIMPLIFIÉ : PIÈCES D'IDENTITÉ DES INVITÉS
-- Ce script analyse où et comment les pièces d'identité sont stockées

-- ========================================
-- 1. ANALYSE DE LA STRUCTURE DES TABLES
-- ========================================

-- Vérifier la structure de guest_submissions
SELECT 
    'guest_submissions' as table_name,
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'guest_submissions'
ORDER BY ordinal_position;

-- Vérifier la structure de property_verification_tokens
SELECT 
    'property_verification_tokens' as table_name,
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'property_verification_tokens'
ORDER BY ordinal_position;

-- Vérifier la structure de guests
SELECT 
    'guests' as table_name,
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'guests'
ORDER BY ordinal_position;

-- ========================================
-- 2. ANALYSE DES DONNÉES EXISTANTES
-- ========================================

-- Compter les soumissions d'invités
SELECT 
    'Total guest_submissions' as metric,
    COUNT(*) as count
FROM guest_submissions
UNION ALL
SELECT 
    'Soumissions avec guest_data' as metric,
    COUNT(*) as count
FROM guest_submissions
WHERE guest_data IS NOT NULL AND guest_data != '{}'
UNION ALL
SELECT 
    'Soumissions avec document_urls' as metric,
    COUNT(*) as count
FROM guest_submissions
WHERE document_urls IS NOT NULL AND document_urls != '[]'::jsonb;

-- Analyser les soumissions récentes
SELECT 
    gs.id as submission_id,
    gs.created_at,
    gs.guest_data,
    gs.document_urls,
    gs.status,
    pvt.property_id,
    pvt.token
FROM guest_submissions gs
JOIN property_verification_tokens pvt ON gs.token_id = pvt.id
ORDER BY gs.created_at DESC
LIMIT 10;

-- ========================================
-- 3. ANALYSE DE LA VUE v_guest_submissions
-- ========================================

-- Vérifier si la vue existe
SELECT 
    'v_guest_submissions view' as check_type,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.views 
            WHERE table_name = 'v_guest_submissions'
        ) THEN 'EXISTE' 
        ELSE 'NEXISTE PAS' 
    END as status;

-- Si la vue existe, analyser son contenu
SELECT 
    'Test vue v_guest_submissions' as test_type,
    CASE 
        WHEN EXISTS (SELECT 1 FROM v_guest_submissions LIMIT 1) 
        THEN 'VUE ACCESSIBLE' 
        ELSE 'VUE INACCESSIBLE' 
    END as result;

-- ========================================
-- 4. ANALYSE DES INVITÉS
-- ========================================

-- Compter les invités par réservation
SELECT 
    b.id as booking_id,
    b.check_in_date,
    b.check_out_date,
    COUNT(g.id) as guest_count,
    STRING_AGG(g.full_name, ', ') as guest_names
FROM bookings b
LEFT JOIN guests g ON b.id = g.booking_id
GROUP BY b.id, b.check_in_date, b.check_out_date
ORDER BY b.created_at DESC
LIMIT 10;

-- ========================================
-- 5. ANALYSE DES DOCUMENTS UPLOADÉS
-- ========================================

-- Vérifier la table uploaded_documents
SELECT 
    'uploaded_documents' as table_name,
    COUNT(*) as total_documents
FROM uploaded_documents;

-- Analyser les documents par réservation
SELECT 
    ud.booking_id,
    ud.file_name,
    ud.file_path,
    ud.processing_status,
    ud.created_at
FROM uploaded_documents ud
ORDER BY ud.created_at DESC
LIMIT 10;

-- ========================================
-- 6. ANALYSE DES RELATIONS
-- ========================================

-- Vérifier les relations entre les tables
SELECT 
    tc.table_name,
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
    AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY'
    AND tc.table_name IN ('guest_submissions', 'property_verification_tokens', 'guests', 'bookings');

-- ========================================
-- 7. RÉSUMÉ DIAGNOSTIC
-- ========================================

-- Créer un résumé des problèmes potentiels
SELECT 
    'DIAGNOSTIC PIECES DIDENTITE' as diagnostic_type,
    NOW() as diagnostic_date;

-- Vérifier les permissions RLS
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies 
WHERE tablename IN ('guest_submissions', 'property_verification_tokens', 'guests')
ORDER BY tablename, policyname;
