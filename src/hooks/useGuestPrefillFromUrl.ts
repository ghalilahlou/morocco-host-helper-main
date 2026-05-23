import { useMemo } from 'react';
import { parseAndNormalizeStayDate, extractDateOnly } from '@/utils/dateUtils';
import { sanitizeGuestName } from '@/utils/guestNameUtils';

/**
 * P14 — Hook extrayant les données de pré-remplissage depuis les paramètres URL.
 * Chemin prioritaire : URL > ICS > Airbnb.
 *
 * Retourne `null` quand les paramètres sont absents ou insuffisants (dates manquantes,
 * réservation indépendante sans dates explicites).
 */
export interface GuestPrefillData {
  checkInDate: Date;
  checkOutDate: Date;
  guestCount: number;
  guestName?: string;
  airbnbCode?: string;
}

export function useGuestPrefillFromUrl(search: string): GuestPrefillData | null {
  return useMemo(() => {
    const sp = new URLSearchParams(search);
    const startDateParam = sp.get('startDate');
    const endDateParam = sp.get('endDate');

    if (!startDateParam || !endDateParam) return null;

    const airbnbCodeParam = sp.get('airbnbCode') ?? '';
    const isIndependent =
      !airbnbCodeParam ||
      airbnbCodeParam.trim() === '' ||
      airbnbCodeParam.toUpperCase() === 'INDEPENDENT_BOOKING';

    // Réservation indépendante sans airbnbCode → non géré par ce hook (=> ICS hook)
    if (isIndependent) return null;

    const checkInDate = parseAndNormalizeStayDate(extractDateOnly(startDateParam));
    const checkOutDate = parseAndNormalizeStayDate(extractDateOnly(endDateParam));

    if (!checkInDate || !checkOutDate || checkInDate >= checkOutDate) return null;

    const guestsParam = sp.get('guests');
    const guestNameParam = sp.get('guestName');

    const guestCount = guestsParam
      ? Math.max(1, Math.min(10, parseInt(guestsParam, 10) || 1))
      : 1;

    const rawName = guestNameParam
      ? sanitizeGuestName(decodeURIComponent(guestNameParam))
      : '';

    return {
      checkInDate,
      checkOutDate,
      guestCount,
      guestName: rawName || undefined,
      airbnbCode: airbnbCodeParam || undefined,
    };
  }, [search]);
}
