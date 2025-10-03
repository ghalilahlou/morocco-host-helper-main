import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { PDFDocument, rgb, StandardFonts } from 'https://esm.sh/pdf-lib@1.17.1';
import fontkit from 'https://esm.sh/@pdf-lib/fontkit@0.1.1';

// Types
interface FinalizeRequest {
  token: string;
  bookingId?: string;
  guestData: {
    guests: Array<{
      fullName: string;
      nationality: string;
      documentNumber: string;
      documentType: string;
    }>;
  };
  signatureData?: string;
  documents: {
    contract?: string; // base64 PDF
    police?: string;   // base64 PDF
    identity?: string; // base64 PDF
  };
}

interface DocumentInfo {
  bookingId: string;
  type: 'contract' | 'police' | 'identity';
  isSigned: boolean;
  fileBytes: Uint8Array;
  fileName: string;
  mimeType: string;
}

// Configuration CORS
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
};

// Client Supabase avec service role
async function getServerClient() {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  
  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
}

// Fonction pour calculer SHA256
async function computeSha256(bytes: Uint8Array): Promise<string> {
  const hashBuffer = await crypto.subtle.digest('SHA-256', bytes);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// Fonction pour uploader un document vers Storage
async function uploadDocumentToStorage(
  supabase: any,
  documentInfo: DocumentInfo
): Promise<string> {
  const { bookingId, type, fileBytes, fileName, mimeType } = documentInfo;
  
  // Déterminer le chemin de stockage
  const storagePath = `documents/${type}/${bookingId}/${fileName}`;
  
  console.log(`📤 Uploading ${type} document to storage: ${storagePath}`);
  
  // Upload vers Storage
  const { data: uploadData, error: uploadError } = await supabase.storage
    .from('guest-documents')
    .upload(storagePath, fileBytes, {
      contentType: mimeType,
      upsert: true
    });
    
  if (uploadError) {
    console.error(`❌ Upload error for ${type}:`, uploadError);
    throw new Error(`Failed to upload ${type} document: ${uploadError.message}`);
  }
  
  // Obtenir l'URL publique
  const { data: { publicUrl } } = supabase.storage
    .from('guest-documents')
    .getPublicUrl(storagePath);
    
  console.log(`✅ ${type} document uploaded successfully: ${publicUrl}`);
  
  return publicUrl;
}

// Fonction pour upsert un document dans la base de données
async function upsertDocument(
  supabase: any,
  documentInfo: DocumentInfo,
  publicUrl: string,
  sha256: string
): Promise<string> {
  const { bookingId, type, isSigned, fileBytes, mimeType } = documentInfo;
  
  console.log(`💾 Upserting ${type} document in database`);
  
  // Utiliser la fonction RPC upsert_document
  const { data, error } = await supabase.rpc('upsert_document', {
    p_booking_id: bookingId,
    p_type: type,
    p_is_signed: isSigned,
    p_storage_path: `documents/${type}/${bookingId}/${documentInfo.fileName}`,
    p_public_url: publicUrl,
    p_sha256: sha256,
    p_file_size: fileBytes.length,
    p_mime_type: mimeType
  });
  
  if (error) {
    console.error(`❌ Database error for ${type}:`, error);
    throw new Error(`Failed to save ${type} document: ${error.message}`);
  }
  
  console.log(`✅ ${type} document saved to database with ID: ${data}`);
  return data;
}

// Fonction pour traiter un document
async function processDocument(
  supabase: any,
  documentInfo: DocumentInfo
): Promise<string> {
  try {
    // 1. Calculer le SHA256
    const sha256 = await computeSha256(documentInfo.fileBytes);
    console.log(`🔐 SHA256 computed for ${documentInfo.type}: ${sha256.substring(0, 8)}...`);
    
    // 2. Upload vers Storage
    const publicUrl = await uploadDocumentToStorage(supabase, documentInfo);
    
    // 3. Upsert dans la base de données
    const documentId = await upsertDocument(supabase, documentInfo, publicUrl, sha256);
    
    return publicUrl;
  } catch (error) {
    console.error(`❌ Error processing ${documentInfo.type} document:`, error);
    throw error;
  }
}

// Fonction pour générer un PDF de police avec support arabe
async function generatePolicePDFWithArabic(
  guestData: FinalizeRequest['guestData']
): Promise<Uint8Array> {
  console.log('📄 Generating police PDF with Arabic support...');
  
  const pdfDoc = await PDFDocument.create();
  
  // Enregistrer fontkit pour le support des polices
  pdfDoc.registerFontkit(fontkit);
  
  // Charger une police compatible arabe (Noto Naskh Arabic)
  // En production, vous devriez avoir cette police dans vos assets
  let arabicFont;
  try {
    // Tentative de charger la police arabe depuis un CDN ou assets
    const fontResponse = await fetch('https://fonts.gstatic.com/s/notonaskharabic/v1/NotoNaskhArabic-Regular.ttf');
    if (fontResponse.ok) {
      const fontBytes = await fontResponse.arrayBuffer();
      arabicFont = await pdfDoc.embedFont(fontBytes, { subset: true });
      console.log('✅ Arabic font loaded successfully');
    } else {
      throw new Error('Arabic font not available');
    }
  } catch (error) {
    console.warn('⚠️ Arabic font not available, using fallback');
    arabicFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
  }
  
  const page = pdfDoc.addPage([595, 842]); // A4
  
  // En-tête
  page.drawText('FICHE DE POLICE - POLICE FORM', {
    x: 50,
    y: 750,
    size: 16,
    font: await pdfDoc.embedFont(StandardFonts.HelveticaBold),
    color: rgb(0, 0, 0)
  });
  
  let yPosition = 700;
  const lineHeight = 20;
  
  // Informations des invités
  for (const [index, guest] of guestData.guests.entries()) {
    page.drawText(`Invité ${index + 1} / Guest ${index + 1}:`, {
      x: 50,
      y: yPosition,
      size: 12,
      font: await pdfDoc.embedFont(StandardFonts.HelveticaBold),
      color: rgb(0, 0, 0)
    });
    yPosition -= lineHeight;
    
    // Nom en français et arabe
    page.drawText(`Nom / Name: ${guest.fullName}`, {
      x: 70,
      y: yPosition,
      size: 10,
      font: await pdfDoc.embedFont(StandardFonts.Helvetica),
      color: rgb(0, 0, 0)
    });
    yPosition -= lineHeight;
    
    // Nationalité
    page.drawText(`Nationalité / Nationality: ${guest.nationality}`, {
      x: 70,
      y: yPosition,
      size: 10,
      font: await pdfDoc.embedFont(StandardFonts.Helvetica),
      color: rgb(0, 0, 0)
    });
    yPosition -= lineHeight;
    
    // Type de document
    page.drawText(`Type de document / Document Type: ${guest.documentType}`, {
      x: 70,
      y: yPosition,
      size: 10,
      font: await pdfDoc.embedFont(StandardFonts.Helvetica),
      color: rgb(0, 0, 0)
    });
    yPosition -= lineHeight;
    
    // Numéro de document
    page.drawText(`Numéro / Number: ${guest.documentNumber}`, {
      x: 70,
      y: yPosition,
      size: 10,
      font: await pdfDoc.embedFont(StandardFonts.Helvetica),
      color: rgb(0, 0, 0)
    });
    yPosition -= lineHeight * 2;
    
    // Texte arabe (si la police arabe est disponible)
    if (arabicFont && arabicFont !== await pdfDoc.embedFont(StandardFonts.Helvetica)) {
      try {
        // Exemple de texte arabe
        const arabicText = `الاسم: ${guest.fullName}`;
        page.drawText(arabicText, {
          x: 70,
          y: yPosition,
          size: 10,
          font: arabicFont,
          color: rgb(0, 0, 0)
        });
        yPosition -= lineHeight;
      } catch (error) {
        console.warn('⚠️ Error rendering Arabic text:', error);
      }
    }
  }
  
  // Pied de page
  page.drawText(`Généré le / Generated on: ${new Date().toLocaleString('fr-FR')}`, {
    x: 50,
    y: 50,
    size: 8,
    font: await pdfDoc.embedFont(StandardFonts.Helvetica),
    color: rgb(0.5, 0.5, 0.5)
  });
  
  const pdfBytes = await pdfDoc.save();
  console.log('✅ Police PDF generated successfully');
  
  return new Uint8Array(pdfBytes);
}

// Fonction principale
serve(async (req) => {
  // Gestion CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  
  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ success: false, error: 'Method not allowed' }),
      { status: 405, headers: corsHeaders }
    );
  }
  
  try {
    const requestData: FinalizeRequest = await req.json();
    const { token, bookingId, guestData, signatureData, documents } = requestData;
    
    console.log('🎯 [finalize-reservation] Starting reservation finalization');
    console.log('📋 Request data:', {
      hasToken: !!token,
      hasBookingId: !!bookingId,
      guestsCount: guestData?.guests?.length || 0,
      hasSignature: !!signatureData,
      documentsTypes: Object.keys(documents || {})
    });
    
    const supabase = await getServerClient();
    
    // 1. Finaliser la réservation via RPC
    console.log('🔄 Finalizing reservation via RPC...');
    const { data: finalizeResult, error: finalizeError } = await supabase.rpc('finalize_reservation', {
      p_token: token,
      p_payload: {
        airbnbCode: 'AUTO_GENERATED', // À adapter selon votre logique
        guestName: guestData?.guests?.[0]?.fullName || 'Guest',
        guestEmail: 'guest@example.com', // À adapter
        checkInDate: new Date().toISOString().split('T')[0],
        checkOutDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        numberOfGuests: guestData?.guests?.length || 1
      }
    });
    
    if (finalizeError) {
      console.error('❌ Finalization error:', finalizeError);
      throw new Error(`Failed to finalize reservation: ${finalizeError.message}`);
    }
    
    if (!finalizeResult?.success) {
      throw new Error(finalizeResult?.error || 'Failed to finalize reservation');
    }
    
    const resolvedBookingId = finalizeResult.booking_id;
    console.log('✅ Reservation finalized with ID:', resolvedBookingId);
    
    // 2. Traiter les documents
    const processedDocuments: Record<string, string> = {};
    
    // Contrat signé
    if (documents?.contract) {
      console.log('📄 Processing signed contract...');
      const contractBytes = Uint8Array.from(atob(documents.contract), c => c.charCodeAt(0));
      
      const contractInfo: DocumentInfo = {
        bookingId: resolvedBookingId,
        type: 'contract',
        isSigned: true,
        fileBytes: contractBytes,
        fileName: `contract-signed-${Date.now()}.pdf`,
        mimeType: 'application/pdf'
      };
      
      processedDocuments.contract = await processDocument(supabase, contractInfo);
    }
    
    // Police (génération automatique)
    if (guestData?.guests?.length > 0) {
      console.log('👮 Generating police form...');
      const policeBytes = await generatePolicePDFWithArabic(guestData);
      
      const policeInfo: DocumentInfo = {
        bookingId: resolvedBookingId,
        type: 'police',
        isSigned: false,
        fileBytes: policeBytes,
        fileName: `police-${Date.now()}.pdf`,
        mimeType: 'application/pdf'
      };
      
      processedDocuments.police = await processDocument(supabase, policeInfo);
    }
    
    // Documents d'identité
    if (documents?.identity) {
      console.log('🆔 Processing identity documents...');
      const identityBytes = Uint8Array.from(atob(documents.identity), c => c.charCodeAt(0));
      
      const identityInfo: DocumentInfo = {
        bookingId: resolvedBookingId,
        type: 'identity',
        isSigned: false,
        fileBytes: identityBytes,
        fileName: `identity-${Date.now()}.pdf`,
        mimeType: 'application/pdf'
      };
      
      processedDocuments.identity = await processDocument(supabase, identityInfo);
    }
    
    // 3. Retourner le résultat
    const result = {
      success: true,
      bookingId: resolvedBookingId,
      documents: processedDocuments,
      message: 'Reservation finalized successfully with all documents'
    };
    
    console.log('✅ Finalization completed successfully');
    console.log('📊 Result:', {
      bookingId: result.bookingId,
      documentsCount: Object.keys(result.documents).length,
      documentTypes: Object.keys(result.documents)
    });
    
    return new Response(JSON.stringify(result), {
      status: 200,
      headers: corsHeaders
    });
    
  } catch (error) {
    console.error('❌ [finalize-reservation] Error:', error);
    
    return new Response(JSON.stringify({
      success: false,
      error: error.message || 'Internal server error',
      details: error.stack
    }), {
      status: 500,
      headers: corsHeaders
    });
  }
});







