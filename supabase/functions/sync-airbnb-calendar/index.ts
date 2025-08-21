import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

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

class AirbnbSyncService {
  static async fetchAndParseICS(icsUrl: string): Promise<AirbnbReservation[]> {
    try {
      console.log(`📡 Fetching ICS data from: ${icsUrl}`);
      
      const proxyUrl = `https://corsproxy.io/?${encodeURIComponent(icsUrl)}`;
      const response = await fetch(proxyUrl, {
        method: 'GET',
        headers: { 'Accept': 'text/calendar, text/plain, */*' }
      });
      
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
          description = line.substring(12);
        }
      }

      if (!startDate || !endDate) {
        console.log('⚠️ Event missing dates:', { uid, summary });
        return null;
      }

      // Extract additional info
      guestName = this.extractGuestName(summary, description);
      numberOfGuests = this.extractNumberOfGuests(summary, description);
      airbnbBookingId = this.extractAirbnbBookingId(description);

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
    const year = parseInt(dateStr.substring(0, 4));
    const month = parseInt(dateStr.substring(4, 6)) - 1;
    const day = parseInt(dateStr.substring(6, 8));
    return new Date(year, month, day);
  }

  static extractGuestName(summary: string, description: string): string | undefined {
    const patterns = [
      /(?:Reserved for|Guest:|Réservé pour)\s*([A-Za-z\s]+)/i,
      /^([A-Za-z\s]+)(?:\s*-|\s*\()/
    ];

    for (const pattern of patterns) {
      const match = (summary + ' ' + description).match(pattern);
      if (match) {
        return match[1].trim();
      }
    }
    return undefined;
  }

  static extractNumberOfGuests(summary: string, description: string): number | undefined {
    const patterns = [
      /(\d+)\s*guests?/i,
      /(\d+)\s*invités?/i,
      /guests?:\s*(\d+)/i
    ];

    for (const pattern of patterns) {
      const match = (summary + ' ' + description).match(pattern);
      if (match) {
        return parseInt(match[1]);
      }
    }
    return undefined;
  }

  static extractAirbnbBookingId(description: string): string | undefined {
    if (!description) return undefined;
    
    const patterns = [
      /([A-Z0-9]{10})/g,
      /booking[:\s]*([A-Z0-9]{8,12})/gi,
      /confirmation[:\s]*([A-Z0-9]{8,12})/gi,
      /reservation[:\s]*([A-Z0-9]{8,12})/gi,
    ];

    for (const pattern of patterns) {
      const matches = [...description.matchAll(pattern)];
      for (const match of matches) {
        const code = match[1];
        if (code && code.length === 10 && /^[A-Z0-9]+$/.test(code)) {
          return code;
        }
      }
    }
    return undefined;
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { propertyId, force = false } = await req.json()

    if (!propertyId) {
      return new Response(
        JSON.stringify({ error: 'Property ID is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`🔄 Starting sync for property ${propertyId}`)

    // Get property with ICS URL
    const { data: property, error: propertyError } = await supabaseClient
      .from('properties')
      .select('airbnb_ics_url')
      .eq('id', propertyId)
      .single()

    if (propertyError || !property?.airbnb_ics_url) {
      console.log('❌ No ICS URL configured for property:', propertyId)
      return new Response(
        JSON.stringify({ error: 'No ICS URL configured for this property' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Check if sync is needed (if not forced and last sync was less than 6 hours ago)
    if (!force) {
      const { data: syncStatus } = await supabaseClient
        .from('airbnb_sync_status')
        .select('last_sync_at')
        .eq('property_id', propertyId)
        .single()

      if (syncStatus?.last_sync_at) {
        const lastSync = new Date(syncStatus.last_sync_at)
        const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1000)
        
        if (lastSync > sixHoursAgo) {
          console.log('⏭️ Sync skipped - last sync was less than 6 hours ago')
          return new Response(
            JSON.stringify({ message: 'Sync not needed - last sync was recent' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }
      }
    }

    // Update sync status to "syncing"
    await supabaseClient
      .from('airbnb_sync_status')
      .upsert({
        property_id: propertyId,
        sync_status: 'syncing',
        last_error: null
      })

    // Fetch and parse ICS data
    const reservations = await AirbnbSyncService.fetchAndParseICS(property.airbnb_ics_url)
    console.log(`📅 Found ${reservations.length} reservations`)

    // Store reservations in database
    const reservationData = reservations
      .filter(r => r.airbnbBookingId) // Only store reservations with booking IDs
      .map(r => ({
        property_id: propertyId,
        airbnb_booking_id: r.airbnbBookingId!,
        summary: r.summary,
        start_date: r.startDate.toISOString().split('T')[0],
        end_date: r.endDate.toISOString().split('T')[0],
        guest_name: r.guestName,
        number_of_guests: r.numberOfGuests,
        description: r.description,
        raw_event_data: { rawEvent: r.rawEvent }
      }))

    if (reservationData.length > 0) {
      // Delete existing reservations for this property
      await supabaseClient
        .from('airbnb_reservations')
        .delete()
        .eq('property_id', propertyId)

      // Insert new reservations
      const { error: insertError } = await supabaseClient
        .from('airbnb_reservations')
        .insert(reservationData)

      if (insertError) {
        throw insertError
      }
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
      })

    console.log(`✅ Sync completed for property ${propertyId}: ${reservationData.length} reservations`)

    return new Response(
      JSON.stringify({
        success: true,
        reservations_count: reservationData.length,
        message: 'Sync completed successfully'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('❌ Sync error:', error)
    
    // Update sync status to "error"
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )
    
    const { propertyId } = await req.json().catch(() => ({}))
    if (propertyId) {
      await supabaseClient
        .from('airbnb_sync_status')
        .upsert({
          property_id: propertyId,
          sync_status: 'error',
          last_error: error.message
        })
    }

    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})