-- ============================================================
-- CORRECTION ÉTAPE 1 : Supprimer la vue profiles problématique
-- ============================================================
-- Cette vue expose potentiellement auth.users aux rôles anon/authenticated

-- 1.1 Vérifier d'abord si la vue existe et ses dépendances
SELECT 
    'Vérification avant suppression' as action,
    viewname,
    definition
FROM pg_views 
WHERE schemaname = 'public' 
  AND viewname = 'profiles';

-- 1.2 Lister les objets qui dépendent de cette vue (si elle existe)
SELECT 
    'Dépendances de la vue profiles' as info,
    dependent_ns.nspname as dependent_schema,
    dependent_view.relname as dependent_object,
    pg_describe_object(d.classid, d.objid, d.objsubid) as dependency_type
FROM pg_depend d
JOIN pg_rewrite r ON d.objid = r.oid
JOIN pg_class dependent_view ON r.ev_class = dependent_view.oid
JOIN pg_namespace dependent_ns ON dependent_ns.oid = dependent_view.relnamespace
JOIN pg_class source_view ON d.refobjid = source_view.oid
WHERE source_view.relname = 'profiles'
  AND dependent_ns.nspname = 'public';

-- 1.3 Révoquer les permissions avant de supprimer
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_views 
        WHERE schemaname = 'public' AND viewname = 'profiles'
    ) THEN
        -- Révoquer toutes les permissions
        REVOKE ALL ON public.profiles FROM anon;
        REVOKE ALL ON public.profiles FROM authenticated;
        REVOKE ALL ON public.profiles FROM public;
        
        RAISE NOTICE 'Permissions révoquées sur public.profiles';
    ELSE
        RAISE NOTICE 'La vue public.profiles n''existe pas';
    END IF;
END $$;

-- 1.4 Supprimer la vue (CASCADE supprime aussi les dépendances)
DROP VIEW IF EXISTS public.profiles CASCADE;

-- 1.5 Vérification après suppression
SELECT 
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM pg_views 
            WHERE schemaname = 'public' AND viewname = 'profiles'
        ) 
        THEN '❌ La vue existe encore'
        ELSE '✅ Vue supprimée avec succès'
    END as resultat;

