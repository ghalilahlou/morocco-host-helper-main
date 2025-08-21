-- First check if we need to rename existing tables or if they're already correct
-- Update guest_verification_tokens to be property-based
ALTER TABLE public.guest_verification_tokens 
RENAME TO property_verification_tokens_temp;

-- Create new property verification tokens table
CREATE TABLE public.property_verification_tokens (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  property_id UUID NOT NULL UNIQUE,
  token TEXT NOT NULL UNIQUE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Drop the temp table since we want fresh data
DROP TABLE public.property_verification_tokens_temp CASCADE;

-- Update guest_submissions to remove the time constraint
-- (table structure is already correct, just need to update policies)

-- Enable RLS on property_verification_tokens 
ALTER TABLE public.property_verification_tokens ENABLE ROW LEVEL SECURITY;

-- RLS policies for property_verification_tokens
CREATE POLICY "Users can view tokens for their properties" 
ON public.property_verification_tokens 
FOR SELECT 
USING (property_id IN (
  SELECT id FROM public.properties WHERE user_id = auth.uid()
));

CREATE POLICY "Users can create tokens for their properties" 
ON public.property_verification_tokens 
FOR INSERT 
WITH CHECK (property_id IN (
  SELECT id FROM public.properties WHERE user_id = auth.uid()
));

CREATE POLICY "Users can update tokens for their properties" 
ON public.property_verification_tokens 
FOR UPDATE 
USING (property_id IN (
  SELECT id FROM public.properties WHERE user_id = auth.uid()
));

-- Update RLS policies for guest_submissions to use new table
DROP POLICY IF EXISTS "Users can view submissions for their bookings" ON public.guest_submissions;
DROP POLICY IF EXISTS "Anyone can create submissions with valid token" ON public.guest_submissions;
DROP POLICY IF EXISTS "Users can update submissions for their bookings" ON public.guest_submissions;

CREATE POLICY "Users can view submissions for their properties" 
ON public.guest_submissions 
FOR SELECT 
USING (token_id IN (
  SELECT id FROM public.property_verification_tokens 
  WHERE property_id IN (
    SELECT id FROM public.properties WHERE user_id = auth.uid()
  )
));

CREATE POLICY "Anyone can create submissions with valid token" 
ON public.guest_submissions 
FOR INSERT 
WITH CHECK (token_id IN (
  SELECT id FROM public.property_verification_tokens 
  WHERE is_active = true
));

CREATE POLICY "Users can update submissions for their properties" 
ON public.guest_submissions 
FOR UPDATE 
USING (token_id IN (
  SELECT id FROM public.property_verification_tokens 
  WHERE property_id IN (
    SELECT id FROM public.properties WHERE user_id = auth.uid()
  )
));

-- Add foreign key constraints
ALTER TABLE public.property_verification_tokens 
ADD CONSTRAINT fk_property_verification_tokens_property_id 
FOREIGN KEY (property_id) REFERENCES public.properties(id) ON DELETE CASCADE;

ALTER TABLE public.guest_submissions 
ADD CONSTRAINT fk_guest_submissions_token_id 
FOREIGN KEY (token_id) REFERENCES public.property_verification_tokens(id) ON DELETE CASCADE;

-- Add triggers for updated_at
CREATE TRIGGER update_property_verification_tokens_updated_at
BEFORE UPDATE ON public.property_verification_tokens
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Add indexes for performance
CREATE INDEX idx_property_verification_tokens_property_id ON public.property_verification_tokens(property_id);
CREATE INDEX idx_property_verification_tokens_token ON public.property_verification_tokens(token);
CREATE INDEX idx_guest_submissions_token_id ON public.guest_submissions(token_id);
CREATE INDEX idx_guest_submissions_status ON public.guest_submissions(status);