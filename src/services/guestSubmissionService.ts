import { supabase } from '@/integrations/supabase/client';
import { Booking } from '@/types/booking';

let submissionsCache: { data: any[], timestamp: number } | null = null;
const CACHE_DURATION = 2000; // 2s – short TTL so realtime triggers show fresh data quickly

/** Invalidate the in-memory guest submissions cache (call on realtime events). */
export const invalidateSubmissionsCache = () => {
  submissionsCache = null;
};

interface GuestSubmissionData {
  id: string;
  resolved_booking_id: string | null;  // ✅ CORRECTION : Utiliser resolved_booking_id
  guest_data: any;
  document_urls: any;
  signature_data: string | null;
  status: string;
  submitted_at: string;
}

export interface EnrichedBooking extends Booking {
  realGuestNames: string[];
  realGuestCount: number;
  hasRealSubmissions: boolean;
  submissionStatus: {
    hasDocuments: boolean;
    hasSignature: boolean;
    documentsCount: number;
  };
  documentsLoading?: boolean; // ✅ NOUVEAU : Indicateur que les documents sont en cours de chargement
  enrichmentError?: boolean; // ✅ NOUVEAU : Indicateur qu'une erreur s'est produite lors de l'enrichissement
  documentsTimeout?: boolean; // ✅ TIMEOUT GRACIEUX : Indicateur spécifique pour les timeouts (15s)
}

/**
 * Enriches bookings with real guest submission data from v_guest_submissions
 */
export const enrichBookingsWithGuestSubmissions = async (bookings: Booking[]): Promise<EnrichedBooking[]> => {
  if (bookings.length === 0) return [];

  try {
    // Get all booking IDs and validate they are UUIDs
    const bookingIds = bookings
      .map(b => b.id)
      .filter(id => id && id.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i));
    
    if (bookingIds.length === 0) {
      console.warn('❌ No valid booking IDs found');
      return bookings.map(booking => ({
        ...booking,
        realGuestNames: [],
        realGuestCount: 0,
        hasRealSubmissions: false,
        submissionStatus: {
          hasDocuments: false,
          hasSignature: false,
          documentsCount: 0
        }
      }));
    }
    
    // ✅ CACHE : Vérifier le cache d'abord
    const now = Date.now();
    let submissions;
    
    if (submissionsCache && (now - submissionsCache.timestamp) < CACHE_DURATION) {
      console.log('📋 Using cached guest submissions');
      submissions = submissionsCache.data;
    } else {
      // ✅ OPTIMISATION TIMEOUT : Augmenter le délai à 15s pour les requêtes complexes
      const TIMEOUT_MS = 15000; // ✅ AUGMENTÉ : 15 secondes pour permettre aux requêtes complexes de se terminer
      const MAX_BOOKING_IDS = 100; // ✅ AUGMENTÉ : Permettre plus de booking IDs avec le timeout plus long
      
      // ✅ OPTIMISATION : Limiter le nombre de booking IDs si trop nombreux
      const limitedBookingIds = bookingIds.slice(0, MAX_BOOKING_IDS);
      
      if (limitedBookingIds.length < bookingIds.length) {
        console.warn(`⚠️ [GUEST SUBMISSIONS] Limitation des booking IDs à ${MAX_BOOKING_IDS} pour éviter les timeouts`, {
          total: bookingIds.length,
          limited: limitedBookingIds.length
        });
      }
      
      // ✅ OPTIMISATION SQL : Sélectionner uniquement les colonnes strictement nécessaires
      // Éviter de charger des colonnes lourdes (JSON, métadonnées inutiles)
      const queryPromise = supabase
        .from('v_guest_submissions')
        .select(`
          id,
          resolved_booking_id,
          guest_data,
          document_urls,
          signature_data,
          status,
          submitted_at
        `) // ✅ OPTIMISÉ : Seulement les colonnes nécessaires, pas de SELECT *
        .in('resolved_booking_id', limitedBookingIds)
        .not('resolved_booking_id', 'is', null)
        .limit(200); // ✅ AUGMENTÉ : Limite à 200 résultats avec timeout plus long
      
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error(`Query timeout after ${TIMEOUT_MS}ms`)), TIMEOUT_MS)
      );
      
      let submissionsData, error;
      try {
        // ✅ GESTION ROBUSTE : Bloc try/catch spécifique pour les timeouts et erreurs 500
        const result = await Promise.race([queryPromise, timeoutPromise]);
        submissionsData = result.data;
        error = result.error;
        
        // ✅ DÉTECTION ERREUR 500 : Vérifier si c'est une erreur serveur
        if (error) {
          const errorStatus = (error as any)?.status || (error as any)?.statusCode || (error as any)?.code;
          if (errorStatus === 500 || errorStatus === '500' || errorStatus === '57014') {
            console.error('❌ [GUEST SUBMISSIONS] Erreur 500/Timeout détectée', {
              error: error.message,
              code: errorStatus,
              details: (error as any)?.details,
              hint: (error as any)?.hint
            });
            // Retourner les bookings avec indicateur d'erreur
            return bookings.map(booking => ({
              ...booking,
              realGuestNames: [],
              realGuestCount: 0,
              hasRealSubmissions: false,
              documentsLoading: false, // ✅ Documents non disponibles temporairement
              enrichmentError: true, // ✅ Marquer l'erreur d'enrichissement
              submissionStatus: {
                hasDocuments: false,
                hasSignature: false,
                documentsCount: 0
              }
            }));
          }
        }
      } catch (timeoutError: any) {
        // ✅ TIMEOUT GRACIEUX : Si timeout (15s), retourner les bookings avec indicateur spécifique
        if (timeoutError?.message?.includes('timeout') || timeoutError?.code === '57014' || timeoutError?.code === '23') {
          // ✅ PERFORMANCE : Logger le timeout une seule fois par session pour éviter la répétition
          try {
            const timeoutKey = 'guest-submissions-timeout-logged';
            const hasLoggedTimeout = typeof sessionStorage !== 'undefined' ? sessionStorage.getItem(timeoutKey) : null;
            if (!hasLoggedTimeout) {
              console.warn(`⏱️ [GUEST SUBMISSIONS] Timeout gracieux après ${TIMEOUT_MS}ms - Documents non vérifiés mais réservations affichées`, {
                bookingIdsCount: limitedBookingIds.length,
                error: timeoutError.message,
                note: 'Les réservations restent affichées avec les dates, seuls les documents ne sont pas vérifiés. Ce message ne s\'affichera qu\'une fois par session.'
              });
              if (typeof sessionStorage !== 'undefined') {
                sessionStorage.setItem(timeoutKey, 'true');
              }
            }
          } catch (e) {
            // ✅ PROTECTION : Si sessionStorage n'est pas disponible, utiliser un flag en mémoire
            const timeoutKey = 'guest-submissions-timeout-memory';
            if (!(window as any)[timeoutKey]) {
              console.warn(`⏱️ [GUEST SUBMISSIONS] Timeout gracieux après ${TIMEOUT_MS}ms - Documents non vérifiés mais réservations affichées`, {
                bookingIdsCount: limitedBookingIds.length,
                error: timeoutError.message,
                note: 'Les réservations restent affichées avec les dates, seuls les documents ne sont pas vérifiés'
              });
              (window as any)[timeoutKey] = true;
            }
          }
          // ✅ TIMEOUT GRACIEUX : Retourner les bookings avec indicateur de timeout spécifique
          return bookings.map(booking => ({
            ...booking,
            realGuestNames: [],
            realGuestCount: 0,
            hasRealSubmissions: false,
            documentsLoading: false, // ✅ Documents non chargés (timeout)
            enrichmentError: false, // ✅ Pas d'erreur, juste un timeout
            documentsTimeout: true, // ✅ TIMEOUT GRACIEUX : Indicateur spécifique pour timeout
            submissionStatus: {
              hasDocuments: false,
              hasSignature: false,
              documentsCount: 0
            }
          }));
        }
        throw timeoutError;
      }

      // ✅ GESTION ERREUR GÉNÉRIQUE : Si erreur autre que 500/timeout
      if (error) {
        console.error('❌ [GUEST SUBMISSIONS] Erreur lors de la récupération des submissions', {
          error: error.message,
          code: (error as any)?.code,
          details: (error as any)?.details,
          hint: (error as any)?.hint
        });
        // ✅ RÉSILIENCE : Retourner les bookings sans enrichissement en cas d'erreur
        return bookings.map(booking => ({
          ...booking,
          realGuestNames: [],
          realGuestCount: 0,
          hasRealSubmissions: false,
          documentsLoading: false, // ✅ Documents non disponibles temporairement
          enrichmentError: true, // ✅ Marquer l'erreur d'enrichissement
          submissionStatus: {
            hasDocuments: false,
            hasSignature: false,
            documentsCount: 0
          }
        }));
      }

      // ✅ CACHE : Mettre en cache les résultats
      submissions = submissionsData;
      submissionsCache = { data: submissions, timestamp: now };
      console.log('✅ Fetched guest submissions:', submissions);
    }

    // ✅ CORRECTION : Utiliser resolved_booking_id
    const submissionsByBooking = (submissions || []).reduce((acc, submission) => {
      const bookingId = submission.resolved_booking_id;  // ✅ Utiliser resolved_booking_id
      if (!bookingId) return acc;
      
      if (!acc[bookingId]) {
        acc[bookingId] = [];
      }
      acc[bookingId].push(submission);
      return acc;
    }, {} as Record<string, GuestSubmissionData[]>);

    // Enrich each booking with submission data
    const enrichedBookings: EnrichedBooking[] = bookings.map(booking => {
      const bookingSubmissions = submissionsByBooking[booking.id] || [];
      
      // Extract real guest names from submissions
      const realGuestNames: string[] = [];
      let totalDocuments = 0;
      let hasSignature = false;

      bookingSubmissions.forEach(submission => {
        if (submission.guest_data) {
          // Handle different possible structures in guest_data
          if (Array.isArray(submission.guest_data)) {
            submission.guest_data.forEach((guest: any) => {
              if (guest.fullName || guest.full_name) {
                realGuestNames.push(guest.fullName || guest.full_name);
              }
            });
          } else if (typeof submission.guest_data === 'object') {
            // Handle single guest or guests array in object
            if (submission.guest_data.guests && Array.isArray(submission.guest_data.guests)) {
              submission.guest_data.guests.forEach((guest: any) => {
                if (guest.fullName || guest.full_name) {
                  realGuestNames.push(guest.fullName || guest.full_name);
                }
              });
            } else if (submission.guest_data.fullName || submission.guest_data.full_name) {
              realGuestNames.push(submission.guest_data.fullName || submission.guest_data.full_name);
            }
          }
        }

        // Count documents
        if (submission.document_urls) {
          if (Array.isArray(submission.document_urls)) {
            totalDocuments += submission.document_urls.length;
          } else if (typeof submission.document_urls === 'string') {
            try {
              const parsed = JSON.parse(submission.document_urls);
              if (Array.isArray(parsed)) {
                totalDocuments += parsed.length;
              }
            } catch (e) {
              // If it's a string but not JSON, count as 1 document
              totalDocuments += 1;
            }
          }
        }

        // Check for signature
        if (submission.signature_data) {
          hasSignature = true;
        }
      });

      // Remove duplicates and clean names
      let uniqueNames = [...new Set(realGuestNames)]
        .filter(name => name && name.trim().length > 0)
        .map(name => name.trim().toUpperCase());

      // ✅ NOUVEAU : Si pas de noms trouvés dans les soumissions, utiliser le guest_name de la réservation
      if (uniqueNames.length === 0 && booking.guest_name) {
        uniqueNames = [booking.guest_name.trim().toUpperCase()];
        console.log('🔍 Utilisation du guest_name de la réservation comme fallback:', booking.guest_name);
      }

      return {
        ...booking,
        realGuestNames: uniqueNames,
        realGuestCount: uniqueNames.length,
        hasRealSubmissions: bookingSubmissions.length > 0,
        documentsLoading: false, // ✅ Enrichissement terminé avec succès
        enrichmentError: false, // ✅ Pas d'erreur
        submissionStatus: {
          hasDocuments: totalDocuments > 0,
          hasSignature,
          documentsCount: totalDocuments
        }
      };
    });

    // ✅ DIAGNOSTIC : Vérifier les doublons avant de retourner
    const uniqueIds = new Set<string>();
    const duplicates: string[] = [];
    enrichedBookings.forEach(b => {
      if (uniqueIds.has(b.id)) {
        duplicates.push(b.id.substring(0, 8));
      } else {
        uniqueIds.add(b.id);
      }
    });
    
    if (duplicates.length > 0) {
      console.warn('⚠️ [ENRICH] Doublons détectés dans enrichedBookings:', {
        duplicates,
        total: enrichedBookings.length,
        unique: uniqueIds.size
      });
    }
    
    console.log('✅ Enriched bookings with guest submissions:', {
      total: enrichedBookings.length,
      unique: uniqueIds.size,
      duplicates: duplicates.length > 0 ? duplicates : 'none',
      bookingIds: enrichedBookings.map(b => b.id.substring(0, 8)).join(', ')
    });
    console.log('✅ [ENRICH] Détails des réservations enrichies:', enrichedBookings.map(b => ({
      id: b.id.substring(0, 8),
      propertyId: b.propertyId?.substring(0, 8) || 'N/A',
      status: b.status,
      guestName: b.guest_name
    })));
    
    // ✅ PROTECTION : Retourner seulement les réservations uniques
    if (duplicates.length > 0) {
      const uniqueBookings = Array.from(uniqueIds).map(id => 
        enrichedBookings.find(b => b.id === id)!
      );
      console.warn('⚠️ [ENRICH] Doublons supprimés, retour de', uniqueBookings.length, 'réservations uniques');
      return uniqueBookings;
    }
    
    return enrichedBookings;

  } catch (error) {
    console.error('❌ Error enriching bookings:', error);
    return bookings.map(booking => ({
      ...booking,
      realGuestNames: [],
      realGuestCount: 0,
      hasRealSubmissions: false,
      submissionStatus: {
        hasDocuments: false,
        hasSignature: false,
        documentsCount: 0
      }
    }));
  }
};