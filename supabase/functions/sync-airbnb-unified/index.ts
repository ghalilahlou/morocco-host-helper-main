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
      let response;
      
      if (forceProxy) {
        const proxyUrl = `https://corsproxy.io/?${encodeURIComponent(icsUrl)}`;
        response = await fetch(proxyUrl, {
          method: 'GET',
          headers: { 'Accept': 'text/calendar, text/plain, */*' }
        });
      } else {
        try {
          response = await fetch(icsUrl, {
            method: 'GET',
            headers: { 
              'Accept': 'text/calendar, text/plain, */*',
              'User-Agent': 'Morocco-Host-Helper/1.0'
            }
          });
        } catch {
          const proxyUrl = `https://corsproxy.io/?${encodeURIComponent(icsUrl)}`;
          response = await fetch(proxyUrl, {
            method: 'GET',
            headers: { 'Accept': 'text/calendar, text/plain, */*' }
          });
        }
      }
      
      if (!response.ok) {
        throw new Error(`Failed to fetch ICS: ${response.status} ${response.statusText}`);
      }
      
      const icsContent = await response.text();
      return this.parseICSContent(icsContent);
    } catch (error) {
      throw error;
    }
  }

  static parseICSContent(icsContent: string): AirbnbReservation[] {
    const events = icsContent.split('BEGIN:VEVENT');
    const reservations: AirbnbReservation[] = [];
    
    for (let i = 1; i < events.length; i++) {
      const eventContent = 'BEGIN:VEVENT' + events[i];
      const reservation = this.parseEvent(eventContent);
      if (reservation) {
        reservations.push(reservation);
      }
    }
    
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
    } catch {
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
  } catch {
    return new Response(
      JSON.stringify({ success: false, error: 'Invalid request body' }),
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
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing Supabase environment variables');
    }

    const supabaseClient = createClient(supabaseUrl, supabaseServiceKey);

    // Get property with ICS URL
    const { data: property, error: propertyError } = await supabaseClient
      .from('properties')
      .select('id, name, airbnb_ics_url')
      .eq('id', propertyId)
      .single();

    if (propertyError || !property?.airbnb_ics_url) {
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
    const reservations = await UnifiedAirbnbSyncService.fetchAndParseICS(property.airbnb_ics_url, forceProxy);

    // Store reservations in database
  const toLocalYmd = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${dd}`;
  };

  const reservationData = reservations
      .filter(r => !!r.airbnbBookingId)
      .map(r => ({
        property_id: propertyId,
        airbnb_booking_id: r.airbnbBookingId!,
        summary: r.summary,
        start_date: toLocalYmd(r.startDate),
        end_date: toLocalYmd(r.endDate),
        guest_name: r.guestName,
        number_of_guests: r.numberOfGuests,
        description: r.description,
        raw_event_data: { rawEvent: r.rawEvent }
      }));

    // ✅ SOLUTION : Utiliser un seul upsert en batch pour éviter les duplications
    let upsertResult: any[] = [];
    if (reservationData.length > 0) {
      
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
        const validatedGuestName = (validatedBookingsMap.get(reservation.airbnb_booking_id) 
          || existingReservationsMap.get(reservation.airbnb_booking_id)) as string | undefined;
        
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
        throw upsertError;
      }
      
      upsertResult = upsertedReservations || [];
    } else {
      upsertResult = [];
    }

    // Nettoyage intelligent des anciennes réservations
    let deletedCount = 0;
    
    try {
      if (reservationData.length > 0) {
        const currentBookingIds = reservationData.map(r => r.airbnb_booking_id).filter(Boolean);
        
        if (currentBookingIds.length > 0) {
          const { data: deletedReservations } = await supabaseClient
            .from('airbnb_reservations')
            .delete()
            .eq('property_id', propertyId)
            .not('airbnb_booking_id', 'in', `(${currentBookingIds.join(',')})`)
            .select('id');

          deletedCount = deletedReservations?.length || 0;
        }
      } else {
        const { data: deletedReservations } = await supabaseClient
          .from('airbnb_reservations')
          .delete()
          .eq('property_id', propertyId)
          .select('id');
          
        deletedCount = deletedReservations?.length || 0;
      }
    } catch {
      // Ne pas faire échouer la synchronisation pour cette erreur
    }

    // Créer automatiquement les tokens sécurisés pour les codes Airbnb HM…
    let tokensCreated = 0;
    try {
      const pepper = Deno.env.get('ACCESS_CODE_PEPPER');
      if (pepper) {
        // Filtrer uniquement les codes Airbnb valides (HM...)
        const airbnbCodes = reservationData
          .map(r => ({ 
            code: r.airbnb_booking_id, 
            endDate: r.end_date,
            summary: r.summary 
          }))
          .filter(item => item.code && /^HM[A-Z0-9]{8,12}$/.test(String(item.code)));

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
            const { data: insertedTokens } = await supabaseClient
              .from('property_verification_tokens')
              .upsert(tokenRows, { onConflict: 'property_id,airbnb_confirmation_code' })
              .select('id');

            tokensCreated = insertedTokens?.length || 0;
          }
        }
      }
    } catch {
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

    return new Response(
      JSON.stringify({
        success: true,
        propertyId: propertyId,
        propertyName: property.name,
        reservations_count: reservationData.length,
        count: reservationData.length, // Add count field for compatibility
        tokens_created: tokensCreated,
        deleted_count: deletedCount, // ✅ NOUVEAU : Nombre de réservations supprimées
        reservations: upsertResult,
        message: `Unified sync completed successfully. ${reservationData.length} reservations synced, ${tokensCreated} automatic tokens created for Airbnb codes, ${deletedCount} old reservations removed.`
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    // Update sync status to "error"
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
    } catch {
      // Silently ignore error logging failures
    }

    return new Response(
      JSON.stringify({ 
        success: false,
        error: error.message || 'Unknown error occurred',
        propertyId: propertyId || 'unknown'
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
