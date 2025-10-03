/**
 * Service pour la génération de documents et upload via generate-documents Edge Function
 */

import { edgeClient, type EdgeResponse } from '../lib/edgeClient';
import { toast } from '@/hooks/use-toast';

export interface GuestInfo {
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  nationality?: string;
  idType?: string;
  idNumber?: string;
}

export interface IdDocument {
  name: string;
  url: string;
  type: string;
  file?: File;
}

export interface DocumentSignature {
  data: string; // base64
  timestamp: string;
}

export interface DocumentGenerationRequest {
  token: string;
  airbnbCode: string;
  guestInfo: GuestInfo;
  idDocuments: IdDocument[];
  signature?: DocumentSignature;
  bookingId?: string; // ID de réservation si déjà créée
}

export interface GeneratedDocuments {
  contractUrl: string;
  booking: {
    checkIn: string;
    checkOut: string;
    propertyName?: string;
    locked: boolean;
  };
  fileName: string;
  expiresAt: string;
}

/**
 * Soumettre les documents et générer le contrat
 */
export async function submitDocumentsAndSign(
  request: DocumentGenerationRequest
): Promise<GeneratedDocuments> {
  console.log('📄 [DocumentService] Submitting documents and generating contract...', {
    guestName: `${request.guestInfo.firstName} ${request.guestInfo.lastName}`,
    documentsCount: request.idDocuments.length,
    hasSignature: !!request.signature
  });

  // Validation côté client
  if (!request.token || !request.airbnbCode || !request.guestInfo) {
    throw new Error('Token, code Airbnb et informations invité sont requis');
  }

  if (!request.guestInfo.firstName || !request.guestInfo.lastName) {
    throw new Error('Le prénom et nom sont obligatoires');
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
    let booking: any;
    let bookingId: string;

    if (request.bookingId) {
      // Si un bookingId est fourni, on l'utilise directement
      console.log('✅ [DocumentService] Using provided bookingId:', request.bookingId);
      bookingId = request.bookingId;
      
      // Résoudre quand même le booking pour avoir les informations de base
      const { resolveBooking } = await import('./bookingResolve');
      booking = await resolveBooking(request.token, request.airbnbCode);
    } else {
      // Workflow original : résoudre booking puis créer via submit-guest-info
      console.log('🔍 [DocumentService] Resolving booking first...');
      const { resolveBooking } = await import('./bookingResolve');
      booking = await resolveBooking(request.token, request.airbnbCode);
      
      console.log('🔍 [DocumentService] Booking resolved:', {
        propertyId: booking.propertyId,
        airbnbCode: booking.airbnbCode,
        checkIn: booking.checkIn,
        checkOut: booking.checkOut,
        guestName: booking.guestName
      });

      // Étape 2: Sauvegarder les informations invité avec submit-guest-info
      console.log('💾 [DocumentService] Saving guest information...');
      const guestResponse = await edgeClient.post('/submit-guest-info', {
        propertyId: booking.propertyId,
        token: request.token,
        bookingData: {
          airbnbCode: booking.airbnbCode,
          checkInDate: booking.checkIn,
          checkOutDate: booking.checkOut,
          guestName: booking.guestName || `${request.guestInfo.firstName} ${request.guestInfo.lastName}`,
          propertyName: booking.propertyName || 'Propriété'
        },
        guestData: {
          guests: [{
            fullName: `${request.guestInfo.firstName} ${request.guestInfo.lastName}`,
            nationality: request.guestInfo.nationality || 'Non spécifiée',
            documentNumber: request.guestInfo.idNumber || '',
            documentType: request.guestInfo.idType || 'passport'
          }],
          documentUrls: request.idDocuments.map(doc => doc.url)
        }
      });

      if (!guestResponse.success) {
        console.error('❌ [DocumentService] Guest submission failed:', guestResponse.error);
        throw new Error(`Erreur lors de la sauvegarde: ${guestResponse.error?.message || 'Erreur inconnue'}`);
      }

      if (!guestResponse.data?.bookingId) {
        console.error('❌ [DocumentService] No bookingId in response:', guestResponse.data);
        throw new Error('Aucun ID de réservation retourné par le serveur');
      }

      bookingId = guestResponse.data.bookingId;
      console.log('✅ [DocumentService] Guest info saved, bookingId:', bookingId);
    }

    // Étape 3: Générer le contrat avec l'ID de réservation
    console.log('📄 [DocumentService] Generating contract...');
    const response: EdgeResponse<GeneratedDocuments> = await edgeClient.post('/submit-guest-info-unified', {
      bookingId: bookingId,
      action: 'generate_contract_only',
      signature: request.signature
    });

    if (!response.success) {
      const error = response.error!;
      
      // Toast d'erreur
      toast({
        title: "Erreur de génération",
        description: error.message,
        variant: "destructive",
      });
      
      // Mapper les erreurs spécifiques
      switch (error.code) {
        case 'TOKEN_REQUIRED':
        case 'AIRBNB_CODE_REQUIRED':
          throw new Error('Données de session manquantes. Veuillez recharger la page.');
        
        case 'INVALID_JSON':
          throw new Error('Erreur de format des données. Veuillez réessayer.');
        
        case 'ERR_TOKEN_INVALID':
          throw new Error('Le lien de vérification est invalide. Veuillez demander un nouveau lien.');
        
        case 'ERR_CODE_NOT_FOUND':
          throw new Error('Réservation non trouvée. Vérifiez votre code Airbnb.');
        
        case 'ERR_TOKEN_EXPIRED':
          throw new Error('Le lien de vérification a expiré. Demandez un nouveau lien au propriétaire.');
        
        default:
          throw new Error(error.message || 'Erreur lors de la génération des documents');
      }
    }

    if (!response.data) {
      throw new Error('Aucune donnée reçue du serveur');
    }

    const contractData = response.data;
    
    // Validation des données reçues
    if (!contractData.documentUrl) {
      throw new Error('URL du contrat manquante dans la réponse du serveur');
    }

    // Adapter la réponse au format attendu par l'interface
    const documents: GeneratedDocuments = {
      contractUrl: contractData.documentUrl,
      booking: {
        checkIn: booking.checkIn,
        checkOut: booking.checkOut,
        propertyName: booking.propertyName,
        locked: true // Les dates ICS sont toujours verrouillées
      },
      fileName: `contrat_${booking.airbnbCode}_${Date.now()}.pdf`,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() // 24h
    };

    // Toast de succès
    toast({
      title: "Contrat généré avec succès",
      description: `Votre contrat est prêt pour téléchargement`,
    });

    console.log('✅ [DocumentService] Contract generated successfully:', {
      fileName: documents.fileName,
      hasContractUrl: !!documents.contractUrl,
      expiresAt: documents.expiresAt,
      bookingLocked: documents.booking.locked
    });

    return documents;

  } catch (error) {
    console.error('❌ [DocumentService] Error generating documents:', error);
    
    // Toast d'erreur si pas déjà affiché
    if (error instanceof Error && !error.message.includes('Token')) {
      toast({
        title: "Erreur inattendue",
        description: error.message,
        variant: "destructive",
      });
    }
    
    // Re-throw avec message approprié
    if (error instanceof Error) {
      throw error;
    }
    
    throw new Error('Erreur de réseau lors de la génération des documents. Veuillez réessayer.');
  }
}

/**
 * Valider les informations invité
 */
export function validateGuestInfo(guestInfo: Partial<GuestInfo>): string[] {
  const errors: string[] = [];
  
  if (!guestInfo.firstName?.trim()) {
    errors.push('Le prénom est obligatoire');
  }
  
  if (!guestInfo.lastName?.trim()) {
    errors.push('Le nom est obligatoire');
  }
  
  if (guestInfo.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(guestInfo.email)) {
    errors.push('Format d\'email invalide');
  }
  
  if (guestInfo.phone && !/^[\d\s\-\+\(\)]+$/.test(guestInfo.phone)) {
    errors.push('Format de téléphone invalide');
  }
  
  return errors;
}

/**
 * Valider les documents d'identité
 */
export function validateIdDocuments(documents: IdDocument[]): string[] {
  const errors: string[] = [];
  
  if (!documents || documents.length === 0) {
    errors.push('Au moins une pièce d\'identité est requise');
    return errors;
  }
  
  documents.forEach((doc, index) => {
    if (!doc.name?.trim()) {
      errors.push(`Document ${index + 1}: nom requis`);
    }
    
    if (!doc.url?.trim()) {
      errors.push(`Document ${index + 1}: URL requise`);
    }
    
    if (!doc.type?.trim()) {
      errors.push(`Document ${index + 1}: type requis`);
    }
  });
  
  return errors;
}

/**
 * Préparer les données de signature
 */
export function prepareSignature(signatureDataUrl: string): DocumentSignature {
  return {
    data: signatureDataUrl,
    timestamp: new Date().toISOString()
  };
}

/**
 * Télécharger un contrat depuis son URL signée
 */
export async function downloadContract(contractUrl: string, fileName: string): Promise<void> {
  try {
    console.log('📥 [DocumentService] Downloading contract...');
    
    const response = await fetch(contractUrl);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const blob = await response.blob();
    
    // Créer un lien de téléchargement
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName || 'contrat.pdf';
    
    // Déclencher le téléchargement
    document.body.appendChild(link);
    link.click();
    
    // Nettoyer
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
    
    toast({
      title: "Téléchargement terminé",
      description: "Votre contrat a été téléchargé avec succès",
    });
    
    console.log('✅ [DocumentService] Contract downloaded successfully');
    
  } catch (error) {
    console.error('❌ [DocumentService] Error downloading contract:', error);
    
    toast({
      title: "Erreur de téléchargement",
      description: "Impossible de télécharger le contrat. Veuillez réessayer.",
      variant: "destructive",
    });
    
    throw new Error('Erreur lors du téléchargement du contrat');
  }
}
