-- Correction des tables manquantes identifiées par le diagnostic
-- Exécuter dans Supabase SQL Editor

-- 1. Créer la table verification_tokens
CREATE TABLE IF NOT EXISTS verification_tokens (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  token VARCHAR(255) UNIQUE NOT NULL,
  property_id UUID REFERENCES properties(id) ON DELETE CASCADE,
  booking_id UUID REFERENCES bookings(id) ON DELETE CASCADE,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  used_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index pour les performances
CREATE INDEX IF NOT EXISTS idx_verification_tokens_token ON verification_tokens(token);
CREATE INDEX IF NOT EXISTS idx_verification_tokens_property_id ON verification_tokens(property_id);
CREATE INDEX IF NOT EXISTS idx_verification_tokens_booking_id ON verification_tokens(booking_id);
CREATE INDEX IF NOT EXISTS idx_verification_tokens_expires_at ON verification_tokens(expires_at);

-- 2. Créer la table guest_documents
CREATE TABLE IF NOT EXISTS guest_documents (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  booking_id UUID REFERENCES bookings(id) ON DELETE CASCADE,
  document_url TEXT NOT NULL,
  document_type VARCHAR(50) NOT NULL DEFAULT 'identity',
  document_name VARCHAR(255),
  file_size INTEGER,
  mime_type VARCHAR(100),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index pour les performances
CREATE INDEX IF NOT EXISTS idx_guest_documents_booking_id ON guest_documents(booking_id);
CREATE INDEX IF NOT EXISTS idx_guest_documents_type ON guest_documents(document_type);

-- 3. Ajouter des contraintes de validation
ALTER TABLE verification_tokens 
ADD CONSTRAINT check_token_not_empty CHECK (length(trim(token)) > 0);

ALTER TABLE guest_documents 
ADD CONSTRAINT check_document_url_not_empty CHECK (length(trim(document_url)) > 0);

-- 4. Créer des triggers pour updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Appliquer le trigger aux nouvelles tables
DROP TRIGGER IF EXISTS update_verification_tokens_updated_at ON verification_tokens;
CREATE TRIGGER update_verification_tokens_updated_at 
    BEFORE UPDATE ON verification_tokens 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_guest_documents_updated_at ON guest_documents;
CREATE TRIGGER update_guest_documents_updated_at 
    BEFORE UPDATE ON guest_documents 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 5. Insérer des données de test si nécessaire
-- (Optionnel - décommentez si vous voulez des données de test)
/*
INSERT INTO verification_tokens (token, property_id, expires_at) 
SELECT 
  'test-token-' || id,
  id,
  NOW() + INTERVAL '7 days'
FROM properties 
WHERE id NOT IN (SELECT property_id FROM verification_tokens WHERE property_id IS NOT NULL)
LIMIT 5;
*/

-- 6. Vérification finale
SELECT 
  'verification_tokens' as table_name,
  COUNT(*) as record_count
FROM verification_tokens
UNION ALL
SELECT 
  'guest_documents' as table_name,
  COUNT(*) as record_count
FROM guest_documents;
