-- Add a policy to allow unauthenticated users to read tokens for verification
CREATE POLICY "Allow unauthenticated token verification" 
ON public.property_verification_tokens 
FOR SELECT 
USING (is_active = true);