-- Re-enable RLS on property_verification_tokens
ALTER TABLE public.property_verification_tokens ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for property_verification_tokens

-- Allow property owners to create tokens for their own properties
CREATE POLICY "Property owners can create verification tokens" 
ON public.property_verification_tokens 
FOR INSERT 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.properties 
    WHERE id = property_id AND user_id = auth.uid()
  )
);

-- Allow property owners to view their own property tokens
CREATE POLICY "Property owners can view their tokens" 
ON public.property_verification_tokens 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.properties 
    WHERE id = property_id AND user_id = auth.uid()
  )
);

-- Allow property owners to update their own property tokens
CREATE POLICY "Property owners can update their tokens" 
ON public.property_verification_tokens 
FOR UPDATE 
USING (
  EXISTS (
    SELECT 1 FROM public.properties 
    WHERE id = property_id AND user_id = auth.uid()
  )
);

-- Allow property owners to delete their own property tokens
CREATE POLICY "Property owners can delete their tokens" 
ON public.property_verification_tokens 
FOR DELETE 
USING (
  EXISTS (
    SELECT 1 FROM public.properties 
    WHERE id = property_id AND user_id = auth.uid()
  )
);