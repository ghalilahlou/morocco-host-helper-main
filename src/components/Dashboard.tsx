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

import { useT } from '@/i18n/GuestLocaleProvider';
import { isAirbnbCode } from '@/utils/airbnbCodeFilter';

// ✅ OPTIMISATION : Lazy loading pour CalendarView (composant lourd)
const CalendarView = lazy(() => import('./CalendarView'));


interface DashboardProps {
  onNewBooking: () => void;
  onEditBooking: (booking: Booking) => void;
  bookings?: EnrichedBooking[];
  onDeleteBooking?: (id: string) => Promise<void>;
  onRefreshBookings?: () => void;
  propertyId?: string;
  airbnbIcsUrl?: string | null;
}

export const Dashboard = memo(({ 
  onNewBooking, 
  onEditBooking, 
  bookings: propBookings,
  onDeleteBooking,
  onRefreshBookings,
  propertyId,
  airbnbIcsUrl
}: DashboardProps) => {
  const t = useT();
  
  // When Dashboard is used inside PropertyDetail, bookings/callbacks come as props.
  // Only fall back to useBookings when used standalone (no props).
  const fallback = useBookings({ propertyId: propBookings ? undefined : propertyId });
  
  const bookings = propBookings || fallback.bookings;
  const handleDeleteBooking = onDeleteBooking || fallback.deleteBooking;
  const handleRefreshBookings = onRefreshBookings || fallback.refreshBookings;
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'cards' | 'calendar'>('calendar');
  
  // Bookings are already loaded by useBookings in the parent (PropertyDetail).
  // No need to trigger a redundant refresh here.

  // 🚀 OPTIMISATION: Memoize filtered bookings pour éviter les re-calculs
  const filteredBookings = useMemo(() => {
    const filtered = bookings.filter(booking => {
      // ✅ CORRIGÉ : Exclure les réservations ICS (codes Airbnb HM..., UID:...) de la vue Cards
      // Ces réservations sont gérées par le calendrier via calendarData.ts
      if (isAirbnbCode(booking.bookingReference)) {
        return false;
      }
      
      // ✅ FILTRE 3 : Recherche par terme
      const matchesSearch = !searchTerm || 
                           booking.bookingReference?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           (booking.guests || []).some(guest => guest?.fullName?.toLowerCase().includes(searchTerm.toLowerCase()));
      
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
        excludedICS: bookings.filter(b => isAirbnbCode(b.bookingReference)).length
      });
    }
    
    return filtered;
  }, [bookings, searchTerm, statusFilter, viewMode]);

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
        <h1 className="text-2xl md:text-3xl font-bold text-black">{t('dashboard.title')}</h1>
        <p className="text-sm md:text-base text-gray-600 mt-2">
          {t('dashboard.subtitle')}
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
          {t('dashboard.calendar')}
            </Button>
            <Button
          variant={viewMode === 'cards' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setViewMode('cards')}
          className={viewMode === 'cards' ? 'bg-[#0BD9D0] hover:bg-[#0BD9D0]/90 text-white' : 'hover:bg-gray-100 border-gray-300'}
            >
          <Grid className="w-4 h-4 mr-2" />
          {t('dashboard.cards')}
            </Button>
      </div>

      {/* Filters - Only show in cards view */}
      {viewMode === 'cards' && (
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
            <Input
              placeholder={t('dashboard.searchPlaceholder')}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full sm:w-48">
              <Filter className="w-4 h-4 mr-2" />
              <SelectValue placeholder={t('dashboard.filterByStatus')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('dashboard.allStatuses')}</SelectItem>
              <SelectItem value="pending">{t('dashboard.pending')}</SelectItem>
              <SelectItem value="completed">{t('dashboard.completedPlural')}</SelectItem>
              <SelectItem value="archived">{t('dashboard.archived')}</SelectItem>
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
              {bookings.length === 0 ? t('dashboard.noBooking') : t('dashboard.noResult')}
            </h3>
            <p className="text-muted-foreground mb-4">
              {bookings.length === 0 
                ? t('dashboard.createFirst')
                : t('dashboard.noMatch')
              }
            </p>
            {bookings.length === 0 && (
              <Button onClick={onNewBooking} variant="professional">
                <Plus className="w-4 h-4 mr-2" />
                {t('dashboard.createBooking')}
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
              airbnbIcsUrl={airbnbIcsUrl}
            />
          </Suspense>
        </div>
      )}
    </div>
  );
});