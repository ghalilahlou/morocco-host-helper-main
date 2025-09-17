-- Add UNIQUE constraint on (property_id, airbnb_booking_id) for airbnb_reservations
-- This enables upsert operations instead of delete+insert

-- First, clean up any potential duplicates before adding the constraint
WITH duplicates AS (
  SELECT property_id, airbnb_booking_id, MIN(id) as keep_id
  FROM public.airbnb_reservations
  GROUP BY property_id, airbnb_booking_id
  HAVING COUNT(*) > 1
)
DELETE FROM public.airbnb_reservations
WHERE id IN (
  SELECT ar.id
  FROM public.airbnb_reservations ar
  JOIN duplicates d ON ar.property_id = d.property_id 
    AND ar.airbnb_booking_id = d.airbnb_booking_id
  WHERE ar.id != d.keep_id
);

-- Add the UNIQUE constraint
ALTER TABLE public.airbnb_reservations
ADD CONSTRAINT airbnb_reservations_property_booking_uk 
UNIQUE (property_id, airbnb_booking_id);

-- Add index for better performance on upsert operations
CREATE INDEX IF NOT EXISTS idx_airbnb_reservations_property_booking 
ON public.airbnb_reservations (property_id, airbnb_booking_id);
