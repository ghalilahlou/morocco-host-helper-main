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

// Générer le PDF du contrat (version simplifiée)
async function generateContractPDF(booking: Booking, signatureData?: string, signedAt?: string): Promise<string> {
  console.log('📄 Generating contract PDF...');
  
  // Import jsPDF dynamically
  const { jsPDF } = await import('https://esm.sh/jspdf@2.5.1');
  
  const doc = new jsPDF();
  
  // En-tête
  doc.setFontSize(20);
  doc.text('CONTRAT DE LOCATION', 105, 30, { align: 'center' });
  
  // Informations propriété
  doc.setFontSize(12);
  let y = 60;
  doc.text(`Propriété: ${booking.property.name}`, 20, y);
  y += 10;
  doc.text(`Adresse: ${booking.property.address}`, 20, y);
  y += 20;
  
  // Informations réservation
  doc.text(`Réservation: ${booking.id}`, 20, y);
  y += 10;
  doc.text(`Check-in: ${booking.check_in_date}`, 20, y);
  y += 10;
  doc.text(`Check-out: ${booking.check_out_date}`, 20, y);
  y += 10;
  doc.text(`Nombre d'invités: ${booking.number_of_guests}`, 20, y);
  y += 20;
  
  // Invités
  if (booking.guests && booking.guests.length > 0) {
    doc.text('INVITÉS:', 20, y);
    y += 10;
    
    for (const guest of booking.guests) {
      doc.text(`• ${guest.full_name} (${guest.nationality})`, 25, y);
      y += 8;
      doc.text(`  Document: ${guest.document_number}`, 30, y);
      y += 12;
    }
  }
  
  // Signature hôte (si disponible)
  if (booking.property.contract_template?.landlord_signature) {
    y += 20;
    doc.text('Signature Hôte:', 20, y);
    // Ici on pourrait ajouter l'image de signature
  }
  
  // Signature invité (si disponible)
  if (signatureData) {
    y += 30;
    doc.text('Signature Invité:', 20, y);
    doc.text(`Signé le: ${signedAt || new Date().toLocaleString()}`, 20, y + 10);
  }
  
  // Générer le PDF en base64
  const pdfOutput = doc.output('datauristring');
  console.log('✅ Contract PDF generated successfully');
  
  return pdfOutput;
}

// Sauvegarder le document dans la base de données
async function saveDocumentToDatabase(
  client: any, 
  bookingId: string, 
  documentType: string, 
  documentUrl: string, 
  isSigned: boolean = false,
  signatureData?: string,
  signedAt?: string
) {
  const fileName = `${documentType}-${bookingId}-${Date.now()}.pdf`;
  
  const { data: documentRecord, error } = await client
    .from('uploaded_documents')
    .insert({
      booking_id: bookingId,
      file_name: fileName,
      document_url: documentUrl,
      document_type: documentType,
      is_signed: isSigned,
      signature_data: signatureData || null,
      signed_at: signedAt || (isSigned ? new Date().toISOString() : null),
      processing_status: 'completed'
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to save document to database: ${error.message}`);
  }

  return documentRecord;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }
  
  try {
    console.log('🚀 generate-contract function started');
    console.log('📅 Timestamp:', new Date().toISOString());

    if (req.method !== 'POST') {
      return new Response(JSON.stringify({
        success: false,
        message: 'Method Not Allowed'
      }), {
        status: 405,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const client = await getServerClient();

    const requestData = await req.json();
    console.log('📥 Request data:', {
      bookingId: requestData.bookingId,
      action: requestData.action,
      hasSignatureData: !!requestData.signatureData
    });

    const { bookingId, signatureData, signedAt, action = 'generate' } = requestData;

    // Validation
    try {
      validateRequiredFields(requestData, ['bookingId']);
      validateBookingId(bookingId);
      if (action) {
        validateAction(action, ['generate', 'sign', 'regenerate']);
      }
    } catch (validationError) {
      console.error('❌ Validation error:', validationError.message);
      return new Response(JSON.stringify({
        success: false,
        message: validationError.message
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Récupérer les données de réservation
    const booking = await fetchBookingFromDatabase(client, bookingId);

    // Générer le contrat
    const documentUrl = await generateContractPDF(booking, signatureData, signedAt);
    
    // Sauvegarder dans la base de données
    const documentRecord = await saveDocumentToDatabase(
      client, 
      booking.id, 
      'contract', 
      documentUrl, 
      !!signatureData,
      signatureData,
      signedAt
    );

    console.log('✅ Contract generated and saved successfully');

    return new Response(JSON.stringify({
      success: true,
      documentUrl,
      documentId: documentRecord.id,
      message: `Contract ${action}d successfully`,
      signed: !!signatureData,
      signedAt: signedAt || (signatureData ? new Date().toISOString() : null)
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

    } catch (error) {
    console.error('❌ Error in generate-contract:', error);
    
    return new Response(JSON.stringify({
      success: false,
      message: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
