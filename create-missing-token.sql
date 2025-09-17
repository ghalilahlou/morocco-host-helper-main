-- Création des tables manquantes pour le système de tokens
-- Ce script crée les tables nécessaires si elles n'existent pas

-- 1. Créer la table properties si elle n'existe pas
CREATE TABLE IF NOT EXISTS public.properties (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    address TEXT,
    description TEXT,
    contact_info JSONB,
    house_rules TEXT,
    contract_template TEXT,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Créer la table property_verification_tokens si elle n'existe pas
CREATE TABLE IF NOT EXISTS public.property_verification_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
    token TEXT NOT NULL,
    is_active BOOLEAN DEFAULT true,
    expires_at TIMESTAMPTZ NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    booking_id UUID NULL,
    
    -- Contraintes
    CONSTRAINT unique_property_token UNIQUE (property_id, token)
);

-- 3. Créer la table bookings si elle n'existe pas
CREATE TABLE IF NOT EXISTS public.bookings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
    check_in_date DATE NOT NULL,
    check_out_date DATE NOT NULL,
    number_of_guests INTEGER NOT NULL DEFAULT 1,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'cancelled', 'completed')),
    submission_id UUID NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Créer la table guests si elle n'existe pas
CREATE TABLE IF NOT EXISTS public.guests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_id UUID NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
    full_name TEXT NOT NULL,
    date_of_birth DATE,
    nationality TEXT,
    document_number TEXT,
    document_type TEXT CHECK (document_type IN ('passport', 'national_id')),
    profession TEXT,
    motif_sejour TEXT DEFAULT 'TOURISME',
    adresse_personnelle TEXT,
    email TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Créer la table guest_documents si elle n'existe pas
CREATE TABLE IF NOT EXISTS public.guest_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_id UUID NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
    document_url TEXT NOT NULL,
    document_type TEXT DEFAULT 'identity',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Créer la table submissions si elle n'existe pas
CREATE TABLE IF NOT EXISTS public.submissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_id UUID NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
    status TEXT DEFAULT 'submitted' CHECK (status IN ('submitted', 'approved', 'rejected')),
    submitted_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. Créer les index pour les performances
CREATE INDEX IF NOT EXISTS idx_properties_user_id ON public.properties(user_id);
CREATE INDEX IF NOT EXISTS idx_property_verification_tokens_property_id ON public.property_verification_tokens(property_id);
CREATE INDEX IF NOT EXISTS idx_property_verification_tokens_token ON public.property_verification_tokens(token);
CREATE INDEX IF NOT EXISTS idx_bookings_property_id ON public.bookings(property_id);
CREATE INDEX IF NOT EXISTS idx_bookings_dates ON public.bookings(check_in_date, check_out_date);
CREATE INDEX IF NOT EXISTS idx_guests_booking_id ON public.guests(booking_id);
CREATE INDEX IF NOT EXISTS idx_guest_documents_booking_id ON public.guest_documents(booking_id);

-- 8. Créer la fonction verify_property_token
CREATE OR REPLACE FUNCTION public.verify_property_token(p_property_id UUID, p_token TEXT)
RETURNS TABLE (
  id UUID,
  property_id UUID,
  token TEXT,
  expires_at TIMESTAMPTZ,
  is_valid BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    pvt.id,
    pvt.property_id,
    pvt.token,
    pvt.expires_at,
    (pvt.expires_at > NOW() OR pvt.expires_at IS NULL) as is_valid
  FROM public.property_verification_tokens pvt
  WHERE pvt.property_id = p_property_id 
    AND pvt.token = p_token
    AND pvt.is_active = true
  LIMIT 1;
END;
$$;

-- 9. Accorder les permissions nécessaires
GRANT EXECUTE ON FUNCTION public.verify_property_token(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.verify_property_token(UUID, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.verify_property_token(UUID, TEXT) TO service_role;

-- 10. Désactiver RLS temporairement pour les Edge Functions
ALTER TABLE public.property_verification_tokens DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.properties DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookings DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.guests DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.guest_documents DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.submissions DISABLE ROW LEVEL SECURITY;

-- 11. Vérifier la création
SELECT 
  'Tables créées' as status,
  (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'properties') as properties_exists,
  (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'property_verification_tokens') as tokens_exists,
  (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'bookings') as bookings_exists;