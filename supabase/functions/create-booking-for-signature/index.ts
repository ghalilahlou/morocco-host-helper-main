import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { getServerClient } from "../_shared/serverClient.ts";

type Payload = {
  propertyId: string;
  checkInDate: string;
  checkOutDate: string;
  numberOfGuests: number;
  guestName: string;
  guestEmail?: string;
  guestPhone?: string;
  documentNumber?: string;
  documentType?: string;
  profession?: string;
  motifSejour?: string;
  adressePersonnelle?: string;
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function badRequest(msg: string) {
  return new Response(JSON.stringify({ error: msg }), { 
    status: 400, 
    headers: { "content-type": "application/json", ...corsHeaders } 
  });
}

function ok(body: unknown) {
  return new Response(JSON.stringify(body ?? {}), { 
    status: 200, 
    headers: { "content-type": "application/json", ...corsHeaders } 
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  console.log('📝 Create booking for signature function called');

  try {
    if (req.method !== "POST") return badRequest("POST required");
    
    const body = (await req.json()) as Payload;
    console.log('📝 Request body:', body);

    if (!body.propertyId || !body.checkInDate || !body.checkOutDate) {
      return badRequest("Missing required fields: propertyId, checkInDate, checkOutDate");
    }

    const supabase = getServerClient(req);
    
    // ✅ CORRECTION : Logique "find or create" pour éviter les doublons
    console.log('🔍 Recherche d\'une réservation existante...');
    
    const { data: existingBookings, error: searchError } = await supabase
      .from('bookings')
      .select('*')
      .eq('property_id', body.propertyId)
      .eq('check_in_date', body.checkInDate)
      .eq('check_out_date', body.checkOutDate)
      .order('created_at', { ascending: false });

    if (searchError) {
      console.error('❌ Erreur lors de la recherche:', searchError);
      return badRequest("Erreur lors de la recherche de réservation existante");
    }

    let bookingId: string;
    let isNewBooking = false;

    if (existingBookings && existingBookings.length > 0) {
      // ✅ CORRECTION : Utiliser la réservation existante
      const existingBooking = existingBookings[0];
      bookingId = existingBooking.id;
      
      console.log('✅ Réservation existante trouvée:', bookingId);
      
      // Mettre à jour la réservation existante si nécessaire
      if (existingBooking.number_of_guests !== body.numberOfGuests) {
        const { error: updateError } = await supabase
          .from('bookings')
          .update({ 
            number_of_guests: body.numberOfGuests,
            updated_at: new Date().toISOString()
          })
          .eq('id', bookingId);
          
        if (updateError) {
          console.error('❌ Erreur lors de la mise à jour:', updateError);
        } else {
          console.log('✅ Réservation mise à jour avec succès');
        }
      }
    } else {
      // ✅ CORRECTION : Créer une nouvelle réservation seulement si aucune n'existe
      console.log('🆕 Aucune réservation existante trouvée, création d\'une nouvelle...');
      
      const { data: newBooking, error: createError } = await supabase
        .from('bookings')
        .insert({
          property_id: body.propertyId,
          check_in_date: body.checkInDate,
          check_out_date: body.checkOutDate,
          number_of_guests: body.numberOfGuests,
          status: 'pending',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select()
        .single();

      if (createError) {
        console.error('❌ Erreur lors de la création:', createError);
        return badRequest("Erreur lors de la création de la réservation");
      }

      bookingId = newBooking.id;
      isNewBooking = true;
      console.log('✅ Nouvelle réservation créée:', bookingId);
    }

    // ✅ CORRECTION : Créer les enregistrements invité et soumission seulement pour les nouvelles réservations
    if (isNewBooking) {
      console.log('👥 Création des enregistrements invité et soumission...');
      
      // Créer l'enregistrement invité
      const { data: guest, error: guestError } = await supabase
        .from('guests')
        .insert({
          full_name: body.guestName,
          email: body.guestEmail,
          phone: body.guestPhone,
          document_number: body.documentNumber,
          document_type: body.documentType,
          profession: body.profession,
          motif_sejour: body.motifSejour,
          adresse_personnelle: body.adressePersonnelle,
          created_at: new Date().toISOString()
        })
        .select()
        .single();

      if (guestError) {
        console.error('❌ Erreur lors de la création de l\'invité:', guestError);
        return badRequest("Erreur lors de la création de l'invité");
      }

      // Créer l'enregistrement de soumission
      const { data: submission, error: submissionError } = await supabase
        .from('submissions')
        .insert({
          booking_id: bookingId,
          guest_id: guest.id,
          status: 'submitted',
          submitted_at: new Date().toISOString(),
          created_at: new Date().toISOString()
        })
        .select()
        .single();

      if (submissionError) {
        console.error('❌ Erreur lors de la création de la soumission:', submissionError);
        return badRequest("Erreur lors de la création de la soumission");
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

      console.log('✅ Enregistrements invité et soumission créés avec succès');
    } else {
      console.log('ℹ️ Réservation existante, pas de création d\'enregistrements supplémentaires');
    }

    console.log('✅ Fonction terminée avec succès, bookingId:', bookingId);

    return ok({
      success: true,
      bookingId: bookingId,
      isNewBooking: isNewBooking,
      message: isNewBooking ? 'Nouvelle réservation créée' : 'Réservation existante utilisée'
    });

  } catch (error) {
    console.error('❌ Erreur dans create-booking-for-signature:', error);
    return badRequest(error instanceof Error ? error.message : "Erreur inconnue");
  }
});