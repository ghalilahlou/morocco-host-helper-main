-- ============================================================================
-- SOLUTION DURABLE : TRIGGER POUR EMPÊCHER user_id NULL
-- ============================================================================
-- Ce trigger empêchera TOUTE insertion de réservation avec user_id NULL
-- Solution au niveau de la base de données pour garantir l'intégrité

-- 1. Créer une fonction qui valide le user_id
CREATE OR REPLACE FUNCTION validate_booking_user_id()
RETURNS TRIGGER AS $$
BEGIN
  -- Vérifier que user_id n'est pas NULL
  IF NEW.user_id IS NULL THEN
    RAISE EXCEPTION 'user_id ne peut pas être NULL pour une réservation';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 2. Créer le trigger sur la table bookings
DROP TRIGGER IF EXISTS ensure_booking_has_user_id ON bookings;

CREATE TRIGGER ensure_booking_has_user_id
  BEFORE INSERT OR UPDATE ON bookings
  FOR EACH ROW
  EXECUTE FUNCTION validate_booking_user_id();

-- 3. Vérifier que le trigger fonctionne
-- Cette requête devrait échouer avec l'erreur "user_id ne peut pas être NULL"
-- INSERT INTO bookings (property_id, check_in_date, check_out_date, status) 
-- VALUES ('test', '2025-01-01', '2025-01-02', 'pending');

-- 4. Test : Cette requête devrait réussir
-- INSERT INTO bookings (user_id, property_id, check_in_date, check_out_date, status) 
-- VALUES ('1ef553dd-f4c3-4a7e-877c-eeb9423a48f0', '488d5074-b6ce-40a8-b0d5-036e97993410', '2025-01-01', '2025-01-02', 'pending');
