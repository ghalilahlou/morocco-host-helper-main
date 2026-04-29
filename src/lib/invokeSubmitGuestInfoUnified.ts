import { supabase } from '@/integrations/supabase/client';

const FUNCTION_NAME = 'submit-guest-info-unified' as const;

/** Shown when Edge gateway rejects JWT (401) after a refresh attempt. */
export const EDGE_SESSION_EXPIRED_MESSAGE =
  'Votre session a expiré. Reconnectez-vous puis réessayez.';

type InvokeOptions = Parameters<(typeof supabase)['functions']['invoke']>[1];

function isFunctionsHttpUnauthorized(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const o = error as { name?: string; context?: { status?: number } };
  return o.name === 'FunctionsHttpError' && o.context?.status === 401;
}

/**
 * Invokes `submit-guest-info-unified` with the same options as {@link supabase.functions.invoke}.
 * On HTTP 401 (JWT rejected by the Edge gateway), attempts one `refreshSession` and retries once.
 */
export async function invokeSubmitGuestInfoUnified<T = unknown>(
  options: InvokeOptions = {}
): Promise<{ data: T | null; error: unknown; response?: Response }> {
  const run = () => supabase.functions.invoke<T>(FUNCTION_NAME, options);

  let result = await run();

  if (result.error && isFunctionsHttpUnauthorized(result.error)) {
    const { data: refreshed, error: refreshError } = await supabase.auth.refreshSession();

    if (refreshError || !refreshed.session) {
      return {
        data: null,
        error: Object.assign(new Error(EDGE_SESSION_EXPIRED_MESSAGE), {
          code: 'EDGE_UNAUTHORIZED',
        }),
        response: result.response,
      };
    }

    result = await run();

    if (result.error && isFunctionsHttpUnauthorized(result.error)) {
      return {
        data: null,
        error: Object.assign(new Error(EDGE_SESSION_EXPIRED_MESSAGE), {
          code: 'EDGE_UNAUTHORIZED',
        }),
        response: result.response,
      };
    }
  }

  return result;
}
