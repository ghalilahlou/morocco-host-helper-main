-- Script pour vérifier et corriger la table contract_signatures
-- Ce script évite les erreurs de doublons

-- 1. Vérifier si la table existe et sa structure
SELECT 
    table_name,
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'contract_signatures'
ORDER BY ordinal_position;

-- 2. Vérifier les politiques RLS existantes
SELECT 
    policyname,
    cmd,
    qual,
    with_check
FROM pg_policies 
WHERE tablename = 'contract_signatures';

-- 3. Vérifier si RLS est activé
SELECT 
    schemaname,
    tablename,
    rowsecurity
FROM pg_tables 
WHERE tablename = 'contract_signatures';

-- 4. Tester une insertion simple pour vérifier que tout fonctionne
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

-- 5. Vérifier que l'insertion a fonctionné
SELECT 
    id,
    booking_id,
    signer_name,
    signer_email,
    signed_at
FROM contract_signatures 
WHERE signer_name = 'Test Signer'
ORDER BY created_at DESC
LIMIT 1;
