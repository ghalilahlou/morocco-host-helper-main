/**
 * Service Unifié pour la Génération de Documents
 * VERSION OPTIMISÉE - Un seul appel pour tout faire
 */

import { toast } from '@/hooks/use-toast';
import { edgeClient } from '@/lib/edgeClient';

// Types
export interface GuestInfo {
  firstName: string;
  lastName: string;
  email: string; // ✅ REQUIS : Email obligatoire
  phone?: string;
  nationality?: string;
  idType?: string;
  idNumber?: string;
  dateOfBirth?: string;
  documentIssueDate?: string;
  profession?: string;
  motifSejour?: string;
  adressePersonnelle?: string;
}

export interface IdDocument {
  name: string;
  url: string;
  type: string;
  file?: File;
}

export interface DocumentGenerationRequest {
  token: string;
  airbnbCode: string;
  guestInfo: GuestInfo;
  /** Tous les voyageurs (même ordre que les pièces d’identité). Si absent, seul guestInfo est utilisé. */
  guests?: GuestInfo[];
  idDocuments: IdDocument[];
  bookingData?: {
    checkIn: string;
    checkOut: string;
    numberOfGuests: number;
  };
  signature?: {
    data: string;
    timestamp: string;
  };
}

export interface GeneratedDocuments {
  bookingId: string;
  contractUrl: string;
  policeUrl?: string;
  documentUrl: string; // Alias pour contractUrl (compatibilité)
  booking: {
    propertyId: string;
    airbnbCode: string;
    checkIn: string;
    checkOut: string;
    propertyName: string;
    locked: boolean;
  };
  expiresAt: string;
}

// ✅ CORRIGÉ : Garde par réservation au lieu d'un garde global
// Permet à un guest de remplir plusieurs réservations en parallèle
const runningWorkflows = new Map<string, boolean>();

/**
 * NOUVELLE FONCTION UNIFIÉE - Un seul appel pour tout faire
 * Remplace submitDocumentsAndSign() avec une logique simplifiée
 */
export async function submitDocumentsUnified(
  request: DocumentGenerationRequest
): Promise<GeneratedDocuments> {
  
  // ✅ CRITIQUE : Générer une clé unique pour cette réservation spécifique
  const workflowKey = `${request.token}-${request.airbnbCode}`;
  const requestId = `${workflowKey}-${Date.now()}`;
  
  // ✅ CRITIQUE : Vérifier si un workflow est déjà en cours POUR CETTE RÉSERVATION
  if (runningWorkflows.get(workflowKey)) {
    console.warn('⚠️ [DocumentServiceUnified] Workflow déjà en cours pour cette réservation', {
      workflowKey,
      requestId
    });
    throw new Error('Cette réservation est déjà en cours de traitement. Veuillez patienter.');
  }
  
  // ✅ CRITIQUE : Marquer cette réservation comme en cours
  runningWorkflows.set(workflowKey, true);
  
  console.log('🚀 [DocumentServiceUnified] Starting unified submission...', {
    workflowKey,
    requestId,
    timestamp: new Date().toISOString()
  });
  console.log('📋 [DocumentServiceUnified] Request:', {
    guestName: `${request.guestInfo.firstName} ${request.guestInfo.lastName}`,
    documentsCount: request.idDocuments.length,
    hasSignature: !!request.signature,
    airbnbCode: request.airbnbCode
  });

  const allGuests =
    request.guests && request.guests.length > 0 ? request.guests : [request.guestInfo];

  // Validation côté client
  if (!request.token || !request.airbnbCode || !request.guestInfo) {
    throw new Error('Token, code Airbnb et informations invité sont requis');
  }

  for (let i = 0; i < allGuests.length; i++) {
    const g = allGuests[i];
    if (!g.firstName || !g.lastName) {
      throw new Error(`Le prénom et nom sont obligatoires (voyageur ${i + 1})`);
    }
    if (!g.email?.trim()) {
      throw new Error(`Email requis pour le voyageur ${i + 1}`);
    }
  }

  if (!request.idDocuments || request.idDocuments.length === 0) {
    throw new Error('Au moins une pièce d\'identité doit être fournie');
  }

  // Afficher toast de progression
  toast({
    title: "Génération en cours...",
    description: "Traitement de vos documents et génération du contrat",
  });

  try {
    // ✨ UN SEUL APPEL à la fonction unifiée
    console.log('📤 [DocumentServiceUnified] Calling unified function...');
    
    const response = await edgeClient.post('/submit-guest-info-unified', {
      token: request.token,
      airbnbCode: request.airbnbCode,
      guestInfo: request.guestInfo,
      guests: allGuests,
      idDocuments: request.idDocuments,
      bookingData: request.bookingData,
      signature: request.signature
    });

    if (!response.success) {
      console.error('❌ [DocumentServiceUnified] Unified function failed:', response.error);
      // ✅ AMÉLIORATION : Afficher les détails de l'erreur si disponibles
      const errorDetails = response.data?.details || [];
      const errorMessage = typeof response.error === 'string' 
        ? response.error 
        : (response.error?.message || 'Génération des documents échouée');
      
      if (errorDetails.length > 0) {
        console.error('📋 Détails des erreurs:', errorDetails);
        throw new Error(`${errorMessage}. Détails : ${errorDetails.join(', ')}`);
      }
      
      throw new Error(errorMessage);
    }

    console.log('✅ [DocumentServiceUnified] All documents generated successfully');
    console.log('📋 [DocumentServiceUnified] Full response:', response);
    console.log('📋 [DocumentServiceUnified] Response data:', {
      hasBookingId: !!response.data?.bookingId,
      hasContractUrl: !!response.data?.contractUrl,
      hasPoliceUrl: !!response.data?.policeUrl,
      propertyName: response.data?.booking?.propertyName,
      bookingId: response.data?.bookingId
    });

    // Toast de succès
    toast({
      title: "Documents générés avec succès !",
      description: "Contrat et fiche de police créés. Email envoyé.",
    });
    
    // ✅ CORRECTION : Vérifier que response.data existe
    if (!response.data) {
      console.error('❌ [DocumentServiceUnified] No data in response:', response);
      throw new Error('Aucune donnée reçue du serveur');
    }

    if (!response.data.bookingId) {
      console.error('❌ [DocumentServiceUnified] No bookingId in response data:', response.data);
      throw new Error('ID de réservation manquant dans la réponse');
    }

    const result = {
      bookingId: response.data.bookingId,
      contractUrl: response.data.contractUrl,
      policeUrl: response.data.policeUrl,
      documentUrl: response.data.contractUrl, // Compatibilité
      booking: response.data.booking,
      expiresAt: response.data.expiresAt
    };
    
    // ✅ CRITIQUE : Log de confirmation d'exécution unique
    console.log('✅ [DocumentServiceUnified] Unified workflow triggered once only', {
      requestId,
      bookingId: result.bookingId,
      timestamp: new Date().toISOString()
    });
    
    return result;

  } catch (error) {
    console.error('❌ [DocumentServiceUnified] Error:', error);
    
    // Toast d'erreur
    toast({
      title: "Erreur de génération",
      description: error instanceof Error ? error.message : 'Erreur inconnue',
      variant: "destructive"
    });
    
    throw error;
  } finally {
    // ✅ CRITIQUE : Toujours supprimer la clé de la Map, même en cas d'erreur
    runningWorkflows.delete(workflowKey);
    console.log('🔄 [DocumentServiceUnified] Workflow flag reset', {
      workflowKey,
      requestId,
      timestamp: new Date().toISOString()
    });
  }
}

/**
 * Fonction pour sauvegarder uniquement la signature
 * (Appelée séparément après la génération)
 */
export async function saveContractSignature(
  bookingId: string,
  signatureData: {
    signerName: string;
    signerEmail?: string;
    signerPhone?: string;
    signatureDataUrl: string;
  }
): Promise<void> {
  
  console.log('✍️ [DocumentServiceUnified] Saving signature...');
  console.log('✍️ [DocumentServiceUnified] BookingId:', bookingId);
  console.log('✍️ [DocumentServiceUnified] Signer:', signatureData.signerName);

  try {
    const response = await edgeClient.post('/save-contract-signature', {
      bookingId: bookingId,
      signerName: signatureData.signerName,
      signerEmail: signatureData.signerEmail,
      signerPhone: signatureData.signerPhone,
      signatureDataUrl: signatureData.signatureDataUrl
    });

    if (!response.success) {
      console.error('❌ [DocumentServiceUnified] Signature save failed:', response.error);
      throw new Error(response.error?.message || 'Erreur lors de la sauvegarde de la signature');
    }

    console.log('✅ [DocumentServiceUnified] Signature saved successfully');
    
    toast({
      title: "Signature sauvegardée",
      description: "Contrat signé avec succès",
    });

  } catch (error) {
    console.error('❌ [DocumentServiceUnified] Signature save error:', error);
    
    toast({
      title: "Erreur de signature",
      description: error instanceof Error ? error.message : 'Erreur inconnue',
      variant: "destructive"
    });
    
    throw error;
  }
}

/**
 * Fonction pour télécharger le contrat généré
 */
export async function downloadContract(contractUrl: string, fileName?: string): Promise<void> {
  console.log('📥 [DocumentServiceUnified] Downloading contract...');
  
  try {
    const response = await fetch(contractUrl);
    if (!response.ok) {
      throw new Error('Erreur lors du téléchargement');
    }

    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName || `contrat_${Date.now()}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);

    console.log('✅ [DocumentServiceUnified] Contract downloaded successfully');
    
    toast({
      title: "Téléchargement réussi",
      description: "Le contrat a été téléchargé",
    });

  } catch (error) {
    console.error('❌ [DocumentServiceUnified] Download error:', error);
    
    toast({
      title: "Erreur de téléchargement",
      description: error instanceof Error ? error.message : 'Erreur inconnue',
      variant: "destructive"
    });
    
    throw error;
  }
}

// Fonctions de validation (réutilisées)
export function validateGuestInfo(guestInfo: GuestInfo): string[] {
  const errors: string[] = [];

  if (!guestInfo.firstName?.trim()) {
    errors.push('Le prénom est requis');
  }

  if (!guestInfo.lastName?.trim()) {
    errors.push('Le nom est requis');
  }

  if (!guestInfo.email?.trim()) {
    errors.push('L\'email est requis');
  } else {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(guestInfo.email)) {
      errors.push('Format d\'email invalide');
    }
  }

  return errors;
}

export function validateIdDocuments(idDocuments: IdDocument[]): string[] {
  const errors: string[] = [];

  if (!idDocuments || idDocuments.length === 0) {
    errors.push('Au moins une pièce d\'identité est requise');
  }

  idDocuments.forEach((doc, index) => {
    if (!doc.name?.trim()) {
      errors.push(`Le nom du document ${index + 1} est requis`);
    }
    if (!doc.url?.trim()) {
      errors.push(`L'URL du document ${index + 1} est requise`);
    }
  });

  return errors;
}
