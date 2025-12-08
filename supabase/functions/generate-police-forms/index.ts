import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { PDFDocument, StandardFonts, rgb } from "https://esm.sh/pdf-lib@1.17.1";
import fontkit from "https://esm.sh/@pdf-lib/fontkit@1.1.1";

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
  profession?: string;
  motif_sejour?: string;
  adresse_personnelle?: string;
  email: string;
}

interface Property {
  id: string;
  name: string;
  address: string;
  contract_template?: {
    landlord_signature?: string;
  };
  contact_info?: any;
  status?: string;
  house_rules?: string[];
}

interface Booking {
  id: string;
  property_id: string;
  check_in_date: string;
  check_out_date: string;
  number_of_guests: number;
  booking_reference?: string;
  property: Property;
  guests: Guest[];
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('🚀 generate-police-forms function started');

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
    console.log('📥 Request data:', requestData);

    const { bookingId, booking: previewBooking } = requestData;

    let booking: Booking;

    if (bookingId) {
      // Mode normal : récupérer depuis la base de données
      console.log('📋 Mode normal : récupération depuis DB avec bookingId:', bookingId);
      booking = await fetchBookingFromDatabase(client, bookingId);
    } else if (previewBooking) {
      // Mode aperçu : utiliser les données fournies directement
      console.log('👁️ Mode aperçu : utilisation des données fournies directement');
      booking = previewBooking;
    } else {
      return new Response(JSON.stringify({
        success: false,
        message: 'bookingId ou données de booking requises'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (!booking.property) {
      return new Response(JSON.stringify({
        success: false,
        message: 'Property not found for booking'
      }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Validate guests for police forms
    const guests = booking.guests || [];
    if (guests.length === 0) {
      console.error('❌ Cannot generate police forms: no guests found');
      return new Response(JSON.stringify({
        error: 'Aucun invité trouvé pour générer les fiches de police',
        code: 'NO_GUESTS_FOUND'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Validate that each guest has minimal required data
    const invalidGuests = guests.filter(guest => 
      !guest.full_name?.trim() || !guest.document_number?.trim()
    );
    
    if (invalidGuests.length > 0) {
      console.error('❌ Invalid guest data found:', invalidGuests);
      return new Response(JSON.stringify({
        error: `${invalidGuests.length} invité(s) ont des données incomplètes`,
        code: 'INCOMPLETE_GUEST_DATA',
        details: invalidGuests.map(g => ({
          name: g.full_name,
          docNumber: g.document_number
        }))
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log(`📋 Generating police forms for ${guests.length} validated guests`);

    // Generate police forms avec la logique complète
    const documentUrl = await generatePoliceFormsPDF(client, booking);
    
    // ✅ CORRECTION : Ne sauvegarder en base que si bookingId existe (mode normal, pas preview)
    let documentRecord = null;
    if (booking.id) {
      try {
        documentRecord = await saveDocumentToDatabase(
          client, 
          booking.id, 
          'police', 
          documentUrl
        );
      } catch (saveError) {
        console.warn('⚠️ Failed to save document to database (preview mode?):', saveError);
        // En mode preview, on continue quand même sans sauvegarder
      }
    } else {
      console.log('👁️ Mode preview : document généré sans sauvegarde en base');
    }

    return new Response(JSON.stringify({
      success: true,
      message: `Generated ${guests.length} police form(s) successfully`,
      documentUrl: documentUrl,          // ✅ Format principal (singular)
      documentUrls: [documentUrl],       // ✅ Rétrocompatibilité (plural)
      documentId: documentRecord?.id || null,
      guestsCount: guests.length
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('❌ Error in generate-police-forms:', error);
    return new Response(JSON.stringify({
      success: false,
      message: error instanceof Error ? error.message : 'Erreur inconnue'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

// Fetch booking from database with enriched guest data
async function fetchBookingFromDatabase(client: any, bookingId: string): Promise<Booking> {
  const { data: dbBooking, error: bookingError } = await client
    .from('bookings')
    .select(`
      *,
      property:properties(*),
      guests(*)
    `)
    .eq('id', bookingId)
    .single();

  if (bookingError || !dbBooking) {
    throw new Error('Booking not found');
  }

  // ✅ CORRECTION : Utiliser les données de la table guests comme source principale
  // Les données sont maintenant correctement synchronisées via submit-guest-info
  console.log('📋 Utilisation des données de la table guests (source principale)');
  
  // Vérifier si nous avons des invités dans la table guests
  if (!dbBooking.guests || dbBooking.guests.length === 0) {
    console.log('⚠️ Aucun invité trouvé dans la table guests, tentative de récupération depuis guest_submissions...');
    
    try {
      const { data: submissions } = await client
        .from('v_guest_submissions')
        .select('guest_data, document_urls')
        .eq('booking_id', bookingId)
        .order('created_at', { ascending: false });

      if (submissions && submissions.length > 0) {
        const realGuests: Guest[] = [];
        
        for (const submission of submissions) {
          if (submission.guest_data && submission.guest_data.guests) {
            for (const guest of submission.guest_data.guests) {
              const guestName = guest.fullName || guest.full_name || '';
              const documentNumber = guest.documentNumber || guest.document_number || '';
              
              if (!guestName.trim() || !documentNumber.trim()) {
                continue;
              }
              
              realGuests.push({
                full_name: guestName.trim(),
                date_of_birth: guest.dateOfBirth || guest.date_of_birth || '',
                document_number: documentNumber.trim(),
                nationality: guest.nationality || 'Non spécifiée',
                document_type: guest.documentType || guest.document_type || 'passport',
                place_of_birth: guest.placeOfBirth || guest.place_of_birth || '',
                profession: guest.profession || '',
                motif_sejour: guest.motif_sejour || 'TOURISME',
                adresse_personnelle: guest.adresse_personnelle || '',
                email: guest.email || ''
              });
            }
          }
        }

        if (realGuests.length > 0) {
          dbBooking.guests = realGuests;
          console.log(`✅ ${realGuests.length} invités récupérés depuis guest_submissions (fallback)`);
        }
      }
    } catch (fallbackError) {
      console.error('❌ Error in fallback guest data retrieval:', fallbackError);
    }
  } else {
    console.log(`✅ ${dbBooking.guests.length} invités trouvés dans la table guests`);
  }

  return dbBooking;
}

// Save document to database
async function saveDocumentToDatabase(
  client: any, 
  bookingId: string, 
  documentType: string, 
  documentUrl: string
) {
  const fileName = `${documentType}-${bookingId}-${Date.now()}.pdf`;
  
  const { data: documentRecord, error } = await client
    .from('uploaded_documents')
    .insert({
      booking_id: bookingId,
      file_name: fileName,
      document_url: documentUrl,
      document_type: documentType,
      is_signed: false,
      processing_status: 'completed'
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to save document to database: ${error.message}`);
  }

  return documentRecord;
}

// Generate police forms PDF - Format officiel marocain bilingue EXACT
async function generatePoliceFormsPDF(booking: Booking): Promise<string> {
  console.log('📄 Creating police forms PDF...');
  
  const { PDFDocument, StandardFonts, rgb } = await import('https://esm.sh/pdf-lib@1.17.1');
  
  const guests = booking.guests || [];
  const property = booking.property || {};
  const pdfs: Uint8Array[] = [];
  
  for (const guest of guests) {
    const pdfDoc = await PDFDocument.create();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    
    const fontSize = 10;
    const titleFontSize = 14;
    const pageWidth = 595.28;
    const pageHeight = 841.89;
    const margin = 40;
    const lineHeight = 14;
    
    const page = pdfDoc.addPage([pageWidth, pageHeight]);
    let yPosition = pageHeight - 50;
    
    // Header
    page.drawText('ROYAUME DU MAROC', {
      x: (pageWidth - boldFont.widthOfTextAtSize('ROYAUME DU MAROC', titleFontSize)) / 2,
      y: yPosition,
      size: titleFontSize,
      font: boldFont
    });
    yPosition -= 20;
    
    page.drawText('PRÉFECTURE / PROVINCE', {
      x: (pageWidth - font.widthOfTextAtSize('PRÉFECTURE / PROVINCE', fontSize)) / 2,
      y: yPosition,
      size: fontSize,
      font: font
    });
    yPosition -= 40;
    
    // Title
    page.drawText('FICHE INDIVIDUELLE', {
      x: (pageWidth - boldFont.widthOfTextAtSize('FICHE INDIVIDUELLE', titleFontSize)) / 2,
      y: yPosition,
      size: titleFontSize,
      font: boldFont
    });
    yPosition -= 20;
    
    page.drawText('DÉCLARATION D\'ARRIVÉE D\'UN ÉTRANGER DANS UN ÉTABLISSEMENT D\'HÉBERGEMENT', {
      x: (pageWidth - font.widthOfTextAtSize('DÉCLARATION D\'ARRIVÉE D\'UN ÉTRANGER DANS UN ÉTABLISSEMENT D\'HÉBERGEMENT', fontSize)) / 2,
      y: yPosition,
      size: fontSize,
      font: font
    });
    yPosition -= 40;
    
    // Form fields
    const leftColumn = margin;
    
    // Guest information
    yPosition = drawField(page, 'NOM:', guest.full_name?.split(' ').slice(-1)[0] || '', leftColumn, yPosition, font, boldFont, fontSize);
    yPosition = drawField(page, 'PRÉNOM(S):', guest.full_name?.split(' ').slice(0, -1).join(' ') || '', leftColumn, yPosition, font, boldFont, fontSize);
    
    const fmt = (v: any) => {
      if (!v) return '';
      const d = new Date(v);
      return isNaN(d.getTime()) ? '' : d.toLocaleDateString('fr-FR');
    };
    
    const birthDate = fmt(guest.date_of_birth);
    yPosition = drawField(page, 'DATE DE NAISSANCE:', birthDate, leftColumn, yPosition, font, boldFont, fontSize);
    yPosition = drawField(page, 'LIEU DE NAISSANCE:', guest.place_of_birth || '', leftColumn, yPosition, font, boldFont, fontSize);
    
    // Document info
    yPosition = drawField(page, 'NATIONALITÉ:', guest.nationality || '', leftColumn, yPosition, font, boldFont, fontSize);
    yPosition = drawField(page, 'TYPE DE DOCUMENT:', guest.document_type === 'passport' ? 'PASSEPORT' : 'CNI', leftColumn, yPosition, font, boldFont, fontSize);
    yPosition = drawField(page, 'NUMÉRO DU DOCUMENT:', guest.document_number || '', leftColumn, yPosition, font, boldFont, fontSize);
    
    // Profession
    yPosition = drawField(page, 'PROFESSION:', guest.profession || '', leftColumn, yPosition, font, boldFont, fontSize);
    
    // Establishment info
    yPosition -= 20;
    const checkInDate = fmt(booking.check_in_date);
    const checkOutDate = fmt(booking.check_out_date);
    yPosition = drawField(page, 'ÉTABLISSEMENT:', property.name || '', leftColumn, yPosition, font, boldFont, fontSize);
    yPosition = drawField(page, 'ADRESSE:', property.address || '', leftColumn, yPosition, font, boldFont, fontSize);
    yPosition = drawField(page, 'DATE D\'ARRIVÉE:', checkInDate, leftColumn, yPosition, font, boldFont, fontSize);
    yPosition = drawField(page, 'DATE DE DÉPART PRÉVUE:', checkOutDate, leftColumn, yPosition, font, boldFont, fontSize);
    
    // Purpose of visit
    yPosition -= 20;
    yPosition = drawField(page, 'MOTIF DU SÉJOUR:', guest.motif_sejour || 'TOURISME', leftColumn, yPosition, font, boldFont, fontSize);
    yPosition = drawField(page, 'ADRESSE AU MAROC:', guest.adresse_personnelle || property.address || '', leftColumn, yPosition, font, boldFont, fontSize);
    yPosition = drawField(page, 'COURRIEL:', guest.email || '', leftColumn, yPosition, font, boldFont, fontSize);
    
    // Signature section
    yPosition -= 40;
    page.drawText('DATE ET SIGNATURE DU RESPONSABLE DE L\'ÉTABLISSEMENT:', {
      x: leftColumn,
      y: yPosition,
      size: fontSize,
      font: boldFont
    });
    
    // Try to add landlord signature image if available
    try {
      const contractTemplate = property.contract_template || {};
      const landlordSignature = contractTemplate.landlord_signature;
      if (landlordSignature && landlordSignature.trim()) {
        try {
          // Vérifier que c'est une data URL valide
          if (!landlordSignature.startsWith('data:image/')) {
            throw new Error('Invalid signature format');
          }
          
          const clean = landlordSignature.replace(/^data:image\/[^;]+;base64,/, '');
          
          // Vérifier que le base64 est valide
          if (!clean || clean.length === 0) {
            throw new Error('Empty base64 data');
          }
          
          let img;
          try {
            img = await pdfDoc.embedPng(Uint8Array.from(atob(clean), (c) => c.charCodeAt(0)));
          } catch {
            try {
              img = await pdfDoc.embedJpg(Uint8Array.from(atob(clean), (c) => c.charCodeAt(0)));
            } catch {
              throw new Error('Failed to decode image');
            }
          }
          
          // ✅ CORRIGÉ : Dimensions limitées pour éviter le débordement
          // Calculer la largeur disponible (pageWidth - 2*margin)
          const pageWidth = page.getWidth();
          const margin = 50; // Marge standard
          const availableWidth = pageWidth - (margin * 2);
          // Limiter maxWidth à 80% de la largeur disponible
          const maxWidth = Math.min(180, availableWidth * 0.8);
          const maxHeight = 60; // Réduit pour éviter le débordement vertical
          
          const aspect = img.width / img.height;
          let width = Math.min(maxWidth, img.width);
          let height = width / aspect;
          if (height > maxHeight) {
            height = maxHeight;
            width = maxHeight * aspect;
          }
          
          // ✅ NOUVEAU : Vérifier que la signature ne déborde pas à droite
          const signatureX = leftColumn;
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
            console.warn('⚠️ Signature débordait, dimensions réduites:', {
              originalWidth: width,
              originalHeight: height,
              finalWidth,
              finalHeight,
              overflow
            });
          }
          
          page.drawImage(img, {
            x: signatureX,
            y: yPosition - finalHeight - 10,
            width: finalWidth,
            height: finalHeight
          });
          console.log('✅ Landlord signature embedded');
        } catch (signatureError) {
          console.warn('⚠️ Skipped landlord signature (invalid format):', signatureError.message);
          // Continuer sans la signature
        }
      } else {
        console.log('ℹ️ No landlord signature');
      }
    } catch (e) {
      console.warn('⚠️ Signature section error:', e.message);
    }
    
    yPosition -= 60;
    const currentDate = new Date().toLocaleDateString('fr-FR');
    page.drawText(`Date: ${currentDate}`, {
      x: leftColumn,
      y: yPosition,
      size: fontSize,
      font: font
    });
    
    // Add border
    page.drawRectangle({
      x: margin - 10,
      y: margin - 10,
      width: pageWidth - 2 * (margin - 10),
      height: pageHeight - 2 * (margin - 10),
      borderColor: rgb(0, 0, 0),
      borderWidth: 1
    });
    
    pdfs.push(await pdfDoc.save());
  }
  
  // Return the first PDF as a data URL (for simplicity)
  if (pdfs.length === 0) {
    throw new Error('No police forms generated');
  }
  
  const pdfBytes = pdfs[0];
  let binary = '';
  const bytes = new Uint8Array(pdfBytes);
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  const base64PDF = btoa(binary);
  return `data:application/pdf;base64,${base64PDF}`;
}

function drawField(page: any, label: string, value: string, x: number, y: number, font: any, boldFont: any, fontSize: number) {
  page.drawText(label, {
    x: x,
    y: y,
    size: fontSize,
    font: boldFont
  });
  
  const labelWidth = boldFont.widthOfTextAtSize(label, fontSize);
  const valueX = x + labelWidth + 10;
  
  page.drawText(value || '................................', {
    x: valueX,
    y: y,
    size: fontSize,
    font: font
  });
  
  return y - 20;
}