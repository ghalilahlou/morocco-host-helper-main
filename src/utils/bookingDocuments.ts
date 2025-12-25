import { Booking } from '@/types/booking';

type BookingLike = Partial<Booking> & {
  documentsGenerated?: Record<string, any>;
  documents_generated?: Record<string, any>;
};

const normalizeDocumentFlag = (value: any): boolean => {
  if (!value) return false;
  
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value > 0;
  if (typeof value === 'string') return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  
  if (typeof value === 'object') {
    if ('completed' in value) return Boolean(value.completed);
    if ('isSigned' in value) return Boolean((value as any).isSigned);
    if ('signed' in value) return Boolean((value as any).signed);
    if ('status' in value) {
      const status = String((value as any).status || '').toLowerCase();
      return ['generated', 'completed', 'signed', 'valid', 'validated', 'valide', 'ready'].includes(status);
    }
    if ('url' in value) return Boolean((value as any).url);
    if ('value' in value) return Boolean((value as any).value);
    if ('timestamp' in value) return Boolean((value as any).timestamp);
    
    // Si l'objet contient au moins une propriété, considérer comme vrai
    return Object.keys(value).length > 0;
  }
  
  return false;
};

export const getBookingDocumentStatus = (booking: BookingLike | any) => {
  const rawDocuments = booking?.documentsGenerated 
    ?? booking?.documents_generated 
    ?? null;
  
  const hasContract = normalizeDocumentFlag(rawDocuments?.contract);
  const policeField = rawDocuments?.policeForm 
    ?? rawDocuments?.police 
    ?? rawDocuments?.police_form 
    ?? rawDocuments?.policeForms 
    ?? rawDocuments?.police_forms;
  const hasPolice = normalizeDocumentFlag(policeField);
  
  // ✅ AMÉLIORÉ : Considérer une réservation comme validée si elle a des guests ET des documents
  const hasGuests = Array.isArray(booking?.guests) && booking.guests.length > 0;
  
  // ✅ VALIDATION STRICTE : Une réservation est validée UNIQUEMENT si :
  // 1. Elle a des guests enregistrés (avec données complètes), ET
  // 2. Elle a les documents générés (contrat + police)
  // Cela évite les faux positifs pour les réservations partiellement complétées
  const isValidated = hasGuests && hasContract && hasPolice;
  
  return {
    hasContract,
    hasPolice,
    hasGuests,
    isValidated
  };
};

export const hasValidatedDocuments = (booking: BookingLike | any) => {
  return getBookingDocumentStatus(booking).isValidated;
};

/**
 * ✅ NOUVEAU : Vérifier si une réservation a TOUS les documents requis pour apparaître dans le calendrier
 * Une réservation doit avoir :
 * 1. Status = 'completed'
 * 2. Contrat (signé de préférence)
 * 3. Police d'assurance
 * 4. Document d'identité (au moins un pour un guest)
 */
export const hasAllRequiredDocumentsForCalendar = (booking: BookingLike | any): boolean => {
  // ✅ ÉTAPE 1 : Vérifier que le statut est 'completed'
  if (booking?.status !== 'completed') {
    return false;
  }

  // ✅ ÉTAPE 2 : Vérifier les documents depuis différentes sources
  const rawDocuments = booking?.documentsGenerated 
    ?? booking?.documents_generated 
    ?? null;

  // Vérifier le contrat
  const hasContract = normalizeDocumentFlag(rawDocuments?.contract);
  
  // Vérifier la police
  const policeField = rawDocuments?.policeForm 
    ?? rawDocuments?.police 
    ?? rawDocuments?.police_form 
    ?? rawDocuments?.policeForms 
    ?? rawDocuments?.police_forms;
  const hasPolice = normalizeDocumentFlag(policeField);

  // ✅ ÉTAPE 3 : Vérifier l'identité depuis plusieurs sources
  // Source 1 : documents_generated.identity
  const hasIdentityFromGenerated = normalizeDocumentFlag(rawDocuments?.identity);
  
  // Source 2 : submissionStatus.hasDocuments (pour EnrichedBooking)
  const hasIdentityFromSubmission = booking?.submissionStatus?.hasDocuments === true;
  
  // Source 3 : guests avec document_number (au moins un guest avec document)
  const hasGuestsWithDocuments = Array.isArray(booking?.guests) && 
    booking.guests.length > 0 &&
    booking.guests.some((guest: any) => guest?.documentNumber && guest.documentNumber.trim().length > 0);

  // Source 4 : uploaded_documents ou generated_documents avec type 'identity'
  // (vérifié via has_documents dans la vue matérialisée ou submissionStatus)
  const hasIdentityFromDocuments = booking?.has_documents === true || 
    (booking?.submissionStatus?.documentsCount && booking.submissionStatus.documentsCount > 0);

  // Source 5 : hasRealSubmissions avec documents (pour EnrichedBooking)
  const hasIdentityFromRealSubmissions = booking?.hasRealSubmissions === true && 
    booking?.submissionStatus?.hasDocuments === true;

  // Source 6 : realGuestCount > 0 (indique qu'il y a des guests avec documents)
  const hasIdentityFromRealGuests = (booking?.realGuestCount && booking.realGuestCount > 0) ||
    (Array.isArray(booking?.realGuestNames) && booking.realGuestNames.length > 0);

  const hasIdentity = hasIdentityFromGenerated || 
                     hasIdentityFromSubmission || 
                     hasGuestsWithDocuments || 
                     hasIdentityFromDocuments ||
                     hasIdentityFromRealSubmissions ||
                     hasIdentityFromRealGuests;

  // ✅ ÉTAPE 4 : Tous les documents doivent être présents
  const hasAllDocuments = hasContract && hasPolice && hasIdentity;

  // ✅ NETTOYAGE LOGS : Supprimé pour éviter les boucles infinies et le crash du navigateur
  // Ce log était appelé pour chaque réservation à chaque re-render, causant des dizaines de logs
  // if (process.env.NODE_ENV === 'development' && booking?.status === 'completed') {
  //   console.log('🔍 [hasAllRequiredDocumentsForCalendar] Vérification:', ...);
  // }

  return hasAllDocuments;
};

