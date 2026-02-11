import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/v135/@supabase/supabase-js@2.39.3';

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

    // ✅ CORRECTION : Le trigger handle_contract_signature_insert() met automatiquement à jour
    // documents_generated.contract et le statut si contract ET policeForm sont générés
    // On vérifie juste l'état après pour confirmer
    console.log('🔄 Vérification de l\'état après signature (le trigger devrait avoir mis à jour documents_generated)...');
    
    // Attendre un peu pour que le trigger se déclenche
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Récupérer l'état actuel pour vérifier ce que le trigger a fait
    const { data: updatedBooking, error: fetchError } = await supabase
      .from('bookings')
      .select('documents_generated, status')
      .eq('id', body.bookingId)
      .single();

    if (fetchError) {
      console.error('❌ Erreur lors de la vérification de l\'état:', fetchError);
    } else {
      const currentDocs = updatedBooking?.documents_generated || {};
      const currentStatus = updatedBooking?.status || 'pending';
      
      console.log('📊 État actuel de la réservation:', {
        bookingId: body.bookingId,
        status: currentStatus,
        documents_generated: currentDocs,
        hasContract: currentDocs.contract === true,
        hasPoliceForm: currentDocs.policeForm === true
      });
      
      // Si le trigger n'a pas mis à jour documents_generated.contract, le faire manuellement
      if (currentDocs.contract !== true) {
        console.log('⚠️ Le trigger n\'a pas mis à jour documents_generated.contract, mise à jour manuelle...');
        const updatedDocs = {
          ...currentDocs,
          contract: true
        };

        const { error: updateBookingError } = await supabase
          .from('bookings')
          .update({
            documents_generated: updatedDocs,
            updated_at: new Date().toISOString()
          })
          .eq('id', body.bookingId);

        if (updateBookingError) {
          console.error('❌ Erreur lors de la mise à jour manuelle de documents_generated:', updateBookingError);
        } else {
          console.log('✅ documents_generated.contract mis à jour manuellement avec succès');
          
          // Vérifier si le statut doit être mis à 'completed' (si policeForm est aussi généré)
          const hasPoliceForm = updatedDocs.policeForm === true;
          if (hasPoliceForm && currentStatus !== 'completed') {
            const { error: statusUpdateError } = await supabase
              .from('bookings')
              .update({
                status: 'completed',
                updated_at: new Date().toISOString()
              })
              .eq('id', body.bookingId);
            
            if (statusUpdateError) {
              console.error('❌ Erreur lors de la mise à jour du statut:', statusUpdateError);
            } else {
              console.log('✅ Statut mis à jour à completed (contract + policeForm générés)');
            }
          } else if (!hasPoliceForm) {
            console.log('ℹ️ Statut conservé (policeForm pas encore généré)');
          } else {
            console.log('ℹ️ Statut déjà à completed');
          }
        }
      } else {
        console.log('✅ documents_generated.contract déjà mis à jour (probablement par le trigger)');
        
        // Vérifier si le statut doit être mis à 'completed'
        const hasPoliceForm = currentDocs.policeForm === true;
        if (hasPoliceForm && currentStatus !== 'completed') {
          console.log('⚠️ Contract et policeForm sont générés mais statut n\'est pas completed, mise à jour...');
          const { error: statusUpdateError } = await supabase
            .from('bookings')
            .update({
              status: 'completed',
              updated_at: new Date().toISOString()
            })
            .eq('id', body.bookingId);
          
          if (statusUpdateError) {
            console.error('❌ Erreur lors de la mise à jour du statut:', statusUpdateError);
          } else {
            console.log('✅ Statut mis à jour à completed (contract + policeForm générés)');
          }
        } else if (hasPoliceForm && currentStatus === 'completed') {
          console.log('✅ Statut déjà à completed');
        } else {
          console.log('ℹ️ Statut conservé (policeForm pas encore généré)');
        }
      }
    }

    // ✅ OPTIMISÉ : Un seul appel à submit-guest-info-unified qui génère :
    // 1. Le contrat avec signature intégrée
    // 2. La fiche de police avec la MÊME signature (évite les problèmes de timing)
    console.log('🔄 [save-contract-signature] Génération contrat + police via submit-guest-info-unified...');
    
    const docsRegenDebug: { 
      called: boolean; 
      ok?: boolean; 
      contractUrl?: string; 
      policeUrl?: string; 
      hasGuestSignature?: boolean;
      error?: string 
    } = { called: true };

    try {
      const { data: docsResult, error: docsInvokeError } = await supabase.functions.invoke(
        'submit-guest-info-unified',
        {
          body: {
            action: 'generate_contract_with_signature',
            bookingId: body.bookingId,
            signatureData: body.signatureDataUrl,
            signerName: body.signerName
          }
        }
      );

      const ok = !docsInvokeError;
      docsRegenDebug.ok = ok;
      docsRegenDebug.contractUrl = docsResult?.contractUrl ?? null;
      docsRegenDebug.policeUrl = docsResult?.policeUrl ?? null;
      docsRegenDebug.hasGuestSignature = docsResult?.hasGuestSignature ?? false;
      
      if (docsInvokeError) {
        docsRegenDebug.error = docsInvokeError.message ?? String(docsInvokeError);
        console.warn('⚠️ [save-contract-signature] Échec génération documents', {
          error: docsInvokeError.message
        });
      } else {
        console.log('✅ [save-contract-signature] Documents générés avec signature', {
          success: docsResult?.success,
          hasGuestSignature: docsResult?.hasGuestSignature,
          contractUrl: docsResult?.contractUrl ? 'présent' : 'absent',
          policeUrl: docsResult?.policeUrl ? 'présent' : 'absent'
        });
      }
    } catch (docsRegenError: unknown) {
      const errMsg = docsRegenError instanceof Error ? docsRegenError.message : String(docsRegenError);
      docsRegenDebug.error = errMsg;
      docsRegenDebug.ok = false;
      console.warn('⚠️ [save-contract-signature] Erreur génération documents:', errMsg);
    }

    console.log('✅ [save-contract-signature] Terminée avec succès');

    // Successful response (avec _debug pour voir le résultat de la régénération docs sans passer par les logs)
    return ok({
      success: true,
      signatureId: signatureId,
      isNewSignature: isNewSignature,
      message: isNewSignature ? 'Nouvelle signature créée' : 'Signature existante mise à jour',
      bookingId: body.bookingId,
      signerName: body.signerName,
      signedAt: new Date().toISOString(),
      contractUrl: docsRegenDebug.contractUrl,
      policeUrl: docsRegenDebug.policeUrl,
      hasGuestSignature: docsRegenDebug.hasGuestSignature,
      _debug: { docsRegen: docsRegenDebug }
    });
  } catch (error) {
    console.error('❌ Erreur dans save-contract-signature:', error);
    return badRequest(error instanceof Error ? error.message : "Erreur inconnue");
  }
});