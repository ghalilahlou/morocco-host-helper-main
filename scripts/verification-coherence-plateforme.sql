-- =====================================
-- SCRIPT DE VÉRIFICATION DE COHÉRENCE 
-- Morocco Host Helper Platform
-- =====================================

-- 1. VÉRIFICATION DES UTILISATEURS AUTH vs PROFILES
-- =====================================
SELECT 
    '1. Utilisateurs Auth vs Profiles' as verification_type,
    count(*) as total_issues,
    'Utilisateurs auth.users sans profil correspondant' as description
FROM auth.users au
WHERE NOT EXISTS (
    SELECT 1 FROM profiles p WHERE p.id = au.id
);

-- 2. VÉRIFICATION PROPRIÉTÉS ORPHELINES
-- =====================================
SELECT 
    '2. Propriétés Orphelines' as verification_type,
    count(*) as total_issues,
    'Propriétés sans propriétaire valide' as description
FROM properties p
WHERE p.user_id IS NULL 
   OR NOT EXISTS (
    SELECT 1 FROM auth.users au WHERE au.id = p.user_id
);

-- 3. VÉRIFICATION RÉSERVATIONS ORPHELINES
-- =====================================
SELECT 
    '3. Réservations Orphelines' as verification_type,
    count(*) as total_issues,
    'Réservations sans propriété valide' as description
FROM bookings b
WHERE b.property_id IS NULL 
   OR NOT EXISTS (
    SELECT 1 FROM properties p WHERE p.id = b.property_id
);

-- 4. DÉTAIL DES UTILISATEURS PAR TYPE
-- =====================================
WITH user_stats AS (
  SELECT 
    au.id,
    au.email,
    au.created_at,
    au.last_sign_in_at,
    (SELECT count(*) FROM properties p WHERE p.user_id = au.id) as properties_count,
    (SELECT count(*) FROM bookings b 
     JOIN properties p ON b.property_id = p.id 
     WHERE p.user_id = au.id) as bookings_received,
    (SELECT role FROM admin_users adm WHERE adm.user_id = au.id) as admin_role
  FROM auth.users au
)
SELECT 
    '4. Résumé Utilisateurs' as verification_type,
    'Propriétaires: ' || count(*) FILTER (WHERE properties_count > 0) as proprietaires,
    'Clients simples: ' || count(*) FILTER (WHERE properties_count = 0 AND admin_role IS NULL) as clients,
    'Admins: ' || count(*) FILTER (WHERE admin_role IS NOT NULL) as admins,
    'Total utilisateurs: ' || count(*) as total
FROM user_stats;

-- 5. VÉRIFICATION INTÉGRITÉ RÉFÉRENTIELLE
-- =====================================
-- Properties avec user_id invalide
SELECT 
    '5a. Properties - user_id invalide' as verification_type,
    p.id as property_id,
    p.name as property_name,
    p.user_id as invalid_user_id,
    'Propriété référençant utilisateur inexistant' as issue
FROM properties p
WHERE p.user_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM auth.users au WHERE au.id = p.user_id)
LIMIT 10;

-- Bookings avec property_id invalide  
SELECT 
    '5b. Bookings - property_id invalide' as verification_type,
    b.id as booking_id,
    b.booking_reference,
    b.property_id as invalid_property_id,
    'Réservation référençant propriété inexistante' as issue
FROM bookings b
WHERE b.property_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM properties p WHERE p.id = b.property_id)
LIMIT 10;

-- 6. GUESTS ORPHELINS
-- =====================================
SELECT 
    '6. Guests Orphelins' as verification_type,
    g.id as guest_id,
    g.full_name,
    g.booking_id as invalid_booking_id,
    'Guest référençant réservation inexistante' as issue
FROM guests g
WHERE g.booking_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM bookings b WHERE b.id = g.booking_id)
LIMIT 10;

-- 7. ADMIN_USERS avec user_id invalide
-- =====================================
SELECT 
    '7. Admin Users - user_id invalide' as verification_type,
    adm.id as admin_id,
    adm.email,
    adm.user_id as invalid_user_id,
    'Admin référençant utilisateur inexistant' as issue
FROM admin_users adm
WHERE adm.user_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM auth.users au WHERE au.id = adm.user_id)
LIMIT 10;

-- 8. STATISTIQUES GÉNÉRALES PAR TABLE
-- =====================================
SELECT 
    '8. Statistiques Tables' as verification_type,
    'auth.users: ' || (SELECT count(*) FROM auth.users) as users_count,
    'profiles: ' || (SELECT count(*) FROM profiles) as profiles_count,
    'properties: ' || (SELECT count(*) FROM properties) as properties_count,
    'bookings: ' || (SELECT count(*) FROM bookings) as bookings_count,
    'guests: ' || (SELECT count(*) FROM guests) as guests_count,
    'admin_users: ' || (SELECT count(*) FROM admin_users) as admin_users_count;

-- 9. VÉRIFICATION DONNÉES NULLES CRITIQUES
-- =====================================
-- Propriétés avec données manquantes
SELECT 
    '9a. Properties - Données manquantes' as verification_type,
    count(*) FILTER (WHERE name IS NULL OR name = '') as properties_sans_nom,
    count(*) FILTER (WHERE user_id IS NULL) as properties_sans_proprietaire,
    count(*) FILTER (WHERE created_at IS NULL) as properties_sans_date,
    count(*) as total_properties
FROM properties;

-- Bookings avec données manquantes
SELECT 
    '9b. Bookings - Données manquantes' as verification_type,
    count(*) FILTER (WHERE check_in_date IS NULL) as bookings_sans_checkin,
    count(*) FILTER (WHERE check_out_date IS NULL) as bookings_sans_checkout,
    count(*) FILTER (WHERE property_id IS NULL) as bookings_sans_propriete,
    count(*) FILTER (WHERE number_of_guests IS NULL OR number_of_guests <= 0) as bookings_guests_invalide,
    count(*) as total_bookings
FROM bookings;

-- 10. DÉTECTION DOUBLONS
-- =====================================
-- Propriétés avec même nom et même propriétaire
SELECT 
    '10a. Doublons Propriétés' as verification_type,
    user_id,
    name,
    count(*) as nombre_doublons,
    'Propriétés en doublon pour même utilisateur' as issue
FROM properties
WHERE name IS NOT NULL AND user_id IS NOT NULL
GROUP BY user_id, name
HAVING count(*) > 1;

-- Admin users en doublon
SELECT 
    '10b. Doublons Admin Users' as verification_type,
    user_id,
    count(*) as nombre_doublons,
    'Plusieurs entrées admin pour même utilisateur' as issue
FROM admin_users
GROUP BY user_id
HAVING count(*) > 1;

-- 11. VÉRIFICATION DATES COHÉRENTES
-- =====================================
-- Bookings avec dates incohérentes
SELECT 
    '11. Dates Incohérentes' as verification_type,
    b.id as booking_id,
    b.booking_reference,
    b.check_in_date,
    b.check_out_date,
    'Check-out avant check-in' as issue
FROM bookings b
WHERE b.check_in_date IS NOT NULL 
  AND b.check_out_date IS NOT NULL
  AND b.check_out_date <= b.check_in_date;

-- 12. RÉSUMÉ FINAL - SANITÉ GLOBALE
-- =====================================
WITH health_check AS (
  SELECT 
    -- Comptage des problèmes détectés
    (SELECT count(*) FROM auth.users au WHERE NOT EXISTS (SELECT 1 FROM profiles p WHERE p.id = au.id)) +
    (SELECT count(*) FROM properties p WHERE p.user_id IS NULL OR NOT EXISTS (SELECT 1 FROM auth.users au WHERE au.id = p.user_id)) +
    (SELECT count(*) FROM bookings b WHERE b.property_id IS NULL OR NOT EXISTS (SELECT 1 FROM properties p WHERE p.id = b.property_id)) +
    (SELECT count(*) FROM guests g WHERE g.booking_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM bookings b WHERE b.id = g.booking_id)) +
    (SELECT count(*) FROM admin_users adm WHERE adm.user_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM auth.users au WHERE au.id = adm.user_id))
    as total_issues
)
SELECT 
    '12. SANITÉ GLOBALE' as verification_type,
    CASE 
        WHEN total_issues = 0 THEN '✅ BASE DE DONNÉES COHÉRENTE'
        WHEN total_issues < 5 THEN '⚠️ PROBLÈMES MINEURS DÉTECTÉS (' || total_issues || ')'
        ELSE '❌ PROBLÈMES MAJEURS DÉTECTÉS (' || total_issues || ')'
    END as status,
    total_issues as nombre_problemes,
    'Analyse terminée' as conclusion
FROM health_check;

-- 13. SUGGESTION DE NETTOYAGE (OPTIONNEL - À EXÉCUTER AVEC PRÉCAUTION)
-- =====================================
/*
-- ⚠️ COMMANDES DE NETTOYAGE - À EXÉCUTER UNIQUEMENT SI NÉCESSAIRE
-- NE PAS DÉCOMMENTER SANS VÉRIFICATION MANUELLE

-- Supprimer propriétés orphelines
-- DELETE FROM properties WHERE user_id IS NULL OR NOT EXISTS (SELECT 1 FROM auth.users au WHERE au.id = user_id);

-- Supprimer bookings orphelins  
-- DELETE FROM bookings WHERE property_id IS NULL OR NOT EXISTS (SELECT 1 FROM properties p WHERE p.id = property_id);

-- Supprimer guests orphelins
-- DELETE FROM guests WHERE booking_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM bookings b WHERE b.id = booking_id);

-- Supprimer admin_users orphelins
-- DELETE FROM admin_users WHERE user_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM auth.users au WHERE au.id = user_id);
*/
