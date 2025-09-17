-- Add document signing support to uploaded_documents table
-- This migration adds the necessary columns to support document signing functionality

-- Add columns for document signing
ALTER TABLE public.uploaded_documents 
ADD COLUMN IF NOT EXISTS is_signed BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS signature_data TEXT,
ADD COLUMN IF NOT EXISTS signed_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS document_url TEXT;

-- Add index for signed documents
CREATE INDEX IF NOT EXISTS idx_uploaded_documents_is_signed 
ON public.uploaded_documents(is_signed) 
WHERE is_signed = TRUE;

-- Add index for document type and booking
CREATE INDEX IF NOT EXISTS idx_uploaded_documents_type_booking 
ON public.uploaded_documents(document_type, booking_id);

-- Add index for signed_at
CREATE INDEX IF NOT EXISTS idx_uploaded_documents_signed_at 
ON public.uploaded_documents(signed_at) 
WHERE signed_at IS NOT NULL;

-- Add comments to clarify the new columns
COMMENT ON COLUMN public.uploaded_documents.is_signed IS 'Indicates if the document has been signed by the guest';
COMMENT ON COLUMN public.uploaded_documents.signature_data IS 'Base64 encoded signature image data';
COMMENT ON COLUMN public.uploaded_documents.signed_at IS 'Timestamp when the document was signed';
COMMENT ON COLUMN public.uploaded_documents.document_url IS 'URL or data URL of the generated document';

-- Update the documents_generated column in bookings to track contract generation status
ALTER TABLE public.bookings 
ADD COLUMN IF NOT EXISTS contract_generated_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS contract_signed_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS police_forms_generated_at TIMESTAMP WITH TIME ZONE;

-- Add comments for the new booking columns
COMMENT ON COLUMN public.bookings.contract_generated_at IS 'Timestamp when the contract was first generated';
COMMENT ON COLUMN public.bookings.contract_signed_at IS 'Timestamp when the contract was signed by the guest';
COMMENT ON COLUMN public.bookings.police_forms_generated_at IS 'Timestamp when police forms were generated';

-- Create a function to update booking document status
CREATE OR REPLACE FUNCTION update_booking_document_status()
RETURNS TRIGGER AS $$
BEGIN
  -- Update booking document timestamps when documents are created/updated
  IF NEW.document_type = 'contract' AND OLD IS NULL THEN
    -- New contract document created
    UPDATE public.bookings 
    SET contract_generated_at = NEW.created_at,
        updated_at = NOW()
    WHERE id = NEW.booking_id;
  END IF;
  
  IF NEW.document_type = 'contract' AND NEW.is_signed = TRUE AND (OLD IS NULL OR OLD.is_signed = FALSE) THEN
    -- Contract was signed
    UPDATE public.bookings 
    SET contract_signed_at = NEW.signed_at,
        updated_at = NOW()
    WHERE id = NEW.booking_id;
  END IF;
  
  IF NEW.document_type = 'police' AND OLD IS NULL THEN
    -- New police forms document created
    UPDATE public.bookings 
    SET police_forms_generated_at = NEW.created_at,
        updated_at = NOW()
    WHERE id = NEW.booking_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update booking document status
DROP TRIGGER IF EXISTS trigger_update_booking_document_status ON public.uploaded_documents;
CREATE TRIGGER trigger_update_booking_document_status
  AFTER INSERT OR UPDATE ON public.uploaded_documents
  FOR EACH ROW
  EXECUTE FUNCTION update_booking_document_status();

-- Create a view for easy access to document status
CREATE OR REPLACE VIEW v_booking_document_status AS
SELECT 
  b.id as booking_id,
  b.booking_reference,
  b.check_in_date,
  b.check_out_date,
  b.contract_generated_at,
  b.contract_signed_at,
  b.police_forms_generated_at,
  -- Contract document info
  contract_doc.id as contract_document_id,
  contract_doc.is_signed as contract_is_signed,
  contract_doc.signed_at as contract_signed_at_doc,
  contract_doc.document_url as contract_url,
  -- Police forms document info
  police_doc.id as police_document_id,
  police_doc.document_url as police_forms_url,
  -- Status flags
  CASE 
    WHEN contract_doc.id IS NOT NULL THEN TRUE 
    ELSE FALSE 
  END as has_contract,
  CASE 
    WHEN contract_doc.is_signed = TRUE THEN TRUE 
    ELSE FALSE 
  END as contract_signed,
  CASE 
    WHEN police_doc.id IS NOT NULL THEN TRUE 
    ELSE FALSE 
  END as has_police_forms
FROM public.bookings b
LEFT JOIN public.uploaded_documents contract_doc 
  ON b.id = contract_doc.booking_id 
  AND contract_doc.document_type = 'contract'
  AND contract_doc.created_at = (
    SELECT MAX(created_at) 
    FROM public.uploaded_documents 
    WHERE booking_id = b.id 
    AND document_type = 'contract'
  )
LEFT JOIN public.uploaded_documents police_doc 
  ON b.id = police_doc.booking_id 
  AND police_doc.document_type = 'police'
  AND police_doc.created_at = (
    SELECT MAX(created_at) 
    FROM public.uploaded_documents 
    WHERE booking_id = b.id 
    AND document_type = 'police'
  );

-- Add comment to the view
COMMENT ON VIEW v_booking_document_status IS 'View providing comprehensive document status for bookings including contract and police forms generation and signing status';


