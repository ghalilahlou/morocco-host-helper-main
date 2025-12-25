/**
 * Hook optimisé avec React Query pour la gestion des réservations
 * 
 * ✅ PHASE 3 : Utilise React Query pour :
 * - Cache automatique
 * - Deduplication des requêtes
 * - Background refetch
 * - Optimistic updates
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Booking } from '@/types/booking';
import { useAuth } from '@/hooks/useAuth';
import { EnrichedBooking } from '@/services/guestSubmissionService';
import { multiLevelCache } from '@/services/multiLevelCache';
import { debug, warn, error as logError } from '@/lib/logger';

interface UseBookingsQueryOptions {
  propertyId?: string;
  dateRange?: {
    start: Date;
    end: Date;
  };
  limit?: number;
  enabled?: boolean;
}

/**
 * Fonction pour charger les réservations (utilisée par React Query)
 */
async function loadBookingsQuery(
  propertyId?: string,
  dateRange?: { start: Date; end: Date },
  limit: number = 100
): Promise<EnrichedBooking[]> {
  // ✅ PHASE 2 : Vérifier le cache multi-niveaux d'abord
  const dateRangeKey = dateRange 
    ? `-${dateRange.start.toISOString().split('T')[0]}-${dateRange.end.toISOString().split('T')[0]}`
    : '';
  const cacheKey = propertyId 
    ? `bookings-${propertyId}${dateRangeKey}` 
    : `bookings-all${dateRangeKey}`;
  
  const cached = await multiLevelCache.get<EnrichedBooking[]>(cacheKey);
  if (cached) {
    debug('Using multi-level cached bookings (React Query)', { cacheKey, count: cached.length });
    return cached;
  }

  // ✅ PHASE 2 : Utiliser la vue matérialisée si disponible
  let query = supabase
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
  
  if (propertyId) {
    query = query.eq('property_id', propertyId);
  }
  
  if (dateRange) {
    query = query
      .gte('check_in_date', dateRange.start.toISOString().split('T')[0])
      .lte('check_out_date', dateRange.end.toISOString().split('T')[0]);
  }
  
  query = query
    .order('check_in_date', { ascending: false })
    .limit(limit);
  
  const { data: bookingsData, error } = await query;
  
  // ✅ PHASE 2 : Fallback si la vue matérialisée n'existe pas
  if (error && (error.message?.includes('does not exist') || error.message?.includes('relation') || error.code === '42P01')) {
    debug('Materialized view not available, falling back to bookings table', { error: error.message });
    
    let fallbackQuery = supabase
      .from('bookings')
      .select(`*, guests (*), property:properties (*)`);
    
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
      throw fallbackError;
    }
    
    // Transformer les données (simplifié pour l'exemple)
    const transformedBookings = (fallbackData || [])
      .filter(b => b.status !== 'draft')
      .map((booking: any) => ({
        id: booking.id,
        propertyId: booking.property_id,
        checkInDate: booking.check_in_date,
        checkOutDate: booking.check_out_date,
        numberOfGuests: booking.number_of_guests,
        bookingReference: booking.booking_reference,
        guest_name: booking.guest_name,
        status: booking.status,
        createdAt: booking.created_at,
        updated_at: booking.updated_at || booking.created_at,
        documentsGenerated: booking.documents_generated || { policeForm: false, contract: false },
        guests: (booking.guests || []).map((g: any) => ({
          id: g.id,
          fullName: g.full_name,
          dateOfBirth: g.date_of_birth,
          documentNumber: g.document_number,
          nationality: g.nationality,
          placeOfBirth: g.place_of_birth,
          documentType: g.document_type
        })),
        property: booking.property || {
          id: booking.property_id,
          name: 'Propriété inconnue',
          house_rules: [],
          contract_template: {},
          user_id: '',
          created_at: '',
          updated_at: '',
          property_type: 'unknown',
          max_occupancy: 1
        },
        // Données enrichies par défaut
        realGuestNames: [],
        realGuestCount: 0,
        hasRealSubmissions: false,
        submissionStatus: {
          hasDocuments: false,
          hasSignature: false,
          documentsCount: 0
        }
      })) as EnrichedBooking[];
    
    // Mettre en cache
    await multiLevelCache.set(cacheKey, transformedBookings, 300000);
    return transformedBookings;
  }
  
  if (error) {
    throw error;
  }

  // ✅ PHASE 2 : Transformer les données de la vue matérialisée
  const enrichedBookings: EnrichedBooking[] = (bookingsData || []).map((booking: any) => {
    if (!booking.property_id) {
      return null;
    }

    const propertyData = booking.property_data || {};
    const guestsData = Array.isArray(booking.guests_data) ? booking.guests_data : [];
    const submissionsData = Array.isArray(booking.guest_submissions_data) ? booking.guest_submissions_data : [];
    
    // Extraire les noms des invités
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
    
    const uniqueNames = [...new Set(realGuestNames)]
      .filter(name => name && name.trim().length > 0)
      .map(name => name.trim().toUpperCase());
    
    if (uniqueNames.length === 0 && booking.guest_name) {
      uniqueNames.push(booking.guest_name.trim().toUpperCase());
    }
    
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

    return {
      id: booking.id,
      checkInDate: booking.check_in_date,
      checkOutDate: booking.check_out_date,
      numberOfGuests: booking.number_of_guests,
      bookingReference: booking.booking_reference || undefined,
      guest_name: booking.guest_name || undefined,
      propertyId: booking.property_id,
      submissionId: booking.submission_id || undefined,
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
      documentsGenerated: typeof booking.documents_generated === 'object' && booking.documents_generated !== null
        ? booking.documents_generated as { policeForm: boolean; contract: boolean; }
        : { policeForm: false, contract: false },
      realGuestNames: uniqueNames,
      realGuestCount: uniqueNames.length,
      hasRealSubmissions: booking.has_submissions || false,
      submissionStatus: {
        hasDocuments: booking.has_documents || documentsCount > 0,
        hasSignature: booking.has_signature || false,
        documentsCount: documentsCount || booking.submission_count || 0
      }
    };
  }).filter(Boolean) as EnrichedBooking[];

  // Mettre en cache
  await multiLevelCache.set(cacheKey, enrichedBookings, 300000);
  return enrichedBookings;
}

/**
 * Hook React Query pour les réservations
 */
export function useBookingsQuery(options?: UseBookingsQueryOptions) {
  const { propertyId, dateRange, limit = 100, enabled = true } = options || {};
  const { user } = useAuth();
  
  return useQuery({
    queryKey: ['bookings', propertyId, dateRange?.start, dateRange?.end, limit],
    queryFn: () => loadBookingsQuery(propertyId, dateRange, limit),
    enabled: enabled && !!user,
    staleTime: 30000, // 30 secondes - données considérées fraîches
    gcTime: 5 * 60 * 1000, // 5 minutes - temps de garde en cache (anciennement cacheTime)
    refetchOnMount: false, // Ne pas refetch si les données sont fraîches
    refetchOnWindowFocus: false, // Ne pas refetch au focus de la fenêtre
    refetchOnReconnect: true, // Refetch si reconnexion
    retry: 1, // Retry une fois en cas d'erreur
  });
}

/**
 * Mutation pour ajouter une réservation
 */
export function useAddBookingMutation() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  
  return useMutation({
    mutationFn: async (booking: Booking) => {
      if (!user) throw new Error('User not authenticated');
      
      const { data: bookingData, error } = await supabase
        .from('bookings')
        .insert({
          user_id: user.id,
          property_id: booking.propertyId,
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
      
      if (error) throw error;
      
      // Insérer les invités
      if (booking.guests.length > 0) {
        const guestsData = booking.guests.map(guest => ({
          booking_id: bookingData.id,
          full_name: guest.fullName,
          date_of_birth: guest.dateOfBirth,
          document_number: guest.documentNumber,
          nationality: guest.nationality,
          place_of_birth: guest.placeOfBirth,
          document_type: guest.documentType,
        }));
        
        await supabase.from('guests').insert(guestsData);
      }
      
      return bookingData;
    },
    onMutate: async (newBooking) => {
      // ✅ PHASE 3 : Mise à jour optimiste
      await queryClient.cancelQueries({ queryKey: ['bookings'] });
      
      const previousBookings = queryClient.getQueryData<EnrichedBooking[]>(['bookings', newBooking.propertyId]);
      
      // Ajouter la nouvelle réservation de manière optimiste
      if (previousBookings) {
        const optimisticBooking: EnrichedBooking = {
          ...newBooking,
          id: `temp-${Date.now()}`,
          createdAt: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          realGuestNames: [],
          realGuestCount: 0,
          hasRealSubmissions: false,
          submissionStatus: {
            hasDocuments: false,
            hasSignature: false,
            documentsCount: 0
          },
          guests: newBooking.guests || [],
          property: newBooking.property || {
            id: newBooking.propertyId,
            name: 'Propriété inconnue',
            house_rules: [],
            contract_template: {},
            user_id: '',
            created_at: '',
            updated_at: '',
            property_type: 'unknown',
            max_occupancy: 1
          }
        };
        
        queryClient.setQueryData<EnrichedBooking[]>(
          ['bookings', newBooking.propertyId],
          [optimisticBooking, ...previousBookings]
        );
      }
      
      return { previousBookings };
    },
    onError: (err, newBooking, context) => {
      // ✅ PHASE 3 : Rollback en cas d'erreur
      if (context?.previousBookings) {
        queryClient.setQueryData(
          ['bookings', newBooking.propertyId],
          context.previousBookings
        );
      }
    },
    onSuccess: (data, newBooking) => {
      // ✅ PHASE 3 : Invalider le cache pour refetch
      queryClient.invalidateQueries({ queryKey: ['bookings', newBooking.propertyId] });
      
      // Invalider aussi le cache multi-niveaux
      const cacheKey = newBooking.propertyId 
        ? `bookings-${newBooking.propertyId}` 
        : 'bookings-all';
      multiLevelCache.invalidatePattern(cacheKey).catch(() => {});
    },
  });
}

/**
 * Mutation pour mettre à jour une réservation
 */
export function useUpdateBookingMutation() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<Booking> }) => {
      const updateData: any = {};
      if (updates.checkInDate) updateData.check_in_date = updates.checkInDate;
      if (updates.checkOutDate) updateData.check_out_date = updates.checkOutDate;
      if (updates.numberOfGuests) updateData.number_of_guests = updates.numberOfGuests;
      if (updates.bookingReference !== undefined) updateData.booking_reference = updates.bookingReference;
      if (updates.guest_name !== undefined) updateData.guest_name = updates.guest_name;
      if (updates.status) updateData.status = updates.status;
      if (updates.documentsGenerated) updateData.documents_generated = updates.documentsGenerated;
      
      const { error } = await supabase
        .from('bookings')
        .update(updateData)
        .eq('id', id);
      
      if (error) throw error;
      return { id, ...updates };
    },
    onMutate: async ({ id, updates }) => {
      // ✅ PHASE 3 : Mise à jour optimiste
      await queryClient.cancelQueries({ queryKey: ['bookings'] });
      
      const previousBookings = queryClient.getQueriesData<EnrichedBooking[]>({ queryKey: ['bookings'] });
      
      // Mettre à jour toutes les queries concernées
      previousBookings.forEach(([queryKey, data]) => {
        if (data) {
          queryClient.setQueryData<EnrichedBooking[]>(
            queryKey,
            data.map(b => b.id === id ? { ...b, ...updates, updated_at: new Date().toISOString() } : b)
          );
        }
      });
      
      return { previousBookings };
    },
    onError: (err, variables, context) => {
      // ✅ PHASE 3 : Rollback en cas d'erreur
      if (context?.previousBookings) {
        context.previousBookings.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data);
        });
      }
    },
    onSuccess: (data, variables) => {
      // ✅ PHASE 3 : Invalider le cache
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
      
      // Invalider aussi le cache multi-niveaux
      multiLevelCache.invalidatePattern('bookings-').catch(() => {});
    },
  });
}

/**
 * Mutation pour supprimer une réservation
 */
export function useDeleteBookingMutation() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (id: string) => {
      // Récupérer la réservation pour connaître propertyId
      const { data: booking } = await supabase
        .from('bookings')
        .select('id, property_id')
        .eq('id', id)
        .single();
      
      if (!booking) throw new Error('Booking not found');
      
      // Supprimer les données associées
      await supabase.from('guest_submissions').delete().eq('booking_id', id);
      await supabase.from('guests').delete().eq('booking_id', id);
      await supabase.from('uploaded_documents').delete().eq('booking_id', id);
      
      // Supprimer la réservation
      const { error } = await supabase.from('bookings').delete().eq('id', id);
      if (error) throw error;
      
      return { id, propertyId: booking.property_id };
    },
    onMutate: async (id) => {
      // ✅ PHASE 3 : Suppression optimiste
      await queryClient.cancelQueries({ queryKey: ['bookings'] });
      
      const previousBookings = queryClient.getQueriesData<EnrichedBooking[]>({ queryKey: ['bookings'] });
      
      // Supprimer de toutes les queries
      previousBookings.forEach(([queryKey, data]) => {
        if (data) {
          queryClient.setQueryData<EnrichedBooking[]>(
            queryKey,
            data.filter(b => b.id !== id)
          );
        }
      });
      
      return { previousBookings };
    },
    onError: (err, id, context) => {
      // ✅ PHASE 3 : Rollback en cas d'erreur
      if (context?.previousBookings) {
        context.previousBookings.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data);
        });
      }
    },
    onSuccess: (data) => {
      // ✅ PHASE 3 : Invalider le cache
      queryClient.invalidateQueries({ queryKey: ['bookings', data.propertyId] });
      
      // Invalider aussi le cache multi-niveaux
      const cacheKey = data.propertyId ? `bookings-${data.propertyId}` : 'bookings-all';
      multiLevelCache.invalidatePattern(cacheKey).catch(() => {});
    },
  });
}

