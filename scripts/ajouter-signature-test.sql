-- 🛠️ SOLUTION: Ajouter une signature test au loueur
-- ⚠️ IMPORTANT: Remplacez la signature test par votre vraie signature

-- Option 1: Signature PNG test (petit carré noir)
-- À UTILISER UNIQUEMENT POUR TESTER SI LE SYSTÈME FONCTIONNE
UPDATE properties
SET contract_template = jsonb_set(
  COALESCE(contract_template, '{}'::jsonb),
  '{landlord_signature}',
  -- Signature test: carré noir 10x10 en PNG base64
  '"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKCAYAAACNMs+9AAAAFUlEQVR42mNk+M9Qz0AEYBxVSF+FABJADveWkH6oAAAAAElFTkSuQmCC"'::jsonb
)
WHERE name LIKE '%studio%casa%' OR name LIKE '%casa%studio%';

-- Vérification après insertion
SELECT 
    name,
    contract_template->>'landlord_signature' IS NOT NULL as has_signature,
    LENGTH(contract_template->>'landlord_signature') as sig_length,
    LEFT(contract_template->>'landlord_signature', 50) as preview
FROM properties
WHERE name LIKE '%studio%casa%' OR name LIKE '%casa%studio%';

-- =========================================================
-- POUR AJOUTER VOTRE VRAIE SIGNATURE:
-- =========================================================
-- 1. Dessinez votre signature dans un outil (ex: canvas, signature pad)
-- 2. Exportez en PNG
-- 3. Convertissez en base64 (https://base64.guru/converter/encode/image)
-- 4. Le résultat doit être: data:image/png;base64,iVBORw0KG...
-- 5. Remplacez la valeur dans la commande ci-dessous:

/*
UPDATE properties
SET contract_template = jsonb_set(
  COALESCE(contract_template, '{}'::jsonb),
  '{landlord_signature}',
  '"VOTRE_SIGNATURE_COMPLETE_EN_BASE64"'::jsonb
)
WHERE id = '488d5074-b6ce-40a8-b0d5-036e97993410';
*/

-- =========================================================
-- POUR SUPPRIMER UNE SIGNATURE (si besoin)
-- =========================================================
/*
UPDATE properties
SET contract_template = contract_template - 'landlord_signature'
WHERE id = '488d5074-b6ce-40a8-b0d5-036e97993410';
*/
