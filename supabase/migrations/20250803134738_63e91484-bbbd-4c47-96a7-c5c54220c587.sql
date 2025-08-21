-- Add airbnb_ics_url column to properties table
ALTER TABLE public.properties 
ADD COLUMN airbnb_ics_url TEXT;