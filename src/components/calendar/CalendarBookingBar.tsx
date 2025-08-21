import { memo } from 'react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Booking } from '@/types/booking';
import { BookingLayout, getBookingDisplayText, getGuestInitials } from './CalendarUtils';
import { AirbnbReservation } from '@/services/airbnbSyncService';
import { Home } from 'lucide-react';
import { BOOKING_COLORS } from '@/constants/bookingColors';
import { EnrichedBooking } from '@/services/guestSubmissionService';

interface CalendarBookingBarProps {
  bookingData: BookingLayout;
  bookingIndex: number;
  conflicts: string[];
  onBookingClick: (booking: Booking | AirbnbReservation) => void;
}

export const CalendarBookingBar = memo(({
  bookingData,
  conflicts,
  onBookingClick
}: CalendarBookingBarProps) => {
  const isConflict = conflicts.includes(bookingData.booking.id);

  // Determine the color based on the booking color
  const getBackgroundColor = () => {
    const c = bookingData.color;
    // Support both semantic tokens and centralized tailwind classes
    if (c === 'bg-success' || c === BOOKING_COLORS.completed.tailwind) {
      return BOOKING_COLORS.completed.hex;
    }
    if (c === 'bg-destructive' || c === BOOKING_COLORS.conflict.tailwind) {
      return BOOKING_COLORS.conflict.hex;
    }
    return BOOKING_COLORS.pending.hex;
  };

  return (
    <div
      className={`
        text-white h-6 rounded-full flex items-center px-2 md:px-3
        cursor-pointer transition-all duration-200 hover:scale-[1.02]
        ${isConflict ? 'ring-2 ring-destructive ring-offset-1' : ''}
        relative group shadow-lg w-full text-xs
      `}
      style={{
        backgroundColor: getBackgroundColor(),
        minHeight: '24px',
        zIndex: 1000
      }}
      onClick={() => onBookingClick(bookingData.booking)}
      title={bookingData.isAirbnb ?
        `${(bookingData.booking as any).guestName || 'Airbnb'} - Réservation Airbnb` :
        (() => {
          const enriched = bookingData.booking as EnrichedBooking;
          if (enriched.realGuestNames && enriched.realGuestNames.length > 0) {
            const names = enriched.realGuestNames.join(', ');
            return `${names} - ${enriched.realGuestCount} invité(s)`;
          }
          const regular = bookingData.booking as Booking;
          return `${regular.guests[0]?.fullName || 'Client'} - ${regular.guests.length} invité(s)`;
        })()
      }
    >
      {bookingData.isStart && (
        <div className="flex items-center space-x-1 text-white w-full min-w-0">
          <Avatar className="h-4 w-4 border border-white flex-shrink-0">
            <AvatarFallback className="text-xs bg-white/20 text-white">
              {getGuestInitials(bookingData.booking)}
            </AvatarFallback>
          </Avatar>
          <span className="text-xs font-medium truncate">
            {getBookingDisplayText(bookingData.booking, true)}
          </span>
          {bookingData.isAirbnb && (
            <Home className="h-3 w-3 text-white/80 flex-shrink-0" />
          )}
        </div>
      )}
    </div>
  );
});
