-- ✅ AUDIT COMPLET DE LA SÉPARATION ADMIN/CLIENT
-- Script pour vérifier la cohérence des rôles utilisateur

-- =====================================================
-- 1. VÉRIFIER LES UTILISATEURS AVEC DOUBLE RÔLE
-- =====================================================

-- Utilisateurs qui sont à la fois admins ET ont des propriétés/bookings
SELECT 
    'CONFLIT POTENTIEL : Admin avec données client' as type_conflit,
    au.email as admin_email,
    au.role as admin_role,
    COUNT(DISTINCT p.id) as nb_proprietes,
    COUNT(DISTINCT b.id) as nb_bookings
FROM admin_users au
LEFT JOIN properties p ON p.user_id = au.user_id  
LEFT JOIN bookings b ON b.user_id = au.user_id
WHERE au.is_active = true
GROUP BY au.user_id, au.email, au.role
HAVING COUNT(DISTINCT p.id) > 0 OR COUNT(DISTINCT b.id) > 0;

-- =====================================================
-- 2. ANALYSER LA SÉPARATION DES DONNÉES
-- =====================================================

-- Statistiques générales des rôles
SELECT 
    'Utilisateurs auth.users' as category,
    COUNT(*) as total
FROM auth.users

UNION ALL

SELECT 
    'Admins actifs' as category,
    COUNT(*) as total
FROM admin_users 
WHERE is_active = true

UNION ALL

SELECT 
    'Utilisateurs avec propriétés' as category,
    COUNT(DISTINCT user_id) as total
FROM properties

UNION ALL

SELECT 
    'Utilisateurs avec bookings' as category,
    COUNT(DISTINCT user_id) as total
FROM bookings;

-- =====================================================
-- 3. IDENTIFIER LES ACCÈS PROBLÉMATIQUES
-- =====================================================

-- Admins qui accèdent à leurs propres données client
WITH admin_as_client AS (
    SELECT 
        au.user_id,
        au.email,
        au.role,
        CASE WHEN p.user_id IS NOT NULL THEN 'OUI' ELSE 'NON' END as a_des_proprietes,
        CASE WHEN b.user_id IS NOT NULL THEN 'OUI' ELSE 'NON' END as a_des_bookings
    FROM admin_users au
    LEFT JOIN properties p ON p.user_id = au.user_id
    LEFT JOIN bookings b ON b.user_id = au.user_id
    WHERE au.is_active = true
)
SELECT 
    'ANALYSE SÉPARATION RÔLES' as titre,
    email,
    role,
    a_des_proprietes,
    a_des_bookings,
    CASE 
        WHEN a_des_proprietes = 'OUI' OR a_des_bookings = 'OUI' 
        THEN '⚠️ CONFLIT POTENTIEL'
        ELSE '✅ SÉPARATION OK'
    END as statut_separation
FROM admin_as_client;

-- =====================================================
-- 4. VÉRIFIER LES POLITIQUES RLS
-- =====================================================

-- Politiques qui pourraient créer des conflits
SELECT 
    schemaname,
    tablename,
    policyname,
    cmd,
    CASE 
        WHEN qual LIKE '%auth.uid()%' AND qual LIKE '%admin_users%' 
        THEN '⚠️ POLITIQUE MIXTE'
        ELSE '✅ POLITIQUE CLAIRE'
    END as type_politique
FROM pg_policies 
WHERE schemaname = 'public' 
AND (tablename IN ('properties', 'bookings', 'guests') OR tablename LIKE 'admin_%')
ORDER BY tablename, policyname;

-- =====================================================
-- 5. RECOMMANDATIONS BASÉES SUR L'ANALYSE
-- =====================================================

SELECT 
    'RECOMMANDATIONS' as section,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM admin_users au
            JOIN properties p ON p.user_id = au.user_id
            WHERE au.is_active = true
        ) 
        THEN '🔄 SÉPARER : Créer des comptes admin séparés des comptes client'
        ELSE '✅ SÉPARATION : Admin et client bien séparés'
    END as recommandation_principale,
    
    CASE 
        WHEN (SELECT COUNT(*) FROM admin_users WHERE is_active = true) > 1
        THEN '🛡️ SÉCURITÉ : Plusieurs admins - Vérifier les permissions'
        ELSE '⚠️ SÉCURITÉ : Un seul admin - Risque de point unique de défaillance'
    END as recommandation_securite;

-- =====================================================
-- 6. TEST SPÉCIFIQUE POUR VOTRE COMPTE
-- =====================================================

-- Votre compte spécifiquement
SELECT 
    'VOTRE COMPTE ADMIN' as titre,
    au.email,
    au.role,
    au.is_active,
    COUNT(DISTINCT p.id) as vos_proprietes,
    COUNT(DISTINCT b.id) as vos_bookings,
    CASE 
        WHEN COUNT(DISTINCT p.id) > 0 OR COUNT(DISTINCT b.id) > 0
        THEN '⚠️ VOUS AVEZ DES DONNÉES CLIENT'
        ELSE '✅ COMPTE ADMIN PUR'
    END as statut_compte
FROM admin_users au
LEFT JOIN properties p ON p.user_id = au.user_id
LEFT JOIN bookings b ON b.user_id = au.user_id
WHERE au.email = 'ghalilahlou26@gmail.com'
GROUP BY au.user_id, au.email, au.role, au.is_active;
