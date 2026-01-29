/// <reference types="https://deno.land/x/types/deploy/stable/index.d.ts" />
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { PDFDocument, StandardFonts, rgb } from "https://esm.sh/pdf-lib@1.17.1";
import fontkit from "https://esm.sh/@pdf-lib/fontkit@1.1.1";

// =====================================================
// CONFIGURATION
// =====================================================

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json'
};

// =====================================================
// UTILITIES
// =====================================================

function log(level: 'info' | 'warn' | 'error', message: string, data?: any) {
  const timestamp = new Date().toISOString();
  const logData = { level, message, data, timestamp, function: 'generate-police-form' };
  
  switch (level) {
    case 'info':
      console.log(`✅ [${timestamp}] ${message}`, data ? JSON.stringify(data, null, 2) : '');
      break;
    case 'warn':
      console.warn(`⚠️ [${timestamp}] ${message}`, data ? JSON.stringify(data, null, 2) : '');
      break;
    case 'error':
      console.error(`❌ [${timestamp}] ${message}`, data ? JSON.stringify(data, null, 2) : '');
      break;
  }
}

function formatDate(dateStr: string): string {
  if (!dateStr) return '';
  try {
    const date = new Date(dateStr);
    return isNaN(date.getTime()) ? '' : date.toLocaleDateString('fr-FR');
  } catch {
    return '';
  }
}

// Helper pour détecter si du texte contient de l'arabe
function hasArabic(text: string): boolean {
  return /[\u0600-\u06FF]/.test(text);
}

// =====================================================
// MAIN HANDLER
// =====================================================

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const startTime = Date.now();
  
  try {
    log('info', '🚀 Nouvelle requête génération fiche de police');

    // Parse request
    const body = await req.json();
    const { bookingId } = body;

    if (!bookingId) {
      throw new Error('bookingId est requis');
    }

    log('info', '📦 Requête reçue', { bookingId });

    // Create Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Configuration Supabase manquante');
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // =====================================================
    // ÉTAPE 1: Récupérer le booking avec toutes les données
    // =====================================================
    
    log('info', '📋 Récupération du booking...');
    
    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .select(`
        *,
        property:properties(
          *,
          contract_template
        )
      `)
      .eq('id', bookingId)
      .single();

    if (bookingError || !booking) {
      throw new Error(`Booking non trouvé: ${bookingError?.message}`);
    }

    // ✅ ÉTAPE 1b: Récupérer le profil du propriétaire séparément
    let ownerProfile = null;
    if (booking.property?.user_id) {
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', booking.property.user_id)
        .single();
      
      if (profile && !profileError) {
        ownerProfile = profile;
      }
    }

    log('info', '✅ Booking récupéré', {
      bookingId: booking.id,
      propertyId: booking.property?.id,
      propertyUserId: booking.property?.user_id,
      ownerEmail: ownerProfile?.email,
      ownerPhone: ownerProfile?.phone,
      checkIn: booking.check_in_date,
      checkOut: booking.check_out_date
    });

    // ÉTAPE 2: Récupérer les guests depuis guest_submissions
    // =====================================================
    
    log('info', '👥 Récupération des guests...');
    
    const { data: submissions, error: submissionsError } = await supabase
      .from('guest_submissions')
      .select('guest_data')  // ✅ CORRIGÉ: Retirer extracted_data qui n'existe pas
      .eq('booking_id', bookingId);

    if (submissionsError) {
      log('warn', 'Erreur récupération submissions', { error: submissionsError.message });
    }

    // ✅ AMÉLIORATION: Mapper les données avec support de différentes structures
    const guests = submissions?.map(s => {
      const guestData = s.guest_data || {};
      
      // Fusionner les données de différentes sources
      return {
        // Nom complet - essayer différentes clés
        full_name: guestData.full_name || guestData.fullName || guestData.name || '',
        
        // Nom et prénom séparés (si disponibles)
        first_name: guestData.first_name || guestData.firstName || guestData.prenom || '',
        last_name: guestData.last_name || guestData.lastName || guestData.nom || '',
        
        // Email
        email: guestData.email || guestData.courriel || '',
        
        // Téléphone - PLUS DE VARIANTES
        phone: guestData.phone || guestData.telephone || guestData.phone_number || 
               guestData.phoneNumber || guestData.tel || guestData.mobile || 
               guestData.numero_telephone || guestData.numeroTelephone || '',
        
        // Nationalité
        nationality: guestData.nationality || guestData.nationalite || guestData.nationalité || '',
        
        // Document - PLUS DE VARIANTES
        document_type: guestData.document_type || guestData.documentType || guestData.id_type ||
                       guestData.type_document || guestData.typeDocument || 'passport',
        document_number: guestData.document_number || guestData.documentNumber || guestData.id_number ||
                        guestData.idNumber || guestData.numero_document || guestData.numeroDocument ||
                        guestData.passport_number || guestData.passportNumber || 
                        guestData.numero_passeport || guestData.numeroPasseport || '',
        
        // Date de naissance - PLUS DE VARIANTES
        date_of_birth: guestData.date_of_birth || guestData.dateOfBirth || guestData.birth_date ||
                       guestData.birthDate || guestData.date_naissance || guestData.dateNaissance || '',
        
        // Lieu de naissance - PLUS DE VARIANTES
        place_of_birth: guestData.place_of_birth || guestData.placeOfBirth || guestData.birth_place ||
                        guestData.birthPlace || guestData.lieu_naissance || guestData.lieuNaissance ||
                        guestData.lieu_de_naissance || guestData.lieuDeNaissance || '',
        
        // Profession
        profession: guestData.profession || guestData.occupation || guestData.metier || '',
        
        // Motif du séjour
        motif_sejour: guestData.motif_sejour || guestData.motifSejour || guestData.purpose ||
                      guestData.motif || guestData.raison_sejour || 'TOURISME',
        
        // Adresse personnelle - PLUS DE VARIANTES
        adresse_personnelle: guestData.adresse_personnelle || guestData.adressePersonnelle || 
                            guestData.home_address || guestData.homeAddress ||
                            guestData.address || guestData.adresse ||
                            guestData.adresse_domicile || guestData.adresseDomicile || ''
      };
    }) || [];
    
    if (guests.length === 0) {
      throw new Error('Aucun guest trouvé pour ce booking');
    }

    log('info', '✅ Guests récupérés', {
      count: guests.length,
      firstGuestFullName: guests[0]?.full_name,
      firstGuestEmail: guests[0]?.email,
      firstGuestPhone: guests[0]?.phone,
      firstGuestNationality: guests[0]?.nationality,
      firstGuestPlaceOfBirth: guests[0]?.place_of_birth,
      firstGuestDocumentNumber: guests[0]?.document_number,
      firstGuestAddress: guests[0]?.adresse_personnelle,
      allGuestsData: guests
    });

    // =====================================================
    // ÉTAPE 3: Récupérer la signature du guest
    // =====================================================
    
    log('info', '✍️ Récupération signature guest...');
    
    const { data: signatureData, error: sigError } = await supabase
      .from('contract_signatures')
      .select('signature_data, signed_at')
      .eq('booking_id', bookingId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (sigError) {
      log('warn', 'Erreur récupération signature', { error: sigError.message });
    }

    const guestSignatureData = signatureData?.signature_data;
    const guestSignedAt = signatureData?.signed_at;

    log('info', '🔍 Signature guest récupérée', {
      found: !!guestSignatureData,
      signatureLength: guestSignatureData?.length,
      signaturePreview: guestSignatureData?.substring(0, 50),
      signedAt: guestSignedAt,
      startsWithDataImage: guestSignatureData?.startsWith('data:image/')
    });

    // =====================================================
    // ÉTAPE 4: Générer le PDF (Format Officiel Marocain)
    // =====================================================
    
    log('info', '📄 Génération du PDF format officiel marocain...');
    
    const property = booking.property || {};
    
    // Configuration PDF - Format officiel A4
    const pageWidth = 595.28;
    const pageHeight = 841.89;
    const margin = 40;
    const fontSize = 10;
    const titleFontSize = 13;
    const fieldHeight = 18;

    // Créer le document PDF
    const pdfDoc = await PDFDocument.create();
    
    // Charger les polices
    let font, boldFont, arabicFont;
    try {
      font = await pdfDoc.embedFont(StandardFonts.Helvetica);
      boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
      
      // Charger une police arabe depuis Google Fonts
      log('info', 'Loading Arabic font from Google Fonts...');
      const arabicFontUrl = 'https://fonts.gstatic.com/s/notosansarabic/v18/nwpxtLGrOAZMl5nJ_wfgRg3DrWFZWsnVBJ_sS6tlqHHFlhQ5l3sQWIHPqzCfyGyvu3CBFQLaig.ttf';
      
      const fontBytes = await fetch(arabicFontUrl).then(res => res.arrayBuffer());
      
      pdfDoc.registerFontkit(fontkit);
      arabicFont = await pdfDoc.embedFont(new Uint8Array(fontBytes));
      
      log('info', 'Arabic font loaded successfully!');
    } catch (e) {
      log('warn', 'Arabic font loading failed, falling back to Helvetica', { error: String(e) });
      font = await pdfDoc.embedFont(StandardFonts.Helvetica);
      boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
      arabicFont = font;
    }
    
    // Helper pour choisir la bonne police selon le texte
    function getFont(text: string) {
      return hasArabic(text) ? arabicFont : font;
    }

    // Helper function to draw bilingual field
    function drawBilingualField(page: any, frenchLabel: string, arabicLabel: string, value: string, x: number, y: number): number {
      const fontSize = 9;
      const baseFieldHeight = 16;
      const labelSpacing = 12;
      const lineSpacing = 11;
      
      // Draw French label (left aligned)
      const frenchLabelWidth = font.widthOfTextAtSize(frenchLabel, fontSize);
      page.drawText(frenchLabel, {
        x,
        y,
        size: fontSize,
        font: font
      });
      
      let arabicX = pageWidth - margin;
      let arabicLabelWidth = 0;
      
      // Draw Arabic label (right aligned)
      try {
        const arabicFontToUse = getFont(arabicLabel);
        arabicLabelWidth = arabicFontToUse.widthOfTextAtSize(arabicLabel, fontSize);
        arabicX = pageWidth - margin - arabicLabelWidth;
        
        page.drawText(arabicLabel, {
          x: arabicX,
          y,
          size: fontSize,
          font: arabicFontToUse
        });
      } catch (error) {
        log('warn', 'Failed to render Arabic label:', { error: String(error), label: arabicLabel });
      }
      
      // Calculer l'espace disponible pour la valeur
      const startX = x + frenchLabelWidth + labelSpacing;
      const endX = Math.max(startX + 50, arabicX - labelSpacing);
      const availableWidth = endX - startX - 4;
      
      // Gérer les valeurs
      if (value && value.trim()) {
        try {
          const valueFont = getFont(value);
          let valueSize = fontSize - 1;
          let valueWidth = valueFont.widthOfTextAtSize(value, valueSize);
          
          // Si la valeur est trop longue, réduire la taille
          let finalValue = value;
          while (valueWidth > availableWidth && valueSize > 6) {
            valueSize -= 0.3;
            valueWidth = valueFont.widthOfTextAtSize(value, valueSize);
          }
          
          // Dessiner la ligne de soulignement
          page.drawLine({
            start: { x: startX, y: y - 5 },
            end: { x: endX, y: y - 5 },
            color: rgb(0, 0, 0),
            thickness: 0.5
          });
          
          const valueX = Math.max(
            startX + 2,
            Math.min(
              startX + (endX - startX - valueWidth) / 2,
              endX - valueWidth - 2
            )
          );
          
          page.drawText(value, {
            x: valueX,
            y: y - 2,
            size: valueSize,
            font: valueFont
          });
        } catch (error) {
          log('warn', 'Failed to render value:', { error: String(error), value });
          page.drawLine({
            start: { x: startX, y: y - 5 },
            end: { x: endX, y: y - 5 },
            color: rgb(0, 0, 0),
            thickness: 0.5
          });
        }
      } else {
        // Pas de valeur, juste la ligne
        page.drawLine({
          start: { x: startX, y: y - 5 },
          end: { x: endX, y: y - 5 },
          color: rgb(0, 0, 0),
          thickness: 0.5
        });
      }
      
      return y - baseFieldHeight;
    }

    // Générer une page par invité
    for (const guest of guests) {
      const page = pdfDoc.addPage([pageWidth, pageHeight]);
      let yPosition = pageHeight - 50;
      
      // EN-TÊTE OFFICIEL
      page.drawText('Fiche d\'arrivee / Arrival form', {
        x: (pageWidth - boldFont.widthOfTextAtSize('Fiche d\'arrivee / Arrival form', titleFontSize)) / 2,
        y: yPosition,
        size: titleFontSize,
        font: boldFont
      });
      yPosition -= 25;
      
      // Titre arabe centré
      const arabicTitle = 'ورقة الوصول';
      try {
        const titleWidth = arabicFont.widthOfTextAtSize(arabicTitle, titleFontSize);
        page.drawText(arabicTitle, {
          x: (pageWidth - titleWidth) / 2,
          y: yPosition,
          size: titleFontSize,
          font: arabicFont
        });
      } catch (error) {
        log('warn', 'Failed to render Arabic title');
      }
      yPosition -= 50;
      
      // SECTION LOCATAIRE / TENANT
      page.drawText('Locataire / Tenant', {
        x: margin,
        y: yPosition,
        size: fontSize + 2,
        font: boldFont
      });
      
      try {
        const arabicSection = 'المستأجر';
        const arabicSectionWidth = arabicFont.widthOfTextAtSize(arabicSection, fontSize + 2);
        page.drawText(arabicSection, {
          x: pageWidth - margin - arabicSectionWidth,
          y: yPosition,
          size: fontSize + 2,
          font: arabicFont
        });
      } catch (error) {
        log('warn', 'Failed to render Arabic section title');
      }
      yPosition -= 35;
      
      // Informations du locataire
      const fullName = guest.full_name || '';
      
      log('info', '🔍 Traitement du nom du guest', {
        fullName,
        fullNameLength: fullName.length,
        hasFirstName: !!guest.first_name,
        hasLastName: !!guest.last_name,
        firstName: guest.first_name,
        lastName: guest.last_name
      });
      
      // ✅ AMÉLIORATION: Utiliser first_name et last_name s'ils existent
      let lastName = '';
      let firstName = '';
      
      if (guest.first_name || guest.last_name) {
        // Si on a déjà first_name et last_name séparés, les utiliser directement
        firstName = guest.first_name || '';
        lastName = guest.last_name || '';
      } else if (fullName) {
        // Sinon, diviser le full_name
        const nameParts = fullName.trim().split(' ');
        
        if (nameParts.length === 1) {
          // Un seul mot → tout dans lastName
          lastName = nameParts[0];
        } else if (nameParts.length === 2) {
          // Deux mots → premier = prénom, dernier = nom
          firstName = nameParts[0];
          lastName = nameParts[1];
        } else if (nameParts.length > 2) {
          // Plus de deux mots → dernier = nom, reste = prénom
          lastName = nameParts[nameParts.length - 1];
          firstName = nameParts.slice(0, -1).join(' ');
        }
      }
      
      log('info', '✅ Nom séparé', {
        firstName,
        lastName
      });
      
      yPosition = drawBilingualField(page, 'Nom / Last name', 'الاسم العائلي', lastName, margin, yPosition);
      yPosition = drawBilingualField(page, 'Prénom / First name', 'الاسم الشخصي', firstName, margin, yPosition);
      
      const birthDate = formatDate(guest.date_of_birth);
      yPosition = drawBilingualField(page, 'Date de naissance / Date of birth', 'تاريخ الولادة', birthDate, margin, yPosition);
      yPosition = drawBilingualField(page, 'Lieu de naissance / Place of birth', 'مكان الولادة', guest.place_of_birth || '', margin, yPosition);
      yPosition = drawBilingualField(page, 'Nationalité / Nationality', 'الجنسية', guest.nationality || '', margin, yPosition);
      
      const docType = guest.document_type === 'passport' ? 'PASSEPORT / PASSPORT' : 'CNI / ID CARD';
      yPosition = drawBilingualField(page, 'Type de document / ID type', 'نوع الوثيقة', docType, margin, yPosition);
      yPosition = drawBilingualField(page, 'Numéro du document / ID number', 'رقم الوثيقة', guest.document_number || '', margin, yPosition);
      yPosition = drawBilingualField(page, 'Date de délivrance / Date of issue', 'تاريخ الإصدار', '', margin, yPosition);
      // ✅ AMÉLIORATION: Utiliser la date d'arrivée comme date d'entrée
      const entryDate = formatDate(booking.check_in_date);
      yPosition = drawBilingualField(page, 'Date d\'entrée au Maroc / Date of entry in Morocco', 'تاريخ الدخول إلى المغرب', entryDate, margin, yPosition);
      yPosition = drawBilingualField(page, 'Profession', 'المهنة', guest.profession || '', margin, yPosition);
      yPosition = drawBilingualField(page, 'Adresse / Home address', 'العنوان الشخصي', guest.adresse_personnelle || '', margin, yPosition);
      yPosition = drawBilingualField(page, 'Courriel / Email', 'البريد الإلكتروني', guest.email || '', margin, yPosition);
      yPosition = drawBilingualField(page, 'Numéro de téléphone / Phone number', 'رقم الهاتف', guest.phone || '', margin, yPosition);
      
      yPosition -= 20;
      
      // SECTION SÉJOUR / STAY
      page.drawText('Sejour / Stay', {
        x: margin,
        y: yPosition,
        size: fontSize + 2,
        font: boldFont
      });
      
      try {
        const arabicStay = 'الإقامة';
        const arabicStayWidth = arabicFont.widthOfTextAtSize(arabicStay, fontSize + 2);
        page.drawText(arabicStay, {
          x: pageWidth - margin - arabicStayWidth,
          y: yPosition,
          size: fontSize + 2,
          font: arabicFont
        });
      } catch (error) {
        log('warn', 'Failed to render Arabic stay title');
      }
      yPosition -= 35;
      
      const checkInDate = formatDate(booking.check_in_date);
      const checkOutDate = formatDate(booking.check_out_date);
      
      yPosition = drawBilingualField(page, 'Date d\'arrivée / Date of arrival', 'تاريخ الوصول', checkInDate, margin, yPosition);
      yPosition = drawBilingualField(page, 'Date de départ / Date of departure', 'تاريخ المغادرة', checkOutDate, margin, yPosition);
      yPosition = drawBilingualField(page, 'Motif du séjour / Purpose of stay', 'سبب الإقامة', guest.motif_sejour || 'TOURISME', margin, yPosition);
      yPosition = drawBilingualField(page, 'Nombre de mineurs / Number of minors', 'عدد القاصرين', '0', margin, yPosition);
      // ✅ AMÉLIORATION: Utiliser la nationalité comme lieu de provenance
      const placeOfProvenance = guest.nationality === 'MAROCAIN' || guest.nationality === 'MOROCCAN' ? 'Maroc' : guest.nationality || '';
      yPosition = drawBilingualField(page, 'Lieu de provenance / Place of provenance', 'مكان القدوم', placeOfProvenance, margin, yPosition);
      yPosition = drawBilingualField(page, 'Destination', 'الوجهة', property.city || property.address || '', margin, yPosition);
      
      yPosition -= 20;
      
      // SECTION LOUEUR / HOST
      page.drawText('Loueur / Host', {
        x: margin,
        y: yPosition,
        size: fontSize + 2,
        font: boldFont
      });
      
      try {
        const arabicHost = 'المؤجر';
        const arabicHostWidth = arabicFont.widthOfTextAtSize(arabicHost, fontSize + 2);
        page.drawText(arabicHost, {
          x: pageWidth - margin - arabicHostWidth,
          y: yPosition,
          size: fontSize + 2,
          font: arabicFont
        });
      } catch (error) {
        log('warn', 'Failed to render Arabic host title');
      }
      yPosition -= 35;
      
      // ✅ AMÉLIORATION: Récupérer l'email du créateur de la property
      const userData = property.user || {};
      const establishmentAddress = property.address || '';
      const hostName = userData.full_name || userData.name || property.name || '';
      const hostEmail = userData.email || property.host_email || property.email || '';
      const hostPhone = userData.phone || property.host_phone || property.phone || '';
      
      yPosition = drawBilingualField(page, 'Adresse du bien loué / Rental address', 'عنوان العقار المؤجر', establishmentAddress, margin, yPosition);
      yPosition = drawBilingualField(page, 'Nom du loueur / Host name', 'اسم المؤجر', hostName, margin, yPosition);
      yPosition = drawBilingualField(page, 'Adresse email du loueur / Host email', 'البريد الإلكتروني للمؤجر', hostEmail, margin, yPosition);
      yPosition = drawBilingualField(page, 'Numéro de téléphone du loueur / Host phone number', 'رقم هاتف المؤجر', hostPhone, margin, yPosition);
      
      yPosition -= 35;
      
      // SIGNATURE SECTION
      const today = new Date();
      const signatureDate = today.toLocaleDateString('fr-FR', { 
        day: 'numeric', 
        month: 'long', 
        year: 'numeric' 
      });
      const signatureCity = property.city || 
        (property.address ? property.address.split(',').pop()?.trim() : '') || 
        'Casablanca';
      
      const signatureText = `A ${signatureCity}, le ${signatureDate}`;
      page.drawText(signatureText, {
        x: margin,
        y: yPosition,
        size: fontSize,
        font: font
      });
      yPosition -= 15;
      
      const signaturesBaselineY = yPosition;
      
      // SIGNATURE DU LOCATAIRE - Label centré
      const guestLabelText = 'Signature du locataire';
      const guestLabelWidth = font.widthOfTextAtSize(guestLabelText, fontSize);
      const guestLabelX = (pageWidth - guestLabelWidth) / 2;
      
      page.drawText(guestLabelText, {
        x: guestLabelX,
        y: signaturesBaselineY,
        size: fontSize,
        font: font
      });
      
      // Texte arabe
      try {
        const arabicGuestLabel = 'توقيع المستأجر';
        const arabicLabelWidth = arabicFont.widthOfTextAtSize(arabicGuestLabel, fontSize);
        page.drawText(arabicGuestLabel, {
          x: pageWidth - margin - arabicLabelWidth,
          y: signaturesBaselineY,
          size: fontSize,
          font: arabicFont
        });
      } catch (error) {
        log('warn', 'Erreur affichage label arabe signature guest');
      }
      
      yPosition = signaturesBaselineY - 10;
      
      // Vérifier l'espace disponible
      const footerHeight = 40;
      const minSpaceForSignatures = 80;
      const availableSpace = yPosition - footerHeight;
      
      const maxSignatureHeight = Math.min(60, Math.max(30, availableSpace - 20));
      
      log('info', '📏 Espace disponible pour signatures:', {
        yPosition,
        footerHeight,
        availableSpace,
        maxSignatureHeight
      });
      
      // SIGNATURE DU GUEST (centrée)
      log('info', '🔍 Vérification signature guest pour PDF:', {
        hasGuestSignatureData: !!guestSignatureData,
        guestSignatureDataType: typeof guestSignatureData,
        guestSignatureDataLength: guestSignatureData?.length || 0,
        guestSignatureDataPreview: guestSignatureData ? guestSignatureData.substring(0, 50) : 'null',
        startsWithDataImage: guestSignatureData?.startsWith('data:image/') || false
      });
      
      const conditionPassed = guestSignatureData && guestSignatureData.startsWith('data:image/');
      log('info', '🔍 Condition d\'affichage signature:', {
        conditionPassed,
        hasData: !!guestSignatureData,
        startsWithDataImage: guestSignatureData?.startsWith('data:image/')
      });
      
      if (conditionPassed) {
        try {
          log('info', '🎨 Intégration signature guest...');
          
          const base64Data = guestSignatureData.split(',')[1];
          if (!base64Data) throw new Error('Base64 data manquante');
          const guestSignatureBytes = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
          
          if (guestSignatureBytes && guestSignatureBytes.length > 0) {
            let guestSigImage;
            try {
              guestSigImage = await pdfDoc.embedPng(guestSignatureBytes);
            } catch {
              guestSigImage = await pdfDoc.embedJpg(guestSignatureBytes);
            }
            
            // Dimensions adaptées pour signature centrée
            const guestAvailableWidth = pageWidth - (margin * 2);
            const maxW = Math.min(200, guestAvailableWidth * 0.6);
            const maxH = maxSignatureHeight;
            const scale = Math.min(maxW / guestSigImage.width, maxH / guestSigImage.height, 1.0);
            const w = guestSigImage.width * scale;
            const h = guestSigImage.height * scale;
            
            // Position centrée
            const guestSignatureY = signaturesBaselineY - 10 - h;
            const guestSignatureX = (pageWidth - w) / 2;
            
            page.drawImage(guestSigImage, {
              x: guestSignatureX,
              y: guestSignatureY,
              width: w,
              height: h
            });
            
            log('info', '✅ Signature guest intégrée', { x: guestSignatureX, y: guestSignatureY, w, h });
            
            // Date de signature
            if (guestSignedAt) {
              try {
                const dateText = `Signé le ${new Date(guestSignedAt).toLocaleDateString('fr-FR')}`;
                const dateTextWidth = font.widthOfTextAtSize(dateText, fontSize - 2);
                const dateX = (pageWidth - dateTextWidth) / 2;
                
                page.drawText(dateText, {
                  x: dateX,
                  y: guestSignatureY - 10,
                  size: fontSize - 2,
                  font: font,
                  color: rgb(0.3, 0.3, 0.3)
                });
              } catch {}
            }
          }
        } catch (err: any) {
          log('error', '❌ Erreur signature guest:', { error: err.message, stack: err.stack });
        }
      } else {
        log('warn', '⚠️ Pas de signature guest disponible ou format invalide:', {
          hasData: !!guestSignatureData,
          dataType: typeof guestSignatureData,
          dataLength: guestSignatureData?.length || 0,
          dataPreview: guestSignatureData ? guestSignatureData.substring(0, 100) : 'null'
        });
      }
      
      // Footer CHECKY
      const footerY = 30;
      const checkyText = 'CHECKY';
      const checkyX = pageWidth - margin - boldFont.widthOfTextAtSize(checkyText, fontSize + 4);
      
      page.drawText(checkyText, {
        x: checkyX,
        y: footerY,
        size: fontSize + 4,
        font: boldFont,
        color: rgb(0.0, 0.6, 0.6)
      });
    }

    log('info', 'PDF fiches de police généré format officiel', {
      pages: guests.length,
      guests: guests.length
    });

    const pdfBytes = await pdfDoc.save();
    
    log('info', '✅ PDF généré', {
      pages: guests.length,
      sizeKB: Math.round(pdfBytes.length / 1024)
    });

    // =====================================================
    // ÉTAPE 5: Upload to Supabase Storage
    // =====================================================
    
    const fileName = `police-forms/${bookingId}/${Date.now()}.pdf`;
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('documents')
      .upload(fileName, pdfBytes, {
        contentType: 'application/pdf',
        upsert: true
      });

    if (uploadError) {
      throw new Error(`Erreur upload: ${uploadError.message}`);
    }

    const { data: { publicUrl } } = supabase.storage
      .from('documents')
      .getPublicUrl(fileName);

    log('info', '✅ PDF uploadé vers Storage', { url: publicUrl });

    // =====================================================
    // ÉTAPE 6: Sauvegarder dans uploaded_documents
    // =====================================================
    
    log('info', '💾 Sauvegarde dans uploaded_documents...');
    
    // Extraire le nom du fichier depuis le chemin complet
    const fileNameOnly = fileName.split('/').pop() || `police-${bookingId}.pdf`;
    
    const { error: insertError } = await supabase
      .from('uploaded_documents')
      .insert({
        booking_id: bookingId,
        document_type: 'police',
        document_url: publicUrl,
        file_path: fileName,
        file_name: fileNameOnly,
        created_at: new Date().toISOString()
      });

    if (insertError) {
      log('error', '❌ ERREUR CRITIQUE: Impossible de sauvegarder dans uploaded_documents', { 
        error: insertError.message,
        code: insertError.code,
        details: insertError.details
      });
      throw new Error(`Erreur sauvegarde uploaded_documents: ${insertError.message}`);
    }
    
    log('info', '✅ Document sauvegardé dans uploaded_documents');

    // =====================================================
    // ÉTAPE 7: Mettre à jour le booking
    // =====================================================
    
    await supabase
      .from('bookings')
      .update({
        documents_generated: {
          ...booking.documents_generated,
          policeForm: true
        },
        updated_at: new Date().toISOString()
      })
      .eq('id', bookingId);

    log('info', '✅ Booking mis à jour');

    // =====================================================
    // RESPONSE
    // =====================================================
    
    const processingTime = Date.now() - startTime;
    
    return new Response(
      JSON.stringify({
        success: true,
        policeUrl: publicUrl,
        bookingId,
        guestsCount: guests.length,
        hasGuestSignature: !!guestSignatureData,
        processingTime
      }),
      { headers: corsHeaders }
    );

  } catch (error: any) {
    const processingTime = Date.now() - startTime;
    log('error', '❌ Erreur génération fiche de police', {
      error: error.message,
      stack: error.stack,
      processingTime
    });

    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
        processingTime
      }),
      { status: 500, headers: corsHeaders }
    );
  }
});
