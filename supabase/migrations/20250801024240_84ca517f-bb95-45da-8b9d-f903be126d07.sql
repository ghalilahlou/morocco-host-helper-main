-- Add policy to allow creating bookings via guest verification tokens
CREATE POLICY "Allow creating bookings via guest verification tokens" 
ON public.bookings 
FOR INSERT 
WITH CHECK (
  property_id IN (
    SELECT property_verification_tokens.property_id
    FROM property_verification_tokens
    WHERE property_verification_tokens.is_active = true
  )
);