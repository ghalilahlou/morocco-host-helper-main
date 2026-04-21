import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Booking } from '@/types/booking';
import { AirbnbReservation } from '@/services/airbnbSyncService';
import { getBookingDisplayTitle } from '@/utils/bookingDisplay';
import { formatLocalDate, parseStayDateForCalendar } from '@/utils/dateUtils';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';

interface ConflictDetail {
  id1: string;
  id2: string;
  name1: string;
  name2: string;
  start1: string;
  end1: string;
  start2: string;
  end2: string;
}

interface ConflictModalProps {
  isOpen: boolean;
  onClose: () => void;
  conflictDetails: ConflictDetail[];
  allReservations: (Booking | AirbnbReservation)[];
  /** Ouvre la fiche réservation (même flux que le calendrier). */
  onSelectBooking: (booking: Booking | AirbnbReservation) => void;
}

export const ConflictModal: React.FC<ConflictModalProps> = ({
  isOpen,
  onClose,
  conflictDetails,
  allReservations,
  onSelectBooking,
}) => {
  const isMobile = useIsMobile();

  const conflictReservations = React.useMemo(() => {
    const reservationMap = new Map<
      string,
      {
        booking: Booking | AirbnbReservation;
        conflicts: ConflictDetail[];
      }
    >();

    conflictDetails.forEach((conflict) => {
      const booking1 = allReservations.find((r) => r.id === conflict.id1);
      if (booking1) {
        if (!reservationMap.has(conflict.id1)) {
          reservationMap.set(conflict.id1, { booking: booking1, conflicts: [] });
        }
        reservationMap.get(conflict.id1)!.conflicts.push(conflict);
      }

      const booking2 = allReservations.find((r) => r.id === conflict.id2);
      if (booking2) {
        if (!reservationMap.has(conflict.id2)) {
          reservationMap.set(conflict.id2, { booking: booking2, conflicts: [] });
        }
        reservationMap.get(conflict.id2)!.conflicts.push(conflict);
      }
    });

    return Array.from(reservationMap.values());
  }, [conflictDetails, allReservations]);

  const formatDateRange = (start: string, end: string) => {
    try {
      const startStr = formatLocalDate(parseStayDateForCalendar(start));
      const endStr = formatLocalDate(parseStayDateForCalendar(end));

      const formatDate = (dateStr: string) => {
        const [year, month, day] = dateStr.split('-');
        return `${day}/${month}/${year}`;
      };

      return `${formatDate(startStr)} - ${formatDate(endStr)}`;
    } catch {
      return `${start} - ${end}`;
    }
  };

  if (conflictReservations.length === 0) {
    return null;
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent
        className={cn(
          'sm:max-w-md',
          isMobile && [
            '!inset-x-3 !inset-y-auto !left-3 !right-3 !top-[max(0.75rem,6svh)] !bottom-auto',
            '!h-auto !max-h-[min(85dvh,560px)] !w-auto !max-w-none',
            '!translate-x-0 !translate-y-0 !rounded-2xl !m-0 !p-4',
            'overflow-y-auto border-destructive/20 shadow-xl',
          ],
        )}
      >
        <DialogHeader>
          <DialogTitle className={cn('text-lg font-bold', isMobile && 'text-base')}>Conflit de dates</DialogTitle>
          <DialogDescription className={cn('text-sm text-gray-600 mt-2', isMobile && 'text-xs')}>
            Plusieurs réservations validées se chevauchent. Aucune action n’est obligatoire ici : ouvrez une fiche pour
            corriger les dates ou retirer un doublon si vous le souhaitez.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2 mt-4">
          {conflictReservations.map(({ booking }) => {
            const displayName = getBookingDisplayTitle(booking);
            const isAirbnb = 'source' in booking && booking.source === 'airbnb';

            const startDate = isAirbnb
              ? formatLocalDate((booking as AirbnbReservation).startDate)
              : (booking as Booking).checkInDate;

            const endDate = isAirbnb
              ? formatLocalDate((booking as AirbnbReservation).endDate)
              : (booking as Booking).checkOutDate;

            const dateRange = formatDateRange(startDate, endDate);

            return (
              <button
                key={booking.id}
                type="button"
                className={cn(
                  'flex w-full flex-col items-start rounded-lg border border-gray-200 p-3 text-left transition-colors',
                  'hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-primary/20',
                  isMobile && 'p-2.5',
                )}
                onClick={() => {
                  onSelectBooking(booking);
                  onClose();
                }}
              >
                <span className={cn('font-semibold text-gray-900 truncate w-full', isMobile && 'text-sm')}>
                  {displayName}
                </span>
                <span className={cn('text-sm text-gray-600 mt-0.5', isMobile && 'text-xs')}>{dateRange}</span>
                <span className="mt-1 text-[11px] font-medium text-primary">Voir la fiche →</span>
              </button>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
};
