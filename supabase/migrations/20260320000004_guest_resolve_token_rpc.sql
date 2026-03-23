-- Migration: RPC pour permettre aux invités anonymes de résoudre un token (liens /v/:token)
-- Les invités n'ont pas accès direct à property_verification_tokens (RLS), d'où cette fonction.

DROP FUNCTION IF EXISTS public.resolve_guest_token(TEXT);

CREATE OR REPLACE FUNCTION public.resolve_guest_token(p_token TEXT)
RETURNS TABLE (
  property_id UUID,
  is_active BOOLEAN,
  expires_at TIMESTAMPTZ,
  metadata JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    pvt.property_id,
    pvt.is_active,
    pvt.expires_at,
    pvt.metadata
  FROM public.property_verification_tokens pvt
  WHERE pvt.token = p_token
  LIMIT 1;
END;
$$;

GRANT EXECUTE ON FUNCTION public.resolve_guest_token(TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.resolve_guest_token(TEXT) TO authenticated;

COMMENT ON FUNCTION public.resolve_guest_token(TEXT) IS
'Résout un token invité pour obtenir property_id, is_active, expires_at, metadata. Utilisé par la page /v/:token.';

-- RPC pour récupérer les dates d'une réservation par code (invités anonymes, après résolution du token)
DROP FUNCTION IF EXISTS public.get_booking_dates_for_guest(UUID, TEXT);

CREATE OR REPLACE FUNCTION public.get_booking_dates_for_guest(p_property_id UUID, p_booking_reference TEXT)
RETURNS TABLE (
  check_in_date DATE,
  check_out_date DATE,
  number_of_guests INT,
  guest_name TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    b.check_in_date::DATE,
    b.check_out_date::DATE,
    b.number_of_guests,
    b.guest_name
  FROM public.bookings b
  WHERE b.property_id = p_property_id
    AND b.booking_reference = p_booking_reference
  ORDER BY b.updated_at DESC
  LIMIT 1;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_booking_dates_for_guest(UUID, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.get_booking_dates_for_guest(UUID, TEXT) TO authenticated;

COMMENT ON FUNCTION public.get_booking_dates_for_guest(UUID, TEXT) IS
'Récupère les dates et infos d''une réservation par code. Utilisé par /v/:token/:code pour pré-remplir les dates.';
