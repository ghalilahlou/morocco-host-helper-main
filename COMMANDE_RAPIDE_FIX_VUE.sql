-- ============================================================================
-- COMMANDE RAPIDE : Corriger la Vue Matérialisée
-- ============================================================================

-- 1. Créer l'index unique (nécessaire pour CONCURRENTLY)
CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_bookings_enriched_id_unique 
ON mv_bookings_enriched(id);

-- 2. Rafraîchir la vue (sans CONCURRENTLY d'abord)
REFRESH MATERIALIZED VIEW mv_bookings_enriched;

-- 3. Vérifier le résultat
SELECT 
  (SELECT COUNT(*) FROM bookings WHERE property_id = '488d5074-b6ce-40a8-b0d5-036e97993410') as count_table,
  (SELECT COUNT(*) FROM mv_bookings_enriched WHERE property_id = '488d5074-b6ce-40a8-b0d5-036e97993410') as count_view;
