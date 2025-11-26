import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Booking } from '@/types/booking';
import { useAuth } from '@/hooks/useAuth';
import { enrichBookingsWithGuestSubmissions, EnrichedBooking } from '@/services/guestSubmissionService';
import { validateBookingData, logDataError } from '@/utils/errorMonitoring';
import { debug, info, warn, error as logError } from '@/lib/logger';

export const useBookings = () => {
  const [bookings, setBookings] = useState<EnrichedBooking[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const loadingRef = useRef(false);
  const { user } = useAuth();

  useEffect(() => {
    loadBookings();
  }, []);

  // Reload bookings when user changes
  useEffect(() => {
    if (user) {
      loadBookings();
    }
  }, [user?.id]); // ✅ FIX: Utiliser user.id au lieu de user pour éviter les re-renders

  // ✅ AMÉLIORATION : Set up real-time subscriptions for automatic updates avec debounce optimisé
  useEffect(() => {
    if (!user) return;

    debug('Setting up real-time subscriptions for bookings and guests');

    // ✅ PROTECTION : Éviter les boucles infinies et les appels multiples
    let isProcessing = false;
    let debounceTimeout: NodeJS.Timeout | null = null;
    const DEBOUNCE_DELAY = 300; // 300ms de debounce pour éviter les appels multiples
    
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
    
    // Subscribe to changes in bookings table
    const bookingsChannel = supabase
      .channel(`bookings-realtime-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*', // INSERT, UPDATE, DELETE
          schema: 'public',
          table: 'bookings'
        },
        (payload) => {
          debug('Real-time: Changement détecté dans bookings', {
            event: payload.eventType,
            id: payload.new?.id || payload.old?.id
          });
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
  }, [user?.id]); // ✅ FIX: Utiliser user.id au lieu de user pour éviter les re-renders

  const loadBookings = async () => {
    try {
      // ✅ PROTECTION : Éviter les appels multiples simultanés avec une ref indépendante de l'état React
      if (loadingRef.current) {
        debug('Already loading bookings, skipping');
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
      
      debug('Loading bookings for user', { userId: user.id });
      
      // ✅ FILTRE : Charger toutes les réservations, puis filtrer côté application
      // (pour éviter l'erreur si 'draft' n'existe pas encore dans l'ENUM)
      const { data: bookingsData, error } = await supabase
        .from('bookings')
        .select(`
          *,
          guests (*),
          property:properties (*)
        `)
        .order('created_at', { ascending: false });

      if (error) {
        logError('Error loading bookings', error as Error);
        return;
      }

      debug('Raw bookings data from Supabase', { count: bookingsData?.length || 0 });

      // ✅ FILTRE DÉFENSIF : Exclure les réservations 'draft' côté application si nécessaire
      // (au cas où le filtre DB n'a pas fonctionné ou si 'draft' n'existe pas encore)
      const filteredBookingsData = bookingsData?.filter(booking => {
        // Si le statut est 'draft', exclure (même si c'est une string, pas encore dans l'ENUM)
        if (booking.status === 'draft' || (booking.status as any) === 'draft') {
          return false;
        }
        return true;
      }) || [];

      // ✅ Transform Supabase data with defensive validation + monitoring
      const transformedBookings: Booking[] = filteredBookingsData.map(booking => {
        // ✅ VALIDATION CRITIQUE : Exclure les bookings sans property_id
        if (!booking.property_id) {
          warn('Booking sans property_id détecté et exclu', { bookingId: booking.id });
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
        guest_name: booking.guest_name || undefined,
          
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
          status: booking.status as 'pending' | 'completed' | 'archived' | 'draft',
          createdAt: booking.created_at,
          documentsGenerated: typeof booking.documents_generated === 'object' && booking.documents_generated !== null
            ? booking.documents_generated as { policeForm: boolean; contract: boolean; }
            : { policeForm: false, contract: false }
        };

        // ✅ VALIDATION FINALE avec monitoring
        const isValid = validateBookingData(transformedBooking, 'useBookings.transform');
        if (!isValid) {
          warn('Booking avec données invalides détecté', { bookingId: transformedBooking.id });
        }

        return transformedBooking;
      }).filter(Boolean) as Booking[]; // ✅ Exclure les bookings null

      debug('Bookings transformés', { 
        transformed: transformedBookings.length, 
        total: bookingsData?.length || 0 
      });

      // Enrich bookings with guest submission data
      const enrichedBookings = await enrichBookingsWithGuestSubmissions(transformedBookings);
      debug('Bookings enrichis', { 
        count: enrichedBookings.length,
        ids: enrichedBookings.map(b => b.id)
      });
      setBookings(enrichedBookings);
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
        createdAt: bookingData.created_at
      };
      setBookings(prevBookings => [newBooking, ...prevBookings]);
      
      // Refresh bookings to get the complete data with relationships
      // La subscription en temps réel va aussi déclencher un refresh, mais on le fait immédiatement pour UX
      await loadBookings();
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
