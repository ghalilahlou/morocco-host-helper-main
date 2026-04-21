/// <reference types="https://deno.land/x/types/deploy/stable/index.d.ts" />
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/v135/@supabase/supabase-js@2.39.3';
import { PDFDocument, StandardFonts, rgb } from "https://esm.sh/v135/pdf-lib@1.17.1";
import fontkit from "https://esm.sh/v135/@pdf-lib/fontkit@1.1.1";

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
// VERROU POUR ÉVITER LES GÉNÉRATIONS MULTIPLES SIMULTANÉES
// =====================================================

// ✅ NOUVEAU : Map pour tracker les générations en cours par bookingId
const generatingLocks = new Map<string, { timestamp: number, loadId: string }>();

function acquireLock(bookingId: string): { acquired: boolean, existingLoadId?: string } {
  const existing = generatingLocks.get(bookingId);
  const now = Date.now();
  
  // Si une génération est en cours depuis moins de 5 minutes, refuser
  if (existing && (now - existing.timestamp < 300000)) {
    log('warn', '⚠️ Génération déjà en cours pour ce booking', {
      bookingId,
      existingLoadId: existing.loadId,
      elapsed: now - existing.timestamp
    });
    return { acquired: false, existingLoadId: existing.loadId };
  }
  
  // Acquérir le verrou
  const loadId = `${now}-${Math.random().toString(36).substring(2, 9)}`;
  generatingLocks.set(bookingId, { timestamp: now, loadId });
  
  log('info', '🔒 Verrou acquis pour génération police', { bookingId, loadId });
  return { acquired: true };
}

function releaseLock(bookingId: string, loadId: string) {
  const existing = generatingLocks.get(bookingId);
  if (existing && existing.loadId === loadId) {
    generatingLocks.delete(bookingId);
    log('info', '🔓 Verrou libéré pour génération police', { bookingId, loadId });
  } else {
    log('warn', '⚠️ Tentative de libération de verrou incorrect', {
      bookingId,
      expectedLoadId: existing?.loadId,
      providedLoadId: loadId
    });
  }
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
  let bookingId: string | null = null;
  let loadId: string | null = null;
  
  try {
    log('info', '🚀 Nouvelle requête génération fiche de police');

    // Parse request
    const body = await req.json();
    bookingId = body.bookingId ?? null;
    const previewBooking = body.booking ?? null;
    const isPreview = !!(previewBooking && !bookingId);

    if (!isPreview && !bookingId) {
      throw new Error('bookingId ou booking (aperçu) requis');
    }

    log('info', isPreview ? '👁️ Mode aperçu (modèle vide)' : '📦 Requête reçue', { bookingId, isPreview });

    // Create Supabase client (nécessaire même en preview pour polices PDF)
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Configuration Supabase manquante');
    }
    const supabase = createClient(supabaseUrl, supabaseKey);

    let booking: any;
    let guests: Record<string, string>[];
    let guestSignatureData: string | null = null;
    let guestSignedAt: string | null = null;

    if (isPreview) {
      // ========== MODE APERÇU : même format bilingue (FR/EN + arabe), champs vides / placeholders ==========
      function mapGuestData(guestData: Record<string, any>): Record<string, string> {
        return {
          full_name: guestData.full_name || guestData.fullName || guestData.name || '',
          first_name: guestData.first_name || guestData.firstName || guestData.prenom || '',
          last_name: guestData.last_name || guestData.lastName || guestData.nom || '',
          email: guestData.email || guestData.courriel || '',
          phone: guestData.phone || guestData.telephone || guestData.phone_number || guestData.phoneNumber || '',
          nationality: guestData.nationality || guestData.nationalite || '',
          document_type: guestData.document_type || guestData.documentType || 'passport',
          document_number: guestData.document_number || guestData.documentNumber || '',
          date_of_birth: guestData.date_of_birth || guestData.dateOfBirth || '',
          place_of_birth: guestData.place_of_birth || guestData.placeOfBirth || '',
          profession: guestData.profession || '',
          motif_sejour: guestData.motif_sejour || guestData.motifSejour || 'TOURISME',
          adresse_personnelle: guestData.adresse_personnelle || guestData.adressePersonnelle || ''
        };
      }
      const rawGuests = previewBooking.guests || [];
      guests = rawGuests.length > 0
        ? rawGuests.map((g: any) => mapGuestData(g))
        : [mapGuestData({ full_name: '', document_number: '', email: '', motif_sejour: 'TOURISME' })];
      const prop = previewBooking.property || {};
      const ct = prop.contract_template || {};
      const addressParts = (prop.address || '').split(',').map((s: string) => s.trim()).filter(Boolean);
      booking = {
        id: null,
        check_in_date: previewBooking.check_in_date || previewBooking.checkInDate || new Date().toISOString().slice(0, 10),
        check_out_date: previewBooking.check_out_date || previewBooking.checkOutDate || new Date().toISOString().slice(0, 10),
        property: {
          ...prop,
          address: prop.address || '',
          name: prop.name || '',
          city: prop.city || (addressParts.length > 0 ? addressParts[addressParts.length - 1] : ''),
          user: prop.user || {
            full_name: ct.landlord_name || prop.name || '',
            name: ct.landlord_name || prop.name || '',
            email: ct.landlord_email || '',
            phone: ct.landlord_phone || ''
          }
        }
      };
      log('info', '✅ Aperçu : booking normalisé (modèle vide)', { guestsCount: guests.length });
    } else {
      // ✅ PROTECTION : Verrou pour éviter générations simultanées
      const lockResult = acquireLock(bookingId);
      if (!lockResult.acquired) {
        return new Response(
          JSON.stringify({
            success: false,
            error: 'Une génération de fiche de police est déjà en cours pour cette réservation',
            code: 'GENERATION_IN_PROGRESS',
            existingLoadId: lockResult.existingLoadId
          }),
          { status: 409, headers: corsHeaders }
        );
      }
      loadId = generatingLocks.get(bookingId)?.loadId || null;

      // =====================================================
      // ÉTAPE 1: Récupérer le booking avec toutes les données
      // =====================================================
      log('info', '📋 Récupération du booking...');
      const { data: bookingRow, error: bookingError } = await supabase
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

      if (bookingError || !bookingRow) {
        throw new Error(`Booking non trouvé: ${bookingError?.message}`);
      }
      booking = bookingRow;

      let ownerProfile = null;
      if (booking.property?.user_id) {
        const { data: profile } = await supabase.from('profiles').select('*').eq('id', booking.property.user_id).single();
        if (profile) ownerProfile = profile;
      }
      log('info', '✅ Booking récupéré', { bookingId: booking.id, propertyId: booking.property?.id });

      // ÉTAPE 2: Récupérer les guests (guest_submissions → table guests → booking.guest_name)
      log('info', '👥 Récupération des guests...');
      const { data: submissionLatest, error: submissionsError } = await supabase
        .from('guest_submissions')
        .select('guest_data')
        .eq('booking_id', bookingId)
        .order('updated_at', { ascending: false })
        .limit(1);
      if (submissionsError) log('warn', 'Erreur récupération submissions', { error: submissionsError.message });

      function mapGuestData(guestData: Record<string, any>): Record<string, string> {
        const composed = [guestData.firstName, guestData.lastName]
          .filter(Boolean)
          .map((x: string) => String(x).trim())
          .join(' ')
          .trim();
        const rawDob = guestData.date_of_birth || guestData.dateOfBirth || guestData.birth_date;
        let date_of_birth = '';
        if (rawDob != null && rawDob !== '') {
          if (typeof rawDob === 'string') date_of_birth = rawDob.slice(0, 10);
          else {
            try {
              date_of_birth = new Date(rawDob).toISOString().slice(0, 10);
            } catch {
              date_of_birth = String(rawDob);
            }
          }
        }
        return {
          full_name: guestData.full_name || guestData.fullName || guestData.name || composed || '',
          first_name: guestData.first_name || guestData.firstName || guestData.prenom || '',
          last_name: guestData.last_name || guestData.lastName || guestData.nom || '',
          email: guestData.email || guestData.courriel || '',
          phone: guestData.phone || guestData.telephone || guestData.phone_number || guestData.phoneNumber || '',
          nationality: guestData.nationality || guestData.nationalite || guestData.nationalité || '',
          document_type:
            guestData.document_type ||
            guestData.documentType ||
            guestData.id_type ||
            guestData.idType ||
            'passport',
          document_number:
            guestData.document_number ||
            guestData.documentNumber ||
            guestData.id_number ||
            guestData.idNumber ||
            '',
          date_of_birth,
          place_of_birth: guestData.place_of_birth || guestData.placeOfBirth || guestData.birth_place || '',
          profession: guestData.profession || guestData.occupation || '',
          motif_sejour: guestData.motif_sejour || guestData.motifSejour || 'TOURISME',
          adresse_personnelle: guestData.adresse_personnelle || guestData.adressePersonnelle || guestData.address || ''
        };
      }

      /** Aligné sur submit-guest-info-unified : `guest_data.guests[]` + champs du 1er invité à la racine. */
      function guestsFromSubmissionGuestData(raw: Record<string, any> | null | undefined): Record<string, string>[] {
        if (!raw || typeof raw !== 'object') return [];
        if (Array.isArray(raw.guests) && raw.guests.length > 0) {
          return raw.guests.map((g: any) => mapGuestData(g));
        }
        if (Array.isArray(raw)) {
          return raw.map((g: any) => mapGuestData(g));
        }
        if (
          raw.fullName ||
          raw.full_name ||
          raw.documentNumber ||
          raw.document_number ||
          raw.idNumber
        ) {
          return [mapGuestData(raw)];
        }
        return [];
      }

      guests = guestsFromSubmissionGuestData(submissionLatest?.[0]?.guest_data ?? null);

      if (guests.length === 0) {
        const { data: guestsRows, error: guestsError } = await supabase
          .from('guests')
          .select('full_name, date_of_birth, document_number, nationality, place_of_birth, document_type, profession, motif_sejour, adresse_personnelle, email')
          .eq('booking_id', bookingId);
        if (!guestsError && guestsRows?.length > 0) {
          guests = guestsRows.map((g: any) => mapGuestData({
            full_name: g.full_name,
            date_of_birth: g.date_of_birth != null ? (typeof g.date_of_birth === 'string' ? g.date_of_birth : new Date(g.date_of_birth).toISOString().slice(0, 10)) : '',
            document_number: g.document_number || '', nationality: g.nationality || '', place_of_birth: g.place_of_birth || '',
            document_type: g.document_type || 'passport', profession: g.profession || '', motif_sejour: g.motif_sejour || 'TOURISME',
            adresse_personnelle: g.adresse_personnelle || '', email: g.email || ''
          }));
        }
      }
      if (guests.length === 0) {
        const guestName = (booking as any).guest_name?.trim() || '';
        const guestEmail = (booking as any).guest_email?.trim() || '';
        if (guestName || guestEmail) {
          guests = [mapGuestData({ full_name: guestName || 'Invité (à compléter)', email: guestEmail, document_number: '', date_of_birth: '', nationality: '', place_of_birth: '', document_type: 'passport', profession: '', motif_sejour: 'TOURISME', adresse_personnelle: '' })];
        }
      }
      if (guests.length === 0) {
        throw new Error('Aucun invité pour ce booking. Ajoutez au moins un invité (nom ou table guests) pour générer la fiche de police.');
      }

      // ÉTAPE 3: Signature guest
      const { data: signatureData, error: sigError } = await supabase
        .from('contract_signatures')
        .select('id, signature_data, signed_at, created_at, signer_name')
        .eq('booking_id', bookingId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (sigError) log('error', 'Erreur récupération signature', { error: sigError.message });
      guestSignatureData = signatureData?.signature_data ?? null;
      guestSignedAt = signatureData?.signed_at ?? null;
    }

    // =====================================================
    // ✅ DÉDUPLICATION: Éviter plusieurs fiches pour le même guest
    // =====================================================
    
    /**
     * Déduplique les guests par identité (fullName + documentNumber)
     * Un guest est considéré comme unique si la combinaison nom + document est unique
     */
    function deduplicateGuestsByIdentity(guestsList: any[]): any[] {
      const seen = new Map<string, any>();
      const duplicates: any[] = [];
      
      for (const guest of guestsList) {
        // Clé d'unicité : nom complet (normalisé) + numéro de document (normalisé)
        const fullName = (guest.full_name || '').trim().toLowerCase();
        const docNumber = (guest.document_number || '').trim().toLowerCase();
        
        // Ignorer les guests sans nom ET sans document (données invalides)
        if (!fullName && !docNumber) {
          log('warn', '⚠️ Guest ignoré (pas de nom ni de document):', guest);
          continue;
        }
        
        // Créer une clé unique
        const key = `${fullName}|${docNumber}`;
        
        if (!seen.has(key)) {
          seen.set(key, guest);
        } else {
          duplicates.push({ key, guest });
          log('info', '🔄 Duplicate détecté et ignoré:', {
            fullName: guest.full_name,
            documentNumber: guest.document_number,
            key,
            existingGuest: seen.get(key)?.full_name
          });
        }
      }
      
      const uniqueGuests = Array.from(seen.values());
      
      log('info', '📊 Déduplication terminée:', {
        totalGuests: guestsList.length,
        uniqueGuests: uniqueGuests.length,
        duplicatesRemoved: duplicates.length,
        duplicatesList: duplicates.map(d => ({
          name: d.guest.full_name,
          doc: d.guest.document_number
        }))
      });
      
      return uniqueGuests;
    }
    
    // ✅ APPLIQUER LA DÉDUPLICATION (en aperçu, garder au moins un invité pour avoir une page modèle)
    let uniqueGuests = deduplicateGuestsByIdentity(guests);
    if (isPreview && uniqueGuests.length === 0 && guests.length > 0) {
      uniqueGuests = [guests[0]];
    }

    log('info', '✅ Guests récupérés et dédupliqués', {
      totalGuests: guests.length,
      uniqueGuests: uniqueGuests.length,
      duplicatesRemoved: guests.length - uniqueGuests.length,
      firstGuestFullName: uniqueGuests[0]?.full_name,
      firstGuestEmail: uniqueGuests[0]?.email,
      firstGuestPhone: uniqueGuests[0]?.phone,
      firstGuestNationality: uniqueGuests[0]?.nationality,
      firstGuestPlaceOfBirth: uniqueGuests[0]?.place_of_birth,
      firstGuestDocumentNumber: uniqueGuests[0]?.document_number,
      firstGuestAddress: uniqueGuests[0]?.adresse_personnelle,
      allUniqueGuestsData: uniqueGuests
    });

    // =====================================================
    // ÉTAPE 4: Générer le PDF (Format Officiel Marocain – bilingue FR/EN + arabe)
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

    // En aperçu : seules les infos Loueur/Host sont remplies ; Locataire et Séjour restent vides
    const emptyIfPreview = (v: string) => (isPreview ? '' : (v || ''));

    // Générer une page par invité UNIQUE
    for (const guest of uniqueGuests) {
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
      
      yPosition = drawBilingualField(page, 'Nom / Last name', 'الاسم العائلي', emptyIfPreview(lastName), margin, yPosition);
      yPosition = drawBilingualField(page, 'Prénom / First name', 'الاسم الشخصي', emptyIfPreview(firstName), margin, yPosition);
      
      const birthDate = formatDate(guest.date_of_birth);
      yPosition = drawBilingualField(page, 'Date de naissance / Date of birth', 'تاريخ الولادة', emptyIfPreview(birthDate), margin, yPosition);
      yPosition = drawBilingualField(page, 'Lieu de naissance / Place of birth', 'مكان الولادة', emptyIfPreview(guest.place_of_birth || ''), margin, yPosition);
      yPosition = drawBilingualField(page, 'Nationalité / Nationality', 'الجنسية', emptyIfPreview(guest.nationality || ''), margin, yPosition);
      
      const docType = guest.document_type === 'passport' ? 'PASSEPORT / PASSPORT' : 'CNI / ID CARD';
      yPosition = drawBilingualField(page, 'Type de document / ID type', 'نوع الوثيقة', emptyIfPreview(docType), margin, yPosition);
      yPosition = drawBilingualField(page, 'Numéro du document / ID number', 'رقم الوثيقة', emptyIfPreview(guest.document_number || ''), margin, yPosition);
      yPosition = drawBilingualField(page, 'Date d\'expiration / Date of expiry', 'تاريخ الانتهاء', '', margin, yPosition);
      const entryDate = formatDate(booking.check_in_date);
      yPosition = drawBilingualField(page, 'Date d\'entrée au Maroc / Date of entry in Morocco', 'تاريخ الدخول إلى المغرب', emptyIfPreview(entryDate), margin, yPosition);
      yPosition = drawBilingualField(page, 'Profession', 'المهنة', emptyIfPreview(guest.profession || ''), margin, yPosition);
      yPosition = drawBilingualField(page, 'Adresse / Home address', 'العنوان الشخصي', emptyIfPreview(guest.adresse_personnelle || ''), margin, yPosition);
      yPosition = drawBilingualField(page, 'Courriel / Email', 'البريد الإلكتروني', emptyIfPreview(guest.email || ''), margin, yPosition);
      yPosition = drawBilingualField(page, 'Numéro de téléphone / Phone number', 'رقم الهاتف', emptyIfPreview(guest.phone || ''), margin, yPosition);
      
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
      
      yPosition = drawBilingualField(page, 'Date d\'arrivée / Date of arrival', 'تاريخ الوصول', emptyIfPreview(checkInDate), margin, yPosition);
      yPosition = drawBilingualField(page, 'Date de départ / Date of departure', 'تاريخ المغادرة', emptyIfPreview(checkOutDate), margin, yPosition);
      yPosition = drawBilingualField(page, 'Motif du séjour / Purpose of stay', 'سبب الإقامة', emptyIfPreview(guest.motif_sejour || 'TOURISME'), margin, yPosition);
      yPosition = drawBilingualField(page, 'Nombre de mineurs / Number of minors', 'عدد القاصرين', emptyIfPreview('0'), margin, yPosition);
      const placeOfProvenance = guest.nationality === 'MAROCAIN' || guest.nationality === 'MOROCCAN' ? 'Maroc' : guest.nationality || '';
      yPosition = drawBilingualField(page, 'Lieu de provenance / Place of provenance', 'مكان القدوم', emptyIfPreview(placeOfProvenance), margin, yPosition);
      yPosition = drawBilingualField(page, 'Destination', 'الوجهة', emptyIfPreview(property.city || property.address || ''), margin, yPosition);
      
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
      pages: uniqueGuests.length,
      uniqueGuests: uniqueGuests.length,
      totalGuests: guests.length,
      duplicatesRemoved: guests.length - uniqueGuests.length
    });

    const pdfBytes = await pdfDoc.save();
    
    log('info', '✅ PDF généré', {
      pages: uniqueGuests.length,
      sizeKB: Math.round(pdfBytes.length / 1024)
    });

    // =====================================================
    // MODE APERÇU : retourner le PDF en data URL (même format, non rempli)
    // =====================================================
    if (isPreview) {
      let binary = '';
      const bytes = new Uint8Array(pdfBytes);
      for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
      const dataUrl = `data:application/pdf;base64,${btoa(binary)}`;
      return new Response(JSON.stringify({
        success: true,
        documentUrl: dataUrl,
        documentUrls: [dataUrl],
        message: 'Aperçu fiche de police (modèle bilingue FR/EN + arabe)'
      }), { headers: corsHeaders });
    }

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
    // ÉTAPE 7: Mettre à jour le booking (FUSION ATOMIQUE)
    // =====================================================
    
    // ✅ CORRECTION CRITIQUE : Récupérer l'état ACTUEL de documents_generated
    // pour éviter d'écraser les mises à jour concurrentes
    const { data: currentBooking, error: fetchError } = await supabase
      .from('bookings')
      .select('documents_generated')
      .eq('id', bookingId)
      .single();
    
    if (fetchError) {
      log('error', '❌ Erreur récupération état actuel booking', { error: fetchError });
      throw new Error(`Erreur récupération booking: ${fetchError.message}`);
    }
    
    // ✅ FUSION ATOMIQUE : Fusionner avec l'état actuel (pas l'état initial)
    const currentDocs = currentBooking?.documents_generated || {};
    const updatedDocs = {
      ...currentDocs,  // ✅ Utiliser l'état ACTUEL, pas booking.documents_generated
      policeForm: true,
      policeUrl: publicUrl,  // ✅ AJOUT : Sauvegarder l'URL du PDF généré
      policeGeneratedAt: new Date().toISOString()
    };
    
    const { error: updateError } = await supabase
      .from('bookings')
      .update({
        documents_generated: updatedDocs,
        updated_at: new Date().toISOString()
      })
      .eq('id', bookingId);
    
    if (updateError) {
      log('error', '❌ Erreur mise à jour booking', { error: updateError });
      throw new Error(`Erreur mise à jour booking: ${updateError.message}`);
    }

    log('info', '✅ Booking mis à jour avec fusion atomique', {
      hadContract: !!currentDocs.contract,
      hadPoliceForm: !!currentDocs.policeForm,
      newPoliceUrl: publicUrl.substring(0, 50) + '...',
      loadId
    });

    // =====================================================
    // RESPONSE
    // =====================================================
    
    const processingTime = Date.now() - startTime;
    
    // ✅ NOTE : Le verrou sera libéré dans le bloc finally
    // ✅ _debug : visible dans l'onglet Network (réponse API) si vous n'avez pas accès aux logs Dashboard
    const debugInfo = {
      signatureFound: !!guestSignatureData,
      signatureLength: guestSignatureData?.length ?? 0,
      signatureFormatOk: !!(guestSignatureData && guestSignatureData.startsWith('data:image/')),
      message: guestSignatureData
        ? 'Signature trouvée et intégrée au PDF'
        : 'Aucune signature en base (contract_signatures) pour ce booking — régénération après signature du contrat pour voir la signature'
    };

    return new Response(
      JSON.stringify({
        success: true,
        policeUrl: publicUrl,
        bookingId,
        guestsCount: uniqueGuests.length,
        totalGuestsBeforeDedupe: guests.length,
        duplicatesRemoved: guests.length - uniqueGuests.length,
        hasGuestSignature: !!guestSignatureData,
        processingTime,
        _debug: debugInfo
      }),
      { headers: corsHeaders }
    );

  } catch (error: any) {
    const processingTime = Date.now() - startTime;
    log('error', '❌ Erreur génération fiche de police', {
      error: error.message,
      stack: error.stack,
      processingTime,
      bookingId,
      loadId
    });
    
    // ✅ IMPORTANT : Libérer le verrou en cas d'erreur
    if (bookingId && loadId) {
      releaseLock(bookingId, loadId);
    }

    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
        processingTime
      }),
      { status: 500, headers: corsHeaders }
    );
  } finally {
    // ✅ IMPORTANT : Libérer le verrou à la fin (succès ou erreur)
    if (bookingId && loadId) {
      releaseLock(bookingId, loadId);
    }
  }
});
