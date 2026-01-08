-- Script de vérification de la signature du loueur dans les fiches de police

-- 1. Vérifier si les propriétés ont une signature de loueur
SELECT 
    id,
    name,
    CASE 
        WHEN contract_template IS NULL THEN '❌ contract_template est NULL'
        WHEN contract_template-\u003e'landlord_signature' IS NULL THEN '❌ landlord_signature manquante'
        WHEN contract_template-\u003e\u003e'landlord_signature' = '' THEN '⚠️ landlord_signature vide'
        WHEN contract_template-\u003e\u003e'landlord_signature' LIKE 'data:image/%' THEN '✅ Signature présente (data URL valide)'
        ELSE '⚠️ Format inconnu: ' || LEFT(contract_template-\u003e\u003e'landlord_signature', 50)
    END as signature_status,
    LENGTH(contract_template-\u003e\u003e'landlord_signature') as signature_length,
    LEFT(contract_template-\u003e\u003e'landlord_signature', 30) || '...' as signature_preview
FROM properties
ORDER BY name;

-- 2. Vérifier pour une propriété spécifique (studio casa)
SELECT 
    id,
    name,
    contract_template-\u003e'landlord_signature' as landlord_signature_raw,
    contract_template-\u003e'landlord_name' as landlord_name,
    contract_template-\u003e'landlord_email' as landlord_email,
    contract_template-\u003e'landlord_phone' as landlord_phone,
    contract_template
FROM properties
WHERE LOWER(name) LIKE '%studio%casa%'
   OR LOWER(name) LIKE '%casa%studio%';

-- 3. Vérifier les réservations récentes et leurs propriétés associées
SELECT 
    b.id as booking_id,
    b.booking_reference,
    b.check_in_date,
    p.name as property_name,
    CASE 
        WHEN p.contract_template IS NULL THEN '❌ No contract_template'
        WHEN p.contract_template-\u003e'landlord_signature' IS NULL THEN '❌ No signature'
        WHEN p.contract_template-\u003e\u003e'landlord_signature' = '' THEN '⚠️ Empty signature'
        WHEN p.contract_template-\u003e\u003e'landlord_signature' LIKE 'data:image/%' THEN '✅ Valid signature'
        ELSE '⚠️ Unknown format'
    END as signature_status,
    LENGTH(p.contract_template-\u003e\u003e'landlord_signature') as sig_length
FROM bookings b
JOIN properties p ON b.property_id = p.id
WHERE b.created_at \u003e NOW() - INTERVAL '30 days'
ORDER BY b.check_in_date DESC
LIMIT 20;

-- 4. Test complet : récupérer une réservation comme le fait l'Edge Function
SELECT 
    b.*,
    json_build_object(
        'id', p.id,
        'name', p.name,
        'address', p.address,
        'contract_template', p.contract_template
    ) as property,
    COALESCE(json_agg(g.*) FILTER (WHERE g.id IS NOT NULL), '[]') as guests
FROM bookings b
LEFT JOIN properties p ON b.property_id = p.id
LEFT JOIN guests g ON g.booking_id = b.id
WHERE b.check_in_date \u003e= CURRENT_DATE - INTERVAL '7 days'
  AND b.check_in_date \u003c= CURRENT_DATE + INTERVAL '30 days'
GROUP BY b.id, p.id
ORDER BY b.check_in_date DESC
LIMIT 5;

-- 5. Vérifier si la signature du loueur existe dans le template par défaut
SELECT 
    p.id,
    p.name,
    p.contract_template IS NOT NULL as has_contract_template,
    p.contract_template-\u003e'landlord_signature' IS NOT NULL as has_signature,
    p.contract_template-\u003e\u003e'landlord_signature' != '' as signature_not_empty,
    CASE 
        WHEN p.contract_template-\u003e\u003e'landlord_signature' LIKE 'data:image/png%' THEN 'PNG'
        WHEN p.contract_template-\u003e\u003e'landlord_signature' LIKE 'data:image/jpeg%' THEN 'JPEG'
        WHEN p.contract_template-\u003e\u003e'landlord_signature' LIKE 'data:image/jpg%' THEN 'JPG'
        WHEN p.contract_template-\u003e\u003e'landlord_signature' LIKE 'data:image/%' THEN 'OTHER_IMAGE'
        ELSE 'INVALID'
    END as signature_format
FROM properties p
ORDER BY p.created_at DESC;
