import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

async function checkExistingProperties() {
  console.log('🔍 === VÉRIFICATION PROPRIÉTÉS EXISTANTES ===');
  console.log('📅 Timestamp:', new Date().toISOString());
  
  try {
    // 1. Lister les tokens existants avec leurs property_id
    console.log('\n🔑 1. TOKENS EXISTANTS...');
    const { data: tokens, error: tokensError } = await supabase
      .from('property_verification_tokens')
      .select('property_id, token, is_active, created_at')
      .order('created_at', { ascending: false })
      .limit(10);

    if (tokensError) {
      console.log('❌ Erreur récupération tokens:', tokensError);
      return;
    }

    console.log(`✅ ${tokens.length} tokens trouvés:`);
    for (const token of tokens.slice(0, 5)) {
      console.log(`  🔑 Property: ${token.property_id}`);
      console.log(`      Token: ${token.token.substring(0, 20)}...`);
      console.log(`      Active: ${token.is_active}`);
      console.log(`      Created: ${new Date(token.created_at).toLocaleDateString()}`);
      console.log();
    }

    // 2. Prendre le premier token actif pour tester
    const activeToken = tokens.find(t => t.is_active);
    if (activeToken) {
      console.log(`🎯 UTILISATION DU TOKEN ACTIF:`);
      console.log(`   Property ID: ${activeToken.property_id}`);
      console.log(`   Token: ${activeToken.token}`);
      
      // 3. Tester submit-guest-info avec ce token réel
      console.log('\n📤 2. TEST SUBMIT-GUEST-INFO AVEC TOKEN RÉEL...');
      
      const response = await fetch(`${process.env.VITE_SUPABASE_URL}/functions/v1/submit-guest-info`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.VITE_SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
          'apikey': process.env.VITE_SUPABASE_ANON_KEY
        },
        body: JSON.stringify({
          propertyId: activeToken.property_id,
          token: activeToken.token,
          bookingData: {
            checkInDate: '2025-09-20',
            checkOutDate: '2025-09-25',
            numberOfGuests: 1
          },
          guestData: {
            guests: [
              {
                fullName: 'TEST REAL TOKEN',
                nationality: 'FRANÇAIS',
                documentNumber: 'REAL123456',
                documentType: 'passport',
                dateOfBirth: '1990-01-01'
              }
            ],
            documentUrls: [
              'https://example.com/test-real-doc.pdf'
            ]
          }
        })
      });

      console.log(`📡 Response Status: ${response.status} ${response.statusText}`);
      
      const responseBody = await response.text();
      console.log(`📄 Response Body:`, responseBody);
      
      try {
        const jsonBody = JSON.parse(responseBody);
        console.log(`📄 Response JSON:`, JSON.stringify(jsonBody, null, 2));
        
        if (jsonBody.success && jsonBody.bookingId) {
          console.log(`\n🎉 SUCCÈS ! Booking créé: ${jsonBody.bookingId}`);
          
          // Vérifier les documents créés
          const { data: docs, error: docsError } = await supabase
            .from('uploaded_documents')
            .select('*')
            .eq('booking_id', jsonBody.bookingId);
            
          if (docsError) {
            console.log('❌ Erreur vérification docs:', docsError);
          } else {
            console.log(`✅ ${docs.length} document(s) créé(s):`, docs);
          }
          
          // Vérifier les invités créés
          const { data: guests, error: guestsError } = await supabase
            .from('guests')
            .select('*')
            .eq('booking_id', jsonBody.bookingId);
            
          if (guestsError) {
            console.log('❌ Erreur vérification guests:', guestsError);
          } else {
            console.log(`✅ ${guests.length} invité(s) créé(s):`, guests);
          }
        }
        
      } catch (e) {
        console.log(`⚠️ Response is not valid JSON`);
      }
      
    } else {
      console.log('❌ Aucun token actif trouvé');
    }

  } catch (error) {
    console.log(`💥 Erreur générale:`, error.message);
  }
}

checkExistingProperties();
