import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Booking } from '@/types/booking';
import { useAuth } from '@/hooks/useAuth';
import { enrichBookingsWithGuestSubmissions, EnrichedBooking } from '@/services/guestSubmissionService';
import { debug, info, warn, error } from '@/lib/logger';
import { handleError, DatabaseError, NetworkError } from '@/lib/errorHandler';
import type { RealtimeChannel } from '@supabase/supabase-js';

interface UseBookingsState {
  bookings: EnrichedBooking[];
  isLoading: boolean;
  error: string | null;
  lastUpdated: Date | null;
}

export const useBookings = () => {
  const [state, setState] = useState<UseBookingsState>({
    bookings: [],
    isLoading: true,
    error: null,
    lastUpdated: null,
  });

  const { user } = useAuth();
  const realtimeChannels = useRef<RealtimeChannel[]>([]);
  const abortController = useRef<AbortController | null>(null);

  // Cleanup function for realtime subscriptions
  const cleanupRealtimeSubscriptions = useCallback(() => {
    if (realtimeChannels.current.length > 0) {
      debug('Cleaning up realtime subscriptions', { count: realtimeChannels.current.length });
      realtimeChannels.current.forEach(channel => {
        supabase.removeChannel(channel);
      });
      realtimeChannels.current = [];
    }
  }, []);

  // Setup realtime subscriptions
  const setupRealtimeSubscriptions = useCallback(() => {
    if (!user) return;

    debug('Setting up realtime subscriptions for bookings and guests');

    const _tables = ['bookings', 'guests', 'guest_submissions'] as const;

    const channel = supabase
      .channel('schema-db-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'bookings'
        },
        (payload) => {
          debug('Real-time booking update received', { event: payload.eventType, id: payload.new?.id });
          void loadBookings();
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
          debug('Real-time guest update received', { event: payload.eventType, id: payload.new?.id });
          void loadBookings();
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
          debug('Real-time guest submission update received', { event: payload.eventType, id: payload.new?.id });
          void loadBookings();
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          info('Realtime subscriptions established successfully');
          realtimeChannels.current.push(channel);
        } else if (status === 'CHANNEL_ERROR') {
          warn('Realtime subscription error', { status });
        }
      });

    return channel;
  }, [user]);

  const loadBookings = useCallback(async () => {
    try {
      // Cancel previous request if still pending
      if (abortController.current) {
        abortController.current.abort();
      }

      abortController.current = new AbortController();

      setState(prev => ({ ...prev, isLoading: true, error: null }));

      // Check if user is authenticated
      if (!user) {
        debug('No authenticated user, skipping booking load');
        setState(prev => ({
          ...prev,
          bookings: [],
          isLoading: false,
          lastUpdated: new Date()
        }));
        return;
      }

      info('Loading bookings for user', { userId: user.id });

      const { data: bookingsData, error: supabaseError } = await supabase
        .from('bookings')
        .select(`
          *,
          guests (*),
          property:properties (*)
        `)
        .order('created_at', { ascending: false });

      if (supabaseError) {
        throw new DatabaseError(`Failed to load bookings: ${supabaseError.message}`, {
          userId: user.id,
          error: supabaseError
        });
      }

      debug('Raw bookings data from Supabase', {
        count: bookingsData?.length || 0,
        userId: user.id
      });

      // Transform Supabase data to match our Booking interface
      const transformedBookings: Booking[] = (bookingsData ?? []).map(booking => ({
        id: booking.id,
        checkInDate: booking.check_in_date,
        checkOutDate: booking.check_out_date,
        numberOfGuests: booking.number_of_guests,
        bookingReference: booking.booking_reference ?? undefined,
        property_id: booking.property_id,
        submission_id: booking.submission_id ?? undefined,
        property: booking.property ? {
          ...booking.property,
          house_rules: Array.isArray(booking.property.house_rules)
            ? booking.property.house_rules.filter(rule => typeof rule === 'string') as string[]
            : [],
          contract_template: typeof booking.property.contract_template === 'object' && booking.property.contract_template !== null
            ? booking.property.contract_template
            : {},
        } : undefined,
        guests: booking.guests?.map(guest => ({
          id: guest.id,
          fullName: guest.full_name,
          dateOfBirth: guest.date_of_birth,
          documentNumber: guest.document_number,
          nationality: guest.nationality,
          placeOfBirth: guest.place_of_birth ?? undefined,
          documentType: guest.document_type as 'passport' | 'national_id'
        })) ?? [],
        status: booking.status as 'pending' | 'completed' | 'archived',
        createdAt: booking.created_at,
        documentsGenerated: typeof booking.documents_generated === 'object' && booking.documents_generated !== null
          ? booking.documents_generated as { policeForm: boolean; contract: boolean; }
          : { policeForm: false, contract: false }
      }));

      // Enrich bookings with guest submission data
      const enrichedBookings = await enrichBookingsWithGuestSubmissions(transformedBookings);

      setState(prev => ({
        ...prev,
        bookings: enrichedBookings,
        isLoading: false,
        lastUpdated: new Date()
      }));

      info('Bookings loaded successfully', {
        count: enrichedBookings.length,
        userId: user.id
      });

    } catch (err) {
      handleError(err, { userId: user?.id, operation: 'loadBookings' });

      if (err instanceof DatabaseError || err instanceof NetworkError) {
        setState(prev => ({
          ...prev,
          error: err.message,
          isLoading: false
        }));
      } else {
        setState(prev => ({
          ...prev,
          error: 'Une erreur inattendue s\'est produite lors du chargement des réservations.',
          isLoading: false
        }));
      }
    }
  }, [user]);

  const addBooking = useCallback(async (booking: Booking) => {
    try {
      if (!user) {
        throw new Error('No authenticated user');
      }

      info('Adding new booking', {
        bookingId: booking.id,
        propertyId: booking.property_id,
        userId: user.id
      });

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
          status: booking.status,
          documents_generated: booking.documentsGenerated
        })
        .select()
        .single();

      if (bookingError) {
        throw new DatabaseError(`Failed to add booking: ${bookingError.message}`, {
          booking,
          error: bookingError
        });
      }

      // Insert guests
      if (booking.guests.length > 0) {
        debug('Inserting guests', { count: booking.guests.length });

        const guestsData = booking.guests.map(guest => {
          // Validate and clean the date format
          let cleanDateOfBirth = guest.dateOfBirth;
          if (cleanDateOfBirth && !cleanDateOfBirth.match(/^\d{4}-\d{2}-\d{2}$/)) {
            warn('Invalid date format detected', { date: cleanDateOfBirth });
            // Try to parse and reformat the date
            const date = new Date(cleanDateOfBirth);
            if (!isNaN(date.getTime())) {
              cleanDateOfBirth = date.toISOString().split('T')[0];
              debug('Date reformatted', { original: guest.dateOfBirth, formatted: cleanDateOfBirth });
            } else {
              error('Could not parse date, setting to null', { date: cleanDateOfBirth });
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
            document_type: guest.documentType
          };
        });

        const { error: guestsError } = await supabase
          .from('guests')
          .insert(guestsData);

        if (guestsError) {
          throw new DatabaseError(`Failed to add guests: ${guestsError.message}`, {
            guests: guestsData,
            error: guestsError
          });
        }
      }

      // Reload bookings to get the updated data
      await loadBookings();

      info('Booking added successfully', {
        bookingId: bookingData.id,
        userId: user.id
      });

    } catch (err) {
      handleError(err, {
        userId: user?.id,
        operation: 'addBooking',
        booking
      });
      throw err;
    }
  }, [user, loadBookings]);

  const updateBooking = useCallback(async (bookingId: string, updates: Partial<Booking>) => {
    try {
      if (!user) {
        throw new Error('No authenticated user');
      }

      info('Updating booking', { bookingId, userId: user.id });

      const updateData: Record<string, unknown> = {};

      // Map Booking interface fields to database fields
      if (updates.checkInDate !== undefined) updateData.check_in_date = updates.checkInDate;
      if (updates.checkOutDate !== undefined) updateData.check_out_date = updates.checkOutDate;
      if (updates.numberOfGuests !== undefined) updateData.number_of_guests = updates.numberOfGuests;
      if (updates.bookingReference !== undefined) updateData.booking_reference = updates.bookingReference;
      if (updates.status !== undefined) updateData.status = updates.status;
      if (updates.documentsGenerated !== undefined) updateData.documents_generated = updates.documentsGenerated;

      const { error: updateError } = await supabase
        .from('bookings')
        .update(updateData)
        .eq('id', bookingId)
        .eq('user_id', user.id);

      if (updateError) {
        throw new DatabaseError(`Failed to update booking: ${updateError.message}`, {
          bookingId,
          updates,
          error: updateError
        });
      }

      // Reload bookings to get the updated data
      await loadBookings();

      info('Booking updated successfully', { bookingId, userId: user.id });

    } catch (err) {
      handleError(err, {
        userId: user?.id,
        operation: 'updateBooking',
        bookingId,
        updates
      });
      throw err;
    }
  }, [user, loadBookings]);

  const deleteBooking = useCallback(async (bookingId: string) => {
    try {
      if (!user) {
        throw new Error('No authenticated user');
      }

      info('Deleting booking', { bookingId, userId: user.id });

      const { error: deleteError } = await supabase
        .from('bookings')
        .delete()
        .eq('id', bookingId)
        .eq('user_id', user.id);

      if (deleteError) {
        throw new DatabaseError(`Failed to delete booking: ${deleteError.message}`, {
          bookingId,
          error: deleteError
        });
      }

      // Reload bookings to get the updated data
      await loadBookings();

      info('Booking deleted successfully', { bookingId, userId: user.id });

    } catch (err) {
      handleError(err, {
        userId: user?.id,
        operation: 'deleteBooking',
        bookingId
      });
      throw err;
    }
  }, [user, loadBookings]);

  // Load bookings when user changes
  useEffect(() => {
    if (user) {
      void loadBookings();
    }
  }, [user, loadBookings]);

  // Set up real-time subscriptions
  useEffect(() => {
    if (user) {
      setupRealtimeSubscriptions();
    }

    return () => {
      cleanupRealtimeSubscriptions();
    };
  }, [user, setupRealtimeSubscriptions, cleanupRealtimeSubscriptions]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanupRealtimeSubscriptions();
      if (abortController.current) {
        abortController.current.abort();
      }
    };
  }, [cleanupRealtimeSubscriptions]);

  return {
    ...state,
    addBooking,
    updateBooking,
    deleteBooking,
    refresh: loadBookings,
  };
};
