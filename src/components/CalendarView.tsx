import { useState, useEffect, useCallback, useMemo, memo, useRef } from 'react';
import { AlertTriangle, RefreshCw, Wifi, WifiOff } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { motion, AnimatePresence } from 'framer-motion';
import { Booking } from '@/types/booking';
import { EnrichedBooking } from '@/services/guestSubmissionService';
import { getBookingDisplayTitle, ICAL_AIRBNB_DISPLAY_LABEL } from '@/utils/bookingDisplay';
import { UnifiedBookingModal } from './UnifiedBookingModal';
import { ConflictModal } from './ConflictModal';
import { CalendarHeader } from './calendar/CalendarHeader';
import { CalendarGrid, type ConflictGroupForCalendar } from './calendar/CalendarGrid';
import { CalendarMobile } from './calendar/CalendarMobile';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { 
  generateCalendarDays, 
  calculateBookingLayout, 
  detectBookingConflicts 
} from './calendar/CalendarUtils';
import { AirbnbSyncService, AirbnbReservation } from '@/services/airbnbSyncService';
import { AirbnbEdgeFunctionService } from '@/services/airbnbEdgeFunctionService';
import { fetchAirbnbCalendarEvents, invalidateAirbnbEventsCache } from '@/services/calendarData';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { BOOKING_COLORS } from '@/constants/bookingColors';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';
import { formatLocalDate } from '@/utils/dateUtils';
import { getBookingDocumentStatus } from '@/utils/bookingDocuments';
import { doBookingAndAirbnbMatch, isSameReservationByRef } from '@/utils/bookingAirbnbMatch';
import { mergeBookingsWithAirbnbForCalendar } from '@/domain/calendarReservationModel';
import { FRONT_CALENDAR_ICS_SYNC_ENABLED } from '@/config/frontCalendarSync';
import { useT } from '@/i18n/GuestLocaleProvider';
import { useBookings } from '@/hooks/useBookings';

interface CalendarViewProps {
  bookings: EnrichedBooking[];
  onEditBooking: (booking: Booking) => void;
  propertyId?: string;
  /** Suppression en cascade (guest_submissions, guests, documents, airbnb_reservations). Préférer celui du parent pour éviter un second hook. */
  onDeleteBooking?: (id: string) => Promise<void>;
  onRefreshBookings?: () => void;
  airbnbIcsUrl?: string | null;
  viewMode?: 'cards' | 'calendar';
  onViewModeChange?: (mode: 'cards' | 'calendar') => void;
  /** Si true, ne charge pas l’ICS tant que les bookings ne sont pas prêts (évite barres seules = codes Airbnb). */
  bookingsLoading?: boolean;
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

export const CalendarView = memo(({ bookings, onEditBooking, propertyId, onDeleteBooking: onDeleteBookingProp, onRefreshBookings, airbnbIcsUrl, viewMode = 'calendar', onViewModeChange, bookingsLoading = false }: CalendarViewProps) => {
  const navigate = useNavigate();
  const t = useT();
  // Même motif que Dashboard : cascade via useBookings.deleteBooking ; si le parent fournit déjà deleteBooking, éviter de filtrer deux fois les bookings.
  const deleteBookingFallback = useBookings({ propertyId: onDeleteBookingProp ? undefined : propertyId });
  const performDeleteBooking = onDeleteBookingProp ?? deleteBookingFallback.deleteBooking;

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
  const [showConflictModal, setShowConflictModal] = useState(false);
  const [openConflictFromAlert, setOpenConflictFromAlert] = useState<{ groupKey: string; weekIndex: number } | null>(null);
  const calendarSectionRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  const handleCalendarDeleteBooking = useCallback(async (id: string) => {
    const booking = bookings.find((b) => b.id === id);
    if (!booking) return;
    try {
      await performDeleteBooking(id);
      if (onRefreshBookings) await onRefreshBookings();
      toast({ title: t('airbnb.bookingDeleted.title'), description: t('airbnb.bookingDeleted.desc') });
    } catch (error) {
      console.error('Error deleting booking:', error);
      toast({
        title: t('airbnb.deleteError.title'),
        description: t('airbnb.deleteError.desc'),
        variant: 'destructive',
      });
      throw error;
    }
  }, [bookings, performDeleteBooking, onRefreshBookings, toast, t]);

  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const isMobile = useIsMobile();

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    setDebugMode(urlParams.get('debugCalendar') === '1');
  }, []);

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

  // ✅ PROTECTION : Garder une trace des chargements en cours
  const isLoadingRef = useRef(false);

  // Optimized load function with caching and debug logging
  // forceReload: après une sync ICS, forcer le rechargement même si un chargement est en cours / cache présent
  const loadAirbnbReservations = useCallback(async (forceReload?: boolean) => {
    if (!propertyId) return;

    if (!FRONT_CALENDAR_ICS_SYNC_ENABLED) {
      airbnbCache.clear();
      setAirbnbReservations([]);
      return;
    }
    
    // ✅ PROTECTION : Empêcher les appels multiples simultanés (sauf après sync)
    if (isLoadingRef.current && !forceReload) {
      return; // Silencieux pour éviter le spam de logs
    }
    if (forceReload) {
      isLoadingRef.current = false;
    }

    // ✅ OPTIMISATION : Utiliser hasIcs déjà chargé au lieu de faire une requête supplémentaire
    // Si hasIcs n'est pas encore chargé, on attend (le useEffect pour hasIcs se chargera de rappeler)
    if (!hasIcs) {
      setAirbnbReservations([]);
      return;
    }

    // Déterminer la plage de dates du mois courant
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const startDate = new Date(year, month, 1);
    const endDate = new Date(year, month + 1, 0);
    
    // ✅ CORRIGÉ : Utiliser formatLocalDate pour éviter les décalages de timezone
    const startStr = formatLocalDate(startDate);
    const endStr = formatLocalDate(endDate);

    // ✅ NOUVEAU : clé de cache inclut propriété + plage de dates
    const cacheKey = `${propertyId}-${startStr}-${endStr}`;
    
    // Check cache first pour cette plage précise (sauf après sync)
    if (!forceReload) {
      const cached = airbnbCache.get(cacheKey);
      if (cached) {
        setAirbnbReservations(cached.data);
        return;
      }
    }
    
    isLoadingRef.current = true;
    
    try {
      // Only fetch airbnb events - bookings are already in the `bookings` prop
      const airbnbOnlyEvents = await fetchAirbnbCalendarEvents(propertyId, startStr, endStr);
      // ✅ CORRIGÉ : Convertir les événements en réservations Airbnb avec enrichissement
      // ⚠️ IMPORTANT : event.end est +1 jour pour l'affichage FullCalendar (date exclusive)
      // Mais endDate dans AirbnbReservation doit être la date réelle de départ (sans +1 jour)
      const formattedReservations: AirbnbReservation[] = airbnbOnlyEvents.map(event => {
        // Le titre peut être soit un nom (ex: "Jean") soit "Réservation [CODE]"
        let guestName: string | undefined = undefined;
        
        // Si le titre est un vrai nom (pas le label générique iCal, pas un préfixe "Réservation")
        if (
          event.title &&
          event.title !== ICAL_AIRBNB_DISPLAY_LABEL &&
          !event.title.toLowerCase().startsWith('réservation')
        ) {
          guestName = event.title;
        } else {
          // Label générique iCal ou code : ne pas l'utiliser comme nom d'invité
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
      
      // Plus d'enrichissement ici : allReservations filtre les Airbnb matchés
      // et ne garde que le booking manuel (source de vérité unique).
      airbnbCache.set(cacheKey, formattedReservations);
      setAirbnbReservations(formattedReservations);

      // If we got results, mark sync as success without an extra network call
      if (formattedReservations.length > 0) {
        setSyncStatus('success');
      }
    } catch (error) {
      console.error('Error loading Airbnb reservations:', error);
    } finally {
      // ✅ IMPORTANT : Réinitialiser le flag après le chargement
      isLoadingRef.current = false;
    }
  }, [propertyId, currentDate, hasIcs]); // ✅ Inclure hasIcs car on l'utilise dans la fonction

  // Sync hasIcs/icsUrl from prop (no extra Supabase query needed)
  useEffect(() => {
    if (!FRONT_CALENDAR_ICS_SYNC_ENABLED) {
      airbnbCache.clear();
      setIcsUrl(null);
      setHasIcs(false);
      setAirbnbReservations([]);
      return;
    }
    setIcsUrl(airbnbIcsUrl || null);
    setHasIcs(!!airbnbIcsUrl);
  }, [airbnbIcsUrl]);

  // ✅ Charger l’ICS seulement quand les bookings sont prêts : sinon allReservations = ICS seul → codes Airbnb.
  useEffect(() => {
    if (hasIcs && !bookingsLoading) {
      loadAirbnbReservations();
    }
  }, [hasIcs, loadAirbnbReservations, bookingsLoading]);

const handleManualRefresh = useCallback(async () => {
  if (isRefreshing) return;
  
  setIsRefreshing(true);
  try {
    if (onRefreshBookings) {
      await onRefreshBookings();
    }
    if (FRONT_CALENDAR_ICS_SYNC_ENABLED) {
      airbnbCache.clear();
      invalidateAirbnbEventsCache(propertyId);
      await loadAirbnbReservations(true);
    }
    
    toast({
      title: t('airbnb.calendarUpdated.title'),
      description: t('airbnb.calendarUpdated.desc'),
    });
  } catch (error) {
    console.error('Manual refresh failed:', error);
    toast({
      title: t('airbnb.refreshError.title'),
      description: t('airbnb.refreshError.desc'),
      variant: "destructive",
    });
  } finally {
    setIsRefreshing(false);
  }
}, [isRefreshing, loadAirbnbReservations, onRefreshBookings, propertyId, toast, t]);

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
        // Invalider tout le cache Airbnb – les changements peuvent affecter plusieurs mois
        airbnbCache.clear();
        loadAirbnbReservations();
        lastReloadTime.current = Date.now();
      }, remainingTime);
    } else {
      // Reload immediately
      airbnbCache.clear();
      loadAirbnbReservations();
      lastReloadTime.current = now;
    }
  }, [loadAirbnbReservations, propertyId]);

  // Single optimized real-time subscription (désactivé si sync ICS front coupée)
  useEffect(() => {
    if (!FRONT_CALENDAR_ICS_SYNC_ENABLED || !propertyId) return;

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

  /**
   * Clic barre : si la ligne est une réservation Airbnb mais qu'un booking manuel
   * enrichi correspond (mêmes dates / ref), ouvrir la modale sur ce booking (UUID)
   * pour une seule source de vérité (documents, liens invité).
   */
  const handleBookingClick = useCallback((clicked: Booking | AirbnbReservation) => {
    if (!clicked) return;

    const isAirbnbRow = 'source' in clicked && (clicked as AirbnbReservation).source === 'airbnb';
    if (isAirbnbRow) {
      const manual = bookings.find((b) => doBookingAndAirbnbMatch(b, clicked as AirbnbReservation));
      if (manual) {
        setSelectedBooking(manual as EnrichedBooking);
        return;
      }
    }

    setSelectedBooking(clicked);
  }, [bookings]);

  const handleSyncFromCalendar = useCallback(async () => {
    if (!propertyId) return;

    if (!FRONT_CALENDAR_ICS_SYNC_ENABLED) {
      toast({
        title: t('airbnb.syncError.title'),
        description: 'La synchronisation calendrier Airbnb est désactivée. Utilisez les réservations créées dans l’application.',
        variant: 'default',
      });
      return;
    }
    
    try {
      setIsSyncing(true);
      
      if (!icsUrl) {
        toast({
          title: t('airbnb.configRequired.title'),
          description: t('airbnb.configRequired.desc'),
          variant: "default"
        });
        setIsSyncing(false);
        return;
      }

      const result = await AirbnbEdgeFunctionService.syncReservations(propertyId, icsUrl);
      
      if (result.success) {
        // Silent success on mobile, only show on desktop
        if (window.innerWidth >= 768) {
          toast({
            title: t('airbnb.syncSuccess.title'),
            description: t('airbnb.syncSuccess.desc', { count: result.count || 0 })
          });
        }
        
        // ✅ CORRIGÉ : Invalider TOUS les caches avant de rafraîchir
        // Cela évite d'afficher des données obsolètes ou en double
        airbnbCache.clear();
        // ✅ Invalider également le cache des événements Airbnb
        invalidateAirbnbEventsCache(propertyId);
        if (propertyId) {
          const { multiLevelCache } = await import('@/services/multiLevelCache');
          // Clés réelles : `bookings-v3-{uuid}…` — le UUID suffit pour tout invalider
          await multiLevelCache.invalidatePattern(propertyId);
        }
        
        // ✅ OPTIMISATION : Rafraîchir les bookings sans délai inutile
        if (onRefreshBookings) {
          await onRefreshBookings();
        }
        
        // ✅ ÉTAPE 2 : Forcer le rechargement des réservations Airbnb (évite "déjà en cours, appel ignoré")
        await loadAirbnbReservations(true);
        
        setSyncStatus('success');
        setLastSyncDate(new Date());
      } else {
        toast({
          title: t('airbnb.syncError.title'),
          description: result.error || t('airbnb.syncError.desc'),
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('Sync error:', error);
      toast({
        title: t('airbnb.syncError.title'),
        description: t('airbnb.syncErrorUnexpected.desc'),
        variant: "destructive"
      });
    } finally {
      setIsSyncing(false);
    }
  }, [propertyId, icsUrl, toast, t, loadAirbnbReservations, onRefreshBookings]);

const handleOpenConfig = useCallback(() => {
  if (propertyId) {
    navigate(`/help/airbnb-sync/${propertyId}`);
  }
}, [navigate, propertyId]);

  // On mount, just load existing data from DB (no full Airbnb sync).
  // User can trigger a sync manually via the "Synchronisation" button.
  // The real-time subscription on airbnb_reservations handles live updates.

  // ✅ CORRIGÉ : Détection des conflits AVANT le calcul des couleurs pour les inclure
  // Ne passer que airbnbReservations en 2e argument : detectBookingConflicts ajoute déjà les bookings
  // (passer [...bookings, ...airbnbReservations] dupliquait chaque booking → faux conflit avec soi-même)
  const conflicts = useMemo(() => {
    const detectedConflicts = detectBookingConflicts(bookings, airbnbReservations);
    
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

  // ✅ MOBILE : Ouvrir automatiquement la modale de conflit si des conflits sont détectés
  useEffect(() => {
    if (isMobile && conflicts.length > 0 && !showConflictModal) {
      // Utiliser setTimeout pour éviter les mises à jour d'état pendant le rendu
      const timer = setTimeout(() => {
        setShowConflictModal(true);
      }, 300); // Petit délai pour que le calendrier soit rendu
      return () => clearTimeout(timer);
    }
  }, [isMobile, conflicts.length, showConflictModal]);

  // ✅ CORRIGÉ : Calcul des matchs et couleurs avec conflits inclus
  const { colorOverrides: getColorOverrides, matchedBookingsIds } = useMemo(() => {
    const overrides: { [key: string]: string } = {};
    const updatedMatchedBookings: string[] = [];
    
    bookings.forEach(booking => {
      const matchingAirbnb = airbnbReservations.find(airbnb =>
        doBookingAndAirbnbMatch(booking, airbnb)
      );
      if (matchingAirbnb) {
        updatedMatchedBookings.push(booking.id);
      }
    });
    
    
    // ÉTAPE 2: Appliquer les couleurs avec conflits inclus
    // Unified 2-state color logic:
    //   ROUGE = conflit
    //   GRIS  = terminé (documents contract + police présents)
    //   NOIR  = en attente (documents manquants)
    bookings.forEach(booking => {
      if (conflicts.includes(booking.id)) {
        overrides[booking.id] = BOOKING_COLORS.conflict.tailwind;
      } else {
        const hasDocs = booking.documentsGenerated?.contract && booking.documentsGenerated?.policeForm;
        overrides[booking.id] = hasDocs
          ? BOOKING_COLORS.completed.tailwind   // Gris clair
          : 'bg-[#222222]';                     // Noir
      }
    });

    airbnbReservations.forEach(reservation => {
      const hasManualMatch = bookings.some(booking =>
        doBookingAndAirbnbMatch(booking, reservation)
      );
      
      if (!hasManualMatch) {
        if (conflicts.includes(reservation.id)) {
          overrides[reservation.id] = BOOKING_COLORS.conflict.tailwind;
        } else {
          // Airbnb-only reservations are always "en attente" (noir) since no docs
          overrides[reservation.id] = 'bg-[#222222]';
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

  // Combine bookings et Airbnb (logique centralisée : domain/calendarReservationModel).
  const allReservations = useMemo(
    () =>
      mergeBookingsWithAirbnbForCalendar(
        bookings,
        FRONT_CALENDAR_ICS_SYNC_ENABLED ? airbnbReservations : [],
      ).allRows,
    [bookings, airbnbReservations],
  );

  // Generate calendar days
  const calendarDays = useMemo(() => generateCalendarDays(currentDate), [currentDate]);

  // ✅ NETTOYAGE LOGS : Supprimé pour éviter les boucles infinies et le crash du navigateur
  // Ce useEffect était déclenché à chaque changement de bookings/airbnbReservations et causait des re-rendus infinis
  // useEffect(() => {
  //   if (!debugMode) return;
  //   console.log('📅 [CALENDAR DIAGNOSTIC] Réservations reçues:', ...);
  // }, [bookings, airbnbReservations, allReservations, currentDate, debugMode]);

  // Calculate booking positions for continuous bars
  const bookingLayout = useMemo(() => {
    // ✅ NETTOYAGE LOGS : Supprimé pour éviter les boucles infinies
    // if (debugMode) {
    //   console.log('📅 [CALENDAR DIAGNOSTIC] Calcul du layout avec', allReservations.length, 'réservations');
    // }

    const layout = calculateBookingLayout(calendarDays, allReservations, colorOverrides);

    // ✅ NETTOYAGE LOGS : Supprimé pour éviter les boucles infinies
    // Ces logs étaient dans un useMemo et s'exécutaient à chaque re-render
    // if (debugMode) {
    //   console.log('📅 [CALENDAR DIAGNOSTIC] Layout calculé:', ...);
    // }

    return layout;
  }, [calendarDays, allReservations, colorOverrides, debugMode]);

  // ✅ NOUVEAU : Résumé de debug pour vérifier concrètement les dates chargées
  const debugDateSummary = useMemo(() => {
    if (!debugMode) return null;

    const manualStarts = bookings.map(b => new Date(b.checkInDate));
    const manualEnds = bookings.map(b => new Date(b.checkOutDate));
    const airbnbStarts = airbnbReservations.map(r => new Date(r.startDate));
    const airbnbEnds = airbnbReservations.map(r => new Date(r.endDate));

    const allStarts = [...manualStarts, ...airbnbStarts].filter(d => !isNaN(d.getTime()));
    const allEnds = [...manualEnds, ...airbnbEnds].filter(d => !isNaN(d.getTime()));

    if (allStarts.length === 0 || allEnds.length === 0) {
      return {
        manualCount: bookings.length,
        airbnbCount: airbnbReservations.length,
        earliest: null as Date | null,
        latest: null as Date | null
      };
    }

    const earliest = new Date(Math.min(...allStarts.map(d => d.getTime())));
    const latest = new Date(Math.max(...allEnds.map(d => d.getTime())));

    return {
      manualCount: bookings.length,
      airbnbCount: airbnbReservations.length,
      earliest,
      latest
    };
  }, [debugMode, bookings, airbnbReservations]);


  // ✅ CORRIGÉ : Utiliser les conflits déjà calculés plus haut (pas besoin de les recalculer)
  // Les conflits sont utilisés dans colorOverrides et passés au CalendarGrid

  // Conflict details: same filters as detectBookingConflicts (isValidated + sameRef skip)
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

    const formatDate = (date: Date) =>
      date.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });

    for (let i = 0; i < allReservations.length; i++) {
      for (let j = i + 1; j < allReservations.length; j++) {
        const res1 = allReservations[i];
        const res2 = allReservations[j];
        if (res1.id === res2.id) continue;

        const isAirbnb1 = 'source' in res1 && res1.source === 'airbnb';
        const isAirbnb2 = 'source' in res2 && res2.source === 'airbnb';

        const ref1 = isAirbnb1
          ? (res1 as unknown as AirbnbReservation).airbnbBookingId
          : (res1 as Booking).bookingReference;
        const ref2 = isAirbnb2
          ? (res2 as unknown as AirbnbReservation).airbnbBookingId
          : (res2 as Booking).bookingReference;

        if (isSameReservationByRef(ref1, ref2)) continue;

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

        const normStart1 = new Date(start1.getFullYear(), start1.getMonth(), start1.getDate());
        const normEnd1 = new Date(end1.getFullYear(), end1.getMonth(), end1.getDate());
        const normStart2 = new Date(start2.getFullYear(), start2.getMonth(), start2.getDate());
        const normEnd2 = new Date(end2.getFullYear(), end2.getMonth(), end2.getDate());

        const overlaps = normStart1 < normEnd2 && normStart2 < normEnd1;
        if (!overlaps) continue;

        if (normEnd1.getTime() <= normStart2.getTime() || normEnd2.getTime() <= normStart1.getTime()) continue;

        const docStatus1 = !isAirbnb1 ? getBookingDocumentStatus(res1) : null;
        const docStatus2 = !isAirbnb2 ? getBookingDocumentStatus(res2) : null;
        const validated1 = docStatus1?.isValidated === true;
        const validated2 = docStatus2?.isValidated === true;
        if (!validated1 || !validated2) continue;

        const name1 = getBookingDisplayTitle(res1);
        const name2 = getBookingDisplayTitle(res2);

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

    return conflictsList;
  }, [allReservations]);

  // ✅ FIGMA : Groupes de conflits pour le cadran (composantes connexes + position dans le calendrier)
  const conflictGroupsWithPosition = useMemo((): ConflictGroupForCalendar[] => {
    if (conflictDetails.length === 0) return [];

    // Union-Find pour regrouper les ids en composantes connexes
    const parent = new Map<string, string>();
    const find = (id: string): string => {
      if (!parent.has(id)) parent.set(id, id);
      const p = parent.get(id)!;
      return p === id ? id : find(p);
    };
    const union = (a: string, b: string) => {
      parent.set(find(a), find(b));
    };
    conflictDetails.forEach(({ id1, id2 }) => union(id1, id2));
    const groupsById = new Map<string, string[]>();
    Array.from(new Set(conflictDetails.flatMap((c) => [c.id1, c.id2]))).forEach((id) => {
      const root = find(id);
      if (!groupsById.has(root)) groupsById.set(root, []);
      if (!groupsById.get(root)!.includes(id)) groupsById.get(root)!.push(id);
    });
    const idGroups = Array.from(groupsById.values());

    const weeks: { date: Date; isCurrentMonth: boolean; dayNumber: number }[][] = [];
    for (let i = 0; i < calendarDays.length; i += 7) {
      weeks.push(calendarDays.slice(i, i + 7).map((d) => ({ date: d.date, isCurrentMonth: d.isCurrentMonth, dayNumber: d.dayNumber })));
    }

    const toLocalMidnight = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const formatDDMM = (date: Date) => {
      const d = date.getDate();
      const m = date.getMonth() + 1;
      return `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}`;
    };

    return idGroups.map((ids) => {
      const reservationsInGroup = ids
        .map((id) => allReservations.find((r) => r.id === id))
        .filter(Boolean) as (Booking | AirbnbReservation)[];
      if (reservationsInGroup.length === 0) {
        return {
          groupKey: ids.slice().sort().join(','),
          ids,
          weekSegments: [],
          primaryReservation: { displayName: '', startFormatted: '', endFormatted: '' },
          reservations: [],
        };
      }
      const starts = reservationsInGroup.map((r) =>
        'source' in r && r.source === 'airbnb'
          ? toLocalMidnight((r as AirbnbReservation).startDate)
          : toLocalMidnight(new Date((r as Booking).checkInDate))
      );
      const ends = reservationsInGroup.map((r) =>
        'source' in r && r.source === 'airbnb'
          ? toLocalMidnight((r as AirbnbReservation).endDate)
          : toLocalMidnight(new Date((r as Booking).checkOutDate))
      );
      const groupStart = new Date(Math.min(...starts.map((d) => d.getTime())));
      const groupEnd = new Date(Math.max(...ends.map((d) => d.getTime())));

      const reservations = reservationsInGroup.map((r) => {
        const start = 'source' in r && r.source === 'airbnb' ? (r as AirbnbReservation).startDate : new Date((r as Booking).checkInDate);
        const end = 'source' in r && r.source === 'airbnb' ? (r as AirbnbReservation).endDate : new Date((r as Booking).checkOutDate);
        return {
          id: r.id,
          displayName: getBookingDisplayTitle(r) || 'Réservation',
          startFormatted: formatDDMM(toLocalMidnight(start)),
          endFormatted: formatDDMM(toLocalMidnight(end)),
        };
      });

      const sortedByStart = [...reservationsInGroup].sort((a, b) => {
        const startA = 'source' in a && a.source === 'airbnb' ? (a as AirbnbReservation).startDate.getTime() : new Date((a as Booking).checkInDate).getTime();
        const startB = 'source' in b && b.source === 'airbnb' ? (b as AirbnbReservation).startDate.getTime() : new Date((b as Booking).checkInDate).getTime();
        return startA - startB;
      });
      const primaryRes = reservations.find((r) => r.id === sortedByStart[0].id)!;
      const primaryReservation = primaryRes
        ? { displayName: primaryRes.displayName, startFormatted: primaryRes.startFormatted, endFormatted: primaryRes.endFormatted }
        : { displayName: reservations[0].displayName, startFormatted: reservations[0].startFormatted, endFormatted: reservations[0].endFormatted };

      const weekSegments: Array<{ weekIndex: number; startDayIndex: number; span: number }> = [];
      for (let w = 0; w < weeks.length; w++) {
        const week = weeks[w];
        let segStart = -1;
        let segEnd = -1;
        for (let dayIndex = 0; dayIndex < 7; dayIndex++) {
          const dayDate = toLocalMidnight(week[dayIndex].date);
          const inRange = dayDate.getTime() >= groupStart.getTime() && dayDate.getTime() <= groupEnd.getTime();
          if (inRange && week[dayIndex].isCurrentMonth) {
            if (segStart === -1) segStart = dayIndex;
            segEnd = dayIndex;
          }
        }
        if (segStart !== -1 && segEnd !== -1) {
          weekSegments.push({ weekIndex: w, startDayIndex: segStart, span: segEnd - segStart + 1 });
        }
      }

      return {
        groupKey: ids.slice().sort().join(','),
        ids,
        weekSegments,
        primaryReservation,
        reservations,
      };
    }).filter((g) => g.reservations.length > 0);
  }, [conflictDetails, allReservations, calendarDays]);

  const getStats = useMemo(() => {
    const completed = bookings.filter(b =>
      b.documentsGenerated?.contract && b.documentsGenerated?.policeForm
    ).length;

    const totalBookings = bookings.length + airbnbReservations.filter(r =>
      !matchedBookings.includes(r.id)
    ).length;
    
    const pending = totalBookings - completed;
    const conflictsCount = conflicts.length;

    return { completed, pending, conflicts: conflictsCount };
  }, [bookings, airbnbReservations, matchedBookings, conflicts]);

  // Auto-confirm matched bookings: only mark as 'confirmed' (not 'completed')
  // 'completed' requires actual documents (contract + police). Matching Airbnb dates
  // only proves the reservation exists, not that guest has submitted documents.
  useEffect(() => {
    if (matchedBookings.length === 0) return;
    
    Promise.all(
      matchedBookings.map(async (id) => {
        const b = bookings.find((bk) => bk.id === id);
        if (!b) return;

        const hasAllDocuments = b.documentsGenerated?.contract && b.documentsGenerated?.policeForm;

        if (hasAllDocuments && b.status !== 'completed') {
          const { error } = await supabase.from('bookings').update({ status: 'completed' }).eq('id', id);
          if (error) console.error('❌ Erreur mise à jour statut completed:', error);
        } else if (!hasAllDocuments && b.status === 'pending') {
          const { error } = await supabase.from('bookings').update({ status: 'confirmed' }).eq('id', id);
          if (error) console.error('❌ Erreur mise à jour statut confirmed:', error);
        }
      })
    ).catch((error) => {
      console.error('❌ Erreur lors de la mise à jour des statuts:', error);
    });
  }, [matchedBookings, bookings]);

  return (
    <div className={cn(
      "space-y-3 sm:space-y-4",
      isMobile && "px-2"
    )}>
      {/* Conflicts Alert - Desktop : clic = scroll vers le calendrier + ouverture du premier conflit */}
      {!isMobile && conflicts.length > 0 && (
        <Alert
          role="button"
          tabIndex={0}
          className={cn(
            "border-destructive p-3 text-sm cursor-pointer hover:bg-destructive/5 transition-colors",
            "focus:outline-none focus:ring-2 focus:ring-destructive/20 focus:ring-offset-2"
          )}
          onClick={() => {
            const first = conflictGroupsWithPosition[0];
            if (first?.weekSegments.length) {
              setOpenConflictFromAlert({ groupKey: first.groupKey, weekIndex: first.weekSegments[0].weekIndex });
            }
            calendarSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              const first = conflictGroupsWithPosition[0];
              if (first?.weekSegments.length) {
                setOpenConflictFromAlert({ groupKey: first.groupKey, weekIndex: first.weekSegments[0].weekIndex });
              }
              calendarSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
          }}
        >
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            <strong>{conflicts.length} conflit(s) détecté(s)</strong> — Vérifiez et cliquez sur les barres en rouge dans le calendrier pour consulter les réservations en conflit.
          </AlertDescription>
        </Alert>
      )}

      {/* ✅ MOBILE : Afficher automatiquement la modale de conflit sur mobile */}
      {isMobile && conflicts.length > 0 && !showConflictModal && (
        <Alert 
          className="border-destructive p-3 text-sm cursor-pointer"
          onClick={() => setShowConflictModal(true)}
        >
          <AlertTriangle className="h-3 w-3" />
          <AlertDescription className="text-xs">
            <strong>{conflicts.length} conflit(s) détecté(s)</strong> — Vérifiez et cliquez sur les barres en rouge (ou ici) pour consulter les réservations en conflit.
          </AlertDescription>
        </Alert>
      )}

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
          onCreateBooking={() => {
            const event = new CustomEvent('create-booking-request');
            window.dispatchEvent(event);
          }}
          stats={getStats}
          conflictDetails={conflictDetails}
          allReservations={allReservations}
          onBookingClick={handleBookingClick}
          viewMode={viewMode}
          onViewModeChange={onViewModeChange}
        />
      </ErrorBoundary>

      {/* ✅ NOUVEAU : Calendrier optimisé avec effets visuels avancés */}
      <motion.div
        ref={calendarSectionRef}
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
        
        {/* ✅ MOBILE : Utiliser CalendarMobile sur mobile, CalendarGrid sur desktop */}
        {isMobile ? (
          <CalendarMobile
            calendarDays={calendarDays}
            bookingLayout={bookingLayout}
            conflicts={conflicts}
            onBookingClick={handleBookingClick}
            currentDate={currentDate}
            onDateChange={setCurrentDate}
            allReservations={allReservations}
          />
        ) : (
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
                allReservations={allReservations}
                conflictGroupsWithPosition={conflictGroupsWithPosition}
                openConflict={openConflictFromAlert}
                onOpenConflictChange={setOpenConflictFromAlert}
                onDeleteBooking={handleCalendarDeleteBooking}
              />
            </motion.div>
          </AnimatePresence>
        )}
      </motion.div>

      {/* ✅ UNIFIÉ : Modal unique pour toutes les réservations */}
      <UnifiedBookingModal
        booking={selectedBooking}
        isOpen={!!selectedBooking}
        onClose={() => setSelectedBooking(null)}
        propertyId={propertyId}
      />

      {/* ✅ MOBILE : Modale de conflit */}
      {isMobile && (
        <ConflictModal
          isOpen={showConflictModal}
          onClose={() => setShowConflictModal(false)}
          conflictDetails={conflictDetails}
          allReservations={allReservations}
          onDeleteBooking={handleCalendarDeleteBooking}
        />
      )}

      {/* ✅ NOUVEAU : Panneau de debug visuel pour vérifier les dates ICS/manuelles */}
      {debugMode && debugDateSummary && (
        <div className="mt-4 text-xs text-muted-foreground border rounded-md p-3 bg-muted/40">
          <div className="font-semibold mb-1">Debug calendrier (dates chargées)</div>
          <div>Réservations manuelles (bookings) : {debugDateSummary.manualCount}</div>
          <div>Réservations Airbnb (ICS) : {debugDateSummary.airbnbCount}</div>
          <div>
            Période globale :{" "}
            {debugDateSummary.earliest
              ? `${debugDateSummary.earliest.toLocaleDateString('fr-FR')} → ${debugDateSummary.latest?.toLocaleDateString('fr-FR')}`
              : 'aucune date'}
          </div>
        </div>
      )}

    </div>
  );
});

// ✅ Export par défaut pour faciliter le lazy loading
export default CalendarView;