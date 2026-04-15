-- Suppression propriété côté admin : le client ne peut pas DELETE directement sur `properties`
-- si des réservations existent (FK bookings → properties sans CASCADE). Cette RPC nettoie
-- les enregistrements dépendants dans le bon ordre, comme delete_property_with_reservations,
-- mais sans vérifier que l’hôte = auth.uid() (réservé aux comptes admin_users).

CREATE OR REPLACE FUNCTION public.admin_delete_property(p_property_id UUID)
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

  IF NOT EXISTS (SELECT 1 FROM public.properties WHERE id = p_property_id) THEN
    RETURN false;
  END IF;

  -- Documents générés référencent des signatures : avant les signatures / réservations
  IF to_regclass('public.generated_documents') IS NOT NULL THEN
    DELETE FROM public.generated_documents
    WHERE booking_id IN (SELECT id FROM public.bookings WHERE property_id = p_property_id);
  END IF;

  DELETE FROM public.contract_signatures
  WHERE booking_id IN (SELECT id FROM public.bookings WHERE property_id = p_property_id);

  DELETE FROM public.guest_submissions
  WHERE booking_id IN (SELECT id FROM public.bookings WHERE property_id = p_property_id)
     OR booking_data->>'property_id' = p_property_id::text;

  IF to_regclass('public.document_storage') IS NOT NULL THEN
    DELETE FROM public.document_storage
    WHERE booking_id IN (SELECT id FROM public.bookings WHERE property_id = p_property_id);
  END IF;

  DELETE FROM public.uploaded_documents
  WHERE booking_id IN (SELECT id FROM public.bookings WHERE property_id = p_property_id);

  DELETE FROM public.guests
  WHERE booking_id IN (SELECT id FROM public.bookings WHERE property_id = p_property_id);

  DELETE FROM public.bookings
  WHERE property_id = p_property_id;

  DELETE FROM public.airbnb_reservations
  WHERE property_id = p_property_id;

  IF to_regclass('public.airbnb_sync_status') IS NOT NULL THEN
    DELETE FROM public.airbnb_sync_status WHERE property_id = p_property_id;
  END IF;

  DELETE FROM public.properties
  WHERE id = p_property_id;

  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_delete_property(UUID) TO authenticated;

COMMENT ON FUNCTION public.admin_delete_property(UUID) IS 'Supprime une propriété et les données liées (admin) : contourne le blocage FK bookings→properties.';
