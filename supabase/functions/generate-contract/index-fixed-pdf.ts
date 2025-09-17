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

// ✅ NOUVELLE FONCTION PDF COMPLÈTEMENT REFACTORISÉE
function createSimplePDF(content: string): string {
  const lines = content.split('\n');
  let pdfContent = '';
  let currentY = 700; // Position Y de départ
  const lineHeight = 18; // Espacement généreux
  const leftMargin = 50;
  const pageWidth = 612;
  const pageHeight = 792;
  const bottomMargin = 120; // Marge importante
  let pageNumber = 1;
  
  // Fonction pour nettoyer le texte (version simplifiée)
  function cleanText(text: string): string {
    return text
      .replace(/[()\\]/g, '\\$&')
      .replace(/[àáâãäåÀÁÂÃÄÅ]/g, 'a')
      .replace(/[èéêëÈÉÊË]/g, 'e')
      .replace(/[ìíîïÌÍÎÏ]/g, 'i')
      .replace(/[òóôõöÒÓÔÕÖ]/g, 'o')
      .replace(/[ùúûüÙÚÛÜ]/g, 'u')
      .replace(/[ýÿÝŸ]/g, 'y')
      .replace(/[çÇ]/g, 'c')
      .replace(/[ñÑ]/g, 'n')
      .replace(/[«»]/g, '"')
      .replace(/[°]/g, 'o')
      .replace(/[æÆ]/g, 'ae')
      .replace(/[œŒ]/g, 'oe')
      .replace(/[–—]/g, '-')
      .replace(/['']/g, "'")
      .replace(/[""]/g, '"')
      .trim();
  }
  
  // Fonction pour ajouter du texte
  function addText(text: string, x: number, y: number, fontSize: number = 10, isBold: boolean = false) {
    const font = isBold ? '/F2' : '/F1';
    const cleanTextValue = cleanText(text);
    pdfContent += `BT\n${font} ${fontSize} Tf\n${x} ${y} Td\n(${cleanTextValue}) Tj\nET\n`;
  }
  
  // Fonction pour dessiner une ligne
  function drawLine(x1: number, y1: number, x2: number, y2: number) {
    pdfContent += `${x1} ${y1} m\n${x2} ${y2} l\nS\n`;
  }
  
  // Fonction pour créer une nouvelle page
  function newPage() {
    if (pageNumber > 1) {
      pdfContent += 'ET\n';
    }
    pageNumber++;
    currentY = pageHeight - 80; // Commencer plus bas
    pdfContent += 'BT\n';
    addText(`Page ${pageNumber}`, pageWidth - 100, 30, 8);
  }
  
  // Fonction pour vérifier l'espace et créer une nouvelle page si nécessaire
  function checkSpace(requiredSpace: number = lineHeight) {
    if (currentY - requiredSpace < bottomMargin) {
      newPage();
      return true;
    }
    return false;
  }
  
  // Fonction pour ajouter un espacement
  function addSpace(space: number = lineHeight) {
    currentY -= space;
    if (currentY < bottomMargin) {
      newPage();
    }
  }
  
  // Commencer le PDF
  pdfContent += 'BT\n';
  addText('Page 1', pageWidth - 100, 30, 8);
  
  // Traiter chaque ligne
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    // Lignes vides
    if (line.length === 0) {
      addSpace(10);
      continue;
    }
    
    // Titre principal
    if (line.includes('CONTRAT DE LOCATION SAISONNIERE')) {
      checkSpace(60);
      addText(line, leftMargin, currentY, 18, true);
      addSpace(40);
      drawLine(leftMargin, currentY, leftMargin + 500, currentY);
      addSpace(35);
    }
    // Articles
    else if (line.startsWith('ARTICLE')) {
      checkSpace(35);
      addSpace(20);
      addText(line, leftMargin, currentY, 14, true);
      addSpace(30);
    }
    // Section Signatures
    else if (line.includes('SIGNATURES')) {
      checkSpace(120);
      addSpace(25);
      addText(line, leftMargin, currentY, 14, true);
      addSpace(40);
      
      // Labels de signature
      checkSpace(80);
      addText('Le Bailleur :', leftMargin, currentY, 12, true);
      addText('Le Locataire :', leftMargin + 250, currentY, 12, true);
      addSpace(35);
      
      // Lignes de signature
      drawLine(leftMargin, currentY, leftMargin + 200, currentY);
      drawLine(leftMargin + 250, currentY, leftMargin + 450, currentY);
      addSpace(40);
      
      // Noms
      addText('Proprietaire', leftMargin, currentY, 12);
      addText('Locataire', leftMargin + 250, currentY, 12);
      addSpace(40);
      
      // Dates
      addText('Date : _______________', leftMargin, currentY, 12);
      addText('Date : _______________', leftMargin + 250, currentY, 12);
      addSpace(60);
    }
    // Ignorer les lignes de signature déjà traitées
    else if (line.includes('Le Bailleur :') || line.includes('Le Locataire :') || 
             line.includes('Date :') || line.includes('SIGNATURE ELECTRONIQUE') ||
             line.includes('Entre les soussignes')) {
      continue;
    }
    // Lignes normales
    else {
      checkSpace();
      
      // Gérer les lignes trop longues
      if (line.length > 60) {
        const words = line.split(' ');
        let currentLine = '';
        
        for (const word of words) {
          if ((currentLine + word + ' ').length > 60) {
            if (currentLine.trim()) {
              addText(currentLine.trim(), leftMargin, currentY, 12);
              addSpace();
            }
            currentLine = word + ' ';
          } else {
            currentLine += word + ' ';
          }
        }
        
        if (currentLine.trim()) {
          addText(currentLine.trim(), leftMargin, currentY, 12);
          addSpace();
        }
      } else {
        addText(line, leftMargin, currentY, 12);
        addSpace();
      }
    }
  }
  
  pdfContent += 'ET';
  
  // Calculer la longueur du contenu
  const contentLength = pdfContent.length + 200;
  
  // Créer le PDF final
  const finalPDF = `%PDF-1.4
1 0 obj
<<
/Type /Catalog
/Pages 2 0 R
>>
endobj

2 0 obj
<<
/Type /Pages
/Kids [3 0 R]
/Count ${pageNumber}
>>
endobj

3 0 obj
<<
/Type /Page
/Parent 2 0 R
/MediaBox [0 0 612 792]
/Contents 4 0 R
/Resources <<
/Font <<
/F1 5 0 R
/F2 6 0 R
>>
>>
>>
endobj

4 0 obj
<<
/Length ${contentLength}
>>
stream
${pdfContent}
endstream
endobj

5 0 obj
<<
/Type /Font
/Subtype /Type1
/BaseFont /Helvetica
>>
endobj

6 0 obj
<<
/Type /Font
/Subtype /Type1
/BaseFont /Helvetica-Bold
>>
endobj

xref
0 7
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
0000000274 00000 n 
0000000${(contentLength + 274).toString().padStart(3, '0')} 00000 n 
0000000${(contentLength + 350).toString().padStart(3, '0')} 00000 n 
trailer
<<
/Size 7
/Root 1 0 R
>>
startxref
${contentLength + 350 + 100}
%%EOF`;

  return finalPDF;
}

// Generate contract PDF (simplified version)
async function generateContractPDF(booking: any, signatureData?: any, signedAt?: any) {
  console.log('📄 Creating contract PDF...');
  
  const guest = booking.guests?.[0] || {};
  const property = booking.property || {};
  
  console.log('🔍 Guest data:', { name: guest.full_name, nationality: guest.nationality, document: guest.document_number });
  console.log('🔍 Property data:', { name: property.contact_info?.name, address: property.address, city: property.city });
  
  const contractContent = `
CONTRAT DE LOCATION SAISONNIERE (COURTE DUREE)

Entre les soussignes :

LE BAILLEUR (PROPRIETAIRE/HOST)
Nom et prenom : ${property.contact_info?.name || 'Non specifie'}
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

Le Bailleur :                    Le Locataire :
${property.contact_info?.name || 'Proprietaire'}    ${guest.full_name || 'Locataire'}

Date : _______________           Date : _______________

${signatureData ? '\n\nSIGNATURE ELECTRONIQUE INTEGREE' : ''}
${signatureData ? 'Validee le ' + (signedAt ? new Date(signedAt).toLocaleDateString('fr-FR') : new Date().toLocaleDateString('fr-FR')) : ''}
  `.trim();

  console.log('📝 Contract content length:', contractContent.length);
  console.log('📝 Contract lines count:', contractContent.split('\n').length);
  
  // Créer le PDF avec la nouvelle fonction
  const pdfContent = createSimplePDF(contractContent);
  
  console.log('📄 PDF content length:', pdfContent.length);
  console.log('📄 PDF starts with:', pdfContent.substring(0, 20));
  
  // Encoder en base64
  const utf8Bytes = new TextEncoder().encode(pdfContent);
  const base64 = btoa(Array.from(utf8Bytes, byte => String.fromCharCode(byte)).join(''));
  
  console.log('🔐 Base64 length:', base64.length);
  
  // Créer l'URL du document
  const documentUrl = `data:application/pdf;base64,${base64}`;
  
  console.log('✅ Contract PDF created successfully');
  console.log('📄 Document URL generated:', documentUrl.substring(0, 50) + '...');
  
  return documentUrl;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: corsHeaders
    });
  }

  try {
    console.log('🚀 generate-contract function started');
    
    if (req.method !== 'POST') {
      return new Response(JSON.stringify({
        success: false,
        message: 'Method Not Allowed'
      }), {
        status: 405,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }

    const client = await getServerClient();
    const requestData = await req.json();
    console.log('📥 Request data:', requestData);

    const { bookingId, signatureData, signedAt, action = 'generate' } = requestData;

    // Validation
    if (!bookingId) {
      return new Response(JSON.stringify({
        success: false,
        message: 'bookingId is required'
      }), {
        status: 400,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }

    // Fetch booking data (simplified)
    const { data: booking, error: bookingError } = await client
      .from('bookings')
      .select(`
        *,
        property:properties(*),
        guests(*)
      `)
      .eq('id', bookingId)
      .maybeSingle();

    if (bookingError || !booking) {
      return new Response(JSON.stringify({
        success: false,
        message: 'Booking not found'
      }), {
        status: 404,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }

    // Generate contract
    const documentUrl = await generateContractPDF(booking, signatureData, signedAt);
    
    return new Response(JSON.stringify({
      success: true,
      documentUrl,
      message: 'Contract generated successfully'
    }), {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });

  } catch (error) {
    console.error('❌ Error in generate-contract:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  }
});
