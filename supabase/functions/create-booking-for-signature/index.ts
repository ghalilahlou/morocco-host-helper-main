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
    console.log('🔍 Verifying property exists:', body.propertyId);
    const { data: property, error: propertyError } = await server
      .from("properties")
      .select("id, name, user_id")
      .eq("id", body.propertyId)
      .maybeSingle();

    if (propertyError) {
      console.error('❌ Error checking property:', propertyError);
      return badRequest("Property not found");
    }

    if (!property) {
      console.log('❌ Property not found:', body.propertyId);
      return badRequest("Property not found");
    }

    console.log('✅ Property found:', property.name);

    // 2. Create booking
    console.log('💾 Creating booking...');
    const { data: booking, error: bookingError } = await server
      .from("bookings")
      .insert({
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
      })
      .select("id, property_id, check_in_date, check_out_date, number_of_guests, status")
      .single();

    if (bookingError) {
      console.error('❌ Error creating booking:', bookingError);
      return badRequest("Failed to create booking");
    }

    console.log('✅ Booking created:', booking.id);

    // 3. Create guest record
    console.log('💾 Creating guest record...');
    const { data: guest, error: guestError } = await server
      .from("guests")
      .insert({
        booking_id: booking.id,
        full_name: body.guestName,
        date_of_birth: new Date().toISOString().split('T')[0], // Default to today
        document_number: body.documentNumber || 'TBD',
        nationality: 'Unknown',
        document_type: body.documentType || 'passport',
        profession: body.profession || '',
        motif_sejour: body.motifSejour || 'TOURISME',
        adresse_personnelle: body.adressePersonnelle || '',
        email: body.guestEmail || null
      })
      .select("id, full_name, document_number")
      .single();

    if (guestError) {
      console.error('❌ Error creating guest:', guestError);
      // Don't fail the whole operation, just log the error
      console.log('⚠️ Guest creation failed, but booking was created');
    } else {
      console.log('✅ Guest created:', guest.full_name);
    }

    // 4. Create guest submission for tracking
    console.log('💾 Creating guest submission...');
    const { data: submission, error: submissionError } = await server
      .from("guest_submissions")
      .insert({
        token_id: `signature-${Date.now()}`, // Temporary token
        property_id: body.propertyId,
        full_name: body.guestName,
        email: body.guestEmail || null,
        phone: body.guestPhone || null,
        document_type: body.documentType || 'passport',
        document_number: body.documentNumber || 'TBD',
        status: 'completed'
      })
      .select("id, full_name, status")
      .single();

    if (submissionError) {
      console.error('❌ Error creating submission:', submissionError);
      console.log('⚠️ Submission creation failed, but booking was created');
    } else {
      console.log('✅ Submission created:', submission.id);
    }

    console.log(`✅ Booking and related records created successfully!`);
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
      message: "Booking created successfully for signature"
    });
  } catch (e) {
    console.error("❌ create-booking-for-signature error:", e);
    return new Response(JSON.stringify({ 
      error: "internal", 
      details: e.message,
      stack: e.stack 
    }), { 
      status: 500, 
      headers: { "content-type": "application/json", ...corsHeaders } 
    });
  }
});
