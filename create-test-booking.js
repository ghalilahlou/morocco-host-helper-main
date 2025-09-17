// Créer une réservation de test pour les fonctions de génération
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://csopyblkfyofwkeqqegd.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNzb3B5YmxrZnlvZndrZXFxZWdkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTM5OTkwNTQsImV4cCI6MjA2OTU3NTA1NH0.QcIqFLgD6Cg5hYu5Q4iQjvuckTVJyKo6wDd9AMEeakM';

const supabase = createClient(supabaseUrl, supabaseKey);

console.log('🔧 Création d\'une réservation de test');
console.log('=====================================');

async function createTestBooking() {
  const testBooking = {
    property_id: '6e43448b-aa06-44aa-85ff-d2f3042f463e',
    airbnb_booking_id: 'HM2KBR5WFZ',
    summary: 'Test Reservation',
    start_date: '2025-09-08',
    end_date: '2025-09-11',
    guest_name: 'MARTIN Maëlis-Gaëlle, Marie',
    number_of_guests: 2,
    description: 'Test reservation for document generation',
    raw_event_data: { test: true }
  };

  try {
    // Insérer la réservation
    const { data: booking, error: bookingError } = await supabase
      .from('airbnb_reservations')
      .insert([testBooking])
      .select();

    if (bookingError) {
      console.log('❌ Erreur création réservation:', bookingError);
      return;
    }

    console.log('✅ Réservation créée:', booking[0].id);

    // Créer un invité de test
    const testGuest = {
      full_name: 'MARTIN Maëlis-Gaëlle, Marie',
      first_name: 'Maëlis-Gaëlle',
      last_name: 'MARTIN',
      email: 'maelis.martin@example.com',
      phone: '+33123456789',
      nationality: 'FRA',
      date_of_birth: '1990-07-13',
      place_of_birth: 'PARIS',
      document_number: 'D2H6862M2',
      document_type: 'Carte Nationale d\'Identité',
      sex: 'F',
      address: '123 Rue de la Paix, 75001 Paris, France'
    };

    const { data: guest, error: guestError } = await supabase
      .from('guests')
      .insert([testGuest])
      .select();

    if (guestError) {
      console.log('❌ Erreur création invité:', guestError);
    } else {
      console.log('✅ Invité créé:', guest[0].id);
    }

    // Créer une réservation liée
    const testBookingLink = {
      property_id: '6e43448b-aa06-44aa-85ff-d2f3042f463e',
      guest_id: guest[0].id,
      airbnb_booking_id: 'HM2KBR5WFZ',
      check_in_date: '2025-09-08',
      check_out_date: '2025-09-11',
      number_of_guests: 2,
      total_amount: 450.00,
      currency: 'EUR',
      status: 'confirmed'
    };

    const { data: bookingLink, error: bookingLinkError } = await supabase
      .from('bookings')
      .insert([testBookingLink])
      .select();

    if (bookingLinkError) {
      console.log('❌ Erreur création lien réservation:', bookingLinkError);
    } else {
      console.log('✅ Lien réservation créé:', bookingLink[0].id);
    }

    console.log('\n✅ Données de test créées avec succès !');
    console.log('Vous pouvez maintenant tester les fonctions de génération.');

  } catch (error) {
    console.log('❌ Exception:', error.message);
  }
}

createTestBooking().catch(console.error);
