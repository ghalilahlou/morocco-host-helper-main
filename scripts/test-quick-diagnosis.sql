-- ==========================================
-- DIAGNOSTIC RAPIDE - DÉTECTION INCOHÉRENCES
-- Morocco Host Helper Platform  
-- ==========================================

-- Test ultra-rapide pour identifier immédiatement les problèmes

-- ===========================================
-- 🚨 TESTS CRITIQUES (MUST HAVE)
-- ===========================================

SELECT '🚨 TESTS CRITIQUES' as section;

-- 1. Vue profiles (CRITIQUE pour AdminContext ligne 79)
SELECT 
  '1. Vue profiles' as test,
  CASE 
    WHEN EXISTS (SELECT 1 FROM information_schema.views WHERE table_name = 'profiles') 
    THEN '✅ OK'
    ELSE '❌ MANQUANTE - AdminContext va ÉCHOUER'
  END as status;

-- 2. Fonction get_users_for_admin (CRITIQUE pour AdminContext ligne 79)  
SELECT 
  '2. Fonction get_users_for_admin' as test,
  CASE 
    WHEN EXISTS (SELECT 1 FROM information_schema.routines WHERE routine_name = 'get_users_for_admin') 
    THEN '✅ OK'
    ELSE '❌ MANQUANTE - AdminContext va ÉCHOUER'
  END as status;

-- 3. Colonne total_amount (CRITIQUE pour calcul revenue ligne 92)
SELECT 
  '3. Colonne bookings.total_amount' as test,
  CASE 
    WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'bookings' AND column_name = 'total_amount') 
    THEN '✅ OK'
    ELSE '❌ MANQUANTE - Calcul revenue va ÉCHOUER'
  END as status;

-- ===========================================
-- ⚠️ TESTS IMPORTANTS (SHOULD HAVE)
-- ===========================================

SELECT '⚠️ TESTS IMPORTANTS' as section;

-- 4. Données utilisateurs
SELECT 
  '4. Utilisateurs dans auth.users' as test,
  CASE 
    WHEN (SELECT count(*) FROM auth.users) > 0 
    THEN '✅ OK - ' || (SELECT count(*) FROM auth.users) || ' utilisateurs'
    ELSE '❌ VIDE - Interface sera vide'
  END as status;

-- 5. Données propriétés  
SELECT 
  '5. Propriétés dans properties' as test,
  CASE 
    WHEN (SELECT count(*) FROM properties) > 0 
    THEN '✅ OK - ' || (SELECT count(*) FROM properties) || ' propriétés'
    ELSE '❌ VIDE - Interface sera vide'
  END as status;

-- 6. Relation properties.user_id
SELECT 
  '6. Propriétés avec propriétaires' as test,
  CASE 
    WHEN (SELECT count(*) FROM properties WHERE user_id IS NOT NULL) > 0 
    THEN '✅ OK - ' || (SELECT count(*) FROM properties WHERE user_id IS NOT NULL) || ' propriétés assignées'
    ELSE '❌ AUCUNE - AdminUsers sera dysfonctionnel'
  END as status;

-- ===========================================
-- 📊 TESTS FONCTIONNELS 
-- ===========================================

SELECT '📊 TESTS FONCTIONNELS' as section;

-- 7. Test fonction get_users_for_admin
SELECT 
  '7. Test get_users_for_admin()' as test,
  CASE 
    WHEN public.get_users_for_admin() IS NOT NULL 
    THEN '✅ OK - Retourne ' || json_array_length(public.get_users_for_admin()) || ' utilisateurs'
    ELSE '❌ ÉCHOUE'
  END as status;

-- 8. Test relation bookings -> properties
SELECT 
  '8. Relation bookings -> properties' as test,
  CASE 
    WHEN (SELECT count(*) FROM bookings b JOIN properties p ON p.id = b.property_id) > 0
    THEN '✅ OK - ' || (SELECT count(*) FROM bookings b JOIN properties p ON p.id = b.property_id) || ' liens valides'
    WHEN (SELECT count(*) FROM bookings) = 0
    THEN '⚠️ Aucune réservation'
    ELSE '❌ Liens cassés'
  END as status;

-- ===========================================
-- 🏁 DIAGNOSTIC FINAL
-- ===========================================

SELECT '🏁 DIAGNOSTIC FINAL' as section;

WITH diagnostic AS (
  SELECT 
    -- Tests critiques
    CASE WHEN EXISTS (SELECT 1 FROM information_schema.views WHERE table_name = 'profiles') THEN 1 ELSE 0 END +
    CASE WHEN EXISTS (SELECT 1 FROM information_schema.routines WHERE routine_name = 'get_users_for_admin') THEN 1 ELSE 0 END +
    CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'bookings' AND column_name = 'total_amount') THEN 1 ELSE 0 END as critiques_ok,
    -- Tests importants  
    CASE WHEN (SELECT count(*) FROM auth.users) > 0 THEN 1 ELSE 0 END +
    CASE WHEN (SELECT count(*) FROM properties) > 0 THEN 1 ELSE 0 END +
    CASE WHEN (SELECT count(*) FROM properties WHERE user_id IS NOT NULL) > 0 THEN 1 ELSE 0 END as importants_ok
)
SELECT 
  'État du système' as diagnostic,
  critiques_ok || '/3 critiques OK' as score_critique,
  importants_ok || '/3 importants OK' as score_important,
  CASE 
    WHEN critiques_ok = 3 AND importants_ok >= 2 
    THEN '✅ SYSTÈME OPÉRATIONNEL'
    WHEN critiques_ok = 3 AND importants_ok >= 1
    THEN '⚠️ SYSTÈME FONCTIONNEL (données limitées)'
    WHEN critiques_ok >= 2
    THEN '❌ CORRECTIONS REQUISES'
    ELSE '🚨 CORRECTIONS CRITIQUES REQUISES'
  END as status_global,
  CASE 
    WHEN critiques_ok = 3 AND importants_ok >= 2 
    THEN 'Interface admin prête à utiliser'
    WHEN critiques_ok = 3 AND importants_ok >= 1
    THEN 'Interface admin utilisable mais avec peu de données'
    WHEN critiques_ok >= 2
    THEN 'Exécutez solution-parfaite-finale.sql'
    ELSE 'Exécutez solution-parfaite-finale.sql IMMÉDIATEMENT'
  END as action_recommandee
FROM diagnostic;

-- ===========================================
-- 🔧 SOLUTION RAPIDE SI PROBLÈMES
-- ===========================================

SELECT '🔧 SOLUTION RAPIDE' as section;

SELECT 
  'Si des ❌ ci-dessus' as probleme,
  'Exécutez: scripts/solution-parfaite-finale.sql' as solution,
  'Puis relancez ce diagnostic' as verification;
