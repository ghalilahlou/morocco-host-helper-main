import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Booking } from '@/types/booking';
import { useAuth } from '@/hooks/useAuth';
import { enrichBookingsWithGuestSubmissions, EnrichedBooking } from '@/services/guestSubmissionService';

export const useBookings = () => {
  const [bookings, setBookings] = useState<EnrichedBooking[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { user } = useAuth();

  useEffect(() => {
    loadBookings();
  }, []);

  // Reload bookings when user changes
  useEffect(() => {
    if (user) {
      loadBookings();
    }
  }, [user]);

  // Set up real-time subscriptions for automatic updates
  useEffect(() => {
    if (!user) return;

    console.log('🔄 Setting up real-time subscriptions for bookings and guests');

    // Subscribe to changes in bookings table
    const bookingsChannel = supabase
      .channel('schema-db-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'bookings'
        },
        (payload) => {
          console.log('📊 Real-time booking update:', payload);
          loadBookings();
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
          console.log('👤 Real-time guest update:', payload);
          loadBookings();
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
          console.log('📝 Real-time guest submission update:', payload);
          loadBookings();
        }
      )
      .subscribe();

    return () => {
      console.log('🛑 Cleaning up real-time subscriptions');
      supabase.removeChannel(bookingsChannel);
    };
  }, [user]);

  const loadBookings = async () => {
    try {
      setIsLoading(true);
      
      // Check if user is authenticated
      if (!user) {
        console.log('👤 No authenticated user, skipping booking load');
        setBookings([]);
        return;
      }
      
      console.log('👤 Loading bookings for user:', user.id);
      
      const { data: bookingsData, error } = await supabase
        .from('bookings')
        .select(`
          *,
          guests (*),
          property:properties (*)
        `)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('❌ Error loading bookings:', error);
        return;
      }

      console.log('📊 Raw bookings data from Supabase:', bookingsData);
      console.log('📊 Number of bookings returned:', bookingsData?.length || 0);

      // Transform Supabase data to match our Booking interface
      const transformedBookings: Booking[] = bookingsData?.map(booking => ({
        id: booking.id,
        checkInDate: booking.check_in_date,
        checkOutDate: booking.check_out_date,
        numberOfGuests: booking.number_of_guests,
        bookingReference: booking.booking_reference || undefined,
        property_id: booking.property_id,
        submission_id: booking.submission_id || undefined,
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
          placeOfBirth: guest.place_of_birth || undefined,
          documentType: guest.document_type as 'passport' | 'national_id'
        })) || [],
        status: booking.status as 'pending' | 'completed' | 'archived',
        createdAt: booking.created_at,
        documentsGenerated: typeof booking.documents_generated === 'object' && booking.documents_generated !== null
          ? booking.documents_generated as { policeForm: boolean; contract: boolean; }
          : { policeForm: false, contract: false }
      })) || [];

      // Enrich bookings with guest submission data
      const enrichedBookings = await enrichBookingsWithGuestSubmissions(transformedBookings);
      setBookings(enrichedBookings);
    } catch (error) {
      console.error('Error loading bookings:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const addBooking = async (booking: Booking) => {
    try {
      console.log('Adding new booking:', booking);
      
      if (!user) {
        console.error('No authenticated user');
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
          status: booking.status,
          documents_generated: booking.documentsGenerated
        })
        .select()
        .single();

      if (bookingError) {
        console.error('Error adding booking:', bookingError);
        return;
      }

      // Insert guests
      if (booking.guests.length > 0) {
        console.log('📋 Inserting guests:', booking.guests);
        
        const guestsData = booking.guests.map(guest => {
          // Validate and clean the date format
          let cleanDateOfBirth = guest.dateOfBirth;
          if (cleanDateOfBirth && !cleanDateOfBirth.match(/^\d{4}-\d{2}-\d{2}$/)) {
            console.warn('⚠️ Invalid date format detected:', cleanDateOfBirth);
            // Try to parse and reformat the date
            const date = new Date(cleanDateOfBirth);
            if (!isNaN(date.getTime())) {
              cleanDateOfBirth = date.toISOString().split('T')[0];
              console.log('✅ Date reformatted to:', cleanDateOfBirth);
            } else {
              console.error('❌ Could not parse date, setting to null');
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

        console.log('📋 Final guests data for insert:', guestsData);

        const { error: guestsError } = await supabase
          .from('guests')
          .insert(guestsData);

        if (guestsError) {
          console.error('❌ Error adding guests:', guestsError);
          return;
        } else {
          console.log('✅ Guests added successfully');
        }
      }

      // Refresh bookings to get the complete data with relationships
      await loadBookings();
    } catch (error) {
      console.error('Error adding booking:', error);
    }
  };

  const updateBooking = async (id: string, updates: Partial<Booking>) => {
    try {
      console.log('Updating booking:', id, updates);
      
      const updateData: any = {};
      if (updates.checkInDate) updateData.check_in_date = updates.checkInDate;
      if (updates.checkOutDate) updateData.check_out_date = updates.checkOutDate;
      if (updates.numberOfGuests) updateData.number_of_guests = updates.numberOfGuests;
      if (updates.bookingReference !== undefined) updateData.booking_reference = updates.bookingReference;
      if (updates.status) updateData.status = updates.status;
      if (updates.documentsGenerated) {
        updateData.documents_generated = updates.documentsGenerated;
        
        // Auto-set status to completed if both documents are generated
        const currentBooking = bookings.find(b => b.id === id);
        if (currentBooking) {
          const newDocGen = { ...currentBooking.documentsGenerated, ...updates.documentsGenerated };
          if (newDocGen.contract && newDocGen.policeForm && currentBooking.status !== 'completed') {
            updateData.status = 'completed';
          }
        }
      }

      const { error } = await supabase
        .from('bookings')
        .update(updateData)
        .eq('id', id);

      if (error) {
        console.error('Error updating booking:', error);
        return;
      }

      await loadBookings();
    } catch (error) {
      console.error('Error updating booking:', error);
    }
  };

  const deleteBooking = async (id: string) => {
    try {
      const { error } = await supabase
        .from('bookings')
        .delete()
        .eq('id', id);

      if (error) {
        console.error('Error deleting booking:', error);
        return;
      }

      await loadBookings();
    } catch (error) {
      console.error('Error deleting booking:', error);
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
