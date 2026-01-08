-- =====================================================
-- DIAGNOSTIC RAPIDE : Signature du Loueur
-- =====================================================

-- 🔍 ÉTAPE 1 : Vérifier TOUTES les propriétés
SELECT 
    id,
    name,
    contract_template IS NOT NULL as has_template,
    contract_template->'landlord_signature' IS NOT NULL as has_sig,
    CASE 
        WHEN contract_template->>'landlord_signature' LIKE 'data:image/png%' THEN '✅ PNG'
        WHEN contract_template->>'landlord_signature' LIKE 'data:image/jpeg%' THEN '✅ JPEG'
        WHEN contract_template->>'landlord_signature' LIKE 'data:image/jpg%' THEN '✅ JPG'
        WHEN contract_template->>'landlord_signature' LIKE 'data:image/svg%' THEN '❌ SVG (non supporté)'
        WHEN contract_template->'landlord_signature' IS NULL THEN '❌ NULL'
        WHEN contract_template->>'landlord_signature' = '' THEN '❌ VIDE'
        ELSE '⚠️ AUTRE'
    END as format,
    LENGTH(contract_template->>'landlord_signature') as sig_length,
    LEFT(contract_template->>'landlord_signature', 50) as sig_preview
FROM properties
ORDER BY name;

-- =====================================================

-- 🔍 ÉTAPE 2 : Détails pour "studio casa" (si existe)
SELECT 
    id,
    name,
    contract_template::jsonb as full_template,
    contract_template->'landlord_signature' as signature_field,
    contract_template->'landlord_name' as landlord_name_field,
    contract_template->'landlord_email' as landlord_email_field,
    contract_template->'landlord_phone' as landlord_phone_field
FROM properties
WHERE LOWER(name) LIKE '%studio%casa%'
   OR LOWER(name) LIKE '%casa%studio%';

-- =====================================================

-- 🔍 ÉTAPE 3 : Vérifier le type exact de contract_template
SELECT 
    id,
    name,
    pg_typeof(contract_template) as column_type,
    jsonb_typeof(contract_template) as jsonb_type,
    contract_template IS NULL as is_null,
    contract_template::text = '{}' as is_empty_object,
    jsonb_object_keys(contract_template) as template_keys
FROM properties
WHERE contract_template IS NOT NULL
ORDER BY name;

-- =====================================================

-- 🔍 ÉTAPE 4 : Compter les propriétés avec/sans signature
SELECT 
    COUNT(*) as total_properties,
    COUNT(contract_template) as has_template,
    COUNT(contract_template->'landlord_signature') as has_signature_field,
    COUNT(
        CASE 
            WHEN contract_template->>'landlord_signature' LIKE 'data:image/%' 
            THEN 1 
        END
    ) as has_valid_signature
FROM properties;

-- =====================================================

-- 🎯 RÉSULTAT ATTENDU :
--
-- ÉTAPE 1 : Doit montrer "✅ PNG" ou "✅ JPEG" pour les propriétés avec signature
-- ÉTAPE 2 : Doit montrer le contract_template complet
-- ÉTAPE 3 : Doit montrer le type JSONB
-- ÉTAPE 4 : Doit compter combien ont une signature valide
--
-- Si TOUS montrent "❌ NULL" ou "❌ VIDE" :
--   → La signature n'a JAMAIS été ajoutée
--   → Action : Aller dans "Modifier le bien" et ajouter la signature
--
-- Si le format est "❌ SVG" :
--   → Format non supporté par pdf-lib
--   → Action : Réuploader en PNG ou JPEG
--
-- Si le format est "✅ PNG" ou "✅ JPEG" :
--   → La signature existe en BDD
--   → Le problème est ailleurs (logs, code, etc.)
--
-- =====================================================
