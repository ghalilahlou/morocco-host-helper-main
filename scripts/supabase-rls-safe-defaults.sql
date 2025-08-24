-- 🔒 SUPABASE RLS "SAFE DEFAULTS" - SÉCURISATION COMPLÈTE
-- Exécutez ce script dans l'éditeur SQL de Supabase pour sécuriser toutes les tables

-- =====================================================
-- 1. ACTIVATION RLS SUR TOUTES LES TABLES
-- =====================================================

-- Activer RLS sur toutes les tables publiques
ALTER TABLE public.properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contract_signatures ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.property_verification_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.guest_submissions ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- 2. POLITIQUES RLS POUR properties
-- =====================================================

-- Supprimer les anciennes politiques
DROP POLICY IF EXISTS "Users can view their own properties" ON public.properties;
DROP POLICY IF EXISTS "Users can create properties" ON public.properties;
DROP POLICY IF EXISTS "Users can update their own properties" ON public.properties;
DROP POLICY IF EXISTS "Users can delete their own properties" ON public.properties;

-- Politiques sécurisées pour properties
CREATE POLICY "properties_select_own"
ON public.properties
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "properties_insert_own"
ON public.properties
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "properties_update_own"
ON public.properties
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "properties_delete_own"
ON public.properties
FOR DELETE
USING (auth.uid() = user_id);

-- =====================================================
-- 3. POLITIQUES RLS POUR bookings
-- =====================================================

-- Supprimer les anciennes politiques
DROP POLICY IF EXISTS "Users can view their own bookings" ON public.bookings;
DROP POLICY IF EXISTS "Users can create bookings for their properties" ON public.bookings;
DROP POLICY IF EXISTS "Users can update their own bookings" ON public.bookings;
DROP POLICY IF EXISTS "Users can delete their own bookings" ON public.bookings;

-- Politiques sécurisées pour bookings
CREATE POLICY "bookings_select_own"
ON public.bookings
FOR SELECT
USING (
  auth.uid() = user_id OR 
  property_id IN (
    SELECT id FROM public.properties WHERE user_id = auth.uid()
  )
);

CREATE POLICY "bookings_insert_own"
ON public.bookings
FOR INSERT
WITH CHECK (
  auth.uid() = user_id OR 
  property_id IN (
    SELECT id FROM public.properties WHERE user_id = auth.uid()
  )
);

CREATE POLICY "bookings_update_own"
ON public.bookings
FOR UPDATE
USING (
  auth.uid() = user_id OR 
  property_id IN (
    SELECT id FROM public.properties WHERE user_id = auth.uid()
  )
)
WITH CHECK (
  auth.uid() = user_id OR 
  property_id IN (
    SELECT id FROM public.properties WHERE user_id = auth.uid()
  )
);

CREATE POLICY "bookings_delete_own"
ON public.bookings
FOR DELETE
USING (
  auth.uid() = user_id OR 
  property_id IN (
    SELECT id FROM public.properties WHERE user_id = auth.uid()
  )
);

-- =====================================================
-- 4. POLITIQUES RLS POUR contract_signatures
-- =====================================================

-- Supprimer les anciennes politiques
DROP POLICY IF EXISTS "Users can view signatures for their bookings" ON public.contract_signatures;
DROP POLICY IF EXISTS "Users can create signatures for their bookings" ON public.contract_signatures;
DROP POLICY IF EXISTS "Users can update signatures for their bookings" ON public.contract_signatures;
DROP POLICY IF EXISTS "Enable insert for edge functions" ON public.contract_signatures;

-- Politiques sécurisées pour contract_signatures
CREATE POLICY "contract_signatures_select_own"
ON public.contract_signatures
FOR SELECT
USING (
  booking_id IN (
    SELECT id FROM public.bookings 
    WHERE property_id IN (
      SELECT id FROM public.properties WHERE user_id = auth.uid()
    )
  )
);

CREATE POLICY "contract_signatures_insert_own"
ON public.contract_signatures
FOR INSERT
WITH CHECK (
  booking_id IN (
    SELECT id FROM public.bookings 
    WHERE property_id IN (
      SELECT id FROM public.properties WHERE user_id = auth.uid()
    )
  )
);

CREATE POLICY "contract_signatures_update_own"
ON public.contract_signatures
FOR UPDATE
USING (
  booking_id IN (
    SELECT id FROM public.bookings 
    WHERE property_id IN (
      SELECT id FROM public.properties WHERE user_id = auth.uid()
    )
  )
)
WITH CHECK (
  booking_id IN (
    SELECT id FROM public.bookings 
    WHERE property_id IN (
      SELECT id FROM public.properties WHERE user_id = auth.uid()
    )
  )
);

-- Politique spéciale pour les Edge Functions (avec vérification JWT)
CREATE POLICY "contract_signatures_insert_edge_functions"
ON public.contract_signatures
FOR INSERT
WITH CHECK (true);

-- =====================================================
-- 5. POLITIQUES RLS POUR property_verification_tokens
-- =====================================================

-- Supprimer les anciennes politiques
DROP POLICY IF EXISTS "Users can view tokens for their properties" ON public.property_verification_tokens;
DROP POLICY IF EXISTS "Users can create tokens for their properties" ON public.property_verification_tokens;
DROP POLICY IF EXISTS "Users can update tokens for their properties" ON public.property_verification_tokens;
DROP POLICY IF EXISTS "Allow unauthenticated token verification" ON public.property_verification_tokens;

-- Politiques sécurisées pour property_verification_tokens
CREATE POLICY "property_verification_tokens_select_own"
ON public.property_verification_tokens
FOR SELECT
USING (
  property_id IN (
    SELECT id FROM public.properties WHERE user_id = auth.uid()
  )
);

CREATE POLICY "property_verification_tokens_insert_own"
ON public.property_verification_tokens
FOR INSERT
WITH CHECK (
  property_id IN (
    SELECT id FROM public.properties WHERE user_id = auth.uid()
  )
);

CREATE POLICY "property_verification_tokens_update_own"
ON public.property_verification_tokens
FOR UPDATE
USING (
  property_id IN (
    SELECT id FROM public.properties WHERE user_id = auth.uid()
  )
)
WITH CHECK (
  property_id IN (
    SELECT id FROM public.properties WHERE user_id = auth.uid()
  )
);

-- Politique pour la vérification publique des tokens actifs
CREATE POLICY "property_verification_tokens_select_public"
ON public.property_verification_tokens
FOR SELECT
USING (is_active = true);

-- =====================================================
-- 6. POLITIQUES RLS POUR guest_submissions
-- =====================================================

-- Supprimer les anciennes politiques
DROP POLICY IF EXISTS "Users can view submissions for their properties" ON public.guest_submissions;
DROP POLICY IF EXISTS "Anyone can create submissions with valid token" ON public.guest_submissions;
DROP POLICY IF EXISTS "Users can update submissions for their properties" ON public.guest_submissions;

-- Politiques sécurisées pour guest_submissions
CREATE POLICY "guest_submissions_select_own"
ON public.guest_submissions
FOR SELECT
USING (
  token_id IN (
    SELECT id FROM public.property_verification_tokens 
    WHERE property_id IN (
      SELECT id FROM public.properties WHERE user_id = auth.uid()
    )
  )
);

CREATE POLICY "guest_submissions_insert_public"
ON public.guest_submissions
FOR INSERT
WITH CHECK (
  token_id IN (
    SELECT id FROM public.property_verification_tokens 
    WHERE is_active = true
  )
);

CREATE POLICY "guest_submissions_update_own"
ON public.guest_submissions
FOR UPDATE
USING (
  token_id IN (
    SELECT id FROM public.property_verification_tokens 
    WHERE property_id IN (
      SELECT id FROM public.properties WHERE user_id = auth.uid()
    )
  )
)
WITH CHECK (
  token_id IN (
    SELECT id FROM public.property_verification_tokens 
    WHERE property_id IN (
      SELECT id FROM public.properties WHERE user_id = auth.uid()
    )
  )
);

-- =====================================================
-- 7. INDEX DE PERFORMANCE POUR LA SÉCURITÉ
-- =====================================================

-- Index pour optimiser les requêtes RLS
CREATE INDEX IF NOT EXISTS idx_properties_user_id ON properties(user_id);
CREATE INDEX IF NOT EXISTS idx_bookings_user_id ON bookings(user_id);
CREATE INDEX IF NOT EXISTS idx_bookings_property_id ON bookings(property_id);
CREATE INDEX IF NOT EXISTS idx_contract_signatures_booking_id ON contract_signatures(booking_id);
CREATE INDEX IF NOT EXISTS idx_property_verification_tokens_property_id ON property_verification_tokens(property_id);
CREATE INDEX IF NOT EXISTS idx_property_verification_tokens_active ON property_verification_tokens(is_active);
CREATE INDEX IF NOT EXISTS idx_guest_submissions_token_id ON guest_submissions(token_id);

-- =====================================================
-- 8. VÉRIFICATION FINALE
-- =====================================================

-- Vérifier que RLS est activé sur toutes les tables
SELECT 
    schemaname,
    tablename,
    rowsecurity
FROM pg_tables 
WHERE schemaname = 'public' 
  AND tablename IN ('properties', 'bookings', 'contract_signatures', 'property_verification_tokens', 'guest_submissions')
ORDER BY tablename;

-- Vérifier les politiques créées
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies 
WHERE schemaname = 'public'
  AND tablename IN ('properties', 'bookings', 'contract_signatures', 'property_verification_tokens', 'guest_submissions')
ORDER BY tablename, policyname;

-- Afficher un résumé de sécurité
SELECT 
    '🔒 SÉCURISATION RLS TERMINÉE' as status,
    now() as completed_at;
