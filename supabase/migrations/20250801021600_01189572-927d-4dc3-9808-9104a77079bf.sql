-- Check if we need to update existing structure
-- Drop only guest_submissions first, then modify property_verification_tokens
DROP TABLE IF EXISTS public.guest_submissions CASCADE;

-- Modify existing property_verification_tokens if needed
-- Remove booking_id and expires_at columns if they exist
ALTER TABLE public.property_verification_tokens 
DROP COLUMN IF EXISTS booking_id,
DROP COLUMN IF EXISTS expires_at;

-- Add property_id if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'property_verification_tokens' 
                   AND column_name = 'property_id') THEN
        ALTER TABLE public.property_verification_tokens ADD COLUMN property_id UUID NOT NULL;
    END IF;
END $$;

-- Add unique constraint on property_id if it doesn't exist
ALTER TABLE public.property_verification_tokens 
DROP CONSTRAINT IF EXISTS property_verification_tokens_property_id_key;
ALTER TABLE public.property_verification_tokens 
ADD CONSTRAINT property_verification_tokens_property_id_key UNIQUE (property_id);

-- Recreate guest submissions table
CREATE TABLE public.guest_submissions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  token_id UUID NOT NULL,
  booking_data JSONB,
  guest_data JSONB,
  document_urls JSONB DEFAULT '[]'::jsonb,
  signature_data TEXT,
  submitted_at TIMESTAMP WITH TIME ZONE,
  status TEXT NOT NULL DEFAULT 'pending',
  reviewed_by UUID,
  reviewed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS 
ALTER TABLE public.guest_submissions ENABLE ROW LEVEL SECURITY;

-- Update RLS policies for property_verification_tokens
DROP POLICY IF EXISTS "Users can view tokens for their bookings" ON public.property_verification_tokens;
DROP POLICY IF EXISTS "Users can create tokens for their bookings" ON public.property_verification_tokens;
DROP POLICY IF EXISTS "Users can update tokens for their bookings" ON public.property_verification_tokens;

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
DROP CONSTRAINT IF EXISTS fk_guest_verification_tokens_booking_id;
ALTER TABLE public.property_verification_tokens 
ADD CONSTRAINT fk_property_verification_tokens_property_id 
FOREIGN KEY (property_id) REFERENCES public.properties(id) ON DELETE CASCADE;

ALTER TABLE public.guest_submissions 
ADD CONSTRAINT fk_guest_submissions_token_id 
FOREIGN KEY (token_id) REFERENCES public.property_verification_tokens(id) ON DELETE CASCADE;

-- Add trigger for guest_submissions updated_at
CREATE TRIGGER update_guest_submissions_updated_at
BEFORE UPDATE ON public.guest_submissions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_property_verification_tokens_property_id ON public.property_verification_tokens(property_id);
CREATE INDEX IF NOT EXISTS idx_guest_submissions_token_id ON public.guest_submissions(token_id);
CREATE INDEX IF NOT EXISTS idx_guest_submissions_status ON public.guest_submissions(status);