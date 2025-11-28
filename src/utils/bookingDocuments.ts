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

