/// <reference types="https://deno.land/x/types/deploy/stable/index.d.ts" />
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

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
    console.log('[Police Regen] 🔄 Début régénération pour booking:', bookingId);
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Missing Supabase credentials');
    }
    
    const supabase = createClient(supabaseUrl, supabaseKey, {
      auth: { persistSession: false }
    });
    
    // Récupérer la signature depuis contract_signatures
    const { data: signatureData, error: sigError } = await supabase
      .from('contract_signatures')
      .select('signature_data, signed_at, signer_name')
      .eq('booking_id', bookingId)
      .order('signed_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    
    if (sigError) {
      console.error('[Police Regen] ❌ Erreur récupération signature:', sigError);
      throw sigError;
    }
    
    if (!signatureData || !signatureData.signature_data) {
      console.warn('[Police Regen] ⚠️ Aucune signature trouvée');
      return {
        success: false,
        message: 'Aucune signature trouvée pour cette réservation',
        hasSignature: false
      };
    }
    
    console.log('[Police Regen] ✅ Signature trouvée, appel génération...');
    
    // Appeler la fonction generate-police-forms avec la signature du guest
    const generateUrl = `${supabaseUrl}/functions/v1/generate-police-forms`;
    const response = await fetch(generateUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseKey}`
      },
      body: JSON.stringify({
        bookingId: bookingId,
        guestSignature: {
          data: signatureData.signature_data,
          timestamp: signatureData.signed_at
        }
      })
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('[Police Regen] ❌ Erreur génération:', errorText);
      throw new Error(`Erreur génération: ${errorText}`);
    }
    
    const result = await response.json();
    console.log('[Police Regen] ✅ Fiche régénérée avec succès');
    
    return {
      success: true,
      message: 'Fiche de police régénérée avec signature',
      hasGuestSignature: true,
      documentUrl: result.documentUrl || null,
      documentUrls: result.documentUrls || []
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
