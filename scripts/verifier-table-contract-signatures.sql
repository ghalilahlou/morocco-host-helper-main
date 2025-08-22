-- Vérifier si la table contract_signatures existe
SELECT 
    table_name,
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'contract_signatures'
ORDER BY ordinal_position;

-- Vérifier les contraintes de la table
SELECT 
    constraint_name,
    constraint_type,
    table_name
FROM information_schema.table_constraints 
WHERE table_name = 'contract_signatures';

-- Vérifier les politiques RLS
SELECT 
    policyname,
    cmd,
    qual,
    with_check
FROM pg_policies 
WHERE tablename = 'contract_signatures';

-- Tester une insertion simple (après avoir créé la table)
INSERT INTO contract_signatures (
  booking_id,
  signer_name,
  signer_email,
  signer_phone,
  signature_data,
  contract_content,
  signed_at
) VALUES (
  'test-booking-' || gen_random_uuid(),
  'Test Signer',
  'test@example.com',
  '+1234567890',
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'Test contract content',
  now()
) RETURNING id, booking_id, signer_name;
