-- Enable RLS and add policies for critical tables with sensitive data

-- Enable RLS on bookings table
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;

-- Bookings policies - users can only access their own bookings
CREATE POLICY "Users can view their own bookings" 
ON public.bookings 
FOR SELECT 
USING (auth.uid() = user_id OR auth.uid() IN (
  SELECT user_id FROM public.properties WHERE id = property_id
));

CREATE POLICY "Users can create bookings for their properties" 
ON public.bookings 
FOR INSERT 
WITH CHECK (auth.uid() IN (
  SELECT user_id FROM public.properties WHERE id = property_id
));

CREATE POLICY "Users can update their own bookings" 
ON public.bookings 
FOR UPDATE 
USING (auth.uid() = user_id OR auth.uid() IN (
  SELECT user_id FROM public.properties WHERE id = property_id
));

CREATE POLICY "Users can delete their own bookings" 
ON public.bookings 
FOR DELETE 
USING (auth.uid() = user_id OR auth.uid() IN (
  SELECT user_id FROM public.properties WHERE id = property_id
));

-- Enable RLS on guests table
ALTER TABLE public.guests ENABLE ROW LEVEL SECURITY;

-- Guests policies - only accessible through bookings owned by user
CREATE POLICY "Users can view guests for their bookings" 
ON public.guests 
FOR SELECT 
USING (EXISTS (
  SELECT 1 FROM public.bookings 
  WHERE id = booking_id 
  AND (user_id = auth.uid() OR property_id IN (
    SELECT id FROM public.properties WHERE user_id = auth.uid()
  ))
));

CREATE POLICY "Users can create guests for their bookings" 
ON public.guests 
FOR INSERT 
WITH CHECK (EXISTS (
  SELECT 1 FROM public.bookings 
  WHERE id = booking_id 
  AND (user_id = auth.uid() OR property_id IN (
    SELECT id FROM public.properties WHERE user_id = auth.uid()
  ))
));

CREATE POLICY "Users can update guests for their bookings" 
ON public.guests 
FOR UPDATE 
USING (EXISTS (
  SELECT 1 FROM public.bookings 
  WHERE id = booking_id 
  AND (user_id = auth.uid() OR property_id IN (
    SELECT id FROM public.properties WHERE user_id = auth.uid()
  ))
));

CREATE POLICY "Users can delete guests for their bookings" 
ON public.guests 
FOR DELETE 
USING (EXISTS (
  SELECT 1 FROM public.bookings 
  WHERE id = booking_id 
  AND (user_id = auth.uid() OR property_id IN (
    SELECT id FROM public.properties WHERE user_id = auth.uid()
  ))
));

-- Enable RLS on properties table
ALTER TABLE public.properties ENABLE ROW LEVEL SECURITY;

-- Properties policies - users can only access their own properties
CREATE POLICY "Users can view their own properties" 
ON public.properties 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own properties" 
ON public.properties 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own properties" 
ON public.properties 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own properties" 
ON public.properties 
FOR DELETE 
USING (auth.uid() = user_id);

-- Enable RLS on uploaded_documents table
ALTER TABLE public.uploaded_documents ENABLE ROW LEVEL SECURITY;

-- Uploaded documents policies - only accessible through bookings owned by user
CREATE POLICY "Users can view documents for their bookings" 
ON public.uploaded_documents 
FOR SELECT 
USING (EXISTS (
  SELECT 1 FROM public.bookings 
  WHERE id = booking_id 
  AND (user_id = auth.uid() OR property_id IN (
    SELECT id FROM public.properties WHERE user_id = auth.uid()
  ))
));

CREATE POLICY "Users can create documents for their bookings" 
ON public.uploaded_documents 
FOR INSERT 
WITH CHECK (EXISTS (
  SELECT 1 FROM public.bookings 
  WHERE id = booking_id 
  AND (user_id = auth.uid() OR property_id IN (
    SELECT id FROM public.properties WHERE user_id = auth.uid()
  ))
));

CREATE POLICY "Users can update documents for their bookings" 
ON public.uploaded_documents 
FOR UPDATE 
USING (EXISTS (
  SELECT 1 FROM public.bookings 
  WHERE id = booking_id 
  AND (user_id = auth.uid() OR property_id IN (
    SELECT id FROM public.properties WHERE user_id = auth.uid()
  ))
));

CREATE POLICY "Users can delete documents for their bookings" 
ON public.uploaded_documents 
FOR DELETE 
USING (EXISTS (
  SELECT 1 FROM public.bookings 
  WHERE id = booking_id 
  AND (user_id = auth.uid() OR property_id IN (
    SELECT id FROM public.properties WHERE user_id = auth.uid()
  ))
));

-- Enable RLS on contract_signatures table
ALTER TABLE public.contract_signatures ENABLE ROW LEVEL SECURITY;

-- Contract signatures policies - only accessible through bookings owned by user
CREATE POLICY "Users can view signatures for their bookings" 
ON public.contract_signatures 
FOR SELECT 
USING (EXISTS (
  SELECT 1 FROM public.bookings 
  WHERE id = booking_id 
  AND (user_id = auth.uid() OR property_id IN (
    SELECT id FROM public.properties WHERE user_id = auth.uid()
  ))
));

CREATE POLICY "Users can create signatures for their bookings" 
ON public.contract_signatures 
FOR INSERT 
WITH CHECK (EXISTS (
  SELECT 1 FROM public.bookings 
  WHERE id = booking_id 
  AND (user_id = auth.uid() OR property_id IN (
    SELECT id FROM public.properties WHERE user_id = auth.uid()
  ))
));

CREATE POLICY "Users can update signatures for their bookings" 
ON public.contract_signatures 
FOR UPDATE 
USING (EXISTS (
  SELECT 1 FROM public.bookings 
  WHERE id = booking_id 
  AND (user_id = auth.uid() OR property_id IN (
    SELECT id FROM public.properties WHERE user_id = auth.uid()
  ))
));

-- Enable RLS on guest_submissions table  
ALTER TABLE public.guest_submissions ENABLE ROW LEVEL SECURITY;

-- Guest submissions policies - accessible through property verification tokens
CREATE POLICY "Users can view submissions for their properties" 
ON public.guest_submissions 
FOR SELECT 
USING (EXISTS (
  SELECT 1 FROM public.property_verification_tokens pvt
  JOIN public.properties p ON p.id = pvt.property_id
  WHERE pvt.id = token_id 
  AND p.user_id = auth.uid()
));

CREATE POLICY "Guest submissions can be created via tokens" 
ON public.guest_submissions 
FOR INSERT 
WITH CHECK (EXISTS (
  SELECT 1 FROM public.property_verification_tokens
  WHERE id = token_id 
  AND is_active = true
));

-- Enable RLS on airbnb tables
ALTER TABLE public.airbnb_reservations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view reservations for their properties" 
ON public.airbnb_reservations 
FOR SELECT 
USING (EXISTS (
  SELECT 1 FROM public.properties 
  WHERE id = property_id 
  AND user_id = auth.uid()
));

ALTER TABLE public.airbnb_sync_status ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view sync status for their properties" 
ON public.airbnb_sync_status 
FOR SELECT 
USING (EXISTS (
  SELECT 1 FROM public.properties 
  WHERE id = property_id 
  AND user_id = auth.uid()
));

CREATE POLICY "Users can update sync status for their properties" 
ON public.airbnb_sync_status 
FOR UPDATE 
USING (EXISTS (
  SELECT 1 FROM public.properties 
  WHERE id = property_id 
  AND user_id = auth.uid()
));

CREATE POLICY "Users can insert sync status for their properties" 
ON public.airbnb_sync_status 
FOR INSERT 
WITH CHECK (EXISTS (
  SELECT 1 FROM public.properties 
  WHERE id = property_id 
  AND user_id = auth.uid()
));

-- Fix function search path security issue
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$function$;