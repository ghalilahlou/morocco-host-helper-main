/**
 * ✅ PHASE 3 : Contexte React pour les réservations
 * Évite le props drilling et optimise les re-renders
 */

import React, { createContext, useContext, useMemo, memo } from 'react';
import { EnrichedBooking } from '@/services/guestSubmissionService';
import { Booking } from '@/types/booking';

interface BookingsContextValue {
  bookings: EnrichedBooking[];
  isLoading: boolean;
  propertyId?: string;
}

const BookingsContext = createContext<BookingsContextValue | undefined>(undefined);

interface BookingsProviderProps {
  children: React.ReactNode;
  bookings: EnrichedBooking[];
  isLoading: boolean;
  propertyId?: string;
}

/**
 * Provider pour les réservations avec memoization
 */
export const BookingsProvider = memo(({ 
  children, 
  bookings, 
  isLoading, 
  propertyId 
}: BookingsProviderProps) => {
  // ✅ PHASE 3 : Mémoriser la valeur du contexte pour éviter les re-renders
  const value = useMemo(() => ({
    bookings,
    isLoading,
    propertyId
  }), [bookings, isLoading, propertyId]);
  
  return (
    <BookingsContext.Provider value={value}>
      {children}
    </BookingsContext.Provider>
  );
});

BookingsProvider.displayName = 'BookingsProvider';

/**
 * Hook pour utiliser le contexte des réservations
 */
export function useBookingsContext() {
  const context = useContext(BookingsContext);
  if (context === undefined) {
    throw new Error('useBookingsContext must be used within a BookingsProvider');
  }
  return context;
}

/**
 * Hook optionnel pour utiliser le contexte (ne lance pas d'erreur si non disponible)
 */
export function useBookingsContextOptional() {
  return useContext(BookingsContext);
}

