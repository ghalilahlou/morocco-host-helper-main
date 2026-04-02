/// <reference types="https://deno.land/x/types/deploy/stable/index.d.ts" />
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { PDFDocument, StandardFonts, rgb } from "https://esm.sh/pdf-lib@1.17.1";
import fontkit from "https://esm.sh/@pdf-lib/fontkit@1.1.1";

// =====================================================
// CONFIGURATION ET CONSTANTS
// =====================================================

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json'
};

const FUNCTION_NAME = 'submit-guest-info-unified';
const MAX_RETRY_ATTEMPTS = 3;
const RETRY_DELAY_MS = 1000;

// =====================================================
// TYPES ET INTERFACES
// =====================================================

interface GuestInfo {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  nationality?: string;
  idType?: string;
  idNumber?: string;
  dateOfBirth?: string;
  /** Date d'expiration du document (stockée sous ce nom pour compatibilité DB) */
  documentIssueDate?: string;
  profession?: string;
  motifSejour?: string;
  adressePersonnelle?: string;
}

interface IdDocument {
  name: string;
  url: string;
  type: string;
  file?: File;
  size?: number;
}

interface SignatureData {
  data: string;
  timestamp: string;
  signerName?: string;
}

interface UnifiedRequest {
  token: string;
  airbnbCode: string;
  guestInfo: GuestInfo;
  /** Si présent (check-in multi-voyageurs), toutes les fiches sont persistées en base. */
  guests?: GuestInfo[];
  idDocuments: IdDocument[];
  signature?: SignatureData;
  // Options supplémentaires
  skipEmail?: boolean;
  skipPolice?: boolean;
  generateOnly?: boolean;
}

interface ResolvedBooking {
  propertyId: string;
  airbnbCode: string;
  checkIn: string;
  checkOut: string;
  propertyName: string;
  propertyAddress?: string;
  guestName?: string;
  numberOfGuests?: number;
  totalPrice?: number;
  currency?: string;
  bookingId?: string; // ✅ NOUVEAU : ID de la réservation si elle existe déjà
}

interface ProcessingResult {
  bookingId: string;
  contractUrl: string;
  policeUrl?: string;
  identityUrl?: string;  // ✅ AJOUT
  emailSent?: boolean;
  documentsCount: number;
  processingTime: number;
}

interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

// =====================================================
// UTILITAIRES ET HELPERS
// =====================================================

// Logger avec timestamp et contexte
function log(level: 'info' | 'warn' | 'error', message: string, data?: any) {
  const timestamp = new Date().toISOString();
  const prefix = `[${timestamp}] [${FUNCTION_NAME}]`;
  
  // ✅ AMÉLIORATION : Toujours logger, même sans données
  const logMessage = `${prefix} ${message}`;
  const logData = data ? JSON.stringify(data, null, 2) : '';
  
  switch (level) {
    case 'info':
      console.log(`✅ ${logMessage}`, logData);
      // ✅ FORCER l'affichage dans les logs Supabase
      console.log(JSON.stringify({ level: 'info', message, data, timestamp, function: FUNCTION_NAME }));
      break;
    case 'warn':
      console.warn(`⚠️ ${logMessage}`, logData);
      console.warn(JSON.stringify({ level: 'warn', message, data, timestamp, function: FUNCTION_NAME }));
      break;
    case 'error':
      console.error(`❌ ${logMessage}`, logData);
      console.error(JSON.stringify({ level: 'error', message, data, timestamp, function: FUNCTION_NAME }));
      break;
  }
}

// Utilitaire pour retry avec backoff
async function withRetry<T>(
  operation: () => Promise<T>,
  operationName: string,
  maxAttempts: number = MAX_RETRY_ATTEMPTS
): Promise<T> {
  let lastError: Error;
  
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      log('info', `${operationName} - Tentative ${attempt}/${maxAttempts}`);
      const result = await operation();
      log('info', `${operationName} - Succès à la tentative ${attempt}`);
      return result;
    } catch (error) {
      lastError = error as Error;
      log('warn', `${operationName} - Échec tentative ${attempt}/${maxAttempts}`, { error: lastError.message });
      
      if (attempt < maxAttempts) {
        const delay = RETRY_DELAY_MS * attempt;
        log('info', `${operationName} - Retry dans ${delay}ms`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  throw lastError!;
}

// Création du client Supabase avec configuration optimisée
async function getServerClient() {
  const url = Deno.env.get('SUPABASE_URL');
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  
  if (!url || !key) {
    throw new Error('SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY sont requis');
  }
  
  return createClient(url, key, {
    auth: { 
      persistSession: false,
      autoRefreshToken: false
    },
    global: {
      headers: { 
        'X-Client-Info': FUNCTION_NAME,
        'User-Agent': `${FUNCTION_NAME}/1.0`
      }
    },
    db: {
      schema: 'public'
    }
  });
}

// Validation exhaustive des données d'entrée
function validateRequest(request: UnifiedRequest): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Validation token
  if (!request.token || typeof request.token !== 'string' || request.token.length < 10) {
    errors.push('Token invalide ou manquant');
  }

  // Validation code Airbnb
  if (!request.airbnbCode || typeof request.airbnbCode !== 'string' || request.airbnbCode.length < 5) {
    errors.push('Code Airbnb invalide ou manquant');
  }

  // Validation informations invité (une fiche ou tableau guests)
  const emailRegex = /^[a-zA-Z0-9.!#$%&'*+\/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;

  const validateOneGuest = (g: GuestInfo, label: string) => {
    const { firstName, lastName, email } = g;
    if (!firstName || firstName.trim().length < 2) {
      errors.push(`${label}: prénom invalide (minimum 2 caractères)`);
    }
    if (!lastName || lastName.trim().length < 2) {
      errors.push(`${label}: nom invalide (minimum 2 caractères)`);
    }
    if (!email || !email.trim()) {
      errors.push(`${label}: email requis`);
    } else if (!emailRegex.test(email.trim())) {
      errors.push(`${label}: email invalide (format incorrect)`);
    }
  };

  const primaryGuestForValidation = (request.guests && request.guests.length > 0)
    ? request.guests[0]
    : request.guestInfo;

  if (!primaryGuestForValidation) {
    errors.push('Informations invité manquantes');
  } else if (request.guests && Array.isArray(request.guests) && request.guests.length > 0) {
    request.guests.forEach((g, i) => validateOneGuest(g, `Invité ${i + 1}`));
  } else {
    validateOneGuest(primaryGuestForValidation, 'Invité');
    if (!request.guestInfo?.phone) {
      warnings.push('Numéro de téléphone non fourni');
    }
    if (!request.guestInfo?.nationality) {
      warnings.push('Nationalité non fournie');
    }
  }

  // Validation documents
  if (!request.idDocuments || !Array.isArray(request.idDocuments) || request.idDocuments.length === 0) {
    errors.push('Au moins une pièce d\'identité est requise');
  } else {
    request.idDocuments.forEach((doc, index) => {
      if (!doc.name || !doc.url) {
        errors.push(`Document ${index + 1}: nom et URL requis`);
      }
      if (!doc.type) {
        warnings.push(`Document ${index + 1}: type de fichier non spécifié`);
      }
    });
  }

  // Validation signature si présente
  if (request.signature) {
    if (!request.signature.data || !request.signature.timestamp) {
      errors.push('Données de signature incomplètes');
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}

// Sanitisation des données
function sanitizeGuestInfo(guestInfo: GuestInfo): GuestInfo {
  // ✅ CRITIQUE : Préserver TOUS les champs pour la variabilisation complète
  const sanitized: GuestInfo = {
    firstName: guestInfo.firstName?.trim().replace(/[<>]/g, '') || '',
    lastName: guestInfo.lastName?.trim().replace(/[<>]/g, '') || '',
    email: guestInfo.email?.toLowerCase().trim(),
    phone: guestInfo.phone?.trim() || undefined,
    nationality: guestInfo.nationality?.trim() || 'Non spécifiée',
    idType: guestInfo.idType?.trim() || 'passport',
    idNumber: guestInfo.idNumber?.trim() || '',
    dateOfBirth: guestInfo.dateOfBirth?.trim() || undefined,
    documentIssueDate: guestInfo.documentIssueDate?.trim() || undefined,
    // ✅ CRITIQUE : Préserver les champs supplémentaires pour la variabilisation complète
    profession: guestInfo.profession?.trim() || undefined,
    motifSejour: guestInfo.motifSejour?.trim() || undefined,
    adressePersonnelle: guestInfo.adressePersonnelle?.trim() || undefined
  };
  
  log('info', 'Sanitisation des données invité', {
    originalDateOfBirth: guestInfo.dateOfBirth,
    sanitizedDateOfBirth: sanitized.dateOfBirth,
    hasDateOfBirth: !!sanitized.dateOfBirth,
    dateOfBirthType: typeof guestInfo.dateOfBirth,
    dateOfBirthLength: guestInfo.dateOfBirth?.length,
    hasProfession: !!sanitized.profession,
    hasMotifSejour: !!sanitized.motifSejour,
    hasAdressePersonnelle: !!sanitized.adressePersonnelle
  });
  
  return sanitized;
}

// =====================================================
// FONCTIONS MÉTIER
// =====================================================

// ÉTAPE 1: Résolution exhaustive de la réservation
async function resolveBookingInternal(token: string, airbnbCode: string): Promise<ResolvedBooking> {
  log('info', 'ÉTAPE 1: Démarrage de la résolution de réservation', {
    tokenPrefix: token.substring(0, 8) + '...',
    airbnbCode
  });

  return await withRetry(async () => {
    const supabase = await getServerClient();

    // 1. Vérification du token avec jointure optimisée
    log('info', 'Vérification du token de vérification');
    const { data: tokenData, error: tokenError } = await supabase
      .from('property_verification_tokens')
      .select(`
        id,
        property_id,
        token,
        expires_at,
        is_active,
        property:properties!inner(
          id,
          name,
          address,
          contact_info,
          is_active
        )
      `)
      .eq('token', token)
      .eq('is_active', true)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false }) // ✅ Prendre le plus récent si plusieurs
      .limit(1)
      .maybeSingle(); // ✅ maybeSingle() au lieu de single()

    if (tokenError || !tokenData) {
      log('error', 'Token validation failed', { error: tokenError });
      throw new Error(`Token invalide ou expiré: ${tokenError?.message || 'Token non trouvé'}`);
    }

    if (!tokenData.property.is_active) {
      throw new Error('Propriété inactive');
    }

    log('info', 'Token validé avec succès', {
      propertyId: tokenData.property.id,
      propertyName: tokenData.property.name
    });

    // 2. Recherche de la réservation Airbnb - d'abord dans bookings, puis dans airbnb_reservations
    log('info', 'Recherche de la réservation Airbnb');
    
    // Essayer d'abord dans la table bookings (réservations créées via le système unifié)
    // ✅ CORRIGÉ : .order().limit(1) pour gérer les doublons existants
    const { data: bookingReservation, error: bookingError } = await supabase
      .from('bookings')
      .select('*')
      .eq('property_id', tokenData.property.id)
      .eq('booking_reference', airbnbCode)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    let airbnbReservation: any = null;
    
    let existingBookingId: string | undefined = undefined;
    if (bookingReservation) {
      log('info', 'Réservation trouvée dans la table bookings', { bookingId: bookingReservation.id });
      existingBookingId = bookingReservation.id; // ✅ NOUVEAU : Stocker l'ID pour éviter la double création
      // Convertir le format bookings vers le format airbnb_reservations
      airbnbReservation = {
        property_id: bookingReservation.property_id,
        airbnb_booking_id: bookingReservation.booking_reference,
        start_date: bookingReservation.check_in_date,
        end_date: bookingReservation.check_out_date,
        guest_name: bookingReservation.guest_name,
        number_of_guests: bookingReservation.number_of_guests,
        total_price: bookingReservation.total_price,
        currency: 'EUR'
      };
    } else {
      // Fallback: chercher dans airbnb_reservations (réservations synchronisées)
      log('info', 'Réservation non trouvée dans bookings, recherche dans airbnb_reservations');
      const { data: airbnbReservationData, error: airbnbError } = await supabase
        .from('airbnb_reservations')
        .select('*')
        .eq('property_id', tokenData.property.id)
        .eq('airbnb_booking_id', airbnbCode)
        .maybeSingle();
      
      if (airbnbReservationData) {
        airbnbReservation = airbnbReservationData;
        log('info', 'Réservation trouvée dans airbnb_reservations');
      }
    }

    if (!airbnbReservation) {
      log('error', 'Réservation Airbnb non trouvée', { 
        propertyId: tokenData.property.id,
        airbnbCode,
        searchedInBookings: !bookingError,
        searchedInAirbnbReservations: true
      });
      throw new Error(`Réservation Airbnb ${airbnbCode} non trouvée pour cette propriété`);
    }

    // 3. Validation des dates
    const checkIn = new Date(airbnbReservation.start_date);
    const checkOut = new Date(airbnbReservation.end_date);
    const now = new Date();
    
    // Période de grâce de 30 jours après check-out pour finaliser les documents
    const gracePeriodDays = 30;
    const expiryDate = new Date(checkOut);
    expiryDate.setDate(expiryDate.getDate() + gracePeriodDays);

    if (now > expiryDate) {
      log('warn', 'Réservation expirée (dépassement période de grâce)', { 
        checkIn, checkOut, now, expiryDate, gracePeriodDays 
      });
      throw new Error(`Cette réservation est expirée (période de grâce de ${gracePeriodDays} jours dépassée)`);
    } else if (checkOut <= now) {
      log('info', 'Réservation en période de grâce', { 
        checkIn, checkOut, now, expiryDate, daysRemaining: Math.ceil((expiryDate - now) / (1000 * 60 * 60 * 24))
      });
    }

    // 4. Construction du booking résolu
    const booking: ResolvedBooking = {
      propertyId: tokenData.property.id,
      airbnbCode: airbnbCode,
      checkIn: airbnbReservation.start_date,
      checkOut: airbnbReservation.end_date,
      propertyName: tokenData.property.name || 'Propriété',
      propertyAddress: tokenData.property.address || '',
      guestName: airbnbReservation.guest_name || undefined,
      numberOfGuests: airbnbReservation.number_of_guests || 1,
      totalPrice: airbnbReservation.total_price || undefined,
      currency: airbnbReservation.currency || 'EUR',
      bookingId: existingBookingId // ✅ NOUVEAU : Inclure l'ID si la réservation existe déjà
    };

    log('info', 'Réservation résolue avec succès', {
      propertyId: booking.propertyId,
      dates: `${booking.checkIn} → ${booking.checkOut}`,
      propertyName: booking.propertyName,
      guestsCount: booking.numberOfGuests
    });

    return booking;
  }, 'Résolution de réservation');
}

// NOUVELLE FONCTION : Récupérer la réservation ICS existante créée lors de la génération du lien
async function getExistingICSBooking(token: string, guestInfo: GuestInfo): Promise<ResolvedBooking> {
  log('info', 'Récupération de la réservation ICS existante', {
    tokenPrefix: token.substring(0, 8) + '...',
    guest: `${guestInfo.firstName} ${guestInfo.lastName}`
  });

  return await withRetry(async () => {
    const supabase = await getServerClient();

    // 1. Récupérer le token avec ses métadonnées
    const { data: tokenData, error: tokenError } = await supabase
      .from('property_verification_tokens')
      .select(`
        id,
        property_id,
        token,
        expires_at,
        is_active,
        metadata,
        property:properties!inner(
          id,
          name,
          address,
          contact_info,
          is_active
        )
      `)
      .eq('token', token)
      .eq('is_active', true)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false}) // ✅ Prendre le plus récent si plusieurs
      .limit(1)
      .maybeSingle(); // ✅ maybeSingle() au lieu de single()

    if (tokenError || !tokenData) {
      log('error', 'Token validation failed', { error: tokenError });
      throw new Error(`Token invalide ou expiré: ${tokenError?.message || 'Token non trouvé'}`);
    }

    if (!tokenData.property.is_active) {
      throw new Error('Propriété inactive');
    }

    // 2. Extraire l'ID de la réservation depuis les métadonnées
    const metadata = tokenData.metadata || {};
    const reservationData = metadata.reservationData;
    const bookingId = reservationData?.bookingId;

    log('info', 'Métadonnées du token récupérées', { 
      metadataKeys: Object.keys(metadata),
      hasReservationData: !!reservationData,
      reservationDataKeys: reservationData ? Object.keys(reservationData) : [],
      bookingId: bookingId
    });

    if (!bookingId) {
      log('error', 'ID de réservation manquant dans le token', { 
        metadata,
        reservationData,
        linkType: metadata.linkType
      });
      throw new Error('ID de réservation manquant pour ce lien ICS');
    }

    log('info', 'ID de réservation trouvé dans le token', { bookingId });

    // 3. Récupérer la réservation existante
    log('info', 'Recherche de la réservation dans la base de données', { bookingId });
    
    const { data: existingBooking, error: bookingError } = await supabase
      .from('bookings')
      .select('*')
      .eq('id', bookingId)
      .single();

    log('info', 'Résultat de la recherche de réservation', { 
      found: !!existingBooking,
      error: bookingError,
      bookingData: existingBooking ? {
        id: existingBooking.id,
        property_id: existingBooking.property_id,
        booking_reference: existingBooking.booking_reference,
        guest_name: existingBooking.guest_name,
        status: existingBooking.status
      } : null
    });

    if (bookingError || !existingBooking) {
      log('error', 'Réservation non trouvée', { 
        bookingId, 
        error: bookingError,
        errorMessage: bookingError?.message,
        errorCode: bookingError?.code
      });
      throw new Error(`Réservation non trouvée: ${bookingError?.message || 'Réservation introuvable'}`);
    }

    // 4. Créer l'objet ResolvedBooking à partir de la réservation existante
    const booking: ResolvedBooking = {
      propertyId: existingBooking.property_id,
      airbnbCode: existingBooking.booking_reference,
      checkIn: existingBooking.check_in_date,
      checkOut: existingBooking.check_out_date,
      propertyName: tokenData.property.name || 'Propriété',
      propertyAddress: tokenData.property.address || '',
      guestName: existingBooking.guest_name,
      numberOfGuests: existingBooking.number_of_guests,
      totalPrice: existingBooking.total_price,
      currency: 'EUR',
      bookingId: bookingId // ✅ NOUVEAU : Inclure l'ID pour éviter la double création
    };

    log('info', 'Réservation ICS existante récupérée avec succès', {
      bookingId,
      propertyId: booking.propertyId,
      dates: `${booking.checkIn} → ${booking.checkOut}`,
      propertyName: booking.propertyName,
      guestsCount: booking.numberOfGuests
    });

    return booking;
  }, 'Récupération réservation ICS existante');
}

// NOUVELLE FONCTION : Créer une réservation à partir des données ICS stockées dans le token
async function createBookingFromICSData(token: string, guestInfo: GuestInfo): Promise<ResolvedBooking> {
  log('info', 'Création de réservation à partir des données ICS stockées', {
    tokenPrefix: token.substring(0, 8) + '...',
    guest: `${guestInfo.firstName} ${guestInfo.lastName}`
  });

  return await withRetry(async () => {
    const supabase = await getServerClient();

    // 1. Récupérer le token avec ses métadonnées
    const { data: tokenData, error: tokenError } = await supabase
      .from('property_verification_tokens')
      .select(`
        id,
        property_id,
        token,
        expires_at,
        is_active,
        metadata,
        property:properties!inner(
          id,
          name,
          address,
          contact_info,
          is_active,
          user_id
        )
      `)
      .eq('token', token)
      .eq('is_active', true)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false}) // ✅ Prendre le plus récent si plusieurs
      .limit(1)
      .maybeSingle(); // ✅ maybeSingle() au lieu de single()

    if (tokenError || !tokenData) {
      log('error', 'Token validation failed', { error: tokenError });
      throw new Error(`Token invalide ou expiré: ${tokenError?.message || 'Token non trouvé'}`);
    }

    if (!tokenData.property.is_active) {
      throw new Error('Propriété inactive');
    }

    // 2. Extraire les données de réservation des métadonnées
    const metadata = tokenData.metadata || {};
    const reservationData = metadata.reservationData;

    if (!reservationData || metadata.linkType !== 'ics_direct') {
      log('error', 'Données de réservation ICS manquantes dans le token', { metadata });
      throw new Error('Données de réservation ICS manquantes pour ce lien');
    }

    log('info', 'Données ICS extraites du token', {
      airbnbCode: reservationData.airbnbCode,
      startDate: reservationData.startDate,
      endDate: reservationData.endDate,
      guestName: reservationData.guestName
    });

    // 3. Créer la réservation avec les données ICS ET l'enregistrer en base
    // ✅ CORRIGÉ : Extraire directement la date YYYY-MM-DD sans conversion timezone
    // Les dates sont maintenant normalisées dans issue-guest-link au format YYYY-MM-DD
    function extractDateOnly(dateValue: string | Date | any): string {
      if (typeof dateValue === 'string') {
        // Si format ISO complet (2025-12-25T23:00:00.000Z), extraire juste YYYY-MM-DD
        if (dateValue.includes('T')) {
          return dateValue.split('T')[0];
        }
        // Si déjà YYYY-MM-DD, retourner tel quel
        if (/^\d{4}-\d{2}-\d{2}$/.test(dateValue)) {
          return dateValue;
        }
        // Sinon, essayer de parser et extraire
        const dateObj = new Date(dateValue);
        const year = dateObj.getUTCFullYear();
        const month = String(dateObj.getUTCMonth() + 1).padStart(2, '0');
        const day = String(dateObj.getUTCDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
      }
      
      // Si Date object, extraire la partie date en UTC pour éviter les décalages
      const dateObj = dateValue instanceof Date ? dateValue : new Date(dateValue);
      const year = dateObj.getUTCFullYear();
      const month = String(dateObj.getUTCMonth() + 1).padStart(2, '0');
      const day = String(dateObj.getUTCDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    }
    
    const checkInDate = extractDateOnly(reservationData.startDate);
    const checkOutDate = extractDateOnly(reservationData.endDate);
    
    log('info', 'Dates normalisées pour la réservation', { checkInDate, checkOutDate });
    
    // Vérifier si une réservation existe déjà pour ce code Airbnb
    // ✅ CORRIGÉ : .order().limit(1) pour gérer les doublons existants
    const { data: existingBooking } = await supabase
      .from('bookings')
      .select('id, status')
      .eq('property_id', tokenData.property.id)
      .eq('booking_reference', reservationData.airbnbCode)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    let bookingId: string;
    
    if (existingBooking) {
      // Mettre à jour la réservation existante
      log('info', 'Mise à jour réservation existante', { bookingId: existingBooking.id });
      bookingId = existingBooking.id;
      
      const { error: updateError } = await supabase
        .from('bookings')
        .update({
          check_in_date: checkInDate,
          check_out_date: checkOutDate,
          guest_name: reservationData.guestName || `${guestInfo.firstName} ${guestInfo.lastName}`,
          number_of_guests: reservationData.numberOfGuests || 1,
          updated_at: new Date().toISOString()
        })
        .eq('id', bookingId);

      if (updateError) {
        log('error', 'Erreur mise à jour réservation', { error: updateError });
        throw new Error(`Erreur mise à jour réservation: ${updateError.message}`);
      }
    } else {
      // Créer une nouvelle réservation
      log('info', 'Création nouvelle réservation ICS');
      const { data: newBooking, error: createError } = await supabase
        .from('bookings')
        .insert({
          property_id: tokenData.property.id,
          user_id: tokenData.property.user_id,
          check_in_date: checkInDate,
          check_out_date: checkOutDate,
          guest_name: reservationData.guestName || `${guestInfo.firstName} ${guestInfo.lastName}`,
          number_of_guests: reservationData.numberOfGuests || 1,
          booking_reference: reservationData.airbnbCode,
          status: 'pending',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select('id')
        .single();

      if (createError) {
        log('error', 'Erreur création réservation', { error: createError });
        throw new Error(`Erreur création réservation: ${createError.message}`);
      }

      bookingId = newBooking.id;
    }

    // 4. Créer l'objet ResolvedBooking avec l'ID de la réservation créée
    const booking: ResolvedBooking = {
      propertyId: tokenData.property.id,
      airbnbCode: reservationData.airbnbCode,
      checkIn: checkInDate,
      checkOut: checkOutDate,
      propertyName: tokenData.property.name || 'Propriété',
      propertyAddress: tokenData.property.address || '',
      guestName: reservationData.guestName || `${guestInfo.firstName} ${guestInfo.lastName}`,
      numberOfGuests: reservationData.numberOfGuests || 1,
      totalPrice: undefined,
      currency: 'EUR',
      bookingId: bookingId // ✅ NOUVEAU : Inclure l'ID de la réservation pour éviter la double création
    };

    log('info', 'Réservation ICS créée et enregistrée en base', {
      bookingId,
      propertyId: booking.propertyId,
      dates: `${booking.checkIn} → ${booking.checkOut}`,
      propertyName: booking.propertyName,
      guestsCount: booking.numberOfGuests
    });

    return booking;
  }, 'Création réservation à partir des données ICS');
}

// ÉTAPE 2: Sauvegarde exhaustive des données
async function saveGuestDataInternal(
  booking: ResolvedBooking, 
  guestInfos: GuestInfo[], 
  idDocuments: IdDocument[]
): Promise<string> {
  log('info', 'ÉTAPE 2: Démarrage de la sauvegarde des données', {
    guestsCount: guestInfos.length,
    firstGuest: guestInfos[0] ? `${guestInfos[0].firstName} ${guestInfos[0].lastName}` : 'N/A',
    documentsCount: idDocuments.length,
    propertyId: booking.propertyId
  });

  return await withRetry(async () => {
    const supabase = await getServerClient();
    if (!guestInfos?.length) {
      throw new Error('Au moins une fiche invité est requise');
    }
    const primaryGuest = sanitizeGuestInfo(guestInfos[0]);

    // 1. Création/mise à jour de la réservation avec toutes les données (approche robuste)
    log('info', 'Sauvegarde de la réservation');
    
    // ✅ NOUVEAU : Si booking.bookingId existe, utiliser directement cette réservation
    let existingBooking = null;
    if (booking.bookingId) {
      log('info', 'Utilisation de la réservation existante via bookingId', { bookingId: booking.bookingId });
      const { data } = await supabase
        .from('bookings')
        .select('id')
        .eq('id', booking.bookingId)
        .maybeSingle();
      existingBooking = data;
      
      if (!existingBooking) {
        log('warn', 'Réservation avec bookingId non trouvée, recherche par booking_reference', { bookingId: booking.bookingId });
      }
    }
    
    // Si pas trouvé par bookingId, chercher par booking_reference
    if (!existingBooking) {
      if (booking.airbnbCode === 'INDEPENDENT_BOOKING') {
        // Pour les réservations indépendantes, chercher par property_id + guest_name + check_in_date
        const fullGuestName = `${primaryGuest.firstName} ${primaryGuest.lastName}`;
        const { data } = await supabase
          .from('bookings')
          .select('id')
          .eq('property_id', booking.propertyId)
          .eq('booking_reference', 'INDEPENDENT_BOOKING')
          .eq('guest_name', fullGuestName)
          .eq('check_in_date', booking.checkIn)
          .maybeSingle();
        existingBooking = data;
        
        if (existingBooking) {
          log('info', 'Réservation indépendante existante trouvée par guest_name + check_in_date', { 
            bookingId: existingBooking.id,
            guestName: fullGuestName,
            checkIn: booking.checkIn
          });
        }
      } else {
        // Pour les réservations Airbnb, utiliser property_id + booking_reference
        // ✅ CORRIGÉ : .order().limit(1) pour gérer les doublons existants
        const { data } = await supabase
          .from('bookings')
          .select('id')
          .eq('property_id', booking.propertyId)
          .eq('booking_reference', booking.airbnbCode)
          .order('updated_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        existingBooking = data;
      }
    }

    // ✅ CRITIQUE : Récupérer le user_id depuis la propriété pour éviter l'erreur NULL
    const { data: propertyData, error: propertyError } = await supabase
      .from('properties')
      .select('user_id')
      .eq('id', booking.propertyId)
      .single();

    if (propertyError || !propertyData || !propertyData.user_id) {
      log('error', 'Impossible de récupérer user_id de la propriété', { 
        error: propertyError,
        propertyId: booking.propertyId 
      });
      throw new Error(`user_id de la propriété introuvable: ${propertyError?.message || 'Propriété non trouvée'}`);
    }

    log('info', 'user_id récupéré depuis la propriété', { 
      userId: propertyData.user_id,
      propertyId: booking.propertyId 
    });

    let savedBooking;
    const bookingData = {
      property_id: booking.propertyId,
      user_id: propertyData.user_id, // ✅ AJOUTÉ : user_id récupéré depuis properties
      check_in_date: booking.checkIn,
      check_out_date: booking.checkOut,
      guest_name: `${primaryGuest.firstName} ${primaryGuest.lastName}`,
      number_of_guests: booking.numberOfGuests || 1,
      total_price: booking.totalPrice || null,
      booking_reference: booking.airbnbCode,
      guest_email: primaryGuest.email,
      guest_phone: primaryGuest.phone || null,
      status: 'pending',
      updated_at: new Date().toISOString()
    };

    // ✅ CORRIGÉ : Utiliser une approche atomique pour éviter les race conditions
    // Au lieu de vérifier puis créer/mettre à jour, utiliser un upsert avec gestion des erreurs
      if (existingBooking) {
        // Mettre à jour la réservation existante
        log('info', 'Mise à jour réservation existante avec nom du guest', { 
          bookingId: existingBooking.id,
          oldGuestName: 'Réservation existante',
          newGuestName: `${primaryGuest.firstName} ${primaryGuest.lastName}`,
          source: booking.bookingId ? 'bookingId' : 'booking_reference'
        });
        const { data, error: updateError } = await supabase
          .from('bookings')
          .update(bookingData)
          .eq('id', existingBooking.id)
          .select()
          .single();
        
        if (updateError || !data) {
          log('error', 'Échec mise à jour réservation', { error: updateError });
          throw new Error(`Erreur lors de la mise à jour de la réservation: ${updateError?.message}`);
        }
        savedBooking = data;
      
      log('info', '✅ Réservation mise à jour avec le nom du guest', {
        bookingId: existingBooking.id,
        finalGuestName: data.guest_name,
        guestEmail: data.guest_email
      });

      // ✅ CORRIGÉ : Synchroniser avec la table airbnb_reservations pour le calendrier
      // ⚠️ IMPORTANT : Toujours mettre à jour le guest_name, même si la réservation existait déjà
      // Cela évite que les anciens noms de guests persistent après suppression
      if (booking.airbnbCode && booking.airbnbCode !== 'INDEPENDENT_BOOKING') {
        log('info', '🔄 Synchronisation avec airbnb_reservations pour le calendrier', {
          airbnbCode: booking.airbnbCode,
          guestName: data.guest_name,
          propertyId: booking.propertyId
        });
        
        // ✅ NOUVEAU : Vérifier d'abord si la réservation existe dans airbnb_reservations
        const { data: existingAirbnbReservation, error: checkError } = await supabase
          .from('airbnb_reservations')
          .select('id, guest_name')
          .eq('airbnb_booking_id', booking.airbnbCode)
          .eq('property_id', booking.propertyId)
          .maybeSingle();
        
        if (checkError) {
          log('warn', '⚠️ Erreur lors de la vérification airbnb_reservations', { error: checkError });
        }
        
        // ✅ CORRIGÉ : Mettre à jour ou créer la réservation dans airbnb_reservations
        const updateData = {
          guest_name: data.guest_name, // ✅ TOUJOURS mettre à jour le nom, même si ancien nom existait
          summary: `Airbnb – ${data.guest_name}`,
          updated_at: new Date().toISOString()
        };
        
        if (existingAirbnbReservation) {
          // Mise à jour de la réservation existante
          const { error: airbnbUpdateError } = await supabase
            .from('airbnb_reservations')
            .update(updateData)
            .eq('id', existingAirbnbReservation.id);
          
          if (airbnbUpdateError) {
            log('error', '❌ Erreur synchronisation airbnb_reservations (mise à jour)', { 
              error: airbnbUpdateError,
              oldGuestName: existingAirbnbReservation.guest_name,
              newGuestName: data.guest_name
            });
          } else {
            log('info', '✅ Synchronisation airbnb_reservations réussie (mise à jour)', {
              oldGuestName: existingAirbnbReservation.guest_name,
              newGuestName: data.guest_name
            });
          }
        } else {
          // Créer une nouvelle réservation dans airbnb_reservations si elle n'existe pas
          // (peut arriver si la réservation a été supprimée puis recréée)
          log('info', '⚠️ Réservation non trouvée dans airbnb_reservations, création...', {
            airbnbCode: booking.airbnbCode,
            propertyId: booking.propertyId
          });
          
          const { error: airbnbInsertError } = await supabase
            .from('airbnb_reservations')
            .insert({
              airbnb_booking_id: booking.airbnbCode,
              property_id: booking.propertyId,
              guest_name: data.guest_name,
              summary: `Airbnb – ${data.guest_name}`,
              start_date: booking.checkInDate || new Date().toISOString(),
              end_date: booking.checkOutDate || new Date().toISOString(),
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            });
          
          if (airbnbInsertError) {
            log('error', '❌ Erreur création airbnb_reservations', { error: airbnbInsertError });
          } else {
            log('info', '✅ Réservation créée dans airbnb_reservations');
          }
        }
      }
    } else {
      // ✅ CORRIGÉ : Créer une nouvelle réservation avec gestion des doublons
      // Utiliser une approche atomique pour éviter les race conditions
      log('info', 'Création nouvelle réservation');
      const newBookingData = {
        ...bookingData,
        created_at: new Date().toISOString()
      };
      
      // ✅ FIX CRITIQUE : Vérifier à nouveau juste avant l'insertion pour éviter les doublons
      // ✅ CORRIGÉ : .order().limit(1) pour gérer les doublons existants
      // Pour les réservations Airbnb, booking_reference suffit car il est unique
      let lastCheckQuery = supabase
        .from('bookings')
        .select('id, status')
        .eq('property_id', booking.propertyId)
        .eq('booking_reference', booking.airbnbCode)
        .order('updated_at', { ascending: false })
        .limit(1);
      
      // ✅ FIX CRITIQUE : Pour les réservations indépendantes, ajouter les critères supplémentaires
      // Sinon TOUTES les réservations indépendantes de la même propriété seraient considérées comme doublons !
      if (booking.airbnbCode === 'INDEPENDENT_BOOKING') {
        lastCheckQuery = lastCheckQuery
          .eq('guest_name', bookingData.guest_name)
          .eq('check_in_date', booking.checkIn);
        log('info', '🔍 Vérification doublon pour réservation indépendante', {
          propertyId: booking.propertyId,
          guestName: bookingData.guest_name,
          checkIn: booking.checkIn
        });
      }
      
      const lastCheck = await lastCheckQuery.maybeSingle();
      
      if (lastCheck.data) {
        // Une réservation IDENTIQUE a été créée entre-temps, utiliser celle-ci
        log('warn', 'Réservation créée entre-temps (race condition évitée)', { 
          bookingId: lastCheck.data.id,
          status: lastCheck.data.status,
          isIndependent: booking.airbnbCode === 'INDEPENDENT_BOOKING'
        });
        const foundBooking = lastCheck.data;
        // Revenir à la logique de mise à jour
        const { data: updateData, error: updateError } = await supabase
          .from('bookings')
          .update(bookingData)
          .eq('id', foundBooking.id)
          .select()
          .single();
        
        if (updateError || !updateData) {
          log('error', 'Échec mise à jour réservation (après détection race condition)', { error: updateError });
          throw new Error(`Erreur lors de la mise à jour de la réservation: ${updateError?.message}`);
        }
        savedBooking = updateData;
      } else {
        // Pas de doublon, créer la réservation
        log('info', '✅ Aucun doublon détecté, création de la nouvelle réservation', {
          propertyId: booking.propertyId,
          airbnbCode: booking.airbnbCode,
          guestName: bookingData.guest_name,
          checkIn: booking.checkIn
        });
        
        const { data, error: insertError } = await supabase
          .from('bookings')
          .insert(newBookingData)
          .select()
          .single();
      
        if (insertError) {
          // ✅ CORRIGÉ : Si erreur de contrainte unique (doublon), récupérer la réservation existante
          if (insertError.code === '23505') { // Unique constraint violation
            log('warn', 'Violation contrainte unique détectée (doublon évité)', { error: insertError });
            
            // Récupérer la réservation existante avec les MÊMES critères
            // ✅ CORRIGÉ : .order().limit(1) pour gérer les doublons existants
            let existingQuery = supabase
              .from('bookings')
              .select('id')
              .eq('property_id', booking.propertyId)
              .eq('booking_reference', booking.airbnbCode)
              .order('updated_at', { ascending: false })
              .limit(1);
            
            // ✅ FIX CRITIQUE : Pour les réservations indépendantes, ajouter les critères supplémentaires
            if (booking.airbnbCode === 'INDEPENDENT_BOOKING') {
              existingQuery = existingQuery
                .eq('guest_name', bookingData.guest_name)
                .eq('check_in_date', booking.checkIn);
            }
            
            const { data: existingData } = await existingQuery.maybeSingle();
            
            if (existingData) {
              // Mettre à jour la réservation existante
              const { data: updateData, error: updateError } = await supabase
                .from('bookings')
                .update(bookingData)
                .eq('id', existingData.id)
                .select()
                .single();
              
              if (updateError || !updateData) {
                log('error', 'Échec mise à jour après détection doublon', { error: updateError });
                throw new Error(`Erreur lors de la mise à jour de la réservation: ${updateError?.message}`);
              }
              savedBooking = updateData;
              log('info', '✅ Réservation existante mise à jour après détection doublon', { bookingId: existingData.id });
            } else {
              throw new Error(`Erreur lors de la création de la réservation: ${insertError.message}`);
            }
          } else {
            log('error', 'Échec création réservation', { error: insertError });
            throw new Error(`Erreur lors de la création de la réservation: ${insertError.message}`);
          }
        } else if (!data) {
          throw new Error('Erreur lors de la création de la réservation: Aucune donnée retournée');
        } else {
          savedBooking = data;
          log('info', '✅ Nouvelle réservation créée avec succès', { 
            bookingId: data.id,
            propertyId: data.property_id,
            guestName: data.guest_name
          });
        }
      }
      
      // ✅ CORRIGÉ : Synchroniser avec la table airbnb_reservations pour le calendrier (nouvelle réservation)
      // ⚠️ IMPORTANT : Toujours mettre à jour le guest_name, même si la réservation existait déjà
      // Cela évite que les anciens noms de guests persistent après suppression
      if (booking.airbnbCode && booking.airbnbCode !== 'INDEPENDENT_BOOKING' && savedBooking) {
        log('info', '🔄 Synchronisation airbnb_reservations pour nouvelle réservation', {
          airbnbCode: booking.airbnbCode,
          guestName: savedBooking.guest_name,
          propertyId: booking.propertyId
        });
        
        // ✅ NOUVEAU : Vérifier d'abord si la réservation existe dans airbnb_reservations
        const { data: existingAirbnbReservation, error: checkError } = await supabase
          .from('airbnb_reservations')
          .select('id, guest_name')
          .eq('airbnb_booking_id', booking.airbnbCode)
          .eq('property_id', booking.propertyId)
          .maybeSingle();
        
        if (checkError) {
          log('warn', '⚠️ Erreur lors de la vérification airbnb_reservations', { error: checkError });
        }
        
        // ✅ CORRIGÉ : Mettre à jour ou créer la réservation dans airbnb_reservations
        const updateData = {
          guest_name: savedBooking.guest_name, // ✅ TOUJOURS mettre à jour le nom, même si ancien nom existait
          summary: `Airbnb – ${savedBooking.guest_name}`,
          updated_at: new Date().toISOString()
        };
        
        if (existingAirbnbReservation) {
          // Mise à jour de la réservation existante (peut arriver si réservation supprimée puis recréée)
          const { error: airbnbUpdateError } = await supabase
            .from('airbnb_reservations')
            .update(updateData)
            .eq('id', existingAirbnbReservation.id);
          
          if (airbnbUpdateError) {
            log('error', '❌ Erreur synchronisation airbnb_reservations (mise à jour nouvelle réservation)', { 
              error: airbnbUpdateError,
              oldGuestName: existingAirbnbReservation.guest_name,
              newGuestName: savedBooking.guest_name
            });
          } else {
            log('info', '✅ Synchronisation airbnb_reservations réussie (mise à jour nouvelle réservation)', {
              oldGuestName: existingAirbnbReservation.guest_name,
              newGuestName: savedBooking.guest_name
            });
          }
        } else {
          // Créer une nouvelle réservation dans airbnb_reservations
          const { error: airbnbInsertError } = await supabase
            .from('airbnb_reservations')
            .insert({
              airbnb_booking_id: booking.airbnbCode,
              property_id: booking.propertyId,
              guest_name: savedBooking.guest_name,
              summary: `Airbnb – ${savedBooking.guest_name}`,
              start_date: booking.checkInDate || new Date().toISOString(),
              end_date: booking.checkOutDate || new Date().toISOString(),
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            });
          
          if (airbnbInsertError) {
            log('error', '❌ Erreur création airbnb_reservations (nouvelle réservation)', { error: airbnbInsertError });
          } else {
            log('info', '✅ Réservation créée dans airbnb_reservations (nouvelle réservation)');
          }
        }
      }
    }

    const bookingId = savedBooking.id;
    log('info', 'Réservation sauvegardée', { bookingId });

    // 2. Sauvegarde des informations invité avec données complètes
    log('info', 'Sauvegarde des informations invité', { count: guestInfos.length });
    const effectiveMaxGuests = Math.max(booking.numberOfGuests || 1, guestInfos.length);

    for (let gi = 0; gi < guestInfos.length; gi++) {
      await (async () => {
        const sanitizedGuest = sanitizeGuestInfo(guestInfos[gi]);
    // ✅ Validation et conversion de dateOfBirth
    let processedDateOfBirth = null;
    if (sanitizedGuest.dateOfBirth) {
      try {
        const dateObj = new Date(sanitizedGuest.dateOfBirth);
        if (!isNaN(dateObj.getTime())) {
          processedDateOfBirth = dateObj.toISOString().split('T')[0];
        } else {
          log('warn', 'Date de naissance invalide', { 
            originalDate: sanitizedGuest.dateOfBirth,
            parsedDate: dateObj.toString()
          });
        }
      } catch (e) {
        log('warn', 'Erreur conversion date de naissance', { 
          originalDate: sanitizedGuest.dateOfBirth,
          error: e.message
        });
      }
    }

    // ✅ CRITIQUE : Sauvegarder TOUTES les données du guest pour la variabilisation complète
    // ❌ IMPORTANT : La table 'guests' n'a PAS de colonne 'email' - l'email est dans bookings.guest_email
    const guestData: any = {
      booking_id: bookingId,
      full_name: `${sanitizedGuest.firstName} ${sanitizedGuest.lastName}`,
      nationality: sanitizedGuest.nationality || 'Non spécifiée',
      document_type: sanitizedGuest.idType || 'passport',
      document_number: sanitizedGuest.idNumber || '',
      date_of_birth: processedDateOfBirth,
      document_issue_date: sanitizedGuest.documentIssueDate || null, // ✅ Date d'expiration du document
      phone: sanitizedGuest.phone || null,
      // ✅ CRITIQUE : Ajouter tous les champs pour la variabilisation complète
      place_of_birth: '', // Non disponible dans GuestInfo pour l'instant
      profession: sanitizedGuest.profession || '',
      motif_sejour: sanitizedGuest.motifSejour || 'TOURISME',
      adresse_personnelle: sanitizedGuest.adressePersonnelle || '',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    
    // ❌ SUPPRIMÉ : Ne PAS ajouter email - la colonne n'existe pas dans la table 'guests'
    // L'email est stocké dans bookings.guest_email et récupéré via la relation
    
    log('info', 'Sauvegarde données invité', {
      guestName: guestData.full_name,
      dateOfBirth: guestData.date_of_birth,
      originalDateOfBirth: sanitizedGuest.dateOfBirth,
      hasDateOfBirth: !!guestData.date_of_birth,
      processedDateOfBirth,
      // ✅ DIAGNOSTIC : L'email est dans booking, pas dans guestData (table guests n'a pas de colonne email)
      bookingEmail: booking.guestEmail || sanitizedGuest.email,
      phone: guestData.phone,
      hasPhone: !!guestData.phone
    });

    // ✅ CORRECTION : Vérifier si l'invité existe déjà pour éviter les doublons
    const { data: existingGuest } = await supabase
      .from('guests')
      .select('id')
      .eq('booking_id', bookingId)
      .eq('full_name', guestData.full_name)
      .eq('document_number', guestData.document_number)
      .single();

    // ✅ Récupérer le nombre d'invités déjà associés à la réservation
    const { data: existingGuestsForBooking } = await supabase
      .from('guests')
      .select('id')
      .eq('booking_id', bookingId);

    const maxGuests = effectiveMaxGuests;

    // ✅ CORRECTION MAJEURE : Logique améliorée pour éviter l'écrasement
    // L'identification d'un guest se fait par: booking_id + (full_name OU document_number)
    
    if (maxGuests === 1) {
      // Cas réservation pour 1 invité: on met à jour l'unique ligne au lieu d'insérer
      if (existingGuest && existingGuest.id) {
        // ✅ Guest trouvé avec même nom ET document - mise à jour
        const updateData: any = {
          full_name: guestData.full_name,
          nationality: guestData.nationality,
          document_type: guestData.document_type,
          document_number: guestData.document_number,
          date_of_birth: guestData.date_of_birth,
          document_issue_date: guestData.document_issue_date, // ✅ Date d'expiration du document
          phone: guestData.phone,
          place_of_birth: guestData.place_of_birth,
          profession: guestData.profession,
          motif_sejour: guestData.motif_sejour,
          adresse_personnelle: guestData.adresse_personnelle,
          updated_at: new Date().toISOString()
        };
        // ❌ Ne PAS ajouter email - colonne inexistante
        
        const { error: updateErr } = await supabase
          .from('guests')
          .update(updateData)
          .eq('id', existingGuest.id);
        if (updateErr) {
          log('warn', 'Avertissement mise à jour invité (single booking)', { error: updateErr });
        } else {
          log('info', 'Invité mis à jour (single booking)', { guestId: existingGuest.id });
        }
      } else if (Array.isArray(existingGuestsForBooking) && existingGuestsForBooking.length > 0) {
        // ✅ CORRECTION : Vérifier si c'est le MÊME guest (par document_number) avant d'écraser
        // Si document_number différent, c'est un NOUVEAU guest qui remplace l'ancien
        const firstGuestId = existingGuestsForBooking[0].id;
        
        // Récupérer les détails du guest existant pour comparaison
        const { data: existingGuestDetails } = await supabase
          .from('guests')
          .select('full_name, document_number')
          .eq('id', firstGuestId)
          .single();
        
        const isSameGuest = existingGuestDetails && (
          existingGuestDetails.document_number === guestData.document_number ||
          existingGuestDetails.full_name === guestData.full_name
        );
        
        if (isSameGuest) {
          // Même guest - mise à jour
          const updateData: any = {
            full_name: guestData.full_name,
            nationality: guestData.nationality,
            document_type: guestData.document_type,
            document_number: guestData.document_number,
            date_of_birth: guestData.date_of_birth,
            document_issue_date: guestData.document_issue_date, // ✅ Date d'expiration du document
            phone: guestData.phone,
            place_of_birth: guestData.place_of_birth,
            profession: guestData.profession,
            motif_sejour: guestData.motif_sejour,
            adresse_personnelle: guestData.adresse_personnelle,
            updated_at: new Date().toISOString()
          };
          
          const { error: updateErr } = await supabase
            .from('guests')
            .update(updateData)
            .eq('id', firstGuestId);
          if (updateErr) {
            log('warn', 'Avertissement mise à jour invité existant (single booking)', { error: updateErr });
          } else {
            log('info', 'Invité existant mis à jour (single booking)', { guestId: firstGuestId });
          }
        } else {
          // ✅ NOUVEAU guest différent - supprimer l'ancien et créer le nouveau
          log('info', 'Nouveau guest différent détecté, remplacement', {
            oldGuest: existingGuestDetails?.full_name,
            newGuest: guestData.full_name
          });
          
          // Supprimer l'ancien guest
          await supabase.from('guests').delete().eq('id', firstGuestId);
          
          // Insérer le nouveau
          const { error: guestError } = await supabase
            .from('guests')
            .insert(guestData);
          if (guestError) {
            log('warn', 'Avertissement sauvegarde nouveau invité (single booking)', { error: guestError });
          } else {
            log('info', 'Nouveau invité sauvegardé (single booking)');
          }
        }
      } else {
        // Aucune ligne existante: insérer l'unique invité
        const { error: guestError } = await supabase
          .from('guests')
          .insert(guestData);
        if (guestError) {
          log('warn', 'Avertissement sauvegarde invité (single booking)', { error: guestError });
        } else {
          log('info', 'Informations invité sauvegardées (single booking)');
        }
      }
    } else {
      // ✅ Réservations multi-invités: chaque guest est identifié par document_number
      if (existingGuest) {
        // Guest avec même nom ET document existe - mise à jour
        const updateData: any = {
          full_name: guestData.full_name,
          nationality: guestData.nationality,
          document_type: guestData.document_type,
          document_number: guestData.document_number,
          date_of_birth: guestData.date_of_birth,
          document_issue_date: guestData.document_issue_date, // ✅ Date d'expiration du document
          phone: guestData.phone,
          place_of_birth: guestData.place_of_birth,
          profession: guestData.profession,
          motif_sejour: guestData.motif_sejour,
          adresse_personnelle: guestData.adresse_personnelle,
          updated_at: new Date().toISOString()
        };
        
        const { error: updateErr } = await supabase
          .from('guests')
          .update(updateData)
          .eq('id', existingGuest.id);
        if (updateErr) {
          log('warn', 'Avertissement mise à jour invité (multi booking)', { error: updateErr });
        } else {
          log('info', 'Invité mis à jour (multi booking)', { guestId: existingGuest.id });
        }
      } else {
        // Vérifier si un guest avec le même document_number existe déjà
        const { data: guestByDoc } = await supabase
          .from('guests')
          .select('id')
          .eq('booking_id', bookingId)
          .eq('document_number', guestData.document_number)
          .maybeSingle();
        
        if (guestByDoc) {
          // Guest avec même document existe - mise à jour (peut-être changement de nom)
          log('info', 'Guest trouvé par document_number, mise à jour', { guestId: guestByDoc.id });
          const { error: updateErr } = await supabase
            .from('guests')
            .update({
              ...guestData,
              updated_at: new Date().toISOString()
            })
            .eq('id', guestByDoc.id);
          if (updateErr) {
            log('warn', 'Erreur mise à jour guest par document', { error: updateErr });
          }
        } else {
          // Nouveau guest - vérifier la limite
          const currentCount = Array.isArray(existingGuestsForBooking) ? existingGuestsForBooking.length : 0;
          if (currentCount >= maxGuests) {
            log('warn', 'Nombre maximum d\'invités atteint pour la réservation, insertion ignorée', {
              bookingId,
              maxGuests,
              currentCount
            });
          } else {
            const { error: guestError } = await supabase
              .from('guests')
              .insert(guestData);
            if (guestError) {
              log('warn', 'Avertissement sauvegarde invité (multi booking)', { error: guestError });
            } else {
              log('info', 'Informations invité sauvegardées (multi booking)');
            }
          }
        }
      }
    }

      })();
    }

    // 3. Sauvegarde des documents d'identité avec métadonnées
    log('info', 'Sauvegarde des documents d\'identité', {
      documentsCount: idDocuments.length,
      documents: idDocuments.map(d => ({ name: d.name, type: d.type, url: d.url.substring(0, 50) + '...' }))
    });
    
    // ✅ CORRECTION : Sauvegarder les documents d'identité seulement s'il y en a
    if (idDocuments.length > 0) {
      log('info', 'Traitement des documents d\'identité', { 
        documentsCount: idDocuments.length,
        documents: idDocuments.map(d => ({ name: d.name, type: d.type }))
      });
      
      const documentResults = await Promise.allSettled(
        idDocuments.map(async (doc, index) => {
        // ✅ CORRECTION : Utiliser la fonction unifiée saveDocumentToDatabase
        try {
          // Si c'est une data: URL, la convertir en bytes et uploader vers Storage
          let documentUrl = doc.url;
          let fileBytes: Uint8Array | null = null;
          
          if (doc.url.startsWith('data:')) {
            log('info', `Converting data URL to Storage for document ${index + 1}`);
            const base64Data = doc.url.split(',')[1];
            fileBytes = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
            
            // Upload vers Storage avec le bon chemin
            // ✅ Déterminer l'extension du fichier depuis le type MIME
            let extension = 'pdf';
            if (doc.type.includes('jpeg') || doc.type.includes('jpg')) {
              extension = 'jpg';
            } else if (doc.type.includes('png')) {
              extension = 'png';
            } else if (doc.type.includes('pdf')) {
              extension = 'pdf';
            }
            
            const fileName = `identity-scan-${bookingId}-${index + 1}-${Date.now()}.${extension}`;
            const storagePath = `identity/${bookingId}/${fileName}`;
            
            log('info', `Uploading identity document ${index + 1}:`, { 
              fileName, 
              type: doc.type, 
              extension,
              size: fileBytes.length 
            });
            
            const { error: uploadError } = await supabase.storage
              .from('guest-documents')
              .upload(storagePath, fileBytes, {
                contentType: doc.type || 'application/pdf',
                upsert: true
              });
              
            if (uploadError) {
              log('error', `Upload error for document ${index + 1}:`, uploadError);
              throw new Error(`Upload failed: ${uploadError.message}`);
            }
            
            // Obtenir l'URL publique
            const { data: { publicUrl } } = supabase.storage
              .from('guest-documents')
              .getPublicUrl(storagePath);
              
            documentUrl = publicUrl;
            log('info', `✅ Document ${index + 1} uploaded to Storage successfully:`, { publicUrl });
          } else if (doc.url.startsWith('blob:')) {
            // ❌ Rejeter les blob URLs
            log('error', `Document ${index + 1} has invalid blob URL:`, doc.url);
            throw new Error('Blob URLs are not supported. Please refresh and try again.');
          } else {
            log('info', `Document ${index + 1} already has HTTP URL:`, doc.url);
          }
          
          // ✅ CORRIGÉ : Vérification robuste pour éviter les doublons
          // Vérifier par file_name ET document_url pour être plus précis
          const fileNameToCheck = `identity-scan-${bookingId}-${index + 1}`;
          
          // Vérifier si un document existe déjà pour ce booking avec le même nom OU la même URL
          const { data: existingDocs } = await supabase
            .from('uploaded_documents')
            .select('id, file_name, document_url')
            .eq('booking_id', bookingId)
            .eq('document_type', 'identity')
            .or(`file_name.eq.${fileNameToCheck},document_url.eq.${documentUrl}`);

          // ✅ CORRIGÉ : Vérifier si un document similaire existe déjà
          // (même nom de fichier OU même URL)
          const existingDoc = existingDocs && existingDocs.length > 0 
            ? existingDocs.find(doc => 
                doc.file_name === fileNameToCheck || 
                doc.document_url === documentUrl
              )
            : null;

          if (existingDoc) {
            log('info', `Document d'identité déjà existant, pas de doublon créé`, {
              existingDocId: existingDoc.id,
              existingFileName: existingDoc.file_name,
              existingUrl: existingDoc.document_url?.substring(0, 50) + '...'
            });
            
            // ✅ Mettre à jour l'URL si elle a changé (par exemple, data: URL → Storage URL)
            if (existingDoc.document_url !== documentUrl && documentUrl && !documentUrl.startsWith('data:')) {
              log('info', 'Mise à jour de l\'URL du document existant');
              const { error: updateError } = await supabase
                .from('uploaded_documents')
                .update({
                  document_url: documentUrl,
                  updated_at: new Date().toISOString()
                })
                .eq('id', existingDoc.id);
              
              if (updateError) {
                log('warn', 'Erreur lors de la mise à jour de l\'URL du document', { error: updateError });
              }
            }
          } else {
            // ✅ CORRIGÉ : Vérifier aussi par file_path si disponible (pour les documents uploadés via Storage)
            const storagePathMatch = documentUrl.match(/identity\/([^\/]+)\/(.+)$/);
            if (storagePathMatch) {
              const [, bookingIdFromUrl, fileNameFromPath] = storagePathMatch;
              const { data: existingByPath } = await supabase
            .from('uploaded_documents')
            .select('id')
            .eq('booking_id', bookingId)
            .eq('document_type', 'identity')
                .eq('file_path', `identity/${bookingIdFromUrl}/${fileNameFromPath}`)
            .maybeSingle();

              if (existingByPath) {
                log('info', `Document d'identité déjà existant par file_path, pas de doublon créé`);
          } else {
                // ✅ Sauvegarder le document seulement s'il n'existe pas
            const { error: uploadDocError } = await supabase
              .from('uploaded_documents')
              .insert({
                booking_id: bookingId,
                document_type: 'identity',
                document_url: documentUrl,
                    file_name: fileNameToCheck,
                    file_path: storagePathMatch ? `identity/${bookingIdFromUrl}/${fileNameFromPath}` : null,
                processing_status: 'completed',
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
              });
            
            if (uploadDocError) {
                  // ✅ CORRIGÉ : Si erreur de contrainte unique, c'est probablement un doublon
                  if (uploadDocError.code === '23505' || uploadDocError.message.includes('duplicate') || uploadDocError.message.includes('unique')) {
                    log('warn', `Document d'identité déjà existant (contrainte unique), ignoré`);
                  } else {
              log('error', `Failed to save identity document to uploaded_documents:`, uploadDocError);
              throw new Error(`Database save failed: ${uploadDocError.message}`);
            }
                } else {
                  log('info', `✅ Document ${index + 1} saved to uploaded_documents successfully`);
                }
              }
            } else {
              // ✅ Sauvegarder le document seulement s'il n'existe pas
              const { error: uploadDocError } = await supabase
                .from('uploaded_documents')
                .insert({
                  booking_id: bookingId,
                  document_type: 'identity',
                  document_url: documentUrl,
                  file_name: fileNameToCheck,
                  file_path: null,
                  processing_status: 'completed',
                  created_at: new Date().toISOString(),
                  updated_at: new Date().toISOString()
                });
              
              if (uploadDocError) {
                // ✅ CORRIGÉ : Si erreur de contrainte unique, c'est probablement un doublon
                if (uploadDocError.code === '23505' || uploadDocError.message.includes('duplicate') || uploadDocError.message.includes('unique')) {
                  log('warn', `Document d'identité déjà existant (contrainte unique), ignoré`);
                } else {
                  log('error', `Failed to save identity document to uploaded_documents:`, uploadDocError);
                  throw new Error(`Database save failed: ${uploadDocError.message}`);
                }
              } else {
          log('info', `✅ Document ${index + 1} saved to uploaded_documents successfully`);
              }
            }
          }
          
          return { index: index + 1, name: doc.name, success: true };
        } catch (error) {
          throw new Error(`Document ${index + 1} (${doc.name}): ${error.message}`);
        }
        })
      );

      // Analyse des résultats de sauvegarde des documents
      const successfulDocs = documentResults.filter(result => result.status === 'fulfilled').length;
      const failedDocs = documentResults.filter(result => result.status === 'rejected');

    log('info', 'Résultats sauvegarde documents', {
      total: idDocuments.length,
      success: successfulDocs,
      failed: failedDocs.length
    });

      if (failedDocs.length > 0) {
        log('warn', 'Certains documents ont échoué', {
          failedDocuments: failedDocs.map(result => 
            result.status === 'rejected' ? result.reason : 'Unknown error'
          )
        });
      }
    } else {
      log('info', 'Aucun document d\'identité à traiter');
    }

    // 4. Création/mise à jour de l'entrée guest_submissions pour le suivi complet
    // ✅ CORRECTION CRITIQUE : Utiliser upsert avec clé unique booking_id + document_number pour éviter les doublons
    log('info', 'Création/mise à jour de l\'entrée de suivi');
    
    // Trouver le token_id correspondant - on utilise le premier token actif pour cette propriété
    const { data: tokenData } = await supabase
      .from('property_verification_tokens')
      .select('id')
      .eq('property_id', booking.propertyId)
      .eq('is_active', true)
      .limit(1)
      .single();

    const guestsPayload = guestInfos.map((g) => {
      const s = sanitizeGuestInfo(g);
      const fn = `${s.firstName} ${s.lastName}`.trim().toUpperCase();
      const dn = (s.idNumber || '').trim().toUpperCase();
      return { ...s, fullName: fn, documentNumber: dn };
    });
    const submissionPrimary = guestsPayload[0];
    const fullName = submissionPrimary.fullName;
    const documentNumber = submissionPrimary.documentNumber;

    const { data: existingSubmission } = await supabase
      .from('guest_submissions')
      .select('id')
      .eq('booking_id', bookingId)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    const submissionData = {
      token_id: tokenData?.id || crypto.randomUUID(), // Fallback si pas de token trouvé
      booking_id: bookingId,
      booking_data: {
        checkIn: booking.checkIn,
        checkOut: booking.checkOut,
        propertyName: booking.propertyName,
        airbnbCode: booking.airbnbCode,
        numberOfGuests: booking.numberOfGuests,
        nightsCount: Math.ceil((new Date(booking.checkOut).getTime() - new Date(booking.checkIn).getTime()) / (1000 * 60 * 60 * 24))
      },
      guest_data: {
        guests: guestsPayload,
        ...submissionPrimary,
        fullName: fullName,
        documentNumber: documentNumber
      },
      document_urls: idDocuments.map(doc => doc.url),
      status: 'pending',
      submitted_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    let submissionError;
    if (existingSubmission) {
      // ✅ Mise à jour de la soumission existante
      log('info', '🔄 Mise à jour de la soumission existante', { 
        existingId: existingSubmission.id, 
        guestName: fullName 
      });
      const { error } = await supabase
        .from('guest_submissions')
        .update({
          ...submissionData,
          updated_at: new Date().toISOString()
        })
        .eq('id', existingSubmission.id);
      submissionError = error;
    } else {
      // ✅ Nouvelle soumission
      log('info', '➕ Création nouvelle soumission', { guestName: fullName });
      const { error } = await supabase
        .from('guest_submissions')
        .insert({
          id: crypto.randomUUID(),
          ...submissionData,
          created_at: new Date().toISOString()
        });
      submissionError = error;
    }

    if (submissionError) {
      log('warn', 'Avertissement sauvegarde submission', { error: submissionError });
      // Continuer, c'est pour le suivi seulement
    } else {
      log('info', existingSubmission ? 'Entrée de suivi mise à jour' : 'Entrée de suivi créée');
    }

    log('info', 'Sauvegarde des données terminée avec succès', { bookingId });
    return bookingId;

  }, 'Sauvegarde des données invité');
}

// ÉTAPE 3: Génération du contrat avec gestion d'erreur robuste (locale: fr | en | es pour traduction)
async function generateContractInternal(bookingId: string, signature?: SignatureData, options?: { locale?: string }): Promise<string> {
  const locale = options?.locale && ['fr', 'en', 'es'].includes(options.locale) ? options.locale : 'fr';
  log('info', 'ÉTAPE 3: Démarrage génération contrat', {
    bookingId,
    hasSignature: !!signature,
    locale
  });

  return await withRetry(async () => {
    const functionUrl = Deno.env.get('SUPABASE_URL');
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!functionUrl || !serviceKey) {
      throw new Error('Configuration Supabase manquante');
    }

    const supabaseClient = await getServerClient();

    log('info', 'Construction du contexte contrat');
    const ctx = await buildContractContext(supabaseClient, bookingId);
    log('info', 'Contexte contrat construit', {
      propertyName: ctx.property.name,
      guestsCount: ctx.guests.length,
      duration: ctx.booking.duration_human
    });

    log('info', 'Génération PDF avec pdf-lib');
    const pdfUrl = await generateContractPDF(supabaseClient, ctx, {
      guestSignatureData: signature?.data,
      guestSignedAt: signature?.timestamp,
      locale
    });

    // 3. Sauvegarder le document en base (signé ou non)
    const isSigned = !!signature;
    log('info', '💾 [CONTRACT] Sauvegarde du contrat en base', { 
      bookingId,
      isSigned,
      pdfUrlLength: pdfUrl?.length || 0
    });
    
    await saveDocumentToDatabase(supabaseClient, bookingId, 'contract', pdfUrl, isSigned);
    
    if (isSigned) {
      log('info', '✅ [CONTRACT] Contrat signé sauvegardé dans uploaded_documents et generated_documents');
    } else {
      log('info', '✅ [CONTRACT] Contrat non signé sauvegardé dans uploaded_documents et generated_documents');
    }

    log('info', '🎉 [CONTRACT] Contrat généré avec succès', { 
      pdfUrl: pdfUrl.substring(0, 80) + '...',
      isSigned,
      bookingId
    });
    return pdfUrl;

  }, 'Génération contrat');
}

// ÉTAPE 4: Génération de la fiche de police avec gestion d'erreur
async function generatePoliceFormsInternal(bookingId: string, signature?: SignatureData): Promise<string> {
  log('info', 'ÉTAPE 4: Démarrage génération fiche de police', { 
    bookingId,
    hasSignature: !!signature  // ✅ CORRECTION : Même signature que le contrat
  });

  return await withRetry(async () => {
    const supabaseClient = await getServerClient();

    // 1. Récupérer les données du booking depuis la base
    log('info', 'Construction du contexte fiche de police');
    const { data: booking, error } = await supabaseClient
      .from('bookings')
      .select(`
        *,
        property:properties(*),
        guests(*)
      `)
      .eq('id', bookingId)
      .single();

    if (error) {
      log('error', 'Erreur récupération booking pour police', { error });
      throw new Error(`Erreur base de données: ${error.message}`);
    }

    if (!booking) {
      throw new Error('Booking non trouvé');
    }
    
    // ✅ DIAGNOSTIC : Log détaillé de la réponse de la requête
    log('info', '[Police] Booking récupéré depuis DB:', {
      bookingId: booking.id,
      hasProperty: !!booking.property,
      guestsCount: Array.isArray(booking.guests) ? booking.guests.length : 0,
      guestsIsArray: Array.isArray(booking.guests),
      guestsType: typeof booking.guests,
      guestsValue: booking.guests,
      allBookingKeys: Object.keys(booking || {})
    });
    
    // ✅ CORRECTION : Récupérer la signature depuis la base si non fournie en paramètre
    let guestSignature = signature?.data || null;
    let guestSignedAt = signature?.timestamp || null;
    
    // Si pas de signature en paramètre, chercher dans contract_signatures
    if (!guestSignature) {
      log('info', '[Police] Pas de signature en paramètre, recherche dans contract_signatures...');
      
      const { data: signatures, error: signatureError } = await supabaseClient
        .from('contract_signatures')
        .select('signature_data, signed_at, signer_name, signer_email')
        .eq('booking_id', bookingId)
        .order('created_at', { ascending: false });
      
      if (signatures && signatures.length > 0) {
        // ✅ CORRECTION : Prendre la première signature (la plus récente)
        // car signer_name est toujours "Guest", on ne peut pas matcher par nom
        // On peut matcher par email si nécessaire
        
        const guestEmail = booking?.guest_email?.toLowerCase();
        
        // Chercher une signature qui match l'email du guest
        const matchedSignature = guestEmail 
          ? signatures.find((sig: any) => 
              sig.signer_email && 
              sig.signer_email.toLowerCase() === guestEmail
            )
          : null;
        
        // Si on trouve une signature matchant l'email, on la prend
        // Sinon, on prend la première signature (fallback)
        const signatureToUse = matchedSignature || signatures[0];
        
        if (signatureToUse) {
          guestSignature = signatureToUse.signature_data;
          guestSignedAt = signatureToUse.signed_at;
          
          log('info', '[Police] ✅ Signature guest trouvée dans contract_signatures', {
            signerName: signatureToUse.signer_name,
            signerEmail: signatureToUse.signer_email,
            matchMethod: matchedSignature ? 'email' : 'fallback_first',
            signaturesCount: signatures.length
          });
        }
      } else {
        log('info', '[Police] Aucune signature trouvée dans contract_signatures', {
          bookingId,
          signaturesCount: signatures?.length || 0
        });
      }
      
      if (signatureError) {
        log('warn', '[Police] Erreur recherche signatures', { error: signatureError.message });
      }
    }

    log('info', '[Police] Signature guest (finale):', {
      hasSignature: !!guestSignature,
      signatureLength: guestSignature?.length || 0,
      signedAt: guestSignedAt || 'N/A',
      source: signature?.data ? 'parametre' : 'database'
    });
    
    // ✅ SIMPLIFICATION : Récupération directe depuis la table guests
    let guests = Array.isArray(booking.guests) ? booking.guests : [];
    
    if (!guests.length) {
      log('warn', '[Police] Aucun guest dans booking.guests, tentative récupération depuis table guests');
      const { data: guestsData, error: guestsError } = await supabaseClient
        .from('guests')
        .select('*')
        .eq('booking_id', bookingId);
      
      if (guestsError) {
        log('error', '[Police] Erreur récupération guests', { error: guestsError });
      } else if (guestsData && guestsData.length > 0) {
        guests = guestsData;
        log('info', '[Police] Guests récupérés depuis table', { count: guests.length });
      }
    }
    
  // ✅ CRITIQUE : Fallback - Récupérer d'abord depuis guest_submissions si disponible
  if (!guests.length) {
    log('warn', '[Police] Aucun guest trouvé, tentative récupération depuis guest_submissions');
    const { data: submissionsData, error: submissionsError } = await supabaseClient
      .from('guest_submissions')
      .select('*')
      .eq('booking_id', bookingId)
      .order('created_at', { ascending: false })
      .limit(1);
    
    if (!submissionsError && submissionsData && submissionsData.length > 0) {
      const submission = submissionsData[0];
      log('info', '[Police] Submission trouvée', {
        hasGuestData: !!submission.guest_data,
        guestDataType: typeof submission.guest_data
      });
      
      // ✅ CRITIQUE : Essayer de récupérer les guests depuis la soumission
      if (submission.guest_data && typeof submission.guest_data === 'object') {
        const guestData = submission.guest_data as any;
        
        // Essayer plusieurs formats possibles
        let guestsArray: any[] = [];
        
        if (guestData.guests && Array.isArray(guestData.guests)) {
          guestsArray = guestData.guests;
        } else if (Array.isArray(guestData)) {
          guestsArray = guestData;
        } else if (guestData.fullName || guestData.full_name) {
          // Format avec un seul guest directement dans guest_data
          guestsArray = [guestData];
        }
        
        if (guestsArray.length > 0) {
          guests = guestsArray.map((g: any) => {
            // ✅ CRITIQUE : Normaliser toutes les variantes de noms de champs
            const normalizedGuest = {
              full_name: g.fullName || g.full_name || g.name || '',
              email: g.email || booking.guest_email || null,
              phone: g.phone || booking.guest_phone || null,
              nationality: g.nationality || 'Non spécifiée',
              document_type: g.documentType || g.document_type || g.idType || 'passport',
              document_number: g.documentNumber || g.document_number || g.idNumber || g.document_number || '',
              date_of_birth: g.dateOfBirth || g.date_of_birth || g.dateOfBirth || null,
              document_issue_date: g.documentIssueDate || g.document_issue_date || null, // ✅ Date d'expiration du document
              place_of_birth: g.placeOfBirth || g.place_of_birth || '',
              profession: g.profession || '',
              motif_sejour: g.motifSejour || g.motif_sejour || 'TOURISME',
              adresse_personnelle: g.adressePersonnelle || g.adresse_personnelle || ''
            };
            
            log('info', '[Police] Guest normalisé depuis submission', {
              hasDateOfBirth: !!normalizedGuest.date_of_birth,
              hasDocumentNumber: !!normalizedGuest.document_number,
              hasNationality: !!normalizedGuest.nationality && normalizedGuest.nationality !== 'Non spécifiée'
            });
            
            return normalizedGuest;
          });
          
          log('info', '[Police] ✅ Guests récupérés depuis guest_submissions', { 
            count: guests.length,
            firstGuest: guests[0] ? {
              name: guests[0].full_name,
              hasDateOfBirth: !!guests[0].date_of_birth,
              hasDocumentNumber: !!guests[0].document_number,
              nationality: guests[0].nationality
            } : null
          });
      } else {
          log('warn', '[Police] Aucun guest trouvé dans guest_data', { guestData });
        }
      } else {
        log('warn', '[Police] guest_data n\'est pas un objet valide', { 
          type: typeof submission.guest_data,
          value: submission.guest_data 
        });
      }
    }
  }
  
  // ✅ CRITIQUE : Fallback final - utiliser les données du booking si toujours pas de guests
  const hasGuestName = booking.guest_name && booking.guest_name.trim().length > 0;
  log('info', '[Police] Vérification fallback final guest', {
    hasGuests: guests.length > 0,
    hasGuestName: hasGuestName,
    guestName: booking.guest_name,
    guestEmail: booking.guest_email,
    guestPhone: booking.guest_phone
  });
  
  if (!guests.length && hasGuestName) {
    log('warn', '[Police] ⚠️ Création guest virtuel - DONNÉES INCOMPLÈTES - La fiche police ne sera pas entièrement variabilisée');
    guests = [{
      full_name: booking.guest_name.trim(),
      email: booking.guest_email || null,
      phone: booking.guest_phone || null,
      nationality: 'Non spécifiée',
      document_type: 'passport',
      document_number: '',
      date_of_birth: null,
      place_of_birth: '',
      profession: '',
      motif_sejour: 'TOURISME',
      adresse_personnelle: ''
    }];
    log('info', '[Police] ✅ Guest virtuel créé depuis booking (DONNÉES INCOMPLÈTES)', { 
      name: guests[0].full_name,
      email: guests[0].email,
      phone: guests[0].phone,
      warning: '⚠️ date_of_birth, nationality, document_number manquants - La fiche police ne sera pas entièrement variabilisée'
    });
  }
    
    log('info', '[Police] Guests finaux', {
      count: guests.length,
      hasGuests: guests.length > 0,
      firstGuest: guests[0] ? {
        name: guests[0].full_name,
        email: guests[0].email,
        phone: guests[0].phone
      } : null
    });

    // ✅ AJOUT : Récupérer le host profile pour avoir l'email et le téléphone
    let host: any = null;
    if (booking?.property?.user_id) {
      // 1. Récupérer le host profile
      // ✅ host_profiles n'a pas de colonne email - récupéré via auth.admin.getUserById plus bas
      const { data: hp } = await supabaseClient
        .from('host_profiles')
        .select(`
          id,
          full_name,
          first_name,
          last_name,
          phone
        `)
        .eq('id', booking.property.user_id)
        .maybeSingle();
      
      host = hp ?? null;
      
      // 2. ✅ NOUVEAU : Récupérer l'email depuis auth.users (email d'authentification)
      let authEmail: string | null = null;
      try {
        const { data: authUser } = await supabaseClient.auth.admin.getUserById(booking.property.user_id);
        if (authUser?.user?.email) {
          authEmail = authUser.user.email;
          log('info', '[Police] Auth email retrieved:', { email: authEmail });
        }
      } catch (authError) {
        log('warn', '[Police] Could not retrieve auth email:', { error: String(authError) });
      }
      
      // 3. Prioriser l'email d'authentification, puis host_profiles, puis contact_info
      const property = booking.property || {};
      const contactInfo = (property.contact_info as any) || {};
      const contractTemplate = (property.contract_template as any) || {};
      
      host = {
        ...(host || {}),
        email: authEmail || 
               contractTemplate.landlord_email || 
               (host?.email as string) || 
               contactInfo.email || 
               '',
        phone: contractTemplate.landlord_phone || 
               (host?.phone as string) || 
               contactInfo.phone || 
               ''
      };
      
      log('info', '[Police] Host profile loaded:', {
        hasHost: !!host,
        hasEmail: !!host?.email,
        hasPhone: !!host?.phone,
        emailSource: authEmail ? 'auth.users' : ((host?.email as string) ? 'host_profiles' : 'contact_info')
      });
    }

    // Attacher le host au booking pour la génération PDF
    booking.host = host;

    // 2. Validation des données invités (guests déjà récupérés ci-dessus)
    if (guests.length === 0) {
      log('error', '[Police] Aucun invité trouvé après toutes les tentatives', {
        bookingId,
        hasBooking: !!booking,
        bookingGuests: booking.guests
      });
      throw new Error('Aucun invité trouvé pour générer les fiches de police');
    }
    
    // ✅ DIAGNOSTIC : Log des données des guests récupérées depuis la DB
    log('info', '[Police] Guests récupérés depuis DB:', {
      guestsCount: guests.length,
      guestsData: guests.map((g: any) => ({
        id: g.id,
        full_name: g.full_name,
        email: g.email,
        phone: g.phone,
        hasEmail: !!g.email,
        hasPhone: !!g.phone,
        allKeys: Object.keys(g || {})
      }))
    });

    // ✅ VALIDATION ASSOUPLIE : Vérifier seulement que full_name est présent
    const invalidGuests = guests.filter((guest: any) => 
      !guest.full_name?.trim()
    );
    
    if (invalidGuests.length > 0) {
      throw new Error(`${invalidGuests.length} invité(s) n'ont pas de nom complet`);
    }
    
    // ✅ NOUVEAU : Vérifier les données manquantes mais ne pas bloquer
    const guestsWithMissingData = guests.filter((guest: any) =>
      !guest.document_number?.trim()
    );
    
    if (guestsWithMissingData.length > 0) {
      log('warn', `⚠️ ${guestsWithMissingData.length} invité(s) ont document_number manquant - Fiche générée avec données disponibles`, {
        guestsWithMissingData: guestsWithMissingData.map((g: any) => ({
          name: g.full_name,
          hasDocumentNumber: !!g.document_number
        }))
      });
    }

    log('info', `Génération fiches de police pour ${guests.length} invités validés`);

    // ✅ CORRECTION : S'assurer que booking.guests contient les guests récupérés
    booking.guests = guests;

    // ✅ DIAGNOSTIC DÉTAILLÉ AVANT GÉNÉRATION PDF
    log('info', '🔍 [POLICE] DIAGNOSTIC COMPLET AVANT GÉNÉRATION:', {
      hasGuestSignature: !!guestSignature,
      guestSignatureLength: guestSignature?.length || 0,
      guestSignaturePreview: guestSignature ? guestSignature.substring(0, 100) + '...' : 'NULL',
      guestSignatureFormat: guestSignature?.startsWith('data:image/') ? 'BASE64_IMAGE' : 
                             guestSignature?.startsWith('http') ? 'URL' : 'AUTRE_OU_NULL',
      hasGuestSignedAt: !!guestSignedAt,
      guestSignedAtValue: guestSignedAt || 'N/A',
      bookingId,
      guestsCount: guests?.length || 0
    });

    // 3. Générer le PDF des fiches de police
    log('info', '📄 [POLICE] Génération PDF des fiches de police');
    // ✅ NOUVEAU : Passer la signature du guest
    const policeUrl = await generatePoliceFormsPDF(supabaseClient, booking, false, guestSignature, guestSignedAt);
    log('info', '✅ [POLICE] PDF généré', { policeUrlLength: policeUrl?.length || 0 });
    
    // 4. Sauvegarder le document en base
    log('info', '💾 [POLICE] Sauvegarde de la fiche de police en base', { bookingId });
    await saveDocumentToDatabase(supabaseClient, bookingId, 'police', policeUrl);
    log('info', '✅ [POLICE] Fiche de police sauvegardée dans uploaded_documents et generated_documents');

    log('info', '🎉 [POLICE] Fiche de police générée avec succès', { 
      policeUrl: policeUrl.substring(0, 80) + '...',
      bookingId
    });
    return policeUrl;

  }, 'Génération fiche de police');
}

// ÉTAPE 5: Envoi de l'email avec gestion d'erreur
async function sendGuestContractInternal(
  guestInfo: GuestInfo, 
  booking: ResolvedBooking,
  contractUrl: string,
  policeUrl?: string
): Promise<boolean> {
  log('info', 'ÉTAPE 5: Démarrage envoi email', {
    to: guestInfo.email,
    hasContractUrl: !!contractUrl,
    hasPoliceUrl: !!policeUrl
  });

  return await withRetry(async () => {
    const functionUrl = Deno.env.get('SUPABASE_URL');
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!functionUrl || !serviceKey) {
      throw new Error('Configuration Supabase manquante');
    }

    const supabaseClient = await getServerClient();

    const emailData = {
      guestEmail: guestInfo.email,
      guestName: `${guestInfo.firstName} ${guestInfo.lastName}`,
      checkIn: booking.checkIn,
      checkOut: booking.checkOut,
      propertyName: booking.propertyName,
      propertyAddress: booking.propertyAddress || booking.propertyName,
      contractUrl: contractUrl,
      policeUrl: policeUrl,
      numberOfGuests: booking.numberOfGuests || 1,
      totalPrice: booking.totalPrice || null,
      currency: booking.currency || 'EUR'
    };

    log('info', 'Appel à send-guest-contract', { emailData });

    // ✅ CORRECTION : Utiliser supabase.functions.invoke() avec headers explicites pour l'authentification
    // Comme dans sync-documents, on passe explicitement les headers Authorization et apikey
    const { data: result, error: invokeError } = await supabaseClient.functions.invoke('send-guest-contract', {
      body: emailData,
      headers: {
        'Authorization': `Bearer ${serviceKey}`,
        'apikey': serviceKey
      }
    });

    if (invokeError) {
      let responseBody: unknown = null;
      try {
        const ctx = (invokeError as { context?: { json?: () => Promise<unknown> } }).context;
        if (ctx && typeof ctx.json === 'function') {
          responseBody = await ctx.json();
        }
      } catch (_) {
        // ignore
      }
      log('error', 'Erreur lors de l\'appel à send-guest-contract', {
        error: invokeError.message,
        errorDetails: invokeError,
        responseBody
      });
      const detail = responseBody && typeof responseBody === 'object' && responseBody !== null && 'error' in responseBody
        ? String((responseBody as { error?: unknown }).error)
        : invokeError.message;
      throw new Error(`Envoi email échoué: ${detail || 'Erreur inconnue'}`);
    }

    if (!result || !result.success) {
      log('error', 'Réponse d\'erreur de send-guest-contract', { result });
      throw new Error(`Envoi email échoué: ${result?.error || 'Erreur inconnue'}`);
    }

    log('info', 'Email envoyé avec succès');
    return true;

  }, 'Envoi email');
}

// Mise à jour du statut final avec métadonnées complètes
async function updateFinalStatus(
  bookingId: string,
  contractUrl: string,
  policeUrl: string,
  identityUrl: string,
  emailSent: boolean,
  hasSignature: boolean,
  processingTime: number
): Promise<void> {
  log('info', 'Mise à jour du statut final', {
    bookingId,
    hasContract: !!contractUrl,
    hasPolice: !!policeUrl,
    hasIdentity: !!identityUrl,
    emailSent,
    hasSignature,
    processingTime
  });

  try {
    const supabase = await getServerClient();
    
    // ✅ CORRECTION CRITIQUE : Récupérer d'abord documents_generated existant
    const { data: existingBooking } = await supabase
      .from('bookings')
      .select('documents_generated')
      .eq('id', bookingId)
      .single();
    
    const currentDocumentsGenerated = existingBooking?.documents_generated || {};
    
    // ✅ Construire le nouvel objet documents_generated avec les URLs
    const documentsGenerated = {
      ...currentDocumentsGenerated,
      contract: !!contractUrl,
      policeForm: !!policeUrl,
      identity: !!identityUrl,
      contractUrl: contractUrl || currentDocumentsGenerated.contractUrl,
      policeUrl: policeUrl || currentDocumentsGenerated.policeUrl,
      identityUrl: identityUrl || currentDocumentsGenerated.identityUrl,
      generatedAt: new Date().toISOString()
    };
    
    log('info', '📝 Mise à jour documents_generated', {
      documentsGenerated,
      hasContractUrl: !!documentsGenerated.contractUrl,
      hasPoliceUrl: !!documentsGenerated.policeUrl
    });
    
    // Only mark 'completed' when ALL required documents are present (contract + police).
    // Having just a signature is not enough – it means 'confirmed' at best.
    const hasAllDocs = !!documentsGenerated.contractUrl && !!documentsGenerated.policeUrl;
    const newStatus = hasAllDocs ? 'completed' : (hasSignature ? 'confirmed' : 'pending');
    const updateData = {
      status: newStatus,
      documents_generated: documentsGenerated,
      updated_at: new Date().toISOString()
    };

    const { error: updateError } = await supabase
      .from('bookings')
      .update(updateData)
      .eq('id', bookingId);
    
    if (updateError) {
      log('error', '❌ Erreur mise à jour statut et documents_generated', { error: updateError });
      throw updateError;
    } else {
      log('info', '✅ Statut final et documents_generated mis à jour avec succès', {
        contractUrl: documentsGenerated.contractUrl,
        policeUrl: documentsGenerated.policeUrl
      });
    }

    // Mise à jour de guest_submissions (sans colonnes qui n'existent pas)
    const submissionUpdate = {
      status: hasSignature ? 'completed' : 'contract_generated',
      updated_at: new Date().toISOString()
    };

    const { error: submissionError } = await supabase
      .from('guest_submissions')
      .update(submissionUpdate)
      .eq('booking_id', bookingId);

    if (submissionError) {
      log('warn', 'Avertissement mise à jour submission', { error: submissionError });
    }

  } catch (error) {
    log('warn', 'Erreur lors de la mise à jour du statut final', { error });
    // Ne pas échouer pour cette erreur non-critique
  }
}

// =====================================================
// FONCTION POUR RÉSERVATIONS INDÉPENDANTES
// =====================================================

async function createIndependentBooking(token: string, guestInfo: GuestInfo, bookingData?: { checkIn: string; checkOut: string; numberOfGuests: number }): Promise<ResolvedBooking> {
  log('info', 'Création d\'une réservation indépendante', {
    guestName: `${guestInfo.firstName} ${guestInfo.lastName}`,
    token: token.substring(0, 8) + '...'
  });

  return await withRetry(async () => {
    const supabase = await getServerClient();
    
    // 1. Récupérer les informations de la propriété depuis le token
    const { data: tokenData, error: tokenError } = await supabase
      .from('property_verification_tokens')
      .select(`
        property_id,
        properties!inner(
          id,
          name,
          address,
          city,
          country
        )
      `)
      .eq('token', token)
      .eq('is_active', true)
      .single();

    if (tokenError || !tokenData) {
      throw new Error('Token invalide ou expiré');
    }

    const property = tokenData.properties;
    
    // 2. Créer une réservation indépendante avec les dates fournies ou par défaut
    let checkIn: Date;
    let checkOut: Date;
    let numberOfGuests: number;
    
    if (bookingData) {
      // Utiliser les dates fournies par l'invité
      checkIn = new Date(bookingData.checkIn);
      checkOut = new Date(bookingData.checkOut);
      numberOfGuests = bookingData.numberOfGuests;
      log('info', 'Utilisation des dates fournies par l\'invité', {
        checkIn: bookingData.checkIn,
        checkOut: bookingData.checkOut,
        numberOfGuests: bookingData.numberOfGuests
      });
    } else {
      // Dates par défaut (fallback)
      const today = new Date();
      checkIn = new Date(today);
      checkIn.setDate(today.getDate() + 1); // Demain
      checkOut = new Date(checkIn);
      checkOut.setDate(checkIn.getDate() + 1); // 1 nuit par défaut
      numberOfGuests = 1;
      log('warn', 'Utilisation des dates par défaut (aucune date fournie)');
    }

    const booking: ResolvedBooking = {
      id: crypto.randomUUID(),
      propertyId: property.id, // ✅ CORRECTION : Ajouter le propertyId
      checkIn: checkIn.toISOString().split('T')[0],
      checkOut: checkOut.toISOString().split('T')[0],
      propertyName: property.name,
      status: 'pending',
      airbnbCode: 'INDEPENDENT_BOOKING',
      guestId: crypto.randomUUID(),
      guestName: `${guestInfo.firstName} ${guestInfo.lastName}`,
      guests: [{
        fullName: `${guestInfo.firstName} ${guestInfo.lastName}`,
        dateOfBirth: guestInfo.dateOfBirth ? new Date(guestInfo.dateOfBirth) : undefined,
        nationality: guestInfo.nationality || '',
        documentNumber: guestInfo.idNumber || '',
        documentType: (guestInfo.idType as 'passport' | 'national_id') || 'passport',
        profession: guestInfo.profession || '',
        motifSejour: guestInfo.motifSejour || 'TOURISME',
        adressePersonnelle: guestInfo.adressePersonnelle || '',
        email: guestInfo.email || ''
      }],
      property: {
        id: property.id,
        name: property.name,
        address: property.address,
        city: property.city,
        country: property.country
      },
      numberOfGuests: numberOfGuests,
      totalPrice: null
    };

    log('info', 'Réservation indépendante créée', {
      bookingId: booking.id,
      propertyName: booking.propertyName,
      guestName: booking.guestName,
      checkIn: booking.checkIn,
      checkOut: booking.checkOut
    });

    return booking;
  }, 'Création réservation indépendante');
}

// =====================================================
// FONCTION PRINCIPALE
// =====================================================

serve(async (req) => {
  const startTime = Date.now();
  
  log('info', '🚀 FONCTION UNIFIED DÉMARRÉE', {
    timestamp: new Date().toISOString(),
    method: req.method,
    url: req.url,
    userAgent: req.headers.get('user-agent')
  });

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    log('error', 'Méthode non autorisée', { method: req.method });
    return new Response(JSON.stringify({
      success: false,
      error: 'Seule la méthode POST est autorisée'
    }), {
      status: 405,
      headers: corsHeaders
    });
  }

  try {
    // 1. PARSING ET VALIDATION
    log('info', '📥 Parsing de la requête');
    const requestBody: any = await req.json();
    
    // ✅ NOUVELLE ACTION : save_host_signature (depuis dashboard hôte)
    if (requestBody.action === 'save_host_signature') {
      log('info', '🔄 Mode: Sauvegarde signature hôte');
      
      if (!requestBody.bookingId || !requestBody.hostSignatureData) {
        return new Response(JSON.stringify({
          success: false,
          error: 'bookingId et hostSignatureData requis'
        }), {
          status: 400,
          headers: corsHeaders
        });
      }
      
      // Sauvegarder la signature hôte
      const supabaseClient = await getServerClient();
      const { error } = await supabaseClient
        .from('host_signatures')
        .insert({
          booking_id: requestBody.bookingId,
          signature_data: requestBody.hostSignatureData,
          signer_name: requestBody.hostSignerName,
          signed_at: requestBody.signedAt
        });
      
      if (error) {
        throw new Error(`Erreur sauvegarde signature hôte: ${error.message}`);
      }
      
      return new Response(JSON.stringify({
        success: true,
        message: 'Signature hôte sauvegardée'
      }), {
        status: 200,
        headers: corsHeaders
      });
    }
    
    // ✅ NOUVELLE ACTION : resolve_booking_only (pour resolveBooking)
    if (requestBody.action === 'resolve_booking_only') {
      log('info', '🔄 Mode: Résolution de réservation uniquement');
      
      if (!requestBody.token || !requestBody.airbnbCode) {
        return new Response(JSON.stringify({
          success: false,
          error: 'token et airbnbCode requis'
        }), {
          status: 400,
          headers: corsHeaders
        });
      }
      
      try {
        // Résoudre la réservation
        const booking = await resolveBookingInternal(requestBody.token, requestBody.airbnbCode);
        
        return new Response(JSON.stringify({
          success: true,
          booking: booking
        }), {
          status: 200,
          headers: corsHeaders
        });
      } catch (error) {
        log('error', 'Erreur résolution réservation', { error: error.message });
        return new Response(JSON.stringify({
          success: false,
          error: error.message
        }), {
          status: 400,
          headers: corsHeaders
        });
      }
    }
    
    // ✅ NOUVELLE ACTION : generate_contract_preview & generate_police_preview (aperçu depuis wizard)
    if (requestBody.action === 'generate_contract_preview' || requestBody.action === 'generate_police_preview') {
      log('info', `🔄 Mode: Génération aperçu ${requestBody.action === 'generate_contract_preview' ? 'contrat' : 'police'}`);
      
      // ✅ VALIDATION DÉTAILLÉE
      if (!requestBody.is_preview) {
        log('error', 'is_preview manquant dans la requête');
        return new Response(JSON.stringify({
          success: false,
          error: 'is_preview requis pour l\'aperçu'
        }), {
          status: 400,
          headers: corsHeaders
        });
      }
      
      if (!requestBody.bookingData) {
        log('error', 'bookingData manquant dans la requête');
        return new Response(JSON.stringify({
          success: false,
          error: 'bookingData requis pour l\'aperçu'
        }), {
          status: 400,
          headers: corsHeaders
        });
      }
      
      if (!requestBody.guests || !Array.isArray(requestBody.guests) || requestBody.guests.length === 0) {
        log('error', 'guests manquant ou vide dans la requête', { guests: requestBody.guests });
        return new Response(JSON.stringify({
          success: false,
          error: 'guests requis et doit contenir au moins un invité'
        }), {
          status: 400,
          headers: corsHeaders
        });
      }

      try {
        const supabaseClient = await getServerClient();
        
        // ✅ VALIDATION propertyId
        if (!requestBody.bookingData.propertyId) {
          throw new Error('propertyId manquant dans bookingData');
        }
        
        log('info', '📋 Données reçues pour aperçu', {
          propertyId: requestBody.bookingData.propertyId,
          checkIn: requestBody.bookingData.checkIn,
          checkOut: requestBody.bookingData.checkOut,
          numberOfGuests: requestBody.bookingData.numberOfGuests,
          guestsCount: requestBody.guests.length
        });
        
        // ✅ Récupérer le user_id de la propriété (contrainte DB : user_id ne peut pas être NULL)
        const { data: propertyRow, error: propertyErr } = await supabaseClient
          .from('properties')
          .select('user_id')
          .eq('id', requestBody.bookingData.propertyId)
          .single();

        if (propertyErr || !propertyRow?.user_id) {
          log('error', 'Propriété introuvable ou sans user_id pour aperçu', { propertyId: requestBody.bookingData.propertyId, error: propertyErr?.message });
          throw new Error('Propriété introuvable ou sans propriétaire - impossible de générer l\'aperçu');
        }

        const propertyUserId = propertyRow.user_id as string;

        // ✅ Créer un booking temporaire EN BASE avec le service role key (contourne RLS)
        const tempBookingId = crypto.randomUUID();
        
        log('info', '📝 Création booking temporaire', { tempBookingId, propertyUserId: propertyUserId.substring(0, 8) + '...' });
        
        const { error: bookingError } = await supabaseClient
          .from('bookings')
          .insert({
            id: tempBookingId,
            property_id: requestBody.bookingData.propertyId,
            user_id: propertyUserId,
            check_in_date: requestBody.bookingData.checkIn,
            check_out_date: requestBody.bookingData.checkOut,
            number_of_guests: requestBody.bookingData.numberOfGuests,
            guest_name: requestBody.guests[0]?.fullName || 'Aperçu',
            status: 'pending',
            booking_reference: `PREVIEW-${Date.now()}`,
            is_preview: true
          });

        if (bookingError) {
          log('error', 'Erreur création booking temporaire', { error: bookingError.message, details: bookingError });
          throw new Error(`Erreur création booking temporaire: ${bookingError.message}`);
        }

        log('info', '✅ Booking temporaire créé côté Edge Function', { tempBookingId });

        // Créer les guests temporaires
        const guestsToInsert = requestBody.guests.map((guest: any) => ({
          booking_id: tempBookingId,
          full_name: guest.fullName,
          nationality: guest.nationality || 'Non spécifiée',
          document_type: guest.documentType || 'passport',
          document_number: guest.documentNumber || '',
          date_of_birth: guest.dateOfBirth || null,
          place_of_birth: guest.placeOfBirth || null
        }));

        const { error: guestsError } = await supabaseClient
          .from('guests')
          .insert(guestsToInsert);

        if (guestsError) {
          throw new Error(`Erreur création guests: ${guestsError.message}`);
        }

        log('info', '✅ Guests temporaires créés', { count: guestsToInsert.length });

        // Générer le document selon le type
        let documentUrl: string;
        try {
          if (requestBody.action === 'generate_contract_preview') {
            log('info', '📄 Génération contrat d\'aperçu...');
            documentUrl = await generateContractInternal(tempBookingId, null);
            log('info', '✅ Contrat d\'aperçu généré', { url: documentUrl });
          } else {
            log('info', '📄 Génération police d\'aperçu...');
            documentUrl = await generatePoliceFormsInternal(tempBookingId);
            log('info', '✅ Police d\'aperçu générée', { url: documentUrl });
          }
        } catch (genError) {
          log('error', 'Erreur lors de la génération du document', { 
            error: genError.message, 
            stack: genError.stack,
            tempBookingId 
          });
          // Nettoyer même en cas d'erreur
          try {
            await supabaseClient.from('guests').delete().eq('booking_id', tempBookingId);
            await supabaseClient.from('bookings').delete().eq('id', tempBookingId);
          } catch (cleanupError) {
            log('warn', 'Erreur lors du nettoyage', { error: cleanupError.message });
          }
          throw genError;
        }

        // ✅ Nettoyer le booking temporaire après génération réussie
        try {
          await supabaseClient.from('guests').delete().eq('booking_id', tempBookingId);
          await supabaseClient.from('bookings').delete().eq('id', tempBookingId);
          log('info', '🗑️ Booking temporaire nettoyé', { tempBookingId });
        } catch (cleanupError) {
          log('warn', 'Erreur lors du nettoyage (non bloquant)', { error: cleanupError.message });
        }

        return new Response(JSON.stringify({
          success: true,
          [requestBody.action === 'generate_contract_preview' ? 'contractUrl' : 'policeUrl']: documentUrl
        }), {
          status: 200,
          headers: corsHeaders
        });

      } catch (error) {
        log('error', '❌ Erreur génération aperçu', { 
          error: error.message, 
          stack: error.stack,
          action: requestBody.action,
          hasBookingData: !!requestBody.bookingData,
          hasGuests: !!requestBody.guests && Array.isArray(requestBody.guests)
        });
        return new Response(JSON.stringify({
          success: false,
          error: error.message || 'Erreur lors de la génération de l\'aperçu'
        }), {
          status: 500,
          headers: corsHeaders
        });
      }
    }
    
    // ✅ NOUVELLE ACTION : generate_contract_only (depuis dashboard hôte)
    if (requestBody.action === 'generate_contract_only') {
      log('info', '🔄 Mode: Génération contrat uniquement (depuis dashboard)');
      
      if (!requestBody.bookingId) {
        return new Response(JSON.stringify({
          success: false,
          error: 'bookingId requis pour generate_contract_only'
        }), {
          status: 400,
          headers: corsHeaders
        });
      }
      
      // ✅ CRITIQUE : Vérifier et créer les guests si nécessaire
      const supabaseClient = await getServerClient();
      const { data: bookingData, error: bookingError } = await supabaseClient
        .from('bookings')
        .select('id, guest_name, guest_email, guest_phone, number_of_guests')
        .eq('id', requestBody.bookingId)
        .single();
      
      if (bookingError || !bookingData) {
        return new Response(JSON.stringify({
          success: false,
          error: `Réservation non trouvée: ${bookingError?.message || 'Introuvable'}`
        }), {
          status: 404,
          headers: corsHeaders
        });
      }
      
      // Vérifier si des guests existent dans la table guests
      const { data: existingGuests, error: guestsError } = await supabaseClient
        .from('guests')
        .select('id')
        .eq('booking_id', requestBody.bookingId);
      
      if (guestsError) {
        log('warn', 'Erreur lors de la vérification des guests', { error: guestsError });
      }
      
      // Si aucun guest n'existe et qu'on a des données dans booking, créer un guest
      if ((!existingGuests || existingGuests.length === 0) && bookingData.guest_name) {
        log('info', '[generate_contract_only] Création d\'un guest à partir des données de la réservation', {
          guest_name: bookingData.guest_name,
          guest_email: bookingData.guest_email,
          guest_phone: bookingData.guest_phone
        });
        
        // ✅ CORRECTION CRITIQUE : La table guests n'a PAS de colonne 'email'
        // L'email est stocké dans bookings.guest_email, pas dans guests
        const guestData: any = {
          booking_id: requestBody.bookingId,
          full_name: bookingData.guest_name,
          phone: bookingData.guest_phone || null,
          nationality: 'Non spécifiée',
          document_type: 'passport',
          document_number: '',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };
        
        // ❌ SUPPRIMÉ : Ne PAS ajouter email car la colonne n'existe pas dans la table guests
        // L'email est géré via bookings.guest_email
        
        const { error: insertError } = await supabaseClient
          .from('guests')
          .insert(guestData);
        
        if (insertError) {
          log('warn', 'Erreur lors de la création du guest', { error: insertError });
        } else {
          log('info', '[generate_contract_only] Guest créé avec succès');
        }
      }
      
      // ✅ CORRECTION : Récupérer la signature depuis contract_signatures si non fournie en paramètre
      let signatureToUse: SignatureData | undefined = requestBody.signature;
      
      if (!signatureToUse) {
        log('info', '[generate_contract_only] Pas de signature en paramètre, recherche dans contract_signatures...');
        
        const { data: signatures, error: signatureError } = await supabaseClient
          .from('contract_signatures')
          .select('signature_data, signed_at, signer_name')
          .eq('booking_id', requestBody.bookingId)
          .order('created_at', { ascending: false });
        
        if (signatureError) {
          log('warn', '[generate_contract_only] Erreur récupération signatures', { error: signatureError });
        } else if (signatures && signatures.length > 0) {
          const latestSignature = signatures[0];
          signatureToUse = {
            data: latestSignature.signature_data,
            timestamp: latestSignature.signed_at,
            signerName: latestSignature.signer_name
          };
          log('info', '[generate_contract_only] ✅ Signature trouvée dans contract_signatures', {
            signerName: latestSignature.signer_name,
            signedAt: latestSignature.signed_at,
            hasSignatureData: !!latestSignature.signature_data
          });
        } else {
          log('warn', '[generate_contract_only] Aucune signature trouvée dans contract_signatures, génération contrat non signé');
        }
      }
      
      const contractLocale = requestBody.locale && ['fr', 'en', 'es'].includes(requestBody.locale) ? requestBody.locale : 'fr';
      const contractUrl = await generateContractInternal(requestBody.bookingId, signatureToUse, { locale: contractLocale });
      
      if (contractUrl) {
        // Sauvegarder le document en base (signé si signature disponible)
        await saveDocumentToDatabase(supabaseClient, requestBody.bookingId, 'contract', contractUrl, !!signatureToUse);
        
        // ✅ CORRECTION CRITIQUE : Si on a une signature, régénérer aussi la fiche de police avec signature
        let policeUrl: string | null = null;
        if (signatureToUse) {
          try {
            log('info', '[generate_contract_only] 📋 Régénération fiche de police avec signature...');
            policeUrl = await generatePoliceFormsInternal(requestBody.bookingId, signatureToUse);
            log('info', '[generate_contract_only] ✅ Fiche de police régénérée avec signature', { 
              policeUrl: policeUrl?.substring(0, 60) 
            });
          } catch (policeError) {
            log('warn', '[generate_contract_only] ⚠️ Échec régénération fiche de police (non bloquant)', { 
              error: policeError instanceof Error ? policeError.message : String(policeError)
            });
          }
        }
        
        // ✅ NOUVEAU : Mettre à jour documents_generated dans la table bookings
        try {
          const { data: currentBooking } = await supabaseClient
            .from('bookings')
            .select('documents_generated')
            .eq('id', requestBody.bookingId)
            .single();
          
          const currentDocs = currentBooking?.documents_generated || {};
          const updatedDocs = {
            ...currentDocs,
            contract: true,
            contractUrl: contractUrl,
            contractCreatedAt: new Date().toISOString(),
            contractIsSigned: !!signatureToUse,
            // ✅ Mettre à jour aussi la fiche de police si régénérée
            ...(policeUrl ? {
              policeForm: true,
              policeUrl: policeUrl,
              policeIsSigned: true,
              policeSignedAt: new Date().toISOString()
            } : {})
          };
          
          await supabaseClient
            .from('bookings')
            .update({
              documents_generated: updatedDocs,
              updated_at: new Date().toISOString()
            })
            .eq('id', requestBody.bookingId);
          
          log('info', '[generate_contract_only] documents_generated mis à jour', {
            contract: true,
            contractUrl: contractUrl.substring(0, 50) + '...',
            hasPolice: !!policeUrl
          });
        } catch (updateError) {
          log('warn', '[generate_contract_only] Erreur mise à jour documents_generated', { error: updateError });
        }
        
        // ✅ ENVOI EMAIL : Envoyer l'email si on a un email dans le booking
        let emailSent = false;
        if (bookingData.guest_email) {
          try {
            log('info', '[generate_contract_only] Envoi email au guest', { email: bookingData.guest_email });
            
            // Récupérer les données de la propriété pour l'email
            const { data: propertyData } = await supabaseClient
              .from('properties')
              .select('name, address')
              .eq('id', bookingData.property_id)
              .single();
            
            const guestName = bookingData.guest_name || 'Client';
            const nameParts = guestName.split(' ');
            const firstName = nameParts[0] || guestName;
            const lastName = nameParts.slice(1).join(' ') || '';
            
            const emailResult = await sendGuestContractInternal(
              {
                firstName: firstName,
                lastName: lastName,
                email: bookingData.guest_email
              },
              {
                propertyId: bookingData.property_id,
                airbnbCode: bookingData.booking_reference || '',
                checkIn: bookingData.check_in_date,
                checkOut: bookingData.check_out_date,
                propertyName: propertyData?.name || '',
                propertyAddress: propertyData?.address || '',
                guestName: guestName,
                numberOfGuests: bookingData.number_of_guests || 1
              },
              contractUrl,
              policeUrl || undefined // ✅ Passer aussi l'URL de la fiche de police si disponible
            );
            emailSent = emailResult;
            log('info', '[generate_contract_only] Email envoyé', { success: emailSent });
          } catch (emailError) {
            log('warn', '[generate_contract_only] Envoi email échoué', { error: emailError.message });
          }
        }
        
        return new Response(JSON.stringify({
          success: true,
          contractUrl: contractUrl,
          policeUrl: policeUrl,  // ✅ Inclure l'URL de la fiche de police
          isSigned: !!signatureToUse,
          emailSent: emailSent,
          message: signatureToUse ? 'Contrat et fiche de police signés générés avec succès' : 'Contrat généré avec succès (non signé)'
        }), {
          status: 200,
          headers: corsHeaders
        });
      } else {
        return new Response(JSON.stringify({
          success: false,
          error: 'Erreur lors de la génération du contrat'
        }), {
          status: 500,
          headers: corsHeaders
        });
      }
    }
    
    // ✅ NOUVELLE ACTION : generate_contract_with_signature (depuis save-contract-signature)
    // ✅ OPTIMISÉ : Génère AUSSI la fiche de police avec la signature
    if (requestBody.action === 'generate_contract_with_signature') {
      log('info', '🔄 Mode: Génération contrat + police avec signature invité');
      
      if (!requestBody.bookingId || !requestBody.signatureData || !requestBody.signerName) {
        return new Response(JSON.stringify({
          success: false,
          error: 'bookingId, signatureData et signerName requis'
        }), {
          status: 400,
          headers: corsHeaders
        });
      }
      
      try {
        const signatureData: SignatureData = {
          data: requestBody.signatureData,
          timestamp: new Date().toISOString(),
          signerName: requestBody.signerName
        };
        
        // 1. Générer le contrat avec signature
        log('info', '📄 [generate_contract_with_signature] Génération contrat...');
        const contractUrl = await generateContractInternal(requestBody.bookingId, signatureData);
        log('info', '✅ [generate_contract_with_signature] Contrat généré', { contractUrl: contractUrl?.substring(0, 60) });
        
        // 2. Générer la fiche de police avec la MÊME signature (évite le problème de timing)
        let policeUrl: string | null = null;
        try {
          log('info', '📋 [generate_contract_with_signature] Génération fiche de police avec signature...');
          policeUrl = await generatePoliceFormsInternal(requestBody.bookingId, signatureData);
          log('info', '✅ [generate_contract_with_signature] Fiche de police générée', { policeUrl: policeUrl?.substring(0, 60) });
        } catch (policeError) {
          // Ne pas faire échouer si la police échoue, le contrat est l'essentiel
          log('warn', '⚠️ [generate_contract_with_signature] Échec génération police (non bloquant)', { 
            error: policeError instanceof Error ? policeError.message : String(policeError)
          });
        }
        
        // ✅ CORRECTION CRITIQUE : Mettre à jour documents_generated avec les nouvelles URLs (avec signature)
        try {
          const { data: currentBooking } = await supabaseClient
            .from('bookings')
            .select('documents_generated')
            .eq('id', requestBody.bookingId)
            .single();
          
          const currentDocs = currentBooking?.documents_generated || {};
          const updatedDocs = {
            ...currentDocs,
            contract: true,
            contractUrl: contractUrl,
            contractIsSigned: true,
            contractSignedAt: new Date().toISOString(),
            ...(policeUrl ? {
              policeForm: true,
              policeUrl: policeUrl,
              policeIsSigned: true,
              policeSignedAt: new Date().toISOString()
            } : {})
          };
          
          await supabaseClient
            .from('bookings')
            .update({
              documents_generated: updatedDocs,
              updated_at: new Date().toISOString()
            })
            .eq('id', requestBody.bookingId);
          
          log('info', '✅ [generate_contract_with_signature] documents_generated mis à jour avec URLs signées', {
            contractUrl: contractUrl?.substring(0, 60),
            policeUrl: policeUrl?.substring(0, 60),
            hasSignature: true
          });
        } catch (updateError) {
          log('warn', '⚠️ [generate_contract_with_signature] Erreur mise à jour documents_generated', { 
            error: updateError instanceof Error ? updateError.message : String(updateError)
          });
        }
        
        return new Response(JSON.stringify({
          success: true,
          contractUrl,
          policeUrl,
          hasGuestSignature: true,
          message: 'Contrat et fiche de police avec signature générés avec succès'
        }), {
          status: 200,
          headers: corsHeaders
        });
      } catch (error) {
        return new Response(JSON.stringify({
          success: false,
          error: error instanceof Error ? error.message : 'Erreur génération contrat signé'
        }), {
          status: 500,
          headers: corsHeaders
        });
      }
    }
    
    // ✅ NOUVELLE ACTION : clean_duplicate_contracts (nettoyage des doublons)
    if (requestBody.action === 'clean_duplicate_contracts') {
      log('info', '🔄 Mode: Nettoyage des contrats dupliqués');
      
      if (!requestBody.bookingId) {
        return new Response(JSON.stringify({
          success: false,
          error: 'bookingId requis pour clean_duplicate_contracts'
        }), {
          status: 400,
          headers: corsHeaders
        });
      }
      
      try {
        const supabaseClient = await getServerClient();
        
        // 1. Récupérer tous les contrats pour ce booking
        const { data: contracts, error: contractsError } = await supabaseClient
          .from('generated_documents')
          .select('*')
          .eq('booking_id', requestBody.bookingId)
          .eq('document_type', 'contract')
          .order('created_at', { ascending: false });
        
        if (contractsError) {
          throw new Error(`Erreur récupération contrats: ${contractsError.message}`);
        }
        
        if (contracts && contracts.length > 1) {
          // Garder le plus récent et le plus signé
          const latestContract = contracts[0];
          const signedContracts = contracts.filter(c => c.is_signed);
          
          let contractToKeep = latestContract;
          if (signedContracts.length > 0) {
            contractToKeep = signedContracts[0]; // Prendre le contrat signé le plus récent
          }
          
          // Supprimer les doublons
          const contractsToDelete = contracts.filter(c => c.id !== contractToKeep.id);
          
          for (const contract of contractsToDelete) {
            await supabaseClient
              .from('generated_documents')
              .delete()
              .eq('id', contract.id);
            
            log('info', `Supprimé contrat doublon: ${contract.id}`);
          }
          
          // Nettoyer aussi uploaded_documents
          const { data: uploadedContracts } = await supabaseClient
            .from('uploaded_documents')
            .select('*')
            .eq('booking_id', requestBody.bookingId)
            .eq('document_type', 'contract');
          
          if (uploadedContracts && uploadedContracts.length > 1) {
            const uploadedToKeep = uploadedContracts.find(uc => 
              uc.document_url === contractToKeep.document_url
            ) || uploadedContracts[0];
            
            const uploadedToDelete = uploadedContracts.filter(uc => uc.id !== uploadedToKeep.id);
            
            for (const uploaded of uploadedToDelete) {
              await supabaseClient
                .from('uploaded_documents')
                .delete()
                .eq('id', uploaded.id);
            }
          }
          
          return new Response(JSON.stringify({
            success: true,
            message: `Nettoyage terminé: ${contractsToDelete.length} doublons supprimés`,
            keptContract: {
              id: contractToKeep.id,
              isSigned: contractToKeep.is_signed,
              createdAt: contractToKeep.created_at
            }
          }), {
            status: 200,
            headers: corsHeaders
          });
        } else {
          return new Response(JSON.stringify({
            success: true,
            message: 'Aucun doublon trouvé'
          }), {
            status: 200,
            headers: corsHeaders
          });
        }
      } catch (error) {
        log('error', 'Erreur nettoyage doublons:', error);
        return new Response(JSON.stringify({
          success: false,
          error: `Erreur nettoyage: ${error.message}`
        }), {
          status: 500,
          headers: corsHeaders
        });
      }
    }
    
    // ✅ NOUVELLE ACTION : generate_police_only (depuis dashboard hôte ou preview)
    if (requestBody.action === 'generate_police_only') {
      log('info', '🔄 Mode: Génération fiches police uniquement');
      
      // ✅ NOUVEAU : Support du mode preview avec objet booking directement
      if (requestBody.booking) {
        log('info', '👁️ Mode preview : utilisation des données fournies directement');
        
        const supabaseClient = await getServerClient();
        const booking = requestBody.booking;
        
        // Validation des données invités pour preview
        const guests = booking.guests || [];
        if (guests.length === 0) {
          return new Response(JSON.stringify({
            success: false,
            error: 'Aucun invité trouvé pour générer les fiches de police'
          }), {
            status: 400,
            headers: corsHeaders
          });
        }
        
        // Validation moins stricte en mode preview (accepte les placeholders)
        const invalidGuests = guests.filter((guest: any) => 
          !guest.full_name?.trim() && !guest.fullName?.trim()
        );
        
        if (invalidGuests.length > 0) {
          return new Response(JSON.stringify({
            success: false,
            error: `${invalidGuests.length} invité(s) ont des données incomplètes`
          }), {
            status: 400,
            headers: corsHeaders
          });
        }
        
        // ✅ AMÉLIORATION : Charger la propriété avec contract_template si pas fournie
        let property = booking.property || {};
        if (!property.contract_template && requestBody.bookingData?.propertyId) {
          log('info', '[Police Preview] Chargement propriété avec contract_template...');
          const { data: propertyData } = await supabaseClient
            .from('properties')
            .select('*, contract_template')
            .eq('id', requestBody.bookingData.propertyId)
            .single();
          
          if (propertyData) {
            property = propertyData;
            log('info', '[Police Preview] Propriété chargée avec contract_template');
          }
        }
        
        // Normaliser les données des guests pour la compatibilité
        const normalizedBooking = {
          ...booking,
          property: property, // ✅ S'assurer que la propriété avec contract_template est incluse
          guests: guests.map((g: any) => ({
            full_name: g.full_name || g.fullName || '',
            date_of_birth: g.date_of_birth || g.dateOfBirth || null,
            document_number: g.document_number || g.documentNumber || '',
            nationality: g.nationality || '',
            place_of_birth: g.place_of_birth || g.placeOfBirth || '',
            document_type: g.document_type || g.documentType || 'passport',
            profession: g.profession || '',
            motif_sejour: g.motif_sejour || g.motifSejour || 'TOURISME',
            adresse_personnelle: g.adresse_personnelle || g.adressePersonnelle || '',
          }))
        };
        
        // Générer le PDF en mode preview (sans sauvegarde en base, retourne data URL)
        const policeUrl = await generatePoliceFormsPDF(supabaseClient, normalizedBooking, true);
        
        return new Response(JSON.stringify({
          success: true,
          policeUrl,
          documentUrl: policeUrl, // Rétrocompatibilité
          documentUrls: [policeUrl], // Rétrocompatibilité
          message: 'Fiches de police générées avec succès (preview)'
        }), {
          status: 200,
          headers: corsHeaders
        });
      }
      
      // Mode normal : avec bookingId
      if (!requestBody.bookingId) {
        return new Response(JSON.stringify({
          success: false,
          error: 'bookingId ou booking requis pour generate_police_only'
        }), {
          status: 400,
          headers: corsHeaders
        });
      }
      
      // Générer uniquement les fiches de police
      const policeUrl = await generatePoliceFormsInternal(requestBody.bookingId);
      
      // ✅ NOUVEAU : Mettre à jour documents_generated dans la table bookings (FUSION ATOMIQUE)
      if (policeUrl) {
        try {
          const supabaseClient = await getServerClient();
          
          // ✅ CORRECTION CRITIQUE : Récupérer l'état ACTUEL (pas l'état initial)
          // pour éviter d'écraser les mises à jour concurrentes
          const { data: currentBooking, error: fetchError } = await supabaseClient
            .from('bookings')
            .select('documents_generated')
            .eq('id', requestBody.bookingId)
            .single();
          
          if (fetchError) {
            log('error', '[generate_police_only] Erreur récupération état actuel', { error: fetchError });
            throw fetchError;
          }
          
          // ✅ FUSION ATOMIQUE : Fusionner avec l'état actuel
          const currentDocs = currentBooking?.documents_generated || {};
          const updatedDocs = {
            ...currentDocs,  // ✅ Utiliser l'état ACTUEL
            policeForm: true,
            policeUrl: policeUrl,  // ✅ Sauvegarder l'URL
            policeCreatedAt: new Date().toISOString()
          };
          
          const { error: updateError } = await supabaseClient
            .from('bookings')
            .update({
              documents_generated: updatedDocs,
              updated_at: new Date().toISOString()
            })
            .eq('id', requestBody.bookingId);
          
          if (updateError) {
            log('error', '[generate_police_only] Erreur mise à jour documents_generated', { error: updateError });
            throw updateError;
          }
          
          log('info', '[generate_police_only] documents_generated.policeForm mis à jour avec fusion atomique', {
            policeForm: true,
            policeUrl: policeUrl.substring(0, 50) + '...',
            hadContract: !!currentDocs.contract,
            hadPoliceForm: !!currentDocs.policeForm
          });
        } catch (updateError) {
          log('warn', '[generate_police_only] Erreur mise à jour documents_generated', { error: updateError });
        }
      }
      
      return new Response(JSON.stringify({
        success: true,
        policeUrl,
        documentUrl: policeUrl, // Rétrocompatibilité
        documentUrls: [policeUrl], // Rétrocompatibilité
        message: 'Fiches de police générées avec succès'
      }), {
        status: 200,
        headers: corsHeaders
      });
    }
    
    // ✅ NOUVELLE ACTION : generate_missing_documents (depuis useBookings.ts - fallback Airbnb)
    if (requestBody.action === 'generate_missing_documents') {
      log('info', '🔄 Mode: Génération documents manquants (fallback Airbnb)');
      
      if (!requestBody.bookingId) {
        return new Response(JSON.stringify({
          success: false,
          error: 'bookingId requis pour generate_missing_documents'
        }), {
          status: 400,
          headers: corsHeaders
        });
      }
      
      const supabaseClient = await getServerClient();
      const results: any = { success: true };
      
      try {
        // Récupérer la réservation pour vérifier les documents existants
        const { data: booking, error: bookingError } = await supabaseClient
          .from('bookings')
          .select('*, documents_generated, property:properties(*)')
          .eq('id', requestBody.bookingId)
          .single();
        
        if (bookingError || !booking) {
          throw new Error(`Réservation non trouvée: ${bookingError?.message || 'Introuvable'}`);
        }
        
        const existingDocs = booking.documents_generated || {};
        const documentTypes = requestBody.documentTypes || ['contract', 'police'];
        
        // Générer le contrat si demandé et manquant
        if (documentTypes.includes('contract') && !existingDocs.contractUrl) {
          try {
            const contractUrl = await generateContractInternal(requestBody.bookingId, null);
            if (contractUrl) {
              results.contractUrl = contractUrl;
              log('info', '✅ Contrat généré (missing_documents)');
            }
          } catch (contractError: any) {
            log('warn', 'Échec génération contrat (missing_documents)', { error: contractError.message });
          }
        }
        
        // Générer la fiche de police si demandée et manquante
        if (documentTypes.includes('police') && !existingDocs.policeUrl) {
          try {
            const policeUrl = await generatePoliceFormsInternal(requestBody.bookingId);
            if (policeUrl) {
              results.policeUrl = policeUrl;
              log('info', '✅ Fiche de police générée (missing_documents)');
            }
          } catch (policeError: any) {
            log('warn', 'Échec génération police (missing_documents)', { error: policeError.message });
          }
        }
        
        return new Response(JSON.stringify(results), {
          status: 200,
          headers: corsHeaders
        });
      } catch (error: any) {
        log('error', 'Erreur generate_missing_documents', { error: error.message });
        return new Response(JSON.stringify({
          success: false,
          error: error.message
        }), {
          status: 500,
          headers: corsHeaders
        });
      }
    }
    
    // ✅ NOUVELLE ACTION : resolve (alias pour resolve_booking_only - compatibilité frontend)
    if (requestBody.action === 'resolve') {
      log('info', '🔄 Mode: Résolution réservation (alias resolve)');
      // Rediriger vers resolve_booking_only
      requestBody.action = 'resolve_booking_only';
    }
    
    // ✅ NOUVELLE ACTION : issue (pour useGuestVerification.ts)
    if (requestBody.action === 'issue') {
      log('info', '🔄 Mode: Émission/Issue de réservation');
      // Traiter comme le workflow par défaut mais avec logging spécifique
      // Continue vers le traitement principal
    }
    
    // ✅ NOUVELLE ACTION : generate (pour DebugDocVars.tsx)
    if (requestBody.action === 'generate') {
      log('info', '🔄 Mode: Génération générique');
      // Traiter comme generate_all_documents
      if (requestBody.bookingId) {
        requestBody.action = 'generate_all_documents';
      }
    }
    
    // ✅ NOUVELLE ACTION : generate_all_documents (depuis dashboard hôte)
    if (requestBody.action === 'generate_all_documents') {
      log('info', '🔄 Mode: Génération tous documents (depuis dashboard)');
      
      if (!requestBody.bookingId) {
        return new Response(JSON.stringify({
          success: false,
          error: 'bookingId requis pour generate_all_documents'
        }), {
          status: 400,
          headers: corsHeaders
        });
      }
      
      const results: any = {
        success: true,
        contractUrl: null,
        policeUrl: null,
        message: 'Documents générés avec succès'
      };
      
      try {
        // Générer le contrat si demandé
        if (!requestBody.documentTypes || requestBody.documentTypes.includes('contract')) {
          if (requestBody.signature) {
            results.contractUrl = await generateContractInternal(requestBody.bookingId, requestBody.signature);
          } else {
            log('warn', 'Signature manquante pour le contrat');
          }
        }
        
        // Générer les fiches de police si demandé
        if (!requestBody.documentTypes || requestBody.documentTypes.includes('police')) {
          results.policeUrl = await generatePoliceFormsInternal(requestBody.bookingId);
        }
        
        return new Response(JSON.stringify(results), {
          status: 200,
          headers: corsHeaders
        });
      } catch (error) {
        log('error', 'Erreur génération documents', { error });
        return new Response(JSON.stringify({
          success: false,
          error: error.message || 'Erreur lors de la génération des documents'
        }), {
          status: 500,
          headers: corsHeaders
        });
      }
    }
    
    log('info', 'Requête reçue et parsée', {
      hasToken: !!requestBody.token,
      tokenPrefix: requestBody.token ? requestBody.token.substring(0, 8) + '...' : 'N/A',
      airbnbCode: requestBody.airbnbCode,
      guestName: requestBody.guestInfo ? `${requestBody.guestInfo.firstName} ${requestBody.guestInfo.lastName}` : 'N/A',
      documentsCount: requestBody.idDocuments?.length || 0,
      hasSignature: !!requestBody.signature,
      dateOfBirth: requestBody.guestInfo?.dateOfBirth,
      options: {
        skipEmail: requestBody.skipEmail || false,
        skipPolice: requestBody.skipPolice || false,
        generateOnly: requestBody.generateOnly || false
      }
    });

    // 2. VALIDATION CONDITIONNELLE selon l'action
    log('info', '✅ Validation des données');
    
    // Pour resolve_booking_only, validation minimale
    if (requestBody.action === 'resolve_booking_only') {
      if (!requestBody.token || !requestBody.airbnbCode) {
        log('error', 'Validation échouée pour resolve_booking_only', { 
          hasToken: !!requestBody.token, 
          hasAirbnbCode: !!requestBody.airbnbCode 
        });
        return new Response(JSON.stringify({
          success: false,
          error: 'Token et code Airbnb requis pour la résolution',
          details: ['Token manquant', 'Code Airbnb manquant']
        }), {
          status: 400,
          headers: corsHeaders
        });
      }
      log('info', '✅ Validation minimale réussie pour resolve_booking_only');
    } else if (requestBody.action === 'create_ics_booking') {
      // NOUVEAU : Action pour créer la réservation ICS dès l'accès au lien
      if (!requestBody.token) {
        log('error', 'Validation échouée pour create_ics_booking', { 
          hasToken: !!requestBody.token
        });
        return new Response(JSON.stringify({
          success: false,
          error: 'Token requis pour créer la réservation ICS',
          details: ['Token manquant']
        }), {
          status: 400,
          headers: corsHeaders
        });
      }
      log('info', '✅ Validation réussie pour create_ics_booking');
    } else if (requestBody.action === 'host_direct') {
      // ✅ Réservation créée par l'hôte (sans signature guest, tout se fait physiquement).
      // Exceptionnellement : l'email n'est pas pris en compte (non requis, pas d'envoi au guest).
      if (!requestBody.bookingId) {
        log('error', 'Validation échouée pour host_direct', { 
          hasBookingId: !!requestBody.bookingId
        });
        return new Response(JSON.stringify({
          success: false,
          error: 'bookingId requis pour host_direct',
          details: ['bookingId manquant']
        }), {
          status: 400,
          headers: corsHeaders
        });
      }
      log('info', '✅ Validation réussie pour host_direct (email non requis)');
    } else {
      // Validation complète pour les autres actions
      const validation = validateRequest(requestBody);
      
      if (!validation.isValid) {
        log('error', 'Validation échouée', { errors: validation.errors });
        // ✅ AMÉLIORATION : Message d'erreur plus explicite
        const errorMessage = validation.errors.length > 0 
          ? validation.errors.join(', ') 
          : 'Données invalides';
        return new Response(JSON.stringify({
          success: false,
          error: errorMessage,
          details: validation.errors
        }), {
          status: 400,
          headers: corsHeaders
        });
      }

      if (validation.warnings.length > 0) {
        log('warn', 'Avertissements de validation', { warnings: validation.warnings });
      }

      log('info', '✅ Validation complète réussie');
    }

    // 3. TRAITEMENT PRINCIPAL
    let booking: ResolvedBooking;
    let bookingId: string;
    let contractUrl: string;
    let policeUrl: string = '';
    let identityUrl: string = '';  // ✅ AJOUT
    let emailSent: boolean = false;

    try {
      const guestInfosForSave: GuestInfo[] =
        Array.isArray(requestBody.guests) && requestBody.guests.length > 0
          ? requestBody.guests
          : [requestBody.guestInfo];
      const primaryGuestInfo = guestInfosForSave[0];

      // ÉTAPE 1: Résolution de la réservation
      log('info', '🎯 ÉTAPE 1/5: Résolution de la réservation');
      
      // ✅ NOUVEAU : Gestion de l'action host_direct
      if (requestBody.action === 'host_direct') {
        log('info', 'Action host_direct détectée, récupération directe de la réservation');
        
        const supabase = await getServerClient();
        const { data: existingBooking, error: bookingError } = await supabase
          .from('bookings')
          .select(`
            *,
            property:properties!inner(
              id,
              name,
              address,
              contact_info
            )
          `)
          .eq('id', requestBody.bookingId)
          .single();

        if (bookingError || !existingBooking) {
          throw new Error(`Réservation non trouvée: ${bookingError?.message || 'Réservation introuvable'}`);
        }

        // Créer l'objet ResolvedBooking à partir de la réservation existante
        booking = {
          propertyId: existingBooking.property_id,
          airbnbCode: existingBooking.booking_reference || 'INDEPENDENT_BOOKING',
          checkIn: existingBooking.check_in_date,
          checkOut: existingBooking.check_out_date,
          propertyName: existingBooking.property?.name || 'Propriété',
          propertyAddress: existingBooking.property?.address || '',
          guestName: existingBooking.guest_name || `${requestBody.guestInfo?.firstName} ${requestBody.guestInfo?.lastName}`,
          numberOfGuests: existingBooking.number_of_guests,
          bookingId: existingBooking.id
        };

        bookingId = existingBooking.id;
        log('info', 'Réservation host_direct récupérée avec succès', { 
          bookingId, 
          propertyName: booking.propertyName,
          checkIn: booking.checkIn,
          checkOut: booking.checkOut,
          guestName: booking.guestName
        });
        
        // ✅ Pour host_direct, on continue avec la sauvegarde des documents et la génération
        // Les guests ont déjà été créés par le front-end, donc on va juste sauvegarder les documents uploadés
        log('info', '🔄 [HOST_DIRECT] Continuation avec sauvegarde documents et génération contrat/police');
        
        // ✅ CRITIQUE : Vérifier que les guests sont bien en base avant de générer les documents
        const supabaseCheck = await getServerClient();
        const { data: verifyGuests, error: verifyError } = await supabaseCheck
          .from('guests')
          .select('id, full_name, document_number, nationality')
          .eq('booking_id', bookingId);
        
        if (verifyError) {
          log('error', '❌ [HOST_DIRECT] Erreur vérification guests:', { error: verifyError });
          throw new Error(`Erreur vérification guests: ${verifyError.message}`);
        }
        
        log('info', '✅ [HOST_DIRECT] Vérification guests en base:', {
          count: verifyGuests?.length || 0,
          guests: verifyGuests?.map(g => ({ id: g.id, full_name: g.full_name }))
        });
        
        if (!verifyGuests || verifyGuests.length === 0) {
          log('error', '❌ [HOST_DIRECT] Aucun guest trouvé en base pour ce booking!', { bookingId });
          throw new Error('Aucun guest trouvé en base de données. Les guests doivent être créés avant la génération des documents.');
        }
      }
      // ✅ NOUVEAU : Gestion de l'action create_ics_booking
      else if (requestBody.action === 'create_ics_booking') {
        log('info', 'Action create_ics_booking détectée, récupération de la réservation ICS existante');
        
        // Récupérer le token avec ses métadonnées pour obtenir l'ID de la réservation
        const supabase = await getServerClient();
        const { data: tokenData, error: tokenError } = await supabase
          .from('property_verification_tokens')
          .select('metadata')
          .eq('token', requestBody.token)
          .single();

        if (tokenError || !tokenData) {
          throw new Error(`Token invalide: ${tokenError?.message || 'Token non trouvé'}`);
        }

        const metadata = tokenData.metadata || {};
        const reservationData = metadata.reservationData;
        const bookingId = reservationData?.bookingId;

        if (!bookingId) {
          throw new Error('ID de réservation manquant dans le token');
        }

        // Récupérer la réservation existante
        const { data: existingBooking, error: bookingError } = await supabase
          .from('bookings')
          .select('*')
          .eq('id', bookingId)
          .single();

        if (bookingError || !existingBooking) {
          throw new Error(`Réservation non trouvée: ${bookingError?.message || 'Réservation introuvable'}`);
        }

        // Créer l'objet ResolvedBooking à partir de la réservation existante
        booking = {
          propertyId: existingBooking.property_id,
          airbnbCode: existingBooking.booking_reference,
          checkIn: existingBooking.check_in_date,
          checkOut: existingBooking.check_out_date,
          propertyName: 'Propriété', // Sera récupéré plus tard si nécessaire
          propertyAddress: '',
          guestName: existingBooking.guest_name,
          numberOfGuests: existingBooking.number_of_guests,
          totalPrice: existingBooking.total_price,
          currency: 'EUR'
        };
        
        log('info', 'Réservation ICS existante récupérée avec succès', {
          bookingId,
          checkIn: booking.checkIn,
          checkOut: booking.checkOut,
          propertyName: booking.propertyName,
          airbnbCode: booking.airbnbCode
        });
        
        // Retourner directement la réservation existante
        return new Response(JSON.stringify({
          success: true,
          data: {
            bookingId: bookingId,
            booking: booking,
            message: 'Réservation ICS existante récupérée avec succès'
          }
        }), {
          status: 200,
          headers: corsHeaders
        });
      }
      
      // ✅ NOUVEAU : Distinction entre trois types de réservations
      log('info', '🔍 Détection du type de réservation', {
        airbnbCode: requestBody.airbnbCode,
        hasAirbnbCode: !!requestBody.airbnbCode,
        isIndependent: requestBody.airbnbCode === 'INDEPENDENT_BOOKING' || !requestBody.airbnbCode,
        isICS_DIRECT: requestBody.airbnbCode === 'ICS_DIRECT'
      });

      // ✅ CORRIGÉ : Vérifier d'abord le bookingId dans les métadonnées du token pour les liens ICS directs
      const supabaseClient = await getServerClient();
      let tokenDataWithMetadata = null;
      
      try {
        const { data: tokenData } = await supabaseClient
          .from('property_verification_tokens')
          .select('metadata')
          .eq('token', requestBody.token)
          .eq('is_active', true)
          .maybeSingle();
        
        tokenDataWithMetadata = tokenData;
      } catch (tokenError) {
        log('warn', 'Erreur lors de la récupération des métadonnées du token', { error: tokenError });
      }
      
      const metadata = tokenDataWithMetadata?.metadata || {};
      const reservationData = metadata?.reservationData;
      const existingBookingIdFromToken = reservationData?.bookingId;
      const linkType = metadata?.linkType;
      
      // ✅ CORRIGÉ : Utiliser le bookingId du token si disponible (réservation ICS créée lors de la génération du lien)
      if (existingBookingIdFromToken && linkType === 'ics_direct') {
        log('info', 'Utilisation de la réservation ICS existante depuis le token', { 
          bookingId: existingBookingIdFromToken,
          linkType 
        });
        booking = await getExistingICSBooking(requestBody.token, primaryGuestInfo);
        log('info', 'Réservation ICS existante récupérée avec succès', {
          bookingId: booking.bookingId,
          airbnbCode: booking.airbnbCode,
          dates: `${booking.checkIn} → ${booking.checkOut}`
        });
      } else if (requestBody.airbnbCode === 'INDEPENDENT_BOOKING' || !requestBody.airbnbCode) {
        log('info', 'Réservation indépendante détectée (formulaire), création directe');
        booking = await createIndependentBooking(requestBody.token, primaryGuestInfo, requestBody.bookingData);
      } else {
        log('info', 'Réservation via lien ICS avec code détectée, résolution avec dates prédéfinies');
        booking = await resolveBookingInternal(requestBody.token, requestBody.airbnbCode);
        
        // ✅ CORRECTION : S'assurer que les dates sont bien définies pour les liens ICS
        if (!booking.checkIn || !booking.checkOut) {
          log('error', 'Dates manquantes pour réservation ICS', { 
            hasCheckIn: !!booking.checkIn, 
            hasCheckOut: !!booking.checkOut,
            airbnbCode: requestBody.airbnbCode 
          });
          throw new Error('Dates de réservation manquantes pour ce lien ICS');
        }
        
        log('info', 'Dates ICS résolues avec succès', {
          checkIn: booking.checkIn,
          checkOut: booking.checkOut,
          propertyName: booking.propertyName
        });
      }

      const nFromReq = requestBody.bookingData?.numberOfGuests;
      booking.numberOfGuests = Math.max(
        booking.numberOfGuests ?? 1,
        guestInfosForSave.length,
        typeof nFromReq === 'number' && !Number.isNaN(nFromReq) ? nFromReq : 0
      );
      
      // ✅ CORRIGÉ : Vérifier si le booking a déjà été traité (incluant 'pending')
      // Note: supabaseClient a déjà été déclaré ci-dessus
      // ✅ IMPORTANT : Si booking.bookingId existe déjà, on l'utilise directement
      let existingBooking;
      
      if (booking.bookingId) {
        // ✅ PRIORITÉ 1 : Utiliser le bookingId si disponible (réservation ICS créée lors de la génération du lien)
        log('info', 'Booking ID disponible depuis la résolution', { bookingId: booking.bookingId });
        const { data } = await supabaseClient
          .from('bookings')
          .select('id, status')
          .eq('id', booking.bookingId)
          .maybeSingle();
        existingBooking = data;
      } else if (booking.airbnbCode === 'INDEPENDENT_BOOKING') {
        // Pour les réservations indépendantes, vérifier par property_id + guest_name + check_in_date
        const { data } = await supabaseClient
          .from('bookings')
          .select('id, status')
          .eq('property_id', booking.propertyId)
          .eq('booking_reference', 'INDEPENDENT_BOOKING')
          .eq('guest_name', `${primaryGuestInfo.firstName} ${primaryGuestInfo.lastName}`)
          .eq('check_in_date', booking.checkIn)
          .maybeSingle();
        existingBooking = data;
      } else {
        // Pour les réservations Airbnb, utiliser property_id + booking_reference
        const { data } = await supabaseClient
          .from('bookings')
          .select('id, status')
          .eq('property_id', booking.propertyId)
          .eq('booking_reference', booking.airbnbCode)
          .maybeSingle();
        existingBooking = data;
      }
        
      // ✅ CORRIGÉ : Vérifier TOUS les statuts actifs, pas seulement 'confirmed' et 'completed'
      if (existingBooking) {
        log('info', 'Booking existant trouvé', {
          bookingId: existingBooking.id,
          status: existingBooking.status,
          source: booking.bookingId ? 'bookingId' : 'booking_reference'
        });
        
        // ✅ Si le booking est en statut actif, on le réutilise
        if (existingBooking.status === 'pending' || 
            existingBooking.status === 'confirmed' || 
            existingBooking.status === 'completed') {
          log('info', `Booking ${existingBooking.id} already exists (${existingBooking.status}), réutilisation et mise à jour des données`);
          
          // ✅ CORRIGÉ : Passer le bookingId existant à saveGuestDataInternal pour synchronisation
          booking.bookingId = existingBooking.id;
          
          // ✅ CORRIGÉ : Continuer quand même pour mettre à jour les données (documents, guests, etc.)
          // mais utiliser le bookingId existant pour éviter les doublons
          log('info', 'Continuer avec la mise à jour des données pour le booking existant', { bookingId: existingBooking.id });
        }
        
        // ✅ Si le booking est 'cancelled' ou 'rejected', on peut en créer un nouveau
        if (existingBooking.status === 'cancelled' || existingBooking.status === 'rejected') {
          log('info', 'Booking existant annulé/rejeté, création d\'un nouveau');
          existingBooking = null; // Réinitialiser pour permettre la création
        }
      }
      
      // ✅ NOUVEAU : Vérifier les conflits de dates AVANT de créer le booking
      try {
        const { data: conflicts } = await supabaseClient
          .rpc('check_booking_conflicts', {
            p_property_id: booking.propertyId,
            p_check_in_date: booking.checkIn,
            p_check_out_date: booking.checkOut,
            p_exclude_booking_id: existingBooking?.id || null
          });
        
        if (conflicts && conflicts.length > 0) {
          log('warn', 'Conflit de dates détecté', { conflicts });
          return new Response(JSON.stringify({
            success: false,
            error: 'CONFLICT',
            message: 'Une réservation existe déjà pour ces dates',
            conflicts: conflicts
          }), {
            status: 409, // Conflict
          headers: corsHeaders
        });
        }
      } catch (conflictError) {
        // Log l'erreur mais continue si la fonction RPC n'existe pas encore
        log('warn', 'Erreur lors de la vérification des conflits (ignoré)', { error: conflictError });
      }

      // ÉTAPE 2: Sauvegarde des données
      log('info', '🎯 ÉTAPE 2/5: Sauvegarde des données invité');
      
      // ✅ NOUVEAU : Pour host_direct, les guests et documents ont déjà été créés par le front-end
      // On saute donc saveGuestDataInternal et on passe directement à la génération des documents
      if (requestBody.action === 'host_direct') {
        log('info', '🔄 [HOST_DIRECT] Skipping saveGuestDataInternal - guests et documents déjà créés par le front-end');
        // Les documents ont déjà été uploadés via DocumentStorageService dans le front-end
        // bookingId a déjà été défini lors de la récupération de la réservation
        // On passe directement à la génération du contrat et de la fiche de police
        log('info', '🔄 [HOST_DIRECT] BookingId déjà défini:', { bookingId });
        
        // ✅ Récupérer les URLs des documents d'identité déjà uploadés
        const supabase = await getServerClient();
        const { data: uploadedDocs } = await supabase
          .from('uploaded_documents')
          .select('document_url, document_type, id')
          .eq('booking_id', bookingId)
          .in('document_type', ['identity', 'identity_upload', 'id-document', 'passport']);
        
        log('info', '📄 [HOST_DIRECT] Recherche documents d\'identité', { 
          bookingId, 
          docsCount: uploadedDocs?.length || 0,
          docs: uploadedDocs 
        });
        
        if (uploadedDocs && uploadedDocs.length > 0) {
          identityUrl = uploadedDocs[0].document_url;
          log('info', '✅ [HOST_DIRECT] Document d\'identité récupéré', { 
            identityUrl,
            documentType: uploadedDocs[0].document_type,
            totalDocs: uploadedDocs.length
          });
        } else {
          log('warn', '⚠️ [HOST_DIRECT] Aucun document d\'identité trouvé pour ce booking');
        }
      } else {
      // ✅ CORRIGÉ : S'assurer que booking.bookingId est défini si une réservation existe
      // Cela permet à saveGuestDataInternal d'utiliser directement la réservation existante
      if (existingBooking && existingBooking.status !== 'cancelled' && existingBooking.status !== 'rejected') {
        booking.bookingId = existingBooking.id;
        log('info', 'Booking ID existant passé à saveGuestDataInternal', { bookingId: existingBooking.id });
      }
      
      bookingId = await saveGuestDataInternal(booking, guestInfosForSave, requestBody.idDocuments);
      
      log('info', 'Booking ID sauvegardé avec succès', { bookingId });
      }
      
      // ✅ VÉRIFICATION CRITIQUE : S'assurer que bookingId est défini avant de continuer
      if (!bookingId) {
        log('error', '❌ CRITICAL: bookingId is not defined before document generation');
        throw new Error('bookingId manquant avant la génération des documents');
      }

      // ÉTAPE 3, 4 & 5: Génération des documents
      log('info', '🎯 ÉTAPE 3-5/5: Génération des documents');
      
      const documentPromises: Promise<string>[] = [
        generateContractInternal(bookingId, requestBody.signature)
      ];

      // ✅ CORRECTION : Générer la fiche de police avec la MÊME signature que le contrat
      if (!requestBody.skipPolice) {
        documentPromises.push(
          generatePoliceFormsInternal(bookingId, requestBody.signature).catch(error => {
            log('warn', 'Génération fiche police échouée (continuera sans)', { error: error.message });
            return ''; // Continue sans fiche de police
          })
        );
      }

      // ❌ DÉSACTIVÉ : Génération automatique des documents d'identité formatés
      // On affiche uniquement les documents uploadés par l'invité (scans/photos)
      log('info', 'Documents d\'identité uploadés seront utilisés (pas de génération automatique)');

      const documentResults = await Promise.all(documentPromises);
      contractUrl = documentResults[0];
      policeUrl = documentResults[1] || '';
      identityUrl = documentResults[2] || '';  // ✅ AJOUT
      
      log('info', '✅ Documents générés:', {
        hasContract: !!contractUrl,
        hasPolice: !!policeUrl,
        hasIdentity: !!identityUrl,
        contractUrlLength: contractUrl?.length || 0,
        policeUrlLength: policeUrl?.length || 0,
        contractUrlPreview: contractUrl ? contractUrl.substring(0, 100) + '...' : null,
        policeUrlPreview: policeUrl ? policeUrl.substring(0, 100) + '...' : null
      });
      
      // ✅ VALIDATION CRITIQUE : Vérifier que les documents ont bien été générés
      if (!contractUrl) {
        log('error', '❌ [CRITICAL] Contrat non généré!', { bookingId });
        throw new Error('Échec génération du contrat');
      }
      
      if (!policeUrl && !requestBody.skipPolice) {
        log('warn', '⚠️ [WARNING] Fiche de police non générée', { bookingId });
      }

      // ÉTAPE 5: Envoi de l'email (optionnel et conditionnel)
      // ✅ Cas host_direct : l'email n'est pas pris en compte, pas d'envoi au guest
      const skipEmailForThisRequest = requestBody.skipEmail || requestBody.action === 'host_direct';
      if (!skipEmailForThisRequest && !requestBody.generateOnly) {
        log('info', '🎯 ÉTAPE 5/5: Vérification envoi email');
        
        // Vérifier si l'email est fourni
        if (primaryGuestInfo?.email && primaryGuestInfo.email.trim()) {
          log('info', 'Email fourni, envoi du contrat...');
          try {
            emailSent = await sendGuestContractInternal(
              primaryGuestInfo, 
              booking, 
              contractUrl, 
              policeUrl
            );
          } catch (emailError) {
            log('warn', 'Envoi email échoué (continuera sans)', { error: emailError.message });
            emailSent = false;
          }
        } else {
          log('info', 'Aucun email fourni, envoi ignoré (normal)');
          emailSent = false;
        }
      } else {
        log('info', '🎯 ÉTAPE 5/5: Envoi email ignoré (options)');
      }

    } catch (stepError) {
      log('error', 'Erreur lors du traitement principal', { error: stepError });
      throw stepError;
    }

    // 4. FINALISATION
    const processingTime = Date.now() - startTime;
    
    log('info', '🎯 Finalisation du traitement');
    await updateFinalStatus(
      bookingId,
      contractUrl,
      policeUrl,
      identityUrl,
      emailSent,
      !!requestBody.signature,
      processingTime
    );

    // 5. RÉPONSE DE SUCCÈS
    const result: ProcessingResult = {
      bookingId: bookingId,
      contractUrl: contractUrl,
      policeUrl: policeUrl,
      identityUrl: identityUrl,  // ✅ AJOUT
      emailSent: emailSent,
      documentsCount: requestBody.idDocuments.length,
      processingTime: processingTime
    };

    log('info', '🎉 TRAITEMENT TERMINÉ AVEC SUCCÈS', {
      result,
      totalTimeMs: processingTime
    });

    // ✅ DEBUG : Log de la structure de result
    log('info', '🔍 DEBUG: Structure de result', {
      hasBookingId: !!result.bookingId,
      hasContractUrl: !!result.contractUrl,
      hasPoliceUrl: !!result.policeUrl,
      resultKeys: Object.keys(result),
      resultType: typeof result
    });

    // ✅ CORRECTION : Vérifier que result a les bonnes propriétés
    if (!result.bookingId) {
      log('error', '❌ CRITICAL: result.bookingId is missing', {
        result,
        resultKeys: Object.keys(result),
        resultType: typeof result
      });
      throw new Error('bookingId manquant dans le résultat');
    }

    const responseData = {
      success: true,
      data: {
        bookingId: result.bookingId,
        contractUrl: result.contractUrl,
        policeUrl: result.policeUrl,
        identityUrl: result.identityUrl,  // ✅ AJOUT
        documentUrl: result.contractUrl, // Compatibilité
        booking: {
          ...booking,
          locked: true
        },
        // ✅ CORRECTION : Inclure les dates de réservation pour les liens ICS
        bookingDates: {
          checkIn: booking.checkIn,
          checkOut: booking.checkOut,
          numberOfGuests: booking.numberOfGuests,
          propertyName: booking.propertyName,
          airbnbCode: booking.airbnbCode,
          isICSLink: booking.airbnbCode !== 'INDEPENDENT_BOOKING'
        },
        metadata: {
          emailSent: result.emailSent,
          documentsGenerated: {
            contract: !!result.contractUrl,
            police: !!result.policeUrl,
            identity: !!result.identityUrl  // ✅ AJOUT
          },
          processingTimeMs: result.processingTime,
          completedAt: new Date().toISOString()
        },
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
      }
    };

    // ✅ DEBUG : Log de la réponse finale
    log('info', '🔍 DEBUG: Réponse finale', {
      hasData: !!responseData.data,
      hasBookingId: !!responseData.data.bookingId,
      dataKeys: Object.keys(responseData.data),
      responseDataString: JSON.stringify(responseData).substring(0, 200) + '...'
    });

    return new Response(JSON.stringify(responseData), {
      status: 200,
      headers: corsHeaders
    });

  } catch (error) {
    const processingTime = Date.now() - startTime;
    
    log('error', '💥 ERREUR FATALE', {
      error: error instanceof Error ? error.message : 'Erreur inconnue',
      stack: error instanceof Error ? error.stack : undefined,
      processingTimeMs: processingTime
    });
    
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Erreur interne du serveur',
      details: error instanceof Error ? error.stack : undefined,
      metadata: {
        processingTimeMs: processingTime,
        failedAt: new Date().toISOString()
      }
    }), {
      status: 500,
      headers: corsHeaders
    });
  }
});

// =====================================================
// FONCTIONS HELPERS POUR GÉNÉRATION PDF CONTRAT
// =====================================================

// Helper functions for French formatting
const fmtFR = (d: any) => d ? new Date(d).toLocaleDateString('fr-FR') : '…';
const docTypeFR = (t: any) => {
  if (!t) return 'Document';
  const s = t.toLowerCase();
  if (s.includes('passport')) return 'Passeport';
  if (s.includes('cin') || s.includes('id')) return 'CIN';
  return t;
};

// Normalize address from various formats
function normalizeAddress(addr: any): string {
  if (!addr) return '';
  if (typeof addr === 'string') return addr.trim();
  try {
    const { line1, line2, city, country } = addr;
    return [line1, line2, city, country].filter(Boolean).join(', ');
  } catch {
    return '';
  }
}

// Helper function to calculate duration between dates
function calculateDuration(checkInDate: string, checkOutDate: string): string {
  if (!checkInDate || !checkOutDate) {
    return 'Non spécifiée';
  }
  try {
    const start = new Date(checkInDate);
    const end = new Date(checkOutDate);
    const diffTime = Math.abs(end.getTime() - start.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 1) {
      return '1 jour';
    } else if (diffDays < 7) {
      return `${diffDays} jours`;
    } else if (diffDays < 30) {
      const weeks = Math.floor(diffDays / 7);
      const remainingDays = diffDays % 7;
      if (remainingDays === 0) {
        return `${weeks} semaine${weeks > 1 ? 's' : ''}`;
      } else {
        return `${weeks} semaine${weeks > 1 ? 's' : ''} et ${remainingDays} jour${remainingDays > 1 ? 's' : ''}`;
      }
    } else {
      const months = Math.floor(diffDays / 30);
      const remainingDays = diffDays % 30;
      if (remainingDays === 0) {
        return `${months} mois`;
      } else {
        return `${months} mois et ${remainingDays} jour${remainingDays > 1 ? 's' : ''}`;
      }
    }
  } catch (error) {
    console.error('Error calculating duration:', error);
    return 'Non spécifiée';
  }
}

// Utility functions for template engine
function safeGet(obj: any, path: string[], def: any = '') {
  try {
    let cur = obj;
    for (const k of path) cur = cur?.[k];
    return cur ?? def;
  } catch {
    return def;
  }
}

function frDate(iso: string): string {
  return iso ? new Date(iso).toLocaleDateString('fr-FR') : '';
}

function diffDays(a: string, b: string): number {
  const d1 = new Date(a), d2 = new Date(b);
  return Math.max(1, Math.ceil((+d2 - +d1) / 86400000));
}

function durationHuman(days: number): string {
  if (days === 1) return '1 jour';
  if (days < 7) return `${days} jours`;
  if (days < 30) {
    const w = Math.floor(days / 7), r = days % 7;
    return r ? `${w} semaine${w > 1 ? 's' : ''} et ${r} jour${r > 1 ? 's' : ''}` : `${w} semaine${w > 1 ? 's' : ''}`;
  }
  const m = Math.floor(days / 30), r = days % 30;
  return r ? `${m} mois et ${r} jour${r > 1 ? 's' : ''}` : `${m} mois`;
}

// Context builder pour centraliser toutes les données du contrat avec variabilisation complète
async function buildContractContext(client: any, bookingId: string): Promise<any> {
  log('info', '[buildContractContext] Searching for booking with ID:', { bookingId });
  
  const { data: b, error } = await client
    .from('bookings')
    .select(`
      *,
      property:properties(*),
      guests(*)
    `)
    .eq('id', bookingId)
    .maybeSingle();

  log('info', '[buildContractContext] Query result:', {
    hasData: !!b,
    error: error?.message
  });

  if (error) {
    log('error', '[buildContractContext] Database error:', { error });
    throw new Error(`Database error: ${error.message}`);
  }

  if (!b) {
    log('error', '[buildContractContext] No booking found for ID:', { bookingId });
    throw new Error('Booking not found');
  }

  log('info', '[buildContractContext] Booking found:', {
    id: b.id,
    propertyId: b.property_id,
    checkIn: b.check_in_date,
    checkOut: b.check_out_date,
    hasProperty: !!b.property,
    guestsCount: b.guests?.length || 0,
    // ✅ DEBUG : Vérifier que contract_template est bien récupéré
    hasContractTemplate: !!b.property?.contract_template,
    contractTemplateType: typeof b.property?.contract_template,
    contractTemplateKeys: b.property?.contract_template ? Object.keys(b.property.contract_template) : []
  });

  // ✅ VARIABILISATION COMPLÈTE : Récupération host profile avec toutes les données
  let host = null;
  if (b?.property?.user_id) {
    // ✅ host_profiles n'a pas de colonne email (email récupéré via contract_template/contact_info)
    const { data: hp } = await client
      .from('host_profiles')
      .select(`
        id,
        full_name,
        first_name,
        last_name,
        phone,
        avatar_url,
        signature_svg,
        signature_image_url,
        company_name,
        tax_id,
        created_at,
        updated_at
      `)
      .eq('id', b.property.user_id)
      .maybeSingle();
    
    host = hp ?? null;
    log('info', '[buildContractContext] Host profile loaded:', {
      hasHost: !!host,
      hasSignatureSvg: !!host?.signature_svg,
      hasSignatureImage: !!host?.signature_image_url,
      hasCompany: !!host?.company_name
    });
  }

  const prop = b.property ?? {};
  const contact_info = prop.contact_info ?? {};
  const contract_template = prop.contract_template ?? {};
  const owner_identity = prop.owner_identity ?? {};
  const rules = Array.isArray(prop.house_rules) ? prop.house_rules.filter(Boolean) : [];

  // ✅ VARIABILISATION selon la logique frontend : contract_template prioritaire
  // Priorité: contract_template -> host_profiles -> contact_info -> fallback
  const contractTemplate = prop.contract_template || {};
  
  // ✅ DEBUG : Log détaillé du contract_template pour vérifier qu'il est bien récupéré
  log('info', '[buildContractContext] Contract template analysis:', {
    hasContractTemplate: !!contractTemplate,
    contractTemplateType: typeof contractTemplate,
    contractTemplateKeys: contractTemplate && typeof contractTemplate === 'object' ? Object.keys(contractTemplate) : [],
    landlordName: (contractTemplate as any)?.landlord_name || 'NON DÉFINI',
    landlordEmail: (contractTemplate as any)?.landlord_email || 'NON DÉFINI',
    landlordPhone: (contractTemplate as any)?.landlord_phone || 'NON DÉFINI',
    landlordAddress: (contractTemplate as any)?.landlord_address || 'NON DÉFINI',
    hasLandlordSignature: !!(contractTemplate as any)?.landlord_signature,
    propertyId: prop.id,
    propertyName: prop.name
  });
  
  const hostName = contractTemplate.landlord_name || 
    host?.full_name || 
    (host?.first_name && host?.last_name ? `${host.first_name} ${host.last_name}` : '') ||
    host?.first_name || host?.last_name ||
    contact_info?.name || 
    prop.name || 
    'Propriétaire';

  const hostEmail = contractTemplate.landlord_email || host?.email || contact_info?.email || null;
  const hostPhone = contractTemplate.landlord_phone || host?.phone || contact_info?.phone || null;
  const hostAddress = contractTemplate.landlord_address || host?.address || contact_info?.address || prop.address || null;
  
  // ✅ Informations entreprise selon configuration frontend
  const hostStatus = contractTemplate.landlord_status || 'particulier'; // particulier/entreprise
  const hostCompany = contractTemplate.landlord_company || host?.company_name || contact_info?.company_name || null;
  const hostRegistration = contractTemplate.landlord_registration || host?.tax_id || owner_identity?.ice || null;
  
  // ✅ Identités fiscales et légales (pour compatibilité)
  const hostCIN = host?.cin || owner_identity?.cin || null;
  const hostICE = hostRegistration || host?.ice || owner_identity?.ice || host?.tax_id || null;
  const hostTaxId = host?.tax_id || owner_identity?.tax_id || null;

  // ✅ VARIABILISATION SIGNATURE selon logique frontend
  let hostSignature = null;
  let hostSignatureType = null;

  // Vérifier si une valeur est une vraie signature (pas un placeholder texte)
  const isRealSignature = (val: string | null | undefined): boolean => {
    if (!val || typeof val !== 'string' || val.length < 80) return false;
    const placeholder = /^VOTRE_SIGNATURE_ICI|^signature\s*$|^\[.*\]$/i;
    if (placeholder.test(val.trim())) return false;
    return val.startsWith('data:image/') || val.startsWith('http://') || val.startsWith('https://');
  };

  const rawLandlordSig = contractTemplate.landlord_signature;
  // Priorité: contract_template.landlord_signature (si valide) -> host_profiles -> autres
  if (rawLandlordSig && isRealSignature(rawLandlordSig)) {
    hostSignature = rawLandlordSig;
    hostSignatureType = rawLandlordSig.startsWith('data:image/svg') ? 'svg' : 'image';
  } else if (host?.signature_svg) {
    hostSignature = host.signature_svg;
    hostSignatureType = 'svg';
  } else if (host?.signature_image_url) {
    hostSignature = host.signature_image_url;
    hostSignatureType = 'image';
  } else if (contract_template?.landlord_signature_url && isRealSignature(contract_template.landlord_signature_url)) {
    hostSignature = contract_template.landlord_signature_url;
    hostSignatureType = 'image';
  }

  // ✅ Signature par réservation : si le host a signé pour cette réservation (dashboard), l'utiliser en dernier recours
  if (!hostSignature) {
    const { data: hostSigRow } = await client
      .from('host_signatures')
      .select('signature_data')
      .eq('booking_id', bookingId)
      .order('signed_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (hostSigRow?.signature_data && isRealSignature(hostSigRow.signature_data)) {
      hostSignature = hostSigRow.signature_data;
      hostSignatureType = hostSigRow.signature_data.startsWith('data:image/svg') ? 'svg' : 'image';
      log('info', '[buildContractContext] Signature host utilisée depuis host_signatures (réservation)', { bookingId });
    }
  }

  if (rawLandlordSig && !hostSignature) {
    log('warn', '[buildContractContext] landlord_signature ignoré (placeholder ou invalide), fallback host_profiles utilisé', {
      length: rawLandlordSig?.length,
      preview: rawLandlordSig?.substring(0, 40)
    });
  }

  log('info', '[buildContractContext] Host signature resolution:', {
    hasSignature: !!hostSignature,
    signatureType: hostSignatureType,
    source: hostSignature ? (
      host?.signature_svg ? 'host_svg' :
      host?.signature_image_url ? 'host_image' :
      contract_template?.landlord_signature ? 'template_signature' :
      'template_url'
    ) : 'none'
  });

  // ✅ SIMPLIFICATION : Récupération directe depuis la table guests (source principale)
  let guests = Array.isArray(b.guests) ? b.guests : [];
  
  // Si pas de guests dans la relation, récupérer directement depuis la table
  if (!guests.length) {
    log('warn', '[buildContractContext] Aucun guest dans relation, tentative récupération depuis table guests');
    const { data: guestsData, error: guestsError } = await client
      .from('guests')
      .select('*')
      .eq('booking_id', bookingId);
    
    if (guestsError) {
      log('error', '[buildContractContext] Erreur récupération guests', { error: guestsError });
    } else if (guestsData && guestsData.length > 0) {
      guests = guestsData;
      log('info', '[buildContractContext] Guests récupérés depuis table', { count: guests.length });
    }
  }
  
  // ✅ CRITIQUE : Fallback - Récupérer d'abord depuis guest_submissions si disponible
  if (!guests.length) {
    log('warn', '[buildContractContext] Aucun guest trouvé, tentative récupération depuis guest_submissions');
    const { data: submissionsData, error: submissionsError } = await client
      .from('guest_submissions')
      .select('*')
      .eq('booking_id', bookingId)
      .order('created_at', { ascending: false })
      .limit(1);

    if (!submissionsError && submissionsData && submissionsData.length > 0) {
      const submission = submissionsData[0];
      log('info', '[buildContractContext] Submission trouvée', {
        hasGuestData: !!submission.guest_data,
        guestDataType: typeof submission.guest_data
      });
      
      // ✅ CRITIQUE : Essayer de récupérer les guests depuis la soumission
      if (submission.guest_data && typeof submission.guest_data === 'object') {
        const guestData = submission.guest_data as any;
        
        // Essayer plusieurs formats possibles
        let guestsArray: any[] = [];
        
        if (guestData.guests && Array.isArray(guestData.guests)) {
          guestsArray = guestData.guests;
        } else if (Array.isArray(guestData)) {
          guestsArray = guestData;
        } else if (guestData.fullName || guestData.full_name) {
          // Format avec un seul guest directement dans guest_data
          guestsArray = [guestData];
        }
        
        if (guestsArray.length > 0) {
          guests = guestsArray.map((g: any) => {
            // ✅ CRITIQUE : Normaliser toutes les variantes de noms de champs
            const normalizedGuest = {
              full_name: g.fullName || g.full_name || g.name || '',
              email: g.email || b.guest_email || null,
              phone: g.phone || b.guest_phone || null,
              nationality: g.nationality || 'Non spécifiée',
              document_type: g.documentType || g.document_type || g.idType || 'passport',
              document_number: g.documentNumber || g.document_number || g.idNumber || g.document_number || '',
              date_of_birth: g.dateOfBirth || g.date_of_birth || g.dateOfBirth || null,
            place_of_birth: g.placeOfBirth || g.place_of_birth || '',
            profession: g.profession || '',
              motif_sejour: g.motifSejour || g.motif_sejour || 'TOURISME',
              adresse_personnelle: g.adressePersonnelle || g.adresse_personnelle || ''
            };
            
            log('info', '[buildContractContext] Guest normalisé depuis submission', {
              hasDateOfBirth: !!normalizedGuest.date_of_birth,
              hasDocumentNumber: !!normalizedGuest.document_number,
              hasNationality: !!normalizedGuest.nationality && normalizedGuest.nationality !== 'Non spécifiée'
            });
            
            return normalizedGuest;
          });
          
          log('info', '[buildContractContext] ✅ Guests récupérés depuis guest_submissions', { 
            count: guests.length,
            firstGuest: guests[0] ? {
              name: guests[0].full_name,
              hasDateOfBirth: !!guests[0].date_of_birth,
              hasDocumentNumber: !!guests[0].document_number,
              nationality: guests[0].nationality
            } : null
          });
        } else {
          log('warn', '[buildContractContext] Aucun guest trouvé dans guest_data', { guestData });
        }
      } else {
        log('warn', '[buildContractContext] guest_data n\'est pas un objet valide', { 
          type: typeof submission.guest_data,
          value: submission.guest_data 
          });
        }
      }
  }
  
  // ✅ CRITIQUE : Fallback final - utiliser les données du booking si toujours pas de guests
  const hasGuestName = b.guest_name && b.guest_name.trim().length > 0;
  log('info', '[buildContractContext] Vérification fallback final guest', {
    hasGuests: guests.length > 0,
    hasGuestName: hasGuestName,
    guestName: b.guest_name,
    guestEmail: b.guest_email,
    guestPhone: b.guest_phone
  });
  
  if (!guests.length && hasGuestName) {
    log('warn', '[buildContractContext] ⚠️ Création guest virtuel - DONNÉES INCOMPLÈTES - Le contrat ne sera pas entièrement variabilisé');
    guests = [{
      full_name: b.guest_name.trim(),
      email: b.guest_email || null,
      phone: b.guest_phone || null,
      nationality: 'Non spécifiée',
      document_type: 'passport',
      document_number: '',
      date_of_birth: null,
      place_of_birth: '',
      profession: '',
      motif_sejour: 'TOURISME',
      adresse_personnelle: ''
    }];
    log('info', '[buildContractContext] ✅ Guest virtuel créé depuis booking (DONNÉES INCOMPLÈTES)', { 
      name: guests[0].full_name,
      email: guests[0].email,
      phone: guests[0].phone,
      warning: '⚠️ date_of_birth, nationality, document_number manquants - Le contrat ne sera pas entièrement variabilisé'
    });
    }
  
  log('info', '[buildContractContext] Guests finaux', {
    count: guests.length,
    hasGuests: guests.length > 0,
    firstGuest: guests[0] ? {
      name: guests[0].full_name,
      email: guests[0].email,
      phone: guests[0].phone
    } : null
  });

  // ✅ VARIABILISATION : Règles de maison avec fallback intelligent
  const houseRules = rules.length ? rules : [
    'Aucun invité non autorisé ou fête',
    'Interdiction de fumer à l\'intérieur du bien',
    'Respecter les voisins et les règles de l\'immeuble',
    'Signaler immédiatement tout dommage',
    'Libérer les lieux à l\'heure convenue'
  ];

  const dDays = diffDays(b.check_in_date, b.check_out_date);

  // ✅ CONTEXTE ENRICHI selon la structure frontend
  const ctx = {
    host: {
      // Informations principales
      name: hostName,
      full_name: hostName,
      first_name: host?.first_name || '',
      last_name: host?.last_name || '',
      
      // Informations de contact
      email: hostEmail || undefined,
      phone: hostPhone || undefined,
      address: hostAddress || undefined,
      
      // Configuration selon frontend
      status: hostStatus, // particulier/entreprise
      company_name: hostCompany || undefined,
      registration: hostRegistration || undefined,
      
      // Identités légales (rétrocompatibilité)
      cin: hostCIN || undefined,
      ice: hostICE || undefined,
      tax_id: hostTaxId || undefined,
      
      // Signature (signatureType pour compatibilité PDF, signature_type pour cohérence)
      signature: hostSignature,
      signatureType: hostSignatureType ?? undefined,
      signature_type: hostSignatureType,
      signature_svg: host?.signature_svg || null,
      signature_image_url: host?.signature_image_url || null,
      
      // Contract template fields (accès direct)
      contract_template: contractTemplate
    },
    property: {
      id: prop.id,
      name: prop.name || 'Propriété',
      address: prop.address || '',
      city: prop.city || '',
      country: prop.country || 'Maroc',
      property_type: prop.property_type || 'apartment',
      max_occupancy: prop.max_occupancy || 4,
      max_guests: prop.max_guests || prop.max_occupancy || 4,
      price_per_night: prop.price_per_night || null,
      description: prop.description || '',
      photo_url: prop.photo_url || null,
      is_active: prop.is_active !== false,
      contact: {
        email: contact_info?.email || hostEmail,
        phone: contact_info?.phone || hostPhone,
        address: contact_info?.address || hostAddress,
        name: contact_info?.name || hostName
      },
      contract_template: contract_template,
      owner_identity: owner_identity,
      house_rules: houseRules
    },
    booking: {
      id: b.id,
      property_id: b.property_id,
      check_in: b.check_in_date,
      check_out: b.check_out_date,
      check_in_date: b.check_in_date,
      check_out_date: b.check_out_date,
      number_of_guests: b.number_of_guests || guests.length || 1,
      guests_count: b.number_of_guests || guests.length || 1,
      booking_reference: b.booking_reference || null,
      guest_name: b.guest_name || (guests[0]?.full_name) || '',
      guest_email: b.guest_email || guests[0]?.email || null,
      guest_phone: b.guest_phone || guests[0]?.phone || null,
      total_price: b.total_price || null,
      total_amount: b.total_amount || b.total_price || null,
      currency: 'MAD',
      status: b.status || 'pending',
      ref: `BKG-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${String(b.id).slice(0, 8)}`,
      duration_days: dDays,
      duration_human: durationHuman(dDays),
      created_at: b.created_at,
      updated_at: b.updated_at
    },
    guests: guests.map((g: any) => ({
      full_name: g.full_name || '',
      date_of_birth: g.date_of_birth || '',
      nationality: g.nationality || '',
      document_type: g.document_type || 'passport',
      document_number: g.document_number || '',
      place_of_birth: g.place_of_birth || '',
      profession: g.profession || '',
      motif_sejour: g.motif_sejour || g.motifSejour || 'TOURISME',
      adresse_personnelle: g.adresse_personnelle || g.adressePersonnelle || '',
      email: g.email || ''
    })),
    // ✅ Métadonnées pour le template
    metadata: {
      generated_at: new Date().toISOString(),
      template_version: '2.0',
      includes_signature: !!hostSignature,
      guests_count: guests.length,
      has_host_profile: !!host,
      has_contract_template: !!Object.keys(contract_template).length
    }
  };

  log('info', '[buildContractContext] Context built successfully:', {
    hostName: ctx.host.name,
    propertyName: ctx.property.name,
    guestsCount: ctx.guests.length,
    hasSignature: !!ctx.host.signature,
    hasCompany: !!ctx.host.company_name,
    hasHouseRules: ctx.property.house_rules.length
  });

  return ctx;
}

// Storage helpers
const DEFAULT_BUCKET = Deno.env.get('STORAGE_BUCKET') || 'guest-documents';
const BUCKET_SHOULD_BE_PUBLIC = (Deno.env.get('STORAGE_BUCKET_PUBLIC') ?? 'true').toLowerCase() === 'true';

async function ensureBucketExists(client: any, bucket: string) {
  try {
    const { data, error } = await client.storage.getBucket(bucket);
    if (data && !error) {
      log('info', 'Bucket exists:', { bucket, isPublic: data.public });
      return { name: bucket, isPublic: !!data.public };
    }
    
    if (error && (error.status === 404 || error.statusCode === '404')) {
      log('info', 'Bucket missing, creating:', { bucket, isPublic: BUCKET_SHOULD_BE_PUBLIC });
      const { error: createErr } = await client.storage.createBucket(bucket, {
        public: BUCKET_SHOULD_BE_PUBLIC
      });
      if (createErr && createErr.status !== 409) throw createErr;
      log('info', 'Bucket created:', { bucket });
      return { name: bucket, isPublic: BUCKET_SHOULD_BE_PUBLIC };
    }
    
    return { name: bucket, isPublic: false };
  } catch (e) {
    log('warn', 'ensureBucketExists error:', e);
    return { name: bucket, isPublic: false };
  }
}

// Upload PDF to Storage and return public/signed URL
async function uploadPdfToStorage(client: any, bookingId: string, pdfBytes: Uint8Array, documentType: string = 'contract'): Promise<string> {
  log('info', `Uploading ${documentType} PDF to Storage`);
  
  // ✅ CORRECTION : Utiliser le bucket guest-documents pour compatibilité interface hôte
  const { name: bucket, isPublic } = await ensureBucketExists(client, 'guest-documents');
  const path = `${documentType}/${bookingId}/${documentType}-${Date.now()}.pdf`;
  
  const blob = new Blob([pdfBytes], { type: 'application/pdf' });
  
  const { error: upErr } = await client.storage
    .from(bucket)
    .upload(path, blob, {
      upsert: true,
      contentType: 'application/pdf'
    });
    
  if (upErr) throw upErr;
  
  if (isPublic) {
    const { data: pub } = client.storage.from(bucket).getPublicUrl(path);
    if (pub?.publicUrl) {
      log('info', 'PDF uploaded, returning PUBLIC URL');
      return pub.publicUrl;
    }
  }
  
  const { data: signed, error: signErr } = await client.storage
    .from(bucket)
    .createSignedUrl(path, 3600);
    
  if (signErr || !signed?.signedUrl) throw signErr ?? new Error('No signed URL');
  
  log('info', 'PDF uploaded, returning SIGNED URL');
  return signed.signedUrl;
}

// Save document to database with unified approach
// ✅ CORRECTION MAJEURE : Gestion des versions pour éviter l'écrasement
async function saveDocumentToDatabase(client: any, bookingId: string, documentType: string, documentUrl: string, isSigned: boolean = false) {
  const fileName = `${documentType}-${bookingId}-${Date.now()}.pdf`;
  
  // ✅ CORRECTION : Gestion intelligente des versions de contrats
  try {
    // Pour les contrats, gérer les versions signées vs non signées
    if (documentType === 'contract') {
      // Récupérer TOUS les contrats existants pour ce booking
      const { data: existingContracts } = await client
        .from('generated_documents')
        .select('id, is_signed, document_url, created_at')
        .eq('booking_id', bookingId)
        .eq('document_type', 'contract')
        .order('created_at', { ascending: false });

      if (existingContracts && existingContracts.length > 0) {
        // Trouver le contrat signé le plus récent s'il existe
        const signedContract = existingContracts.find(c => c.is_signed);
        const latestContract = existingContracts[0];
        
        if (isSigned) {
          if (signedContract) {
            // ✅ Un contrat signé existe déjà - créer une nouvelle VERSION (ne pas écraser)
            log('info', 'Signed contract exists, creating new version', {
              existingId: signedContract.id,
              newUrl: documentUrl.substring(0, 50)
            });
            // Continuer pour créer une nouvelle entrée (version)
          } else {
            // Pas de contrat signé - mettre à jour le non-signé vers signé
            log('info', 'Upgrading unsigned contract to signed version');
            await client
              .from('generated_documents')
              .update({
                document_url: documentUrl,
                is_signed: true,
                updated_at: new Date().toISOString()
              })
              .eq('id', latestContract.id);
            
            // Mettre à jour aussi uploaded_documents
            await client
              .from('uploaded_documents')
              .update({
                document_url: documentUrl,
                is_signed: true,
                updated_at: new Date().toISOString()
              })
              .eq('booking_id', bookingId)
              .eq('document_type', 'contract');
            
            return latestContract;
          }
        } else {
          // Nouveau contrat non signé
          if (signedContract) {
            // ❌ Ne pas remplacer un contrat signé par un non signé
            log('warn', 'Cannot replace signed contract with unsigned version, returning existing');
            return signedContract;
          } else if (latestContract.document_url === documentUrl) {
            // Même URL - pas de duplication
            log('info', 'Contract with same URL already exists, skipping');
            return latestContract;
          } else {
            // ✅ Mettre à jour le contrat non signé existant
            log('info', 'Updating existing unsigned contract');
            await client
              .from('generated_documents')
              .update({
                document_url: documentUrl,
                updated_at: new Date().toISOString()
              })
              .eq('id', latestContract.id);
            return latestContract;
          }
        }
      }
    } else if (documentType === 'police') {
      // ✅ CORRECTION : Pour les fiches de police, REMPLACER l'existante (pas créer de doublon)
      const { data: allExistingPolice } = await client
        .from('generated_documents')
        .select('id, document_url, created_at')
        .eq('booking_id', bookingId)
        .eq('document_type', 'police')
        .order('created_at', { ascending: false });

      if (allExistingPolice && allExistingPolice.length > 0) {
        const existingPolice = allExistingPolice[0]; // La plus récente
        
        if (existingPolice.document_url === documentUrl) {
          log('info', 'Police form with same URL already exists, skipping');
          return existingPolice;
        }
        
        // ✅ CORRECTION : Supprimer TOUTES les anciennes fiches de police pour éviter les doublons
        if (allExistingPolice.length > 1) {
          const oldPoliceIds = allExistingPolice.slice(1).map(p => p.id);
          log('info', '🗑️ Suppression des anciennes fiches de police', { count: oldPoliceIds.length });
          await client
            .from('generated_documents')
            .delete()
            .in('id', oldPoliceIds);
        }
        
        // ✅ Mettre à jour la fiche existante avec la nouvelle URL
        log('info', 'Updating existing police form with new URL (signed version)');
        await client
          .from('generated_documents')
          .update({
            document_url: documentUrl,
            is_signed: isSigned,
            updated_at: new Date().toISOString()
          })
          .eq('id', existingPolice.id);
        
        // ✅ Mettre à jour aussi uploaded_documents
        await client
          .from('uploaded_documents')
          .update({
            document_url: documentUrl,
            is_signed: isSigned,
            updated_at: new Date().toISOString()
          })
          .eq('booking_id', bookingId)
          .eq('document_type', 'police');
        
        return existingPolice;
      }
    } else if (documentType === 'identity') {
      // ✅ Pour identity, permettre plusieurs documents (un par invité)
      // Mais vérifier si cette URL exacte existe déjà
      const { data: existingIdentity } = await client
        .from('generated_documents')
        .select('id')
        .eq('booking_id', bookingId)
        .eq('document_type', 'identity')
        .eq('document_url', documentUrl)
        .maybeSingle();
        
      if (existingIdentity) {
        log('info', 'Identity document with same URL already exists, skipping duplicate');
        return existingIdentity;
      }
    } else {
      // Autres types de documents
      const { data: existingGenerated } = await client
        .from('generated_documents')
        .select('id')
        .eq('booking_id', bookingId)
        .eq('document_type', documentType)
        .maybeSingle();

      if (existingGenerated) {
        log('warn', `Document ${documentType} already exists for booking ${bookingId}, updating`);
        await client
          .from('generated_documents')
          .update({
            document_url: documentUrl,
            updated_at: new Date().toISOString()
          })
          .eq('id', existingGenerated.id);
        return existingGenerated;
      }
    }

    // ✅ Générer un nom de fichier basé sur le type de document
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const fileName = `${documentType}-${bookingId.substring(0, 8)}-${timestamp}.pdf`;

    log('info', '💾 [SAVE DOCUMENT] Sauvegarde dans les tables', {
      bookingId,
      documentType,
      fileName,
      isSigned,
      hasUrl: !!documentUrl
    });

    // 1. Sauvegarder dans generated_documents (table principale)
    const { data: generatedRecord, error: generatedError } = await client
      .from('generated_documents')
      .insert({
        booking_id: bookingId,
        file_name: fileName,
        document_url: documentUrl,
        document_type: documentType,
        is_signed: isSigned,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select()
      .single();
      
    if (generatedError) {
      log('warn', 'Failed to save to generated_documents:', generatedError);
    } else {
      log('info', 'Document saved to generated_documents');
    }

    // 2. Sauvegarder aussi dans uploaded_documents pour compatibilité interface hôte
    // ✅ CORRECTION : Toujours synchroniser avec uploaded_documents
    const { data: existingUploaded } = await client
      .from('uploaded_documents')
      .select('id')
      .eq('booking_id', bookingId)
      .eq('document_type', documentType)
      .maybeSingle();

    if (existingUploaded) {
      // Mettre à jour l'enregistrement existant
      const { error: updateError } = await client
        .from('uploaded_documents')
        .update({
          document_url: documentUrl,
          is_signed: isSigned,
          updated_at: new Date().toISOString()
        })
        .eq('id', existingUploaded.id);
        
      if (updateError) {
        log('warn', 'Failed to update uploaded_documents:', updateError);
      } else {
        log('info', 'Updated existing uploaded_documents record');
      }
    } else {
      // Créer un nouvel enregistrement
      const { data: uploadedRecord, error: uploadedError } = await client
        .from('uploaded_documents')
        .insert({
          booking_id: bookingId,
          file_name: fileName,
          document_url: documentUrl,
          file_path: documentUrl, // Même valeur que document_url
          document_type: documentType,
          is_signed: isSigned,
          processing_status: 'completed',
          created_at: new Date().toISOString()
        })
        .select()
        .single();
        
      if (uploadedError) {
        log('warn', 'Failed to save to uploaded_documents:', uploadedError);
      } else {
        log('info', 'Document saved to uploaded_documents for host interface compatibility');
      }
    }

    // Retourner le record principal (generated_documents)
    return generatedRecord;
  } catch (error) {
    log('error', 'Failed to save document to database:', error);
    throw new Error(`Failed to save document to database: ${error.message}`);
  }
}

// Traductions du contrat (FR / EN / ES) pour génération PDF selon la langue guest/hôte
type ContractStrings = Record<string, string> & { defaultRules: string[] };
function getContractStrings(locale: string): ContractStrings {
  const L: Record<string, Record<string, string | string[]>> = {
    fr: {
      title: 'CONTRAT DE LOCATION SAISONNIÈRE',
      article1: 'ARTICLE 1 - OBJET DE LA LOCATION',
      article2: 'ARTICLE 2 - DURÉE ET PÉRIODE',
      article3: 'ARTICLE 3 - OCCUPANTS AUTORISÉS',
      article4: 'ARTICLE 4 - RÈGLEMENT INTÉRIEUR ET OBLIGATIONS',
      article5: 'ARTICLE 5 - RESPONSABILITÉS ET ASSURANCES',
      article6: 'ARTICLE 6 - RÉSILIATION',
      article7: 'ARTICLE 7 - DROIT APPLICABLE',
      tenantLabel: 'Le Locataire',
      landlordLabel: 'Le Bailleur',
      durationIntro: 'La location est consentie pour une durée déterminée du',
      durationTo: 'à 16h00 au',
      durationEnd: 'à 11h00. Cette période ne pourra être prolongée qu\'avec l\'accord écrit préalable du Bailleur.',
      occupantsIntro: 'Le logement sera occupé par',
      occupantsPersons: 'personne(s) maximum. Liste des occupants autorisés :',
      occupantsForbidden: 'Toute personne non mentionnée ci-dessus est strictement interdite dans le logement.',
      rulesIntro: 'Le locataire s\'engage à respecter les règles suivantes :',
      article5Text: 'Le Locataire est entièrement responsable de tout dommage causé au logement, aux équipements et au mobilier. Il s\'engage à restituer le bien dans l\'état où il l\'a trouvé. Le Bailleur décline toute responsabilité en cas de vol, perte ou dommage aux effets personnels du Locataire.',
      article6Text: 'En cas de non-respect des présentes conditions, le Bailleur se réserve le droit de procéder à la résiliation immédiate du contrat et d\'exiger la libération des lieux sans délai ni indemnité.',
      article7Text: 'Le présent contrat est régi par le droit marocain. Tout litige sera de la compétence exclusive des tribunaux de Casablanca.',
      doneAt: 'Fait à',
      onDate: 'le',
      electronicSignature: '(signature electronique)',
      bornOn: 'né(e) le',
      nationality: 'de nationalité',
      documentHolder: 'titulaire du document d\'identité n°',
      titleLine1: 'CONTRAT DE LOCATION MEUBLEE DE COURTE',
      titleLine2: 'DUREE',
      betweenParties: 'ENTRE LES SOUSSIGNÉS',
      landlordSection: 'LE BAILLEUR :',
      tenantSection: 'LE LOCATAIRE :',
      landlordDescription: 'Gestionnaire et/ou propriétaire du bien, ci-après dénommé "Le Bailleur"',
      representing: 'représentant de',
      emergencyContact: 'En cas d\'urgence, contacter le propriétaire au :',
      companyLabel: 'Entreprise :',
      rcLabel: 'RC :',
      iceLabel: 'ICE :',
      taxIdLabel: 'ID Fiscal :',
      signatureLandlordLabel: 'LE BAILLEUR',
      signatureTenantLabel: 'LE LOCATAIRE',
      dateLabel: 'Date :',
      signatureValidated: 'Signature électronique locataire validée le',
      pageLabel: 'Page',
      defaultRules: [
        'Aucun invité non autorisé ou fête',
        'Interdiction de fumer à l\'intérieur du bien',
        'Respecter les voisins et les règles de l\'immeuble',
        'Signaler immédiatement tout dommage',
        'Libérer les lieux à l\'heure convenue',
      ],
    },
    en: {
      title: 'SEASONAL RENTAL AGREEMENT',
      article1: 'ARTICLE 1 - OBJECT OF THE RENTAL',
      article2: 'ARTICLE 2 - DURATION AND PERIOD',
      article3: 'ARTICLE 3 - AUTHORIZED OCCUPANTS',
      article4: 'ARTICLE 4 - HOUSE RULES AND OBLIGATIONS',
      article5: 'ARTICLE 5 - LIABILITY AND INSURANCE',
      article6: 'ARTICLE 6 - TERMINATION',
      article7: 'ARTICLE 7 - APPLICABLE LAW',
      tenantLabel: 'The Tenant',
      landlordLabel: 'The Landlord',
      durationIntro: 'The rental is granted for a fixed period from',
      durationTo: 'at 4:00 PM to',
      durationEnd: 'at 11:00 AM. This period may only be extended with the prior written consent of the Landlord.',
      occupantsIntro: 'The property will be occupied by a maximum of',
      occupantsPersons: 'person(s). List of authorized occupants:',
      occupantsForbidden: 'Any person not listed above is strictly prohibited from the property.',
      rulesIntro: 'The tenant agrees to comply with the following rules:',
      article5Text: 'The Tenant is fully responsible for any damage to the property, equipment and furnishings. The Tenant agrees to return the property in the same condition as found. The Landlord disclaims any liability for theft, loss or damage to the Tenant\'s personal belongings.',
      article6Text: 'In case of breach of these conditions, the Landlord reserves the right to terminate the agreement immediately and require the premises to be vacated without delay or compensation.',
      article7Text: 'This agreement is governed by Moroccan law. Any dispute shall fall under the exclusive jurisdiction of the courts of Casablanca.',
      doneAt: 'Done at',
      onDate: 'on',
      electronicSignature: '(electronic signature)',
      bornOn: 'born on',
      nationality: 'nationality',
      documentHolder: 'holder of identity document no.',
      titleLine1: 'FURNISHED SHORT-TERM',
      titleLine2: 'RENTAL AGREEMENT',
      betweenParties: 'BETWEEN THE UNDERSIGNED',
      landlordSection: 'THE LANDLORD:',
      tenantSection: 'THE TENANT:',
      landlordDescription: 'Manager and/or owner of the property, hereinafter referred to as "The Landlord"',
      representing: 'representative of',
      emergencyContact: 'In case of emergency, contact the owner at:',
      companyLabel: 'Company:',
      rcLabel: 'RC:',
      iceLabel: 'ICE:',
      taxIdLabel: 'Tax ID:',
      signatureLandlordLabel: 'THE LANDLORD',
      signatureTenantLabel: 'THE TENANT',
      dateLabel: 'Date:',
      signatureValidated: 'Tenant electronic signature validated on',
      pageLabel: 'Page',
      defaultRules: [
        'No unauthorized guests or parties',
        'No smoking inside the property',
        'Respect neighbors and building rules',
        'Report any damage immediately',
        'Check-out by agreed time',
      ],
    },
    es: {
      title: 'CONTRATO DE ALQUILER TEMPORAL',
      article1: 'ARTÍCULO 1 - OBJETO DEL ALQUILER',
      article2: 'ARTÍCULO 2 - DURACIÓN Y PERÍODO',
      article3: 'ARTÍCULO 3 - OCUPANTES AUTORIZADOS',
      article4: 'ARTÍCULO 4 - NORMAS Y OBLIGACIONES',
      article5: 'ARTÍCULO 5 - RESPONSABILIDAD Y SEGUROS',
      article6: 'ARTÍCULO 6 - RESCISIÓN',
      article7: 'ARTÍCULO 7 - LEY APLICABLE',
      tenantLabel: 'El Inquilino',
      landlordLabel: 'El Arrendador',
      durationIntro: 'El alquiler se concede por un período determinado del',
      durationTo: 'a las 16:00 al',
      durationEnd: 'a las 11:00. Este período solo podrá prorrogarse con el consentimiento previo por escrito del Arrendador.',
      occupantsIntro: 'La propiedad será ocupada por un máximo de',
      occupantsPersons: 'persona(s). Lista de ocupantes autorizados:',
      occupantsForbidden: 'Cualquier persona no mencionada arriba tiene prohibida la entrada a la propiedad.',
      rulesIntro: 'El inquilino se compromete a respetar las siguientes normas:',
      article5Text: 'El Inquilino es plenamente responsable de cualquier daño a la propiedad, equipamiento y mobiliario. Se compromete a devolver el bien en el mismo estado. El Arrendador declina toda responsabilidad por robo, pérdida o daño a los efectos personales del Inquilino.',
      article6Text: 'En caso de incumplimiento de estas condiciones, el Arrendador se reserva el derecho de rescindir el contrato de inmediato y exigir la desocupación sin demora ni indemnización.',
      article7Text: 'Este contrato se rige por la ley marroquí. Cualquier litigio será de la competencia exclusiva de los tribunales de Casablanca.',
      doneAt: 'Hecho en',
      onDate: 'el',
      electronicSignature: '(firma electrónica)',
      bornOn: 'nacido/a el',
      nationality: 'nacionalidad',
      documentHolder: 'titular del documento de identidad n°',
      titleLine1: 'CONTRATO DE ALQUILER AMUEBLADO',
      titleLine2: 'DE CORTA DURACIÓN',
      betweenParties: 'ENTRE LOS ABAJO FIRMANTES',
      landlordSection: 'EL ARRENDADOR:',
      tenantSection: 'EL INQUILINO:',
      landlordDescription: 'Gestor y/o propietario del bien, en adelante denominado "El Arrendador"',
      representing: 'representante de',
      emergencyContact: 'En caso de emergencia, contactar al propietario al:',
      companyLabel: 'Empresa:',
      rcLabel: 'RC:',
      iceLabel: 'ICE:',
      taxIdLabel: 'NIF:',
      signatureLandlordLabel: 'EL ARRENDADOR',
      signatureTenantLabel: 'EL INQUILINO',
      dateLabel: 'Fecha:',
      signatureValidated: 'Firma electrónica del inquilino validada el',
      pageLabel: 'Página',
      defaultRules: [
        'No se permiten invitados no autorizados ni fiestas',
        'Prohibido fumar en el interior del inmueble',
        'Respetar a los vecinos y las normas del edificio',
        'Comunicar cualquier daño de inmediato',
        'Salida a la hora acordada',
      ],
    },
  };
  const lang = (locale && (locale === 'en' || locale === 'es' ? locale : 'fr')) as 'fr' | 'en' | 'es';
  return (L[lang] || L.fr) as ContractStrings;
}

// Generate contract PDF with pdf-lib (version simplifiée et robuste)
async function generateContractPDF(client: any, ctx: any, signOpts: any = {}): Promise<string> {
  log('info', 'Creating contract PDF with pdf-lib...');
  
  const { guestSignatureData, guestSignedAt, locale: localeParam } = signOpts;
  const locale = localeParam && ['fr', 'en', 'es'].includes(localeParam) ? localeParam : 'fr';
  const L = getContractStrings(locale);
  log('info', 'Contract PDF locale', { locale });
  const guests = ctx.guests || [];
  const property = ctx.property;
  const booking = ctx.booking;
  const host = ctx.host;

  // Locataire principal (premier invité)
  // ✅ CORRECTION : Utiliser les données du booking comme fallback si pas de guests
  const mainGuest = guests[0] || {};
  const locataireName = mainGuest.full_name || 
    booking.guest_name || 
    booking.guestName || 
    'Locataire';
  
  // ✅ Enrichir mainGuest avec les données du booking si manquantes
  if (!mainGuest.full_name && booking.guest_name) {
    mainGuest.full_name = booking.guest_name;
  }
  if (!mainGuest.date_of_birth && booking.guest_date_of_birth) {
    mainGuest.date_of_birth = booking.guest_date_of_birth;
  }
  if (!mainGuest.nationality && booking.guest_nationality) {
    mainGuest.nationality = booking.guest_nationality;
  }
  if (!mainGuest.document_number && booking.guest_document_number) {
    mainGuest.document_number = booking.guest_document_number;
  }
  if (!mainGuest.email && booking.guest_email) {
    mainGuest.email = booking.guest_email;
  }
  if (!mainGuest.phone && booking.guest_phone) {
    mainGuest.phone = booking.guest_phone;
  }
  
  // Log pour diagnostic
  log('info', 'PDF Generation - Guest data:', {
    hasGuests: guests.length > 0,
    mainGuestName: mainGuest.full_name,
    mainGuestDoc: mainGuest.document_number,
    mainGuestNationality: mainGuest.nationality,
    mainGuestEmail: mainGuest.email,
    mainGuestPhone: mainGuest.phone,
    bookingGuestName: booking.guest_name,
    bookingGuestEmail: booking.guest_email,
    bookingGuestPhone: booking.guest_phone
  });
  
  // ✅ Nom du bailleur selon la variabilisation
  const contractTemplate = ctx.property.contract_template || {};
  
  // ✅ DEBUG : Log pour vérifier que contract_template est bien utilisé dans generateContractPDF
  log('info', '[generateContractPDF] Contract template usage:', {
    hasContractTemplate: !!contractTemplate,
    contractTemplateType: typeof contractTemplate,
    contractTemplateKeys: contractTemplate && typeof contractTemplate === 'object' ? Object.keys(contractTemplate) : [],
    landlordName: (contractTemplate as any)?.landlord_name || 'NON DÉFINI',
    landlordEmail: (contractTemplate as any)?.landlord_email || 'NON DÉFINI',
    landlordPhone: (contractTemplate as any)?.landlord_phone || 'NON DÉFINI',
    propertyId: property.id,
    propertyName: property.name
  });
  
  const hostName = contractTemplate.landlord_name || 
    ctx.host?.name ||
    ctx.host?.full_name || 
    (ctx.host?.first_name && ctx.host?.last_name ? `${ctx.host.first_name} ${ctx.host.last_name}` : '') ||
    ctx.host?.first_name || ctx.host?.last_name ||
    ctx.property.contact_info?.name || 
    ctx.property.name || 
    'Propriétaire';

  // Configuration PDF (mise en page alignée sur l’aperçu HTML : marges, barres d’article, aération)
  const pageWidth = 612, pageHeight = 792;
  const margin = 50;
  const maxWidth = pageWidth - margin * 2;
  const titleSize = 16, sectionSize = 12, bodySize = 11;
  const lineGap = 16;
  const articleBarWidth = 3;
  const articleBarGap = 10;
  const accentArticle = rgb(0.29, 0.33, 0.41);
  const ruleGray = rgb(0.2, 0.2, 0.2);

  // Créer le document PDF
  const pdfDoc = await PDFDocument.create();
  
  // Fonts (fallback to Helvetica for simplicity)
  let fontRegular, fontBold;
  try {
    fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
    fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  } catch (e) {
    log('warn', 'Font loading failed, using defaults');
    fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
    fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  }

  let pages: any[] = [];
  let currentPage: any;
  let y = 0;

  function addPage() {
    const p = pdfDoc.addPage([pageWidth, pageHeight]);
    pages.push(p);
    currentPage = p;
    drawHeader();
    y = pageHeight - margin - 60;
    return p;
  }

  function ensureSpace(h: number) {
    if (y - h < margin + 50) {
      addPage();
    }
  }

  function drawHeader() {
    currentPage.drawText(property.name || L.title, {
      x: margin,
      y: pageHeight - 30,
      size: 10,
      font: fontBold
    });
    
    currentPage.drawText(`Ref: ${booking.ref}`, {
      x: pageWidth - margin - 100,
      y: pageHeight - 30,
      size: 9,
      font: fontRegular
    });
    
    // Line under header
    currentPage.drawLine({
      start: { x: margin, y: pageHeight - 35 },
      end: { x: pageWidth - margin, y: pageHeight - 35 },
      color: rgb(0, 0, 0),
      thickness: 0.5
    });
  }

  function wrapText(text: string, width: number, size: number, font: any = fontRegular): string[] {
    const words = text.split(/\s+/);
    const lines = [];
    let line = "";
    
    for (const w of words) {
      const test = line ? line + " " + w : w;
      const testWidth = font.widthOfTextAtSize(test, size);
      if (testWidth <= width) {
        line = test;
      } else {
        if (line) lines.push(line);
        line = w;
      }
    }
    if (line) lines.push(line);
    return lines;
  }

  function drawParagraph(text: string, size: number = bodySize, bold: boolean = false) {
    const font = bold ? fontBold : fontRegular;
    const lines = wrapText(text, maxWidth, size, font);
    
    for (const l of lines) {
      ensureSpace(size + 2);
      currentPage.drawText(l, {
        x: margin,
        y,
        size,
        font
      });
      y -= lineGap;
    }
  }

  /** Paragraphe avec retrait (puces / listes) */
  function drawParagraphIndented(text: string, indent: number, size: number = bodySize) {
    const lines = wrapText(text, maxWidth - indent, size, fontRegular);
    for (const l of lines) {
      ensureSpace(size + 2);
      currentPage.drawText(l, {
        x: margin + indent,
        y,
        size,
        font: fontRegular
      });
      y -= lineGap;
    }
  }

  function drawIntroSectionTitle(text: string) {
    ensureSpace(sectionSize + 10);
    currentPage.drawText(text, {
      x: margin,
      y,
      size: sectionSize,
      font: fontBold
    });
    y -= lineGap + 12;
  }

  /** Titre d’article avec barre verticale (comme l’aperçu HTML) */
  function drawArticleTitle(text: string) {
    const titleX = margin + articleBarWidth + articleBarGap;
    const barHeight = sectionSize + 6;
    ensureSpace(barHeight + 20);
    currentPage.drawRectangle({
      x: margin,
      y: y - 4,
      width: articleBarWidth,
      height: barHeight,
      color: accentArticle,
      borderWidth: 0
    });
    currentPage.drawText(text, {
      x: titleX,
      y,
      size: sectionSize,
      font: fontBold
    });
    y -= lineGap + 18;
  }

  function drawHorizontalRule(thickness = 0.75) {
    ensureSpace(10);
    currentPage.drawLine({
      start: { x: margin, y },
      end: { x: pageWidth - margin, y },
      color: ruleGray,
      thickness
    });
    y -= 20;
  }

  // Première page
  addPage();

  // Titre principal (traduit), centré comme l’aperçu HTML
  ensureSpace(titleSize + 10);
  const tw1 = fontBold.widthOfTextAtSize(L.titleLine1, titleSize);
  currentPage.drawText(L.titleLine1, {
    x: (pageWidth - tw1) / 2,
    y,
    size: titleSize,
    font: fontBold
  });
  y -= titleSize + 4;
  const tw2 = fontBold.widthOfTextAtSize(L.titleLine2, titleSize);
  currentPage.drawText(L.titleLine2, {
    x: (pageWidth - tw2) / 2,
    y,
    size: titleSize,
    font: fontBold
  });
  y -= titleSize + 18;

  currentPage.drawLine({
    start: { x: margin, y },
    end: { x: pageWidth - margin, y },
    color: rgb(0, 0, 0),
    thickness: 0.5
  });
  y -= 22;

  drawIntroSectionTitle(L.betweenParties);
  drawParagraph(L.landlordSection);
  
  let bailleurInfo = `${hostName}, `;
  if (host?.status === 'entreprise' && host?.company_name) {
    bailleurInfo += `${L.representing} ${host.company_name}, `;
  }
  bailleurInfo += L.landlordDescription;
  drawParagraph(bailleurInfo);
  y -= 14;
  
  drawParagraph(L.tenantSection);
  
  // Format: "Nom, né(e) le __/__/____, de nationalité ______, titulaire du document d'identité n° ______, ci-après dénommé(e) "Le Locataire""
  let locataireInfo = mainGuest.full_name || '_________________';
  locataireInfo += `, ${L.bornOn} ${mainGuest.date_of_birth ? fmtFR(mainGuest.date_of_birth) : '__/__/____'}`;
  locataireInfo += `, ${L.nationality} ${mainGuest.nationality || '_________________'}`;
  locataireInfo += `, ${L.documentHolder} ${mainGuest.document_number || '_________________'}`;
  const tenantDenomination = locale === 'fr' ? 'ci-après dénommé(e) "' + L.tenantLabel + '"' : locale === 'en' ? 'hereinafter referred to as "' + L.tenantLabel + '"' : 'en adelante denominado(a) "' + L.tenantLabel + '"';
  locataireInfo += `, ${tenantDenomination}`;
  drawParagraph(locataireInfo);
  y -= 16;
  drawHorizontalRule(0.6);

  // Articles du contrat avec variabilisation et traduction (L)
  const typeLabels: Record<string, Record<string, string>> = {
    fr: { apartment: 'appartement', house: 'maison', villa: 'villa', studio: 'studio', room: 'chambre' },
    en: { apartment: 'apartment', house: 'house', villa: 'villa', studio: 'studio', room: 'room' },
    es: { apartment: 'apartamento', house: 'casa', villa: 'villa', studio: 'estudio', room: 'habitación' },
  };
  const typeL = typeLabels[locale] || typeLabels.fr;

  drawArticleTitle(L.article1);
  const objIntro = locale === 'fr' ? 'Le présent contrat a pour objet la location meublée de courte durée du bien immobilier suivant : ' : locale === 'en' ? 'This agreement is for the furnished short-term rental of the following property: ' : 'El presente contrato tiene por objeto el alquiler amueblado de corta duración del siguiente inmueble: ';
  let propertyDescription = objIntro;
  if (property.property_type) {
    propertyDescription += `${typeL[property.property_type] || property.property_type} `;
  }
  propertyDescription += `"${property.name || (locale === 'fr' ? 'Non spécifié' : locale === 'en' ? 'Unspecified' : 'No especificado')}"`;
  if (property.address) {
    propertyDescription += locale === 'fr' ? `, situé ${property.address}` : locale === 'en' ? `, located at ${property.address}` : `, situado en ${property.address}`;
  }
  if (property.city && property.city !== property.address) propertyDescription += `, ${property.city}`;
  if (property.country && property.country !== 'Maroc') propertyDescription += `, ${property.country}`;
  const furnished = locale === 'fr' ? ' Le logement est loué entièrement meublé et équipé pour un usage d\'habitation temporaire' : locale === 'en' ? ' The property is rented fully furnished for temporary residential use' : ' El alojamiento se alquila totalmente amueblado para uso residencial temporal';
  propertyDescription += '.' + furnished;
  if (property.max_occupancy) {
    propertyDescription += locale === 'fr' ? ` pouvant accueillir jusqu'à ${property.max_occupancy} personnes` : locale === 'en' ? `, accommodating up to ${property.max_occupancy} people` : `, con capacidad para ${property.max_occupancy} personas`;
  }
  propertyDescription += '.';
  if (property.description) propertyDescription += (locale === 'fr' ? ' Description : ' : locale === 'en' ? ' Description: ' : ' Descripción: ') + property.description;
  drawParagraph(propertyDescription);
  y -= 6;

  drawArticleTitle(L.article2);
  let durationText = `${L.durationIntro} ${fmtFR(booking.check_in)} ${L.durationTo} ${fmtFR(booking.check_out)} ${L.durationEnd}`;
  drawParagraph(durationText);
  y -= 6;

  drawArticleTitle(L.article3);
  const bornLabel = locale === 'fr' ? 'Né(e) le' : locale === 'en' ? 'Born on' : 'Nacido/a el';
  const docLabel = locale === 'fr' ? 'Document n°' : locale === 'en' ? 'Document no.' : 'Documento n°';
  let occupantsText = `${L.occupantsIntro} ${booking.guests_count} ${L.occupantsPersons}\n\n`;
  for (const guest of guests) {
    const guestName = guest.full_name || `${guest.first_name || ''} ${guest.last_name || ''}`.trim() || '_______________';
    const birthDate = guest.date_of_birth ? fmtFR(guest.date_of_birth) : '__/__/____';
    const docNumber = guest.document_number || '_______________';
    occupantsText += `${guestName} - ${bornLabel} ${birthDate} - ${docLabel} ${docNumber}\n`;
  }
  if (guests.length < booking.guests_count) {
    occupantsText += `_______________ - ${bornLabel} __/__/____ - ${docLabel} _______________\n`;
  }
  occupantsText += L.occupantsForbidden;
  drawParagraph(occupantsText);
  y -= 6;

  drawArticleTitle(L.article4);
  drawParagraph(L.rulesIntro);
  y -= 4;
  
  const defaultRules = Array.isArray(L.defaultRules) ? L.defaultRules : [];
  const rulesToDisplay = property.house_rules && property.house_rules.length > 0 
    ? property.house_rules 
    : (defaultRules.length ? defaultRules : [
      'Aucun invité non autorisé ou fête',
      'Interdiction de fumer à l\'intérieur du bien',
      'Respecter les voisins et les règles de l\'immeuble',
      'Signaler immédiatement tout dommage',
      'Libérer les lieux à l\'heure convenue'
    ]);
  
  rulesToDisplay.forEach((rule: string) => {
    if (rule && rule.trim()) {
      drawParagraphIndented(`• ${rule.trim()}`, 6);
      y -= 4;
    }
  });
  
  if (property.contact?.phone || host.phone) {
    const contactPhone = property.contact?.phone || host.phone;
    drawParagraphIndented(`• ${L.emergencyContact} ${contactPhone}`, 6);
    y -= 4;
  }

  drawArticleTitle(L.article5);
  drawParagraph(L.article5Text);
  y -= 6;

  drawArticleTitle(L.article6);
  drawParagraph(L.article6Text);
  y -= 6;

  drawArticleTitle(L.article7);
  drawParagraph(L.article7Text);

  const city = property.city || property.address?.split(',')[0] || 'Casablanca';
  y -= 22;
  drawParagraph(`${L.doneAt} ${city}, ${L.onDate} ${fmtFR(new Date().toISOString())}`);
  
  if (host.company_name || host.ice || host.registration) {
    y -= 15;
    let legalInfo = '';
    if (host.company_name) {
      legalInfo += `${L.companyLabel} ${host.company_name}`;
    }
    if (host.registration) {
      legalInfo += legalInfo ? ` - ${L.rcLabel} ${host.registration}` : `${L.rcLabel} ${host.registration}`;
    }
    if (host.ice) {
      legalInfo += legalInfo ? ` - ${L.iceLabel} ${host.ice}` : `${L.iceLabel} ${host.ice}`;
    }
    if (host.tax_id && host.tax_id !== host.ice) {
      legalInfo += ` - ${L.taxIdLabel} ${host.tax_id}`;
    }
    drawParagraph(legalInfo);
  }
  
  y -= 30;

  // Zone signatures
  ensureSpace(120);
  
  const signatureBoxHeight = 80;
  const signatureBoxWidth = 200;
  const colGap = 50;
  const col1 = margin;
  const col2 = margin + signatureBoxWidth + colGap;

  // Boxes signatures
  // ✅ NOUVEAU : Suppression des cadres de signature
  // Les rectangles de signature ont été supprimés pour un contrat plus propre

  // ✅ SIGNATURE DU BAILLEUR - Dans le rectangle de gauche
  const hostSignature = ctx.host.signature;
  const hostSignatureType = ctx.host.signatureType ?? ctx.host.signature_type;
  
  const isHostSigSvg = hostSignatureType === 'svg' || (typeof hostSignature === 'string' && hostSignature.startsWith('data:image/svg'));
  const isHostSigEmbeddableImage = hostSignature && hostSignature.length >= 80 &&
    (hostSignature.startsWith('data:image/png') || hostSignature.startsWith('data:image/jpeg') || hostSignature.startsWith('data:image/jpg') || hostSignature.startsWith('http'));

  if (hostSignature) {
    try {
      if (isHostSigSvg) {
        // Pour SVG, afficher le nom avec mention "signature électronique"
        currentPage.drawText(hostName, {
          x: col1 + 10,
          y: y - signatureBoxHeight + 30,
          size: bodySize,
          font: fontRegular
        });
        currentPage.drawText(L.electronicSignature, {
          x: col1 + 10,
          y: y - signatureBoxHeight + 15,
          size: bodySize - 2,
          font: fontRegular
        });
      } else if (isHostSigEmbeddableImage) {
        // Pour les images PNG/JPEG (ou URL), intégrer la signature
        let signatureImageBytes;
        
        if (hostSignature.startsWith('data:')) {
          const base64Data = hostSignature.split(',')[1];
          signatureImageBytes = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
        } else {
          const response = await fetch(hostSignature);
          signatureImageBytes = new Uint8Array(await response.arrayBuffer());
        }
        
        let signatureImage;
        if (hostSignature.includes('png') || hostSignature.includes('PNG')) {
          signatureImage = await pdfDoc.embedPng(signatureImageBytes);
        } else {
          signatureImage = await pdfDoc.embedJpg(signatureImageBytes);
        }
        
        const signatureDims = signatureImage.scale(0.3);
        
        currentPage.drawImage(signatureImage, {
          x: col1 + 10,
          y: y - signatureBoxHeight + 10,
          width: Math.min(signatureDims.width, signatureBoxWidth - 20),
          height: Math.min(signatureDims.height, signatureBoxHeight - 20)
        });
        
        log('info', 'Signature du bailleur (image) intégrée au PDF');
      } else {
        currentPage.drawText(hostName, {
          x: col1 + 10,
          y: y - signatureBoxHeight + 30,
          size: bodySize,
          font: fontRegular
        });
      }
    } catch (e) {
      log('warn', 'Échec intégration signature bailleur:', e);
      currentPage.drawText(hostName, {
        x: col1 + 10,
        y: y - signatureBoxHeight + 30,
        size: bodySize,
        font: fontRegular
      });
    }
  } else {
    currentPage.drawText(hostName, {
      x: col1 + 10,
      y: y - signatureBoxHeight + 30,
      size: bodySize,
      font: fontRegular
    });
  }
  
  // ✅ SIGNATURE DU LOCATAIRE - Dans le rectangle de droite
  if (guestSignatureData) {
    try {
      log('info', '[CONTRACT] 🔍 Début intégration signature guest...', {
        dataLength: guestSignatureData.length,
        startsWithData: guestSignatureData.startsWith('data:'),
        startsWithHttp: guestSignatureData.startsWith('http'),
        preview: guestSignatureData.substring(0, 80)
      });
      
      let guestImageBytes;
      
      if (guestSignatureData.startsWith('data:')) {
        const base64Data = guestSignatureData.split(',')[1];
        if (!base64Data) {
          throw new Error('Base64 data manquante dans la signature guest');
        }
        guestImageBytes = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
        log('info', '[CONTRACT] ✅ Signature guest décodée depuis base64', { bytesLength: guestImageBytes.length });
      } else {
        const response = await fetch(guestSignatureData);
        if (!response.ok) {
          throw new Error(`Erreur HTTP ${response.status} lors du téléchargement signature guest`);
        }
        guestImageBytes = new Uint8Array(await response.arrayBuffer());
        log('info', '[CONTRACT] ✅ Signature guest téléchargée depuis URL', { bytesLength: guestImageBytes.length });
      }
      
      if (!guestImageBytes || guestImageBytes.length === 0) {
        throw new Error('Signature guest vide après décodage');
      }
      
      let guestImage;
      // ✅ CORRECTION : Meilleure détection du format PNG
      const isPng = guestSignatureData.includes('image/png') || 
                    guestSignatureData.includes('png') || 
                    guestSignatureData.includes('PNG');
      
      try {
        if (isPng) {
          guestImage = await pdfDoc.embedPng(guestImageBytes);
          log('info', '[CONTRACT] Image signature guest embedée en PNG');
        } else {
          guestImage = await pdfDoc.embedJpg(guestImageBytes);
          log('info', '[CONTRACT] Image signature guest embedée en JPG');
        }
      } catch (embedError) {
        // ✅ FALLBACK : Essayer l'autre format si le premier échoue
        log('warn', '[CONTRACT] Premier format échoué, tentative avec l\'autre format...', { 
          triedFormat: isPng ? 'PNG' : 'JPG',
          error: String(embedError)
        });
        try {
          if (isPng) {
            guestImage = await pdfDoc.embedJpg(guestImageBytes);
            log('info', '[CONTRACT] Fallback JPG réussi');
          } else {
            guestImage = await pdfDoc.embedPng(guestImageBytes);
            log('info', '[CONTRACT] Fallback PNG réussi');
          }
        } catch (fallbackError) {
          throw new Error(`Impossible d'intégrer la signature guest: ${String(embedError)}`);
        }
      }
      
      // ✅ CORRECTION : Calcul des dimensions adaptatif pour garantir visibilité
      const originalWidth = guestImage.width;
      const originalHeight = guestImage.height;
      const maxWidth = signatureBoxWidth - 20;
      const maxHeight = signatureBoxHeight - 20;
      
      // Calculer le ratio de redimensionnement optimal
      const widthRatio = maxWidth / originalWidth;
      const heightRatio = maxHeight / originalHeight;
      const scaleRatio = Math.min(widthRatio, heightRatio, 1.0); // Ne pas agrandir, juste réduire si nécessaire
      
      // ✅ AMÉLIORATION : S'assurer que la signature a une taille minimum visible
      const minVisibleWidth = 60;
      const minVisibleHeight = 30;
      let finalWidth = Math.max(originalWidth * scaleRatio, minVisibleWidth);
      let finalHeight = Math.max(originalHeight * scaleRatio, minVisibleHeight);
      
      // S'assurer qu'on ne dépasse pas les limites
      finalWidth = Math.min(finalWidth, maxWidth);
      finalHeight = Math.min(finalHeight, maxHeight);
      
      log('info', '[CONTRACT] 📐 Dimensions signature guest calculées', {
        original: { width: originalWidth, height: originalHeight },
        max: { width: maxWidth, height: maxHeight },
        scaleRatio,
        final: { width: finalWidth, height: finalHeight },
        boxPosition: { x: col2 + 10, y: y - signatureBoxHeight + 10 }
      });
      
      // ✅ Centrer horizontalement dans la box
      const signatureX = col2 + 10 + (maxWidth - finalWidth) / 2;
      const signatureY = y - signatureBoxHeight + 10 + (maxHeight - finalHeight) / 2;
      
      currentPage.drawImage(guestImage, {
        x: signatureX,
        y: signatureY,
        width: finalWidth,
        height: finalHeight
      });
      
      log('info', '[CONTRACT] ✅ Signature du locataire intégrée au PDF', {
        position: { x: signatureX, y: signatureY },
        dimensions: { width: finalWidth, height: finalHeight }
      });
    } catch (e) {
      log('error', '[CONTRACT] ❌ Échec intégration signature locataire', { 
        error: e instanceof Error ? e.message : String(e),
        stack: e instanceof Error ? e.stack : undefined
      });
      currentPage.drawText("_________________", {
        x: col2 + 10,
        y: y - signatureBoxHeight + 30,
        size: bodySize - 1,
        font: fontRegular
      });
    }
  } else {
    log('warn', '[CONTRACT] ⚠️ Pas de signature guest fournie, affichage ligne vide');
    currentPage.drawText("_________________", {
      x: col2 + 10,
      y: y - signatureBoxHeight + 30,
      size: bodySize - 1,
      font: fontRegular
    });
  }
  
  y -= signatureBoxHeight + 5;
  currentPage.drawText(L.signatureLandlordLabel, {
    x: col1,
    y,
    size: bodySize,
    font: fontBold
  });
  
  currentPage.drawText(L.signatureTenantLabel, {
    x: col2,
    y,
    size: bodySize,
    font: fontBold
  });

  y -= 15;
  currentPage.drawText(hostName, {
    x: col1,
    y,
    size: bodySize - 1,
    font: fontRegular
  });
  
  currentPage.drawText(locataireName, {
    x: col2,
    y,
    size: bodySize - 1,
    font: fontRegular
  });

  const dateLocale = locale === 'en' ? 'en-GB' : locale === 'es' ? 'es-ES' : 'fr-FR';
  y -= 15;
  currentPage.drawText(`${L.dateLabel} ${new Date().toLocaleDateString(dateLocale)}`, {
    x: col1,
    y,
    size: bodySize - 1,
    font: fontRegular
  });
  
  if (guestSignedAt) {
    currentPage.drawText(`${L.dateLabel} ${fmtFR(guestSignedAt)}`, {
      x: col2,
      y,
      size: bodySize - 1,
      font: fontRegular
    });
  } else {
    currentPage.drawText(`${L.dateLabel} ____/____/______`, {
      x: col2,
      y,
      size: bodySize - 1,
      font: fontRegular
    });
  }

  if (guestSignatureData) {
    y -= 20;
    const validatedText = guestSignedAt ? `${L.signatureValidated} ${fmtFR(guestSignedAt)}` : L.signatureValidated;
    currentPage.drawText(`* ${validatedText}`, {
      x: col2,
      y,
      size: bodySize - 2,
      font: fontRegular
    });
  }

  pages.forEach((p, i) => {
    p.drawText(`${L.pageLabel} ${i + 1}/${pages.length}`, {
      x: pageWidth - margin - 60,
      y: margin - 20,
      size: 9,
      font: fontRegular
    });
  });

  log('info', 'PDF generation completed', {
    pages: pages.length,
    guests: guests.length
  });

  const pdfBytes = await pdfDoc.save();
  
  // Upload to Storage and return URL
  const documentUrl = await uploadPdfToStorage(client, booking.id, pdfBytes);
  
  log('info', 'Contract PDF generated and uploaded successfully');
  return documentUrl;
}

// =====================================================
// FONCTIONS HELPERS POUR GÉNÉRATION PDF FICHE POLICE
// =====================================================

// Generate police forms PDF - Format officiel marocain bilingue EXACT
// Generate police forms PDF - Format officiel marocain bilingue EXACT
async function generatePoliceFormsPDF(
  client: any, 
  booking: any, 
  isPreview: boolean = false,
  guestSignatureData?: string | null,  // ✅ NOUVEAU : Signature du guest
  guestSignedAt?: string | null         // ✅ NOUVEAU : Date signature guest
): Promise<string> {
  log('info', 'Création PDF fiches de police format officiel marocain...', {
    hasGuestSignature: !!guestSignatureData
  });
  
  const guests = booking.guests || [];
  let property = booking.property || {};
  
  
  // ✅ AMÉLIORATION : TOUJOURS récupérer contract_template explicitement pour debug
  // (Retrait de la condition !property.contract_template pour forcer la récupération)
  if (property.id) {
    log('info', '[Police] Force fetch contract_template for debug...', {
      propertyId: property.id,
      hasContractTemplateBefore: !!property.contract_template
    });
    
    const { data: propertyData, error: propertyError } = await client
      .from('properties')
      .select('contract_template')
      .eq('id', property.id)
      .single();
    
    if (propertyError) {
      log('error', '[Police] ❌ Erreur récupération contract_template:', { 
        error: propertyError,
        propertyId: property.id,
        message: propertyError.message,
        details: propertyError.details
      });
    } else {
      log('info', '[Police] ✅ contract_template récupéré:', {
        hasContractTemplate: !!propertyData?.contract_template,
        contractTemplateType: typeof propertyData?.contract_template,
        contractTemplateKeys: propertyData?.contract_template ? Object.keys(propertyData.contract_template) : [],
        hasLandlordSignature: !!(propertyData?.contract_template as any)?.landlord_signature,
        landlordSignatureType: (propertyData?.contract_template as any)?.landlord_signature ? typeof (propertyData.contract_template as any).landlord_signature : 'none',
        landlordSignatureLength: (propertyData?.contract_template as any)?.landlord_signature ? (propertyData.contract_template as any).landlord_signature.length : 0,
        landlordSignaturePreview: (propertyData?.contract_template as any)?.landlord_signature ? (propertyData.contract_template as any).landlord_signature.substring(0, 50) + '...' : 'none'
      });
      
      property.contract_template = propertyData.contract_template;
      log('info', '[Police] ✅ contract_template assigné à property');
    }
  } else {
    log('warn', '[Police] ⚠️ property.id manquant, impossible de récupérer contract_template');
  }
  
  // ✅ DIAGNOSTIC : Log de la propriété avant génération
  log('info', '[Police] 🔍 Données propriété COMPLÈTES:', {
    hasProperty: !!property,
    propertyId: property.id,
    propertyName: property.name,
    hasContractTemplate: !!property.contract_template,
    contractTemplateType: typeof property.contract_template,
    contractTemplateKeys: property.contract_template ? Object.keys(property.contract_template) : [],
    hasLandlordSignature: !!(property.contract_template as any)?.landlord_signature,
    landlordSignatureType: (property.contract_template as any)?.landlord_signature ? typeof (property.contract_template as any).landlord_signature : 'none',
    landlordSignatureLength: (property.contract_template as any)?.landlord_signature ? (property.contract_template as any).landlord_signature.length : 0,
    landlordSignaturePreview: (property.contract_template as any)?.landlord_signature ? (property.contract_template as any).landlord_signature.substring(0, 50) + '...' : 'none'
  });
  
  // Configuration PDF - Format officiel A4 identique au modèle
  const pageWidth = 595.28; // A4 width
  const pageHeight = 841.89; // A4 height
  const margin = 40; // ✅ RÉDUIT de 50 à 40 pour gagner de l'espace
  const fontSize = 10; // ✅ RÉDUIT de 11 à 10 pour compacter
  const titleFontSize = 13; // ✅ RÉDUIT de 14 à 13
  const fieldHeight = 18; // ✅ RÉDUIT de 22 à 18 pour compacter

  // Créer le document PDF
  const pdfDoc = await PDFDocument.create();
  
  // ✅ SOLUTION : Charger une police qui supporte l'arabe (Noto Sans Arabic)
  let font, boldFont, arabicFont;
  try {
    // Police latine standard
    font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    
    // ✅ Charger une police arabe depuis Google Fonts
    log('info', 'Loading Arabic font from Google Fonts...');
    const arabicFontUrl = 'https://fonts.gstatic.com/s/notosansarabic/v18/nwpxtLGrOAZMl5nJ_wfgRg3DrWFZWsnVBJ_sS6tlqHHFlhQ5l3sQWIHPqzCfyGyvu3CBFQLaig.ttf';
    
    const fontBytes = await fetch(arabicFontUrl).then(res => res.arrayBuffer());
    
    // Enregistrer fontkit pour permettre l'embedding de polices custom
    pdfDoc.registerFontkit(fontkit);
    arabicFont = await pdfDoc.embedFont(fontBytes);
    
    log('info', 'Arabic font loaded successfully!');
  } catch (e) {
    log('warn', 'Arabic font loading failed, falling back to Helvetica', { error: String(e) });
    font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    arabicFont = font; // Fallback
  }
  
  // Helper pour détecter si du texte contient de l'arabe
  function hasArabic(text: string): boolean {
    return /[\u0600-\u06FF]/.test(text);
  }
  
  // Helper pour choisir la bonne police selon le texte
  function getFont(text: string) {
    return hasArabic(text) ? arabicFont : font;
  }

  // ✅ SOLUTION AMÉLIORÉE : Helper function to draw bilingual field avec support arabe et multi-lignes pour longues adresses
  function drawBilingualField(page: any, frenchLabel: string, arabicLabel: string, value: string, x: number, y: number): number {
    const fontSize = 9; // ✅ RÉDUIT de 11 à 9 pour compacter
    const baseFieldHeight = 16; // ✅ RÉDUIT de 20 à 16 pour compacter
    const labelSpacing = 12; // ✅ RÉDUIT de 15 à 12
    const lineSpacing = 11; // ✅ RÉDUIT de 14 à 11
    
    // Draw French label (left aligned)
    const frenchLabelWidth = font.widthOfTextAtSize(frenchLabel, fontSize);
    page.drawText(frenchLabel, {
      x,
      y,
      size: fontSize,
      font: font
    });
    
    // ✅ CORRECTION : Déclarer arabicX en dehors du try/catch
    let arabicX = pageWidth - margin; // Valeur par défaut
    let arabicLabelWidth = 0;
    
    // ✅ Draw Arabic label (right aligned) avec la police arabe
    try {
      const arabicFontToUse = getFont(arabicLabel);
      arabicLabelWidth = arabicFontToUse.widthOfTextAtSize(arabicLabel, fontSize);
      arabicX = pageWidth - margin - arabicLabelWidth;
      
      page.drawText(arabicLabel, {
        x: arabicX,
        y,
        size: fontSize,
        font: arabicFontToUse
      });
    } catch (error) {
      log('warn', 'Failed to render Arabic label:', { error: String(error), label: arabicLabel });
    }
    
    // ✅ Calculer l'espace disponible pour la valeur
    const startX = x + frenchLabelWidth + labelSpacing;
    const endX = Math.max(startX + 50, arabicX - labelSpacing);
    const availableWidth = endX - startX - 4; // Largeur disponible moins marge
    
    // ✅ NOUVEAU : Gérer les valeurs multi-lignes pour les longues adresses
    if (value && value.trim()) {
      try {
        const valueFont = getFont(value);
        let valueSize = fontSize - 1;
        let valueWidth = valueFont.widthOfTextAtSize(value, valueSize);
        
        // ✅ OPTION 1 : Si la valeur est trop longue, essayer de réduire la taille
        let finalValue = value;
        while (valueWidth > availableWidth && valueSize > 6) {
          valueSize -= 0.3;
          valueWidth = valueFont.widthOfTextAtSize(value, valueSize);
        }
        
        // ✅ OPTION 2 : Si toujours trop long même à taille minimale, découper en lignes
        if (valueWidth > availableWidth && valueSize <= 6) {
          log('info', `Splitting long value into multiple lines: ${value.substring(0, 50)}...`);
          
          // Fonction pour découper intelligemment le texte
          const splitTextIntoLines = (text: string, maxWidth: number, font: any, size: number): string[] => {
            const words = text.split(/[\s,]+/); // Découper par espaces et virgules
            const lines: string[] = [];
            let currentLine = '';
            
            for (const word of words) {
              const testLine = currentLine ? `${currentLine} ${word}` : word;
              const testWidth = font.widthOfTextAtSize(testLine, size);
              
              if (testWidth > maxWidth && currentLine) {
                lines.push(currentLine);
                currentLine = word;
              } else {
                currentLine = testLine;
              }
            }
            
            if (currentLine) {
              lines.push(currentLine);
            }
            
            return lines;
          };
          
          const lines = splitTextIntoLines(value, availableWidth, valueFont, valueSize);
          
          // Dessiner chaque ligne
          lines.forEach((line, index) => {
            const lineY = y - 2 - (index * lineSpacing);
            const lineWidth = valueFont.widthOfTextAtSize(line, valueSize);
            
            // Positionner la ligne (légèrement à gauche pour la première ligne)
            const lineX = startX + 2;
            
            // Dessiner la ligne
            page.drawText(line, {
              x: lineX,
              y: lineY,
              size: valueSize,
              font: valueFont
            });
            
            // Dessiner une ligne de soulignement pour chaque ligne de texte
            if (index === 0) {
              page.drawLine({
                start: { x: startX, y: y - 5 },
                end: { x: endX, y: y - 5 },
                color: rgb(0, 0, 0),
                thickness: 0.5
              });
            }
          });
          
          // Retourner la nouvelle position Y en tenant compte de toutes les lignes
          return y - baseFieldHeight - ((lines.length - 1) * lineSpacing);
        } else {
          // ✅ OPTION 3 : Valeur sur une seule ligne
          page.drawLine({
            start: { x: startX, y: y - 5 },
            end: { x: endX, y: y - 5 },
            color: rgb(0, 0, 0),
            thickness: 0.5
          });
          
          const valueX = Math.max(
            startX + 2,
            Math.min(
              startX + (endX - startX - valueWidth) / 2,
              endX - valueWidth - 2
            )
          );
          
          page.drawText(value, {
            x: valueX,
            y: y - 2,
            size: valueSize,
            font: valueFont
          });
        }
      } catch (error) {
        log('warn', 'Failed to render value:', { error: String(error), value });
        // Dessiner juste la ligne de soulignement en cas d'erreur
        page.drawLine({
          start: { x: startX, y: y - 5 },
          end: { x: endX, y: y - 5 },
          color: rgb(0, 0, 0),
          thickness: 0.5
        });
      }
    } else {
      // Pas de valeur, juste la ligne
      page.drawLine({
        start: { x: startX, y: y - 5 },
        end: { x: endX, y: y - 5 },
        color: rgb(0, 0, 0),
        thickness: 0.5
      });
    }
    
    return y - baseFieldHeight;
  }

  // Helper function to format dates
  function formatDate(dateStr: string): string {
    if (!dateStr) return '';
    try {
      const date = new Date(dateStr);
      return isNaN(date.getTime()) ? '' : date.toLocaleDateString('fr-FR');
    } catch {
      return '';
    }
  }

  // Générer une page par invité avec format officiel EXACT du modèle
  for (const guest of guests) {
    const page = pdfDoc.addPage([pageWidth, pageHeight]);
    let yPosition = pageHeight - 50;
    
    // ✅ EN-TÊTE OFFICIEL - Format EXACT du modèle affiché
    page.drawText('Fiche d\'arrivee / Arrival form', {
      x: (pageWidth - boldFont.widthOfTextAtSize('Fiche d\'arrivee / Arrival form', titleFontSize)) / 2,
      y: yPosition,
      size: titleFontSize,
      font: boldFont
    });
    yPosition -= 25;
    
    // Titre arabe centré avec la police arabe
    const arabicTitle = 'ورقة الوصول';
    try {
      const titleWidth = arabicFont.widthOfTextAtSize(arabicTitle, titleFontSize);
      page.drawText(arabicTitle, {
        x: (pageWidth - titleWidth) / 2,
        y: yPosition,
        size: titleFontSize,
        font: arabicFont
      });
    } catch (error) {
      log('warn', 'Failed to render Arabic title');
    }
    yPosition -= 50;
    
    // ✅ SECTION LOCATAIRE / TENANT - Format EXACT du modèle
    page.drawText('Locataire / Tenant', {
      x: margin,
      y: yPosition,
      size: fontSize + 2,
      font: boldFont
    });
    
    try {
      const arabicSection = 'المستأجر';
      const arabicSectionWidth = arabicFont.widthOfTextAtSize(arabicSection, fontSize + 2);
      page.drawText(arabicSection, {
        x: pageWidth - margin - arabicSectionWidth,
        y: yPosition,
        size: fontSize + 2,
        font: arabicFont
      });
    } catch (error) {
      log('warn', 'Failed to render Arabic section title');
    }
    yPosition -= 35;
    
    // ✅ Informations du locataire - EXACT selon le modèle
    const fullName = guest.full_name || '';
    const nameParts = fullName.trim().split(' ');
    const lastName = nameParts.length > 0 ? nameParts[nameParts.length - 1] : '';
    const firstName = nameParts.length > 1 ? nameParts.slice(0, -1).join(' ') : '';
    
    yPosition = drawBilingualField(page, 'Nom / Last name', 'الاسم العائلي', lastName, margin, yPosition);
    yPosition = drawBilingualField(page, 'Prénom / First name', 'الاسم الشخصي', firstName, margin, yPosition);
    
    const birthDate = formatDate(guest.date_of_birth);
    yPosition = drawBilingualField(page, 'Date de naissance / Date of birth', 'تاريخ الولادة', birthDate, margin, yPosition);
    yPosition = drawBilingualField(page, 'Lieu de naissance / Place of birth', 'مكان الولادة', guest.place_of_birth || '', margin, yPosition);
    yPosition = drawBilingualField(page, 'Nationalité / Nationality', 'الجنسية', guest.nationality || '', margin, yPosition);
    
    const docType = guest.document_type === 'passport' ? 'PASSEPORT / PASSPORT' : 'CNI / ID CARD';
    yPosition = drawBilingualField(page, 'Type de document / ID type', 'نوع الوثيقة', docType, margin, yPosition);
    yPosition = drawBilingualField(page, 'Numéro du document / ID number', 'رقم الوثيقة', guest.document_number || '', margin, yPosition);
    
    // ✅ Date d'expiration du document - formatée si disponible (document_expiry_date ou document_issue_date en fallback)
    const expiryDate = formatDate((guest as any).document_expiry_date ?? guest.document_issue_date);
    yPosition = drawBilingualField(page, 'Date d\'expiration / Date of expiry', 'تاريخ الانتهاء', expiryDate, margin, yPosition);
    yPosition = drawBilingualField(page, 'Date d\'entrée au Maroc / Date of entry in Morocco', 'تاريخ الدخول إلى المغرب', '', margin, yPosition);
    yPosition = drawBilingualField(page, 'Profession', 'المهنة', guest.profession || '', margin, yPosition);
    yPosition = drawBilingualField(page, 'Adresse / Home address', 'العنوان الشخصي', guest.adresse_personnelle || '', margin, yPosition);
    
    // ✅ DIAGNOSTIC : Log des données du guest avant affichage
    log('info', '[Police] Données guest pour fiche:', {
      guestId: guest.id,
      guestName: guest.full_name,
      email: guest.email,
      phone: guest.phone,
      hasEmail: !!guest.email,
      hasPhone: !!guest.phone,
      allGuestKeys: Object.keys(guest)
    });
    
    yPosition = drawBilingualField(page, 'Courriel / Email', 'البريد الإلكتروني', guest.email || '', margin, yPosition);
    yPosition = drawBilingualField(page, 'Numéro de téléphone / Phone number', 'رقم الهاتف', guest.phone || '', margin, yPosition);
    
    yPosition -= 20; // ✅ RÉDUIT de 30 à 20
    
    // ✅ SECTION SÉJOUR / STAY - Format EXACT du modèle
    page.drawText('Sejour / Stay', {
      x: margin,
      y: yPosition,
      size: fontSize + 2,
      font: boldFont
    });
    
    try {
      const arabicStay = 'الإقامة';
      const arabicStayWidth = arabicFont.widthOfTextAtSize(arabicStay, fontSize + 2);
      page.drawText(arabicStay, {
        x: pageWidth - margin - arabicStayWidth,
        y: yPosition,
        size: fontSize + 2,
        font: arabicFont
      });
    } catch (error) {
      log('warn', 'Failed to render Arabic stay title');
    }
    yPosition -= 35;
    
    const checkInDate = formatDate(booking.check_in_date);
    const checkOutDate = formatDate(booking.check_out_date);
    
    yPosition = drawBilingualField(page, 'Date d\'arrivée / Date of arrival', 'تاريخ الوصول', checkInDate, margin, yPosition);
    yPosition = drawBilingualField(page, 'Date de départ / Date of departure', 'تاريخ المغادرة', checkOutDate, margin, yPosition);
    yPosition = drawBilingualField(page, 'Motif du séjour / Purpose of stay', 'سبب الإقامة', guest.motif_sejour || 'TOURISME', margin, yPosition);
    yPosition = drawBilingualField(page, 'Nombre de mineurs / Number of minors', 'عدد القاصرين', '0', margin, yPosition);
    yPosition = drawBilingualField(page, 'Lieu de provenance / Place of prenance', 'مكان القدوم', '', margin, yPosition);
    yPosition = drawBilingualField(page, 'Destination', 'الوجهة', property.city || property.address || '', margin, yPosition);
    
    yPosition -= 20; // ✅ RÉDUIT de 30 à 20
    
    // ✅ SECTION LOUEUR / HOST - Format EXACT du modèle
    page.drawText('Loueur / Host', {
      x: margin,
      y: yPosition,
      size: fontSize + 2,
      font: boldFont
    });
    
    try {
      const arabicHost = 'المؤجر';
      const arabicHostWidth = arabicFont.widthOfTextAtSize(arabicHost, fontSize + 2);
      page.drawText(arabicHost, {
        x: pageWidth - margin - arabicHostWidth,
        y: yPosition,
        size: fontSize + 2,
        font: arabicFont
      });
    } catch (error) {
      log('warn', 'Failed to render Arabic host title');
    }
    yPosition -= 35;
    
    // Informations du loueur - EXACT selon le modèle
    const hostData = booking.host || {};
    const establishmentAddress = property.address || '';
    const hostName = hostData.full_name || hostData.name || property.name || '';
    const hostEmail = hostData.email || '';
    const hostPhone = hostData.phone || '';
    
    yPosition = drawBilingualField(page, 'Adress du bien loué / Rental address', 'عنوان العقار المؤجر', establishmentAddress, margin, yPosition);
    yPosition = drawBilingualField(page, 'Nom du loueur / Host name', 'اسم المؤجر', hostName, margin, yPosition);
    yPosition = drawBilingualField(page, 'Adresse email du loueur / Host email', 'البريد الإلكتروني للمؤجر', hostEmail, margin, yPosition);
    yPosition = drawBilingualField(page, 'Numéro de téléphone du loueur / host phone number', 'رقم هاتف المؤجر', hostPhone, margin, yPosition);
    
    yPosition -= 35; // ✅ RÉDUIT de 50 à 35
    
    // ✅ SIGNATURE SECTION - Date dynamique avec lieu
    const today = new Date();
    const signatureDate = today.toLocaleDateString('fr-FR', { 
      day: 'numeric', 
      month: 'long', 
      year: 'numeric' 
    });
    // Récupérer la ville depuis la propriété (city ou extraire de l'adresse)
    const signatureCity = property.city || 
      (property.address ? property.address.split(',').pop()?.trim() : '') || 
      'Casablanca'; // Valeur par défaut
    
    const signatureText = `A ${signatureCity}, le ${signatureDate}`;
    page.drawText(signatureText, {
      x: margin,
      y: yPosition,
      size: fontSize,
      font: font
    });
    yPosition -= 15;
    
    // ✅ CORRECTION : La fiche de police ne comporte que la signature du LOCATAIRE (guest)
    const signaturesBaselineY = yPosition;
    
    // SIGNATURE DU LOCATAIRE - Label centré
    const guestLabelText = 'Signature du locataire';
    const guestLabelWidth = font.widthOfTextAtSize(guestLabelText, fontSize);
    const guestLabelX = (pageWidth - guestLabelWidth) / 2; // Centré
    
    page.drawText(guestLabelText, {
      x: guestLabelX,
      y: signaturesBaselineY,
      size: fontSize,
      font: font
    });
    
    // Texte arabe "Signature du locataire" (à droite)
    try {
      const arabicGuestLabel = 'توقيع المستأجر';
      const arabicLabelWidth = arabicFont.widthOfTextAtSize(arabicGuestLabel, fontSize);
      page.drawText(arabicGuestLabel, {
        x: pageWidth - margin - arabicLabelWidth,
        y: signaturesBaselineY,
        size: fontSize,
        font: arabicFont
      });
    } catch (error) {
      log('warn', '[Police] Erreur affichage label arabe signature guest');
    }
    
    yPosition = signaturesBaselineY - 10;
    
    // ✅ NOUVEAU : Vérifier l'espace disponible pour les signatures
    const footerHeight = 40; // Espace réservé pour le footer CHECKY
    const minSpaceForSignatures = 80; // Espace minimum nécessaire pour les signatures
    const availableSpace = yPosition - footerHeight;
    
    log('info', '[Police] 📏 Espace disponible pour signatures:', {
      yPosition,
      footerHeight,
      availableSpace,
      minSpaceForSignatures,
      hasEnoughSpace: availableSpace >= minSpaceForSignatures
    });
    
    // ✅ Calculer la hauteur maximale des signatures en fonction de l'espace disponible
    const maxSignatureHeight = Math.min(60, Math.max(30, availableSpace - 20)); // Entre 30 et 60px
    
    log('info', '[Police] 📐 Hauteur maximale calculée pour signatures:', {
      maxSignatureHeight,
      calculatedFromSpace: availableSpace - 20
    });
    
    // ✅ CORRECTION CRITIQUE : guestSignatureData est déjà un paramètre de la fonction (ligne 5133)
    // Pas besoin de le redéfinir ici
    
    // ✅ SIGNATURE DU GUEST (centrée)
    log('info', '[Police] 🔍 Vérification signature guest pour PDF:', {
      hasGuestSignatureData: !!guestSignatureData,
      guestSignatureDataType: typeof guestSignatureData,
      guestSignatureDataLength: guestSignatureData?.length || 0,
      guestSignatureDataPreview: guestSignatureData ? guestSignatureData.substring(0, 50) : 'null',
      startsWithDataImage: guestSignatureData?.startsWith('data:image/') || false,
      startsWithHttp: guestSignatureData?.startsWith('http') || false
    });
    
    // ✅ CORRECTION : Condition plus souple - accepte data: ou http
    const conditionPassed = guestSignatureData && (
      guestSignatureData.startsWith('data:image/') || 
      guestSignatureData.startsWith('data:') ||  // Accepte aussi data: sans image/
      guestSignatureData.startsWith('http')
    );
    log('info', '[Police] 🔍 Condition d\'affichage signature:', {
      conditionPassed,
      hasData: !!guestSignatureData,
      startsWithDataImage: guestSignatureData?.startsWith('data:image/'),
      startsWithData: guestSignatureData?.startsWith('data:'),
      startsWithHttp: guestSignatureData?.startsWith('http'),
      dataLength: guestSignatureData?.length || 0
    });
    
    if (conditionPassed) {
      try {
        log('info', '[Police] 🎨 Intégration signature guest...', {
          dataPreview: guestSignatureData.substring(0, 100)
        });
        
        let guestSignatureBytes;
        if (guestSignatureData.startsWith('data:')) {
          const base64Data = guestSignatureData.split(',')[1];
          if (!base64Data) throw new Error('Base64 data manquante après la virgule');
          guestSignatureBytes = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
          log('info', '[Police] ✅ Signature décodée depuis base64', { bytesLength: guestSignatureBytes.length });
        } else {
          const response = await fetch(guestSignatureData);
          if (!response.ok) throw new Error(`HTTP error: ${response.status}`);
          guestSignatureBytes = new Uint8Array(await response.arrayBuffer());
          log('info', '[Police] ✅ Signature téléchargée depuis URL', { bytesLength: guestSignatureBytes.length });
        }
        
        if (guestSignatureBytes && guestSignatureBytes.length > 0) {
          let guestSigImage;
          const isPng = guestSignatureData.includes('image/png') || 
                        guestSignatureData.includes('png') || 
                        guestSignatureData.includes('PNG');
          
          try {
            if (isPng) {
              guestSigImage = await pdfDoc.embedPng(guestSignatureBytes);
              log('info', '[Police] Image embedée en PNG');
            } else {
              guestSigImage = await pdfDoc.embedJpg(guestSignatureBytes);
              log('info', '[Police] Image embedée en JPG');
            }
          } catch (embedError) {
            // Fallback: essayer l'autre format
            log('warn', '[Police] Premier format échoué, tentative fallback...', { 
              triedFormat: isPng ? 'PNG' : 'JPG' 
            });
            if (isPng) {
              guestSigImage = await pdfDoc.embedJpg(guestSignatureBytes);
            } else {
              guestSigImage = await pdfDoc.embedPng(guestSignatureBytes);
            }
          }
          
          // ✅ OPTIMISÉ : Dimensions adaptées pour signature centrée et bien visible
          const guestAvailableWidth = pageWidth - (margin * 2);
          const maxW = Math.min(200, guestAvailableWidth * 0.6);
          const maxH = maxSignatureHeight;
          
          // ✅ CORRECTION : S'assurer d'une taille minimum visible
          const minVisibleWidth = 80;
          const minVisibleHeight = 40;
          
          const scale = Math.min(maxW / guestSigImage.width, maxH / guestSigImage.height, 1.0);
          let w = Math.max(guestSigImage.width * scale, minVisibleWidth);
          let h = Math.max(guestSigImage.height * scale, minVisibleHeight);
          
          // S'assurer de ne pas dépasser les limites
          w = Math.min(w, maxW);
          h = Math.min(h, maxH);
          
          log('info', '[Police] 📐 Dimensions signature calculées', {
            original: { width: guestSigImage.width, height: guestSigImage.height },
            max: { width: maxW, height: maxH },
            scale,
            final: { width: w, height: h }
          });
          
          // ✅ CORRECTION : Position centrée
          const guestSignatureY = signaturesBaselineY - 10 - h;
          const guestSignatureX = (pageWidth - w) / 2; // Centré horizontalement
          
          // Position : centrée sous le label
          page.drawImage(guestSigImage, {
            x: guestSignatureX,
            y: guestSignatureY,
            width: w,
            height: h
          });
          
          log('info', '[Police] ✅ Signature guest intégrée avec succès', { 
            position: { x: guestSignatureX, y: guestSignatureY }, 
            dimensions: { width: w, height: h }
          });
          
          // Date de signature (sous l'image, centrée)
          if (guestSignedAt) {
            try {
              const dateText = `Signé le ${new Date(guestSignedAt).toLocaleDateString('fr-FR')}`;
              const dateTextWidth = font.widthOfTextAtSize(dateText, fontSize - 2);
              const dateX = (pageWidth - dateTextWidth) / 2; // Centré
              
              page.drawText(dateText, {
                x: dateX,
                y: guestSignatureY - 10,  // ✅ Sous la signature du guest
                size: fontSize - 2,
                font: font,
                color: rgb(0.3, 0.3, 0.3)
              });
            } catch {}
          }
        }
      } catch (err: any) {
        log('error', '[Police] ❌ Erreur signature guest:', { error: err.message, stack: err.stack });
        // Continue sans la signature guest (affiche juste le label)
      }
    } else {
      log('warn', '[Police] ⚠️ Pas de signature guest disponible ou format invalide:', {
        hasData: !!guestSignatureData,
        dataType: typeof guestSignatureData,
        dataLength: guestSignatureData?.length || 0,
        dataPreview: guestSignatureData ? guestSignatureData.substring(0, 100) : 'null',
        isDataImage: guestSignatureData?.startsWith('data:image/'),
        isHttp: guestSignatureData?.startsWith('http')
      });
    }
    
    // ✅ Footer CHECKY - Position exacte comme le modèle
    const footerY = 30;
    const checkyText = 'CHECKY';
    const checkyX = pageWidth - margin - boldFont.widthOfTextAtSize(checkyText, fontSize + 4);
    
    page.drawText(checkyText, {
      x: checkyX,
      y: footerY,
      size: fontSize + 4,
      font: boldFont,
      color: rgb(0.0, 0.6, 0.6) // Couleur turquoise CHECKY exacte
    });
  }

  log('info', 'PDF fiches de police généré format officiel', {
    pages: guests.length,
    guests: guests.length
  });

  const pdfBytes = await pdfDoc.save();
  
  // ✅ NOUVEAU : Sauvegarder chaque fiche de police dans generated_documents
  if (booking.id && !isPreview) {
    log('info', '[Police] 💾 Sauvegarde des fiches de police dans generated_documents...');
    
    try {
      // Convertir le PDF en base64
      let pdfBase64: string;
      try {
        pdfBase64 = btoa(String.fromCharCode(...pdfBytes));
      } catch (e) {
        // Fallback pour les gros fichiers
        const chunks: string[] = [];
        const chunkSize = 8192;
        for (let i = 0; i < pdfBytes.length; i += chunkSize) {
          const chunk = pdfBytes.slice(i, i + chunkSize);
          chunks.push(String.fromCharCode(...chunk));
        }
        pdfBase64 = btoa(chunks.join(''));
      }
      const pdfDataUrl = `data:application/pdf;base64,${pdfBase64}`;
      
      // Sauvegarder une fiche par guest
      for (const guest of guests) {
        const { data: existingPolice } = await client
          .from('generated_documents')
          .select('id')
          .eq('booking_id', booking.id)
          .eq('document_type', 'police')
          .eq('metadata->>guest_name', guest.full_name)
          .maybeSingle();
        
        const policeData = {
          booking_id: booking.id,
          document_type: 'police',
          file_url: pdfDataUrl,
          file_name: `Police_${guest.full_name}.pdf`,
          metadata: {
            guest_name: guest.full_name,
            guest_id: guest.id,
            generated_at: new Date().toISOString(),
            has_signature: !!guestSignatureData
          },
          updated_at: new Date().toISOString()
        };
        
        if (existingPolice) {
          // Mettre à jour
          await client
            .from('generated_documents')
            .update(policeData)
            .eq('id', existingPolice.id);
          
          log('info', `[Police] ✅ Fiche mise à jour pour ${guest.full_name}`);
        } else {
          // Créer
          await client
            .from('generated_documents')
            .insert({ ...policeData, created_at: new Date().toISOString() });
          
          log('info', `[Police] ✅ Fiche créée pour ${guest.full_name}`);
        }
      }
      
      // Mettre à jour le statut dans bookings
      await client
        .from('bookings')
        .update({
          documents_generated: {
            ...booking.documents_generated,
            policeForm: true
          },
          updated_at: new Date().toISOString()
        })
        .eq('id', booking.id);
      
      log('info', '[Police] ✅ Toutes les fiches sauvegardées dans generated_documents');
      
    } catch (saveError: any) {
      log('error', '[Police] ❌ Erreur sauvegarde:', {
        message: saveError.message,
        stack: saveError.stack
      });
      // Ne pas faire échouer la génération pour cette erreur
    }
  }
  
  // ✅ NOUVEAU : En mode preview, retourner un data URL au lieu d'uploader
  if (isPreview || !booking.id) {
    log('info', 'Mode preview : retour d\'un data URL');
    let binary = '';
    const bytes = new Uint8Array(pdfBytes);
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    const base64PDF = btoa(binary);
    return `data:application/pdf;base64,${base64PDF}`;
  }
  
  // Upload to Storage and return URL with correct document type
  const documentUrl = await uploadPdfToStorage(client, booking.id, pdfBytes, 'police');
  
  log('info', 'Police forms PDF generated and uploaded successfully - Format officiel marocain');
  return documentUrl;
}

// =====================================================
// FONCTIONS HELPERS POUR GÉNÉRATION PDF DOCUMENTS IDENTITÉ
// =====================================================

// Generate identity documents PDF - Format professionnel
// ❌ SUPPRIMÉ : Fonction generateIdentityDocumentsPDF - Code mort (258 lignes)
// Cette fonction n'était jamais appelée car la génération automatique des documents d'identité
// a été désactivée (ligne 3371). On utilise uniquement les documents uploadés par l'invité.

// =====================================================
// HANDLER HTTP PRINCIPAL
// =====================================================

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const startTime = Date.now();
  
  try {
    log('info', '🚀 Nouvelle requête reçue', {
      method: req.method,
      url: req.url
    });

    // Parse request body
    const body = await req.json();
    log('info', '📦 Body reçu:', {
      hasBookingId: !!body.bookingId,
      hasAction: !!body.action,
      action: body.action
    });

    // Get Supabase client
    const client = await getServerClient();

    // =====================================================
    // ROUTER - Gérer différentes actions
    // =====================================================

    const action = body.action || 'submit_guest_info';

    switch (action) {
      case 'generate_contract_only': {
        log('info', '📄 Action: Génération contrat uniquement (switch)');
        
        if (!body.bookingId) {
          throw new Error('bookingId requis');
        }

        const { data: booking } = await client
          .from('bookings')
          .select('*, property:properties(*), guests(*)')
          .eq('id', body.bookingId)
          .single();

        if (!booking) throw new Error('Booking non trouvé');

        // ✅ CORRECTION : Récupérer la signature depuis contract_signatures si non fournie
        let signatureData = body.signature?.data;
        let signatureTimestamp = body.signature?.timestamp;
        
        if (!signatureData) {
          log('info', '[generate_contract_only switch] Recherche signature dans contract_signatures...');
          
          const { data: signatures } = await client
            .from('contract_signatures')
            .select('signature_data, signed_at, signer_name')
            .eq('booking_id', body.bookingId)
            .order('created_at', { ascending: false });
          
          if (signatures && signatures.length > 0) {
            signatureData = signatures[0].signature_data;
            signatureTimestamp = signatures[0].signed_at;
            log('info', '[generate_contract_only switch] ✅ Signature trouvée', {
              signerName: signatures[0].signer_name,
              hasData: !!signatureData
            });
          } else {
            log('warn', '[generate_contract_only switch] Aucune signature trouvée');
          }
        }

        const contractLocale = body.locale && ['fr', 'en', 'es'].includes(body.locale) ? body.locale : 'fr';
        const ctx = await buildContractContext(client, body.bookingId);
        const contractUrl = await generateContractPDF(client, ctx, {
          guestSignatureData: signatureData,
          guestSignedAt: signatureTimestamp,
          locale: contractLocale
        });

        await client
          .from('bookings')
          .update({
            documents_generated: { ...booking.documents_generated, contract: true },
            signed_contract_url: contractUrl
          })
          .eq('id', booking.id);

        return new Response(
          JSON.stringify({ success: true, contractUrl, bookingId: booking.id, isSigned: !!signatureData }),
          { headers: corsHeaders }
        );
      }

      case 'generate_police_only': {
        log('info', '🚔 Action: Génération police uniquement');
        
        if (!body.bookingId) {
          throw new Error('bookingId requis');
        }

        const { data: bookingPolice } = await client
          .from('bookings')
          .select('*, property:properties(*), guests(*)')
          .eq('id', body.bookingId)
          .single();

        if (!bookingPolice) throw new Error('Booking non trouvé');

        // ✅ CORRECTION : Récupérer la signature depuis contract_signatures si non fournie
        let policeSignatureData = body.signature?.data;
        let policeSignatureTimestamp = body.signature?.timestamp;
        
        if (!policeSignatureData) {
          log('info', '[generate_police_only switch] Recherche signature dans contract_signatures...');
          
          const { data: policeSignatures } = await client
            .from('contract_signatures')
            .select('signature_data, signed_at, signer_name')
            .eq('booking_id', body.bookingId)
            .order('created_at', { ascending: false });
          
          if (policeSignatures && policeSignatures.length > 0) {
            policeSignatureData = policeSignatures[0].signature_data;
            policeSignatureTimestamp = policeSignatures[0].signed_at;
            log('info', '[generate_police_only switch] ✅ Signature trouvée', {
              signerName: policeSignatures[0].signer_name,
              hasData: !!policeSignatureData
            });
          } else {
            log('warn', '[generate_police_only switch] Aucune signature trouvée');
          }
        }

        const policeUrl = await generatePoliceFormsPDF(
          client,
          bookingPolice,
          false, // isPreview
          policeSignatureData, // guestSignatureData
          policeSignatureTimestamp // guestSignedAt
        );

        await client
          .from('bookings')
          .update({
            documents_generated: { ...bookingPolice.documents_generated, policeForm: true }
          })
          .eq('id', bookingPolice.id);

        return new Response(
          JSON.stringify({ success: true, policeUrl, bookingId: bookingPolice.id, isSigned: !!policeSignatureData }),
          { headers: corsHeaders }
        );
      }

      default: {
        log('info', '📝 Action: Soumission informations invité');
        
        const validation = validateRequest(body);
        if (!validation.isValid) {
          return new Response(
            JSON.stringify({ success: false, errors: validation.errors }),
            { status: 400, headers: corsHeaders }
          );
        }

        const result = await processGuestSubmission(client, body);

        return new Response(
          JSON.stringify({ success: true, ...result }),
          { headers: corsHeaders }
        );
      }
    }

  } catch (error) {
    log('error', '❌ Erreur', { error: error.message });

    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: corsHeaders }
    );
  }
});