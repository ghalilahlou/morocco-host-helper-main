-- Fix delete_property_with_reservations to fully clean up ALL related data
-- so that properties can be deleted without foreign key violations.

CREATE OR REPLACE FUNCTION public.delete_property_with_reservations(
  p_property_id uuid,
  p_user_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  property_exists boolean;
BEGIN
  -- Vérifier que la propriété existe et appartient bien à l'utilisateur
  SELECT EXISTS(
    SELECT 1
    FROM public.properties 
    WHERE id = p_property_id
      AND user_id = p_user_id
  )
  INTO property_exists;

  IF NOT property_exists THEN
    RETURN false;
  END IF;

  -- Supprimer dans le bon ordre pour respecter les contraintes de clés étrangères

  -- 1) Signatures de contrat liées aux réservations de cette propriété
  DELETE FROM public.contract_signatures 
  WHERE booking_id IN (
    SELECT id FROM public.bookings WHERE property_id = p_property_id
  );

  -- 2) Soumissions invités liées aux réservations de cette propriété
  --    On couvre à la fois l'ancienne logique (booking_data JSON)
  --    et la nouvelle avec la colonne booking_id + FK.
  DELETE FROM public.guest_submissions 
  WHERE booking_id IN (
    SELECT id FROM public.bookings WHERE property_id = p_property_id
  )
  OR booking_data->>'property_id' = p_property_id::text;

  -- 3) Documents uploadés liés aux réservations de cette propriété
  DELETE FROM public.uploaded_documents 
  WHERE booking_id IN (
    SELECT id FROM public.bookings WHERE property_id = p_property_id
  );

  -- 4) Invités liés aux réservations de cette propriété
  DELETE FROM public.guests 
  WHERE booking_id IN (
    SELECT id FROM public.bookings WHERE property_id = p_property_id
  );

  -- 5) Réservations de cette propriété
  DELETE FROM public.bookings 
  WHERE property_id = p_property_id;

  -- 6) Réservations Airbnb liées à cette propriété
  DELETE FROM public.airbnb_reservations 
  WHERE property_id = p_property_id;

  -- 7) Enfin, la propriété elle-même
  DELETE FROM public.properties 
  WHERE id = p_property_id
    AND user_id = p_user_id;

  RETURN true;
END;
$$;

