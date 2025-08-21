-- Create a storage bucket for property photos
INSERT INTO storage.buckets (id, name, public) VALUES ('property-photos', 'property-photos', true);

-- Create storage policies for property photos
CREATE POLICY "Users can upload photos for their properties" 
ON storage.objects 
FOR INSERT 
WITH CHECK (bucket_id = 'property-photos' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can view their property photos" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'property-photos' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can update their property photos" 
ON storage.objects 
FOR UPDATE 
USING (bucket_id = 'property-photos' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete their property photos" 
ON storage.objects 
FOR DELETE 
USING (bucket_id = 'property-photos' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Property photos are publicly viewable" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'property-photos');

-- Add photo_url column to properties table
ALTER TABLE public.properties ADD COLUMN photo_url text;