-- Admin Dashboard Enrichment: email, username, token allocations, users, access control
-- Ajoute les RPC pour récupérer les données enrichies (email, nom d'utilisateur) depuis auth.users

-- Drop existing functions if they exist (required when changing return type)
DROP FUNCTION IF EXISTS public.get_token_allocations_for_admin();
DROP FUNCTION IF EXISTS public.get_all_users_for_admin();
DROP FUNCTION IF EXISTS public.admin_update_booking_status(UUID, TEXT);
DROP FUNCTION IF EXISTS public.admin_toggle_token_allocation(UUID, BOOLEAN);
DROP FUNCTION IF EXISTS public.get_host_accounts_for_admin();

-- Ensure user_subscriptions has is_paused (required by get_host_accounts_for_admin)
ALTER TABLE public.user_subscriptions
  ADD COLUMN IF NOT EXISTS is_paused BOOLEAN NOT NULL DEFAULT false;

-- 1. RPC: Allocations de tokens avec infos utilisateur (email, full_name comme username)
CREATE OR REPLACE FUNCTION public.get_token_allocations_for_admin()
RETURNS TABLE (
  id UUID,
  user_id UUID,
  user_email TEXT,
  user_name TEXT,
  tokens_allocated INTEGER,
  tokens_used INTEGER,
  tokens_remaining INTEGER,
  is_active BOOLEAN,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.admin_users au
    WHERE au.user_id = auth.uid()
    AND au.role IN ('admin', 'super_admin')
    AND (au.is_active IS NULL OR au.is_active = true)
  ) THEN
    RAISE EXCEPTION 'Accès non autorisé';
  END IF;

  RETURN QUERY
  SELECT
    ta.id,
    ta.user_id,
    u.email::TEXT AS user_email,
    COALESCE(u.raw_user_meta_data->>'full_name', u.raw_user_meta_data->>'user_name', split_part(u.email, '@', 1))::TEXT AS user_name,
    ta.tokens_allocated,
    ta.tokens_used,
    ta.tokens_remaining,
    ta.is_active,
    ta.created_at,
    ta.updated_at
  FROM public.token_allocations ta
  LEFT JOIN auth.users u ON u.id = ta.user_id
  ORDER BY ta.created_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_token_allocations_for_admin() TO authenticated;
COMMENT ON FUNCTION public.get_token_allocations_for_admin IS 'Liste les allocations de tokens avec email et nom utilisateur pour le dashboard admin';

-- 2. RPC: Tous les utilisateurs (auth.users) enrichis pour l'admin
CREATE OR REPLACE FUNCTION public.get_all_users_for_admin()
RETURNS TABLE (
  id UUID,
  email TEXT,
  full_name TEXT,
  user_name TEXT,
  created_at TIMESTAMPTZ,
  last_sign_in_at TIMESTAMPTZ,
  is_admin BOOLEAN,
  admin_role TEXT,
  is_admin_active BOOLEAN,
  properties_count BIGINT,
  total_bookings BIGINT,
  last_booking_date DATE
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.admin_users au
    WHERE au.user_id = auth.uid()
    AND au.role IN ('admin', 'super_admin')
    AND (au.is_active IS NULL OR au.is_active = true)
  ) THEN
    RAISE EXCEPTION 'Accès non autorisé';
  END IF;

  RETURN QUERY
  SELECT
    u.id,
    u.email::TEXT,
    COALESCE(u.raw_user_meta_data->>'full_name', u.email)::TEXT AS full_name,
    COALESCE(u.raw_user_meta_data->>'user_name', split_part(u.email, '@', 1))::TEXT AS user_name,
    u.created_at,
    u.last_sign_in_at,
    (au.user_id IS NOT NULL) AS is_admin,
    au.role::TEXT AS admin_role,
    COALESCE(au.is_active, false) AS is_admin_active,
    (SELECT COUNT(*) FROM public.properties p WHERE p.user_id = u.id) AS properties_count,
    (SELECT COUNT(*) FROM public.bookings b JOIN public.properties p ON p.id = b.property_id WHERE p.user_id = u.id) AS total_bookings,
    (SELECT MAX(b.check_in_date::date) FROM public.bookings b JOIN public.properties p ON p.id = b.property_id WHERE p.user_id = u.id) AS last_booking_date
  FROM auth.users u
  LEFT JOIN public.admin_users au ON au.user_id = u.id
  ORDER BY u.created_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_all_users_for_admin() TO authenticated;
COMMENT ON FUNCTION public.get_all_users_for_admin IS 'Liste tous les utilisateurs avec email, username, propriétés et réservations pour le dashboard admin';

-- 3. RPC: Mise à jour statut réservation (admin)
CREATE OR REPLACE FUNCTION public.admin_update_booking_status(
  p_booking_id UUID,
  p_status TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.admin_users au
    WHERE au.user_id = auth.uid()
    AND au.role IN ('admin', 'super_admin')
    AND (au.is_active IS NULL OR au.is_active = true)
  ) THEN
    RAISE EXCEPTION 'Accès non autorisé';
  END IF;

  IF p_status NOT IN ('pending', 'confirmed', 'completed', 'cancelled') THEN
    RAISE EXCEPTION 'Statut invalide: %', p_status;
  END IF;

  UPDATE public.bookings
  SET status = p_status::booking_status,
      updated_at = NOW()
  WHERE id = p_booking_id;

  RETURN FOUND;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_update_booking_status(UUID, TEXT) TO authenticated;
COMMENT ON FUNCTION public.admin_update_booking_status IS 'Met à jour le statut d''une réservation (admin)';

-- 4. RPC: Révoquer/réactiver allocation de tokens
CREATE OR REPLACE FUNCTION public.admin_toggle_token_allocation(
  p_allocation_id UUID,
  p_is_active BOOLEAN
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.admin_users au
    WHERE au.user_id = auth.uid()
    AND au.role IN ('admin', 'super_admin')
    AND (au.is_active IS NULL OR au.is_active = true)
  ) THEN
    RAISE EXCEPTION 'Accès non autorisé';
  END IF;

  UPDATE public.token_allocations
  SET is_active = p_is_active,
      updated_at = NOW()
  WHERE id = p_allocation_id;

  RETURN FOUND;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_toggle_token_allocation(UUID, BOOLEAN) TO authenticated;
COMMENT ON FUNCTION public.admin_toggle_token_allocation IS 'Active ou désactive une allocation de tokens (admin)';

-- 5. Mise à jour get_host_accounts_for_admin pour inclure user_name
CREATE OR REPLACE FUNCTION public.get_host_accounts_for_admin()
RETURNS TABLE (
  user_id UUID,
  email TEXT,
  full_name TEXT,
  user_name TEXT,
  plan TEXT,
  check_in_count INTEGER,
  plan_limit INTEGER,
  is_paused BOOLEAN,
  created_at TIMESTAMPTZ,
  properties_count BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.admin_users au
    WHERE au.user_id = auth.uid()
    AND au.role IN ('admin', 'super_admin')
    AND (au.is_active IS NULL OR au.is_active = true)
  ) THEN
    RAISE EXCEPTION 'Accès non autorisé';
  END IF;

  RETURN QUERY
  SELECT
    us.user_id,
    au.email::TEXT,
    COALESCE(au.raw_user_meta_data->>'full_name', au.email)::TEXT AS full_name,
    COALESCE(au.raw_user_meta_data->>'user_name', split_part(au.email, '@', 1))::TEXT AS user_name,
    us.plan::TEXT,
    us.check_in_count,
    us.plan_limit,
    us.is_paused,
    us.created_at,
    (SELECT COUNT(*) FROM public.properties p WHERE p.user_id = us.user_id) AS properties_count
  FROM public.user_subscriptions us
  JOIN auth.users au ON au.id = us.user_id
  ORDER BY us.updated_at DESC;
END;
$$;
