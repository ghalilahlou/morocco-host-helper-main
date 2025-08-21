-- Enable RLS (if not already)
ALTER TABLE public.property_verification_tokens ENABLE ROW LEVEL SECURITY;

-- Remove every existing policy on this table (clean slate)
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT polname
    FROM pg_policies
    WHERE schemaname='public'
      AND tablename='property_verification_tokens'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.property_verification_tokens;', r.polname);
  END LOOP;
END$$;

-- NOTE:
-- No new SELECT/INSERT/UPDATE/DELETE policies are added.
-- This leaves anon/authenticated with NO access to the table.
-- Our resolve-guest-link edge function uses the SERVICE ROLE key and will continue to work.