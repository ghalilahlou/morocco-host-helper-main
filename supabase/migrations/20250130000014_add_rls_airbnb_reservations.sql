-- Enable RLS on airbnb_reservations table
ALTER TABLE public.airbnb_reservations ENABLE ROW LEVEL SECURITY;

-- Create RLS policy for reading airbnb_reservations
-- Allow authenticated users to read reservations for properties they own
CREATE POLICY "read_res_by_property_members" ON public.airbnb_reservations
FOR SELECT
TO authenticated
USING (
  -- Check if user owns the property (using user_id column)
  EXISTS (
    SELECT 1 FROM public.properties 
    WHERE properties.id = airbnb_reservations.property_id 
    AND properties.user_id = auth.uid()
  )
);

-- Add index for better performance on RLS policy queries
CREATE INDEX IF NOT EXISTS idx_airbnb_reservations_property_id 
ON public.airbnb_reservations (property_id);

-- Add index on properties.user_id if it doesn't exist
CREATE INDEX IF NOT EXISTS idx_properties_user_id 
ON public.properties (user_id);
