-- Rename column to match our interface
ALTER TABLE public.guest_submissions 
RENAME COLUMN property_token_id TO token_id;