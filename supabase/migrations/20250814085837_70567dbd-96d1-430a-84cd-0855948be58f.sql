-- Comprehensive security reversal migration (corrected)
-- This removes all RLS policies, encryption, and security hardening

-- 1. Disable RLS on all tables
ALTER TABLE public.properties DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookings DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.guests DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.uploaded_documents DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.guest_submissions DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.contract_signatures DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.property_verification_tokens DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.airbnb_reservations DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.airbnb_sync_status DISABLE ROW LEVEL SECURITY;

-- 2. Drop all RLS policies (if they exist)
DROP POLICY IF EXISTS "Users can view their own properties" ON public.properties;
DROP POLICY IF EXISTS "Users can insert their own properties" ON public.properties;
DROP POLICY IF EXISTS "Users can update their own properties" ON public.properties;
DROP POLICY IF EXISTS "Users can delete their own properties" ON public.properties;
DROP POLICY IF EXISTS "Users can view bookings for their properties" ON public.bookings;
DROP POLICY IF EXISTS "Users can insert bookings for their properties" ON public.bookings;
DROP POLICY IF EXISTS "Users can update bookings for their properties" ON public.bookings;
DROP POLICY IF EXISTS "Users can delete bookings for their properties" ON public.bookings;
DROP POLICY IF EXISTS "Users can view guests for their bookings" ON public.guests;
DROP POLICY IF EXISTS "Users can insert guests for their bookings" ON public.guests;
DROP POLICY IF EXISTS "Users can update guests for their bookings" ON public.guests;
DROP POLICY IF EXISTS "Users can delete guests for their bookings" ON public.guests;
DROP POLICY IF EXISTS "Users can view documents for their bookings" ON public.uploaded_documents;
DROP POLICY IF EXISTS "Users can insert documents for their bookings" ON public.uploaded_documents;
DROP POLICY IF EXISTS "Users can update documents for their bookings" ON public.uploaded_documents;
DROP POLICY IF EXISTS "Users can delete documents for their bookings" ON public.uploaded_documents;
DROP POLICY IF EXISTS "Users can view submissions for their properties" ON public.guest_submissions;
DROP POLICY IF EXISTS "Users can insert submissions" ON public.guest_submissions;
DROP POLICY IF EXISTS "Users can update submissions for their properties" ON public.guest_submissions;
DROP POLICY IF EXISTS "Users can delete submissions for their properties" ON public.guest_submissions;
DROP POLICY IF EXISTS "Users can view signatures for their bookings" ON public.contract_signatures;
DROP POLICY IF EXISTS "Users can insert signatures for their bookings" ON public.contract_signatures;
DROP POLICY IF EXISTS "Users can update signatures for their bookings" ON public.contract_signatures;
DROP POLICY IF EXISTS "Users can delete signatures for their bookings" ON public.contract_signatures;
DROP POLICY IF EXISTS "Users can view tokens for their properties" ON public.property_verification_tokens;
DROP POLICY IF EXISTS "Users can insert tokens for their properties" ON public.property_verification_tokens;
DROP POLICY IF EXISTS "Users can update tokens for their properties" ON public.property_verification_tokens;
DROP POLICY IF EXISTS "Users can delete tokens for their properties" ON public.property_verification_tokens;

-- 3. Drop security definer functions
DROP FUNCTION IF EXISTS public.encrypt_guest_data(text, text, date, text);
DROP FUNCTION IF EXISTS public.get_guest_data_secure(uuid);
DROP FUNCTION IF EXISTS public.insert_guest_secure(uuid, text, text, date, text, text, text);
DROP FUNCTION IF EXISTS public.get_contract_signature_secure(uuid);
DROP FUNCTION IF EXISTS public.insert_contract_signature(uuid, text, text, text, text);
DROP FUNCTION IF EXISTS public.get_signed_contracts_for_user(uuid);
DROP FUNCTION IF EXISTS public.audit_contract_operations();
DROP FUNCTION IF EXISTS public.get_booking_guest_count(uuid);
DROP FUNCTION IF EXISTS public.check_contract_signature(uuid);
DROP FUNCTION IF EXISTS public.verify_property_token(uuid, text);
DROP FUNCTION IF EXISTS public.get_property_for_verification(uuid);

-- 4. Remove encrypted columns from guests table and restore plain text columns
ALTER TABLE public.guests 
DROP COLUMN IF EXISTS full_name_encrypted,
DROP COLUMN IF EXISTS document_number_encrypted,
DROP COLUMN IF EXISTS date_of_birth_encrypted,
DROP COLUMN IF EXISTS place_of_birth_encrypted;

-- Add back plain text columns if they don't exist
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'guests' AND column_name = 'full_name') THEN
        ALTER TABLE public.guests ADD COLUMN full_name text;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'guests' AND column_name = 'document_number') THEN
        ALTER TABLE public.guests ADD COLUMN document_number text;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'guests' AND column_name = 'date_of_birth') THEN
        ALTER TABLE public.guests ADD COLUMN date_of_birth date;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'guests' AND column_name = 'place_of_birth') THEN
        ALTER TABLE public.guests ADD COLUMN place_of_birth text;
    END IF;
END $$;

-- 5. Remove additional security columns if they exist
ALTER TABLE public.contract_signatures 
DROP COLUMN IF EXISTS ip_address,
DROP COLUMN IF EXISTS user_agent,
DROP COLUMN IF EXISTS guest_submission_id;

-- 6. Drop triggers related to security
DROP TRIGGER IF EXISTS handle_contract_signature_insert_trigger ON public.contract_signatures;
DROP TRIGGER IF EXISTS audit_contract_operations_trigger ON public.contract_signatures;
DROP TRIGGER IF EXISTS update_guests_updated_at ON public.guests;
DROP TRIGGER IF EXISTS update_bookings_updated_at ON public.bookings;
DROP TRIGGER IF EXISTS update_properties_updated_at ON public.properties;
DROP TRIGGER IF EXISTS update_contract_signatures_updated_at ON public.contract_signatures;
DROP TRIGGER IF EXISTS update_guest_submissions_updated_at ON public.guest_submissions;
DROP TRIGGER IF EXISTS update_property_verification_tokens_updated_at ON public.property_verification_tokens;
DROP TRIGGER IF EXISTS update_uploaded_documents_updated_at ON public.uploaded_documents;

-- 7. Remove pgcrypto extension
DROP EXTENSION IF EXISTS pgcrypto;

-- 8. Grant full access to anon and authenticated roles
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO anon, authenticated;