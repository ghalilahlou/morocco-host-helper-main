/// <reference types="https://deno.land/x/types/deploy/stable/index.d.ts" />
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/v135/@supabase/supabase-js@2.39.3';

// Import des fonctions depuis le fichier principal
// Note: Ce fichier agit comme un wrapper pour gérer les actions spécifiques

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json'
};

/**
 * Régénère les fiches de police avec la signature du guest
 * Appelé depuis save-contract-signature après signature du contrat
 */
async function regeneratePoliceWithSignature(bookingId: string) {
  try {
    console.log('[Police Regen] 🔄 ====== DÉBUT RÉGÉNÉRATION POLICE AVEC SIGNATURE ======');
    console.log('[Police Regen] 📋 BookingId:', bookingId);
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Missing Supabase credentials');
    }
    
    const supabase = createClient(supabaseUrl, supabaseKey, {
      auth: { persistSession: false }
    });
    
    // Récupérer la signature depuis contract_signatures
    console.log('[Police Regen] 🔍 Recherche signature dans contract_signatures...');
    
    const { data: signatureData, error: sigError } = await supabase
      .from('contract_signatures')
      .select('id, signature_data, signed_at, signer_name, created_at')
      .eq('booking_id', bookingId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    
    if (sigError) {
      console.error('[Police Regen] ❌ Erreur récupération signature:', {
        message: sigError.message,
        code: sigError.code,
        details: sigError.details
      });
      throw sigError;
    }
    
    console.log('[Police Regen] 📊 Résultat recherche signature:', {
      found: !!signatureData,
      signatureId: signatureData?.id,
      signerName: signatureData?.signer_name,
      signedAt: signatureData?.signed_at,
      createdAt: signatureData?.created_at,
      hasSignatureData: !!signatureData?.signature_data,
      signatureDataLength: signatureData?.signature_data?.length || 0,
      signatureDataPreview: signatureData?.signature_data?.substring(0, 80) || 'NULL'
    });
    
    if (!signatureData || !signatureData.signature_data) {
      console.warn('[Police Regen] ⚠️ Aucune signature trouvée pour ce booking');
      return {
        success: false,
        message: 'Aucune signature trouvée pour cette réservation',
        hasSignature: false
      };
    }
    
    console.log('[Police Regen] ✅ Signature valide trouvée, appel generate-police-form via invoke...');
    
    // ✅ CORRECTION : Utiliser supabase.functions.invoke pour éviter 401 Invalid JWT
    // generate-police-form :
    // 1. Récupère la signature automatiquement depuis contract_signatures
    // 2. Upload vers le Storage (pas juste une data URL)
    // 3. Met à jour documents_generated.policeUrl dans la table bookings
    const { data: result, error: invokeError } = await supabase.functions.invoke(
      'generate-police-form',
      {
        body: {
          bookingId: bookingId
          // Note: generate-police-form récupère la signature automatiquement
          // depuis contract_signatures, pas besoin de la passer ici
        }
      }
    );
    
    console.log('[Police Regen] 📡 Réponse invoke generate-police-form:', {
      hasResult: !!result,
      hasError: !!invokeError,
      errorMessage: invokeError?.message
    });
    
    if (invokeError) {
      console.error('[Police Regen] ❌ Erreur génération invoke:', {
        message: invokeError.message,
        context: invokeError.context
      });
      throw new Error(`Erreur génération: ${invokeError.message}`);
    }
    
    console.log('[Police Regen] ✅ Résultat de generate-police-form:', {
      success: result?.success,
      policeUrl: result?.policeUrl?.substring(0, 80) || 'NULL',
      hasGuestSignature: result?.hasGuestSignature,
      guestsCount: result?.guestsCount,
      error: result?.error
    });
    
    console.log('[Police Regen] ====== FIN RÉGÉNÉRATION POLICE AVEC SIGNATURE ======');
    
    return {
      success: true,
      message: 'Fiche de police régénérée avec signature',
      hasGuestSignature: result?.hasGuestSignature || true,
      policeUrl: result?.policeUrl || null,
      // Rétrocompatibilité avec l'ancien format
      documentUrl: result?.policeUrl || null,
      documentUrls: result?.policeUrl ? [result.policeUrl] : []
    };
    
  } catch (error: any) {
    console.error('[Police Regen] ❌ Erreur:', error.message);
    return {
      success: false,
      message: error.message || 'Erreur lors de la régénération',
      error: error.message
    };
  }
}

// Handler principal
serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  
  try {
    const body = await req.json();
    const { action, bookingId } = body;
    
    console.log('[Regenerate Police] Action reçue:', action, 'pour booking:', bookingId);
    
    if (action === 'regenerate_police_with_signature') {
      if (!bookingId) {
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: 'bookingId requis' 
          }),
          { 
            status: 400, 
            headers: { 'Content-Type': 'application/json', ...corsHeaders } 
          }
        );
      }
      
      const result = await regeneratePoliceWithSignature(bookingId);
      
      return new Response(
        JSON.stringify(result),
        { 
          status: result.success ? 200 : 500,
          headers: { 'Content-Type': 'application/json', ...corsHeaders } 
        }
      );
    }
    
    // Si ce n'est pas l'action regenerate, rediriger vers submit-guest-info-unified
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: 'Action non reconnue. Utilisez submit-guest-info-unified pour les autres actions.' 
      }),
      { 
        status: 400, 
        headers: { 'Content-Type': 'application/json', ...corsHeaders } 
      }
    );
    
  } catch (error: any) {
    console.error('[Regenerate Police] Erreur:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message || 'Erreur inconnue' 
      }),
      { 
        status: 500, 
        headers: { 'Content-Type': 'application/json', ...corsHeaders } 
      }
    );
  }
});
