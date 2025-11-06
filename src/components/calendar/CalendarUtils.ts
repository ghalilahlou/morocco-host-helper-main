import { Booking } from '@/types/booking';
import { AirbnbReservation } from '@/services/airbnbSyncService';
import { EnrichedBooking } from '@/services/guestSubmissionService';
import { getUnifiedBookingDisplayText, getGuestInitials as getUnifiedGuestInitials } from '@/utils/bookingDisplay';
import { BOOKING_COLORS as CONSTANT_BOOKING_COLORS } from '@/constants/bookingColors';

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
  weekIndex: number;
  color: string;
  isAirbnb?: boolean;
  layer?: number;
}

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
    const date = new Date(year, month, 1 - i);
    days.push({
      date,
      isCurrentMonth: false,
      dayNumber: date.getDate()
    });
  }
  
  // Add current month days
  for (let day = 1; day <= lastDay.getDate(); day++) {
    const date = new Date(year, month, day);
    days.push({
      date,
      isCurrentMonth: true,
      dayNumber: day
    });
  }
  
  // Add next month days to complete the grid
  const remainingDays = 42 - days.length; // 6 weeks * 7 days
  for (let day = 1; day <= remainingDays; day++) {
    const date = new Date(year, month + 1, day);
    days.push({
      date,
      isCurrentMonth: false,
      dayNumber: day
    });
  }
  
  return days;
};

// Helper function to check if two booking periods overlap in days
const doBookingPeriodsOverlap = (booking1: BookingLayout, booking2: BookingLayout): boolean => {
  const start1 = booking1.startDayIndex;
  const end1 = booking1.startDayIndex + booking1.span - 1;
  const start2 = booking2.startDayIndex;
  const end2 = booking2.startDayIndex + booking2.span - 1;
  
  // Check if ranges overlap: start1 <= end2 && start2 <= end1
  return start1 <= end2 && start2 <= end1;
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
      
      // ✅ OPTIMISÉ : Limite de sécurité renforcée avec meilleur message de debug
      if (assignedLayer > 15) {
        console.warn(`⚠️ Trop de couches (${assignedLayer}) pour la réservation ${booking.booking.id}. Placement forcé.`, {
          bookingStart: booking.startDayIndex,
          bookingSpan: booking.span,
          weekIndex: booking.weekIndex,
          totalBookingsInWeek: bookings.length
        });
        layeredBookings.push({ ...booking, layer: assignedLayer });
        placed = true;
      }
    }
  }
  
  // ✅ NOUVEAU : Optimisation post-placement pour compacter les couches
  // Réduire les "trous" dans les couches quand c'est possible
  const maxLayer = Math.max(...layeredBookings.map(b => b.layer || 0));
  for (let layer = 1; layer <= maxLayer; layer++) {
    const bookingsInLayer = layeredBookings.filter(b => b.layer === layer);
    
    for (const booking of bookingsInLayer) {
      // Essayer de déplacer cette réservation vers une couche inférieure
      for (let targetLayer = 0; targetLayer < layer; targetLayer++) {
        const bookingsInTargetLayer = layeredBookings.filter(b => b.layer === targetLayer);
        const hasOverlap = bookingsInTargetLayer.some(existingBooking => 
          doBookingPeriodsOverlap(booking, existingBooking)
        );
        
        if (!hasOverlap) {
          // Déplacer vers la couche inférieure
          booking.layer = targetLayer;
          break;
        }
      }
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
  
  // Process each booking and find all weeks it appears in
  bookings.forEach((booking, bookingIndex) => {
    const isAirbnb = 'source' in booking && booking.source === 'airbnb';
    // ✅ NORMALISATION LOCALE : éviter les décalages de fuseau sur 'YYYY-MM-DD'
    const toLocalMidnight = (d: Date | string) => {
      const date = typeof d === 'string' ? new Date(d) : d;
      return new Date(date.getFullYear(), date.getMonth(), date.getDate());
    };
    const checkIn = isAirbnb 
      ? toLocalMidnight((booking as unknown as AirbnbReservation).startDate)
      : toLocalMidnight((booking as Booking).checkInDate);
    const checkOut = isAirbnb 
      ? toLocalMidnight((booking as unknown as AirbnbReservation).endDate)
      : toLocalMidnight((booking as Booking).checkOutDate);
    
    // Use color override if provided, otherwise use status-based or default colors
    const bookingId = isAirbnb ? booking.id : booking.id;
    let color: string;
    
    if (colorOverrides?.[bookingId]) {
      color = colorOverrides[bookingId];
    } else if (isAirbnb) {
      // ✅ CORRIGÉ : Airbnb bookings use blue by default (not red/gray)
      color = CONSTANT_BOOKING_COLORS.airbnb.tailwind;
    } else {
      // For manual bookings, determine color based on status and Airbnb matching
      const manualBooking = booking as Booking;
      
      // Priority 1: Confirmed/completed bookings appear green
      if (manualBooking.status === 'confirmed' || manualBooking.status === 'completed') {
        color = 'bg-success'; // Green for confirmed/completed bookings
      } else {
        // Priority 2: Check for Airbnb match
        const hasAirbnbMatch = bookings.some(b => {
          if (!('source' in b) || b.source !== 'airbnb') return false;
          const airbnb = b as unknown as AirbnbReservation;
          const manualStart = new Date(manualBooking.checkInDate);
          const manualEnd = new Date(manualBooking.checkOutDate);
          const airbnbStart = new Date(airbnb.startDate);
          const airbnbEnd = new Date(airbnb.endDate);
          
          return manualStart.getTime() === airbnbStart.getTime() && 
                 manualEnd.getTime() === airbnbEnd.getTime();
        });
        
        if (hasAirbnbMatch) {
          color = 'bg-success'; // Green for matched bookings
        } else {
          // Priority 3: Check for conflicts with Airbnb bookings
          const hasConflict = bookings.some(b => {
          if (!('source' in b) || b.source !== 'airbnb') return false;
          const airbnb = b as unknown as AirbnbReservation;
          const manualStart = new Date(manualBooking.checkInDate);
          const manualEnd = new Date(manualBooking.checkOutDate);
          const airbnbStart = new Date(airbnb.startDate);
          const airbnbEnd = new Date(airbnb.endDate);
          
          return manualStart < airbnbEnd && manualEnd > airbnbStart;
        });
        
          // ✅ CORRIGÉ : Red ONLY for conflicts, blue for normal bookings
          color = hasConflict ? 'bg-destructive' : CONSTANT_BOOKING_COLORS.manual.tailwind;
        }
      }
    }
    
    
    // Check each week to see if the booking appears in it
    weeks.forEach((week, weekIndex) => {
      let startIndex = -1;
      let endIndex = -1;
      
      // Find the booking span within this specific week
      for (let dayIndex = 0; dayIndex < 7; dayIndex++) {
        const day = week[dayIndex];
        const dayDate = new Date(day.date.getFullYear(), day.date.getMonth(), day.date.getDate());
        const checkInDate = new Date(checkIn.getFullYear(), checkIn.getMonth(), checkIn.getDate());
        const checkOutDate = new Date(checkOut.getFullYear(), checkOut.getMonth(), checkOut.getDate());
        
        // CORRECTED: Check if this day is within booking period (inclusive start, up to but NOT including checkout day)
        // This matches Airbnb format where bars end at the beginning of checkout day
        const isInBookingPeriod = dayDate >= checkInDate && dayDate < checkOutDate;
        
        if (isInBookingPeriod) {
          if (startIndex === -1) {
            startIndex = dayIndex;
          }
          endIndex = dayIndex;
        }
      }
      
      // If we found booking days in this week, create a layout entry
      if (startIndex !== -1 && endIndex !== -1) {
        const span = endIndex - startIndex + 1;
        const firstDayDate = new Date(week[startIndex].date.getFullYear(), week[startIndex].date.getMonth(), week[startIndex].date.getDate());
        const checkInDate = new Date(checkIn.getFullYear(), checkIn.getMonth(), checkIn.getDate());
        const isStart = firstDayDate.getTime() === checkInDate.getTime();
        
        
        const bookingLayout = {
          booking,
          startDayIndex: startIndex,
          span,
          isStart,
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
    
    // Filter out Airbnb bookings that have corresponding manual bookings
    const filteredAirbnbBookings = airbnbBookings.filter(airbnbBooking => {
      const airbnbStart = (airbnbBooking.booking as AirbnbReservation).startDate;
      const airbnbEnd = (airbnbBooking.booking as AirbnbReservation).endDate;
      const airbnbId = (airbnbBooking.booking as AirbnbReservation).airbnbBookingId;
      
      const hasMatch = manualBookings.some(manualBooking => {
        const manualStart = new Date((manualBooking.booking as Booking).checkInDate);
        const manualEnd = new Date((manualBooking.booking as Booking).checkOutDate);
        const manualRef = (manualBooking.booking as Booking).bookingReference;
        
        // Check if dates match exactly OR if booking references match
        const datesMatch = manualStart.getTime() === airbnbStart.getTime() && 
                          manualEnd.getTime() === airbnbEnd.getTime();
        const refsMatch = manualRef && airbnbId && 
                         (manualRef.includes(airbnbId) || airbnbId.includes(manualRef));
        
        return datesMatch || refsMatch;
      });
      
      return !hasMatch; // Keep only Airbnb bookings that don't have manual matches
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
    hasGuests?: boolean
  }> = [];
  
  // Ajouter toutes les réservations manuelles
  bookings.forEach(booking => {
    allReservations.push({
      id: booking.id,
      start: new Date(booking.checkInDate),
      end: new Date(booking.checkOutDate),
      bookingReference: booking.bookingReference,
      status: booking.status,
      hasGuests: booking.guests && booking.guests.length > 0 && booking.guests.some(g => g.fullName && g.fullName.trim() !== '')
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
          status: 'pending', // Les réservations Airbnb sont toujours pending
          hasGuests: false // Les réservations Airbnb n'ont pas de guests
        });
      } else {
        // C'est un Booking transformé
        const booking = reservation as Booking;
        allReservations.push({
          id: booking.id,
          start: new Date(booking.checkInDate),
          end: new Date(booking.checkOutDate),
          bookingReference: booking.bookingReference,
          status: booking.status,
          hasGuests: booking.guests && booking.guests.length > 0 && booking.guests.some(g => g.fullName && g.fullName.trim() !== '')
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
      
      // ✅ CORRIGÉ : Ignorer les conflits entre réservations avec le même booking_reference
      // C'est la même réservation ICS (une dans airbnb_reservations, une dans bookings)
      const sameReference = res1.bookingReference && 
                            res2.bookingReference && 
                            res1.bookingReference === res2.bookingReference &&
                            res1.bookingReference !== 'INDEPENDENT_BOOKING';
      
      if (sameReference) {
        // ✅ C'est la même réservation ICS : une dans airbnb_reservations (pending) et une dans bookings (validée)
        // Ignorer ce conflit car c'est la même réservation à différents stades
        continue; // Ignorer ce conflit, c'est la même réservation
      }
      
      // Normaliser les dates (midnight local pour éviter les problèmes de timezone)
      const start1 = new Date(res1.start.getFullYear(), res1.start.getMonth(), res1.start.getDate());
      const end1 = new Date(res1.end.getFullYear(), res1.end.getMonth(), res1.end.getDate());
      const start2 = new Date(res2.start.getFullYear(), res2.start.getMonth(), res2.start.getDate());
      const end2 = new Date(res2.end.getFullYear(), res2.end.getMonth(), res2.end.getDate());
      
      // Vérifier si les dates se chevauchent (logique simple et intuitive)
      const overlaps = start1 < end2 && start2 < end1;
      
      if (overlaps) {
        // ✅ NOUVEAU : Un conflit n'est valide QUE SI les DEUX réservations sont "enregistrées"
        // Une réservation est "enregistrée" si elle a des guests (documents d'identité + contrat + police)
        const res1IsValidated = res1.hasGuests === true;
        const res2IsValidated = res2.hasGuests === true;
        
        // ✅ CRITIQUE : Ignorer les conflits si au moins UNE des réservations n'est pas validée
        // Cela empêche les réservations ICS (pending, sans guests) d'être marquées en rouge
        if (!res1IsValidated || !res2IsValidated) {
          console.log('ℹ️ Chevauchement ignoré (réservation(s) non validée(s)):', {
            res1: { 
              id: res1.id, 
              reference: res1.bookingReference,
              validated: res1IsValidated
            },
            res2: { 
              id: res2.id, 
              reference: res2.bookingReference,
              validated: res2IsValidated
            }
          });
          continue; // Ignorer ce conflit, au moins une réservation n'est pas validée
        }
        
        // ✅ Si on arrive ici, les DEUX réservations sont validées ET se chevauchent = VRAI CONFLIT
        console.log('🚨 VRAI CONFLIT (2 réservations validées qui se chevauchent):', {
          res1: { 
            id: res1.id, 
            start: start1.toISOString().split('T')[0], 
            end: end1.toISOString().split('T')[0],
            reference: res1.bookingReference,
            status: res1.status,
            validated: res1IsValidated
          },
          res2: { 
            id: res2.id, 
            start: start2.toISOString().split('T')[0], 
            end: end2.toISOString().split('T')[0],
            reference: res2.bookingReference,
            status: res2.status,
            validated: res2IsValidated
          }
        });
        
        if (!conflicts.includes(res1.id)) {
          conflicts.push(res1.id);
        }
        if (!conflicts.includes(res2.id)) {
          conflicts.push(res2.id);
        }
      }
    }
  }
  
  // ✅ CORRIGÉ : Logger seulement si c'est un nouveau conflit ou si le nombre a changé
  // (Utiliser un Set pour éviter les doublons dans les logs)
  if (conflicts.length > 0) {
    // Logger seulement une fois par session pour éviter le spam
    const conflictKey = conflicts.sort().join(',');
    if (!(window as any).__lastConflictKey || (window as any).__lastConflictKey !== conflictKey) {
    console.log('✅ Total conflits détectés:', conflicts.length, conflicts);
      (window as any).__lastConflictKey = conflictKey;
    }
  } else {
    // Réinitialiser si plus de conflits
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
export const getBookingDisplayText = (booking: Booking | AirbnbReservation, isStart: boolean): string => {
  return getUnifiedBookingDisplayText(booking, isStart);
};

/**
 * ✅ CORRIGÉ : Utilise la logique unifiée pour générer les initiales
 */
export const getGuestInitials = (booking: Booking | AirbnbReservation): string => {
  return getUnifiedGuestInitials(booking);
};