-- Add is_active column to properties table
-- This migration adds the is_active column that the AdminTokens component expects

-- Add is_active column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'properties' 
        AND column_name = 'is_active'
    ) THEN
        ALTER TABLE public.properties 
        ADD COLUMN is_active BOOLEAN DEFAULT TRUE;
    END IF;
END $$;

-- Create index on is_active for better performance
CREATE INDEX IF NOT EXISTS idx_properties_is_active 
ON public.properties(is_active);

-- Add comment to the new column
COMMENT ON COLUMN public.properties.is_active IS 'Indicates if the property is active and available for bookings';
