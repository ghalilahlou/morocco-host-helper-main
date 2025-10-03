-- Add missing columns to property_verification_tokens table
-- This migration adds the expires_at column that the issue-guest-link function expects

-- Add expires_at column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'property_verification_tokens' 
        AND column_name = 'expires_at'
    ) THEN
        ALTER TABLE public.property_verification_tokens 
        ADD COLUMN expires_at TIMESTAMP WITH TIME ZONE;
    END IF;
END $$;

-- Add booking_id column if it doesn't exist (as text to handle both UUIDs and Airbnb codes)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'property_verification_tokens' 
        AND column_name = 'booking_id'
    ) THEN
        ALTER TABLE public.property_verification_tokens 
        ADD COLUMN booking_id TEXT;
    END IF;
END $$;

-- Add max_uses column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'property_verification_tokens' 
        AND column_name = 'max_uses'
    ) THEN
        ALTER TABLE public.property_verification_tokens 
        ADD COLUMN max_uses INTEGER DEFAULT 1;
    END IF;
END $$;

-- Add used_count column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'property_verification_tokens' 
        AND column_name = 'used_count'
    ) THEN
        ALTER TABLE public.property_verification_tokens 
        ADD COLUMN used_count INTEGER DEFAULT 0;
    END IF;
END $$;

-- Add type column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'property_verification_tokens' 
        AND column_name = 'type'
    ) THEN
        ALTER TABLE public.property_verification_tokens 
        ADD COLUMN type TEXT DEFAULT 'guest';
    END IF;
END $$;

-- Create index on expires_at for better performance
CREATE INDEX IF NOT EXISTS idx_property_verification_tokens_expires_at 
ON public.property_verification_tokens(expires_at);

-- Create index on booking_id for better performance
CREATE INDEX IF NOT EXISTS idx_property_verification_tokens_booking_id 
ON public.property_verification_tokens(booking_id);

-- Add comments to the new columns
COMMENT ON COLUMN public.property_verification_tokens.expires_at IS 'Timestamp when the token expires';
COMMENT ON COLUMN public.property_verification_tokens.booking_id IS 'Associated booking ID (can be UUID or Airbnb code)';
COMMENT ON COLUMN public.property_verification_tokens.max_uses IS 'Maximum number of times this token can be used';
COMMENT ON COLUMN public.property_verification_tokens.used_count IS 'Number of times this token has been used';
COMMENT ON COLUMN public.property_verification_tokens.type IS 'Type of verification token (guest, admin, etc.)';
