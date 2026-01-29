-- 🔍 DIAGNOSTIC COMPLET: Où est la signature du HOST?

-- 1. Vérifier dans properties.contract_template.landlord_signature
SELECT 
    'properties.contract_template' as source,
    name,
    contract_template->>'landlord_signature' as signature,
    LENGTH(contract_template->>'landlord_signature') as longueur,
    CASE 
        WHEN contract_template->>'landlord_signature' LIKE 'data:image/%' THEN '✅ Format Image'
        WHEN contract_template->>'landlord_signature' = 'VOTRE_SIGNATURE_ICI' THEN '❌ Placeholder'
        ELSE '⚠️ Autre'
    END as status
FROM properties
WHERE name LIKE '%studio%casa%';

-- 2. Vérifier dans host_profiles
SELECT 
    'host_profiles' as source,
    full_name,
    signature_svg IS NOT NULL as has_svg,
    signature_image_url IS NOT NULL as has_image_url,
    LENGTH(signature_svg) as svg_length,
    LENGTH(signature_image_url) as image_url_length,
    LEFT(COALESCE(signature_svg, signature_image_url, ''), 100) as signature_preview
FROM host_profiles
WHERE full_name LIKE '%ghali%' OR full_name LIKE '%lahlou%';

-- 3. Vérifier dans properties.contact_info
SELECT 
    'properties.contact_info' as source,
    name,
    contact_info->>'signature' as signature,
    LENGTH(contact_info->>'signature') as longueur
FROM properties
WHERE name LIKE '%studio%casa%';

-- 4. Vérifier dans les bookings récents (peut-être une copie locale?)
SELECT 
    'booking_cache' as source,
    id,
    booking_reference,
    guest_name
FROM bookings
WHERE id IN ('08b873d5-b584-4881-aa16-0cd8a18f214a', '99b22159-ac08-4cc6-9cbf-251463ad0df6')
LIMIT 5;

-- 5. DIAGNOSTIC: Récupérer le contrat généré pour voir son contenu
SELECT 
    document_url,
    created_at,
    document_type
FROM uploaded_documents
WHERE booking_id = '08b873d5-b584-4881-aa16-0cd8a18f214a'
  AND document_type = 'contract'
ORDER BY created_at DESC
LIMIT 1;
