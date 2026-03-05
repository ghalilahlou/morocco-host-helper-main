-- ============================================================================
-- CORRECTION DE LA VUE MATÉRIALISÉE - Création de l'index unique
-- ============================================================================

-- PROBLÈME : La vue ne peut pas être rafraîchie de manière concurrente
-- SOLUTION : Créer un index unique sur id

-- ============================================================================
-- ÉTAPE 1 : CRÉER L'INDEX UNIQUE SUR ID
-- ============================================================================

-- Vérifier si l'index existe déjà
SELECT 
  '=== VÉRIFICATION INDEX ===' as info,
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM pg_indexes 
      WHERE tablename = 'mv_bookings_enriched' 
      AND indexname = 'idx_mv_bookings_enriched_id_unique'
    ) THEN 'INDEX EXISTE DÉJÀ'
    ELSE 'INDEX N''EXISTE PAS - CRÉATION NÉCESSAIRE'
  END as status;

-- Créer l'index unique si nécessaire
CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_bookings_enriched_id_unique 
ON mv_bookings_enriched(id);

-- ============================================================================
-- ÉTAPE 2 : RAFRAÎCHIR LA VUE (SANS CONCURRENTLY d'abord pour être sûr)
-- ============================================================================

-- Rafraîchissement normal (bloquant mais plus sûr)
REFRESH MATERIALIZED VIEW mv_bookings_enriched;

-- ============================================================================
-- ÉTAPE 3 : VÉRIFIER L'ÉTAT APRÈS RAFRAÎCHISSEMENT
-- ============================================================================

SELECT 
  '=== ÉTAT APRÈS RAFRAÎCHISSEMENT ===' as info,
  (SELECT COUNT(*) FROM bookings WHERE property_id = '488d5074-b6ce-40a8-b0d5-036e97993410') as count_in_table,
  (SELECT COUNT(*) FROM mv_bookings_enriched WHERE property_id = '488d5074-b6ce-40a8-b0d5-036e97993410') as count_in_view,
  (SELECT COUNT(*) FROM bookings WHERE property_id = '488d5074-b6ce-40a8-b0d5-036e97993410' AND status = 'completed') as completed_in_table,
  (SELECT COUNT(*) FROM mv_bookings_enriched WHERE property_id = '488d5074-b6ce-40a8-b0d5-036e97993410' AND status = 'completed') as completed_in_view;

-- ============================================================================
-- ÉTAPE 4 : RAFRAÎCHIR DE MANIÈRE CONCURRENTE (maintenant possible)
-- ============================================================================

-- Maintenant que l'index unique est créé, on peut utiliser CONCURRENTLY
REFRESH MATERIALIZED VIEW CONCURRENTLY mv_bookings_enriched;

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
  check_out_date,
  created_at
FROM mv_bookings_enriched
WHERE property_id = '488d5074-b6ce-40a8-b0d5-036e97993410'
ORDER BY check_in_date DESC, created_at DESC;

-- ============================================================================
-- ÉTAPE 6 : IDENTIFIER LES RÉSERVATIONS OBSOLÈTES
-- ============================================================================

-- Réservations dans la vue mais PAS dans la table (à supprimer de la vue)
SELECT 
  '=== RÉSERVATIONS OBSOLÈTES DANS LA VUE ===' as info,
  v.id,
  v.guest_name,
  v.status,
  v.check_in_date,
  v.created_at
FROM mv_bookings_enriched v
WHERE v.property_id = '488d5074-b6ce-40a8-b0d5-036e97993410'
  AND NOT EXISTS (
    SELECT 1 FROM bookings b 
    WHERE b.id = v.id
  )
ORDER BY v.created_at DESC;
