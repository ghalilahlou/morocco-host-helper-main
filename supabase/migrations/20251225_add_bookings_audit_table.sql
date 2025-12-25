-- 📊 MIGRATION : Table d'audit pour le suivi complet des réservations
-- Permet d'analyser l'état des réservations même après suppression

-- ✅ CRÉATION TABLE D'AUDIT
CREATE TABLE IF NOT EXISTS public.bookings_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('created', 'updated', 'deleted', 'status_changed', 'documents_added', 'guests_added')),
  old_data JSONB,
  new_data JSONB,
  changed_by UUID REFERENCES auth.users(id),
  changed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  reason TEXT,
  ip_address TEXT,
  user_agent TEXT
);

-- ✅ INDEXES POUR PERFORMANCE
CREATE INDEX IF NOT EXISTS idx_bookings_audit_booking_id ON public.bookings_audit(booking_id);
CREATE INDEX IF NOT EXISTS idx_bookings_audit_changed_at ON public.bookings_audit(changed_at);
CREATE INDEX IF NOT EXISTS idx_bookings_audit_action ON public.bookings_audit(action);

-- ✅ RLS (Row Level Security)
ALTER TABLE public.bookings_audit ENABLE ROW LEVEL SECURITY;

-- ✅ POLITIQUE RLS : Les utilisateurs peuvent voir l'audit de leurs propres réservations
CREATE POLICY "Users can view audit for their bookings"
ON public.bookings_audit
FOR SELECT
USING (
  booking_id IN (
    SELECT id FROM public.bookings 
    WHERE property_id IN (
      SELECT id FROM public.properties WHERE user_id = auth.uid()
    )
  )
);

-- ✅ TRIGGER : Enregistrer automatiquement les modifications
CREATE OR REPLACE FUNCTION public.audit_booking_changes()
RETURNS TRIGGER AS $$
BEGIN
  -- Enregistrer la modification
  INSERT INTO public.bookings_audit (
    booking_id,
    action,
    old_data,
    new_data,
    changed_at
  ) VALUES (
    COALESCE(NEW.id, OLD.id),
    CASE 
      WHEN TG_OP = 'INSERT' THEN 'created'
      WHEN TG_OP = 'UPDATE' THEN 
        CASE 
          WHEN OLD.status != NEW.status THEN 'status_changed'
          WHEN (OLD.documents_generated IS NULL OR OLD.documents_generated = '{}'::jsonb)
            AND (NEW.documents_generated IS NOT NULL AND NEW.documents_generated != '{}'::jsonb)
          THEN 'documents_added'
          ELSE 'updated'
        END
      WHEN TG_OP = 'DELETE' THEN 'deleted'
    END,
    CASE WHEN TG_OP = 'DELETE' THEN row_to_json(OLD)::jsonb ELSE NULL END,
    CASE WHEN TG_OP != 'DELETE' THEN row_to_json(NEW)::jsonb ELSE NULL END,
    now()
  );
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ✅ CRÉER LE TRIGGER
DROP TRIGGER IF EXISTS trigger_audit_booking_changes ON public.bookings;
CREATE TRIGGER trigger_audit_booking_changes
  AFTER INSERT OR UPDATE OR DELETE ON public.bookings
  FOR EACH ROW
  EXECUTE FUNCTION public.audit_booking_changes();

-- ✅ COMMENTAIRES
COMMENT ON TABLE public.bookings_audit IS 'Table d''audit pour suivre toutes les modifications des réservations, y compris les suppressions';
COMMENT ON COLUMN public.bookings_audit.action IS 'Type d''action : created, updated, deleted, status_changed, documents_added, guests_added';
COMMENT ON COLUMN public.bookings_audit.old_data IS 'Données avant modification (pour UPDATE/DELETE)';
COMMENT ON COLUMN public.bookings_audit.new_data IS 'Données après modification (pour INSERT/UPDATE)';

