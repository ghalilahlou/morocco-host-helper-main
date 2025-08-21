
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { getServerClient } from '../_shared/serverClient.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  console.log('🚀 Issue guest link function called');

  try {
    const { propertyId, bookingId } = await req.json();
    
    if (!propertyId) {
      return new Response(
        JSON.stringify({ error: 'Property ID is required' }), 
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log('🔗 Issuing guest link for property:', { propertyId, bookingId });

    const server = await getServerClient();

    // If no bookingId is provided, try to find the most recent active booking for this property
    let finalBookingId = bookingId;
    if (!bookingId) {
      console.log('📅 No bookingId provided, searching for recent bookings...');
      const { data: recentBooking } = await server
        .from('bookings')
        .select('id')
        .eq('property_id', propertyId)
        .gte('check_out_date', new Date().toISOString().split('T')[0]) // Future or current bookings
        .order('check_in_date', { ascending: true })
        .limit(1)
        .maybeSingle();
      
      if (recentBooking) {
        finalBookingId = recentBooking.id;
        console.log('✅ Found recent booking:', finalBookingId);
      } else {
        console.log('⚠️ No active bookings found for property');
      }
    }

    // Check if property exists first
    const { data: property, error: propertyError } = await server
      .from('properties')
      .select('id, name')
      .eq('id', propertyId)
      .maybeSingle();

    if (propertyError || !property) {
      console.error('❌ Property not found:', propertyError);
      return new Response(
        JSON.stringify({ error: 'Property not found' }), 
        { 
          status: 404, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Check if a token already exists for this property (and booking if provided)
    let tokenQuery = server
      .from('property_verification_tokens')
      .select('*')
      .eq('property_id', propertyId)
      .eq('is_active', true);

    // If finalBookingId is provided, include it in the query
    if (finalBookingId) {
      tokenQuery = tokenQuery.eq('booking_id', finalBookingId);
    } else {
      tokenQuery = tokenQuery.is('booking_id', null);
    }

    const { data: existingToken, error: existingError } = await tokenQuery
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existingError) {
      console.error('❌ Error checking existing token:', existingError);
    }

    let token: string;
    let tokenRecord: any;

    if (existingToken && existingToken.is_active) {
      // Use existing active token
      token = existingToken.token;
      tokenRecord = existingToken;
      console.log('♻️ Using existing token');
    } else {
      // Generate a new token
      token = crypto.randomUUID() + '-' + crypto.randomUUID();
      
      const tokenData: any = {
        property_id: propertyId,
        token: token,
        is_active: true
      };

      // Add booking_id if provided
      if (finalBookingId) {
        tokenData.booking_id = finalBookingId;
      }

      const { data: newToken, error: createError } = await server
        .from('property_verification_tokens')
        .insert(tokenData)
        .select()
        .single();

      if (createError) {
        console.error('❌ Error creating token:', createError);
        return new Response(
          JSON.stringify({ error: 'Failed to create verification token' }), 
          { 
            status: 500, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );
      }

      token = newToken.token;
      tokenRecord = newToken;
      console.log('✅ Created new token');
    }

    // Generate the full URL
    const origin = req.headers.get('origin') || 'http://localhost:5173';
    const link = finalBookingId 
      ? `${origin}/welcome/${propertyId}/${token}/${finalBookingId}`
      : `${origin}/welcome/${propertyId}/${token}`;

    console.log('✅ Generated guest link:', { link, propertyId, bookingId: finalBookingId });

    return new Response(
      JSON.stringify({ 
        link, 
        token,
        expiresAt: tokenRecord.created_at // Using created_at as reference since we don't have expires_at
      }), 
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('❌ Error in issue-guest-link function:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }), 
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
