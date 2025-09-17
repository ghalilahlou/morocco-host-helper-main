-- =====================================
-- SCRIPT DE VÉRIFICATION DE COHÉRENCE 
-- Morocco Host Helper Platform (CORRIGÉ)
-- =====================================

-- 1. VÉRIFICATION STRUCTURE DES TABLES EXISTANTES
-- =====================================
SELECT 
    '1. Tables Existantes' as verification_type,
    tablename,
    'Vérification existence' as description
FROM pg_tables 
WHERE schemaname = 'public'
ORDER BY tablename;

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
    COALESCE(au.user_metadata->>'full_name', au.email) as display_name,
    (SELECT count(*) FROM properties p WHERE p.user_id = au.id) as properties_count,
    (SELECT count(*) FROM bookings b 
     JOIN properties p ON b.property_id = p.id 
     WHERE p.user_id = au.id) as bookings_received,
    (SELECT role FROM admin_users adm WHERE adm.user_id = au.id) as admin_role
  FROM auth.users au
)
SELECT 
    '4. Résumé Utilisateurs' as verification_type,
    count(*) FILTER (WHERE properties_count > 0) as proprietaires,
    count(*) FILTER (WHERE properties_count = 0 AND admin_role IS NULL) as clients_simples,
    count(*) FILTER (WHERE admin_role IS NOT NULL) as admins,
    count(*) as total_utilisateurs
FROM user_stats;

-- 5. DÉTAIL PROPRIETAIRES ET LEURS PROPRIÉTÉS
-- =====================================
SELECT 
    '5. Détail Propriétaires' as verification_type,
    au.email,
    COALESCE(au.user_metadata->>'full_name', 'Nom non défini') as nom_complet,
    count(p.id) as nombre_proprietes,
    string_agg(p.name, ', ') as noms_proprietes
FROM auth.users au
JOIN properties p ON p.user_id = au.id
GROUP BY au.id, au.email, au.user_metadata->>'full_name'
ORDER BY count(p.id) DESC;

-- 6. VÉRIFICATION INTÉGRITÉ RÉFÉRENTIELLE
-- =====================================
-- Properties avec user_id invalide
SELECT 
    '6a. Properties - user_id invalide' as verification_type,
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
    '6b. Bookings - property_id invalide' as verification_type,
    b.id as booking_id,
    b.booking_reference,
    b.property_id as invalid_property_id,
    'Réservation référençant propriété inexistante' as issue
FROM bookings b
WHERE b.property_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM properties p WHERE p.id = b.property_id)
LIMIT 10;

-- 7. GUESTS ORPHELINS
-- =====================================
SELECT 
    '7. Guests Orphelins' as verification_type,
    count(*) as total_issues,
    'Guests référençant réservation inexistante' as description
FROM guests g
WHERE g.booking_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM bookings b WHERE b.id = g.booking_id);

-- 8. ADMIN_USERS avec user_id invalide
-- =====================================
SELECT 
    '8. Admin Users - user_id invalide' as verification_type,
    adm.id as admin_id,
    adm.email,
    adm.user_id as invalid_user_id,
    'Admin référençant utilisateur inexistant' as issue
FROM admin_users adm
WHERE adm.user_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM auth.users au WHERE au.id = adm.user_id)
LIMIT 10;

-- 9. STATISTIQUES GÉNÉRALES PAR TABLE
-- =====================================
SELECT 
    '9. Statistiques Tables' as verification_type,
    (SELECT count(*) FROM auth.users) as users_auth_count,
    (SELECT count(*) FROM properties) as properties_count,
    (SELECT count(*) FROM bookings) as bookings_count,
    (SELECT count(*) FROM guests) as guests_count,
    (SELECT count(*) FROM admin_users) as admin_users_count;

-- 10. VÉRIFICATION DONNÉES NULLES CRITIQUES
-- =====================================
-- Propriétés avec données manquantes
SELECT 
    '10a. Properties - Données manquantes' as verification_type,
    count(*) FILTER (WHERE name IS NULL OR name = '') as properties_sans_nom,
    count(*) FILTER (WHERE user_id IS NULL) as properties_sans_proprietaire,
    count(*) FILTER (WHERE created_at IS NULL) as properties_sans_date,
    count(*) as total_properties
FROM properties;

-- Bookings avec données manquantes
SELECT 
    '10b. Bookings - Données manquantes' as verification_type,
    count(*) FILTER (WHERE check_in_date IS NULL) as bookings_sans_checkin,
    count(*) FILTER (WHERE check_out_date IS NULL) as bookings_sans_checkout,
    count(*) FILTER (WHERE property_id IS NULL) as bookings_sans_propriete,
    count(*) FILTER (WHERE number_of_guests IS NULL OR number_of_guests <= 0) as bookings_guests_invalide,
    count(*) as total_bookings
FROM bookings;

-- 11. DÉTECTION DOUBLONS
-- =====================================
-- Propriétés avec même nom et même propriétaire
SELECT 
    '11a. Doublons Propriétés' as verification_type,
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
    '11b. Doublons Admin Users' as verification_type,
    user_id,
    count(*) as nombre_doublons,
    'Plusieurs entrées admin pour même utilisateur' as issue
FROM admin_users
GROUP BY user_id
HAVING count(*) > 1;

-- 12. VÉRIFICATION DATES COHÉRENTES
-- =====================================
-- Bookings avec dates incohérentes
SELECT 
    '12. Dates Incohérentes' as verification_type,
    b.id as booking_id,
    b.booking_reference,
    b.check_in_date,
    b.check_out_date,
    'Check-out avant check-in' as issue
FROM bookings b
WHERE b.check_in_date IS NOT NULL 
  AND b.check_out_date IS NOT NULL
  AND b.check_out_date <= b.check_in_date;

-- 13. ACTIVITÉ PAR PROPRIÉTAIRE
-- =====================================
SELECT 
    '13. Activité Propriétaires' as verification_type,
    au.email as proprietaire_email,
    COALESCE(au.user_metadata->>'full_name', au.email) as nom_proprietaire,
    count(DISTINCT p.id) as nombre_proprietes,
    count(DISTINCT b.id) as nombre_reservations,
    COALESCE(max(b.created_at), 'Aucune réservation'::text) as derniere_reservation
FROM auth.users au
LEFT JOIN properties p ON p.user_id = au.id
LEFT JOIN bookings b ON b.property_id = p.id
WHERE EXISTS (SELECT 1 FROM properties pp WHERE pp.user_id = au.id)
GROUP BY au.id, au.email, au.user_metadata->>'full_name'
ORDER BY count(DISTINCT b.id) DESC;

-- 14. UTILISATEURS SANS ACTIVITÉ
-- =====================================
SELECT 
    '14. Utilisateurs Inactifs' as verification_type,
    au.email,
    au.created_at as date_inscription,
    au.last_sign_in_at as derniere_connexion,
    'Utilisateur sans propriété ni activité admin' as statut
FROM auth.users au
WHERE NOT EXISTS (SELECT 1 FROM properties p WHERE p.user_id = au.id)
  AND NOT EXISTS (SELECT 1 FROM admin_users adm WHERE adm.user_id = au.id)
ORDER BY au.created_at DESC
LIMIT 10;

-- 15. RÉSUMÉ FINAL - SANITÉ GLOBALE
-- =====================================
WITH health_check AS (
  SELECT 
    -- Comptage des problèmes détectés
    (SELECT count(*) FROM properties p WHERE p.user_id IS NULL OR NOT EXISTS (SELECT 1 FROM auth.users au WHERE au.id = p.user_id)) +
    (SELECT count(*) FROM bookings b WHERE b.property_id IS NULL OR NOT EXISTS (SELECT 1 FROM properties p WHERE p.id = b.property_id)) +
    (SELECT count(*) FROM guests g WHERE g.booking_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM bookings b WHERE b.id = g.booking_id)) +
    (SELECT count(*) FROM admin_users adm WHERE adm.user_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM auth.users au WHERE au.id = adm.user_id))
    as total_issues,
    (SELECT count(*) FROM auth.users) as total_users,
    (SELECT count(*) FROM properties) as total_properties,
    (SELECT count(*) FROM bookings) as total_bookings
)
SELECT 
    '15. SANITÉ GLOBALE' as verification_type,
    CASE 
        WHEN total_issues = 0 THEN '✅ BASE DE DONNÉES COHÉRENTE'
        WHEN total_issues < 5 THEN '⚠️ PROBLÈMES MINEURS DÉTECTÉS (' || total_issues || ')'
        ELSE '❌ PROBLÈMES MAJEURS DÉTECTÉS (' || total_issues || ')'
    END as status,
    total_issues as nombre_problemes,
    total_users || ' utilisateurs, ' || total_properties || ' propriétés, ' || total_bookings || ' réservations' as resume
FROM health_check;
