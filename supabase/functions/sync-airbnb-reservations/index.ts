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

    // Extract user ID from JWT token
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: userError } = await supabase.auth.getUser(token)
    
    if (userError || !user) {
      console.error('❌ Invalid token:', userError)
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('✅ User authenticated:', user.id)

    // Parse request body
    const { propertyId, icsData } = await req.json()
    
    if (!propertyId || !icsData) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing propertyId or icsData' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('📥 Processing ICS data for property:', propertyId)

    // Parse ICS data
    const reservations = parseICSData(icsData)
    console.log(`📅 Found ${reservations.length} reservations in ICS data`)

    let createdCount = 0
    let updatedCount = 0
    let skippedCount = 0

    // ✅ CORRECTION : Traiter chaque réservation avec logique "find or update/create"
    for (const reservation of reservations) {
      try {
        console.log(`🔄 Processing reservation: ${reservation.summary}`)
        
        // ✅ CORRECTION : Vérifier si une réservation avec le même airbnb_booking_id existe déjà
        let existingBooking = null;
        
        if (reservation.airbnbBookingId) {
          const { data: existingBookings, error: searchError } = await supabase
            .from('bookings')
            .select('*')
            .eq('airbnb_booking_id', reservation.airbnbBookingId)
            .single();

          if (searchError && searchError.code !== 'PGRST116') { // PGRST116 = no rows found
            console.error('❌ Error searching for existing booking:', searchError)
            continue
          }

          existingBooking = existingBookings;
        }

        if (existingBooking) {
          // ✅ CORRECTION : Mettre à jour la réservation existante
          console.log(`🔄 Updating existing booking: ${existingBooking.id}`)
          
          const { error: updateError } = await supabase
            .from('bookings')
            .update({
              check_in_date: reservation.startDate.toISOString(),
              check_out_date: reservation.endDate.toISOString(),
              number_of_guests: reservation.numberOfGuests || 1,
              guest_name: reservation.guestName || 'Airbnb Guest',
              status: 'confirmed',
              updated_at: new Date().toISOString()
            })
            .eq('id', existingBooking.id)

          if (updateError) {
            console.error('❌ Error updating booking:', updateError)
            continue
          }

          updatedCount++
          console.log(`✅ Updated booking: ${existingBooking.id}`)
        } else {
          // ✅ CORRECTION : Créer une nouvelle réservation seulement si aucune n'existe
          console.log(`🆕 Creating new booking for: ${reservation.summary}`)
          
          const { data: newBooking, error: createError } = await supabase
            .from('bookings')
            .insert({
              property_id: propertyId,
              check_in_date: reservation.startDate.toISOString(),
              check_out_date: reservation.endDate.toISOString(),
              number_of_guests: reservation.numberOfGuests || 1,
              guest_name: reservation.guestName || 'Airbnb Guest',
              airbnb_booking_id: reservation.airbnbBookingId,
              status: 'confirmed',
              source: 'airbnb',
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            })
            .select()
            .single()

          if (createError) {
            console.error('❌ Error creating booking:', createError)
            continue
          }

          createdCount++
          console.log(`✅ Created booking: ${newBooking.id}`)
        }
      } catch (error) {
        console.error('❌ Error processing reservation:', error)
        skippedCount++
      }
    }

    console.log(`📊 Sync completed: ${createdCount} created, ${updatedCount} updated, ${skippedCount} skipped`)

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Airbnb reservations synced successfully',
        stats: {
          created: createdCount,
          updated: updatedCount,
          skipped: skippedCount,
          total: reservations.length
        }
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('❌ Error in sync-airbnb-reservations:', error)
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

// ✅ CORRECTION : Fonction améliorée pour parser les données ICS
function parseICSData(icsData: string): AirbnbReservation[] {
  const reservations: AirbnbReservation[] = []
  
  try {
    // Split by VEVENT blocks
    const veventBlocks = icsData.split('BEGIN:VEVENT')
    
    for (let i = 1; i < veventBlocks.length; i++) { // Skip first empty block
      const block = veventBlocks[i]
      
      // Extract basic information
      const summaryMatch = block.match(/SUMMARY:(.+)/)
      const startMatch = block.match(/DTSTART[^:]*:(.+)/)
      const endMatch = block.match(/DTEND[^:]*:(.+)/)
      const descriptionMatch = block.match(/DESCRIPTION:(.+)/)
      
      if (summaryMatch && startMatch && endMatch) {
        const summary = summaryMatch[1].trim()
        const startDate = parseICSDate(startMatch[1].trim())
        const endDate = parseICSDate(endMatch[1].trim())
        const description = descriptionMatch ? descriptionMatch[1].trim() : ''
        
        // Extract guest name from summary or description
        const guestName = extractGuestName(summary, description)
        
        // Extract number of guests
        const numberOfGuests = extractNumberOfGuests(summary, description)
        
        // Extract Airbnb booking ID
        const airbnbBookingId = extractAirbnbBookingId(summary, description)
        
        reservations.push({
          id: `airbnb-${Date.now()}-${i}`,
          summary,
          startDate,
          endDate,
          description,
          guestName,
          numberOfGuests,
          airbnbBookingId
        })
      }
    }
  } catch (error) {
    console.error('❌ Error parsing ICS data:', error)
  }
  
  return reservations
}

function parseICSDate(dateStr: string): Date {
  // Handle different ICS date formats
  if (dateStr.includes('T')) {
    // Format: 20240101T120000Z
    const year = dateStr.substring(0, 4)
    const month = dateStr.substring(4, 6)
    const day = dateStr.substring(6, 8)
    const hour = dateStr.substring(9, 11)
    const minute = dateStr.substring(11, 13)
    const second = dateStr.substring(13, 15)
    
    return new Date(`${year}-${month}-${day}T${hour}:${minute}:${second}Z`)
  } else {
    // Format: 20240101
    const year = dateStr.substring(0, 4)
    const month = dateStr.substring(4, 6)
    const day = dateStr.substring(6, 8)
    
    return new Date(`${year}-${month}-${day}`)
  }
}

function extractGuestName(summary: string, description: string): string | undefined {
  // Try to extract guest name from summary or description
  const text = `${summary} ${description}`.toLowerCase()
  
  // Look for common patterns
  const patterns = [
    /guest:\s*([^,\n]+)/i,
    /name:\s*([^,\n]+)/i,
    /booked by:\s*([^,\n]+)/i,
    /reservation by:\s*([^,\n]+)/i
  ]
  
  for (const pattern of patterns) {
    const match = text.match(pattern)
    if (match) {
      return match[1].trim()
    }
  }
  
  return undefined
}

function extractNumberOfGuests(summary: string, description: string): number | undefined {
  const text = `${summary} ${description}`.toLowerCase()
  
  // Look for guest count patterns
  const patterns = [
    /(\d+)\s*guests?/i,
    /(\d+)\s*people/i,
    /(\d+)\s*occupants?/i,
    /guests?:\s*(\d+)/i
  ]
  
  for (const pattern of patterns) {
    const match = text.match(pattern)
    if (match) {
      return parseInt(match[1])
    }
  }
  
  return undefined
}

function extractAirbnbBookingId(summary: string, description: string): string | undefined {
  const text = `${summary} ${description}`
  
  // Look for Airbnb booking ID patterns
  const patterns = [
    /airbnb[^:]*:\s*([a-zA-Z0-9]+)/i,
    /booking[^:]*:\s*([a-zA-Z0-9]+)/i,
    /reservation[^:]*:\s*([a-zA-Z0-9]+)/i
  ]
  
  for (const pattern of patterns) {
    const match = text.match(pattern)
    if (match) {
      return match[1].trim()
    }
  }
  
  return undefined
}