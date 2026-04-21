import { isBefore, startOfDay } from 'date-fns';
import { parseStayDateForCalendar } from '@/utils/dateUtils';
import { Booking } from '@/types/booking';
import { AirbnbReservation } from '@/services/airbnbSyncService';
import { EnrichedBooking } from '@/services/guestSubmissionService';
import { getBookingDisplayTitle, getGuestInitials as getUnifiedGuestInitials } from '@/utils/bookingDisplay';
import { getBookingDocumentStatus } from '@/utils/bookingDocuments';
import { BOOKING_COLORS as CONSTANT_BOOKING_COLORS } from '@/constants/bookingColors';
import { isMatchingReservation, isSameReservationByRef } from '@/utils/bookingAirbnbMatch';

export interface CalendarDay {
  date: Date;
  isCurrentMonth: boolean;
  dayNumber: number;
}

export interface BookingLayout {
  booking: Booking | AirbnbReservation;
  startDayIndex: number;
  span: number;
  isStart: boolean;
  /** Segment contient le jour de départ (check-out) : barre légèrement raccourcie pour laisser un espace */
  isEnd?: boolean;
  weekIndex: number;
  color: string;
  isAirbnb?: boolean;
  layer?: number;
  /** Quand une autre réservation se termine ce jour-là (même ligne), décaler le début de la barre pour un léger espace */
  startOffsetPercent?: number;
  /** Quand une autre réservation commence ce jour-là (même ligne), raccourcir la barre à droite pour un léger espace */
  endOffsetPercent?: number;
}

/** Espace en % de la largeur de cellule entre barres adjacentes (fin 06 / début 07) */
export const BAR_GAP_PERCENT = 22;

// ✅ CORRIGÉ : Palette bleu turquoise pour les réservations (rouge réservé aux conflits)
export const BOOKING_COLORS = [
  'bg-cyan-400', 'bg-cyan-500', 'bg-teal-500', 'bg-teal-600',
  'bg-teal-700', 'bg-cyan-600', 'bg-teal-400', 'bg-teal-500',
  'bg-cyan-300', 'bg-teal-300', 'bg-cyan-400', 'bg-teal-600'
];

export const generateCalendarDays = (currentDate: Date): CalendarDay[] => {
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const firstDayOfWeek = firstDay.getDay() === 0 ? 7 : firstDay.getDay(); // Monday = 1
  
  const days: CalendarDay[] = [];
  
  // Add previous month days
  for (let i = firstDayOfWeek - 1; i > 0; i--) {
    const date = new Date(year, month, 1 - i, 0, 0, 0, 0);
    days.push({
      date,
      isCurrentMonth: false,
      dayNumber: date.getDate()
    });
  }
  
  // Add current month days
  for (let day = 1; day <= lastDay.getDate(); day++) {
    const date = new Date(year, month, day, 0, 0, 0, 0);
    days.push({
      date,
      isCurrentMonth: true,
      dayNumber: day
    });
  }
  
  // Add next month days to complete the grid
  const remainingDays = 42 - days.length; // 6 weeks * 7 days
  for (let day = 1; day <= remainingDays; day++) {
    const date = new Date(year, month + 1, day, 0, 0, 0, 0);
    days.push({
      date,
      isCurrentMonth: false,
      dayNumber: day
    });
  }
  
  return days;
};

// Chevauchement : deux périodes se chevauchent si elles partagent des jours.
// Exception : quand une se termine exactement le jour où l'autre commence (ex. fin 11 / début 11),
// on les met sur la MÊME ligne avec un espace pour garder la distinction visuelle.
const doBookingPeriodsOverlap = (booking1: BookingLayout, booking2: BookingLayout): boolean => {
  const start1 = booking1.startDayIndex;
  const end1 = booking1.startDayIndex + booking1.span - 1;
  const start2 = booking2.startDayIndex;
  const end2 = booking2.startDayIndex + booking2.span - 1;
  // Même jour de transition : une finit, l'autre commence → pas de chevauchement pour le layering
  if (end1 === start2 || end2 === start1) return false;
  return start1 < end2 && end1 > start2;
};

// ✅ OPTIMISÉ : Algorithme amélioré pour l'espacement des réservations avec gestion intelligente des chevauchements
const assignBookingLayers = (bookings: BookingLayout[]): BookingLayout[] => {
  if (bookings.length === 0) return bookings;
  
  // ✅ OPTIMISÉ : Tri intelligent multi-critères pour un placement optimal
  const sortedBookings = [...bookings].sort((a, b) => {
    // 1. Priorité aux réservations qui commencent plus tôt (affichage chronologique)
    if (a.startDayIndex !== b.startDayIndex) {
      return a.startDayIndex - b.startDayIndex;
    }
    // 2. Ensuite par durée (plus longues en premier pour un meilleur empilement)
    if (a.span !== b.span) {
      return b.span - a.span; // Inversé : plus longues d'abord
    }
    // 3. Enfin par type (réservations manuelles en premier pour visibilité)
    if (a.isAirbnb !== b.isAirbnb) {
      return a.isAirbnb ? 1 : -1; // Inversé : manuelles d'abord
    }
    return 0;
  });
  
  const layeredBookings: BookingLayout[] = [];
  let overflowCount = 0;
  const MAX_LAYERS = 100;
  
  for (const booking of sortedBookings) {
    let assignedLayer = 0;
    let placed = false;
    
    // ✅ OPTIMISÉ : Algorithme de placement avec recherche intelligente de couche
    while (!placed) {
      const bookingsInThisLayer = layeredBookings.filter(b => b.layer === assignedLayer);
      
      // Vérifier s'il y a un chevauchement avec des réservations existantes dans cette couche
      const hasOverlap = bookingsInThisLayer.some(existingBooking => 
        doBookingPeriodsOverlap(booking, existingBooking)
      );
      
      if (!hasOverlap) {
        // ✅ Pas de chevauchement : placer la réservation dans cette couche
        layeredBookings.push({ ...booking, layer: assignedLayer });
        placed = true;
      } else {
        // ✅ Chevauchement détecté : essayer la couche suivante
        assignedLayer++;
      }
      
      // ✅ Limite de sécurité : placement forcé silencieux au-delà de MAX_LAYERS
      if (assignedLayer > MAX_LAYERS) {
        overflowCount++;
        layeredBookings.push({ ...booking, layer: assignedLayer });
        placed = true;
      }
    }
  }
  
  if (overflowCount > 0 && process.env.NODE_ENV === 'development') {
    const key = `${bookings.length}-${overflowCount}`;
    const w = typeof window !== 'undefined' ? (window as unknown as { __calLayerOverflowKey?: string }) : undefined;
    if (!w || w.__calLayerOverflowKey !== key) {
      if (w) w.__calLayerOverflowKey = key;
      console.warn(
        `⚠️ ${overflowCount} réservation(s) dépassent ${MAX_LAYERS} couches (${bookings.length} barres/semaine). Dédupliquez les mêmes ref+dates côté données ou calendrier.`,
      );
    }
  }
  
  return layeredBookings;
};

export const calculateBookingLayout = (
  calendarDays: CalendarDay[], 
  bookings: (Booking | AirbnbReservation)[],
  colorOverrides?: { [key: string]: string }
): { [key: string]: BookingLayout[] } => {
  const weeks = [];
  for (let i = 0; i < calendarDays.length; i += 7) {
    weeks.push(calendarDays.slice(i, i + 7));
  }

  const bookingRows: { [key: string]: BookingLayout[] } = {};
  
  // Initialize all weeks as empty arrays
  weeks.forEach((_, weekIndex) => {
    bookingRows[weekIndex] = [];
  });
  
  // ✅ DEBUG : Log pour vérifier les réservations reçues dans calculateBookingLayout
  if (process.env.NODE_ENV === 'development' && bookings.length > 0) {
    const bookingsByStatus = {
      pending: bookings.filter(b => 'status' in b && (b as Booking).status === 'pending').length,
      completed: bookings.filter(b => 'status' in b && (b as Booking).status === 'completed').length,
      confirmed: bookings.filter(b => 'status' in b && (b as Booking).status === 'confirmed').length,
      archived: bookings.filter(b => 'status' in b && (b as Booking).status === 'archived').length,
      airbnb: bookings.filter(b => 'source' in b && (b as any).source === 'airbnb').length
    };
    // ✅ NETTOYAGE LOGS : Supprimé pour éviter les boucles infinies et le crash du navigateur
    // Ce log était exécuté à chaque calcul de layout et causait des re-rendus infinis
    // console.log('📊 [CalendarUtils] Réservations reçues dans calculateBookingLayout:', ...);
  }
  
  // Process each booking and find all weeks it appears in
  bookings.forEach((booking, bookingIndex) => {
    const isAirbnb = 'source' in booking && booking.source === 'airbnb';
    // ✅ NORMALISATION LOCALE AMÉLIORÉE : gérer les dates YYYY-MM-DD sans décalage UTC
    const toLocalMidnight = (d: Date | string) =>
      typeof d === 'string'
        ? parseStayDateForCalendar(d)
        : new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const rawCheckIn = isAirbnb 
      ? (booking as unknown as AirbnbReservation).startDate
      : (booking as Booking).checkInDate;
    const rawCheckOut = isAirbnb 
      ? (booking as unknown as AirbnbReservation).endDate
      : (booking as Booking).checkOutDate;
    
    const checkIn = toLocalMidnight(rawCheckIn);
    const checkOut = toLocalMidnight(rawCheckOut);
    
    // ✅ NETTOYAGE LOGS : Supprimé pour éviter les boucles infinies
    // Ce log était dans une boucle forEach et causait des re-rendus infinis
    // if (process.env.NODE_ENV === 'development' && bookingIndex === 0) {
    //   console.log('🗓️ [Calendar] Première réservation:', ...);
    // }
    
    // Use color override if provided, otherwise use status-based or default colors
    const bookingId = isAirbnb ? booking.id : booking.id;
    let color: string;
    
    if (colorOverrides?.[bookingId]) {
      color = colorOverrides[bookingId];
    } else if (isAirbnb) {
      // ✅ CORRIGÉ : Airbnb bookings use blue by default (not red/gray)
      color = CONSTANT_BOOKING_COLORS.airbnb.tailwind;
    } else {
      // For manual bookings, use black/dark gray color (like in Figma design)
      const manualBooking = booking as Booking;
      
      // ✅ MODIFIÉ : Toutes les réservations manuelles sont NOIRES (comme dans Figma)
      // Pas de vert pour les confirmées/complétées - seulement noir
      color = CONSTANT_BOOKING_COLORS.manual.tailwind; // bg-gray-900 (noir)
      
      // ✅ SIMPLIFIÉ : Ne plus détecter les conflits ici car c'est fait par detectBookingConflicts()
      // La couleur sera appliquée par CalendarBookingBar selon le résultat de detectBookingConflicts()
    }
    
    
    
    // ✅ CORRIGÉ : Normalisation stricte des dates pour éviter les décalages
    const normalizeDate = (date: Date): Date => {
      // Créer une nouvelle date avec seulement l'année, le mois et le jour (sans heures/minutes/secondes)
      return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);
    };
    
    const normalizedCheckIn = normalizeDate(checkIn);
    const normalizedCheckOut = normalizeDate(checkOut);
    
    // Check each week to see if the booking appears in it
    weeks.forEach((week, weekIndex) => {
      let startIndex = -1;
      let endIndex = -1;
      let hasBookingOverlap = false;
      
      // ✅ ANALYSE : Trouver le span de la réservation dans cette semaine
      // ✅ CORRIGÉ : Vérifier TOUS les jours (y compris ceux hors du mois courant) pour détecter les réservations qui chevauchent plusieurs mois
      for (let dayIndex = 0; dayIndex < 7; dayIndex++) {
        const day = week[dayIndex];

        // ✅ CRITIQUE : Normaliser la date du jour de la même manière que checkIn/checkOut
        const dayDate = normalizeDate(new Date(day.date.getFullYear(), day.date.getMonth(), day.date.getDate()));
        
        // ✅ NETTOYAGE LOGS : Supprimé pour éviter les boucles infinies et le crash du navigateur
        // Ce log était dans une boucle triple (bookings × weeks × days) et causait des re-rendus infinis
        // if (process.env.NODE_ENV === 'development' && bookingIndex === 0 && weekIndex === 0 && dayIndex === 0) {
        //   console.log('🔍 [ANALYSE POSITION] Comparaison dates:', ...);
        // }
        
        // ✅ La barre s’étend jusqu’au jour de départ (inclus) ; un léger espace visuel évite le chevauchement.
        const isInBookingPeriod = dayDate.getTime() >= normalizedCheckIn.getTime() && dayDate.getTime() <= normalizedCheckOut.getTime();
        
        if (isInBookingPeriod) {
          hasBookingOverlap = true;
          
          // ✅ CORRIGÉ : Ne définir startIndex/endIndex que pour les jours du mois courant
          // Mais marquer qu'on a trouvé un chevauchement même si c'est hors du mois courant
          if (day.isCurrentMonth) {
          if (startIndex === -1) {
            startIndex = dayIndex;
          }
          endIndex = dayIndex;
        }
        }
      }
      
      // ✅ CORRIGÉ : Si la réservation chevauche cette semaine mais commence avant ou se termine après le mois courant,
      // on doit quand même créer un layout pour les jours du mois courant dans cette semaine
      if (hasBookingOverlap && startIndex === -1) {
        // La réservation commence avant le mois courant, commencer au premier jour du mois courant de cette semaine
        for (let i = 0; i < 7; i++) {
          if (week[i].isCurrentMonth) {
            startIndex = i;
            break;
          }
        }
      }
      
      if (hasBookingOverlap && endIndex === -1 && startIndex !== -1) {
        // La réservation se termine après le mois courant, aller jusqu'au dernier jour du mois courant de cette semaine
        for (let i = 6; i >= 0; i--) {
          if (week[i].isCurrentMonth) {
            endIndex = i;
            break;
          }
        }
      }
      
      // ✅ CORRIGÉ : Créer un layout entry si on a trouvé des jours dans le mois courant qui chevauchent la réservation
      if (startIndex !== -1 && endIndex !== -1 && startIndex <= endIndex) {
        const span = endIndex - startIndex + 1;
        
        // ✅ CORRIGÉ : Vérification stricte de l'alignement avec la date d'arrivée
        const firstDayDate = normalizeDate(new Date(week[startIndex].date.getFullYear(), week[startIndex].date.getMonth(), week[startIndex].date.getDate()));
        const isStart = firstDayDate.getTime() === normalizedCheckIn.getTime();
        
        // Segment contient le jour de départ : on raccourcit légèrement la barre pour laisser un espace avant la suivante.
        const lastDayDate = normalizeDate(new Date(week[endIndex].date.getFullYear(), week[endIndex].date.getMonth(), week[endIndex].date.getDate()));
        const isEnd = lastDayDate.getTime() === normalizedCheckOut.getTime();
        
        // ✅ OPTIMISATION : Logs désactivés pour améliorer la performance
        // Décommenter pour le debug si nécessaire
        
        const bookingLayout = {
          booking,
          startDayIndex: startIndex,
          span,
          isStart,
          isEnd,
          weekIndex,
          color,
          isAirbnb,
          layer: 0 // Will be properly assigned later
        };
        
        bookingRows[weekIndex].push(bookingLayout);
      }
    });
  });
  
  // Process each week to separate bookings, filter duplicates, and assign proper layers
  weeks.forEach((week, weekIndex) => {
    const weekBookings = bookingRows[weekIndex];
    const manualBookings: BookingLayout[] = [];
    const airbnbBookings: BookingLayout[] = [];
    
    // Separate by type
    weekBookings.forEach(bookingLayout => {
      if (bookingLayout.isAirbnb) {
        airbnbBookings.push(bookingLayout);
      } else {
        manualBookings.push(bookingLayout);
      }
    });
    
    const filteredAirbnbBookings = airbnbBookings.filter(airbnbBooking => {
      const airbnb = airbnbBooking.booking as AirbnbReservation;
      const hasMatch = manualBookings.some(manualBooking => {
        const manual = manualBooking.booking as Booking;
        return isMatchingReservation(
          manual.checkInDate, manual.checkOutDate, manual.bookingReference,
          airbnb.startDate, airbnb.endDate, airbnb.airbnbBookingId,
        );
      });
      return !hasMatch;
    });
    
    // Assign layers to all bookings together (not separately by type)
    // This ensures proper stacking regardless of booking type
    const allBookingsForLayering = [...filteredAirbnbBookings, ...manualBookings];
    const layeredBookings = assignBookingLayers(allBookingsForLayering);
    
    // Sort all bookings by layer (ascending - lower layers appear below higher layers)
    const sortedBookings = layeredBookings.sort((a, b) => {
      const layerA = a.layer || 0;
      const layerB = b.layer || 0;
      if (layerA !== layerB) {
        return layerA - layerB;
      }
      return a.startDayIndex - b.startDayIndex;
    });

    // Léger espace entre barres qui se touchent (ex. 06-08 et 08-10) : une se termine, l’autre commence le même jour.
    const GAP_PERCENT = BAR_GAP_PERCENT;
    sortedBookings.forEach((layout) => {
      const myStart = layout.startDayIndex;
      const myEnd = layout.startDayIndex + layout.span - 1;
      const myLayer = layout.layer ?? 0;
      // Barre qui COMMENCE : une autre se termine ce jour-là → décaler le début
      if (layout.isStart) {
        const otherEndsHere = sortedBookings.some(
          (other) =>
            (other.layer ?? 0) === myLayer &&
            other.booking.id !== layout.booking.id &&
            other.startDayIndex + other.span - 1 === myStart
        );
        if (otherEndsHere) layout.startOffsetPercent = GAP_PERCENT;
      }
      // Barre qui SE TERMINE : une autre commence ce jour-là → raccourcir la fin
      if (layout.isEnd) {
        const otherStartsHere = sortedBookings.some(
          (other) =>
            (other.layer ?? 0) === myLayer &&
            other.booking.id !== layout.booking.id &&
            other.startDayIndex === myEnd
        );
        if (otherStartsHere) layout.endOffsetPercent = GAP_PERCENT;
      }
    });

    // ✅ DEBUG : Log pour vérifier les réservations dans chaque semaine (uniquement en développement)
    if (process.env.NODE_ENV === 'development' && sortedBookings.length > 0) {
      const bookingsInWeekByStatus = {
        pending: sortedBookings.filter(b => 'status' in b.booking && (b.booking as Booking).status === 'pending').length,
        completed: sortedBookings.filter(b => 'status' in b.booking && (b.booking as Booking).status === 'completed').length,
        confirmed: sortedBookings.filter(b => 'status' in b.booking && (b.booking as Booking).status === 'confirmed').length,
        archived: sortedBookings.filter(b => 'status' in b.booking && (b.booking as Booking).status === 'archived').length,
        airbnb: sortedBookings.filter(b => b.isAirbnb).length
      };
      
      // ✅ NETTOYAGE LOGS : Supprimé pour éviter les boucles infinies et le crash du navigateur
      // Le diagnostic était dans une boucle et causait des re-rendus infinis
      // if (bookingsInWeekByStatus.completed > 0 || bookingsInWeekByStatus.confirmed > 0) {
      //   console.log(`📅 [CALENDAR DIAGNOSTIC] Semaine ${weekIndex}:`, ...);
      // }
    }
    
    bookingRows[weekIndex] = sortedBookings;
  });
  
  return bookingRows;
};

/**
 * ✅ AMÉLIORÉ : Détection simple et intuitive des conflits
 * Détecte les chevauchements entre toutes les réservations (manuelles et Airbnb)
 */
export const detectBookingConflicts = (
  bookings: Booking[], 
  airbnbReservations?: (Booking | AirbnbReservation)[]
): string[] => {
  const conflicts: string[] = [];
  // ✅ CORRIGÉ : Ajouter bookingReference et status pour détecter les réservations ICS non validées
  const allReservations: Array<{
    id: string, 
    start: Date, 
    end: Date, 
    bookingReference?: string,
    status?: string,
    isValidated?: boolean
  }> = [];
  
  // Ajouter toutes les réservations manuelles
  bookings.forEach(booking => {
    const documentStatus = getBookingDocumentStatus(booking);
    allReservations.push({
      id: booking.id,
      start: parseStayDateForCalendar(booking.checkInDate),
      end: parseStayDateForCalendar(booking.checkOutDate),
      bookingReference: booking.bookingReference,
      status: booking.status,
      isValidated: documentStatus.isValidated
    });
  });
  
  // Ajouter toutes les réservations Airbnb
  if (airbnbReservations) {
    airbnbReservations.forEach(reservation => {
      const isAirbnb = 'source' in reservation && reservation.source === 'airbnb';
      if (isAirbnb) {
        const airbnb = reservation as unknown as AirbnbReservation;
        allReservations.push({
          id: reservation.id,
          start: new Date(airbnb.startDate),
          end: new Date(airbnb.endDate),
          bookingReference: airbnb.airbnbBookingId,
          status: 'pending' // Les réservations Airbnb sont toujours pending
        });
      } else {
        // C'est un Booking transformé
        const booking = reservation as Booking;
        const documentStatus = getBookingDocumentStatus(booking);
        allReservations.push({
          id: booking.id,
          start: parseStayDateForCalendar(booking.checkInDate),
          end: parseStayDateForCalendar(booking.checkOutDate),
          bookingReference: booking.bookingReference,
          status: booking.status,
          isValidated: documentStatus.isValidated
        });
      }
    });
  }
  
  // Détecter les chevauchements : deux réservations se chevauchent si
  // start1 < end2 && start2 < end1 (logique simple et intuitive)
  for (let i = 0; i < allReservations.length; i++) {
    for (let j = i + 1; j < allReservations.length; j++) {
      const res1 = allReservations[i];
      const res2 = allReservations[j];
      
      // ✅ Ne jamais marquer une réservation en conflit avec elle-même (évite doublons dans la liste)
      if (res1.id === res2.id) continue;
      
      if (isSameReservationByRef(res1.bookingReference, res2.bookingReference)) {
        continue;
      }
      
      // Normaliser les dates (midnight local pour éviter les problèmes de timezone)
      const start1 = new Date(res1.start.getFullYear(), res1.start.getMonth(), res1.start.getDate());
      const end1 = new Date(res1.end.getFullYear(), res1.end.getMonth(), res1.end.getDate());
      const start2 = new Date(res2.start.getFullYear(), res2.start.getMonth(), res2.start.getDate());
      const end2 = new Date(res2.end.getFullYear(), res2.end.getMonth(), res2.end.getDate());
      
      // Vérifier si les dates se chevauchent (logique simple et intuitive)
      const overlaps = start1 < end2 && start2 < end1;
      
      if (overlaps) {
        // ✅ AMÉLIORÉ : Un conflit n'est valide QUE SI les DEUX réservations sont "validées" ET complètes
        // Une réservation est "validée" si elle a des guests ET des documents générés
        const res1IsValidated = res1.isValidated === true;
        const res2IsValidated = res2.isValidated === true;
        
        // ✅ CRITIQUE : Ignorer les conflits si au moins UNE des réservations n'est pas validée
        // Cela empêche les réservations ICS (pending, sans guests) d'être marquées en rouge
        // ET empêche les faux positifs pour les réservations avec guests mais sans conflit réel
        if (!res1IsValidated || !res2IsValidated) {
          continue; // Ignorer ce conflit silencieusement
        }
        
        // ✅ VÉRIFICATION SUPPLÉMENTAIRE : Vérifier que les dates se chevauchent vraiment
        // Une réservation qui se termine le jour où l'autre commence n'est PAS un conflit
        const res1EndsBeforeRes2Starts = end1.getTime() <= start2.getTime();
        const res2EndsBeforeRes1Starts = end2.getTime() <= start1.getTime();
        
        if (res1EndsBeforeRes2Starts || res2EndsBeforeRes1Starts) {
          continue; // Pas de conflit réel, juste des dates adjacentes
        }
        
        // ✅ Si on arrive ici, les DEUX réservations sont validées ET se chevauchent vraiment = VRAI CONFLIT
        if (!conflicts.includes(res1.id)) {
          conflicts.push(res1.id);
        }
        if (!conflicts.includes(res2.id)) {
          conflicts.push(res2.id);
        }
      }
    }
  }
  
  // ✅ PRODUCTION : Ne logger QUE en mode développement
  if (conflicts.length > 0 && process.env.NODE_ENV === 'development') {
    const conflictKey = conflicts.sort().join(',');
    if (!(window as any).__lastConflictKey || (window as any).__lastConflictKey !== conflictKey) {
      console.warn(`⚠️ ${conflicts.length} conflit(s) détecté(s)`);
      (window as any).__lastConflictKey = conflictKey;
    }
  } else if (conflicts.length === 0) {
    if ((window as any).__lastConflictKey) {
      delete (window as any).__lastConflictKey;
    }
  }
  
  return conflicts;
};

/**
 * ✅ CORRIGÉ : Utilise la logique unifiée pour éviter les doubles logiques
 * et les préfixes/suffixes aberrants
 */
export const getBookingDisplayText = (booking: Booking | AirbnbReservation, _isStart: boolean): string => {
  return getBookingDisplayTitle(booking);
};

/**
 * ✅ CORRIGÉ : Utilise la logique unifiée pour générer les initiales
 */
export const getGuestInitials = (booking: Booking | AirbnbReservation): string => {
  return getUnifiedGuestInitials(booking);
};

/** Date de départ (check-out) pour comparaisons calendrier */
export function getBookingCheckoutDate(booking: Booking | AirbnbReservation): Date {
  const isAirbnb = 'source' in booking && booking.source === 'airbnb';
  return isAirbnb
    ? new Date((booking as AirbnbReservation).endDate)
    : parseStayDateForCalendar((booking as Booking).checkOutDate);
}

/** Séjour terminé : jour de check-out strictement avant aujourd'hui */
export function isBookingStayPast(booking: Booking | AirbnbReservation): boolean {
  return isBefore(startOfDay(getBookingCheckoutDate(booking)), startOfDay(new Date()));
}