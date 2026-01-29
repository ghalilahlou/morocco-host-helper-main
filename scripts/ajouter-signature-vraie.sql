-- 🎨 INTÉGRATION DE VOTRE VRAIE SIGNATURE
-- Après avoir utilisé signature-creator.html

-- ⚠️ INSTRUCTIONS:
-- 1. Ouvrez signature-creator.html dans votre navigateur
-- 2. Dessinez votre signature
-- 3. Cliquez sur "Générer Base64"
-- 4. Copiez le contenu généré
-- 5. Remplacez "VOTRE_SIGNATURE_ICI" ci-dessous par le Base64 copié
-- 6. Exécutez ce script dans Supabase SQL Editor

-- 📝 EXEMPLE DE FORMAT ATTENDU:
-- data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA... (plusieurs milliers de caractères)

-- =============================================================================
-- ÉTAPE 1: Intégrer votre signature
-- =============================================================================

UPDATE properties
SET contract_template = jsonb_set(
  COALESCE(contract_template, '{}'::jsonb),
  '{landlord_signature}',
  -- 👇 REMPLACEZ CETTE LIGNE PAR VOTRE BASE64
  '"VOTRE_SIGNATURE_ICI"'::jsonb
)
WHERE name LIKE '%studio%casa%' OR name LIKE '%casa%studio%';

-- =============================================================================
-- ÉTAPE 2: Vérifier que la signature a bien été enregistrée
-- =============================================================================

SELECT 
    name,
    contract_template->>'landlord_signature' IS NOT NULL as has_signature,
    LENGTH(contract_template->>'landlord_signature') as sig_length,
    CASE 
        WHEN LENGTH(contract_template->>'landlord_signature') < 500 THEN '❌ TROP COURTE (probablement test)'
        WHEN LENGTH(contract_template->>'landlord_signature') BETWEEN 500 AND 5000 THEN '⚠️ Petite signature'
        WHEN LENGTH(contract_template->>'landlord_signature') > 5000 THEN '✅ Signature de taille normale'
        ELSE '❓ Inconnu'
    END as size_status,
    LEFT(contract_template->>'landlord_signature', 50) as preview
FROM properties
WHERE name LIKE '%studio%casa%' OR name LIKE '%casa%studio%';

-- =============================================================================
-- ÉTAPE 3: Supprimer l'ancienne fiche de police pour forcer la régénération
-- =============================================================================

DELETE FROM uploaded_documents 
WHERE booking_id = '99b22159-ac08-4cc6-9cbf-251463ad0df6' 
  AND document_type = 'police';

-- Vérification de la suppression
SELECT 
    document_type,
    file_name,
    created_at
FROM uploaded_documents 
WHERE booking_id = '99b22159-ac08-4cc6-9cbf-251463ad0df6';

-- =============================================================================
-- INSTRUCTIONS POUR LA SUITE:
-- =============================================================================
-- 
-- Après avoir exécuté ce script:
-- 
-- 1. Aller dans l'interface (Dashboard)
-- 2. Sélectionner le booking '99b22159-ac08-4cc6-9cbf-251463ad0df6'
-- 3. Cliquer sur "Régénérer fiche de police"
-- 
-- OU utiliser l'API:
-- POST https://csopyblkfyofwkeqqegd.supabase.co/functions/v1/submit-guest-info-unified
-- Body: {
--   "action": "regenerate_police",
--   "bookingId": "99b22159-ac08-4cc6-9cbf-251463ad0df6"
-- }
--
-- 4. Télécharger la nouvelle fiche de police
-- 5. Vérifier visuellement que la signature du loueur apparaît en bas à gauche
-- =============================================================================
