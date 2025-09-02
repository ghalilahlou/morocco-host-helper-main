import { useState, useEffect, useCallback, useMemo, memo } from 'react';
import { AlertTriangle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Booking } from '@/types/booking';
import { EnrichedBooking } from '@/services/guestSubmissionService';
import { BookingDetailsModal } from './BookingDetailsModal';
import { CalendarHeader } from './calendar/CalendarHeader';
import { CalendarGrid } from './calendar/CalendarGrid';

import { AirbnbReservationModal } from './AirbnbReservationModal';
import { 
  generateCalendarDays, 
  calculateBookingLayout, 
  detectBookingConflicts 
} from './calendar/CalendarUtils';
import { AirbnbSyncService, AirbnbReservation } from '@/services/airbnbSyncService';
import { AirbnbEdgeFunctionService } from '@/services/airbnbEdgeFunctionService';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface CalendarViewProps {
  bookings: EnrichedBooking[];
  onEditBooking: (booking: Booking) => void;
  propertyId?: string; // Added to fetch Airbnb reservations
}

// 🚀 OPTIMISATION: Cache intelligent avec TTL et limite de taille
class AirbnbCache {
  private cache = new Map<string, { data: AirbnbReservation[], timestamp: number }>();
  private readonly CACHE_DURATION = 30000; // 30 seconds
  private readonly MAX_ENTRIES = 50; // Limite pour éviter les fuites mémoire

  get(key: string) {
    const entry = this.cache.get(key);
    if (!entry) return null;
    
    // Vérifier l'expiration
    if (Date.now() - entry.timestamp > this.CACHE_DURATION) {
      this.cache.delete(key);
      return null;
    }
    
    return entry;
  }

  set(key: string, data: AirbnbReservation[]) {
    // Nettoyer les entrées expirées si on atteint la limite
    if (this.cache.size >= this.MAX_ENTRIES) {
      this.cleanup();
    }
    
    this.cache.set(key, { data, timestamp: Date.now() });
  }

  delete(key: string) {
    this.cache.delete(key);
  }

  private cleanup() {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > this.CACHE_DURATION) {
        this.cache.delete(key);
      }
    }
    
    // Si toujours trop d'entrées, supprimer les plus anciennes
    if (this.cache.size >= this.MAX_ENTRIES) {
      const entries = Array.from(this.cache.entries())
        .sort((a, b) => a[1].timestamp - b[1].timestamp);
      
      const toDelete = entries.slice(0, this.cache.size - this.MAX_ENTRIES + 10);
      toDelete.forEach(([key]) => this.cache.delete(key));
    }
  }

  clear() {
    this.cache.clear();
  }
}

const airbnbCache = new AirbnbCache();

export const CalendarView = memo(({ bookings, onEditBooking, propertyId }: CalendarViewProps) => {
  const navigate = useNavigate();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedBooking, setSelectedBooking] = useState<EnrichedBooking | null>(null);
  const [selectedAirbnbReservation, setSelectedAirbnbReservation] = useState<AirbnbReservation | null>(null);
  const [airbnbReservations, setAirbnbReservations] = useState<AirbnbReservation[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'success' | 'error'>('idle');
  const [lastSyncDate, setLastSyncDate] = useState<Date | undefined>();
  const [matchedBookings, setMatchedBookings] = useState<string[]>([]);
const [syncConflicts, setSyncConflicts] = useState<string[]>([]);
const [icsUrl, setIcsUrl] = useState<string | null>(null);
const [hasIcs, setHasIcs] = useState(false);
  const { toast } = useToast();

  
  // Optimized load function with caching
  const loadAirbnbReservations = useCallback(async () => {
    if (!propertyId) return;
    
    // Check cache first
    const cached = airbnbCache.get(propertyId);
    if (cached) {
      setAirbnbReservations(cached.data);
      return;
    }
    
    try {
      const dbReservations = await AirbnbEdgeFunctionService.getReservations(propertyId);
      
      // Convert database reservations to AirbnbReservation format
      const formattedReservations: AirbnbReservation[] = dbReservations.map(r => ({
        id: r.id,
        summary: r.summary,
        startDate: new Date(r.start_date),
        endDate: new Date(r.end_date),
        description: r.description || '',
        guestName: r.guest_name || undefined,
        numberOfGuests: r.number_of_guests || undefined,
        airbnbBookingId: r.airbnb_booking_id,
        rawEvent: (r.raw_event_data as any)?.rawEvent || '',
        source: 'airbnb' as any
      }));
      
      // Cache the data
      airbnbCache.set(propertyId, formattedReservations);
      
      setAirbnbReservations(formattedReservations);
      
      // Toujours récupérer le statut de sync en base
      const status = await AirbnbEdgeFunctionService.getSyncStatus(propertyId);
      if (status) {
        if (status.last_sync_at) {
          setLastSyncDate(new Date(status.last_sync_at));
        } else {
          setLastSyncDate(undefined);
        }
        if (status.sync_status === 'success' || formattedReservations.length > 0) {
          setSyncStatus('success');
        } else if (status.sync_status === 'syncing') {
          setSyncStatus('syncing');
        } else if (status.sync_status === 'error') {
          setSyncStatus('error');
        } else {
          setSyncStatus('idle');
        }
      }
    } catch (error) {
      console.error('Error loading Airbnb reservations:', error);
    }
  }, [propertyId]);

  // Charger les réservations et le statut au chargement
  useEffect(() => {
    loadAirbnbReservations();
  }, [loadAirbnbReservations]);

useEffect(() => {
  if (!propertyId) {
    setIcsUrl(null);
    setHasIcs(false);
    return;
  }
  (async () => {
    const { data, error } = await supabase
      .from('properties')
      .select('airbnb_ics_url')
      .eq('id', propertyId)
      .single();
    if (!error) {
      setIcsUrl(data?.airbnb_ics_url || null);
      setHasIcs(!!data?.airbnb_ics_url);
    }
  })();
}, [propertyId]);

// Debounced real-time update handler
  const debouncedReload = useCallback(() => {
    // Clear cache and reload
    airbnbCache.delete(propertyId || '');
    loadAirbnbReservations();
  }, [loadAirbnbReservations, propertyId]);

  // Single optimized real-time subscription
  useEffect(() => {
    if (!propertyId) return;

    const channel = supabase
      .channel(`calendar-${propertyId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'airbnb_reservations',
          filter: `property_id=eq.${propertyId}`
        },
        debouncedReload
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [propertyId, debouncedReload]);

  const handleBookingClick = useCallback((booking: Booking | AirbnbReservation) => {
    // Check if it's an Airbnb reservation
    if ('source' in booking && booking.source === 'airbnb') {
      const airbnbRes = booking as unknown as AirbnbReservation;
      setSelectedAirbnbReservation(airbnbRes);
      return;
    }
    
    // Regular booking
    setSelectedBooking(booking as EnrichedBooking);
  }, []);

  // Handle sync from calendar button - VERSION CORRIGÉE
  const handleSyncFromCalendar = useCallback(async () => {
    if (!propertyId) return;
    
    try {
      setIsSyncing(true);
      
      // Get property data to find ICS URL
      const { data: property, error } = await supabase
        .from('properties')
        .select('airbnb_ics_url')
        .eq('id', propertyId)
        .single();

      if (error || !property?.airbnb_ics_url) {
        // Au lieu de rediriger, juste afficher un message
        toast({
          title: "Configuration requise",
          description: "Configurez l'URL de votre calendrier Airbnb pour activer la synchronisation.",
          variant: "default"
        });
        setIsSyncing(false);
        return;
      }

      // Call the sync service
      const result = await AirbnbEdgeFunctionService.syncReservations(propertyId, property.airbnb_ics_url);
      
      if (result.success) {
        // Silent success on mobile, only show on desktop
        if (window.innerWidth >= 768) {
          toast({
            title: "Synchronisation réussie",
            description: `${result.count || 0} réservations synchronisées.`
          });
        }
        
        // Reload reservations
        const updatedReservations = await AirbnbEdgeFunctionService.getReservations(propertyId);
        const formattedReservations = updatedReservations.map(r => ({
          id: r.id,
          summary: r.summary,
          startDate: new Date(r.start_date),
          endDate: new Date(r.end_date),
          description: r.description || '',
          guestName: r.guest_name || undefined,
          numberOfGuests: r.number_of_guests || undefined,
          airbnbBookingId: r.airbnb_booking_id,
          rawEvent: (r.raw_event_data as any)?.rawEvent || '',
          source: 'airbnb' as any
        }));
        setAirbnbReservations(formattedReservations);
        setSyncStatus('success');
        setLastSyncDate(new Date());
      } else {
        toast({
          title: "Erreur de synchronisation",
          description: result.error || "Impossible de synchroniser.",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('Sync error:', error);
      toast({
        title: "Erreur de synchronisation",
        description: "Une erreur inattendue s'est produite.",
        variant: "destructive"
      });
    } finally {
      setIsSyncing(false);
    }
  }, [propertyId, navigate, toast, loadAirbnbReservations]);

const handleOpenConfig = useCallback(() => {
  if (propertyId) {
    navigate(`/help/airbnb-sync/${propertyId}`);
  }
}, [navigate, propertyId]);

// Auto-sync à chaque accès au calendrier
  useEffect(() => {
    if (!propertyId) return;
    handleSyncFromCalendar();
  }, [propertyId, handleSyncFromCalendar]);

  const getColorOverrides = useMemo(() => {
    const overrides: { [key: string]: string } = {};
    
    // ÉTAPE 1: Détecter les matchs entre réservations manuelles et Airbnb
    const updatedMatchedBookings: string[] = [];
    const updatedSyncConflicts: string[] = [];
    
    // Parcourir chaque réservation manuelle
    bookings.forEach(booking => {
      const manualStart = new Date(booking.checkInDate);
      const manualEnd = new Date(booking.checkOutDate);
      
      // Chercher si elle matche avec une réservation Airbnb
      const matchingAirbnb = airbnbReservations.find(airbnb => {
        const airbnbStart = airbnb.startDate;
        const airbnbEnd = airbnb.endDate;
        
        // Dates exactement identiques OU référence qui matche
        const datesMatch = manualStart.getTime() === airbnbStart.getTime() && 
                          manualEnd.getTime() === airbnbEnd.getTime();
        const refsMatch = booking.bookingReference && airbnb.airbnbBookingId && 
                         (booking.bookingReference.includes(airbnb.airbnbBookingId) || 
                          airbnb.airbnbBookingId.includes(booking.bookingReference));
        
        return datesMatch || refsMatch;
      });
      
      if (matchingAirbnb) {
        updatedMatchedBookings.push(booking.id);
        console.log(`✅ Match trouvé: Booking ${booking.id} <-> Airbnb ${matchingAirbnb.id}`);
      }
    });
    
    // ÉTAPE 2: Appliquer les couleurs selon la nouvelle logique
    bookings.forEach(booking => {
      overrides[booking.id] = AirbnbSyncService.getBookingStatusColor(
        booking,
        updatedMatchedBookings,
        updatedSyncConflicts
      );
    });

    // ÉTAPE 3: Les réservations Airbnb qui ont un match ne doivent PAS apparaître
    // (elles sont remplacées par les réservations manuelles vertes)
    airbnbReservations.forEach(reservation => {
      const hasManualMatch = bookings.some(booking => {
        const manualStart = new Date(booking.checkInDate);
        const manualEnd = new Date(booking.checkOutDate);
        const airbnbStart = reservation.startDate;
        const airbnbEnd = reservation.endDate;
        
        const datesMatch = manualStart.getTime() === airbnbStart.getTime() && 
                          manualEnd.getTime() === airbnbEnd.getTime();
        const refsMatch = booking.bookingReference && reservation.airbnbBookingId && 
                         (booking.bookingReference.includes(reservation.airbnbBookingId) || 
                          reservation.airbnbBookingId.includes(booking.bookingReference));
        
        return datesMatch || refsMatch;
      });
      
      // Si pas de match manuel, afficher la réservation Airbnb en gris
      if (!hasManualMatch) {
        overrides[reservation.id] = AirbnbSyncService.getAirbnbReservationColor(
          reservation,
          updatedMatchedBookings,
          updatedSyncConflicts
        );
      }
    });

    // Mettre à jour l'état
    setMatchedBookings(updatedMatchedBookings);
    setSyncConflicts(updatedSyncConflicts);

    return overrides;
  }, [bookings, airbnbReservations]);

  const getStats = useMemo(() => {
    const completed = bookings.filter(b => 
      matchedBookings.includes(b.id) && b.status === 'completed'
    ).length;
    
    const pending = bookings.filter(b => 
      b.status !== 'completed'
    ).length + airbnbReservations.filter(r => 
      !matchedBookings.includes(r.id)
    ).length;
    
    const conflicts = syncConflicts.length;

    return { completed, pending, conflicts };
  }, [bookings, airbnbReservations, matchedBookings, syncConflicts]);

  // Combine bookings and Airbnb reservations, mais FILTRER les Airbnb qui ont un match
  const allReservations = useMemo(() => {
    // Filtrer les réservations Airbnb qui ont un match avec une réservation manuelle
    const filteredAirbnb = airbnbReservations.filter(reservation => {
      const hasManualMatch = bookings.some(booking => {
        const manualStart = new Date(booking.checkInDate);
        const manualEnd = new Date(booking.checkOutDate);
        const airbnbStart = reservation.startDate;
        const airbnbEnd = reservation.endDate;
        
        const datesMatch = manualStart.getTime() === airbnbStart.getTime() && 
                          manualEnd.getTime() === airbnbEnd.getTime();
        const refsMatch = booking.bookingReference && reservation.airbnbBookingId && 
                         (booking.bookingReference.includes(reservation.airbnbBookingId) || 
                          reservation.airbnbBookingId.includes(booking.bookingReference));
        
        return datesMatch || refsMatch;
      });
      
      return !hasManualMatch; // Garder seulement les Airbnb SANS match
    });
    
    return [...bookings, ...filteredAirbnb];
  }, [bookings, airbnbReservations]);
  const colorOverrides = getColorOverrides;

  // Generate calendar days
  const calendarDays = useMemo(() => generateCalendarDays(currentDate), [currentDate]);

  // Calculate booking positions for continuous bars
  const bookingLayout = useMemo(() => calculateBookingLayout(calendarDays, allReservations, colorOverrides), [calendarDays, allReservations, colorOverrides]);


  // Detect booking conflicts (only for manual bookings)
  const conflicts = useMemo(() => detectBookingConflicts(bookings).concat(syncConflicts), [bookings, syncConflicts]);

  // Auto-mark matched manual bookings as completed
  useEffect(() => {
    matchedBookings.forEach((id) => {
      const b = bookings.find((bk) => bk.id === id);
      if (b && b.status !== 'completed') {
        supabase.from('bookings').update({ status: 'completed' }).eq('id', id);
      }
    });
  }, [matchedBookings, bookings]);

  return (
    <div className="space-y-4">
      {/* Conflicts Alert */}
      {conflicts.length > 0 && (
        <Alert className="border-destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            <strong>{conflicts.length} conflit(s) détecté(s)</strong> - Des réservations se chevauchent
          </AlertDescription>
        </Alert>
      )}

      {/* Calendar Header */}
      <CalendarHeader 
        currentDate={currentDate}
        onDateChange={setCurrentDate}
        bookingCount={allReservations.length}
        onAirbnbSync={handleSyncFromCalendar}
        isSyncing={isSyncing}
        lastSyncDate={lastSyncDate}
        isConnected={syncStatus === 'success'}
        hasIcs={hasIcs}
        onOpenConfig={handleOpenConfig}
        stats={getStats}
      />

      {/* Calendar Grid - Fully responsive */}
      <div className="w-full">
        <CalendarGrid 
          calendarDays={calendarDays}
          bookingLayout={bookingLayout}
          conflicts={conflicts}
          onBookingClick={handleBookingClick}
        />
      </div>

      {/* Booking Details Modal */}
      {selectedBooking && (
        <BookingDetailsModal
          booking={selectedBooking}
          isOpen={!!selectedBooking}
          onClose={() => setSelectedBooking(null)}
          onEdit={onEditBooking}
        />
      )}

      {/* Airbnb Reservation Modal */}
      <AirbnbReservationModal
        reservation={selectedAirbnbReservation}
        isOpen={!!selectedAirbnbReservation}
        onClose={() => setSelectedAirbnbReservation(null)}
        propertyId={propertyId}
      />

    </div>
  );
});