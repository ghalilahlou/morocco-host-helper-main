-- Afficher TOUS les utilisateurs dans Comptes & Consommation
-- Avant : seulement les users avec user_subscriptions (créés à la 1ère connexion)
-- Après : tous les users de auth.users, avec valeurs par défaut si pas de subscription

DROP FUNCTION IF EXISTS public.get_host_accounts_for_admin();

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
SET search_path = public
AS $$
BEGIN
  -- Vérification admin (utilise la fonction pour éviter la récursion RLS)
  IF NOT public.is_admin_user(auth.uid()) THEN
    RAISE EXCEPTION 'Accès non autorisé';
  END IF;

  RETURN QUERY
  SELECT
    u.id AS user_id,
    u.email::TEXT,
    COALESCE(u.raw_user_meta_data->>'full_name', u.email)::TEXT AS full_name,
    COALESCE(u.raw_user_meta_data->>'user_name', split_part(u.email, '@', 1))::TEXT AS user_name,
    COALESCE(us.plan, 'pay_per_check')::TEXT AS plan,
    COALESCE(us.check_in_count, 0)::INTEGER AS check_in_count,
    us.plan_limit,
    COALESCE(us.is_paused, false)::BOOLEAN AS is_paused,
    u.created_at,
    (SELECT COUNT(*) FROM public.properties p WHERE p.user_id = u.id)::BIGINT AS properties_count
  FROM auth.users u
  LEFT JOIN public.user_subscriptions us ON us.user_id = u.id
  ORDER BY u.created_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_host_accounts_for_admin() TO authenticated;
COMMENT ON FUNCTION public.get_host_accounts_for_admin IS 'Liste TOUS les utilisateurs avec leurs informations de subscription (Comptes & Consommation)';

-- Mise à jour admin_set_host_account_paused : créer la subscription si elle n'existe pas
CREATE OR REPLACE FUNCTION public.admin_set_host_account_paused(
  p_user_id UUID,
  p_is_paused BOOLEAN
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin_user(auth.uid()) THEN
    RAISE EXCEPTION 'Accès non autorisé';
  END IF;

  -- Insérer la subscription si elle n'existe pas
  INSERT INTO public.user_subscriptions (user_id, plan, check_in_count, plan_limit, is_paused, created_at, updated_at)
  VALUES (p_user_id, 'pay_per_check', 0, NULL, p_is_paused, NOW(), NOW())
  ON CONFLICT (user_id) DO UPDATE
  SET is_paused = p_is_paused, updated_at = NOW();

  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_set_host_account_paused(UUID, BOOLEAN) TO authenticated;
