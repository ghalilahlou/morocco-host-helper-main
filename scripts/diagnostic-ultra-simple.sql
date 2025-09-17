-- =====================================
-- DIAGNOSTIC ULTRA SIMPLE
-- Découvrir les VRAIES valeurs de votre base
-- =====================================

-- 1. QUELLES SONT LES VRAIES VALEURS DE STATUS ?
SELECT 
    'Valeurs status réelles' as info,
    enumlabel as status_value,
    'ENUM booking_status' as type
FROM pg_enum 
JOIN pg_type ON pg_enum.enumtypid = pg_type.oid 
WHERE pg_type.typname = 'booking_status'
ORDER BY enumlabel;

-- 2. QUELS STATUS SONT RÉELLEMENT UTILISÉS ?
SELECT 
    'Status utilisés dans bookings' as info,
    status::text as status_value,
    count(*) as nb_bookings
FROM bookings
GROUP BY status
ORDER BY count(*) DESC;

-- 3. COLONNES CRITIQUES MANQUANTES
SELECT 
    'bookings.total_amount' as colonne,
    CASE WHEN EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'bookings' AND column_name = 'total_amount'
    ) THEN '✅ EXISTE' ELSE '❌ MANQUE' END as status;

-- 4. VUE/FONCTION POUR ADMINCONTEXT
SELECT 
    'profiles (vue)' as element,
    CASE WHEN EXISTS (
        SELECT 1 FROM information_schema.views 
        WHERE table_name = 'profiles'
    ) THEN '✅ EXISTE' ELSE '❌ MANQUE' END as status
UNION ALL
SELECT 
    'get_users_for_admin (fonction)' as element,
    CASE WHEN EXISTS (
        SELECT 1 FROM information_schema.routines 
        WHERE routine_name = 'get_users_for_admin'
    ) THEN '✅ EXISTE' ELSE '❌ MANQUE' END as status;

-- 5. DONNÉES MINIMUM PRÉSENTES
SELECT 
    'Utilisateurs' as donnee,
    count(*) as nb_records,
    CASE WHEN count(*) > 0 THEN '✅ OK' ELSE '❌ VIDE' END as status
FROM auth.users
UNION ALL
SELECT 'Propriétés', count(*), CASE WHEN count(*) > 0 THEN '✅ OK' ELSE '❌ VIDE' END FROM properties
UNION ALL
SELECT 'Bookings', count(*), CASE WHEN count(*) > 0 THEN '✅ OK' ELSE '❌ VIDE' END FROM bookings
UNION ALL
SELECT 'Admins', count(*), CASE WHEN count(*) > 0 THEN '✅ OK' ELSE '❌ VIDE' END FROM admin_users;

-- 6. ÉCHANTILLON DE DONNÉES RÉELLES
SELECT 
    'ÉCHANTILLON bookings' as info,
    id,
    status::text,
    property_id,
    created_at
FROM bookings
ORDER BY created_at DESC
LIMIT 3;

-- 7. ÉCHANTILLON PROPRIÉTAIRES
SELECT 
    'ÉCHANTILLON propriétaires' as info,
    au.email,
    count(p.id) as nb_properties
FROM auth.users au
JOIN properties p ON p.user_id = au.id
GROUP BY au.id, au.email
LIMIT 3;

