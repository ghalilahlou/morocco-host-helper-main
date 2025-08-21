-- Add booking_id column to property_verification_tokens table if it doesn't exist
ALTER TABLE public.property_verification_tokens 
ADD COLUMN IF NOT EXISTS booking_id text;