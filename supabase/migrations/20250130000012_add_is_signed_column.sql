-- Add missing columns to uploaded_documents table for contract signing support
-- This migration adds the is_signed column that the generate-contract function expects

-- Add is_signed column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'uploaded_documents' 
        AND column_name = 'is_signed'
    ) THEN
        ALTER TABLE uploaded_documents 
        ADD COLUMN is_signed BOOLEAN DEFAULT FALSE;
    END IF;
END $$;

-- Add signature_data column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'uploaded_documents' 
        AND column_name = 'signature_data'
    ) THEN
        ALTER TABLE uploaded_documents 
        ADD COLUMN signature_data TEXT;
    END IF;
END $$;

-- Add signed_at column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'uploaded_documents' 
        AND column_name = 'signed_at'
    ) THEN
        ALTER TABLE uploaded_documents 
        ADD COLUMN signed_at TIMESTAMP WITH TIME ZONE;
    END IF;
END $$;

-- Add updated_at column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'uploaded_documents' 
        AND column_name = 'updated_at'
    ) THEN
        ALTER TABLE uploaded_documents 
        ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
    END IF;
END $$;

-- Create index on is_signed for better performance
CREATE INDEX IF NOT EXISTS idx_uploaded_documents_is_signed 
ON uploaded_documents(is_signed);

-- Create index on booking_id and document_type for better performance
CREATE INDEX IF NOT EXISTS idx_uploaded_documents_booking_type 
ON uploaded_documents(booking_id, document_type);

-- Add comment to the table
COMMENT ON TABLE uploaded_documents IS 'Stores all uploaded documents including contracts, police forms, and guest documents with signing support';
