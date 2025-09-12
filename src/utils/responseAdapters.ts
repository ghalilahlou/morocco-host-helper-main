/**
 * Adapters pour gérer la rétrocompatibilité des réponses API
 * Permet de normaliser les réponses des edge functions
 */

// Types pour les réponses standardisées
export interface StandardResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  // Champs de rétrocompatibilité
  documentUrl?: string;
  documentUrls?: string[];
  documents?: Array<{ url: string; type?: string }>;
  signed?: boolean;
  message?: string;
}

export interface ContractResponseData {
  documentUrl: string;
  documentId?: string;
  signed: boolean;
  signedAt?: string;
  signerName?: string;
}

export interface PoliceFormsResponseData {
  documentUrl: string;
  documentId?: string;
  guestCount: number;
}

export interface GuestLinkResponseData {
  propertyId: string;
  bookingId?: string;
  token: string;
  property: any;
  booking?: any;
}

// Codes d'erreur standardisés
export const ERROR_CODES = {
  INVALID_INPUT: 'INVALID_INPUT',
  INVALID_ACTION: 'INVALID_ACTION',
  NOT_FOUND: 'NOT_FOUND',
  UNAUTHORIZED: 'UNAUTHORIZED',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  MISSING_REQUIRED_FIELD: 'MISSING_REQUIRED_FIELD',
  INVALID_TOKEN: 'INVALID_TOKEN',
  BOOKING_NOT_FOUND: 'BOOKING_NOT_FOUND',
  PROPERTY_NOT_FOUND: 'PROPERTY_NOT_FOUND',
  NO_GUESTS_FOUND: 'NO_GUESTS_FOUND',
  INCOMPLETE_GUEST_DATA: 'INCOMPLETE_GUEST_DATA'
} as const;

export type ErrorCode = typeof ERROR_CODES[keyof typeof ERROR_CODES];

/**
 * Normalise une réponse de contrat pour assurer la rétrocompatibilité
 */
export function normalizeContractResponse(response: any): {
  url: string | null;
  signed: boolean;
  documentId?: string;
  signedAt?: string;
  signerName?: string;
} {
  // Priorité: nouveau format data.documentUrl
  const url = response.data?.documentUrl 
    || response.documentUrl 
    || response.documentUrls?.[0] 
    || response.documents?.[0]?.url
    || null;

  const signed = response.data?.signed 
    ?? response.signed 
    ?? false;

  const documentId = response.data?.documentId 
    || response.documentId;

  const signedAt = response.data?.signedAt 
    || response.signedAt;

  const signerName = response.data?.signerName 
    || response.signerName;

  return {
    url,
    signed,
    documentId,
    signedAt,
    signerName
  };
}

/**
 * Normalise une réponse de fiches de police pour assurer la rétrocompatibilité
 */
export function normalizePoliceFormsResponse(response: any): {
  urls: string[];
  guestCount: number;
  documentId?: string;
} {
  // Priorité: nouveau format data.documentUrl
  const primaryUrl = response.data?.documentUrl || response.documentUrl;
  
  // Fallback: anciens formats
  const fallbackUrls = response.documentUrls || 
    (response.documents ? response.documents.map((doc: any) => doc.url) : []) ||
    [];

  const urls = primaryUrl ? [primaryUrl, ...fallbackUrls] : fallbackUrls;
  
  const guestCount = response.data?.guestCount || response.guestCount || urls.length;
  
  const documentId = response.data?.documentId || response.documentId;

  return {
    urls: [...new Set(urls)], // Supprimer les doublons
    guestCount,
    documentId
  };
}

/**
 * Normalise une réponse de lien invité pour assurer la rétrocompatibilité
 */
export function normalizeGuestLinkResponse(response: any): {
  propertyId: string | null;
  bookingId: string | null;
  token: string | null;
  property: any;
  booking: any;
} {
  const propertyId = response.data?.propertyId 
    || response.propertyId 
    || response.id 
    || response.tokenId 
    || null;

  const bookingId = response.data?.bookingId 
    || response.bookingId 
    || null;

  const token = response.data?.token 
    || response.token 
    || null;

  const property = response.data?.property 
    || response.property 
    || null;

  const booking = response.data?.booking 
    || response.booking 
    || null;

  return {
    propertyId,
    bookingId,
    token,
    property,
    booking
  };
}

/**
 * Normalise une réponse d'erreur pour assurer la rétrocompatibilité
 */
export function normalizeErrorResponse(response: any): {
  code: string;
  message: string;
  details?: any;
} {
  // Nouveau format standardisé
  if (response.error && typeof response.error === 'object') {
    return {
      code: response.error.code || 'UNKNOWN_ERROR',
      message: response.error.message || 'Une erreur inconnue s\'est produite',
      details: response.error.details
    };
  }

  // Ancien format (string simple)
  if (typeof response.error === 'string') {
    return {
      code: 'LEGACY_ERROR',
      message: response.error
    };
  }

  // Format avec message direct
  if (response.message) {
    return {
      code: 'LEGACY_ERROR',
      message: response.message
    };
  }

  // Erreur générique
  return {
    code: 'UNKNOWN_ERROR',
    message: 'Une erreur inconnue s\'est produite'
  };
}

/**
 * Vérifie si une réponse est un succès
 */
export function isSuccessResponse(response: any): boolean {
  return response.success === true || 
         (response.success !== false && !response.error && !response.message?.includes('error'));
}

/**
 * Vérifie si une réponse est une erreur
 */
export function isErrorResponse(response: any): boolean {
  return response.success === false || 
         !!response.error || 
         (response.message && response.message.toLowerCase().includes('error'));
}

/**
 * Extrait le message d'erreur d'une réponse
 */
export function getErrorMessage(response: any): string {
  if (isErrorResponse(response)) {
    const normalized = normalizeErrorResponse(response);
    return normalized.message;
  }
  return '';
}

/**
 * Extrait le code d'erreur d'une réponse
 */
export function getErrorCode(response: any): string {
  if (isErrorResponse(response)) {
    const normalized = normalizeErrorResponse(response);
    return normalized.code;
  }
  return '';
}

/**
 * Wrapper pour les appels API avec gestion d'erreurs standardisée
 */
export async function callEdgeFunctionWithAdapter<T>(
  edgeFunction: any,
  functionName: string,
  body: any,
  adapter: (response: any) => T
): Promise<{
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
}> {
  try {
    console.log(`🔍 Calling ${functionName} with:`, body);
    
    const { data, error } = await edgeFunction.invoke(functionName, { body });
    
    console.log(`🔍 ${functionName} response:`, { data, error });
    
    if (error) {
      const normalizedError = normalizeErrorResponse({ error: error.message });
      return {
        success: false,
        error: normalizedError
      };
    }
    
    if (isErrorResponse(data)) {
      const normalizedError = normalizeErrorResponse(data);
      return {
        success: false,
        error: normalizedError
      };
    }
    
    const adaptedData = adapter(data);
    return {
      success: true,
      data: adaptedData
    };
    
  } catch (err: any) {
    console.error(`❌ ${functionName} error:`, err);
    return {
      success: false,
      error: {
        code: 'NETWORK_ERROR',
        message: err.message || 'Erreur de réseau'
      }
    };
  }
}

/**
 * Adapter spécifique pour les contrats
 */
export const contractAdapter = (response: any) => normalizeContractResponse(response);

/**
 * Adapter spécifique pour les fiches de police
 */
export const policeFormsAdapter = (response: any) => normalizePoliceFormsResponse(response);

/**
 * Adapter spécifique pour les liens invités
 */
export const guestLinkAdapter = (response: any) => normalizeGuestLinkResponse(response);

/**
 * Utilitaires pour les messages d'erreur utilisateur
 */
export const ERROR_MESSAGES = {
  [ERROR_CODES.INVALID_INPUT]: 'Données d\'entrée invalides',
  [ERROR_CODES.INVALID_ACTION]: 'Action non autorisée',
  [ERROR_CODES.NOT_FOUND]: 'Ressource non trouvée',
  [ERROR_CODES.UNAUTHORIZED]: 'Accès non autorisé',
  [ERROR_CODES.VALIDATION_ERROR]: 'Erreur de validation',
  [ERROR_CODES.INTERNAL_ERROR]: 'Erreur interne du serveur',
  [ERROR_CODES.MISSING_REQUIRED_FIELD]: 'Champ requis manquant',
  [ERROR_CODES.INVALID_TOKEN]: 'Token invalide ou expiré',
  [ERROR_CODES.BOOKING_NOT_FOUND]: 'Réservation non trouvée',
  [ERROR_CODES.PROPERTY_NOT_FOUND]: 'Propriété non trouvée',
  [ERROR_CODES.NO_GUESTS_FOUND]: 'Aucun invité trouvé',
  [ERROR_CODES.INCOMPLETE_GUEST_DATA]: 'Données d\'invité incomplètes'
} as const;

/**
 * Obtient un message d'erreur convivial pour l'utilisateur
 */
export function getUserFriendlyErrorMessage(errorCode: string, fallbackMessage?: string): string {
  return ERROR_MESSAGES[errorCode as ErrorCode] || fallbackMessage || 'Une erreur inattendue s\'est produite';
}
