-- Add a policy to allow reading property basic info for verification
CREATE POLICY "Allow reading property info for verification" 
ON public.properties 
FOR SELECT 
USING (true);