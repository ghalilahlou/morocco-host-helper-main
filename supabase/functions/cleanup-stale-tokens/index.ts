import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// S10 -- Nettoyage quotidien des tokens inactifs et des bookings de prévisualisation orphelins.
// À déployer en cron Supabase : schedule = "0 3 * * *" (3h UTC chaque nuit).

const corsHeaders = { 'Access-Control-Allow-Origin': '*' };

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const url = Deno.env.get('SUPABASE_URL');
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !key) {
    return new Response(JSON.stringify({ error: 'Config manquante' }), { status: 500, headers: corsHeaders });
  }

  const client = createClient(url, key, { auth: { persistSession: false } });
  const results: Record<string, unknown> = {};

  // 1. Supprimer les tokens inactifs de plus de 90 jours
  try {
    const { count: tokensDeleted, error } = await client
      .from('property_verification_tokens')
      .delete({ count: 'exact' })
      .eq('is_active', false)
      .lt('created_at', new Date(Date.now() - 90 * 24 * 3600 * 1000).toISOString());

    if (error) throw error;
    results.stale_tokens_deleted = tokensDeleted ?? 0;
    console.log(` Tokens inactifs supprimés : ${tokensDeleted}`);
  } catch (e) {
    results.stale_tokens_error = String(e);
    console.error('Erreur suppression tokens:', e);
  }

  // 2. Supprimer les tokens expirés actifs de plus de 30 jours (grace period)
  try {
    const { count: expiredDeleted, error } = await client
      .from('property_verification_tokens')
      .delete({ count: 'exact' })
      .eq('is_active', true)
      .not('expires_at', 'is', null)
      .lt('expires_at', new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString());

    if (error) throw error;
    results.expired_active_tokens_deleted = expiredDeleted ?? 0;
    console.log(` Tokens expirés (grace 30j) supprimés : ${expiredDeleted}`);
  } catch (e) {
    results.expired_tokens_error = String(e);
    console.error('Erreur suppression tokens expirés:', e);
  }

  // 3. Supprimer les bookings is_preview=true de plus de 1 heure (S6)
  try {
    const { count: previewsDeleted, error } = await client
      .from('bookings')
      .delete({ count: 'exact' })
      .eq('is_preview', true)
      .lt('created_at', new Date(Date.now() - 3600 * 1000).toISOString());

    if (error) throw error;
    results.preview_bookings_deleted = previewsDeleted ?? 0;
    console.log(` Bookings preview orphelins supprimés : ${previewsDeleted}`);
  } catch (e) {
    // is_preview n'existe peut-être pas encore -- non bloquant
    results.preview_bookings_note = 'Colonne is_preview absente ou erreur: ' + String(e);
  }

  // 4. Statistiques pour monitoring
  try {
    const { count: totalTokens } = await client
      .from('property_verification_tokens')
      .select('*', { count: 'exact', head: true });
    const { count: activeTokens } = await client
      .from('property_verification_tokens')
      .select('*', { count: 'exact', head: true })
      .eq('is_active', true);
    results.total_tokens_remaining = totalTokens;
    results.active_tokens_remaining = activeTokens;
  } catch (e) {
    results.stats_error = String(e);
  }

  console.log(' Cleanup terminé:', results);

  return new Response(JSON.stringify({ success: true, results, ran_at: new Date().toISOString() }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});
