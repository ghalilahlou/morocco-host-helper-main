/// <reference types="https://deno.land/x/types/deploy/stable/index.d.ts" />

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

// Types
interface GenerateDocumentsRequest {
  token: string;
  airbnbCode: string;
  guestInfo: {
    firstName: string;
    lastName: string;
    email?: string;
    phone?: string;
    nationality?: string;
    idType?: string;
    idNumber?: string;
  };
  idDocuments: Array<{
    name: string;
    url: string;
    type: string;
  }>;
  signature?: {
    data: string; // base64
    timestamp: string;
  };
}

interface ResolvedBooking {
  propertyId: string;
  airbnbCode: string;
  checkIn: string;
  checkOut: string;
  guestName?: string;
  propertyName?: string;
}

// Helper: Créer client Supabase
async function getServerClient() {
  const url = Deno.env.get('SUPABASE_URL');
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!url || !key) {
    throw new Error('Missing Supabase credentials');
  }

  return createClient(url, key, { 
    auth: { persistSession: false },
    global: { headers: { 'X-Client-Info': 'generate-documents-edge-function' } }
  });
}

// Helper: Résoudre la réservation via booking-resolve
async function resolveBooking(token: string, airbnbCode: string): Promise<ResolvedBooking> {
  console.log('🔍 Resolving booking for token and code...');
  
  const functionUrl = Deno.env.get('SUPABASE_URL');
  if (!functionUrl) {
    throw new Error('SUPABASE_URL not configured');
  }

  const response = await fetch(`${functionUrl}/functions/v1/booking-resolve`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${Deno.env.get('SUPABASE_ANON_KEY')}`,
    },
    body: JSON.stringify({ token, airbnbCode })
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(`Booking resolution failed: ${errorData.error?.message || response.statusText}`);
  }

  const result = await response.json();
  if (!result.success) {
    throw new Error(`Booking resolution failed: ${result.error?.message || 'Unknown error'}`);
  }

  return result.data;
}

// Helper: Validation et sanitization
function sanitizeString(input: any): string {
  if (!input || typeof input !== 'string') return 'Non spécifié';
  const cleaned = input.replace(/[<>]/g, '')
    .replace(/javascript:/gi, '')
    .replace(/data:/gi, '')
    .trim();
  return cleaned.length > 100 ? cleaned.substring(0, 100) + '...' : cleaned;
}

function formatDate(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString('fr-FR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  } catch {
    return dateStr;
  }
}

// Génération PDF du contrat avec données résolues
async function generateContractPDF(
  guestInfo: any,
  booking: ResolvedBooking,
  idDocuments: any[]
): Promise<Uint8Array> {
  try {
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([595.28, 841.89]); // A4
    const { width, height } = page.getSize();
    
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    
    const primaryColor = rgb(0.2, 0.4, 0.8);
    const textColor = rgb(0.1, 0.1, 0.1);
    
    let yPosition = height - 60;
    
    // En-tête
    page.drawText('CONTRAT DE LOCATION SAISONNIÈRE', {
      x: width / 2 - 160,
      y: yPosition,
      size: 20,
      font: boldFont,
      color: primaryColor
    });
    
    yPosition -= 40;
    
    // Informations de la réservation (VERROUILLÉES)
    page.drawText('📍 DÉTAILS DE LA RÉSERVATION', {
      x: 50,
      y: yPosition,
      size: 14,
      font: boldFont,
      color: primaryColor
    });
    
    yPosition -= 25;
    
    const bookingDetails = [
      `Code de réservation Airbnb: ${booking.airbnbCode}`,
      `Propriété: ${booking.propertyName || 'Non spécifiée'}`,
      `Check-in: ${formatDate(booking.checkIn)} (Données verrouillées)`,
      `Check-out: ${formatDate(booking.checkOut)} (Données verrouillées)`,
      `Durée: ${Math.ceil((new Date(booking.checkOut).getTime() - new Date(booking.checkIn).getTime()) / (1000 * 60 * 60 * 24))} nuits`
    ];
    
    for (const detail of bookingDetails) {
      page.drawText(detail, {
        x: 50,
        y: yPosition,
        size: 11,
        font: font,
        color: textColor
      });
      yPosition -= 18;
    }
    
    yPosition -= 20;
    
    // Informations invité
    page.drawText('👤 INFORMATIONS INVITÉ', {
      x: 50,
      y: yPosition,
      size: 14,
      font: boldFont,
      color: primaryColor
    });
    
    yPosition -= 25;
    
    const guestDetails = [
      `Nom: ${sanitizeString(guestInfo.lastName)}`,
      `Prénom: ${sanitizeString(guestInfo.firstName)}`,
      `Email: ${sanitizeString(guestInfo.email)}`,
      `Téléphone: ${sanitizeString(guestInfo.phone)}`,
      `Nationalité: ${sanitizeString(guestInfo.nationality)}`,
      `Type de pièce d'identité: ${sanitizeString(guestInfo.idType)}`,
      `Numéro: ${sanitizeString(guestInfo.idNumber)}`
    ];
    
    for (const detail of guestDetails) {
      page.drawText(detail, {
        x: 50,
        y: yPosition,
        size: 11,
        font: font,
        color: textColor
      });
      yPosition -= 18;
    }
    
    yPosition -= 20;
    
    // Pièces d'identité
    if (idDocuments.length > 0) {
      page.drawText('📄 PIÈCES D\'IDENTITÉ FOURNIES', {
        x: 50,
        y: yPosition,
        size: 14,
        font: boldFont,
        color: primaryColor
      });
      
      yPosition -= 25;
      
      for (const doc of idDocuments) {
        page.drawText(`• ${sanitizeString(doc.name)} (${sanitizeString(doc.type)})`, {
          x: 50,
          y: yPosition,
          size: 11,
          font: font,
          color: textColor
        });
        yPosition -= 18;
      }
      
      yPosition -= 20;
    }
    
    // Clause importante
    page.drawText('⚠️ ATTENTION', {
      x: 50,
      y: yPosition,
      size: 12,
      font: boldFont,
      color: rgb(0.8, 0.2, 0.2)
    });
    
    yPosition -= 20;
    
    page.drawText('Les dates de check-in et check-out sont automatiquement', {
      x: 50,
      y: yPosition,
      size: 10,
      font: font,
      color: textColor
    });
    yPosition -= 15;
    
    page.drawText('extraites de votre réservation Airbnb et ne peuvent être modifiées.', {
      x: 50,
      y: yPosition,
      size: 10,
      font: font,
      color: textColor
    });
    
    yPosition -= 30;
    
    // Signature et date
    page.drawText(`Document généré le: ${new Date().toLocaleDateString('fr-FR')}`, {
      x: 50,
      y: yPosition,
      size: 10,
      font: font,
      color: textColor
    });
    
    yPosition -= 20;
    
    page.drawText('Signature invité:', {
      x: 50,
      y: yPosition,
      size: 11,
      font: boldFont,
      color: textColor
    });
    
    // ✅ NOUVEAU : Suppression du cadre de signature
    // Le rectangle de signature a été supprimé pour un contrat plus propre
    
    const pdfBytes = await pdfDoc.save();
    console.log('✅ Contract PDF generated successfully');
    return pdfBytes;
    
  } catch (error) {
    console.error('❌ Error generating contract PDF:', error);
    throw new Error(`PDF generation failed: ${error.message}`);
  }
}

// Handler principal
serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  console.log('📄 Generate documents function called');
  console.log('📅 Timestamp:', new Date().toISOString());

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({
      success: false,
      error: 'Only POST method is allowed'
    }), {
      status: 405,
      headers: corsHeaders
    });
  }

  try {
    // Parser le body - supporter FormData pour les fichiers
    let token: string;
    let airbnbCode: string;
    let guestInfo: any;
    let idDocuments: any[] = [];
    let signature: any;

    const contentType = req.headers.get('content-type') || '';
    
    if (contentType.includes('multipart/form-data')) {
      // Traiter FormData (avec fichiers)
      console.log('📤 Processing FormData request with files...');
      const formData = await req.formData();
      
      token = formData.get('token') as string;
      airbnbCode = formData.get('airbnbCode') as string;
      
      const guestInfoStr = formData.get('guestInfo') as string;
      guestInfo = guestInfoStr ? JSON.parse(guestInfoStr) : {};
      
      const signatureStr = formData.get('signature') as string;
      signature = signatureStr ? JSON.parse(signatureStr) : null;
      
      // Traiter les fichiers documents d'identité
      const supabase = await getServerClient();
      
      for (const [key, value] of formData.entries()) {
        if (key.startsWith('idDocument_') && value instanceof File) {
          const index = key.split('_')[1];
          const metaKey = `idDocumentMeta_${index}`;
          const metaStr = formData.get(metaKey) as string;
          const meta = metaStr ? JSON.parse(metaStr) : { name: value.name, type: value.type };
          
          // Uploader le fichier dans Supabase Storage
          const timestamp = Date.now();
          const fileName = `${timestamp}_${value.name}`;
          const filePath = `guest-documents/${fileName}`;
          
          console.log(`📄 Uploading ID document: ${fileName}`);
          const { data: uploadData, error: uploadError } = await supabase.storage
            .from('guest-documents')
            .upload(filePath, value, {
              contentType: value.type,
              upsert: false
            });
          
          if (uploadError) {
            console.error('❌ Failed to upload ID document:', uploadError);
            throw new Error(`Failed to upload document: ${uploadError.message}`);
          }
          
          // Créer URL signée pour le document
          const { data: urlData } = await supabase.storage
            .from('guest-documents')
            .createSignedUrl(filePath, 24 * 60 * 60); // 24h
          
          // Ajouter le document à la liste
          idDocuments.push({
            name: meta.name,
            url: urlData?.signedUrl || filePath,
            type: meta.type,
            filePath: filePath // Stocker le chemin pour référence
          });
          
          console.log(`✅ ID document uploaded successfully: ${fileName}`);
        }
      }
      
    } else {
      // Traiter JSON classique (rétrocompatibilité)
      console.log('📝 Processing JSON request...');
      try {
        const requestBody = await req.json();
        token = requestBody.token;
        airbnbCode = requestBody.airbnbCode;
        guestInfo = requestBody.guestInfo;
        idDocuments = requestBody.idDocuments || [];
        signature = requestBody.signature;
      } catch (parseError) {
        console.error('❌ Failed to parse JSON body:', parseError);
        return new Response(JSON.stringify({
          success: false,
          error: 'Invalid JSON in request body'
        }), {
          status: 400,
          headers: corsHeaders
        });
      }
    }

    // Validations
    if (!token || !airbnbCode || !guestInfo) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Missing required fields: token, airbnbCode, guestInfo'
      }), {
        status: 400,
        headers: corsHeaders
      });
    }

    console.log('📝 Request validated for guest:', sanitizeString(guestInfo.firstName));

    // 1) Résoudre la réservation (dates verrouillées)
    console.log('🔍 Resolving booking with locked dates...');
    let booking: ResolvedBooking;
    try {
      booking = await resolveBooking(token, airbnbCode);
      console.log('✅ Booking resolved:', {
        checkIn: booking.checkIn,
        checkOut: booking.checkOut,
        propertyName: booking.propertyName
      });
    } catch (error) {
      console.error('❌ Failed to resolve booking:', error);
      return new Response(JSON.stringify({
        success: false,
        error: 'Failed to resolve booking. Please verify your token and Airbnb code.',
        details: error.message
      }), {
        status: 400,
        headers: corsHeaders
      });
    }

    // 1.5) Si on a des documents d'identité uploadés, les enregistrer en base
    if (idDocuments.length > 0) {
      console.log(`📄 Saving ${idDocuments.length} ID documents to database...`);
      const supabaseClient = await getServerClient();
      
      for (const doc of idDocuments) {
        if (doc.filePath) {
          try {
            const { error: dbDocError } = await supabaseClient
              .from('uploaded_documents')
              .insert({
                property_id: booking.propertyId,
                file_name: doc.name,
                file_path: doc.filePath,
                document_url: doc.url,
                document_type: 'identity',
                processing_status: 'completed',
                created_at: new Date().toISOString()
              });
            
            if (dbDocError) {
              console.warn(`⚠️ Failed to save document ${doc.name} to database:`, dbDocError);
            } else {
              console.log(`✅ Document ${doc.name} saved to database`);
            }
          } catch (error) {
            console.warn(`⚠️ Error saving document ${doc.name}:`, error);
          }
        }
      }
    }

    // 2) Générer le PDF du contrat
    console.log('📄 Generating contract PDF...');
    const contractPdf = await generateContractPDF(guestInfo, booking, idDocuments || []);

    // 3) Sauvegarder dans Storage
    const supabase = await getServerClient();
    const fileName = `contract_${booking.airbnbCode}_${Date.now()}.pdf`;
    const filePath = `contracts/${booking.propertyId}/${fileName}`;

    console.log('💾 Uploading contract to storage...');
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('guest_documents')
      .upload(filePath, contractPdf, {
        contentType: 'application/pdf',
        upsert: false
      });

    if (uploadError) {
      console.error('❌ Failed to upload contract:', uploadError);
      return new Response(JSON.stringify({
        success: false,
        error: 'Failed to save contract',
        details: uploadError.message
      }), {
        status: 500,
        headers: corsHeaders
      });
    }

    // 4) Créer URL signée pour téléchargement
    const { data: urlData } = await supabase.storage
      .from('guest_documents')
      .createSignedUrl(filePath, 24 * 60 * 60); // 24h

    let contractUrl = urlData?.signedUrl || filePath; // URL par défaut

    // 5) Utiliser le workflow standard avec submit-guest-info puis generate-contract
    console.log('💾 Saving guest information via submit-guest-info...');
    
    try {
      // Étape 5a: Sauvegarder les informations invité
      const guestSubmitResponse = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/submit-guest-info`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
          'Content-Type': 'application/json',
          'apikey': Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
        },
        body: JSON.stringify({
          propertyId: booking.propertyId,
          token: token,
          bookingData: {
            airbnbCode: booking.airbnbCode,
            checkInDate: booking.checkIn,
            checkOutDate: booking.checkOut,
            guestName: booking.guestName || `${guestInfo.firstName} ${guestInfo.lastName}`,
            propertyName: booking.propertyName || 'Propriété'
          },
          guestData: {
            guests: [{
              fullName: `${guestInfo.firstName} ${guestInfo.lastName}`,
              nationality: guestInfo.nationality || 'Non spécifiée',
              documentNumber: guestInfo.idNumber || '',
              documentType: guestInfo.idType || 'passport'
            }],
            documentUrls: idDocuments.map(doc => doc.url)
          }
        })
      });

      const guestSubmitData = await guestSubmitResponse.json();
      
      if (!guestSubmitData.success || !guestSubmitData.data?.bookingId) {
        throw new Error(`Submit guest info failed: ${guestSubmitData.error?.message || 'Unknown error'}`);
      }

      const bookingId = guestSubmitData.data.bookingId;
      console.log('✅ Guest info saved, bookingId:', bookingId);

      // Étape 5b: Générer le contrat via generate-contract
      console.log('📄 Generating contract via generate-contract...');
      const contractResponse = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/generate-contract`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
          'Content-Type': 'application/json',
          'apikey': Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
        },
        body: JSON.stringify({
          bookingId: bookingId,
          action: signature ? 'sign' : 'generate',
          signatureData: signature?.data,
          signedAt: signature?.timestamp
        })
      });

      const contractData = await contractResponse.json();
      
      if (!contractData.success) {
        throw new Error(`Contract generation failed: ${contractData.error?.message || 'Unknown error'}`);
      }

      // Utiliser l'URL du contrat généré par generate-contract
      const documentUrl = contractData.data?.documentUrl;
      
      if (documentUrl) {
        console.log('✅ Contract generated via generate-contract:', documentUrl);
        contractUrl = documentUrl; // Remplacer par l'URL du workflow standard
      }
      
    } catch (workflowError) {
      console.error('❌ Standard workflow failed:', workflowError);
      console.log('📄 Falling back to direct contract generation...');
      // Continuer avec notre méthode actuelle comme fallback
      
      // Sauvegarde directe dans guest_submissions comme fallback
      const contractRecord = {
        id: crypto.randomUUID(),
        property_id: booking.propertyId,
        airbnb_code: booking.airbnbCode,
        guest_info: guestInfo,
        booking_dates: {
          checkIn: booking.checkIn,
          checkOut: booking.checkOut,
          locked: true
        },
        contract_url: contractUrl,
        id_documents: idDocuments || [],
        status: 'generated',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      const { error: dbError } = await supabaseClient
        .from('guest_submissions')
        .upsert(contractRecord, { onConflict: 'property_id,airbnb_code' });

      if (dbError) {
        console.warn('⚠️ Failed to save contract record to database:', dbError);
      }
    }

    console.log('🎉 Documents generated successfully');

    return new Response(JSON.stringify({
      success: true,
      data: {
        documentUrl: contractUrl, // Utiliser l'URL du contrat généré
        contractUrl: contractUrl,
        booking: {
          checkIn: booking.checkIn,
          checkOut: booking.checkOut,
          propertyName: booking.propertyName,
          locked: true
        },
        fileName,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
      }
    }), {
      status: 200,
      headers: corsHeaders
    });

  } catch (error) {
    console.error('❌ Unexpected error in generate-documents:', error);
    return new Response(JSON.stringify({
      success: false,
      error: 'Internal server error',
      details: error.message
    }), {
      status: 500,
      headers: corsHeaders
    });
  }
});
