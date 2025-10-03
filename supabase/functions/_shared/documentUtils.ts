import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { PDFDocument, StandardFonts } from 'https://cdn.skypack.dev/pdf-lib@1.17.1?dts';
import fontkit from 'https://cdn.skypack.dev/@pdf-lib/fontkit@1.1.1?dts';
import { reshape } from 'https://esm.sh/arabic-persian-reshaper@1.0.1';

// Client Supabase avec les droits admin
export async function getServerClient() {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  return createClient(supabaseUrl, supabaseKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    },
    db: {
      schema: 'public'
    }
  });
}

// Vérification et création de réservation
export async function ensureBookingExists(client: any, bookingId: string, propertyId: string) {
  console.log('🔍 Checking booking existence:', { bookingId, propertyId });
  
  try {
    const { data: existingBooking, error: selectError } = await client
      .from('bookings')
      .select('*')
      .eq('id', bookingId)
      .single();

    if (selectError) {
      console.error('❌ Error checking booking:', selectError);
      throw new Error(`Database error: ${selectError.message}`);
    }

    if (!existingBooking) {
      console.log('📝 Creating new booking...');
      const { data: newBooking, error: insertError } = await client
        .from('bookings')
        .insert([
          {
            id: bookingId,
            property_id: propertyId,
            status: 'pending',
            created_at: new Date().toISOString()
          }
        ])
        .select()
        .single();

      if (insertError) {
        console.error('❌ Error creating booking:', insertError);
        throw new Error(`Failed to create booking: ${insertError.message}`);
      }

      console.log('✅ New booking created:', newBooking.id);
      return newBooking;
    }

    console.log('✅ Found existing booking:', existingBooking.id);
    return existingBooking;
  } catch (error) {
    console.error('❌ Error in ensureBookingExists:', error);
    throw error;
  }
}

// Sauvegarde des documents
export async function saveDocumentToDatabase(
  client: any, 
  bookingId: string, 
  documentType: string, 
  documentUrl: string, 
  isSigned: boolean = false
) {
  console.log(`📄 Saving ${documentType} document for booking:`, bookingId);
  
  try {
    // Vérifier si le document existe déjà
    const { data: existingDoc, error: checkError } = await client
      .from('generated_documents')
      .select('*')
      .eq('booking_id', bookingId)
      .eq('document_type', documentType)
      .maybeSingle();

    if (checkError) {
      console.error('❌ Error checking existing document:', checkError);
      throw checkError;
    }

    if (existingDoc) {
      console.log('🔄 Updating existing document');
      
      // Ne pas mettre à jour un contrat signé avec une version non signée
      if (documentType === 'contract' && existingDoc.is_signed && !isSigned) {
        console.log('⚠️ Skipping update: Cannot replace signed contract with unsigned version');
        return existingDoc;
      }

      const { data: updatedDoc, error: updateError } = await client
        .from('generated_documents')
        .update({
          document_url: documentUrl,
          is_signed: isSigned,
          updated_at: new Date().toISOString()
        })
        .eq('id', existingDoc.id)
        .select()
        .single();

      if (updateError) {
        console.error('❌ Error updating document:', updateError);
        throw updateError;
      }

      console.log('✅ Document updated successfully');
      return updatedDoc;
    }

    console.log('📝 Creating new document');
    const { data: newDoc, error: insertError } = await client
      .from('generated_documents')
      .insert({
        booking_id: bookingId,
        document_type: documentType,
        document_url: documentUrl,
        is_signed: isSigned,
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (insertError) {
      console.error('❌ Error creating document:', insertError);
      throw insertError;
    }

    console.log('✅ New document created successfully');
    return newDoc;
  } catch (error) {
    console.error(`❌ Error saving ${documentType} document:`, error);
    throw error;
  }
}

// Gestion des signatures
export async function handleSignature(client: any, bookingId: string, signature: any) {
  console.log('✍️ Processing signature for booking:', bookingId);
  
  try {
    if (!signature) {
      console.log('ℹ️ No signature provided, skipping');
      return null;
    }

    // Sauvegarder la signature
    const { error: signatureError } = await client
      .from('signatures')
      .upsert({
        booking_id: bookingId,
        signature_data: signature.data,
        signed_at: signature.timestamp || new Date().toISOString()
      });

    if (signatureError) {
      console.error('❌ Error saving signature:', signatureError);
      throw new Error(`Failed to save signature: ${signatureError.message}`);
    }

    console.log('✅ Signature saved successfully');

    // Mettre à jour le statut du contrat
    const { error: updateError } = await client
      .from('generated_documents')
      .update({
        is_signed: true,
        signed_at: new Date().toISOString()
      })
      .eq('booking_id', bookingId)
      .eq('document_type', 'contract');

    if (updateError) {
      console.error('❌ Error updating contract status:', updateError);
      throw new Error(`Failed to update contract status: ${updateError.message}`);
    }

    console.log('✅ Contract status updated');
    return true;
  } catch (error) {
    console.error('❌ Error in handleSignature:', error);
    throw error;
  }
}
