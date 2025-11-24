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

    // ✅ CORRECTION : Récupérer les guests depuis la table directement si la relation ne fonctionne pas
    let guests = Array.isArray(booking.guests) ? booking.guests : [];
    
    if (guests.length === 0) {
      console.log('⚠️ No guests in relation, trying to fetch from guests table directly');
      const { data: guestsData, error: guestsError } = await supabase
        .from('guests')
        .select('*')
        .eq('booking_id', bookingId);
      
      if (guestsError) {
        console.error('❌ Error fetching guests:', guestsError);
      } else if (guestsData && guestsData.length > 0) {
        console.log(`✅ Found ${guestsData.length} guests in guests table`);
        guests = guestsData;
        booking.guests = guests; // Attacher les guests au booking pour compatibilité
      } else {
        console.warn('⚠️ No guests found in guests table either');
      }
    }

    console.log('✅ Booking found, proceeding with document generation', {
      hasProperty: !!booking.property,
      guestsCount: guests.length
    });

    const generatedDocuments = [];
    const documentUrls = [];

    // ✅ CORRECTION : Utiliser submit-guest-info-unified qui est la fonction unifiée
    // Cette fonction gère mieux la récupération des guests et la variabilisation

    // Générer le contrat automatiquement
    if (documentType === 'all' || documentType === 'contract') {
      try {
        console.log('📄 Generating contract via submit-guest-info-unified...');
        const { data: contractData, error: contractError } = await supabase.functions.invoke('submit-guest-info-unified', {
          body: {
            action: 'generate_contract_only',
            bookingId: bookingId
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
          const contractUrl = contractData?.data?.contractUrl || contractData?.contractUrl || contractData?.documentUrl;
          console.log('✅ Contract generated successfully', { hasUrl: !!contractUrl });
          generatedDocuments.push({
            type: 'contract',
            url: contractUrl,
            success: true
          });
          if (contractUrl) {
            documentUrls.push(contractUrl);
          }
        }
      } catch (error) {
        console.error('❌ Contract generation failed:', error);
        generatedDocuments.push({
          type: 'contract',
          url: null,
          success: false,
          error: error instanceof Error ? error.message : 'Contract generation failed'
        });
      }
    }

    // Générer les formulaires de police automatiquement
    if (documentType === 'all' || documentType === 'police') {
      try {
        console.log('📄 Generating police forms via submit-guest-info-unified...');
        const { data: policeData, error: policeError } = await supabase.functions.invoke('submit-guest-info-unified', {
          body: {
            action: 'generate_police_only',
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
          const policeUrl = policeData?.data?.policeUrl || policeData?.policeUrl || policeData?.documentUrl;
          console.log('✅ Police forms generated successfully', { hasUrl: !!policeUrl });
          generatedDocuments.push({
            type: 'police',
            url: policeUrl,
            success: true
          });
          if (policeUrl) {
            documentUrls.push(policeUrl);
          }
        }
      } catch (error) {
        console.error('❌ Police forms generation failed:', error);
        generatedDocuments.push({
          type: 'police',
          url: null,
          success: false,
          error: error instanceof Error ? error.message : 'Police forms generation failed'
        });
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
      guestsCount: guests.length,
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
