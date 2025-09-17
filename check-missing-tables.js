// Vérifier les tables manquantes
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://csopyblkfyofwkeqqegd.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNzb3B5YmxrZnlvZndrZXFxZWdkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTM5OTkwNTQsImV4cCI6MjA2OTU3NTA1NH0.QcIqFLgD6Cg5hYu5Q4iQjvuckTVJyKo6wDd9AMEeakM';

const supabase = createClient(supabaseUrl, supabaseKey);

console.log('🔍 Vérification des tables manquantes');
console.log('====================================');

async function checkTables() {
  const tablesToCheck = [
    'airbnb_sync_status',
    'airbnb_reservations',
    'properties',
    'bookings',
    'guests',
    'uploaded_documents'
  ];

  for (const tableName of tablesToCheck) {
    try {
      const { data, error } = await supabase
        .from(tableName)
        .select('*')
        .limit(1);
      
      if (error) {
        console.log(`❌ Table '${tableName}' - ERREUR:`, error.message);
      } else {
        console.log(`✅ Table '${tableName}' - OK`);
      }
    } catch (err) {
      console.log(`❌ Table '${tableName}' - ERREUR:`, err.message);
    }
  }
}

checkTables().catch(console.error);
