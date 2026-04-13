import { Booking } from '@/types/booking';
import { AirbnbReservation } from '@/services/airbnbSyncService';
import { isAirbnbCode } from '@/utils/bookingDisplay';

function toLocalMidnight(d: Date | string): Date {
  if (typeof d === 'string') {
    const match = d.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (match) {
      return new Date(parseInt(match[1]), parseInt(match[2]) - 1, parseInt(match[3]));
    }
    const date = new Date(d);
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
  }
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/**
 * Determines whether a manual booking and an Airbnb reservation represent
 * the same stay.  The match is true when **either** condition holds:
 *   1. Check-in and check-out dates are identical (local midnight).
 *   2. One reference string contains the other (bidirectional `includes`).
 */
export function isMatchingReservation(
  manualCheckIn: Date | string,
  manualCheckOut: Date | string,
  manualRef: string | undefined | null,
  airbnbStart: Date | string,
  airbnbEnd: Date | string,
  airbnbId: string | undefined | null,
): boolean {
  const mStart = toLocalMidnight(manualCheckIn);
  const mEnd = toLocalMidnight(manualCheckOut);
  const aStart = toLocalMidnight(airbnbStart);
  const aEnd = toLocalMidnight(airbnbEnd);

  const datesMatch =
    mStart.getTime() === aStart.getTime() &&
    mEnd.getTime() === aEnd.getTime();

  const refsMatch = !!(
    manualRef &&
    airbnbId &&
    (manualRef.includes(airbnbId) || airbnbId.includes(manualRef))
  );

  return datesMatch || refsMatch;
}

/**
 * Refs utilisées pour rapprocher un booking manuel d’une ligne ICS Airbnb.
 * Le flux invité (lien ICS) met souvent le code HM… dans `guest_name` alors que
 * `bookingReference` reste INDEPENDENT_BOOKING ou vide — sans cela, doublon calendrier + libellé code.
 */
function bookingRefCandidatesForAirbnbMatch(booking: Booking): string[] {
  const out: string[] = [];
  const br = booking.bookingReference?.trim();
  if (br && br !== 'INDEPENDENT_BOOKING') {
    out.push(br);
  }
  const gn = booking.guest_name?.trim();
  if (gn && isAirbnbCode(gn) && !out.includes(gn)) {
    out.push(gn);
  }
  return out;
}

/**
 * Convenience wrapper that accepts full Booking / AirbnbReservation objects.
 */
export function doBookingAndAirbnbMatch(
  booking: Booking,
  reservation: AirbnbReservation,
): boolean {
  const refs = bookingRefCandidatesForAirbnbMatch(booking);
  if (refs.length === 0) {
    return isMatchingReservation(
      booking.checkInDate,
      booking.checkOutDate,
      null,
      reservation.startDate,
      reservation.endDate,
      reservation.airbnbBookingId,
    );
  }
  return refs.some((manualRef) =>
    isMatchingReservation(
      booking.checkInDate,
      booking.checkOutDate,
      manualRef,
      reservation.startDate,
      reservation.endDate,
      reservation.airbnbBookingId,
    ),
  );
}

/**
 * Same-reservation check used inside conflict detection.
 * Uses bidirectional `includes` (consistent with all other matching).
 */
export function isSameReservationByRef(
  ref1: string | undefined | null,
  ref2: string | undefined | null,
): boolean {
  if (!ref1 || !ref2) return false;
  if (ref1 === 'INDEPENDENT_BOOKING' || ref2 === 'INDEPENDENT_BOOKING') return false;
  return ref1 === ref2 || ref1.includes(ref2) || ref2.includes(ref1);
}
