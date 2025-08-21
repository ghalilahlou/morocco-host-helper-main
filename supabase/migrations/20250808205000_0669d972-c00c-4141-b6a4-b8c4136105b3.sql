-- Create trigger to automatically update booking status and documents_generated.contract when a contract signature is inserted
CREATE OR REPLACE FUNCTION public.handle_contract_signature_insert()
RETURNS TRIGGER AS $$
BEGIN
  -- Mark the related booking as completed and set documents_generated.contract = true
  UPDATE public.bookings
  SET 
    status = 'completed',
    documents_generated = COALESCE(documents_generated, '{}'::jsonb) || jsonb_build_object('contract', true),
    updated_at = now()
  WHERE id = NEW.booking_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create the trigger
DROP TRIGGER IF EXISTS trigger_contract_signature_insert ON public.contract_signatures;
CREATE TRIGGER trigger_contract_signature_insert
  AFTER INSERT ON public.contract_signatures
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_contract_signature_insert();