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

// Types
interface Guest {
  full_name: string;
  date_of_birth: string;
  document_number: string;
  nationality: string;
  document_type: string;
  place_of_birth?: string;
}

interface Property {
  id: string;
  name: string;
  address: string;
  contract_template?: any;
  contact_info?: any;
  house_rules?: string[];
}

interface Booking {
  id: string;
  property_id: string;
  check_in_date: string;
  check_out_date: string;
  number_of_guests: number;
  status: string;
  property: Property;
  guests: Guest[];
}

// Fonctions de validation
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

// Récupérer les données de réservation
async function fetchBookingFromDatabase(client: any, bookingId: string): Promise<Booking> {
  console.log('📋 Fetching booking from database:', bookingId);
  
  const { data: dbBooking, error } = await client
    .from('bookings')
    .select(`
      *,
      property:properties(*),
      guests(*)
    `)
    .eq('id', bookingId)
    .single();

  if (error) {
    console.error('❌ Database error:', error);
    throw new Error(`Failed to fetch booking: ${error.message}`);
  }

  if (!dbBooking) {
    throw new Error('Booking not found');
  }

  console.log('✅ Booking fetched successfully');
  return dbBooking;
}

// Générer le contenu du contrat
function generateContractContent(booking: Booking): string {
  const { property, guests, check_in_date, check_out_date, number_of_guests } = booking;
  
  const guestNames = guests.map(g => g.full_name).join(', ');
  const guestDetails = guests.map(g => 
    `- ${g.full_name} (${g.nationality}, ${g.document_type}: ${g.document_number})`
  ).join('\n');

  const contractContent = `
CONTRAT DE LOCATION SAISONNIÈRE

Propriété: ${property.name}
Adresse: ${property.address}

Locataires:
${guestDetails}

Période de location:
- Arrivée: ${check_in_date}
- Départ: ${check_out_date}
- Nombre d'invités: ${number_of_guests}

Conditions générales:
1. Le locataire s'engage à respecter les règles de la propriété
2. Aucun animal n'est autorisé sans accord préalable
3. Le locataire est responsable des dommages causés
4. Le paiement doit être effectué avant l'arrivée

Signature électronique:
En signant ce contrat, le locataire reconnaît avoir lu et accepté toutes les conditions.

Date: ${new Date().toLocaleDateString('fr-FR')}
  `.trim();

  return contractContent;
}

// Sauvegarder le contrat généré
async function saveGeneratedContract(client: any, bookingId: string, contractContent: string) {
  console.log('💾 Saving generated contract for booking:', bookingId);
  
  const contractData = {
    booking_id: bookingId,
    document_type: 'contract',
    file_name: `contrat_${bookingId}.txt`,
    file_path: `/contracts/contrat_${bookingId}.txt`,
    document_url: `https://example.com/contracts/contrat_${bookingId}.txt`,
    is_signed: false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  const { data, error } = await client
    .from('generated_documents')
    .insert(contractData)
    .select()
    .single();

  if (error) {
    console.error('❌ Error saving contract:', error);
    throw new Error(`Failed to save contract: ${error.message}`);
  }

  console.log('✅ Contract saved successfully:', data.id);
  return data;
}

// Gérer les erreurs
function handleError(error: any, context: string) {
  console.error(`❌ Error in ${context}:`, error);
  
  const errorResponse = {
    success: false,
    error: error.message || 'Unknown error',
    context: context,
    timestamp: new Date().toISOString()
  };

  return new Response(JSON.stringify(errorResponse), {
    status: 500,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json'
    }
  });
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: corsHeaders
    });
  }

  try {
    console.log('🚀 generate-contract function started');
    console.log('📅 Timestamp:', new Date().toISOString());
    
    const supabase = await getServerClient();

    // Only allow POST
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

    // Parse request body
    const requestData = await req.json();
    console.log('📝 Request data:', requestData);

    const { bookingId, signatureData, signedAt, action = 'generate' } = requestData;

    // Validation
    try {
      validateRequiredFields(requestData, ['bookingId']);
      validateBookingId(bookingId);
      if (action) {
        validateAction(action, ['generate', 'sign', 'regenerate']);
      }
    } catch (validationError) {
      console.error('❌ Validation error:', validationError);
      return handleError(validationError, 'validation');
    }

    // Fetch booking data
    const booking = await fetchBookingFromDatabase(supabase, bookingId);
    
    // Generate contract content
    const contractContent = generateContractContent(booking);
    console.log('📄 Contract content generated');

    // Save generated contract
    const savedContract = await saveGeneratedContract(supabase, bookingId, contractContent);

    // If signing, create signature record
    if (action === 'sign' && signatureData) {
      console.log('✍️ Creating signature record');
      
      const signatureRecord = {
        booking_id: bookingId,
        signature_data: JSON.stringify(signatureData),
        contract_content: contractContent,
        signed_at: signedAt || new Date().toISOString(),
        signer_name: booking.guests[0]?.full_name || 'Unknown',
        signer_email: booking.guests[0]?.email || null,
        signer_phone: booking.guests[0]?.phone || null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      const { data: signature, error: signatureError } = await supabase
        .from('contract_signatures')
        .insert(signatureRecord)
        .select()
        .single();

      if (signatureError) {
        console.error('❌ Error creating signature:', signatureError);
        return handleError(signatureError, 'signature creation');
      }

      // Update generated document as signed
      await supabase
        .from('generated_documents')
        .update({ 
          is_signed: true,
          signature_id: signature.id,
          updated_at: new Date().toISOString()
        })
        .eq('id', savedContract.id);

      console.log('✅ Contract signed successfully');
    }

    // Return success response
    const response = {
      success: true,
      message: action === 'sign' ? 'Contract generated and signed successfully' : 'Contract generated successfully',
      data: {
        bookingId: bookingId,
        contractId: savedContract.id,
        contractContent: contractContent,
        action: action
      },
      timestamp: new Date().toISOString()
    };

    console.log('✅ Function completed successfully');

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });

  } catch (error) {
    return handleError(error, 'generate-contract');
  }
});

