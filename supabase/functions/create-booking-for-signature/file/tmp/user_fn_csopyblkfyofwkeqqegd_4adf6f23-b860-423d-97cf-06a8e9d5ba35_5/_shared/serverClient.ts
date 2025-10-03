export async function getServerClient() {
  const url = Deno.env.get('SB_URL') ?? Deno.env.get('SUPABASE_URL');
  const key = Deno.env.get('SB_SERVICE_ROLE_KEY') ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !key) {
    throw new Error('Missing SB_URL/SB_SERVICE_ROLE_KEY (or SUPABASE_* fallbacks).');
  }
  const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
  return createClient(url, key, {
    auth: {
      persistSession: false
    }
  });
}
