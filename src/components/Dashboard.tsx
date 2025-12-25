import { useState, useEffect, useMemo, memo, lazy, Suspense } from 'react';
import { Plus, Search, Filter, Grid, CalendarDays } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { BookingCard } from './BookingCard';
import { useBookings } from '@/hooks/useBookings';
import { Booking } from '@/types/booking';
import { EnrichedBooking } from '@/services/guestSubmissionService';
import { debug } from '@/lib/logger';
import { hasAllRequiredDocumentsForCalendar } from '@/utils/bookingDocuments';

// ✅ OPTIMISATION : Lazy loading pour CalendarView (composant lourd)
const CalendarView = lazy(() => import('./CalendarView'));


interface DashboardProps {
  onNewBooking: () => void;
  onEditBooking: (booking: Booking) => void;
  bookings?: EnrichedBooking[]; // Optional prop for filtered bookings
  onDeleteBooking?: (id: string) => Promise<void>; // Optional delete function
  onRefreshBookings?: () => void; // Optional refresh function
  propertyId?: string; // Added for Airbnb calendar integration
}

export const Dashboard = memo(({ 
  onNewBooking, 
  onEditBooking, 
  bookings: propBookings,
  onDeleteBooking,
  onRefreshBookings,
  propertyId
}: DashboardProps) => {
  // ✅ PHASE 1 : Passer propertyId pour filtrer les réservations
  const { bookings: allBookings, deleteBooking, refreshBookings } = useBookings({ propertyId });
  
  // Use prop bookings if provided, otherwise use all bookings
  const bookings = propBookings || allBookings;
  
  const handleDeleteBooking = onDeleteBooking || deleteBooking;
  const handleRefreshBookings = onRefreshBookings || refreshBookings;
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'cards' | 'calendar'>('calendar');
  
  // Refresh bookings when component mounts
  useEffect(() => {
    handleRefreshBookings();
  }, []);
  
  // Log bookings changes for debugging
  useEffect(() => {
    
  }, [bookings]);

  // 🚀 OPTIMISATION: Memoize filtered bookings pour éviter les re-calculs
  const filteredBookings = useMemo(() => {
    const filtered = bookings.filter(booking => {
      // ✅ FILTRE 1 : Exclure les réservations Airbnb ICS non terminées
      // Une réservation ICS non terminée est identifiée par :
      // - status = 'pending'
      // - bookingReference existe et n'est pas 'INDEPENDENT_BOOKING' (code Airbnb)
      // - Pas de guests complets (pas de fullName, documentNumber, nationality pour tous les guests)
      const isAirbnbICS = 'source' in booking && booking.source === 'airbnb';
      const hasBookingReference = booking.bookingReference && booking.bookingReference !== 'INDEPENDENT_BOOKING';
      const hasCompleteGuests = booking.guests && booking.guests.length > 0 && 
        booking.guests.every(guest => 
          guest.fullName && 
          guest.documentNumber && 
          guest.nationality
        );
      
      // ✅ Exclure les réservations ICS non terminées (pas de guests complets)
      const isICSReservationNotCompleted = !isAirbnbICS && 
        booking.status === 'pending' && 
        hasBookingReference && 
        !hasCompleteGuests;
      
      if (isICSReservationNotCompleted) {
        return false; // Exclure cette réservation
      }
      
      // ✅ FILTRE 2 : Dans la vue Cards, n'afficher que les réservations avec documents complets
      if (viewMode === 'cards') {
        // Vérifier que la réservation est completed ET a tous les documents requis
        if (booking.status === 'completed') {
          const hasAllDocs = hasAllRequiredDocumentsForCalendar(booking);
          if (!hasAllDocs) {
            return false; // Exclure si documents manquants
          }
        } else if (booking.status !== 'confirmed') {
          // Exclure les réservations qui ne sont ni completed ni confirmed
          return false;
        }
        // Pour 'confirmed', on affiche aussi (en cours de traitement)
      }
      
      // ✅ FILTRE 3 : Recherche par terme
      const matchesSearch = !searchTerm || 
                           booking.bookingReference?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           booking.guests.some(guest => guest.fullName.toLowerCase().includes(searchTerm.toLowerCase()));
      
      // ✅ FILTRE 4 : Filtre par statut
      const matchesStatus = statusFilter === 'all' || booking.status === statusFilter;
      
      return matchesSearch && matchesStatus;
    });
    
    // ✅ OPTIMISATION : Logs désactivés en production pour améliorer les performances
    if (import.meta.env.DEV) {
      debug('📋 [DASHBOARD] Réservations filtrées', {
        total: bookings.length,
        filtered: filtered.length,
        searchTerm,
        statusFilter,
        viewMode,
        excludedICS: bookings.filter(b => {
          const isAirbnbICS = 'source' in b && b.source === 'airbnb';
          const hasBookingReference = b.bookingReference && b.bookingReference !== 'INDEPENDENT_BOOKING';
          const hasCompleteGuests = b.guests && b.guests.length > 0 && 
            b.guests.every(guest => guest.fullName && guest.documentNumber && guest.nationality);
          return !isAirbnbICS && b.status === 'pending' && hasBookingReference && !hasCompleteGuests;
        }).length
      });
    }
    
    return filtered;
  }, [bookings, searchTerm, statusFilter, viewMode]);

  // 🚀 OPTIMISATION: Memoize stats pour éviter les re-calculs
  const stats = useMemo(() => ({
    total: bookings.length,
    pending: bookings.filter(b => b.status === 'pending').length,
    completed: bookings.filter(b => b.status === 'completed').length,
    archived: bookings.filter(b => b.status === 'archived').length
  }), [bookings]);

  // Écouter l'événement de création de réservation depuis CalendarHeader
  useEffect(() => {
    const handleCreateBooking = () => {
      onNewBooking();
    };
    window.addEventListener('create-booking-request', handleCreateBooking);
    return () => {
      window.removeEventListener('create-booking-request', handleCreateBooking);
    };
  }, [onNewBooking]);

  return (
    <div className="space-y-6">
      {/* Header Tableau de bord selon modèle Figma */}
      <div>
        <h1 className="text-2xl md:text-3xl font-bold text-black">Tableau de bord</h1>
        <p className="text-sm md:text-base text-gray-600 mt-2">
          Gérez vos réservations et générez les documents obligatoires
        </p>
      </div>

      {/* Navigation Tabs selon modèle Figma */}
      <div className="flex items-center gap-2">
            <Button
          variant={viewMode === 'calendar' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setViewMode('calendar')}
              data-tutorial="calendar"
          className={viewMode === 'calendar' ? 'bg-[#0BD9D0] hover:bg-[#0BD9D0]/90 text-white' : 'hover:bg-gray-100 border-gray-300'}
            >
          <CalendarDays className="w-4 h-4 mr-2" />
          Calendrier
            </Button>
            <Button
          variant={viewMode === 'cards' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setViewMode('cards')}
          className={viewMode === 'cards' ? 'bg-[#0BD9D0] hover:bg-[#0BD9D0]/90 text-white' : 'hover:bg-gray-100 border-gray-300'}
            >
          <Grid className="w-4 h-4 mr-2" />
          Cards
            </Button>
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
          <Suspense fallback={
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          }>
            <CalendarView
              bookings={bookings}
              onEditBooking={onEditBooking}
              propertyId={propertyId}
              onRefreshBookings={handleRefreshBookings}
            />
          </Suspense>
        </div>
      )}
    </div>
  );
});