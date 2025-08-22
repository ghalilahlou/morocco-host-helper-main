import { supabase } from '@/integrations/supabase/client';

interface BookingVerificationSummary {
  bookingId: string;
  guestSubmissionsCount: number;
  uploadedDocumentsCount: number;
  hasSignature: boolean;
}

export class BookingVerificationService {
  
  /**
   * Get verification summary for multiple bookings
   */
  static async getVerificationSummaries(bookingIds: string[]): Promise<Record<string, BookingVerificationSummary>> {
    try {
      console.log('📊 Getting verification summaries for bookings:', bookingIds);
      
      const { data: summaries, error } = await supabase.functions.invoke('get-booking-verification-summary', {
        body: { bookingIds }
      });

      if (error) {
        console.error('❌ Error getting verification summaries:', error);
        return {};
      }

      if (!summaries || !Array.isArray(summaries)) {
        console.warn('⚠️ No summaries returned');
        return {};
      }

      // Convert array to record keyed by booking_id
      const summaryMap: Record<string, BookingVerificationSummary> = {};
      
      for (const summary of summaries) {
        summaryMap[summary.booking_id] = {
          bookingId: summary.booking_id,
          guestSubmissionsCount: summary.guest_submissions_count || 0,
          uploadedDocumentsCount: summary.uploaded_documents_count || 0,
          hasSignature: summary.has_signature || false
        };
      }

      console.log('✅ Retrieved verification summaries for', Object.keys(summaryMap).length, 'bookings');
      return summaryMap;
      
    } catch (error) {
      console.error('❌ Exception getting verification summaries:', error);
      return {};
    }
  }

  /**
   * Get verification summary for a single booking
   */
  static async getVerificationSummary(bookingId: string): Promise<BookingVerificationSummary | null> {
    const summaries = await this.getVerificationSummaries([bookingId]);
    return summaries[bookingId] || null;
  }

  /**
   * Get verification summaries for all bookings in a property
   */
  static async getPropertyVerificationSummaries(propertyId: string): Promise<Record<string, BookingVerificationSummary>> {
    try {
      console.log('📊 Getting verification summaries for property:', propertyId);
      
      const { data: summaries, error } = await supabase.functions.invoke('get-booking-verification-summary', {
        body: { propertyId }
      });

      if (error) {
        console.error('❌ Error getting property verification summaries:', error);
        return {};
      }

      if (!summaries || !Array.isArray(summaries)) {
        console.warn('⚠️ No summaries returned for property');
        return {};
      }

      // Convert array to record keyed by booking_id
      const summaryMap: Record<string, BookingVerificationSummary> = {};
      
      for (const summary of summaries) {
        summaryMap[summary.booking_id] = {
          bookingId: summary.booking_id,
          guestSubmissionsCount: summary.guest_submissions_count || 0,
          uploadedDocumentsCount: summary.uploaded_documents_count || 0,
          hasSignature: summary.has_signature || false
        };
      }

      console.log('✅ Retrieved verification summaries for property:', Object.keys(summaryMap).length, 'bookings');
      return summaryMap;
      
    } catch (error) {
      console.error('❌ Exception getting property verification summaries:', error);
      return {};
    }
  }
}