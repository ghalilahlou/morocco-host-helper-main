import { useState, useEffect, useCallback, useMemo, memo, useRef } from 'react';
import { AlertTriangle, RefreshCw, Wifi, WifiOff } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { motion, AnimatePresence } from 'framer-motion';
import { Booking } from '@/types/booking';
import { EnrichedBooking } from '@/services/guestSubmissionService';
// ✅ CORRIGÉ : Imports supprimés - on n'utilise plus cleanGuestName/isValidGuestName ici
// getUnifiedBookingDisplayText() gère toute la logique de nettoyage et validation
import { getUnifiedBookingDisplayText } from '@/utils/bookingDisplay';
import { UnifiedBookingModal } from './UnifiedBookingModal';
import { CalendarHeader } from './calendar/CalendarHeader';
import { CalendarGrid } from './calendar/CalendarGrid';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { 
  generateCalendarDays, 
  calculateBookingLayout, 
  detectBookingConflicts 
} from './calendar/CalendarUtils';
import { AirbnbSyncService, AirbnbReservation } from '@/services/airbnbSyncService';
import { AirbnbEdgeFunctionService } from '@/services/airbnbEdgeFunctionService';
import { fetchAirbnbCalendarEvents, fetchAllCalendarEvents, CalendarEvent } from '@/services/calendarData';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { BOOKING_COLORS } from '@/constants/bookingColors';

interface CalendarViewProps {
  bookings: EnrichedBooking[];
  onEditBooking: (booking: Booking) => void;
  propertyId?: string; // Added to fetch Airbnb reservations
  onRefreshBookings?: () => void; // ✅ NOUVEAU : Callback pour rafraîchir les bookings
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

export const CalendarView = memo(({ bookings, onEditBooking, propertyId, onRefreshBookings }: CalendarViewProps) => {
  const navigate = useNavigate();
  
  // ✅ CORRIGÉ : Utiliser useRef pour capturer bookings sans causer de re-renders
  const bookingsRef = useRef(bookings);
  
  // Mettre à jour la référence à chaque fois que bookings change
  useEffect(() => {
    bookingsRef.current = bookings;
  }, [bookings]);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedBooking, setSelectedBooking] = useState<Booking | EnrichedBooking | AirbnbReservation | null>(null);
  const [airbnbReservations, setAirbnbReservations] = useState<AirbnbReservation[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'success' | 'error'>('idle');
  const [lastSyncDate, setLastSyncDate] = useState<Date | undefined>();
  const [matchedBookings, setMatchedBookings] = useState<string[]>([]);
  const [icsUrl, setIcsUrl] = useState<string | null>(null);
  const [hasIcs, setHasIcs] = useState(false);
  const [debugMode, setDebugMode] = useState(false);
  const { toast } = useToast();
  
  // ✅ NOUVEAU : États pour le rafraîchissement automatique
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [autoRefreshEnabled, setAutoRefreshEnabled] = useState(true);
  const [refreshInterval, setRefreshInterval] = useState(30000); // 30 secondes
  const refreshTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  // Check for debug mode from URL
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    setDebugMode(urlParams.get('debugCalendar') === '1');
  }, []);

  // ✅ NOUVEAU : Gestion de la connectivité
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // ✅ CORRIGÉ : Désactivé le rafraîchissement automatique qui cause la boucle infinie
  // Le rafraîchissement se fera uniquement via les subscriptions en temps réel
  /*
  useEffect(() => {
    if (!autoRefreshEnabled || !isOnline) return;

    const scheduleRefresh = () => {
      if (refreshTimeoutRef.current) {
        clearTimeout(refreshTimeoutRef.current);
      }
      
      refreshTimeoutRef.current = setTimeout(async () => {
        if (autoRefreshEnabled && isOnline) {
          await handleAutoRefresh();
          scheduleRefresh();
        }
      }, refreshInterval);
    };

    scheduleRefresh();

    return () => {
      if (refreshTimeoutRef.current) {
        clearTimeout(refreshTimeoutRef.current);
      }
    };
  }, [autoRefreshEnabled, isOnline, refreshInterval, propertyId, handleAutoRefresh]);
  */

  // ✅ PROTECTION : Garder une trace des chargements en cours
  const isLoadingRef = useRef(false);

  // Optimized load function with caching and debug logging
  const loadAirbnbReservations = useCallback(async () => {
    if (!propertyId) return;
    
    // ✅ PROTECTION : Empêcher les appels multiples simultanés
    if (isLoadingRef.current) {
      console.log('⏳ loadAirbnbReservations déjà en cours, appel ignoré');
      return;
    }
    
    // Check cache first
    const cached = airbnbCache.get(propertyId);
    if (cached) {
      setAirbnbReservations(cached.data);
      // ✅ Cache hit - pas de rechargement nécessaire
      return;
    }
    
    isLoadingRef.current = true;
    
    try {
      // Get current month range for calendar events
      const year = currentDate.getFullYear();
      const month = currentDate.getMonth();
      const startDate = new Date(year, month, 1);
      const endDate = new Date(year, month + 1, 0);
      
      const startStr = startDate.toISOString().split('T')[0];
      const endStr = endDate.toISOString().split('T')[0];
      
      // Fetch calendar events
      const calendarEvents = await fetchAirbnbCalendarEvents(propertyId, startStr, endStr);
      
      // ✅ CORRIGÉ : Convertir les événements en réservations Airbnb avec enrichissement
      // ⚠️ IMPORTANT : event.end est +1 jour pour l'affichage FullCalendar (date exclusive)
      // Mais endDate dans AirbnbReservation doit être la date réelle de départ (sans +1 jour)
      const formattedReservations: AirbnbReservation[] = calendarEvents.map(event => {
        // Le titre peut être soit un nom (ex: "Jean") soit "Réservation [CODE]"
        let guestName: string | undefined = undefined;
        
        // Si le titre ne commence pas par "Réservation", c'est un nom valide
        if (!event.title.toLowerCase().startsWith('réservation')) {
          guestName = event.title;
        } else {
          // Si c'est "Réservation [CODE]", pas de guestName (sera enrichi plus tard)
          guestName = undefined;
        }
        
        // ✅ CORRIGÉ : event.end est +1 jour pour FullCalendar, donc on soustrait 1 jour pour obtenir la date réelle
        const startDate = new Date(event.start);
        const endDateForCalendar = new Date(event.end);
        const realEndDate = new Date(endDateForCalendar);
        realEndDate.setDate(realEndDate.getDate() - 1); // Soustraire 1 jour pour obtenir la date réelle de départ
        
        return {
          id: event.id,
          summary: event.title.replace('Airbnb – ', ''),
          startDate: startDate,
          endDate: realEndDate, // ✅ CORRIGÉ : Utiliser la date réelle (sans +1 jour)
          description: '',
          guestName: guestName,
          numberOfGuests: undefined,
          airbnbBookingId: event.id,
          rawEvent: '',
          source: 'airbnb' as any
        };
      });
      
      // ✅ NOUVEAU : Enrichir les réservations Airbnb avec les données de bookings
      // Cela permet d'avoir les noms validés même si calendarData.ts n'a pas pu les trouver
      // ✅ CORRIGÉ : Utiliser bookingsRef pour éviter les dépendances dans useCallback
      const currentBookings = bookingsRef.current; // Utiliser la référence actuelle
      const enrichedReservations = await Promise.all(formattedReservations.map(async (reservation) => {
        // Chercher une réservation correspondante dans bookings enrichis
        const matchingBooking = currentBookings.find(b => {
          const bookingStart = new Date(b.checkInDate);
          const bookingEnd = new Date(b.checkOutDate);
          const airbnbStart = reservation.startDate;
          const airbnbEnd = reservation.endDate;
          
          const datesMatch = bookingStart.getTime() === airbnbStart.getTime() && 
                            bookingEnd.getTime() === airbnbEnd.getTime();
          
          const refMatch = b.bookingReference && reservation.airbnbBookingId && 
                          (b.bookingReference.includes(reservation.airbnbBookingId) || 
                           reservation.airbnbBookingId.includes(b.bookingReference));
          
          return datesMatch || refMatch;
        });
        
        // Si on trouve une réservation enrichie avec des noms réels, propager toutes les propriétés
        // Laisser getUnifiedBookingDisplayText() choisir quel nom afficher selon sa logique de priorité
        if (matchingBooking) {
          const enrichedBooking = matchingBooking as EnrichedBooking;
          // ✅ CORRIGÉ : Propager TOUTES les propriétés enrichies sans choisir manuellement le guestName
          // getUnifiedBookingDisplayText() fera le choix selon sa logique de priorité
          return {
            ...reservation,
            // Propager toutes les propriétés enrichies pour que getUnifiedBookingDisplayText fonctionne
            hasRealSubmissions: enrichedBooking.hasRealSubmissions,
            realGuestNames: enrichedBooking.realGuestNames || [],
            realGuestCount: enrichedBooking.realGuestCount || 0,
            // Ne PAS choisir manuellement le guestName - laisser getUnifiedBookingDisplayText() le faire
            guest_name: (enrichedBooking as any).guest_name || reservation.guestName,
            // Garder le guestName original de la réservation si pas de guest_name enrichi
            guestName: reservation.guestName
          } as any;
        }
        
        return reservation;
      }));
      
      const finalReservations = enrichedReservations;
      
      // ✅ CORRIGÉ : Utiliser les réservations enrichies au lieu des réservations formatées
      // Cache the data
      airbnbCache.set(propertyId, finalReservations);
      setAirbnbReservations(finalReservations);
      
      // Get sync status
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
    } finally {
      // ✅ IMPORTANT : Réinitialiser le flag après le chargement
      isLoadingRef.current = false;
    }
  }, [propertyId, currentDate, debugMode]); // ✅ Ne pas inclure bookings pour éviter les re-renders, on utilise bookingsRef

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

// ✅ NOUVEAU : Fonction de rafraîchissement automatique
const handleAutoRefresh = useCallback(async () => {
  if (isRefreshing || !isOnline) return;
  
  setIsRefreshing(true);
  try {
    await loadAirbnbReservations();
    setLastRefresh(new Date());
  } catch (error) {
    console.error('❌ Auto-refresh failed:', error);
  } finally {
    setIsRefreshing(false);
  }
}, [isRefreshing, isOnline, loadAirbnbReservations]);

// ✅ CORRIGÉ : Fonction de rafraîchissement manuel - UNIFIÉE avec la logique de sync
// Rafraîchit à la fois les bookings ET les airbnbReservations pour éviter les faux conflits
const handleManualRefresh = useCallback(async () => {
  if (isRefreshing) return;
  
  setIsRefreshing(true);
  try {
    // ✅ ÉTAPE 1 : Rafraîchir les bookings D'ABORD (si callback fourni)
    // Cela garantit que les bookings sont à jour avant de détecter les conflits
    if (onRefreshBookings) {
      console.log('🔄 Rafraîchissement des bookings...');
      await onRefreshBookings();
      // Attendre un court instant pour que les subscriptions se mettent à jour
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    // ✅ ÉTAPE 2 : Nettoyer le cache et recharger les réservations Airbnb
    airbnbCache.clear();
    await loadAirbnbReservations();
    setLastRefresh(new Date());
    
    toast({
      title: "Calendrier mis à jour",
      description: "Les données ont été rafraîchies avec succès",
    });
  } catch (error) {
    console.error('❌ Manual refresh failed:', error);
    toast({
      title: "Erreur de rafraîchissement",
      description: "Impossible de mettre à jour le calendrier",
      variant: "destructive",
    });
  } finally {
    setIsRefreshing(false);
  }
}, [isRefreshing, loadAirbnbReservations, onRefreshBookings, toast]);

// ✅ CORRIGÉ : Real-time subscription avec debounce et throttle pour éviter les rechargements excessifs
  const reloadTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastReloadTime = useRef<number>(0);
  const MIN_RELOAD_INTERVAL = 5000; // 5 secondes minimum entre les rechargements

  const debouncedReload = useCallback(() => {
    // Clear any pending reload
    if (reloadTimeoutRef.current) {
      clearTimeout(reloadTimeoutRef.current);
    }
    
    // Throttle: Check if we've reloaded recently
    const now = Date.now();
    const timeSinceLastReload = now - lastReloadTime.current;
    
    if (timeSinceLastReload < MIN_RELOAD_INTERVAL) {
      // Schedule reload for later
      const remainingTime = MIN_RELOAD_INTERVAL - timeSinceLastReload;
      reloadTimeoutRef.current = setTimeout(() => {
        airbnbCache.delete(propertyId || '');
        loadAirbnbReservations();
        lastReloadTime.current = Date.now();
      }, remainingTime);
    } else {
      // Reload immediately
      airbnbCache.delete(propertyId || '');
      loadAirbnbReservations();
      lastReloadTime.current = now;
    }
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
      if (reloadTimeoutRef.current) {
        clearTimeout(reloadTimeoutRef.current);
      }
    };
  }, [propertyId, debouncedReload]);

  // ✅ UNIFIÉ : Un seul handler pour tous les types de réservations
  const handleBookingClick = useCallback((booking: Booking | AirbnbReservation) => {
    console.log('🖱️ [CalendarView] handleBookingClick appelé:', {
      bookingId: booking.id,
      bookingType: 'source' in booking ? 'airbnb' : 'manual',
      hasBooking: !!booking
    });
    
    if (!booking) {
      console.error('❌ [CalendarView] handleBookingClick: booking is null/undefined');
      return;
    }
    
    try {
      setSelectedBooking(booking);
      console.log('✅ [CalendarView] selectedBooking mis à jour');
    } catch (error) {
      console.error('❌ [CalendarView] Erreur lors de setSelectedBooking:', error);
    }
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
            description: `${result.count || 0} réservations synchronisées. Naviguez dans le calendrier pour voir toutes les réservations.`
          });
        }
        
        // ✅ CORRIGÉ : Rafraîchir les bookings D'ABORD (comme dans handleManualRefresh)
        // Cela garantit que les bookings sont synchronisés avec les nouvelles réservations ICS
        if (onRefreshBookings) {
          console.log('🔄 Rafraîchissement des bookings après sync...');
          await onRefreshBookings();
          // Attendre un court instant pour que les subscriptions se mettent à jour
          await new Promise(resolve => setTimeout(resolve, 500));
        }
        
        // ✅ ÉTAPE 2 : Recharger les réservations Airbnb (utiliser loadAirbnbReservations pour la cohérence)
        airbnbCache.clear();
        await loadAirbnbReservations();
        
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

// ✅ CORRIGÉ : Auto-sync UNIQUEMENT au premier chargement, pas à chaque changement
  const hasAutoSynced = useRef(false);
  useEffect(() => {
    if (!propertyId || hasAutoSynced.current) return;
    hasAutoSynced.current = true;
    handleSyncFromCalendar();
  }, [propertyId]); // ✅ Retiré handleSyncFromCalendar des dépendances

  // ✅ CORRIGÉ : Détection des conflits AVANT le calcul des couleurs pour les inclure
  const conflicts = useMemo(() => {
    // Détecter tous les conflits entre toutes les réservations
    const allReservationsForConflictDetection = [...bookings, ...airbnbReservations];
    const detectedConflicts = detectBookingConflicts(bookings, allReservationsForConflictDetection);
    
    // ✅ PRODUCTION : Ne logger QUE en mode développement
    if (process.env.NODE_ENV === 'development' && detectedConflicts.length > 0) {
      const conflictKey = `${detectedConflicts.length}-${detectedConflicts.sort().join(',')}`;
      if (!(window as any).__lastConflictLogKey || (window as any).__lastConflictLogKey !== conflictKey) {
        console.warn(`⚠️ ${detectedConflicts.length} conflit(s) détecté(s)`);
        (window as any).__lastConflictLogKey = conflictKey;
      }
    } else if (detectedConflicts.length === 0 && (window as any).__lastConflictLogKey) {
      delete (window as any).__lastConflictLogKey;
    }
    
    return detectedConflicts;
  }, [bookings, airbnbReservations]);

  // ✅ CORRIGÉ : Calcul des matchs et couleurs avec conflits inclus
  const { colorOverrides: getColorOverrides, matchedBookingsIds } = useMemo(() => {
    const overrides: { [key: string]: string } = {};
    const updatedMatchedBookings: string[] = [];
    
    // ÉTAPE 1: Détecter les matchs entre réservations manuelles et Airbnb
    bookings.forEach(booking => {
      const manualStart = new Date(booking.checkInDate);
      const manualEnd = new Date(booking.checkOutDate);
      
      const matchingAirbnb = airbnbReservations.find(airbnb => {
        const airbnbStart = airbnb.startDate;
        const airbnbEnd = airbnb.endDate;
        
        const datesMatch = manualStart.getTime() === airbnbStart.getTime() && 
                          manualEnd.getTime() === airbnbEnd.getTime();
        const refsMatch = booking.bookingReference && airbnb.airbnbBookingId && 
                         (booking.bookingReference.includes(airbnb.airbnbBookingId) || 
                          airbnb.airbnbBookingId.includes(booking.bookingReference));
        
        return datesMatch || refsMatch;
      });
      
      if (matchingAirbnb) {
        updatedMatchedBookings.push(booking.id);
      }
    });
    
    // ÉTAPE 2: Appliquer les couleurs avec conflits inclus - ROUGE pour les conflits
    bookings.forEach(booking => {
      // ✅ PRIORITÉ 1: Rouge si en conflit
      if (conflicts.includes(booking.id)) {
        overrides[booking.id] = BOOKING_COLORS.conflict.tailwind;
      } else {
      overrides[booking.id] = AirbnbSyncService.getBookingStatusColor(
        booking,
        updatedMatchedBookings,
          conflicts // ✅ Inclure les conflits
      );
      }
    });

    // ÉTAPE 3: Couleurs pour les réservations Airbnb non matchées avec conflits
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
      
      if (!hasManualMatch) {
        // ✅ PRIORITÉ 1: Rouge si en conflit
        if (conflicts.includes(reservation.id)) {
          overrides[reservation.id] = BOOKING_COLORS.conflict.tailwind;
        } else {
        overrides[reservation.id] = AirbnbSyncService.getAirbnbReservationColor(
          reservation,
          updatedMatchedBookings,
            conflicts // ✅ Inclure les conflits
        );
        }
      }
    });

    return {
      colorOverrides: overrides,
      matchedBookingsIds: updatedMatchedBookings
    };
  }, [bookings, airbnbReservations, conflicts]);
  
  const colorOverrides = getColorOverrides;

  // ✅ CORRIGÉ : Mise à jour des états APRÈS le useMemo, dans un useEffect séparé
  useEffect(() => {
    setMatchedBookings(matchedBookingsIds);
  }, [matchedBookingsIds]);

  // ✅ CORRIGÉ : Combine bookings and Airbnb reservations avec enrichissement automatique
  const allReservations = useMemo(() => {
    // Filtrer les réservations Airbnb qui ont un match avec une réservation manuelle
    const filteredAirbnb = airbnbReservations.map(reservation => {
      // Chercher une réservation correspondante dans bookings enrichis
      const matchingBooking = bookings.find(booking => {
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
      
      // Si on trouve un match, enrichir la réservation Airbnb avec les données du booking
      // Laisser getUnifiedBookingDisplayText() choisir quel nom afficher selon sa logique de priorité
      if (matchingBooking) {
        const enrichedBooking = matchingBooking as EnrichedBooking;
        // ✅ CORRIGÉ : Propager TOUTES les propriétés enrichies sans choisir/nettoyer manuellement le guestName
        // getUnifiedBookingDisplayText() fera le nettoyage et le choix selon sa logique de priorité
        return {
          ...reservation,
          // Propager toutes les propriétés enrichies pour que getUnifiedBookingDisplayText fonctionne
          hasRealSubmissions: enrichedBooking.hasRealSubmissions,
          realGuestNames: enrichedBooking.realGuestNames || [],
          realGuestCount: enrichedBooking.realGuestCount || 0,
          // Ne PAS nettoyer ou choisir manuellement - laisser getUnifiedBookingDisplayText() le faire
          guest_name: (enrichedBooking as any).guest_name || reservation.guestName,
          // Garder le guestName original de la réservation
          guestName: reservation.guestName
        } as any;
      }
      
      return reservation;
    }).filter(reservation => {
      // Filtrer seulement celles qui n'ont PAS de match (pour éviter les doublons)
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
      
      return !hasManualMatch; // Garder seulement les Airbnb SANS match exact avec un booking
    });
    
    return [...bookings, ...filteredAirbnb];
  }, [bookings, airbnbReservations]);

  // Generate calendar days
  const calendarDays = useMemo(() => generateCalendarDays(currentDate), [currentDate]);

  // ✅ DIAGNOSTIC : Log des réservations avant calcul du layout
  useEffect(() => {
    console.log('📅 [CALENDAR DIAGNOSTIC] Réservations reçues:', {
      totalBookings: bookings.length,
      totalAirbnb: airbnbReservations.length,
      totalAllReservations: allReservations.length,
      bookingIds: bookings.map(b => ({ id: b.id, propertyId: b.propertyId, checkIn: b.checkInDate, checkOut: b.checkOutDate, status: b.status })),
      currentMonth: currentDate.toLocaleString('fr-FR', { month: 'long', year: 'numeric' })
    });
  }, [bookings, airbnbReservations, allReservations, currentDate]);

  // Calculate booking positions for continuous bars
  const bookingLayout = useMemo(() => {
    console.log('📅 [CALENDAR DIAGNOSTIC] Calcul du layout avec', allReservations.length, 'réservations');
    const layout = calculateBookingLayout(calendarDays, allReservations, colorOverrides);
    console.log('📅 [CALENDAR DIAGNOSTIC] Layout calculé:', Object.keys(layout).length, 'semaines avec réservations');
    Object.keys(layout).forEach(weekIndex => {
      if (layout[weekIndex].length > 0) {
        console.log(`📅 [CALENDAR DIAGNOSTIC] Semaine ${weekIndex}:`, layout[weekIndex].length, 'réservations');
      }
    });
    return layout;
  }, [calendarDays, allReservations, colorOverrides]);


  // ✅ CORRIGÉ : Utiliser les conflits déjà calculés plus haut (pas besoin de les recalculer)
  // Les conflits sont utilisés dans colorOverrides et passés au CalendarGrid

  // ✅ NOUVEAU : Calculer les détails des conflits (paires de réservations en conflit avec dates)
  // Utiliser les conflits déjà détectés pour construire les détails
  const conflictDetails = useMemo(() => {
    const conflictsList: Array<{
      id1: string;
      id2: string;
      name1: string;
      name2: string;
      start1: string;
      end1: string;
      start2: string;
      end2: string;
    }> = [];

    // Trouver toutes les paires de réservations qui se chevauchent
    for (let i = 0; i < allReservations.length; i++) {
      for (let j = i + 1; j < allReservations.length; j++) {
        const res1 = allReservations[i];
        const res2 = allReservations[j];
        
        const isAirbnb1 = 'source' in res1 && res1.source === 'airbnb';
        const isAirbnb2 = 'source' in res2 && res2.source === 'airbnb';
        
        const start1 = isAirbnb1 
          ? new Date((res1 as any).startDate)
          : new Date((res1 as Booking).checkInDate);
        const end1 = isAirbnb1
          ? new Date((res1 as any).endDate)
          : new Date((res1 as Booking).checkOutDate);
        const start2 = isAirbnb2
          ? new Date((res2 as any).startDate)
          : new Date((res2 as Booking).checkInDate);
        const end2 = isAirbnb2
          ? new Date((res2 as any).endDate)
          : new Date((res2 as Booking).checkOutDate);
        
        // Normaliser les dates (midnight local)
        const normStart1 = new Date(start1.getFullYear(), start1.getMonth(), start1.getDate());
        const normEnd1 = new Date(end1.getFullYear(), end1.getMonth(), end1.getDate());
        const normStart2 = new Date(start2.getFullYear(), start2.getMonth(), start2.getDate());
        const normEnd2 = new Date(end2.getFullYear(), end2.getMonth(), end2.getDate());
        
        // Vérifier si les dates se chevauchent
        const overlaps = normStart1 < normEnd2 && normStart2 < normEnd1;
        
        if (overlaps) {
          // Formater les dates pour l'affichage
          const formatDate = (date: Date) => {
            return date.toLocaleDateString('fr-FR', { 
              day: '2-digit', 
              month: '2-digit', 
              year: 'numeric' 
            });
          };
          
          // Utiliser getUnifiedBookingDisplayText pour obtenir le nom d'affichage
          const name1 = getUnifiedBookingDisplayText(res1, true);
          const name2 = getUnifiedBookingDisplayText(res2, true);
          
          conflictsList.push({
            id1: res1.id,
            id2: res2.id,
            name1: name1 || 'Réservation',
            name2: name2 || 'Réservation',
            start1: formatDate(normStart1),
            end1: formatDate(normEnd1),
            start2: formatDate(normStart2),
            end2: formatDate(normEnd2)
          });
        }
      }
    }
    
    return conflictsList;
  }, [allReservations]);

  // ✅ CORRIGÉ : Stats avec conflits détectés dynamiquement
  const getStats = useMemo(() => {
    const completed = bookings.filter(b => 
      matchedBookings.includes(b.id) && b.status === 'completed'
    ).length;
    
    const pending = bookings.filter(b => 
      b.status !== 'completed'
    ).length + airbnbReservations.filter(r => 
      !matchedBookings.includes(r.id)
    ).length;
    
    // ✅ CORRIGÉ : Utiliser les conflits détectés dynamiquement
    const conflictsCount = conflicts.length;

    return { completed, pending, conflicts: conflictsCount };
  }, [bookings, airbnbReservations, matchedBookings, conflicts]);

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

      {/* ✅ NOUVEAU : Barre de rafraîchissement et statut */}
      <motion.div 
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-4 flex items-center justify-between bg-gradient-to-r from-cyan-50 to-teal-50 dark:from-cyan-950/20 dark:to-teal-950/20 p-3 rounded-lg border border-cyan-200 dark:border-cyan-800"
      >
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-2">
            {isOnline ? (
              <Wifi className="h-4 w-4 text-green-600" />
            ) : (
              <WifiOff className="h-4 w-4 text-red-600" />
            )}
            <span className="text-sm text-muted-foreground">
              {isOnline ? 'Connecté' : 'Hors ligne'}
            </span>
          </div>
          
          <div className="flex items-center space-x-2">
            <div className={`h-2 w-2 rounded-full ${isRefreshing ? 'bg-cyan-500 animate-pulse' : 'bg-green-500'}`} />
            <span className="text-sm text-muted-foreground">
              {isRefreshing ? 'Mise à jour...' : `Dernière MAJ: ${lastRefresh.toLocaleTimeString()}`}
            </span>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleManualRefresh}
            disabled={isRefreshing || !isOnline}
            className="flex items-center space-x-2"
          >
            <motion.div
              animate={{ rotate: isRefreshing ? 360 : 0 }}
              transition={{ duration: 0.5, repeat: isRefreshing ? Infinity : 0 }}
            >
              <RefreshCw className="h-4 w-4" />
            </motion.div>
            <span>Actualiser</span>
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => setAutoRefreshEnabled(!autoRefreshEnabled)}
            className={`flex items-center space-x-2 ${autoRefreshEnabled ? 'text-green-600' : 'text-gray-500'}`}
          >
            <div className={`h-2 w-2 rounded-full ${autoRefreshEnabled ? 'bg-green-500' : 'bg-gray-400'}`} />
            <span className="text-sm">
              Auto-refresh {autoRefreshEnabled ? 'ON' : 'OFF'}
            </span>
          </Button>
        </div>
      </motion.div>

      {/* Calendar Header */}
      <ErrorBoundary>
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
          conflictDetails={conflictDetails}
          allReservations={allReservations}
          onBookingClick={handleBookingClick}
        />
      </ErrorBoundary>

      {/* ✅ NOUVEAU : Calendrier optimisé avec effets visuels avancés */}
      <motion.div 
        className="w-full relative"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
      >
        {/* ✅ NOUVEAU : Overlay de chargement avec animation */}
        {isRefreshing && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center rounded-xl"
          >
            <div className="flex items-center space-x-3 bg-card p-4 rounded-lg shadow-lg border">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                className="h-5 w-5 border-2 border-primary border-t-transparent rounded-full"
              />
              <span className="text-sm font-medium">Mise à jour du calendrier...</span>
            </div>
          </motion.div>
        )}
        
        {/* ✅ CORRIGÉ : AnimatePresence avec mode="wait" - un seul enfant avec clé stable */}
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={currentDate.getMonth()}
            initial={{ opacity: 0, x: 30, scale: 0.95 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: -30, scale: 0.95 }}
            transition={{ duration: 0.4, ease: "easeInOut" }}
            className="relative"
          >
            <CalendarGrid 
              calendarDays={calendarDays}
              bookingLayout={bookingLayout}
              conflicts={conflicts}
              onBookingClick={handleBookingClick}
            />
            
            {/* ✅ SUPPRIMÉ : Indicateur qui causait des chevauchements avec le header */}
          </motion.div>
        </AnimatePresence>
      </motion.div>

      {/* ✅ UNIFIÉ : Modal unique pour toutes les réservations */}
      <UnifiedBookingModal
        booking={selectedBooking}
        isOpen={!!selectedBooking}
        onClose={() => setSelectedBooking(null)}
        propertyId={propertyId}
      />

    </div>
  );
});