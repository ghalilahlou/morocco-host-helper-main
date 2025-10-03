/**
 * Service pour résoudre les réservations Airbnb via booking-resolve Edge Function
 */

import { supabase } from '@/integrations/supabase/client';
import { runtimeConfig } from '@/config/runtime';
import { type Booking, type Property, type Guest } from '@/types/booking';
import { edgeClient } from '@/lib/edgeClient';

export interface ResolvedBooking {
  id: string;
  checkIn: string;
  checkOut: string;
  propertyName?: string;
  status: string;
  airbnbCode: string;
  guestId?: string;
  guestName?: string;
  guests: Guest[];
  property: Property;
}

export interface BookingResolveError {
  code: 'ERR_TOKEN_INVALID' | 'ERR_CODE_NOT_FOUND' | 'ERR_TOKEN_EXPIRED' | 'INVALID_JSON' | 'TOKEN_REQUIRED' | 'AIRBNB_CODE_REQUIRED' | 'DATABASE_ERROR' | 'INTERNAL_ERROR' | string;
  message: string;
  details?: any;
}

/**
 * Résoudre une réservation Airbnb à partir d'un token et code
 */
export async function resolveBooking(token: string, airbnbCode: string): Promise<ResolvedBooking> {
  if (!token) {
    throw new Error("Verification token is missing.");
  }

  if (!airbnbCode) {
    throw new Error("Airbnb confirmation code is missing.");
  }

  console.log("Calling booking-resolve edge function...");
  try {
    const { data, error } = await edgeClient.post<{ booking: ResolvedBooking }>('/booking-resolve', {
      token: token,
      airbnb_code: airbnbCode,
    });

    if (error) {
      console.error("Error resolving booking:", error);
      throw new Error(`Failed to resolve booking: ${error}`);
    }

    if (!data?.booking) {
      throw new Error("Booking data not found in response.");
    }

    console.log("Booking resolved successfully:", data.booking);
    return data.booking;
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Exception in resolveBooking:", errorMessage);
    throw new Error(`Booking resolution failed: ${errorMessage}`);
  }
}

/**
 * Formater une date pour l'affichage
 */
export function formatBookingDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
}

/**
 * Calculer le nombre de nuits
 */
export function calculateNights(checkIn: string, checkOut: string): number {
  const startDate = new Date(checkIn);
  const endDate = new Date(checkOut);
  const timeDiff = Math.abs(endDate.getTime() - startDate.getTime());
  return Math.ceil(timeDiff / (1000 * 60 * 60 * 24));
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
