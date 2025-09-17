# Script de déploiement manuel des Edge Functions
# Copiez et collez ce code dans le Dashboard Supabase

## Instructions:
# 1. Allez sur https://supabase.com/dashboard/project/csopyblkfyofwkeqqegd/functions
# 2. Pour chaque fonction, cliquez sur "Edit" ou "Create"
# 3. Copiez le code correspondant
# 4. Sauvegardez


## Fonction: generate-contract
# Copiez ce code dans le Dashboard:

```typescript
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Types
interface Guest {
  full_name: string;
  date_of_birth: string;
  document_number: string;
  nationality: string;
  document_type: string;
  place_of_birth?: string;
}

interface Property {
  id: string;
  name: string;
  address: string;
  contract_template?: {
    landlord_company?: string;
    landlord_registration?: string;
    landlord_address?: string;
    landlord_name?: string;
    statut?: string;
    landlord_status?: string;
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
    console.log('🚀 generate-contract function started');

    if (req.method !== 'POST') {
      return new Response(JSON.stringify({
        success: false,
        message: 'Method Not Allowed'
      }), {
        status: 405,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error('Missing required environment variables');
    }

    const client = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false }
    });

    const requestData = await req.json();
    console.log('📥 Request data:', requestData);

    const { bookingId, signatureData, signedAt, action = 'generate' } = requestData;

    if (!bookingId) {
      return new Response(JSON.stringify({
        success: false,
        message: 'bookingId is required'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Fetch booking data
    const booking = await fetchBookingFromDatabase(client, bookingId);

    if (!booking.property) {
      return new Response(JSON.stringify({
        success: false,
        message: 'Property not found for booking'
      }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    let result;

    switch (action) {
      case 'generate':
        result = await generateContract(client, booking);
        break;
      case 'sign':
        result = await signContract(client, booking, signatureData, signedAt);
        break;
      case 'regenerate':
        result = await regenerateContract(client, booking, signatureData, signedAt);
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

    
      success: true,
      message: result.message,
      documentUrl: result.documentUrl,
      documentId: result.documentId,
      signed: result.signed || false,
      // ✅ CORRECTION : Ajouter la rétrocompatibilité
      documentUrls: result.documentUrl ? [result.documentUrl] : [],
      documents: result.documentUrl ? [{ url: result.documentUrl, type: 'contract' }] : []
    , {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('❌ Error in generate-contract:', error);
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
  console.log('🔍 Fetching booking from database:', bookingId);
  
  const { data: dbBooking, error: bookingError } = await client
    .from('bookings')
    .select(`
      *,
      property:properties(*),
      guests(*)
    `)
    .eq('id', bookingId)
    .single();

  console.log('🔍 Booking query result:', { dbBooking, bookingError });

  if (bookingError) {
    console.error('❌ Booking query error:', bookingError);
    throw new Error(`Booking query failed: ${bookingError.message}`);
  }

  if (!dbBooking) {
    console.error('❌ No booking found for ID:', bookingId);
    throw new Error('Booking not found');
  }

  console.log('✅ Booking found:', { id: dbBooking.id, property: dbBooking.property?.name });

  // ✅ CORRECTION : Enrichir avec les données d'invités réelles
  try {
    // Essayer d'abord avec v_guest_submissions
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
        }
      }
    } else {
      // ✅ FALLBACK : Si v_guest_submissions ne fonctionne pas, utiliser la table guests directement
      console.log('🔄 Fallback: Récupération directe depuis la table guests...');
      const { data: directGuests } = await client
        .from('guests')
        .select('*')
        .eq('booking_id', bookingId);

      if (directGuests && directGuests.length > 0) {
        dbBooking.guests = directGuests.map(guest => ({
          full_name: guest.full_name || '',
          date_of_birth: guest.date_of_birth || '',
          document_number: guest.document_number || '',
          nationality: guest.nationality || 'Non spécifiée',
          document_type: guest.document_type || 'passport',
          place_of_birth: guest.place_of_birth || ''
        }));
        console.log(`✅ ${directGuests.length} invités récupérés directement`);
      }
    }
  } catch (enrichError) {
    console.error('❌ Error enriching with guest data:', enrichError);
    // Ne pas faire échouer la fonction, continuer avec les données de base
  }

  return dbBooking;
}

// Generate new contract
async function generateContract(client: any, booking: Booking) {
  console.log('📄 Generating contract...');
  
  const documentUrl = await generateContractPDF(booking, null, null);
  
  // Save to database
  const documentRecord = await saveDocumentToDatabase(
    client, 
    booking.id, 
    'contract', 
    documentUrl, 
    false
  );

  return {
    documentUrl,
    documentId: documentRecord.id,
    message: 'Contract generated successfully',
    signed: false
  };
}

// Sign existing contract
async function signContract(client: any, booking: Booking, signatureData?: string, signedAt?: string) {
  console.log('🖊️ Signing contract...');
  
  // Fetch guest signature if not provided
  let guestSignatureUrl = signatureData;
  let signerInfo = null;
  
  if (!signatureData && booking.id) {
    try {
      const { data: sig } = await client
        .from('contract_signatures')
        .select('signature_data, signer_name, signed_at, created_at')
        .eq('booking_id', booking.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      
      if (sig) {
        guestSignatureUrl = sig.signature_data;
        signerInfo = sig;
      }
    } catch (error) {
      console.error('❌ Failed to fetch guest signature:', error);
    }
  }
  
  if (!guestSignatureUrl) {
    throw new Error('Signature data is required for signing');
  }

  // Get existing document
  const { data: existingDoc, error } = await client
    .from('uploaded_documents')
    .select('*')
    .eq('booking_id', booking.id)
    .eq('document_type', 'contract')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !existingDoc) {
    throw new Error('No existing contract found to sign');
  }

  // Generate signed version
  const signedDocumentUrl = await generateContractPDF(booking, guestSignatureUrl, signedAt || signerInfo?.signed_at);

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
    throw new Error(`Failed to update signed contract: ${updateError.message}`);
  }

  return {
    documentUrl: signedDocumentUrl,
    documentId: updatedDoc.id,
    message: 'Contract signed successfully',
    signed: true
  };
}

// Regenerate contract
async function regenerateContract(client: any, booking: Booking, signatureData?: string, signedAt?: string) {
  console.log('🔄 Regenerating contract...');
  
  const documentUrl = await generateContractPDF(booking, signatureData, signedAt);

  // Update or create document
  const { data: existingDoc } = await client
    .from('uploaded_documents')
    .select('*')
    .eq('booking_id', booking.id)
    .eq('document_type', 'contract')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  let documentId: string;

  if (existingDoc) {
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
      throw new Error(`Failed to update contract: ${updateError.message}`);
    }
    
    documentId = updatedDoc.id;
  } else {
    const documentRecord = await saveDocumentToDatabase(
      client, 
      booking.id, 
      'contract', 
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
    message: 'Contract regenerated successfully',
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

  return documentRecord;
}

// Generate contract PDF (simplified version)
async function generateContractPDF(booking: Booking, signatureData?: string, signedAt?: string): Promise<string> {
  console.log('📄 Creating contract PDF...');
  
  const { PDFDocument, StandardFonts, rgb } = await import('https://esm.sh/pdf-lib@1.17.1');
  
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([595, 842]);
  
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  
  let yPosition = 800;
  const lineHeight = 20;
  const margin = 50;
  
  // Helper function to add text
  const addText = (text: string, x: number, y: number, size: number = 12, isBold: boolean = false) => {
    page.drawText(text, {
      x, y, size,
      font: isBold ? boldFont : font,
      color: rgb(0, 0, 0)
    });
  };
  
  // Title
  addText('CONTRAT DE LOCATION SAISONNIERE', margin, yPosition, 16, true);
  yPosition -= 40;
  
  // Property info
  addText('BAILLEUR:', margin, yPosition, 12, true);
  yPosition -= lineHeight;
  addText(booking.property?.name || 'Nom de la propriete', margin + 20, yPosition);
  yPosition -= lineHeight;
  addText(`Adresse: ${booking.property?.address || 'Adresse non specifiee'}`, margin + 20, yPosition);
  yPosition -= 30;
  
  // Guest info
  addText('LOCATAIRE:', margin, yPosition, 12, true);
  yPosition -= lineHeight;
  const guests = booking.guests || [];
  if (guests.length > 0) {
    const mainGuest = guests[0];
    addText(mainGuest.full_name || 'Nom non fourni', margin + 20, yPosition);
    yPosition -= lineHeight;
    addText(`Ne(e) le: ${mainGuest.date_of_birth || 'Date non fournie'}`, margin + 20, yPosition);
    yPosition -= lineHeight;
    addText(`Document: ${mainGuest.document_number || 'Document non fourni'}`, margin + 20, yPosition);
    yPosition -= lineHeight;
    addText(`Nationalite: ${mainGuest.nationality || 'Nationalite non fournie'}`, margin + 20, yPosition);
  }
  yPosition -= 30;
  
  // Booking dates
  addText('PERIODE DE LOCATION:', margin, yPosition, 12, true);
  yPosition -= lineHeight;
  addText(`Du: ${booking.check_in_date || 'Date non specifiee'}`, margin + 20, yPosition);
  yPosition -= lineHeight;
  addText(`Au: ${booking.check_out_date || 'Date non specifiee'}`, margin + 20, yPosition);
  yPosition -= lineHeight;
  addText(`Nombre d'invites: ${guests.length || booking.number_of_guests || 1}`, margin + 20, yPosition);
  yPosition -= 30;
  
  // Terms
  addText('CONDITIONS GENERALES:', margin, yPosition, 12, true);
  yPosition -= lineHeight;
  addText('1. Le locataire s\'engage a respecter les regles de la propriete', margin + 20, yPosition);
  yPosition -= lineHeight;
  addText('2. Le locataire est responsable de tous dommages causes pendant son sejour', margin + 20, yPosition);
  yPosition -= lineHeight;
  addText('3. Le locataire accepte de laisser la propriete dans l\'etat ou il l\'a trouvee', margin + 20, yPosition);
  yPosition -= lineHeight;
  addText('4. Aucune fete ou evenement bruyant n\'est autorise', margin + 20, yPosition);
  yPosition -= lineHeight;
  addText('5. Le nombre maximum d\'occupants ne peut etre depasse', margin + 20, yPosition);
  yPosition -= 40;
  
  // Signature section
  addText('SIGNATURES:', margin, yPosition, 12, true);
  yPosition -= 30;
  addText('PROPRIETAIRE:', margin, yPosition);
  addText('LOCATAIRE:', margin + 300, yPosition);
  yPosition -= 60;
  addText('_________________________', margin, yPosition);
  addText('_________________________', margin + 300, yPosition);
  yPosition -= 20;
  addText(`Date: ${new Date().toLocaleDateString('fr-FR')}`, margin, yPosition);
  addText(`Date: ${new Date().toLocaleDateString('fr-FR')}`, margin + 300, yPosition);
  
  // Add host signature if available in property contract template
  if (booking.property?.contract_template?.landlord_signature) {
    try {
      const hostSignatureData = booking.property.contract_template.landlord_signature;
      const cleanHostSignature = hostSignatureData.replace(/^data:image\/[^;]+;base64,/, '');
      let hostSignatureImage;
      try {
        hostSignatureImage = await pdfDoc.embedPng(Uint8Array.from(atob(cleanHostSignature), (c) => c.charCodeAt(0)));
      } catch {
        hostSignatureImage = await pdfDoc.embedJpg(Uint8Array.from(atob(cleanHostSignature), (c) => c.charCodeAt(0)));
      }
      
      const maxWidth = 200;
      const maxHeight = 80;
      const aspectRatio = hostSignatureImage.width / hostSignatureImage.height;
      let width = maxWidth;
      let height = maxWidth / aspectRatio;
      if (height > maxHeight) {
        height = maxHeight;
        width = maxHeight * aspectRatio;
      }
      
      page.drawImage(hostSignatureImage, {
        x: margin,
        y: yPosition - 100,
        width: width,
        height: height
      });
      
      console.log('✅ Host signature added to contract');
    } catch (error) {
      console.error('❌ Error adding host signature:', error);
    }
  } else {
    console.log('⚠️ No host signature found in property contract template');
  }
  
  // Add guest signature if available
  if (signatureData) {
    try {
      const cleanSignature = signatureData.replace(/^data:image\/[^;]+;base64,/, '');
      let signatureImage;
      try {
        signatureImage = await pdfDoc.embedPng(Uint8Array.from(atob(cleanSignature), (c) => c.charCodeAt(0)));
      } catch {
        signatureImage = await pdfDoc.embedJpg(Uint8Array.from(atob(cleanSignature), (c) => c.charCodeAt(0)));
      }
      
      const maxWidth = 200;
      const maxHeight = 80;
      const aspectRatio = signatureImage.width / signatureImage.height;
      let width = maxWidth;
      let height = maxWidth / aspectRatio;
      if (height > maxHeight) {
        height = maxHeight;
        width = maxHeight * aspectRatio;
      }
      
      page.drawImage(signatureImage, {
        x: margin + 300,
        y: yPosition - 100,
        width: width,
        height: height
      });
      
      console.log('✅ Guest signature added to contract');
    } catch (error) {
      console.error('❌ Error adding guest signature:', error);
    }
  }
  
  const pdfBytes = await pdfDoc.save();
  const base64 = btoa(String.fromCharCode(...pdfBytes));
  return `data:application/pdf;base64,${base64}`;
}
```

---

## Fonction: save-contract-signature
# Copiez ce code dans le Dashboard:

```typescript
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { getServerClient } from "../_shared/serverClient.ts";

type Payload = {
  bookingId: string;
  signerName: string;
  signerEmail?: string | null;
  signerPhone?: string | null;
  signatureDataUrl: string; // data:image/png;base64,....
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function badRequest(msg: string) {
  return new Response(JSON.stringify({ error: msg }), { 
    status: 400, 
    headers: { "content-type": "application/json", ...corsHeaders } 
  });
}

function ok(body: unknown) {
  return new Response(JSON.stringify(body ?? {}), { 
    status: 200, 
    headers: { "content-type": "application/json", ...corsHeaders } 
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  console.log('📝 Save contract signature function called');

  try {
    if (req.method !== "POST") return badRequest("POST required");
    
    const body = (await req.json()) as Payload;
    console.log('📝 Request body:', { 
      bookingId: body?.bookingId, 
      signerName: body?.signerName,
      hasSignatureData: !!body?.signatureDataUrl 
    });

    if (!body?.bookingId || !body?.signerName || !body?.signatureDataUrl) {
      console.log('❌ Missing required fields:', { 
        hasBookingId: !!body?.bookingId,
        hasSignerName: !!body?.signerName,
        hasSignatureData: !!body?.signatureDataUrl
      });
      return badRequest("Missing required fields: bookingId, signerName, signatureDataUrl");
    }

    const supabase = getServerClient(req);
    
    // ✅ CORRECTION : Vérifier que la réservation existe
    console.log('🔍 Vérification de l\'existence de la réservation...');
    
    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .select('*')
      .eq('id', body.bookingId)
      .single();

    if (bookingError || !booking) {
      console.error('❌ Réservation non trouvée:', bookingError);
      return badRequest("Réservation non trouvée");
    }

    console.log('✅ Réservation trouvée:', booking.id);

    // ✅ CORRECTION : Vérifier s'il existe déjà une signature pour cette réservation
    console.log('🔍 Vérification des signatures existantes...');
    
    const { data: existingSignatures, error: signatureSearchError } = await supabase
      .from('contract_signatures')
      .select('*')
      .eq('booking_id', body.bookingId);

    if (signatureSearchError) {
      console.error('❌ Erreur lors de la recherche de signatures:', signatureSearchError);
      return badRequest("Erreur lors de la recherche de signatures existantes");
    }

    let signatureId: string;
    let isNewSignature = false;

    if (existingSignatures && existingSignatures.length > 0) {
      // ✅ CORRECTION : Mettre à jour la signature existante
      const existingSignature = existingSignatures[0];
      signatureId = existingSignature.id;
      
      console.log('✅ Signature existante trouvée:', signatureId);
      
      const { error: updateError } = await supabase
        .from('contract_signatures')
        .update({
          signer_name: body.signerName,
          signer_email: body.signerEmail,
          signer_phone: body.signerPhone,
          signature_data: body.signatureDataUrl,
          signed_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', signatureId);

      if (updateError) {
        console.error('❌ Erreur lors de la mise à jour de la signature:', updateError);
        return badRequest("Erreur lors de la mise à jour de la signature");
      }

      console.log('✅ Signature mise à jour avec succès');
    } else {
      // ✅ CORRECTION : Créer une nouvelle signature seulement si aucune n'existe
      console.log('🆕 Aucune signature existante trouvée, création d\'une nouvelle...');
      
      const { data: newSignature, error: createError } = await supabase
        .from('contract_signatures')
        .insert({
          booking_id: body.bookingId,
          signer_name: body.signerName,
          signer_email: body.signerEmail,
          signer_phone: body.signerPhone,
          signature_data: body.signatureDataUrl,
          signed_at: new Date().toISOString(),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select()
        .single();

      if (createError) {
        console.error('❌ Erreur lors de la création de la signature:', createError);
        return badRequest("Erreur lors de la création de la signature");
      }

      signatureId = newSignature.id;
      isNewSignature = true;
      console.log('✅ Nouvelle signature créée:', signatureId);
    }

    // ✅ CORRECTION : Mettre à jour le statut de la réservation
    console.log('🔄 Mise à jour du statut de la réservation...');
    
    const { error: updateBookingError } = await supabase
      .from('bookings')
      .update({
        status: 'confirmed',
        updated_at: new Date().toISOString()
      })
      .eq('id', body.bookingId);

    if (updateBookingError) {
      console.error('❌ Erreur lors de la mise à jour du statut de la réservation:', updateBookingError);
      // Ne pas échouer pour cette erreur, juste logger
    } else {
      console.log('✅ Statut de la réservation mis à jour avec succès');
    }

    console.log('✅ Fonction save-contract-signature terminée avec succès');

    
      success: true,
      signatureId: signatureId,
      isNewSignature: isNewSignature,
      message: isNewSignature ? 'Nouvelle signature créée' : 'Signature existante mise à jour',
      // ✅ CORRECTION : Ajouter des informations utiles
      bookingId: body.bookingId,
      signerName: body.signerName,
      signedAt: new Date().toISOString()
    

  } catch (error) {
    console.error('❌ Erreur dans save-contract-signature:', error);
    return badRequest(error instanceof Error ? error.message : "Erreur inconnue");
  }
});
```

---

## Fonction: submit-guest-info
# Copiez ce code dans le Dashboard:

```typescript
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: corsHeaders
    });
  }

  try {
    console.log('🚀 submit-guest-info function started');
    console.log('📅 Timestamp:', new Date().toISOString());
    console.log('🌍 Environment:', {
      hasSupabaseUrl: !!Deno.env.get('SUPABASE_URL'),
      hasServiceRoleKey: !!Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    });
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!supabaseUrl || !serviceRoleKey) {
      console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
      console.error('   SUPABASE_URL:', supabaseUrl ? 'SET' : 'MISSING');
      console.error('   SERVICE_ROLE_KEY:', serviceRoleKey ? 'SET' : 'MISSING');
      throw new Error('Missing required environment variables');
    }

    // Create service role client to bypass RLS
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        persistSession: false
      }
    });

    // Only allow POST
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

    const { propertyId, token, bookingData, guestData } = await req.json();
    
    console.log('📥 Request data:', {
      propertyId,
      hasBookingData: !!bookingData,
      hasGuestData: !!guestData,
      hasToken: !!token
    });

    if (!propertyId || !token || !bookingData || !guestData) {
      return new Response(JSON.stringify({
        success: false,
        message: 'Missing required parameters'
      }), {
        status: 400,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }

    // ✅ CORRECTION : Validation du token avec gestion d'erreurs robuste
    console.log('🔍 Validation du token...');
    console.log('   Token (premiers 20 chars):', token.substring(0, 20) + '...');
    console.log('   Property ID:', propertyId);
    
    const { data: tokenData, error: tokenError } = await supabase
      .from('property_verification_tokens')
      .select('*')
      .eq('token', token)
      .eq('is_active', true)
      .single();

    if (tokenError) {
      console.error('❌ Erreur lors de la validation du token:', {
        code: tokenError.code,
        message: tokenError.message,
        details: tokenError.details,
        hint: tokenError.hint
      });
      
      // Si c'est juste "no rows found", essayer une approche différente
      if (tokenError.code === 'PGRST116') {
        console.log('🔄 Tentative de validation alternative...');
        
        // Essayer de chercher le token sans filtrer par is_active
        const { data: allTokenData, error: allTokenError } = await supabase
          .from('property_verification_tokens')
          .select('*')
          .eq('token', token);
        
        if (allTokenData && allTokenData.length > 0) {
          console.log('🔍 Token trouvé mais potentiellement inactif:', allTokenData[0]);
        }
      }
      
      return new Response(JSON.stringify({
        success: false,
        message: 'Token invalide ou expiré',
        debug: process.env.NODE_ENV === 'development' ? {
          error: tokenError.message,
          code: tokenError.code
        } : undefined
      }), {
        status: 401,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }

    if (!tokenData) {
      console.error('❌ Aucun token trouvé');
      return new Response(JSON.stringify({
        success: false,
        message: 'Token invalide ou expiré'
      }), {
        status: 401,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }

    console.log('✅ Token trouvé:', {
      id: tokenData.id,
      property_id: tokenData.property_id,
      is_active: tokenData.is_active,
      created_at: tokenData.created_at
    });

    // Verify property ID matches token
    if (tokenData.property_id !== propertyId) {
      console.error('❌ Property ID mismatch:', { 
        tokenPropertyId: tokenData.property_id, 
        providedPropertyId: propertyId 
      });
      return new Response(JSON.stringify({
        success: false,
        message: 'Token ne correspond pas à la propriété'
      }), {
        status: 401,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }

    console.log('✅ Token validé avec succès:', { tokenId: tokenData.id, propertyId: tokenData.property_id });

    
    // ✅ CORRECTION : Logique "find or update/create" améliorée
    console.log('🔍 Recherche d'une réservation existante...');
    console.log('   Property ID:', propertyId);
    console.log('   Check-in:', bookingData.checkInDate);
    console.log('   Check-out:', bookingData.checkOutDate);
    
    const { data: existingBookings, error: searchError } = await supabase
      .from('bookings')
      .select('*')
      .eq('property_id', propertyId)
      .eq('check_in_date', bookingData.checkInDate)
      .eq('check_out_date', bookingData.checkOutDate)
      .order('created_at', { ascending: false });

    if (searchError) {
      console.error('❌ Erreur lors de la recherche de réservations:', {
        code: searchError.code,
        message: searchError.message,
        details: searchError.details,
        hint: searchError.hint
      });
      return new Response(JSON.stringify({
        success: false,
        message: 'Erreur lors de la recherche de réservation existante',
        debug: process.env.NODE_ENV === 'development' ? {
          error: searchError.message,
          code: searchError.code
        } : undefined
      }), {
        status: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }

    console.log(`✅ Recherche terminée: ${existingBookings ? existingBookings.length : 0} réservation(s) trouvée(s)`);

    let bookingId;
    let isNewBooking = false;

    if (existingBookings && existingBookings.length > 0) {
      // ✅ CORRECTION : Mettre à jour la réservation existante
      const existingBooking = existingBookings[0];
      bookingId = existingBooking.id;
      console.log('✅ Réservation existante trouvée:', bookingId);

      // Mettre à jour la réservation existante avec les nouvelles données
      const { error: updateError } = await supabase
        .from('bookings')
        .update({
          number_of_guests: bookingData.numberOfGuests,
          status: 'submitted', // ✅ CORRECTION : Marquer comme soumis
          updated_at: new Date().toISOString()
        })
        .eq('id', bookingId);

      if (updateError) {
        console.error('❌ Erreur lors de la mise à jour:', updateError);
        return new Response(JSON.stringify({
          success: false,
          message: 'Erreur lors de la mise à jour de la réservation'
        }), {
          status: 500,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json'
          }
        });
      }

      console.log('✅ Réservation mise à jour avec succès');
    } else {
      // ✅ CORRECTION : Créer une nouvelle réservation seulement si aucune n'existe
      console.log('🆕 Aucune réservation existante trouvée, création d'une nouvelle...');
      const { data: newBooking, error: createError } = await supabase
        .from('bookings')
        .insert({
          property_id: propertyId,
          check_in_date: bookingData.checkInDate,
          check_out_date: bookingData.checkOutDate,
          number_of_guests: bookingData.numberOfGuests,
          status: 'submitted', // ✅ CORRECTION : Marquer directement comme soumis
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select()
        .single();

      if (createError) {
        console.error('❌ Erreur lors de la création:', createError);
        return new Response(JSON.stringify({
          success: false,
          message: 'Erreur lors de la création de la réservation'
        }), {
          status: 500,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json'
          }
        });
      }

      bookingId = newBooking.id;
      isNewBooking = true;
      console.log('✅ Nouvelle réservation créée:', bookingId);
    }

    // ✅ CORRECTION : Pas de création d'enregistrement de soumission (table n'existe pas)
    // Marquer simplement la réservation comme soumise
    if (isNewBooking) {
      console.log('📝 Mise à jour du statut de la réservation...');
      const { error: updateBookingError } = await supabase
        .from('bookings')
        .update({
          status: 'submitted',
          updated_at: new Date().toISOString()
        })
        .eq('id', bookingId);

      if (updateBookingError) {
        console.error('❌ Erreur lors de la mise à jour du statut:', updateBookingError);
        // Ne pas faire échouer pour cette erreur non-critique
      }

      console.log('✅ Statut de la réservation mis à jour');
    } else {
      console.log('ℹ️ Réservation existante, pas de mise à jour de statut nécessaire');
    }

    // ✅ CORRECTION : Pas de liaison nécessaire car property_verification_tokens n'a pas de booking_id
    // Le token est déjà lié à la propriété, ce qui est suffisant pour la validation
    if (isNewBooking) {
      console.log('ℹ️ Token validé pour la propriété, pas de liaison supplémentaire nécessaire');
    } else {
      console.log('ℹ️ Réservation existante, token déjà validé pour la propriété');
    }

    
    // ✅ CORRECTION : Créer/mettre à jour les enregistrements invité
    if (guestData?.guests && Array.isArray(guestData.guests) && bookingId) {
      console.log('👥 Traitement des invités...');
      
      // Supprimer les anciens invités pour cette réservation
      const { error: deleteError } = await supabase
        .from('guests')
        .delete()
        .eq('booking_id', bookingId);

      if (deleteError) {
        console.warn('⚠️ Erreur lors de la suppression des anciens invités:', deleteError);
        // Ne pas faire échouer pour cette erreur non-critique
      }

      // Créer les nouveaux invités
      const guestsData = guestData.guests.map((guest) => ({
        full_name: guest.fullName || guest.full_name || '',
        date_of_birth: guest.dateOfBirth || guest.date_of_birth || '',
        nationality: guest.nationality || 'Non spécifiée',
        document_number: guest.documentNumber || guest.document_number || '',
        document_type: guest.documentType || guest.document_type || 'passport',
        profession: guest.profession || '',
        motif_sejour: guest.motifSejour || guest.motif_sejour || '',
        adresse_personnelle: guest.adressePersonnelle || guest.adresse_personnelle || '',
        email: guest.email || null,
        booking_id: bookingId,
        created_at: new Date().toISOString()
      }));

      const { data: insertedGuests, error: guestsError } = await supabase
        .from('guests')
        .insert(guestsData)
        .select();

      if (guestsError) {
        console.error('❌ Erreur lors de la création des invités:', guestsError);
        return new Response(JSON.stringify({
          success: false,
          message: 'Erreur lors de la création des invités'
        }), {
          status: 500,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json'
          }
        });
      }

      console.log(`✅ ${guestsData.length} invités créés avec succès`);
    } else {
      console.log('ℹ️ Pas d'invités à traiter');
    }

    // ✅ CORRECTION : Pas de création d'enregistrements de documents (table n'existe pas)
    // Simplement logger les URLs de documents pour référence
    if (isNewBooking && guestData?.documentUrls && Array.isArray(guestData.documentUrls) && bookingId) {
      console.log('📄 Documents reçus (non sauvegardés - table guest_documents n\'existe pas):');
      guestData.documentUrls.forEach((url, index) => {
        console.log(`   Document ${index + 1}: ${url}`);
      });
      console.log(`✅ ${guestData.documentUrls.length} documents reçus et loggés`);
    } else {
      console.log('ℹ️ Pas de documents à traiter');
    }

    console.log('✅ Fonction submit-guest-info terminée avec succès');

    
      success: true,
      bookingId: bookingId,
      isNewBooking: isNewBooking,
      message: isNewBooking ? 'Nouvelle réservation créée' : 'Réservation existante mise à jour',
      // ✅ CORRECTION : Ajouter des informations utiles
      propertyId: propertyId,
      guestCount: guestData?.guests?.length || 0,
      checkInDate: bookingData.checkInDate,
      checkOutDate: bookingData.checkOutDate
    , {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });

  } catch (error) {
    console.error('❌ Erreur dans submit-guest-info:', error);
    return new Response(JSON.stringify({
      success: false,
      message: error instanceof Error ? error.message : 'Erreur inconnue'
    }), {
      status: 500,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  }
});
```

---

## Fonction: resolve-guest-link
# Copiez ce code dans le Dashboard:

```typescript
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { addCorsHeaders, handleOptions } from '../_shared/cors.ts';
import { handleError, ValidationError, NotFoundError } from '../_shared/errors.ts';
import { getServerClient, verifyPropertyToken } from '../_shared/serverClient.ts';

serve(async (req) => {
  try {
    if (req.method === 'OPTIONS') {
      return handleOptions(req);
    }

    if (req.method !== 'POST') {
      throw new ValidationError('Method not allowed');
    }

    const { token, propertyId, airbnbCode } = await req.json();
    
    console.log('🔍 resolve-guest-link called with:', { 
      hasToken: !!token, 
      hasPropertyId: !!propertyId, 
      hasAirbnbCode: !!airbnbCode 
    });

    // ✅ CORRECTION : Accepter propertyId en paramètre ou le dériver du token
    let resolvedPropertyId = propertyId;
    
    if (token && !propertyId) {
      resolvedPropertyId = await verifyPropertyToken(token);
      if (!resolvedPropertyId) {
        throw new ValidationError('Invalid token');
      }
    } else if (!token && !propertyId) {
      throw new ValidationError('Missing token or propertyId');
    }

    const client = await getServerClient();

    // Get property details
    const { data: property, error: propertyError } = await client
      .from('properties')
      .select('id, name, address, contract_template, contact_info, house_rules')
      .eq('id', resolvedPropertyId)
      .single();

    if (propertyError || !property) {
      throw new NotFoundError('Property not found', { propertyError });
    }

    // ✅ CORRECTION : Rechercher une réservation active ou récente
    let booking = null;
    const { data: bookings, error: bookingError } = await client
      .from('bookings')
      .select('*')
      .eq('property_id', resolvedPropertyId)
      .in('status', ['active', 'pending', 'confirmed'])
      .order('created_at', { ascending: false })
      .limit(1);

    if (bookingError) {
      console.warn('⚠️ No booking found for property:', bookingError);
    } else if (bookings && bookings.length > 0) {
      booking = bookings[0];
    }

    // ✅ CORRECTION : Format de réponse compatible avec le frontend
    const responseData = {
      success: true,
      propertyId: resolvedPropertyId,
      bookingId: booking?.id || null,
      token: token,
      property: property,
      booking: booking
    };

    console.log('✅ resolve-guest-link success:', { 
      propertyId: resolvedPropertyId, 
      hasBooking: !!booking 
    });

    const response = new Response(
      JSON.stringify(responseData),
      { headers: { 'Content-Type': 'application/json' } }
    );

    return addCorsHeaders(response);
  } catch (error) {
    console.error('❌ resolve-guest-link error:', error);
    return handleError(error);
  }
})
```

---

## Fonction: generate-police-forms
# Copiez ce code dans le Dashboard:

```typescript
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

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

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error('Missing required environment variables');
    }

    const client = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false }
    });

    const requestData = await req.json();
    console.log('📥 Request data:', requestData);

    const { bookingId } = requestData;

    if (!bookingId) {
      return new Response(JSON.stringify({
        success: false,
        message: 'bookingId is required'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Fetch booking data
    const booking = await fetchBookingFromDatabase(client, bookingId);

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

    // Generate police forms
    const documentUrl = await generatePoliceFormsPDF(booking);
    
    // Save to database
    const documentRecord = await saveDocumentToDatabase(
      client, 
      booking.id, 
      'police', 
      documentUrl
    );

    return new Response(JSON.stringify({
      success: true,
      message: `Generated ${guests.length} police form(s) successfully`,
      documentUrl: documentUrl,
      documentId: documentRecord.id,
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

  // Enrich with real guest data from guest_submissions
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
              adresse_personnelle: guest.adresse_personnelle || ''
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
        }
      }
    }
  } catch (enrichError) {
    console.error('❌ Error enriching with guest submissions:', enrichError);
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

// Generate police forms PDF
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
```

---
