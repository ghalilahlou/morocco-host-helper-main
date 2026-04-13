/**
 * Modèle calendrier : réservations manuelles vs lignes synchronisées depuis iCal (Airbnb).
 *
 * Les UID au format `UID:…@airbnb.com` sont des identifiants techniques RFC 5545 : ils servent
 * à la synchro sans doublon entre plateformes, pas comme nom d’affichage. Toute l’UI doit
 * passer par ce module (ou bookingDisplay) pour les libellés.
 */

import type { Booking } from '@/types/booking';
import type { EnrichedBooking } from '@/services/guestSubmissionService';
import type { AirbnbReservation } from '@/services/airbnbSyncService';
import { doBookingAndAirbnbMatch } from '@/utils/bookingAirbnbMatch';
import {
  ICAL_AIRBNB_DISPLAY_LABEL,
  isIcalAirbnbTechnicalUid,
  isValidGuestName,
} from '@/utils/bookingDisplay';

/**
 * Indique si la clé stockée (référence booking ou id Airbnb) est un UID iCal technique,
 * pour afficher un badge « synchro calendrier » sur la barre — ce n’est pas un code HM court.
 */
export function isIcsCalendarTechnicalKey(
  item: Booking | AirbnbReservation,
): boolean {
  if ('checkInDate' in item && (item as Booking).checkInDate != null) {
    return isIcalAirbnbTechnicalUid((item as Booking).bookingReference);
  }
  return isIcalAirbnbTechnicalUid((item as AirbnbReservation).airbnbBookingId);
}

/**
 * Affiche le badge « iCal » uniquement quand c’est utile : libellé générique d’import,
 * ou clé UID sans nom voyageur affiché (évite le badge si un vrai prénom est déjà montré).
 */
export function shouldShowIcalSyncBadge(
  item: Booking | AirbnbReservation,
  displayTitle: string,
): boolean {
  const title = displayTitle.trim();
  if (title === ICAL_AIRBNB_DISPLAY_LABEL) return true;
  if (!isIcsCalendarTechnicalKey(item)) return false;
  if (isValidGuestName(title)) return false;
  return true;
}

export interface CalendarMergeResult {
  /** Bookings enrichis + réservations Airbnb sans doublon (une ligne ICS masquée si un booking manuel matche). */
  allRows: Array<EnrichedBooking | AirbnbReservation>;
  /** IDs des lignes Airbnb non affichées (doublon fonctionnel avec un booking). */
  suppressedAirbnbIds: string[];
}

/**
 * Fusion unique utilisée par la vue calendrier : une seule barre quand ICS et booking décrivent le même séjour.
 */
export function mergeBookingsWithAirbnbForCalendar(
  bookings: EnrichedBooking[],
  airbnbReservations: AirbnbReservation[],
): CalendarMergeResult {
  const suppressedAirbnbIds: string[] = [];

  const uniqueAirbnb = airbnbReservations.filter((reservation) => {
    if (typeof reservation === 'boolean') return false;
    const hasManualMatch = bookings.some((booking) =>
      doBookingAndAirbnbMatch(booking, reservation),
    );
    if (hasManualMatch) suppressedAirbnbIds.push(reservation.id);
    return !hasManualMatch;
  });

  return {
    allRows: [...bookings, ...uniqueAirbnb],
    suppressedAirbnbIds,
  };
}
