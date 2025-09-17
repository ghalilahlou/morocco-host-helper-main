import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { addCorsHeaders, handleOptions } from '../_shared/cors.ts';
import { handleError, ValidationError, NotFoundError } from '../_shared/errors.ts';
import { getServerClient, verifyPropertyToken } from '../_shared/serverClient.ts';

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

    // ✅ CORRECTION : Rechercher une réservation active ou récente
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

    // ✅ CORRECTION : Format de réponse compatible avec le frontend
    const responseData = {
      success: true,
      propertyId: resolvedPropertyId,
      bookingId: booking?.id || null,
      token: token,
      property: property,
      booking: booking
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