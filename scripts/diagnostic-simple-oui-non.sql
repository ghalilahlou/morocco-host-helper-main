-- =====================================
-- DIAGNOSTIC SIMPLE : OUI/NON
-- Vérification existance des éléments attendus par l'app
-- =====================================

-- ===========================================
-- 1. COLONNES CRITIQUES : EXISTE OUI/NON ?
-- ===========================================

-- Vérifier admin_users.role (AdminContext ligne 44)
SELECT 
    'admin_users.role' as element_attendu,
    CASE WHEN EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'admin_users' AND column_name = 'role'
    ) THEN '✅ OUI' ELSE '❌ NON' END as existe;

-- Vérifier admin_users.is_active (AdminContext ligne 44)
SELECT 
    'admin_users.is_active' as element_attendu,
    CASE WHEN EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'admin_users' AND column_name = 'is_active'
    ) THEN '✅ OUI' ELSE '❌ NON' END as existe;

-- Vérifier properties.user_id (AdminContext ligne 80, AdminUsers ligne 68)
SELECT 
    'properties.user_id' as element_attendu,
    CASE WHEN EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'properties' AND column_name = 'user_id'
    ) THEN '✅ OUI' ELSE '❌ NON' END as existe;

-- Vérifier properties.name (AdminContext ligne 81, AdminUsers ligne 70)
SELECT 
    'properties.name' as element_attendu,
    CASE WHEN EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'properties' AND column_name = 'name'
    ) THEN '✅ OUI' ELSE '❌ NON' END as existe;

-- Vérifier bookings.property_id (AdminContext ligne 81, AdminUsers ligne 79)
SELECT 
    'bookings.property_id' as element_attendu,
    CASE WHEN EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'bookings' AND column_name = 'property_id'
    ) THEN '✅ OUI' ELSE '❌ NON' END as existe;

-- Vérifier bookings.status (useAdmin ligne 135-137)
SELECT 
    'bookings.status' as element_attendu,
    CASE WHEN EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'bookings' AND column_name = 'status'
    ) THEN '✅ OUI' ELSE '❌ NON' END as existe;

-- Vérifier bookings.total_amount (AdminContext ligne 92)
SELECT 
    'bookings.total_amount' as element_attendu,
    CASE WHEN EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'bookings' AND column_name = 'total_amount'
    ) THEN '✅ OUI' ELSE '❌ NON' END as existe;

-- Vérifier token_allocations.tokens_remaining (useAdmin ligne 138)
SELECT 
    'token_allocations.tokens_remaining' as element_attendu,
    CASE WHEN EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'token_allocations' AND column_name = 'tokens_remaining'
    ) THEN '✅ OUI' ELSE '❌ NON' END as existe;

-- Vérifier token_allocations.is_active (useAdmin ligne 138)
SELECT 
    'token_allocations.is_active' as element_attendu,
    CASE WHEN EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'token_allocations' AND column_name = 'is_active'
    ) THEN '✅ OUI' ELSE '❌ NON' END as existe;

-- ===========================================
-- 2. TABLES CRITIQUES : EXISTE OUI/NON ?
-- ===========================================

-- Table admin_users
SELECT 
    'Table: admin_users' as element_attendu,
    CASE WHEN EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_name = 'admin_users'
    ) THEN '✅ OUI' ELSE '❌ NON' END as existe;

-- Table properties
SELECT 
    'Table: properties' as element_attendu,
    CASE WHEN EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_name = 'properties'
    ) THEN '✅ OUI' ELSE '❌ NON' END as existe;

-- Table bookings
SELECT 
    'Table: bookings' as element_attendu,
    CASE WHEN EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_name = 'bookings'
    ) THEN '✅ OUI' ELSE '❌ NON' END as existe;

-- Table token_allocations
SELECT 
    'Table: token_allocations' as element_attendu,
    CASE WHEN EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_name = 'token_allocations'
    ) THEN '✅ OUI' ELSE '❌ NON' END as existe;

-- Table host_profiles
SELECT 
    'Table: host_profiles' as element_attendu,
    CASE WHEN EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_name = 'host_profiles'
    ) THEN '✅ OUI' ELSE '❌ NON' END as existe;

-- ===========================================
-- 3. VALEURS STATUS : EXISTE OUI/NON ?
-- ===========================================

-- Status 'pending'
SELECT 
    'Status: pending' as element_attendu,
    CASE WHEN EXISTS (
        SELECT 1 FROM bookings WHERE status = 'pending'
    ) THEN '✅ OUI' ELSE '❌ NON' END as existe;

-- Status 'completed'
SELECT 
    'Status: completed' as element_attendu,
    CASE WHEN EXISTS (
        SELECT 1 FROM bookings WHERE status = 'completed'
    ) THEN '✅ OUI' ELSE '❌ NON' END as existe;

-- Status 'archived'
SELECT 
    'Status: archived' as element_attendu,
    CASE WHEN EXISTS (
        SELECT 1 FROM bookings WHERE status = 'archived'
    ) THEN '✅ OUI' ELSE '❌ NON' END as existe;

-- Status 'cancelled'
SELECT 
    'Status: cancelled' as element_attendu,
    CASE WHEN EXISTS (
        SELECT 1 FROM bookings WHERE status = 'cancelled'
    ) THEN '✅ OUI' ELSE '❌ NON' END as existe;

-- ===========================================
-- 4. DONNÉES MINIMUM : EXISTE OUI/NON ?
-- ===========================================

-- Au moins 1 utilisateur
SELECT 
    'Données: Au moins 1 user' as element_attendu,
    CASE WHEN (SELECT count(*) FROM auth.users) > 0 
    THEN '✅ OUI (' || (SELECT count(*) FROM auth.users) || ')'
    ELSE '❌ NON (0)' END as existe;

-- Au moins 1 propriété
SELECT 
    'Données: Au moins 1 property' as element_attendu,
    CASE WHEN (SELECT count(*) FROM properties) > 0 
    THEN '✅ OUI (' || (SELECT count(*) FROM properties) || ')'
    ELSE '❌ NON (0)' END as existe;

-- Au moins 1 booking
SELECT 
    'Données: Au moins 1 booking' as element_attendu,
    CASE WHEN (SELECT count(*) FROM bookings) > 0 
    THEN '✅ OUI (' || (SELECT count(*) FROM bookings) || ')'
    ELSE '❌ NON (0)' END as existe;

-- Au moins 1 admin
SELECT 
    'Données: Au moins 1 admin' as element_attendu,
    CASE WHEN (SELECT count(*) FROM admin_users) > 0 
    THEN '✅ OUI (' || (SELECT count(*) FROM admin_users) || ')'
    ELSE '❌ NON (0)' END as existe;

-- Au moins 1 propriétaire
SELECT 
    'Données: Au moins 1 propriétaire' as element_attendu,
    CASE WHEN (SELECT count(DISTINCT user_id) FROM properties WHERE user_id IS NOT NULL) > 0 
    THEN '✅ OUI (' || (SELECT count(DISTINCT user_id) FROM properties WHERE user_id IS NOT NULL) || ')'
    ELSE '❌ NON (0)' END as existe;

-- ===========================================
-- 5. FONCTIONS/VUES : EXISTE OUI/NON ?
-- ===========================================

-- Vue profiles (AdminContext ligne 79)
SELECT 
    'Vue: profiles' as element_attendu,
    CASE WHEN EXISTS (
        SELECT 1 FROM information_schema.views 
        WHERE table_name = 'profiles'
    ) THEN '✅ OUI' ELSE '❌ NON' END as existe;

-- Fonction get_users_for_admin (AdminContext ligne 79)
SELECT 
    'Fonction: get_users_for_admin' as element_attendu,
    CASE WHEN EXISTS (
        SELECT 1 FROM information_schema.routines 
        WHERE routine_name = 'get_users_for_admin'
    ) THEN '✅ OUI' ELSE '❌ NON' END as existe;

-- ===========================================
-- 6. RÉSUMÉ FINAL
-- ===========================================
SELECT 
    'RÉSUMÉ' as element_attendu,
    CASE 
        WHEN NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'bookings' AND column_name = 'total_amount')
        THEN '❌ BLOQUANT: bookings.total_amount manquant'
        WHEN NOT EXISTS (SELECT 1 FROM information_schema.views WHERE table_name = 'profiles') 
             AND NOT EXISTS (SELECT 1 FROM information_schema.routines WHERE routine_name = 'get_users_for_admin')
        THEN '❌ BLOQUANT: profiles OU get_users_for_admin manquant'
        WHEN (SELECT count(*) FROM admin_users) = 0
        THEN '⚠️ ATTENTION: Aucun admin configuré'
        WHEN (SELECT count(*) FROM properties) = 0
        THEN '⚠️ ATTENTION: Aucune propriété'
        ELSE '✅ STRUCTURE OK - Interface peut fonctionner'
    END as diagnostic;
