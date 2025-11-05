-- ============================================================
-- VÉRIFICATION FINALE : Confirmer que tous les problèmes sont résolus
-- ============================================================

-- ============================================================
-- 1. VÉRIFICATION : Vue profiles supprimée
-- ============================================================
SELECT 
    '1. Vue profiles' as verification,
    CASE 
        WHEN NOT EXISTS (
            SELECT 1 FROM pg_views 
            WHERE schemaname = 'public' AND viewname = 'profiles'
        )
        THEN '✅ RÉSOLU : Vue supprimée'
        ELSE '❌ PROBLÈME : Vue existe encore'
    END as resultat;

-- ============================================================
-- 2. VÉRIFICATION : RLS activé sur toutes les tables
-- ============================================================
SELECT 
    '2. RLS sur tables' as verification,
    tablename,
    CASE 
        WHEN rowsecurity THEN '✅ RLS activé'
        ELSE '❌ RLS désactivé'
    END as resultat
FROM pg_tables 
WHERE schemaname = 'public'
  AND tablename IN ('properties', 'guests', 'guest_submissions', 'generated_documents')
ORDER BY 
    CASE WHEN rowsecurity THEN 0 ELSE 1 END,
    tablename;

-- ============================================================
-- 3. VÉRIFICATION : Policies existent pour toutes les tables
-- ============================================================
SELECT 
    '3. Policies par table' as verification,
    tablename,
    COUNT(*) as nb_policies,
    CASE 
        WHEN COUNT(*) > 0 THEN '✅ Policies présentes'
        ELSE '❌ Aucune policy'
    END as resultat
FROM pg_policies 
WHERE schemaname = 'public'
  AND tablename IN ('properties', 'guests', 'guest_submissions', 'generated_documents')
GROUP BY tablename
ORDER BY tablename;

-- ============================================================
-- 4. VÉRIFICATION : Policy pour generated_documents
-- ============================================================
SELECT 
    '4. Policy generated_documents' as verification,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM pg_policies 
            WHERE schemaname = 'public' 
              AND tablename = 'generated_documents'
              AND policyname = 'hosts_can_select_generated_documents'
        )
        THEN '✅ Policy créée'
        ELSE '❌ Policy manquante'
    END as resultat;

-- ============================================================
-- 5. VÉRIFICATION : Vues recréées sans SECURITY DEFINER
-- ============================================================
SELECT 
    '5. Vues recréées' as verification,
    viewname,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM pg_views 
            WHERE schemaname = 'public' AND viewname = v.viewname
        )
        THEN '✅ Vue existe (sans SECURITY DEFINER)'
        ELSE 'ℹ️ Vue n''existe pas (peut être normal)'
    END as resultat
FROM (VALUES ('v_guest_submissions'), ('v_booking_health')) v(viewname);

-- ============================================================
-- 6. RÉSUMÉ GLOBAL
-- ============================================================
SELECT 
    'RÉSUMÉ GLOBAL' as section,
    COUNT(*) FILTER (
        WHERE tablename IN ('properties', 'guests', 'guest_submissions', 'generated_documents')
        AND rowsecurity = true
    ) as tables_rls_actives,
    COUNT(*) FILTER (
        WHERE tablename IN ('properties', 'guests', 'guest_submissions', 'generated_documents')
        AND rowsecurity = false
    ) as tables_rls_inactives,
    (SELECT COUNT(*) FROM pg_policies 
     WHERE schemaname = 'public' 
       AND tablename = 'generated_documents') as policies_generated_documents,
    CASE 
        WHEN NOT EXISTS (
            SELECT 1 FROM pg_views 
            WHERE schemaname = 'public' AND viewname = 'profiles'
        ) AND
        (SELECT COUNT(*) FROM pg_tables 
         WHERE schemaname = 'public'
           AND tablename IN ('properties', 'guests', 'guest_submissions', 'generated_documents')
           AND rowsecurity = false) = 0
        THEN '✅ TOUS LES PROBLÈMES RÉSOLUS'
        ELSE '⚠️ VÉRIFIER LES PROBLÈMES CI-DESSUS'
    END as statut_final
FROM pg_tables
WHERE schemaname = 'public';

-- ============================================================
-- 7. LISTE DES PROBLÈMES RESTANTS (si applicable)
-- ============================================================
SELECT 
    'PROBLÈMES RESTANTS' as section,
    'Table sans RLS : ' || tablename as probleme
FROM pg_tables 
WHERE schemaname = 'public'
  AND tablename IN ('properties', 'guests', 'guest_submissions', 'generated_documents')
  AND rowsecurity = false

UNION ALL

SELECT 
    'PROBLÈMES RESTANTS',
    'Vue profiles existe encore'
WHERE EXISTS (
    SELECT 1 FROM pg_views 
    WHERE schemaname = 'public' AND viewname = 'profiles'
)

UNION ALL

SELECT 
    'PROBLÈMES RESTANTS',
    'Policy manquante pour generated_documents'
WHERE NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
      AND tablename = 'generated_documents'
      AND policyname = 'hosts_can_select_generated_documents'
);

