-- Permet aux comptes listés dans admin_users (admin / super_admin) de consulter et gérer
-- l'ensemble des propriétés, réservations et voyageurs pour le back-office, sans contourner
-- la propriété des hôtes pour les utilisateurs non-admin.

-- Propriétés : lecture / mise à jour / suppression pour support (les politiques « owner » restent en parallèle)
DROP POLICY IF EXISTS "Admins can view all properties" ON public.properties;
CREATE POLICY "Admins can view all properties" ON public.properties
  FOR SELECT USING (public.is_admin_user(auth.uid()));

DROP POLICY IF EXISTS "Admins can update all properties" ON public.properties;
CREATE POLICY "Admins can update all properties" ON public.properties
  FOR UPDATE USING (public.is_admin_user(auth.uid()))
  WITH CHECK (public.is_admin_user(auth.uid()));

DROP POLICY IF EXISTS "Admins can delete all properties" ON public.properties;
CREATE POLICY "Admins can delete all properties" ON public.properties
  FOR DELETE USING (public.is_admin_user(auth.uid()));

-- Réservations
DROP POLICY IF EXISTS "Admins can view all bookings" ON public.bookings;
CREATE POLICY "Admins can view all bookings" ON public.bookings
  FOR SELECT USING (public.is_admin_user(auth.uid()));

DROP POLICY IF EXISTS "Admins can update all bookings" ON public.bookings;
CREATE POLICY "Admins can update all bookings" ON public.bookings
  FOR UPDATE USING (public.is_admin_user(auth.uid()))
  WITH CHECK (public.is_admin_user(auth.uid()));

-- Invités (détails réservation côté admin)
DROP POLICY IF EXISTS "Admins can view all guests" ON public.guests;
CREATE POLICY "Admins can view all guests" ON public.guests
  FOR SELECT USING (public.is_admin_user(auth.uid()));

-- Profils hôtes (nom affiché dans le détail propriété admin)
DROP POLICY IF EXISTS "Admins can view all host profiles" ON public.host_profiles;
CREATE POLICY "Admins can view all host profiles" ON public.host_profiles
  FOR SELECT USING (public.is_admin_user(auth.uid()));
