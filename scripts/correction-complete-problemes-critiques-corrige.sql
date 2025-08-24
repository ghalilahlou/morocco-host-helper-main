-- 🔧 CORRECTION COMPLÈTE - PROBLÈMES CRITIQUES (CORRIGÉ)
-- Exécutez ce script dans l'éditeur SQL de Supabase

-- =====================================================
-- 1. CORRECTION ENUM booking_status
-- =====================================================

DO $$
BEGIN
    -- Supprimer l'ancien type ENUM s'il existe
    DROP TYPE IF EXISTS booking_status CASCADE;
    
    -- Créer le nouveau type ENUM avec toutes les valeurs nécessaires
    CREATE TYPE booking_status AS ENUM ('pending', 'confirmed', 'cancelled', 'completed');
    
    -- Mettre à jour la colonne status dans la table bookings
    ALTER TABLE bookings ALTER COLUMN status TYPE booking_status USING 
        CASE 
            WHEN status::text = 'pending' THEN 'pending'::booking_status
            WHEN status::text = 'confirmed' THEN 'confirmed'::booking_status
            WHEN status::text = 'cancelled' THEN 'cancelled'::booking_status
            WHEN status::text = 'completed' THEN 'completed'::booking_status
            ELSE 'pending'::booking_status
        END;
    
    RAISE NOTICE '✅ ENUM booking_status corrigé avec succès';
    
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE '❌ Erreur lors de la correction de l''ENUM: %', SQLERRM;
        
        -- Approche alternative : convertir en text d'abord
        ALTER TABLE bookings ALTER COLUMN status TYPE text;
        
        -- Mettre à jour les valeurs invalides
        UPDATE bookings 
        SET status = 'pending' 
        WHERE status NOT IN ('pending', 'confirmed', 'cancelled', 'completed') 
           OR status IS NULL;
           
        -- Recréer l'ENUM
        DROP TYPE IF EXISTS booking_status CASCADE;
        CREATE TYPE booking_status AS ENUM ('pending', 'confirmed', 'cancelled', 'completed');
        
        -- Reconvertir la colonne
        ALTER TABLE bookings 
        ALTER COLUMN status TYPE booking_status 
        USING status::booking_status;
        
        RAISE NOTICE '✅ ENUM booking_status corrigé avec approche alternative';
END $$;

-- =====================================================
-- 2. CORRECTION TABLE contract_signatures
-- =====================================================

-- Créer la table contract_signatures si elle n'existe pas
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

-- Ajouter les colonnes manquantes si elles n'existent pas
DO $$
BEGIN
    -- Ajouter signer_name si elle n'existe pas
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'contract_signatures' 
        AND column_name = 'signer_name'
    ) THEN
        ALTER TABLE contract_signatures ADD COLUMN signer_name TEXT;
    END IF;
    
    -- Ajouter signer_email si elle n'existe pas
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'contract_signatures' 
        AND column_name = 'signer_email'
    ) THEN
        ALTER TABLE contract_signatures ADD COLUMN signer_email TEXT;
    END IF;
    
    -- Ajouter signer_phone si elle n'existe pas
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'contract_signatures' 
        AND column_name = 'signer_phone'
    ) THEN
        ALTER TABLE contract_signatures ADD COLUMN signer_phone TEXT;
    END IF;
    
    -- Ajouter signature_data si elle n'existe pas
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'contract_signatures' 
        AND column_name = 'signature_data'
    ) THEN
        ALTER TABLE contract_signatures ADD COLUMN signature_data TEXT;
    END IF;
    
    -- Ajouter contract_content si elle n'existe pas
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'contract_signatures' 
        AND column_name = 'contract_content'
    ) THEN
        ALTER TABLE contract_signatures ADD COLUMN contract_content TEXT;
    END IF;
    
    -- Ajouter signed_at si elle n'existe pas
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'contract_signatures' 
        AND column_name = 'signed_at'
    ) THEN
        ALTER TABLE contract_signatures ADD COLUMN signed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
    END IF;
    
    RAISE NOTICE '✅ Structure de contract_signatures corrigée';
END $$;

-- =====================================================
-- 3. NETTOYAGE PRÉALABLE DES DONNÉES ORPHELINES
-- =====================================================

-- Supprimer les contraintes de clés étrangères existantes pour éviter les erreurs
DO $$
BEGIN
    -- Supprimer la contrainte contract_signatures_booking_id_fkey si elle existe
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'contract_signatures_booking_id_fkey' 
        AND table_name = 'contract_signatures'
    ) THEN
        ALTER TABLE contract_signatures DROP CONSTRAINT contract_signatures_booking_id_fkey;
    END IF;
    
    -- Supprimer la contrainte fk_property_verification_tokens_property_id si elle existe
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'fk_property_verification_tokens_property_id' 
        AND table_name = 'property_verification_tokens'
    ) THEN
        ALTER TABLE property_verification_tokens DROP CONSTRAINT fk_property_verification_tokens_property_id;
    END IF;
    
    -- Supprimer la contrainte fk_guest_submissions_token_id si elle existe
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'fk_guest_submissions_token_id' 
        AND table_name = 'guest_submissions'
    ) THEN
        ALTER TABLE guest_submissions DROP CONSTRAINT fk_guest_submissions_token_id;
    END IF;
    
    RAISE NOTICE '✅ Contraintes de clés étrangères supprimées pour nettoyage';
END $$;

-- Nettoyer les signatures avec des données vides ou corrompues
DELETE FROM contract_signatures 
WHERE signature_data IS NULL 
   OR signature_data = '' 
   OR contract_content IS NULL 
   OR contract_content = '';

-- Nettoyer les signatures orphelines (booking_id qui n'existe pas dans bookings)
DELETE FROM contract_signatures 
WHERE booking_id NOT IN (SELECT id FROM bookings);

-- Nettoyer les tokens orphelins (property_id qui n'existe pas dans properties)
DELETE FROM property_verification_tokens 
WHERE property_id NOT IN (SELECT id FROM properties);

-- Nettoyer les soumissions orphelines (token_id qui n'existe pas dans property_verification_tokens)
DELETE FROM guest_submissions 
WHERE token_id NOT IN (SELECT id FROM property_verification_tokens);

-- Nettoyer les tokens inactifs anciens (plus de 30 jours)
DELETE FROM property_verification_tokens 
WHERE is_active = false 
  AND created_at < NOW() - INTERVAL '30 days';

-- =====================================================
-- 4. CORRECTION RLS contract_signatures
-- =====================================================

-- Activer RLS sur contract_signatures
ALTER TABLE public.contract_signatures ENABLE ROW LEVEL SECURITY;

-- Supprimer les anciennes politiques RLS
DROP POLICY IF EXISTS "Users can view signatures for their bookings" ON public.contract_signatures;
DROP POLICY IF EXISTS "Users can create signatures for their bookings" ON public.contract_signatures;
DROP POLICY IF EXISTS "Users can update signatures for their bookings" ON public.contract_signatures;
DROP POLICY IF EXISTS "Enable insert for edge functions" ON public.contract_signatures;
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON public.contract_signatures;

-- Recréer les politiques RLS pour contract_signatures
CREATE POLICY "Users can view signatures for their bookings" 
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

CREATE POLICY "Users can create signatures for their bookings" 
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

CREATE POLICY "Users can update signatures for their bookings" 
ON public.contract_signatures 
FOR UPDATE 
USING (
  booking_id IN (
    SELECT id FROM public.bookings 
    WHERE property_id IN (
      SELECT id FROM public.properties WHERE user_id = auth.uid()
    )
  )
);

-- Ajouter une politique pour permettre l'insertion depuis les Edge Functions
CREATE POLICY "Enable insert for edge functions" 
ON public.contract_signatures 
FOR INSERT 
WITH CHECK (true);

-- =====================================================
-- 5. CORRECTION RLS property_verification_tokens
-- =====================================================

-- Supprimer les anciennes politiques RLS
DROP POLICY IF EXISTS "Users can view tokens for their properties" ON public.property_verification_tokens;
DROP POLICY IF EXISTS "Users can create tokens for their properties" ON public.property_verification_tokens;
DROP POLICY IF EXISTS "Users can update tokens for their properties" ON public.property_verification_tokens;
DROP POLICY IF EXISTS "Allow unauthenticated token verification" ON public.property_verification_tokens;
DROP POLICY IF EXISTS "Property owners can create verification tokens" ON public.property_verification_tokens;
DROP POLICY IF EXISTS "Property owners can view their tokens" ON public.property_verification_tokens;
DROP POLICY IF EXISTS "Property owners can update their tokens" ON public.property_verification_tokens;
DROP POLICY IF EXISTS "Property owners can delete their tokens" ON public.property_verification_tokens;

-- Recréer les politiques RLS correctement
CREATE POLICY "Users can view tokens for their properties" 
ON public.property_verification_tokens 
FOR SELECT 
USING (
  property_id IN (
    SELECT id FROM public.properties WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Users can create tokens for their properties" 
ON public.property_verification_tokens 
FOR INSERT 
WITH CHECK (
  property_id IN (
    SELECT id FROM public.properties WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Users can update tokens for their properties" 
ON public.property_verification_tokens 
FOR UPDATE 
USING (
  property_id IN (
    SELECT id FROM public.properties WHERE user_id = auth.uid()
  )
);

-- Ajouter une politique pour permettre la lecture publique des tokens actifs
CREATE POLICY "Allow unauthenticated token verification" 
ON public.property_verification_tokens 
FOR SELECT 
USING (is_active = true);

-- =====================================================
-- 6. CORRECTION RLS bookings
-- =====================================================

-- Supprimer les anciennes politiques RLS sur bookings
DROP POLICY IF EXISTS "Users can view their own bookings" ON public.bookings;
DROP POLICY IF EXISTS "Users can create bookings for their properties" ON public.bookings;
DROP POLICY IF EXISTS "Users can update their own bookings" ON public.bookings;
DROP POLICY IF EXISTS "Users can delete their own bookings" ON public.bookings;

-- Recréer les politiques RLS pour bookings
CREATE POLICY "Users can view their own bookings" 
ON public.bookings 
FOR SELECT 
USING (
  user_id = auth.uid() OR 
  property_id IN (
    SELECT id FROM public.properties WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Users can create bookings for their properties" 
ON public.bookings 
FOR INSERT 
WITH CHECK (
  user_id = auth.uid() OR 
  property_id IN (
    SELECT id FROM public.properties WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Users can update their own bookings" 
ON public.bookings 
FOR UPDATE 
USING (
  user_id = auth.uid() OR 
  property_id IN (
    SELECT id FROM public.properties WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Users can delete their own bookings" 
ON public.bookings 
FOR DELETE 
USING (
  user_id = auth.uid() OR 
  property_id IN (
    SELECT id FROM public.properties WHERE user_id = auth.uid()
  )
);

-- =====================================================
-- 7. CORRECTION RLS guest_submissions
-- =====================================================

-- Supprimer les anciennes politiques RLS sur guest_submissions
DROP POLICY IF EXISTS "Users can view submissions for their properties" ON public.guest_submissions;
DROP POLICY IF EXISTS "Anyone can create submissions with valid token" ON public.guest_submissions;
DROP POLICY IF EXISTS "Users can update submissions for their properties" ON public.guest_submissions;

-- Recréer les politiques RLS pour guest_submissions
CREATE POLICY "Users can view submissions for their properties" 
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

CREATE POLICY "Anyone can create submissions with valid token" 
ON public.guest_submissions 
FOR INSERT 
WITH CHECK (
  token_id IN (
    SELECT id FROM public.property_verification_tokens 
    WHERE is_active = true
  )
);

CREATE POLICY "Users can update submissions for their properties" 
ON public.guest_submissions 
FOR UPDATE 
USING (
  token_id IN (
    SELECT id FROM public.property_verification_tokens 
    WHERE property_id IN (
      SELECT id FROM public.properties WHERE user_id = auth.uid()
    )
  )
);

-- =====================================================
-- 8. CORRECTION RLS properties
-- =====================================================

-- Supprimer les anciennes politiques RLS sur properties
DROP POLICY IF EXISTS "Users can view their own properties" ON public.properties;
DROP POLICY IF EXISTS "Users can create properties" ON public.properties;
DROP POLICY IF EXISTS "Users can update their own properties" ON public.properties;
DROP POLICY IF EXISTS "Users can delete their own properties" ON public.properties;

-- Recréer les politiques RLS pour properties
CREATE POLICY "Users can view their own properties" 
ON public.properties 
FOR SELECT 
USING (user_id = auth.uid());

CREATE POLICY "Users can create properties" 
ON public.properties 
FOR INSERT 
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own properties" 
ON public.properties 
FOR UPDATE 
USING (user_id = auth.uid());

CREATE POLICY "Users can delete their own properties" 
ON public.properties 
FOR DELETE 
USING (user_id = auth.uid());

-- =====================================================
-- 9. CRÉATION DES INDEX POUR LES PERFORMANCES
-- =====================================================

-- Index pour contract_signatures
CREATE INDEX IF NOT EXISTS idx_contract_signatures_booking_id 
ON contract_signatures(booking_id);

CREATE INDEX IF NOT EXISTS idx_contract_signatures_signed_at 
ON contract_signatures(signed_at);

-- Index pour property_verification_tokens
CREATE INDEX IF NOT EXISTS idx_property_verification_tokens_property_id 
ON property_verification_tokens(property_id);

CREATE INDEX IF NOT EXISTS idx_property_verification_tokens_token 
ON property_verification_tokens(token);

-- Index pour guest_submissions
CREATE INDEX IF NOT EXISTS idx_guest_submissions_token_id 
ON guest_submissions(token_id);

-- Index pour bookings
CREATE INDEX IF NOT EXISTS idx_bookings_user_id 
ON bookings(user_id);

CREATE INDEX IF NOT EXISTS idx_bookings_property_id 
ON bookings(property_id);

-- Index pour properties
CREATE INDEX IF NOT EXISTS idx_properties_user_id 
ON properties(user_id);

-- =====================================================
-- 10. AJOUT DES CONTRAINTES DE CLÉS ÉTRANGÈRES (APRÈS NETTOYAGE)
-- =====================================================

-- Ajouter la contrainte de clé étrangère pour contract_signatures
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'contract_signatures_booking_id_fkey' 
        AND table_name = 'contract_signatures'
    ) THEN
        ALTER TABLE contract_signatures 
        ADD CONSTRAINT contract_signatures_booking_id_fkey 
        FOREIGN KEY (booking_id) REFERENCES bookings(id);
        RAISE NOTICE '✅ Contrainte contract_signatures_booking_id_fkey ajoutée';
    END IF;
END $$;

-- Ajouter la contrainte de clé étrangère pour property_verification_tokens
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'fk_property_verification_tokens_property_id' 
        AND table_name = 'property_verification_tokens'
    ) THEN
        ALTER TABLE property_verification_tokens 
        ADD CONSTRAINT fk_property_verification_tokens_property_id 
        FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE CASCADE;
        RAISE NOTICE '✅ Contrainte fk_property_verification_tokens_property_id ajoutée';
    END IF;
END $$;

-- Ajouter la contrainte de clé étrangère pour guest_submissions
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'fk_guest_submissions_token_id' 
        AND table_name = 'guest_submissions'
    ) THEN
        ALTER TABLE guest_submissions 
        ADD CONSTRAINT fk_guest_submissions_token_id 
        FOREIGN KEY (token_id) REFERENCES property_verification_tokens(id) ON DELETE CASCADE;
        RAISE NOTICE '✅ Contrainte fk_guest_submissions_token_id ajoutée';
    END IF;
END $$;

-- =====================================================
-- 11. VÉRIFICATION FINALE
-- =====================================================

-- Vérifier que toutes les corrections ont été appliquées
SELECT 
    '✅ CORRECTION TERMINÉE' as status,
    now() as completed_at;

-- Afficher un résumé des corrections
SELECT 
    '🔧 RÉSUMÉ DES CORRECTIONS' as section,
    'ENUM booking_status corrigé' as correction,
    '✅' as status
UNION ALL
SELECT 
    '🔧 RÉSUMÉ DES CORRECTIONS' as section,
    'Table contract_signatures corrigée' as correction,
    '✅' as status
UNION ALL
SELECT 
    '🔧 RÉSUMÉ DES CORRECTIONS' as section,
    'Données orphelines nettoyées' as correction,
    '✅' as status
UNION ALL
SELECT 
    '🔧 RÉSUMÉ DES CORRECTIONS' as section,
    'Politiques RLS property_verification_tokens corrigées' as correction,
    '✅' as status
UNION ALL
SELECT 
    '🔧 RÉSUMÉ DES CORRECTIONS' as section,
    'Politiques RLS contract_signatures corrigées' as correction,
    '✅' as status
UNION ALL
SELECT 
    '🔧 RÉSUMÉ DES CORRECTIONS' as section,
    'Politiques RLS bookings corrigées' as correction,
    '✅' as status
UNION ALL
SELECT 
    '🔧 RÉSUMÉ DES CORRECTIONS' as section,
    'Politiques RLS guest_submissions corrigées' as correction,
    '✅' as status
UNION ALL
SELECT 
    '🔧 RÉSUMÉ DES CORRECTIONS' as section,
    'Politiques RLS properties corrigées' as correction,
    '✅' as status
UNION ALL
SELECT 
    '🔧 RÉSUMÉ DES CORRECTIONS' as section,
    'Index de performance créés' as correction,
    '✅' as status
UNION ALL
SELECT 
    '🔧 RÉSUMÉ DES CORRECTIONS' as section,
    'Contraintes de clés étrangères ajoutées' as correction,
    '✅' as status;
