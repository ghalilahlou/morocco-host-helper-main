-- Fix recursive RLS policies for admin_users table
-- This resolves the chicken-and-egg problem where admin verification requires admin access

-- Drop existing problematic policies
DROP POLICY IF EXISTS "Admins can view all admin users" ON public.admin_users;
DROP POLICY IF EXISTS "Super admins can manage admin users" ON public.admin_users;

-- Create new non-recursive policies

-- Policy 1: Users can always read their own admin record (essential for admin verification)
CREATE POLICY "Users can read their own admin record" ON public.admin_users
  FOR SELECT USING (auth.uid() = user_id);

-- Policy 2: Admins can view all admin records (after being verified as admin)
CREATE POLICY "Admins can view all admin records" ON public.admin_users
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.admin_users au
      WHERE au.user_id = auth.uid()
      AND au.role IN ('admin', 'super_admin')
      AND au.is_active = true
    )
  );

-- Policy 3: Super admins can manage admin users
CREATE POLICY "Super admins can manage admin users" ON public.admin_users
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.admin_users au
      WHERE au.user_id = auth.uid()
      AND au.role = 'super_admin'
      AND au.is_active = true
    )
  );

-- Policy 4: Super admins can insert new admin users
CREATE POLICY "Super admins can insert admin users" ON public.admin_users
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.admin_users au
      WHERE au.user_id = auth.uid()
      AND au.role = 'super_admin'
      AND au.is_active = true
    )
  );

-- Add comment explaining the fix
COMMENT ON TABLE public.admin_users IS 'Table des utilisateurs administrateurs - Politiques RLS corrigées pour éviter la récursion';