// Script pour générer le SQL correct basé sur les vraies colonnes de la base
// Ce script peut être utilisé pour vérifier et corriger les requêtes SQL

console.log('🔍 GÉNÉRATION DU SQL CORRECT');
console.log('=' .repeat(50));

// Structure des tables basée sur le schéma fourni
const tableStructures = {
  'airbnb_sync_status': [
    'id', 'property_id', 'last_sync_at', 'sync_status', 
    'last_error', 'reservations_count', 'created_at', 'updated_at'
  ],
  'guest_submissions': [
    'id', 'token_id', 'booking_data', 'guest_data', 'document_urls',
    'signature_data', 'submitted_at', 'status', 'reviewed_by', 
    'reviewed_at', 'created_at', 'updated_at', 'booking_id'
  ],
  'uploaded_documents': [
    'id', 'booking_id', 'guest_id', 'file_name', 'file_path',
    'processing_status', 'extracted_data', 'created_at', 'updated_at',
    'document_url', 'contract_url', 'police_form_url', 'document_type',
    'is_signed', 'signature_data', 'signed_at'
  ],
  'properties': [
    'id', 'name', 'address', 'contact_info', 'created_at', 'updated_at',
    'user_id', 'property_type', 'max_occupancy', 'description', 'house_rules',
    'contract_template', 'airbnb_ics_url', 'photo_url', 'remaining_actions_hidden',
    'city', 'country', 'price_per_night', 'max_guests'
  ],
  'bookings': [
    'id', 'property_id', 'check_in_date', 'check_out_date', 'number_of_guests',
    'booking_reference', 'status', 'documents_generated', 'created_at', 'updated_at',
    'user_id', 'signed_contract_url', 'submission_id', 'guest_name', 'guest_email',
    'guest_phone', 'total_price', 'notes', 'documents_status', 'total_amount'
  ],
  'guests': [
    'id', 'booking_id', 'nationality', 'document_type', 'created_at', 'updated_at',
    'full_name', 'document_number', 'date_of_birth', 'place_of_birth'
  ],
  'admin_users': [
    'id', 'user_id', 'role', 'permissions', 'created_at', 'updated_at',
    'created_by', 'is_active', 'email', 'full_name'
  ],
  'token_allocations': [
    'id', 'user_id', 'tokens_allocated', 'tokens_used', 'tokens_remaining',
    'is_active', 'created_at', 'updated_at', 'allocated_by', 'notes'
  ],
  'token_control_settings': [
    'id', 'property_id', 'control_type', 'max_reservations', 'current_reservations',
    'is_enabled', 'created_at', 'updated_at'
  ],
  'host_profiles': [
    'id', 'full_name', 'phone', 'avatar_url', 'created_at', 'updated_at'
  ]
};

// Générer les requêtes SQL correctes
function generateCorrectSQL() {
  console.log('\n📋 REQUÊTES SQL CORRIGÉES:');
  console.log('-'.repeat(30));

  // Requête pour airbnb_sync_status
  console.log('\n1. airbnb_sync_status:');
  console.log(`
SELECT 
    'airbnb_sync_status' as table_name,
    id,
    property_id,
    sync_status,  -- ✅ CORRECT (pas 'status')
    last_sync_at,
    reservations_count,
    last_error,
    created_at,
    updated_at
FROM airbnb_sync_status 
ORDER BY updated_at DESC
LIMIT 10;
  `);

  // Requête pour guest_submissions
  console.log('\n2. guest_submissions:');
  console.log(`
SELECT 
    'guest_submissions' as table_name,
    id,
    booking_id,
    token_id,
    status,  -- ✅ CORRECT
    created_at,
    booking_data,
    guest_data
FROM guest_submissions 
ORDER BY created_at DESC
LIMIT 10;
  `);

  // Requête pour uploaded_documents
  console.log('\n3. uploaded_documents:');
  console.log(`
SELECT 
    'uploaded_documents' as table_name,
    id,
    booking_id,
    guest_id,
    file_name,
    document_type,
    processing_status,
    created_at,
    document_url,
    is_signed
FROM uploaded_documents 
ORDER BY created_at DESC
LIMIT 10;
  `);

  // Requête pour properties
  console.log('\n4. properties:');
  console.log(`
SELECT 
    'properties' as table_name,
    id,
    name,
    airbnb_ics_url,  -- ✅ CORRECT
    created_at,
    updated_at
FROM properties 
WHERE airbnb_ics_url IS NOT NULL
ORDER BY updated_at DESC
LIMIT 10;
  `);
}

// Vérifier les colonnes d'une table
function checkTableColumns(tableName) {
  const columns = tableStructures[tableName];
  if (!columns) {
    console.log(`❌ Table ${tableName} non trouvée`);
    return;
  }
  
  console.log(`\n📊 ${tableName}:`);
  console.log(`   Colonnes: ${columns.join(', ')}`);
  console.log(`   Total: ${columns.length} colonnes`);
}

// Afficher toutes les structures
function showAllStructures() {
  console.log('\n📋 STRUCTURE DE TOUTES LES TABLES:');
  console.log('=' .repeat(50));
  
  Object.keys(tableStructures).forEach(tableName => {
    checkTableColumns(tableName);
  });
}

// Générer le script de test
function generateTestScript() {
  console.log('\n🧪 SCRIPT DE TEST GÉNÉRÉ:');
  console.log('-'.repeat(30));
  
  console.log(`
-- Test rapide des colonnes principales
SELECT 'airbnb_sync_status' as table_name, COUNT(*) as count FROM airbnb_sync_status;
SELECT 'guest_submissions' as table_name, COUNT(*) as count FROM guest_submissions;
SELECT 'uploaded_documents' as table_name, COUNT(*) as count FROM uploaded_documents;
SELECT 'properties' as table_name, COUNT(*) as count FROM properties WHERE airbnb_ics_url IS NOT NULL;
SELECT 'bookings' as table_name, COUNT(*) as count FROM bookings;
SELECT 'guests' as table_name, COUNT(*) as count FROM guests;
SELECT 'admin_users' as table_name, COUNT(*) as count FROM admin_users WHERE is_active = true;
SELECT 'token_allocations' as table_name, COUNT(*) as count FROM token_allocations WHERE is_active = true;
SELECT 'token_control_settings' as table_name, COUNT(*) as count FROM token_control_settings WHERE is_enabled = true;
SELECT 'host_profiles' as table_name, COUNT(*) as count FROM host_profiles;
  `);
}

// Exécuter toutes les fonctions
generateCorrectSQL();
showAllStructures();
generateTestScript();

console.log('\n✅ SCRIPT TERMINÉ');
console.log('💡 Utilisez ces requêtes corrigées dans votre base de données');
