-- =====================================
-- ANALYSE INTELLIGENTE DES DONNÉES EXISTANTES
-- Morocco Host Helper Platform
-- =====================================

-- ===========================================
-- 1. ANALYSE COMPLÈTE DES DONNÉES RÉELLES
-- ===========================================

-- 1a. Comptage général
SELECT 
    'COMPTAGE GÉNÉRAL' as analyse,
    'auth.users' as table_name,
    count(*) as nb_records
FROM auth.users
UNION ALL
SELECT 'COMPTAGE GÉNÉRAL', 'properties', count(*) FROM properties
UNION ALL
SELECT 'COMPTAGE GÉNÉRAL', 'bookings', count(*) FROM bookings
UNION ALL
SELECT 'COMPTAGE GÉNÉRAL', 'guests', count(*) FROM guests
UNION ALL
SELECT 'COMPTAGE GÉNÉRAL', 'host_profiles', count(*) FROM host_profiles
UNION ALL
SELECT 'COMPTAGE GÉNÉRAL', 'admin_users', count(*) FROM admin_users
UNION ALL
SELECT 'COMPTAGE GÉNÉRAL', 'token_allocations', count(*) FROM token_allocations
ORDER BY nb_records DESC;

-- ===========================================
-- 2. STRUCTURE EXACTE DES TABLES UTILISÉES
-- ===========================================

-- 2a. Structure auth.users
SELECT 
    'STRUCTURE auth.users' as analyse,
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'auth' AND table_name = 'users'
AND column_name IN ('id', 'email', 'created_at', 'updated_at', 'last_sign_in_at', 'email_confirmed_at', 'raw_user_meta_data')
ORDER BY ordinal_position;

-- 2b. Structure host_profiles
SELECT 
    'STRUCTURE host_profiles' as analyse,
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'host_profiles'
ORDER BY ordinal_position;

-- 2c. Structure properties
SELECT 
    'STRUCTURE properties' as analyse,
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'properties'
AND column_name IN ('id', 'name', 'user_id', 'created_at', 'updated_at')
ORDER BY ordinal_position;

-- ===========================================
-- 3. DONNÉES RÉELLES ÉCHANTILLON
-- ===========================================

-- 3a. Échantillon auth.users avec métadonnées
SELECT 
    'ÉCHANTILLON auth.users' as analyse,
    id,
    email,
    created_at,
    last_sign_in_at,
    email_confirmed_at IS NOT NULL as email_confirmed,
    raw_user_meta_data->>'full_name' as metadata_full_name,
    CASE WHEN raw_user_meta_data IS NOT NULL THEN 'Présent' ELSE 'Absent' END as metadata_status
FROM auth.users
ORDER BY created_at DESC
LIMIT 3;

-- 3b. Échantillon host_profiles
SELECT 
    'ÉCHANTILLON host_profiles' as analyse,
    id,
    full_name,
    phone,
    created_at,
    updated_at
FROM host_profiles
ORDER BY created_at DESC
LIMIT 3;

-- 3c. Relations utilisateur-propriétés réelles
SELECT 
    'RELATIONS USER-PROPERTIES' as analyse,
    au.email as user_email,
    au.id as user_id,
    p.id as property_id,
    p.name as property_name,
    p.created_at as property_created
FROM auth.users au
JOIN properties p ON p.user_id = au.id
ORDER BY au.email
LIMIT 5;

-- ===========================================
-- 4. UTILISATEURS PROPRIÉTAIRES DÉTAILLÉS
-- ===========================================
SELECT 
    'PROPRIÉTAIRES DÉTAILLÉS' as analyse,
    au.email,
    au.id as user_id,
    au.created_at as user_created,
    hp.full_name as profile_name,
    count(p.id) as nb_properties,
    string_agg(p.name, ' | ') as property_names,
    max(p.created_at) as derniere_propriete,
    adm.role as admin_role
FROM auth.users au
LEFT JOIN host_profiles hp ON hp.id = au.id
LEFT JOIN properties p ON p.user_id = au.id
LEFT JOIN admin_users adm ON adm.user_id = au.id
WHERE EXISTS (SELECT 1 FROM properties pp WHERE pp.user_id = au.id)
GROUP BY au.id, au.email, au.created_at, hp.full_name, adm.role
ORDER BY count(p.id) DESC;

-- ===========================================
-- 5. ANALYSE BOOKINGS PAR PROPRIÉTAIRE
-- ===========================================
SELECT 
    'BOOKINGS PAR PROPRIÉTAIRE' as analyse,
    au.email as proprietaire_email,
    count(DISTINCT p.id) as nb_properties,
    count(b.id) as nb_bookings,
    min(b.created_at) as premiere_booking,
    max(b.created_at) as derniere_booking,
    string_agg(DISTINCT b.status, ', ') as statuts_bookings
FROM auth.users au
JOIN properties p ON p.user_id = au.id
LEFT JOIN bookings b ON b.property_id = p.id
GROUP BY au.id, au.email
HAVING count(b.id) > 0
ORDER BY count(b.id) DESC
LIMIT 10;

-- ===========================================
-- 6. UTILISATEURS SANS PROPRIÉTÉS (CLIENTS)
-- ===========================================
SELECT 
    'CLIENTS (sans propriétés)' as analyse,
    au.email,
    au.created_at,
    hp.full_name,
    adm.role,
    CASE WHEN adm.role IS NOT NULL THEN 'Admin' ELSE 'Client simple' END as type_user
FROM auth.users au
LEFT JOIN host_profiles hp ON hp.id = au.id
LEFT JOIN admin_users adm ON adm.user_id = au.id
WHERE NOT EXISTS (SELECT 1 FROM properties p WHERE p.user_id = au.id)
ORDER BY au.created_at DESC
LIMIT 5;

-- ===========================================
-- 7. DONNÉES POUR INTERFACE ADMIN
-- ===========================================

-- 7a. Statistiques précises pour dashboard
SELECT 
    'STATS DASHBOARD' as analyse,
    (SELECT count(*) FROM auth.users) as total_users,
    (SELECT count(*) FROM properties) as total_properties,
    (SELECT count(*) FROM bookings) as total_bookings,
    (SELECT count(DISTINCT user_id) FROM properties WHERE user_id IS NOT NULL) as property_owners,
    (SELECT count(*) FROM auth.users WHERE NOT EXISTS (SELECT 1 FROM properties p WHERE p.user_id = auth.users.id)) as clients_only,
    (SELECT count(*) FROM admin_users) as admin_users,
    (SELECT count(*) FROM bookings WHERE status = 'pending') as pending_bookings,
    (SELECT count(*) FROM bookings WHERE status = 'completed') as completed_bookings;

-- 7b. Utilisateurs récents (pour interface admin)
SELECT 
    'UTILISATEURS RÉCENTS' as analyse,
    au.email,
    COALESCE(hp.full_name, au.raw_user_meta_data->>'full_name', au.email) as display_name,
    au.created_at,
    au.last_sign_in_at,
    COUNT(p.id) as properties_count,
    CASE WHEN COUNT(p.id) > 0 THEN 'Propriétaire' ELSE 'Client' END as user_type,
    COALESCE(adm.role, 'user') as role
FROM auth.users au
LEFT JOIN host_profiles hp ON hp.id = au.id
LEFT JOIN properties p ON p.user_id = au.id
LEFT JOIN admin_users adm ON adm.user_id = au.id
GROUP BY au.id, au.email, hp.full_name, au.raw_user_meta_data, au.created_at, au.last_sign_in_at, adm.role
ORDER BY au.created_at DESC
LIMIT 10;

-- ===========================================
-- 8. BOOKINGS RÉCENTES (pour interface admin)
-- ===========================================
SELECT 
    'BOOKINGS RÉCENTES' as analyse,
    b.id,
    b.booking_reference,
    b.status,
    b.check_in_date,
    b.check_out_date,
    b.created_at,
    p.name as property_name,
    au.email as property_owner
FROM bookings b
LEFT JOIN properties p ON p.id = b.property_id
LEFT JOIN auth.users au ON au.id = p.user_id
ORDER BY b.created_at DESC
LIMIT 10;

-- ===========================================
-- 9. DIAGNOSTIC COHÉRENCE
-- ===========================================

-- Propriétés orphelines
SELECT 
    'DIAGNOSTIC orphelins' as analyse,
    'properties_orphelines' as type,
    count(*) as nb_problemes
FROM properties p
WHERE p.user_id IS NULL OR NOT EXISTS (SELECT 1 FROM auth.users au WHERE au.id = p.user_id)
UNION ALL
-- Bookings orphelines
SELECT 'DIAGNOSTIC orphelins', 'bookings_orphelins', count(*)
FROM bookings b
WHERE b.property_id IS NULL OR NOT EXISTS (SELECT 1 FROM properties p WHERE p.id = b.property_id)
UNION ALL
-- Admin users orphelins
SELECT 'DIAGNOSTIC orphelins', 'admin_users_orphelins', count(*)
FROM admin_users adm
WHERE NOT EXISTS (SELECT 1 FROM auth.users au WHERE au.id = adm.user_id);

-- ===========================================
-- 10. RECOMMANDATIONS BASÉES SUR VOS DONNÉES
-- ===========================================
SELECT 
    'RECOMMANDATIONS' as analyse,
    CASE 
        WHEN (SELECT count(*) FROM properties) = 0 THEN 'Aucune propriété - Platform vide'
        WHEN (SELECT count(DISTINCT user_id) FROM properties WHERE user_id IS NOT NULL) = 0 THEN 'Propriétés sans propriétaires'
        WHEN (SELECT count(*) FROM bookings) = 0 THEN 'Aucune réservation - Pas d''activité'
        WHEN (SELECT count(*) FROM admin_users) = 0 THEN 'Aucun admin configuré'
        ELSE 'Données cohérentes - Platform active'
    END as status_platform,
    'Interface admin peut utiliser vos données existantes' as action_recommandee;
