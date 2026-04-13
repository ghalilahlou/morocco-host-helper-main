import { supabase } from '@/integrations/supabase/client';
import { Booking } from '@/types/booking';

let submissionsCache: { data: any[], timestamp: number } | null = null;
const CACHE_DURATION = 30000; // 30s – balanced between freshness and avoiding repeated fetches

/** Invalidate the in-memory guest submissions cache (call on realtime events). */
export const invalidateSubmissionsCache = () => {
  submissionsCache = null;
};

interface GuestSubmissionData {
  id: string;
  booking_id: string | null;
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
      if (import.meta.env.DEV) {
        console.log('📋 Using cached guest submissions');
      }
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
      
      // Query guest_submissions directly (the view v_guest_submissions misses rows
      // whose token_id doesn't match a real property_verification_tokens row).
      const queryPromise = supabase
        .from('guest_submissions')
        .select(`
          id,
          booking_id,
          guest_data,
          document_urls,
          signature_data,
          status,
          submitted_at
        `)
        .in('booking_id', limitedBookingIds)
        .not('booking_id', 'is', null)
        .limit(200);
      
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
      if (import.meta.env.DEV) {
        console.log('✅ Fetched guest submissions:', submissions);
      }
    }

    const submissionsByBooking = (submissions || []).reduce((acc, submission) => {
      const bookingId = submission.booking_id;
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
        let guestData: any = submission.guest_data;
        if (typeof guestData === 'string') {
          try {
            guestData = JSON.parse(guestData);
          } catch {
            guestData = null;
          }
        }

        if (guestData) {
          const extractName = (g: any): string | null => {
            if (!g || typeof g !== 'object') return null;
            if (g.fullName) return g.fullName;
            if (g.full_name) return g.full_name;
            if (g.name) return g.name;
            if (g.firstName || g.lastName) {
              return [g.firstName, g.lastName].filter(Boolean).join(' ');
            }
            if (g.first_name || g.last_name) {
              return [g.first_name, g.last_name].filter(Boolean).join(' ');
            }
            const pi = g.personalInfo;
            if (pi && typeof pi === 'object') {
              if (pi.fullName) return pi.fullName;
              if (pi.firstName || pi.lastName) {
                return [pi.firstName, pi.lastName].filter(Boolean).join(' ');
              }
            }
            return null;
          };

          if (Array.isArray(guestData)) {
            guestData.forEach((guest: any) => {
              const n = extractName(guest);
              if (n) realGuestNames.push(n);
            });
          } else if (typeof guestData === 'object') {
            if (guestData.guests && Array.isArray(guestData.guests)) {
              guestData.guests.forEach((guest: any) => {
                const n = extractName(guest);
                if (n) realGuestNames.push(n);
              });
            } else {
              const n = extractName(guestData);
              if (n) realGuestNames.push(n);
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

      const toTitleCase = (s: string) =>
        s.trim().toLowerCase().replace(/\b\w/g, c => c.toUpperCase());

      const placeholderLower = new Set([
        'guest', 'client', 'invité', 'invite', 'voyageur', 'traveler',
        'traveller', 'réservation', 'reservation', 'unknown', 'inconnu',
        'n/a', 'na', 'test', '',
      ]);

      let uniqueNames = [...new Set(realGuestNames)]
        .filter(name => {
          if (!name || !name.trim()) return false;
          if (placeholderLower.has(name.trim().toLowerCase())) return false;
          // Reject ICS codes (e.g. HMBSQ4K8Z9)
          if (/^[A-Z]{2}[A-Z0-9]{4,}$/i.test(name.trim())) return false;
          if (/^UID:/i.test(name.trim())) return false;
          return true;
        })
        .map(name => toTitleCase(name));

      // Fallback to guests[].fullName before using guest_name (which is often a placeholder)
      if (uniqueNames.length === 0 && booking.guests && booking.guests.length > 0) {
        const firstValid = booking.guests.find(g =>
          g.fullName &&
          g.fullName.trim().length > 1 &&
          !placeholderLower.has(g.fullName.trim().toLowerCase()) &&
          !/^[A-Z]{2}[A-Z0-9]{4,}$/i.test(g.fullName.trim()) &&
          !/^UID:/i.test(g.fullName.trim())
        );
        if (firstValid) {
          uniqueNames = [toTitleCase(firstValid.fullName)];
        }
      }

      // Last resort: guest_name, but only if it's a real name (not placeholder / ICS code)
      if (uniqueNames.length === 0 && booking.guest_name) {
        const gn = booking.guest_name.trim();
        if (
          gn.length > 1 &&
          !placeholderLower.has(gn.toLowerCase()) &&
          !/^[A-Z]{2}[A-Z0-9]{4,}$/i.test(gn) &&
          !/^UID:/i.test(gn)
        ) {
          uniqueNames = [toTitleCase(gn)];
        }
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
    
    if (import.meta.env.DEV) {
      console.log('✅ Enriched bookings with guest submissions:', {
        total: enrichedBookings.length,
        unique: uniqueIds.size,
        duplicates: duplicates.length > 0 ? duplicates : 'none',
        bookingIds: enrichedBookings.map(b => b.id.substring(0, 8)).join(', ')
      });
      console.log('✅ [ENRICH] Détails des réservations enrichies:', enrichedBookings.map(b => ({
        id: b.id.substring(0, 8),
        status: b.status,
        guest_name: b.guest_name,
        realGuestNames: b.realGuestNames,
        hasRealSubs: b.hasRealSubmissions,
        guestsCount: b.guests?.length ?? 0,
        firstGuestFullName: b.guests?.[0]?.fullName ?? '(none)',
      })));
    }
    
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