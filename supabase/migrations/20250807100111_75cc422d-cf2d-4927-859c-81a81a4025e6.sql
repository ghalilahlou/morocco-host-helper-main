-- Create RLS policies for contracts bucket to allow users to upload documents for their own bookings

-- Policy for INSERT (upload)
CREATE POLICY "Users can upload contracts for their bookings" 
ON storage.objects 
FOR INSERT 
WITH CHECK (
  bucket_id = 'contracts' 
  AND auth.uid() IS NOT NULL
  AND auth.uid() IN (
    SELECT b.user_id 
    FROM bookings b 
    WHERE b.id::text = (storage.foldername(name))[1]
  )
);

-- Policy for SELECT (view/download)
CREATE POLICY "Users can view contracts for their bookings" 
ON storage.objects 
FOR SELECT 
USING (
  bucket_id = 'contracts' 
  AND auth.uid() IS NOT NULL
  AND auth.uid() IN (
    SELECT b.user_id 
    FROM bookings b 
    WHERE b.id::text = (storage.foldername(name))[1]
  )
);

-- Policy for UPDATE (replace files)
CREATE POLICY "Users can update contracts for their bookings" 
ON storage.objects 
FOR UPDATE 
USING (
  bucket_id = 'contracts' 
  AND auth.uid() IS NOT NULL
  AND auth.uid() IN (
    SELECT b.user_id 
    FROM bookings b 
    WHERE b.id::text = (storage.foldername(name))[1]
  )
);

-- Policy for DELETE (remove files)
CREATE POLICY "Users can delete contracts for their bookings" 
ON storage.objects 
FOR DELETE 
USING (
  bucket_id = 'contracts' 
  AND auth.uid() IS NOT NULL
  AND auth.uid() IN (
    SELECT b.user_id 
    FROM bookings b 
    WHERE b.id::text = (storage.foldername(name))[1]
  )
);

-- Create similar policies for police-forms bucket
CREATE POLICY "Users can upload police forms for their bookings" 
ON storage.objects 
FOR INSERT 
WITH CHECK (
  bucket_id = 'police-forms' 
  AND auth.uid() IS NOT NULL
  AND auth.uid() IN (
    SELECT b.user_id 
    FROM bookings b 
    WHERE b.id::text = (storage.foldername(name))[1]
  )
);

CREATE POLICY "Users can view police forms for their bookings" 
ON storage.objects 
FOR SELECT 
USING (
  bucket_id = 'police-forms' 
  AND auth.uid() IS NOT NULL
  AND auth.uid() IN (
    SELECT b.user_id 
    FROM bookings b 
    WHERE b.id::text = (storage.foldername(name))[1]
  )
);

CREATE POLICY "Users can update police forms for their bookings" 
ON storage.objects 
FOR UPDATE 
USING (
  bucket_id = 'police-forms' 
  AND auth.uid() IS NOT NULL
  AND auth.uid() IN (
    SELECT b.user_id 
    FROM bookings b 
    WHERE b.id::text = (storage.foldername(name))[1]
  )
);

CREATE POLICY "Users can delete police forms for their bookings" 
ON storage.objects 
FOR DELETE 
USING (
  bucket_id = 'police-forms' 
  AND auth.uid() IS NOT NULL
  AND auth.uid() IN (
    SELECT b.user_id 
    FROM bookings b 
    WHERE b.id::text = (storage.foldername(name))[1]
  )
);