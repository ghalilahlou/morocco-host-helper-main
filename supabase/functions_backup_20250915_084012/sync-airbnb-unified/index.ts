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
  static async fetchAndParseICS(icsUrl: string): Promise<AirbnbReservation[]> {
    try {
      console.log(`📡 Fetching ICS data from: ${icsUrl}`);
      
      // Try direct fetch first
      let response;
      try {
        response = await fetch(icsUrl, {
          method: 'GET',
          headers: { 
            'Accept': 'text/calendar, text/plain, */*',
            'User-Agent': 'Morocco-Host-Helper/1.0'
          }
        });
      } catch (directError) {
        console.log('⚠️ Direct fetch failed, trying with CORS proxy...');
        // Fallback to CORS proxy
        const proxyUrl = `https://corsproxy.io/?${encodeURIComponent(icsUrl)}`;
        response = await fetch(proxyUrl, {
          method: 'GET',
          headers: { 'Accept': 'text/calendar, text/plain, */*' }
        });
      }
      
      if (!response.ok) {
        throw new Error(`Failed to fetch ICS: ${response.status} ${response.statusText}`);
      }
      
      const icsContent = await response.text();
      console.log(`📋 ICS Content length: ${icsContent.length} characters`);
      
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

      for (const line of lines) {
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
          // Gérer les descriptions multi-lignes (folding lines dans ICS)
          let descLine = line.substring(12);
          let nextLineIndex = lines.indexOf(line) + 1;
          
          // Continuer à lire les lignes suivantes qui sont des continuations
          while (nextLineIndex < lines.length) {
            const nextLine = lines[nextLineIndex];
            // Les lignes de continuation commencent par un espace ou une tabulation
            if (nextLine && (nextLine.startsWith(' ') || nextLine.startsWith('\t'))) {
              descLine += nextLine;
              nextLineIndex++;
            } else if (nextLine && !nextLine.includes(':') && nextLine.trim() !== '' && !nextLine.startsWith('END:VEVENT')) {
              // Ligne de continuation sans espace (format alternatif)
              descLine += nextLine;
              nextLineIndex++;
            } else {
              break;
            }
          }
          
          description = descLine;
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

    const { propertyId, force = false } = await req.json();

    if (!propertyId) {
      return new Response(
        JSON.stringify({ error: 'Property ID is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

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
        JSON.stringify({ error: 'No ICS URL configured for this property' }),
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
              message: 'Sync not needed - last sync was recent',
              lastSyncAt: syncStatus.last_sync_at
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
    const reservations = await UnifiedAirbnbSyncService.fetchAndParseICS(property.airbnb_ics_url);
    console.log(`📅 Found ${reservations.length} reservations`);

    // Store reservations in database
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
            start_date: r.startDate.toISOString().split('T')[0],
            end_date: r.endDate.toISOString().split('T')[0],
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

    let insertResult = null;
    if (reservationData.length > 0) {
      // Delete existing reservations for this property
      await supabaseClient
        .from('airbnb_reservations')
        .delete()
        .eq('property_id', propertyId);

      // Insert new reservations
      const { data, error: insertError } = await supabaseClient
        .from('airbnb_reservations')
        .insert(reservationData)
        .select();

      if (insertError) {
        throw insertError;
      }
      
      insertResult = data;
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
        reservations: insertResult,
        message: 'Unified sync completed successfully'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ Unified sync error:', error);
    
    // Update sync status to "error" - safely
    try {
      const supabaseUrl = Deno.env.get('SUPABASE_URL');
      const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
      
      if (supabaseUrl && supabaseServiceKey) {
        const supabaseClient = createClient(supabaseUrl, supabaseServiceKey);
        
        // Try to get propertyId from request body
        let propertyId = null;
        try {
          const body = await req.json();
          propertyId = body.propertyId;
        } catch (parseError) {
          console.log('⚠️ Could not parse request body for error logging');
        }
        
        if (propertyId) {
          await supabaseClient
            .from('airbnb_sync_status')
            .upsert({
              property_id: propertyId,
              sync_status: 'error',
              last_error: error.message || 'Unknown error',
              last_sync_at: new Date().toISOString()
            });
        }
      }
    } catch (errorLogError) {
      console.error('❌ Error logging failed:', errorLogError);
    }

    return new Response(
      JSON.stringify({ 
        error: error.message || 'Unknown error occurred',
        propertyId: propertyId || 'unknown',
        details: error.stack || 'No stack trace available'
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
