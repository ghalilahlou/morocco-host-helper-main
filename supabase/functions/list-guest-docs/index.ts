import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { getServerClient } from '../_shared/serverClient.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const { bookingId, propertyId } = await req.json();
    
    if (!bookingId && !propertyId) {
      return new Response(
        JSON.stringify({ error: 'bookingId or propertyId required' }), 
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const server = await getServerClient();

    console.log('📋 Fetching guest docs for:', { bookingId, propertyId });

    // Build query for guest submissions
    let query = server
      .from('guest_submissions')
      .select(`
        id,
        booking_data,
        guest_data,
        document_urls,
        created_at,
        token_id
      `)
      .order('created_at', { ascending: false });

    // Filter by booking ID first, then property if no booking ID
    if (bookingId) {
      // For booking-specific requests, look for submissions with this booking data
      query = query.contains('booking_data', { bookingId });
    } else if (propertyId) {
      // For property-wide requests, get all submissions for this property
      // We need to join with property_verification_tokens to filter by property
      const { data: tokenData, error: tokenError } = await server
        .from('property_verification_tokens')
        .select('id')
        .eq('property_id', propertyId);

      if (tokenError || !tokenData?.length) {
        console.log('❌ No tokens found for property:', propertyId);
        return new Response(
          JSON.stringify([]), 
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const tokenIds = tokenData.map(t => t.id);
      query = query.in('token_id', tokenIds);
    }

    const { data: submissions, error } = await query;

    if (error) {
      console.error('❌ Database error:', error);
      return new Response(
        JSON.stringify({ error: 'Database error' }), 
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`📋 Found ${submissions?.length || 0} guest submissions`);

    // Process submissions and generate signed URLs for storage files
    const processedDocs = await Promise.all(
      (submissions || []).map(async (submission) => {
        const guestData = submission.guest_data;
        const documentUrls = submission.document_urls || [];
        
        // Extract guest info from the first guest in the data
        const firstGuest = guestData?.guests?.[0] || {};
        const fullName = firstGuest.fullName || 'Unknown Guest';
        const documentType = firstGuest.documentType || 'unknown';
        const documentNumber = firstGuest.documentNumber || 'N/A';

        // Process document URLs and generate signed URLs for storage files
        const files = await Promise.all(
          documentUrls.map(async (docUrl: string, index: number) => {
            let signedUrl = docUrl;
            
            // Check if this is a Supabase Storage path
            if (docUrl.includes('/storage/v1/object/') || docUrl.startsWith('guest-documents/')) {
              try {
                // Extract the path from the URL or use as-is if it's already a path
                let storagePath = docUrl;
                if (docUrl.includes('/storage/v1/object/')) {
                  // Extract path from full URL
                  const pathMatch = docUrl.match(/\/storage\/v1\/object\/[^\/]+\/([^?]+)/);
                  storagePath = pathMatch ? pathMatch[1] : docUrl;
                }
                
                // Generate signed URL (valid for 1 hour)
                const { data: signedData, error: signError } = await server.storage
                  .from('guest-documents')
                  .createSignedUrl(storagePath, 60 * 60);

                if (signError) {
                  console.warn('⚠️ Failed to sign URL:', storagePath, signError);
                } else if (signedData?.signedUrl) {
                  signedUrl = signedData.signedUrl;
                }
              } catch (signErr) {
                console.warn('⚠️ Error processing storage URL:', docUrl, signErr);
              }
            }

            return {
              name: `Document ${index + 1} - ${documentType}`,
              url: signedUrl
            };
          })
        );

        return {
          id: submission.id,
          fullName,
          documentType,
          documentNumber,
          files,
          createdAt: submission.created_at
        };
      })
    );

    console.log(`✅ Processed ${processedDocs.length} guest document submissions`);

    return new Response(
      JSON.stringify(processedDocs), 
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (err) {
    console.error('❌ Function error:', err);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }), 
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});