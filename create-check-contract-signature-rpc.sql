-- Créer la fonction RPC check_contract_signature
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
  -- Vérifier si une signature existe pour cette soumission
  RETURN QUERY
  SELECT 
    cs.signature_data,
    cs.signer_name,
    cs.signed_at,
    cs.booking_id
  FROM contract_signatures cs
  WHERE cs.booking_id = (
    SELECT gs.booking_id 
    FROM guest_submissions gs 
    WHERE gs.id = p_submission_id
  )
  ORDER BY cs.created_at DESC
  LIMIT 1;
END;
$$;

-- Donner les permissions nécessaires
GRANT EXECUTE ON FUNCTION check_contract_signature(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION check_contract_signature(UUID) TO anon;

-- Commentaire pour la documentation
COMMENT ON FUNCTION check_contract_signature(UUID) IS 'Vérifie si un contrat est signé pour une soumission d''invité donnée';
