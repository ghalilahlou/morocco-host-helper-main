-- ==========================================
-- TEST COHÉRENCE APPLICATION <-> BASE DE DONNÉES
-- Morocco Host Helper Platform
-- ==========================================

-- ===========================================
-- 1. VÉRIFICATIONS AdminContext.tsx (ligne 79-95)
-- ===========================================

SELECT '🔍 TEST AdminContext.tsx' as test_section;

-- Test exact: AdminContext ligne 79
-- const { data: users } = useQuery({
--   queryKey: ['admin-users'],
--   queryFn: () => supabase.rpc('get_users_for_admin')
-- });

SELECT 
  'AdminContext ligne 79 - get_users_for_admin' as test_case,
  CASE 
    WHEN EXISTS (SELECT 1 FROM information_schema.routines WHERE routine_name = 'get_users_for_admin') 
    THEN '✅ Fonction existe'
    ELSE '❌ Fonction manquante - AdminContext va échouer'
  END as function_status,
  CASE 
    WHEN public.get_users_for_admin() IS NOT NULL 
    THEN '✅ Fonction retourne des données: ' || json_array_length(public.get_users_for_admin()) || ' users'
    ELSE '❌ Fonction ne retourne pas de données'
  END as data_status;

-- Test exact: AdminContext ligne 80  
-- const { data: properties } = useQuery({
--   queryKey: ['admin-properties'],
--   queryFn: async () => {
--     const { data, error } = await supabase.from('properties').select('*');

SELECT 
  'AdminContext ligne 80 - properties.*' as test_case,
  count(*) as nb_properties,
  CASE 
    WHEN count(*) > 0 
    THEN '✅ Table properties accessible: ' || count(*) || ' propriétés'
    ELSE '❌ Table properties vide ou inaccessible'
  END as properties_status
FROM properties;

-- Test exact: AdminContext ligne 81
-- const { data: bookings } = useQuery({
--   queryKey: ['admin-bookings'],
--   queryFn: async () => {
--     const { data, error } = await supabase
--       .from('bookings')
--       .select('*, properties(name)');

SELECT 
  'AdminContext ligne 81 - bookings with properties(name)' as test_case,
  count(b.id) as nb_bookings,
  count(p.name) as nb_with_property_name,
  CASE 
    WHEN count(b.id) > 0 
    THEN '✅ Requête bookings + properties fonctionne: ' || count(b.id) || ' réservations'
    ELSE '❌ Aucune réservation ou relation cassée'
  END as booking_relation_status
FROM bookings b
LEFT JOIN properties p ON p.id = b.property_id;

-- Test exact: AdminContext ligne 92 
-- const totalRevenue = bookings?.reduce((sum, booking) => sum + (booking.total_amount || 0), 0) || 0;

SELECT 
  'AdminContext ligne 92 - total_amount calculation' as test_case,
  count(CASE WHEN total_amount IS NOT NULL THEN 1 END) as bookings_with_amount,
  count(CASE WHEN total_amount IS NULL THEN 1 END) as bookings_without_amount,
  COALESCE(sum(total_amount), 0) as total_revenue,
  CASE 
    WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'bookings' AND column_name = 'total_amount')
    THEN '✅ Colonne total_amount existe'
    ELSE '❌ Colonne total_amount manquante - calcul revenue va échouer'
  END as total_amount_status
FROM bookings;

-- ===========================================
-- 2. VÉRIFICATIONS AdminUsers.tsx (ligne 57, 68-70)
-- ===========================================

SELECT '🔍 TEST AdminUsers.tsx' as test_section;

-- Test exact: AdminUsers ligne 57
-- const response = await supabase.functions.invoke('get-all-users');

SELECT 
  'AdminUsers ligne 57 - Edge Function get-all-users' as test_case,
  CASE 
    WHEN EXISTS (SELECT 1 FROM information_schema.routines WHERE routine_name = 'get_all_users_for_admin') 
    THEN '✅ Alternative SQL function disponible'
    ELSE '❌ Edge Function et alternative manquantes'
  END as edge_function_status,
  CASE 
    WHEN public.get_all_users_for_admin()->>'users' IS NOT NULL
    THEN '✅ Alternative retourne des données'
    ELSE '❌ Alternative ne fonctionne pas'
  END as alternative_status;

-- Test exact: AdminUsers ligne 68-70
-- const userProperties = properties?.filter(p => p.user_id === user.id) || [];
-- const userBookings = bookings?.filter(b => userProperties.some(p => p.id === b.property_id)) || [];

SELECT 
  'AdminUsers ligne 68-70 - Properties by user' as test_case,
  count(DISTINCT user_id) as nb_property_owners,
  count(*) as total_properties,
  CASE 
    WHEN count(DISTINCT user_id) > 0 
    THEN '✅ Relation user_id -> properties fonctionne: ' || count(DISTINCT user_id) || ' propriétaires'
    ELSE '❌ Aucun propriétaire ou relation user_id cassée'
  END as user_properties_status
FROM properties 
WHERE user_id IS NOT NULL;

-- ===========================================
-- 3. VÉRIFICATIONS Dashboard.tsx
-- ===========================================

SELECT '🔍 TEST Dashboard.tsx' as test_section;

-- Test statistiques dashboard
SELECT 
  'Dashboard Statistics' as test_case,
  (SELECT count(*) FROM auth.users) as total_users,
  (SELECT count(*) FROM properties) as total_properties,
  (SELECT count(*) FROM bookings) as total_bookings,
  (SELECT COALESCE(sum(total_amount), 0) FROM bookings) as total_revenue,
  CASE 
    WHEN (SELECT count(*) FROM auth.users) > 0 AND 
         (SELECT count(*) FROM properties) > 0 AND
         (SELECT count(*) FROM bookings) > 0
    THEN '✅ Dashboard aura des données à afficher'
    ELSE '⚠️ Dashboard pourrait afficher des zéros'
  END as dashboard_data_status;

-- ===========================================
-- 4. VÉRIFICATIONS PropertyList.tsx et PropertyDetail.tsx
-- ===========================================

SELECT '🔍 TEST Property Components' as test_section;

-- Test propriétés avec propriétaires
SELECT 
  'Property Owner Relations' as test_case,
  count(*) as total_properties,
  count(CASE WHEN user_id IS NOT NULL THEN 1 END) as properties_with_owner,
  count(CASE WHEN user_id IS NULL THEN 1 END) as properties_without_owner,
  CASE 
    WHEN count(CASE WHEN user_id IS NOT NULL THEN 1 END) > 0
    THEN '✅ Propriétés ont des propriétaires assignés'
    ELSE '❌ Aucune propriété avec propriétaire - interface va être vide'
  END as property_ownership_status
FROM properties;

-- ===========================================
-- 5. VÉRIFICATIONS BookingWizard.tsx et useBookings.ts
-- ===========================================

SELECT '🔍 TEST Booking Components' as test_section;

-- Test structure bookings
SELECT 
  'Booking Structure' as test_case,
  CASE 
    WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'bookings' AND column_name = 'property_id')
    THEN '✅ bookings.property_id'
    ELSE '❌ bookings.property_id manquante'
  END as property_id_status,
  CASE 
    WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'bookings' AND column_name = 'check_in_date')
    THEN '✅ bookings.check_in_date'
    ELSE '❌ bookings.check_in_date manquante'
  END as check_in_status,
  CASE 
    WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'bookings' AND column_name = 'check_out_date')
    THEN '✅ bookings.check_out_date'
    ELSE '❌ bookings.check_out_date manquante'
  END as check_out_status,
  CASE 
    WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'bookings' AND column_name = 'guest_name')
    THEN '✅ bookings.guest_name'
    ELSE '❌ bookings.guest_name manquante'
  END as guest_name_status;

-- ===========================================
-- 6. VÉRIFICATIONS Types TypeScript vs Database
-- ===========================================

SELECT '🔍 TEST TypeScript Types vs Database' as test_section;

-- Vérifier colonnes attendues par les types TypeScript
SELECT 
  'TypeScript Booking Type Compliance' as test_case,
  CASE 
    WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'bookings' AND column_name = 'id')
    THEN '✅ id' ELSE '❌ id' 
  END ||
  CASE 
    WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'bookings' AND column_name = 'property_id')
    THEN ' ✅ property_id' ELSE ' ❌ property_id' 
  END ||
  CASE 
    WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'bookings' AND column_name = 'status')
    THEN ' ✅ status' ELSE ' ❌ status' 
  END ||
  CASE 
    WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'bookings' AND column_name = 'total_amount')
    THEN ' ✅ total_amount' ELSE ' ❌ total_amount' 
  END as booking_type_compliance;

-- ===========================================
-- 7. VÉRIFICATIONS CRITIQUES POUR L'INTERFACE
-- ===========================================

SELECT '🔍 TESTS CRITIQUES INTERFACE' as test_section;

-- Test critique 1: Vue profiles pour AdminContext
SELECT 
  'CRITIQUE 1: Vue profiles' as test_case,
  CASE 
    WHEN EXISTS (SELECT 1 FROM information_schema.views WHERE table_name = 'profiles') 
    THEN '✅ Vue profiles existe - AdminContext peut fonctionner'
    ELSE '❌ Vue profiles manquante - AdminContext va ÉCHOUER'
  END as profiles_critical_status;

-- Test critique 2: Fonction get_users_for_admin
SELECT 
  'CRITIQUE 2: Fonction get_users_for_admin' as test_case,
  CASE 
    WHEN EXISTS (SELECT 1 FROM information_schema.routines WHERE routine_name = 'get_users_for_admin') AND
         public.get_users_for_admin() IS NOT NULL
    THEN '✅ Fonction existe et fonctionne - AdminContext peut charger les users'
    ELSE '❌ Fonction manquante ou défaillante - AdminContext va ÉCHOUER'
  END as get_users_critical_status;

-- Test critique 3: Colonne total_amount
SELECT 
  'CRITIQUE 3: Colonne total_amount' as test_case,
  CASE 
    WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'bookings' AND column_name = 'total_amount')
    THEN '✅ Colonne total_amount existe - Calcul revenue possible'
    ELSE '❌ Colonne total_amount manquante - Calcul revenue va ÉCHOUER'
  END as total_amount_critical_status;

-- ===========================================
-- 8. RÉSUMÉ COHÉRENCE APP <-> DB
-- ===========================================

SELECT '🏁 RÉSUMÉ COHÉRENCE APPLICATION' as final_section;

WITH app_db_checks AS (
  SELECT 
    -- Checks critiques pour AdminContext
    CASE WHEN EXISTS (SELECT 1 FROM information_schema.views WHERE table_name = 'profiles') THEN 1 ELSE 0 END +
    CASE WHEN EXISTS (SELECT 1 FROM information_schema.routines WHERE routine_name = 'get_users_for_admin') THEN 1 ELSE 0 END +
    CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'bookings' AND column_name = 'total_amount') THEN 1 ELSE 0 END +
    -- Checks pour données
    CASE WHEN (SELECT count(*) FROM properties) > 0 THEN 1 ELSE 0 END +
    CASE WHEN (SELECT count(*) FROM bookings) > 0 THEN 1 ELSE 0 END +
    CASE WHEN (SELECT count(*) FROM auth.users) > 0 THEN 1 ELSE 0 END as score_coherence_app
)
SELECT 
  'Score Cohérence App/DB' as metric,
  score_coherence_app || '/6' as score,
  CASE 
    WHEN score_coherence_app = 6 THEN '✅ PARFAITE COHÉRENCE - Interface prête'
    WHEN score_coherence_app >= 4 THEN '⚠️ COHÉRENCE PARTIELLE - Corrections mineures'
    ELSE '❌ INCOHÉRENCES MAJEURES - Interface va échouer'
  END as coherence_status,
  CASE 
    WHEN score_coherence_app = 6 THEN 'Vous pouvez utiliser l interface admin'
    WHEN score_coherence_app >= 4 THEN 'Appliquez les corrections identifiées'
    ELSE 'Appliquez solution-parfaite-finale.sql avant d utiliser l interface'
  END as recommendation
FROM app_db_checks;

SELECT '==========================================';
SELECT 'TESTS COHÉRENCE APP/DB TERMINÉS';
SELECT 'Vérifiez les ❌ ci-dessus pour corriger les incohérences';
SELECT '==========================================';
