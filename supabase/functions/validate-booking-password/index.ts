import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { getServerClient } from '../_shared/serverClient.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface ValidateBookingPasswordRequest {
  propertyId: string;
  password: string; // Code de réservation Airbnb
}

interface ValidateBookingPasswordResponse {
  success: boolean;
  valid?: boolean;
  token?: string;
  propertyId?: string;
  bookingId?: string;
  expiresAt?: string;
  error?: string;
  details?: any;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  console.log('🔍 Validate booking password function called');
  console.log('📅 Timestamp:', new Date().toISOString());

  try {
    // Read request body
    let requestBody: ValidateBookingPasswordRequest;
    try {
      requestBody = await req.json();
    } catch (parseError) {
      console.error('❌ Failed to parse request body:', parseError);
      return new Response(
        JSON.stringify({ 
          success: false,
          error: 'Invalid JSON in request body',
          details: parseError.message 
        }), 
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Validate required fields
    const { propertyId, password } = requestBody;
    
    if (!propertyId || typeof propertyId !== 'string') {
      console.error('❌ Missing or invalid propertyId:', propertyId);
      return new Response(
        JSON.stringify({ 
          success: false,
          error: 'PropertyId is required and must be a string',
          details: { propertyId }
        }), 
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    if (!password || typeof password !== 'string') {
      console.error('❌ Missing or invalid password:', password);
      return new Response(
        JSON.stringify({ 
          success: false,
          error: 'Password is required and must be a string',
          details: { password }
        }), 
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log('📥 Request validated:', { 
      propertyId: propertyId.substring(0, 8) + '...',
      password: password.substring(0, 4) + '...'
    });

    // Use service role client
    const server = await getServerClient();

    // ✅ NOUVEAU : Vérifier d'abord que c'est bien une réservation Airbnb
    try {
      const { data: airbnbReservation, error: airbnbError } = await server
        .from('airbnb_reservations')
        .select('airbnb_booking_id')
        .eq('property_id', propertyId)
        .eq('airbnb_booking_id', password)
        .maybeSingle();

      if (airbnbError || !airbnbReservation) {
        console.log('❌ Code de réservation non trouvé dans les réservations Airbnb');
        return new Response(
          JSON.stringify({ 
            success: true,
            valid: false,
            error: 'Code de réservation invalide ou non trouvé'
          }), 
          { 
            status: 200, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );
      }

      console.log('✅ Code de réservation Airbnb validé:', airbnbReservation.airbnb_booking_id);
    } catch (error) {
      console.error('❌ Erreur lors de la vérification Airbnb:', error);
      return new Response(
        JSON.stringify({ 
          success: false,
          error: 'Erreur lors de la vérification du code de réservation',
          details: error.message 
        }), 
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Rechercher un token actif avec ce mot de passe pour cette propriété
    try {
      const { data: tokenData, error: tokenError } = await server
        .from('property_verification_tokens')
        .select('*')
        .eq('property_id', propertyId)
        .eq('password', password)
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (tokenError) {
        console.error('❌ Error fetching token by password:', tokenError);
        return new Response(
          JSON.stringify({ 
            success: false,
            error: 'Database error during token lookup',
            details: tokenError.message 
          }), 
          { 
            status: 500, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );
      }

      if (!tokenData) {
        console.log('❌ No active token found with this password for property');
        return new Response(
          JSON.stringify({ 
            success: true,
            valid: false,
            error: 'Invalid password or no active token found'
          }), 
          { 
            status: 200, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );
      }

      console.log('✅ Token found by password:', { 
        id: tokenData.id, 
        is_active: tokenData.is_active,
        expires_at: tokenData.expires_at 
      });

      // Vérifier si le token est expiré
      const isExpired = tokenData.expires_at ? new Date(tokenData.expires_at) < new Date() : false;
      
      if (isExpired) {
        console.log('❌ Token is expired');
        return new Response(
          JSON.stringify({ 
            success: true,
            valid: false,
            error: 'Token has expired'
          }), 
          { 
            status: 200, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );
      }

      // Vérifier les limites d'usage
      const maxUses = tokenData.max_uses || 1;
      const usedCount = tokenData.used_count || 0;
      const maxUsesReached = usedCount >= maxUses;
      
      if (maxUsesReached) {
        console.log('❌ Maximum uses reached');
        return new Response(
          JSON.stringify({ 
            success: true,
            valid: false,
            error: 'Maximum uses reached for this token'
          }), 
          { 
            status: 200, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );
      }

      console.log('✅ Password validation successful');

      return new Response(
        JSON.stringify({
          success: true,
          valid: true,
          token: tokenData.token,
          propertyId: tokenData.property_id,
          bookingId: tokenData.booking_id,
          expiresAt: tokenData.expires_at
        }), 
        { 
          status: 200, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );

    } catch (dbError) {
      console.error('❌ Database error during password validation:', dbError);
      return new Response(
        JSON.stringify({ 
          success: false,
          error: 'Database error during password validation',
          details: dbError.message 
        }), 
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

  } catch (error) {
    console.error('❌ Unexpected error in validate-booking-password:', error);
    return new Response(
      JSON.stringify({ 
        success: false,
        error: 'Internal server error',
        details: error.message 
      }), 
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
