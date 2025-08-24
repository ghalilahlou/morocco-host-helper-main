-- 🔧 CORRECTION COMPLÈTE - PROBLÈMES CRITIQUES
-- Exécutez ce script dans l'éditeur SQL de Supabase

-- 1. CORRECTION ENUM booking_status
DO $$
BEGIN
    DROP TYPE IF EXISTS booking_status CASCADE;
    CREATE TYPE booking_status AS ENUM ('pending', 'confirmed', 'cancelled', 'completed');
    ALTER TABLE bookings ALTER COLUMN status TYPE booking_status USING 
        CASE 
            WHEN status::text = 'pending' THEN 'pending'::booking_status
            WHEN status::text = 'confirmed' THEN 'confirmed'::booking_status
            WHEN status::text = 'cancelled' THEN 'cancelled'::booking_status
            WHEN status::text = 'completed' THEN 'completed'::booking_status
            ELSE 'pending'::booking_status
        END;
END $$;

-- 2. CORRECTION TABLE contract_signatures
CREATE TABLE IF NOT EXISTS public.contract_signatures (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  booking_id UUID NOT NULL,
  signer_name TEXT NOT NULL,
  signer_email TEXT,
  signer_phone TEXT,
  signature_data TEXT NOT NULL,
  contract_content TEXT NOT NULL,
  signed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Ajouter colonnes manquantes
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'contract_signatures' AND column_name = 'signer_name') THEN
        ALTER TABLE contract_signatures ADD COLUMN signer_name TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'contract_signatures' AND column_name = 'signer_email') THEN
        ALTER TABLE contract_signatures ADD COLUMN signer_email TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'contract_signatures' AND column_name = 'signer_phone') THEN
        ALTER TABLE contract_signatures ADD COLUMN signer_phone TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'contract_signatures' AND column_name = 'signature_data') THEN
        ALTER TABLE contract_signatures ADD COLUMN signature_data TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'contract_signatures' AND column_name = 'contract_content') THEN
        ALTER TABLE contract_signatures ADD COLUMN contract_content TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'contract_signatures' AND column_name = 'signed_at') THEN
        ALTER TABLE contract_signatures ADD COLUMN signed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
    END IF;
END $$;

-- 3. CORRECTION RLS contract_signatures
ALTER TABLE public.contract_signatures ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view signatures for their bookings" ON public.contract_signatures;
DROP POLICY IF EXISTS "Users can create signatures for their bookings" ON public.contract_signatures;
DROP POLICY IF EXISTS "Users can update signatures for their bookings" ON public.contract_signatures;
DROP POLICY IF EXISTS "Enable insert for edge functions" ON public.contract_signatures;

CREATE POLICY "Users can view signatures for their bookings" ON public.contract_signatures FOR SELECT USING (
  booking_id IN (SELECT id FROM public.bookings WHERE property_id IN (SELECT id FROM public.properties WHERE user_id = auth.uid()))
);
CREATE POLICY "Users can create signatures for their bookings" ON public.contract_signatures FOR INSERT WITH CHECK (
  booking_id IN (SELECT id FROM public.bookings WHERE property_id IN (SELECT id FROM public.properties WHERE user_id = auth.uid()))
);
CREATE POLICY "Users can update signatures for their bookings" ON public.contract_signatures FOR UPDATE USING (
  booking_id IN (SELECT id FROM public.bookings WHERE property_id IN (SELECT id FROM public.properties WHERE user_id = auth.uid()))
);
CREATE POLICY "Enable insert for edge functions" ON public.contract_signatures FOR INSERT WITH CHECK (true);

-- 4. CORRECTION RLS property_verification_tokens
DROP POLICY IF EXISTS "Users can view tokens for their properties" ON public.property_verification_tokens;
DROP POLICY IF EXISTS "Users can create tokens for their properties" ON public.property_verification_tokens;
DROP POLICY IF EXISTS "Users can update tokens for their properties" ON public.property_verification_tokens;
DROP POLICY IF EXISTS "Allow unauthenticated token verification" ON public.property_verification_tokens;

CREATE POLICY "Users can view tokens for their properties" ON public.property_verification_tokens FOR SELECT USING (
  property_id IN (SELECT id FROM public.properties WHERE user_id = auth.uid())
);
CREATE POLICY "Users can create tokens for their properties" ON public.property_verification_tokens FOR INSERT WITH CHECK (
  property_id IN (SELECT id FROM public.properties WHERE user_id = auth.uid())
);
CREATE POLICY "Users can update tokens for their properties" ON public.property_verification_tokens FOR UPDATE USING (
  property_id IN (SELECT id FROM public.properties WHERE user_id = auth.uid())
);
CREATE POLICY "Allow unauthenticated token verification" ON public.property_verification_tokens FOR SELECT USING (is_active = true);

-- 5. CORRECTION RLS bookings
DROP POLICY IF EXISTS "Users can view their own bookings" ON public.bookings;
DROP POLICY IF EXISTS "Users can create bookings for their properties" ON public.bookings;
DROP POLICY IF EXISTS "Users can update their own bookings" ON public.bookings;
DROP POLICY IF EXISTS "Users can delete their own bookings" ON public.bookings;

CREATE POLICY "Users can view their own bookings" ON public.bookings FOR SELECT USING (
  user_id = auth.uid() OR property_id IN (SELECT id FROM public.properties WHERE user_id = auth.uid())
);
CREATE POLICY "Users can create bookings for their properties" ON public.bookings FOR INSERT WITH CHECK (
  user_id = auth.uid() OR property_id IN (SELECT id FROM public.properties WHERE user_id = auth.uid())
);
CREATE POLICY "Users can update their own bookings" ON public.bookings FOR UPDATE USING (
  user_id = auth.uid() OR property_id IN (SELECT id FROM public.properties WHERE user_id = auth.uid())
);
CREATE POLICY "Users can delete their own bookings" ON public.bookings FOR DELETE USING (
  user_id = auth.uid() OR property_id IN (SELECT id FROM public.properties WHERE user_id = auth.uid())
);

-- 6. CORRECTION RLS guest_submissions
DROP POLICY IF EXISTS "Users can view submissions for their properties" ON public.guest_submissions;
DROP POLICY IF EXISTS "Anyone can create submissions with valid token" ON public.guest_submissions;
DROP POLICY IF EXISTS "Users can update submissions for their properties" ON public.guest_submissions;

CREATE POLICY "Users can view submissions for their properties" ON public.guest_submissions FOR SELECT USING (
  token_id IN (SELECT id FROM public.property_verification_tokens WHERE property_id IN (SELECT id FROM public.properties WHERE user_id = auth.uid()))
);
CREATE POLICY "Anyone can create submissions with valid token" ON public.guest_submissions FOR INSERT WITH CHECK (
  token_id IN (SELECT id FROM public.property_verification_tokens WHERE is_active = true)
);
CREATE POLICY "Users can update submissions for their properties" ON public.guest_submissions FOR UPDATE USING (
  token_id IN (SELECT id FROM public.property_verification_tokens WHERE property_id IN (SELECT id FROM public.properties WHERE user_id = auth.uid()))
);

-- 7. CORRECTION RLS properties
DROP POLICY IF EXISTS "Users can view their own properties" ON public.properties;
DROP POLICY IF EXISTS "Users can create properties" ON public.properties;
DROP POLICY IF EXISTS "Users can update their own properties" ON public.properties;
DROP POLICY IF EXISTS "Users can delete their own properties" ON public.properties;

CREATE POLICY "Users can view their own properties" ON public.properties FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users can create properties" ON public.properties FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can update their own properties" ON public.properties FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "Users can delete their own properties" ON public.properties FOR DELETE USING (user_id = auth.uid());

-- 8. CRÉATION INDEX PERFORMANCE
CREATE INDEX IF NOT EXISTS idx_contract_signatures_booking_id ON contract_signatures(booking_id);
CREATE INDEX IF NOT EXISTS idx_contract_signatures_signed_at ON contract_signatures(signed_at);
CREATE INDEX IF NOT EXISTS idx_property_verification_tokens_property_id ON property_verification_tokens(property_id);
CREATE INDEX IF NOT EXISTS idx_property_verification_tokens_token ON property_verification_tokens(token);
CREATE INDEX IF NOT EXISTS idx_guest_submissions_token_id ON guest_submissions(token_id);
CREATE INDEX IF NOT EXISTS idx_bookings_user_id ON bookings(user_id);
CREATE INDEX IF NOT EXISTS idx_bookings_property_id ON bookings(property_id);
CREATE INDEX IF NOT EXISTS idx_properties_user_id ON properties(user_id);

-- 9. AJOUT CONTRAINTES CLÉS ÉTRANGÈRES
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'contract_signatures_booking_id_fkey' AND table_name = 'contract_signatures') THEN
        ALTER TABLE contract_signatures ADD CONSTRAINT contract_signatures_booking_id_fkey FOREIGN KEY (booking_id) REFERENCES bookings(id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'fk_property_verification_tokens_property_id' AND table_name = 'property_verification_tokens') THEN
        ALTER TABLE property_verification_tokens ADD CONSTRAINT fk_property_verification_tokens_property_id FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'fk_guest_submissions_token_id' AND table_name = 'guest_submissions') THEN
        ALTER TABLE guest_submissions ADD CONSTRAINT fk_guest_submissions_token_id FOREIGN KEY (token_id) REFERENCES property_verification_tokens(id) ON DELETE CASCADE;
    END IF;
END $$;

-- 10. NETTOYAGE DONNÉES CORROMPUES
DELETE FROM contract_signatures WHERE signature_data IS NULL OR signature_data = '' OR contract_content IS NULL OR contract_content = '';
DELETE FROM property_verification_tokens WHERE is_active = false AND created_at < NOW() - INTERVAL '30 days';

-- 11. VÉRIFICATION FINALE
SELECT '✅ CORRECTION TERMINÉE - ' || now() as status;
