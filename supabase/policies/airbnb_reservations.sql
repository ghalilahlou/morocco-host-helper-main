-- RLS Policies pour airbnb_reservations
-- Sécurité: Lecture via Edge Functions seulement, aucun accès public direct

-- Activer RLS
ALTER TABLE public.airbnb_reservations ENABLE ROW LEVEL SECURITY;

-- Supprimer les anciennes policies si elles existent
DROP POLICY IF EXISTS "airbnb_reservations_service_role_all" ON public.airbnb_reservations;
DROP POLICY IF EXISTS "airbnb_reservations_owner_read" ON public.airbnb_reservations;
DROP POLICY IF EXISTS "airbnb_reservations_no_public_access" ON public.airbnb_reservations;

-- Policy 1: Service Role (Edge Functions) - Accès complet
CREATE POLICY "airbnb_reservations_service_role_all"
  ON public.airbnb_reservations
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Policy 2: Propriétaires - Lecture seule de leurs réservations
-- (Si auth.users existe et relation avec properties)
CREATE POLICY "airbnb_reservations_owner_read"
  ON public.airbnb_reservations
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.properties p
      WHERE p.id = airbnb_reservations.property_id
      AND p.user_id = auth.uid()
    )
  );

-- Policy 3: Aucun accès public (invités passent par Edge Functions)
CREATE POLICY "airbnb_reservations_no_public_access"
  ON public.airbnb_reservations
  FOR ALL
  TO anon
  USING (false)
  WITH CHECK (false);

-- Grants pour service_role (Edge Functions)
GRANT ALL ON public.airbnb_reservations TO service_role;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO service_role;

-- Grants limités pour authenticated users (propriétaires)
GRANT SELECT ON public.airbnb_reservations TO authenticated;
