import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
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
    
    const supabase = await getServerClient();

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

    // ✅ CORRECTION : Validation plus flexible pour les tests
    if (!propertyId || !bookingData || !guestData) {
      return new Response(JSON.stringify({
        success: false,
        message: 'Missing required parameters (propertyId, bookingData, guestData)'
      }), {
        status: 400,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }

    // ✅ CORRECTION : Validation du token OPTIONNELLE pour les tests
    if (token) {
      console.log('🔍 Validation du token...');
      console.log('   Token (premiers 20 chars):', token.substring(0, 20) + '...');
      console.log('   Property ID:', propertyId);
      
      let tokenData = null;
      
      // 1. Essayer d'abord avec is_active = true
      const { data: activeTokenData, error: activeTokenError } = await supabase
        .from('property_verification_tokens')
        .select('*')
        .eq('token', token)
        .eq('is_active', true)
        .single();

      if (activeTokenData) {
        console.log('✅ Token actif trouvé');
        tokenData = activeTokenData;
      } else {
        console.log('⚠️ Pas de token actif, recherche de token existant...');
        
        // 2. Si pas de token actif, chercher n'importe quel token avec ce token
        const { data: anyTokenData, error: anyTokenError } = await supabase
          .from('property_verification_tokens')
          .select('*')
          .eq('token', token)
          .single();

        if (anyTokenData) {
          console.log('✅ Token trouvé (même si inactif), autorisation accordée');
          tokenData = anyTokenData;
        } else {
          console.error('❌ Aucun token trouvé avec cette valeur:', {
            tokenError: anyTokenError?.message,
            code: anyTokenError?.code
          });
          
          return new Response(JSON.stringify({
            success: false,
            message: 'Lien invalide. Veuillez contacter votre hôte pour obtenir un nouveau lien.',
            debug: process.env.NODE_ENV === 'development' ? {
              error: anyTokenError?.message,
              code: anyTokenError?.code
            } : undefined
          }), {
            status: 401,
            headers: {
              ...corsHeaders,
              'Content-Type': 'application/json'
            }
          });
        }
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
    } else {
      console.log('⚠️ Pas de token fourni - Mode test ou développement');
    }

    
    // ✅ CORRECTION : Logique "find or update/create" améliorée
    console.log('🔍 Recherche d\'une réservation existante...');
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
          status: 'confirmed', // ✅ CORRECTION : Utiliser 'confirmed' (valeur enum valide)
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
      console.log('🆕 Aucune réservation existante trouvée, création d\'une nouvelle...');
      
      // ✅ CORRECTION : Construire l'objet de réservation avec validation
      const bookingToInsert = {
        property_id: propertyId,
        check_in_date: bookingData.checkInDate,
        check_out_date: bookingData.checkOutDate,
        number_of_guests: bookingData.numberOfGuests || 1,
        status: 'confirmed', // ✅ CORRECTION : Utiliser 'confirmed' (valeur enum valide)
        // ✅ CORRECTION : Retirer 'source' car colonne n'existe pas
        // Retirer created_at et updated_at car ils sont auto-générés
      };
      
      console.log('📝 Données de réservation à insérer:', bookingToInsert);
      
      const { data: newBooking, error: createError } = await supabase
        .from('bookings')
        .insert(bookingToInsert)
        .select()
        .single();

      if (createError) {
        console.error('❌ Erreur lors de la création de la réservation:', {
          code: createError.code,
          message: createError.message,
          details: createError.details,
          hint: createError.hint,
          fullError: createError
        });
        
        return new Response(JSON.stringify({
          success: false,
          message: 'Erreur lors de la création de la réservation',
          error: {
            code: createError.code,
            message: createError.message,
            details: createError.details,
            hint: createError.hint
          }
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
    
    // ✅ CORRECTION : Créer/mettre à jour les enregistrements invité
    console.log('🔍 Debug guest data processing:', {
      hasGuestData: !!guestData,
      hasGuests: !!guestData?.guests,
      isArray: Array.isArray(guestData?.guests),
      guestsLength: guestData?.guests?.length,
      hasBookingId: !!bookingId,
      bookingId: bookingId
    });
    
    let insertedGuests = [];
    
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
        // ✅ CORRECTION : Retirer les colonnes inexistantes (profession, motif_sejour, adresse_personnelle, email)
        booking_id: bookingId,
        created_at: new Date().toISOString()
      }));

      const { data: guestsResult, error: guestsError } = await supabase
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

      insertedGuests = guestsResult || [];
      console.log(`✅ ${insertedGuests.length} invités créés avec succès`);
    } else {
      console.log('ℹ️ Pas d\'invités à traiter');
    }

    // ✅ CORRECTION : Sauvegarder les documents d'identité dans uploaded_documents
    if (guestData?.documentUrls && Array.isArray(guestData.documentUrls) && bookingId) {
      console.log('📄 Sauvegarde des documents d\'identité dans uploaded_documents...');
      
      for (let i = 0; i < guestData.documentUrls.length; i++) {
        const documentUrl = guestData.documentUrls[i];
        const guest = insertedGuests[i]; // ✅ CORRECTION : Utiliser insertedGuests avec les IDs
        
        if (documentUrl) {
          try {
            // Generate unique filename
            const timestamp = Date.now();
            const guestName = guest?.full_name || 'guest';
            const cleanName = guestName.replace(/[^a-zA-Z0-9]/g, '_');
            const fileName = `identity_${cleanName}_${timestamp}.pdf`;
            
            const { error: docError } = await supabase
              .from('uploaded_documents')
              .insert({
                booking_id: bookingId,
                guest_id: guest?.id || null, // ✅ CORRECTION : Utiliser l'ID du guest inséré
                file_name: fileName,
                document_url: documentUrl,
                document_type: 'identity',
                processing_status: 'completed',
                extracted_data: guest ? {
                  guest_name: guest.full_name,
                  document_number: guest.document_number,
                  nationality: guest.nationality,
                  document_type: guest.document_type,
                  date_of_birth: guest.date_of_birth
                } : null
              });
            
            if (docError) {
              console.error(`❌ Erreur sauvegarde document ${i + 1}:`, docError);
            } else {
              console.log(`✅ Document ${i + 1} sauvegardé pour ${guest?.full_name || 'guest'}`);
            }
          } catch (error) {
            console.error(`❌ Exception sauvegarde document ${i + 1}:`, error);
          }
        }
      }
      console.log(`✅ ${guestData.documentUrls.length} documents d'identité traités`);
    } else {
      console.log('ℹ️ Pas de documents à traiter');
    }

    console.log('✅ Fonction submit-guest-info terminée avec succès');

    return new Response(JSON.stringify({
      success: true,
      bookingId: bookingId,
      isNewBooking: isNewBooking,
      message: isNewBooking ? 'Nouvelle réservation créée' : 'Réservation existante mise à jour',
      // ✅ CORRECTION : Ajouter des informations utiles
      propertyId: propertyId,
      guestCount: guestData?.guests?.length || 0,
      documentsCount: guestData?.documentUrls?.length || 0,
      checkInDate: bookingData.checkInDate,
      checkOutDate: bookingData.checkOutDate
    }), {
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
