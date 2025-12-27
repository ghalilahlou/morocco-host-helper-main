import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Booking } from '@/types/booking';
import { useAuth } from '@/hooks/useAuth';
import { enrichBookingsWithGuestSubmissions, EnrichedBooking } from '@/services/guestSubmissionService';
import { validateBookingData, logDataError } from '@/utils/errorMonitoring';
import { debug, info, warn, error as logError } from '@/lib/logger';
import { multiLevelCache } from '@/services/multiLevelCache';

// ✅ Import pour le diagnostic
const normalizeDocumentFlag = (value: any): boolean => {
  if (!value) return false;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value > 0;
  if (typeof value === 'string') return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === 'object') {
    if ('completed' in value) return Boolean(value.completed);
    if ('isSigned' in value) return Boolean((value as any).isSigned);
    if ('signed' in value) return Boolean((value as any).signed);
    if ('status' in value) {
      const status = String((value as any).status || '').toLowerCase();
      return ['generated', 'completed', 'signed', 'valid', 'validated', 'valide', 'ready'].includes(status);
    }
    if ('url' in value) return Boolean((value as any).url);
    if ('value' in value) return Boolean((value as any).value);
    if ('timestamp' in value) return Boolean((value as any).timestamp);
    return Object.keys(value).length > 0;
  }
  return false;
};

// ✅ PHASE 1 : Cache mémoire pour les bookings
interface CacheEntry {
  data: EnrichedBooking[];
  timestamp: number;
}

const bookingsCache = new Map<string, CacheEntry>();
// ✅ OPTIMISATION : Cache augmenté à 60s pour réduire les requêtes
const BOOKINGS_CACHE_DURATION = 60000; // 60 secondes

interface UseBookingsOptions {
  propertyId?: string;
  dateRange?: {
    start: Date;
    end: Date;
  };
  limit?: number; // Pagination
}

export const useBookings = (options?: UseBookingsOptions) => {
  const { propertyId, dateRange, limit = 50 } = options || {}; // ✅ OPTIMISATION : Réduire la limite par défaut de 100 à 50 pour éviter les timeouts
  const [bookings, setBookings] = useState<EnrichedBooking[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isEnriching, setIsEnriching] = useState(false); // ✅ NOUVEAU : État pour l'enrichissement en cours
  const loadingRef = useRef(false);
  const enrichmentInProgressRef = useRef<Set<string>>(new Set()); // ✅ NOUVEAU : Suivre les bookings en cours d'enrichissement
  // ✅ NOUVEAU : Cache des IDs de bookings pour éviter les rafraîchissements inutiles
  const lastBookingIdsRef = useRef<Set<string>>(new Set());
  // ✅ NETTOYAGE STRICT : Référence du propertyId précédent pour détecter les changements
  const previousPropertyIdRef = useRef<string | undefined>(propertyId);
  // ✅ STABILISATION : Flag pour nettoyer le cache une seule fois au chargement initial
  const cacheCleanedRef = useRef(false);
  // ✅ STABILISATION : Flag pour empêcher les appels multiples à get-guest-documents-unified
  const documentsGenerationCalledRef = useRef<Set<string>>(new Set());
  const { user } = useAuth();

  // ✅ STABILISATION : Filtrer les bookings par propertyId avec useMemo pour éviter les re-rendus infinis
  const filteredBookings = useMemo(() => {
    if (!propertyId) return bookings;
    return bookings.filter(b => b.propertyId === propertyId);
  }, [bookings, propertyId]);

  // ✅ NETTOYAGE STRICT : Vider l'état si le propertyId change
  useEffect(() => {
    const currentPropertyId = propertyId;
    const previousPropertyId = previousPropertyIdRef.current;
    
    // Si le propertyId a changé, vider complètement l'état des réservations
    if (previousPropertyId !== undefined && previousPropertyId !== currentPropertyId) {
      console.log('🧹 [USE BOOKINGS] Nettoyage strict : propertyId a changé, vidage de l\'état', {
        previousPropertyId,
        currentPropertyId
      });
      
      // Vider l'état immédiatement
      setBookings([]);
      setIsLoading(true);
      
      // Nettoyer les références
      lastBookingIdsRef.current.clear();
      enrichmentInProgressRef.current.clear();
      
      // ✅ NETTOYAGE COMPLET : Invalider TOUS les caches liés à l'ancien propertyId
      if (previousPropertyId) {
        const oldCacheKey = `bookings-${previousPropertyId}`;
        multiLevelCache.invalidate(oldCacheKey).catch(() => {});
        bookingsCache.delete(oldCacheKey);
      }
      
      // ✅ NETTOYAGE PRÉVENTIF : Invalider aussi le cache du nouveau propertyId s'il existe déjà (au cas où il serait pollué)
      // ✅ NETTOYAGE LOGS : Supprimé le log pour éviter les re-rendus infinis
      if (currentPropertyId) {
        const newCacheKey = `bookings-${currentPropertyId}`;
        multiLevelCache.invalidate(newCacheKey).catch(() => {});
        bookingsCache.delete(newCacheKey);
        // Réinitialiser le flag de nettoyage pour permettre un nouveau nettoyage pour la nouvelle propriété
        cacheCleanedRef.current = false;
      }
    }
    
    // Mettre à jour la référence
    previousPropertyIdRef.current = currentPropertyId;
  }, [propertyId]); // ✅ NETTOYAGE STRICT : Se déclencher uniquement quand propertyId change

  // ✅ PHASE 1 : Recharger quand propertyId change (après le nettoyage)
  useEffect(() => {
    loadBookings();
  }, [propertyId]); // ✅ PHASE 1 : Recharger quand propertyId change

  // Reload bookings when user changes
  useEffect(() => {
    if (user) {
      loadBookings();
    }
  }, [user?.id, propertyId]); // ✅ PHASE 1 : Inclure propertyId dans les dépendances

  // ✅ AMÉLIORATION : Set up real-time subscriptions for automatic updates avec debounce optimisé
  useEffect(() => {
    if (!user) return;

    debug('Setting up real-time subscriptions for bookings and guests');

    // ✅ PROTECTION : Éviter les boucles infinies et les appels multiples
    let isProcessing = false;
    let debounceTimeout: NodeJS.Timeout | null = null;
    const DEBOUNCE_DELAY = 100; // ✅ OPTIMISÉ : Réduit de 300ms à 100ms pour une réactivité plus rapide
    
    const debouncedLoadBookings = () => {
      if (debounceTimeout) {
        clearTimeout(debounceTimeout);
      }
      
      debounceTimeout = setTimeout(() => {
        if (!isProcessing) {
          isProcessing = true;
          debug('Real-time: Déclenchement rafraîchissement automatique');
          loadBookings().finally(() => {
            isProcessing = false;
          });
        }
      }, DEBOUNCE_DELAY);
    };
    
    // ✅ PHASE 1 : Filtrer les subscriptions par property_id si fourni
    const channelName = propertyId 
      ? `bookings-realtime-${user.id}-${propertyId}`
      : `bookings-realtime-${user.id}`;
    
    // Subscribe to changes in bookings table
    const bookingsChannel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*', // INSERT, UPDATE, DELETE
          schema: 'public',
          table: 'bookings',
          // ✅ PHASE 1 : Filtrer par property_id si fourni
          filter: propertyId ? `property_id=eq.${propertyId}` : undefined
        },
        (payload) => {
          const bookingId = payload.new?.id || payload.old?.id;
          const propertyId = payload.new?.property_id || payload.old?.property_id;
          
          debug('Real-time: Changement détecté dans bookings', {
            event: payload.eventType,
            id: bookingId,
            propertyId: propertyId
          });
          
          // ✅ PHASE 1 : Vérifier que l'événement concerne la propriété courante
          const eventPropertyId = payload.new?.property_id || payload.old?.property_id;
          if (propertyId && eventPropertyId !== propertyId) {
            debug('Real-time: Événement ignoré (propriété différente)', {
              eventPropertyId,
              currentPropertyId: propertyId
            });
            return; // Ignorer les événements pour d'autres propriétés
          }
          
          // ✅ OPTIMISATION : Mise à jour optimiste immédiate pour INSERT
          if (payload.eventType === 'INSERT' && payload.new) {
            const newBooking = payload.new;
            
            // ✅ DIAGNOSTIC : Vérifier si c'est vraiment une nouvelle réservation
            const isNewInRef = !lastBookingIdsRef.current.has(newBooking.id);
            
            // ✅ PROTECTION : Ne pas ajouter si déjà dans l'état (évite les doublons)
            setBookings(prev => {
              const existsInState = prev.some(b => b.id === newBooking.id);
              
              if (existsInState) {
                debug('⚠️ [REAL-TIME] Réservation déjà présente dans l\'état, ignorée', {
                  bookingId: newBooking.id.substring(0, 8),
                  currentCount: prev.length
                });
                return prev; // Ne pas modifier l'état
              }
              
              if (isNewInRef) {
                debug('Real-time: Nouvelle réservation détectée, mise à jour optimiste', {
                  bookingId: newBooking.id.substring(0, 8),
                  propertyId: newBooking.property_id,
                  expectedPropertyId: propertyId
                });
                
                // ✅ PHASE 2 : Invalider le cache multi-niveaux (async sans await)
                const cacheKey = propertyId ? `bookings-${propertyId}` : `bookings-all-${user?.id || 'anonymous'}`;
                multiLevelCache.invalidatePattern(cacheKey).catch(() => {}); // Ignorer les erreurs
                bookingsCache.delete(cacheKey);
                
                // Ajouter temporairement (sera remplacé par loadBookings complet)
                const tempBooking: Booking = {
                  id: newBooking.id,
                  propertyId: newBooking.property_id,
                  checkInDate: newBooking.check_in_date,
                  checkOutDate: newBooking.check_out_date,
                  numberOfGuests: newBooking.number_of_guests,
                  bookingReference: newBooking.booking_reference,
                  guest_name: newBooking.guest_name,
                  status: newBooking.status as any,
                  guests: [],
                  createdAt: newBooking.created_at,
                  documentsGenerated: { policeForm: false, contract: false }
                };
                lastBookingIdsRef.current.add(newBooking.id);
                return [tempBooking, ...prev];
              }
              
              return prev; // Pas de changement
            });
          }
          
          // ✅ OPTIMISATION : Mise à jour optimiste pour UPDATE
          if (payload.eventType === 'UPDATE' && payload.new) {
            const updatedBooking = payload.new;
            debug('Real-time: Réservation mise à jour, mise à jour optimiste');
            
            // ✅ PHASE 2 : Invalider le cache multi-niveaux (async sans await)
            const cacheKey = propertyId ? `bookings-${propertyId}` : `bookings-all-${user?.id || 'anonymous'}`;
            multiLevelCache.invalidatePattern(cacheKey).catch(() => {}); // Ignorer les erreurs
            bookingsCache.delete(cacheKey);
            
            setBookings(prev => prev.map(b => 
              b.id === updatedBooking.id 
                ? { ...b, 
                    checkInDate: updatedBooking.check_in_date,
                    checkOutDate: updatedBooking.check_out_date,
                    numberOfGuests: updatedBooking.number_of_guests,
                    status: updatedBooking.status as any
                  }
                : b
            ));
          }
          
          // ✅ OPTIMISATION : Suppression optimiste pour DELETE
          if (payload.eventType === 'DELETE' && payload.old) {
            debug('Real-time: Réservation supprimée, suppression optimiste');
            
            // ✅ PHASE 2 : Invalider le cache multi-niveaux (async sans await)
            const cacheKey = propertyId ? `bookings-${propertyId}` : `bookings-all-${user?.id || 'anonymous'}`;
            multiLevelCache.invalidatePattern(cacheKey).catch(() => {}); // Ignorer les erreurs
            bookingsCache.delete(cacheKey);
            
            setBookings(prev => prev.filter(b => b.id !== payload.old.id));
            lastBookingIdsRef.current.delete(payload.old.id);
          }
          
          // Rafraîchissement complet en arrière-plan pour obtenir les données complètes
          debouncedLoadBookings();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'guests'
        },
        (payload) => {
          debug('Real-time: Changement détecté dans guests', {
            event: payload.eventType,
            bookingId: payload.new?.booking_id || payload.old?.booking_id
          });
          debouncedLoadBookings();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'guest_submissions'
        },
        (payload) => {
          debug('Real-time: Changement détecté dans guest_submissions', {
            event: payload.eventType,
            bookingId: payload.new?.booking_id || payload.old?.booking_id
          });
          debouncedLoadBookings();
        }
      )
      .subscribe((status) => {
        debug('Real-time: Statut subscription', { status });
      });

    return () => {
      debug('Cleaning up real-time subscriptions');
      if (debounceTimeout) {
        clearTimeout(debounceTimeout);
      }
      supabase.removeChannel(bookingsChannel);
    };
  }, [user?.id, propertyId]); // ✅ PHASE 1 : Inclure propertyId dans les dépendances

  // ✅ STABILISATION : Fonction helper pour appeler get-guest-documents-unified UNE SEULE FOIS par session/propertyId
  const callDocumentsGenerationOnce = useCallback(async (currentPropertyId: string | undefined) => {
    if (!currentPropertyId) return;
    
    // ✅ STABILISATION : Vérifier si l'appel a déjà été fait pour cette propriété
    const callKey = `doc-gen-${currentPropertyId}`;
    if (documentsGenerationCalledRef.current.has(callKey)) {
      // ✅ NETTOYAGE LOGS : Supprimé pour éviter les re-rendus
      return;
    }
    
    // ✅ STABILISATION : Marquer comme appelé immédiatement pour éviter les appels multiples
    documentsGenerationCalledRef.current.add(callKey);
    
    // Appeler de manière asynchrone pour ne pas bloquer le chargement initial
    setTimeout(async () => {
      try {
        // ✅ NETTOYAGE LOGS : Supprimé pour éviter les re-rendus
        const { data, error } = await supabase.functions.invoke('get-guest-documents-unified', {
          body: { propertyId: currentPropertyId }
        });
        
        if (error) {
          // ✅ NETTOYAGE LOGS : Supprimé pour éviter les re-rendus
          // En cas d'erreur, retirer la clé pour permettre un nouvel essai
          documentsGenerationCalledRef.current.delete(callKey);
        } else {
          // ✅ NETTOYAGE LOGS : Supprimé pour éviter les re-rendus
          // Ne PAS appeler loadBookings() ici pour éviter la boucle infinie
          // Les documents seront chargés au prochain chargement naturel
        }
      } catch (err) {
        // ✅ NETTOYAGE LOGS : Supprimé pour éviter les re-rendus
        // En cas d'exception, retirer la clé pour permettre un nouvel essai
        documentsGenerationCalledRef.current.delete(callKey);
      }
    }, 2000); // Délai augmenté à 2s pour éviter les appels trop fréquents
  }, []);
  
  // ✅ STABILISATION : Envelopper loadBookings dans useCallback pour éviter les re-rendus infinis
  const loadBookings = useCallback(async () => {
    try {
      // ✅ PROTECTION : Éviter les appels multiples simultanés avec une ref indépendante de l'état React
      if (loadingRef.current) {
        // ✅ NETTOYAGE LOGS : Supprimé pour éviter les re-rendus
        return;
      }
      
      // ✅ NETTOYAGE CACHE : Vider le cache une seule fois au chargement initial pour éliminer les données polluées
      if (propertyId && !cacheCleanedRef.current) {
        try {
          const cacheKeyToClean = `bookings-${propertyId}`;
          await multiLevelCache.invalidate(cacheKeyToClean).catch(() => {});
          bookingsCache.delete(cacheKeyToClean);
          cacheCleanedRef.current = true;
        } catch (e) {
          // Ignorer les erreurs de nettoyage
        }
      }
      
      // ✅ NETTOYAGE PRÉVENTIF : Invalider le cache si propertyId est défini pour éviter la pollution
      if (propertyId) {
        const cacheKeyToCheck = `bookings-${propertyId}`;
        const cached = await multiLevelCache.get<EnrichedBooking[]>(cacheKeyToCheck);
        if (cached) {
          const cachedPropertyIds = [...new Set(cached.map(b => b.propertyId).filter(Boolean))];
          const hasWrongPropertyIds = cachedPropertyIds.some(id => id !== propertyId);
          if (hasWrongPropertyIds || cachedPropertyIds.length > 1) {
            // ✅ PERFORMANCE : Logger seulement une fois par session
            // ✅ PROTECTION : Gérer les erreurs sessionStorage (peut ne pas être disponible)
            try {
              const cleanupKey = `cache-cleanup-${propertyId}`;
              const hasLoggedCleanup = typeof sessionStorage !== 'undefined' ? sessionStorage.getItem(cleanupKey) : null;
              if (!hasLoggedCleanup) {
                console.warn('🧹 [USE BOOKINGS] Nettoyage préventif : Cache pollué détecté, invalidation', {
                  cacheKey: cacheKeyToCheck,
                  expectedPropertyId: propertyId,
                  cachedPropertyIds,
                  cachedCount: cached.length,
                  note: 'Ce message ne s\'affichera qu\'une fois par session'
                });
                if (typeof sessionStorage !== 'undefined') {
                  sessionStorage.setItem(cleanupKey, 'true');
                }
              }
            } catch (e) {
              // ✅ PROTECTION : Si sessionStorage n'est pas disponible, logger quand même
              console.warn('🧹 [USE BOOKINGS] Nettoyage préventif : Cache pollué détecté, invalidation', {
                cacheKey: cacheKeyToCheck,
                expectedPropertyId: propertyId,
                cachedPropertyIds,
                cachedCount: cached.length
              });
            }
            await multiLevelCache.invalidate(cacheKeyToCheck);
            bookingsCache.delete(cacheKeyToCheck);
          }
        }
      }
      
      // ✅ PHASE 2 : Vérifier le cache multi-niveaux d'abord
      const dateRangeKey = dateRange 
        ? `-${dateRange.start.toISOString().split('T')[0]}-${dateRange.end.toISOString().split('T')[0]}`
        : '';
      const cacheKey = propertyId 
        ? `bookings-${propertyId}${dateRangeKey}` 
        : `bookings-all-${user?.id || 'anonymous'}${dateRangeKey}`;
      
      const cached = await multiLevelCache.get<EnrichedBooking[]>(cacheKey);
      if (cached) {
        // ✅ ISOLATION STRICTE DU CACHE : Vérifier que le cache contient UNIQUEMENT les bonnes données
        const cachedPropertyIds = [...new Set(cached.map(b => b.propertyId).filter(Boolean))];
        const hasWrongPropertyIds = propertyId && cachedPropertyIds.some(id => id !== propertyId);
        const hasMultiplePropertyIds = cachedPropertyIds.length > 1;
        
        // ✅ NETTOYAGE CRITIQUE : Si le cache contient 0 réservations, l'invalider immédiatement
        if (cached.length === 0) {
          console.warn('⚠️ [USE BOOKINGS] Cache contient 0 réservations, invalidation immédiate', {
            cacheKey,
            propertyId
          });
          await multiLevelCache.invalidate(cacheKey);
          bookingsCache.delete(cacheKey);
        } 
        // ✅ ISOLATION STRICTE : Si le cache contient des réservations d'autres propriétés, VIDER IMMÉDIATEMENT
        else if (hasWrongPropertyIds || (propertyId && hasMultiplePropertyIds)) {
          const otherPropertyIds = propertyId ? cachedPropertyIds.filter(id => id !== propertyId) : [];
          // ✅ PERFORMANCE : Logger seulement une fois par session pour ne pas surcharger la console
          // ✅ PROTECTION : Gérer les erreurs sessionStorage (peut ne pas être disponible)
          try {
            const pollutionKey = `cache-pollution-${propertyId}`;
            const hasLoggedPollution = typeof sessionStorage !== 'undefined' ? sessionStorage.getItem(pollutionKey) : null;
            if (!hasLoggedPollution) {
              console.error('❌ [USE BOOKINGS] ISOLATION DU CACHE : Cache pollué par d\'autres propriétés!', {
            cacheKey,
            expectedPropertyId: propertyId,
            cachedPropertyIds,
                otherPropertyIds,
                cachedCount: cached.length,
                action: 'VIDAGE IMMÉDIAT DU CACHE',
                note: 'Ce message ne s\'affichera qu\'une fois par session'
              });
              if (typeof sessionStorage !== 'undefined') {
                sessionStorage.setItem(pollutionKey, 'true');
              }
            }
          } catch (e) {
            // ✅ PROTECTION : Si sessionStorage n'est pas disponible, logger quand même
            console.error('❌ [USE BOOKINGS] ISOLATION DU CACHE : Cache pollué par d\'autres propriétés!', {
              cacheKey,
              expectedPropertyId: propertyId,
              cachedPropertyIds,
              otherPropertyIds,
              cachedCount: cached.length,
              action: 'VIDAGE IMMÉDIAT DU CACHE'
            });
          }
          
          // ✅ NETTOYAGE STRICT : VIDER le cache immédiatement au lieu de filtrer
          await multiLevelCache.invalidate(cacheKey);
          bookingsCache.delete(cacheKey);
          
          // ✅ NETTOYAGE COMPLET : Invalider aussi tous les caches liés à d'autres propriétés
          // ✅ PERFORMANCE : Ne pas logger (trop verbeux), juste nettoyer silencieusement
          if (otherPropertyIds.length > 0) {
            // Invalider les caches des autres propriétés (silencieusement)
            for (const otherPropId of otherPropertyIds) {
              const otherCacheKey = `bookings-${otherPropId}${dateRangeKey}`;
              await multiLevelCache.invalidate(otherCacheKey).catch(() => {});
              bookingsCache.delete(otherCacheKey);
            }
          }
          
          // Ne pas utiliser le cache pollué, continuer avec le chargement
        } 
        // ✅ VALIDATION STRICTE : Vérifier que toutes les réservations correspondent au propertyId
        else if (propertyId && cached.some(b => !b.propertyId || b.propertyId !== propertyId)) {
          console.error('❌ [USE BOOKINGS] ISOLATION DU CACHE : Réservations sans propertyId ou propertyId incorrect détectées!', {
            cacheKey,
            expectedPropertyId: propertyId,
            invalidBookings: cached.filter(b => !b.propertyId || b.propertyId !== propertyId).map(b => ({
              id: b.id.substring(0, 8),
              propertyId: b.propertyId
            })),
            action: 'VIDAGE IMMÉDIAT DU CACHE'
          });
          
          // ✅ NETTOYAGE STRICT : VIDER le cache immédiatement
          await multiLevelCache.invalidate(cacheKey);
          bookingsCache.delete(cacheKey);
          
          // Ne pas utiliser le cache pollué, continuer avec le chargement
        } 
        // ✅ CACHE VALIDE : Utiliser le cache seulement s'il est strictement isolé
        else {
          debug('✅ [USE BOOKINGS] Cache valide et isolé, utilisation', { 
            cacheKey, 
            count: cached.length, 
            propertyId, 
            cachedPropertyIds,
            allMatch: propertyId ? cached.every(b => b.propertyId === propertyId) : true
          });
          setBookings(cached);
          setIsLoading(false);
          return;
        }
      }
      
      // ✅ Fallback: Vérifier aussi le cache mémoire (compatibilité)
      const memoryCached = bookingsCache.get(cacheKey);
      const now = Date.now();
      if (memoryCached && (now - memoryCached.timestamp) < BOOKINGS_CACHE_DURATION) {
        debug('Using memory cached bookings', { cacheKey, count: memoryCached.data.length });
        setBookings(memoryCached.data);
        setIsLoading(false);
        return;
      }
      
      loadingRef.current = true;
      setIsLoading(true);
      
      // Check if user is authenticated
      if (!user) {
        debug('No authenticated user, skipping booking load');
        setBookings([]);
        return;
      }
      
      debug('Loading bookings for user', { userId: user.id, propertyId, dateRange, limit });
      
      // ✅ CORRIGÉ : Détecter les erreurs CORS et utiliser directement le fallback
      // La vue matérialisée peut ne pas être accessible à cause de CORS ou peut ne pas exister
      // On essaie d'abord la vue matérialisée, mais on passe rapidement au fallback si erreur CORS
      let bookingsData, error;
      let shouldUseFallback = false;
      
      // ✅ CORRECTION CRITIQUE : La vue matérialisée retourne constamment 500
      // Désactiver temporairement la vue matérialisée et utiliser directement la table bookings
      // TODO : Réactiver la vue matérialisée une fois qu'elle sera corrigée/rafraîchie
      const USE_MATERIALIZED_VIEW = false; // ✅ DÉSACTIVÉ : La vue matérialisée retourne 500
      
      // ✅ NOUVEAU : Essayer d'abord la vue matérialisée avec détection CORS améliorée
      // ⚠️ NOTE : La vue matérialisée peut retourner 500 si v_guest_submissions a des problèmes
      // On essaie d'abord, mais on passe rapidement au fallback si erreur
      try {
        let query;
        if (USE_MATERIALIZED_VIEW) {
          // ✅ Vue matérialisée (désactivée pour l'instant)
          query = supabase
            .from('mv_bookings_enriched')
          .select(`
            id,
            property_id,
            user_id,
            check_in_date,
            check_out_date,
            number_of_guests,
            booking_reference,
            guest_name,
            status,
            created_at,
            updated_at,
            documents_generated,
            submission_id,
            property_data,
            guests_data,
            guest_submissions_data,
            guest_count,
            submission_count,
            has_submissions,
            has_signature,
            has_documents
            `);
        } else {
          // ✅ MODE NORMAL : Requête avec filtres
          const REMOVE_FILTERS_FOR_DEBUG = false;
          const SIMPLIFY_QUERY = false;
          
          if (REMOVE_FILTERS_FOR_DEBUG && SIMPLIFY_QUERY) {
            query = supabase
              .from('bookings')
              .select(`*`);
          } else if (REMOVE_FILTERS_FOR_DEBUG) {
            query = supabase
              .from('bookings')
              .select(`*, guests (*), property:properties (*)`);
          } else {
            // ✅ MODE NORMAL : Requête avec filtres par user_id et property_id
            // Note: Le filtrage des codes Airbnb est géré par calendarData.ts
            query = supabase
              .from('bookings')
              .select(`*, guests (*), property:properties (*)`)
              .eq('user_id', user.id);
        
            // Ajouter le filtre par propriété si fourni
            if (propertyId) {
              query = query.eq('property_id', propertyId);
              console.log('🔍 [USE BOOKINGS] Filtering bookings by property_id', { propertyId, userId: user.id });
            } else {
              console.warn('⚠️ [USE BOOKINGS] No propertyId provided - loading all bookings for user', { userId: user.id });
            }
          }
        }
        
        // ✅ PHASE 2 : Filtrer par date range si fourni
        if (dateRange) {
          query = query
            .gte('check_in_date', dateRange.start.toISOString().split('T')[0])
            .lte('check_out_date', dateRange.end.toISOString().split('T')[0]);
          debug('Filtering bookings by date range', { 
            start: dateRange.start.toISOString().split('T')[0],
            end: dateRange.end.toISOString().split('T')[0]
          });
        }
        
        // ✅ PHASE 2 : Ajouter pagination avec limite réduite pour éviter les timeouts
        query = query
          .order('check_in_date', { ascending: false })
          .limit(Math.min(limit, 100)); // ✅ AUGMENTÉ : Limite à 100 pour inclure toutes les réservations
        
        // ✅ NETTOYAGE LOGS : Supprimé pour éviter les boucles infinies
        // console.log('🔍 [USE BOOKINGS] Exécution de la requête', ...);
        
        // ✅ OPTIMISATION : Timeout augmenté à 20s pour laisser plus de temps à la vue matérialisée
        // La vue matérialisée peut prendre du temps si elle n'est pas rafraîchie récemment
        // Aligné avec guestSubmissionService (15s) mais un peu plus long pour les requêtes complexes
        const TIMEOUT_MS = 20000; // 20 secondes
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error(`Query timeout after ${TIMEOUT_MS/1000}s`)), TIMEOUT_MS)
        );
        
        // ✅ CORRIGÉ : Utiliser Promise.race avec gestion d'erreur améliorée
        let result: any;
        try {
          // ✅ URGENT : Exécuter la requête et capturer l'erreur directement
          // ✅ NETTOYAGE LOGS : Supprimé pour éviter les boucles infinies
          // console.log('🔍 [USE BOOKINGS] Exécution de la requête Supabase...', ...);
          
          // ✅ URGENT : Exécuter la requête directement pour capturer l'erreur
        try {
          result = await Promise.race([query, timeoutPromise]);
          } catch (queryError: any) {
            // ✅ OPTIMISATION : Ne logger que si ce n'est pas un timeout (géré ailleurs)
            if (!queryError?.message?.includes('timeout')) {
              // ✅ OPTIMISATION : Logger l'erreur une seule fois par session pour éviter la répétition
              const errorKey = `bookings-query-error-${queryError?.code || 'unknown'}`;
              const hasLoggedError = typeof sessionStorage !== 'undefined' ? sessionStorage.getItem(errorKey) : null;
              if (!hasLoggedError) {
                console.error('❌ [USE BOOKINGS] Erreur lors de l\'exécution de la requête:', {
                  message: queryError?.message,
                  code: queryError?.code,
                  details: queryError?.details,
                  hint: queryError?.hint
                });
                if (typeof sessionStorage !== 'undefined') {
                  sessionStorage.setItem(errorKey, 'true');
                }
              }
            }
            result = { data: null, error: queryError };
          }
          
          // ✅ URGENT : Si result est une promesse Supabase, attendre le résultat
          if (result && typeof result.then === 'function') {
            const resolved = await result;
            result = resolved;
          }
          
          // ✅ CORRECTION CRITIQUE : Vérifier immédiatement si la réponse contient une erreur 500
          // Même si Promise.race ne rejette pas, la requête peut retourner une erreur 500 dans la réponse
          if (result?.error) {
            const errorStatus = result.error.status || result.error.statusCode || result.error.code;
            if (errorStatus === 500 || errorStatus === '500' || result.error.message?.includes('500')) {
              console.warn('⚠️ [BOOKINGS] Erreur 500 détectée dans la réponse, passage immédiat au fallback', {
                error: result.error
              });
              error = result.error;
              bookingsData = null;
              shouldUseFallback = true;
              // Ne pas continuer avec cette réponse
              throw new Error('500 Internal Server Error from mv_bookings_enriched');
            }
          }
        } catch (raceError: any) {
          // Si c'est le timeout, créer une erreur structurée
          if (raceError?.message?.includes('timeout')) {
            // ✅ OPTIMISATION : Logger le timeout une seule fois par session pour éviter la répétition
            const timeoutKey = 'bookings-query-timeout-logged';
            const hasLoggedTimeout = typeof sessionStorage !== 'undefined' ? sessionStorage.getItem(timeoutKey) : null;
            if (!hasLoggedTimeout) {
              console.warn(`⏱️ [USE BOOKINGS] Timeout après ${TIMEOUT_MS/1000}s - Passage au fallback (ce message ne s'affichera qu'une fois par session)`, {
                timeout: TIMEOUT_MS,
                note: 'Les réservations seront chargées depuis la table bookings directement'
              });
              if (typeof sessionStorage !== 'undefined') {
                sessionStorage.setItem(timeoutKey, 'true');
              }
            }
            
            result = { 
              data: null, 
              error: { 
                code: '57014', 
                message: `Query timeout after ${TIMEOUT_MS/1000}s`,
                status: 500,
                statusCode: 500
              } 
            };
            error = result.error;
            bookingsData = null;
            shouldUseFallback = true;
          } else if (raceError?.message?.includes('500')) {
            // Erreur 500 détectée, forcer le fallback
            error = raceError;
            bookingsData = null;
            shouldUseFallback = true;
          } else {
            throw raceError;
          }
        }
        
        // ✅ CORRECTION : Ne pas utiliser result?.data si on a déjà détecté une erreur
        if (!shouldUseFallback && result) {
        bookingsData = result?.data;
        error = result?.error;
          
          // ✅ URGENT : Capturer et logger l'erreur SQL spécifique de Supabase
          if (error) {
            // ✅ OPTIMISATION : Ne logger que les erreurs non-timeout et une seule fois par session
            const errorMessage = error.message || String(error) || '';
            const isTimeout = errorMessage.includes('timeout') || (error as any).code === '57014' || (error as any).code === '23';
            
            if (!isTimeout) {
              const errorKey = `bookings-supabase-error-${(error as any).code || 'unknown'}`;
              const hasLoggedError = typeof sessionStorage !== 'undefined' ? sessionStorage.getItem(errorKey) : null;
              if (!hasLoggedError) {
                console.error('❌ [USE BOOKINGS] ERREUR SUPABASE DIRECTE:', {
                  message: error.message,
                  code: (error as any).code,
                  details: (error as any).details,
                  hint: (error as any).hint,
                  status: (error as any).status,
                  statusCode: (error as any).statusCode
                });
                if (typeof sessionStorage !== 'undefined') {
                  sessionStorage.setItem(errorKey, 'true');
                }
              }
            }
          }
          
          // ✅ NETTOYAGE LOGS : Supprimé pour éviter les boucles infinies et le crash du navigateur
          // Ce log était exécuté à chaque requête et causait des re-rendus infinis
          // console.log('📊 [USE BOOKINGS] Résultat de la requête', ...);
        }
        
        // ✅ OPTIMISATION : Détecter immédiatement les erreurs 500 dans la réponse
        // Vérifier le status HTTP de la réponse (peut être dans result.status ou error.status)
        const responseStatus = result?.status || (error as any)?.status || (error as any)?.statusCode;
        const is500Response = responseStatus === 500 || responseStatus === '500';
        
        // ✅ NOUVEAU : Détecter aussi si data est null et qu'il y a une erreur (peut indiquer un 500)
        const hasNoDataButError = !bookingsData && error;
        const errorMessage = error?.message || String(error) || '';
        const is500InMessage = errorMessage?.includes('500') || errorMessage?.includes('Internal Server Error');
        
        // ✅ CORRIGÉ : Détecter aussi les erreurs réseau qui peuvent masquer un 500
        const isNetworkError = errorMessage?.includes('Failed to fetch') || 
                               errorMessage?.includes('ERR_ABORTED') ||
                               errorMessage?.includes('ERR_FAILED');
        
        if (is500Response || 
            (error && ((error as any).status === 500 || (error as any).statusCode === 500)) ||
            (hasNoDataButError && (is500InMessage || isNetworkError))) {
          console.warn('⚠️ [BOOKINGS] Erreur 500 ou réseau détectée immédiatement, passage au fallback', {
            responseStatus,
            errorStatus: (error as any)?.status,
            errorCode: (error as any)?.code,
            errorMessage: error?.message,
            hasData: !!bookingsData,
            hasError: !!error,
            hasNoDataButError,
            is500InMessage,
            isNetworkError
          });
          // Forcer l'erreur pour déclencher le fallback
          error = error || { 
            code: '500', 
            status: 500, 
            statusCode: 500,
            message: 'Internal Server Error from mv_bookings_enriched'
          };
          // S'assurer que l'erreur a le bon format
          if (!error.status && !error.statusCode) {
            (error as any).status = 500;
            (error as any).statusCode = 500;
          }
          // Forcer le fallback
          shouldUseFallback = true;
        }
      } catch (err: any) {
        // Capturer les erreurs de réseau, timeout, CORS, ou autres erreurs non gérées
        error = err;
        bookingsData = null;
        
        // ✅ NOUVEAU : Détecter les erreurs CORS spécifiquement
        const errorMessage = err.message || String(err) || '';
        const isCorsError = 
          errorMessage.includes('CORS') ||
          errorMessage.includes('Access-Control-Allow-Origin') ||
          errorMessage.includes('blocked by CORS') ||
          errorMessage.includes('ERR_FAILED') ||
          (err.name === 'TypeError' && errorMessage.includes('Failed to fetch'));
        
        if (isCorsError) {
          console.warn('⚠️ [BOOKINGS] Erreur CORS détectée, passage immédiat au fallback vers table bookings');
          shouldUseFallback = true;
        }
        
        // ✅ CORRIGÉ : Détecter les timeouts (y compris TimeoutError et signal timed out)
        const isTimeoutError = 
          err.name === 'TimeoutError' ||
          err.message?.includes('timeout') || 
          err.message?.includes('Query timeout') ||
          err.message?.includes('signal timed out') ||
          err.code === '23' || // Code PostgreSQL pour timeout
          err.code === '57014'; // Code de timeout PostgreSQL
        
        if (isTimeoutError) {
          console.warn('⚠️ [BOOKINGS] Timeout détecté dans catch, passage au fallback', {
            errName: err.name,
            errMessage: err.message,
            errCode: err.code
          });
          error.code = error.code || '57014';
          error.status = error.status || 500;
          error.statusCode = error.statusCode || 500;
          shouldUseFallback = true;
        }
        
        // ✅ NOUVEAU : Détecter les erreurs 500 dans le catch aussi
        const errStatus = (err as any).status || (err as any).statusCode;
        const errMessage = err.message || String(err) || '';
        const is500InCatch = errStatus === 500 || errStatus === '500' || errMessage?.includes('500') || errMessage?.includes('Internal Server Error');
        
        if (is500InCatch) {
          console.warn('⚠️ [BOOKINGS] Erreur 500 détectée dans catch, passage au fallback', {
            errStatus,
            errMessage,
            errCode: err.code,
            errName: err.name
          });
          // S'assurer que l'erreur a le bon format pour déclencher le fallback
          if (!error.status && !error.statusCode) {
            error.status = 500;
            error.statusCode = 500;
          }
          shouldUseFallback = true;
        }
      }
      
      // ✅ CORRIGÉ : Utiliser le fallback si erreur CORS, erreur 500, timeout, ou vue inexistante
      // ✅ NOUVEAU : Forcer le fallback si aucune donnée n'est retournée (peut indiquer un 500)
      // ✅ CORRIGÉ : Toujours utiliser le fallback si shouldUseFallback est true (détecté dans le catch)
      if (error || shouldUseFallback || (!bookingsData && !error)) {
        // Si aucune donnée et aucune erreur explicite, c'est suspect - forcer le fallback
        if (!bookingsData && !error) {
          console.warn('⚠️ [BOOKINGS] Aucune donnée retournée sans erreur explicite, passage au fallback par sécurité');
          shouldUseFallback = true;
          error = { 
            code: 'NO_DATA', 
            status: 500, 
            statusCode: 500,
            message: 'No data returned from mv_bookings_enriched'
          } as any;
        }
        
        // ✅ PHASE 2 : Fallback si la vue matérialisée n'existe pas, erreur serveur, ou timeout
        // Détecter les erreurs 500, timeout, et autres erreurs de vue matérialisée
        const errorStatus = (error as any).status || (error as any).statusCode || (error as any).code;
        const errorMessage = error.message || String(error);
        const errorDetails = (error as any).details || '';
        const errorHint = (error as any).hint || '';
        
        // Vérifier si c'est une erreur 500 (Internal Server Error)
        const is500Error = 
          errorStatus === 500 || 
          errorStatus === '500' ||
          errorMessage?.includes('Internal Server Error') ||
          errorMessage?.includes('500');
        
        // ✅ CORRIGÉ : Vérifier si c'est un timeout (code 57014 ou 23, ou message)
        const isTimeoutError = 
          error.code === '57014' ||
          error.code === '23' || // Code PostgreSQL pour timeout
          errorMessage?.includes('timeout') ||
          errorMessage?.includes('signal timed out') ||
          errorMessage?.includes('TimeoutError') ||
          errorMessage?.includes('canceling statement due to statement timeout');
        
        // ✅ NOUVEAU : Détecter les erreurs CORS
        const isCorsError = 
          errorMessage?.includes('CORS') ||
          errorMessage?.includes('Access-Control-Allow-Origin') ||
          errorMessage?.includes('blocked by CORS') ||
          errorMessage?.includes('ERR_FAILED') ||
          (error.name === 'TypeError' && errorMessage?.includes('Failed to fetch'));
        
        const shouldFallback = 
          shouldUseFallback || // ✅ PRIORITÉ : Utiliser le flag détecté précédemment (timeout, CORS, 500)
          isCorsError || // ✅ NOUVEAU : Détecter CORS dans le message d'erreur
          errorMessage?.includes('does not exist') || 
          errorMessage?.includes('relation') || 
          errorMessage?.includes('materialized view') ||
          errorMessage?.includes('mv_bookings_enriched') ||
          error.code === '42P01' ||
          error.code === 'PGRST116' ||
          error.code === '57014' ||
          error.code === '23' || // ✅ CORRIGÉ : Code PostgreSQL pour timeout
          is500Error ||
          isTimeoutError;
        
        // ✅ DIAGNOSTIC : Log pour comprendre pourquoi le fallback n'est pas déclenché
        if (!shouldFallback && error) {
          console.warn('⚠️ [BOOKINGS] Fallback non déclenché malgré une erreur', {
            shouldUseFallback,
            isCorsError,
            is500Error,
            isTimeoutError,
            errorCode: error.code,
            errorMessage: error.message,
            errorName: error.name
          });
        }
        
        if (shouldFallback) {
          warn('Materialized view error, falling back to bookings table', { 
            error: error.message, 
            code: error.code,
            status: (error as any).status || (error as any).statusCode
          });
        
        // ✅ OPTIMISATION : Fallback optimisé - sélectionner seulement les colonnes nécessaires
        // ✅ CORRIGÉ : Ajouter le filtre user_id pour ne récupérer que les réservations de l'utilisateur
        let fallbackQuery = supabase
          .from('bookings')
          .select(`
            id,
            property_id,
            user_id,
            check_in_date,
            check_out_date,
            number_of_guests,
            booking_reference,
            guest_name,
            status,
            created_at,
            updated_at,
            documents_generated,
            guests (
              id,
              full_name,
              date_of_birth,
              nationality,
              document_number,
              booking_id
            ),
            property:properties (
              id,
              name,
              address,
              property_type
            )
          `)
          .eq('user_id', user.id); // ✅ CORRIGÉ : Filtrer par user_id pour ne récupérer que les réservations de l'utilisateur
        
        if (propertyId) {
          fallbackQuery = fallbackQuery.eq('property_id', propertyId);
        }
        
        if (dateRange) {
          fallbackQuery = fallbackQuery
            .gte('check_in_date', dateRange.start.toISOString().split('T')[0])
            .lte('check_out_date', dateRange.end.toISOString().split('T')[0]);
        }
        
        // ✅ CORRIGÉ : Utiliser check_in_date au lieu de created_at pour un meilleur tri
        // Les réservations "completed" peuvent être plus anciennes par created_at mais plus récentes par check_in_date
        const { data: fallbackData, error: fallbackError } = await fallbackQuery
          .order('check_in_date', { ascending: false })
          .limit(Math.min(limit, 100)); // ✅ AUGMENTÉ : Limite à 100 pour inclure plus de réservations "completed"
        
        // ✅ DEBUG : Logs détaillés pour diagnostiquer le problème
        debug('📊 [LOAD BOOKINGS] Résultats du fallback', {
          count: fallbackData?.length || 0,
          propertyId,
          userId: user.id,
          bookingIds: fallbackData?.map(b => ({ 
            id: b.id.substring(0, 8), 
            propertyId: b.property_id, 
            userId: b.user_id,
            status: b.status 
          })) || [],
          bookingsByStatus: {
            pending: fallbackData?.filter(b => b.status === 'pending').length || 0,
            completed: fallbackData?.filter(b => b.status === 'completed').length || 0,
            confirmed: fallbackData?.filter(b => b.status === 'confirmed').length || 0,
            archived: fallbackData?.filter(b => b.status === 'archived').length || 0,
            draft: fallbackData?.filter(b => b.status === 'draft').length || 0
          },
          error: fallbackError ? {
            message: fallbackError.message,
            code: fallbackError.code,
            details: fallbackError
          } : null
        });
        
        if (fallbackError) {
          logError('Error loading bookings (fallback)', fallbackError as Error);
          return;
        }
        
        // Utiliser les données du fallback
        const filteredBookingsData = fallbackData?.filter(booking => {
          if (booking.status === 'draft' || (booking.status as any) === 'draft') {
            return false;
          }
          return true;
        }) || [];
        
        // ✅ DEBUG : Logs après filtrage
        debug('📊 [LOAD BOOKINGS] Réservations après filtrage draft', {
          before: fallbackData?.length || 0,
          after: filteredBookingsData.length,
          filteredOut: (fallbackData?.length || 0) - filteredBookingsData.length
        });
        
        // Transformer les données de la table bookings vers le format Booking
        const transformedBookings: Booking[] = filteredBookingsData.map((booking: any) => {
          if (!booking.property_id) {
            warn('Booking sans property_id détecté et exclu (fallback)', { bookingId: booking.id });
            return null;
          }
          
          const property = Array.isArray(booking.property) ? booking.property[0] : booking.property;
          const guests = Array.isArray(booking.guests) ? booking.guests : [];
          
          return {
            id: booking.id,
            propertyId: booking.property_id,
            userId: booking.user_id,
            checkInDate: booking.check_in_date,
            checkOutDate: booking.check_out_date,
            numberOfGuests: booking.number_of_guests || 0,
            bookingReference: booking.booking_reference || '',
            guest_name: booking.guest_name || '',
            status: (booking.status || 'pending') as 'pending' | 'completed' | 'confirmed' | 'archived' | 'draft',
            createdAt: booking.created_at,
            updated_at: booking.updated_at || booking.created_at,
            // ✅ CORRECTION CRITIQUE : Préserver TOUTES les propriétés de documents_generated
            documentsGenerated: booking.documents_generated || { policeForm: false, contract: false, identity: false },
            guests: guests.map((g: any) => ({
              fullName: g.full_name || '',
              dateOfBirth: g.date_of_birth || '',
              documentNumber: g.document_number || g.passport_number || '',
              nationality: g.nationality || '',
              placeOfBirth: g.place_of_birth || '',
              documentType: g.document_type || 'PASSPORT',
              profession: g.profession || '',
              motifSejour: g.motif_sejour || 'TOURISME',
              adressePersonnelle: g.adresse_personnelle || '',
              email: g.email || null
            })),
            property: property ? {
              id: property.id,
              name: property.name || '',
              address: property.address || '',
              capacity: property.capacity || 0
            } : undefined
          };
        }).filter(Boolean) as Booking[];
        
        // ✅ DIAGNOSTIC : Log avant enrichissement
        debug('📊 [LOAD BOOKINGS] Avant enrichissement (fallback)', {
          count: transformedBookings.length,
          propertyId,
          bookingIds: transformedBookings.map(b => ({ id: b.id.substring(0, 8), propertyId: b.propertyId, status: b.status }))
        });
        
        // ✅ STABILISATION : Enrichissement désactivé pour éviter les timeouts
        // L'enrichissement est maintenant optionnel et non-bloquant
        const enrichedBookings = transformedBookings; // ✅ Utiliser les données de base sans enrichissement
        
        // ✅ DIAGNOSTIC : Vérifier les doublons avant de mettre en cache
        const uniqueIds = new Set<string>();
        const duplicates: string[] = [];
        enrichedBookings.forEach(b => {
          if (uniqueIds.has(b.id)) {
            duplicates.push(b.id.substring(0, 8));
          } else {
            uniqueIds.add(b.id);
          }
        });
        
        if (duplicates.length > 0) {
          debug('⚠️ [LOAD BOOKINGS] Doublons détectés après enrichissement (fallback)', {
            duplicates,
            total: enrichedBookings.length,
            unique: uniqueIds.size
          });
          // Supprimer les doublons
          const uniqueBookings = Array.from(uniqueIds).map(id => 
            enrichedBookings.find(b => b.id === id)!
          );
          debug('✅ [LOAD BOOKINGS] Doublons supprimés, utilisation de', uniqueBookings.length, 'réservations uniques');
          
          // ✅ ISOLATION STRICTE : Filtrer par propertyId avant de mettre en cache
          const uniqueBookingsFiltered = propertyId
            ? uniqueBookings.filter(b => b.propertyId === propertyId)
            : uniqueBookings;
          
          // ✅ OPTIMISATION : Cache augmenté à 60s
          await multiLevelCache.set(cacheKey, uniqueBookingsFiltered, 60000); // 60s memory, 5min IndexedDB
          bookingsCache.set(cacheKey, { data: uniqueBookingsFiltered, timestamp: now });
          
          setBookings(uniqueBookingsFiltered);
          return;
        }
        
        // ✅ ISOLATION STRICTE : Filtrer par propertyId avant de mettre en cache
        const enrichedBookingsFiltered = propertyId
          ? enrichedBookings.filter(b => b.propertyId === propertyId)
          : enrichedBookings;
        
        // ✅ OPTIMISATION : Cache augmenté à 60s
        await multiLevelCache.set(cacheKey, enrichedBookingsFiltered, 60000); // 60s memory, 5min IndexedDB
        bookingsCache.set(cacheKey, { data: enrichedBookingsFiltered, timestamp: now });
        
        setBookings(enrichedBookingsFiltered);
        
        // ✅ STABILISATION : Appeler get-guest-documents-unified UNE SEULE FOIS via la fonction helper
        callDocumentsGenerationOnce(propertyId);
        
        setIsLoading(false);
        loadingRef.current = false;
        return;
        } else {
          // ✅ OPTIMISATION : Si c'est un timeout, forcer le fallback même si shouldFallback n'était pas vrai
          if (isTimeoutError) {
            warn('Materialized view timeout detected, forcing fallback to bookings table', { 
              error: error.message, 
              code: error.code
            });
            
            // ✅ OPTIMISATION : Fallback timeout optimisé - sélectionner seulement les colonnes nécessaires
            // ✅ CORRIGÉ : Ajouter le filtre user_id pour ne récupérer que les réservations de l'utilisateur
            let fallbackQuery = supabase
              .from('bookings')
              .select(`
                id,
                property_id,
                user_id,
                check_in_date,
                check_out_date,
                number_of_guests,
                booking_reference,
                guest_name,
                status,
                created_at,
                updated_at,
                documents_generated,
                guests (
                  id,
                  full_name,
                  date_of_birth,
                  nationality,
                  passport_number,
                  booking_id
                ),
                property:properties (
                  id,
                  name,
                  address,
                  property_type
                )
              `)
              .eq('user_id', user.id); // ✅ CORRIGÉ : Filtrer par user_id pour ne récupérer que les réservations de l'utilisateur
            
            if (propertyId) {
              fallbackQuery = fallbackQuery.eq('property_id', propertyId);
            }
            
            if (dateRange) {
              fallbackQuery = fallbackQuery
                .gte('check_in_date', dateRange.start.toISOString().split('T')[0])
                .lte('check_out_date', dateRange.end.toISOString().split('T')[0]);
            }
            
            // ✅ CORRIGÉ : Utiliser check_in_date au lieu de created_at pour un meilleur tri
            // Les réservations "completed" peuvent être plus anciennes par created_at mais plus récentes par check_in_date
            const { data: fallbackData, error: fallbackError } = await fallbackQuery
              .order('check_in_date', { ascending: false })
              .limit(Math.min(limit, 100)); // ✅ AUGMENTÉ : Limite à 100 pour inclure plus de réservations "completed"
            
            // ✅ DEBUG : Logs détaillés pour diagnostiquer le problème (timeout fallback)
            debug('📊 [LOAD BOOKINGS] Résultats du fallback (timeout)', {
              count: fallbackData?.length || 0,
              propertyId,
              userId: user.id,
              bookingIds: fallbackData?.map(b => ({ 
                id: b.id.substring(0, 8), 
                propertyId: b.property_id, 
                userId: b.user_id,
                status: b.status 
              })) || [],
              bookingsByStatus: {
                pending: fallbackData?.filter(b => b.status === 'pending').length || 0,
                completed: fallbackData?.filter(b => b.status === 'completed').length || 0,
                confirmed: fallbackData?.filter(b => b.status === 'confirmed').length || 0,
                archived: fallbackData?.filter(b => b.status === 'archived').length || 0,
                draft: fallbackData?.filter(b => b.status === 'draft').length || 0
              },
              error: fallbackError ? {
                message: fallbackError.message,
                code: fallbackError.code,
                details: fallbackError
              } : null
            });
            
            if (fallbackError) {
              logError('Error loading bookings (fallback after timeout)', fallbackError as Error);
              setBookings([]);
              setIsLoading(false);
              loadingRef.current = false;
              return;
            }
            
            // Utiliser les données du fallback
            const filteredBookingsData = fallbackData?.filter(booking => {
              if (booking.status === 'draft' || (booking.status as any) === 'draft') {
                return false;
              }
              return true;
            }) || [];
            
            // ✅ DEBUG : Logs après filtrage (timeout fallback)
            debug('📊 [LOAD BOOKINGS] Réservations après filtrage draft (timeout)', {
              before: fallbackData?.length || 0,
              after: filteredBookingsData.length,
              filteredOut: (fallbackData?.length || 0) - filteredBookingsData.length
            });
            
            // Transformer les données de la table bookings vers le format Booking
            const transformedBookings: Booking[] = filteredBookingsData.map((booking: any) => {
              if (!booking.property_id) {
                warn('Booking sans property_id détecté et exclu (fallback timeout)', { bookingId: booking.id });
                return null;
              }
              
              const property = Array.isArray(booking.property) ? booking.property[0] : booking.property;
              const guests = Array.isArray(booking.guests) ? booking.guests : [];
              
              return {
                id: booking.id,
                propertyId: booking.property_id,
                userId: booking.user_id,
                checkInDate: booking.check_in_date,
                checkOutDate: booking.check_out_date,
                numberOfGuests: booking.number_of_guests || 0,
                bookingReference: booking.booking_reference || '',
                guest_name: booking.guest_name || '',
                status: (booking.status || 'pending') as 'pending' | 'completed' | 'confirmed' | 'archived' | 'draft',
                createdAt: booking.created_at,
                updated_at: booking.updated_at || booking.created_at,
                // ✅ CORRECTION CRITIQUE : Préserver TOUTES les propriétés de documents_generated
            documentsGenerated: booking.documents_generated || { policeForm: false, contract: false, identity: false },
                guests: guests.map((g: any) => ({
                  fullName: g.full_name || '',
                  dateOfBirth: g.date_of_birth || '',
                  documentNumber: g.document_number || '',
                  nationality: g.nationality || '',
                  placeOfBirth: g.place_of_birth || '',
                  documentType: g.document_type || 'PASSPORT',
                  profession: g.profession || '',
                  motifSejour: g.motif_sejour || 'TOURISME',
                  adressePersonnelle: g.adresse_personnelle || '',
                  email: g.email || null
                })),
                property: property ? {
                  id: property.id,
                  name: property.name || '',
                  address: property.address || '',
                  capacity: property.capacity || 0
                } : undefined
              };
            }).filter(Boolean) as Booking[];
            
            // ✅ DIAGNOSTIC : Log avant enrichissement
            debug('📊 [LOAD BOOKINGS] Avant enrichissement (fallback timeout)', {
              count: transformedBookings.length,
              propertyId,
              bookingIds: transformedBookings.map(b => ({ id: b.id.substring(0, 8), propertyId: b.propertyId, status: b.status }))
            });
            
            // ✅ STABILISATION : Enrichissement désactivé pour éviter les timeouts
            // L'enrichissement est maintenant optionnel et non-bloquant
            const enrichedBookings = transformedBookings; // ✅ Utiliser les données de base sans enrichissement
            
            // ✅ ISOLATION STRICTE : Filtrer par propertyId avant de mettre en cache
            const enrichedBookingsFiltered = propertyId
              ? enrichedBookings.filter(b => b.propertyId === propertyId)
              : enrichedBookings;
            
            // ✅ PHASE 2 : Mettre en cache multi-niveaux
            await multiLevelCache.set(cacheKey, enrichedBookingsFiltered, 60000); // 60s memory, 5min IndexedDB
            bookingsCache.set(cacheKey, { data: enrichedBookingsFiltered, timestamp: now });
            
            setBookings(enrichedBookingsFiltered);
            
            // ✅ STABILISATION : Appeler get-guest-documents-unified UNE SEULE FOIS via la fonction helper
            callDocumentsGenerationOnce(propertyId);
            
            setIsLoading(false);
            loadingRef.current = false;
            return;
          }
          
          // Si le fallback n'est pas applicable, logger l'erreur et continuer avec une liste vide
          logError('Error loading bookings from materialized view (no fallback)', error as Error);
          setBookings([]);
          setIsLoading(false);
          loadingRef.current = false;
          return;
        }
      }

      // ✅ NETTOYAGE LOGS : Supprimé pour éviter les boucles infinies et le crash du navigateur
      // Ce log était exécuté à chaque chargement et causait des re-rendus infinis
      // console.log('📊 [USE BOOKINGS] Raw bookings data loaded', ...);

      // ✅ PHASE 2 : Transformer les données (vue matérialisée ou table bookings)
      const enrichedBookings: EnrichedBooking[] = (bookingsData || []).map((booking: any) => {
        // ✅ VALIDATION CRITIQUE : Exclure les bookings sans property_id
        if (!booking.property_id) {
          warn('Booking sans property_id détecté et exclu', { bookingId: booking.id });
          return null;
        }

        // ✅ ADAPTATION : Gérer les deux sources de données
        let propertyData, guestsData, submissionsData;
        
        if (USE_MATERIALIZED_VIEW) {
          // ✅ Données depuis la vue matérialisée
          propertyData = booking.property_data || {};
          guestsData = Array.isArray(booking.guests_data) ? booking.guests_data : [];
          submissionsData = Array.isArray(booking.guest_submissions_data) ? booking.guest_submissions_data : [];
        } else {
          // ✅ Données depuis la table bookings (fallback direct)
          const property = Array.isArray(booking.property) ? booking.property[0] : booking.property;
          propertyData = property || {};
          guestsData = Array.isArray(booking.guests) ? booking.guests : [];
          submissionsData = []; // Pas de submissions_data dans la table bookings directement
        }
        
        // ✅ PHASE 2 : Extraire les noms des invités depuis les soumissions
        const realGuestNames: string[] = [];
        submissionsData.forEach((submission: any) => {
          if (submission.guest_data) {
            if (Array.isArray(submission.guest_data)) {
              submission.guest_data.forEach((guest: any) => {
                if (guest.fullName || guest.full_name) {
                  realGuestNames.push(guest.fullName || guest.full_name);
                }
              });
            } else if (typeof submission.guest_data === 'object') {
              if (submission.guest_data.guests && Array.isArray(submission.guest_data.guests)) {
                submission.guest_data.guests.forEach((guest: any) => {
                  if (guest.fullName || guest.full_name) {
                    realGuestNames.push(guest.fullName || guest.full_name);
                  }
                });
              } else if (submission.guest_data.fullName || submission.guest_data.full_name) {
                realGuestNames.push(submission.guest_data.fullName || submission.guest_data.full_name);
              }
            }
          }
        });
        
        // Nettoyer et dédupliquer les noms
        const uniqueNames = [...new Set(realGuestNames)]
          .filter(name => name && name.trim().length > 0)
          .map(name => name.trim().toUpperCase());
        
        // Fallback sur guest_name de la réservation
        if (uniqueNames.length === 0 && booking.guest_name) {
          uniqueNames.push(booking.guest_name.trim().toUpperCase());
        }
        
        // Compter les documents
        let documentsCount = 0;
        submissionsData.forEach((submission: any) => {
          if (submission.document_urls) {
            if (Array.isArray(submission.document_urls)) {
              documentsCount += submission.document_urls.length;
            } else if (typeof submission.document_urls === 'string') {
              try {
                const parsed = JSON.parse(submission.document_urls);
                if (Array.isArray(parsed)) {
                  documentsCount += parsed.length;
                }
              } catch {
                documentsCount += 1;
              }
            }
          }
        });

        const transformedBooking: EnrichedBooking = {
          id: booking.id,
          checkInDate: booking.check_in_date,
          checkOutDate: booking.check_out_date,
          numberOfGuests: booking.number_of_guests,
          bookingReference: booking.booking_reference || undefined,
          guest_name: booking.guest_name || undefined,
          propertyId: booking.property_id,
          submissionId: booking.submission_id || undefined,
          
          // ✅ PHASE 2 : Utiliser property_data de la vue matérialisée
          property: {
            id: propertyData.id || booking.property_id,
            name: propertyData.name || 'Propriété inconnue',
            property_type: propertyData.property_type || 'unknown',
            max_occupancy: propertyData.max_occupancy || 1,
            house_rules: Array.isArray(propertyData.house_rules) 
              ? propertyData.house_rules.filter(rule => typeof rule === 'string') as string[]
              : [],
            contract_template: typeof propertyData.contract_template === 'object' && propertyData.contract_template !== null 
              ? propertyData.contract_template 
              : {},
            user_id: propertyData.user_id || '',
            created_at: propertyData.created_at || '',
            updated_at: propertyData.updated_at || ''
          },
          
          // ✅ PHASE 2 : Utiliser guests_data de la vue matérialisée
          guests: guestsData.map((guest: any) => ({
            id: guest.id,
            fullName: guest.fullName || guest.full_name,
            dateOfBirth: guest.dateOfBirth || guest.date_of_birth,
            documentNumber: guest.documentNumber || guest.document_number,
            nationality: guest.nationality,
            placeOfBirth: guest.placeOfBirth || guest.place_of_birth || undefined,
            documentType: (guest.documentType || guest.document_type) as 'passport' | 'national_id'
          })),
          
          status: booking.status as 'pending' | 'completed' | 'confirmed' | 'archived' | 'draft',
          createdAt: booking.created_at,
          updated_at: booking.updated_at || booking.created_at,
          // ✅ CORRECTION CRITIQUE : Préserver TOUTES les propriétés de documents_generated
          // Ne pas limiter à { policeForm, contract } car on perd identity, contractUrl, policeUrl, etc.
          documentsGenerated: typeof booking.documents_generated === 'object' && booking.documents_generated !== null
            ? booking.documents_generated as Record<string, any>
            : { policeForm: false, contract: false, identity: false },
          
          // ✅ ADAPTATION : Données enrichies (vue matérialisée ou table bookings)
          realGuestNames: uniqueNames,
          realGuestCount: uniqueNames.length,
          hasRealSubmissions: USE_MATERIALIZED_VIEW ? (booking.has_submissions || false) : false,
          submissionStatus: {
            hasDocuments: USE_MATERIALIZED_VIEW ? (booking.has_documents || documentsCount > 0) : (documentsCount > 0),
            hasSignature: USE_MATERIALIZED_VIEW ? (booking.has_signature || false) : false,
            documentsCount: USE_MATERIALIZED_VIEW ? (documentsCount || booking.submission_count || 0) : documentsCount
          }
        };

        // ✅ VALIDATION FINALE avec monitoring
        const isValid = validateBookingData(transformedBooking, 'useBookings.transform');
        if (!isValid) {
          warn('Booking avec données invalides détecté', { bookingId: transformedBooking.id });
        }

        return transformedBooking;
      }).filter(Boolean) as EnrichedBooking[]; // ✅ Exclure les bookings null

      // ✅ CHARGEMENT LAZY/PROGRESSIF : Étape 1 - Afficher immédiatement les données de base
      // Les données de base (id, dates, status, property_id) sont déjà chargées dans enrichedBookings
      // On les affiche immédiatement sans attendre l'enrichissement
      let finalEnrichedBookings = enrichedBookings;
      
      // ✅ ÉTAPE 1 : Afficher immédiatement les réservations avec les données de base
      // ✅ PERFORMANCE : Log réduit pour éviter la surcharge
      if (process.env.NODE_ENV === 'development' && enrichedBookings.length > 0) {
        debug('✅ [LOAD BOOKINGS] Étape 1 : Affichage immédiat des réservations', {
          count: enrichedBookings.length
        });
      }
      
      // ✅ ÉTAPE 2 : Lancer l'enrichissement en arrière-plan (non-bloquant)
      if (!USE_MATERIALIZED_VIEW && enrichedBookings.length > 0) {
        // Marquer l'enrichissement comme en cours
        setIsEnriching(true);
        enrichmentInProgressRef.current = new Set(enrichedBookings.map(b => b.id));
        
        // Marquer les bookings comme "en cours de chargement" pour l'UI
        finalEnrichedBookings = enrichedBookings.map(b => ({
          ...b,
          documentsLoading: true, // ✅ Indicateur : documents en cours de chargement
          enrichmentError: false
        })) as EnrichedBooking[];
        
        // ✅ PERFORMANCE : Log réduit
        if (process.env.NODE_ENV === 'development') {
          debug('🔄 [LOAD BOOKINGS] Étape 2 : Démarrage enrichissement asynchrone', {
            count: enrichedBookings.length
          });
        }
        
        // ✅ ENRICHISSEMENT ASYNCHRONE : Enrichir en arrière-plan sans bloquer l'affichage
        enrichBookingsWithGuestSubmissions(enrichedBookings)
          .then(async (enriched) => {
            // ✅ PERFORMANCE : Log réduit
            if (process.env.NODE_ENV === 'development') {
              debug('✅ [LOAD BOOKINGS] Enrichissement terminé', { 
                count: enriched.length
              });
            }
            
            // ✅ NOUVEAU : Logique de fallback Airbnb - Générer automatiquement des documents pour les réservations Airbnb terminées sans documents
            const airbnbBookingsWithoutDocs = enriched.filter(booking => {
              // Vérifier si c'est une réservation Airbnb (avec booking_reference type Airbnb)
              const isAirbnb = booking.bookingReference && 
                booking.bookingReference !== 'INDEPENDENT_BOOKING' &&
                /^(HM|CL|PN|ZN|JN|UN|FN|HN|KN|SN|CD|QT|MB|P|ZE|JBFD|UID:)[A-Z0-9@]+/.test(booking.bookingReference);
              
              // Vérifier si elle est terminée
              const isCompleted = booking.status === 'completed';
              
              // Vérifier si elle n'a pas de documents
              const hasNoDocuments = !booking.documentsGenerated?.contract && 
                                   !booking.documentsGenerated?.policeForm &&
                                   !booking.documentsGenerated?.police &&
                                   !(booking.documentsGenerated as any)?.contractUrl &&
                                   !(booking.documentsGenerated as any)?.policeUrl;
              
              // Vérifier si elle a des guests complets (nécessaire pour générer les documents)
              const hasCompleteGuests = booking.guests && booking.guests.length > 0 &&
                booking.guests.every(guest => 
                  guest.fullName && 
                  guest.documentNumber && 
                  guest.nationality
                );
              
              return isAirbnb && isCompleted && hasNoDocuments && hasCompleteGuests;
            });
            
            // ✅ Générer automatiquement les documents pour les réservations Airbnb éligibles
            if (airbnbBookingsWithoutDocs.length > 0) {
              console.log(`🔄 [FALLBACK AIRBNB] ${airbnbBookingsWithoutDocs.length} réservation(s) Airbnb terminée(s) sans documents détectée(s) - Génération automatique...`);
              
              // Générer les documents en parallèle pour toutes les réservations éligibles
              const generationPromises = airbnbBookingsWithoutDocs.map(async (booking) => {
                try {
                  // Vérifier si on a déjà tenté de générer pour cette réservation
                  if (documentsGenerationCalledRef.current.has(booking.id)) {
                    return; // Déjà traité
                  }
                  
                  documentsGenerationCalledRef.current.add(booking.id);
                  
                  // Appeler l'Edge Function pour générer les documents
                  const { data, error } = await supabase.functions.invoke('submit-guest-info-unified', {
                    body: {
                      bookingId: booking.id,
                      action: 'generate_missing_documents',
                      documentTypes: ['contract', 'police']
                    }
                  });
                  
                  if (error) {
                    console.warn(`⚠️ [FALLBACK AIRBNB] Erreur génération documents pour ${booking.id}:`, error);
                    documentsGenerationCalledRef.current.delete(booking.id); // Retirer pour permettre un nouvel essai
                  } else if (data?.success) {
                    console.log(`✅ [FALLBACK AIRBNB] Documents générés automatiquement pour ${booking.bookingReference}`);
                  }
                } catch (err: any) {
                  console.warn(`⚠️ [FALLBACK AIRBNB] Exception génération documents pour ${booking.id}:`, err);
                  documentsGenerationCalledRef.current.delete(booking.id); // Retirer pour permettre un nouvel essai
                }
              });
              
              // Exécuter en arrière-plan sans bloquer
              Promise.allSettled(generationPromises).then(() => {
                console.log(`✅ [FALLBACK AIRBNB] Génération automatique terminée pour ${airbnbBookingsWithoutDocs.length} réservation(s)`);
                // Rafraîchir les bookings après génération
                setTimeout(() => {
                  loadBookings();
                }, 2000); // Attendre 2 secondes pour laisser le temps à la génération
              });
            }
            
            // Mettre à jour les bookings avec les données enrichies
            setBookings(prev => {
              const updated = prev.map(b => {
                const enrichedBooking = enriched.find(e => e.id === b.id);
                if (enrichedBooking) {
                  // Marquer comme enrichi
                  enrichmentInProgressRef.current.delete(b.id);
                  return enrichedBooking;
                }
                return b;
              });
              return updated;
            });
            
            setIsEnriching(false);
          })
          .catch(err => {
            // ✅ GESTION TIMEOUT AMÉLIORÉE : Détecter spécifiquement les timeouts
            const isTimeout = err?.message?.includes('timeout') || 
                             err?.message?.includes('Timeout') ||
                             err?.code === '57014' ||
                             err?.code === '23';
            
            if (isTimeout) {
              console.warn('⏱️ [LOAD BOOKINGS] Timeout lors de l\'enrichissement (non-bloquant) - Les réservations restent affichées', {
                error: err.message,
                bookingIds: enrichedBookings.map(b => b.id.substring(0, 8)),
                note: 'Le calendrier continue d\'afficher les réservations avec les données de base'
              });
            } else {
              console.warn('⚠️ [LOAD BOOKINGS] Erreur lors de l\'enrichissement (non-bloquant)', {
                error: err.message,
                bookingIds: enrichedBookings.map(b => b.id.substring(0, 8))
              });
            }
            
            // ✅ TIMEOUT GRACIEUX : Marquer les documents comme timeout (pas d'erreur, juste non vérifiés)
            // Le calendrier continue d'afficher les réservations avec les dates
      setBookings(prev => {
              return prev.map(b => {
                if (enrichmentInProgressRef.current.has(b.id)) {
                  enrichmentInProgressRef.current.delete(b.id);
                  return {
                    ...b,
                    documentsLoading: false, // ✅ Documents non chargés
                    enrichmentError: !isTimeout, // ✅ Pas d'erreur si timeout, juste non vérifiés
                    documentsTimeout: isTimeout ? true : false // ✅ TIMEOUT GRACIEUX : Indicateur spécifique pour timeout
                  } as EnrichedBooking;
                }
                return b;
              });
            });
            
            setIsEnriching(false);
          });
      }

      // ✅ DIAGNOSTIC : Log avant enrichissement (vue matérialisée ou table bookings)
      // ✅ PERFORMANCE : Log réduit (seulement en développement et si nécessaire)
      if (process.env.NODE_ENV === 'development' && finalEnrichedBookings.length > 0) {
        debug('📊 [LOAD BOOKINGS] Avant enrichissement', {
          count: finalEnrichedBookings.length,
          source: USE_MATERIALIZED_VIEW ? 'materialized_view' : 'bookings_table',
          propertyId
        });
      }
      
      // ✅ PERFORMANCE : Log réduit (seulement en développement)
      if (process.env.NODE_ENV === 'development') {
        debug('📊 [USE BOOKINGS] Bookings transformés', { 
          transformed: finalEnrichedBookings.length, 
          total: bookingsData?.length || 0,
          source: USE_MATERIALIZED_VIEW ? 'materialized_view' : 'bookings_table'
        });
      }
      
      // ✅ DIAGNOSTIC CRITIQUE : Si aucune réservation n'est transformée, logger l'erreur
      if (finalEnrichedBookings.length === 0) {
        console.error('❌ [USE BOOKINGS] AUCUNE réservation transformée!', {
          propertyId,
          userId: user.id,
          source: USE_MATERIALIZED_VIEW ? 'materialized_view' : 'bookings_table',
          rawDataCount: bookingsData?.length || 0,
          enrichedCount: enrichedBookings.length,
          finalCount: finalEnrichedBookings.length
        });
      }
      
      // ✅ ISOLATION STRICTE : Filtrer STRICTEMENT par propertyId AVANT de mettre en cache
      // ✅ PERFORMANCE : Compter les exclusions mais ne logger qu'une seule fois
      let excludedCount = 0;
      const bookingsToCache = propertyId
        ? finalEnrichedBookings.filter(b => {
            const matches = b.propertyId === propertyId;
            if (!matches) {
              excludedCount++;
            }
            return matches;
          })
        : finalEnrichedBookings;
      
      // ✅ PERFORMANCE : Logger les exclusions une seule fois au chargement initial (pas à chaque re-render)
      // ✅ NETTOYAGE LOGS : Ne logger que si c'est vraiment nécessaire (exclusions > 0 ET première fois)
      if (excludedCount > 0) {
        // ✅ Utiliser un flag en mémoire persistant pour éviter les répétitions même si sessionStorage échoue
        const exclusionKey = `cache-exclusion-${propertyId}`;
        const memoryKey = `__cache_exclusion_${propertyId}`;
        
        let shouldLog = false;
        try {
          if (typeof sessionStorage !== 'undefined') {
            const hasLogged = sessionStorage.getItem(exclusionKey);
            if (!hasLogged) {
              shouldLog = true;
              sessionStorage.setItem(exclusionKey, 'true');
            }
          } else {
            // Fallback: utiliser un flag en mémoire
            if (!(window as any)[memoryKey]) {
              shouldLog = true;
              (window as any)[memoryKey] = true;
            }
          }
        } catch (e) {
          // Si sessionStorage échoue, utiliser le flag mémoire
          if (!(window as any)[memoryKey]) {
            shouldLog = true;
            (window as any)[memoryKey] = true;
          }
        }
        
        // ✅ NETTOYAGE LOGS : Logger seulement une fois, et seulement en développement ou si vraiment nécessaire
        if (shouldLog && (process.env.NODE_ENV === 'development' || excludedCount > 10)) {
          console.warn('⚠️ [USE BOOKINGS] Réservations exclues du cache (propertyId incorrect)', {
            excludedCount,
            expectedPropertyId: propertyId,
            totalBeforeFilter: finalEnrichedBookings.length,
            totalAfterFilter: bookingsToCache.length,
            note: 'Ce message ne s\'affichera qu\'une fois par session'
          });
        }
      }
      
      // ✅ VALIDATION FINALE : Vérifier qu'on ne met en cache QUE les réservations de la propriété active
      const propertyIdsInCache = [...new Set(bookingsToCache.map(b => b.propertyId).filter(Boolean))];
      if (propertyId && (propertyIdsInCache.length > 1 || propertyIdsInCache[0] !== propertyId)) {
        console.error('❌ [USE BOOKINGS] ERREUR CRITIQUE : Tentative de mise en cache avec des réservations de plusieurs propriétés!', {
          cacheKey,
          expectedPropertyId: propertyId,
          propertyIdsInCache,
          count: bookingsToCache.length,
          action: 'CACHE NON MIS À JOUR - Données filtrées'
        });
        // Ne pas mettre en cache si pollué
        // Continuer avec les données filtrées mais ne pas polluer le cache
      } else {
        // ✅ PHASE 2 : Mettre en cache multi-niveaux (SEULEMENT si isolé)
        // ✅ PROTECTION : Gérer les erreurs de cache
        try {
          await multiLevelCache.set(cacheKey, bookingsToCache, 300000); // 5 minutes pour IndexedDB
          bookingsCache.set(cacheKey, { data: bookingsToCache, timestamp: now });
          // ✅ PERFORMANCE : Log réduit (seulement en développement)
          if (process.env.NODE_ENV === 'development') {
            debug('✅ [USE BOOKINGS] Bookings cached', { 
              cacheKey, 
              count: bookingsToCache.length,
              propertyId
          });
        }
        } catch (cacheError) {
          // ✅ PROTECTION : Si le cache échoue, continuer sans bloquer
          console.warn('⚠️ [USE BOOKINGS] Erreur lors de la mise en cache (non-bloquant)', cacheError);
        }
      }
      
      // ✅ OPTIMISATION : Mise à jour intelligente - fusionner avec les bookings existants
      // pour préserver les mises à jour optimistes et éviter les doublons
      // ✅ NETTOYAGE STRICT : Filtrer les doubles uniquement pour la propriété active
      setBookings(prev => {
        // ✅ NETTOYAGE STRICT : Filtrer d'abord les réservations existantes pour ne garder que celles de la propriété active
        const prevForCurrentProperty = propertyId 
          ? prev.filter(b => b.propertyId === propertyId)
          : prev;
        
        const existingMap = new Map(prevForCurrentProperty.map(b => [b.id, b]));
        
        // ✅ NETTOYAGE STRICT : Filtrer les réservations chargées pour ne garder que celles de la propriété active
        // ✅ NETTOYAGE LOGS : Supprimé les logs dans les boucles pour éviter les re-rendus infinis
        const filteredForProperty = propertyId
          ? finalEnrichedBookings.filter(b => b.propertyId === propertyId)
          : finalEnrichedBookings;
        
        // ✅ PROTECTION : Créer un Set pour éviter les doublons dans filteredForProperty lui-même
        const seenIds = new Set<string>();
        const uniqueEnrichedBookings = filteredForProperty.filter(b => {
          if (seenIds.has(b.id)) {
            // ✅ NETTOYAGE LOGS : Supprimé le log dans la boucle pour éviter les re-rendus infinis
            return false;
          }
          seenIds.add(b.id);
          return true;
        });
        
        // Fusionner : garder les nouvelles données mais préserver les mises à jour récentes
        const merged = uniqueEnrichedBookings.map(newBooking => {
          const existing = existingMap.get(newBooking.id);
          // Si la réservation existante a été mise à jour récemment (< 1 seconde), la garder
          if (existing && existing.updated_at && newBooking.updated_at) {
            const existingTime = new Date(existing.updated_at).getTime();
            const newTime = new Date(newBooking.updated_at).getTime();
            if (existingTime > newTime - 1000) {
              return existing; // Garder la version existante si plus récente
            }
          }
          return newBooking;
        });
        
        // ✅ NETTOYAGE STRICT : S'assurer qu'on ne garde que les réservations de la propriété active
        const finalMerged = propertyId
          ? merged.filter(b => b.propertyId === propertyId)
          : merged;
        
        // Mettre à jour le cache des IDs
        lastBookingIdsRef.current = new Set(finalMerged.map(b => b.id));
        
        // ✅ NETTOYAGE LOGS : Supprimé le log final pour éviter les re-rendus infinis
        // Le log était exécuté à chaque setBookings et causait des boucles infinies
        
        return finalMerged;
      });
      
      // ✅ STABILISATION : Appeler get-guest-documents-unified UNE SEULE FOIS via la fonction helper
      // Ne PAS appeler loadBookings() après pour éviter la boucle infinie
      callDocumentsGenerationOnce(propertyId);
    } catch (error) {
      logError('Error loading bookings', error as Error);
    } finally {
      loadingRef.current = false;
      setIsLoading(false);
    }
  }, [propertyId, dateRange, limit, user?.id, callDocumentsGenerationOnce]); // ✅ STABILISATION : Dépendances pour useCallback

  const addBooking = async (booking: Booking) => {
    try {
      debug('Adding new booking', { bookingId: booking.id, propertyId: booking.propertyId });
      
      if (!user) {
        logError('No authenticated user', new Error('User not authenticated'));
        return;
      }
      
      // Insert booking
      const { data: bookingData, error: bookingError } = await supabase
        .from('bookings')
        .insert({
          user_id: user.id,
          property_id: booking.property_id,
          check_in_date: booking.checkInDate,
          check_out_date: booking.checkOutDate,
          number_of_guests: booking.numberOfGuests,
          booking_reference: booking.bookingReference,
          guest_name: booking.guest_name,
          status: booking.status,
          documents_generated: booking.documentsGenerated
        })
        .select()
        .single();

      if (bookingError) {
        logError('Error adding booking', bookingError as Error);
        return;
      }

      // Insert guests
      if (booking.guests.length > 0) {
        debug('Inserting guests', { count: booking.guests.length });
        
        const guestsData = booking.guests.map(guest => {
          // Validate and clean the date format
          let cleanDateOfBirth = guest.dateOfBirth;
          if (cleanDateOfBirth && !cleanDateOfBirth.match(/^\d{4}-\d{2}-\d{2}$/)) {
            warn('Invalid date format detected', { dateOfBirth: cleanDateOfBirth });
            // Try to parse and reformat the date
            const date = new Date(cleanDateOfBirth);
            if (!isNaN(date.getTime())) {
              cleanDateOfBirth = date.toISOString().split('T')[0];
              debug('Date reformatted', { original: guest.dateOfBirth, formatted: cleanDateOfBirth });
            } else {
              logError('Could not parse date, setting to null', new Error('Invalid date format'));
              cleanDateOfBirth = null;
            }
          }
          
          return {
            booking_id: bookingData.id,
            full_name: guest.fullName,
            date_of_birth: cleanDateOfBirth,
            document_number: guest.documentNumber,
            nationality: guest.nationality,
            place_of_birth: guest.placeOfBirth,
            document_type: guest.documentType,
            profession: guest.profession || '',
            motif_sejour: guest.motifSejour || 'TOURISME',
            adresse_personnelle: guest.adressePersonnelle || '',
            email: guest.email || null
          };
        });

        debug('Final guests data for insert', { count: guestsData.length });

        const { error: guestsError } = await supabase
          .from('guests')
          .insert(guestsData);

        if (guestsError) {
          logError('Error adding guests', guestsError as Error);
          return;
        } else {
          debug('Guests added successfully', { count: guestsData.length });
        }
      }

      // ✅ AMÉLIORATION : Ajout optimiste immédiat + rafraîchissement complet
      // Ajouter la réservation immédiatement à l'état local pour une réactivité instantanée
      const newBooking: Booking = {
        ...booking,
        id: bookingData.id,
        createdAt: bookingData.created_at,
        updated_at: bookingData.updated_at || bookingData.created_at
      };
      
      // ✅ OPTIMISATION : Vérifier qu'elle n'existe pas déjà avant d'ajouter
      setBookings(prevBookings => {
        const exists = prevBookings.some(b => b.id === newBooking.id);
        if (exists) {
          // Mettre à jour si elle existe déjà
          return prevBookings.map(b => b.id === newBooking.id ? newBooking : b);
        }
        return [newBooking, ...prevBookings];
      });
      
      // Mettre à jour le cache
      lastBookingIdsRef.current.add(newBooking.id);
      
      // ✅ PHASE 2 : Invalider le cache multi-niveaux
      const cacheKey = propertyId ? `bookings-${propertyId}` : `bookings-all-${user?.id || 'anonymous'}`;
      await multiLevelCache.invalidatePattern(cacheKey);
      bookingsCache.delete(cacheKey);
      
      // ✅ OPTIMISATION : Rafraîchissement en arrière-plan (non-bloquant)
      // La subscription en temps réel va aussi déclencher un refresh, mais on le fait immédiatement pour UX
      loadBookings().catch(err => {
        console.warn('Background refresh failed, but optimistic update succeeded', err);
      });
    } catch (error) {
      logError('Error adding booking', error as Error);
    }
  };

  const updateBooking = async (id: string, updates: Partial<Booking>) => {
    try {
      debug('Updating booking with safety checks', { bookingId: id, updates });
      
      // ✅ CORRECTION: Utilisation d'une transaction atomique pour éviter les race conditions
      const { data: currentBooking, error: fetchError } = await supabase
        .from('bookings')
        .select('*')
        .eq('id', id)
        .single();

      if (fetchError || !currentBooking) {
        logError('Error fetching current booking for update', fetchError as Error);
        return;
      }

      const updateData: any = {};
      if (updates.checkInDate) updateData.check_in_date = updates.checkInDate;
      if (updates.checkOutDate) updateData.check_out_date = updates.checkOutDate;
      if (updates.numberOfGuests) updateData.number_of_guests = updates.numberOfGuests;
      if (updates.bookingReference !== undefined) updateData.booking_reference = updates.bookingReference;
      if (updates.guest_name !== undefined) updateData.guest_name = updates.guest_name;
      
      // ✅ CORRECTION: Gestion sécurisée des documents générés
      if (updates.documentsGenerated) {
        // Merge safely with current state from DB (not from local state)
        const currentDocGen = currentBooking.documents_generated || { policeForm: false, contract: false };
        const newDocGen = { ...currentDocGen, ...updates.documentsGenerated };
        updateData.documents_generated = newDocGen;
        
        debug('Document generation state', {
          current: currentDocGen,
          updates: updates.documentsGenerated,
          final: newDocGen
        });
      }

      // ✅ CORRECTION: Gestion du statut avec validation stricte
      if (updates.status) {
        updateData.status = updates.status;
      } else if (updates.documentsGenerated) {
        // Auto-complete only if BOTH documents are true and booking is not already completed
        const finalDocGen = updateData.documents_generated;
        if (finalDocGen?.contract && finalDocGen?.policeForm && currentBooking.status !== 'completed') {
          updateData.status = 'completed';
          debug('Auto-completing booking - both documents generated', { bookingId: id });
        }
      }

      // ✅ CORRECTION: Mise à jour avec contrainte de version optimiste
      const { error } = await supabase
        .from('bookings')
        .update({
          ...updateData,
          updated_at: new Date().toISOString() // Force timestamp update
        })
        .eq('id', id)
        .eq('updated_at', currentBooking.updated_at); // Optimistic locking

      if (error) {
        logError('Error updating booking (possible concurrent modification)', error as Error);
        // Retry once if it's a concurrent modification
        if (error.message?.includes('conflict') || error.code === 'PGRST116') {
          debug('Retrying booking update due to concurrent modification', { bookingId: id });
          return updateBooking(id, updates); // Recursive retry
        }
        return;
      }

      debug('Booking updated successfully', { bookingId: id });
      
      // ✅ PHASE 2 : Invalider le cache multi-niveaux
      const cacheKey = propertyId ? `bookings-${propertyId}` : `bookings-all-${user?.id || 'anonymous'}`;
      await multiLevelCache.invalidatePattern(cacheKey);
      bookingsCache.delete(cacheKey);
      
      // ✅ AMÉLIORATION : Mise à jour optimiste immédiate
      // Mettre à jour l'état local immédiatement pour une réactivité instantanée
      setBookings(prevBookings => 
        prevBookings.map(b => 
          b.id === id 
            ? { ...b, ...updates, updated_at: new Date().toISOString() }
            : b
        )
      );
      
      // Rafraîchissement complet en arrière-plan (la subscription va aussi déclencher)
      await loadBookings();
    } catch (error) {
      logError('Error updating booking', error as Error);
    }
  };

  const deleteBooking = async (id: string) => {
    try {
      debug('Starting deletion of booking', { bookingId: id });
      
      // Step 0: Récupérer les informations de la réservation avant suppression
      // (notamment booking_reference pour nettoyer airbnb_reservations)
      const { data: bookingData, error: fetchError } = await supabase
        .from('bookings')
        .select('id, property_id, booking_reference')
        .eq('id', id)
        .maybeSingle();

      if (fetchError) {
        warn('Could not fetch booking data', { error: fetchError.message });
      }

      // Step 1: Delete related guest submissions first
      const { error: guestSubmissionsError } = await supabase
        .from('guest_submissions')
        .delete()
        .eq('booking_id', id);

      if (guestSubmissionsError) {
        warn('Could not delete guest submissions', { error: guestSubmissionsError.message });
        // Continue with deletion even if guest submissions deletion fails
      } else {
        debug('Guest submissions deleted successfully', { bookingId: id });
      }

      // Step 2: Delete related guests
      const { error: guestsError } = await supabase
        .from('guests')
        .delete()
        .eq('booking_id', id);

      if (guestsError) {
        warn('Could not delete guests', { error: guestsError.message });
      } else {
        debug('Guests deleted successfully', { bookingId: id });
      }

      // Step 3: Delete related uploaded documents
      const { error: documentsError } = await supabase
        .from('uploaded_documents')
        .delete()
        .eq('booking_id', id);

      if (documentsError) {
        warn('Could not delete uploaded documents', { error: documentsError.message });
      } else {
        debug('Uploaded documents deleted successfully', { bookingId: id });
      }

      // Step 4: Nettoyer le guest_name dans airbnb_reservations si la réservation a un booking_reference
      if (bookingData?.booking_reference && bookingData.booking_reference !== 'INDEPENDENT_BOOKING' && bookingData.property_id) {
        debug('Nettoyage du guest_name dans airbnb_reservations', {
          propertyId: bookingData.property_id,
          bookingReference: bookingData.booking_reference
        });
        
        const { error: airbnbUpdateError } = await supabase
          .from('airbnb_reservations')
          .update({
            guest_name: null,
            summary: bookingData.booking_reference, // Réinitialiser le summary sans le nom
            updated_at: new Date().toISOString()
          })
          .eq('property_id', bookingData.property_id)
          .eq('airbnb_booking_id', bookingData.booking_reference);

        if (airbnbUpdateError) {
          warn('Could not clean guest_name in airbnb_reservations', { error: airbnbUpdateError.message });
          // Continue with deletion even if airbnb_reservations update fails
        } else {
          debug('guest_name nettoyé dans airbnb_reservations', { bookingId: id });
        }
      }

      // Step 5: Now delete the booking
      const { error } = await supabase
        .from('bookings')
        .delete()
        .eq('id', id);

      if (error) {
        logError('Error deleting booking', error as Error);
        throw error;
      }

      debug('Booking deleted successfully', { bookingId: id });
      
      // ✅ PHASE 2 : Invalider le cache multi-niveaux
      const cacheKey = propertyId ? `bookings-${propertyId}` : `bookings-all-${user?.id || 'anonymous'}`;
      await multiLevelCache.invalidatePattern(cacheKey);
      bookingsCache.delete(cacheKey);
      
      // ✅ AMÉLIORATION : Mise à jour optimiste immédiate + rafraîchissement complet
      // Mettre à jour l'état local immédiatement pour une réactivité instantanée
      setBookings(prevBookings => prevBookings.filter(b => b.id !== id));
      
      // ✅ CORRIGÉ : Fermer tous les Portals Radix UI avant de recharger les bookings
      // Cela évite les erreurs Portal lors du re-render
      const closeAllRadixPortals = () => {
        // Méthode 1: Fermer via les attributs data-state
        const openElements = document.querySelectorAll('[data-state="open"]');
        openElements.forEach(element => {
          if (element instanceof HTMLElement) {
            element.setAttribute('data-state', 'closed');
          }
        });
        
        // Méthode 2: Simuler un clic sur document.body pour fermer les Portals
        const clickEvent = new MouseEvent('click', { bubbles: true, cancelable: true });
        document.body.dispatchEvent(clickEvent);
        
        // Méthode 3: Fermer les Portals directement via querySelector
        const portals = document.querySelectorAll('[data-radix-portal]');
        portals.forEach(portal => {
          if (portal.parentNode) {
            try {
              portal.parentNode.removeChild(portal);
            } catch (e) {
              // Ignorer les erreurs de suppression
            }
          }
        });
      };
      
      closeAllRadixPortals();
      
      // ✅ AMÉLIORATION : Rafraîchissement immédiat + confirmation via subscription
      // La subscription en temps réel va aussi déclencher un refresh, mais on le fait immédiatement pour UX
      await loadBookings();
    } catch (error) {
      logError('Error in deleteBooking', error as Error);
      throw error;
    }
  };

  const getBookingById = (id: string) => {
    // ✅ STABILISATION : Utiliser les bookings filtrés pour la cohérence
    return filteredBookings.find(booking => booking.id === id);
  };

  // ✅ STABILISATION : Retourner les bookings filtrés par propertyId (mémoïsés)
  return {
    bookings: filteredBookings, // ✅ Utiliser les bookings filtrés pour éviter les re-rendus infinis
    isLoading,
    addBooking,
    updateBooking,
    deleteBooking,
    getBookingById,
    refreshBookings: loadBookings
  };
};
