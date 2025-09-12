/**
 * Service API unifié pour coordonner le frontend avec les edge functions
 * Centralise tous les appels aux edge functions avec gestion d'erreurs cohérente
 */

import { supabase } from '@/integrations/supabase/client';

// Types pour les réponses API
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface GuestLinkResponse {
  success: boolean;
  propertyId: string;
  bookingId: string | null;
  token: string;
  property: any;
  booking?: any;
}

export interface GuestInfoParams {
  propertyId: string;
  token: string;
  bookingData: {
    checkInDate: string;
    checkOutDate: string;
    numberOfGuests: number;
  };
  guestData: {
    guests: Array<{
      fullName: string;
      dateOfBirth?: string;
      nationality?: string;
      documentNumber?: string;
      documentType?: string;
      profession?: string;
      motifSejour?: string;
      adressePersonnelle?: string;
      email?: string;
    }>;
    documentUrls?: string[];
  };
}

export interface ContractSignatureParams {
  bookingId: string;
  signerName: string;
  signerEmail?: string | null;
  signerPhone?: string | null;
  signatureDataUrl: string;
}

export class ApiService {
  /**
   * Résoudre un lien invité avec gestion d'erreurs robuste
   */
  static async resolveGuestLink(params: {
    propertyId?: string;
    token?: string;
    airbnbCode?: string;
  }): Promise<GuestLinkResponse> {
    try {
      console.log('🔍 ApiService.resolveGuestLink called with:', params);

      const { data, error } = await supabase.functions.invoke('resolve-guest-link', {
        body: {
          propertyId: params.propertyId,
          token: params.token,
          airbnbCode: params.airbnbCode
        }
      });

      if (error) {
        console.error('❌ resolve-guest-link error:', error);
        throw new Error(error.message || 'Erreur lors de la résolution du lien invité');
      }

      if (!data || !data.success) {
        throw new Error('Réponse invalide de resolve-guest-link');
      }

      console.log('✅ resolve-guest-link success:', data);
      return data as GuestLinkResponse;

    } catch (error) {
      console.error('❌ ApiService.resolveGuestLink error:', error);
      
      // Fallback: essayer de récupérer les données directement
      if (params.propertyId) {
        console.log('🔄 Tentative de fallback avec propertyId:', params.propertyId);
        return await this.fallbackResolveGuestLink(params.propertyId, params.token);
      }
      
      throw error;
    }
  }

  /**
   * Fallback pour resolveGuestLink en cas d'échec de l'edge function
   */
  private static async fallbackResolveGuestLink(
    propertyId: string, 
    token?: string
  ): Promise<GuestLinkResponse> {
    try {
      console.log('🔄 Fallback: récupération directe des données...');

      const { data: property, error: propertyError } = await supabase
        .from('properties')
        .select('id, name, address, contract_template, contact_info, house_rules')
        .eq('id', propertyId)
        .single();

      if (propertyError) {
        throw new Error(`Propriété non trouvée: ${propertyError.message}`);
      }

      // Rechercher une réservation récente
      const { data: bookings } = await supabase
        .from('bookings')
        .select('*')
        .eq('property_id', propertyId)
        .in('status', ['active', 'pending', 'confirmed'])
        .order('created_at', { ascending: false })
        .limit(1);

      const booking = bookings?.[0] || null;

      const fallbackResponse: GuestLinkResponse = {
        success: true,
        propertyId: propertyId,
        bookingId: booking?.id || null,
        token: token || '',
        property: property,
        booking: booking
      };

      console.log('✅ Fallback réussi:', fallbackResponse);
      return fallbackResponse;

    } catch (error) {
      console.error('❌ Fallback échoué:', error);
      throw new Error(`Fallback échoué: ${error instanceof Error ? error.message : 'Erreur inconnue'}`);
    }
  }

  /**
   * Soumettre les informations d'un invité
   */
  static async submitGuestInfo(params: GuestInfoParams): Promise<ApiResponse> {
    try {
      console.log('📝 ApiService.submitGuestInfo called');

      const { data, error } = await supabase.functions.invoke('submit-guest-info', {
        body: params
      });

      if (error) {
        console.error('❌ submit-guest-info error:', error);
        throw new Error(error.message || 'Erreur lors de la soumission des informations invité');
      }

      console.log('✅ submit-guest-info success:', data);
      return data as ApiResponse;

    } catch (error) {
      console.error('❌ ApiService.submitGuestInfo error:', error);
      throw error;
    }
  }

  /**
   * Sauvegarder une signature de contrat
   */
  static async saveContractSignature(params: ContractSignatureParams): Promise<ApiResponse> {
    try {
      console.log('✍️ ApiService.saveContractSignature called');

      const { data, error } = await supabase.functions.invoke('save-contract-signature', {
        body: params
      });

      if (error) {
        console.error('❌ save-contract-signature error:', error);
        throw new Error(error.message || 'Erreur lors de la sauvegarde de la signature');
      }

      console.log('✅ save-contract-signature success:', data);
      return data as ApiResponse;

    } catch (error) {
      console.error('❌ ApiService.saveContractSignature error:', error);
      throw error;
    }
  }

  /**
   * Synchroniser les documents
   */
  static async syncDocuments(bookingId: string, documentType: string = 'all'): Promise<ApiResponse> {
    try {
      console.log('🔄 ApiService.syncDocuments called for booking:', bookingId);

      const { data, error } = await supabase.functions.invoke('sync-documents', {
        body: {
          bookingId: bookingId,
          documentType: documentType
        }
      });

      if (error) {
        console.error('❌ sync-documents error:', error);
        throw new Error(error.message || 'Erreur lors de la synchronisation des documents');
      }

      console.log('✅ sync-documents success:', data);
      return data as ApiResponse;

    } catch (error) {
      console.error('❌ ApiService.syncDocuments error:', error);
      throw error;
    }
  }

  /**
   * Générer des documents (contrat et fiches de police)
   */
  static async generateDocuments(bookingId: string): Promise<ApiResponse> {
    try {
      console.log('📄 ApiService.generateDocuments called for booking:', bookingId);

      // Générer le contrat
      const { data: contractData, error: contractError } = await supabase.functions.invoke('generate-contract', {
        body: {
          bookingId: bookingId,
          action: 'generate'
        }
      });

      if (contractError) {
        console.error('❌ generate-contract error:', contractError);
        throw new Error(contractError.message || 'Erreur lors de la génération du contrat');
      }

      console.log('✅ generate-contract success:', contractData);

      // Générer les fiches de police
      const { data: policeData, error: policeError } = await supabase.functions.invoke('generate-police-forms', {
        body: {
          bookingId: bookingId
        }
      });

      if (policeError) {
        console.error('❌ generate-police-forms error:', policeError);
        throw new Error(policeError.message || 'Erreur lors de la génération des fiches de police');
      }

      console.log('✅ generate-police-forms success:', policeData);

      // Retourner les deux résultats
      return {
        success: true,
        contract: contractData,
        police: policeData,
        message: 'Documents générés avec succès'
      } as ApiResponse;

    } catch (error) {
      console.error('❌ ApiService.generateDocuments error:', error);
      throw error;
    }
  }

  /**
   * Obtenir un résumé de vérification de réservation
   */
  static async getBookingVerificationSummary(bookingId: string): Promise<ApiResponse> {
    try {
      console.log('📊 ApiService.getBookingVerificationSummary called for booking:', bookingId);

      const { data, error } = await supabase.functions.invoke('get-booking-verification-summary', {
        body: {
          bookingId: bookingId
        }
      });

      if (error) {
        console.error('❌ get-booking-verification-summary error:', error);
        throw new Error(error.message || 'Erreur lors de la récupération du résumé');
      }

      console.log('✅ get-booking-verification-summary success:', data);
      return data as ApiResponse;

    } catch (error) {
      console.error('❌ ApiService.getBookingVerificationSummary error:', error);
      throw error;
    }
  }

  /**
   * Méthode utilitaire pour tester la connectivité
   */
  static async testConnectivity(): Promise<boolean> {
    try {
      const { data, error } = await supabase
        .from('properties')
        .select('count')
        .limit(1);

      if (error) {
        console.error('❌ Test de connectivité échoué:', error);
        return false;
      }

      console.log('✅ Test de connectivité réussi');
      return true;
    } catch (error) {
      console.error('❌ Test de connectivité échoué:', error);
      return false;
    }
  }
}
