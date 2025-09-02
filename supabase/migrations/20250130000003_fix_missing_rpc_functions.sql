-- ✅ CORRECTION: Recréer les fonctions RPC manquantes qui causent les erreurs dans la console

-- 1. Fonction pour récupérer les contrats signés d'un utilisateur
CREATE OR REPLACE FUNCTION public.get_signed_contracts_for_user(p_user_id UUID)
RETURNS TABLE (
  id UUID,
  booking_id UUID,
  signature_data TEXT,
  signer_name TEXT,
  signed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ,
  guest_submission JSONB,
  booking_reference TEXT,
  property_name TEXT
) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    cs.id,
    cs.booking_id,
    cs.signature_data,
    cs.signer_name,
    cs.signed_at,
    cs.created_at,
    COALESCE(gs.guest_data, '{}'::jsonb) as guest_submission,
    COALESCE(b.booking_reference, '') as booking_reference,
    COALESCE(p.name, '') as property_name
  FROM public.contract_signatures cs
  LEFT JOIN public.bookings b ON b.id = cs.booking_id
  LEFT JOIN public.properties p ON p.id = b.property_id
  LEFT JOIN public.guest_submissions gs ON gs.id = cs.submission_id
  WHERE b.user_id = p_user_id
  ORDER BY cs.created_at DESC;
END;
$$;

-- 2. Fonction pour vérifier si un contrat est signé pour une soumission
CREATE OR REPLACE FUNCTION public.check_contract_signature(p_submission_id UUID)
RETURNS TABLE (
  id UUID,
  booking_id UUID,
  signature_data TEXT,
  signer_name TEXT,
  signed_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    cs.id,
    cs.booking_id,
    cs.signature_data,
    cs.signer_name,
    cs.signed_at
  FROM public.contract_signatures cs
  WHERE cs.submission_id = p_submission_id
  LIMIT 1;
END;
$$;

-- 3. Fonction pour récupérer le nombre d'invités d'une réservation
CREATE OR REPLACE FUNCTION public.get_booking_guest_count(p_booking_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  guest_count INTEGER := 0;
BEGIN
  SELECT COUNT(*) INTO guest_count
  FROM public.guests
  WHERE booking_id = p_booking_id;
  
  -- Si aucun invité dans la table guests, prendre le nombre de la réservation
  IF guest_count = 0 THEN
    SELECT COALESCE(number_of_guests, 1) INTO guest_count
    FROM public.bookings
    WHERE id = p_booking_id;
  END IF;
  
  RETURN COALESCE(guest_count, 1);
END;
$$;

-- 4. Fonction pour vérifier un token de propriété
CREATE OR REPLACE FUNCTION public.verify_property_token(p_property_id UUID, p_token TEXT)
RETURNS TABLE (
  id UUID,
  property_id UUID,
  token TEXT,
  expires_at TIMESTAMPTZ,
  is_valid BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    vt.id,
    vt.property_id,
    vt.token,
    vt.expires_at,
    (vt.expires_at > NOW() OR vt.expires_at IS NULL) as is_valid
  FROM public.verification_tokens vt
  WHERE vt.property_id = p_property_id 
    AND vt.token = p_token
  LIMIT 1;
END;
$$;

-- 5. Fonction pour obtenir une propriété pour vérification
CREATE OR REPLACE FUNCTION public.get_property_for_verification(p_property_id UUID)
RETURNS TABLE (
  id UUID,
  name TEXT,
  address TEXT,
  contact_info JSONB,
  user_id UUID
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id,
    p.name,
    p.address,
    p.contact_info,
    p.user_id
  FROM public.properties p
  WHERE p.id = p_property_id;
END;
$$;

-- Accorder les permissions appropriées
GRANT EXECUTE ON FUNCTION public.get_signed_contracts_for_user(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_contract_signature(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_booking_guest_count(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.verify_property_token(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_property_for_verification(UUID) TO authenticated;

-- Autoriser aussi pour les utilisateurs anonymes (pour la vérification des invités)
GRANT EXECUTE ON FUNCTION public.check_contract_signature(UUID) TO anon;
GRANT EXECUTE ON FUNCTION public.verify_property_token(UUID, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.get_property_for_verification(UUID) TO anon;

-- Commentaires pour documentation
COMMENT ON FUNCTION public.get_signed_contracts_for_user(UUID) IS 
'Récupère tous les contrats signés pour un utilisateur donné avec les informations associées';

COMMENT ON FUNCTION public.check_contract_signature(UUID) IS 
'Vérifie si un contrat est signé pour une soumission donnée';

COMMENT ON FUNCTION public.get_booking_guest_count(UUID) IS 
'Retourne le nombre d''invités pour une réservation';

COMMENT ON FUNCTION public.verify_property_token(UUID, TEXT) IS 
'Vérifie la validité d''un token pour une propriété';

COMMENT ON FUNCTION public.get_property_for_verification(UUID) IS 
'Récupère les informations d''une propriété pour vérification';
