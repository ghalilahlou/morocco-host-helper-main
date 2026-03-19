-- Logique Tokens Backoffice : mise en pause auto + activation admin
-- 1. is_paused : compte en pause (consommation épuisée ou blocage admin)
-- 2. Trigger : auto-pause quand check_in_count >= plan_limit
-- 3. RPC admin : lister comptes hosts + activer/désactiver

-- Colonne is_paused sur user_subscriptions
ALTER TABLE public.user_subscriptions
  ADD COLUMN IF NOT EXISTS is_paused BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.user_subscriptions.is_paused IS 'Compte en pause : consommation épuisée ou blocage admin. Bloque l''accès host.';

-- Trigger : auto-pause quand consommation épuisée
CREATE OR REPLACE FUNCTION public.auto_pause_on_limit_exceeded()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Si plan_limit est défini et check_in_count >= plan_limit
  IF NEW.plan_limit IS NOT NULL AND NEW.check_in_count >= NEW.plan_limit THEN
    NEW.is_paused := true;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_pause_user_subscription ON public.user_subscriptions;
CREATE TRIGGER trg_auto_pause_user_subscription
  BEFORE INSERT OR UPDATE OF check_in_count, plan_limit
  ON public.user_subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_pause_on_limit_exceeded();

-- Policy : admin peut lire et mettre à jour is_paused pour tous les comptes
CREATE POLICY "Admin can view all subscriptions"
  ON public.user_subscriptions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.admin_users au
      WHERE au.user_id = auth.uid()
      AND au.role IN ('admin', 'super_admin')
      AND (au.is_active IS NULL OR au.is_active = true)
    )
  );

CREATE POLICY "Admin can update is_paused"
  ON public.user_subscriptions FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.admin_users au
      WHERE au.user_id = auth.uid()
      AND au.role IN ('admin', 'super_admin')
      AND (au.is_active IS NULL OR au.is_active = true)
    )
  )
  WITH CHECK (true);

-- RPC : lister les comptes hosts avec statut subscription (pour admin)
CREATE OR REPLACE FUNCTION public.get_host_accounts_for_admin()
RETURNS TABLE (
  user_id UUID,
  email TEXT,
  full_name TEXT,
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
  -- Vérifier que l'appelant est admin
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

GRANT EXECUTE ON FUNCTION public.get_host_accounts_for_admin() TO authenticated;

-- RPC : admin active/désactive un compte (toggle is_paused)
CREATE OR REPLACE FUNCTION public.admin_set_host_account_paused(
  p_user_id UUID,
  p_is_paused BOOLEAN
)
RETURNS BOOLEAN
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

  UPDATE public.user_subscriptions
  SET is_paused = p_is_paused,
      updated_at = NOW()
  WHERE user_id = p_user_id;

  RETURN FOUND;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_set_host_account_paused(UUID, BOOLEAN) TO authenticated;

COMMENT ON FUNCTION public.get_host_accounts_for_admin IS 'Liste les comptes hosts avec statut subscription pour le backoffice admin';
COMMENT ON FUNCTION public.admin_set_host_account_paused IS 'Active ou désactive (pause) un compte host depuis le backoffice';
