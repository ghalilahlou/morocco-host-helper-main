import React, { memo, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Calendar, MapPin, Users, Eye } from 'lucide-react';
import { Booking } from '@/types/booking';
import { formatBookingDate, calculateNights } from '@/services/bookingResolve';

interface BookingCardProps {
  booking: Booking;
  onViewDetails: (booking: Booking) => void;
  onEdit?: (booking: Booking) => void;
}

// Composant optimisé avec React.memo
export const BookingCard = memo<BookingCardProps>(({ 
  booking, 
  onViewDetails, 
  onEdit 
}) => {
  // Mémorisation des calculs coûteux
  const bookingInfo = useMemo(() => ({
    nights: calculateNights(booking.checkIn, booking.checkOut),
    formattedCheckIn: formatBookingDate(booking.checkIn),
    formattedCheckOut: formatBookingDate(booking.checkOut),
    statusColor: getStatusColor(booking.status)
  }), [booking.checkIn, booking.checkOut, booking.status]);

  const statusBadge = useMemo(() => {
    switch (booking.status) {
      case 'completed':
        return <Badge variant="default" className="bg-success text-success-foreground">Terminé</Badge>;
      case 'pending':
        return <Badge variant="secondary">En attente</Badge>;
      case 'archived':
        return <Badge variant="outline">Archivé</Badge>;
      default:
        return <Badge variant="secondary">En attente</Badge>;
    }
  }, [booking.status]);

  return (
    <Card className="hover:shadow-lg transition-shadow duration-200">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold">
            {booking.property.name}
          </CardTitle>
          {statusBadge}
        </div>
      </CardHeader>
      
      <CardContent className="space-y-3">
        <div className="flex items-center text-sm text-muted-foreground">
          <Calendar className="w-4 h-4 mr-2" />
          <span>{bookingInfo.formattedCheckIn} - {bookingInfo.formattedCheckOut}</span>
          <span className="ml-2">({bookingInfo.nights} nuit{bookingInfo.nights > 1 ? 's' : ''})</span>
        </div>
        
        <div className="flex items-center text-sm text-muted-foreground">
          <MapPin className="w-4 h-4 mr-2" />
          <span>{booking.property.address}</span>
        </div>
        
        <div className="flex items-center text-sm text-muted-foreground">
          <Users className="w-4 h-4 mr-2" />
          <span>{booking.guests.length} invité{booking.guests.length > 1 ? 's' : ''}</span>
        </div>
        
        <div className="flex gap-2 pt-2">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => onViewDetails(booking)}
            className="flex-1"
          >
            <Eye className="w-4 h-4 mr-1" />
            Voir détails
          </Button>
          {onEdit && (
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => onEdit(booking)}
            >
              Modifier
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
});

// Fonction helper mémorisée
const getStatusColor = (status: string) => {
  switch (status) {
    case 'completed': return 'text-green-600';
    case 'pending': return 'text-yellow-600';
    case 'archived': return 'text-gray-600';
    default: return 'text-gray-600';
  }
};

BookingCard.displayName = 'BookingCard';

