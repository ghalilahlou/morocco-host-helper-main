/**
 * Service pour résoudre les réservations Airbnb via booking-resolve Edge Function
 */

import { edgeClient, type EdgeResponse } from '../lib/edgeClient';

export interface ResolvedBooking {
  propertyId: string;
  airbnbCode: string;
  checkIn: string; // YYYY-MM-DD
  checkOut: string; // YYYY-MM-DD
  guestName?: string;
  propertyName?: string;
}

export interface BookingResolveError {
  code: 'ERR_TOKEN_INVALID' | 'ERR_CODE_NOT_FOUND' | 'ERR_TOKEN_EXPIRED' | 'INVALID_JSON' | 'TOKEN_REQUIRED' | 'AIRBNB_CODE_REQUIRED' | 'DATABASE_ERROR' | 'INTERNAL_ERROR' | string;
  message: string;
  details?: any;
}

/**
 * Résoudre une réservation Airbnb à partir d'un token et code
 */
export async function resolveBooking(
  token: string, 
  airbnbCode: string
): Promise<ResolvedBooking> {
  console.log('🔍 [BookingResolve] Resolving booking...', { 
    token: token.substring(0, 8) + '...', 
    airbnbCode: airbnbCode.substring(0, 2) + '***'
  });

  // Validation côté client
  if (!token || typeof token !== 'string') {
    throw new Error('Token is required and must be a string');
  }

  if (!airbnbCode || typeof airbnbCode !== 'string') {
    throw new Error('Airbnb code is required and must be a string');
  }

  // Normaliser le code Airbnb côté client aussi
  const normalizedCode = airbnbCode.trim().toUpperCase().replace(/\s+/g, '');
  
  if (!/^[A-Z0-9]{6,12}$/.test(normalizedCode)) {
    throw new Error('Invalid Airbnb code format. Expected 6-12 alphanumeric characters.');
  }

  try {
    const response: EdgeResponse<ResolvedBooking> = await edgeClient.post('/booking-resolve', {
      token,
      airbnbCode: normalizedCode
    });

    if (!response.success) {
      const error = response.error!;
      
      // Mapper les erreurs spécifiques pour l'UI
      switch (error.code) {
        case 'ERR_TOKEN_INVALID':
          throw new Error('Le lien de vérification est invalide ou a expiré. Veuillez demander un nouveau lien.');
        
        case 'ERR_CODE_NOT_FOUND':
          throw new Error('Aucune réservation trouvée pour ce code Airbnb sur cette propriété. Vérifiez votre code de confirmation.');
        
        case 'ERR_TOKEN_EXPIRED':
          throw new Error('Le lien de vérification a expiré. Veuillez demander un nouveau lien au propriétaire.');
        
        case 'INVALID_AIRBNB_CODE_FORMAT':
          throw new Error('Format de code Airbnb invalide. Le code doit contenir 6 à 12 caractères alphanumériques.');
        
        case 'DATABASE_ERROR':
          throw new Error('Erreur de base de données. Veuillez réessayer dans quelques instants.');
        
        default:
          throw new Error(error.message || 'Une erreur inattendue est survenue lors de la résolution de la réservation.');
      }
    }

    if (!response.data) {
      throw new Error('Aucune donnée reçue du serveur');
    }

    const booking = response.data;
    
    // Validation des données reçues
    if (!booking.propertyId || !booking.airbnbCode || !booking.checkIn || !booking.checkOut) {
      throw new Error('Données de réservation incomplètes reçues du serveur');
    }

    // Validation des dates
    const checkInDate = new Date(booking.checkIn);
    const checkOutDate = new Date(booking.checkOut);
    
    if (isNaN(checkInDate.getTime()) || isNaN(checkOutDate.getTime())) {
      throw new Error('Dates de réservation invalides');
    }
    
    if (checkOutDate <= checkInDate) {
      throw new Error('La date de départ doit être après la date d\'arrivée');
    }

    console.log('✅ [BookingResolve] Booking resolved successfully:', {
      propertyId: booking.propertyId,
      checkIn: booking.checkIn,
      checkOut: booking.checkOut,
      hasGuestName: !!booking.guestName,
      hasPropertyName: !!booking.propertyName
    });

    return booking;

  } catch (error) {
    console.error('❌ [BookingResolve] Error resolving booking:', error);
    
    // Re-throw avec message approprié
    if (error instanceof Error) {
      throw error;
    }
    
    throw new Error('Erreur de réseau lors de la résolution de la réservation. Veuillez vérifier votre connexion et réessayer.');
  }
}

/**
 * Formater une date pour l'affichage
 */
export function formatBookingDate(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString('fr-FR', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  } catch {
    return dateStr;
  }
}

/**
 * Calculer le nombre de nuits
 */
export function calculateNights(checkIn: string, checkOut: string): number {
  try {
    const start = new Date(checkIn);
    const end = new Date(checkOut);
    const diffTime = end.getTime() - start.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  } catch {
    return 0;
  }
}

/**
 * Vérifier si une réservation est valide (dates cohérentes)
 */
export function validateBookingDates(checkIn: string, checkOut: string): boolean {
  try {
    const start = new Date(checkIn);
    const end = new Date(checkOut);
    
    // Dates valides
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return false;
    }
    
    // Check-out après check-in
    if (end <= start) {
      return false;
    }
    
    // Pas trop dans le futur (limite raisonnable)
    const maxFuture = new Date();
    maxFuture.setFullYear(maxFuture.getFullYear() + 2);
    
    if (end > maxFuture) {
      return false;
    }
    
    return true;
  } catch {
    return false;
  }
}
