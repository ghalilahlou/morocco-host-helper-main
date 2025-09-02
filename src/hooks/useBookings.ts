import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Booking } from '@/types/booking';
import { useAuth } from '@/hooks/useAuth';
import { enrichBookingsWithGuestSubmissions, EnrichedBooking } from '@/services/guestSubmissionService';
import { validateBookingData, logDataError } from '@/utils/errorMonitoring';

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

    // ✅ PROTECTION : Éviter les boucles infinies
    let isProcessing = false;
    
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
          if (!isProcessing) {
            console.log('📊 Real-time booking update:', payload);
            isProcessing = true;
            loadBookings().finally(() => {
              isProcessing = false;
            });
          }
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
          if (!isProcessing) {
            console.log('👤 Real-time guest update:', payload);
            isProcessing = true;
            loadBookings().finally(() => {
              isProcessing = false;
            });
          }
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
          if (!isProcessing) {
            console.log('📝 Real-time guest submission update:', payload);
            isProcessing = true;
            loadBookings().finally(() => {
              isProcessing = false;
            });
          }
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

      // ✅ Transform Supabase data with defensive validation + monitoring
      const transformedBookings: Booking[] = bookingsData?.map(booking => {
        // ✅ VALIDATION CRITIQUE : Exclure les bookings sans property_id
        if (!booking.property_id) {
          console.warn('⚠️ Booking sans property_id détecté et exclu:', booking.id);
          logDataError('missing_property_id', 'useBookings.loadBookings', {
            bookingId: booking.id,
            createdAt: booking.created_at,
            hasProperty: !!booking.property
          });
          return null;
        }

        const transformedBooking = {
          id: booking.id,
          checkInDate: booking.check_in_date,
          checkOutDate: booking.check_out_date,
          numberOfGuests: booking.number_of_guests,
          bookingReference: booking.booking_reference || undefined,
          
          // ✅ CORRECTION : CamelCase cohérent
          propertyId: booking.property_id,
          submissionId: booking.submission_id || undefined,
          
          // ✅ DÉFENSIVE : Validation property avec fallback
          property: booking.property ? {
            ...booking.property,
            house_rules: Array.isArray(booking.property.house_rules) 
              ? booking.property.house_rules.filter(rule => typeof rule === 'string') as string[]
              : [],
            contract_template: typeof booking.property.contract_template === 'object' && booking.property.contract_template !== null 
              ? booking.property.contract_template 
              : {},
          } : {
            // ✅ Fallback si property manque mais property_id existe
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
        };

        // ✅ VALIDATION FINALE avec monitoring
        const isValid = validateBookingData(transformedBooking, 'useBookings.transform');
        if (!isValid) {
          console.warn('⚠️ Booking avec données invalides détecté:', transformedBooking.id);
        }

        return transformedBooking;
      }).filter(Boolean) as Booking[]; // ✅ Exclure les bookings null

      console.log(`📊 Bookings transformés: ${transformedBookings.length}/${bookingsData?.length || 0}`);

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
      console.log('🔄 Updating booking with safety checks:', id, updates);
      
      // ✅ CORRECTION: Utilisation d'une transaction atomique pour éviter les race conditions
      const { data: currentBooking, error: fetchError } = await supabase
        .from('bookings')
        .select('*')
        .eq('id', id)
        .single();

      if (fetchError || !currentBooking) {
        console.error('❌ Error fetching current booking for update:', fetchError);
        return;
      }

      const updateData: any = {};
      if (updates.checkInDate) updateData.check_in_date = updates.checkInDate;
      if (updates.checkOutDate) updateData.check_out_date = updates.checkOutDate;
      if (updates.numberOfGuests) updateData.number_of_guests = updates.numberOfGuests;
      if (updates.bookingReference !== undefined) updateData.booking_reference = updates.bookingReference;
      
      // ✅ CORRECTION: Gestion sécurisée des documents générés
      if (updates.documentsGenerated) {
        // Merge safely with current state from DB (not from local state)
        const currentDocGen = currentBooking.documents_generated || { policeForm: false, contract: false };
        const newDocGen = { ...currentDocGen, ...updates.documentsGenerated };
        updateData.documents_generated = newDocGen;
        
        console.log('📋 Document generation state:', {
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
          console.log('✅ Auto-completing booking - both documents generated');
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
        console.error('❌ Error updating booking (possible concurrent modification):', error);
        // Retry once if it's a concurrent modification
        if (error.message?.includes('conflict') || error.code === 'PGRST116') {
          console.log('🔄 Retrying booking update due to concurrent modification...');
          return updateBooking(id, updates); // Recursive retry
        }
        return;
      }

      console.log('✅ Booking updated successfully');
      await loadBookings();
    } catch (error) {
      console.error('❌ Error updating booking:', error);
    }
  };

  const deleteBooking = async (id: string) => {
    try {
      console.log('🗑️ Starting deletion of booking:', id);
      
      // Step 1: Delete related guest submissions first
      const { error: guestSubmissionsError } = await supabase
        .from('guest_submissions')
        .delete()
        .eq('booking_id', id);

      if (guestSubmissionsError) {
        console.warn('⚠️ Warning: Could not delete guest submissions:', guestSubmissionsError);
        // Continue with deletion even if guest submissions deletion fails
      } else {
        console.log('✅ Guest submissions deleted successfully');
      }

      // Step 2: Delete related guests
      const { error: guestsError } = await supabase
        .from('guests')
        .delete()
        .eq('booking_id', id);

      if (guestsError) {
        console.warn('⚠️ Warning: Could not delete guests:', guestsError);
      } else {
        console.log('✅ Guests deleted successfully');
      }

      // Step 3: Delete related uploaded documents
      const { error: documentsError } = await supabase
        .from('uploaded_documents')
        .delete()
        .eq('booking_id', id);

      if (documentsError) {
        console.warn('⚠️ Warning: Could not delete uploaded documents:', documentsError);
      } else {
        console.log('✅ Uploaded documents deleted successfully');
      }

      // Step 4: Now delete the booking
      const { error } = await supabase
        .from('bookings')
        .delete()
        .eq('id', id);

      if (error) {
        console.error('❌ Error deleting booking:', error);
        throw error;
      }

      console.log('✅ Booking deleted successfully');
      await loadBookings();
    } catch (error) {
      console.error('❌ Error in deleteBooking:', error);
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
