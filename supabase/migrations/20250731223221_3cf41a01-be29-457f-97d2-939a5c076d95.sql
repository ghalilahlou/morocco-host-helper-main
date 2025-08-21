-- Add user_id column to bookings table
ALTER TABLE public.bookings 
ADD COLUMN user_id UUID REFERENCES auth.users(id);

-- Update RLS policies to be user-specific
DROP POLICY "Allow all operations on properties" ON public.properties;
DROP POLICY "Allow all operations on bookings" ON public.bookings;
DROP POLICY "Allow all operations on guests" ON public.guests;
DROP POLICY "Allow all operations on uploaded_documents" ON public.uploaded_documents;

-- Create user-specific policies for bookings
CREATE POLICY "Users can view their own bookings" 
ON public.bookings FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own bookings" 
ON public.bookings FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own bookings" 
ON public.bookings FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own bookings" 
ON public.bookings FOR DELETE 
USING (auth.uid() = user_id);

-- Create policies for guests (linked to bookings via user)
CREATE POLICY "Users can view guests of their bookings" 
ON public.guests FOR SELECT 
USING (booking_id IN (SELECT id FROM public.bookings WHERE user_id = auth.uid()));

CREATE POLICY "Users can create guests for their bookings" 
ON public.guests FOR INSERT 
WITH CHECK (booking_id IN (SELECT id FROM public.bookings WHERE user_id = auth.uid()));

CREATE POLICY "Users can update guests of their bookings" 
ON public.guests FOR UPDATE 
USING (booking_id IN (SELECT id FROM public.bookings WHERE user_id = auth.uid()));

CREATE POLICY "Users can delete guests of their bookings" 
ON public.guests FOR DELETE 
USING (booking_id IN (SELECT id FROM public.bookings WHERE user_id = auth.uid()));

-- Create policies for uploaded documents (linked to bookings via user)
CREATE POLICY "Users can view documents of their bookings" 
ON public.uploaded_documents FOR SELECT 
USING (booking_id IN (SELECT id FROM public.bookings WHERE user_id = auth.uid()));

CREATE POLICY "Users can create documents for their bookings" 
ON public.uploaded_documents FOR INSERT 
WITH CHECK (booking_id IN (SELECT id FROM public.bookings WHERE user_id = auth.uid()));

CREATE POLICY "Users can update documents of their bookings" 
ON public.uploaded_documents FOR UPDATE 
USING (booking_id IN (SELECT id FROM public.bookings WHERE user_id = auth.uid()));

CREATE POLICY "Users can delete documents of their bookings" 
ON public.uploaded_documents FOR DELETE 
USING (booking_id IN (SELECT id FROM public.bookings WHERE user_id = auth.uid()));

-- Keep properties as shared resource for now (can be restricted later if needed)
CREATE POLICY "Allow all operations on properties" ON public.properties FOR ALL USING (true);