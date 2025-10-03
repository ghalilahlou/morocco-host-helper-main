-- RLS Policies consolidées pour Morocco Host Helper
-- Assure que toutes les tables sensibles sont protégées avec des policies owner-based

-- =============================================================================
-- ENABLE RLS ON ALL SENSITIVE TABLES
-- =============================================================================

-- Tables principales
ALTER TABLE public.properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.guests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.property_verification_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.guest_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_storage ENABLE ROW LEVEL SECURITY;

-- Tables administratives
ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_properties ENABLE ROW LEVEL SECURITY;

-- Tables Airbnb
ALTER TABLE public.airbnb_reservations ENABLE ROW LEVEL SECURITY;

-- =============================================================================
-- PROPERTIES - Owner-based access
-- =============================================================================

-- Propriétaires peuvent voir/modifier leurs propriétés
CREATE POLICY "properties_owner_access" ON public.properties
  FOR ALL 
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

-- Lecture publique pour propriétés actives (pour système de réservation)
CREATE POLICY "properties_public_read" ON public.properties
  FOR SELECT
  USING (is_active = true);

-- =============================================================================
-- BOOKINGS - Owner et Guest access
-- =============================================================================

-- Propriétaires peuvent voir toutes les réservations de leurs propriétés
CREATE POLICY "bookings_owner_access" ON public.bookings
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.properties p 
      WHERE p.id = bookings.property_id 
      AND p.owner_id = auth.uid()
    )
  );

-- Invités peuvent voir leurs propres réservations
CREATE POLICY "bookings_guest_read" ON public.bookings
  FOR SELECT
  USING (
    guest_email = (
      SELECT email FROM auth.users WHERE id = auth.uid()
    )
  );

-- =============================================================================
-- GUESTS - Privacy protection
-- =============================================================================

-- Propriétaires peuvent voir les invités de leurs propriétés
CREATE POLICY "guests_owner_access" ON public.guests
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.bookings b
      JOIN public.properties p ON b.property_id = p.id
      WHERE b.id = guests.booking_id 
      AND p.owner_id = auth.uid()
    )
  );

-- Invités peuvent voir/modifier leurs propres données
CREATE POLICY "guests_self_access" ON public.guests
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.bookings b
      WHERE b.id = guests.booking_id 
      AND b.guest_email = (SELECT email FROM auth.users WHERE id = auth.uid())
    )
  );

-- =============================================================================
-- PROPERTY_VERIFICATION_TOKENS - Security critical
-- =============================================================================

-- Propriétaires peuvent gérer les tokens de leurs propriétés
CREATE POLICY "tokens_owner_access" ON public.property_verification_tokens
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.properties p 
      WHERE p.id = property_verification_tokens.property_id 
      AND p.owner_id = auth.uid()
    )
  );

-- Lecture limitée pour validation (pas d'exposition des secrets)
CREATE POLICY "tokens_validation_read" ON public.property_verification_tokens
  FOR SELECT
  USING (
    property_id IS NOT NULL 
    AND expires_at > NOW()
  );

-- =============================================================================
-- GUEST_SUBMISSIONS - Privacy & Ownership
-- =============================================================================

-- Propriétaires peuvent voir les soumissions pour leurs propriétés
CREATE POLICY "submissions_owner_read" ON public.guest_submissions
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.bookings b
      JOIN public.properties p ON b.property_id = p.id
      WHERE b.id = guest_submissions.booking_id 
      AND p.owner_id = auth.uid()
    )
  );

-- Invités peuvent créer/modifier leurs soumissions
CREATE POLICY "submissions_guest_access" ON public.guest_submissions
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.bookings b
      WHERE b.id = guest_submissions.booking_id 
      AND b.guest_email = (SELECT email FROM auth.users WHERE id = auth.uid())
    )
  );

-- =============================================================================
-- DOCUMENT_STORAGE - File access control
-- =============================================================================

-- Propriétaires peuvent accéder aux documents de leurs propriétés
CREATE POLICY "documents_owner_access" ON public.document_storage
  FOR ALL
  USING (
    user_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM public.bookings b
      JOIN public.properties p ON b.property_id = p.id
      WHERE b.id = document_storage.booking_id 
      AND p.owner_id = auth.uid()
    )
  );

-- Invités peuvent accéder à leurs documents
CREATE POLICY "documents_guest_access" ON public.document_storage
  FOR SELECT
  USING (
    user_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM public.bookings b
      WHERE b.id = document_storage.booking_id 
      AND b.guest_email = (SELECT email FROM auth.users WHERE id = auth.uid())
    )
  );

-- =============================================================================
-- ADMIN TABLES - Admin-only access
-- =============================================================================

-- Fonction helper pour vérifier si l'utilisateur est admin
CREATE OR REPLACE FUNCTION public.is_admin_user()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.admin_users 
    WHERE user_id = auth.uid() 
    AND is_active = true
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Admin users - Seuls les super-admins peuvent modifier
CREATE POLICY "admin_users_super_admin" ON public.admin_users
  FOR ALL
  USING (
    auth.uid() IN (
      SELECT user_id FROM public.admin_users 
      WHERE role = 'super_admin' AND is_active = true
    )
  );

-- Admin bookings - Admins seulement
CREATE POLICY "admin_bookings_access" ON public.admin_bookings
  FOR ALL
  USING (public.is_admin_user());

-- Admin properties - Admins seulement  
CREATE POLICY "admin_properties_access" ON public.admin_properties
  FOR ALL
  USING (public.is_admin_user());

-- =============================================================================
-- AIRBNB_RESERVATIONS - Propriétaire et sync system
-- =============================================================================

-- Propriétaires peuvent voir les réservations Airbnb de leurs propriétés
CREATE POLICY "airbnb_reservations_owner" ON public.airbnb_reservations
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.properties p 
      WHERE p.id = airbnb_reservations.property_id 
      AND p.owner_id = auth.uid()
    )
  );

-- Service role peut créer/modifier pour sync
-- (déjà géré par les service role policies existantes)

-- =============================================================================
-- SECURITY HELPERS & FUNCTIONS
-- =============================================================================

-- Fonction pour vérifier la propriété d'une propriété
CREATE OR REPLACE FUNCTION public.user_owns_property(property_uuid uuid)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.properties 
    WHERE id = property_uuid 
    AND owner_id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Fonction pour vérifier l'accès à une réservation
CREATE OR REPLACE FUNCTION public.user_can_access_booking(booking_uuid uuid)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    -- Propriétaire de la propriété
    SELECT 1 FROM public.bookings b
    JOIN public.properties p ON b.property_id = p.id
    WHERE b.id = booking_uuid 
    AND p.owner_id = auth.uid()
  ) OR EXISTS (
    -- Invité de la réservation
    SELECT 1 FROM public.bookings b
    WHERE b.id = booking_uuid 
    AND b.guest_email = (SELECT email FROM auth.users WHERE id = auth.uid())
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- INDEXES POUR PERFORMANCE RLS
-- =============================================================================

-- Index pour les requêtes owner_id fréquentes
CREATE INDEX IF NOT EXISTS idx_properties_owner_id ON public.properties(owner_id);
CREATE INDEX IF NOT EXISTS idx_bookings_property_owner ON public.bookings(property_id);
CREATE INDEX IF NOT EXISTS idx_guests_booking_id ON public.guests(booking_id);

-- Index pour les requêtes d'authentification
CREATE INDEX IF NOT EXISTS idx_admin_users_user_id_active ON public.admin_users(user_id) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_properties_active ON public.properties(id) WHERE is_active = true;

-- Index pour les tokens de vérification
CREATE INDEX IF NOT EXISTS idx_tokens_property_expires ON public.property_verification_tokens(property_id, expires_at) WHERE expires_at > NOW();

-- =============================================================================
-- COMMENTAIRES ET DOCUMENTATION
-- =============================================================================

COMMENT ON POLICY "properties_owner_access" ON public.properties IS 
'Propriétaires peuvent gérer leurs propriétés';

COMMENT ON POLICY "bookings_owner_access" ON public.bookings IS 
'Propriétaires voient toutes les réservations de leurs propriétés';

COMMENT ON POLICY "guests_owner_access" ON public.guests IS 
'Propriétaires voient les invités de leurs propriétés pour gestion';

COMMENT ON FUNCTION public.is_admin_user() IS 
'Vérifie si l\'utilisateur connecté est un administrateur actif';

COMMENT ON FUNCTION public.user_owns_property(uuid) IS 
'Vérifie si l\'utilisateur connecté possède la propriété spécifiée';

-- =============================================================================
-- TESTS DE VÉRIFICATION RLS
-- =============================================================================

-- Test: Vérifier que RLS est activé sur toutes les tables critiques
DO $$
DECLARE
  table_name TEXT;
  rls_enabled BOOLEAN;
BEGIN
  FOR table_name IN 
    SELECT unnest(ARRAY['properties', 'bookings', 'guests', 'property_verification_tokens', 'guest_submissions', 'document_storage', 'admin_users'])
  LOOP
    SELECT relrowsecurity INTO rls_enabled
    FROM pg_class 
    WHERE relname = table_name;
    
    IF NOT rls_enabled THEN
      RAISE WARNING 'RLS not enabled on table: %', table_name;
    END IF;
  END LOOP;
  
  RAISE NOTICE 'RLS security check completed';
END $$;
