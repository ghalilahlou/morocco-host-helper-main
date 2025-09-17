import { supabase } from '@/integrations/supabase/client';

export interface CalendarEvent {
  id: string;
  title: string;
  start: string;
  end: string;
  allDay: boolean;
  source: 'airbnb' | 'booking';
  [key: string]: any; // Allow additional properties
}

/**
 * Fetch Airbnb calendar events for a specific property and date range
 * @param propertyId - The property ID to fetch events for
 * @param start - Start date in YYYY-MM-DD format
 * @param end - End date in YYYY-MM-DD format
 * @returns Array of calendar events
 */
export async function fetchAirbnbCalendarEvents(
  propertyId: string, 
  start: string, 
  end: string
): Promise<CalendarEvent[]> {
  try {
    // Defensive checks for date format
    if (!start || !end || !propertyId) {
      console.warn('fetchAirbnbCalendarEvents: Missing required parameters', { propertyId, start, end });
      return [];
    }

    // Validate date format (basic check)
    const startDate = new Date(start);
    const endDate = new Date(end);
    
    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      console.error('fetchAirbnbCalendarEvents: Invalid date format', { start, end });
      return [];
    }

    console.debug('📅 Fetching Airbnb calendar events', { propertyId, start, end });

    const { data, error } = await supabase
      .from('airbnb_reservations')
      .select('airbnb_booking_id, summary, guest_name, start_date, end_date')
      .eq('property_id', propertyId)
      .gte('start_date', start)
      .lte('end_date', end)
      .order('start_date', { ascending: true });

    if (error) {
      console.error('❌ Error fetching Airbnb calendar events:', error);
      return [];
    }

    console.debug('📅 Raw Airbnb data from Supabase:', data);

    // Map each row to the calendar event shape
    const events: CalendarEvent[] = (data || []).map(row => {
      // Calculate end date + 1 day for proper calendar display
      const endDate = new Date(row.end_date);
      endDate.setDate(endDate.getDate() + 1);
      
      return {
        id: row.airbnb_booking_id,
        title: row.guest_name ? `Airbnb – ${row.guest_name}` : (row.summary || 'Airbnb'),
        start: `${row.start_date}T00:00:00`,
        end: endDate.toISOString(),
        allDay: true,
        source: 'airbnb'
      };
    });

    console.debug('📅 Mapped Airbnb calendar events:', events);
    return events;

  } catch (error) {
    console.error('❌ Error in fetchAirbnbCalendarEvents:', error);
    return [];
  }
}

/**
 * Fetch all calendar events (both Airbnb and regular bookings) for a property
 * @param propertyId - The property ID to fetch events for
 * @param start - Start date in YYYY-MM-DD format
 * @param end - End date in YYYY-MM-DD format
 * @param bookings - Array of regular bookings to include
 * @returns Combined array of calendar events
 */
export async function fetchAllCalendarEvents(
  propertyId: string,
  start: string,
  end: string,
  bookings: any[] = []
): Promise<CalendarEvent[]> {
  try {
    // Fetch Airbnb events
    const airbnbEvents = await fetchAirbnbCalendarEvents(propertyId, start, end);
    
    // Map regular bookings to calendar events
    const bookingEvents: CalendarEvent[] = bookings.map(booking => ({
      id: booking.id,
      title: booking.guestName || booking.title || 'Booking',
      start: `${booking.checkInDate}T00:00:00`,
      end: `${booking.checkOutDate}T00:00:00`,
      allDay: true,
      source: 'booking'
    }));

    // Combine and return all events
    const allEvents = [...airbnbEvents, ...bookingEvents];
    console.debug('📅 All calendar events:', allEvents);
    return allEvents;

  } catch (error) {
    console.error('❌ Error in fetchAllCalendarEvents:', error);
    return [];
  }
}
