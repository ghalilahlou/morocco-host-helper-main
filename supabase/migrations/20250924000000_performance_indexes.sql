-- Migration: Indexes de performance pour Morocco Host Helper
-- Améliore les performances des requêtes fréquentes sans modifier la structure

-- =============================================================================
-- INDEXES POUR RLS ET AUTHENTIFICATION
-- =============================================================================

-- Index pour les requêtes owner-based (RLS)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_properties_owner_id 
  ON public.properties(owner_id) 
  WHERE is_active = true;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_bookings_property_id 
  ON public.bookings(property_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_guests_booking_id 
  ON public.guests(booking_id);

-- Index pour les requêtes d'admin
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_admin_users_user_id_active 
  ON public.admin_users(user_id, is_active) 
  WHERE is_active = true;

-- =============================================================================
-- INDEXES POUR PERFORMANCE DES EDGE FUNCTIONS
-- =============================================================================

-- Index pour validation des tokens (Edge Function: validate-booking-password)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tokens_validation 
  ON public.property_verification_tokens(property_id, expires_at) 
  WHERE expires_at > NOW();

-- Index pour recherche par hash (sécurité)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tokens_hash_lookup 
  ON public.property_verification_tokens(access_code_hash) 
  WHERE access_code_hash IS NOT NULL;

-- Index pour guest submissions lookup
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_guest_submissions_booking 
  ON public.guest_submissions(booking_id, created_at DESC);

-- Index pour document storage par booking
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_document_storage_booking 
  ON public.document_storage(booking_id, created_at DESC);

-- =============================================================================
-- INDEXES POUR INTÉGRATION AIRBNB
-- =============================================================================

-- Index pour sync Airbnb (Edge Function: sync-airbnb-unified)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_airbnb_reservations_property 
  ON public.airbnb_reservations(property_id, check_in_date DESC);

-- Index pour recherche par reservation_id Airbnb
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_airbnb_reservations_id 
  ON public.airbnb_reservations(reservation_id);

-- Index composite pour éviter les doublons
CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS idx_airbnb_unique_reservation 
  ON public.airbnb_reservations(property_id, reservation_id);

-- =============================================================================
-- INDEXES POUR RECHERCHE ET FILTRAGE
-- =============================================================================

-- Index pour recherche de propriétés actives par owner
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_properties_owner_active 
  ON public.properties(owner_id, is_active, created_at DESC) 
  WHERE is_active = true;

-- Index pour recherche de bookings par date
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_bookings_dates 
  ON public.bookings(check_in_date, check_out_date) 
  WHERE check_in_date IS NOT NULL;

-- Index pour recherche par email guest
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_bookings_guest_email 
  ON public.bookings(guest_email, check_in_date DESC) 
  WHERE guest_email IS NOT NULL;

-- =============================================================================
-- INDEXES POUR AUDIT ET LOGGING
-- =============================================================================

-- Index pour requêtes temporelles (audit trails)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_bookings_created_at 
  ON public.bookings(created_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_guests_created_at 
  ON public.guests(created_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tokens_last_used 
  ON public.property_verification_tokens(last_used_at DESC) 
  WHERE last_used_at IS NOT NULL;

-- =============================================================================
-- INDEXES POUR MÉTADONNÉES ET JSONB
-- =============================================================================

-- Index GIN pour recherche dans les métadonnées JSONB
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tokens_metadata_gin 
  ON public.property_verification_tokens USING GIN(metadata);

-- Index pour les propriétés avec métadonnées spécifiques
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_properties_config_gin 
  ON public.properties USING GIN(airbnb_config) 
  WHERE airbnb_config IS NOT NULL;

-- =============================================================================
-- ANALYSE DES PERFORMANCES
-- =============================================================================

-- Fonction pour analyser les performances d'une requête critique
CREATE OR REPLACE FUNCTION public.analyze_booking_query(property_uuid uuid)
RETURNS TABLE(
  query_plan text,
  execution_time_ms numeric
) AS $$
DECLARE
  start_time timestamp;
  end_time timestamp;
  plan_result text;
BEGIN
  -- Mesurer le temps d'exécution d'une requête typique
  start_time := clock_timestamp();
  
  -- Requête représentative : récupérer les bookings d'une propriété avec invités
  PERFORM b.id, b.guest_email, b.check_in_date, b.check_out_date,
          g.first_name, g.last_name, g.nationality
  FROM public.bookings b
  LEFT JOIN public.guests g ON g.booking_id = b.id
  WHERE b.property_id = property_uuid
  AND b.check_in_date >= CURRENT_DATE - INTERVAL '30 days'
  ORDER BY b.check_in_date DESC
  LIMIT 50;
  
  end_time := clock_timestamp();
  
  -- Obtenir le plan d'exécution
  SELECT string_agg(line, E'\n') INTO plan_result
  FROM (
    SELECT unnest(
      string_to_array(
        (EXPLAIN (ANALYZE, BUFFERS) 
         SELECT b.id, b.guest_email, b.check_in_date, b.check_out_date,
                g.first_name, g.last_name, g.nationality
         FROM public.bookings b
         LEFT JOIN public.guests g ON g.booking_id = b.id
         WHERE b.property_id = property_uuid
         AND b.check_in_date >= CURRENT_DATE - INTERVAL '30 days'
         ORDER BY b.check_in_date DESC
         LIMIT 50)::text, 
        E'\n'
      )
    ) AS line
  ) AS plan_lines;
  
  RETURN QUERY SELECT 
    plan_result,
    EXTRACT(milliseconds FROM (end_time - start_time));
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- MAINTENANCE ET MONITORING
-- =============================================================================

-- Vue pour monitorer l'utilisation des indexes
CREATE OR REPLACE VIEW public.index_usage_stats AS
SELECT 
  schemaname,
  tablename,
  indexname,
  idx_tup_read,
  idx_tup_fetch,
  CASE 
    WHEN idx_tup_read > 0 
    THEN (idx_tup_fetch * 100.0 / idx_tup_read)::numeric(5,2)
    ELSE 0
  END AS cache_hit_ratio
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
ORDER BY idx_tup_read DESC;

-- Vue pour monitorer les tables les plus lentes
CREATE OR REPLACE VIEW public.table_scan_stats AS
SELECT 
  schemaname,
  tablename,
  seq_scan,
  seq_tup_read,
  idx_scan,
  idx_tup_fetch,
  CASE 
    WHEN (seq_scan + idx_scan) > 0 
    THEN (idx_scan * 100.0 / (seq_scan + idx_scan))::numeric(5,2)
    ELSE 0
  END AS index_usage_ratio
FROM pg_stat_user_tables
WHERE schemaname = 'public'
ORDER BY seq_tup_read DESC;

-- =============================================================================
-- COMMENTAIRES ET DOCUMENTATION
-- =============================================================================

COMMENT ON INDEX idx_properties_owner_active IS 
'Optimise les requêtes RLS pour les propriétés actives par propriétaire';

COMMENT ON INDEX idx_tokens_validation IS 
'Accélère la validation des tokens dans validate-booking-password';

COMMENT ON INDEX idx_airbnb_unique_reservation IS 
'Prévient les doublons lors de la synchronisation Airbnb';

COMMENT ON FUNCTION public.analyze_booking_query(uuid) IS 
'Analyse les performances d\'une requête critique pour debug';

COMMENT ON VIEW public.index_usage_stats IS 
'Monitore l\'efficacité des indexes pour optimisation';

-- =============================================================================
-- VÉRIFICATION DES INDEXES
-- =============================================================================

-- Vérifier que les indexes critiques existent
DO $$
DECLARE
  missing_indexes text[] := '{}';
  index_name text;
BEGIN
  -- Liste des indexes critiques
  FOR index_name IN 
    SELECT unnest(ARRAY[
      'idx_properties_owner_active',
      'idx_tokens_validation', 
      'idx_bookings_property_id',
      'idx_airbnb_unique_reservation'
    ])
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_indexes 
      WHERE indexname = index_name 
      AND schemaname = 'public'
    ) THEN
      missing_indexes := array_append(missing_indexes, index_name);
    END IF;
  END LOOP;
  
  IF array_length(missing_indexes, 1) > 0 THEN
    RAISE WARNING 'Missing critical indexes: %', array_to_string(missing_indexes, ', ');
  ELSE
    RAISE NOTICE 'All critical indexes are present';
  END IF;
END $$;
