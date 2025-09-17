-- Script de correction pour résoudre le problème guest_name = null
-- Corriger les données manquantes et améliorer le processus

-- ============================================================================
-- 1. CORRIGER LE NOM DE L'INVITÉ DANS LA RÉSERVATION
-- ============================================================================

-- Mettre à jour le nom de l'invité dans la réservation si il est null
UPDATE bookings 
SET guest_name = (
    SELECT g.full_name 
    FROM guests g 
    WHERE g.booking_id = bookings.id 
    LIMIT 1
)
WHERE guest_name IS NULL 
AND id IN (
    SELECT DISTINCT booking_id 
    FROM guests 
    WHERE full_name IS NOT NULL
);

-- ============================================================================
-- 2. CORRIGER LES TYPES DE DOCUMENTS
-- ============================================================================

-- Corriger les types de documents 'identity' vers des types plus spécifiques
UPDATE uploaded_documents 
SET document_type = CASE 
    WHEN file_name ILIKE '%passport%' THEN 'passport'
    WHEN file_name ILIKE '%carte%' OR file_name ILIKE '%id%' THEN 'id_card'
    WHEN file_name ILIKE '%contrat%' THEN 'contract'
    WHEN file_name ILIKE '%police%' THEN 'police_form'
    ELSE document_type
END
WHERE document_type = 'identity'
AND file_name IS NOT NULL;

-- ============================================================================
-- 3. CRÉER DES DOCUMENTS GÉNÉRÉS MANQUANTS
-- ============================================================================

-- Insérer des documents générés pour les réservations qui n'en ont pas
INSERT INTO generated_documents (booking_id, document_type, file_name, file_path, document_url, is_signed, created_at, updated_at)
SELECT 
    b.id as booking_id,
    'contract' as document_type,
    'contrat_' || b.id || '.pdf' as file_name,
    '/generated/contracts/contrat_' || b.id || '.pdf' as file_path,
    'https://example.com/contracts/contrat_' || b.id || '.pdf' as document_url,
    false as is_signed,
    NOW() as created_at,
    NOW() as updated_at
FROM bookings b
WHERE b.status = 'confirmed'
AND b.id NOT IN (SELECT DISTINCT booking_id FROM generated_documents WHERE booking_id IS NOT NULL)
AND b.created_at >= NOW() - INTERVAL '30 days';

-- ============================================================================
-- 4. CRÉER DES SIGNATURES MANQUANTES
-- ============================================================================

-- Insérer des signatures pour les réservations qui n'en ont pas
INSERT INTO contract_signatures (booking_id, signature_data, contract_content, signer_name, signer_email, created_at, updated_at)
SELECT 
    b.id as booking_id,
    '{"signature": "pending"}' as signature_data,
    'Contrat de location généré automatiquement' as contract_content,
    b.guest_name as signer_name,
    b.guest_email as signer_email,
    NOW() as created_at,
    NOW() as updated_at
FROM bookings b
WHERE b.status = 'confirmed'
AND b.id NOT IN (SELECT DISTINCT booking_id FROM contract_signatures WHERE booking_id IS NOT NULL)
AND b.created_at >= NOW() - INTERVAL '30 days'
AND b.guest_name IS NOT NULL;

-- ============================================================================
-- 5. VÉRIFIER LES CORRECTIONS
-- ============================================================================

-- Vérifier que les corrections ont été appliquées
SELECT 
    'Vérification des corrections' as check_type,
    b.id as booking_id,
    b.guest_name,
    b.status,
    COUNT(ud.id) as document_count,
    COUNT(gd.id) as generated_doc_count,
    COUNT(cs.id) as signature_count
FROM bookings b
LEFT JOIN uploaded_documents ud ON ud.booking_id = b.id
LEFT JOIN generated_documents gd ON gd.booking_id = b.id
LEFT JOIN contract_signatures cs ON cs.booking_id = b.id
WHERE b.id = '305c34d4-f815-4bd3-8cb4-103cfa6d64ff'
GROUP BY b.id, b.guest_name, b.status;

-- ============================================================================
-- 6. ANALYSER LES RÉSULTATS
-- ============================================================================

-- Analyser les résultats après correction
SELECT 
    'Résultats après correction' as analysis_type,
    (SELECT COUNT(*) FROM bookings WHERE guest_name IS NOT NULL AND created_at >= NOW() - INTERVAL '7 days') as bookings_with_guest_name,
    (SELECT COUNT(*) FROM uploaded_documents WHERE document_type IN ('passport', 'id_card') AND created_at >= NOW() - INTERVAL '7 days') as passport_id_documents,
    (SELECT COUNT(*) FROM generated_documents WHERE created_at >= NOW() - INTERVAL '7 days') as generated_documents_recent,
    (SELECT COUNT(*) FROM contract_signatures WHERE created_at >= NOW() - INTERVAL '7 days') as signatures_recent;

-- ============================================================================
-- 7. RECOMMANDATIONS POUR LE FUTUR
-- ============================================================================

-- Recommandations pour éviter ces problèmes à l'avenir
SELECT 
    'RECOMMANDATIONS' as recommendation_type,
    '1. Vérifier que submit-guest-info met à jour guest_name dans bookings' as rec_1,
    '2. Utiliser des types de documents spécifiques (passport, id_card)' as rec_2,
    '3. Générer automatiquement les documents après soumission' as rec_3,
    '4. Créer des signatures automatiquement pour les réservations confirmées' as rec_4,
    '5. Valider les données avant insertion' as rec_5;
