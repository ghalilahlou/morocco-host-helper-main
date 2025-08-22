import { Booking } from '@/types/booking';
import { AirbnbReservation } from '@/services/airbnbSyncService';
import { EnrichedBooking } from '@/services/guestSubmissionService';

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

export const BOOKING_COLORS = [
  'bg-red-800', 'bg-red-900', 'bg-rose-800', 'bg-rose-900', 
  'bg-red-700', 'bg-rose-700', 'bg-red-950', 'bg-rose-950',
  'bg-slate-800', 'bg-slate-900', 'bg-stone-800', 'bg-stone-900'
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

// Assign layers to bookings to avoid visual overlaps
const assignBookingLayers = (bookings: BookingLayout[]): BookingLayout[] => {
  if (bookings.length === 0) return bookings;
  
  // Sort bookings by start day, then by span (shorter bookings first to prioritize them)
  const sortedBookings = [...bookings].sort((a, b) => {
    if (a.startDayIndex !== b.startDayIndex) {
      return a.startDayIndex - b.startDayIndex;
    }
    return a.span - b.span; // Shorter bookings get priority
  });
  
  // Track which layer each booking is assigned to
  const layeredBookings: BookingLayout[] = [];
  
  for (const booking of sortedBookings) {
    let assignedLayer = 0;
    let placed = false;
    
    // Try to find a layer where this booking doesn't overlap with existing ones
    while (!placed) {
      const bookingsInThisLayer = layeredBookings.filter(b => b.layer === assignedLayer);
      
      // Check if this booking overlaps with any booking in the current layer
      const hasOverlap = bookingsInThisLayer.some(existingBooking => 
        doBookingPeriodsOverlap(booking, existingBooking)
      );
      
      if (!hasOverlap) {
        // No overlap found, place booking in this layer
        layeredBookings.push({ ...booking, layer: assignedLayer });
        placed = true;
      } else {
        // Overlap found, try next layer
        assignedLayer++;
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
    const checkIn = isAirbnb ? (booking as unknown as AirbnbReservation).startDate : new Date((booking as Booking).checkInDate);
    const checkOut = isAirbnb ? (booking as unknown as AirbnbReservation).endDate : new Date((booking as Booking).checkOutDate);
    
    // Use color override if provided, otherwise use status-based or default colors
    const bookingId = isAirbnb ? booking.id : booking.id;
    let color: string;
    
    if (colorOverrides?.[bookingId]) {
      color = colorOverrides[bookingId];
    } else if (isAirbnb) {
      // Airbnb bookings use pending (gray) color by default
      color = 'bg-pending';
    } else {
      // For manual bookings, determine color based on potential matching with Airbnb
      const manualBooking = booking as Booking;
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
        // Check for conflicts with Airbnb bookings
        const hasConflict = bookings.some(b => {
          if (!('source' in b) || b.source !== 'airbnb') return false;
          const airbnb = b as unknown as AirbnbReservation;
          const manualStart = new Date(manualBooking.checkInDate);
          const manualEnd = new Date(manualBooking.checkOutDate);
          const airbnbStart = new Date(airbnb.startDate);
          const airbnbEnd = new Date(airbnb.endDate);
          
          return manualStart < airbnbEnd && manualEnd > airbnbStart;
        });
        
        color = hasConflict ? 'bg-destructive' : 'bg-pending'; // Red for conflicts, gray for no match
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

export const detectBookingConflicts = (bookings: Booking[]): string[] => {
  const conflicts: string[] = [];
  
  for (let i = 0; i < bookings.length; i++) {
    for (let j = i + 1; j < bookings.length; j++) {
      const booking1 = bookings[i];
      const booking2 = bookings[j];
      
      const start1 = new Date(booking1.checkInDate);
      const end1 = new Date(booking1.checkOutDate);
      const start2 = new Date(booking2.checkInDate);
      const end2 = new Date(booking2.checkOutDate);
      
      // Check if dates overlap
      if (start1 < end2 && start2 < end1) {
        if (!conflicts.includes(booking1.id)) conflicts.push(booking1.id);
        if (!conflicts.includes(booking2.id)) conflicts.push(booking2.id);
      }
    }
  }
  
  return conflicts;
};

export const getBookingDisplayText = (booking: Booking | AirbnbReservation, isStart: boolean): string => {
  if (isStart) {
    if ('source' in booking && booking.source === 'airbnb') {
      return (booking as unknown as AirbnbReservation).guestName?.split(' ')[0] || 'Airbnb';
    } else {
      const regularBooking = booking as Booking;
      const enrichedBooking = booking as EnrichedBooking;
      
      // Prioritize real guest names from submissions
      if (enrichedBooking.realGuestNames && enrichedBooking.realGuestNames.length > 0) {
        const firstName = enrichedBooking.realGuestNames[0].split(' ')[0];
        const totalGuests = enrichedBooking.realGuestCount;
        return totalGuests > 1 ? `${firstName} + ${totalGuests - 1}` : firstName;
      }
      
      // Fallback to manual guest data
      const guestName = regularBooking.guests[0]?.fullName?.split(' ')[0] || 'Client';
      const guestCount = regularBooking.guests.length;
      return guestCount > 1 ? `${guestName} + ${guestCount - 1}` : guestName;
    }
  }
  return '';
};

export const getGuestInitials = (booking: Booking | AirbnbReservation): string => {
  if ('source' in booking && booking.source === 'airbnb') {
    const guestName = (booking as unknown as AirbnbReservation).guestName || 'AB';
    return guestName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  } else {
    const regularBooking = booking as Booking;
    const enrichedBooking = booking as EnrichedBooking;
    
    // Prioritize real guest names from submissions
    if (enrichedBooking.realGuestNames && enrichedBooking.realGuestNames.length > 0) {
      const guestName = enrichedBooking.realGuestNames[0];
      return guestName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    }
    
    // Fallback to manual guest data
    const guestName = regularBooking.guests[0]?.fullName || 'Client';
    return guestName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  }
};