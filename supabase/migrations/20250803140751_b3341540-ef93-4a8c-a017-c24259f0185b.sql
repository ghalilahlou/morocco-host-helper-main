-- Fix RLS policies for airbnb_reservations and sync_status tables

-- Drop existing policies for airbnb_reservations
DROP POLICY IF EXISTS "Users can view reservations for their properties" ON public.airbnb_reservations;
DROP POLICY IF EXISTS "System can insert/update reservations" ON public.airbnb_reservations;

-- Create better policies for airbnb_reservations
CREATE POLICY "Users can view reservations for their properties" 
ON public.airbnb_reservations 
FOR SELECT 
USING (
  property_id IN (
    SELECT p.id 
    FROM public.properties p 
    WHERE p.user_id = auth.uid()
  )
);

CREATE POLICY "Users can manage reservations for their properties" 
ON public.airbnb_reservations 
FOR ALL 
USING (
  property_id IN (
    SELECT p.id 
    FROM public.properties p 
    WHERE p.user_id = auth.uid()
  )
);

-- Drop existing policies for airbnb_sync_status
DROP POLICY IF EXISTS "Users can view sync status for their properties" ON public.airbnb_sync_status;
DROP POLICY IF EXISTS "System can manage sync status" ON public.airbnb_sync_status;

-- Create better policies for airbnb_sync_status
CREATE POLICY "Users can view sync status for their properties" 
ON public.airbnb_sync_status 
FOR SELECT 
USING (
  property_id IN (
    SELECT p.id 
    FROM public.properties p 
    WHERE p.user_id = auth.uid()
  )
);

CREATE POLICY "Users can manage sync status for their properties" 
ON public.airbnb_sync_status 
FOR ALL 
USING (
  property_id IN (
    SELECT p.id 
    FROM public.properties p 
    WHERE p.user_id = auth.uid()
  )
);