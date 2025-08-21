import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders() });
  }

  try {
    let requestBody;
    let propertyId, token, airbnbCode;
    
    // More robust request parsing
    try {
      const text = await req.text();
      console.log('🔍 Raw request text:', text);
      requestBody = text ? JSON.parse(text) : {};
      console.log('🔍 Parsed request body:', requestBody);
    } catch (parseError) {
      console.log('❌ JSON parse error:', parseError);
      requestBody = {};
    }
    
    propertyId = requestBody.propertyId;
    token = requestBody.token;
    airbnbCode = requestBody.airbnbCode;

    // Debug logging
    console.log('🔍 Extracted params:', { propertyId, token, airbnbCode });
    console.log('🔍 propertyId exists:', !!propertyId, 'token exists:', !!token);

    if (!propertyId || !token) {
      console.log('❌ Missing required params - propertyId:', !!propertyId, 'token:', !!token);
      return new Response(JSON.stringify({ ok: false, reason: 'BAD_REQUEST', details: `Missing propertyId (${!!propertyId}) or token (${!!token})` }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders() },
      });
    }

    const url = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const server = createClient(url, serviceKey, { auth: { persistSession: false } });

    // Debug log
    console.log('Resolving guest link:', { propertyId, token, airbnbCode });

    // Try with airbnbCode first if present
    let bookingRow = null;
    if (airbnbCode) {
      const { data, error } = await server
        .from('property_verification_tokens')
        .select('*, properties!inner(id, name, address, contract_template, contact_info, house_rules)')
        .eq('property_id', propertyId)
        .eq('token', token)
        .eq('booking_id', airbnbCode)
        .eq('is_active', true)
        .maybeSingle();

      if (error) {
        console.error('lookup by airbnbCode error:', error);
      } else {
        bookingRow = data;
      }
    }

    // Fallback: lookup without airbnbCode (for general tokens)
    if (!bookingRow) {
      const { data, error } = await server
        .from('property_verification_tokens')
        .select('*, properties!inner(id, name, address, contract_template, contact_info, house_rules)')
        .eq('property_id', propertyId)
        .eq('token', token)
        .eq('is_active', true)
        .is('booking_id', null)  // Only tokens without specific booking_id
        .maybeSingle();

      if (error) {
        console.error('fallback lookup error:', error);
      } else {
        bookingRow = data;
      }
    }

    if (!bookingRow) {
      return new Response(JSON.stringify({ ok: false, reason: 'NOT_FOUND' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json', ...corsHeaders() },
      });
    }

    // Build response payload
    const payload = {
      ok: true,
      propertyId: bookingRow.property_id,
      bookingId: bookingRow.booking_id ?? null,
      token: bookingRow.token,
      property: bookingRow.properties,
    };

    return new Response(JSON.stringify(payload), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders() },
    });
  } catch (e) {
    console.error('resolve-guest-link exception:', e);
    return new Response(JSON.stringify({ ok: false, reason: 'SERVER_ERROR' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders() },
    });
  }
});