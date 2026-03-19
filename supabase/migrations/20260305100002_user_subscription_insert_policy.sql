-- Permettre aux utilisateurs d'insérer leur propre abonnement (création initiale)
-- Le policy "Service role can insert" avec CHECK(true) est trop permissif pour le client
DROP POLICY IF EXISTS "Service role can insert subscriptions" ON public.user_subscriptions;

CREATE POLICY "Users can insert own subscription"
  ON public.user_subscriptions FOR INSERT
  WITH CHECK (auth.uid() = user_id);
