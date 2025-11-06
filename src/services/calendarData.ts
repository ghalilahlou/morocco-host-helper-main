import { supabase } from '@/integrations/supabase/client';
import { getUnifiedBookingDisplayText, isValidGuestName } from '@/utils/bookingDisplay';
import { AirbnbReservation } from '@/services/airbnbSyncService';
import { parseLocalDate, formatLocalDate } from '@/utils/dateUtils';

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

    // Fetching Airbnb calendar events

    // ✅ CORRIGÉ : Récupérer les données validées de la table bookings pour enrichir les réservations
    const { data: bookingsData, error: bookingsError } = await supabase
      .from('bookings')
      .select('id, booking_reference, guest_name, check_in_date, check_out_date, status, guest_email')
      .eq('property_id', propertyId)
      .gte('check_in_date', start)
      .lte('check_out_date', end)
      .order('check_in_date', { ascending: true });

    if (bookingsError) {
      console.error('❌ Error fetching bookings:', bookingsError);
      // Ne pas retourner vide, continuer avec airbnb_reservations seulement
    }

    // ✅ CORRIGÉ : Récupérer les données Airbnb et les enrichir avec les données de bookings
    const { data: airbnbData, error: airbnbError } = await supabase
      .from('airbnb_reservations')
      .select('airbnb_booking_id, summary, guest_name, start_date, end_date')
      .eq('property_id', propertyId)
      .gte('start_date', start)
      .lte('end_date', end)
      .order('start_date', { ascending: true });

    if (airbnbError) {
      console.error('❌ Error fetching Airbnb reservations:', airbnbError);
      return [];
    }

    // ✅ CORRIGÉ : Enrichir les réservations Airbnb avec les données validées de bookings
    // Match par dates ou booking_reference
    const data = (airbnbData || []).map(ar => {
      // Chercher une réservation correspondante dans bookings
      const matchingBooking = bookingsData?.find((b: any) => {
        // ✅ CORRIGÉ : Utiliser parseLocalDate pour éviter le décalage timezone
        const bookingStart = parseLocalDate(b.check_in_date);
        const bookingEnd = parseLocalDate(b.check_out_date);
        const airbnbStart = parseLocalDate(ar.start_date);
        const airbnbEnd = parseLocalDate(ar.end_date);
        
        // Match par dates exactes
        const datesMatch = bookingStart.getTime() === airbnbStart.getTime() && 
                          bookingEnd.getTime() === airbnbEnd.getTime();
        
        // Match par booking_reference contenant airbnb_booking_id
        const refMatch = b.booking_reference && ar.airbnb_booking_id && 
                        (b.booking_reference.includes(ar.airbnb_booking_id) || 
                         ar.airbnb_booking_id.includes(b.booking_reference));
        
        return datesMatch || refMatch;
      });
      
      // ✅ CORRIGÉ : Utiliser isValidGuestName importé de bookingDisplay
      // Utiliser le guest_name de bookings s'il est valide, sinon celui d'airbnb_reservations
      let finalGuestName = ar.guest_name;
      if (matchingBooking && (matchingBooking as any).guest_name && isValidGuestName((matchingBooking as any).guest_name)) {
        finalGuestName = (matchingBooking as any).guest_name;
      } else if (ar.guest_name && isValidGuestName(ar.guest_name)) {
        finalGuestName = ar.guest_name;
      }
      
      return {
        airbnb_booking_id: ar.airbnb_booking_id,
        guest_name: finalGuestName,
        start_date: ar.start_date,
        end_date: ar.end_date,
        is_validated: !!(matchingBooking && (matchingBooking as any).guest_name && isValidGuestName((matchingBooking as any).guest_name))
      };
    });

    // Pas d'erreur à vérifier ici car on a déjà vérifié bookingsError et airbnbError

    // Map each row to the calendar event shape
    const events: CalendarEvent[] = (data || []).map(row => {
      // ✅ CORRIGÉ : Utiliser parseLocalDate pour éviter le décalage timezone lors de la conversion
      const startDateObj = parseLocalDate(row.start_date);
      const endDateObj = parseLocalDate(row.end_date);
      
      // Calculate end date + 1 day BUT keep local midnight to avoid timezone shifts
      // ⚠️ IMPORTANT : On ajoute +1 jour pour FullCalendar (qui utilise des dates exclusives)
      const endDateForCalendar = new Date(endDateObj);
      endDateForCalendar.setDate(endDateForCalendar.getDate() + 1);
      const yyyy = endDateForCalendar.getFullYear();
      const mm = String(endDateForCalendar.getMonth() + 1).padStart(2, '0');
      const dd = String(endDateForCalendar.getDate()).padStart(2, '0');
      const endStr = `${yyyy}-${mm}-${dd}`;
      
      // ✅ CORRIGÉ : Utilise la logique unifiée getUnifiedBookingDisplayText() pour éviter les doubles logiques
      // Créer un objet temporaire AirbnbReservation pour utiliser la fonction unifiée
      const tempReservation: AirbnbReservation = {
        id: row.airbnb_booking_id,
        summary: '',
        startDate: startDateObj, // ✅ CORRIGÉ : Utiliser parseLocalDate
        endDate: endDateObj, // ✅ CORRIGÉ : Utiliser parseLocalDate
        description: '',
        guestName: row.guest_name || undefined,
        numberOfGuests: undefined,
        airbnbBookingId: row.airbnb_booking_id,
        rawEvent: ''
      };
      
      // Utiliser la fonction unifiée qui gère déjà toute la logique de nettoyage et de formatage
      const displayTitle = getUnifiedBookingDisplayText(tempReservation, true);
      
      // ✅ CORRIGÉ : Utiliser les dates parsées en heure locale pour éviter le décalage
      const startStr = formatLocalDate(startDateObj);
      
      return {
        id: row.airbnb_booking_id,
        title: displayTitle,
        start: `${startStr}T00:00:00`, // ✅ CORRIGÉ : Utiliser date parsée en heure locale
        // Use local-midnight string to avoid off-by-one due to toISOString (UTC)
        end: `${endStr}T00:00:00`,
        allDay: true,
        source: 'airbnb'
      };
    });

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
    return allEvents;

  } catch (error) {
    console.error('❌ Error in fetchAllCalendarEvents:', error);
    return [];
  }
}
