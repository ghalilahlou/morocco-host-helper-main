-- First, drop the problematic policy and create a better one
DROP POLICY IF EXISTS "Allow creating bookings via guest verification tokens" ON public.bookings;

-- Create a more permissive policy for guest-created bookings
CREATE POLICY "Allow guest verification bookings" 
ON public.bookings 
FOR INSERT 
WITH CHECK (
  booking_reference LIKE 'GUEST-%'
);

-- Also add storage policies for guest document uploads
INSERT INTO storage.buckets (id, name, public) 
VALUES ('guest-documents', 'guest-documents', false)
ON CONFLICT (id) DO NOTHING;

-- Allow anyone to upload to guest-documents bucket
CREATE POLICY "Allow guest document uploads" 
ON storage.objects 
FOR INSERT 
WITH CHECK (bucket_id = 'guest-documents');

-- Allow reading guest documents (for verification)
CREATE POLICY "Allow reading guest documents" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'guest-documents');