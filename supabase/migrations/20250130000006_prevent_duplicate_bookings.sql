-- Migration pour empêcher les réservations en double
-- Date: 2025-01-30

-- 1. Ajouter une contrainte unique pour éviter les réservations en double
-- (même propriété, mêmes dates, même utilisateur)
ALTER TABLE public.bookings 
ADD CONSTRAINT unique_booking_dates 
UNIQUE (property_id, check_in_date, check_out_date, user_id);

-- 2. Créer un index pour améliorer les performances des vérifications de conflits
CREATE INDEX IF NOT EXISTS idx_bookings_dates_conflict_check 
ON public.bookings (property_id, check_in_date, check_out_date);

-- 3. Ajouter un index sur user_id pour les requêtes par utilisateur
CREATE INDEX IF NOT EXISTS idx_bookings_user_id 
ON public.bookings (user_id);

-- 4. Ajouter un index sur status pour les requêtes de statut
CREATE INDEX IF NOT EXISTS idx_bookings_status 
ON public.bookings (status);

-- 5. Ajouter une contrainte de validation pour s'assurer que check_out_date > check_in_date
ALTER TABLE public.bookings 
ADD CONSTRAINT check_dates_validity 
CHECK (check_out_date > check_in_date);

-- 6. Ajouter une contrainte pour empêcher les dates passées
ALTER TABLE public.bookings 
ADD CONSTRAINT check_dates_not_past 
CHECK (check_in_date >= CURRENT_DATE);

-- 7. Créer une fonction pour vérifier les conflits de réservation
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
  conflict_status TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    b.id,
    b.user_id,
    b.check_in_date,
    b.check_out_date,
    b.status::TEXT
  FROM public.bookings b
  WHERE b.property_id = p_property_id
    AND b.id != COALESCE(p_exclude_booking_id, '00000000-0000-0000-0000-000000000000'::UUID)
    AND (
      -- Vérifier si les dates se chevauchent
      (p_check_in_date < b.check_out_date AND p_check_out_date > b.check_in_date)
      OR
      -- Vérifier si c'est exactement les mêmes dates
      (p_check_in_date = b.check_in_date AND p_check_out_date = b.check_out_date)
    )
    AND b.status IN ('pending', 'completed') -- Seulement les réservations actives
  ORDER BY b.check_in_date;
END;
$$ LANGUAGE plpgsql;

-- 8. Créer un trigger pour vérifier automatiquement les conflits
CREATE OR REPLACE FUNCTION prevent_duplicate_bookings()
RETURNS TRIGGER AS $$
DECLARE
  conflict_count INTEGER;
BEGIN
  -- Vérifier s'il y a des conflits
  SELECT COUNT(*) INTO conflict_count
  FROM check_booking_conflicts(
    NEW.property_id, 
    NEW.check_in_date, 
    NEW.check_out_date, 
    NEW.id
  );
  
  IF conflict_count > 0 THEN
    RAISE EXCEPTION 'Conflit de réservation détecté. Une réservation existe déjà pour ces dates sur cette propriété.';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 9. Créer le trigger
DROP TRIGGER IF EXISTS trigger_prevent_duplicate_bookings ON public.bookings;
CREATE TRIGGER trigger_prevent_duplicate_bookings
  BEFORE INSERT OR UPDATE ON public.bookings
  FOR EACH ROW
  EXECUTE FUNCTION prevent_duplicate_bookings();

-- 10. Ajouter des commentaires pour documenter les nouvelles contraintes
COMMENT ON CONSTRAINT unique_booking_dates ON public.bookings IS 'Empêche les réservations en double pour la même propriété, mêmes dates et même utilisateur';
COMMENT ON CONSTRAINT check_dates_validity ON public.bookings IS 'S''assure que la date de départ est après la date d''arrivée';
COMMENT ON CONSTRAINT check_dates_not_past ON public.bookings IS 'Empêche les réservations avec des dates passées';
COMMENT ON FUNCTION check_booking_conflicts IS 'Vérifie les conflits de réservation pour une propriété et des dates données';
COMMENT ON FUNCTION prevent_duplicate_bookings IS 'Trigger qui empêche automatiquement les réservations en double';
