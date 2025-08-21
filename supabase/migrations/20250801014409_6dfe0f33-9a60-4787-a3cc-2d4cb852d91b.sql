-- Create storage policies for guest-documents bucket
-- Allow authenticated users to upload files to their own booking folders

-- Policy for SELECT (viewing files)
CREATE POLICY "Users can view files in their bookings" ON storage.objects
FOR SELECT USING (
  bucket_id = 'guest-documents' 
  AND auth.uid()::text = (
    SELECT user_id::text FROM bookings 
    WHERE id::text = (string_to_array(name, '/'))[1]
  )
);

-- Policy for INSERT (uploading files)
CREATE POLICY "Users can upload files to their bookings" ON storage.objects
FOR INSERT WITH CHECK (
  bucket_id = 'guest-documents' 
  AND auth.uid()::text = (
    SELECT user_id::text FROM bookings 
    WHERE id::text = (string_to_array(name, '/'))[1]
  )
);

-- Policy for UPDATE (updating files)
CREATE POLICY "Users can update files in their bookings" ON storage.objects
FOR UPDATE USING (
  bucket_id = 'guest-documents' 
  AND auth.uid()::text = (
    SELECT user_id::text FROM bookings 
    WHERE id::text = (string_to_array(name, '/'))[1]
  )
);

-- Policy for DELETE (deleting files)
CREATE POLICY "Users can delete files in their bookings" ON storage.objects
FOR DELETE USING (
  bucket_id = 'guest-documents' 
  AND auth.uid()::text = (
    SELECT user_id::text FROM bookings 
    WHERE id::text = (string_to_array(name, '/'))[1]
  )
);