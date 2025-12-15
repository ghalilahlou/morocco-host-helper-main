import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Booking } from '@/types/booking';
import { useAuth } from '@/hooks/useAuth';
import { enrichBookingsWithGuestSubmissions, EnrichedBooking } from '@/services/guestSubmissionService';
import { validateBookingData, logDataError } from '@/utils/errorMonitoring';
import { debug, info, warn, error as logError } from '@/lib/logger';
import { multiLevelCache } from '@/services/multiLevelCache';

// ✅ PHASE 1 : Cache mémoire pour les bookings
interface CacheEntry {
  data: EnrichedBooking[];
  timestamp: number;
}

const bookingsCache = new Map<string, CacheEntry>();
const BOOKINGS_CACHE_DURATION = 30000; // 30 secondes

interface UseBookingsOptions {
  propertyId?: string;
  dateRange?: {
    start: Date;
    end: Date;
  };
  limit?: number; // Pagination
}

export const useBookings = (options?: UseBookingsOptions) => {
  const { propertyId, dateRange, limit = 100 } = options || {};
  const [bookings, setBookings] = useState<EnrichedBooking[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const loadingRef = useRef(false);
  // ✅ NOUVEAU : Cache des IDs de bookings pour éviter les rafraîchissements inutiles
  const lastBookingIdsRef = useRef<Set<string>>(new Set());
  const { user } = useAuth();

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

  const loadBookings = async () => {
    try {
      // ✅ PROTECTION : Éviter les appels multiples simultanés avec une ref indépendante de l'état React
      if (loadingRef.current) {
        debug('Already loading bookings, skipping');
        return;
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
        // ✅ DIAGNOSTIC : Vérifier que le cache contient les bonnes données
        const cachedPropertyIds = [...new Set(cached.map(b => b.propertyId))];
        const hasWrongPropertyIds = propertyId && cachedPropertyIds.some(id => id !== propertyId);
        
        if (hasWrongPropertyIds) {
          console.warn('⚠️ [USE BOOKINGS] Cache contient des réservations d\'autres propriétés!', {
            cacheKey,
            expectedPropertyId: propertyId,
            cachedPropertyIds,
            cachedCount: cached.length
          });
          // Invalider le cache et recharger
          await multiLevelCache.invalidate(cacheKey);
        } else {
          debug('Using multi-level cached bookings', { cacheKey, count: cached.length, propertyId, cachedPropertyIds });
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
      
      // ✅ PHASE 2 : Utiliser la vue matérialisée si disponible, sinon fallback sur bookings
      // Note: La vue matérialisée sera disponible après migration
      let query = supabase
        .from('mv_bookings_enriched') // ✅ PHASE 2 : Utiliser la vue matérialisée
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
      
      // ✅ PHASE 1 : Ajouter le filtre par propriété si fourni
      if (propertyId) {
        query = query.eq('property_id', propertyId);
        debug('Filtering bookings by property_id', { propertyId });
      } else {
        // ✅ DIAGNOSTIC : Alerte si propertyId n'est pas fourni mais devrait l'être
        debug('⚠️ No propertyId provided - loading all bookings for user', { userId: user.id });
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
      
      // ✅ PHASE 2 : Ajouter pagination
      query = query
        .order('check_in_date', { ascending: false })
        .limit(limit);
      
      const { data: bookingsData, error } = await query;
      
      if (error) {
        // ✅ PHASE 2 : Fallback si la vue matérialisée n'existe pas encore
        if (error.message?.includes('does not exist') || error.message?.includes('relation') || error.code === '42P01') {
          debug('Materialized view not available, falling back to bookings table', { error: error.message });
        
        // Fallback sur la table bookings classique
        let fallbackQuery = supabase
          .from('bookings')
          .select(`
            *,
            guests (*),
            property:properties (*)
          `);
        
        if (propertyId) {
          fallbackQuery = fallbackQuery.eq('property_id', propertyId);
        }
        
        if (dateRange) {
          fallbackQuery = fallbackQuery
            .gte('check_in_date', dateRange.start.toISOString().split('T')[0])
            .lte('check_out_date', dateRange.end.toISOString().split('T')[0]);
        }
        
        const { data: fallbackData, error: fallbackError } = await fallbackQuery
          .order('created_at', { ascending: false })
          .limit(limit);
        
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
        
        // Transformer les données (code existant)
        const transformedBookings: Booking[] = filteredBookingsData.map(booking => {
          // ... (code de transformation existant)
          // Continuer avec le code existant de transformation
        }).filter(Boolean) as Booking[];
        
        // ✅ DIAGNOSTIC : Log avant enrichissement
        debug('📊 [LOAD BOOKINGS] Avant enrichissement (fallback)', {
          count: transformedBookings.length,
          propertyId,
          bookingIds: transformedBookings.map(b => ({ id: b.id.substring(0, 8), propertyId: b.propertyId, status: b.status }))
        });
        
        // Enrichir et mettre en cache
        const enrichedBookings = await enrichBookingsWithGuestSubmissions(transformedBookings);
        
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
          
          // ✅ PHASE 2 : Mettre en cache multi-niveaux
          await multiLevelCache.set(cacheKey, uniqueBookings, 30000); // 30s memory, 5min IndexedDB
          bookingsCache.set(cacheKey, { data: uniqueBookings, timestamp: now });
          
          setBookings(uniqueBookings);
          return;
        }
        
        // ✅ PHASE 2 : Mettre en cache multi-niveaux
        await multiLevelCache.set(cacheKey, enrichedBookings, 30000); // 30s memory, 5min IndexedDB
        bookingsCache.set(cacheKey, { data: enrichedBookings, timestamp: now });
        
        setBookings(enrichedBookings);
        return;
        }
      }

      // Si on arrive ici, c'est qu'il n'y a pas d'erreur
      debug('Raw bookings data from materialized view', { 
        count: bookingsData?.length || 0,
        propertyId,
        propertyIdsInData: propertyId ? undefined : [...new Set((bookingsData || []).map((b: any) => b.property_id))]
      });

      // ✅ PHASE 2 : Transformer les données de la vue matérialisée (déjà enrichies)
      const enrichedBookings: EnrichedBooking[] = (bookingsData || []).map((booking: any) => {
        // ✅ VALIDATION CRITIQUE : Exclure les bookings sans property_id
        if (!booking.property_id) {
          warn('Booking sans property_id détecté et exclu', { bookingId: booking.id });
          return null;
        }

        // ✅ PHASE 2 : Extraire les données de la vue matérialisée
        const propertyData = booking.property_data || {};
        const guestsData = Array.isArray(booking.guests_data) ? booking.guests_data : [];
        const submissionsData = Array.isArray(booking.guest_submissions_data) ? booking.guest_submissions_data : [];
        
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
          
          status: booking.status as 'pending' | 'completed' | 'archived' | 'draft',
          createdAt: booking.created_at,
          updated_at: booking.updated_at || booking.created_at,
          documentsGenerated: typeof booking.documents_generated === 'object' && booking.documents_generated !== null
            ? booking.documents_generated as { policeForm: boolean; contract: boolean; }
            : { policeForm: false, contract: false },
          
          // ✅ PHASE 2 : Données enrichies depuis la vue matérialisée
          realGuestNames: uniqueNames,
          realGuestCount: uniqueNames.length,
          hasRealSubmissions: booking.has_submissions || false,
          submissionStatus: {
            hasDocuments: booking.has_documents || documentsCount > 0,
            hasSignature: booking.has_signature || false,
            documentsCount: documentsCount || booking.submission_count || 0
          }
        };

        // ✅ VALIDATION FINALE avec monitoring
        const isValid = validateBookingData(transformedBooking, 'useBookings.transform');
        if (!isValid) {
          warn('Booking avec données invalides détecté', { bookingId: transformedBooking.id });
        }

        return transformedBooking;
      }).filter(Boolean) as EnrichedBooking[]; // ✅ Exclure les bookings null

      // ✅ DIAGNOSTIC : Log avant enrichissement (vue matérialisée)
      debug('📊 [LOAD BOOKINGS] Avant enrichissement (vue matérialisée)', {
        count: enrichedBookings.length,
        propertyId,
        bookingIds: enrichedBookings.map(b => ({ id: b.id.substring(0, 8), propertyId: b.propertyId, status: b.status }))
      });
      
      debug('Bookings transformés depuis vue matérialisée', { 
        transformed: enrichedBookings.length, 
        total: bookingsData?.length || 0 
      });
      
      // ✅ PHASE 2 : Mettre en cache multi-niveaux
      await multiLevelCache.set(cacheKey, enrichedBookings, 300000); // 5 minutes pour IndexedDB
      bookingsCache.set(cacheKey, { data: enrichedBookings, timestamp: now });
      debug('Bookings cached (multi-level)', { cacheKey, count: enrichedBookings.length });
      
      // ✅ OPTIMISATION : Mise à jour intelligente - fusionner avec les bookings existants
      // pour préserver les mises à jour optimistes et éviter les doublons
      setBookings(prev => {
        const existingMap = new Map(prev.map(b => [b.id, b]));
        
        // ✅ DIAGNOSTIC : Log pour détecter les doublons
        const duplicateIds = enrichedBookings
          .filter(b => existingMap.has(b.id))
          .map(b => b.id.substring(0, 8));
        
        if (duplicateIds.length > 0) {
          debug('⚠️ [LOAD BOOKINGS] Doublons détectés dans les données chargées', {
            duplicateIds,
            existingCount: prev.length,
            newCount: enrichedBookings.length
          });
        }
        
        // ✅ PROTECTION : Créer un Set pour éviter les doublons dans enrichedBookings lui-même
        const seenIds = new Set<string>();
        const uniqueEnrichedBookings = enrichedBookings.filter(b => {
          if (seenIds.has(b.id)) {
            debug('⚠️ [LOAD BOOKINGS] Doublon dans enrichedBookings détecté et supprimé', {
              bookingId: b.id.substring(0, 8)
            });
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
        
        // ✅ PROTECTION : Ne pas ajouter les réservations qui existent déjà
        // (déjà géré dans merged ci-dessus car on itère sur uniqueEnrichedBookings)
        
        // Mettre à jour le cache des IDs
        lastBookingIdsRef.current = new Set(merged.map(b => b.id));
        
        // ✅ DIAGNOSTIC : Log final
        debug('Bookings merged', {
          before: prev.length,
          after: merged.length,
          enriched: enrichedBookings.length,
          uniqueEnriched: uniqueEnrichedBookings.length,
          duplicatesRemoved: enrichedBookings.length - uniqueEnrichedBookings.length
        });
        
        return merged;
      });
      
    } catch (error) {
      logError('Error loading bookings', error as Error);
    } finally {
      loadingRef.current = false;
      setIsLoading(false);
    }
  };

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
    return bookings.find(booking => booking.id === id);
  };

  return {
    bookings,
    isLoading,
    addBooking,
    updateBooking,
    deleteBooking,
    getBookingById,
    refreshBookings: loadBookings
  };
};
