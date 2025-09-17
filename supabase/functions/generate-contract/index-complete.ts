import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

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

    const { bookingId, signatureData, signedAt, action = 'generate' } = requestData;

    // ✅ VALIDATION STANDARDISÉE
    try {
      validateRequiredFields(requestData, ['bookingId']);
      validateBookingId(bookingId);
      if (action) {
        validateAction(action, ['generate', 'sign', 'regenerate']);
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
    const booking = await fetchBookingFromDatabase(client, bookingId);
    
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
        result = await generateContract(client, booking);
        break;
      case 'sign':
        result = await signContract(client, booking, signatureData, signedAt);
        break;
      case 'regenerate':
        result = await regenerateContract(client, booking, signatureData, signedAt);
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
  
  const { data: dbBooking, error: bookingError } = await client
    .from('bookings')
    .select(`
      *,
      property:properties(*),
      guests(*)
    `)
    .eq('id', bookingId)
    .single();

  console.log('🔍 Booking query result:', { dbBooking, bookingError });

  if (bookingError) {
    console.error('❌ Booking query error:', bookingError);
    throw new Error(`Booking query failed: ${bookingError.message}`);
  }

  if (!dbBooking) {
    console.error('❌ No booking found for ID:', bookingId);
    throw new Error('Booking not found');
  }

  console.log('✅ Booking found:', {
    id: dbBooking.id,
    property: dbBooking.property?.name
  });

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
async function generateContract(client: any, booking: any) {
  console.log('📄 Generating contract...');
  const documentUrl = await generateContractPDF(booking, null, null);
  
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
async function signContract(client: any, booking: any, signatureData: any, signedAt: any) {
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
  const signedDocumentUrl = await generateContractPDF(booking, guestSignatureUrl, signedAt || signerInfo?.signed_at);
  
  // Update document in database
  const { data: updatedDoc, error: updateError } = await client
    .from('generated_documents')
    .update({
      document_url: signedDocumentUrl,
      is_signed: true,
      signature_data: guestSignatureUrl,
      signed_at: signedAt || signerInfo?.signed_at || new Date().toISOString(),
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
async function regenerateContract(client: any, booking: any, signatureData: any, signedAt: any) {
  console.log('🔄 Regenerating contract...');
  const documentUrl = await generateContractPDF(booking, signatureData, signedAt);
  
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
    const { data: updatedDoc, error: updateError } = await client
      .from('generated_documents')
      .update({
        document_url: documentUrl,
        is_signed: !!signatureData,
        signature_data: signatureData || null,
        signed_at: signedAt || (signatureData ? new Date().toISOString() : null),
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
  
  const { data: documentRecord, error } = await client
    .from('generated_documents')
    .insert({
      booking_id: bookingId,
      document_type: documentType,
      file_name: fileName,
      document_url: documentUrl,
      is_signed: isSigned,
      signature_data: signatureData || null,
      signed_at: signedAt || (isSigned ? new Date().toISOString() : null),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
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

// Generate contract PDF (simplified version for now)
async function generateContractPDF(booking: any, signatureData?: any, signedAt?: any) {
  console.log('📄 Creating contract PDF...');
  
  // For now, return a simple text-based contract
  // You can implement the full PDF generation logic here later
  const contractContent = `
CONTRAT DE LOCATION SAISONNIÈRE

Propriété: ${booking.property?.name || 'Non spécifiée'}
Adresse: ${booking.property?.address || 'Non spécifiée'}

Locataires:
${booking.guests?.map((g: any) => `- ${g.full_name} (${g.nationality}, ${g.document_type}: ${g.document_number})`).join('\n') || 'Aucun invité'}

Période de location:
- Arrivée: ${booking.check_in_date || 'Non spécifiée'}
- Départ: ${booking.check_out_date || 'Non spécifiée'}
- Durée: ${calculateDuration(booking.check_in_date, booking.check_out_date)}
- Nombre d'occupants: ${booking.guests?.length || booking.number_of_guests || 1} personne(s)

Conditions générales:
1. Le locataire s'engage à respecter les règles de la propriété
2. Aucun animal n'est autorisé sans accord préalable
3. Le locataire est responsable des dommages causés
4. Le paiement doit être effectué avant l'arrivée

Date: ${new Date().toLocaleDateString('fr-FR')}
  `.trim();

  // Convert to base64 for now (you can implement proper PDF generation later)
  const base64 = btoa(contractContent);
  return `data:text/plain;base64,${base64}`;
}
