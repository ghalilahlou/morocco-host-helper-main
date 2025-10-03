/// <reference types="https://deno.land/x/types/deploy/stable/index.d.ts" />

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// CORS Headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Max-Age': '86400',
};

// Types
interface ResolveRequest {
  token: string;
  airbnbCode: string;
}

interface ResolveResponse {
  success: boolean;
  data?: {
    propertyId: string;
    airbnbCode: string;
    checkIn: string; // YYYY-MM-DD
    checkOut: string; // YYYY-MM-DD
    guestName?: string;
    propertyName?: string;
  };
  error?: {
    code: string;
    message: string;
  };
}

// Helper: Normaliser code Airbnb
function normalizeCode(input: string): string {
  return (input || '').trim().toUpperCase().replace(/\s+/g, '');
}

// Helper: Créer le code normalisé pour comparaison avec airbnb_booking_id
function createNormalizedSearchPattern(code: string): string {
  const normalized = normalizeCode(code);
  // Créer plusieurs variantes pour la recherche
  return normalized;
}

// Helper: Créer client Supabase avec service role
async function getServerClient() {
  const url = Deno.env.get('SUPABASE_URL');
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!url || !key) {
    throw new Error('Missing Supabase credentials');
  }

  return createClient(url, key, { 
    auth: { persistSession: false },
    global: { headers: { 'X-Client-Info': 'booking-resolve-edge-function' } }
  });
}

// Helper: Validation token format
function isValidTokenFormat(token: string): boolean {
  return /^[A-Za-z0-9]{20,50}$/.test(token.trim());
}

// Helper: Validation code Airbnb format
function isValidAirbnbCode(code: string): boolean {
  const normalized = normalizeCode(code);
  return /^[A-Z0-9]{6,12}$/.test(normalized);
}

// Helper: Response JSON avec CORS
function jsonResponse(data: any, status: number = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
    },
  });
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  console.log('🔍 Booking resolve function called');
  console.log('📅 Timestamp:', new Date().toISOString());
  console.log('🌐 Method:', req.method);
  console.log('📍 URL:', req.url);

  // Vérifier méthode
  if (req.method !== 'POST') {
    return jsonResponse({
      success: false,
      error: {
        code: 'METHOD_NOT_ALLOWED',
        message: 'Only POST method is allowed'
      }
    }, 405);
  }

  try {
    // Parser le body
    let requestBody: ResolveRequest;
    try {
      requestBody = await req.json();
    } catch (parseError) {
      console.error('❌ Failed to parse request body:', parseError);
      return jsonResponse({
        success: false,
        error: {
          code: 'INVALID_JSON',
          message: 'Invalid JSON in request body'
        }
      }, 400);
    }

    const { token, airbnbCode } = requestBody;

    // Validations d'entrée
    if (!token || typeof token !== 'string') {
      return jsonResponse({
        success: false,
        error: {
          code: 'TOKEN_REQUIRED',
          message: 'Token is required and must be a string'
        }
      }, 400);
    }

    if (!airbnbCode || typeof airbnbCode !== 'string') {
      return jsonResponse({
        success: false,
        error: {
          code: 'AIRBNB_CODE_REQUIRED',
          message: 'Airbnb code is required and must be a string'
        }
      }, 400);
    }

    // Validation format token
    if (!isValidTokenFormat(token)) {
      return jsonResponse({
        success: false,
        error: {
          code: 'ERR_TOKEN_INVALID',
          message: 'Invalid token format'
        }
      }, 404);
    }

    // Normaliser et valider code Airbnb
    const normalizedCode = normalizeCode(airbnbCode);
    if (!isValidAirbnbCode(normalizedCode)) {
      return jsonResponse({
        success: false,
        error: {
          code: 'INVALID_AIRBNB_CODE_FORMAT',
          message: 'Invalid Airbnb code format. Expected 6-12 alphanumeric characters.'
        }
      }, 400);
    }

    console.log('📝 Request validated:', { 
      token: `${token.substring(0, 8)}...`,
      airbnbCode: normalizedCode.substring(0, 2) + '***'
    });

    // Initialiser client Supabase
    const supabase = await getServerClient();

    // 1) Vérifier le token dans property_verification_tokens
    console.log('🔐 Vérification du token...');
    const { data: tokenData, error: tokenError } = await supabase
      .from('property_verification_tokens')
      .select('property_id, expires_at, is_active')
      .eq('token', token)
      .maybeSingle();

    if (tokenError) {
      console.error('❌ Database error while fetching token:', tokenError);
      return jsonResponse({
        success: false,
        error: {
          code: 'DATABASE_ERROR',
          message: 'Failed to verify token'
        }
      }, 500);
    }

    if (!tokenData) {
      console.log('❌ Token not found');
      return jsonResponse({
        success: false,
        error: {
          code: 'ERR_TOKEN_INVALID',
          message: 'Token not found or invalid'
        }
      }, 404);
    }

    // Vérifier expiration du token
    if (!tokenData.is_active) {
      console.log('❌ Token is inactive');
      return jsonResponse({
        success: false,
        error: {
          code: 'ERR_TOKEN_EXPIRED',
          message: 'Token is inactive'
        }
      }, 410);
    }

    if (tokenData.expires_at && new Date(tokenData.expires_at) < new Date()) {
      console.log('❌ Token has expired');
      return jsonResponse({
        success: false,
        error: {
          code: 'ERR_TOKEN_EXPIRED',
          message: 'Token has expired'
        }
      }, 410);
    }

    console.log('✅ Token validated for property:', tokenData.property_id);

    // 2) Chercher la réservation Airbnb correspondante
    console.log('🏠 Recherche de la réservation Airbnb...');
    
    // Utiliser la structure de table existante
    const searchPattern = createNormalizedSearchPattern(normalizedCode);
    
    const { data: reservationData, error: reservationError } = await supabase
      .from('airbnb_reservations')
      .select(`
        property_id,
        airbnb_booking_id,
        start_date,
        end_date,
        guest_name,
        summary,
        description
      `)
      .eq('property_id', tokenData.property_id)
      .ilike('airbnb_booking_id', searchPattern)
      .maybeSingle();

    if (reservationError) {
      console.error('❌ Database error while fetching reservation:', reservationError);
      return jsonResponse({
        success: false,
        error: {
          code: 'DATABASE_ERROR',
          message: 'Failed to fetch reservation data'
        }
      }, 500);
    }

    if (!reservationData) {
      console.log('❌ Reservation not found for code:', normalizedCode.substring(0, 2) + '***');
      return jsonResponse({
        success: false,
        error: {
          code: 'ERR_CODE_NOT_FOUND',
          message: 'No reservation found for this Airbnb code on this property'
        }
      }, 404);
    }

    console.log('✅ Reservation found:', {
      checkIn: reservationData.start_date,
      checkOut: reservationData.end_date,
      guestName: reservationData.guest_name ? '***' : null,
      airbnbBookingId: reservationData.airbnb_booking_id
    });

    // 3) Récupérer le nom de la propriété séparément (optionnel)
    let propertyName: string | undefined;
    try {
      const { data: propertyData } = await supabase
        .from('properties')
        .select('name')
        .eq('id', tokenData.property_id)
        .maybeSingle();
      propertyName = propertyData?.name;
    } catch (error) {
      console.warn('⚠️ Could not fetch property name:', error);
      // Non-bloquant, continuer sans le nom
    }

    // 4) Construire la réponse avec les bons noms de colonnes
    const response: ResolveResponse = {
      success: true,
      data: {
        propertyId: reservationData.property_id,
        airbnbCode: reservationData.airbnb_booking_id, // Utiliser la vraie valeur de la DB
        checkIn: reservationData.start_date,          // start_date au lieu de check_in_date
        checkOut: reservationData.end_date,           // end_date au lieu de check_out_date
        guestName: reservationData.guest_name || undefined,
        propertyName: propertyName
      }
    };

    console.log('🎉 Booking resolved successfully');
    return jsonResponse(response);

  } catch (error) {
    console.error('❌ Unexpected error in booking-resolve:', error);
    return jsonResponse({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred'
      }
    }, 500);
  }
});

// Health check endpoint (pour /health)
// Note: Dans une vraie implémentation, vous pourriez ajouter une route GET /health
