-- ============================================================
-- CORRECTION ÉTAPE 2 : Activer RLS sur les tables problématiques
-- ============================================================

-- 2.1 Afficher l'état AVANT correction
SELECT 
    'ÉTAT AVANT CORRECTION' as etape,
    tablename,
    rowsecurity as rls_enabled,
    (SELECT COUNT(*) FROM pg_policies WHERE schemaname = 'public' AND tablename = t.tablename) as nb_policies
FROM pg_tables t
WHERE schemaname = 'public'
  AND tablename IN ('properties', 'guests', 'guest_submissions', 'generated_documents')
ORDER BY tablename;

-- 2.2 Activer RLS sur properties
DO $$
BEGIN
    IF to_regclass('public.properties') IS NOT NULL THEN
        ALTER TABLE public.properties ENABLE ROW LEVEL SECURITY;
        RAISE NOTICE '✅ RLS activé sur public.properties';
    ELSE
        RAISE NOTICE '⚠️ Table public.properties n''existe pas';
    END IF;
END $$;

-- 2.3 Activer RLS sur guests
DO $$
BEGIN
    IF to_regclass('public.guests') IS NOT NULL THEN
        ALTER TABLE public.guests ENABLE ROW LEVEL SECURITY;
        RAISE NOTICE '✅ RLS activé sur public.guests';
    ELSE
        RAISE NOTICE '⚠️ Table public.guests n''existe pas';
    END IF;
END $$;

-- 2.4 Activer RLS sur guest_submissions
DO $$
BEGIN
    IF to_regclass('public.guest_submissions') IS NOT NULL THEN
        ALTER TABLE public.guest_submissions ENABLE ROW LEVEL SECURITY;
        RAISE NOTICE '✅ RLS activé sur public.guest_submissions';
    ELSE
        RAISE NOTICE '⚠️ Table public.guest_submissions n''existe pas';
    END IF;
END $$;

-- 2.5 Activer RLS sur generated_documents
DO $$
BEGIN
    IF to_regclass('public.generated_documents') IS NOT NULL THEN
        ALTER TABLE public.generated_documents ENABLE ROW LEVEL SECURITY;
        RAISE NOTICE '✅ RLS activé sur public.generated_documents';
    ELSE
        RAISE NOTICE '⚠️ Table public.generated_documents n''existe pas';
    END IF;
END $$;

-- 2.6 Afficher l'état APRÈS correction
SELECT 
    'ÉTAT APRÈS CORRECTION' as etape,
    tablename,
    rowsecurity as rls_enabled,
    CASE 
        WHEN rowsecurity THEN '✅ RLS ACTIVÉ'
        ELSE '❌ RLS ENCORE DÉSACTIVÉ'
    END as status,
    (SELECT COUNT(*) FROM pg_policies WHERE schemaname = 'public' AND tablename = t.tablename) as nb_policies
FROM pg_tables t
WHERE schemaname = 'public'
  AND tablename IN ('properties', 'guests', 'guest_submissions', 'generated_documents')
ORDER BY tablename;

