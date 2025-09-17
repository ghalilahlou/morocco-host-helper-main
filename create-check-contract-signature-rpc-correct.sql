-- Fonction RPC check_contract_signature basée sur votre schéma
CREATE OR REPLACE FUNCTION check_contract_signature(p_submission_id UUID)
RETURNS TABLE(
  signature_data TEXT,
  signer_name TEXT,
  signed_at TIMESTAMP WITH TIME ZONE,
  booking_id UUID
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Récupérer la signature basée sur le booking_id de la soumission
  RETURN QUERY
  SELECT 
    cs.signature_data,
    cs.signer_name,
    cs.signed_at,
    cs.booking_id
  FROM contract_signatures cs
  INNER JOIN guest_submissions gs ON cs.booking_id = gs.booking_id
  WHERE gs.id = p_submission_id
  ORDER BY cs.created_at DESC
  LIMIT 1;
END;
$$;

-- Permissions
GRANT EXECUTE ON FUNCTION check_contract_signature(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION check_contract_signature(UUID) TO anon;

-- Commentaire
COMMENT ON FUNCTION check_contract_signature(UUID) IS 'Vérifie si un contrat est signé pour une soumission d''invité';
