-- Désactive tous les liens calendrier ICS sur les propriétés et supprime les lignes
-- importées (airbnb_reservations). Le calendrier et les cartes ne s’appuient plus que sur
-- les réservations manuelles (bookings), en complément de FRONT_CALENDAR_ICS_SYNC_ENABLED.

UPDATE public.properties
SET airbnb_ics_url = NULL
WHERE airbnb_ics_url IS NOT NULL;

DO $$
BEGIN
  IF to_regclass('public.airbnb_reservations') IS NOT NULL THEN
    DELETE FROM public.airbnb_reservations;
  END IF;
END $$;
