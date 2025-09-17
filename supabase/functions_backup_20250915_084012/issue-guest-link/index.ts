import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { getServerClient } from '../_shared/serverClient.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  console.log('🚀 Issue guest link function called');

  try {
    const { propertyId, bookingId } = await req.json();
    
    if (!propertyId) {
      return new Response(
        JSON.stringify({ error: 'Property ID is required' }), 
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log('🔗 Issuing guest link for property:', { propertyId, bookingId });

    const server = await getServerClient();

    // ✅ NOUVEAU : Vérifier les permissions de génération de tokens
    console.log('🔐 Vérification des permissions de génération de tokens...');
    
    const { data: permissionCheck, error: permissionError } = await server.rpc('check_reservation_allowed', {
      property_uuid: propertyId
    });

    if (permissionError) {
      console.error('❌ Erreur lors de la vérification des permissions:', permissionError);
      return new Response(
        JSON.stringify({ 
          error: 'Erreur lors de la vérification des permissions',
          details: permissionError.message 
        }), 
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    if (!permissionCheck?.allowed) {
      console.log('🚫 Génération de tokens non autorisée:', permissionCheck);
      return new Response(
        JSON.stringify({ 
          error: 'Génération de tokens non autorisée',
          reason: permissionCheck?.reason || 'Contrôle administrateur actif',
          control_type: permissionCheck?.control_type || 'blocked'
        }), 
        { 
          status: 403, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log('✅ Génération de tokens autorisée:', permissionCheck);

    // If no bookingId is provided, try to find the most recent active booking for this property
    let finalBookingId = bookingId;
    if (!bookingId) {
      console.log('📅 No bookingId provided, searching for recent bookings...');
      const { data: recentBooking } = await server
        .from('bookings')
        .select('id')
        .eq('property_id', propertyId)
        .gte('check_out_date', new Date().toISOString().split('T')[0]) // Future or current bookings
        .order('check_in_date', { ascending: true })
        .limit(1)
        .maybeSingle();
      
      if (recentBooking) {
        finalBookingId = recentBooking.id;
        console.log('✅ Found recent booking:', finalBookingId);
      } else {
        console.log('⚠️ No recent booking found for property');
      }
    }

    // ✅ CORRECTION : Désactiver tous les tokens actifs existants pour cette propriété
    console.log('🔄 Désactivation des tokens existants pour cette propriété...');
    
    const { error: deactivateError } = await server
      .from('property_verification_tokens')
      .update({ 
        is_active: false,
        updated_at: new Date().toISOString()
      })
      .eq('property_id', propertyId)
      .eq('is_active', true);

    if (deactivateError) {
      console.error('❌ Erreur lors de la désactivation des tokens existants:', deactivateError);
      // Ne pas échouer pour cette erreur, juste logger
    } else {
      console.log('✅ Tokens existants désactivés avec succès');
    }

    // ✅ CORRECTION : Générer un nouveau token unique
    console.log('🆕 Génération d\'un nouveau token...');
    
    const token = generateUniqueToken();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // Expire dans 7 jours

    const { data: newToken, error: createError } = await server
      .from('property_verification_tokens')
      .insert({
        property_id: propertyId,
        token,
        is_active: true,
        expires_at: expiresAt.toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select()
      .single();

    if (createError) {
      console.error('❌ Erreur lors de la création du token:', createError);
      return new Response(
        JSON.stringify({ error: 'Failed to create guest verification token' }), 
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log('✅ Nouveau token créé avec succès:', newToken.id);

    // ✅ NOUVEAU : Incrémenter le compteur de réservations
    console.log('📊 Incrémentation du compteur de réservations...');
    
    const { error: incrementError } = await server.rpc('increment_reservation_count', {
      property_uuid: propertyId
    });

    if (incrementError) {
      console.error('⚠️ Erreur lors de l\'incrémentation du compteur:', incrementError);
      // Ne pas faire échouer la création du token pour cette erreur
    } else {
      console.log('✅ Compteur de réservations incrémenté');
    }

    // ✅ CORRECTION : Construire l'URL du lien invité
    const baseUrl = Deno.env.get('SITE_URL') || 'http://localhost:3000';
    const guestLink = `${baseUrl}/guest-verification/${propertyId}/${newToken.token}`;
    
    console.log('🔗 Lien invité généré:', guestLink);

    return new Response(
      JSON.stringify({
        success: true,
        token: newToken.token,
        link: guestLink, // ✅ CORRECTION : Utiliser 'link' au lieu de 'guestLink' pour correspondre au hook
        expiresAt: newToken.expires_at,
        bookingId: finalBookingId
      }), 
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('❌ Erreur dans issue-guest-link:', error);
    return new Response(
      JSON.stringify({ error: error.message }), 
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});

// ✅ CORRECTION : Fonction améliorée pour générer un token unique
function generateUniqueToken(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  
  // Générer un token de 32 caractères
  for (let i = 0; i < 32; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  
  // Ajouter un timestamp pour garantir l'unicité
  const timestamp = Date.now().toString(36);
  
  return `${result}${timestamp}`;
}