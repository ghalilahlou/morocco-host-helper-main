-- ========================================
-- VÉRIFICATION DU STOCKAGE DES DOCUMENTS
-- ========================================

-- 1. Vérifier les soumissions avec documents
SELECT 
    gs.id as submission_id,
    gs.created_at,
    gs.document_urls,
    gs.guest_data,
    CASE 
        WHEN gs.document_urls IS NOT NULL AND gs.document_urls != '[]'::jsonb 
        THEN jsonb_array_length(gs.document_urls)
        ELSE 0
    END as doc_count,
    CASE 
        WHEN gs.document_urls IS NOT NULL AND gs.document_urls != '[]'::jsonb 
        THEN 'HAS_DOCS'
        ELSE 'NO_DOCS'
    END as doc_status
FROM guest_submissions gs
WHERE gs.document_urls IS NOT NULL 
  AND gs.document_urls != '[]'::jsonb
ORDER BY gs.created_at DESC
LIMIT 10;

-- 2. Vérifier le contenu des document_urls
SELECT 
    gs.id as submission_id,
    gs.created_at,
    gs.document_urls,
    -- Extraire chaque URL individuellement
    CASE 
        WHEN gs.document_urls IS NOT NULL AND gs.document_urls != '[]'::jsonb 
        THEN gs.document_urls->0
        ELSE NULL
    END as first_doc_url,
    CASE 
        WHEN gs.document_urls IS NOT NULL AND gs.document_urls != '[]'::jsonb 
        THEN gs.document_urls->1
        ELSE NULL
    END as second_doc_url,
    -- Vérifier le type de fichier
    CASE 
        WHEN gs.document_urls IS NOT NULL AND gs.document_urls != '[]'::jsonb 
        THEN 
            CASE 
                WHEN gs.document_urls->0 LIKE '%.jpg' OR gs.document_urls->0 LIKE '%.jpeg' OR gs.document_urls->0 LIKE '%.png' 
                THEN 'IMAGE'
                WHEN gs.document_urls->0 LIKE '%.pdf' 
                THEN 'PDF'
                ELSE 'OTHER'
            END
        ELSE 'NO_DOCS'
    END as first_doc_type
FROM guest_submissions gs
WHERE gs.document_urls IS NOT NULL 
  AND gs.document_urls != '[]'::jsonb
ORDER BY gs.created_at DESC
LIMIT 5;

-- 3. Vérifier les réservations liées
SELECT 
    b.id as booking_id,
    b.check_in_date,
    b.check_out_date,
    b.submission_id,
    gs.document_urls,
    gs.guest_data,
    CASE 
        WHEN gs.document_urls IS NOT NULL AND gs.document_urls != '[]'::jsonb 
        THEN jsonb_array_length(gs.document_urls)
        ELSE 0
    END as doc_count
FROM bookings b
JOIN guest_submissions gs ON b.submission_id = gs.id
WHERE gs.document_urls IS NOT NULL 
  AND gs.document_urls != '[]'::jsonb
ORDER BY b.created_at DESC
LIMIT 5;

-- 4. Vérifier le bucket de stockage (si accessible)
-- Note: Cette requête peut ne pas fonctionner selon les permissions
SELECT 
    name,
    metadata,
    created_at
FROM storage.objects 
WHERE bucket_id = 'guest-documents'
ORDER BY created_at DESC
LIMIT 10;
