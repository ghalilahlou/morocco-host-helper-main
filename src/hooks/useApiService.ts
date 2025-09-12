/**
 * Hook personnalisé pour utiliser le service API unifié
 * Simplifie l'utilisation des edge functions dans les composants React
 */

import { useState, useCallback } from 'react';
import { ApiService, GuestLinkResponse, GuestInfoParams, ContractSignatureParams } from '@/services/apiService';

export interface UseApiServiceReturn {
  // État
  isLoading: boolean;
  error: string | null;
  
  // Méthodes
  resolveGuestLink: (params: { propertyId?: string; token?: string; airbnbCode?: string }) => Promise<GuestLinkResponse | null>;
  submitGuestInfo: (params: GuestInfoParams) => Promise<any>;
  saveContractSignature: (params: ContractSignatureParams) => Promise<any>;
  syncDocuments: (bookingId: string, documentType?: string) => Promise<any>;
  generateDocuments: (bookingId: string) => Promise<any>;
  getBookingVerificationSummary: (bookingId: string) => Promise<any>;
  testConnectivity: () => Promise<boolean>;
  
  // Utilitaires
  clearError: () => void;
}

export const useApiService = (): UseApiServiceReturn => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const handleApiCall = useCallback(async <T>(
    apiCall: () => Promise<T>,
    operation: string
  ): Promise<T | null> => {
    setIsLoading(true);
    setError(null);

    try {
      console.log(`🚀 ${operation} - Début`);
      const result = await apiCall();
      console.log(`✅ ${operation} - Succès`);
      return result;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : `Erreur lors de ${operation}`;
      console.error(`❌ ${operation} - Erreur:`, errorMessage);
      setError(errorMessage);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const resolveGuestLink = useCallback(async (params: {
    propertyId?: string;
    token?: string;
    airbnbCode?: string;
  }): Promise<GuestLinkResponse | null> => {
    return handleApiCall(
      () => ApiService.resolveGuestLink(params),
      'Résolution du lien invité'
    );
  }, [handleApiCall]);

  const submitGuestInfo = useCallback(async (params: GuestInfoParams): Promise<any> => {
    return handleApiCall(
      () => ApiService.submitGuestInfo(params),
      'Soumission des informations invité'
    );
  }, [handleApiCall]);

  const saveContractSignature = useCallback(async (params: ContractSignatureParams): Promise<any> => {
    return handleApiCall(
      () => ApiService.saveContractSignature(params),
      'Sauvegarde de la signature de contrat'
    );
  }, [handleApiCall]);

  const syncDocuments = useCallback(async (bookingId: string, documentType: string = 'all'): Promise<any> => {
    return handleApiCall(
      () => ApiService.syncDocuments(bookingId, documentType),
      'Synchronisation des documents'
    );
  }, [handleApiCall]);

  const generateDocuments = useCallback(async (bookingId: string): Promise<any> => {
    return handleApiCall(
      () => ApiService.generateDocuments(bookingId),
      'Génération des documents'
    );
  }, [handleApiCall]);

  const getBookingVerificationSummary = useCallback(async (bookingId: string): Promise<any> => {
    return handleApiCall(
      () => ApiService.getBookingVerificationSummary(bookingId),
      'Récupération du résumé de vérification'
    );
  }, [handleApiCall]);

  const testConnectivity = useCallback(async (): Promise<boolean> => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await ApiService.testConnectivity();
      if (!result) {
        setError('Test de connectivité échoué');
      }
      return result;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erreur de connectivité';
      setError(errorMessage);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, []);

  return {
    // État
    isLoading,
    error,
    
    // Méthodes
    resolveGuestLink,
    submitGuestInfo,
    saveContractSignature,
    syncDocuments,
    generateDocuments,
    getBookingVerificationSummary,
    testConnectivity,
    
    // Utilitaires
    clearError
  };
};
