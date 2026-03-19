-- Table user_subscriptions : plan utilisateur et limites
-- Permet de gérer Pay per Check, Basic, Premium et masquer les données check-in en cas de dépassement

CREATE TABLE IF NOT EXISTS public.user_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan VARCHAR(50) NOT NULL DEFAULT 'pay_per_check',
  -- pay_per_check | basic | premium
  check_in_count INTEGER NOT NULL DEFAULT 0,
  -- Nombre de vérifications/check-in effectuées dans la période
  plan_limit INTEGER,
  -- NULL = illimité pour premium, 15 pour basic, etc.
  period_start TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  period_end TIMESTAMPTZ,
  -- Pour abonnements mensuels
  stripe_customer_id VARCHAR(255),
  stripe_subscription_id VARCHAR(255),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id)
);

CREATE INDEX IF NOT EXISTS idx_user_subscriptions_user_id ON public.user_subscriptions(user_id);

ALTER TABLE public.user_subscriptions ENABLE ROW LEVEL SECURITY;

-- RLS : l'utilisateur ne voit que son propre abonnement
CREATE POLICY "Users can view own subscription"
  ON public.user_subscriptions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own subscription"
  ON public.user_subscriptions FOR UPDATE
  USING (auth.uid() = user_id);

-- Insert via service role ou trigger à la création de compte
CREATE POLICY "Service role can insert subscriptions"
  ON public.user_subscriptions FOR INSERT
  WITH CHECK (true);

COMMENT ON TABLE public.user_subscriptions IS 'Plans et limites des utilisateurs (Pay per Check, Basic, Premium)';
