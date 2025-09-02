import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('🚀 submit-guest-info function started');
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!supabaseUrl || !serviceRoleKey) {
      console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
      throw new Error('Missing required environment variables');
    }

    // Create service role client to bypass RLS
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false }
    });

    // Only allow POST
    if (req.method !== 'POST') {
      return new Response(JSON.stringify({
        success: false,
        message: 'Method Not Allowed'
      }), {
        status: 405,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const { propertyId, token, bookingData, guestData } = await req.json();
    
    console.log('📥 Request data:', {
      propertyId,
      hasBookingData: !!bookingData,
      hasGuestData: !!guestData,
      hasToken: !!token
    });

    // Basic validation
    if (!propertyId || !bookingData) {
      return new Response(JSON.stringify({
        success: false,
        message: 'Champs manquants: propertyId ou bookingData'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Get property info for user_id
    const { data: propertyData, error: propertyError } = await supabase
      .from('properties')
      .select('user_id')
      .eq('id', propertyId)
      .single();

    if (propertyError || !propertyData) {
      console.error('❌ Property query failed:', propertyError);
      return new Response(JSON.stringify({
        success: false,
        message: 'Propriété introuvable'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Resolve token (prefer exact if provided; else latest active for property)
    let tokenDataRes;
    if (token) {
      tokenDataRes = await supabase
        .from('property_verification_tokens')
        .select('id')
        .eq('property_id', propertyId)
        .eq('token', token)
        .eq('is_active', true)
        .maybeSingle();
    } else {
      tokenDataRes = await supabase
        .from('property_verification_tokens')
        .select('id')
        .eq('property_id', propertyId)
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
    }

    const { data: tokenData, error: tokenError } = tokenDataRes;
    if (tokenError || !tokenData) {
      console.error('❌ Token query failed:', tokenError);
      return new Response(JSON.stringify({
        success: false,
        message: 'Token invalide ou inactif'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Step 1: Ensure a guest submission row (manual find-or-create)
    console.log('📝 Resolving guest submission...');
    let submissionId = null;
    
    // Extract document URLs from guest data
    const documentUrls = guestData?.documentUrls || [];
    console.log('📎 Document URLs to save:', documentUrls);

    // Try to find the most recent submission for this token_id
    const { data: existingSubmission } = await supabase
      .from('guest_submissions')
      .select('id')
      .eq('token_id', tokenData.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existingSubmission?.id) {
      submissionId = existingSubmission.id;
      const { error: updateSubErr } = await supabase
        .from('guest_submissions')
        .update({
          booking_data: bookingData,
          guest_data: guestData,
          document_urls: Array.isArray(guestData?.documentUrls) ? guestData.documentUrls : [],
          submitted_at: new Date().toISOString(),
          status: 'completed'
        })
        .eq('id', submissionId);

      if (updateSubErr) {
        console.error('❌ Failed to update submission:', updateSubErr);
        return new Response(JSON.stringify({
          success: false,
          message: 'Échec de la mise à jour de la soumission'
        }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      console.log('✅ Updated existing submission:', submissionId);
    } else {
      const { data: newSub, error: subErr } = await supabase
        .from('guest_submissions')
        .insert({
          token_id: tokenData.id,
          booking_data: bookingData,
          guest_data: guestData,
          document_urls: Array.isArray(guestData?.documentUrls) ? guestData.documentUrls : [],
          submitted_at: new Date().toISOString(),
          status: 'completed'
        })
        .select('id')
        .single();

      if (subErr || !newSub) {
        console.error('❌ Guest submission failed:', subErr);
        return new Response(JSON.stringify({
          success: false,
          message: 'Échec de la création de la soumission'
        }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      submissionId = newSub.id;
      console.log('✅ Created new submission:', submissionId);
    }

    // Step 2: ✅ CORRECTION - TOUJOURS créer une nouvelle réservation (pas de réutilisation dangereuse)
    console.log('📅 Creating new booking...');
    let bookingId = null;

    const toIsoOrNull = (d) => d ? new Date(d).toISOString() : null;
    const checkInDate = toIsoOrNull(bookingData?.checkInDate);
    const checkOutDate = toIsoOrNull(bookingData?.checkOutDate);

    // ✅ CORRECTION: Toujours créer une nouvelle réservation pour chaque soumission
    const payload = {
      property_id: propertyId,
      user_id: propertyData.user_id,
      check_in_date: checkInDate,
      check_out_date: checkOutDate,
      number_of_guests: bookingData?.numberOfGuests ?? guestData?.guests?.length ?? 1,
      status: 'pending',
      submission_id: submissionId
    };

    const { data: newBooking, error: newErr } = await supabase
      .from('bookings')
      .insert(payload)
      .select('id')
      .single();

    if (newErr || !newBooking) {
      console.error('❌ Booking creation failed:', newErr);
      return new Response(JSON.stringify({
        success: false,
        message: 'Échec de la création de la réservation'
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    
    bookingId = newBooking.id;
    console.log('✅ New booking created:', bookingId);

    // ✅ CORRECTION: Lier le token à la réservation
    console.log('🔗 Linking token to booking...');
    const { error: tokenUpdateError } = await supabase
      .from('property_verification_tokens')
      .update({ booking_id: bookingId })
      .eq('id', tokenData.id);

    if (tokenUpdateError) {
      console.error('❌ Failed to link token to booking:', tokenUpdateError);
    } else {
      console.log('✅ Token linked to booking:', { tokenId: tokenData.id, bookingId });
    }

    // Step 3: Create guests records in the guests table
    console.log('👥 Creating guests records...');
    let insertedGuests = [];
    
    if (guestData?.guests && Array.isArray(guestData.guests) && bookingId) {
      // Insert new guests
      const guestsData = guestData.guests.map((guest) => ({
        booking_id: bookingId,
        full_name: guest.fullName,
        date_of_birth: guest.dateOfBirth,
        document_number: guest.documentNumber,
        nationality: guest.nationality,
        place_of_birth: guest.placeOfBirth || '',
        document_type: guest.documentType
      }));

      const { error: insertError, data: guestInsertData } = await supabase
        .from('guests')
        .insert(guestsData)
        .select('id, full_name');

      if (insertError) {
        console.error('❌ Failed to insert guests:', insertError);
        return new Response(JSON.stringify({
          success: false,
          message: 'Échec de la création des invités'
        }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      insertedGuests = guestInsertData || [];
      console.log(`✅ Inserted ${guestsData.length} guests for booking ${bookingId}`);

      // Step 4: ✅ CORRECTION - Save documents to uploaded_documents table
      console.log('📄 Processing uploaded documents...');
      if (documentUrls && documentUrls.length > 0 && insertedGuests.length > 0) {
        for (let i = 0; i < documentUrls.length && i < insertedGuests.length; i++) {
          const documentUrl = documentUrls[i];
          const guest = insertedGuests[i];
          
          if (documentUrl && guest) {
            try {
              // Extract file path from signed URL
              let filePath = '';
              
              if (documentUrl.includes('/guest-documents/')) {
                const pathMatch = documentUrl.match(/\/guest-documents\/([^?]+)/);
                if (pathMatch) {
                  filePath = pathMatch[1];
                  console.log('✅ Extracted file path:', filePath);
                } else {
                  console.error('❌ Could not extract file path from URL:', documentUrl);
                  filePath = `unknown_${Date.now()}_${guest.full_name}`;
                }
              } else {
                console.error('❌ Invalid document URL format:', documentUrl);
                filePath = `unknown_${Date.now()}_${guest.full_name}`;
              }
              
              // Create record in uploaded_documents
              const documentRecord = {
                booking_id: bookingId,
                guest_id: guest.id,
                file_name: `ID_${guest.full_name}`,
                file_path: filePath,
                document_url: documentUrl,
                processing_status: 'completed',
                extracted_data: guestData.guests[i] ? {
                  fullName: guestData.guests[i].fullName,
                  documentType: guestData.guests[i].documentType,
                  documentNumber: guestData.guests[i].documentNumber,
                  nationality: guestData.guests[i].nationality,
                  dateOfBirth: guestData.guests[i].dateOfBirth,
                  placeOfBirth: guestData.guests[i].placeOfBirth
                } : null
              };

              const { error: docError } = await supabase
                .from('uploaded_documents')
                .insert(documentRecord);

              if (docError) {
                console.error('❌ Failed to save document record:', docError);
              } else {
                console.log('✅ Document record saved:', {
                  guestName: guest.full_name,
                  filePath: filePath,
                  bookingId: bookingId
                });
              }
            } catch (error) {
              console.error('❌ Error processing document URL:', error);
            }
          }
        }
      }
    }

    return new Response(JSON.stringify({
      success: true,
      bookingId,
      submissionId,
      tokenId: tokenData.id
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('❌ Error in submit-guest-info:', error);
    const message = error?.message || 'Unknown error occurred';
    return new Response(JSON.stringify({
      success: false,
      message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});