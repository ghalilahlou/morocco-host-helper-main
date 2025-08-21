-- Create a function to delete a property and all its associated data
CREATE OR REPLACE FUNCTION public.delete_property_with_reservations(p_property_id uuid, p_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  property_exists boolean;
BEGIN
  -- Check if the property exists and belongs to the user
  SELECT EXISTS(
    SELECT 1 FROM public.properties 
    WHERE id = p_property_id AND user_id = p_user_id
  ) INTO property_exists;
  
  IF NOT property_exists THEN
    RETURN false;
  END IF;
  
  -- Delete in the correct order to respect foreign key constraints
  
  -- Delete contract signatures for bookings of this property
  DELETE FROM public.contract_signatures 
  WHERE booking_id IN (
    SELECT id FROM public.bookings WHERE property_id = p_property_id
  );
  
  -- Delete guest submissions for bookings of this property
  DELETE FROM public.guest_submissions 
  WHERE booking_data->>'property_id' = p_property_id::text;
  
  -- Delete guests for bookings of this property
  DELETE FROM public.guests 
  WHERE booking_id IN (
    SELECT id FROM public.bookings WHERE property_id = p_property_id
  );
  
  -- Delete bookings for this property
  DELETE FROM public.bookings 
  WHERE property_id = p_property_id;
  
  -- Finally delete the property
  DELETE FROM public.properties 
  WHERE id = p_property_id AND user_id = p_user_id;
  
  RETURN true;
END;
$$;