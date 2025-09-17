import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { PDFDocument, StandardFonts, rgb } from "https://esm.sh/pdf-lib@1.17.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

// Fonction pour créer le client Supabase
async function getServerClient() {
  const url = Deno.env.get('SUPABASE_URL');
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!url || !key) {
    throw new Error('Missing Supabase credentials');
  }

  return createClient(url, key, { auth: { persistSession: false } });
}

// ✅ FONCTIONS MANQUANTES AJOUTÉES
function validateRequiredFields(data: any, fields: string[]) {
  for (const field of fields) {
    if (!data[field]) {
      throw new Error(`Missing required field: ${field}`);
    }
  }
}

function validateBookingId(bookingId: string) {
  if (!bookingId || typeof bookingId !== 'string') {
    throw new Error('Invalid bookingId');
  }
}

function validateAction(action: string, validActions: string[]) {
  if (!validActions.includes(action)) {
    throw new Error(`Invalid action. Must be one of: ${validActions.join(', ')}`);
  }
}

// ✅ CODES D'ERREUR DÉFINIS
const ERROR_CODES = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  BOOKING_NOT_FOUND: 'BOOKING_NOT_FOUND',
  PROPERTY_NOT_FOUND: 'PROPERTY_NOT_FOUND',
  CONTRACT_GENERATION_ERROR: 'CONTRACT_GENERATION_ERROR',
  SIGNATURE_ERROR: 'SIGNATURE_ERROR',
  DATABASE_ERROR: 'DATABASE_ERROR'
};

// ✅ FONCTION DE GESTION D'ERREUR
function handleEdgeFunctionError(error: any) {
  console.error('❌ Edge Function Error:', error);
  
  return {
    success: false,
    error: {
      message: error.message || 'Unknown error',
      code: error.code || 'UNKNOWN_ERROR',
      details: error.details || null
    },
    timestamp: new Date().toISOString()
  };
}

// Fonctions utilitaires intégrées
function createContractResponse(documentUrl: string, options: any = {}) {
  return {
    success: true,
    documentUrl,
    documentId: options.documentId,
    signed: options.signed || false,
    signedAt: options.signedAt,
    signerName: options.signerName
  };
}

function createErrorResponse(message: string, details?: any) {
  return {
    success: false,
    error: {
      message,
      details
    }
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: corsHeaders
    });
  }

  try {
    console.log('🚀 generate-contract function started');
    
    if (req.method !== 'POST') {
      return new Response(JSON.stringify({
        success: false,
        message: 'Method Not Allowed'
      }), {
        status: 405,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }

    const client = await getServerClient();
    const requestData = await req.json();
    console.log('📥 Request data:', requestData);

    const { bookingId, signatureData, signedAt, action = 'generate', hostSignatureData, hostSignerName } = requestData;

    // ✅ VALIDATION STANDARDISÉE
    try {
      validateRequiredFields(requestData, ['bookingId']);
      validateBookingId(bookingId);
      if (action) {
        validateAction(action, ['generate', 'sign', 'regenerate']);
      }
      
      // Validation des nouveaux champs optionnels
      if (hostSignatureData && typeof hostSignatureData !== 'string') {
        throw new Error('hostSignatureData must be a base64 data URL string');
      }
      if (hostSignerName && typeof hostSignerName !== 'string') {
        throw new Error('hostSignerName must be a string');
      }
    } catch (validationError) {
      console.error('❌ Validation error:', validationError);
      const errorResponse = createErrorResponse(validationError.message, validationError);
      return new Response(JSON.stringify(errorResponse), {
        status: 400,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }

    // Fetch booking data
    let booking;
    try {
      booking = await fetchBookingFromDatabase(client, bookingId);
    } catch (error) {
      console.error('❌ Error fetching booking:', error.message);
      return new Response(JSON.stringify({
        success: false,
        message: error.message.includes('not found') ? 
          `Booking not found for ID: ${bookingId}` : 
          'Error fetching booking data'
      }), {
        status: 404,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
    
    if (!booking.property) {
      return new Response(JSON.stringify({
        success: false,
        message: 'Property not found for booking'
      }), {
        status: 404,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }

    let result;
    switch(action) {
      case 'generate':
        result = await generateContract(client, booking, { hostSignatureData, hostSignerName });
        break;
      case 'sign':
        result = await signContract(client, booking, signatureData, signedAt, { hostSignatureData, hostSignerName });
        break;
      case 'regenerate':
        result = await regenerateContract(client, booking, signatureData, signedAt, { hostSignatureData, hostSignerName });
        break;
      default:
        return new Response(JSON.stringify({
          success: false,
          message: 'Invalid action. Must be: generate, sign, or regenerate'
        }), {
          status: 400,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json'
          }
        });
    }

    // ✅ RÉPONSE STANDARDISÉE avec rétrocompatibilité complète
    const standardResponse = createContractResponse(result.documentUrl, {
      documentId: result.documentId,
      signed: result.signed || false,
      signedAt: result.signedAt,
      signerName: result.signerName
    });

    // Ajouter les champs personnalisés pour rétrocompatibilité
    standardResponse.message = result.message;
    standardResponse.documentUrls = result.documentUrl ? [result.documentUrl] : [];
    standardResponse.documents = result.documentUrl ? [{
      url: result.documentUrl,
      type: 'contract'
    }] : [];

    return new Response(JSON.stringify(standardResponse), {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });

  } catch (error) {
    console.error('❌ Error in generate-contract:', error);
    const errorResponse = handleEdgeFunctionError(error);
    return new Response(JSON.stringify(errorResponse), {
      status: 500,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  }
});

// Fetch booking from database with enriched guest data
async function fetchBookingFromDatabase(client: any, bookingId: string) {
  console.log('🔍 Fetching booking from database:', bookingId);
  
  // ✅ CORRECTION : Utiliser .maybeSingle() au lieu de .single() pour gérer les cas où il n'y a pas de résultat
  const { data: dbBooking, error: bookingError } = await client
    .from('bookings')
    .select(`
      *,
      property:properties(*),
      guests(*)
    `)
    .eq('id', bookingId)
    .maybeSingle();

  console.log('🔍 Booking query result:', { dbBooking, bookingError });

  if (bookingError) {
    console.error('❌ Booking query error:', bookingError);
    throw new Error(`Booking query failed: ${bookingError.message}`);
  }

  if (!dbBooking) {
    console.error('❌ No booking found for ID:', bookingId);
    throw new Error(`Booking not found for ID: ${bookingId}`);
  }

  console.log('✅ Booking found:', {
    id: dbBooking.id,
    property: dbBooking.property?.name
  });

  // Récupérer le profil hôte via property.user_id
  if (dbBooking.property?.user_id) {
    const { data: hostProfile, error: hostErr } = await client
      .from('host_profiles')
      .select('full_name, phone')
      .eq('id', dbBooking.property.user_id)
      .maybeSingle();

    if (!hostErr && hostProfile) {
      dbBooking.host = { 
        full_name: hostProfile.full_name || null, 
        phone: hostProfile.phone || null 
      };
      console.log('✅ Host profile loaded:', { name: hostProfile.full_name, phone: hostProfile.phone });
    } else if (hostErr) {
      console.warn('⚠️ Could not load host profile:', hostErr);
    }
  }

  // ✅ CORRECTION : Récupérer les données d'invités depuis la table guests (source principale)
  try {
    console.log('🔍 Récupération des données d\'invités depuis la table guests...');
    
    // Récupérer depuis la table guests (source principale des données)
    const { data: guestsData, error: guestsError } = await client
      .from('guests')
      .select('*')
      .eq('booking_id', bookingId)
      .order('created_at', { ascending: true });

    if (guestsError) {
      console.error('❌ Erreur lors de la récupération des invités:', guestsError);
    } else if (guestsData && guestsData.length > 0) {
      console.log('📋 Données d\'invités trouvées dans la table guests:', guestsData);
      
      const realGuests = [];
      for (const guest of guestsData) {
        console.log('👤 Traitement de l\'invité depuis la table guests:', guest);
        
        // Extraction complète des données client depuis la table guests
        const guestName = guest.full_name || '';
        const documentNumber = guest.document_number || '';
        const nationality = guest.nationality || '';
        const documentType = guest.document_type || 'passport';
        const dateOfBirth = guest.date_of_birth || '';
        const placeOfBirth = guest.place_of_birth || '';

        console.log('🔍 Processing guest data from guests table:', {
          fullName: guestName,
          documentNumber: documentNumber,
          nationality: nationality,
          documentType: documentType,
          dateOfBirth: dateOfBirth,
          placeOfBirth: placeOfBirth
        });

        if (guestName.trim()) {
          realGuests.push({
            full_name: guestName.trim(),
            date_of_birth: dateOfBirth,
            document_number: documentNumber.trim(),
            nationality: nationality || 'Non spécifiée',
            document_type: documentType,
            place_of_birth: placeOfBirth
          });
          
          console.log('✅ Guest added to contract from guests table:', {
            name: guestName.trim(),
            documentNumber: documentNumber.trim(),
            nationality: nationality || 'Non spécifiée',
            documentType: documentType
          });
        }
      }

      if (realGuests.length > 0) {
        dbBooking.guests = realGuests;
        console.log(`✅ ${realGuests.length} invités récupérés depuis la table guests`);
      }
    } else {
      console.log('⚠️ Aucun invité trouvé dans la table guests, utilisation des données de base');
    }
  } catch (enrichError) {
    console.error('❌ Error enriching with guest data from guests table:', enrichError);
    // Ne pas faire échouer la fonction, continuer avec les données de base
  }

  // ✅ CORRECTION : Vérifier et corriger les données des invités si nécessaire
  if (!dbBooking.guests || dbBooking.guests.length === 0) {
    console.log('⚠️ Aucun invité trouvé, tentative de récupération depuis guest_submissions...');
    
    try {
      const { data: submissions } = await client
        .from('guest_submissions')
        .select('guest_data')
        .eq('booking_id', bookingId)
        .order('created_at', { ascending: false })
        .limit(1);

      if (submissions && submissions.length > 0) {
        const submission = submissions[0];
        if (submission.guest_data?.guests) {
          const fallbackGuests = [];
          for (const guest of submission.guest_data.guests) {
            const guestName = guest.fullName || guest.full_name || '';
            const documentNumber = guest.documentNumber || guest.document_number || '';
            
            if (guestName.trim() && documentNumber.trim()) {
              fallbackGuests.push({
                full_name: guestName.trim(),
                date_of_birth: guest.dateOfBirth || guest.date_of_birth || '',
                document_number: documentNumber.trim(),
                nationality: guest.nationality || 'Non spécifiée',
                document_type: guest.documentType || guest.document_type || 'passport',
                place_of_birth: guest.placeOfBirth || guest.place_of_birth || ''
              });
            }
          }
          
          if (fallbackGuests.length > 0) {
            dbBooking.guests = fallbackGuests;
            console.log(`✅ ${fallbackGuests.length} invités récupérés depuis guest_submissions (fallback)`);
          }
        }
      }
    } catch (fallbackError) {
      console.error('❌ Error in fallback guest data retrieval:', fallbackError);
    }
  }

  return dbBooking;
}

// Generate new contract
async function generateContract(client: any, booking: any, signOptions: any = {}) {
  console.log('📄 Generating contract...');
  const documentUrl = await generateContractPDF(booking, signOptions);
  
  // Save to database
  const documentRecord = await saveDocumentToDatabase(client, booking.id, 'contract', documentUrl, false);
  
  return {
    documentUrl,
    documentId: documentRecord.id,
    message: 'Contract generated successfully',
    signed: false
  };
}

// Sign existing contract
async function signContract(client: any, booking: any, signatureData: any, signedAt: any, signOptions: any = {}) {
  console.log('🖊️ Signing contract...');
  
  // Fetch guest signature if not provided
  let guestSignatureUrl = signatureData;
  let signerInfo = null;
  
  if (!signatureData && booking.id) {
    try {
      const { data: sig } = await client
        .from('contract_signatures')
        .select('signature_data, signer_name, signed_at, created_at')
        .eq('booking_id', booking.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      
      if (sig) {
        guestSignatureUrl = sig.signature_data;
        signerInfo = sig;
      }
    } catch (error) {
      console.error('❌ Failed to fetch guest signature:', error);
    }
  }

  if (!guestSignatureUrl) {
    throw new Error('Signature data is required for signing');
  }

  // Get existing document
  const { data: existingDoc, error } = await client
    .from('generated_documents')
    .select('*')
    .eq('booking_id', booking.id)
    .eq('document_type', 'contract')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !existingDoc) {
    throw new Error('No existing contract found to sign');
  }

  // Generate signed version
  const signedDocumentUrl = await generateContractPDF(booking, {
    guestSignatureData: guestSignatureUrl,
    guestSignedAt: signedAt || signerInfo?.signed_at,
    hostSignatureData: signOptions.hostSignatureData,
    hostSignerName: signOptions.hostSignerName
  });
  
  // ✅ CORRECTION : Sauvegarder la signature dans contract_signatures
  let signatureId = null;
  try {
    const { data: signatureRecord, error: signatureError } = await client
      .from('contract_signatures')
      .insert({
        booking_id: booking.id,
        signature_data: guestSignatureUrl,
        signed_at: signedAt || signerInfo?.signed_at || new Date().toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select()
      .single();

    if (signatureError) {
      console.error('❌ Failed to save signature:', signatureError);
    } else {
      signatureId = signatureRecord.id;
    }
  } catch (signatureError) {
    console.error('❌ Error saving signature:', signatureError);
  }

  // Sauvegarder la signature hôte si fournie (depuis body OU property)
  const effectiveHostSignature = signOptions.hostSignatureData || booking.property?.contract_template?.landlord_signature || null;
  if (effectiveHostSignature) {
    try {
      const bailleurName = signOptions.hostSignerName 
        || booking.host?.full_name
        || booking.property?.contact_info?.name
        || 'Proprietaire';
        
      const { data: hostSignatureRecord, error: hostSignatureError } = await client
        .from('contract_signatures')
        .insert({
          booking_id: booking.id,
          signature_data: effectiveHostSignature,
          signer_name: bailleurName,
          signed_at: new Date().toISOString(),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select()
        .single();
      
      if (hostSignatureError) {
        console.error('❌ Failed to save host signature:', hostSignatureError);
      } else {
        console.log('✅ Host signature saved successfully');
      }
    } catch (hostSignatureError) {
      console.error('❌ Error saving host signature:', hostSignatureError);
    }
  }

  // Update document in database (seulement les colonnes qui existent)
  const { data: updatedDoc, error: updateError } = await client
    .from('generated_documents')
    .update({
      document_url: signedDocumentUrl,
      is_signed: true,
      signature_id: signatureId,
      updated_at: new Date().toISOString()
    })
    .eq('id', existingDoc.id)
    .select()
    .single();

  if (updateError) {
    throw new Error(`Failed to update signed contract: ${updateError.message}`);
  }

  return {
    documentUrl: signedDocumentUrl,
    documentId: updatedDoc.id,
    message: 'Contract signed successfully',
    signed: true
  };
}

// Regenerate contract
async function regenerateContract(client: any, booking: any, signatureData: any, signedAt: any, signOptions: any = {}) {
  console.log('🔄 Regenerating contract...');
  const documentUrl = await generateContractPDF(booking, {
    guestSignatureData: signatureData,
    guestSignedAt: signedAt,
    hostSignatureData: signOptions.hostSignatureData,
    hostSignerName: signOptions.hostSignerName
  });
  
  // Update or create document
  const { data: existingDoc } = await client
    .from('generated_documents')
    .select('*')
    .eq('booking_id', booking.id)
    .eq('document_type', 'contract')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  let documentId;
  if (existingDoc) {
    // ✅ CORRECTION : Sauvegarder la signature si nécessaire
    let signatureId = null;
    if (signatureData) {
      try {
        const { data: signatureRecord, error: signatureError } = await client
          .from('contract_signatures')
          .insert({
            booking_id: booking.id,
            signature_data: signatureData,
            signed_at: signedAt || new Date().toISOString(),
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .select()
          .single();

        if (signatureError) {
          console.error('❌ Failed to save signature:', signatureError);
        } else {
          signatureId = signatureRecord.id;
        }
      } catch (signatureError) {
        console.error('❌ Error saving signature:', signatureError);
      }
    }

    const { data: updatedDoc, error: updateError } = await client
      .from('generated_documents')
      .update({
        document_url: documentUrl,
        is_signed: !!signatureData,
        signature_id: signatureId,
        updated_at: new Date().toISOString()
      })
      .eq('id', existingDoc.id)
      .select()
      .single();

    if (updateError) {
      throw new Error(`Failed to update contract: ${updateError.message}`);
    }
    documentId = updatedDoc.id;
  } else {
    const documentRecord = await saveDocumentToDatabase(client, booking.id, 'contract', documentUrl, !!signatureData, signatureData, signedAt);
    documentId = documentRecord.id;
  }

  return {
    documentUrl,
    documentId,
    message: 'Contract regenerated successfully',
    signed: !!signatureData
  };
}

// Save document to database
async function saveDocumentToDatabase(client: any, bookingId: string, documentType: string, documentUrl: string, isSigned: boolean = false, signatureData?: any, signedAt?: any) {
  const fileName = `${documentType}-${bookingId}-${Date.now()}.pdf`;
  
  // ✅ CORRECTION : Utiliser seulement les colonnes qui existent dans generated_documents
  const documentData: any = {
    booking_id: bookingId,
    document_type: documentType,
    file_name: fileName,
    document_url: documentUrl,
    is_signed: isSigned,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  // Si on a des données de signature, les sauvegarder dans contract_signatures
  let signatureId = null;
  if (signatureData && isSigned) {
    try {
      const { data: signatureRecord, error: signatureError } = await client
        .from('contract_signatures')
        .insert({
          booking_id: bookingId,
          signature_data: signatureData,
          signed_at: signedAt || new Date().toISOString(),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select()
        .single();

      if (signatureError) {
        console.error('❌ Failed to save signature:', signatureError);
      } else {
        signatureId = signatureRecord.id;
        documentData.signature_id = signatureId;
      }
    } catch (signatureError) {
      console.error('❌ Error saving signature:', signatureError);
    }
  }

  const { data: documentRecord, error } = await client
    .from('generated_documents')
    .insert(documentData)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to save document to database: ${error.message}`);
  }

  return documentRecord;
}

// Helper function to calculate duration between dates
function calculateDuration(checkInDate: string, checkOutDate: string) {
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

// Types pour les options de signature
type SignOptions = {
  guestSignatureData?: string | null;
  guestSignedAt?: string | null;
  hostSignatureData?: string | null;
  hostSignerName?: string | null;
};

// Generate contract PDF avec pdf-lib pour un rendu fiable
async function generateContractPDF(booking: any, signOpts: SignOptions = {}) {
  console.log('📄 Creating contract PDF with pdf-lib...');
  
  const { guestSignatureData, guestSignedAt, hostSignatureData, hostSignerName } = signOpts;
  const guest = booking.guests?.[0] || {};
  const property = booking.property || {};
  
  // Déterminer le nom de l'hôte avec priorité
  const bailleurName = (hostSignerName 
    || booking.host?.full_name 
    || property.contact_info?.name 
    || 'Proprietaire').toString();
  const locataireName = (guest.full_name || 'Locataire').toString();

  // ⚠️ nouvelle source signature bailleur si non fournie par body
  const landlordSigFromProperty = booking.property?.contract_template?.landlord_signature || null;
  const effectiveHostSignature = hostSignatureData || landlordSigFromProperty || null;
  
  console.log('🔍 Guest data:', { name: guest.full_name, nationality: guest.nationality, document: guest.document_number });
  console.log('🔍 Property data:', { name: property.contact_info?.name, address: property.address, city: property.city });
  console.log('🔍 Host data:', { name: bailleurName, hostProfile: booking.host?.full_name });
  console.log('🔍 Signature options:', { 
    hasGuestSignature: !!guestSignatureData, 
    hasHostSignature: !!hostSignatureData,
    hasEffectiveHostSignature: !!effectiveHostSignature,
    hostSignerName: hostSignerName,
    landlordSigFromProperty: !!landlordSigFromProperty
  });
  
  const contractContent = `
CONTRAT DE LOCATION SAISONNIERE (COURTE DUREE)

Entre les soussignes :

LE BAILLEUR (PROPRIETAIRE/HOST)
Nom et prenom : ${bailleurName}
Adresse : ${property.address || 'Non specifiee'}

ET

LE LOCATAIRE (VOYAGEUR/GUEST)
Nom et prenom : ${guest.full_name || 'Non specifie'}
Nationalite : ${guest.nationality || 'Non specifiee'}
N° de piece d'identite (CIN ou passeport) : ${guest.document_number || 'Non specifie'}

Denommes ensemble "les Parties".

ARTICLE 1 - OBJET DU CONTRAT
Le present contrat a pour objet la location saisonniere, meublee et equipee, du bien ci-apres designe, a usage exclusif d'habitation.

ARTICLE 2 - DESIGNATION DU BIEN
Adresse du bien loue : ${property.address || 'Non specifiee'}
Type du bien : ${property.property_type || 'Non specifie'}
Capacite maximale : ${property.max_guests || 'Non specifiee'} personnes

ARTICLE 3 - DUREE DE LA LOCATION
La location est conclue pour la periode suivante :
- Date d'arrivee : ${booking.check_in_date || 'Non specifiee'}
- Date de depart : ${booking.check_out_date || 'Non specifiee'}
Le locataire s'engage a quitter les lieux a la date et l'heure convenues.

ARTICLE 4 - PRIX ET PAIEMENT
Le prix du sejour est celui convenu via la plateforme de reservation en ligne utilisee par les Parties.
Le paiement du loyer est effectue exclusivement en ligne via ladite plateforme.

ARTICLE 5 - ETAT DU LOGEMENT
Le logement est remis au Locataire en bon etat, meuble et equipe.
Un etat des lieux peut etre etabli a l'arrivee et au depart.
Le Locataire s'engage a restituer le logement dans l'etat initial.

ARTICLE 6 - OBLIGATIONS DU LOCATAIRE
Le Locataire s'engage a :
- Utiliser le logement uniquement pour l'habitation
- Respecter la capacite maximale d'accueil
- Ne pas organiser de fetes, evenements ou activites commerciales
- Respecter la tranquillite du voisinage
- Ne pas sous-louer ni ceder le contrat
- Ne pas fumer a l'interieur du logement
- Respecter les regles de la maison

ARTICLE 7 - OBLIGATIONS DU BAILLEUR
Le Bailleur s'engage a :
- Fournir un logement propre, en bon etat et conforme a la description
- Garantir au Locataire la jouissance paisible du bien loue

ARTICLE 8 - RESPONSABILITE
Le Locataire est responsable des dommages ou pertes causes durant son sejour.
Le Bailleur decline toute responsabilite en cas de vol ou perte d'effets personnels.

ARTICLE 9 - RESILIATION
En cas de manquement grave aux obligations du present contrat, le Bailleur pourra resilier la location de plein droit, sans indemnite pour le Locataire.

ARTICLE 10 - LOI APPLICABLE
Le present contrat est soumis au droit marocain.
En cas de litige, competence exclusive est donnee aux tribunaux du ressort ou se situe le bien.

Fait a ${property.city || 'Casablanca'}, le ${new Date().toLocaleDateString('fr-FR')}

SIGNATURES
`.trim();

  // --- Mise en page
  const pageWidth = 612, pageHeight = 792;
  const margin = 50;
  const maxWidth = pageWidth - margin * 2;
  const titleSize = 16, sectionSize = 12, bodySize = 11, footerSize = 9;
  const lineGap = 14;

  const pdfDoc = await PDFDocument.create();
  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  let pages: any[] = [];
  let currentPage = addPage();
  let y = pageHeight - margin;

  function addPage() {
    const p = pdfDoc.addPage([pageWidth, pageHeight]);
    pages.push(p);
    return p;
  }

  function ensureSpace(h: number) {
    if (y - h < margin) {
      currentPage = addPage();
      y = pageHeight - margin;
    }
  }

  function drawLine(x1: number, y1: number, x2: number, y2: number) {
    currentPage.drawLine({ start: { x: x1, y: y1 }, end: { x: x2, y: y2 }, color: rgb(0,0,0), thickness: 0.5 });
  }

  function drawText(text: string, x: number, size: number, font = fontRegular) {
    const height = size;
    ensureSpace(height + 2);
    currentPage.drawText(text, { x, y, size, font });
    y -= lineGap;
  }

  function wrapText(text: string, width: number, size: number, font = fontRegular) {
    const words = text.split(/\s+/);
    const lines: string[] = [];
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

  function drawParagraph(text: string, size = bodySize, bold = false) {
    const font = bold ? fontBold : fontRegular;
    const lines = wrapText(text, maxWidth, size, font);
    for (const l of lines) {
      ensureSpace(size + 2);
      currentPage.drawText(l, { x: margin, y, size, font });
      y -= lineGap;
    }
  }

  function drawSectionTitle(text: string) {
    ensureSpace(sectionSize + 6);
    currentPage.drawText(text, { x: margin, y, size: sectionSize, font: fontBold });
    y -= lineGap;
  }

  function drawFooter() {
    // appelé après avoir ajouté toutes les pages
    const total = pages.length;
    pages.forEach((p, i) => {
      p.drawText(`Page ${i+1}/${total}`, { x: pageWidth - margin - 60, y: margin - 20, size: footerSize, font: fontRegular });
    });
  }

  // Helper robuste pour convertir une dataURL en image pdf-lib
  async function embedDataUrlImage(pdfDoc: any, dataUrlOrBase64: string) {
    if (!dataUrlOrBase64) return null;
    const clean = dataUrlOrBase64.replace(/^data:image\/[^;]+;base64,/, '');
    const bin = Uint8Array.from(atob(clean), c => c.charCodeAt(0));
    try {
      return await pdfDoc.embedPng(bin);
    } catch {
      return await pdfDoc.embedJpg(bin);
    }
  }

  // Fonction pour dessiner une image de signature
  async function tryDrawSignatureImage(dataUrl: string, xLeft: number, yTop: number, maxWidth = 180, maxHeight = 100) {
    try {
      const img = await embedDataUrlImage(pdfDoc, dataUrl);
      if (!img) return 0;

      // ratio
      const aspect = img.width / img.height;
      let w = Math.min(maxWidth, img.width);
      let h = w / aspect;
      if (h > maxHeight) { h = maxHeight; w = h * aspect; }

      currentPage.drawImage(img, { x: xLeft, y: yTop - h, width: w, height: h });
      return h + 6; // hauteur utilisée + marge
    } catch (e) {
      console.warn('Host signature embed failed', e);
      return 0;
    }
  }

  async function drawSignaturesArea() {
    const colGap = 50;
    const colW = (maxWidth - colGap) / 2;
    const col1 = margin;
    const col2 = margin + colW + colGap;

    drawSectionTitle('SIGNATURES');

    ensureSpace(40);
    currentPage.drawText('Le Bailleur :', { x: col1, y, size: bodySize, font: fontBold });
    currentPage.drawText('Le Locataire :', { x: col2, y, size: bodySize, font: fontBold });
    y -= 16;

    const lineY = y - 6;

    // --- Signature bailleur à gauche (dataURL depuis body OU property.contract_template.landlord_signature)
    let usedHLeft = 0;
    if (effectiveHostSignature) {
      console.log("✍️ BailleurName rendu:", bailleurName);
      usedHLeft = await tryDrawSignatureImage(effectiveHostSignature, col1, lineY + 22, 180, 100);
    }

    // --- Signature locataire à droite
    let usedHRight = 0;
    if (guestSignatureData) {
      usedHRight = await tryDrawSignatureImage(guestSignatureData, col2, lineY + 22, 180, 100);
    }

    // si une image "mange" de l'espace au-dessus, poussons y
    const extraTop = Math.max(usedHLeft, usedHRight);
    if (extraTop > 0) {
      ensureSpace(extraTop);
      y -= extraTop;
    }

    // Lignes de signature
    drawLine(col1, lineY, col1 + colW, lineY);
    drawLine(col2, lineY, col2 + colW, lineY);
    y = lineY - 18;

    // Noms
    currentPage.drawText(bailleurName || 'Proprietaire', { x: col1, y, size: bodySize, font: fontRegular });
    currentPage.drawText(locataireName || 'Locataire', { x: col2, y, size: bodySize, font: fontRegular });
    y -= lineGap;

    // Dates
    currentPage.drawText('Date : _______________', { x: col1, y, size: bodySize, font: fontRegular });
    currentPage.drawText('Date : _______________', { x: col2, y, size: bodySize, font: fontRegular });
    y -= lineGap;

    // Mentions électroniques
    if (guestSignatureData) {
      drawParagraph(`Signature électronique locataire intégrée — Validée le ${guestSignedAt ? new Date(guestSignedAt).toLocaleDateString('fr-FR') : new Date().toLocaleDateString('fr-FR')}`, 10);
    }
    if (effectiveHostSignature) {
      drawParagraph(`Signature électronique bailleur intégrée — Validée le ${new Date().toLocaleDateString('fr-FR')}`, 10);
    }
  }

  // ---------- DESSIN ----------
  // Titre
  drawText("CONTRAT DE LOCATION SAISONNIERE (COURTE DUREE)", margin, titleSize, fontBold);
  // Filet
  ensureSpace(8);
  drawLine(margin, y, pageWidth - margin, y);
  y -= 10;

  // Découper le contenu en lignes et gérer quelques sections
  const blocks = contractContent.split("\n").map(s => s.trim());
  let pendingSignatures = false;

  for (let i = 0; i < blocks.length; i++) {
    const line = blocks[i];
    if (!line) { y -= 6; continue; }

    if (line.startsWith("ARTICLE ")) {
      drawSectionTitle(line);
    } else if (line === 'SIGNATURES') {
      await drawSignaturesArea();
      // ignorer tout le reste potentiellement résiduel
      pendingSignatures = true;
    } else if (pendingSignatures) {
      // ignorer encore tout bloc signature résiduel potentiellement présent
      continue;
    } else if (/^LE BAILLEUR|^LE LOCATAIRE|^Entre les soussignes|^ET$|^Denommes ensemble/.test(line)) {
      drawParagraph(line);
    } else {
      // Corps standard
      drawParagraph(line);
    }
  }

  // Pieds de page sur toutes les pages
  drawFooter();

  const pdfBytes = await pdfDoc.save();
  const base64 = btoa(String.fromCharCode(...new Uint8Array(pdfBytes)));
  
  console.log('✅ Contract PDF created successfully with pdf-lib');
  console.log('📄 PDF size:', pdfBytes.length, 'bytes');
  console.log('📄 Base64 length:', base64.length);
  
  return `data:application/pdf;base64,${base64}`;
}

// ✅ FONCTION PDF-LIB POUR UN RENDU FIABLE
