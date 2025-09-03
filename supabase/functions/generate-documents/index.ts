// Uses getServerClient() with SB_URL/SB_SERVICE_ROLE_KEY and SUPABASE_* fallbacks.
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { getServerClient } from '../_shared/serverClient.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  try {
    // Handle CORS preflight requests
    if (req.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    const requestData = await req.json();
    
    // Handle both new and legacy request formats
    let bookingId: string | undefined, documentType: string = 'contract', signatureData: string | undefined, signedAt: string | undefined;
    let incomingBooking: any | undefined;
    
    if (requestData.bookingId) {
      bookingId = requestData.bookingId;
      documentType = requestData.documentType || 'contract';
      signatureData = requestData.signatureData;
      signedAt = requestData.signedAt;
    } else if (requestData.booking) {
      incomingBooking = requestData.booking;
      bookingId = incomingBooking?.id;
      documentType = requestData.documentType || 'contract'; // Use provided documentType or default to contract
      signatureData = requestData.signatureData;
      signedAt = requestData.signedAt;
    } else {
      throw new Error('Invalid request format');
    }

    // Determine whether to run in normal or preview mode
    const hasValidId = typeof bookingId === 'string' && bookingId.trim() !== '' && bookingId !== 'preview';
    const previewMode = !!incomingBooking && !hasValidId;

    let booking: any;

    if (previewMode) {
      // Use provided booking directly (preview mode) and normalize minimal fields expected by generators
      const normalizePreviewBooking = (b: any) => {
        const property = b.property || {};
        const guests = Array.isArray(b.guests) ? b.guests : [];
        const mapGuest = (g: any) => ({
          full_name: g.full_name ?? g.fullName ?? '',
          date_of_birth: g.date_of_birth ?? g.dateOfBirth ?? '',
          document_number: g.document_number ?? g.documentNumber ?? '',
          nationality: g.nationality ?? '',
          document_type: g.document_type ?? g.documentType ?? '',
          place_of_birth: g.place_of_birth ?? g.placeOfBirth ?? '',
        });
        return {
          ...b,
          check_in_date: b.check_in_date ?? b.checkInDate ?? b.checkinDate,
          check_out_date: b.check_out_date ?? b.checkOutDate ?? b.checkoutDate,
          number_of_guests: b.number_of_guests ?? b.numberOfGuests ?? (guests.length || 1),
          property: {
            ...(property || {}),
            id: property.id ?? b.property_id ?? b.propertyId ?? 'preview',
            name: property.name ?? b.propertyName ?? 'Propriété',
            address: property.address ?? b.propertyAddress ?? '',
            contract_template: property.contract_template ?? b.contract_template ?? property.contractTemplate,
            contact_info: property.contact_info ?? property.contactInfo ?? b.contact_info,
            status: property.status ?? b.property_status ?? b.propertyStatus ?? b.status,
            house_rules: property.house_rules ?? property.houseRules ?? [],
          },
          guests: guests.map(mapGuest),
        };
      };

      booking = normalizePreviewBooking(incomingBooking);
      console.log('🟡 Preview mode: using provided booking without DB fetch');
      console.log('🔍 Normalized booking property:', booking.property);
      console.log('🔍 Normalized contract_template:', booking.property.contract_template);
    } else {
      // Create service-role client
      const server = await getServerClient();

      const idToFetch = bookingId || incomingBooking?.id;

      // Get booking data with guests and property details using service-role client
      const { data: bookings, error } = await server
        .from('bookings')
        .select('*,property:properties(*),guests(*)')
        .eq('id', idToFetch);

      if (error || !bookings || bookings.length === 0) {
        throw new Error(`Failed to fetch booking data: ${error?.message || 'Booking not found'}`);
      }

      booking = bookings[0];
      
      // IMPORTANT: Enrich with real guest data from guest_submissions
      console.log('🔍 Fetching real guest data from submissions...');
      try {
        const { data: submissions } = await server
          .from('v_guest_submissions')
          .select('guest_data, document_urls')
          .eq('booking_id', idToFetch)
          .order('created_at', { ascending: false });
          
        if (submissions && submissions.length > 0) {
          console.log('✅ Found guest submissions, enriching booking data...');
          
          // ✅ CORRECTION: Extraction et validation sécurisée des données d'invités
          const realGuests = [];
          for (const submission of submissions) {
            if (submission.guest_data && submission.guest_data.guests) {
              // Handle array of guests with validation
              for (const guest of submission.guest_data.guests) {
                // Validation des données requises
                const guestName = guest.fullName || guest.full_name || '';
                const documentNumber = guest.documentNumber || guest.document_number || '';
                
                if (!guestName.trim() || !documentNumber.trim()) {
                  console.warn('⚠️ Skipping incomplete guest data:', { guestName, documentNumber });
                  continue;
                }

                realGuests.push({
                  full_name: guestName.trim(),
                  date_of_birth: guest.dateOfBirth || guest.date_of_birth || '',
                  document_number: documentNumber.trim(),
                  nationality: guest.nationality || 'Non spécifiée',
                  document_type: guest.documentType || guest.document_type || 'passport',
                  place_of_birth: guest.placeOfBirth || guest.place_of_birth || ''
                });
              }
            }
          }
          
          // ✅ CORRECTION: Enrichissement sécurisé avec fallback intelligent
          if (realGuests.length > 0) {
            // Conserver les invités existants de la DB si ils sont plus complets
            const existingGuests = booking.guests || [];
            
            // Comparer et choisir la source la plus complète
            if (existingGuests.length > 0 && realGuests.length > 0) {
              console.log('🔍 Comparing guest data sources:', {
                existing: existingGuests.length,
                fromSubmissions: realGuests.length
              });
              
              // Utiliser les soumissions si elles contiennent plus d'informations complètes
              const completeSubmissionGuests = realGuests.filter(g => 
                g.full_name && g.document_number && g.nationality !== 'Non spécifiée'
              );
              
              if (completeSubmissionGuests.length >= existingGuests.length) {
                booking.guests = realGuests;
                console.log(`✅ Using submission data: ${realGuests.length} guests`);
              } else {
                console.log(`✅ Keeping existing DB data: ${existingGuests.length} guests`);
              }
            } else {
              booking.guests = realGuests;
              console.log(`✅ Enriched booking with ${realGuests.length} real guests`);
            }
          }
        } else {
          console.log('❌ No guest submissions found, using booking.guests as fallback');
        }
      } catch (enrichError) {
        console.error('❌ Error enriching with guest submissions:', enrichError);
      }
    }

    if (documentType === 'police') {
      // ✅ CORRECTION: Validation avant génération des fiches de police
      const guests = booking.guests || [];
      if (guests.length === 0) {
        console.error('❌ Cannot generate police forms: no guests found');
        return new Response(
          JSON.stringify({ 
            error: 'Aucun invité trouvé pour générer les fiches de police',
            code: 'NO_GUESTS_FOUND'
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Valider que chaque invité a les données minimales requises
      const invalidGuests = guests.filter(guest => 
        !guest.full_name?.trim() || !guest.document_number?.trim()
      );

      if (invalidGuests.length > 0) {
        console.error('❌ Invalid guest data found:', invalidGuests);
        return new Response(
          JSON.stringify({ 
            error: `${invalidGuests.length} invité(s) ont des données incomplètes`,
            code: 'INCOMPLETE_GUEST_DATA',
            details: invalidGuests.map(g => ({ name: g.full_name, docNumber: g.document_number }))
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Import PDF-lib dynamically for police forms
      const { PDFDocument, StandardFonts, rgb } = await import('https://esm.sh/pdf-lib@1.17.1');
      
      console.log(`📋 Generating police forms for ${guests.length} validated guests`);
      const policeFormPDFs = await generatePoliceFormsPDF(booking, PDFDocument, StandardFonts, rgb);
      
      const documentUrls = policeFormPDFs.map((pdfBytes, index) => {
        // ✅ CORRECTION: Conversion sécurisée des bytes en base64
        let binary = '';
        const bytes = new Uint8Array(pdfBytes);
        for (let i = 0; i < bytes.byteLength; i++) {
          binary += String.fromCharCode(bytes[i]);
        }
        const base64PDF = btoa(binary);
        return `data:application/pdf;base64,${base64PDF}`;
      });
      
      return new Response(
        JSON.stringify({ 
          success: true, 
          documents: policeFormPDFs.map((_, index) => ({ 
            type: 'police', 
            fileName: `fiche-police-${booking.guests[index]?.full_name || `guest-${index + 1}`}-${Date.now()}.pdf` 
          })),
          documentUrls: documentUrls,
          message: `Generated ${policeFormPDFs.length} police form(s) successfully`
        }),
        { 
          status: 200, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    } else if (documentType === 'contract') {
      // Import PDF-lib dynamically to avoid import errors
      const { PDFDocument, StandardFonts, rgb } = await import('https://esm.sh/pdf-lib@1.17.1');
      
      // Fetch guest signature if not in preview mode
      let guestSignatureUrl = signatureData;
      let signerInfo = null;
      
      if (!previewMode && bookingId) {
        console.log('🔍 Fetching guest signature for booking:', bookingId);
        try {
          const server = await getServerClient();
          const { data: sig, error: sigError } = await server
            .from('contract_signatures')
            .select('signature_data, signer_name, signed_at, created_at')
            .eq('booking_id', bookingId)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();
          
          console.log('🔍 Guest signature query result:', {
            found: !!sig,
            error: sigError?.message,
            hasSignatureData: !!sig?.signature_data,
            signerName: sig?.signer_name,
            signedAt: sig?.signed_at
          });
          
          if (sig) {
            guestSignatureUrl = sig.signature_data ?? guestSignatureUrl;
            signerInfo = sig;
            console.log('✅ Guest signature found and set');
          } else {
            console.log('❌ No guest signature found in database');
          }
        } catch (error) {
          console.error('❌ Failed to fetch guest signature:', error);
        }
      } else {
        console.log('🔍 Skipping signature fetch:', { previewMode, hasBookingId: !!bookingId });
      }
      
      const contractPDF = await generateContractPDF(booking, guestSignatureUrl, signedAt || signerInfo?.signed_at, PDFDocument, StandardFonts, rgb, signerInfo);
      
      // ✅ CORRECTION: Convert PDF to data URL for direct download
      let binary = '';
      const bytes = new Uint8Array(contractPDF);
      for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      const base64PDF = btoa(binary);
      const dataUrl = `data:application/pdf;base64,${base64PDF}`;
      
      const fileName = guestSignatureUrl 
        ? `signed-contract-${booking.booking_reference || 'GUEST'}-${Date.now()}.pdf`
        : `contract-${booking.id}.pdf`;
      
      return new Response(
        JSON.stringify({ 
          success: true, 
          documents: [{ type: 'contract', fileName: fileName, signed: !!guestSignatureUrl }],
          documentUrls: [dataUrl],
          message: `Generated contract successfully`
        }),
        { 
          status: 200, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        documents: [],
        message: `No documents generated`
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('❌ Error generating documents:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

// Unicode font loading (cached across invocations)
let cachedUnicodeFonts: { regular: Uint8Array; bold: Uint8Array } | null = null;

async function loadUnicodeFontBytes() {
  const regularUrl = 'https://github.com/dejavu-fonts/dejavu-fonts/raw/version_2_37/ttf/DejaVuSans.ttf';
  const boldUrl = 'https://github.com/dejavu-fonts/dejavu-fonts/raw/version_2_37/ttf/DejaVuSans-Bold.ttf';
  const [regRes, boldRes] = await Promise.all([fetch(regularUrl), fetch(boldUrl)]);
  if (!regRes.ok || !boldRes.ok) {
    throw new Error('Failed to fetch Unicode fonts');
  }
  const [regBuf, boldBuf] = await Promise.all([regRes.arrayBuffer(), boldRes.arrayBuffer()]);
  return { regular: new Uint8Array(regBuf), bold: new Uint8Array(boldBuf) };
}

async function getUnicodeFonts() {
  if (!cachedUnicodeFonts) {
    try {
      cachedUnicodeFonts = await loadUnicodeFontBytes();
    } catch (e) {
      console.error('⚠️ Failed to load Unicode fonts, will fallback to StandardFonts:', e);
      cachedUnicodeFonts = null;
    }
  }
  return cachedUnicodeFonts;
}

function sanitizeText(text: any): string {
  try {
    const str = String(text ?? '');
    return str
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // strip diacritics
      .replace(/[“”„]/g, '"')
      .replace(/[’‘]/g, "'")
      .replace(/[\u2013\u2014]/g, '-');
  } catch {
    return String(text ?? '');
  }
}

async function generateContractPDF(booking: any, signatureData?: string, signedAt?: string, PDFDocument?: any, StandardFonts?: any, rgb?: any, signerInfo?: any): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  let font: any;
  let boldFont: any;
  const fonts = await getUnicodeFonts().catch(() => null);
  if (fonts) {
    font = await pdfDoc.embedFont(fonts.regular, { subset: true });
    boldFont = await pdfDoc.embedFont(fonts.bold, { subset: true });
  } else {
    font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  }
  
  const fontSize = 11;
  const titleFontSize = 18;
  const pageWidth = 595.28;
  const pageHeight = 841.89;
  const margin = 50;
  const lineHeight = 16;
  
  // Extract dynamic data
  const contractTemplate = booking.property?.contract_template || {};
  const property = booking.property || {};
  const guests = booking.guests || [];
  const mainGuest = guests[0] || {};
  
  console.log('🔍 Contract generation - contractTemplate:', contractTemplate);
  console.log('🔍 Contract generation - property status:', property.status);
  
  // Company information
  const companyName = contractTemplate.landlord_company || 'Société';
  const companyRegistration = contractTemplate.landlord_registration || 'N/A';
  const companyAddress = contractTemplate.landlord_address || 'Adresse non renseignée';
  const landlordName = contractTemplate.landlord_name || 'Propriétaire';
  
  // Property information
  const propertyName = property.name || 'Propriété';
  const propertyAddress = property.address || 'Adresse de la propriété';
  
  // Booking information
  const fmt = (v: any) => {
    if (!v) return '';
    const d = new Date(v);
    return isNaN(d.getTime()) ? '' : d.toLocaleDateString('fr-FR');
  };
  const checkInDate = fmt(booking.check_in_date);
  const checkOutDate = fmt(booking.check_out_date);
  const currentDate = new Date().toLocaleDateString('fr-FR');
  const guestCount = booking.number_of_guests || guests.length || 1;
  
  // Main guest information
  const guestName = mainGuest.full_name || '_________________';
  const guestBirthDate = fmt(mainGuest.date_of_birth) || '__/__/____';
  const guestDocNumber = mainGuest.document_number || '_________________';
  const guestNationality = mainGuest.nationality || '_________________';
  
  // Helper function for text wrapping
  function wrapText(text: string, maxWidth: number, fontSize: number, font: any): string[] {
    const words = text.split(' ');
    const lines: string[] = [];
    let currentLine = '';
    
    for (const word of words) {
      const testLine = currentLine + (currentLine ? ' ' : '') + word;
      const testWidth = font.widthOfTextAtSize(testLine, fontSize);
      
      if (testWidth <= maxWidth) {
        currentLine = testLine;
      } else {
        if (currentLine) lines.push(currentLine);
        currentLine = word;
      }
    }
    if (currentLine) lines.push(currentLine);
    return lines;
  }
  
  // Helper function to draw wrapped text
  function drawWrappedText(page: any, text: string, x: number, y: number, maxWidth: number, fontSize: number, font: any): number {
    const lines = wrapText(text, maxWidth, fontSize, font);
    let currentY = y;
    
    lines.forEach(line => {
      page.drawText(line, {
        x: x,
        y: currentY,
        size: fontSize,
        font: font,
      });
      currentY -= lineHeight;
    });
    
    return currentY;
  }
  
  // Start document
  let page = pdfDoc.addPage([pageWidth, pageHeight]);
  let yPosition = pageHeight - 60;
  
  // HEADER - TITLE
  page.drawText('CONTRAT DE LOCATION MEUBLEE DE COURTE DUREE', {
    x: (pageWidth - boldFont.widthOfTextAtSize('CONTRAT DE LOCATION MEUBLEE DE COURTE DUREE', titleFontSize)) / 2,
    y: yPosition,
    size: titleFontSize,
    font: boldFont,
  });
  yPosition -= 40;
  
  // Decorative line
  page.drawLine({
    start: { x: margin, y: yPosition },
    end: { x: pageWidth - margin, y: yPosition },
    thickness: 2,
    color: rgb(0.2, 0.2, 0.2),
  });
  yPosition -= 40;
  
  // PARTIES SECTION
  page.drawText('ENTRE LES SOUSSIGNÉS :', {
    x: margin,
    y: yPosition,
    size: fontSize + 1,
    font: boldFont,
  });
  yPosition -= 30;
  
  // LANDLORD SECTION
  page.drawText('LE BAILLEUR :', {
    x: margin,
    y: yPosition,
    size: fontSize,
    font: boldFont,
  });
  yPosition -= 20;
  
  const landlordStatus = (contractTemplate.statut || contractTemplate.landlord_status || property.status || '').toLowerCase();
  console.log('🔍 Landlord status determination:', {
    'contractTemplate.statut': contractTemplate.statut,
    'contractTemplate.landlord_status': contractTemplate.landlord_status,
    'property.status': property.status,
    'final landlordStatus': landlordStatus
  });
  
  const landlordText = landlordStatus === 'particulier'
    ? `${landlordName}, Gestionnaire et/ou propriétaire du bien, ci-après dénommée "Le Bailleur"`
    : `${companyName.toUpperCase()}, société enregistrée sous le numéro ${companyRegistration}, ayant son siège social situé ${companyAddress}, représentée par ${landlordName}, ci-après dénommée "Le Bailleur"`;
  
  console.log('🔍 Generated landlord text:', landlordText);
  yPosition = drawWrappedText(page, landlordText, margin + 10, yPosition, pageWidth - 2 * margin - 20, fontSize, font) - 10;
  
  // TENANT SECTION
  page.drawText('LE LOCATAIRE :', {
    x: margin,
    y: yPosition,
    size: fontSize,
    font: boldFont,
  });
  yPosition -= 20;
  
  const tenantText = `${guestName}, né(e) le ${guestBirthDate}, de nationalité ${guestNationality}, titulaire du document d'identité n° ${guestDocNumber}, ci-après dénommé(e) "Le Locataire"`;
  yPosition = drawWrappedText(page, tenantText, margin + 10, yPosition, pageWidth - 2 * margin - 20, fontSize, font) - 20;
  
  // Check if new page is needed
  if (yPosition < 200) {
    page = pdfDoc.addPage([pageWidth, pageHeight]);
    yPosition = pageHeight - 60;
  }
  
  // ARTICLE 1 - OBJET
  page.drawText('ARTICLE 1 - OBJET DE LA LOCATION', {
    x: margin,
    y: yPosition,
    size: fontSize + 1,
    font: boldFont,
  });
  yPosition -= 20;
  
  const objectText = `Le présent contrat a pour objet la location meublée de courte durée du bien immobilier suivant : ${propertyName}, situé ${propertyAddress}. Le logement est loué entièrement meublé et équipé pour un usage d'habitation temporaire.`;
  yPosition = drawWrappedText(page, objectText, margin, yPosition, pageWidth - 2 * margin, fontSize, font) - 15;
  
  // ARTICLE 2 - DURÉE
  page.drawText('ARTICLE 2 - DURÉE ET PÉRIODE', {
    x: margin,
    y: yPosition,
    size: fontSize + 1,
    font: boldFont,
  });
  yPosition -= 20;
  
  const durationText = `La location est consentie pour une durée déterminée du ${checkInDate} à 16h00 au ${checkOutDate} à 11h00. Cette période ne pourra être prolongée qu'avec l'accord écrit préalable du Bailleur.`;
  yPosition = drawWrappedText(page, durationText, margin, yPosition, pageWidth - 2 * margin, fontSize, font) - 15;
  
  // ARTICLE 3 - OCCUPANTS
  page.drawText('ARTICLE 3 - OCCUPANTS AUTORISÉS', {
    x: margin,
    y: yPosition,
    size: fontSize + 1,
    font: boldFont,
  });
  yPosition -= 20;
  
  const occupantsText = `Le logement sera occupé par ${guestCount} personne(s) maximum. Liste des occupants autorisés :`;
  yPosition = drawWrappedText(page, occupantsText, margin, yPosition, pageWidth - 2 * margin, fontSize, font) - 10;
  
  // List guests
  guests.slice(0, 6).forEach((guest, index) => {
    const guestBirthDate = fmt(guest.date_of_birth) || '__/__/____';
    const guestInfo = `${index + 1}. ${guest.full_name || '_______________'} - Né(e) le ${guestBirthDate} - Document n° ${guest.document_number || '_______________'}`;
    yPosition = drawWrappedText(page, guestInfo, margin + 15, yPosition, pageWidth - 2 * margin - 30, fontSize - 1, font) - 5;
  });
  
  // Add empty slots if needed
  for (let i = guests.length; i < Math.max(2, guestCount); i++) {
    const emptySlot = `${i + 1}. _______________ - Né(e) le __/__/____ - Document n° _______________`;
    yPosition = drawWrappedText(page, emptySlot, margin + 15, yPosition, pageWidth - 2 * margin - 30, fontSize - 1, font) - 5;
  }
  
  const unauthorizedText = "Toute personne non mentionnée ci-dessus est strictement interdite dans le logement.";
  yPosition = drawWrappedText(page, unauthorizedText, margin, yPosition - 10, pageWidth - 2 * margin, fontSize, font) - 20;
  
  // Check if new page is needed
  if (yPosition < 300) {
    page = pdfDoc.addPage([pageWidth, pageHeight]);
    yPosition = pageHeight - 60;
  }
  
  // ARTICLE 4 - REGLEMENT INTERIEUR
  page.drawText('ARTICLE 4 - REGLEMENT INTERIEUR ET OBLIGATIONS', {
    x: margin,
    y: yPosition,
    size: fontSize + 1,
    font: boldFont,
  });
  yPosition -= 20;
  // Use dynamic house rules from property or fallback to defaults
  const propertyRules = property.house_rules || [];
  const defaultRules = [
    "Respect absolu du voisinage et des parties communes de l'immeuble",
    "Interdiction formelle d'organiser des fêtes, événements ou de faire du bruit excessif", 
    "Interdiction de fumer à l'intérieur du logement (balcons et terrasses autorisés)",
    "Interdiction d'inviter des personnes non déclarées sans autorisation écrite préalable",
    "Obligation de maintenir le logement en parfait état de propreté",
    "Signalement immédiat de tout dommage ou dysfonctionnement",
    "Respect des équipements et du mobilier mis à disposition",
    "Tri et évacuation des déchets selon les règles locales"
  ];
  
  const rules = propertyRules.length > 0 ? propertyRules : defaultRules;
  
  rules.forEach(rule => {
    const ruleText = `• ${rule}`;
    yPosition = drawWrappedText(page, ruleText, margin, yPosition, pageWidth - 2 * margin, fontSize, font) - 8;
  });
  
  const violationText = "Tout manquement à ces règles pourra entraîner la résiliation immédiate du contrat aux torts exclusifs du Locataire.";
  yPosition = drawWrappedText(page, violationText, margin, yPosition - 10, pageWidth - 2 * margin, fontSize, font) - 20;
  
  // ARTICLE 5 - RESPONSABILITÉS
  page.drawText('ARTICLE 5 - RESPONSABILITÉS ET ASSURANCES', {
    x: margin,
    y: yPosition,
    size: fontSize + 1,
    font: boldFont,
  });
  yPosition -= 20;
  
  const responsabilityText = "Le Locataire est entièrement responsable de tout dommage causé au logement, aux équipements et au mobilier. Il s'engage à restituer le bien dans l'état où il l'a trouvé. Le Bailleur décline toute responsabilité en cas de vol, perte ou dommage aux effets personnels du Locataire.";
  yPosition = drawWrappedText(page, responsabilityText, margin, yPosition, pageWidth - 2 * margin, fontSize, font) - 20;
  
  // ARTICLE 6 - RÉSILIATION
  page.drawText('ARTICLE 6 - RÉSILIATION', {
    x: margin,
    y: yPosition,
    size: fontSize + 1,
    font: boldFont,
  });
  yPosition -= 20;
  
  const terminationText = "En cas de non-respect des présentes conditions, le Bailleur se réserve le droit de procéder à la résiliation immédiate du contrat et d'exiger la libération des lieux sans délai ni indemnité.";
  yPosition = drawWrappedText(page, terminationText, margin, yPosition, pageWidth - 2 * margin, fontSize, font) - 20;
  
  // ARTICLE 7 - DROIT APPLICABLE
  page.drawText('ARTICLE 7 - DROIT APPLICABLE', {
    x: margin,
    y: yPosition,
    size: fontSize + 1,
    font: boldFont,
  });
  yPosition -= 20;
  
  const lawText = "Le présent contrat est régi par le droit marocain. Tout litige sera de la compétence exclusive des tribunaux de Casablanca.";
  yPosition = drawWrappedText(page, lawText, margin, yPosition, pageWidth - 2 * margin, fontSize, font) - 30;
  
  // SIGNATURE SECTION
  page.drawText(`Fait à Casablanca, le ${currentDate}`, {
    x: margin,
    y: yPosition,
    size: fontSize,
    font: boldFont,
  });
  yPosition -= 40;
  
  // Two column layout for signatures
  const leftColumnX = margin;
  const rightColumnX = pageWidth / 2 + 20;
  
  page.drawText('LE BAILLEUR', {
    x: leftColumnX,
    y: yPosition,
    size: fontSize + 1,
    font: boldFont,
  });
  
  page.drawText('LE LOCATAIRE', {
    x: rightColumnX,
    y: yPosition,
    size: fontSize + 1,
    font: boldFont,
  });
  
  yPosition -= 25;
  
  // Use appropriate name based on landlord status
  const signatureName = landlordStatus === 'particulier' ? landlordName : companyName;
  page.drawText(signatureName, {
    x: leftColumnX,
    y: yPosition,
    size: fontSize - 1,
    font: font,
  });
  
  page.drawText(guestName, {
    x: rightColumnX,
    y: yPosition,
    size: fontSize - 1,
    font: font,
  });
  
  yPosition -= 100;
  
   // Add signatures if available
   console.log('🔍 Guest signature embedding check:', {
     hasSignatureData: !!signatureData,
     signatureDataLength: signatureData?.length,
     signatureDataPreview: signatureData?.substring(0, 50) + '...'
   });
   
   if (signatureData) {
     console.log('🖊️ Attempting to embed guest signature...');
     try {
       const cleanGuestSignature = signatureData.replace(/^data:image\/[^;]+;base64,/, '');
       console.log('🔍 Cleaned signature length:', cleanGuestSignature.length);
       
       let guestSignatureImage;
       try {
         guestSignatureImage = await pdfDoc.embedPng(Uint8Array.from(atob(cleanGuestSignature), c => c.charCodeAt(0)));
         console.log('✅ Guest signature embedded as PNG');
       } catch {
         guestSignatureImage = await pdfDoc.embedJpg(Uint8Array.from(atob(cleanGuestSignature), c => c.charCodeAt(0)));
         console.log('✅ Guest signature embedded as JPG');
       }
       
       const maxWidth = 220;
       const maxHeight = 120;
       const aspectRatio = guestSignatureImage.width / guestSignatureImage.height;
       let width = maxWidth;
       let height = maxWidth / aspectRatio;
       if (height > maxHeight) {
         height = maxHeight;
         width = maxHeight * aspectRatio;
       }
       
       console.log('🔍 Guest signature dimensions:', { width, height, aspectRatio });
       
       page.drawImage(guestSignatureImage, {
         x: rightColumnX,
         y: yPosition,
         width: width,
         height: height,
       });
       
       console.log('✅ Guest signature successfully added to PDF at position:', { x: rightColumnX, y: yPosition });
     } catch (error) {
       console.error('❌ Error embedding guest signature:', error);
     }
   } else {
     console.log('❌ No guest signature data available for embedding');
   }
  
  // Landlord signature
  const landlordSignature = contractTemplate.landlord_signature;
  if (landlordSignature) {
    try {
      const cleanLandlordSignature = landlordSignature.replace(/^data:image\/[^;]+;base64,/, '');
      let landlordSignatureImage;
      try {
        landlordSignatureImage = await pdfDoc.embedPng(Uint8Array.from(atob(cleanLandlordSignature), c => c.charCodeAt(0)));
      } catch {
        landlordSignatureImage = await pdfDoc.embedJpg(Uint8Array.from(atob(cleanLandlordSignature), c => c.charCodeAt(0)));
      }
      
      const maxWidth = 220;
      const maxHeight = 120;
      const aspectRatio = landlordSignatureImage.width / landlordSignatureImage.height;
      let width = maxWidth;
      let height = maxWidth / aspectRatio;
      if (height > maxHeight) {
        height = maxHeight;
        width = maxHeight * aspectRatio;
      }
      
      page.drawImage(landlordSignatureImage, {
        x: leftColumnX,
        y: yPosition,
        width: width,
        height: height,
      });
    } catch (error) {
      console.error('Error embedding landlord signature:', error);
    }
  }
  
   // Add signature details if available
   let signatureDetailsY = yPosition;
   
   // Guest signature details
   if (signatureData && (signerInfo || signedAt)) {
     signatureDetailsY -= 130;
     const signerName = signerInfo?.signer_name || '';
     const signTime = signedAt || signerInfo?.signed_at;
     
     if (signerName) {
       page.drawText(signerName, {
         x: rightColumnX,
         y: signatureDetailsY,
         size: fontSize - 1,
         font: font,
       });
       signatureDetailsY -= 12;
     }
     
     if (signTime) {
       const signedDate = new Date(signTime).toLocaleDateString('fr-FR');
       page.drawText(`Signé le ${signedDate}`, {
         x: rightColumnX,
         y: signatureDetailsY,
         size: fontSize - 2,
         font: font,
       });
       signatureDetailsY -= 20;
     }
   }
   
   // Overall signature timestamp for electronic signing
   if (signatureData && (signedAt || signerInfo?.signed_at)) {
     const signTime = signedAt || signerInfo?.signed_at;
     const signedDate = new Date(signTime).toLocaleDateString('fr-FR');
     const signedTimeStr = new Date(signTime).toLocaleTimeString('fr-FR');
     page.drawText(`Document signé électroniquement le ${signedDate} à ${signedTimeStr}`, {
       x: margin,
       y: signatureDetailsY - 10,
       size: fontSize - 2,
       font: font,
     });
   }
  
  return pdfDoc.save();
}

async function generatePoliceFormsPDF(booking: any, PDFDocument?: any, StandardFonts?: any, rgb?: any): Promise<Uint8Array[]> {
  const guests = booking.guests || [];
  const property = booking.property || {};
  const pdfs: Uint8Array[] = [];
  
  const fonts = await getUnicodeFonts().catch(() => null);
  for (const guest of guests) {
    const pdfDoc = await PDFDocument.create();
    let font: any;
    let boldFont: any;
    if (fonts) {
      font = await pdfDoc.embedFont(fonts.regular, { subset: true });
      boldFont = await pdfDoc.embedFont(fonts.bold, { subset: true });
    } else {
      font = await pdfDoc.embedFont(StandardFonts.Helvetica);
      boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    }
    
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
      font: boldFont,
    });
    yPosition -= 20;
    
    page.drawText('PRÉFECTURE / PROVINCE', {
      x: (pageWidth - font.widthOfTextAtSize('PRÉFECTURE / PROVINCE', fontSize)) / 2,
      y: yPosition,
      size: fontSize,
      font: font,
    });
    yPosition -= 40;
    
    // Title
    page.drawText('FICHE INDIVIDUELLE', {
      x: (pageWidth - boldFont.widthOfTextAtSize('FICHE INDIVIDUELLE', titleFontSize)) / 2,
      y: yPosition,
      size: titleFontSize,
      font: boldFont,
    });
    yPosition -= 20;
    
    page.drawText('DÉCLARATION D\'ARRIVÉE D\'UN ÉTRANGER DANS UN ÉTABLISSEMENT D\'HÉBERGEMENT', {
      x: (pageWidth - font.widthOfTextAtSize('DÉCLARATION D\'ARRIVÉE D\'UN ÉTRANGER DANS UN ÉTABLISSEMENT D\'HÉBERGEMENT', fontSize)) / 2,
      y: yPosition,
      size: fontSize,
      font: font,
    });
    yPosition -= 40;
    
    // Form fields
    const leftColumn = margin;
    const rightColumn = pageWidth / 2 + 10;
    
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
    
    // Signature section
    yPosition -= 40;
    page.drawText('DATE ET SIGNATURE DU RESPONSABLE DE L\'ÉTABLISSEMENT:', {
      x: leftColumn,
      y: yPosition,
      size: fontSize,
      font: boldFont,
    });

    // Try to add landlord signature image if available
    try {
      const contractTemplate = property.contract_template || {};
      const landlordSignature = contractTemplate.landlord_signature;
      if (landlordSignature) {
        const clean = landlordSignature.replace(/^data:image\/[^;]+;base64,/, '');
        let img;
        try {
          img = await pdfDoc.embedPng(Uint8Array.from(atob(clean), (c: any) => c.charCodeAt(0)));
        } catch {
          img = await pdfDoc.embedJpg(Uint8Array.from(atob(clean), (c: any) => c.charCodeAt(0)));
        }
        const maxWidth = 220;
        const maxHeight = 100;
        const aspect = img.width / img.height;
        let width = maxWidth;
        let height = maxWidth / aspect;
        if (height > maxHeight) {
          height = maxHeight;
          width = maxHeight * aspect;
        }
        // Place signature block just below the title line
        page.drawImage(img, {
          x: leftColumn,
          y: yPosition - height - 10,
          width,
          height,
        });
      }
    } catch (e) {
      console.error('Failed to embed landlord signature on police form:', e);
    }
    
    yPosition -= 60;
    const currentDate = new Date().toLocaleDateString('fr-FR');
    page.drawText(`Date: ${currentDate}`, {
      x: leftColumn,
      y: yPosition,
      size: fontSize,
      font: font,
    });
    
    // Add border
    page.drawRectangle({
      x: margin - 10,
      y: margin - 10,
      width: pageWidth - 2 * (margin - 10),
      height: pageHeight - 2 * (margin - 10),
      borderColor: rgb(0, 0, 0),
      borderWidth: 1,
    });
    
    pdfs.push(await pdfDoc.save());
  }
  
  return pdfs;
}

function drawField(page: any, label: string, value: string, x: number, y: number, font: any, boldFont: any, fontSize: number): number {
  page.drawText(label, {
    x: x,
    y: y,
    size: fontSize,
    font: boldFont,
  });
  
  const labelWidth = boldFont.widthOfTextAtSize(label, fontSize);
  const valueX = x + labelWidth + 10;
  
  page.drawText(sanitizeText(value) || '................................', {
    x: valueX,
    y: y,
    size: fontSize,
    font: font,
  });
  
  return y - 20;
}