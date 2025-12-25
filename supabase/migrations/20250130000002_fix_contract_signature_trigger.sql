-- ✅ CORRECTION: Amélioration du trigger de signature de contrat
-- Le trigger précédent forçait le statut 'completed' même si la fiche de police n'était pas générée

-- Supprimer l'ancien trigger
DROP TRIGGER IF EXISTS trigger_contract_signature_insert ON public.contract_signatures;
DROP FUNCTION IF EXISTS public.handle_contract_signature_insert();

-- Nouvelle fonction de gestion de signature de contrat améliorée
CREATE OR REPLACE FUNCTION public.handle_contract_signature_insert()
RETURNS TRIGGER AS $$
DECLARE
  current_booking_record RECORD;
  current_doc_gen JSONB;
  new_doc_gen JSONB;
  should_complete BOOLEAN := FALSE;
BEGIN
  -- Récupérer l'état actuel de la réservation
  SELECT * INTO current_booking_record
  FROM public.bookings 
  WHERE id = NEW.booking_id;

  IF NOT FOUND THEN
    RAISE WARNING 'Booking % not found for contract signature', NEW.booking_id;
    RETURN NEW;
  END IF;

  -- Récupérer l'état actuel des documents générés
  current_doc_gen := COALESCE(current_booking_record.documents_generated, '{}'::jsonb);
  
  -- Mettre à jour le statut du contrat
  new_doc_gen := current_doc_gen || jsonb_build_object('contract', true);
  
  -- Déterminer si la réservation doit être marquée comme terminée
  -- Seulement si TOUS les documents requis sont générés
  IF (new_doc_gen->>'contract')::boolean = true AND 
     (new_doc_gen->>'policeForm')::boolean = true THEN
    should_complete := TRUE;
  END IF;

  -- Mettre à jour la réservation avec validation
  UPDATE public.bookings
  SET 
    documents_generated = new_doc_gen,
    status = CASE 
      WHEN should_complete AND status != 'completed' THEN 'completed'
      ELSE status  -- Garder le statut actuel si pas tous les documents
    END,
    updated_at = NOW()
  WHERE id = NEW.booking_id;

  -- Log pour le debugging
  RAISE NOTICE 'Contract signature processed for booking %: contract=%, policeForm=%, status=%', 
    NEW.booking_id, 
    (new_doc_gen->>'contract')::boolean,
    (new_doc_gen->>'policeForm')::boolean,
    CASE WHEN should_complete THEN 'completed' ELSE current_booking_record.status END;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recréer le trigger pour INSERT et UPDATE
CREATE TRIGGER trigger_contract_signature_insert
  AFTER INSERT OR UPDATE ON public.contract_signatures
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_contract_signature_insert();

-- Fonction similaire pour la génération de fiches de police
CREATE OR REPLACE FUNCTION public.handle_police_form_generated()
RETURNS VOID AS $$
BEGIN
  -- Cette fonction peut être appelée par l'application pour marquer
  -- qu'une fiche de police a été générée
  -- L'implémentation peut être ajoutée selon les besoins
  NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Commentaires pour documentation
COMMENT ON FUNCTION public.handle_contract_signature_insert() IS 
'Gère la signature de contrat. Met à jour documents_generated.contract et ne marque la réservation comme terminée que si TOUS les documents sont générés.';

COMMENT ON FUNCTION public.handle_police_form_generated() IS 
'Placeholder pour marquer la génération de fiches de police. À implémenter selon les besoins.';
