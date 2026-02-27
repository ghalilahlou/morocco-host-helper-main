import { supabase } from '@/integrations/supabase/client';
import { getUnifiedBookingDisplayText } from '@/utils/bookingDisplay';
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
// ✅ OPTIMISATION : Cache mémoire pour éviter les requêtes répétées
const airbnbEventsCache = new Map<string, { data: CalendarEvent[], timestamp: number }>();
const AIRBNB_EVENTS_CACHE_TTL = 10000; // 10 secondes

export async function fetchAirbnbCalendarEvents(
  propertyId: string, 
  start: string, 
  end: string
): Promise<CalendarEvent[]> {
  try {
    if (!start || !end || !propertyId) {
      return [];
    }

    // ✅ Vérifier le cache d'abord
    const cacheKey = `${propertyId}-${start}-${end}`;
    const cached = airbnbEventsCache.get(cacheKey);
    const now = Date.now();
    
    if (cached && (now - cached.timestamp) < AIRBNB_EVENTS_CACHE_TTL) {
      return cached.data;
    }

    let startDate: Date;
    let endDate: Date;
    try {
      startDate = parseLocalDate(start);
      endDate = parseLocalDate(end);
    } catch {
      return [];
    }

    // ✅ OPTIMISATION : Une seule requête Supabase pour airbnb_reservations
    // On n'a plus besoin de la requête bookings car on fait l'enrichissement côté CalendarView
    const { data: airbnbData, error: airbnbError } = await supabase
      .from('airbnb_reservations')
      .select('airbnb_booking_id, summary, guest_name, start_date, end_date')
      .eq('property_id', propertyId)
      .gte('start_date', start)
      .lte('end_date', end)
      .order('start_date', { ascending: true });

    if (airbnbError) {
      return [];
    }

    // Map each row to the calendar event shape
    const events: CalendarEvent[] = (airbnbData || []).map(row => {
      const startDateObj = parseLocalDate(row.start_date);
      const endDateObj = parseLocalDate(row.end_date);
      
      // +1 jour pour FullCalendar (dates exclusives)
      const endDateForCalendar = new Date(endDateObj);
      endDateForCalendar.setDate(endDateForCalendar.getDate() + 1);
      const endStr = formatLocalDate(endDateForCalendar);
      
      const tempReservation: AirbnbReservation = {
        id: row.airbnb_booking_id,
        summary: '',
        startDate: startDateObj,
        endDate: endDateObj,
        description: '',
        guestName: row.guest_name || undefined,
        numberOfGuests: undefined,
        airbnbBookingId: row.airbnb_booking_id,
        rawEvent: ''
      };
      
      const displayTitle = getUnifiedBookingDisplayText(tempReservation, true);
      const startStr = formatLocalDate(startDateObj);
      
      return {
        id: row.airbnb_booking_id,
        title: displayTitle,
        start: `${startStr}T00:00:00`,
        end: `${endStr}T00:00:00`,
        allDay: true,
        source: 'airbnb'
      };
    });

    // ✅ Mettre en cache
    airbnbEventsCache.set(cacheKey, { data: events, timestamp: now });

    return events;

  } catch {
    return [];
  }
}

// ✅ NOUVEAU : Fonction pour invalider le cache (à appeler après une synchronisation)
export function invalidateAirbnbEventsCache(propertyId?: string) {
  if (propertyId) {
    // Supprimer toutes les entrées du cache pour cette propriété
    for (const key of airbnbEventsCache.keys()) {
      if (key.startsWith(propertyId)) {
        airbnbEventsCache.delete(key);
      }
    }
  } else {
    airbnbEventsCache.clear();
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
    
    // ✅ CORRECTION : Filtrer les bookings par date range et utiliser getUnifiedBookingDisplayText
    const rangeStart = parseLocalDate(start);
    const rangeEnd = parseLocalDate(end);
    
    const bookingEvents: CalendarEvent[] = bookings
      .filter(booking => {
        // Filtrer par date range : la réservation doit chevaucher la plage demandée
        const checkIn = parseLocalDate(booking.checkInDate);
        const checkOut = parseLocalDate(booking.checkOutDate);
        
        // Une réservation est incluse si elle chevauche la plage [start, end]
        return checkIn <= rangeEnd && checkOut >= rangeStart;
      })
      .map(booking => {
        // ✅ CORRECTION : Utiliser getUnifiedBookingDisplayText pour obtenir le titre approprié
        // Cela gère automatiquement la logique de priorité (guest_name, realGuestNames, code Airbnb, etc.)
        const title = getUnifiedBookingDisplayText(booking, true);
        
        // ✅ CORRECTION : Calculer la date de fin pour FullCalendar (+1 jour car date exclusive)
        const checkOutDate = parseLocalDate(booking.checkOutDate);
        const endDateForCalendar = new Date(checkOutDate);
        endDateForCalendar.setDate(endDateForCalendar.getDate() + 1);
        const endStr = formatLocalDate(endDateForCalendar);
        
        return {
          id: booking.id,
          title: title,
          start: `${booking.checkInDate}T00:00:00`,
          end: `${endStr}T00:00:00`, // ✅ +1 jour pour FullCalendar
          allDay: true,
          source: 'booking' as const,
          booking: booking // ✅ Garder la référence complète pour le modal
        };
      });


    // Combine and return all events
    const allEvents = [...airbnbEvents, ...bookingEvents];
    return allEvents;

  } catch (error) {
    console.error('❌ Error in fetchAllCalendarEvents:', error);
    return [];
  }
}
