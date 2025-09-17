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

  console.log('📝 Save contract signature function called');

  try {
    if (req.method !== "POST") return badRequest("POST required");
    
    const body = (await req.json()) as Payload;
    console.log('📝 Request body:', { 
      bookingId: body?.bookingId, 
      signerName: body?.signerName,
      hasSignatureData: !!body?.signatureDataUrl 
    });

    if (!body?.bookingId || !body?.signerName || !body?.signatureDataUrl) {
      console.log('❌ Missing required fields:', { 
        hasBookingId: !!body?.bookingId,
        hasSignerName: !!body?.signerName,
        hasSignatureData: !!body?.signatureDataUrl
      });
      return badRequest("Missing required fields: bookingId, signerName, signatureDataUrl");
    }

    const supabase = await getServerClient();
    
    // ✅ CORRECTION : Vérifier que la réservation existe
    console.log('🔍 Vérification de l\'existence de la réservation...');
    
    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .select('*')
      .eq('id', body.bookingId)
      .single();

    if (bookingError || !booking) {
      console.error('❌ Réservation non trouvée:', bookingError);
      return badRequest("Réservation non trouvée");
    }

    console.log('✅ Réservation trouvée:', booking.id);

    // ✅ CORRECTION : Vérifier s'il existe déjà une signature pour cette réservation
    console.log('🔍 Vérification des signatures existantes...');
    
    const { data: existingSignatures, error: signatureSearchError } = await supabase
      .from('contract_signatures')
      .select('*')
      .eq('booking_id', body.bookingId);

    if (signatureSearchError) {
      console.error('❌ Erreur lors de la recherche de signatures:', signatureSearchError);
      return badRequest("Erreur lors de la recherche de signatures existantes");
    }

    let signatureId: string;
    let isNewSignature = false;

    if (existingSignatures && existingSignatures.length > 0) {
      // ✅ CORRECTION : Mettre à jour la signature existante
      const existingSignature = existingSignatures[0];
      signatureId = existingSignature.id;
      
      console.log('✅ Signature existante trouvée:', signatureId);
      
      const { error: updateError } = await supabase
        .from('contract_signatures')
        .update({
          signer_name: body.signerName,
          signer_email: body.signerEmail,
          signer_phone: body.signerPhone,
          signature_data: body.signatureDataUrl,
          contract_content: 'Contrat signé électroniquement', // Contenu par défaut
          signed_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', signatureId);

      if (updateError) {
        console.error('❌ Erreur lors de la mise à jour de la signature:', updateError);
        return badRequest("Erreur lors de la mise à jour de la signature");
      }

      console.log('✅ Signature mise à jour avec succès');
    } else {
      // ✅ CORRECTION : Créer une nouvelle signature seulement si aucune n'existe
      console.log('🆕 Aucune signature existante trouvée, création d\'une nouvelle...');
      
      const { data: newSignature, error: createError } = await supabase
        .from('contract_signatures')
        .insert({
          booking_id: body.bookingId,
          signer_name: body.signerName,
          signer_email: body.signerEmail,
          signer_phone: body.signerPhone,
          signature_data: body.signatureDataUrl,
          contract_content: 'Contrat signé électroniquement', // Contenu par défaut
          signed_at: new Date().toISOString(),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select()
        .single();

      if (createError) {
        console.error('❌ Erreur lors de la création de la signature:', createError);
        return badRequest("Erreur lors de la création de la signature");
      }

      signatureId = newSignature.id;
      isNewSignature = true;
      console.log('✅ Nouvelle signature créée:', signatureId);
    }

    // ✅ CORRECTION : Mettre à jour le statut de la réservation
    console.log('🔄 Mise à jour du statut de la réservation...');
    
    const { error: updateBookingError } = await supabase
      .from('bookings')
      .update({
        status: 'confirmed',
        updated_at: new Date().toISOString()
      })
      .eq('id', body.bookingId);

    if (updateBookingError) {
      console.error('❌ Erreur lors de la mise à jour du statut de la réservation:', updateBookingError);
      // Ne pas échouer pour cette erreur, juste logger
    } else {
      console.log('✅ Statut de la réservation mis à jour avec succès');
    }

    console.log('✅ Fonction save-contract-signature terminée avec succès');

    // Successful response
    return ok({
      success: true,
      signatureId: signatureId,
      isNewSignature: isNewSignature,
      message: isNewSignature ? 'Nouvelle signature créée' : 'Signature existante mise à jour',
      bookingId: body.bookingId,
      signerName: body.signerName,
      signedAt: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ Erreur dans save-contract-signature:', error);
    return badRequest(error instanceof Error ? error.message : "Erreur inconnue");
  }
});