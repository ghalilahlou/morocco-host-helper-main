-- Valide le statut contre les valeurs réelles de l'ENUM booking_status (évite les erreurs
-- quand l'enum évolue : archived, draft, etc.).

CREATE OR REPLACE FUNCTION public.admin_update_booking_status(
  p_booking_id UUID,
  p_status TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.admin_users au
    WHERE au.user_id = auth.uid()
    AND au.role IN ('admin', 'super_admin')
    AND (au.is_active IS NULL OR au.is_active = true)
  ) THEN
    RAISE EXCEPTION 'Accès non autorisé';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid AND t.typname = 'booking_status'
    WHERE e.enumlabel = p_status
  ) THEN
    RAISE EXCEPTION 'Statut invalide: %', p_status;
  END IF;

  UPDATE public.bookings
  SET status = p_status::booking_status,
      updated_at = NOW()
  WHERE id = p_booking_id;

  RETURN FOUND;
END;
$$;

COMMENT ON FUNCTION public.admin_update_booking_status(UUID, TEXT) IS 'Met à jour le statut d''une réservation (admin), statuts = ENUM booking_status';
