-- Add tables required for host-side real-time updates to the supabase_realtime publication.
-- Without this, Supabase Realtime subscriptions on these tables receive no events.

DO $$
BEGIN
  -- bookings: host calendar + modal updates when guest submits
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'bookings'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.bookings;
  END IF;

  -- guests: host sees guest info updates
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'guests'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.guests;
  END IF;

  -- guest_submissions: triggers reload when guest submits documents
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'guest_submissions'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.guest_submissions;
  END IF;

  -- contract_signatures: triggers reload when guest signs contract
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'contract_signatures'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.contract_signatures;
  END IF;

  -- airbnb_reservations: calendar updates on sync
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'airbnb_reservations'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.airbnb_reservations;
  END IF;
END $$;
