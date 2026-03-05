-- Add 'confirmed' value to booking_status enum.
-- 'confirmed' means the booking is matched/verified (e.g. dates match Airbnb)
-- but documents have NOT yet been generated. 'completed' remains for fully
-- documented bookings (contract + police form generated).

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'confirmed'
      AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'booking_status')
  ) THEN
    ALTER TYPE public.booking_status ADD VALUE 'confirmed';
  END IF;
END $$;
