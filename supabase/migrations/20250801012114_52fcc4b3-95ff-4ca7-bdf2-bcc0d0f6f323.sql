-- Create storage buckets for documents
INSERT INTO storage.buckets (id, name, public) VALUES 
  ('guest-documents', 'guest-documents', false),
  ('contracts', 'contracts', false),
  ('police-forms', 'police-forms', false);

-- Create RLS policies for guest documents (users can access their own booking documents)
CREATE POLICY "Users can view their own guest documents" 
ON storage.objects FOR SELECT 
USING (
  bucket_id = 'guest-documents' AND 
  auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can upload their own guest documents" 
ON storage.objects FOR INSERT 
WITH CHECK (
  bucket_id = 'guest-documents' AND 
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Create RLS policies for contracts
CREATE POLICY "Users can view their own contracts" 
ON storage.objects FOR SELECT 
USING (
  bucket_id = 'contracts' AND 
  auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can upload their own contracts" 
ON storage.objects FOR INSERT 
WITH CHECK (
  bucket_id = 'contracts' AND 
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Create RLS policies for police forms
CREATE POLICY "Users can view their own police forms" 
ON storage.objects FOR SELECT 
USING (
  bucket_id = 'police-forms' AND 
  auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can upload their own police forms" 
ON storage.objects FOR INSERT 
WITH CHECK (
  bucket_id = 'police-forms' AND 
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Add document URLs to uploaded_documents table
ALTER TABLE uploaded_documents 
ADD COLUMN IF NOT EXISTS document_url TEXT,
ADD COLUMN IF NOT EXISTS contract_url TEXT,
ADD COLUMN IF NOT EXISTS police_form_url TEXT;