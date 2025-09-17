#!/usr/bin/env node

/**
 * Script pour vérifier si un booking existe en base de données
 */

const { createClient } = require('@supabase/supabase-js');

// Configuration Supabase (utilisez vos vraies valeurs)
const supabaseUrl = process.env.SUPABASE_URL || 'https://your-project.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'your-service-role-key';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkBookingExists(bookingId) {
  console.log(`🔍 Vérification du booking ID: ${bookingId}`);
  
  try {
    // Vérifier si le booking existe
    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .select('id, status, created_at, property_id')
      .eq('id', bookingId)
      .single();
    
    if (bookingError) {
      console.log('❌ Erreur lors de la requête booking:', bookingError);
      return false;
    }
    
    if (booking) {
      console.log('✅ Booking trouvé:', booking);
      
      // Vérifier la propriété associée
      const { data: property, error: propertyError } = await supabase
        .from('properties')
        .select('id, name, address')
        .eq('id', booking.property_id)
        .single();
      
      if (propertyError) {
        console.log('❌ Erreur lors de la requête property:', propertyError);
      } else if (property) {
        console.log('✅ Propriété trouvée:', property);
      }
      
      // Vérifier les invités
      const { data: guests, error: guestsError } = await supabase
        .from('guests')
        .select('id, full_name, document_number, nationality')
        .eq('booking_id', bookingId);
      
      if (guestsError) {
        console.log('❌ Erreur lors de la requête guests:', guestsError);
      } else {
        console.log('✅ Invités trouvés:', guests?.length || 0, 'invités');
        if (guests && guests.length > 0) {
          guests.forEach((guest, index) => {
            console.log(`  ${index + 1}. ${guest.full_name} (${guest.nationality}) - ${guest.document_number}`);
          });
        }
      }
      
      return true;
    } else {
      console.log('❌ Aucun booking trouvé');
      return false;
    }
    
  } catch (error) {
    console.error('❌ Erreur générale:', error.message);
    return false;
  }
}

// Test avec l'ID du log
const bookingId = '2de09f1d-2b89-4d6b-922f-05aa6c2113d8';
checkBookingExists(bookingId)
  .then(exists => {
    console.log(`\n🎯 Résultat: Booking ${exists ? 'existe' : 'n\'existe pas'}`);
  })
  .catch(error => {
    console.error('❌ Erreur fatale:', error);
  });



