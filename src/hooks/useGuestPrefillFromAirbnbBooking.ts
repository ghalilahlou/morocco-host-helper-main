import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { parseAndNormalizeStayDate, extractDateOnly } from '@/utils/dateUtils';
import type { GuestPrefillData } from './useGuestPrefillFromUrl';

/**
 * P14 — Hook fetching guest prefill data from an Airbnb booking ID.
 *
 * Calls get-airbnb-reservation with the propertyId + airbnbBookingId,
 * then extracts checkInDate/checkOutDate/guestCount/guestName.
 *
 * Only fetches when `enabled` is true (i.e., token is valid).
 * Returns null until resolved or if no reservation is found.
 */
export function useGuestPrefillFromAirbnbBooking(
  propertyId: string | undefined,
  airbnbBookingId: string | undefined,
  enabled: boolean
): { prefill: GuestPrefillData | null; loading: boolean } {
  const [prefill, setPrefill] = useState<GuestPrefillData | null>(null);
  const [loading, setLoading] = useState(false);
  const initializedRef = useRef(false);

  useEffect(() => {
    if (!enabled || !propertyId || !airbnbBookingId) return;
    if (initializedRef.current) return;
    initializedRef.current = true;

    let cancelled = false;
    setLoading(true);

    const fetchBooking = async () => {
      try {
        const { data, error } = await supabase.functions.invoke('get-airbnb-reservation', {
          body: { propertyId, bookingId: airbnbBookingId },
        });

        if (error) {
          console.warn('[useGuestPrefillFromAirbnbBooking] error:', error.message);
          return;
        }

        const reservation = data?.reservation;
        if (!reservation) return;

        const checkInDate = parseAndNormalizeStayDate(extractDateOnly(reservation.start_date));
        const checkOutDate = parseAndNormalizeStayDate(extractDateOnly(reservation.end_date));
        if (!checkInDate || !checkOutDate || checkInDate >= checkOutDate) return;

        const guestCount = Math.max(1, Math.min(10, reservation.number_of_guests || 1));

        if (!cancelled) {
          setPrefill({
            checkInDate,
            checkOutDate,
            guestCount,
            guestName: reservation.guest_name || undefined,
          });
        }
      } catch (err) {
        console.error('[useGuestPrefillFromAirbnbBooking] unexpected error:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchBooking();

    return () => {
      cancelled = true;
      initializedRef.current = false;
    };
  }, [propertyId, airbnbBookingId, enabled]);

  return { prefill, loading };
}
