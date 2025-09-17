import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: corsHeaders
    });
  }

  try {
    console.log('🚀 sync-documents function started');

    if (req.method !== 'POST') {
      return new Response(JSON.stringify({
        success: false,
        message: 'Method Not Allowed'
      }), {
        status: 405,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!supabaseUrl || !serviceRoleKey) {
      console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
      throw new Error('Missing required environment variables');
    }

    // Create service role client to bypass RLS
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        persistSession: false
      }
    });

    const { bookingId, documentType } = await req.json();
    
    console.log('📥 Request data:', {
      bookingId,
      documentType
    });

    if (!bookingId || !documentType) {
      return new Response(JSON.stringify({
        success: false,
        message: 'Missing required fields: bookingId and documentType'
      }), {
        status: 400,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }

    // Get booking with guests (using existing schema)
    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .select(`
        *,
        property:properties(*),
        guests:guests(*)
      `)
      .eq('id', bookingId)
      .single();

    if (bookingError || !booking) {
      console.error('❌ Booking not found:', bookingError);
      return new Response(JSON.stringify({
        success: false,
        message: 'Booking not found'
      }), {
        status: 404,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }

    if (!booking.property) {
      console.error('❌ Property not found for booking');
      return new Response(JSON.stringify({
        success: false,
        message: 'Property not found for booking'
      }), {
        status: 404,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }

    if (!booking.guests || booking.guests.length === 0) {
      console.error('❌ No guests found for booking');
      return new Response(JSON.stringify({
        success: false,
        message: 'No guests found for booking'
      }), {
        status: 400,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }

    console.log('✅ Booking and guests found, proceeding with document generation');

    const generatedDocuments = [];
    const documentUrls = [];

    // Générer le contrat automatiquement
    if (documentType === 'all' || documentType === 'contract') {
      try {
        console.log('📄 Generating contract...');
        const { data: contractData, error: contractError } = await supabase.functions.invoke('generate-contract', {
          body: {
            bookingId: bookingId,
            action: 'generate'
          },
          headers: {
            'Authorization': `Bearer ${serviceRoleKey}`,
            'apikey': serviceRoleKey
          }
        });

        if (contractError) {
          console.error('❌ Contract generation error:', contractError);
          generatedDocuments.push({
            type: 'contract',
            url: null,
            success: false,
            error: contractError.message || 'Contract generation failed'
          });
        } else {
          console.log('✅ Contract generated successfully');
          generatedDocuments.push({
            type: 'contract',
            url: contractData?.documentUrl,
            success: true
          });
          if (contractData?.documentUrl) {
            documentUrls.push(contractData.documentUrl);
          }
        }
      } catch (error) {
        console.error('❌ Contract generation failed:', error);
      }
    }

    // Générer les formulaires de police automatiquement
    if (documentType === 'all' || documentType === 'police') {
      try {
        console.log('📄 Generating police forms...');
        const { data: policeData, error: policeError } = await supabase.functions.invoke('generate-police-forms', {
          body: {
            bookingId: bookingId
          },
          headers: {
            'Authorization': `Bearer ${serviceRoleKey}`,
            'apikey': serviceRoleKey
          }
        });

        if (policeError) {
          console.error('❌ Police forms generation error:', policeError);
          generatedDocuments.push({
            type: 'police',
            url: null,
            success: false,
            error: policeError.message || 'Police forms generation failed'
          });
        } else {
          console.log('✅ Police forms generated successfully');
          generatedDocuments.push({
            type: 'police',
            url: policeData?.documentUrl,
            success: true
          });
          if (policeData?.documentUrl) {
            documentUrls.push(policeData.documentUrl);
          }
        }
      } catch (error) {
        console.error('❌ Police forms generation failed:', error);
      }
    }

    // Update booking status to indicate documents are generated
    const { error: updateError } = await supabase
      .from('bookings')
      .update({
        status: 'confirmed',
        documents_generated: {
          contract: documentType === 'all' || documentType === 'contract',
          police: documentType === 'all' || documentType === 'police',
          identity: true // Les documents d'identité sont déjà uploadés
        },
        updated_at: new Date().toISOString()
      })
      .eq('id', bookingId);

    if (updateError) {
      console.error('❌ Error updating booking status:', updateError);
    } else {
      console.log('✅ Booking status updated successfully');
    }

    console.log('✅ Documents generated successfully:', generatedDocuments.length);

    return new Response(JSON.stringify({
      success: true,
      message: 'Documents generated successfully',
      bookingId: bookingId,
      documentType: documentType,
      guestsCount: booking.guests.length,
      documents: generatedDocuments,
      documentUrls: documentUrls
    }), {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });

  } catch (error) {
    console.error('❌ Error in sync-documents:', error);
    return new Response(JSON.stringify({
      success: false,
      message: error instanceof Error ? error.message : 'Erreur inconnue'
    }), {
      status: 500,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  }
});
