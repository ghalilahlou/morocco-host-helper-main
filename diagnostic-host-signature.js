// Diagnostic pour comprendre pourquoi la signature hôte n'apparaît pas
// Usage: node diagnostic-host-signature.js

const { createClient } = require('@supabase/supabase-js');

// Configuration - remplacez par vos valeurs
const SUPABASE_URL = 'https://your-project.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = 'your-service-role-key';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function diagnosticHostSignature() {
  console.log('🔍 Diagnostic de la signature hôte...\n');
  
  try {
    // 1. Vérifier les profils hôtes avec signatures
    console.log('1️⃣ Vérification des profils hôtes avec signatures:');
    const { data: hostProfiles, error: hostError } = await supabase
      .from('host_profiles')
      .select('id, full_name, first_name, last_name, signature_svg, signature_image_url')
      .or('signature_svg.not.is.null,signature_image_url.not.is.null')
      .limit(5);
    
    if (hostError) {
      console.error('❌ Erreur host_profiles:', hostError);
    } else {
      console.log('✅ Profils hôtes trouvés:', hostProfiles?.length || 0);
      hostProfiles?.forEach((host, i) => {
        console.log(`   ${i+1}. ${host.full_name || `${host.first_name} ${host.last_name}`}`);
        console.log(`      - signature_svg: ${host.signature_svg ? '✓' : '✗'}`);
        console.log(`      - signature_image_url: ${host.signature_image_url ? '✓' : '✗'}`);
      });
    }
    
    console.log('\n' + '='.repeat(50) + '\n');
    
    // 2. Vérifier les propriétés liées à ces hôtes
    console.log('2️⃣ Vérification des propriétés:');
    if (hostProfiles && hostProfiles.length > 0) {
      const hostIds = hostProfiles.map(h => h.id);
      const { data: properties, error: propError } = await supabase
        .from('properties')
        .select('id, name, user_id, address, city, contact_info')
        .in('user_id', hostIds)
        .limit(5);
      
      if (propError) {
        console.error('❌ Erreur properties:', propError);
      } else {
        console.log('✅ Propriétés trouvées:', properties?.length || 0);
        properties?.forEach((prop, i) => {
          console.log(`   ${i+1}. ${prop.name} (user_id: ${prop.user_id})`);
          console.log(`      - Adresse: ${prop.address}`);
          console.log(`      - Contact: ${prop.contact_info?.name || 'N/A'}`);
        });
      }
      
      console.log('\n' + '='.repeat(50) + '\n');
      
      // 3. Vérifier les réservations pour ces propriétés
      console.log('3️⃣ Vérification des réservations:');
      if (properties && properties.length > 0) {
        const propIds = properties.map(p => p.id);
        const { data: bookings, error: bookingError } = await supabase
          .from('bookings')
          .select('id, property_id, check_in_date, check_out_date')
          .in('property_id', propIds)
          .limit(5);
        
        if (bookingError) {
          console.error('❌ Erreur bookings:', bookingError);
        } else {
          console.log('✅ Réservations trouvées:', bookings?.length || 0);
          bookings?.forEach((booking, i) => {
            console.log(`   ${i+1}. Booking ${booking.id} (property: ${booking.property_id})`);
            console.log(`      - Dates: ${booking.check_in_date} → ${booking.check_out_date}`);
          });
        }
        
        console.log('\n' + '='.repeat(50) + '\n');
        
        // 4. Test de la jointure complète
        console.log('4️⃣ Test de la jointure complète (comme dans l\'Edge Function):');
        if (bookings && bookings.length > 0) {
          const testBookingId = bookings[0].id;
          console.log(`   Test avec booking ID: ${testBookingId}`);
          
          const { data: fullBooking, error: fullError } = await supabase
            .from('bookings')
            .select(`
              *,
              property:properties(*),
              guests(*)
            `)
            .eq('id', testBookingId)
            .single();
          
          if (fullError) {
            console.error('❌ Erreur jointure complète:', fullError);
          } else {
            console.log('✅ Jointure réussie:');
            console.log(`   - Booking ID: ${fullBooking.id}`);
            console.log(`   - Property: ${fullBooking.property?.name}`);
            console.log(`   - Property user_id: ${fullBooking.property?.user_id}`);
            console.log(`   - Guests: ${fullBooking.guests?.length || 0}`);
            
            // Vérifier le profil hôte
            if (fullBooking.property?.user_id) {
              const { data: hostProfile, error: hostErr } = await supabase
                .from('host_profiles')
                .select('full_name, first_name, last_name, signature_svg, signature_image_url')
                .eq('id', fullBooking.property.user_id)
                .single();
              
              if (hostErr) {
                console.error('❌ Erreur profil hôte:', hostErr);
              } else {
                console.log('✅ Profil hôte trouvé:');
                console.log(`   - Nom: ${hostProfile.full_name || `${hostProfile.first_name} ${hostProfile.last_name}`}`);
                console.log(`   - signature_svg: ${hostProfile.signature_svg ? '✓ (longueur: ' + hostProfile.signature_svg.length + ')' : '✗'}`);
                console.log(`   - signature_image_url: ${hostProfile.signature_image_url ? '✓' : '✗'}`);
                
                if (hostProfile.signature_svg) {
                  console.log(`   - Type SVG: ${hostProfile.signature_svg.startsWith('data:image/svg') ? 'Data URL' : 'SVG brut'}`);
                }
              }
            }
          }
        }
      }
    }
    
    console.log('\n' + '='.repeat(50) + '\n');
    console.log('🎯 Résumé du diagnostic:');
    console.log('1. Vérifiez que les profils hôtes ont des signatures');
    console.log('2. Vérifiez que les propriétés sont liées aux bons hôtes (user_id)');
    console.log('3. Vérifiez que les réservations existent pour ces propriétés');
    console.log('4. Vérifiez que la jointure host_profiles.id = property.user_id fonctionne');
    console.log('5. Vérifiez le format des signatures (SVG vs PNG)');
    
  } catch (error) {
    console.error('❌ Erreur générale:', error);
  }
}

// Instructions
console.log('📝 Instructions:');
console.log('1. Remplacez SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY par vos valeurs');
console.log('2. Exécutez: node diagnostic-host-signature.js');
console.log('3. Analysez les résultats pour identifier le problème');
console.log('');

// Décommenter pour exécuter
// diagnosticHostSignature();
