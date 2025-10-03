// Simple script to apply the is_active column fix directly
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://csopyblkfyofwkeqqegd.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseKey) {
  console.error('❌ Missing Supabase key. Please set SUPABASE_SERVICE_ROLE_KEY or VITE_SUPABASE_ANON_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function applyIsActiveFix() {
  try {
    console.log('🔧 Applying is_active column fix to properties table...');
    
    // Check if column exists
    const { data: columns, error: checkError } = await supabase
      .rpc('exec_sql', {
        sql: `
          SELECT column_name 
          FROM information_schema.columns 
          WHERE table_name = 'properties' 
          AND column_name = 'is_active'
        `
      });
    
    if (checkError) {
      console.error('❌ Error checking columns:', checkError);
      return;
    }
    
    if (columns && columns.length > 0) {
      console.log('✅ is_active column already exists');
      return;
    }
    
    // Add the column
    const { error: addError } = await supabase
      .rpc('exec_sql', {
        sql: `
          ALTER TABLE public.properties 
          ADD COLUMN is_active BOOLEAN DEFAULT TRUE;
        `
      });
    
    if (addError) {
      console.error('❌ Error adding column:', addError);
      return;
    }
    
    console.log('✅ Successfully added is_active column to properties table');
    
    // Update existing properties to be active
    const { error: updateError } = await supabase
      .rpc('exec_sql', {
        sql: `
          UPDATE public.properties 
          SET is_active = TRUE 
          WHERE is_active IS NULL;
        `
      });
    
    if (updateError) {
      console.error('❌ Error updating existing properties:', updateError);
      return;
    }
    
    console.log('✅ Updated existing properties to be active');
    console.log('🎉 Database schema fix completed successfully!');
    
  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

applyIsActiveFix();
