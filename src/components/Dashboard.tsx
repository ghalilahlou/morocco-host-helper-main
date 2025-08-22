import { useState, useEffect } from 'react';
import { Plus, Search, Filter, RefreshCcw, Grid, CalendarDays } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { BookingCard } from './BookingCard';
import { CalendarView } from './CalendarView';
import { useBookings } from '@/hooks/useBookings';
import { Booking } from '@/types/booking';
import { EnrichedBooking } from '@/services/guestSubmissionService';

interface DashboardProps {
  onNewBooking: () => void;
  onEditBooking: (booking: Booking) => void;
  bookings?: EnrichedBooking[]; // Optional prop for filtered bookings
  onDeleteBooking?: (id: string) => Promise<void>; // Optional delete function
  onRefreshBookings?: () => void; // Optional refresh function
  propertyId?: string; // Added for Airbnb calendar integration
}

export const Dashboard = ({ 
  onNewBooking, 
  onEditBooking, 
  bookings: propBookings,
  onDeleteBooking,
  onRefreshBookings,
  propertyId
}: DashboardProps) => {
  const { bookings: allBookings, deleteBooking, refreshBookings } = useBookings();
  
  // Use prop bookings if provided, otherwise use all bookings
  const bookings = propBookings || allBookings;
  
  const handleDeleteBooking = onDeleteBooking || deleteBooking;
  const handleRefreshBookings = onRefreshBookings || refreshBookings;
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'cards' | 'calendar'>('calendar');
  
  // Refresh bookings when component mounts and periodically
  useEffect(() => {
    handleRefreshBookings();
    
  }, []);
  
  // Log bookings changes for debugging
  useEffect(() => {
    
  }, [bookings]);

  const filteredBookings = bookings.filter(booking => {
    // If no search term, show all bookings
    const matchesSearch = !searchTerm || 
                         booking.bookingReference?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         booking.guests.some(guest => guest.fullName.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchesStatus = statusFilter === 'all' || booking.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  const stats = {
    total: bookings.length,
    pending: bookings.filter(b => b.status === 'pending').length,
    completed: bookings.filter(b => b.status === 'completed').length,
    archived: bookings.filter(b => b.status === 'archived').length
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <h1 className="text-2xl md:text-3xl font-bold text-foreground">Tableau de bord</h1>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setViewMode('calendar')}
              data-tutorial="calendar"
              className="hover:bg-[hsl(var(--teal-hover))] hover:text-white"
            >
              <CalendarDays className="w-4 h-4 sm:mr-2" />
              <span className="hidden sm:inline">Calendrier</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setViewMode('cards')}
              className="hover:bg-[hsl(var(--teal-hover))] hover:text-white"
            >
              <Grid className="w-4 h-4 sm:mr-2" />
              <span className="hidden sm:inline">Cards</span>
            </Button>
            <Button
              onClick={handleRefreshBookings}
              variant="outline"
              size="sm"
              className="hover:bg-[hsl(var(--teal-hover))] hover:text-white"
            >
              <RefreshCcw className="w-4 h-4 sm:mr-2" />
              <span className="hidden sm:inline">Actualiser</span>
            </Button>
            <Button
              onClick={onNewBooking}
              variant="outline"
              size="sm"
              className="whitespace-nowrap hover:bg-[hsl(var(--teal-hover))] hover:text-white"
              data-tutorial="add-booking"
            >
              <Plus className="w-4 h-4 sm:mr-2" />
              <span className="hidden sm:inline">Nouvelle réservation</span>
            </Button>
          </div>
        </div>
        <p className="text-sm md:text-base text-muted-foreground mt-2">Gérez vos réservations et générez les documents obligatoires</p>
      </div>


      {/* Filters - Only show in cards view */}
      {viewMode === 'cards' && (
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
            <Input
              placeholder="Rechercher par référence ou nom du client..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full sm:w-48">
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
        </div>
      )}

      {/* Content - Cards or Calendar View */}
      {viewMode === 'cards' ? (
        filteredBookings.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-24 h-24 mx-auto mb-4 bg-muted rounded-full flex items-center justify-center">
              <Plus className="w-12 h-12 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold text-foreground mb-2">
              {bookings.length === 0 ? 'Aucune réservation' : 'Aucun résultat'}
            </h3>
            <p className="text-muted-foreground mb-4">
              {bookings.length === 0 
                ? 'Créez votre première réservation pour commencer à générer les documents obligatoires.'
                : 'Aucune réservation ne correspond à vos critères de recherche.'
              }
            </p>
            {bookings.length === 0 && (
              <Button onClick={onNewBooking} variant="professional">
                <Plus className="w-4 h-4 mr-2" />
                Créer une réservation
              </Button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredBookings.map((booking) => (
              <BookingCard
                key={booking.id}
                booking={booking}
                onEdit={onEditBooking}
                onDelete={handleDeleteBooking}
                onGenerateDocuments={onEditBooking}
              />
            ))}
          </div>
        )
      ) : (
        <div data-tutorial="calendar-view">
          <CalendarView
            bookings={bookings}
            onEditBooking={onEditBooking}
            propertyId={propertyId}
          />
        </div>
      )}
    </div>
  );
};