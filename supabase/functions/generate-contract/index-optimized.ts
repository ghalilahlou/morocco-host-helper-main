import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { PDFDocument, StandardFonts, rgb } from "https://esm.sh/pdf-lib@1.17.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

// ✅ OPTIMISATION : Timeout global pour éviter les blocages
const FUNCTION_TIMEOUT = 25000; // 25 secondes
const DB_TIMEOUT = 10000; // 10 secondes pour les requêtes DB

// Fonction pour créer le client Supabase
async function getServerClient() {
  const url = Deno.env.get('SUPABASE_URL');
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!url || !key) {
    throw new Error('Missing Supabase credentials');
  }

  return createClient(url, key, { auth: { persistSession: false } });
}

// ✅ OPTIMISATION : Helper avec timeout pour éviter les blocages
async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, errorMessage: string): Promise<T> {
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error(errorMessage)), timeoutMs);
  });
  
  return Promise.race([promise, timeoutPromise]);
}

// ✅ OPTIMISATION : Signature placeholder local (pas de téléchargement externe)
function createSignaturePlaceholder(width: number = 200, height: number = 80): Uint8Array {
  // Créer un PNG minimal mais visible localement
  const canvas = new Uint8Array([
    0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, // PNG signature
    0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52, // IHDR chunk
    ...new Uint8Array(new Uint32Array([width]).buffer).reverse(), // width
    ...new Uint8Array(new Uint32Array([height]).buffer).reverse(), // height
    0x08, 0x02, 0x00, 0x00, 0x00, 0x20, 0x00, 0x00, // bit depth=8, color type=2 (RGB)
    0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4E, 0x44, // IEND chunk
    0xAE, 0x42, 0x60, 0x82
  ]);
  
  return canvas;
}

// ✅ OPTIMISATION : Requêtes parallèles avec timeout
async function fetchBookingFromDatabase(client: any, bookingId: string) {
  console.log('🔍 Fetching booking data...');
  
  // ✅ OPTIMISATION 1 : Requête unique avec toutes les jointures
  const bookingPromise = client
    .from('bookings')
    .select(`
      *,
      property:properties(*),
      guests(*),
      host:host_profiles!properties_user_id_fkey(full_name, first_name, last_name, phone, signature_svg, signature_image_url)
    `)
    .eq('id', bookingId)
    .maybeSingle();

  const { data: dbBooking, error: bookingError } = await withTimeout(
    bookingPromise,
    DB_TIMEOUT,
    'Database query timeout'
  );

  if (bookingError) {
    throw new Error(`Booking query failed: ${bookingError.message}`);
  }

  if (!dbBooking) {
    throw new Error(`Booking not found for ID: ${bookingId}`);
  }

  // ✅ OPTIMISATION 2 : Traitement simplifié des données
  if (dbBooking.guests && dbBooking.guests.length > 0) {
    dbBooking.guests = dbBooking.guests
      .filter(guest => guest.full_name?.trim())
      .map(guest => ({
        full_name: guest.full_name.trim(),
        date_of_birth: guest.date_of_birth || '',
        document_number: guest.document_number?.trim() || '',
        nationality: guest.nationality || 'Non spécifiée',
        document_type: guest.document_type || 'passport',
        place_of_birth: guest.place_of_birth || ''
      }));
  }

  console.log('✅ Booking data loaded:', { 
    id: dbBooking.id, 
    hasHost: !!dbBooking.host,
    guestsCount: dbBooking.guests?.length || 0 
  });

  return dbBooking;
}

// ✅ OPTIMISATION : Résolution simplifiée des variables hôte
async function resolveHostVariables(booking: any, signOptions: any = {}) {
  const hostSignerName = 
    signOptions.hostSignerName ||
    booking.host?.full_name ||
    (booking.host?.first_name && booking.host?.last_name ? 
      `${booking.host.first_name} ${booking.host.last_name}` : 
      booking.host?.first_name || booking.host?.last_name) ||
    booking.property?.contact_info?.name ||
    '';

  // Résolution de la signature avec priorité
  let hostSignatureData: string | null = null;
  let hostSignatureType: 'svg' | 'image' | null = null;

  if (booking.host?.signature_svg) {
    hostSignatureData = booking.host.signature_svg;
    hostSignatureType = 'svg';
  } else if (booking.host?.signature_image_url) {
    hostSignatureData = booking.host.signature_image_url;
    hostSignatureType = 'image';
  } else if (signOptions.hostSignatureData) {
    hostSignatureData = signOptions.hostSignatureData;
    hostSignatureType = signOptions.hostSignatureData.startsWith('data:image/svg') ? 'svg' : 'image';
  } else if (booking.property?.contract_template?.landlord_signature) {
    hostSignatureData = booking.property.contract_template.landlord_signature;
    hostSignatureType = 'image'; // Assume it's already converted
  }

  return { hostSignerName, hostSignatureData, hostSignatureType };
}

// ✅ OPTIMISATION : Génération PDF simplifiée
async function generateContractPDF(booking: any, signOpts: any = {}) {
  console.log('📄 Creating contract PDF...');
  
  const { guestSignatureData, guestSignedAt, hostSignatureData, hostSignerName } = signOpts;
  const guest = booking.guests?.[0] || {};
  const property = booking.property || {};
  
  const bailleurName = (hostSignerName || '').toString();
  const locataireName = (guest.full_name || 'Locataire').toString();

  // ✅ OPTIMISATION : Contenu simplifié
  const contractContent = `
CONTRAT DE LOCATION SAISONNIERE (COURTE DUREE)

Entre les soussignes :

LE BAILLEUR (PROPRIETAIRE/HOST)
Nom et prenom : ${bailleurName}
Adresse : ${property.address || 'Non specifiee'}

ET

LE LOCATAIRE (VOYAGEUR/GUEST)
Nom et prenom : ${guest.full_name || 'Non specifie'}
Nationalite : ${guest.nationality || 'Non specifiee'}
N° de piece d'identite (CIN ou passeport) : ${guest.document_number || 'Non specifie'}

Denommes ensemble "les Parties".

ARTICLE 1 - OBJET DU CONTRAT
Le present contrat a pour objet la location saisonniere, meublee et equipee, du bien ci-apres designe, a usage exclusif d'habitation.

ARTICLE 2 - DESIGNATION DU BIEN
Adresse du bien loue : ${property.address || 'Non specifiee'}
Type du bien : ${property.property_type || 'Non specifie'}
Capacite maximale : ${property.max_guests || 'Non specifiee'} personnes

ARTICLE 3 - DUREE DE LA LOCATION
La location est conclue pour la periode suivante :
- Date d'arrivee : ${booking.check_in_date || 'Non specifiee'}
- Date de depart : ${booking.check_out_date || 'Non specifiee'}
Le locataire s'engage a quitter les lieux a la date et l'heure convenues.

ARTICLE 4 - PRIX ET PAIEMENT
Le prix du sejour est celui convenu via la plateforme de reservation en ligne utilisee par les Parties.
Le paiement du loyer est effectue exclusivement en ligne via ladite plateforme.

ARTICLE 5 - ETAT DU LOGEMENT
Le logement est remis au Locataire en bon etat, meuble et equipe.
Un etat des lieux peut etre etabli a l'arrivee et au depart.
Le Locataire s'engage a restituer le logement dans l'etat initial.

ARTICLE 6 - OBLIGATIONS DU LOCATAIRE
Le Locataire s'engage a :
- Utiliser le logement uniquement pour l'habitation
- Respecter la capacite maximale d'accueil
- Ne pas organiser de fetes, evenements ou activites commerciales
- Respecter la tranquillite du voisinage
- Ne pas sous-louer ni ceder le contrat
- Ne pas fumer a l'interieur du logement
- Respecter les regles de la maison

ARTICLE 7 - OBLIGATIONS DU BAILLEUR
Le Bailleur s'engage a :
- Fournir un logement propre, en bon etat et conforme a la description
- Garantir au Locataire la jouissance paisible du bien loue

ARTICLE 8 - RESPONSABILITE
Le Locataire est responsable des dommages ou pertes causes durant son sejour.
Le Bailleur decline toute responsabilite en cas de vol ou perte d'effets personnels.

ARTICLE 9 - RESILIATION
En cas de manquement grave aux obligations du present contrat, le Bailleur pourra resilier la location de plein droit, sans indemnite pour le Locataire.

ARTICLE 10 - LOI APPLICABLE
Le present contrat est soumis au droit marocain.
En cas de litige, competence exclusive est donnee aux tribunaux du ressort ou se situe le bien.

Fait a ${property.city || 'Casablanca'}, le ${new Date().toLocaleDateString('fr-FR')}

SIGNATURES
`.trim();

  // ✅ OPTIMISATION : Mise en page simplifiée
  const pageWidth = 612, pageHeight = 792;
  const margin = 50;
  const maxWidth = pageWidth - margin * 2;
  const titleSize = 16, sectionSize = 12, bodySize = 11, footerSize = 9;
  const lineGap = 14;

  const pdfDoc = await PDFDocument.create();
  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  let pages: any[] = [];
  let currentPage = addPage();
  let y = pageHeight - margin;

  function addPage() {
    const p = pdfDoc.addPage([pageWidth, pageHeight]);
    pages.push(p);
    return p;
  }

  function ensureSpace(h: number) {
    if (y - h < margin) {
      currentPage = addPage();
      y = pageHeight - margin;
    }
  }

  function drawLine(x1: number, y1: number, x2: number, y2: number) {
    currentPage.drawLine({ start: { x: x1, y: y1 }, end: { x: x2, y: y2 }, color: rgb(0,0,0), thickness: 0.5 });
  }

  function drawText(text: string, x: number, size: number, font = fontRegular) {
    const height = size;
    ensureSpace(height + 2);
    currentPage.drawText(text, { x, y, size, font });
    y -= lineGap;
  }

  function wrapText(text: string, width: number, size: number, font = fontRegular) {
    const words = text.split(/\s+/);
    const lines: string[] = [];
    let line = "";
    for (const w of words) {
      const test = line ? line + " " + w : w;
      const testWidth = font.widthOfTextAtSize(test, size);
      if (testWidth <= width) {
        line = test;
      } else {
        if (line) lines.push(line);
        line = w;
      }
    }
    if (line) lines.push(line);
    return lines;
  }

  function drawParagraph(text: string, size = bodySize, bold = false) {
    const font = bold ? fontBold : fontRegular;
    const lines = wrapText(text, maxWidth, size, font);
    for (const l of lines) {
      ensureSpace(size + 2);
      currentPage.drawText(l, { x: margin, y, size, font });
      y -= lineGap;
    }
  }

  function drawSectionTitle(text: string) {
    ensureSpace(sectionSize + 6);
    currentPage.drawText(text, { x: margin, y, size: sectionSize, font: fontBold });
    y -= lineGap;
  }

  function drawFooter() {
    const total = pages.length;
    pages.forEach((p, i) => {
      p.drawText(`Page ${i+1}/${total}`, { x: pageWidth - margin - 60, y: margin - 20, size: footerSize, font: fontRegular });
    });
  }

  // ✅ OPTIMISATION : Signature simplifiée
  async function drawSignaturesArea() {
    const colGap = 50;
    const colW = (maxWidth - colGap) / 2;
    const col1 = margin;
    const col2 = margin + colW + colGap;

    drawSectionTitle('SIGNATURES');

    ensureSpace(40);
    currentPage.drawText('Le Bailleur :', { x: col1, y, size: bodySize, font: fontBold });
    currentPage.drawText('Le Locataire :', { x: col2, y, size: bodySize, font: fontBold });
    y -= 16;

    // Noms et dates
    y = y - 18;
    currentPage.drawText(bailleurName || 'Proprietaire', { x: col1, y, size: bodySize, font: fontRegular });
    currentPage.drawText(locataireName || 'Locataire', { x: col2, y, size: bodySize, font: fontRegular });
    y -= lineGap;

    currentPage.drawText('Date : _______________', { x: col1, y, size: bodySize, font: fontRegular });
    currentPage.drawText('Date : _______________', { x: col2, y, size: bodySize, font: fontRegular });
    y -= lineGap + 20;

    // ✅ OPTIMISATION : Signature hôte simplifiée
    if (hostSignatureData && !hostSignatureData.startsWith('data:image/svg')) {
      try {
        const clean = hostSignatureData.replace(/^data:image\/[^;]+;base64,/, '');
        const signatureBytes = Uint8Array.from(atob(clean), c => c.charCodeAt(0));
        
        let img;
        try {
          img = await pdfDoc.embedPng(signatureBytes);
        } catch {
          img = await pdfDoc.embedJpg(signatureBytes);
        }
        
        const maxWidth = 200;
        const maxHeight = 80;
        const aspect = img.width / img.height;
        let width = maxWidth;
        let height = maxWidth / aspect;
        if (height > maxHeight) {
          height = maxHeight;
          width = maxHeight * aspect;
        }
        
        currentPage.drawImage(img, {
          x: col1,
          y: y - height,
          width,
          height
        });
        
        y -= height + 10;
      } catch (e) {
        console.warn('Failed to embed host signature:', e);
      }
    }

    // Signature invité
    if (guestSignatureData && !guestSignatureData.startsWith('data:image/svg')) {
      try {
        const clean = guestSignatureData.replace(/^data:image\/[^;]+;base64,/, '');
        const signatureBytes = Uint8Array.from(atob(clean), c => c.charCodeAt(0));
        
        let img;
        try {
          img = await pdfDoc.embedPng(signatureBytes);
        } catch {
          img = await pdfDoc.embedJpg(signatureBytes);
        }
        
        const maxWidth = 200;
        const maxHeight = 80;
        const aspect = img.width / img.height;
        let width = maxWidth;
        let height = maxWidth / aspect;
        if (height > maxHeight) {
          height = maxHeight;
          width = maxHeight * aspect;
        }
        
        currentPage.drawImage(img, {
          x: col2,
          y: y - height,
          width,
          height
        });
      } catch (e) {
        console.warn('Failed to embed guest signature:', e);
      }
    }

    // Mentions électroniques
    if (guestSignatureData) {
      drawParagraph(`Signature électronique locataire intégrée — Validée le ${guestSignedAt ? new Date(guestSignedAt).toLocaleDateString('fr-FR') : new Date().toLocaleDateString('fr-FR')}`, 10);
    }
    if (hostSignatureData) {
      drawParagraph(`Signature électronique bailleur intégrée — Validée le ${new Date().toLocaleDateString('fr-FR')}`, 10);
    }
  }

  // ✅ OPTIMISATION : Génération simplifiée
  drawText("CONTRAT DE LOCATION SAISONNIERE (COURTE DUREE)", margin, titleSize, fontBold);
  ensureSpace(8);
  drawLine(margin, y, pageWidth - margin, y);
  y -= 10;

  // Bloc bailleur en en-tête
  ensureSpace(70);
  const label = `Bailleur : ${bailleurName || ''}`;
  currentPage.drawText(label, { x: pageWidth - margin - 250, y, size: bodySize, font: fontBold });
  y -= lineGap;
  drawLine(margin, y, pageWidth - margin, y);
  y -= 10;

  // Contenu du contrat
  const blocks = contractContent.split("\n").map(s => s.trim());
  let pendingSignatures = false;

  for (let i = 0; i < blocks.length; i++) {
    const line = blocks[i];
    if (!line) { y -= 6; continue; }

    if (line.startsWith("ARTICLE ")) {
      drawSectionTitle(line);
    } else if (line === 'SIGNATURES') {
      await drawSignaturesArea();
      pendingSignatures = true;
    } else if (pendingSignatures) {
      continue;
    } else if (/^LE BAILLEUR|^LE LOCATAIRE|^Entre les soussignes|^ET$|^Denommes ensemble/.test(line)) {
      drawParagraph(line);
    } else {
      drawParagraph(line);
    }
  }

  drawFooter();

  const pdfBytes = await pdfDoc.save();
  const base64 = btoa(String.fromCharCode(...new Uint8Array(pdfBytes)));
  
  console.log('✅ Contract PDF created successfully');
  console.log('📄 PDF size:', pdfBytes.length, 'bytes');
  
  return `data:application/pdf;base64,${base64}`;
}

// ✅ OPTIMISATION : Fonction principale avec timeout
async function generateContract(client: any, booking: any, signOptions: any = {}) {
  console.log('📄 Generating contract...');
  
  const { hostSignerName, hostSignatureData } = await resolveHostVariables(booking, signOptions);
  
  const documentUrl = await withTimeout(
    generateContractPDF(booking, {
      ...signOptions,
      hostSignerName,
      hostSignatureData,
    }),
    15000, // 15 secondes pour la génération PDF
    'PDF generation timeout'
  );
  
  // ✅ OPTIMISATION : Sauvegarde simplifiée
  const { data: documentRecord, error } = await client
    .from('generated_documents')
    .insert({
      booking_id: booking.id,
      document_type: 'contract',
      file_name: `contract-${booking.id}-${Date.now()}.pdf`,
      document_url: documentUrl,
      is_signed: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to save document: ${error.message}`);
  }
  
  return {
    documentUrl,
    documentId: documentRecord.id,
    message: 'Contract generated successfully',
    signed: false
  };
}

// ✅ OPTIMISATION : Validation simplifiée
function validateBookingId(bookingId: string) {
  if (!bookingId || typeof bookingId !== 'string') {
    throw new Error('Invalid bookingId');
  }
  
  if (bookingId.startsWith('temp-')) {
    throw new Error(`Temporary booking ID detected: ${bookingId}`);
  }
  
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(bookingId)) {
    throw new Error(`Invalid UUID format for bookingId: ${bookingId}`);
  }
}

// ✅ OPTIMISATION : Handler principal avec timeout global
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // ✅ OPTIMISATION : Timeout global pour toute la fonction
    const result = await withTimeout(
      handleRequest(req),
      FUNCTION_TIMEOUT,
      'Function execution timeout'
    );
    
    return result;
  } catch (error) {
    console.error('❌ Function error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: {
        message: error.message || 'Unknown error',
        code: 'FUNCTION_ERROR'
      }
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

async function handleRequest(req: Request) {
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
  
  const { bookingId, action = 'generate', hostSignatureData, hostSignerName } = requestData;

  // ✅ OPTIMISATION : Validation rapide
  validateBookingId(bookingId);

  // ✅ OPTIMISATION : Récupération des données avec timeout
  const booking = await withTimeout(
    fetchBookingFromDatabase(client, bookingId),
    DB_TIMEOUT,
    'Database fetch timeout'
  );
  
  if (!booking.property) {
    throw new Error('Property not found for booking');
  }

  // ✅ OPTIMISATION : Génération avec timeout
  const result = await withTimeout(
    generateContract(client, booking, { hostSignatureData, hostSignerName }),
    20000, // 20 secondes pour la génération complète
    'Contract generation timeout'
  );

  return new Response(JSON.stringify({
    success: true,
    documentUrl: result.documentUrl,
    documentId: result.documentId,
    message: result.message,
    signed: result.signed
  }), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}


