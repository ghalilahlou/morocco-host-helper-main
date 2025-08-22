-- Script pour corriger la structure de contract_signatures
-- Ajouter les colonnes manquantes

-- 1. Ajouter la colonne signer_name si elle n'existe pas
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'contract_signatures' 
        AND column_name = 'signer_name'
    ) THEN
        ALTER TABLE contract_signatures ADD COLUMN signer_name TEXT;
    END IF;
END $$;

-- 2. Ajouter la colonne signer_email si elle n'existe pas
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'contract_signatures' 
        AND column_name = 'signer_email'
    ) THEN
        ALTER TABLE contract_signatures ADD COLUMN signer_email TEXT;
    END IF;
END $$;

-- 3. Ajouter la colonne signer_phone si elle n'existe pas
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'contract_signatures' 
        AND column_name = 'signer_phone'
    ) THEN
        ALTER TABLE contract_signatures ADD COLUMN signer_phone TEXT;
    END IF;
END $$;

-- 4. Ajouter la colonne signature_data si elle n'existe pas
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'contract_signatures' 
        AND column_name = 'signature_data'
    ) THEN
        ALTER TABLE contract_signatures ADD COLUMN signature_data TEXT;
    END IF;
END $$;

-- 5. Ajouter la colonne contract_content si elle n'existe pas
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'contract_signatures' 
        AND column_name = 'contract_content'
    ) THEN
        ALTER TABLE contract_signatures ADD COLUMN contract_content TEXT;
    END IF;
END $$;

-- 6. Ajouter la colonne signed_at si elle n'existe pas
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'contract_signatures' 
        AND column_name = 'signed_at'
    ) THEN
        ALTER TABLE contract_signatures ADD COLUMN signed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
    END IF;
END $$;

-- 7. Vérifier la structure finale
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'contract_signatures'
ORDER BY ordinal_position;

-- 8. Tester une insertion
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
