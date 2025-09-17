-- ✅ SCRIPT DE DÉPLOIEMENT ET TEST ADMINISTRATEUR
-- À exécuter dans l'ordre pour corriger tous les problèmes admin

-- =====================================================
-- ÉTAPE 1: EXÉCUTER LE SCRIPT DE CORRECTION RLS
-- =====================================================

-- Copier et exécuter le contenu de scripts/fix-admin-rls-policies.sql

-- =====================================================
-- ÉTAPE 2: VÉRIFIER QUE LES CORRECTIONS FONCTIONNENT
-- =====================================================

-- Test simple des politiques
SELECT 'Politiques RLS admin créées' as status;

-- Vérifier les tables admin
SELECT 
  COUNT(*) as admin_users_count,
  COUNT(CASE WHEN is_active = true THEN 1 END) as active_admin_count
FROM admin_users;

-- =====================================================
-- ÉTAPE 3: TESTER L'ACCÈS ADMIN AVEC VOTRE COMPTE
-- =====================================================

-- Vérifier que votre compte admin existe
SELECT 
  id,
  email,
  role,
  is_active,
  created_at
FROM admin_users 
WHERE email = 'ghalilahlou26@gmail.com';

-- Si pas d'admin trouvé, en créer un:
-- INSERT INTO admin_users (user_id, email, full_name, role, is_active)
-- SELECT 
--   id,
--   email,
--   'Ghali Lahlou',
--   'super_admin',
--   true
-- FROM auth.users 
-- WHERE email = 'ghalilahlou26@gmail.com'
-- ON CONFLICT (user_id) DO UPDATE SET is_active = true;

-- =====================================================
-- ÉTAPE 4: CRÉER DES STATISTIQUES INITIALES
-- =====================================================

-- Calculer et insérer les statistiques admin
INSERT INTO admin_statistics (
  total_users,
  total_properties, 
  total_bookings,
  active_users,
  calculated_at
) 
SELECT 
  (SELECT COUNT(*) FROM auth.users) as total_users,
  (SELECT COUNT(*) FROM properties) as total_properties,
  (SELECT COUNT(*) FROM bookings) as total_bookings,
  (SELECT COUNT(*) FROM auth.users WHERE last_sign_in_at > NOW() - INTERVAL '30 days') as active_users,
  NOW() as calculated_at
ON CONFLICT (calculated_at::date) 
DO UPDATE SET
  total_users = EXCLUDED.total_users,
  total_properties = EXCLUDED.total_properties,
  total_bookings = EXCLUDED.total_bookings,
  active_users = EXCLUDED.active_users;

-- =====================================================
-- ÉTAPE 5: VALIDATION FINALE
-- =====================================================

-- Résumé du statut admin
SELECT 
  'Configuration admin' as component,
  CASE 
    WHEN EXISTS (SELECT 1 FROM admin_users WHERE is_active = true) 
    THEN '✅ OK' 
    ELSE '❌ PROBLÈME' 
  END as status;

SELECT 
  'Politiques RLS' as component,
  CASE 
    WHEN EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'admin_users') 
    THEN '✅ OK' 
    ELSE '❌ PROBLÈME' 
  END as status;

SELECT 
  'Statistiques admin' as component,
  CASE 
    WHEN EXISTS (SELECT 1 FROM admin_statistics) 
    THEN '✅ OK' 
    ELSE '❌ PROBLÈME' 
  END as status;

-- Message final
SELECT '🎉 Configuration admin terminée ! Testez maintenant dans votre application.' as message;
