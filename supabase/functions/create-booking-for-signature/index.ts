import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { getServerClient } from "../_shared/serverClient.ts";
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};
function badRequest(msg) {
  return new Response(JSON.stringify({
    error: msg
  }), {
    status: 400,
    headers: {
      "content-type": "application/json",
      ...corsHeaders
    }
  });
}
function ok(body) {
  return new Response(JSON.stringify(body ?? {}), {
    status: 200,
    headers: {
      "content-type": "application/json",
      ...corsHeaders
    }
  });
}
serve(async (req)=>{
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: corsHeaders
    });
  }
  console.log('�� Create booking for signature function called');
  try {
    if (req.method !== "POST") return badRequest("POST required");
    const body = await req.json();
    console.log('📝 Request body:', body);
    if (!body?.propertyId || !body?.checkInDate || !body?.checkOutDate || !body?.guestName) {
      console.log('❌ Missing required fields:', {
        hasPropertyId: !!body?.propertyId,
        hasCheckInDate: !!body?.checkInDate,
        hasCheckOutDate: !!body?.checkOutDate,
        hasGuestName: !!body?.guestName
      });
      return badRequest("propertyId, checkInDate, checkOutDate, guestName required");
    }
    const server = await getServerClient();
    // 1. Verify property exists
    console.log('�� Verifying property exists:', body.propertyId);
    const { data: property, error: propertyError } = await server.from("properties").select("id, name, user_id").eq("id", body.propertyId).maybeSingle();
    if (propertyError) {
      console.error('❌ Error checking property:', propertyError);
      return badRequest("Property not found");
    }
    if (!property) {
      console.log('❌ Property not found:', body.propertyId);
      return badRequest("Property not found");
    }
    console.log('✅ Property found:', property.name);
    // ✅ CORRECTION : Vérifier si une réservation existe déjà
    console.log('🔍 Checking for existing booking...');
    const { data: existingBooking, error: checkError } = await server.from("bookings").select("id, status, submission_id").eq("property_id", body.propertyId).eq("check_in_date", body.checkInDate).eq("check_out_date", body.checkOutDate).maybeSingle();
    if (existingBooking) {
      console.log('✅ Existing booking found:', existingBooking.id);
      // Si la réservation a un submission_id, elle est complète
      if (existingBooking.submission_id) {
        console.log('✅ Complete booking found, reusing:', existingBooking.id);
        return ok({
          bookingId: existingBooking.id,
          propertyId: body.propertyId,
          guestName: body.guestName,
          checkInDate: body.checkInDate,
          checkOutDate: body.checkOutDate,
          numberOfGuests: body.numberOfGuests || 1,
          status: existingBooking.status,
          message: "Existing complete booking found and reused"
        });
      } else {
        console.log('⚠️ Incomplete booking found, updating:', existingBooking.id);
        // Mettre à jour la réservation existante au lieu d'en créer une nouvelle
        const { error: updateError } = await server.from("bookings").update({
          number_of_guests: body.numberOfGuests || 1,
          updated_at: new Date().toISOString()
        }).eq('id', existingBooking.id);
        if (updateError) {
          console.error('❌ Failed to update existing booking:', updateError);
          return badRequest("Failed to update existing booking");
        }
        // ✅ CORRECTION : Ne pas créer d'invités ni de soumissions si réservation existe
        console.log('✅ Existing booking updated and reused:', existingBooking.id);
        return ok({
          bookingId: existingBooking.id,
          propertyId: body.propertyId,
          guestName: body.guestName,
          checkInDate: body.checkInDate,
          checkOutDate: body.checkOutDate,
          numberOfGuests: body.numberOfGuests || 1,
          status: existingBooking.status,
          message: "Existing booking updated and reused"
        });
      }
    }
    // ✅ CORRECTION : Créer seulement si aucune réservation n'existe
    console.log('💾 No existing booking found, creating new one...');
    // 2. Create new booking
    const { data: booking, error: bookingError } = await server.from("bookings").insert({
      property_id: body.propertyId,
      user_id: property.user_id,
      check_in_date: body.checkInDate,
      check_out_date: body.checkOutDate,
      number_of_guests: body.numberOfGuests || 1,
      status: 'pending',
      booking_reference: `SIGN-${Date.now()}`,
      documents_generated: {
        policeForm: false,
        contract: false
      }
    }).select("id, property_id, check_in_date, check_out_date, number_of_guests, status").single();
    if (bookingError) {
      console.error('❌ Error creating booking:', bookingError);
      return badRequest("Failed to create booking");
    }
    console.log('✅ New booking created:', booking.id);
    // 3. Create guest record (seulement pour les nouvelles réservations)
    console.log('💾 Creating guest record...');
    const { data: guest, error: guestError } = await server.from("guests").insert({
      booking_id: booking.id,
      full_name: body.guestName,
      date_of_birth: new Date().toISOString().split('T')[0],
      document_number: body.documentNumber || 'TBD',
      nationality: 'Unknown',
      document_type: body.documentType || 'passport'
    }).select("id, full_name, document_number").single();
    if (guestError) {
      console.error('❌ Error creating guest:', guestError);
      console.log('⚠️ Guest creation failed, but booking was created');
    } else {
      console.log('✅ Guest created:', guest.full_name);
    }
    // 4. Create guest submission for tracking (seulement pour les nouvelles réservations)
    console.log('💾 Creating guest submission...');
    const { data: submission, error: submissionError } = await server.from("guest_submissions").insert({
      token_id: `signature-${Date.now()}`,
      property_id: body.propertyId,
      full_name: body.guestName,
      email: body.guestEmail || null,
      phone: body.guestPhone || null,
      document_type: body.documentType || 'passport',
      document_number: body.documentNumber || 'TBD',
      status: 'completed'
    }).select("id, full_name, status").single();
    if (submissionError) {
      console.error('❌ Error creating submission:', submissionError);
      console.log('⚠️ Submission creation failed, but booking was created');
    } else {
      console.log('✅ Submission created:', submission.id);
    }
    console.log(`✅ New booking and related records created successfully!`);
    console.log(`📝 Booking ID: ${booking.id}`);
    console.log(`📝 Property: ${property.name}`);
    console.log(`📝 Guest: ${body.guestName}`);
    console.log(`📝 Check-in: ${booking.check_in_date}`);
    console.log(`📝 Check-out: ${booking.check_out_date}`);
    return ok({
      bookingId: booking.id,
      propertyId: booking.property_id,
      guestName: body.guestName,
      checkInDate: booking.check_in_date,
      checkOutDate: booking.check_out_date,
      numberOfGuests: booking.number_of_guests,
      status: booking.status,
      message: "New booking created successfully for signature"
    });
  } catch (e) {
    console.error("❌ create-booking-for-signature error:", e);
    return new Response(JSON.stringify({
      error: "internal",
      details: e.message,
      stack: e.stack
    }), {
      status: 500,
      headers: {
        "content-type": "application/json",
        ...corsHeaders
      }
    });
  }
});
