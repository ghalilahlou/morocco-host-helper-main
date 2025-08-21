-- Create guest verification tokens table
CREATE TABLE public.guest_verification_tokens (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  booking_id UUID NOT NULL,
  token TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create guest submissions table
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

-- Enable RLS on both tables
ALTER TABLE public.guest_verification_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.guest_submissions ENABLE ROW LEVEL SECURITY;

-- RLS policies for guest_verification_tokens
CREATE POLICY "Users can view tokens for their bookings" 
ON public.guest_verification_tokens 
FOR SELECT 
USING (booking_id IN (
  SELECT id FROM public.bookings WHERE user_id = auth.uid()
));

CREATE POLICY "Users can create tokens for their bookings" 
ON public.guest_verification_tokens 
FOR INSERT 
WITH CHECK (booking_id IN (
  SELECT id FROM public.bookings WHERE user_id = auth.uid()
));

CREATE POLICY "Users can update tokens for their bookings" 
ON public.guest_verification_tokens 
FOR UPDATE 
USING (booking_id IN (
  SELECT id FROM public.bookings WHERE user_id = auth.uid()
));

-- RLS policies for guest_submissions  
CREATE POLICY "Users can view submissions for their bookings" 
ON public.guest_submissions 
FOR SELECT 
USING (token_id IN (
  SELECT id FROM public.guest_verification_tokens 
  WHERE booking_id IN (
    SELECT id FROM public.bookings WHERE user_id = auth.uid()
  )
));

CREATE POLICY "Anyone can create submissions with valid token" 
ON public.guest_submissions 
FOR INSERT 
WITH CHECK (token_id IN (
  SELECT id FROM public.guest_verification_tokens 
  WHERE is_active = true AND expires_at > now()
));

CREATE POLICY "Users can update submissions for their bookings" 
ON public.guest_submissions 
FOR UPDATE 
USING (token_id IN (
  SELECT id FROM public.guest_verification_tokens 
  WHERE booking_id IN (
    SELECT id FROM public.bookings WHERE user_id = auth.uid()
  )
));

-- Add foreign key constraints
ALTER TABLE public.guest_verification_tokens 
ADD CONSTRAINT fk_guest_verification_tokens_booking_id 
FOREIGN KEY (booking_id) REFERENCES public.bookings(id) ON DELETE CASCADE;

ALTER TABLE public.guest_submissions 
ADD CONSTRAINT fk_guest_submissions_token_id 
FOREIGN KEY (token_id) REFERENCES public.guest_verification_tokens(id) ON DELETE CASCADE;

-- Add triggers for updated_at
CREATE TRIGGER update_guest_verification_tokens_updated_at
BEFORE UPDATE ON public.guest_verification_tokens
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_guest_submissions_updated_at
BEFORE UPDATE ON public.guest_submissions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Add indexes for performance
CREATE INDEX idx_guest_verification_tokens_booking_id ON public.guest_verification_tokens(booking_id);
CREATE INDEX idx_guest_verification_tokens_token ON public.guest_verification_tokens(token);
CREATE INDEX idx_guest_verification_tokens_expires_at ON public.guest_verification_tokens(expires_at);
CREATE INDEX idx_guest_submissions_token_id ON public.guest_submissions(token_id);
CREATE INDEX idx_guest_submissions_status ON public.guest_submissions(status);