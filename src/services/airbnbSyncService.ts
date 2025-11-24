// Legacy service for compatibility - using simplified types
import { BOOKING_COLORS } from '@/constants/bookingColors';
import { getBookingDocumentStatus } from '@/utils/bookingDocuments';
export interface AirbnbReservation {
  id: string;
  summary: string;
  startDate: Date;
  endDate: Date;
  description?: string;
  guestName?: string;
  numberOfGuests?: number;
  airbnbBookingId?: string;
  // ICS Extended Fields
  location?: string;
  status?: string;
  organizer?: string;
  attendees?: string[];
  createdAt?: Date;
  lastModified?: Date;
  categories?: string[];
  priority?: number;
  url?: string;
  contact?: string;
  customFields?: { [key: string]: string };
  rawEvent?: string;
}

export interface SyncResult {
  reservations: AirbnbReservation[];
  matchedBookings: string[]; // IDs of existing bookings that matched
  conflicts: string[]; // IDs of conflicting reservations
}

// This service is now deprecated - use AirbnbEdgeFunctionService instead
export class AirbnbSyncService {
  static async fetchAndParseICS(icsUrl: string): Promise<AirbnbReservation[]> {
    console.warn('⚠️ AirbnbSyncService.fetchAndParseICS is deprecated. Use AirbnbEdgeFunctionService instead.');
    return [];
  }

  static parseICSContent(icsContent: string): AirbnbReservation[] {
    console.warn('⚠️ AirbnbSyncService.parseICSContent is deprecated. Use AirbnbEdgeFunctionService instead.');
    return [];
  }

  static async syncWithExistingBookings(airbnbReservations: AirbnbReservation[], existingBookings: any[]): Promise<SyncResult> {
    console.warn('⚠️ AirbnbSyncService.syncWithExistingBookings is deprecated. Use AirbnbEdgeFunctionService instead.');
    return {
      reservations: airbnbReservations,
      matchedBookings: [],
      conflicts: []
    };
  }

  static getBookingStatusColor(booking: any, matchedBookings: string[], conflicts: string[]): string {
    const documents = getBookingDocumentStatus(booking);
    const isValidated = documents.isValidated;

    if (conflicts.includes(booking.id) && isValidated) {
      return BOOKING_COLORS.conflict.tailwind;
    }
    
    if (isValidated || matchedBookings.includes(booking.id)) {
      return BOOKING_COLORS.completed.tailwind;
    }
    
    return BOOKING_COLORS.default?.tailwind || BOOKING_COLORS.airbnb.tailwind;
  }

  static getAirbnbReservationColor(reservation: AirbnbReservation, matchedBookings: string[], conflicts: string[]): string {
    // Réservations Airbnb (ICS) doivent apparaître en gris tant qu'elles ne sont pas validées
    return BOOKING_COLORS.pending.tailwind;
  }
}