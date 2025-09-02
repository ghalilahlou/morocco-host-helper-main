import { useState, useEffect, useMemo, memo } from 'react';
import { Plus, Search, Filter, RefreshCcw, Grid, CalendarDays } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { MobileBookingCard } from './mobile/MobileBookingCard';
import { MobileNavigation } from './mobile/MobileNavigation';
import { MobileLayout } from './mobile/MobileLayout';
import { CalendarView } from './CalendarView';
import { useBookings } from '@/hooks/useBookings';
import { Booking } from '@/types/booking';
import { EnrichedBooking } from '@/services/guestSubmissionService';
import { motion, AnimatePresence } from 'framer-motion';

interface MobileDashboardProps {
  onNewBooking: () => void;
  onEditBooking: (booking: Booking) => void;
  bookings?: EnrichedBooking[];
  onDeleteBooking?: (id: string) => Promise<void>;
  onRefreshBookings?: () => void;
  propertyId?: string;
}

export const MobileDashboard = memo(({ 
  onNewBooking, 
  onEditBooking, 
  bookings: propBookings,
  onDeleteBooking,
  onRefreshBookings,
  propertyId
}: MobileDashboardProps) => {
  const { bookings: allBookings, deleteBooking, refreshBookings } = useBookings();
  
  const bookings = propBookings || allBookings;
  const handleDeleteBooking = onDeleteBooking || deleteBooking;
  const handleRefreshBookings = onRefreshBookings || refreshBookings;
  
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'cards' | 'calendar'>('cards');
  const [currentPage, setCurrentPage] = useState('dashboard');

  useEffect(() => {
    handleRefreshBookings();
  }, []);

  const filteredBookings = useMemo(() => {
    return bookings.filter(booking => {
      const matchesSearch = !searchTerm || 
                           booking.bookingReference?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           booking.guests.some(guest => guest.fullName.toLowerCase().includes(searchTerm.toLowerCase()));
      
      const matchesStatus = statusFilter === 'all' || booking.status === statusFilter;
      
      return matchesSearch && matchesStatus;
    });
  }, [bookings, searchTerm, statusFilter]);

  const stats = useMemo(() => ({
    total: bookings.length,
    pending: bookings.filter(b => b.status === 'pending').length,
    completed: bookings.filter(b => b.status === 'completed').length,
    archived: bookings.filter(b => b.status === 'archived').length
  }), [bookings]);

  return (
    <>
      <MobileNavigation 
        currentPage={currentPage}
        onNavigate={setCurrentPage}
        onNewBooking={onNewBooking}
      />
      
      <MobileLayout title="Tableau de bord">
        {/* Stats Cards - Mobile Optimized */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-xl p-4 shadow-sm border border-gray-200"
          >
            <div className="text-2xl font-bold text-blue-600">{stats.total}</div>
            <div className="text-sm text-gray-600">Total</div>
          </motion.div>
          
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-white rounded-xl p-4 shadow-sm border border-gray-200"
          >
            <div className="text-2xl font-bold text-yellow-600">{stats.pending}</div>
            <div className="text-sm text-gray-600">En attente</div>
          </motion.div>
        </div>

        {/* View Toggle - Mobile */}
        <div className="flex space-x-2 mb-4">
          <Button
            variant={viewMode === 'cards' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setViewMode('cards')}
            className="flex-1"
          >
            <Grid className="w-4 h-4 mr-2" />
            Cartes
          </Button>
          <Button
            variant={viewMode === 'calendar' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setViewMode('calendar')}
            className="flex-1"
          >
            <CalendarDays className="w-4 h-4 mr-2" />
            Calendrier
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefreshBookings}
            className="px-3"
          >
            <RefreshCcw className="w-4 h-4" />
          </Button>
        </div>

        {/* Filters - Mobile Optimized */}
        {viewMode === 'cards' && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="space-y-3 mb-6"
          >
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <Input
                placeholder="Rechercher..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 h-12"
              />
            </div>
            
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="h-12">
                <Filter className="w-4 h-4 mr-2" />
                <SelectValue placeholder="Filtrer par statut" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les statuts</SelectItem>
                <SelectItem value="pending">En attente</SelectItem>
                <SelectItem value="completed">Terminées</SelectItem>
                <SelectItem value="archived">Archivées</SelectItem>
              </SelectContent>
            </Select>
          </motion.div>
        )}

        {/* Content */}
        <AnimatePresence mode="wait">
          {viewMode === 'cards' ? (
            <motion.div
              key="cards"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              {filteredBookings.length === 0 ? (
                <div className="text-center py-12">
                  <div className="w-20 h-20 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center">
                    <Plus className="w-10 h-10 text-gray-400" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">
                    {bookings.length === 0 ? 'Aucune réservation' : 'Aucun résultat'}
                  </h3>
                  <p className="text-gray-600 mb-6 px-4">
                    {bookings.length === 0 
                      ? 'Créez votre première réservation pour commencer.'
                      : 'Aucune réservation ne correspond à vos critères.'
                    }
                  </p>
                  {bookings.length === 0 && (
                    <Button 
                      onClick={onNewBooking} 
                      className="w-full max-w-xs h-12"
                    >
                      <Plus className="w-5 h-5 mr-2" />
                      Créer une réservation
                    </Button>
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  {filteredBookings.map((booking, index) => (
                    <motion.div
                      key={booking.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.05 }}
                    >
                      <MobileBookingCard
                        booking={booking}
                        onEdit={onEditBooking}
                        onDelete={handleDeleteBooking}
                        onGenerateDocuments={onEditBooking}
                      />
                    </motion.div>
                  ))}
                </div>
              )}
            </motion.div>
          ) : (
            <motion.div
              key="calendar"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="-mx-4"
            >
              <CalendarView
                bookings={bookings}
                onEditBooking={onEditBooking}
                propertyId={propertyId}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </MobileLayout>
    </>
  );
});
