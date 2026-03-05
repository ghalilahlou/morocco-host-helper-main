-- ============================================================================
-- CORRECTION DE LA VUE MATÉRIALISÉE - Problème d'écrasement des réservations
-- ============================================================================

-- PROBLÈME IDENTIFIÉ :
-- - Table bookings : 1 réservation
-- - Vue mv_bookings_enriched : 17 réservations (OBSOLÈTE)
-- - Vue ne montre pas la réservation "completed"

-- ============================================================================
-- ÉTAPE 1 : VÉRIFIER L'ÉTAT ACTUEL
-- ============================================================================

SELECT 
  '=== ÉTAT ACTUEL ===' as info,
  (SELECT COUNT(*) FROM bookings WHERE property_id = '488d5074-b6ce-40a8-b0d5-036e97993410') as count_in_table,
  (SELECT COUNT(*) FROM mv_bookings_enriched WHERE property_id = '488d5074-b6ce-40a8-b0d5-036e97993410') as count_in_view,
  (SELECT COUNT(*) FROM bookings WHERE property_id = '488d5074-b6ce-40a8-b0d5-036e97993410' AND status = 'completed') as completed_in_table,
  (SELECT COUNT(*) FROM mv_bookings_enriched WHERE property_id = '488d5074-b6ce-40a8-b0d5-036e97993410' AND status = 'completed') as completed_in_view;

-- ============================================================================
-- ÉTAPE 2 : CRÉER L'INDEX UNIQUE (NÉCESSAIRE POUR CONCURRENTLY)
-- ============================================================================

-- Créer l'index unique sur id (requis pour REFRESH CONCURRENTLY)
CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_bookings_enriched_id_unique 
ON mv_bookings_enriched(id);

-- ============================================================================
-- ÉTAPE 3 : RAFRAÎCHIR LA VUE MATÉRIALISÉE
-- ============================================================================

-- Option 1 : Rafraîchissement normal (bloquant mais plus sûr)
REFRESH MATERIALIZED VIEW mv_bookings_enriched;

-- Option 2 : Rafraîchissement concurrent (après création de l'index)
-- REFRESH MATERIALIZED VIEW CONCURRENTLY mv_bookings_enriched;

-- ============================================================================
-- ÉTAPE 4 : VÉRIFIER APRÈS RAFRAÎCHISSEMENT
-- ============================================================================

SELECT 
  '=== ÉTAT APRÈS RAFRAÎCHISSEMENT ===' as info,
  (SELECT COUNT(*) FROM bookings WHERE property_id = '488d5074-b6ce-40a8-b0d5-036e97993410') as count_in_table,
  (SELECT COUNT(*) FROM mv_bookings_enriched WHERE property_id = '488d5074-b6ce-40a8-b0d5-036e97993410') as count_in_view,
  (SELECT COUNT(*) FROM bookings WHERE property_id = '488d5074-b6ce-40a8-b0d5-036e97993410' AND status = 'completed') as completed_in_table,
  (SELECT COUNT(*) FROM mv_bookings_enriched WHERE property_id = '488d5074-b6ce-40a8-b0d5-036e97993410' AND status = 'completed') as completed_in_view;

-- ============================================================================
-- ÉTAPE 5 : VÉRIFIER LES RÉSERVATIONS DANS LA VUE
-- ============================================================================

SELECT 
  '=== RÉSERVATIONS DANS LA VUE ===' as info,
  id,
  booking_reference,
  guest_name,
  status,
  check_in_date,
  check_out_date
FROM mv_bookings_enriched
WHERE property_id = '488d5074-b6ce-40a8-b0d5-036e97993410'
ORDER BY check_in_date DESC, created_at DESC;

-- ============================================================================
-- ÉTAPE 6 : COMPARAISON DÉTAILLÉE
-- ============================================================================

-- Réservations dans la table mais PAS dans la vue
SELECT 
  '=== DANS TABLE MAIS PAS DANS VUE ===' as info,
  b.id,
  b.guest_name,
  b.status,
  b.check_in_date
FROM bookings b
WHERE b.property_id = '488d5074-b6ce-40a8-b0d5-036e97993410'
  AND NOT EXISTS (
    SELECT 1 FROM mv_bookings_enriched v 
    WHERE v.id = b.id
  );

-- Réservations dans la vue mais PAS dans la table
SELECT 
  '=== DANS VUE MAIS PAS DANS TABLE ===' as info,
  v.id,
  v.guest_name,
  v.status,
  v.check_in_date
FROM mv_bookings_enriched v
WHERE v.property_id = '488d5074-b6ce-40a8-b0d5-036e97993410'
  AND NOT EXISTS (
    SELECT 1 FROM bookings b 
    WHERE b.id = v.id
  );
