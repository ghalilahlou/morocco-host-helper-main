-- Admin : accès aux ID et documents (uploaded_documents) pour tous les bookings
-- Les super_admin peuvent consulter les documents de toutes les réservations

CREATE POLICY "Admin can view all uploaded documents"
  ON public.uploaded_documents FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.admin_users au
      WHERE au.user_id = auth.uid()
      AND au.role IN ('admin', 'super_admin')
      AND (au.is_active IS NULL OR au.is_active = true)
    )
  );
