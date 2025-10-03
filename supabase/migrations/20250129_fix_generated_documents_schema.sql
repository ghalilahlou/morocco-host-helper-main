-- Fix generated_documents table schema
-- Add missing signed_at column if it doesn't exist

-- Check if signed_at column exists, if not add it
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'generated_documents' 
        AND column_name = 'signed_at'
    ) THEN
        ALTER TABLE generated_documents 
        ADD COLUMN signed_at TIMESTAMP WITH TIME ZONE;
        
        RAISE NOTICE 'Added signed_at column to generated_documents table';
    ELSE
        RAISE NOTICE 'signed_at column already exists in generated_documents table';
    END IF;
END $$;

-- Ensure all required columns exist
ALTER TABLE generated_documents 
ALTER COLUMN created_at SET DEFAULT NOW();

-- Add index for better performance
CREATE INDEX IF NOT EXISTS idx_generated_documents_booking_id 
ON generated_documents(booking_id);

CREATE INDEX IF NOT EXISTS idx_generated_documents_document_type 
ON generated_documents(document_type);

-- Ensure uploaded_documents has the same schema consistency
ALTER TABLE uploaded_documents 
ALTER COLUMN created_at SET DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_uploaded_documents_booking_id 
ON uploaded_documents(booking_id);

CREATE INDEX IF NOT EXISTS idx_uploaded_documents_document_type 
ON uploaded_documents(document_type);
