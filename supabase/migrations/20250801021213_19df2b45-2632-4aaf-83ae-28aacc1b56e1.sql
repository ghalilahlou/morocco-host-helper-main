-- Drop the existing tables since we need to restructure
DROP TABLE IF EXISTS public.guest_submissions CASCADE;
DROP TABLE IF EXISTS public.guest_verification_tokens CASCADE;

-- Create property verification tokens table (one per property, permanent)
CREATE TABLE public.property_verification_tokens (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  property_id UUID NOT NULL UNIQUE,
  token TEXT NOT NULL UNIQUE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create guest submissions table (now linked to property tokens)
CREATE TABLE public.guest_submissions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  property_token_id UUID NOT NULL,
  booking_data JSONB,
  guest_data JSONB,
  document_urls JSONB DEFAULT '[]'::jsonb,
  signature_data TEXT,
  submitted_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  status TEXT NOT NULL DEFAULT 'pending',
  reviewed_by UUID,
  reviewed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on both tables
ALTER TABLE public.property_verification_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.guest_submissions ENABLE ROW LEVEL SECURITY;

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

-- RLS policies for guest_submissions  
CREATE POLICY "Users can view submissions for their properties" 
ON public.guest_submissions 
FOR SELECT 
USING (property_token_id IN (
  SELECT id FROM public.property_verification_tokens 
  WHERE property_id IN (
    SELECT id FROM public.properties WHERE user_id = auth.uid()
  )
));

CREATE POLICY "Anyone can create submissions with valid token" 
ON public.guest_submissions 
FOR INSERT 
WITH CHECK (property_token_id IN (
  SELECT id FROM public.property_verification_tokens 
  WHERE is_active = true
));

CREATE POLICY "Users can update submissions for their properties" 
ON public.guest_submissions 
FOR UPDATE 
USING (property_token_id IN (
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
ADD CONSTRAINT fk_guest_submissions_property_token_id 
FOREIGN KEY (property_token_id) REFERENCES public.property_verification_tokens(id) ON DELETE CASCADE;

-- Add triggers for updated_at
CREATE TRIGGER update_property_verification_tokens_updated_at
BEFORE UPDATE ON public.property_verification_tokens
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_guest_submissions_updated_at
BEFORE UPDATE ON public.guest_submissions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Add indexes for performance
CREATE INDEX idx_property_verification_tokens_property_id ON public.property_verification_tokens(property_id);
CREATE INDEX idx_property_verification_tokens_token ON public.property_verification_tokens(token);
CREATE INDEX idx_guest_submissions_property_token_id ON public.guest_submissions(property_token_id);
CREATE INDEX idx_guest_submissions_status ON public.guest_submissions(status);