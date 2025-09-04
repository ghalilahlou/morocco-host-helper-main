// Last redeploy: 2025-09-03 18:00:43
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

    // FIXED: Search for ANY token that matches propertyId and token, regardless of booking_id
    let bookingRow = null;
    
    // First, try to find the token in guest_verification_tokens (new system)
    const { data: guestTokenData, error: guestTokenError } = await server
      .from('guest_verification_tokens')
      .select(`
        *,
        bookings!inner(
          id,
          property_id,
          properties!inner(id, name, address, contract_template, contact_info, house_rules)
        )
      `)
      .eq('token', token)
      .eq('is_active', true)
      .eq('bookings.property_id', propertyId)
      .maybeSingle();

    if (guestTokenError) {
      console.error('Guest token lookup error:', guestTokenError);
    } else if (guestTokenData) {
      bookingRow = {
        ...guestTokenData,
        property_id: guestTokenData.bookings.property_id,
        properties: guestTokenData.bookings.properties,
        booking_id: guestTokenData.booking_id
      };
      console.log('✅ Guest token found:', { hasBookingId: !!guestTokenData.booking_id });
    }

    // Fallback: try property_verification_tokens (legacy system)
    if (!bookingRow) {
      const { data: propertyTokenData, error: propertyTokenError } = await server
        .from('property_verification_tokens')
        .select('*, properties!inner(id, name, address, contract_template, contact_info, house_rules)')
        .eq('property_id', propertyId)
        .eq('token', token)
        .eq('is_active', true)
        .maybeSingle();

      if (propertyTokenError) {
        console.error('Property token lookup error:', propertyTokenError);
      } else if (propertyTokenData) {
        bookingRow = propertyTokenData;
        console.log('✅ Property token found (legacy):', { hasBookingId: !!propertyTokenData.booking_id });
      }
    }

    if (!bookingRow) {
      return new Response(JSON.stringify({ ok: false, reason: 'NOT_FOUND', details: 'Token not found or inactive' }), {
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