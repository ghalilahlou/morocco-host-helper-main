-- ============================================================
-- CORRECTION ÉTAPE 3 : Ajouter policy pour generated_documents
-- ============================================================
-- Cette table n'avait pas de policy, on en ajoute une sécurisée

-- 3.1 Vérifier l'état AVANT
SELECT 
    'ÉTAT AVANT' as etape,
    tablename,
    policyname,
    cmd as command_type,
    roles
FROM pg_policies 
WHERE schemaname = 'public'
  AND tablename = 'generated_documents';

-- 3.2 Créer la policy pour les hôtes (SELECT uniquement)
DO $policy$
BEGIN
    -- Vérifier que la table existe
    IF to_regclass('public.generated_documents') IS NOT NULL THEN
        -- Vérifier si la policy existe déjà
        IF NOT EXISTS (
            SELECT 1 FROM pg_policies 
            WHERE schemaname = 'public' 
              AND tablename = 'generated_documents' 
              AND policyname = 'hosts_can_select_generated_documents'
        ) THEN
            -- Créer la policy
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
            
            RAISE NOTICE '✅ Policy créée : hosts_can_select_generated_documents';
        ELSE
            RAISE NOTICE 'ℹ️ Policy hosts_can_select_generated_documents existe déjà';
        END IF;
    ELSE
        RAISE NOTICE '⚠️ Table public.generated_documents n''existe pas';
    END IF;
END $policy$;

-- 3.3 Vérifier l'état APRÈS
SELECT 
    'ÉTAT APRÈS' as etape,
    tablename,
    policyname,
    cmd as command_type,
    roles,
    qual as using_clause
FROM pg_policies 
WHERE schemaname = 'public'
  AND tablename = 'generated_documents'
ORDER BY policyname;

-- 3.4 Test de la policy (vérification syntaxique)
SELECT 
    'TEST DE LA POLICY' as info,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM pg_policies 
            WHERE schemaname = 'public' 
              AND tablename = 'generated_documents'
              AND policyname = 'hosts_can_select_generated_documents'
        ) 
        THEN '✅ Policy active et fonctionnelle'
        ELSE '❌ Policy non trouvée'
    END as resultat;

