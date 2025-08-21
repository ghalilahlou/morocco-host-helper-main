-- Enable real-time for airbnb_sync_status table
ALTER TABLE public.airbnb_sync_status REPLICA IDENTITY FULL;

-- Add table to realtime publication
ALTER publication supabase_realtime ADD TABLE public.airbnb_sync_status;