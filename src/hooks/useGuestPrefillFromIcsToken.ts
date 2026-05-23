import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { parseAndNormalizeStayDate, extractDateOnly } from '@/utils/dateUtils';
import type { GuestPrefillData } from './useGuestPrefillFromUrl';

/**
 * P14 — Hook fetching guest prefill data from an ICS direct link token.
 *
 * Calls issue-guest-link/resolve to get the token metadata, then extracts
 * checkInDate/checkOutDate/guestCount/guestName from reservationData.
 *
 * Returns null until the fetch completes or if the token is not an ICS direct link.
 */
export function useGuestPrefillFromIcsToken(
  token: string | undefined,
  propertyId: string | undefined
): { prefill: GuestPrefillData | null; loading: boolean } {
  const [prefill, setPrefill] = useState<GuestPrefillData | null>(null);
  const [loading, setLoading] = useState(false);
  const initializedRef = useRef(false);

  useEffect(() => {
    if (!token || !propertyId) return;
    if (initializedRef.current) return;
    initializedRef.current = true;

    let cancelled = false;
    setLoading(true);

    const fetchIcsData = async () => {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 5000);

        let data: any;
        try {
          const res = await supabase.functions.invoke('issue-guest-link', {
            body: { action: 'resolve', propertyId, token },
          });
          clearTimeout(timeout);
          if (res.error) {
            console.warn('[useGuestPrefillFromIcsToken] resolve error:', res.error.message);
            return;
          }
          data = res.data;
        } catch (err: any) {
          clearTimeout(timeout);
          if (err.name === 'AbortError') {
            console.warn('[useGuestPrefillFromIcsToken] timeout');
          }
          return;
        }

        if (!data?.success || data?.metadata?.linkType !== 'ics_direct') return;

        const rd = data.metadata?.reservationData;
        if (!rd) return;

        const rawAc = rd.airbnbCode;
        const isIndependent =
          rawAc == null ||
          String(rawAc).trim() === '' ||
          String(rawAc).toUpperCase() === 'INDEPENDENT_BOOKING';
        if (isIndependent) return;

        const checkInDate = parseAndNormalizeStayDate(extractDateOnly(rd.startDate));
        const checkOutDate = parseAndNormalizeStayDate(extractDateOnly(rd.endDate));
        if (!checkInDate || !checkOutDate || checkInDate >= checkOutDate) return;

        const guestCount = Math.max(1, Math.min(10, rd.numberOfGuests || 1));

        if (!cancelled) {
          setPrefill({
            checkInDate,
            checkOutDate,
            guestCount,
            guestName: rd.guestName || undefined,
            airbnbCode: String(rawAc),
          });
        }
      } catch (err) {
        console.error('[useGuestPrefillFromIcsToken] unexpected error:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchIcsData();

    return () => {
      cancelled = true;
      initializedRef.current = false;
    };
  }, [token, propertyId]);

  return { prefill, loading };
}
