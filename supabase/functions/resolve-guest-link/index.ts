import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { addCorsHeaders, handleOptions } from '../_shared/cors.ts';
import { handleError, ValidationError, NotFoundError } from '../_shared/errors.ts';
import { getServerClient, verifyPropertyToken } from '../_shared/serverClient.ts';
import { hashAccessCode, isAirbnbCode } from '../_shared/security.ts';

serve(async (req) => {
  try {
    if (req.method === 'OPTIONS') {
      return handleOptions(req);
    }

    if (req.method !== 'POST') {
      throw new ValidationError('Method not allowed');
    }

    const { token, propertyId, airbnbCode } = await req.json();
    
    console.log('🔍 resolve-guest-link called with:', { 
      hasToken: !!token, 
      hasPropertyId: !!propertyId, 
      hasAirbnbCode: !!airbnbCode 
    });

    // ✅ CORRECTION : Accepter propertyId en paramètre ou le dériver du token
    let resolvedPropertyId = propertyId;
    
    if (token && !propertyId) {
      resolvedPropertyId = await verifyPropertyToken(token);
      if (!resolvedPropertyId) {
        throw new ValidationError('Invalid token');
      }
    } else if (!token && !propertyId) {
      throw new ValidationError('Missing token or propertyId');
    }

    const client = await getServerClient();

    // Get property details
    const { data: property, error: propertyError } = await client
      .from('properties')
      .select('id, name, address, contract_template, contact_info, house_rules')
      .eq('id', resolvedPropertyId)
      .single();

    if (propertyError || !property) {
      throw new NotFoundError('Property not found', { propertyError });
    }

    // ✅ Rechercher une réservation active ou récente
    let booking = null;
    const { data: bookings, error: bookingError } = await client
      .from('bookings')
      .select('*')
      .eq('property_id', resolvedPropertyId)
      .in('status', ['active', 'pending', 'confirmed'])
      .order('created_at', { ascending: false })
      .limit(1);

    if (bookingError) {
      console.warn('⚠️ No booking found for property:', bookingError);
    } else if (bookings && bookings.length > 0) {
      booking = bookings[0];
    }

    // ✅ Vérifier si le token nécessite un code (access_code_hash non NULL)
    const { data: tokenRow } = await client
      .from('property_verification_tokens')
      .select('access_code_hash, airbnb_confirmation_code, used_count, expires_at')
      .eq('token', token)
      .eq('property_id', resolvedPropertyId)
      .maybeSingle();

    let requiresCode = !!tokenRow?.access_code_hash;

    // 410 expired if token has expires_at < now
    if (tokenRow?.expires_at && new Date(tokenRow.expires_at) < new Date()) {
      return addCorsHeaders(new Response(JSON.stringify({
        success: false,
        error: 'expired'
      }), { status: 410, headers: { 'Content-Type': 'application/json' } }));
    }

    // If code required, verify provided airbnbCode by comparing hashes
    if (requiresCode) {
      if (!airbnbCode || !isAirbnbCode(String(airbnbCode))) {
        return addCorsHeaders(new Response(JSON.stringify({
          success: false,
          error: 'code_required',
          requiresCode: true
        }), { status: 403, headers: { 'Content-Type': 'application/json' } }));
      }

      const providedHash = await hashAccessCode(String(airbnbCode).toUpperCase());
      if (providedHash !== tokenRow!.access_code_hash) {
        return addCorsHeaders(new Response(JSON.stringify({
          success: false,
          error: 'invalid_code',
          requiresCode: true
        }), { status: 401, headers: { 'Content-Type': 'application/json' } }));
      }

      // Update used_count and last_used_at on success
      try {
        await client
          .from('property_verification_tokens')
          .update({
            used_count: (tokenRow!.used_count ?? 0) + 1,
            last_used_at: new Date().toISOString()
          })
          .eq('token', token)
          .eq('property_id', resolvedPropertyId);
      } catch (_) {}
    }

    // ✅ Format de réponse
    const responseData = {
      success: true,
      propertyId: resolvedPropertyId,
      bookingId: booking?.id || null,
      token: token,
      property: property,
      booking: booking,
      requiresCode
    };

    console.log('✅ resolve-guest-link success:', { 
      propertyId: resolvedPropertyId, 
      hasBooking: !!booking 
    });

    const response = new Response(
      JSON.stringify(responseData),
      { headers: { 'Content-Type': 'application/json' } }
    );

    return addCorsHeaders(response);
  } catch (error) {
    console.error('❌ resolve-guest-link error:', error);
    return handleError(error);
  }
})