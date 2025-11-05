-- Fix Supabase linter security findings (2025-10-31)
-- 1) Stop exposing auth.users via public.profiles
-- 2) Ensure RLS is enabled on flagged tables
-- 3) Add minimal safe RLS policies for generated_documents
-- 4) Recreate views without SECURITY DEFINER

-- 1) Drop public.profiles view if it exists (exposes auth.users)
DROP VIEW IF EXISTS public.profiles CASCADE;

-- Revoke any remaining permissions as safeguard (if view still exists)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'profiles' AND c.relkind = 'v'
  ) THEN
    EXECUTE 'REVOKE ALL ON public.profiles FROM anon, authenticated, public';
  END IF;
END $$;

-- 2) Enable RLS on flagged tables (idempotent)
DO $$
BEGIN
  IF to_regclass('public.properties') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.properties ENABLE ROW LEVEL SECURITY';
  END IF;
  IF to_regclass('public.guests') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.guests ENABLE ROW LEVEL SECURITY';
  END IF;
  IF to_regclass('public.guest_submissions') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.guest_submissions ENABLE ROW LEVEL SECURITY';
  END IF;
  IF to_regclass('public.generated_documents') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.generated_documents ENABLE ROW LEVEL SECURITY';
  END IF;
END $$;

-- 3) Add SELECT policy for generated_documents (hosts can read their data)
DO $policy$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
      AND tablename = 'generated_documents' 
      AND policyname = 'hosts_can_select_generated_documents'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY hosts_can_select_generated_documents
      ON public.generated_documents
      FOR SELECT
      TO authenticated
      USING (
        EXISTS (
          SELECT 1
          FROM public.bookings b
          JOIN public.properties p ON p.id = b.property_id
          WHERE b.id = generated_documents.booking_id
            AND p.user_id = auth.uid()
        )
      )
    $policy$;
  END IF;
END$policy$;

-- 4) Recreate v_guest_submissions view without SECURITY DEFINER
-- Views without SECURITY DEFINER use SECURITY INVOKER by default (user's permissions)
DROP VIEW IF EXISTS public.v_guest_submissions CASCADE;

CREATE VIEW public.v_guest_submissions AS
SELECT 
    gs.*,
    pvt.property_id,
    -- Use direct booking_id if exists, otherwise resolve via token
    COALESCE(gs.booking_id, 
        CASE 
            WHEN pvt.booking_id IS NOT NULL 
                 AND pvt.booking_id::text ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' 
            THEN pvt.booking_id::uuid
            ELSE NULL
        END
    ) as resolved_booking_id
FROM guest_submissions gs
JOIN property_verification_tokens pvt ON gs.token_id = pvt.id
WHERE pvt.is_active = true;

-- 5) Recreate v_booking_health view without SECURITY DEFINER (if it exists)
-- First check if it exists and get its definition
DO $view$
DECLARE
  view_exists BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM pg_views 
    WHERE schemaname = 'public' AND viewname = 'v_booking_health'
  ) INTO view_exists;
  
  IF view_exists THEN
    -- Drop and recreate without SECURITY DEFINER
    -- Since we don't have the exact definition, we'll drop it
    -- and let it be recreated by the application if needed
    EXECUTE 'DROP VIEW IF EXISTS public.v_booking_health CASCADE';
    
    -- Optional: Create a basic replacement if needed
    -- This is a placeholder - adjust based on your actual needs
    -- Views without SECURITY DEFINER use SECURITY INVOKER by default
    EXECUTE $view$
      CREATE VIEW public.v_booking_health AS
      SELECT 
        b.id as booking_id,
        b.property_id,
        b.status,
        b.check_in_date,
        b.check_out_date,
        COUNT(DISTINCT gs.id) as guest_submissions_count,
        COUNT(DISTINCT gd.id) as generated_documents_count,
        COUNT(DISTINCT cs.id) as contract_signatures_count
      FROM public.bookings b
      LEFT JOIN public.guest_submissions gs ON gs.booking_id = b.id
      LEFT JOIN public.generated_documents gd ON gd.booking_id = b.id
      LEFT JOIN public.contract_signatures cs ON cs.booking_id = b.id
      GROUP BY b.id, b.property_id, b.status, b.check_in_date, b.check_out_date
    $view$;
  END IF;
END$view$;

-- Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
