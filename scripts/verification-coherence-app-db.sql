-- =====================================
-- VÉRIFICATION COHÉRENCE APPLICATION ↔ BASE DE DONNÉES
-- Morocco Host Helper Platform
-- =====================================

-- ===========================================
-- 1. STRUCTURE DES TABLES UTILISÉES PAR L'APP
-- ===========================================

-- 1a. Table admin_users (utilisée dans AdminContext ligne 42-46)
SELECT 'ADMIN_USERS Structure' as verification,
       column_name,
       data_type,
       is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'admin_users'
ORDER BY ordinal_position;

-- 1b. Table properties (utilisée dans AdminContext ligne 80, AdminUsers ligne 68-70)
SELECT 'PROPERTIES Structure' as verification,
       column_name,
       data_type,
       is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'properties'
AND column_name IN ('id', 'user_id', 'name', 'created_at', 'updated_at')
ORDER BY ordinal_position;

-- 1c. Table bookings (utilisée dans AdminContext ligne 81, AdminUsers ligne 77-79)
SELECT 'BOOKINGS Structure' as verification,
       column_name,
       data_type,
       is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'bookings'
AND column_name IN ('id', 'property_id', 'status', 'created_at', 'total_amount')
ORDER BY ordinal_position;

-- ===========================================
-- 2. VALEURS ENUM STATUS (APP ATTEND: pending, completed, archived, cancelled)
-- ===========================================

-- Vérifier les valeurs de status réellement présentes
SELECT 'STATUS VALUES' as verification,
       status,
       count(*) as nb_bookings
FROM bookings
GROUP BY status
ORDER BY count(*) DESC;

-- Vérifier si l'enum booking_status existe
SELECT 'ENUM booking_status' as verification,
       enumlabel as status_value
FROM pg_enum 
JOIN pg_type ON pg_enum.enumtypid = pg_type.oid 
WHERE pg_type.typname = 'booking_status'
ORDER BY enumlabel;

-- ===========================================
-- 3. DONNÉES ATTENDUES PAR ADMINCONTEXT
-- ===========================================

-- 3a. Test de la requête properties (ligne 80 AdminContext)
SELECT 'TEST properties.*' as verification,
       count(*) as total_properties,
       count(DISTINCT user_id) as owners_count,
       string_agg(DISTINCT name, ' | ') as sample_names
FROM properties
LIMIT 1;

-- 3b. Test de la requête bookings avec properties(name) (ligne 81 AdminContext)
SELECT 'TEST bookings + properties(name)' as verification,
       b.id,
       b.status,
       b.created_at,
       p.name as property_name,
       b.total_amount
FROM bookings b
LEFT JOIN properties p ON p.id = b.property_id
ORDER BY b.created_at DESC
LIMIT 3;

-- ===========================================
-- 4. DONNÉES ATTENDUES PAR ADMINUSERS COMPONENT
-- ===========================================

-- 4a. Test propriétés par utilisateur (ligne 68-70 AdminUsers)
SELECT 'TEST properties by user' as verification,
       user_id,
       count(id) as nb_properties,
       string_agg(name, ', ') as property_names
FROM properties
WHERE user_id IS NOT NULL
GROUP BY user_id
ORDER BY count(id) DESC
LIMIT 3;

-- 4b. Test bookings avec join properties(user_id) (ligne 77-79 AdminUsers)
SELECT 'TEST bookings + properties!inner(user_id)' as verification,
       b.property_id,
       b.created_at,
       p.user_id
FROM bookings b
INNER JOIN properties p ON p.id = b.property_id
WHERE p.user_id IS NOT NULL
ORDER BY b.created_at DESC
LIMIT 3;

-- ===========================================
-- 5. FONCTIONS EDGE UTILISÉES PAR L'APP
-- ===========================================

-- Vérifier si edge function 'get-all-users' existe (ligne 57 AdminUsers)
SELECT 'EDGE FUNCTIONS' as verification,
       routine_name,
       routine_type
FROM information_schema.routines
WHERE routine_schema = 'public'
AND routine_name LIKE '%user%'
ORDER BY routine_name;

-- ===========================================
-- 6. TOKEN_ALLOCATIONS (useAdmin hook ligne 138)
-- ===========================================
SELECT 'TOKEN_ALLOCATIONS' as verification,
       count(*) as total_allocations,
       count(*) FILTER (WHERE is_active = true) as active_allocations,
       sum(tokens_remaining) FILTER (WHERE is_active = true) as total_tokens_remaining
FROM token_allocations;

-- ===========================================
-- 7. CONTRACT_SIGNATURES (utilisée dans app)
-- ===========================================
SELECT 'CONTRACT_SIGNATURES' as verification,
       count(*) as total_signatures,
       count(DISTINCT booking_id) as bookings_with_signature
FROM contract_signatures;

-- ===========================================
-- 8. DONNÉES STATISTIQUES RÉELLES POUR DASHBOARD
-- ===========================================
SELECT 'DASHBOARD STATS RÉELLES' as verification,
       (SELECT count(*) FROM auth.users) as total_users,
       (SELECT count(*) FROM properties) as total_properties,
       (SELECT count(*) FROM bookings) as total_bookings,
       (SELECT count(*) FROM bookings WHERE status = 'pending') as pending_bookings,
       (SELECT count(*) FROM bookings WHERE status = 'completed') as completed_bookings,
       (SELECT count(*) FROM bookings WHERE status = 'archived') as archived_bookings,
       (SELECT count(*) FROM bookings WHERE status = 'cancelled') as cancelled_bookings,
       (SELECT count(DISTINCT user_id) FROM properties WHERE user_id IS NOT NULL) as property_owners;

-- ===========================================
-- 9. EXEMPLES DE DONNÉES POUR INTERFACE ADMIN
-- ===========================================

-- 9a. Utilisateurs propriétaires (pour AdminUsers)
SELECT 'PROPRIETAIRES POUR INTERFACE' as verification,
       au.email,
       count(p.id) as properties_count,
       count(b.id) as total_bookings,
       CASE WHEN count(p.id) > 0 THEN true ELSE false END as is_property_owner,
       max(b.created_at) as last_booking_date,
       COALESCE(adm.role, 'user') as role
FROM auth.users au
LEFT JOIN properties p ON p.user_id = au.id
LEFT JOIN bookings b ON b.property_id = p.id
LEFT JOIN admin_users adm ON adm.user_id = au.id
GROUP BY au.id, au.email, adm.role
ORDER BY count(p.id) DESC, count(b.id) DESC
LIMIT 5;

-- 9b. Bookings récents avec toutes les infos (pour Dashboard)
SELECT 'BOOKINGS RÉCENTS POUR INTERFACE' as verification,
       b.id,
       b.status,
       b.check_in_date,
       b.check_out_date,
       b.created_at,
       b.total_amount,
       p.name as property_name,
       au.email as property_owner_email
FROM bookings b
LEFT JOIN properties p ON p.id = b.property_id
LEFT JOIN auth.users au ON au.id = p.user_id
ORDER BY b.created_at DESC
LIMIT 5;

-- ===========================================
-- 10. PROBLÈMES DE COHÉRENCE DÉTECTÉS
-- ===========================================

-- 10a. Bookings avec status non-standard
SELECT 'PROBLÈMES STATUS' as verification,
       status,
       count(*) as nb_bookings,
       CASE 
         WHEN status NOT IN ('pending', 'completed', 'archived', 'cancelled') 
         THEN '⚠️ Status non-standard détecté'
         ELSE '✅ Status OK'
       END as status_validation
FROM bookings
GROUP BY status;

-- 10b. Propriétés sans user_id
SELECT 'PROBLÈMES PROPRIÉTÉS' as verification,
       count(*) FILTER (WHERE user_id IS NULL) as properties_orphelines,
       count(*) FILTER (WHERE name IS NULL OR name = '') as properties_sans_nom,
       count(*) as total_properties;

-- 10c. Bookings sans property_id
SELECT 'PROBLÈMES BOOKINGS' as verification,
       count(*) FILTER (WHERE property_id IS NULL) as bookings_orphelins,
       count(*) FILTER (WHERE total_amount IS NULL) as bookings_sans_montant,
       count(*) as total_bookings;

-- ===========================================
-- 11. SOLUTION RECOMMANDÉE BASÉE SUR VOS DONNÉES
-- ===========================================
SELECT 'RECOMMANDATION' as verification,
       CASE 
         WHEN (SELECT count(*) FROM bookings WHERE status NOT IN ('pending', 'completed', 'archived', 'cancelled')) > 0
         THEN 'Nettoyer les status non-standard dans bookings'
         WHEN (SELECT count(*) FROM properties WHERE user_id IS NULL) > 0
         THEN 'Assigner des propriétaires aux propriétés orphelines'
         WHEN (SELECT count(*) FROM auth.users) = 0
         THEN 'Aucun utilisateur - Platform vide'
         ELSE 'Données cohérentes - Créer fonctions adaptées'
       END as action_recommandee,
       'AdminContext peut utiliser vos données avec ajustements mineurs' as conclusion;
