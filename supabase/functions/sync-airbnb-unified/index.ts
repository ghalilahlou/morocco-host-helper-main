import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

interface AirbnbReservation {
  id: string;
  summary: string;
  startDate: Date;
  endDate: Date;
  guestName?: string;
  description?: string;
  airbnbBookingId?: string;
  numberOfGuests?: number;
  rawEvent?: string;
}

class UnifiedAirbnbSyncService {
  static async fetchAndParseICS(icsUrl: string, forceProxy: boolean = false): Promise<AirbnbReservation[]> {
    try {
      console.log(`📡 Fetching ICS data from: ${icsUrl}`);
      
      let response;
      let usedProxy = false;
      
      if (forceProxy) {
        console.log('🔄 Using CORS proxy as requested');
        const proxyUrl = `https://corsproxy.io/?${encodeURIComponent(icsUrl)}`;
        response = await fetch(proxyUrl, {
          method: 'GET',
          headers: { 'Accept': 'text/calendar, text/plain, */*' }
        });
        usedProxy = true;
      } else {
        try {
          response = await fetch(icsUrl, {
            method: 'GET',
            headers: { 
              'Accept': 'text/calendar, text/plain, */*',
              'User-Agent': 'Morocco-Host-Helper/1.0'
            }
          });
          console.log('✅ Direct fetch successful');
        } catch (directError) {
          console.log('⚠️ Direct fetch failed, trying with CORS proxy...');
          const proxyUrl = `https://corsproxy.io/?${encodeURIComponent(icsUrl)}`;
          response = await fetch(proxyUrl, {
            method: 'GET',
            headers: { 'Accept': 'text/calendar, text/plain, */*' }
          });
          usedProxy = true;
        }
      }
      
      if (!response.ok) {
        throw new Error(`Failed to fetch ICS: ${response.status} ${response.statusText}`);
      }
      
      const icsContent = await response.text();
      console.log(`📋 ICS Content length: ${icsContent.length} characters (${usedProxy ? 'via proxy' : 'direct'})`);
      
      return this.parseICSContent(icsContent);
    } catch (error) {
      console.error('❌ Error fetching ICS:', error);
      throw error;
    }
  }

  static parseICSContent(icsContent: string): AirbnbReservation[] {
    const events = icsContent.split('BEGIN:VEVENT');
    const reservations: AirbnbReservation[] = [];
    
    console.log(`📋 Found ${events.length - 1} VEVENT blocks`);
    
    for (let i = 1; i < events.length; i++) {
      const eventContent = 'BEGIN:VEVENT' + events[i];
      const reservation = this.parseEvent(eventContent);
      if (reservation) {
        reservations.push(reservation);
      }
    }
    
    console.log(`✅ Parsed ${reservations.length} reservations`);
    return reservations;
  }

  static parseEvent(eventContent: string): AirbnbReservation | null {
    try {
      const lines = eventContent.split('\n').map(line => line.replace('\r', ''));
      
      let uid = '';
      let summary = '';
      let startDate: Date | null = null;
      let endDate: Date | null = null;
      let description = '';
      let guestName: string | undefined;
      let numberOfGuests: number | undefined;
      let airbnbBookingId: string | undefined;

      // Use indexed for-loop for proper line iteration
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        
        if (line.startsWith('UID:')) {
          uid = line.substring(4);
        } else if (line.startsWith('SUMMARY:')) {
          summary = line.substring(8);
        } else if (line.startsWith('DTSTART')) {
          const dateStr = this.extractDateFromLine(line);
          if (dateStr) startDate = this.parseICSDate(dateStr);
        } else if (line.startsWith('DTEND')) {
          const dateStr = this.extractDateFromLine(line);
          if (dateStr) endDate = this.parseICSDate(dateStr);
        } else if (line.startsWith('DESCRIPTION:')) {
          // Proper ICS unfolding per RFC5545: continuation lines start with space or tab
          let descLine = line.substring(12);
          let j = i + 1;
          
          // Continue reading continuation lines
          while (j < lines.length) {
            const nextLine = lines[j];
            if (nextLine && (nextLine.startsWith(' ') || nextLine.startsWith('\t'))) {
              // Strip the first character (space or tab) and concatenate
              descLine += nextLine.substring(1);
              j++;
            } else {
              break;
            }
          }
          
          // Decode escaped sequences in DESCRIPTION
          description = this.decodeICSDescription(descLine);
        }
      }

      if (!startDate || !endDate) {
        console.log('⚠️ Event missing dates:', { uid, summary });
        return null;
      }

      // Extract additional info with improved patterns
      guestName = this.extractGuestName(summary, description);
      numberOfGuests = this.extractNumberOfGuests(summary, description);
      airbnbBookingId = this.extractAirbnbBookingId(description, summary);
      
      // Fallback booking id: if extractAirbnbBookingId returns falsy but UID exists
      if (!airbnbBookingId && uid) {
        airbnbBookingId = `UID:${uid}`;
      }
      
      // Debug logging
      console.log(`🔍 Event parsing debug:`, {
        uid: uid.substring(0, 20) + '...',
        summary,
        descriptionLength: description.length,
        descriptionPreview: description.substring(0, 100) + '...',
        airbnbBookingId,
        guestName,
        numberOfGuests
      });

      return {
        id: uid || `airbnb-${Date.now()}-${Math.random()}`,
        summary,
        startDate,
        endDate,
        guestName,
        description,
        airbnbBookingId,
        numberOfGuests,
        rawEvent: eventContent.substring(0, 500) + '...'
      };
    } catch (error) {
      console.error('❌ Error parsing event:', error);
      return null;
    }
  }

  static extractDateFromLine(line: string): string | null {
    const match = line.match(/:(\d{8})/);
    return match ? match[1] : null;
  }

  /**
   * Parse ICS date string to Date object
   * Note: DTEND in ICS with VALUE=DATE is exclusive (end date is not included)
   * The UI calendar rendering logic adds +1 day to make it inclusive for display
   */
  static parseICSDate(dateStr: string): Date {
    try {
      if (dateStr.length !== 8) {
        throw new Error(`Invalid date format: ${dateStr}`);
      }
      
      const year = parseInt(dateStr.substring(0, 4));
      const month = parseInt(dateStr.substring(4, 6)) - 1;
      const day = parseInt(dateStr.substring(6, 8));
      
      if (isNaN(year) || isNaN(month) || isNaN(day)) {
        throw new Error(`Invalid date values: ${dateStr}`);
      }
      
      if (month < 0 || month > 11) {
        throw new Error(`Invalid month: ${month + 1}`);
      }
      
      if (day < 1 || day > 31) {
        throw new Error(`Invalid day: ${day}`);
      }
      
      return new Date(year, month, day);
    } catch (error) {
      console.error('❌ Error parsing ICS date:', error, 'Date string:', dateStr);
      throw error;
    }
  }

  static extractGuestName(summary: string, description: string): string | undefined {
    const patterns = [
      /(?:Reserved for|Guest:|Réservé pour|Guest)\s*([A-Za-z\s]+)/i,
      /^([A-Za-z\s]+)(?:\s*-|\s*\(|\s*–)/,
      /([A-Za-z\s]+)\s*\(/,
      /Guest:\s*([A-Za-z\s]+)/i
    ];

    for (const pattern of patterns) {
      const match = (summary + ' ' + description).match(pattern);
      if (match && match[1].trim().length > 2) {
        return match[1].trim();
      }
    }
    return undefined;
  }

  static extractNumberOfGuests(summary: string, description: string): number | undefined {
    const patterns = [
      /(\d+)\s*guests?/i,
      /(\d+)\s*invités?/i,
      /guests?:\s*(\d+)/i,
      /(\d+)\s*personnes?/i
    ];

    for (const pattern of patterns) {
      const match = (summary + ' ' + description).match(pattern);
      if (match) {
        const num = parseInt(match[1]);
        if (num > 0 && num <= 20) { // Reasonable range
          return num;
        }
      }
    }
    return undefined;
  }

  static decodeICSDescription(description: string): string {
    // Decode escaped sequences in DESCRIPTION per RFC5545
    return description
      .replace(/\\n/g, '\n')  // \\n → newline
      .replace(/\\,/g, ',')   // \\, → ,
      .replace(/\\;/g, ';')   // \\; → ;
      .replace(/\\\\/g, '\\'); // \\\\ → \ (escape backslash)
  }

  static extractAirbnbBookingId(description: string, summary: string): string | undefined {
    const searchText = (description + ' ' + summary).toUpperCase();
    
    // Patterns spécifiques pour les URLs Airbnb et codes de réservation
    const patterns = [
      // Pattern pour les URLs Airbnb: /details/HM2KBR5WFZ
      /\/details\/([A-Z0-9]{8,12})/gi,
      // Pattern pour les codes de réservation Airbnb (commencent par HM suivi de 8-10 caractères)
      /(HM[A-Z0-9]{8,10})/g,
      // Autres patterns génériques
      /BOOKING[:\s]*([A-Z0-9]{8,12})/gi,
      /CONFIRMATION[:\s]*([A-Z0-9]{8,12})/gi,
      /RESERVATION[:\s]*([A-Z0-9]{8,12})/gi,
      /REF[:\s]*([A-Z0-9]{8,12})/gi,
      /ID[:\s]*([A-Z0-9]{8,12})/gi
    ];

    for (const pattern of patterns) {
      const matches = [...searchText.matchAll(pattern)];
      for (const match of matches) {
        const code = match[1];
        if (code && code.length >= 8 && code.length <= 12 && /^[A-Z0-9]+$/.test(code)) {
          // Éviter les mots communs comme "RESERVATIO"
          if (!['RESERVATIO', 'CONFIRMATIO', 'BOOKING', 'DETAILS'].includes(code)) {
            return code;
          }
        }
      }
    }
    return undefined;
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  // Read and parse request body exactly once at the start
  let propertyId: string;
  let force: boolean = false;
  let forceProxy: boolean = false;

  try {
    const body = await req.json();
    propertyId = body.propertyId;
    force = body.force || false;
    forceProxy = body.forceProxy || false;
  } catch (parseError) {
    console.error('❌ Error parsing request body:', parseError);
    return new Response(
      JSON.stringify({ 
        success: false,
        error: 'Invalid request body',
        details: parseError instanceof Error ? parseError.message : 'Unknown parsing error'
      }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  if (!propertyId) {
    return new Response(
      JSON.stringify({ 
        success: false,
        error: 'Property ID is required'
      }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    // Vérifier les variables d'environnement
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('❌ Variables d\'environnement manquantes:', {
        hasUrl: !!supabaseUrl,
        hasServiceKey: !!supabaseServiceKey
      });
      throw new Error('Missing Supabase environment variables');
    }

    const supabaseClient = createClient(supabaseUrl, supabaseServiceKey);

    console.log(`🔄 Starting unified sync for property ${propertyId}`);

    // Get property with ICS URL
    const { data: property, error: propertyError } = await supabaseClient
      .from('properties')
      .select('id, name, airbnb_ics_url')
      .eq('id', propertyId)
      .single();

    if (propertyError || !property?.airbnb_ics_url) {
      console.log('❌ No ICS URL configured for property:', propertyId);
      return new Response(
        JSON.stringify({ 
          success: false,
          error: 'No ICS URL configured for this property',
          propertyId: propertyId
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if sync is needed (if not forced and last sync was less than 4 hours ago)
    if (!force) {
      const { data: syncStatus } = await supabaseClient
        .from('airbnb_sync_status')
        .select('last_sync_at, sync_status')
        .eq('property_id', propertyId)
        .single();

      if (syncStatus?.last_sync_at) {
        const lastSync = new Date(syncStatus.last_sync_at);
        const fourHoursAgo = new Date(Date.now() - 4 * 60 * 60 * 1000);
        
        if (lastSync > fourHoursAgo && syncStatus.sync_status === 'success') {
          console.log('⏭️ Sync skipped - last sync was recent and successful');
          return new Response(
            JSON.stringify({ 
              success: true,
              message: 'Sync not needed - last sync was recent',
              lastSyncAt: syncStatus.last_sync_at,
              skipped: true
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }
    }

    // Update sync status to "syncing"
    await supabaseClient
      .from('airbnb_sync_status')
      .upsert({
        property_id: propertyId,
        sync_status: 'syncing',
        last_error: null,
        last_sync_at: new Date().toISOString()
      });

    // Fetch and parse ICS data
    console.log(`🔄 Fetching ICS data from: ${property.airbnb_ics_url}`);
    const reservations = await UnifiedAirbnbSyncService.fetchAndParseICS(property.airbnb_ics_url, forceProxy);
    console.log(`📅 Found ${reservations.length} reservations`);

    // Store reservations in database
  const toLocalYmd = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${dd}`;
  };

  const reservationData = reservations
      .filter(r => {
        const hasBookingId = !!r.airbnbBookingId;
        if (!hasBookingId) {
          console.log(`⚠️ Skipping reservation without booking ID: ${r.summary}`);
          console.log(`   Description: ${r.description}`);
          console.log(`   Raw event: ${r.rawEvent?.substring(0, 200)}...`);
        }
        return hasBookingId;
      })
      .map(r => {
        try {
          return {
            property_id: propertyId,
            airbnb_booking_id: r.airbnbBookingId!,
            summary: r.summary,
            // ✅ IMPORTANT: utiliser la date locale (éviter les décalages UTC)
            start_date: toLocalYmd(r.startDate),
            end_date: toLocalYmd(r.endDate),
            guest_name: r.guestName,
            number_of_guests: r.numberOfGuests,
            description: r.description,
            raw_event_data: { rawEvent: r.rawEvent }
          };
        } catch (error) {
          console.error('❌ Error mapping reservation:', error, 'Reservation:', r);
          throw error;
        }
      });

    // ✅ SOLUTION : Utiliser un seul upsert en batch pour éviter les duplications
    let upsertResult: any[] = [];
    if (reservationData.length > 0) {
      console.log('🔄 Synchronisation unifiée - mise à jour des dates depuis le fichier ICS uniquement');
      
      // 1. Récupérer toutes les données validées existantes en une seule requête
      const airbnbCodes = reservationData.map(r => r.airbnb_booking_id).filter(Boolean);
      const { data: validatedBookings } = await supabaseClient
        .from('bookings')
        .select('guest_name, booking_reference')
        .eq('property_id', propertyId)
        .in('booking_reference', airbnbCodes);
      
      const { data: existingReservations } = await supabaseClient
        .from('airbnb_reservations')
        .select('airbnb_booking_id, guest_name')
        .eq('property_id', propertyId)
        .in('airbnb_booking_id', airbnbCodes);
      
      // Créer des maps pour accès rapide
      const validatedBookingsMap = new Map(
        validatedBookings?.map(b => [b.booking_reference, b.guest_name]) || []
      );
      const existingReservationsMap = new Map(
        existingReservations?.map(r => [r.airbnb_booking_id, r.guest_name]) || []
      );
      
      // 2. Préparer les données pour l'upsert en préservant les noms validés
      const reservationsToUpsert = reservationData.map(reservation => {
        // Priorité : bookings > airbnb_reservations existantes > nouveau ICS
        const validatedGuestName: string | undefined = validatedBookingsMap.get(reservation.airbnb_booking_id) 
          || existingReservationsMap.get(reservation.airbnb_booking_id);
        
        // Vérifier si le nom est valide (pas un code, pas "phone", etc.)
        const isValidGuestName = validatedGuestName && 
          typeof validatedGuestName === 'string' &&
          validatedGuestName.trim() !== '' &&
          validatedGuestName.split(' ').length >= 2 &&
          !validatedGuestName.toLowerCase().includes('phone') &&
          !validatedGuestName.match(/^[A-Z]{2,}\d+$/);
        
        // Préserver le nom validé si disponible, sinon utiliser celui du ICS
        const finalGuestName = isValidGuestName ? validatedGuestName : reservation.guest_name;
        const finalSummary = isValidGuestName 
          ? `Airbnb – ${validatedGuestName}` 
          : reservation.summary;
        
        return {
          ...reservation,
          guest_name: finalGuestName,
          summary: finalSummary,
          // ✅ IMPORTANT : Les dates proviennent uniquement du fichier ICS
          start_date: reservation.start_date,
          end_date: reservation.end_date,
          updated_at: new Date().toISOString()
        };
      });
      
      // 3. Upsert en batch avec onConflict sur (property_id, airbnb_booking_id)
      const { data: upsertedReservations, error: upsertError } = await supabaseClient
        .from('airbnb_reservations')
        .upsert(reservationsToUpsert, {
          onConflict: 'property_id,airbnb_booking_id',
          ignoreDuplicates: false
        })
        .select();
      
      if (upsertError) {
        console.error('❌ Erreur lors de l\'upsert batch:', upsertError);
        throw upsertError;
      }
      
      const preservedCount = reservationsToUpsert.filter(r => 
        validatedBookingsMap.has(r.airbnb_booking_id) || 
        existingReservationsMap.has(r.airbnb_booking_id)
      ).length;
      
      console.log(`✅ Synchronisation terminée: ${reservationsToUpsert.length} réservations, ${preservedCount} noms préservés`);
      upsertResult = upsertedReservations || [];
    } else {
      upsertResult = [];
    }

    // ✅ NOUVEAU : Créer automatiquement les tokens sécurisés pour les codes Airbnb HM…
    console.log('🔐 Génération automatique des tokens sécurisés pour les codes Airbnb...');
    let tokensCreated = 0;
    try {
      const pepper = Deno.env.get('ACCESS_CODE_PEPPER');
      if (!pepper) {
        console.warn('⚠️ ACCESS_CODE_PEPPER not configured - skipping automatic token creation');
      } else {
        // Filtrer uniquement les codes Airbnb valides (HM...)
        const airbnbCodes = reservationData
          .map(r => ({ 
            code: r.airbnb_booking_id, 
            endDate: r.end_date,
            summary: r.summary 
          }))
          .filter(item => item.code && /^HM[A-Z0-9]{8,12}$/.test(String(item.code)));

        console.log(`🎯 Found ${airbnbCodes.length} valid Airbnb codes (HM...)`);

        if (airbnbCodes.length > 0) {
          // Dédupliquer par code Airbnb
          const uniqueCodesMap = new Map();
          airbnbCodes.forEach(item => {
            const normalizedCode = String(item.code).trim().toUpperCase();
            if (!uniqueCodesMap.has(normalizedCode)) {
              uniqueCodesMap.set(normalizedCode, item);
            }
          });

          const uniqueCodes = Array.from(uniqueCodesMap.values());
          console.log(`📋 Creating tokens for ${uniqueCodes.length} unique Airbnb codes`);

          // Fonction de hashage sécurisée (identique à issue-guest-link)
          async function hashAccessCode(code: string): Promise<string> {
            const encoder = new TextEncoder();
            const data = encoder.encode(`${code}::${pepper}`);
            const digest = await crypto.subtle.digest('SHA-256', data);
            const hashArray = Array.from(new Uint8Array(digest));
            return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
          }

          // Générer un token crypto-secure
          function generateSecureToken(): string {
            const bytes = new Uint8Array(24);
            crypto.getRandomValues(bytes);
            const base64 = btoa(String.fromCharCode(...bytes)).replace(/[+/=]/g, '');
            return `${base64}${Date.now().toString(36)}`;
          }

          const nowIso = new Date().toISOString();
          const tokenRows = await Promise.all(uniqueCodes.map(async (item) => {
            const code = String(item.code).trim().toUpperCase();
            const accessCodeHash = await hashAccessCode(code);
            
            // Calculer la date d'expiration : end_date + 7 jours
            const endDate = new Date(item.endDate + 'T00:00:00Z');
            endDate.setDate(endDate.getDate() + 7);

            return {
              property_id: propertyId,
              airbnb_confirmation_code: code,
              access_code_hash: accessCodeHash,
              token: generateSecureToken(),
              is_active: true,
              created_at: nowIso,
              updated_at: nowIso,
              expires_at: endDate.toISOString(),
              metadata: { 
                source: 'sync-airbnb-unified',
                sync_date: nowIso,
                reservation_summary: item.summary,
                auto_generated: true
              }
            };
          }));

          if (tokenRows.length > 0) {
            const { data: insertedTokens, error: tokenError } = await supabaseClient
              .from('property_verification_tokens')
              .upsert(tokenRows, { onConflict: 'property_id,airbnb_confirmation_code' })
              .select('id, airbnb_confirmation_code, expires_at');

            if (tokenError) {
              console.error('❌ Failed to create automatic tokens:', tokenError);
            } else {
              tokensCreated = insertedTokens?.length || 0;
              console.log(`✅ Created/updated ${tokensCreated} automatic tokens for Airbnb codes`);
              
              // Log des tokens créés (sans exposer les codes en clair)
              insertedTokens?.forEach(token => {
                console.log(`   - Token pour code HM*** (expires: ${token.expires_at})`);
              });
            }
          }
        }
      }
    } catch (error) {
      console.error('❌ Error creating automatic tokens:', error);
      // Ne pas faire échouer la synchronisation pour cette erreur
    }

    // Update sync status to "success"
    await supabaseClient
      .from('airbnb_sync_status')
      .upsert({
        property_id: propertyId,
        sync_status: 'success',
        last_sync_at: new Date().toISOString(),
        reservations_count: reservationData.length,
        last_error: null
      });

    console.log(`✅ Unified sync completed for property ${propertyId}: ${reservationData.length} reservations`);

    return new Response(
      JSON.stringify({
        success: true,
        propertyId: propertyId,
        propertyName: property.name,
        reservations_count: reservationData.length,
        count: reservationData.length, // Add count field for compatibility
        tokens_created: tokensCreated,
        reservations: upsertResult,
        message: `Unified sync completed successfully. ${reservationData.length} reservations synced, ${tokensCreated} automatic tokens created for Airbnb codes.`
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ Unified sync error:', error);
    
    // Update sync status to "error" - safely (propertyId is available from closure)
    try {
      const supabaseUrl = Deno.env.get('SUPABASE_URL');
      const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
      
      if (supabaseUrl && supabaseServiceKey && propertyId) {
        const supabaseClient = createClient(supabaseUrl, supabaseServiceKey);
        
        await supabaseClient
          .from('airbnb_sync_status')
          .upsert({
            property_id: propertyId,
            sync_status: 'error',
            last_error: error.message || 'Unknown error',
            last_sync_at: new Date().toISOString()
          });
      }
    } catch (errorLogError) {
      console.error('❌ Error logging failed:', errorLogError);
    }

    return new Response(
      JSON.stringify({ 
        success: false,
        error: error.message || 'Unknown error occurred',
        propertyId: propertyId || 'unknown',
        details: error.stack || 'No stack trace available'
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
