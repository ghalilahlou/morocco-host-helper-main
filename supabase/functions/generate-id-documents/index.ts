import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { PDFDocument, rgb, StandardFonts } from 'https://esm.sh/pdf-lib@1.17.1';

// Headers CORS
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json'
};

// Validation UUID
function isValidUUID(uuid: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
}

// Nettoyage des données
function sanitizeString(input: any): string {
  if (!input || typeof input !== 'string') return 'Non spécifié';
  const cleaned = input.replace(/[<>]/g, '')
    .replace(/javascript:/gi, '')
    .replace(/data:/gi, '')
    .trim();
  return cleaned.length > 100 ? cleaned.substring(0, 100) + '...' : cleaned;
}

// Génération PDF pour un invité
async function generateIdentityPDF(guestInfo: any): Promise<Uint8Array> {
  try {
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([595.28, 841.89]); // A4
    const { width, height } = page.getSize();
    
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    
    const primaryColor = rgb(0.2, 0.4, 0.8);
    const textColor = rgb(0.1, 0.1, 0.1);
    
    // En-tête
    page.drawText('FICHE IDENTITÉ INVITÉ', {
      x: width / 2 - 120,
      y: height - 80,
      size: 24,
      font: boldFont,
      color: primaryColor
    });
    
    // Ligne de séparation
    page.drawLine({
      x: 50,
      y: height - 100,
      x: width - 50,
      y: height - 100,
      thickness: 2,
      color: primaryColor
    });
    
    // Informations
    const startY = height - 150;
    const lineHeight = 30;
    let currentY = startY;
    
    const fields = [
      ['Nom complet:', sanitizeString(guestInfo.guestName || guestInfo.full_name)],
      ['Type de document:', sanitizeString(guestInfo.documentType || guestInfo.document_type)],
      ['Numéro de document:', sanitizeString(guestInfo.documentNumber || guestInfo.document_number)],
      ['Nationalité:', sanitizeString(guestInfo.nationality)],
      ['Date de naissance:', sanitizeString(guestInfo.dateOfBirth || guestInfo.date_of_birth)],
      ['Lieu de naissance:', sanitizeString(guestInfo.placeOfBirth || guestInfo.place_of_birth)],
      ['Réservation ID:', sanitizeString(guestInfo.bookingId)],
      ['Généré le:', new Date().toLocaleString('fr-FR')]
    ];
    
    for (const [label, value] of fields) {
      page.drawText(label, {
        x: 80,
        y: currentY,
        size: 12,
        font: boldFont,
        color: textColor
      });
      page.drawText(value, {
        x: 250,
        y: currentY,
        size: 12,
        font: font,
        color: textColor
      });
      currentY -= lineHeight;
    }
    
    // Pied de page
    page.drawText('Document généré automatiquement', {
      x: 80,
      y: 50,
      size: 10,
      font: font,
      color: rgb(0.5, 0.5, 0.5)
    });
    
    return await pdfDoc.save();
  } catch (error) {
    console.error('❌ Erreur génération PDF:', error);
    throw new Error('Erreur lors de la génération du PDF');
  }
}

// Sauvegarder le document dans la base de données
async function saveDocumentToDatabase(
  client: any, 
  bookingId: string, 
  guestId: string,
  documentUrl: string
) {
  const fileName = `id-documents-${bookingId}-${Date.now()}.pdf`;
  
  const { data: documentRecord, error } = await client
    .from('uploaded_documents')
    .insert({
      booking_id: bookingId,
      guest_id: guestId,
      file_name: fileName,
      document_url: documentUrl,
      document_type: 'identity',
      processing_status: 'completed'
    })
    .select()
    .single();

  if (error) {
    console.error('❌ Erreur sauvegarde document:', error);
    throw new Error(`Failed to save document: ${error.message}`);
  }

  return documentRecord;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('🚀 generate-id-documents function started');
    console.log('📅 Timestamp:', new Date().toISOString());

    if (req.method !== 'POST') {
      return new Response(JSON.stringify({
        error: 'Method Not Allowed'
      }), {
        status: 405,
        headers: corsHeaders
      });
    }

    const requestBody = await req.json();
    console.log('📥 Request data:', {
      bookingId: requestBody.bookingId,
      hasGuestName: !!requestBody.guestName
    });
    
    // Validation des champs obligatoires
    if (!requestBody.bookingId) {
      return new Response(JSON.stringify({
        error: 'bookingId est requis'
      }), {
        status: 400,
        headers: corsHeaders
      });
    }
    
    // Validation UUID
    if (!isValidUUID(requestBody.bookingId)) {
      return new Response(JSON.stringify({
        error: 'bookingId doit être un UUID valide'
      }), {
        status: 400,
        headers: corsHeaders
      });
    }
    
    // Créer client Supabase
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!supabaseUrl || !serviceRoleKey) {
      return new Response(JSON.stringify({
        error: 'Configuration serveur manquante'
      }), {
        status: 500,
        headers: corsHeaders
      });
    }
    
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false }
    });
    
    // Vérifier que le booking existe et récupérer les invités
    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .select(`
        id, 
        status, 
        created_at,
        guests(*)
      `)
      .eq('id', requestBody.bookingId)
      .single();
      
    if (bookingError || !booking) {
      console.error('❌ Booking non trouvé:', bookingError);
      return new Response(JSON.stringify({
        error: 'Booking non trouvé'
      }), {
        status: 404,
        headers: corsHeaders
      });
    }
    
    if (!booking.guests || booking.guests.length === 0) {
      return new Response(JSON.stringify({
        error: 'Aucun invité trouvé pour cette réservation'
      }), {
        status: 404,
        headers: corsHeaders
      });
    }
    
    console.log(`✅ Booking trouvé avec ${booking.guests.length} invité(s)`);
    
    // Générer les documents pour tous les invités
    const generatedDocuments = [];
    
    for (const guest of booking.guests) {
      console.log(`📄 Génération document pour: ${guest.full_name}`);
      
      const guestInfo = {
        guestName: guest.full_name,
        full_name: guest.full_name,
        documentType: guest.document_type,
        document_type: guest.document_type,
        documentNumber: guest.document_number,
        document_number: guest.document_number,
        nationality: guest.nationality,
        dateOfBirth: guest.date_of_birth,
        date_of_birth: guest.date_of_birth,
        placeOfBirth: guest.place_of_birth,
        place_of_birth: guest.place_of_birth,
        bookingId: requestBody.bookingId
      };
      
      // Générer le PDF
      const pdfBytes = await generateIdentityPDF(guestInfo);
      const pdfBase64 = btoa(String.fromCharCode(...pdfBytes));
      const documentUrl = `data:application/pdf;base64,${pdfBase64}`;
      
      // Sauvegarder dans la base de données
      const documentRecord = await saveDocumentToDatabase(
        supabase,
        requestBody.bookingId,
        guest.id,
        documentUrl
      );
      
      generatedDocuments.push({
        guestName: guest.full_name,
        guestId: guest.id,
        documentId: documentRecord.id,
        documentUrl: documentUrl
      });
      
      console.log(`✅ Document généré et sauvegardé pour: ${guest.full_name}`);
    }
    
    // Réponse finale
    return new Response(JSON.stringify({
      success: true,
      bookingId: requestBody.bookingId,
      documentsGenerated: generatedDocuments.length,
      documents: generatedDocuments,
      message: `${generatedDocuments.length} document(s) d'identité généré(s) avec succès`
    }), {
      status: 200,
      headers: corsHeaders
    });
    
  } catch (error) {
    console.error('❌ Erreur dans generate-id-documents:', error);
    return new Response(JSON.stringify({
      error: error instanceof Error ? error.message : 'Erreur inconnue'
    }), {
      status: 500,
      headers: corsHeaders
    });
  }
});
