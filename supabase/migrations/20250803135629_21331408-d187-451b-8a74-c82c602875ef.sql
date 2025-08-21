-- Create table for Airbnb reservations
CREATE TABLE public.airbnb_reservations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  property_id UUID NOT NULL,
  airbnb_booking_id TEXT NOT NULL,
  summary TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  guest_name TEXT,
  number_of_guests INTEGER,
  description TEXT,
  raw_event_data JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(property_id, airbnb_booking_id)
);

-- Enable RLS
ALTER TABLE public.airbnb_reservations ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view reservations for their properties" 
ON public.airbnb_reservations 
FOR SELECT 
USING (property_id IN (
  SELECT properties.id 
  FROM properties 
  WHERE properties.user_id = auth.uid()
));

CREATE POLICY "System can insert/update reservations" 
ON public.airbnb_reservations 
FOR ALL 
USING (true);

-- Create table for sync status
CREATE TABLE public.airbnb_sync_status (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  property_id UUID NOT NULL UNIQUE,
  last_sync_at TIMESTAMP WITH TIME ZONE,
  sync_status TEXT NOT NULL DEFAULT 'pending',
  last_error TEXT,
  reservations_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS for sync status
ALTER TABLE public.airbnb_sync_status ENABLE ROW LEVEL SECURITY;

-- Create policies for sync status
CREATE POLICY "Users can view sync status for their properties" 
ON public.airbnb_sync_status 
FOR SELECT 
USING (property_id IN (
  SELECT properties.id 
  FROM properties 
  WHERE properties.user_id = auth.uid()
));

CREATE POLICY "System can manage sync status" 
ON public.airbnb_sync_status 
FOR ALL 
USING (true);

-- Create function to update timestamps
CREATE TRIGGER update_airbnb_reservations_updated_at
BEFORE UPDATE ON public.airbnb_reservations
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_airbnb_sync_status_updated_at
BEFORE UPDATE ON public.airbnb_sync_status
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();