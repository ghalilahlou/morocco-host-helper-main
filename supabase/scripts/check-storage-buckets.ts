import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabaseUrl = Deno.env.get('SUPABASE_URL');
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

if (!supabaseUrl || !serviceRoleKey) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  Deno.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, { 
  auth: { persistSession: false } 
});

async function checkStorageBuckets() {
  console.log('🔍 Checking storage buckets...');
  
  const buckets = ['guest-documents', 'contracts', 'police-forms', 'documents'];
  
  for (const bucketName of buckets) {
    try {
      console.log(`\n📦 Checking bucket: ${bucketName}`);
      
      // List files in bucket
      const { data: files, error } = await supabase.storage
        .from(bucketName)
        .list('', { limit: 10 });
      
      if (error) {
        console.error(`❌ Error accessing bucket ${bucketName}:`, error.message);
      } else {
        console.log(`✅ Bucket ${bucketName} accessible`);
        console.log(`📁 Files found: ${files?.length || 0}`);
        
        if (files && files.length > 0) {
          console.log('📄 Sample files:');
          files.slice(0, 3).forEach(file => {
            console.log(`  - ${file.name} (${file.metadata?.size || 'unknown size'})`);
          });
        }
      }
    } catch (err) {
      console.error(`❌ Exception checking bucket ${bucketName}:`, err);
    }
  }
}

async function checkDatabaseSchema() {
  console.log('\n🔍 Checking database schema...');
  
  try {
    // Check generated_documents table
    const { data: generatedDocs, error: genError } = await supabase
      .from('generated_documents')
      .select('*')
      .limit(1);
    
    if (genError) {
      console.error('❌ Error accessing generated_documents:', genError.message);
    } else {
      console.log('✅ generated_documents table accessible');
    }
    
    // Check uploaded_documents table
    const { data: uploadedDocs, error: uploadError } = await supabase
      .from('uploaded_documents')
      .select('*')
      .limit(1);
    
    if (uploadError) {
      console.error('❌ Error accessing uploaded_documents:', uploadError.message);
    } else {
      console.log('✅ uploaded_documents table accessible');
    }
    
  } catch (err) {
    console.error('❌ Exception checking database:', err);
  }
}

async function main() {
  console.log('🚀 Storage and Database Diagnostic Tool');
  console.log('=====================================\n');
  
  await checkStorageBuckets();
  await checkDatabaseSchema();
  
  console.log('\n✅ Diagnostic complete');
}

if (import.meta.main) {
  await main();
}
