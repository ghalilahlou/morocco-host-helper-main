import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';
import { Booking } from '@/types/booking';
import { AirbnbReservation } from '@/services/airbnbSyncService';
import { getUnifiedBookingDisplayText } from '@/utils/bookingDisplay';
import { formatLocalDate } from '@/utils/dateUtils';
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
  onDeleteBooking: (id: string) => Promise<void>;
}

export const ConflictModal: React.FC<ConflictModalProps> = ({
  isOpen,
  onClose,
  conflictDetails,
  allReservations,
  onDeleteBooking,
}) => {
  const isMobile = useIsMobile();
  const [deletingIds, setDeletingIds] = React.useState<Set<string>>(new Set());

  // Grouper les conflits par réservation pour afficher toutes les réservations en conflit
  const conflictReservations = React.useMemo(() => {
    const reservationMap = new Map<string, {
      booking: Booking | AirbnbReservation;
      conflicts: ConflictDetail[];
    }>();

    conflictDetails.forEach(conflict => {
      // Ajouter la première réservation
      const booking1 = allReservations.find(r => r.id === conflict.id1);
      if (booking1) {
        if (!reservationMap.has(conflict.id1)) {
          reservationMap.set(conflict.id1, { booking: booking1, conflicts: [] });
        }
        reservationMap.get(conflict.id1)!.conflicts.push(conflict);
      }

      // Ajouter la deuxième réservation
      const booking2 = allReservations.find(r => r.id === conflict.id2);
      if (booking2) {
        if (!reservationMap.has(conflict.id2)) {
          reservationMap.set(conflict.id2, { booking: booking2, conflicts: [] });
        }
        reservationMap.get(conflict.id2)!.conflicts.push(conflict);
      }
    });

    return Array.from(reservationMap.values());
  }, [conflictDetails, allReservations]);

  const handleDelete = async (id: string) => {
    if (deletingIds.has(id)) return;
    
    setDeletingIds(prev => new Set(prev).add(id));
    try {
      await onDeleteBooking(id);
      // Si c'était la dernière réservation en conflit, fermer la modale
      if (conflictReservations.length === 1) {
        onClose();
      }
    } catch (error) {
      console.error('Error deleting booking:', error);
    } finally {
      setDeletingIds(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  const formatDateRange = (start: string, end: string) => {
    try {
      const startDate = new Date(start);
      const endDate = new Date(end);
      const startStr = formatLocalDate(startDate);
      const endStr = formatLocalDate(endDate);
      
      // Format: DD/MM/YYYY - DD/MM/YYYY
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
          "sm:max-w-md",
          isMobile && "max-w-[calc(100vw-2rem)] mx-4"
        )}
      >
        <DialogHeader>
          <DialogTitle className={cn(
            "text-lg font-bold",
            isMobile && "text-base"
          )}>
            Vous avez un conflit sur cette période.
          </DialogTitle>
          <DialogDescription className={cn(
            "text-sm text-gray-600 mt-2",
            isMobile && "text-xs"
          )}>
            Veuillez supprimer les réservations en trop
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 mt-4">
          {conflictReservations.map(({ booking, conflicts }) => {
            const displayName = getUnifiedBookingDisplayText(booking, true);
            const isAirbnb = 'source' in booking && booking.source === 'airbnb';
            
            const startDate = isAirbnb
              ? formatLocalDate((booking as AirbnbReservation).startDate)
              : (booking as Booking).checkInDate;
            
            const endDate = isAirbnb
              ? formatLocalDate((booking as AirbnbReservation).endDate)
              : (booking as Booking).checkOutDate;
            
            const dateRange = formatDateRange(startDate, endDate);
            const isDeleting = deletingIds.has(booking.id);

            return (
              <div
                key={booking.id}
                className={cn(
                  "flex items-center justify-between p-3 rounded-lg border border-gray-200",
                  isDeleting && "opacity-50"
                )}
              >
                <div className="flex-1 min-w-0">
                  <div className={cn(
                    "font-semibold text-gray-900 truncate",
                    isMobile && "text-sm"
                  )}>
                    {displayName}
                  </div>
                  <div className={cn(
                    "text-sm text-gray-600 mt-0.5",
                    isMobile && "text-xs"
                  )}>
                    {dateRange}
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleDelete(booking.id)}
                  disabled={isDeleting}
                  className={cn(
                    "ml-2 h-8 w-8 flex-shrink-0 text-gray-500 hover:text-red-600 hover:bg-red-50",
                    isMobile && "h-7 w-7"
                  )}
                  aria-label={`Supprimer ${displayName}`}
                >
                  <X className={cn(
                    "h-4 w-4",
                    isMobile && "h-3.5 w-3.5"
                  )} />
                </Button>
              </div>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
};

