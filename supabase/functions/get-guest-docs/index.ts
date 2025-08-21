import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('🚀 get-guest-docs function started');
    
    const url = Deno.env.get('SUPABASE_URL');
    const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!url || !key) {
      console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
      return new Response(JSON.stringify({ 
        documents: [], 
        error: 'Missing environment variables' 
      }), {
        status: 200, // Return 200 instead of 500
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const server = createClient(url, key, { auth: { persistSession: false } });

    // Safely parse request body
    let requestBody = {};
    try {
      const text = await req.text();
      if (text) {
        requestBody = JSON.parse(text);
      }
    } catch (parseError) {
      console.warn('⚠️ Failed to parse request body, using defaults:', parseError);
    }

    const { propertyId, bookingId, airbnbCode, guestNames = [], limit = 200 } = requestBody as any;
    
    console.log('📋 Request params:', { propertyId, bookingId, airbnbCode, guestNamesLength: guestNames?.length, limit });

    // Primary query logic: use booking_id if provided, fallback to property-based query
    let query;
    
    if (bookingId) {
      console.log('📋 Using booking_id-based query:', bookingId);
      
      // Query the view directly with booking_id - much more reliable
      query = server
        .from('v_guest_submissions')
        .select(`
          id,
          guest_data,
          document_urls,
          created_at,
          updated_at,
          submitted_at
        `)
        .eq('booking_id', bookingId)
        .order('created_at', { ascending: false })
        .limit(limit);
        
      // Also include uploaded documents from the uploaded_documents table
      const { data: uploadedDocs } = await server
        .from('uploaded_documents')
        .select(`
          id,
          file_name,
          document_url,
          created_at,
          extracted_data
        `)
        .eq('booking_id', bookingId)
        .order('created_at', { ascending: false })
        .limit(limit);
        
      console.log(`📋 Found ${uploadedDocs?.length || 0} uploaded documents for booking`);
      
    } else if (propertyId) {
      console.log('📋 Using property-based fallback query:', propertyId);
      
      // Fallback to property-based query for backward compatibility
      query = server
        .from('v_guest_submissions')
        .select(`
          id,
          guest_data,
          document_urls,
          created_at,
          updated_at,
          submitted_at
        `)
        .eq('property_id', propertyId)
        .order('created_at', { ascending: false })
        .limit(limit);
        
      if (airbnbCode) {
        // Still filter by airbnb code in JSON field as fallback
        query = query.filter('booking_data->airbnb_reservation_code', 'eq', airbnbCode);
        console.log('📋 Adding airbnbCode filter:', airbnbCode);
      }
    } else {
      return new Response(JSON.stringify({ 
        documents: [], 
        error: 'Either bookingId or propertyId is required' 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const { data: submissions, error } = await query;

    if (error) {
      console.error('❌ Database query error:', error);
      throw error;
    }

    console.log(`📋 Found ${submissions?.length || 0} guest submissions`);
    
    const result = [];

    // Add uploaded documents if we have booking_id
    if (bookingId) {
      try {
        const { data: uploadedDocs } = await server
          .from('uploaded_documents')
          .select(`
            id,
            file_name,
            file_path,
            created_at,
            extracted_data,
            guests(full_name)
          `)
          .eq('booking_id', bookingId)
          .order('created_at', { ascending: false });

        console.log(`📋 Found ${uploadedDocs?.length || 0} uploaded documents`);

        for (const doc of uploadedDocs || []) {
          try {
            // Generate signed URL for uploaded document
            let documentUrl = null;
            if (doc.file_path) {
              const { data: signedData } = await server.storage
                .from('guest-documents')
                .createSignedUrl(doc.file_path, 3600);
              documentUrl = signedData?.signedUrl;
            }

            if (documentUrl) {
              result.push({
                id: `uploaded-${doc.id}`,
                fullName: (doc as any).guests?.full_name || 'Host Upload',
                files: [{
                  name: doc.file_name,
                  url: documentUrl
                }],
                createdAt: doc.created_at,
                submittedAt: doc.created_at
              });
            }
          } catch (docError) {
            console.error('❌ Error processing uploaded document:', doc.id, docError);
          }
        }
      } catch (uploadError) {
        console.warn('⚠️ Error fetching uploaded documents:', uploadError);
      }
    }

    for (const submission of submissions || []) {
      try {
        // Extract guest information - handle multiple possible data structures
        const guestData = submission.guest_data || {};
        
        // Try different possible structures for guest name
        let fullName = 'Guest';
        if (guestData.guests && Array.isArray(guestData.guests) && guestData.guests[0]) {
          // Structure: { guests: [{ fullName: "..." }] }
          fullName = guestData.guests[0].fullName || guestData.guests[0].full_name || 'Guest';
        } else if (guestData.fullName) {
          // Structure: { fullName: "..." }
          fullName = guestData.fullName;
        } else if (guestData.full_name) {
          // Structure: { full_name: "..." }
          fullName = guestData.full_name;
        } else if (guestData.given_names && guestData.surname) {
          // Structure: { given_names: "...", surname: "..." }
          fullName = guestData.given_names + ' ' + guestData.surname;
        }

        // Apply optional guest name filtering only if guestNames provided and non-empty
        if (guestNames && Array.isArray(guestNames) && guestNames.length > 0) {
          const normalizedSubmissionName = fullName
            .toString()
            .normalize('NFKD')
            .replace(/[^\p{L}\s'-]/gu, '')
            .replace(/\s+/g, ' ')
            .trim()
            .toLowerCase();
          
          if (!guestNames.includes(normalizedSubmissionName)) {
            console.log(`📋 Skipping ${fullName} - not in guest list (normalized: "${normalizedSubmissionName}")`);
            continue;
          }
        }

        const files = [];
        const documentUrls = submission.document_urls || [];
        
        for (const docPath of documentUrls) {
          try {
            // Generate signed URL using service role
            const { data: signedData } = await server.storage
              .from('guest-documents')
              .createSignedUrl(docPath, 3600);
              
            if (signedData?.signedUrl) {
              files.push({
                name: docPath.split('/').pop() || 'document',
                url: signedData.signedUrl
              });
            } else {
              files.push({
                name: docPath.split('/').pop() || 'document',
                url: 'URL_GENERATION_FAILED'
              });
            }
          } catch (urlError) {
            console.error('❌ Error generating signed URL for:', docPath, urlError);
            files.push({
              name: docPath.split('/').pop() || 'document',
              url: 'URL_GENERATION_FAILED'
            });
          }
        }

        result.push({
          id: submission.id,
          fullName,
          files,
          createdAt: submission.created_at,
          submittedAt: submission.submitted_at
        });
      } catch (submissionError) {
        console.error('❌ Error processing submission:', submission.id, submissionError);
      }
    }

    console.log(`✅ Returning ${result.length} processed guest documents`);
    
    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('❌ Error in get-guest-docs:', error);
    // Return 200 with empty array instead of 500 to prevent UI breaks
    return new Response(JSON.stringify({ 
      documents: [],
      error: error.message || 'Unknown error occurred' 
    }), {
      status: 200, // Changed from 500 to 200
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});