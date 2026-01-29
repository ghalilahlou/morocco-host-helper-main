-- 🔍 DIAGNOSTIC IMMÉDIAT: Vérification de la signature du loueur
-- Exécutez ce script dans Supabase SQL Editor

-- 1. Vérifier la propriété "studio casa"
SELECT 
    id,
    name,
    contract_template->>'landlord_signature' IS NOT NULL as has_signature,
    LENGTH(contract_template->>'landlord_signature') as sig_length,
    CASE 
        WHEN contract_template->>'landlord_signature' IS NULL THEN '❌ Signature NULL'
        WHEN contract_template->>'landlord_signature' = '' THEN '❌ Signature vide'
        WHEN contract_template->>'landlord_signature' LIKE 'data:image/png%' THEN '✅ PNG valide'
        WHEN contract_template->>'landlord_signature' LIKE 'data:image/jpeg%' THEN '✅ JPEG valide'
        WHEN contract_template->>'landlord_signature' LIKE 'data:image/jpg%' THEN '✅ JPG valide'
        WHEN contract_template->>'landlord_signature' LIKE 'data:image/svg%' THEN '⚠️ SVG (non supporté par pdf-lib)'
        WHEN contract_template->>'landlord_signature' LIKE 'http%' THEN '✅ URL valide'
        ELSE '❌ Format inconnu'
    END as format_status,
    LEFT(contract_template->>'landlord_signature', 100) as sig_preview
FROM properties
WHERE LOWER(name) LIKE '%studio%casa%' OR LOWER(name) LIKE '%casa%studio%';

-- 2. Vérifier toutes les propriétés
SELECT 
    id,
    name,
    contract_template->>'landlord_name' as landlord_name,
    contract_template->>'landlord_email' as landlord_email,
    contract_template->>'landlord_signature' IS NOT NULL as has_signature,
    LENGTH(contract_template->>'landlord_signature') as sig_length,
    CASE 
        WHEN contract_template->>'landlord_signature' IS NULL THEN '❌ NULL'
        WHEN contract_template->>'landlord_signature' = '' THEN '❌ Vide'
        WHEN contract_template->>'landlord_signature' LIKE 'data:image/png%' THEN '✅ PNG'
        WHEN contract_template->>'landlord_signature' LIKE 'data:image/jpeg%' THEN '✅ JPEG'
        WHEN contract_template->>'landlord_signature' LIKE 'data:image/jpg%' THEN '✅ JPG'
        WHEN contract_template->>'landlord_signature' LIKE 'data:image/svg%' THEN '⚠️ SVG'
        WHEN contract_template->>'landlord_signature' LIKE 'http%' THEN '✅ URL'
        ELSE '❌ Autre'
    END as format
FROM properties
ORDER BY created_at DESC;

-- 3. Vérifier le booking spécifique dans les logs
SELECT 
    b.id as booking_id,
    b.booking_reference,
    p.name as property_name,
    p.contract_template->>'landlord_signature' IS NOT NULL as has_landlord_signature,
    LENGTH(p.contract_template->>'landlord_signature') as sig_length
FROM bookings b
JOIN properties p ON b.property_id = p.id
WHERE b.id = '99b22159-ac08-4cc6-9cbf-251463ad0df6';

-- 4. Voir les clés du contract_template pour la propriété
SELECT 
    name,
    jsonb_object_keys(contract_template) as template_keys
FROM properties
WHERE LOWER(name) LIKE '%studio%casa%' OR LOWER(name) LIKE '%casa%studio%';
