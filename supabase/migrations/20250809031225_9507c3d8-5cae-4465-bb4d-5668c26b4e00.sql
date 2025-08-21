-- Add submission_id column to bookings table for idempotent upserts
ALTER TABLE public.bookings 
ADD COLUMN IF NOT EXISTS submission_id uuid REFERENCES public.guest_submissions(id);

-- Create unique index on submission_id to support upsert operation
CREATE UNIQUE INDEX IF NOT EXISTS idx_bookings_submission_id 
ON public.bookings(submission_id) 
WHERE submission_id IS NOT NULL;