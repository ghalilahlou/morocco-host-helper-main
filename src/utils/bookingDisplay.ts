/**
 * Utilitaire unifié pour l'affichage des noms de réservation
 * Résout les problèmes de double logique, préfixes aléatoires et suffixes aberrants
 */

import { Booking } from '@/types/booking';
import { AirbnbReservation } from '@/services/airbnbSyncService';
import { EnrichedBooking } from '@/services/guestSubmissionService';

/**
 * Nettoie un nom de guest en supprimant les caractères indésirables
 * ✅ AMÉLIORÉ : Nettoyage plus agressif pour éliminer tous les préfixes/suffixes aberrants
 */
export const cleanGuestName = (name: string | null | undefined): string => {
  if (!name) return '';
  
  // Nettoyer les retours à la ligne et espaces multiples
  let cleaned = name.trim().replace(/\n/g, ' ').replace(/\r/g, ' ').replace(/\s+/g, ' ');
  
  // ✅ AMÉLIORÉ : Supprimer les préfixes/suffixes aberrants communs (plus agressif)
  cleaned = cleaned
    // Supprimer les préfixes au début
    .replace(/^[@#]\s*/, '') // "@ " ou "# " au début
    .replace(/^(CL|PN|ZN|JN|UN|FN|HN|KN|SN|HM|CD|QT|MB|P|ZE|JBFD)\s+/i, '') // Tous les préfixes aberrants
    .replace(/^Airbnb\s*–\s*/i, '') // "Airbnb – " au début
    .replace(/^Réservation\s+(CL|PN|ZN|JN|UN|FN|HN|KN|SN|HM|CD|QT|MB|P|ZE|JBFD)\s*/i, '') // "Réservation CL..."
    .replace(/^Réservation\s+[A-Z0-9]+\s*/i, '') // "Réservation [CODE]"
    // Supprimer les suffixes à la fin
    .replace(/\s*@\s*\d+\s*$/g, '') // "@ 0", "@ 1", "@ 2", etc. à la fin
    .replace(/\s*@\s*\d+\s*/g, '') // "@ 0" n'importe où dans le texte
    .replace(/\s*\d+\s*$/g, '') // Nombres seuls à la fin (comme "2" seul)
    .replace(/\s+Phone\s*$/i, '') // "Phone" à la fin
    .replace(/\s+@\s*Phone\s*$/i, '') // "@ Phone" à la fin
    .replace(/\s*\([^)]*\)\s*$/g, '') // Parenthèses à la fin
    .trim();
  
  return cleaned;
};

/**
 * ✅ NOUVEAU : Détecte si un nom est un code Airbnb
 * Les codes Airbnb suivent des patterns spécifiques : HM + 4-10 caractères, etc.
 */
export const isAirbnbCode = (name: string | null | undefined): boolean => {
  if (!name) return false;
  
  const trimmed = name.trim().toUpperCase();
  
  // Patterns de codes Airbnb
  const airbnbPatterns = [
    /^HM[A-Z0-9]{2,10}$/,     // HM9NJPA3, HMAXNTNAYM, Hm44j
    /^CL[A-Z0-9]{2,10}$/,     // CL...
    /^PN[A-Z0-9]{2,10}$/,     // PN...
    /^ZN[A-Z0-9]{2,10}$/,     // ZN...
    /^JN[A-Z0-9]{2,10}$/,     // JN...
    /^UN[A-Z0-9]{2,10}$/,     // UN...
    /^FN[A-Z0-9]{2,10}$/,     // FN...
    /^HN[A-Z0-9]{2,10}$/,     // HN...
    /^KN[A-Z0-9]{2,10}$/,     // KN...
    /^SN[A-Z0-9]{2,10}$/,     // SN...
    /^[A-Z]{2}[A-Z0-9]{4,8}$/, // Autres codes courts (2 lettres + 4-8 alphanum)
    /^UID:[A-Z0-9]+$/,        // UID:7F66
  ];
  
  return airbnbPatterns.some(pattern => pattern.test(trimmed));
};


/**
 * Valide si un nom de guest est réel (pas un code ou placeholder).
 * Accepte les noms à 1 mot (ex. "Mouhcine") tant qu'ils contiennent
 * au moins une voyelle et ne ressemblent pas à un code Airbnb.
 */
export const isValidGuestName = (name: string): boolean => {
  if (!name || name.length < 2) return false;

  const cleaned = cleanGuestName(name);
  if (cleaned.length < 2 || cleaned.length > 50) return false;

  const cleanedWithoutPrefixes = cleaned.replace(/^(CL|PN|ZN|JN|UN|FN|HN|KN|SN)\s+/i, '').trim();
  if (cleanedWithoutPrefixes.length < 2) return false;

  const lower = cleanedWithoutPrefixes.toLowerCase();

  if (lower === 'réservation' || lower === 'airbnb') return false;

  const forbiddenWords = ['phone', 'airbnb', 'reservation', 'guest', 'client', 'booking', 'réservation'];
  if (forbiddenWords.some(word => lower.includes(word))) return false;

  if (/^(UID|HM|CL|PN|ZN|JN|UN|FN|HN|KN|SN|CD|QT|MB|P|ZE|JBFD)[A-Z0-9\-:]+/i.test(cleanedWithoutPrefixes)) return false;

  if (cleanedWithoutPrefixes.match(/^[A-Z0-9]{4,}$/)) return false;

  const condensed = cleanedWithoutPrefixes.replace(/\s+/g, '');
  if (/^[A-Z0-9\-]{5,}$/.test(condensed) && !/[a-z]/.test(cleanedWithoutPrefixes)) return false;
  if (!/[a-z]/.test(cleanedWithoutPrefixes) && !cleanedWithoutPrefixes.includes(' ') && /^[A-Z0-9]+$/.test(condensed) && condensed.length >= 4) return false;

  const invalidPatterns = [
    /^[A-Z]{2,}\d+$/,
    /^[A-Z]{1,3}\s*Phone$/i,
    /^[A-Z]{6,}\s*Phone$/i,
    /^[A-Z]{2,}\s*Phone$/i,
    /^[A-Z]{2}\s*Réservation/i,
    /^CL\s+/i,
    /Réservation\s+[A-Z0-9]/i,
    /\s*@\s*\d+$/i,
  ];
  if (invalidPatterns.some(pattern => pattern.test(cleanedWithoutPrefixes))) return false;

  if (!/[a-zA-ZÀ-ÿ]/.test(cleanedWithoutPrefixes)) return false;

  const words = cleanedWithoutPrefixes.split(' ').filter(w => w.length > 0);
  const hasVowels = words.every(word => /[aeiouyAEIOUYÀ-ÿ]/.test(word));
  if (!hasVowels && words.length > 0) return false;

  const letterCount = cleanedWithoutPrefixes.match(/[A-Za-zÀ-ÿ]/g)?.length || 0;
  if (letterCount / cleanedWithoutPrefixes.length < 0.7) return false;

  return true;
};

/**
 * Extrait le prénom d'un nom complet
 */
export const getFirstName = (fullName: string): string => {
  const cleaned = cleanGuestName(fullName);
  const words = cleaned.split(' ').filter(w => w.length > 0);
  return words[0] || cleaned;
};

/**
 * Formate un nom pour l'affichage (prénom + nombre de guests supplémentaires)
 */
export const formatGuestDisplayName = (
  firstName: string,
  totalGuests: number = 1
): string => {
  const cleanedFirstName = getFirstName(firstName);
  
  // Capitaliser la première lettre
  const capitalized = cleanedFirstName.charAt(0).toUpperCase() + cleanedFirstName.slice(1).toLowerCase();
  
  if (totalGuests > 1) {
    return `${capitalized} +${totalGuests - 1}`;
  }
  
  return capitalized;
};

/**
 * Extrait le code de réservation d'un objet booking
 */
export const getBookingCode = (booking: Booking | AirbnbReservation): string => {
  if ('source' in booking && booking.source === 'airbnb') {
    const airbnb = booking as unknown as AirbnbReservation;
    return airbnb.airbnbBookingId || (airbnb as any).airbnb_booking_id || '';
  }
  
  const regular = booking as Booking;
  return regular.bookingReference || regular.id.substring(0, 8).toUpperCase() || '';
};

/**
 * Génère un texte d'affichage pour une réservation
 * PRIORITÉ:
 * 1. Noms réels des guests (via submissions)
 * 2. Nom du guest validé (guest_name)
 * 3. Données manuelles des guests
 * 4. Code de réservation (fallback)
 */
export const getUnifiedBookingDisplayText = (
  booking: Booking | AirbnbReservation,
  _isStart: boolean = true
): string => {
  const isAirbnb = 'source' in booking && booking.source === 'airbnb';
  const enrichedBooking = booking as EnrichedBooking;
  const airbnbReservation = isAirbnb ? (booking as unknown as AirbnbReservation) : null;
  const regularBooking = !isAirbnb ? (booking as Booking) : null;

  const PLACEHOLDER_NAMES = [
    'guest',
    'client',
    'invité',
    'invite',
    'voyageur',
    'traveler',
    'traveller',
    'réservation',
    'reservation',
    'unknown',
    'inconnu',
    'n/a',
    'na',
    'test',
  ];
  
  // PRIORITÉ 1: Vérifier les soumissions réelles (noms validés par les guests)
  if (enrichedBooking.hasRealSubmissions && 
      enrichedBooking.realGuestNames && 
      enrichedBooking.realGuestNames.length > 0) {
    const firstName = enrichedBooking.realGuestNames[0];
    const totalGuests = enrichedBooking.realGuestCount || enrichedBooking.realGuestNames.length;
    return formatGuestDisplayName(firstName, totalGuests);
  }

  // Séjour terminé / dossier complet : afficher le premier guest enregistré (table guests)
  // avant guest_name (souvent code ICS / placeholder). Même règle calendrier & cartes.
  const documentsGenerated =
    regularBooking?.documentsGenerated ??
    (booking as Booking & { documentsGenerated?: Booking['documentsGenerated'] }).documentsGenerated;
  const bookingStatus =
    regularBooking?.status ??
    (booking as Booking & { status?: Booking['status'] }).status;
  const isValidatedDone =
    bookingStatus === 'completed' ||
    (documentsGenerated?.contract === true && documentsGenerated?.policeForm === true);

  if (isValidatedDone) {
    const guestRowsEarly =
      regularBooking?.guests ??
      (enrichedBooking as EnrichedBooking & { guests?: Booking['guests'] }).guests;
    if (guestRowsEarly && guestRowsEarly.length > 0 && guestRowsEarly[0]?.fullName) {
      const cleanedFn = cleanGuestName(guestRowsEarly[0].fullName);
      const lowerFn = cleanedFn.toLowerCase();
      if (
        cleanedFn &&
        !PLACEHOLDER_NAMES.includes(lowerFn) &&
        !isAirbnbCode(cleanedFn) &&
        !/^phone/i.test(cleanedFn)
      ) {
        const firstName = getFirstName(cleanedFn);
        return formatGuestDisplayName(firstName, guestRowsEarly.length);
      }
    }
  }
  
  // PRIORITÉ 2: guest_name / guestName (booking ou Airbnb enrichi avec la même clé)
  const guestName = isAirbnb
    ? (airbnbReservation?.guestName ?? (booking as EnrichedBooking & { guest_name?: string }).guest_name)
    : regularBooking?.guest_name;

  if (guestName) {
    const cleanedGuestName = cleanGuestName(guestName);

    if (PLACEHOLDER_NAMES.includes(cleanedGuestName.toLowerCase())) {
      // Skip – fall through to next priorities
    } else if (/phone/i.test(cleanedGuestName) && cleanedGuestName.length < 28) {
      // Titres ICS parasites type "Phone number…"
    } else if (isAirbnbCode(cleanedGuestName)) {
      // C'est un code Airbnb, on ne l'affiche pas - on passe au fallback "Réservation"
      // Continue vers PRIORITÉ 4
    } else {
      // ✅ Validation moins stricte - juste vérifier qu'il y a des lettres
      const hasLetters = cleanedGuestName && /[A-Za-zÀ-ÿ]{2,}/.test(cleanedGuestName);
      const isNotOnlyCode = cleanedGuestName && !/^[A-Z0-9]{4,}$/.test(cleanedGuestName); // Pas un code (réduit à 4+)
      const isNotUID = cleanedGuestName && !cleanedGuestName.startsWith('UID:'); // Pas un UID
      
      if (hasLetters && isNotOnlyCode && isNotUID) {
        // Si c'est un nom "parfait" (2+ mots avec voyelles), utiliser formatGuestDisplayName
        if (isValidGuestName(cleanedGuestName)) {
          const firstName = getFirstName(cleanedGuestName);
          const guestLen =
            regularBooking?.guests?.length ??
            (booking as EnrichedBooking & { guests?: { fullName?: string }[] }).guests?.length ??
            1;
          const totalGuests = isAirbnb
            ? (airbnbReservation?.numberOfGuests ?? (booking as { numberOfGuests?: number }).numberOfGuests ?? guestLen)
            : guestLen;
          return formatGuestDisplayName(firstName, totalGuests);
        } else {
          // Sinon, afficher le nom nettoyé tel quel (même s'il n'a qu'un mot)
          // ✅ NOUVEAU : Capitaliser et afficher le nom même s'il ne passe pas la validation stricte
          const capitalized = cleanedGuestName.charAt(0).toUpperCase() + cleanedGuestName.slice(1).toLowerCase();
          const guestLen2 =
            regularBooking?.guests?.length ??
            (booking as EnrichedBooking & { guests?: { fullName?: string }[] }).guests?.length ??
            1;
          const totalGuests = isAirbnb
            ? (airbnbReservation?.numberOfGuests ?? (booking as { numberOfGuests?: number }).numberOfGuests ?? guestLen2)
            : guestLen2;
          
          if (totalGuests > 1) {
            return `${capitalized} +${totalGuests - 1}`;
          }
          return capitalized;
        }
      }
    }
  }
  
  // PRIORITÉ 3: guests[] (bookings manuels ou Airbnb enrichi avec les guests du booking lié)
  const guestRows =
    regularBooking?.guests ??
    (booking as EnrichedBooking & { guests?: Booking['guests'] }).guests;
  if (guestRows && guestRows.length > 0) {
    const guest = guestRows[0];
    if (guest?.fullName) {
      const cleanedFn = cleanGuestName(guest.fullName);
      const lowerFn = cleanedFn.toLowerCase();
      if (
        cleanedFn &&
        !PLACEHOLDER_NAMES.includes(lowerFn) &&
        !isAirbnbCode(cleanedFn) &&
        !/^phone/i.test(cleanedFn)
      ) {
        if (isValidGuestName(cleanedFn)) {
          return formatGuestDisplayName(getFirstName(guest.fullName), guestRows.length);
        }
        const cap =
          cleanedFn.charAt(0).toUpperCase() + cleanedFn.slice(1).toLowerCase();
        const firstWord = cap.split(/\s+/)[0] || cap;
        if (guestRows.length > 1) {
          return `${firstWord} +${guestRows.length - 1}`;
        }
        return firstWord;
      }
    }
  }
  
  // PRIORITÉ 4: Code de réservation (fallback)
  // RÈGLE : ne JAMAIS afficher un code ICS pour une réservation terminée / validée.
  if (!isValidatedDone) {
    const bookingCode = getBookingCode(booking);
    if (bookingCode && bookingCode.length > 2 && bookingCode.length < 20) {
      let cleanedCode = bookingCode
        .replace(/\s*@\s*\d+\s*/g, '')
        .replace(/^(CL|PN|ZN|JN|UN|FN|HN|KN|SN|HM|CD|QT|MB|P|ZE|JBFD|AIRBNB|RESERVATION)\s+/i, '')
        .replace(/\s+Phone\s*$/i, '')
        .replace(/^Airbnb\s*–?\s*/i, '')
        .replace(/^Réservation\s+/i, '')
        .trim();
      if (cleanedCode.length > 2) {
        return cleanedCode.length > 10 ? `${cleanedCode.substring(0, 10)}...` : cleanedCode;
      }
    }
  }
  
  return 'Réservation';
};

export type BookingDisplayTitleOptions = {
  /** Même repli que BookingCard (contract_signatures.signer_name chargé en async). */
  signerNameFallback?: string | null;
};

/**
 * Titre affiché calendrier / cartes : aligné sur BookingCard
 * (`getUnified` puis signataire si le libellé générique « Réservation »).
 */
export function getBookingDisplayTitle(
  booking: Booking | AirbnbReservation,
  options?: BookingDisplayTitleOptions
): string {
  const primary = getUnifiedBookingDisplayText(booking, true);
  if (primary !== 'Réservation') {
    return primary;
  }

  const eb = booking as EnrichedBooking;
  if (eb.realGuestNames?.length) {
    return formatGuestDisplayName(
      eb.realGuestNames[0],
      eb.realGuestCount || eb.realGuestNames.length
    );
  }

  const raw = options?.signerNameFallback?.trim();
  if (raw) {
    const low = raw.toLowerCase();
    if (
      !['guest', 'client', 'invité', 'invite', 'réservation', 'reservation', 'unknown', 'inconnu', ''].includes(low) &&
      !isAirbnbCode(raw)
    ) {
      return formatGuestDisplayName(getFirstName(raw), eb.realGuestCount || 1);
    }
  }

  return primary;
}

/**
 * Génère les initiales d'un guest pour l'avatar
 */
export const getGuestInitials = (booking: Booking | AirbnbReservation): string => {
  const isAirbnb = 'source' in booking && booking.source === 'airbnb';
  const enrichedBooking = booking as EnrichedBooking;
  
  // PRIORITÉ 1: Initiales depuis les soumissions réelles
  if (enrichedBooking.realGuestNames && enrichedBooking.realGuestNames.length > 0) {
    const name = enrichedBooking.realGuestNames[0];
    return name
      .split(' ')
      .filter(w => w.length > 0)
      .map(w => w[0])
      .join('')
      .toUpperCase()
      .slice(0, 2) || 'CL';
  }
  
  // PRIORITÉ 2: Initiales depuis guest_name
  const guestName = isAirbnb
    ? (booking as unknown as AirbnbReservation).guestName
    : (booking as Booking).guest_name;
  
  if (guestName && isValidGuestName(guestName)) {
    const cleaned = cleanGuestName(guestName);
    return cleaned
      .split(' ')
      .filter(w => w.length > 0)
      .map(w => w[0])
      .join('')
      .toUpperCase()
      .slice(0, 2) || 'CL';
  }
  
  // PRIORITÉ 3: Initiales depuis guests manuels
  if (!isAirbnb) {
    const regularBooking = booking as Booking;
    const guest = regularBooking.guests?.[0];
    if (guest?.fullName && isValidGuestName(guest.fullName)) {
      const cleaned = cleanGuestName(guest.fullName);
      return cleaned
        .split(' ')
        .filter(w => w.length > 0)
        .map(w => w[0])
        .join('')
        .toUpperCase()
        .slice(0, 2) || 'CL';
    }
  }
  
  // Fallback
  return 'CL';
};

