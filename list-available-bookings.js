#!/usr/bin/env node

/**
 * Script pour lister les bookings disponibles en base de données
 */

const { createClient } = require('@supabase/supabase-js');

// Configuration Supabase (utilisez vos vraies valeurs)
const supabaseUrl = process.env.SUPABASE_URL || 'https://your-project.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'your-service-role-key';

const supabase = createClient(supabaseUrl, supabaseKey);

async function listAvailableBookings() {
  console.log('🔍 Recherche des bookings disponibles...');
  
  try {
    // Lister tous les bookings récents
    const { data: bookings, error: bookingsError } = await supabase
      .from('bookings')
      .select(`
        id,
        status,
        check_in_date,
        check_out_date,
        number_of_guests,
        created_at,
        property:properties(id, name, address)
      `)
      .order('created_at', { ascending: false })
      .limit(10);
    
    if (bookingsError) {
      console.log('❌ Erreur lors de la requête bookings:', bookingsError);
      return;
    }
    
    if (!bookings || bookings.length === 0) {
      console.log('❌ Aucun booking trouvé en base de données');
      return;
    }
    
    console.log(`✅ ${bookings.length} bookings trouvés:`);
    console.log('');
    
    bookings.forEach((booking, index) => {
      console.log(`${index + 1}. ID: ${booking.id}`);
      console.log(`   Statut: ${booking.status}`);
      console.log(`   Dates: ${booking.check_in_date} → ${booking.check_out_date}`);
      console.log(`   Invités: ${booking.number_of_guests}`);
      console.log(`   Propriété: ${booking.property?.name || 'Non spécifiée'}`);
      console.log(`   Adresse: ${booking.property?.address || 'Non spécifiée'}`);
      console.log(`   Créé: ${new Date(booking.created_at).toLocaleString('fr-FR')}`);
      console.log('');
    });
    
    // Vérifier les invités pour le premier booking
    if (bookings.length > 0) {
      const firstBooking = bookings[0];
      console.log(`🔍 Vérification des invités pour le booking: ${firstBooking.id}`);
      
      const { data: guests, error: guestsError } = await supabase
        .from('guests')
        .select('id, full_name, document_number, nationality, document_type')
        .eq('booking_id', firstBooking.id);
      
      if (guestsError) {
        console.log('❌ Erreur lors de la requête guests:', guestsError);
      } else {
        console.log(`✅ ${guests?.length || 0} invités trouvés pour ce booking:`);
        if (guests && guests.length > 0) {
          guests.forEach((guest, index) => {
            console.log(`  ${index + 1}. ${guest.full_name}`);
            console.log(`     Nationalité: ${guest.nationality}`);
            console.log(`     Document: ${guest.document_type} - ${guest.document_number}`);
          });
        }
      }
    }
    
  } catch (error) {
    console.error('❌ Erreur générale:', error.message);
  }
}

listAvailableBookings()
  .then(() => {
    console.log('\n🎯 Script terminé');
  })
  .catch(error => {
    console.error('❌ Erreur fatale:', error);
  });
