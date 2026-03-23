-- Fix: infinite recursion in admin_users RLS policies
-- The policies were checking admin_users by SELECTing from admin_users, causing recursion.
-- Solution: Use a SECURITY DEFINER function that bypasses RLS when checking admin status.

-- 1. Create helper function (runs as owner, bypasses RLS)
CREATE OR REPLACE FUNCTION public.is_admin_user(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.admin_users
    WHERE user_id = p_user_id
    AND role IN ('admin', 'super_admin')
    AND (is_active IS NULL OR is_active = true)
  );
$$;

CREATE OR REPLACE FUNCTION public.is_super_admin_user(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.admin_users
    WHERE user_id = p_user_id
    AND role = 'super_admin'
    AND (is_active IS NULL OR is_active = true)
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_admin_user(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_super_admin_user(UUID) TO authenticated;

-- 2. Drop recursive policies
DROP POLICY IF EXISTS "Admins can view all admin records" ON public.admin_users;
DROP POLICY IF EXISTS "Super admins can manage admin users" ON public.admin_users;
DROP POLICY IF EXISTS "Super admins can insert admin users" ON public.admin_users;
DROP POLICY IF EXISTS "read_admin_users" ON public.admin_users;

-- 3. Create non-recursive policies using the helper functions
CREATE POLICY "Admins can view all admin records" ON public.admin_users
  FOR SELECT USING (public.is_admin_user(auth.uid()));

CREATE POLICY "Super admins can manage admin users" ON public.admin_users
  FOR ALL
  USING (public.is_super_admin_user(auth.uid()))
  WITH CHECK (public.is_super_admin_user(auth.uid()));

-- Ensure users can always read their own record (for initial admin check)
DROP POLICY IF EXISTS "Users can read their own admin record" ON public.admin_users;
CREATE POLICY "Users can read their own admin record" ON public.admin_users
  FOR SELECT USING (auth.uid() = user_id);

COMMENT ON FUNCTION public.is_admin_user(UUID) IS 'Vérifie si un utilisateur est admin (évite la récursion RLS)';
COMMENT ON FUNCTION public.is_super_admin_user(UUID) IS 'Vérifie si un utilisateur est super_admin (évite la récursion RLS)';
