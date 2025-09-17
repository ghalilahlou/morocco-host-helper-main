import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

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

interface HostSignatureRequest {
  propertyId: string;
  hostSignature: string; // data:image/png;base64,...
  hostName?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  console.log('🖊️ Add host signature function called');

  try {
    if (req.method !== "POST") {
      return new Response(JSON.stringify({
        error: "POST method required"
      }), {
        status: 405,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const body = await req.json() as HostSignatureRequest;
    console.log('📥 Request body:', {
      propertyId: body.propertyId,
      hasHostSignature: !!body.hostSignature,
      hostName: body.hostName
    });

    if (!body.propertyId || !body.hostSignature) {
      return new Response(JSON.stringify({
        error: "propertyId and hostSignature are required"
      }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const supabase = await getServerClient();

    // Vérifier que la propriété existe
    const { data: property, error: propertyError } = await supabase
      .from('properties')
      .select('id, name, contract_template')
      .eq('id', body.propertyId)
      .single();

    if (propertyError || !property) {
      console.error('❌ Property not found:', propertyError);
      return new Response(JSON.stringify({
        error: "Property not found"
      }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    console.log('✅ Property found:', property.name);

    // Préparer le contract_template avec la signature de l'hôte
    const existingTemplate = property.contract_template || {};
    const updatedTemplate = {
      ...existingTemplate,
      landlord_signature: body.hostSignature,
      landlord_name: body.hostName || existingTemplate.landlord_name || 'Hôte',
      updated_at: new Date().toISOString()
    };

    // Mettre à jour la propriété avec la signature de l'hôte
    const { data: updatedProperty, error: updateError } = await supabase
      .from('properties')
      .update({
        contract_template: updatedTemplate,
        updated_at: new Date().toISOString()
      })
      .eq('id', body.propertyId)
      .select()
      .single();

    if (updateError) {
      console.error('❌ Error updating property:', updateError);
      return new Response(JSON.stringify({
        error: "Failed to update property with host signature"
      }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    console.log('✅ Host signature added to property successfully');

    return new Response(JSON.stringify({
      success: true,
      message: "Host signature added successfully",
      propertyId: body.propertyId,
      hostName: body.hostName || 'Hôte'
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });

  } catch (error) {
    console.error('❌ Error in add-host-signature:', error);
    return new Response(JSON.stringify({
      error: error instanceof Error ? error.message : "Unknown error"
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
