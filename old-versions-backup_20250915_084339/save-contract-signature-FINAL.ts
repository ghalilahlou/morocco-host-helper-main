import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

type Payload = {
  bookingId: string;
  signerName: string;
  signerEmail?: string | null;
  signerPhone?: string | null;
  signatureDataUrl: string; // data:image/png;base64,....
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

async function getServerClient() {
  const url = Deno.env.get('SUPABASE_URL');
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!url || !key) {
    throw new Error('Missing Supabase credentials');
  }

  return createClient(url, key, { auth: { persistSession: false } });
}

function badRequest(msg: string, details?: any) {
  console.error('❌ Bad request:', msg, details);
  return new Response(JSON.stringify({ 
    error: msg,
    details: details 
  }), { 
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

  console.log('📝 Save contract signature function called');

  try {
    if (req.method !== "POST") {
      return badRequest("POST method required");
    }
    
    const body = (await req.json()) as Payload;
    console.log('📝 Request body received:', { 
      bookingId: body?.bookingId, 
      signerName: body?.signerName,
      hasSignatureData: !!body?.signatureDataUrl
    });

    // ✅ VALIDATION ROBUSTE
    if (!body?.bookingId || !body?.signerName || !body?.signatureDataUrl) {
      return badRequest("Missing required fields: bookingId, signerName, signatureDataUrl");
    }

    const supabase = await getServerClient();
    
    // ✅ VÉRIFIER QUE LA RÉSERVATION EXISTE
    console.log('🔍 Checking if booking exists...');
    
    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .select('*')
      .eq('id', body.bookingId)
      .single();

    if (bookingError || !booking) {
      console.error('❌ Booking not found:', bookingError);
      return badRequest("Booking not found");
    }

    console.log('✅ Booking found:', booking.id);

    // ✅ VÉRIFIER LES SIGNATURES EXISTANTES
    console.log('🔍 Checking for existing signatures...');
    
    const { data: existingSignatures, error: signatureSearchError } = await supabase
      .from('contract_signatures')
      .select('*')
      .eq('booking_id', body.bookingId);

    if (signatureSearchError) {
      console.error('❌ Error searching signatures:', signatureSearchError);
      return badRequest("Error searching existing signatures");
    }

    let signatureId: string;
    let isNewSignature = false;

    if (existingSignatures && existingSignatures.length > 0) {
      // ✅ MISE À JOUR SIGNATURE EXISTANTE
      const existingSignature = existingSignatures[0];
      signatureId = existingSignature.id;
      
      console.log('✅ Existing signature found, updating:', signatureId);
      
      const updateData = {
        signer_name: body.signerName,
        signature_data: body.signatureDataUrl,
        contract_content: `Contrat signé électroniquement par ${body.signerName} le ${new Date().toLocaleDateString('fr-FR')}`, // ✅ AJOUTÉ
        signed_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      // ✅ AJOUTER EMAIL ET PHONE SEULEMENT S'ILS SONT FOURNIS
      if (body.signerEmail) {
        updateData.signer_email = body.signerEmail;
      }
      if (body.signerPhone) {
        updateData.signer_phone = body.signerPhone;
      }

      const { error: updateError } = await supabase
        .from('contract_signatures')
        .update(updateData)
        .eq('id', signatureId);

      if (updateError) {
        console.error('❌ Error updating signature:', updateError);
        return badRequest("Error updating signature", { error: updateError.message });
      }

      console.log('✅ Signature updated successfully');
    } else {
      // ✅ CRÉER NOUVELLE SIGNATURE AVEC CONTRACT_CONTENT
      console.log('🆕 No existing signature found, creating new one...');
      
      const insertData = {
        booking_id: body.bookingId,
        signer_name: body.signerName,
        signature_data: body.signatureDataUrl,
        contract_content: `Contrat de location courte durée signé électroniquement par ${body.signerName} le ${new Date().toLocaleDateString('fr-FR')} à ${new Date().toLocaleTimeString('fr-FR')}. Signature numérique valide.`, // ✅ OBLIGATOIRE
        signed_at: new Date().toISOString()
      };

      // ✅ AJOUTER EMAIL ET PHONE SEULEMENT S'ILS SONT FOURNIS
      if (body.signerEmail) {
        insertData.signer_email = body.signerEmail;
      }
      if (body.signerPhone) {
        insertData.signer_phone = body.signerPhone;
      }

      console.log('📝 Creating signature with data:', {
        booking_id: insertData.booking_id,
        signer_name: insertData.signer_name,
        hasSignatureData: !!insertData.signature_data,
        hasContractContent: !!insertData.contract_content,
        contractContentLength: insertData.contract_content.length
      });

      const { data: newSignature, error: createError } = await supabase
        .from('contract_signatures')
        .insert(insertData)
        .select()
        .single();

      if (createError) {
        console.error('❌ Error creating signature:', createError);
        return badRequest("Error creating signature", { 
          error: createError.message,
          code: createError.code,
          hint: createError.hint,
          details: createError.details
        });
      }

      signatureId = newSignature.id;
      isNewSignature = true;
      console.log('✅ New signature created:', signatureId);
    }

    // ✅ METTRE À JOUR LE STATUT DE LA RÉSERVATION
    console.log('🔄 Updating booking status...');
    
    const { error: updateBookingError } = await supabase
      .from('bookings')
      .update({
        status: 'confirmed',
        updated_at: new Date().toISOString()
      })
      .eq('id', body.bookingId);

    if (updateBookingError) {
      console.warn('⚠️ Warning: Could not update booking status:', updateBookingError);
    } else {
      console.log('✅ Booking status updated to confirmed');
    }

    console.log('✅ Save contract signature function completed successfully');

    // ✅ RÉPONSE DE SUCCÈS
    return ok({
      success: true,
      signatureId: signatureId,
      isNewSignature: isNewSignature,
      message: isNewSignature ? 'New signature created' : 'Existing signature updated',
      bookingId: body.bookingId,
      signerName: body.signerName,
      signedAt: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Critical error in save-contract-signature:', error);
    return badRequest(
      error instanceof Error ? error.message : "Unknown error",
      { 
        stack: error instanceof Error ? error.stack : undefined 
      }
    );
  }
});
