import { supabase } from '@/integrations/supabase/client';
import { Booking } from '@/types/booking';

interface GuestSubmissionData {
  id: string;
  booking_id: string | null;
  guest_data: any;
  document_urls: any;
  signature_data: string | null;
  status: string;
  submitted_at: string;
}

export interface EnrichedBooking extends Booking {
  realGuestNames: string[];
  realGuestCount: number;
  hasRealSubmissions: boolean;
  submissionStatus: {
    hasDocuments: boolean;
    hasSignature: boolean;
    documentsCount: number;
  };
}

/**
 * Enriches bookings with real guest submission data from v_guest_submissions
 */
export const enrichBookingsWithGuestSubmissions = async (bookings: Booking[]): Promise<EnrichedBooking[]> => {
  if (bookings.length === 0) return [];

  try {
    // Get all booking IDs and validate they are UUIDs
    const bookingIds = bookings
      .map(b => b.id)
      .filter(id => id && id.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i));
    
    if (bookingIds.length === 0) {
      console.warn('❌ No valid booking IDs found');
      return bookings.map(booking => ({
        ...booking,
        realGuestNames: [],
        realGuestCount: 0,
        hasRealSubmissions: false,
        submissionStatus: {
          hasDocuments: false,
          hasSignature: false,
          documentsCount: 0
        }
      }));
    }
    
    // Fetch guest submissions ONLY for valid UUID booking IDs
    const { data: submissions, error } = await supabase
      .from('v_guest_submissions')
      .select('*')
      .in('booking_id', bookingIds)
      .not('booking_id', 'is', null);

    if (error) {
      console.error('❌ Error fetching guest submissions:', error);
      return bookings.map(booking => ({
        ...booking,
        realGuestNames: [],
        realGuestCount: 0,
        hasRealSubmissions: false,
        submissionStatus: {
          hasDocuments: false,
          hasSignature: false,
          documentsCount: 0
        }
      }));
    }

    console.log('✅ Fetched guest submissions:', submissions);

    // Group submissions by booking_id
    const submissionsByBooking = (submissions || []).reduce((acc, submission) => {
      const bookingId = submission.booking_id;
      if (!bookingId) return acc;
      
      if (!acc[bookingId]) {
        acc[bookingId] = [];
      }
      acc[bookingId].push(submission);
      return acc;
    }, {} as Record<string, GuestSubmissionData[]>);

    // Enrich each booking with submission data
    const enrichedBookings: EnrichedBooking[] = bookings.map(booking => {
      const bookingSubmissions = submissionsByBooking[booking.id] || [];
      
      // Extract real guest names from submissions
      const realGuestNames: string[] = [];
      let totalDocuments = 0;
      let hasSignature = false;

      bookingSubmissions.forEach(submission => {
        if (submission.guest_data) {
          // Handle different possible structures in guest_data
          if (Array.isArray(submission.guest_data)) {
            submission.guest_data.forEach((guest: any) => {
              if (guest.fullName || guest.full_name) {
                realGuestNames.push(guest.fullName || guest.full_name);
              }
            });
          } else if (typeof submission.guest_data === 'object') {
            // Handle single guest or guests array in object
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

        // Count documents
        if (submission.document_urls) {
          if (Array.isArray(submission.document_urls)) {
            totalDocuments += submission.document_urls.length;
          } else if (typeof submission.document_urls === 'string') {
            try {
              const parsed = JSON.parse(submission.document_urls);
              if (Array.isArray(parsed)) {
                totalDocuments += parsed.length;
              }
            } catch (e) {
              // If it's a string but not JSON, count as 1 document
              totalDocuments += 1;
            }
          }
        }

        // Check for signature
        if (submission.signature_data) {
          hasSignature = true;
        }
      });

      // Remove duplicates and clean names
      const uniqueNames = [...new Set(realGuestNames)]
        .filter(name => name && name.trim().length > 0)
        .map(name => name.trim().toUpperCase());

      return {
        ...booking,
        realGuestNames: uniqueNames,
        realGuestCount: uniqueNames.length,
        hasRealSubmissions: bookingSubmissions.length > 0,
        submissionStatus: {
          hasDocuments: totalDocuments > 0,
          hasSignature,
          documentsCount: totalDocuments
        }
      };
    });

    console.log('✅ Enriched bookings with guest submissions:', enrichedBookings);
    return enrichedBookings;

  } catch (error) {
    console.error('❌ Error enriching bookings:', error);
    return bookings.map(booking => ({
      ...booking,
      realGuestNames: [],
      realGuestCount: 0,
      hasRealSubmissions: false,
      submissionStatus: {
        hasDocuments: false,
        hasSignature: false,
        documentsCount: 0
      }
    }));
  }
};