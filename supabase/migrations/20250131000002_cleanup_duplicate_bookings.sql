-- Script pour nettoyer les réservations en double
-- Date: 2025-01-31
-- ⚠️ ATTENTION : Ce script identifie et supprime les doublons tout en préservant le plus récent

-- 1. ✅ FONCTION pour identifier les doublons
CREATE OR REPLACE FUNCTION identify_duplicate_bookings()
RETURNS TABLE(
  duplicate_id UUID,
  property_id UUID,
  check_in_date DATE,
  check_out_date DATE,
  created_at TIMESTAMP WITH TIME ZONE,
  keep_id UUID,
  reason TEXT
) AS $$
BEGIN
  RETURN QUERY
  WITH ranked_bookings AS (
    SELECT 
      b.id,
      b.property_id,
      b.check_in_date,
      b.check_out_date,
      b.created_at,
      b.status,
      b.updated_at,
      ROW_NUMBER() OVER (
        PARTITION BY b.property_id, b.check_in_date, b.check_out_date
        ORDER BY 
          CASE 
            WHEN b.status = 'completed' THEN 1
            WHEN b.status = 'pending' THEN 2
            WHEN b.status = 'confirmed' THEN 3
            ELSE 4
          END,
          b.updated_at DESC,
          b.created_at DESC
      ) as rn,
      FIRST_VALUE(b.id) OVER (
        PARTITION BY b.property_id, b.check_in_date, b.check_out_date
        ORDER BY 
          CASE 
            WHEN b.status = 'completed' THEN 1
            WHEN b.status = 'pending' THEN 2
            WHEN b.status = 'confirmed' THEN 3
            ELSE 4
          END,
          b.updated_at DESC,
          b.created_at DESC
      ) as keep_booking_id
    FROM public.bookings b
    WHERE b.status NOT IN ('cancelled', 'rejected')
  )
  SELECT 
    rb.id,
    rb.property_id,
    rb.check_in_date,
    rb.check_out_date,
    rb.created_at,
    rb.keep_booking_id,
    'Doublon détecté - ' || rb.rn || 'ème occurrence' as reason
  FROM ranked_bookings rb
  WHERE rb.rn > 1  -- Garder seulement le premier (le plus pertinent)
  ORDER BY rb.property_id, rb.check_in_date;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. ✅ FONCTION pour supprimer les doublons (MODE SÉCURISÉ : ne fait rien par défaut)
CREATE OR REPLACE FUNCTION cleanup_duplicate_bookings(
  p_dry_run BOOLEAN DEFAULT TRUE,
  p_delete_limit INTEGER DEFAULT 100
)
RETURNS JSON AS $$
DECLARE
  duplicates_count INTEGER;
  deleted_count INTEGER := 0;
  duplicates_info JSON;
  result JSON;
BEGIN
  -- Compter les doublons
  SELECT COUNT(*) INTO duplicates_count
  FROM identify_duplicate_bookings();

  -- Récupérer les informations des doublons
  SELECT json_agg(row_to_json(t))
  INTO duplicates_info
  FROM (
    SELECT * FROM identify_duplicate_bookings()
    LIMIT p_delete_limit
  ) t;

  -- Si ce n'est pas un dry run, supprimer les doublons
  IF NOT p_dry_run THEN
    -- Supprimer les doublons en gardant le plus récent
    WITH duplicates AS (
      SELECT duplicate_id FROM identify_duplicate_bookings()
      LIMIT p_delete_limit
    )
    DELETE FROM public.bookings
    WHERE id IN (SELECT duplicate_id FROM duplicates);
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    
    RAISE NOTICE 'Supprimé % réservation(s) en double', deleted_count;
  ELSE
    RAISE NOTICE 'MODE DRY RUN : % doublon(s) détecté(s), mais aucune suppression effectuée', duplicates_count;
  END IF;

  -- Retourner le résultat
  result := json_build_object(
    'dryRun', p_dry_run,
    'totalDuplicatesFound', duplicates_count,
    'deletedCount', deleted_count,
    'duplicates', COALESCE(duplicates_info, '[]'::json)
  );

  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. ✅ FONCTION similaire pour les réservations Airbnb
CREATE OR REPLACE FUNCTION identify_duplicate_airbnb_reservations()
RETURNS TABLE(
  duplicate_id UUID,
  property_id UUID,
  airbnb_booking_id TEXT,
  start_date TIMESTAMP WITH TIME ZONE,
  end_date TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE,
  keep_id UUID,
  reason TEXT
) AS $$
BEGIN
  RETURN QUERY
  WITH ranked_reservations AS (
    SELECT 
      ar.id,
      ar.property_id,
      ar.airbnb_booking_id,
      ar.start_date,
      ar.end_date,
      ar.created_at,
      ar.updated_at,
      ROW_NUMBER() OVER (
        PARTITION BY ar.property_id, ar.airbnb_booking_id, ar.start_date, ar.end_date
        ORDER BY ar.updated_at DESC, ar.created_at DESC
      ) as rn,
      FIRST_VALUE(ar.id) OVER (
        PARTITION BY ar.property_id, ar.airbnb_booking_id, ar.start_date, ar.end_date
        ORDER BY ar.updated_at DESC, ar.created_at DESC
      ) as keep_reservation_id
    FROM public.airbnb_reservations ar
  )
  SELECT 
    rr.id,
    rr.property_id,
    rr.airbnb_booking_id,
    rr.start_date,
    rr.end_date,
    rr.created_at,
    rr.keep_reservation_id,
    'Doublon Airbnb détecté - ' || rr.rn || 'ème occurrence' as reason
  FROM ranked_reservations rr
  WHERE rr.rn > 1
  ORDER BY rr.property_id, rr.start_date;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. ✅ ACCORDER les permissions
GRANT EXECUTE ON FUNCTION identify_duplicate_bookings TO authenticated;
GRANT EXECUTE ON FUNCTION cleanup_duplicate_bookings TO authenticated;
GRANT EXECUTE ON FUNCTION identify_duplicate_airbnb_reservations TO authenticated;

-- 5. ✅ EXEMPLES D'UTILISATION (commentés pour sécurité)
-- Pour voir les doublons sans rien supprimer (MODE SÉCURISÉ):
-- SELECT * FROM cleanup_duplicate_bookings(TRUE, 100);

-- Pour identifier les doublons:
-- SELECT * FROM identify_duplicate_bookings();

-- ⚠️ ATTENTION : Pour RÉELLEMENT supprimer les doublons (DANGEREUX):
-- SELECT * FROM cleanup_duplicate_bookings(FALSE, 100);

-- Pour voir les doublons Airbnb:
-- SELECT * FROM identify_duplicate_airbnb_reservations();

COMMENT ON FUNCTION identify_duplicate_bookings IS 'Identifie les réservations en double sur mêmes propriété et dates';
COMMENT ON FUNCTION cleanup_duplicate_bookings IS 'Nettoie les réservations en double (dry_run=TRUE par défaut pour sécurité)';
COMMENT ON FUNCTION identify_duplicate_airbnb_reservations IS 'Identifie les réservations Airbnb en double';

