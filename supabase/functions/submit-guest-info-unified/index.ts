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

  // Validation informations invité
  if (!request.guestInfo) {
    errors.push('Informations invité manquantes');
  } else {
    const { firstName, lastName, email } = request.guestInfo;
    
    if (!firstName || firstName.trim().length < 2) {
      errors.push('Prénom invalide (minimum 2 caractères)');
    }
    
    if (!lastName || lastName.trim().length < 2) {
      errors.push('Nom invalide (minimum 2 caractères)');
    }
    
    // Validation email OBLIGATOIRE avec support caractères internationaux
    if (!email || !email.trim()) {
      errors.push('Email requis');
    } else {
      const emailRegex = /^[a-zA-Z0-9.!#$%&'*+\/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
      if (!emailRegex.test(email.trim())) {
        errors.push('Email invalide (format incorrect)');
      }
    }
    
    if (!request.guestInfo.phone) {
      warnings.push('Numéro de téléphone non fourni');
    }
    
    if (!request.guestInfo.nationality) {
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
    const { data: bookingReservation, error: bookingError } = await supabase
      .from('bookings')
      .select('*')
      .eq('property_id', tokenData.property.id)
      .eq('booking_reference', airbnbCode)
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
    // Les dates ICS sont déjà au format YYYY-MM-DD, pas besoin de conversion
    const checkInDate = typeof reservationData.startDate === 'string' 
      ? reservationData.startDate.split('T')[0] 
      : new Date(reservationData.startDate).toISOString().split('T')[0];
    const checkOutDate = typeof reservationData.endDate === 'string'
      ? reservationData.endDate.split('T')[0]
      : new Date(reservationData.endDate).toISOString().split('T')[0];
    
    // Vérifier si une réservation existe déjà pour ce code Airbnb
    const { data: existingBooking } = await supabase
      .from('bookings')
      .select('id, status')
      .eq('property_id', tokenData.property.id)
      .eq('booking_reference', reservationData.airbnbCode)
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
  guestInfo: GuestInfo, 
  idDocuments: IdDocument[]
): Promise<string> {
  log('info', 'ÉTAPE 2: Démarrage de la sauvegarde des données', {
    guest: `${guestInfo.firstName} ${guestInfo.lastName}`,
    documentsCount: idDocuments.length,
    propertyId: booking.propertyId
  });

  return await withRetry(async () => {
    const supabase = await getServerClient();
    const sanitizedGuest = sanitizeGuestInfo(guestInfo);

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
        const fullGuestName = `${sanitizedGuest.firstName} ${sanitizedGuest.lastName}`;
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
        const { data } = await supabase
          .from('bookings')
          .select('id')
          .eq('property_id', booking.propertyId)
          .eq('booking_reference', booking.airbnbCode)
          .maybeSingle();
        existingBooking = data;
      }
    }

    let savedBooking;
    const bookingData = {
      property_id: booking.propertyId,
      check_in_date: booking.checkIn,
      check_out_date: booking.checkOut,
      guest_name: `${sanitizedGuest.firstName} ${sanitizedGuest.lastName}`,
      number_of_guests: booking.numberOfGuests || 1,
      total_price: booking.totalPrice || null,
      booking_reference: booking.airbnbCode,
      guest_email: sanitizedGuest.email,
      guest_phone: sanitizedGuest.phone || null,
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
          newGuestName: `${sanitizedGuest.firstName} ${sanitizedGuest.lastName}`,
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
      
      // ✅ CORRIGÉ : Vérifier à nouveau juste avant l'insertion pour éviter les doublons
      // (protection contre les race conditions entre la vérification et l'insertion)
      const lastCheck = await supabase
        .from('bookings')
        .select('id, status')
        .eq('property_id', booking.propertyId)
        .eq('booking_reference', booking.airbnbCode)
        .maybeSingle();
      
      if (lastCheck.data) {
        // Une réservation a été créée entre-temps, utiliser celle-ci
        log('warn', 'Réservation créée entre-temps (race condition évitée)', { 
          bookingId: lastCheck.data.id,
          status: lastCheck.data.status
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
      const { data, error: insertError } = await supabase
        .from('bookings')
        .insert(newBookingData)
        .select()
        .single();
      
        if (insertError) {
          // ✅ CORRIGÉ : Si erreur de contrainte unique (doublon), récupérer la réservation existante
          if (insertError.code === '23505') { // Unique constraint violation
            log('warn', 'Violation contrainte unique détectée (doublon évité)', { error: insertError });
            
            // Récupérer la réservation existante
            const { data: existingData } = await supabase
              .from('bookings')
              .select('id')
              .eq('property_id', booking.propertyId)
              .eq('booking_reference', booking.airbnbCode)
              .maybeSingle();
            
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
    log('info', 'Sauvegarde des informations invité');
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
    const guestData: any = {
      booking_id: bookingId,
      full_name: `${sanitizedGuest.firstName} ${sanitizedGuest.lastName}`,
      nationality: sanitizedGuest.nationality || 'Non spécifiée',
      document_type: sanitizedGuest.idType || 'passport',
      document_number: sanitizedGuest.idNumber || '',
      date_of_birth: processedDateOfBirth,
      phone: sanitizedGuest.phone || null, // ✅ AJOUT : Téléphone du guest
      // ✅ CRITIQUE : Ajouter tous les champs pour la variabilisation complète
      place_of_birth: '', // Non disponible dans GuestInfo pour l'instant
      profession: sanitizedGuest.profession || '',
      motif_sejour: sanitizedGuest.motifSejour || 'TOURISME',
      adresse_personnelle: sanitizedGuest.adressePersonnelle || '',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    
    // ✅ CRITIQUE : Essayer d'ajouter email seulement si la colonne existe
    // (géré par Supabase - si la colonne n'existe pas, elle sera ignorée)
    if (sanitizedGuest.email) {
      guestData.email = sanitizedGuest.email;
    }
    
    log('info', 'Sauvegarde données invité', {
      guestName: guestData.full_name,
      dateOfBirth: guestData.date_of_birth,
      originalDateOfBirth: sanitizedGuest.dateOfBirth,
      hasDateOfBirth: !!guestData.date_of_birth,
      processedDateOfBirth,
      email: guestData.email, // ✅ DIAGNOSTIC : Log de l'email
      phone: guestData.phone, // ✅ DIAGNOSTIC : Log du téléphone
      hasEmail: !!guestData.email,
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

    const maxGuests = booking.numberOfGuests || 1;

    if (maxGuests === 1) {
      // Cas réservation pour 1 invité: on met à jour l'unique ligne au lieu d'insérer
      if (existingGuest && existingGuest.id) {
        // ✅ CRITIQUE : Construire l'objet de mise à jour avec gestion conditionnelle de l'email
        const updateData: any = {
            full_name: guestData.full_name,
            nationality: guestData.nationality,
            document_type: guestData.document_type,
            document_number: guestData.document_number,
            date_of_birth: guestData.date_of_birth,
            phone: guestData.phone, // ✅ AJOUT : Téléphone du guest
          // ✅ CRITIQUE : Mettre à jour tous les champs pour la variabilisation complète
          place_of_birth: guestData.place_of_birth,
          profession: guestData.profession,
          motif_sejour: guestData.motif_sejour,
          adresse_personnelle: guestData.adresse_personnelle,
            updated_at: new Date().toISOString()
        };
        
        // ✅ CRITIQUE : Ajouter email seulement si présent (colonne peut ne pas exister)
        if (guestData.email) {
          updateData.email = guestData.email;
        }
        
        const { error: updateErr } = await supabase
          .from('guests')
          .update(updateData)
          .eq('id', existingGuest.id);
        if (updateErr) {
          log('warn', 'Avertissement mise à jour invité (single booking)', { error: updateErr });
        } else {
          log('info', 'Invité mis à jour (single booking)');
        }
      } else if (Array.isArray(existingGuestsForBooking) && existingGuestsForBooking.length > 0) {
        // Une ligne existe déjà pour cette réservation: la mettre à jour
        const firstGuestId = existingGuestsForBooking[0].id;
        // ✅ CRITIQUE : Construire l'objet de mise à jour avec gestion conditionnelle de l'email
        const updateData: any = {
            full_name: guestData.full_name,
            nationality: guestData.nationality,
            document_type: guestData.document_type,
            document_number: guestData.document_number,
            date_of_birth: guestData.date_of_birth,
            phone: guestData.phone, // ✅ AJOUT : Téléphone du guest
          // ✅ CRITIQUE : Mettre à jour tous les champs pour la variabilisation complète
          place_of_birth: guestData.place_of_birth,
          profession: guestData.profession,
          motif_sejour: guestData.motif_sejour,
          adresse_personnelle: guestData.adresse_personnelle,
            updated_at: new Date().toISOString()
        };
        
        // ✅ CRITIQUE : Ajouter email seulement si présent (colonne peut ne pas exister)
        if (guestData.email) {
          updateData.email = guestData.email;
        }
        
        const { error: updateErr } = await supabase
          .from('guests')
          .update(updateData)
          .eq('id', firstGuestId);
        if (updateErr) {
          log('warn', 'Avertissement mise à jour invité existant (single booking)', { error: updateErr });
        } else {
          log('info', 'Invité existant mis à jour (single booking)');
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
      // Réservations multi-invités: éviter doublons et ne pas dépasser le maximum
      if (existingGuest) {
        log('info', 'Invité déjà existant, pas de doublon créé', { 
          guestId: existingGuest.id,
          guestName: guestData.full_name 
        });
      } else {
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

    // 4. Création de l'entrée guest_submissions pour le suivi complet
    log('info', 'Création de l\'entrée de suivi');
    // Trouver le token_id correspondant - on utilise le premier token actif pour cette propriété
    const { data: tokenData } = await supabase
      .from('property_verification_tokens')
      .select('id')
      .eq('property_id', booking.propertyId)
      .eq('is_active', true)
      .limit(1)
      .single();

    const submissionData = {
      id: crypto.randomUUID(),
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
        ...sanitizedGuest,
        fullName: `${sanitizedGuest.firstName} ${sanitizedGuest.lastName}`
      },
      document_urls: idDocuments.map(doc => doc.url),
      status: 'pending',
      submitted_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    const { error: submissionError } = await supabase
      .from('guest_submissions')
      .insert(submissionData);

    if (submissionError) {
      log('warn', 'Avertissement sauvegarde submission', { error: submissionError });
      // Continuer, c'est pour le suivi seulement
    } else {
      log('info', 'Entrée de suivi créée');
    }

    log('info', 'Sauvegarde des données terminée avec succès', { bookingId });
    return bookingId;

  }, 'Sauvegarde des données invité');
}

// ÉTAPE 3: Génération du contrat avec gestion d'erreur robuste
async function generateContractInternal(bookingId: string, signature?: SignatureData): Promise<string> {
  log('info', 'ÉTAPE 3: Démarrage génération contrat', {
    bookingId,
    hasSignature: !!signature
  });

  return await withRetry(async () => {
    const functionUrl = Deno.env.get('SUPABASE_URL');
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!functionUrl || !serviceKey) {
      throw new Error('Configuration Supabase manquante');
    }

    // Create supabase client for this operation
    const supabaseClient = await getServerClient();

    // 1. Récupérer les données du booking depuis la base
    log('info', 'Construction du contexte contrat');
    const ctx = await buildContractContext(supabaseClient, bookingId);
    log('info', 'Contexte contrat construit', {
      propertyName: ctx.property.name,
      guestsCount: ctx.guests.length,
      duration: ctx.booking.duration_human
    });

    // 2. Générer le PDF avec pdf-lib intégré
    log('info', 'Génération PDF avec pdf-lib');
    const pdfUrl = await generateContractPDF(supabaseClient, ctx, {
      guestSignatureData: signature?.data,
      guestSignedAt: signature?.timestamp
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
async function generatePoliceFormsInternal(bookingId: string): Promise<string> {
  log('info', 'ÉTAPE 4: Démarrage génération fiche de police', { bookingId });

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
      const { data: hp } = await supabaseClient
        .from('host_profiles')
        .select(`
          id,
          full_name,
          first_name,
          last_name,
          phone,
          email
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

    const invalidGuests = guests.filter((guest: any) => 
      !guest.full_name?.trim() || !guest.document_number?.trim()
    );
    
    if (invalidGuests.length > 0) {
      throw new Error(`${invalidGuests.length} invité(s) ont des données incomplètes`);
    }

    log('info', `Génération fiches de police pour ${guests.length} invités validés`);

    // ✅ CORRECTION : S'assurer que booking.guests contient les guests récupérés
    booking.guests = guests;

    // 3. Générer le PDF des fiches de police
    log('info', '📄 [POLICE] Génération PDF des fiches de police');
    const policeUrl = await generatePoliceFormsPDF(supabaseClient, booking);
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

    // ✅ CORRECTION : Utiliser l'URL complète avec le bon format d'authentification
    const response = await fetch(`${functionUrl}/functions/v1/send-guest-contract`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${serviceKey}`,
        'apikey': serviceKey,
        'x-client-info': `${FUNCTION_NAME}/1.0`
      },
      body: JSON.stringify(emailData)
    });

    if (!response.ok) {
      const errorText = await response.text();
      log('error', 'Réponse HTTP non-OK de send-guest-contract', {
        status: response.status,
        statusText: response.statusText,
        errorText
      });
      throw new Error(`Envoi email échoué: ${response.status} ${response.statusText}`);
    }

    const result = await response.json();

    if (!result.success) {
      log('error', 'Réponse d\'erreur de send-guest-contract', { result });
      throw new Error(`Envoi email échoué: ${result.error || 'Erreur inconnue'}`);
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
    
    // ✅ Utiliser des statuts valides pour l'énum booking_status (frontend attend 'pending' | 'completed' | 'archived')
    const updateData = {
      status: hasSignature ? 'completed' : 'pending',
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
        
        // ✅ Créer un booking temporaire EN BASE avec le service role key (contourne RLS)
        // Générer un UUID valide pour le booking temporaire
        const tempBookingId = crypto.randomUUID();
        
        log('info', '📝 Création booking temporaire', { tempBookingId });
        
        const { error: bookingError } = await supabaseClient
          .from('bookings')
          .insert({
            id: tempBookingId,
            property_id: requestBody.bookingData.propertyId,
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
        
        // ✅ CORRECTION : Ne pas inclure email si la colonne n'existe pas dans la table
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
        
        // ✅ CRITIQUE : Essayer d'ajouter email seulement si la colonne existe
        // (géré par Supabase - si la colonne n'existe pas, elle sera ignorée)
        if (bookingData.guest_email) {
          guestData.email = bookingData.guest_email;
        }
        
        const { error: insertError } = await supabaseClient
          .from('guests')
          .insert(guestData);
        
        if (insertError) {
          log('warn', 'Erreur lors de la création du guest', { error: insertError });
        } else {
          log('info', '[generate_contract_only] Guest créé avec succès');
        }
      }
      
      // ✅ CORRECTION : Signature optionnelle pour generate_contract_only
      if (!requestBody.signature) {
        log('warn', 'Aucune signature fournie, génération contrat non signé');
      }
      
      // ✅ CORRECTION : Sauvegarder le contrat même non signé
      const contractUrl = await generateContractInternal(requestBody.bookingId, requestBody.signature);
      
      if (contractUrl) {
        // Sauvegarder le document en base même non signé
        await saveDocumentToDatabase(supabaseClient, requestBody.bookingId, 'contract', contractUrl, !!requestBody.signature);
        
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
              contractUrl
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
          isSigned: !!requestBody.signature,
          emailSent: emailSent,
          message: 'Contrat généré avec succès'
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
    if (requestBody.action === 'generate_contract_with_signature') {
      log('info', '🔄 Mode: Génération contrat avec signature invité');
      
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
        
        const contractUrl = await generateContractInternal(requestBody.bookingId, signatureData);
        
        return new Response(JSON.stringify({
          success: true,
          contractUrl,
          message: 'Contrat avec signature généré avec succès'
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
      // ✅ NOUVEAU : Action pour les réservations créées directement par le host
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
      log('info', '✅ Validation réussie pour host_direct');
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
        booking = await getExistingICSBooking(requestBody.token, requestBody.guestInfo);
        log('info', 'Réservation ICS existante récupérée avec succès', {
          bookingId: booking.bookingId,
          airbnbCode: booking.airbnbCode,
          dates: `${booking.checkIn} → ${booking.checkOut}`
        });
      } else if (requestBody.airbnbCode === 'INDEPENDENT_BOOKING' || !requestBody.airbnbCode) {
        log('info', 'Réservation indépendante détectée (formulaire), création directe');
        booking = await createIndependentBooking(requestBody.token, requestBody.guestInfo, requestBody.bookingData);
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
          .eq('guest_name', `${requestBody.guestInfo.firstName} ${requestBody.guestInfo.lastName}`)
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
      
      bookingId = await saveGuestDataInternal(booking, requestBody.guestInfo, requestBody.idDocuments);
      
      log('info', 'Booking ID sauvegardé avec succès', { bookingId });
      }
      
      // ✅ VÉRIFICATION CRITIQUE : S'assurer que bookingId est défini avant de continuer
      if (!bookingId) {
        log('error', '❌ CRITICAL: bookingId is not defined before document generation');
        throw new Error('bookingId manquant avant la génération des documents');
      }

      // ÉTAPE 3, 4 & 5: Génération des documents en parallèle
      log('info', '🎯 ÉTAPE 3-5/5: Génération des documents en parallèle');
      
      const documentPromises: Promise<string>[] = [
        generateContractInternal(bookingId, requestBody.signature)
      ];

      if (!requestBody.skipPolice) {
        documentPromises.push(
          generatePoliceFormsInternal(bookingId).catch(error => {
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
      if (!requestBody.skipEmail && !requestBody.generateOnly) {
        log('info', '🎯 ÉTAPE 5/5: Vérification envoi email');
        
        // Vérifier si l'email est fourni
        if (requestBody.guestInfo.email && requestBody.guestInfo.email.trim()) {
          log('info', 'Email fourni, envoi du contrat...');
          try {
            emailSent = await sendGuestContractInternal(
              requestBody.guestInfo, 
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
    guestsCount: b.guests?.length || 0
  });

  // ✅ VARIABILISATION COMPLÈTE : Récupération host profile avec toutes les données
  let host = null;
  if (b?.property?.user_id) {
    const { data: hp } = await client
      .from('host_profiles')
      .select(`
        id,
        full_name,
        first_name,
        last_name,
        phone,
        email,
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

  // Priorité: contract_template.landlord_signature -> host_profiles -> autres
  if (contractTemplate.landlord_signature) {
    hostSignature = contractTemplate.landlord_signature;
    hostSignatureType = contractTemplate.landlord_signature.startsWith('data:image/svg') ? 'svg' : 'image';
  } else if (host?.signature_svg) {
    hostSignature = host.signature_svg;
    hostSignatureType = 'svg';
  } else if (host?.signature_image_url) {
    hostSignature = host.signature_image_url;
    hostSignatureType = 'image';
  } else if (contract_template?.landlord_signature_url) {
    hostSignature = contract_template.landlord_signature_url;
    hostSignatureType = 'image';
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
      
      // Signature
      signature: hostSignature,
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
async function saveDocumentToDatabase(client: any, bookingId: string, documentType: string, documentUrl: string, isSigned: boolean = false) {
  const fileName = `${documentType}-${bookingId}-${Date.now()}.pdf`;
  
  // ✅ CORRECTION : Gestion intelligente des versions de contrats
  try {
    // Pour les contrats, gérer les versions signées vs non signées
    if (documentType === 'contract') {
      const { data: existingContract } = await client
        .from('generated_documents')
        .select('id, is_signed')
        .eq('booking_id', bookingId)
        .eq('document_type', 'contract')
        .maybeSingle();

      if (existingContract) {
        if (isSigned && !existingContract.is_signed) {
          // Remplacer le contrat non signé par le contrat signé
          log('info', 'Replacing unsigned contract with signed version');
          await client
            .from('generated_documents')
            .update({
              document_url: documentUrl,
              is_signed: true,
              updated_at: new Date().toISOString()
            })
            .eq('id', existingContract.id);
          
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
          
          return existingContract;
        } else if (!isSigned && existingContract.is_signed) {
          // Ne pas remplacer un contrat signé par un non signé
          log('warn', 'Cannot replace signed contract with unsigned version');
          return existingContract;
        } else {
          // Même statut de signature, ne pas dupliquer
          log('warn', `Contract with same signature status already exists for booking ${bookingId}`);
          return existingContract;
        }
      }
    } else {
      // ✅ CORRECTION : Pour les documents d'identité, permettre plusieurs documents (un par invité)
      // Pour les autres types (police), vérifier l'existence et éviter les duplications
      if (documentType !== 'identity') {
        const { data: existingGenerated } = await client
          .from('generated_documents')
          .select('id')
          .eq('booking_id', bookingId)
          .eq('document_type', documentType)
          .maybeSingle();

        if (existingGenerated) {
          log('warn', `Document ${documentType} already exists for booking ${bookingId}, skipping duplicate`);
          return existingGenerated;
        }
      } else {
        // Pour identity, vérifier si cette URL exacte existe déjà
        const { data: existingIdentity } = await client
          .from('generated_documents')
          .select('id')
          .eq('booking_id', bookingId)
          .eq('document_type', 'identity')
          .eq('document_url', documentUrl)
          .maybeSingle();
          
        if (existingIdentity) {
          log('info', `Identity document with same URL already exists, skipping duplicate`);
          return existingIdentity;
        }
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

// Generate contract PDF with pdf-lib (version simplifiée et robuste)
async function generateContractPDF(client: any, ctx: any, signOpts: any = {}): Promise<string> {
  log('info', 'Creating contract PDF with pdf-lib...');
  
  const { guestSignatureData, guestSignedAt } = signOpts;
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
  const hostName = contractTemplate.landlord_name || 
    ctx.host?.name ||
    ctx.host?.full_name || 
    (ctx.host?.first_name && ctx.host?.last_name ? `${ctx.host.first_name} ${ctx.host.last_name}` : '') ||
    ctx.host?.first_name || ctx.host?.last_name ||
    ctx.property.contact_info?.name || 
    ctx.property.name || 
    'Propriétaire';

  // Configuration PDF
  const pageWidth = 612, pageHeight = 792;
  const margin = 50;
  const maxWidth = pageWidth - margin * 2;
  const titleSize = 16, sectionSize = 12, bodySize = 11;
  const lineGap = 14;

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
    currentPage.drawText(property.name || 'Contrat de Location', {
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

  function drawSectionTitle(text: string) {
    ensureSpace(sectionSize + 6);
    currentPage.drawText(text, {
      x: margin,
      y,
      size: sectionSize,
      font: fontBold
    });
    y -= lineGap + 5;
  }

  // Première page
  addPage();

  // ✅ Titre principal - format exact frontend
  ensureSpace(titleSize + 10);
  currentPage.drawText("CONTRAT DE LOCATION MEUBLEE DE COURTE", {
    x: margin,
    y,
    size: titleSize,
    font: fontBold
  });
  y -= titleSize + 2;
  currentPage.drawText("DUREE", {
    x: margin,
    y,
    size: titleSize,
    font: fontBold
  });
  y -= titleSize + 15;

  // Line separator
  currentPage.drawLine({
    start: { x: margin, y },
    end: { x: pageWidth - margin, y },
    color: rgb(0, 0, 0),
    thickness: 0.5
  });
  y -= 20;

  // Section "ENTRE LES SOUSSIGNÉS" avec variabilisation complète
  drawSectionTitle("ENTRE LES SOUSSIGNÉS");
  
  // ✅ BAILLEUR selon format exact du frontend
  drawParagraph("LE BAILLEUR :");
  
  // ✅ Format exact frontend: utiliser hostName déjà défini plus haut
  let bailleurInfo = `${hostName}, `;
  
  // Ajouter le statut entreprise si applicable
  if (host?.status === 'entreprise' && host?.company_name) {
    bailleurInfo += `représentant de ${host.company_name}, `;
  }
  
  bailleurInfo += `Gestionnaire et/ou propriétaire du bien, ci-après dénommé "Le Bailleur"`;
  drawParagraph(bailleurInfo);
  y -= 10;
  
  // ✅ LOCATAIRE selon format exact du frontend
  drawParagraph("LE LOCATAIRE :");
  
  // Format: "Nom, né(e) le __/__/____, de nationalité ______, titulaire du document d'identité n° ______, ci-après dénommé(e) "Le Locataire""
  let locataireInfo = mainGuest.full_name || '_________________';
  locataireInfo += `, né(e) le ${mainGuest.date_of_birth ? fmtFR(mainGuest.date_of_birth) : '__/__/____'}`;
  locataireInfo += `, de nationalité ${mainGuest.nationality || '_________________'}`;
  locataireInfo += `, titulaire du document d'identité n° ${mainGuest.document_number || '_________________'}`;
  locataireInfo += `, ci-après dénommé(e) "Le Locataire"`;
  
  drawParagraph(locataireInfo);
  y -= 20;

  // Articles du contrat avec variabilisation complète
  drawSectionTitle("ARTICLE 1 - OBJET DE LA LOCATION");
  let propertyDescription = `Le présent contrat a pour objet la location meublée de courte durée du bien immobilier suivant : `;
  
  // ✅ Description enrichie de la propriété
  if (property.property_type) {
    const typeLabels = {
      'apartment': 'appartement',
      'house': 'maison',
      'villa': 'villa',
      'studio': 'studio',
      'room': 'chambre'
    };
    propertyDescription += `${typeLabels[property.property_type] || property.property_type} `;
  }
  
  propertyDescription += `"${property.name || 'Non spécifié'}"`;
  
  if (property.address) {
    propertyDescription += `, situé ${property.address}`;
  }
  
  if (property.city && property.city !== property.address) {
    propertyDescription += `, ${property.city}`;
  }
  
  if (property.country && property.country !== 'Maroc') {
    propertyDescription += `, ${property.country}`;
  }
  
  propertyDescription += `. Le logement est loué entièrement meublé et équipé pour un usage d'habitation temporaire`;
  
  if (property.max_occupancy) {
    propertyDescription += ` pouvant accueillir jusqu'à ${property.max_occupancy} personnes`;
  }
  
  propertyDescription += `.`;
  
  if (property.description) {
    propertyDescription += ` Description : ${property.description}`;
  }
  
  drawParagraph(propertyDescription);

  // ✅ ARTICLE 2 selon format exact du frontend
  drawSectionTitle("ARTICLE 2 - DURÉE ET PÉRIODE");
  
  // Format exact: "La location est consentie pour une durée déterminée du .... à 16h00 au .... à 11h00."
  let durationText = `La location est consentie pour une durée déterminée du ${fmtFR(booking.check_in)} à 16h00 au ${fmtFR(booking.check_out)} à 11h00. Cette période ne pourra être prolongée qu'avec l'accord écrit préalable du Bailleur.`;
  
  drawParagraph(durationText);

  // ✅ ARTICLE 3 selon format exact du frontend
  drawSectionTitle("ARTICLE 3 - OCCUPANTS AUTORISÉS");
  
  let occupantsText = `Le logement sera occupé par ${booking.guests_count} personne(s) maximum. Liste des occupants autorisés :\n\n`;
  
  // Liste des invités avec format exact du frontend
  for (const guest of guests) {
    const guestName = guest.full_name || `${guest.first_name || ''} ${guest.last_name || ''}`.trim() || '_______________';
    const birthDate = guest.date_of_birth ? fmtFR(guest.date_of_birth) : '__/__/____';
    const docNumber = guest.document_number || '_______________';
    occupantsText += `${guestName} - Né(e) le ${birthDate} - Document n° ${docNumber}\n`;
  }
  
  // Ajouter une ligne vide si moins d'occupants que prévu
  if (guests.length < booking.guests_count) {
    occupantsText += `_______________ - Né(e) le __/__/____ - Document n° _______________\n`;
  }
  
  occupantsText += `Toute personne non mentionnée ci-dessus est strictement interdite dans le logement.`;
  
  drawParagraph(occupantsText);

  // ✅ RÈGLEMENT INTÉRIEUR avec rules personnalisées
  drawSectionTitle("ARTICLE 4 - RÈGLEMENT INTÉRIEUR ET OBLIGATIONS");
  drawParagraph("Le locataire s'engage à respecter les règles suivantes :");
  
  // Utiliser les règles personnalisées ou les règles par défaut
  const rulesToDisplay = property.house_rules && property.house_rules.length > 0 
    ? property.house_rules 
    : [
      'Aucun invité non autorisé ou fête',
      'Interdiction de fumer à l\'intérieur du bien',
      'Respecter les voisins et les règles de l\'immeuble',
      'Signaler immédiatement tout dommage',
      'Libérer les lieux à l\'heure convenue'
    ];
  
  rulesToDisplay.forEach((rule: string) => {
    if (rule && rule.trim()) {
      drawParagraph(`• ${rule.trim()}`);
    }
  });
  
  // ✅ Ajouter contact d'urgence si disponible
  if (property.contact?.phone || host.phone) {
    const contactPhone = property.contact?.phone || host.phone;
    drawParagraph(`• En cas d'urgence, contacter le propriétaire au : ${contactPhone}`);
  }

  drawSectionTitle("ARTICLE 5 - RESPONSABILITÉS ET ASSURANCES");
  drawParagraph("Le Locataire est entièrement responsable de tout dommage causé au logement, aux équipements et au mobilier. Il s'engage à restituer le bien dans l'état où il l'a trouvé. Le Bailleur décline toute responsabilité en cas de vol, perte ou dommage aux effets personnels du Locataire.");

  drawSectionTitle("ARTICLE 6 - RÉSILIATION");
  drawParagraph("En cas de non-respect des présentes conditions, le Bailleur se réserve le droit de procéder à la résiliation immédiate du contrat et d'exiger la libération des lieux sans délai ni indemnité.");

  drawSectionTitle("ARTICLE 7 - DROIT APPLICABLE");
  drawParagraph("Le présent contrat est régi par le droit marocain. Tout litige sera de la compétence exclusive des tribunaux de Casablanca.");

  // ✅ Lieu et date avec informations variables
  const city = property.city || property.address?.split(',')[0] || 'Casablanca';
  y -= 20;
  drawParagraph(`Fait à ${city}, le ${fmtFR(new Date().toISOString())}`);
  
  // ✅ Informations légales supplémentaires si disponibles
  if (host.company_name || host.ice || host.registration) {
    y -= 15;
    let legalInfo = '';
    if (host.company_name) {
      legalInfo += `Entreprise : ${host.company_name}`;
    }
    if (host.registration) {
      legalInfo += legalInfo ? ` - RC : ${host.registration}` : `RC : ${host.registration}`;
    }
    if (host.ice) {
      legalInfo += legalInfo ? ` - ICE : ${host.ice}` : `ICE : ${host.ice}`;
    }
    if (host.tax_id && host.tax_id !== host.ice) {
      legalInfo += ` - ID Fiscal : ${host.tax_id}`;
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
  const hostSignatureType = ctx.host.signatureType;
  
  if (hostSignature) {
    try {
      if (hostSignatureType === 'svg') {
        // Pour SVG, afficher le nom en italique avec mention "signature électronique"
        currentPage.drawText(hostName, {
          x: col1 + 10,
          y: y - signatureBoxHeight + 30,
          size: bodySize,
          font: fontRegular
        });
        currentPage.drawText("(signature electronique)", {
          x: col1 + 10,
          y: y - signatureBoxHeight + 15,
          size: bodySize - 2,
          font: fontRegular
        });
      } else if (hostSignature.startsWith('data:image/') || hostSignature.startsWith('http')) {
        // Pour les images, essayer d'intégrer la signature
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
      let guestImageBytes;
      
      if (guestSignatureData.startsWith('data:')) {
        const base64Data = guestSignatureData.split(',')[1];
        guestImageBytes = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
      } else {
        const response = await fetch(guestSignatureData);
        guestImageBytes = new Uint8Array(await response.arrayBuffer());
      }
      
      let guestImage;
      if (guestSignatureData.includes('png') || guestSignatureData.includes('PNG')) {
        guestImage = await pdfDoc.embedPng(guestImageBytes);
      } else {
        guestImage = await pdfDoc.embedJpg(guestImageBytes);
      }
      
      const guestSigDims = guestImage.scale(0.3);
      
      currentPage.drawImage(guestImage, {
        x: col2 + 10,
        y: y - signatureBoxHeight + 10,
        width: Math.min(guestSigDims.width, signatureBoxWidth - 20),
        height: Math.min(guestSigDims.height, signatureBoxHeight - 20)
      });
      
      log('info', 'Signature du locataire intégrée au PDF');
    } catch (e) {
      log('warn', 'Échec intégration signature locataire:', e);
      currentPage.drawText("_________________", {
        x: col2 + 10,
        y: y - signatureBoxHeight + 30,
        size: bodySize - 1,
        font: fontRegular
      });
    }
  } else {
    currentPage.drawText("_________________", {
      x: col2 + 10,
      y: y - signatureBoxHeight + 30,
      size: bodySize - 1,
      font: fontRegular
    });
  }
  
  // ✅ Labels selon format exact frontend
  y -= signatureBoxHeight + 5;
  currentPage.drawText("LE BAILLEUR", {
    x: col1,
    y,
    size: bodySize,
    font: fontBold
  });
  
  currentPage.drawText("LE LOCATAIRE", {
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

  y -= 15;
  currentPage.drawText(`Date : ${new Date().toLocaleDateString('fr-FR')}`, {
    x: col1,
    y,
    size: bodySize - 1,
    font: fontRegular
  });
  
  if (guestSignedAt) {
    currentPage.drawText(`Date : ${fmtFR(guestSignedAt)}`, {
      x: col2,
      y,
      size: bodySize - 1,
      font: fontRegular
    });
  } else {
    currentPage.drawText("Date : ____/____/______", {
      x: col2,
      y,
      size: bodySize - 1,
      font: fontRegular
    });
  }

  // Mentions de signature électronique si présentes
  if (guestSignatureData) {
    y -= 20;
    currentPage.drawText("* Signature electronique locataire validee", {
      x: col2,
      y,
      size: bodySize - 2,
      font: fontRegular
    });
    if (guestSignedAt) {
      y -= 12;
      currentPage.drawText(`le ${fmtFR(guestSignedAt)}`, {
        x: col2,
        y,
        size: bodySize - 2,
        font: fontRegular
      });
    }
  }

  // Footer with page numbers
  pages.forEach((p, i) => {
    p.drawText(`Page ${i + 1}/${pages.length}`, {
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
async function generatePoliceFormsPDF(client: any, booking: any, isPreview: boolean = false): Promise<string> {
  log('info', 'Création PDF fiches de police format officiel marocain...');
  
  const guests = booking.guests || [];
  let property = booking.property || {};
  
  // ✅ AMÉLIORATION : Si contract_template n'est pas chargé, le récupérer explicitement
  if (!property.contract_template && property.id) {
    log('info', '[Police] contract_template manquant, récupération explicite...');
    const { data: propertyData } = await client
      .from('properties')
      .select('contract_template')
      .eq('id', property.id)
      .single();
    
    if (propertyData?.contract_template) {
      property.contract_template = propertyData.contract_template;
      log('info', '[Police] contract_template récupéré avec succès');
    }
  }
  
  // ✅ DIAGNOSTIC : Log de la propriété avant génération
  log('info', '[Police] Données propriété:', {
    hasProperty: !!property,
    propertyId: property.id,
    hasContractTemplate: !!property.contract_template,
    contractTemplateType: typeof property.contract_template,
    contractTemplateKeys: property.contract_template ? Object.keys(property.contract_template) : [],
    hasLandlordSignature: !!(property.contract_template as any)?.landlord_signature
  });
  
  // Configuration PDF - Format officiel A4 identique au modèle
  const pageWidth = 595.28; // A4 width
  const pageHeight = 841.89; // A4 height
  const margin = 50;
  const fontSize = 11;
  const titleFontSize = 14;
  const fieldHeight = 22;

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
    const fontSize = 11; // Taille de police pour les champs
    const baseFieldHeight = 20; // Hauteur de base d'un champ
    const labelSpacing = 15; // Espacement entre label et ligne
    const lineSpacing = 14; // Espacement entre les lignes pour multi-ligne
    
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
    yPosition = drawBilingualField(page, 'Date de délivrance / Date of issue', 'تاريخ الإصدار', '', margin, yPosition);
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
    
    yPosition -= 30;
    
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
    
    yPosition -= 30;
    
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
    
    yPosition -= 50;
    
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
    
    page.drawText('Signature du loueur', {
      x: margin,
      y: yPosition,
      size: fontSize,
      font: font
    });
    yPosition -= 10;
    
    // ✅ NOUVEAU : Intégrer la signature du loueur dans la fiche de police
    // ✅ AMÉLIORATION : Récupérer la signature depuis plusieurs sources possibles
    const contractTemplate = property.contract_template || {};
    let hostSignature = contractTemplate.landlord_signature;
    
    // ✅ FALLBACK : Si pas de signature dans contract_template, essayer depuis host_profiles
    if (!hostSignature && booking.host) {
      hostSignature = booking.host.signature_svg || booking.host.signature_image_url || null;
    }
    
    // ✅ DIAGNOSTIC : Log détaillé pour comprendre pourquoi la signature n'apparaît pas
    log('info', '[Police] Recherche signature du loueur:', {
      hasProperty: !!property,
      hasContractTemplate: !!contractTemplate,
      contractTemplateKeys: Object.keys(contractTemplate),
      hasLandlordSignature: !!contractTemplate.landlord_signature,
      landlordSignatureType: contractTemplate.landlord_signature ? typeof contractTemplate.landlord_signature : 'none',
      landlordSignaturePrefix: contractTemplate.landlord_signature ? contractTemplate.landlord_signature.substring(0, 50) : 'none',
      hasHost: !!booking.host,
      hostSignatureSvg: !!booking.host?.signature_svg,
      hostSignatureImage: !!booking.host?.signature_image_url,
      finalHostSignature: !!hostSignature
    });
    
    if (hostSignature && (hostSignature.startsWith('data:image/') || hostSignature.startsWith('http') || hostSignature.startsWith('data:image/svg'))) {
      try {
        log('info', '[Police] Embedding host signature in police form...', {
          signatureType: hostSignature.startsWith('data:image/svg') ? 'svg' : 
                        hostSignature.startsWith('data:image/png') ? 'png' :
                        hostSignature.startsWith('data:image/jpg') || hostSignature.startsWith('data:image/jpeg') ? 'jpg' :
                        hostSignature.startsWith('http') ? 'url' : 'unknown',
          signatureLength: hostSignature.length
        });
        
        let signatureImageBytes;
        if (hostSignature.startsWith('data:')) {
          // ✅ GESTION SVG : Les signatures SVG doivent être converties en image
          if (hostSignature.startsWith('data:image/svg')) {
            log('warn', '[Police] Signature SVG détectée - conversion non supportée, utilisation du texte');
            // Pour SVG, on ne peut pas l'embed directement, on continue sans image
            hostSignature = null;
          } else {
            const base64Data = hostSignature.split(',')[1];
            if (!base64Data) {
              throw new Error('Base64 data manquante dans la signature');
            }
            signatureImageBytes = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
          }
        } else if (hostSignature.startsWith('http')) {
          const response = await fetch(hostSignature);
          if (!response.ok) {
            throw new Error(`HTTP error: ${response.status}`);
          }
          signatureImageBytes = new Uint8Array(await response.arrayBuffer());
        }
        
        if (signatureImageBytes && signatureImageBytes.length > 0) {
          let signatureImage;
          try {
            signatureImage = await pdfDoc.embedPng(signatureImageBytes);
            log('info', '[Police] Signature PNG embedée avec succès');
          } catch (pngError) {
            try {
              signatureImage = await pdfDoc.embedJpg(signatureImageBytes);
              log('info', '[Police] Signature JPG embedée avec succès');
            } catch (jpgError) {
              log('error', '[Police] Échec embedding signature (PNG et JPG)', {
                pngError: String(pngError),
                jpgError: String(jpgError)
              });
              throw new Error('Format de signature non supporté');
            }
          }
          
          // ✅ CORRIGÉ : Dimensions limitées pour éviter le débordement sur mobile et web
          // Calculer la largeur disponible (pageWidth - 2*margin)
          const availableWidth = pageWidth - (margin * 2);
          // Limiter maxWidth à 80% de la largeur disponible pour laisser de la marge
          const maxWidth = Math.min(180, availableWidth * 0.8); // Réduit de 250 à 180 max
          const maxHeight = 60;  // Réduit de 80 à 60 pour éviter le débordement vertical
          
          const scale = Math.min(
            maxWidth / signatureImage.width,
            maxHeight / signatureImage.height,
            1.0 // ✅ Ne jamais agrandir la signature au-delà de sa taille originale
          );
          const width = signatureImage.width * scale;
          const height = signatureImage.height * scale;
          
          // ✅ NOUVEAU : Vérifier que la signature ne déborde pas à droite
          const signatureX = margin;
          const signatureRightEdge = signatureX + width;
          const maxRightEdge = pageWidth - margin;
          
          // Si la signature déborde, réduire encore la taille
          let finalWidth = width;
          let finalHeight = height;
          if (signatureRightEdge > maxRightEdge) {
            const overflow = signatureRightEdge - maxRightEdge;
            const reductionFactor = (width - overflow) / width;
            finalWidth = width * reductionFactor;
            finalHeight = height * reductionFactor;
            log('warn', '[Police] Signature débordait, dimensions réduites:', {
              originalWidth: width,
              originalHeight: height,
              finalWidth,
              finalHeight,
              overflow
            });
          }
          
          log('info', '[Police] Dimensions signature:', {
            pageWidth,
            margin,
            availableWidth,
            originalWidth: signatureImage.width,
            originalHeight: signatureImage.height,
            scaledWidth: finalWidth,
            scaledHeight: finalHeight,
            scale: scale,
            signatureX,
            signatureRightEdge: signatureX + finalWidth,
            maxRightEdge
          });
          
          page.drawImage(signatureImage, {
            x: signatureX,
            y: yPosition - finalHeight,
            width: finalWidth,
            height: finalHeight
          });
          
          log('info', '✅ Host signature embedded in police form successfully', {
            x: margin,
            y: yPosition - height,
            width,
            height
          });
          yPosition -= height + 10;
        } else {
          log('warn', '[Police] Signature bytes vides ou invalides');
        }
      } catch (signatureError: any) {
        log('warn', '⚠️ Failed to embed host signature in police form (will continue without):', {
          error: String(signatureError),
          message: signatureError?.message,
          stack: signatureError?.stack
        });
        // Continue sans la signature
      }
    } else {
      // ✅ CORRIGÉ : Fallback - afficher le nom du loueur en texte (comme dans le contrat)
      const landlordName = contractTemplate.landlord_name || 
                           property.contact_info?.ownerName || 
                           property.owner_name ||
                           booking.host?.name ||
                           '';
      
      if (landlordName) {
        log('info', '[Police] Utilisation du nom comme signature fallback:', { landlordName });
        
        // Dessiner le nom en italique/cursive
        page.drawText(landlordName, {
          x: margin,
          y: yPosition - 20,
          size: fontSize + 2,
          font: font
        });
        
        // Ajouter mention "signature électronique" si signature SVG
        if (hostSignature && hostSignature.startsWith('data:image/svg')) {
          page.drawText("(signature électronique)", {
            x: margin,
            y: yPosition - 35,
            size: fontSize - 1,
            font: font
          });
        }
        
        yPosition -= 50;
      } else {
        log('warn', '[Police] No host signature or name available for police form', {
        hasHostSignature: !!hostSignature,
        signatureType: hostSignature ? typeof hostSignature : 'none',
          signatureValue: hostSignature ? hostSignature.substring(0, 100) : 'none',
          hasLandlordName: !!landlordName
      });
      }
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