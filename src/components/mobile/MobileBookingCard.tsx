import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Calendar, 
  Users, 
  MapPin, 
  Phone, 
  Mail, 
  MoreVertical,
  Edit,
  Trash2,
  FileText,
  Download,
  Eye,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

interface MobileBookingCardProps {
  booking: any;
  onEdit?: (booking: any) => void;
  onDelete?: (id: string) => void;
  onViewDocuments?: (booking: any) => void;
  onGenerateDocuments?: (booking: any) => void;
}

export const MobileBookingCard = ({ 
  booking, 
  onEdit, 
  onDelete, 
  onViewDocuments,
  onGenerateDocuments 
}: MobileBookingCardProps) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showActions, setShowActions] = useState(false);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'confirmed': return 'bg-green-100 text-green-800 border-green-200';
      case 'pending': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'cancelled': return 'bg-red-100 text-red-800 border-red-200';
      case 'completed': return 'bg-blue-100 text-blue-800 border-blue-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'confirmed': return 'Confirmée';
      case 'pending': return 'En attente';
      case 'cancelled': return 'Annulée';
      case 'completed': return 'Terminée';
      default: return status;
    }
  };

  const primaryGuest = booking.guests?.[0];
  const guestCount = booking.guests?.length || booking.number_of_guests || 1;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="w-full"
    >
      <Card className="overflow-hidden shadow-md hover:shadow-lg transition-shadow duration-200">
        {/* Header */}
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div className="flex-1 min-w-0">
              <div className="flex items-center space-x-2 mb-2">
                <h3 className="font-semibold text-gray-900 truncate text-lg">
                  {primaryGuest?.full_name || 
                   booking.guest_name || 
                   booking.guestName || 
                   'Réservation sans nom'}
                </h3>
                <Badge className={`text-xs ${getStatusColor(booking.status)}`}>
                  {getStatusLabel(booking.status)}
                </Badge>
              </div>
              
              {/* Dates */}
              <div className="flex items-center text-sm text-gray-600 mb-1">
                <Calendar className="w-4 h-4 mr-2 flex-shrink-0" />
                <span className="truncate">
                  {format(new Date(booking.check_in_date), 'dd MMM', { locale: fr })} - {' '}
                  {format(new Date(booking.check_out_date), 'dd MMM yyyy', { locale: fr })}
                </span>
              </div>
              
              {/* Guests */}
              <div className="flex items-center text-sm text-gray-600">
                <Users className="w-4 h-4 mr-2 flex-shrink-0" />
                <span>{guestCount} invité{guestCount > 1 ? 's' : ''}</span>
              </div>
            </div>

            {/* Actions Button */}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowActions(!showActions)}
              className="h-8 w-8 flex-shrink-0"
            >
              <MoreVertical className="w-4 h-4" />
            </Button>
          </div>
        </CardHeader>

        {/* Quick Actions */}
        <AnimatePresence>
          {showActions && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
              className="border-t border-gray-100 bg-gray-50"
            >
              <div className="p-3 grid grid-cols-2 gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onEdit?.(booking)}
                  className="h-10 justify-start"
                >
                  <Edit className="w-4 h-4 mr-2" />
                  Modifier
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onViewDocuments?.(booking)}
                  className="h-10 justify-start"
                >
                  <Eye className="w-4 h-4 mr-2" />
                  Voir docs
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onGenerateDocuments?.(booking)}
                  className="h-10 justify-start"
                >
                  <FileText className="w-4 h-4 mr-2" />
                  Générer
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onDelete?.(booking.id)}
                  className="h-10 justify-start text-red-600 hover:text-red-700"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Supprimer
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Expandable Content */}
        <CardContent className="pt-0">
          <Button
            variant="ghost"
            onClick={() => setIsExpanded(!isExpanded)}
            className="w-full justify-between p-0 h-8 text-sm text-gray-600 hover:text-gray-900"
          >
            <span>Détails</span>
            {isExpanded ? (
              <ChevronUp className="w-4 h-4" />
            ) : (
              <ChevronDown className="w-4 h-4" />
            )}
          </Button>

          <AnimatePresence>
            {isExpanded && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2 }}
                className="mt-3 space-y-3"
              >
                {/* Guest Details */}
                {primaryGuest && (
                  <div className="space-y-2">
                    <h4 className="font-medium text-gray-900 text-sm">Informations client</h4>
                    <div className="space-y-1 text-sm text-gray-600">
                      {primaryGuest.nationality && (
                        <div className="flex items-center">
                          <MapPin className="w-3 h-3 mr-2" />
                          <span>{primaryGuest.nationality}</span>
                        </div>
                      )}
                      {primaryGuest.document_number && (
                        <div className="flex items-center">
                          <FileText className="w-3 h-3 mr-2" />
                          <span>Doc: {primaryGuest.document_number}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Additional Guests */}
                {booking.guests && booking.guests.length > 1 && (
                  <div className="space-y-2">
                    <h4 className="font-medium text-gray-900 text-sm">
                      Autres invités ({booking.guests.length - 1})
                    </h4>
                    <div className="space-y-1">
                      {booking.guests.slice(1).map((guest: any, index: number) => (
                        <div key={index} className="text-sm text-gray-600">
                          {guest.full_name}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Booking Reference */}
                {booking.booking_reference && (
                  <div className="text-xs text-gray-500 font-mono">
                    Ref: {booking.booking_reference}
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </CardContent>
      </Card>
    </motion.div>
  );
};
