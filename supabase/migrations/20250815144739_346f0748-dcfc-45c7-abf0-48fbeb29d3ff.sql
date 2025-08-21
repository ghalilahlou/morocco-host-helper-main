-- Add missing UPDATE and DELETE policies for guest_submissions table

CREATE POLICY "Users can update submissions for their properties" 
ON public.guest_submissions 
FOR UPDATE 
USING (EXISTS (
  SELECT 1 FROM public.property_verification_tokens pvt
  JOIN public.properties p ON p.id = pvt.property_id
  WHERE pvt.id = token_id 
  AND p.user_id = auth.uid()
));

CREATE POLICY "Users can delete submissions for their properties" 
ON public.guest_submissions 
FOR DELETE 
USING (EXISTS (
  SELECT 1 FROM public.property_verification_tokens pvt
  JOIN public.properties p ON p.id = pvt.property_id
  WHERE pvt.id = token_id 
  AND p.user_id = auth.uid()
));