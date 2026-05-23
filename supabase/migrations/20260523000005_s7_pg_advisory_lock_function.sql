-- S7 : Fonction RPC pour acquérir un advisory lock sur un token pendant une soumission
-- Sérialise les soumissions concurrentes (2 onglets / 2 appareils) sur le même token.
-- Appelé par submit-guest-info-unified au début de la transaction.

CREATE OR REPLACE FUNCTION public.acquire_submission_lock(p_token TEXT)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  -- Acquiert un lock transactionnel (libéré automatiquement en fin de transaction)
  -- hashtext convertit le token en entier 32 bits pour pg_advisory_xact_lock
  PERFORM pg_advisory_xact_lock(hashtext('submit_guest:' || p_token));
END;
$$;

-- Seul le service_role peut appeler cette fonction (Edge Functions)
REVOKE ALL ON FUNCTION public.acquire_submission_lock(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.acquire_submission_lock(TEXT) TO service_role;

COMMENT ON FUNCTION public.acquire_submission_lock(TEXT) IS
  'S7 — Acquiert un advisory lock transactionnel sur un token de vérification invité.
   Empêche deux soumissions concurrentes sur le même token de créer des race conditions.
   Usage depuis Edge Function : SELECT acquire_submission_lock(''<token>'');';
