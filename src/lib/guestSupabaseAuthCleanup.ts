import { supabase } from '@/integrations/supabase/client';

/** Erreurs session Supabase quand le refresh stocké n'existe plus côté serveur */
const STALE_SESSION_MSG = /invalid refresh token|refresh token not found|jwt expired|session not found/i;

/**
 * Sur les parcours invité (lien dans l’email), le navigateur peut encore contenir une
 * session hôte ou une session expirée dans localStorage → refresh en boucle / JWT invalide
 * pour les appels `functions.invoke`. Nettoyer la session locale évite d’attacher un
 * Bearer invalide ; les Edge Functions avec verify_jwt=false utilisent l’apikey anon.
 */
export async function clearStaleSupabaseSessionIfNeeded(): Promise<void> {
  try {
    const { error } = await supabase.auth.getSession();
    if (error?.message && STALE_SESSION_MSG.test(error.message)) {
      await supabase.auth.signOut({ scope: 'local' });
      return;
    }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    if (STALE_SESSION_MSG.test(msg)) {
      await supabase.auth.signOut({ scope: 'local' }).catch(() => {});
    }
  }
}
