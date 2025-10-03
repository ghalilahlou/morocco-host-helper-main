import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// Proxy interne vers issue-guest-link (action: 'resolve')
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const proxyBody = {
      action: 'resolve',
      propertyId: body.propertyId,
      token: body.token,
      airbnbCode: body.airbnbCode
    };

    const base = Deno.env.get('SUPABASE_URL');
    const path = '/functions/v1/issue-guest-link';
    if (!base) {
      return new Response(JSON.stringify({ success: false, error: 'Missing SUPABASE_URL' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const apiKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || Deno.env.get('SB_SERVICE_ROLE_KEY');
    const headers: Record<string,string> = { 'Content-Type': 'application/json' };
    if (apiKey) {
      headers['apikey'] = apiKey;
      headers['Authorization'] = `Bearer ${apiKey}`;
    }

    const resp = await fetch(`${base}${path}`, { method: 'POST', headers, body: JSON.stringify(proxyBody) });
    const data = await resp.text();
    return new Response(data, { status: resp.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e) {
    return new Response(JSON.stringify({ success: false, error: 'proxy_error', details: e?.message || String(e) }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});


