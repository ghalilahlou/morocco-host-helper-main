// Sign existing document
async function signDocument(client: any, booking: Booking, documentType: string, signatureData?: string, signedAt?: string) {
  console.log(`🖊️ Signing ${documentType} document...`);
  
  // Fetch guest signature if not provided
  let guestSignatureUrl = signatureData;
  let signerInfo = null;
  
  if (!signatureData && booking.id) {
    console.log('🔍 Fetching guest signature for booking:', booking.id);
    try {
      const { data: sig, error: sigError } = await client
        .from('contract_signatures')
        .select('signature_data, signer_name, signed_at, created_at')
        .eq('booking_id', booking.id)
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
    console.log('🔍 Skipping signature fetch:', {
      hasSignatureData: !!signatureData,
      hasBookingId: !!booking.id
    });
  }
  
  if (!guestSignatureUrl) {
    throw new Error('Signature data is required for signing');
  }

  // Get existing document from database
  const { data: existingDoc, error } = await client
    .from('uploaded_documents')
    .select('*')
    .eq('booking_id', booking.id)
    .eq('document_type', documentType)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (error || !existingDoc) {
    throw new Error(`No existing ${documentType} document found to sign`);
  }

  // Generate signed version
  let signedDocumentUrl: string;
  
  if (documentType === 'contract') {
    signedDocumentUrl = await generateContractPDF(booking, guestSignatureUrl, signedAt || signerInfo?.signed_at, existingDoc);
  } else {
    throw new Error('Only contracts can be signed');
  }

  // Update document in database
  const { data: updatedDoc, error: updateError } = await client
    .from('uploaded_documents')
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
    throw new Error(`Failed to update signed document: ${updateError.message}`);
  }

  return {
    documentUrl: signedDocumentUrl,
    documentId: updatedDoc.id,
    message: `${documentType} document signed successfully`,
    signed: true
  };
} requestData.action || 'generate';

    // Determine if preview mode
    const hasValidId = typeof bookingId === 'string' && bookingId.trim() !== '' && bookingId !== 'preview';
    const previewMode = !!requestData.booking && !hasValidId;

    let booking: Booking;

    if (previewMode) {
      console.log('🟡 Preview mode: using provided booking without DB fetch');
      booking = normalizePreviewBooking(requestData.booking);
    } else {
      console.log('🔍 Fetching booking from database:', bookingId);
      booking = await fetchBookingFromDatabase(client, bookingId);
    }

    // Validate booking data
    if (!booking.property) {
      console.error('❌ Property not found for booking');
      return new Response(JSON.stringify({
        success: false,
        message: 'Property not found for booking'
      }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log('✅ Booking data loaded:', {
      bookingId: booking.id,
      propertyName: booking.property?.name,
      guestsCount: booking.guests?.length || 0
    });

    // Process based on action and document type
    let result;

    switch (action) {
      case 'generate':
        result = await generateDocument(client, booking, documentType, previewMode);
        break;
      case 'sign':
        result = await signDocument(client, booking, documentType, requestData.signatureData, requestData.signedAt);
        break;
      case 'regenerate':
        result = await regenerateDocument(client, booking, documentType, requestData.signatureData, requestData.signedAt);
        break;
      default:
        return new Response(JSON.stringify({
          success: false,
          message: 'Invalid action. Must be: generate, sign, or regenerate'
        }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }

    console.log('✅ Document operation completed successfully');

    return new Response(JSON.stringify({
      success: true,
      message: result.message,
      documentUrl: result.documentUrl,
      documentUrls: [result.documentUrl],
      documentId: result.documentId,
      signed: result.signed || false
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('❌ Error in generate-documents-restructured:', error);
    return new Response(JSON.stringify({
      success: false,
      message: error instanceof Error ? error.message : 'Erreur inconnue'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

// Helper function to normalize preview booking data
function normalizePreviewBooking(b: any): Booking {
  const property = b.property || {};
  const guests = Array.isArray(b.guests) ? b.guests : [];
  
  const mapGuest = (g: any): Guest => ({
    full_name: g.full_name ?? g.fullName ?? '',
    date_of_birth: g.date_of_birth ?? g.dateOfBirth ?? '',
    document_number: g.document_number ?? g.documentNumber ?? '',
    nationality: g.nationality ?? '',
    document_type: g.document_type ?? g.documentType ?? '',
    place_of_birth: g.place_of_birth ?? g.placeOfBirth ?? ''
  });

  return {
    id: b.id || 'preview',
    property_id: b.property_id ?? b.propertyId ?? 'preview',
    check_in_date: b.check_in_date ?? b.checkInDate ?? b.checkinDate,
    check_out_date: b.check_out_date ?? b.checkOutDate ?? b.checkoutDate,
    number_of_guests: b.number_of_guests ?? b.numberOfGuests ?? (guests.length || 1),
    booking_reference: b.booking_reference ?? b.bookingReference,
    property: {
      id: property.id ?? b.property_id ?? b.propertyId ?? 'preview',
      name: property.name ?? b.propertyName ?? 'Propriété',
      address: property.address ?? b.propertyAddress ?? '',
      contract_template: property.contract_template ?? b.contract_template ?? property.contractTemplate,
      contact_info: property.contact_info ?? property.contactInfo ?? b.contact_info,
      status: property.status ?? b.property_status ?? b.propertyStatus ?? b.status,
      house_rules: property.house_rules ?? property.houseRules ?? []
    },
    guests: guests.map(mapGuest)
  };
}

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
    console.error('❌ Booking not found:', bookingError);
    throw new Error('Booking not found');
  }

  // Enrich with real guest data from guest_submissions
  console.log('🔍 Fetching real guest data from submissions...');
  try {
    const { data: submissions } = await client
      .from('v_guest_submissions')
      .select('guest_data, document_urls')
      .eq('booking_id', bookingId)
      .order('created_at', { ascending: false });

    if (submissions && submissions.length > 0) {
      console.log('✅ Found guest submissions, enriching booking data...');
      const realGuests: Guest[] = [];
      
      for (const submission of submissions) {
        if (submission.guest_data && submission.guest_data.guests) {
          for (const guest of submission.guest_data.guests) {
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

      if (realGuests.length > 0) {
        const existingGuests = dbBooking.guests || [];
        const completeSubmissionGuests = realGuests.filter(g => 
          g.full_name && g.document_number && g.nationality !== 'Non spécifiée'
        );
        
        if (completeSubmissionGuests.length >= existingGuests.length) {
          dbBooking.guests = realGuests;
          console.log(`✅ Using submission data: ${realGuests.length} guests`);
        } else {
          console.log(`✅ Keeping existing DB data: ${existingGuests.length} guests`);
        }
      }
    } else {
      console.log('❌ No guest submissions found, using booking.guests as fallback');
    }
  } catch (enrichError) {
    console.error('❌ Error enriching with guest submissions:', enrichError);
  }

  return dbBooking;
}

// Generate new document (contract or police forms)
async function generateDocument(client: any, booking: Booking, documentType: string, isPreview: boolean = false) {
  console.log(`📄 Generating ${documentType} document...`);
  
  // Validate guests for police forms
  if (documentType === 'police') {
    const guests = booking.guests || [];
    if (guests.length === 0) {
      console.error('❌ Cannot generate police forms: no guests found');
      throw new Error('Aucun invité trouvé pour générer les fiches de police');
    }

    // Validate that each guest has minimal required data
    const invalidGuests = guests.filter(guest => 
      !guest.full_name?.trim() || !guest.document_number?.trim()
    );
    
    if (invalidGuests.length > 0) {
      console.error('❌ Invalid guest data found:', invalidGuests);
      throw new Error(`${invalidGuests.length} invité(s) ont des données incomplètes`);
    }

    console.log(`📋 Generating police forms for ${guests.length} validated guests`);
  }
  
  let documentUrl: string;
  let documentId: string | null = null;

  if (documentType === 'contract') {
    documentUrl = await generateContractPDF(booking, null, null, null);
  } else if (documentType === 'police') {
    documentUrl = await generatePoliceFormsPDF(booking);
  } else {
    throw new Error('Invalid document type');
  }

  // Save to database if not in preview mode
  if (!isPreview) {
    const documentRecord = await saveDocumentToDatabase(
      client, 
      booking.id, 
      documentType, 
      documentUrl, 
      false // not signed yet
    );
    documentId = documentRecord.id;
  }

  return {
    documentUrl,
    documentId,
    message: `${documentType} document generated successfully`,
    signed: false
  };
}

// Sign existing document
async function signDocument(client: any, booking: Booking, documentType: string, signatureData?: string, signedAt?: string) {
  console.log(`🖊️ Signing ${documentType} document...`);
  
  // Fetch guest signature if not provided
  let guestSignatureUrl = signatureData;
  let signerInfo = null;
  
  if (!signatureData && booking.id) {
    console.log('🔍 Fetching guest signature for booking:', booking.id);
    try {
      const { data: sig, error: sigError } = await client
        .from('contract_signatures')
        .select('signature_data, signer_name, signed_at, created_at')
        .eq('booking_id', booking.id)
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
    console.log('🔍 Skipping signature fetch:', {
      hasSignatureData: !!signatureData,
      hasBookingId: !!booking.id
    });
  }
  
  if (!guestSignatureUrl) {
    throw new Error('Signature data is required for signing');
  }

  // Get existing document from database
  const { data: existingDoc, error } = await client
    .from('uploaded_documents')
    .select('*')
    .eq('booking_id', booking.id)
    .eq('document_type', documentType)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (error || !existingDoc) {
    throw new Error(`No existing ${documentType} document found to sign`);
  }

  // Generate signed version
  let signedDocumentUrl: string;
  
  if (documentType === 'contract') {
    signedDocumentUrl = await generateContractPDF(booking, guestSignatureUrl, signedAt || signerInfo?.signed_at, existingDoc);
  } else {
    throw new Error('Only contracts can be signed');
  }

  // Update document in database
  const { data: updatedDoc, error: updateError } = await client
    .from('uploaded_documents')
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
    throw new Error(`Failed to update signed document: ${updateError.message}`);
  }

  return {
    documentUrl: signedDocumentUrl,
    documentId: updatedDoc.id,
    message: `${documentType} document signed successfully`,
    signed: true
  };
}

// Regenerate document (useful for updates)
async function regenerateDocument(client: any, booking: Booking, documentType: string, signatureData?: string, signedAt?: string) {
  console.log(`🔄 Regenerating ${documentType} document...`);
  
  // Generate new document
  let documentUrl: string;
  
  if (documentType === 'contract') {
    documentUrl = await generateContractPDF(booking, signatureData, signedAt, null);
  } else if (documentType === 'police') {
    documentUrl = await generatePoliceFormsPDF(booking);
  } else {
    throw new Error('Invalid document type');
  }

  // Update or create document in database
  const { data: existingDoc } = await client
    .from('uploaded_documents')
    .select('*')
    .eq('booking_id', booking.id)
    .eq('document_type', documentType)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  let documentId: string;

  if (existingDoc) {
    // Update existing document
    const { data: updatedDoc, error: updateError } = await client
      .from('uploaded_documents')
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
      throw new Error(`Failed to update document: ${updateError.message}`);
    }
    
    documentId = updatedDoc.id;
  } else {
    // Create new document
    const documentRecord = await saveDocumentToDatabase(
      client, 
      booking.id, 
      documentType, 
      documentUrl, 
      !!signatureData,
      signatureData,
      signedAt
    );
    documentId = documentRecord.id;
  }

  return {
    documentUrl,
    documentId,
    message: `${documentType} document regenerated successfully`,
    signed: !!signatureData
  };
}

// Save document to database
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

  console.log(`✅ Document saved to database with ID: ${documentRecord.id}`);
  return documentRecord;
}

// Unicode font loading (cached across invocations)
let cachedUnicodeFonts: { regular: Uint8Array; bold: Uint8Array } | null = null;

async function loadUnicodeFontBytes() {
  const regularUrl = 'https://github.com/dejavu-fonts/dejavu-fonts/raw/version_2_37/ttf/DejaVuSans.ttf';
  const boldUrl = 'https://github.com/dejavu-fonts/dejavu-fonts/raw/version_2_37/ttf/DejaVuSans-Bold.ttf';
  
  const [regRes, boldRes] = await Promise.all([
    fetch(regularUrl),
    fetch(boldUrl)
  ]);
  
  if (!regRes.ok || !boldRes.ok) {
    throw new Error('Failed to fetch Unicode fonts');
  }
  
  const [regBuf, boldBuf] = await Promise.all([
    regRes.arrayBuffer(),
    boldRes.arrayBuffer()
  ]);
  
  return {
    regular: new Uint8Array(regBuf),
    bold: new Uint8Array(boldBuf)
  };
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
    return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '') // strip diacritics
      .replace(/[""„]/g, '"').replace(/['']/g, "'").replace(/[\u2013\u2014]/g, '-');
  } catch {
    return String(text ?? '');
  }
}

// Generate contract PDF with full functionality from original
async function generateContractPDF(booking: Booking, signatureData?: string, signedAt?: string, existingDoc?: any): Promise<string> {
  console.log('📄 Creating contract PDF...');
  
  const { PDFDocument, StandardFonts, rgb } = await import('https://esm.sh/pdf-lib@1.17.1');
  
  const pdfDoc = await PDFDocument.create();
  let font;
  let boldFont;
  
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
  function wrapText(text: string, maxWidth: number, fontSize: number, font: any) {
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
  function drawWrappedText(page: any, text: string, x: number, y: number, maxWidth: number, fontSize: number, font: any) {
    const lines = wrapText(text, maxWidth, fontSize, font);
    let currentY = y;
    lines.forEach((line) => {
      page.drawText(line, {
        x: x,
        y: currentY,
        size: fontSize,
        font: font
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
    font: boldFont
  });
  yPosition -= 40;
  
  // Decorative line
  page.drawLine({
    start: { x: margin, y: yPosition },
    end: { x: pageWidth - margin, y: yPosition },
    thickness: 2,
    color: rgb(0.2, 0.2, 0.2)
  });
  yPosition -= 40;
  
  // PARTIES SECTION
  page.drawText('ENTRE LES SOUSSIGNÉS :', {
    x: margin,
    y: yPosition,
    size: fontSize + 1,
    font: boldFont
  });
  yPosition -= 30;
  
  // LANDLORD SECTION
  page.drawText('LE BAILLEUR :', {
    x: margin,
    y: yPosition,
    size: fontSize,
    font: boldFont
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
    font: boldFont
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
    font: boldFont
  });
  yPosition -= 20;
  
  const objectText = `Le présent contrat a pour objet la location meublée de courte durée du bien immobilier suivant : ${propertyName}, situé ${propertyAddress}. Le logement est loué entièrement meublé et équipé pour un usage d'habitation temporaire.`;
  yPosition = drawWrappedText(page, objectText, margin, yPosition, pageWidth - 2 * margin, fontSize, font) - 15;
  
  // ARTICLE 2 - DURÉE
  page.drawText('ARTICLE 2 - DURÉE ET PÉRIODE', {
    x: margin,
    y: yPosition,
    size: fontSize + 1,
    font: boldFont
  });
  yPosition -= 20;
  
  const durationText = `La location est consentie pour une durée déterminée du ${checkInDate} à 16h00 au ${checkOutDate} à 11h00. Cette période ne pourra être prolongée qu'avec l'accord écrit préalable du Bailleur.`;
  yPosition = drawWrappedText(page, durationText, margin, yPosition, pageWidth - 2 * margin, fontSize, font) - 15;
  
  // ARTICLE 3 - OCCUPANTS
  page.drawText('ARTICLE 3 - OCCUPANTS AUTORISÉS', {
    x: margin,
    y: yPosition,
    size: fontSize + 1,
    font: boldFont
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
    font: boldFont
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
  rules.forEach((rule) => {
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
    font: boldFont
  });
  yPosition -= 20;
  
  const responsabilityText = "Le Locataire est entièrement responsable de tout dommage causé au logement, aux équipements et au mobilier. Il s'engage à restituer le bien dans l'état où il l'a trouvé. Le Bailleur décline toute responsabilité en cas de vol, perte ou dommage aux effets personnels du Locataire.";
  yPosition = drawWrappedText(page, responsabilityText, margin, yPosition, pageWidth - 2 * margin, fontSize, font) - 20;
  
  // ARTICLE 6 - RÉSILIATION
  page.drawText('ARTICLE 6 - RÉSILIATION', {
    x: margin,
    y: yPosition,
    size: fontSize + 1,
    font: boldFont
  });
  yPosition -= 20;
  
  const terminationText = "En cas de non-respect des présentes conditions, le Bailleur se réserve le droit de procéder à la résiliation immédiate du contrat et d'exiger la libération des lieux sans délai ni indemnité.";
  yPosition = drawWrappedText(page, terminationText, margin, yPosition, pageWidth - 2 * margin, fontSize, font) - 20;
  
  // ARTICLE 7 - DROIT APPLICABLE
  page.drawText('ARTICLE 7 - DROIT APPLICABLE', {
    x: margin,
    y: yPosition,
    size: fontSize + 1,
    font: boldFont
  });
  yPosition -= 20;
  
  const lawText = "Le présent contrat est régi par le droit marocain. Tout litige sera de la compétence exclusive des tribunaux de Casablanca.";
  yPosition = drawWrappedText(page, lawText, margin, yPosition, pageWidth - 2 * margin, fontSize, font) - 30;
  
  // SIGNATURE SECTION
  page.drawText(`Fait à Casablanca, le ${currentDate}`, {
    x: margin,
    y: yPosition,
    size: fontSize,
    font: boldFont
  });
  yPosition -= 40;
  
  // Two column layout for signatures
  const leftColumnX = margin;
  const rightColumnX = pageWidth / 2 + 20;
  
  page.drawText('LE BAILLEUR', {
    x: leftColumnX,
    y: yPosition,
    size: fontSize + 1,
    font: boldFont
  });
  page.drawText('LE LOCATAIRE', {
    x: rightColumnX,
    y: yPosition,
    size: fontSize + 1,
    font: boldFont
  });
  yPosition -= 25;
  
  // Use appropriate name based on landlord status
  const signatureName = landlordStatus === 'particulier' ? landlordName : companyName;
  page.drawText(signatureName, {
    x: leftColumnX,
    y: yPosition,
    size: fontSize - 1,
    font: font
  });
  page.drawText(guestName, {
    x: rightColumnX,
    y: yPosition,
    size: fontSize - 1,
    font: font
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
        guestSignatureImage = await pdfDoc.embedPng(Uint8Array.from(atob(cleanGuestSignature), (c) => c.charCodeAt(0)));
        console.log('✅ Guest signature embedded as PNG');
      } catch {
        guestSignatureImage = await pdfDoc.embedJpg(Uint8Array.from(atob(cleanGuestSignature), (c) => c.charCodeAt(0)));
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
        height: height
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
        landlordSignatureImage = await pdfDoc.embedPng(Uint8Array.from(atob(cleanLandlordSignature), (c) => c.charCodeAt(0)));
      } catch {
        landlordSignatureImage = await pdfDoc.embedJpg(Uint8Array.from(atob(cleanLandlordSignature), (c) => c.charCodeAt(0)));
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
        height: height
      });
    } catch (error) {
      console.error('Error embedding landlord signature:', error);
    }
  }
  
  // Add signature details if available
  let signatureDetailsY = yPosition;
  
  // Guest signature details
  if (signatureData && signedAt) {
    signatureDetailsY -= 130;
    const signTime = signedAt;
    if (signTime) {
      const signedDate = new Date(signTime).toLocaleDateString('fr-FR');
      page.drawText(`Signé le ${signedDate}`, {
        x: rightColumnX,
        y: signatureDetailsY,
        size: fontSize - 2,
        font: font
      });
      signatureDetailsY -= 20;
    }
  }
  
  // Overall signature timestamp for electronic signing
  if (signatureData && signedAt) {
    const signTime = signedAt;
    const signedDate = new Date(signTime).toLocaleDateString('fr-FR');
    const signedTimeStr = new Date(signTime).toLocaleTimeString('fr-FR');
    page.drawText(`Document signé électroniquement le ${signedDate} à ${signedTimeStr}`, {
      x: margin,
      y: signatureDetailsY - 10,
      size: fontSize - 2,
      font: font
    });
  }
  
  return pdfDoc.save();
}

// Generate police forms PDF with full functionality from original
async function generatePoliceFormsPDF(booking: Booking): Promise<string> {
  console.log('📄 Creating police forms PDF...');
  
  const { PDFDocument, StandardFonts, rgb } = await import('https://esm.sh/pdf-lib@1.17.1');
  
  const guests = booking.guests || [];
  const property = booking.property || {};
  const pdfs: Uint8Array[] = [];
  
  const fonts = await getUnicodeFonts().catch(() => null);
  
  for (const guest of guests) {
    const pdfDoc = await PDFDocument.create();
    let font;
    let boldFont;
    
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
      font: boldFont
    });
    
    // Try to add landlord signature image if available
    try {
      const contractTemplate = property.contract_template || {};
      const landlordSignature = contractTemplate.landlord_signature;
      if (landlordSignature) {
        const clean = landlordSignature.replace(/^data:image\/[^;]+;base64,/, '');
        let img;
        try {
          img = await pdfDoc.embedPng(Uint8Array.from(atob(clean), (c) => c.charCodeAt(0)));
        } catch {
          img = await pdfDoc.embedJpg(Uint8Array.from(atob(clean), (c) => c.charCodeAt(0)));
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
          height
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
  
  // Convert all PDFs to a single data URL (for simplicity, we'll return the first one)
  // In a real implementation, you might want to combine them or return multiple URLs
  if (pdfs.length === 0) {
    throw new Error('No police forms generated');
  }
  
  // For now, return the first PDF as a data URL
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
  
  page.drawText(sanitizeText(value) || '................................', {
    x: valueX,
    y: y,
    size: fontSize,
    font: font
  });
  
  return y - 20;
}
