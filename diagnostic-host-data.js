// Script de diagnostic pour vérifier les données hôte dans la base
// À exécuter dans la console du navigateur ou en Node.js

import { createClient } from '@supabase/supabase-js';

// Configuration Supabase (remplace par tes vraies valeurs)
const supabaseUrl = 'YOUR_SUPABASE_URL';
const supabaseKey = 'YOUR_SUPABASE_ANON_KEY';

const supabase = createClient(supabaseUrl, supabaseKey);

async function diagnosticHostData(bookingId) {
  console.log('🔍 DIAGNOSTIC DES DONNÉES HÔTE');
  console.log('================================');
  
  try {
    // 1. Récupérer la réservation avec la propriété
    console.log('\n1️⃣ Récupération de la réservation...');
    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .select(`
        *,
        property:properties(*)
      `)
      .eq('id', bookingId)
      .single();
    
    if (bookingError) {
      console.error('❌ Erreur récupération booking:', bookingError);
      return;
    }
    
    console.log('✅ Booking trouvé:', {
      id: booking.id,
      propertyId: booking.property?.id,
      propertyUserId: booking.property?.user_id,
      propertyName: booking.property?.name
    });
    
    // 2. Vérifier le profil hôte
    console.log('\n2️⃣ Vérification du profil hôte...');
    if (booking.property?.user_id) {
      const { data: hostProfile, error: hostError } = await supabase
        .from('host_profiles')
        .select('*')
        .eq('user_id', booking.property.user_id)
        .single();
      
      if (hostError) {
        console.error('❌ Erreur récupération host_profiles:', hostError);
      } else {
        console.log('✅ Profil hôte trouvé:', {
          user_id: hostProfile.user_id,
          full_name: hostProfile.full_name,
          first_name: hostProfile.first_name,
          last_name: hostProfile.last_name,
          phone: hostProfile.phone,
          signature_url: hostProfile.signature_url,
          signature_image_url: hostProfile.signature_image_url,
          company_name: hostProfile.company_name,
          tax_id: hostProfile.tax_id
        });
      }
    } else {
      console.log('⚠️ Pas de user_id dans la propriété');
    }
    
    // 3. Vérifier les données de la propriété
    console.log('\n3️⃣ Vérification des données de la propriété...');
    console.log('✅ Données propriété:', {
      name: booking.property?.name,
      address: booking.property?.address,
      city: booking.property?.city,
      country: booking.property?.country,
      owner_names: booking.property?.owner_names,
      contact_info: booking.property?.contact_info,
      contract_template: booking.property?.contract_template
    });
    
    // 4. Vérifier les signatures existantes
    console.log('\n4️⃣ Vérification des signatures existantes...');
    const { data: signatures, error: sigError } = await supabase
      .from('contract_signatures')
      .select('*')
      .eq('booking_id', bookingId);
    
    if (sigError) {
      console.error('❌ Erreur récupération signatures:', sigError);
    } else {
      console.log('✅ Signatures trouvées:', signatures?.length || 0);
      signatures?.forEach((sig, index) => {
        console.log(`  Signature ${index + 1}:`, {
          id: sig.id,
          signer_name: sig.signer_name,
          has_signature_data: !!sig.signature_data,
          signed_at: sig.signed_at
        });
      });
    }
    
    // 5. Test de l'appel Edge Function
    console.log('\n5️⃣ Test de l\'appel Edge Function...');
    const { data: contractData, error: contractError } = await supabase.functions.invoke('generate-contract', {
      body: {
        bookingId: bookingId,
        action: 'generate'
      }
    });
    
    if (contractError) {
      console.error('❌ Erreur Edge Function:', contractError);
    } else {
      console.log('✅ Edge Function réussie:', {
        success: contractData?.success,
        hasDocumentUrl: !!contractData?.documentUrl,
        documentUrl: contractData?.documentUrl
      });
    }
    
    // 6. Résumé et recommandations
    console.log('\n📋 RÉSUMÉ ET RECOMMANDATIONS');
    console.log('============================');
    
    const hasHostProfile = !!booking.property?.user_id;
    const hasHostName = !!(booking.property?.contact_info?.name || booking.property?.owner_names);
    const hasHostSignature = !!(hostProfile?.signature_url || hostProfile?.signature_image_url);
    
    console.log(`✅ Profil hôte: ${hasHostProfile ? 'Trouvé' : 'Manquant'}`);
    console.log(`✅ Nom hôte: ${hasHostName ? 'Trouvé' : 'Manquant'}`);
    console.log(`✅ Signature hôte: ${hasHostSignature ? 'Trouvée' : 'Manquante'}`);
    
    if (!hasHostProfile) {
      console.log('\n🔧 RECOMMANDATION 1: Créer un profil hôte');
      console.log('   INSERT INTO host_profiles (user_id, full_name) VALUES (?, ?);');
    }
    
    if (!hasHostName) {
      console.log('\n🔧 RECOMMANDATION 2: Ajouter le nom hôte');
      console.log('   - Dans contact_info.name de la propriété');
      console.log('   - Ou dans owner_names[] de la propriété');
    }
    
    if (!hasHostSignature) {
      console.log('\n🔧 RECOMMANDATION 3: Ajouter une signature hôte');
      console.log('   - Utiliser le composant HostSignatureCapture');
      console.log('   - Sauvegarder en PNG (pas SVG)');
      console.log('   - Stocker dans signature_image_url');
    }
    
  } catch (error) {
    console.error('❌ Erreur générale:', error);
  }
}

// Fonction pour tester avec une signature hôte
async function testWithHostSignature(bookingId, signatureDataUrl, hostName) {
  console.log('\n🧪 TEST AVEC SIGNATURE HÔTE');
  console.log('============================');
  
  try {
    const { data, error } = await supabase.functions.invoke('generate-contract', {
      body: {
        bookingId: bookingId,
        action: 'generate',
        hostSignatureData: signatureDataUrl,
        hostSignerName: hostName
      }
    });
    
    if (error) {
      console.error('❌ Erreur test signature:', error);
    } else {
      console.log('✅ Test signature réussi:', {
        success: data?.success,
        hasDocumentUrl: !!data?.documentUrl
      });
    }
  } catch (error) {
    console.error('❌ Erreur test:', error);
  }
}

// Exporter les fonctions pour utilisation
window.diagnosticHostData = diagnosticHostData;
window.testWithHostSignature = testWithHostSignature;

console.log('🔧 Script de diagnostic chargé');
console.log('Usage:');
console.log('  diagnosticHostData("your-booking-id")');
console.log('  testWithHostSignature("booking-id", "data:image/png;base64,...", "John Doe")');



