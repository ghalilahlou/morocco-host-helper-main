-- Migration pour créer la table documents et les policies RLS
-- Date: 2024-12-30
-- Description: Création de la table documents avec gestion des versions et policies RLS

-- 1. Créer la table documents
CREATE TABLE IF NOT EXISTS documents (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  type VARCHAR(20) NOT NULL CHECK (type IN ('contract', 'police', 'identity')),
  is_signed BOOLEAN NOT NULL DEFAULT false,
  version INTEGER NOT NULL DEFAULT 1,
  storage_path TEXT NOT NULL,
  public_url TEXT NOT NULL,
  sha256 VARCHAR(64),
  file_size BIGINT,
  mime_type VARCHAR(100),
  superseded_by UUID REFERENCES documents(id),
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'superseded', 'archived')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Créer les index pour les performances
CREATE INDEX IF NOT EXISTS idx_documents_booking_type ON documents(booking_id, type);
CREATE INDEX IF NOT EXISTS idx_documents_booking_signed ON documents(booking_id, is_signed);
CREATE INDEX IF NOT EXISTS idx_documents_booking_created ON documents(booking_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_documents_sha256 ON documents(sha256);

-- 3. Contrainte d'unicité par booking, type et is_signed
CREATE UNIQUE INDEX IF NOT EXISTS idx_documents_unique_active 
ON documents(booking_id, type, is_signed) 
WHERE status = 'active';

-- 4. Trigger pour mettre à jour updated_at
CREATE OR REPLACE FUNCTION update_documents_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_documents_updated_at
  BEFORE UPDATE ON documents
  FOR EACH ROW
  EXECUTE FUNCTION update_documents_updated_at();

-- 5. Trigger pour marquer les documents précédents comme superseded
CREATE OR REPLACE FUNCTION mark_previous_documents_superseded()
RETURNS TRIGGER AS $$
BEGIN
  -- Si c'est un contrat signé, marquer les contrats non signés comme superseded
  IF NEW.type = 'contract' AND NEW.is_signed = true THEN
    UPDATE documents 
    SET status = 'superseded', superseded_by = NEW.id
    WHERE booking_id = NEW.booking_id 
      AND type = 'contract' 
      AND is_signed = false 
      AND status = 'active'
      AND id != NEW.id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_mark_superseded
  AFTER INSERT ON documents
  FOR EACH ROW
  EXECUTE FUNCTION mark_previous_documents_superseded();

-- 6. RLS Policies pour les documents
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;

-- Policy pour les hôtes : peuvent voir les documents de leurs propriétés
CREATE POLICY host_select_documents ON documents
  FOR SELECT USING (
    EXISTS (
      SELECT 1
      FROM bookings b 
      JOIN properties p ON p.id = b.property_id
      WHERE b.id = documents.booking_id
        AND p.host_uid = auth.uid()
    )
  );

-- Policy pour les invités : peuvent voir les documents de leur réservation
CREATE POLICY guest_select_documents ON documents
  FOR SELECT USING (
    EXISTS (
      SELECT 1
      FROM bookings b
      WHERE b.id = documents.booking_id
        AND b.guest_email = auth.email()
    )
  );

-- Les écritures se font via Edge Functions (service role) ou RPC SECURITY DEFINER
-- Pas de policy d'écriture pour les utilisateurs normaux

-- 7. Créer la vue booking_documents_summary
CREATE OR REPLACE VIEW booking_documents_summary AS
SELECT
  b.id as booking_id,
  b.property_id,
  b.status as booking_status,
  b.check_in_date,
  b.check_out_date,
  b.number_of_guests,
  b.guest_name,
  b.guest_email,
  
  -- Contrat signé
  EXISTS (
    SELECT 1 FROM documents d
    WHERE d.booking_id = b.id 
      AND d.type = 'contract' 
      AND d.is_signed = true 
      AND d.status = 'active'
  ) as has_contract_signed,
  
  (
    SELECT d.public_url FROM documents d
    WHERE d.booking_id = b.id 
      AND d.type = 'contract'
      AND d.status = 'active'
    ORDER BY d.is_signed DESC, d.created_at DESC
    LIMIT 1
  ) as contract_url_latest,
  
  -- Police
  EXISTS (
    SELECT 1 FROM documents d
    WHERE d.booking_id = b.id 
      AND d.type = 'police' 
      AND d.status = 'active'
  ) as has_police,
  
  (
    SELECT d.public_url FROM documents d
    WHERE d.booking_id = b.id 
      AND d.type = 'police'
      AND d.status = 'active'
    ORDER BY d.created_at DESC
    LIMIT 1
  ) as police_url_latest,
  
  -- Identité
  EXISTS (
    SELECT 1 FROM documents d
    WHERE d.booking_id = b.id 
      AND d.type = 'identity' 
      AND d.status = 'active'
  ) as has_identity,
  
  (
    SELECT d.public_url FROM documents d
    WHERE d.booking_id = b.id 
      AND d.type = 'identity'
      AND d.status = 'active'
    ORDER BY d.created_at DESC
    LIMIT 1
  ) as identity_url_latest,
  
  -- Métadonnées
  (
    SELECT COUNT(*) FROM documents d
    WHERE d.booking_id = b.id 
      AND d.status = 'active'
  ) as total_documents,
  
  (
    SELECT MAX(d.created_at) FROM documents d
    WHERE d.booking_id = b.id 
      AND d.status = 'active'
  ) as last_document_created

FROM bookings b;

-- 8. RLS Policy pour la vue
CREATE POLICY host_select_booking_documents_summary ON booking_documents_summary
  FOR SELECT USING (
    EXISTS (
      SELECT 1
      FROM properties p
      WHERE p.id = booking_documents_summary.property_id
        AND p.host_uid = auth.uid()
    )
  );

-- 9. Fonction pour calculer SHA256
CREATE OR REPLACE FUNCTION compute_sha256(input BYTEA)
RETURNS TEXT AS $$
BEGIN
  RETURN encode(digest(input, 'sha256'), 'hex');
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- 10. Fonction pour upsert un document (utilisée par les Edge Functions)
CREATE OR REPLACE FUNCTION upsert_document(
  p_booking_id UUID,
  p_type VARCHAR(20),
  p_is_signed BOOLEAN,
  p_storage_path TEXT,
  p_public_url TEXT,
  p_sha256 TEXT DEFAULT NULL,
  p_file_size BIGINT DEFAULT NULL,
  p_mime_type VARCHAR(100) DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  document_id UUID;
BEGIN
  -- Upsert le document
  INSERT INTO documents (
    booking_id, type, is_signed, storage_path, public_url, 
    sha256, file_size, mime_type
  ) VALUES (
    p_booking_id, p_type, p_is_signed, p_storage_path, p_public_url,
    p_sha256, p_file_size, p_mime_type
  )
  ON CONFLICT (booking_id, type, is_signed) 
  WHERE status = 'active'
  DO UPDATE SET
    storage_path = EXCLUDED.storage_path,
    public_url = EXCLUDED.public_url,
    sha256 = EXCLUDED.sha256,
    file_size = EXCLUDED.file_size,
    mime_type = EXCLUDED.mime_type,
    updated_at = NOW()
  RETURNING id INTO document_id;
  
  RETURN document_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 11. Fonction RPC pour finaliser une réservation
CREATE OR REPLACE FUNCTION finalize_reservation(
  p_token UUID,
  p_payload JSONB
)
RETURNS JSONB AS $$
DECLARE
  booking_record RECORD;
  property_record RECORD;
  document_id UUID;
  result JSONB;
BEGIN
  -- Vérifier que le token existe et récupérer les infos de la propriété
  SELECT p.* INTO property_record
  FROM properties p
  JOIN property_verification_tokens pvt ON pvt.property_id = p.id
  WHERE pvt.token = p_token
    AND pvt.expires_at > NOW();
    
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Token invalide ou expiré'
    );
  END IF;
  
  -- Récupérer ou créer la réservation
  SELECT * INTO booking_record
  FROM bookings b
  WHERE b.property_id = property_record.id
    AND b.airbnb_code = (p_payload->>'airbnbCode')
    AND b.status IN ('pending', 'confirmed');
    
  IF NOT FOUND THEN
    -- Créer une nouvelle réservation
    INSERT INTO bookings (
      property_id, airbnb_code, guest_name, guest_email,
      check_in_date, check_out_date, number_of_guests, status
    ) VALUES (
      property_record.id,
      p_payload->>'airbnbCode',
      p_payload->>'guestName',
      p_payload->>'guestEmail',
      (p_payload->>'checkInDate')::DATE,
      (p_payload->>'checkOutDate')::DATE,
      (p_payload->>'numberOfGuests')::INTEGER,
      'confirmed'
    ) RETURNING * INTO booking_record;
  END IF;
  
  -- Mettre à jour le statut de la réservation
  UPDATE bookings 
  SET status = 'confirmed',
      updated_at = NOW()
  WHERE id = booking_record.id;
  
  -- Construire le résultat
  result := jsonb_build_object(
    'success', true,
    'booking_id', booking_record.id,
    'property_id', property_record.id,
    'status', 'confirmed'
  );
  
  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 12. Recharger le schéma PostgREST
NOTIFY pgrst, 'reload schema';

-- 13. Commentaires pour la documentation
COMMENT ON TABLE documents IS 'Table centralisée pour tous les documents (contrats, police, identité)';
COMMENT ON COLUMN documents.sha256 IS 'Hash SHA256 du fichier pour éviter les doublons';
COMMENT ON COLUMN documents.superseded_by IS 'ID du document qui a remplacé celui-ci';
COMMENT ON VIEW booking_documents_summary IS 'Vue agrégée pour le dashboard hôte avec état des documents';
COMMENT ON FUNCTION upsert_document IS 'Fonction pour upsert un document (utilisée par les Edge Functions)';
COMMENT ON FUNCTION finalize_reservation IS 'Fonction RPC pour finaliser une réservation via token';







