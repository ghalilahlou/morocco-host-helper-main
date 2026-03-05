-- ============================================================================
-- CORRECTION COMPLÈTE DE LA VUE MATÉRIALISÉE
-- ============================================================================

-- PROBLÈME 1 : La vue ne peut pas être rafraîchie de manière concurrente
-- PROBLÈME 2 : La vue contient 17 réservations obsolètes au lieu de 1

-- ============================================================================
-- ÉTAPE 1 : VÉRIFIER L'INDEX UNIQUE
-- ============================================================================

SELECT 
  '=== INDEX SUR LA VUE ===' as info,
  indexname,
  indexdef
FROM pg_indexes
WHERE tablename = 'mv_bookings_enriched'
  AND schemaname = 'public';

-- ============================================================================
-- ÉTAPE 2 : CRÉER L'INDEX UNIQUE SI NÉCESSAIRE
-- ============================================================================

-- Vérifier si l'index existe
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE tablename = 'mv_bookings_enriched' 
    AND indexname = 'idx_mv_bookings_enriched_id'
  ) THEN
    CREATE UNIQUE INDEX idx_mv_bookings_enriched_id 
    ON mv_bookings_enriched(id);
    RAISE NOTICE 'Index unique créé';
  ELSE
    RAISE NOTICE 'Index unique existe déjà';
  END IF;
END $$;

-- ============================================================================
-- ÉTAPE 3 : RAFRAÎCHIR LA VUE (SANS CONCURRENTLY d'abord)
-- ============================================================================

-- Option 1 : Rafraîchissement normal (bloquant mais plus sûr)
REFRESH MATERIALIZED VIEW mv_bookings_enriched;

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
-- ÉTAPE 5 : RAFRAÎCHIR DE MANIÈRE CONCURRENTE (après création de l'index)
-- ============================================================================

-- Maintenant que l'index est créé, on peut utiliser CONCURRENTLY
REFRESH MATERIALIZED VIEW CONCURRENTLY mv_bookings_enriched;

-- ============================================================================
-- ÉTAPE 6 : VÉRIFIER LES RÉSERVATIONS DANS LA VUE
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
-- ÉTAPE 7 : IDENTIFIER LES RÉSERVATIONS OBSOLÈTES DANS LA VUE
-- ============================================================================

-- Réservations dans la vue mais PAS dans la table (obsolètes)
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
