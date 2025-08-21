-- Completely disable RLS for bookings table to test
ALTER TABLE public.bookings DISABLE ROW LEVEL SECURITY;

-- Also disable RLS for storage.objects temporarily 
ALTER TABLE storage.objects DISABLE ROW LEVEL SECURITY;