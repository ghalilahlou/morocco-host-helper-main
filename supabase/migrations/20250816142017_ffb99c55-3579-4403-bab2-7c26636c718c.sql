-- Ajouter une validation préventive pour éviter les codes Airbnb dans booking_id
CREATE OR REPLACE FUNCTION validate_booking_id_format()
RETURNS TRIGGER AS $$
BEGIN
  -- Si booking_id est fourni, s'assurer qu'il s'agit d'un UUID valide
  IF NEW.booking_id IS NOT NULL THEN
    IF NOT (NEW.booking_id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$') THEN
      RAISE EXCEPTION 'booking_id doit être un UUID valide, pas un code Airbnb. Valeur reçue: %', NEW.booking_id;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Appliquer le trigger sur les property_verification_tokens
CREATE TRIGGER validate_token_booking_id
    BEFORE INSERT OR UPDATE ON property_verification_tokens
    FOR EACH ROW
    EXECUTE FUNCTION validate_booking_id_format();

-- Vérifier l'état final des tokens et submissions
SELECT 
  'property_verification_tokens avec booking_id UUID valide' as type, 
  count(*) as count 
FROM property_verification_tokens 
WHERE booking_id IS NOT NULL
UNION ALL
SELECT 
  'guest_submissions liées à des tokens valides' as type, 
  count(*) as count 
FROM guest_submissions gs
JOIN property_verification_tokens pvt ON pvt.id = gs.token_id
WHERE pvt.booking_id IS NOT NULL;