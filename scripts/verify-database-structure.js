#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';

// Configuration Supabase
const SUPABASE_URL = "https://csopyblkfyofwkeqqegd.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNzb3B5YmxrZnlvZndrZXFxZWdkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTM5OTkwNTQsImV4cCI6MjA2OTU3NTA1NH0.QcIqFLgD6Cg5hYu5Q4iQjvuckTVJyKo6wDd9AMEeakM";

console.log('🔍 Vérification de la Structure de Base de Données - Morocco Host Helper');
console.log('======================================================================');
console.log(`📡 URL: ${SUPABASE_URL}`);
console.log(`🔑 Project ID: csopyblkfyofwkeqqegd`);
console.log('');

// Créer le client Supabase
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Structure attendue basée sur votre schéma
const expectedTables = [
  'airbnb_reservations',
  'airbnb_sync_status',
  'bookings',
  'contract_signatures',
  'guest_submissions',
  'guest_verification_tokens',
  'guests',
  'host_profiles',
  'properties',
  'property_verification_tokens',
  'system_logs',
  'uploaded_documents'
];

async function verifyDatabaseStructure() {
  try {
    console.log('📊 Vérification des tables attendues...');
    console.log('');
    
    const tableStatus = {};
    
    for (const table of expectedTables) {
      try {
        const { data, error } = await supabase
          .from(table)
          .select('*')
          .limit(1);
        
        if (error) {
          console.log(`❌ Table ${table}: ${error.message}`);
          tableStatus[table] = 'missing';
        } else {
          console.log(`✅ Table ${table}: Accessible`);
          tableStatus[table] = 'exists';
        }
      } catch (err) {
        console.log(`❌ Table ${table}: ${err.message}`);
        tableStatus[table] = 'error';
      }
    }
    
    console.log('\n📋 Résumé de la structure:');
    console.log('==========================');
    
    const existingTables = Object.entries(tableStatus).filter(([_, status]) => status === 'exists');
    const missingTables = Object.entries(tableStatus).filter(([_, status]) => status === 'missing');
    const errorTables = Object.entries(tableStatus).filter(([_, status]) => status === 'error');
    
    console.log(`✅ Tables existantes: ${existingTables.length}/${expectedTables.length}`);
    console.log(`❌ Tables manquantes: ${missingTables.length}`);
    console.log(`⚠️  Tables avec erreur: ${errorTables.length}`);
    
    if (missingTables.length > 0) {
      console.log('\n🔧 Tables manquantes:');
      missingTables.forEach(([table, _]) => {
        console.log(`   - ${table}`);
      });
    }
    
    if (errorTables.length > 0) {
      console.log('\n⚠️  Tables avec erreur:');
      errorTables.forEach(([table, _]) => {
        console.log(`   - ${table}`);
      });
    }
    
    // Vérifier les contraintes et relations
    console.log('\n🔗 Vérification des relations...');
    await verifyRelations();
    
    // Vérifier les types personnalisés
    console.log('\n🏷️  Vérification des types personnalisés...');
    await verifyCustomTypes();
    
    console.log('\n🎉 Vérification terminée !');
    
  } catch (error) {
    console.error('❌ Erreur lors de la vérification:', error.message);
  }
}

async function verifyRelations() {
  try {
    // Vérifier quelques relations clés
    const relations = [
      { table: 'bookings', relation: 'properties' },
      { table: 'guests', relation: 'bookings' },
      { table: 'property_verification_tokens', relation: 'properties' },
      { table: 'guest_submissions', relation: 'property_verification_tokens' }
    ];
    
    for (const rel of relations) {
      try {
        const { data, error } = await supabase
          .from(rel.table)
          .select(`*, ${rel.relation}(*)`)
          .limit(1);
        
        if (error) {
          console.log(`   ⚠️  Relation ${rel.table} -> ${rel.relation}: ${error.message}`);
        } else {
          console.log(`   ✅ Relation ${rel.table} -> ${rel.relation}: OK`);
        }
      } catch (err) {
        console.log(`   ❌ Relation ${rel.table} -> ${rel.relation}: ${err.message}`);
      }
    }
  } catch (error) {
    console.log(`   ❌ Erreur lors de la vérification des relations: ${error.message}`);
  }
}

async function verifyCustomTypes() {
  try {
    // Vérifier les types personnalisés comme booking_status
    const { data, error } = await supabase
      .from('bookings')
      .select('status')
      .limit(1);
    
    if (error) {
      console.log(`   ⚠️  Type booking_status: ${error.message}`);
    } else {
      console.log(`   ✅ Type booking_status: OK`);
    }
  } catch (error) {
    console.log(`   ❌ Erreur lors de la vérification des types: ${error.message}`);
  }
}

// Exécuter la vérification
verifyDatabaseStructure();
