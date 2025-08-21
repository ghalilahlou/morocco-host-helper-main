import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface AirbnbReservation {
  id: string
  summary: string
  startDate: Date
  endDate: Date
  description?: string
  guestName?: string
  numberOfGuests?: number
  airbnbBookingId?: string
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    console.log('🚀 Edge Function: sync-airbnb-reservations started')
    
    // Initialize Supabase client first
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    
    if (!supabaseUrl || !supabaseKey) {
      console.error('❌ Missing Supabase configuration')
      return new Response(
        JSON.stringify({ success: false, error: 'Missing Supabase configuration' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabase = createClient(supabaseUrl, supabaseKey)

    // Get the authorization header
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      console.error('❌ No authorization header')
      return new Response(
        JSON.stringify({ success: false, error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Set auth token for RLS
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    
    if (authError || !user) {
      console.error('❌ Authentication failed:', authError)
      return new Response(
        JSON.stringify({ success: false, error: 'Authentication failed' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('👤 Authenticated user:', user.id)

    // Parse request body
    let propertyId: string, icsUrl: string
    try {
      const body = await req.json()
      propertyId = body.propertyId
      icsUrl = body.icsUrl
    } catch (error) {
      console.error('❌ Failed to parse request body:', error)
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid request body' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    
    if (!propertyId || !icsUrl) {
      console.error('❌ Missing propertyId or icsUrl:', { propertyId, icsUrl })
      return new Response(
        JSON.stringify({ success: false, error: 'Missing propertyId or icsUrl' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('📋 Processing sync for:', { propertyId, icsUrl })

    // Verify property ownership
    const { data: property, error: propertyError } = await supabase
      .from('properties')
      .select('id, user_id')
      .eq('id', propertyId)
      .eq('user_id', user.id)
      .single()

    if (propertyError || !property) {
      console.error('❌ Property not found or access denied:', propertyError)
      return new Response(
        JSON.stringify({ success: false, error: 'Property not found or access denied' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Update sync status to "syncing"
    const { error: syncStatusError } = await supabase
      .from('airbnb_sync_status')
      .upsert({
        property_id: propertyId,
        sync_status: 'syncing',
        last_error: null
      }, {
        onConflict: 'property_id'
      })

    if (syncStatusError) {
      console.error('❌ Failed to update sync status:', syncStatusError)
    }

    try {
      // Fetch ICS content
      console.log('📡 Fetching ICS from:', icsUrl)
      const icsResponse = await fetch(icsUrl, {
        headers: {
          'User-Agent': 'Supabase-Function/1.0',
          'Accept': 'text/calendar, text/plain, */*',
        }
      })

      if (!icsResponse.ok) {
        throw new Error(`Failed to fetch ICS: ${icsResponse.status} ${icsResponse.statusText}`)
      }

      const icsContent = await icsResponse.text()
      console.log('📄 ICS Content length:', icsContent.length)

      // Parse ICS content
      const reservations = parseICSContent(icsContent)
      console.log('📅 Parsed reservations:', reservations.length)

      // Delete existing reservations first
      console.log('🗑️ Deleting existing reservations...')
      const { error: deleteError } = await supabase
        .from('airbnb_reservations')
        .delete()
        .eq('property_id', propertyId)

      if (deleteError) {
        console.error('❌ Failed to delete existing reservations:', deleteError)
        throw deleteError
      }

      console.log('✅ Existing reservations deleted successfully')

      // Prepare and insert new reservations
      if (reservations.length > 0) {
        // Instead of aggressive deduplication, only filter out exact duplicates
        // by combining booking ID, start date, and end date
        const seenReservations = new Set<string>()
        const uniqueReservations = reservations.filter(r => {
          const uniqueKey = `${r.airbnbBookingId || 'no-id'}_${r.startDate.toISOString().split('T')[0]}_${r.endDate.toISOString().split('T')[0]}`
          if (seenReservations.has(uniqueKey)) {
            console.log('⚠️ Skipping exact duplicate reservation:', uniqueKey)
            return false
          }
          seenReservations.add(uniqueKey)
          return true
        })
        
        console.log(`📋 Filtered ${reservations.length} to ${uniqueReservations.length} unique reservations`)
        
        const reservationData = uniqueReservations.map((r, index) => {
          // Create a truly unique booking ID to avoid constraint violations
          const baseBookingId = r.airbnbBookingId || `parsed_${index}_${Date.now()}`
          const uniqueBookingId = `${baseBookingId}_${r.startDate.toISOString().split('T')[0]}`
          
          return {
            property_id: propertyId,
            airbnb_booking_id: uniqueBookingId,
            summary: r.summary,
            start_date: r.startDate.toISOString().split('T')[0],
            end_date: r.endDate.toISOString().split('T')[0],
            guest_name: r.guestName || null,
            number_of_guests: r.numberOfGuests || null,
            description: r.description || null,
            raw_event_data: {
              originalId: r.id,
              originalBookingId: r.airbnbBookingId,
              source: 'edge_function_sync',
              syncedAt: new Date().toISOString(),
              rawEvent: r.rawEvent || null
            }
          }
        })

        console.log('💾 Inserting reservations:', reservationData.length)
        console.log('📋 Sample reservation data:', reservationData[0])
        console.log('📋 All reservations being inserted:', reservationData.map(r => ({
          summary: r.summary,
          dates: `${r.start_date} to ${r.end_date}`,
          booking_id: r.airbnb_booking_id
        })))
        
        // Use upsert to handle potential conflicts gracefully
        const { error: insertError } = await supabase
          .from('airbnb_reservations')
          .upsert(reservationData, {
            onConflict: 'property_id,airbnb_booking_id'
          })

        if (insertError) {
          console.error('❌ Failed to insert reservations:', insertError)
          throw insertError
        }
        
        console.log('✅ Successfully inserted reservations')
      }

      // Update sync status to "success"
      await supabase
        .from('airbnb_sync_status')
        .upsert({
          property_id: propertyId,
          sync_status: 'success',
          last_sync_at: new Date().toISOString(),
          reservations_count: reservations.length,
          last_error: null
        }, {
          onConflict: 'property_id'
        })

      console.log('✅ Sync completed successfully')

      return new Response(
        JSON.stringify({ 
          success: true, 
          count: reservations.length,
          message: `Successfully synced ${reservations.length} reservations`
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )

    } catch (syncError) {
      console.error('❌ Sync error:', syncError)
      
      // Update sync status to "error"
      await supabase
        .from('airbnb_sync_status')
        .upsert({
          property_id: propertyId,
          sync_status: 'error',
          last_error: syncError.message
        }, {
          onConflict: 'property_id'
        })

      return new Response(
        JSON.stringify({ 
          success: false, 
          error: syncError.message 
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

  } catch (error) {
    console.error('❌ Edge function error:', error)
    return new Response(
      JSON.stringify({ success: false, error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

function parseICSContent(icsContent: string): AirbnbReservation[] {
  const reservations: AirbnbReservation[] = []
  
  // Split by VEVENT blocks
  const events = icsContent.split('BEGIN:VEVENT')
  
  for (let i = 1; i < events.length; i++) {
    const event = events[i]
    const endIndex = event.indexOf('END:VEVENT')
    if (endIndex === -1) continue
    
    const eventContent = event.substring(0, endIndex)
    const reservation = parseEvent(eventContent)
    
    if (reservation) {
      reservations.push(reservation)
    }
  }
  
  return reservations
}

function parseEvent(eventContent: string): AirbnbReservation | null {
  const lines = eventContent.split('\n').map(line => line.trim()).filter(line => line.length > 0)
  
  let summary = ''
  let startDate: Date | null = null
  let endDate: Date | null = null
  let description = ''
  let uid = ''
  
  // Store all ICS fields to look for booking codes
  const allFields: { [key: string]: string } = {}

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i].trim()
    
    // Handle line folding
    while (i + 1 < lines.length && (lines[i + 1].startsWith(' ') || lines[i + 1].startsWith('\t'))) {
      i++
      line += lines[i].substring(1)
    }

    // Extract field name and value
    const colonIndex = line.indexOf(':')
    if (colonIndex > 0) {
      const fieldName = line.substring(0, colonIndex).trim()
      const fieldValue = line.substring(colonIndex + 1).trim()
      allFields[fieldName] = fieldValue
      
      // Parse known fields
      if (line.startsWith('SUMMARY:')) {
        summary = fieldValue
      } else if (line.startsWith('DTSTART')) {
        const dateStr = extractDateFromLine(line)
        if (dateStr) startDate = parseICSDate(dateStr)
      } else if (line.startsWith('DTEND')) {
        const dateStr = extractDateFromLine(line)
        if (dateStr) endDate = parseICSDate(dateStr)
      } else if (line.startsWith('DESCRIPTION:')) {
        description = fieldValue
      } else if (line.startsWith('UID:')) {
        uid = fieldValue
      }
    }
  }

  console.log('📋 All ICS fields found:', Object.keys(allFields))
  console.log('🔍 All field values:', allFields)

  if (!summary || !startDate || !endDate) {
    return null
  }

  const guestName = extractGuestName(summary, description)
  const numberOfGuests = extractNumberOfGuests(summary, description)
  
  // Try to extract booking ID from ALL fields, not just description and UID
  const airbnbBookingId = extractAirbnbBookingIdFromAllFields(allFields, uid)

  return {
    id: uid || `${Date.now()}_${Math.random()}`,
    summary,
    startDate,
    endDate,
    description,
    guestName,
    numberOfGuests,
    airbnbBookingId,
    rawEvent: eventContent.substring(0, 500) // Store more raw content for debugging
  }
}

function extractDateFromLine(line: string): string | null {
  const match = line.match(/:(\d{8}T?\d{0,6}Z?)/)
  return match ? match[1] : null
}

function parseICSDate(dateStr: string): Date {
  if (dateStr.includes('T')) {
    // DateTime format: YYYYMMDDTHHMMSSZ
    const year = parseInt(dateStr.substring(0, 4))
    const month = parseInt(dateStr.substring(4, 6)) - 1
    const day = parseInt(dateStr.substring(6, 8))
    const hour = parseInt(dateStr.substring(9, 11)) || 0
    const minute = parseInt(dateStr.substring(11, 13)) || 0
    const second = parseInt(dateStr.substring(13, 15)) || 0
    
    return new Date(Date.UTC(year, month, day, hour, minute, second))
  } else {
    // Date only format: YYYYMMDD
    const year = parseInt(dateStr.substring(0, 4))
    const month = parseInt(dateStr.substring(4, 6)) - 1
    const day = parseInt(dateStr.substring(6, 8))
    
    return new Date(year, month, day)
  }
}

function extractGuestName(summary: string, description: string): string | undefined {
  // Try to extract guest name from summary or description
  const patterns = [
    /Reserved for (.+)/i,
    /Guest: (.+)/i,
    /Name: (.+)/i,
  ]
  
  for (const pattern of patterns) {
    const match = summary.match(pattern) || description.match(pattern)
    if (match) {
      return match[1].trim()
    }
  }
  
  return undefined
}

function extractNumberOfGuests(summary: string, description: string): number | undefined {
  const patterns = [
    /(\d+) guest/i,
    /guests?: (\d+)/i,
  ]
  
  for (const pattern of patterns) {
    const match = summary.match(pattern) || description.match(pattern)
    if (match) {
      return parseInt(match[1])
    }
  }
  
  return undefined
}

function extractAirbnbBookingId(description: string, uid: string, summary: string = ''): string | undefined {
  console.log('🔍 Extracting booking ID from:', { 
    description: description.substring(0, 200) + '...',
    descriptionFull: description,
    summary,
    uid 
  });
  
  // Strategy 1: Extract from Airbnb URLs (most reliable for ICS files)
  const urlPatterns = [
    /airbnb\.com\/hosting\/reservations\/[^\/]+\/([A-Z0-9]{8,15})/i,
    /airbnb\.com\/.*\/([A-Z0-9]{8,15})/i,
    /\/([A-Z0-9]{8,15})(?:\/|$|\s)/i // Generic URL ending pattern
  ];
  
  for (const pattern of urlPatterns) {
    const match = description.match(pattern);
    if (match && match[1] && match[1].length >= 8) {
      const bookingId = match[1].toUpperCase();
      console.log('✅ Found booking ID from URL:', bookingId);
      return bookingId;
    }
  }
  
  // Strategy 2: Look for standalone booking codes in description
  const codePatterns = [
    /(?:booking|reservation|confirmation|ref|reference|id|code)[\s\-_#:]*([A-Z0-9]{8,15})/i,
    /\b([A-Z0-9]{8,15})\b/g // Standalone alphanumeric codes
  ];
  
  for (const pattern of codePatterns) {
    const matches = description.match(pattern);
    if (matches) {
      if (pattern.global) {
        // For global patterns, filter for likely booking IDs
        const candidates = matches.filter(match => {
          const clean = match.trim().toUpperCase();
          return clean.length >= 8 && 
                 clean.length <= 15 && 
                 /^[A-Z0-9]+$/.test(clean) &&
                 clean !== 'URL' &&
                 clean !== 'HTTP' &&
                 clean !== 'HTTPS' &&
                 clean !== 'WWW' &&
                 clean !== 'COM' &&
                 // Exclude dates
                 !/^\d{8}$/.test(clean) &&
                 // Exclude times
                 !/^\d{6}$/.test(clean) &&
                 // Exclude years
                 !/^20\d{2}$/.test(clean);
        });
        
        if (candidates.length > 0) {
          console.log('✅ Found booking ID candidates (global):', candidates);
          const bookingId = candidates[0].trim().toUpperCase();
          console.log('✅ Selected booking ID:', bookingId);
          return bookingId;
        }
      } else if (matches[1]) {
        const bookingId = matches[1].trim().toUpperCase();
        if (bookingId.length >= 8 && bookingId !== 'URL') {
          console.log('✅ Found booking ID (pattern):', bookingId);
          return bookingId;
        }
      }
    }
  }
  
  // Strategy 3: Check summary field for booking codes
  if (summary && summary !== 'Reserved') {
    const summaryMatches = summary.match(/\b([A-Z0-9]{8,15})\b/g);
    if (summaryMatches) {
      const candidates = summaryMatches.filter(match => {
        const clean = match.trim().toUpperCase();
        return clean.length >= 8 && 
               clean.length <= 15 && 
               /^[A-Z0-9]+$/.test(clean) &&
               !/^\d{8}$/.test(clean) &&
               !/^\d{6}$/.test(clean);
      });
      
      if (candidates.length > 0) {
        console.log('✅ Found booking ID in summary:', candidates[0]);
        return candidates[0].trim().toUpperCase();
      }
    }
  }
  
  // Strategy 4: Generate a meaningful fallback ID based on UID
  if (uid) {
    // Extract meaningful parts from UID that might contain booking info
    const uidParts = uid.split(/[@\-_.]/).filter(part => part.length > 0);
    for (const part of uidParts) {
      const match = part.match(/([A-Z0-9]{8,15})/i);
      if (match) {
        const bookingId = match[1].toUpperCase();
        console.log('✅ Found booking ID in UID part:', bookingId);
        return bookingId;
      }
    }
    
    // Final fallback: create a deterministic ID from UID
    const cleanUid = uid.replace(/[^A-Za-z0-9]/g, '').substring(0, 12).toUpperCase();
    if (cleanUid.length >= 8) {
      console.log('⚠️ Using cleaned UID fallback:', cleanUid);
      return cleanUid;
    }
  }
  
  console.log('❌ No booking ID found, will use generated fallback');
  return undefined;
}

function extractAirbnbBookingIdFromAllFields(allFields: { [key: string]: string }, uid: string): string | undefined {
  console.log('🔍 Searching ALL ICS fields for Airbnb booking codes...');
  
  // Priority 1: Look for booking codes in Airbnb reservation URLs
  for (const [fieldName, fieldValue] of Object.entries(allFields)) {
    console.log(`🔍 Checking field ${fieldName}:`, fieldValue);
    
    // Clean up the field value - remove line breaks and extra spaces that might split URLs
    const cleanValue = fieldValue.replace(/\s+/g, ' ').replace(/\n/g, ' ').trim();
    console.log(`🧹 Cleaned value:`, cleanValue);
    
    // Look specifically for Airbnb reservation URLs with booking codes
    const airbnbUrlMatches = cleanValue.match(/airbnb\.com\/hosting\/reservations\/details\/([A-Z0-9]{8,12})/i);
    if (airbnbUrlMatches && airbnbUrlMatches[1]) {
      const bookingCode = airbnbUrlMatches[1].toUpperCase();
      console.log(`✅ Found Airbnb booking code in URL (${fieldName}):`, bookingCode);
      return bookingCode;
    }
    
    // Also look for the pattern without "details/"
    const simpleUrlMatches = cleanValue.match(/airbnb\.com\/hosting\/reservations\/([A-Z0-9]{8,12})/i);
    if (simpleUrlMatches && simpleUrlMatches[1]) {
      const bookingCode = simpleUrlMatches[1].toUpperCase();
      console.log(`✅ Found Airbnb booking code in simple URL (${fieldName}):`, bookingCode);
      return bookingCode;
    }
  }
  
  // Priority 2: Look for standalone booking codes in any field
  for (const [fieldName, fieldValue] of Object.entries(allFields)) {
    // Look for 8-12 character alphanumeric codes that match Airbnb pattern
    const matches = fieldValue.match(/\b([A-Z0-9]{8,12})\b/gi);
    if (matches) {
      const candidates = matches.filter(match => {
        const clean = match.trim().toUpperCase();
        return clean.length >= 8 && 
               clean.length <= 12 && 
               /^[A-Z0-9]+$/.test(clean) &&
               clean !== 'URL' &&
               clean !== 'HTTP' &&
               clean !== 'HTTPS' &&
               clean !== 'WWW' &&
               clean !== 'COM' &&
               clean !== 'AIRBNB' &&
               clean !== 'RESERVED' &&
               clean !== 'AVAILABLE' &&
               // Exclude dates
               !/^\d{8}$/.test(clean) &&
               // Exclude times  
               !/^\d{6}$/.test(clean) &&
               // Exclude years
               !/^20\d{2}$/.test(clean) &&
               // Must have some letters (not all numbers)
               /[A-Z]/.test(clean);
      });
      
      if (candidates.length > 0) {
        console.log(`✅ Found potential booking ID in ${fieldName}:`, candidates);
        return candidates[0].trim().toUpperCase();
      }
    }
  }
  
  // Fallback to original function
  return extractAirbnbBookingId(allFields.DESCRIPTION || '', uid, allFields.SUMMARY || '');
}