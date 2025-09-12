import { supabase } from '@/integrations/supabase/client';
import { Booking } from '@/types/booking';

export interface DocumentSyncResult {
  success: boolean;
  bookingId?: string;
  documents?: any[];
  documentUrls?: string[];
  enrichedBooking?: Booking;
  message?: string;
  error?: string;
}

export class DocumentSyncService {
  
  /**
   * Synchroniser tous les documents pour une réservation
   */
  static async syncAllDocuments(bookingId: string): Promise<DocumentSyncResult> {
    try {
      console.log('🔄 Syncing all documents for booking:', bookingId);
      
      const { data, error } = await supabase.functions.invoke('sync-documents', {
        body: {
          bookingId: bookingId,
          documentType: 'all'
        }
      });

      if (error) {
        console.error('❌ Document sync error:', error);
        return {
          success: false,
          error: error.message || 'Erreur lors de la synchronisation des documents'
        };
      }

      console.log('✅ Documents synced successfully:', data);
      return {
        success: true,
        bookingId: data.bookingId,
        documents: data.documents,
        documentUrls: data.documentUrls,
        enrichedBooking: data.enrichedBooking,
        message: data.message
      };

    } catch (error) {
      console.error('❌ Document sync service error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erreur inconnue'
      };
    }
  }

  /**
   * Synchroniser uniquement les documents d'identité
   */
  static async syncIdentityDocuments(bookingId: string): Promise<DocumentSyncResult> {
    try {
      console.log('🔄 Syncing identity documents for booking:', bookingId);
      
      const { data, error } = await supabase.functions.invoke('sync-documents', {
        body: {
          bookingId: bookingId,
          documentType: 'identity'
        }
      });

      if (error) {
        console.error('❌ Identity sync error:', error);
        return {
          success: false,
          error: error.message || 'Erreur lors de la synchronisation des documents d\'identité'
        };
      }

      return {
        success: true,
        bookingId: data.bookingId,
        documents: data.documents,
        documentUrls: data.documentUrls,
        enrichedBooking: data.enrichedBooking,
        message: data.message
      };

    } catch (error) {
      console.error('❌ Identity sync service error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erreur inconnue'
      };
    }
  }

  /**
   * Générer le contrat
   */
  static async generateContract(bookingId: string): Promise<DocumentSyncResult> {
    try {
      console.log('🔄 Generating contract for booking:', bookingId);
      
      const { data, error } = await supabase.functions.invoke('sync-documents', {
        body: {
          bookingId: bookingId,
          documentType: 'contract'
        }
      });

      if (error) {
        console.error('❌ Contract generation error:', error);
        return {
          success: false,
          error: error.message || 'Erreur lors de la génération du contrat'
        };
      }

      return {
        success: true,
        bookingId: data.bookingId,
        documents: data.documents,
        documentUrls: data.documentUrls,
        enrichedBooking: data.enrichedBooking,
        message: data.message
      };

    } catch (error) {
      console.error('❌ Contract generation service error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erreur inconnue'
      };
    }
  }

  /**
   * Générer les fiches de police
   */
  static async generatePoliceForms(bookingId: string): Promise<DocumentSyncResult> {
    try {
      console.log('🔄 Generating police forms for booking:', bookingId);
      
      const { data, error } = await supabase.functions.invoke('sync-documents', {
        body: {
          bookingId: bookingId,
          documentType: 'police'
        }
      });

      if (error) {
        console.error('❌ Police forms generation error:', error);
        return {
          success: false,
          error: error.message || 'Erreur lors de la génération des fiches de police'
        };
      }

      return {
        success: true,
        bookingId: data.bookingId,
        documents: data.documents,
        documentUrls: data.documentUrls,
        enrichedBooking: data.enrichedBooking,
        message: data.message
      };

    } catch (error) {
      console.error('❌ Police forms generation service error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erreur inconnue'
      };
    }
  }

  /**
   * Vérifier le statut des documents pour une réservation
   */
  static async getDocumentStatus(bookingId: string): Promise<{
    hasIdentity: boolean;
    hasContract: boolean;
    hasPolice: boolean;
    hasSignature: boolean;
  }> {
    try {
      const { data: booking, error } = await supabase
        .from('bookings')
        .select(`
          documents_generated,
          contract_signatures(id)
        `)
        .eq('id', bookingId)
        .single();

      if (error || !booking) {
        return {
          hasIdentity: false,
          hasContract: false,
          hasPolice: false,
          hasSignature: false
        };
      }

      const documentsGenerated = booking.documents_generated || {};
      const hasSignature = booking.contract_signatures && booking.contract_signatures.length > 0;

      return {
        hasIdentity: documentsGenerated.identity || false,
        hasContract: documentsGenerated.contract || false,
        hasPolice: documentsGenerated.police || false,
        hasSignature: hasSignature
      };

    } catch (error) {
      console.error('❌ Error getting document status:', error);
      return {
        hasIdentity: false,
        hasContract: false,
        hasPolice: false,
        hasSignature: false
      };
    }
  }
}
