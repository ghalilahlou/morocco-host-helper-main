-- ✅ CORRECTION: Fonction RPC pour synchronisation atomique des invités
-- Cette fonction remplace de manière atomique tous les invités d'une réservation

CREATE OR REPLACE FUNCTION public.sync_booking_guests(
  p_booking_id UUID,
  p_guests JSONB
) RETURNS VOID AS $$
DECLARE
  guest_record JSONB;
  new_guest_id UUID;
BEGIN
  -- Validation des paramètres
  IF p_booking_id IS NULL THEN
    RAISE EXCEPTION 'booking_id cannot be null';
  END IF;

  IF p_guests IS NULL THEN
    p_guests := '[]'::JSONB;
  END IF;

  -- Début de la transaction atomique
  BEGIN
    -- 1. Supprimer tous les invités existants
    DELETE FROM public.guests 
    WHERE booking_id = p_booking_id;
    
    -- 2. Insérer les nouveaux invités
    FOR guest_record IN SELECT * FROM jsonb_array_elements(p_guests)
    LOOP
      INSERT INTO public.guests (
        booking_id,
        full_name,
        date_of_birth,
        document_number,
        nationality,
        place_of_birth,
        document_type,
        created_at,
        updated_at
      ) VALUES (
        p_booking_id,
        COALESCE(guest_record->>'full_name', ''),
        COALESCE((guest_record->>'date_of_birth')::DATE, CURRENT_DATE),
        COALESCE(guest_record->>'document_number', ''),
        COALESCE(guest_record->>'nationality', ''),
        COALESCE(guest_record->>'place_of_birth', ''),
        COALESCE((guest_record->>'document_type')::document_type, 'passport'),
        NOW(),
        NOW()
      );
    END LOOP;

    -- 3. Mettre à jour le timestamp de la réservation
    UPDATE public.bookings 
    SET updated_at = NOW() 
    WHERE id = p_booking_id;

  EXCEPTION
    WHEN OTHERS THEN
      -- En cas d'erreur, rollback automatique
      RAISE EXCEPTION 'Failed to sync guests for booking %: %', p_booking_id, SQLERRM;
  END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Accorder les permissions nécessaires
GRANT EXECUTE ON FUNCTION public.sync_booking_guests(UUID, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.sync_booking_guests(UUID, JSONB) TO anon;

-- Commentaire pour documentation
COMMENT ON FUNCTION public.sync_booking_guests(UUID, JSONB) IS 
'Synchronise atomiquement les invités d''une réservation. Supprime tous les invités existants et insère les nouveaux en une seule transaction.';
