import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Configuration CORS sécurisée - Domaines autorisés uniquement
const ALLOWED_ORIGINS = [
  // Développement local
  'http://localhost:3000',
  'http://localhost:5173', // Vite default port
  'http://localhost:54321', // Supabase local
  
  // Développement réseau local (adresses IP locales)
  'http://192.168.11.195:3000',
  'http://192.168.11.203:3000',
  'http://192.168.1.1:3000',
  'http://127.0.0.1:3000',
  
  // Production - ✅ DOMAINE PRINCIPAL
  'https://checky.ma',
  'https://www.checky.ma',
  // Fallback Vercel (preview deployments uniquement)
  'https://morocco-host-helper.vercel.app',
];

// ✅ Base URL des liens invités - TOUJOURS checky.ma (évite cheki typo / mauvaise config env)
const GUEST_LINK_BASE_URL = 'https://checky.ma';

// Headers CORS dynamiques basés sur l'origine
function getCorsHeaders(request: Request): Record<string, string> {
  const origin = request.headers.get('origin');
  
  // Vérifier si l'origine est dans la liste autorisée
  let isAllowedOrigin = origin && ALLOWED_ORIGINS.includes(origin);
  
  // Si pas trouvé exactement, vérifier si c'est une adresse IP locale (développement)
  if (!isAllowedOrigin && origin) {
    // Accepter les adresses IP locales pour le développement (192.168.x.x, 10.x.x.x, 172.16-31.x.x, 127.0.0.1)
    // Pattern amélioré pour matcher les IPs complètes avec port optionnel
    const localIpPattern = /^https?:\/\/((192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+|172\.(1[6-9]|2[0-9]|3[01])\.\d+\.\d+|127\.0\.0\.1|localhost)(:\d+)?)$/;
    if (localIpPattern.test(origin)) {
      isAllowedOrigin = true;
    }
    // Accepter aussi les déploiements Vercel
    if (origin.includes('vercel.app')) {
      isAllowedOrigin = true;
    }
  }
  
  return {
    'Access-Control-Allow-Origin': isAllowedOrigin && origin ? origin : 'https://checky.ma',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Max-Age': '86400', // Cache preflight for 24h
  };
}

function handleOptions(request: Request): Response {
  if (request.method === 'OPTIONS') {
    const corsHeaders = getCorsHeaders(request);
    return new Response('ok', { headers: corsHeaders });
  }
  return new Response('Method not allowed', { status: 405 });
}

// Inline getServerClient pour éviter les problèmes d'import
async function getServerClient() {
  const url = Deno.env.get('SUPABASE_URL');
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!url || !key) {
    throw new Error('Missing Supabase credentials');
  }

  return createClient(url, key, { auth: { persistSession: false } });
}

// ✅ NOUVEAU : Fonction utilitaire pour extraire la partie date (YYYY-MM-DD) sans décalage timezone
// Évite les problèmes de décalage d'un jour lors de la conversion de dates
function extractDateOnly(dateValue: string | Date | any): string {
  if (typeof dateValue === 'string') {
    // Si format ISO complet (2025-12-25T23:00:00.000Z), extraire juste YYYY-MM-DD
    if (dateValue.includes('T')) {
      return dateValue.split('T')[0];
    }
    // Si déjà YYYY-MM-DD, retourner tel quel
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateValue)) {
      return dateValue;
    }
    // Sinon, essayer de parser et extraire
    const dateObj = new Date(dateValue);
    const year = dateObj.getUTCFullYear();
    const month = String(dateObj.getUTCMonth() + 1).padStart(2, '0');
    const day = String(dateObj.getUTCDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
  
  // Si Date object, extraire la partie date en UTC pour éviter les décalages
  const dateObj = dateValue instanceof Date ? dateValue : new Date(dateValue);
  const year = dateObj.getUTCFullYear();
  const month = String(dateObj.getUTCMonth() + 1).padStart(2, '0');
  const day = String(dateObj.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Inline security functions pour les codes Airbnb
function normalizeCode(input: string): string {
  return (input || '').trim().toUpperCase();
}

function isAirbnbCode(input?: string | null): boolean {
  if (!input || typeof input !== 'string') return false;
  return /^HM[A-Z0-9]{8,12}$/.test(normalizeCode(input));
}

/** Lien sans date d'expiration (expires_at NULL) reste valide jusqu'à révocation admin (is_active). */
function guestTokenDateValid(expiresAt: string | null | undefined): boolean {
  if (expiresAt == null || expiresAt === '') return true;
  return new Date(expiresAt).getTime() >= Date.now();
}

async function hashAccessCode(code: string, pepper?: string): Promise<string> {
  const normalized = normalizeCode(code);
  if (!normalized) throw new Error('Empty access code');

  const effectivePepper = pepper ?? Deno.env.get('ACCESS_CODE_PEPPER');
  if (!effectivePepper) throw new Error('Missing ACCESS_CODE_PEPPER');

  const encoder = new TextEncoder();
  const data = encoder.encode(`${normalized}::${effectivePepper}`);
  const digest = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(digest));
  const hashHex = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  return hashHex;
}

type IssueReq = {
  action?: 'issue';
  propertyId: string;
  airbnbCode?: string;
  bookingId?: string;
  /** Jours avant expiration. Omis / null / 0 / "unlimited" = pas d'expiration automatique (révocation par admin via is_active). */
  expiresIn?: number | null | 'unlimited';
  linkType?: 'ics_direct' | 'ics_with_code' | 'independent';
  reservationData?: {
    airbnbCode: string;
    startDate: Date | string; // ✅ CORRIGÉ : Accepter Date ou string YYYY-MM-DD
    endDate: Date | string; // ✅ CORRIGÉ : Accepter Date ou string YYYY-MM-DD
    guestName?: string;
    numberOfGuests?: number;
  };
};

type ResolveReq = {
  action: 'resolve';
  propertyId?: string;
  token: string;
  airbnbCode?: string;
};

type RequestBody = IssueReq | ResolveReq;

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return handleOptions(req);
  }

  console.log('🚀 Issue guest link function called');
  console.log('📅 Timestamp:', new Date().toISOString());

  // Obtenir les headers CORS dynamiques basés sur l'origine
  const dynamicCorsHeaders = getCorsHeaders(req);

  try {
    // Read request body exactly once
    let requestBody: RequestBody;
    try {
      requestBody = await req.json();
    } catch (parseError) {
      console.error('❌ Failed to parse request body:', parseError);
      return new Response(JSON.stringify({
        success: false,
        error: 'Invalid JSON in request body',
        details: parseError.message
      }), {
        status: 400,
        headers: { ...dynamicCorsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Détecter l'action (issue par défaut, resolve si explicite)
    const action = (requestBody.action ?? 'issue') as 'issue' | 'resolve';
    const server = await getServerClient();

    // Si c'est une action resolve, utiliser la logique de résolution
    if (action === 'resolve') {
      const res = await handleResolve(server, requestBody as ResolveReq);
      return new Response(JSON.stringify(res.body), {
        status: res.status,
        headers: { ...dynamicCorsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // --- ACTION: ISSUE (basé sur votre version originale) ---
    const { propertyId, bookingId, airbnbCode } = requestBody as IssueReq;
    const expiresInRaw = (requestBody as IssueReq).expiresIn;

    // Validate required fields
    if (!propertyId || typeof propertyId !== 'string') {
      console.error('❌ Missing or invalid propertyId:', propertyId);
      return new Response(JSON.stringify({
        success: false,
        error: 'Property ID is required and must be a string',
        details: { propertyId }
      }), {
        status: 400,
        headers: { ...dynamicCorsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Validate optional bookingId if provided
    if (bookingId && typeof bookingId !== 'string') {
      console.error('❌ Invalid bookingId type:', typeof bookingId);
      return new Response(JSON.stringify({
        success: false,
        error: 'Booking ID must be a string if provided',
        details: { bookingId }
      }), {
        status: 400,
        headers: { ...dynamicCorsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // expiresIn : uniquement si l'appelant impose une durée (sinon illimité côté date)
    let expiresAtIso: string | null = null;
    if (expiresInRaw === 0) {
      expiresAtIso = null;
    } else if (expiresInRaw !== undefined && expiresInRaw !== null && expiresInRaw !== 'unlimited') {
      const n = typeof expiresInRaw === 'number' ? expiresInRaw : Number(expiresInRaw);
      if (Number.isNaN(n) || n < 1 || n > 365) {
        console.error('❌ Invalid expiresIn:', expiresInRaw);
        return new Response(JSON.stringify({
          success: false,
          error: 'expiresIn doit être omis ou 0 (illimité), ou un nombre de jours entre 1 et 365',
          details: { expiresIn: expiresInRaw }
        }), {
          status: 400,
          headers: { ...dynamicCorsHeaders, 'Content-Type': 'application/json' }
        });
      }
      const d = new Date();
      d.setDate(d.getDate() + n);
      expiresAtIso = d.toISOString();
    }

    console.log('📥 Request validated:', { propertyId, bookingId, airbnbCode, expiresIn: expiresInRaw, expiresAtIso });

    // ✅ NOUVEAU : Vérifier les permissions de génération de tokens (avec fallback permissif)
    console.log('🔐 Vérification des permissions de génération de tokens...');
    let permissionAllowed = true; // Fallback permissif par défaut
    try {
      const { data: permissionCheck, error: permissionError } = await server.rpc('check_reservation_allowed', {
        property_uuid: propertyId
      });
      if (permissionError) {
        // Vérifier si c'est une erreur PGRST202 (fonction non trouvée)
        if (permissionError.code === 'PGRST202' || permissionError.message?.includes('function') || permissionError.message?.includes('not found')) {
          console.warn('⚠️ check_reservation_allowed RPC not found – proceeding with allowed=true (fallback)');
          permissionAllowed = true;
        } else {
          console.error('❌ Erreur lors de la vérification des permissions:', permissionError);
          console.warn('⚠️ Permission check failed – proceeding with allowed=true (fallback)');
          permissionAllowed = true;
        }
      } else if (permissionCheck) {
        // Si la fonction existe et retourne des données, honorer la réponse
        permissionAllowed = permissionCheck.allowed === true;
        if (!permissionAllowed) {
          console.log('🚫 Génération de tokens non autorisée:', permissionCheck);
          return new Response(JSON.stringify({
            success: false,
            error: 'Génération de tokens non autorisée',
            details: {
              reason: permissionCheck?.reason || 'Contrôle administrateur actif',
              control_type: permissionCheck?.control_type || 'blocked'
            }
          }), {
            status: 403,
            headers: { ...dynamicCorsHeaders, 'Content-Type': 'application/json' }
          });
        }
      }
    } catch (permissionError) {
      console.error('❌ Unexpected error during permission check:', permissionError);
      console.warn('⚠️ Permission check failed – proceeding with allowed=true (fallback)');
      permissionAllowed = true;
    }

    console.log('✅ Génération de tokens autorisée (ou fallback).');

    // If no bookingId is provided, try to find the most recent active booking for this property
    let finalBookingId = bookingId;
    if (!bookingId) {
      console.log('📅 No bookingId provided, searching for recent bookings...');
      try {
        const { data: recentBooking, error: bookingError } = await server
          .from('bookings')
          .select('id')
          .eq('property_id', propertyId)
          .gte('check_out_date', new Date().toISOString().split('T')[0]) // Future or current bookings
          .order('check_in_date', { ascending: true })
          .limit(1)
          .maybeSingle();

        if (bookingError) {
          console.error('❌ Error searching for recent bookings:', bookingError);
          // Don't fail, just continue without bookingId
        } else if (recentBooking) {
          finalBookingId = recentBooking.id;
          console.log('✅ Found recent booking:', finalBookingId);
        } else {
          console.log('⚠️ No recent booking found for property');
        }
      } catch (bookingSearchError) {
        console.error('❌ Unexpected error during booking search:', bookingSearchError);
        // Don't fail, just continue without bookingId
      }
    }

    // ✅ NOUVEAU : Vérifier d'abord si un token actif récent existe déjà (idempotence)
    // Cela évite de créer des tokens en double si la fonction est appelée deux fois
    console.log('🔍 Vérification d\'un token existant récent...');
    let existingActiveToken = null;
    let hasAirbnbCode = false;
    try {
      // Préparer la vérification du code Airbnb
      const candidate = normalizeCode(airbnbCode || '');
      hasAirbnbCode = isAirbnbCode(candidate);
      
      // Si un code Airbnb est fourni, vérifier par code (priorité)
      if (hasAirbnbCode) {
        const { data: tokenWithCode } = await server
          .from('property_verification_tokens')
          .select('id, token, expires_at, created_at, metadata')
          .eq('property_id', propertyId)
          .eq('is_active', true)
          .eq('airbnb_confirmation_code', candidate)
          .maybeSingle();

        if (tokenWithCode && guestTokenDateValid(tokenWithCode.expires_at)) {
          existingActiveToken = tokenWithCode;
        }
      } else {
        const tokenQuery = server
          .from('property_verification_tokens')
          .select('id, token, expires_at, created_at, metadata')
          .eq('property_id', propertyId)
          .eq('is_active', true);

        if (finalBookingId) {
          tokenQuery.eq('booking_id', finalBookingId);
        }

        const { data: tokenResult } = await tokenQuery.maybeSingle();
        if (tokenResult && guestTokenDateValid(tokenResult.expires_at)) {
          existingActiveToken = tokenResult;
        }
      }
      
      // Si un token actif existe et a été créé il y a moins de 5 secondes, le réutiliser (idempotence)
      if (existingActiveToken) {
        const tokenAge = Date.now() - new Date(existingActiveToken.created_at).getTime();
        if (tokenAge < 5000) { // 5 secondes
          console.log('✅ Token actif récent trouvé (idempotence), réutilisation:', existingActiveToken.id);
          const baseUrl = GUEST_LINK_BASE_URL;
          const rdEarly = (requestBody as IssueReq).reservationData;
          const codeEarly = rdEarly?.airbnbCode && rdEarly.airbnbCode !== 'INDEPENDENT_BOOKING' ? rdEarly.airbnbCode : null;
          const guestLink = codeEarly
            ? `${baseUrl}/v/${existingActiveToken.token}/${encodeURIComponent(codeEarly)}`
            : `${baseUrl}/v/${existingActiveToken.token}`;
          
          return new Response(JSON.stringify({
            success: true,
            token: existingActiveToken.token,
            url: guestLink,
            expiresAt: existingActiveToken.expires_at,
            propertyId,
            bookingId: finalBookingId,
            requiresCode: hasAirbnbCode
          }), {
            status: 200,
            headers: { ...dynamicCorsHeaders, 'Content-Type': 'application/json' }
          });
        }
      }
    } catch (idempotencyCheckError) {
      console.warn('⚠️ Erreur lors de la vérification d\'idempotence (continuera):', idempotencyCheckError);
      // Continue avec la création d'un nouveau token
    }

    // Ne pas désactiver les anciens tokens : le lien /v/{token} reste valide tant que is_active et
    // (expires_at IS NULL OU expires_at future). Pas d'expiration automatique par défaut.

    // ✅ CORRECTION : Générer un nouveau token unique
    console.log('🆕 Génération d\'un nouveau token...');
    const token = generateUniqueToken();

    // ✅ NOUVEAU : Gestion des codes Airbnb sécurisés avec support des liens directs
    let requiresCode = false;
    let airbnb_confirmation_code: string | null = null;
    let access_code_hash: string | null = null;
    let reservation_metadata: any = null;

    // Vérifier le type de lien demandé
    const linkType = (requestBody as IssueReq).linkType || 'ics_with_code';
    
    if (linkType === 'ics_direct') {
      // Lien direct : pas de validation de code, créer la réservation immédiatement
      console.log('🔗 Création d\'un lien ICS direct (sans validation de code)');
      requiresCode = false;
      
      let reservationData = (requestBody as IssueReq).reservationData;
      
      // ✅ DÉSACTIVÉ : Ne plus créer de données par défaut automatiquement
      // Pour les réservations indépendantes, le guest choisira ses propres dates
      // Seules les réservations ICS/Airbnb auront reservationData fourni explicitement
      /*
      // ✅ ANCIEN : Si reservationData est manquant, créer des données par défaut
      if (!reservationData) {
        console.warn('⚠️ reservationData manquant, création de données par défaut');
        
        // Créer des données minimales basées sur le booking trouvé
        if (finalBookingId) {
          try {
            const { data: bookingData, error: bookingError } = await server
              .from('bookings')
              .select('booking_reference, check_in_date, check_out_date, number_of_guests, guest_name')
              .eq('id', finalBookingId)
              .single();
            
            if (!bookingError && bookingData) {
              reservationData = {
                airbnbCode: bookingData.booking_reference || 'INDEPENDENT_BOOKING',
                startDate: bookingData.check_in_date,
                endDate: bookingData.check_out_date,
                guestName: bookingData.guest_name,
                numberOfGuests: bookingData.number_of_guests || 1
              };
              console.log('✅ Données de réservation créées depuis booking:', reservationData);
            }
          } catch (err) {
            console.error('❌ Erreur lors de la récupération du booking:', err);
          }
        }
        
        // Si toujours pas de données, créer des données minimales
        if (!reservationData) {
          const today = new Date();
          const tomorrow = new Date(today);
          tomorrow.setDate(tomorrow.getDate() + 1);
          
          reservationData = {
            airbnbCode: airbnbCode || 'INDEPENDENT_BOOKING',
            startDate: today.toISOString().split('T')[0],
            endDate: tomorrow.toISOString().split('T')[0],
            numberOfGuests: 1
          };
          console.log('✅ Données de réservation par défaut créées:', reservationData);
        }
      }
      */
      
      
      // ✅ MODIFIÉ : Ne créer de réservation QUE si reservationData est fourni
      // Si pas de reservationData, c'est une réservation indépendante (guest choisit ses dates)
      if (reservationData) {
        // Validate reservationData structure
        if (!reservationData.airbnbCode || typeof reservationData.airbnbCode !== 'string') {
          console.error('❌ Missing or invalid airbnbCode in reservationData:', reservationData);
          return new Response(JSON.stringify({
            success: false,
            error: 'airbnbCode is required in reservationData',
            details: { reservationData }
          }), {
            status: 400,
            headers: { ...dynamicCorsHeaders, 'Content-Type': 'application/json' }
          });
        }
        
        if (!reservationData.startDate || !reservationData.endDate) {
          console.error('❌ Missing startDate or endDate in reservationData:', reservationData);
          return new Response(JSON.stringify({
            success: false,
            error: 'startDate and endDate are required in reservationData',
            details: { reservationData }
          }), {
            status: 400,
            headers: { ...dynamicCorsHeaders, 'Content-Type': 'application/json' }
          });
        }
        
        // ✅ Créer la réservation immédiatement lors de la génération du lien
      try {
        console.log('🏗️ Création de la réservation ICS en base de données...');
        console.log('📥 reservationData reçu:', {
          airbnbCode: reservationData.airbnbCode,
          startDate: reservationData.startDate,
          endDate: reservationData.endDate,
          startDateType: typeof reservationData.startDate,
          endDateType: typeof reservationData.endDate
        });
        
        // ✅ CRITIQUE : Récupérer le user_id de la propriété AVANT de créer la réservation
        console.log('🔍 Récupération du user_id de la propriété...');
        const { data: propertyData, error: propertyError } = await server
          .from('properties')
          .select('user_id')
          .eq('id', propertyId)
          .single();
        
        if (propertyError || !propertyData || !propertyData.user_id) {
          console.error('❌ Impossible de récupérer le user_id de la propriété:', propertyError);
          throw new Error('Property owner (user_id) not found - cannot create booking');
        }
        
        const propertyOwnerId = propertyData.user_id;
        console.log('✅ user_id de la propriété récupéré:', propertyOwnerId.substring(0, 8) + '...');
        
        // ✅ CORRIGÉ : Utiliser extractDateOnly pour éviter le décalage timezone
        // Les dates peuvent être des objets Date JavaScript ou des chaînes ISO
        const checkInDate = extractDateOnly(reservationData.startDate);
        const checkOutDate = extractDateOnly(reservationData.endDate);
          
          console.log('📅 Dates normalisées pour la réservation:', { checkInDate, checkOutDate });
          
          // Vérifier si une réservation existe déjà pour ce code Airbnb
          // ✅ CORRIGÉ : .order().limit(1) avant .maybeSingle() pour éviter l'erreur
          // quand des doublons existent déjà (maybeSingle échoue si >1 résultat)
          const { data: existingBooking } = await server
            .from('bookings')
            .select('id, status')
            .eq('property_id', propertyId)
            .eq('booking_reference', reservationData.airbnbCode)
            .order('updated_at', { ascending: false })
            .limit(1)
            .maybeSingle();

          let bookingId: string;
          
          if (existingBooking) {
            // Mettre à jour la réservation existante
            console.log('📝 Mise à jour réservation existante:', existingBooking.id);
            bookingId = existingBooking.id;
            
            const { error: updateError } = await server
              .from('bookings')
              .update({
                check_in_date: checkInDate,
                check_out_date: checkOutDate,
                guest_name: reservationData.guestName || 'Guest',
                number_of_guests: reservationData.numberOfGuests || 1,
                updated_at: new Date().toISOString()
              })
              .eq('id', bookingId);

            if (updateError) {
              console.error('❌ Erreur mise à jour réservation:', updateError);
              throw new Error(`Erreur mise à jour réservation: ${updateError.message}`);
            }
          } else {
            // Créer une nouvelle réservation
            console.log('🆕 Création nouvelle réservation ICS');
            
            // ✅ PROTECTION : Dernière vérification avant insertion pour éviter les doublons
            // ✅ CORRIGÉ : .order().limit(1) pour gérer les doublons existants
            const { data: lastCheckBooking } = await server
              .from('bookings')
              .select('id, status')
              .eq('property_id', propertyId)
              .eq('booking_reference', reservationData.airbnbCode)
              .order('updated_at', { ascending: false })
              .limit(1)
              .maybeSingle();
            
            if (lastCheckBooking) {
              // Une réservation a été créée entre-temps (race condition), la réutiliser
              console.log('⚠️ Réservation trouvée lors de la dernière vérification (race condition évitée):', lastCheckBooking.id);
              bookingId = lastCheckBooking.id;
            } else {
              const { data: newBooking, error: createError } = await server
                .from('bookings')
                .insert({
                  user_id: propertyOwnerId, // ✅ CORRECTION CRITIQUE : Ajouter le user_id du propriétaire
                  property_id: propertyId,
                  check_in_date: checkInDate,
                  check_out_date: checkOutDate,
                  guest_name: reservationData.guestName || 'Guest',
                  number_of_guests: reservationData.numberOfGuests || 1,
                  booking_reference: reservationData.airbnbCode,
                  status: 'pending',
                  created_at: new Date().toISOString(),
                  updated_at: new Date().toISOString()
                })
                .select('id')
                .single();

              if (createError) {
                // Si c'est une erreur de contrainte unique (doublon), récupérer la réservation existante
                if (createError.code === '23505' || createError.message?.includes('unique') || createError.message?.includes('duplicate')) {
                  console.log('⚠️ Contrainte unique violée, récupération de la réservation existante...');
                  const { data: existingBookingAfterError } = await server
                    .from('bookings')
                    .select('id')
                    .eq('property_id', propertyId)
                    .eq('booking_reference', reservationData.airbnbCode)
                    .order('updated_at', { ascending: false })
                    .limit(1)
                    .maybeSingle();
                  
                  if (existingBookingAfterError) {
                    bookingId = existingBookingAfterError.id;
                    console.log('✅ Réservation existante récupérée:', bookingId);
                  } else {
                    throw new Error(`Erreur création réservation: ${createError.message}`);
                  }
                } else {
                  console.error('❌ Erreur création réservation:', createError);
                  throw new Error(`Erreur création réservation: ${createError.message}`);
                }
              } else {
                bookingId = newBooking.id;
              }
            }
          }
          
          console.log('✅ Réservation ICS créée/mise à jour avec ID:', bookingId);
          
          // ✅ CORRIGÉ : Stocker les dates normalisées (YYYY-MM-DD) dans les métadonnées
          // Cela évite les problèmes de décalage lors de la récupération dans VerifyToken.tsx
          reservation_metadata = {
            type: 'ics_direct',
            airbnbCode: reservationData.airbnbCode,
            startDate: checkInDate, // ✅ CORRIGÉ : Utiliser la date normalisée
            endDate: checkOutDate, // ✅ CORRIGÉ : Utiliser la date normalisée
            guestName: reservationData.guestName,
            numberOfGuests: reservationData.numberOfGuests,
            bookingId: bookingId // ✅ NOUVEAU : ID de la réservation créée
          };
          
          console.log('✅ Métadonnées de réservation normalisées:', {
            startDate: checkInDate,
            endDate: checkOutDate,
            bookingId
          });
          
          console.log('✅ Données de réservation et ID stockés dans le token');
        } catch (error) {
          console.error('❌ Erreur lors de la création de la réservation ICS:', error);
          return new Response(JSON.stringify({
            success: false,
            error: 'Failed to create ICS reservation',
            details: error.message
          }), {
            status: 500,
            headers: { ...dynamicCorsHeaders, 'Content-Type': 'application/json' }
          });
        }
      } else {
        // ✅ RÉSERVATION INDÉPENDANTE : Pas de reservationData fourni
        // Le guest choisira ses propres dates dans le formulaire
        console.log('📝 Réservation indépendante - Pas de dates pré-remplies');
      }
    } else {
      // Logique existante pour les liens avec validation de code
      const candidate = normalizeCode(airbnbCode || finalBookingId || '');
      if (isAirbnbCode(candidate)) {
        requiresCode = true;
        airbnb_confirmation_code = candidate;
        try {
          access_code_hash = await hashAccessCode(candidate);
          console.log('✅ Code Airbnb détecté et hashé avec succès (code non loggé pour sécurité)');
        } catch (error) {
          console.error('❌ Failed to hash access code (not logging code for security)');
          console.error('❌ Error details:', error.message);
          console.error('❌ Vérifiez que ACCESS_CODE_PEPPER est configuré');
          return new Response(JSON.stringify({
            success: false,
            error: 'MISSING_ACCESS_CODE_PEPPER',
            details: 'Le secret ACCESS_CODE_PEPPER n\'est pas configuré sur le serveur'
          }), {
            status: 500,
            headers: { ...dynamicCorsHeaders, 'Content-Type': 'application/json' }
          });
        }
      }
    }

    let newToken;
    try {
      // Créer le token avec ou sans sécurité Airbnb
      const tokenData = {
        property_id: propertyId,
        token,
        is_active: true,
        expires_at: expiresAtIso,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        booking_id: finalBookingId || null,
        metadata: { 
          source: 'issue',
          linkType: linkType,
          reservationData: reservation_metadata,
          guestLinkExpiry: expiresAtIso ? 'dated' : 'unlimited'
        }
      };

      if (requiresCode && airbnb_confirmation_code && access_code_hash) {
        // Token sécurisé avec code Airbnb
        (tokenData as any).airbnb_confirmation_code = airbnb_confirmation_code;
        (tokenData as any).access_code_hash = access_code_hash;

        // Upsert avec fallback si contrainte unique manquante (42P10)
        let tokenResult: any = null;
        let createError: any = null;

        const upsert = await server
          .from('property_verification_tokens')
          .upsert(tokenData, { onConflict: 'property_id,airbnb_confirmation_code' })
          .select()
          .maybeSingle();

        tokenResult = upsert.data;
        createError = upsert.error;

        if (createError?.code === '42P10') {
          console.warn('⚠️ Contrainte unique manquante, utilisation du fallback manual');
          
          // Fallback sans ON CONFLICT : sélectionner puis update/insert
          const existing = await server
            .from('property_verification_tokens')
            .select('id')
            .eq('property_id', tokenData.property_id)
            .eq('airbnb_confirmation_code', tokenData.airbnb_confirmation_code)
            .maybeSingle();

          if (existing.data?.id) {
            console.log('📝 Mise à jour du token existant');
            const upd = await server
              .from('property_verification_tokens')
              .update({
                token: tokenData.token,
                is_active: tokenData.is_active,
                expires_at: tokenData.expires_at,
                updated_at: tokenData.updated_at,
                booking_id: tokenData.booking_id,
                access_code_hash: tokenData.access_code_hash,
                metadata: tokenData.metadata
              })
              .eq('id', existing.data.id)
              .select()
              .single();

            tokenResult = upd.data;
            createError = upd.error;
          } else {
            console.log('➕ Création d\'un nouveau token');
            const ins = await server
              .from('property_verification_tokens')
              .insert(tokenData)
              .select()
              .single();

            tokenResult = ins.data;
            createError = ins.error;
          }
        }

        if (createError) {
          console.error('❌ Erreur lors de la création du token sécurisé:', createError);
          return new Response(JSON.stringify({
            success: false,
            error: createError.code === '42P10'
              ? 'UNIQUE_CONSTRAINT_MISSING'
              : 'Failed to create secure guest verification token',
            details: createError.message
          }), {
            status: 500,
            headers: { ...dynamicCorsHeaders, 'Content-Type': 'application/json' }
          });
        }

        newToken = tokenResult;
        console.log('✅ Token sécurisé Airbnb créé avec succès:', newToken.id);
      } else {
        // Token normal sans sécurité Airbnb
        const { data: tokenResult, error: createError } = await server
          .from('property_verification_tokens')
          .insert(tokenData)
          .select()
          .single();

        if (createError) {
          console.error('❌ Erreur lors de la création du token:', createError);
          return new Response(JSON.stringify({
            success: false,
            error: 'Failed to create guest verification token',
            details: createError.message
          }), {
            status: 500,
            headers: { ...dynamicCorsHeaders, 'Content-Type': 'application/json' }
          });
        }

        newToken = tokenResult;
        console.log('✅ Token normal créé avec succès:', newToken.id);
      }
    } catch (createError) {
      console.error('❌ Unexpected error during token creation:', createError);
      return new Response(JSON.stringify({
        success: false,
        error: 'Unexpected error during token creation',
        details: createError.message
      }), {
        status: 500,
        headers: { ...dynamicCorsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // ✅ NOUVEAU : Incrémenter le compteur de réservations (seulement si la fonction existe)
    // ✅ CORRIGÉ : Gestion silencieuse de l'erreur si la fonction n'existe pas
    try {
      const { error: incrementError } = await server.rpc('increment_reservation_count', {
        property_uuid: propertyId
      });
      if (incrementError) {
        // ✅ CORRIGÉ : Ignorer complètement si c'est une erreur PGRST202 (fonction non trouvée)
        // Cette erreur est attendue si la migration n'a pas été appliquée
        if (incrementError.code === 'PGRST202' || incrementError.message?.includes('not found') || incrementError.message?.includes('schema cache')) {
          // Fonction non disponible - ignorer silencieusement (pas de log)
        } else {
          // Autres erreurs - logger seulement en mode développement
          if (Deno.env.get('ENVIRONMENT') === 'development') {
            console.error('⚠️ Erreur lors de l\'incrémentation du compteur:', incrementError);
          }
        }
        // Don't fail token creation for this error
      } else {
        // Succès - logger seulement si nécessaire
        if (Deno.env.get('ENVIRONMENT') === 'development') {
          console.log('✅ Compteur de réservations incrémenté');
        }
      }
    } catch (incrementError: any) {
      // ✅ CORRIGÉ : Ignorer complètement si la fonction n'existe pas
      if (incrementError?.code === 'PGRST202' || incrementError?.message?.includes('not found') || incrementError?.message?.includes('schema cache')) {
        // Fonction non disponible - ignorer silencieusement (pas de log)
      } else {
        // Autres erreurs inattendues - logger seulement en mode développement
        if (Deno.env.get('ENVIRONMENT') === 'development') {
          console.error('❌ Unexpected error during counter increment:', incrementError);
        }
      }
      // Don't fail token creation for this error
    }

    // ✅ URLs : format lien unique selon type (synchronisé vs non synchronisé)
    // - Non synchronisé : https://checky.ma/v/{token}
    // - Synchronisé : https://checky.ma/v/{token}/{reservationCode} → dates pré-remplies
    const baseUrl = GUEST_LINK_BASE_URL;
    const rd = (requestBody as IssueReq).reservationData;
    const reservationCode = rd?.airbnbCode && rd.airbnbCode !== 'INDEPENDENT_BOOKING'
      ? rd.airbnbCode
      : null;
    const guestLink = reservationCode
      ? `${baseUrl}/v/${newToken.token}/${encodeURIComponent(reservationCode)}`
      : `${baseUrl}/v/${newToken.token}`;

    console.log('🔗 Lien invité généré:', guestLink, reservationCode ? `(synced: ${reservationCode})` : '(non-synced)');
    console.log('📅 Token expires at:', newToken.expires_at);

    return new Response(JSON.stringify({
      success: true,
      token: newToken.token,
      url: guestLink,
      reservationCode: reservationCode || undefined,
      isSynced: !!reservationCode,
      expiresAt: newToken.expires_at,
      propertyId,
      bookingId: finalBookingId,
      requiresCode
    }), {
      status: 200,
      headers: { ...dynamicCorsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('❌ Unexpected error in issue-guest-link:', error);
    return new Response(JSON.stringify({
      success: false,
      error: 'Internal server error',
      details: error.message
    }), {
      status: 500,
      headers: { ...dynamicCorsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

// --- Resolve handler (pour action: 'resolve') ---
async function handleResolve(server: any, args: ResolveReq) {
  const token = args.token;
  if (!token || typeof token !== 'string' || token.trim().length === 0) {
    return { status: 400, body: { success: false, error: 'TOKEN_REQUIRED' } };
  }

  // Validation basique du token (éviter l'injection)
  if (!/^[A-Za-z0-9]{20,50}$/.test(token.trim())) {
    return { status: 400, body: { success: false, error: 'TOKEN_INVALID_FORMAT' } };
  }

  let propertyId = args.propertyId || null;
  
  // Validation UUID si propertyId fourni
  if (propertyId) {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(propertyId.trim())) {
      return { status: 400, body: { success: false, error: 'PROPERTY_ID_INVALID_FORMAT' } };
    }
  }

  try {
    if (!propertyId) {
      const { data } = await server
        .from('property_verification_tokens')
        .select('property_id')
        .eq('token', token)
        .maybeSingle();
      propertyId = data?.property_id || null;
    }
  } catch (error) {
    console.error('Database error while fetching property_id:', error);
    return { status: 500, body: { success: false, error: 'DATABASE_ERROR' } };
  }

  if (!propertyId) return { status: 404, body: { success: false, error: 'PROPERTY_NOT_FOUND' } };

  let tokenRow;
  try {
    const { data, error } = await server
      .from('property_verification_tokens')
      .select('access_code_hash, used_count, expires_at, is_active, booking_id')
      .eq('token', token)
      .eq('property_id', propertyId)
      .maybeSingle();
    
    if (error) {
      console.error('Database error while fetching token:', error);
      return { status: 500, body: { success: false, error: 'DATABASE_ERROR' } };
    }
    
    tokenRow = data;
  } catch (error) {
    console.error('Unexpected error while fetching token:', error);
    return { status: 500, body: { success: false, error: 'DATABASE_ERROR' } };
  }

  if (!tokenRow) return { status: 404, body: { success: false, error: 'TOKEN_NOT_FOUND' } };

  if (tokenRow.is_active === false) {
    return { status: 410, body: { success: false, error: 'expired', reason: 'inactive' } };
  }
  // expires_at NULL = pas d'expiration automatique (révocation par admin uniquement)
  if (tokenRow.expires_at && new Date(tokenRow.expires_at) < new Date()) {
    return { status: 410, body: { success: false, error: 'expired', reason: 'past_expires_at' } };
  }

  const requiresCode = !!tokenRow.access_code_hash;
  if (requiresCode) {
    const normalized = normalizeCode(args.airbnbCode || '');
    if (!normalized || !isAirbnbCode(normalized)) {
      return { status: 403, body: { success: false, error: 'code_required', requiresCode: true } };
    }
    
    try {
      const providedHash = await hashAccessCode(normalized);
      if (providedHash !== tokenRow.access_code_hash) {
        return { status: 401, body: { success: false, error: 'invalid_code', requiresCode: true } };
      }
    } catch (error) {
      console.error('Failed to hash provided code for comparison');
      return { status: 500, body: { success: false, error: 'HASH_ERROR' } };
    }
  }

  try {
    await server
      .from('property_verification_tokens')
      .update({ 
        used_count: (tokenRow.used_count ?? 0) + 1, 
        last_used_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('token', token)
      .eq('property_id', propertyId)
      .eq('is_active', true);
  } catch {}

  return { status: 200, body: { success: true, requiresCode, propertyId, bookingId: tokenRow.booking_id } };
}

// ✅ CORRECTION : Fonction améliorée pour générer un token unique crypto-secure
function generateUniqueToken(): string {
  const bytes = new Uint8Array(24); // 192 bits aléatoires crypto-secure
  crypto.getRandomValues(bytes);
  const base64 = btoa(String.fromCharCode(...bytes)).replace(/[+/=]/g, '');
  return `${base64}${Date.now().toString(36)}`;
}
