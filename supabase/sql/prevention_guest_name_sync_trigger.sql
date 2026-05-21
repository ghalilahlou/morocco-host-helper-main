-- =============================================================================
-- TRIGGER : Synchronisation automatique bookings.guest_name ← guests.full_name
--
-- Défense en profondeur : même si une Edge Function oublie de re-sync,
-- la base garantit que bookings.guest_name reflète toujours le 1er guest réel.
--
-- Règle : on n'écrase JAMAIS un guest_name "réel" (différent de NULL/'' /'Guest').
-- On remplace UNIQUEMENT les placeholders, donc safe à activer.
--
-- À exécuter dans Supabase → SQL Editor (rôle postgres / service_role)
-- =============================================================================

-- 1) Fonction trigger
CREATE OR REPLACE FUNCTION public.sync_booking_guest_name_from_guests()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  target_booking_id uuid;
  current_guest_name text;
  first_real_guest_name text;
BEGIN
  -- Selon l'opération, récupérer le bon booking_id
  IF TG_OP = 'DELETE' THEN
    target_booking_id := OLD.booking_id;
  ELSE
    target_booking_id := NEW.booking_id;
  END IF;

  IF target_booking_id IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  -- État actuel de bookings.guest_name
  SELECT guest_name INTO current_guest_name
  FROM public.bookings
  WHERE id = target_booking_id;

  -- Si nom déjà "réel" (≠ NULL/''/'Guest'), ne rien faire
  IF current_guest_name IS NOT NULL
     AND trim(current_guest_name) <> ''
     AND lower(trim(current_guest_name)) <> 'guest'
  THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  -- Sinon, prendre le 1er guest (par created_at) qui a un nom réel
  SELECT g.full_name INTO first_real_guest_name
  FROM public.guests g
  WHERE g.booking_id = target_booking_id
    AND g.full_name IS NOT NULL
    AND trim(g.full_name) <> ''
    AND lower(trim(g.full_name)) <> 'guest'
  ORDER BY g.created_at ASC
  LIMIT 1;

  IF first_real_guest_name IS NOT NULL THEN
    UPDATE public.bookings
    SET guest_name = first_real_guest_name,
        updated_at = now()
    WHERE id = target_booking_id;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

-- 2) Trigger sur la table guests
DROP TRIGGER IF EXISTS trg_sync_booking_guest_name ON public.guests;
CREATE TRIGGER trg_sync_booking_guest_name
AFTER INSERT OR UPDATE OF full_name OR DELETE
ON public.guests
FOR EACH ROW
EXECUTE FUNCTION public.sync_booking_guest_name_from_guests();

-- =============================================================================
-- TEST de validation (à lancer en dev pour confirmer)
-- =============================================================================
-- 1) Créer un booking placeholder
-- INSERT INTO public.bookings (id, property_id, user_id, check_in_date, check_out_date, guest_name, status, booking_reference)
-- VALUES (gen_random_uuid(), '<property_uuid>', '<user_uuid>', current_date, current_date+1, NULL, 'pending', 'TEST_TRIGGER');
--
-- 2) Insérer un guest → bookings.guest_name doit devenir le nom du guest
-- 3) Update le full_name → ne change rien si déjà réel (idempotent)
-- 4) Supprimer le guest → ne touche pas le booking (decision : on garde l'historique)

-- =============================================================================
-- ROLLBACK (au cas où)
-- =============================================================================
-- DROP TRIGGER IF EXISTS trg_sync_booking_guest_name ON public.guests;
-- DROP FUNCTION IF EXISTS public.sync_booking_guest_name_from_guests();
