-- Disable RLS temporarily for testing and create a completely open policy
ALTER TABLE public.bookings DISABLE ROW LEVEL SECURITY;

-- Re-enable with a very permissive policy for guest verification
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;

-- Drop all existing policies
DROP POLICY IF EXISTS "Users can view their own bookings" ON public.bookings;
DROP POLICY IF EXISTS "Users can create their own bookings" ON public.bookings; 
DROP POLICY IF EXISTS "Users can update their own bookings" ON public.bookings;
DROP POLICY IF EXISTS "Users can delete their own bookings" ON public.bookings;
DROP POLICY IF EXISTS "Allow guest verification bookings" ON public.bookings;

-- Create new comprehensive policies
-- Policy for authenticated users
CREATE POLICY "Authenticated users can manage their bookings" 
ON public.bookings 
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Policy for guest verification (unauthenticated users)
CREATE POLICY "Allow unauthenticated guest bookings" 
ON public.bookings 
FOR INSERT 
WITH CHECK (auth.uid() IS NULL);

-- Also make storage objects completely permissive for guest-documents
DROP POLICY IF EXISTS "Allow guest document uploads" ON storage.objects;
DROP POLICY IF EXISTS "Allow reading guest documents" ON storage.objects;

CREATE POLICY "Permissive guest document access" 
ON storage.objects 
USING (bucket_id = 'guest-documents')
WITH CHECK (bucket_id = 'guest-documents');