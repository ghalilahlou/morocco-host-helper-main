import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};
serve(async (req)=>{
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: corsHeaders
    });
  }
  try {
    console.log('🚀 get-booking-verification-summary function started');
    const url = Deno.env.get('SUPABASE_URL');
    const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!url || !key) {
      console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
      return new Response(JSON.stringify({
        summaries: [],
        error: 'Missing environment variables'
      }), {
        status: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
    const server = createClient(url, key, {
      auth: {
        persistSession: false
      }
    });
    // Parse request body
    let requestBody = {};
    try {
      const text = await req.text();
      if (text) {
        requestBody = JSON.parse(text);
      }
    } catch (parseError) {
      console.warn('⚠️ Failed to parse request body, using defaults:', parseError);
    }
    const { bookingIds, propertyId } = requestBody;
    console.log('📊 Request params:', {
      bookingIds: bookingIds?.length,
      propertyId
    });
    let query = server.from('v_booking_verification_summary').select(`
        booking_id,
        guest_submissions_count,
        uploaded_documents_count,
        has_signature
      `);
    if (bookingIds && Array.isArray(bookingIds)) {
      // Query specific bookings
      query = query.in('booking_id', bookingIds);
      console.log('📊 Filtering by booking IDs:', bookingIds.length);
    } else if (propertyId) {
      // Query all bookings for a property
      query = query.eq('property_id', propertyId);
      console.log('📊 Filtering by property ID:', propertyId);
    } else {
      return new Response(JSON.stringify({
        summaries: [],
        error: 'Either bookingIds or propertyId is required'
      }), {
        status: 400,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
    const { data: summaries, error } = await query;
    if (error) {
      console.error('❌ Database query error:', error);
      throw error;
    }
    console.log(`📊 Found ${summaries?.length || 0} booking summaries`);
    return new Response(JSON.stringify(summaries || []), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  } catch (error) {
    console.error('❌ Error in get-booking-verification-summary:', error);
    return new Response(JSON.stringify({
      summaries: [],
      error: error.message || 'Unknown error occurred'
    }), {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  }
});
