-- Test final de la signature avec le bon type UUID
-- Maintenant que toutes les colonnes existent

-- Tester une insertion avec un vrai UUID
INSERT INTO contract_signatures (
  booking_id,
  signer_name,
  signer_email,
  signer_phone,
  signature_data,
  contract_content,
  signed_at
) VALUES (
  gen_random_uuid(), -- Utiliser directement un UUID au lieu de concaténer
  'Test Signer Final',
  'test@example.com',
  '+1234567890',
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'Test contract content final',
  now()
) RETURNING id, booking_id, signer_name;

-- Vérifier que l'insertion a fonctionné
SELECT 
    id,
    booking_id,
    signer_name,
    signer_email,
    signed_at
FROM contract_signatures 
WHERE signer_name = 'Test Signer Final'
ORDER BY created_at DESC
LIMIT 1;
