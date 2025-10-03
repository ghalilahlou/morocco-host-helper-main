// Script de test pour vérifier que la mise à jour des bookings fonctionne
// sans la colonne metadata

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ Missing Supabase environment variables');
  throw new Error('Missing Supabase configuration');
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

export async function testBookingUpdate(bookingId: string) {
  console.log('🧪 Testing booking update without metadata column...');
  
  try {
    // Test avec les colonnes existantes uniquement
    const updateData = {
      status: 'confirmed',
      guest_name: 'Test Guest',
      contract_url: 'https://example.com/contract.pdf',
      police_url: 'generated',
      email_sent: true,
      updated_at: new Date().toISOString()
    };
    
    console.log('📝 Update data:', updateData);
    
    const { data, error } = await supabase
      .from('bookings')
      .update(updateData)
      .eq('id', bookingId)
      .select();
    
    if (error) {
      console.error('❌ Update failed:', error);
      throw error;
    }
    
    console.log('✅ Update successful:', data);
    return data;
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    throw error;
  }
}

// Fonction pour vérifier le schéma de la table bookings
export async function checkBookingsSchema() {
  console.log('🔍 Checking bookings table schema...');
  
  try {
    const { data, error } = await supabase
      .from('bookings')
      .select('*')
      .limit(1);
    
    if (error) {
      console.error('❌ Schema check failed:', error);
      throw error;
    }
    
    console.log('✅ Schema check successful');
    console.log('📋 Available columns:', data?.[0] ? Object.keys(data[0]) : 'No data');
    
    return data;
    
  } catch (error) {
    console.error('❌ Schema check failed:', error);
    throw error;
  }
}
