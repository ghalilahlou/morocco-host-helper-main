-- issue-guest-link appelle check_reservation_allowed / increment_reservation_count avec la clé service_role.
-- Si la migration 20250130000009 n’a jamais été appliquée, ou si seuls les GRANT authenticated existent,
-- les logs affichent : "check_reservation_allowed RPC not found – proceeding with allowed=true (fallback)".

-- Table requise par les deux fonctions (no-op si déjà créée par 20250130000008 / 00009)
CREATE TABLE IF NOT EXISTS public.token_control_settings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  is_enabled BOOLEAN DEFAULT true,
  control_type TEXT DEFAULT 'unlimited' CHECK (control_type IN ('blocked', 'limited', 'unlimited')),
  max_reservations INTEGER NULL,
  current_reservations INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id)
);

CREATE INDEX IF NOT EXISTS idx_token_control_settings_property_id
ON public.token_control_settings(property_id);

CREATE OR REPLACE FUNCTION public.check_reservation_allowed(property_uuid UUID)
RETURNS TABLE (
  allowed BOOLEAN,
  reason TEXT,
  control_type TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  settings_record token_control_settings%ROWTYPE;
BEGIN
  SELECT * INTO settings_record
  FROM token_control_settings
  WHERE property_id = property_uuid
    AND is_enabled = true;

  IF NOT FOUND THEN
    RETURN QUERY SELECT true, 'No restrictions configured', 'unlimited';
    RETURN;
  END IF;

  CASE settings_record.control_type
    WHEN 'blocked' THEN
      RETURN QUERY SELECT false, 'Reservations blocked for this property', 'blocked';
    WHEN 'limited' THEN
      IF settings_record.max_reservations IS NULL
         OR settings_record.current_reservations < settings_record.max_reservations THEN
        RETURN QUERY SELECT true, 'Reservations allowed within limit', 'limited';
      ELSE
        RETURN QUERY SELECT false, 'Maximum reservations reached', 'limited';
      END IF;
    WHEN 'unlimited' THEN
      RETURN QUERY SELECT true, 'Unlimited reservations allowed', 'unlimited';
    ELSE
      RETURN QUERY SELECT true, 'Unknown control type, defaulting to allowed', 'unlimited';
  END CASE;
END;
$$;

CREATE OR REPLACE FUNCTION public.increment_reservation_count(property_uuid UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  settings_record token_control_settings%ROWTYPE;
BEGIN
  SELECT * INTO settings_record
  FROM token_control_settings
  WHERE property_id = property_uuid
    AND is_enabled = true;

  IF NOT FOUND THEN
    RETURN true;
  END IF;

  IF settings_record.control_type = 'limited' THEN
    UPDATE token_control_settings
    SET current_reservations = current_reservations + 1,
        updated_at = NOW()
    WHERE property_id = property_uuid
      AND is_enabled = true;
  END IF;

  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION public.check_reservation_allowed(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_reservation_allowed(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.increment_reservation_count(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.increment_reservation_count(UUID) TO service_role;

COMMENT ON FUNCTION public.check_reservation_allowed(UUID) IS
  'Vérifie si la génération de liens / réservations est autorisée pour une propriété (contrôle admin).';
