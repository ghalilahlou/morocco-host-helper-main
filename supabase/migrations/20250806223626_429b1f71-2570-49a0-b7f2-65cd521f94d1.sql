-- Clean up duplicate document storage and create unified system
-- This migration ensures uploaded_documents is the single source of truth for all document URLs

-- First, let's update uploaded_documents records that have file_path but no document_url
-- to include the public URL for existing files

-- Update uploaded_documents with missing document_urls based on file_path
UPDATE uploaded_documents 
SET document_url = CASE 
  WHEN file_path IS NOT NULL AND document_url IS NULL THEN 
    'https://csopyblkfyofwkeqqegd.supabase.co/storage/v1/object/public/guest-documents/' || file_path
  ELSE document_url
END
WHERE file_path IS NOT NULL AND document_url IS NULL;

-- Add a comment to the uploaded_documents table to clarify its role
COMMENT ON TABLE uploaded_documents IS 'Unified storage for all guest document records. This is the single source of truth for document URLs, eliminating duplication with guest_submissions.';

-- Add a comment to guest_submissions.document_urls to clarify it should not be used for new records
COMMENT ON COLUMN guest_submissions.document_urls IS 'DEPRECATED: Document URLs are now stored in uploaded_documents table only. This field should remain empty for new submissions to avoid duplication.';

-- Create index for better performance when querying documents by booking
CREATE INDEX IF NOT EXISTS idx_uploaded_documents_booking_id ON uploaded_documents(booking_id);

-- Create index for better performance when querying documents with URLs
CREATE INDEX IF NOT EXISTS idx_uploaded_documents_url_not_null ON uploaded_documents(booking_id) WHERE document_url IS NOT NULL;