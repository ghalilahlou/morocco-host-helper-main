-- Fix: column is_paused missing in user_subscriptions
-- Required by get_host_accounts_for_admin (Comptes & Consommation)

ALTER TABLE public.user_subscriptions
  ADD COLUMN IF NOT EXISTS is_paused BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.user_subscriptions.is_paused IS 'Compte en pause : consommation épuisée ou blocage admin. Bloque l''accès host.';
