-- Remove the unique constraint on property_id to allow multiple tokens per property
ALTER TABLE public.property_verification_tokens 
DROP CONSTRAINT IF EXISTS property_verification_tokens_property_id_key;