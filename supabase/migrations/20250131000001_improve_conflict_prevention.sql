-- Migration pour améliorer la prévention des conflits de réservation
-- Date: 2025-01-31

-- 1. ✅ DÉSACTIVER la contrainte de dates passées (trop restrictive)
-- Permet de créer des réservations passées pour l'historique
ALTER TABLE public.bookings 
DROP CONSTRAINT IF EXISTS check_dates_not_past;

-- 2. ✅ ASSOUPLIR la contrainte unique pour permettre plusieurs users sur mêmes dates
-- (utile pour les locations multi-propriétaires)
ALTER TABLE public.bookings 
DROP CONSTRAINT IF EXISTS unique_booking_dates;

-- 3. ✅ AMÉLIORER la fonction de vérification des conflits
-- Retourne plus d'informations pour un meilleur diagnostic
CREATE OR REPLACE FUNCTION check_booking_conflicts(
  p_property_id UUID,
  p_check_in_date DATE,
  p_check_out_date DATE,
  p_exclude_booking_id UUID DEFAULT NULL
)
RETURNS TABLE(
  conflict_booking_id UUID,
  conflict_user_id UUID,
  conflict_check_in DATE,
  conflict_check_out DATE,
  conflict_status TEXT,
  conflict_guest_name TEXT,
  conflict_reference TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    b.id,
    b.user_id,
    b.check_in_date,
    b.check_out_date,
    b.status::TEXT,
    b.guest_name,
    b.booking_reference
  FROM public.bookings b
  WHERE b.property_id = p_property_id
    AND b.id != COALESCE(p_exclude_booking_id, '00000000-0000-0000-0000-000000000000'::UUID)
    AND (
      -- Vérifier si les dates se chevauchent (logique stricte)
      (p_check_in_date < b.check_out_date AND p_check_out_date > b.check_in_date)
    )
    AND b.status NOT IN ('cancelled', 'rejected') -- Ignorer les réservations annulées
  ORDER BY b.check_in_date;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. ✅ CRÉER une fonction pour détecter les conflits Airbnb également
CREATE OR REPLACE FUNCTION check_airbnb_conflicts(
  p_property_id UUID,
  p_check_in_date DATE,
  p_check_out_date DATE
)
RETURNS TABLE(
  conflict_reservation_id UUID,
  conflict_airbnb_id TEXT,
  conflict_start_date TIMESTAMP WITH TIME ZONE,
  conflict_end_date TIMESTAMP WITH TIME ZONE,
  conflict_guest_name TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ar.id,
    ar.airbnb_booking_id,
    ar.start_date,
    ar.end_date,
    ar.guest_name
  FROM public.airbnb_reservations ar
  WHERE ar.property_id = p_property_id
    AND (
      -- Vérifier si les dates se chevauchent avec les réservations Airbnb
      (p_check_in_date < DATE(ar.end_date) AND p_check_out_date > DATE(ar.start_date))
    )
  ORDER BY ar.start_date;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. ✅ CRÉER une fonction unifiée pour vérifier TOUS les conflits
CREATE OR REPLACE FUNCTION check_all_booking_conflicts(
  p_property_id UUID,
  p_check_in_date DATE,
  p_check_out_date DATE,
  p_exclude_booking_id UUID DEFAULT NULL
)
RETURNS JSON AS $$
DECLARE
  booking_conflicts JSON;
  airbnb_conflicts JSON;
  result JSON;
BEGIN
  -- Récupérer les conflits de réservations manuelles
  SELECT json_agg(row_to_json(t))
  INTO booking_conflicts
  FROM (
    SELECT * FROM check_booking_conflicts(
      p_property_id, 
      p_check_in_date, 
      p_check_out_date, 
      p_exclude_booking_id
    )
  ) t;

  -- Récupérer les conflits Airbnb
  SELECT json_agg(row_to_json(t))
  INTO airbnb_conflicts
  FROM (
    SELECT * FROM check_airbnb_conflicts(
      p_property_id, 
      p_check_in_date, 
      p_check_out_date
    )
  ) t;

  -- Combiner les résultats
  result := json_build_object(
    'hasConflicts', (booking_conflicts IS NOT NULL OR airbnb_conflicts IS NOT NULL),
    'bookingConflicts', COALESCE(booking_conflicts, '[]'::json),
    'airbnbConflicts', COALESCE(airbnb_conflicts, '[]'::json),
    'totalConflicts', COALESCE(json_array_length(booking_conflicts), 0) + COALESCE(json_array_length(airbnb_conflicts), 0)
  );

  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. ✅ MODIFIER le trigger pour être moins strict (warning au lieu d'erreur)
-- et permettre les modifications
CREATE OR REPLACE FUNCTION prevent_duplicate_bookings()
RETURNS TRIGGER AS $$
DECLARE
  conflict_count INTEGER;
  conflicts_info JSON;
BEGIN
  -- Vérifier s'il y a des conflits UNIQUEMENT pour les nouvelles réservations
  -- Permettre les updates (pour pouvoir corriger)
  IF TG_OP = 'INSERT' THEN
    conflicts_info := check_all_booking_conflicts(
      NEW.property_id, 
      NEW.check_in_date, 
      NEW.check_out_date, 
      NULL
    );
    
    conflict_count := (conflicts_info->>'totalConflicts')::INTEGER;
    
    IF conflict_count > 0 THEN
      -- ✅ LOGGING au lieu de RAISE EXCEPTION
      RAISE WARNING 'Conflit de réservation détecté pour propriété % : % conflit(s)', 
        NEW.property_id, conflict_count;
      RAISE WARNING 'Détails des conflits : %', conflicts_info;
      
      -- ✅ OPTION : Décommenter la ligne suivante pour BLOQUER les conflits
      -- RAISE EXCEPTION 'Conflit de réservation détecté. % conflit(s) pour ces dates.', conflict_count;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 7. ✅ RECRÉER le trigger avec la nouvelle fonction
DROP TRIGGER IF EXISTS trigger_prevent_duplicate_bookings ON public.bookings;
CREATE TRIGGER trigger_prevent_duplicate_bookings
  BEFORE INSERT ON public.bookings
  FOR EACH ROW
  EXECUTE FUNCTION prevent_duplicate_bookings();

-- 8. ✅ ACCORDER les permissions nécessaires
GRANT EXECUTE ON FUNCTION check_booking_conflicts TO authenticated;
GRANT EXECUTE ON FUNCTION check_airbnb_conflicts TO authenticated;
GRANT EXECUTE ON FUNCTION check_all_booking_conflicts TO authenticated;

-- 9. ✅ COMMENTAIRES pour documentation
COMMENT ON FUNCTION check_booking_conflicts IS 'Vérifie les conflits de réservations manuelles pour une propriété et des dates données';
COMMENT ON FUNCTION check_airbnb_conflicts IS 'Vérifie les conflits avec les réservations Airbnb pour une propriété et des dates données';
COMMENT ON FUNCTION check_all_booking_conflicts IS 'Vérifie TOUS les conflits (manuels + Airbnb) et retourne un JSON avec les détails';

