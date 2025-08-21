import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.53.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // More robust request parsing
    let requestBody;
    let propertyId, bookingId;
    
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
    bookingId = requestBody.bookingId;

    console.log('🔍 Searching for Airbnb reservation:', { propertyId, bookingId });

    if (!propertyId || !bookingId) {
      return new Response(
        JSON.stringify({ error: 'Missing propertyId or bookingId' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Query airbnb_reservations using service role key (bypasses RLS)
    const { data: reservations, error } = await supabase
      .from('airbnb_reservations')
      .select('airbnb_booking_id, guest_name, start_date, end_date, summary, description, number_of_guests, raw_event_data')
      .eq('property_id', propertyId);

    if (error) {
      console.error('❌ Database error:', error);
      return new Response(
        JSON.stringify({ error: 'Database query failed' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`📋 Found ${reservations?.length || 0} reservations for property ${propertyId}`);

    if (!reservations || reservations.length === 0) {
      return new Response(
        JSON.stringify({ reservation: null, message: 'No reservations found' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Try to find a matching reservation
    let matchedReservation = null;

    // First try exact match
    matchedReservation = reservations.find(r => 
      r.airbnb_booking_id === bookingId ||
      r.airbnb_booking_id?.includes(bookingId)
    );

    // If no exact match, try partial match in description
    if (!matchedReservation) {
      matchedReservation = reservations.find(r => 
        r.description?.includes(bookingId) ||
        r.airbnb_booking_id?.split('_')[0] === bookingId ||
        // Check if the booking code is contained in the description
        (r.description && bookingId.length >= 5 && r.description.includes(bookingId))
      );
    }

    // NEW: Search in raw event data if still no match
    if (!matchedReservation) {
      console.log('🔍 Searching in raw event data for booking code:', bookingId);
      matchedReservation = reservations.find(r => {
        const rawEvent = (r.raw_event_data as any)?.rawEvent || '';
        const hasBookingCode = rawEvent.includes(bookingId.toUpperCase()) || 
                              rawEvent.includes(bookingId.toLowerCase());
        
        if (hasBookingCode) {
          console.log('✅ Found booking code in raw event data:', {
            reservationId: r.airbnb_booking_id,
            searchedCode: bookingId
          });
          return true;
        }
        return false;
      });
    }

    console.log('🎯 Matching result:', { 
      searchedId: bookingId, 
      found: !!matchedReservation,
      matchedId: matchedReservation?.airbnb_booking_id
    });

    return new Response(
      JSON.stringify({ 
        reservation: matchedReservation,
        totalReservations: reservations.length,
        searchedId: bookingId
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('❌ Function error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})