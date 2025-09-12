/**
 * Helpers pour standardiser les réponses des Edge Functions
 * Assure la rétrocompatibilité avec les anciens formats
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
 * Crée une réponse de succès standardisée
 */
export function createSuccessResponse<T>(
  data: T,
  options: {
    documentUrl?: string;
    documentUrls?: string[];
    documents?: Array<{ url: string; type?: string }>;
    signed?: boolean;
    message?: string;
  } = {}
): StandardResponse<T> {
  return {
    success: true,
    data,
    // Champs de rétrocompatibilité
    documentUrl: options.documentUrl,
    documentUrls: options.documentUrls,
    documents: options.documents,
    signed: options.signed,
    message: options.message
  };
}

/**
 * Crée une réponse d'erreur standardisée
 */
export function createErrorResponse(
  code: ErrorCode,
  message: string,
  details?: any
): StandardResponse {
  return {
    success: false,
    error: {
      code,
      message,
      details
    }
  };
}

/**
 * Crée une réponse de contrat standardisée
 */
export function createContractResponse(
  documentUrl: string,
  options: {
    documentId?: string;
    signed?: boolean;
    signedAt?: string;
    signerName?: string;
  } = {}
): StandardResponse<ContractResponseData> {
  const data: ContractResponseData = {
    documentUrl,
    documentId: options.documentId,
    signed: options.signed || false,
    signedAt: options.signedAt,
    signerName: options.signerName
  };

  return createSuccessResponse(data, {
    documentUrl,
    signed: options.signed
  });
}

/**
 * Crée une réponse de fiches de police standardisée
 */
export function createPoliceFormsResponse(
  documentUrl: string,
  guestCount: number,
  options: {
    documentId?: string;
  } = {}
): StandardResponse<PoliceFormsResponseData> {
  const data: PoliceFormsResponseData = {
    documentUrl,
    documentId: options.documentId,
    guestCount
  };

  return createSuccessResponse(data, {
    documentUrl,
    documentUrls: [documentUrl]
  });
}

/**
 * Crée une réponse de lien invité standardisée
 */
export function createGuestLinkResponse(
  propertyId: string,
  token: string,
  property: any,
  options: {
    bookingId?: string;
    booking?: any;
  } = {}
): StandardResponse<GuestLinkResponseData> {
  const data: GuestLinkResponseData = {
    propertyId,
    bookingId: options.bookingId,
    token,
    property,
    booking: options.booking
  };

  return createSuccessResponse(data);
}

/**
 * Wrapper pour gérer les erreurs dans les Edge Functions
 */
export function handleEdgeFunctionError(error: any): StandardResponse {
  console.error('Edge Function Error:', error);

  // Si c'est déjà une erreur standardisée
  if (error && typeof error === 'object' && error.code && error.message) {
    return createErrorResponse(error.code as ErrorCode, error.message, error.details);
  }

  // Si c'est une erreur de validation
  if (error && error.message && error.message.includes('required')) {
    return createErrorResponse(ERROR_CODES.MISSING_REQUIRED_FIELD, error.message);
  }

  // Si c'est une erreur de token
  if (error && error.message && error.message.includes('token')) {
    return createErrorResponse(ERROR_CODES.INVALID_TOKEN, error.message);
  }

  // Si c'est une erreur de booking non trouvé
  if (error && error.message && error.message.includes('booking')) {
    return createErrorResponse(ERROR_CODES.BOOKING_NOT_FOUND, error.message);
  }

  // Erreur générique
  return createErrorResponse(
    ERROR_CODES.INTERNAL_ERROR,
    error?.message || 'Une erreur inattendue s\'est produite',
    process.env.NODE_ENV === 'development' ? error : undefined
  );
}

/**
 * Valide les paramètres d'entrée pour les Edge Functions
 */
export function validateRequiredFields(data: any, requiredFields: string[]): void {
  const missingFields = requiredFields.filter(field => {
    const value = data[field];
    return value === undefined || value === null || value === '';
  });

  if (missingFields.length > 0) {
    throw new Error(`Missing required fields: ${missingFields.join(', ')}`);
  }
}

/**
 * Valide les actions pour les Edge Functions
 */
export function validateAction(action: string, allowedActions: string[]): void {
  if (action && !allowedActions.includes(action)) {
    throw new Error(`Invalid action: ${action}. Allowed actions: ${allowedActions.join(', ')}`);
  }
}

/**
 * Valide un bookingId
 */
export function validateBookingId(bookingId: any): void {
  if (!bookingId) {
    throw new Error('bookingId is required');
  }
  
  // Vérifier le format UUID
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (typeof bookingId === 'string' && !uuidRegex.test(bookingId)) {
    throw new Error('Invalid bookingId format');
  }
}

/**
 * Valide un propertyId
 */
export function validatePropertyId(propertyId: any): void {
  if (!propertyId) {
    throw new Error('propertyId is required');
  }
  
  // Vérifier le format UUID
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (typeof propertyId === 'string' && !uuidRegex.test(propertyId)) {
    throw new Error('Invalid propertyId format');
  }
}

/**
 * Valide un token
 */
export function validateToken(token: any): void {
  if (!token) {
    throw new Error('token is required');
  }
  
  if (typeof token !== 'string' || token.length < 10) {
    throw new Error('Invalid token format');
  }
}
