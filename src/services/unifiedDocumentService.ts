import { supabase } from '@/integrations/supabase/client';
import { FRONT_CALENDAR_ICS_SYNC_ENABLED } from '@/config/frontCalendarSync';
import { Booking } from '@/types/booking';

export interface DocumentInfo {
  id: string;
  type: 'identity' | 'contract' | 'police';
  fileName: string;
  url: string;
  guestName?: string;
  createdAt: string;
  isSigned?: boolean;
  signedAt?: string;
}

export interface GuestDocumentSummary {
  bookingId: string;
  guestCount: number;
  documents: {
    identity: DocumentInfo[];
    contract: DocumentInfo[];
    police: DocumentInfo[];
  };
  summary: {
    totalDocuments: number;
    hasAllRequired: boolean;
    missingTypes: string[];
  };
}

export interface EnrichedBooking extends Booking {
  documentSummary?: GuestDocumentSummary;
  hasCompleteDocuments: boolean;
  missingDocumentTypes: string[];
}

/**
 * Service unifié pour la gestion des documents
 * Remplace les services fragmentés par une logique cohérente
 */
export class UnifiedDocumentService {
  
  /**
   * Récupérer tous les documents pour une réservation
   */
  static async getBookingDocuments(bookingId: string): Promise<GuestDocumentSummary | null> {
    try {
      console.log('📋 Fetching documents for booking:', bookingId);
      
      const { data, error } = await supabase.functions.invoke('get-guest-documents-unified', {
        body: { bookingId }
      });

      if (error) {
        console.error('❌ Error fetching documents:', error);
        return null;
      }

      if (!data?.success || !data?.bookings || data.bookings.length === 0) {
        console.log('ℹ️ No documents found for booking');
        return null;
      }

      return data.bookings[0];
    } catch (error) {
      console.error('❌ Error in getBookingDocuments:', error);
      return null;
    }
  }

  /**
   * Récupérer tous les documents pour une propriété
   */
  static async getPropertyDocuments(propertyId: string): Promise<GuestDocumentSummary[]> {
    try {
      console.log('📋 Fetching documents for property:', propertyId);
      
      const { data, error } = await supabase.functions.invoke('get-guest-documents-unified', {
        body: { propertyId }
      });

      if (error) {
        console.error('❌ Error fetching documents:', error);
        return [];
      }

      if (!data?.success || !data?.bookings) {
        console.log('ℹ️ No documents found for property');
        return [];
      }

      return data.bookings;
    } catch (error) {
      console.error('❌ Error in getPropertyDocuments:', error);
      return [];
    }
  }

  /**
   * Enrichir les réservations avec les informations de documents
   */
  static async enrichBookingsWithDocuments(bookings: Booking[]): Promise<EnrichedBooking[]> {
    if (bookings.length === 0) return [];

    try {
      console.log(`📋 Enriching ${bookings.length} bookings with document data`);
      
      const enrichedBookings: EnrichedBooking[] = [];

      for (const booking of bookings) {
        const documentSummary = await this.getBookingDocuments(booking.id);
        
        const enrichedBooking: EnrichedBooking = {
          ...booking,
          documentSummary,
          hasCompleteDocuments: documentSummary?.summary.hasAllRequired || false,
          missingDocumentTypes: documentSummary?.summary.missingTypes || ['identity', 'contract', 'police']
        };

        enrichedBookings.push(enrichedBooking);
      }

      console.log(`✅ Enriched ${enrichedBookings.length} bookings`);
      return enrichedBookings;
    } catch (error) {
      console.error('❌ Error enriching bookings:', error);
      return bookings.map(booking => ({
        ...booking,
        hasCompleteDocuments: false,
        missingDocumentTypes: ['identity', 'contract', 'police']
      }));
    }
  }

  /**
   * Générer les documents manquants pour une réservation
   */
  static async generateMissingDocuments(bookingId: string, documentTypes: string[]): Promise<{
    success: boolean;
    message: string;
    generatedDocuments: string[];
  }> {
    try {
      console.log(`📄 Generating missing documents for booking ${bookingId}:`, documentTypes);
      
      const generatedDocuments: string[] = [];

      // ✅ CORRECTION : Utiliser la fonction unifiée pour tous les types de documents
      try {
        const { data, error } = await supabase.functions.invoke('submit-guest-info-unified', {
          body: {
            bookingId: bookingId,
            action: 'generate_all_documents',
            documentTypes: documentTypes
          }
        });

        if (error) {
          console.error(`❌ Error generating documents via unified function:`, error);
        } else if (data?.success) {
          // Analyser les documents générés
          if (data.contractUrl && documentTypes.includes('contract')) {
            generatedDocuments.push('contract');
          }
          if (data.policeUrl && documentTypes.includes('police')) {
            generatedDocuments.push('police');
          }
          if (data.identityDocuments && documentTypes.includes('identity')) {
            generatedDocuments.push('identity');
          }
          
          console.log(`✅ Generated documents via unified function:`, generatedDocuments);
        }
      } catch (docError) {
        console.error(`❌ Exception generating documents via unified function:`, docError);
      }

      const success = generatedDocuments.length === documentTypes.length;
      const message = success 
        ? `Successfully generated ${generatedDocuments.length} document(s)`
        : `Generated ${generatedDocuments.length} of ${documentTypes.length} document(s)`;

      return {
        success,
        message,
        generatedDocuments
      };
    } catch (error) {
      console.error('❌ Error generating missing documents:', error);
      return {
        success: false,
        message: 'Error generating documents',
        generatedDocuments: []
      };
    }
  }

  /**
   * Synchroniser les réservations Airbnb
   */
  static async syncAirbnbReservations(propertyId: string, force: boolean = false): Promise<{
    success: boolean;
    message: string;
    reservationsCount: number;
  }> {
    try {
      if (!FRONT_CALENDAR_ICS_SYNC_ENABLED) {
        return {
          success: false,
          message: 'Airbnb calendar sync disabled on front',
          reservationsCount: 0,
        };
      }
      console.log(`🔄 Syncing Airbnb reservations for property ${propertyId}`);
      
      const { data, error } = await supabase.functions.invoke('sync-airbnb-unified', {
        body: { propertyId, force }
      });

      if (error) {
        console.error('❌ Error syncing Airbnb:', error);
        return {
          success: false,
          message: `Sync failed: ${error.message}`,
          reservationsCount: 0
        };
      }

      if (data?.success) {
        console.log(`✅ Synced ${data.reservations_count} reservations`);
        return {
          success: true,
          message: data.message,
          reservationsCount: data.reservations_count
        };
      } else {
        return {
          success: false,
          message: data.message || 'Sync failed',
          reservationsCount: 0
        };
      }
    } catch (error) {
      console.error('❌ Error in syncAirbnbReservations:', error);
      return {
        success: false,
        message: 'Sync failed due to error',
        reservationsCount: 0
      };
    }
  }

  /**
   * Vérifier l'intégrité des documents
   */
  static async verifyDocumentIntegrity(bookingId: string): Promise<{
    success: boolean;
    message: string;
    issues: string[];
    summary: {
      totalDocuments: number;
      identityDocuments: number;
      contractDocuments: number;
      policeDocuments: number;
    };
  }> {
    try {
      const documentSummary = await this.getBookingDocuments(bookingId);
      
      if (!documentSummary) {
        return {
          success: false,
          message: 'No documents found for booking',
          issues: ['No documents found'],
          summary: {
            totalDocuments: 0,
            identityDocuments: 0,
            contractDocuments: 0,
            policeDocuments: 0
          }
        };
      }

      const issues: string[] = [];
      const summary = {
        totalDocuments: documentSummary.summary.totalDocuments,
        identityDocuments: documentSummary.documents.identity.length,
        contractDocuments: documentSummary.documents.contract.length,
        policeDocuments: documentSummary.documents.police.length
      };

      // Check for missing document types
      if (summary.identityDocuments === 0) {
        issues.push('Missing identity documents');
      }
      if (summary.contractDocuments === 0) {
        issues.push('Missing contract documents');
      }
      if (summary.policeDocuments === 0) {
        issues.push('Missing police forms');
      }

      // Check for unsigned contracts
      const unsignedContracts = documentSummary.documents.contract.filter(doc => !doc.isSigned);
      if (unsignedContracts.length > 0) {
        issues.push(`${unsignedContracts.length} unsigned contract(s)`);
      }

      const success = issues.length === 0;
      const message = success 
        ? `All documents are complete and valid`
        : `${issues.length} issue(s) found`;

      return {
        success,
        message,
        issues,
        summary
      };
    } catch (error) {
      console.error('❌ Error verifying document integrity:', error);
      return {
        success: false,
        message: 'Error verifying documents',
        issues: ['Verification failed'],
        summary: {
          totalDocuments: 0,
          identityDocuments: 0,
          contractDocuments: 0,
          policeDocuments: 0
        }
      };
    }
  }

  /**
   * Générer et télécharger les fiches de police pour tous les guests d'une réservation
   * ✅ NOUVELLE VERSION: Utilise la fonction dédiée generate-police-form
   */
  static async downloadPoliceFormsForAllGuests(booking: Booking): Promise<string> {
    try {
      console.log('📄 [UnifiedDocumentService] Génération fiches police pour booking:', booking.id);

      if (!booking.id) {
        throw new Error('Booking ID manquant');
      }

      // ✅ NOUVEAU: Appeler la nouvelle Edge Function dédiée generate-police-form
      const { data, error } = await supabase.functions.invoke('generate-police-form', {
        body: {
          bookingId: booking.id
        }
      });

      if (error) {
        console.error('❌ [UnifiedDocumentService] Erreur génération police:', error);
        throw new Error(`Erreur lors de la génération des fiches de police: ${error.message}`);
      }

      if (!data?.success || !data?.policeUrl) {
        console.error('❌ [UnifiedDocumentService] Pas de policeUrl dans la réponse:', data);
        throw new Error('Aucune URL de fiche de police retournée par l\'Edge Function');
      }

      const policeUrl = data.policeUrl;
      
      console.log('✅ [UnifiedDocumentService] Fiche de police générée:', {
        url: policeUrl,
        guestsCount: data.guestsCount,
        hasGuestSignature: data.hasGuestSignature,
        processingTime: data.processingTime
      });

      // ✅ NOUVEAU: Ne pas télécharger automatiquement, juste retourner l'URL
      // L'utilisateur pourra cliquer sur "Voir" ou "Télécharger" dans le dashboard
      console.log('✅ [UnifiedDocumentService] Fiche de police disponible (pas de téléchargement auto)');
      
      return policeUrl;

    } catch (error) {
      console.error('❌ [UnifiedDocumentService] Erreur dans downloadPoliceFormsForAllGuests:', error);
      throw error;
    }
  }
}