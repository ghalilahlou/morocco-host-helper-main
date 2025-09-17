import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

async function checkDatabasePermissions() {
  console.log('🔍 === VÉRIFICATION BASE DE DONNÉES ===');
  console.log('📅 Timestamp:', new Date().toISOString());
  console.log();

  // 1. Test de connexion de base
  console.log('🔗 1. TEST DE CONNEXION...');
  try {
    const { data, error } = await supabase.auth.getSession();
    console.log('✅ Connexion Supabase OK');
  } catch (error) {
    console.log('❌ Erreur connexion Supabase:', error.message);
  }

  // 2. Test lecture table bookings
  console.log('\n📋 2. TEST TABLE BOOKINGS...');
  try {
    const { data, error, count } = await supabase
      .from('bookings')
      .select('*', { count: 'exact' })
      .limit(1);

    if (error) {
      console.log('❌ Erreur lecture bookings:', error);
      console.log('   Code:', error.code);
      console.log('   Message:', error.message);
      console.log('   Details:', error.details);
      console.log('   Hint:', error.hint);
    } else {
      console.log('✅ Table bookings accessible');
      console.log(`   Nombre total: ${count}`);
      console.log(`   Premier résultat:`, data?.[0] || 'Aucun');
    }
  } catch (exception) {
    console.log('💥 Exception bookings:', exception.message);
  }

  // 3. Test lecture table guests
  console.log('\n👥 3. TEST TABLE GUESTS...');
  try {
    const { data, error, count } = await supabase
      .from('guests')
      .select('*', { count: 'exact' })
      .limit(1);

    if (error) {
      console.log('❌ Erreur lecture guests:', error.message);
    } else {
      console.log('✅ Table guests accessible');
      console.log(`   Nombre total: ${count}`);
    }
  } catch (exception) {
    console.log('💥 Exception guests:', exception.message);
  }

  // 4. Test lecture table uploaded_documents
  console.log('\n📄 4. TEST TABLE UPLOADED_DOCUMENTS...');
  try {
    const { data, error, count } = await supabase
      .from('uploaded_documents')
      .select('*', { count: 'exact' })
      .limit(1);

    if (error) {
      console.log('❌ Erreur lecture uploaded_documents:', error.message);
    } else {
      console.log('✅ Table uploaded_documents accessible');
      console.log(`   Nombre total: ${count}`);
    }
  } catch (exception) {
    console.log('💥 Exception uploaded_documents:', exception.message);
  }

  // 5. Test lecture table property_verification_tokens
  console.log('\n🔑 5. TEST TABLE PROPERTY_VERIFICATION_TOKENS...');
  try {
    const { data, error, count } = await supabase
      .from('property_verification_tokens')
      .select('*', { count: 'exact' })
      .limit(1);

    if (error) {
      console.log('❌ Erreur lecture property_verification_tokens:', error.message);
    } else {
      console.log('✅ Table property_verification_tokens accessible');
      console.log(`   Nombre total: ${count}`);
    }
  } catch (exception) {
    console.log('💥 Exception property_verification_tokens:', exception.message);
  }

  // 6. Test insertion simple dans bookings
  console.log('\n📝 6. TEST INSERTION BOOKINGS...');
  try {
    const { data, error } = await supabase
      .from('bookings')
      .insert({
        property_id: 'test-permission-check',
        check_in_date: '2025-09-20',
        check_out_date: '2025-09-25',
        number_of_guests: 1,
        status: 'confirmed'
      })
      .select()
      .single();

    if (error) {
      console.log('❌ Erreur insertion bookings:', error);
      console.log('   Code:', error.code);
      console.log('   Message:', error.message);
      console.log('   Details:', error.details);
    } else {
      console.log('✅ Insertion bookings OK');
      console.log('   Booking créé:', data.id);
      
      // Nettoyer le test
      await supabase.from('bookings').delete().eq('id', data.id);
      console.log('✅ Test booking supprimé');
    }
  } catch (exception) {
    console.log('💥 Exception insertion bookings:', exception.message);
  }
}

checkDatabasePermissions();
