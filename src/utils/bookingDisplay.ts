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
 * Valide si un nom de guest est réel (pas un code ou placeholder)
 * ✅ AMÉLIORÉ : Validation plus stricte pour éviter les blocages
 */
export const isValidGuestName = (name: string): boolean => {
  if (!name || name.length < 2) return false;
  
  const cleaned = cleanGuestName(name);
  
  // Doit avoir au moins 2 caractères après nettoyage
  if (cleaned.length < 2) return false;
  
  // ✅ AMÉLIORÉ : Supprimer aussi les préfixes comme "CL" au début
  const cleanedWithoutPrefixes = cleaned.replace(/^(CL|PN|ZN|JN|UN|FN|HN|KN|SN)\s+/i, '').trim();
  
  // Doit contenir au moins 2 mots (prénom + nom) après nettoyage
  const words = cleanedWithoutPrefixes.split(' ').filter(w => w.length > 0);
  if (words.length < 2) return false;
  
  // Ne doit pas contenir de mots interdits
  const lowerName = cleanedWithoutPrefixes.toLowerCase();
  const forbiddenWords = ['phone', 'airbnb', 'reservation', 'guest', 'client', 'booking', 'réservation'];
  if (forbiddenWords.some(word => lowerName.includes(word))) return false;
  
  // Ne doit pas être un code (que des lettres majuscules + chiffres)
  if (cleanedWithoutPrefixes.match(/^[A-Z0-9]{4,}$/)) return false;
  
  // ✅ AMÉLIORÉ : Patterns plus stricts pour éviter les codes
  const invalidPatterns = [
    /^[A-Z]{2,}\d+$/, // Codes comme "JBFD123", "HMCDQTMBP2"
    /^[A-Z]{1,3}\s*Phone$/i, // "J Phone", "M Phone"
    /^[A-Z]{6,}\s*Phone$/i, // "HMEZAZYYJB Phone"
    /^[A-Z]{2,}\s*Phone$/i, // "PN Phone", "ZE Phone"
    /^[A-Z]{2}\s*Réservation/i, // "PN Réservation", "CL Réservation"
    /^CL\s+/i, // "CL " au début
    /Réservation\s+[A-Z0-9]/i, // "Réservation HMCDQTMBP2"
    /\s*@\s*\d+$/i, // "@ 0", "@ 2" à la fin (devrait être nettoyé mais on vérifie)
  ];
  
  if (invalidPatterns.some(pattern => pattern.test(cleanedWithoutPrefixes))) return false;
  
  // ✅ AMÉLIORÉ : Vérifier que chaque mot contient au moins une voyelle (vrai nom)
  const hasVowels = words.every(word => /[aeiouyAEIOUYÀ-ÿ]/.test(word));
  if (!hasVowels && words.length > 0) return false;
  
  // Doit contenir principalement des lettres (avec accents) - minimum 70%
  const letterRatio = cleanedWithoutPrefixes.match(/[A-Za-zÀ-ÿ]/g)?.length || 0;
  if (letterRatio / cleanedWithoutPrefixes.length < 0.7) return false;
  
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
    return airbnb.airbnbBookingId || airbnb.airbnb_booking_id || '';
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
  isStart: boolean = true
): string => {
  if (!isStart) return '';
  
  const isAirbnb = 'source' in booking && booking.source === 'airbnb';
  const enrichedBooking = booking as EnrichedBooking;
  const airbnbReservation = isAirbnb ? (booking as unknown as AirbnbReservation) : null;
  const regularBooking = !isAirbnb ? (booking as Booking) : null;
  
  // PRIORITÉ 1: Vérifier les soumissions réelles (noms validés par les guests)
  if (enrichedBooking.hasRealSubmissions && 
      enrichedBooking.realGuestNames && 
      enrichedBooking.realGuestNames.length > 0) {
    const firstName = enrichedBooking.realGuestNames[0];
    const totalGuests = enrichedBooking.realGuestCount || enrichedBooking.realGuestNames.length;
    return formatGuestDisplayName(firstName, totalGuests);
  }
  
  // PRIORITÉ 2: Vérifier le guest_name (peut être validé via ICS ou mise à jour)
  // ✅ CORRIGÉ : Pour les réservations Airbnb, ne pas afficher le guestName si pas de booking associé
  // (c'est-à-dire si la réservation a été supprimée, le guestName peut persister mais ne doit pas être affiché)
  const guestName = isAirbnb 
    ? airbnbReservation?.guestName 
    : regularBooking?.guest_name;
  
  // ✅ AMÉLIORÉ : Nettoyer le guestName avant validation pour éviter les blocages
  // ✅ CORRIGÉ : Pour les réservations Airbnb, vérifier qu'elles ont des soumissions réelles ou un booking associé
  // Si une réservation Airbnb n'a pas de soumissions réelles, ne pas afficher le guestName même s'il existe
  // (car cela signifie probablement que la réservation a été supprimée et le guestName persiste)
  if (guestName) {
    // Pour les réservations Airbnb, ne pas afficher le guestName si pas de soumissions réelles
    // (cela évite d'afficher des noms de guests supprimés)
    if (isAirbnb && !enrichedBooking.hasRealSubmissions) {
      // Ne pas afficher le guestName pour les réservations Airbnb sans soumissions réelles
      // Passer à la priorité suivante (code de réservation)
    } else {
      const cleanedGuestName = cleanGuestName(guestName);
      if (cleanedGuestName && isValidGuestName(cleanedGuestName)) {
        const firstName = getFirstName(cleanedGuestName);
        const totalGuests = isAirbnb 
          ? (airbnbReservation?.numberOfGuests || 1)
          : (regularBooking?.guests?.length || 1);
        return formatGuestDisplayName(firstName, totalGuests);
      }
    }
  }
  
  // PRIORITÉ 3: Données manuelles des guests (pour les réservations manuelles)
  if (!isAirbnb && regularBooking?.guests && regularBooking.guests.length > 0) {
    const guest = regularBooking.guests[0];
    if (guest?.fullName && isValidGuestName(guest.fullName)) {
      const firstName = getFirstName(guest.fullName);
      return formatGuestDisplayName(firstName, regularBooking.guests.length);
    }
  }
  
  // PRIORITÉ 4: Code de réservation (fallback - format propre)
  const bookingCode = getBookingCode(booking);
  if (bookingCode && bookingCode.length > 0) {
    // ✅ AMÉLIORÉ : Nettoyage plus agressif du code
    let cleanedCode = bookingCode
      .replace(/\s*@\s*\d+\s*$/g, '') // Supprimer "@ 0", "@ 1", etc.
      .replace(/\s*@\s*\d+\s*/g, '') // Supprimer "@ 0" n'importe où
      .replace(/^(CL|PN|ZN|JN|UN|FN|HN|KN|SN|HM|CD|QT|MB|P|ZE|JBFD|AIRBNB|RESERVATION)\s+/i, '') // Supprimer tous les préfixes
      .replace(/\s+Phone\s*$/i, '') // Supprimer "Phone" à la fin
      .replace(/^Airbnb\s*–\s*/i, '') // Supprimer "Airbnb – " au début
      .replace(/^Airbnb\s*/i, '') // Supprimer "Airbnb" seul au début
      .replace(/^Réservation\s+/i, '') // Supprimer "Réservation " au début
      .trim();
    
    // Si après nettoyage il reste quelque chose, l'afficher
    if (cleanedCode && cleanedCode.length > 0 && cleanedCode.length > 2 && cleanedCode.length < 20) {
      // Vérifier que ce n'est pas juste un code aléatoire (moins de 3 caractères) ni trop long
      const displayCode = cleanedCode.length > 10 
        ? `${cleanedCode.substring(0, 10)}...`
        : cleanedCode;
      return displayCode;
    }
  }
  
  // ✅ AMÉLIORÉ : Dernier fallback - nom simple sans préfixe
  return 'Réservation';
};

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

