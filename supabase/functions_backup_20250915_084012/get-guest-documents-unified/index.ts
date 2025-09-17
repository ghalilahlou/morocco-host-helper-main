import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

interface DocumentInfo {
  id: string;
  type: 'identity' | 'contract' | 'police';
  fileName: string;
  url: string;
  guestName?: string;
  createdAt: string;
  isSigned?: boolean;
  signedAt?: string;
}

interface GuestDocumentSummary {
  bookingId: string;
  guestCount: number;
  documents: {
    identity: DocumentInfo[];
    contract: DocumentInfo[];
    police: DocumentInfo[];
  };
  summary: {
    totalDocuments: number;
    hasAllRequired: boolean;
    missingTypes: string[];
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('🚀 get-guest-documents-unified function started');
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!supabaseUrl || !serviceRoleKey) {
      console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
      return new Response(JSON.stringify({ 
        error: 'Missing environment variables' 
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, { 
      auth: { persistSession: false } 
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

    const { bookingId, propertyId } = requestBody as any;
    
    if (!bookingId && !propertyId) {
      return new Response(JSON.stringify({ 
        error: 'Either bookingId or propertyId is required' 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log('📋 Request params:', { bookingId, propertyId });

    // Get booking information
    let bookingQuery = supabase
      .from('bookings')
      .select(`
        id,
        property_id,
        check_in_date,
        check_out_date,
        number_of_guests,
        status,
        guests(id, full_name, document_number, nationality, document_type)
      `);

    if (bookingId) {
      bookingQuery = bookingQuery.eq('id', bookingId);
    } else if (propertyId) {
      bookingQuery = bookingQuery.eq('property_id', propertyId);
    }

    const { data: bookings, error: bookingError } = await bookingQuery;

    if (bookingError) {
      console.error('❌ Database error fetching bookings:', bookingError);
      return new Response(JSON.stringify({ 
        error: 'Database query failed' 
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (!bookings || bookings.length === 0) {
      return new Response(JSON.stringify({ 
        bookings: [],
        message: 'No bookings found' 
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log(`📋 Found ${bookings.length} booking(s)`);

    // Process each booking
    const results = await Promise.all(
      bookings.map(async (booking) => {
        console.log(`📋 Processing booking: ${booking.id}`);

        // Get all documents for this booking
        const { data: documents, error: docsError } = await supabase
          .from('uploaded_documents')
          .select(`
            id,
            file_name,
            document_url,
            document_type,
            is_signed,
            signed_at,
            created_at,
            guests(full_name)
          `)
          .eq('booking_id', booking.id)
          .order('created_at', { ascending: false });

        if (docsError) {
          console.error(`❌ Error fetching documents for booking ${booking.id}:`, docsError);
          return {
            bookingId: booking.id,
            error: 'Failed to fetch documents'
          };
        }

        // Categorize documents
        const categorizedDocs = {
          identity: [] as DocumentInfo[],
          contract: [] as DocumentInfo[],
          police: [] as DocumentInfo[]
        };

        for (const doc of documents || []) {
          const docInfo: DocumentInfo = {
            id: doc.id,
            type: doc.document_type as 'identity' | 'contract' | 'police',
            fileName: doc.file_name,
            url: doc.document_url,
            guestName: (doc.guests as any)?.full_name,
            createdAt: doc.created_at,
            isSigned: doc.is_signed,
            signedAt: doc.signed_at
          };

          // Generate signed URL for storage files
          if (doc.document_url && doc.document_url.startsWith('guest-documents/')) {
            try {
              const { data: signedData } = await supabase.storage
                .from('guest-documents')
                .createSignedUrl(doc.document_url, 3600);
              
              if (signedData?.signedUrl) {
                docInfo.url = signedData.signedUrl;
              }
            } catch (urlError) {
              console.error('❌ Error generating signed URL:', urlError);
            }
          }

          // Categorize by type
          if (docInfo.type === 'identity' || docInfo.type === 'id-cards') {
            categorizedDocs.identity.push(docInfo);
          } else if (docInfo.type === 'contract') {
            categorizedDocs.contract.push(docInfo);
          } else if (docInfo.type === 'police') {
            categorizedDocs.police.push(docInfo);
          }
        }

        // Calculate summary
        const totalDocuments = categorizedDocs.identity.length + 
                              categorizedDocs.contract.length + 
                              categorizedDocs.police.length;

        const missingTypes = [];
        if (categorizedDocs.identity.length === 0) missingTypes.push('identity');
        if (categorizedDocs.contract.length === 0) missingTypes.push('contract');
        if (categorizedDocs.police.length === 0) missingTypes.push('police');

        const summary: GuestDocumentSummary = {
          bookingId: booking.id,
          guestCount: booking.guests?.length || 0,
          documents: categorizedDocs,
          summary: {
            totalDocuments,
            hasAllRequired: missingTypes.length === 0,
            missingTypes
          }
        };

        console.log(`✅ Processed booking ${booking.id}: ${totalDocuments} documents`);
        return summary;
      })
    );

    console.log(`✅ Returning ${results.length} processed bookings`);
    
    return new Response(JSON.stringify({
      success: true,
      bookings: results,
      totalBookings: results.length
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('❌ Error in get-guest-documents-unified:', error);
    return new Response(JSON.stringify({ 
      error: error.message || 'Unknown error occurred' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
