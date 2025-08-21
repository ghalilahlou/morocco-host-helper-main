-- Storage Hardening Step 4: Make sensitive buckets private

-- 1) Make buckets private
UPDATE storage.buckets SET public = false WHERE id IN ('guest-documents','contracts','police-forms');

-- 2) Drop permissive dev policies if they exist
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT polname
    FROM pg_policies
    WHERE schemaname='storage' AND tablename='objects'
      AND polname IN ('dev_all_select','dev_all_insert','dev_all_update','dev_all_delete')
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects;', r.polname);
  END LOOP;
END$$;

-- NOTE: We are NOT adding storage RLS policies yet.
-- Access will go through a service-role edge function that bypasses RLS.