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

    if (!propertyId || !token || !bookingData || !guestData) {
      return new Response(JSON.stringify({
        success: false,
        message: 'Missing required parameters'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Verify token
    const { data: tokenData, error: tokenError } = await supabase
      .from('guest_verification_tokens')
      .select('*')
      .eq('token', token)
      .eq('is_active', true)
      .single();

    if (tokenError || !tokenData) {
      return new Response(JSON.stringify({
        success: false,
        message: 'Token invalide ou expiré'
      }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // ✅ CORRECTION : Logique "find or update/create" pour éviter les doublons
    console.log('🔍 Recherche d\'une réservation existante...');
    
    const { data: existingBookings, error: searchError } = await supabase
      .from('bookings')
      .select('*')
      .eq('property_id', propertyId)
      .eq('check_in_date', bookingData.checkInDate)
      .eq('check_out_date', bookingData.checkOutDate)
      .order('created_at', { ascending: false });

    if (searchError) {
      console.error('❌ Erreur lors de la recherche:', searchError);
      return new Response(JSON.stringify({
        success: false,
        message: 'Erreur lors de la recherche de réservation existante'
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    let bookingId: string;
    let isNewBooking = false;

    if (existingBookings && existingBookings.length > 0) {
      // ✅ CORRECTION : Mettre à jour la réservation existante
      const existingBooking = existingBookings[0];
      bookingId = existingBooking.id;
      
      console.log('✅ Réservation existante trouvée:', bookingId);
      
      // Mettre à jour la réservation existante
      const { error: updateError } = await supabase
        .from('bookings')
        .update({ 
          number_of_guests: bookingData.numberOfGuests,
          updated_at: new Date().toISOString()
        })
        .eq('id', bookingId);
        
      if (updateError) {
        console.error('❌ Erreur lors de la mise à jour:', updateError);
        return new Response(JSON.stringify({
          success: false,
          message: 'Erreur lors de la mise à jour de la réservation'
        }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      
      console.log('✅ Réservation mise à jour avec succès');
    } else {
      // ✅ CORRECTION : Créer une nouvelle réservation seulement si aucune n'existe
      console.log('🆕 Aucune réservation existante trouvée, création d\'une nouvelle...');
      
      const { data: newBooking, error: createError } = await supabase
        .from('bookings')
        .insert({
          property_id: propertyId,
          check_in_date: bookingData.checkInDate,
          check_out_date: bookingData.checkOutDate,
          number_of_guests: bookingData.numberOfGuests,
          status: 'pending',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select()
        .single();

      if (createError) {
        console.error('❌ Erreur lors de la création:', createError);
        return new Response(JSON.stringify({
          success: false,
          message: 'Erreur lors de la création de la réservation'
        }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      bookingId = newBooking.id;
      isNewBooking = true;
      console.log('✅ Nouvelle réservation créée:', bookingId);
    }

    // ✅ CORRECTION : Créer l'enregistrement de soumission seulement pour les nouvelles réservations
    if (isNewBooking) {
      console.log('📝 Création de l\'enregistrement de soumission...');
      
      const { data: submission, error: submissionError } = await supabase
        .from('submissions')
        .insert({
          booking_id: bookingId,
          status: 'submitted',
          submitted_at: new Date().toISOString(),
          created_at: new Date().toISOString()
        })
        .select()
        .single();

      if (submissionError) {
        console.error('❌ Erreur lors de la création de la soumission:', submissionError);
        return new Response(JSON.stringify({
          success: false,
          message: 'Erreur lors de la création de la soumission'
        }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Mettre à jour la réservation avec l'ID de soumission
      const { error: updateBookingError } = await supabase
        .from('bookings')
        .update({ 
          submission_id: submission.id,
          updated_at: new Date().toISOString()
        })
        .eq('id', bookingId);

      if (updateBookingError) {
        console.error('❌ Erreur lors de la mise à jour de la réservation:', updateBookingError);
      }

      console.log('✅ Enregistrement de soumission créé avec succès');
    } else {
      console.log('ℹ️ Réservation existante, pas de création d\'enregistrement de soumission');
    }

    // ✅ CORRECTION : Lier le token à la réservation seulement pour les nouvelles réservations
    if (isNewBooking) {
      console.log('🔗 Liaison du token à la réservation...');
      
      const { error: linkError } = await supabase
        .from('guest_verification_tokens')
        .update({ booking_id: bookingId })
        .eq('id', tokenData.id);

      if (linkError) {
        console.error('❌ Erreur lors de la liaison du token:', linkError);
        return new Response(JSON.stringify({
          success: false,
          message: 'Erreur lors de la liaison du token'
        }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      console.log('✅ Token lié à la réservation avec succès');
    } else {
      console.log('ℹ️ Réservation existante, pas de liaison de token');
    }

    // ✅ CORRECTION : Créer les enregistrements invité seulement pour les nouvelles réservations
    if (isNewBooking && guestData?.guests && Array.isArray(guestData.guests) && bookingId) {
      console.log('👥 Création des enregistrements invité...');
      
      const guestsData = guestData.guests.map((guest: any) => ({
        full_name: guest.fullName,
        date_of_birth: guest.dateOfBirth,
        nationality: guest.nationality,
        document_number: guest.documentNumber,
        document_type: guest.documentType,
        profession: guest.profession,
        motif_sejour: guest.motifSejour,
        adresse_personnelle: guest.adressePersonnelle,
        email: guest.email,
        booking_id: bookingId,
        created_at: new Date().toISOString()
      }));

      const { data: insertedGuests, error: guestsError } = await supabase
        .from('guests')
        .insert(guestsData)
        .select();

      if (guestsError) {
        console.error('❌ Erreur lors de la création des invités:', guestsError);
        return new Response(JSON.stringify({
          success: false,
          message: 'Erreur lors de la création des invités'
        }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      console.log(`✅ ${guestsData.length} invités créés avec succès`);
    } else {
      console.log('ℹ️ Réservation existante ou pas d\'invités, pas de création d\'enregistrements invité');
    }

    // ✅ CORRECTION : Créer les enregistrements de documents seulement pour les nouvelles réservations
    if (isNewBooking && guestData?.documentUrls && Array.isArray(guestData.documentUrls) && bookingId) {
      console.log('📄 Création des enregistrements de documents...');
      
      const documentsData = guestData.documentUrls.map((url: string) => ({
        booking_id: bookingId,
        document_url: url,
        document_type: 'identity',
        created_at: new Date().toISOString()
      }));

      const { data: insertedDocuments, error: documentsError } = await supabase
        .from('guest_documents')
        .insert(documentsData)
        .select();

      if (documentsError) {
        console.error('❌ Erreur lors de la création des documents:', documentsError);
        return new Response(JSON.stringify({
          success: false,
          message: 'Erreur lors de la création des documents'
        }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      console.log(`✅ ${documentsData.length} documents créés avec succès`);
    } else {
      console.log('ℹ️ Réservation existante ou pas de documents, pas de création d\'enregistrements de documents');
    }

    console.log('✅ Fonction submit-guest-info terminée avec succès');

    return new Response(JSON.stringify({
      success: true,
      bookingId: bookingId,
      isNewBooking: isNewBooking,
      message: isNewBooking ? 'Nouvelle réservation créée' : 'Réservation existante utilisée'
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('❌ Erreur dans submit-guest-info:', error);
    return new Response(JSON.stringify({
      success: false,
      message: error instanceof Error ? error.message : 'Erreur inconnue'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});